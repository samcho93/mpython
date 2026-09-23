// 브라우저(localStorage)에 파일과 설정 저장
const FILES_KEY = 'mpy.files';
const SETTINGS_KEY = 'mpy.settings';

function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch (_) { return def; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (_) { return false; }
}

export const Files = {
  all() { return load(FILES_KEY, {}); },
  list() {
    return Object.entries(this.all())
      .map(([name, f]) => ({ name, ...f }))
      .sort((a, b) => b.updated - a.updated);
  },
  get(name) { return this.all()[name]; },
  put(name, content, board) {
    const all = this.all();
    all[name] = { content, board: board ?? all[name]?.board ?? null, updated: Date.now() };
    return save(FILES_KEY, all);
  },
  remove(name) { const all = this.all(); delete all[name]; save(FILES_KEY, all); },
  rename(from, to) {
    const all = this.all();
    if (!all[from]) return;
    all[to] = { ...all[from], updated: Date.now() };
    delete all[from];
    save(FILES_KEY, all);
  },
  exists(name) { return name in this.all(); },
};

export const DEFAULT_SETTINGS = {
  theme: 'auto', fontSize: 15, transport: 'auto', anyDevice: false, lint: true, wrap: false, autoTerm: true,
  target: 'main.py', current: null, lastBoard: 'pico',
};

export const Settings = {
  get() { return { ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) }; },
  set(patch) { const s = { ...this.get(), ...patch }; save(SETTINGS_KEY, s); return s; },
};
