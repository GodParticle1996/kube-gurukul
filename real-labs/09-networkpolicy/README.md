# 🧪 Lab 09 — NetworkPolicy: zero-trust (default deny + sirf zaroori raaste)

> ⏱️ ~20 min · 📍 namespace `lab09` · 🧠 Concept: **pod ka firewall** · 🧭 Decision: *kaunsa traffic allow, baaki sab deny*

## 🎯 Ek line mein

Default mein Kubernetes mein **har pod har pod se baat kar sakta hai** (attacker bhi!).
NetworkPolicy pod ka **firewall** hai: jaise hi koi policy kisi pod ko **chunti** hai, us direction mein sirf **allow kiya hua** traffic aata hai.

## 🗺️ Mental map — 3 niyam jo 90% confusion khatam karte hain

1. **`podSelector` = kiski raksha?** Policy un pods par lagti hai jinhe yeh chunta hai (traffic jahan **pahunch** raha hai — ingress ke liye).
2. **Policies jud-ti hain (OR), kat-ti nahi.** Koi "deny" rule nahi hota — sirf "allow". Ek pod ko kai policies chunein toh sabka allow jud jaata hai.
3. **Port = container ka port**, Service ka nahi. Packet pod tak pahunchte waqt Service ka port pehle hi translate ho chuka hota hai (`80 → 8080`).

| Likha | Matlab |
|---|---|
| `podSelector: {}` + `policyTypes: [Ingress]` + koi `ingress` nahi | Namespace ke **saare** pods ka ingress **band** (default deny) |
| `from: - podSelector: {app: frontend}` | Sirf **isi namespace** ke frontend pods |
| `from: - namespaceSelector: {...}` | Kisi doosre namespace ke **saare** pods |
| `from: - namespaceSelector: {...}` **aur** `podSelector` ek hi `-` item mein | Us namespace ke **woh** pods (AND) — alag `-` items = OR ⚠️ |

> ⚠️ **NetworkPolicy tabhi kaam karti hai jab CNI use enforce kare.** Na kare toh policy **chupchaap ignore** hoti hai —
> koi error nahi! Isliye pehle `./check-enforcement.sh`.

## 🎬 Scenario

Security audit: *"backend ko sirf frontend bula sake, DB ko sirf backend. Aur agar koi pod compromise ho jaaye (attacker), woh kuch na chhu sake."*

```
frontend ──✅──▶ backend ──✅──▶ db
    └─────────❌──────────────────┘
attacker ──❌──▶ backend / db
```

## 🛠️ Steps

### Step 0 — Kya tumhara cluster policies enforce karta hai?

```bash
./check-enforcement.sh
```

✅ aaya toh aage badho. ❌ aaya toh neeche **Plan B: Calico** karo, phir yahan wapas aao.

### Step 1 — Lab shuru karo, dekho sab khula hai

```bash
kubectl apply -f setup.yaml
kubectl -n lab09 wait --for=condition=Ready pod --all
kubectl -n lab09 exec attacker -- wget -qO- -T 2 http://db:5432      # db-ok 😱
```

### Step 2 — Policies likho

`policies-starter.yaml` kholo — default-deny likha hua hai, frontend→backend mein **TODO** bharo, aur backend→db wali policy **khud** likho.

```bash
kubectl apply -f policies-starter.yaml
./verify.sh            # har step ke baad chala sakte ho
```

<details><summary>💡 Hint</summary>

DB wali policy: `podSelector: {matchLabels: {app: db}}` (raksha db ki), `from: podSelector app=backend`, `ports: - port: 5432`.
frontend→backend chal nahi raha? Port **8080** likha hai ya Service wala 80?
</details>

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/policies.yaml`

## 🎁 Bonus — egress bhi band karo (production ka asli zero-trust)

```bash
kubectl apply -f solution/bonus-egress.yaml
```

⚠️ Sirf `default-deny-egress` lagao toh **DNS bhi band** → `wget: bad address 'backend'`. Isliye egress band karte hi
**pehli** allow policy hamesha DNS ki: kube-dns pods (`k8s-app: kube-dns`, namespace `kube-system`), **UDP aur TCP 53** dono.

## 🧭 Decision recap — production mein kab kya?

- Har app namespace mein **default-deny ingress** + chhoti-chhoti allow policies (ek service = ek policy). Egress deny bhi — DNS allow ke saath.
- Labels se socho, IPs se nahi: pods ke IP badalte rehte hain; `podSelector`/`namespaceSelector` hi stable hain.
- Namespace ko label se chuno: har namespace par apne-aap `kubernetes.io/metadata.name: <naam>` label hota hai.
- L7 rules (HTTP path/method) chahiye? NetworkPolicy sirf L3/L4 hai → Cilium/Istio policies.
- CNI chuno jo policy enforce kare: Calico, Cilium, (naye kind ka kindnet bhi). Flannel akela **nahi** karta.

## 🅱️ Plan B: Calico wala cluster (agar Step 0 mein ❌ aaya)

```bash
kind create cluster --config kind-config-calico.yaml
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.29.1/manifests/calico.yaml
kubectl -n kube-system rollout status ds/calico-node --timeout=300s
./check-enforcement.sh        # ab ✅ aana chahiye
```

> Kaam khatam: `kind delete cluster --name gurukul-calico` · Wapas main cluster: `kubectl config use-context kind-gurukul`

## 🧹 Cleanup

```bash
kubectl delete ns lab09
```
