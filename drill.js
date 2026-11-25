/* =====================================================================
   KubeGurukul — ⚡ kubectl Speed Drill  (stage type: 'drill')
   Sawal padho → command TYPE karo → Enter. Timer chalta hai; har sawal par
   2 koshish, phir sahi jawab dikhta hai aur drill aage badhti hai (atakti nahi).

   stage: {
     type: 'drill', id: 'drill-pod', title, intro: 'HTML',
     par: 100,                                   // itne second mein sab sahi = ⭐⭐⭐
     items: [ { ask: 'HTML', answers: ['kubectl get pods -o wide', …], explain: 'HTML' } ]
   }
   Jawab ka milaan KG.drill.canon() se: aliases (po = pods, deploy = deployments),
   flags ka kram, -o wide = -owide = --output=wide, deploy/x = deploy x, -it = -i -t,
   'k' = kubectl. Namespace payments context mein pehle se hai: -n payments ho ya na ho, dono sahi.
   helm / argocd / kubeadm / etcdctl / crictl ke commands bhi isi niyam se milte hain (unke value-flags FLAGV mein).
   ===================================================================== */
KG.drill = (function () {
  const RES = {};
  [['pods', 'po pod pods'], ['deployments', 'deploy deployment deployments'], ['services', 'svc service services'], ['nodes', 'no node nodes'],
    ['namespaces', 'ns namespace namespaces'], ['configmaps', 'cm configmap configmaps'], ['secrets', 'secret secrets'], ['ingresses', 'ing ingress ingresses'],
    ['persistentvolumeclaims', 'pvc persistentvolumeclaim persistentvolumeclaims'], ['persistentvolumes', 'pv persistentvolume persistentvolumes'],
    ['replicasets', 'rs replicaset replicasets'], ['statefulsets', 'sts statefulset statefulsets'], ['daemonsets', 'ds daemonset daemonsets'],
    ['horizontalpodautoscalers', 'hpa horizontalpodautoscaler horizontalpodautoscalers'], ['endpoints', 'ep endpoints'], ['serviceaccounts', 'sa serviceaccount serviceaccounts'],
    ['events', 'ev event events'], ['cronjobs', 'cj cronjob cronjobs'], ['jobs', 'job jobs'], ['networkpolicies', 'netpol networkpolicy networkpolicies'],
    ['poddisruptionbudgets', 'pdb poddisruptionbudget poddisruptionbudgets'], ['endpointslices', 'endpointslice endpointslices'], ['roles', 'role roles'],
    ['rolebindings', 'rolebinding rolebindings'], ['clusterroles', 'clusterrole clusterroles'], ['storageclasses', 'sc storageclass storageclasses']]
    .forEach(([c, a]) => a.split(' ').forEach(x => { RES[x] = c; }));
  const FLAGV = { '-n': 'ns', '--namespace': 'ns', '-o': 'o', '--output': 'o', '-l': 'l', '--selector': 'l', '-c': 'c', '--container': 'c', '--tail': 'tail',
    '--since': 'since', '--sort-by': 'sort-by', '--replicas': 'replicas', '--to-revision': 'to-revision', '--field-selector': 'field-selector', '-L': 'L',
    '--label-columns': 'L', '-f': 'f', '--filename': 'f', '--image': 'image', '--port': 'port', '--as': 'as', '--grace-period': 'grace-period',
    '--timeout': 'timeout', '--revision': 'revision', '--limits': 'limits', '--requests': 'requests', '--type': 'type', '--from-literal': 'from-literal',
    '--from-file': 'from-file', '--dry-run': 'dry-run', '--target-port': 'target-port', '--min': 'min', '--max': 'max', '--cpu-percent': 'cpu-percent', '--context': 'context',
    // 2026-11-25: naye drills (service, config, rbac, debug, helm, argocd) ke value-flags — taaki flag kahin bhi likho, jawab wahi gina jaaye
    '--name': 'name', '--from': 'from', '--verb': 'verb', '--resource': 'resource', '--role': 'role', '--clusterrole': 'clusterrole',
    '--serviceaccount': 'serviceaccount', '--duration': 'duration', '--target': 'target', '--copy-to': 'copy-to', '--set': 'set',
    '--set-string': 'set-string', '--version': 'version', '--values': 'f', '--write-out': 'write-out', '--data-dir': 'data-dir' };
  const FLAGB = { '-A': 'A', '--all-namespaces': 'A', '-w': 'w', '--watch': 'w', '-p': 'previous', '--previous': 'previous', '--show-labels': 'show-labels',
    '-i': 'i', '--stdin': 'i', '-t': 't', '--tty': 't', '--force': 'force', '--overwrite': 'overwrite', '--all': 'all', '-R': 'R', '--recursive': 'R',
    '--ignore-daemonsets': 'ignore-daemonsets', '--delete-emptydir-data': 'delete-emptydir-data', '--now': 'now' };
  const unq = s => s.replace(/^(["'])(.*)\1$/, '$2');
  const toks = s => (String(s).trim().match(/"[^"]*"|'[^']*'|\S+/g) || []).map(unq);
  /* command → ek tulna-yogya string ('kubectl get pods | o=wide') */
  function canon(cmd) {
    let t = toks(String(cmd).replace(/\s+/g, ' '));
    if (t[0] === 'k') t[0] = 'kubectl';
    const dd = t.indexOf('--');
    const tail = dd > -1 ? t.slice(dd + 1).join(' ') : null;
    if (dd > -1) t = t.slice(0, dd);
    const pos = [], fl = [];
    for (let i = 0; i < t.length; i++) {
      let x = t[i], m;
      if ((m = x.match(/^(--?[A-Za-z][\w-]*)=(.*)$/))) {
        const k = FLAGV[m[1]] || FLAGB[m[1]] || m[1].replace(/^-+/, '');
        fl.push(k + '=' + m[2]); continue;
      }
      if (FLAGV[x]) { fl.push(FLAGV[x] + '=' + (t[i + 1] == null ? '' : t[++i])); continue; }
      if (FLAGB[x]) { fl.push(FLAGB[x]); continue; }
      if ((m = x.match(/^-o(\S+)$/))) { fl.push('o=' + m[1]); continue; }
      if ((m = x.match(/^-n(\S+)$/))) { fl.push('ns=' + m[1]); continue; }
      if (/^-[a-zA-Z]{2,}$/.test(x) && x.slice(1).split('').every(ch => FLAGB['-' + ch])) { x.slice(1).split('').forEach(ch => fl.push(FLAGB['-' + ch])); continue; }
      if (/^-/.test(x)) { fl.push(x.replace(/^-+/, '')); continue; }
      const sl = x.match(/^([a-z]+)\/(.+)$/);
      if (sl && RES[sl[1]]) { pos.push(RES[sl[1]], sl[2]); continue; }
      pos.push(RES[x] && pos.length > 1 ? RES[x] : x);
    }
    // -it exec ke liye zaroori nahi (printenv jaisi ek command) — ho ya na ho, dono sahi
    const flags = fl.filter(f => f !== 'ns=payments' && !(pos[1] === 'exec' && (f === 'i' || f === 't'))).map(f => f.replace(/^(\w[\w-]*)=(.*)$/, (_, k, v) => k + '=' + unq(v))).sort();
    return pos.join(' ') + (flags.length ? ' | ' + flags.join(' ') : '') + (tail != null ? ' -- ' + tail : '');
  }
  const head = c => canon(c).split(' | ')[0].split(' -- ')[0];
  function check(input, answers) {
    const ci = canon(input);
    if (answers.some(a => canon(a) === ci)) return { ok: true };
    const near = answers.some(a => head(a) === head(input));
    return { ok: false, near };
  }
  return { canon, check };
})();

(function () {
  const el = KG.el, shake = KG.shake, escapeHtml = KG.escapeHtml;
  const hasTick = typeof requestAnimationFrame === 'function' && typeof setInterval === 'function';   // headless validator mein timer nahi
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const fmt = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  KG.renderers.drill = function renderDrill(stage, arena, onDone) {
    const items = stage.items, total = items.length;
    let i = 0, tries = 0, firstTry = 0, solved = 0, t0 = 0, tItem = 0, tick = null, over = false;
    const log = [];
    KG.state.drillBest = KG.state.drillBest || {};
    const best = KG.state.drillBest[stage.id];

    const box = el('div', 'drill');
    const intro = el('div', 'lab-goal', `⚡ <b>SPEED DRILL:</b> ${stage.intro || ''}<br>
      <span class="drill-rules">Har sawal par command <b>type</b> karo, Enter dabao. 2 koshish milti hain, phir sahi jawab dikhega. Context ka namespace <code>payments</code> hai — <code>-n payments</code> lagao ya chhodo, dono sahi.
      ${stage.par ? `Lakshya: <b>${total}/${total}</b>, <b>${stage.par}s</b> se kam.` : ''}${best ? ` Pichhla best: <b>${best.score}/${total}</b> · <b>${best.secs}s</b>.` : ''}</span>`);
    const startBtn = el('button', 'btn big drill-start', '▶ Shuru karo (timer chalega)');
    const top = el('div', 'drill-top');
    const ask = el('div', 'drill-ask');
    const row = el('div', 'drill-row');
    const ps = el('span', 'drill-ps', '$');
    const input = el('input', 'drill-in');
    input.type = 'text';
    input.setAttribute && input.setAttribute('autocomplete', 'off');
    input.setAttribute && input.setAttribute('spellcheck', 'false');
    input.setAttribute && input.setAttribute('aria-label', 'kubectl command');
    const goBtn = el('button', 'btn small drill-go', '↵ Check');
    const skipBtn = el('button', 'btn small ghost drill-skip', 'Skip →');
    row.append(ps, input, goBtn, skipBtn);
    const fb = el('div', 'feedback');
    const done = el('div', 'drill-done');
    const after = el('div', 'lab-after');
    box.append(intro, startBtn);
    arena.appendChild(box);

    function paintTop() {
      top.innerHTML = `<span>Sawal <b>${Math.min(i + 1, total)}</b> / ${total}</span><span>✅ ${solved}</span><span class="drill-clock">⏱ ${fmt(t0 ? now() - t0 : 0)}</span>`;
    }
    function show() {
      tries = 0; tItem = now();
      ask.innerHTML = items[i].ask;
      input.value = '';
      fb.className = 'feedback'; fb.innerHTML = '';
      paintTop();
      if (typeof setTimeout === 'function' && input.focus) setTimeout(() => { try { input.focus(); } catch (e) { /* headless */ } }, 30);
    }
    function record(ok, first, typed) {
      const it = items[i];
      log.push({ ok, first, typed, secs: Math.round((now() - tItem) / 100) / 10 });
      const li = el('div', 'drill-li ' + (ok ? 'ok' : 'miss'), `${ok ? (first ? '⚡' : '✅') : '❌'} <code>${escapeHtml(it.answers[0])}</code>` +
        (ok ? '' : (typed ? ` <span class="drill-you">tumne: ${escapeHtml(typed)}</span>` : ' <span class="drill-you">skip</span>')));
      done.appendChild(li);
    }
    function next() {
      i++;
      if (i < total) show(); else finish();
    }
    function submit() {
      if (over || !t0) return;
      const typed = String(input.value || '').trim();
      if (!typed) return;
      const it = items[i], r = KG.drill.check(typed, it.answers);
      if (r.ok) {
        const first = tries === 0;
        if (first) { firstTry++; KG.addXP(KG.XP_PER_ITEM); }
        solved++;
        record(true, first, typed);
        next();
        if (!over) { fb.className = 'feedback good'; fb.innerHTML = `${first ? '⚡' : '✅'} Pichhla sahi tha. ${it.explain || ''}`; }
        return;
      }
      tries++;
      if (tries < 2) {
        fb.className = 'feedback bad';
        fb.innerHTML = r.near ? '🟡 Verb aur resource sahi — <b>flag / naam</b> dobara dekho. Ek koshish aur.' : '❌ Yeh command yeh kaam nahi karega. Ek koshish aur.';
        if (shake) shake(input);
        return;
      }
      reveal(typed);
    }
    function reveal(typed) {
      const it = items[i];
      KG.noteMistake && KG.noteMistake(`⚡ Command: ${it.ask.replace(/<[^>]+>/g, '')}`, `<code>${escapeHtml(it.answers[0])}</code> — ${it.explain || ''}`);
      record(false, false, typed);
      const msg = `❌ Sahi command: <code>${escapeHtml(it.answers[0])}</code>${it.explain ? ' — ' + it.explain : ''}`;
      next();
      if (!over) { fb.className = 'feedback bad'; fb.innerHTML = msg; }
    }
    function finish() {
      over = true;
      if (tick && typeof clearInterval === 'function') clearInterval(tick);
      const secs = Math.round((now() - t0) / 1000);
      paintTop();
      row.style.display = 'none'; ask.style.display = 'none'; fb.style.display = 'none';
      const stars = solved === total && (!stage.par || secs <= stage.par) ? 3 : solved >= Math.ceil(total * 0.75) ? 2 : 1;
      const prev = KG.state.drillBest[stage.id];
      const better = !prev || solved > prev.score || (solved === prev.score && secs < prev.secs);
      if (better) { KG.state.drillBest[stage.id] = { score: solved, secs }; if (KG.saveState) KG.saveState(); }
      fb.className = 'feedback'; fb.innerHTML = '';
      const misses = log.map((x, k) => ({ x, k })).filter(o => !o.x.ok);
      const win = el('div', 'lab-win pop', `${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)} <b>${solved}/${total} sahi</b> · <b>${secs}s</b>${stage.par ? ` (lakshya ${stage.par}s)` : ''} · ⚡ pehli koshish: ${firstTry}` +
        (better && prev ? ' — <b>naya best!</b>' : '') +
        (misses.length ? `<br>Dobara dekho: ${misses.map(o => `<code>${escapeHtml(items[o.k].answers[0])}</code>`).join(' · ')}` : '<br>Ek bhi galti nahi. 🔥'));
      const again = el('button', 'btn ghost drill-again', '🔁 Dobara khelo (time sudharo)');
      again.onclick = () => { arena.innerHTML = ''; renderDrill(stage, arena, onDone); };
      const btn = el('button', 'btn big', 'Aage badho →');
      btn.onclick = () => { btn.disabled = true; onDone({ firstTry, total }); };
      after.append(win, again, btn);
      if (after.scrollIntoView) after.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    startBtn.onclick = () => {
      if (t0) return;
      startBtn.style.display = 'none';
      box.append(top, ask, row, fb, done, after);
      t0 = now();
      if (hasTick) tick = setInterval(() => { if (!over) paintTop(); }, 500);
      show();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault && e.preventDefault(); submit(); } });
    goBtn.onclick = submit;
    skipBtn.onclick = () => { if (!over && t0) { tries = 2; reveal(''); } };
  };
})();
