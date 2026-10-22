#!/usr/bin/env bash
# Lab 07 verify — ConfigMap: env vs volume vs subPath
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab07
NS=lab07

title "Lab 07 — naya greeting app tak pahuncha?"
check "ConfigMap mein GREETING = namaste-v2" \
  "kubectl -n lab07 edit configmap greeter-config (ya patch) — value 'namaste-v2' karo" \
  eq "$(jp $NS cm/greeter-config '{.data.GREETING}')" "namaste-v2"

pod=$(newest_pod $NS app=greeter)
check "Volume wali file mein naya greeting (abhi: $(kubectl -n $NS exec "$pod" -- cat /config/GREETING 2>/dev/null))" \
  "volume update mein ~1-2 min lagte hain (kubelet sync). Logs dekhte raho: kubectl -n lab07 logs deploy/greeter -f" \
  eq "$(kubectl -n $NS exec "$pod" -- cat /config/GREETING 2>/dev/null)" "namaste-v2"
check "Env var mein naya greeting (abhi: $(kubectl -n $NS exec "$pod" -- printenv GREETING 2>/dev/null))" \
  "env var container START hote waqt ek baar set hota hai — chalte container mein kabhi nahi badalta. Naya container chahiye... kaunsa command pods ko naye siro se banata hai?" \
  eq "$(kubectl -n $NS exec "$pod" -- printenv GREETING 2>/dev/null)" "namaste-v2"
check "subPath wali file mein naya greeting" \
  "subPath mount kabhi auto-update nahi hota (bind mount ek file ka snapshot hai) — env jaisa hi ilaaj" \
  eq "$(kubectl -n $NS exec "$pod" -- cat /etc/greeting.txt 2>/dev/null)" "namaste-v2"

summary
