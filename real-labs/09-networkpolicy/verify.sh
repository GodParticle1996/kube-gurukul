#!/usr/bin/env bash
# Lab 09 verify — NetworkPolicy connectivity matrix
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab09
NS=lab09
reach() { kubectl -n $NS exec "$1" -- wget -qO- -T 2 "$2" >/dev/null 2>&1; }
blocked() { ! reach "$1" "$2"; }

title "Lab 09 — zaroori raaste KHULE"
check "frontend → backend (http://backend) chalta hai" \
  "backend ki policy ka podSelector backend ko chune, aur 'from' mein frontend ka label ho. Port = container port (8080)" \
  reach frontend http://backend
check "backend → db (http://db:5432) chalta hai" \
  "db ki raksha wali policy chahiye: podSelector app=db, from app=backend, port 5432" \
  reach backend http://db:5432

title "Lab 09 — baaki sab BAND (zero-trust)"
nps=$(kubectl -n $NS get networkpolicy -o name 2>/dev/null | wc -l | tr -d ' ')
enf_hint="koi policy hai hi nahi? pehle default-deny lagao."
[ "$nps" -gt 0 ] && enf_hint="policies lagi hain phir bhi khula? ./check-enforcement.sh chalao — shayad tumhara CNI policies enforce hi nahi karta"
check "frontend → db BAND (frontend ko DB se seedhe baat nahi karni)" "$enf_hint" blocked frontend http://db:5432
check "attacker → backend BAND" "$enf_hint" blocked attacker http://backend
check "attacker → db BAND" "$enf_hint" blocked attacker http://db:5432
check "default-deny-ingress policy maujood hai" \
  "podSelector: {} + policyTypes: [Ingress] (ingress list khaali) = sab band" \
  test -n "$(kubectl -n $NS get networkpolicy default-deny-ingress -o name 2>/dev/null)"

summary
