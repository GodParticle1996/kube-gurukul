# 🧪 Lab 08 — RBAC: "403 Forbidden" ka ilaaj (ServiceAccount · Role · ClusterRole)

> ⏱️ ~15 min · 📍 namespace `lab08` (+ cluster-scoped RBAC) · 🧠 Concept: **kaun · kya · kahan** · 🧭 Decision: *Role ya ClusterRole? RoleBinding ya ClusterRoleBinding?*

## 🎯 Ek line mein

RBAC = **Subject** (kaun: user / group / ServiceAccount) + **Role** (kya: verbs × resources) + **Binding** (dono ko jodta hai, aur **kahan** lagu hoga).
403 aaye toh teeno mein se ek gadbad hai — `kubectl auth can-i ... --as=...` se seedha poochho.

## 🗺️ Mental map — 4 combinations, ek table

| Role kind | Binding kind | Asar kahan | Kab use karo |
|---|---|---|---|
| **Role** (namespace mein) | **RoleBinding** | Sirf us namespace mein | App ko apne namespace ke pods/configmaps padhne hain — **default choice** |
| **ClusterRole** | **RoleBinding** | Sirf us RoleBinding ke namespace mein | Ek common role (jaise `view`) kai namespaces mein **reuse** karna |
| **ClusterRole** | **ClusterRoleBinding** | **Poora cluster** — saare namespaces | Cluster-scoped cheezein (**nodes**, PVs, namespaces, CRDs) ya sach mein cluster-wide tools |
| Role | ClusterRoleBinding | ❌ allowed hi nahi | — |

> 🧠 **Cluster-scoped resources** (nodes, persistentvolumes, namespaces, storageclasses, clusterroles…) kisi namespace mein nahi rehte —
> unke liye **ClusterRole + ClusterRoleBinding** hi chalega. Namespace wala Role unhe kabhi grant nahi kar sakta.

> 🔍 ServiceAccount ka username: `system:serviceaccount:<namespace>:<naam>` — yahi `--as` mein jaata hai.

## 🎬 Scenario

Security team ka `auditor` bot har 5s pods aur nodes ki list maangta hai. Logs mein sirf `403`.
Kisi ne RBAC "likha toh tha" — phir bhi kaam nahi kar raha.

## 🛠️ Steps

### Step 1 — Lab shuru karo, bot ki awaaz suno

```bash
kubectl apply -f setup.yaml
kubectl -n lab08 logs deploy/auditor -f        # Ctrl+C baad mein
```

👀 **Dikhna chahiye:** `list pods(lab08)=403   list nodes=403`

### Step 2 — API server se seedha poochho

```bash
SA=system:serviceaccount:lab08:auditor
kubectl auth can-i list pods -n lab08 --as=$SA        # no
kubectl auth can-i --list -n lab08 --as=$SA            # iske paas kya-kya hai?
kubectl -n lab08 get rolebinding auditor-pod-reader -o yaml
```

<details><summary>💡 Hint (pods)</summary>

Role `pod-reader` bilkul sahi hai. RoleBinding ka `subjects` padho: ServiceAccount `auditor` — **kis namespace ka**?
`default` namespace mein `auditor` naam ka koi aur SA ho sakta hai — RBAC ke liye woh bilkul alag insaan hai.
</details>

### Step 3 — nodes ke liye kya chahiye?

<details><summary>💡 Hint (nodes)</summary>

`kubectl api-resources --namespaced=false | grep nodes` — nodes cluster-scoped hain. Chahiye:
`ClusterRole` (get/list/watch nodes) + `ClusterRoleBinding` (subject: lab08 ka auditor SA).
</details>

### Step 4 — Least privilege test

Fix ke baad yeh **"no"** hi rehne chahiye — zyada access dena bhi galti hai:

```bash
kubectl auth can-i list pods -n kube-system --as=$SA   # no
kubectl auth can-i delete pods -n lab08 --as=$SA       # no
kubectl auth can-i get secrets -n lab08 --as=$SA       # no
```

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fixed-rbac.yaml`

## 🧭 Decision recap — production mein kab kya?

- **Default:** Role + RoleBinding (namespace tak seemit). ClusterRoleBinding sirf jab sach mein cluster-wide chahiye.
- **Built-in ClusterRoles** reuse karo: `view`, `edit`, `admin` — ek RoleBinding se kisi namespace mein de do.
- **`cluster-admin` ya `resources: ["*"]`** kabhi kisi app ko nahi. Secrets ka `get/list` = saare credentials.
- App ko API ki zaroorat hi nahi? → `automountServiceAccountToken: false` (token mount hi mat karo).
- Debug order: `auth can-i` → binding ka **subject** (naam + namespace) → **roleRef** (kind + naam) → rule ke **apiGroups/resources/verbs**.

## 🧹 Cleanup

```bash
./cleanup.sh          # ClusterRole/ClusterRoleBinding bhi hatata hai
```
