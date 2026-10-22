# 🧪 Lab 13 — Jobs & CronJobs (retries · backoffLimit · overlapping runs)

> ⏱️ ~15 min (CronJob ke liye 2-3 min wait) · 📍 namespace `lab13` · 🧠 Concept: **"khatam hone wala kaam"** · 🧭 Decision: *Job ya Deployment? concurrencyPolicy kaunsi?*

## 🎯 Ek line mein

Deployment chahta hai ki process **hamesha chale**. Job chahta hai ki process **ek baar safal ho ke khatam** ho.
CronJob = schedule par Job banane wali factory — aur uski sabse badi galti: **pichla run khatam hone se pehle agla shuru**.

## 🗺️ Mental map

| Setting | Matlab | Default | Gotcha |
|---|---|---|---|
| `backoffLimit` | Kitni baar retry, phir Job **Failed** | 6 | Fail hua Job **khud dobara nahi chalta** |
| `restartPolicy` | `Never` (har retry = naya pod) / `OnFailure` (wahi pod restart) | — | Job mein `Always` allowed **nahi** |
| `activeDeadlineSeconds` | Poore Job ki time-limit | none | Iske bina atka Job hamesha chalta hai |
| `ttlSecondsAfterFinished` | Khatam Job + pods apne-aap delete | none | Bina iske purane Jobs jama hote rehte hain |
| CronJob `concurrencyPolicy` | `Allow` / `Forbid` / `Replace` | **Allow** | Allow + lamba job = **overlap** (do backup ek saath!) |
| CronJob `timeZone` | Schedule kis timezone mein | controller ka (aksar **UTC**) | "Raat 2 baje" IST mein chahiye → `timeZone: Asia/Kolkata` |

> 🧠 Job ka spec.template **immutable** hai. Config/command badla? → `kubectl delete job X` → dobara apply.
> CronJob se turant ek run chahiye? → `kubectl create job manual-1 --from=cronjob/report`

## 🎬 Scenario

**db-migrate:** release se pehle schema migration chali — `Failed`. Release ruki hui hai.
**report:** "har minute report" — par report banne mein 90 sec lagte hain. Kuch der baad cluster mein reports ka dher.

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
sleep 40; kubectl -n lab13 get jobs
```

### Step 2 — Migration kyun fail hui?

```bash
kubectl -n lab13 describe job db-migrate | grep -E "Pods Statuses|BackoffLimit"
kubectl -n lab13 logs job/db-migrate
```

👀 **Dikhna chahiye:** `0 Active / 0 Succeeded / 3 Failed` (1 try + 2 retry), `BackoffLimitExceeded`, aur logs mein `ERROR: TARGET ...`.

<details><summary>💡 Hint</summary>

ConfigMap `migrate-config` mein `TARGET` khaali hai → `"v42"` karo. Phir **Job delete karke dobara apply** —
Failed Job ko config badalne se koi fark nahi padta, woh khatam ho chuka hai.
</details>

### Step 3 — report: 2-3 minute ruko, phir dekho

```bash
kubectl -n lab13 get jobs -w
kubectl -n lab13 get cronjob report -o jsonpath='{.status.active[*].name}'; echo
```

👀 **Dikhna chahiye:** ek saath **do** `report-...` Running (90s ka kaam, har 60s naya).

<details><summary>💡 Hint</summary>

`concurrencyPolicy: Forbid` (pichla chal raha → naya skip) ya `Replace` (purana maaro, naya chalao).
Aur `jobTemplate.spec.activeDeadlineSeconds` — Forbid ke saath ek atka hua run **saari** aage ki runs rok dega, isliye time-limit zaroori.
</details>

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fixed.yaml`

## 🧭 Decision recap — production mein kab kya?

| Kaam | Use karo | concurrencyPolicy |
|---|---|---|
| DB migration (release se pehle, ek baar) | **Job** (ya Helm hook / ArgoCD PreSync) | — |
| Backup / billing / report (do ek saath = nuksaan) | CronJob | **Forbid** |
| "Latest data" sync (purana bekaar ho jaata hai) | CronJob | **Replace** |
| Independent chhote kaam (overlap se farak nahi) | CronJob | Allow |
| Queue se kaam lena, lagataar | **Deployment** (+ KEDA) — Job nahi | — |

- Job ko **idempotent** banao — retry (ya do baar chalna) nuksaan na kare.
- `ttlSecondsAfterFinished` + `successfulJobsHistoryLimit` — warna etcd mein purane Jobs/pods ka kooda.
- Migration fail → deploy rukna chahiye: CI mein `kubectl wait --for=condition=Complete job/... --timeout=…`.

## 🧹 Cleanup

```bash
kubectl delete ns lab13
```
