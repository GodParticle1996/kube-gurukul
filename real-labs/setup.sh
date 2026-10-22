#!/usr/bin/env bash
# =====================================================================
#  KubeGurukul real-labs — setup
#    ./setup.sh           → kind cluster "gurukul" (3 nodes) + metrics-server
#    ./setup.sh metrics   → sirf metrics-server (cluster pehle se ho — kind ya minikube)
#  Dobara chalana safe hai (idempotent).
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ '$1' nahi mila — install karo: $2"; exit 1; }; }

install_metrics() {
  echo "📊 metrics-server install ho raha hai..."
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.7.2/components.yaml >/dev/null
  # kind/minikube ke kubelets self-signed certs use karte hain → metrics-server ko unhe trust karna padta hai
  if ! kubectl -n kube-system get deploy metrics-server -o jsonpath='{.spec.template.spec.containers[0].args}' | grep -q kubelet-insecure-tls; then
    kubectl -n kube-system patch deployment metrics-server --type=json \
      -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' >/dev/null
  fi
  kubectl -n kube-system rollout status deploy/metrics-server --timeout=180s
  echo "⏳ Pehla data aane mein ~1 min lagta hai. Check: kubectl top nodes"
}

if [ "${1:-}" = "metrics" ]; then
  need kubectl "https://kubernetes.io/docs/tasks/tools/"
  install_metrics
  exit 0
fi

need docker  "https://docs.docker.com/get-docker/  (WSL: Docker Desktop ya docker-ce)"
need kind    "https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
need kubectl "https://kubernetes.io/docs/tasks/tools/"

if kind get clusters 2>/dev/null | grep -qx gurukul; then
  echo "✅ kind cluster 'gurukul' pehle se hai"
else
  echo "🚀 kind cluster 'gurukul' ban raha hai (1 control-plane + 2 workers, ~2 min)..."
  kind create cluster --config kind-config.yaml --wait 180s
fi
kubectl config use-context kind-gurukul >/dev/null
kubectl get nodes -L disktype -L gurukul/zone
install_metrics
echo
echo "🎉 Ready! Pehla lab: cd 01-crashloop-oom && cat README.md"
