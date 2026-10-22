#!/usr/bin/env bash
# Lab 08 verify — RBAC (least privilege bhi check hota hai!)
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab08
SA=system:serviceaccount:lab08:auditor
can() { [ "$(kubectl auth can-i "$@" --as=$SA 2>/dev/null)" = "yes" ]; }
cannot() { [ "$(kubectl auth can-i "$@" --as=$SA 2>/dev/null)" = "no" ]; }

title "Lab 08 — auditor ko JITNA chahiye utna access"
check "auditor lab08 ke pods list kar sakta hai" \
  "kubectl auth can-i list pods -n lab08 --as=$SA → 'no'? Role theek hai — RoleBinding ka 'subjects' dhyan se padho (kaunsa namespace?)" \
  can list pods -n lab08
check "auditor nodes list kar sakta hai" \
  "nodes kisi namespace ke andar nahi hote (cluster-scoped). Namespace wala Role unhe grant hi nahi kar sakta — kaunsa kind chahiye?" \
  can list nodes

title "Lab 08 — least privilege (zyada access bhi galti hai)"
check "auditor kube-system ke pods NAHI dekh sakta" \
  "pods ke liye ClusterRoleBinding de diya? Woh SAARE namespaces khol deta hai — pods ke liye RoleBinding (lab08) hi rakho" \
  cannot list pods -n kube-system
check "auditor pods DELETE nahi kar sakta" \
  "verbs mein sirf get/list/watch — auditor ko likhne ka haq nahi" \
  cannot delete pods -n lab08
check "auditor secrets NAHI padh sakta" \
  "resources: [\"*\"] ya cluster-admin mat do — secrets padhna = credentials ki chori" \
  cannot get secrets -n lab08

line=$(kubectl -n lab08 logs deploy/auditor --tail=1 2>/dev/null)
check "auditor ke logs mein dono calls 200 (abhi: ${line:-no logs})" \
  "RBAC badalte hi asar turant hota hai — 5s baad logs dobara dekho: kubectl -n lab08 logs deploy/auditor --tail=3" \
  contains "$line" "list pods(lab08)=200   list nodes=200"

summary
