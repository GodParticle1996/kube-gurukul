#!/usr/bin/env bash
# Lab 14 — SOLUTION (pehle khud karo! aur README ka "kab NAHI karna" zaroor padho)
set -x
# 1) Kaun rok raha hai?
kubectl -n lab14 get cm orders-cache -o jsonpath='{.metadata.deletionTimestamp}{"  "}{.metadata.finalizers}{"\n"}'
# 2) Controller hai hi nahi (uninstall ho chuka) → cleanup manually ho chuka maan ke finalizer hatao
kubectl -n lab14 patch configmap orders-cache --type=merge -p '{"metadata":{"finalizers":null}}'
# 3) Namespace kyun atka? conditions batati hain kaunsa object
kubectl get ns lab14-legacy -o jsonpath='{range .status.conditions[*]}{.type}: {.message}{"\n"}{end}'
kubectl -n lab14-legacy patch configmap legacy-cache --type=merge -p '{"metadata":{"finalizers":null}}'
