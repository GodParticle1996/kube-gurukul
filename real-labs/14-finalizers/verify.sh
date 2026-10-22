#!/usr/bin/env bash
# Lab 14 verify — finalizers / stuck Terminating
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab14
NS=lab14

title "Lab 14 — atke hue objects saaf?"
check "orders-cache delete ho chuka hai" \
  "kubectl -n lab14 delete cm orders-cache --wait=false → phir -o jsonpath='{.metadata.finalizers}'. Jab tak finalizers list khaali nahi, object nahi jaayega" \
  test -z "$(kubectl -n $NS get cm orders-cache -o name 2>/dev/null)"
check "Namespace lab14-legacy poori tarah delete ho chuka hai" \
  "kubectl delete ns lab14-legacy --wait=false → kubectl get ns lab14-legacy -o jsonpath='{.status.conditions}' — kaunsa object finalizer ke saath bacha hai?" \
  test -z "$(kubectl get ns lab14-legacy -o name 2>/dev/null)"
check "keep-me abhi bhi zinda hai (sirf atke hue object ka ilaaj, poore namespace ka 'nuke' nahi)" \
  "lab14 namespace delete kar diya? kubectl apply -f setup.yaml se wapas lao aur sirf orders-cache ka ilaaj karo" \
  test -n "$(kubectl -n $NS get cm keep-me -o name 2>/dev/null)"

summary
