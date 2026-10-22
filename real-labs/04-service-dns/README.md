# 🧪 Lab 04 — Service nahi mil rahi (selector · targetPort · DNS)

> ⏱️ ~15 min · 📍 namespaces `lab04`, `lab04-frontend` · 🧠 Concept: **traffic ka raasta, hop-by-hop** · 🧭 Decision: *error message se batao kaunsa hop toota*

## 🎯 Ek line mein

Service ek **stable naam + virtual IP** hai jo **label selector** se pods dhoondhti hai aur traffic unke **targetPort** par bhejti hai.
Raasta ke 4 hop hain — har hop ka apna alag error message hai. Message padho, hop pakdo.

## 🗺️ Mental map — 4 hops, 4 errors

```
client ──(1) DNS naam──▶ Service IP ──(2) selector──▶ Pod IPs (endpoints) ──(3) targetPort──▶ container port
```

| Kya dikha | Kaunsa hop toota | Check karo |
|---|---|---|
| `bad address 'x'` / `NXDOMAIN` / `could not resolve host` | **(1) DNS** — naam galat, ya doosre namespace ka chhota naam | `<svc>.<namespace>` ya FQDN `<svc>.<ns>.svc.cluster.local` |
| `Connection refused` (turant) aur endpoints **khaali** | **(2) selector** — koi pod match nahi (ya pods ready nahi) | `get endpointslices`, `get pods --show-labels` |
| `Connection refused` par endpoints **bhare** | **(3) targetPort** — pod us port par sun hi nahi raha | containerPort vs targetPort |
| `timeout` (der tak latka) | Packet kahin drop — **NetworkPolicy** ya node/CNI issue | Lab 09 |

> 🧠 **DNS ka niyam:** pod ke andar `/etc/resolv.conf` mein `search <apna-ns>.svc.cluster.local svc.cluster.local ...` hota hai.
> Isliye chhota naam `payments` sirf **apne namespace** mein milta hai. Doosre namespace ke liye `payments.lab04`.

## 🎬 Scenario

`frontend` team (namespace `lab04-frontend`) ka checkout fail ho raha hai: *"payments service down hai!"*
Payments team: *"hamare pods toh Running hain!"* — dono sahi hain, aur dono galat. 😄

## 🛠️ Steps

### Step 1 — Lab shuru karo aur client se try karo

```bash
kubectl apply -f setup.yaml
kubectl -n lab04-frontend exec client -- wget -qO- -T 3 http://payments
```

👀 **Dikhna chahiye:** `wget: bad address 'payments'` → hop (1) DNS.

<details><summary>💡 Hint (hop 1)</summary>

Client `lab04-frontend` mein hai, Service `lab04` mein. Ab try karo:
`kubectl -n lab04-frontend exec client -- nslookup payments.lab04.svc.cluster.local`
</details>

### Step 2 — Naam theek, phir bhi refused?

```bash
kubectl -n lab04-frontend exec client -- wget -qO- -T 3 http://payments.lab04
kubectl -n lab04 get endpointslices -l kubernetes.io/service-name=payments
kubectl -n lab04 get pods --show-labels
kubectl -n lab04 get svc payments -o jsonpath='{.spec.selector}{"\n"}'
```

👀 **Dikhna chahiye:** `Connection refused` aur endpoints **khaali** → hop (2). Selector aur labels ko akshar-akshar milao.

### Step 3 — Endpoints aa gaye, phir bhi refused?

```bash
kubectl -n lab04 get endpointslices -l kubernetes.io/service-name=payments -o wide
```

👀 **Dikhna chahiye:** endpoints mein port **8080** — par nginx **80** par sunta hai → hop (3).

<details><summary>💡 Hint (hop 3)</summary>

`targetPort: 8080` → `targetPort: 80`. Aur bhi accha: container port ka **naam** hai `http` — `targetPort: http` likho.
Kal kisi ne container ka port badla toh Service apne-aap sahi rahegi.
</details>

### Step 4 — frontend ka URL theek karo

`frontend-config` ConfigMap mein `PAYMENTS_URL` ko namespace wala naam do → `kubectl apply -f setup.yaml`.

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fixed.yaml`

## 🧭 Decision recap — production mein kab kya?

| Zaroorat | Kya use karo |
|---|---|
| Cluster ke andar ek service doosri ko bulaye | **ClusterIP** (default) + DNS naam |
| Doosre namespace ki service | `svc.namespace` ya FQDN (config mein FQDN sabse saaf) |
| StatefulSet ke har pod ka apna naam (db-0, db-1) | **Headless** Service (`clusterIP: None`) — Lab 12 |
| Cluster ke bahar se (cloud) | **LoadBalancer**, ya ek LB ke peeche kai services → **Ingress / Gateway API** |
| Debug ke liye apne laptop se | `kubectl port-forward svc/payments 8080:80` (production traffic ke liye nahi!) |

- **targetPort ka naam use karo** (`http`), number nahi — refactor-safe.
- Selector mein **sirf stable labels** (`app`), version label (`v2`) nahi — warna rollout ke beech pods "gayab".

## 🧹 Cleanup

```bash
kubectl delete ns lab04 lab04-frontend
```
