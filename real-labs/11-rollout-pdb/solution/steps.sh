#!/usr/bin/env bash
# Lab 11 — SOLUTION commands (pehle khud karo!)
set -x
# Part A — PDB + drain
kubectl -n lab11 scale deploy/checkout --replicas=3
kubectl apply -f "$(dirname "$0")/fixed.yaml"
NODE=$(kubectl -n lab11 get pods -l app=checkout -o jsonpath='{.items[0].spec.nodeName}')
kubectl drain "$NODE" --ignore-daemonsets --delete-emptydir-data --timeout=120s
kubectl uncordon "$NODE"
# Part B — kharab rollout + undo
kubectl -n lab11 set image deploy/checkout web=busybox:1.36-galat
kubectl -n lab11 rollout status deploy/checkout --timeout=75s || true   # atkega (ImagePullBackOff) — purane pods serve karte rahe
kubectl -n lab11 rollout history deploy/checkout
kubectl -n lab11 rollout undo deploy/checkout
kubectl -n lab11 rollout status deploy/checkout --timeout=120s
