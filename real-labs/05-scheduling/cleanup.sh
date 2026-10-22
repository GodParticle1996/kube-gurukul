#!/usr/bin/env bash
# Lab 05 cleanup: namespace hatao + taint hatao (warna baaki labs ke pods us node par nahi jaayenge)
kubectl delete ns lab05 --ignore-not-found
kubectl taint nodes -l disktype=ssd dedicated- 2>/dev/null || true
echo "🧹 lab05 saaf — taint bhi hata diya"
