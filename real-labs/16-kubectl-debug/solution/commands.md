# Lab 16 — poore commands (sirf tab dekho jab phas jao)

```bash
# 1. pay-api pod ka naam ek variable mein
POD=$(kubectl -n lab16 get pod -l app=pay-api -o jsonpath='{.items[0].metadata.name}')

# 2. debug container jodo (naam: dbg). pay-api container restart NAHI hota.
kubectl -n lab16 debug "$POD" --image=busybox:1.36 --target=pay-api --profile=general -c dbg -- sleep 3600

# 3. pay-api pod ke andar se jaanch
kubectl -n lab16 exec "$POD" -c dbg -- nslookup ledger-svc.lab16.svc.cluster.local     # DNS theek
kubectl -n lab16 exec "$POD" -c dbg -- wget -qO- -T 3 http://ledger-svc:8080/healthz   # Connection refused

# 4. Service ke peeche kya hai
kubectl -n lab16 get endpointslices -l kubernetes.io/service-name=ledger-svc           # PORTS = 8081 (galat)

# 5. fix
kubectl apply -f solution/ledger-svc.yaml

# 6. dobara jaanch
kubectl -n lab16 exec "$POD" -c dbg -- wget -qO- -T 3 http://ledger-svc:8080/healthz   # ok
```
