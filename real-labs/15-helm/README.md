# 🧪 Lab 15 — Helm hands-on (template bug · values precedence · --rollback-on-failure · helm test)

> ⏱️ ~25 min · 📍 namespace `lab15` · 🧠 Concept: **Release = Chart + Values + Revision** · 🧭 Decision: *config kahan rakhein — `-f` file ya `--set`?*
> 🔧 `helm` CLI chahiye: <https://helm.sh/docs/intro/install/> — **Helm 4** (v4.0.4) aur **Helm 3** (v3.16) dono par test kiya.
> Helm 4 mein `--atomic` ka naya naam `--rollback-on-failure` hai (purana naam warning ke saath ab bhi chalta hai).

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
| `--rollback-on-failure` (Helm 3: `--atomic`) + `--timeout` | Fail hua toh **khud rollback** (`--wait` apne-aap) |
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

### Step 4 — Kharab upgrade, `--rollback-on-failure` ki suraksha (+ ek chupa hua jaal 🕳️)

Doosra terminal kholo aur Service ko live dekhte raho:

```bash
kubectl -n lab15 run watcher --rm -it --image=busybox:1.36 --restart=Never -- \
  sh -c 'while true; do wget -qO- -T 2 http://demo-gurukul-web; echo; sleep 3; done'
```

Pehle terminal mein kharab upgrade — galat image tag **aur** naya message:

```bash
# Helm 4 (Helm 3 mein --rollback-on-failure ki jagah --atomic likho)
helm upgrade demo chart/gurukul-web -n lab15 -f values-prod.yaml \
  --set image.tag=galat --set message=naya-config-v2 \
  --rollback-on-failure --timeout 90s
helm history demo -n lab15
```

👀 **Dikhna chahiye:**
- `Error: UPGRADE FAILED: release demo failed, and has been rolled back due to rollback-on-failure being set: ...`
  (Helm 3: `...due to atomic being set: context deadline exceeded`)
- history mein: `failed` revision + uske baad `deployed  Rollback to N`
- 🤯 **Watcher terminal:** kuch second se ~1 min ke andar **purana, healthy pod bhi** `naya-config-v2` serve karne lagta hai —
  jabki upgrade FAIL hua! (Isiliye timeout 90s rakha — kubelet ka sync ~1 min mein hota hai.) Rollback ke ~1 min baad wapas `prod: namaste 🙏`.

> 🧠 **Kyun?** ConfigMap ka naam har revision mein same hai. Helm ne naya ConfigMap turant apply kar diya. Naya pod
> (galat image) kabhi ready nahi hua — par **purana pod bhi wahi ConfigMap volume mount karta hai**, aur kubelet
> ~1 min mein naya content uske andar bhi daal deta hai. **Code ka rollout fail hua, config ka rollout chupke se ho gaya.**
> (`checksum/config` annotation sirf NAYE pods laata hai — purane pods ke mounted content ko nahi rokta.)
>
> 🏭 **Production decision:** jo config galat hone par outage laaye, use (1) **env vars** se do (badlega sirf
> pod restart par — Lab 07) ya (2) har change par **naya ConfigMap naam** (hash suffix — kustomize
> `configMapGenerator` yahi karta hai) — taaki purane pods purana config hi dekhte rahein.

Watcher ko `Ctrl+C` se band karo.

### Step 5 — Smoke test

```bash
helm test demo -n lab15              # Phase: Succeeded  (test ~1 min tak retry karta hai — upar wala sync lag)
```

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/deployment.yaml`

## 🧭 Decision recap — production mein kab kya?

- **Config = files (git + PR review)**, `--set` sirf CI ki dynamic cheez ke liye (image tag / git SHA).
- `--reuse-values` se bacho — purani values (galti wali bhi) chupke se chalti rehti hain. Sab kuch files mein likho.
- CI/CD: `helm upgrade --install --rollback-on-failure --timeout 5m -f values-<env>.yaml --set image.tag=$SHA` (Helm 3: `--atomic`).
- Har zaroori value par `required`, aur bade charts mein `values.schema.json` (types validate).
- ConfigMap badalne par pods restart → `checksum/config` annotation (is chart mein laga hai — dekho!).
- GitOps (ArgoCD) mein Helm sirf **render** karta hai — rollback = `git revert`, `helm rollback` nahi.

## 🧹 Cleanup

```bash
helm uninstall demo -n lab15 && kubectl delete ns lab15
```
