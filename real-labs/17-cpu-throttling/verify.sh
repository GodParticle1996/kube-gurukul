#!/usr/bin/env bash
# Lab 17 verify — CPU throttling (cgroup cpu.stat) + sahi request/limit
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab17
NS=lab17

# CPU quantity → millicore ("200m" → 200, "1" → 1000, "1.5" → 1500, khaali → 0)
to_milli() {
  case "$1" in
    '')  echo 0 ;;
    *m)  echo "${1%m}" ;;
    *)   awk -v v="$1" 'BEGIN { printf "%d", v * 1000 }' ;;
  esac
}
# container ke andar se throttling ki ginti (cgroup v2 ka raasta pehle, phir cgroup v1 ka)
throttled() {
  kubectl -n $NS exec "$1" -- sh -c 'cat /sys/fs/cgroup/cpu.stat 2>/dev/null || cat /sys/fs/cgroup/cpu/cpu.stat' 2>/dev/null \
    | awk '$1 == "nr_throttled" { print $2 }'
}

title "Lab 17 — fraud-check ke resources"
check "Deployment fraud-check ka rollout poora hai" \
  "kubectl -n lab17 rollout status deploy/fraud-check. Pod Pending hai? CPU request node se bada ho gaya — request 500m kar do" \
  kubectl -n $NS rollout status deploy/fraud-check --timeout=60s
lim=$(jp $NS deploy/fraud-check '{.spec.template.spec.containers[0].resources.limits.cpu}')
req=$(jp $NS deploy/fraud-check '{.spec.template.spec.containers[0].resources.requests.cpu}')
mem=$(jp $NS deploy/fraud-check '{.spec.template.spec.containers[0].resources.limits.memory}')
lim_ok() { [ -z "$lim" ] || [ "$(to_milli "$lim")" -ge 1500 ]; }
check "CPU limit hata diya, ya 1500m ya usse zyada hai (abhi: ${lim:-koi limit nahi})" \
  "fraud-check ko 1 poora core chahiye. Limit 200m = har 100ms mein sirf 20ms. Limit hatao ya 1500m karo" \
  lim_ok
check "CPU request 500m ya usse zyada hai (abhi: ${req:-khaali})" \
  "Request = app sach mein kitna CPU leta hai. fraud-check ~1 core leta hai, request 100m jhooth hai → scheduler bhari node par bhej dega" \
  ge "$(to_milli "$req")" 500
check "Memory limit abhi bhi laga hai (abhi: ${mem:-HATA DIYA})" \
  "CPU limit hatana theek hai, memory limit NAHI. Memory limit wapas lagao (32Mi)" \
  test -n "$mem"

title "Lab 17 — throttling sach mein ruki?"
POD=$(newest_pod $NS app=fraud-check)
t1=$(throttled "$POD"); sleep 5; t2=$(throttled "$POD")
delta=$(( ${t2:-999999} - ${t1:-0} ))
not_throttled() { [ -n "$t1" ] && [ -n "$t2" ] && [ "$delta" -le 2 ]; }
check "5 second mein nr_throttled nahi badha (badha: ${delta})" \
  "nr_throttled badh raha hai = kernel abhi bhi rok raha hai. kubectl -n lab17 exec deploy/fraud-check -- cat /sys/fs/cgroup/cpu.max dekho" \
  not_throttled
check "fraud-check abhi bhi kaam kar raha hai (logs mein 'batch ... ms')" \
  "Kaam band karke throttling nahi hatani. Container ka command setup.yaml jaisa rehne do" \
  contains "$(kubectl -n $NS logs "$POD" --tail=3 2>/dev/null)" "batch"

summary
