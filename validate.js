#!/usr/bin/env node
/* =====================================================================
   KubeGurukul — Validator + Engine Tests
   Chalao:  node validate.js
   Naya content add karne ke baad HAMESHA yeh chalao — yeh pakadta hai:
   missing visuals, toote hue fill-tokens, unreachable incident nodes,
   pre-solved terminal missions, aur simulators ke bugs.
   ===================================================================== */

const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const noop = () => {};

/* ---------- minimal DOM stub (engine load karne ke liye) ---------- */
/* DOM stub — itna asli ki labs.js ke renderers sach mein chal sakein aur
   validator unke buttons "click" kar sake. */
function fakeEl(tag) {
  const el = {
    tag: tag || 'div', style: {}, dataset: {}, children: [], disabled: false,
    _cls: new Set(), _html: '', _text: '', _handlers: {}, onclick: null, type: '', value: '',
    classList: {
      add(...c) { c.forEach(x => x && el._cls.add(x)); },
      remove(...c) { c.forEach(x => el._cls.delete(x)); },
      contains: c => el._cls.has(c),
    },
    set className(v) { el._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get className() { return [...el._cls].join(' '); },
    set innerHTML(v) { el._html = String(v); if (v === '') el.children = []; },
    get innerHTML() { return el._html; },
    set textContent(v) { el._text = String(v); },
    get textContent() { return el._text; },
    appendChild(c) { el.children.push(c); return c; },
    append(...cs) { cs.forEach(c => el.children.push(c)); },
    // same selector = same element (renderer aur test ek hi <input>/.term-out pakdein)
    _qs: {},
    querySelector(sel) { return (el._qs[sel] = el._qs[sel] || fakeEl()); },
    querySelectorAll: () => [],
    addEventListener(ev, fn) { (el._handlers[ev] = el._handlers[ev] || []).push(fn); },
    click() {
      if (el.disabled) return;
      if (el.onclick) el.onclick({ stopPropagation: noop, preventDefault: noop });
      (el._handlers.click || []).forEach(fn => fn({ stopPropagation: noop, preventDefault: noop }));
    },
    fire(ev, extra) { (el._handlers[ev] || []).forEach(fn => fn(Object.assign({ stopPropagation: noop, preventDefault: noop }, extra || {}))); },
    scrollIntoView: noop, remove: noop, focus: noop,
  };
  return el;
}
/* poore subtree mein se woh nodes dhoondo jinka text/label match kare */
function walk(node, out) {
  out = out || [];
  (node.children || []).forEach(c => { out.push(c); walk(c, out); });
  return out;
}
global.document = { getElementById: () => fakeEl(), createElement: t => fakeEl(t), createTextNode: () => ({}) };
// window = global object (decisions.js/reallabs.js `window.showX = …` likhte hain → free function ban jaate hain)
global.window = global;
global.scrollTo = noop;
let store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
global.confirm = () => false;
global.Element = function () {}; Element.prototype = {};

const FILES = ['core.js', 'data-core.js', 'visuals.js', 'games.js', 'labs.js', 'terminal.js',
  'helmsim.js', 'argosim.js', 'karpentersim.js', 'dockerlab.js', 'decisions.js', 'reallabs.js',
  'data-beginner.js', 'data-intermediate.js', 'data-advanced.js',
  'data-helm.js', 'data-argocd.js', 'data-karpenter.js', 'data-kodekloud.js', 'data-gaps.js', 'data-ext-sdd.js',
  'data-decisions.js', 'app.js'];

const missing = FILES.filter(f => !fs.existsSync(path.join(DIR, f)));
if (missing.length) { console.error('❌ missing files:', missing.join(', ')); process.exit(1); }
const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');

/* index.html mein sab scripts load ho rahi hain? */
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const notLoaded = FILES.filter(f => !html.includes(`src="${f}"`));

const problems = [];
const results = [];
function ok(name) { results.push('  ✓ ' + name); }
function t(name, fn) { try { fn(); ok(name); } catch (e) { problems.push(name + ': ' + e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

const checks = `
/* ============ 1. CONTENT STRUCTURE ============ */
const stageTypes = new Set(Object.keys(KG.renderers));
const seenIds = new Set();
const labStages = [];
let nCards = 0, nStages = 0, nTerm = 0, nLevels = 0;
const byType = {};
const uniqueContent = (values, at) => {
  if (new Set(values).size !== values.length) problems.push(at + ': duplicate content');
};
const choiceBias = {};
const auditChoiceBias = (q, track) => {
  if (!q || !q.choices || q.answer == null) return;
  const lengths = q.choices.map(c => String(c).replace(/<[^>]+>/g, '').length);
  const good = lengths[q.answer], bad = lengths.filter((_, i) => i !== q.answer);
  if (!bad.length) return;
  const b = choiceBias[track] || (choiceBias[track] = { total: 0, flagged: 0 });
  b.total++;
  if (good >= 1.15 * Math.max(...bad) || good <= 0.85 * Math.min(...bad)) b.flagged++;
};

KG.tracks.forEach(track => {
  const lvls = KG.levelsOf(track);
  if (!lvls.length) problems.push('track ' + track.id + ': koi level nahi (data file load hui?)');
  ['id','icon','name','blurb','certTitle','certSub','motto','formula'].forEach(k => {
    if (!track[k]) problems.push('track ' + track.id + ': missing ' + k);
  });
  lvls.forEach(l => {
    nLevels++;
    const ctx = track.id + '/' + l.id;
    if (seenIds.has(l.id)) problems.push(ctx + ': DUPLICATE level id');
    seenIds.add(l.id);
    ['id','icon','title','badge','objectives','lesson','stages','interview','success','cards'].forEach(k => {
      if (!l[k]) problems.push(ctx + ': missing ' + k);
    });
    if (!VISUALS[l.id]) problems.push(ctx + ': VISUALS["' + l.id + '"] missing');
    nCards += (l.cards || []).length;
    if ((l.cards || []).length < 3) problems.push(ctx + ': sirf ' + (l.cards||[]).length + ' cards (3+ chahiye)');
    (l.cards || []).forEach((c, i) => { if (!c.front || !c.back) problems.push(ctx + ' card' + i + ': incomplete'); });

    (l.stages || []).forEach((s, i) => {
      nStages++;
      byType[s.type] = (byType[s.type] || 0) + 1;
      const sc = ctx + ' stage' + i + '(' + s.type + ')';
      if (!stageTypes.has(s.type)) problems.push(sc + ': unknown stage type');
      if (!s.title) problems.push(sc + ': no title');
      if (['quiz', 'render', 'triage'].includes(s.type)) (s.questions || []).forEach(q => auditChoiceBias(q, track.id));
      if (s.type === 'flow') (s.steps || []).forEach(step => auditChoiceBias(step.ask, track.id));
      if (s.type === 'slider') auditChoiceBias(s.quiz, track.id);
      if (s.type === 'docker') auditChoiceBias(s.observe, track.id);

      if (s.type === 'quiz' || s.type === 'render') {
        (s.questions || []).forEach((q, j) => {
          if (!q.choices || q.answer == null || !q.explain) problems.push(sc + ' q' + j + ': incomplete');
          else if (q.answer < 0 || q.answer >= q.choices.length) problems.push(sc + ' q' + j + ': answer index out of range');
          if (q.choices && new Set(q.choices).size !== q.choices.length) problems.push(sc + ' q' + j + ': duplicate choices');
        });
        if (s.type === 'render' && (!s.values || !s.template)) problems.push(sc + ': render panes missing');
      }
      if (s.type === 'bins') {
        if (!s.bins || !s.items) problems.push(sc + ': incomplete');
        else {
          uniqueContent(s.bins.map(b => b.id), sc + ' bin ids');
          uniqueContent(s.items.map(it => it.text), sc + ' item texts');
          s.items.forEach(it => {
            if (!s.bins.some(b => b.id === it.bin)) problems.push(sc + ': item bin "' + it.bin + '" undefined');
            if (!it.explain) problems.push(sc + ': item "' + it.text + '" no explain');
          });
          s.bins.forEach(b => { if (!s.items.some(it => it.bin === b.id)) problems.push(sc + ': bin "' + b.id + '" khaali hai'); });
        }
      }
      if (s.type === 'match') {
        (s.pairs || []).forEach((p, j) => { if (!p.left || !p.right || !p.explain) problems.push(sc + ' pair' + j + ': incomplete'); });
        uniqueContent((s.pairs || []).map(p => p.left), sc + ' left items');
        uniqueContent((s.pairs || []).map(p => p.right), sc + ' right items');
      }
      if (s.type === 'order') (s.steps || []).forEach((st, j) => { if (!st.text || !st.explain) problems.push(sc + ' step' + j + ': incomplete'); });
      if (s.type === 'fill') {
        if (!s.template || !s.blanks || !s.tokens) problems.push(sc + ': incomplete');
        else {
          const idxs = (s.template.match(/\\{\\d+\\}/g) || []).map(m => +m.slice(1, -1)).sort((a, b) => a - b);
          const want = s.blanks.map((_, i) => i);
          uniqueContent(s.blanks.map(b => b.answer), sc + ' fill answers (tokens are single-use)');
          if (JSON.stringify(idxs) !== JSON.stringify(want))
            problems.push(sc + ': placeholders ' + JSON.stringify(idxs) + ' != blanks ' + JSON.stringify(want));
          s.blanks.forEach(b => {
            if (!s.tokens.includes(b.answer)) problems.push(sc + ': answer "' + b.answer + '" tokens mein nahi');
            if (!b.explain) problems.push(sc + ': blank bina explain');
          });
          const dup = s.tokens.filter((x, i) => s.tokens.indexOf(x) !== i);
          if (dup.length) problems.push(sc + ': duplicate tokens ' + JSON.stringify(dup));
        }
      }
      if (s.type === 'hotspot') {
        const v = VISUALS[s.visual];
        if (!v) problems.push(sc + ': visual "' + s.visual + '" missing');
        else (s.questions || []).forEach(q => {
          if (!v.html.includes('data-hs="' + q.target + '"')) problems.push(sc + ': target "' + q.target + '" diagram mein clickable nahi');
        });
      }
      if (s.type === 'incident') {
        if (!s.nodes || !s.start || !s.nodes[s.start]) problems.push(sc + ': start node missing');
        let end = false;
        Object.entries(s.nodes || {}).forEach(([nid, n]) => {
          if (n.end) { end = true; if (!n.summary) problems.push(sc + ': end node bina summary'); return; }
          const goods = (n.choices || []).filter(c => c.good);
          if (goods.length !== 1) problems.push(sc + ': node ' + nid + ' mein ' + goods.length + ' good choices (1 chahiye)');
          (n.choices || []).forEach(c => {
            if (!c.explain) problems.push(sc + ': node ' + nid + ' choice bina explain');
            if (c.good && !s.nodes[c.next]) problems.push(sc + ': node ' + nid + ' -> missing node "' + c.next + '"');
          });
        });
        if (!end) problems.push(sc + ': koi end node nahi');
      }
      if (s.type === 'triage') {
        if (!s.symptom) problems.push(sc + ': symptom missing');
        if (!s.commands || s.commands.length < 3) problems.push(sc + ': 3+ commands chahiye (palette)');
        else {
          if (!s.commands.some(c => c.clue)) problems.push(sc + ': ek bhi clue: true command nahi — verdict kabhi nahi khulega');
          s.commands.forEach(c => {
            if (!c.cmd || !c.out || !c.note) problems.push(sc + ': command "' + (c.cmd || '?') + '" adhoori (cmd/out/note chahiye)');
          });
          const dupC = s.commands.map(c => c.cmd).filter((x, i, a) => a.indexOf(x) !== i);
          if (dupC.length) problems.push(sc + ': duplicate command ' + JSON.stringify(dupC) + ' (Set se ek hi register hogi)');
        }
        if (!s.questions || !s.questions.length) problems.push(sc + ': koi verdict question nahi');
        (s.questions || []).forEach((q, j) => {
          if (!q.q || !q.choices || q.answer == null || !q.explain) problems.push(sc + ' q' + j + ': incomplete');
          else if (q.answer < 0 || q.answer >= q.choices.length) problems.push(sc + ' q' + j + ': answer index out of range');
          if (q.choices && new Set(q.choices).size !== q.choices.length) problems.push(sc + ' q' + j + ': duplicate choices');
        });
        labStages.push({ at: sc, stage: s });
      }
      if (s.type === 'slider') {
        if (!s.goal) problems.push(sc + ': goal missing');
        if (!s.knobs || !s.knobs.length) problems.push(sc + ': koi knob nahi');
        ['readouts', 'verdict', 'check'].forEach(fn => {
          if (typeof s[fn] !== 'function') problems.push(sc + ': ' + fn + '() function nahi hai');
        });
        (s.knobs || []).forEach(kn => {
          if (!kn.id || !kn.label) problems.push(sc + ': knob bina id/label');
          if (kn.value == null || kn.min == null || kn.max == null) problems.push(sc + ': knob "' + kn.id + '" bina min/max/value');
          else if (kn.value < kn.min || kn.value > kn.max) problems.push(sc + ': knob "' + kn.id + '" ki default value range se bahar');
        });
        if (s.quiz) {
          if (s.quiz.answer == null || !s.quiz.choices || !s.quiz.explain) problems.push(sc + ': quiz incomplete');
          else if (s.quiz.answer < 0 || s.quiz.answer >= s.quiz.choices.length) problems.push(sc + ': quiz answer out of range');
        }
        labStages.push({ at: sc, stage: s });
      }
      if (s.type === 'flow') {
        if (!s.lanes || !s.lanes.length) problems.push(sc + ': koi lane nahi');
        if (!s.steps || s.steps.length < 3) problems.push(sc + ': 3+ steps chahiye');
        (s.steps || []).forEach((st, j) => {
          if (!st.t) problems.push(sc + ' step' + j + ': koi text nahi');
          if (!(s.lanes || []).some(l => l.id === st.lane)) problems.push(sc + ' step' + j + ': lane "' + st.lane + '" defined nahi');
          if (st.ask) {
            if (!st.ask.choices || st.ask.answer == null || !st.ask.explain) problems.push(sc + ' step' + j + ' ask: incomplete');
            else if (st.ask.answer < 0 || st.ask.answer >= st.ask.choices.length) problems.push(sc + ' step' + j + ' ask: answer out of range');
            if (st.ask.choices && new Set(st.ask.choices).size !== st.ask.choices.length) problems.push(sc + ' step' + j + ' ask: duplicate choices');
          }
        });
        labStages.push({ at: sc, stage: s });
      }
      if (s.type === 'board') {
        if (!s.goal) problems.push(sc + ': goal missing');
        if (!s.nodes || !s.nodes.length) problems.push(sc + ': koi node nahi');
        if (!s.pods || !s.pods.length) problems.push(sc + ': koi pod nahi');
        (s.nodes || []).forEach(n => {
          if (!n.id || !n.name) problems.push(sc + ': node bina id/name');
          if (n.cpu == null || n.mem == null) problems.push(sc + ': node "' + n.id + '" bina cpu/mem');
        });
        (s.pods || []).forEach(pd => {
          if (!pd.id || !pd.name) problems.push(sc + ': pod bina id/name');
          if (pd.cpu == null || pd.mem == null) problems.push(sc + ': pod "' + pd.id + '" bina cpu/mem');
        });
        const dupN = (s.nodes || []).map(n => n.id).filter((x, i, a) => a.indexOf(x) !== i);
        const dupP = (s.pods || []).map(pd => pd.id).filter((x, i, a) => a.indexOf(x) !== i);
        if (dupN.length) problems.push(sc + ': duplicate node id ' + JSON.stringify(dupN));
        if (dupP.length) problems.push(sc + ': duplicate pod id ' + JSON.stringify(dupP));
        labStages.push({ at: sc, stage: s });
      }
      if (s.type === 'docker') {
        if (!s.project) problems.push(sc + ': project missing');
        else {
          const pdir = path.join(DIR, 'docker-labs', s.project);
          if (!fs.existsSync(pdir)) problems.push(sc + ': docker-labs/' + s.project + ' folder nahi hai');
          else if (s.exercise) {
            const rp = path.join(pdir, 'README.md');
            if (!(fs.existsSync(rp) && fs.readFileSync(rp, 'utf8').includes(s.exercise))) problems.push(sc + ': exercise "' + s.exercise + '" project README mein nahi mila');
          }
        }
        if (!s.goal) problems.push(sc + ': goal missing');
        if ((s.steps || []).length < 2) problems.push(sc + ': kam se kam 2 steps chahiye');
        (s.steps || []).forEach((sp, i) => { if (!sp.text) problems.push(sc + ' step' + i + ': text missing'); });
        const obs = s.observe;
        if (!obs || !Array.isArray(obs.choices) || obs.choices.length < 2) problems.push(sc + ': observe sawaal (2+ choices) missing');
        else if (typeof obs.answer !== 'number' || obs.answer < 0 || obs.answer >= obs.choices.length) problems.push(sc + ': observe answer range ke bahar');
        else if (!obs.explain) problems.push(sc + ': observe explain missing');
        labStages.push({ at: sc, stage: s });
      }
      if (s.type === 'terminal') validateMission(s, sc);
    });

    (l.interview.questions || []).forEach((q, i) => {
      if (q.terminal) validateMission(q.terminal, ctx + ' iv-q' + i + '(terminal)');
      else if (!q.choices || q.answer == null || !q.explain) problems.push(ctx + ' iv-q' + i + ': incomplete');
      else if (q.answer < 0 || q.answer >= q.choices.length) problems.push(ctx + ' iv-q' + i + ': answer out of range');
      if (q.choices) uniqueContent(q.choices, ctx + ' iv-q' + i + ' choices');
      auditChoiceBias(q, track.id);
    });
  });
});

Object.entries(choiceBias).forEach(([track, b]) => {
  if (b.flagged / b.total > 0.10) problems.push(track + ': MCQ length bias ' + b.flagged + '/' + b.total + ' exceeds 10% ceiling; node tools/mcq-bias.js list ' + track);
});

function validateMission(s, sc) {
  nTerm++;
  if (!s.cluster || !s.success || !s.goal) { problems.push(sc + ': mission incomplete'); return; }
  const mk = () => ({ cluster: JSON.parse(JSON.stringify(s.cluster)), history: [], hintsUsed: 0,
                      files: s.files || {}, responses: s.responses || [] });
  const sim = mk();
  try { if (s.success(sim)) problems.push(sc + ': success() TRUE on fresh cluster — mission auto-completes!'); }
  catch (e) { problems.push(sc + ': success() throws: ' + e.message); }
  (s.tasks || []).forEach((tk, j) => { try { tk.check(mk()); } catch (e) { problems.push(sc + ' task' + j + ': check() throws: ' + e.message); } });
  Object.entries(s.files || {}).forEach(([fn, f]) => {
    if (typeof f.apply !== 'function') { problems.push(sc + ': file ' + fn + ' bina apply()'); return; }
    try { f.apply(mk()); } catch (e) { problems.push(sc + ': file ' + fn + ' apply() throws: ' + e.message); }
  });
  (s.responses || []).forEach((r, j) => {
    if (!(r.re instanceof RegExp)) problems.push(sc + ' response' + j + ': re RegExp nahi hai');
    try { const s2 = mk(); if (r.mutate) r.mutate(s2, []); if (typeof r.out === 'function') r.out(s2, []); }
    catch (e) { problems.push(sc + ' response' + j + ': throws: ' + e.message); }
  });
  // chart / app / rollout callbacks
  Object.entries((s.cluster.charts) || {}).forEach(([cn, ch]) => {
    const vals = Object.assign({}, ch.defaults || {});
    try { if (ch.render) ch.render(vals, { name: 'test', namespace: 'default' }); }
    catch (e) { problems.push(sc + ': chart ' + cn + ' render() throws: ' + e.message); }
    try { if (ch.onInstall) ch.onInstall(mk(), { name: 'test', namespace: 'default', values: vals }); }
    catch (e) { problems.push(sc + ': chart ' + cn + ' onInstall() throws: ' + e.message); }
  });
  (s.cluster.apps || []).forEach((app, ai) => {
    try { if (typeof app.diff === 'function') app.diff(mk(), app); }
    catch (e) { problems.push(sc + ': app' + ai + ' diff() throws: ' + e.message); }
    try { if (app.onSync) { const s2 = mk(); app.onSync(s2, s2.cluster.apps[ai]); } }
    catch (e) { problems.push(sc + ': app' + ai + ' onSync() throws: ' + e.message); }
  });
  (s.cluster.rollouts || []).forEach((ro, ri) => {
    try { if (ro.onChange) { const s2 = mk(); ro.onChange(s2, s2.cluster.rollouts[ri]); } }
    catch (e) { problems.push(sc + ': rollout' + ri + ' onChange() throws: ' + e.message); }
  });
  if (!s.hints || !s.hints.length) problems.push(sc + ': koi hints nahi');
  if (!s.successText) problems.push(sc + ': koi successText nahi');
}

/* ============ 1b. LABS — sach mein render karo aur solvable saabit karo ============ */
function mkArena() { return document.createElement('div'); }

function clickAll(node, cls, pick) {
  /* subtree mein se class wale buttons dhoondo aur pick(btn, i) true ho to click karo */
  const all = [];
  (function w(n) { (n.children || []).forEach(c => { all.push(c); w(c); }); })(node);
  const hits = all.filter(x => x.classList && x.classList.contains(cls));
  hits.forEach((b, i) => { if (!pick || pick(b, i)) b.click(); });
  return hits;
}

function renderLab(at, st) {
  const arena = mkArena();
  let done = null;
  try { KG.renderers[st.type](st, arena, r => { done = r; }); }
  catch (e) { problems.push(at + ': renderer throw kar gaya — ' + e.message); return; }

  if (st.type === 'docker') {
    /* saare steps tick → sawaal khulta hai → DOM DOBARA collect karo (naye buttons) → sahi option → aage */
    clickAll(arena, 'dk-tick');
    const right = clickAll(arena, 'dk-opt', b => b.dataset.i === String(st.observe.answer));
    if (!right.length) { problems.push(at + ': docker lab — saare steps tick karne par bhi observe ka sawaal nahi khula'); return; }
    clickAll(arena, 'dk-done');
    if (!done) problems.push(at + ': docker lab SOFTLOCK — sahi jawab par bhi poora nahi hua');
    else if (done.firstTry !== 1) problems.push(at + ': docker lab — sahi jawab par firstTry ' + done.firstTry);
  }

  if (st.type === 'triage') {
    /* har command chalao -> verdict khulna chahiye */
    clickAll(arena, 'tg-cmd');
    for (let round = 0; round < 12 && !done; round++) {
      const before = done;
      const choices = clickAll(arena, 'choice', b => !b.disabled);
      clickAll(arena, 'btn', b => !b.disabled);
      if (!choices.length && before === done) break;
    }
    if (!done) problems.push(at + ': saari commands + saare choices ke baad bhi lab poora nahi hua (SOFTLOCK)');
  }

  if (st.type === 'flow') {
    for (let i = 0; i < st.steps.length * 4 + 12 && !done; i++) {
      clickAll(arena, 'choice', b => !b.disabled);
      clickAll(arena, 'btn', b => !b.disabled && !/Chalao|Rok do|Wapas/.test(b.textContent || b.innerHTML));
    }
    if (!done) problems.push(at + ': flow ke saare steps ke baad bhi poora nahi hua (SOFTLOCK)');
  }

  if (st.type === 'slider') {
    /* knob sweep: koi bhi combination check() ko true kar sakta hai? */
    const knobs = st.knobs;
    const vals = knobs.map(k => {
      const step = k.step == null ? 1 : k.step;
      const out = [];
      for (let v = k.min; v <= k.max; v += step) out.push(v);
      if (out[out.length - 1] !== k.max) out.push(k.max);
      return out;
    });
    const combos = vals.reduce((a, v) => a * v.length, 1);
    if (combos > 400000) { problems.push(at + ': knob space bahut bada (' + combos + ') — sweep skip'); return; }
    let solvable = 0, total = 0, threw = null;
    const rec = (i, acc) => {
      if (threw) return;
      if (i === knobs.length) {
        total++;
        try {
          st.readouts(acc); st.verdict(acc); if (st.bars) st.bars(acc);
          if (st.check(acc)) solvable++;
        } catch (e) { threw = e.message + '  (knobs: ' + JSON.stringify(acc) + ')'; }
        return;
      }
      vals[i].forEach(v => { const n = Object.assign({}, acc); n[knobs[i].id] = v; rec(i + 1, n); });
    };
    rec(0, {});
    if (threw) { problems.push(at + ': readouts/verdict/check throw kar gaya — ' + threw); return; }
    if (solvable === 0) problems.push(at + ': UNSOLVABLE — ' + total + ' knob combinations mein se ek bhi check() ko true nahi karta');
    const start = {}; knobs.forEach(k => { start[k.id] = k.value; });
    if (st.check(start)) problems.push(at + ': goal SHURU MEIN HI poora hai — learner ko kuch karna hi nahi padega');
  }

  if (st.type === 'board') {
    /* greedy + backtracking: kya saare pods rakhe ja sakte hain? */
    const pods = st.pods, nodes = st.nodes;
    const place = {};
    const solve = (i) => {
      if (i === pods.length) return true;
      for (const n of nodes) {
        let v;
        try { v = KG.fitCheck(pods[i], n, place, pods); }
        catch (e) { problems.push(at + ': fitCheck throw — ' + e.message); return true; }
        if (v.ok) { place[pods[i].id] = n.id; if (solve(i + 1)) return true; delete place[pods[i].id]; }
      }
      return false;
    };
    if (!solve(0)) problems.push(at + ': UNSOLVABLE — saare pods ek saath schedule nahi ho sakte');
    /* har pod ke liye kam se kam ek ❌ node bhi hona chahiye, warna lab sikhata kuch nahi */
    pods.forEach(pd => {
      const fits = nodes.filter(n => KG.fitCheck(pd, n, {}, pods).ok).length;
      if (fits === nodes.length) problems.push(at + ': pod "' + pd.name + '" har node par fit hai — koi constraint sikhaya hi nahi ja raha');
      if (fits === 0) problems.push(at + ': pod "' + pd.name + '" khaali board par bhi kahin fit nahi hota');
    });
  }
}

labStages.forEach(l => renderLab(l.at, l.stage));

// orphan visuals
Object.keys(VISUALS).forEach(k => { if (!seenIds.has(k)) problems.push('VISUALS["' + k + '"]: koi level use nahi karta'); });


/* ============ 1c. DECISION DOJO — trees sahi bane hain? ============
   Har tree: start se har node tak raasta, koi cycle nahi, har sawal mein 2+ options,
   har leaf mein pick/one/why + when/avoid/gotchas, scenarios ke jawab leaf hon,
   level/lab links maujood hon, aur HTML tags balanced hon (ek khula <b> poora page bold kar deta hai). */
const realLabIds = new Set((KG.realLabs || []).map(l => l.id));
const treeIds = new Set();
let nTrees = 0, nLeaves = 0, nScen = 0;
function tagBalance(str, where) {
  ['b', 'code', 'i', 'ul', 'ol', 'li', 'details', 'summary', 'span', 'div', 'table', 'pre'].forEach(tg => {
    const o = (String(str).match(new RegExp('<' + tg + '[ >]', 'g')) || []).length;
    const c = (String(str).match(new RegExp('</' + tg + '>', 'g')) || []).length;
    if (o !== c) problems.push(where + ': <' + tg + '> ' + o + ' baar khula, ' + c + ' baar band');
  });
}
(KG.decisions || []).forEach(tree => {
  nTrees++;
  const tc = 'decision ' + tree.id;
  if (treeIds.has(tree.id)) problems.push(tc + ': DUPLICATE tree id');
  treeIds.add(tree.id);
  ['id', 'icon', 'title', 'short', 'tldr', 'start', 'nodes'].forEach(k => { if (!tree[k]) problems.push(tc + ': missing ' + k); });
  const nodes = tree.nodes || {};
  if (!nodes[tree.start]) { problems.push(tc + ': start node "' + tree.start + '" nahi hai'); return; }
  if (nodes[tree.start].leaf) problems.push(tc + ': start node khud leaf hai');
  const picks = {};
  Object.entries(nodes).forEach(([id, n]) => {
    const nc = tc + '/' + id;
    if (n.leaf) {
      nLeaves++;
      ['pick', 'one', 'why'].forEach(k => { if (!n[k]) problems.push(nc + ': leaf missing ' + k); });
      ['when', 'avoid', 'gotchas'].forEach(k => { if (!Array.isArray(n[k]) || !n[k].length) problems.push(nc + ': leaf ka ' + k + '[] khaali'); });
      if (n.pick) { if (picks[n.pick]) problems.push(nc + ': pick "' + n.pick + '" do leaves mein (practice mein confusing)'); picks[n.pick] = 1; }
      if (n.level && !KG.findLevel(n.level)) problems.push(nc + ': level "' + n.level + '" maujood nahi');
      if (n.lab && !realLabIds.has(n.lab)) problems.push(nc + ': lab "' + n.lab + '" maujood nahi');
      if (n.options) problems.push(nc + ': leaf par options? (leaf:true hatao ya options)');
    } else {
      if (!n.q) problems.push(nc + ': sawal (q) missing');
      if (!Array.isArray(n.options) || n.options.length < 2) problems.push(nc + ': kam se kam 2 options chahiye');
      (n.options || []).forEach((o, i) => {
        if (!o.t) problems.push(nc + ' option' + i + ': text missing');
        if (!nodes[o.next]) problems.push(nc + ' option' + i + ': next "' + o.next + '" node nahi hai');
      });
      const texts = (n.options || []).map(o => o.t);
      if (new Set(texts).size !== texts.length) problems.push(nc + ': duplicate option text');
    }
    Object.values(n).forEach(v => (Array.isArray(v) ? v : [v]).forEach(x => {
      if (typeof x === 'string') tagBalance(x, nc);
      else if (x && typeof x === 'object' && x.t) tagBalance(x.t, nc);
    }));
  });
  // DFS: cycle (walk kabhi khatam nahi hoga) + orphan nodes (kabhi dikhenge nahi)
  const color = {};
  (function dfs(id) {
    color[id] = 1;
    const n = nodes[id];
    ((n && !n.leaf && n.options) || []).forEach(o => {
      if (!nodes[o.next]) return;
      if (color[o.next] === 1) problems.push(tc + ': CYCLE ' + id + ' -> ' + o.next);
      else if (!color[o.next]) dfs(o.next);
    });
    color[id] = 2;
  })(tree.start);
  Object.keys(nodes).forEach(id => { if (!color[id]) problems.push(tc + ': node "' + id + '" tak koi raasta nahi (orphan)'); });
  (tree.levels || []).forEach(id => { if (!KG.findLevel(id)) problems.push(tc + ': level "' + id + '" maujood nahi'); });
  (tree.labs || []).forEach(id => { if (!realLabIds.has(id)) problems.push(tc + ': lab "' + id + '" maujood nahi'); });
  if (tree.compare) {
    const cols = (tree.compare.cols || []).length;
    (tree.compare.rows || []).forEach((r, i) => {
      if (r.length !== cols) problems.push(tc + ': compare row' + i + ' mein ' + r.length + ' cells, ' + cols + ' columns');
      r.forEach(c => tagBalance(c, tc + ' compare row' + i));
    });
  }
  const sc = tree.scenarios || [];
  nScen += sc.length;
  if (sc.length < 3) problems.push(tc + ': sirf ' + sc.length + ' scenarios (3+ chahiye)');
  const seenS = new Set();
  sc.forEach((x, i) => {
    if (!x.s || !x.answer || !x.explain) problems.push(tc + ' scenario' + i + ': incomplete');
    else if (!nodes[x.answer] || !nodes[x.answer].leaf) problems.push(tc + ' scenario' + i + ': answer "' + x.answer + '" leaf nahi hai');
    if (seenS.has(x.s)) problems.push(tc + ' scenario' + i + ': duplicate scenario');
    seenS.add(x.s);
    tagBalance(x.s || '', tc + ' scenario' + i);
    tagBalance(x.explain || '', tc + ' scenario' + i);
  });
  ['title', 'short', 'tldr'].forEach(k => tagBalance(tree[k] || '', tc + ' ' + k));
});

/* ============ 1d. REAL LABS — app ka catalogue aur real-labs/ folder ek hi baat bolein ============ */
const labDir = path.join(DIR, 'real-labs');
const labFolders = fs.existsSync(labDir) ? fs.readdirSync(labDir).filter(f => /^\\d\\d-/.test(f)) : [];
const seenLab = new Set();
(KG.realLabs || []).forEach(l => {
  const lc = 'real lab ' + l.id;
  if (seenLab.has(l.id)) problems.push(lc + ': DUPLICATE id');
  seenLab.add(l.id);
  ['id', 'num', 'icon', 'title', 'mins', 'concept', 'decision'].forEach(k => { if (!l[k]) problems.push(lc + ': missing ' + k); });
  if (l.num && l.id.slice(0, 2) !== l.num) problems.push(lc + ': num "' + l.num + '" id se match nahi karta');
  (l.levels || []).forEach(id => { if (!KG.findLevel(id)) problems.push(lc + ': level "' + id + '" maujood nahi'); });
  (l.trees || []).forEach(id => { if (!treeIds.has(id)) problems.push(lc + ': tree "' + id + '" maujood nahi'); });
  const d = path.join(labDir, l.id);
  if (!fs.existsSync(d)) { problems.push(lc + ': real-labs/' + l.id + ' folder nahi hai'); return; }
  ['README.md', 'verify.sh', 'solution'].forEach(f => { if (!fs.existsSync(path.join(d, f))) problems.push(lc + ': ' + f + ' missing'); });
  fs.readdirSync(d).filter(f => f.endsWith('.sh')).forEach(f => {
    if (!(fs.statSync(path.join(d, f)).mode & 0o111)) problems.push(lc + ': ' + f + ' executable nahi (chmod +x)');
  });
  // app jo start/cleanup commands dikhata hai, README mein bhi wahi hon
  // (poori line match — substring se "delete ns lab04" galti se "delete ns lab04 lab04-frontend" mein mil jaata)
  const cmdOf = line => line.replace(/\\s+#.*$/, '').trim();
  const readme = fs.existsSync(path.join(d, 'README.md')) ? fs.readFileSync(path.join(d, 'README.md'), 'utf8') : '';
  const readmeCmds = new Set(readme.split('\\n').map(cmdOf));
  [l.start || 'kubectl apply -f setup.yaml', l.cleanup || ('kubectl delete ns lab' + l.num)].join('\\n').split('\\n').forEach(line => {
    const cmd = cmdOf(line);
    if (cmd && !cmd.startsWith('#') && !readmeCmds.has(cmd)) problems.push(lc + ': app ki command "' + cmd + '" README mein nahi');
  });
});
labFolders.forEach(f => { if (!seenLab.has(f)) problems.push('real-labs/' + f + ': app ke KG.realLabs mein entry nahi'); });

ctx.summary = {
  tracks: KG.tracks.map(t => t.icon + t.id + ':' + KG.levelsOf(t).length).join('  '),
  levels: nLevels, cards: nCards, stages: nStages, interviews: nLevels, missions: nTerm,
  byType: JSON.stringify(byType), visuals: Object.keys(VISUALS).length, labs: labStages.length,
  trees: nTrees, leaves: nLeaves, scenarios: nScen, realLabs: (KG.realLabs || []).length,
};
`;

const ctx = {};

const EXTRA_TESTS = `
t('terminal clone FUNCTIONS preserve karta hai (render/onSync/onInstall)', () => {
  // yeh bug asli mein hua tha: JSON clone ne saare callbacks chup-chaap gira diye the
  const stageCluster = { pods: [], releases: [], charts: { './c': {
    name: 'c', version: '1', appVersion: '1', defaults: { r: 2 },
    render: v => 'rendered r=' + v.r,
    onInstall: (sm, rel) => { sm.cluster.pods.push({ name: rel.name + '-pod', status: 'Running' }); } } },
    apps: [{ name: 'a', sync: 'OutOfSync', health: 'Missing', resources: [], history: [],
             diff: () => 'FN-DIFF', onSync: (sm, ap) => { ap.health = 'Healthy'; return true; } }] };
  const c = KG.cloneCluster(stageCluster);
  assert(typeof c.charts['./c'].render === 'function', 'chart.render bacha');
  assert(typeof c.charts['./c'].onInstall === 'function', 'chart.onInstall bacha');
  assert(typeof c.apps[0].onSync === 'function', 'app.onSync bacha');
  assert(c !== stageCluster && c.pods !== stageCluster.pods, 'data alag copy (replay fresh)');
  const sim = { cluster: c, history: [], hintsUsed: 0 };
  KG.helm(sim, 'helm install x ./c'.split(' '), () => {});
  assert(sim.cluster.pods.length === 1, 'onInstall chala (pod bana)');
  let o = []; KG.helm(sim, 'helm template ./c'.split(' '), (k, t2) => o.push(t2));
  assert(/rendered r=2/.test(o.join('')), 'render() chala');
  KG.argo(sim, 'argocd app sync a'.split(' '), () => {});
  assert(sim.cluster.apps[0].health === 'Healthy', 'onSync chala');
});
t('har mission ke callbacks clone ke baad bhi zinda hain', () => {
  let checked = 0;
  KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => {
    const ms = [...l.stages.filter(x => x.type === 'terminal'),
                ...(l.interview.questions || []).filter(q => q.terminal).map(q => q.terminal)];
    ms.forEach(m => {
      const c = KG.cloneCluster(m.cluster);
      Object.entries(m.cluster.charts || {}).forEach(([n, orig]) => {
        ['render','onInstall','onUpgrade','onRollback'].forEach(k => {
          if (orig[k] && typeof c.charts[n][k] !== 'function')
            problems.push(l.id + ': chart ' + n + '.' + k + ' clone mein kho gaya');
        });
        checked++;
      });
      (m.cluster.apps || []).forEach((orig, i) => {
        ['onSync','onRollback'].forEach(k => {
          if (orig[k] && typeof c.apps[i][k] !== 'function')
            problems.push(l.id + ': app ' + orig.name + '.' + k + ' clone mein kho gaya');
        });
        checked++;
      });
      (m.cluster.rollouts || []).forEach((orig, i) => {
        if (orig.onChange && typeof c.rollouts[i].onChange !== 'function')
          problems.push(l.id + ': rollout ' + orig.name + '.onChange clone mein kho gaya');
        checked++;
      });
    });
  }));
  assert(checked > 0, 'kuch toh check hona chahiye');
});
`;
/* ============ 2 + 3. ENGINE + SIMULATOR TESTS ============
   String.raw — taaki backslash waise ke waise rahein aur yeh block padhne layak rahe.
   (Pehle yeh ek hi line ki escaped string thi — koi padh/badal nahi sakta tha.) */
const TESTS = String.raw`
console.log('engine:');
t('SRS: due-scheduling, box advance/reset, interval cap', () => {
  KG.state = KG.defaultState();
  KG.addCard('c1', 'F', 'B', 'tag');
  assert(KG.dueCards().length === 0, 'naya card abhi due nahi');
  KG.state.dojo.c1.due = Date.now() - 1000;
  assert(KG.dueCards().length === 1, 'overdue card due hona chahiye');
  KG.reviewCard('c1', true);
  assert(KG.state.dojo.c1.box === 1 && KG.state.dojo.c1.due > Date.now() + 2.9 * KG.DAY, 'box/interval');
  KG.reviewCard('c1', false);
  assert(KG.state.dojo.c1.box === 0, 'wrong par box reset');
  for (let i = 0; i < 10; i++) KG.reviewCard('c1', true);
  assert(KG.state.dojo.c1.box === KG.SRS_INTERVALS.length - 1, 'box capped');
});
t('mistake cards dedupe + replay mode XP/cards block karta hai', () => {
  KG.state = KG.defaultState(); KG.session = null;
  KG.noteMistake('same?', 'ans'); KG.noteMistake('same?', 'ans');
  assert(Object.keys(KG.state.dojo).length === 1, 'duplicate mistake card');
  KG.state = KG.defaultState(); KG.session = { replay: true };
  KG.addXP(100); KG.noteMistake('q', 'a');
  assert(KG.state.xp === 0 && Object.keys(KG.state.dojo).length === 0, 'replay mode');
  KG.session = null;
});
t('streak: same-day once, yesterday +1, gap reset, best preserved', () => {
  KG.state = KG.defaultState();
  const ds = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  KG.touchStreak(); KG.touchStreak();
  assert(KG.state.streak.count === 1, 'same day');
  const y = new Date(); y.setDate(y.getDate() - 1); KG.state.streak.last = ds(y);
  KG.touchStreak(); assert(KG.state.streak.count === 2, 'yesterday +1');
  const g = new Date(); g.setDate(g.getDate() - 5); KG.state.streak.last = ds(g);
  KG.touchStreak();
  assert(KG.state.streak.count === 1 && KG.state.streak.best === 2, 'gap reset, best rakha');
});
t('track gating: sequential + alwaysUnlocked side-tracks', () => {
  KG.state = KG.defaultState();
  assert(KG.trackUnlocked(KG.tracks[0]), 'beginner khula');
  assert(!KG.trackUnlocked(KG.tracks[1]), 'intermediate band');
  assert(!KG.trackUnlocked(KG.tracks[2]), 'advanced band');
  KG.tracks.filter(t2 => t2.alwaysUnlocked).forEach(t2 =>
    assert(KG.trackUnlocked(t2), 'side-track ' + t2.id + ' hamesha khula'));
  KG.levelsOf(KG.tracks[0]).forEach(l => KG.state.completed.push(l.id));
  assert(KG.trackUnlocked(KG.tracks[1]), 'beginner ke baad intermediate khula');
});
t('track gating: pichle track mein naya level judne se chalu track band NAHI hota', () => {
  KG.state = KG.defaultState();
  KG.state.completed.push(KG.levelsOf(KG.tracks[1])[0].id);     // intermediate ka ek level ho chuka
  assert(KG.trackUnlocked(KG.tracks[1]), 'progress wala track khula rahe');
});
t('corrupt/purana localStorage safely handle hota hai', () => {
  store['kubegurukul-v1'] = '{not json';
  assert(KG.loadState().xp === 0, 'corrupt -> fresh');
  store['kubegurukul-v1'] = JSON.stringify({ xp: 50, completed: ['a'] });
  const s2 = KG.loadState();
  assert(s2.xp === 50 && s2.dojo && s2.streak && typeof s2.levelStarts === 'number' && s2.resume === null, 'forward-compat');
});
t('resume-anywhere: checkpoint save/get/clear + gayab level = null', () => {
  KG.state = KG.defaultState();
  const lvl = KG.levelsOf(KG.tracks[0])[1];
  KG.saveResume({ level: lvl, firstTry: 3, total: 4, replay: false }, 2);
  const r = KG.getResume();
  assert(r && r.level === lvl && r.stageIdx === 2 && r.firstTry === 3 && r.total === 4, 'resume wapas mila');
  KG.state.resume.levelId = 'aisa-koi-level-nahi';
  assert(KG.getResume() === null, 'missing level par resume null');
  KG.clearResume(); assert(KG.state.resume === null, 'clear');
});
t('missing data file se app crash nahi hota', () => {
  const saved = KG.levelSets.helm; delete KG.levelSets.helm;
  const h = KG.tracks.find(x => x.id === 'helm');
  assert(KG.levelsOf(h).length === 0 && KG.trackProgress(h).complete === false, 'khaali track');
  KG.harvestQuestions();
  KG.levelSets.helm = saved;
});

console.log('\nsimulators:');
let out = [];
const P = (k, txt) => out.push(txt);
const run = (sim, cmd) => { out = []; const toks = cmd.split(' ');
  if (toks[0] === 'helm') KG.helm(sim, toks, P);
  else KG.argo(sim, toks, P);
  return out.join('\n'); };

t('helm: install/upgrade/rollback + values precedence + get values', () => {
  const sim = { cluster: { pods: [], releases: [], repos: [], valuesFiles: { 'p.yaml': { r: 10 } },
    charts: { './a': { name: 'a', version: '0.1.0', appVersion: '1.0', defaults: { r: 1, keep: 'yes' },
      render: v => 'r=' + v.r, onUpgrade: (s, rel) => rel.values.r !== 999 } } }, history: [] };
  run(sim, 'helm install a ./a --set r=3');
  let rel = sim.cluster.releases[0];
  assert(rel.values.r === 3 && rel.values.keep === 'yes', 'defaults deep-merge + --set');
  assert(!rel.userValues.keep, 'get values sirf user-supplied dikhata hai');
  run(sim, 'helm upgrade a ./a -f p.yaml');
  assert(sim.cluster.releases[0].values.r === 10 && sim.cluster.releases[0].revision === 2, 'upgrade + --set bhool jaana');
  run(sim, 'helm rollback a 1');
  assert(sim.cluster.releases[0].revision === 3 && sim.cluster.releases[0].values.r === 3, 'rollback = naya revision');
  const o = run(sim, 'helm upgrade a ./a --set r=999 --atomic');
  assert(/automatic rollback/.test(o) && sim.cluster.releases[0].status === 'deployed', '--atomic auto-rollback');
});
t('helm: history STATUS asli jaisa — superseded / failed / rollback', () => {
  const sim = { cluster: { releases: [], repos: [], charts: { './a': { name: 'a', version: '1', appVersion: '1',
    defaults: { r: 1 }, onUpgrade: (s, rel) => rel.values.r !== 666 } } }, history: [] };
  run(sim, 'helm install a ./a');
  run(sim, 'helm upgrade a ./a --set r=2');
  let h = sim.cluster.releases[0].history.map(x => x.status).join(',');
  assert(h === 'superseded,deployed', 'upgrade ke baad purana superseded: ' + h);
  run(sim, 'helm upgrade a ./a --set r=666');
  h = sim.cluster.releases[0].history.map(x => x.status).join(',');
  assert(h === 'superseded,deployed,failed' && sim.cluster.releases[0].status === 'failed', 'failed upgrade: purana deployed rehta hai: ' + h);
  run(sim, 'helm rollback a');               // bina revision = current-1 (asli helm)
  const rel = sim.cluster.releases[0];
  h = rel.history.map(x => x.status).join(',');
  // asli helm v3.16 (kind par chala ke dekha): failed revision rollback ke baad bhi 'failed' rehta hai
  assert(rel.revision === 4 && rel.values.r === 2 && h === 'superseded,superseded,failed,deployed', 'rollback: ' + h);
  assert(/Rollback to 2/.test(rel.history[3].description), 'description');
});
t('helm: --set typing asli helm (strvals) jaisa — float string rehta hai', () => {
  const sim = { cluster: { releases: [], repos: [], charts: { './a': { name: 'a', version: '1', appVersion: '1', defaults: {} } } }, history: [] };
  run(sim, 'helm install a ./a --set image.tag=2.0 --set n=007 --set r=3 --set on=TRUE --set s=10,t.u=x --set-string v=5 --set q="1.10"');
  const v = sim.cluster.releases[0].values;
  assert(v.image.tag === '2.0', 'float -> string: ' + typeof v.image.tag);
  assert(v.n === '007' && v.r === 3 && v.on === true && v.v === '5' && v.q === '1.10', 'types: ' + JSON.stringify(v));
  assert(v.s === 10 && v.t.u === 'x', 'comma-separated --set');
  assert(/tag: "2.0"/.test(run(sim, 'helm get values a')), 'get values string ko quote karta hai');
});
t('helm: arg-less commands crash nahi karte + template NAME CHART', () => {
  const sim = { cluster: { releases: [], repos: [], charts: { './shop': { name: 'shop', version: '1', appVersion: '1', defaults: { r: 1 }, render: (v, rel) => 'name=' + rel.name } } }, history: [] };
  ['helm template', 'helm lint x', 'helm show values', 'helm package', 'helm diff upgrade', 'helm upgrade', 'helm dependency list']
    .forEach(c => run(sim, c));                // throw na ho, bas
  assert(/name=myrel/.test(run(sim, 'helm template myrel ./shop')), 'template NAME CHART');
  assert(/name=release-name/.test(run(sim, 'helm template ./shop')), 'template CHART');
  run(sim, 'helm install shop ./shop');
  assert(/requires 2 arguments/.test(run(sim, 'helm upgrade shop')), 'upgrade bina chart = asli error');
  assert(/failed to download/.test(run(sim, 'helm upgrade shop ./galat')), 'galat chart par silent fallback nahi');
});
t('helm: stuck release block karta hai jab tak rollback na ho', () => {
  const sim = { cluster: { releases: [], repos: [], charts: { './a': { name: 'a', version: '1', appVersion: '1', defaults: {} } } }, history: [] };
  run(sim, 'helm install a ./a');
  sim.cluster.releases[0].status = 'pending-upgrade';
  assert(/another operation/.test(run(sim, 'helm upgrade a ./a')), 'blocked');
  run(sim, 'helm rollback a 1');
  assert(/has been upgraded/.test(run(sim, 'helm upgrade a ./a')), 'rollback ke baad chalta hai');
});
t('argocd: list/get/diff/sync + prune — bina prune app OutOfSync hi rehta hai', () => {
  const sim = { cluster: { services: [], apps: [{
    name: 'x', sync: 'OutOfSync', health: 'Missing', destNamespace: 'default',
    resources: [{ kind: 'Deployment', name: 'd', status: 'OutOfSync', health: 'Missing' },
                { kind: 'Service', name: 'old', status: 'OutOfSync', pruneMe: true }],
    diff: 'DIFF-TEXT', history: [], onSync: () => true }] }, history: [] };
  assert(/OutOfSync/.test(run(sim, 'argocd app list')), 'list');
  assert(/Sync Status/.test(run(sim, 'argocd app get x')), 'get');
  assert(/DIFF-TEXT/.test(run(sim, 'argocd app diff x')), 'diff');
  const o = run(sim, 'argocd app sync x');
  assert(sim.cluster.apps[0].sync === 'OutOfSync', 'asli ArgoCD: requires-pruning resource ke saath app OutOfSync rehta hai');
  assert(/NAHI hatega/.test(o) && sim.cluster.apps[0].resources.some(r => r.pruneMe && !r.pruned), 'bina --prune ke prune nahi');
  assert(/requires pruning/.test(run(sim, 'argocd app get x')), 'get mein requires pruning dikhe');
  run(sim, 'argocd app sync x --prune');
  assert(sim.cluster.apps[0].sync === 'Synced' && !sim.cluster.apps[0].resources.some(r => r.pruneMe), '--prune ke baad Synced');
  assert(/koi diff nahi/.test(run(sim, 'argocd app diff x')), 'Synced par diff khaali');
});
t('argocd: failed sync, selfHeal ke saath rollback block, app set', () => {
  const sim = { cluster: { apps: [{ name: 'y', sync: 'OutOfSync', health: 'Healthy', resources: [],
    history: [{ id: 1, revision: 'r1', deployedAt: 'd' }], syncError: 'boom', onSync: () => false }] }, history: [] };
  const o = run(sim, 'argocd app sync y');
  assert(/FAILED/.test(o) && sim.cluster.apps[0].health === 'Degraded', 'sync fail');
  run(sim, 'argocd app set y --sync-policy automated --self-heal');
  assert(sim.cluster.apps[0].syncPolicy.automated.selfHeal === true, 'set policy');
  assert(/git revert/.test(run(sim, 'argocd app rollback y 1')), 'selfHeal par rollback guidance');
});
t('rollouts: get/promote/abort/retry + naam ki parsing (flags, galat naam)', () => {
  const sim = { cluster: { pods: [], rollouts: [{ name: 'r', strategy: 'canary', status: 'Paused',
    step: 1, weight: 10, steps: ['setWeight: 10', 'pause: {}', 'setWeight: 50', 'setWeight: 100'] }] }, history: [] };
  assert(/Paused/.test(run(sim, 'kubectl argo rollouts get rollout r -n default')), 'get (with -n)');
  run(sim, 'kubectl argo rollouts promote r');
  assert(sim.cluster.rollouts[0].step === 2, 'promote step++');
  assert(/not found/.test(run(sim, 'kubectl argo rollouts promote galat')), 'galat naam = NotFound (pehle ros[0] chupke se chal jaata tha)');
  run(sim, 'kubectl argo rollouts abort r');
  assert(sim.cluster.rollouts[0].aborted && sim.cluster.rollouts[0].weight === 0, 'abort -> 0%');
  run(sim, 'kubectl argo rollouts retry rollout r');
  assert(!sim.cluster.rollouts[0].aborted && sim.cluster.rollouts[0].weight === 10, 'retry -> step 1');
});
t('karpenter: Pending pod -> NodeClaim -> Node -> pod Running', () => {
  const sim = { cluster: {
    karpenter: { enabled: true, tick: 0, log: [] },
    nodes: [], nodeclaims: [], events: [],
    pods: [{ name: 'p', status: 'Pending', ready: '0/1', requests: { cpu: '3', memory: '6Gi' } }],
    nodepools: [{ name: 'default', requirements: [
      { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot'] },
      { key: 'karpenter.k8s.aws/instance-category', operator: 'In', values: ['c', 'm'] }],
      limits: { cpu: 100 }, used: { cpu: 0 }, disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized' } }],
    ec2nodeclasses: [{ name: 'default' }] } };
  KG.karpenter.reconcile(sim);
  assert(sim.cluster.nodeclaims.length === 1, 'NodeClaim bana');
  assert(sim.cluster.nodeclaims[0].capacity === 'spot', 'spot chuna');
  assert(sim.cluster.nodeclaims[0].cpu >= 3, 'fit karne wala type');
  assert(sim.cluster.pods[0].status === 'Pending', 'abhi bhi Pending (node aa raha hai)');
  KG.karpenter.reconcile(sim);
  assert(sim.cluster.nodes.length === 1 && sim.cluster.pods[0].status === 'Running', 'node ready -> pod Running');
});
t('karpenter: limits, no-match, aur "koi type fit nahi" — teeno alag Events', () => {
  const base = () => ({ cluster: { karpenter: { enabled: true, tick: 0, log: [] }, nodes: [], nodeclaims: [], events: [],
    pods: [], nodepools: [], ec2nodeclasses: [] } });
  let s = base(); s.cluster.pods = [{ name: 'a', status: 'Pending', requests: { cpu: '1' } }];
  KG.karpenter.reconcile(s);
  assert(s.cluster.pods[0].unschedulable && /NodePool/.test(s.cluster.pods[0].describe), 'no nodepool');
  s = base();
  s.cluster.nodepools = [{ name: 'd', requirements: [], limits: { cpu: 2 }, used: { cpu: 2 }, disruption: {} }];
  s.cluster.pods = [{ name: 'b', status: 'Pending', requests: { cpu: '2' } }];
  KG.karpenter.reconcile(s);
  assert(/limit/i.test(s.cluster.pods[0].describe), 'limit reached');
  s = base();
  s.cluster.nodepools = [{ name: 'd', requirements: [], limits: { cpu: 1000 }, used: { cpu: 0 }, disruption: {} }];
  s.cluster.pods = [{ name: 'c', status: 'Pending', requests: { cpu: '64', memory: '512Gi' } }];
  KG.karpenter.reconcile(s);
  assert(/instance type/i.test(s.cluster.pods[0].describe), 'no instance type');
});
t('karpenter: consolidation khaali node hataata hai, do-not-disrupt rokta hai, NodePool used ghatta hai', () => {
  const mk = (dnd) => ({ cluster: { karpenter: { enabled: true, tick: 5, log: [] }, events: [],
    nodes: [{ name: 'n1', karpenter: true, nodepool: 'd', cpu: 4, mem: 8, usedCpu: 0, usedMem: 0 }],
    nodeclaims: [{ name: 'nc1', nodeName: 'n1', ready: 'True' }],
    pods: dnd ? [{ name: 'p', status: 'Running', node: 'n1', doNotDisrupt: true, requests: { cpu: '1' } }] : [],
    nodepools: [{ name: 'd', requirements: [], limits: { cpu: 100 }, used: { cpu: 4 },
      disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized' } }], ec2nodeclasses: [] } });
  let s = mk(false); KG.karpenter.reconcile(s);
  assert(s.cluster.nodes.length === 0, 'khaali node hata');
  assert(s.cluster.nodepools[0].used.cpu === 0, 'NodePool used.cpu bhi kam hua (warna limit jhooth-mooth bharti)');
  s = mk(true); s.cluster.nodes[0].usedCpu = 1; KG.karpenter.reconcile(s);
  assert(s.cluster.nodes.length === 1, 'do-not-disrupt ne bachaya');
});
t('karpenter: kubectl delete pod ke baad node ki capacity wapas milti hai', () => {
  const sim = { cluster: { karpenter: { enabled: true, tick: 5, log: [] }, events: [], nodeclaims: [],
    nodes: [{ name: 'n1', karpenter: true, nodepool: 'd', cpu: 4, mem: 8, usedCpu: 3, usedMem: 6 }],
    pods: [{ name: 'big', status: 'Running', node: 'n1', requests: { cpu: '3', memory: '6Gi' } },
           { name: 'x', status: 'Running', node: 'n1', requests: { cpu: '0.5', memory: '1Gi' } }],
    nodepools: [{ name: 'd', requirements: [], limits: { cpu: 100 }, used: { cpu: 4 }, disruption: {} }], ec2nodeclasses: [] } };
  KG.karpenter.reconcile(sim);                      // pehli baar: maujooda pods ka hisaab
  sim.cluster.pods = sim.cluster.pods.filter(p => p.name !== 'big');   // kubectl delete pod big
  sim.cluster.pods.push({ name: 'new', status: 'Pending', requests: { cpu: '2', memory: '2Gi' } });
  KG.karpenter.reconcile(sim);
  assert(sim.cluster.pods.find(p => p.name === 'new').node === 'n1', 'chhoda hua space naye pod ko mila');
  assert(sim.cluster.nodeclaims.length === 0, 'faltu naya node launch nahi hua');
});
const karpTest = () => ({ history: [], cluster: {
  karpenter: { enabled: true, tick: 0, log: [], consolidate: false },
  nodes: [], nodeclaims: [], events: [], ec2nodeclasses: [{ name: 'default' }],
  pods: [{ name: 'test', status: 'Pending', ready: '0/1', describe: 'Status: Pending', requests: { cpu: '1', memory: '1Gi' } }],
  nodepools: [{ name: 'default', weight: 10, requirements: [], limits: { cpu: 100 }, used: { cpu: 0 }, disruption: {} }],
} });
t('karpenter: requirement operators aur exact instance labels', () => {
  const cases = [
    ['karpenter.k8s.aws/instance-category', 'In', ['g'], 'g5.xlarge'],
    ['karpenter.k8s.aws/instance-generation', 'Gt', ['6'], 'm7g.xlarge'],
    ['karpenter.k8s.aws/instance-generation', 'Lt', ['6'], 'g5.xlarge'],
    ['karpenter.k8s.aws/instance-family', 'In', ['m6a'], 'm6a.large'],
    ['karpenter.k8s.aws/instance-family', 'In', ['m6'], null],
    ['karpenter.k8s.aws/instance-family', 'NotIn', ['c6a', 'm6a', 'r6a'], 'm7g.xlarge'],
    ['karpenter.k8s.aws/instance-size', 'In', ['2xlarge'], 'c6a.2xlarge'],
    ['karpenter.k8s.aws/instance-cpu', 'Gt', ['4'], 'c6a.2xlarge'],
    ['karpenter.k8s.aws/instance-gpu-count', 'Gt', ['0'], 'g5.xlarge'],
    ['karpenter.k8s.aws/instance-gpu-manufacturer', 'Exists', [], 'g5.xlarge'],
    ['karpenter.k8s.aws/instance-gpu-manufacturer', 'DoesNotExist', [], 'c6a.large'],
    ['karpenter.k8s.aws/instance-gpu-manufacturer', 'NotIn', ['nvidia'], 'c6a.large'],
    ['karpenter.k8s.aws/instance-category', 'Exists', [], 'c6a.large'],
    ['karpenter.k8s.aws/instance-size', 'DoesNotExist', [], null],
    ['node.kubernetes.io/instance-type', 'In', ['m6a.xlarge'], 'm6a.xlarge'],
    ['kubernetes.io/arch', 'In', ['arm64'], 'm7g.xlarge'],
  ];
  cases.forEach(([key, operator, values, expected]) => {
    const s = karpTest(); s.cluster.nodepools[0].requirements = [{ key, operator, values }];
    KG.karpenter.reconcile(s);
    assert((s.cluster.nodeclaims[0] || {}).type === (expected || undefined), key + ' ' + operator);
    if (!expected) assert(s.cluster.pods[0].unschedulable, 'incompatible requirement stays Pending');
  });
});
t('karpenter: weighted fallback, all-pool reasons, zero limits aur toleration effects', () => {
  let s = karpTest();
  s.cluster.nodepools.unshift({ name: 'high', weight: 100, requirements: [], limits: { cpu: 0 }, used: { cpu: 0 } });
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims[0].nodepool === 'default', 'higher-weight zero limit must fall back');
  s = karpTest();
  s.cluster.nodepools.unshift({ name: 'gpu', weight: 100, requirements: [], taints: [{ key: 'nvidia.com/gpu', value: 'true', effect: 'NoSchedule' }] });
  s.cluster.nodepools[1].limits.cpu = 0;
  s.cluster.pods[0].tolerations = [{ key: 'nvidia.com/gpu', operator: 'Exists', effect: 'NoExecute' }];
  KG.karpenter.reconcile(s);
  const message = s.cluster.pods[0].describe;
  assert(message.includes('did not tolerate nvidia.com/gpu=true:NoSchedule') && message.includes('exceed limits for nodepool: "default"'), message);
  assert(message.includes('; ') && !message.includes('FailedProvisioning'), 'one reason per failed pool');
  s.cluster.pods[0].tolerations[0].effect = 'NoSchedule';
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims[0].nodepool === 'gpu', 'Exists with matching effect tolerates taint');
  s = karpTest();
  s.cluster.nodepools[0].requirements = [{ key: 'kubernetes.io/arch', operator: 'In', values: ['amd64'] }];
  s.cluster.nodepools.push({ name: 'arm', weight: 1, requirements: [] });
  s.cluster.pods[0].nodeSelector = { 'kubernetes.io/arch': 'arm64' };
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims[0].nodepool === 'arm' && s.cluster.nodeclaims[0].type === 'm7g.xlarge', 'selector intersects pool requirements');
});
t('karpenter: GPU fit, overhead aur released GPU reuse', () => {
  const s = karpTest();
  s.cluster.pods[0].requests = { cpu: '4', memory: '16Gi', 'nvidia.com/gpu': '1' };
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims[0].type === 'g5.2xlarge', '4CPU/16Gi plus overhead cannot fit g5.xlarge');
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodes[0].usedGpu === 1 && s.cluster.nodes[0].usedCpu > 4, 'GPU and DaemonSet usage accounted');
  s.cluster.pods = [{ name: 'replacement', status: 'Pending', requests: { cpu: '4', memory: '16Gi', 'nvidia.com/gpu': '1' } }];
  KG.karpenter.reconcile(s);
  assert(s.cluster.pods[0].status === 'Running' && s.cluster.nodes[0].usedGpu === 1, 'deleted pod releases GPU');
  assert(s.cluster.nodeclaims.length === 1, 'reuse freed GPU, no new node');
  s.cluster.pods.push({ name: 'second', status: 'Pending', requests: { cpu: '1', memory: '1Gi', 'nvidia.com/gpu': '1' } });
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims.length === 2, 'one physical GPU cannot serve two requested GPUs');
});
t('karpenter: changed waiting GPU request is rechecked before assignment', () => {
  const s = karpTest(); s.cluster.karpenter.launchTicks = 4;
  s.cluster.pods[0].requests['nvidia.com/gpu'] = '1';
  KG.karpenter.reconcile(s);
  s.cluster.pods[0].requests['nvidia.com/gpu'] = '2';
  for (let i = 0; i < 4; i++) KG.karpenter.reconcile(s);
  assert(s.cluster.pods[0].status === 'Pending' && s.cluster.pods[0].unschedulable, 'no 2-GPU type available');
  assert(s.cluster.nodes[0].usedGpu === 0, '1-GPU node was not overbooked');
});
t('karpenter: launch delay keeps NODE blank; Running describe aur observation index fresh', () => {
  const s = karpTest(); s.cluster.karpenter.launchTicks = 4;
  s.history.push('kubectl get pods'); KG.karpenter.reconcile(s);
  const nc = s.cluster.nodeclaims[0];
  assert(KG.karpenter.tables(s).nodeclaims.rows[0][4] === '', 'Unknown claim has no NODE');
  assert(KG.karpenter.toYaml(s, 'nodeclaims', nc).includes('nodeName: ""'), 'Unknown claim yaml has no nodeName');
  assert(/Nominated.*karpenter/.test(s.cluster.pods[0].describe), 'nomination event');
  for (let i = 0; i < 3; i++) { s.history.push('kubectl get nodeclaims'); KG.karpenter.reconcile(s); }
  assert(nc.ready === 'Unknown' && s.cluster.pods[0].status === 'Pending', 'three elapsed ticks not enough');
  s.history.push('kubectl get nodes'); KG.karpenter.reconcile(s);
  const p = s.cluster.pods[0];
  assert(nc.ready === 'True' && p.runningAt === 5, 'Ready at bornTick+4');
  assert(/Status:\s+Running/.test(p.describe) && /Scheduled  default-scheduler/.test(p.describe), p.describe);
});
t('karpenter: consolidation delay really exposes Spark loss; annotation protects progress', () => {
  const level = KG.findLevel('karpenterdisrupt');
  const mission = level.stages.find(s => s.type === 'terminal');
  const run = protect => {
    const s = { history: [], cluster: KG.cloneCluster(mission.cluster) };
    if (protect) s.cluster.pods.find(p => p.name.startsWith('spark')).doNotDisrupt = true;
    for (let i = 0; i < 5; i++) KG.karpenter.reconcile(s);
    assert(s.cluster.nodes.length === 3, 'five stable reconciles leave time to protect job');
    KG.karpenter.reconcile(s); return s;
  };
  const lost = run(false), saved = run(true);
  assert(lost.cluster.pods.find(p => p.name.startsWith('spark')).logs.includes('partition 0'), 'unprotected job actually restarts');
  assert(saved.cluster.pods.find(p => p.name.startsWith('spark')).logs.includes('340/900'), 'protected progress survives');
  assert(saved.cluster.nodes.length < 3, 'protection still permits other consolidation');
});
t('karpenter: GPU workload cannot consolidate onto CPU-only node', () => {
  const s = karpTest(); s.cluster.karpenter.consolidate = true;
  s.cluster.nodepools[0].disruption = { consolidationPolicy: 'WhenEmptyOrUnderutilized' };
  s.cluster.nodes = [
    { name: 'gpu', karpenter: true, nodepool: 'default', instanceType: 'g5.2xlarge', cpu: 8, mem: 32, gpu: 1, usedCpu: 1, usedMem: 1, usedGpu: 1 },
    { name: 'cpu', karpenter: true, nodepool: 'default', instanceType: 'm6a.2xlarge', cpu: 8, mem: 32, gpu: 0, usedCpu: 4, usedMem: 1 },
  ];
  s.cluster.pods = [
    { name: 'trainer', status: 'Running', node: 'gpu', requests: { cpu: '1', memory: '1Gi', 'nvidia.com/gpu': '1' } },
    { name: 'web', status: 'Running', node: 'cpu', requests: { cpu: '4', memory: '1Gi' } },
  ];
  KG.karpenter.reconcile(s);
  assert(s.cluster.pods[0].node === 'gpu' && s.cluster.nodes.length === 2, 'CPU capacity alone is insufficient');
});
t('karpenter: existing memory counts towards pool limit; NodeClaim names survive node deletion', () => {
  const s = karpTest();
  s.cluster.nodes = [{ name: 'ip-10-0-20-4.ap-south-1.compute.internal', nodepool: 'default', karpenter: true,
    cpu: 2, mem: 8, usedCpu: 2, usedMem: 8 }];
  s.cluster.nodepools[0].limits.memory = '8Gi';
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims.length === 0 && /exceed limits/.test(s.cluster.pods[0].describe), 'existing node exhausts pool memory');
  s.cluster.nodepools[0].limits.memory = '100Gi';
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims[0].nodeName !== s.cluster.nodes[0].name, 'initial fixture name cannot collide');
  const first = s.cluster.nodeclaims[0].nodeName;
  KG.karpenter.reconcile(s);
  s.cluster.nodes = s.cluster.nodes.filter(n => n.name !== first);
  s.cluster.nodeclaims = [];
  s.cluster.pods.push({ name: 'new', status: 'Pending', requests: { cpu: '4', memory: '16Gi' } });
  KG.karpenter.reconcile(s);
  assert(s.cluster.nodeclaims[0].nodeName !== first, 'subsequent claim does not reuse a deleted node name');
});
t('karpenter: cost calculator spot/on-demand sahi ginta hai', () => {
  const sim = { cluster: { nodes: [
    { karpenter: true, instanceType: 'c6a.xlarge', capacityType: 'spot' },
    { karpenter: true, instanceType: 'c6a.xlarge', capacityType: 'on-demand' }] } };
  const c = KG.karpenter.cost(sim);
  assert(c.nodes === 2 && c.hourly > 0 && c.monthly > c.hourly, 'cost math');
  const spotOnly = KG.karpenter.cost({ cluster: { nodes: [{ karpenter: true, instanceType: 'c6a.xlarge', capacityType: 'spot' }] } });
  const odOnly = KG.karpenter.cost({ cluster: { nodes: [{ karpenter: true, instanceType: 'c6a.xlarge', capacityType: 'on-demand' }] } });
  assert(spotOnly.hourly < odOnly.hourly, 'spot sasta hai');
});

/* kubectl terminal — asli renderer headless chala ke (input Enter dabake) */
function term(cluster, extra) {
  const arena = document.createElement('div');
  let done = null;
  const st = Object.assign({ goal: 'g', cluster, success: () => false }, extra || {});
  KG.renderers.terminal(st, arena, r => { done = r; });
  const termEl = arena.children[1];
  const input = termEl.querySelector('input'), outEl = termEl.querySelector('.term-out');
  return {
    run(cmd) { const before = outEl.children.length; input.value = cmd; input.fire('keydown', { key: 'Enter' });
               return outEl.children.slice(before).filter(c => !c.classList.contains('t-cmd')).map(c => c.textContent).join('\n'); },
    get done() { return done; }, get won() { return arena.children.some(c => c.classList && c.classList.contains('stage-summary')); }, st, outEl,
  };
}
console.log('\ndecision dojo + real labs (asli screens, headless):');
const findAll = (root, cls) => walk(root).filter(x => x.classList && x.classList.contains(cls));
const leafIds = tree => Object.keys(tree.nodes).filter(id => tree.nodes[id].leaf);
t('decision trees: har recommendation tak sawal-dar-sawal click karke pahunch sakte hain', () => {
  KG.state = KG.defaultState(); KG.session = null;
  let n = 0;
  KG.decisions.forEach(tree => {
    leafIds(tree).forEach(leafId => {
      showDecisionTree(tree);
      const route = KG.decisionPath(tree, leafId);
      assert(route.length, tree.id + '/' + leafId + ': start se raasta nahi');
      route.forEach(step => {
        const b = findAll(appEl, 'dd-opt').find(o => o.innerHTML === step.a);
        assert(b, tree.id + ': option "' + step.a + '" screen par nahi');
        b.click();
      });
      const leaf = findAll(appEl, 'dd-leaf')[0];
      assert(leaf && leaf.innerHTML.includes(tree.nodes[leafId].pick), tree.id + '/' + leafId + ': recommendation card nahi dikha');
      n++;
    });
    assert(KG.state.decisions[tree.id].seen.length === leafIds(tree).length, tree.id + ': "dekhe" ginti galat');
    // map: saari recommendations dikhni chahiye
    showDecisionTree(tree);
    findAll(appEl, 'btn').find(b => /Poora map/.test(b.innerHTML)).click();
    const map = findAll(appEl, 'dd-map')[0];
    assert(map, tree.id + ': map nahi khula');
    leafIds(tree).forEach(id => assert(map.innerHTML.includes(tree.nodes[id].pick), tree.id + ': map mein "' + tree.nodes[id].pick + '" nahi'));
    // undo: ek sawal peeche
    const first = findAll(appEl, 'dd-opt')[0]; first.click();
    findAll(appEl, 'btn').find(b => /peeche/.test(b.innerHTML)).click();
    assert(findAll(appEl, 'dd-step').length === 0, tree.id + ': undo ke baad trail khaali honi chahiye');
  });
  assert(n === KG.decisions.reduce((a, tr) => a + leafIds(tr).length, 0), 'saari leaves walk hui');
});
function playPractice(tree, wrongFirst) {
  showDecisionPractice(tree);
  let guard = 0, total = 0;
  while (!findAll(appEl, 'stage-summary').length && guard++ < 100) {
    const scEl = findAll(appEl, 'dd-scenario')[0];
    assert(scEl, 'scenario dikha nahi');
    const pool = tree ? [tree] : KG.decisions;
    let hit = null;
    pool.forEach(tr => (tr.scenarios || []).forEach(x => { if (scEl.innerHTML === '🏭 ' + x.s) hit = { tr, x }; }));
    assert(hit, 'scenario data mein nahi mila');
    const leaf = hit.tr.nodes[hit.x.answer];
    const choices = findAll(appEl, 'choice');
    assert(choices.length >= 2 && choices.length <= 5, 'options 2-5 hone chahiye, mile ' + choices.length);
    const right = choices.find(c => c.innerHTML === (leaf.icon || '🎯') + ' ' + leaf.pick);
    assert(right, hit.tr.id + ': sahi jawab "' + leaf.pick + '" options mein hi nahi!');
    if (wrongFirst) choices.find(c => c !== right).click();
    right.click();
    total++;
    findAll(appEl, 'btn').filter(b => /Agla scenario|Score dekho/.test(b.innerHTML)).pop().click();
  }
  return total;
}
t('decision practice: sahi jawab hamesha options mein (max 5), score/XP/best sahi', () => {
  KG.state = KG.defaultState(); KG.session = null;
  KG.decisions.forEach(tree => {
    for (let rep = 0; rep < 3; rep++) {          // random distractors — 3 baar khelo
      const total = playPractice(tree, false);
      assert(total === tree.scenarios.length, tree.id + ': saare scenarios nahi aaye');
      assert(KG.state.decisions[tree.id].best === total, tree.id + ': best score ' + KG.state.decisions[tree.id].best);
    }
  });
  const xp = KG.state.xp;
  assert(xp === KG.decisions.reduce((a, tr) => a + tr.scenarios.length, 0) * KG.XP_PER_ITEM, 'XP sirf pehli baar: ' + xp);
  assert(playPractice(null, false) === 8, 'mixed practice = 8 scenarios');
});
t('decision practice: galat jawab → mistake card + score nahi', () => {
  KG.state = KG.defaultState(); KG.session = null;
  const tree = KG.decisions[0];
  playPractice(tree, true);
  assert(KG.state.decisions[tree.id].best === 0, 'galti ke baad bhi score mila');
  assert(Object.keys(KG.state.dojo).length === tree.scenarios.length, 'har galti ka Revision card bana: ' + Object.keys(KG.state.dojo).length);
});
t('real labs: catalogue + har lab ka screen + "ho gaya" XP sirf ek baar', () => {
  KG.state = KG.defaultState(); KG.session = null;
  showRealLabs();
  assert(findAll(appEl, 'rl-card').length === KG.realLabs.length, 'har lab ka card');
  KG.realLabs.forEach(lab => {
    showRealLab(lab);
    assert(findAll(appEl, 'rl-cmd').length === 3, lab.id + ': start/check/cleanup blocks');
  });
  const lab = KG.realLabs[0];
  showRealLab(lab);
  const markBtn = () => findAll(appEl, 'btn').find(b => /ho gaya/i.test(b.innerHTML) && /big/.test(b.className));
  markBtn().click();
  const xp1 = KG.state.xp;
  assert(KG.state.realLabsDone.includes(lab.id) && xp1 === KG.TERMINAL_XP, 'done + XP');
  markBtn().click(); markBtn().click();                // undo + phir done
  assert(KG.state.xp === xp1 && KG.state.realLabsDone.includes(lab.id), 'toggle se XP farm nahi');
});
t('home: mood picker ke teeno button + level intro ka "kab use karein" box', () => {
  KG.state = KG.defaultState(); KG.session = null;
  showHome();
  const moods = findAll(appEl, 'mood-btn');
  assert(moods.length === 3, 'mood buttons: ' + moods.length);
  moods[0].click();
  assert(findAll(appEl, 'dd-scenario').length === 1, '🐢 (koi card due nahi) → decision practice');
  showHome(); findAll(appEl, 'mood-btn')[1].click();
  assert(findAll(appEl, 'lesson-card').length > 0, '🎯 → agla level intro');
  showHome(); findAll(appEl, 'mood-btn')[2].click();
  assert(findAll(appEl, 'rl-cmd').length === 3, '🔥 → pehla real lab');
  showHome(); findAll(appEl, 'featcard').forEach(c => { c.click(); showHome(); });
  let boxes = 0;
  KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => {
    if (!KG.decisionsForLevel(l.id).length && !KG.realLabsForLevel(l.id).length) return;
    showIntro(l);
    assert(findAll(appEl, 'kab-box').length === 1, l.id + ': kab-box nahi dikha');
    boxes++;
  }));
  assert(boxes > 10, 'kab-box levels: ' + boxes);
  KG.state = KG.defaultState();
});
t('helm 4: --rollback-on-failure = --atomic (warning ke saath), --recreate-pods hata, version v4', () => {
  const mk = () => ({ cluster: { releases: [], repos: [], charts: { './a': { name: 'a', version: '1', appVersion: '1',
    defaults: { r: 1 }, onUpgrade: (s2, rel) => rel.values.r !== 666 } } }, history: [] });
  let sim = mk();
  run(sim, 'helm install a ./a');
  let o = run(sim, 'helm upgrade a ./a --set r=666 --rollback-on-failure');
  assert(/rolled back due to rollback-on-failure/.test(o) && sim.cluster.releases[0].status === 'deployed', 'naya flag: ' + o);
  assert(!/deprecated/.test(o), 'naye flag par warning nahi');
  sim = mk(); run(sim, 'helm install a ./a');
  o = run(sim, 'helm upgrade a ./a --set r=666 --atomic');
  assert(/Flag --atomic has been deprecated, use --rollback-on-failure instead/.test(o), 'purana flag warning: ' + o);
  assert(sim.cluster.releases[0].status === 'deployed', 'purana flag bhi rollback karta hai');
  assert(/unknown flag: --recreate-pods/.test(run(sim, 'helm upgrade a ./a --recreate-pods')), 'recreate-pods hata');
  assert(/use --force-replace/.test(run(sim, 'helm upgrade a ./a --force')), 'force rename');
  assert(/v4\./.test(run(sim, 'helm version')), 'version');
});
t('karpenter kubectl: asli columns, -o wide, -o yaml (v1 fields), describe, -L labels, top nodes', () => {
  const T = term({ karpenter: { enabled: true, tick: 0, log: [] }, events: [], nodeclaims: [],
    nodes: [{ name: 'ip-1', status: 'Ready', roles: '<none>', age: '1h', version: 'v1.30.2', karpenter: true, nodepool: 'default',
              instanceType: 'c6a.xlarge', capacityType: 'spot', zone: 'ap-south-1a', cpu: 4, mem: 8, usedCpu: 0, usedMem: 0 }],
    pods: [{ name: 'p', status: 'Running', ready: '1/1', restarts: 0, age: '1m', node: 'ip-1', requests: { cpu: '1' } }],
    nodepools: [{ name: 'default', weight: 10, nodeClassRef: 'default', limits: { cpu: 100 }, used: { cpu: 4 },
      requirements: [{ key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot', 'on-demand'] }],
      disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized', consolidateAfter: '1m' } }],
    ec2nodeclasses: [{ name: 'default', amiFamily: 'AL2023', role: 'KarpenterNodeRole-prod' }] });
  let o = T.run('kubectl get nodepools');
  assert(/^NAME\s+NODECLASS\s+NODES\s+READY\s+AGE$/m.test(o) && /default\s+default\s+1\s+True/.test(o), 'nodepools: ' + o);
  assert(/WEIGHT\s+CPU\s+MEMORY/.test(T.run('kubectl get nodepools -o wide')), 'wide');
  o = T.run('kubectl get nodepool default -o yaml');
  assert(/group: karpenter\.k8s\.aws/.test(o) && /consolidateAfter: 1m/.test(o) && /kind: NodePool/.test(o), 'yaml: ' + o);
  assert(/Consolidation Policy:\s+WhenEmptyOrUnderutilized/.test(T.run('kubectl describe nodepool default')), 'describe');
  assert(/^NAME\s+READY\s+AGE$/m.test(T.run('kubectl get ec2nodeclasses')), 'ec2nodeclasses columns');
  o = T.run('kubectl get nodes -L karpenter.sh/capacity-type -L node.kubernetes.io/instance-type');
  assert(/CAPACITY-TYPE\s+INSTANCE-TYPE/.test(o) && /spot\s+c6a\.xlarge/.test(o), '-L: ' + o);
  assert(!/INSTANCE-TYPE/.test(T.run('kubectl get nodes')), 'default get nodes = asli columns');
  assert(/CPU\(cores\)\s+CPU\(%\)\s+MEMORY\(bytes\)\s+MEMORY\(%\)/.test(T.run('kubectl top nodes')), 'top header');
  assert(/sirf Karpenter/.test(T.run('kubectl get pods -o yaml')), '-o yaml baaki kinds par saaf note');
});
t('content: <pre> mein "\\ # comment" nahi (bash line-continuation tootti hai)', () => {
  const bad = [];
  const scan = (v, where) => {
    if (typeof v === 'string') { if (/\\[ \t]+#/.test(v) && /<pre|\n/.test(v)) bad.push(where); }
    else if (Array.isArray(v)) v.forEach((x, i) => scan(x, where + '[' + i + ']'));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => { if (typeof v[k] !== 'function') scan(v[k], where + '.' + k); });
  };
  KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => scan(l, l.id)));
  KG.decisions.forEach(tr => scan(tr, 'decision ' + tr.id));
  assert(!bad.length, 'yahan backslash ke baad comment hai: ' + bad.slice(0, 5).join(', '));
});
t('content: HTML fields mein raw <placeholder> nahi (browser use tag samajh ke GAYAB kar deta hai)', () => {
  // in fields ko engine text ki tarah dikhata hai (textContent/escapeHtml) — wahan <pod> theek hai
  const TEXT_FIELDS = new Set(['cluster', 'files', 'responses', 'hints', 'template', 'out', 'yaml', 'start', 'cleanup', 'tokens']);
  const OK = new Set('a abbr b br code details div em h1 h2 h3 h4 h5 i img kbd li ol p pre s small span strong sub summary sup table tbody td th thead tr u ul svg path rect circle line text g polyline polygon defs marker tspan ellipse title style section label button input'.split(' '));
  const bad = [];
  const scan = (v, where) => {
    if (typeof v === 'string') {
      const re = /<\/?([a-zA-Z][a-zA-Z0-9_.:-]*)[^<>]*>/g; let m;
      while ((m = re.exec(v))) if (!OK.has(m[1].toLowerCase())) bad.push(where + ' ' + m[0]);
    } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, where + '[' + i + ']'));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => { if (typeof v[k] !== 'function' && !TEXT_FIELDS.has(k)) scan(v[k], where + '.' + k); });
  };
  KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => scan(l, l.id)));
  KG.decisions.forEach(tr => scan(tr, 'decision ' + tr.id));
  scan(KG.realLabs, 'realLabs');
  assert(!bad.length, bad.length + ' jagah — &lt;naam&gt; likho: ' + bad.slice(0, 6).join(' | '));
});
t('terminal: k alias scripted responses + history tak pahunchta hai', () => {
  let hit = 0;
  const T = term({ pods: [] }, { responses: [{ re: /^kubectl rollout undo deploy\/web$/, out: 'rolled back', mutate: () => { hit++; } }] });
  assert(/rolled back/.test(T.run('k rollout undo deploy/web')) && hit === 1, 'k -> kubectl');
});
t('terminal: pipes, && chain, get <name>, comma kinds, PVC capacity', () => {
  const T = term({ pods: [{ name: 'web-1', ready: '1/1', status: 'Running', restarts: 0, age: '1m' },
                          { name: 'db-0', ready: '0/1', status: 'Pending', restarts: 0, age: '1m' }],
                   services: [{ name: 'web', type: 'ClusterIP', clusterIP: '10.0.0.1', ports: '80/TCP', age: '1m' }],
                   pvcs: [{ name: 'data', status: 'Bound', volume: 'pv-1', capacity: '10Gi', accessModes: 'RWO', storageClass: 'standard', age: '1m' }] });
  let o = T.run('kubectl get pods | grep Pending');
  assert(/db-0/.test(o) && !/web-1/.test(o), 'grep filter: ' + o);
  o = T.run('kubectl get pods | wc -l');
  assert(/^3$/.test(o.trim()), 'wc -l: ' + o);
  o = T.run('kubectl get pod web-1');
  assert(/web-1/.test(o) && !/db-0/.test(o), 'get <name>');
  assert(/NotFound/.test(T.run('kubectl get pod nope')), 'get <galat naam>');
  o = T.run('kubectl get pods,svc');
  assert(/web-1/.test(o) && /ClusterIP/.test(o), 'comma kinds');
  assert(/10Gi/.test(T.run('kubectl get pvc')), 'PVC CAPACITY (duplicate key bug)');
  o = T.run('kubectl get nodes-galat && kubectl get pods');
  assert(!/web-1/.test(o), '&& pehla fail -> doosra nahi chalta');
  T.run('kubectl get pods ; kubectl get svc');
  assert(T.st && true, 'chain ok');
});
t('terminal: throw karta callback app ko nahi todta + checklist live hai', () => {
  let flag = false;
  const tasks = [{ text: 'x', check: () => flag }];
  const T = term({ pods: [] }, { tasks, responses: [{ re: /^boom$/, out: () => { throw new Error('kaboom'); } },
                                                   { re: /^on$/, out: 'on', mutate: () => { flag = true; } },
                                                   { re: /^off$/, out: 'off', mutate: () => { flag = false; } }] });
  const reportError = console.error, caught = [];
  try {
    console.error = e => caught.push(String(e));
    assert(/Simulator error/.test(T.run('boom')), 'error dikha');
  } finally { console.error = reportError; }
  assert(caught.some(e => /kaboom/.test(e)), 'diagnostic bhi log hua');
  T.run('on'); T.run('off');
  assert(true, 'no throw');
});
t('stage: abandoned renderer callback cannot overwrite Home or another session', () => {
  let finish;
  const level = { id: 'callback-test', icon: 'x', title: 'callback test', stages: [{ type: 'callback-test', title: 'test' }] };
  KG.renderers['callback-test'] = (stage, arena, onDone) => { finish = onDone; };
  const previous = KG.session;
  try {
    KG.session = { level, stageIdx: 0, firstTry: 0, total: 0, replay: true };
    runStage(); const stale = finish;
    showHome(); stale({ firstTry: 1, total: 1 });
    assert(KG.session === null, 'abandoned callback after Home must do nothing');
    KG.session = { level, stageIdx: 0, firstTry: 0, total: 0, replay: true };
    runStage(); stale({ firstTry: 1, total: 1 });
    assert(KG.session.firstTry === 0 && KG.session.total === 0, 'old stage must not credit a new session');
    const current = finish;
    current({ firstTry: 1, total: 1 }); current({ firstTry: 1, total: 1 });
    assert(KG.session.firstTry === 1 && KG.session.total === 1, 'current callback remains one-shot');
  } finally { delete KG.renderers['callback-test']; KG.session = previous; KG.clearResume(); }
});
t('karpenter missions: deleting required Pending pods neither wins nor throws', () => {
  let m = KG.findLevel('karpenterbasics').stages.find(s => s.type === 'terminal');
  const waiting = term(m.cluster, m);
  assert(!/processing started/.test(waiting.run('kubectl logs batch-report-xyz')), 'Pending workload cannot show future Running logs');
  let T = term(m.cluster, m);
  ['kubectl get nodepools', 'kubectl get ec2nodeclasses', 'kubectl get nodeclaims', 'kubectl get nodes',
    'kubectl get events', 'kubectl delete pod batch-report-xyz', 'kubectl get pods'].forEach(cmd => T.run(cmd));
  assert(!T.won, 'Pehla Node still needs its workload');
  m = KG.findLevel('karpenterboss').stages.find(s => s.type === 'terminal'); T = term(m.cluster, m);
  ['gpu-trainer', 'huge-job', 'batch-worker'].forEach(name => { T.run('kubectl describe pod ' + name); T.run('kubectl delete pod ' + name); });
  T.run('kubectl get nodeclaims'); T.run('kubectl get pods');
  assert(!T.won, 'Pending Pod Mystery still needs all three workloads');
});
t('har terminal mission apne solution: [...] se poora hota hai (asli renderer, headless)', () => {
  const missing = []; let n = 0;
  KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => {
    const ms = [...l.stages.filter(x => x.type === 'terminal').map((m, i) => [l.id + ' terminal#' + i, m]),
                ...(l.interview.questions || []).filter(q => q.terminal).map((q, i) => [l.id + ' interview-terminal#' + i, q.terminal])];
    ms.forEach(([where, m]) => {
      if (!Array.isArray(m.solution) || !m.solution.length) { missing.push(where); return; }
      const arena = document.createElement('div');
      KG.renderers.terminal(m, arena, () => {});
      const termEl = arena.children[1];
      const input = termEl.querySelector('input'), outEl = termEl.querySelector('.term-out');
      const won = () => arena.children.some(c => c.classList && c.classList.contains('stage-summary'));
      m.solution.forEach((cmd, i) => {
        assert(!won(), where + ': mission "' + cmd + '" se PEHLE hi poora ho gaya — solution mein faltu command, ya success() bahut dheela');
        const before = outEl.children.length;
        input.value = cmd; input.fire('keydown', { key: 'Enter' });
        const out = outEl.children.slice(before).map(c => c.textContent).join('\n');
        assert(!/Simulator error/.test(out), where + ': "' + cmd + '" → ' + out);
      });
      assert(won(), where + ': poora solution chalane ke baad bhi mission complete nahi hua');
      const taskList = arena.children[0].children.find(child => child.tag === 'ul');
      (m.tasks || []).forEach((task, i) => assert(taskList && taskList.children[i] && taskList.children[i].classList.contains('done'),
        where + ': won with incomplete task: ' + task.text));
      n++;
    });
  }));
  assert(missing.length === 0, 'terminal missions bina solution: ' + missing.join(', '));
  assert(n > 0, 'koi mission replay nahi hua');
});
`;
eval(src + checks + TESTS + EXTRA_TESTS);

console.log('\n🛕 KubeGurukul — validate\n');
console.log('  tracks:  ' + ctx.summary.tracks);
console.log('  levels:  ' + ctx.summary.levels + '  |  visuals: ' + ctx.summary.visuals +
  '  |  cards: ' + ctx.summary.cards);
console.log('  stages:  ' + ctx.summary.stages + ' + ' + ctx.summary.interviews +
  ' interviews  |  terminal missions: ' + ctx.summary.missions +
  '  |  interactive labs: ' + ctx.summary.labs);
console.log('  types:   ' + ctx.summary.byType);
console.log('  🧭 decision trees: ' + ctx.summary.trees + ' (' + ctx.summary.leaves + ' recommendations, ' +
  ctx.summary.scenarios + ' practice scenarios)  |  🧪 real labs: ' + ctx.summary.realLabs + '\n');

/* ---------- non-Latin script leak guard ----------
   Content Hinglish hai — Latin akshar. Kabhi-kabhi typing ke dauraan
   Cyrillic "а" ya Devanagari "ा" chup-chaap ghus jaata hai; browser mein
   shabd bilkul theek dikhta hai par word tootа hua hota hai (jaise "rukа").
   Emoji aur arrows allowed hain, alphabet scripts nahi.                    */
const SCRIPTS = [
  [/[Ѐ-ӿԀ-ԯ]/g, 'Cyrillic'],
  [/[ऀ-ॿ]/g, 'Devanagari'],
  [/[Ͱ-Ͽ]/g, 'Greek'],
  [/[؀-ۿ]/g, 'Arabic'],
  [/[֐-׿]/g, 'Hebrew'],
  [/[一-鿿぀-ヿ]/g, 'CJK/Kana'],
  [/[\u0980-\u0DFF]/g, 'Indic (Bengali/Gurmukhi/Gujarati/Odia/Tamil/Telugu/Kannada/Malayalam)'],
  [/[\u0E00-\u0E7F]/g, 'Thai'],
];
FILES.concat(['index.html', 'gallery.html']).forEach(f => {
  const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
  const lines = txt.split('\n');
  SCRIPTS.forEach(([re, name]) => {
    lines.forEach((ln, i) => {
      const hits = ln.match(re);
      if (!hits) return;
      const ctxStr = ln.trim().slice(0, 110);
      problems.push(f + ':' + (i + 1) + ': ' + name + ' akshar (' + [...new Set(hits)].join('') +
        ') Hinglish text mein ghus gaya — "' + ctxStr + '"');
    });
  });
});

if (notLoaded.length) problems.push('index.html mein yeh scripts load nahi hain: ' + notLoaded.join(', '));

/* ---------- report ---------- */
results.forEach(r => console.log(r));
if (problems.length) {
  console.log('\n❌ PROBLEMS (' + problems.length + '):');
  problems.forEach(p => console.log('   x ' + p));
  process.exit(1);
}
console.log('\n✅ SAB THEEK — content valid, engine + simulators pass\n');
