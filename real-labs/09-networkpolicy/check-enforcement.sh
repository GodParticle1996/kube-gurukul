#!/usr/bin/env bash
# Kya tumhara CNI NetworkPolicy ENFORCE karta hai? (har CNI nahi karta — policy chupchaap "ignore" ho jaati hai!)
set -u
NS=netpol-check
echo "🔍 NetworkPolicy enforcement check (temporary namespace '$NS')..."
kubectl create ns $NS >/dev/null 2>&1
kubectl -n $NS run web --image=busybox:1.36 --labels=app=web --restart=Never -- sh -c 'mkdir -p /w && echo ok > /w/index.html && exec httpd -f -h /w -p 8080' >/dev/null 2>&1
kubectl -n $NS run probe --image=busybox:1.36 --restart=Never -- sleep 600 >/dev/null 2>&1
kubectl -n $NS wait --for=condition=Ready pod/web pod/probe --timeout=120s >/dev/null 2>&1 || { echo "❌ test pods ready nahi hue (image pull?) — 'kubectl -n $NS get pods' dekho"; exit 2; }
IP=$(kubectl -n $NS get pod web -o jsonpath='{.status.podIP}')
before=$(kubectl -n $NS exec probe -- wget -qO- -T 2 "http://$IP:8080" 2>/dev/null)
cat <<YAML | kubectl apply -f - >/dev/null
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: deny-all, namespace: $NS }
spec: { podSelector: {}, policyTypes: [Ingress] }
YAML
sleep 5
after=$(kubectl -n $NS exec probe -- wget -qO- -T 2 "http://$IP:8080" 2>/dev/null)
kubectl delete ns $NS --wait=false >/dev/null 2>&1
if [ "$before" = "ok" ] && [ -z "$after" ]; then
  echo "✅ Enforcement CHAL raha hai — deny-all ke baad traffic ruk gaya. Lab 09 karo!"
elif [ "$before" != "ok" ]; then
  echo "⚠️  Policy se pehle hi traffic nahi chala — cluster networking check karo."
else
  echo "❌ Tumhara CNI NetworkPolicy ENFORCE NAHI karta (deny-all ke baad bhi traffic gaya)."
  echo "   Ilaaj: Calico wala alag cluster banao — README ka 'Plan B: Calico' section dekho."
  exit 1
fi
