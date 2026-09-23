// 시리얼 전송 계층
//  - SerialTransport : Web Serial API (데스크톱 Chrome/Edge, 최신 Android Chrome)
//  - UsbCdcTransport : WebUSB 로 USB CDC-ACM 을 직접 구동 (Web Serial 이 없는 Android Chrome 용)
// 두 클래스 모두 같은 인터페이스를 가집니다:
//   open(), close(), write(Uint8Array), ondata(Uint8Array), ondisconnect(), info {vid, pid, kind}

export const USB_FILTERS = [
  { vid: 0x2E8A }, // Raspberry Pi (Pico, Pico W, Pico 2)
  { vid: 0x0D28 }, // ARM mbed DAPLink (micro:bit)
  { vid: 0x303A }, // Espressif
  { vid: 0x10C4 }, // Silicon Labs CP210x
  { vid: 0x1A86 }, // WCH CH340
  { vid: 0x0403 }, // FTDI
  { vid: 0x239A }, // Adafruit
];

const BAUD = 115200;

export class SerialTransport {
  static get supported() { return 'serial' in navigator; }

  constructor() {
    this.ondata = () => {};
    this.ondisconnect = () => {};
    this.info = { kind: 'Web Serial' };
  }

  async open({ anyDevice = false } = {}) {
    const filters = anyDevice ? [] : USB_FILTERS.map(f => ({ usbVendorId: f.vid }));
    this.port = await navigator.serial.requestPort({ filters });
    await this.port.open({ baudRate: BAUD, bufferSize: 8192 });
    try { await this.port.setSignals({ dataTerminalReady: true, requestToSend: true }); } catch (_) {}
    const i = this.port.getInfo();
    this.info = { kind: 'Web Serial', vid: i.usbVendorId, pid: i.usbProductId };
    this.keepReading = true;
    this._onDisc = (e) => { if (e.target === this.port) this._lost(); };
    navigator.serial.addEventListener('disconnect', this._onDisc);
    this.readDone = this._readLoop();
  }

  async _readLoop() {
    while (this.keepReading && this.port.readable) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value && value.length) this.ondata(value);
        }
      } catch (e) {
        // 일시적인 오류(framing 등)는 무시하고 다시 읽기
        if (!this.keepReading) break;
      } finally {
        try { this.reader.releaseLock(); } catch (_) {}
      }
    }
    if (this.keepReading) this._lost();
  }

  _lost() {
    if (this.closed) return;
    this.closed = true;
    this.keepReading = false;
    this.ondisconnect();
  }

  async write(data) {
    const w = this.port.writable.getWriter();
    try { await w.write(data); } finally { w.releaseLock(); }
  }

  async close() {
    this.closed = true;
    this.keepReading = false;
    navigator.serial.removeEventListener('disconnect', this._onDisc);
    try { await this.reader?.cancel(); } catch (_) {}
    try { await this.readDone; } catch (_) {}
    try { await this.port?.close(); } catch (_) {}
  }
}

export class UsbCdcTransport {
  static get supported() { return 'usb' in navigator; }

  constructor() {
    this.ondata = () => {};
    this.ondisconnect = () => {};
    this.info = { kind: 'WebUSB' };
  }

  async open({ anyDevice = false } = {}) {
    const filters = anyDevice ? [] : USB_FILTERS.map(f => ({ vendorId: f.vid }));
    const dev = await navigator.usb.requestDevice({ filters });
    this.dev = dev;
    await dev.open();
    if (!dev.configuration) await dev.selectConfiguration(1);

    let ctrl = null, data = null;
    for (const iface of dev.configuration.interfaces) {
      const alt = iface.alternates[0];
      if (alt.interfaceClass === 0x02 && ctrl === null) ctrl = iface.interfaceNumber;
      if (alt.interfaceClass === 0x0A && !data) {
        const epIn = alt.endpoints.find(e => e.direction === 'in' && e.type === 'bulk');
        const epOut = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
        if (epIn && epOut) data = { num: iface.interfaceNumber, epIn, epOut };
      }
    }
    if (!data) throw new Error('이 장치에서 USB 시리얼(CDC) 인터페이스를 찾지 못했습니다.');

    try {
      await dev.claimInterface(data.num);
    } catch (e) {
      throw new Error('USB 인터페이스를 점유할 수 없습니다. 다른 프로그램이 사용 중이거나 OS 드라이버가 잡고 있습니다. (데스크톱에서는 Web Serial 모드를 사용하세요)');
    }
    if (ctrl !== null) { try { await dev.claimInterface(ctrl); } catch (_) {} }
    this.ctrl = ctrl ?? data.num;
    this.data = data;

    // SET_LINE_CODING: 115200 8N1
    const lc = new ArrayBuffer(7);
    const dv = new DataView(lc);
    dv.setUint32(0, BAUD, true); dv.setUint8(4, 0); dv.setUint8(5, 0); dv.setUint8(6, 8);
    try { await dev.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x20, value: 0, index: this.ctrl }, lc); } catch (_) {}
    // SET_CONTROL_LINE_STATE: DTR | RTS (MicroPython 은 DTR 이 켜져야 출력합니다)
    try { await dev.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x22, value: 0x03, index: this.ctrl }); } catch (_) {}

    this.info = { kind: 'WebUSB', vid: dev.vendorId, pid: dev.productId };
    this.keepReading = true;
    this._onDisc = (e) => { if (e.device === this.dev) this._lost(); };
    navigator.usb.addEventListener('disconnect', this._onDisc);
    this.readDone = this._readLoop();
  }

  async _readLoop() {
    const { epIn } = this.data;
    while (this.keepReading) {
      try {
        const r = await this.dev.transferIn(epIn.endpointNumber, epIn.packetSize || 64);
        if (r.status === 'stall') {
          await this.dev.clearHalt('in', epIn.endpointNumber);
          continue;
        }
        if (r.data && r.data.byteLength) this.ondata(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength));
      } catch (e) {
        if (this.keepReading) this._lost();
        break;
      }
    }
  }

  _lost() {
    if (this.closed) return;
    this.closed = true;
    this.keepReading = false;
    this.ondisconnect();
  }

  async write(bytes) {
    const { epOut } = this.data;
    const size = epOut.packetSize || 64;
    for (let i = 0; i < bytes.length; i += size) {
      await this.dev.transferOut(epOut.endpointNumber, bytes.subarray(i, i + size));
    }
  }

  async close() {
    this.closed = true;
    this.keepReading = false;
    navigator.usb.removeEventListener('disconnect', this._onDisc);
    try { await this.dev.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x22, value: 0x00, index: this.ctrl }); } catch (_) {}
    try { await this.dev.close(); } catch (_) {}
  }
}

// 환경에 맞는 전송 방식을 선택. pref: 'auto' | 'serial' | 'usb'
export function createTransport(pref = 'auto') {
  if (pref === 'serial' && SerialTransport.supported) return new SerialTransport();
  if (pref === 'usb' && UsbCdcTransport.supported) return new UsbCdcTransport();
  // Android 에서는 WebUSB 로 CDC 를 직접 구동하는 방식이 가장 안정적입니다
  if (pref === 'auto' && /Android/i.test(navigator.userAgent) && UsbCdcTransport.supported) return new UsbCdcTransport();
  if (SerialTransport.supported) return new SerialTransport();
  if (UsbCdcTransport.supported) return new UsbCdcTransport();
  return null;
}
