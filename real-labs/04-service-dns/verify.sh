#!/usr/bin/env bash
# Lab 04 verify — Service selector / targetPort / cross-namespace DNS
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab04; need_ns lab04-frontend
NS=lab04

title "Lab 04 — client → DNS → Service → Pod"
n_eps=$(kubectl -n $NS get endpointslices -l kubernetes.io/service-name=payments -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{"\n"}{end}' 2>/dev/null | grep -c .)
check "Service 'payments' ke paas 2 endpoints hain (abhi: $n_eps)" \
  "endpoints khaali = selector kisi pod se match nahi karta. 'kubectl -n lab04 get pods --show-labels' aur Service ka selector akshar-akshar milao" \
  eq "$n_eps" "2"

ep_port=$(kubectl -n $NS get endpointslices -l kubernetes.io/service-name=payments -o jsonpath='{.items[0].ports[0].port}' 2>/dev/null)
check "Endpoints ka port container ke port (80) par hai (abhi: ${ep_port:-?})" \
  "Service ka targetPort container ke andar ka port hona chahiye — pod kis port par sun raha hai? (containerPort dekho)" \
  eq "$ep_port" "80"

url=$(jp lab04-frontend cm/frontend-config '{.data.PAYMENTS_URL}')
check "frontend URL namespace batata hai (abhi: $url)" \
  "chhota naam 'payments' sirf USI namespace mein resolve hota hai jahan client hai. Client lab04-frontend mein hai — <service>.<namespace> format try karo" \
  contains "$url" "payments.lab04"
check "client (lab04-frontend) se PAYMENTS_URL sach mein chalta hai" \
  "kubectl -n lab04-frontend exec client -- wget -qO- -T 3 <url> chala ke error padho: 'bad address' = DNS, 'Connection refused' = endpoints/port" \
  kubectl -n lab04-frontend exec client -- wget -qO- -T 3 "$url"

summary
