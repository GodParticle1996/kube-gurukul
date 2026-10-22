# 🧪 Lab 10 — HPA: load badhe toh pods badhein (aur `<unknown>` kyun?)

> ⏱️ ~15 min · 📍 namespace `lab10` · 🧠 Concept: **utilization = usage ÷ request** · 🧭 Decision: *HPA, VPA, KEDA ya node autoscaler?*

## 🎯 Ek line mein

HPA har ~15s poochta hai: *"pods apni **request** ka kitna % CPU kha rahe hain?"* aur replicas ko target ke paas laata hai.
Request hi nahi likhi → % nikal hi nahi sakta → `TARGETS: <unknown>` → HPA **andha**.

## 🗺️ Mental map — HPA ka formula (yaad rakhne layak ek hi line)

```
desiredReplicas = ceil( currentReplicas × currentUtilization ÷ targetUtilization )
   example:        ceil( 2 × 90% ÷ 50% ) = ceil(3.6) = 4
```

| Kya chahiye | Kyun |
|---|---|
| **metrics-server** | CPU/memory usage ka data yahi deta hai (`kubectl top`) |
| Container mein **`resources.requests.cpu`** | Utilization = usage ÷ **request** |
| `minReplicas` / `maxReplicas` | Neeche ki suraksha + upar ka budget |
| `behavior.scaleDown.stabilizationWindowSeconds` | Default **300s** — load girte hi turant pods nahi hatate (flapping se bachav) |

## 🎬 Scenario

Sale ka din. Team ne HPA "laga diya" — par traffic aane par bhi 1 hi pod. `kubectl get hpa` → `cpu: <unknown>/50%`.

## 🛠️ Steps

### Step 0 — metrics-server hai?

```bash
kubectl top nodes        # error: Metrics API not available → ../setup.sh metrics (1-2 min ruko)
```

### Step 1 — Lab shuru karo, HPA ki aankhein dekho

```bash
kubectl apply -f setup.yaml
sleep 45; kubectl -n lab10 get hpa
kubectl -n lab10 describe hpa cpu-api | grep -i -A2 "ScalingActive"
```

👀 **Dikhna chahiye:** `cpu: <unknown>/50%` aur
`failed to get cpu utilization: missing request for cpu in container api of Pod cpu-api-...`

<details><summary>💡 Hint</summary>

`cpu-api` ke container mein sirf `limits.memory` hai — `requests` hai hi nahi. `requests.cpu: 100m` (aur memory request) jodo, apply karo.
</details>

### Step 2 — Fix ke baad ~1 min: asli % dikha?

```bash
kubectl -n lab10 get hpa          # cpu: 0%/50% jaisa
```

### Step 3 — Load chalao, HPA ko kaam karte dekho 🔥

```bash
kubectl -n lab10 scale deploy/loadgen --replicas=2
kubectl -n lab10 get hpa -w        # 1-2 min: TARGETS 1000%+ → REPLICAS 1 → 4 → 5
```

👀 **Dikhna chahiye:** utilization bahut upar (yeh app har request par CPU jalata hai) aur REPLICAS `maxReplicas` (5) tak.

### Step 4 — Load band karo, scale-down dekho

```bash
kubectl -n lab10 scale deploy/loadgen --replicas=0
kubectl -n lab10 get hpa -w        # ~1 min stabilization ke baad wapas 1
```

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fix.sh`

## 🧭 Decision recap — kaunsa autoscaler kab?

| Problem | Tool | Kya scale karta hai |
|---|---|---|
| Load ke saath **zyada pods** (stateless web/API) | **HPA** (CPU/memory/custom metrics) | Replicas |
| Pods ka **size** galat (requests guesswork) | **VPA** (recommend mode se shuru karo) | Requests/limits |
| Queue/Kafka lag/cron jaisi **event** se scale, 0 tak bhi | **KEDA** | Replicas (0 ↔ N) |
| Pods **Pending** — nodes kam pad gaye | **Cluster Autoscaler** / **Karpenter** | Nodes |

- ⚠️ **HPA + VPA dono CPU par** ek hi Deployment ke liye = dono aapas mein ladenge. Ek hi metric par ek hi autoscaler.
- ⚠️ **GitOps + HPA:** Deployment YAML mein `replicas: 3` likha hai aur HPA ne 7 kiye → ArgoCD/Flux har sync par wapas 3 kar dega.
  HPA wale Deployment ke manifest se **`replicas` hata do** (ya ArgoCD `ignoreDifferences`).
- HPA "kitna jaldi" scale kare → `behavior` (scaleUp/scaleDown policies). Scale-down hamesha dheere rakho.

## 🧹 Cleanup

```bash
kubectl delete ns lab10
```
