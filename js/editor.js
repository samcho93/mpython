// 파이썬 코드 에디터 (CodeMirror 6)
import {
  basicSetup, EditorView, EditorState, Compartment, keymap, indentWithTab, undo, redo, toggleComment,
  indentMore, indentLess, python, pythonLanguage, oneDark, autocompletion, indentUnit, openSearchPanel,
  linter, lintGutter,
} from '../vendor/codemirror.js';
import { BOARDS } from './boards.js';

const MICROPY_EXTRA = ['const', 'micropython'];
const extraCompletionSources = [];

export function addCompletionSource(fn) { extraCompletionSources.push(fn); }

// 코드에서 "변수 = 클래스(" 형태를 찾아 변수 타입을 추정
function inferTypes(text, api) {
  const types = {};
  const re = /^\s*(\w+)\s*=\s*(?:[\w.]*\.)?(\w+)\s*\(/gm;
  let m;
  while ((m = re.exec(text))) {
    if (api.classes?.[m[2]]) types[m[1]] = m[2];
  }
  // microbit: 이미지 변수
  return types;
}

function boardCompletions(getBoard) {
  return (ctx) => {
    const word = ctx.matchBefore(/[\w.]*$/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    const board = BOARDS[getBoard()] || BOARDS.generic;
    const api = board.api;
    const text = word.text;
    const line = ctx.state.doc.lineAt(ctx.pos).text;

    // import 문: 모듈 이름 제안
    if (/^\s*(import|from)\s+\w*$/.test(line.slice(0, ctx.pos - ctx.state.doc.lineAt(ctx.pos).from))) {
      return { from: word.from, options: api.modules.map(m => ({ label: m, type: 'namespace', boost: 5 })) };
    }

    const dot = text.lastIndexOf('.');
    if (dot >= 0) {
      const obj = text.slice(0, dot).split('.').pop();
      let list = api.members?.[obj] || api.classes?.[obj];
      if (!list) {
        const t = inferTypes(ctx.state.doc.toString(), api)[obj];
        if (t) list = api.classes[t];
      }
      if (!list) return null;
      return {
        from: word.from + dot + 1,
        options: list.map(n => ({
          label: n,
          type: /^[A-Z_0-9]+$/.test(n) ? 'constant' : /^[A-Z]/.test(n) ? 'class' : 'method',
          detail: obj,
          boost: 10,
        })),
        validFor: /^\w*$/,
      };
    }

    const opts = [];
    for (const m of api.modules) opts.push({ label: m, type: 'namespace' });
    for (const g of api.globals || []) opts.push({ label: g, type: 'variable', detail: board.short, boost: 3 });
    for (const [mod, names] of Object.entries(api.members || {})) {
      if (/^pin\d+$/.test(mod)) continue;
      for (const n of names) if (/^[A-Z]/.test(n) && !/^[A-Z_0-9]+$/.test(n)) opts.push({ label: n, type: 'class', detail: mod });
    }
    for (const x of MICROPY_EXTRA) opts.push({ label: x, type: 'function' });
    return { from: word.from, options: opts, validFor: /^\w*$/ };
  };
}

// 가벼운 정적 검사: 들여쓰기 탭/공백 혼용, 괄호 짝, 콜론 누락
function simpleLint(view) {
  const diags = [];
  const doc = view.state.doc;
  let usesTab = false, usesSpace = false;
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  let triple = null; // 여러 줄 문자열(""" / ''') 내부는 검사하지 않음
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const tq = line.text.match(/"""|'''/g) || [];
    if (triple) {
      if (tq.filter(q => q === triple).length % 2 === 1) triple = null;
      continue;
    }
    if (tq.length % 2 === 1) { triple = tq[tq.length - 1]; continue; }
    if (tq.length) continue;
    const indent = line.text.match(/^[ \t]*/)[0];
    if (indent.includes('\t')) usesTab = true;
    if (indent.includes(' ')) usesSpace = true;
    if (usesTab && usesSpace && indent) {
      diags.push({ from: line.from, to: line.from + indent.length, severity: 'warning', message: '탭과 공백 들여쓰기가 섞여 있습니다' });
    }
    const code = line.text.replace(/#.*$/, '');
    if (/^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b[^:]*$/.test(code) && !/[\\(\[{,]\s*$/.test(code) && stack.length === 0) {
      diags.push({ from: line.from, to: line.to, severity: 'error', message: "줄 끝에 ':' 가 필요합니다" });
    }
    // 문자열 내부는 대충 건너뜀
    let inStr = null;
    for (let j = 0; j < code.length; j++) {
      const c = code[j];
      if (inStr) { if (c === '\\') j++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if ('([{'.includes(c)) stack.push({ c, pos: line.from + j });
      else if (')]}'.includes(c)) {
        const top = stack.pop();
        if (!top || top.c !== pairs[c]) diags.push({ from: line.from + j, to: line.from + j + 1, severity: 'error', message: `짝이 맞지 않는 '${c}'` });
      }
    }
  }
  for (const s of stack) diags.push({ from: s.pos, to: s.pos + 1, severity: 'error', message: `닫히지 않은 '${s.c}'` });
  return diags;
}

export class CodeEditor {
  constructor(parent, { getBoard, onChange, onSave, onRun }) {
    this.theme = new Compartment();
    this.fontSize = new Compartment();
    this.lintComp = new Compartment();
    this.wrapComp = new Compartment();
    this.getBoard = getBoard;
    const keys = keymap.of([
      indentWithTab,
      { key: 'Mod-s', preventDefault: true, run: () => { onSave?.(); return true; } },
      { key: 'Mod-Enter', preventDefault: true, run: () => { onRun?.(); return true; } },
      { key: 'F5', preventDefault: true, run: () => { onRun?.(); return true; } },
    ]);
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: '',
        extensions: [
          basicSetup,
          keys,
          python(),
          indentUnit.of('    '),
          EditorState.tabSize.of(4),
          pythonLanguage.data.of({ autocomplete: boardCompletions(() => this.getBoard()) }),
          pythonLanguage.data.of({ autocomplete: (ctx) => {
            for (const src of extraCompletionSources) { const r = src(ctx, this.getBoard()); if (r) return r; }
            return null;
          } }),
          autocompletion({ activateOnTyping: true, maxRenderedOptions: 60 }),
          this.lintComp.of([lintGutter(), linter(simpleLint, { delay: 600 })]),
          this.theme.of([]),
          this.fontSize.of(EditorView.theme({ '&': { fontSize: '15px' } })),
          this.wrapComp.of([]),
          EditorView.updateListener.of(u => { if (u.docChanged) onChange?.(); }),
          EditorView.contentAttributes.of({ autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
        ],
      }),
    });
  }

  get value() { return this.view.state.doc.toString(); }
  set value(text) {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, selection: { anchor: 0 } });
    this.view.scrollDOM.scrollTop = 0;
  }

  setDark(dark) { this.view.dispatch({ effects: this.theme.reconfigure(dark ? oneDark : []) }); }
  setFontSize(px) { this.view.dispatch({ effects: this.fontSize.reconfigure(EditorView.theme({ '&': { fontSize: px + 'px' } })) }); }
  setWrap(on) { this.view.dispatch({ effects: this.wrapComp.reconfigure(on ? EditorView.lineWrapping : []) }); }
  setLint(on) { this.view.dispatch({ effects: this.lintComp.reconfigure(on ? [lintGutter(), linter(simpleLint, { delay: 600 })] : []) }); }

  insert(text) {
    const v = this.view;
    const { from, to } = v.state.selection.main;
    // 괄호류는 쌍으로 넣고 커서를 가운데로
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (pairs[text] && from === to) {
      v.dispatch({ changes: { from, to, insert: text + pairs[text] }, selection: { anchor: from + 1 } });
    } else {
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    }
    v.focus();
  }

  command(name) {
    const v = this.view;
    const cmds = {
      undo, redo, toggleComment, indentMore, indentLess,
      search: openSearchPanel,
      left: () => { const p = v.state.selection.main.head; v.dispatch({ selection: { anchor: Math.max(0, p - 1) } }); return true; },
      right: () => { const p = v.state.selection.main.head; v.dispatch({ selection: { anchor: Math.min(v.state.doc.length, p + 1) } }); return true; },
    };
    cmds[name]?.(v);
    v.focus();
  }

  focus() { this.view.focus(); }
}
