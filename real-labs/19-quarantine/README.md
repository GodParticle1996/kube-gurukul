# 🧪 Lab 19 — Quarantine: hack hue pod ko alag karo, par maaro mat

> ⏱️ ~20 min · 📍 namespace `lab19` · 🧠 Concept: **label se alag karna + NetworkPolicy se band karna** · 🧭 Decision: *pod delete karun ya quarantine?*

> ✅ **Test hua (2026-11-24):** asli 3-node **kind** cluster par chala kar — kind v0.33.0, Kubernetes v1.37.0, kubectl v1.37.2, Docker 29.1.3.
> Har step ka "👀 Dikhna chahiye" (`xmrig`, `ledger-ok`, `download timed out`, `notify-ok`) usi cluster par aaya. NetworkPolicy kind ke default kindnet ne enforce ki.

## 🎯 Ek line mein

Hack hue pod ko **turant delete karna galat hai** — saboot bhi delete ho jaata hai, aur pata nahi chalta attacker ghusa kaise.
Sahi tareeka: pod ko **zinda rakho**, par **users se alag** aur **network se band** kar do. Isko **quarantine** kehte hain.

## 🗺️ Mental map — misaal: beemar mareez

Hospital mein sankramak mareez ko ghar nahi bhejte (bimari phailegi) aur maarte bhi nahi (ilaaj aur jaanch baaki hai).
Use **alag kamre** mein rakhte hain. Yahan bhi wahi 3 kaam:

| # | Kaam | Kaise | Asar |
|---|---|---|---|
| 1 | **Saboot bachao** | `kubectl get pod -o yaml`, `kubectl logs` file mein | Pod mar bhi jaaye toh record bacha rahe |
| 2 | **Users se alag** | Pod ka label `app=notify` **hatao** | Service `notify` us pod ko traffic nahi bhejti. ReplicaSet ek **naya** saaf pod bana deta hai |
| 3 | **Network band** | Label `quarantine=true` + NetworkPolicy `quarantine` | Pod na kisi se baat kar sakta hai, na koi us se |

**Label hi sab kuch hai.** Service aur ReplicaSet, dono pod ko **label se** pehchaante hain. Label hata → dono ke liye pod "gayab".

> ⚠️ Kaam 3 (network band) tabhi asar karta hai jab cluster ka CNI NetworkPolicy **enforce** kare.
> Pakka nahi? Pehle `../09-networkpolicy/check-enforcement.sh` chalao.

## 🎬 Scenario

ChaiPay ka `notify` service customers ko SMS bhejta hai. Namespace `lab19` mein 3 cheezein hain:

```
client ──▶ Service notify ──▶ notify pod A   (saaf)
                         └──▶ notify pod B   (🚨 hack hua — andar "xmrig" chal raha hai)
                                   └──▶ Service ledger   (paise ka hisaab — attacker ka nishana)
```

Raat 2 baje Falco ka alert aata hai: *"notify ke ek pod mein anjaan process `xmrig`."*

## 🛠️ Steps

### Step 1 — Lab shuru karo aur hamla chalao

```bash
kubectl apply -f setup.yaml
./attack.sh
```

👀 **Dikhna chahiye:** `🚨 FALCO ALERT`, aur neeche ek line jaise `BAD=notify-7c9d8b6f5-x2k4q`.

Woh `BAD=...` wali line **copy karke chalao**. Ab `BAD` = hack hue pod ka naam. Ek aur variable banao:

```bash
LEDGER_IP=$(kubectl -n lab19 get svc ledger -o jsonpath='{.spec.clusterIP}')
echo "hack hua pod: $BAD   ledger ka IP: $LEDGER_IP"
```

> 🧠 Naya terminal khola? Dono variable khaali ho jaate hain. `./attack.sh` dobara chalao (naya hamla nahi hota, wahi alert
> phir dikhta hai), `BAD=...` line chalao, aur `LEDGER_IP=...` wala command dobara chalao.

### Step 2 — Alert sach hai? Dekho (kuch badlo mat)

```bash
kubectl -n lab19 exec "$BAD" -- ps
```

👀 **Dikhna chahiye:** list mein ek line jisme `xmrig` hai. `notify` ka apna process sirf `httpd` hai — `xmrig` wahan nahi hona chahiye.

Ab dekho hack hua pod abhi kya-kya kar sakta hai:

```bash
kubectl -n lab19 exec "$BAD" -- wget -qO- -T 3 http://$LEDGER_IP
```

👀 **Dikhna chahiye:** `ledger-ok` 😱 — hack hua pod `ledger` tak pahunch raha hai.

### Step 3 — Saboot bachao (sabse pehle)

```bash
kubectl -n lab19 get pod "$BAD" -o yaml > /tmp/lab19-evidence-pod.yaml
kubectl -n lab19 logs "$BAD" > /tmp/lab19-evidence-logs.txt
kubectl -n lab19 get pod "$BAD" -o wide
```

Teesre command se pod ka **NODE** note kar lo. Asli incident mein us node ki bhi jaanch hoti hai.

### Step 4 — Users se alag karo (ek command, do label)

```bash
kubectl -n lab19 label pod "$BAD" app- quarantine=true
```

| Hissa | Matlab |
|---|---|
| `app-` | Label `app` **hatao** (aakhir ka minus = hatana) |
| `quarantine=true` | Naya label **lagao** |

Ab dekho kya hua:

```bash
kubectl -n lab19 get pods --show-labels
```

👀 **Dikhna chahiye:** **3** pods jinke naam `notify-` se shuru hote hain:
- 2 pods par `app=notify` — ek purana saaf pod, ek **bilkul naya** (ReplicaSet ne banaya).
- 1 pod (`$BAD`) par `quarantine=true`, aur `app` label gayab.

```bash
kubectl -n lab19 get endpointslices -l kubernetes.io/service-name=notify
kubectl -n lab19 get pod "$BAD" -o jsonpath='{.status.podIP}{"\n"}'
```

👀 **Dikhna chahiye:** `ENDPOINTS` mein 2 IP. Hack hue pod ka IP (doosre command ka jawab) un 2 mein **nahi** hai.

Matlab: users ka traffic ab sirf saaf pods par ja raha hai. Par hack hua pod abhi bhi `ledger` se baat kar sakta hai. Agla step.

### Step 5 — Network band karo

`quarantine-starter.yaml` kholo. Do `TODO` bharo. Phir:

```bash
kubectl apply -f quarantine-starter.yaml
```

<details><summary>💡 Hint</summary>

- TODO 1: label ka naam `quarantine`, value `"true"` — **quotes ke saath**. Bina quotes ke YAML `true` ko boolean samajhta hai aur `kubectl apply` error deta hai.
- TODO 2: do lines — `- Ingress` aur `- Egress`.
- `ingress:` ya `egress:` rules **mat** likho. Koi allow nahi = sab band.
</details>

### Step 6 — Jaancho: 4 sawal, 4 jawab

```bash
kubectl -n lab19 exec "$BAD" -- wget -qO- -T 3 http://$LEDGER_IP
```

👀 `wget: download timed out` — hack hua pod ab `ledger` tak **nahi** pahunchta. ✅

```bash
BAD_IP=$(kubectl -n lab19 get pod "$BAD" -o jsonpath='{.status.podIP}')
kubectl -n lab19 exec client -- wget -qO- -T 3 http://$BAD_IP:8080
```

👀 `wget: download timed out` — koi bhi hack hue pod tak **nahi** pahunchta. ✅

```bash
kubectl -n lab19 exec client -- wget -qO- -T 3 http://notify
```

👀 `notify-ok` — users ke liye `notify` chal raha hai. ✅

```bash
kubectl -n lab19 exec "$BAD" -- ps
```

👀 `xmrig` abhi bhi dikhta hai — pod zinda hai, jaanch ke liye taiyaar. ✅
(`kubectl exec` pod ke network se nahi jaata, node ke kubelet se jaata hai. Isliye NetworkPolicy use nahi rokti.)

<details><summary>💡 Policy lagi, phir bhi <code>ledger-ok</code> aa raha hai?</summary>

Tumhara CNI NetworkPolicy enforce nahi karta. `../09-networkpolicy/check-enforcement.sh` chalao. ❌ aaye toh Lab 09 ke README ka "Plan B: Calico" dekho.
</details>

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/commands.md` aur `solution/quarantine-netpol.yaml`

## 🧭 Decision recap — delete ya quarantine?

| Haalat | Faisla |
|---|---|
| Pod hack hua lagta hai (anjaan process, shell, ajeeb outbound traffic) | **Quarantine.** Saboot → label → NetworkPolicy. Delete sabse aakhir mein |
| Pod bas crash ho raha hai / bug hai | Delete ya rollout restart theek hai — yeh security incident nahi |
| Attacker node tak pahunch gaya ho sakta hai (privileged pod, hostPath) | Node ko bhi `kubectl cordon <node>` karo, phir node ki jaanch |

Asli incident ka poora kram (Kube Gurukul ke level **"BOSS: raat 2:14 — notify pod mein attacker"** mein yahi kram hai):

1. **Saboot** — pod YAML, logs, process list.
2. **Alag karo** — label `app-`, `quarantine=true`.
3. **Network band** — NetworkPolicy `quarantine`.
4. **Chaabiyan badlo** — us pod ke paas jo Secrets / ServiceAccount token / cloud role the, sab rotate karo. Attacker ne unhe padh liya ho sakta hai.
5. **Darwaza band karo** — jis kamzori se attacker ghusa (purani image, khula port), use patch karo.
6. **Tab delete** — forensics poora hone ke baad.

- **Purane connection:** kuch CNI, NetworkPolicy lagne se **pehle bane** connection turant nahi kaat-te. Isliye step 4 (chaabiyan badlo) zaroori hai.
- **Quarantine policy pehle se bana kar rakho.** Raat 2 baje YAML likhna mushkil hai. Policy pehle se lagi ho toh incident mein sirf ek `kubectl label` chahiye.
- **Quarantine wala pod ab "anaath" hai.** ReplicaSet use chhod chuka hai. Deployment delete karne se bhi woh pod nahi jaayega — use naam se delete karna padega.

## 🧹 Cleanup

```bash
kubectl delete ns lab19
```
