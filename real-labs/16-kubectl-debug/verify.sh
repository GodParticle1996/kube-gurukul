#!/usr/bin/env bash
# Lab 16 verify — kubectl debug (ephemeral container) + Service targetPort
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab16
NS=lab16
POD=$(newest_pod $NS app=pay-api)

title "Lab 16 — debug container (pay-api ko chhede bina)"
check "pay-api pod chal raha hai" \
  "kubectl -n lab16 get pods — pay-api Running hona chahiye. Nahi hai? kubectl apply -f setup.yaml dobara" \
  test -n "$POD"
img=$(jp $NS deploy/pay-api '{.spec.template.spec.containers[0].image}')
check "pay-api ki image wahi hai (traefik/whoami — bina shell wali)" \
  "Image badalna ilaaj nahi hai. Production image mein shell jodna = attacker ko bhi shell dena. kubectl debug use karo" \
  contains "$img" "traefik/whoami"
eph=$(jp $NS "pod/$POD" '{.spec.ephemeralContainers[*].name}')
check "pay-api pod mein ek debug (ephemeral) container juda hai${eph:+ — naam: $eph}" \
  "kubectl -n lab16 debug \"\$POD\" --image=busybox:1.36 --target=pay-api --profile=general -c dbg -- sleep 3600" \
  test -n "$eph"

title "Lab 16 — asli bug: Service ledger-svc ka targetPort"
tp=$(jp $NS svc/ledger-svc '{.spec.ports[0].targetPort}')
check "Service ledger-svc ka targetPort 8080 hai (abhi: ${tp:-?})" \
  "ledger container 8080 par sunta hai. Service ka targetPort bhi wahi hona chahiye: kubectl -n lab16 edit svc ledger-svc" \
  eq "$tp" "8080"
ep=$(kubectl -n $NS get endpointslices -l kubernetes.io/service-name=ledger-svc -o jsonpath='{.items[*].ports[*].port}' 2>/dev/null)
check "EndpointSlice mein port 8080 dikh raha hai (abhi: ${ep:-khaali})" \
  "EndpointSlice Service ke targetPort se banta hai. targetPort theek karo, EndpointSlice khud badlega" \
  eq "$ep" "8080"
cp=$(jp $NS deploy/ledger '{.spec.template.spec.containers[0].ports[0].containerPort}')
check "ledger Deployment nahi chheda (containerPort 8080)" \
  "Bug Service mein tha, ledger app mein nahi. ledger ko setup.yaml jaisa rehne do" \
  eq "$cp" "8080"

title "Lab 16 — pay-api pod ke ANDAR se ledger tak"
# chalta hua debug container dhoondo (sleep khatam ho gaya ho toh state.running khaali hota hai)
run=$(kubectl -n $NS get pod "$POD" \
  -o jsonpath='{range .status.ephemeralContainerStatuses[*]}{.name}{"|"}{.state.running.startedAt}{"\n"}{end}' 2>/dev/null \
  | awk -F'|' '$2 != "" { n = $1 } END { print n }')
check "ek debug container abhi chal raha hai${run:+ — $run}" \
  "Purana debug container band ho gaya (sleep khatam / shell se exit). Naya jodo, naya naam do: ... -c dbg2 -- sleep 3600" \
  test -n "$run"
reach() { [ "$(kubectl -n $NS exec "$POD" -c "$run" -- wget -qO- -T 3 http://ledger-svc:8080/healthz 2>/dev/null)" = "ok" ]; }
check "debug container se http://ledger-svc:8080/healthz ka jawab 'ok' aata hai" \
  "Abhi bhi 'Connection refused'? kubectl -n lab16 get endpointslices -l kubernetes.io/service-name=ledger-svc — PORTS mein 8080 hona chahiye" \
  reach

summary
