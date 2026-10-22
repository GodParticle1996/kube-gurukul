#!/usr/bin/env bash
# Lab 05 setup: manifests apply + ssd node(s) ko DB ke liye reserve karo (taint)
set -e
cd "$(dirname "$0")"
kubectl apply -f setup.yaml
kubectl taint nodes -l disktype=ssd dedicated=database:NoSchedule --overwrite
echo
echo "✅ Lab 05 ready. Ab: kubectl -n lab05 get pods"
