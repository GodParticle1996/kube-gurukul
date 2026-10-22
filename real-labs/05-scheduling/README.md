# 🧪 Lab 05 — Pending pods (nodeSelector · taints/tolerations · resources)

> ⏱️ ~15 min · 📍 namespace `lab05` (+ ek node par taint) · 🧠 Concept: **scheduler ke filters** · 🧭 Decision: *pod ko node par "kheenchna" hai ya node se "bhagana" hai?*

## 🎯 Ek line mein

`Pending` = scheduler ko **koi node nahi mila**. Wajah hamesha `describe pod` ke **FailedScheduling** event mein hoti hai:
`0/3 nodes are available: <har node ka reason>`. Us line ko tod ke padhna hi poora skill hai.

## 🗺️ Mental map — chumbak 🧲 aur taala 🔒

| Cheez | Kaun lagata hai | Kya karti hai | Analogy |
|---|---|---|---|
| **nodeSelector / nodeAffinity** | Pod | Pod **chunta** hai kis node par jaana hai | 🧲 chumbak — pod ko node ki taraf **kheenchta** hai |
| **taint** | Node | Node pods ko **bhagata** hai | 🔒 taala — "yahan mat aao" |
| **toleration** | Pod | Pod ke paas taale ki **chaabi** | 🔑 chaabi — andar *aa sakta* hai, par **kheenchti nahi** |
| **resources.requests** | Pod | "itni jagah reserve karo" | Node par itni jagah *khaali* honi chahiye |

> ⚠️ **Sabse bada confusion:** toleration akele pod ko tainted node par **nahi bhejti** — sirf *ijaazat* deti hai.
> Node ko kisi team ke liye **dedicated** karna hai? **Dono** chahiye: taint+toleration (doosre bahar) **aur** nodeSelector/affinity (apne andar).

> 🧠 **FailedScheduling ka chhupa niyam:** har node ka sirf **pehla** fail hua reason dikhta hai.
> Ek galti theek karo → us node ka **agla** reason dikh sakta hai. Isliye har fix ke baad event dobara padho.

## 🎬 Scenario

Platform team ne `ssd` wala node DB ke liye reserve kiya (taint). Do deploys Pending mein atke hain:
`orders-db` (sirf ssd node par chalna chahiye) aur `report-worker`.

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
./setup.sh                                     # apply + ssd node par taint
kubectl get nodes --show-labels | grep -o 'disktype=[a-z]*\|gurukul/zone=[a-z-]*'
kubectl -n lab05 get pods
```

👀 **Dikhna chahiye:** dono pods `Pending`.

### Step 2 — orders-db: FailedScheduling padho

```bash
kubectl -n lab05 describe pod -l app=orders-db | grep -A1 FailedScheduling
```

👀 **Dikhna chahiye:** `1 node(s) didn't match Pod's node affinity/selector, 1 node(s) had untolerated taint {dedicated: database}, 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }`
— har node ka alag reason. Control-plane node par taint default hota hai (wahan app pods nahi jaate).

<details><summary>💡 Hint</summary>

1. Pod `disktype: nvme` maang raha hai — kisi node par yeh label hai? (`--show-labels`)
2. Label theek karne ke baad bhi Pending → ssd node ka **taala** (`dedicated=database:NoSchedule`). Pod ko **chaabi** chahiye: `tolerations`.
</details>

### Step 3 — report-worker: kitna CPU maanga?

```bash
kubectl -n lab05 describe pod -l app=report-worker | grep -A1 FailedScheduling
kubectl describe node gurukul-worker | grep -A6 Allocatable
```

👀 **Dikhna chahiye:** `2 Insufficient cpu` — request `"500"` = 500 **poore** CPU cores! (`500m` = aadha core hota.)

<details><summary>💡 Hint</summary>

`cpu: "500"` aur `cpu: 500m` mein 1000 guna ka farak hai. Requests asli zaroorat jitni rakho (jaise `250m`) — zyada maangna "safe" nahi, **scheduling block** karta hai aur paisa jalata hai.
</details>

### Step 4 — Fix karo, `kubectl apply -f setup.yaml`

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fixed.yaml`

## 🧭 Decision recap — production mein kab kya?

| Zaroorat | Tool |
|---|---|
| "Mera pod GPU/SSD wale node par hi chale" | **nodeSelector** (simple) / **nodeAffinity** (In/NotIn, soft preferences) |
| "Is node par sirf ek team ke pods" | **taint** node par + **toleration** + **nodeSelector** pod par (teeno!) |
| "Replicas alag-alag nodes/zones par fail-safe" | **topologySpreadConstraints** (ya podAntiAffinity) |
| "Do pods hamesha saath (latency)" | **podAffinity** |
| "Node maintenance — naye pods mat bhejo" | `kubectl cordon` (andar se taint `node.kubernetes.io/unschedulable`) |
| "Critical pod ko jagah chahiye" | **PriorityClass** (preemption) |

- `requiredDuringScheduling…` = **hard** rule (na mile toh Pending). `preferredDuringScheduling…` = **soft** (koshish, na mile toh bhi chalega).
- Taint effects: `NoSchedule` (naye nahi aayenge) · `PreferNoSchedule` (koshish karo mat aao) · `NoExecute` (chal rahe bhi **nikaal** do).

## 🧹 Cleanup (zaroori — taint hatana hai!)

```bash
./cleanup.sh
```
