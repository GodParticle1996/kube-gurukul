#!/usr/bin/env bash
# Saare labs ka kachra saaf (cluster bacha rehta hai). Poora cluster hatana: kind delete cluster --name gurukul
for ns in lab01 lab02 lab03 lab04 lab04-frontend lab05 lab06 lab07 lab08 lab09 lab10 lab11 lab12 lab13 lab14 lab14-legacy lab15 netpol-check; do
  kubectl delete ns "$ns" --ignore-not-found --wait=false
done
kubectl taint nodes -l disktype=ssd dedicated- 2>/dev/null || true                      # lab05 ka taint
kubectl get clusterrolebinding,clusterrole -o name 2>/dev/null | grep -i lab08 | xargs -r kubectl delete   # lab08
for n in $(kubectl get nodes -o jsonpath='{range .items[?(@.spec.unschedulable==true)]}{.metadata.name}{" "}{end}'); do
  kubectl uncordon "$n"                                                                   # lab11 ka drain
done
echo "🧹 Saare labs saaf (namespaces background mein delete ho rahe hain)"
