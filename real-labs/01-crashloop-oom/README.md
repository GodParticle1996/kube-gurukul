# 🧪 Lab 01 — CrashLoopBackOff + OOMKilled (exit codes ki kahani)

> ⏱️ ~15 min · 📍 namespace `lab01` · 🧠 Concept: **exit code + Reason** · 🧭 Decision: *pod crash ho raha hai — pehla command kaunsa?*

## 🎯 Ek line mein

`STATUS: CrashLoopBackOff` sirf itna batata hai ki **container baar-baar mar raha hai**.
**Kyun** mar raha hai — woh **Exit Code + Reason** batate hain. Unhe padhna seekh lo, aadha debugging khatam.

## 🗺️ Mental map — exit code dekho, command chuno

| Exit code / Reason | Matlab (seedhi bhasha mein) | Pehla command |
|---|---|---|
| `1` (ya koi chhota number), Reason `Error` | **App ne khud** error se exit kiya | `kubectl logs <pod> --previous` |
| `137`, Reason **`OOMKilled`** | Memory **limit** cross hui → kernel ne SIGKILL maara | `kubectl describe pod` → limits vs asli usage |
| `137`, Reason `Error` | Kisi ne SIGKILL bheja — aksar **liveness probe** fail | `describe` → Events: `Liveness probe failed` |
| `143` | SIGTERM — graceful shutdown (rollout / delete) | normal hai, agar deploy chal raha tha |
| `126` / `127` | Command executable nahi / mila hi nahi | image, `command`, `args` check karo |
| `0` + CrashLoopBackOff | Process "kaam khatam" karke nikal gaya — par Deployment chahta hai ki **hamesha** chale | Kya yeh **Job** hona chahiye tha? |

> 🧠 **`--previous` kyun?** CrashLoop mein abhi wala container shayad abhi-abhi start hua hai (khaali logs).
> Jo container **mara** tha, uske logs `--previous` se milte hain.

## 🎬 Scenario

Raat ke 2 baje deploy hua `orders-api`. Pager bola: *"orders-api 0/2 ready, restarts badh rahe hain"*.
Is lab ki `setup.yaml` mein **2 galtiyan** chhupi hain — ek ke theek hote hi doosri dikhegi (asli zindagi jaisa 😅).

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
kubectl -n lab01 get pods -w        # 20-30 sec dekho, phir Ctrl+C
```

👀 **Dikhna chahiye:** `STATUS` → `Error` → `CrashLoopBackOff`, aur `RESTARTS` badhta hua.

### Step 2 — App ne marte waqt kya bola?

```bash
POD=$(kubectl -n lab01 get pods -o name | head -1)
kubectl -n lab01 logs $POD --previous
kubectl -n lab01 describe $POD | grep -A4 "Last State"
```

👀 **Dikhna chahiye:** ek `FATAL` line, aur `Last State: Terminated · Reason: Error · Exit Code: 1`.
Exit code **1** = app ne khud exit kiya → jawab **logs** mein hai.

<details><summary>💡 Hint (galti #1)</summary>

App `DB_URL` naam ka env var dhoondhta hai. `setup.yaml` mein Deployment ke `env:` dekho — kis **naam** se diya hai?
ConfigMap mein data sahi hai; galti env var ke **naam** mein hai.
</details>

### Step 3 — Fix #1 lagao, phir dobara dekho

`setup.yaml` mein env var ka naam theek karo → `kubectl apply -f setup.yaml` → phir:

```bash
kubectl -n lab01 get pods -w
kubectl -n lab01 describe pod <naya-pod> | grep -A4 "Last State"
```

👀 **Dikhna chahiye:** naya twist — `Reason: OOMKilled · Exit Code: 137`. Logs mein
`cache warm-up...` ke baad kuch nahi (process beech mein hi maara gaya).

<details><summary>💡 Hint (galti #2)</summary>

App startup par ~80MB cache memory mein bharta hai. Asli **peak** usage ~170Mi tak jaata hai
(shell double-buffer karta hai). Limit **64Mi** hai. Limit = peak + margin hona chahiye.
`kubectl top` yeh spike nahi pakdega — metrics-server har ~15s par ek **snapshot** leta hai; do snapshots ke beech aaya-gaya spike dikhta hi nahi.
</details>

### Step 4 — Fix #2 lagao

Memory `limits` (aur `requests`) badhao → apply → `kubectl -n lab01 rollout status deploy/orders-api`.

## ✅ Verify

```bash
./verify.sh
```

Har ❌ ke saath ek **hint** aata hai (jawab nahi). Phas gaye? → `solution/fixed-deployment.yaml`

## 🧭 Decision recap — production mein kab kya?

- **Memory limit kitni?** → *peak* ke hisaab se, average ke nahi. Startup spikes (JVM, cache warm-up, migrations) sabse bade hote hain.
- **Memory: request = limit** → node par "promise" aur "maximum" same. Kam request + zyada limit = node overcommit → poore node par OOM ka risk.
- **CPU limit?** → CPU limit cross karne par container *throttle* hota hai (slow), kill nahi hota. Isliye kai teams latency-sensitive apps par CPU limit nahi lagati (sirf request) — par memory limit hamesha lagti hai, kyunki memory "wapas" nahi li ja sakti, sirf kill kiya ja sakta hai.
- **Crash dekha → order:** `get pods` (status) → `describe` (Reason/Exit Code/Events) → `logs --previous` → fix.

## 🧹 Cleanup

```bash
kubectl delete ns lab01
```
