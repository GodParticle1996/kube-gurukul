#!/usr/bin/env bash
# Lab 03 verify — readiness / liveness / startup probes
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab03
NS=lab03

title "Lab 03 — shop (readiness)"
ready_eps=$(kubectl -n $NS get endpointslices -l kubernetes.io/service-name=shop -o jsonpath='{range .items[*].endpoints[*]}{.conditions.ready}{"\n"}{end}' 2>/dev/null | grep -c true)
check "Service 'shop' ke paas 2 ready endpoints hain (abhi: $ready_eps)" \
  "pods Running hain par READY 0/1? describe pod → 'Readiness probe failed: HTTP probe failed with statuscode: 404' — probe kis path ko maar raha hai, aur nginx kya serve karta hai?" \
  eq "$ready_eps" "2"
check "client pod se http://shop chalta hai" \
  "endpoints khaali hon toh Service traffic kahin nahi bhejti. Pehle readiness theek karo" \
  kubectl -n $NS exec client -- wget -qO- -T 3 http://shop

title "Lab 03 — slowapp (startup + liveness)"
check "slowapp mein startupProbe hai" \
  "liveness probe app ke boot hone se PEHLE hi maar raha hai (Events: 'failed liveness probe, will be restarted'). Boot ke liye alag probe kaunsa hai?" \
  eq "$(jp $NS deploy/slowapp '{.spec.template.spec.containers[0].startupProbe.httpGet.port}')" "8080"
sp=$(jp $NS deploy/slowapp '{.spec.template.spec.containers[0].startupProbe.periodSeconds}')
sf=$(jp $NS deploy/slowapp '{.spec.template.spec.containers[0].startupProbe.failureThreshold}')
check "startupProbe ka budget boot time (~25s) se zyada hai (abhi: ${sp:-?}s x ${sf:-?})" \
  "budget = periodSeconds x failureThreshold. 25s boot + margin chahiye (jaise 5 x 12 = 60s)" \
  ge "$(( ${sp:-0} * ${sf:-0} ))" 35
check "slowapp mein readinessProbe bhi hai (bina iske 'running' = 'ready' — boot ke dauraan bhi traffic aata)" \
  "probe na ho toh kubelet container start hote hi READY 1/1 likh deta hai. Traffic gate karne wala probe kaunsa hai?" \
  eq "$(jp $NS deploy/slowapp '{.spec.template.spec.containers[0].readinessProbe.httpGet.port}')" "8080"
check "slowapp 1/1 Available" \
  "apply ke baad ~30-40s wait karo (app 25s mein boot hota hai). kubectl -n lab03 get pods -w" \
  eq "$(jp $NS deploy/slowapp '{.status.availableReplicas}')" "1"
rc=$(kubectl -n $NS get pods -l app=slowapp -o jsonpath='{range .items[*]}{.metadata.deletionTimestamp}{"|"}{.status.containerStatuses[0].restartCount}{"\n"}{end}' 2>/dev/null | awk -F'|' '$1 == "" {s += $2} END {print s + 0}')
check "slowapp ke naye pod ka restartCount 0 hai (abhi: $rc)" \
  "abhi bhi restart ho raha hai — startupProbe ka budget kam hai, ya liveness ka initialDelay/threshold dekho" \
  eq "$rc" "0"

summary
