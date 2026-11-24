/* =====================================================================
   KubeGurukul — mini YAML parser (KG.yaml) — YAML fix editor ke liye

   Terminal mission mein learner `vi <file>` se YAML badalta hai, phir
   `kubectl apply -f <file>`. Terminal pehle text ko KG.yaml.parseAll se
   padhta hai — galat YAML par asli kubectl jaisa error:
     error: error parsing app.yaml: error converting YAML to JSON: yaml: line 7: did not find expected key
   Theek YAML par mission ke file.apply(sim, text, docs) ko JS objects milte hain.

   Kya samajhta hai (Kubernetes manifests ke liye kaafi):
     mappings, sequences (`- a`, `- key: v`), indentation se nesting,
     comments (#), `---` se kai documents, "…" aur '…' strings,
     flow `{ a: 1, b: [x, y] }`, block scalars `|`, `|-`, `>`,
     scalars: int, float, null/~, true/false — aur YAML 1.1 wale
     yes/no/on/off bhi bool (Kubernetes ka go-yaml v2 aisa hi karta hai:
     ConfigMap mein `FEATURE: yes` → bool → "cannot unmarshal bool").
   Kya NAHI: anchors (&, *), tags (!!str), multi-line plain scalars.

   Errors (go-yaml ke asli message):
     tab se indent          → found character that cannot start any token
     `naam web` (colon nahi) → could not find expected ':'
     `a: b: c`              → mapping values are not allowed in this context
     beech ki galat indent   → did not find expected key
     duplicate key          → key "x" already set in map
   ===================================================================== */
KG.yaml = (function () {
  function YamlError(line, msg) {
    const e = new Error(`yaml: line ${line}: ${msg}`);
    e.line = line; e.yaml = true;
    return e;
  }

  /* ` # comment` hatao — quotes ke andar ka # nahi */
  function stripComment(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { if (i === 0 || /[\s:\[{,-]/.test(s[i - 1])) q = ch; continue; }
      if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).replace(/\s+$/, '');
    }
    return s.replace(/\s+$/, '');
  }

  const BOOL_T = /^(y|Y|yes|Yes|YES|true|True|TRUE|on|On|ON)$/;
  const BOOL_F = /^(n|N|no|No|NO|false|False|FALSE|off|Off|OFF)$/;
  function scalar(raw, line) {
    const s = raw.trim();
    if (s === '' || s === '~' || /^(null|Null|NULL)$/.test(s)) return null;
    if (s[0] === '"') {
      if (s.length < 2 || s[s.length - 1] !== '"') throw YamlError(line, 'found unexpected end of stream');
      try { return JSON.parse(s); } catch (e) { return s.slice(1, -1); }
    }
    if (s[0] === "'") {
      if (s.length < 2 || s[s.length - 1] !== "'") throw YamlError(line, 'found unexpected end of stream');
      return s.slice(1, -1).replace(/''/g, "'");
    }
    if (s[0] === '{' || s[0] === '[') return flow(s, line);
    if (BOOL_T.test(s)) return true;
    if (BOOL_F.test(s)) return false;
    if (/^[-+]?(0|[1-9][0-9]*)$/.test(s)) return parseInt(s, 10);
    if (/^[-+]?([0-9]+\.[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?$/.test(s)) return parseFloat(s);
    if (/^[&*]/.test(s)) throw YamlError(line, 'did not find expected alphabetic or numeric character');   // schedule: */5 * * * *
    if (/^[!|>%@`]/.test(s)) throw YamlError(line, 'found character that cannot start any token');
    return s;
  }

  /* flow style: { a: 1, b: [x, "y"] } */
  function flow(src, line) {
    let i = 0;
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    function value(stop) {
      ws();
      if (src[i] === '{') return map();
      if (src[i] === '[') return list();
      let q = null, start = i;
      while (i < src.length) {
        const ch = src[i];
        if (q) { if (ch === q) q = null; i++; continue; }
        if ((ch === '"' || ch === "'") && i === start) { q = ch; i++; continue; }
        if (stop.includes(ch)) break;
        i++;
      }
      return scalar(src.slice(start, i), line);
    }
    function map() {
      i++; const out = {};
      for (;;) {
        ws();
        if (src[i] === '}') { i++; return out; }
        if (i >= src.length) throw YamlError(line, "did not find expected ',' or '}'");
        const k = value([':', ',', '}']);
        ws();
        let v = null;
        if (src[i] === ':') { i++; v = value([',', '}']); }
        out[String(k)] = v;
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return out; }
        throw YamlError(line, "did not find expected ',' or '}'");
      }
    }
    function list() {
      i++; const out = [];
      for (;;) {
        ws();
        if (src[i] === ']') { i++; return out; }
        if (i >= src.length) throw YamlError(line, "did not find expected ',' or ']'");
        let item = value([',', ']', ':']);
        ws();
        if (src[i] === ':') { i++; const v = value([',', ']']); item = { [String(item)]: v }; ws(); }  // [ a: 1 ] → [{a:1}]
        out.push(item);
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return out; }
        throw YamlError(line, "did not find expected ',' or ']'");
      }
    }
    const v = value([]);
    ws();
    if (i < src.length) throw YamlError(line, 'did not find expected <document start>');
    return v;
  }

  /* `key: value` ko todo. Key ke baad ':' aur phir space ya line ka ant zaroori. */
  function splitKey(text) {
    let i = 0, q = null;
    if (text[0] === '"' || text[0] === "'") {
      q = text[0]; i = 1;
      while (i < text.length && text[i] !== q) i++;
      i++;
      if (text[i] !== ':') return null;
      if (i + 1 < text.length && text[i + 1] !== ' ') return null;
      return { key: scalar(text.slice(0, i), 0), rest: text.slice(i + 1).trim() };
    }
    if (text[0] === '{' || text[0] === '[') return null;
    for (; i < text.length; i++) {
      if (text[i] === ':' && (i + 1 === text.length || text[i + 1] === ' ')) return { key: text.slice(0, i).trim(), rest: text.slice(i + 1).trim() };
    }
    return null;
  }
  /* `image: nginx: 1.25` — value ke andar unquoted ": " → go-yaml ka error */
  function badNested(rest) {
    if (!rest || rest[0] === '"' || rest[0] === "'" || rest[0] === '{' || rest[0] === '[' || rest[0] === '|' || rest[0] === '>') return false;
    return /:( |$)/.test(rest);
  }

  function parseDoc(lines) {
    let i = 0;
    // khaali lines sirf block scalar (|) ke andar maayne rakhti hain — baaki jagah chhodo
    const peek = () => { while (i < lines.length && lines[i].blank) i++; return lines[i]; };

    function block(ind) {
      const ln = peek();
      if (!ln || ln.ind < ind) return null;
      return isSeq(ln.text) ? seq(ln.ind) : map(ln.ind);
    }
    const isSeq = t => t === '-' || t.startsWith('- ');

    function map(ind) {
      const out = {}, seen = {};
      for (;;) {
        const ln = peek();
        if (!ln || ln.ind < ind) break;
        if (ln.ind > ind) throw YamlError(ln.no, 'did not find expected key');
        if (isSeq(ln.text)) {
          throw YamlError(ln.no, 'did not find expected key');
        }
        const kv = splitKey(ln.text);
        if (!kv) throw YamlError(ln.no, "could not find expected ':'");      // "name web" — colon bhool gaye
        const key = String(kv.key);
        if (seen[key]) {
          const e = new Error(`yaml: unmarshal errors:\n  line ${ln.no}: key "${key}" already set in map`);
          e.line = ln.no; e.yaml = true;
          throw e;
        }
        seen[key] = ln.no;
        i++;
        out[key] = value(kv.rest, ln, ind);
      }
      return out;
    }

    function value(rest, ln, ind) {
      if (/^[|>][-+]?$/.test(rest)) return blockScalar(rest, ind);
      if (rest === '') {
        const nx = peek();
        if (!nx) return null;
        if (nx.ind > ind) return block(nx.ind);
        if (nx.ind === ind && isSeq(nx.text)) return seq(ind);          // key:\n- a   (same indent wali list)
        return null;
      }
      if (badNested(rest)) throw YamlError(ln.no, 'mapping values are not allowed in this context');
      const v = scalar(rest, ln.no);
      const nx = peek();
      if (nx && nx.ind > ind) {
        // value ke baad zyada indent wali line: "replicas: 3\n    image: x"
        throw YamlError(nx.no, splitKey(nx.text) ? 'mapping values are not allowed in this context' : "could not find expected ':'");
      }
      return v;
    }

    function blockScalar(head, ind) {
      const keep = head.slice(1);
      const body = [];
      let base = null;
      while (i < lines.length) {
        const ln = lines[i];
        if (!ln.blank && ln.ind <= ind) break;
        if (!ln.blank && base === null) base = ln.ind;
        body.push(ln);
        i++;
      }
      while (body.length && body[body.length - 1].blank) body.pop();
      const textLines = body.map(l => l.blank ? '' : l.raw.slice(base));
      let txt = head[0] === '>'
        ? textLines.reduce((acc, l, k) => acc + (k === 0 ? l : (l === '' || textLines[k - 1] === '' ? '\n' + l : ' ' + l)), '')
        : textLines.join('\n');
      if (keep !== '-' && txt !== '') txt += '\n';
      return txt;
    }

    function seq(ind) {
      const out = [];
      for (;;) {
        const ln = peek();
        if (!ln || ln.ind < ind) break;
        if (ln.ind > ind) throw YamlError(ln.no, "did not find expected '-' indicator");
        if (!isSeq(ln.text)) break;                                          // parent map ki agli key
        const rest = ln.text === '-' ? '' : ln.text.slice(2);
        const off = ln.text === '-' ? 0 : 2 + (rest.length - rest.trimStart().length);
        const r = rest.trim();
        if (r === '') {
          i++;
          const nx = peek();
          out.push(nx && nx.ind > ind ? block(nx.ind) : null);
        } else if (isSeq(r) || (splitKey(r) && !(r[0] === '{' || r[0] === '['))) {
          // "- name: web" → item ek map hai jiska pehla key isi line par hai
          lines[i] = { ind: ind + off, text: r, raw: ln.raw, no: ln.no };
          out.push(block(ind + off));
        } else {
          i++;
          if (badNested(r)) throw YamlError(ln.no, 'mapping values are not allowed in this context');
          out.push(scalar(r, ln.no));
          const nx = peek();
          if (nx && nx.ind > ind) throw YamlError(nx.no, splitKey(nx.text) ? 'mapping values are not allowed in this context' : "did not find expected '-' indicator");
        }
      }
      return out;
    }

    const first = peek();
    if (!first) return null;
    if (lines.length === 1 && !splitKey(first.text) && !isSeq(first.text)) { i++; return scalar(first.text, first.no); }
    const doc = block(first.ind);
    const left = peek();
    if (left) throw YamlError(left.no, 'did not find expected key');
    return doc;
  }

  /* text → documents ki list (khaali documents chhod ke) */
  function parseAll(text) {
    const docs = [];
    let cur = [];
    const flush = () => {
      const content = cur.filter(l => !l.blank);
      if (content.length) {
        const ls = cur.slice();
        while (ls.length && ls[0].blank) ls.shift();
        const d = parseDoc(ls);
        if (d != null) docs.push(d);
      }
      cur = [];
    };
    String(text).replace(/\r\n?/g, '\n').split('\n').forEach((raw, idx) => {
      const no = idx + 1;
      if (/^---(\s|$)/.test(raw)) { flush(); return; }
      if (/^\.\.\.(\s|$)/.test(raw)) { flush(); return; }
      const lead = raw.match(/^[ \t]*/)[0];
      const body = stripComment(raw.slice(lead.length));
      if (body === '') { cur.push({ blank: true, raw, no, ind: 0, text: '' }); return; }
      if (lead.includes('\t')) throw YamlError(no, 'found character that cannot start any token');
      cur.push({ ind: lead.length, text: body, raw, no });
    });
    flush();
    return docs;
  }

  /* KG.yaml.get(obj, 'spec.template.spec.containers[0].image') */
  function get(obj, path) {
    return String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
      .reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  /* chhota line-diff (LCS) — save ke baad terminal mein "- purani / + nayi" lines */
  function diff(a, b) {
    const A = String(a).split('\n'), B = String(b).split('\n');
    const n = A.length, m = B.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let x = n - 1; x >= 0; x--) for (let y = m - 1; y >= 0; y--)
      L[x][y] = A[x] === B[y] ? L[x + 1][y + 1] + 1 : Math.max(L[x + 1][y], L[x][y + 1]);
    const out = [];
    let x = 0, y = 0;
    while (x < n && y < m) {
      if (A[x] === B[y]) { x++; y++; }
      else if (L[x + 1][y] >= L[x][y + 1]) out.push({ op: '-', line: x + 1, text: A[x++] });
      else out.push({ op: '+', line: y + 1, text: B[y++] });
    }
    while (x < n) out.push({ op: '-', line: x + 1, text: A[x++] });
    while (y < m) out.push({ op: '+', line: y + 1, text: B[y++] });
    return out;
  }

  return { parseAll, parse: t => parseAll(t)[0], get, diff };
})();
