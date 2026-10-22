#!/usr/bin/env bash
# Lab 02 verify — ImagePullBackOff
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab02
NS=lab02

title "Lab 02 — storefront ki image aa gayi?"
img=$(jp $NS deploy/storefront '{.spec.template.spec.containers[0].image}')
check "Image tag sahi hai (abhi: $img)" \
  "describe pod ke Events mein 'Failed to pull image' ke saath registry ka jawab padho — 'not found' = naam/tag galat. Tag ki SPELLING dhyan se dekho" \
  eq "$img" "nginx:1.27-alpine"

check "Deployment ke 2/2 replicas Available" \
  "fix ke baad bhi ImagePullBackOff? rollout chal raha hai? kubectl -n lab02 rollout status deploy/storefront" \
  eq "$(jp $NS deploy/storefront '{.status.availableReplicas}')" "2"

bad_pods=$(kubectl -n $NS get pods -l app=storefront -o jsonpath='{range .items[*]}{.metadata.deletionTimestamp}{"|"}{.status.containerStatuses[0].state.waiting.reason}{"\n"}{end}' 2>/dev/null \
  | awk -F'|' '$1 == "" && ($2 == "ImagePullBackOff" || $2 == "ErrImagePull")' | wc -l | tr -d ' ')
check "Koi pod ImagePullBackOff/ErrImagePull mein nahi" \
  "purana ReplicaSet ke pods atke hain? 'kubectl -n lab02 get rs' dekho — naya RS bana?" \
  eq "$bad_pods" "0"

summary
