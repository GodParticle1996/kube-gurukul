/* =====================================================================
   KubeGurukul — 🧭 Decision Dojo content ("Kab kya use karein?")
   Engine: decisions.js. Har tree: sawal → jawab → … → recommendation.
   Naya tree jodna ho? Bas KG.registerDecisions([...]) — validate.js
   structure check karta hai (cycles, unreachable leaves, scenario answers).
   ===================================================================== */

KG.registerDecisions([

  /* ================= 1. WORKLOAD ================= */
  {
    id: 'workload', icon: '🏗️',
    title: 'Workload chuno — Deployment, StatefulSet, DaemonSet, Job ya CronJob?',
    short: 'Kaunsa controller?',
    tldr: 'Do sawal kaafi hain: kaam <b>khatam</b> hota hai ya <b>hamesha</b> chalta hai? Aur har replica ki <b>apni pehchaan + apni disk</b> chahiye ya koi bhi replica chalega?',
    levels: ['deploy', 'workloads'], labs: ['12-statefulset', '13-jobs-cronjobs'],
    start: 'finish',
    nodes: {
      finish: {
        q: 'Kya kaam ek baar chal ke <b>khatam</b> ho jaata hai? (migration, backup, report, batch)',
        why: 'Job/CronJob "complete" hone ke liye bane hain. Deployment process ko hamesha zinda rakhta hai — khatam hua process usse crash lagta hai (CrashLoopBackOff, Reason: Completed).',
        options: [{ t: 'Haan — khatam hota hai', next: 'schedule' }, { t: 'Nahi — lagataar chalta hai (server, worker, agent)', next: 'pernode' }],
      },
      schedule: {
        q: 'Kya yeh <b>schedule</b> par baar-baar chalna hai?',
        why: 'CronJob sirf Job banane wali factory hai — schedule ho toh CronJob, warna seedha Job.',
        options: [{ t: 'Haan — har raat / har ghante', next: 'cronjob' }, { t: 'Nahi — ek baar ya on-demand (CI, release)', next: 'job' }],
      },
      pernode: {
        q: 'Kya <b>har node par ek copy</b> chahiye? (log shipper, metrics agent, CNI, storage plugin)',
        why: 'Node badhe toh copy apne-aap badhe — yeh replica count se nahi, DaemonSet se sambhalta hai.',
        options: [{ t: 'Haan — har node par ek', next: 'daemonset' }, { t: 'Nahi — replicas ki ginti se', next: 'identity' }],
      },
      identity: {
        q: 'Kya har replica ki <b>apni pehchaan</b> (stable naam/order) aur <b>apni disk</b> chahiye? (DB, Kafka, ZooKeeper)',
        why: 'Stable naam + har pod ki apni PVC = StatefulSet ka vaada. Stateless apps ke liye yeh sirf bojh hai.',
        options: [{ t: 'Haan — db-0 hamesha db-0, apne data ke saath', next: 'statefulset' }, { t: 'Nahi — koi bhi replica kaam kar le', next: 'deployment' }],
      },
      deployment: {
        leaf: true, pick: 'Deployment (stateless)', icon: '🚀',
        one: 'Stateless replicas + rolling updates + self-healing. Zyada-tar apps ka ghar.',
        why: 'Kaam lagataar chalta hai, har node par nahi chahiye, aur koi bhi replica kisi ki bhi jagah le sakta hai.',
        when: ['Web/API servers, frontends', 'Queue workers (state DB/queue mein, pod mein nahi)', 'Jahan pod ka naam/IP matter nahi karta'],
        avoid: ['Har replica ki apni disk → <b>StatefulSet</b>', 'Kaam khatam hota hai → <b>Job</b> (warna "Completed" CrashLoop)'],
        gotchas: ['RWO PVC ke Pods alag nodes par chalein → <code>Multi-Attach error</code>; same node par kai Pods mount kar sakte hain, app ko concurrent writes safe rakhni hongi', 'HPA lagaya hai toh manifest se <code>replicas</code> hatao — warna GitOps har sync par wapas set karega'],
        yaml: `apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 3
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      containers:
        - name: web
          image: nginx:1.27-alpine`,
        example: 'Checkout API — HPA 3–20 replicas, RollingUpdate maxUnavailable 0.', level: 'deploy',
      },
      statefulset: {
        leaf: true, pick: 'StatefulSet (stable IDs)', icon: '🗄️',
        one: 'Stable naam (db-0, db-1) + har pod ki apni PVC + order mein start/stop.',
        why: 'Har replica alag hai — uski pehchaan aur data dono pod ke marne ke baad bhi wahi rehne chahiye.',
        when: ['Databases (Postgres/MySQL replicas), Kafka, ZooKeeper, etcd, Elasticsearch', 'Peers jo ek doosre ko naam se dhoondhte hain (headless Service)'],
        avoid: ['Managed DB (RDS/Cloud SQL) mil sakta hai → aksar wahi behtar (backup/failover unka sar-dard)', 'Bas "ek PVC chahiye" wala single pod → Deployment (replicas 1, strategy Recreate) bhi chalega'],
        gotchas: ['<code>serviceName</code> wali <b>headless</b> Service (clusterIP: None) khud banani padti hai — warna per-pod DNS nahi', 'Scale down par PVC delete <b>nahi</b> hoti (data safety) — kooda jama hota hai', 'Default <code>OrderedReady</code> — ek pod atka toh baaki ruke; order zaroori na ho toh <code>podManagementPolicy: Parallel</code>'],
        yaml: `apiVersion: apps/v1
kind: StatefulSet
metadata: { name: db }
spec:
  serviceName: db-headless      # clusterIP: None wali Service
  replicas: 3
  selector: { matchLabels: { app: db } }
  template:
    metadata: { labels: { app: db } }
    spec:
      containers:
        - name: db
          image: postgres:16
          volumeMounts: [{ name: data, mountPath: /var/lib/postgresql/data }]
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: ["ReadWriteOnce"]
        resources: { requests: { storage: 20Gi } }`,
        example: 'Kafka ke 3 brokers — broker-0/1/2 apne logs ke saath, headless Service se ek doosre ko dhoondhte hain.', level: 'workloads', lab: '12-statefulset',
      },
      daemonset: {
        leaf: true, pick: 'DaemonSet (per node)', icon: '🛰️',
        one: 'Har (matching) node par ek pod — node aaya, pod aaya; node gaya, pod gaya.',
        why: 'Kaam node se juda hai (node ke logs, metrics, network, disk) — har node par ek copy chahiye.',
        when: ['Log shippers (Fluent Bit), node exporters, security agents', 'CNI / CSI node plugins, kube-proxy'],
        avoid: ['"Bas har node par ek replica achha lagega" (HA ke liye) → Deployment + <b>topologySpreadConstraints</b>'],
        gotchas: ['Tainted nodes (GPU, control-plane) par chalana hai toh <b>tolerations</b> chahiye', 'Har node par requests reserve hote hain — chhote DaemonSet bhi 100 nodes par bada kharcha', 'Sirf kuch nodes par: <code>nodeSelector</code> lagao'],
        yaml: `apiVersion: apps/v1
kind: DaemonSet
metadata: { name: log-agent }
spec:
  selector: { matchLabels: { app: log-agent } }
  template:
    metadata: { labels: { app: log-agent } }
    spec:
      tolerations: [{ operator: Exists }]   # har node, tainted bhi
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:3.1
          volumeMounts: [{ name: varlog, mountPath: /var/log, readOnly: true }]
      volumes: [{ name: varlog, hostPath: { path: /var/log } }]`,
        example: 'Fluent Bit har node ke /var/log padh ke logs Loki/Elasticsearch bhejta hai.', level: 'workloads',
      },
      job: {
        leaf: true, pick: 'Job (one-off execution)', icon: '✅',
        one: 'Ek baar safal ho ke khatam — retries (backoffLimit) aur time-limit ke saath.',
        why: 'Kaam ka ant hai, aur schedule nahi chahiye — bas "ek baar, theek se".',
        when: ['DB migrations (release se pehle)', 'One-off data fixes, batch processing', 'parallelism/completions se kai tukdon mein kaam'],
        avoid: ['Lagataar queue se kaam → Deployment (+KEDA)', 'Schedule par → CronJob'],
        gotchas: ['Fail hua Job <b>khud dobara nahi chalta</b>; template immutable — delete karke dobara banao', '<code>restartPolicy: Always</code> allowed nahi (Never/OnFailure)', '<code>ttlSecondsAfterFinished</code> do — warna purane Jobs/pods ka dher'],
        yaml: `apiVersion: batch/v1
kind: Job
metadata: { name: db-migrate }
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 600
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: myapp:1.4.2
          command: ["./migrate", "up"]`,
        example: 'Release pipeline: migration Job → <code>kubectl wait --for=condition=Complete</code> → tab app deploy.', level: 'workloads', lab: '13-jobs-cronjobs',
      },
      cronjob: {
        leaf: true, pick: 'CronJob (scheduled runs)', icon: '⏰',
        one: 'Schedule par Job banane wali factory.',
        why: 'Kaam khatam hota hai aur baar-baar, tay waqt par chahiye.',
        when: ['Backups, reports, cleanup, certificate/DB maintenance', 'Periodic sync jahan thoda delay chalta hai'],
        avoid: ['Har kuch second mein chalna → long-running Deployment loop behtar', 'Exactly-once guarantee chahiye → CronJob kabhi-kabhi miss/double kar sakta hai — job ko idempotent banao'],
        gotchas: ['Default <code>concurrencyPolicy: Allow</code> → lamba job = <b>overlap</b>. Backups ke liye <code>Forbid</code>', 'Timezone: <code>timeZone: Asia/Kolkata</code> — warna controller ka (aksar UTC)', '<code>activeDeadlineSeconds</code> nahi toh atka run Forbid ke saath aage ke saare runs rok dega'],
        yaml: `apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly-backup }
spec:
  schedule: "0 2 * * *"
  timeZone: Asia/Kolkata
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: backup
              image: backup-tool:2.1`,
        example: 'Raat 2 baje (IST) DB backup S3 par — Forbid ki wajah se kabhi do backup ek saath nahi.', level: 'workloads', lab: '13-jobs-cronjobs',
      },
    },
    compare: {
      cols: ['', 'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'],
      rows: [
        ['Kaam', 'Hamesha chale', 'Hamesha chale', 'Har node par chale', 'Ek baar, khatam', 'Schedule par, khatam'],
        ['Pod naam', 'web-7d9f-x2 (random)', 'db-0, db-1 (stable)', 'har node par ek', 'migrate-abc12', 'backup-2987… (har run)'],
        ['Disk', 'Shared / koi nahi', 'Apni PVC per pod', 'Aksar node ki (hostPath)', 'Temp', 'Temp'],
        ['Scale', 'replicas / HPA', 'replicas (order mein)', 'Nodes ke saath', 'parallelism', 'Har run ek Job'],
        ['Update', 'RollingUpdate', 'Ordered rolling', 'Node-by-node', 'Immutable (recreate)', 'Agla run naya'],
      ],
    },
    scenarios: [
      { s: 'Fluent Bit ko har node ke /var/log padh ke logs bhejne hain.', answer: 'daemonset', explain: 'Har node par ek copy + node ki files → DaemonSet. Naya node aaya, agent apne-aap aaya.' },
      { s: 'PostgreSQL primary + 2 replicas, har instance ka apna data, ek doosre ko naam se jaante hain.', answer: 'statefulset', explain: 'Stable naam (pg-0 = primary) + per-pod PVC + headless Service. (Managed RDS ho sake toh aur bhi behtar.)' },
      { s: 'Release se pehle DB schema migration ek baar chalani hai.', answer: 'job', explain: 'Ek baar safal ho ke khatam. CI mein <code>kubectl wait --for=condition=Complete</code> se deploy gate karo.' },
      { s: 'Har raat 2 baje (IST) billing report email karni hai.', answer: 'cronjob', explain: 'Schedule + khatam hone wala kaam. <code>timeZone: Asia/Kolkata</code> aur <code>concurrencyPolicy: Forbid</code> yaad rakhna.' },
      { s: 'Payments REST API, 5 replicas, saara state Postgres mein.', answer: 'deployment', explain: 'Pod khud stateless hai — koi bhi replica koi bhi request le sakta hai.' },
      { s: 'SQS queue se lagataar messages uthane wale workers.', answer: 'deployment', explain: 'Lagataar chalne wala stateless worker → Deployment (queue length par scale ke liye KEDA).' },
      { s: 'Har node par Prometheus node-exporter (CPU/disk metrics).', answer: 'daemonset', explain: 'Metrics node ki hain — har node par ek exporter.' },
    ],
  },

  /* ================= 2. EXPOSE ================= */
  {
    id: 'expose', icon: '🚪',
    title: 'Service ko kaise expose karein — ClusterIP, Headless, NodePort, LoadBalancer, Ingress ya Gateway API?',
    short: 'Traffic andar kaise aaye?',
    tldr: 'Pehle poochho <b>kaun bulayega</b> (cluster ke andar se, bahar se, ya sirf tum debug ke liye). Bahar se HTTP hai toh L7 router (Gateway API/Ingress); baaki protocols ke liye LoadBalancer.',
    levels: ['service', 'ingress'], labs: ['04-service-dns'],
    start: 'who',
    nodes: {
      who: {
        q: 'Is service ko <b>kaun</b> bulayega?',
        why: 'Andar ke callers ko sirf stable naam chahiye (ClusterIP free hai). Bahar ke callers ke liye cluster mein darwaza banana padta hai — jiska kharcha aur security dono hain.',
        options: [
          { t: 'Cluster ke andar ke doosre pods', next: 'inside' },
          { t: 'Bahar se — users / internet / doosre systems', next: 'http' },
          { t: 'Sirf main, apne laptop se debug ke liye', next: 'portforward' },
          { t: 'Cluster ke BAHAR ki service (jaise RDS) ko andar ek naam dena hai', next: 'externalname' },
        ],
      },
      inside: {
        q: 'Callers ko <b>koi bhi replica</b> chalega, ya <b>har pod ko naam se</b> (db-0, db-1) bulana hai?',
        why: 'Normal Service ek virtual IP par load-balance karti hai. Headless (clusterIP: None) DNS mein seedha har pod deta hai — StatefulSet peers ke liye.',
        options: [{ t: 'Koi bhi replica (load-balanced)', next: 'clusterip' }, { t: 'Har pod alag naam se (leader/replica, peers)', next: 'headless' }],
      },
      http: {
        q: 'Traffic <b>HTTP/HTTPS (ya gRPC)</b> hai — host/path ke hisaab se routing, TLS?',
        why: 'HTTP ko ek hi L7 load balancer kai services mein baant sakta hai (host/path) — har service ka alag cloud LB lene se sasta aur saaf. Non-HTTP (TCP/UDP) ko L4 LB chahiye.',
        options: [{ t: 'Haan — HTTP/HTTPS/gRPC', next: 'l7' }, { t: 'Nahi — raw TCP/UDP (DB, MQTT, game server, SMTP)', next: 'l4' }],
      },
      l7: {
        q: 'Naya setup hai, ya advanced routing (header/weight-based split, kai teams apne routes khud sambhaalein) chahiye?',
        why: 'Ingress API <b>frozen</b> hai (hatayi nahi jaayegi, par naye features nahi). Gateway API uska successor hai — role-oriented aur portable. Purana chalta hua Ingress turant todne ki zaroorat nahi.',
        options: [{ t: 'Haan — naya setup / advanced routing', next: 'gateway' }, { t: 'Purana stable Ingress setup chal raha hai, simple host/path', next: 'ingress' }],
      },
      l4: {
        q: 'Cloud par ho (EKS/GKE/AKS) jahan Service type LoadBalancer apne-aap LB banata hai?',
        why: 'Cloud mein LoadBalancer Service ek asli L4 LB deta hai. Bare-metal/kind par yeh tabhi chalta hai jab MetalLB jaisa kuch ho — warna NodePort.',
        options: [{ t: 'Haan — cloud', next: 'loadbalancer' }, { t: 'Nahi — on-prem / bare-metal / kind (bina MetalLB)', next: 'nodeport' }],
      },
      clusterip: {
        leaf: true, pick: 'ClusterIP (internal Service)', icon: '🏠',
        one: 'Andar ka stable naam + virtual IP; pods mein load-balanced.',
        why: 'Callers cluster ke andar hain aur koi bhi replica chalega.',
        when: ['Microservice → microservice calls', 'Har cheez jo bahar expose nahi karni (DB, cache, internal APIs)'],
        avoid: ['Per-pod naam chahiye → Headless', 'Bahar se traffic → Gateway/Ingress/LoadBalancer'],
        gotchas: ['Doosre namespace se: <code>svc.namespace</code> (chhota naam sirf apne namespace mein)', '<code>targetPort</code> = container port; named port (<code>http</code>) use karo', 'Endpoints khaali = selector galat ya pods ready nahi'],
        yaml: `apiVersion: v1
kind: Service
metadata: { name: payments }
spec:
  selector: { app: payments }
  ports:
    - port: 80
      targetPort: http      # container ka named port`,
        example: 'checkout → <code>http://payments.payments-ns</code>', level: 'service', lab: '04-service-dns',
      },
      headless: {
        leaf: true, pick: 'Headless Service (Pod DNS)', icon: '🧭',
        one: 'Koi virtual IP nahi — DNS seedha pod IPs + har StatefulSet pod ka apna naam.',
        why: 'Callers ko specific pod chahiye (leader, shard, peer).',
        when: ['StatefulSet peers (db-0.db-headless)', 'Client-side load balancing (gRPC clients jo saare IPs khud chahte hain)'],
        avoid: ['Normal load-balanced calls → ClusterIP'],
        gotchas: ['StatefulSet ka <code>serviceName</code> isi Service ka naam hona chahiye', 'Sirf <b>ready</b> pods DNS mein (peer discovery ke liye <code>publishNotReadyAddresses: true</code> sochna pad sakta hai)'],
        yaml: `apiVersion: v1
kind: Service
metadata: { name: db-headless }
spec:
  clusterIP: None
  selector: { app: db }
  ports: [{ port: 5432 }]`,
        example: 'Postgres replicas primary ko <code>db-0.db-headless</code> se dhoondhte hain.', level: 'workloads', lab: '12-statefulset',
      },
      externalname: {
        leaf: true, pick: 'ExternalName (DNS alias)', icon: '🔀',
        one: 'Andar ka naam → bahar ke DNS naam ka CNAME. Koi proxy nahi.',
        why: 'Apps ko ek stable andar ka naam chahiye jabki asli endpoint bahar hai (aur badal sakta hai).',
        when: ['Managed DB/cache ka endpoint (RDS, ElastiCache) andar ke naam se', 'Migration: aaj bahar, kal cluster ke andar — app config nahi badlega'],
        avoid: ['HTTPS jahan certificate hostname match karna zaroori ho — client andar wala naam bhejega, cert bahar wale ka hai'],
        gotchas: ['Sirf DNS CNAME — ports/selector/health check kuch nahi', 'IP address ke liye kaam nahi karta (sirf DNS naam)'],
        yaml: `apiVersion: v1
kind: Service
metadata: { name: orders-db }
spec:
  type: ExternalName
  externalName: orders.abc123.ap-south-1.rds.amazonaws.com`,
        example: 'App <code>orders-db:5432</code> bulata hai; asli mein RDS hai.',
      },
      portforward: {
        leaf: true, pick: 'kubectl port-forward (debug)', icon: '🔧',
        one: 'Tumhare laptop se seedha pod/service tak tunnel — sirf debugging ke liye.',
        why: 'Sirf tumhe access chahiye, users ko nahi — kuch bhi expose karna faltu risk hai.',
        when: ['Grafana/admin UI ek baar dekhna', 'DB se debug query', 'Naya service test karna'],
        avoid: ['Kisi bhi "asli" traffic ke liye — single connection, tumhara laptop band = tunnel band'],
        gotchas: ['RBAC: <code>pods/portforward</code> permission chahiye', 'Service par karo (<code>svc/x</code>) — par andar ek hi pod chunta hai, load-balance nahi'],
        yaml: `kubectl -n monitoring port-forward svc/grafana 3000:80
# phir browser: http://localhost:3000`,
        example: 'On-call engineer raat ko Grafana kholta hai bina usse internet par expose kiye.',
      },
      gateway: {
        leaf: true, pick: 'Gateway API (HTTPRoute)', icon: '🌐',
        one: 'Ingress ka successor: platform team Gateway sambhaale, app teams apne HTTPRoutes.',
        why: 'Naya setup ya advanced routing — Gateway API portable hai (annotations ka jungle nahi) aur traffic splitting/header matching built-in hai.',
        when: ['Naye clusters ka north-south HTTP traffic', 'Canary / weighted traffic split, header-based routing', 'Multi-team: har team apna route, ek shared Gateway'],
        avoid: ['Andar-andar ka traffic → ClusterIP (Gateway faltu)', 'Raw TCP/UDP (TCPRoute/UDPRoute abhi experimental) → LoadBalancer'],
        gotchas: ['Gateway API sirf spec hai — ek <b>implementation</b> install karni padti hai (Envoy Gateway, Istio, Cilium, NGINX Gateway Fabric, cloud ka)', 'HTTPRoute ko Gateway se jodne ke liye <code>parentRefs</code> + Gateway ka <code>allowedRoutes</code> (namespace permission)'],
        yaml: `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: shop, namespace: shop }
spec:
  parentRefs: [{ name: public-gw, namespace: infra }]
  hostnames: ["shop.example.com"]
  rules:
    - matches: [{ path: { type: PathPrefix, value: /api } }]
      backendRefs:
        - { name: api-v1, port: 80, weight: 90 }
        - { name: api-v2, port: 80, weight: 10 }   # canary`,
        example: 'Ek shared Gateway; teams apne HTTPRoutes se shop.example.com/api ka 10% traffic v2 par bhejti hain.', level: 'ingress',
      },
      ingress: {
        leaf: true, pick: 'Ingress (HTTP routing)', icon: '🚪',
        one: 'Ek L7 entry point → host/path se kai services. Purana, stable, har jagah support.',
        why: 'Chalta hua setup hai aur routing simple hai — turant migrate karna zaroori nahi.',
        when: ['Maujooda clusters jahan Ingress controller pehle se hai (Traefik, HAProxy, AWS LB Controller, GKE Ingress)', 'Simple host/path + TLS'],
        avoid: ['Naya design → Gateway API', 'Advanced routing ke liye controller-specific annotations ka dher → Gateway API'],
        gotchas: ['Ingress API <b>frozen</b> hai: hatayi nahi jaayegi, par naye features nahi aayenge', 'Community <b>ingress-nginx</b> controller March 2026 mein <b>retire</b> ho chuka — ab koi security fix nahi. Us par ho toh migration plan banao', '<code>ingressClassName</code> do — warna kaunsa controller uthayega, andaaza'],
        yaml: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: shop }
spec:
  ingressClassName: traefik
  tls: [{ hosts: ["shop.example.com"], secretName: shop-tls }]
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend: { service: { name: api, port: { number: 80 } } }`,
        example: 'Purane cluster mein ek Ingress se 12 services, cert-manager se TLS.', level: 'ingress',
      },
      loadbalancer: {
        leaf: true, pick: 'LoadBalancer (external IP)', icon: '⚖️',
        one: 'Cloud se ek asli L4 load balancer — har Service ka apna.',
        why: 'Non-HTTP protocol hai, aur cloud LB de sakta hai.',
        when: ['TCP/UDP services: MQTT, game servers, SMTP, Postgres bahar ke clients ke liye', 'Gateway/Ingress controller ko khud bahar laana'],
        avoid: ['Har HTTP service ke liye alag LB — mehenga; Gateway/Ingress se ek LB share karo'],
        gotchas: ['Har LoadBalancer Service = ek cloud LB ka bill', 'Internal LB chahiye (sirf VPC)? cloud-specific annotation', 'Source IP chahiye toh <code>externalTrafficPolicy: Local</code> (par uneven load)'],
        yaml: `apiVersion: v1
kind: Service
metadata: { name: mqtt }
spec:
  type: LoadBalancer
  selector: { app: mqtt }
  ports: [{ port: 1883, targetPort: 1883 }]`,
        example: 'IoT devices MQTT (TCP 1883) par connect hote hain — NLB ke peeche.', level: 'service',
      },
      nodeport: {
        leaf: true, pick: 'NodePort (node IP:port)', icon: '🔌',
        one: 'Har node ke IP par ek port (30000–32767) khulta hai → Service.',
        why: 'Bina cloud LB ke bahar se pahunchne ka sabse seedha raasta.',
        when: ['Bare-metal/on-prem jahan apna external LB (F5/HAProxy) nodes ki taraf point karta hai', 'Local testing (kind/minikube)'],
        avoid: ['Internet par seedha users ke liye — ajeeb ports, node IPs badalte hain, koi TLS nahi', 'Cloud par → LoadBalancer'],
        gotchas: ['Port range 30000–32767 (default)', 'Node firewall/security group kholna padta hai', 'Bare-metal par "asli" LoadBalancer chahiye toh MetalLB'],
        yaml: `apiVersion: v1
kind: Service
metadata: { name: web }
spec:
  type: NodePort
  selector: { app: web }
  ports: [{ port: 80, targetPort: 8080, nodePort: 30080 }]`,
        example: 'On-prem: company ka hardware LB saare worker nodes ke :30080 par traffic bhejta hai.', level: 'service',
      },
    },
    compare: {
      cols: ['', 'ClusterIP', 'Headless', 'NodePort', 'LoadBalancer', 'Ingress', 'Gateway API'],
      rows: [
        ['Kaun pahunche', 'Andar ke pods', 'Andar (per-pod)', 'Node IP:port se', 'Internet/VPC', 'Internet (HTTP)', 'Internet (HTTP/gRPC)'],
        ['Layer', 'L4', 'DNS', 'L4', 'L4', 'L7', 'L7 (+L4 experimental)'],
        ['Kharcha', 'Free', 'Free', 'Free', 'Har Service ka LB 💸', 'Ek LB, kai services', 'Ek LB, kai services'],
        ['Kab', 'Default', 'StatefulSet peers', 'On-prem / test', 'TCP/UDP cloud', 'Purane setups', 'Naye setups ✅'],
      ],
    },
    scenarios: [
      { s: 'checkout service ko payments service bulani hai (dono same cluster mein).', answer: 'clusterip', explain: 'Andar ka traffic, koi bhi replica chalega → ClusterIP + DNS naam.' },
      { s: 'Naya cluster: shop.example.com ka /api ek service par, / doosri par, aur v2 par 10% canary.', answer: 'gateway', explain: 'HTTP + weighted split + naya setup → Gateway API HTTPRoute (weights built-in).' },
      { s: 'IoT devices ko MQTT broker (TCP 1883) se internet par judna hai, EKS par.', answer: 'loadbalancer', explain: 'Raw TCP + cloud → LoadBalancer Service (NLB). L7 routers HTTP ke liye hain.' },
      { s: 'Kafka brokers ko ek doosre ko broker-0, broker-1 naam se dhoondhna hai.', answer: 'headless', explain: 'Per-pod stable DNS → headless Service (clusterIP: None) StatefulSet ke saath.' },
      { s: 'Tumhe raat ko 5 minute ke liye Grafana dashboard dekhna hai.', answer: 'portforward', explain: 'Sirf tumhe chahiye → port-forward. Expose karna faltu attack surface.' },
      { s: 'App andar ke naam "orders-db" se RDS endpoint tak pahunche, taaki baad mein DB cluster mein laane par config na badle.', answer: 'externalname', explain: 'ExternalName = andar ka naam → bahar ka DNS (CNAME).' },
      { s: 'On-prem cluster; network team ka F5 load balancer saare nodes ke ek fixed port par traffic bhejega.', answer: 'nodeport', explain: 'Cloud LB nahi hai, apna external LB hai → NodePort (fixed nodePort).' },
      { s: 'Purana cluster: Traefik Ingress se 10 services saalon se chal rahi hain, sirf host/path routing.', answer: 'ingress', explain: 'Chalta hua simple setup → Ingress theek hai. Naye features ki zaroorat aaye tab Gateway API plan karo.' },
    ],
  },

  /* ================= 3. CONFIG & SECRETS ================= */
  {
    id: 'config', icon: '🔐',
    title: 'Config & Secrets — ConfigMap, Secret, External Secrets, CSI ya Sealed Secrets?',
    short: 'Config kahan rakhein?',
    tldr: 'Pehle: <b>secret hai ya nahi?</b> Phir: secret ka <b>source of truth</b> kahan hai (cloud secret manager/Vault, ya sirf git)? Wahi tool chuno jo us source se cluster tak surakshit laaye.',
    levels: ['config', 'secrets'], labs: ['07-config-reload'],
    start: 'secret',
    nodes: {
      secret: {
        q: 'Kya yeh <b>secret</b> hai? (password, API key, token, private key, connection string)',
        why: 'ConfigMap plain text hai — koi bhi jiske paas read access hai padh lega. Secrets ko alag RBAC, encryption at rest aur rotation chahiye.',
        options: [{ t: 'Nahi — normal config', next: 'shape' }, { t: 'Haan — secret hai', next: 'source' }],
      },
      shape: {
        q: 'Config <b>key=value</b> (LOG_LEVEL, FEATURE_X) hai, ya poori <b>file</b> (nginx.conf, application.yaml)?',
        why: 'Env vars process start par fix hote hain (badlav = restart). Volume files ~1 min mein update hoti hain (agar app dobara padhe).',
        options: [{ t: 'Key=value — env vars', next: 'cmenv' }, { t: 'Poori config file', next: 'cmvol' }],
      },
      source: {
        q: 'Secret ka <b>source of truth</b> kahan hai?',
        why: 'Secret ek hi jagah "rehna" chahiye (rotation, audit). Cluster mein sirf uski copy aaye — aur git mein kabhi plain text na jaaye.',
        options: [
          { t: 'Cloud secret manager / Vault mein (AWS SM, GCP SM, Azure KV)', next: 'etcd' },
          { t: 'Sirf git mein (GitOps), koi external manager nahi', next: 'sealed' },
          { t: 'Dev/test — bas cluster mein ek Secret chahiye', next: 'plainsecret' },
        ],
      },
      etcd: {
        q: 'Kya secret <b>etcd (K8s Secret object) mein aana chalega</b>? (policy kehti hai "secret sirf memory/file mein, cluster API mein nahi"?)',
        why: 'External Secrets Operator secret ko K8s Secret mein sync karta hai (apps ko normal Secret dikhta hai). Secrets Store CSI driver seedha pod ki file mein mount karta hai — etcd mein copy zaroori nahi.',
        options: [{ t: 'Haan — K8s Secret theek hai (encryption at rest ke saath)', next: 'eso' }, { t: 'Nahi — seedha pod mein file, etcd mein nahi', next: 'csi' }],
      },
      cmenv: {
        leaf: true, pick: 'ConfigMap (env variables)', icon: '🧾',
        one: 'Chhoti non-secret settings env vars ki tarah.',
        why: 'Non-secret key=value — sabse simple raasta.',
        when: ['LOG_LEVEL, feature flags, service URLs', '12-factor apps jo env padhte hain'],
        avoid: ['Secret → Secret/ESO', 'Badi config files → volume'],
        gotchas: ['ConfigMap badla → env <b>nahi</b> badalta; rollout chahiye (Helm <code>checksum/config</code> / Kustomize hash suffix se auto)', 'ConfigMap 1MiB tak'],
        yaml: `envFrom:
  - configMapRef: { name: app-settings }`,
        example: 'LOG_LEVEL=debug karna → ConfigMap badla → hash annotation se rollout.', level: 'config', lab: '07-config-reload',
      },
      cmvol: {
        leaf: true, pick: 'ConfigMap (mounted files)', icon: '📁',
        one: 'Config files pod mein mount — badlav ~1 min mein file tak pahunchta hai.',
        why: 'Poori file chahiye aur app hot-reload kar sakta hai.',
        when: ['nginx.conf, prometheus.yml, application.yaml', 'Apps jo file watch/reload karte hain'],
        avoid: ['<code>subPath</code> mount (kabhi update nahi hota) — poori directory mount karo'],
        gotchas: ['File update = app ne dobara padhi, yeh guarantee nahi — reload trigger ya rollout', '<code>immutable: true</code> + versioned naam = safe, fast, accidental-edit-proof'],
        yaml: `volumes:
  - name: cfg
    configMap: { name: nginx-conf }
containers:
  - name: nginx
    volumeMounts: [{ name: cfg, mountPath: /etc/nginx/conf.d }]`,
        example: 'Prometheus config ConfigMap mein; badlav ke baad <code>/-/reload</code> endpoint hit.', level: 'config', lab: '07-config-reload',
      },
      plainsecret: {
        leaf: true, pick: 'Secret (native K8s object)', icon: '🔑',
        one: 'Built-in Secret object — base64 encoded (encrypted nahi!).',
        why: 'Dev/test ya simple case jahan external manager nahi.',
        when: ['Dev clusters, local testing', 'Doosre tools ke banaye secrets (cert-manager TLS secrets)'],
        avoid: ['Plain Secret YAML git mein — base64 koi encryption nahi', 'Production ka source of truth → ESO/CSI'],
        gotchas: ['etcd <b>encryption at rest</b> on karo (KMS provider)', 'RBAC: <code>get/list secrets</code> = saare secrets padhna — bahut kam logon ko', 'Env se diya secret logs/crash dumps mein leak ho sakta hai — file mount behtar'],
        yaml: `kubectl create secret generic db-creds \\
  --from-literal=username=app --from-literal=password='S3cr3t!'`,
        example: 'Local kind cluster par app ka DB password.', level: 'config',
      },
      eso: {
        leaf: true, pick: 'ESO (external secret sync)', icon: '🔄',
        one: 'Cloud secret manager/Vault se K8s Secret mein sync — refresh ke saath.',
        why: 'Source of truth bahar hai; apps ko normal Secret chahiye; etcd copy policy ke hisaab se theek hai.',
        when: ['AWS Secrets Manager / SSM, GCP/Azure secret managers, Vault', 'Rotation: <code>refreshInterval</code> se cluster copy update', 'GitOps: git mein sirf ExternalSecret (reference), value kabhi nahi'],
        avoid: ['Secret etcd mein aana mana hai → CSI driver'],
        gotchas: ['Secret update hua par env se diya hai → pod restart chahiye (Reloader / hash)', 'Operator ko cloud IAM chahiye (IRSA/Workload Identity) — static keys nahi'],
        yaml: `apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata: { name: db-creds }
spec:
  refreshInterval: 1h
  secretStoreRef: { kind: ClusterSecretStore, name: aws-sm }
  target: { name: db-creds }
  data:
    - secretKey: password
      remoteRef: { key: prod/orders/db, property: password }`,
        example: 'RDS password AWS Secrets Manager mein rotate hota hai; ESO har ghante cluster Secret update karta hai.', level: 'secrets',
      },
      csi: {
        leaf: true, pick: 'Secrets Store CSI (mount)', icon: '💾',
        one: 'Secret seedha external store se pod ki file (tmpfs) mein — etcd mein copy zaroori nahi.',
        why: 'Policy ke hisaab se secret cluster API/etcd mein nahi rehna chahiye.',
        when: ['Strict compliance (secret sirf pod ki memory/file mein)', 'Vault/AWS/Azure/GCP providers'],
        avoid: ['Apps ko env var chahiye aur sync optional feature ok nahi → ESO simpler'],
        gotchas: ['Pod start par fetch hota hai — store down = pod start nahi', 'Env var chahiye toh optional "sync as Secret" — tab etcd mein copy aa jaati hai'],
        yaml: `volumes:
  - name: secrets
    csi:
      driver: secrets-store.csi.k8s.io
      readOnly: true
      volumeAttributes: { secretProviderClass: orders-db }`,
        example: 'PCI workload: card-processor ka key Vault se seedha tmpfs file mein.', level: 'secrets',
      },
      sealed: {
        leaf: true, pick: 'SOPS / Sealed Secrets (Git)', icon: '🔏',
        one: 'Secret git mein — par encrypted. Sirf cluster (ya CI key) decrypt kar sake.',
        why: 'GitOps chahiye aur koi external secret manager nahi hai.',
        when: ['Chhoti teams/clusters jahan git hi sab kuch hai', 'Sealed Secrets: controller ki public key se encrypt; SOPS: age/KMS se files encrypt'],
        avoid: ['Cloud secret manager available hai → ESO (rotation + audit behtar)'],
        gotchas: ['Sealed Secrets: controller ki private key ka <b>backup</b> — kho gayi toh saare SealedSecrets bekaar', 'Rotation manual hai: naya value seal karo, commit karo'],
        yaml: `kubeseal --format yaml < db-secret.yaml > db-sealed.yaml
git add db-sealed.yaml   # safe to commit`,
        example: 'Startup ka ek cluster: ArgoCD git se SealedSecrets apply karta hai.', level: 'secrets',
      },
    },
    compare: {
      cols: ['', 'ConfigMap', 'Secret (plain)', 'ESO', 'CSI driver', 'Sealed/SOPS'],
      rows: [
        ['Secret ke liye?', '❌', '⚠️ dev', '✅', '✅', '✅'],
        ['Source of truth', 'git', 'cluster', 'Cloud SM / Vault', 'Cloud SM / Vault', 'git (encrypted)'],
        ['etcd mein copy', 'haan', 'haan', 'haan', 'nahi (default)', 'haan'],
        ['Rotation', '—', 'manual', 'auto (refresh)', 'remount/restart', 'manual'],
      ],
    },
    scenarios: [
      { s: 'LOG_LEVEL aur FEATURE_NEW_CHECKOUT flags app ko env se chahiye.', answer: 'cmenv', explain: 'Non-secret key=value → ConfigMap envFrom (badlav par rollout, hash trick se).' },
      { s: 'nginx.conf jo nginx reload se padh sake.', answer: 'cmvol', explain: 'Poori file + hot reload → ConfigMap volume (subPath nahi!).' },
      { s: 'RDS password AWS Secrets Manager mein hai aur har mahine rotate hota hai; app ko normal Secret chahiye.', answer: 'eso', explain: 'External source of truth + K8s Secret chalega → ESO with refreshInterval.' },
      { s: 'Compliance: card-processing key cluster ke etcd mein kabhi nahi honi chahiye.', answer: 'csi', explain: 'etcd mein copy mana → Secrets Store CSI driver (pod file mein seedha).' },
      { s: 'Chhota startup, sab kuch ArgoCD + git se; koi Vault/SM nahi.', answer: 'sealed', explain: 'Git hi source → encrypted-in-git (Sealed Secrets/SOPS).' },
      { s: 'Local kind cluster par demo ke liye DB password.', answer: 'plainsecret', explain: 'Dev/test → seedha Secret theek hai (git mein mat daalna).' },
    ],
  },

  /* ================= 4. STORAGE ================= */
  {
    id: 'storage', icon: '💽',
    title: 'Storage chuno — emptyDir, PVC (RWO/RWX), StatefulSet volumes, object storage ya hostPath?',
    short: 'Data kahan rakhein?',
    tldr: 'Teen sawal: data <b>pod ke saath mar</b> sakta hai? <b>Kai pods ek saath likhenge</b>? Aur yeh <b>files/blobs</b> hain ya filesystem chahiye? Zyada-tar "files" ka sahi ghar object storage hai, volume nahi.',
    levels: ['storage'], labs: ['12-statefulset'],
    start: 'durable',
    nodes: {
      durable: {
        q: 'Pod mar jaaye toh data <b>bhi chala jaaye</b>, chalega? (cache, scratch, temp files)',
        why: 'Temporary data ke liye disk provision karna faltu hai — emptyDir pod ke saath banta aur mitta hai.',
        options: [{ t: 'Haan — temporary hai', next: 'emptydir' }, { t: 'Nahi — data bachna chahiye', next: 'blob' }],
      },
      blob: {
        q: 'Data <b>files/blobs</b> hain (uploads, images, backups, reports) jo app API se padh/likh sakta hai?',
        why: 'Object storage (S3/GCS) infinite, sasta, multi-AZ hai aur kisi node/pod se bandha nahi. Volumes sirf tab jab app ko asli filesystem chahiye.',
        options: [{ t: 'Haan — files/blobs', next: 'object' }, { t: 'Nahi — filesystem chahiye (DB data dir, app state)', next: 'shared' }],
      },
      shared: {
        q: 'Kya <b>kai pods ek saath</b> wahi files likhenge/padhenge (alag nodes par)?',
        why: 'Block disks (EBS, PD) ek waqt mein ek node par lagti hain (RWO). Shared access ke liye network filesystem (RWX) chahiye.',
        options: [{ t: 'Haan — shared (RWX)', next: 'rwx' }, { t: 'Nahi — har pod/replica ka apna', next: 'perreplica' }],
      },
      perreplica: {
        q: 'Kai replicas hain jinka <b>har ek ka apna</b> data hai (DB replicas, shards)?',
        why: 'StatefulSet ka volumeClaimTemplates har replica ko apni PVC deta hai. Ek hi pod ka data ho toh simple PVC kaafi hai.',
        options: [{ t: 'Haan — har replica ki apni disk', next: 'stsvct' }, { t: 'Nahi — ek hi pod ka data', next: 'pvcrwo' }, { t: 'Node ki local files padhni hain (log agent)', next: 'hostpath' }],
      },
      emptydir: {
        leaf: true, pick: 'emptyDir (Pod lifetime)', icon: '🫙',
        one: 'Pod ke saath bani, pod ke saath gayi — containers ke beech share bhi hoti hai.',
        why: 'Data temporary hai.',
        when: ['Cache, scratch space, sorting temp files', 'Sidecar aur main container ke beech file share', '<code>medium: Memory</code> = tmpfs (tez, par memory limit mein ginti)'],
        avoid: ['Data pod restart ke baad bhi chahiye → PVC'],
        gotchas: ['<code>sizeLimit</code> do — warna node ki disk bhar ke <b>eviction</b>', 'Container restart par data rehta hai, pod delete par nahi'],
        yaml: `volumes:
  - name: scratch
    emptyDir: { sizeLimit: 2Gi }`,
        example: 'Image-processing pod temp thumbnails emptyDir mein banata hai, upload S3 par.', level: 'storage',
      },
      object: {
        leaf: true, pick: 'Object store (S3/GCS/Blob)', icon: '🪣',
        one: 'App SDK se seedha bucket — koi PV/PVC nahi.',
        why: 'Files/blobs hain — object storage infinite, sasta, durable aur kisi node se bandha nahi.',
        when: ['User uploads, images, videos, reports, backups', 'Data lake / ML datasets'],
        avoid: ['App ko POSIX filesystem chahiye (DB data dir) → PVC'],
        gotchas: ['Credentials: IRSA / Workload Identity — static keys pod mein nahi', 'S3 ko filesystem ki tarah mount (FUSE) karna aksar dard — app ko SDK use karne do'],
        yaml: `# pod ko IAM role (IRSA) do, app SDK se:
serviceAccountName: uploads-sa   # annotation: eks.amazonaws.com/role-arn`,
        example: 'Shop ki product images S3 mein, CDN ke peeche — pods stateless rehte hain.',
      },
      rwx: {
        leaf: true, pick: 'PVC RWX (shared filesystem)', icon: '🗂️',
        one: 'Network filesystem jo kai nodes ke kai pods ek saath mount karein.',
        why: 'Kai pods ko wahi files ek saath chahiye.',
        when: ['Legacy apps jo shared folder maangti hain (CMS uploads)', 'ML training jahan kai workers ek dataset padhein'],
        avoid: ['DB data ke liye — network FS par locking/latency problems', 'Files sirf blobs hain → object storage'],
        gotchas: ['StorageClass RWX support kare (EBS nahi karta; EFS karta hai)', 'Performance block disk se kam — latency-sensitive kaam ke liye nahi'],
        yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: shared-uploads }
spec:
  accessModes: ["ReadWriteMany"]
  storageClassName: efs-sc
  resources: { requests: { storage: 50Gi } }`,
        example: 'Purani CMS ke 4 replicas ek hi uploads folder EFS par share karte hain.', level: 'storage',
      },
      stsvct: {
        leaf: true, pick: 'StatefulSet (PVC per Pod)', icon: '🗄️',
        one: 'Har replica ki apni PVC (data-db-0, data-db-1) jo pod ke saath "chipki" rehti hai.',
        why: 'Har replica ka alag data hai.',
        when: ['DB replicas, Kafka/Elasticsearch nodes, Redis shards'],
        avoid: ['Managed DB mil sakta hai → wahi'],
        gotchas: ['Scale down/delete par PVC rehti hai (data safety) — <code>persistentVolumeClaimRetentionPolicy</code> dekho', 'Zone-bound disks: pod usi zone mein schedule hoga jahan disk hai — StorageClass <code>volumeBindingMode: WaitForFirstConsumer</code>'],
        yaml: `volumeClaimTemplates:
  - metadata: { name: data }
    spec:
      accessModes: ["ReadWriteOnce"]
      resources: { requests: { storage: 20Gi } }`,
        example: '3 Elasticsearch nodes, har ek ka apna 100Gi index data.', level: 'storage', lab: '12-statefulset',
      },
      pvcrwo: {
        leaf: true, pick: 'PVC RWO (one node access)', icon: '💾',
        one: 'Ek disk, ek node par — single-instance app ka durable data.',
        why: 'Sirf ek pod ka data hai.',
        when: ['Single-instance apps (Jenkins, chhota Postgres dev)', 'Data jo restart ke baad bhi chahiye'],
        avoid: ['2+ replicas ko wahi disk → RWX ya StatefulSet', 'Files/blobs → object storage'],
        gotchas: ['Deployment ke saath <code>strategy: Recreate</code> — RollingUpdate mein naya pod purane ke disk chhodne ka intezaar karke atak jaata hai (Multi-Attach)', 'RWO ka matlab ek NODE (us node ke kai pods mount kar sakte hain); ek hi POD chahiye toh <code>ReadWriteOncePod</code>'],
        yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: jenkins-home }
spec:
  accessModes: ["ReadWriteOnce"]
  resources: { requests: { storage: 30Gi } }`,
        example: 'Jenkins controller — 1 replica, Recreate strategy, 30Gi PVC.', level: 'storage',
      },
      hostpath: {
        leaf: true, pick: 'hostPath (node-local files)', icon: '⚠️',
        one: 'Node ki directory seedha pod mein — node se bandha, khatarnaak.',
        why: 'Kaam hi node ki files ka hai (logs, metrics, runtime socket).',
        when: ['DaemonSet log/metrics agents (/var/log, /proc)', 'CSI/CNI node plugins'],
        avoid: ['App data — pod doosre node par gaya toh data gayab', 'Multi-tenant clusters — host par escape ka raasta (Pod Security <code>restricted</code> isse rokta hai)'],
        gotchas: ['<code>readOnly: true</code> jahan ho sake', 'Pod Security Admission baseline/restricted hostPath block karta hai — sirf system namespaces mein allow'],
        yaml: `volumes:
  - name: varlog
    hostPath: { path: /var/log }
# DaemonSet mein, readOnly: true ke saath`,
        example: 'Fluent Bit DaemonSet node ki /var/log/containers padhta hai.', level: 'podsecurity',
      },
    },
    compare: {
      cols: ['', 'emptyDir', 'PVC RWO', 'StatefulSet VCT', 'PVC RWX', 'Object storage', 'hostPath'],
      rows: [
        ['Pod delete ke baad', 'gayab', 'bacha', 'bacha (per pod)', 'bacha', 'bacha', 'node par bacha'],
        ['Kai pods share', 'ek pod ke containers', 'ek node', 'nahi (har ek apna)', 'haan', 'haan (API se)', 'ek node'],
        ['Typical', 'cache/temp', 'single app', 'DB/Kafka', 'legacy shared', 'uploads/backups', 'node agents'],
      ],
    },
    scenarios: [
      { s: 'User profile photos upload hote hain aur CDN se dikhte hain.', answer: 'object', explain: 'Blobs → S3/GCS (SDK). Pods stateless, scale aasaan.' },
      { s: 'Video transcoding pod ko 10GB temp space chahiye jo kaam ke baad bekaar.', answer: 'emptydir', explain: 'Temporary → emptyDir (sizeLimit ke saath!).' },
      { s: 'Elasticsearch ke 3 data nodes, har ek ka apna index data.', answer: 'stsvct', explain: 'Har replica ki apni disk → StatefulSet volumeClaimTemplates.' },
      { s: 'Single Jenkins controller ko apna /var/jenkins_home restart ke baad bhi chahiye.', answer: 'pvcrwo', explain: 'Ek pod, durable → PVC RWO (Deployment strategy Recreate).' },
      { s: 'Purani PHP CMS ke 4 replicas ek hi /uploads folder share karte hain.', answer: 'rwx', explain: 'Kai pods ek saath likhte hain → RWX (EFS/NFS). Lambe time mein: S3 par migrate.' },
      { s: 'Node-exporter ko node ka /proc aur /sys padhna hai.', answer: 'hostpath', explain: 'Node agent (DaemonSet) → hostPath readOnly. App data ke liye kabhi nahi.' },
    ],
  },
]);

KG.registerDecisions([

  /* ================= 5. PROBES ================= */
  {
    id: 'probes', icon: '🩺',
    title: 'Kaunse probes lagayein — readiness, startup, liveness (ya koi nahi)?',
    short: 'Probe recipe',
    tldr: 'Traffic serve karta hai → <b>readiness hamesha</b>. Boot slow hai → <b>startup</b> bhi. <b>Liveness sirf tab</b> jab app atak sakta hai aur restart se theek hota hai — shak ho toh mat lagao.',
    levels: ['probes'], labs: ['03-probes'],
    start: 'serves',
    nodes: {
      serves: {
        q: 'Kya pod <b>traffic serve</b> karta hai (Service ke peeche — HTTP/gRPC/TCP)?',
        why: 'Readiness probe hi decide karta hai ki pod Service ke endpoints mein rahe ya nahi. Bina iske, boot ho raha ya bimar pod bhi traffic paata hai.',
        options: [{ t: 'Haan — Service ke peeche', next: 'slow' }, { t: 'Nahi — background worker / job', next: 'worker' }],
      },
      slow: {
        q: 'Boot hone mein <b>kaafi time</b> lagta hai? (JVM, migrations, cache warm-up — ~30s+ ya unpredictable)',
        why: 'Startup probe pass hone tak readiness/liveness rukte hain — slow boot ko liveness maarta nahi. initialDelaySeconds ka hack har restart par bhi wait karata hai.',
        options: [{ t: 'Haan — slow / unpredictable boot', next: 'hangslow' }, { t: 'Nahi — kuch second mein ready', next: 'hangfast' }],
      },
      hangslow: {
        q: 'Kya app <b>chalte-chalte atak</b> sakta hai (deadlock, stuck event loop) jahan <b>restart se theek</b> hota hai?',
        why: 'Liveness ka ek hi kaam: atke process ko restart. Galat liveness (jaise DB check) = DB slow → saare pods restart → outage.',
        options: [{ t: 'Haan — atakta hai, restart se theek', next: 'rsl' }, { t: 'Nahi / pata nahi', next: 'rs' }],
      },
      hangfast: {
        q: 'Kya app <b>chalte-chalte atak</b> sakta hai jahan restart se theek hota hai?',
        why: 'Liveness sirf deadlock-type problems ke liye. Shak ho toh mat lagao — restart loop zyada nuksaan karta hai.',
        options: [{ t: 'Haan', next: 'rl' }, { t: 'Nahi / pata nahi', next: 'r' }],
      },
      worker: {
        q: 'Kya yeh <b>lambe time tak chalne wala worker</b> hai (queue consumer), ya <b>khatam hone wala</b> Job?',
        why: 'Worker atak jaaye toh koi traffic nahi ruka — par kaam ruk gaya. Heartbeat-based liveness use pakadta hai. Jobs ke liye time-limit (activeDeadlineSeconds) behtar hai.',
        options: [{ t: 'Long-running worker', next: 'wl' }, { t: 'Job / batch (khatam hota hai)', next: 'none' }],
      },
      r: {
        leaf: true, pick: 'readiness (traffic gate)', icon: '🚦',
        one: 'Traffic tabhi jab sach mein ready — restart ka koi khatra nahi.',
        why: 'Tez boot, atakne ka koi known pattern nahi.',
        when: ['Zyada-tar stateless web/API services', 'Nginx/static servers'],
        avoid: ['Slow boot → startupProbe bhi'],
        gotchas: ['Readiness endpoint halka rakho (timeoutSeconds default 1s)', 'Zaroori dependency check theek hai — par timeouts chhote, warna ek dependency ke slow hone se saare pods "not ready" → poori service down'],
        yaml: `readinessProbe:
  httpGet: { path: /ready, port: http }
  periodSeconds: 5
  failureThreshold: 3`,
        example: 'Frontend nginx — readiness "/" par.', level: 'probes', lab: '03-probes',
      },
      rs: {
        leaf: true, pick: 'startup + readiness probes', icon: '🐢',
        one: 'Boot ke dauraan suraksha + traffic gating.',
        why: 'Boot slow hai par atakne ka pattern nahi.',
        when: ['JVM/Spring apps, migrations-on-start, cache warm-up'],
        avoid: ['initialDelaySeconds se boot ka andaaza — boot time badla toh toota'],
        gotchas: ['Budget = <code>periodSeconds × failureThreshold</code> (jaise 10 × 30 = 5 min) — worst-case boot + margin', 'Budget khatam → container restart (startup bhi restart karta hai)'],
        yaml: `startupProbe:
  httpGet: { path: /ready, port: http }
  periodSeconds: 10
  failureThreshold: 30      # 5 min tak boot
readinessProbe:
  httpGet: { path: /ready, port: http }
  periodSeconds: 5`,
        example: 'Spring Boot service jo 60–90s mein boot hoti hai.', level: 'probes', lab: '03-probes',
      },
      rl: {
        leaf: true, pick: 'readiness + liveness probes', icon: '🔁',
        one: 'Tez boot, par kabhi-kabhi atakta hai — restart se ilaaj.',
        why: 'Known hang pattern hai aur restart se theek hota hai.',
        when: ['Apps jinke known deadlock/stuck states hain', 'Single-threaded event loops jo block ho sakte hain'],
        avoid: ['Liveness mein DB/external API check — cascading restarts'],
        gotchas: ['Liveness ka <code>failureThreshold</code> readiness se zyada rakho (pehle traffic hate, phir restart)', 'Liveness endpoint sirf process ki apni sehat check kare (<code>/healthz</code>)'],
        yaml: `readinessProbe:
  httpGet: { path: /ready, port: http }
  periodSeconds: 5
livenessProbe:
  httpGet: { path: /healthz, port: http }
  periodSeconds: 10
  failureThreshold: 6`,
        example: 'Node.js service jiska event loop kabhi block ho jaata tha — liveness ne 3 AM pages khatam kiye.', level: 'probes',
      },
      rsl: {
        leaf: true, pick: 'startup + ready + live probes', icon: '🛡️',
        one: 'Teeno: boot ki suraksha, traffic gating, atakne par restart.',
        why: 'Slow boot + known hang pattern.',
        when: ['Bade JVM services jo deadlock ho sakte hain'],
        avoid: ['"Sab lagao, safe rahega" — har probe ka kaam samjho, warna restart loops'],
        gotchas: ['Liveness startup ke baad hi shuru hota hai — liveness par initialDelaySeconds ki zaroorat nahi', 'Teeno alag endpoints ya kam se kam alag logic'],
        yaml: `startupProbe:   { httpGet: { path: /ready,   port: http }, periodSeconds: 10, failureThreshold: 30 }
readinessProbe: { httpGet: { path: /ready,   port: http }, periodSeconds: 5 }
livenessProbe:  { httpGet: { path: /healthz, port: http }, periodSeconds: 10, failureThreshold: 6 }`,
        example: 'Payment gateway JVM service: 2 min boot, rare thread deadlocks.', level: 'probes', lab: '03-probes',
      },
      wl: {
        leaf: true, pick: 'Worker liveness (heartbeat)', icon: '💓',
        one: 'Worker har loop par heartbeat file touch kare; liveness us file ki umar check kare.',
        why: 'Koi HTTP port nahi, par atakna pakadna hai.',
        when: ['Queue consumers, stream processors'],
        avoid: ['Readiness worker par bekaar hai (koi Service nahi) — lagao toh sirf rollout gating ke liye'],
        gotchas: ['exec probe har baar process chalata hai — halka rakho', 'Heartbeat interval < liveness window'],
        yaml: `livenessProbe:
  exec:
    command: ["sh", "-c", "test $(( $(date +%s) - $(stat -c %Y /tmp/heartbeat) )) -lt 60"]
  periodSeconds: 20`,
        example: 'Kafka consumer jo kabhi-kabhi rebalance mein atak jaata tha.', level: 'probes',
      },
      none: {
        leaf: true, pick: 'Job activeDeadlineSeconds', icon: '⏱️',
        one: 'Job/batch ke liye probes nahi; <code>activeDeadlineSeconds</code> + backoffLimit.',
        why: 'Kaam khatam hone wala hai — "atka" = time-limit cross.',
        when: ['Migrations, reports, batch jobs'],
        avoid: ['Liveness Job par — restart se kaam dobara shuru (idempotent na ho toh nuksaan)'],
        gotchas: ['activeDeadlineSeconds poore Job par lagta hai, har pod par nahi'],
        yaml: `spec:
  activeDeadlineSeconds: 900
  backoffLimit: 2`,
        example: 'Nightly report job — 15 min se zyada chala toh fail, alert.', level: 'workloads', lab: '13-jobs-cronjobs',
      },
    },
    compare: {
      cols: ['', 'readiness', 'liveness', 'startup'],
      rows: [
        ['Fail par', 'Service endpoints se bahar (no restart)', 'Container RESTART', 'Budget khatam → restart'],
        ['Sawal', '"Traffic le sakta hoon?"', '"Zinda hoon ya atka?"', '"Boot ho gaya?"'],
        ['Kab', 'Har serving app', 'Sirf atakne wale apps', 'Slow boot'],
        ['Galti', 'Heavy endpoint, lambe timeouts', 'DB/external check → cascade', 'Chhota budget'],
      ],
    },
    scenarios: [
      { s: 'Nginx static site, 2 sec mein boot, kabhi atakti nahi.', answer: 'r', explain: 'Sirf readiness — liveness ka koi kaam nahi.' },
      { s: 'Spring Boot app 90s mein boot hoti hai; abhi liveness boot ke beech maar deta hai.', answer: 'rs', explain: 'startupProbe (budget > 90s) + readiness. Atakne ka pattern nahi toh liveness nahi.' },
      { s: 'Node.js API tez boot hoti hai par event loop kabhi-kabhi block ho jaata hai; restart se theek.', answer: 'rl', explain: 'Readiness + liveness (sirf /healthz, koi DB check nahi).' },
      { s: 'JVM payment service: 2 min boot aur rare thread deadlock.', answer: 'rsl', explain: 'Teeno — startup (boot), readiness (traffic), liveness (deadlock).' },
      { s: 'Kafka consumer (koi HTTP port nahi) kabhi rebalance mein atak jaata hai.', answer: 'wl', explain: 'Heartbeat file + exec liveness.' },
      { s: 'DB migration Job jo 10 min tak chal sakti hai.', answer: 'none', explain: 'Job → activeDeadlineSeconds + backoffLimit; probes nahi.' },
    ],
  },

  /* ================= 6. AUTOSCALING ================= */
  {
    id: 'autoscale', icon: '📈',
    title: 'Autoscaling — HPA, KEDA, VPA, Cluster Autoscaler ya Karpenter?',
    short: 'Kaunsa autoscaler?',
    tldr: 'Pehle <b>problem pehchaano</b>: pods <b>kam</b> hain (HPA/KEDA), pods ka <b>size</b> galat hai (VPA), ya pods ke liye <b>nodes</b> nahi hain (Cluster Autoscaler/Karpenter). Aksar do saath chalte hain: HPA pods badhata hai, node autoscaler unke liye jagah.',
    levels: ['autoscale', 'karpenterbasics'], labs: ['10-hpa'],
    start: 'problem',
    nodes: {
      problem: {
        q: 'Asli problem kya hai?',
        why: 'Har autoscaler ek alag cheez scale karta hai: replicas, pod ka size, ya nodes. Galat tool = galat ilaaj.',
        options: [
          { t: 'Load badhne par zyada PODS chahiye', next: 'signal' },
          { t: 'Pods ka SIZE (requests) galat / pata hi nahi kitna chahiye', next: 'vpa' },
          { t: 'Pods Pending hain — NODES kam pad rahe hain', next: 'nodes' },
        ],
      },
      signal: {
        q: 'Scale kis <b>signal</b> par karna hai?',
        why: 'HPA resource metrics (CPU/memory) ya custom metrics par chalta hai. Queue length, events, schedule, aur scale-to-zero KEDA ka khel hai.',
        options: [
          { t: 'CPU / memory utilization', next: 'hpa' },
          { t: 'Queue length / Kafka lag / events / cron — ya 0 tak scale', next: 'keda' },
        ],
      },
      nodes: {
        q: 'Cluster kahan hai aur nodes kaise chahiye?',
        why: 'Karpenter (mostly AWS) har pending pod ke liye best-fit instance khud chunta hai, tez aur sasta. Cluster Autoscaler pehle se bane node groups ko scale karta hai — har cloud par chalta hai.',
        options: [
          { t: 'AWS EKS — diverse instance types, spot, tez provisioning', next: 'karpenter' },
          { t: 'Koi bhi cloud / fixed node groups (ASG/MIG)', next: 'ca' },
        ],
      },
      hpa: {
        leaf: true, pick: 'HPA (Pod replica scaling)', icon: '📊',
        one: 'CPU/memory (ya custom metrics) ke hisaab se replicas.',
        why: 'Load ke saath pods badhane hain aur signal resource utilization hai.',
        when: ['Stateless web/API ka CPU-bound load', 'Custom metrics (RPS) — Prometheus Adapter ke saath'],
        avoid: ['Scale to zero → KEDA', 'Queue backlog signal → KEDA'],
        gotchas: ['<b>requests.cpu</b> ke bina <code>&lt;unknown&gt;</code> — utilization = usage ÷ request', 'Scale-down default 5 min stabilization', 'HPA + VPA dono CPU par = ladai', 'GitOps: manifest se replicas hatao'],
        yaml: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }`,
        example: 'Sale day: API 3 → 24 pods 10 minute mein, CPU 60% target.', level: 'autoscale', lab: '10-hpa',
      },
      keda: {
        leaf: true, pick: 'KEDA (event-based scaling)', icon: '⚡',
        one: 'Queue/stream/cron jaise event sources par scale — 0 tak bhi.',
        why: 'Signal CPU nahi, kaam ki backlog hai — ya idle mein zero pods chahiye.',
        when: ['SQS/RabbitMQ/Kafka consumers', 'Scale-to-zero (dev envs, rare jobs)', 'Cron-based scaling (office hours)'],
        avoid: ['Seedha CPU-bound web API → plain HPA kaafi'],
        gotchas: ['KEDA andar HPA hi banata hai — usi Deployment par alag HPA mat banao', 'Scale-to-zero: pehla message aane par cold start latency'],
        yaml: `apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: orders-worker }
spec:
  scaleTargetRef: { name: orders-worker }
  minReplicaCount: 0
  maxReplicaCount: 50
  triggers:
    - type: aws-sqs-queue
      metadata: { queueURL: https://sqs.ap-south-1.amazonaws.com/123/orders, queueLength: "20", awsRegion: ap-south-1 }`,
        example: 'Order workers: raat ko 0 pods, sale par queue ke hisaab se 40.', level: 'autoscale',
      },
      vpa: {
        leaf: true, pick: 'VPA (Pod request tuning)', icon: '📏',
        one: 'Pods ke requests/limits ki recommendation (ya auto-update).',
        why: 'Problem size ki hai, ginti ki nahi.',
        when: ['Requests guesswork par hain — data-based right-sizing', 'Stateful/singleton apps jo horizontally scale nahi hote'],
        avoid: ['Usi metric par HPA bhi chal raha ho'],
        gotchas: ['Pehle <code>updateMode: "Off"</code> — sirf recommendation padho, phir decide', 'Auto mode pods ko recreate karke resize karta hai (disruption) — PDB lagao'],
        yaml: `apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata: { name: api }
spec:
  targetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  updatePolicy: { updateMode: "Off" }   # pehle sirf recommendation`,
        example: 'VPA ne bataya api ko 2Gi nahi, 600Mi chahiye — 40 pods par aadha cluster bacha.', level: 'scheduler',
      },
      karpenter: {
        leaf: true, pick: 'Karpenter (node provisioning)', icon: '🌲',
        one: 'Pending pods dekh ke best-fit EC2 instance khud launch; khaali/kam-bhare nodes consolidate.',
        why: 'EKS par diverse instance types + spot + tez provisioning chahiye.',
        when: ['EKS clusters, mixed workloads', 'Spot-heavy cost optimization', 'Node groups ka jhanjhat khatam karna'],
        avoid: ['Non-AWS (AKS par NAP/Karpenter provider hai; baaki jagah CA)'],
        gotchas: ['NodePool <code>limits</code> lagao — warna runaway scale = bill shock', 'Consolidation lambe jobs ko disrupt karti hai → <code>karpenter.sh/do-not-disrupt</code>', 'PDBs zaroori — Karpenter unhe respect karta hai'],
        yaml: `apiVersion: karpenter.sh/v1
kind: NodePool
metadata: { name: default }
spec:
  template:
    spec:
      nodeClassRef: { group: karpenter.k8s.aws, kind: EC2NodeClass, name: default }
      requirements:
        - { key: karpenter.sh/capacity-type, operator: In, values: ["spot", "on-demand"] }
  limits: { cpu: "1000" }
  disruption: { consolidationPolicy: WhenEmptyOrUnderutilized, consolidateAfter: 1m }`,
        example: 'Pending pods se ~1 min mein naye nodes; raat ko khaali nodes consolidate → bill ~30% kam.', level: 'karpenterbasics',
      },
      ca: {
        leaf: true, pick: 'Cluster Autoscaler (nodes)', icon: '🧱',
        one: 'Pending pods par pehle se bane node groups (ASG/MIG) ko scale up/down.',
        why: 'Har cloud par chalta hai; node groups ka model theek hai.',
        when: ['GKE/AKS/on-prem cloud providers', 'Node types pehle se tay hain'],
        avoid: ['EKS par flexible best-fit chahiye → Karpenter'],
        gotchas: ['Har node group ek instance type — mixed sizes ke liye kai groups', 'Scale-down tab jab node pe pods doosri jagah fit hon (PDB/local storage block kar sakte hain)'],
        yaml: `# cloud-provider specific — aksar managed add-on:
# GKE: --enable-autoscaling --min-nodes 1 --max-nodes 10 (node pool par)`,
        example: 'GKE node pool 3–15 nodes, pending pods par scale.', level: 'autoscale',
      },
    },
    compare: {
      cols: ['', 'HPA', 'KEDA', 'VPA', 'Cluster Autoscaler', 'Karpenter'],
      rows: [
        ['Kya scale', 'replicas', 'replicas (0 tak)', 'requests/limits', 'nodes (groups)', 'nodes (best-fit)'],
        ['Signal', 'CPU/mem/custom', 'events/queues/cron', 'historic usage', 'Pending pods', 'Pending pods'],
        ['Kab', 'CPU-bound APIs', 'Queue workers', 'Right-sizing', 'Har cloud', 'EKS, spot'],
      ],
    },
    scenarios: [
      { s: 'API ka CPU sale ke time 90% jaata hai; replicas badhne chahiye.', answer: 'hpa', explain: 'CPU signal + replicas → HPA (requests.cpu zaroor!).' },
      { s: 'SQS mein 50k messages jama; workers ko backlog ke hisaab se badhna hai, raat ko 0.', answer: 'keda', explain: 'Queue length + scale-to-zero → KEDA ScaledObject.' },
      { s: 'Kisi ko pata nahi api pod ko kitni memory chahiye — requests andaaze se.', answer: 'vpa', explain: 'Right-sizing → VPA recommendation mode (updateMode Off).' },
      { s: 'EKS par HPA ne pods badhaye par woh Pending hain; spot use karke sasta chahiye.', answer: 'karpenter', explain: 'Nodes kam + EKS + spot → Karpenter NodePool.' },
      { s: 'GKE cluster ke node pool mein pods Pending, nodes badhne chahiye.', answer: 'ca', explain: 'Node groups scale → Cluster Autoscaler (GKE managed).' },
    ],
  },

  /* ================= 7. PLACEMENT ================= */
  {
    id: 'placement', icon: '🧲',
    title: 'Pod kahan chale — nodeSelector, affinity, taints, spread ya priority?',
    short: 'Scheduling rules',
    tldr: 'Pod <b>node chunta</b> hai (nodeSelector/affinity = chumbak 🧲), node <b>pods ko bhagata</b> hai (taint = taala 🔒, toleration = chaabi 🔑), replicas <b>failaane</b> ke liye spread, aur bhare cluster mein <b>VIP</b> ke liye PriorityClass.',
    levels: ['affinity', 'priority'], labs: ['05-scheduling'],
    start: 'goal',
    nodes: {
      goal: {
        q: 'Tumhara <b>goal</b> kya hai?',
        why: 'Har scheduling tool ek alag sawal ka jawab hai — mix karne se pehle sahi sawal pakdo.',
        options: [
          { t: 'Pod ko khaas TYPE ke node par bhejna (GPU, SSD, arm64, zone)', next: 'attract' },
          { t: 'Kuch nodes ko SIRF kuch pods ke liye reserve karna', next: 'taints' },
          { t: 'Replicas ko nodes/zones mein FAILAANA (HA)', next: 'spread' },
          { t: 'Do services ko PAAS-PAAS rakhna (latency)', next: 'podaffinity' },
          { t: 'Cluster bhara ho toh bhi CRITICAL pod ko jagah mile', next: 'priority' },
        ],
      },
      attract: {
        q: 'Rule <b>simple equality</b> hai (disktype=ssd), ya complex/soft (In/NotIn, "ho sake toh")?',
        why: 'nodeSelector sirf exact match + hard. nodeAffinity mein operators aur preferred (soft) rules hain.',
        options: [{ t: 'Simple, hard rule', next: 'nodeselector' }, { t: 'Complex (In/NotIn/Exists) ya soft preference', next: 'nodeaffinity' }],
      },
      spread: {
        q: 'Har node par <b>max ek</b> replica (strict), ya <b>barabar failaana</b> (zones + nodes, flexible)?',
        why: 'Strict anti-affinity replicas > nodes hone par Pending karta hai. topologySpreadConstraints barabar distribution deta hai aur zones+nodes dono sambhalta hai.',
        options: [{ t: 'Barabar failaao (recommended)', next: 'tsc' }, { t: 'Strict: ek node par ek hi', next: 'antiaffinity' }],
      },
      nodeselector: {
        leaf: true, pick: 'nodeSelector (exact match)', icon: '🏷️',
        one: 'Pod sirf un nodes par jahan saare diye labels match karein.',
        why: 'Simple, hard requirement.',
        when: ['GPU / SSD / arch=arm64 nodes', 'Kisi node pool tak seemit karna'],
        avoid: ['"Ho sake toh" wala soft rule → nodeAffinity preferred', 'Dedicated nodes → taint bhi chahiye (warna doosre pods bhi aa jaayenge)'],
        gotchas: ['Label kisi node par na ho → Pending (<code>didn\'t match Pod\'s node affinity/selector</code>)'],
        yaml: `spec:
  nodeSelector:
    disktype: ssd`,
        example: 'ML inference pods sirf <code>accelerator=nvidia-t4</code> nodes par.', level: 'affinity', lab: '05-scheduling',
      },
      nodeaffinity: {
        leaf: true, pick: 'nodeAffinity (node rules)', icon: '🎯',
        one: 'Operators (In, NotIn, Exists, Gt) + soft preferences ke saath node chunna.',
        why: 'Rule complex hai ya "pasand" hai, zid nahi.',
        when: ['"Zone a ya b mein" (In)', '"Spot node pasand, na mile toh on-demand" (preferred)'],
        avoid: ['Simple equality → nodeSelector (padhne mein aasaan)'],
        gotchas: ['<code>IgnoredDuringExecution</code>: label baad mein hata toh chalta pod nahi hatega', 'Kai nodeSelectorTerms = OR; ek term ke andar matchExpressions = AND'],
        yaml: `affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
            - { key: karpenter.sh/capacity-type, operator: In, values: ["spot"] }`,
        example: 'Batch jobs: spot pasand, na mile toh on-demand par bhi chal jaao.', level: 'affinity',
      },
      taints: {
        leaf: true, pick: 'Taint + toleration + selector', icon: '🔒',
        one: 'Taint doosron ko bhagata hai; toleration ijaazat deti hai; nodeSelector apno ko wahan bhejta hai.',
        why: 'Nodes reserve karne hain — doosre pods bahar, apne andar.',
        when: ['GPU nodes sirf ML ke liye', 'Team/tenant dedicated node pools', 'Spot nodes jahan sirf interruption-tolerant pods'],
        avoid: ['Sirf toleration lagana — pod tainted node par JA sakta hai, par jaana zaroori nahi'],
        gotchas: ['Effects: NoSchedule · PreferNoSchedule · NoExecute (chalte pods bhi nikalte hain)', 'DaemonSets ko bhi toleration chahiye (warna us node par agent nahi)'],
        yaml: `# node:  kubectl taint nodes gpu-1 dedicated=ml:NoSchedule
spec:
  nodeSelector: { accelerator: nvidia }
  tolerations:
    - { key: dedicated, operator: Equal, value: ml, effect: NoSchedule }`,
        example: 'GPU pool par sirf training jobs — baaki web pods taint ki wajah se bahar.', level: 'affinity', lab: '05-scheduling',
      },
      tsc: {
        leaf: true, pick: 'topologySpreadConstraints', icon: '🌍',
        one: 'Replicas ko zones/nodes mein barabar (maxSkew) failao.',
        why: 'HA chahiye bina strict "ek node ek pod" ke.',
        when: ['Multi-AZ HA (topology.kubernetes.io/zone)', 'Nodes par barabar distribution'],
        avoid: ['Sirf ek replica — kuch failaane ko hai hi nahi'],
        gotchas: ['<code>whenUnsatisfiable: DoNotSchedule</code> = hard (Pending ho sakta hai); <code>ScheduleAnyway</code> = soft', 'labelSelector apne hi pods ko pakde'],
        yaml: `topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector: { matchLabels: { app: checkout } }`,
        example: 'Checkout ke 6 replicas: 2-2-2 teen zones mein — ek AZ gaya, 4 bache.', level: 'affinity',
      },
      antiaffinity: {
        leaf: true, pick: 'podAntiAffinity (separation)', icon: '🙅',
        one: 'Same app ke do pods ek node par kabhi nahi.',
        why: 'Strict isolation chahiye (har node par max ek).',
        when: ['Chhote clusters mein DB replicas alag nodes par zaroor', 'Node failure = sirf ek replica gaya'],
        avoid: ['Replicas > nodes — baaki Pending; flexible ke liye topologySpread'],
        gotchas: ['Bade clusters mein required anti-affinity scheduler ke liye mehenga', 'Soft version: preferredDuringScheduling...'],
        yaml: `affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - topologyKey: kubernetes.io/hostname
        labelSelector: { matchLabels: { app: redis } }`,
        example: '3 Redis replicas 3 alag nodes par — ek node gira, 2 bache.', level: 'affinity',
      },
      podaffinity: {
        leaf: true, pick: 'podAffinity (colocation)', icon: '🤝',
        one: 'Mere pod ko us node/zone par rakho jahan woh doosra pod hai.',
        why: 'Do services bahut baat karti hain — paas rakhne se latency/cross-AZ cost kam.',
        when: ['App + uska cache same zone mein', 'Cross-AZ data transfer cost bachana'],
        avoid: ['Hard affinity jo sab ek node par thoos de — failure domain ek ho jaata hai'],
        gotchas: ['Zone-level (<code>topology.kubernetes.io/zone</code>) aksar hostname-level se behtar'],
        yaml: `affinity:
  podAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          topologyKey: topology.kubernetes.io/zone
          labelSelector: { matchLabels: { app: redis } }`,
        example: 'API pods Redis ke zone mein — cross-AZ bill kam.', level: 'affinity',
      },
      priority: {
        leaf: true, pick: 'PriorityClass (preemption)', icon: '👑',
        one: 'Cluster bhara ho toh high-priority pod low-priority pods ko evict karke jagah le.',
        why: 'Critical workload ko capacity ki guarantee chahiye.',
        when: ['Payments/checkout vs batch jobs', 'System add-ons (system-cluster-critical)'],
        avoid: ['Sabko high priority — phir koi bhi priority nahi'],
        gotchas: ['Preemption PDB ko "best effort" respect karta hai, guarantee nahi', 'Low-priority batch ke liye <code>preemptionPolicy: Never</code> wali class bhi bana sakte ho'],
        yaml: `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: business-critical }
value: 100000
globalDefault: false
description: "checkout/payments — cluster bhara ho toh pehle inko jagah"
# Use: Deployment ke pod template (spec.template.spec) mein →
#   priorityClassName: business-critical`,
        example: 'Sale ke dauraan checkout pods ne batch analytics pods ko preempt karke jagah li.', level: 'priority',
      },
    },
    compare: {
      cols: ['', 'Kaun lagata hai', 'Kya karta hai', 'Hard/Soft'],
      rows: [
        ['nodeSelector', 'Pod', 'Node chunta hai (exact labels)', 'Hard'],
        ['nodeAffinity', 'Pod', 'Node chunta hai (operators)', 'Dono'],
        ['taint/toleration', 'Node / Pod', 'Node bhagata hai / pod ko ijaazat', 'Hard (NoSchedule)'],
        ['topologySpread', 'Pod', 'Replicas failata hai', 'Dono'],
        ['pod(Anti)Affinity', 'Pod', 'Doosre pods ke paas/door', 'Dono'],
        ['PriorityClass', 'Pod', 'Jagah na ho toh dusron ko nikaale', '—'],
      ],
    },
    scenarios: [
      { s: 'Training jobs sirf GPU nodes par; aur GPU nodes par koi web pod na aaye.', answer: 'taints', explain: 'Reserve karna = taint (doosre bahar) + toleration + nodeSelector (apne andar).' },
      { s: 'Pod ko bas ssd label wale node par jaana hai.', answer: 'nodeselector', explain: 'Simple hard equality → nodeSelector.' },
      { s: 'Checkout ke 6 replicas teen AZs mein barabar chahiye.', answer: 'tsc', explain: 'Zones mein barabar → topologySpreadConstraints (zone key).' },
      { s: 'Batch job ke liye spot nodes pasand hain, na milein toh on-demand chalega.', answer: 'nodeaffinity', explain: 'Soft preference → nodeAffinity preferredDuringScheduling.' },
      { s: '3-node cluster mein 3 Redis replicas — ek node par do kabhi nahi.', answer: 'antiaffinity', explain: 'Strict ek-node-ek-pod → required podAntiAffinity (hostname).' },
      { s: 'API pods Redis wale zone mein hi chalein (cross-AZ cost bachao).', answer: 'podaffinity', explain: 'Doosre pod ke paas → podAffinity (zone, preferred).' },
      { s: 'Cluster full hone par bhi payments pods ko jagah milni hi chahiye.', answer: 'priority', explain: 'Capacity guarantee → PriorityClass (preemption).' },
    ],
  },

  /* ================= 8. ROLLOUT STRATEGY ================= */
  {
    id: 'rollout', icon: '🚢',
    title: 'Naya version kaise laayein — RollingUpdate, Recreate, Blue-Green, Canary ya feature flags?',
    short: 'Deploy strategy',
    tldr: '<b>Do versions ek saath chal sakte hain?</b> Nahi → Recreate. Haan → risk ke hisaab se: normal = RollingUpdate, instant switch = Blue-Green, metrics se dheere = Canary. Release ko deploy se alag karna = feature flags.',
    levels: ['deploy', 'argorollouts', 'istio'], labs: ['11-rollout-pdb'],
    start: 'coexist',
    nodes: {
      coexist: {
        q: 'Kya <b>purana aur naya version ek saath</b> chal sakte hain? (API + DB schema backward compatible)',
        why: 'RollingUpdate/Canary/Blue-Green sab mein kuch der dono versions saath hote hain. Compatible nahi → ek ko band karke doosra (downtime).',
        options: [{ t: 'Haan — compatible', next: 'decouple' }, { t: 'Nahi — breaking change', next: 'recreate' }],
      },
      decouple: {
        q: 'Feature ko <b>deploy se alag</b> on/off karna hai? (per-user, dark launch, instant kill-switch bina deploy)',
        why: 'Feature flags se code deploy ho jaata hai par feature band rehta hai — release ek config switch ban jaata hai. Yeh strategy ke saath bhi chal sakta hai.',
        options: [{ t: 'Haan — feature-level control chahiye', next: 'flags' }, { t: 'Nahi — poora version roll karna hai', next: 'risk' }],
      },
      risk: {
        q: 'Change kitna <b>risky</b> hai aur kya chahiye?',
        why: 'Zyada risk = chhota blast radius (canary, % traffic + metrics). Instant switch + instant rollback = blue-green (2x capacity). Roz ke changes = rolling update.',
        options: [
          { t: 'Normal change — bas downtime na ho', next: 'rolling' },
          { t: 'Risky — thode users par metrics dekh ke dheere badhao', next: 'canary' },
          { t: 'Poora naya env test karke ek jhatke mein switch, turant wapsi', next: 'bluegreen' },
        ],
      },
      rolling: {
        leaf: true, pick: 'RollingUpdate (gradual swap)', icon: '🔄',
        one: 'Pods ek-ek karke naye — maxSurge/maxUnavailable se speed aur safety.',
        why: 'Compatible, normal risk — built-in aur free.',
        when: ['Roz ke deploys', 'Stateless services with readiness probes'],
        avoid: ['Breaking change → Recreate', 'Traffic % control chahiye → Canary'],
        gotchas: ['Readiness probe ke bina "rolling" bekaar — not-ready pod ko bhi traffic', '<code>maxUnavailable: 0</code> = kharab version aaye toh bhi purane pods serve karte rahein', 'Quota tight ho toh surge ki jagah chahiye (warna atkega)'],
        yaml: `strategy:
  type: RollingUpdate
  rollingUpdate: { maxUnavailable: 0, maxSurge: 25% }
progressDeadlineSeconds: 300`,
        example: 'Har PR merge par checkout ka rolling deploy, 0 downtime.', level: 'deploy', lab: '11-rollout-pdb',
      },
      recreate: {
        leaf: true, pick: 'Recreate (stop then start)', icon: '♻️',
        one: 'Saare purane pods band, phir naye — beech mein downtime.',
        why: 'Do versions ek saath nahi chal sakte.',
        when: ['Breaking DB migrations (maintenance window)', 'RWO volume wala single-instance app (concurrent writers unsafe)'],
        avoid: ['User-facing services jahan downtime mana hai — pehle backward-compatible migration (expand → contract) socho'],
        gotchas: ['Downtime = image pull + startup time — readiness tez rakho'],
        yaml: `strategy:
  type: Recreate`,
        example: 'Jenkins (RWO PVC) ka upgrade — 30s downtime acceptable.', level: 'deploy',
      },
      canary: {
        leaf: true, pick: 'Canary (metric-gated ramp)', icon: '🐤',
        one: 'Naya version pehle 5–10% traffic par; metrics theek → dheere 100%; kharab → auto abort.',
        why: 'Risk zyada hai — blast radius chhota rakhna hai.',
        when: ['Payment/checkout jaise critical flows', 'Performance-sensitive changes', 'AnalysisTemplate se error-rate/latency gates'],
        avoid: ['Chhoti services jahan metrics hi nahi — canary andha hai'],
        gotchas: ['Traffic % ke liye traffic router (Istio, Gateway API, ALB) chahiye — warna pod-count ratio', 'Analysis queries pehle se test karo', 'Sticky sessions canary bigaad sakte hain'],
        yaml: `apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: pricing }
spec:
  # replicas, selector, template — bilkul Deployment jaise (yahan chhota rakha hai)
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis: { templates: [{ templateName: error-rate }] }
        - setWeight: 50
        - pause: { duration: 10m }`,
        example: 'Naya pricing engine: 10% traffic, 5xx > 1% par auto-abort.', level: 'argorollouts',
      },
      bluegreen: {
        leaf: true, pick: 'Blue-Green (traffic switch)', icon: '🔵🟢',
        one: 'Naya version poora alag (preview) — test ke baad traffic ek jhatke mein switch; wapsi bhi ek jhatke mein.',
        why: 'Instant switch + instant rollback chahiye, aur kuch der 2x capacity afford hai.',
        when: ['Release ko pehle preview URL par smoke test', 'Rollback seconds mein chahiye'],
        avoid: ['Capacity/cost tight — 2x pods', 'Gradual exposure chahiye → canary'],
        gotchas: ['DB ek hi hai — schema dono versions ke liye compatible hona chahiye', 'Long-lived connections switch ke baad bhi purane version par'],
        yaml: `strategy:
  blueGreen:
    activeService: shop-active
    previewService: shop-preview
    autoPromotionEnabled: false   # smoke test ke baad manual promote`,
        example: 'Big-bang release: preview par QA, phir 1 click mein 100% switch.', level: 'argorollouts',
      },
      flags: {
        leaf: true, pick: 'Feature flags (release gate)', icon: '🚩',
        one: 'Code deploy ho jaata hai, feature config/flag se on — per user/% ke hisaab se.',
        why: 'Release ko deploy se alag karna hai, instant kill-switch chahiye.',
        when: ['Dark launches, beta users, A/B tests', 'Trunk-based development (adhoora feature main mein, band)'],
        avoid: ['Infra/runtime changes (naya JVM, library) — flag se nahi bachte → canary'],
        gotchas: ['Flag debt: purane flags hatao', 'Flag service down → safe default'],
        yaml: `# app code:
if flags.enabled("new-checkout", user):
    return new_checkout(cart)
return old_checkout(cart)`,
        example: 'New checkout pehle sirf employees, phir 5% users, phir sab — bina naye deploy ke.',
      },
    },
    compare: {
      cols: ['', 'Rolling', 'Recreate', 'Blue-Green', 'Canary', 'Feature flag'],
      rows: [
        ['Downtime', 'Nahi', 'Haan', 'Nahi', 'Nahi', 'Nahi'],
        ['Extra capacity', 'thodi (surge)', 'nahi', '2x', 'thodi', 'nahi'],
        ['Rollback speed', 'minutes', 'minutes', 'seconds', 'seconds (abort)', 'seconds (flag off)'],
        ['Blast radius', 'sab (dheere)', 'sab', 'sab (switch par)', '% users', 'chuninda users'],
      ],
    },
    scenarios: [
      { s: 'Roz ke chhote bug fixes, stateless API, downtime mana.', answer: 'rolling', explain: 'Normal risk, compatible → RollingUpdate (maxUnavailable 0 + readiness).' },
      { s: 'DB schema ka breaking change; maintenance window mili hai.', answer: 'recreate', explain: 'Do versions saath nahi chal sakte → Recreate (ya expand/contract migration se compatible banao).' },
      { s: 'Naya recommendation engine — pehle 10% traffic par error rate dekhna hai, kharab ho toh auto-wapas.', answer: 'canary', explain: 'Risky + metrics gate → Canary with analysis.' },
      { s: 'Release ko pehle preview URL par QA karna hai, phir ek click mein switch aur ek click mein wapsi.', answer: 'bluegreen', explain: 'Instant switch/rollback → Blue-Green (2x capacity).' },
      { s: 'Naya checkout sirf beta users ko dikhana hai, baaki ko purana — bina alag deploy ke.', answer: 'flags', explain: 'Feature-level control → feature flags (deploy ≠ release).' },
    ],
  },
]);

KG.registerDecisions([

  /* ================= 9. PACKAGING ================= */
  {
    id: 'packaging', icon: '📦',
    title: 'YAML ka intezaam — plain YAML, Kustomize, Helm, Helm+Kustomize ya Operator?',
    short: 'Manifests kaise manage karein?',
    tldr: 'Ek environment → plain YAML. Kai environments, apna app, chhote farak → <b>Kustomize</b>. Doosron ko distribute karna / bhaari parametrization / third-party software → <b>Helm</b>. Day-2 operations (backup, failover) ka automation → <b>Operator</b>.',
    levels: ['helm', 'helmbasics', 'operators'], labs: ['15-helm'],
    start: 'thirdparty',
    nodes: {
      thirdparty: {
        q: 'Software <b>tumhara apna</b> hai, ya <b>third-party</b> (Prometheus, cert-manager, ingress controller)?',
        why: 'Third-party software aksar official Helm chart ke saath aata hai — use dobara likhna faltu. Apne app ke liye tum format chunte ho.',
        options: [{ t: 'Third-party', next: 'patch' }, { t: 'Apna app', next: 'envs' }],
      },
      patch: {
        q: 'Chart ki values mein jo chahiye sab mil jaata hai, ya kuch <b>patch</b> karna padta hai jo values expose nahi karti?',
        why: 'Helm chart sirf wahi badalne deta hai jo values.yaml mein hai. Uske bahar (extra label, sidecar, securityContext) → Kustomize se render ke baad patch.',
        options: [{ t: 'Values kaafi hain', next: 'helm' }, { t: 'Patch chahiye (values mein option nahi)', next: 'helmkust' }],
      },
      envs: {
        q: 'Kitne <b>environments/variants</b> hain aur farak kitna hai?',
        why: 'Ek hi env mein abstraction ka koi fayda nahi. Kai envs ke chhote farak (replicas, image tag, resources) Kustomize overlays mein saaf dikhte hain. Bahut zyada knobs ya doosron ko dena → Helm.',
        options: [
          { t: 'Ek hi environment, simple', next: 'plain' },
          { t: 'Kai envs (dev/stage/prod), chhote farak', next: 'kustomize' },
          { t: 'Bahut saare knobs / doosri teams ko as product dena', next: 'helm' },
          { t: 'App ko chalana mushkil hai (backup, failover, upgrades ka logic)', next: 'operator' },
        ],
      },
      plain: {
        leaf: true, pick: 'Plain YAML (direct manifests)', icon: '📄',
        one: 'Seedhe manifests — koi templating nahi.',
        why: 'Ek environment, simple app — abstraction sirf bojh hai.',
        when: ['Chhote apps, internal tools, learning', 'GitOps repo mein seedhe manifests'],
        avoid: ['Copy-paste se kai envs — drift shuru → Kustomize'],
        gotchas: ['<code>kubectl apply -f dir/</code> se prune nahi hota — GitOps tool ya <code>--prune</code> (savdhaani se)'],
        yaml: `kubectl apply -f k8s/`,
        example: 'Team ka internal dashboard — 3 YAML files, ek cluster.', level: 'helm',
      },
      kustomize: {
        leaf: true, pick: 'Kustomize (base + overlays)', icon: '🧩',
        one: 'Ek base, har env ka overlay patch — koi template language nahi, sab valid YAML.',
        why: 'Apna app, kai envs, chhote farak.',
        when: ['dev/stage/prod overlays (replicas, image, resources)', 'configMapGenerator (hash suffix → config change par auto rollout)', 'kubectl/ArgoCD/Flux mein built-in'],
        avoid: ['Bahut saare knobs / doosron ko distribute → Helm'],
        gotchas: ['Patches ka order aur strategic-merge vs JSON6902 samjho', 'Overlay mein base ko "bhool" ke copy mat karo'],
        yaml: `# overlays/prod/kustomization.yaml
resources: ["../../base"]
images:
  - { name: shop, newTag: "2.5.0" }
patches:
  - path: replicas.yaml
configMapGenerator:
  - { name: shop-config, literals: ["LOG_LEVEL=warn"] }`,
        example: 'shop: ek base, teen overlays — prod mein 10 replicas aur warn logs.', level: 'helm',
      },
      helm: {
        leaf: true, pick: 'Helm (chart + values files)', icon: '⛵',
        one: 'Templates + values + release history (install/upgrade/rollback).',
        why: 'Bahut knobs, distribution, ya third-party jiska official chart hai.',
        when: ['Third-party software (official charts)', 'Platform team ka "golden" chart jo kai teams use karein', 'Release lifecycle: hooks, tests, rollback'],
        avoid: ['Ek simple app, ek env — template ka bojh', 'Values ke bahar patch → Helm + Kustomize'],
        gotchas: ['Config <code>-f</code> files mein, <code>--set</code> sirf CI ke image tag ke liye', 'Galat values key = chupchaap khaali — <code>required</code> + <code>values.schema.json</code>', 'Chart version pin karo'],
        yaml: `helm upgrade --install shop ./charts/shop \\
  -n shop --create-namespace \\
  -f values-prod.yaml --set image.tag=$GIT_SHA --atomic`,
        example: 'cert-manager, kube-prometheus-stack — official charts, values se tuned.', level: 'helmbasics', lab: '15-helm',
      },
      helmkust: {
        leaf: true, pick: 'Helm + Kustomize (post-patch)', icon: '🧪',
        one: 'Chart render karo, phir Kustomize se woh patch lagao jo values nahi deti.',
        why: 'Third-party chart chahiye par ek-do cheezein values se bahar badalni hain.',
        when: ['Extra labels/annotations, sidecar, securityContext jo chart expose nahi karta', 'Kustomize <code>helmCharts:</code> field ya Helm <code>--post-renderer</code>'],
        avoid: ['Chart fork karna — har upgrade par merge ka dard'],
        gotchas: ['Kustomize mein helmCharts ke liye <code>--enable-helm</code> flag', 'Upgrade par patch target ka naam badla toh patch chupchaap fail'],
        yaml: `# kustomization.yaml
helmCharts:
  - name: vendor-app
    repo: https://charts.example.com
    version: 1.2.3
    releaseName: edge
    valuesFile: values.yaml
patches:
  - path: add-sidecar.yaml`,
        example: 'Vendor chart mein securityContext ka option nahi tha — Kustomize patch se lagaya, fork nahi kiya.', level: 'helm',
      },
      operator: {
        leaf: true, pick: 'Operator (CRD + controller)', icon: '🤖',
        one: 'App chalane ka "insaani knowledge" code mein — backup, failover, upgrade apne-aap.',
        why: 'Problem install karna nahi, chalana (day-2) hai.',
        when: ['Databases (CloudNativePG, Strimzi Kafka), Prometheus Operator', 'Jahan state-aware operations chahiye'],
        avoid: ['Stateless app ke liye apna operator likhna — Helm/Kustomize kaafi'],
        gotchas: ['Operator khud ek critical dependency — uska upgrade/HA plan karo', 'Uninstall order: pehle CRs (cleanup), phir operator (warna finalizers atkenge)'],
        yaml: `apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata: { name: orders-db }
spec:
  instances: 3
  storage: { size: 20Gi }
  backup: { barmanObjectStore: { destinationPath: s3://backups/orders } }`,
        example: 'CloudNativePG: primary gira → operator ne replica ko promote kiya, backups apne-aap.', level: 'operators', lab: '14-finalizers',
      },
    },
    compare: {
      cols: ['', 'Plain YAML', 'Kustomize', 'Helm', 'Operator'],
      rows: [
        ['Kab', '1 env, simple', 'Kai envs, apna app', 'Distribution / third-party', 'Day-2 ops automation'],
        ['Templating', 'Nahi', 'Patches (valid YAML)', 'Go templates', 'Controller code'],
        ['Release history', 'Nahi', 'Nahi (git)', 'Haan (rollback)', 'CR status'],
        ['Seekhne mein', 'Aasaan', 'Aasaan-medium', 'Medium', 'Mushkil (likhna)'],
      ],
    },
    scenarios: [
      { s: 'Tumhara apna shop app, dev/staging/prod mein sirf replicas, image tag, resources ka farak.', answer: 'kustomize', explain: 'Apna app + kai envs + chhote farak → Kustomize overlays.' },
      { s: 'cert-manager install karna hai — official chart hai, values se sab ho jaata hai.', answer: 'helm', explain: 'Third-party + values kaafi → official Helm chart.' },
      { s: 'Vendor chart use karna hai par usme pods par ek extra sidecar chahiye jiska values option nahi.', answer: 'helmkust', explain: 'Values ke bahar patch → Helm render + Kustomize patch (fork mat karo).' },
      { s: 'Postgres chalana hai: automatic failover, scheduled backups, minor upgrades.', answer: 'operator', explain: 'Day-2 operations → Operator (CloudNativePG jaisa).' },
      { s: 'Ek internal tool, ek hi cluster, 3 YAML files.', answer: 'plain', explain: 'Abstraction ka koi fayda nahi → plain YAML.' },
      { s: 'Platform team 40 microservice teams ko ek standard "web-service" chart dena chahti hai.', answer: 'helm', explain: 'Distribution + bahut knobs → Helm chart (versioned, OCI registry).' },
    ],
  },

  /* ================= 10. GITOPS STRUCTURE ================= */
  {
    id: 'gitops', icon: '🔄',
    title: 'ArgoCD mein apps kaise rakhein — single Application, App-of-Apps ya ApplicationSet?',
    short: 'GitOps structure',
    tldr: 'Ek-do apps → seedhe Applications. Ek cluster ke bahut saare apps ko ek jagah se bootstrap → <b>App-of-Apps</b>. Wahi app <b>kai clusters/envs/teams</b> mein template se → <b>ApplicationSet</b>.',
    levels: ['gitops', 'argobasics', 'argoscale'], labs: [],
    start: 'needgitops',
    nodes: {
      needgitops: {
        q: 'Cluster <b>shared/production</b> hai (kai log, audit chahiye), ya sirf tumhara <b>local/dev</b> playground?',
        why: 'GitOps ka fayda: git = single source of truth, audit, drift auto-fix. Ek insaan ke local cluster par yeh overhead hai.',
        options: [{ t: 'Shared / production', next: 'count' }, { t: 'Sirf local / personal dev', next: 'nogitops' }],
      },
      count: {
        q: 'Kitne apps aur kitne clusters?',
        why: 'Har app ke liye ek Application YAML haath se likhna 3 apps tak theek hai. 30 apps ya 10 clusters par yeh copy-paste drift banta hai — generator chahiye.',
        options: [
          { t: '1–3 apps, ek-do clusters', next: 'single' },
          { t: 'Ek cluster, bahut saare apps — sab ek jagah se bootstrap', next: 'appofapps' },
          { t: 'Wahi app(s) kai clusters / envs / tenants mein', next: 'appset' },
        ],
      },
      single: {
        leaf: true, pick: 'Application (direct app spec)', icon: '📌',
        one: 'Har app ka ek Application: repo + path + destination + sync policy.',
        why: 'Gine-chune apps — seedha, padhne mein aasaan.',
        when: ['Chhote setups', 'Shuruaat — baad mein App-of-Apps mein wrap kar sakte ho'],
        avoid: ['Kai clusters mein copy-paste → ApplicationSet'],
        gotchas: ['Prod mein <code>automated: { prune: true, selfHeal: true }</code> socho — bina selfHeal ke manual drift rehta hai', 'Rollback = <code>git revert</code> (auto-sync ke saath <code>argocd app rollback</code> nahi chalta)'],
        yaml: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: shop, namespace: argocd }
spec:
  project: team-shop
  source: { repoURL: https://github.com/acme/deploy, path: shop/prod, targetRevision: main }
  destination: { server: https://kubernetes.default.svc, namespace: shop }
  syncPolicy: { automated: { prune: true, selfHeal: true } }`,
        example: 'Ek team, ek prod cluster, 2 apps.', level: 'argobasics',
      },
      appofapps: {
        leaf: true, pick: 'App-of-Apps (bootstrap tree)', icon: '🌳',
        one: 'Ek "root" Application jo ek folder ki saari Application YAMLs ko sync karta hai.',
        why: 'Ek cluster ke bahut apps — ek jagah se bootstrap aur manage.',
        when: ['Naya cluster: root app apply karo → saare add-ons + apps aa jaate hain', 'Platform add-ons (cert-manager, monitoring, ingress) ka bundle'],
        avoid: ['Wahi cheez kai clusters mein → ApplicationSet (App-of-Apps mein copy-paste badhta hai)'],
        gotchas: ['Child apps ka sync order → sync waves', 'Root app delete = cascade se children delete (finalizer) — savdhaan'],
        yaml: `# root.yaml → path: apps/  (us folder mein har child ki Application YAML)
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: root, namespace: argocd }
spec:
  project: default               # required — production mein apna AppProject (allowed repos/namespaces)
  source: { repoURL: https://github.com/acme/platform, path: apps, targetRevision: main }
  destination: { server: https://kubernetes.default.svc, namespace: argocd }
  syncPolicy: { automated: { prune: true, selfHeal: true } }`,
        example: 'Naya cluster 10 minute mein ready: root app → 15 platform add-ons.', level: 'argoscale',
      },
      appset: {
        leaf: true, pick: 'ApplicationSet (generators)', icon: '🏭',
        one: 'Ek template + generator (list/cluster/git) → bahut saare Applications apne-aap.',
        why: 'Wahi app kai clusters/envs/tenants mein — copy-paste nahi, template.',
        when: ['Cluster generator: har naye cluster par apne-aap app', 'Git directory generator: repo mein folder = app', 'Matrix: clusters × apps'],
        avoid: ['2-3 fixed apps — overkill'],
        gotchas: ['Generated Applications ko haath se mat badlo — controller wapas likh dega; generator/template badlo', 'Delete policy: AppSet hatane par generated apps bhi ja sakte hain — <code>preserveResourcesOnDeletion</code> socho'],
        yaml: `apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: { name: shop, namespace: argocd }
spec:
  generators:
    - clusters: { selector: { matchLabels: { env: prod } } }
  template:
    metadata: { name: 'shop-{{name}}' }
    spec:
      project: team-shop
      source: { repoURL: https://github.com/acme/deploy, path: shop/prod, targetRevision: main }
      destination: { server: '{{server}}', namespace: shop }`,
        example: '12 regional prod clusters — naya cluster label hua, shop apne-aap deploy.', level: 'argoscale',
      },
      nogitops: {
        leaf: true, pick: 'kubectl / Helm (manual ops)', icon: '🧪',
        one: 'Personal/local cluster par seedha apply — GitOps ka setup overhead mat lo.',
        why: 'Akela insaan, local experiment — audit/drift ki problem hi nahi.',
        when: ['kind/minikube par seekhna (jaise real-labs!)', 'Throwaway experiments'],
        avoid: ['Shared/prod cluster — wahan laptop se kubectl apply = drift + no audit'],
        gotchas: ['Jo YAML kaam kare use git mein daal do — baad mein GitOps mein le jaana aasaan'],
        yaml: `kubectl apply -k overlays/dev
# ya: helm upgrade --install demo ./chart -f values-dev.yaml`,
        example: 'Weekend experiment: kind cluster par naya operator try karna.',
      },
    },
    compare: {
      cols: ['', 'Single App', 'App-of-Apps', 'ApplicationSet'],
      rows: [
        ['Scale', '1–3 apps', 'Ek cluster, bahut apps', 'Kai clusters/envs/tenants'],
        ['Kaise banta', 'Haath se YAML', 'Root app folder sync karta', 'Generator + template'],
        ['Naya cluster aaya', 'Naya YAML likho', 'Naya root apply', 'Label lagao — apne-aap'],
      ],
    },
    scenarios: [
      { s: 'Naye prod cluster par 15 platform add-ons ek command se aane chahiye.', answer: 'appofapps', explain: 'Ek cluster, bahut apps, bootstrap → App-of-Apps root.' },
      { s: 'shop service 12 regional clusters mein; naya cluster aaye toh apne-aap deploy.', answer: 'appset', explain: 'Kai clusters + template → ApplicationSet cluster generator.' },
      { s: 'Ek team, ek prod cluster, 2 services.', answer: 'single', explain: 'Gine-chune apps → seedhe Applications.' },
      { s: 'Tum kind par weekend mein ek operator try kar rahe ho.', answer: 'nogitops', explain: 'Personal throwaway → kubectl/helm; GitOps overhead faltu.' },
      { s: 'Monorepo mein har folder ek app hai; naya folder = naya app apne-aap.', answer: 'appset', explain: 'Git directory generator wala ApplicationSet.' },
    ],
  },

  /* ================= 11. RBAC ================= */
  {
    id: 'rbac', icon: '🔑',
    title: 'Access kaise dein — Role/RoleBinding, ClusterRole, built-in roles ya token hi nahi?',
    short: 'RBAC combo',
    tldr: 'Pehle <b>kaun</b> (insaan ya app)? Phir <b>kahan</b> (ek namespace, kai, ya poora cluster/cluster-scoped resources)? Hamesha <b>kam se kam</b> verbs — aur app ko API chahiye hi nahi toh token mount hi mat karo.',
    levels: ['rbac'], labs: ['08-rbac'],
    start: 'who',
    nodes: {
      who: {
        q: 'Access <b>kisko</b> chahiye?',
        why: 'Insaanon ko aksar built-in roles (view/edit/admin) groups ke through. Apps (ServiceAccounts) ko custom, chhote roles.',
        options: [{ t: 'App / pod (ServiceAccount)', next: 'needapi' }, { t: 'Insaan (developer / SRE)', next: 'human' }],
      },
      needapi: {
        q: 'Kya app ko <b>Kubernetes API se baat</b> karni bhi hai?',
        why: 'Zyada-tar apps K8s API kabhi nahi chhoote. Phir bhi har pod mein token mount hota hai — compromise hone par attacker ka pehla hathiyaar.',
        options: [{ t: 'Nahi — normal web/API app', next: 'notoken' }, { t: 'Haan — pods/configmaps/nodes padhta/likhta hai', next: 'scope' }],
      },
      scope: {
        q: 'Kya chahiye — <b>ek namespace</b> ke resources, <b>kai namespaces</b> mein same permission, ya <b>cluster-scoped</b> cheezein (nodes, PVs, namespaces)?',
        why: 'Role namespace tak seemit hai. ClusterRole + RoleBinding = reusable role, phir bhi namespace tak seemit. Cluster-scoped resources sirf ClusterRole + ClusterRoleBinding se.',
        options: [
          { t: 'Sirf apna namespace', next: 'rolerb' },
          { t: 'Kai (chuninda) namespaces — same permissions', next: 'crolerb' },
          { t: 'Cluster-scoped (nodes, PVs, namespaces) ya saare namespaces', next: 'crolecrb' },
        ],
      },
      human: {
        q: 'Insaan ko <b>kitna</b> access chahiye?',
        why: 'Built-in ClusterRoles (view/edit/admin) achhi tarah soche hue hain — unhe RoleBinding se namespace tak seemit karo. cluster-admin sirf emergency (break-glass).',
        options: [{ t: 'Namespace mein dekhna / deploy karna / poora namespace sambhaalna', next: 'builtin' }, { t: 'Poora cluster (platform emergency)', next: 'breakglass' }],
      },
      notoken: {
        leaf: true, pick: 'ServiceAccount (token disabled)', icon: '🚫',
        one: 'Koi permission nahi, aur token mount hi nahi.',
        why: 'App ko API ki zaroorat hi nahi — token sirf attack surface hai.',
        when: ['Normal web/API/worker apps (90%!)'],
        avoid: ['Default ServiceAccount par permissions jodna — namespace ke saare pods ko mil jaati hain'],
        gotchas: ['Har app ka apna SA (audit + baad mein IRSA/Workload Identity ke liye)'],
        yaml: `apiVersion: v1
kind: ServiceAccount
metadata: { name: web }
automountServiceAccountToken: false
# Use: Deployment ke pod template (spec.template.spec) mein →
#   serviceAccountName: web`,
        example: 'Checkout pod compromise hua — par token tha hi nahi, cluster API tak raasta band.', level: 'rbac',
      },
      rolerb: {
        leaf: true, pick: 'Role + RoleBinding (namespace)', icon: '🏠',
        one: 'Ek namespace ke andar, sirf zaroori verbs/resources.',
        why: 'App ko sirf apne namespace ki cheezein chahiye.',
        when: ['Controller jo apne namespace ke pods/configmaps padhe', 'Leader election (leases)'],
        avoid: ['Cluster-scoped resources (nodes) — Role unhe de hi nahi sakta'],
        gotchas: ['Binding ke subject mein SA ka <b>namespace</b> sahi likho (common bug)', '<code>kubectl auth can-i --as=system:serviceaccount:ns:sa</code> se test'],
        yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: pod-reader, namespace: shop }
rules:
  - { apiGroups: [""], resources: ["pods"], verbs: ["get", "list", "watch"] }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: reporter-pod-reader, namespace: shop }
subjects: [{ kind: ServiceAccount, name: reporter, namespace: shop }]
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: Role, name: pod-reader }`,
        example: 'Reporter bot apne namespace ke pods list karta hai.', level: 'rbac', lab: '08-rbac',
      },
      crolerb: {
        leaf: true, pick: 'ClusterRole + RoleBinding (NS)', icon: '♻️',
        one: 'Role ek baar (cluster-wide definition), binding har namespace mein alag — asar sirf wahin.',
        why: 'Same permission kai namespaces mein — Role copy-paste nahi.',
        when: ['CI deployer jo 5 team namespaces mein deploy kare', 'Reusable custom roles'],
        avoid: ['ClusterRoleBinding — woh SAARE namespaces khol deta'],
        gotchas: ['ClusterRole + RoleBinding mein bhi cluster-scoped resources grant NAHI hote'],
        yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: ci-deployer, namespace: team-a }
subjects: [{ kind: ServiceAccount, name: ci, namespace: ci }]
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: deployer }`,
        example: 'Ek "deployer" ClusterRole, 5 RoleBindings (har team namespace mein ek).', level: 'rbac',
      },
      crolecrb: {
        leaf: true, pick: 'ClusterRole + ClusterRoleBinding', icon: '🌐',
        one: 'Poore cluster mein — cluster-scoped resources ya saare namespaces.',
        why: 'Nodes/PVs/namespaces jaise cluster-scoped resources, ya sach mein cluster-wide controller.',
        when: ['Node readers (monitoring, autoscalers)', 'Cluster-wide operators'],
        avoid: ['Namespace ka kaam ClusterRoleBinding se — least privilege tootta hai'],
        gotchas: ['Verbs chhote rakho (get/list/watch); <code>*</code> kabhi nahi', 'Namespace delete karne se yeh objects nahi hatte — cleanup alag'],
        yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: node-reader }
rules:
  - { apiGroups: [""], resources: ["nodes"], verbs: ["get", "list", "watch"] }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: { name: auditor-node-reader }
subjects: [{ kind: ServiceAccount, name: auditor, namespace: security }]
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: node-reader }`,
        example: 'Security auditor saare nodes list karta hai (par secrets nahi!).', level: 'rbac', lab: '08-rbac',
      },
      builtin: {
        leaf: true, pick: 'Built-in role + Group binding', icon: '👥',
        one: 'Kubernetes ke soche-samjhe roles — group (SSO/OIDC) ko namespace mein bind.',
        why: 'Insaanon ke liye custom roles maintain karna mushkil — built-ins kaafi hain.',
        when: ['<code>view</code>: read-only (secrets nahi)', '<code>edit</code>: deploy kar sakte, RBAC nahi badal sakte', '<code>admin</code>: namespace ka malik (RBAC bhi)'],
        avoid: ['Individual users ko bind karna — groups use karo (joiner/leaver aasaan)'],
        gotchas: ['<code>edit</code> secrets padh sakta hai (aur pods exec) — prod mein soch ke do'],
        yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: team-a-devs, namespace: team-a }
subjects: [{ kind: Group, name: team-a-developers, apiGroup: rbac.authorization.k8s.io }]
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: edit }`,
        example: 'team-a-developers SSO group ko team-a namespace mein edit.', level: 'rbac',
      },
      breakglass: {
        leaf: true, pick: 'cluster-admin (break-glass only)', icon: '🚨',
        one: 'Poora cluster — sirf emergency, time-bound, audited.',
        why: 'Platform emergencies mein kabhi-kabhi sab chahiye — par roz ke kaam ke liye kabhi nahi.',
        when: ['Incident ke time, approval ke saath, kuch ghanton ke liye'],
        avoid: ['Developers/CI ko permanent cluster-admin — ek galti = poora cluster'],
        gotchas: ['Audit logs on rakho', 'Just-in-time access (approval workflow) tools'],
        yaml: `# permanent binding nahi — JIT tool se temporary:
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: { name: oncall-breakglass-2026-10-22 }
subjects: [{ kind: User, name: oncall@acme.com, apiGroup: rbac.authorization.k8s.io }]
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: cluster-admin }`,
        example: 'etcd incident mein on-call ko 2 ghante ka cluster-admin, phir auto-revoke.', level: 'rbac',
      },
    },
    compare: {
      cols: ['', 'Role+RB', 'ClusterRole+RB', 'ClusterRole+CRB'],
      rows: [
        ['Asar', 'Ek namespace', 'Binding ka namespace', 'Poora cluster'],
        ['Cluster-scoped (nodes)', '❌', '❌', '✅'],
        ['Reuse', 'Har ns mein copy', 'Ek role, kai bindings', '—'],
      ],
    },
    scenarios: [
      { s: 'Normal checkout web app — K8s API ko kabhi call nahi karta.', answer: 'notoken', explain: 'Dedicated SA + automountServiceAccountToken: false.' },
      { s: 'Bot ko apne namespace ke pods list karne hain.', answer: 'rolerb', explain: 'Namespace-scoped, chhote verbs → Role + RoleBinding.' },
      { s: 'Monitoring agent ko saare nodes ki list chahiye.', answer: 'crolecrb', explain: 'Nodes cluster-scoped → ClusterRole + ClusterRoleBinding.' },
      { s: 'CI ko 6 team namespaces mein deploy karna hai, same permissions.', answer: 'crolerb', explain: 'Ek ClusterRole, har namespace mein RoleBinding.' },
      { s: 'Developers ke SSO group ko apne namespace mein deploy karna hai.', answer: 'builtin', explain: 'Built-in edit + RoleBinding to Group.' },
      { s: 'Raat 3 baje etcd incident — on-call ko kuch ghanton ke liye sab chahiye.', answer: 'breakglass', explain: 'Time-bound, audited cluster-admin (break-glass).' },
    ],
  },

  /* ================= 12. RESOURCES & QoS ================= */
  {
    id: 'resources', icon: '⚖️',
    title: 'Requests/limits kaise set karein — Guaranteed, "memory = limit", Burstable ya BestEffort?',
    short: 'Resources strategy',
    tldr: '<b>Memory</b>: request = limit (memory wapas nahi li ja sakti — sirf kill). <b>CPU</b>: request zaroor; limit sirf tab jab throttling chalegi ya isolation chahiye. Requests <b>naap ke</b> (VPA/metrics), andaaze se nahi.',
    levels: ['scheduler'], labs: ['01-crashloop-oom', '06-quota-qos'],
    start: 'prod',
    nodes: {
      prod: {
        q: 'Workload kis tarah ka hai?',
        why: 'Har class ka trade-off alag: predictability vs utilization vs cost.',
        options: [
          { t: 'Production service, latency-sensitive', next: 'pinning' },
          { t: 'Batch / background — slow ya evict ho jaaye toh chalega', next: 'burstable' },
          { t: 'Throwaway dev/test pod', next: 'besteffort' },
        ],
      },
      pinning: {
        q: 'Kya <b>exclusive CPU cores</b> / poori tarah predictable CPU chahiye? (trading, gaming, real-time, CPU pinning)',
        why: 'Guaranteed QoS (cpu+memory request = limit) static CPU manager ke saath exclusive cores deta hai — par CPU limit = throttling ka khatra. Normal services ke liye memory = limit + CPU request (bina limit) zyada practical hai.',
        options: [{ t: 'Haan — exclusive / strict predictability', next: 'guaranteed' }, { t: 'Nahi — normal service', next: 'memeq' }],
      },
      guaranteed: {
        leaf: true, pick: 'Guaranteed (cpu + memory: request = limit)', icon: '🏆',
        one: 'Sabse predictable; memory pressure mein sabse aakhir mein evict.',
        why: 'Strict predictability / CPU pinning chahiye.',
        when: ['Low-latency trading, real-time, game servers', 'Static CPU manager (integer CPUs) ke saath exclusive cores'],
        avoid: ['Bursty services — CPU limit par throttling = latency spikes'],
        gotchas: ['Har container (init bhi) mein cpu+memory request = limit, warna Burstable', 'Integer CPU (2, 4) + static CPU manager policy = exclusive cores'],
        yaml: `resources:
  requests: { cpu: "2", memory: 4Gi }
  limits:   { cpu: "2", memory: 4Gi }`,
        example: 'Matching engine pod: 4 exclusive cores, kabhi throttle nahi (cores apne hain).', level: 'scheduler',
      },
      memeq: {
        leaf: true, pick: 'Memory request = limit, CPU sirf request', icon: '✅',
        one: 'Memory ka koi surprise nahi; CPU free cycles mein burst kar sake (no throttling).',
        why: 'Normal production service — stable memory, flexible CPU.',
        when: ['Zyada-tar production APIs/services', 'Bursty CPU (startup, traffic spikes)'],
        avoid: ['Noisy multi-tenant nodes jahan CPU isolation zaroori — tab CPU limit bhi'],
        gotchas: ['QoS Burstable dikhega (Guaranteed nahi) — theek hai', 'CPU request asli usage ke hisaab se (HPA isi ka % padhta hai)', 'Memory limit = <b>peak</b> + margin (startup spikes!)'],
        yaml: `resources:
  requests: { cpu: 250m, memory: 512Mi }
  limits:   { memory: 512Mi }        # CPU limit nahi`,
        example: 'Checkout API: 250m CPU request, 512Mi memory request=limit; sale par CPU burst bina throttle.', level: 'scheduler', lab: '01-crashloop-oom',
      },
      burstable: {
        leaf: true, pick: 'Burstable (requests < limits)', icon: '🎈',
        one: 'Chhoti guarantee, zyada burst — node par zyada pods pack.',
        why: 'Background kaam jo slow ya evict hona bardasht kar le.',
        when: ['Batch jobs, CI runners, analytics', 'Cost optimization (overcommit)'],
        avoid: ['Critical services — memory pressure mein pehle (BestEffort ke baad) evict'],
        gotchas: ['Memory limit >> request = node overcommit → node-level OOM ka risk', 'PriorityClass low rakho'],
        yaml: `resources:
  requests: { cpu: 100m, memory: 256Mi }
  limits:   { cpu: "1",  memory: 1Gi }`,
        example: 'Nightly report workers — jagah mili toh tez, nahi toh dheere.', level: 'scheduler', lab: '06-quota-qos',
      },
      besteffort: {
        leaf: true, pick: 'BestEffort (kuch nahi) — sirf dev', icon: '🎲',
        one: 'Koi guarantee nahi — memory pressure mein sabse pehle evict.',
        why: 'Throwaway pod.',
        when: ['Debug pods, local experiments'],
        avoid: ['Production — kabhi nahi', 'Quota wale namespaces mein reject hoga (LimitRange defaults se bachao)'],
        gotchas: ['Scheduler ise "0 jagah" maanta hai → node overpack'],
        yaml: `# resources: {}  (kuch nahi)
kubectl run debug --image=busybox:1.36 -it --rm -- sh`,
        example: 'Ek minute ka debug pod.', level: 'scheduler',
      },
    },
    compare: {
      cols: ['', 'Guaranteed', 'Mem=limit, CPU req', 'Burstable', 'BestEffort'],
      rows: [
        ['QoS class', 'Guaranteed', 'Burstable', 'Burstable', 'BestEffort'],
        ['Eviction order', 'Aakhri', 'Beech', 'Beech (pehle)', 'Sabse pehle'],
        ['CPU throttling', 'Haan (limit)', 'Nahi', 'Limit par', 'Nahi'],
        ['Kab', 'Real-time / pinning', 'Default prod', 'Batch', 'Dev'],
      ],
    },
    scenarios: [
      { s: 'Normal checkout API, sale par CPU spikes aate hain, latency important.', answer: 'memeq', explain: 'Memory request=limit, CPU sirf request → burst bina throttling.' },
      { s: 'Stock-trading matching engine ko exclusive cores chahiye.', answer: 'guaranteed', explain: 'Strict predictability + CPU pinning → Guaranteed (integer CPUs).' },
      { s: 'Nightly analytics workers — slow ho jaayein ya evict ho jaayein toh dobara chal jaayenge.', answer: 'burstable', explain: 'Background + overcommit → Burstable, low priority.' },
      { s: 'Ek minute ka debug busybox pod.', answer: 'besteffort', explain: 'Throwaway → BestEffort theek (prod mein kabhi nahi).' },
    ],
  },
]);

KG.registerDecisions([

  /* ================= 13. TROUBLESHOOTING BY STATUS ================= */
  {
    id: 'troubleshoot', icon: '🩺',
    title: 'Pod theek nahi — STATUS dekh ke agla command kaunsa?',
    short: 'Status → agla kadam',
    tldr: '<b>Guess mat karo — status padho.</b> Har status ek alag jagah ki taraf ishaara karta hai: Pending → scheduler/PVC, ImagePull → registry, CrashLoop → exit code + logs, Running-par-not-Ready → probes, Ready-par-fail → Service/DNS/NetworkPolicy.',
    levels: ['kk-toolkit', 'kk-crashloop', 'kk-pending', 'kk-imagepull'], labs: ['01-crashloop-oom', '02-imagepull', '03-probes', '04-service-dns', '05-scheduling', '14-finalizers'],
    start: 'status',
    nodes: {
      status: {
        q: '<code>kubectl get pods</code> mein <b>STATUS</b> kya hai?',
        why: 'STATUS batata hai pod ki zindagi ke kis padaav par atka hai: schedule hona → image aana → container banana → start → ready → serve → delete.',
        options: [
          { t: 'Pending', next: 'pending' },
          { t: 'ContainerCreating (der tak)', next: 'creating' },
          { t: 'ErrImagePull / ImagePullBackOff', next: 'imagepull' },
          { t: 'CreateContainerConfigError', next: 'configerr' },
          { t: 'CrashLoopBackOff / Error', next: 'crash' },
          { t: 'Running par READY 0/1', next: 'notready' },
          { t: 'Running + Ready, par requests fail', next: 'svcpath' },
          { t: 'Terminating (khatam hi nahi hota)', next: 'stuckterm' },
          { t: 'Evicted', next: 'evicted' },
        ],
      },
      pending: {
        q: '<code>kubectl describe pod</code> ke Events mein kya likha hai?',
        why: 'Pending ke do bade ghar: scheduler ko node nahi mila (FailedScheduling), ya pod ki PVC abhi bound nahi hui.',
        options: [
          { t: 'FailedScheduling: "0/N nodes are available: ..."', next: 'pendsched' },
          { t: '"unbound immediate PersistentVolumeClaims" / PVC Pending', next: 'pendpvc' },
        ],
      },
      crash: {
        q: '<code>describe pod</code> → <b>Last State: Terminated</b> — Reason / Exit Code kya hai?',
        why: 'Exit code batata hai kisne maara: app ne khud (1), kernel ne memory par (137 OOMKilled), kubelet ne liveness par (137/143 + events), ya process "kaam khatam" karke nikla (0).',
        options: [
          { t: 'Reason: OOMKilled, Exit Code 137', next: 'oom' },
          { t: 'Reason: Error, Exit Code 1 (ya app ka koi code)', next: 'apperr' },
          { t: 'Reason: Completed, Exit Code 0', next: 'completed' },
          { t: 'Exit 137/143 aur Events mein "Liveness probe failed"', next: 'liveness' },
        ],
      },
      pendsched: {
        leaf: true, pick: 'FailedScheduling: node placement', icon: '🧲',
        one: 'Har node ka reason likha hai: taint, affinity/selector, Insufficient cpu/memory, ya volume node affinity.',
        why: 'Scheduler ko koi node nahi mila.',
        when: ['<code>untolerated taint</code> → toleration (ya galat node pool)', '<code>didn\'t match Pod\'s node affinity/selector</code> → labels check: <code>kubectl get nodes --show-labels</code>', '<code>Insufficient cpu/memory</code> → requests kam karo ya nodes badhao (autoscaler?)', '<code>volume node affinity conflict</code> → disk doosre zone mein hai'],
        avoid: ['Pod ko baar-baar delete karna — wahi spec, wahi Pending'],
        gotchas: ['Har node ka sirf PEHLA fail reason dikhta hai — ek fix ke baad naya reason aa sakta hai', 'Karpenter/CA ho toh unke logs/events bhi dekho'],
        yaml: `kubectl describe pod <pod> | grep -A3 FailedScheduling
kubectl get nodes --show-labels
kubectl describe node <node> | grep -A8 -E "Taints|Allocated"`,
        example: '"0/3 nodes: 1 untolerated taint {dedicated: db}, 2 didn\'t match node selector" → toleration + sahi label.', level: 'kk-pending', lab: '05-scheduling',
      },
      pendpvc: {
        leaf: true, pick: 'Pending PVC: storage binding', icon: '💽',
        one: 'Pod apni PVC ka intezaar kar raha hai.',
        why: 'Volume nahi mila toh pod start nahi ho sakta.',
        when: ['<code>kubectl get pvc</code> → Pending? <code>describe pvc</code> ke events', 'StorageClass galat/missing, provisioner down, quota', '<code>WaitForFirstConsumer</code> SC mein PVC pod schedule hone tak Pending rehti hai (normal!)'],
        avoid: ['PV haath se banana jab dynamic provisioning available ho'],
        gotchas: ['RWX maangi par SC sirf RWO deta hai (EBS) → hamesha Pending'],
        yaml: `kubectl get pvc
kubectl describe pvc <pvc>
kubectl get storageclass`,
        example: 'PVC ne <code>storageClassName: fast-ssd</code> maangi jo cluster mein thi hi nahi.', level: 'storage',
      },
      creating: {
        leaf: true, pick: 'ContainerCreating: setup waiting', icon: '🧱',
        one: 'Node mil gaya, par container banane se pehle kuch atka: volume attach/mount, CNI IP, ya secret/configmap volume.',
        why: 'Yeh kubelet ke paas atka hai — events batayenge kya.',
        when: ['<code>Multi-Attach error</code> → RWO disk abhi purane node par (Deployment: Recreate strategy)', '<code>FailedMount</code> → missing secret/configmap volume ya CSI driver', 'CNI errors → pod network (node par CNI pods dekho)'],
        avoid: ['Logs dekhna — container bana hi nahi, logs nahi milenge'],
        gotchas: ['Image pull bhi isi phase mein — bade images = lamba ContainerCreating (Events: Pulling)'],
        yaml: `kubectl describe pod <pod> | tail -15
kubectl get events --sort-by=.lastTimestamp | tail`,
        example: '"Multi-Attach error for volume pvc-xyz: Volume is already used by pod(s) web-old" → strategy: Recreate.', level: 'kk-createcontainer',
      },
      imagepull: {
        leaf: true, pick: 'ImagePullBackOff: image registry', icon: '📦',
        one: 'Events ka error message wajah batata hai: not found, unauthorized, timeout, platform, rate limit.',
        why: 'Image aayi hi nahi — app tak baat pahunchi hi nahi.',
        when: ['<code>not found</code> → tag/naam typo', '<code>unauthorized</code> → imagePullSecrets', '<code>timeout</code> → node network/proxy', '<code>no match for platform</code> → arch (arm64/amd64)', '<code>429</code> → rate limit (mirror/auth)'],
        avoid: ['App logs dekhna (koi logs nahi honge)'],
        gotchas: ['ImagePullBackOff = backoff (max 5 min) — fix ke baad pod delete karke turant retry'],
        yaml: `kubectl describe pod <pod> | grep -A2 "Failed to pull"`,
        example: '<code>nginx:1.27-alpne: not found</code> → typo.', level: 'kk-imagepull', lab: '02-imagepull',
      },
      configerr: {
        leaf: true, pick: 'ConfigError: Secret/ConfigMap/key', icon: '🗝️',
        one: 'Pod spec kisi ConfigMap/Secret (ya uski key) ko refer karta hai jo hai hi nahi.',
        why: 'Container ka config banane ke liye referenced object chahiye.',
        when: ['<code>configmap "x" not found</code> / <code>secret "y" not found</code>', '<code>couldn\'t find key DB_URL in Secret</code>'],
        avoid: ['Image/registry dekhna — image toh aa gayi'],
        gotchas: ['Order: pehle ConfigMap/Secret apply, phir Deployment (ya sync waves)', 'Optional chahiye toh <code>optional: true</code>'],
        yaml: `kubectl describe pod <pod> | grep -i "not found\\|couldn't find"
kubectl get cm,secret`,
        example: 'ESO ne abhi Secret sync nahi kiya tha — Deployment pehle aa gaya.', level: 'kk-createcontainer',
      },
      oom: {
        leaf: true, pick: 'OOMKilled: memory vs limit', icon: '💥',
        one: 'Container ne memory limit cross ki → kernel ne SIGKILL (137).',
        why: 'Reason saaf likha hai: OOMKilled.',
        when: ['Limit ko <b>peak</b> + margin par set karo (startup spikes!)', 'Memory leak? Usage graph (time ke saath badhta hai?)', 'JVM: heap limit ka ~75% (MaxRAMPercentage)'],
        avoid: ['Limit hata dena — node-level OOM, doosre pods marenge'],
        gotchas: ['<code>kubectl top</code> spikes miss karta hai (snapshots)', 'Memory request = limit rakho'],
        yaml: `kubectl describe pod <pod> | grep -A4 "Last State"
kubectl top pod <pod> --containers`,
        example: 'Cache warm-up ka peak 170Mi, limit 64Mi → 256Mi kiya.', level: 'scheduler', lab: '01-crashloop-oom',
      },
      apperr: {
        leaf: true, pick: 'CrashLoop: app exit / logs', icon: '📜',
        one: 'App ka error (config missing, DB unreachable, bug) — jawab mare hue container ke logs mein.',
        why: 'Exit code 1 = app ka apna faisla.',
        when: ['<code>kubectl logs pod --previous</code>', 'Env/config check: missing env var, galat URL', 'Dependency (DB) reachable hai?'],
        avoid: ['Bina logs padhe restart/delete'],
        gotchas: ['Bina <code>--previous</code> naye container ke (khaali) logs dikhte hain', 'Init container fail? <code>logs pod -c init-name</code>'],
        yaml: `kubectl logs <pod> --previous
kubectl logs <pod> -c <init-container>`,
        example: '"FATAL: DB_URL env var nahi mila" → env var ka naam galat tha.', level: 'kk-crashloop', lab: '01-crashloop-oom',
      },
      completed: {
        leaf: true, pick: 'Completed: exit 0 / controller', icon: '🏁',
        one: 'Deployment chahta hai hamesha chale; process khatam ho gaya → restart → CrashLoop.',
        why: 'Exit 0 = koi crash nahi — galat workload type ya foreground process nahi.',
        when: ['Ek baar ka kaam → Job', 'Server background mein chal gaya (daemon mode) → foreground mein chalao (<code>nginx -g "daemon off;"</code>)', 'Command/args galat — script turant khatam'],
        avoid: ['restartPolicy se ladna — workload type badlo'],
        gotchas: ['<code>sleep</code> lagake "theek" karna = bug chhupana'],
        yaml: `kubectl describe pod <pod> | grep -A3 "Last State"   # Reason: Completed, Exit Code: 0`,
        example: 'Migration script Deployment mein tha → CrashLoop "Completed" → Job banaya.', level: 'kk-crashloop',
      },
      liveness: {
        leaf: true, pick: 'Liveness: probe kills container', icon: '🔪',
        one: 'Kubelet ne liveness fail dekh ke container restart kiya — aksar slow boot ya galat probe.',
        why: 'Events mein "Liveness probe failed ... will be restarted".',
        when: ['Slow boot → startupProbe', 'Probe kisi dependency (DB) par → hatao', 'timeoutSeconds/failureThreshold bahut chhote'],
        avoid: ['initialDelaySeconds ka bada hack — startupProbe saaf hai'],
        gotchas: ['Logs mein koi error nahi hota — app toh boot hi kar raha tha!'],
        yaml: `kubectl describe pod <pod> | grep -E "Liveness|will be restarted"`,
        example: 'Spring app 25s mein boot, liveness 20s mein maar deta → startupProbe.', level: 'probes', lab: '03-probes',
      },
      notready: {
        leaf: true, pick: 'Readiness: traffic gate fails', icon: '🚦',
        one: 'Container chal raha hai par readiness probe fail → Service endpoints se bahar.',
        why: 'Running + 0/1 = readiness ka mamla.',
        when: ['Events: <code>Readiness probe failed: HTTP probe failed with statuscode: 404</code> → galat path/port', 'Dependency check mein slow DB → timeouts', 'App ka readiness endpoint khud bimar'],
        avoid: ['Readiness hata dena — phir bimar pods ko bhi traffic'],
        gotchas: ['Saare pods not-ready = Service ke endpoints khaali = "connection refused"'],
        yaml: `kubectl describe pod <pod> | grep -i "readiness probe failed"
kubectl get endpointslices -l kubernetes.io/service-name=<svc>`,
        example: 'Probe /ready maar raha tha, app /healthz serve karta tha → 404.', level: 'probes', lab: '03-probes',
      },
      svcpath: {
        leaf: true, pick: 'Service path: DNS/endpoints/port', icon: '🛣️',
        one: 'Error message se hop pakdo: "bad address" (DNS), "refused" (endpoints/port), "timeout" (NetworkPolicy/network).',
        why: 'Pod Ready hai, toh problem pod tak ke raaste mein hai.',
        when: ['<code>nslookup svc.ns</code> client pod se', '<code>get endpointslices</code> — khaali? selector!', 'endpoints ka port = container port?', 'Timeout → NetworkPolicy (default-deny?)'],
        avoid: ['Pods restart karna — pods theek hain'],
        gotchas: ['Chhota DNS naam sirf apne namespace mein', 'Policy ka port = container port (Service ka nahi)'],
        yaml: `kubectl exec <client> -- nslookup payments.lab04
kubectl get endpointslices -l kubernetes.io/service-name=payments
kubectl get netpol -n <ns>`,
        example: 'Selector "app: payment" vs label "app: payments" → endpoints khaali.', level: 'kk-netdeep', lab: '04-service-dns',
      },
      stuckterm: {
        leaf: true, pick: 'Terminating: finalizer / node', icon: '⏳',
        one: 'deletionTimestamp laga, par finalizer ka controller cleanup nahi kar raha — ya pod jis node par tha woh unreachable hai.',
        why: 'Delete do-step hai: finalizers khaali hon tabhi object jaata hai.',
        when: ['<code>-o jsonpath=\'{.metadata.finalizers}\'</code>', 'Node NotReady? pod ka kubelet confirm nahi kar sakta', 'Controller ke logs (wahi asli ilaaj)'],
        avoid: ['Turant <code>--force --grace-period=0</code> — StatefulSet pods par split-brain ka khatra'],
        gotchas: ['Finalizer hatana = cleanup skip (orphan LB/disk ka bill)'],
        yaml: `kubectl get pod <pod> -o jsonpath='{.metadata.deletionTimestamp} {.metadata.finalizers}'
kubectl get ns <ns> -o jsonpath='{.status.conditions}'`,
        example: 'Uninstalled operator ke finalizer ki wajah se namespace 3 din Terminating.', level: 'kk-terminating', lab: '14-finalizers',
      },
      evicted: {
        leaf: true, pick: 'Evicted: node memory/disk pressure', icon: '🧳',
        one: 'Kubelet ne node bachane ke liye pod nikala — memory ya ephemeral storage pressure.',
        why: 'Pod ki galti nahi, node ki tangi.',
        when: ['<code>describe pod</code> → "The node was low on resource: memory/ephemeral-storage"', 'BestEffort/Burstable pehle nikalte hain → requests set karo', 'emptyDir/logs ne disk bhari → <code>sizeLimit</code>, log rotation'],
        avoid: ['Sirf evicted pods delete karke bhool jaana — pressure dobara aayega'],
        gotchas: ['Evicted pods apne-aap saaf nahi hote (Failed phase mein padhe rehte)'],
        yaml: `kubectl get pods -A --field-selector=status.phase=Failed
kubectl describe node <node> | grep -A5 Conditions`,
        example: 'Debug logs ne node ki disk bhar di → saare BestEffort pods evicted.', level: 'scheduler',
      },
    },
    scenarios: [
      { s: 'STATUS Pending; Events: "0/3 nodes are available: 3 Insufficient memory".', answer: 'pendsched', explain: 'FailedScheduling → requests kam karo ya nodes badhao.' },
      { s: 'CrashLoopBackOff; Last State: Reason OOMKilled, Exit Code 137.', answer: 'oom', explain: 'Memory limit < peak → limit badhao (request = limit).' },
      { s: 'CrashLoopBackOff; Last State: Error, Exit Code 1; logs --previous: "connection refused db:5432".', answer: 'apperr', explain: 'App ne khud exit kiya — logs ne wajah bata di (DB raaste ki jaanch).' },
      { s: 'Running, READY 0/1; Events: "Readiness probe failed: HTTP probe failed with statuscode: 404".', answer: 'notready', explain: 'Readiness galat path → endpoints se bahar.' },
      { s: 'Pods Running 1/1, par doosre pod se curl par "Connection refused"; endpointslices khaali.', answer: 'svcpath', explain: 'Service selector pods se match nahi karta — raasta hop (2).' },
      { s: 'CreateContainerConfigError: secret "db-creds" not found.', answer: 'configerr', explain: 'Referenced Secret missing — pehle Secret (ya ESO sync), phir pod.' },
      { s: 'ContainerCreating 10 min se; Events: "Multi-Attach error for volume ...".', answer: 'creating', explain: 'RWO disk purane node par — Deployment strategy Recreate.' },
      { s: 'CrashLoopBackOff; Last State: Completed, Exit Code 0.', answer: 'completed', explain: 'Process kaam khatam karke nikla — Job chahiye ya foreground process.' },
      { s: 'Pod 2 din se Terminating; metadata.finalizers: ["example.com/cleanup"].', answer: 'stuckterm', explain: 'Finalizer ka controller cleanup nahi kar raha.' },
      { s: 'Pod Failed: "The node was low on resource: ephemeral-storage".', answer: 'evicted', explain: 'Node disk pressure → emptyDir sizeLimit / logs rotation / requests.' },
      { s: 'ImagePullBackOff; Events: "pull access denied, repository does not exist or may require authorization".', answer: 'imagepull', explain: 'Registry ka jawab: auth/naam → imagePullSecrets ya naam check.' },
      { s: 'Restarts badh rahe; logs mein sirf "booting..."; Events: "Liveness probe failed: connection refused".', answer: 'liveness', explain: 'Liveness boot ke dauraan maar raha → startupProbe.' },
      { s: 'Pod Pending; Events: "pod has unbound immediate PersistentVolumeClaims".', answer: 'pendpvc', explain: 'PVC bound nahi → describe pvc / StorageClass.' },
    ],
  },

  /* ================= 14. KARPENTER NODEPOOL DESIGN ================= */
  {
    id: 'karpenter', icon: '🌲',
    title: 'Karpenter NodePools kaise design karein — spot, on-demand, GPU, do-not-disrupt, budgets?',
    short: 'NodePool design',
    tldr: 'Default NodePool <b>spot + on-demand fallback</b> (stateless ke liye). Interruption nahi chalta → <b>on-demand pool</b> (taint ke saath). Special hardware → <b>dedicated pool</b>. Lambe jobs → pod par <b>do-not-disrupt</b>. Saath mein <b>limits + disruption budgets</b>.',
    levels: ['karpenterbasics', 'karpenterdisrupt', 'karpenterboss'], labs: [],
    start: 'what',
    nodes: {
      what: {
        q: 'Abhi kaunsa <b>faisla</b> karna hai?',
        why: 'NodePool design teen cheezon ka santulan hai: cost (spot, consolidation), reliability (on-demand, budgets) aur isolation (taints).',
        options: [
          { t: 'Normal stateless apps ke nodes', next: 'tolerant' },
          { t: 'GPU / special hardware', next: 'gpu' },
          { t: 'Lambi batch job consolidation se bachani hai', next: 'dnd' },
          { t: 'Consolidation/upgrades ek saath bahut nodes na hilaayein', next: 'budgets' },
        ],
      },
      tolerant: {
        q: 'Kya workload <b>interruption bardasht</b> kar sakta hai? (multiple replicas, PDB, stateless)',
        why: 'Spot 60-90% sasta hai par 2 minute ke notice par chhin sakta hai. Stateful/singleton workloads ke liye on-demand.',
        options: [{ t: 'Haan — stateless, multi-replica', next: 'spot' }, { t: 'Nahi — stateful / singleton / strict SLA', next: 'ondemand' }],
      },
      spot: {
        leaf: true, pick: 'Default NodePool (spot + fallback)', icon: '💸',
        one: 'Capacity-type [spot, on-demand] + kai instance families → Karpenter sabse sasta available chunta hai.',
        why: 'Stateless + interruption-tolerant → spot ka poora fayda.',
        when: ['Web/API, workers jinke kai replicas + PDB hain'],
        avoid: ['Ek hi instance type — spot capacity jaldi khatam; families/sizes wide rakho'],
        gotchas: ['Spot interruption handling (SQS interruption queue) configure karo', 'PDBs lagao — Karpenter respect karta hai', '<code>limits.cpu</code> zaroor'],
        yaml: `apiVersion: karpenter.sh/v1
kind: NodePool
metadata: { name: default }
spec:
  template:
    spec:
      nodeClassRef: { group: karpenter.k8s.aws, kind: EC2NodeClass, name: default }
      requirements:
        - { key: karpenter.sh/capacity-type, operator: In, values: ["spot", "on-demand"] }
        - { key: karpenter.k8s.aws/instance-category, operator: In, values: ["c", "m", "r"] }
  limits: { cpu: "1000" }
  disruption: { consolidationPolicy: WhenEmptyOrUnderutilized, consolidateAfter: 1m }`,
        example: 'Web tier 80% spot par — bill ~50% kam, interruptions PDB + replicas ne sambhaale.', level: 'karpenterbasics',
      },
      ondemand: {
        leaf: true, pick: 'On-demand NodePool (dedicated)', icon: '🏦',
        one: 'Stateful/critical workloads ke liye on-demand-only pool — taint se sirf chuninda pods.',
        why: 'Interruption nahi chalta.',
        when: ['Self-managed DBs, Kafka, singletons', 'Strict SLA services'],
        avoid: ['Saara cluster on-demand — cost; sirf zaroori workloads yahan'],
        gotchas: ['Pods par toleration + nodeSelector (<code>karpenter.sh/nodepool: on-demand</code> ya apna label)', 'Consolidation yahan bhi chalti hai — PDB/do-not-disrupt socho'],
        yaml: `spec:
  template:
    spec:
      requirements:
        - { key: karpenter.sh/capacity-type, operator: In, values: ["on-demand"] }
      taints: [{ key: workload, value: stateful, effect: NoSchedule }]`,
        example: 'Kafka brokers sirf on-demand pool par — spot interruption ka rebalance-storm khatam.', level: 'karpenterdisrupt',
      },
      gpu: {
        leaf: true, pick: 'GPU NodePool (taint + limits)', icon: '🎮',
        one: 'GPU instance families sirf GPU workloads ke liye — taint se baaki bahar, limits se bill control.',
        why: 'GPU mehenga hai — galti se web pods wahan na pahunchein.',
        when: ['ML training/inference'],
        avoid: ['GPU types default pool mein — Karpenter "fit" ke liye GPU node bhi chun sakta hai'],
        gotchas: ['NVIDIA device plugin DaemonSet ko toleration', 'Strict <code>limits</code> (jaise nvidia.com/gpu ya cpu)'],
        yaml: `spec:
  template:
    spec:
      requirements:
        - { key: karpenter.k8s.aws/instance-family, operator: In, values: ["g5", "g6"] }
      taints: [{ key: nvidia.com/gpu, value: "true", effect: NoSchedule }]
  limits: { nvidia.com/gpu: "16" }`,
        example: 'Training jobs ke liye g5 pool, max 16 GPUs — budget surakshit.', level: 'karpenterboss',
      },
      dnd: {
        leaf: true, pick: 'Pod do-not-disrupt annotation', icon: '🛑',
        one: 'Sirf us pod ke node ko voluntary disruption (consolidation/drift) se bachao — policy cluster-wide chalu rahe.',
        why: 'Ek job ki khatir poori consolidation band karna = har jagah paisa jalta hai.',
        when: ['Lambe batch/ML jobs, migrations', 'Kaam jo beech mein restart nahi ho sakta'],
        avoid: ['NodePool ki consolidation band karna'],
        gotchas: ['Spot interruption ko yeh nahi rokta (AWS cheen lega)', 'Hamesha laga ke mat chhodo — node kabhi consolidate nahi hoga'],
        yaml: `metadata:
  annotations:
    karpenter.sh/do-not-disrupt: "true"`,
        example: '4 ghante ki Spark job — annotation ne bachaya, baaki khaali nodes phir bhi hatte rahe.', level: 'karpenterdisrupt',
      },
      budgets: {
        leaf: true, pick: 'NodePool disruption budgets', icon: '🧮',
        one: 'Ek saath kitne nodes disrupt ho sakte hain — % ya ginti, chahe toh time window ke saath.',
        why: 'Consolidation/drift ek jhatke mein bahut nodes na hilaaye.',
        when: ['Business hours mein sirf 10% nodes', 'Peak time par drift-replacement band'],
        avoid: ['Budgets ko PDB ka replacement samajhna — dono saath chahiye'],
        gotchas: ['Budget <code>nodes: "0"</code> + schedule = window mein disruption band', 'Schedule ka cron <b>UTC</b> mein hota hai — 9 AM IST = <code>30 3 * * *</code>', 'Karpenter v1.x: <code>disruption</code> likha toh <code>consolidateAfter</code> bhi likhna zaroori (warna CRD reject karta hai)'],
        yaml: `disruption:
  consolidationPolicy: WhenEmptyOrUnderutilized
  consolidateAfter: 1m
  budgets:
    - nodes: "10%"
    - nodes: "0"
      schedule: "30 3 * * mon-fri"   # UTC! = 9:00 AM IST
      duration: 8h          # office hours mein koi voluntary disruption nahi`,
        example: 'Weekdays 9–5 koi consolidation nahi; raat ko 10% nodes tak.', level: 'karpenterdisrupt',
      },
    },
    scenarios: [
      { s: 'Stateless web pods (10 replicas, PDB) — cost kam karna hai.', answer: 'spot', explain: 'Interruption-tolerant → spot + on-demand fallback, wide instance types.' },
      { s: 'Self-managed Kafka brokers spot interruptions se pareshan.', answer: 'ondemand', explain: 'Stateful → alag on-demand pool, taint ke saath.' },
      { s: 'ML training ke liye GPUs — par web pods galti se GPU nodes par na jaayein, budget bhi fixed.', answer: 'gpu', explain: 'Dedicated GPU pool + taint + limits.' },
      { s: '4 ghante ki Spark job consolidation se 3 baar mar chuki.', answer: 'dnd', explain: 'Pod par do-not-disrupt — consolidation cluster-wide chalu rahe.' },
      { s: 'Office hours mein node churn se latency spikes — tab disruption nahi chahiye.', answer: 'budgets', explain: 'Disruption budget with schedule window.' },
    ],
  },

  /* ================= 15. NETWORK SECURITY ================= */
  {
    id: 'netsec', icon: '🛡️',
    title: 'Network security — NetworkPolicy (ingress/egress), service mesh L7/mTLS ya node encryption?',
    short: 'Traffic kaise surakshit karein?',
    tldr: 'L3/L4 "kaun kisse baat kare" → <b>NetworkPolicy</b> (default deny + allows). HTTP path/method ya service identity ke rules, mTLS → <b>service mesh</b>. Bas wire par encryption → <b>WireGuard/IPsec</b> (Cilium/Calico).',
    levels: ['netpol', 'istio'], labs: ['09-networkpolicy'],
    start: 'need',
    nodes: {
      need: {
        q: 'Kya chahiye?',
        why: 'NetworkPolicy IP/port level par kaam karti hai. HTTP-level rules ya cryptographic identity (mTLS) ke liye mesh. Sirf encryption ke liye CNI-level encryption saste mein.',
        options: [
          { t: 'Kaun pod kisse baat kare (pod-to-pod)', next: 'dir' },
          { t: 'HTTP path/method ke rules, ya service identity + mTLS', next: 'mesh' },
          { t: 'Bas nodes ke beech traffic encrypted ho', next: 'wire' },
        ],
      },
      dir: {
        q: 'Aane wala traffic (<b>ingress</b>) rokna hai, ya bahar jaana (<b>egress</b>, jaise internet) bhi?',
        why: 'Ingress default-deny har jagah first step hai. Egress control data exfiltration rokta hai — par DNS allow karna mat bhoolna.',
        options: [{ t: 'Ingress — apne pods ki raksha', next: 'npin' }, { t: 'Egress bhi — bahar jaana control', next: 'npout' }],
      },
      npin: {
        leaf: true, pick: 'NetworkPolicy: default-deny ingress + allows', icon: '🧱',
        one: 'Namespace mein sab ingress band, phir har service ke liye chhoti allow policy.',
        why: 'Pod-to-pod "kaun kisse" control — L3/L4.',
        when: ['Har app namespace (zero-trust ka pehla kadam)', 'DB ko sirf backend se'],
        avoid: ['L7 rules (HTTP path) → mesh/Cilium L7'],
        gotchas: ['CNI enforce kare (Calico/Cilium/kindnet) — warna policy chupchaap ignore', 'Port = container port', 'namespaceSelector + podSelector ek item mein = AND'],
        yaml: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny-ingress }
spec: { podSelector: {}, policyTypes: ["Ingress"] }`,
        example: 'Attacker pod compromise hua — DB tak raasta hi nahi.', level: 'netpol', lab: '09-networkpolicy',
      },
      npout: {
        leaf: true, pick: 'NetworkPolicy egress: default-deny + DNS + specific allows', icon: '🚪',
        one: 'Bahar jaana bhi band — pehle DNS allow, phir sirf zaroori destinations.',
        why: 'Compromise ke baad data bahar bhejna (exfiltration) rokna.',
        when: ['Regulated workloads (PCI)', 'Pods jinhe sirf 1-2 external APIs chahiye (ipBlock)'],
        avoid: ['Domain-name based egress (api.stripe.com) — standard NetworkPolicy sirf IP/CIDR; FQDN ke liye Cilium/Calico policies ya egress gateway'],
        gotchas: ['DNS: kube-dns pods, UDP <b>aur</b> TCP 53 allow — warna "bad address"', 'Cloud metadata endpoint (169.254.169.254) block karna socho'],
        yaml: `egress:
  - to:
      - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }
        podSelector: { matchLabels: { k8s-app: kube-dns } }
    ports: [{ port: 53, protocol: UDP }, { port: 53, protocol: TCP }]`,
        example: 'Payment pods sirf PSP ke IP range tak; baaki internet band.', level: 'netpol', lab: '09-networkpolicy',
      },
      mesh: {
        leaf: true, pick: 'Service mesh (Istio / Linkerd) — mTLS + L7 AuthorizationPolicy', icon: '🕸️',
        one: 'Har service ko cryptographic identity; mTLS encryption; HTTP-level allow/deny.',
        why: 'Rules IP se nahi, identity aur HTTP request se chahiye.',
        when: ['"orders sirf GET /api/products bula sake"', 'Zero-trust with identity, compliance mTLS', 'Traffic splitting/retries/telemetry bhi chahiye'],
        avoid: ['Sirf "pod A → pod B port" control → NetworkPolicy kaafi (mesh ka operational bojh bada)'],
        gotchas: ['Mesh + NetworkPolicy dono saath — defense in depth', 'Sidecar/ambient mode ka resource kharcha aur upgrade plan'],
        yaml: `apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata: { name: products-read, namespace: shop }
spec:
  selector: { matchLabels: { app: products } }
  rules:
    - from: [{ source: { principals: ["cluster.local/ns/shop/sa/orders"] } }]
      to: [{ operation: { methods: ["GET"], paths: ["/api/products*"] } }]`,
        example: 'orders service sirf products ka GET bula sakti hai — identity se, IP se nahi.', level: 'istio',
      },
      wire: {
        leaf: true, pick: 'CNI-level encryption (WireGuard / IPsec)', icon: '🔐',
        one: 'Nodes ke beech saara pod traffic transparently encrypted — app ya mesh ke bina.',
        why: 'Sirf "wire par encrypted" chahiye; identity/L7 rules nahi.',
        when: ['Compliance: encryption in transit', 'Mesh ka bojh nahi chahiye'],
        avoid: ['Service identity/authorization chahiye → mesh'],
        gotchas: ['Same-node traffic aksar encrypt nahi hota (wire par jaata hi nahi)', 'MTU/performance overhead check karo'],
        yaml: `# Cilium Helm values:
encryption:
  enabled: true
  type: wireguard`,
        example: 'Multi-AZ cluster: cross-AZ pod traffic WireGuard se encrypted, apps unchanged.', level: 'netpol',
      },
    },
    scenarios: [
      { s: 'Compromised pod DB tak na pahunche; sirf backend DB bula sake.', answer: 'npin', explain: 'Pod-to-pod L4 → default-deny ingress + allow backend → db.' },
      { s: 'Payment pods internet par sirf PSP ke IPs tak jaa sakein.', answer: 'npout', explain: 'Egress default-deny + DNS + ipBlock allow.' },
      { s: '"orders" sirf "products" ka GET /api/products bula sake — identity ke basis par.', answer: 'mesh', explain: 'L7 + identity → mesh AuthorizationPolicy.' },
      { s: 'Auditor ne kaha cross-node traffic encrypted chahiye, par mesh nahi lagana.', answer: 'wire', explain: 'Transparent encryption → WireGuard/IPsec (Cilium/Calico).' },
    ],
  },
]);
