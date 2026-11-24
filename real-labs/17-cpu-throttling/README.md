# 🧪 Lab 17 — CPU throttling: "CPU sirf 200m, phir bhi app dheema kyun?"

> ⏱️ ~15 min · 📍 namespace `lab17` · 🧠 Concept: **CPU limit = kernel ka brake** · 🧭 Decision: *CPU limit lagana hai, badhana hai, ya hatana hai?*

> ✅ **Test hua (2026-11-24):** asli 3-node **kind** cluster par chala kar — kind v0.33.0, Kubernetes v1.37.0, kubectl v1.37.2, Docker 29.1.3.
> Us machine par batch fix se pehle ~6000 ms aur fix ke baad ~1230 ms tha (`nr_throttled` 10 s mein ~100 → 0).
> Tumhare "ms" wale number alag honge — dekhna yeh hai ki fix ke **pehle** aur **baad** mein kitna fark aata hai.

## 🎯 Ek line mein

**CPU limit paar karne par container marta nahi — ruk jaata hai.** Kernel use har 100 ms mein thodi der chalata hai, phir rok deta hai.
App crash nahi hota, error nahi aata. Bas **dheema** ho jaata hai. Isliye yeh bug pakadna mushkil hai.

## 🗺️ Mental map — misaal: toll naka

Socho `fraud-check` ek truck hai. CPU limit ek toll naka hai jo har **100 ms** mein khulta hai.

| Limit | Kernel ka niyam | Agar kaam ko 1 poora core chahiye |
|---|---|---|
| `cpu: 200m` | Har 100 ms mein sirf **20 ms** chalo, baaki 80 ms ruko | Kaam **~5 guna** dheema |
| `cpu: 1500m` | Har 100 ms mein 150 ms tak chalo | Kabhi nahi rukta |
| koi limit nahi | Koi naka nahi | Kabhi nahi rukta |

Teen file, teen naam (container ke andar):

| File | Kya batati hai |
|---|---|
| `/sys/fs/cgroup/cpu.max` | Naka ka niyam: `20000 100000` = 100000 µs (100 ms) mein 20000 µs (20 ms) |
| `/sys/fs/cgroup/cpu.stat` → `nr_periods` | Ab tak kitne 100 ms ke daur beete |
| `/sys/fs/cgroup/cpu.stat` → `nr_throttled` | Unme se kitne daur mein container **roka gaya** |

**Memory alag hai:** memory limit paar → container **maara jaata hai** (OOMKilled, Lab 01). CPU limit paar → sirf **dheema**.

## 🎬 Scenario

ChaiPay ka `fraud-check` har payment par 10 lakh chhoti jaanch karta hai. Team ki shikayat: **"fraud-check bahut dheema hai."**

Dashboard dekhne wala kehta hai: *"CPU toh sirf 200m use ho raha hai. Node bhi khaali hai. CPU ki dikkat nahi ho sakti."* — Yahi jaal hai.

## 🛠️ Steps

### Step 1 — Lab shuru karo, dheemapan dekho

```bash
kubectl apply -f setup.yaml
kubectl -n lab17 rollout status deploy/fraud-check
```

20 second ruko, phir:

```bash
kubectl -n lab17 logs deploy/fraud-check --tail=3
```

👀 **Dikhna chahiye:** `fraud-check: 10 lakh jaanch ka batch 4000 ms mein poora` jaisi lines.
Number likh lo (tumhara number alag hoga). Yeh **fix se pehle** ka samay hai.

### Step 2 — Jaal: `kubectl top` kya kehta hai?

```bash
kubectl top pod -n lab17
```

👀 **Dikhna chahiye:** `CPU(cores)` mein lagbhag **200m**.

> `error: Metrics API not available` ya `metrics not available yet`? 1 minute ruko. Phir bhi na aaye: `../setup.sh metrics`.

Dhyan do: 200m **kam use** nahi hai. 200m **limit** hai. `fraud-check` limit se chipka hua hai.
**Usage = limit** dikhe toh shak karo: container roka ja raha hai.

### Step 3 — Naka ka niyam padho

```bash
kubectl -n lab17 exec deploy/fraud-check -- cat /sys/fs/cgroup/cpu.max
```

👀 **Dikhna chahiye:** `20000 100000`

Matlab: har 100000 µs (100 ms) mein sirf 20000 µs (20 ms) CPU. Yahi `limits.cpu: 200m` hai.

<details><summary>💡 "No such file or directory" aaya?</summary>

Tumhara Docker purane **cgroup v1** par hai. Wahan raaste alag hain:

```bash
kubectl -n lab17 exec deploy/fraud-check -- cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us     # 20000
kubectl -n lab17 exec deploy/fraud-check -- cat /sys/fs/cgroup/cpu/cpu.stat
```

Aage jahan `/sys/fs/cgroup/cpu.stat` likha hai, wahan `/sys/fs/cgroup/cpu/cpu.stat` use karo.
</details>

### Step 4 — Saboot: container kitni baar roka gaya?

Yeh command **do baar** chalao, beech mein 10 second ruko:

```bash
kubectl -n lab17 exec deploy/fraud-check -- cat /sys/fs/cgroup/cpu.stat
```

👀 **Dikhna chahiye:** `nr_periods` aur `nr_throttled` dono. 10 second mein dono lagbhag **100** badhte hain.

Matlab: 10 second = 100 daur. Lagbhag **har daur** mein `fraud-check` roka gaya. Yahi dheemapan ki wajah hai.

### Step 5 — Fix karo

`fraud-check` ko 1 poora core chahiye. Do cheezein theek karni hain:

1. **CPU limit**: 200m → 1500m (ya limit hata do).
2. **CPU request**: 100m → 1. Request sach bole: `fraud-check` sach mein ~1 core leta hai.

```bash
kubectl -n lab17 set resources deploy/fraud-check --requests=cpu=1 --limits=cpu=1500m
kubectl -n lab17 rollout status deploy/fraud-check
```

<details><summary>💡 Pod <code>Pending</code> ho gaya?</summary>

Tumhare Docker ke paas kam CPU hai, toh `cpu: 1` ki request kisi node par fit nahi hui. Request chhoti karo:

```bash
kubectl -n lab17 set resources deploy/fraud-check --requests=cpu=500m --limits=cpu=1500m
```
</details>

<details><summary>💡 Limit poori tarah hatani hai?</summary>

```bash
kubectl -n lab17 patch deploy fraud-check --patch-file solution/fraud-check-resources.yaml
```

Us file mein `cpu: null` likha hai. `null` ka matlab: yeh field hata do.
</details>

### Step 6 — Fark dekho

20 second ruko, phir:

```bash
kubectl -n lab17 logs deploy/fraud-check --tail=3
kubectl -n lab17 exec deploy/fraud-check -- cat /sys/fs/cgroup/cpu.max
kubectl -n lab17 exec deploy/fraud-check -- cat /sys/fs/cgroup/cpu.stat
```

👀 **Dikhna chahiye:**
- Batch ka samay Step 1 ke number se **kaafi kam** (lagbhag 5 guna).
- `cpu.max` = `150000 100000` (limit hatayi ho toh `max 100000`).
- `nr_throttled` = `0`, aur dobara chalane par bhi badhta nahi.

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fraud-check-resources.yaml`

## 🧭 Decision recap — CPU limit ka kya karein?

| Haalat | Faisla |
|---|---|
| Latency wala app (API, payment) | CPU **request** = asli zaroorat. CPU **limit** hatao, ya kaafi upar rakho |
| Batch job jo padosi ka CPU kha sakta hai, aur team ka niyam "limit zaroori" hai | Limit rakho, par peak se upar |
| Memory | Limit **hamesha** lagao. Behtar: memory request = memory limit |

- **Request se suraksha milti hai, limit se nahi.** Node par bheed ho toh kernel CPU ko requests ke anupaat mein baantta hai. Sahi request wala pod apna hissa pa leta hai.
- **`kubectl top` throttling nahi dikhata.** Production mein Prometheus ke do metric dekho:
  `container_cpu_cfs_throttled_periods_total` ÷ `container_cpu_cfs_periods_total`. 25% se upar = jaanch karo.
- **Node khaali hone se farak nahi padta.** Limit container ka apna naka hai. Node par 10 core khaali hon, tab bhi 200m wala container rukta hai.
- **Kai thread wale app (Java, Go) aur jaldi rukte hain.** 4 thread saath chalein toh 20 ms ka kota 5 ms mein khatam.
- Interview line: *"CPU compressible hai — limit par throttle hota hai. Memory incompressible hai — limit par OOMKill hota hai."*

## 🧹 Cleanup

```bash
kubectl delete ns lab17
```
