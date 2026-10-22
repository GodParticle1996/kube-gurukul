#!/usr/bin/env bash
# Lab 12 verify — StatefulSet, headless Service, PVC persistence
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab12
NS=lab12

title "Lab 12 — har pod ka apna naam"
check "headless Service 'kv-headless' hai (clusterIP: None)" \
  "StatefulSet ka serviceName 'kv-headless' hai — woh Service banao, clusterIP: None, selector app=kv" \
  eq "$(jp $NS svc/kv-headless '{.spec.clusterIP}')" "None"
check "client se kv-0 ka apna DNS naam resolve hota hai" \
  "kubectl -n lab12 exec client -- nslookup kv-0.kv-headless.lab12.svc.cluster.local" \
  kubectl -n $NS exec client -- nslookup kv-0.kv-headless.lab12.svc.cluster.local
check "client seedha kv-1 tak pahunchta hai (http://kv-1.kv-headless:8080/boot.log)" \
  "per-pod naam: <pod>.<headless-svc>  — normal Service 'kv' koi bhi replica de deti, yeh SIRF kv-1 deta hai" \
  kubectl -n $NS exec client -- wget -qO- -T 3 http://kv-1.kv-headless:8080/boot.log

title "Lab 12 — data pod se zyada jeeta hai"
check "dono PVCs Bound hain (data-kv-0, data-kv-1)" \
  "kubectl -n lab12 get pvc — Pending? StorageClass (kind: 'standard') hai? kubectl get sc" \
  eq "$(kubectl -n $NS get pvc data-kv-0 data-kv-1 -o jsonpath='{.items[*].status.phase}' 2>/dev/null)" "Bound Bound"
lines=$(kubectl -n $NS exec kv-0 -- sh -c 'wc -l < /data/boot.log' 2>/dev/null | tr -d ' ')
check "kv-0 ki boot.log mein 2+ entries (pod delete karke dekha? abhi: ${lines:-0})" \
  "kubectl -n lab12 delete pod kv-0 → naya kv-0 wahi PVC (data-kv-0) pakadta hai → boot.log mein nayi line JUDTI hai, purani bachi rehti hai" \
  ge "${lines:-0}" 2

summary
