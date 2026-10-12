/* Ek pod (container) — cluster.js ise chalata hai. Asli app jaisa:
   - Boot mein STARTUP_MS lagte hain (framework shuru ho raha hai) — tab tak port khula hi nahi (connection refused).
   - GET /livez   : LIVE=shallow → 200 · LIVE=deep → DB se poochho (500 ms timeout), DB gaya toh 500
   - GET /readyz  : READY=deep → har probe par DB query · cached → har 2 s ek DB check, jawab variable se · shallow → 200
                    SIGTERM ke baad hamesha 503 (ab traffic mat bhejo)
   - GET /home    : DB nahi chahiye (static / cache se)       GET /orders : DB query chahiye
   - SIGTERM: GRACEFUL=1 → readiness 503, 2 s tak chalte kaam poore karo aur naye bhi lo, phir exit · GRACEFUL=0 → turant exit */
const { serve, json } = require('../lib/util');
const PORT = +process.env.PORT, DB = process.env.DB_URL || 'http://localhost:5302';
const STARTUP_MS = +(process.env.STARTUP_MS || 0), LIVE = process.env.LIVE || 'shallow', READY = process.env.READY || 'shallow';
const GRACEFUL = process.env.GRACEFUL === '1';
let terminating = false, cachedReady = true;

async function dbOk() {
  try { return (await fetch(DB + '/query', { signal: AbortSignal.timeout(500) })).ok; } catch (e) { return false; }
}
setTimeout(() => {
  if (READY === 'cached') { const tick = async () => { cachedReady = await dbOk(); }; tick(); setInterval(tick, 2000); }
  serve(PORT, {
    'GET /livez': async (req, res) => (LIVE === 'deep' && !(await dbOk()) ? json(res, 500, { live: false }) : { live: true }),
    'GET /readyz': async (req, res) => {
      if (terminating) return json(res, 503, { ready: false, why: 'shutting down' });
      const ok = READY === 'deep' ? await dbOk() : READY === 'cached' ? cachedReady : true;
      return ok ? { ready: true } : json(res, 503, { ready: false });
    },
    'GET /home': () => ({ page: 'home', pod: PORT }),
    'GET /orders': async (req, res) => ((await dbOk()) ? { orders: [1, 2, 3] } : json(res, 503, { error: 'db nahi mila' })),
  });
}, STARTUP_MS);

process.on('SIGTERM', () => {
  if (!GRACEFUL) process.exit(0);
  terminating = true;
  setTimeout(() => process.exit(0), 2000);                                 // drain: 2 s tak jo aaye use serve karo
});
