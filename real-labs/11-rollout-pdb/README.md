# 🧪 Lab 11 — Safe changes: rollout · rollback · PDB · node drain

> ⏱️ ~20 min · 📍 namespace `lab11` (+ ek node drain/uncordon) · 🧠 Concept: **voluntary disruption ka budget** · 🧭 Decision: *minAvailable ya maxUnavailable? maxSurge/maxUnavailable kitna?*

## 🎯 Ek line mein

**PDB** kehta hai *"maintenance (drain/upgrade) ke time ek saath kitne pods ja sakte hain"*.
**RollingUpdate** kehta hai *"naya version laate waqt ek saath kitne pods kam/zyada ho sakte hain"*.
Dono galat set hon toh ya toh **maintenance atak jaati hai**, ya **deploy outage ban jaata hai**.

## 🗺️ Mental map

### PDB — ALLOWED DISRUPTIONS hi sab kuch hai

| PDB | replicas | ALLOWED DISRUPTIONS | Drain ka kya hoga |
|---|---|---|---|
| `minAvailable: 2` | 2 | **0** | ⛔ hamesha atkega (`Cannot evict pod as it would violate the pod's disruption budget`) |
| `minAvailable: 2` | 3 | 1 | ✅ ek-ek karke |
| `maxUnavailable: 1` | koi bhi | 1 | ✅ replicas badlo toh bhi theek — **recommended** |

> 🧠 PDB sirf **voluntary** disruptions (drain, eviction API, cluster upgrade) ko rokta hai. Node crash ya OOM ko nahi.

### RollingUpdate — do knobs

| Setting | Matlab | Effect |
|---|---|---|
| `maxUnavailable: 0` | Naya pod READY hone se pehle ek bhi purana nahi hatega | Kharab version aaye toh bhi **purane pods serve karte rahenge** ✅ |
| `maxSurge: 1` | Ek extra pod tak ban sakta hai | Thodi extra capacity chahiye (quota/node) |
| `progressDeadlineSeconds` | Itni der mein progress nahi → `ProgressDeadlineExceeded` | CI/CD isse "deploy fail" pakadta hai (`rollout status` non-zero exit) |

## 🎬 Scenario

**Part A:** Platform team ko node patch karna hai. `kubectl drain` ghanton se atka hai.
**Part B:** Kisi ne galat image tag deploy kiya. Kya website gir gayi? (Spoiler: setting sahi ho toh nahi.)

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
kubectl -n lab11 get pods -o wide        # 2 pods, alag nodes par (topologySpreadConstraints)
kubectl -n lab11 get pdb                  # ALLOWED DISRUPTIONS = ?
```

### Part A — Drain karke dekho

```bash
NODE=$(kubectl -n lab11 get pods -l app=checkout -o jsonpath='{.items[0].spec.nodeName}')
kubectl drain $NODE --ignore-daemonsets --delete-emptydir-data --timeout=30s
```

👀 **Dikhna chahiye:** baar-baar
`Cannot evict pod as it would violate the pod's disruption budget.` → `global timeout reached`.
Node ab **cordoned** hai (`SchedulingDisabled`) — `kubectl uncordon $NODE` karna mat bhoolna!

<details><summary>💡 Hint</summary>

`minAvailable: 2` aur replicas 2 → ek bhi pod nahi ja sakta. Do kaam: replicas **3** karo, aur PDB ko `maxUnavailable: 1` banao.
Phir drain dobara → pods doosre node par shift → `node drained` → `kubectl uncordon $NODE`.
</details>

### Part B — Kharab rollout

```bash
kubectl -n lab11 set image deploy/checkout web=busybox:1.36-galat
kubectl -n lab11 rollout status deploy/checkout --timeout=75s     # atkega
kubectl -n lab11 get pods                                          # purane 3 Running ✅, naya ImagePullBackOff
kubectl -n lab11 rollout history deploy/checkout
kubectl -n lab11 rollout undo deploy/checkout
```

👀 **Dikhna chahiye:** `error: deployment "checkout" exceeded its progress deadline` — par purane pods **chal rahe** the
(`maxUnavailable: 0` ki wajah se). `undo` ke baad naya revision banta hai jo purane jaisa hai.

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/steps.sh` + `solution/fixed.yaml`

## 🧭 Decision recap — production mein kab kya?

- **PDB har important Deployment par** — par `maxUnavailable: 1` (ya %) use karo. `minAvailable = replicas` = maintenance blocker.
- **Single-replica app + PDB** = drain kabhi nahi hoga. Ya 2+ replicas, ya PDB mat lagao (aur downtime accept karo).
- **Rollout:** user-facing → `maxUnavailable: 0, maxSurge: 1` (ya 25%). Quota/node tight hai → `maxSurge: 0, maxUnavailable: 1`.
- **Rollback ka asli tareeka GitOps mein:** `git revert` (warna ArgoCD/Flux wapas galat version la dega). `rollout undo` = emergency button.
- Bade/risky changes → canary/blue-green (Argo Rollouts) + automated analysis.

## 🧹 Cleanup

```bash
kubectl delete ns lab11
kubectl get nodes          # koi SchedulingDisabled? → kubectl uncordon <node>
```
