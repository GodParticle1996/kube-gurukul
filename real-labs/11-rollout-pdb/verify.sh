#!/usr/bin/env bash
# Lab 11 verify — rollout / rollback / PDB / drain
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab11
NS=lab11

title "Lab 11 — Part A: maintenance possible hai?"
da=$(jp $NS pdb/checkout-pdb '{.status.disruptionsAllowed}')
check "PDB kam se kam 1 disruption allow karta hai (abhi: ${da:-?})" \
  "kubectl -n lab11 get pdb → ALLOWED DISRUPTIONS 0? minAvailable = replicas ho toh drain kabhi nahi hoga. maxUnavailable: 1 socho (aur replicas badhao)" \
  ge "${da:-0}" 1
rep=$(jp $NS deploy/checkout '{.spec.replicas}')
check "checkout ke kam se kam 3 replicas (abhi: ${rep:-?}) — maintenance ke dauraan bhi 2 serve karein" \
  "2 replicas + 1 maintenance = sirf 1 bacha. kubectl -n lab11 scale deploy/checkout --replicas=3" \
  ge "${rep:-0}" 3
check "Koi node cordoned nahi bacha (drain ke baad uncordon kiya?)" \
  "kubectl get nodes → SchedulingDisabled? kubectl uncordon <node>" \
  eq "$(kubectl get nodes -o jsonpath='{.items[*].spec.unschedulable}' 2>/dev/null | tr -d ' ')" ""

title "Lab 11 — Part B: kharab rollout se wapsi"
img=$(jp $NS deploy/checkout '{.spec.template.spec.containers[0].image}')
check "Image wapas sahi wali (abhi: $img)" \
  "kubectl -n lab11 rollout undo deploy/checkout" \
  eq "$img" "busybox:1.36"
revno=$(jp $NS deploy/checkout '{.metadata.annotations.deployment\.kubernetes\.io/revision}')
check "Rollout history mein bad rollout + undo dikhta hai (revision ${revno:-?} ≥ 3)" \
  "Part B karo: set image (galat tag) → rollout status (atka) → rollout undo. Har template change = naya revision" \
  ge "${revno:-0}" 3
check "Saare replicas Available (abhi: $(jp $NS deploy/checkout '{.status.availableReplicas}')/${rep:-?})" \
  "kubectl -n lab11 rollout status deploy/checkout" \
  eq "$(jp $NS deploy/checkout '{.status.availableReplicas}')" "$rep"

summary
