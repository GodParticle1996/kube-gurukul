#!/usr/bin/env bash
# Lab 05 verify — scheduling: nodeSelector / taints+tolerations / resources
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab05
NS=lab05

title "Lab 05 — orders-db sahi node par?"
check "ssd node par 'dedicated=database:NoSchedule' taint laga hai (lab ka setup)" \
  "./setup.sh chalaya tha? (yeh taint lagata hai)" \
  contains "$(kubectl get nodes -l disktype=ssd -o jsonpath='{.items[*].spec.taints[*].key}' 2>/dev/null)" "dedicated"
dbpod=$(kubectl -n $NS get pods -l app=orders-db --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
check "orders-db pod Running hai" \
  "describe pod ka 'Events → FailedScheduling' padho: '0/3 nodes are available: ...' — har node ka reason alag likha hota hai" \
  test -n "$dbpod"
dbnode=$(kubectl -n $NS get pod "$dbpod" -o jsonpath='{.spec.nodeName}' 2>/dev/null)
check "orders-db ssd wale node par hai (abhi: ${dbnode:-none})" \
  "pod ko node CHUNWANE ke liye nodeSelector/nodeAffinity — node ke labels dekho: kubectl get nodes --show-labels" \
  eq "$(kubectl get node "${dbnode:-x}" -o jsonpath='{.metadata.labels.disktype}' 2>/dev/null)" "ssd"
check "orders-db ke paas 'dedicated' taint ki toleration hai" \
  "nodeSelector sahi hone ke baad bhi Pending? 'untolerated taint {dedicated: database}' — taint ko sehne ke liye pod ko kya chahiye?" \
  contains "$(jp $NS deploy/orders-db '{.spec.template.spec.tolerations[*].key}')" "dedicated"

title "Lab 05 — report-worker"
check "report-worker pod Running hai" \
  "'Insufficient cpu' = koi node itna CPU de hi nahi sakta. 'kubectl describe node' mein Allocatable dekho — request asli zaroorat jitni rakho" \
  test -n "$(kubectl -n $NS get pods -l app=report-worker --field-selector=status.phase=Running -o name 2>/dev/null)"

summary
