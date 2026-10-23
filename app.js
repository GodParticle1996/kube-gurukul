/* =====================================================================
   KubeGurukul — Screens & flow
   home → track → level intro (objectives) → stages → 🎤 interview →
   success criteria → complete · Revision Dojo · pop quiz · certificates
   ===================================================================== */

const appEl = document.getElementById('app');
const topbarEl = document.getElementById('topbar');

/* ---------------- topbar ---------------- */
function renderTopbar() {
  const rank = KG.currentRank();
  const next = KG.nextRank();
  const pct = next
    ? Math.min(100, Math.round(((KG.state.xp - rank.xp) / (next.xp - rank.xp)) * 100))
    : 100;
  const st = KG.state.streak;
  const alive = KG.streakAlive() && st.count > 0;
  topbarEl.innerHTML = `
    <div class="brand" id="brand">🛕 <b>KubeGurukul</b></div>
    <div class="rankbox">
      <span class="streakbox${alive ? '' : ' cold'}" title="Roz khelo, streak badhao! Best: ${st.best} din">${alive ? '🔥' : '🩶'} ${alive ? st.count : 0} din</span>
      <span class="rank">${rank.icon} ${rank.name}</span>
      <div class="xpbar"><div class="xpfill" style="width:${pct}%"></div></div>
      <span class="xptext">${KG.state.xp} XP${next ? ` · ${next.xp - KG.state.xp} to ${next.icon}` : ' · MAX RANK 👑'}</span>
    </div>`;
  topbarEl.querySelector('#brand').onclick = showHome;
}

/* ---------- visuals ---------- */
function diagramFor(id, hero) {
  const v = (typeof VISUALS !== 'undefined') && VISUALS[id];
  if (!v) return null;
  const d = el('div', 'diagram' + (hero ? ' hero' : ''));
  d.innerHTML = `<div class="dg-title">📊 ${v.t}</div>${v.html}`;
  return d;
}

/* ============================================================
   HOME
   ============================================================ */
function showHome() {
  KG.session = null;
  renderTopbar();
  appEl.innerHTML = '';

  const hero = el('section', 'hero', `
    <h1>Kubernetes seekho, <span class="glow">khel khel</span> mein</h1>
    <p>Docker aata hai? Perfect. Ab cluster ki duniya — level by level, hands-on, Hinglish mein.</p>`);
  appEl.appendChild(hero);

  // ▶ beech mein chhoda level — sabse upar, ek click mein wahin se
  const res = KG.getResume();
  if (res) {
    const total = allStages(res.level).length;
    const at = Math.min(res.stageIdx, total);
    const card = el('section', 'resume-card clickable', `
      <div class="rs-icon">▶</div>
      <div class="rs-body">
        <div class="rs-title">Wahin se continue karo: ${res.level.icon} ${res.level.title}</div>
        <div class="rs-sub">${at >= total ? 'Saare challenges ho gaye — bas level khatam karna baaki hai 🏁' : `Challenge ${at + 1} / ${total} · ${res.firstTry}/${res.total} first-try sahi ab tak`}</div>
        <div class="rs-bar"><div class="rs-fill" style="width:${Math.round((at / Math.max(1, total)) * 100)}%"></div></div>
      </div>
      <div class="rs-go">Chalo →</div>`);
    card.onclick = () => resumeLevel(res);
    appEl.appendChild(card);
  }

  // ⚡ mood picker — "aaj kitni energy hai?" ek click mein sahi size ka kaam
  const mood = el('section', 'moodbar');
  mood.appendChild(el('div', 'mood-q', '⚡ Aaj ka mood?'));
  const moods = [
    { icon: '🐢', label: 'Thoda sa', sub: '~5 min', go: moodQuick },
    { icon: '🎯', label: 'Ek level', sub: '15–20 min', go: moodLevel },
    { icon: '🔥', label: 'Full focus', sub: '45 min+ · real cluster', go: moodDeep },
  ];
  moods.forEach(m => {
    const b = el('button', 'mood-btn', `<span class="mood-icon">${m.icon}</span><span class="mood-l">${m.label}</span><span class="mood-s">${m.sub}</span>`);
    b.onclick = m.go;
    mood.appendChild(b);
  });
  appEl.appendChild(mood);

  // 🧭 + 🧪 — decision-making aur asli cluster
  const feat = el('section', 'featrow');
  const nTrees = (KG.decisions || []).length;
  const ddCard = el('div', 'featcard clickable', `
    <div class="feat-icon">🧭</div>
    <div><div class="feat-title">Decision Dojo — kab kya use karein?</div>
    <div class="feat-sub">${nTrees} decision-trees: Deployment ya StatefulSet? Ingress ya Gateway? HPA ya KEDA? Sawal-dar-sawal raasta → recommendation + gotchas + YAML.</div></div>`);
  ddCard.onclick = () => showDecisionDojo();
  const labsDone = (KG.state.realLabsDone || []).length;
  const rlCard = el('div', 'featcard clickable', `
    <div class="feat-icon">🧪</div>
    <div><div class="feat-title">Real Cluster Labs — kind par asli practice</div>
    <div class="feat-sub">${(KG.realLabs || []).length} toote hue production scenarios + <code>verify.sh</code> (❌ par hint, jawab nahi). ✅ ${labsDone} ho gaye.</div></div>`);
  rlCard.onclick = () => showRealLabs();
  feat.append(ddCard, rlCard);
  appEl.appendChild(feat);

  // dojo + streak strip
  const due = KG.dueCards();
  const deckSize = Object.keys(KG.state.dojo).length;
  const st = KG.state.streak;
  const strip = el('section', 'homestrip');

  const dojoCard = el('div', 'stripcard clickable' + (due.length ? ' due' : ''));
  dojoCard.innerHTML = `
    <div class="strip-icon">🧘</div>
    <div>
      <div class="strip-title">Revision Dojo</div>
      <div class="strip-sub">${due.length
        ? `<b style="color:var(--gold)">${due.length} card${due.length > 1 ? 's' : ''} due hain aaj</b> — bhoolne se pehle revise karo!`
        : deckSize
          ? `Sab revise ho chuka ✅ (deck mein ${deckSize} cards) — naye levels khelo`
          : 'Levels complete karoge toh yahan flashcards aayenge'}</div>
    </div>`;
  dojoCard.onclick = showDojo;
  strip.appendChild(dojoCard);

  const alive = KG.streakAlive() && st.count > 0;
  strip.appendChild(el('div', 'stripcard', `
    <div class="strip-icon">${alive ? '🔥' : '🩶'}</div>
    <div>
      <div class="strip-title">${alive ? `${st.count} din ki streak!` : 'Streak thandi hai'}</div>
      <div class="strip-sub">${alive ? `Best: ${st.best} din. Aaj bhi khelo, kal bhi!` : 'Aaj kuch bhi khelo — streak phir se shuru 🔥'}</div>
    </div>`));

  const totalDone = KG.state.completed.length;
  const totalLevels = KG.tracks.reduce((s, t) => s + KG.levelsOf(t).length, 0);
  strip.appendChild(el('div', 'stripcard', `
    <div class="strip-icon">🏅</div>
    <div>
      <div class="strip-title">${totalDone} / ${totalLevels} levels</div>
      <div class="strip-sub">${KG.state.xp} XP · rank: ${KG.currentRank().name}</div>
    </div>`));
  appEl.appendChild(strip);

  // tracks
  const map = el('section', 'trackmap');
  KG.tracks.forEach(track => {
    const p = KG.trackProgress(track);
    const unlocked = KG.trackUnlocked(track);
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    const card = el('div', 'trackcard' + (p.complete ? ' done' : '') + (unlocked ? '' : ' locked'));
    card.innerHTML = `
      <div class="tk-icon">${track.icon}</div>
      <div class="tk-name">${track.name}</div>
      <div class="tk-blurb">${track.blurb}</div>
      <div class="tk-bar"><div class="tk-fill" style="width:${pct}%"></div></div>
      <div class="tk-prog">${p.done}/${p.total} levels${p.complete ? ' · ✅ complete' : ''}</div>
      <div class="tk-go">${unlocked ? (p.done ? 'Aage badho →' : 'Shuru karo →') : '🔒 Pehle pichla track complete karo'}</div>`;
    if (unlocked) card.onclick = () => showTrack(track);
    map.appendChild(card);
  });
  appEl.appendChild(map);

  const foot = el('div', 'home-foot');
  const reset = el('button', 'btn ghost small', '↺ Saara progress reset karo');
  reset.onclick = () => {
    if (confirm('Saara XP, badges, streak aur Dojo cards mit jayenge. Pakka?')) {
      KG.state = KG.defaultState();
      KG.saveState();
      showHome();
    }
  };
  foot.appendChild(reset);
  appEl.appendChild(foot);
}

/* ---------- ⚡ mood picker ke raaste ---------- */
function moodQuick() {
  // due flashcards pehle (bhoolne se pehle), warna decision practice
  if (KG.dueCards().length) showDojo();
  else showDecisionPractice(null);
}
function nextLevel() {
  // chalu track (jisme progress hai) ko pehle, warna pehla khula track
  const open = KG.tracks.filter(t => KG.trackUnlocked(t) && !KG.trackProgress(t).complete && KG.levelsOf(t).length);
  const track = open.find(t => KG.trackProgress(t).done > 0) || open[0];
  if (!track) return null;
  return KG.levelsOf(track).find(l => !KG.state.completed.includes(l.id)) || null;
}
function moodLevel() {
  const res = KG.getResume();
  if (res) return resumeLevel(res);
  const lvl = nextLevel();
  if (lvl) showIntro(lvl); else showDecisionDojo();     // saare levels ho gaye → decisions practice
}
function moodDeep() {
  const done = KG.state.realLabsDone || [];
  const lab = (KG.realLabs || []).find(l => !done.includes(l.id));
  if (lab) showRealLab(lab); else showRealLabs();
}

/* ============================================================
   TRACK — level map
   ============================================================ */
function showTrack(track) {
  KG.session = null;
  appEl.innerHTML = '';
  window.scrollTo(0, 0);

  const head = el('section', 'track-head');
  const back = el('button', 'btn ghost small', '← Saare tracks');
  back.onclick = showHome;
  head.appendChild(back);
  head.appendChild(el('h2', 'track-title', `${track.icon} ${track.name}`));
  appEl.appendChild(head);

  const levels = KG.levelsOf(track);
  const res = KG.getResume();
  const map = el('section', 'levelmap');
  levels.forEach((lvl, i) => {
    const done = KG.state.completed.includes(lvl.id);
    // complete kiya hua level hamesha khula (beech mein naya level judne par bhi replay ho sake)
    const unlocked = i === 0 || done || KG.state.completed.includes(levels[i - 1].id);
    const stars = KG.state.stars[lvl.id] || 0;
    const resumeHere = res && res.levelId === lvl.id;
    const card = el('div', 'levelcard' + (done ? ' done' : '') + (unlocked ? '' : ' locked') + (resumeHere ? ' resuming' : ''));
    card.innerHTML = `
      <div class="lv-num">${unlocked ? `LEVEL ${i + 1}` : '🔒 LOCKED'}</div>
      <div class="lv-icon">${lvl.icon}</div>
      <div class="lv-title">${lvl.title}</div>
      <div class="lv-stars">${resumeHere ? `▶ Challenge ${Math.min(res.stageIdx, allStages(lvl).length - 1) + 1} se continue` : done ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : unlocked ? '▶ Khelo' : 'Pichla level pehle'}</div>
      ${done ? `<div class="lv-badge">🏅 ${lvl.badge}</div>` : ''}`;
    if (unlocked) card.onclick = () => showIntro(lvl);
    map.appendChild(card);
  });
  appEl.appendChild(map);

  if (KG.trackProgress(track).complete) {
    const cert = el('div', 'certbtn-wrap');
    const btn = el('button', 'btn big gold', `🏆 Apna ${track.certTitle} certificate dekho`);
    btn.onclick = () => showCertificate(track);
    cert.appendChild(btn);
    appEl.appendChild(cert);
  }
}

/* ============================================================
   LEVEL INTRO — objectives + lesson
   ============================================================ */
function showIntro(level) {
  appEl.innerHTML = '';
  const track = KG.trackOf(level);
  const levels = KG.levelsOf(track);
  const idx = levels.indexOf(level);
  const wrap = el('section', 'panel');
  wrap.appendChild(el('div', 'crumb', `${track.icon} ${track.name} — Level ${idx + 1} of ${levels.length}`));
  wrap.appendChild(el('h2', 'level-h', `${level.icon} ${level.title}`));

  if (level.objectives && level.objectives.length) {
    wrap.appendChild(el('div', 'obj-box', `
      <h4>🎯 Is level mein tum seekhoge</h4>
      <ul>${level.objectives.map(o => `<li>${o}</li>`).join('')}</ul>`));
  }

  // 🧭 "Kab use karein?" — is level se jude decision-trees + asli cluster labs
  const trees = KG.decisionsForLevel ? KG.decisionsForLevel(level.id) : [];
  const labs = KG.realLabsForLevel ? KG.realLabsForLevel(level.id) : [];
  if (trees.length || labs.length) {
    const box = el('div', 'kab-box');
    box.appendChild(el('h4', '', '🧭 Kab use karein? · 🧪 Asli cluster par'));
    const chips = el('div', 'dd-chips');
    trees.forEach(t => {
      const b = el('button', 'dd-chip', `🧭 ${t.icon} ${t.short || t.title}`);
      b.onclick = () => showDecisionTree(t);
      chips.appendChild(b);
    });
    labs.forEach(l => {
      const b = el('button', 'dd-chip lab', `🧪 Lab ${l.num}: ${l.title}`);
      b.onclick = () => showRealLab(l);
      chips.appendChild(b);
    });
    box.appendChild(chips);
    wrap.appendChild(box);
  }

  const hero = diagramFor(level.id, true);
  if (hero) wrap.appendChild(hero);

  level.lesson.forEach(html => wrap.appendChild(el('div', 'lesson-card', html)));

  const totalStages = allStages(level).length;
  const bonusCount = level.stages.filter(s => s.bonus).length;
  if (bonusCount) wrap.appendChild(el('p', 'bonus-note',
    `🎁 Is level mein ${bonusCount} bonus "Good to Know" round hai — extra XP!`));
  wrap.appendChild(el('p', 'bonus-note', '🎤 Aakhri mein Interview Round hoga — asli interview jaise sawal!'));

  const replay = KG.state.completed.includes(level.id);
  if (replay) wrap.appendChild(el('p', 'replay-note', '🔁 Replay — pehle complete kar chuke ho, XP nahi milega (par stars sudhar sakte hain!)'));

  const row = el('div', 'btnrow');
  const back = el('button', 'btn ghost', '← Level map');
  back.onclick = () => showTrack(track);
  const res = KG.getResume();
  const resumeHere = res && res.levelId === level.id && res.stageIdx > 0;
  const start = el('button', resumeHere ? 'btn ghost' : 'btn big',
    resumeHere ? '↺ Shuru se karo' : `🎮 Shuru karo (${totalStages} challenges)`);
  start.onclick = () => {
    KG.state.levelStarts++;
    KG.saveState();
    const begin = () => {
      KG.session = { level, stageIdx: 0, firstTry: 0, total: 0, replay };
      runStage();
    };
    // Surprise pop quiz: har ~2nd level start par, purane concepts ka quick check
    const pool = KG.harvestQuestions().filter(q => q.from.id !== level.id);
    if (!replay && KG.state.completed.length >= 2 && KG.state.levelStarts % 2 === 0 && pool.length >= 3)
      showPopQuiz(pool, begin);
    else begin();
  };
  row.append(back, start);
  if (resumeHere) {
    const cont = el('button', 'btn big', `▶ Challenge ${Math.min(res.stageIdx, totalStages - 1) + 1}/${totalStages} se continue karo`);
    cont.onclick = () => resumeLevel(res);
    row.appendChild(cont);
  }
  wrap.appendChild(row);
  appEl.appendChild(wrap);
  window.scrollTo(0, 0);
}

/* ▶ resume — checkpoint se session wapas banao (stage list badal gayi ho toh clamp) */
function resumeLevel(res) {
  const stages = allStages(res.level);
  KG.session = { level: res.level, stageIdx: Math.max(0, Math.min(res.stageIdx, stages.length)),
                 firstTry: res.firstTry || 0, total: res.total || 0,
                 replay: res.replay || KG.state.completed.includes(res.level.id) };
  if (KG.session.stageIdx >= stages.length) levelComplete();
  else runStage();
}

/* ============================================================
   SURPRISE POP QUIZ — purane levels se 3 random sawal
   ============================================================ */
function showPopQuiz(pool, onFinish) {
  const qs = KG.shuffle(pool).slice(0, 3);
  let qi = 0, correct = 0;
  appEl.innerHTML = '';
  const wrap = el('section', 'panel');
  wrap.innerHTML = `<div class="popquiz-banner">🎲 SURPRISE POP QUIZ</div>
    <p class="instructions">Purane concepts yaad hain? 3 quick sawal — sahi jawab par +${KG.POP_XP} bonus XP, galat par koi penalty nahi. (Bhoole hue concepts Dojo mein wapas aa jayenge.)</p>`;
  const arena = el('div', 'arena');
  wrap.appendChild(arena);
  appEl.appendChild(wrap);
  window.scrollTo(0, 0);

  function ask() {
    arena.innerHTML = '';
    const q = qs[qi];
    let answered = false;
    arena.appendChild(el('div', 'quiz-progress', `Sawal ${qi + 1} / ${qs.length} · from: ${q.from.icon} ${q.from.title}`));
    if (q.context) arena.appendChild(el('pre', 'context', escapeHtml(q.context)));
    arena.appendChild(el('div', 'question', q.q));
    const feedback = el('div', 'feedback');
    const choices = el('div', 'choices');
    KG.shuffle(q.choices.map((c, i) => ({ c, i }))).forEach(({ c, i }) => {
      const btn = el('button', 'choice', c);
      btn.onclick = () => {
        if (answered) return;
        answered = true;
        choices.querySelectorAll('.choice').forEach(b => b.disabled = true);
        if (i === q.answer) {
          correct++;
          KG.addXP(KG.POP_XP);
          btn.classList.add('correct');
          feedback.className = 'feedback good';
          feedback.innerHTML = `💡 ${q.explain}`;
        } else {
          btn.classList.add('wrong');
          KG.noteMistake(q.q, `<b>${q.choices[q.answer]}</b><br>${q.explain}`);
          feedback.className = 'feedback bad';
          feedback.innerHTML = `❌ Sahi jawab: <b>${q.choices[q.answer]}</b><br>💡 ${q.explain}`;
        }
        const next = el('button', 'btn', qi + 1 < qs.length ? 'Agla →' : 'Level shuru karo 🎮');
        next.onclick = () => { qi++; if (qi < qs.length) ask(); else onFinish(); };
        arena.appendChild(next);
      };
      choices.appendChild(btn);
    });
    arena.append(choices, feedback);
  }
  ask();
}

/* ============================================================
   STAGE RUNNER — level.stages + 🎤 interview at the end
   ============================================================ */
function allStages(level) {
  const st = level.stages.slice();
  if (level.interview) st.push({ type: 'interview', title: '🎤 Interview Round', ...level.interview });
  return st;
}

function runStage() {
  const session = KG.session;
  const { level, stageIdx } = session;
  const stages = allStages(level);
  const stage = stages[stageIdx];
  appEl.innerHTML = '';
  window.scrollTo(0, 0);
  KG.saveResume(KG.session, stageIdx);   // beech mein chhoda toh agli baar isi challenge se

  const isIv = stage.type === 'interview';
  const wrap = el('section', 'panel' + (stage.bonus ? ' bonus-panel' : '') + (isIv ? ' iv-panel' : ''));
  wrap.appendChild(el('div', 'crumb',
    `${level.icon} ${level.title} — challenge ${stageIdx + 1}/${stages.length}`));
  if (stage.bonus) wrap.appendChild(el('div', 'bonus-banner', '🎁 BONUS ROUND — Good to Know'));
  if (isIv) wrap.appendChild(el('div', 'iv-banner', '🎤 INTERVIEW ROUND'));
  wrap.appendChild(el('h2', 'stage-h', stage.title));
  if (stage.instructions) wrap.appendChild(el('p', 'instructions', stage.instructions));

  const dia = diagramFor(level.id, false);
  if (dia && stage.type !== 'hotspot') {
    const tog = el('button', 'dg-toggle', '📊 Concept diagram dikhao');
    dia.style.display = 'none';
    tog.onclick = () => {
      const show = dia.style.display === 'none';
      dia.style.display = show ? '' : 'none';
      tog.textContent = show ? '📊 Diagram chhupao' : '📊 Concept diagram dikhao';
    };
    wrap.appendChild(tog);
    wrap.appendChild(dia);
  }

  const arena = el('div', 'arena');
  wrap.appendChild(arena);
  appEl.appendChild(wrap);

  const renderer = isIv ? renderInterview : KG.renderers[stage.type];
  if (!renderer) { console.error('Unknown stage type', stage.type); stageDone({ firstTry: 0, total: 0 }, wrap); return; }
  // one-shot: purane "done" buttons dobara click ho jaayein toh stage do baar khatam na ho
  let finished = false;
  renderer(stage, arena, stats => {
    // Delayed renderer callbacks belong to the screen/session that created them.
    if (finished || KG.session !== session || session.stageIdx !== stageIdx || wrap.isConnected === false) return;
    finished = true;
    stageDone(stats, wrap);
  });
}

function stageDone(stats, wrap) {
  const session = KG.session;
  if (!session || wrap.isConnected === false) return;
  const stageIdx = session.stageIdx;
  session.firstTry += stats.firstTry;
  session.total += stats.total;
  const stages = allStages(session.level);
  KG.saveResume(session, stageIdx + 1);   // yeh challenge ho gaya — agli baar agle se
  const perfect = stats.total > 0 && stats.firstTry === stats.total;
  if (perfect) KG.addXP(KG.PERFECT_BONUS);

  const sum = el('div', 'stage-summary pop');
  sum.innerHTML = `
    <div class="sum-emoji">${perfect ? '🌟' : stats.firstTry / (stats.total || 1) >= 0.6 ? '✅' : '😅'}</div>
    <div class="sum-title">${perfect ? 'PERFECT! +' + KG.PERFECT_BONUS + ' XP bonus' : 'Challenge complete'}</div>
    <div class="sum-detail">${stats.firstTry}/${stats.total} first-try sahi</div>`;
  const btn = el('button', 'btn big',
    KG.session.stageIdx + 1 < stages.length ? 'Agla challenge →' : 'Level khatam karo 🏁');
  btn.onclick = () => {
    if (KG.session !== session || session.stageIdx !== stageIdx || wrap.isConnected === false) return;
    btn.disabled = true;
    session.stageIdx++;
    if (session.stageIdx < stages.length) runStage();
    else levelComplete();
  };
  sum.appendChild(btn);
  wrap.appendChild(sum);
  btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ============================================================
   🎤 INTERVIEW — MCQ + embedded terminal tasks
   questions: [{q, choices, answer, explain, context?} | {terminal: {...}}]
   ============================================================ */
function renderInterview(stage, arena, onDone) {
  let qi = 0, firstTry = 0, total = 0;

  function next() {
    qi++;
    if (qi < stage.questions.length) ask();
    else onDone({ firstTry, total });
  }

  function ask() {
    arena.innerHTML = '';
    const q = stage.questions[qi];
    arena.appendChild(el('div', 'quiz-progress', `Interviewer ka sawal ${qi + 1} / ${stage.questions.length}`));

    if (q.terminal) {
      // hands-on interview task — kubectl simulator embedded
      total++;
      const bubble = el('div', 'iv-bubble', `
        <div class="iv-avatar">🧑‍💼</div>
        <div class="iv-q">${q.terminal.goal}</div>`);
      arena.appendChild(bubble);
      const sub = el('div');
      arena.appendChild(sub);
      KG.renderers.terminal(q.terminal, sub, stats => {
        firstTry += stats.firstTry;
        const btn = el('button', 'btn big', qi + 1 < stage.questions.length ? 'Interviewer ka agla sawal →' : 'Interview khatam 🎤');
        btn.onclick = () => { btn.disabled = true; next(); };
        sub.appendChild(btn);
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    total++;
    let mistake = false;
    arena.appendChild(el('div', 'iv-bubble', `
      <div class="iv-avatar">🧑‍💼</div>
      <div class="iv-q">${q.q}</div>`));
    if (q.context) arena.appendChild(el('pre', 'context', escapeHtml(q.context)));
    const feedback = el('div', 'feedback');
    const choices = el('div', 'choices');
    KG.shuffle(q.choices.map((c, i) => ({ c, i }))).forEach(({ c, i }) => {
      const btn = el('button', 'choice', c);
      btn.onclick = () => {
        if (btn.disabled) return;
        if (i === q.answer) {
          if (!mistake) { firstTry++; KG.addXP(KG.XP_PER_ITEM); }
          btn.classList.add('correct');
          choices.querySelectorAll('.choice').forEach(b => b.disabled = true);
          feedback.className = 'feedback good';
          feedback.innerHTML = `💡 ${q.explain}`;
          const nx = el('button', 'btn', qi + 1 < stage.questions.length ? 'Agla sawal →' : 'Interview khatam 🎤');
          nx.onclick = () => { nx.disabled = true; next(); };
          arena.appendChild(nx);
          nx.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          if (!mistake) KG.noteMistake(`🎤 ${q.q}`, `<b>${q.choices[q.answer]}</b><br>${q.explain}`);
          mistake = true;
          btn.classList.add('wrong');
          btn.disabled = true;
          shake(btn);
          feedback.className = 'feedback bad';
          feedback.innerHTML = '❌ Interviewer ne bhaun chadha li 🤨 — ek aur try?';
        }
      };
      choices.appendChild(btn);
    });
    arena.append(choices, feedback);
  }

  ask();
}

/* ============================================================
   LEVEL COMPLETE — success criteria + homework + Dojo cards
   ============================================================ */
function levelComplete() {
  const { level, firstTry, total, replay } = KG.session;
  const acc = total ? firstTry / total : 1;
  const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;

  const firstClear = !KG.state.completed.includes(level.id);
  if (firstClear) {
    KG.state.completed.push(level.id);
    KG.enrollLevelCards(level);
  }
  if (KG.state.resume && KG.state.resume.levelId === level.id) KG.state.resume = null;
  KG.state.stars[level.id] = Math.max(KG.state.stars[level.id] || 0, stars);
  KG.touchStreak();
  KG.saveState();
  renderTopbar();

  appEl.innerHTML = '';
  const wrap = el('section', 'panel complete pop');
  wrap.innerHTML = `
    <div class="confetti">🎉</div>
    <h2>Level complete!</h2>
    <div class="big-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    <div class="earned-badge">🏅 Badge mila: <b>${level.badge}</b></div>
    <div class="sum-detail">${firstTry}/${total} first-try sahi${replay ? ' · replay (no XP)' : ''}</div>`;

  if (level.success && level.success.length) {
    wrap.appendChild(el('h3', '', '✔ Ab tum yeh kar sakte ho:'));
    wrap.appendChild(el('ul', 'success-list', level.success.map(s => `<li>${s}</li>`).join('')));
  }

  if (firstClear && (level.cards || []).length) {
    wrap.appendChild(el('p', 'bonus-note',
      `🧘 ${level.cards.length} flashcards Revision Dojo mein add hue — kal se revise karna, bhoolna mat!`));
  }

  if (level.homework) {
    wrap.appendChild(el('div', 'homework', `
      <h4>🏋️ Real Cluster Homework (optional — WSL par minikube/kind chahiye)</h4>
      ${level.homework}`));
  }

  const track = KG.trackOf(level);
  const levels = KG.levelsOf(track);
  const row = el('div', 'btnrow center');
  const home = el('button', 'btn ghost', 'Level map');
  home.onclick = () => showTrack(track);
  row.appendChild(home);

  const idx = levels.indexOf(level);
  if (idx + 1 < levels.length) {
    const next = el('button', 'btn big', `Agla: ${levels[idx + 1].icon} ${levels[idx + 1].title} →`);
    next.onclick = () => showIntro(levels[idx + 1]);
    row.appendChild(next);
  } else {
    const cert = el('button', 'btn big gold', `🏆 ${track.certTitle} certificate lo!`);
    cert.onclick = () => showCertificate(track);
    row.appendChild(cert);
  }
  wrap.appendChild(row);
  appEl.appendChild(wrap);
  window.scrollTo(0, 0);
}

/* ============================================================
   🧘 REVISION DOJO — spaced-repetition flashcards
   ============================================================ */
function showDojo() {
  KG.session = null;
  appEl.innerHTML = '';
  window.scrollTo(0, 0);

  const wrap = el('section', 'panel');
  const back = el('button', 'btn ghost small', '← Home');
  back.onclick = showHome;
  wrap.appendChild(back);
  wrap.appendChild(el('div', 'dojo-head', '<h2>🧘 Revision Dojo</h2>'));

  const queue = KG.shuffle(KG.dueCards());
  const deckSize = Object.keys(KG.state.dojo).length;

  if (!queue.length) {
    const nextDue = Object.values(KG.state.dojo).reduce((m, c) => Math.min(m, c.due), Infinity);
    const days = nextDue === Infinity ? null : Math.max(0, Math.ceil((nextDue - Date.now()) / KG.DAY));
    wrap.appendChild(el('div', 'dojo-done', `
      <div class="big">🧘</div>
      <h3>Aaj koi card due nahi hai!</h3>
      <p class="dojo-count">${deckSize
        ? `Deck mein ${deckSize} cards hain. ${days != null ? `Agla revision ~${days} din mein.` : ''} Naye levels khel ke aur cards kamao.`
        : 'Levels complete karo — unke concepts flashcards ban ke yahan aayenge, spaced-repetition ke saath.'}</p>`));
    appEl.appendChild(wrap);
    return;
  }

  let i = 0, remembered = 0;
  const counter = el('p', 'dojo-count');
  const cardBox = el('div');
  wrap.append(counter, cardBox);
  appEl.appendChild(wrap);

  function showCard() {
    counter.textContent = `Card ${i + 1} / ${queue.length} · yaad rakha toh agla revision aur door chala jayega`;
    const c = queue[i];
    cardBox.innerHTML = '';
    const fc = el('div', 'flashcard pop');
    const inner = el('div', 'fc-inner');
    inner.append(
      el('div', 'fc-tag', c.tag || 'Flashcard'),
      el('div', 'fc-front', c.front),
    );
    const revealBtn = el('button', 'btn', '🔍 Jawab dikhao');
    revealBtn.onclick = () => {
      revealBtn.remove();
      inner.appendChild(el('div', 'fc-back', c.back));
      const row = el('div', 'btnrow center');
      const nope = el('button', 'btn danger', '😅 Bhool gaya');
      const yep = el('button', 'btn good', '😎 Yaad tha!');
      nope.onclick = () => { KG.reviewCard(c.id, false); nextCard(); };
      yep.onclick = () => { KG.reviewCard(c.id, true); remembered++; KG.addXP(KG.CARD_XP); nextCard(); };
      row.append(nope, yep);
      inner.appendChild(row);
    };
    inner.appendChild(revealBtn);
    fc.appendChild(inner);
    cardBox.appendChild(fc);
  }

  function nextCard() {
    i++;
    if (i < queue.length) { showCard(); return; }
    counter.textContent = '';
    cardBox.innerHTML = '';
    cardBox.appendChild(el('div', 'dojo-done pop', `
      <div class="big">🙏</div>
      <h3>Aaj ka revision ho gaya!</h3>
      <p class="dojo-count">${remembered}/${queue.length} yaad the.
      ${remembered < queue.length ? 'Jo bhool gaye, woh kal phir aayenge — tab tak pakka yaad ho jayega.' : 'Sab yaad! Intervals badh gaye — concepts ab lambe time tak saath rahenge.'}</p>`));
    const home = el('button', 'btn big', 'Home →');
    home.onclick = showHome;
    cardBox.appendChild(home);
  }

  showCard();
}

/* ============================================================
   CERTIFICATE
   ============================================================ */
function showCertificate(track) {
  appEl.innerHTML = '';
  const levels = KG.levelsOf(track);
  const totalStars = levels.reduce((s, l) => s + (KG.state.stars[l.id] || 0), 0);
  const maxStars = levels.length * 3;
  const wrap = el('section', 'panel cert pop');
  wrap.innerHTML = `
    <div class="cert-inner">
      <div class="cert-crown">${track.icon}</div>
      <h1>${track.certTitle}</h1>
      <p class="cert-sub">${track.certSub}</p>
      <p>ne ${track.name} ke saare ${levels.length} levels jeet liye</p>
      <div class="cert-stars">${'★'.repeat(Math.min(totalStars, maxStars))} <span>(${totalStars}/${maxStars} stars · ${KG.state.xp} XP total)</span></div>
      <div class="cert-badges">${levels.map(l => `<span title="${l.badge}">${l.icon}</span>`).join('')}</div>
      <p class="cert-formula">${track.formula}</p>
      <p class="cert-motto">${track.motto}</p>
    </div>`;
  const back = el('button', 'btn ghost', '← Level map');
  back.onclick = () => showTrack(track);
  wrap.appendChild(back);
  appEl.appendChild(wrap);
}

/* ---------------- boot ---------------- */
renderTopbar();
showHome();
