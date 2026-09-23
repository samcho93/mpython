// 가벼운 터미널 에뮬레이터 (MicroPython REPL 이 사용하는 제어 문자만 처리)
//  \r \n \b, ESC[K (줄 끝까지 지우기), ESC[nD / ESC[nC (커서 이동)

const MAX_LINES = 3000;

export class Terminal {
  constructor(el) {
    this.el = el;
    this.lines = [[]];     // 각 줄은 {ch, cls} 배열
    this.row = 0;
    this.col = 0;
    this.esc = '';
    this.cls = '';
    this.pending = false;
    this.dirty = new Set([0]);
    this.trimmed = 0;
  }

  write(text, cls = '') {
    this.cls = cls;
    this.dirty.add(this.row);
    for (const ch of text) this._put(ch);
    this.dirty.add(this.row);
    this._schedule();
  }

  _put(ch) {
    if (this.esc) {
      this.esc += ch;
      if (/[A-Za-z~]/.test(ch) && this.esc.length > 1 && ch !== '[') { this._escape(this.esc); this.esc = ''; }
      else if (this.esc.length > 12) this.esc = '';
      return;
    }
    switch (ch) {
      case '\x1b': this.esc = ch; return;
      case '\r': this.col = 0; return;
      case '\n':
        this.row++; this.col = 0;
        if (!this.lines[this.row]) this.lines[this.row] = [];
        this.dirty.add(this.row);
        if (this.lines.length > MAX_LINES) {
          const cut = 500;
          this.lines.splice(0, cut); this.row -= cut; this.trimmed += cut;
          if (this.lastCursorRow !== undefined) this.lastCursorRow -= cut;
          this.dirty = new Set([...this.dirty].map(r => r - cut).filter(r => r >= 0));
        }
        return;
      case '\b': if (this.col > 0) this.col--; return;
      case '\t': do { this._cell(' '); } while (this.col % 8); return;
    }
    if (ch < ' ') return;
    this._cell(ch);
  }

  _cell(ch) {
    const line = this.lines[this.row];
    while (line.length < this.col) line.push({ ch: ' ', cls: '' });
    line[this.col] = { ch, cls: this.cls };
    this.col++;
  }

  _escape(seq) {
    const m = seq.match(/^\x1b\[(\d*)([A-Za-z])$/);
    if (!m) return;
    const n = m[1] === '' ? 1 : +m[1];
    const line = this.lines[this.row];
    switch (m[2]) {
      case 'K': line.length = Math.min(line.length, this.col); break;
      case 'D': this.col = Math.max(0, this.col - n); break;
      case 'C': this.col += n; break;
    }
  }

  _schedule() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.render(); });
  }

  _lineEl(r) {
    const line = this.lines[r];
    const div = document.createElement('div');
    div.className = 'tl';
    let span = null, cur = null;
    const end = Math.max(line.length, r === this.row ? this.col + 1 : 0);
    for (let c = 0; c < end; c++) {
      const cell = line[c] || { ch: ' ', cls: '' };
      const isCursor = r === this.row && c === this.col;
      const cls = isCursor ? 'cursor' : cell.cls;
      if (!span || cls !== cur || isCursor) {
        span = document.createElement('span');
        if (cls) span.className = cls;
        div.appendChild(span);
        cur = isCursor ? '\0' : cls;
      }
      span.textContent += cell.ch;
    }
    if (!div.firstChild) div.textContent = '​';
    return div;
  }

  render() {
    const el = this.el;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (this.trimmed) {
      for (let i = 0; i < this.trimmed && el.firstChild; i++) el.firstChild.remove();
      this.trimmed = 0;
    }
    // 커서가 이전에 있던 줄도 다시 그림
    if (this.lastCursorRow !== undefined && this.lastCursorRow < this.lines.length) this.dirty.add(this.lastCursorRow);
    this.dirty.add(this.row);
    while (el.children.length > this.lines.length) el.lastChild.remove();
    for (let r = el.children.length; r < this.lines.length; r++) el.appendChild(this._lineEl(r));
    for (const r of this.dirty) {
      if (r >= 0 && r < el.children.length) el.children[r].replaceWith(this._lineEl(r));
    }
    this.dirty.clear();
    this.lastCursorRow = this.row;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }

  clear() {
    this.lines = [[]]; this.row = 0; this.col = 0;
    this.el.replaceChildren();
    this.dirty = new Set([0]);
    this.render();
  }

  text() {
    return this.lines.map(l => l.map(c => c.ch).join('')).join('\n');
  }
}
