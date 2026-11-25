/* =====================================================================
   KubeGurukul — 📟 On-call shifts: production tracks ke BOSS levels mein
   (2026-11-25 se, labs job part 2). Engine: oncall.js → KG.oncall.add().

   Har shift = ek raat, 3–4 JUDE hue alerts. Har alert ka fix agla alert
   saamne laata hai. Engine ghadi, alerts ka kram, "theek → pakka karo",
   hints aur report card khud sambhalta hai; yahan sirf cluster ka model,
   files aur kubectl/velero ke jawab hain.

   Shifts:
     'patch'   d2-boss   node migration AL2 → AL2023 (PDB, cgroup v2 + purana JDK, Velero, ledger ka planned move)
     'blind'   ob-boss   release ki raat: TargetDown (404) → cardinality → error budget burn → aadha rollback

   Kahani wahi ChaiPay: namespace payments, pay-api / ledger (ledger-0) /
   notify, EKS chaipay-prod, account 111122223333, region ap-south-1.
   Yeh file data-labs.js ke BAAD load hoti hai (KG.extendLevel ke liye
   level pehle se registered chahiye).
   ===================================================================== */
(function () {
  const tbl = KG.oncall.tbl;
  function addLab(levelId, stage, extra) {
    const lvl = KG.extendLevel(levelId, extra || {});
    const i = lvl.stages.findIndex(s => s.bonus);
    lvl.stages.splice(i < 0 ? lvl.stages.length : i, 0, stage);
  }
  const ECR = '111122223333.dkr.ecr.ap-south-1.amazonaws.com';
  const SUF = ['h2k9x', 'p7m4q', 'x4r8t', 'c6v2n', 'w9b3k', 'f5t7j', 'm2q8d', 'r6z1p', 'k8n4s', 'b3w7c', 'g1y5h', 'v7d2m'];
  // IntOrString (PDB, maxSurge): number ya "N%" string. Asli API "1" jaisi quoted number string nahi maanti.
  function intOrPct(v, total) {
    if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : NaN;
    const m = String(v).match(/^(\d+)%$/);
    return m ? Math.ceil(Number(m[1]) * total / 100) : NaN;
  }
  const PCT_ERR = (f, v) => `spec.${f}: Invalid value: "${v}": a valid percent string must be a numeric string followed by an ending '%' (e.g. '1%',  or '93%', regex used for validation is '[0-9]+%')`;

  /* =====================================================================
     📟 Shift 'patch' — d2-boss: node migration ki raat (23:00 se)
     Platform ka "node-migrator" purane AL2 nodes ko ek-ek karke drain karta hai.
       1 NodeDrainStuck       notify-pdb minAvailable 2 = replicas 2 → ALLOWED 0
       2 NotifyCrashLooping   naye AL2023 node = cgroup v2; JDK 8u292 limit nahi padhta,
                              host ki 15 GiB ka 75% heap → 512Mi limit par OOMKilled
       3 VeleroBackupTooOld   migrator ka precheck: payments-daily schedule PAUSED
       4 LedgerMoveBlocked    ledger-pdb maxUnavailable 0 → runbook ka planned move,
                              phir PDB WAPAS 0
     ===================================================================== */
  (function () {
    const HOST_MB = 15667, NONHEAP = 100, NEED_HEAP = 256;   // m6i.xlarge: 16 GiB, kernel ko ~15.3 GiB dikhte hain
    const HASH = ['5d8f7c9b6', '7b4c9d2f8', '6c9e1a7d4', '8f2b6d3c1', '4a7e2c9f5', '9c3d8b1e7', '3e6a9d4b2', '2b8f5c1a9'];
    const LEDGER_PV = 'pvc-3a9e7c21-5d4b-4f8e-b2a6-9c1d7e4f0b83';
    const OS = {
      al2: { image: 'Amazon Linux 2', kernel: '5.10.240-238.959.amzn2.x86_64', cg: 'tmpfs' },
      al2023: { image: 'Amazon Linux 2023.9.20261117', kernel: '6.12.46-66.121.amzn2023.x86_64', cg: 'cgroup2fs' },
    };
    const NODES0 = [
      { name: 'node-new-1', os: 'al2023', ip: '10.0.12.88', zone: 'ap-south-1a', age: '41m' },
      { name: 'node-new-2', os: 'al2023', ip: '10.0.13.88', zone: 'ap-south-1b', age: '41m' },
      { name: 'node-new-3', os: 'al2023', ip: '10.0.14.88', zone: 'ap-south-1c', age: '41m' },
      { name: 'node-old-2', os: 'al2', ip: '10.0.13.21', zone: 'ap-south-1b', age: '9d', cordon: true },
      { name: 'node-old-3', os: 'al2', ip: '10.0.13.37', zone: 'ap-south-1b', age: '9d', cordon: true },
    ];
    const OPTS0 = '-XX:MaxRAMPercentage=75';
    const DEPLOY_FILE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: notify
  namespace: payments
spec:
  replicas: 2
  selector:
    matchLabels:
      app: notify
  template:
    metadata:
      labels:
        app: notify
    spec:
      containers:
      - name: notify
        image: ${ECR}/notify:3.2.1     # base image: eclipse-temurin 8u292 (2021 ka JDK)
        env:
        - name: JAVA_TOOL_OPTIONS
          value: "${OPTS0}"
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            memory: 512Mi
`;
    const pdbFile = (name, app, line) => `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ${name}
  namespace: payments
spec:
  ${line}
  selector:
    matchLabels:
      app: ${app}
`;
    const NOTIFY_PDB = pdbFile('notify-pdb', 'notify', 'minAvailable: 2          # notify ke replicas bhi 2 hain');
    const LEDGER_PDB = pdbFile('ledger-pdb', 'ledger', 'maxUnavailable: 0        # ledger-0 = 1 hi replica (Postgres primary)');
    const RUNBOOK = `# ChaiPay on-call runbook — node migration AL2 → AL2023 (25 Nov, raat)
Platform ka automation "node-migrator" purane nodes ko EK-EK karke drain karta hai:
  node-old-1 ✓ (22:30)  →  node-old-2  →  node-old-3 (ledger-0 yahin hai)
Saare purane nodes 22:30 se cordon hain (naye pods sirf node-new-* par jaate hain).
Drain migrator khud karta hai — tum sirf RUKAWAT hatao. Khud drain mat chalao.

Migrator ka haal:  kubectl logs -n platform deploy/node-migrator
Nodes:             kubectl get nodes -o wide        (OS-IMAGE column: AL2 ya AL2023)
Drain kyun ruka:   kubectl get pdb · kubectl describe pdb <naam>
Pods kahan hain:   kubectl get pods -o wide
Crash ki wajah:    kubectl describe pod <pod> (Last State) · kubectl logs <pod> --previous
cgroup version:    kubectl exec <chalta pod> -- stat -fc %T /sys/fs/cgroup/   (cgroup2fs = v2, tmpfs = v1)
Files (git):       notify-pdb.yaml · notify-deploy.yaml · ledger-pdb.yaml → vi, Save, kubectl apply -f <file>

§3 ledger-0 ko hilaane se PEHLE: payments ka TAAZA backup (24 ghante se naya)
     velero schedule get · velero backup get
     velero backup create <naam> --from-schedule payments-daily --wait
§4 ledger-0 ka planned move (1 replica, ledger-pdb maxUnavailable: 0):
     1) taaza backup (§3)
     2) ledger-pdb.yaml → maxUnavailable: 1, apply
     3) migrator ledger-0 ko naye node par le jaata hai (~2-3 min; pay-api retry karti hai)
     4) ledger-pdb.yaml → maxUnavailable: 0 WAPAS, apply

Mat karo: kubectl drain --force / --disable-eviction · PDB delete · node delete ·
          chalte (healthy) pods haath se delete · velero backup delete
`;
    /* ---------- incidents ---------- */
    const INC = [
      { id: 'NodeDrainStuck', sev: '🟠 SEV2', text: 'node-old-2 ka drain 40 min se atka hai. Migration window 02:00 tak hai. (migrator log: kubectl logs -n platform deploy/node-migrator)',
        verify: /^kubectl (get|describe) (pdb|poddisruptionbudgets?|pods?|po|nodes?|no)\b|^kubectl logs\b.*node-migrator/, verifyText: 'dekho ki drain aage badha (kubectl get pods -o wide)',
        hints: ['kubectl logs -n platform deploy/node-migrator — kaun sa pod evict nahi ho raha, aur kyun? Phir kubectl get pods -o wide.',
          'kubectl get pdb — notify-pdb ka ALLOWED DISRUPTIONS 0 hai: minAvailable 2, aur notify ke replicas bhi 2. Drain ek bhi pod nahi hata sakta.',
          'vi notify-pdb.yaml — "minAvailable: 2" ki jagah "maxUnavailable: 1" likho, Save, kubectl apply -f notify-pdb.yaml, phir kubectl get pods -o wide'] },
      { id: 'NotifyCrashLooping', sev: '🔴 SEV1', text: 'notify ka naya pod (naye node par) baar-baar restart ho raha hai — OTP SMS dheeme, aur node-old-2 ka drain phir ruk gaya.',
        verify: /^kubectl (get (pods?|po|deploy(ments?)?)|rollout status|logs)\b/, verifyText: 'notify ke pods dobara dekho (kubectl get pods)',
        hints: ['kubectl get pods -o wide — crash wala pod kis node par hai? kubectl describe pod <us pod ka naam> — Last State ka Reason aur Exit Code?',
          'OOMKilled, exit 137, limit 512Mi. kubectl logs <purana notify pod> aur kubectl logs <naya pod> --previous — "maxHeap" ka farak dekho. kubectl get nodes -o wide — OS-IMAGE. Naya node AL2023 = cgroup v2; JDK 8u292 cgroup v2 mein container ki limit nahi padh pata, host ki ~15 GiB maan leta hai.',
          'vi notify-deploy.yaml — JAVA_TOOL_OPTIONS ki value "-Xmx384m" karo (heap ki seema khud likho; 384m + ~100m baaki JVM < 512Mi), Save, kubectl apply -f notify-deploy.yaml, phir kubectl get pods'] },
      { id: 'VeleroBackupTooOld', sev: '🟠 SEV2', text: 'migrator ne node-old-3 rok diya: "payments ka aakhri backup 24 ghante se purana". Runbook §3: ledger-0 hilaane se pehle taaza backup.',
        verify: /^velero (backup|schedule) (get|describe)\b/, verifyText: 'backup ki list dekho (velero backup get)',
        hints: ['velero backup get — aakhri Completed backup kab ka hai? velero schedule get — PAUSED column padho.',
          'payments-daily schedule PAUSED hai (23 Nov ko migration ki pehli taiyaari mein roka gaya, phir migration taali — kisi ne chalu nahi kiya). Chalu karo: velero schedule unpause payments-daily',
          'Abhi ek backup bhi lo: velero backup create ledger-pre-move --from-schedule payments-daily --wait, phir velero backup get'] },
      { id: 'LedgerMoveBlocked', sev: '🟠 SEV2', text: 'node-old-3 ka drain: ledger-pdb (maxUnavailable: 0) ledger-0 ko rok raha hai. Runbook §4 ka planned move karo.',
        verify: /^kubectl (get|describe) (pdb|poddisruptionbudgets?|pods?|po)\b/, verifyText: 'PDB dobara dekho (kubectl get pdb)',
        hints: ['kubectl get pdb ledger-pdb — ALLOWED DISRUPTIONS 0. cat runbook.md — §4 ke 4 kadam padho.',
          'vi ledger-pdb.yaml — maxUnavailable: 0 ko 1 karo, Save, kubectl apply -f ledger-pdb.yaml. Migrator ledger-0 ko naye node par le jaayega: kubectl get pods -o wide se dekhte raho.',
          'ledger-0 naye node par Running hote hi §4 ka aakhri kadam: ledger-pdb.yaml mein maxUnavailable WAPAS 0, Save, apply, phir kubectl get pdb'] },
    ];

    /* ---------- model ---------- */
    const nodeOf = (c, n) => c.nodes0.find(x => x.name === n) || {};
    const live = c => c.nodes0.filter(n => !n.gone);
    function heapMB(tpl, os) {
      const o = tpl.opts || '';
      const unit = (n, u) => { u = (u || '').toLowerCase(); return u === 'g' ? n * 1024 : u === 'm' ? n : u === 'k' ? n / 1024 : n / 1048576; };
      const x = o.match(/-Xmx(\d+)([kKmMgG])?(?!\S)/);
      if (x) return unit(Number(x[1]), x[2]);
      const pct = Number((o.match(/-XX:MaxRAMPercentage=(\d+(?:\.\d+)?)/) || [])[1] || 25);
      const mr = o.match(/-XX:MaxRAM=(\d+)([kKmMgG])?(?!\S)/);
      // JDK 8u292: cgroup v1 (AL2) ki limit padh leta hai; cgroup v2 (AL2023) nahi → host ki RAM
      const base = mr ? unit(Number(mr[1]), mr[2]) : (os === 'al2' ? tpl.mem : HOST_MB);
      return base * pct / 100;
    }
    const fmtHeap = h => h >= 1024 ? (h / 1024).toFixed(1) + 'g' : Math.round(h) + 'm';
    const verdict = (tpl, os) => { const h = heapMB(tpl, os); return h + NONHEAP > tpl.mem ? 'oom' : h < NEED_HEAP ? 'heap' : 'ok'; };
    function newPod(c, rev, node) {
      c.podN++;
      const targets = live(c).filter(n => !n.cordon);
      const nd = node || targets[(c.podN - 1) % targets.length].name;
      return { name: `notify-${HASH[(rev - 6) % HASH.length]}-${SUF[(c.podN - 1) % SUF.length]}`, node: nd, rev, st: 'Starting', rc: 0, born: c.clock,
        ip: nodeOf(c, nd).ip.split('.').slice(0, 3).join('.') + '.' + (60 + c.podN) };
    }
    const kill = (c, p) => { c.np.splice(c.np.indexOf(p), 1); };
    function mlog(c, msg) {
      // drain har 5s wahi do lines dohraata hai — pichhli 4 mein mil jaaye toh ginti badhao, line aakhir mein le aao
      const i = c.mlog.slice(-4).findIndex(x => x.msg === msg);
      if (i >= 0) { const x = c.mlog.splice(c.mlog.length - Math.min(4, c.mlog.length) + i, 1)[0]; x.n++; x.t = c.clock; c.mlog.push(x); return; }
      c.mlog.push({ t: c.clock, msg, n: 1 });
      if (c.mlog.length > 40) c.mlog.shift();
    }
    // PDB: allowed = healthy − desiredHealthy (asli disruption controller jaisa)
    function allowed(c, app) {
      const spec = c.pdb[app];
      const pods = app === 'notify' ? c.np : [c.ledger];
      const expected = app === 'notify' ? c.replicas : 1;
      const healthy = pods.filter(p => p.st === 'Running').length;
      const desired = spec.minAvailable != null ? intOrPct(spec.minAvailable, expected) : expected - intOrPct(spec.maxUnavailable, expected);
      return { allowed: Math.max(0, healthy - desired), healthy, desired, expected };
    }
    const freshBackup = c => c.velero.backups.some(b => b.fresh && b.status === 'Completed');
    // Deployment controller: maxSurge 25% → 1, maxUnavailable 25% → 0 (2 replicas)
    function rollout(c) {
      const R = c.replicas, cur = c.rev;
      c.np.filter(p => p.rev !== cur && p.st !== 'Running').forEach(p => kill(c, p));   // purane unhealthy pehle
      let olds = c.np.filter(p => p.rev !== cur), news = c.np.filter(p => p.rev === cur);
      if (!olds.length) {
        while (news.length < R) { c.np.push(newPod(c, cur)); news = c.np.filter(p => p.rev === cur); }
        while (news.length > R) { const v = news.filter(p => p.st !== 'Running').pop() || news[news.length - 1]; kill(c, v); news = c.np.filter(p => p.rev === cur); }
        return;
      }
      const add = Math.max(0, Math.min(R - news.length, R + 1 - (olds.length + news.length)));
      for (let i = 0; i < add; i++) c.np.push(newPod(c, cur));
      const avail = c.np.filter(p => p.st === 'Running').length;
      let removable = avail - R;
      olds.filter(p => p.st === 'Running').forEach(p => { if (removable > 0) { kill(c, p); removable--; } });
    }
    function migrate(c) {
      if (!c.draining) {
        if (c.phase === 'gate3') {
          if (freshBackup(c)) { c.phase = 'old3'; c.draining = 'node-old-3'; mlog(c, `precheck ok: taaza backup "${c.velero.backups.find(b => b.fresh).name}" Completed — node-old-3 drain shuru`); }
          else mlog(c, 'precheck FAILED: ledger-0 hilaane se pehle payments ka backup 24h se naya chahiye. Aakhri Completed: payments-daily-20261123020011 (69h purana). node-old-3 ruka.');
        }
        return;
      }
      const node = c.draining;
      const onNode = c.np.filter(p => p.node === node);
      const ledgerHere = c.ledger.node === node;
      if (!onNode.length && !ledgerHere) {
        nodeOf(c, node).gone = true;
        mlog(c, `node/${node} drained — EC2 instance terminate ki`);
        c.draining = null;
        c.phase = node === 'node-old-2' ? 'gate3' : 'done';
        if (c.phase === 'gate3') migrate(c);
        else mlog(c, 'migration poori: saare nodes AL2023 par ✅  (runbook §4.4: ledger-pdb wapas maxUnavailable: 0 karna mat bhoolna)');
        return;
      }
      onNode.forEach(p => {
        mlog(c, `evicting pod payments/${p.name}`);
        if (allowed(c, 'notify').allowed >= 1) { kill(c, p); c.evicted++; mlog(c, `pod/${p.name} evicted`); }
        else mlog(c, `error when evicting pods/"${p.name}" -n "payments" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.`);
      });
      if (ledgerHere) {
        mlog(c, 'evicting pod payments/ledger-0');
        if (allowed(c, 'ledger').allowed >= 1) { c.ledger = { node: 'node-new-2', st: 'ContainerCreating', since: c.clock, moved: true }; mlog(c, 'pod/ledger-0 evicted'); }
        else mlog(c, 'error when evicting pods/"ledger-0" -n "payments" (will retry after 5s): Cannot evict pod as it would violate the pod\'s disruption budget.');
      }
    }
    function reconcile(c) {
      // kubelet: pichhle minute bane pods chalu ya crash
      c.np.forEach(p => {
        if (p.st === 'Starting') {
          const v = verdict(c.revs[p.rev], nodeOf(c, p.node).os);
          if (v === 'ok') { p.st = 'Running'; p.upAt = c.clock; } else { p.st = 'CrashLoopBackOff'; p.why = v; p.rc = 1; }
        } else if (p.st === 'CrashLoopBackOff') p.rc++;
      });
      // ledger-0: EBS volume purane node se utarta hai, phir naye par lagta hai
      if (c.ledger.st === 'ContainerCreating' && c.clock - c.ledger.since >= 2) { c.ledger.st = 'Running'; c.ledger.upAt = c.clock; }
      rollout(c);
      migrate(c);
      const ip = c.velero.backups.find(b => b.status === 'InProgress');
      if (ip && c.clock > ip.at) ip.status = 'Completed';
    }
    const okPdb = c => c.pdb.ledger.maxUnavailable === 0 && c.pdb.ledger.minAvailable == null;
    INC[0].fixed = c => c.evicted >= 1 || !c.np.some(p => p.node === 'node-old-2');
    INC[1].fixed = c => c.np.length === c.replicas && c.np.every(p => p.st === 'Running' && p.rev === c.rev && !nodeOf(c, p.node).cordon);
    INC[2].fixed = c => freshBackup(c) && !c.velero.paused;
    INC[3].fixed = c => c.phase === 'done' && c.ledger.st === 'Running' && okPdb(c);

    /* ---------- kubectl ke views ---------- */
    const hashOf = rev => HASH[(rev - 6) % HASH.length];
    const ageOf = (c, born) => born == null ? '9d' : (c.clock - born) < 1 ? '10s' : (c.clock - born) + 'm';
    function notifyDesc(c, p) {
      const n = nodeOf(c, p.node), t = c.revs[p.rev], h = hashOf(p.rev), age = ageOf(c, p.born);
      const head = `Name:             ${p.name}\nNamespace:        payments\nNode:             ${p.node}/${n.ip}\nLabels:           app=notify\n                  pod-template-hash=${h}\nStatus:           ${p.st === 'Starting' ? 'Pending' : 'Running'}\nIP:               ${p.st === 'Starting' ? '' : p.ip}\nControlled By:    ReplicaSet/notify-${h}\nContainers:\n  notify:\n    Image:          ${ECR}/notify:3.2.1\n`;
      const res = `    Limits:\n      memory:  ${t.limRaw}\n    Requests:\n      cpu:     250m\n      memory:  ${t.reqRaw}\n    Environment:\n      JAVA_TOOL_OPTIONS:  ${t.opts}\n`;
      const sched = `  Normal   Scheduled  ${age}   default-scheduler  Successfully assigned payments/${p.name} to ${p.node}`;
      const evh = 'Events:\n  Type     Reason     Age   From               Message\n  ----     ------     ----  ----               -------\n';
      if (p.st === 'Starting') return head + '    State:          Waiting\n      Reason:       ContainerCreating\n    Ready:          False\n    Restart Count:  0\n' + res + evh + sched;
      if (p.st === 'CrashLoopBackOff') {
        const oom = p.why === 'oom';
        return head + `    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       ${oom ? 'OOMKilled' : 'Error'}\n      Exit Code:    ${oom ? 137 : 1}\n    Ready:          False\n    Restart Count:  ${p.rc}\n` + res + evh + sched +
          `\n  Warning  BackOff    10s   kubelet            Back-off restarting failed container notify in pod ${p.name}_payments(8e1c4f2a-7b3d-4a9e-b6c1-2d5f8a0e3c71)`;
      }
      return head + `    State:          Running\n    Ready:          True\n    Restart Count:  0\n` + res + 'Events:          <none>';
    }
    function ledgerDesc(c) {
      const L = c.ledger, n = nodeOf(c, L.node), creating = L.st === 'ContainerCreating';
      return `Name:             ledger-0\nNamespace:        payments\nNode:             ${L.node}/${n.ip}\nLabels:           app=ledger\nStatus:           ${creating ? 'Pending' : 'Running'}\nControlled By:    StatefulSet/ledger\nContainers:\n  ledger:\n    Image:          postgres:16.4\n    State:          ${creating ? 'Waiting\n      Reason:       ContainerCreating' : 'Running'}\n    Ready:          ${creating ? 'False' : 'True'}\nVolumes:\n  data:\n    Type:       PersistentVolumeClaim\n    ClaimName:  data-ledger-0\n` +
        (creating ? `Events:\n  Type     Reason              Age   From                     Message\n  ----     ------              ----  ----                     -------\n  Normal   Scheduled           1m    default-scheduler        Successfully assigned payments/ledger-0 to node-new-2\n  Warning  FailedAttachVolume  1m    attachdetach-controller  Multi-Attach error for volume "${LEDGER_PV}" Volume is already exclusively attached to one node and can't be attached to another\n(simulator: EBS volume purane node se utar raha hai — ek-do minute. Volume ap-south-1b mein hai, isliye scheduler ne node-new-2 (1b) chuna.)`
          : 'Events:          <none>');
    }
    function nodeDesc(c, n) {
      const os = OS[n.os];
      const pods = c.pods.filter(p => p.node === n.name).map(p => `  payments                    ${p.name}`);
      return `Name:               ${n.name}\nRoles:              <none>\nLabels:             eks.amazonaws.com/nodegroup=${n.os === 'al2' ? 'ng-al2' : 'ng-al2023'}\n                    topology.kubernetes.io/zone=${n.zone}\nTaints:             ${n.cordon ? 'node.kubernetes.io/unschedulable:NoSchedule' : '<none>'}\nUnschedulable:      ${n.cordon ? 'true' : 'false'}\nAddresses:\n  InternalIP:  ${n.ip}\nCapacity:\n  memory:  16008420Ki\nSystem Info:\n  Kernel Version:             ${os.kernel}\n  OS Image:                   ${os.image}\n  Operating System:           linux\n  Container Runtime Version:  containerd://1.7.27\n  Kubelet Version:            v1.33.4-eks-8d1c2f5\nNon-terminated Pods:          (${pods.length} in total)\n  Namespace                   Name\n  ---------                   ----\n` + (pods.join('\n') || '  (koi nahi)');
    }
    function pdbRow(c, name, app) {
      const sp = c.pdb[app], a = allowed(c, app);
      const w = sp.minAvailable != null ? 16 : 18, k = (a, b) => (a + ':').padEnd(w) + b;
      const describe = `${k('Name', name)}\n${k('Namespace', 'payments')}\n${sp.minAvailable != null ? k('Min available', sp.minAvailable) : k('Max unavailable', sp.maxUnavailable)}\n${k('Selector', 'app=' + app)}\nStatus:\n    Allowed disruptions:  ${a.allowed}\n    Current:              ${a.healthy}\n    Desired:              ${a.desired}\n    Total:                ${a.expected}\nEvents:                   <none>`;
      return { name, row: [sp.minAvailable != null ? String(sp.minAvailable) : 'N/A', sp.maxUnavailable != null ? String(sp.maxUnavailable) : 'N/A', String(a.allowed), '120d'], describe,
        yaml: `apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: ${name}\n  namespace: payments\nspec:\n  ${sp.minAvailable != null ? 'minAvailable: ' + sp.minAvailable : 'maxUnavailable: ' + sp.maxUnavailable}\n  selector:\n    matchLabels:\n      app: ${app}\nstatus:\n  currentHealthy: ${a.healthy}\n  desiredHealthy: ${a.desired}\n  disruptionsAllowed: ${a.allowed}\n  expectedPods: ${a.expected}` };
    }
    const PAY = [['pay-api-6b8d7c-a1', 'node-new-1', '10.0.12.91'], ['pay-api-6b8d7c-b2', 'node-new-2', '10.0.13.91'], ['pay-api-6b8d7c-c3', 'node-new-3', '10.0.14.91']];
    function views(c) {
      c.nodes = live(c).map(n => ({ name: n.name, status: n.cordon ? 'Ready,SchedulingDisabled' : 'Ready', roles: '<none>', age: n.age, version: 'v1.33.4' }));
      const np = c.np.map(p => ({ name: p.name, app: 'notify', ready: p.st === 'Running' ? '1/1' : '0/1', status: p.st === 'Starting' ? 'ContainerCreating' : p.st,
        restarts: p.rc ? `${p.rc} (20s ago)` : 0, age: ageOf(c, p.born), node: p.node, ip: p.st === 'Starting' ? '<none>' : p.ip, describe: notifyDesc(c, p) }));
      const L = c.ledger;
      const led = { name: 'ledger-0', app: 'ledger', ready: L.st === 'Running' ? '1/1' : '0/1', status: L.st, restarts: 0, age: L.since == null ? '9d' : ageOf(c, L.since),
        node: L.node, ip: L.st === 'Running' ? (L.moved ? '10.0.13.95' : '10.0.13.40') : '<none>', describe: ledgerDesc(c) };
      c.pods = PAY.map(([n, node, ip]) => ({ name: n, app: 'pay-api', ready: '1/1', status: 'Running', restarts: 0, age: '35m', node, ip })).concat([led], np);
      c.nodes.forEach(n => { n.describe = nodeDesc(c, nodeOf(c, n.name)); });
      const run = c.np.filter(p => p.st === 'Running').length;
      c.deployments = [{ name: 'notify', ready: `${run}/${c.replicas}`, upToDate: c.np.filter(p => p.rev === c.rev).length, available: run, age: '120d' },
        { name: 'pay-api', ready: '3/3', upToDate: 3, available: 3, age: '120d' }];
      c.statefulsets = [{ name: 'ledger', ready: `${L.st === 'Running' ? 1 : 0}/1`, age: '120d' }];
      c.custom = { pdb: { names: ['pdb', 'pdbs', 'poddisruptionbudget', 'poddisruptionbudgets'], cols: ['NAME', 'MIN AVAILABLE', 'MAX UNAVAILABLE', 'ALLOWED DISRUPTIONS', 'AGE'],
        items: [pdbRow(c, 'ledger-pdb', 'ledger'), pdbRow(c, 'notify-pdb', 'notify')] } };
      const ev = [['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE']];
      c.np.filter(p => p.st === 'CrashLoopBackOff').forEach(p => ev.push(['20s', 'Warning', 'BackOff', 'pod/' + p.name, 'Back-off restarting failed container notify in pod ' + p.name + '_payments(8e1c4f2a-7b3d-4a9e-b6c1-2d5f8a0e3c71)']));
      if (L.st === 'ContainerCreating') ev.push(['1m', 'Warning', 'FailedAttachVolume', 'pod/ledger-0', `Multi-Attach error for volume "${LEDGER_PV}" Volume is already exclusively attached to one node and can't be attached to another`]);
      c.events = ev.length > 1 ? tbl(ev).split('\n') : ['No events found in payments namespace.'];
    }
    function notifyLogs(c, p) {
      const t = c.revs[p.rev], os = nodeOf(c, p.node).os, h = heapMB(t, os);
      if (p.st === 'Starting') return `Error from server (BadRequest): container "notify" in pod "${p.name}" is waiting to start: ContainerCreating`;
      const head = `Picked up JAVA_TOOL_OPTIONS: ${t.opts}\n{"level":"info","msg":"notify 3.2.1 started","java":"1.8.0_292-b10","maxHeap":"${fmtHeap(h)}"}`;
      if (p.st === 'CrashLoopBackOff' && p.why === 'oom') return head + '\n{"level":"info","msg":"sms queue drain shuru","queued":18234}';
      if (p.st === 'CrashLoopBackOff') return head + '\n{"level":"info","msg":"sms queue drain shuru","queued":18234}\nException in thread "sms-worker-2" java.lang.OutOfMemoryError: Java heap space\n\tat com.chaipay.notify.Batch.load(Batch.java:88)';
      return head + '\n{"level":"info","msg":"sms sent","provider":"gupshup","batch":500}\n{"level":"info","msg":"sms sent","provider":"gupshup","batch":500}';
    }
    const fmtLog = (c, x) => `[${KG.oncall.hhmm({ clock: x.t, start: 23 * 60 })}] ${x.msg}${x.n > 1 ? `   (×${x.n})` : ''}`;
    const mbOf = v => { const m = String(v == null ? '' : v).match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|k|M|G)?$/); if (!m) return NaN; const n = Number(m[1]), u = m[2] || '';
      return u === 'Gi' ? n * 1024 : u === 'Mi' ? n : u === 'Ki' ? n / 1024 : u === 'G' ? n * 1e9 / 1048576 : u === 'M' ? n * 1e6 / 1048576 : u === 'k' ? n * 1e3 / 1048576 : n / 1048576; };
    const riskyHit = (c, why) => { c.risky++; c.riskyList.push(why.split(' — ')[0]); return { err: '(simulator ne roka — report card mein gina jayega) ' + why }; };
    function pdbApply(name, app) {
      return (s, text, docs) => {
        const c = s.cluster, d = (docs || [])[0] || {}, sp = d.spec || {};
        if (d.kind !== 'PodDisruptionBudget' || (d.metadata || {}).name !== name) return { err: `(simulator ne roka) is file mein PodDisruptionBudget ${name} hi rahe.` };
        if ((((sp.selector || {}).matchLabels) || {}).app !== app) return { err: `(simulator ne roka) selector "app: ${app}" hi rahe — warna PDB kisi aur pod ki raksha karega.` };
        const hasMin = sp.minAvailable != null, hasMax = sp.maxUnavailable != null;
        const js = x => typeof x === 'string' ? JSON.stringify(x) : x;
        if (hasMin && hasMax) return { err: `The PodDisruptionBudget "${name}" is invalid: spec: Invalid value: {"MinAvailable":${js(sp.minAvailable)},"Selector":{"matchLabels":{"app":"${app}"}},"MaxUnavailable":${js(sp.maxUnavailable)},"UnhealthyPodEvictionPolicy":null}: minAvailable and maxUnavailable cannot be both set` };
        if (!hasMin && !hasMax) return { err: '(simulator ne roka) minAvailable ya maxUnavailable — dono mein se EK likho.' };
        const f = hasMin ? 'minAvailable' : 'maxUnavailable', v = sp[f];
        if (typeof v === 'string' && !/^\d+%$/.test(v)) return { err: `The PodDisruptionBudget "${name}" is invalid: ${PCT_ERR(f, v)}` };
        if (typeof v === 'number' && v < 0) return { err: `The PodDisruptionBudget "${name}" is invalid: spec.${f}: Invalid value: ${v}: must be greater than or equal to 0` };
        if (typeof v !== 'number' && typeof v !== 'string') return { err: `The request is invalid: patch: Invalid value: "map[…]": json: cannot unmarshal ${typeof v === 'boolean' ? 'bool' : 'object'} into Go value of type int32` };
        const exp = app === 'notify' ? c.replicas : 1;
        const desired = hasMin ? intOrPct(v, exp) : exp - intOrPct(v, exp);
        if (app === 'notify' && desired <= 0) return riskyHit(c, 'notify-pdb ab ek bhi pod nahi bachata — drain dono notify pods ek saath nikaal dega, OTP SMS poora band ho sakta hai. Ek-ek karke jaane do: maxUnavailable: 1.');
        if (app === 'ledger' && hasMin) return { err: '(simulator ne roka) runbook §4: ledger-pdb mein maxUnavailable hi badlo (0 → 1, move ke baad wapas 0).' };
        if (app === 'ledger' && desired <= 0 && !freshBackup(c)) return riskyHit(c, 'taaza backup ke bina ledger-0 ki suraksha hatayi — runbook §3 pehle (velero backup).');
        if (app === 'ledger' && intOrPct(v, 1) > 1) return { err: '(simulator ne roka) ledger ka 1 hi replica hai — maxUnavailable: 1 kaafi hai.' };
        const cur = c.pdb[app];
        if (cur[f] === v && Object.keys(cur).length === 1) return `poddisruptionbudget.policy/${name} unchanged`;
        c.pdb[app] = { [f]: v };
        return `poddisruptionbudget.policy/${name} configured`;
      };
    }

    function build({ risky }) {
      const c = { nodes0: NODES0.map(n => Object.assign({}, n)), draining: 'node-old-2', phase: 'old2', clock: 0,
        rev: 6, revs: { 6: { opts: OPTS0, mem: 512, req: 512, limRaw: '512Mi', reqRaw: '512Mi' } }, hist: [6],
        replicas: 2, podN: 0, evicted: 0, np: [], mlog: [],
        pdb: { notify: { minAvailable: 2 }, ledger: { maxUnavailable: 0 } },
        ledger: { node: 'node-old-3', st: 'Running', since: null },
        velero: { paused: true, backups: [
          { name: 'payments-daily-20261123020011', status: 'Completed', created: '2026-11-23 02:00:11 +0530 IST', expires: '27d' },
          { name: 'payments-daily-20261122020009', status: 'Completed', created: '2026-11-22 02:00:09 +0530 IST', expires: '26d' },
          { name: 'payments-daily-20261121020012', status: 'Completed', created: '2026-11-21 02:00:12 +0530 IST', expires: '25d' }] } };
      c.np = [newPod(c, 6, 'node-old-2'), newPod(c, 6, 'node-old-2')];
      c.np.forEach(p => { p.st = 'Running'; p.born = null; });
      const [A, B] = c.np.map(p => p.name);
      c.mlog.push({ t: -30, msg: 'node/node-old-1 drained — EC2 instance terminate ki', n: 1 }, { t: -29, msg: 'draining node/node-old-2 (2/3)', n: 1 },
        { t: -1, msg: `evicting pod payments/${A}`, n: 348 }, { t: -1, msg: `error when evicting pods/"${A}" -n "payments" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.`, n: 348 },
        { t: -1, msg: `evicting pod payments/${B}`, n: 348 }, { t: -1, msg: `error when evicting pods/"${B}" -n "payments" (will retry after 5s): Cannot evict pod as it would violate the pod's disruption budget.`, n: 348 });
      const crash = `notify-${HASH[0]}-${SUF[2]}`;
      const solution = [
        'kubectl get nodes -o wide', 'kubectl logs -n platform deploy/node-migrator', 'kubectl get pdb',
        { edit: 'notify-pdb.yaml', change: [['minAvailable: 2', 'maxUnavailable: 1']] }, 'kubectl apply -f notify-pdb.yaml', 'kubectl get pods -o wide',
        'kubectl get pods -o wide', `kubectl describe pod ${crash}`, `kubectl logs ${crash} --previous`, `kubectl logs ${B}`, 'kubectl get nodes -o wide',
        { edit: 'notify-deploy.yaml', change: [[`value: "${OPTS0}"`, 'value: "-Xmx384m"']] }, 'kubectl apply -f notify-deploy.yaml', 'kubectl get pods', 'kubectl get pods',
        'velero backup get', 'velero schedule get', 'velero schedule unpause payments-daily', 'velero backup create ledger-pre-move --from-schedule payments-daily --wait', 'velero backup get',
        'kubectl get pdb ledger-pdb', { edit: 'ledger-pdb.yaml', change: [['maxUnavailable: 0', 'maxUnavailable: 1']] }, 'kubectl apply -f ledger-pdb.yaml', 'kubectl get pods -o wide', 'kubectl get pods -o wide',
        { edit: 'ledger-pdb.yaml', change: [['maxUnavailable: 1', 'maxUnavailable: 0']] }, 'kubectl apply -f ledger-pdb.yaml', 'kubectl get pdb',
      ];
      const findNotify = (c2, name) => c2.np.find(p => p.name === name) || (/^(deploy(ment)?\/)?notify$/.test(name) ? c2.np[0] : null);
      const argName = cmd => (String(cmd).split(/\s+/).slice(2).filter((t, i, a) => !/^-/.test(t) && !/^(-c|-n|--namespace|--tail|--since)$/.test(a[i - 1] || ''))[0] || '');
      return {
        title: '📟 On-call shift: node migration ki raat (AL2 → AL2023)',
        instructions: 'Tum aaj raat ChaiPay ke on-call engineer ho (23:00 se). Platform team ka automation purane Amazon Linux 2 nodes ko naye AL2023 nodes se badal raha hai. Har command = 1 minute. Ek alert theek karoge toh agla aayega — aksar pichhle fix se juda hua. Madad: cat runbook.md',
        goal: `📟 Pehla alert (23:00): <b>${INC[0].sev} ${INC[0].id}</b> — ${INC[0].text}<br>
          Har alert: wajah dhoondho → theek karo (<code>vi</code> + <code>kubectl apply</code>, ya runbook ka command) → <b>pakka karo</b>. Drain <b>migrator</b> karta hai — tum sirf rukawat hatao.
          Khatarnaak commands roke jaayenge aur report card mein ginte hain.`,
        cluster: c,
        responses: [
          risky(/^kubectl drain\b.*--(?:disable-eviction|force)\b.*$/, 'drain --force / --disable-eviction — PDB ko bypass karke pods seedha maarta hai. Rukawat (PDB ya crash) theek karo, migrator khud drain karega.'),
          { re: /^kubectl drain\b.*$/, err: true, out: s => `(simulator) node-migrator pehle se drain kar raha hai — dekho kya likh raha hai:\n` + s.cluster.mlog.slice(-2).map(x => fmtLog(s.cluster, x)).join('\n') },
          risky(/^kubectl delete (?:pdb|pdbs|poddisruptionbudgets?)\b.*$/, 'PDB delete — raksha hi hata di, aur git agle deploy par wapas laga dega. File (vi) se seema badlo.'),
          risky(/^kubectl delete (?:nodes?|no)\b.*$/, 'node delete — chalte pods bina eviction ke gayab. Migrator ko drain karne do.'),
          risky(/^kubectl delete (?:pods?|po)[ /]ledger-0\b.*$/, 'ledger-0 (Postgres primary) seedha delete — PDB aur runbook §3/§4 dono bypass. Planned move runbook se karo.'),
          { re: /^kubectl delete (?:pods?|po)[ /](notify-\S+)\b.*$/,
            out: (s, m) => { const c2 = s.cluster, p = c2.np.find(x => x.name === m[1]);
              if (!p) return `Error from server (NotFound): pods "${m[1]}" not found`;
              if (p.st === 'Running') return riskyHit(c2, 'chalta notify pod haath se delete — PDB ko bypass; notify ke healthy pods kam, OTP SMS dheeme.').err;
              kill(c2, p); return `pod "${m[1]}" deleted\n(ReplicaSet naya pod banayega — par wajah wahi hai toh woh bhi crash hoga)`; } },
          risky(/^kubectl delete (?:deploy|deployments?|sts|statefulsets?|ns|namespaces?|svc|services?|pvc|persistentvolumeclaims?)\b.*$/, 'core object delete — migration ki raat outage mat banao.'),
          risky(/^velero (?:backup|schedule) delete\b.*$/, 'backup / schedule delete — ledger ka aakhri sahara mitaya. Kabhi nahi, khaas kar move se pehle.'),
          { re: /^kubectl uncordon\b.*$/, err: true, out: '(simulator ne roka) uncordon = purane AL2 node par naye pods wapas — migration ulti chalegi. Rukawat theek karo.' },
          { re: /^kubectl (?:edit|patch|set)\b.*$/, err: true, out: '(simulator) raat ko bhi git wali file se karo: vi notify-pdb.yaml / notify-deploy.yaml / ledger-pdb.yaml → Save → kubectl apply -f <file>.' },
          { re: /^kubectl scale\b.*\bnotify\b.*$/,
            out: (s, m) => { const c2 = s.cluster, n = Number((String(m[0]).match(/--replicas[ =](\d+)/) || [])[1]);
              if (isNaN(n)) return 'error: required flag(s) "replicas" not set';
              if (n < 2) return riskyHit(c2, 'notify ko 2 se kam kiya — OTP ki raat SMS ki capacity aadhi.').err;
              if (n > 4) return '(simulator) 4 se zyada nahi — naye nodes par itni jagah nahi.';
              c2.replicas = n; return `deployment.apps/notify scaled\n(dhyan do: git file notify-deploy.yaml mein replicas: 2 hai — agle apply par wapas 2)`; } },
          { re: /^kubectl rollout restart (?:deploy(?:ment)?)[ /]notify\b.*$/,
            out: s => { const c2 = s.cluster; c2.rev++; c2.revs[c2.rev] = Object.assign({}, c2.revs[c2.rev - 1]); c2.hist.push(c2.rev); return 'deployment.apps/notify restarted'; } },
          { re: /^kubectl rollout undo (?:deploy(?:ment)?)[ /]notify\b.*$/,
            out: s => { const c2 = s.cluster, prev = c2.hist[c2.hist.length - 2];
              c2.rev++; c2.revs[c2.rev] = Object.assign({}, prev == null ? c2.revs[c2.rev - 1] : c2.revs[prev]); c2.hist.push(c2.rev);
              return 'deployment.apps/notify rolled back' + (prev == null ? '\n(simulator: pichhla revision 5 bhi isi image aur isi JAVA_TOOL_OPTIONS wala tha — naye node par naye pods phir wahi karenge)' : ''); } },
          { re: /^kubectl rollout status (?:deploy(?:ment)?)[ /]notify\b.*$/,
            out: s => { const c2 = s.cluster, news = c2.np.filter(p => p.rev === c2.rev), up = news.filter(p => p.st === 'Running').length;
              return up >= c2.replicas && news.length === c2.np.length ? 'deployment "notify" successfully rolled out' : `Waiting for deployment "notify" rollout to finish: ${up} of ${c2.replicas} updated replicas are available...\n(simulator: naya pod crash ho raha ho toh rollout yahin atka rahega)`; } },
          { re: /^kubectl get (?:nodes?|no)\b.*-o ?wide\b.*$/,
            out: s => tbl([['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION', 'INTERNAL-IP', 'EXTERNAL-IP', 'OS-IMAGE', 'KERNEL-VERSION', 'CONTAINER-RUNTIME']]
              .concat(live(s.cluster).map(n => [n.name, n.cordon ? 'Ready,SchedulingDisabled' : 'Ready', '<none>', n.age, 'v1.33.4-eks-8d1c2f5', n.ip, '<none>', OS[n.os].image, OS[n.os].kernel, 'containerd://1.7.27']))) },
          { re: /^kubectl logs\b.*node-migrator\b.*$/, out: s => s.cluster.mlog.slice(-12).map(x => fmtLog(s.cluster, x)).join('\n') },
          { re: /^kubectl logs\b.*$/,
            out: (s, m) => { const c2 = s.cluster, name = argName(m[0]), p = findNotify(c2, name);
              if (p) return notifyLogs(c2, p);
              if (/^ledger-0$/.test(name)) return c2.ledger.st === 'Running' ? '2026-11-25 23:10:41.118 IST [61] LOG:  checkpoint complete: wrote 812 buffers (5.0%)' + (c2.ledger.moved ? '\n2026-11-25 23:41:03.552 IST [1] LOG:  database system is ready to accept connections' : '') : 'Error from server (BadRequest): container "ledger" in pod "ledger-0" is waiting to start: ContainerCreating';
              if (/^pay-api/.test(name)) return c2.ledger.st === 'ContainerCreating' ? '{"level":"warn","msg":"ledger: dial tcp 10.100.18.9:5432: connect: connection refused — retry 2/5"}' : '{"level":"info","msg":"POST /pay 200","ms":204}';
              return `Error from server (NotFound): pods "${name}" not found`; } },
          { re: /^kubectl exec\b.*(?:stat -fc ?%T|stat -f -c ?%T)\s+\/sys\/fs\/cgroup\/?.*$/,
            out: (s, m) => { const c2 = s.cluster, name = argName(m[0]), p = findNotify(c2, name) || c2.pods.find(x => x.name === name);
              if (!p) return `Error from server (NotFound): pods "${name}" not found`;
              if (p.st && p.st !== 'Running' || p.status && p.status !== 'Running') return 'error: unable to upgrade connection: container not found ("notify")';
              return OS[nodeOf(c2, p.node).os].cg; } },
          { re: /^kubectl top (?:pods?|po)\b.*$/,
            out: s => tbl([['NAME', 'CPU(cores)', 'MEMORY(bytes)']].concat(s.cluster.pods.filter(p => p.status === 'Running').map(p => [p.name, p.app === 'ledger' ? '412m' : p.app === 'notify' ? '96m' : '305m', p.app === 'ledger' ? '3104Mi' : p.app === 'notify' ? '441Mi' : '286Mi']))) },
          { re: /^velero schedule get\b.*$/,
            out: s => tbl([['NAME', 'STATUS', 'CREATED', 'SCHEDULE', 'BACKUP TTL', 'LAST BACKUP', 'SELECTOR', 'PAUSED'],
              ['payments-daily', 'Enabled', '2026-10-06 11:20:44 +0530 IST', '0 2 * * *', '720h0m0s', s.cluster.velero.backups.some(b => b.fresh) ? '1m ago' : '2d ago', '<none>', String(s.cluster.velero.paused)]]) },
          { re: /^velero schedule describe payments-daily\b.*$/,
            out: s => `Name:         payments-daily\nNamespace:    velero\nPhase:  Enabled\nPaused:  ${s.cluster.velero.paused}\n\nSpec:\n  Schedule:  0 2 * * *\n  Backup Template:\n    Namespaces:\n      Included:  payments\n    TTL:  720h0m0s\n\nLast Backup:  2026-11-23 02:00:11 +0530 IST` },
          { re: /^velero schedule (pause|unpause) (\S+)\b.*$/,
            out: (s, m) => { if (m[2] !== 'payments-daily') return `An error occurred: schedules.velero.io "${m[2]}" not found`; s.cluster.velero.paused = m[1] === 'pause';
              return `Schedule ${m[2]} ${m[1]}d successfully` + (m[1] === 'pause' ? '\n(dhyan do: ab raat 2 baje backup nahi hoga)' : ''); } },
          { re: /^velero backup get\b.*$/,
            out: s => tbl([['NAME', 'STATUS', 'ERRORS', 'WARNINGS', 'CREATED', 'EXPIRES', 'STORAGE LOCATION', 'SELECTOR']].concat(s.cluster.velero.backups.map(b => [b.name, b.status, '0', '0', b.created, b.expires, 'default', '<none>']))) },
          { re: /^velero backup create (\S+)(.*)$/,
            out: (s, m) => {
              const c2 = s.cluster, name = m[1], rest = m[2] || '', v = c2.velero;
              if (/^-/.test(name)) return 'Error: accepts 1 arg(s), received 0\n(backup ka naam do: velero backup create ledger-pre-move --from-schedule payments-daily --wait)';
              if (v.backups.some(b => b.name === name)) return `An error occurred: backups.velero.io "${name}" already exists`;
              const fromSched = /--from-schedule[= ]payments-daily\b/.test(rest), ns = (rest.match(/--include-namespaces[= ](\S+)/) || [])[1];
              if (/--from-schedule/.test(rest) && !fromSched) return 'An error occurred: schedules.velero.io "' + (rest.match(/--from-schedule[= ](\S+)/) || [])[1] + '" not found';
              if (!fromSched && ns && !ns.split(',').includes('payments')) return `Backup request "${name}" submitted successfully.\n(simulator: is backup mein payments namespace nahi — ledger ka data isme nahi aayega. --include-namespaces payments do)`;
              const wait = /--wait\b/.test(rest);
              const mm = 23 * 60 + c2.clock, hm = String(Math.floor(mm / 60) % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
              v.backups.unshift({ name, status: wait ? 'Completed' : 'InProgress', at: c2.clock, created: `2026-11-25 ${hm}:07 +0530 IST`, expires: '29d', fresh: true });
              return (fromSched ? 'Creating backup from schedule, all other filters are ignored.\n' : '') + `Backup request "${name}" submitted successfully.\n` +
                (wait ? 'Waiting for backup to complete. You may safely press ctrl-c to stop waiting - your backup will continue in the background.\n..........\n' +
                  `Backup completed with status: Completed. You may check for more information using the commands \`velero backup describe ${name}\` and \`velero backup logs ${name}\`.`
                  : `Run \`velero backup describe ${name}\` or \`velero backup logs ${name}\` for more details.`);
            } },
          { re: /^velero backup describe (\S+).*$/,
            out: (s, m) => { const b = s.cluster.velero.backups.find(x => x.name === m[1]); if (!b) return `An error occurred: backups.velero.io "${m[1]}" not found`;
              return `Name:         ${b.name}\nNamespace:    velero\n\nPhase:  ${b.status}\n\nNamespaces:\n  Included:  payments\n\nStarted:    ${b.created}\n\nTotal items to be backed up:  148\nItems backed up:              ${b.status === 'Completed' ? 148 : 61}\n\nVolume Snapshots:\n  ${LEDGER_PV}: ${b.status === 'Completed' ? 'specify --details for more information' : 'in progress'}`; } },
          { re: /^velero\b.*$/, out: 'Is shift mein velero ke yeh commands chalte hain:\n  velero backup get · velero backup describe <naam>\n  velero schedule get · velero schedule describe payments-daily\n  velero schedule unpause payments-daily\n  velero backup create <naam> --from-schedule payments-daily --wait' },
        ],
        files: {
          'runbook.md': { desc: 'on-call runbook (padhne ke liye)', content: RUNBOOK, apply: () => ({ err: 'error: error parsing runbook.md: yeh runbook hai, manifest nahi — cat runbook.md' }) },
          'notify-pdb.yaml': { editable: true, desc: 'notify ka PodDisruptionBudget (git)', content: NOTIFY_PDB, apply: pdbApply('notify-pdb', 'notify') },
          'notify-deploy.yaml': {
            editable: true, desc: 'notify ka Deployment (git)', content: DEPLOY_FILE,
            apply: (s, text, docs) => {
              const c2 = s.cluster, d = (docs || [])[0] || {}, sp = d.spec || {}, ct = ((((sp.template || {}).spec) || {}).containers || [])[0] || {};
              if (d.kind !== 'Deployment' || (d.metadata || {}).name !== 'notify' || ct.name !== 'notify') return { err: '(simulator ne roka) is file mein Deployment notify (container notify) hi rahe.' };
              if (ct.image !== `${ECR}/notify:3.2.1`) return { err: '(simulator ne roka) image mat badlo — naye JDK wala notify image CI kal subah banayega. Aaj raat ka sabse chhota fix: JVM ko heap ki seema khud batao.' };
              const env = (ct.env || []).find(e => e && e.name === 'JAVA_TOOL_OPTIONS');
              if (!env) return { err: '(simulator ne roka) JAVA_TOOL_OPTIONS env mat hatao — usi se JVM ki memory tay hoti hai.' };
              const r = ct.resources || {}, limRaw = String((r.limits || {}).memory), reqRaw = String((r.requests || {}).memory);
              const lim = mbOf(limRaw), req = mbOf(reqRaw);
              if (isNaN(lim) || isNaN(req)) return { err: `Error from server (BadRequest): error when creating "notify-deploy.yaml": Deployment in version "v1" cannot be handled as a Deployment: quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$'` };
              if (req > lim) return { err: `The Deployment "notify" is invalid: spec.template.spec.containers[0].resources.requests: Invalid value: "${reqRaw}": must be less than or equal to memory limit of ${limRaw}` };
              if (lim > 2048) return { err: '(simulator ne roka) 2Gi se zyada memory mat do — naye nodes par itni jagah nahi.' };
              if (typeof sp.replicas !== 'number' || sp.replicas < 2 || sp.replicas > 4) return { err: '(simulator ne roka) replicas 2 se 4 ke beech rakho.' };
              const tpl = { opts: String(env.value == null ? '' : env.value), mem: lim, req, limRaw, reqRaw };
              const same = JSON.stringify(tpl) === JSON.stringify(c2.revs[c2.rev]);
              if (same && sp.replicas === c2.replicas) return 'deployment.apps/notify unchanged';
              c2.replicas = sp.replicas;
              if (!same) { c2.rev++; c2.revs[c2.rev] = tpl; c2.hist.push(c2.rev); }
              return 'deployment.apps/notify configured';
            },
          },
          'ledger-pdb.yaml': { editable: true, desc: 'ledger ka PodDisruptionBudget (git)', content: LEDGER_PDB, apply: pdbApply('ledger-pdb', 'ledger') },
        },
        successText: `<b>Raat ki kahani (root cause chain):</b> notify-pdb ka <code>minAvailable: 2</code> = replicas 2 → drain ek bhi pod nahi hata saka (1) →
          seema dheeli ki toh pehla pod naye AL2023 node par gaya aur <b>OOMKilled</b> hua: JDK 8u292 cgroup v2 nahi samajhta, heap = host RAM ka 75% (~11.5g) jabki limit 512Mi (2) →
          <code>-Xmx384m</code> se dono pods naye nodes par chale, node-old-2 khaali → migrator ne backup jaancha: schedule 23 Nov se <b>paused</b> (3) →
          taaza backup ke baad ledger-0 ka planned move: PDB 0 → 1 → <b>wapas 0</b> (4).<br>
          <b>Seekh:</b> PDB ka minAvailable replicas ke barabar = drain hamesha atkega. OS badla toh cgroup badla — purane runtimes (JDK &lt; 8u372, purana Node/Go) limit galat padhte hain.
          "Kuch der ke liye" kiya badlaav (pause, PDB dheela) wapas karna bhi kaam ka hissa hai.<br>
          <b>Postmortem action items:</b> PDB lint (minAvailable &lt; replicas) CI mein · notify image naye JDK (8u372+ / 17) par · migration se pehle har app ek naye node par canary · Velero schedule PAUSED par alert.`,
        solution,
      };
    }
    KG.oncall.add({ id: 'patch', start: 23 * 60, INC, reconcile, views, build });
  })();

  addLab('d2-boss', { type: 'oncall', id: 'oncall-patch', shift: 'patch', title: '📟 On-call Shift: node migration ki raat (4 alerts)' }, {
    objectives: ['📟 <b>On-call shift:</b> node migration ki raat ke 4 jude alerts — PDB, OOMKilled (cgroup v2), Velero backup, ledger ka planned move'],
    success: ['Main ek node migration ki raat ke jude hue alerts (drain → crash → backup → stateful move) kram se sambhal sakta hoon'],
    cards: [{ front: 'Pod purane AL2 node par theek, naye AL2023 node par OOMKilled — kyun?', back: 'AL2023 = <b>cgroup v2</b>. Purana JDK (8u372 se pehle) cgroup v2 mein container ki memory limit nahi padh pata aur host ki RAM se heap tay karta hai. Fix: <code>-Xmx</code> khud do, ya naya JDK.' },
      { front: 'Drain atka: "Cannot evict pod as it would violate the pod\'s disruption budget" — pehli jaanch?', back: '<code>kubectl get pdb</code> — ALLOWED DISRUPTIONS 0? <code>minAvailable</code> = replicas ho toh drain kabhi aage nahi badhega. <code>maxUnavailable: 1</code> rakho.' }],
  });

  /* =====================================================================
     📟 Shift 'blind' — ob-boss: release ki raat, monitoring andhi (21:40 se)
     21:30 par pay-api 1.9.1 release hui. Usme teen badlaav the:
       • /metrics naye port :9102 par (Service ka "metrics" port ab bhi 8080 par bhejta hai)
       • naya debug metric pay_txn_latency_seconds{txn_id=…} — har payment = nayi series
       • fraud-check v2 ka naya call, timeout 300ms (fraud-check ka p99 420ms)
       1 TargetDown                  Service targetPort 8080 → 9102
       2 PrometheusCardinalitySpike  ServiceMonitor metricRelabelings: debug metric drop
       3 PayApiErrorBudgetBurn       (metrics aate hi dikha) → rollout undo 1.9.0
       4 TargetDownAgain             1.9.0 ka /metrics 8080 par — Service wapas 8080
     ===================================================================== */
  (function () {
    const T0 = 1795623000;   // 2026-11-25 21:40 IST
    const V = {
      '1.9.1': { hash: '7c9f4b8d6', mport: 9102, ports: { http: 8080, metrics: 9102 }, txn: true, err: 0.0412, sufs: ['k2x7q', 'm4p8t', 'r8w3z'], last: 52,
        cause: 'pay-api 1.9.1: /metrics alag port :9102, debug per-txn latency metric, fraud-check v2 risk score (timeout 300ms)' },
      '1.9.0': { hash: '5b8d2e7f1', mport: 8080, ports: { http: 8080 }, txn: false, err: 0.0003, sufs: ['c5n1v', 'h6j2b', 'q9d4s'], last: 41, cause: 'pay-api 1.9.0' },
    };
    const NODES = [['node-1', '10.0.12'], ['node-2', '10.0.13'], ['node-3', '10.0.14']];
    const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';
    const SVC_FILE = `apiVersion: v1
kind: Service
metadata:
  name: pay-api
  namespace: payments
  labels:
    app: pay-api
spec:
  selector:
    app: pay-api
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: metrics
    port: 9102
    targetPort: 8080      # 1.9.0 tak /metrics isi port par tha
`;
    const SM_FILE = `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: pay-api
  namespace: payments
  labels:
    app: pay-api
    release: kps          # Prometheus "kps" sirf is label wale ServiceMonitor chunta hai
spec:
  selector:
    matchLabels:
      app: pay-api
  endpoints:
  - port: metrics          # Service ke port ka NAAM
    path: /metrics
    interval: 30s
`;
    const RUNBOOK = `# ChaiPay on-call runbook — monitoring (kps = kube-prometheus-stack)
Aaj 21:30: pay-api 1.9.1 release (kubectl rollout history deployment/pay-api)
Prometheus ka port-forward pehle se chalu hai: localhost:9090

Targets:     bash show-targets.sh          (job, pod, health, last error)
PromQL:      promtool query instant http://localhost:9090 '<query>'
  up{job="pay-api"}
  sum by (code) (rate(http_requests_total{job="pay-api"}[5m]))
  sum(rate(http_requests_total{job="pay-api",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="pay-api"}[5m]))
  prometheus_tsdb_head_series
  topk(5, count by (__name__) ({job="pay-api"}))
  scrape_samples_post_metric_relabeling{job="pay-api"}
  histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job="fraud-check"}[5m])))
App ke metrics seedha:  kubectl exec <pay-api pod> -- wget -qO- localhost:<port>/metrics
Traces (Tempo):         curl -s http://tempo.monitoring:3200/api/traces/<trace_id>
Memory:                 kubectl top pods -n monitoring
Files (git):  pay-api-service.yaml · pay-api-servicemonitor.yaml → vi, Save, kubectl apply -f <file>

SLO: pay-api 99.9% (error budget 0.1%). Fast-burn page: burn rate > 14.4× (1h aur 5m dono khidki).
ServiceMonitor ki metricRelabelings scrape ke BAAD, store hone se PEHLE chalti hain
(action: drop + sourceLabels: [__name__] = poora metric hi mat rakho).

Mat karo: prometheus-kps-0 / uski PVC delete · alerts silence karke so jaana · ServiceMonitor delete · pay-api scale 0
`;
    const INC = [
      { id: 'TargetDown', sev: '🟠 SEV2', text: '100% of the pay-api/pay-api targets in payments namespace are down. (21:30 ki release ke baad se pay-api ka koi metric nahi — SLO alerts andhe.)',
        verify: /^bash show-targets\.sh|^promtool query\b.*\bup\b/, verifyText: 'targets dobara dekho (bash show-targets.sh)',
        hints: ['bash show-targets.sh — pay-api ke targets ka HEALTH aur LAST ERROR padho. 404 matlab: port khula hai, par us port par /metrics nahi.',
          'kubectl logs <pay-api pod> — 1.9.1 /metrics kis port par sunta hai? kubectl describe svc pay-api — metrics port ka TargetPort kya hai?',
          'vi pay-api-service.yaml — metrics port ka "targetPort: 8080" ko "targetPort: 9102" karo, Save, kubectl apply -f pay-api-service.yaml, phir bash show-targets.sh'] },
      { id: 'PrometheusCardinalitySpike', sev: '🟠 SEV2', text: 'prometheus-kps-0: head series har minute ~85 hazaar badh rahi hain (pay-api ke targets lautte hi). Memory limit 4Gi — is raftaar se ~20 min mein OOMKilled, tab saare alerts andhe.',
        verify: /^promtool query\b.*(scrape_samples|prometheus_tsdb_head_series|count by ?\(__name__\))|^kubectl top\b/, verifyText: 'series ki raftaar dobara dekho (scrape_samples_post_metric_relabeling ya prometheus_tsdb_head_series)',
        hints: ['promtool query instant http://localhost:9090 \'prometheus_tsdb_head_series\' — do baar chalao, kitna badha? Phir runbook ki topk(5, count by (__name__) …) query — kaun sa metric sabse zyada series bana raha hai?',
          'pay_txn_latency_seconds_bucket — har txn_id ki alag series (1.9.1 ka debug metric). kubectl exec <pay-api pod> -- wget -qO- localhost:9102/metrics | grep txn_id se khud dekho. Label ki values ginti ki honi chahiye; har payment ki nahi.',
          'vi pay-api-servicemonitor.yaml — endpoint ke andar (interval ke neeche, usi indent par) jodo:\n    metricRelabelings:\n    - sourceLabels: [__name__]\n      regex: pay_txn_latency_seconds.*\n      action: drop\nSave, kubectl apply -f pay-api-servicemonitor.yaml, phir scrape_samples_post_metric_relabeling{job="pay-api"} query'] },
      { id: 'PayApiErrorBudgetBurn', sev: '🔴 SEV1', text: 'pay-api burn rate 41× (1h aur 5m khidki) — SLO 99.9%. Metrics lautte hi dikha: errors 21:30 se chal rahe the, alert andha tha.',
        verify: /^promtool query\b.*http_requests_total|^kubectl logs\b.*pay-api|^kubectl rollout status\b.*pay-api/, verifyText: 'errors dobara dekho (pay-api logs ya http_requests_total query)',
        hints: ['promtool query … \'sum by (code) (rate(http_requests_total{job="pay-api"}[5m]))\' — kaun sa code? Phir kubectl logs <pay-api pod> — error kya hai, trace_id kya hai?',
          'curl -s http://tempo.monitoring:3200/api/traces/<trace_id> — kaun sa span 300ms par kat gaya? runbook ki fraud-check p99 query: 420ms. kubectl rollout history deployment/pay-api — fraud-check v2 kis release mein aaya?',
          'Raat ko sabse chhota sahi fix: pichhli release par wapas — kubectl rollout undo deployment/pay-api, phir kubectl get pods aur kubectl logs <naya pod>'] },
      { id: 'TargetDownAgain', sev: '🟠 SEV2', text: '100% of the pay-api/pay-api targets in payments namespace are down — PHIR SE. (Rollback ke baad.)',
        verify: /^bash show-targets\.sh|^promtool query\b.*\bup\b/, verifyText: 'targets dobara dekho (bash show-targets.sh)',
        hints: ['bash show-targets.sh — LAST ERROR ab kya hai? "connection refused" = us port par koi sun hi nahi raha.',
          'Rollback ne sirf Deployment ko 1.9.0 par lautaya. 1.9.0 /metrics 8080 par deta hai — par Service ko tumne aaj raat 9102 par moda tha. kubectl logs <naya pay-api pod>',
          'vi pay-api-service.yaml — metrics port ka targetPort wapas 8080, Save, kubectl apply -f pay-api-service.yaml, phir bash show-targets.sh'] },
    ];

    /* ---------- model ---------- */
    const cur = c => V[c.ver];
    const podsOf = c => cur(c).sufs.map((s, i) => ({ name: `pay-api-${cur(c).hash}-${s}`, node: NODES[i][0], ip: `${NODES[i][1]}.${cur(c).last}` }));
    // Service ka metrics targetPort → kya pod us par /metrics deta hai?
    // naam wala targetPort pod ke container port ke NAAM se milta hai (1.9.0 mein "metrics" naam ka port hai hi nahi)
    const tpPort = c => typeof c.svc.tp === 'string' ? cur(c).ports[c.svc.tp] : c.svc.tp;
    function scrape(c) {
      const port = tpPort(c);
      if (!c.sm.ok || port == null) return { st: 'absent' };
      if (port === cur(c).mport) return { st: 'up', port };
      if (port === 8080) return { st: 'down', port, err: 'server returned HTTP status 404 Not Found' };
      return { st: 'down', port, err: null };
    }
    const up = c => scrape(c).st === 'up';
    const txnIngest = c => up(c) && cur(c).txn && !c.sm.drop;
    function reconcile(c) {
      if (c.rolling != null && c.clock - c.rolling >= 1) c.rolling = null;
      if (txnIngest(c)) c.series += 85000;
      if (up(c)) { c.downSince = null; c.lastRatio = cur(c).err; c.verSeen = c.ver; } else if (c.downSince == null) c.downSince = c.clock;
    }
    INC[0].fixed = c => up(c);
    INC[1].fixed = c => up(c) && !txnIngest(c);
    INC[2].fixed = c => c.ver === '1.9.0' && c.rolling == null;
    INC[3].fixed = c => up(c) && c.ver === '1.9.0';

    /* ---------- views ---------- */
    const at = c => ' @[' + (T0 + c.clock * 60) + '.000]';
    function views(c) {
      const sc = scrape(c), ps = podsOf(c);
      const payPods = ps.map(p => ({ name: p.name, app: 'pay-api', ready: '1/1', status: 'Running', restarts: 0, age: c.ver === '1.9.1' ? (10 + c.clock) + 'm' : Math.max(1, c.clock - c.undoAt) + 'm', node: p.node, ip: p.ip,
        describe: `Name:             ${p.name}\nNamespace:        payments\nNode:             ${p.node}\nLabels:           app=pay-api\n                  pod-template-hash=${cur(c).hash}\nStatus:           Running\nIP:               ${p.ip}\nContainers:\n  pay-api:\n    Image:          ${ECR}/pay-api:${c.ver}\n    Ports:          8080/TCP (http)${cur(c).mport === 9102 ? ', 9102/TCP (metrics)' : ''}\n    State:          Running\n    Ready:          True\nEvents:          <none>` }));
      const mon = Math.round(c.series * 2.2 / 1024);
      c.pods = payPods.concat([
        { name: 'ledger-0', app: 'ledger', ready: '1/1', status: 'Running', restarts: 0, age: '12d', node: 'node-3', ip: '10.0.14.11' },
        { name: 'prometheus-kps-0', app: 'prometheus', ready: '2/2', status: 'Running', restarts: 0, age: '9d', node: 'node-3', ip: '10.0.14.30', memMi: mon },
        { name: 'alertmanager-kps-0', app: 'alertmanager', ready: '2/2', status: 'Running', restarts: 0, age: '9d', node: 'node-2', ip: '10.0.13.30' },
        { name: 'tempo-0', app: 'tempo', ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: 'node-1', ip: '10.0.12.30' }]);
      c.deployments = [{ name: 'pay-api', ready: '3/3', upToDate: 3, available: 3, age: '120d' }, { name: 'fraud-check', ready: '2/2', upToDate: 2, available: 2, age: '120d' }];
      const mp = tpPort(c), epm = mp == null ? '' : ps.map(p => p.ip + ':' + mp).join(',');
      const k = (a, b) => (a + ':').padEnd(26) + b;
      c.services = [{ name: 'pay-api', type: 'ClusterIP', clusterIP: '10.100.71.3', ports: '80/TCP,9102/TCP', age: '120d',
        describe: [k('Name', 'pay-api'), k('Namespace', 'payments'), k('Labels', 'app=pay-api'), k('Annotations', '<none>'), k('Selector', 'app=pay-api'), k('Type', 'ClusterIP'),
          k('IP Family Policy', 'SingleStack'), k('IP Families', 'IPv4'), k('IP', '10.100.71.3'), k('IPs', '10.100.71.3'), k('Port', 'http  80/TCP'), k('TargetPort', '8080/TCP'),
          k('Endpoints', ps.map(p => p.ip + ':8080').join(',')), k('Port', 'metrics  9102/TCP'), k('TargetPort', c.svc.tp + '/TCP'), k('Endpoints', epm),
          k('Session Affinity', 'None'), k('Internal Traffic Policy', 'Cluster'), k('Events', '<none>')].join('\n') }];
      c.endpoints = [{ name: 'pay-api', endpoints: ps.map(p => p.ip + ':8080').join(',') + (epm ? ',' + epm.split(',')[0] + ' + 2 more...' : ''), age: '120d' }];
      c.custom = {
        servicemonitor: { names: ['servicemonitor', 'servicemonitors', 'smon'], cols: ['NAME', 'AGE'],
          items: [{ name: 'pay-api', row: ['120d'], describe: `Name:         pay-api\nNamespace:    payments\nLabels:       app=pay-api\n              release=kps\nKind:         ServiceMonitor\nSpec:\n  Endpoints:\n    Interval:  30s\n    Path:      /metrics\n    Port:      metrics` +
            (c.sm.drop ? '\n    Metric Relabelings:\n      Action:  drop\n      Regex:   ' + c.sm.drop + '\n      Source Labels:\n        __name__' : '') + '\n  Selector:\n    Match Labels:\n      App:  pay-api' }] },
      };
      c.events = ['No events found in payments namespace.'];
      c.scrapeNow = sc;
    }
    /* ---------- PromQL (runbook ki queries) ---------- */
    const lbl = (c, p, port) => `{container="pay-api", endpoint="metrics", instance="${p.ip}:${port}", job="pay-api", namespace="payments", pod="${p.name}", service="pay-api"}`;
    function promql(c, q) {
      const e = q.replace(/\s+/g, ''), sc = scrape(c), ps = podsOf(c), T = at(c);
      const stale = !up(c);
      if (/^up(\{job="pay-api"\})?$/.test(e)) {
        if (sc.st === 'absent') return (e === 'up' ? 'up{job="ledger", namespace="payments", pod="ledger-0"} => 1' + T + '\n' : '') + '(pay-api ka koi target nahi — up series hai hi nahi)';
        return (e === 'up' ? 'up{job="ledger", namespace="payments", pod="ledger-0"} => 1' + T + '\n' : '') + ps.map(p => 'up' + lbl(c, p, sc.port) + ' => ' + (sc.st === 'up' ? 1 : 0) + T).join('\n');
      }
      if (/^prometheus_tsdb_head_series/.test(e)) return 'prometheus_tsdb_head_series{container="prometheus", endpoint="http-web", instance="10.0.14.30:9090", job="kps-prometheus", namespace="monitoring", pod="prometheus-kps-0", service="kps-prometheus"} => ' + c.series + T;
      if (/count(by\(__name__\))?\(\{job="pay-api"\}\)|countby\(__name__\)/.test(e)) {
        const txn = Math.max(0, c.series - 160000);
        const rows = [['pay_txn_latency_seconds_bucket', txn ? Math.round(txn * 0.86) : 0], ['pay_txn_latency_seconds_count', txn ? Math.round(txn * 0.07) : 0], ['pay_txn_latency_seconds_sum', txn ? Math.round(txn * 0.07) : 0], ['http_request_duration_seconds_bucket', 1320], ['http_requests_total', 48]]
          .filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (!up(c) && !txn) return '(khaali — pay-api ke targets down hain, uski koi taaza series nahi)';
        return rows.map(r => `{__name__="${r[0]}"} => ${r[1]}${T}`).join('\n') + (c.sm.drop && txn ? '\n(simulator: purani series head mein ~2 ghante rehti hain — nayi banna band hui ya nahi, woh scrape_samples_post_metric_relabeling batata hai)' : '');
      }
      if (/^scrape_samples_(post_metric_relabeling|scraped)/.test(e)) {
        if (!up(c)) return '(khaali — pay-api ke targets down hain, scrape hi nahi ho raha)';
        const post = /post/.test(e);
        return ps.map(p => (post ? 'scrape_samples_post_metric_relabeling' : 'scrape_samples_scraped') + lbl(c, p, sc.port) + ' => ' + (cur(c).txn && (!post || !c.sm.drop) ? 28411 : 1368) + T).join('\n');
      }
      if (/http_requests_total/.test(e)) {
        if (!up(c) && (c.downSince == null || c.clock - c.downSince >= 5 || !c.lastRatio)) return '(khaali — pichhle 5 min mein pay-api ka koi sample nahi; targets down hain. Isi liye error alert bhi chup tha.)';
        const r = stale ? c.lastRatio : cur(c).err;
        const note = stale ? `\n(dhyan do: pay-api ke targets abhi DOWN hain — yeh number ${c.clock - c.downSince} min purane samples se hai, rollback ke baad ka sach nahi)` : '';
        if (/by\(code\)/.test(e)) return `{code="200"} => ${(42.6 * (1 - r)).toFixed(2)}${T}\n` + (r > 0.001 ? `{code="504"} => ${(42.6 * r).toFixed(2)}${T}` : `{code="500"} => 0.01${T}`) + note;
        if (/5\.\./.test(e) && /\//.test(e)) return `{} => ${r.toFixed(4)}${T}` + note + (r > 0.0144 && !stale ? `\n(burn rate = ${r.toFixed(4)} ÷ 0.001 = ${Math.round(r / 0.001)}×)` : '');
        return '(simulator: http_requests_total ke liye runbook ki do queries chalao — by (code), ya 5xx ka hissa)';
      }
      if (/histogram_quantile\(0\.99/.test(e) && /fraud-check/.test(e)) return `{} => 0.42${T}\n(fraud-check ka p99 = 420ms)`;
      return '(simulator: yeh query is shift mein scripted nahi — runbook ki queries chalao: cat runbook.md)';
    }
    function showTargets(c) {
      const sc = scrape(c);
      const rows = [['JOB', 'POD', 'HEALTH', 'LAST ERROR'], ['ledger', 'ledger-0', 'up', ''], ['fraud-check', 'fraud-check-6d4b9-x2', 'up', '']];
      podsOf(c).forEach(p => { if (sc.st !== 'absent') rows.push(['pay-api', p.name, sc.st, sc.st === 'up' ? '' : (sc.err || `Get "http://${p.ip}:${sc.port}/metrics": dial tcp ${p.ip}:${sc.port}: connect: connection refused`)]); });
      return tbl(rows) + (sc.st === 'absent' ? '\n(pay-api ka koi target hi nahi — Service ke metrics port ka naam/port ServiceMonitor se mel nahi kha raha)' : '');
    }
    function payLogs(c, p) {
      const v = cur(c);
      const head = `{"level":"info","msg":"pay-api ${c.ver} listening","port":8080}\n` + (v.mport === 9102 ? '{"level":"info","msg":"metrics server listening","addr":":9102","path":"/metrics"}\n{"level":"info","msg":"debug metrics on: pay_txn_latency_seconds (per txn_id)"}' : '{"level":"info","msg":"metrics on main port","path":"/metrics"}');
      if (c.ver === '1.9.1') return head + `\n{"level":"info","msg":"POST /pay 200","ms":212}\n{"level":"error","msg":"POST /pay 504","err":"fraud-check v2: context deadline exceeded","timeout_ms":300,"trace_id":"${TRACE}"}\n{"level":"info","msg":"POST /pay 200","ms":198}\n{"level":"error","msg":"POST /pay 504","err":"fraud-check v2: context deadline exceeded","timeout_ms":300,"trace_id":"9c1d77e0a4b2f5c8d1e3a6b9c2f4d7e0"}`;
      return head + '\n{"level":"info","msg":"POST /pay 200","ms":204}\n{"level":"info","msg":"POST /pay 200","ms":191}\n{"level":"info","msg":"POST /pay 200","ms":222}';
    }
    function appMetrics(c, port) {
      const v = cur(c);
      if (port === 8080 && v.mport === 9102) return { err: 'wget: server returned error: HTTP/1.1 404 Not Found' };
      if (port !== 8080 && port !== v.mport) return { err: `wget: can't connect to remote host (127.0.0.1): Connection refused` };
      return { out: '# HELP http_requests_total Requests by route and code\n# TYPE http_requests_total counter\nhttp_requests_total{code="200",route="/pay"} 184420\nhttp_requests_total{code="504",route="/pay"} ' + (v.txn ? 7921 : 3) + '\n' +
        (v.txn ? '# HELP pay_txn_latency_seconds Per-transaction latency (DEBUG)\n# TYPE pay_txn_latency_seconds histogram\n' + ['CPX97211', 'CPX97212', 'CPX97213'].map(t => ['0.05', '0.1', '0.25', '0.5'].map(le => `pay_txn_latency_seconds_bucket{le="${le}",txn_id="${t}"} 1`).join('\n')).join('\n') + '\n(… har payment ke liye aisi 12 lines; abhi tak 18 hazaar txn_id)' : '# (koi per-txn metric nahi)') };
    }

    function build({ risky }) {
      const c = { clock: 0, ver: '1.9.1', undoAt: null, rolling: null, series: 160000, svc: { tp: 8080 }, sm: { ok: true, drop: null }, downSince: -10, lastRatio: null,
        hist: [{ rev: 13, ver: '1.9.0' }, { rev: 14, ver: '1.9.1' }] };
      const p0 = `pay-api-${V['1.9.1'].hash}-k2x7q`, n0 = `pay-api-${V['1.9.0'].hash}-c5n1v`;
      const Q = q => `promtool query instant http://localhost:9090 '${q}'`;
      const podArg = cmd => (String(cmd).split(/\s+/).slice(2).filter((t, i, a) => !/^-/.test(t) && !/^(-c|-n|--namespace|--tail|--since)$/.test(a[i - 1] || ''))[0] || '');
      const findPay = (c2, name) => podsOf(c2).find(p => p.name === name) || (/^(deploy(ment)?\/)?pay-api$/.test(name) ? podsOf(c2)[0] : null);
      return {
        title: '📟 On-call shift: release ki raat — monitoring andhi',
        instructions: 'Tum aaj raat ChaiPay ke on-call engineer ho (21:40 se). 21:30 par pay-api 1.9.1 release hui thi. Har command = 1 minute. Ek alert theek karoge toh agla aayega — aur woh pichhle fix ne hi saamne laaya ho sakta hai. Madad: cat runbook.md',
        goal: `📟 Pehla alert (21:40): <b>${INC[0].sev} ${INC[0].id}</b> — ${INC[0].text}<br>
          Har alert: saboot (targets, PromQL, logs, traces) → wajah → theek karo (<code>vi</code> + <code>kubectl apply</code>, ya rollback) → <b>pakka karo</b>.
          Khatarnaak commands roke jaayenge aur report card mein ginte hain.`,
        cluster: c,
        responses: [
          risky(/^kubectl delete (?:pods?|po)[ /]prometheus-kps-0\b.*$/, 'Prometheus restart — lakhon series ka WAL replay, 5–10 min saare alerts andhe; aur wajah (cardinality) wahi rahegi.'),
          risky(/^kubectl delete (?:pvc|persistentvolumeclaims?)\b.*$/, 'Prometheus ki PVC delete — 15 din ka saara metrics data gaya. Kabhi nahi.'),
          risky(/^kubectl delete (?:servicemonitors?|smon)\b.*$/, 'ServiceMonitor delete — pay-api phir se andha, SLO alert bhi. Sirf us ek metric ko drop karo.'),
          risky(/^amtool\b.*silence\b.*$/, 'alert silence — alert chup, wajah zinda. Silence sirf tab jab wajah pata ho aur fix chal raha ho.'),
          risky(/^kubectl scale\b.*\bpay-api\b.*--replicas[ =]0\b.*$/, 'pay-api scale 0 — saare UPI payments band. Kabhi nahi.'),
          risky(/^kubectl delete (?:deploy|deployments?|svc|services?|ns|namespaces?)\b.*$/, 'core object delete — raat ko outage mat banao.'),
          { re: /^kubectl delete (?:pods?|po)[ /](pay-api-\S+)\b.*$/, out: (s, m) => `pod "${m[1]}" deleted\n(ReplicaSet ne naya pod banaya — wahi ${s.cluster.ver} image, wahi haal)` },
          { re: /^kubectl (?:edit|patch|set)\b.*$/, err: true, out: '(simulator) raat ko bhi git wali file se karo: vi pay-api-service.yaml / pay-api-servicemonitor.yaml → Save → kubectl apply -f <file>. Release wapas lene ke liye: kubectl rollout undo deployment/pay-api' },
          { re: /^promtool query instant \S+ (['"])(.*)\1\s*$/, out: (s, m) => promql(s.cluster, m[2]) },
          { re: /^promtool\b.*$/, err: true, out: "usage: promtool query instant http://localhost:9090 '<PromQL>'   (query ko single quotes mein do — runbook dekho)" },
          { re: /^curl\b.*tempo\S*:3200\/api\/traces\/(\w+).*$/,
            out: (s, m) => m[1] !== TRACE && m[1] !== '9c1d77e0a4b2f5c8d1e3a6b9c2f4d7e0' ? 'trace not found' :
              `(simulator: Tempo ka OTLP JSON chhota karke)\ntrace ${m[1]}   POST /pay   312ms   ERROR\n└─ pay-api        POST /pay              312ms   status=ERROR (504)\n   ├─ ledger       SELECT accounts          4ms\n   ├─ fraud-check  POST /v1/score          38ms\n   └─ fraud-check  POST /v2/score         300ms   status=ERROR "context deadline exceeded"   ← 1.9.1 ka naya call` },
          { re: /^curl\b.*$/, err: true, out: '(simulator) curl yahan sirf Tempo ke liye: curl -s http://tempo.monitoring:3200/api/traces/<trace_id>  (Prometheus ke liye promtool query instant)' },
          { re: /^kubectl exec\b.*(?:wget|curl)\b.*localhost:(\d+)\/metrics.*$/,
            out: (s, m) => { const name = podArg(m[0]), p = findPay(s.cluster, name); if (!p) return `Error from server (NotFound): pods "${name}" not found`;
              const r = appMetrics(s.cluster, Number(m[1])); return r.err ? r.err + '\ncommand terminated with exit code 1' : r.out; } },
          { re: /^kubectl logs\b.*$/,
            out: (s, m) => { const c2 = s.cluster, name = podArg(m[0]), p = findPay(c2, name);
              if (p) return payLogs(c2, p);
              if (/^pay-api-/.test(name)) return `Error from server (NotFound): pods "${name}" not found\n(rollback ke baad pods ke naam badal gaye — kubectl get pods)`;
              if (/^prometheus-kps-0$/.test(name)) return `ts=2026-11-25T16:${String(10 + c2.clock).padStart(2, '0')}:00.412Z caller=head.go:1282 level=info component=tsdb msg="Head GC completed" duration=${(c2.series / 200000).toFixed(1)}s\n(simulator: Prometheus khud cardinality ka alert nahi likhta — series PromQL se gino)`;
              return `Error from server (NotFound): pods "${name}" not found`; } },
          { re: /^kubectl top (?:pods?|po)\b.*$/,
            out: s => { const c2 = s.cluster; return tbl([['NAME', 'CPU(cores)', 'MEMORY(bytes)']].concat(c2.pods.map(p => [p.name, p.app === 'prometheus' ? '1210m' : p.app === 'pay-api' ? '310m' : '40m', p.app === 'prometheus' ? p.memMi + 'Mi' : p.app === 'ledger' ? '3104Mi' : '180Mi'])))
              + `\n(prometheus-kps-0 ki memory limit 4096Mi)`; } },
          { re: /^kubectl rollout history (?:deploy(?:ment)?)[ /]pay-api\b.*$/,
            out: s => 'deployment.apps/pay-api\nREVISION  CHANGE-CAUSE\n' + s.cluster.hist.map(h => String(h.rev).padEnd(10) + V[h.ver].cause).join('\n') },
          { re: /^kubectl rollout undo (?:deploy(?:ment)?)[ /]pay-api\b(.*)$/,
            out: (s, m) => { const c2 = s.cluster, H = c2.hist, want = (String(m[1]).match(/--to-revision[ =](\d+)/) || [])[1];
              const tgt = want ? H.find(h => h.rev === Number(want)) : H[H.length - 2];
              if (!tgt) return `error: unable to find specified revision ${want} in history`;
              if (tgt.ver === c2.ver) return `deployment.apps/pay-api skipped rollback (current template already matches revision ${tgt.rev})`;
              H.splice(H.indexOf(tgt), 1); H.push({ rev: H.reduce((a, h) => Math.max(a, h.rev), 0) + 1, ver: tgt.ver });
              c2.ver = tgt.ver; c2.undoAt = c2.clock; c2.rolling = c2.clock;
              return 'deployment.apps/pay-api rolled back' + (tgt.ver === '1.9.1' ? '\n(simulator: undo = PICHHLA revision — jo ab 1.9.1 tha. Rollback ka rollback = wahi kharab release.)' : ''); } },
          { re: /^kubectl rollout status (?:deploy(?:ment)?)[ /]pay-api\b.*$/, out: s => s.cluster.rolling != null ? 'Waiting for deployment "pay-api" rollout to finish: 2 of 3 updated replicas are available...' : 'deployment "pay-api" successfully rolled out' },
        ],
        files: {
          'runbook.md': { desc: 'on-call runbook (padhne ke liye)', content: RUNBOOK, apply: () => ({ err: 'error: error parsing runbook.md: yeh runbook hai, manifest nahi — cat runbook.md' }) },
          'show-targets.sh': { desc: 'Prometheus ke targets: job, pod, health, last error', content: '#!/bin/sh\n# port-forward pehle se chalu hai (localhost:9090)\ncurl -s localhost:9090/api/v1/targets \\\n  | jq -r \'.data.activeTargets[] | [.labels.job, .labels.pod, .health, .lastError] | @tsv\'', apply: s => showTargets(s.cluster) },
          'pay-api-service.yaml': {
            editable: true, desc: 'pay-api ka Service (git)', content: SVC_FILE,
            apply: (s, text, docs) => {
              const c2 = s.cluster, d = (docs || [])[0] || {}, sp = d.spec || {}, ports = sp.ports || [];
              if (d.kind !== 'Service' || (d.metadata || {}).name !== 'pay-api') return { err: '(simulator ne roka) is file mein Service pay-api hi rahe.' };
              if (((sp.selector || {}).app) !== 'pay-api') return { err: '(simulator ne roka) selector app: pay-api mat badlo — saara traffic band ho jaata.' };
              const http = ports.find(p => p && p.name === 'http'), met = ports.find(p => p && p.name === 'metrics');
              if (!http || http.port !== 80 || http.targetPort !== 8080) return { err: '(simulator ne roka) http port (80 → 8080) mat chhuo — saare payments isi se aate hain.' };
              if (!met) return { err: '(simulator ne roka) "metrics" naam ka port rehne do — ServiceMonitor isi NAAM se port dhoondhta hai.' };
              if (met.port !== 9102) return { err: '(simulator ne roka) metrics ka Service port 9102 rehne do — sirf targetPort (pod ka port) badlo.' };
              const tp = met.targetPort;
              const bad = typeof tp === 'string' && (!/^[a-z0-9-]+$/.test(tp) ? 'must contain only alpha-numeric characters (a-z, 0-9), and hyphens (-)' : tp.length > 15 ? 'must be no more than 15 characters' : !/[a-z]/.test(tp) ? 'must contain at least one letter (a-z)' : /^-|-$/.test(tp) ? 'must not begin or end with a hyphen' : null);
              if (bad) return { err: `The Service "pay-api" is invalid: spec.ports[1].targetPort: Invalid value: "${tp}": ${bad}` };
              if (typeof tp === 'number' && (tp < 1 || tp > 65535)) return { err: `The Service "pay-api" is invalid: spec.ports[1].targetPort: Invalid value: ${tp}: must be between 1 and 65535, inclusive` };
              if (tp === c2.svc.tp) return 'service/pay-api unchanged';
              c2.svc.tp = tp;
              return 'service/pay-api configured' + (typeof tp === 'string' && cur(c2).ports[tp] == null ? `\n(simulator: pod ke container mein "${tp}" naam ka port nahi — is port ke Endpoints khaali rahenge)` : '');
            },
          },
          'pay-api-servicemonitor.yaml': {
            editable: true, desc: 'pay-api ka ServiceMonitor (git)', content: SM_FILE,
            apply: (s, text, docs) => {
              const c2 = s.cluster, d = (docs || [])[0] || {}, sp = d.spec || {}, md = d.metadata || {}, ep = (sp.endpoints || [])[0] || {};
              if (d.kind !== 'ServiceMonitor' || md.name !== 'pay-api') return { err: '(simulator ne roka) is file mein ServiceMonitor pay-api hi rahe.' };
              if (((md.labels || {}).release) !== 'kps') return { err: '(simulator ne roka) label release: kps mat hatao — Prometheus "kps" is ServiceMonitor ko chunna hi band kar dega.' };
              if (ep.port !== 'metrics' || ep.path !== '/metrics') return { err: '(simulator ne roka) port: metrics aur path: /metrics rehne do — port ka masla Service mein hai.' };
              const rl = ep.metricRelabelings;
              let drop = null;
              if (rl != null) {
                if (!Array.isArray(rl)) return { err: 'error: error validating "pay-api-servicemonitor.yaml": error validating data: ValidationError(ServiceMonitor.spec.endpoints[0].metricRelabelings): invalid type for com.coreos.monitoring.v1.ServiceMonitor.spec.endpoints.metricRelabelings: got "map", expected "array"' };
                for (const r of rl) {
                  const act = String((r || {}).action || 'replace').toLowerCase();
                  if (!['replace', 'keep', 'drop', 'labeldrop', 'labelkeep', 'hashmod', 'labelmap', 'keepequal', 'dropequal', 'lowercase', 'uppercase'].includes(act))
                    return { err: `The ServiceMonitor "pay-api" is invalid: spec.endpoints[0].metricRelabelings[0].action: Unsupported value: "${r.action}": supported values: "replace", "Replace", "keep", "Keep", "drop", "Drop", "hashmod", "HashMod", "labelmap", "LabelMap", "labeldrop", "LabelDrop", "labelkeep", "LabelKeep", "lowercase", "Lowercase", "uppercase", "Uppercase", "keepequal", "KeepEqual", "dropequal", "DropEqual"` };
                  if (act === 'labeldrop') return { err: '(simulator ne roka) labeldrop txn_id se har payment ki series ek hi labelset mein gir jaati — "duplicate sample for timestamp" errors aur galat histogram. Yeh metric sirf debug ke liye tha: poora metric drop karo (action: drop, sourceLabels: [__name__]).' };
                  if (act !== 'drop') return { err: '(simulator) is shift mein metricRelabelings ka "drop" action chahiye: sourceLabels: [__name__], regex: pay_txn_latency_seconds.*, action: drop' };
                  const src = r.sourceLabels;
                  if (!Array.isArray(src) || src.join(';') !== '__name__') return { err: '(simulator ne roka) sourceLabels: [__name__] do — metric ke NAAM par drop karna hai.' };
                  let re;
                  try { re = new RegExp('^(?:' + String(r.regex == null ? '(.*)' : r.regex) + ')$'); } catch (e) { return { err: `The ServiceMonitor "pay-api" is invalid: regex "${r.regex}": error parsing regexp` }; }
                  if (['http_requests_total', 'http_request_duration_seconds_bucket'].some(n => re.test(n))) return { err: `(simulator ne roka) regex "${r.regex}" pay-api ke SLO wale metrics (http_requests_total) bhi gira dega — error alert andha. Sirf pay_txn_latency_seconds.* chuno.` };
                  if (!['pay_txn_latency_seconds_bucket', 'pay_txn_latency_seconds_sum', 'pay_txn_latency_seconds_count'].every(n => re.test(n))) return { err: `(simulator) regex "${r.regex}" pay_txn_latency_seconds_bucket / _sum / _count teeno se nahi milta (Prometheus regex poore naam se milta hai). Jaise: pay_txn_latency_seconds.*` };
                  drop = String(r.regex);
                }
              }
              if (drop === c2.sm.drop) return 'servicemonitor.monitoring.coreos.com/pay-api unchanged';
              c2.sm.drop = drop;
              return 'servicemonitor.monitoring.coreos.com/pay-api configured\n(Prometheus Operator ~30 second mein naya scrape config laga deta hai)';
            },
          },
        },
        successText: `<b>Raat ki kahani (root cause chain):</b> 1.9.1 ne /metrics naye port 9102 par daala, Service ab bhi 8080 par bhejta raha → 404, <b>TargetDown</b> (1) — aur isi andhepan mein error alert bhi chup tha →
          targets lautte hi debug metric <code>pay_txn_latency_seconds{txn_id}</code> ne har payment ki nayi series banayi → Prometheus ki memory bhaagi (2) → metric drop kiya toh asli dard dikha: 4% payments 504, fraud-check v2 ka 300ms timeout (3) →
          rollback ne Deployment 1.9.0 par lautaya par Service raat wale 9102 par atka raha → connection refused (4).<br>
          <b>Seekh:</b> "alert nahi aaya" ka matlab "sab theek" nahi — pehle dekho ki metrics aa bhi rahe hain (<code>up</code>, <code>absent()</code>). Label ki values ginti ki ho, har request ki nahi. Rollback ek hisse ka nahi, poori release ka hota hai.<br>
          <b>Postmortem action items:</b> <code>absent(up{job="pay-api"})</code> alert · ServiceMonitor mein <code>sampleLimit</code> · Service + Deployment ek hi Helm chart mein, rollback = <code>helm rollback</code> · naye downstream calls ka timeout uske p99 se upar.`,
        solution: [
          'bash show-targets.sh', `kubectl logs ${p0}`, 'kubectl describe svc pay-api',
          { edit: 'pay-api-service.yaml', change: [['targetPort: 8080      # 1.9.0 tak /metrics isi port par tha', 'targetPort: 9102']] }, 'kubectl apply -f pay-api-service.yaml', 'bash show-targets.sh',
          Q('prometheus_tsdb_head_series'), Q('topk(5, count by (__name__) ({job="pay-api"}))'),
          { edit: 'pay-api-servicemonitor.yaml', change: [['    interval: 30s\n', '    interval: 30s\n    metricRelabelings:\n    - sourceLabels: [__name__]\n      regex: pay_txn_latency_seconds.*\n      action: drop\n']] },
          'kubectl apply -f pay-api-servicemonitor.yaml', Q('scrape_samples_post_metric_relabeling{job="pay-api"}'),
          Q('sum by (code) (rate(http_requests_total{job="pay-api"}[5m]))'), `kubectl logs ${p0}`, `curl -s http://tempo.monitoring:3200/api/traces/${TRACE}`, 'kubectl rollout history deployment/pay-api',
          'kubectl rollout undo deployment/pay-api', 'kubectl get pods', `kubectl logs ${n0}`,
          'bash show-targets.sh', { edit: 'pay-api-service.yaml', change: [['targetPort: 9102', 'targetPort: 8080']] }, 'kubectl apply -f pay-api-service.yaml', 'bash show-targets.sh',
        ],
      };
    }
    KG.oncall.add({ id: 'blind', start: 21 * 60 + 40, INC, reconcile, views, build });
  })();

  addLab('ob-boss', { type: 'oncall', id: 'oncall-blind', shift: 'blind', title: '📟 On-call Shift: release ki raat — monitoring andhi (4 alerts)' }, {
    objectives: ['📟 <b>On-call shift:</b> release ke baad ke 4 jude alerts — TargetDown, cardinality, error budget burn, aur aadha rollback'],
    success: ['Main "alert nahi aaya" aur "sab theek hai" mein farak karke, targets → series → errors → rollback kram se sambhal sakta hoon'],
    cards: [{ front: 'Prometheus target "down", last error "server returned HTTP status 404 Not Found" — matlab?', back: 'Port khula hai, par us port par <code>/metrics</code> nahi. Dekho app metrics kis port par deti hai (logs) aur Service ka <code>targetPort</code> kahan bhejta hai (<code>kubectl describe svc</code>).' },
      { front: 'Ek metric ne lakhon series bana di (label mein txn_id) — raat ka fix?', back: 'ServiceMonitor <code>metricRelabelings</code>: <code>sourceLabels: [__name__]</code>, <code>regex: &lt;metric&gt;.*</code>, <code>action: drop</code>. labeldrop nahi — usse duplicate samples aur galat histogram.' }],
  });
})();
