# 🧪 Lab 02 — ImagePullBackOff (image kyun nahi aa rahi?)

> ⏱️ ~10 min · 📍 namespace `lab02` · 🧠 Concept: **image pull ka raasta** · 🧭 Decision: *registry ka error padh ke 4 mein se ek wajah chuno*

## 🎯 Ek line mein

Container start hi nahi hua — kubelet registry se image **la hi nahi paaya**.
App ke logs bekaar hain (app chala hi nahi!). Jawab **`describe pod` ke Events** mein registry ke error message mein hai.

## 🗺️ Mental map — error message → wajah → fix

| Events mein kya likha hai | Wajah | Fix |
|---|---|---|
| `...: not found` / `manifest unknown` | Image **naam ya tag galat** (typo, tag kabhi push hi nahi hua) | Tag sahi karo; CI mein dekho tag bana bhi tha? |
| `401 Unauthorized` / `pull access denied` / `authorization failed` | **Private registry** — credentials nahi | `imagePullSecrets` (neeche dekho) |
| `i/o timeout` / `dial tcp ... connection refused` | Node se registry tak **network** nahi (firewall, proxy, DNS) | Node ka network/proxy, registry mirror |
| `no match for platform in manifest` | Image doosre **CPU architecture** ki (arm64 vs amd64) | Multi-arch image banao ya sahi arch ka tag |
| `toomanyrequests` / `429` | Docker Hub **rate limit** | Login karke pull, apna mirror/registry cache |

> 🧠 `ErrImagePull` = pehli baar fail. `ImagePullBackOff` = kubelet ab **ruk-ruk ke** (10s, 20s, 40s… max 5 min) retry kar raha hai.
> Isliye fix ke baad bhi thoda wait lag sakta hai — ya pod delete karke turant retry karwao.

## 🎬 Scenario

CI/CD pipeline ne `storefront` deploy kiya. Dono pods `0/1`. Developer bolta hai *"mera code toh theek hai!"* —
aur sach mein, code tak baat pahunchi hi nahi.

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
kubectl -n lab02 get pods
```

👀 **Dikhna chahiye:** `ErrImagePull` → kuch der baad `ImagePullBackOff`. `RESTARTS` **0** hi rahega (container kabhi bana hi nahi).

### Step 2 — Registry ne kya jawab diya?

```bash
kubectl -n lab02 describe pod -l app=storefront | grep -A2 "Failed to pull"
```

👀 **Asli cluster par dikhna chahiye:**
`failed to resolve reference "docker.io/library/nginx:1.27-alpne": docker.io/library/nginx:1.27-alpne: not found`

<details><summary>💡 Hint</summary>

"not found" = registry tak pahunche, login ki zaroorat nahi padi — bas **woh naam/tag exist nahi karta**.
Tag ko akshar-akshar padho: `alpne`?
</details>

### Step 3 — Fix karo (do tareeke — farak samjho!)

```bash
# Tareeka A — imperative (jaldi, 3 AM wala):
kubectl -n lab02 set image deploy/storefront web=nginx:1.27-alpine

# Tareeka B — declarative (sahi wala): setup.yaml mein tag theek karo, phir
kubectl apply -f setup.yaml
```

> ⚠️ **GitOps (ArgoCD/Flux) wale cluster mein** Tareeka A ka fix kuch minute mein **wapas ulat** jaayega —
> kyunki git mein abhi bhi galat tag hai. Production mein fix hamesha **git mein**.

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fixed-deployment.yaml`

## 🔐 Bonus (sirf padhne ke liye) — private registry ka pull secret

```bash
kubectl -n lab02 create secret docker-registry regcred \
  --docker-server=ghcr.io --docker-username=<user> --docker-password=<token>
```

```yaml
spec:
  imagePullSecrets:
    - name: regcred          # pod spec mein (ya ServiceAccount par lagao — saare pods ko mil jaata hai)
```

## 🧭 Decision recap — production mein kab kya?

- **Tag vs digest:** `nginx:1.27-alpine` badal sakta hai (koi naya push kare); `nginx@sha256:…` kabhi nahi badalta → prod mein **digest pin** sabse safe.
- **`:latest` kabhi nahi** — `imagePullPolicy` default `Always` ho jaata hai, aur "kaunsa version chal raha hai?" ka jawab koi nahi de paata.
- **`imagePullPolicy`:** tagged image → `IfNotPresent` (default, fast). `Always` sirf tab jab tag jaan-boojh ke mutable ho.
- **Pull secret kahan?** Ek-do pods → pod spec. Poore namespace ke pods → **ServiceAccount** par `imagePullSecrets`.

## 🧹 Cleanup

```bash
kubectl delete ns lab02
```
