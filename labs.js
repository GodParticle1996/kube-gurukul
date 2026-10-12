/* =====================================================================
   KubeGurukul — Interactive Labs
   triage | slider | flow | board

   Yeh chaar renderers baaki games se ek cheez mein alag hain: inme
   "sahi option yaad karo" nahi hai. Learner koi knob ghumata hai ya koi
   command chalata hai, aur simulator turant NAYA number ya NAYA output
   deta hai. Number hardcoded nahi hai — number compute hota hai.

   Har renderer ka contract wahi hai jo games.js ka hai:
       (stage, arena, onDone) => onDone({ firstTry, total })

   NOTE: poori file ek IIFE mein lipti hai. games.js already global scope
   par `const el`, `const shuffle` declare karta hai — labs.js bina IIFE ke
   wahi naam dobara declare karta aur browser SyntaxError deta.
   ===================================================================== */

(function () {
  const el = KG.el, shuffle = KG.shuffle, shake = KG.shake, escapeHtml = KG.escapeHtml;

  /* ---------------------------------------------------------------
     KG.allOf(TASKS) — mission ka success() usi checklist se banao jo
     UI mein dikhti hai. Warna success() tasks se AAGE nikal jaata hai:
     mission "done" ho jaata hai jabki checklist ka aakhri item abhi
     bacha hai, aur learner ka aakhri kadam kabhi chalta hi nahi.
     (Yeh bug SQL Gurukul aur System Gurukul dono mein pakda gaya tha.)
     --------------------------------------------------------------- */
  KG.allOf = tasks => sim => tasks.every(t => t.check(sim));

  /* headless validator mein setInterval nahi hota — har jagah guard */
  const hasTimers = typeof setInterval === 'function';
  const stopTimer = id => { if (id && typeof clearInterval === 'function') clearInterval(id); };

  /* =============================================================
     LAB 1: TRIAGE — KodeKloud-style diagnostic ladder
     -------------------------------------------------------------
     Symptom milta hai. Command palette milti hai. Learner khud
     decide karta hai ki AGLA command kaunsa chalana hai; har command
     apna asli output ugalti hai. Kuch commands clue dete hain, kuch
     dead-end hain (aur dead-end hona bhi ek sabak hai).

     Verdict panel tab khulta hai jab saare clue-commands chal jaayein
     (ya jab palette ki har command chal jaaye — isliye lab hamesha
     solvable hai, learner kisi bhi order mein chale).

     stage: {
       type: 'triage', title, instructions,
       symptom: 'HTML — pager/user report',
       commands: [ { cmd, out, clue: true|false, note } ],
       questions: [ { q, choices, answer, explain } ]   // verdict + fix
     }
     ============================================================= */
  KG.renderers.triage = function renderTriage(stage, arena, onDone) {
    const cmds = stage.commands;
    const clues = cmds.filter(c => c.clue);
    const ran = new Set();
    let unlocked = false;

    const symptom = el('div', 'tg-symptom', `<div class="tg-symptom-h">📟 Symptom</div>${stage.symptom}`);

    const goal = el('div', 'lab-goal',
      `🎯 <b>KAAM:</b> pehle diagnose karo, phir root cause batao. ` +
      `Har command ka asli output milega — jaldbaazi mein guess mat karo.`);

    const progress = el('div', 'tg-progress');
    const palette = el('div', 'tg-palette');
    const term = el('div', 'tg-term', '<div class="tg-term-empty">Koi command abhi chalayi nahi. Neeche se ek chuno. 👇</div>');
    const verdictBox = el('div', 'tg-verdict');

    cmds.forEach((c, i) => {
      const btn = el('button', 'tg-cmd', `<code>${escapeHtml(c.cmd)}</code>`);
      btn.dataset.cmd = String(i);
      btn.onclick = () => runCmd(c, btn);
      palette.appendChild(btn);
    });

    function paint() {
      const found = clues.filter(c => ran.has(c.cmd)).length;
      progress.innerHTML =
        `<span class="tg-pill">🔎 Clues mile: <b>${found}/${clues.length}</b></span>` +
        `<span class="tg-pill tg-dim">🖥️ Commands chalayi: <b>${ran.size}/${cmds.length}</b></span>`;
      if (!unlocked && (found === clues.length || ran.size === cmds.length)) {
        unlocked = true;
        showVerdict();
      }
    }

    function runCmd(c, btn) {
      if (ran.has(c.cmd)) return;
      ran.add(c.cmd);
      btn.classList.add('done');
      btn.disabled = true;
      if (term.querySelector('.tg-term-empty')) term.innerHTML = '';
      const block = el('div', 'tg-block' + (c.clue ? ' is-clue' : ''));
      block.innerHTML =
        `<div class="tg-cmdline">$ ${escapeHtml(c.cmd)}</div>` +
        `<pre class="tg-out">${escapeHtml(c.out)}</pre>` +
        `<div class="tg-note">${c.clue ? '🔎 <b>CLUE</b> — ' : '⚪ '}${c.note}</div>`;
      term.appendChild(block);
      block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      paint();
    }

    /* ---- verdict: root cause + fix, quiz jaisa scored ---- */
    let qi = 0, firstTry = 0;
    function showVerdict() {
      verdictBox.innerHTML = '';
      verdictBox.appendChild(el('div', 'tg-verdict-h', '🧠 Ab batao — evidence tumhare saamne hai'));
      askQ();
      verdictBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function askQ() {
      const q = stage.questions[qi];
      let mistake = false;
      const holder = el('div', 'tg-q');
      holder.appendChild(el('div', 'quiz-progress', `Sawal ${qi + 1} / ${stage.questions.length}`));
      holder.appendChild(el('div', 'question', q.q));
      const feedback = el('div', 'feedback');
      const choices = el('div', 'choices');
      shuffle(q.choices.map((c, i) => ({ c, i }))).forEach(({ c, i }) => {
        const btn = el('button', 'choice', c);
        btn.onclick = () => {
          if (btn.disabled) return;
          if (i === q.answer) {
            if (!mistake) { firstTry++; KG.addXP(KG.XP_PER_ITEM); }
            btn.classList.add('correct');
            choices.querySelectorAll('.choice').forEach(b => b.disabled = true);
            feedback.className = 'feedback good';
            feedback.innerHTML = `💡 ${q.explain}`;
            const next = el('button', 'btn', qi + 1 < stage.questions.length ? 'Agla sawal →' : 'Diagnosis band karo ✓');
            next.onclick = () => {
              next.disabled = true;
              qi++;
              if (qi < stage.questions.length) { verdictBox.innerHTML = ''; verdictBox.appendChild(el('div', 'tg-verdict-h', '🧠 Aur ek sawal')); askQ(); }
              else onDone({ firstTry, total: stage.questions.length });
            };
            holder.appendChild(next);
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            if (!mistake) KG.noteMistake(q.q, `<b>${q.choices[q.answer]}</b><br>${q.explain}`);
            mistake = true;
            btn.classList.add('wrong');
            btn.disabled = true;
            shake(btn);
            feedback.className = 'feedback bad';
            feedback.innerHTML = '❌ Nahi — output dobara padho, jawab wahin likha hai.';
          }
        };
        choices.appendChild(btn);
      });
      holder.append(choices, feedback);
      verdictBox.appendChild(holder);
    }

    arena.append(symptom, goal, progress, term, el('div', 'tg-palette-h', '🖥️ Kaunsa command chalaoge?'), palette, verdictBox);
    paint();
  };

  /* =============================================================
     LAB 2: SLIDER — knob ghumao, number khud badalta hai
     -------------------------------------------------------------
     stage: {
       type: 'slider', title, instructions,
       scenario: 'HTML — problem statement',
       goal: 'text — kya haasil karna hai',
       knobs: [ { id, label, min, max, step, value, unit, fmt? } ],
       readouts: k => [ { label, value, state:'good'|'warn'|'bad', hint } ],
       bars:    k => [ { label, pct, state, cap } ],          // optional
       verdict: k => ({ ok, text }),
       check:   k => bool,                                     // goal poora?
       lesson:  'HTML — goal ke baad dikhta hai',
       quiz:    { q, choices, answer, explain }                // scored test
     }
     ============================================================= */
  KG.renderers.slider = function renderSlider(stage, arena, onDone) {
    const k = {};
    stage.knobs.forEach(kn => { k[kn.id] = kn.value; });
    let solved = false, firstTry = 0;
    const total = stage.quiz ? 2 : 1;

    if (stage.scenario) arena.appendChild(el('div', 'lab-scenario', stage.scenario));
    arena.appendChild(el('div', 'lab-goal', `🎯 <b>KAAM:</b> ${stage.goal}`));

    const knobBox = el('div', 'lab-knobs');
    const outBox = el('div', 'lab-readouts');
    const barBox = el('div', 'lab-bars');
    const verdictBox = el('div', 'lab-verdict');
    const after = el('div', 'lab-after');

    stage.knobs.forEach(kn => {
      const row = el('div', 'lk-row');
      const val = el('span', 'lk-val');
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'lk-range';
      input.min = String(kn.min); input.max = String(kn.max);
      input.step = String(kn.step == null ? 1 : kn.step);
      input.value = String(kn.value);
      input.addEventListener('input', () => { k[kn.id] = +input.value; paint(); });
      row.innerHTML = `<span class="lk-label">${kn.label}</span>`;
      row.append(input, val);
      row._val = val; row._knob = kn;
      knobBox.appendChild(row);
    });

    function fmtKnob(kn) {
      const v = k[kn.id];
      return kn.fmt ? kn.fmt(v) : v + (kn.unit || '');
    }

    function paint() {
      knobBox.querySelectorAll('.lk-row').forEach(r => { r._val.textContent = fmtKnob(r._knob); });

      outBox.innerHTML = stage.readouts(k).map(o =>
        `<div class="lo-row is-${o.state || 'neutral'}">
           <span class="lo-label">${o.label}</span>
           <span class="lo-val">${o.value}</span>
           <span class="lo-hint">${o.hint || ''}</span>
         </div>`).join('');

      if (stage.bars) {
        barBox.innerHTML = stage.bars(k).map(b =>
          `<div class="lb-row">
             <span class="lb-label">${b.label}</span>
             <span class="lb-track"><span class="lb-fill is-${b.state || 'neutral'}" style="width:${Math.max(0, Math.min(100, b.pct))}%"></span></span>
             <span class="lb-cap">${b.cap || ''}</span>
           </div>`).join('');
      }

      const v = stage.verdict(k);
      verdictBox.className = 'lab-verdict ' + (v.ok ? 'is-good' : 'is-bad');
      verdictBox.innerHTML = (v.ok ? '✅ ' : '⚠️ ') + v.text;

      if (!solved && stage.check(k)) {
        solved = true;
        firstTry++;
        KG.addXP(KG.XP_PER_ITEM);
        showAfter();
      }
    }

    function showAfter() {
      after.innerHTML = '';
      const win = el('div', 'lab-win pop', `🎯 <b>Goal poora.</b> ${stage.lesson || ''}`);
      after.appendChild(win);
      if (stage.quiz) askQuiz();
      else {
        const btn = el('button', 'btn big', 'Aage badho →');
        btn.onclick = () => { btn.disabled = true; onDone({ firstTry, total }); };
        after.appendChild(btn);
      }
      after.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function askQuiz() {
      const q = stage.quiz;
      let mistake = false;
      after.appendChild(el('div', 'question', q.q));
      const feedback = el('div', 'feedback');
      const choices = el('div', 'choices');
      shuffle(q.choices.map((c, i) => ({ c, i }))).forEach(({ c, i }) => {
        const btn = el('button', 'choice', c);
        btn.onclick = () => {
          if (btn.disabled) return;
          if (i === q.answer) {
            if (!mistake) { firstTry++; KG.addXP(KG.XP_PER_ITEM); }
            btn.classList.add('correct');
            choices.querySelectorAll('.choice').forEach(b => b.disabled = true);
            feedback.className = 'feedback good';
            feedback.innerHTML = `💡 ${q.explain}`;
            const next = el('button', 'btn big', 'Aage badho →');
            next.onclick = () => { next.disabled = true; onDone({ firstTry, total }); };
            after.appendChild(next);
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            if (!mistake) KG.noteMistake(q.q, `<b>${q.choices[q.answer]}</b><br>${q.explain}`);
            mistake = true;
            btn.classList.add('wrong');
            btn.disabled = true;
            shake(btn);
            feedback.className = 'feedback bad';
            feedback.innerHTML = '❌ Nahi — slider ko ghuma ke dobara dekho kya hota hai.';
          }
        };
        choices.appendChild(btn);
      });
      after.append(choices, feedback);
    }

    arena.append(knobBox, outBox, barBox, verdictBox, after);
    paint();
  };

  /* =============================================================
     LAB 3: FLOW — kadam-dar-kadam player (play / pause / next)
     -------------------------------------------------------------
     Lambe paragraph ki jagah animation. Har step ek lane mein
     highlight hota hai. Kuch steps par flow RUK jaata hai aur sawal
     poochta hai — sirf sahi jawab ke baad aage badhta hai.

     stage: {
       type: 'flow', title, instructions,
       lanes: [ { id, label, icon } ],
       steps: [ { lane, t, detail, ask?: { q, choices, answer, explain } } ],
       summary: 'HTML'
     }
     ============================================================= */
  KG.renderers.flow = function renderFlow(stage, arena, onDone) {
    let i = -1, firstTry = 0, playing = false, timer = null, waiting = false;
    const asks = stage.steps.filter(s => s.ask).length;
    const total = asks || 1;

    arena.appendChild(el('div', 'lab-goal',
      `🎯 <b>KAAM:</b> flow chalao aur beech mein poochhe gaye sawal ka jawab do. ` +
      `Har kadam kaun kar raha hai — lane ka naam dhyaan se dekho.`));

    const laneBox = el('div', 'fl-lanes');
    const laneEls = {};
    stage.lanes.forEach(l => {
      const node = el('div', 'fl-lane');
      node.innerHTML = `<span class="fl-icon">${l.icon}</span><span class="fl-name">${l.label}</span>`;
      laneEls[l.id] = node;
      laneBox.appendChild(node);
    });

    const stepBox = el('div', 'fl-steps');
    const detail = el('div', 'fl-detail', '<i>▶ dabao — flow shuru hoga.</i>');
    const askBox = el('div', 'fl-ask');
    const ctrl = el('div', 'fl-ctrl');
    const playBtn = el('button', 'btn small', '▶ Chalao');
    const nextBtn = el('button', 'btn small ghost', '⏭ Agla kadam');
    const backBtn = el('button', 'btn small ghost', '⏮ Wapas');
    ctrl.append(playBtn, nextBtn, backBtn);

    stage.steps.forEach((s, n) => {
      const lane = stage.lanes.find(l => l.id === s.lane);
      const row = el('div', 'fl-step');
      row.innerHTML = `<span class="fl-n">${n + 1}</span>` +
        `<span class="fl-who">${lane ? lane.icon + ' ' + lane.label : s.lane}</span>` +
        `<span class="fl-t">${s.t}</span>` +
        (s.ask ? '<span class="fl-q">❓</span>' : '');
      stepBox.appendChild(row);
    });

    playBtn.onclick = () => { playing ? pause() : play(); };
    nextBtn.onclick = () => { pause(); step(); };
    backBtn.onclick = () => {
      pause();
      if (waiting || i <= 0) return;
      i -= 2; step();
    };

    function play() {
      if (!hasTimers) { step(); return; }
      playing = true; playBtn.textContent = '⏸ Rok do';
      timer = setInterval(step, 1500);
    }
    function pause() {
      playing = false; playBtn.textContent = '▶ Chalao';
      stopTimer(timer); timer = null;
    }

    function step() {
      if (waiting) return;
      i++;
      if (i >= stage.steps.length) { pause(); finish(); return; }
      const s = stage.steps[i];
      stepBox.querySelectorAll('.fl-step').forEach((r, n) => {
        r.classList.remove('now');
        if (n < i) r.classList.add('past');
        if (n === i) r.classList.add('now');
        if (n > i) r.classList.remove('past');
      });
      Object.values(laneEls).forEach(n => n.classList.remove('active'));
      if (laneEls[s.lane]) laneEls[s.lane].classList.add('active');
      detail.innerHTML = s.detail || s.t;
      const row = stepBox.querySelectorAll('.fl-step')[i];
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (s.ask) { pause(); ask(s.ask); }
    }

    function ask(q) {
      waiting = true;
      let mistake = false;
      askBox.innerHTML = '';
      askBox.appendChild(el('div', 'question', '⏸ ' + q.q));
      const feedback = el('div', 'feedback');
      const choices = el('div', 'choices');
      shuffle(q.choices.map((c, n) => ({ c, n }))).forEach(({ c, n }) => {
        const btn = el('button', 'choice', c);
        btn.onclick = () => {
          if (btn.disabled) return;
          if (n === q.answer) {
            if (!mistake) { firstTry++; KG.addXP(KG.XP_PER_ITEM); }
            btn.classList.add('correct');
            choices.querySelectorAll('.choice').forEach(b => b.disabled = true);
            feedback.className = 'feedback good';
            feedback.innerHTML = `💡 ${q.explain}`;
            const go = el('button', 'btn', 'Flow aage chalao →');
            go.onclick = () => { go.disabled = true; waiting = false; askBox.innerHTML = ''; step(); };
            askBox.appendChild(go);
            go.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            if (!mistake) KG.noteMistake(q.q, `<b>${q.choices[q.answer]}</b><br>${q.explain}`);
            mistake = true;
            btn.classList.add('wrong');
            btn.disabled = true;
            shake(btn);
            feedback.className = 'feedback bad';
            feedback.innerHTML = '❌ Nahi — upar wale kadam dobara padho.';
          }
        };
        choices.appendChild(btn);
      });
      askBox.append(choices, feedback);
      askBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function finish() {
      if (!asks) { firstTry = 1; KG.addXP(KG.XP_PER_ITEM); }
      detail.innerHTML = stage.summary || '✅ Flow poora.';
      ctrl.innerHTML = '';
      const btn = el('button', 'btn big', 'Aage badho →');
      btn.onclick = () => { btn.disabled = true; onDone({ firstTry, total }); };
      ctrl.appendChild(btn);
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    arena.append(laneBox, stepBox, detail, askBox, ctrl);
  };

  /* =============================================================
     LAB 4: BOARD — pod ko node par rakho (asli scheduler predicates)
     -------------------------------------------------------------
     Yeh mini-scheduler asli kubernetes ke predicates ka order follow
     karta hai: nodeSelector → taints → podAntiAffinity → capacity.
     Pod select karte hi HAR node turant ✅/❌ dikhata hai, aur ❌ ke
     saath wahi wajah likhi hoti hai jo asli FailedScheduling event
     mein aati: "0/N nodes are available: ...".

     stage: {
       type: 'board', title, instructions, goal,
       nodes: [ { id, name, labels:{}, taints:[{key,value,effect}], cpu, mem, usedCpu, usedMem } ],
       pods:  [ { id, name, cpu, mem, nodeSelector:{}, tolerations:[{key,value,operator,effect}],
                  spread:'label-value' } ],   // spread = podAntiAffinity (hostname topology)
       lesson: 'HTML'
     }
     ============================================================= */

  /* ek pod ek node par ja sakta hai? → { ok, reason } */
  function fitCheck(pod, node, placement, pods) {
    /* 1. nodeSelector / required nodeAffinity */
    const sel = pod.nodeSelector || {};
    for (const key of Object.keys(sel)) {
      if ((node.labels || {})[key] !== sel[key])
        return { ok: false, reason: `node par label <code>${key}=${sel[key]}</code> nahi hai — pod ka nodeSelector match nahi hua` };
    }
    /* 2. taints vs tolerations */
    for (const taint of (node.taints || [])) {
      if (taint.effect === 'PreferNoSchedule') continue;
      const tolerated = (pod.tolerations || []).some(tol => {
        if (tol.operator === 'Exists') return !tol.key || tol.key === taint.key;
        return tol.key === taint.key && tol.value === taint.value;
      });
      if (!tolerated)
        return { ok: false, reason: `node par taint <code>${taint.key}=${taint.value}:${taint.effect}</code> hai aur pod ke paas uski toleration nahi hai` };
    }
    /* 3. podAntiAffinity — same spread group ka pod pehle se isi node par? */
    if (pod.spread) {
      const clash = Object.entries(placement).find(([pid, nid]) => {
        if (pid === pod.id || nid !== node.id) return false;
        const other = pods.find(p => p.id === pid);
        return other && other.spread === pod.spread;
      });
      if (clash) {
        const other = pods.find(p => p.id === clash[0]);
        return { ok: false, reason: `podAntiAffinity — <code>${other.name}</code> (same group <code>${pod.spread}</code>) pehle se isi node par hai` };
      }
    }
    /* 4. capacity */
    let cpu = node.usedCpu || 0, mem = node.usedMem || 0;
    Object.entries(placement).forEach(([pid, nid]) => {
      if (nid !== node.id || pid === pod.id) return;
      const p = pods.find(x => x.id === pid);
      if (p) { cpu += p.cpu; mem += p.mem; }
    });
    if (cpu + pod.cpu > node.cpu)
      return { ok: false, reason: `Insufficient cpu — node par ${(node.cpu - cpu).toFixed(1)} CPU bachi hai, pod ${pod.cpu} maang raha hai` };
    if (mem + pod.mem > node.mem)
      return { ok: false, reason: `Insufficient memory — node par ${(node.mem - mem).toFixed(1)}Gi bachi hai, pod ${pod.mem}Gi maang raha hai` };
    return { ok: true, reason: 'sab predicates pass — scheduler yahan bind karega' };
  }
  KG.fitCheck = fitCheck;   /* validator solvability sweep ke liye */

  KG.renderers.board = function renderBoard(stage, arena, onDone) {
    const placement = {};                 /* podId -> nodeId */
    const wrongOnce = new Set();
    let selected = null, firstTry = 0, placed = 0;
    const total = stage.pods.length;

    arena.appendChild(el('div', 'lab-goal', `🎯 <b>KAAM:</b> ${stage.goal}`));
    const nodeRow = el('div', 'bd-nodes');
    const feedback = el('div', 'feedback');
    const podRow = el('div', 'bd-pods');
    const after = el('div', 'lab-after');

    const nodeEls = {};
    stage.nodes.forEach(n => {
      const box = el('div', 'bd-node');
      box.dataset.node = n.id;
      box.addEventListener('click', () => { if (selected) attempt(selected, n); });
      box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); });
      box.addEventListener('dragleave', () => box.classList.remove('over'));
      box.addEventListener('drop', e => {
        e.preventDefault(); box.classList.remove('over');
        const pid = e.dataTransfer.getData('text/plain');
        const pod = stage.pods.find(p => p.id === pid);
        if (pod) attempt(pod, n);
      });
      nodeEls[n.id] = box;
      nodeRow.appendChild(box);
    });

    const podEls = {};
    stage.pods.forEach(p => {
      const chip = el('div', 'bd-pod');
      chip.draggable = true;
      chip.dataset.pod = p.id;
      chip.innerHTML = `<span class="bd-pname">${p.name}</span>` +
        `<span class="bd-preq">${p.cpu} CPU · ${p.mem}Gi</span>` +
        (p.nodeSelector && Object.keys(p.nodeSelector).length
          ? `<span class="bd-ptag">nodeSelector: ${Object.entries(p.nodeSelector).map(([a, b]) => a + '=' + b).join(', ')}</span>` : '') +
        ((p.tolerations || []).length
          ? `<span class="bd-ptag ok">tolerates: ${p.tolerations.map(t => t.key + (t.operator === 'Exists' ? ' (Exists)' : '=' + t.value)).join(', ')}</span>` : '') +
        (p.spread ? `<span class="bd-ptag warn">antiAffinity group: ${p.spread}</span>` : '');
      chip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', p.id); select(p); });
      chip.addEventListener('click', () => select(selected === p ? null : p));
      podEls[p.id] = chip;
      podRow.appendChild(chip);
    });

    function select(p) {
      selected = p;
      Object.values(podEls).forEach(c => c.classList.remove('selected'));
      if (p) podEls[p.id].classList.add('selected');
      paint();
    }

    function paint() {
      stage.nodes.forEach(n => {
        const box = nodeEls[n.id];
        let cpu = n.usedCpu || 0, mem = n.usedMem || 0;
        const mine = [];
        Object.entries(placement).forEach(([pid, nid]) => {
          if (nid !== n.id) return;
          const p = stage.pods.find(x => x.id === pid);
          if (p) { cpu += p.cpu; mem += p.mem; mine.push(p); }
        });
        const verdict = selected ? fitCheck(selected, n, placement, stage.pods) : null;
        box.className = 'bd-node' + (verdict ? (verdict.ok ? ' fits' : ' nofit') : '');
        box.innerHTML =
          `<div class="bd-nname">🖥️ ${n.name}</div>` +
          `<div class="bd-nlabels">${Object.entries(n.labels || {}).map(([a, b]) => `<span class="bd-lab">${a}=${b}</span>`).join('') || '<span class="bd-lab dim">koi label nahi</span>'}</div>` +
          `<div class="bd-ntaints">${(n.taints || []).map(t => `<span class="bd-taint">🚫 ${t.key}=${t.value}:${t.effect}</span>`).join('') || '<span class="bd-lab dim">koi taint nahi</span>'}</div>` +
          `<div class="bd-bar"><span style="width:${Math.min(100, cpu / n.cpu * 100)}%"></span></div>` +
          `<div class="bd-cap">CPU ${cpu}/${n.cpu} · MEM ${mem}/${n.mem}Gi</div>` +
          `<div class="bd-mine">${mine.map(p => `<span class="bd-run">✔ ${p.name}</span>`).join('') || ''}</div>` +
          (verdict ? `<div class="bd-verdict ${verdict.ok ? 'ok' : 'no'}">${verdict.ok ? '✅ schedule hoga' : '❌ ' + verdict.reason}</div>` : '');
      });
    }

    function attempt(pod, node) {
      if (placement[pod.id]) return;
      const v = fitCheck(pod, node, placement, stage.pods);
      if (v.ok) {
        if (!wrongOnce.has(pod.id)) { firstTry++; KG.addXP(KG.XP_PER_ITEM); }
        placement[pod.id] = node.id;
        placed++;
        podEls[pod.id].classList.add('placed');
        podEls[pod.id].draggable = false;
        selected = null;
        Object.values(podEls).forEach(c => c.classList.remove('selected'));
        feedback.className = 'feedback good';
        feedback.innerHTML = `✅ <b>${pod.name}</b> → <b>${node.name}</b> — ${v.reason}`;
        paint();
        if (placed === total) win();
      } else {
        wrongOnce.add(pod.id);
        KG.noteMistake(`${pod.name} ko ${node.name} par kyun schedule nahi kiya ja sakta?`, v.reason);
        shake(nodeEls[node.id]);
        feedback.className = 'feedback bad';
        feedback.innerHTML = `❌ <b>0/1 nodes are available:</b> ${v.reason}`;
        paint();
      }
    }

    function win() {
      const box = el('div', 'lab-win pop', `🎯 <b>Saare pods schedule ho gaye.</b> ${stage.lesson || ''}`);
      const btn = el('button', 'btn big', 'Aage badho →');
      btn.onclick = () => { btn.disabled = true; onDone({ firstTry, total }); };
      after.append(box, btn);
      after.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    arena.append(nodeRow, feedback, el('div', 'pool-label', '👇 Pod chuno, phir node par click karo (drag bhi chalta hai)'), podRow, after);
    paint();
  };

})();
