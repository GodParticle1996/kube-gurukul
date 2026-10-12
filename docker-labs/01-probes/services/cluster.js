/* Mini cluster (Node mein — Docker/K8s ke bina bhi chale):
     kubelet   — har pod par probes chalata hai, asli Kubernetes ke niyam se:
                 startupProbe pass hone tak liveness/readiness band · initialDelaySeconds · periodSeconds ·
                 timeoutSeconds · failureThreshold. Liveness/startup fail → container RESTART (CrashLoopBackOff).
     endpoints — sirf READY pods.
     Service   — GET /svc/<page> → endpoints mein round robin. Koi ready pod nahi → 503 "no endpoints".
                 Terminate hote pod ko 1 s tak aur traffic milta hai (kube-proxy / LB ko khabar pahunchne mein der).
   POST /deploy {replicas, env, probes}   POST /rollout (maxSurge 1, maxUnavailable 0)   GET /stats   POST /reset
   ⏱️ CrashLoopBackOff chhota kiya hai: 0, 1, 2, 4, 8 s (asli K8s: 10, 20, 40 s … 5 min tak). */
const { serve, json, sleep } = require('../lib/util');
const { spawn } = require('child_process');
const path = require('path');
const PORT = +process.env.PORT || 5301, DB = process.env.DB_URL || 'http://localhost:5302';
const ENDPOINT_LAG = 1000, GRACE = 5000;
let nextPort = 5310, podSeq = 0, pods = [], cfg = { env: {}, probes: {} }, rr = 0, events = [], t0 = Date.now();

const log = msg => events.push({ at: Date.now() - t0, msg });
const alive = () => pods.filter(p => !p.deleted);
const newPod = () => ({ name: 'pod-' + (++podSeq), restarts: 0, deleted: false, ready: false, state: 'Pending', gen: 0 });

function startContainer(pod) {
  pod.port = nextPort++; if (nextPort > 5399) nextPort = 5310;
  pod.proc = spawn(process.execPath, [path.join(__dirname, 'pod.js')], { stdio: 'ignore', env: Object.assign({}, process.env, cfg.env, { PORT: String(pod.port), DB_URL: DB }) });
  pod.startedAt = Date.now(); pod.started = !cfg.probes.startup; pod.ready = false;
  pod.fails = { liveness: 0, readiness: 0, startup: 0 }; pod.state = 'Running';
  const myGen = ++pod.gen, due = { liveness: 0, readiness: 0, startup: 0 };
  const tick = () => {
    if (pod.gen !== myGen || pod.deleted) return;
    const now = Date.now(), age = (now - pod.startedAt) / 1000;
    for (const kind of ['startup', 'liveness', 'readiness']) {
      const p = cfg.probes[kind];
      if (!p) continue;
      if (kind === 'startup' ? pod.started : !pod.started) continue;       // startup pass hone tak baaki probes band
      if (age < (p.initialDelaySeconds || 0) || now < due[kind]) continue;
      due[kind] = now + (p.periodSeconds || 10) * 1000;
      probe(pod, kind, p, myGen);
    }
    if (!cfg.probes.readiness && pod.started && !pod.ready) pod.ready = true; // readiness probe hi nahi → start hote hi ready
    setTimeout(tick, 50);
  };
  tick();
}

async function probe(pod, kind, p, myGen) {
  let ok = false;
  try {
    const r = await fetch(`http://localhost:${pod.port}${p.path}`, { signal: AbortSignal.timeout((p.timeoutSeconds || 1) * 1000) });
    ok = r.status >= 200 && r.status < 400;
  } catch (e) {}
  if (pod.gen !== myGen || pod.deleted) return;
  if (ok) {
    pod.fails[kind] = 0;
    if (kind === 'startup' && !pod.started) { pod.started = true; log(`${pod.name} startup probe pass`); }
    if (kind === 'readiness' && !pod.ready) { pod.ready = true; log(`${pod.name} READY`); }
    return;
  }
  if (++pod.fails[kind] < (p.failureThreshold || 3)) return;
  if (kind === 'readiness') { if (pod.ready) { pod.ready = false; log(`${pod.name} NOT READY → endpoints se bahar`); } return; }
  restart(pod, kind);                                                      // liveness / startup fail
}

function restart(pod, why) {
  pod.restarts++; pod.ready = false; pod.gen++; pod.state = 'CrashLoopBackOff';
  log(`${pod.name} ${why} probe fail → container restart #${pod.restarts}`);
  try { pod.proc.kill('SIGKILL'); } catch (e) {}
  const backoff = pod.restarts === 1 ? 0 : Math.min(8000, 1000 * 2 ** (pod.restarts - 2));
  setTimeout(() => { if (!pod.deleted && !stopping) startContainer(pod); }, backoff);
}

function terminate(pod) {
  pod.terminatingAt = Date.now(); pod.gen++;                              // probes band
  try { pod.proc.kill('SIGTERM'); } catch (e) {}
  setTimeout(() => { try { pod.proc.kill('SIGKILL'); } catch (e) {} }, GRACE);   // terminationGracePeriod khatam → zabardasti
  /* process chahe pehle mar jaaye — Service / LB ko pata ENDPOINT_LAG ke baad hi chalta hai */
  setTimeout(() => { pod.deleted = true; }, Math.max(GRACE, ENDPOINT_LAG) + 100);
}

function endpoints() {
  const now = Date.now();
  return pods.filter(p => !p.deleted && (p.terminatingAt ? now - p.terminatingAt < ENDPOINT_LAG : p.ready));
}
function killAll() { pods.forEach(p => { p.deleted = true; p.gen++; try { p.proc.kill('SIGKILL'); } catch (e) {} }); pods = []; }

serve(PORT, {
  'GET /svc/:page': async (req, res, url, p) => {
    const eps = endpoints();
    if (!eps.length) return json(res, 503, { error: 'no endpoints (koi ready pod nahi)' });
    const pod = eps[rr++ % eps.length];
    try {
      const r = await fetch(`http://localhost:${pod.port}/${p.page}`, { signal: AbortSignal.timeout(2000) });
      return json(res, r.status, await r.json().catch(() => ({})));
    } catch (e) { return json(res, 502, { error: `${pod.name} ne connection tod diya` }); }
  },
  'POST /deploy': (req, res, url, p, b) => {
    killAll(); cfg = { env: b.env || {}, probes: b.probes || {} };
    for (let i = 0; i < (b.replicas || 3); i++) { const pod = newPod(); pods.push(pod); startContainer(pod); }
    log(`deploy: ${b.replicas || 3} pods`); return { ok: true };
  },
  'POST /rollout': async () => {
    const t = Date.now();
    for (const old of alive().filter(p => !p.terminatingAt)) {
      const pod = newPod(); pods.push(pod); startContainer(pod);            // maxSurge 1: pehle naya
      for (let i = 0; i < 600 && !pod.ready; i++) await sleep(50);
      log(`${pod.name} ready → ${old.name} ko SIGTERM`); terminate(old);   // maxUnavailable 0: phir purana
    }
    return { ok: true, ms: Date.now() - t };
  },
  'GET /stats': () => ({
    pods: alive().map(p => ({ name: p.name, port: p.port, ready: p.ready, restarts: p.restarts, state: p.terminatingAt ? 'Terminating' : p.state })),
    restarts: pods.reduce((s, p) => s + p.restarts, 0), ready: alive().filter(p => p.ready).length, events,
  }),
  'POST /reset': () => { killAll(); events = []; t0 = Date.now(); rr = 0; return { ok: true }; },
}, () => console.log(`[cluster] :${PORT} · kubelet + endpoints + Service`));

let stopping = false;
const bye = () => { stopping = true; killAll(); setTimeout(() => process.exit(0), 100); };
process.on('SIGINT', bye); process.on('SIGTERM', bye);
