# 🧪 Lab 03 — Probes: readiness, liveness, startup (kaunsa probe kab?)

> ⏱️ ~20 min · 📍 namespace `lab03` · 🧠 Concept: **teen probes, teen alag kaam** · 🧭 Decision: *kis probe ka fail hona kya karta hai?*

## 🎯 Ek line mein

**Readiness** = "traffic bhejo ya nahi?" · **Liveness** = "restart karo ya nahi?" · **Startup** = "abhi boot ho raha hai, baaki dono ko roko".
Galat probe = ya toh traffic black-hole, ya restart ka infinite loop.

## 🗺️ Mental map — probe fail hua toh kya hota hai?

| Probe | Fail hone par kubelet kya karta hai | Pod ka haal | Kab use karo |
|---|---|---|---|
| **readinessProbe** | Pod ko Service ke **endpoints se hata** deta hai. Restart **nahi** | `Running` par `0/1` READY | Hamesha (har serving app) — "traffic lene layak hoon?" |
| **livenessProbe** | Container ko **maar ke restart** karta hai | `RESTARTS` badhta hai, exit code 137 | Sirf tab jab app *atak* sakta hai (deadlock) aur restart se theek hota hai |
| **startupProbe** | Jab tak pass na ho, readiness+liveness **chalte hi nahi**. Budget khatam → restart | Boot ke dauraan protection | Slow-boot apps (JVM, migrations, cache warm-up) |

> ⚠️ **Sabse common production galti:** liveness probe ko readiness ki tarah use karna — DB slow hua → liveness fail →
> **saare pods ek saath restart** → outage aur bada. Liveness mein **external dependency (DB, API) kabhi check mat karo.**

## 🎬 Scenario

Do teams, do problems:
- **shop** team: *"pods Running hain, par website nahi khul rahi!"*
- **slowapp** team: *"pod baar-baar restart ho raha hai, logs mein koi error hi nahi!"*

## 🛠️ Steps

### Step 1 — Lab shuru karo, 45 sec ruko

```bash
kubectl apply -f setup.yaml
sleep 45; kubectl -n lab03 get pods
```

👀 **Dikhna chahiye:** `shop-*` → `Running` par `0/1`. `slowapp-*` → `RESTARTS` badhta hua.

### Step 2 — shop: Running hai par traffic kyun nahi?

```bash
kubectl -n lab03 exec client -- wget -qO- -T 3 http://shop          # fail
kubectl -n lab03 get endpointslices -l kubernetes.io/service-name=shop
kubectl -n lab03 describe pod -l app=shop | grep -i "readiness probe failed"
```

👀 **Dikhna chahiye:** `Connection refused`, endpoints mein koi ready address nahi, aur
`Readiness probe failed: HTTP probe failed with statuscode: 404`.

<details><summary>💡 Hint</summary>

404 = server zinda hai, par **woh path** exist nahi karta. Probe kis path par jaa raha hai? nginx default mein kya serve karta hai?
</details>

### Step 3 — slowapp: bina error ke restart kyun?

```bash
kubectl -n lab03 logs deploy/slowapp --previous
kubectl -n lab03 describe pod -l app=slowapp | grep -E "Liveness|will be restarted|Exit Code"
```

👀 **Dikhna chahiye:** logs mein sirf `booting...` (app boot ho hi raha tha!), Events mein
`Liveness probe failed ... connection refused` aur `Exit Code: 137`.
App ko 25s chahiye, liveness ~20s mein maar deta hai → infinite loop.

> 🔍 Ek aur cheez notice karo: restart ke beech slowapp `READY 1/1` dikhta hai jabki woh serve **nahi** kar raha —
> kyunki uska koi **readinessProbe** hi nahi. Readiness na ho toh "process chal raha hai" = "ready".

<details><summary>💡 Hint</summary>

`initialDelaySeconds` badha ke bhi chal jaayega — par woh har baar (crash-restart ke baad bhi) itna wait karega, aur boot time badla toh phir toot jaayega.
Saaf tareeka: **startupProbe** jiska budget `periodSeconds × failureThreshold` boot time se zyada ho. Aur ek **readinessProbe** bhi jodo.
</details>

### Step 4 — Dono fix karo, apply karo, ~45s ruko

## ✅ Verify

```bash
./verify.sh
```

Phas gaye? → `solution/fixed.yaml`

## 🧭 Decision recap — production mein kab kya?

- **Har serving app:** readinessProbe ✅ (yeh traffic ka darwaza hai).
- **Slow boot?** startupProbe ✅ — `initialDelaySeconds` ke hacks se behtar.
- **Liveness?** Sirf tab jab app **atak** sakta ho aur restart se theek ho. Shak ho toh **mat lagao** — galat liveness, koi liveness na hone se zyada outage karata hai.
- **Probe kya check kare?** Readiness: "kya main request serve kar sakta hoon" (zaroori dependency bhi chalegi, par timeouts chhote).
  Liveness: sirf process ki apni sehat (`/healthz` jo kuch external na chhuye).
- **Timeouts:** `timeoutSeconds` default **1s** hai — heavy endpoint par probe khud flaky ho jaata hai. Probe endpoint halka rakho.

## 🧹 Cleanup

```bash
kubectl delete ns lab03
```
