#!/usr/bin/env bash
# =====================================================================
#  KubeGurukul real-labs — verify helpers
#  Har lab ka verify.sh isse source karta hai:
#     source "$(dirname "$0")/../lib/verify.sh"
#  Kaam: ek-ek check chalao → ✅/❌ dikhao → ❌ par HINT do (jawab nahi!)
#  → aakhir mein PASS/FAIL. Exit code: 0 = pass, 1 = fail, 2 = setup issue.
# =====================================================================

PASS=0; FAIL=0
if [ -t 1 ]; then G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[1m'; N=$'\033[0m'; else G=; R=; Y=; B=; N=; fi

title() { echo; echo "${B}🧪 $*${N}"; }
ok()    { echo "  ${G}✅ $1${N}"; PASS=$((PASS+1)); }
bad()   { echo "  ${R}❌ $1${N}"; [ -n "${2:-}" ] && echo "     ${Y}💡 hint: $2${N}"; FAIL=$((FAIL+1)); }

# check "kya check ho raha hai" "fail hone par hint" <command...>
check() { local d="$1" h="$2"; shift 2; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d" "$h"; fi; }

# jp <namespace> "<kind/name ya kind>" '<jsonpath>'   → value (error par khaali)
jp() { kubectl -n "$1" get $2 -o jsonpath="$3" 2>/dev/null; }

# string compare helpers (check ke saath use karo)
eq()       { [ "$1" = "$2" ]; }
contains() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }
ge()       { [ "${1:-0}" -ge "$2" ] 2>/dev/null; }

# memory quantity → MiB (128Mi, 1Gi, 268435456, 256M)
to_mib() {
  local v="$1"
  case "$v" in
    *Gi) echo $(( ${v%Gi} * 1024 )) ;;
    *Mi) echo "${v%Mi}" ;;
    *Ki) echo $(( ${v%Ki} / 1024 )) ;;
    *G)  echo $(( ${v%G} * 1000 * 1000 * 1000 / 1048576 )) ;;
    *M)  echo $(( ${v%M} * 1000 * 1000 / 1048576 )) ;;
    ''|*[!0-9]*) echo 0 ;;
    *)   echo $(( v / 1048576 )) ;;
  esac
}

# newest_pod <ns> <label-selector> → sabse naya Running pod jo terminate NAHI ho raha
# (rollout ke baad purane pods grace period tak "Running" hi dikhte hain — unhe mat pakdo)
newest_pod() {
  kubectl -n "$1" get pods -l "$2" --sort-by=.metadata.creationTimestamp \
    -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{.metadata.deletionTimestamp}{"|"}{.status.phase}{"\n"}{end}' 2>/dev/null \
    | awk -F'|' '$2 == "" && $3 == "Running" { n = $1 } END { print n }'
}

need_cluster() {
  command -v kubectl >/dev/null 2>&1 || { echo "${R}kubectl nahi mila — pehle install karo (README → Setup)${N}"; exit 2; }
  kubectl get --raw /readyz >/dev/null 2>&1 || {
    echo "${R}Cluster se baat nahi ho paa rahi. 'kubectl cluster-info' chalao — kind cluster chal raha hai?${N}"; exit 2; }
}
need_ns() {
  kubectl get ns "$1" >/dev/null 2>&1 || {
    echo "${R}Namespace '$1' nahi mila — pehle lab shuru karo: kubectl apply -f setup.yaml${N}"; exit 2; }
}
summary() {
  echo
  if [ "$FAIL" -eq 0 ]; then echo "${G}${B}🎉 LAB PASS — saare $PASS checks sahi!${N}"; exit 0; fi
  echo "${R}${B}🔁 $FAIL/$((PASS + FAIL)) check(s) abhi fail — hint padho, fix karo, phir se ./verify.sh${N}"
  exit 1
}
