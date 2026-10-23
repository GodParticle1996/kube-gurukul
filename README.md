# 🛕 KubeGurukul

**Kubernetes seekho, khel khel mein — Hinglish mein, hands-on, beginner se senior tak.**

Ek interactive, gamified learning app (netbird-academy ka sibling). Pure HTML/CSS/JS —
no build, no dependencies, sab kuch browser mein.

## Run it

```bash
# Option 1: bas file kholo (sab local hai)
explorer.exe index.html        # WSL se
# ya Windows Explorer mein index.html double-click

# Option 2: serve karo
cd kube-gurukul
python3 -m http.server 8000
# → http://localhost:8000
```

Diagram gallery: [`gallery.html`](gallery.html) — saare 58 concept visuals ek page par.

Content add karne ke baad: **`node validate.js`** chalao (structure + engine + simulators sab check hote hain).

## Kya hai isme

- **7 tracks, 58 levels** — har track ka boss level + certificate:
  - 🌱 **Beginner (8):** Docker→K8s, Control Plane (API Server/etcd/Scheduler/Controller
    Manager), Worker Nodes (kubelet/kube-proxy), Pods, Deployments, Services,
    ConfigMaps/Secrets/Namespaces, Boss: Pehla Deploy
  - 🔥 **Intermediate (10):** Scheduler+Requests/Limits+QoS+OOMKilled, Probes,
    StatefulSets/DaemonSets/Jobs, Storage (PV/PVC/StorageClass), Affinity+Taints,
    **PriorityClass/Preemption/Static Pods** (+ QoS slider lab),
    Ingress+Gateway API, NetworkPolicies, Autoscaling (HPA/CA/Karpenter), Boss: Outage Night
  - 🚀 **Advanced (10):** RBAC, Pod Security Admission,
    **Admission Control** (mutating vs validating, Kyverno/CEL, + request-path flow lab),
    Secrets Mgmt (Vault/ESO), Observability (Prometheus/Grafana/logs), Helm+Kustomize,
    CRDs+Operators, GitOps (ArgoCD), Service Mesh (Istio), Final Boss: Senior Gauntlet
  - ⛵ **Helm Gurukul (7)** — *hamesha unlocked, kabhi bhi khelo:* pehla release,
    chart anatomy, templating jaadu (Go templates), values precedence, dependencies &
    umbrella charts, hooks/tests/stuck-releases, Boss: publish (OCI) + GitOps + secrets

  - 🔄 **ArgoCD Gurukul (6)** — *hamesha unlocked:* pehla Application (sync vs health),
    sync policies (prune/selfHeal/ignoreDifferences), sync waves & hooks, App-of-Apps +
    ApplicationSets + Projects, **Argo Rollouts** (canary/blue-green + analysis),
    Boss: GitOps war room
  - 🌲 **Karpenter Gurukul (3)** — *hamesha unlocked, AWS/EKS flavoured:* NodePool +
    EC2NodeClass + just-in-time provisioning, consolidation/spot/disruption budgets/drift,
    Boss: pending pods + bill shock

  - 🩺 **KodeKloud Gurukul (14)** — *hamesha unlocked, poora scenario-first:*
    diagnostic toolkit, ImagePullBackOff ke 5 roop, CrashLoopBackOff ke exit codes,
    container lifecycle errors, Pending pods (**scheduler board lab**), gayab pods
    (quota/LimitRange), Schrodinger's Deployment (overlapping selectors), stale config +
    `enableServiceLinks`, stuck `Terminating` + finalizers + Multi-Attach, packet ka safar
    (CNI → kube-proxy → CoreDNS), cluster maintenance (**PDB slider lab** + etcd restore),
    certificates & kubeconfig, CKS hardening, Boss: teen bimari ek cluster

  Beginner → Intermediate → Advanced sequential unlock hote hain; **Helm, ArgoCD,
  Karpenter aur KodeKloud tracks shuru se hi khule hain** (jab chaaho khelo).

- **Har level mein:**
  - 🎯 Learning objectives (intro par) + ✔ success criteria (completion par)
  - 📖 Bite-sized Hinglish lessons + ⚡ real production-incident war stories
  - 📊 Signature animated diagram (HTML/CSS, no images)
  - 🎮 2–4 interactive challenges + 🎁 bonus rounds
  - 🎤 **Interview Round** — asli interview-style sawal (MCQ + hands-on)
  - 🏋️ Optional **real-cluster homework** (minikube/kind ke liye)
  - 🧘 Flashcards jo Revision Dojo mein jaate hain

- **Game types (9):** 🗂️ sorting bins · 🔢 sequence builder · 🔗 matching ·
  🧠 scenario quizzes · 📄 YAML fill-in-the-blanks · 🎯 diagram hotspots ·
  🚨 3AM-pager incident decision-trees · 🧩 **chart workbench** (values + template
  side-by-side — batao Helm kya render karega) · 🖥️ **terminal simulator**:
  - **kubectl** — CrashLoopBackOff, OOMKilled, no-endpoints, RBAC Forbidden, drift…
  - **helm** — Helm 4 flavoured release simulator: `install/upgrade/rollback/history/get values/
    template/lint/dependency/package/push/test`, values precedence, `--rollback-on-failure`
    auto-rollback, `--force-replace`, stuck `pending-upgrade` releases, dependency gating.
    Purane `--atomic` / `--force` flags warning ke saath chalte hain; `--recreate-pods` hata hai
  - **argocd** — `app list/get/diff/sync (--prune)/history/rollback/set`, `appset`,
    `proj`, sync waves, failed syncs, drift + selfHeal, aur
    `kubectl argo rollouts get/promote/abort` (canary weights live badalte hain)
  - **karpenter** — browser mein controller simulation: har command ke baad reconcile hota hai —
    Pending pod → NodeClaim → EC2 → Node Ready → pod scheduled, aur khaali/kam-bhare
    nodes par consolidation (`do-not-disrupt` respect karte hue). CPU/memory/GPU fit,
    requirements, weighted NodePool fallback aur configurable launch/consolidation delay
    decisions ko visible banate hain. Ticks commands hain; EC2 timing/prices illustrative hain

- **🧭 Decision Dojo — 15 trees, 93 practice scenarios:** sawal → wajah → recommendation;
  saath mein poora map, X vs Y table, production gotchas, YAML aur related levels/labs.
  Topic practice ya 8-scenario mixed round khelo; galat jawab Revision Dojo card banta hai

- **🧪 Real Cluster Labs — 15 folders** in [`real-labs/`](real-labs/README.md): broken scenario,
  expected output, hints, `verify.sh`, `solution/` aur cleanup. Docker + kind/minikube +
  kubectl chahiye; Helm lab ke liye Helm bhi. Browser commands dikhata hai; commands tumhare
  terminal par chalte hain. App ka "ho gaya" button self-mark hai; cluster checks `./verify.sh`
  karta hai. Lab README ka kind v1.32 verification pehle ka recorded result hai;
  `node validate.js` real cluster ya current machine par lab execution verify nahi karta

- **Interactive labs (4)** — `labs.js`. Inme "sahi option yaad karo" nahi hai;
  inme tum kuch **chalate** ho aur simulator naya number ya naya output deta hai:
  - 🩺 **Triage terminal** (KodeKloud style) — symptom milta hai, command palette milti hai.
    Tum decide karte ho AGLA command kaunsa chale; har command apna asli output ugalti hai.
    Kuch commands clue dete hain, kuch dead-end hain. Saare clue milne par root cause poocha jaata hai
  - 🎚️ **Slider lab** — knob ghumao, number **khud** badalta hai. PDB ka drain-time ganit,
    QoS class + `oom_score_adj` + eviction order. Numbers compute hote hain, hardcode nahi
  - 🎬 **Flow player** — packet ka safar, container ke chaar padav, ya API request ka raasta —
    ek-ek kadam, play/pause, aur beech mein sawaal jinka jawab diye bina flow aage nahi badhta
  - 🧲 **Scheduler board** — pod chuno, har node turant ✅/❌ aur asli `FailedScheduling` wajah
    dikha deta hai. Asli predicates: nodeSelector → taints → podAntiAffinity → capacity

- **Bhoolne ka ilaaj (retention system):**
  - 🧘 **Revision Dojo** — spaced-repetition flashcards (1→3→7→16→35 din intervals);
    complete kiye levels ke concepts + tumhari galtiyan cards ban ke wapas aati hain
  - 🎲 **Surprise Pop Quiz** — naye level se pehle purane concepts ka random quick-check
  - 🔥 **Daily Streak** — roz khelo, flame badhao

- **Progression:** XP per first-try answer, perfect bonuses, 13 Gurukul ranks
  (🐣 Pod Shishya → 👑 Kubernetes Mahaguru), per-level badges + 1–3 stars,
  har track ka certificate.

- **Resume-anywhere:** localStorage mein challenge ke shuru/khatam ka checkpoint aur score
  save hota hai; Home se continue karo. Adhoore challenge ka terminal/board state dobara
  shuru hota hai. Progress isi browser/origin mein rehta hai; reset Home se
- **⚡ Mood picker:** ~5 min → due flashcards, warna mixed decision practice;
  15–20 min → saved challenge, warna agla unlocked level; 45 min+ → agla unfinished Real Lab.
  Time labels planning estimates hain

Terminal mission authors ke liye: `solution: ['cmd', ...]` automated replay ka proof hai
(win aakhri command par); `.sh` fixes `bash fix.sh` se, YAML fixes `kubectl apply -f` se.
`cluster.apiError` API outage simulate karta hai; chart ka `renderError` template/install/upgrade
fail karata hai. Puri contract aur examples [`EXTENDING.md`](EXTENDING.md) mein hain.

Developer tools:

```bash
node tools/replay-missions.js list
node tools/replay-missions.js info karpenterboss
node tools/replay-missions.js run
node tools/replay-missions.js run "" 'karpenterboss|t0' # ek mission ka transcript
node tools/mcq-bias.js
node tools/mcq-bias.js list beginner
```

## App extend karna (naya concept aaya?)

Yeh app ever-extending design ki hai — naya level/track/game/card add karna sirf
data files ka kaam hai, engine ko chhoona nahi padta.
Poora guide: [`EXTENDING.md`](EXTENDING.md)

## Files

| File | Kya hai |
|------|---------|
| `core.js` | State, XP, ranks, streak, spaced-repetition engine, level registry |
| `games.js` | Game renderers (bins/order/match/quiz/fill/hotspot/incident/render) |
| `labs.js` | **Interactive labs** — triage · slider · flow player · scheduler board (+ `KG.allOf`) |
| `terminal.js` | kubectl simulator (mock cluster + command parser) |
| `helmsim.js` | helm simulator (releases, revisions, values merge, lifecycle) |
| `argosim.js` | argocd simulator (Applications, sync/health, waves, prune, Rollouts) |
| `karpentersim.js` | Karpenter controller sim (provisioning, consolidation, cost) |
| `decisions.js` · `data-decisions.js` | Decision trees, comparison tables, scenario practice + related content |
| `reallabs.js` · `real-labs/` | Browser catalogue + real-cluster README/setup/verify/solution files |
| `tools/replay-missions.js` · `tools/mcq-bias.js` | Mission transcripts + solution checks; answer-length bias report |
| `validate.js` | **`node validate.js`** — content + engine + simulator tests.<br>Labs ko sach mein **render** karta hai, unke goals ko **solvable saabit** karta hai (slider ka knob sweep, board ka backtracking), aur **non-Latin script leaks** pakadta hai |
| `app.js` | Screens: home + mood/resume, track maps, stages, interview, Revision Dojo, pop quiz, certificates |
| `visuals.js` | 58 concept diagrams (`VISUALS[levelId]`) |
| `data-core.js` | Ranks + track definitions |
| `data-beginner.js` · `data-intermediate.js` · `data-advanced.js` · `data-helm.js` · `data-argocd.js` · `data-karpenter.js` · `data-kodekloud.js` | Level content |
| `data-gaps.js` | Gap levels jo existing tracks ke **beech** mein jaate hain (`KG.registerLevelsAfter`) — sabse aakhir mein load hoti hai |
| `gallery.html` | Saare diagrams ek page par |
