#!/usr/bin/env bash
# Lab 15 verify — Helm: template bug, values precedence, --rollback-on-failure (Helm 3: --atomic), helm test
source "$(dirname "$0")/../lib/verify.sh"
need_cluster; need_ns lab15
NS=lab15; REL=demo; DIR="$(dirname "$0")"
rel_status() { kubectl -n $NS get secrets -l owner=helm,name=$REL -o jsonpath='{range .items[*]}{.metadata.labels.status}{"\n"}{end}' 2>/dev/null; }

title "Lab 15 — chart ka template bug"
check "deployment.yaml sahi key padhta hai (.Values.replicaCount)" \
  "helm template demo chart/gurukul-web -f values-prod.yaml | grep replicas: → khaali? values.yaml ki key aur template ki key akshar-akshar milao (case-sensitive!)" \
  grep -q 'Values.replicaCount' "$DIR/chart/gurukul-web/templates/deployment.yaml"

title "Lab 15 — release ki haalat"
check "Release '$REL' (namespace lab15) deployed hai" \
  "helm upgrade --install demo chart/gurukul-web -n lab15 --create-namespace -f values-prod.yaml" \
  contains "$(rel_status)" "deployed"
check "Prod values lagi hain: 3 replicas (abhi: $(jp $NS deploy/demo-gurukul-web '{.spec.replicas}'))" \
  "sirf --set se upgrade kiya? Helm har upgrade par values NAYE SIRE se banata hai — -f values-prod.yaml phir se do" \
  eq "$(jp $NS deploy/demo-gurukul-web '{.spec.replicas}')" "3"
check "Prod message ConfigMap mein hai" \
  "helm get values demo -n lab15 — USER-SUPPLIED VALUES mein kya hai?" \
  contains "$(jp $NS cm/demo-gurukul-web '{.data.index\.html}')" "prod"

title "Lab 15 — --rollback-on-failure aur helm test"
check "History mein ek failed upgrade hai (aur release phir bhi deployed — rollback-on-failure ne bachaya)" \
  "Step 4 wala kharab upgrade karo: ... --set image.tag=galat --rollback-on-failure --timeout 90s  (Helm 3: --atomic)" \
  contains "$(rel_status)" "failed"
if command -v helm >/dev/null 2>&1; then
  check "helm test chala aur pass hua" \
    "helm test demo -n lab15" \
    contains "$(helm status $REL -n $NS -o json 2>/dev/null | tr -d ' ')" '"phase":"Succeeded"'
else
  bad "helm CLI nahi mila" "helm install karo: https://helm.sh/docs/intro/install/"
fi

summary
