#!/usr/bin/env bash
# Lab 01 verify — CrashLoopBackOff + OOMKilled
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab01
NS=lab01

title "Lab 01 — orders-api theek hua?"
envnames=$(jp $NS deploy/orders-api '{.spec.template.spec.containers[0].env[*].name}')
check "Container ko DB_URL env var milta hai (exit code 1 wali galti)" \
  "logs --previous mein FATAL line padho — app kis NAAM ka env var dhoondh raha hai? Deployment mein kya naam diya hai?" \
  contains " $envnames " " DB_URL "

lim=$(to_mib "$(jp $NS deploy/orders-api '{.spec.template.spec.containers[0].resources.limits.memory}')")
check "Memory limit startup peak cover karti hai (>= 192Mi)" \
  "describe pod mein 'Last State: Terminated, Reason: OOMKilled, Exit Code: 137' dikha? Cache warm-up ka peak ~170Mi hai — limit ko margin ke saath badhao" \
  ge "$lim" 192

req=$(to_mib "$(jp $NS deploy/orders-api '{.spec.template.spec.containers[0].resources.requests.memory}')")
check "Memory request = limit (memory ke liye production best practice)" \
  "request kam aur limit zyada → node par bharose se zyada pods pack ho jaate hain → node-level OOM. Memory: request = limit rakho" \
  eq "$req" "$lim"

check "Deployment ke saare 2 replicas Available hain" \
  "kubectl -n lab01 get pods -w — CrashLoopBackOff/OOMKilled abhi bhi hai? describe pod ke Events padho" \
  eq "$(jp $NS deploy/orders-api '{.status.availableReplicas}')" "2"

# terminate ho rahe purane pods (deletionTimestamp set) ko mat gino — woh toh ja hi rahe hain
oom=$(kubectl -n $NS get pods -l app=orders-api -o jsonpath='{range .items[*]}{.metadata.deletionTimestamp}{"|"}{.status.containerStatuses[0].lastState.terminated.reason}{"|"}{.status.containerStatuses[0].state.terminated.reason}{"\n"}{end}' 2>/dev/null \
  | awk -F'|' '$1 == "" && ($2 == "OOMKilled" || $3 == "OOMKilled")' | wc -l | tr -d ' ')
check "Chal rahe pods mein koi OOMKilled nahi" \
  "naye pods abhi bhi OOMKill ho rahe hain — limit aur badhao ya CACHE_MB dekho" \
  eq "$oom" "0"

summary
