#!/usr/bin/env bash
# Lab 18 cleanup — namespace ke saath policies bhi hatao.
# Policy aur Binding cluster-scoped hain: "kubectl delete ns lab18" unhe NAHI hatata.
kubectl delete ns lab18 --ignore-not-found --wait=false
kubectl delete validatingadmissionpolicybinding lab18-no-latest lab18-require-requests --ignore-not-found
kubectl delete validatingadmissionpolicy lab18-no-latest lab18-require-requests --ignore-not-found
echo "🧹 Lab 18 saaf (namespace background mein delete ho raha hai)"
