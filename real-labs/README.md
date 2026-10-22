# 🧪 KubeGurukul — Real Cluster Labs

**Simulator mein seekha, ab asli cluster par karo.** Har lab ek *toota hua* production scenario hai:
tum diagnose karte ho, fix karte ho, aur `./verify.sh` batata hai ki sach mein theek hua — ❌ par **hint** milta hai, jawab nahi.

> ✅ Saare 15 labs ek asli 3-node **kind** cluster (Kubernetes v1.32) par chala ke test kiye gaye hain —
> broken state, beech ke fixes, solution, aur `verify.sh` PASS.

## ⚡ Setup (ek baar, ~3 min)

Chahiye: **Docker**, **kind**, **kubectl** (Lab 15 ke liye **helm** bhi). WSL2 + Docker Desktop bilkul chalega.

```bash
cd real-labs
./setup.sh                 # kind cluster "gurukul" (1 control-plane + 2 workers) + metrics-server
kubectl get nodes          # 3 nodes Ready
```

<details><summary>minikube use karte ho?</summary>

```bash
minikube start --nodes 3
minikube addons enable metrics-server
# kind-config.yaml wale labels khud lagao (Lab 05 inhe use karta hai):
kubectl label node minikube-m02 gurukul/zone=zone-a
kubectl label node minikube-m03 gurukul/zone=zone-b disktype=ssd
```
</details>

## 🔁 Har lab ka ek hi pattern

```
1. README.md padho   →  🎯 ek line · 🗺️ mental map · 🎬 scenario
2. kubectl apply -f setup.yaml   (kuch labs: ./setup.sh)
3. Steps follow karo — har step mein "👀 Dikhna chahiye" likha hai (andaaza nahi lagana)
4. Fix karo  →  ./verify.sh   (❌ = hint, dobara try)
5. Phas gaye? solution/ dekho · 🧭 Decision recap padho · 🧹 Cleanup
```

> 🧠 **ADHD-friendly tip:** ek baar mein ek lab. Har lab ~10-25 min. Beech mein chhodna pade toh koi baat nahi —
> cluster wahi rehta hai, `./verify.sh` batayega kahan the.

## 🗺️ Labs — kaunsa concept, kaunsa decision

| # | Lab | Concept | 🧭 Decision jo seekhoge |
|---|---|---|---|
| 01 | [CrashLoopBackOff + OOMKilled](01-crashloop-oom/) | Exit codes, `logs --previous`, memory limits | Crash dekha → pehla command kaunsa? Limit = peak ya average? |
| 02 | [ImagePullBackOff](02-imagepull/) | Registry errors, pull secrets | Error message se 5 wajahon mein se ek chuno |
| 03 | [Probes](03-probes/) | readiness vs liveness vs startup | Kaunsa probe fail hone par kya hota hai? |
| 04 | [Service + DNS](04-service-dns/) | selector, targetPort, cross-namespace DNS | Error se pakdo kaunsa hop toota |
| 05 | [Pending pods](05-scheduling/) | nodeSelector, taints/tolerations, requests | Pod ko kheenchna (affinity) ya node se bhagana (taint)? |
| 06 | [Pods gayab](06-quota-qos/) | ResourceQuota, LimitRange, QoS | Budget badhao ya right-size? Rollout + quota deadlock |
| 07 | [Config reload](07-config-reload/) | env vs volume vs subPath | Config badla — restart chahiye ya nahi? |
| 08 | [RBAC](08-rbac/) | ServiceAccount, Role vs ClusterRole | Kaunsa Role + Binding combo, least privilege |
| 09 | [NetworkPolicy](09-networkpolicy/) | default deny, allow rules, DNS egress | Zero-trust kaise banayein (aur CNI enforce karta hai?) |
| 10 | [HPA](10-hpa/) | metrics-server, utilization = usage ÷ request | HPA vs VPA vs KEDA vs node autoscaler |
| 11 | [Rollout + PDB + drain](11-rollout-pdb/) | maxUnavailable/maxSurge, PDB, rollback | minAvailable ya maxUnavailable? Safe rollout settings |
| 12 | [StatefulSet](12-statefulset/) | headless Service, PVC per pod | Deployment ya StatefulSet? |
| 13 | [Jobs & CronJobs](13-jobs-cronjobs/) | backoffLimit, concurrencyPolicy | Forbid / Replace / Allow — kab kaunsa? |
| 14 | [Stuck Terminating](14-finalizers/) | finalizers, namespace conditions | Finalizer kab hatana theek — kab bilkul nahi |
| 15 | [Helm hands-on](15-helm/) | template bugs, values precedence, `--atomic` | Config `-f` file mein ya `--set` mein? |

**Suggested order:** 01 → 02 → 03 → 04 → 05 (troubleshooting ki neev) · phir jo production mein chahiye.
App ke **🧭 Decision Dojo** mein inhi decisions ke interactive decision-trees hain.

## 🧹 Sab saaf karna

```bash
./cleanup-all.sh                      # saare lab namespaces + taint + RBAC + uncordon
kind delete cluster --name gurukul    # poora cluster hatana ho toh
```

## 🧰 Structure (naya lab jodna ho toh)

```
NN-naam/
  README.md      🎯 ek line · 🗺️ mental map · 🎬 scenario · 🛠️ steps (👀 dikhna chahiye) · ✅ verify · 🧭 decision recap · 🧹 cleanup
  setup.yaml     toota hua scenario (galti JAAN-BOOJH kar)
  verify.sh      source ../lib/verify.sh → check "kya" "hint" <command> … → summary
  solution/      sahi YAML / commands
```

`lib/verify.sh` ke helpers: `check`, `jp` (jsonpath), `eq`, `contains`, `ge`, `to_mib`, `newest_pod`, `need_cluster`, `need_ns`, `summary`.
