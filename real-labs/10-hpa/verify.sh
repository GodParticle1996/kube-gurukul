#!/usr/bin/env bash
# Lab 10 verify — HPA + metrics
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab10
NS=lab10

title "Lab 10 — HPA ke paas data hai?"
check "Metrics API chal raha hai (kubectl top nodes)" \
  "metrics-server nahi hai/ready nahi: ../setup.sh metrics chalao, 1 min ruko" \
  kubectl top nodes
check "cpu-api container mein CPU request hai" \
  "'kubectl -n lab10 describe hpa cpu-api' → 'missing request for cpu'. Utilization = usage ÷ request — request ke bina % kiska?" \
  test -n "$(jp $NS deploy/cpu-api '{.spec.template.spec.containers[0].resources.requests.cpu}')"
check "HPA ScalingActive = True (metrics mil rahe hain)" \
  "fix ke baad 30-60s lagte hain. Abhi bhi False? describe hpa ke Conditions/Events padho" \
  eq "$(kubectl -n $NS get hpa cpu-api -o jsonpath='{.status.conditions[?(@.type=="ScalingActive")].status}' 2>/dev/null)" "True"
cur=$(kubectl -n $NS get hpa cpu-api -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}' 2>/dev/null)
check "HPA ko current CPU % dikh raha hai (abhi: ${cur:-<unknown>}%)" \
  "TARGETS '<unknown>/50%' = HPA andha hai. Requests + metrics-server dono chahiye" \
  test -n "$cur"

title "Lab 10 — autoscaling khud dekha?"
check "HPA ne kam se kam ek baar scale kiya (lastScaleTime)" \
  "load chalao: kubectl -n lab10 scale deploy/loadgen --replicas=2 → kubectl -n lab10 get hpa -w (1-2 min)" \
  test -n "$(kubectl -n $NS get hpa cpu-api -o jsonpath='{.status.lastScaleTime}' 2>/dev/null)"

summary
