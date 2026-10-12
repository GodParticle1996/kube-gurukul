# 🐳 KubeGurukul Lab 01 — Health probes: `/healthz` jo poora app gira de

KubeGurukul → Intermediate (Sadhak Path) → **Health Probes** level ka lab. Zero dependency Node (18+).
Video: Software Developer Diaries — "The hidden cost of poorly-designed /health endpoints".

```bash
npm start ex1-deep-shallow   → node tools/dbblip.js      # [--setup deep-live|deep-ready|shallow]
npm start ex2-probe-load     → node tools/probeload.js   # [--ready deep|cached|shallow]
npm start ex3-startup        → node tools/slowstart.js   # [--setup delay5|delay10|delay10-slow|startup]
npm start ex4-graceful       → node tools/rollout.js     # [--app turant|graceful]
docker compose --profile ex1-deep-shallow up --build     # (baaki exercises ke profile bhi)
```

**Asli Kubernetes nahi, uske niyam asli.** `services/cluster.js` ek chhota cluster hai jo har pod ko **alag Node process**
ki tarah chalata hai, aur teen kaam karta hai:

| Hissa | Kya karta hai (Kubernetes jaisa) |
|---|---|
| kubelet | har pod par probes: `startupProbe` pass hone tak liveness/readiness band · `initialDelaySeconds` · `periodSeconds` · `timeoutSeconds` · `failureThreshold`. Liveness / startup fail → **container restart** (CrashLoopBackOff) |
| endpoints | sirf **READY** pods |
| Service | `GET /svc/<page>` → endpoints mein round robin · koi ready pod nahi → `503 no endpoints` · terminate hote pod ko **1 s** tak aur traffic (kube-proxy / LB ko khabar der se) |

`services/pod.js` = app: boot mein `STARTUP_MS` (tab tak port band), `/livez`, `/readyz` (deep / cached / shallow),
`/home` (DB nahi chahiye), `/orders` (DB chahiye), SIGTERM par turant exit ya graceful drain. `services/db.js` = shared DB.

⏱️ CrashLoopBackOff chhota kiya: 0, 1, 2, 4 s (asli K8s: 10, 20, 40 s … 5 min tak). Probe ke seconds asli hain.
Kind / minikube par asli YAML ke saath yahi karna ho toh neeche "Asli cluster par" dekho. Numbers ek laptop (WSL) ke hain.

---

## ex1-deep-shallow — DB ki 5 second ki blip

3 pods (boot 6 s — Spring Boot jaisa). 40/s `/home` + 40/s `/orders`. DB t=6s se t=11s tak band.

```
$ node tools/dbblip.js --setup <har ek>
3 pods (boot 6 s) · 40/s /home + 40/s /orders · 22 s · DB t=6s–11s band

probe setup                        /home safal   /home (DB band ke dauraan)   /orders safal   pod restarts   DB wapas → /orders theek
liveness DB check karta hai           59.0%           17.5%                  55.0%          3           4.9 s baad
sirf readiness DB check karta hai     77.2%           19.5%                  72.7%          0           1.0 s baad
dono shallow, app khud degrade       100.0%          100.0%                  77.3%          0           0.0 s baad
```

👉 **Liveness DB check karta hai** (ek hi "deep /healthz" dono kaam mein): DB 3 second gaya → kubelet ne **teeno pods restart**
kiye. DB 11 s par wapas, par pods abhi boot ho rahe the → `/orders` DB ke **4.9 s baad** theek. 5 s ki blip → ~10 s ka outage.
Restart se DB theek nahi hota — sirf pods bhi gir jaate hain.

👉 **Sirf readiness DB check karta hai**: restart nahi, par DB gaya toh **teeno pods NOT READY → endpoints khaali** → `/home`
bhi fail (19.5%), jise DB se matlab hi nahi. Video ka "zero healthy targets" yahi hai — pods theek the, bas LB ko koi dikha nahi.

👉 **Dono shallow, app khud degrade**: `/home` **100%**, `/orders` sirf blip ke dauraan fail (khud 503 deta hai), aur DB aate hi
theek. Shared dependency (DB) ki bimaari probe mein nahi — request mein sambhalo.

## ex2-probe-load — probes ka bill

5 pods. Har pod ka `/readyz` har second **4 jagah** se: kubelet, load balancer, service mesh (Istio), monitoring. App ka asli
traffic zero.

```
$ node tools/probeload.js
5 pods · har pod ka /readyz har second 4 baar (kubelet + LB + mesh + monitoring) · 10 s · app traffic 0

readiness                        DB queries/second (sirf probes se)   100 pods par (andaaza)
deep — har probe par DB                18.5                            370
cached — har 2 s ek DB check            2.5                            50
shallow — DB nahi                       0.0                            0
```

👉 Video ka hisaab (4 pingers × 100 pods = 400 queries/s) sach hai — bina ek bhi user ke DB par ~370/s sirf "zinda ho?" poochne
mein. **Cache** karo (har 2 s ek check, probe ko variable se jawab) → 50/s. Aur jab DB pehle se dheema ho, deep probes usi
DB par aur bojh daalte hain.

## ex3-startup — dheema boot aur `startupProbe`

1 pod. livenessProbe: har 2 s, **ek fail = restart** (bahut log yahi likhte hain). 25 s dekha.

```
$ node tools/slowstart.js --setup <har ek>
1 pod · 25 s dekha · liveness har 2 s, ek fail = restart · CrashLoopBackOff 0, 1, 2, 4 s (asli: 10, 20, 40 s …)

setup                                  pehli baar READY   restarts   25 s par haal
liveness delay 5 s, boot 8 s           kabhi nahi          4     CrashLoopBackOff
liveness delay 10 s, boot 8 s               9.1 s          0     Running, READY
liveness delay 10 s, boot 12 s         kabhi nahi          2     Running, NOT READY
startupProbe (1 s × 30), boot 12 s         12.1 s          0     Running, READY
```

👉 **Delay 5 s, boot 8 s**: kubelet ne app ko khulne se pehle hi maar diya — baar baar. **CrashLoopBackOff**, kabhi READY nahi.
👉 **Delay 10 s**: aaj chal gaya. Par jis din boot 12 s laga (DB migration, thandi cache, bhari node) — **phir wahi loop**.
`initialDelaySeconds` ek andaaza hai, aur andaaza kabhi na kabhi galat hota hai.
👉 **startupProbe** (har 1 s, 30 baar tak = 30 s ki chhoot): jab tak app shuru na ho, liveness band. App 12 s mein khula →
**12.1 s par READY, 0 restart**. Shuru hone ke baad liveness apne tez niyam se chalta hai.

## ex4-graceful — rolling restart aur SIGTERM

3 pods, rolling restart (maxSurge 1, maxUnavailable 0), 100 req/s `/home`. Purane pod ko SIGTERM milta hai — par Service ko
khabar ~1 s der se pahunchti hai (asli cluster mein kube-proxy / Ingress / cloud LB sab ki apni der).

```
$ node tools/rollout.js
3 pods · rolling restart (maxSurge 1) · 100 req/s /home · Service ko khabar ~1 s der se

SIGTERM par app kya karta hai                 requests   fail   rollout mein laga
turant exit                                     1018     75     6.2 s
readiness 503 + 2 s drain, phir exit            1019      0     6.2 s
```

👉 **Turant exit**: pod mar gaya par Service ne ~1 s tak usi ko bheja → har deploy par **75 errors**. Din mein 10 deploy = 750.
👉 **Graceful**: SIGTERM par readiness 503 (naya traffic mat bhejo), par 2 s tak jo aaye serve karo, phir exit → **0 errors**.
Asli cluster mein iske saath `preStop: sleep 5` aur `terminationGracePeriodSeconds` bhi — taaki LB ko khabar pahunch jaaye.

## Asli cluster par (kind / minikube)

Wahi niyam YAML mein:

```yaml
startupProbe:   { httpGet: { path: /livez,  port: 8080 }, periodSeconds: 1, failureThreshold: 30 }
livenessProbe:  { httpGet: { path: /livez,  port: 8080 }, periodSeconds: 10, failureThreshold: 3 }   # shallow — DB nahi
readinessProbe: { httpGet: { path: /readyz, port: 8080 }, periodSeconds: 5, failureThreshold: 2 }    # cached
lifecycle: { preStop: { exec: { command: ["sleep", "5"] } } }
terminationGracePeriodSeconds: 30
```

## Kya seekha

| Sawaal | Jawab lab se |
|---|---|
| Liveness mein DB check? | Kabhi nahi — DB blip = saare pods restart, 5 s ki blip ~10 s ka outage |
| Readiness mein shared DB? | Saare pods ek saath NOT READY → `/home` bhi gaya (zero targets) |
| Accha design? | Probes shallow, dependency ki bimaari request mein (100% `/home`) |
| Probe ka bill? | 4 pingers × pods — deep 370/s (100 pods), cached 50/s |
| Dheema boot? | `startupProbe` — `initialDelaySeconds` ka andaaza ek din galat hoga |
| Deploy par errors? | SIGTERM par readiness 503 + drain (+ `preStop` sleep) → 75 se 0 |
