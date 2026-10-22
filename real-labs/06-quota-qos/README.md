# 🧪 Lab 06 — "Pods gayab!" (ResourceQuota · LimitRange · QoS)

> ⏱️ ~15 min · 📍 namespace `lab06` · 🧠 Concept: **namespace ka budget** · 🧭 Decision: *pod bana hi nahi — events kahan dhoondhoge?*

## 🎯 Ek line mein

`replicas: 3` likha, par `get pods` mein sirf **2**. Teesra pod Pending nahi, CrashLoop nahi — **bana hi nahi**.
Jo pod bana hi nahi, uske events pod par nahi milte — **ReplicaSet** par milte hain.

## 🗺️ Mental map — kaun kya rokta hai?

| Cheez | Level | Kya karti hai | Toot-ne par kya dikhta hai |
|---|---|---|---|
| **ResourceQuota** | Namespace ka **total budget** | Saare pods ka jod (memory/cpu/pod count) limit | `Deployment 2/3`, RS event: `exceeded quota` |
| Quota + container bina resources | Admission | Quota memory gin raha hai → har container ko request/limit **likhni padegi** | RS event: `must specify limits.memory` |
| **LimitRange** | Namespace ke **defaults** (+ min/max) | Jo container resources na likhe use default mil jaata hai | — (yeh ilaaj hai) |
| **QoS class** | Pod | requests/limits se nikalti hai → node par memory kam pade toh **kaun pehle nikle** | `kubectl get pod -o jsonpath='{.status.qosClass}'` |

### QoS — teen class, ek niyam

| Class | Kab milti hai | Node par memory ki kami mein |
|---|---|---|
| **Guaranteed** | Har container mein cpu **aur** memory: request = limit | Sabse aakhir mein nikalta hai |
| **Burstable** | Kuch requests/limits hain par Guaranteed jaisa nahi | Beech mein |
| **BestEffort** | Kuch bhi nahi likha | **Sabse pehle** nikalta hai |

## 🎬 Scenario

Team "reports" ka on-call: *"Deploy toh 'successful' bola, par 3 mein se 1 worker gayab hai, aur cache ka toh pod hi nahi!"*

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
kubectl -n lab06 get deploy,pods
```

👀 **Dikhna chahiye:** `reports 2/3`, `cache 0/1`, aur sirf 2 pods. Koi Pending pod **nahi**.

### Step 2 — Pod nahi hai, toh events kahan?

```bash
kubectl -n lab06 describe rs -l app=reports | tail -5
kubectl -n lab06 describe quota team-budget
```

👀 **Dikhna chahiye:**
`exceeded quota: team-budget, requested: limits.memory=192Mi..., used: limits.memory=384Mi, limited: limits.memory=512Mi`
→ 2 × 192 = 384; teesra aaye toh 576 > 512.

### Step 3 — cache kyun nahi bana?

```bash
kubectl -n lab06 describe rs -l app=cache | tail -3
```

👀 **Dikhna chahiye:** `failed quota: team-budget: must specify limits.memory for: cache; requests.memory for: cache`

<details><summary>💡 Hint</summary>

Do raaste: (a) `cache` ke YAML mein resources likho, ya (b) namespace ko **defaults** do taaki aage koi bhi bhoole toh bhi chale —
`kind: LimitRange` (type `Container`, `default` + `defaultRequest`). Is lab mein (b) karo.
Aur reports ko sach mein 192Mi chahiye (naapa hua) — toh budget (quota) badhana justified hai: 3×192 + 64 = 640Mi → margin ke saath 768Mi.
</details>

### Step 4 — Fix apply karo, 1-2 minute ruko

```bash
kubectl -n lab06 get deploy -w
```

> ⏳ Gayab pod **turant** nahi aata: ReplicaSet controller fail hone ke baad **backoff** ke saath retry karta hai (yahan ~1-2 min laga).

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fixes.yaml`

## 🧭 Decision recap — production mein kab kya?

- **Budget kam pad raha hai?** Pehle **right-size** karo (asli usage naapo), phir quota badhwao. Quota badhana budget ka faisla hai, debugging ka nahi.
- ⚠️ **Rollout + tight quota = deadlock:** RollingUpdate ko **surge** (extra pod) ki jagah chahiye. Quota bilkul bhara ho toh naya pod nahi banta, purana hat nahi sakta → rollout **hamesha ke liye atka**. Quota mein surge jitni headroom rakho (ya `maxSurge: 0, maxUnavailable: 1`).
- **LimitRange defaults** har multi-team namespace mein lagao — "kisi ne resources nahi likhe" wali problem khatam.
- **QoS:** critical services → Guaranteed (memory request = limit). Batch/best-effort kaam → Burstable/BestEffort chalega.

## 🧹 Cleanup

```bash
kubectl delete ns lab06
```
