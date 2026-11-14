#!/usr/bin/env bash
# Lab 19 — nakli hamla. Ek notify pod mein "xmrig" naam ka process chalata hai (sirf sleep karta hai, koi nuksaan nahi),
# phir Falco jaisa alert dikhata hai. Dobara chalaoge toh naya hamla NAHI hota — wahi alert phir dikhta hai.
set -u
NS=lab19
kubectl get ns $NS >/dev/null 2>&1 || { echo "❌ Namespace lab19 nahi mila — pehle: kubectl apply -f setup.yaml"; exit 2; }
kubectl -n $NS rollout status deploy/notify --timeout=120s >/dev/null 2>&1 \
  || { echo "❌ notify ready nahi hua — 'kubectl -n lab19 get pods' dekho"; exit 2; }

# kya koi pod pehle se hack hua hai? (quarantine ke baad bhi uska naam notify-... hi rehta hai)
BAD=""
for p in $(kubectl -n $NS get pods -o name | sed -n 's|^pod/\(notify-.*\)$|\1|p'); do
  if kubectl -n $NS exec "$p" -- test -f /tmp/xmrig >/dev/null 2>&1; then BAD="$p"; break; fi
done

if [ -z "$BAD" ]; then
  BAD=$(kubectl -n $NS get pod -l app=notify --sort-by=.metadata.name -o jsonpath='{.items[0].metadata.name}')
  kubectl -n $NS exec "$BAD" -- sh -c \
    'printf "#!/bin/sh\nwhile true; do sleep 5; done\n" > /tmp/xmrig; chmod +x /tmp/xmrig; (nohup /tmp/xmrig >/dev/null 2>&1 &)' \
    || { echo "❌ hamla nahi chal paaya — 'kubectl -n lab19 get pods' dekho"; exit 2; }
fi

cat <<ALERT

🚨 FALCO ALERT (nakli — is lab ke liye)
   Rule:       Unexpected process spawned in container
   Process:    /tmp/xmrig        (crypto-miner jaisa naam)
   Namespace:  lab19
   Pod:        $BAD

👉 Is pod ka naam variable mein rakho (yeh line copy karke chalao):

   BAD=$BAD

ALERT
