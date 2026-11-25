/* =====================================================================
   KubeGurukul — 📟 On-call shift  (stage type: 'oncall')
   Ek raat, ek cluster, 4 JUDE hue incidents — har ek pichhle ke fix se paida:
     1 PayApiDown            ConfigMap "3s" → pay-api CrashLoop
     2 PayApiHighLatency     pay-api theek → sale traffic → HPA max 4 par atka
     3 KubePodsPending       max badhaya → naye pods Pending (reports-backfill ne CPU gher rakha)
     4 LedgerTooManyConns    8 pods × pool 50 = 400 > ledger 300 → pool ghatao + rollout restart
   Har command = 1 minute (simulated ghadi). Incident tab RESOLVE hota hai jab
   haalat theek ho AUR fix ke baad tumne pakka kiya (verify command).
   Aakhir mein report card: MTTR, hints, verify, roke gaye khatarnaak commands, grade.

   stage: { type: 'oncall', id: 'oncall-sale', shift: 'sale', title, intro?: 'HTML' }   (shift na ho toh 'sale')
   KG.oncall.mission(onUpdate, shiftId) → poora terminal mission (validator / replay isi se)
   Engine hooks (terminal.js): stage.onTick(sim, print), stage.hintsFor(sim)

   🧩 Nayi shift jodna (data-oncall.js mein, 2026-11-25 se):
   KG.oncall.add({
     id: 'patch', start: 23 * 60,                // ghadi 23:00 se
     INC: [ { id, sev: '🔴 SEV1' | '🟠 SEV2', text, fixed: c => bool, verify: /regex/, verifyText, hints: [3],
              onFire?: (c, sim) => {} } ],       // onFire = alert aate hi cluster mein kuch shuru karo
     build: ({ risky }) => ({ cluster, title, instructions, goal, responses, files, successText, solution }),
     reconcile: (c, sim) => {},                  // har command (1 minute) par cluster aage badhao
     views: c => {},                             // c.pods / c.deployments / c.custom … taaza karo (kubectl get/describe)
   })
   Engine khud jodta hai: ghadi, alerts ka kram, "theek → pakka karo", tasks, hints, report card.
   risky(re, why) = khatarnaak command roko aur report card mein gino.
   ===================================================================== */
KG.oncall = (function () {
  const SHIFTS = {};
  const hhmm = c => { const m = (c.start == null ? 22 * 60 : c.start) + (c.clock || 0); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  function tbl(rows) {
    const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i] == null ? '' : r[i]).length)));
    return rows.map(r => r.map((x, i) => i === r.length - 1 ? String(x) : String(x).padEnd(w[i] + 3)).join('')).join('\n');
  }
  const add = def => { SHIFTS[def.id] = def; return def; };
  const get = id => SHIFTS[id || 'sale'];
  const ids = () => Object.keys(SHIFTS);
  /* ---------- controller: har command = 1 minute ---------- */
  function tick(def, sim, print, onUpdate) {
    const c = sim.cluster, INC = def.INC;
    if (c.over) return;
    c.clock++;
    def.reconcile(c, sim);
    const k = c.inc, cur = c.incs[k];
    if (!cur.fixedAt && INC[k].fixed(c, sim)) { cur.fixedAt = c.clock; cur.fixedIdx = sim.history.length; }
    if (cur.fixedAt && !cur.verified && sim.history.slice(cur.fixedIdx).some(h => INC[k].verify.test(h))) cur.verified = true;
    if (cur.fixedAt && cur.verified) {
      cur.resolved = c.clock;
      cur.hints = (sim.hintPos || {})['i' + k] || 0;
      if (print) print('task', `📟 ${hhmm(c)}  ✅ RESOLVED  ${INC[k].id} — MTTR ${cur.resolved - cur.fired} min`);
      if (k + 1 < INC.length) {
        c.inc = k + 1;
        c.incs[k + 1].fired = c.clock;
        if (INC[k + 1].onFire) INC[k + 1].onFire(c, sim);
        if (print) print('err', `📟 ${hhmm(c)}  [FIRING] ${INC[k + 1].sev} ${INC[k + 1].id} — ${INC[k + 1].text}`);
      } else { c.over = true; if (print) print('task', `📟 ${hhmm(c)}  🌅 Saare alerts shaant. Shift handover ka waqt.`); }
    } else if (cur.fixedAt && !cur.verified && !cur.nudged && print) {
      cur.nudged = true;
      print('sys', `(📟 alert ${INC[k].id} ki haalat theek lag rahi hai — resolve karne se pehle ${INC[k].verifyText})`);
    }
    def.views(c, sim);
    if (onUpdate) onUpdate(c);
  }
  /* ---------- poora mission: shift ka build() + engine ke hisse ---------- */
  function mission(onUpdate, id) {
    const def = get(id);
    if (!def) throw new Error('oncall: shift "' + id + '" registered nahi hai');
    const INC = def.INC;
    const risky = (re, why) => ({ re, err: true, out: s => { s.cluster.risky++; s.cluster.riskyList.push(why.split(' — ')[0]); return '(simulator ne roka — report card mein gina jayega) ' + why; } });
    const b = def.build({ risky });
    const c0 = Object.assign(b.cluster, { clock: 0, start: def.start, inc: 0, over: false, risky: 0, riskyList: [], incs: INC.map((x, i) => ({ fired: i === 0 ? 0 : null })) });
    def.views(c0);
    const T = INC.map((inc, i) => ({ text: `📟 ${i + 1}. <b>${inc.id}</b> — theek karo, phir pakka karo`, check: s => !!s.cluster.incs[i].resolved }));
    return Object.assign({ hints: INC[0].hints }, b, {
      type: 'terminal', oncall: true, shift: def.id, tasks: T, cluster: c0, success: KG.allOf(T),
      onTick: (sim, print) => tick(def, sim, print, onUpdate),
      hintsFor: sim => ({ key: 'i' + sim.cluster.inc, list: INC[sim.cluster.inc].hints }),
    });
  }
  return { add, get, ids, mission, hhmm, tbl };
})();

/* =====================================================================
   📟 Shift 'sale' — boss2: Diwali sale ki raat (22:00 se)
   ===================================================================== */
(function () {
  const tbl = KG.oncall.tbl;
  const NODES = [{ name: 'node-1', ip: '10.0.12.5', net: '10.0.12' }, { name: 'node-2', ip: '10.0.13.5', net: '10.0.13' }, { name: 'node-3', ip: '10.0.14.5', net: '10.0.14' }];
  const ALLOC = 3.92 * 3, OTHER = 0.9 + 1.0 + 0.5 + 0.05, BF_CPU = 1.2, PAY_CPU = 0.5, NEED = 8, MAXCONN = 300, RESERVED = 3;
  const SUF = ['k2x7q', 'm4p8t', 'r8w3z', 'c5n1v', 'h6j2b', 'q9d4s', 't3f8g', 'w7y5k', 'b1z6n', 'p5r2c', 'd8f3h', 'g2k7m', 'j4n9p', 'l6q1r', 'v3s5t', 'y7u2w'];
  const HASH = ['7c4f9b', '5e8a2d', '9b3c6f', '4d7e1a'];
  const IMG = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api:1.9.0';
  const CM_FILE = `apiVersion: v1
kind: ConfigMap
metadata:
  name: pay-api-config
  namespace: payments
data:
  LEDGER_URL: postgres://ledger:5432/ledger
  UPI_TIMEOUT_MS: "3s"           # Amit, aaj 6 PM: "NPCI dheema hai, timeout badhao"
  DB_POOL_SIZE: "50"             # har pod ledger ke kitne connections khole
`;
  const HPA_FILE = `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pay-api
  namespace: payments
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pay-api
  minReplicas: 2
  maxReplicas: 4
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
`;
  const RUNBOOK = `# ChaiPay on-call runbook — payments (Diwali sale)
Pehle dekho, phir chhuo. Har fix ke baad PAKKA karo.

pay-api haal:     kubectl get pods · kubectl logs <pod> · kubectl describe pod <pod>
Autoscaling:      kubectl get hpa · kubectl describe hpa pay-api      (file: pay-api-hpa.yaml)
Config:           pay-api-config.yaml (ConfigMap) — env sirf pod START par padha jaata hai
CPU kahan gaya:   kubectl top pods · kubectl describe node <node>
Ledger (Postgres) connections:
  kubectl exec ledger-0 -- psql -U postgres -c "select count(*) from pg_stat_activity"
  max_connections = 300 (badalne ke liye ledger RESTART chahiye — peak par mat karo)

Batch jobs: reports-backfill (kal subah tak ruk sakta hai — scale 0 theek hai, delete nahi)
Mat chhuna: ledger-0 (PRIMARY DB) · namespace · HPA delete · node drain
`;
  /* ---------- incidents ---------- */
  const INC = [
    { id: 'PayApiDown', sev: '🔴 SEV1', text: 'pay-api: 0/2 pods Ready — UPI payments fail ho rahe hain.',
      verify: /^kubectl get (pods?|po)\b|^kubectl logs\b.*pay-api/, verifyText: 'pods dobara dekho (kubectl get pods)',
      hints: ['kubectl get pods — STATUS? Phir kubectl logs <pay-api pod> — app marne se pehle kya bolti hai?',
        'Log mein UPI_TIMEOUT_MS="3s" — app milliseconds ka NUMBER maangti hai. cat pay-api-config.yaml',
        'vi pay-api-config.yaml — "3s" ko "3000" karo, Save, kubectl apply -f pay-api-config.yaml, phir kubectl get pods'] },
    { id: 'PayApiHighLatency', sev: '🟠 SEV2', text: 'pay-api p99 latency 2.4s (SLO 800ms). Diwali sale ka traffic aa gaya hai.',
      verify: /^kubectl (get|describe) (hpa|horizontalpodautoscalers?)\b/, verifyText: 'HPA dobara dekho (kubectl get hpa)',
      hints: ['kubectl get hpa — TARGETS aur REPLICAS dekho. MAXPODS kitna hai?',
        'kubectl describe hpa pay-api — "ScalingLimited … TooManyReplicas": load ke liye ~8 pods chahiye, max 4 hai.',
        'vi pay-api-hpa.yaml — maxReplicas: 4 ko 10 karo, Save, kubectl apply -f pay-api-hpa.yaml, phir kubectl get hpa'] },
    { id: 'KubePodsPending', sev: '🟠 SEV2', text: 'payments: pay-api ke naye pods Pending — latency abhi bhi upar.',
      verify: /^kubectl get (pods?|po|hpa)\b/, verifyText: 'pods dobara dekho (kubectl get pods)',
      hints: ['kubectl get pods — Pending pod ka kubectl describe pod <naam>: FailedScheduling kya kehta hai?',
        '"Insufficient cpu" — CPU kaun kha raha hai? kubectl top pods, aur cat runbook.md (batch jobs wala hissa).',
        'reports-backfill kal tak ruk sakta hai: kubectl scale deployment reports-backfill --replicas=0, phir kubectl get pods'] },
    { id: 'LedgerTooManyConnections', sev: '🔴 SEV1', text: 'ledger: connections 300/300 — pay-api ke ~25% payments "too many clients" se fail.',
      verify: /^kubectl exec\b.*ledger-0\b.*pg_stat_activity|^kubectl logs\b.*pay-api/, verifyText: 'ledger ke connections gino (runbook ka psql command) ya pay-api logs',
      hints: ['kubectl logs <pay-api pod> — kya error hai? Phir runbook ka psql command: ledger par kitne connections?',
        '8 pods × DB_POOL_SIZE 50 = 400, ledger max 300 (3 reserved). Pool itna rakho ki 8 × pool ≤ 297 — par bahut chhota bhi nahi (≥ 20).',
        'vi pay-api-config.yaml — DB_POOL_SIZE "50" ko "30" karo, Save, apply. Env sirf start par padha jaata hai: kubectl rollout restart deployment/pay-api. Phir psql se gino.'] },
  ];
  const intOk = v => /^\d+$/.test(String(v == null ? '' : v));
  const pays = c => c.pods.filter(p => p.app === 'pay-api');
  const running = c => pays(c).filter(p => p.st === 'Running');
  const poolOf = p => Number(p.env.DB_POOL_SIZE) || 0;
  const conns = c => Math.min(MAXCONN, running(c).reduce((a, p) => a + poolOf(p), 0) + RESERVED);
  const overConn = c => running(c).reduce((a, p) => a + poolOf(p), 0) > MAXCONN - RESERVED;
  const free = c => ALLOC - OTHER - c.backfill * BF_CPU - pays(c).filter(p => p.st !== 'Pending').length * PAY_CPU;
  function newPod(c) {
    c.podN++;
    const node = NODES[(c.podN - 1) % 3];
    return { app: 'pay-api', name: `pay-api-${c.hash}-${SUF[(c.podN - 1) % SUF.length]}`, home: node.name, podIp: `${node.net}.${40 + c.podN}`, env: Object.assign({}, c.cm), rc: 0, born: c.clock, st: 'Pending' };
  }
  // pod ki haalat: Pending (CPU nahi) / CrashLoop (config) / Running
  function settle(c, p) {
    if (p.st === 'Pending') { if (free(c) >= PAY_CPU) { p.st = 'Starting'; p.env = Object.assign({}, c.cm); } else return; }
    if (!intOk(p.env.UPI_TIMEOUT_MS)) { p.st = 'CrashLoopBackOff'; p.rc = p.rc || (p.born > 0 ? 2 : 41); return; }
    p.st = 'Running';
  }
  /* ---------- controller: har tick (command) par ---------- */
  function reconcile(c) {
    // CrashLoop wale container agli restart par ConfigMap ka NAYA value padhte hain
    pays(c).forEach(p => { if (p.st === 'CrashLoopBackOff') { p.env = Object.assign({}, c.cm); p.rc++; } });
    pays(c).forEach(p => settle(c, p));
    if (!c.sale && running(c).length === pays(c).length && pays(c).length) c.sale = true;
    // HPA: sale ke baad load ke hisaab se 8 chahiye; crash ke waqt metrics nahi (<unknown>)
    const want = c.sale ? Math.max(c.hpa.min, Math.min(c.hpa.max, NEED)) : Math.max(c.hpa.min, Math.min(c.hpa.max, pays(c).length));
    c.desired = want;
    let ps = pays(c);
    while (ps.length < want) { const p = newPod(c); c.pods.push(p); ps = pays(c); }
    while (ps.length > want) { const victim = ps.filter(p => p.st === 'Pending').pop() || ps[ps.length - 1]; c.pods.splice(c.pods.indexOf(victim), 1); ps = pays(c); }
    pays(c).forEach(p => settle(c, p));
    c.backfillPods = Array.from({ length: c.backfill }, (_, i) => `reports-backfill-6f9d2c-${SUF[15 - i]}`);
  }
  const fixed = [
    c => pays(c).length > 0 && pays(c).every(p => p.st === 'Running'),
    c => c.hpa.max >= NEED,
    c => pays(c).length >= NEED && pays(c).every(p => p.st === 'Running'),
    c => pays(c).every(p => p.st === 'Running') && !overConn(c) && running(c).every(p => poolOf(p) >= 20),
  ];
  INC.forEach((x, i) => { x.fixed = fixed[i]; });
  /* ---------- kubectl ke views (builtins ke liye fields) ---------- */
  function podDesc(c, p) {
    const n = NODES.find(x => x.name === p.home);
    const head = `Name:             ${p.name}\nNamespace:        payments\nNode:             ${p.st === 'Pending' ? '<none>' : n.name + '/' + n.ip}\nLabels:           app=pay-api\n                  pod-template-hash=${p.name.split('-')[2]}\nStatus:           ${p.st === 'Pending' ? 'Pending' : 'Running'}\nControlled By:    ReplicaSet/pay-api-${p.name.split('-')[2]}\nContainers:\n  pay-api:\n    Image:          ${IMG}\n`;
    const env = `    Requests:\n      cpu:     500m\n      memory:  256Mi\n    Environment Variables from:\n      pay-api-config  ConfigMap  Optional: false\n`;
    if (p.st === 'Pending') return head + '    State:          Waiting\n' + env + 'Events:\n  Type     Reason            Age   From               Message\n  ----     ------            ----  ----               -------\n  Warning  FailedScheduling  ' + Math.max(1, c.clock - p.born) + 'm    default-scheduler  0/3 nodes are available: 3 Insufficient cpu. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.';
    if (p.st === 'CrashLoopBackOff') return head + `    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1\n    Ready:          False\n    Restart Count:  ${p.rc}\n` + env + `Events:\n  Type     Reason   Age                From     Message\n  ----     ------   ----               ----     -------\n  Warning  BackOff  20s (x${p.rc * 9} over 4h)  kubelet  Back-off restarting failed container pay-api in pod ${p.name}_payments(5c2a9e1f-3b7d-4f8a-a1c6-9e4d2b7f0a31)`;
    return head + `    State:          Running\n    Ready:          True\n    Restart Count:  ${p.rc}\n` + env + 'Events:          <none>';
  }
  function refreshViews(c) {
    c.pods.forEach(p => {
      if (p.app !== 'pay-api') return;
      p.status = p.st; p.ready = p.st === 'Running' ? '1/1' : '0/1';
      p.restarts = p.rc ? `${p.rc} (${p.st === 'CrashLoopBackOff' ? '40s' : Math.max(1, c.clock - (p.upAt || c.clock)) + 'm'} ago)` : 0;
      if (p.st === 'Running' && p.upAt == null) p.upAt = c.clock;
      p.age = p.born === 0 ? '4h' : (c.clock - p.born) < 1 ? '20s' : (c.clock - p.born) + 'm';
      p.describe = podDesc(c, p);
      p.node = p.st === 'Pending' ? '<none>' : p.home; p.ip = p.st === 'Pending' ? '<none>' : p.podIp;
    });
    const others = [{ name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '12d', node: 'node-3', ip: '10.0.14.11' },
      { name: 'notify-5b8c4d-x9t2k', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-2', ip: '10.0.13.71' },
      { name: 'notify-5b8c4d-j3w8q', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.0.12.72' }]
      .concat((c.backfillPods || []).map((n, i) => ({ name: n, ready: '1/1', status: 'Running', restarts: 0, age: '3h', node: NODES[i % 3].name, ip: NODES[i % 3].net + '.' + (90 + i) })));
    c.pods = pays(c).concat(others.map(o => Object.assign(o, { app: o.name.split('-')[0] })));
    const r = running(c).length;
    c.deployments = [{ name: 'pay-api', ready: `${r}/${pays(c).length}`, upToDate: pays(c).length, available: r, age: '40d' },
      { name: 'notify', ready: '2/2', upToDate: 2, available: 2, age: '40d' },
      { name: 'reports-backfill', ready: `${c.backfill}/${c.backfill}`, upToDate: c.backfill, available: c.backfill, age: '3h' }];
    const util = !c.sale || !r ? '<unknown>' : Math.round(NEED * 60 / Math.max(r, 1)) + '%';
    c.hpas = [{ name: 'pay-api', reference: 'Deployment/pay-api', targets: `cpu: ${util}/${c.hpa.target}%`, min: c.hpa.min, max: c.hpa.max, replicas: pays(c).length, age: '40d',
      describe: `Name:                                                  pay-api\nNamespace:                                             payments\nReference:                                             Deployment/pay-api\nMetrics:                                               ( current / target )\n  resource cpu on pods  (as a percentage of request):  ${util === '<unknown>' ? '<unknown>' : util + ' (' + Math.round(NEED * 300 / Math.max(r, 1)) + 'm)'} / ${c.hpa.target}%\nMin replicas:                                          ${c.hpa.min}\nMax replicas:                                          ${c.hpa.max}\nDeployment pods:                                       ${pays(c).length} current / ${c.desired} desired\nConditions:\n  Type            Status  Reason               Message\n  ----            ------  ------               -------\n` +
        (util === '<unknown>' ? '  ScalingActive   False   FailedGetResourceMetric  the HPA was unable to compute the replica count: failed to get cpu utilization: did not receive metrics for targeted pods (pods might be unready)'
          : '  AbleToScale     True    ReadyForNewScale     recommended size matches current size\n  ScalingActive   True    ValidMetricFound     the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)\n' +
          (c.hpa.max < NEED ? '  ScalingLimited  True    TooManyReplicas      the desired replica count is more than the maximum replica count' : '  ScalingLimited  False   DesiredWithinRange   the desired count is within the acceptable range')) }];
    const ev = [['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE']];
    pays(c).filter(p => p.st === 'Pending').forEach(p => ev.push(['30s', 'Warning', 'FailedScheduling', 'pod/' + p.name, '0/3 nodes are available: 3 Insufficient cpu. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.']));
    pays(c).filter(p => p.st === 'CrashLoopBackOff').forEach(p => ev.push(['20s', 'Warning', 'BackOff', 'pod/' + p.name, 'Back-off restarting failed container pay-api in pod ' + p.name + '_payments(5c2a9e1f-3b7d-4f8a-a1c6-9e4d2b7f0a31)']));
    if (c.sale) ev.push(['2m', 'Normal', 'SuccessfulRescale', 'horizontalpodautoscaler/pay-api', `New size: ${pays(c).length}; reason: cpu resource utilization (percentage of request) above target`]);
    c.events = tbl(ev).split('\n');
    c.configmaps = [{ name: 'pay-api-config', dataCount: Object.keys(c.cm).length, age: '40d', describe: 'Name:         pay-api-config\nNamespace:    payments\n\nData\n====\n' + Object.keys(c.cm).sort().map(k => `${k}:\n----\n${c.cm[k]}\n`).join('\n') + '\nEvents:  <none>' }];
  }
  function payLogs(c, p) {
    if (p.st === 'Pending') return `Error from server (BadRequest): pod ${p.name} does not have a host assigned`;
    if (p.st === 'CrashLoopBackOff') return `{"level":"info","ts":"2026-11-24T16:31:02.118Z","msg":"pay-api 1.9.0 starting"}\n{"level":"fatal","msg":"config: UPI_TIMEOUT_MS=\\"${p.env.UPI_TIMEOUT_MS}\\": strconv.Atoi: parsing \\"${p.env.UPI_TIMEOUT_MS}\\": invalid syntax"}`;
    const base = `{"level":"info","msg":"pay-api 1.9.0 listening","port":8080,"db_pool":${poolOf(p)}}`;
    if (overConn(c)) return base + '\n{"level":"error","msg":"ledger: pq: sorry, too many clients already","txn":"CPX97211"}\n{"level":"info","msg":"POST /pay 200","ms":640}\n{"level":"error","msg":"ledger: pq: sorry, too many clients already","txn":"CPX97214"}';
    if (poolOf(p) < 20 && c.sale) return base + `\n{"level":"warn","msg":"db pool exhausted, waited 870ms for a connection","pool":${poolOf(p)}}\n{"level":"info","msg":"POST /pay 200","ms":1910}`;
    if (c.sale && c.hpa.max < NEED) return base + '\n{"level":"info","msg":"POST /pay 200","ms":2380}\n{"level":"info","msg":"POST /pay 200","ms":2120}';
    return base + '\n{"level":"info","msg":"POST /pay 200","ms":212}\n{"level":"info","msg":"POST /pay 200","ms":198}';
  }
  /* ---------- poora mission ---------- */
  function build({ risky }) {
    const c0 = { clock: 0, sale: false, podN: 0, hash: HASH[0], rsN: 0, backfill: 6, desired: 2,
      cm: { LEDGER_URL: 'postgres://ledger:5432/ledger', UPI_TIMEOUT_MS: '3s', DB_POOL_SIZE: '50' }, cmApplied: CM_FILE, hpaApplied: HPA_FILE,
      hpa: { min: 2, max: 4, target: 60 }, pods: [],
      nodes: NODES.map(n => ({ name: n.name, status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' })),
      services: [{ name: 'pay-api', type: 'ClusterIP', clusterIP: '10.100.71.3', ports: '80/TCP', age: '40d' }, { name: 'ledger', type: 'ClusterIP', clusterIP: '10.100.18.9', ports: '5432/TCP', age: '40d' }] };
    c0.pods = [newPod(c0), newPod(c0)];
    c0.pods.forEach(p => { p.st = 'CrashLoopBackOff'; p.rc = 41; p.born = 0; });
    c0.backfillPods = Array.from({ length: 6 }, (_, i) => `reports-backfill-6f9d2c-${SUF[15 - i]}`);
    const p1 = c0.pods[0].name, pend = `pay-api-${HASH[0]}-${SUF[4]}`;
    const PSQL = 'kubectl exec ledger-0 -- psql -U postgres -c "select count(*) from pg_stat_activity"';
    return {
      title: '📟 On-call shift: Diwali sale ki raat',
      instructions: 'Tum aaj raat ChaiPay ke on-call engineer ho (22:00 – 02:00). Diwali sale chal rahi hai. Pager ka pehla alert aa chuka hai. Har command = 1 minute. Ek alert theek karoge toh agla aayega — aur woh pichhle se juda ho sakta hai. Madad: cat runbook.md',
      goal: `📟 Pehla alert (22:00): <b>${INC[0].sev} ${INC[0].id}</b> — ${INC[0].text} Aage ke alerts upar <b>pager</b> mein aayenge.<br>
        Har alert: wajah dhoondho → theek karo (<code>vi</code> + <code>kubectl apply</code>, ya runbook ka command) → <b>pakka karo</b>. Alert tabhi resolve hota hai jab pakka kar lo.
        Khatarnaak commands roke jaayenge aur report card mein ginte hain.`,
      cluster: c0,
      responses: [
        risky(/^kubectl delete (?:pods?|po)[ /]ledger-0\b.*$/, 'ledger-0 PRIMARY database hai — delete = failover, 30–60 second saare payments band. Pehle wajah dhoondho.'),
        risky(/^kubectl delete (?:pods?|po)\b.*--all\b.*$/, 'saare pods ek saath delete — poora namespace ek saath restart. Ek-ek wajah dhoondho.'),
        risky(/^kubectl delete (?:hpa|horizontalpodautoscalers?)\b.*$/, 'HPA delete — sale ke beech autoscaling hi band. Uski file (maxReplicas) theek karo.'),
        risky(/^kubectl delete (?:ns|namespaces?)\b.*$/, 'namespace delete — sab kuch mit jaata. Kabhi nahi.'),
        risky(/^kubectl delete (?:deploy|deployments?)[ /]reports-backfill\b.*$/, 'reports-backfill delete — kal subah ki settlement reports chahiye. scale 0 karo, delete nahi.'),
        risky(/^kubectl delete (?:deploy|deployments?|sts|statefulsets?|svc|services?|pvc|persistentvolumeclaims?)\b.*$/, 'core object delete — peak traffic par nahi. Wajah theek karo.'),
        risky(/^kubectl (?:drain|cordon)\b.*$/, 'node drain / cordon — sale ke beech capacity aur kam ho jaati.'),
        risky(/^kubectl scale\b.*\b(?:ledger|statefulset)\b.*$/, 'ledger (Postgres StatefulSet) scale — database replicas aise nahi badhte.'),
        risky(/^kubectl exec\b.*ledger-0\b.*(?:alter system|ALTER SYSTEM|max_connections\s*=).*$/, 'max_connections badalne ke liye Postgres RESTART chahiye — peak sale par primary restart = sab payments band. pay-api ka pool chhota karo.'),
        { re: /^kubectl exec\b.*ledger-0\b.*psql\b.*$/,
          out: (s, m) => {
            const cmd = String((m && m[0]) || ''), c = s.cluster;
            if (/show max_connections/i.test(cmd)) return ' max_connections \n-----------------\n 300\n(1 row)';
            if (/pg_stat_activity/i.test(cmd)) return ` count \n-------\n ${String(conns(c)).padStart(5)}\n(1 row)` + (overConn(c) ? '\n(simulator: 300 = chhat. pay-api maang rahi hai ' + running(c).reduce((a, p) => a + poolOf(p), 0) + ' connections.)' : '');
            return '(simulator: psql yahan sirf runbook wale sawal samajhta hai — count ya "show max_connections")';
          } },
        { re: /^kubectl logs\b.*$/,
          out: (s, m) => {
            const c = s.cluster, toks = String((m && m[0]) || '').split(' ').slice(2).filter((t, i, a) => !/^-/.test(t) && !/^(-c|-n|--namespace|--tail)$/.test(a[i - 1] || ''));
            const name = toks[0] || '';
            const p = pays(c).find(x => x.name === name) || (/^(deploy(ment)?\/)?pay-api$/.test(name) ? pays(c)[0] : null);
            if (p) return payLogs(c, p);
            if (/^reports-backfill/.test(name)) return '{"level":"info","msg":"backfill: merchant 18234/184220, ETA 6h"}';
            if (/^ledger-0$/.test(name)) return overConn(c) ? '2026-11-24 17:41:02.118 UTC [9123] FATAL:  sorry, too many clients already\n2026-11-24 17:41:02.164 UTC [9124] FATAL:  sorry, too many clients already' : '2026-11-24 17:41:02.118 UTC [88] LOG:  checkpoint complete';
            if (/^notify/.test(name)) return '{"level":"info","msg":"sms sent","provider":"gupshup"}';
            return `Error from server (NotFound): pods "${name}" not found`;
          } },
        { re: /^kubectl top (?:pods?|po)\b.*$/,
          out: s => { const c = s.cluster, r = running(c).length || 1; return tbl([['NAME', 'CPU(cores)', 'MEMORY(bytes)']].concat(running(c).map(p => [p.name, c.sale ? Math.round(NEED * 300 / r) + 'm' : '2m', '231Mi']))
            .concat((c.backfillPods || []).map(n => [n, '1187m', '1840Mi'])).concat([['ledger-0', '612m', '3104Mi'], ['notify-5b8c4d-x9t2k', '41m', '96Mi'], ['notify-5b8c4d-j3w8q', '38m', '94Mi']])); } },
        { re: /^kubectl top (?:nodes?|no)\b.*$/,
          out: s => { const c = s.cluster, used = ALLOC - free(s.cluster); return tbl([['NAME', 'CPU(cores)', 'CPU(%)', 'MEMORY(bytes)', 'MEMORY(%)']].concat(NODES.map(n => [n.name, Math.round(used / 3 * 1000) + 'm', Math.round(used / ALLOC * 100) + '%', '9214Mi', '61%']))); } },
        { re: /^kubectl describe (?:nodes?|no)\b.*$/,
          out: s => { const c = s.cluster, used = ALLOC - free(c); return `Name:               node-1\nAllocatable:\n  cpu:                3920m\nNon-terminated Pods:          (sab nodes ka jod)\n  reports-backfill ×${c.backfill}   cpu ${c.backfill * 1200}m\n  pay-api ×${pays(c).filter(p => p.st !== 'Pending').length}           cpu ${pays(c).filter(p => p.st !== 'Pending').length * 500}m\n  ledger-0             cpu 1000m\n  notify ×2            cpu 500m\nAllocated resources (teeno nodes):\n  Resource  Requests\n  --------  --------\n  cpu       ${Math.round(used * 1000)}m (${Math.round(used / ALLOC * 100)}%) of 11760m`; } },
        { re: /^kubectl scale\b.*\breports-backfill\b.*$/,
          out: (s, m) => {
            const c = s.cluster, mm = String((m && m[0]) || '').match(/--replicas[ =](\d+)/);
            if (!mm) return 'error: required flag(s) "replicas" not set';
            c.backfill = Math.min(6, Number(mm[1]));
            return 'deployment.apps/reports-backfill scaled' + (Number(mm[1]) > 6 ? '\n(simulator: 6 se zyada nahi — waise bhi CPU nahi hai)' : '');
          } },
        { re: /^kubectl scale\b.*\bpay-api\b.*$/, out: s => `deployment.apps/pay-api scaled\n(HPA ne 15 second mein wapas ${s.cluster.desired} kar diya — HPA wale Deployment ke replicas HPA tay karta hai. HPA ki file badlo: pay-api-hpa.yaml)` },
        { re: /^kubectl rollout restart (?:deploy(?:ment)?)[ /]pay-api\b.*$/,
          out: s => { const c = s.cluster; c.rsN++; c.hash = HASH[c.rsN % HASH.length]; const n = pays(c).length; c.pods = c.pods.filter(p => p.app !== 'pay-api'); for (let i = 0; i < n; i++) { const p = newPod(c); p.st = 'Starting'; c.pods.push(p); } pays(c).forEach(p => settle(c, p)); return 'deployment.apps/pay-api restarted\n(rolling update: naye pods ConfigMap ka abhi ka value padh kar uthe)'; } },
        { re: /^kubectl rollout undo (?:deploy(?:ment)?)[ /]pay-api\b.*$/, out: 'deployment.apps/pay-api rolled back\n(purana template wapas — par galti ConfigMap mein hai, Deployment mein nahi. Haal wahi rahega.)' },
        { re: /^kubectl delete (?:pods?|po)[ /](pay-api-\S+)\b.*$/,
          out: (s, m) => { const c = s.cluster, name = String((m && m[1]) || ''), p = pays(c).find(x => x.name === name); if (!p) return `Error from server (NotFound): pods "${name}" not found`;
            c.pods.splice(c.pods.indexOf(p), 1); const np = newPod(c); np.st = 'Starting'; c.pods.push(np); settle(c, np); return `pod "${name}" deleted\n(ReplicaSet ne naya pod banaya: ${np.name})`; } },
        { re: /^kubectl (?:patch|edit|set)\b.*\b(?:hpa|horizontalpodautoscalers?|cm|configmaps?)\b.*$/, err: true, out: '(simulator) raat ko bhi git wali file se karo: vi pay-api-config.yaml / vi pay-api-hpa.yaml → Save → kubectl apply -f <file>. Seedha cluster badla toh kal ka deploy wapas tod dega.' },
      ],
      files: {
        'runbook.md': { desc: 'on-call runbook (padhne ke liye)', content: RUNBOOK, apply: () => ({ err: 'error: error parsing runbook.md: yeh runbook hai, manifest nahi — cat runbook.md' }) },
        'pay-api-config.yaml': {
          editable: true, desc: 'pay-api ka ConfigMap (git)', content: CM_FILE,
          apply: (s, text, docs) => {
            const c = s.cluster, d = (docs || [])[0] || {};
            if (d.kind !== 'ConfigMap' || (d.metadata || {}).name !== 'pay-api-config') return { err: '(simulator ne roka) is file mein ConfigMap pay-api-config hi rahe.' };
            const data = d.data || {};
            const bad = Object.keys(data).find(k => typeof data[k] !== 'string');
            if (bad) return { err: `Error from server (BadRequest): error when patching "pay-api-config.yaml": ConfigMap in version "v1" cannot be handled as a ConfigMap: json: cannot unmarshal ${typeof data[bad] === 'number' ? 'number' : typeof data[bad] === 'boolean' ? 'bool' : 'object'} into Go struct field ConfigMap.data of type string\n(ConfigMap ki har value string — "${data[bad]}" quotes mein)` };
            if (data.LEDGER_URL !== c.cm.LEDGER_URL) return { err: '(simulator ne roka) LEDGER_URL mat chhuo — pay-api ledger tak nahi pahunchegi.' };
            if (JSON.stringify(data) === JSON.stringify(c.cm)) return 'configmap/pay-api-config unchanged';
            c.cm = Object.assign({}, data);
            const running = pays(c).filter(p => p.st === 'Running').length;
            return 'configmap/pay-api-config configured' + (running ? `\n(Dhyan do: ${running} pods abhi chal rahe hain — env sirf container START par padha jaata hai. Unhe naya value restart ke baad milega.)` : '');
          },
        },
        'pay-api-hpa.yaml': {
          editable: true, desc: 'pay-api ka HPA (git)', content: HPA_FILE,
          apply: (s, text, docs) => {
            const c = s.cluster, d = (docs || [])[0] || {}, sp = d.spec || {};
            if (d.kind !== 'HorizontalPodAutoscaler' || (d.metadata || {}).name !== 'pay-api') return { err: '(simulator ne roka) is file mein HPA pay-api hi rahe.' };
            const uk = Object.keys(sp).find(k => !['scaleTargetRef', 'minReplicas', 'maxReplicas', 'metrics', 'behavior'].includes(k));
            if (uk) return { err: `Error from server (BadRequest): error when patching "pay-api-hpa.yaml": HorizontalPodAutoscaler in version "v2" cannot be handled as a HorizontalPodAutoscaler: strict decoding error: unknown field "spec.${uk}"` };
            for (const k of ['minReplicas', 'maxReplicas']) if (typeof sp[k] !== 'number') return { err: `Error from server (BadRequest): error when patching "pay-api-hpa.yaml": HorizontalPodAutoscaler in version "v2" cannot be handled as a HorizontalPodAutoscaler: json: cannot unmarshal ${typeof sp[k] === 'string' ? 'string' : 'object'} into Go struct field HorizontalPodAutoscalerSpec.spec.${k} of type int32` };
            if (sp.maxReplicas < sp.minReplicas) return { err: `The HorizontalPodAutoscaler "pay-api" is invalid: spec.maxReplicas: Invalid value: ${sp.maxReplicas}: must be greater than or equal to \`minReplicas\`` };
            if (sp.minReplicas < 1) return { err: `The HorizontalPodAutoscaler "pay-api" is invalid: spec.minReplicas: Invalid value: ${sp.minReplicas}: must be greater than or equal to 1` };
            const tgt = (((((sp.metrics || [])[0] || {}).resource || {}).target || {}).averageUtilization);
            if (tgt !== 60) return { err: '(simulator ne roka) target 60% rehne do — target badhane se pods "kam busy" dikhte hain par asli load wahi rehta hai. maxReplicas badlo.' };
            if (sp.maxReplicas > 20) return { err: '(simulator) 20 se zyada mat do — cluster mein itni jagah nahi, aur ledger ke connections bhi seemit hain.' };
            if (sp.minReplicas === c.hpa.min && sp.maxReplicas === c.hpa.max) return 'horizontalpodautoscaler.autoscaling/pay-api unchanged';
            c.hpa = { min: sp.minReplicas, max: sp.maxReplicas, target: tgt };
            return 'horizontalpodautoscaler.autoscaling/pay-api configured';
          },
        },
      },
      successText: `<b>Raat ki kahani (root cause chain):</b> shaam ka ConfigMap badlaav (<code>"3s"</code>) → pay-api CrashLoop (1) → theek hote hi sale ka ruka hua traffic aaya → HPA max 4 par atka (2) →
        max badhaya toh cluster mein CPU nahi tha, batch job <code>reports-backfill</code> ne gher rakha tha (3) → 8 pods × pool 50 = 400 connections, ledger ki chhat 300 (4).<br>
        <b>Seekh:</b> ek fix agla bottleneck dikhata hai — har fix ke baad <b>pakka karo</b> aur <b>agla kadam socho</b>. Capacity ka hisaab poori chain ka hota hai: pods × pool ≤ DB connections; HPA max ≤ cluster CPU.<br>
        <b>Postmortem action items:</b> ConfigMap ki values CI mein validate karo · sale se pehle HPA max + nodes load test se tay karo · batch jobs ko kam PriorityClass do · pool size = (max_connections − reserved) ÷ HPA max.`,
      hints: INC[0].hints,
      solution: [
        'kubectl get pods', `kubectl logs ${p1}`, { edit: 'pay-api-config.yaml', change: [['UPI_TIMEOUT_MS: "3s"', 'UPI_TIMEOUT_MS: "3000"']] }, 'kubectl apply -f pay-api-config.yaml', 'kubectl get pods',
        'kubectl get hpa', 'kubectl describe hpa pay-api', { edit: 'pay-api-hpa.yaml', change: [['maxReplicas: 4', 'maxReplicas: 10']] }, 'kubectl apply -f pay-api-hpa.yaml', 'kubectl get hpa',
        'kubectl get pods', `kubectl describe pod ${pend}`, 'kubectl top pods', 'kubectl scale deployment reports-backfill --replicas=0', 'kubectl get pods',
        `kubectl logs ${p1}`, PSQL, { edit: 'pay-api-config.yaml', change: [['DB_POOL_SIZE: "50"', 'DB_POOL_SIZE: "30"']] }, 'kubectl apply -f pay-api-config.yaml', 'kubectl rollout restart deployment/pay-api', PSQL,
      ],
    };
  }
  KG.oncall.add({ id: 'sale', start: 22 * 60, INC, reconcile, views: refreshViews, build });
  KG.oncall.INC = INC;   // purana naam (sale shift ke alerts)
})();

/* =====================================================================
   📟 stage renderer — pager panel + terminal + aakhir mein report card
   ===================================================================== */
(function () {
  const el = KG.el;
  KG.renderers.oncall = function renderOncall(stage, arena, onDone) {
    const S = KG.oncall.get(stage.shift), INC = S.INC;
    const pager = el('div', 'oc-pager');
    const sub = el('div', 'oc-term');
    const after = el('div', 'lab-after');
    let last = null, finished = false;
    function paint(c) {
      last = c;
      const k = c.inc, cur = c.incs[k];
      pager.innerHTML = `<div class="oc-top"><span class="oc-clock">🕙 ${KG.oncall.hhmm(c)}</span><span>Alert ${Math.min(k + 1, INC.length)} / ${INC.length}</span>${c.risky ? `<span class="oc-risky">⚠️ roke gaye: ${c.risky}</span>` : ''}</div>` +
        (c.over ? '<div class="oc-alert ok">🌅 <b>Saare alerts shaant.</b> Shift handover.</div>'
          : `<div class="oc-alert ${INC[k].sev.includes('SEV1') ? 'sev1' : 'sev2'}">📟 <b>[FIRING] ${INC[k].sev} ${INC[k].id}</b> — ${INC[k].text}
            <div class="oc-steps"><span class="${cur.fixedAt ? 'ok' : ''}">${cur.fixedAt ? '✅' : '⬜'} theek karo</span><span class="${cur.verified ? 'ok' : ''}">${cur.verified ? '✅' : '⬜'} pakka karo — ${INC[k].verifyText}</span></div></div>`) +
        `<div class="oc-done">${c.incs.map((x, i) => x.resolved ? `<span>✅ ${INC[i].id} · ${x.resolved - x.fired} min</span>` : '').join('')}</div>`;
    }
    const m = KG.oncall.mission(paint, S.id);
    paint(m.cluster);
    arena.append(pager, sub, after);
    function finish() {
      if (finished || !last) return;
      finished = true;
      const c = last;
      const rows = c.incs.map((x, i) => {
        const hints = x.hints || 0;
        return `<tr><td>${INC[i].sev.split(' ')[0]} ${INC[i].id.replace(/([a-z])([A-Z])/g, '$1<wbr>$2')}</td><td>${KG.oncall.hhmm({ clock: x.fired, start: S.start })}</td><td><b>${x.resolved - x.fired} min</b></td><td>${hints ? '💡 ' + hints : '—'}</td><td>${x.verified ? '✅' : '—'}</td></tr>`;
      }).join('');
      const totalHints = c.incs.reduce((a, x) => a + (x.hints || 0), 0);
      const grade = totalHints <= 1 && c.risky === 0 ? 'A' : totalHints <= 4 && c.risky <= 1 ? 'B' : 'C';
      const clean = c.incs.filter(x => !(x.hints)).length;
      const card = el('div', 'oc-card pop', `<div class="oc-head"><div class="oc-grade g${grade}">${grade}</div>
        <div><b>📋 Shift report card</b><br>${KG.oncall.hhmm({ clock: 0, start: S.start })} – ${KG.oncall.hhmm(c)} · ${c.clock} min</div></div>
        <div class="oc-tblwrap"><table class="oc-tbl"><tr><th>Alert</th><th>Aaya</th><th>MTTR</th><th>Hints</th><th title="pakka kiya">✔</th></tr>${rows}</table></div>
        <div>⚠️ Roke gaye khatarnaak commands: <b>${c.risky}</b>${c.risky ? ' — ' + c.riskyList.join(' · ') : ' — 👏 koi nahi'}</div>
        <div class="drill-rules">Grade: A = ≤1 hint + 0 khatarnaak · B = ≤4 hints + ≤1 khatarnaak · C = baaki. Dobara khelo toh ghadi aur ginti naye sire se.</div>`);
      const again = el('button', 'btn ghost oc-again', '🔁 Shift dobara (behtar grade ke liye)');
      again.onclick = () => { arena.innerHTML = ''; renderOncall(stage, arena, onDone); };
      const next = el('button', 'btn big', 'Aage badho →');
      next.onclick = () => { next.disabled = true; again.disabled = true; onDone({ firstTry: clean, total: INC.length }); };
      KG.state.oncallBest = KG.state.oncallBest || {};
      const prev = KG.state.oncallBest[stage.id];
      if (!prev || 'ABC'.indexOf(grade) < 'ABC'.indexOf(prev.grade) || (grade === prev.grade && c.clock < prev.mins)) { KG.state.oncallBest[stage.id] = { grade, mins: c.clock }; if (KG.saveState) KG.saveState(); }
      after.append(card, again, next);
      if (after.scrollIntoView) after.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    arena._oncall = { mission: m, sub, finish, INC };
    KG.renderers.terminal(m, sub, () => finish());
  };
})();
