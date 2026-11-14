#!/usr/bin/env bash
# Lab 19 verify — quarantine: label se alag + NetworkPolicy se band + saboot zinda
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab19
NS=lab19
reach()   { kubectl -n $NS exec "$1" -- wget -qO- -T 3 "$2" >/dev/null 2>&1; }
blocked() { ! reach "$1" "$2"; }

Q=$(kubectl -n $NS get pod -l quarantine=true -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)
NQ=$(echo $Q | wc -w | tr -d ' ')
QP=$(echo $Q | awk '{ print $1 }')
QIP=$(jp $NS "pod/${QP:-none}" '{.status.podIP}')
LEDGER_IP=$(jp $NS svc/ledger '{.spec.clusterIP}')

title "Lab 19 — saboot zinda hai (pod delete nahi hua)"
check "Theek 1 pod par label quarantine=true hai (abhi: $NQ)" \
  "kubectl -n lab19 label pod \"\$BAD\" app- quarantine=true   (BAD = alert wala pod; naam bhool gaye? ./attack.sh dobara chalao)" \
  eq "$NQ" "1"
check "Quarantine wala pod Running hai" \
  "Pod delete kar diya? Tab saboot gaya. Lab dobara: kubectl delete ns lab19, phir setup + attack.sh" \
  eq "$(jp $NS "pod/${QP:-none}" '{.status.phase}')" "Running"
has_miner() { kubectl -n $NS exec "$QP" -- ps 2>/dev/null | grep -q xmrig; }
check "Quarantine wale pod mein 'xmrig' process abhi bhi dikhta hai (sahi pod pakda)" \
  "Galat pod quarantine hua? ./attack.sh dobara chalao — alert mein sahi pod ka naam hai. Galat pod se label hatao: kubectl -n lab19 label pod <naam> quarantine- app=notify" \
  has_miner

title "Lab 19 — pod Service aur ReplicaSet se alag"
check "Quarantine wale pod par 'app' label nahi hai" \
  "'app-' (aakhir mein minus) label ko hatata hai: kubectl -n lab19 label pod \"\$BAD\" app-" \
  test -z "$(jp $NS "pod/${QP:-none}" '{.metadata.labels.app}')"
check "notify Deployment ke 2 pods Ready hain (ReplicaSet ne naya pod bana diya)" \
  "Label hatne ke baad ReplicaSet khud naya pod banata hai. 30 second ruko: kubectl -n lab19 get pods --show-labels" \
  eq "$(jp $NS deploy/notify '{.status.readyReplicas}')" "2"
eps=$(kubectl -n $NS get endpointslices -l kubernetes.io/service-name=notify -o jsonpath='{.items[*].endpoints[*].addresses[*]}' 2>/dev/null)
not_in_eps() { [ -n "$QIP" ] && ! echo " $eps " | grep -qF " $QIP "; }
check "Service notify ke EndpointSlice mein quarantine wale pod ka IP nahi hai" \
  "Service selector app=notify dekhta hai. Pod par se 'app' label hatao" \
  not_in_eps

title "Lab 19 — NetworkPolicy 'quarantine'"
check "NetworkPolicy quarantine, label quarantine=true wale pods ko chunti hai" \
  "podSelector.matchLabels mein  quarantine: \"true\"  likho (quotes ke saath)" \
  eq "$(jp $NS networkpolicy/quarantine '{.spec.podSelector.matchLabels.quarantine}')" "true"
pt=$(jp $NS networkpolicy/quarantine '{.spec.policyTypes[*]}')
both() { contains "$pt" "Ingress" && contains "$pt" "Egress"; }
check "policyTypes mein Ingress aur Egress dono hain (abhi: ${pt:-khaali})" \
  "Sirf Ingress likhoge toh hack hua pod bahar baat kar sakta hai (data chori). Dono likho" \
  both
norules() { kubectl -n $NS get networkpolicy quarantine >/dev/null 2>&1 && [ -z "$(jp $NS networkpolicy/quarantine '{.spec.ingress}')" ] && [ -z "$(jp $NS networkpolicy/quarantine '{.spec.egress}')" ]; }
check "Policy mein koi allow rule nahi (ingress/egress list khaali)" \
  "Quarantine = sab band. ingress: aur egress: wale hisse hata do" \
  norules

title "Lab 19 — asli traffic (CNI enforce karta ho tab)"
enf="Policy sahi hai phir bhi traffic gaya? Tumhara CNI NetworkPolicy enforce nahi karta: ../09-networkpolicy/check-enforcement.sh chalao (Lab 09 ka Plan B: Calico)"
q_out_blocked() { [ -n "$QP" ] && [ -n "$LEDGER_IP" ] && blocked "$QP" "http://$LEDGER_IP"; }
q_in_blocked()  { [ -n "$QIP" ] && blocked client "http://$QIP:8080"; }
check "Quarantine wala pod → ledger BAND" "$enf" q_out_blocked
check "client → quarantine wala pod (seedha IP) BAND" "$enf" q_in_blocked
check "client → Service notify chalta hai (users par asar nahi)" \
  "notify ke 2 naye/purane pods Ready hone chahiye: kubectl -n lab19 get pods -l app=notify" \
  reach client http://notify
check "client → ledger chalta hai (policy ne baaki pods ko nahi roka)" \
  "Policy ka podSelector sirf quarantine=true ko chune. podSelector: {} likha toh poora namespace band ho jaata hai" \
  reach client http://ledger

summary
