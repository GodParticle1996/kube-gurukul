#!/usr/bin/env bash
# Lab 07 — SOLUTION (commands; pehle khud karo!)
# 1) ConfigMap badlo
kubectl -n lab07 patch configmap greeter-config --type merge -p '{"data":{"GREETING":"namaste-v2"}}'
# 2) ~1-2 min logs dekho: volume badla, env + subPath NAHI
#    kubectl -n lab07 logs deploy/greeter -f
# 3) env/subPath sirf naye container mein badalte hain → rollout restart
kubectl -n lab07 rollout restart deploy/greeter
kubectl -n lab07 rollout status deploy/greeter
