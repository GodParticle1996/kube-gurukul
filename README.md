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
cd kubegurukul
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
  - **helm** — asli release engine: `install/upgrade/rollback/history/get values/
    template/lint/dependency/package/push/test`, values precedence, `--atomic`
    auto-rollback, stuck `pending-upgrade` releases, dependency gating
  - **argocd** — `app list/get/diff/sync (--prune)/history/rollback/set`, `appset`,
    `proj`, sync waves, failed syncs, drift + selfHeal, aur
    `kubectl argo rollouts get/promote/abort` (canary weights live badalte hain)
  - **karpenter** — ek LIVE controller: har command ke baad reconcile hota hai —
    Pending pod → NodeClaim → EC2 → Node Ready → pod scheduled, aur khaali/kam-bhare
    nodes par consolidation (`do-not-disrupt` respect karte hue)

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

- **Progression:** XP per first-try answer, perfect bonuses, 11 Gurukul ranks
  (🐣 Pod Shishya → 👑 Kubernetes Mahaguru), per-level badges + 1–3 stars,
  har track ka certificate.

- **Progress localStorage mein save hota hai** — tab band karo, baad mein wahin se continue.
  Reset home screen se.

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
| `validate.js` | **`node validate.js`** — content + engine + simulator tests.<br>Labs ko sach mein **render** karta hai, unke goals ko **solvable saabit** karta hai (slider ka knob sweep, board ka backtracking), aur **non-Latin script leaks** pakadta hai |
| `app.js` | Screens: home, track maps, stages, interview, Dojo, pop quiz, certificates |
| `visuals.js` | 58 concept diagrams (`VISUALS[levelId]`) |
| `data-core.js` | Ranks + track definitions |
| `data-beginner.js` · `data-intermediate.js` · `data-advanced.js` · `data-helm.js` · `data-argocd.js` · `data-karpenter.js` · `data-kodekloud.js` | Level content |
| `data-gaps.js` | Gap levels jo existing tracks ke **beech** mein jaate hain (`KG.registerLevelsAfter`) — sabse aakhir mein load hoti hai |
| `gallery.html` | Saare diagrams ek page par |
