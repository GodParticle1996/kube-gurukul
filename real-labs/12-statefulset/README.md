# 🧪 Lab 12 — StatefulSet: stable naam + apni disk (headless Service · PVC)

> ⏱️ ~15 min · 📍 namespace `lab12` · 🧠 Concept: **pet vs cattle — jab pod ki pehchaan maayne rakhe** · 🧭 Decision: *Deployment ya StatefulSet?*

## 🎯 Ek line mein

Deployment ke pods **anaam** hote hain (`web-7d9f…`), koi bhi kisi ki jagah le sakta hai.
StatefulSet ke pods ki **pehchaan pakki** hoti hai: naam `kv-0`, `kv-1` · har ek ka **apna DNS naam** · har ek ki **apni disk** jo pod marne par bhi bachi rehti hai.

## 🗺️ Mental map — StatefulSet ke 3 vaade

| Vaada | Kaise milta hai | Yahan dekho |
|---|---|---|
| **Stable naam** `kv-0`, `kv-1` (ordinal) | StatefulSet khud | `kubectl -n lab12 get pods` |
| **Stable DNS** `kv-0.kv-headless.lab12.svc.cluster.local` | **Headless Service** (`clusterIP: None`) jiska naam = `serviceName` | `nslookup` client se |
| **Stable disk** `data-kv-0` hamesha `kv-0` ke saath | `volumeClaimTemplates` | `kubectl -n lab12 get pvc` |

| Service type | DNS kya deta hai | Kab |
|---|---|---|
| Normal (ClusterIP) `kv` | Ek virtual IP → **koi bhi** replica | Read traffic jo kisi bhi replica par chale |
| **Headless** `kv-headless` | Seedha pod IPs + **har pod ka naam** | Leader/replica ko naam se bulana (DB primary, Kafka broker, ZooKeeper) |

## 🎬 Scenario

Team ne apna key-value store StatefulSet par daala. Replicas aapas mein **naam se** baat karte hain (`kv-0` = leader) —
par `kv-0.kv-headless` resolve hi nahi ho raha. Aur sawaal: pod mara toh data bachega?

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
kubectl -n lab12 get pods,pvc         # kv-0, kv-1 (order mein bante hain) + data-kv-0, data-kv-1
```

### Step 2 — Per-pod DNS try karo

```bash
kubectl -n lab12 exec client -- nslookup kv-0.kv-headless.lab12.svc.cluster.local
```

👀 **Dikhna chahiye:** `NXDOMAIN` — `serviceName: kv-headless` likha hai par woh Service hai hi nahi.

<details><summary>💡 Hint</summary>

Service `kv-headless` banao: `clusterIP: None`, `selector: {app: kv}`, port 8080. Normal `kv` Service per-pod naam **nahi** deti.
</details>

### Step 3 — Data pod se zyada jeeta hai?

```bash
kubectl -n lab12 exec kv-0 -- cat /data/boot.log          # 1 line
kubectl -n lab12 delete pod kv-0                           # "server crash"
kubectl -n lab12 wait --for=condition=Ready pod/kv-0
kubectl -n lab12 exec kv-0 -- cat /data/boot.log          # 2 lines! purani bachi
```

👀 **Dikhna chahiye:** naya `kv-0` (wahi naam!) ne wahi PVC `data-kv-0` pakdi — purani line + nayi line.
(kind ka local-path storage node se bandha hai, isliye kv-0 **usi node** par wapas aata hai.)

### Step 4 (soch ke dekho) — scale down

```bash
kubectl -n lab12 scale sts/kv --replicas=1
kubectl -n lab12 get pvc         # data-kv-1 ab bhi hai! StatefulSet disk delete NAHI karta (data safety)
kubectl -n lab12 scale sts/kv --replicas=2      # kv-1 wapas aaya, purana data ke saath
```

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/headless-svc.yaml`

## 🧭 Decision recap — production mein kab kya?

| Workload | Use karo |
|---|---|
| Stateless API/web — koi bhi replica kaam kare | **Deployment** |
| DB/queue jahan har replica ki **pehchaan + apni disk** | **StatefulSet** + headless Service |
| Har node par ek (log/metrics agent) | **DaemonSet** |
| Ek baar chalke khatam (migration) | **Job** |

- **Managed DB (RDS/Cloud SQL) available hai?** Aksar wahi behtar — backup, failover, upgrades unka sar-dard.
- `podManagementPolicy: Parallel` → pods ek saath (order zaroori na ho toh tez).
- `persistentVolumeClaimRetentionPolicy` → scale-down/delete par PVC rakhna hai ya hatana (default: **rakho**).
- PVC ka size badhana → StorageClass mein `allowVolumeExpansion: true` hona chahiye.

## 🧹 Cleanup

```bash
kubectl delete ns lab12          # PVCs bhi namespace ke saath jaati hain
```
