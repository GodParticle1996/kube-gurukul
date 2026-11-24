# 🧪 Lab 16 — kubectl debug: bina shell wale pod ke andar se jaanch

> ⏱️ ~15 min · 📍 namespace `lab16` · 🧠 Concept: **ephemeral (debug) container** · 🧭 Decision: *`exec`, `debug`, ya naya pod — kab kaunsa?*

> ✅ **Test hua (2026-11-24):** asli 3-node **kind** cluster par chala kar — kind v0.33.0, Kubernetes v1.37.0, kubectl v1.37.2, Docker 29.1.3.
> Har step ka "👀 Dikhna chahiye" usi cluster ke asli output se milaya gaya. `./verify.sh` fix se pehle ❌, fix ke baad 8/8 ✅.

## 🎯 Ek line mein

Production image mein aksar **shell hota hi nahi** (distroless). Tab `kubectl exec ... -- sh` fail hota hai.
`kubectl debug` usi pod mein ek **mehmaan container** jodta hai, jiske paas tools hain. Asli container restart nahi hota.

## 🗺️ Mental map — 3 cheezein, 3 naam

| Naam | Kya hai | Is lab mein |
|---|---|---|
| **App container** | Pod ka asli container. Shell nahi hai. | `pay-api` (image `traefik/whoami`) |
| **Debug container** | Mehmaan container. Tum jodte ho. Shell + `wget` + `nslookup` hai. | `dbg` (image `busybox:1.36`) |
| **Pod** | Dono containers ka ghar. **Ek hi IP, ek hi network.** | `pay-api-…` |

Debug container **usi pod ke network** mein baithta hai. Matlab: debug container se `wget` karna = `pay-api` ki jagah khade hokar `wget` karna.

`--target=pay-api` ek aur cheez deta hai: debug container ko `pay-api` ke **processes** bhi dikhte hain (`ps`).

## 🎬 Scenario

ChaiPay ka alert: **`pay-api` → `ledger` call fail: "connection refused"**.

```
pay-api pod ──▶ Service ledger-svc:8080 ──▶ ledger pod
   (shell nahi)        (kuch gadbad?)         (chal raha hai)
```

Tumhe `pay-api` pod ke **andar se** dekhna hai ki call kahan tootti hai.

## 🛠️ Steps

### Step 1 — Lab shuru karo

```bash
kubectl apply -f setup.yaml
kubectl -n lab16 rollout status deploy/pay-api
kubectl -n lab16 rollout status deploy/ledger
```

Ab `pay-api` pod ka naam ek variable `POD` mein rakho. Aage ke saare commands yahi `POD` use karte hain.

```bash
POD=$(kubectl -n lab16 get pod -l app=pay-api -o jsonpath='{.items[0].metadata.name}')
echo "$POD"
```

👀 **Dikhna chahiye:** `pay-api-` se shuru hone wala naam, jaise `pay-api-6d5f7c9b8-x2k4q`.

> 🧠 Naya terminal khola? `POD` variable khaali ho jaata hai. Upar wala `POD=...` command dobara chalao.

### Step 2 — Purana tareeka try karo: `kubectl exec`

```bash
kubectl -n lab16 exec "$POD" -- sh
```

👀 **Dikhna chahiye:** ek lamba error, jiske aakhir mein yeh likha hai:

```
exec: "sh": executable file not found in $PATH
```

Matlab: `pay-api` container mein `sh` naam ki file hai hi nahi. `exec` ka raasta band.

### Step 3 — Debug container jodo

```bash
kubectl -n lab16 debug "$POD" --image=busybox:1.36 --target=pay-api --profile=general -c dbg -- sleep 3600
```

Har hissa kya karta hai:

| Hissa | Matlab |
|---|---|
| `debug "$POD"` | Is pod mein ek mehmaan container jodo |
| `--image=busybox:1.36` | Mehmaan ki image (isme `sh`, `wget`, `nslookup`, `ps` hain) |
| `--target=pay-api` | `pay-api` container ke processes bhi dikhao |
| `--profile=general` | Debug ke liye aam permissions (naye kubectl mein yeh likhna behtar hai) |
| `-c dbg` | Mehmaan container ka naam `dbg` |
| `-- sleep 3600` | Mehmaan 1 ghanta zinda rahe, taaki tum baar-baar command chala sako |

👀 **Dikhna chahiye:** ek line jo `Targeting container "pay-api"` se shuru hoti hai. Phir prompt wapas.

Pakka karo ki `pay-api` container restart **nahi** hua:

```bash
kubectl -n lab16 get pod "$POD"
```

👀 **Dikhna chahiye:** `READY 1/1`, `RESTARTS 0`. (Debug container `READY` ki ginti mein nahi aata.)

<details><summary>💡 Error aaya: "unknown flag: --profile"?</summary>

Tumhara kubectl purana hai. Command se `--profile=general` hata do, baaki wahi rakho.
</details>

### Step 4 — `pay-api` ke processes dekho

```bash
kubectl -n lab16 exec "$POD" -c dbg -- ps
```

👀 **Dikhna chahiye:** list mein `/whoami` (yahi `pay-api` ka process hai) aur `sleep 3600` (yeh `dbg` ka hai).

`-c dbg` ka matlab: command **debug container** mein chalao, `pay-api` container mein nahi.

### Step 5 — Call kahan tootti hai? Pehle DNS

```bash
kubectl -n lab16 exec "$POD" -c dbg -- nslookup ledger-svc.lab16.svc.cluster.local
```

👀 **Dikhna chahiye:** `Name: ledger-svc.lab16.svc.cluster.local` aur ek `Address:` (jaise `10.96.x.x`).

Matlab: **DNS theek hai.** Naam se IP mil raha hai. Bug kahin aur hai.

### Step 6 — Ab asli call

```bash
kubectl -n lab16 exec "$POD" -c dbg -- wget -qO- -T 3 http://ledger-svc:8080/healthz
```

👀 **Dikhna chahiye:** `wget: can't connect to remote host (10.96.x.x): Connection refused`

Matlab: Service `ledger-svc` tak baat pahunchi, par us port par **koi sun nahi raha**.

### Step 7 — Service ke peeche dekho

```bash
kubectl -n lab16 get endpointslices -l kubernetes.io/service-name=ledger-svc
kubectl -n lab16 get deploy ledger -o jsonpath='{.spec.template.spec.containers[0].ports[0].containerPort}{"\n"}'
```

👀 **Dikhna chahiye:** pehle command ke `PORTS` column mein **8081**. Doosre command ka jawab **8080**.

Pakda gaya: Service `ledger-svc` traffic ko pod ke port **8081** par bhejta hai. `ledger` container **8080** par sunta hai.

### Step 8 — Fix karo (sirf ek line)

```bash
kubectl -n lab16 edit svc ledger-svc
```

`targetPort: 8081` ko `targetPort: 8080` karo. Save karke bahar aao.

<details><summary>💡 Editor se dar lagta hai?</summary>

Ek command se bhi ho jaata hai:

```bash
kubectl -n lab16 patch svc ledger-svc --type=json -p '[{"op":"replace","path":"/spec/ports/0/targetPort","value":8080}]'
```
</details>

### Step 9 — `pay-api` ke andar se dobara jaancho

```bash
kubectl -n lab16 exec "$POD" -c dbg -- wget -qO- -T 3 http://ledger-svc:8080/healthz
```

👀 **Dikhna chahiye:** `ok`

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/commands.md` aur `solution/ledger-svc.yaml`

## 🎁 Bonus — `pay-api` ki files dekho (bina shell ke)

`--target=pay-api` ki wajah se `dbg` container, `pay-api` ke process (PID 1) ki filesystem `/proc/1/root` se dekh sakta hai:

```bash
kubectl -n lab16 exec "$POD" -c dbg -- ls /proc/1/root/
```

👀 **Dikhna chahiye:** list mein `whoami` naam ki file. Yahi `pay-api` ki poori image hai — ek binary.

> `Permission denied` aaya? Tab `pay-api` aur `dbg` alag user se chal rahe hain. Asli production mein yeh aam hai.
> Us case mein `--profile=sysadmin` chahiye hota hai (zyada taaqat — sirf zaroorat par).

## 🔍 Browser mission se ek fark

Kube Gurukul ke level **"kubectl debug — jab container mein shell hi na ho"** mein debug container ka naam `debugger-x7k2p` tha (kubectl ne khud diya).
Is lab mein tumne `-c dbg` se naam **khud** diya. Dono sahi hain. Khud naam dena aasaan hai, kyunki naam yaad rehta hai.

## 🧭 Decision recap — kab kaunsa tool?

| Haalat | Tool | Kyun |
|---|---|---|
| Container mein shell hai | `kubectl exec` | Sabse seedha |
| Container mein shell nahi (distroless) | `kubectl debug --target=<container>` | Pod wahi, network wahi, restart nahi |
| Container baar-baar crash ho raha hai | `kubectl debug <pod> --copy-to=<naya-naam>` | Pod ki copy banti hai jisme tum command badal sakte ho |
| Node ki jaanch (kubelet, disk) | `kubectl debug node/<node>` | Node par ek privileged pod |

- **Naya pod banakar test karna (`kubectl run`) kabhi-kabhi jhooth bolta hai.** Naye pod ke labels alag hote hain. NetworkPolicy labels dekhti hai. Toh naye pod se call chal sakti hai aur `pay-api` se nahi (ya ulta).
- **Debug container hataya nahi ja sakta.** Woh pod ke saath hi jaata hai. Kaam ke baad pod ko dobara banana ho toh: `kubectl -n lab16 rollout restart deploy/pay-api`.
- **Production image mein shell mat jodo.** Shell attacker ke bhi kaam aata hai. Tools debug container mein rakho.
- Debug container ka **apna resource limit nahi** hota. Woh pod ke hisse mein se CPU aur memory leta hai. Usme bhaari kaam mat chalao — warna `pay-api` hi OOMKilled ho sakta hai.

## 🧹 Cleanup

```bash
kubectl delete ns lab16
```
