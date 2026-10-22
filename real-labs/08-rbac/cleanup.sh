#!/usr/bin/env bash
# Lab 08 cleanup — namespace + cluster-scoped RBAC objects
# (namespace delete karne se ClusterRole/ClusterRoleBinding NAHI hatte — woh kisi namespace mein hote hi nahi)
kubectl delete ns lab08 --ignore-not-found
# solution wale naam + tumhare banaye koi bhi naam jisme "lab08" ho
kubectl get clusterrolebinding,clusterrole -o name 2>/dev/null | grep -i lab08 | xargs -r kubectl delete
echo "🧹 lab08 saaf (ClusterRole/ClusterRoleBinding bhi)"
