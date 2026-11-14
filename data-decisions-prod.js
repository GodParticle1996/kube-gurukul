/* =====================================================================
   KubeGurukul — 🧭 Decision Dojo: "Production ke kaam" wale trees
   Tracks: 🛠️ Day-2 Ops · 📈 Observability · 🛡️ Security · 🌐 Networking & EKS
   Kahani wahi: ChaiPay (pay-api, ledger, notify, fraud-check), namespace payments.
   Format aur niyam: EXTENDING.md §12. Engine: decisions.js.
   ===================================================================== */

KG.registerDecisions([

  /* ================= 16. DEBUG TOOL (Day-2) ================= */
  {
    id: 'debugtool', icon: '🧰',
    title: 'Pod ya node ki jaanch — exec, ephemeral container, pod ki copy, ya node debug?',
    short: 'Andar kaise jhaankein?',
    tldr: 'Image mein shell hai → <b>kubectl exec</b>. Shell nahi hai → <b>ephemeral container</b> (<code>kubectl debug --target</code>). Container turant crash hota hai → <b>pod ki copy</b> (<code>--copy-to</code>). Problem node ki hai → <b>kubectl debug node/…</b>.',
    levels: ['d2-debug'], labs: ['16-kubectl-debug'],
    start: 'what',
    nodes: {
      what: {
        q: 'Jaanch kis cheez ki karni hai?',
        why: 'Pod ke andar ki problem aur node ki problem ke auzaar alag hain. Sirf "Service pahunch mein hai ya nahi" dekhna ho toh ek naya saaf pod sabse tez hai.',
        options: [
          { t: 'Ek khaas pod ke andar ki cheez (process, files, us pod ka network)', next: 'alive' },
          { t: 'Node ki cheez (disk, kubelet, containerd)', next: 'node' },
          { t: 'Bas itna ki cluster ke andar se ek Service ya DNS naam chalta hai', next: 'tmp' },
        ],
      },
      alive: {
        q: 'Kya us pod ka container chalta rehta hai?',
        why: 'Ephemeral container <b>chalte</b> pod mein judta hai. Container har 3 second mein mar jaye toh jaanch ka waqt hi nahi milta.',
        options: [
          { t: 'Haan — container Running hai', next: 'shell' },
          { t: 'Nahi — shuru hote hi crash (CrashLoopBackOff)', next: 'copy' },
        ],
      },
      shell: {
        q: 'Kya container ki image mein shell aur jaanch ke tools hain?',
        why: '<code>kubectl exec</code> container ke <b>andar ka</b> program chalata hai. Distroless ya scratch image mein <code>sh</code>, <code>wget</code>, <code>ps</code> kuch nahi hota.',
        options: [
          { t: 'Haan — sh aur tools hain', next: 'exec' },
          { t: 'Nahi — distroless, sirf ek binary', next: 'eph' },
        ],
      },
      exec: {
        leaf: true, pick: 'kubectl exec (usi container ke andar)', icon: '⌨️',
        one: 'Chalte container ke andar seedha ek command chalao.',
        why: 'Image mein shell aur tools pehle se hain. Koi naya container jodne ki zaroorat nahi.',
        when: ['Image mein sh hai (busybox, alpine, debian par bani image)', 'Ek file padhni hai ya ek command chalana hai'],
        avoid: ['Distroless image → exec ka error: "executable file not found"', 'Container crash loop mein hai → exec beech mein kat jaata hai'],
        gotchas: [
          'Command container ki memory limit ke <b>andar</b> chalta hai. Bhaari tool chalaoge toh container OOMKilled ho sakta hai.',
          'Pod mein ek se zyada container hain toh <code>-c &lt;container&gt;</code> likho.',
          'Production mein <code>pods/exec</code> ki RBAC ijaazat kam logon ko do — exec se Secrets padhe ja sakte hain.',
        ],
        yaml: `kubectl -n payments exec -it deploy/ledger -c ledger -- sh
# ya ek hi command:
kubectl -n payments exec deploy/ledger -- cat /w/healthz`,
        example: 'ledger ki image busybox par bani hai. exec se dekha: /w/healthz file maujood hai.', level: 'd2-debug',
      },
      eph: {
        leaf: true, pick: 'Ephemeral container (debug --target)', icon: '🧰',
        one: 'Chalte pod mein ek naya "tools wala" container jodo. Pod restart nahi hota.',
        why: 'Pod chal raha hai, problem abhi ho rahi hai, aur image mein shell nahi hai.',
        when: ['Distroless / scratch image', 'Usi pod ke network se test karna hai (wahi IP, wahi NetworkPolicy)', 'Target container ke processes dekhne hain'],
        avoid: ['Container baar-baar crash hota hai → pod ki copy', 'Problem node ki hai → node debug'],
        gotchas: [
          '<code>--target=&lt;container&gt;</code> ke bina debug container ko target ke processes <b>nahi</b> dikhte. Network phir bhi saajha hota hai.',
          'Ephemeral container ko hataya nahi ja sakta. Pod ke delete hone tak pod ki spec mein rehta hai.',
          'Ephemeral container ke apne requests/limits nahi hote. Debug container pod ki bachi hui memory use karta hai.',
        ],
        yaml: `kubectl -n payments debug -it pay-api-7d9f-x2 \\
  --image=busybox:1.36 --target=pay-api
# debug container ke andar:
wget -qO- -T 3 http://ledger-svc:8080/healthz`,
        example: 'pay-api (distroless) se ledger-svc "connection refused" de raha tha. Debug container se wahi call chalaya → Service ka targetPort galat nikla.', level: 'd2-debug', lab: '16-kubectl-debug',
      },
      copy: {
        leaf: true, pick: 'Pod ki copy (kubectl debug --copy-to)', icon: '📋',
        one: 'Pod ki ek copy banao jisme container ka command <code>sh</code> ho. Phir app ko haath se chalao.',
        why: 'Asli container itni jaldi marta hai ki andar jaane ka waqt nahi milta.',
        when: ['CrashLoopBackOff, aur <code>kubectl logs --previous</code> se wajah saaf nahi', 'Config file ya mount ko crash se pehle dekhna hai'],
        avoid: ['Problem sirf chalte pod ki haalat mein hai (memory, khule connections) → copy naya pod hai, haalat copy mein nahi aati'],
        gotchas: [
          'Copy ke labels default mein <b>hat jaate</b> hain. Isliye Service copy ko traffic nahi bhejta. (Naye kubectl mein probes bhi hat jaate hain.)',
          'Copy apne aap delete nahi hoti. Kaam ke baad <code>kubectl delete pod notify-dbg</code>.',
          'Copy asli pod ke Secrets aur ServiceAccount ke saath chalti hai — copy bhi production ka data chhoo sakti hai.',
        ],
        yaml: `kubectl -n payments debug notify-5c7b-abc \\
  --copy-to=notify-dbg --container=notify -it -- sh
# copy ke andar: config dekho, phir app haath se chalao
cat /etc/notify/config.yaml`,
        example: 'notify 3 second mein crash hota tha. Copy mein app haath se chalaya → "config.yaml: line 14: bad indentation".', level: 'd2-debug',
      },
      node: {
        leaf: true, pick: 'Node debug pod (kubectl debug node/…)', icon: '🖥️',
        one: 'Node par ek debug pod chalao. Node ka poora filesystem <code>/host</code> par milta hai.',
        why: 'Disk, kubelet aur containerd node ke hain, kisi ek pod ke nahi.',
        when: ['SSH band hai ya SSH key nahi hai', 'Node ki disk, kubelet ke logs, containerd ki haalat dekhni hai'],
        avoid: ['Problem ek pod ke andar hai → ephemeral container kaafi hai aur kam khatarnak hai'],
        gotchas: [
          'Debug pod node ke network aur process namespace mein chalta hai. Yeh bahut badi ijaazat hai — RBAC se kam logon ko do.',
          'Node ke commands chalane ke liye pehle <code>chroot /host</code>.',
          'Debug pod apne aap delete nahi hota. Naam <code>node-debugger-…</code> se shuru hota hai.',
        ],
        yaml: `kubectl debug node/node-3 -it --image=busybox:1.36
# debug pod ke andar:
chroot /host
du -sh /var/lib/containerd
journalctl -u kubelet --since "10 min ago"`,
        example: 'node-3 par DiskPressure tha. Node debug pod se dikha: /var/lib/containerd mein purani images ne 80 GB gher rakha tha.', level: 'd2-debug',
      },
      tmp: {
        leaf: true, pick: 'Naya temporary pod (kubectl run --rm)', icon: '🧪',
        one: 'Ek naya chhota pod banao, ek test chalao, pod apne aap delete.',
        why: 'Kisi khaas pod ki pehchaan zaroori nahi. Bas cluster ke andar se dekhna hai.',
        when: ['DNS naam hal hota hai ya nahi', 'Service ka port jawab deta hai ya nahi'],
        avoid: ['Problem sirf ek khaas pod se hoti hai → us pod mein ephemeral container'],
        gotchas: [
          'Naye pod ke labels alag hain. NetworkPolicy naye pod ko alag tarah se dekhti hai. "Temporary pod se chala" ka matlab "pay-api se bhi chalega" <b>nahi</b>.',
          'Naya pod <b>usi namespace</b> mein banao jahan problem hai (<code>-n payments</code>). Chhota naam <code>ledger-svc</code> sirf usi namespace mein hal hota hai.',
          '<code>--rm</code> sirf <code>-it</code> ke saath chalta hai. Terminal beech mein band ho jaye toh pod reh jaata hai — tab <code>kubectl -n payments delete pod tmp</code>.',
        ],
        yaml: `kubectl -n payments run tmp --rm -it --restart=Never \\
  --image=busybox:1.36 -- \\
  wget -qO- -T 3 http://ledger-svc:8080/healthz`,
        example: 'Naye namespace mein dekhna tha ki cluster DNS chalta hai. Temporary pod se nslookup → 5 second mein jawab.', level: 'd2-debug',
      },
    },
    compare: {
      cols: ['', 'kubectl exec', 'Ephemeral container', 'Pod ki copy', 'Node debug', 'Temporary pod'],
      rows: [
        ['Image mein shell chahiye?', 'Haan', 'Nahi', 'Nahi (image badal sakte ho)', 'Nahi', 'Nahi'],
        ['Asli pod restart hota hai?', 'Nahi', 'Nahi', 'Nahi (naya pod banta hai)', 'Nahi', 'Nahi'],
        ['Asli pod ka network?', 'Haan', 'Haan', 'Nahi (naya IP)', 'Node ka network', 'Nahi (naya IP)'],
        ['Kaam ke baad safai', 'Kuch nahi', 'Pod ke saath jaata hai', 'Copy delete karo', 'Debug pod delete karo', 'Apne aap (--rm)'],
      ],
    },
    scenarios: [
      { s: 'pay-api Running hai aur image distroless hai. pay-api se ledger-svc ko call "connection refused" deta hai.', answer: 'eph', explain: 'Pod chal raha hai, shell nahi hai, aur test usi pod ke network se karna hai → ephemeral container.' },
      { s: 'notify pod 3 second mein crash ho jaata hai. Config file padhni hai aur app ko haath se chalana hai.', answer: 'copy', explain: 'Crash hote container mein jaanch ka waqt nahi milta. Copy mein command sh rakho, phir app haath se chalao.' },
      { s: 'node-3 par disk bhar gayi hai. /var/lib/containerd ka size dekhna hai aur SSH band hai.', answer: 'node', explain: 'Disk node ki hai. Node debug pod mein node ka filesystem /host par milta hai.' },
      { s: 'ledger ki image busybox par bani hai. ledger container ke andar /w/healthz file hai ya nahi, dekhna hai.', answer: 'exec', explain: 'Image mein sh hai aur container chal raha hai → seedha kubectl exec.' },
      { s: 'Naya namespace bana hai. Bas dekhna hai ki cluster DNS "ledger-svc" ka naam hal karta hai ya nahi.', answer: 'tmp', explain: 'Kisi khaas pod ki zaroorat nahi → ek temporary pod se nslookup.' },
      { s: 'fraud-check Running hai aur image mein sirf ek Go binary hai. fraud-check process ke khule file descriptors ginne hain.', answer: 'eph', explain: '--target=fraud-check dene par debug container ko fraud-check ka process dikhta hai. /proc/1/fd gin lo.' },
    ],
  },

  /* ================= 17. RESTORE (Day-2) ================= */
  {
    id: 'restore', icon: '⛑️',
    title: 'Kuch delete ya kharab ho gaya — Git, Velero, snapshot, etcd, ya cloud ka backup?',
    short: 'Kahan se wapas aayega?',
    tldr: 'YAML Git mein hai → <b>GitOps sync</b>. Haath se bane objects ya PVC ka data → <b>Velero</b>. Sirf ek disk purane samay par → <b>VolumeSnapshot</b>. Self-managed control plane gaya → <b>etcd snapshot</b>. Data cluster ke bahar (RDS, S3) → <b>us service ka apna backup</b>.',
    levels: ['d2-backup'], labs: [],
    start: 'where',
    nodes: {
      where: {
        q: 'Khoyi hui cheez kahan rehti thi?',
        why: 'Kubernetes ka backup sirf cluster ke andar ki cheezein jaanta hai. RDS aur S3 cluster ke bahar hain.',
        options: [
          { t: 'Cluster ke andar — Kubernetes objects ya PVC ki disk', next: 'scope' },
          { t: 'Cluster ke bahar — RDS, S3, DynamoDB', next: 'ext' },
        ],
      },
      scope: {
        q: 'Kitna gaya hai?',
        why: 'Ek namespace ka jaana aur poore control plane ka jaana alag aapda hain. Auzaar bhi alag hain.',
        options: [
          { t: 'Kuch objects ya ek namespace — API server chal raha hai', next: 'kind' },
          { t: 'Poora cluster ya control plane — API server jawab nahi deta', next: 'cp' },
        ],
      },
      kind: {
        q: 'Khoyi hui cheez kis tarah ki hai?',
        why: 'Git mein <b>YAML</b> hota hai, <b>data</b> nahi. Haath se bana Secret ya disk par likhi entries Git se wapas nahi aati.',
        options: [
          { t: 'YAML jo Git repo mein likha hai', next: 'git' },
          { t: 'Haath se bane objects, ya objects ke saath disk ka data', next: 'velero' },
          { t: 'Sirf ek PVC ka data kharab hai; objects theek hain', next: 'snap' },
        ],
      },
      cp: {
        q: 'Control plane kaun chalata hai?',
        why: 'EKS mein etcd AWS ke paas hai — etcd ka snapshot tumhare haath mein nahi. Self-managed cluster mein etcd tumhara hai.',
        options: [
          { t: 'Hum khud (kubeadm, self-managed)', next: 'etcd' },
          { t: 'Cloud (EKS, GKE, AKS)', next: 'rebuild' },
        ],
      },
      git: {
        leaf: true, pick: 'Git se dobara apply (GitOps ka sync)', icon: '📁',
        one: 'ArgoCD ko sync karne do, ya <code>kubectl apply</code> chalao. Objects wapas ban jaate hain.',
        why: 'YAML Git mein surakshit hai. Kuch khoya hi nahi — bas cluster ko Git jaisa banana hai.',
        when: ['Deployment, Service, ConfigMap, Ingress', 'Poora namespace jisme koi disk nahi'],
        avoid: ['PVC ka data → Git mein nahi hota', 'Haath se bana Secret → Git mein kabhi gaya hi nahi'],
        gotchas: [
          'PVC ka YAML wapas aayega, par nayi PVC <b>khaali</b> hogi.',
          'CRD pehle bane, custom resource baad mein — ArgoCD mein sync waves.',
          'Secrets ke liye External Secrets ya Sealed Secrets rakho, taaki Secrets bhi Git ke raaste wapas aa sakein.',
        ],
        yaml: `argocd app sync payments
# ya ArgoCD ke bina:
kubectl apply -k overlays/prod`,
        example: 'pay-api ka Service aur ConfigMap galti se delete hue. ArgoCD ne 40 second mein dono wapas bana diye.', level: 'd2-backup',
      },
      velero: {
        leaf: true, pick: 'Velero restore (objects + disk ka data)', icon: '⛵',
        one: 'Velero ke backup se namespace ke objects aur volumes ek saath wapas lao.',
        why: 'Jo cheez Git mein nahi hai — haath se bane objects, disk ka data — sirf backup se wapas aati hai.',
        when: ['Namespace delete hua jisme PVC thi', 'Haath se bane Secrets / ConfigMaps', 'Cluster migration (purane cluster se naye mein)'],
        avoid: ['Database ka point-in-time restore (theek 08:55 ki haalat) → database ka apna backup', 'RDS / S3 → Velero cluster ke bahar ki cheez nahi chhuta'],
        gotchas: [
          'Velero default mein maujood object ko <b>overwrite nahi karta</b>. Jo object cluster mein pehle se hai, Velero use chhod deta hai.',
          'Volume ka data tabhi wapas aata hai jab backup mein volume snapshot ya file-system backup chalu tha. Warna sirf YAML aata hai.',
          'Backup ki umar (TTL) default mein 30 din hai. Uske baad backup khud delete ho jaata hai.',
          'Jis backup ka restore kabhi aazmaya nahi, us backup par bharosa mat karo. Har mahine drill.',
        ],
        yaml: `velero backup get
velero restore create --from-backup payments-daily \\
  --include-namespaces payments
velero restore describe <restore-ka-naam>`,
        example: 'Namespace payments delete hua. Velero se ledger ki PVC (18,000 entries) aur haath se bana Secret dono wapas aaye.', level: 'd2-backup',
      },
      snap: {
        leaf: true, pick: 'VolumeSnapshot se nayi PVC banao (CSI)', icon: '📸',
        one: 'Disk ke purane snapshot se ek <b>nayi</b> PVC banao, phir pod ko nayi PVC do.',
        why: 'Objects theek hain. Sirf ek disk ko purane samay par le jaana hai — poore namespace ka restore zaroorat se zyada hai.',
        when: ['Kharab release ne disk ki files bigaad di', 'Khatarnak migration se pehle ka "save point"'],
        avoid: ['Namespace hi delete ho gaya — VolumeSnapshot object bhi namespace ke saath gaya ho sakta hai → Velero'],
        gotchas: [
          'Snapshot se hamesha <b>nayi</b> PVC banti hai. Purani PVC apni jagah par peeche nahi jaati.',
          'Snapshot "crash-consistent" hota hai: jaise bijli chali gayi ho. Database ke liye snapshot se pehle writes rok do, ya database ka apna backup lo.',
          'Teen cheezein chahiye: CSI driver, snapshot controller, aur ek <code>VolumeSnapshotClass</code>.',
        ],
        yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: ledger-data-restored, namespace: payments }
spec:
  storageClassName: gp3
  dataSource:
    name: ledger-data-nightly
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes: ["ReadWriteOnce"]
  resources: { requests: { storage: 20Gi } }`,
        example: 'Kharab release ne ledger ki files bigaad di. Kal raat ke snapshot se nayi PVC bani, ledger ko nayi PVC di gayi.', level: 'd2-backup',
      },
      etcd: {
        leaf: true, pick: 'etcd snapshot restore (self-managed)', icon: '🗄️',
        one: 'etcd ke snapshot se poore cluster ki haalat (saare objects) wapas lao.',
        why: 'API server ka saara data etcd mein hai. etcd gaya toh cluster ko kuch yaad nahi.',
        when: ['kubeadm cluster ke control-plane nodes ki disk gayi', 'etcd ka data corrupt hua'],
        avoid: ['EKS / GKE / AKS → etcd tumhare haath mein nahi hai', 'Sirf ek namespace wapas chahiye → etcd restore <b>poore</b> cluster ko peeche le jaata hai'],
        gotchas: [
          'Snapshot ke baad bane saare objects chale jaate hain — poora cluster snapshot ke samay par laut jaata hai.',
          'etcd mein sirf objects hain. PVC ki disk ka data etcd mein nahi hota.',
          'Restore nayi data directory mein hota hai. Phir etcd ke static pod manifest mein nayi directory batani padti hai.',
        ],
        yaml: `# backup (roz, cluster ke bahar rakho):
etcdctl snapshot save /backup/etcd.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
# restore:
etcdutl snapshot restore /backup/etcd.db \\
  --data-dir /var/lib/etcd-restore`,
        example: 'kubeadm cluster ke control-plane node ki disk kharab hui. Subah 06:00 ke etcd snapshot se cluster wapas aaya.', level: 'd2-backup',
      },
      rebuild: {
        leaf: true, pick: 'Naya cluster + GitOps + Velero (managed)', icon: '🏗️',
        one: 'Naya cluster banao (Terraform), GitOps se apps lagao, Velero se data lao.',
        why: 'Managed cluster mein etcd ka snapshot nahi milta. Cluster ko dobara "banaya" jaata hai, "restore" nahi kiya jaata.',
        when: ['EKS cluster galti se delete hua', 'Doosre region mein disaster recovery'],
        avoid: ['Cluster chal raha hai aur sirf ek namespace gaya → Velero restore kaafi hai'],
        gotchas: [
          'Velero ka backup bucket cluster ke <b>bahar</b> ho — alag AWS account ya region mein. Warna cluster ke saath backup bhi gaya.',
          'Naye cluster mein add-ons, IAM roles aur Pod Identity associations bhi dobara banane padte hain.',
          'Load balancer ka address naya hoga → DNS record badalna padega.',
        ],
        yaml: `terraform apply                      # 1. naya cluster + add-ons
argocd app sync --selector env=prod  # 2. saare apps Git se
velero restore create --from-backup payments-daily   # 3. data`,
        example: 'chaipay-prod galti se delete hua. Terraform + ArgoCD + Velero se 50 minute mein naya cluster chalu.', level: 'd2-backup',
      },
      ext: {
        leaf: true, pick: 'Cloud service ka apna backup (RDS, S3)', icon: '☁️',
        one: 'RDS ke liye point-in-time restore. S3 ke liye versioning.',
        why: 'Data cluster ke bahar hai. Kubernetes ka koi bhi backup is data ko jaanta hi nahi.',
        when: ['RDS mein galat migration ya galat DELETE', 'S3 se files delete ho gayi'],
        avoid: ['Database pod ke andar PVC par chal raha hai → woh cluster ke andar hai (Velero / VolumeSnapshot)'],
        gotchas: [
          'RDS ka point-in-time restore ek <b>naya</b> database instance banata hai. App ka database address badalna padta hai.',
          'S3 versioning delete se <b>pehle</b> chalu honi chahiye. Baad mein chalu karne se purani files wapas nahi aati.',
          'RDS ke automated backups 1 se 35 din tak rakhe ja sakte hain. Point-in-time restore sirf isi umar ke andar ke samay par hota hai.',
        ],
        yaml: `aws rds restore-db-instance-to-point-in-time \\
  --source-db-instance-identifier chaipay-ledger \\
  --target-db-instance-identifier chaipay-ledger-restore \\
  --restore-time 2026-11-14T08:55:00Z`,
        example: 'Galat migration ne 09:00 baje RDS ki ek table khaali kar di. 08:55 ki haalat ka naya instance bana.', level: 'd2-backup',
      },
    },
    compare: {
      cols: ['', 'Git', 'Velero', 'VolumeSnapshot', 'etcd snapshot', 'Cloud ka backup'],
      rows: [
        ['Kya wapas aata hai', 'YAML (objects)', 'Objects + disk ka data', 'Ek disk ka data', 'Saare objects', 'RDS / S3 ka data'],
        ['Daayra', 'Jo Git mein hai', 'Namespace ya cluster', 'Ek PVC', 'Poora cluster', 'Ek cloud service'],
        ['EKS par milta hai?', 'Haan', 'Haan', 'Haan (EBS CSI)', 'Nahi', 'Haan'],
      ],
    },
    scenarios: [
      { s: 'Ek engineer ne galti se namespace payments delete kar diya. ledger ki PVC mein 18,000 entries thi.', answer: 'velero', explain: 'Objects aur disk ka data dono gaye. Disk ka data Git mein nahi hota → Velero restore.' },
      { s: 'pay-api ka Service aur ConfigMap galti se delete ho gaye. Dono ke YAML ArgoCD wali repo mein hain.', answer: 'git', explain: 'Koi data nahi khoya. ArgoCD sync se dono wapas ban jaate hain.' },
      { s: 'kubeadm cluster ke control-plane nodes ki disk kharab ho gayi. API server jawab nahi deta.', answer: 'etcd', explain: 'Self-managed cluster mein cluster ki yaaddasht etcd hai → etcd snapshot restore.' },
      { s: 'RDS PostgreSQL mein ek galat migration ne 09:00 baje ledger table khaali kar di.', answer: 'ext', explain: 'RDS cluster ke bahar hai. RDS ka point-in-time restore 08:55 ki haalat ka naya instance banata hai.' },
      { s: 'EKS cluster chaipay-prod galti se "terraform destroy" ho gaya.', answer: 'rebuild', explain: 'EKS mein etcd snapshot nahi milta. Naya cluster banao, GitOps se apps, Velero se data.' },
      { s: 'ledger ke saare objects theek hain. Par ek kharab release ne PVC ki files bigaad di. Kal raat ka CSI snapshot maujood hai.', answer: 'snap', explain: 'Sirf ek disk ko peeche le jaana hai → snapshot se nayi PVC banao aur ledger ko nayi PVC do.' },
    ],
  },

  /* ================= 18. ALERTING (Observability) ================= */
  {
    id: 'alerting', icon: '📟',
    title: 'Naya alert — page, ticket, sirf dashboard, silence, ya inhibition?',
    short: 'Phone kab baje?',
    tldr: 'User ko <b>abhi</b> dard hai → <b>page</b>. Zaroori hai par subah tak ruk sakta hai → <b>ticket</b>. User theek hai aur system khud sambhal leta hai → <b>sirf dashboard</b>. Planned kaam → <b>silence</b>. Ek wajah ke kai alert → <b>inhibition + grouping</b>.',
    levels: ['ob-alerts'], labs: [],
    start: 'known',
    nodes: {
      known: {
        q: 'Kya is alert ki wajah on-call ko pehle se pata hai?',
        why: 'Jis alert ki wajah pehle se pata hai, woh alert sirf shor hai. Zyada shor se log saare alerts ko ignore karna seekh jaate hain.',
        options: [
          { t: 'Nahi — nayi, anjaan haalat hai', next: 'pain' },
          { t: 'Haan — planned kaam chal raha hai (upgrade, migration)', next: 'silence' },
          { t: 'Haan — ek bada alert pehle hi baj chuka hai', next: 'inhibit' },
        ],
      },
      pain: {
        q: 'Kya user ko abhi dard ho raha hai (errors ya dheemapan)?',
        why: 'Page ka matlab hai kisi ko neend se jagana. Page sirf <b>lakshan</b> par ho (user ka dard), <b>wajah</b> par nahi (CPU zyada hai).',
        options: [
          { t: 'Haan — abhi, aur lagataar', next: 'page' },
          { t: 'Nahi — abhi user theek hai', next: 'later' },
        ],
      },
      later: {
        q: 'Kya agle kuch dinon mein kisi insaan ko kaam karna hi padega?',
        why: 'Jo cheez 4 din mein tootegi, us cheez ke liye raat ko jagana galat hai — par bhool jaana bhi galat hai.',
        options: [
          { t: 'Haan — warna kuch din mein tootega', next: 'ticket' },
          { t: 'Nahi — system khud sambhal leta hai', next: 'dash' },
        ],
      },
      page: {
        leaf: true, pick: 'Page (on-call ka phone abhi baje)', icon: '📟',
        one: 'User ka dard, abhi, lagataar → on-call ke phone par ghanti.',
        why: 'Har minute ke saath error budget jal raha hai aur kuch kiya ja sakta hai.',
        when: ['Error rate ya latency SLO se bahar, aur 5–15 minute se lagataar', 'Error budget tezi se jal raha hai (burn rate zyada)'],
        avoid: ['3 minute ki halchal → <code>for:</code> se roko', 'Wajah wale number (CPU, memory) → dashboard'],
        gotchas: [
          'Har page ke saath runbook ka link ho: "ab kya karna hai".',
          'Burn rate aur samay dono dekho: sirf threshold rakhoge toh ek chhoti halchal par bhi ghanti bajegi.',
          'On-call ko hafte mein bahut zyada pages milen toh alert rule theek karo, on-call ko nahi.',
        ],
        yaml: `- alert: PayApiErrorBudgetBurn
  expr: |
    sum(rate(http_requests_total{app="pay-api",code=~"5.."}[5m]))
      / sum(rate(http_requests_total{app="pay-api"}[5m]))
    > (10 * 0.001)          # SLO 99.9% → budget 0.1% → burn 10×
  for: 5m
  labels: { severity: page, team: payments }
  annotations:
    runbook_url: https://runbooks.chaipay.in/pay-api-errors`,
        example: 'pay-api ke 4% payments 10 minute se fail. Burn rate 40× → page 5 minute mein.', level: 'ob-alerts',
      },
      ticket: {
        leaf: true, pick: 'Ticket (kaam ke ghanton mein dekho)', icon: '🎫',
        one: 'Subah team ki queue mein ek ticket. Raat ko koi nahi jaagta.',
        why: 'Kaam zaroori hai, par abhi kisi user ko dard nahi. Samay hai.',
        when: ['Disk kuch din mein bharegi', 'Certificate 1–2 hafte mein expire hoga', 'Error budget dheere-dheere jal raha hai'],
        avoid: ['User ko abhi dard hai → page'],
        gotchas: [
          'Ticket ka ek maalik aur ek tareekh ho. Bina maalik ka ticket = bhoola hua alert.',
          'Samay kam bache toh wahi alert page ban jaye. Certificate: 12 din → ticket, 2 din → page.',
        ],
        yaml: `- alert: LedgerDiskFullIn4Days
  expr: |
    predict_linear(
      kubelet_volume_stats_available_bytes{persistentvolumeclaim="ledger-data"}[6h],
      4 * 24 * 3600) < 0
  for: 1h
  labels: { severity: ticket, team: payments }`,
        example: 'ledger ki disk 4 din mein bhar jayegi. Subah ka ticket: PVC ko 20Gi se 40Gi karo.', level: 'ob-alerts',
      },
      dash: {
        leaf: true, pick: 'Sirf dashboard (koi sandesh nahi)', icon: '📊',
        one: 'Number ko graph par rakho. Kisi ko sandesh mat bhejo.',
        why: 'User theek hai aur Kubernetes khud sambhal leta hai. Sandesh sirf shor banega.',
        when: ['CPU 85%, par latency aur errors theek', 'Ek pod restart hua, baaki pods chal rahe hain'],
        avoid: ['Wahi cheez baar-baar ho aur errors badhen → tab lakshan wala alert (page) khud bajega'],
        gotchas: [
          'Dashboard zaroori hai: page aane par wajah isi dashboard par dikhti hai.',
          '"Shayad kaam aaye" soch kar alert mat banao. Jis alert par koi kuch nahi karta, woh alert hatao.',
        ],
        yaml: `# Grafana panel (alert nahi):
sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="payments"}[5m]))`,
        example: 'node-2 ka CPU 85% hai, latency theek hai. Dashboard par dikhta hai; kisi ka phone nahi bajta.', level: 'ob-alerts',
      },
      silence: {
        leaf: true, pick: 'Silence (tay samay tak chup rakho)', icon: '🔕',
        one: 'Alertmanager mein chuninda alerts ko tay samay ke liye chup karo.',
        why: 'Sabko pata hai ki alert bajega aur kyun bajega. Sandesh kisi kaam ka nahi.',
        when: ['Planned upgrade ya node drain', 'Jaani hui problem jiska ilaaj chal raha hai'],
        avoid: ['Hamesha ke liye chup karna hai → alert rule hi theek karo ya hatao'],
        gotchas: [
          'Silence ka khatam hone ka samay zaroor ho. Samay poora hote hi silence khud hat jaata hai.',
          'Silence chhota rakho: sirf woh alerts jo matchers se milte hain. Poore cluster ko chup mat karo.',
          'Silence alert ko band nahi karta. Alert bajta rehta hai; Alertmanager sirf sandesh nahi bhejta.',
        ],
        yaml: `amtool silence add alertname=KubeNodeNotReady node=~"node-.*" \\
  --duration=2h --author=platform \\
  --comment="Planned node upgrade CHG-1042"`,
        example: 'Raat 11 baje node group ka upgrade. NodeNotReady alerts 2 ghante ke liye chup.', level: 'ob-alerts',
      },
      inhibit: {
        leaf: true, pick: 'Inhibition + grouping (ek sandesh)', icon: '🧯',
        one: 'Bada alert chhote alerts ko daba de. Ek jaise alerts ek sandesh mein jud jaayein.',
        why: 'Wajah ek hai. 40 sandesh on-call ko asli wajah se door le jaate hain.',
        when: ['Node gira → us node ke har pod ka alert', 'Database gira → har service ka "database connection" alert'],
        avoid: ['Alerts ki wajahein alag hain → dabaoge toh asli problem chhup jayegi'],
        gotchas: [
          '<code>equal: [node]</code> ka matlab: dono alerts par label <code>node</code> ki keemat ek jaisi ho. Agar label dono par hai hi nahi, tab bhi Alertmanager "barabar" maanta hai — zaroorat se zyada alerts dab sakte hain.',
          'Grouping sandesh kam karta hai; inhibition sandesh rokta hai. Dono alag auzaar hain.',
        ],
        yaml: `route:
  group_by: [alertname, namespace]
inhibit_rules:
  - source_matchers: [alertname="NodeDown"]
    target_matchers: [severity="warning"]
    equal: [node]`,
        example: 'node-3 gira. 40 pod alerts ki jagah on-call ko 1 sandesh mila: "NodeDown node-3".', level: 'ob-alerts',
      },
    },
    scenarios: [
      { s: 'fraud-check ka p99 latency 20 minute se 4 second hai. Waada 800 ms ka hai.', answer: 'page', explain: 'User ka dard, abhi, lagataar. Dheema payment bhi user ke liye toota payment hai → page.' },
      { s: 'Prometheus ki apni disk 6 din mein bhar jayegi.', answer: 'ticket', explain: 'Abhi kisi ko dard nahi, par kaam karna hi hai. 6 din hain → subah ka ticket.' },
      { s: 'pay-api ka ek pod OOMKilled hua. Baaki 5 pods chal rahe hain aur error rate 0.02% hai.', answer: 'dash', explain: 'Kubernetes ne pod dobara bana diya, user theek hai. Dashboard par dikhe; phone na baje.' },
      { s: 'Raat 11 baje node group ka planned upgrade hai. Har node drain par NodeNotReady alert bajega.', answer: 'silence', explain: 'Wajah pata hai aur samay tay hai → 2 ghante ka silence.' },
      { s: 'Database gir gaya. Ab pay-api, ledger aur fraud-check — teeno ke "database connection" alert alag-alag baj rahe hain.', answer: 'inhibit', explain: 'Wajah ek hai (database). Bada alert chhote alerts ko daba de → inhibition.' },
      { s: 'notify se OTP ke sandesh 12 minute se nahi ja rahe. Customers login nahi kar paa rahe.', answer: 'page', explain: 'Customers abhi ruke hue hain → page.' },
      { s: 'api.chaipay.in ka TLS certificate 12 din mein expire hoga.', answer: 'ticket', explain: 'Abhi dard nahi, par 12 din mein tootega → ticket. 2 din bachen toh page.' },
    ],
  },

  /* ================= 19. SIGNAL (Observability) ================= */
  {
    id: 'signal', icon: '🔭',
    title: 'Kuch gadbad hai — metric, trace, log, ya Kubernetes events?',
    short: 'Pehle kya kholun?',
    tldr: '<b>Kya</b> gadbad hai aur kitni → <b>metric</b>. Samay <b>kahan</b> gaya (kai services) → <b>trace</b>. <b>Kyun</b> hua (ek service) → <b>log</b>. Pod shuru hi nahi hota → <b>describe / events</b>.',
    levels: ['ob-metrics', 'ob-traces'], labs: [],
    start: 'ask',
    nodes: {
      ask: {
        q: 'Tumhara sawal kya hai?',
        why: 'Har auzaar ek alag sawal ka jawab deta hai. Seedha logs mein kood jaoge toh 40 services ke logs mein kho jaoge.',
        options: [
          { t: 'Kya gadbad hai? Kitni? Kab se?', next: 'metric' },
          { t: 'Ek dheemi request ka samay kis service mein gaya?', next: 'trace' },
          { t: 'Ek service ke andar hua kya? Error ka sandesh kya tha?', next: 'logq' },
          { t: 'Pod shuru kyun nahi hota, ya baar-baar kyun marta hai?', next: 'events' },
        ],
      },
      logq: {
        q: 'Jis pod ke logs chahiye, kya woh pod abhi maujood hai?',
        why: '<code>kubectl logs</code> node par rakhi file padhta hai. Pod delete hua toh file bhi gayi.',
        options: [
          { t: 'Haan — pod maujood hai (chal raha hai ya abhi restart hua)', next: 'klogs' },
          { t: 'Nahi — pod delete ho chuka, ya bahut saare pods mein dhoondhna hai', next: 'loki' },
        ],
      },
      metric: {
        leaf: true, pick: 'Metrics (Prometheus aur PromQL)', icon: '📈',
        one: 'Number jo samay ke saath badalte hain: rate, error %, latency.',
        why: 'Metric sabse sasta aur sabse tez jawab hai: "kya kuch gadbad hai, aur kab se".',
        when: ['Error rate, latency, CPU, queue ki lambai', 'Alert aur dashboard'],
        avoid: ['"Is ek request ke saath kya hua" → trace ya log'],
        gotchas: [
          'Counter par hamesha <code>rate()</code> lagao. Kachcha counter sirf badhta rehta hai.',
          'Label mein <code>user_id</code> ya <code>order_id</code> mat daalo. Har alag keemat ek nayi series banati hai — Prometheus ki memory bhar jaati hai.',
          'Metric "kya" batata hai, "kyun" nahi.',
        ],
        yaml: `# pay-api ke kitne pratishat requests fail ho rahe hain:
sum(rate(http_requests_total{app="pay-api",code=~"5.."}[5m]))
  / sum(rate(http_requests_total{app="pay-api"}[5m])) * 100`,
        example: 'Grafana par dikha: pay-api ka error rate 14:05 se 0.1% se 4% ho gaya.', level: 'ob-metrics',
      },
      trace: {
        leaf: true, pick: 'Traces (OpenTelemetry aur Tempo)', icon: '🧵',
        one: 'Ek request ki poori kahani: kis service mein kitna samay laga.',
        why: 'Request kai services se guzarti hai. Trace batati hai dheemapan <b>kahan</b> hai.',
        when: ['"Payment 2.7 second leta hai — kaun sa hop dheema hai?"', 'Microservices jahan ek request 3+ services chhooti hai'],
        avoid: ['"Kul kitne requests fail hue" → metric (trace sirf kuch requests ki rakhi jaati hai)'],
        gotchas: [
          'Har service <code>traceparent</code> header agli service ko bheje. Ek service bhool jaye → trace do tukdon mein toot jaati hai.',
          'Sampling: aksar sirf 1–10% requests ki trace rakhi jaati hai. Har request ki trace nahi milegi.',
          'Queue (SQS, Kafka) ke paar trace khud nahi jaati. trace_id ko message ke headers mein bhejna padta hai.',
        ],
        yaml: `trace 4bf92f35  (kul 2.71 s)
└─ api-gateway        2.71 s
   └─ pay-api         2.70 s
      ├─ fraud-check  2.61 s   ← samay yahan gaya
      └─ ledger       0.04 s`,
        example: 'Trace mein dikha: 2.71 second mein se 2.61 second fraud-check ne liye.', level: 'ob-traces',
      },
      klogs: {
        leaf: true, pick: 'kubectl logs (--previous ke saath)', icon: '📜',
        one: 'Us pod ke container ne stdout par jo likha, seedha padho.',
        why: 'Pod maujood hai. Central logging kholne se tez yahi hai.',
        when: ['Ek pod, abhi ki problem', 'Container abhi restart hua — pichhle run ne marne se pehle kya likha'],
        avoid: ['Pod delete ho chuka → logs bhi gaye → central logs', '20 pods mein ek line dhoondhni hai → central logs'],
        gotchas: [
          '<code>--previous</code> sirf <b>ek</b> pichhla run dikhata hai. Usse purane run gaye.',
          '<code>kubectl logs deploy/pay-api</code> sirf <b>ek</b> pod chunta hai. Saare pods ke liye <code>-l app=pay-api --prefix</code>.',
          'Pod mein ek se zyada container hain toh <code>-c &lt;container&gt;</code>.',
        ],
        yaml: `kubectl -n payments logs pay-api-7d9f-x2 --previous --tail=50
kubectl -n payments logs -l app=pay-api --prefix --since=10m`,
        example: 'pay-api pod 2 minute pehle restart hua. --previous se aakhri line mili: "panic: nil pointer".', level: 'ob-traces',
      },
      loki: {
        leaf: true, pick: 'Central logs (Fluent Bit + Loki)', icon: '🗃️',
        one: 'Saare pods ke logs ek jagah. Pod delete hone ke baad bhi milte hain.',
        why: 'Pod ja chuka hai, ya dhoondhna bahut saare pods mein hai.',
        when: ['Kal raat ke pod ke logs', 'Ek trace_id ko saari services ke logs mein dhoondhna'],
        avoid: ['Ek chalte pod ki abhi ki line → kubectl logs tez hai'],
        gotchas: [
          'Loki sirf labels (namespace, app, pod) ka index banata hai. <code>trace_id</code> ya <code>user_id</code> ko label mat banao — log ki line ke andar likho.',
          'App <code>stdout</code> par likhe. Container ke andar ki file mein likhe logs node ke agent ko nahi milte.',
          'Logs kitne din rakhne hain (retention) pehle tay karo — disk ka kharcha isi se banta hai.',
        ],
        yaml: `# LogQL: pay-api ke saare pods mein ek trace_id dhoondho
{namespace="payments", app="pay-api"} |= "trace_id=4bf92f35"`,
        example: 'Kal raat 02:14 wala notify pod delete ho chuka hai. Loki mein us pod ke logs ab bhi hain.', level: 'ob-traces',
      },
      events: {
        leaf: true, pick: 'kubectl describe pod + get events', icon: '🩺',
        one: 'Kubernetes khud batata hai: schedule kyun nahi hua, image kyun nahi aayi, container kyun mara.',
        why: 'Container shuru hi nahi hua toh app ne koi log likha hi nahi. Jawab Kubernetes ke events mein hai.',
        when: ['Pending, ContainerCreating, ImagePullBackOff', 'CrashLoopBackOff ka exit code aur wajah (OOMKilled)'],
        avoid: ['App ke andar ki galti (galat SQL, exception) → logs'],
        gotchas: [
          'Events default mein sirf lagbhag <b>1 ghante</b> rehte hain. Der se dekhoge toh events ja chuke honge.',
          'Events namespace ke hote hain: <code>-n payments</code> mat bhoolo.',
          'Exit code 137 = container ko zabardasti maara gaya (aksar OOMKilled). <code>describe</code> ke "Last State" mein wajah likhi hoti hai.',
        ],
        yaml: `kubectl -n payments describe pod ledger-0
kubectl -n payments get events --sort-by=.lastTimestamp | tail -20`,
        example: 'ledger-0 9 minute se ContainerCreating tha. Events: "failed to assign an IP address to container".', level: 'ob-traces',
      },
    },
    compare: {
      cols: ['', 'Metric', 'Trace', 'Log', 'Events'],
      rows: [
        ['Kis sawal ka jawab', 'Kya? Kitna? Kab se?', 'Samay kahan gaya?', 'Kyun hua?', 'Kubernetes ne kya kiya?'],
        ['Daayra', 'Saare requests ka jod', 'Ek request', 'Ek service ki ek line', 'Ek object (pod, node)'],
        ['Kharcha', 'Sabse kam', 'Zyada (isliye sampling)', 'Zyada (isliye retention)', 'Muft, par ~1 ghanta'],
      ],
    },
    scenarios: [
      { s: 'Grafana par dekhna hai: pichhle 1 ghante mein pay-api ke kitne pratishat payments fail hue.', answer: 'metric', explain: '"Kitne pratishat" = saare requests ka jod → metric (PromQL).' },
      { s: 'Ek payment ko 2.7 second lage. Request api-gateway → pay-api → fraud-check → ledger se guzarti hai. Kaun sa hop dheema hai?', answer: 'trace', explain: 'Samay "kahan" gaya, kai services ke beech → trace.' },
      { s: 'pay-api pod 2 minute pehle restart hua. Marne se pehle pay-api ne kya likha tha?', answer: 'klogs', explain: 'Pod maujood hai aur ek hi pichhla run chahiye → kubectl logs --previous.' },
      { s: 'Kal raat 02:14 par jo notify pod tha, woh pod ab delete ho chuka hai. Us pod ne kya likha tha?', answer: 'loki', explain: 'Pod ke saath node ki log file bhi gayi. Sirf central logs mein milega.' },
      { s: 'ledger-0 pod 9 minute se ContainerCreating mein hai. Container shuru hi nahi hua.', answer: 'events', explain: 'App ne abhi kuch likha hi nahi. Wajah Kubernetes ke events mein hai → describe.' },
      { s: 'trace_id 4bf92f35 wali line pay-api ke 20 pods mein se kis pod ne likhi?', answer: 'loki', explain: '20 pods mein ek line → ek LogQL query, 20 kubectl logs nahi.' },
    ],
  },

  /* ================= 20. ADMISSION (Security) ================= */
  {
    id: 'admission', icon: '🛂',
    title: 'Cluster ke niyam — Pod Security Admission, ValidatingAdmissionPolicy, Kyverno, ya Gatekeeper?',
    short: 'Niyam kaun lagu kare?',
    tldr: 'Pod ki mool suraksha (privileged, hostPath, root) → <b>Pod Security Admission</b>. Apna "haan / na" niyam → <b>ValidatingAdmissionPolicy</b> (kuch install nahi). YAML badalna, naya object banana, image signature → <b>Kyverno</b>. Rego ke niyam pehle se hain → <b>OPA Gatekeeper</b>.',
    levels: ['sec-policy'], labs: ['18-admission-policy'],
    start: 'need',
    nodes: {
      need: {
        q: 'Niyam ko kya karna hai?',
        why: 'Rokna (validate) sabse saada kaam hai aur Kubernetes ke andar hi ho jaata hai. Badalna (mutate) aur naya object banana (generate) ke liye alag engine chahiye.',
        options: [
          { t: 'Sirf rokna — "haan" ya "na"', next: 'std' },
          { t: 'YAML badalna, naya object banana, ya image ka signature jaanchna', next: 'kyv' },
        ],
      },
      std: {
        q: 'Kya niyam Kubernetes ke bane-banaye Pod Security Standards mein aata hai?',
        why: 'Pod Security Standards teen tayyar star hain: <code>privileged</code>, <code>baseline</code>, <code>restricted</code>. Privileged container, hostPath, hostNetwork, root user jaise niyam in staron mein pehle se likhe hain.',
        options: [
          { t: 'Haan — privileged, hostPath, hostNetwork, root user jaisi cheezein', next: 'psa' },
          { t: 'Nahi — hamara apna niyam (image registry, labels, requests)', next: 'lang' },
        ],
      },
      lang: {
        q: 'Kya team ke paas pehle se Rego (OPA) mein likhe niyam hain?',
        why: 'Rego wahi bhasha hai jo Terraform aur CI ki jaanch mein bhi chalti hai. Naye sire se shuru kar rahe ho toh Kubernetes ke andar wali CEL bhasha sabse halki hai.',
        options: [
          { t: 'Nahi — naye sire se, aur kuch install nahi karna', next: 'vap' },
          { t: 'Haan — wahi Rego niyam Terraform aur CI mein bhi chalte hain', next: 'gk' },
        ],
      },
      psa: {
        leaf: true, pick: 'Pod Security Admission (namespace par label)', icon: '🏷️',
        one: 'Namespace par ek label lagao. Kubernetes khatarnak pods ko khud rok deta hai.',
        why: 'Niyam pehle se bana-banaya hai. Na kuch install karna, na kuch likhna.',
        when: ['Har namespace ki mool suraksha', 'Privileged container, hostPath, hostNetwork, root user rokna'],
        avoid: ['Apna niyam (image registry, labels, requests) → Pod Security Admission mein nahi ban sakta', 'Kuch badalna hai (mutate) → Kyverno'],
        gotchas: [
          'Pod Security Admission sirf <b>pod</b> ko rokta hai. Deployment ban jaata hai, pod nahi banta — error ReplicaSet ke events mein chhupa hota hai. Isliye <code>warn</code> label bhi lagao.',
          'Label lagane se pehle dry-run karo: Kubernetes bata deta hai ki kaun se chalte pods naya star todte hain.',
          '<code>restricted</code> bahut sakht hai. Aksar shuruaat: enforce <code>baseline</code>, warn <code>restricted</code>.',
        ],
        yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: payments
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
# pehle dekho kaun tootega:
# kubectl label --dry-run=server --overwrite ns payments \\
#   pod-security.kubernetes.io/enforce=restricted`,
        example: 'Namespace payments par enforce=baseline. Ek privileged debug pod banane ki koshish → mana.', level: 'sec-policy',
      },
      vap: {
        leaf: true, pick: 'ValidatingAdmissionPolicy (CEL, bina install)', icon: '🛂',
        one: 'Niyam CEL bhasha ki ek shart hai. API server khud jaanchta hai — koi webhook nahi.',
        why: 'Apna "haan / na" niyam chahiye, aur cluster mein kuch naya chalana nahi hai.',
        when: ['Image par pakka tag ho', 'Har Deployment mein requests hon', 'Image sirf apni registry se aaye'],
        avoid: ['YAML badalna ya naya object banana → Kyverno', 'Niyam ko doosre objects dekhne hain ("yeh host kisi aur Ingress mein toh nahi") → Kyverno / Gatekeeper'],
        gotchas: [
          'Do objects chahiye: <b>Policy</b> (niyam) aur <b>Binding</b> (kahan lage, todne par kya ho). Bina Binding ke Policy kuch nahi rokti.',
          'Pehle <code>validationActions: [Warn, Audit]</code>, purane workloads theek karo, phir <code>[Deny]</code>.',
          'Kubernetes v1.30 se stable hai. Purane cluster mein yeh object milega hi nahi.',
        ],
        yaml: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: { name: require-requests }
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
  validations:
    - expression: >-
        object.spec.template.spec.containers.all(c,
        has(c.resources) && has(c.resources.requests) &&
        'cpu' in c.resources.requests)
      message: "Har container mein CPU request likho."`,
        example: 'ChaiPay ne "image par pakka tag" ka niyam bina kuch install kiye laga diya.', level: 'sec-policy', lab: '18-admission-policy',
      },
      kyv: {
        leaf: true, pick: 'Kyverno (mutate, generate, verifyImages bhi)', icon: '🧬',
        one: 'Niyam YAML mein. Rok sakta hai, YAML badal sakta hai, naya object bana sakta hai, signature jaanch sakta hai.',
        why: 'Kaam "haan / na" se aage ka hai.',
        when: ['Har naye namespace mein default-deny NetworkPolicy ban jaye', 'Chhooti hui seccompProfile apne aap jud jaye', 'Sirf cosign se sign hui image chale'],
        avoid: ['Sirf ek-do saade "haan / na" niyam → ValidatingAdmissionPolicy halka hai'],
        gotchas: [
          'Kyverno khud cluster mein chalne wala webhook hai. Kyverno ke pods gire aur niyam "Fail" par ho → naye pods ban nahi paate. Kyverno ke 3 replicas rakho aur <code>kube-system</code> ko niyam se bahar rakho.',
          'Pehle <b>Audit</b>, report padho, phir <b>Enforce</b>.',
          'Mutate ke baad cluster ka object Git ke YAML se alag dikhta hai. ArgoCD "OutOfSync" dikha sakta hai.',
        ],
        yaml: `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: add-default-deny }
spec:
  rules:
    - name: default-deny
      match:
        any:
          - resources: { kinds: ["Namespace"] }
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny
        namespace: "{{request.object.metadata.name}}"
        synchronize: true
        data:
          spec: { podSelector: {}, policyTypes: ["Ingress", "Egress"] }`,
        example: 'Naya namespace banta hai → Kyverno usi pal default-deny NetworkPolicy bana deta hai.', level: 'sec-policy',
      },
      gk: {
        leaf: true, pick: 'OPA Gatekeeper (Rego + ConstraintTemplate)', icon: '🚧',
        one: 'Niyam Rego bhasha mein. Wahi niyam cluster ke bahar (CI, Terraform) bhi chal sakte hain.',
        why: 'Team ke paas Rego ke niyam aur Rego jaanne wale log pehle se hain.',
        when: ['Ek hi niyam-kitaab: Kubernetes + Terraform + CI', 'Niyam jo doosre objects ko dekh kar faisla karte hain'],
        avoid: ['Team Rego nahi jaanti aur niyam saade hain → ValidatingAdmissionPolicy ya Kyverno', 'Naya object banana (generate) → Kyverno'],
        gotchas: [
          'Do objects: <b>ConstraintTemplate</b> (Rego mein niyam) aur <b>Constraint</b> (kahan lage, kaun se parameters).',
          'Seedha <code>deny</code> mat karo. <code>enforcementAction: dryrun</code> → <code>warn</code> → <code>deny</code>.',
          'Gatekeeper bhi ek webhook hai: Gatekeeper ke pods girein toh admission par asar padta hai.',
        ],
        yaml: `apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata: { name: only-chaipay-registry }
spec:
  enforcementAction: dryrun      # pehle dryrun, phir deny
  match:
    kinds: [{ apiGroups: [""], kinds: ["Pod"] }]
    namespaces: ["payments"]
  parameters:
    repos: ["registry.chaipay.in/"]`,
        example: 'Security team ke 30 Rego niyam CI mein Terraform plan par aur cluster mein Gatekeeper par — ek hi kitaab.', level: 'sec-policy',
      },
    },
    compare: {
      cols: ['', 'Pod Security Admission', 'ValidatingAdmissionPolicy', 'Kyverno', 'Gatekeeper'],
      rows: [
        ['Install karna padta hai?', 'Nahi', 'Nahi', 'Haan', 'Haan'],
        ['Niyam kaise likhte hain', '3 tayyar star', 'CEL shart', 'YAML', 'Rego'],
        ['YAML badalna (mutate)', 'Nahi', 'Nahi', 'Haan', 'Haan'],
        ['Naya object banana (generate)', 'Nahi', 'Nahi', 'Haan', 'Nahi'],
        ['Aazmaish ka mode', 'warn / audit label', 'Warn / Audit', 'Audit', 'dryrun / warn'],
      ],
    },
    scenarios: [
      { s: 'Namespace payments mein koi bhi pod privileged: true ya hostNetwork ke saath na ban sake.', answer: 'psa', explain: 'Yeh niyam Pod Security Standards mein pehle se hai → namespace par ek label.' },
      { s: 'Har Deployment mein CPU aur memory request ho. Cluster mein kuch naya install nahi karna.', answer: 'vap', explain: 'Apna "haan / na" niyam, bina install → ValidatingAdmissionPolicy.' },
      { s: 'Har naye namespace mein apne aap ek default-deny NetworkPolicy ban jaye.', answer: 'kyv', explain: 'Ek object banne par doosra object banana = generate → Kyverno.' },
      { s: 'Sirf woh image chale jis par ChaiPay ki cosign key ka signature ho.', answer: 'kyv', explain: 'Signature ki jaanch = Kyverno ka verifyImages niyam.' },
      { s: 'Security team ke paas Rego mein 30 niyam hain. Wahi niyam CI mein Terraform plan par bhi chalte hain.', answer: 'gk', explain: 'Rego ke niyam aur Rego jaanne wale log pehle se hain → Gatekeeper.' },
      { s: 'Jis pod mein seccompProfile nahi likha, us pod mein RuntimeDefault apne aap jud jaye.', answer: 'kyv', explain: 'Request ko badalna = mutate → Kyverno.' },
      { s: 'Image sirf registry.chaipay.in se aaye. Team naye sire se shuru kar rahi hai aur koi webhook nahi chalana chahti.', answer: 'vap', explain: 'Saada "haan / na" niyam + koi webhook nahi → ValidatingAdmissionPolicy.' },
    ],
  },

  /* ================= 21. EKS IDENTITY (Networking & EKS) ================= */
  {
    id: 'eksid', icon: '🪪',
    title: 'EKS par pehchaan — Pod Identity, IRSA, node role, RBAC, ya access entry?',
    short: 'Kaun kis se baat kare?',
    tldr: 'Pod → AWS (EC2 nodes) → <b>EKS Pod Identity</b>. Pod → AWS (Fargate) → <b>IRSA</b>. Node → AWS → <b>node role</b>. Pod → Kubernetes API → <b>ServiceAccount + RBAC</b>. Insaan → cluster → <b>access entry</b>.',
    levels: ['eks-identity', 'sec-sa'], labs: ['08-rbac'],
    start: 'who',
    nodes: {
      who: {
        q: 'Kaun, kis se baat karna chahta hai?',
        why: 'EKS mein do alag duniya hain: AWS ki <b>IAM</b> aur Kubernetes ki <b>RBAC</b>. IAM role se Kubernetes API nahi khulti, aur RBAC se S3 nahi khulta. Pehle tay karo ki call kis duniya mein ja rahi hai.',
        options: [
          { t: 'Ek app ka pod → AWS ki service (S3, SQS, DynamoDB)', next: 'where' },
          { t: 'Ek app ka pod → cluster ki apni Kubernetes API', next: 'sarbac' },
          { t: 'Node khud → AWS (cluster se judna, ECR se image kheenchna)', next: 'noderole' },
          { t: 'Ek insaan ya CI pipeline → cluster (kubectl)', next: 'access' },
        ],
      },
      where: {
        q: 'Woh pod kahan chalta hai?',
        why: 'EKS Pod Identity ka agent sirf Linux EC2 nodes par chalta hai. Fargate par agent nahi hota.',
        options: [
          { t: 'EKS ke Linux EC2 nodes par', next: 'podid' },
          { t: 'EKS Fargate par', next: 'irsa' },
        ],
      },
      podid: {
        leaf: true, pick: 'EKS Pod Identity (ek association)', icon: '🤝',
        one: 'Ek association: "is cluster ke is namespace ke is ServiceAccount ko yeh IAM role do".',
        why: 'Pod EC2 node par hai. Pod Identity sabse kam setup maangta hai.',
        when: ['Naye EKS clusters, EC2 nodes', 'Ek hi IAM role kai clusters mein use karna hai'],
        avoid: ['Fargate → IRSA', 'Lambi umar ki access key Secret mein → kabhi nahi'],
        gotchas: [
          'Namespace ya ServiceAccount ka naam ek akshar bhi galat → association kisi pod se nahi milta. <b>Koi error nahi aata.</b>',
          'Association banane ke baad chalte pods ko kuch nahi milta. <code>kubectl rollout restart</code> karna padta hai.',
          'Add-on <code>eks-pod-identity-agent</code> har node par chalna chahiye, aur IAM role ka trust <code>pods.eks.amazonaws.com</code> par ho.',
        ],
        yaml: `aws eks create-pod-identity-association \\
  --cluster-name chaipay-prod \\
  --namespace payments --service-account notify-sa \\
  --role-arn arn:aws:iam::111122223333:role/notify-sqs-role
kubectl -n payments rollout restart deploy/notify`,
        example: 'notify ko SQS queue notify-queue padhni thi. Ek association + restart → AWS ko ab "notify-sqs-role" dikhta hai.', level: 'eks-identity',
      },
      irsa: {
        leaf: true, pick: 'IRSA (ServiceAccount par annotation)', icon: '🏷️',
        one: 'ServiceAccount par IAM role ka annotation. IAM role cluster ke OIDC provider par bharosa karta hai.',
        why: 'Fargate par Pod Identity ka agent nahi chalta. IRSA ko koi agent nahi chahiye.',
        when: ['EKS Fargate ke pods', 'Purane clusters jahan IRSA pehle se laga hai'],
        avoid: ['Naya cluster, EC2 nodes → Pod Identity saada hai'],
        gotchas: [
          'IAM role ki trust policy mein <code>system:serviceaccount:payments:notify-sa</code> likha hota hai. Ek akshar galat → <code>AssumeRoleWithWebIdentity</code> AccessDenied.',
          'Trust policy mein cluster ke OIDC provider ka URL hota hai. Naya cluster = naya URL = trust policy badalni padti hai.',
          'Annotation lagane ke baad pods ko dobara banana padta hai.',
        ],
        yaml: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: fraud-check-sa
  namespace: payments
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::111122223333:role/fraud-check-s3-role`,
        example: 'fraud-check Fargate par chalta hai aur S3 se model file padhta hai → IRSA.', level: 'eks-identity',
      },
      noderole: {
        leaf: true, pick: 'Node IAM role (sirf node ke kaam)', icon: '🖥️',
        one: 'Node ka apna role: cluster se judna aur ECR se images kheenchna. Bas.',
        why: 'Yeh kaam node ke hain, kisi app ke nahi.',
        when: ['kubelet ka cluster se judna', 'ECR se image pull'],
        avoid: ['App ki ijaazat (S3, SQS) node role mein daalna → us node ka <b>har</b> pod wahi ijaazat paa leta hai'],
        gotchas: [
          'Pod node ki metadata service (IMDS) se node ka role utha sakta hai. Node par IMDSv2 ki hop limit 1 rakho taaki pods IMDS tak na pahunchen.',
          'VPC CNI (<code>aws-node</code>) bhi ek pod hai. Use bhi apna alag role do; node role se <code>AmazonEKS_CNI_Policy</code> hatao.',
          'AccessDenied ke error mein <code>eks-node-role</code> dikhe → pod apni pehchaan nahi, node ki pehchaan use kar raha hai.',
        ],
        yaml: `# node role par sirf yeh policies:
AmazonEKSWorkerNodePolicy
AmazonEC2ContainerRegistryPullOnly
# pod se jaancho ki AWS ko kaun dikh raha hai:
kubectl -n payments exec deploy/notify -- aws sts get-caller-identity`,
        example: 'Ek team ne S3 ki ijaazat node role mein daal di. Us node ke saare pods S3 padh sakte the — audit mein pakda gaya.', level: 'eks-identity',
      },
      sarbac: {
        leaf: true, pick: 'ServiceAccount + Role + RoleBinding', icon: '🔑',
        one: 'Pod ka ServiceAccount, aur ek Role jo batata hai Kubernetes API mein kya-kya khula hai.',
        why: 'Call AWS ko nahi, cluster ki apni API ko ja rahi hai. Yahan IAM ka koi kaam nahi.',
        when: ['Pod ko ConfigMaps / Pods / Leases padhne-likhne hain', 'Operators aur controllers'],
        avoid: ['Pod ko AWS chahiye → Pod Identity / IRSA', 'Pod ko Kubernetes API chahiye hi nahi → token mount hi mat karo'],
        gotchas: [
          'Har app ka apna ServiceAccount. <code>default</code> ServiceAccount ko ijaazat mat do — namespace ka har pod wahi use karta hai.',
          'Pod ko API nahi chahiye toh <code>automountServiceAccountToken: false</code>.',
          'Ijaazat jaanchne ka command: <code>kubectl auth can-i … --as=system:serviceaccount:…</code>',
        ],
        yaml: `kubectl -n payments create role cm-reader \\
  --verb=get,list --resource=configmaps
kubectl -n payments create rolebinding notify-cm-reader \\
  --role=cm-reader --serviceaccount=payments:notify-sa
kubectl -n payments auth can-i list configmaps \\
  --as=system:serviceaccount:payments:notify-sa`,
        example: 'notify ko namespace payments ke ConfigMaps padhne the → ek Role + RoleBinding. Secrets phir bhi band.', level: 'sec-sa', lab: '08-rbac',
      },
      access: {
        leaf: true, pick: 'EKS access entry (IAM → cluster)', icon: '🚪',
        one: 'Ek IAM role ko cluster ke andar aane do, aur batao kitna (view, edit, admin) aur kis namespace mein.',
        why: 'Insaan AWS ki IAM se aata hai. Access entry IAM ki pehchaan ko cluster ki ijaazat se jodti hai.',
        when: ['Developers, SRE, CI pipeline ko kubectl chahiye', 'Naye clusters (aws-auth ConfigMap ki jagah)'],
        avoid: ['Pod ko ijaazat deni hai → access entry insaanon aur IAM roles ke liye hai, pods ke liye nahi'],
        gotchas: [
          'Purana tareeka <code>aws-auth</code> ConfigMap hai. Us ConfigMap mein ek galat indentation se sab log cluster se bahar ho sakte hain.',
          'IAM user ki jagah IAM role (SSO se) jodo. Insaan company chhode toh ijaazat khud chali jaati hai.',
          'Access entry sirf AWS ke bane-banaye star deti hai (view, edit, admin). Bareek ijaazat ke liye access entry mein Kubernetes group likho aur us group ko RBAC se baandho.',
        ],
        yaml: `aws eks create-access-entry --cluster-name chaipay-prod \\
  --principal-arn arn:aws:iam::111122223333:role/payments-dev
aws eks associate-access-policy --cluster-name chaipay-prod \\
  --principal-arn arn:aws:iam::111122223333:role/payments-dev \\
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSViewPolicy \\
  --access-scope type=namespace,namespaces=payments`,
        example: 'Naye developer ka IAM role payments-dev: namespace payments mein sirf dekhne ki ijaazat.', level: 'eks-identity',
      },
    },
    compare: {
      cols: ['', 'Pod Identity', 'IRSA', 'Node role', 'RBAC', 'Access entry'],
      rows: [
        ['Kaun', 'Pod', 'Pod', 'Node', 'Pod (ya insaan)', 'Insaan / CI'],
        ['Kis se baat', 'AWS', 'AWS', 'AWS', 'Kubernetes API', 'Kubernetes API'],
        ['Kahan likha hota hai', 'EKS association', 'ServiceAccount annotation + IAM trust', 'Node group', 'Role + RoleBinding', 'EKS access entry'],
      ],
    },
    scenarios: [
      { s: 'notify pod (EKS, Linux EC2 nodes) ko SQS queue notify-queue padhni hai.', answer: 'podid', explain: 'Pod → AWS, EC2 nodes par → EKS Pod Identity ka association.' },
      { s: 'fraud-check EKS Fargate par chalta hai aur use ek S3 bucket padhni hai.', answer: 'irsa', explain: 'Fargate par Pod Identity ka agent nahi chalta → IRSA.' },
      { s: 'Naya developer kubectl se namespace payments ke pods dekhna chahta hai.', answer: 'access', explain: 'Insaan → cluster. IAM role ko access entry se view ki ijaazat do.' },
      { s: 'notify pod ko namespace payments ke ConfigMaps padhne hain.', answer: 'sarbac', explain: 'ConfigMap Kubernetes API ki cheez hai, AWS ki nahi → ServiceAccount + Role + RoleBinding.' },
      { s: 'Naye node ko cluster se judna hai aur ECR se images kheenchni hain.', answer: 'noderole', explain: 'Yeh node ke apne kaam hain → node IAM role.' },
      { s: 'pay-api (Linux EC2 nodes) ko DynamoDB table chahiye. Wahi IAM role kal ek doosre cluster mein bhi use hoga, bina trust policy badle.', answer: 'podid', explain: 'Pod Identity ka trust cluster se bandha nahi hota (pods.eks.amazonaws.com). IRSA mein har cluster ka OIDC URL trust policy mein likhna padta.' },
    ],
  },

  /* ================= 22. TLS CERTIFICATE (Networking & EKS) ================= */
  {
    id: 'tlscert', icon: '🔏',
    title: 'HTTPS certificate — HTTP-01, DNS-01, ACM, ya apna CA?',
    short: 'Certificate kahan se?',
    tldr: 'Public host, port 80 khula → <b>HTTP-01</b>. Wildcard ya internal host → <b>DNS-01</b>. TLS load balancer par hi khatam → <b>ACM</b>. Cluster ke andar service-se-service → <b>apna (private) CA</b>.',
    levels: ['net-certs'], labs: [],
    start: 'who',
    nodes: {
      who: {
        q: 'Certificate par bharosa kaun karega?',
        why: 'Browser sirf public CA (jaise Let\'s Encrypt) par bharosa karta hai. Cluster ke andar ki services ko tum apna CA de sakte ho.',
        options: [
          { t: 'Internet ke users ke browser aur apps', next: 'term' },
          { t: 'Sirf cluster ke andar ki services (service-se-service)', next: 'private' },
        ],
      },
      term: {
        q: 'TLS kahan khatam hota hai? (Certificate kis ke paas rakha hai?)',
        why: 'Certificate wahin chahiye jahan HTTPS khulta hai. ALB par khule toh AWS ka ACM saada hai. Cluster ke andar khule toh cert-manager.',
        options: [
          { t: 'AWS load balancer (ALB / NLB) par', next: 'acm' },
          { t: 'Cluster ke andar — Gateway ya Ingress controller ke pod par', next: 'chal' },
        ],
      },
      chal: {
        q: 'Host kaisa hai?',
        why: 'Let\'s Encrypt ko saboot chahiye ki domain tumhara hai. HTTP-01 mein Let\'s Encrypt port 80 par ek URL kholta hai. DNS-01 mein ek TXT record dekhta hai.',
        options: [
          { t: 'Ek ya kuch public hosts, aur port 80 internet se khula hai', next: 'http01' },
          { t: 'Wildcard, ya internet se pahunch mein nahi, ya port 80 band', next: 'dns01' },
        ],
      },
      http01: {
        leaf: true, pick: 'cert-manager + HTTP-01 challenge', icon: '🌐',
        one: 'Let\'s Encrypt port 80 par ek khaas URL kholta hai. cert-manager us URL par sahi jawab rakh deta hai.',
        why: 'Host public hai aur port 80 khula hai. DNS provider ki koi ijaazat nahi deni padti.',
        when: ['Saada public API ya website', 'DNS provider ki API key nahi dena chahte'],
        avoid: ['Wildcard (*.chaipay.in) → HTTP-01 se milta hi nahi', 'Host internet se pahunch mein nahi → DNS-01'],
        gotchas: [
          'DNS record pehle se load balancer ki taraf ho. DNS galat → challenge kabhi poora nahi hota aur Certificate "Ready: False" par atka rehta hai.',
          'Let\'s Encrypt ki rate limit hai. Pehle staging server par aazmao, phir production.',
          'Atka hua Certificate? Kram se dekho: Certificate → CertificateRequest → Order → Challenge.',
        ],
        yaml: `apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata: { name: letsencrypt-prod }
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: platform@chaipay.in
    privateKeySecretRef: { name: letsencrypt-prod-key }
    solvers:
      - http01:
          gatewayHTTPRoute:
            parentRefs: [{ name: public-gw, namespace: infra }]`,
        example: 'pay.chaipay.in: public host, port 80 khula → HTTP-01. Certificate 90 din ka, cert-manager 60 din par khud badal deta hai.', level: 'net-certs',
      },
      dns01: {
        leaf: true, pick: 'cert-manager + DNS-01 challenge', icon: '📇',
        one: 'cert-manager DNS mein ek TXT record likhta hai. Let\'s Encrypt us record ko dekh kar maan jaata hai.',
        why: 'Let\'s Encrypt ko host tak pahunchne ki zaroorat nahi — sirf public DNS dekhna hai.',
        when: ['Wildcard: *.chaipay.in', 'Internal dashboard jo VPN ke peeche hai', 'Port 80 security niyam se band hai'],
        avoid: ['Saada public host aur DNS ki ijaazat nahi deni → HTTP-01'],
        gotchas: [
          'cert-manager ko Route 53 mein record likhne ki ijaazat chahiye. Ijaazat Pod Identity / IRSA se do, access key se nahi.',
          'IAM policy ko sirf us ek hosted zone tak chhota rakho. Poore DNS ki ijaazat = koi bhi record badla ja sakta hai.',
          'TXT record ke phailne mein samay lagta hai. DNS-01 ka challenge 1–2 minute le sakta hai — yeh normal hai.',
        ],
        yaml: `    solvers:
      - dns01:
          route53: { region: ap-south-1 }
        selector:
          dnsZones: ["chaipay.in"]`,
        example: '*.chaipay.in ka wildcard certificate: ek certificate, saare subdomains.', level: 'net-certs',
      },
      acm: {
        leaf: true, pick: 'ACM certificate (load balancer par)', icon: '☁️',
        one: 'Certificate AWS ke ACM mein rehta hai. ALB HTTPS kholta hai. ACM certificate ko khud badalta rehta hai.',
        why: 'TLS ALB par hi khatam hota hai. Cluster ke andar certificate rakhne ki zaroorat nahi.',
        when: ['ALB (AWS Load Balancer Controller) ke peeche ki services', 'Certificate ki private key cluster mein nahi rakhni'],
        avoid: ['TLS pod par khatam hona chahiye (end-to-end) → cert-manager'],
        gotchas: [
          'ALB ke baad pod tak traffic default mein saada HTTP hota hai. Pod tak bhi TLS chahiye toh alag se karna padta hai.',
          'ACM certificate usi region mein ho jis region mein ALB hai.',
          'ACM certificate ko tabhi khud badal paata hai jab DNS validation wala CNAME record maujood rahe. Record hataya → renewal fail.',
        ],
        yaml: `metadata:
  annotations:
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-south-1:111122223333:certificate/abcd-1234
spec:
  ingressClassName: alb`,
        example: 'pay.chaipay.in ke aage ALB hai. Certificate ACM mein — cluster mein koi Secret nahi.', level: 'eks-alb',
      },
      private: {
        leaf: true, pick: 'Private CA (cert-manager CA issuer)', icon: '🏛️',
        one: 'Apna CA banao. cert-manager us CA se cluster ke andar ke naamon ke liye certificate deta hai.',
        why: 'Let\'s Encrypt <code>.svc.cluster.local</code> jaise internal naam ke liye certificate nahi deta.',
        when: ['Service-se-service TLS / mTLS', 'Webhook servers ke certificate'],
        avoid: ['Browser ke saamne wala public host → browser tumhare CA ko nahi jaanta'],
        gotchas: [
          'Har client ko CA ka certificate dena padta hai, warna client bharosa nahi karega.',
          'Service mesh (Istio, Linkerd) laga hai toh mesh mTLS ke certificate khud baant-ta aur badalta hai. Tab haath se Certificate banane ki zaroorat nahi.',
          'Certificate badalne par app ko nayi file dobara padhni chahiye. Kai apps sirf shuru hote samay padhte hain.',
        ],
        yaml: `apiVersion: cert-manager.io/v1
kind: Certificate
metadata: { name: ledger-tls, namespace: payments }
spec:
  secretName: ledger-tls
  dnsNames: ["ledger-svc.payments.svc.cluster.local"]
  duration: 24h
  renewBefore: 8h
  issuerRef: { name: chaipay-internal-ca, kind: ClusterIssuer }`,
        example: 'pay-api aur ledger ke beech mTLS: dono ke certificate ChaiPay ke internal CA se, har 24 ghante naye.', level: 'net-certs',
      },
    },
    scenarios: [
      { s: 'Public API api.chaipay.in. TLS Gateway ke pod par khatam hota hai, port 80 khula hai, aur DNS provider ki koi ijaazat nahi deni.', answer: 'http01', explain: 'Ek public host + port 80 khula + DNS ki ijaazat nahi → HTTP-01.' },
      { s: 'Wildcard certificate *.chaipay.in chahiye. TLS Gateway ke pod par khatam hota hai.', answer: 'dns01', explain: 'Wildcard sirf DNS-01 se milta hai.' },
      { s: 'Internal dashboard grafana.internal.chaipay.in VPN ke peeche hai. Browser mein bina chetavni ke khulna chahiye.', answer: 'dns01', explain: 'Browser ko public CA chahiye, par Let\'s Encrypt host tak pahunch nahi sakta → DNS-01.' },
      { s: 'pay-api ke aage ALB hai aur HTTPS ALB par hi khatam hota hai.', answer: 'acm', explain: 'TLS ALB par → ACM certificate, jise ACM khud badalta hai.' },
      { s: 'pay-api aur ledger ke beech cluster ke andar mTLS chahiye. Naam: ledger-svc.payments.svc.cluster.local.', answer: 'private', explain: 'Internal naam ke liye public CA certificate nahi deta → apna CA.' },
      { s: 'Host public hai aur TLS Ingress controller ke pod par khatam hota hai. Par security niyam se load balancer par port 80 band hai.', answer: 'dns01', explain: 'HTTP-01 port 80 par hi jaanch karta hai. Port band → DNS-01.' },
    ],
  },

  /* ================= 23. EKS IP (Networking & EKS) ================= */
  {
    id: 'eksip', icon: '🏘️',
    title: 'EKS mein IP ya pod ki ginti kam pad rahi hai — prefix delegation, naya CIDR, warm IP, ya IPv6?',
    short: 'IP khatam, ab kya?',
    tldr: 'Node par pods ki ginti kam → <b>prefix delegation</b>. Subnet ke IP sach mein khatam → <b>naya CIDR + custom networking</b>. Nodes IP jama kar rahe hain → <b>WARM_IP_TARGET</b>. Naya cluster aur IPv4 ki jagah hi nahi → <b>IPv6</b>.',
    levels: ['eks-vpccni'], labs: [],
    start: 'sym',
    nodes: {
      sym: {
        q: 'Kya kam pad raha hai?',
        why: 'Do alag seemayein hain: (1) <b>ek node</b> par kitne pods, (2) <b>subnet</b> mein kitne IP. Dono ke ilaaj alag hain.',
        options: [
          { t: 'Node par CPU aur memory khaali hai, par scheduler kehta hai "Too many pods"', next: 'prefix' },
          { t: 'Pod ContainerCreating mein atka: "failed to assign an IP address"', next: 'why' },
          { t: 'Naya cluster ban raha hai aur VPC mein IPv4 ki jagah pehle se tang hai', next: 'ipv6' },
        ],
      },
      why: {
        q: 'Subnet ke IP kahan gaye?',
        why: 'VPC CNI har node par kuch IP pehle se pakad kar rakhta hai ("garam" IP), taaki naya pod tez shuru ho. Kai baar subnet pods se nahi, is jamakhori se bharta hai.',
        options: [
          { t: 'Pods kam hain, par nodes ne bahut saare IP pakad rakhe hain', next: 'warm' },
          { t: 'Pods sach mein subnet ke IP se zyada hain', next: 'cidr' },
        ],
      },
      prefix: {
        leaf: true, pick: 'Prefix delegation (slot par 16 IP)', icon: '🧮',
        one: 'Node ke har ENI slot par 1 IP ki jagah 16 IP ka guchha (/28). Ek node par 110 pods tak.',
        why: 'Seema node ki hai (ENI × IP), subnet ki nahi.',
        when: ['Chhote instance type par zyada pods chahiye', '"Too many pods" jabki CPU / memory khaali hai'],
        avoid: ['Subnet ke IP khatam hain → prefix delegation naye IP <b>nahi banata</b>'],
        gotchas: [
          'Subnet mein lagataar 16 IP ka khaali guchha chahiye. Bikhre hue (fragmented) subnet mein guchha nahi milta, chahe kul IP bache hon.',
          'Purane nodes ki "max pods" ginti nahi badalti. Nodes ko naye node group se badalna padta hai.',
          'Sirf Nitro instance types par chalta hai.',
        ],
        yaml: `kubectl -n kube-system set env daemonset aws-node \\
  ENABLE_PREFIX_DELEGATION=true WARM_PREFIX_TARGET=1`,
        example: 'm5.large par 29 pods ki seema thi. Prefix delegation ke baad 110 pods tak.', level: 'eks-vpccni',
      },
      cidr: {
        leaf: true, pick: 'Naya VPC CIDR + custom networking', icon: '🗺️',
        one: 'VPC mein doosra CIDR jodo (jaise 100.64.0.0/16). Pods ko us naye range ke subnets se IP do.',
        why: 'Subnet ke IP sach mein khatam hain. Sirf naye IP hi ilaaj hain.',
        when: ['/24 jaise chhote subnets mein bada cluster', 'Company ke VPC mein naya 10.x range nahi mil sakta'],
        avoid: ['Seema node ki hai, subnet ki nahi → prefix delegation'],
        gotchas: [
          'Har availability zone ke liye ek <code>ENIConfig</code> object banana padta hai.',
          'Custom networking mein node ka pehla ENI pods ke kaam nahi aata → har node par pods ki ginti ghat-ti hai. Saath mein prefix delegation lagao.',
          'Purane nodes ko badalna padta hai — setting sirf naye nodes par lagti hai.',
        ],
        yaml: `kubectl -n kube-system set env daemonset aws-node \\
  AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG=true \\
  ENI_CONFIG_LABEL_DEF=topology.kubernetes.io/zone
---
apiVersion: crd.k8s.amazonaws.com/v1alpha1
kind: ENIConfig
metadata: { name: ap-south-1a }
spec:
  subnet: subnet-0aaa111pods1a
  securityGroups: ["sg-0bbb222pods"]`,
        example: 'ChaiPay ke /24 subnets bhar gaye. 100.64.0.0/16 joda → pods ke liye 65,000 naye IP.', level: 'eks-vpccni',
      },
      warm: {
        leaf: true, pick: 'WARM_IP_TARGET (jamakhori kam karo)', icon: '🧊',
        one: 'Har node ko batao: sirf itne IP pehle se pakad kar rakho.',
        why: 'IP pods ne nahi, nodes ki jamakhori ne khaye hain.',
        when: ['Bahut saare nodes, har node par kam pods', 'Subnet chhota hai aur abhi badal nahi sakte'],
        avoid: ['Pods sach mein IP se zyada hain → jamakhori ghatane se naye IP nahi bante'],
        gotchas: [
          'Default <code>WARM_ENI_TARGET=1</code> hai: har node ek poora khaali ENI garam rakhta hai (m5.large par 10 IP).',
          '<code>WARM_IP_TARGET</code> bahut kam rakhoge toh har naye pod par AWS ki API call hogi. Pod dheere shuru hoga aur API throttle ho sakti hai.',
          '<code>MINIMUM_IP_TARGET</code> saath mein rakho: node shuru hote hi itne IP ek saath le le.',
        ],
        yaml: `kubectl -n kube-system set env daemonset aws-node \\
  WARM_IP_TARGET=2 MINIMUM_IP_TARGET=10`,
        example: '18 nodes × 10 garam IP = 180 IP sirf intezaar mein ghire the. WARM_IP_TARGET=2 ke baad 36.', level: 'eks-vpccni',
      },
      ipv6: {
        leaf: true, pick: 'IPv6 cluster (pods ko IPv6 address)', icon: '🌌',
        one: 'Har pod ko IPv6 address. IPv6 ke address itne hain ki ginti ki chinta khatam.',
        why: 'IPv4 ki jagah hi nahi hai, aur cluster abhi ban raha hai — IP family badalne ka yahi ek mauka hai.',
        when: ['Naya cluster, bahut bada scale', 'Company mein IPv4 ranges ki bhaari kami'],
        avoid: ['Chalta hua IPv4 cluster → IP family baad mein badli nahi ja sakti'],
        gotchas: [
          'IP family cluster <b>banate samay</b> tay hoti hai. Baad mein IPv4 cluster ko IPv6 nahi bana sakte.',
          'Pods IPv4 wali purani services se baat kar sakte hain (node par NAT hota hai), par har tool aur add-on IPv6 samajhta ho — pehle test karo.',
          'Security groups, NetworkPolicy aur firewall ke niyam IPv6 ke liye dobara likhne padte hain.',
        ],
        yaml: `aws eks create-cluster --name chaipay-v6 \\
  --kubernetes-network-config ipFamily=ipv6 \\
  --role-arn arn:aws:iam::111122223333:role/eks-cluster-role \\
  --resources-vpc-config subnetIds=subnet-0aaa,subnet-0bbb`,
        example: 'Naya cluster, 5,000 pods ka plan, VPC mein IPv4 ka koi bada range khaali nahi → IPv6 cluster.', level: 'eks-vpccni',
      },
    },
    compare: {
      cols: ['', 'Prefix delegation', 'Naya CIDR', 'WARM_IP_TARGET', 'IPv6'],
      rows: [
        ['Kis seema ka ilaaj', 'Ek node par pods', 'Subnet ke kul IP', 'Nodes ki jamakhori', 'IPv4 ki kul kami'],
        ['Naye IP banata hai?', 'Nahi', 'Haan', 'Nahi', 'Haan (IPv6)'],
        ['Chalte cluster par?', 'Haan (naye nodes)', 'Haan (naye nodes)', 'Haan', 'Nahi — sirf naya cluster'],
      ],
    },
    scenarios: [
      { s: 'm5.large node par CPU aur memory khaali hai. Par 29 pods ke baad naya pod Pending hai: "Too many pods".', answer: 'prefix', explain: 'Seema node ki hai (ENI × IP) → prefix delegation.' },
      { s: 'Subnet /24 hai. 251 mein se 248 IP pods ke paas hain, aur 300 pods aur chahiye.', answer: 'cidr', explain: 'Pods sach mein IP se zyada hain → naya CIDR + custom networking.' },
      { s: '18 nodes par sirf 60 pods hain. Phir bhi subnet ke 251 mein se 240 IP ja chuke hain.', answer: 'warm', explain: 'IP nodes ki jamakhori mein gaye → WARM_IP_TARGET.' },
      { s: 'Naya cluster ban raha hai. Company ke VPC mein IPv4 ka koi bada khaali range bacha hi nahi.', answer: 'ipv6', explain: 'Cluster abhi ban raha hai — IP family chunne ka yahi mauka hai → IPv6.' },
      { s: 'Prefix delegation pehle se chalu hai. Subnet mein sirf 4 IP bache hain aur naye pods "failed to assign an IP address" de rahe hain.', answer: 'cidr', explain: 'Prefix delegation naye IP nahi banata. Subnet khatam → naya CIDR.' },
    ],
  },
]);
