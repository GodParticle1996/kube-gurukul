# Lab 19 — poore commands (sirf tab dekho jab phas jao)

```bash
# 0. hack hue pod ka naam (attack.sh alert mein deta hai)
./attack.sh
BAD=<alert wala pod naam>
LEDGER_IP=$(kubectl -n lab19 get svc ledger -o jsonpath='{.spec.clusterIP}')

# 1. Saboot PEHLE (pod ko delete mat karo)
kubectl -n lab19 exec "$BAD" -- ps
kubectl -n lab19 get pod "$BAD" -o yaml > /tmp/lab19-evidence-pod.yaml
kubectl -n lab19 logs "$BAD" > /tmp/lab19-evidence-logs.txt

# 2. Label badlo: Service aur ReplicaSet se alag
kubectl -n lab19 label pod "$BAD" app- quarantine=true

# 3. Network band
kubectl apply -f solution/quarantine-netpol.yaml

# 4. Jaanch
kubectl -n lab19 exec "$BAD" -- wget -qO- -T 3 http://$LEDGER_IP      # download timed out
kubectl -n lab19 exec client -- wget -qO- -T 3 http://notify         # notify-ok
```
