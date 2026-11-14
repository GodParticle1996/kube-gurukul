#!/usr/bin/env bash
# Lab 18 verify — ValidatingAdmissionPolicy: blocked pod ki wajah + Warn → Deny
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab18
NS=lab18
VAPB=validatingadmissionpolicybinding

title "Lab 18 — Part A: notify Deployment chal gaya"
img=$(jp $NS deploy/notify '{.spec.template.spec.containers[0].image}')
tag_ok() { contains "$img" ":" && ! contains "$img" ":latest"; }
check "Deployment notify ki image par pakka tag hai (abhi: ${img:-Deployment nahi mila})" \
  "kubectl -n lab18 set image deploy/notify nginx=nginx:1.27-alpine" \
  tag_ok
check "notify ka kam se kam 1 pod Ready hai" \
  "Pod nahi bana? kubectl -n lab18 describe rs -l app=notify → Events mein policy ka naam padho" \
  ge "$(jp $NS deploy/notify '{.status.readyReplicas}')" 1
check "Policy lab18-no-latest abhi bhi Deny mode mein hai (policy kamzor nahi ki)" \
  "Binding lab18-no-latest ko mat chhedo. Ilaaj image theek karna tha, policy hatana nahi. kubectl apply -f setup.yaml se wapas lao" \
  contains "$(kubectl get $VAPB lab18-no-latest -o jsonpath='{.spec.validationActions}' 2>/dev/null)" "Deny"
latest_blocked() { ! kubectl -n $NS run verify-latest --image=nginx:latest --restart=Never --dry-run=server >/dev/null 2>&1; }
check "':latest' wala Pod abhi bhi roka jaata hai (server dry-run se jaancha)" \
  "Policy ya Binding lab18-no-latest gayab hai. kubectl apply -f setup.yaml dobara chalao" \
  latest_blocked

title "Lab 18 — Part B: doosri policy Warn se Deny tak"
acts=$(kubectl get $VAPB lab18-require-requests -o jsonpath='{.spec.validationActions}' 2>/dev/null)
check "Binding lab18-require-requests maujood hai" \
  "Bina Binding ke policy so rahi hai: kubectl apply -f binding-warn.yaml" \
  test -n "$acts"
# lab18 ke har Deployment ke har container mein cpu + memory request?
missing=$(kubectl -n $NS get deploy -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{.spec.template.spec.containers[0].resources.requests.cpu}{"|"}{.spec.template.spec.containers[0].resources.requests.memory}{"\n"}{end}' 2>/dev/null \
  | awk -F'|' '$1 != "" && ($2 == "" || $3 == "") { printf "%s ", $1 }')
check "lab18 ke saare Deployments mein CPU + memory request hai${missing:+ (kami: $missing)}" \
  "Deny se PEHLE purane workloads theek karo: kubectl -n lab18 set resources deploy/<naam> --requests=cpu=50m,memory=32Mi" \
  test -z "$missing"
check "Binding lab18-require-requests ab Deny mode mein hai (abhi: ${acts:-nahi mila})" \
  "kubectl patch $VAPB lab18-require-requests --type=merge -p '{\"spec\":{\"validationActions\":[\"Deny\"]}}'" \
  contains "$acts" "Deny"
bad_blocked() { ! kubectl -n $NS create deployment verify-bad --image=nginx:1.27-alpine --dry-run=server >/dev/null 2>&1; }
check "Bina requests wala Deployment roka jaata hai (server dry-run se jaancha)" \
  "Deny lagane ke baad 15 second ruko, phir ./verify.sh. Tab bhi fail? kubectl get $VAPB lab18-require-requests -o yaml dekho" \
  bad_blocked
good_allowed() {
  cat <<YAML | kubectl apply --dry-run=server -f - >/dev/null 2>&1
apiVersion: apps/v1
kind: Deployment
metadata: { name: verify-good, namespace: lab18 }
spec:
  replicas: 1
  selector: { matchLabels: { app: verify-good } }
  template:
    metadata: { labels: { app: verify-good } }
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine
          resources: { requests: { cpu: 10m, memory: 16Mi } }
YAML
}
check "Sahi Deployment (tag + requests) abhi bhi paas hota hai" \
  "Policy itni sakht ho gayi ki sahi YAML bhi ruk raha hai. Policy lab18-require-requests ko setup.yaml jaisa rakho" \
  good_allowed

summary
