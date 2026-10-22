#!/usr/bin/env bash
# Lab 06 verify — ResourceQuota / LimitRange / QoS
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab06
NS=lab06

title "Lab 06 — gayab pods wapas aaye?"
check "reports ke 3/3 replicas Available (abhi: $(jp $NS deploy/reports '{.status.availableReplicas}'))" \
  "'kubectl -n lab06 get deploy' READY 2/3? Pod banta hi nahi toh pod ke events nahi milenge — ReplicaSet ke events padho: kubectl -n lab06 describe rs -l app=reports. Fix ke baad 1-2 min wait (RS backoff se retry karta hai)" \
  eq "$(jp $NS deploy/reports '{.status.availableReplicas}')" "3"
check "cache ka 1/1 replica Available" \
  "describe rs -l app=cache → 'must specify limits.memory' — quota wale namespace mein har container ko memory request+limit chahiye. Har deployment mein likhoge, ya namespace ke DEFAULTS kahan set hote hain?" \
  eq "$(jp $NS deploy/cache '{.status.availableReplicas}')" "1"
check "Namespace mein LimitRange (container defaults) hai" \
  "kind: LimitRange — type: Container, default + defaultRequest" \
  test -n "$(kubectl -n $NS get limitrange -o name 2>/dev/null)"

title "Lab 06 — QoS samjha?"
check "reports pods ki QoS class Guaranteed hai (requests = limits, CPU + memory dono)" \
  "kubectl -n lab06 get pod <pod> -o jsonpath='{.status.qosClass}' — Guaranteed ke liye har container mein cpu+memory ki request = limit" \
  eq "$(kubectl -n $NS get pods -l app=reports -o jsonpath='{.items[0].status.qosClass}' 2>/dev/null)" "Guaranteed"
used=$(to_mib "$(jp $NS quota/team-budget '{.status.used.limits\.memory}')")
hard=$(to_mib "$(jp $NS quota/team-budget '{.status.hard.limits\.memory}')")
check "Quota budget mein sab fit hai (used ${used}Mi / hard ${hard}Mi)" \
  "kubectl -n lab06 describe quota team-budget" \
  ge "$hard" "$used"

summary
