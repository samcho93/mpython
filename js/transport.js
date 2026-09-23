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
const hex = (n) => '0x' + (n ?? 0).toString(16).toUpperCase().padStart(4, '0');

export class SerialTransport {
  static get supported() { return 'serial' in navigator; }

  constructor() {
    this.ondata = () => {};
    this.ondisconnect = () => {};
    this.info = { kind: 'Web Serial' };
  }

  async open({ anyDevice = false, device = null } = {}) {
    const log = this.log || (() => {});
    const filters = anyDevice ? [] : USB_FILTERS.map(f => ({ usbVendorId: f.vid }));
    this.port = device || await navigator.serial.requestPort({ filters });
    const pi = this.port.getInfo();
    log(`포트 선택됨 (VID ${hex(pi.usbVendorId)} PID ${hex(pi.usbProductId)})`);
    try {
      await this.port.open({ baudRate: BAUD, bufferSize: 8192 });
    } catch (e) {
      throw new Error(`시리얼 포트를 열 수 없습니다 (${e.name}). 다른 프로그램(Thonny 등)이 사용 중이면 종료하세요.`);
    }
    log('포트 열기 성공');
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

  /** device 를 주면 선택 창 없이 바로 연결 (이전에 허용한 장치 자동 연결용) */
  async open({ anyDevice = false, device = null } = {}) {
    const log = this.log || (() => {});
    let dev = device;
    if (!dev) {
      const filters = anyDevice ? [] : USB_FILTERS.map(f => ({ vendorId: f.vid }));
      dev = await navigator.usb.requestDevice({ filters });
    }
    this.dev = dev;
    log(`장치 선택됨: ${dev.productName || '?'} (VID ${hex(dev.vendorId)} PID ${hex(dev.productId)})`);
    if (dev.vendorId === 0x2E8A && dev.productId === 0x0003) {
      throw new Error('Pico 가 BOOTSEL(저장장치) 모드입니다. BOOTSEL 버튼을 누르지 말고 다시 연결하거나, MicroPython 펌웨어(.uf2)를 먼저 설치하세요.');
    }
    try {
      if (!dev.opened) await dev.open();
    } catch (e) {
      throw new Error(`USB 장치를 열 수 없습니다 (${e.name}). 다른 앱이 사용 중이면 종료하고, Android 의 USB 접근 허용 창에서 '허용'을 누르세요.`);
    }
    log('USB 열기 성공');
    if (!dev.configuration) await dev.selectConfiguration(1);

    let ctrl = null, data = null;
    const summary = [];
    for (const iface of dev.configuration.interfaces) {
      const alt = iface.alternate || iface.alternates[0];
      summary.push(`#${iface.interfaceNumber}:0x${alt.interfaceClass.toString(16)}`);
      if (alt.interfaceClass === 0x02 && ctrl === null) ctrl = iface.interfaceNumber;
      if (alt.interfaceClass === 0x0A && !data) {
        const epIn = alt.endpoints.find(e => e.direction === 'in' && e.type === 'bulk');
        const epOut = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
        if (epIn && epOut) data = { num: iface.interfaceNumber, epIn, epOut };
      }
    }
    log(`인터페이스: ${summary.join(' ')}`);
    if (!data) throw new Error('이 장치에서 USB 시리얼(CDC) 인터페이스를 찾지 못했습니다. MicroPython 펌웨어가 설치되어 있는지 확인하세요.');

    try {
      await dev.claimInterface(data.num);
    } catch (e) {
      throw new Error(`USB 인터페이스를 점유할 수 없습니다 (${e.name}). 다른 앱(시리얼 터미널 등)이 사용 중이면 종료하세요. PC 에서는 설정에서 연결 방식을 Web Serial 로 바꾸세요.`);
    }
    if (ctrl !== null) {
      try { await dev.claimInterface(ctrl); } catch (e) { log(`제어 인터페이스 점유 실패: ${e.name}`); ctrl = null; }
    }
    this.data = data;

    // SET_LINE_CODING(115200 8N1) + SET_CONTROL_LINE_STATE(DTR|RTS)
    // MicroPython 은 DTR 이 켜져야 출력을 보냅니다. 제어 인터페이스 → 데이터 인터페이스 순으로 시도.
    const lc = new ArrayBuffer(7);
    const dv = new DataView(lc);
    dv.setUint32(0, BAUD, true); dv.setUint8(4, 0); dv.setUint8(5, 0); dv.setUint8(6, 8);
    this.ctrl = null;
    for (const idx of [ctrl, data.num].filter(i => i !== null)) {
      try {
        await dev.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x20, value: 0, index: idx }, lc);
        const r = await dev.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x22, value: 0x03, index: idx });
        if (r.status === 'ok') { this.ctrl = idx; break; }
        log(`DTR 설정 응답: ${r.status} (인터페이스 #${idx})`);
      } catch (e) {
        log(`DTR 설정 실패 (인터페이스 #${idx}): ${e.name}`);
      }
    }
    log(this.ctrl !== null ? 'DTR 설정 완료, 수신 대기' : '경고: DTR 을 설정하지 못해 장치가 응답하지 않을 수 있습니다');

    this.info = { kind: 'WebUSB', vid: dev.vendorId, pid: dev.productId };
    this.keepReading = true;
    this._onDisc = (e) => { if (e.device === this.dev) this._lost(); };
    navigator.usb.addEventListener('disconnect', this._onDisc);
    this.readDone = this._readLoop();
  }

  async _readLoop() {
    const { epIn } = this.data;
    let errors = 0;
    while (this.keepReading) {
      try {
        const r = await this.dev.transferIn(epIn.endpointNumber, epIn.packetSize || 64);
        if (r.status === 'stall') {
          await this.dev.clearHalt('in', epIn.endpointNumber);
          continue;
        }
        errors = 0;
        if (r.data && r.data.byteLength) this.ondata(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength));
      } catch (e) {
        if (!this.keepReading) break;
        // 일시적인 전송 오류는 몇 번 재시도, 장치가 닫혔으면 연결 끊김 처리
        if (!this.dev.opened || ++errors > 5) {
          this.log?.(`수신 중단: ${e.name} ${e.message}`);
          this._lost();
          break;
        }
        await new Promise(r => setTimeout(r, 50));
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
    if (!this.dev) return;
    if (this.ctrl != null) {
      try { await this.dev.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x22, value: 0x00, index: this.ctrl }); } catch (_) {}
    }
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
