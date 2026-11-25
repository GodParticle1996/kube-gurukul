/* =====================================================================
   KubeGurukul — chhota Go text/template + Sprig (Helm jaisa)  →  KG.gotpl
   Helm templating labs ke liye: learner template khud badalta hai, aur
   render / lint / upgrade ka jawab ASLI Helm jaisa aata hai.

   KG.gotpl.renderChart({ 'notify/templates/x.yaml': text, ... }, ctx)
     → { files: { path: renderedText } }  ya  { err: 'Helm jaisa error' }
   ctx = { Values, Release: { Name, Namespace, Revision, IsUpgrade, IsInstall, Service },
           Chart: { Name, Version, AppVersion }, Capabilities: {...} }

   Kya chalta hai: {{ }}, {{- -}} (whitespace chomp), template comments,
   .a.b  $  $.a  $x := …  range ($i, $v :=) / if / else if / else / with / define / include / template,
   pipelines (|), ( ) sub-pipelines, aur Sprig ke aam functions (neeche FUNCS).
   Map ki missing key = khaali (Helm "missingkey=zero" + "<no value>" hatata hai);
   nil par field = "nil pointer evaluating interface {}.x" — asli Helm wala error.
   Error formats Helm 4 (v4.3.2) jaise — execution errors teen line mein:
     notify/templates/x.yaml:12:28
       executing "notify/templates/x.yaml" at <.Values.image.tag>:
         nil pointer evaluating interface {}.image
   Column 0 se; chain (.Values.a.b) ki jagah doosre hisse ki; galat type = command ka aakhri likha argument.
   ===================================================================== */
KG.gotpl = (function () {
  const err = (msg, kind) => { const e = new Error(msg); e.tpl = kind || 'exec'; return e; };
  const lineOf = (src, p) => src.slice(0, p).split('\n').length;
  const colOf = (src, p) => p - (src.lastIndexOf('\n', p - 1) + 1);

  /* ---------- Go jaisa print / type naam ---------- */
  function goType(v) {
    if (v === null || v === undefined) return '<nil>';
    if (Array.isArray(v)) return '[]interface {}';
    if (typeof v === 'object') return 'map[string]interface {}';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float64';
    return typeof v === 'boolean' ? 'bool' : 'string';
  }
  function goPrint(v) {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return '[' + v.map(goPrintIn).join(' ') + ']';
    if (typeof v === 'object') return 'map[' + Object.keys(v).sort().map(k => k + ':' + goPrintIn(v[k])).join(' ') + ']';
    return String(v);
  }
  const goPrintIn = v => (v === null || v === undefined ? '<nil>' : goPrint(v));
  const empty = v => v === null || v === undefined || v === '' || v === 0 || v === false ||
    (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

  /* ---------- toYaml: sigs.k8s.io/yaml jaisa (keys A→Z, list "- " parent ke barabar) ---------- */
  function yscalar(x) {
    if (x === null || x === undefined) return 'null';
    if (typeof x !== 'string') return String(x);
    if (x === '' || /^(true|false|yes|no|on|off|y|n|null|~)$/i.test(x) || /^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(x) ||
      /^[\s&*!|>'"%@`{}[\],#?:-]|: |\s#|\s$|\n/.test(x)) return JSON.stringify(x);
    return x;
  }
  function toYaml(v, ind) {
    ind = ind || '';
    if (Array.isArray(v)) {
      if (!v.length) return ind + '[]';
      return v.map(x => {
        if (x && typeof x === 'object' && (Array.isArray(x) ? x.length : Object.keys(x).length)) return ind + '- ' + toYaml(x, ind + '  ').replace(/^\s+/, '');
        return ind + '- ' + (x && typeof x === 'object' ? (Array.isArray(x) ? '[]' : '{}') : yscalar(x));
      }).join('\n');
    }
    if (v && typeof v === 'object') {
      const ks = Object.keys(v).sort();
      if (!ks.length) return ind + '{}';
      return ks.map(k => {
        const x = v[k];
        if (x && typeof x === 'object' && (Array.isArray(x) ? x.length : Object.keys(x).length)) return ind + k + ':\n' + toYaml(x, Array.isArray(x) ? ind : ind + '  ');
        return ind + k + ': ' + (x && typeof x === 'object' ? (Array.isArray(x) ? '[]' : '{}') : yscalar(x));
      }).join('\n');
    }
    return ind + yscalar(v);
  }
  const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = sortKeys(v[k]), o), {}) : v;

  /* ---------- Sprig / builtin functions ---------- */
  const need = (name, args, n) => { if (args.length !== n) throw err(`wrong number of args for ${name}: want ${n} got ${args.length}`, 'call'); };
  const str = (name, v) => {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v === null || v === undefined) return '';
    throw err(`wrong type for value; expected string; got ${goType(v)}`, 'call');
  };
  const int = (name, v) => {
    if (typeof v === 'number') return Math.trunc(v);
    if (typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v);
    throw err(`wrong type for value; expected int; got ${goType(v)}`, 'call');
  };
  function printf(f, args) {
    let i = 0;
    return String(f).replace(/%([-+ 0#]*\d*(?:\.\d+)?)([svdqtf%])/g, (m, fl, c) => {
      if (c === '%') return '%';
      const a = args[i++];
      if (a === undefined && i > args.length) return `%!${c}(MISSING)`;
      if (c === 'q') return JSON.stringify(goPrint(a));
      if (c === 'd') return typeof a === 'number' ? String(Math.trunc(a)) : `%!d(${goType(a)}=${goPrint(a)})`;
      if (c === 'f') return typeof a === 'number' ? a.toFixed(fl.includes('.') ? Number(fl.split('.')[1]) : 6) : `%!f(${goType(a)}=${goPrint(a)})`;
      return goPrintIn(a);
    });
  }
  const cmp = (name, a, b) => {
    if (a !== null && a !== undefined && b !== null && b !== undefined && typeof a !== typeof b) throw err('incompatible types for comparison', 'call');
    return a;
  };
  const FUNCS = {
    toYaml: a => { need('toYaml', a, 1); return a[0] === undefined ? 'null' : toYaml(a[0]); },
    toJson: a => { need('toJson', a, 1); return JSON.stringify(sortKeys(a[0] === undefined ? null : a[0])); },
    indent: a => { need('indent', a, 2); const n = int('indent', a[0]), s = str('indent', a[1]), p = ' '.repeat(n); return p + s.replace(/\n/g, '\n' + p); },
    nindent: a => { need('nindent', a, 2); const n = int('nindent', a[0]), s = str('nindent', a[1]), p = ' '.repeat(n); return '\n' + p + s.replace(/\n/g, '\n' + p); },
    quote: a => a.filter(x => x !== null && x !== undefined).map(x => JSON.stringify(goPrint(x))).join(' '),
    squote: a => a.filter(x => x !== null && x !== undefined).map(x => "'" + goPrint(x) + "'").join(' '),
    default: a => (a.length < 2 || empty(a[a.length - 1]) ? a[0] : a[a.length - 1]),
    required: a => { need('required', a, 2); if (a[1] === null || a[1] === undefined || a[1] === '') throw err(str('required', a[0]), 'required'); return a[1]; },
    fail: a => { need('fail', a, 1); throw err(str('fail', a[0]), 'required'); },
    upper: a => { need('upper', a, 1); return str('upper', a[0]).toUpperCase(); },
    lower: a => { need('lower', a, 1); return str('lower', a[0]).toLowerCase(); },
    title: a => { need('title', a, 1); return str('title', a[0]).replace(/\b[a-z]/g, c => c.toUpperCase()); },
    trim: a => { need('trim', a, 1); return str('trim', a[0]).trim(); },
    trimSuffix: a => { need('trimSuffix', a, 2); const s = str('trimSuffix', a[1]), x = str('trimSuffix', a[0]); return x && s.endsWith(x) ? s.slice(0, -x.length) : s; },
    trimPrefix: a => { need('trimPrefix', a, 2); const s = str('trimPrefix', a[1]), x = str('trimPrefix', a[0]); return x && s.startsWith(x) ? s.slice(x.length) : s; },
    trunc: a => { need('trunc', a, 2); const n = int('trunc', a[0]), s = str('trunc', a[1]); return n >= 0 ? s.slice(0, n) : s.slice(n); },
    replace: a => { need('replace', a, 3); return str('replace', a[2]).split(str('replace', a[0])).join(str('replace', a[1])); },
    contains: a => { need('contains', a, 2); return str('contains', a[1]).includes(str('contains', a[0])); },
    hasPrefix: a => { need('hasPrefix', a, 2); return str('hasPrefix', a[1]).startsWith(str('hasPrefix', a[0])); },
    hasSuffix: a => { need('hasSuffix', a, 2); return str('hasSuffix', a[1]).endsWith(str('hasSuffix', a[0])); },
    repeat: a => { need('repeat', a, 2); return str('repeat', a[1]).repeat(int('repeat', a[0])); },
    printf: a => { if (!a.length) throw err('wrong number of args for printf: want at least 1 got 0', 'call'); return printf(str('printf', a[0]), a.slice(1)); },
    print: a => a.map(goPrint).join(''),
    toString: a => { need('toString', a, 1); return goPrint(a[0]); },
    int: a => { need('int', a, 1); return typeof a[0] === 'string' ? (parseInt(a[0], 10) || 0) : Math.trunc(Number(a[0]) || 0); },
    add: a => a.reduce((x, y) => x + int('add', y), 0),
    sub: a => { need('sub', a, 2); return int('sub', a[0]) - int('sub', a[1]); },
    mul: a => a.reduce((x, y) => x * int('mul', y), 1),
    div: a => { need('div', a, 2); return Math.trunc(int('div', a[0]) / int('div', a[1])); },
    len: a => { need('len', a, 1); const v = a[0]; if (typeof v === 'string' || Array.isArray(v)) return v.length; if (v && typeof v === 'object') return Object.keys(v).length; throw err(`len of type ${goType(v)}`, 'call'); },
    index: a => { let v = a[0]; for (const k of a.slice(1)) { if (v === null || v === undefined) throw err('index of untyped nil', 'call'); v = v[k]; } return v; },
    eq: a => { if (a.length < 2) throw err('missing argument for comparison', 'call'); return a.slice(1).some(b => { cmp('eq', a[0], b); return a[0] === b; }); },
    ne: a => { need('ne', a, 2); cmp('ne', a[0], a[1]); return a[0] !== a[1]; },
    lt: a => { need('lt', a, 2); cmp('lt', a[0], a[1]); return a[0] < a[1]; },
    le: a => { need('le', a, 2); cmp('le', a[0], a[1]); return a[0] <= a[1]; },
    gt: a => { need('gt', a, 2); cmp('gt', a[0], a[1]); return a[0] > a[1]; },
    ge: a => { need('ge', a, 2); cmp('ge', a[0], a[1]); return a[0] >= a[1]; },
    and: a => { for (const x of a) if (!truthy(x)) return x; return a[a.length - 1]; },
    or: a => { for (const x of a) if (truthy(x)) return x; return a[a.length - 1]; },
    not: a => { need('not', a, 1); return !truthy(a[0]); },
    empty: a => { need('empty', a, 1); return empty(a[0]); },
    coalesce: a => a.find(x => !empty(x)),
    ternary: a => { need('ternary', a, 3); return truthy(a[2]) ? a[0] : a[1]; },
    list: a => a.slice(),
    dict: a => { const o = {}; for (let i = 0; i < a.length; i += 2) o[str('dict', a[i])] = a[i + 1]; return o; },
    hasKey: a => { need('hasKey', a, 2); return !!a[0] && Object.prototype.hasOwnProperty.call(a[0], a[1]); },
    keys: a => a.reduce((o, m) => o.concat(Object.keys(m || {})), []),
    join: a => { need('join', a, 2); return (Array.isArray(a[1]) ? a[1] : [a[1]]).map(goPrint).join(str('join', a[0])); },
    splitList: a => { need('splitList', a, 2); return str('splitList', a[1]).split(str('splitList', a[0])); },
    first: a => { need('first', a, 1); return (a[0] || [])[0]; },
    last: a => { need('last', a, 1); const l = a[0] || []; return l[l.length - 1]; },
    b64enc: a => { need('b64enc', a, 1); const s = str('b64enc', a[0]); return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s).toString('base64'); },
    include: null, tpl: null,   // render ke andar bante hain (defines chahiye)
  };
  const truthy = v => !empty(v);

  /* ---------- lexer: text + {{ action }} ---------- */
  function lexFile(src, file) {
    const items = []; let i = 0;
    while (i < src.length) {
      const o = src.indexOf('{{', i);
      if (o < 0) { items.push({ t: 'text', v: src.slice(i) }); break; }
      if (o > i) items.push({ t: 'text', v: src.slice(i, o) });
      let c = src.indexOf('}}', o + 2);
      const cm = src.indexOf('*/', o + 2);
      if (/^\{\{-?\s*\/\*/.test(src.slice(o, o + 8)) && cm > -1) c = src.indexOf('}}', cm);   // comment ke andar ke }} ko chhodo
      if (c < 0) throw err(`parse error at (${file}:${lineOf(src, src.length)}): unclosed action started at ${file}:${lineOf(src, o)}`, 'parse');
      let a = o + 2, b = c;
      const tl = /^-[\s]/.test(src.slice(a, a + 2)), tr = /[\s]-$/.test(src.slice(b - 2, b));
      if (tl) a += 1;
      if (tr) b -= 1;
      items.push({ t: 'act', body: src.slice(a, b), at: a, line: lineOf(src, o), tl, tr });
      i = c + 2;
    }
    items.forEach((it, k) => {
      if (it.t !== 'act') return;
      if (it.tl && items[k - 1] && items[k - 1].t === 'text') items[k - 1].v = items[k - 1].v.replace(/\s+$/, '');
      if (it.tr && items[k + 1] && items[k + 1].t === 'text') items[k + 1].v = items[k + 1].v.replace(/^\s+/, '');
    });
    return items;
  }
  function lexAct(it, src, file) {
    const s = it.body, toks = []; let i = 0, m;
    while (i < s.length) {
      const r = s.slice(i);
      if ((m = r.match(/^\s+/))) { i += m[0].length; continue; }
      let t;
      if ((m = r.match(/^\/\*[\s\S]*?\*\//))) t = { k: 'comment' };
      else if ((m = r.match(/^"((?:[^"\\\n]|\\.)*)"/))) { let v; try { v = JSON.parse(m[0]); } catch (e) { v = m[1]; } t = { k: 'str', v }; }
      else if (/^"/.test(r)) throw err(`parse error at (${file}:${it.line}): unterminated quoted string`, 'parse');
      else if ((m = r.match(/^`([^`]*)`/))) t = { k: 'str', v: m[1] };
      else if ((m = r.match(/^(:=|=|\||\(|\)|,)/))) t = { k: 'op', v: m[0] };
      else if ((m = r.match(/^-?\d+(\.\d+)?(?![\w.])/))) t = { k: 'num', v: Number(m[0]) };
      else if ((m = r.match(/^\$[A-Za-z0-9_]*((?:\.[A-Za-z0-9_]+)*)/))) t = { k: 'var', name: m[0].split('.')[0], path: m[1] ? m[1].slice(1).split('.') : [] };
      else if ((m = r.match(/^(?:\.[A-Za-z0-9_]+)+/))) t = { k: 'field', path: m[0].slice(1).split('.') };
      else if ((m = r.match(/^\./))) t = { k: 'dot' };
      else if ((m = r.match(/^[A-Za-z_][A-Za-z0-9_]*/))) t = { k: 'id', v: m[0] };
      else throw err(`parse error at (${file}:${it.line}): unexpected "${r[0]}" in command`, 'parse');
      const abs = it.at + i;
      // Go: ".Values.img" ek chain hai — error uske DOOSRE hisse (.img) ki jagah batata hai; "$.Values.x" mein ".Values" ki
      const ch = t.k === 'field' && t.path.length > 1 ? 1 + t.path[0].length : t.k === 'var' && t.path.length ? t.name.length : 0;
      Object.assign(t, { src: m[0], line: lineOf(src, abs), col: colOf(src, abs + ch), file });
      if (t.k !== 'comment') toks.push(t);
      i += m[0].length;
    }
    return toks;
  }

  /* ---------- parser ---------- */
  function parsePipe(toks, file, line, funcs) {
    const p = { decl: null, cmds: [] };
    let k = 0;
    const di = toks.findIndex(t => t.k === 'op' && t.v === ':=');
    const ai = toks.findIndex(t => t.k === 'op' && t.v === '=');
    if (di > 0 || ai > 0) {
      const at = di > 0 ? di : ai;
      p.decl = toks.slice(0, at).filter(t => t.k === 'var').map(t => t.name);
      p.assign = ai > 0 && di < 0;
      k = at + 1;
    }
    let depth = 0, cur = [];
    const cmdsRaw = [];
    for (; k < toks.length; k++) {
      const t = toks[k];
      if (t.k === 'op' && t.v === '(') depth++;
      if (t.k === 'op' && t.v === ')') depth--;
      if (depth < 0) throw err(`parse error at (${file}:${line}): unexpected right paren`, 'parse');
      if (t.k === 'op' && t.v === '|' && depth === 0) { cmdsRaw.push(cur); cur = []; continue; }
      cur.push(t);
    }
    if (depth > 0) throw err(`parse error at (${file}:${line}): unclosed left paren`, 'parse');
    cmdsRaw.push(cur);
    cmdsRaw.forEach(raw => {
      if (!raw.length) throw err(`parse error at (${file}:${line}): missing value for command`, 'parse');
      const args = [];
      for (let j = 0; j < raw.length; j++) {
        const t = raw[j];
        if (t.k === 'op' && t.v === '(') {
          let d = 1, e = j + 1;
          for (; e < raw.length; e++) { if (raw[e].v === '(' && raw[e].k === 'op') d++; if (raw[e].v === ')' && raw[e].k === 'op' && --d === 0) break; }
          args.push({ k: 'paren', pipe: parsePipe(raw.slice(j + 1, e), file, line, funcs), src: '(' + raw.slice(j + 1, e).map(x => x.src).join(' ') + ')', line: t.line, col: t.col, file });
          j = e; continue;
        }
        if (t.k === 'op') throw err(`parse error at (${file}:${line}): unexpected "${t.v}" in operand`, 'parse');
        if (t.k === 'id' && !['true', 'false', 'nil'].includes(t.v) && !(t.v in funcs)) throw err(`parse error at (${file}:${t.line}): function "${t.v}" not defined`, 'parse');
        if (t.k === 'id' && j > 0 && !['true', 'false', 'nil'].includes(t.v)) args.push({ k: 'call', fn: t.v, args: [], src: t.src, line: t.line, col: t.col, file });
        else args.push(t);
      }
      if (args[0].k !== 'id' && args.length > 1) throw err(`parse error at (${file}:${line}): can't give argument to non-function ${args[0].src}`, 'parse');
      p.cmds.push({ args, src: raw.map(x => x.src).join(' '), line: raw[0].line, col: raw[0].col, file });
    });
    return p;
  }
  function parseFile(src, file, defines, funcs) {
    const items = lexFile(src, file);
    let k = 0, lastLine = lineOf(src, src.length);
    function list() {
      const nodes = [];
      while (k < items.length) {
        const it = items[k];
        if (it.t === 'text') { nodes.push({ t: 'text', v: it.v }); k++; continue; }
        const toks = lexAct(it, src, file);
        if (!toks.length) { k++; continue; }
        const kw = toks[0].k === 'id' ? toks[0].v : null;
        if (kw === 'end' || kw === 'else') return { nodes, stop: { kw, toks, it } };
        k++;
        if (kw === 'if' || kw === 'with' || kw === 'range') {
          const node = { t: kw, arms: [], elseBody: null, line: it.line };
          let pipeToks = toks.slice(1), pit = it;
          for (;;) {
            if (!pipeToks.length) throw err(`parse error at (${file}:${pit.line}): missing value for ${kw}`, 'parse');
            const r = list();
            if (!r.stop) throw err(`parse error at (${file}:${lastLine}): unexpected EOF`, 'parse');
            node.arms.push({ pipe: parsePipe(pipeToks, file, pit.line, funcs), body: r.nodes });
            k++;
            if (r.stop.kw === 'end') break;
            const rest = r.stop.toks.slice(1);
            if (rest.length && rest[0].k === 'id' && rest[0].v === kw && kw !== 'range') { pipeToks = rest.slice(1); pit = r.stop.it; continue; }
            const r2 = list();
            if (!r2.stop) throw err(`parse error at (${file}:${lastLine}): unexpected EOF`, 'parse');
            if (r2.stop.kw !== 'end') throw err(`parse error at (${file}:${r2.stop.it.line}): expected end; found {{else}}`, 'parse');
            node.elseBody = r2.nodes; k++;
            break;
          }
          nodes.push(node);
          continue;
        }
        if (kw === 'define') {
          if (!toks[1] || toks[1].k !== 'str') throw err(`parse error at (${file}:${it.line}): define: expected string; found ${toks[1] ? toks[1].src : 'EOF'}`, 'parse');
          const r = list();
          if (!r.stop || r.stop.kw !== 'end') throw err(`parse error at (${file}:${lastLine}): unexpected EOF`, 'parse');
          k++;
          defines[toks[1].v] = { body: r.nodes, file };
          continue;
        }
        if (kw === 'template') {
          if (!toks[1] || toks[1].k !== 'str') throw err(`parse error at (${file}:${it.line}): template: expected string`, 'parse');
          const rest = toks.slice(2);
          nodes.push({ t: 'tmpl', name: toks[1].v, pipe: rest.length ? parsePipe(rest, file, it.line, funcs) : null, tok: toks[0] });
          continue;
        }
        if (kw === 'break' || kw === 'continue') { nodes.push({ t: kw }); continue; }
        nodes.push({ t: 'act', pipe: parsePipe(toks, file, it.line, funcs) });
      }
      return { nodes, stop: null };
    }
    const r = list();
    if (r.stop) throw err(`parse error at (${file}:${r.stop.it.line}): unexpected {{${r.stop.kw}}}`, 'parse');
    return r.nodes;
  }

  /* ---------- executor ---------- */
  function makeRun(defines, root) {
    let depth = 0;
    // Helm 4 (naya Go text/template): "file:L:C\n  executing "name" at <node>:\n    sandesh"  (2026-11-25, Helm v4.3.2 se milaya)
    const where = (node, scope) => `${node.file}:${node.line}:${node.col}\n  executing "${scope.name}" at <${node.src}>:\n    `;
    function field(base, path, node, scope) {
      let v = base;
      for (const key of path) {
        if (v === null || v === undefined) throw err(where(node, scope) + `nil pointer evaluating interface {}.${key}`);
        if (typeof v !== 'object' || Array.isArray(v)) throw err(where(node, scope) + `can't evaluate field ${key} in type ${goType(v)}`);
        v = Object.prototype.hasOwnProperty.call(v, key) ? v[key] : undefined;
      }
      return v;
    }
    function term(t, dot, vars, scope) {
      if (t.k === 'str' || t.k === 'num') return t.v;
      if (t.k === 'id') return t.v === 'true' ? true : t.v === 'false' ? false : null;
      if (t.k === 'dot') return dot;
      if (t.k === 'field') return field(dot, t.path, t, scope);
      if (t.k === 'var') {
        const v = t.name === '$' ? vars.$ : (t.name in vars ? vars[t.name] : undefined);
        if (t.name !== '$' && !(t.name in vars)) throw err(`parse error at (${t.file}:${t.line}): undefined variable "${t.name}"`, 'parse');
        return field(v, t.path, t, scope);
      }
      if (t.k === 'paren') return pipe(t.pipe, dot, vars, scope);
      if (t.k === 'call') return call(t.fn, [], t, dot, vars, scope);
      return undefined;
    }
    function call(fn, argv, node, dot, vars, scope) {
      try {
        if (fn === 'include' || fn === 'tpl') {
          if (fn === 'tpl') throw err('tpl simulator mein nahi', 'call');
          if (argv.length !== 2) throw err(`wrong number of args for include: want 2 got ${argv.length}`, 'call');
          return include(String(argv[0]), argv[1], node, scope);
        }
        return FUNCS[fn](argv);
      } catch (e) {
        if (e.tpl === 'call') {
          const lastArg = /^wrong type/.test(e.message) && node.args && node.args.length > 1 ? node.args[node.args.length - 1] : node;
          throw err(where(lastArg, scope) + (/^wrong (number|type)/.test(e.message) ? e.message : `error calling ${fn}: ${e.message}`));
        }
        if (e.tpl === 'required') throw err(`execution error at (${node.file}:${node.line}:${node.col}): ${e.message}`, 'required-done');
        throw e;
      }
    }
    function pipe(p, dot, vars, scope) {
      let val, have = false;
      for (const c of p.cmds) {
        const a0 = c.args[0];
        if (a0.k === 'id' && !['true', 'false', 'nil'].includes(a0.v)) {
          const argv = c.args.slice(1).map(x => term(x, dot, vars, scope));
          if (have) argv.push(val);
          val = call(a0.v, argv, c, dot, vars, scope);
        } else {
          if (have) throw err(where(c, scope) + `can't give argument to non-function ${a0.src}`);
          val = term(a0, dot, vars, scope);
        }
        have = true;
      }
      if (p.decl) p.decl.forEach(n => { vars[n] = val; });
      return p.decl ? undefined : val;   // {{ $x := … }} kuch nahi chhapta
    }
    function include(name, data, node, scope) {
      const d = defines[name];
      if (!d) throw err(where(node, scope) + `error calling include:\ntemplate: no template "${name}" associated with template "gotpl"`);
      if (++depth > 50) throw err(`rendering template has a nested reference name: ${name}: unable to execute template`);
      try { return exec(d.body, data, { $: data }, { name }); } finally { depth--; }
    }
    const BRK = { brk: 1 }, CNT = { cnt: 1 };
    function exec(nodes, dot, vars, scope) {
      let out = '';
      for (const n of nodes) {
        if (n.t === 'text') out += n.v;
        else if (n.t === 'act') { const v = pipe(n.pipe, dot, vars, scope); if (!n.pipe.decl) out += goPrint(v); }
        else if (n.t === 'tmpl') out += include(n.name, n.pipe ? pipe(n.pipe, dot, vars, scope) : null, n.tok, scope);
        else if (n.t === 'break') throw BRK;
        else if (n.t === 'continue') throw CNT;
        else if (n.t === 'if' || n.t === 'with') {
          let done = false;
          for (const arm of n.arms) {
            const v = pipeVal(arm.pipe, dot, vars, scope);
            if (truthy(v)) { out += exec(arm.body, n.t === 'with' ? v : dot, Object.assign({}, vars), scope); done = true; break; }
          }
          if (!done && n.elseBody) out += exec(n.elseBody, dot, Object.assign({}, vars), scope);
        } else if (n.t === 'range') {
          const arm = n.arms[0], p = arm.pipe;
          const v = pipe(Object.assign({}, p, { decl: null }), dot, vars, scope);
          let entries = [];
          if (Array.isArray(v)) entries = v.map((x, i) => [i, x]);
          else if (v && typeof v === 'object') entries = Object.keys(v).sort().map(k => [k, v[k]]);
          else if (typeof v === 'number') entries = Array.from({ length: Math.max(0, v) }, (_, i) => [i, i]);
          else if (v !== null && v !== undefined) throw err(where(p.cmds[0], scope) + `range can't iterate over ${goPrint(v)}`);
          if (!entries.length) { if (n.elseBody) out += exec(n.elseBody, dot, Object.assign({}, vars), scope); continue; }
          for (const [key, x] of entries) {
            const vv = Object.assign({}, vars);
            if (p.decl) { if (p.decl.length === 2) { vv[p.decl[0]] = key; vv[p.decl[1]] = x; } else vv[p.decl[0]] = x; }
            try { out += exec(arm.body, x, vv, scope); }
            catch (e) { if (e === BRK) break; if (e === CNT) continue; throw e; }
          }
        }
      }
      return out;
    }
    function pipeVal(p, dot, vars, scope) {   // if/with mein "$x := …" bhi chale
      const v = pipe(Object.assign({}, p, { decl: null }), dot, vars, scope);
      if (p.decl) p.decl.forEach(nm => { vars[nm] = v; });
      return v;
    }
    return { exec, include };
  }

  /* ---------- chart render: Helm jaisa ---------- */
  function renderChart(files, ctx) {
    const defines = {}, trees = {};
    const funcs = Object.assign({}, FUNCS);
    try {
      Object.keys(files).sort().forEach(f => { if (/\/templates\//.test(f)) trees[f] = parseFile(files[f], f, defines, funcs); });
    } catch (e) { if (e.tpl) return { err: e.message }; throw e; }
    const run = makeRun(defines, ctx);
    const out = {};
    for (const f of Object.keys(trees).sort()) {
      if (/\/_[^/]*$/.test(f) || !/\.(ya?ml|tpl|txt)$/.test(f) || /NOTES\.txt$/.test(f)) continue;
      try { out[f] = run.exec(trees[f], ctx, { $: ctx }, { name: f }).replace(/<no value>/g, ''); }
      catch (e) { if (e.tpl) return { err: e.message }; throw e; }
    }
    return { files: out };
  }

  return { renderChart, toYaml, goPrint, FUNCS };
})();
