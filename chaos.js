/* =====================================================================
   KubeGurukul — 🎲 Chaos mode  (stage type: 'chaos')
   "Chaos monkey" pay-api ki git file (pay-api.yaml = ConfigMap + Deployment
   + Service) mein ek (ya do) random galti daalta hai. Learner kubectl se
   wajah dhoondhta hai, vi se file theek karta hai, apply karta hai.

   Cluster ki POORI haalat file se nikalti hai — kubelet ke kram mein:
   scheduling → image pull → config (ConfigMap / securityContext) → process
   start → app config → memory → liveness → readiness → Service endpoints.
   Isliye koi bhi sahi fix chalta hai (pehle se tay "jawab" nahi).

   stage: { type: 'chaos', id: 'chaos-beginner', title, level: 1|2|3, intro?: 'HTML' }
     level 1 = beginner breakages, 2 = + intermediate, 3 = sab (+ kabhi do ek saath)
   KG.chaos.mission(['image-tag']) → poora terminal mission (validator / replay isi se)
   ===================================================================== */
KG.chaos = (function () {
  const REPO = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api';
  const TAGS = ['1.7.2', '1.8.0', '1.9.0'];
  const NODES = [
    { name: 'node-1', ip: '10.0.12.5', net: '10.0.12', zone: 'ap-south-1a' },
    { name: 'node-2', ip: '10.0.13.5', net: '10.0.13', zone: 'ap-south-1a' },
    { name: 'node-3', ip: '10.0.14.5', net: '10.0.14', zone: 'ap-south-1b' },
  ];
  const nodeLabels = n => ({ 'kubernetes.io/arch': 'amd64', 'kubernetes.io/hostname': n.name, 'kubernetes.io/os': 'linux',
    'node.kubernetes.io/instance-type': 'm6i.xlarge', 'topology.kubernetes.io/zone': n.zone });
  const HASH = ['6b8d7c', '7f9c4d', '5d2b8e', '8a3f1c', '9c6e2a', '4b7d9f', '3e8a5c', '2c9e7b'];
  const SUF = ['x2k9p', 'm4t7q', 'r8w3z', 'c5n1v', 'h6j2b', 'q9d4s', 't3f8g', 'w7y5k', 'b1z6n', 'p5r2c'];
  const BASE = `apiVersion: v1
kind: ConfigMap
metadata:
  name: pay-api-config
  namespace: payments
data:
  LEDGER_URL: http://ledger:8080
  UPI_TIMEOUT_MS: "3000"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pay-api
  namespace: payments
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pay-api
  template:
    metadata:
      labels:
        app: pay-api
    spec:
      containers:
      - name: pay-api
        image: ${REPO}:1.8.0
        command: ["/app/pay-api"]
        ports:
        - name: http
          containerPort: 8080
        env:
        - name: LEDGER_URL
          valueFrom:
            configMapKeyRef:
              name: pay-api-config
              key: LEDGER_URL
        - name: UPI_TIMEOUT_MS
          valueFrom:
            configMapKeyRef:
              name: pay-api-config
              key: UPI_TIMEOUT_MS
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
          limits:
            memory: 512Mi
        readinessProbe:
          httpGet:
            path: /readyz
            port: http
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /healthz
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
        securityContext:
          runAsNonRoot: true
          allowPrivilegeEscalation: false
---
apiVersion: v1
kind: Service
metadata:
  name: pay-api
  namespace: payments
spec:
  selector:
    app: pay-api
  ports:
  - port: 80
    targetPort: http
`;
  /* ---------- breakages: BASE mein ek jagah badlaav (from → to) ---------- */
  const BREAKS = [
    { id: 'image-tag', fix: 'image ka tag 1.8.O ko 1.8.0 karo (zero)', level: 1, title: 'Image tag mein typo', from: `${REPO}:1.8.0`, to: `${REPO}:1.8.O`, diag: 'describe',
      clue: 'STATUS ImagePullBackOff hai. kubectl describe pod ke Events mein "Failed to pull image" — tag dhyan se padho (0 ya O?).',
      reveal: 'Image tag <code>1.8.O</code> — angrezi ka <b>O</b>, zero nahi. Registry mein woh tag hai hi nahi → <code>ImagePullBackOff</code>.' },
    { id: 'svc-selector', fix: 'Service ke selector mein app: payapi ko app: pay-api karo', level: 1, title: 'Service selector ka typo', from: '  selector:\n    app: pay-api\n  ports:', to: '  selector:\n    app: payapi\n  ports:', diag: 'endpoints',
      clue: 'Pods Running 1/1 hain, phir bhi curl fail. kubectl get endpoints pay-api — khaali? Service ka selector pods ke label se milao (kubectl get pods --show-labels).',
      reveal: 'Service ka selector <code>app: payapi</code> tha, pods par <code>app=pay-api</code>. Selector kisi pod se nahi mila → <b>endpoints khaali</b> → connection refused. Pods bilkul theek the.' },
    { id: 'replicas-zero', fix: 'replicas: 0 ko replicas: 2 karo', level: 1, title: 'replicas: 0', from: '  replicas: 2\n', to: '  replicas: 0\n', diag: 'deploy',
      clue: 'kubectl get pods mein pay-api hai hi nahi? kubectl get deploy pay-api — READY 0/0. File mein replicas dekho.',
      reveal: '<code>replicas: 0</code> — Deployment ne ek bhi pod nahi banaya. Koi error nahi, bas khaali. "Pods kahan gaye?" ka pehla jawab: <code>kubectl get deploy</code>.' },
    { id: 'oom', fix: 'memory requests 64Mi → 256Mi aur limits 96Mi → 512Mi karo', level: 1, title: 'Memory limit bahut kam', from: '            memory: 256Mi\n          limits:\n            memory: 512Mi', to: '            memory: 64Mi\n          limits:\n            memory: 96Mi', diag: 'describe',
      clue: 'CrashLoopBackOff. kubectl describe pod — Last State ka Reason? Exit Code 137 = bahar se maara gaya. Limits mein memory kitni hai?',
      reveal: 'Kisi ne "kharcha bachane" ke liye memory <b>96Mi</b> kar di. pay-api ko ~180Mi chahiye → kernel ne maara → <code>OOMKilled</code> (exit 137) → CrashLoopBackOff.' },
    { id: 'cm-key', fix: 'configMapKeyRef ki key: LEDGER_URI ko LEDGER_URL karo', level: 1, title: 'ConfigMap key ka typo', from: '              key: LEDGER_URL', to: '              key: LEDGER_URI', diag: 'describe',
      clue: 'STATUS CreateContainerConfigError — container bana hi nahi. kubectl describe pod ke Events: kaunsi key nahi mili?',
      reveal: '<code>configMapKeyRef.key: LEDGER_URI</code> — ConfigMap mein key <code>LEDGER_URL</code> hai (L se). Key na mile toh container <b>banta hi nahi</b>: <code>CreateContainerConfigError</code>.' },
    { id: 'cpu-request', fix: 'requests ki cpu: 25 ko cpu: 250m karo', level: 2, title: 'CPU request mein "m" gayab', from: '            cpu: 250m', to: '            cpu: 25', diag: 'describe',
      clue: 'Pods Pending. kubectl describe pod — FailedScheduling kya kehta hai? Requests mein cpu dekho: 25 matlab 25 poore CPU.',
      reveal: '<code>cpu: 25</code> — "m" chhoot gaya. 250m (chauthai CPU) ki jagah <b>25 poore CPU</b> maange; kisi node mein itne nahi → <code>Insufficient cpu</code>, Pending.' },
    { id: 'readiness-path', fix: 'readinessProbe ka path: /ready ko /readyz karo', level: 2, title: 'Readiness probe ka path galat', from: '            path: /readyz', to: '            path: /ready', diag: 'describe',
      clue: 'Pods Running par READY 0/1. kubectl describe pod — "Readiness probe failed" kis status code ke saath? App kaunsa path deti hai?',
      reveal: 'Readiness probe <code>/ready</code> maang raha tha; app <code>/readyz</code> deti hai → 404 → pod kabhi Ready nahi → Service ke endpoints khaali. Container chal raha tha, par traffic nahi milta.' },
    { id: 'liveness-port', fix: 'livenessProbe ka port: 8081 ko port: http karo', level: 2, title: 'Liveness probe ka port galat', from: '            path: /healthz\n            port: http', to: '            path: /healthz\n            port: 8081', diag: 'describe',
      clue: 'Restarts badhte ja rahe hain. kubectl describe pod ke Events: "Liveness probe failed … connection refused" — kis port par? App kis port par sunti hai?',
      reveal: 'Liveness probe port <code>8081</code> par dastak deta tha; app <code>8080</code> par hai → "connection refused" → kubelet har baar container <b>maar kar dobara</b> chalata → restarts badhte gaye.' },
    { id: 'svc-targetport', fix: 'Service ka targetPort: 80 ko targetPort: http karo', level: 2, title: 'Service targetPort galat', from: '    targetPort: http', to: '    targetPort: 80', diag: 'endpoints',
      clue: 'Pods 1/1, endpoints bhi hain — phir bhi curl fail. kubectl get endpoints pay-api — endpoint kis PORT par hai? App kis port par sunti hai?',
      reveal: '<code>targetPort: 80</code> — Service traffic pod ke port 80 par bhej rahi thi, app 8080 par sunti hai → connection refused. Endpoints dikhte the, isliye galti chhupi rahi.' },
    { id: 'cm-value', fix: 'ConfigMap mein UPI_TIMEOUT_MS: "3s" ko "3000" karo', level: 2, title: 'ConfigMap value galat format', from: '  UPI_TIMEOUT_MS: "3000"', to: '  UPI_TIMEOUT_MS: "3s"', diag: 'logs',
      clue: 'CrashLoopBackOff. kubectl logs <pod> — app marne se pehle kya chilla rahi hai? ConfigMap ki value dekho.',
      reveal: 'ConfigMap mein <code>UPI_TIMEOUT_MS: "3s"</code> — app milliseconds ka <b>number</b> maangti hai ("3000"). Config parse fail → exit 1 → CrashLoopBackOff. Ilaaj ConfigMap mein; agli restart par pod khud theek.' },
    { id: 'node-selector', fix: 'nodeSelector aur disktype: ssd wali do lines hatao', level: 2, title: 'nodeSelector jo kisi node par nahi', from: '    spec:\n      containers:', to: '    spec:\n      nodeSelector:\n        disktype: ssd\n      containers:', diag: 'describe',
      clue: 'Pods Pending. FailedScheduling: "didn\'t match Pod\'s node affinity/selector". kubectl get nodes --show-labels — disktype label kisi node par hai?',
      reveal: '<code>nodeSelector: disktype: ssd</code> — kisi node par yeh label nahi → scheduler ko koi node nahi mila → Pending.' },
    { id: 'command-typo', fix: 'command: ["/app/payapi"] ko ["/app/pay-api"] karo', level: 3, title: 'command mein binary ka naam galat', from: 'command: ["/app/pay-api"]', to: 'command: ["/app/payapi"]', diag: 'describe',
      clue: 'CrashLoopBackOff, aur logs khaali. kubectl describe pod — Last State ka Reason StartError, message mein "exec … no such file". command dekho.',
      reveal: '<code>command: ["/app/payapi"]</code> — image mein binary <code>/app/pay-api</code> hai. Process shuru hi nahi hua (<code>StartError</code>, exit 128), isliye logs bhi khaali the.' },
    { id: 'run-as-root', fix: 'securityContext se runAsUser: 0 wali line hatao', level: 3, title: 'runAsUser: 0 + runAsNonRoot', from: '          runAsNonRoot: true\n', to: '          runAsNonRoot: true\n          runAsUser: 0\n', diag: 'describe',
      clue: 'CreateContainerConfigError. Events: "runAsUser breaks non-root policy". securityContext dekho — do niyam aapas mein lad rahe hain.',
      reveal: '<code>runAsNonRoot: true</code> ke saath <code>runAsUser: 0</code> (root) — kubelet ne container banane se mana kar diya. runAsUser hatao (image khud non-root user 10001 hai).' },
    { id: 'cm-name', fix: 'configMapKeyRef ka name: pay-api-cfg ko pay-api-config karo', level: 3, title: 'ConfigMap ka naam galat', from: '              name: pay-api-config\n              key: LEDGER_URL', to: '              name: pay-api-cfg\n              key: LEDGER_URL', diag: 'describe',
      clue: 'CreateContainerConfigError. Events: kaunsa configmap "not found"? kubectl get cm — asli naam kya hai?',
      reveal: '<code>configMapKeyRef.name: pay-api-cfg</code> — aisa ConfigMap hai hi nahi (asli: <code>pay-api-config</code>) → container nahi bana.' },
    { id: 'port-env', fix: 'env se PORT aur value: "9090" wali do lines hatao', level: 3, title: 'PORT env se app doosre port par', from: '        env:\n        - name: LEDGER_URL', to: '        env:\n        - name: PORT\n          value: "9090"\n        - name: LEDGER_URL', diag: 'logs',
      clue: 'Restarts badh rahe hain, probes "connection refused". kubectl logs <pod> — app kis port par sun rahi hai? Container port aur probes 8080 maangte hain.',
      reveal: 'Kisi ne env <code>PORT=9090</code> jod diya → app <b>9090</b> par sunne lagi, par containerPort / probes / Service sab 8080 (<code>http</code>) maangte the → liveness fail → restarts. PORT hatao.' },
  ];
  const byId = id => BREAKS.find(b => b.id === id);
  const apply = ids => ids.reduce((t, id) => t.replace(byId(id).from, byId(id).to), BASE);

  /* ---------- chhote helpers ---------- */
  const QTY = /^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$/;
  const cpuOf = q => { if (q == null) return 0; if (typeof q === 'number') return q; const m = String(q).match(/^([0-9.]+)(m)?$/); return m ? Number(m[1]) / (m[2] ? 1000 : 1) : NaN; };
  const memOf = q => {
    if (q == null) return null;
    if (typeof q === 'number') return q / 1048576;
    const m = String(q).match(/^([0-9.]+)(Ki|Mi|Gi|Ti|k|M|G|T)?$/);
    if (!m) return null;
    return Number(m[1]) * ({ Ki: 1 / 1024, Mi: 1, Gi: 1024, Ti: 1048576, k: 1000 / 1048576, M: 1e6 / 1048576, G: 1e9 / 1048576, T: 1e12 / 1048576 }[m[2] || ''] || 1 / 1048576);
  };
  function tbl(rows) {
    const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i] == null ? '' : r[i]).length)));
    return rows.map(r => r.map((x, i) => i === r.length - 1 ? String(x) : String(x).padEnd(w[i] + 3)).join('')).join('\n');
  }
  const typ = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'bool' : typeof v === 'object' ? 'object' : 'string');
  const badReq = (kind, msg) => `Error from server (BadRequest): error when patching "pay-api.yaml": ${kind} in version "v1" cannot be handled as a ${kind}: ${msg}`;

  /* ---------- API server ki jaanch (har doc alag — asli kubectl bhi doc-dar-doc lagata hai) ---------- */
  const CTR_KEYS = ['name', 'image', 'command', 'args', 'ports', 'env', 'envFrom', 'resources', 'livenessProbe', 'readinessProbe', 'startupProbe', 'securityContext', 'volumeMounts', 'imagePullPolicy', 'workingDir'];
  const PROBE_KEYS = ['httpGet', 'tcpSocket', 'exec', 'grpc', 'initialDelaySeconds', 'periodSeconds', 'timeoutSeconds', 'failureThreshold', 'successThreshold', 'terminationGracePeriodSeconds'];
  function checkCm(d) {
    const data = d.data || {};
    const bad = Object.keys(data).find(k => typeof data[k] !== 'string');
    if (bad) return badReq('ConfigMap', `json: cannot unmarshal ${typ(data[bad])} into Go struct field ConfigMap.data of type string\n(ConfigMap ki har value string hai — "${data[bad]}" quotes mein likho)`);
    return null;
  }
  function checkDep(d) {
    const sp = d.spec || {}, C = 'spec.template.spec.containers[0]';
    const sel = (sp.selector || {}).matchLabels || {};
    if (sel.app !== 'pay-api' || Object.keys(sel).length !== 1) return `The Deployment "pay-api" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{${Object.keys(sel).map(k => `"${k}":"${sel[k]}"`).join(', ')}}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable`;
    const tl = ((sp.template || {}).metadata || {}).labels || {};
    if (tl.app !== 'pay-api') return `The Deployment "pay-api" is invalid: spec.template.metadata.labels: Invalid value: map[string]string{${Object.keys(tl).map(k => `"${k}":"${tl[k]}"`).join(', ')}}: \`selector\` does not match template \`labels\``;
    if (sp.replicas != null && typeof sp.replicas !== 'number') return badReq('Deployment', `json: cannot unmarshal ${typ(sp.replicas)} into Go struct field DeploymentSpec.spec.replicas of type int32`);
    if (sp.replicas < 0) return `The Deployment "pay-api" is invalid: spec.replicas: Invalid value: ${sp.replicas}: must be greater than or equal to 0`;
    const ctrs = ((sp.template || {}).spec || {}).containers;
    if (!Array.isArray(ctrs) || !ctrs.length) return 'The Deployment "pay-api" is invalid: spec.template.spec.containers: Required value';
    const c = ctrs[0];
    const uk = Object.keys(c).find(k => !CTR_KEYS.includes(k));
    if (uk) return badReq('Deployment', `strict decoding error: unknown field "${C}.${uk}"`);
    if (!c.image) return `The Deployment "pay-api" is invalid: ${C}.image: Required value`;
    if (c.command != null && !Array.isArray(c.command)) return badReq('Deployment', `json: cannot unmarshal ${typ(c.command)} into Go struct field Container.${C.replace('[0]', '')}.command of type []string`);
    for (const e of c.env || []) {
      if (e.value != null && typeof e.value !== 'string') return badReq('Deployment', `json: cannot unmarshal ${typ(e.value)} into Go struct field EnvVar.spec.template.spec.containers.env.value of type string\n(env value string hoti hai — "${e.value}" quotes mein)`);
    }
    for (const pn of ['livenessProbe', 'readinessProbe', 'startupProbe']) {
      const p = c[pn]; if (!p) continue;
      const pk = Object.keys(p).find(k => !PROBE_KEYS.includes(k));
      if (pk) return badReq('Deployment', `strict decoding error: unknown field "${C}.${pn}.${pk}"`);
      const hk = p.httpGet && Object.keys(p.httpGet).find(k => !['path', 'port', 'host', 'scheme', 'httpHeaders'].includes(k));
      if (hk) return badReq('Deployment', `strict decoding error: unknown field "${C}.${pn}.httpGet.${hk}"`);
      if (!p.httpGet && !p.tcpSocket && !p.exec && !p.grpc) return `The Deployment "pay-api" is invalid: ${C}.${pn}: Required value: must specify a handler type`;
    }
    const r = c.resources || {};
    for (const part of ['requests', 'limits']) for (const [k, v] of Object.entries(r[part] || {})) {
      if (typeof v === 'string' && !QTY.test(v)) return badReq('Deployment', `quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$'`);
      if (!['cpu', 'memory', 'ephemeral-storage'].includes(k)) return `The Deployment "pay-api" is invalid: ${C}.resources.${part}[${k}]: Invalid value: "${k}": must be a standard resource type or fully qualified`;
    }
    const rq = memOf((r.requests || {}).memory), lm = memOf((r.limits || {}).memory);
    if (rq != null && lm != null && rq > lm) return `The Deployment "pay-api" is invalid: ${C}.resources.requests: Invalid value: "${r.requests.memory}": must be less than or equal to memory limit of ${r.limits.memory}`;
    return null;
  }
  function checkSvc(d) {
    const sp = d.spec || {};
    if (!Array.isArray(sp.ports) || !sp.ports.length) return 'The Service "pay-api" is invalid: spec.ports: Required value';
    const p = sp.ports[0];
    if (typeof p.port !== 'number') return badReq('Service', `json: cannot unmarshal ${typ(p.port)} into Go struct field ServicePort.spec.ports.port of type int32`);
    if (sp.selector != null && typeof sp.selector !== 'object') return badReq('Service', 'json: cannot unmarshal string into Go struct field ServiceSpec.spec.selector of type map[string]string');
    return null;
  }

  /* ---------- kubelet ke kram mein: is template ka pod kis haal mein hoga ---------- */
  function outcome(dep, cm) {
    const spec = dep.spec.template.spec || {}, ctr = spec.containers[0], res = ctr.resources || {}, data = (cm && cm.data) || {};
    const ns = spec.nodeSelector || {};
    if (Object.keys(ns).length && !NODES.some(n => Object.keys(ns).every(k => nodeLabels(n)[k] === String(ns[k]))))
      return { phase: 'Pending', why: "0/3 nodes are available: 3 node(s) didn't match Pod's node affinity/selector. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling." };
    if (cpuOf((res.requests || {}).cpu) > 2.4) return { phase: 'Pending', why: '0/3 nodes are available: 3 Insufficient cpu. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.' };
    if ((memOf((res.requests || {}).memory) || 0) > 12 * 1024) return { phase: 'Pending', why: '0/3 nodes are available: 3 Insufficient memory. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.' };
    const img = String(ctr.image), repo = img.replace(/:[^:/]*$/, ''), tag = (img.match(/:([^:/]+)$/) || [])[1] || 'latest';
    if (repo !== REPO || !TAGS.includes(tag)) return { phase: 'ImagePullBackOff', img };
    for (const e of ctr.env || []) {
      const r = e.valueFrom && e.valueFrom.configMapKeyRef;
      if (!r) continue;
      if (r.name !== 'pay-api-config' || !cm) return { phase: 'CreateContainerConfigError', msg: `configmap "${r.name}" not found` };
      if (!(r.key in data) && !r.optional) return { phase: 'CreateContainerConfigError', msg: `couldn't find key ${r.key} in ConfigMap payments/pay-api-config` };
    }
    for (const e of ctr.envFrom || []) { const r = e.configMapRef; if (r && r.name !== 'pay-api-config' && !r.optional) return { phase: 'CreateContainerConfigError', msg: `configmap "${r.name}" not found` }; }
    const sc = ctr.securityContext || {}, psc = spec.securityContext || {};
    const nonRoot = sc.runAsNonRoot != null ? sc.runAsNonRoot : psc.runAsNonRoot, uid = sc.runAsUser != null ? sc.runAsUser : psc.runAsUser;
    if (nonRoot === true && uid === 0) return { phase: 'CreateContainerConfigError', msg: 'container\'s runAsUser breaks non-root policy (pod: "POD_payments(UID)", container: pay-api)' };
    if (ctr.command && String(ctr.command[0]) !== '/app/pay-api') return { phase: 'StartError', bin: String(ctr.command[0]) };
    const env = {};
    (ctr.envFrom || []).forEach(e => { if (e.configMapRef) Object.assign(env, data); });
    (ctr.env || []).forEach(e => { env[e.name] = e.value != null ? String(e.value) : e.valueFrom && e.valueFrom.configMapKeyRef ? data[e.valueFrom.configMapKeyRef.key] : undefined; });
    if (!env.LEDGER_URL) return { phase: 'Crash', log: '{"level":"fatal","msg":"config: LEDGER_URL is required"}' };
    if (env.UPI_TIMEOUT_MS == null) return { phase: 'Crash', log: '{"level":"fatal","msg":"config: UPI_TIMEOUT_MS is required"}' };
    if (!/^\d+$/.test(env.UPI_TIMEOUT_MS)) return { phase: 'Crash', log: `{"level":"fatal","msg":"config: UPI_TIMEOUT_MS=\\"${env.UPI_TIMEOUT_MS}\\": strconv.Atoi: parsing \\"${env.UPI_TIMEOUT_MS}\\": invalid syntax"}` };
    const appPort = env.PORT ? Number(env.PORT) : 8080;
    const lim = memOf((res.limits || {}).memory);
    if (lim != null && lim < 200) return { phase: 'OOM', appPort };
    const ports = ctr.ports || [];
    const probe = pr => {
      if (!pr || !pr.httpGet) return null;
      const h = pr.httpGet, port = typeof h.port === 'number' ? h.port : (ports.find(x => x.name === h.port) || {}).containerPort;
      if (port == null) return { err: `couldn't find port: ${h.port} in container` };
      if (port !== appPort) return { refused: port, path: h.path || '/' };
      if (!['/healthz', '/readyz'].includes(h.path)) return { code: 404, path: h.path || '/', port };
      return null;
    };
    const lv = probe(ctr.livenessProbe);
    if (lv) return { phase: 'Liveness', probe: lv, appPort };
    const rd = probe(ctr.readinessProbe);
    if (rd) return { phase: 'NotReady', probe: rd, appPort };
    return { phase: 'Ready', appPort };
  }

  /* ---------- outcome → pods / describe / logs / events / endpoints ---------- */
  const probeMsg = (kind, pr, ip) => pr.err ? `${kind} probe errored: ${pr.err}`
    : pr.refused ? `${kind} probe failed: Get "http://${ip}:${pr.refused}${pr.path}": dial tcp ${ip}:${pr.refused}: connect: connection refused`
      : `${kind} probe failed: HTTP probe failed with statuscode: ${pr.code}`;
  function podRow(c, p) {
    const o = c.out;
    const crash = ['StartError', 'Crash', 'OOM', 'Liveness'].includes(o.phase);
    p.status = o.phase === 'Pending' ? 'Pending' : o.phase === 'ImagePullBackOff' ? 'ImagePullBackOff' : o.phase === 'CreateContainerConfigError' ? 'CreateContainerConfigError'
      : crash ? 'CrashLoopBackOff' : 'Running';
    p.ready = o.phase === 'Ready' ? '1/1' : '0/1';
    if (crash) p.rc = p.rc || (p.fresh ? 2 : 97);
    p.restarts = p.rc ? `${p.rc} (${p.fresh ? '4s' : '3m12s'} ago)` : 0;
    p.node = o.phase === 'Pending' ? '<none>' : p.nodeName;
    p.ip = o.phase === 'Pending' ? '<none>' : p.podIp;
  }
  function evs(c, p) {
    const o = c.out, img = c.cur.dep.spec.template.spec.containers[0].image, age = p.fresh ? '6s' : '8h';
    const E = [];
    if (o.phase === 'Pending') return [['Warning', 'FailedScheduling', p.fresh ? '6s' : '2m (x97 over 8h)', 'default-scheduler', o.why]];
    E.push(['Normal', 'Scheduled', age, 'default-scheduler', `Successfully assigned payments/${p.name} to ${p.nodeName}`]);
    if (o.phase === 'ImagePullBackOff') return E.concat([
      ['Normal', 'Pulling', p.fresh ? '5s' : '3m (x98 over 8h)', 'kubelet', `Pulling image "${img}"`],
      ['Warning', 'Failed', p.fresh ? '4s' : '3m (x98 over 8h)', 'kubelet', `Failed to pull image "${img}": rpc error: code = NotFound desc = failed to pull and unpack image "${img}": failed to resolve reference "${img}": ${img}: not found`],
      ['Warning', 'Failed', p.fresh ? '4s' : '3m (x98 over 8h)', 'kubelet', 'Error: ErrImagePull'],
      ['Normal', 'BackOff', p.fresh ? '2s' : '9s (x2104 over 8h)', 'kubelet', `Back-off pulling image "${img}"`],
      ['Warning', 'Failed', p.fresh ? '2s' : '9s (x2104 over 8h)', 'kubelet', 'Error: ImagePullBackOff']]);
    E.push(['Normal', 'Pulled', p.fresh ? '5s' : '3m (x98 over 8h)', 'kubelet', `Container image "${img}" already present on machine`]);
    if (o.phase === 'CreateContainerConfigError') return E.concat([['Warning', 'Failed', p.fresh ? '4s' : '3m (x98 over 8h)', 'kubelet', 'Error: ' + o.msg.replace('POD', p.name).replace('UID', '3f9a1c7e-2b4d-4e8f-9a6c-1d3e5f7a9b2c')]]);
    if (o.phase === 'StartError') return E.concat([
      ['Warning', 'Failed', p.fresh ? '4s' : '3m (x98 over 8h)', 'kubelet', `Error: failed to create containerd task: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "${o.bin}": stat ${o.bin}: no such file or directory: unknown`],
      ['Warning', 'BackOff', p.fresh ? '2s' : '9s (x2104 over 8h)', 'kubelet', `Back-off restarting failed container pay-api in pod ${p.name}_payments(3f9a1c7e-2b4d-4e8f-9a6c-1d3e5f7a9b2c)`]]);
    E.push(['Normal', 'Created', p.fresh ? '5s' : '3m (x98 over 8h)', 'kubelet', 'Created container: pay-api'], ['Normal', 'Started', p.fresh ? '5s' : '3m (x98 over 8h)', 'kubelet', 'Started container pay-api']);
    if (o.phase === 'Liveness') E.push(['Warning', 'Unhealthy', p.fresh ? '3s' : '40s (x291 over 8h)', 'kubelet', probeMsg('Liveness', o.probe, p.podIp)],
      ['Normal', 'Killing', p.fresh ? '3s' : '40s (x97 over 8h)', 'kubelet', 'Container pay-api failed liveness probe, will be restarted']);
    if (o.phase === 'NotReady') E.push(['Warning', 'Unhealthy', p.fresh ? '2s' : '4s (x5760 over 8h)', 'kubelet', probeMsg('Readiness', o.probe, p.podIp)]);
    if (['Crash', 'OOM', 'Liveness'].includes(o.phase)) E.push(['Warning', 'BackOff', p.fresh ? '2s' : '9s (x2104 over 8h)', 'kubelet', `Back-off restarting failed container pay-api in pod ${p.name}_payments(3f9a1c7e-2b4d-4e8f-9a6c-1d3e5f7a9b2c)`]);
    return E;
  }
  function podDesc(c, p) {
    const o = c.out, ctr = c.cur.dep.spec.template.spec.containers[0], r = ctr.resources || {}, n = NODES.find(x => x.name === p.nodeName);
    const prb = (k, pr) => pr && pr.httpGet ? `    ${k}:${' '.repeat(Math.max(1, 11 - k.length))}http-get http://:${pr.httpGet.port}${pr.httpGet.path || '/'} delay=${pr.initialDelaySeconds || 0}s timeout=${pr.timeoutSeconds || 1}s period=${pr.periodSeconds || 10}s #success=1 #failure=${pr.failureThreshold || 3}\n` : '';
    const state = o.phase === 'Pending' ? '' : o.phase === 'Ready' || o.phase === 'NotReady'
      ? `    State:          Running\n      Started:      Mon, 24 Nov 2026 ${p.fresh ? '11:41:02' : '02:13:44'} +0530\n    Ready:          ${o.phase === 'Ready' ? 'True' : 'False'}\n    Restart Count:  ${p.rc || 0}\n`
      : ['ImagePullBackOff', 'CreateContainerConfigError'].includes(o.phase)
        ? `    State:          Waiting\n      Reason:       ${o.phase}\n    Ready:          False\n    Restart Count:  0\n`
        : `    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       ${o.phase === 'OOM' ? 'OOMKilled' : o.phase === 'StartError' ? 'StartError' : 'Error'}\n` +
          (o.phase === 'StartError' ? `      Message:      failed to create containerd task: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "${o.bin}": stat ${o.bin}: no such file or directory: unknown\n` : '') +
          `      Exit Code:    ${o.phase === 'OOM' ? 137 : o.phase === 'StartError' ? 128 : o.phase === 'Liveness' ? 143 : 1}\n    Ready:          False\n    Restart Count:  ${p.rc}\n`;
    const envs = (ctr.env || []).map(e => `      ${e.name}:${' '.repeat(Math.max(1, 15 - e.name.length))}${e.value != null ? e.value : e.valueFrom && e.valueFrom.configMapKeyRef ? `<set to the key '${e.valueFrom.configMapKeyRef.key}' of config map '${e.valueFrom.configMapKeyRef.name}'>  Optional: false` : '<unknown>'}`).join('\n');
    const lim = Object.entries(r.limits || {}).map(([k, v]) => `      ${k}:  ${v}`).join('\n'), req = Object.entries(r.requests || {}).map(([k, v]) => `      ${k}:     ${v}`).join('\n');
    const ns = c.cur.dep.spec.template.spec.nodeSelector;
    const E = evs(c, p);
    return `Name:             ${p.name}
Namespace:        payments
Priority:         0
Service Account:  default
Node:             ${n && o.phase !== 'Pending' ? n.name + '/' + n.ip : '<none>'}
Labels:           ${Object.entries(c.cur.dep.spec.template.metadata.labels).map(([k, v]) => k + '=' + v).join('\n                  ')}
                  pod-template-hash=${c.hash}
Status:           ${o.phase === 'Pending' ? 'Pending' : 'Running'}
IP:               ${o.phase === 'Pending' ? '' : p.podIp}
Controlled By:    ReplicaSet/pay-api-${c.hash}
Containers:
  pay-api:
    Image:          ${ctr.image}
` + (ctr.command ? `    Command:\n${ctr.command.map(x => '      ' + x).join('\n')}\n` : '') +
      `    Port:           ${((ctr.ports || [])[0] || {}).containerPort || '<none>'}/TCP (${((ctr.ports || [])[0] || {}).name || ''})\n` + state +
      (lim ? `    Limits:\n${lim}\n` : '') + (req ? `    Requests:\n${req}\n` : '') + prb('Liveness', ctr.livenessProbe) + prb('Readiness', ctr.readinessProbe) +
      `    Environment:\n${envs || '      <none>'}\n` +
      (o.phase === 'Pending' ? 'Conditions:\n  Type           Status\n  PodScheduled   False\n' : `Conditions:\n  Type              Status\n  PodScheduled      True\n  Ready             ${o.phase === 'Ready' ? 'True' : 'False'}\n`) +
      `Node-Selectors:   ${ns ? Object.entries(ns).map(([k, v]) => k + '=' + v).join(',') : '<none>'}\n` +
      'Events:\n' + tbl([['  Type', 'Reason', 'Age', 'From', 'Message'], ['  ----', '------', '---', '----', '-------']].concat(E.map(e => ['  ' + e[0]].concat(e.slice(1)))));
  }
  const START = port => `{"level":"info","ts":"2026-11-24T05:41:02.118Z","msg":"pay-api 1.8.0 starting","pid":1}\n{"level":"info","ts":"2026-11-24T05:41:02.164Z","msg":"loaded UPI bank list","banks":612}\n{"level":"info","ts":"2026-11-24T05:41:02.201Z","msg":"listening","port":${port}}`;
  function podLogs(c, p, prev) {
    const o = c.out;
    if (o.phase === 'Pending') return { err: `Error from server (BadRequest): pod ${p.name} does not have a host assigned` };
    if (o.phase === 'ImagePullBackOff') return { err: `Error from server (BadRequest): container "pay-api" in pod "${p.name}" is waiting to start: trying and failing to pull image` };
    if (o.phase === 'CreateContainerConfigError') return { err: `Error from server (BadRequest): container "pay-api" in pod "${p.name}" is waiting to start: CreateContainerConfigError` };
    if (o.phase === 'StartError') return { out: '(kuch nahi chhapa — process shuru hi nahi hua, toh logs bhi nahi. Wajah: kubectl describe pod ka Last State)' };
    if (o.phase === 'Crash') return { out: '{"level":"info","ts":"2026-11-24T05:41:02.118Z","msg":"pay-api 1.8.0 starting","pid":1}\n' + o.log };
    if (o.phase === 'OOM') return { out: START(o.appPort).split('\n').slice(0, 2).join('\n') + '\n{"level":"info","ts":"2026-11-24T05:41:02.733Z","msg":"warming merchant cache","merchants":184220}\n(logs achanak ruk gaye — process ko bahar se maara gaya)' };
    if (o.phase === 'Liveness') return { out: START(o.appPort) + `\n{"level":"info","ts":"2026-11-24T05:41:33.004Z","msg":"shutdown: SIGTERM received, draining"}` };
    if (o.phase === 'NotReady') return { out: START(o.appPort) + (o.probe.code ? `\n{"level":"warn","msg":"GET ${o.probe.path} 404","ua":"kube-probe/1.33"}\n{"level":"warn","msg":"GET ${o.probe.path} 404","ua":"kube-probe/1.33"}` : '') };
    return { out: START(o.appPort) + '\n{"level":"info","msg":"GET /readyz 200","ua":"kube-probe/1.33"}\n{"level":"info","msg":"POST /pay 200","txn":"CPX95120","ms":412}' };
  }
  // Service → endpoints (Ready pods jinke labels selector se milein) aur targetPort ka asli port
  function svcState(c) {
    const sp = c.cur.svc.spec || {}, sel = sp.selector || {}, port = sp.ports[0];
    const ctr = c.cur.dep.spec.template.spec.containers[0], labels = c.cur.dep.spec.template.metadata.labels || {};
    const match = Object.keys(sel).length > 0 && Object.keys(sel).every(k => labels[k] === String(sel[k]));
    const tp = port.targetPort == null ? port.port : typeof port.targetPort === 'number' ? port.targetPort : (/^\d+$/.test(port.targetPort) ? Number(port.targetPort) : ((ctr.ports || []).find(x => x.name === port.targetPort) || {}).containerPort);
    const pods = c.pods.filter(p => p.app && p.ready === '1/1');
    const eps = match && tp != null ? pods.map(p => `${p.podIp}:${tp}`) : [];
    return { match, tp, eps, port: port.port, appPort: c.out.appPort };
  }
  const isHealthy = c => { const ps = c.pods.filter(p => p.app); return ps.length > 0 && ps.every(p => p.ready === '1/1'); };
  function refresh(c, newPods) {
    const dep = c.cur.dep, n = dep.spec.replicas == null ? 1 : dep.spec.replicas;
    c.out = outcome(dep, c.cur.cm);
    let mine = c.pods.filter(p => p.app);
    if (newPods) {
      c.rsN = (c.rsN || 0) + 1; c.hash = HASH[(c.rsN - 1) % HASH.length];
      mine = [];
    }
    while (mine.length > n) mine.pop();
    while (mine.length < n) {
      const k = (c.podN = (c.podN || 0) + 1), node = NODES[(k - 1) % 3];
      mine.push({ app: true, name: `pay-api-${c.hash}-${SUF[(k - 1) % SUF.length]}`, nodeName: node.name, podIp: `${node.net}.${30 + k}`, age: c.booted ? '6s' : '8h', fresh: !!c.booted, rc: 0 });
    }
    mine.forEach(p => { podRow(c, p); p.describe = podDesc(c, p); });
    c.pods = mine.concat(c.extraPods);
    const s = svcState(c);
    const ready = mine.filter(p => p.ready === '1/1').length;
    c.deployments = [{ name: 'pay-api', ready: `${ready}/${n}`, upToDate: n, available: ready, age: '40d',
      describe: `Name:                   pay-api\nNamespace:              payments\nSelector:               app=pay-api\nReplicas:               ${n} desired | ${n} updated | ${n} total | ${ready} available | ${n - ready} unavailable\nStrategyType:           RollingUpdate\nPod Template:\n  Labels:  ${Object.entries(dep.spec.template.metadata.labels).map(([k, v]) => k + '=' + v).join(',')}\n  Containers:\n   pay-api:\n    Image:      ${dep.spec.template.spec.containers[0].image}\nConditions:\n  Type           Status  Reason\n  ----           ------  ------\n  Available      ${ready === n && n > 0 ? 'True    MinimumReplicasAvailable' : n === 0 ? 'True    MinimumReplicasAvailable' : 'False   MinimumReplicasUnavailable'}\n  Progressing    True    NewReplicaSetAvailable\nNewReplicaSet:   pay-api-${c.hash} (${n}/${n} replicas created)\nEvents:          <none>` },
    { name: 'sleep', ready: '1/1', upToDate: 1, available: 1, age: '30d' }];
    const sp = c.cur.svc.spec || {};
    c.services = [{ name: 'pay-api', type: 'ClusterIP', clusterIP: '10.100.71.3', ports: `${sp.ports[0].port}/TCP`, age: '40d',
      describe: `Name:                     pay-api\nNamespace:                payments\nLabels:                   <none>\nSelector:                 ${Object.entries(sp.selector || {}).map(([k, v]) => k + '=' + v).join(',') || '<none>'}\nType:                     ClusterIP\nIP:                       10.100.71.3\nPort:                     <unset>  ${sp.ports[0].port}/TCP\nTargetPort:               ${sp.ports[0].targetPort == null ? sp.ports[0].port : sp.ports[0].targetPort}/TCP\nEndpoints:                ${s.eps.join(',') || '<none>'}\nSession Affinity:         None\nEvents:                   <none>` },
    { name: 'ledger', type: 'ClusterIP', clusterIP: '10.100.18.9', ports: '8080/TCP', age: '40d' }];
    c.endpoints = [{ name: 'pay-api', endpoints: s.eps.join(',') || '<none>', age: '40d' }, { name: 'ledger', endpoints: '10.0.14.11:8080', age: '40d' }];
    const data = (c.cur.cm && c.cur.cm.data) || {};
    c.configmaps = [{ name: 'pay-api-config', dataCount: Object.keys(data).length, age: '40d',
      describe: 'Name:         pay-api-config\nNamespace:    payments\nLabels:       <none>\nAnnotations:  <none>\n\nData\n====\n' + Object.keys(data).sort().map(k => `${k}:\n----\n${data[k]}\n`).join('\n') + '\nBinaryData\n====\n\nEvents:  <none>' },
    { name: 'kube-root-ca.crt', dataCount: 1, age: '40d' }];
    const allE = [];
    mine.forEach(p => evs(c, p).forEach(e => allE.push([e[2].split(' ')[0], e[0], e[1], 'pod/' + p.name, e[4]])));
    c.events = tbl([['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE']].concat(allE.slice(-14))).split('\n');
    c.healthy = isHealthy(c);
  }
  function freshCluster(text) {
    const docs = KG.yaml.parseAll(text).filter(Boolean);
    const c = { applied: text, booted: false, nodes: NODES.map(n => ({ name: n.name, status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4', zone: n.zone, labels: nodeLabels(n) })),
      extraPods: [{ name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '12d', node: 'node-3', ip: '10.0.14.11' },
        { name: 'sleep-5d7c8b-x1m9t', ready: '1/1', status: 'Running', restarts: 0, age: '30d', node: 'node-1', ip: '10.0.12.40' }],
      cur: { cm: docs.find(d => d.kind === 'ConfigMap'), dep: docs.find(d => d.kind === 'Deployment'), svc: docs.find(d => d.kind === 'Service') }, pods: [] };
    refresh(c, true);
    c.booted = true;
    return c;
  }
  const findPod = (c, name) => c.pods.find(p => p.name === name) || (/^(deploy(ment)?\/)?pay-api$/.test(name) ? c.pods.find(p => p.app) : null);
  function curl(c, cmd) {
    const silent = /(^|\s)-[a-zA-Z]*s/.test(cmd.split(' -- ')[1] || '') && !/(^|\s)-[a-zA-Z]*S/.test(cmd.split(' -- ')[1] || '');
    const u = ((cmd.split(' -- ')[1] || '').match(/(?:https?:\/\/)?([A-Za-z0-9.-]+)(?::(\d+))?(\/\S*)?\s*$/) || []);
    const host = u[1] || '', port = Number(u[2] || 80), path = (u[3] || '/').replace(/["']$/, '');
    const fail = (code, msg) => (silent ? '' : msg + '\n') + `command terminated with exit code ${code}`;
    if (!/^pay-api(\.payments(\.svc(\.cluster\.local)?)?)?$/.test(host)) return fail(6, `curl: (6) Could not resolve host: ${host}`);
    const s = svcState(c);
    if (port !== s.port) return fail(28, `curl: (28) Failed to connect to ${host} port ${port} after 10002 ms: Timeout was reached`);
    if (!s.eps.length || s.tp !== s.appPort) return fail(7, `curl: (7) Failed to connect to ${host} port ${port} after 3 ms: Couldn't connect to server`);
    if (path === '/healthz') { c.curlOk = true; return 'ok'; }
    if (path === '/readyz') return 'ready';
    if (path === '/') return '{"service":"pay-api","version":"1.8.0"}';
    return '404 page not found';
  }

  /* ---------- poora terminal mission ---------- */
  const STORY = 'Raat 2 baje ChaiPay ke cluster ke saare nodes upgrade hue — pay-api ke saare pods naye bane. Subah se payments down hain. Pichhle hafte kisi ne git mein pay-api.yaml badla tha (ConfigMap + Deployment + Service ek hi file mein). 🎲 Chaos monkey ne us file mein KUCHH toda hai — kya, yeh tumhe dhoondhna hai.';
  const DIAG = /^kubectl (describe|logs)\b|^kubectl get (events?|ev|endpoints?|ep|endpointslices?|deploy|deployments?|rs|replicasets?|cm|configmaps?)\b|^kubectl get (pods?|po)\b.*(-o ?wide|--show-labels|-o ?yaml)/;
  function mission(ids) {
    const text = apply(ids);
    const B = ids.map(byId);
    const T = [
      { text: 'Wajah dhoondho — <code>kubectl describe</code>, <code>kubectl logs</code>, events ya endpoints', check: s => s.history.some(h => DIAG.test(h)) },
      { text: '<code>pay-api.yaml</code> theek karke apply karo — saare pay-api pods <b>1/1 Running</b>', check: s => !!s.cluster.healthy },
      { text: 'Andar se test: <code>kubectl exec deploy/sleep -- curl -s http://pay-api/healthz</code> → <b>ok</b>', check: s => !!s.cluster.healthy && !!s.cluster.curlOk },
    ];
    const cluster = freshCluster(text);
    const first = (cluster.pods.find(p => p.app) || {}).name || 'pay-api';
    const diagCmd = b => b.diag === 'describe' ? `kubectl describe pod ${first}` : b.diag === 'logs' ? `kubectl logs ${first}` : b.diag === 'endpoints' ? 'kubectl get endpoints pay-api' : 'kubectl get deploy pay-api';
    const blockFile = '(simulator ne roka) is chaos round mein ilaaj FILE mein karo — vi pay-api.yaml → Save → kubectl apply -f pay-api.yaml. Seedha cluster badla toh git aur cluster alag ho jaate (agla deploy wahi galti wapas laata).';
    return {
      type: 'terminal', chaos: ids.slice(),
      title: '🎲 Chaos round',
      instructions: STORY,
      goal: `pay-api ko wapas zinda karo: saare pods <b>1/1 Running</b> aur Service ke zariye <code>curl</code> par <b>ok</b>. Kuch bhi bataya nahi gaya — pods, describe, logs, events, endpoints se khud dhoondho.
        Fix: <code>vi pay-api.yaml</code> → 💾 Save → <code>kubectl apply -f pay-api.yaml</code>.`,
      tasks: T,
      cluster,
      responses: [
        { re: /^kubectl logs\b.*$/,
          out: (s, m) => {
            const c = s.cluster, toks = String((m && m[0]) || '').split(' ').slice(2), prev = toks.some(t => t === '-p' || t === '--previous');
            const pos = toks.filter((t, i) => !/^-/.test(t) && !/^(-c|--container|-n|--namespace|--tail)$/.test(toks[i - 1] || ''));
            const name = pos[0] || '';
            if (!name) return 'error: expected \'logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER]\'.';
            const p = findPod(c, name);
            if (!p) return `Error from server (NotFound): pods "${name}" not found`;
            if (!p.app) return /^sleep/.test(p.name) ? '(sleep pod — kuch nahi chhapta, bas sota hai)' : '{"level":"info","msg":"ledger ready","conns":42}';
            const r = podLogs(c, p, prev);
            return r.err || r.out;
          } },
        { re: /^kubectl exec\b.*-- curl\b.*$/,
          out: (s, m) => {
            const c = s.cluster, cmd = String((m && m[0]) || ''), who = (cmd.split(' -- ')[0].split(' ').slice(2).filter(t => !/^-/.test(t))[0]) || '';
            if (/^(deploy(ment)?\/)?sleep/.test(who)) return curl(c, cmd);
            const p = findPod(c, who);
            if (!p) return `Error from server (NotFound): pods "${who}" not found`;
            if (!p.app) return curl(c, cmd);
            if (p.status !== 'Running') return 'error: unable to upgrade connection: container not found ("pay-api")';
            return /localhost:(\d+)|127\.0\.0\.1:(\d+)/.test(cmd) && Number(RegExp.$1 || RegExp.$2) === c.out.appPort ? 'ok' : 'curl: (7) Failed to connect to localhost port 80 after 0 ms: Couldn\'t connect to server\ncommand terminated with exit code 7';
          } },
        { re: /^kubectl get (?:pods?|po)\b.*--show-labels\b.*$/,
          out: s => tbl([['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE', 'LABELS']].concat(s.cluster.pods.map(p => [p.name, p.ready, p.status, String(p.restarts), p.age,
            p.app ? Object.entries(s.cluster.cur.dep.spec.template.metadata.labels).map(([k, v]) => k + '=' + v).join(',') + ',pod-template-hash=' + s.cluster.hash : /^ledger/.test(p.name) ? 'app=ledger' : 'app=sleep']))) },
        { re: /^kubectl get (?:nodes?|no)\b.*--show-labels\b.*$/,
          out: tbl([['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION', 'LABELS']].concat(NODES.map(n => [n.name, 'Ready', '<none>', '40d', 'v1.33.4', Object.entries(nodeLabels(n)).map(([k, v]) => k + '=' + v).join(',')]))) },
        { re: /^kubectl get (?:cm|configmaps?)(?:[ /]pay-api-config)? -o ?yaml\b.*$/,
          out: s => 'apiVersion: v1\ndata:\n' + Object.keys((s.cluster.cur.cm || {}).data || {}).sort().map(k => `  ${k}: ${JSON.stringify(s.cluster.cur.cm.data[k])}`).join('\n') + '\nkind: ConfigMap\nmetadata:\n  name: pay-api-config\n  namespace: payments' },
        { re: /^kubectl (?:rollout restart|delete (?:pods?|po))\b.*pay-api.*$/,
          out: (s, m) => { const c = s.cluster; refresh(c, true); return (/rollout/.test(String(m && m[0])) ? 'deployment.apps/pay-api restarted' : 'pod deleted') + '\n(naye pods bane — par file wahi hai, toh haal bhi wahi hoga. kubectl get pods)'; } },
        { re: /^kubectl (?:rollout undo|scale|set (?:image|env|resources)|patch|edit)\b.*$/, err: true, out: blockFile },
      ],
      files: {
        'pay-api.yaml': {
          editable: true, desc: 'pay-api ki git file — ConfigMap + Deployment + Service', content: text,
          apply: (s, txt, docs) => {
            const c = s.cluster, out = [], errs = [];
            const cm = (docs || []).find(d => d && d.kind === 'ConfigMap'), dep = (docs || []).find(d => d && d.kind === 'Deployment'), svc = (docs || []).find(d => d && d.kind === 'Service');
            if (!cm || !dep || !svc) return { err: '(simulator ne roka) file mein teeno objects rehne do — ConfigMap pay-api-config, Deployment pay-api, Service pay-api. (Asli kubectl hatane se object delete nahi karta; bas chhod deta hai.)' };
            if ((cm.metadata || {}).name !== 'pay-api-config' || (dep.metadata || {}).name !== 'pay-api' || (svc.metadata || {}).name !== 'pay-api')
              return { err: '(simulator ne roka) objects ke naam mat badlo — naya naam = naya object, aur purana toota wala waise hi chalta rehta.' };
            const before = JSON.stringify(c.cur.dep.spec.template);
            let tplChanged = false, changed = false;
            [['ConfigMap', 'configmap/pay-api-config', cm, checkCm, 'cm'], ['Deployment', 'deployment.apps/pay-api', dep, checkDep, 'dep'], ['Service', 'service/pay-api', svc, checkSvc, 'svc']].forEach(([, label, d, chk, key]) => {
              const e = chk(d);
              if (e) { errs.push(e); return; }
              if (JSON.stringify(d) === JSON.stringify(c.cur[key])) { out.push(label + ' unchanged'); return; }
              c.cur[key] = d; changed = true; out.push(label + ' configured');
            });
            if (changed) {
              tplChanged = JSON.stringify(c.cur.dep.spec.template) !== before;
              c.curlOk = false;
              refresh(c, tplChanged);
              c.applied = txt;
            }
            const ctr = c.cur.dep.spec.template.spec.containers[0];
            const gone = ['readinessProbe', 'livenessProbe'].filter(k => !ctr[k]);
            if (changed && gone.length) out.push(`(Dhyan do: ${gone.join(' aur ')} hata diya — pods Ready dikhenge, par ab Kubernetes ko pata nahi chalega ki app atki hai ya traffic lene layak hai. Behtar ilaaj: probe ka path / port theek karo.)`);
            const msg = out.join('\n') + (errs.length ? (out.length ? '\n' : '') + errs.join('\n') : '');
            return errs.length ? { err: msg } : msg;
          },
        },
      },
      success: KG.allOf(T),
      successText: `<b>🎲 Kya toota tha:</b><br>${B.map(b => '• <b>' + b.title + ':</b> ' + b.reveal).join('<br>')}<br>
        <b>Kram yaad rakho:</b> STATUS padho → Pending = scheduler (describe ka FailedScheduling) · ImagePullBackOff = image/tag · CreateContainerConfigError = ConfigMap/Secret/securityContext ·
        CrashLoopBackOff = logs + Last State (OOMKilled? StartError?) · Running 0/1 = readiness probe · sab 1/1 par curl fail = Service (endpoints, selector, targetPort).`,
      hints: [
        'kubectl get pods — STATUS kya kehta hai? Phir kubectl describe pod <naam> (neeche Events) ya kubectl logs <naam>. Sab pods 1/1 hain toh kubectl get endpoints pay-api.',
        B.map(b => b.clue).join(' ║ '),
        'vi pay-api.yaml — ' + B.map(b => b.fix).join('; ') + '. Save, kubectl apply -f pay-api.yaml, kubectl get pods, phir curl.',
      ],
      solution: ['kubectl get pods'].concat(B.map(diagCmd), [{ edit: 'pay-api.yaml', change: B.map(b => [b.to, b.from]) }, 'kubectl apply -f pay-api.yaml', 'kubectl get pods',
        'kubectl exec deploy/sleep -- curl -s http://pay-api/healthz']),
    };
  }

  /* ---------- random chunaav: dobara wahi breakage jaldi na aaye ---------- */
  function pick(level, rnd) {
    rnd = rnd || Math.random;
    const pool = BREAKS.filter(b => b.level <= level);
    KG.state.chaosSeen = KG.state.chaosSeen || [];
    const fresh = pool.filter(b => !KG.state.chaosSeen.includes(b.id));
    const from = fresh.length ? fresh : pool;
    const a = from[Math.floor(rnd() * from.length)];
    const ids = [a.id];
    if (level >= 3 && rnd() < 0.4) {   // advanced: kabhi do galtiyan ek saath (alag hisson mein)
      const svcSide = x => ['svc-selector', 'svc-targetport'].includes(x.id);
      const other = pool.filter(b => b.id !== a.id && svcSide(b) !== svcSide(a) && b.id !== 'replicas-zero' && a.id !== 'replicas-zero');
      if (other.length) ids.push(other[Math.floor(rnd() * other.length)].id);
    }
    KG.state.chaosSeen = KG.state.chaosSeen.concat(ids).slice(-Math.max(3, pool.length - 2));
    return ids;
  }
  // pay-api sach mein kaam kar raha hai? (pods Ready + Service ke endpoints sahi port par)
  const works = c => isHealthy(c) && (st => st.eps.length > 0 && st.tp === st.appPort)(svcState(c));
  return { id: 'payapi', BREAKS, BASE, mission, pick, apply, outcome, works };
})();

/* =====================================================================
   🎲 Decks (2026-11-25): chaos ab sirf pay-api.yaml tak seemit nahi.
   Har deck = { id, file, BREAKS: [{ id, level, title, from, to, fix, clue, reveal }], mission(ids), intro? }
   Stage: { type: 'chaos', id, level, deck: 'helm' }   (deck na ho toh 'payapi' = upar wala)
   Naye decks data-chaos.js mein: KG.chaos.addDeck(def).
   ===================================================================== */
KG.chaos.decks = { payapi: KG.chaos };
KG.chaos.addDeck = def => { KG.chaos.decks[def.id] = def; return def; };
KG.chaos.deck = id => KG.chaos.decks[id || 'payapi'];
// deck ka apna pick() na ho toh: ek breakage, haal hi mein aaya hua dobara jaldi nahi
KG.chaos.pickFrom = function (deck, level, rnd) {
  rnd = rnd || Math.random;
  const pool = deck.BREAKS.filter(b => (b.level || 1) <= level);
  KG.state.chaosSeenBy = KG.state.chaosSeenBy || {};
  const seen = KG.state.chaosSeenBy[deck.id] || [];
  const fresh = pool.filter(b => !seen.includes(b.id));
  const from = fresh.length ? fresh : pool;
  const a = from[Math.floor(rnd() * from.length)];
  KG.state.chaosSeenBy[deck.id] = seen.concat([a.id]).slice(-Math.max(2, pool.length - 2));
  return [a.id];
};

/* =====================================================================
   🎲 stage renderer — har round naya random breakage, terminal ke andar
   ===================================================================== */
(function () {
  const el = KG.el;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  KG.renderers.chaos = function renderChaos(stage, arena, onDone) {
    let rounds = 0, clean = 0, t0 = 0, done = false;
    KG.state.chaosStats = KG.state.chaosStats || {};
    const st = KG.state.chaosStats[stage.id] || { won: 0, best: null };
    const lv = stage.level || 1;
    const D = KG.chaos.deck(stage.deck);
    const pool = D.BREAKS.filter(b => (b.level || 1) <= lv).length;
    const intro = el('div', 'lab-goal', `🎲 <b>CHAOS MODE:</b> ${stage.intro || ''} Chaos monkey <b>${pool}</b> tarah ki galtiyon mein se koi ek chupke se <code>${D.file || 'pay-api.yaml'}</code> mein daalta hai${lv >= 3 && D === KG.chaos ? ' (kabhi-kabhi <b>do</b> ek saath)' : ''}.
      Tumhe kuch nahi bataya jaayega — <code>kubectl</code> se khud pakdo. Har round naya.${st.won ? `<br><span class="drill-rules">Ab tak jeete: <b>${st.won}</b> round${st.best ? ` · sabse tez: <b>${Math.floor(st.best / 60)}:${String(st.best % 60).padStart(2, '0')}</b>` : ''}</span>` : ''}`);
    const startBtn = el('button', 'btn big chaos-start', '🎲 Chaos monkey ko chhodo');
    const stageBox = el('div', 'chaos-round');
    const after = el('div', 'lab-after');
    arena.append(intro, startBtn, stageBox, after);

    function play() {
      after.innerHTML = '';
      stageBox.innerHTML = '';
      const ids = D.pick ? D.pick(lv) : KG.chaos.pickFrom(D, lv);
      const m = D.mission(ids);
      m.title = `🎲 Chaos round ${rounds + 1}`;
      const sub = el('div', 'chaos-term');
      stageBox.appendChild(sub);
      t0 = now();
      arena._chaos = { mission: m, sub, roundDone };
      KG.renderers.terminal(m, sub, roundDone);
    }
    function roundDone(res) {
      if (done || !arena._chaos || arena._chaos.counted) return;
      arena._chaos.counted = true;
      rounds++;
      if (res && res.firstTry) clean++;
      const secs = Math.round((now() - t0) / 1000);
      st.won = (st.won || 0) + 1;
      if (st.best == null || secs < st.best) st.best = secs;
      KG.state.chaosStats[stage.id] = st;
      if (KG.saveState) KG.saveState();
      const box = el('div', 'lab-win pop', `🎯 <b>Round ${rounds} jeeta</b> · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}${res && res.firstTry ? ' · bina hint ke 🔥' : ''}. Kya toota tha — upar mission ke result mein likha hai.`);
      const again = el('button', 'btn ghost chaos-again', '🎲 Ek aur breakage');
      again.onclick = () => { again.disabled = true; play(); if (stageBox.scrollIntoView) stageBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      const next = el('button', 'btn big', 'Aage badho →');
      next.onclick = () => { if (done) return; done = true; next.disabled = true; again.disabled = true; onDone({ firstTry: clean, total: rounds }); };
      after.append(box, again, next);
    }
    startBtn.onclick = () => { if (startBtn.disabled) return; startBtn.disabled = true; startBtn.style.display = 'none'; play(); };
  };
})();
