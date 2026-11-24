# 🧪 Lab 18 — Admission policy: galat YAML ko darwaze par hi roko

> ⏱️ ~20 min · 📍 namespace `lab18` (+ 2 cluster-level policies) · 🧠 Concept: **ValidatingAdmissionPolicy** · 🧭 Decision: *naya niyam seedha Deny, ya pehle Warn?*

> ✅ **Test hua (2026-11-24):** asli 3-node **kind** cluster par chala kar — kind v0.33.0, Kubernetes v1.37.0, kubectl v1.37.2, Docker 29.1.3.
> Saare error / warning messages usi cluster ke asli output se milaye gaye. Chahiye: Kubernetes **v1.30 ya naya** (`kubectl version`).

## 🎯 Ek line mein

**Admission policy = API server ke darwaze ka guard.** Har `kubectl apply` pehle guard ke paas jaata hai.
Guard niyam dekhta hai. Niyam toota → YAML andar aata hi nahi.

## 🗺️ Mental map — 2 cheezein, 2 naam

| Naam | Kya hai | Misaal |
|---|---|---|
| **Policy** (`ValidatingAdmissionPolicy`) | **Niyam** kya hai | "Image par pakka tag ho" |
| **Binding** (`ValidatingAdmissionPolicyBinding`) | Niyam **kahan** lage aur todne par **kya ho** | "Namespace `lab18` mein. Todne par `Deny`." |

**Bina Binding ke Policy so rahi hoti hai.** Kuch nahi rokti.

Binding ke 3 mode (`validationActions`):

| Mode | Request ka kya hota hai | Kab |
|---|---|---|
| `Warn` | Paas. `kubectl` par `Warning:` dikhta hai | Naya niyam — pehle dekho kaun todta hai |
| `Audit` | Paas. API server ke audit log mein note | `Warn` ke saath |
| `Deny` | **Ruk jaati hai** | Jab sab purane workloads theek ho chuke hon |

> Is lab ka tool Kubernetes ke **andar** hai — kuch install nahi karna. Kube Gurukul ke level **"Admission Policy"** mein
> **Kyverno** tha. Soch wahi hai: Kyverno ka `Audit` ≈ yahan `Warn`, Kyverno ka `Enforce` ≈ yahan `Deny`.

## 🎬 Scenario

ChaiPay ki platform team ne namespace `lab18` par do niyam banaye hain:

1. Policy **`lab18-no-latest`** — image par pakka tag ho. Yeh **chalu** hai (`Deny`).
2. Policy **`lab18-require-requests`** — har Deployment mein CPU + memory request ho. Yeh **so rahi** hai (Binding nahi hai).

**Part A:** ek developer kehta hai *"maine `notify` deploy kiya, koi error nahi aaya, par pod bana hi nahi."* Wajah dhoondo.
**Part B:** doosra niyam surakshit tareeke se chalu karo: pehle `Warn`, phir `Deny`.

## 🛠️ Part A — Deployment bana, pod nahi

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
```

**15 second ruko.** Nayi policy ko jaagne mein kuch second lagte hain.

```bash
kubectl get validatingadmissionpolicy
kubectl get validatingadmissionpolicybinding
```

👀 **Dikhna chahiye:** policies **2** (`lab18-no-latest`, `lab18-require-requests`). Bindings **1** (sirf `lab18-no-latest`).

### Step 2 — Developer wali galti dohrao

```bash
kubectl -n lab18 create deployment notify --image=nginx:latest
kubectl -n lab18 get deploy notify
kubectl -n lab18 get pods
```

👀 **Dikhna chahiye:**
- Pehla command: `deployment.apps/notify created` — **koi error nahi**.
- Doosra: `READY 0/1`.
- Teesra: `No resources found in lab18 namespace.`

<details><summary>💡 Pod ban gaya aur Running hai?</summary>

Policy abhi jaagi nahi thi. Saaf karke dobara karo:

```bash
kubectl -n lab18 delete deploy notify
```

15 second ruko, phir Step 2 dobara.
</details>

### Step 3 — Error kahan chhupa hai?

Pod ko **Deployment** nahi banata. Deployment ek **ReplicaSet** banata hai, aur ReplicaSet pod banata hai.
Guard ne **pod** ko roka. Toh error **ReplicaSet** ke paas hai.

```bash
kubectl -n lab18 describe rs -l app=notify
```

👀 **Dikhna chahiye:** neeche `Events` mein `FailedCreate`, aur message mein yeh hissa:

```
is forbidden: ValidatingAdmissionPolicy 'lab18-no-latest' with binding 'lab18-no-latest' denied request: Image par pakka tag likho ...
```

Message mein teen naam hain: **Policy** ka naam, **Binding** ka naam, aur **wajah**.

### Step 4 — Image theek karo

```bash
kubectl -n lab18 set image deploy/notify nginx=nginx:1.27-alpine
kubectl -n lab18 rollout status deploy/notify
```

👀 **Dikhna chahiye:** `deployment "notify" successfully rolled out`

> 🧠 **Seekh:** policy ne **pod** ko dekha, isliye developer ko error **nahi dikha**. Part B wali policy **Deployment** ko dekhti hai —
> wahan error seedha `kubectl` par aayega. Fark Step 10 mein dikhega.

## 🛠️ Part B — Naya niyam: pehle Warn, phir Deny

### Step 5 — Kaun niyam todta hai? (policy ke bina bhi dekh sakte ho)

```bash
kubectl -n lab18 get deploy -o custom-columns='NAME:.metadata.name,CPU-REQUEST:.spec.template.spec.containers[*].resources.requests.cpu,MEM-REQUEST:.spec.template.spec.containers[*].resources.requests.memory'
```

👀 **Dikhna chahiye:** `notify` ke aage dono column mein `<none>`. Matlab `notify` naya niyam todta hai.

Agar abhi seedha `Deny` laga dein toh? `notify` chalta rahega. Par `notify` ka **agla deploy ya rollback ruk jaayega** —
shayad kisi incident ke beech. Isliye pehle `Warn`.

### Step 6 — Policy ko `Warn` mode mein jagao

```bash
kubectl apply -f binding-warn.yaml
```

**15 second ruko.**

### Step 7 — Warn kaisa dikhta hai?

```bash
kubectl -n lab18 create deployment fraud-check --image=nginx:1.27-alpine
```

👀 **Dikhna chahiye:** do lines —

```
Warning: Validation failed for ValidatingAdmissionPolicy 'lab18-require-requests' with binding 'lab18-require-requests': Har container mein resources.requests.cpu aur resources.requests.memory likho.
deployment.apps/fraud-check created
```

Deployment **ban gaya**, par developer ko chetavni mil gayi.

### Step 8 — Purane workloads theek karo (Deny se PEHLE)

```bash
kubectl -n lab18 set resources deploy/notify --requests=cpu=50m,memory=32Mi
kubectl -n lab18 set resources deploy/fraud-check --requests=cpu=50m,memory=32Mi
```

👀 **Dikhna chahiye:** `resource requirements updated`, aur is baar **koi `Warning:` nahi**.

Step 5 wala command dobara chalao. Ab kisi ke aage `<none>` nahi hona chahiye.

### Step 9 — Ab `Deny`

```bash
kubectl patch validatingadmissionpolicybinding lab18-require-requests --type=merge -p '{"spec":{"validationActions":["Deny"]}}'
```

**15 second ruko.**

### Step 10 — Jaancho: galat Deployment ab turant rukta hai

```bash
kubectl -n lab18 create deployment ledger --image=nginx:1.27-alpine
```

👀 **Dikhna chahiye:** error seedha `kubectl` par:

```
error: failed to create deployment: deployments.apps "ledger" is forbidden: ValidatingAdmissionPolicy 'lab18-require-requests' with binding 'lab18-require-requests' denied request: Har container mein resources.requests.cpu aur resources.requests.memory likho.
```

Part A se fark dekho: wahan error ReplicaSet mein **chhupa** tha. Yahan developer ko **usi pal** pata chal gaya.

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/commands.md`

## 🧭 Decision recap

| Sawal | Faisla |
|---|---|
| Naya niyam chalu karna hai | Pehle `Warn` (+`Audit`) → todne walon ko theek karo → phir `Deny` |
| Policy **Pod** ko dekhe ya **Deployment** ko? | Dono. Deployment par = developer ko turant error. Pod par = koi raasta chhootta nahi (Job, CronJob, seedha Pod) |
| "Deployment bana, pod nahi bana" | `kubectl describe rs` ke Events padho. Wajahein: admission policy, ResourceQuota, PodSecurity |
| ValidatingAdmissionPolicy ya Kyverno? | Sirf "haan/na" wale niyam → ValidatingAdmissionPolicy (kuch install nahi). YAML badalna (mutate), image signature jaanchna, reports → Kyverno |

- **`Deny` purane objects ko nahi maarta.** Woh chalte rehte hain. Par unka agla **update** rukta hai. Isliye Step 8 pehle, Step 9 baad mein.
- **`kubectl scale` phir bhi chalta hai.** Scale ek alag raasta (`deployments/scale`) use karta hai, jise yeh policy nahi dekhti.
- **Policy cluster-scoped hai.** Namespace delete karne se policy nahi jaati. Isliye is lab ka apna `cleanup.sh` hai.
- **`failurePolicy: Fail`** ka matlab: niyam ki jaanch mein hi error aaye toh request rok do. Surakshit, par galat likhi policy sab kuch rok sakti hai — isliye pehle `Warn`.
- Policy mein likhi shart **CEL** bhasha mein hai. Shart mein galti ho toh: `kubectl get validatingadmissionpolicy lab18-require-requests -o jsonpath='{.status.typeChecking}'`

## 🧹 Cleanup

```bash
./cleanup.sh
```
