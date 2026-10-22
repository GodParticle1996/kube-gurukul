/* =====================================================================
   KubeGurukul — 🧪 Real Cluster Labs (app ke andar ka catalogue)
   Asli labs `real-labs/` folder mein hain (kind/minikube par chalte hain,
   har ek ka verify.sh). Yeh screen unhe dhoondhne, shuru karne aur
   "✅ ho gaya" mark karne ke liye hai — ADHD-friendly: ek lab, ek screen,
   copy-paste commands, koi lamba padhna nahi.
   ===================================================================== */

/* start/cleanup na diya ho toh: `kubectl apply -f setup.yaml` / `kubectl delete ns lab<num>`.
   validate.js check karta hai ki yeh commands lab ke README mein bhi waise hi hain. */
KG.realLabs = [
  { id: '01-crashloop-oom', num: '01', icon: '💥', title: 'CrashLoopBackOff + OOMKilled', mins: 15,
    concept: 'Exit code + Reason padhna (1 vs 137), <code>logs --previous</code>, memory limit = peak',
    decision: 'Crash dekha → pehla command kaunsa?', levels: ['kk-crashloop', 'scheduler'], trees: ['troubleshoot', 'resources'] },
  { id: '02-imagepull', num: '02', icon: '📦', title: 'ImagePullBackOff', mins: 10,
    concept: 'Registry ka error message → 5 wajahein (not found, unauthorized, timeout, platform, rate limit)',
    decision: 'Imperative fix vs git fix (GitOps)', levels: ['kk-imagepull'], trees: ['troubleshoot'] },
  { id: '03-probes', num: '03', icon: '🩺', title: 'Probes: readiness · liveness · startup', mins: 20,
    concept: 'Readiness = traffic gate, liveness = restart, startup = boot ki suraksha',
    decision: 'Kaunsa probe kab lagaun?', levels: ['probes'], trees: ['probes'] },
  { id: '04-service-dns', num: '04', icon: '🛣️', title: 'Service + DNS (hop-by-hop)', mins: 15,
    concept: 'DNS naam → selector → endpoints → targetPort; cross-namespace naam',
    decision: 'Error message se toota hop pakdo', levels: ['service', 'kk-netdeep'], trees: ['expose', 'troubleshoot'],
    cleanup: 'kubectl delete ns lab04 lab04-frontend' },
  { id: '05-scheduling', num: '05', icon: '🧲', title: 'Pending pods: selector · taints · requests', mins: 15,
    concept: 'Chumbak (nodeSelector) vs taala (taint) vs chaabi (toleration); FailedScheduling padhna',
    decision: 'Node ko reserve karna = teeno chahiye', levels: ['affinity', 'kk-pending'], trees: ['placement', 'troubleshoot'],
    start: './setup.sh                 # apply + ssd node par taint',
    cleanup: './cleanup.sh               # taint bhi hatata hai (zaroori!)' },
  { id: '06-quota-qos', num: '06', icon: '🕵️', title: 'Pods gayab: Quota · LimitRange · QoS', mins: 15,
    concept: 'Pod bana hi nahi → ReplicaSet ke events; LimitRange defaults; QoS classes',
    decision: 'Budget badhao ya right-size? Rollout + quota deadlock', levels: ['kk-missing', 'scheduler'], trees: ['resources'] },
  { id: '07-config-reload', num: '07', icon: '🔁', title: 'Config reload: env vs volume vs subPath', mins: 10,
    concept: 'ConfigMap badla — env kabhi nahi, volume ~1 min, subPath kabhi nahi',
    decision: 'Config change par restart chahiye ya nahi?', levels: ['config', 'kk-config'], trees: ['config'] },
  { id: '08-rbac', num: '08', icon: '🔑', title: 'RBAC: ServiceAccount · Role · ClusterRole', mins: 15,
    concept: '<code>auth can-i --as</code>, binding ka subject namespace, cluster-scoped resources',
    decision: 'Kaunsa Role + Binding combo? Least privilege', levels: ['rbac'], trees: ['rbac'],
    cleanup: './cleanup.sh               # ClusterRole/Binding bhi' },
  { id: '09-networkpolicy', num: '09', icon: '🧱', title: 'NetworkPolicy zero-trust', mins: 20,
    concept: 'Default deny + allows, port = container port, egress mein DNS',
    decision: 'Kya rokna hai, kya kholna hai (aur CNI enforce karta hai?)', levels: ['netpol'], trees: ['netsec'],
    start: './check-enforcement.sh     # pehle: kya CNI NetworkPolicy enforce karta hai?\nkubectl apply -f setup.yaml' },
  { id: '10-hpa', num: '10', icon: '📈', title: 'HPA + metrics-server', mins: 15,
    concept: 'Utilization = usage ÷ request; <code>&lt;unknown&gt;</code> ka matlab; live scale-up',
    decision: 'HPA vs VPA vs KEDA vs node autoscaler', levels: ['autoscale'], trees: ['autoscale'],
    start: 'kubectl top nodes          # error? → ../setup.sh metrics (1-2 min ruko)\nkubectl apply -f setup.yaml' },
  { id: '11-rollout-pdb', num: '11', icon: '🚢', title: 'Rollout · rollback · PDB · drain', mins: 20,
    concept: 'minAvailable = replicas → drain atka; maxUnavailable 0 → kharab rollout bhi outage nahi',
    decision: 'Safe rollout + maintenance settings', levels: ['deploy', 'kk-clusterops'], trees: ['rollout'],
    cleanup: 'kubectl delete ns lab11\nkubectl get nodes          # koi SchedulingDisabled? → kubectl uncordon <node>' },
  { id: '12-statefulset', num: '12', icon: '🗄️', title: 'StatefulSet + headless + PVC', mins: 15,
    concept: 'Stable naam + per-pod DNS + apni disk jo pod se zyada jeeti hai',
    decision: 'Deployment ya StatefulSet?', levels: ['workloads', 'storage'], trees: ['workload', 'storage'] },
  { id: '13-jobs-cronjobs', num: '13', icon: '⏰', title: 'Jobs & CronJobs', mins: 15,
    concept: 'BackoffLimitExceeded, fail Job dobara nahi chalta, CronJob overlap',
    decision: 'Forbid / Replace / Allow — kab kaunsa?', levels: ['workloads'], trees: ['workload'] },
  { id: '14-finalizers', num: '14', icon: '⏳', title: 'Stuck Terminating + finalizers', mins: 10,
    concept: 'Delete do-step hai; namespace conditions; finalizer kab hatana',
    decision: 'Finalizer hatana — kab theek, kab bilkul nahi', levels: ['kk-terminating'], trees: ['troubleshoot'],
    cleanup: `# lab adhoora chhoda? pehle finalizers hatao (NotFound aaye toh theek hai)
kubectl -n lab14 patch configmap orders-cache --type=merge -p '{"metadata":{"finalizers":null}}'
kubectl -n lab14-legacy patch configmap legacy-cache --type=merge -p '{"metadata":{"finalizers":null}}'
kubectl delete ns lab14 lab14-legacy --ignore-not-found` },
  { id: '15-helm', num: '15', icon: '⛵', title: 'Helm hands-on', mins: 25,
    concept: 'Lint pass par bug (galat key), --set reset gotcha, --rollback-on-failure (Helm 3: --atomic), fail hue upgrade ka config leak, helm test',
    decision: 'Config -f file mein ya --set mein?', levels: ['helmvalues', 'helmhooks'], trees: ['packaging'],
    start: 'helm lint chart/gurukul-web\nhelm template demo chart/gurukul-web -f values-prod.yaml | grep -n "replicas:"',
    cleanup: 'helm uninstall demo -n lab15 && kubectl delete ns lab15' },
];

KG.realLabsForLevel = levelId => KG.realLabs.filter(l => (l.levels || []).includes(levelId));

(function () {
  const el = KG.el;

  function doneSet() {
    KG.state.realLabsDone = KG.state.realLabsDone || [];
    return KG.state.realLabsDone;
  }

  function copyBtn(text) {
    const b = el('button', 'btn ghost small rl-copy', '📋 Copy');
    b.onclick = () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text);
        b.textContent = '✅ Copied';
      } catch (e) { b.textContent = 'Select karke copy karo'; }
    };
    return b;
  }
  function cmdBlock(label, cmd) {
    const box = el('div', 'rl-cmd');
    const head = el('div', 'rl-cmd-h', `<span>${label}</span>`);
    head.appendChild(copyBtn(cmd));
    box.appendChild(head);
    box.appendChild(el('pre', 'rl-cmd-pre', KG.escapeHtml(cmd)));
    return box;
  }

  /* ============================================================
     SCREEN: saare labs
     ============================================================ */
  window.showRealLabs = function showRealLabs() {
    KG.session = null;
    appEl.innerHTML = '';
    window.scrollTo(0, 0);
    const done = doneSet();
    const wrap = el('section', 'panel');
    const back = el('button', 'btn ghost small', '← Home');
    back.onclick = showHome;
    wrap.appendChild(back);
    wrap.appendChild(el('div', 'dd-hero', `
      <h2>🧪 Real Cluster Labs — <span class="glow">ab asli cluster par</span></h2>
      <p>Simulator mein seekha, ab <b>kind</b> cluster par karo. Har lab ek toota hua production scenario hai —
      tum diagnose + fix karte ho, aur <code>./verify.sh</code> batata hai sach mein theek hua ya nahi
      (❌ par <b>hint</b>, jawab nahi). Saare labs asli 3-node kind cluster par test kiye gaye hain.</p>
      <div class="dd-how"><span>✅ ${done.length}/${KG.realLabs.length} labs ho gaye</span><span>⏱️ har lab 10–25 min</span><span>🧠 ek baar mein ek lab</span></div>`));

    wrap.appendChild(cmdBlock('⚡ Ek baar ka setup (Docker + kind + kubectl chahiye)', 'cd kube-gurukul/real-labs\n./setup.sh            # 3-node kind cluster + metrics-server\nkubectl get nodes'));

    const grid = el('div', 'dd-gridcards');
    KG.realLabs.forEach(lab => {
      const isDone = done.includes(lab.id);
      const card = el('div', 'dd-card rl-card clickable' + (isDone ? ' done' : ''));
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="rl-num">LAB ${lab.num} ${isDone ? '· ✅ ho gaya' : ''}</div>
        <div class="dd-card-icon">${lab.icon}</div>
        <div class="dd-card-title">${lab.title}</div>
        <div class="dd-card-short">${lab.concept}</div>
        <div class="dd-card-meta">⏱️ ~${lab.mins} min · 🧭 ${lab.decision}</div>`;
      card.onclick = () => showRealLab(lab);
      card.onkeydown = e => { if (e.key === 'Enter') showRealLab(lab); };
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    wrap.appendChild(cmdBlock('🧹 Sab saaf karna', './cleanup-all.sh\nkind delete cluster --name gurukul   # poora cluster hatana ho toh'));
    appEl.appendChild(wrap);
  };

  /* ============================================================
     SCREEN: ek lab
     ============================================================ */
  window.showRealLab = function showRealLab(lab) {
    KG.session = null;
    appEl.innerHTML = '';
    window.scrollTo(0, 0);
    const done = doneSet();
    const wrap = el('section', 'panel');
    const back = el('button', 'btn ghost small', '← Saare labs');
    back.onclick = showRealLabs;
    wrap.appendChild(back);
    wrap.appendChild(el('div', 'crumb', `🧪 Real Lab ${lab.num} · ⏱️ ~${lab.mins} min`));
    wrap.appendChild(el('h2', 'level-h', `${lab.icon} ${lab.title}`));
    wrap.appendChild(el('div', 'obj-box', `<h4>🎯 Is lab mein</h4><ul><li>${lab.concept}</li><li>🧭 <b>Decision:</b> ${lab.decision}</li></ul>`));

    const dir = `real-labs/${lab.id}`;
    // har step ka text ek <span> mein — flex container mein khula text/link/code alag-alag items ban ke bikhar jaate the
    const step = (n, html) => `<div class="rl-step"><span class="rl-step-n">${n}</span><span class="rl-step-t">${html}</span></div>`;
    wrap.appendChild(el('div', 'rl-steps',
      step(1, `README kholo — 🎯 ek line · 🗺️ mental map · 🎬 scenario · har step mein <b>👀 "dikhna chahiye"</b> ·
        <a href="${dir}/README.md" target="_blank" rel="noopener">📖 ${dir}/README.md</a>`) +
      step(2, 'Lab shuru karo (neeche command)') +
      step(3, 'Diagnose + fix karo — phas gaye toh pehle README ke 💡 hints, phir <code>solution/</code>') +
      step(4, '<code>./verify.sh</code> — saare ✅? Neeche "ho gaya" dabao 🎉')));

    const startCmd = lab.start || 'kubectl apply -f setup.yaml';
    wrap.appendChild(cmdBlock('▶ Shuru', `cd kube-gurukul/${dir}\n${startCmd}`));
    wrap.appendChild(cmdBlock('✅ Check', './verify.sh'));
    const cleanup = lab.cleanup || `kubectl delete ns lab${lab.num}`;
    wrap.appendChild(cmdBlock('🧹 Cleanup', cleanup));

    // related: decision trees + app levels
    const rel = el('div', 'dd-chips');
    (lab.trees || []).forEach(tid => {
      const t = KG.findDecision(tid);
      if (!t) return;
      const b = el('button', 'dd-chip', `🧭 ${t.icon} ${t.short || t.title}`);
      b.onclick = () => showDecisionTree(t);
      rel.appendChild(b);
    });
    (lab.levels || []).forEach(id => {
      const lvl = KG.findLevel(id);
      if (!lvl) return;
      const b = el('button', 'dd-chip', `📚 ${lvl.icon} ${lvl.title}`);
      b.onclick = () => {
        const track = KG.trackOf(lvl);
        const levels = KG.levelsOf(track);
        const i = levels.indexOf(lvl);
        const open = KG.trackUnlocked(track) && (i === 0 || KG.state.completed.includes(lvl.id) || KG.state.completed.includes(levels[i - 1].id));
        if (open) showIntro(lvl); else showTrack(track);
      };
      rel.appendChild(b);
    });
    if (rel.children.length) {
      wrap.appendChild(el('div', 'dd-sec-h', '🔗 Pehle simulator mein / decision tree mein dekhna ho toh'));
      wrap.appendChild(rel);
    }

    const row = el('div', 'btnrow center');
    const isDone = done.includes(lab.id);
    const mark = el('button', 'btn big ' + (isDone ? 'ghost' : 'good'), isDone ? '↺ "Ho gaya" hatao' : '✅ verify.sh PASS — ho gaya!');
    mark.onclick = () => {
      const d = doneSet();
      if (d.includes(lab.id)) KG.state.realLabsDone = d.filter(x => x !== lab.id);
      else {
        d.push(lab.id);
        KG.touchStreak();
        // XP sirf PEHLI baar — "ho gaya" toggle karke XP farm na ho
        KG.state.realLabsXP = KG.state.realLabsXP || [];
        if (!KG.state.realLabsXP.includes(lab.id)) { KG.state.realLabsXP.push(lab.id); KG.addXP(KG.TERMINAL_XP); }
      }
      KG.saveState();
      showRealLab(lab);
    };
    row.appendChild(mark);
    const idx = KG.realLabs.indexOf(lab);
    if (idx + 1 < KG.realLabs.length) {
      const nx = el('button', 'btn ghost', `Agla: Lab ${KG.realLabs[idx + 1].num} →`);
      nx.onclick = () => showRealLab(KG.realLabs[idx + 1]);
      row.appendChild(nx);
    }
    wrap.appendChild(row);
    appEl.appendChild(wrap);
  };
})();
