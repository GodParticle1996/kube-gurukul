# 🧪 Lab 15 — Helm hands-on (template bug · values precedence · --atomic · helm test)

> ⏱️ ~25 min · 📍 namespace `lab15` · 🧠 Concept: **Release = Chart + Values + Revision** · 🧭 Decision: *config kahan rakhein — `-f` file ya `--set`?*
> 🔧 `helm` CLI chahiye: <https://helm.sh/docs/intro/install/> (`helm version` → v3.x)

## 🎯 Ek line mein

Helm = template engine + release history. **Har upgrade par values naye sire se banti hain** (chart defaults ← `-f` files ← `--set`),
purani `--set` yaad nahi rehti. Aur template mein ek galat key = **chupchaap khaali value** — koi error nahi.

## 🗺️ Mental map

```
values.yaml (chart defaults)  <  -f file1  <  -f file2  <  --set   ← daayi taraf wala JEETTA hai
```

| Command | Kab |
|---|---|
| `helm lint <chart>` | Syntax/structure — **par galat key nahi pakadta!** |
| `helm template <rel> <chart> -f ...` | Rendered YAML **aankhon se padho** — asli debugging yahi |
| `helm upgrade --install <rel> <chart> -f ...` | Install-ya-upgrade, CI/CD ke liye ek hi command |
| `helm get values <rel>` / `--all` | Abhi kya laga hai (user-supplied / computed) |
| `helm history <rel>` | Har revision + STATUS: `deployed` · `superseded` · `failed` |
| `--atomic` (+`--timeout`) | Fail hua toh **khud rollback** (`--wait` apne-aap) |
| `helm test <rel>` | Chart ke test pods chalao (smoke test) |

> 🧠 Helm ki "yaaddaasht" cluster mein **Secrets** hain: `kubectl -n lab15 get secrets -l owner=helm --show-labels`
> (har revision ek Secret, label mein `status=deployed/superseded/failed`).

## 🎬 Scenario

Team ne apna pehla chart likha. Prod values file mein `replicaCount: 3` hai — par deploy ke baad sirf **1** pod.
Aur ek on-call ne raat ko `--set` se kuch badla… agle din ka deploy kuch aur hi kar gaya.

## 🛠️ Steps

### Step 1 — Lint pass, phir bhi bug?

```bash
helm lint chart/gurukul-web                                   # 0 failed ✅ ...
helm template demo chart/gurukul-web -f values-prod.yaml | grep -n "replicas:"
```

👀 **Dikhna chahiye:** `replicas:` ke aage **kuch nahi** → Kubernetes default 1 maan lega. Lint ko kuch nahi dikha.

<details><summary>💡 Hint</summary>

`templates/deployment.yaml` mein `.Values.replicacount` vs `values.yaml` mein `replicaCount` — Go templates **case-sensitive** hain,
aur missing key = `nil` = khaali, bina error ke. Fix: `{{ required "replicaCount set karo" .Values.replicaCount }}`
— ab key gayab ho toh render hi **fail** hoga (chupchaap galat chalne se behtar).
</details>

### Step 2 — Install (prod values ke saath)

```bash
helm upgrade --install demo chart/gurukul-web -n lab15 --create-namespace -f values-prod.yaml --wait
kubectl -n lab15 get deploy,pods
helm history demo -n lab15
```

### Step 3 — `--set` ka jaal 🪤

```bash
helm upgrade demo chart/gurukul-web -n lab15 --set message=hello --wait
kubectl -n lab15 get deploy          # 3 → 1 replica!! 😱
helm get values demo -n lab15        # USER-SUPPLIED: sirf message
```

Values naye sire se bani: chart defaults (replicaCount: 1) + sirf `--set`. Prod file is baar diya hi nahi!
**Theek karo:** `-f values-prod.yaml` ke saath upgrade dobara.

### Step 4 — Kharab upgrade, `--atomic` ki suraksha

```bash
helm upgrade demo chart/gurukul-web -n lab15 -f values-prod.yaml --set image.tag=galat --atomic --timeout 45s
helm history demo -n lab15
```

👀 **Dikhna chahiye:** `Error: UPGRADE FAILED: release demo failed, and has been rolled back due to atomic being set: context deadline exceeded`
aur history mein: `failed` revision + uske baad `deployed  Rollback to N`. Purane pods poore time serve karte rahe.

### Step 5 — Smoke test

```bash
helm test demo -n lab15              # Phase: Succeeded
```

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/deployment.yaml`

## 🧭 Decision recap — production mein kab kya?

- **Config = files (git + PR review)**, `--set` sirf CI ki dynamic cheez ke liye (image tag / git SHA).
- `--reuse-values` se bacho — purani values (galti wali bhi) chupke se chalti rehti hain. Sab kuch files mein likho.
- CI/CD: `helm upgrade --install --atomic --timeout 5m -f values-<env>.yaml --set image.tag=$SHA`.
- Har zaroori value par `required`, aur bade charts mein `values.schema.json` (types validate).
- ConfigMap badalne par pods restart → `checksum/config` annotation (is chart mein laga hai — dekho!).
- GitOps (ArgoCD) mein Helm sirf **render** karta hai — rollback = `git revert`, `helm rollback` nahi.

## 🧹 Cleanup

```bash
helm uninstall demo -n lab15 && kubectl delete ns lab15
```
