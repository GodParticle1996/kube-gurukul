# Lab 18 — poore commands (sirf tab dekho jab phas jao)

```bash
# 1. Deployment bana, pod nahi → wajah ReplicaSet ke Events mein
kubectl -n lab18 create deployment notify --image=nginx:latest
kubectl -n lab18 describe rs -l app=notify            # Events: ... ValidatingAdmissionPolicy 'lab18-no-latest' ... denied request

# 2. Image par pakka tag
kubectl -n lab18 set image deploy/notify nginx=nginx:1.27-alpine
kubectl -n lab18 rollout status deploy/notify

# 3. Doosri policy ko chetavni mode mein jagao
kubectl apply -f binding-warn.yaml

# 4. Purane Deployments theek karo (Deny se PEHLE)
kubectl -n lab18 set resources deploy/notify --requests=cpu=50m,memory=32Mi
kubectl -n lab18 set resources deploy/fraud-check --requests=cpu=50m,memory=32Mi    # agar Step 7 mein banaya tha

# 5. Ab Deny
kubectl apply -f solution/binding-deny.yaml

# 6. Jaanch: bina requests wala Deployment turant ruk jaata hai
kubectl -n lab18 create deployment ledger --image=nginx:1.27-alpine                 # error: ... is forbidden
```
