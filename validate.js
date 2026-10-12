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
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    addEventListener(ev, fn) { (el._handlers[ev] = el._handlers[ev] || []).push(fn); },
    click() {
      if (el.disabled) return;
      if (el.onclick) el.onclick({ stopPropagation: noop, preventDefault: noop });
      (el._handlers.click || []).forEach(fn => fn({ stopPropagation: noop, preventDefault: noop }));
    },
    fire(ev) { (el._handlers[ev] || []).forEach(fn => fn({ stopPropagation: noop, preventDefault: noop })); },
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
global.window = { scrollTo: noop };
let store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
global.confirm = () => false;
global.Element = function () {}; Element.prototype = {};

const FILES = ['core.js', 'data-core.js', 'visuals.js', 'games.js', 'labs.js', 'terminal.js',
  'helmsim.js', 'argosim.js', 'karpentersim.js', 'dockerlab.js',
  'data-beginner.js', 'data-intermediate.js', 'data-advanced.js',
  'data-helm.js', 'data-argocd.js', 'data-karpenter.js', 'data-kodekloud.js', 'data-gaps.js', 'data-ext-sdd.js', 'app.js'];

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
          s.items.forEach(it => {
            if (!s.bins.some(b => b.id === it.bin)) problems.push(sc + ': item bin "' + it.bin + '" undefined');
            if (!it.explain) problems.push(sc + ': item "' + it.text + '" no explain');
          });
          s.bins.forEach(b => { if (!s.items.some(it => it.bin === b.id)) problems.push(sc + ': bin "' + b.id + '" khaali hai'); });
        }
      }
      if (s.type === 'match') (s.pairs || []).forEach((p, j) => { if (!p.left || !p.right || !p.explain) problems.push(sc + ' pair' + j + ': incomplete'); });
      if (s.type === 'order') (s.steps || []).forEach((st, j) => { if (!st.text || !st.explain) problems.push(sc + ' step' + j + ': incomplete'); });
      if (s.type === 'fill') {
        if (!s.template || !s.blanks || !s.tokens) problems.push(sc + ': incomplete');
        else {
          const idxs = (s.template.match(/\\{\\d+\\}/g) || []).map(m => +m.slice(1, -1)).sort((a, b) => a - b);
          const want = s.blanks.map((_, i) => i);
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
    });
  });
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

ctx.summary = {
  tracks: KG.tracks.map(t => t.icon + t.id + ':' + KG.levelsOf(t).length).join('  '),
  levels: nLevels, cards: nCards, stages: nStages, interviews: nLevels, missions: nTerm,
  byType: JSON.stringify(byType), visuals: Object.keys(VISUALS).length, labs: labStages.length,
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
const TESTS = '/* ============ 2. ENGINE TESTS ============ */\nconsole.log(\'engine:\');\nt(\'SRS: due-scheduling, box advance/reset, interval cap\', () => {\n  KG.state = KG.defaultState();\n  KG.addCard(\'c1\', \'F\', \'B\', \'tag\');\n  assert(KG.dueCards().length === 0, \'naya card abhi due nahi\');\n  KG.state.dojo.c1.due = Date.now() - 1000;\n  assert(KG.dueCards().length === 1, \'overdue card due hona chahiye\');\n  KG.reviewCard(\'c1\', true);\n  assert(KG.state.dojo.c1.box === 1 && KG.state.dojo.c1.due > Date.now() + 2.9 * KG.DAY, \'box/interval\');\n  KG.reviewCard(\'c1\', false);\n  assert(KG.state.dojo.c1.box === 0, \'wrong par box reset\');\n  for (let i = 0; i < 10; i++) KG.reviewCard(\'c1\', true);\n  assert(KG.state.dojo.c1.box === KG.SRS_INTERVALS.length - 1, \'box capped\');\n});\nt(\'mistake cards dedupe + replay mode XP/cards block karta hai\', () => {\n  KG.state = KG.defaultState(); KG.session = null;\n  KG.noteMistake(\'same?\', \'ans\'); KG.noteMistake(\'same?\', \'ans\');\n  assert(Object.keys(KG.state.dojo).length === 1, \'duplicate mistake card\');\n  KG.state = KG.defaultState(); KG.session = { replay: true };\n  KG.addXP(100); KG.noteMistake(\'q\', \'a\');\n  assert(KG.state.xp === 0 && Object.keys(KG.state.dojo).length === 0, \'replay mode\');\n  KG.session = null;\n});\nt(\'streak: same-day once, yesterday +1, gap reset, best preserved\', () => {\n  KG.state = KG.defaultState();\n  const ds = d => d.getFullYear() + \'-\' + String(d.getMonth() + 1).padStart(2, \'0\') + \'-\' + String(d.getDate()).padStart(2, \'0\');\n  KG.touchStreak(); KG.touchStreak();\n  assert(KG.state.streak.count === 1, \'same day\');\n  const y = new Date(); y.setDate(y.getDate() - 1); KG.state.streak.last = ds(y);\n  KG.touchStreak(); assert(KG.state.streak.count === 2, \'yesterday +1\');\n  const g = new Date(); g.setDate(g.getDate() - 5); KG.state.streak.last = ds(g);\n  KG.touchStreak();\n  assert(KG.state.streak.count === 1 && KG.state.streak.best === 2, \'gap reset, best rakha\');\n});\nt(\'track gating: sequential + alwaysUnlocked side-tracks\', () => {\n  KG.state = KG.defaultState();\n  assert(KG.trackUnlocked(KG.tracks[0]), \'beginner khula\');\n  assert(!KG.trackUnlocked(KG.tracks[1]), \'intermediate band\');\n  assert(!KG.trackUnlocked(KG.tracks[2]), \'advanced band\');\n  KG.tracks.filter(t2 => t2.alwaysUnlocked).forEach(t2 =>\n    assert(KG.trackUnlocked(t2), \'side-track \' + t2.id + \' hamesha khula\'));\n  KG.levelsOf(KG.tracks[0]).forEach(l => KG.state.completed.push(l.id));\n  assert(KG.trackUnlocked(KG.tracks[1]), \'beginner ke baad intermediate khula\');\n});\nt(\'corrupt/purana localStorage safely handle hota hai\', () => {\n  store[\'kubegurukul-v1\'] = \'{not json\';\n  assert(KG.loadState().xp === 0, \'corrupt -> fresh\');\n  store[\'kubegurukul-v1\'] = JSON.stringify({ xp: 50, completed: [\'a\'] });\n  const s2 = KG.loadState();\n  assert(s2.xp === 50 && s2.dojo && s2.streak && typeof s2.levelStarts === \'number\', \'forward-compat\');\n});\nt(\'missing data file se app crash nahi hota\', () => {\n  const saved = KG.levelSets.helm; delete KG.levelSets.helm;\n  const h = KG.tracks.find(x => x.id === \'helm\');\n  assert(KG.levelsOf(h).length === 0 && KG.trackProgress(h).complete === false, \'khaali track\');\n  KG.harvestQuestions();\n  KG.levelSets.helm = saved;\n});\n\n/* ============ 3. SIMULATORS ============ */\nconsole.log(\'\\nsimulators:\');\nlet out = [];\nconst P = (k, txt) => out.push(txt);\nconst run = (sim, cmd) => { out = []; const toks = cmd.split(\' \'); \n  if (toks[0] === \'helm\') KG.helm(sim, toks, P);\n  else KG.argo(sim, toks, P);\n  return out.join(\'\\n\'); };\n\nt(\'helm: install/upgrade/rollback + values precedence + get values\', () => {\n  const sim = { cluster: { pods: [], releases: [], repos: [], valuesFiles: { \'p.yaml\': { r: 10 } },\n    charts: { \'./a\': { name: \'a\', version: \'0.1.0\', appVersion: \'1.0\', defaults: { r: 1, keep: \'yes\' },\n      render: v => \'r=\' + v.r, onUpgrade: (s, rel) => rel.values.r !== 999 } } }, history: [] };\n  run(sim, \'helm install a ./a --set r=3\');\n  let rel = sim.cluster.releases[0];\n  assert(rel.values.r === 3 && rel.values.keep === \'yes\', \'defaults deep-merge + --set\');\n  assert(!rel.userValues.keep, \'get values sirf user-supplied dikhata hai\');\n  run(sim, \'helm upgrade a ./a -f p.yaml\');\n  assert(sim.cluster.releases[0].values.r === 10 && sim.cluster.releases[0].revision === 2, \'upgrade + --set bhool jaana\');\n  run(sim, \'helm rollback a 1\');\n  assert(sim.cluster.releases[0].revision === 3 && sim.cluster.releases[0].values.r === 3, \'rollback = naya revision\');\n  const o = run(sim, \'helm upgrade a ./a --set r=999 --atomic\');\n  assert(/automatic rollback/.test(o) && sim.cluster.releases[0].status === \'deployed\', \'--atomic auto-rollback\');\n});\nt(\'helm: stuck release block karta hai jab tak rollback na ho\', () => {\n  const sim = { cluster: { releases: [], repos: [], charts: { \'./a\': { name: \'a\', version: \'1\', appVersion: \'1\', defaults: {} } } }, history: [] };\n  run(sim, \'helm install a ./a\');\n  sim.cluster.releases[0].status = \'pending-upgrade\';\n  assert(/another operation/.test(run(sim, \'helm upgrade a ./a\')), \'blocked\');\n  run(sim, \'helm rollback a 1\');\n  assert(/has been upgraded/.test(run(sim, \'helm upgrade a ./a\')), \'rollback ke baad chalta hai\');\n});\nt(\'argocd: list/get/diff/sync + prune + Synced hone par diff khaali\', () => {\n  const sim = { cluster: { services: [], apps: [{\n    name: \'x\', sync: \'OutOfSync\', health: \'Missing\', destNamespace: \'default\',\n    resources: [{ kind: \'Deployment\', name: \'d\', status: \'OutOfSync\', health: \'Missing\' },\n                { kind: \'Service\', name: \'old\', status: \'OutOfSync\', pruneMe: true }],\n    diff: \'DIFF-TEXT\', history: [], onSync: () => true }] }, history: [] };\n  assert(/OutOfSync/.test(run(sim, \'argocd app list\')), \'list\');\n  assert(/Sync Status/.test(run(sim, \'argocd app get x\')), \'get\');\n  assert(/DIFF-TEXT/.test(run(sim, \'argocd app diff x\')), \'diff\');\n  let o = run(sim, \'argocd app sync x\');\n  assert(sim.cluster.apps[0].sync === \'Synced\', \'sync\');\n  assert(/NAHI hatega/.test(o) || sim.cluster.apps[0].resources.some(r => r.pruneMe && !r.pruned), \'bina --prune ke prune nahi\');\n  run(sim, \'argocd app sync x --prune\');\n  assert(!sim.cluster.apps[0].resources.some(r => r.pruneMe && !r.pruned), \'--prune ne hataya\');\n  assert(/koi diff nahi/.test(run(sim, \'argocd app diff x\')), \'Synced par diff khaali\');\n});\nt(\'argocd: failed sync, selfHeal ke saath rollback block, app set\', () => {\n  const sim = { cluster: { apps: [{ name: \'y\', sync: \'OutOfSync\', health: \'Healthy\', resources: [],\n    history: [{ id: 1, revision: \'r1\', deployedAt: \'d\' }], syncError: \'boom\', onSync: () => false }] }, history: [] };\n  const o = run(sim, \'argocd app sync y\');\n  assert(/FAILED/.test(o) && sim.cluster.apps[0].health === \'Degraded\', \'sync fail\');\n  run(sim, \'argocd app set y --sync-policy automated --self-heal\');\n  assert(sim.cluster.apps[0].syncPolicy.automated.selfHeal === true, \'set policy\');\n  assert(/git revert/.test(run(sim, \'argocd app rollback y 1\')), \'selfHeal par rollback guidance\');\n});\nt(\'rollouts: get/promote/abort weights aur status sahi badalte hain\', () => {\n  const sim = { cluster: { pods: [], rollouts: [{ name: \'r\', strategy: \'canary\', status: \'Paused\',\n    step: 1, weight: 10, steps: [\'setWeight: 10\', \'pause: {}\', \'setWeight: 50\', \'setWeight: 100\'] }] }, history: [] };\n  assert(/Paused/.test(run(sim, \'kubectl argo rollouts get rollout r\')), \'get\');\n  run(sim, \'kubectl argo rollouts promote r\');\n  assert(sim.cluster.rollouts[0].step === 2, \'promote step++\');\n  run(sim, \'kubectl argo rollouts abort r\');\n  assert(sim.cluster.rollouts[0].aborted && sim.cluster.rollouts[0].weight === 0, \'abort -> 0%\');\n});\nt(\'karpenter: Pending pod -> NodeClaim -> Node -> pod Running\', () => {\n  const sim = { cluster: {\n    karpenter: { enabled: true, tick: 0, log: [] },\n    nodes: [], nodeclaims: [], events: [],\n    pods: [{ name: \'p\', status: \'Pending\', ready: \'0/1\', requests: { cpu: \'3\', memory: \'6Gi\' } }],\n    nodepools: [{ name: \'default\', requirements: [\n      { key: \'karpenter.sh/capacity-type\', operator: \'In\', values: [\'spot\'] },\n      { key: \'karpenter.k8s.aws/instance-category\', operator: \'In\', values: [\'c\', \'m\'] }],\n      limits: { cpu: 100 }, used: { cpu: 0 }, disruption: { consolidationPolicy: \'WhenEmptyOrUnderutilized\' } }],\n    ec2nodeclasses: [{ name: \'default\' }] } };\n  KG.karpenter.reconcile(sim);\n  assert(sim.cluster.nodeclaims.length === 1, \'NodeClaim bana\');\n  assert(sim.cluster.nodeclaims[0].capacity === \'spot\', \'spot chuna\');\n  assert(sim.cluster.nodeclaims[0].cpu >= 3, \'fit karne wala type\');\n  assert(sim.cluster.pods[0].status === \'Pending\', \'abhi bhi Pending (node aa raha hai)\');\n  KG.karpenter.reconcile(sim);\n  assert(sim.cluster.nodes.length === 1 && sim.cluster.pods[0].status === \'Running\', \'node ready -> pod Running\');\n});\nt(\'karpenter: limits, no-match, aur "koi type fit nahi" — teeno alag Events\', () => {\n  const base = () => ({ cluster: { karpenter: { enabled: true, tick: 0, log: [] }, nodes: [], nodeclaims: [], events: [],\n    pods: [], nodepools: [], ec2nodeclasses: [] } });\n  // (a) koi nodepool nahi\n  let s = base(); s.cluster.pods = [{ name: \'a\', status: \'Pending\', requests: { cpu: \'1\' } }];\n  KG.karpenter.reconcile(s);\n  assert(s.cluster.pods[0].unschedulable && /NodePool/.test(s.cluster.pods[0].describe), \'no nodepool\');\n  // (b) limit full\n  s = base();\n  s.cluster.nodepools = [{ name: \'d\', requirements: [], limits: { cpu: 2 }, used: { cpu: 2 }, disruption: {} }];\n  s.cluster.pods = [{ name: \'b\', status: \'Pending\', requests: { cpu: \'2\' } }];\n  KG.karpenter.reconcile(s);\n  assert(/limit/i.test(s.cluster.pods[0].describe), \'limit reached\');\n  // (c) koi instance type itna bada nahi\n  s = base();\n  s.cluster.nodepools = [{ name: \'d\', requirements: [], limits: { cpu: 1000 }, used: { cpu: 0 }, disruption: {} }];\n  s.cluster.pods = [{ name: \'c\', status: \'Pending\', requests: { cpu: \'64\', memory: \'512Gi\' } }];\n  KG.karpenter.reconcile(s);\n  assert(/instance type/i.test(s.cluster.pods[0].describe), \'no instance type\');\n});\nt(\'karpenter: consolidation khaali node hataata hai, do-not-disrupt rokta hai\', () => {\n  const mk = (dnd) => ({ cluster: { karpenter: { enabled: true, tick: 5, log: [] }, events: [],\n    nodes: [{ name: \'n1\', karpenter: true, cpu: 4, mem: 8, usedCpu: 0, usedMem: 0 }],\n    nodeclaims: [{ name: \'nc1\', nodeName: \'n1\', ready: \'True\' }],\n    pods: dnd ? [{ name: \'p\', status: \'Running\', node: \'n1\', doNotDisrupt: true, requests: { cpu: \'1\' } }] : [],\n    nodepools: [{ name: \'d\', requirements: [], limits: { cpu: 100 }, used: { cpu: 0 },\n      disruption: { consolidationPolicy: \'WhenEmptyOrUnderutilized\' } }], ec2nodeclasses: [] } });\n  let s = mk(false); KG.karpenter.reconcile(s);\n  assert(s.cluster.nodes.length === 0, \'khaali node hata\');\n  s = mk(true); s.cluster.nodes[0].usedCpu = 1; KG.karpenter.reconcile(s);\n  assert(s.cluster.nodes.length === 1, \'do-not-disrupt ne bachaya\');\n});\nt(\'karpenter: cost calculator spot/on-demand sahi ginta hai\', () => {\n  const sim = { cluster: { nodes: [\n    { karpenter: true, instanceType: \'c6a.xlarge\', capacityType: \'spot\' },\n    { karpenter: true, instanceType: \'c6a.xlarge\', capacityType: \'on-demand\' }] } };\n  const c = KG.karpenter.cost(sim);\n  assert(c.nodes === 2 && c.hourly > 0 && c.monthly > c.hourly, \'cost math\');\n  const spotOnly = KG.karpenter.cost({ cluster: { nodes: [{ karpenter: true, instanceType: \'c6a.xlarge\', capacityType: \'spot\' }] } });\n  const odOnly = KG.karpenter.cost({ cluster: { nodes: [{ karpenter: true, instanceType: \'c6a.xlarge\', capacityType: \'on-demand\' }] } });\n  assert(spotOnly.hourly < odOnly.hourly, \'spot sasta hai\');\n});\n\n';
eval(src + checks + TESTS + EXTRA_TESTS);

console.log('\n🛕 KubeGurukul — validate\n');
console.log('  tracks:  ' + ctx.summary.tracks);
console.log('  levels:  ' + ctx.summary.levels + '  |  visuals: ' + ctx.summary.visuals +
  '  |  cards: ' + ctx.summary.cards);
console.log('  stages:  ' + ctx.summary.stages + ' + ' + ctx.summary.interviews +
  ' interviews  |  terminal missions: ' + ctx.summary.missions +
  '  |  interactive labs: ' + ctx.summary.labs);
console.log('  types:   ' + ctx.summary.byType + '\n');

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
