#!/usr/bin/env bash
# Lab 10 — SOLUTION (pehle khud karo!)
# 1) CPU request do — HPA utilization = usage / REQUEST. Request nahi = % nikal hi nahi sakta → <unknown>
kubectl -n lab10 patch deploy cpu-api --type=json -p '[{"op":"add","path":"/spec/template/spec/containers/0/resources/requests","value":{"cpu":"100m","memory":"32Mi"}}]'
kubectl -n lab10 rollout status deploy/cpu-api
# 2) ~1 min baad: kubectl -n lab10 get hpa  → TARGETS mein asli % dikhega
# 3) Load chalao aur HPA ko kaam karte dekho
kubectl -n lab10 scale deploy/loadgen --replicas=2
#    kubectl -n lab10 get hpa -w      (REPLICAS badhenge)
# 4) Load band: kubectl -n lab10 scale deploy/loadgen --replicas=0   (1 min stabilization ke baad scale-down)
