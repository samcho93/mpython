import { CodeEditor, addCompletionSource } from './editor.js';
import { Terminal } from './terminal.js';
import { createTransport, SerialTransport, UsbCdcTransport, USB_FILTERS } from './transport.js';
import { Device } from './repl.js';
import { BOARDS, registerBoard, templatesFor } from './boards.js';
import { Files, Settings } from './storage.js';
import plugins from './plugins/index.js';

export const VERSION = '1.2.2';

const $ = (id) => document.getElementById(id);
const isNarrow = () => window.matchMedia('(max-width: 899px)').matches;

const state = {
  settings: Settings.get(),
  device: null,
  fileName: null,
  fileBoard: null,
  dirty: false,
  listeners: {},
};

// ---------------- 공통 UI ----------------
let toastTimer;
function toast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast ' + type; }, type === 'error' ? 4500 : 2500);
}

function progress(text, ratio) {
  const p = $('progress');
  if (text === null) { p.hidden = true; return; }
  p.hidden = false;
  $('progressText').textContent = text;
  $('progressBar').style.width = Math.round((ratio || 0) * 100) + '%';
}

function emit(ev, ...args) { (state.listeners[ev] || []).forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); }

function setView(view) {
  $('workspace').dataset.view = view;
  document.querySelectorAll('#bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'terminal') $('termDot').hidden = true;
  if (view === 'files') refreshLocalFiles();
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  editor.setDark(dark);
}

// ---------------- 에디터 & 터미널 ----------------
const currentBoard = () => state.device?.board || state.fileBoard || state.settings.lastBoard || 'generic';

const editor = new CodeEditor($('editor'), {
  getBoard: currentBoard,
  onChange: () => { setDirty(true); scheduleAutosave(); },
  onSave: () => saveCurrent(true),
  onRun: () => runCode(),
});

const term = new Terminal($('terminal'));
term.write('MPython Web IDE ' + VERSION + '\r\n', 'info');
term.write('[연결] 버튼을 눌러 Pico 또는 micro:bit 를 연결하세요.\r\n', 'info');

function termOut(text, cls) {
  term.write(text, cls);
  if (isNarrow() && $('workspace').dataset.view !== 'terminal' && window.innerWidth < 600) $('termDot').hidden = false;
}

// ---------------- 파일 ----------------
function setDirty(d) {
  state.dirty = d;
  $('dirtyMark').hidden = !d;
}

let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveCurrent(false), 800);
}

function saveCurrent(explicit) {
  clearTimeout(autosaveTimer);
  if (!state.fileName) return;
  const ok = Files.put(state.fileName, editor.value, state.fileBoard);
  if (ok) {
    setDirty(false);
    if (explicit) toast(`'${state.fileName}' 저장됨`);
  } else toast('브라우저 저장 공간이 부족합니다', 'error');
}

function openLocal(name) {
  if (state.fileName && state.dirty) saveCurrent(false);
  const f = Files.get(name);
  if (!f) return;
  state.fileName = name;
  state.fileBoard = f.board;
  editor.value = f.content;
  setDirty(false);
  $('fileName').textContent = name;
  state.settings = Settings.set({ current: name });
  refreshLocalFiles();
  emit('fileopen', name);
}

function uniqueName(base) {
  const m = base.match(/^(.*?)(\.py)?$/);
  const stem = m[1] || 'untitled';
  let name = stem + '.py', i = 2;
  while (Files.exists(name)) name = `${stem}_${i++}.py`;
  return name;
}

function createFile(name, content, board) {
  if (state.fileName && state.dirty) saveCurrent(false);
  Files.put(name, content, board);
  openLocal(name);
}

function normalizeName(n) {
  n = (n || '').trim().replace(/[\\:*?"<>|]/g, '_');
  if (!n) return null;
  if (!/\.\w+$/.test(n)) n += '.py';
  return n;
}

function refreshLocalFiles() {
  const ul = $('localFiles');
  const files = Files.list();
  ul.replaceChildren();
  if (!files.length) { ul.innerHTML = '<li class="empty">파일이 없습니다</li>'; return; }
  for (const f of files) {
    const li = document.createElement('li');
    li.className = 'item' + (f.name === state.fileName ? ' current' : '');
    const board = f.board && BOARDS[f.board] ? BOARDS[f.board].short : '';
    li.innerHTML = `<span class="name"></span><span class="meta"></span><button class="del" title="삭제">🗑</button>`;
    li.querySelector('.name').textContent = f.name;
    li.querySelector('.meta').textContent = board;
    li.onclick = (e) => {
      if (e.target.closest('.del')) {
        if (confirm(`'${f.name}' 을(를) 브라우저에서 삭제할까요?`)) {
          Files.remove(f.name);
          if (f.name === state.fileName) {
            const next = Files.list()[0];
            if (next) openLocal(next.name); else createFile('main.py', '', currentBoard());
          }
          refreshLocalFiles();
        }
        return;
      }
      openLocal(f.name);
      if (isNarrow()) setView('editor');
    };
    ul.appendChild(li);
  }
}

async function refreshDeviceFiles() {
  const ul = $('deviceFiles');
  const dev = state.device;
  if (!dev) { ul.innerHTML = '<li class="empty">장치를 연결하세요</li>'; return; }
  try {
    await ensureIdle();
    ul.innerHTML = '<li class="empty">불러오는 중…</li>';
    const files = await dev.listFiles();
    ul.replaceChildren();
    if (!files.length) { ul.innerHTML = '<li class="empty">파일이 없습니다</li>'; return; }
    for (const f of files) {
      const li = document.createElement('li');
      li.className = f.dir ? '' : 'item';
      li.innerHTML = `<span class="name"></span><span class="meta"></span>${f.dir ? '' : '<button class="del" title="장치에서 삭제">🗑</button>'}`;
      li.querySelector('.name').textContent = (f.dir ? '📁 ' : '') + f.name;
      li.querySelector('.meta').textContent = f.dir ? '' : formatSize(f.size);
      if (!f.dir) li.onclick = (e) => e.target.closest('.del') ? deleteDeviceFile(f.name) : openDeviceFile(f.name);
      ul.appendChild(li);
    }
  } catch (e) {
    ul.innerHTML = '<li class="empty">목록을 읽지 못했습니다</li>';
    toast('장치 파일 목록 오류: ' + e.message, 'error');
  }
}

function formatSize(n) { return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB'; }

async function openDeviceFile(name) {
  try {
    await ensureIdle();
    progress(`'${name}' 읽는 중…`, 0.3);
    const text = await state.device.readFile(name);
    progress(null);
    let target = name;
    const local = Files.get(name);
    if (local && local.content !== text) {
      if (!confirm(`브라우저에 같은 이름의 '${name}' 이 있습니다. 장치 파일로 덮어쓸까요?\n(취소하면 새 이름으로 엽니다)`)) target = uniqueName(name.replace(/\.py$/, '') + '_device');
    }
    createFile(target, text, state.device.board);
    if (isNarrow()) setView('editor');
    toast(`장치의 '${name}' 을(를) 열었습니다`);
  } catch (e) {
    progress(null);
    toast('파일 읽기 실패: ' + e.message, 'error');
  }
}

async function deleteDeviceFile(name) {
  if (!confirm(`장치에서 '${name}' 을(를) 삭제할까요?`)) return;
  try {
    await ensureIdle();
    await state.device.removeFile(name);
    toast(`'${name}' 삭제됨`);
    refreshDeviceFiles();
  } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
}

// ---------------- 장치 연결 ----------------
function setConnectedUI(on) {
  const b = $('btnConnect');
  b.textContent = on ? '해제' : '연결';
  b.classList.toggle('on', on);
  for (const id of ['btnRun', 'btnStop', 'btnUpload', 'btnCtrlC', 'btnCtrlD', 'btnRefreshDevice']) $(id).disabled = !on;
  document.querySelectorAll('[data-needs-device]').forEach(el => { el.disabled = !on; });
  const badge = $('boardBadge');
  if (on && state.device) {
    const bd = BOARDS[state.device.board] || BOARDS.generic;
    badge.textContent = bd.short;
    badge.title = state.device.machine || bd.name;
    badge.style.setProperty('--board-color', bd.color);
    badge.classList.add('on');
  } else {
    const bd = BOARDS[state.settings.lastBoard] || BOARDS.generic;
    badge.textContent = bd.short;
    badge.title = '연결 안 됨 · 눌러서 보드 선택';
    badge.classList.remove('on');
  }
}

// 보드 수동 선택 (같은 펌웨어를 쓰는 보드 구분, 예: 일반 Pico 펌웨어를 올린 RP2040-Zero)
function openBoardDialog() {
  const dev = state.device;
  const cur = dev?.board || state.settings.lastBoard;
  const family = dev ? (BOARDS[dev.board] || BOARDS.generic).family : null;
  $('boardHint').textContent = dev
    ? `인식된 장치: ${dev.machine || dev.platform || '알 수 없음'}. 실제 보드와 다르면 선택하세요. (이 장치에 대해 기억됩니다)`
    : '예제와 자동완성에 사용할 보드를 선택하세요. 장치를 연결하면 자동으로 인식됩니다.';
  const list = $('boardList');
  list.replaceChildren();
  for (const b of Object.values(BOARDS)) {
    if (family && b.family !== family && b.id !== 'generic') continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = (b.id === cur ? '✓ ' : '') + b.name;
    btn.classList.toggle('active', b.id === cur);
    btn.onclick = () => { $('dlgBoard').close(); selectBoard(b.id); };
    list.appendChild(btn);
  }
  $('dlgBoard').showModal();
}

function selectBoard(id) {
  const dev = state.device;
  if (dev) {
    dev.board = id;
    const overrides = { ...state.settings.boardOverrides, [dev.machine || dev.platform]: id };
    state.settings = Settings.set({ boardOverrides: overrides });
    termOut(`\r\n[보드 변경: ${BOARDS[id].name}]\r\n`, 'info');
  }
  state.settings = Settings.set({ lastBoard: id });
  state.fileBoard = id;
  if (state.fileName) Files.put(state.fileName, editor.value, id);
  setConnectedUI(!!dev);
  refreshLocalFiles();
  toast(`${BOARDS[id].name} 선택됨`);
}

// device: 이전에 허용한 USBDevice / SerialPort 를 주면 선택 창 없이 연결
let connecting = false;
async function connect(device = null) {
  if (state.device) return disconnect();
  if (connecting) return;
  connecting = true;
  try { await doConnect(device); } finally { connecting = false; }
}

async function doConnect(device) {
  const t = device
    ? ('productId' in device && 'transferIn' in device ? new UsbCdcTransport() : new SerialTransport())
    : createTransport(state.fallback || state.settings.transport);
  if (!t) {
    toast('이 브라우저는 USB 시리얼을 지원하지 않습니다. Android Chrome 또는 PC Chrome/Edge 를 사용하세요.', 'error');
    return;
  }
  // 연결 과정을 볼 수 있도록 모바일에서는 터미널 화면으로 이동
  if (window.innerWidth < 600) setView('terminal');
  t.log = (msg) => termOut(`  · ${msg}\r\n`, 'info');
  termOut(`\r\n[연결 시도 - ${t instanceof UsbCdcTransport ? 'WebUSB' : 'Web Serial'}]\r\n`, 'info');
  try {
    await t.open({ anyDevice: state.settings.anyDevice, device });
  } catch (e) {
    try { await t.close(); } catch (_) {}
    if (e.name === 'NotFoundError' || /No device selected|cancel/i.test(e.message)) {
      termOut('[장치를 선택하지 않았습니다]\r\n' +
        '  목록에 장치가 없었다면 폰이 보드를 인식하지 못한 것입니다:\r\n' +
        '  - 데이터 전송이 되는 케이블인지 (충전 전용 케이블 X)\r\n' +
        '  - OTG 케이블/젠더 사용, 폰 설정의 "OTG 연결" 켜짐 여부\r\n' +
        '  - 보드에 MicroPython 펌웨어가 설치되어 있는지\r\n' +
        '  - 목록에 없으면 설정 > "모든 USB 장치 표시" 를 켜고 다시 시도\r\n', 'err');
      toast('장치가 선택되지 않았습니다 · 터미널 안내를 확인하세요');
      return;
    }
    termOut(`[연결 실패] ${e.message}\r\n`, 'err');
    // 자동 모드에서는 다음 시도에 다른 연결 방식(WebUSB ↔ Web Serial)을 사용
    const other = t instanceof UsbCdcTransport ? 'serial' : 'usb';
    const otherOk = other === 'serial' ? SerialTransport.supported : UsbCdcTransport.supported;
    // Android 의 Web Serial 은 블루투스 전용이라 USB 에는 쓸 수 없으므로 전환하지 않음
    const android = /Android/i.test(navigator.userAgent);
    if (!device && state.settings.transport === 'auto' && otherOk && !android) {
      state.fallback = other;
      termOut(`  → 다른 연결 방식(${other === 'serial' ? 'Web Serial' : 'WebUSB'})으로 바꿨습니다. [연결] 을 한 번 더 눌러 주세요.\r\n`, 'info');
      toast('연결 실패 · [연결] 을 한 번 더 누르면 다른 방식으로 시도합니다', 'error');
    } else {
      toast('연결 실패: ' + e.message, 'error');
    }
    return;
  }
  if (!device && state.fallback) {
    // 대체 방식이 성공하면 이후에도 그 방식을 사용
    state.settings = Settings.set({ transport: state.fallback });
    termOut(`  · 이후 연결은 ${state.fallback === 'serial' ? 'Web Serial' : 'WebUSB'} 방식을 사용합니다 (설정에서 변경 가능)\r\n`, 'info');
    state.fallback = null;
  }
  const dev = new Device(t, {
    onOutput: (s) => termOut(s),
    onError: (s) => termOut(s, 'err'),
    onDisconnect: () => onLost(),
  });
  state.device = dev;
  termOut(`\r\n[연결됨 - ${t.info.kind}]\r\n`, 'info');
  setConnectedUI(true);
  try {
    const info = await dev.identify();
    const saved = state.settings.boardOverrides?.[info.machine || info.platform];
    if (saved && BOARDS[saved] && BOARDS[saved].family === BOARDS[info.board].family) dev.board = saved;
    const bd = BOARDS[dev.board];
    termOut(`[보드 인식: ${bd.name}${info.machine ? ' · ' + info.machine : ''}]\r\n`, 'info');
    if (bd.family === 'pico' && !saved && dev.board !== 'rp2040-zero') {
      termOut('[RP2040-Zero 등 다른 RP2040 보드라면 상단의 보드 이름을 눌러 변경하세요]\r\n', 'info');
    }
    termOut('>>> ');
    state.settings = Settings.set({ lastBoard: dev.board });
    toast(`${bd.name} 연결됨`);
  } catch (e) {
    termOut(`[보드 정보를 읽지 못했습니다: ${e.message}]\r\n`, 'err');
    if (!dev.lastRx) {
      termOut('  장치로부터 데이터를 전혀 받지 못했습니다.\r\n' +
        '  - 보드를 뽑았다 다시 꽂은 뒤 [연결] 을 다시 눌러 보세요\r\n' +
        '  - 설정 > 연결 방식을 다른 방식(WebUSB ↔ Web Serial)으로 바꿔 보세요\r\n' +
        '  - PC 의 Thonny 에서 >>> 가 나오는지 확인하세요 (펌웨어 확인)\r\n', 'err');
    }
    toast('MicroPython 응답이 없습니다. 터미널 안내를 확인하세요.', 'error');
  }
  setConnectedUI(true);
  emit('connect', dev);
  refreshDeviceFiles();
}

async function disconnect() {
  const dev = state.device;
  state.device = null;
  if (dev) {
    dev.abortWait?.(new Error('연결 해제'));
    await dev.close();
  }
  setConnectedUI(false);
  termOut('\r\n[연결 해제됨]\r\n', 'info');
  refreshDeviceFiles();
  setRunning(false);
  emit('disconnect');
}

function onLost() {
  if (!state.device) return;
  const dev = state.device;
  state.device = null;
  dev.abortWait?.(new Error('장치 연결이 끊어졌습니다'));
  dev.close();
  setConnectedUI(false);
  setRunning(false);
  termOut('\r\n[장치 연결이 끊어졌습니다]\r\n', 'err');
  toast('장치 연결이 끊어졌습니다', 'error');
  refreshDeviceFiles();
  emit('disconnect');
}

function setRunning(r) {
  $('btnRun').disabled = r || !state.device;
  $('btnRun').classList.toggle('running', r);
}

// 실행 중인 프로그램이 있으면 멈추고 대기
async function ensureIdle() {
  const dev = state.device;
  if (!dev) throw new Error('장치가 연결되어 있지 않습니다');
  if (dev.running) {
    await dev.stop();
    await Promise.race([dev.busy, new Promise(r => setTimeout(r, 3000))]);
  }
}

async function runCode() {
  const dev = state.device;
  if (!dev) { toast('먼저 장치를 연결하세요'); return; }
  if (dev.running) { toast('이미 실행 중입니다. 정지 후 다시 실행하세요.'); return; }
  saveCurrent(false);
  if (state.settings.autoTerm && window.innerWidth < 600) setView('terminal');
  termOut(`\r\n[실행: ${state.fileName}]\r\n`, 'info');
  setRunning(true);
  emit('run', editor.value);
  try {
    await dev.run(editor.value);
  } catch (e) {
    if (state.device) termOut(`\r\n[오류] ${e.message}\r\n`, 'err');
  } finally {
    setRunning(false);
  }
}

async function stopCode() {
  if (!state.device) return;
  await state.device.stop();
  termOut('\r\n[정지]\r\n', 'info');
}

async function uploadToDevice(runAfter = true) {
  const dev = state.device;
  if (!dev) { toast('먼저 장치를 연결하세요'); return; }
  const target = runAfter ? (state.settings.target || 'main.py') : normalizeName(prompt('장치에 저장할 파일 이름', state.fileName));
  if (!target) return;
  saveCurrent(false);
  try {
    await ensureIdle();
    progress(`${target} 전송 중…`, 0);
    await dev.writeFile(target, editor.value, (r) => progress(`${target} 전송 중… ${Math.round(r * 100)}%`, r));
    progress(null);
    termOut(`\r\n[장치에 ${target} 저장 완료]\r\n`, 'info');
    if (runAfter && target === 'main.py') {
      if (state.settings.autoTerm && window.innerWidth < 600) setView('terminal');
      toast('다운로드 완료 · 리셋 후 실행합니다');
      await dev.softReset();
    } else toast(`장치에 '${target}' 저장됨`);
    refreshDeviceFiles();
  } catch (e) {
    progress(null);
    toast('다운로드 실패: ' + e.message, 'error');
    termOut(`\r\n[다운로드 실패] ${e.message}\r\n`, 'err');
  }
}

// ---------------- 새로 만들기 ----------------
let newBoard = null;
function openNewDialog() {
  newBoard = currentBoard();
  renderNewDialog();
  $('dlgNew').showModal();
}

function renderNewDialog() {
  const tabs = $('boardTabs');
  tabs.replaceChildren();
  const connected = state.device?.board;
  for (const b of Object.values(BOARDS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b.short;
    if (b.id === connected) btn.insertAdjacentHTML('beforeend', '<span class="conn">● 연결됨</span>');
    btn.classList.toggle('active', b.id === newBoard);
    btn.onclick = () => { newBoard = b.id; renderNewDialog(); };
    tabs.appendChild(btn);
  }
  const bd = BOARDS[newBoard] || BOARDS.generic;
  $('newHint').textContent = connected
    ? `연결된 보드: ${BOARDS[connected].name}. 예제를 선택하면 필요한 라이브러리를 import 한 새 파일이 만들어집니다.`
    : `${bd.name} 용 예제입니다. 장치를 연결하면 보드가 자동으로 선택됩니다.`;
  const ul = $('templateList');
  ul.replaceChildren();
  const blank = { id: 'untitled', title: '빈 파일', desc: '보드 기본 import 만 포함', code: blankCode(bd) };
  for (const tpl of [blank, ...templatesFor(bd.id)]) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<b></b><span></span>';
    btn.querySelector('b').textContent = tpl.title;
    btn.querySelector('span').textContent = tpl.desc || '';
    btn.onclick = () => {
      $('dlgNew').close();
      createFile(uniqueName(tpl.id), tpl.code, bd.id);
      if (isNarrow()) setView('editor');
      toast(`'${tpl.title}' 예제로 새 파일을 만들었습니다`);
    };
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function blankCode(bd) {
  if (bd.family === 'microbit') return 'from microbit import *\n\n\nwhile True:\n    \n    sleep(100)\n';
  if (bd.id === 'rp2040-zero') return 'from machine import Pin\nfrom neopixel import NeoPixel\nimport time\n\nled = NeoPixel(Pin(16), 1)   # 내장 RGB LED\n\n\n';
  if (bd.family === 'pico') return 'from machine import Pin\nimport time\n\n\n';
  return 'import machine\nimport time\n\n\n';
}

// ---------------- 이벤트 연결 ----------------
$('btnConnect').onclick = () => connect();
$('btnRun').onclick = runCode;
$('btnStop').onclick = stopCode;
$('btnUpload').onclick = () => uploadToDevice(true);
$('btnSave').onclick = () => saveCurrent(true);
$('btnNew').onclick = openNewDialog;
$('btnMenu').onclick = () => $('dlgMenu').showModal();
$('btnRefreshDevice').onclick = refreshDeviceFiles;
$('btnClear').onclick = () => term.clear();
$('btnCtrlC').onclick = () => state.device?.write('\x03');
$('btnCtrlD').onclick = () => state.device?.softReset();
$('fileTitle').onclick = renameCurrent;
$('boardBadge').onclick = openBoardDialog;

document.querySelectorAll('#bottomnav button').forEach(b => { b.onclick = () => setView(b.dataset.view); });

// 모바일 키 보조 바: 포커스를 잃지 않도록 pointerdown 기본 동작 막기
$('keybar').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
$('keybar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.ins) editor.insert(b.dataset.ins);
  else editor.command(b.dataset.cmd);
});

function renameCurrent() {
  const n = normalizeName(prompt('새 파일 이름', state.fileName));
  if (!n || n === state.fileName) return;
  if (Files.exists(n) && !confirm(`'${n}' 이(가) 이미 있습니다. 덮어쓸까요?`)) return;
  saveCurrent(false);
  Files.rename(state.fileName, n);
  openLocal(n);
}

$('mRename').onclick = () => { $('dlgMenu').close(); renameCurrent(); };
$('mSaveAs').onclick = () => {
  $('dlgMenu').close();
  const n = normalizeName(prompt('다른 이름으로 저장', uniqueName(state.fileName.replace(/\.py$/, '') + '_copy')));
  if (!n) return;
  createFile(n, editor.value, state.fileBoard);
  toast(`'${n}' 저장됨`);
};
$('mExport').onclick = () => {
  $('dlgMenu').close();
  const blob = new Blob([editor.value], { type: 'text/x-python' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = state.fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('mDeviceSave').onclick = () => { $('dlgMenu').close(); uploadToDevice(false); };
$('mDiag').onclick = () => { $('dlgMenu').close(); diagnose(); };
$('mSettings').onclick = () => { $('dlgMenu').close(); openSettings(); };
$('mHelp').onclick = () => { $('dlgMenu').close(); $('dlgHelp').showModal(); };

$('btnImport').onclick = () => $('importInput').click();
$('importInput').onchange = async (e) => {
  let last;
  for (const f of e.target.files) {
    const name = Files.exists(f.name) ? uniqueName(f.name) : normalizeName(f.name);
    Files.put(name, await f.text(), currentBoard());
    last = name;
  }
  e.target.value = '';
  if (last) { openLocal(last); toast('파일을 가져왔습니다'); }
};

// 대화상자 바깥(배경) 클릭 시 닫기
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

// 설정
function openSettings() {
  const s = state.settings;
  $('setTheme').value = s.theme;
  $('setFont').value = s.fontSize;
  $('setFontOut').textContent = s.fontSize + 'px';
  $('setTransport').value = s.transport;
  $('setAnyDevice').checked = s.anyDevice;
  $('setLint').checked = s.lint;
  $('setWrap').checked = s.wrap;
  $('setAutoTerm').checked = s.autoTerm;
  $('setTarget').value = s.target;
  $('setTransport').querySelector('[value="serial"]').disabled = !SerialTransport.supported;
  $('setTransport').querySelector('[value="usb"]').disabled = !UsbCdcTransport.supported;
  $('dlgSettings').showModal();
}
$('setTheme').onchange = (e) => { state.settings = Settings.set({ theme: e.target.value }); applyTheme(); };
$('setFont').oninput = (e) => {
  const v = +e.target.value;
  $('setFontOut').textContent = v + 'px';
  state.settings = Settings.set({ fontSize: v });
  editor.setFontSize(v);
};
$('setTransport').onchange = (e) => { state.settings = Settings.set({ transport: e.target.value }); };
$('setAnyDevice').onchange = (e) => { state.settings = Settings.set({ anyDevice: e.target.checked }); };
$('setLint').onchange = (e) => { state.settings = Settings.set({ lint: e.target.checked }); editor.setLint(e.target.checked); };
$('setWrap').onchange = (e) => { state.settings = Settings.set({ wrap: e.target.checked }); editor.setWrap(e.target.checked); };
$('setAutoTerm').onchange = (e) => { state.settings = Settings.set({ autoTerm: e.target.checked }); };
$('setTarget').onchange = (e) => { state.settings = Settings.set({ target: normalizeName(e.target.value) || 'main.py' }); };

// 터미널 입력
const history = [];
let histIdx = 0;
$('termForm').onsubmit = (e) => {
  e.preventDefault();
  const input = $('termInput');
  const v = input.value;
  if (!state.device) { toast('먼저 장치를 연결하세요'); return; }
  state.device.write(v + '\r');
  if (v.trim() && history[history.length - 1] !== v) history.push(v);
  histIdx = history.length;
  input.value = '';
};
function histMove(d) {
  if (!history.length) return;
  histIdx = Math.max(0, Math.min(history.length, histIdx + d));
  $('termInput').value = history[histIdx] ?? '';
}
$('btnHistUp').onclick = () => histMove(-1);
$('termInput').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') { e.preventDefault(); histMove(-1); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); histMove(1); }
  else if (e.key === 'c' && e.ctrlKey && !$('termInput').value) { e.preventDefault(); state.device?.write('\x03'); }
});

// PC: 터미널 영역을 클릭하고 직접 타이핑
$('terminal').addEventListener('keydown', (e) => {
  const dev = state.device;
  if (!dev) return;
  const map = { Enter: '\r', Backspace: '\x7f', Tab: '\t', ArrowUp: '\x1b[A', ArrowDown: '\x1b[B', ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D', Delete: '\x1b[3~', Home: '\x1b[H', End: '\x1b[F', Escape: '\x1b' };
  let s = null;
  if (e.ctrlKey && e.key.length === 1 && /[a-z]/i.test(e.key)) {
    if (e.key.toLowerCase() === 'v') return; // 붙여넣기는 paste 이벤트로
    if (e.key.toLowerCase() === 'c' && getSelection().toString()) return; // 복사 허용
    s = String.fromCharCode(e.key.toUpperCase().charCodeAt(0) - 64);
  } else if (map[e.key]) s = map[e.key];
  else if (e.key.length === 1 && !e.metaKey && !e.altKey) s = e.key;
  if (s) { e.preventDefault(); dev.write(s); }
});
$('terminal').addEventListener('paste', (e) => {
  const text = e.clipboardData.getData('text');
  if (text && state.device) { e.preventDefault(); state.device.write(text.replace(/\r?\n/g, '\r')); }
});

window.addEventListener('beforeunload', () => saveCurrent(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) saveCurrent(false); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------------- 플러그인 API ----------------
// 추후 기능은 js/plugins/ 에 모듈을 추가하고 plugins/index.js 에 등록하세요.
const api = {
  version: VERSION,
  editor, terminal: term, BOARDS, toast, progress, setView,
  get device() { return state.device; },
  get fileName() { return state.fileName; },
  get board() { return currentBoard(); },
  on(ev, fn) { (state.listeners[ev] ||= []).push(fn); },
  registerBoard,
  addTemplate(boardId, tpl) { (BOARDS[boardId] || BOARDS.generic).templates.push(tpl); },
  addCompletionSource,
  addAction({ label, icon = '', title = '', needsDevice = false, onClick }) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.title = title || label;
    b.innerHTML = `<span class="ic"></span><span class="lbl"></span>`;
    b.querySelector('.ic').textContent = icon;
    b.querySelector('.lbl').textContent = label;
    if (needsDevice) { b.dataset.needsDevice = ''; b.disabled = !state.device; }
    b.onclick = () => onClick(api);
    $('pluginActions').appendChild(b);
    return b;
  },
  addMenuItem({ label, onClick }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => { $('dlgMenu').close(); onClick(api); };
    $('pluginMenu').appendChild(b);
    return b;
  },
  newFile(name, content, board) { createFile(uniqueName(name), content, board ?? currentBoard()); },
  run: runCode, stop: stopCode, upload: uploadToDevice, connect: () => connect(),
  exec: async (code) => { await ensureIdle(); return state.device.exec(code); },
};
window.MPY = api;

// ---------------- 연결 진단 ----------------
async function diagnose() {
  setView('terminal');
  const L = (m, cls = 'info') => termOut(m + '\r\n', cls);
  const ua = navigator.userAgent;
  L('\r\n[USB 연결 진단]');
  L('  브라우저: ' + (ua.match(/(SamsungBrowser|Whale|NAVER|KAKAOTALK|Edg|Chrome|Firefox|Safari)\/[\d.]+/i)?.[0] || ua));
  L('  보안 연결(HTTPS): ' + (window.isSecureContext ? '예' : '아니오 → USB 사용 불가'), window.isSecureContext ? 'info' : 'err');
  L('  WebUSB: ' + (UsbCdcTransport.supported ? '지원' : '미지원'), UsbCdcTransport.supported ? 'info' : 'err');
  L('  Web Serial: ' + (SerialTransport.supported ? '지원' : '미지원'));
  if (/KAKAOTALK|NAVER|Line\/|Instagram|FBAN|SamsungBrowser|Whale/i.test(ua)) {
    L('  → 이 브라우저(앱 내부 브라우저 포함)는 USB 를 지원하지 않을 수 있습니다. Chrome 으로 여세요.', 'err');
  }
  if (/iPhone|iPad/i.test(ua)) L('  → iPhone/iPad 은 USB 연결을 지원하지 않습니다.', 'err');
  const t = createTransport(state.settings.transport);
  L('  사용할 연결 방식: ' + (t ? (t instanceof UsbCdcTransport ? 'WebUSB' : 'Web Serial') : '없음'));
  const id = (v, p) => (v ?? 0).toString(16).padStart(4, '0') + ':' + (p ?? 0).toString(16).padStart(4, '0');
  try {
    if (UsbCdcTransport.supported) {
      const ds = await navigator.usb.getDevices();
      L('  허용된 USB 장치: ' + (ds.length ? ds.map(d => `${d.productName || '?'} (${id(d.vendorId, d.productId)})`).join(', ') : '없음'));
    }
    if (SerialTransport.supported) {
      const ps = await navigator.serial.getPorts();
      L('  허용된 시리얼 포트: ' + (ps.length ? ps.map(p => { const i = p.getInfo(); return id(i.usbVendorId, i.usbProductId); }).join(', ') : '없음'));
    }
  } catch (e) { L('  장치 목록 오류: ' + e.message, 'err'); }
  L('  연결 상태: ' + (state.device ? '연결됨 (' + (BOARDS[state.device.board]?.name || '') + ')' : '연결 안 됨'));
  L('  (Pico 정상: 2e8a:0005 / BOOTSEL 모드: 2e8a:0003 / micro:bit: 0d28:0204)');
}

// ---------------- 자동 연결 ----------------
// 한 번 허용한 장치는 꽂기만 하면(또는 앱을 열면) 선택 창 없이 자동으로 연결합니다.
function isKnownUsb(vid, pid) {
  return USB_FILTERS.some(f => f.vid === vid) && !(vid === 0x2E8A && pid === 0x0003); // BOOTSEL 모드 제외
}

function setupAutoConnect() {
  const tryAuto = (device, label) => {
    if (state.device || connecting) return;
    toast(label + ' · 자동 연결합니다');
    connect(device);
  };
  if (UsbCdcTransport.supported) {
    navigator.usb.addEventListener('connect', (e) => {
      if (isKnownUsb(e.device.vendorId, e.device.productId)) tryAuto(e.device, 'USB 장치 감지');
    });
  }
  if (SerialTransport.supported) {
    navigator.serial.addEventListener('connect', (e) => {
      const i = e.target.getInfo();
      if (isKnownUsb(i.usbVendorId, i.usbProductId)) tryAuto(e.target, '시리얼 장치 감지');
    });
  }
  // 앱 시작 시 이미 꽂혀 있는 허용된 장치
  setTimeout(async () => {
    try {
      const preferUsb = createTransport(state.settings.transport) instanceof UsbCdcTransport;
      const list = preferUsb
        ? (await navigator.usb.getDevices()).filter(d => isKnownUsb(d.vendorId, d.productId))
        : (await navigator.serial.getPorts()).filter(p => { const i = p.getInfo(); return isKnownUsb(i.usbVendorId, i.usbProductId); });
      if (list.length === 1) tryAuto(list[0], '허용된 장치 발견');
    } catch (_) {}
  }, 500);
}

// ---------------- 시작 ----------------
function start() {
  $('appVersion').textContent = 'v' + VERSION;
  editor.setFontSize(state.settings.fontSize);
  editor.setLint(state.settings.lint);
  editor.setWrap(state.settings.wrap);
  applyTheme();

  const cur = state.settings.current;
  if (cur && Files.exists(cur)) openLocal(cur);
  else {
    const first = Files.list()[0];
    if (first) openLocal(first.name);
    else {
      const board = state.settings.lastBoard || 'pico';
      createFile('main.py', templatesFor(board)[0].code, board);
    }
  }
  refreshLocalFiles();
  setConnectedUI(false);

  for (const p of plugins) {
    try { p.setup(api); } catch (e) { console.error('플러그인 오류', p.id, e); }
  }

  if (!SerialTransport.supported && !UsbCdcTransport.supported) {
    termOut('\r\n[알림] 이 브라우저는 USB 연결을 지원하지 않습니다. 편집만 가능합니다.\r\n(Android Chrome 또는 PC Chrome/Edge 권장)\r\n', 'err');
  }

  setupAutoConnect();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
