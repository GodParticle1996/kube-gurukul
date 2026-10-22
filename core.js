/* =====================================================================
   KubeGurukul — Core: state, XP, streak, spaced repetition, registry
   Loaded FIRST. Everything lives under the global `KG` namespace so
   content files (data-*.js) can self-register levels & cards.
   ===================================================================== */

/* kuch purane browsers/webviews mein scrollIntoView nahi hota — app na toote */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView)
  Element.prototype.scrollIntoView = function () {};

const KG = {
  STORE_KEY: 'kubegurukul-v1',
  XP_PER_ITEM: 10,
  PERFECT_BONUS: 20,
  TERMINAL_XP: 30,       // base XP for completing a terminal mission
  HINT_COST: 5,          // XP shaved off a terminal mission per hint
  CARD_XP: 5,            // XP per due flashcard reviewed
  POP_XP: 5,             // bonus XP per correct pop-quiz answer
  SRS_INTERVALS: [1, 3, 7, 16, 35],   // days — SM-2-lite boxes

  levelSets: {},         // trackId -> [level, ...]  (filled by data-*.js)
  tracks: [],            // filled by data-core.js
  state: null,
  session: null,
};

/* ---------------- level registry (extensibility hook) ----------------
   A data file calls:  KG.registerLevels('beginner', [ {...}, {...} ])
   Multiple calls append — so you can add ONE new level from ANY file. */
KG.registerLevels = function (trackId, levels) {
  if (!KG.levelSets[trackId]) KG.levelSets[trackId] = [];
  KG.levelSets[trackId].push(...levels);
};

/* Track ke BEECH mein level daalna ho (jaise boss se pehle)? Yeh use karo —
   append karne se naya level boss ke BAAD chala jaata hai, jo galat hai.
   Data file ko boss ki file se BAAD mein load hona chahiye.
   Agar afterId nahi mila to levels aakhir mein jud jaate hain (safe fallback). */
KG.registerLevelsAfter = function (trackId, afterId, levels) {
  const set = KG.levelSets[trackId] = KG.levelSets[trackId] || [];
  const i = set.findIndex(l => l.id === afterId);
  if (i === -1) { set.push(...levels); return; }
  set.splice(i + 1, 0, ...levels);
};

/* Maujooda level ko BADHANA (naya video, wahi topic — naya level nahi banana):
     KG.extendLevel('probes', { objectives:[], lesson:[], stages:[], success:[], cards:[],
                                interview:[questions], homework:'' })
   Sab kuch us level ke aakhir mein judta hai. Level na mile toh ERROR — chupchaap kuch na hona sabse bura bug. */
KG.extendLevel = function (levelId, add) {
  let lvl = null;
  Object.keys(KG.levelSets).forEach(t => (KG.levelSets[t] || []).forEach(l => { if (l.id === levelId) lvl = l; }));
  if (!lvl) throw new Error(`KG.extendLevel: level '${levelId}' nahi mila — file order check karo`);
  ['objectives', 'lesson', 'stages', 'success', 'cards'].forEach(k => {
    if (add[k] && add[k].length) lvl[k] = (lvl[k] || []).concat(add[k]);
  });
  if (add.interview && add.interview.length) {
    lvl.interview = lvl.interview || { title: 'Interview Round', instructions: '', questions: [] };
    lvl.interview.questions = lvl.interview.questions.concat(add.interview);
  }
  if (add.homework) lvl.homework = (lvl.homework || '') + add.homework;
  return lvl;
};

/* ---------------- persistence ---------------- */
KG.defaultState = function () {
  return {
    xp: 0,
    completed: [],        // level ids
    stars: {},            // levelId -> 1..3
    dojo: {},             // cardId -> { box, due (ms), front, back, tag }
    streak: { last: null, count: 0, best: 0 },
    levelStarts: 0,       // for pop-quiz cadence
    resume: null,         // { levelId, stageIdx, firstTry, total, replay, at } — beech mein chhoda level
  };
};

KG.loadState = function () {
  try {
    const s = JSON.parse(localStorage.getItem(KG.STORE_KEY));
    if (s && typeof s.xp === 'number' && Array.isArray(s.completed)) {
      // forward-compat: fill any missing keys added in later versions
      return Object.assign(KG.defaultState(), s);
    }
  } catch (e) { /* corrupted store — start fresh */ }
  return KG.defaultState();
};
KG.saveState = function () {
  try { localStorage.setItem(KG.STORE_KEY, JSON.stringify(KG.state)); }
  catch (e) { /* storage full / private mode / blocked — app chalta rahe, bas save nahi hoga */ }
};
KG.state = KG.loadState();

/* ---------------- DOM helpers ---------------- */
KG.el = function (tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
KG.shuffle = function (arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
KG.shake = function (node) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
};
KG.escapeHtml = function (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

/* ---------------- XP & ranks ---------------- */
KG.currentRank = function () {
  let r = RANKS[0];
  for (const rank of RANKS) if (KG.state.xp >= rank.xp) r = rank;
  return r;
};
KG.nextRank = function () { return RANKS.find(r => r.xp > KG.state.xp) || null; };
KG.addXP = function (n) {
  if (KG.session && KG.session.replay) return;
  if (n <= 0) return;
  KG.state.xp += n;
  KG.touchStreak();
  KG.saveState();
  if (typeof renderTopbar === 'function') renderTopbar();
  KG.floatXP(n);
};
KG.floatXP = function (n) {
  const bar = document.getElementById('topbar');
  const f = KG.el('div', 'xp-float', `+${n} XP`);
  bar.appendChild(f);
  setTimeout(() => f.remove(), 1200);
};

/* ---------------- daily streak ---------------- */
KG.todayStr = function () {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
KG.touchStreak = function () {
  const s = KG.state.streak;
  const today = KG.todayStr();
  if (s.last === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  s.count = (s.last === yesterday) ? s.count + 1 : 1;
  s.best = Math.max(s.best, s.count);
  s.last = today;
  KG.saveState();
};
KG.streakAlive = function () {
  const s = KG.state.streak;
  if (!s.last) return false;
  const today = KG.todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  return s.last === today || s.last === yesterday;
};

/* ---------------- Revision Dojo: SM-2-lite spaced repetition ----------
   Card = { box, due, front, back, tag }.  box indexes SRS_INTERVALS.
   - level complete  -> level.cards enter the deck (due tomorrow)
   - wrong answer    -> auto "mistake card" (due tomorrow, box 0)
   - review correct  -> box+1 (capped), due = now + interval[box]
   - review wrong    -> box = 0, due tomorrow                      */
KG.DAY = 24 * 60 * 60 * 1000;

KG.addCard = function (id, front, back, tag) {
  if (KG.state.dojo[id]) return; // already in the deck
  KG.state.dojo[id] = { box: 0, due: Date.now() + KG.DAY, front, back, tag: tag || '' };
  KG.saveState();
};

/* called by game renderers on a wrong answer — turns the mistake into a card */
KG.noteMistake = function (front, back, tag) {
  if (KG.session && KG.session.replay) return;
  if (!front || !back) return;
  // stable id from the front text so the same mistake never duplicates
  let h = 0;
  for (let i = 0; i < front.length; i++) h = ((h << 5) - h + front.charCodeAt(i)) | 0;
  KG.addCard('mistake-' + Math.abs(h), front, back, tag || '🙈 Galti se seekho');
};

KG.enrollLevelCards = function (level) {
  (level.cards || []).forEach((c, i) =>
    KG.addCard(`${level.id}-c${i}`, c.front, c.back, `${level.icon} ${level.title}`));
};

KG.dueCards = function () {
  const now = Date.now();
  return Object.entries(KG.state.dojo)
    .filter(([, c]) => c.due <= now)
    .map(([id, c]) => ({ id, ...c }));
};

KG.reviewCard = function (id, remembered) {
  const c = KG.state.dojo[id];
  if (!c) return;
  if (remembered) {
    c.box = Math.min(c.box + 1, KG.SRS_INTERVALS.length - 1);
    c.due = Date.now() + KG.SRS_INTERVALS[c.box] * KG.DAY;
  } else {
    c.box = 0;
    c.due = Date.now() + KG.DAY;
  }
  KG.saveState();
};

/* ---------------- pop-quiz question harvesting ----------------
   Pulls MCQs from already-completed levels (quiz stages + interview). */
KG.harvestQuestions = function () {
  const qs = [];
  KG.tracks.forEach(t => (KG.levelSets[t.id] || []).forEach(lvl => {
    if (!KG.state.completed.includes(lvl.id)) return;
    (lvl.stages || []).forEach(st => {
      if (st.type === 'quiz') (st.questions || []).forEach(q => qs.push({ ...q, from: lvl }));
    });
    if (lvl.interview) (lvl.interview.questions || []).forEach(q => {
      if (q.choices) qs.push({ ...q, from: lvl });
    });
  }));
  return qs;
};

/* ---------------- resume-anywhere (ADHD-friendly) ----------------
   Level beech mein chhoda? Har challenge ke shuru aur khatam par checkpoint
   save hota hai — agli baar wahin se. { levelId, stageIdx, firstTry, total, replay, at } */
KG.saveResume = function (sess, stageIdx) {
  if (!sess || !sess.level) return;
  KG.state.resume = { levelId: sess.level.id, stageIdx, firstTry: sess.firstTry, total: sess.total,
                      replay: !!sess.replay, at: Date.now() };
  KG.saveState();
};
KG.clearResume = function () {
  if (!KG.state.resume) return;
  KG.state.resume = null;
  KG.saveState();
};
KG.findLevel = function (id) {
  for (const t of KG.tracks) {
    const l = (KG.levelSets[t.id] || []).find(x => x.id === id);
    if (l) return l;
  }
  return null;
};
/* resume valid hai? (level abhi bhi maujood ho) → { level, ...resume } ya null */
KG.getResume = function () {
  const r = KG.state.resume;
  if (!r || !r.levelId) return null;
  const level = KG.findLevel(r.levelId);
  if (!level) return null;
  return Object.assign({ level }, r);
};

/* ---------------- track helpers ---------------- */
KG.trackOf = function (level) {
  return KG.tracks.find(t => (KG.levelSets[t.id] || []).includes(level));
};
KG.levelsOf = function (track) { return KG.levelSets[track.id] || []; };
KG.trackProgress = function (track) {
  const levels = KG.levelsOf(track);
  const done = levels.filter(l => KG.state.completed.includes(l.id)).length;
  return { done, total: levels.length, complete: done === levels.length && levels.length > 0 };
};
KG.trackUnlocked = function (track) {
  if (track.alwaysUnlocked) return true;          // side-track (jaise Helm) — kabhi bhi khelo
  // is track mein pehle se kuch complete hai? toh khula rehna chahiye — pichle track mein
  // baad mein naya level judne se learner ka chal raha track band nahi hona chahiye
  if (KG.levelsOf(track).some(l => KG.state.completed.includes(l.id))) return true;
  const idx = KG.tracks.indexOf(track);
  // pichla SEQUENTIAL track dhundo (always-unlocked wale beech mein aayein toh unhe chhod do)
  for (let i = idx - 1; i >= 0; i--) {
    if (KG.tracks[i].alwaysUnlocked) continue;
    return KG.trackProgress(KG.tracks[i]).complete;
  }
  return true;
};
