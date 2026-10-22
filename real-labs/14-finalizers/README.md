# 🧪 Lab 14 — "Terminating" mein atka hai! (finalizers)

> ⏱️ ~10 min · 📍 namespaces `lab14`, `lab14-legacy` · 🧠 Concept: **delete = do-step process** · 🧭 Decision: *finalizer kab hatana theek hai — aur kab bilkul nahi?*

## 🎯 Ek line mein

`kubectl delete` object ko turant nahi mitata — pehle `deletionTimestamp` lagta hai, phir jab tak **saare finalizers**
(cleanup ke vaade) poore na hon, object **Terminating** mein rehta hai. Vaada poora karne wala controller gayab → object hamesha atka.

## 🗺️ Mental map — delete ki asli kahani

```
kubectl delete X
   │
   ▼
deletionTimestamp set ──▶ finalizers list khaali?  ──haan──▶ object gayab ✅
                                 │ nahi
                                 ▼
                    controller apna cleanup karta hai (LB hatao, disk detach, cache flush…)
                    phir apna naam list se hataata hai ──▶ (repeat)
                    controller hi nahi hai? ──▶ ♾️ Terminating
```

| Common finalizer | Kaun hataata hai | Kya bachata hai |
|---|---|---|
| `kubernetes.io/pvc-protection` | K8s khud | Use mein lagi PVC delete na ho jaaye |
| `kubernetes.io/pv-protection` | K8s khud | Bound PV |
| `foregroundDeletion` | Garbage collector | Pehle bacche (pods), phir parent |
| `service.kubernetes.io/load-balancer-cleanup` | Cloud controller | Cloud LB ka bill/IP |
| `<company>.io/...` (CRDs, operators) | Us operator ka controller | External cheezein (DNS, buckets, DB users) |

> ⚠️ `kubectl delete ... --wait=false` bhi likhta hai **"deleted"** — par object abhi bhi hai! `kubectl get` se confirm karo.

## 🎬 Scenario

Purana `cache-controller` uninstall ho chuka hai. Ab `orders-cache` delete nahi ho raha,
aur `lab14-legacy` namespace teen din se `Terminating` mein hai.

## 🛠️ Steps

### Step 1 — Lab shuru karo aur delete karke dekho

```bash
kubectl apply -f setup.yaml
kubectl -n lab14 delete cm orders-cache --wait=false     # "deleted" bolega... 
kubectl -n lab14 get cm orders-cache                      # ...par abhi bhi hai!
kubectl delete ns lab14-legacy --wait=false
kubectl get ns lab14-legacy                               # Terminating
```

### Step 2 — Kaun rok raha hai?

```bash
kubectl -n lab14 get cm orders-cache -o jsonpath='{.metadata.deletionTimestamp}{"  "}{.metadata.finalizers}{"\n"}'
kubectl get ns lab14-legacy -o jsonpath='{range .status.conditions[*]}{.type}: {.message}{"\n"}{end}'
```

👀 **Dikhna chahiye:** `["gurukul.dev/flush-cache"]`, aur namespace ki condition:
`NamespaceFinalizersRemaining: Some content in the namespace has finalizers remaining: gurukul.dev/flush-cache in 1 resource instances`

> 🧠 Namespace khud nahi atka — uske **andar** ka koi object atka hai. Namespace ki `conditions` batati hain kaunsa.

### Step 3 — Socho, phir hatao

Controller wapas nahi aayega (uninstall ho chuka) aur "cache flush" ka koi asli asar nahi bacha → finalizer hatana theek hai:

<details><summary>💡 Command</summary>

```bash
kubectl -n lab14 patch configmap orders-cache --type=merge -p '{"metadata":{"finalizers":null}}'
kubectl -n lab14-legacy patch configmap legacy-cache --type=merge -p '{"metadata":{"finalizers":null}}'
```
</details>

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/steps.sh`

## 🧭 Decision recap — finalizer hatana: kab ✅, kab ❌

| Situation | Kya karo |
|---|---|
| Controller chal raha hai par atka hai | ❌ Finalizer mat hatao — **controller ke logs** padho, asli wajah theek karo |
| Controller uninstall ho gaya, external cleanup **manually ho chuka** | ✅ Finalizer hatao |
| Cloud LB / disk / DNS wala finalizer | ❌ Pehle cloud console mein resource check/cleanup karo — warna **orphan resource ka bill** chalta rahega |
| `pvc-protection` par atki PVC | ❌ Koi pod abhi bhi use kar raha hai — pehle woh pod hatao, finalizer khud chala jaayega |
| Namespace Terminating | Andar ka atka object dhoondo (conditions) — **namespace ke finalize API wale hacks** se bacho |

- Operator uninstall karne ka sahi order: **pehle uske CRs delete karo** (controller cleanup kar le), **phir** operator hatao.

## 🧹 Cleanup

```bash
kubectl delete ns lab14
```
