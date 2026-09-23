// MicroPython REPL 프로토콜 (raw REPL 기반 실행 / 파일 전송)
import { boardFromInfo, guessBoardFromUsb } from './boards.js';

const enc = new TextEncoder();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class Device {
  /**
   * @param transport SerialTransport | UsbCdcTransport
   * @param hooks { onOutput(text), onError(text), onDisconnect() }
   */
  constructor(transport, hooks) {
    this.t = transport;
    this.hooks = hooks;
    this.dec = new TextDecoder();
    this.buf = '';
    this.capture = false;      // true 면 수신 데이터를 버퍼에 모음(프로토콜 처리), false 면 터미널로 그대로 출력
    this.waiter = null;
    this.inRaw = false;
    this.busy = Promise.resolve();
    this.running = false;
    this.board = guessBoardFromUsb(transport.info.vid) || 'generic';
    this.chunk = 256;
    this.chunkDelay = 0;
    this.lastRx = 0;
    transport.ondata = (bytes) => this._rx(bytes);
    transport.ondisconnect = () => hooks.onDisconnect?.();
  }

  _rx(bytes) {
    this.lastRx = Date.now();
    const s = this.dec.decode(bytes, { stream: true });
    if (!s) return;
    if (!this.capture) { this.hooks.onOutput(s); return; }
    this.buf += s;
    this.waiter?.();
  }

  write(data) {
    return this.t.write(typeof data === 'string' ? enc.encode(data) : data);
  }

  // 동시에 두 명령이 섞이지 않도록 순차 실행
  _lock(fn) {
    const run = this.busy.then(fn, fn);
    this.busy = run.catch(() => {});
    return run;
  }

  /**
   * 버퍼에 term 이 나타날 때까지 기다림. term 앞 내용을 반환하고 버퍼에서 제거.
   * onChunk 가 주어지면 도착하는 즉시 흘려보냄(스트리밍).
   */
  readUntil(term, { timeout = 5000, onChunk = null } = {}) {
    return new Promise((resolve, reject) => {
      let out = '';
      let timer = null;
      const arm = () => {
        if (!timeout) return;
        clearTimeout(timer);
        timer = setTimeout(() => { this.waiter = null; reject(new Error('장치 응답 시간 초과')); }, timeout);
      };
      const check = () => {
        const i = this.buf.indexOf(term);
        if (i >= 0) {
          const part = this.buf.slice(0, i);
          this.buf = this.buf.slice(i + term.length);
          clearTimeout(timer);
          this.waiter = null;
          if (onChunk) { if (part) onChunk(part); resolve(''); }
          else resolve(out + part);
          return;
        }
        // 종료 문자열이 잘려서 올 수 있으므로 끝부분은 남겨둠
        const keep = term.length - 1;
        if (this.buf.length > keep) {
          const flush = this.buf.slice(0, this.buf.length - keep);
          this.buf = this.buf.slice(this.buf.length - keep);
          if (onChunk) onChunk(flush); else out += flush;
          if (onChunk) arm();
        }
      };
      this.abortWait = (err) => { clearTimeout(timer); this.waiter = null; reject(err); };
      this.waiter = check;
      arm();
      check();
    });
  }

  async _interrupt() {
    // 실행 중인 프로그램 중단
    await this.write('\r\x03');
    await sleep(60);
    await this.write('\x03');
    await sleep(120);
  }

  async enterRaw() {
    this.capture = true;
    if (this.inRaw) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      await this._interrupt();
      this.buf = '';
      await this.write('\r\x01');
      try {
        await this.readUntil('raw REPL; CTRL-B to exit\r\n>', { timeout: 1500 + attempt * 1000 });
        this.inRaw = true;
        return;
      } catch (_) { /* 재시도 */ }
    }
    this.capture = false;
    throw new Error('raw REPL 에 진입하지 못했습니다. 보드에 MicroPython 이 설치되어 있는지 확인하세요.');
  }

  /** 일반 REPL 로 복귀. 매번 나오는 배너는 숨기고, showPrompt 면 '>>> ' 만 표시 */
  async exitRaw(showPrompt = false) {
    if (this.inRaw) {
      this.inRaw = false;
      await this.write('\x02');
      try { await this.readUntil('>>> ', { timeout: 1000 }); } catch (_) {}
    }
    this.buf = '';
    this.capture = false;
    if (showPrompt) this.hooks.onOutput('\r\n>>> ');
  }

  async _sendCode(code) {
    const bytes = enc.encode(code);
    for (let i = 0; i < bytes.length; i += this.chunk) {
      await this.write(bytes.subarray(i, i + this.chunk));
      if (this.chunkDelay) await sleep(this.chunkDelay);
    }
    await this.write('\x04');
    await this.readUntil('OK', { timeout: 5000 });
  }

  /** raw REPL 에서 코드 실행 후 (stdout, stderr) 반환 */
  async _execRaw(code, timeout = 10000) {
    await this._sendCode(code);
    const out = await this.readUntil('\x04', { timeout });
    const err = await this.readUntil('\x04', { timeout });
    await this.readUntil('>', { timeout });
    return { out, err };
  }

  exec(code, timeout) {
    return this._lock(async () => {
      await this.enterRaw();
      try {
        const r = await this._execRaw(code, timeout);
        if (r.err) throw new DeviceError(r.err);
        return r.out;
      } finally {
        await this.exitRaw();
      }
    });
  }

  /** 보드 종류 판별 */
  async identify() {
    const code = 'import sys\ntry:\n import os\n m=os.uname().machine\nexcept:\n m=""\nprint(sys.platform+"|"+m)\n';
    const out = await this.exec(code, 4000);
    const line = out.trim().split('\n').pop().trim();
    const [platform, machine] = line.split('|');
    this.platform = platform;
    this.machine = machine || '';
    this.board = boardFromInfo(platform, machine);
    if (this.board.startsWith('microbit')) { this.chunk = 64; this.chunkDelay = 10; }
    return { board: this.board, platform, machine: this.machine };
  }

  /** 편집기 코드를 저장하지 않고 즉시 실행 (출력은 스트리밍) */
  run(code) {
    return this._lock(async () => {
      await this.enterRaw();
      this.running = true;
      try {
        await this._sendCode(code);
        await this.readUntil('\x04', { timeout: 0, onChunk: (s) => this.hooks.onOutput(s) });
        await this.readUntil('\x04', { timeout: 0, onChunk: (s) => this.hooks.onError(s) });
        await this.readUntil('>', { timeout: 3000 });
      } finally {
        this.running = false;
        await this.exitRaw(true);
      }
    });
  }

  /** 실행 중인 프로그램 정지 */
  async stop() {
    await this.write('\x03');
    await sleep(50);
    await this.write('\x03');
  }

  async softReset() {
    return this._lock(async () => {
      await this.exitRaw();
      await this.write('\x03');
      await sleep(50);
      await this.write('\x04');
    });
  }

  // ---------------- 파일 시스템 ----------------

  async listFiles() {
    const code =
`import os
def _ls():
 for f in os.listdir():
  try:
   s=os.stat(f)
   print(f+"|"+("d" if s[0]&0x4000 else "f")+"|"+str(s[6]))
  except:
   try:
    print(f+"|f|"+str(os.size(f)))
   except:
    print(f+"|f|0")
_ls()
del _ls
`;
    const out = await this.exec(code, 8000);
    return out.split(/\r?\n/).filter(Boolean).map(l => {
      const [name, type, size] = l.split('|');
      return { name, dir: type === 'd', size: +size || 0 };
    }).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
  }

  async readFile(name) {
    const code = `import sys\nwith open(${pyStr(name)},'r') as _f:\n while True:\n  _d=_f.read(256)\n  if not _d: break\n  sys.stdout.write(_d)\n`;
    const out = await this.exec(code, 20000);
    return out.replace(/\r\n/g, '\n');
  }

  /** 파일 쓰기. onProgress(0..1) */
  writeFile(name, text, onProgress) {
    return this._lock(async () => {
      await this.enterRaw();
      try {
        const bytes = enc.encode(text);
        let r = await this._execRaw(`_f=open(${pyStr(name)},'wb')\n_w=_f.write\n`);
        if (r.err) throw new DeviceError(r.err);
        const step = this.board.startsWith('microbit') ? 128 : 512;
        for (let i = 0; i < bytes.length; i += step) {
          r = await this._execRaw(`_w(${pyBytes(bytes.subarray(i, i + step))})\n`);
          if (r.err) throw new DeviceError(r.err);
          onProgress?.(Math.min(1, (i + step) / bytes.length));
        }
        r = await this._execRaw('_f.close()\ndel _f,_w\n');
        if (r.err) throw new DeviceError(r.err);
        onProgress?.(1);
      } finally {
        await this.exitRaw();
      }
    });
  }

  removeFile(name) {
    return this.exec(`import os\nos.remove(${pyStr(name)})\n`);
  }

  async close() {
    try { await this.t.close(); } catch (_) {}
  }
}

export class DeviceError extends Error {
  constructor(trace) {
    const lines = trace.trim().split(/\r?\n/);
    super(lines[lines.length - 1] || trace);
    this.trace = trace;
  }
}

function pyStr(s) {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function pyBytes(bytes) {
  let s = "b'";
  for (const b of bytes) {
    if (b === 0x5c) s += '\\\\';
    else if (b === 0x27) s += "\\'";
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else if (b === 0x0a) s += '\\n';
    else s += '\\x' + b.toString(16).padStart(2, '0');
  }
  return s + "'";
}
