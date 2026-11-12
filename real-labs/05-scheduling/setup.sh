#!/usr/bin/env bash
# Lab 05 setup: manifests apply + ssd node(s) ko DB ke liye reserve karo (taint)
set -e
cd "$(dirname "$0")"
# Taint PEHLE, pods BAAD mein: scheduler ki pehli koshish hi tainted node dekhe, warna
# FailedScheduling ka message is par nirbhar karta hai ki kaunsa command pehle pahuncha.
kubectl taint nodes -l disktype=ssd dedicated=database:NoSchedule --overwrite
kubectl apply -f setup.yaml
echo
echo "✅ Lab 05 ready. Ab: kubectl -n lab05 get pods"
