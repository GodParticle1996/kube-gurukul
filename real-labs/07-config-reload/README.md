# 🧪 Lab 07 — ConfigMap badla… app ko pata chala? (env vs volume vs subPath)

> ⏱️ ~10 min · 📍 namespace `lab07` · 🧠 Concept: **config kab "pahunchta" hai** · 🧭 Decision: *config change ke baad restart chahiye ya nahi?*

## 🎯 Ek line mein

ConfigMap badalne se **chal rahe container ka env kabhi nahi badalta**. Volume wali files ~1 min mein badal jaati hain —
**subPath** wali kabhi nahi. Aur "file badal gayi" ka matlab yeh nahi ki **app ne dobara padhi**.

## 🗺️ Mental map — teen raaste, teen bartav

| ConfigMap kaise diya | ConfigMap badla toh… | App ko naya value kab mile |
|---|---|---|
| `env` / `envFrom` | ❌ **Kabhi nahi** (env process start par fix hota hai) | Naya container (restart/rollout) |
| `volume` (poora ConfigMap as directory) | ✅ File ~1 min mein badal jaati hai (kubelet sync) | Jab app file **dobara padhe** (watch/reload) |
| `volume` + `subPath` | ❌ **Kabhi nahi** (ek file ka snapshot) | Naya container |

> 🧠 Volume update **atomic** hota hai: kubelet naya `..data` directory banata hai aur symlink palat deta hai —
> isliye app ko kabhi aadhi-likhi file nahi milti.

## 🎬 Scenario

PM bolta hai: *"greeting 'namaste-v2' karo, ConfigMap badal diya, ho gaya na?"* — logs batayenge ki **aadha** hua.

## 🛠️ Steps

### Step 1 — Lab shuru karo, logs khol lo

```bash
kubectl apply -f setup.yaml
kubectl -n lab07 logs -l app=greeter -f        # yeh terminal khula rakho
```

👀 **Dikhna chahiye:** har 5s: `env=namaste | volume=namaste | subPath=namaste`

### Step 2 — Doosre terminal se ConfigMap badlo

```bash
kubectl -n lab07 patch configmap greeter-config --type merge -p '{"data":{"GREETING":"namaste-v2"}}'
```

👀 **~1 minute mein dikhna chahiye:** `env=namaste | volume=namaste-v2 | subPath=namaste` — sirf volume badla!

### Step 3 — Baaki do ko kaise badloge?

<details><summary>💡 Hint</summary>

env aur subPath sirf **naye container** mein naya value lete hain. Saare pods ko ek-ek karke naya banane wala command:
`kubectl -n lab07 rollout restart deploy/greeter`
</details>

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/steps.sh`

## 🧭 Decision recap — production mein kab kya?

| Situation | Best tareeka |
|---|---|
| Config badle toh **pods apne-aap restart** hon (GitOps) | ConfigMap ka **naam versioned** rakho — Kustomize `configMapGenerator` (hash suffix) / Helm `checksum/config` annotation → pod template badalta hai → rollout khud |
| App khud file **hot-reload** karta hai (nginx -s reload, Prometheus) | Poora ConfigMap **volume** mein (subPath **nahi**) |
| Plain env vars, chhoti config | `envFrom` + config change par rollout (upar wala hash trick) |
| Bahut saari teams, auto-restart chahiye | **Reloader** jaisa controller (annotation se restart) |
| Config kabhi nahi badlega | `immutable: true` — API server load kam, galti se badalne ka darr khatam |

- 🔐 **Secret** bilkul ConfigMap jaisa bartav karta hai (env vs volume) — wahi niyam.
- `kubectl rollout restart` asal mein pod template par `kubectl.kubernetes.io/restartedAt` annotation lagata hai → normal rolling update.

## 🧹 Cleanup

```bash
kubectl delete ns lab07
```
