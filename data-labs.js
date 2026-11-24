/* =====================================================================
   KubeGurukul — 🧪 Hands-on labs un levels ke liye jinmein pehle sirf
   quiz / sort / match / fill tha (2026-11-23 ka labs job).

   Har lab KISI MAUJOODA level mein judta hai (naya level nahi banta):
   `addLab(levelId, stage)` stage ko us level ke 🎁 bonus round se PEHLE
   daalta hai (bonus na ho toh aakhir mein). Level ke objectives, success
   aur flashcards mein bhi ek-ek line judti hai (KG.extendLevel).

   Kahani: ChaiPay (UPI payments startup) — wahi naam jo production
   tracks mein hain (EXTENDING.md §17.5): namespace `payments`, services
   pay-api / ledger (ledger-0) / notify, EKS cluster `chaipay-prod`,
   account 111122223333, region ap-south-1.

   Yeh file saari level files ke BAAD load hoti hai (extendLevel ko level
   pehle se registered chahiye). IIFE: games.js top level par
   `const el, shuffle, …` declare karti hai.

   ✍️ Niyam: har vaakya mein asli naam likho (pod, PVC, Ingress ka naam) —
   "yeh / woh / isse" se kaam mat chalao.
   ===================================================================== */
(function () {

  /* ---------- helpers ---------- */
  function addLab(levelId, stage, extra) {
    const lvl = KG.extendLevel(levelId, extra || {});
    const i = lvl.stages.findIndex(s => s.bonus);
    lvl.stages.splice(i < 0 ? lvl.stages.length : i, 0, stage);
  }
  // learner `-n payments` likhe ya na likhe — dono chalein
  const NS = '(?: (?:-n|--namespace)[ =]payments)?';
  const rx = body => new RegExp('^' + body + NS + '$');
  const ran = (s, re) => s.history.some(h => re.test(h));
  const ranAfter = (s, at, re) => at != null && s.history.slice(at).some(h => re.test(h));
  const NODES = ['node-1', 'node-2', 'node-3'].map(n => ({ name: n, status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4', cpu: 4, mem: 16 }));
  const PAY_API = ['a1', 'b2'].map((x, i) => ({ name: 'pay-api-6b8d7c-' + x, ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: NODES[i].name, ip: '10.0.1' + (2 + i) + '.21', top: '310m 280Mi' }));

  /* =====================================================================
     💾 storage — PVC Pending: StorageClass ka naam galat
     ===================================================================== */
  const RPOD = 'reports-5c9f8d7b6-k2x7q';
  const RPV = 'pvc-8f3c2a1e-4b7d-4e2a-9c1f-2d6b8e0a7c35';
  const SCHED_HEAD = 'Events:\n  Type     Reason            Age                From               Message\n  ----     ------            ----               ----               -------\n';
  const reportsPodDesc = (status, node, events) => `Name:             ${RPOD}
Namespace:        payments
Priority:         0
Service Account:  reports
Node:             ${node}
Labels:           app=reports
                  pod-template-hash=5c9f8d7b6
Status:           ${status}
Controlled By:    ReplicaSet/reports-5c9f8d7b6
Containers:
  reports:
    Image:          111122223333.dkr.ecr.ap-south-1.amazonaws.com/reports:1.4.0
    Mounts:
      /data from data (rw)
Volumes:
  data:
    Type:       PersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)
    ClaimName:  reports-data
    ReadOnly:   false
${events}`;
  const POD_PENDING = reportsPodDesc('Pending', '<none>', SCHED_HEAD +
    '  Warning  FailedScheduling  2m (x5 over 20m)   default-scheduler  0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.');
  const POD_NO_PVC = reportsPodDesc('Pending', '<none>', SCHED_HEAD +
    '  Warning  FailedScheduling  2m (x5 over 20m)   default-scheduler  0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.\n' +
    '  Warning  FailedScheduling  4s                 default-scheduler  0/3 nodes are available: persistentvolumeclaim "reports-data" not found. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.');
  const POD_RUNNING = reportsPodDesc('Running', 'node-2/10.0.12.30',
    'Events:\n  Type     Reason                  Age   From                     Message\n  ----     ------                  ----  ----                     -------\n' +
    '  Warning  FailedScheduling        21m   default-scheduler        0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.\n' +
    `  Normal   Scheduled               25s   default-scheduler        Successfully assigned payments/${RPOD} to node-2\n` +
    `  Normal   SuccessfulAttachVolume  17s   attachdetach-controller  AttachVolume.Attach succeeded for volume "${RPV}"\n` +
    '  Normal   Pulled                  12s   kubelet                  Container image "111122223333.dkr.ecr.ap-south-1.amazonaws.com/reports:1.4.0" already present on machine\n' +
    '  Normal   Created                 12s   kubelet                  Created container: reports\n' +
    '  Normal   Started                 12s   kubelet                  Started container reports');
  const PVC_BAD = {
    name: 'reports-data', status: 'Pending', volume: '', capacity: '', accessModes: '', storageClass: 'fast-ssd', age: '20m',
    describe: `Name:          reports-data
Namespace:     payments
StorageClass:  fast-ssd
Status:        Pending
Volume:
Labels:        app=reports
Annotations:   <none>
Finalizers:    [kubernetes.io/pvc-protection]
Capacity:
Access Modes:
VolumeMode:    Filesystem
Used By:       ${RPOD}
Events:
  Type     Reason              Age                 From                         Message
  ----     ------              ----                ----                         -------
  Warning  ProvisioningFailed  14s (x82 over 20m)  persistentvolume-controller  storageclass.storage.k8s.io "fast-ssd" not found`,
  };
  const PVC_GOOD = {
    name: 'reports-data', status: 'Bound', volume: RPV, capacity: '10Gi', accessModes: 'RWO', storageClass: 'gp3', age: '30s',
    describe: `Name:          reports-data
Namespace:     payments
StorageClass:  gp3
Status:        Bound
Volume:        ${RPV}
Labels:        app=reports
Annotations:   pv.kubernetes.io/bind-completed: yes
               pv.kubernetes.io/bound-by-controller: yes
               volume.kubernetes.io/selected-node: node-2
               volume.kubernetes.io/storage-provisioner: ebs.csi.aws.com
Finalizers:    [kubernetes.io/pvc-protection]
Capacity:      10Gi
Access Modes:  RWO
VolumeMode:    Filesystem
Used By:       ${RPOD}
Events:
  Type    Reason                 Age   From                                               Message
  ----    ------                 ----  ----                                               -------
  Normal  WaitForFirstConsumer   31s   persistentvolume-controller                        waiting for first consumer to be created before binding
  Normal  Provisioning           30s   ebs.csi.aws.com_ebs-csi-controller-7d9f6c8b5-x2p4n  External provisioner is provisioning volume for claim "payments/reports-data"
  Normal  ProvisioningSucceeded  27s   ebs.csi.aws.com_ebs-csi-controller-7d9f6c8b5-x2p4n  Successfully provisioned volume ${RPV}`,
  };
  const PVC_YAML = sc => `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: reports-data
  namespace: payments
  labels: { app: reports }
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: ${sc}
  resources:
    requests:
      storage: 10Gi`;
  const T_PVC = [
    { text: 'Pods ka haal dekho (<code>kubectl get pods</code>)', check: s => ran(s, /^kubectl get (pods?|po)\b/) },
    { text: '<code>reports</code> pod ka describe padho — scheduler kya keh raha hai?', check: s => ran(s, /^kubectl describe (pods?|po)[ \/]reports/) },
    { text: 'PVC <code>reports-data</code> ka describe padho — asli error Events mein hai', check: s => ran(s, /^kubectl describe (pvc|persistentvolumeclaims?)\b/) },
    { text: 'Dekho cluster mein sach mein kaunsi StorageClass hai', check: s => ran(s, /^kubectl (get|describe) (sc|storageclass(es)?)\b/) },
    { text: 'PVC <code>reports-data</code> ko sahi StorageClass ke saath dobara banao', check: s => !!s.cluster.fixed },
    { text: 'Fix ke baad <code>kubectl get pvc</code> se pakka karo: STATUS <code>Bound</code>', check: s => !!s.cluster.fixed && ranAfter(s, s.cluster.fixedAt, /^kubectl get (pvc|persistentvolumeclaims?)\b/) },
  ];
  addLab('storage', {
    type: 'terminal',
    title: '🖥️ Mission: reports ki disk ban hi nahi rahi',
    instructions: 'ChaiPay (UPI payments startup) ki reports service roz raat settlement PDF banati hai aur /data par rakhti hai. Developer Ravi ne kal reports ke liye nayi PVC banayi. PVC ki YAML ek purane blog se copy hui thi. 20 minute se reports pod Pending hai.',
    goal: `<code>reports</code> pod ko <b>Running</b> karo. Pehle wajah dhoondho: pod Pending kyun hai, aur pod ki PVC <code>reports-data</code> Pending kyun hai.
      Fix ke baad <code>kubectl get pvc</code> mein <code>reports-data</code> <b>Bound</b> dikhni chahiye.`,
    tasks: T_PVC,
    cluster: {
      nodes: NODES,
      pods: PAY_API.concat([{ name: RPOD, ready: '0/1', status: 'Pending', restarts: 0, age: '20m', node: '<none>', describe: POD_PENDING }]),
      deployments: [
        { name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' },
        { name: 'reports', ready: '0/1', upToDate: 1, available: 0, age: '20m' },
      ],
      pvcs: [Object.assign({}, PVC_BAD)],
      custom: {
        sc: { names: ['sc', 'storageclass', 'storageclasses'],
          cols: ['NAME', 'PROVISIONER', 'RECLAIMPOLICY', 'VOLUMEBINDINGMODE', 'ALLOWVOLUMEEXPANSION', 'AGE'],
          items: [{ name: 'gp3 (default)', row: ['ebs.csi.aws.com', 'Delete', 'WaitForFirstConsumer', 'true', '40d'],
            describe: 'Name:            gp3\nIsDefaultClass:  Yes\nAnnotations:     storageclass.kubernetes.io/is-default-class=true\nProvisioner:           ebs.csi.aws.com\nParameters:            encrypted=true,type=gp3\nAllowVolumeExpansion:  True\nMountOptions:          <none>\nReclaimPolicy:         Delete\nVolumeBindingMode:     WaitForFirstConsumer\nEvents:                <none>' }] },
      },
    },
    responses: [
      { re: rx('kubectl delete (?:pvc|persistentvolumeclaims?)[ /]reports-data'),
        mutate: s => {
          const c = s.cluster;
          if (c.fixed || !c.pvcs.length) return;
          c.pvcs.length = 0; c.deleted = true;
          c.pods.find(p => p.name === RPOD).describe = POD_NO_PVC;
        },
        out: s => s.cluster.fixed
          ? '(simulator ne roka) Nayi reports-data PVC Bound hai aur reports pod use kar raha hai. Asli cluster mein delete karne par PVC "Terminating" mein atak jaati (kubernetes.io/pvc-protection finalizer) jab tak pod na hate. Mission ho chuka hai — kubectl get pvc se dekho.'
          : (s.cluster.pvcs.length ? '' : 'persistentvolumeclaim "reports-data" deleted\n(Pod schedule nahi hua tha, isliye PVC ko kisi ne use nahi kiya tha — delete turant ho gaya.)') },
      { re: /^kubectl delete (?:pvc|persistentvolumeclaims?)\b/, err: true, out: 'Error from server (NotFound): persistentvolumeclaims not found\n(Roop: kubectl delete pvc reports-data)' },
    ],
    files: {
      'reports-pvc.yaml': {
        desc: 'Ravi ki asli PVC file (kal yahi apply hui thi)',
        content: PVC_YAML('fast-ssd     # purane blog se copy — GKE cluster ka naam'),
        apply: s => {
          const c = s.cluster;
          if (c.fixed) return 'The PersistentVolumeClaim "reports-data" is invalid: spec: Forbidden: spec is immutable after creation except resources.requests and volumeAttributesClassName for bound claims\n(PVC ab gp3 par Bound hai. Purani file ki fast-ssd wali class wapas nahi lag sakti — achha hi hai.)';
          if (!c.pvcs.length) { c.pvcs.push(Object.assign({}, PVC_BAD, { age: '2s' })); c.pods.find(p => p.name === RPOD).describe = POD_PENDING; return 'persistentvolumeclaim/reports-data created\n(PVC wapas fast-ssd class ke saath ban gayi — aur phir se Pending. Is file mein wahi galti hai.)'; }
          return 'persistentvolumeclaim/reports-data unchanged';
        },
      },
      'reports-pvc-gp3.yaml': {
        desc: 'Wahi PVC, par storageClassName: gp3',
        content: PVC_YAML('gp3          # cluster mein asli class (kubectl get sc)'),
        apply: s => {
          const c = s.cluster;
          if (c.fixed) return 'persistentvolumeclaim/reports-data unchanged';
          if (c.pvcs.length) return `The PersistentVolumeClaim "reports-data" is invalid: spec: Forbidden: spec is immutable after creation except resources.requests and volumeAttributesClassName for bound claims
  core.PersistentVolumeClaimSpec{
  	AccessModes:      {"ReadWriteOnce"},
  	Selector:         nil,
  	Resources:        {Requests: {s"storage": {i: {...}, s: "10Gi", Format: "BinarySI"}}},
  	VolumeName:       "",
- 	StorageClassName: &"fast-ssd",
+ 	StorageClassName: &"gp3",
  	VolumeMode:       &"Filesystem",
  	... // 3 identical fields
  }
(PVC ka storageClassName bante hi jam jaata hai — badla nahi ja sakta.)`;
          c.fixed = true; c.fixedAt = s.history.length;
          c.pvcs.push(Object.assign({}, PVC_GOOD));
          Object.assign(c.pods.find(p => p.name === RPOD), { ready: '1/1', status: 'Running', node: 'node-2', ip: '10.0.12.88', describe: POD_RUNNING, top: '40m 120Mi' });
          Object.assign(c.deployments.find(d => d.name === 'reports'), { ready: '1/1', available: 1 });
          return 'persistentvolumeclaim/reports-data created\n(Scheduler ne reports pod ko node-2 par rakha. EBS CSI driver ne usi zone mein 10Gi gp3 disk banayi. Asli AWS mein ~15 second lagte hain.)';
        },
      },
      'storageclass-fast-ssd.yaml': {
        desc: 'Naya StorageClass "fast-ssd" banata hai (gp3 jaisa hi)',
        content: 'apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: fast-ssd\nprovisioner: ebs.csi.aws.com\nparameters: { type: gp3 }\nvolumeBindingMode: WaitForFirstConsumer',
        apply: () => 'Error from server (Forbidden): error when creating "storageclass-fast-ssd.yaml": storageclasses.storage.k8s.io is forbidden: User "dev-ravi" cannot create resource "storageclasses" in API group "storage.k8s.io" at the cluster scope\n(StorageClass poore cluster ka object hai — platform team ka. Developer ka role sirf payments namespace ke andar chalta hai. Aur ek hi disk ke do naam (gp3 aur fast-ssd) baad mein sabko confuse karte hain.)',
      },
    },
    success: KG.allOf(T_PVC),
    successText: `Chain ulti padhi: <b>pod Pending</b> → scheduler bola "unbound immediate PersistentVolumeClaims" → <b>PVC Pending</b> → PVC ke Events: <code>storageclass "fast-ssd" not found</code>.
      Blog ka cluster GKE tha; ChaiPay ka EKS cluster <code>gp3</code> class use karta hai.<br>
      <b>PVC ka spec immutable hai</b> — class badalni ho toh PVC dobara banani padti hai. Yahan delete safe tha: PVC Pending thi, disk bani hi nahi thi, data zero.
      <b>Bound PVC</b> ke saath aisa kabhi mat karna — reclaimPolicy <code>Delete</code> par asli disk bhi chali jaati hai.<br>
      <b>Agli baar:</b> PVC likhne se pehle <code>kubectl get sc</code>. Default class theek ho toh <code>storageClassName</code> likho hi mat.`,
    hints: [
      'kubectl get pods se reports pod dekho. Phir kubectl describe pod ' + RPOD + ' — Events ki aakhri line padho.',
      '"unbound immediate PersistentVolumeClaims" ka matlab: pod ki PVC abhi Bound nahi hai. kubectl describe pvc reports-data se PVC ka error padho, phir kubectl get sc.',
      'PVC ki class badli nahi ja sakti. PVC Pending hai aur khaali hai, isliye: kubectl delete pvc reports-data, phir kubectl apply -f reports-pvc-gp3.yaml, phir kubectl get pvc.',
    ],
    solution: ['kubectl get pods', 'kubectl describe pod ' + RPOD, 'kubectl describe pvc reports-data', 'kubectl get sc',
      'kubectl delete pvc reports-data', 'kubectl apply -f reports-pvc-gp3.yaml', 'kubectl get pvc'],
  }, {
    objectives: ['🖥️ <b>Terminal mission:</b> reports pod Pending — PVC ki galat StorageClass pakdo aur PVC dobara banao'],
    success: ['Main Pending pod → Pending PVC → StorageClass tak ki chain terminal mein khud pakad sakta hoon'],
    cards: [{ front: 'PVC Pending, Events: <code>storageclass "fast-ssd" not found</code> — fix?', back: '<code>kubectl get sc</code> se asli class ka naam dekho. PVC ka spec <b>immutable</b> hai → Pending aur khaali PVC ko delete karke sahi class ke saath dobara banao. <b>Bound</b> PVC ko aise kabhi mat hatao.' }],
  });

  /* =====================================================================
     🚪 ingress — ADDRESS khaali (class nahi), phir /api ka 404 (pathType)
     ===================================================================== */
  const ALB_DNS = 'k8s-payments-merchant-9c2e4a7b1d-2045731986.ap-south-1.elb.amazonaws.com';
  const ingDesc = (c, cls, addr, events) => `Name:             merchant
Labels:           app=merchant
Namespace:        payments
Address:          ${addr}
Ingress Class:    ${cls}
Default backend:  <default>
Rules:
  Host                 Path  Backends
  ----                 ----  --------
  merchant.chaipay.in
                       /api   merchant-api:80 (10.0.12.41:8080,10.0.13.77:8080)
                       /      merchant-web:80 (10.0.12.19:80,10.0.13.52:80)
Annotations:           alb.ingress.kubernetes.io/scheme: internet-facing
                       alb.ingress.kubernetes.io/target-type: ip
Events:${events}`;
  const ING_EVENTS = '\n  Type    Reason                  Age   From     Message\n  ----    ------                  ----  ----     -------\n  Normal  SuccessfullyReconciled  2m    ingress  Successfully reconciled';
  const ingYaml = (cls, pathType) => `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: merchant
  namespace: payments
  labels: { app: merchant }
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:${cls}
  rules:
  - host: merchant.chaipay.in
    http:
      paths:
      - path: /api
        pathType: ${pathType}
        backend:
          service: { name: merchant-api, port: { number: 80 } }
      - path: /
        pathType: Prefix
        backend:
          service: { name: merchant-web, port: { number: 80 } }`;
  function setIngress(s, cls, prefix) {
    const c = s.cluster, ing = c.ingresses.find(i => i.name === 'merchant');
    c.classFixed = cls; c.pathFixed = prefix;
    if (cls) Object.assign(ing, { class: 'alb', address: ALB_DNS, describe: ingDesc(c, 'alb', ALB_DNS, ING_EVENTS) });
    else Object.assign(ing, { class: '<none>', address: '', describe: ingDesc(c, '<none>', '', '                <none>') });
  }
  const curlRe = /^curl\b.*?\b(?:https?:\/\/)?merchant\.chaipay\.in(\/\S*)?/;
  const T_ING = [
    { text: '<code>kubectl get ingress</code> chalao — CLASS aur ADDRESS column padho', check: s => ran(s, /^kubectl get (ing|ingress|ingresses)\b/) },
    { text: '<code>merchant</code> Ingress ka describe padho — Events mein kya hai?', check: s => ran(s, /^kubectl describe (ing|ingress|ingresses)[ \/]merchant/) },
    { text: 'Cluster ki IngressClass dekho (<code>kubectl get ingressclass</code>)', check: s => ran(s, /^kubectl (get|describe) (ingressclass(es)?)\b/) },
    { text: '<code>merchant</code> Ingress ko sahi class do — ADDRESS aana chahiye', check: s => !!s.cluster.classFixed },
    { text: '<code>curl https://merchant.chaipay.in/api/v1/settlements</code> se merchant-api ka <b>JSON</b> lao', check: s => !!(s.cluster.apiOk && s.cluster.classFixed && s.cluster.pathFixed) },
  ];
  addLab('ingress', {
    type: 'terminal',
    title: '🖥️ Mission: Merchant Dashboard ka gate band hai',
    instructions: 'ChaiPay aaj dukaandaaron ke liye naya Merchant Dashboard launch kar raha hai: merchant.chaipay.in. Frontend merchant-web hai, API merchant-api hai. Ingress "merchant" 30 minute pehle apply hua. Launch 1 ghante baad hai, aur site khul hi nahi rahi.',
    goal: `<code>https://merchant.chaipay.in/api/v1/settlements</code> se <b>merchant-api</b> ka JSON aana chahiye.
      Cluster EKS hai; Ingress ko AWS Load Balancer Controller sambhalta hai. Purani Ingress <code>pay</code> theek chal rahi hai — usse milao.`,
    tasks: T_ING,
    cluster: {
      nodes: NODES,
      pods: PAY_API.concat([
        { name: 'merchant-web-7d4b9c6f8-h3k2m', ready: '1/1', status: 'Running', restarts: 0, age: '35m', node: 'node-1', ip: '10.0.12.19' },
        { name: 'merchant-web-7d4b9c6f8-p9x1z', ready: '1/1', status: 'Running', restarts: 0, age: '35m', node: 'node-3', ip: '10.0.13.52' },
        { name: 'merchant-api-5f6c8d9b7-q4w8e', ready: '1/1', status: 'Running', restarts: 0, age: '35m', node: 'node-1', ip: '10.0.12.41' },
        { name: 'merchant-api-5f6c8d9b7-t2r6y', ready: '1/1', status: 'Running', restarts: 0, age: '35m', node: 'node-3', ip: '10.0.13.77' },
      ]),
      services: [
        { name: 'merchant-web', type: 'ClusterIP', clusterIP: '10.100.71.12', ports: '80/TCP', age: '35m' },
        { name: 'merchant-api', type: 'ClusterIP', clusterIP: '10.100.71.40', ports: '80/TCP', age: '35m' },
        { name: 'pay-api', type: 'ClusterIP', clusterIP: '10.100.20.5', ports: '80/TCP', age: '40d' },
      ],
      endpoints: [
        { name: 'merchant-web', endpoints: '10.0.12.19:80,10.0.13.52:80', age: '35m' },
        { name: 'merchant-api', endpoints: '10.0.12.41:8080,10.0.13.77:8080', age: '35m' },
        { name: 'pay-api', endpoints: '10.0.12.21:8080,10.0.13.21:8080', age: '40d' },
      ],
      ingresses: [
        { name: 'merchant', class: '<none>', hosts: 'merchant.chaipay.in', address: '', ports: '80', age: '30m',
          describe: ingDesc(null, '<none>', '', '                <none>') },
        { name: 'pay', class: 'alb', hosts: 'pay.chaipay.in', address: 'k8s-payments-pay-6f1e2d3c4b-1234567890.ap-south-1.elb.amazonaws.com', ports: '80', age: '40d',
          describe: 'Name:             pay\nNamespace:        payments\nAddress:          k8s-payments-pay-6f1e2d3c4b-1234567890.ap-south-1.elb.amazonaws.com\nIngress Class:    alb\nDefault backend:  <default>\nRules:\n  Host            Path  Backends\n  ----            ----  --------\n  pay.chaipay.in\n                  /     pay-api:80 (10.0.12.21:8080,10.0.13.21:8080)\nAnnotations:      alb.ingress.kubernetes.io/scheme: internet-facing\n                  alb.ingress.kubernetes.io/target-type: ip\nEvents:           <none>' },
      ],
      custom: {
        ingressclass: { names: ['ingressclass', 'ingressclasses'], cols: ['NAME', 'CONTROLLER', 'PARAMETERS', 'AGE'],
          items: [{ name: 'alb', row: ['ingress.k8s.aws/alb', '<none>', '40d'],
            describe: 'Name:         alb\nLabels:       app.kubernetes.io/name=aws-load-balancer-controller\nAnnotations:  <none>\nController:   ingress.k8s.aws/alb\nEvents:       <none>\n(dhyaan do: Annotations mein ingressclass.kubernetes.io/is-default-class: "true" NAHI hai — yani "alb" default class nahi hai)' }] },
      },
    },
    responses: [
      { re: rx('kubectl get (?:ing|ingress|ingresses)[ /]merchant -o ?yaml'),
        out: s => ingYaml(s.cluster.classFixed ? '\n  ingressClassName: alb' : '', s.cluster.pathFixed ? 'Prefix' : 'Exact') },
      { re: curlRe,
        mutate: (s, m) => { const p = ((m && m[1]) || '/').replace(/["']$/, ''); if (s.cluster.classFixed && s.cluster.pathFixed && /^\/api\//.test(p)) s.cluster.apiOk = true; },
        out: (s, m) => {
          const c = s.cluster, p = ((m && m[1]) || '/').replace(/["']$/, '');
          if (!c.classFixed) return 'curl: (6) Could not resolve host: merchant.chaipay.in\n(DNS record bana hi nahi. ExternalDNS record tab banata hai jab Ingress ko ADDRESS milta hai — aur merchant ka ADDRESS khaali hai.)';
          if (/^\/api(\/|$)/.test(p) && (c.pathFixed || p === '/api'))
            return p === '/api' ? '{"service":"merchant-api","version":"2.3.1"}' : '{"merchant":"m_ramesh_kirana","settled_today":"48250.00","currency":"INR","status":"ok"}';
          if (/^\/api\//.test(p)) return '<!doctype html>\n<html lang="en"><head><title>Page not found · ChaiPay Merchant</title></head>\n<body><div id="app"><h1>404</h1><p>Page nahi mila</p></div></body></html>\n(dhyaan do: jawab HTML page hai, JSON nahi)';
          return '<!doctype html>\n<html lang="en"><head><title>ChaiPay Merchant Dashboard</title></head>\n<body><div id="app"></div><script src="/static/app.4f1c.js"></script></body></html>';
        } },
    ],
    files: {
      'merchant-ingress.yaml': {
        desc: 'Wahi Ingress jo 30 minute pehle apply hua tha',
        content: ingYaml('', 'Exact'),
        apply: s => {
          if (!s.cluster.classFixed && !s.cluster.pathFixed) return 'ingress.networking.k8s.io/merchant unchanged';
          setIngress(s, false, false);
          return 'ingress.networking.k8s.io/merchant configured\n(purani file wapas lag gayi — class aur path dono phir se purane jaise ho gaye)';
        },
      },
      'fix-class.yaml': {
        desc: 'merchant Ingress mein ingressClassName: alb jodta hai',
        content: ingYaml('\n  ingressClassName: alb       # NAYA: kaun sa controller is Ingress ko sambhale', 'Exact'),
        apply: s => {
          if (s.cluster.classFixed && !s.cluster.pathFixed) return 'ingress.networking.k8s.io/merchant unchanged';
          const back = s.cluster.pathFixed;
          setIngress(s, true, false);
          return 'ingress.networking.k8s.io/merchant configured\n' + (back
            ? '(dhyaan do: fix-class.yaml mein /api ka pathType abhi bhi Exact hai — path wala fix wapas purana ho gaya)'
            : '(AWS Load Balancer Controller ne Ingress utha liya aur ALB bana raha hai — asli AWS mein 2-3 minute. kubectl get ingress se ADDRESS dekho.)');
        },
      },
      'fix-path.yaml': {
        desc: 'ingressClassName: alb + /api ka pathType Exact se Prefix',
        content: ingYaml('\n  ingressClassName: alb', 'Prefix          # NAYA: /api aur /api/... dono'),
        apply: s => {
          if (s.cluster.classFixed && s.cluster.pathFixed) return 'ingress.networking.k8s.io/merchant unchanged';
          const fresh = !s.cluster.classFixed;
          setIngress(s, true, true);
          return 'ingress.networking.k8s.io/merchant configured' + (fresh ? '\n(AWS Load Balancer Controller ne Ingress utha liya aur ALB bana raha hai. kubectl get ingress se ADDRESS dekho.)' : '\n(ALB ke rules update hue: /api ab Prefix hai)');
        },
      },
      'web-loadbalancer.yaml': {
        desc: 'merchant-web Service ko type: LoadBalancer bana deta hai',
        content: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: merchant-web\nspec:\n  type: LoadBalancer\n  selector: { app: merchant-web }\n  ports: [ { port: 80, targetPort: 80 } ]',
        apply: () => '(simulator ne roka) Service type LoadBalancer har service ka ALAG load balancer banata hai — har ek ka alag mahine ka bill. Aur woh L4 load balancer hai: host/path routing (/api ek service ko, / doosri ko) usme hota hi nahi. Ek Ingress = ek ALB = saari services. Ingress ko theek karo.',
      },
    },
    success: KG.allOf(T_ING),
    successText: `<b>Galti 1:</b> Ingress mein <code>ingressClassName</code> tha hi nahi, aur cluster ki IngressClass <code>alb</code> default nahi hai. Isliye <b>kisi controller ne Ingress uthaya hi nahi</b>:
      CLASS <code>&lt;none&gt;</code>, ADDRESS khaali, Events <code>&lt;none&gt;</code>. Ingress resource sirf rules ki kitaab hai — padhne wala controller chahiye.<br>
      <b>Galti 2:</b> <code>/api</code> ka <code>pathType: Exact</code> tha. Exact sirf <code>/api</code> pakadta hai, <code>/api/v1/settlements</code> nahi. Woh request <code>/</code> rule se merchant-web (frontend) ke paas gayi aur frontend ne apna 404 HTML page diya.<br>
      <b>Debug ka tareeka:</b> kaam karti Ingress (<code>pay</code>) se milao — CLASS ka farak turant dikha.`,
    hints: [
      'kubectl get ingress — merchant aur pay ka CLASS aur ADDRESS milao. Phir kubectl describe ingress merchant (Events dekho) aur kubectl get ingressclass.',
      'Kisi controller ne merchant ko uthaya nahi, kyunki class nahi likhi. kubectl apply -f fix-class.yaml, phir curl https://merchant.chaipay.in/api/v1/settlements.',
      'Jawab HTML aaya? Frontend ne jawab diya. kubectl get ingress merchant -o yaml se pathType dekho. Exact sirf /api pakadta hai. kubectl apply -f fix-path.yaml, phir curl dobara.',
    ],
    solution: ['kubectl get ingress', 'kubectl describe ingress merchant', 'kubectl get ingressclass', 'kubectl apply -f fix-class.yaml',
      'curl https://merchant.chaipay.in/api/v1/settlements', 'kubectl get ingress merchant -o yaml', 'kubectl apply -f fix-path.yaml',
      'curl https://merchant.chaipay.in/api/v1/settlements'],
  }, {
    objectives: ['🖥️ <b>Terminal mission:</b> Ingress ka ADDRESS khaali (class nahi) aur <code>/api</code> ka 404 (pathType) — dono khud pakdo'],
    success: ['Main ADDRESS khaali Ingress ko CLASS aur Events se debug kar sakta hoon, aur Exact vs Prefix ka farak jaanta hoon'],
    cards: [
      { front: 'Ingress: CLASS <code>&lt;none&gt;</code>, ADDRESS khaali, Events <code>&lt;none&gt;</code> — matlab?', back: 'Kisi controller ne Ingress <b>uthaya hi nahi</b>. <code>kubectl get ingressclass</code> → <code>spec.ingressClassName</code> likho (ya class par <code>is-default-class</code> annotation). Events khaali = controller ne dekha hi nahi.' },
      { front: '<code>pathType: Exact</code> <code>/api</code> — <code>/api/v1/x</code> kahan jaayega?', back: 'Exact sirf <code>/api</code> pakadta hai. <code>/api/v1/x</code> agle rule (<code>/</code> Prefix) se <b>frontend</b> par jaata hai → HTML 404. API ke liye <code>Prefix</code> lo.' },
    ],
  });

  /* =====================================================================
     🔥 netpol — default-deny lagaya: DNS bhi band, ledger bhi band
     ===================================================================== */
  const npHead = (name, created) => `Name:         ${name}\nNamespace:    payments\nCreated on:   2026-11-23 ${created} +0530 IST\nLabels:       <none>\nAnnotations:  <none>\nSpec:\n`;
  const NP = {
    'default-deny': { sel: '<none>', age: '12m', describe: npHead('default-deny', '10:02:11') +
      '  PodSelector:     <none> (Allowing the specific traffic to all pods in this namespace)\n  Allowing ingress traffic:\n    <none> (Selected pods are isolated for ingress connectivity)\n  Allowing egress traffic:\n    <none> (Selected pods are isolated for egress connectivity)\n  Policy Types: Ingress, Egress' },
    'allow-alb-to-pay-api': { sel: 'app=pay-api', age: '12m', describe: npHead('allow-alb-to-pay-api', '10:02:11') +
      '  PodSelector:     app=pay-api\n  Allowing ingress traffic:\n    To Port: 8080/TCP\n    From:\n      IPBlock:\n        CIDR: 10.0.0.0/16\n        Except: \n  Not affecting egress traffic\n  Policy Types: Ingress' },
    'allow-dns': { sel: '<none>', age: '5s', describe: npHead('allow-dns', '10:14:40') +
      '  PodSelector:     <none> (Allowing the specific traffic to all pods in this namespace)\n  Not affecting ingress traffic\n  Allowing egress traffic:\n    To Port: 53/UDP\n    To Port: 53/TCP\n    To:\n      NamespaceSelector: kubernetes.io/metadata.name=kube-system\n      PodSelector: k8s-app=kube-dns\n  Policy Types: Egress' },
    'allow-ledger-from-pay-api': { sel: 'app=ledger', age: '5s', describe: npHead('allow-ledger-from-pay-api', '10:16:02') +
      '  PodSelector:     app=ledger\n  Allowing ingress traffic:\n    To Port: 8080/TCP\n    From:\n      PodSelector: app=pay-api\n  Not affecting egress traffic\n  Policy Types: Ingress' },
    'allow-pay-api-to-ledger': { sel: 'app=pay-api', age: '5s', describe: npHead('allow-pay-api-to-ledger', '10:16:30') +
      '  PodSelector:     app=pay-api\n  Not affecting ingress traffic\n  Allowing egress traffic:\n    To Port: 8080/TCP\n    To:\n      PodSelector: app=ledger\n  Policy Types: Egress' },
  };
  const npRow = name => ({ name, podSelector: NP[name].sel, age: NP[name].age, describe: NP[name].describe });
  const NP_YAML = {
    'allow-dns.yaml': 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-dns\n  namespace: payments\nspec:\n  podSelector: {}              # payments ke SAARE pods\n  policyTypes: [Egress]\n  egress:\n  - to:\n    - namespaceSelector:\n        matchLabels: { kubernetes.io/metadata.name: kube-system }\n      podSelector:\n        matchLabels: { k8s-app: kube-dns }   # CoreDNS pods\n    ports:\n    - { protocol: UDP, port: 53 }\n    - { protocol: TCP, port: 53 }',
    'allow-ledger-from-pay-api.yaml': 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-ledger-from-pay-api\n  namespace: payments\nspec:\n  podSelector:\n    matchLabels: { app: ledger }     # kis par lagu: ledger\n  policyTypes: [Ingress]\n  ingress:                           # ledger ke ANDAR aane wala traffic\n  - from:\n    - podSelector:\n        matchLabels: { app: pay-api }\n    ports:\n    - { protocol: TCP, port: 8080 }',
    'allow-pay-api-to-ledger.yaml': 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-pay-api-to-ledger\n  namespace: payments\nspec:\n  podSelector:\n    matchLabels: { app: pay-api }    # kis par lagu: pay-api\n  policyTypes: [Egress]\n  egress:                            # pay-api se BAHAR jaane wala traffic\n  - to:\n    - podSelector:\n        matchLabels: { app: ledger }\n    ports:\n    - { protocol: TCP, port: 8080 }',
  };
  const LEDGER_IP = '10.100.42.17';
  function payLogs(c) {
    if (!c.dns) return [8812, 8813, 8814].map((n, i) => `2026-11-23T10:1${2 + i}:0${3 + i}Z ERROR payment p_${n} failed: dial tcp: lookup ledger.payments.svc.cluster.local on 10.100.0.10:53: read udp 10.0.12.21:4152${i}->10.100.0.10:53: i/o timeout`).join('\n');
    if (!(c.ledgerIn && c.payOut)) return [8830, 8831].map((n, i) => `2026-11-23T10:1${5 + i}:2${i}Z ERROR payment p_${n} failed: dial tcp ${LEDGER_IP}:8080: i/o timeout`).join('\n');
    return '2026-11-23T10:17:41Z INFO payment p_8840 ok ledger_entry=182346\n2026-11-23T10:17:42Z INFO payment p_8841 ok ledger_entry=182347';
  }
  function netSync(c) {
    c.networkpolicies = c.policies.map(npRow);
    c.pods.filter(p => /^pay-api/.test(p.name)).forEach(p => { p.logs = payLogs(c); });
  }
  function addPolicy(s, name) {
    const c = s.cluster;
    if (c.policies.includes(name)) return `networkpolicy.networking.k8s.io/${name} unchanged`;
    c.policies.push(name);
    if (name === 'allow-dns') c.dns = true;
    if (name === 'allow-ledger-from-pay-api') c.ledgerIn = true;
    if (name === 'allow-pay-api-to-ledger') c.payOut = true;
    netSync(c);
    return `networkpolicy.networking.k8s.io/${name} created`;
  }
  function execNet(s, who, cmd) {
    const c = s.cluster;
    const tool = cmd.split(' ')[0];
    if (!/^(nslookup|curl|wget)$/.test(tool)) return `OCI runtime exec failed: exec failed: unable to start container process: exec: "${tool}": executable file not found in $PATH: unknown\ncommand terminated with exit code 126\n(is mission mein nslookup, curl aur wget chalte hain)`;
    const hm = cmd.match(/\b(ledger)(?:\.payments(?:\.svc(?:\.cluster\.local)?)?)?(?::(\d+))?(\/\S*)?/);
    if (!hm) return '(is mission mein ledger tak ka raasta jaancho — jaise: nslookup ledger  ya  curl -s --max-time 5 ledger:8080/healthz)';
    if (tool === 'nslookup') {
      if (!c.dns) return ';; connection timed out; no servers could be reached\n\ncommand terminated with exit code 1';
      return `Server:\t\t10.100.0.10\nAddress:\t10.100.0.10#53\n\nName:\tledger.payments.svc.cluster.local\nAddress: ${LEDGER_IP}`;
    }
    const short = /(--max-time|-m |--timeout|-T )/.test(cmd);
    if (!c.dns) return tool === 'wget' ? "wget: bad address 'ledger:8080'\ncommand terminated with exit code 1" : 'curl: (6) Could not resolve host: ledger\ncommand terminated with exit code 6';
    const port = hm[2] || '80';
    const open = who === 'pay-api' && c.ledgerIn && c.payOut && port === '8080';
    if (open) {
      c.payOk = true;
      return (hm[3] || '/') === '/healthz' ? 'ok' : '{"service":"ledger","status":"ok","entries":182347}';
    }
    if (who === 'notify' && c.dns && c.ledgerIn && c.payOut) c.notifyChecked = true;
    const note = port !== '8080' ? '\n(ledger Service ka port 8080 hai — curl ledger:8080/healthz)' : '';
    if (tool === 'wget') return 'wget: download timed out\ncommand terminated with exit code 1' + note;
    return (short ? 'curl: (28) Connection timed out after 5002 milliseconds' : 'curl: (28) Failed to connect to ledger port ' + port + ' after 130023 ms: Timeout was reached\n(~2 minute baad haara. Agli baar --max-time 5 lagao.)') + '\ncommand terminated with exit code 28' + note;
  }
  const T_NP = [
    { text: '<code>payments</code> namespace ki NetworkPolicies dekho', check: s => ran(s, /^kubectl get (netpol|networkpolicy|networkpolicies)\b/) },
    { text: '<code>default-deny</code> ka describe padho — kaun si direction band hai?', check: s => ran(s, /^kubectl describe (netpol|networkpolicy|networkpolicies)\b/) },
    { text: '<code>pay-api</code> ki nazar se dekho: logs padho, ya pod ke andar se <code>nslookup ledger</code>', check: s => ran(s, /^kubectl (logs .*pay-api|exec .*pay-api.* -- )/) },
    { text: 'Sabhi pods ke liye DNS ka raasta kholo', check: s => !!s.cluster.dns },
    { text: '<code>pay-api</code> → <code>ledger</code> ka raasta kholo aur <code>pay-api</code> ke andar se <code>curl ledger:8080/healthz</code> par <code>ok</code> lao', check: s => !!(s.cluster.payOk && s.cluster.dns && s.cluster.ledgerIn && s.cluster.payOut) },
    { text: 'Pakka karo ki <code>notify</code> ab bhi <code>ledger</code> tak <b>nahi</b> pahunchta', check: s => !!s.cluster.notifyChecked },
  ];
  const netCluster = {
    nodes: NODES,
    policies: ['default-deny', 'allow-alb-to-pay-api'],
    pods: PAY_API.map(p => Object.assign({}, p, { age: '3h' })).concat([
      { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-3', ip: '10.0.13.30' },
      { name: 'notify-7f6b9d-p1', ready: '1/1', status: 'Running', restarts: 0, age: '3h', node: 'node-1', ip: '10.0.12.25' },
    ]),
    deployments: [
      { name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' },
      { name: 'notify', ready: '1/1', upToDate: 1, available: 1, age: '40d' },
    ],
    statefulsets: [{ name: 'ledger', ready: '1/1', age: '40d' }],
    services: [
      { name: 'pay-api', type: 'ClusterIP', clusterIP: '10.100.20.5', ports: '80/TCP', age: '40d' },
      { name: 'ledger', type: 'ClusterIP', clusterIP: LEDGER_IP, ports: '8080/TCP', age: '40d' },
    ],
  };
  netSync(netCluster);
  addLab('netpol', {
    type: 'terminal',
    title: '🖥️ Mission: default-deny ne payments rok diye',
    instructions: 'Security audit ke baad ChaiPay ki security team ne 12 minute pehle payments namespace mein do NetworkPolicies lagayi: default-deny aur allow-alb-to-pay-api. Tab se har payment fail ho raha hai. Cluster ka CNI policies enforce karta hai. Audit ka niyam: default-deny hatana mana hai.',
    goal: `Payments wapas chalu karo: <code>pay-api</code> ko <code>ledger</code> (port 8080) tak pahunchna hai.
      <b>Sirf zaroori raaste kholo</b> — <code>notify</code> ko <code>ledger</code> tak nahi pahunchna chahiye. <code>default-deny</code> nahi hategi.`,
    tasks: T_NP,
    cluster: netCluster,
    responses: [
      { re: /^kubectl exec (.+?) -- (.+)$/,
        out: (s, m) => {
          const left = String((m && m[1]) || '').split(' ').filter((t, i, a) => !/^-/.test(t) && !/^(-n|--namespace|-c|--container)$/.test(a[i - 1] || ''));
          const target = left[0] || '';
          const who = /^(deploy(ment)?\/)?pay-api/.test(target) ? 'pay-api' : /^(deploy(ment)?\/)?notify/.test(target) ? 'notify' : /^(sts\/|statefulset\/)?ledger/.test(target) ? 'ledger' : null;
          if (!who) return `Error from server (NotFound): pods "${target}" not found\n(pods: ${s.cluster.pods.map(p => p.name).join(', ')})`;
          if (who === 'ledger') return '(is mission mein pay-api ya notify ke andar se ledger tak ka raasta jaancho)';
          return execNet(s, who, String((m && m[2]) || '').trim());
        } },
      { re: rx('kubectl delete (?:netpol|networkpolic(?:y|ies))[ /]default-deny'), err: true,
        out: '(simulator ne roka) Audit ka niyam: default-deny hatana mana hai. default-deny hatane se hack hua koi bhi pod phir se poore namespace tak pahunch jaata. Sirf zaroori raaste kholo.' },
      { re: /^kubectl delete (?:netpol|networkpolic(?:y|ies))\b/, err: true,
        out: '(simulator ne roka) Is mission mein policies hatani nahi hain — naye allow raaste jodne hain (ls se files dekho).' },
    ],
    files: {
      'allow-dns.yaml': { desc: 'Sabhi pods ko CoreDNS (port 53) tak jaane deta hai', content: NP_YAML['allow-dns.yaml'], apply: s => addPolicy(s, 'allow-dns') },
      'allow-ledger-from-pay-api.yaml': { desc: 'ledger ke andar sirf pay-api ka traffic (ingress)', content: NP_YAML['allow-ledger-from-pay-api.yaml'], apply: s => addPolicy(s, 'allow-ledger-from-pay-api') },
      'allow-pay-api-to-ledger.yaml': { desc: 'pay-api se bahar sirf ledger tak (egress)', content: NP_YAML['allow-pay-api-to-ledger.yaml'], apply: s => addPolicy(s, 'allow-pay-api-to-ledger') },
      'allow-all.yaml': {
        desc: 'payments ke sabhi pods ke liye sab kuch khol deta hai',
        content: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-all\n  namespace: payments\nspec:\n  podSelector: {}\n  policyTypes: [Ingress, Egress]\n  ingress: [ {} ]\n  egress: [ {} ]',
        apply: () => '(simulator ne roka) allow-all = default-deny ko bekaar karna. Policies jud kar kaam karti hain (additive): ek "sab allow" policy sab kuch khol deti hai. Phir hack hua notify pod bhi ledger tak pahunch jaata — audit wapas fail. Sirf zaroori raaste kholo.',
      },
    },
    success: KG.allOf(T_NP),
    successText: `<b>Do raaste band the:</b> (1) <b>DNS</b> — default-deny ne egress band kiya, toh pods CoreDNS (port 53) se <code>ledger</code> ka IP hi nahi pooch paaye.
      Log mein <code>lookup ... i/o timeout</code> = DNS band. (2) <b>pay-api → ledger</b> — default-deny <b>dono taraf</b> band karti hai:
      <code>pay-api</code> ka egress <b>aur</b> <code>ledger</code> ka ingress. Ek taraf kholne se kuch nahi hota; dono policies chahiye thi.<br>
      <b>Zero-trust bacha raha:</b> <code>notify</code> ab bhi <code>ledger</code> tak nahi pahunchta. Policies additive hain — tumne sirf teen chhote raaste jode.<br>
      <b>Agla ticket:</b> <code>notify</code> SMS gateway (internet) tak bhi nahi pahunch pa raha hoga — egress default-deny wahan bhi laga hai.`,
    hints: [
      'kubectl get netpol, phir kubectl describe netpol default-deny — Ingress aur Egress dono band hain. Phir kubectl logs pay-api-6b8d7c-a1.',
      'Log mein "lookup ... 10.100.0.10:53: i/o timeout" = DNS band. kubectl apply -f allow-dns.yaml, phir kubectl exec pay-api-6b8d7c-a1 -- nslookup ledger.',
      'DNS chal gaya par curl atka? Raasta dono taraf kholna hai: kubectl apply -f allow-ledger-from-pay-api.yaml aur kubectl apply -f allow-pay-api-to-ledger.yaml. Phir pay-api aur notify dono se: kubectl exec <pod> -- curl -s --max-time 5 ledger:8080/healthz',
    ],
    solution: ['kubectl get netpol', 'kubectl describe netpol default-deny', 'kubectl logs pay-api-6b8d7c-a1', 'kubectl apply -f allow-dns.yaml',
      'kubectl exec pay-api-6b8d7c-a1 -- nslookup ledger', 'kubectl apply -f allow-ledger-from-pay-api.yaml', 'kubectl apply -f allow-pay-api-to-ledger.yaml',
      'kubectl exec pay-api-6b8d7c-a1 -- curl -s --max-time 5 ledger:8080/healthz', 'kubectl exec notify-7f6b9d-p1 -- curl -s --max-time 5 ledger:8080/healthz'],
  }, {
    objectives: ['🖥️ <b>Terminal mission:</b> default-deny ke baad DNS aur pay-api → ledger kholo — par notify ke liye band rakho'],
    success: ['Main default-deny ke baad sirf zaroori raaste (DNS + dono taraf ka allow) khol sakta hoon aur test se pakka kar sakta hoon'],
    cards: [
      { front: 'Egress default-deny ke baad log: <code>lookup ledger... :53: i/o timeout</code> — kya band hai?', back: '<b>DNS.</b> Pods CoreDNS (port 53, UDP + TCP) tak nahi pahunch rahe. <code>allow-dns</code> egress policy: namespace <code>kube-system</code> + label <code>k8s-app: kube-dns</code>.' },
      { front: 'Ingress + Egress default-deny: A → B kholne ke liye kitni policies?', back: '<b>Do.</b> A par <b>egress</b> (B tak jaane do) <b>aur</b> B par <b>ingress</b> (A ko aane do). Ek taraf kholne se packet doosri taraf drop hota hai.' },
    ],
  });

  /* =====================================================================
     📈 autoscale — HPA cpu: <unknown> (CPU request hi nahi)
     ===================================================================== */
  const LOAD_M = 2550, REQ_M = 500;          // load test: 3 pods × 850m; fix ke baad request 500m
  const HPA_SUFFIX = ['h2k4p', 'm8q1z', 'r5t7w', 'x3c9v', 'b6n2j', 'f4d8s', 'k7l1q', 'p9w3e', 't2y6u', 'z5a8m', 'c3v7b', 'g8h2n'];
  const OLD_POD = 'pay-api-6b8d7c-a1';
  const hpaHead = (c, metric, cur, want) => `Name:                                                  pay-api
Namespace:                                             payments
Reference:                                             Deployment/pay-api
Metrics:                                               ( current / target )
  resource cpu on pods  (as a percentage of request):  ${metric} / ${c.target}%
Min replicas:                                          3
Max replicas:                                          12
Deployment pods:                                       ${cur} current / ${want} desired
Conditions:
  Type            Status  Reason                   Message
  ----            ------  ------                   -------
`;
  const HPA_FAIL = `failed to get cpu utilization: missing request for cpu in container "pay-api" of Pod "${OLD_POD}"`;
  function hpaSync(c) {
    const h = c.hpas[0], d = c.deployments.find(x => x.name === 'pay-api');
    if (!c.requested) {
      Object.assign(h, { targets: `cpu: <unknown>/${c.target}%`, replicas: 3 });
      h.describe = hpaHead(c, '<unknown>', 3, 3) +
        '  AbleToScale     True    SucceededGetScale        the HPA controller was able to get the target\'s current scale\n' +
        `  ScalingActive   False   FailedGetResourceMetric  the HPA was unable to compute the replica count: ${HPA_FAIL}\n` +
        'Events:\n  Type     Reason                        Age                From                       Message\n  ----     ------                        ----               ----                       -------\n' +
        `  Warning  FailedGetResourceMetric       15s (x24 over 6m)  horizontal-pod-autoscaler  ${HPA_FAIL}\n` +
        `  Warning  FailedComputeMetricsReplicas  15s (x24 over 6m)  horizontal-pod-autoscaler  invalid metrics (1 invalid out of 1), first error is: failed to get cpu resource metric value: ${HPA_FAIL}`;
      return;
    }
    const util0 = Math.round(LOAD_M / 3 / REQ_M * 100);                       // 170%
    const want = Math.min(12, Math.max(3, Math.ceil(3 * util0 / c.target)));
    const step1 = Math.min(want, Math.max(3 + 4, 3 * 2));                     // default scale-up: +4 pods ya 100% per 15s, jo zyada
    const perPod = Math.round(LOAD_M / want), util = Math.round(perPod / REQ_M * 100);
    Object.assign(h, { targets: `cpu: ${util}%/${c.target}%`, replicas: want });
    Object.assign(d, { ready: want + '/' + want, upToDate: want, available: want, describe: deployDesc(true, want) });
    c.pods = c.pods.filter(p => !/^pay-api/.test(p.name)).concat(HPA_SUFFIX.slice(0, want).map((x, i) => ({
      name: 'pay-api-7c9e5f4d8-' + x, ready: '1/1', status: 'Running', restarts: 0, age: i < 3 ? '1m' : '30s',
      node: NODES[i % 3].name, ip: '10.0.1' + (2 + i % 3) + '.' + (60 + i), top: perPod + 'm 300Mi' })));
    const rescale = n => `  Normal   SuccessfulRescale        30s                horizontal-pod-autoscaler  New size: ${n}; reason: cpu resource utilization (percentage of request) above target\n`;
    h.describe = hpaHead(c, `${util}% (${perPod}m)`, want, want) +
      '  AbleToScale     True    ReadyForNewScale         recommended size matches current size\n' +
      '  ScalingActive   True    ValidMetricFound         the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)\n' +
      '  ScalingLimited  False   DesiredWithinRange       the desired count is within the acceptable range\n' +
      'Events:\n  Type     Reason                   Age                From                       Message\n  ----     ------                   ----               ----                       -------\n' +
      `  Warning  FailedGetResourceMetric  2m (x24 over 8m)   horizontal-pod-autoscaler  ${HPA_FAIL}\n` +
      rescale(step1) + (want > step1 ? rescale(want).replace('30s', '15s') : '');
  }
  const deployDesc = (req, n) => `Name:                   pay-api
Namespace:              payments
Selector:               app=pay-api
Replicas:               ${n} desired | ${n} updated | ${n} total | ${n} available | 0 unavailable
StrategyType:           RollingUpdate
Pod Template:
  Labels:  app=pay-api
  Containers:
   pay-api:
    Image:      111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api:3.8.2
    Port:       8080/TCP${req ? '\n    Limits:\n      memory:  512Mi\n    Requests:\n      cpu:        500m\n      memory:     256Mi' : ''}
    Environment:
      LEDGER_URL:  http://ledger:8080
    Mounts:        <none>`;
  const T_HPA = [
    { text: 'HPA ka haal dekho (<code>kubectl get hpa</code>) — TARGETS column padho', check: s => ran(s, /^kubectl get (hpa|hpas)\b/) },
    { text: 'HPA <code>pay-api</code> ka describe padho — Conditions aur Events', check: s => ran(s, /^kubectl describe (hpa|hpas)\b/) },
    { text: 'Pakka karo ki metrics-server zinda hai (<code>kubectl top pods</code>)', check: s => ran(s, /^kubectl top (pods?|po)\b/) },
    { text: '<code>pay-api</code> ke container ko CPU request do', check: s => !!s.cluster.requested },
    { text: 'Fix ke baad <code>kubectl get hpa</code> — TARGETS mein number aaya? REPLICAS badhe?', check: s => !!s.cluster.requested && ranAfter(s, s.cluster.fixedAt, /^kubectl get (hpa|hpas)\b/) },
  ];
  const hpaCluster = {
    target: 60,
    nodes: NODES.map(n => Object.assign({}, n, { top: '71% 30%' })),
    pods: ['a1', 'b2', 'c3'].map((x, i) => ({ name: 'pay-api-6b8d7c-' + x, ready: '1/1', status: 'Running', restarts: 0, age: '2d', node: NODES[i].name, ip: '10.0.1' + (2 + i) + '.21', top: '850m 310Mi' }))
      .concat([{ name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-3', ip: '10.0.13.30', top: '240m 900Mi' }]),
    deployments: [{ name: 'pay-api', ready: '3/3', upToDate: 3, available: 3, age: '40d', describe: deployDesc(false, 3) }],
    hpas: [{ name: 'pay-api', reference: 'Deployment/pay-api', min: 3, max: 12, age: '25m' }],
  };
  hpaSync(hpaCluster);
  addLab('autoscale', {
    type: 'terminal',
    title: '🖥️ Mission: HPA hai, par andha hai',
    instructions: 'Kal ChaiPay ki Diwali sale hai. Aaj 4 baje load test chal raha hai: pay-api par 3 guna traffic. 25 minute pehle pay-api par HPA lagaya tha (min 3, max 12, CPU 60%). CPU bahut upar hai, p99 latency 1.8 second hai — par pay-api abhi bhi 3 pods par atka hai.',
    goal: `HPA <code>pay-api</code> ko kaam karne layak banao: <code>kubectl get hpa</code> ke TARGETS mein <b>asli number</b> aaye aur REPLICAS 3 se upar jaayein.
      Pehle pata karo: dikkat metrics-server mein hai ya pay-api mein?`,
    tasks: T_HPA,
    cluster: hpaCluster,
    responses: [
      { re: rx('kubectl scale (?:deploy(?:ment)?[ /])?pay-api --replicas[= ]\\d+'), err: true,
        out: '(simulator ne roka) Haath se replicas badhane se aaj ka load test nikal jaayega, par HPA abhi bhi andha rahega. Raat ko traffic girega toh extra pods bekaar chalenge, aur sale ki agli spike par phir kam padenge. Asli bimari theek karo.' },
    ],
    files: {
      'pay-api-requests.yaml': {
        desc: 'pay-api ke container ko CPU/memory requests deta hai',
        content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: pay-api\n  namespace: payments\nspec:\n  template:\n    spec:\n      containers:\n      - name: pay-api\n        resources:\n          requests:\n            cpu: 500m        # aam din ka usage ~280m, thodi jagah upar\n            memory: 256Mi\n          limits:\n            memory: 512Mi',
        apply: s => {
          const c = s.cluster;
          if (c.requested) return 'deployment.apps/pay-api unchanged';
          c.requested = true; c.fixedAt = s.history.length;
          hpaSync(c);
          return 'deployment.apps/pay-api configured\n(Rolling update: naye pay-api pods CPU request 500m ke saath. HPA ab "usage ÷ request" gin sakta hai — kuch second mein replicas badhenge. kubectl get hpa dekho.)';
        },
      },
      'hpa-target-90.yaml': {
        desc: 'HPA ka CPU target 60% se 90% karta hai',
        content: 'apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: pay-api\nspec:\n  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: pay-api }\n  minReplicas: 3\n  maxReplicas: 12\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target: { type: Utilization, averageUtilization: 90 }',
        apply: s => {
          const c = s.cluster;
          if (c.target === 90) return 'horizontalpodautoscaler.autoscaling/pay-api unchanged';
          c.target = 90; hpaSync(c);
          return 'horizontalpodautoscaler.autoscaling/pay-api configured';
        },
      },
      'install-metrics-server.sh': {
        desc: 'metrics-server dobara install karta hai',
        content: '#!/bin/sh\nhelm upgrade --install metrics-server metrics-server/metrics-server -n kube-system',
        apply: s => s.history.some(h => /^kubectl top/.test(h))
          ? '(simulator ne roka) metrics-server pehle se chal raha hai — kubectl top pods ne numbers diye the. Dobara install se HPA ka <unknown> nahi jaayega. "60%" kiska 60% hai? Wahi dhoondho.'
          : '(simulator ne roka) Install se pehle jaancho: kubectl top pods chalao. Numbers aaye toh metrics-server zinda hai.',
      },
    },
    success: KG.allOf(T_HPA),
    successText: `<code>kubectl top pods</code> ne numbers diye — metrics-server theek tha. HPA ka <b>60% = CPU usage ÷ CPU request</b>.
      <code>pay-api</code> mein request thi hi nahi, toh divide karne ke liye number hi nahi tha: TARGETS <code>&lt;unknown&gt;</code>, Condition <code>ScalingActive False</code>, event <code>missing request for cpu</code>.<br>
      Request 500m dete hi HPA ne gina: 850m ÷ 500m = 170%. Formula: <code>ceil(3 × 170 ÷ 60) = 9</code> replicas.
      HPA ek jhatke mein nahi badhta — default niyam se pehle 7, phir 9. Ab har pod ~283m (57%) par hai, target ke andar. (Target 90% kiya tha? Tab 6 replicas bante — target badalne se sirf ginti badli, ilaaj request hi tha.)<br>
      <b>Agla sawal:</b> 12 replicas bhi kam pade aur nodes bhar jaayein, toh pods Pending honge — tab nodes ka autoscaler (Karpenter / Cluster Autoscaler) chahiye.`,
    hints: [
      'kubectl get hpa — TARGETS mein <unknown> hai. kubectl describe hpa pay-api — Conditions aur Events ki line padho.',
      'Event kehta hai "missing request for cpu". Pehle kubectl top pods se dekho ki metrics-server numbers de raha hai. Phir kubectl describe deploy pay-api — Requests hain?',
      'kubectl apply -f pay-api-requests.yaml, phir kubectl get hpa.',
    ],
    solution: ['kubectl get hpa', 'kubectl describe hpa pay-api', 'kubectl top pods', 'kubectl describe deploy pay-api', 'kubectl apply -f pay-api-requests.yaml', 'kubectl get hpa'],
  }, {
    objectives: ['🖥️ <b>Terminal mission:</b> HPA ka <code>cpu: &lt;unknown&gt;</code> — metrics-server ya CPU request? Khud pakdo'],
    success: ['Main HPA ka &lt;unknown&gt; debug kar sakta hoon: <code>top pods</code> se metrics-server, describe se missing request'],
    cards: [{ front: 'HPA TARGETS <code>cpu: &lt;unknown&gt;/60%</code>, par <code>kubectl top pods</code> numbers deta hai — wajah?', back: 'metrics-server theek hai. Pod mein <b>CPU request nahi</b> hai. HPA ka % = usage ÷ <b>request</b>. Event: <code>missing request for cpu</code>. Fix: container ko <code>resources.requests.cpu</code> do.' }],
  });

  /* =====================================================================
     🎒 config — ConfigMap badla, par chalte pod mein purana value (env)
     (pehla YAML fix editor mission: vi → Save → apply)
     ===================================================================== */
  const CM0 = { UPI_TIMEOUT_MS: '3000', ENABLE_UPI_LITE: 'false', LEDGER_URL: 'http://ledger:8080' };
  const CM_FILE = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: pay-api-config\n  namespace: payments\ndata:\n  UPI_TIMEOUT_MS: "3000"      # NPCI (UPI) ka jawab kitni der tak rukein — milliseconds\n  ENABLE_UPI_LITE: "false"\n  LEDGER_URL: http://ledger:8080\n';
  const q = v => (/^(true|false|yes|no|on|off|null|~|[-+]?[0-9.]+)$/i.test(v) ? `"${v}"` : v);
  const cmDescribe = d => 'Name:         pay-api-config\nNamespace:    payments\nLabels:       <none>\nAnnotations:  <none>\n\nData\n====\n' +
    Object.keys(d).sort().map(k => `${k}:\n----\n${d[k]}\n`).join('\n') + '\nBinaryData\n====\n\nEvents:  <none>';
  const cmYamlOut = d => 'apiVersion: v1\ndata:\n' + Object.keys(d).sort().map(k => `  ${k}: ${q(d[k])}`).join('\n') +
    '\nkind: ConfigMap\nmetadata:\n  creationTimestamp: "2026-10-14T06:12:09Z"\n  name: pay-api-config\n  namespace: payments\n  resourceVersion: "4471823"\n  uid: 6c1d3b2a-9e4f-4a8b-b7c1-2f5e8d9a0c41';
  const POD_HASH = ['5f7d9c8b4', '7a2e6c9d1', '8c4b1f7e3', '9d6a3e2b5'];
  const payPods = s => s.cluster.pods.filter(p => /^pay-api-/.test(p.name));
  // ek ReplicaSet ke saare pods ka hash ek: rollout restart → naya hash; pod delete → wahi hash, naya suffix
  function newPayPod(c, i) {
    c.podN = (c.podN || 0) + 1;
    const hash = c.rs ? POD_HASH[(c.rs - 1) % POD_HASH.length].slice(0, 6) : '6b8d7c';
    const id = hash + '-' + ['q1', 'w2', 'e3', 'r4', 't5', 'y6', 'u7', 'i8'][(c.podN - 1) % 8];
    return { name: 'pay-api-' + id, ready: '1/1', status: 'Running', restarts: 0, age: '8s', node: NODES[i % 3].name, ip: '10.0.1' + (2 + i % 3) + '.' + (40 + c.podN), env: Object.assign({}, c.cm) };
  }
  const T_CFG = [
    { text: 'ConfigMap <code>pay-api-config</code> mein abhi ka timeout dekho', check: s => ran(s, /^kubectl describe (cm|configmaps?)\b|^kubectl get (cm|configmaps?)\b.*-o ?yaml|^cat pay-api-config\.yaml$/) },
    { text: '<code>vi pay-api-config.yaml</code> se <code>UPI_TIMEOUT_MS</code> ko 8000 karo, phir <code>kubectl apply</code>', check: s => s.cluster.cm.UPI_TIMEOUT_MS === '8000' },
    { text: 'Saare <code>pay-api</code> pods ko naya config do', check: s => s.cluster.cm.UPI_TIMEOUT_MS === '8000' && payPods(s).every(p => p.env.UPI_TIMEOUT_MS === '8000') },
    { text: 'Naye pod ke andar <code>printenv UPI_TIMEOUT_MS</code> se pakka karo: 8000', check: s => !!s.cluster.verified && payPods(s).every(p => p.env.UPI_TIMEOUT_MS === '8000') },
  ];
  addLab('config', {
    type: 'terminal',
    title: '🖥️ Mission: timeout badla, par app ko pata hi nahi',
    instructions: 'ChaiPay (UPI payments startup) ki pay-api har payment par NPCI (UPI ka system) ke jawab ka 3000 ms (3 second) tak intezaar karti hai. Aaj NPCI dheema hai — payments "timeout" ho rahe hain. Bank ne kaha: intezaar 8000 ms karo. Timeout pay-api-config naam ke ConfigMap mein hai; pay-api use env variable ki tarah padhti hai.',
    goal: `<code>UPI_TIMEOUT_MS</code> ko <b>8000</b> karo — aur pakka karo ki <b>saare chalte pay-api pods</b> sach mein 8000 use kar rahe hain.
      File badalne ke liye: <code>vi pay-api-config.yaml</code> → line badlo → <b>💾 Save</b> → <code>kubectl apply -f pay-api-config.yaml</code>.`,
    tasks: T_CFG,
    cluster: {
      cm: Object.assign({}, CM0),
      nodes: NODES,
      pods: PAY_API.map(p => Object.assign({}, p, { env: Object.assign({}, CM0) })),
      deployments: [{ name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' }],
      configmaps: [{ name: 'pay-api-config', dataCount: 3, age: '40d', describe: cmDescribe(CM0) }, { name: 'kube-root-ca.crt', dataCount: 1, age: '40d' }],
    },
    responses: [
      { re: rx('kubectl get (?:cm|configmaps?)[ /]pay-api-config -o ?yaml'), out: s => cmYamlOut(s.cluster.cm) },
      { re: /^kubectl exec (?:-it? |-ti )?(\S+?)(?: -n payments)? -- (?:printenv|env)(?: (\S+))?$/,
        out: (s, m) => {
          const c = s.cluster, want = String((m && m[1]) || '');
          const pods = payPods(s);
          const p = /^(deploy(ment)?\/)?pay-api$/.test(want) ? pods[0] : c.pods.find(x => x.name === want);
          if (!p) return `Error from server (NotFound): pods "${want}" not found\n(pods: ${c.pods.map(x => x.name).join(', ')})`;
          const env = Object.assign({ HOSTNAME: p.name }, p.env || {});
          const key = m && m[2];
          if (key && env[key] == null) return 'command terminated with exit code 1';
          if (key === 'UPI_TIMEOUT_MS' && env[key] === '8000' && c.cm.UPI_TIMEOUT_MS === '8000' && pods.every(x => x.env.UPI_TIMEOUT_MS === '8000')) c.verified = true;
          if (key) return env[key] + (key === 'UPI_TIMEOUT_MS' && env[key] !== c.cm.UPI_TIMEOUT_MS ? `\n(ConfigMap mein ab ${c.cm.UPI_TIMEOUT_MS} hai — par yeh pod ${p.age} purana hai aur env sirf container start hote waqt bharta hai)` : '');
          return Object.keys(env).map(k => `${k}=${env[k]}`).join('\n');
        } },
      { re: rx('kubectl rollout restart (?:deploy(?:ment)?)[ /]pay-api'),
        mutate: s => { const c = s.cluster; c.rs = (c.rs || 0) + 1; c.podN = 0; c.pods = c.pods.filter(p => !/^pay-api-/.test(p.name)).concat([newPayPod(c, 0), newPayPod(c, 1)]); },
        out: 'deployment.apps/pay-api restarted\n(rolling update: purane do pods ek-ek karke hate, naye do pods aaye — naye pods start hote waqt ConfigMap padhenge)' },
      { re: rx('kubectl rollout status (?:deploy(?:ment)?)[ /]pay-api'), out: 'deployment "pay-api" successfully rolled out' },
      { re: /^kubectl delete (?:pods?|po)[ /](pay-api-\S+?)(?: -n payments)?$/,
        out: (s, m) => {
          const c = s.cluster, name = String((m && m[1]) || ''), i = c.pods.findIndex(p => p.name === name);
          if (i < 0) return `Error from server (NotFound): pods "${name}" not found`;
          c.pods.splice(i, 1);
          const np = newPayPod(c, i);
          c.pods.push(np);
          return `pod "${name}" deleted\n(ReplicaSet ne naya pod banaya: ${np.name}. Doosra purana pod abhi bhi purane config par hai — saare pods ke liye: kubectl rollout restart deployment/pay-api)`;
        } },
    ],
    files: {
      'pay-api-config.yaml': {
        editable: true,
        desc: 'ConfigMap pay-api-config (git se) — vi se badlo',
        content: CM_FILE,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {};
          const name = d.metadata && d.metadata.name;
          if (d.kind !== 'ConfigMap') return { err: `error: is file mein ConfigMap chahiye (kind: ${d.kind || 'khaali'})` };
          if (name !== 'pay-api-config') return `configmap/${name} created\n(pay-api ka Deployment "pay-api-config" naam ka ConfigMap padhta hai — "${name}" ko koi use nahi karega. Naam wapas pay-api-config karo.)`;
          const data = d.data || {};
          const bad = Object.keys(data).find(k => data[k] !== null && typeof data[k] !== 'string');
          if (bad) {
            const t = typeof data[bad] === 'number' ? 'number' : typeof data[bad] === 'boolean' ? 'bool' : 'object';
            return { err: `Error from server (BadRequest): error when applying patch:\n{"data":{"${bad}":${JSON.stringify(data[bad])}}}\nto:\nResource: "/v1, Resource=configmaps", GroupVersionKind: "/v1, Kind=ConfigMap"\nName: "pay-api-config", Namespace: "payments"\nfor: "pay-api-config.yaml": error when patching "pay-api-config.yaml": ConfigMap in version "v1" cannot be handled as a ConfigMap: json: cannot unmarshal ${t} into Go struct field ConfigMap.data of type string\n(ConfigMap ki har value STRING hoti hai. ${bad} ki value quotes mein likho: "${data[bad]}")` };
          }
          if (data.LEDGER_URL !== CM0.LEDGER_URL) return { err: '(simulator ne roka) LEDGER_URL badal gaya ya hat gaya — pay-api ledger tak nahi pahunchegi. Is mission mein sirf UPI_TIMEOUT_MS badlo.' };
          const next = {};
          Object.keys(data).forEach(k => { next[k] = data[k] == null ? '' : data[k]; });
          if (JSON.stringify(next) === JSON.stringify(c.cm)) return 'configmap/pay-api-config unchanged';
          c.cm = next;
          Object.assign(c.configmaps[0], { dataCount: Object.keys(next).length, describe: cmDescribe(next) });
          return 'configmap/pay-api-config configured';
        },
      },
    },
    success: KG.allOf(T_CFG),
    successText: `ConfigMap badalna <b>aadha kaam</b> tha. <code>pay-api</code> timeout ko <b>env variable</b> se padhti hai — env sirf <b>container start</b> hote waqt bharta hai.
      Isliye ConfigMap 8000 ho gaya, par chalte pods 3000 hi bolte rahe. <code>kubectl rollout restart</code> ne naye pods banaye, jo naya value padh kar uthe.<br>
      <b>Yaad rakho:</b> env → restart chahiye. Volume mount → file ~1 minute mein khud badalti hai (app ko file dobara padhni hogi). <code>subPath</code> volume → kabhi nahi badalti.<br>
      <b>YAML ka jaal:</b> ConfigMap ki har value string hai — <code>8000</code> bina quotes number ban jaata hai aur API mana kar deta hai. <code>"8000"</code> likho.`,
    hints: [
      'kubectl describe cm pay-api-config se abhi ka value dekho. Phir vi pay-api-config.yaml — "3000" ko "8000" karo (quotes rehne do), 💾 Save, phir kubectl apply -f pay-api-config.yaml.',
      'Apply ke baad kubectl exec pay-api-6b8d7c-a1 -- printenv UPI_TIMEOUT_MS chalao. Abhi bhi 3000? Env sirf container start par bharta hai.',
      'kubectl rollout restart deployment/pay-api, phir kubectl get pods se naye naam dekho, phir kubectl exec <naya-pod> -- printenv UPI_TIMEOUT_MS',
    ],
    solution: ['kubectl describe cm pay-api-config', { edit: 'pay-api-config.yaml', change: [['UPI_TIMEOUT_MS: "3000"', 'UPI_TIMEOUT_MS: "8000"']] },
      'kubectl apply -f pay-api-config.yaml', 'kubectl exec pay-api-6b8d7c-a1 -- printenv UPI_TIMEOUT_MS', 'kubectl rollout restart deployment/pay-api',
      'kubectl get pods', 'kubectl exec pay-api-5f7d9c-q1 -- printenv UPI_TIMEOUT_MS'],
  }, {
    objectives: ['✏️ <b>YAML editor mission:</b> ConfigMap khud badlo (<code>vi</code>) — aur dekho ki chalte pod ko env ka naya value kyun nahi milta'],
    success: ['Main ConfigMap ki YAML khud badal kar apply kar sakta hoon, aur jaanta hoon ki env wale config ke baad rollout restart chahiye'],
    cards: [
      { front: 'ConfigMap badla, <code>printenv</code> abhi bhi purana value — kyun?', back: 'Env variable sirf <b>container start</b> par bharta hai. <code>kubectl rollout restart deployment/&lt;naam&gt;</code> se naye pods banao. (Volume mount ~1 min mein khud badalta hai; <code>subPath</code> kabhi nahi.)' },
      { front: 'ConfigMap mein <code>TIMEOUT: 8000</code> (bina quotes) — kya hoga?', back: 'API mana karega: <code>cannot unmarshal number into Go struct field ConfigMap.data of type string</code>. ConfigMap ki har value string hai → <code>"8000"</code>. Yahi <code>yes</code>/<code>no</code>/<code>true</code> ke saath bhi.' },
    ],
  });

  /* =====================================================================
     🗿 workloads — CronJob UTC mein chala (8:00 AM IST), timeZone do
     ===================================================================== */
  const CJ_SPEC_KEYS = ['schedule', 'timeZone', 'startingDeadlineSeconds', 'concurrencyPolicy', 'suspend', 'jobTemplate', 'successfulJobsHistoryLimit', 'failedJobsHistoryLimit'];
  const TZ_OFF = { 'Asia/Kolkata': 0, 'Asia/Calcutta': 0, UTC: 330, 'Etc/UTC': 330, 'Europe/London': 330, 'Asia/Dubai': 90, 'Asia/Singapore': -150, 'America/New_York': 630 };
  const CJ_FILE = 'apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: settlement\n  namespace: payments\nspec:\n  schedule: "30 2 * * *"        # roz raat 2:30 baje (team ne IST socha tha)\n  concurrencyPolicy: Forbid\n  successfulJobsHistoryLimit: 3\n  failedJobsHistoryLimit: 1\n  jobTemplate:\n    spec:\n      backoffLimit: 2\n      template:\n        spec:\n          restartPolicy: Never\n          containers:\n          - name: settlement\n            image: 111122223333.dkr.ecr.ap-south-1.amazonaws.com/settlement:2.1.0\n';
  const cjDescribe = c => `Name:                          settlement
Namespace:                     payments
Labels:                        app=settlement
Annotations:                   <none>
Schedule:                      ${c.schedule}
Concurrency Policy:            Forbid
Suspend:                       False
Successful Job History Limit:  3
Failed Job History Limit:      1
Starting Deadline Seconds:     <unset>
Selector:                      <unset>
Parallelism:                   <unset>
Completions:                   <unset>
Pod Template:
  Labels:  <none>
  Containers:
   settlement:
    Image:        111122223333.dkr.ecr.ap-south-1.amazonaws.com/settlement:2.1.0
Last Schedule Time:  Mon, 23 Nov 2026 02:30:00 +0000
Active Jobs:         <none>
Events:
  Type    Reason            Age    From                Message
  ----    ------            ----   ----                -------
  Normal  SuccessfulCreate  3h15m  cronjob-controller  Created job settlement-29923350
  Normal  SawCompletedJob   3h1m   cronjob-controller  Saw completed job: settlement-29923350, condition: Complete`;
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const T_CRON = [
    { text: '<code>kubectl get cronjob</code> — SCHEDULE aur TIMEZONE column padho', check: s => ran(s, /^kubectl get (cronjobs?|cj)\b/) },
    { text: '<code>settlement</code> ka describe padho — <code>Last Schedule Time</code> kis time zone mein hai?', check: s => ran(s, /^kubectl describe (cronjobs?|cj)\b/) },
    { text: 'CronJob theek karo: raat <b>2:30 IST</b> par chale (<code>vi settlement-cronjob.yaml</code> → Save → apply)', check: s => !!s.cluster.cjFixed },
    { text: 'Fix ke baad <code>kubectl get cronjob settlement</code> se pakka karo', check: s => !!s.cluster.cjFixed && ranAfter(s, s.cluster.fixedAt, /^kubectl get (cronjobs?|cj)\b/) },
  ];
  const cjCluster = {
    schedule: '30 2 * * *', tz: null,
    nodes: NODES,
    pods: PAY_API.concat([{ name: 'settlement-29923350-x7k2p', ready: '0/1', status: 'Completed', restarts: 0, age: '3h15m', node: 'node-2', ip: '10.0.12.77',
      logs: '2026-11-23T08:00:04+05:30 INFO settlement start: 1284 merchants\n2026-11-23T08:00:05+05:30 WARN ledger read slow (peak traffic): p99 2.4s\n2026-11-23T08:14:11+05:30 INFO settlement done: 1284 payouts sent' }]),
    custom: {
      cronjob: { names: ['cronjob', 'cronjobs', 'cj'], cols: ['NAME', 'SCHEDULE', 'TIMEZONE', 'SUSPEND', 'ACTIVE', 'LAST SCHEDULE', 'AGE'],
        items: [{ name: 'settlement', row: ['30 2 * * *', '<none>', 'False', '0', '3h15m', '12d'], describe: '' }] },
      job: { names: ['job', 'jobs'], cols: ['NAME', 'STATUS', 'COMPLETIONS', 'DURATION', 'AGE'],
        items: [{ name: 'settlement-29923350', row: ['Complete', '1/1', '14m', '3h15m'] }, { name: 'settlement-29921910', row: ['Complete', '1/1', '13m', '27h'] }, { name: 'settlement-29920470', row: ['Complete', '1/1', '15m', '2d3h'] }] },
    },
  };
  cjCluster.custom.cronjob.items[0].describe = cjDescribe(cjCluster);
  addLab('workloads', {
    type: 'terminal',
    title: '🖥️ Mission: settlement subah 8 baje kyun chala?',
    instructions: 'ChaiPay (UPI payments startup) ka settlement CronJob roz dukaandaaron ke paise unke bank mein bhejta hai. Team ne schedule "30 2 * * *" rakha tha — raat 2:30, jab traffic kam hota hai. Aaj subah 11:15 baje dukaandaaron ki shikayat aayi: paise 8 baje ke baad aaye, aur usi waqt pay-api dheemi thi.',
    goal: `Pata karo settlement <b>8:00 AM IST</b> par kyun chala, aur CronJob ko theek karo taaki woh <b>raat 2:30 IST</b> par chale.
      File: <code>vi settlement-cronjob.yaml</code> → badlo → <b>💾 Save</b> → <code>kubectl apply -f settlement-cronjob.yaml</code>.`,
    tasks: T_CRON,
    cluster: cjCluster,
    responses: [
      { re: /^kubectl logs (?:job\/)?settlement-29923350\S*(?: -n payments)?$/, out: s => s.cluster.pods.find(p => p.name.startsWith('settlement-29923350')).logs },
      { re: /^date$/, out: 'Mon Nov 23 05:45:10 UTC 2026\n(yeh terminal aur cluster ke controllers UTC mein chalte hain — IST = UTC + 5:30)' },
      { re: /^kubectl create job .*--from[= ]cronjob\/settlement/, err: true, out: '(simulator ne roka) Haath se settlement abhi chalana = dukaandaaron ko DOOSRI baar paise. Aaj ka settlement ho chuka hai. Sirf schedule theek karo.' },
    ],
    files: {
      'settlement-cronjob.yaml': {
        editable: true,
        desc: 'CronJob settlement (git se) — vi se badlo',
        content: CJ_FILE,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {}, sp = d.spec || {};
          if (d.kind !== 'CronJob' || !d.metadata || d.metadata.name !== 'settlement') return { err: 'error: is file mein CronJob "settlement" hi rehna chahiye (kind aur metadata.name mat badlo)' };
          const unknown = Object.keys(sp).find(k => !CJ_SPEC_KEYS.includes(k));
          if (unknown) return { err: `Error from server (BadRequest): error when patching "settlement-cronjob.yaml": CronJob in version "v1" cannot be handled as a CronJob: strict decoding error: unknown field "spec.${unknown}"` + (/^time.?zone$/i.test(unknown) ? '\n(field ka naam case-sensitive hai: timeZone — Z capital)' : '') };
          if (typeof sp.schedule !== 'string') return { err: `Error from server (BadRequest): error when patching "settlement-cronjob.yaml": CronJob in version "v1" cannot be handled as a CronJob: json: cannot unmarshal ${typeof sp.schedule === 'number' ? 'number' : 'object'} into Go struct field CronJobSpec.spec.schedule of type string` };
          if (/(^|\s)(CRON_)?TZ=/.test(sp.schedule)) return { err: `The CronJob "settlement" is invalid: spec.schedule: Invalid value: "${sp.schedule}": cannot use TZ or CRON_TZ in schedule, use timeZone field instead` };
          const f = sp.schedule.trim().split(/\s+/);
          if (f.length !== 5) return { err: `The CronJob "settlement" is invalid: spec.schedule: Invalid value: "${sp.schedule}": expected exactly 5 fields, found ${f.length}: ${sp.schedule}` };
          if (sp.timeZone != null && !(sp.timeZone in TZ_OFF)) return { err: `The CronJob "settlement" is invalid: spec.timeZone: Invalid value: "${sp.timeZone}": unknown time zone ${sp.timeZone}` + (/^IST$/i.test(sp.timeZone) ? '\n(IANA naam chahiye — India ke liye: Asia/Kolkata)' : '') };
          const same = c.schedule === sp.schedule && c.tz === (sp.timeZone || null);
          if (same) return 'cronjob.batch/settlement unchanged';
          c.schedule = sp.schedule; c.tz = sp.timeZone || null;
          const it = c.custom.cronjob.items[0];
          it.row[0] = c.schedule; it.row[1] = c.tz || '<none>'; it.describe = cjDescribe(c);
          const daily = /^\d+$/.test(f[0]) && /^\d+$/.test(f[1]) && f.slice(2).every(x => x === '*');
          const ist = daily ? (((+f[1]) * 60 + (+f[0]) + TZ_OFF[c.tz || 'UTC']) % 1440 + 1440) % 1440 : null;
          const was = !!c.cjFixed;
          c.cjFixed = ist === 150;
          if (c.cjFixed && !was) c.fixedAt = s.history.length;
          return 'cronjob.batch/settlement configured\n' + (daily
            ? `(simulator: agla run IST mein ${hhmm(ist)} par hoga${c.cjFixed ? ' ✓' : ' — 02:30 nahi'})`
            : '(simulator: yeh schedule roz ek baar nahi chalta — settlement roz ek baar chahiye)');
        },
      },
    },
    success: KG.allOf(T_CRON),
    successText: `CronJob controller (kube-controller-manager) ka ghadi <b>UTC</b> mein chalti hai. <code>30 2 * * *</code> = <b>02:30 UTC = 08:00 IST</b> — subah ka peak time.
      Saboot: describe mein <code>Last Schedule Time: … 02:30:00 +0000</code> (+0000 = UTC), aur job ke log mein <code>08:00:04+05:30</code>.<br>
      <b>Sahi fix:</b> <code>timeZone: Asia/Kolkata</code> (Kubernetes 1.27 se stable) — schedule wahi rehta hai, padhne wala samajh jaata hai.
      <code>0 21 * * *</code> (UTC mein raat 9 = IST 2:30) bhi chalta hai, par agla engineer use dekh kar confuse hoga.<br>
      <b>YAML ke jaal:</b> <code>timezone</code> (z chhota) → <code>unknown field</code>; <code>IST</code> → <code>unknown time zone</code>; bina quotes <code>*/5 * * * *</code> → YAML hi toot jaata hai.`,
    hints: [
      'kubectl get cronjob — TIMEZONE column mein kya hai? Phir kubectl describe cronjob settlement — "Last Schedule Time" ke aakhir mein +0000 dekho.',
      '+0000 = UTC. 02:30 UTC = 08:00 IST. vi settlement-cronjob.yaml — spec ke andar schedule ke neeche nayi line: timeZone: Asia/Kolkata (do space indent).',
      'Save karke kubectl apply -f settlement-cronjob.yaml, phir kubectl get cronjob settlement.',
    ],
    solution: ['kubectl get cronjob', 'kubectl describe cronjob settlement',
      { edit: 'settlement-cronjob.yaml', change: [['  concurrencyPolicy: Forbid', '  timeZone: Asia/Kolkata\n  concurrencyPolicy: Forbid']] },
      'kubectl apply -f settlement-cronjob.yaml', 'kubectl get cronjob settlement'],
  }, {
    objectives: ['✏️ <b>YAML editor mission:</b> CronJob 8 baje kyun chala? UTC vs IST pakdo aur <code>timeZone</code> khud likho'],
    success: ['Main CronJob ka time zone samajhta hoon aur YAML mein <code>timeZone</code> khud jod sakta hoon'],
    cards: [{ front: 'CronJob <code>30 2 * * *</code> subah 8 baje (IST) chala — kyun?', back: 'CronJob controller <b>UTC</b> mein chalta hai: 02:30 UTC = 08:00 IST. Fix: <code>spec.timeZone: Asia/Kolkata</code> (IANA naam; <code>IST</code> nahi chalega).' }],
  });

  /* =====================================================================
     🛡️ podsecurity — restricted PSA ne notify ke naye pods rok diye
     ===================================================================== */
  const NOTIFY_IMG = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/notify:4.2.0';
  const NOTIFY_FILE = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: notify\n  namespace: payments\nspec:\n  replicas: 2\n  selector:\n    matchLabels: { app: notify }\n  template:\n    metadata:\n      labels: { app: notify }\n    spec:\n      containers:\n      - name: notify\n        image: ' + NOTIFY_IMG + '\n        ports:\n        - containerPort: 8080\n        resources:\n          requests: { cpu: 100m, memory: 128Mi }\n';
  const POD_SC = ['runAsUser', 'runAsGroup', 'runAsNonRoot', 'fsGroup', 'fsGroupChangePolicy', 'seccompProfile', 'supplementalGroups', 'supplementalGroupsPolicy', 'sysctls', 'seLinuxOptions', 'seLinuxChangePolicy', 'windowsOptions', 'appArmorProfile'];
  const CTR_SC = ['allowPrivilegeEscalation', 'capabilities', 'privileged', 'procMount', 'readOnlyRootFilesystem', 'runAsGroup', 'runAsNonRoot', 'runAsUser', 'seLinuxOptions', 'seccompProfile', 'windowsOptions', 'appArmorProfile'];
  const RS_HASH = ['7c8d9f', '5b9e2a', '8d3f6c', '6a1c4e', '9e7b2d', '4f2a8c'];
  const badReq = (field, msg) => ({ err: `Error from server (BadRequest): error when patching "notify-deploy.yaml": Deployment in version "v1" cannot be handled as a Deployment: ${msg}` + (field ? '' : '') });
  /* asli pod-security-admission ke "restricted" checks, usi kram mein */
  function psaViolations(pod, ctr) {
    const psc = pod.securityContext || {}, csc = ctr.securityContext || {}, v = [];
    const n = `container "${ctr.name}"`;
    if (csc.privileged === true) v.push(`privileged (${n} must not set securityContext.privileged=true)`);
    if (csc.allowPrivilegeEscalation !== false) v.push(`allowPrivilegeEscalation != false (${n} must set securityContext.allowPrivilegeEscalation=false)`);
    const caps = csc.capabilities || {}, drop = Array.isArray(caps.drop) ? caps.drop : [], add = (Array.isArray(caps.add) ? caps.add : []).filter(x => x !== 'NET_BIND_SERVICE');
    const capMsg = [];
    if (!drop.includes('ALL')) capMsg.push(`${n} must set securityContext.capabilities.drop=["ALL"]`);
    if (add.length) capMsg.push(`${n} must not include ${add.map(x => '"' + x + '"').join(', ')} in securityContext.capabilities.add`);
    if (capMsg.length) v.push(`unrestricted capabilities (${capMsg.join('; ')})`);
    if (csc.runAsNonRoot === false) v.push(`runAsNonRoot != true (${n} must not set securityContext.runAsNonRoot=false)`);
    else if (csc.runAsNonRoot !== true && psc.runAsNonRoot !== true) v.push(`runAsNonRoot != true (pod or ${n} must set securityContext.runAsNonRoot=true)`);
    if (psc.runAsUser === 0 || csc.runAsUser === 0) v.push(`runAsUser=0 (pod and ${n} must not set runAsUser=0)`);
    const sp = (csc.seccompProfile || psc.seccompProfile || {}).type;
    if (sp !== 'RuntimeDefault' && sp !== 'Localhost') v.push(`seccompProfile (pod or ${n} must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")`);
    return v;
  }
  /* strict decoding + API validation — galat jagah / galat naam / galat type */
  function scErrors(pod, ctr) {
    const psc = pod.securityContext, csc = ctr.securityContext;
    const P = 'spec.template.spec.securityContext', C = 'spec.template.spec.containers[0].securityContext';
    if (psc && typeof psc === 'object') {
      const k = Object.keys(psc).find(x => !POD_SC.includes(x));
      if (k) return badReq(0, `strict decoding error: unknown field "${P}.${k}"` + (CTR_SC.includes(k) ? `\n(${k} container ke securityContext mein jaata hai, pod ke nahi)` : ''));
    }
    if (csc && typeof csc === 'object') {
      const k = Object.keys(csc).find(x => !CTR_SC.includes(x));
      if (k) return badReq(0, `strict decoding error: unknown field "${C}.${k}"` + (POD_SC.includes(k) ? `\n(${k} pod ke securityContext mein jaata hai, container ke nahi)` : ''));
      const caps = csc.capabilities;
      if (caps && typeof caps === 'object') {
        const ck = Object.keys(caps).find(x => !['add', 'drop'].includes(x));
        if (ck) return badReq(0, `strict decoding error: unknown field "${C}.capabilities.${ck}"`);
        if (caps.drop != null && !Array.isArray(caps.drop)) return badReq(0, `json: cannot unmarshal string into Go struct field Capabilities.${C.replace('[0]', '')}.capabilities.drop of type []v1.Capability\n(drop ek LIST hai: drop: ["ALL"])`);
      }
    }
    for (const [sc, path] of [[psc, P], [csc, C]]) {
      if (!sc || typeof sc !== 'object') continue;
      for (const b of ['runAsNonRoot', 'allowPrivilegeEscalation', 'privileged', 'readOnlyRootFilesystem'])
        if (sc[b] != null && typeof sc[b] !== 'boolean') return badReq(0, `json: cannot unmarshal ${typeof sc[b] === 'number' ? 'number' : 'string'} into Go struct field ${path.replace('[0]', '')}.${b} of type bool`);
      if (sc.runAsUser != null && typeof sc.runAsUser !== 'number') return badReq(0, `json: cannot unmarshal string into Go struct field ${path.replace('[0]', '')}.runAsUser of type int64`);
      const t = sc.seccompProfile && sc.seccompProfile.type;
      if (t != null && !['Localhost', 'RuntimeDefault', 'Unconfined'].includes(t)) return { err: `The Deployment "notify" is invalid: ${path}.seccompProfile.type: Unsupported value: "${t}": supported values: "Localhost", "RuntimeDefault", "Unconfined"` };
    }
    return null;
  }
  const PSA_HEAD = 'violates PodSecurity "restricted:latest": ';
  function rsDesc(c) {
    const h = c.rsHash, ev = c.viol.length
      ? `  Warning  FailedCreate  4s (x${c.rsN + 3} over 10m)  replicaset-controller  Error creating: pods "notify-${h}-" is forbidden: ${PSA_HEAD}${c.viol.join(', ')}`
      : `  Normal   SuccessfulCreate  20s  replicaset-controller  Created pod: notify-${h}-k2m4p`;
    return `Name:           notify-${h}\nNamespace:      payments\nSelector:       app=notify,pod-template-hash=${h}\nControlled By:  Deployment/notify\nReplicas:       ${c.viol.length ? 0 : 1} current / 1 desired\nPods Status:    0 Running / ${c.viol.length ? 0 : 1} Waiting / 0 Succeeded / 0 Failed\nPod Template:\n  Containers:\n   notify:\n    Image:  ${NOTIFY_IMG}\nConditions:\n  Type             Status  Reason\n  ----             ------  ------\n  ReplicaFailure   ${c.viol.length ? 'True    FailedCreate' : 'False   '}\nEvents:\n  Type     Reason        Age                From                   Message\n  ----     ------        ----               ----                   -------\n${ev}`;
  }
  function psaSync(c) {
    const rs = c.custom.rs.items, h = c.rsHash;
    const OLD = rs.find(x => x.name === 'notify-7f6b9d');
    c.custom.rs.items = [OLD].concat([{ name: 'notify-' + h, row: [c.rolled ? '2' : '1', c.viol.length ? '0' : (c.rolled ? '2' : '1'), c.rolled ? '2' : '0', '10m'], describe: rsDesc(c) }]);
    if (c.rolled) { OLD.row = ['0', '0', '0', '12d']; }
    c.pods = c.pods.filter(p => !/^notify-/.test(p.name) || (!c.rolled && /^notify-7f6b9d/.test(p.name)));
    if (c.rolled) ['k2m4p', 'r8t2w'].forEach((x, i) => c.pods.push({ name: `notify-${h}-${x}`, ready: '1/1', status: 'Running', restarts: 0, age: '15s', node: NODES[i].name, ip: '10.0.1' + (2 + i) + '.66' }));
    else if (!c.viol.length) c.pods.push({ name: `notify-${h}-k2m4p`, ready: '0/1', status: 'CreateContainerConfigError', restarts: 0, age: '20s', node: 'node-2', ip: '10.0.12.66',
      describe: `Name:             notify-${h}-k2m4p\nNamespace:        payments\nNode:             node-2/10.0.12.30\nStatus:           Pending\nContainers:\n  notify:\n    Image:          ${NOTIFY_IMG}\n    State:          Waiting\n      Reason:       CreateContainerConfigError\nEvents:\n  Type     Reason     Age               From               Message\n  ----     ------     ----              ----               -------\n  Normal   Scheduled  20s               default-scheduler  Successfully assigned payments/notify-${h}-k2m4p to node-2\n  Normal   Pulled     5s (x3 over 19s)  kubelet            Container image "${NOTIFY_IMG}" already present on machine\n  Warning  Failed     5s (x3 over 19s)  kubelet            Error: container has runAsNonRoot and image will run as root (pod: "notify-${h}-k2m4p_payments(3f2a9c1e-7b4d-4e8a-a1c6-5d9e0b2f7a13)", container: notify)` });
    Object.assign(c.deployments.find(d => d.name === 'notify'), c.rolled ? { ready: '2/2', upToDate: 2, available: 2 } : { ready: '2/2', upToDate: c.viol.length ? 0 : 1, available: 2 });
  }
  const T_PSA = [
    { text: '<code>notify</code> Deployment ka haal dekho (<code>kubectl get deploy</code> ya <code>rollout status</code>)', check: s => ran(s, /^kubectl (get (deploy|deployments?)\b|rollout status (deploy(ment)?)[ \/]notify)/) },
    { text: 'Naye pods kyun nahi bane? ReplicaSet ka describe ya events padho', check: s => ran(s, /^kubectl (describe (rs|replicasets?)\b|get (events|ev)\b)/) },
    { text: '<code>payments</code> namespace ke PSA labels dekho', check: s => ran(s, /^kubectl (describe (ns|namespaces?)\b|get (ns|namespaces?)\b.*--show-labels)/) },
    { text: '<code>notify-deploy.yaml</code> mein <code>securityContext</code> likho — PSA ke saare violations hatao', check: s => !!s.cluster.psaClean },
    { text: 'Naye <code>notify</code> pods <b>Running</b> hon — <code>kubectl get pods</code> se pakka karo', check: s => !!s.cluster.rolled && ranAfter(s, s.cluster.rolledAt, /^kubectl get (pods?|po)\b/) },
  ];
  const psaCluster = {
    rsN: 0, rsHash: RS_HASH[0], viol: [], rolled: false,
    nodes: NODES,
    pods: PAY_API.concat([
      { name: 'notify-7f6b9d-p1', ready: '1/1', status: 'Running', restarts: 0, age: '12d', node: 'node-1', ip: '10.0.12.25' },
      { name: 'notify-7f6b9d-p2', ready: '1/1', status: 'Running', restarts: 0, age: '12d', node: 'node-3', ip: '10.0.13.25' },
    ]),
    deployments: [{ name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' }, { name: 'notify', ready: '2/2', upToDate: 0, available: 2, age: '40d' }],
    events: ['LAST SEEN   TYPE      REASON         OBJECT                     MESSAGE'],
    custom: {
      rs: { names: ['rs', 'replicaset', 'replicasets'], cols: ['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE'],
        items: [{ name: 'notify-7f6b9d', row: ['2', '2', '2', '12d'], describe: 'Name:           notify-7f6b9d\nNamespace:      payments\nControlled By:  Deployment/notify\nReplicas:       2 current / 2 desired\nPods Status:    2 Running / 0 Waiting / 0 Succeeded / 0 Failed\nPod Template:\n  Containers:\n   notify:\n    Image:  111122223333.dkr.ecr.ap-south-1.amazonaws.com/notify:4.1.3\nEvents:         <none>' }] },
      ns: { names: ['ns', 'namespace', 'namespaces'], cols: ['NAME', 'STATUS', 'AGE'],
        items: [{ name: 'payments', row: ['Active', '40d'], describe: 'Name:         payments\nLabels:       kubernetes.io/metadata.name=payments\n              pod-security.kubernetes.io/enforce=restricted\n              pod-security.kubernetes.io/enforce-version=latest\n              pod-security.kubernetes.io/warn=restricted\nAnnotations:  <none>\nStatus:       Active\n\nNo resource quota.\n\nNo LimitRange resource.' },
          { name: 'kube-system', row: ['Active', '40d'], describe: 'Name:         kube-system\nLabels:       kubernetes.io/metadata.name=kube-system\nStatus:       Active' }] },
    },
  };
  psaCluster.viol = psaViolations(KG.yaml.parse(NOTIFY_FILE).spec.template.spec, KG.yaml.parse(NOTIFY_FILE).spec.template.spec.containers[0]);
  psaSync(psaCluster);
  psaCluster.events.push(`4s          Warning   FailedCreate   replicaset/notify-7c8d9f   Error creating: pods "notify-7c8d9f-" is forbidden: ${PSA_HEAD}${psaCluster.viol.join(', ')}`);
  addLab('podsecurity', {
    type: 'terminal',
    title: '🖥️ Mission: notify ka naya version cluster ne andar hi nahi aane diya',
    instructions: 'ChaiPay (UPI payments startup) ki security team ne pichhle hafte payments namespace par Pod Security "restricted" enforce lagaya. Purane pods chalte rahe (PSA sirf NAYE pods rokta hai). Aaj Diwali SMS campaign ke liye notify 4.2.0 deploy kiya — 10 minute se ek bhi naya pod nahi bana.',
    goal: `<code>notify</code> 4.2.0 ke pods <b>Running</b> karo — <b>restricted</b> policy hataye bina.
      File: <code>vi notify-deploy.yaml</code> → <code>securityContext</code> likho → <b>💾 Save</b> → <code>kubectl apply -f notify-deploy.yaml</code>. Error ka har shabd padho — woh batata hai kya kami hai.`,
    tasks: T_PSA,
    cluster: psaCluster,
    responses: [
      { re: rx('kubectl rollout status (?:deploy(?:ment)?)[ /]notify'),
        out: s => s.cluster.rolled ? 'deployment "notify" successfully rolled out' : 'Waiting for deployment "notify" rollout to finish: ' + (s.cluster.viol.length ? 0 : 1) + ' out of 2 new replicas have been updated...\n(ruk gaya — Ctrl+C. Naye pods ban hi nahi rahe; wajah ReplicaSet ke events mein hai)' },
      { re: rx('kubectl get (?:ns|namespaces?) payments --show-labels'), out: 'NAME       STATUS   AGE   LABELS\npayments   Active   40d   kubernetes.io/metadata.name=payments,pod-security.kubernetes.io/enforce-version=latest,pod-security.kubernetes.io/enforce=restricted,pod-security.kubernetes.io/warn=restricted' },
      { re: /^kubectl label (?:ns|namespaces?) payments\b/, err: true, out: '(simulator ne roka) payments namespace PCI-DSS audit ke andar hai — restricted hatana ya baseline karna mana hai. Pod ko policy ke laayak banao, policy ko pod ke laayak nahi.' },
    ],
    files: {
      'notify-deploy.yaml': {
        editable: true,
        desc: 'notify ka Deployment (git se) — vi se securityContext jodo',
        content: NOTIFY_FILE,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {};
          if (d.kind !== 'Deployment' || !d.metadata || d.metadata.name !== 'notify') return { err: 'error: is file mein Deployment "notify" hi rehna chahiye' };
          const pod = KG.yaml.get(d, 'spec.template.spec') || {};
          const ctr = (pod.containers || []).find(x => x && x.name === 'notify');
          if (!ctr || ctr.image !== NOTIFY_IMG) return { err: '(simulator ne roka) container "notify" aur uski image 4.2.0 waisi hi rakho — sirf securityContext jodna hai.' };
          const e = scErrors(pod, ctr);
          if (e) return e;
          const key = JSON.stringify([pod.securityContext || null, ctr.securityContext || null]);
          if (key === c.lastKey) return 'deployment.apps/notify unchanged';
          c.lastKey = key;
          c.viol = psaViolations(pod, ctr);
          c.rsN++; c.rsHash = RS_HASH[c.rsN % RS_HASH.length];
          const runsAs = (ctr.securityContext || {}).runAsUser != null ? ctr.securityContext.runAsUser : (pod.securityContext || {}).runAsUser;
          c.psaClean = !c.viol.length;
          c.rolled = c.psaClean && runsAs != null && runsAs !== 0;
          if (c.rolled) c.rolledAt = s.history.length;
          psaSync(c);
          const warn = c.viol.length ? `Warning: would violate PodSecurity "restricted:latest": ${c.viol.join(', ')}\n` : '';
          return warn + 'deployment.apps/notify configured' + (c.viol.length
            ? `\n(Deployment toh badla, par naya ReplicaSet notify-${c.rsHash} abhi bhi pod nahi bana payega — upar ki ${c.viol.length} kami baaki hai)`
            : c.rolled ? `\n(rolling update: notify-${c.rsHash} ke naye pods ban rahe hain — kubectl get pods)`
              : `\n(PSA ab khush hai — pod ban gaya. kubectl get pods se dekho ki pod chala ya nahi.)`);
        },
      },
    },
    success: KG.allOf(T_PSA),
    successText: `PSA <b>restricted</b> har naye pod se chaar cheezein maangta hai: <code>allowPrivilegeEscalation: false</code>, <code>capabilities.drop: ["ALL"]</code>,
      <code>runAsNonRoot: true</code>, aur <code>seccompProfile.type: RuntimeDefault</code>. Error message mein har kami ka <b>exact field</b> likha hota hai — use padh kar YAML likho.<br>
      <b>Doosra jaal:</b> <code>runAsNonRoot: true</code> sirf <i>jaanch</i> hai. notify ki image root (UID 0) se chalti hai, toh kubelet ne container roka: <code>container has runAsNonRoot and image will run as root</code>.
      <code>runAsUser: 10001</code> ne asli user diya. (Behtar ilaaj: Dockerfile mein <code>USER 10001</code>.)<br>
      <b>Jagah ka dhyaan:</b> <code>allowPrivilegeEscalation</code> aur <code>capabilities</code> <b>container</b> ke securityContext mein; <code>runAsNonRoot</code>, <code>runAsUser</code>, <code>seccompProfile</code> dono jagah chal jaate hain.`,
    hints: [
      'kubectl get deploy — notify ka UP-TO-DATE 0 hai. kubectl get rs, phir kubectl describe rs notify-7c8d9f — Events ki line mein 4 kamiyan likhi hain. kubectl describe ns payments se label dekho.',
      'vi notify-deploy.yaml — container (image wali line ke neeche, 8 space indent) mein:  securityContext: → allowPrivilegeEscalation: false, capabilities: drop: ["ALL"], runAsNonRoot: true, seccompProfile: type: RuntimeDefault.',
      'PSA paas, par pod CreateContainerConfigError? kubectl describe pod se padho: image root se chalti hai. Container ke securityContext mein runAsUser: 10001 bhi jodo, phir apply aur kubectl get pods.',
    ],
    solution: ['kubectl get deploy', 'kubectl get rs', 'kubectl describe rs notify-7c8d9f', 'kubectl describe ns payments',
      { edit: 'notify-deploy.yaml', change: [['        image: ' + NOTIFY_IMG + '\n', '        image: ' + NOTIFY_IMG + '\n        securityContext:\n          allowPrivilegeEscalation: false\n          capabilities:\n            drop: ["ALL"]\n          runAsNonRoot: true\n          seccompProfile:\n            type: RuntimeDefault\n']] },
      'kubectl apply -f notify-deploy.yaml', 'kubectl get pods', 'kubectl describe pod notify-5b9e2a-k2m4p',
      { edit: 'notify-deploy.yaml', change: [['          runAsNonRoot: true\n', '          runAsNonRoot: true\n          runAsUser: 10001\n']] },
      'kubectl apply -f notify-deploy.yaml', 'kubectl get pods'],
  }, {
    objectives: ['✏️ <b>YAML editor mission:</b> PSA <code>restricted</code> ne pods roke — error padh kar <code>securityContext</code> khud likho'],
    success: ['Main PSA restricted ka error padh kar sahi <code>securityContext</code> (sahi jagah par) likh sakta hoon'],
    cards: [
      { front: 'PSA <b>restricted</b> ke liye container ko kya chahiye (4 cheezein)?', back: '<code>allowPrivilegeEscalation: false</code> · <code>capabilities: { drop: ["ALL"] }</code> · <code>runAsNonRoot: true</code> · <code>seccompProfile: { type: RuntimeDefault }</code>. Pehli do sirf <b>container</b> ke securityContext mein.' },
      { front: '<code>container has runAsNonRoot and image will run as root</code> — matlab?', back: 'PSA paas ho gaya, par image ka user root (UID 0) hai. <code>runAsNonRoot</code> sirf jaanch hai. <code>runAsUser: 10001</code> do, ya Dockerfile mein <code>USER 10001</code>.' },
    ],
  });

  /* =====================================================================
     🗝️ secrets — ExternalSecret ka AWS path badla; ledger purane password par
     ===================================================================== */
  const ES_FILE = 'apiVersion: external-secrets.io/v1\nkind: ExternalSecret\nmetadata:\n  name: ledger-db\n  namespace: payments\nspec:\n  refreshInterval: 1h\n  secretStoreRef:\n    name: aws-sm\n    kind: SecretStore\n  target:\n    name: ledger-db            # Kubernetes Secret jo ESO banata/update karta hai\n    creationPolicy: Owner\n  data:\n  - secretKey: password        # Secret ledger-db ki key (ledger isi ko padhta hai)\n    remoteRef:\n      key: chaipay/prod/ledger-db    # AWS Secrets Manager mein secret ka naam\n      property: password\n';
  const SM = { 'chaipay/prod/pay-api/upi-key': ['upi_key'], 'chaipay/prod/ledger/db': ['username', 'password', 'host'], 'chaipay/prod/notify/sms-token': ['token'] };
  const esDesc = c => `Name:         ledger-db
Namespace:    payments
API Version:  external-secrets.io/v1
Kind:         ExternalSecret
Spec:
  Data:
    Remote Ref:
      Key:       ${c.esKey}
      Property:  ${c.esProp}
    Secret Key:  password
  Refresh Interval:  1h
  Secret Store Ref:
    Kind:  SecretStore
    Name:  aws-sm
  Target:
    Creation Policy:  Owner
    Name:             ledger-db
Status:
  Conditions:
    Last Transition Time:  ${c.synced ? '2026-11-23T05:02:11Z' : '2026-11-22T22:05:40Z'}
    Message:               ${c.synced ? 'secret synced' : 'could not get secret data from provider'}
    Reason:                ${c.synced ? 'SecretSynced' : 'SecretSyncedError'}
    Status:                ${c.synced ? 'True' : 'False'}
    Type:                  Ready
  Refresh Time:            ${c.synced ? '2026-11-23T05:02:11Z' : '2026-11-20T09:12:03Z'}
Events:
  Type     Reason        Age               From              Message
  ----     ------        ----              ----              -------
${c.synced ? '  Warning  UpdateFailed  4m (x7 over 7h)   external-secrets  error retrieving secret at .data[0], key: chaipay/prod/ledger-db, err: Secret does not exist\n  Normal   Updated       5s                external-secrets  Updated Secret' : '  Warning  UpdateFailed  ' + (c.esErrAge || '4m (x7 over 7h)  ') + ' external-secrets  ' + c.esErr}`;
  const LEDGER_CRASH = '2026-11-23T10:21:07+05:30 INFO ledger starting (v5.0.3)\n2026-11-23T10:21:08+05:30 FATAL could not connect to ledger-db.c9xk2m1q.ap-south-1.rds.amazonaws.com:5432: FATAL:  password authentication failed for user "ledger_app"';
  const ledgerPod = (status, restarts, age) => ({ name: 'ledger-0', ready: status === 'Running' ? '1/1' : '0/1', status, restarts, age, node: 'node-3', ip: '10.0.13.30',
    logs: status === 'Running' ? '2026-11-23T10:32:40+05:30 INFO ledger starting (v5.0.3)\n2026-11-23T10:32:41+05:30 INFO connected to ledger-db.c9xk2m1q.ap-south-1.rds.amazonaws.com:5432 as ledger_app\n2026-11-23T10:32:41+05:30 INFO ready: 182347 entries' : LEDGER_CRASH,
    prevLogs: status === 'Running' ? undefined : LEDGER_CRASH,
    describe: `Name:             ledger-0\nNamespace:        payments\nNode:             node-3/10.0.13.12\nStatus:           Running\nControlled By:    StatefulSet/ledger\nContainers:\n  ledger:\n    Image:          111122223333.dkr.ecr.ap-south-1.amazonaws.com/ledger:5.0.3\n    State:          ${status === 'Running' ? 'Running' : 'Waiting\n      Reason:       CrashLoopBackOff'}\n    Restart Count:  ${restarts}\n    Environment:\n      DB_HOST:      ledger-db.c9xk2m1q.ap-south-1.rds.amazonaws.com\n      DB_USER:      ledger_app\n      DB_PASSWORD:  <set to the key 'password' in secret 'ledger-db'>  Optional: false\n${status === 'Running' ? 'Events:          <none>' : 'Events:\n  Type     Reason   Age                 From     Message\n  ----     ------   ----                ----     -------\n  Warning  BackOff  30s (x24 over 11m)  kubelet  Back-off restarting failed container ledger in pod ledger-0_payments(8e1d4c2a-5f7b-4a9e-b3c6-1d2e9f0a8b47)'}` });
  const T_ESO = [
    { text: '<code>ledger-0</code> ka log padho — kya fail ho raha hai?', check: s => ran(s, /^kubectl logs .*ledger-0/) },
    { text: 'ExternalSecret <code>ledger-db</code> ka haal aur Events dekho', check: s => ran(s, /^kubectl describe (externalsecrets?|es)\b/) },
    { text: 'AWS Secrets Manager mein secret ka asli naam dhoondho', check: s => ran(s, /^aws secretsmanager list-secrets\b/) },
    { text: '<code>ledger-db-externalsecret.yaml</code> theek karo aur apply karo — ExternalSecret <b>SecretSynced</b> ho', check: s => !!s.cluster.synced },
    { text: '<code>ledger-0</code> ko naya password do aur log se pakka karo: <code>connected</code>', check: s => !!s.cluster.ledgerUp && ranAfter(s, s.cluster.upAt, /^kubectl logs .*ledger-0/) },
  ];
  const esCluster = {
    esKey: 'chaipay/prod/ledger-db', esProp: 'password', synced: false, esErr: 'error retrieving secret at .data[0], key: chaipay/prod/ledger-db, err: Secret does not exist',
    nodes: NODES,
    pods: PAY_API.concat([ledgerPod('CrashLoopBackOff', 7, '52m')]),
    statefulsets: [{ name: 'ledger', ready: '0/1', age: '40d' }],
    secrets: [{ name: 'ledger-db', type: 'Opaque', dataCount: 1, age: '40d', describe: 'Name:         ledger-db\nNamespace:    payments\nLabels:       reconcile.external-secrets.io/managed=true\nAnnotations:  reconcile.external-secrets.io/data-hash: 5c1f0a9e2b7d4c83\n\nType:  Opaque\n\nData\n====\npassword:  16 bytes' }],
    custom: {
      externalsecret: { names: ['externalsecret', 'externalsecrets', 'es'], cols: ['NAME', 'STORETYPE', 'STORE', 'REFRESH INTERVAL', 'STATUS', 'READY'],
        items: [{ name: 'ledger-db', row: ['SecretStore', 'aws-sm', '1h', 'SecretSyncedError', 'False'], describe: '' }] },
      secretstore: { names: ['secretstore', 'secretstores', 'ss'], cols: ['NAME', 'AGE', 'STATUS', 'CAPABILITIES', 'READY'],
        items: [{ name: 'aws-sm', row: ['40d', 'Valid', 'ReadWrite', 'True'], describe: 'Name:         aws-sm\nNamespace:    payments\nSpec:\n  Provider:\n    Aws:\n      Region:   ap-south-1\n      Service:  SecretsManager\n      Auth:     (Pod Identity: external-secrets ServiceAccount)\nStatus:\n  Conditions:\n    Reason:   Valid\n    Status:   True\n    Type:     Ready' }] },
    },
  };
  esCluster.custom.externalsecret.items[0].describe = esDesc(esCluster);
  addLab('secrets', {
    type: 'terminal',
    title: '🖥️ Mission: password badla, ledger ko khabar nahi',
    instructions: 'ChaiPay (UPI payments startup) ka ledger apna DB password Kubernetes Secret "ledger-db" se padhta hai. Secret ko External Secrets Operator (ESO) AWS Secrets Manager se bharta hai. Raat 3 baje security team ne naya naming standard lagaya: secret naye naam par banaya, password rotate kiya, aur purana secret force-delete kar diya. Subah 9:40 par node upgrade hua — ledger-0 restart hua aur tab se CrashLoopBackOff mein hai.',
    goal: `<code>ledger-0</code> ko <b>Running</b> karo — sahi tareeke se: ESO wapas sync ho, password haath se mat daalo.
      File: <code>vi ledger-db-externalsecret.yaml</code> → badlo → <b>💾 Save</b> → <code>kubectl apply -f ledger-db-externalsecret.yaml</code>.`,
    tasks: T_ESO,
    cluster: esCluster,
    responses: [
      { re: /^aws secretsmanager list-secrets\b/, out: '[\n    "chaipay/prod/pay-api/upi-key",\n    "chaipay/prod/ledger/db",\n    "chaipay/prod/notify/sms-token"\n]\n(simulator: --query \'SecretList[].Name\' wala chhota roop dikha raha hoon)' },
      { re: /^aws secretsmanager describe-secret --secret-id[= ](\S+)/,
        out: (s, m) => {
          const id = String((m && m[1]) || '').replace(/["']/g, '');
          if (!SM[id]) return `An error occurred (ResourceNotFoundException) when calling the DescribeSecret operation: Secrets Manager can't find the specified secret.`;
          return `{\n    "Name": "${id}",\n    "Description": "${id === 'chaipay/prod/ledger/db' ? 'ledger RDS creds (naya naming standard, 2026-11)' : 'ChaiPay prod'}",\n    "LastRotatedDate": "${id === 'chaipay/prod/ledger/db' ? '2026-11-23T03:00:12+05:30' : '2026-10-02T11:20:00+05:30'}",\n    "Tags": [{ "Key": "team", "Value": "${id.split('/')[2]}" }]\n}`;
        } },
      { re: /^aws secretsmanager get-secret-value\b/, err: true, out: '(simulator ne roka) Password terminal mein chhapna = shell history aur screen-share mein password. Yeh kaam ESO ka hai — ExternalSecret theek karo.' },
      { re: /^aws\b/, out: 'Is mission mein aws ke yeh commands chalte hain:\n  aws secretsmanager list-secrets\n  aws secretsmanager describe-secret --secret-id <naam>' },
      { re: rx('kubectl delete (?:pods?|po)[ /]ledger-0'),
        mutate: s => { const c = s.cluster; if (!c.synced || c.ledgerUp) return; c.ledgerUp = true; c.upAt = s.history.length; c.pods = c.pods.filter(p => p.name !== 'ledger-0').concat([ledgerPod('Running', 0, '6s')]); c.statefulsets[0].ready = '1/1'; },
        out: s => 'pod "ledger-0" deleted\n' + (s.cluster.ledgerUp ? '(StatefulSet ne ledger-0 dobara banaya — naya container Secret ka naya password padh kar utha)' : '(StatefulSet ne ledger-0 dobara banaya — par Secret mein abhi bhi purana password hai. Pehle ExternalSecret theek karo.)') },
      { re: rx('kubectl rollout restart (?:sts|statefulset)[ /]ledger'),
        mutate: s => { const c = s.cluster; if (!c.synced || c.ledgerUp) return; c.ledgerUp = true; c.upAt = s.history.length; c.pods = c.pods.filter(p => p.name !== 'ledger-0').concat([ledgerPod('Running', 0, '6s')]); c.statefulsets[0].ready = '1/1'; },
        out: s => 'statefulset.apps/ledger restarted' + (s.cluster.ledgerUp ? '' : '\n(naya ledger-0 bhi purana password padhega — pehle ExternalSecret theek karo)') },
    ],
    files: {
      'ledger-db-externalsecret.yaml': {
        editable: true,
        desc: 'ExternalSecret ledger-db (git se) — vi se badlo',
        content: ES_FILE,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {};
          if (d.kind !== 'ExternalSecret' || !d.metadata || d.metadata.name !== 'ledger-db') return { err: 'error: is file mein ExternalSecret "ledger-db" hi rehna chahiye' };
          const item = (KG.yaml.get(d, 'spec.data') || [])[0] || {}, ref = item.remoteRef || {};
          if (item.secretKey !== 'password') return { err: '(simulator ne roka) secretKey "password" hi rehna chahiye — ledger Secret ledger-db ki key "password" padhta hai.' };
          if (KG.yaml.get(d, 'spec.target.name') !== 'ledger-db') return { err: '(simulator ne roka) target.name "ledger-db" hi rehna chahiye — ledger isi Secret ko padhta hai.' };
          const key = String(ref.key || ''), prop = String(ref.property || '');
          if (key === c.esKey && prop === c.esProp) return 'externalsecret.external-secrets.io/ledger-db unchanged';
          c.esKey = key; c.esProp = prop;
          const it = c.custom.externalsecret.items[0];
          if (!SM[key]) { c.synced = false; c.esErr = `error retrieving secret at .data[0], key: ${key}, err: Secret does not exist`; c.esErrAge = '3s              '; }
          else if (!SM[key].includes(prop)) { c.synced = false; c.esErr = `error retrieving secret at .data[0], key: ${key}, err: key ${prop} does not exist in secret ${key}`; c.esErrAge = '3s              '; }
          else if (prop !== 'password') { c.synced = false; c.esErr = `(simulator) "${prop}" sync ho jaata — par Secret mein password ki jagah ${prop} chala jaata aur ledger phir fail hota. property: password rakho.`; c.esErrAge = '3s              '; }
          else {
            c.synced = true;
            Object.assign(c.secrets[0], { describe: 'Name:         ledger-db\nNamespace:    payments\nLabels:       reconcile.external-secrets.io/managed=true\nAnnotations:  reconcile.external-secrets.io/data-hash: 9a3e7c1b5d2f8e46\n\nType:  Opaque\n\nData\n====\npassword:  24 bytes' });
          }
          it.row = ['SecretStore', 'aws-sm', '1h', c.synced ? 'SecretSynced' : 'SecretSyncedError', c.synced ? 'True' : 'False'];
          it.describe = esDesc(c);
          return 'externalsecret.external-secrets.io/ledger-db configured\n' + (c.synced
            ? '(ESO ne turant sync kiya: Secret ledger-db mein naya password. kubectl get externalsecret se dekho.)'
            : '(ESO sync abhi bhi fail — kubectl describe externalsecret ledger-db ke Events padho)');
        },
      },
      'ledger-db-secret-manual.yaml': {
        desc: 'Secret ledger-db haath se — naya password seedha likha hua',
        content: 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: ledger-db\n  namespace: payments\nstringData:\n  password: "<AWS console se copy kiya hua password>"',
        apply: () => ({ err: '(simulator ne roka) Haath se Secret = password git / terminal history mein, aur ExternalSecret ab bhi toota hai. Agli rotation par phir yahi hoga — aur ESO (creationPolicy: Owner) sync theek hote hi tumhara haath ka badlaav mita dega. ExternalSecret theek karo.' }),
      },
    },
    success: KG.allOf(T_ESO),
    successText: `<b>Chain:</b> AWS mein secret ka naam badla → ESO ko purana naam nahi mila (<code>Secret does not exist</code>) → ESO ne Kubernetes Secret ko <b>chhua hi nahi</b>, toh usme purana password reh gaya →
      RDS ka password rotate ho chuka tha → restart par ledger fail.<br>
      <b>Dhyaan do:</b> ESO ke fail hone par bhi ledger ghanton chalta raha — purana container pehle se connected tha. Toot-na restart par dikha. Isliye <b>ExternalSecret ke SecretSyncedError par alert</b> lagao.<br>
      <b>Env wala Secret:</b> Secret badalne se chalta container nahi badalta — naya container (restart / pod delete) naya value padhta hai.
      CrashLoopBackOff mein kubelet khud bhi agli koshish par naya password utha leta (backoff 5 minute tak).`,
    hints: [
      'kubectl logs ledger-0 — "password authentication failed". kubectl describe pod ledger-0 — DB_PASSWORD kis Secret se aata hai? Phir kubectl get externalsecret aur kubectl describe externalsecret ledger-db.',
      '"Secret does not exist" = AWS mein us naam ka secret nahi. aws secretsmanager list-secrets se naya naam dekho.',
      'vi ledger-db-externalsecret.yaml — key: chaipay/prod/ledger-db ko chaipay/prod/ledger/db karo, Save, apply. Phir kubectl delete pod ledger-0 aur kubectl logs ledger-0.',
    ],
    solution: ['kubectl logs ledger-0', 'kubectl describe pod ledger-0', 'kubectl get externalsecret', 'kubectl describe externalsecret ledger-db',
      'aws secretsmanager list-secrets', { edit: 'ledger-db-externalsecret.yaml', change: [['key: chaipay/prod/ledger-db', 'key: chaipay/prod/ledger/db']] },
      'kubectl apply -f ledger-db-externalsecret.yaml', 'kubectl get externalsecret', 'kubectl delete pod ledger-0', 'kubectl logs ledger-0'],
  }, {
    objectives: ['✏️ <b>YAML editor mission:</b> ExternalSecret sync toota, ledger purane password par — ESO ka Event padho, <code>remoteRef</code> khud theek karo'],
    success: ['Main ExternalSecret ka SecretSyncedError debug kar sakta hoon aur jaanta hoon ki env wale Secret ke baad restart chahiye'],
    cards: [{ front: 'ExternalSecret <code>SecretSyncedError</code> — Kubernetes Secret ka kya hota hai?', back: 'ESO Secret ko <b>chhoota hi nahi</b> — <b>purana value</b> reh jaata hai. App tab tak chalti hai jab tak restart na ho. Isliye SecretSyncedError par alert lagao.' }],
  });

  /* ---------- batch 3 ke shared helpers ---------- */
  // kubectl jaisi table: har column sabse lambe cell + 3 space
  function tbl(rows) {
    const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i] == null ? '' : r[i]).length)));
    return rows.map(r => r.map((x, i) => i === r.length - 1 ? String(x) : String(x).padEnd(w[i] + 3)).join('')).join('\n');
  }
  const deployBadReq = (file, msg) => ({ err: `Error from server (BadRequest): error when patching "${file}": Deployment in version "v1" cannot be handled as a Deployment: ${msg}` });
  const DEPLOY_SPEC_KEYS = ['replicas', 'selector', 'template', 'strategy', 'minReadySeconds', 'revisionHistoryLimit', 'paused', 'progressDeadlineSeconds'];
  // Deployment ki file ke aam checks: kind/naam, strict decoding (spec.*), replicas ka type, selector immutable
  function deployChecks(file, d) {
    if (!d || d.kind !== 'Deployment') return { err: `error: is file mein Deployment chahiye (kind: ${(d && d.kind) || 'khaali'})` };
    if (!d.metadata || d.metadata.name !== 'pay-api') return { err: `(simulator ne roka) Deployment ka naam "${(d.metadata && d.metadata.name) || ''}" ho gaya — naya Deployment banega aur pay-api waisa hi rahega. metadata.name wapas pay-api karo.` };
    const spec = d.spec || {};
    const unk = Object.keys(spec).find(k => !DEPLOY_SPEC_KEYS.includes(k));
    if (unk) return deployBadReq(file, `strict decoding error: unknown field "spec.${unk}"` + (/^replica$/i.test(unk) ? '\n(field ka naam "replicas" hai — aakhir mein s)' : ''));
    if (spec.replicas != null && typeof spec.replicas !== 'number') return deployBadReq(file, `json: cannot unmarshal ${typeof spec.replicas === 'boolean' ? 'bool' : 'string'} into Go struct field DeploymentSpec.spec.replicas of type int32` + (typeof spec.replicas === 'string' ? '\n(replicas number hai — quotes hatao: replicas: 6)' : ''));
    if (typeof spec.replicas === 'number' && spec.replicas < 0) return { err: `The Deployment "pay-api" is invalid: spec.replicas: Invalid value: ${spec.replicas}: must be greater than or equal to 0` };
    const sel = (spec.selector && spec.selector.matchLabels) || {};
    if (sel.app !== 'pay-api' || Object.keys(sel).length !== 1) return { err: `The Deployment "pay-api" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{${Object.keys(sel).map(k => `"${k}":"${sel[k]}"`).join(', ')}}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable\n(selector Deployment banne ke baad badal nahi sakta — wapas app: pay-api karo)` };
    const tl = (((spec.template || {}).metadata || {}).labels) || {};
    if (tl.app !== 'pay-api') return { err: `The Deployment "pay-api" is invalid: spec.template.metadata.labels: Invalid value: map[string]string{${Object.keys(tl).map(k => `"${k}":"${tl[k]}"`).join(', ')}}: \`selector\` does not match template \`labels\`` };
    return null;
  }

  /* =====================================================================
     🐳 whyk8s — desired state apni aankhon se: pod maaro → K8s wapas laata hai;
     sale ke liye replicas FILE mein likho (kubectl scale = file se drift)
     ===================================================================== */
  const W_IMG = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api:1.8.0';
  const W_SUF = ['d4', 'e5', 'f6', 'g7', 'h8', 'j9', 'k1', 'm2', 'n3', 'p4', 'q5', 'r6', 's7', 't8', 'u9', 'v1'];
  const W_FILE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pay-api
  namespace: payments
spec:
  replicas: 3            # desired state: kitne pods chahiye
  selector:
    matchLabels:
      app: pay-api
  template:
    metadata:
      labels:
        app: pay-api
    spec:
      containers:
      - name: pay-api
        image: ${W_IMG}
        ports:
        - containerPort: 8080
`;
  const W_B2_DESC = `Name:             pay-api-6b8d7c-b2
Namespace:        payments
Priority:         0
Service Account:  default
Node:             node-2/10.0.13.5
Start Time:       Tue, 18 Nov 2026 11:02:41 +0530
Labels:           app=pay-api
                  pod-template-hash=6b8d7c
Status:           Running
IP:               10.0.13.21
Controlled By:    ReplicaSet/pay-api-6b8d7c
Containers:
  pay-api:
    Image:          ${W_IMG}
    Port:           8080/TCP
    State:          Running
      Started:      Mon, 24 Nov 2026 03:12:09 +0530
    Last State:     Terminated
      Reason:       Error
      Exit Code:    2
      Started:      Tue, 18 Nov 2026 11:02:44 +0530
      Finished:     Mon, 24 Nov 2026 03:12:07 +0530
    Ready:          True
    Restart Count:  1
Events:
  Type    Reason   Age   From     Message
  ----    ------   ----  ----     -------
  Normal  Pulled   6h    kubelet  Container image "${W_IMG}" already present on machine
  Normal  Created  6h    kubelet  Created container: pay-api
  Normal  Started  6h    kubelet  Started container pay-api`;
  const W_B2_PREV = `2026-11-23T21:41:58Z INFO  upi: collect request txn=CPX93817 amount=249.00
2026-11-23T21:42:07Z ERROR upi: NPCI response parse failed txn=CPX93822
panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x1 addr=0x18 pc=0x9c4b2e]

goroutine 4127 [running]:
chaipay/pay-api/upi.(*Client).Collect(...)
	/src/upi/client.go:214 +0x2ae`;
  const W_LOG = '2026-11-24T04:02:11Z INFO  upi: collect ok txn=CPX95120 amount=120.00\n2026-11-24T04:02:12Z INFO  upi: collect ok txn=CPX95121 amount=35.00';
  const wDeployDesc = c => `Name:                   pay-api
Namespace:              payments
CreationTimestamp:      Tue, 14 Oct 2026 11:20:05 +0530
Labels:                 app=pay-api
Selector:               app=pay-api
Replicas:               ${c.replicas} desired | ${c.replicas} updated | ${c.replicas} total | ${c.replicas} available | 0 unavailable
StrategyType:           RollingUpdate
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=pay-api
  Containers:
   pay-api:
    Image:        ${W_IMG}
    Port:         8080/TCP
OldReplicaSets:  <none>
NewReplicaSet:   pay-api-6b8d7c (${c.replicas}/${c.replicas} replicas created)
Events:` + (c.dEvents.length ? '\n  Type    Reason             Age   From                   Message\n  ----    ------             ----  ----                   -------\n' + c.dEvents.map(e => `  Normal  ScalingReplicaSet  4s    deployment-controller  ${e}`).join('\n') : '          <none>');
  // ReplicaSet controller: pods ko desired count tak lao (kam ho toh naya banao, zyada ho toh naye wale hatao)
  function wSync(c, n) {
    const before = c.replicas;
    while (c.pods.length < n) {
      let nm;
      do { nm = 'pay-api-6b8d7c-' + W_SUF[c.podN % W_SUF.length]; c.podN++; } while (c.pods.some(p => p.name === nm));
      const k = c.pods.length;
      c.pods.push({ name: nm, ready: '1/1', status: 'Running', restarts: 0, age: '4s', node: NODES[k % 3].name, ip: '10.0.1' + (2 + k % 3) + '.' + (30 + c.podN), logs: W_LOG });
    }
    if (c.pods.length > n) c.pods.splice(n);
    if (before !== n) c.dEvents.push(`Scaled ${n > before ? 'up' : 'down'} replica set pay-api-6b8d7c from ${before} to ${n}`);
    c.replicas = n;
    Object.assign(c.deployments[0], { ready: n + '/' + n, upToDate: n, available: n });
    c.deployments[0].describe = wDeployDesc(c);
  }
  const wFileRep = s => {
    try { const d = KG.yaml.parse((s.edited || {})['pay-api-deploy.yaml'] || W_FILE); return d && d.spec ? d.spec.replicas : null; } catch (e) { return null; }
  };
  const T_WHY = [
    { text: 'Desired state padho: <code>kubectl get deployment pay-api</code> (READY = chal rahe / chahiye)', check: s => ran(s, /^kubectl get (deploy|deployments?)\b/) },
    { text: 'Ek pod ka RESTARTS 1 hai. <code>kubectl describe pod</code> se dekho raat ko kya hua (Last State)', check: s => ran(s, /^kubectl describe (pods?|po)[ \/]pay-api-6b8d7c-b2\b/) || ran(s, /^kubectl logs .*pay-api-6b8d7c-b2.*(--previous|-p)\b|^kubectl logs (--previous|-p) .*pay-api-6b8d7c-b2/) },
    { text: 'Self-healing khud dekho: ek <code>pay-api</code> pod delete karo', check: s => !!s.cluster.healed },
    { text: 'Delete ke baad <code>kubectl get pods</code> — kitne pods hain? Kiska naam naya hai?', check: s => !!s.cluster.healed && ranAfter(s, s.cluster.healedAt, /^kubectl get (pods?|po)\b/) },
    { text: 'Sale ke liye 6 pods: <code>vi pay-api-deploy.yaml</code> mein <code>replicas: 6</code>, phir <code>kubectl apply</code>', check: s => s.cluster.applied === 6 && s.cluster.replicas === 6 },
    { text: '<code>kubectl get deployment pay-api</code> se pakka karo: <b>6/6</b>', check: s => s.cluster.applied === 6 && s.cluster.replicas === 6 && ranAfter(s, s.cluster.appliedAt, /^kubectl get (deploy|deployments?)\b/) },
  ];
  addLab('whyk8s', {
    type: 'terminal',
    title: '🖥️ Mission: pod maaro — Kubernetes wapas laayega',
    instructions: 'Yeh tumhara pehla Kubernetes terminal hai. ChaiPay (UPI payments startup) ki pay-api pehle ek Docker server par chalti thi — container marta, toh koi raat ko uth kar docker restart karta. Ab pay-api Kubernetes par hai, 3 pods mein. Aaj raat 3:12 baje ek pod crash hua tha. Kisi ko phone nahi aaya. Kal Diwali sale hai — 6 pods chahiye.',
    goal: `Teen cheezein apni aankhon se dekho: (1) <b>desired state</b> — Deployment kitne pods maangta hai, (2) <b>self-healing</b> — pod delete karo aur dekho Kubernetes kya karta hai,
      (3) sale ke liye <code>pay-api</code> ko <b>6 pods</b> par le jao — <b>file mein</b> likh kar.
      File badalne ka tareeka: <code>vi pay-api-deploy.yaml</code> → line badlo → <b>💾 Save</b> → <code>kubectl apply -f pay-api-deploy.yaml</code>.`,
    tasks: T_WHY,
    cluster: {
      nodes: NODES, replicas: 3, podN: 0, applied: 3, dEvents: [],
      pods: [
        { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.0.12.21', logs: W_LOG },
        { name: 'pay-api-6b8d7c-b2', ready: '1/1', status: 'Running', restarts: '1 (6h ago)', age: '6d', node: 'node-2', ip: '10.0.13.21', logs: W_LOG, prevLogs: W_B2_PREV, describe: W_B2_DESC },
        { name: 'pay-api-6b8d7c-c3', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-3', ip: '10.0.14.21', logs: W_LOG },
      ],
      deployments: [{ name: 'pay-api', ready: '3/3', upToDate: 3, available: 3, age: '40d', describe: wDeployDesc({ replicas: 3, dEvents: [] }) }],
    },
    responses: [
      { re: rx('kubectl delete (?:pods?|po)[ /](pay-api-\\S+?)'),
        out: (s, m) => {
          const c = s.cluster, name = String((m && m[1]) || ''), i = c.pods.findIndex(p => p.name === name);
          if (i < 0) return `Error from server (NotFound): pods "${name}" not found\n(pods: ${c.pods.map(p => p.name).join(', ')})`;
          c.pods.splice(i, 1);
          wSync(c, c.replicas);   // ReplicaSet: 3 chahiye, 2 bache → 1 naya (Deployment ka koi event nahi banta)
          c.healed = true; c.healedAt = s.history.length;
          return `pod "${name}" deleted\n(ab kubectl get pods chalao — kitne pay-api pods hain?)`;
        } },
      { re: rx('kubectl delete (?:deploy(?:ment)?s?)[ /]pay-api'), err: true,
        out: '(simulator ne roka) Deployment delete karna = desired state hi mita dena. Phir koi pod wapas nahi aata — saare 3 pods chale jaate aur payments band. Is mission mein sirf ek POD delete karo: kubectl delete pod pay-api-6b8d7c-a1' },
      { re: /^kubectl scale\b.*\bpay-api\b.*$/,
        out: (s, m) => {
          const c = s.cluster, mm = String((m && m[0]) || '').match(/--replicas[ =](\S+)/);
          if (!mm) return 'error: required flag(s) "replicas" not set';
          const n = Number(mm[1]);
          if (!/^\d+$/.test(mm[1])) return `error: invalid argument "${mm[1]}" for "--replicas" flag: strconv.ParseInt: parsing "${mm[1]}": invalid syntax`;
          if (n === 0) return '(simulator ne roka) replicas=0 matlab koi pod nahi — sale se pehle payments band. 6 karo.';
          if (n > 12) return `(simulator) 3 nodes par ${n} pods ki jagah nahi — is mission mein 6 karo.`;
          wSync(c, n); c.imperative = true;
          const fr = wFileRep(s);
          return 'deployment.apps/pay-api scaled\n' + (fr === n
            ? `(File pay-api-deploy.yaml mein bhi replicas: ${n} hai — cluster aur file ek jaise.)`
            : `(Dhyan do: cluster mein ab ${n} pods hain, par git wali file pay-api-deploy.yaml mein abhi bhi "replicas: ${fr}" likha hai. Agli baar koi woh file apply karega, cluster wapas ${fr} par aa jayega. Desired state FILE mein likho: vi pay-api-deploy.yaml)`);
        } },
      { re: rx('kubectl get (?:rs|replicasets?)(?:[ /]pay-api-6b8d7c)?'),
        out: s => tbl([['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE'], ['pay-api-6b8d7c', s.cluster.replicas, s.cluster.pods.length, s.cluster.pods.length, '40d']]) },
      { re: /^docker\b/, err: true,
        out: 'bash: docker: command not found\n(Yeh Kubernetes cluster hai — containers ko yahan kubectl sambhalta hai:\n  docker ps          →  kubectl get pods\n  docker logs X      →  kubectl logs X\n  docker restart X   →  kubectl delete pod X   (Kubernetes naya pod khud banata hai)\n  3 baar docker run  →  Deployment mein replicas: 3)' },
    ],
    files: {
      'pay-api-deploy.yaml': {
        editable: true,
        desc: 'pay-api ka Deployment (git se) — vi se badlo',
        content: W_FILE,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0];
          const bad = deployChecks('pay-api-deploy.yaml', d);
          if (bad) return bad;
          const ctr = (((d.spec.template || {}).spec || {}).containers || [])[0] || {};
          if (ctr.image !== W_IMG) return { err: '(simulator ne roka) image badalne se naya version rollout hoga — is mission mein sirf replicas badlo.' };
          let n = d.spec.replicas, note = '';
          if (n == null) { n = 1; note = '\n(replicas line hi hata di! Pichhli apply mein 3 tha → kubectl apply ne field hataya → API ne default 1 laga diya. Sirf 1 pod bacha. replicas: 6 wapas likho.)'; }
          if (n === 0) return { err: '(simulator ne roka) replicas: 0 matlab koi pod nahi — payments band. 6 likho.' };
          if (n > 12) return { err: `(simulator) 3 nodes par ${n} pods ki jagah nahi — is mission mein 6 likho.` };
          const was = c.replicas, same = n === was && c.applied === n;
          wSync(c, n); c.applied = n; c.appliedAt = s.history.length;
          if (same) return 'deployment.apps/pay-api unchanged';
          if (n < was && !note) note += `\n(File mein replicas: ${n} tha — cluster ke ${was} mein se ${was - n} pods Terminating. Jo file mein likha, wahi sach — yahi desired state hai.)`;
          return 'deployment.apps/pay-api configured' + note;
        },
      },
    },
    success: KG.allOf(T_WHY),
    successText: `<b>Desired state</b> = file mein likha "mujhe 6 pods chahiye". Kubernetes ka <b>controller</b> (ReplicaSet) har waqt ginta hai: chal rahe pods ≠ chahiye → farak khud bhar deta hai.<br>
      Isliye pod delete karne par naya pod (naye naam ke saath) turant aa gaya — aur raat 3:12 ka crash bhi kubelet ne khud restart kar diya. Docker par yeh kaam ek insaan karta tha.<br>
      <b>Imperative vs declarative:</b> <code>kubectl scale --replicas=6</code> bhi chalta, par git ki file 3 hi bolti. Agla deploy cluster ko wapas 3 kar deta — sale ke beech mein! File mein likho, phir apply: <b>file = sach</b>.`,
    hints: [
      'kubectl get deployment pay-api, phir kubectl get pods. RESTARTS 1 wale pod ka: kubectl describe pod pay-api-6b8d7c-b2 (Last State dekho).',
      'kubectl delete pod pay-api-6b8d7c-a1, phir turant kubectl get pods — pods ginti karo aur naam dekho.',
      'vi pay-api-deploy.yaml — "replicas: 3" ko "replicas: 6" karo, 💾 Save. Phir kubectl apply -f pay-api-deploy.yaml aur kubectl get deployment pay-api.',
    ],
    solution: ['kubectl get deployment pay-api', 'kubectl get pods', 'kubectl describe pod pay-api-6b8d7c-b2', 'kubectl delete pod pay-api-6b8d7c-a1', 'kubectl get pods',
      { edit: 'pay-api-deploy.yaml', change: [['replicas: 3', 'replicas: 6']] }, 'kubectl apply -f pay-api-deploy.yaml', 'kubectl get deployment pay-api'],
  }, {
    objectives: ['🖥️ <b>Pehla terminal mission:</b> pod delete karke self-healing dekho, aur replicas file mein likh kar desired state badlo'],
    success: ['Maine apni aankhon se dekha ki Kubernetes mara hua pod khud wapas laata hai, aur desired state file se badalta hai'],
    cards: [
      { front: 'Pod delete kiya, naya pod naye naam ke saath aa gaya — kisne banaya?', back: '<b>ReplicaSet controller</b> ne. Deployment ne "3 chahiye" likha hai; 2 bache toh controller ne 1 naya bana diya. Yahi <b>desired state</b> aur self-healing hai.' },
      { front: '<code>kubectl scale --replicas=6</code> chalaya, par git ki file mein <code>replicas: 3</code> — kya hoga?', back: '<b>Drift.</b> Agla <code>kubectl apply -f</code> cluster ko wapas 3 kar dega. Desired state file mein likho, phir apply karo.' },
    ],
  });

  /* =====================================================================
     🧠 controlplane — scheduler ki static pod file mein flag ka typo.
     Pods Pending + "Events: <none>"; kubelet file khud padhta hai
     (file ka onSave — kubectl apply nahi lagta)
     ===================================================================== */
  const CP_PATH = '/etc/kubernetes/manifests/kube-scheduler.yaml';
  const CP_IMG = 'registry.k8s.io/kube-scheduler:v1.33.4';
  const CP_NODES = [
    { name: 'cp-1', status: 'Ready', roles: 'control-plane', age: '90d', version: 'v1.33.4' },
    { name: 'worker-1', status: 'Ready', roles: '<none>', age: '90d', version: 'v1.33.4' },
    { name: 'worker-2', status: 'Ready', roles: '<none>', age: '90d', version: 'v1.33.4' },
  ];
  const CP_FILE = `apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    component: kube-scheduler
    tier: control-plane
  name: kube-scheduler
  namespace: kube-system
spec:
  containers:
  - command:
    - kube-scheduler
    - --authentication-kubeconfig=/etc/kubernetes/scheduler.conf
    - --authorization-kubeconfig=/etc/kubernetes/scheduler.conf
    - --bind-address=127.0.0.1
    - --kubeconfig=/etc/kubernetes/scheduler.conf
    - --leader-elect=true
    - --leader-elect-lease-duraton=30s    # Amit, aaj 9:40 AM: failover tez karne ke liye
    image: ${CP_IMG}
    imagePullPolicy: IfNotPresent
    livenessProbe:
      failureThreshold: 8
      httpGet:
        host: 127.0.0.1
        path: /livez
        port: 10259
        scheme: HTTPS
      initialDelaySeconds: 10
      periodSeconds: 10
      timeoutSeconds: 15
    name: kube-scheduler
    resources:
      requests:
        cpu: 100m
    volumeMounts:
    - mountPath: /etc/kubernetes/scheduler.conf
      name: kubeconfig
      readOnly: true
  hostNetwork: true
  priority: 2000001000
  priorityClassName: system-node-critical
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  volumes:
  - hostPath:
      path: /etc/kubernetes/scheduler.conf
      type: FileOrCreate
    name: kubeconfig
status: {}
`;
  const CP_CMD0 = ['kube-scheduler', '--authentication-kubeconfig=/etc/kubernetes/scheduler.conf', '--authorization-kubeconfig=/etc/kubernetes/scheduler.conf',
    '--bind-address=127.0.0.1', '--kubeconfig=/etc/kubernetes/scheduler.conf', '--leader-elect=true', '--leader-elect-lease-duraton=30s'];
  const CP_FLAGS = ['--authentication-kubeconfig', '--authorization-kubeconfig', '--bind-address', '--kubeconfig', '--leader-elect', '--leader-elect-lease-duration',
    '--leader-elect-renew-deadline', '--leader-elect-retry-period', '--leader-elect-resource-lock', '--leader-elect-resource-name', '--leader-elect-resource-namespace',
    '--config', '--v', '--secure-port', '--profiling', '--feature-gates', '--master', '--log-flush-frequency', '--client-ca-file', '--requestheader-client-ca-file',
    '--tls-cert-file', '--tls-private-key-file', '--authentication-tolerate-lookup-failure', '--contention-profiling'];
  // flag parse fail hone par cobra pehle usage chhapta hai, error SABSE AAKHIR mein (component-base/cli/run.go)
  const CP_USAGE = `Usage:
  kube-scheduler [flags]

Misc flags:

      --config string            The path to the configuration file.
      --master string            The address of the Kubernetes API server (overrides any value in kubeconfig)
      --write-config-to string   If set, write the configuration values to this file and exit.

Secure serving flags:

      --bind-address ip          The IP address on which to listen for the --secure-port port. (default 0.0.0.0)
      --secure-port int          The port on which to serve HTTPS with authentication and authorization. (default 10259)
  (… yahan ~150 lines aur flags ki …)

Leader election flags:

      --leader-elect                               Start a leader election client and gain leadership before executing the main loop. (default true)
      --leader-elect-lease-duration duration       The duration that non-leader candidates will wait after observing a leadership renewal until attempting to acquire leadership. (default 15s)
      --leader-elect-renew-deadline duration       The interval between attempts by the acting master to renew a leadership slot before it stops leading. (default 10s)
      --leader-elect-retry-period duration         The duration the clients should wait between attempting acquisition and renewal of a leadership. (default 2s)
  (… baaki flags …)

`;
  const KLOG = (lvl, at, msg) => `${lvl}1124 04:49:02.${String(118204 + msg.length).padStart(6, '0')}       1 ${at}] ${msg}`;
  const durOk = v => /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/.test(v || '');
  const durSec = v => { let t = 0; String(v).replace(/(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g, (_, n, u) => { t += Number(n) * { ns: 1e-9, us: 1e-6, 'µs': 1e-6, ms: 1e-3, s: 1, m: 60, h: 3600 }[u]; }); return t; };
  // naye command se scheduler chalega ya crash hoga? crash ho toh uske logs lautao
  function cpCrash(cmd) {
    const flags = cmd.slice(1);
    for (const f of flags) {
      const m = String(f).match(/^(--[A-Za-z0-9-]+)(?:=(.*))?$/);
      if (!m) return CP_USAGE + `Error: "kube-scheduler" does not take any arguments, got ["${f}"]`;
      if (!CP_FLAGS.includes(m[1])) return CP_USAGE + `Error: unknown flag: ${m[1]}`;
      if (/^--leader-elect-(lease-duration|renew-deadline|retry-period)$/.test(m[1]) && !durOk(m[2]))
        return CP_USAGE + `Error: invalid argument "${m[2] || ''}" for "${m[1]}" flag: time: ${/^\d+$/.test(m[2] || '') ? 'missing unit in duration' : 'invalid duration'} "${m[2] || ''}"`;
      if (m[1] === '--leader-elect' && m[2] != null && !/^(1|0|t|f|true|false|TRUE|FALSE|True|False)$/.test(m[2]))
        return CP_USAGE + `Error: invalid argument "${m[2]}" for "--leader-elect" flag: strconv.ParseBool: parsing "${m[2]}": invalid syntax`;
    }
    const val = k => { const f = flags.find(x => String(x).startsWith(k + '=')); return f ? String(f).slice(k.length + 1) : null; };
    const kc = val('--kubeconfig');
    if (!kc) return KLOG('W', 'client_config.go:667', 'Neither --kubeconfig nor --master was specified.  Using the inClusterConfig.  This might not work.') + '\n' +
      KLOG('E', 'run.go:72', '"command failed" err="unable to load in-cluster configuration, KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT must be defined"');
    if (kc !== '/etc/kubernetes/scheduler.conf') return KLOG('E', 'run.go:72', `"command failed" err="stat ${kc}: no such file or directory"`);
    const lease = val('--leader-elect-lease-duration'), renew = val('--leader-elect-renew-deadline');
    if (durSec(lease || '15s') <= durSec(renew || '10s'))
      return KLOG('E', 'run.go:72', `"command failed" err="leaderElection.leaseDuration: Invalid value: \\"${renew || '10s'}\\": LeaseDuration must be greater than RenewDeadline"`);
    return null;
  }
  const CP_OKLOG = `I1124 04:52:31.402117       1 serving.go:386] Generated self-signed cert in-memory
I1124 04:52:31.911204       1 server.go:167] "Starting Kubernetes Scheduler" version="v1.33.4"
I1124 04:52:31.915720       1 secure_serving.go:211] Serving securely on 127.0.0.1:10259
I1124 04:52:32.016384       1 leaderelection.go:257] attempting to acquire leader lease kube-system/kube-scheduler...
I1124 04:52:32.031947       1 leaderelection.go:271] successfully acquired lease kube-system/kube-scheduler
I1124 04:52:32.122650       1 schedule_one.go:314] "Successfully bound pod to node" pod="payments/settlement-api-7c9f6d5b8-x4k2m" node="worker-1" evaluatedNodes=3 feasibleNodes=2
I1124 04:52:32.124028       1 schedule_one.go:314] "Successfully bound pod to node" pod="payments/settlement-api-7c9f6d5b8-p7r9t" node="worker-2" evaluatedNodes=3 feasibleNodes=2`;
  const ksRows = c => [
    ['coredns-674b8bbfcf-8xk2p', '1/1', 'Running', '0', '90d', '10.244.0.3', 'cp-1'],
    ['coredns-674b8bbfcf-q9w4t', '1/1', 'Running', '0', '90d', '10.244.0.4', 'cp-1'],
    ['etcd-cp-1', '1/1', 'Running', '0', '90d', '10.20.0.10', 'cp-1'],
    ['kube-apiserver-cp-1', '1/1', 'Running', '0', '90d', '10.20.0.10', 'cp-1'],
    ['kube-controller-manager-cp-1', '1/1', 'Running', '0', '90d', '10.20.0.10', 'cp-1'],
    ['kube-proxy-5xk8w', '1/1', 'Running', '0', '90d', '10.20.0.10', 'cp-1'],
    ['kube-proxy-h2m9q', '1/1', 'Running', '0', '90d', '10.20.0.21', 'worker-1'],
    ['kube-proxy-t7v4n', '1/1', 'Running', '0', '90d', '10.20.0.22', 'worker-2'],
    c.schedOk ? ['kube-scheduler-cp-1', '1/1', 'Running', '0', '9s', '10.20.0.10', 'cp-1']
      : ['kube-scheduler-cp-1', '0/1', 'CrashLoopBackOff', c.edits ? c.edits + ' (6s ago)' : '12 (2m14s ago)', c.edits ? '7s' : '41m', '10.20.0.10', 'cp-1'],
  ];
  function ksTable(c, cmd) {
    const wide = /-o ?wide|-owide|--output=wide/.test(cmd);
    const toks = cmd.split(' ').filter(t => t !== 'kube-system' && !/^--?n(amespace)?=?/.test(t));
    let rows = ksRows(c);
    const named = rows.filter(r => toks.includes(r[0]) || toks.includes('pod/' + r[0]));
    if (named.length) rows = named;
    else if (toks.some(t => /^kube-|^etcd-|^coredns-/.test(t))) {
      const want = toks.find(t => /^kube-|^etcd-|^coredns-/.test(t));
      return `Error from server (NotFound): pods "${want}" not found`;
    }
    const head = ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'].concat(wide ? ['IP', 'NODE', 'NOMINATED NODE', 'READINESS GATES'] : []);
    return tbl([head].concat(rows.map(r => r.slice(0, 5).concat(wide ? [r[5], r[6], '<none>', '<none>'] : []))));
  }
  const schedDesc = c => {
    const cmd = c.cmd || CP_CMD0;
    return `Name:                 kube-scheduler-cp-1
Namespace:            kube-system
Priority:             2000001000
Priority Class Name:  system-node-critical
Node:                 cp-1/10.20.0.10
Labels:               component=kube-scheduler
                      tier=control-plane
Annotations:          kubernetes.io/config.hash: 9b1f3c7e5a2d4f6b8c0e1a3d5f7b9c2e
                      kubernetes.io/config.mirror: 9b1f3c7e5a2d4f6b8c0e1a3d5f7b9c2e
                      kubernetes.io/config.seen: 2026-11-24T09:40:12.551203+05:30
                      kubernetes.io/config.source: file
Status:               Running
IP:                   10.20.0.10
Controlled By:        Node/cp-1
Containers:
  kube-scheduler:
    Image:         ${CP_IMG}
    Port:          <none>
    Host Port:     <none>
    Command:
${cmd.map(x => '      ' + x).join('\n')}
` + (c.schedOk ? `    State:          Running
      Started:      Mon, 24 Nov 2026 10:22:31 +0530
    Ready:          True
    Restart Count:  0
Events:
  Type    Reason   Age   From     Message
  ----    ------   ----  ----     -------
  Normal  Pulled   10s   kubelet  Container image "${CP_IMG}" already present on machine
  Normal  Created  10s   kubelet  Created container: kube-scheduler
  Normal  Started  10s   kubelet  Started container kube-scheduler` : `    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       Error
      Exit Code:    1
    Ready:          False
    Restart Count:  ${c.edits || 12}
Events:
  Type     Reason   Age                   From     Message
  ----     ------   ----                  ----     -------
  Normal   Pulled   ${c.edits ? '6s' : '2m14s (x13 over 41m)'}   kubelet  Container image "${CP_IMG}" already present on machine
  Warning  BackOff  ${c.edits ? '4s' : '9s (x187 over 41m)'}    kubelet  Back-off restarting failed container kube-scheduler in pod kube-scheduler-cp-1_kube-system(9b1f3c7e5a2d4f6b8c0e1a3d5f7b9c2e)`);
  };
  const SET_IMG = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/settlement-api:2.3.0';
  const setDesc = (sfx, node) => `Name:             settlement-api-7c9f6d5b8-${sfx}
Namespace:        payments
Priority:         0
Service Account:  default
Node:             ${node ? node + '/10.20.0.' + (node === 'worker-1' ? 21 : 22) : '<none>'}
Labels:           app=settlement-api
                  pod-template-hash=7c9f6d5b8
Annotations:      <none>
Status:           ${node ? 'Running' : 'Pending'}
IP:               ${node ? '10.244.' + (node === 'worker-1' ? 1 : 2) + '.37' : ''}
Controlled By:    ReplicaSet/settlement-api-7c9f6d5b8
Containers:
  settlement-api:
    Image:      ${SET_IMG}
    Port:       8080/TCP
    Requests:
      cpu:      250m
      memory:   256Mi
QoS Class:       Burstable
Node-Selectors:  <none>
Tolerations:     node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                 node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
` + (node ? `Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  8s    default-scheduler  Successfully assigned payments/settlement-api-7c9f6d5b8-${sfx} to ${node}
  Normal  Pulling    8s    kubelet            Pulling image "${SET_IMG}"
  Normal  Pulled     4s    kubelet            Successfully pulled image "${SET_IMG}" in 3.912s (3.912s including waiting). Image size: 48213907 bytes.
  Normal  Created    4s    kubelet            Created container: settlement-api
  Normal  Started    4s    kubelet            Started container settlement-api` : 'Events:          <none>');
  const CP_EV0 = [['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'],
    ['14m', 'Normal', 'ScalingReplicaSet', 'deployment/settlement-api', 'Scaled up replica set settlement-api-7c9f6d5b8 from 0 to 2'],
    ['14m', 'Normal', 'SuccessfulCreate', 'replicaset/settlement-api-7c9f6d5b8', 'Created pod: settlement-api-7c9f6d5b8-x4k2m'],
    ['14m', 'Normal', 'SuccessfulCreate', 'replicaset/settlement-api-7c9f6d5b8', 'Created pod: settlement-api-7c9f6d5b8-p7r9t']];
  const setPod = (sfx, node) => ({ name: 'settlement-api-7c9f6d5b8-' + sfx, ready: node ? '1/1' : '0/1', status: node ? 'Running' : 'Pending', restarts: 0, age: node ? '8s' : '14m',
    node: node || '<none>', ip: node ? '10.244.' + (node === 'worker-1' ? 1 : 2) + '.37' : '<none>', describe: setDesc(sfx, node),
    logs: node ? '{"level":"info","msg":"settlement-api 2.3.0 listening on :8080"}' : undefined });
  const KS = '(?=.*(?:-n|--namespace)[ =]kube-system\\b)';
  const T_CP = [
    { text: 'Pods ka haal dekho (<code>kubectl get pods</code>) — <code>settlement-api</code> kahan atka hai?', check: s => s.history.some(h => /^kubectl get (pods?|po)\b/.test(h) && !/kube-system|-A\b|--all-namespaces/.test(h)) },
    { text: 'Pending pod ka describe padho — <b>Node</b> aur <b>Events</b> mein kya likha hai?', check: s => ran(s, /^kubectl describe (pods?|po)[ \/]settlement-api/) },
    { text: 'Control plane ke pods dekho (<code>kubectl get pods -n kube-system</code>)', check: s => !!s.cluster.sawKs },
    { text: 'Jo control plane pod crash ho raha hai, uske logs padho — <b>aakhri line</b>', check: s => !!s.cluster.sawLogs },
    { text: 'cp-1 par us pod ki file theek karo (<code>vi ' + CP_PATH + '</code>)', check: s => !!s.cluster.schedOk },
    { text: 'Pakka karo: <code>settlement-api</code> ke dono pods <b>Running</b>', check: s => !!s.cluster.schedOk && ranAfter(s, s.cluster.fixedAt, /^kubectl get (pods?|po)\b(?!.*kube-system)/) },
  ];
  addLab('controlplane', {
    type: 'terminal',
    title: '🖥️ Mission: pods Pending, aur Events bilkul khaali',
    instructions: 'ChaiPay ka staging cluster chaipay-staging kubeadm se bana hai (EKS mein control plane AWS chalata hai aur dikhta nahi — yahan sab dikhta hai). 14 minute pehle CI ne settlement-api ka naya version deploy kiya. Dono pods tab se Pending hain. pay-api ke purane pods theek chal rahe hain. Aaj subah 9:40 par Amit ne control plane par "kuch tuning" ki thi.',
    goal: `<code>settlement-api</code> ke pods ko <b>Running</b> karo. Pehle socho: pod ko node <b>kaun</b> chunta hai? Phir dekho woh component zinda hai ya nahi.
      Control plane ke pods <code>kube-system</code> namespace mein hain (<code>-n kube-system</code>). Unki files cp-1 node par <code>/etc/kubernetes/manifests/</code> mein hain — <code>vi</code> se khulti hain.`,
    tasks: T_CP,
    cluster: {
      nodes: CP_NODES, schedOk: false, edits: 0,
      pods: [
        { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'worker-1', ip: '10.244.1.21' },
        { name: 'pay-api-6b8d7c-b2', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'worker-2', ip: '10.244.2.21' },
        setPod('x4k2m', null), setPod('p7r9t', null),
      ],
      deployments: [
        { name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' },
        { name: 'settlement-api', ready: '0/2', upToDate: 2, available: 0, age: '14m' },
      ],
      events: tbl(CP_EV0).split('\n'),
    },
    responses: [
      { re: new RegExp('^kubectl ' + KS + '(?:(?:-n|--namespace)[ =]kube-system )?get (?:pods?|po)\\b.*$'),
        out: (s, m) => { s.cluster.sawKs = true; return ksTable(s.cluster, String((m && m[0]) || '')); } },
      { re: /^kubectl get (?:pods?|po)\b.*(?:-A|--all-namespaces)\b.*$/,
        out: s => { s.cluster.sawKs = true; const c = s.cluster;
          return tbl([['NAMESPACE', 'NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE']].concat(ksRows(c).map(r => ['kube-system'].concat(r.slice(0, 5))))
            .concat(c.pods.map(p => ['payments', p.name, p.ready, p.status, String(p.restarts), p.age]))); } },
      { re: new RegExp('^kubectl ' + KS + '.*\\blogs\\b.*$'),
        out: (s, m) => {
          const c = s.cluster, cmd = String((m && m[0]) || '');
          if (/kube-scheduler/.test(cmd)) { c.sawLogs = true; return c.schedOk ? CP_OKLOG : (c.crash || cpCrash(CP_CMD0)); }
          if (/kube-controller-manager/.test(cmd)) return 'I1124 04:37:41.118204       1 event.go:389] "Event occurred" object="payments/settlement-api" fieldPath="" kind="Deployment" apiVersion="apps/v1" type="Normal" reason="ScalingReplicaSet" message="Scaled up replica set settlement-api-7c9f6d5b8 from 0 to 2"\nI1124 04:37:41.162530       1 event.go:389] "Event occurred" object="payments/settlement-api-7c9f6d5b8" fieldPath="" kind="ReplicaSet" apiVersion="apps/v1" type="Normal" reason="SuccessfulCreate" message="Created pod: settlement-api-7c9f6d5b8-x4k2m"\nI1124 04:37:41.171944       1 event.go:389] "Event occurred" object="payments/settlement-api-7c9f6d5b8" fieldPath="" kind="ReplicaSet" apiVersion="apps/v1" type="Normal" reason="SuccessfulCreate" message="Created pod: settlement-api-7c9f6d5b8-p7r9t"';
          if (/etcd-cp-1/.test(cmd)) return '{"level":"info","ts":"2026-11-24T04:49:58.204Z","caller":"mvcc/index.go:214","msg":"compact tree index","revision":8812456}\n{"level":"info","ts":"2026-11-24T04:49:58.311Z","caller":"mvcc/kvstore_compaction.go:72","msg":"finished scheduled compaction","compact-revision":8812456,"took":"98.1ms"}';
          if (/kube-apiserver/.test(cmd)) return 'I1124 04:50:12.004118       1 alloc.go:330] "allocated clusterIPs" service="payments/settlement-api" clusterIPs={"IPv4":"10.96.141.22"}';
          return '(is pod ke logs mein kuch khaas nahi — sab theek chal raha hai)';
        } },
      { re: new RegExp('^kubectl ' + KS + '.*\\bdescribe\\b.*$'),
        out: (s, m) => /kube-scheduler/.test(String((m && m[0]) || '')) ? schedDesc(s.cluster) : '(is mission mein sirf kube-scheduler-cp-1 ka describe hai — baaki control plane pods Running hain)' },
      { re: new RegExp('^kubectl ' + KS + '.*\\bdelete\\b.*kube-scheduler.*$'),
        out: s => 'pod "kube-scheduler-cp-1" deleted\n(kubelet ne mirror pod turant wapas bana diya — kyunki yeh pod cp-1 ki FILE se banta hai. File wahi hai, toh container phir ' + (s.cluster.schedOk ? 'chalega.)' : 'crash hoga. Ilaaj file mein hai.)') },
      { re: new RegExp('^kubectl ' + KS + '.*\\bedit\\b.*kube-scheduler.*$'), err: true,
        out: `error: pods "kube-scheduler-cp-1" is invalid: spec: Forbidden: pod updates may not change fields other than \`spec.containers[*].image\`, \`spec.initContainers[*].image\`, \`spec.activeDeadlineSeconds\`, \`spec.tolerations\` (only additions to existing tolerations), \`spec.terminationGracePeriodSeconds\` (allow it to be set to 1 if it was previously negative)\n(Yeh mirror pod hai — API mein sirf parchhai. Asli pod cp-1 ki file se banta hai: vi ${CP_PATH})` },
      { re: /^kubectl (?:logs|describe (?:pods?|po))[ /](?:pods?\/)?((?:kube-(?:scheduler|apiserver|controller-manager)|etcd)-cp-1|kube-proxy-\S+|coredns-\S+)\b.*$/, err: true,
        out: (s, m) => `Error from server (NotFound): pods "${(m && m[1]) || ''}" not found\n(Yeh pod kube-system namespace mein hai. Command ke aakhir mein -n kube-system jodo.)` },
      { re: /^kubectl get (?:cs|componentstatus(?:es)?)\b.*$/,
        out: s => 'Warning: v1 ComponentStatus is deprecated in v1.19+\n' + tbl([['NAME', 'STATUS', 'MESSAGE', 'ERROR'],
          s.cluster.schedOk ? ['scheduler', 'Healthy', 'ok', ''] : ['scheduler', 'Unhealthy', 'Get "https://127.0.0.1:10259/healthz": dial tcp 127.0.0.1:10259: connect: connection refused', ''],
          ['controller-manager', 'Healthy', 'ok', ''], ['etcd-0', 'Healthy', 'ok', '']]) },
      { re: /^ssh (?:\S+@)?(cp-1|worker-[12])$/,
        out: (s, m) => `Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-1015-aws x86_64)\n(simulator: tum isi terminal mein ho — ${(m && m[1]) || 'cp-1'} ki files yahin khulti hain. Control plane ki files: ls /etc/kubernetes/manifests)` },
      { re: /^ls(?: -l| -la)? \/etc\/kubernetes\/manifests\/?$/, out: 'etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml' },
      { re: /^(?:cat|vi|vim|nano) \/etc\/kubernetes\/manifests\/(etcd|kube-apiserver|kube-controller-manager)\.yaml$/,
        out: (s, m) => `(simulator: ${(m && m[1]) || 'yeh'} theek chal raha hai, uski file is mission mein nahi kholi jaati. Crash ho raha component kaunsa hai? kubectl get pods -n kube-system)` },
      { re: /^crictl ps\b.*$/,
        out: s => tbl([['CONTAINER', 'IMAGE', 'CREATED', 'STATE', 'NAME', 'ATTEMPT', 'POD ID', 'POD'],
          ['4f1c9a2b7d3e1', '0c1a9e7d2f4b8', '2 days ago', 'Running', 'kube-apiserver', '0', 'a7d2c91e4b3f5', 'kube-apiserver-cp-1'],
          ['8b2e5d1f9c7a3', '3e9b1c5a7d2f4', '2 days ago', 'Running', 'etcd', '0', 'c4e8a2d6f1b9e', 'etcd-cp-1'],
          s.cluster.schedOk ? ['b91d4e7c2a5f8', '5d8e2a1f7c9b3', '9 seconds ago', 'Running', 'kube-scheduler', '0', 'e2f7b4c9a1d6e', 'kube-scheduler-cp-1']
            : ['b91d4e7c2a5f8', '5d8e2a1f7c9b3', '6 seconds ago', 'Exited', 'kube-scheduler', String(s.cluster.edits || 12), 'e2f7b4c9a1d6e', 'kube-scheduler-cp-1']]) },
    ],
    files: {
      [CP_PATH]: {
        editable: true,
        desc: 'cp-1 node par kube-scheduler ki static pod file — kubelet isse pod banata hai',
        content: CP_FILE,
        apply: () => ({ err: `(simulator ne roka) Static pod ki file kubectl apply se nahi lagti. Yeh file cp-1 ka kubelet khud padhta hai — vi mein 💾 Save karte hi kubelet scheduler ka pod dobara banata hai.\n(kubectl apply karte toh kube-system mein "kube-scheduler" naam ka ek ALAG, aam pod ban jaata — asli scheduler waisa hi toota rehta.)` }),
        onSave: (s, text, docs, perr) => {
          const c = s.cluster;
          if (perr) return { err: `(cp-1 par kubelet ka log) "Could not process manifest file" err="${CP_PATH}: couldn't parse as pod(${perr.message}), please check config file"\n(kubelet file padh hi nahi paaya — scheduler ab bhi toota hai. vi se line ${perr.line} dekho.)` };
          const d = (docs || [])[0] || {}, ctr = ((d.spec || {}).containers || [])[0] || {};
          if (d.kind !== 'Pod') return { err: `(cp-1 par kubelet ka log) "Could not process manifest file" err="${CP_PATH}: invalid pod: kind ${d.kind || 'khaali'} hai, Pod chahiye"` };
          if (ctr.image !== CP_IMG) return { err: '(simulator ne roka) image badal gaya — control plane ka version kubeadm upgrade se badalta hai, haath se nahi. Sirf flag theek karo.' };
          const cmd = Array.isArray(ctr.command) ? ctr.command.map(String) : [];
          if (cmd[0] !== 'kube-scheduler') return { err: '(simulator ne roka) command ki pehli line "kube-scheduler" honi chahiye — wahi program chalta hai.' };
          c.cmd = cmd; c.edits = (c.edits || 0) + 1;
          c.crash = cpCrash(cmd);
          const was = c.schedOk;
          c.schedOk = !c.crash;
          if (c.schedOk && !was) {
            c.fixedAt = s.history.length;
            c.pods = c.pods.filter(p => !/^settlement-api-/.test(p.name)).concat([setPod('x4k2m', 'worker-1'), setPod('p7r9t', 'worker-2')]);
            c.deployments[1] = Object.assign({}, c.deployments[1], { ready: '2/2', available: 2 });
            c.events = tbl(CP_EV0.concat([
              ['9s', 'Normal', 'Scheduled', 'pod/settlement-api-7c9f6d5b8-x4k2m', 'Successfully assigned payments/settlement-api-7c9f6d5b8-x4k2m to worker-1'],
              ['9s', 'Normal', 'Scheduled', 'pod/settlement-api-7c9f6d5b8-p7r9t', 'Successfully assigned payments/settlement-api-7c9f6d5b8-p7r9t to worker-2'],
              ['5s', 'Normal', 'Started', 'pod/settlement-api-7c9f6d5b8-x4k2m', 'Started container settlement-api'],
              ['5s', 'Normal', 'Started', 'pod/settlement-api-7c9f6d5b8-p7r9t', 'Started container settlement-api']])).split('\n');
          }
          return `(cp-1 par kubelet ne ${CP_PATH} ka badlaav dekha → purana kube-scheduler container hataya, naya chalaya.)\nAb dekho chala ya nahi: kubectl get pods -n kube-system`;
        },
      },
    },
    success: KG.allOf(T_CP),
    successText: `<b>Chain:</b> CI ne <code>kubectl apply</code> kiya → API server ne Deployment <b>etcd</b> mein likha → <b>controller-manager</b> ne ReplicaSet aur 2 pods banaye (Events mein "Created pod") →
      <b>scheduler</b> ko node chunna tha — par scheduler crash ho raha tha. Isliye pod par <code>Node: &lt;none&gt;</code> aur <code>Events: &lt;none&gt;</code>: kisi ne pod ko dekha hi nahi.
      (Scheduler zinda ho par node na mile, toh <code>FailedScheduling</code> event aata hai.)<br>
      <b>Static pod:</b> control plane ke pods cp-1 ki files (<code>/etc/kubernetes/manifests</code>) se banate hain. kubelet file padhta hai — <code>kubectl edit/apply/delete</code> se ilaaj nahi hota. File theek karo, kubelet khud naya pod bana deta hai.<br>
      <b>Dhyan do:</b> scheduler down tha, phir bhi pay-api chalti rahi. Control plane down = <b>naye kaam ruk jaate hain</b>, chal rahe pods nahi marte.
      EKS mein yeh logs CloudWatch ke "control plane logging" mein milte hain (scheduler log type ON karna padta hai).`,
    hints: [
      'kubectl get pods, phir kubectl describe pod settlement-api-7c9f6d5b8-x4k2m. Node: <none> aur Events: <none> — kisi ne is pod ke liye node chuna hi nahi. Node kaun chunta hai?',
      'kubectl get pods -n kube-system — kaunsa pod CrashLoopBackOff mein hai? kubectl logs kube-scheduler-cp-1 -n kube-system — sabse aakhri line padho.',
      'vi /etc/kubernetes/manifests/kube-scheduler.yaml — flag ki spelling: "duraton" ko "duration" karo, 💾 Save. kubectl apply nahi — kubelet file khud padhta hai. Phir kubectl get pods.',
    ],
    solution: ['kubectl get pods', 'kubectl describe pod settlement-api-7c9f6d5b8-x4k2m', 'kubectl get pods -n kube-system', 'kubectl logs kube-scheduler-cp-1 -n kube-system',
      { edit: CP_PATH, change: [['--leader-elect-lease-duraton=30s', '--leader-elect-lease-duration=30s']] }, 'kubectl get pods'],
  }, {
    objectives: ['🖥️ <b>Mission:</b> pods Pending aur Events khaali — control plane ka kaunsa hissa mara hai? Static pod ki file khud theek karo'],
    success: ['Main "Events: &lt;none&gt;" wale Pending pod se pehchaan leta hoon ki scheduler down hai, aur static pod ki file theek kar sakta hoon'],
    cards: [
      { front: 'Pod Pending, <code>Node: &lt;none&gt;</code>, aur <code>Events: &lt;none&gt;</code> — sabse pehle kya shak karo?', back: '<b>Scheduler</b> chal hi nahi raha. Scheduler zinda ho aur node na mile toh <code>FailedScheduling</code> event aata hai. <code>kubectl get pods -n kube-system</code> dekho.' },
      { front: 'kubeadm cluster mein kube-scheduler ki config kahan badalte hain?', back: 'cp node par <code>/etc/kubernetes/manifests/kube-scheduler.yaml</code> — <b>static pod</b>. kubelet file dekhta hai aur pod khud dobara banata hai. <code>kubectl edit/apply</code> kaam nahi karta (woh sirf mirror pod hai).' },
    ],
  });

  /* =====================================================================
     🧲 affinity — Ravi ka podAntiAffinity do galtiyon ke saath:
     (1) labelSelector "app: payapi" — kisi pod se match nahi → rule khaali
     (2) topologyKey zone — 2 zones, 2 replicas + maxSurge 1 → rollout atakta hai
     Chhota scheduler: taint → CPU → required anti-affinity (filter), preferred + free CPU (score).
     Rolling update: maxSurge / maxUnavailable asli hisaab se.
     ===================================================================== */
  const AF_FILE_NAME = 'pay-api-deploy.yaml';
  const AF_IMG = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api:1.8.0';
  const AF_FILE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pay-api
  namespace: payments
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pay-api
  template:
    metadata:
      labels:
        app: pay-api
    spec:
      # Ravi (PR #482): "pay-api ke dono pods kabhi ek saath na marein"
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchLabels:
                app: payapi
            topologyKey: topology.kubernetes.io/zone
      containers:
      - name: pay-api
        image: ${AF_IMG}
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
`;
  const AF_N = [
    { name: 'node-1', zone: 'ap-south-1a', free: 1.0, ip: '10.0.12.5' },
    { name: 'node-2', zone: 'ap-south-1a', free: 0.8, ip: '10.0.13.5' },
    { name: 'node-3', zone: 'ap-south-1b', free: 2.5, ip: '10.0.44.5' },
    { name: 'node-4', zone: 'ap-south-1b', free: 2.5, ip: '10.0.45.5', taint: true },
  ];
  const afLabels = n => Object.assign({ 'kubernetes.io/arch': 'amd64', 'kubernetes.io/hostname': n.name, 'kubernetes.io/os': 'linux',
    'node.kubernetes.io/instance-type': 'm6i.xlarge', 'topology.kubernetes.io/region': 'ap-south-1', 'topology.kubernetes.io/zone': n.zone }, n.taint ? { workload: 'ledger' } : {});
  const AF_RS = ['7f9c4d', '5d2b8e', '8a3f1c', '9c6e2a', '4b7d9f', '3e8a5c', '2c9e7b', '6f1a3d'];
  const AF_SUF = ['k2', 'm4', 'p6', 'r8', 't1', 'v3', 'x5', 'z7', 'b9', 'd3', 'f5', 'h7'];
  const AF_PS_KEYS = ['affinity', 'containers', 'tolerations', 'nodeSelector', 'topologySpreadConstraints', 'serviceAccountName', 'terminationGracePeriodSeconds',
    'securityContext', 'volumes', 'initContainers', 'priorityClassName', 'nodeName', 'restartPolicy', 'dnsPolicy', 'schedulerName'];
  const AF_TERM_KEYS = ['labelSelector', 'namespaceSelector', 'namespaces', 'topologyKey', 'matchLabelKeys', 'mismatchLabelKeys'];
  const AFP = 'spec.template.spec.affinity.podAntiAffinity';
  const afBad = msg => deployBadReq(AF_FILE_NAME, msg);
  const intOrPct = (v, n, up) => {
    if (v == null) return null;
    const m = String(v).match(/^(\d+)%$/);
    if (m) return up ? Math.ceil(Number(m[1]) * n / 100) : Math.floor(Number(m[1]) * n / 100);
    return /^\d+$/.test(String(v)) ? Number(v) : NaN;
  };
  // ek anti-affinity term ko check + normalize karo (asli API errors ke saath)
  function afTerm(t, path) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return { err: afBad(`json: cannot unmarshal ${Array.isArray(t) ? 'array' : 'string'} into Go struct field PodAffinityTerm.${path} of type v1.PodAffinityTerm`) };
    const k = Object.keys(t).find(x => !AF_TERM_KEYS.includes(x));
    if (k) return { err: afBad(`strict decoding error: unknown field "${path}.${k}"`) };
    const ls = t.labelSelector;
    if (ls && typeof ls === 'object') {
      const lk = Object.keys(ls).find(x => !['matchLabels', 'matchExpressions'].includes(x));
      if (lk) return { err: afBad(`strict decoding error: unknown field "${path}.labelSelector.${lk}"`) };
    }
    if (!t.topologyKey) return { err: { err: `The Deployment "pay-api" is invalid: ${path}.topologyKey: Required value: can not be empty` } };
    if (t.namespaces || t.namespaceSelector || t.matchLabelKeys || t.mismatchLabelKeys) return { err: { err: '(simulator ne roka) namespaces / matchLabelKeys is mission mein nahi chahiye — labelSelector aur topologyKey hi theek karo.' } };
    return { term: { sel: ls || null, key: String(t.topologyKey) } };
  }
  // poori file → template (rule + rollout strategy) ya {err}
  function afParse(d) {
    const bad = deployChecks(AF_FILE_NAME, d);
    if (bad) return { err: bad };
    if (d.spec.replicas !== 2) return { err: { err: '(simulator ne roka) is mission mein replicas: 2 rakho — sawaal spread ka hai, ginti ka nahi.' } };
    const ps = (d.spec.template && d.spec.template.spec) || {};
    const pk = Object.keys(ps).find(k => !AF_PS_KEYS.includes(k));
    if (pk) return { err: afBad(`strict decoding error: unknown field "spec.template.spec.${pk}"`) };
    const ctr = (ps.containers || [])[0] || {};
    if (ctr.image !== AF_IMG || String((((ctr.resources || {}).requests) || {}).cpu) !== '500m') return { err: { err: '(simulator ne roka) container (image / requests) mat badlo — sirf affinity theek karo.' } };
    if (ps.tolerations) return { err: { err: '(simulator ne roka) toleration se pay-api node-4 par ja sakti hai — node-4 sirf ledger ke liye reserved hai (taint dedicated=ledger). pay-api ko wahan bhejna ledger ki CPU khaana hai. tolerations hatao.' } };
    if (ps.nodeSelector || ps.nodeName) return { err: { err: '(simulator ne roka) pods ko haath se node par baandhna (nodeSelector / nodeName) spread nahi hai — node mara toh woh pod bhi gaya. podAntiAffinity theek karo.' } };
    if (ps.topologySpreadConstraints) return { err: { err: '(simulator) topologySpreadConstraints bhi sahi raasta hai — par yeh simulator abhi sirf podAntiAffinity samajhta hai. Ravi ka podAntiAffinity block hi theek karo.' } };
    const st = d.spec.strategy || {};
    if (st.type === 'Recreate') return { err: { err: '(simulator ne roka) Recreate = pehle dono purane pods band, phir naye — utni der payments band. pay-api ke liye RollingUpdate hi rakho.' } };
    const ru = st.rollingUpdate || {};
    let surge = intOrPct(ru.maxSurge, 2, true), unav = intOrPct(ru.maxUnavailable, 2, false);
    if (surge == null) surge = 1;
    if (unav == null) unav = 0;
    if (isNaN(surge) || isNaN(unav)) return { err: { err: `The Deployment "pay-api" is invalid: spec.strategy.rollingUpdate: Invalid value: must be an integer or percentage (e.g '5%')` } };
    if (surge === 0 && unav === 0) return { err: { err: 'The Deployment "pay-api" is invalid: spec.strategy.rollingUpdate.maxUnavailable: Invalid value: intstr.IntOrString{Type:0, IntVal:0, StrVal:""}: may not be 0 when maxSurge is 0' } };
    const aff = ps.affinity || {};
    const ak = Object.keys(aff).find(k => !['nodeAffinity', 'podAffinity', 'podAntiAffinity'].includes(k));
    if (ak) return { err: afBad(`strict decoding error: unknown field "spec.template.spec.affinity.${ak}"`) };
    if (aff.nodeAffinity || aff.podAffinity) return { err: { err: '(simulator ne roka) nodeAffinity / podAffinity is mission mein nahi — sirf podAntiAffinity theek karo.' } };
    const paa = aff.podAntiAffinity || {};
    const pak = Object.keys(paa).find(k => !['requiredDuringSchedulingIgnoredDuringExecution', 'preferredDuringSchedulingIgnoredDuringExecution'].includes(k));
    if (pak) return { err: afBad(`strict decoding error: unknown field "${AFP}.${pak}"`) };
    const hard = [], soft = [];
    const req = paa.requiredDuringSchedulingIgnoredDuringExecution, pref = paa.preferredDuringSchedulingIgnoredDuringExecution;
    if (req != null && !Array.isArray(req)) return { err: afBad(`json: cannot unmarshal object into Go struct field PodAntiAffinity.${AFP}.requiredDuringSchedulingIgnoredDuringExecution of type []v1.PodAffinityTerm`) };
    if (pref != null && !Array.isArray(pref)) return { err: afBad(`json: cannot unmarshal object into Go struct field PodAntiAffinity.${AFP}.preferredDuringSchedulingIgnoredDuringExecution of type []v1.WeightedPodAffinityTerm`) };
    for (let i = 0; i < (req || []).length; i++) {
      const r = afTerm(req[i], `${AFP}.requiredDuringSchedulingIgnoredDuringExecution[${i}]`);
      if (r.err) return r; hard.push(r.term);
    }
    for (let i = 0; i < (pref || []).length; i++) {
      const w = pref[i] || {}, P = `${AFP}.preferredDuringSchedulingIgnoredDuringExecution[${i}]`;
      const wk = Object.keys(w).find(k => !['weight', 'podAffinityTerm'].includes(k));
      if (wk) return { err: afBad(`strict decoding error: unknown field "${P}.${wk}"` + (AF_TERM_KEYS.includes(wk) ? `\n(preferred mein term "podAffinityTerm:" ke andar jaata hai, weight ke saath)` : '')) };
      if (typeof w.weight !== 'number' || w.weight < 1 || w.weight > 100) return { err: { err: `The Deployment "pay-api" is invalid: ${P}.weight: Invalid value: ${w.weight == null ? 0 : JSON.stringify(w.weight)}: must be in the range 1-100` } };
      const r = afTerm(w.podAffinityTerm || {}, `${P}.podAffinityTerm`);
      if (r.err) return r; soft.push(Object.assign({ weight: w.weight }, r.term));
    }
    return { tpl: { hard, soft, surge, unav, key: JSON.stringify([aff, st]) } };
  }
  const afSelMatch = (sel, labels) => {
    if (!sel) return false;   // labelSelector hi nahi = kisi pod se match nahi
    const ml = sel.matchLabels || {}, me = sel.matchExpressions || [];
    return Object.keys(ml).every(k => labels[k] === String(ml[k])) && me.every(e => {
      const v = labels[e.key], vals = (e.values || []).map(String);
      return e.operator === 'In' ? vals.includes(v) : e.operator === 'NotIn' ? !vals.includes(v) : e.operator === 'Exists' ? v != null : e.operator === 'DoesNotExist' ? v == null : false;
    });
  };
  const afPay = c => c.pods.filter(p => p.labels && p.labels.app === 'pay-api');
  const afFree = (c, n) => n.free - 0.5 * afPay(c).filter(p => p.node === n.name).length;
  // kya is node par term ka koi matching pod (usi topology domain mein) pehle se hai?
  const afClash = (c, term, n) => {
    const dom = afLabels(n)[term.key];
    if (dom == null) return false;   // node par woh label hi nahi → koi domain nahi → takkar nahi
    return c.pods.some(p => p.node && p.node !== '<none>' && afSelMatch(term.sel, p.labels || {}) &&
      afLabels(AF_N.find(x => x.name === p.node) || {})[term.key] === dom);
  };
  // chhota kube-scheduler: filter (taint → cpu → required anti-affinity), score (preferred weight, phir free CPU)
  function afSchedule(c, tpl) {
    let taint = 0, cpu = 0, anti = 0;
    const ok = [];
    AF_N.forEach(n => {
      if (n.taint) taint++;
      else if (afFree(c, n) < 0.5) cpu++;
      else if (tpl.hard.some(t => afClash(c, t, n))) anti++;
      else ok.push(n);
    });
    if (!ok.length) {
      const r = [], p = [];
      if (anti) { r.push(`${anti} node(s) didn't match pod anti-affinity rules`); }
      if (taint) { r.push(`${taint} node(s) had untolerated taint {dedicated: ledger}`); p.push(`${taint} Preemption is not helpful for scheduling`); }
      if (cpu) r.push(`${cpu} Insufficient cpu`);
      if (anti + cpu) p.push(`${anti + cpu} No preemption victims found for incoming pod`);
      return { msg: `0/4 nodes are available: ${r.sort().join(', ')}. preemption: 0/4 nodes are available: ${p.sort().join(', ')}.` };
    }
    const score = n => tpl.soft.reduce((a, t) => a + (afClash(c, t, n) ? 0 : t.weight), 0) * 10 + afFree(c, n);
    ok.sort((a, b) => score(b) - score(a));
    return { node: ok[0] };
  }
  const afPodDesc = p => {
    const n = AF_N.find(x => x.name === p.node);
    return `Name:             ${p.name}
Namespace:        payments
Priority:         0
Service Account:  default
Node:             ${n ? n.name + '/' + n.ip : '<none>'}
Labels:           app=pay-api
                  pod-template-hash=${p.rs}
Status:           ${p.status}
IP:               ${p.ip === '<none>' ? '' : p.ip}
Controlled By:    ReplicaSet/pay-api-${p.rs}
Containers:
  pay-api:
    Image:      ${AF_IMG}
    Requests:
      cpu:      500m
      memory:   512Mi
` + (n ? `Conditions:
  Type           Status
  PodScheduled   True
  Ready          True
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  ${p.age}    default-scheduler  Successfully assigned payments/${p.name} to ${n.name}
  Normal  Started    ${p.age}    kubelet            Started container pay-api` : `Conditions:
  Type           Status
  PodScheduled   False
Events:
  Type     Reason            Age   From               Message
  ----     ------            ----  ----               -------
  Warning  FailedScheduling  6s    default-scheduler  ${p.why}`);
  };
  function afNewPod(c, rs) {
    let nm;
    do { nm = 'pay-api-' + rs.hash + '-' + AF_SUF[c.podN % AF_SUF.length]; c.podN++; } while (c.pods.some(p => p.name === nm));
    const p = { name: nm, ready: '0/1', status: 'Pending', restarts: 0, age: '6s', node: '<none>', ip: '<none>', rs: rs.hash, labels: { app: 'pay-api', 'pod-template-hash': rs.hash } };
    afPlace(c, p, rs.tpl);
    c.pods.push(p);
    return p;
  }
  function afPlace(c, p, tpl) {
    const r = afSchedule(c, tpl);
    if (r.node) Object.assign(p, { node: r.node.name, status: 'Running', ready: '1/1', ip: r.node.ip.replace(/\.5$/, '.' + (60 + c.podN)), why: null });
    else p.why = r.msg;
    p.describe = afPodDesc(p);
  }
  const afRsOf = (c, h) => c.rsets.find(r => r.hash === h);
  // Deployment controller: rolling update — pehle naya pod (maxSurge tak), phir purana hatao (maxUnavailable ke andar)
  function afRoll(c, s) {
    const cur = c.rsets[c.rsets.length - 1];
    afPay(c).filter(p => p.rs === cur.hash && p.status === 'Pending').forEach(p => afPlace(c, p, cur.tpl));   // atke pods ko dobara koshish
    for (let guard = 0; guard < 30; guard++) {
      const live = afPay(c), curPods = live.filter(p => p.rs === cur.hash), old = live.filter(p => p.rs !== cur.hash);
      const oldPend = old.find(p => p.status !== 'Running');
      if (oldPend) { c.pods.splice(c.pods.indexOf(oldPend), 1); afRsOf(c, oldPend.rs).want--; continue; }
      const running = live.filter(p => p.status === 'Running').length;
      if (curPods.length < 2 && live.length < 2 + cur.tpl.surge) { cur.want++; afNewPod(c, cur); continue; }
      if (old.length && running - 1 >= 2 - cur.tpl.unav) {
        const victim = old.slice().sort((a, b) => c.rsets.indexOf(afRsOf(c, a.rs)) - c.rsets.indexOf(afRsOf(c, b.rs)))[0];
        c.pods.splice(c.pods.indexOf(victim), 1); afRsOf(c, victim.rs).want--; continue;
      }
      break;
    }
    const live = afPay(c), run = live.filter(p => p.status === 'Running').length;
    Object.assign(c.deployments[0], { ready: Math.min(run, 2) + '/2', upToDate: live.filter(p => p.rs === cur.hash).length, available: Math.min(run, 2) });
    if (afSpread(c) && !c.ok) { c.ok = true; c.okAt = s.history.length; }
    if (!afSpread(c)) c.ok = false;
  }
  // jeet: saare pay-api pods naye template ke, Running, alag-alag node par, node-4 par koi nahi
  const afSpread = c => {
    const cur = c.rsets[c.rsets.length - 1], ps = afPay(c);
    return ps.length === 2 && ps.every(p => p.rs === cur.hash && p.status === 'Running' && p.node !== 'node-4') && ps[0].node !== ps[1].node;
  };
  function afRolloutStatus(c) {
    const cur = c.rsets[c.rsets.length - 1], live = afPay(c), upd = live.filter(p => p.rs === cur.hash);
    if (upd.length < 2) return `Waiting for deployment "pay-api" rollout to finish: ${upd.length} out of 2 new replicas have been updated...`;
    if (live.length > upd.length) return `Waiting for deployment "pay-api" rollout to finish: ${live.length - upd.length} old replicas are pending termination...\n(simulator: rollout yahin atka hai — asli kubectl yahan intezaar karta rehta. Ctrl+C. Kaunsa pod Pending hai? kubectl get pods -o wide)`;
    if (upd.some(p => p.status !== 'Running')) return `Waiting for deployment "pay-api" rollout to finish: ${upd.filter(p => p.status === 'Running').length} of 2 updated replicas are available...`;
    return 'deployment "pay-api" successfully rolled out';
  }
  const afNodeDesc = (c, n) => `Name:               ${n.name}
Roles:              <none>
Labels:             ${Object.entries(afLabels(n)).map(([k, v]) => k + '=' + v).join('\n                    ')}
Taints:             ${n.taint ? 'dedicated=ledger:NoSchedule' : '<none>'}
Unschedulable:      false
Capacity:
  cpu:                4
  memory:             16Gi
Allocatable:
  cpu:                3920m
  memory:             15Gi
Non-terminated Pods:          (${c.pods.filter(p => p.node === n.name).length} payments pods dikhaye — system pods chhote kiye)
` + tbl([['  Namespace', 'Name', 'CPU Requests'], ['  ---------', '----', '------------']].concat(c.pods.filter(p => p.node === n.name)
      .map(p => ['  payments', p.name, p.labels.app === 'ledger' ? '1 (25%)' : '500m (12%)']))) +
    `\nAllocated resources:\n  Resource           Requests\n  --------           --------\n  cpu                ${Math.round((3.92 - afFree(c, n)) * 1000)}m (${Math.round((3.92 - afFree(c, n)) / 3.92 * 100)}%)`;
  const afPodTable = (c, pods, wide, labels) => tbl([['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'].concat(wide ? ['IP', 'NODE', 'NOMINATED NODE', 'READINESS GATES'] : []).concat(labels ? ['LABELS'] : [])]
    .concat(pods.map(p => [p.name, p.ready, p.status, String(p.restarts), p.age].concat(wide ? [p.ip, p.node, '<none>', '<none>'] : [])
      .concat(labels ? [Object.entries(p.labels).map(([k, v]) => k + '=' + v).join(',')] : []))));
  const LEDGER_DESC = `Name:             ledger-0
Namespace:        payments
Priority:         0
Service Account:  ledger
Node:             node-4/10.0.45.5
Labels:           app=ledger
                  statefulset.kubernetes.io/pod-name=ledger-0
Status:           Running
IP:               10.0.45.11
Controlled By:    StatefulSet/ledger
Containers:
  ledger:
    Image:      111122223333.dkr.ecr.ap-south-1.amazonaws.com/ledger:3.2.1
    Requests:
      cpu:      1
      memory:   4Gi
Node-Selectors:  workload=ledger
Tolerations:     dedicated=ledger:NoSchedule
                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                 node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:          <none>`;
  const T_AF = [
    { text: 'Dekho <code>pay-api</code> ke pods kis node par hain (<code>kubectl get pods -o wide</code>)', check: s => ran(s, /^kubectl get (pods?|po)\b.*(-o ?wide|-owide|--output=wide)/) },
    { text: 'Ravi ka rule padho (<code>cat pay-api-deploy.yaml</code>)', check: s => ran(s, /^(cat|vi|vim|nano) pay-api-deploy\.yaml$|^kubectl get (deploy|deployments?)[ \/]pay-api\b.*-o ?yaml/) },
    { text: 'Rule ka <code>labelSelector</code> pods ke asli labels se milao (<code>kubectl get pods --show-labels</code>)', check: s => ran(s, /^kubectl get (pods?|po)\b.*(--show-labels|-L |(-l|--selector)[ =])|^kubectl describe (pods?|po)[ \/]pay-api/) },
    { text: 'Rule theek karke apply karo: dono pods <b>alag node</b> par, koi Pending nahi', check: s => afSpread(s.cluster) },
    { text: '<code>kubectl get pods -o wide</code> se pakka karo', check: s => afSpread(s.cluster) && ranAfter(s, s.cluster.okAt, /^kubectl get (pods?|po)\b.*(-o ?wide|-owide|--output=wide)/) },
  ];
  const AF_TPL0 = afParse(KG.yaml.parse(AF_FILE)).tpl;
  addLab('affinity', {
    type: 'terminal',
    title: '🖥️ Mission: anti-affinity likhi thi, phir bhi dono pods ek node par',
    instructions: 'Kal raat 2:40 baje ChaiPay ke cluster mein node-3 ka EC2 instance achanak band hua. pay-api ke DONO pods node-3 par the — 4 minute tak saare UPI payments fail. Ravi ne parso PR #482 mein podAntiAffinity jodi thi, taaki aisa kabhi na ho. Phir bhi aaj subah 6 baje ke deploy ke baad dono pods phir se ek hi node par hain. node-4 sirf ledger database ke liye reserved hai.',
    goal: `<code>pay-api</code> ke dono pods <b>alag-alag node</b> par chalao — taaki ek node mare toh doosra pod payments sambhale. Rollout poora ho, koi pod Pending na rahe.
      Fix Ravi ki file mein karo: <code>vi pay-api-deploy.yaml</code> → 💾 Save → <code>kubectl apply -f pay-api-deploy.yaml</code>.`,
    tasks: T_AF,
    cluster: {
      nodes: AF_N.map(n => ({ name: n.name, status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4', zone: n.zone, labels: afLabels(n), describe: '' })),
      podN: 0, ok: false,
      rsets: [{ hash: '6b8d7c', tpl: AF_TPL0, want: 2 }],
      pods: [
        { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '4h', node: 'node-3', ip: '10.0.44.21', rs: '6b8d7c', labels: { app: 'pay-api', 'pod-template-hash': '6b8d7c' } },
        { name: 'pay-api-6b8d7c-b2', ready: '1/1', status: 'Running', restarts: 0, age: '4h', node: 'node-3', ip: '10.0.44.22', rs: '6b8d7c', labels: { app: 'pay-api', 'pod-template-hash': '6b8d7c' } },
        { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '12d', node: 'node-4', ip: '10.0.45.11', labels: { app: 'ledger', 'statefulset.kubernetes.io/pod-name': 'ledger-0' }, describe: LEDGER_DESC },
      ].map(p => p.describe ? p : Object.assign(p, { describe: afPodDesc(p) })),
      deployments: [{ name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' }],
      statefulsets: [{ name: 'ledger', ready: '1/1', age: '40d' }],
    },
    responses: [
      { re: /^kubectl get (?:pods?|po)\b.*(?:-l|--selector)[ =](\S+).*$/,
        out: (s, m) => {
          const c = s.cluster, raw = String((m && m[1]) || ''), want = {};
          raw.split(',').forEach(kv => { const [k, v] = kv.split('='); if (k) want[k] = v; });
          const pods = c.pods.filter(p => Object.keys(want).every(k => (p.labels || {})[k] === want[k]));
          return pods.length ? afPodTable(c, pods, /-o ?wide|-owide/.test(String(m && m[0])), /--show-labels/.test(String(m && m[0]))) : 'No resources found in payments namespace.';
        } },
      { re: /^kubectl get (?:pods?|po)\b.*--show-labels\b.*$/, out: (s, m) => afPodTable(s.cluster, s.cluster.pods, /-o ?wide|-owide/.test(String(m && m[0])), true) },
      { re: /^kubectl get (?:nodes?|no)\b.*--show-labels\b.*$/,
        out: s => tbl([['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION', 'LABELS']].concat(AF_N.map(n => [n.name, 'Ready', '<none>', '40d', 'v1.33.4', Object.entries(afLabels(n)).map(([k, v]) => k + '=' + v).join(',')]))) },
      { re: /^kubectl describe (?:nodes?|no)(?:[ /](node-[1-4]))?$/,
        out: (s, m) => (m && m[1] ? [AF_N.find(n => n.name === m[1])] : AF_N).map(n => afNodeDesc(s.cluster, n)).join('\n\n\n') },
      { re: rx('kubectl get (?:rs|replicasets?)'),
        out: s => tbl([['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE']].concat(s.cluster.rsets.map((r, i) => {
          const ps = afPay(s.cluster).filter(p => p.rs === r.hash);
          return ['pay-api-' + r.hash, r.want, ps.length, ps.filter(p => p.status === 'Running').length, i ? '6s' : '4h'];
        }))) },
      { re: rx('kubectl rollout status (?:deploy(?:ment)?)[ /]pay-api'), out: s => afRolloutStatus(s.cluster) },
      { re: rx('kubectl rollout undo (?:deploy(?:ment)?)[ /]pay-api'),
        out: s => {
          const c = s.cluster;
          if (c.rsets.length < 2) return 'error: no rollout history found for deployment "pay-api"';
          c.rsets.splice(c.rsets.length - 2, 0, c.rsets.pop());
          afRoll(c, s);
          return 'deployment.apps/pay-api rolled back\n(Dhyan do: cluster pichhle template par chala gaya, par pay-api-deploy.yaml file mein abhi bhi tumhara naya version hai.)';
        } },
      { re: /^kubectl delete (?:pods?|po)[ /](pay-api-\S+?)(?: (?:-n|--namespace)[ =]payments)?$/,
        out: (s, m) => {
          const c = s.cluster, name = String((m && m[1]) || ''), p = c.pods.find(x => x.name === name);
          if (!p) return `Error from server (NotFound): pods "${name}" not found`;
          c.pods.splice(c.pods.indexOf(p), 1);
          const rs = afRsOf(c, p.rs);
          afNewPod(c, rs);   // ReplicaSet apni ginti poori karta hai
          afRoll(c, s);
          return `pod "${name}" deleted\n(ReplicaSet pay-api-${rs.hash} ne naya pod banaya — kubectl get pods -o wide)`;
        } },
      { re: /^kubectl taint (?:nodes?|no) node-4\b.*$/, err: true,
        out: '(simulator ne roka) node-4 ledger ka dedicated node hai — taint hataoge toh baaki apps ke pods bhi wahan aa jayenge aur ledger database ki CPU kha jayenge. Taint rehne do.' },
      { re: rx('kubectl get (?:deploy(?:ment)?s?)[ /]pay-api -o ?yaml'),
        out: s => '# (simulator: live Deployment ka spec — status ka hissa chhota kiya)\n' + (s.cluster.liveText || AF_FILE) + 'status:\n  availableReplicas: ' + s.cluster.deployments[0].available + '\n  replicas: ' + afPay(s.cluster).length },
    ],
    files: {
      [AF_FILE_NAME]: {
        editable: true,
        desc: 'pay-api ka Deployment — Ravi ka anti-affinity rule ismein hai',
        content: AF_FILE,
        apply: (s, text, docs) => {
          const c = s.cluster, r = afParse((docs || [])[0]);
          if (r.err) return r.err;
          const cur = c.rsets[c.rsets.length - 1];
          if (r.tpl.key === cur.tpl.key) return 'deployment.apps/pay-api unchanged';
          const same = c.rsets.find(x => x.tpl.key === r.tpl.key);
          if (same) c.rsets.splice(c.rsets.indexOf(same), 1).forEach(x => c.rsets.push(x));   // wahi template pehle bhi tha → purana ReplicaSet wapas
          else c.rsets.push({ hash: AF_RS[(c.rsets.length - 1) % AF_RS.length], tpl: r.tpl, want: 0 });
          c.liveText = text;
          afRoll(c, s);
          return 'deployment.apps/pay-api configured';
        },
      },
    },
    success: KG.allOf(T_AF),
    successText: `<b>Galti 1 — selector:</b> rule <code>app: payapi</code> dhoondh raha tha, pods par <code>app=pay-api</code> hai. Selector kisi pod se match nahi hua, toh rule <b>khaali</b> tha — aur Kubernetes ne koi error nahi diya.
      Selector ko hamesha test karo: <code>kubectl get pods -l app=payapi</code> → "No resources found" = rule kuch nahi pakadta.<br>
      <b>Galti 2 — topologyKey:</b> <code>kubernetes.io/hostname</code> = har <b>node</b> alag. <code>topology.kubernetes.io/zone</code> = har <b>zone</b> mein sirf ek pod.
      Is cluster mein pay-api ke liye 2 hi zones hain. Rolling update mein ek waqt 3 pods hote hain (2 + maxSurge 1) — teesre ko jagah nahi mili, rollout atak gaya.
      <b>Niyam:</b> required anti-affinity ke saath, jagah (nodes ya zones) ≥ replicas + maxSurge chahiye.<br>
      <b>Taint:</b> node-4 par <code>dedicated=ledger:NoSchedule</code> — sirf toleration wale (ledger) pods. Taint = node ka pehra; affinity = pod ki pasand.
      Production mein zone spread ke liye <code>topologySpreadConstraints</code> (maxSkew 1) zyada lachila hai.`,
    hints: [
      'kubectl get pods -o wide — NODE column dekho. Phir cat pay-api-deploy.yaml aur kubectl get pods --show-labels. Rule ka matchLabels pod ke label se milta hai?',
      'Rule "app: payapi" dhoondhta hai, pods par "app=pay-api" hai. vi pay-api-deploy.yaml se theek karo, Save, kubectl apply -f pay-api-deploy.yaml, phir kubectl get pods -o wide. Koi pod Pending? kubectl describe pod <us-pod-ka-naam> ke Events padho.',
      '"didn\'t match pod anti-affinity rules" + zone: kubectl get nodes -L topology.kubernetes.io/zone — 2 hi zones hain. Rollout mein 3 pods ek saath hote hain. topologyKey ko kubernetes.io/hostname karo (har node alag), Save, apply.',
    ],
    solution: ['kubectl get pods -o wide', 'cat pay-api-deploy.yaml', 'kubectl get pods --show-labels',
      { edit: AF_FILE_NAME, change: [['app: payapi', 'app: pay-api'], ['topologyKey: topology.kubernetes.io/zone', 'topologyKey: kubernetes.io/hostname']] },
      'kubectl apply -f pay-api-deploy.yaml', 'kubectl get pods -o wide'],
  }, {
    objectives: ['🖥️ <b>Mission:</b> toota podAntiAffinity theek karo — selector ka typo aur zone vs hostname, asli rolling update ke saath'],
    success: ['Main anti-affinity ka selector test kar sakta hoon (kubectl get pods -l) aur topologyKey sahi chun sakta hoon'],
    cards: [
      { front: 'Anti-affinity likhi hai, phir bhi pods ek node par — sabse pehle kya check karo?', back: 'Rule ka <code>labelSelector</code>. <code>kubectl get pods -l &lt;selector&gt;</code> chalao — "No resources found" = rule kisi pod ko nahi pakadta. Kubernetes iska koi error nahi deta.' },
      { front: 'Required anti-affinity + <code>topologyKey: zone</code>, 2 zones, 2 replicas — rollout kyun atakta hai?', back: 'Rolling update mein ek waqt 3 pods (2 + maxSurge 1). Har zone mein sirf ek pod ki ijaazat → teesra Pending → purana pod hatta nahi. Jagah ≥ replicas + maxSurge chahiye — ya hostname key / preferred / topologySpreadConstraints.' },
    ],
  });

  /* =====================================================================
     📈 observability — alert kal fire hi nahi hua: rule mein label "status"
     (metric mein "code" hai) aur "for: 30m" (outage 20 min ka tha).
     Chhota PromQL engine + promtool test rules jaisa replay (test file ke
     asli input_series se, minute-dar-minute).
     ===================================================================== */
  const PQ_AGGS = ['sum', 'avg', 'max', 'min', 'count'], PQ_FUNCS = ['rate', 'irate', 'increase'];
  function pqErr(src, i, msg) {
    const before = src.slice(0, i), line = before.split('\n').length, col = i - before.lastIndexOf('\n');
    const e = new Error(`${line}:${col}: parse error: ${msg}`); e.pq = true; return e;
  }
  function pqLex(src) {
    const toks = []; let i = 0, m;
    while (i < src.length) {
      const rest = src.slice(i);
      if (/^\s/.test(rest)) { i++; continue; }
      if ((m = rest.match(/^\[(\d+[smhdwy])\]/))) toks.push({ t: 'range', v: m[1], at: i });
      else if (rest[0] === '[') throw pqErr(src, i, `bad number or duration syntax: "${rest.slice(1).split(']')[0]}"`);
      else if ((m = rest.match(/^(\d+(\.\d+)?([eE][-+]?\d+)?|\.\d+)/))) toks.push({ t: 'num', v: Number(m[0]), at: i });
      else if ((m = rest.match(/^[A-Za-z_:][A-Za-z0-9_:]*/))) toks.push({ t: 'id', v: m[0], at: i });
      else if ((m = rest.match(/^("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/))) toks.push({ t: 'str', v: m[0].slice(1, -1), at: i });
      else if ((m = rest.match(/^(=~|!~|!=|==|>=|<=|[=<>+\-*/(){},])/))) toks.push({ t: 'op', v: m[0], at: i });
      else if (/^["']/.test(rest)) throw pqErr(src, i, 'unterminated quoted string');
      else throw pqErr(src, i, `unexpected character: '${rest[0]}'`);
      i += m[0].length;
    }
    return toks;
  }
  function pqParse(src) {
    const toks = pqLex(src); let k = 0;
    const peek = () => toks[k], next = () => toks[k++];
    const desc = t => !t ? '<EOF>' : t.t === 'id' ? `identifier "${t.v}"` : t.t === 'num' ? `number "${t.v}"` : t.t === 'str' ? `string "${t.v}"` : t.t === 'range' ? `"[${t.v}]"` : `"${t.v}"`;
    const bad = (t, extra) => pqErr(src, t ? t.at : src.length, `unexpected ${desc(t)}${extra || ''}`);
    const want = v => { const t = next(); if (!t || t.v !== v) throw bad(t, `, expected "${v}"`); return t; };
    const isOp = (t, list) => t && t.t === 'op' && list.includes(t.v);
    function grp() {
      want('('); const ls = [];
      for (;;) { const t = next(); if (!t) throw bad(t); if (t.v === ')') return ls; if (t.t === 'id') ls.push(t.v); else if (t.v !== ',') throw bad(t, ' in grouping opts'); }
    }
    function sel(name, at) {
      const ms = name ? [{ k: '__name__', op: '=', v: name }] : [];
      if (peek() && peek().v === '{') {
        next();
        for (;;) {
          const t = next();
          if (!t) throw bad(t, ' inside braces');
          if (t.v === '}') break;
          if (t.v === ',') continue;
          if (t.t !== 'id') throw bad(t, ' in label matching, expected label');
          const op = next();
          if (!isOp(op, ['=', '!=', '=~', '!~'])) throw bad(op, ' in label matching, expected label matching operator');
          const val = next();
          if (!val || val.t !== 'str') throw bad(val, ' in label matching, expected string');
          if (op.v.includes('~')) { try { new RegExp(val.v); } catch (e) { throw pqErr(src, val.at, `error parsing regexp: invalid regexp "${val.v}"`); } }
          ms.push({ k: t.v, op: op.v, v: val.v });
        }
      }
      if (!ms.some(x => x.v !== '' || x.op !== '=')) throw pqErr(src, at, 'vector selector must contain at least one non-empty matcher');
      const r = { sel: ms };
      if (peek() && peek().t === 'range') r.range = next().v;
      return r;
    }
    function atom() {
      const t = next();
      if (!t) throw bad(t);
      if (t.t === 'num') return { num: t.v };
      if (t.v === '(') { const e = cmp(); want(')'); return e; }
      if (t.v === '-') return { op: '*', l: { num: -1 }, r: atom() };
      if (t.v === '{') { k--; return sel(null, t.at); }
      if (t.t === 'id') {
        if (PQ_AGGS.includes(t.v)) {
          let mod = null;
          if (peek() && /^(by|without)$/.test(peek().v)) mod = { w: next().v, ls: grp() };
          want('('); const e = cmp(); want(')');
          if (!mod && peek() && /^(by|without)$/.test(peek().v)) mod = { w: next().v, ls: grp() };
          return { agg: t.v, mod, e };
        }
        if (PQ_FUNCS.includes(t.v)) {
          want('('); const a = atom();
          if (!a.sel || !a.range) throw pqErr(src, t.at, `expected type range vector in call to function "${t.v}", got instant vector`);
          want(')'); return { fn: t.v, a };
        }
        if (peek() && peek().v === '(') throw pqErr(src, t.at, `unknown function with name "${t.v}"`);
        return sel(t.v, t.at);
      }
      throw bad(t);
    }
    function mul() { let l = atom(); while (isOp(peek(), ['*', '/'])) { const o = next().v; l = { op: o, l, r: atom() }; } return l; }
    function add() { let l = mul(); while (isOp(peek(), ['+', '-'])) { const o = next().v; l = { op: o, l, r: mul() }; } return l; }
    function cmp() {
      const l = add();
      if (isOp(peek(), ['>', '<', '>=', '<=', '==', '!='])) {
        const o = next().v;
        if (peek() && peek().v === 'bool') throw pqErr(src, peek().at, '"bool" modifier yeh simulator nahi samajhta');
        return { op: o, cmp: true, l, r: add() };
      }
      return l;
    }
    const e = cmp();
    if (k < toks.length) throw bad(toks[k]);
    return e;
  }
  const pqMin = d => { const m = String(d).match(/^(\d+)([smhdwy])$/); return Number(m[1]) * { s: 1 / 60, m: 1, h: 60, d: 1440, w: 10080, y: 525600 }[m[2]]; };
  const pqMatch = (ms, l) => ms.every(m => {
    const v = l[m.k] || '';
    if (m.op === '=') return v === m.v;
    if (m.op === '!=') return v !== m.v;
    const hit = new RegExp('^(?:' + m.v + ')$').test(v);
    return m.op === '=~' ? hit : !hit;
  });
  const noName = l => { const o = Object.assign({}, l); delete o.__name__; return o; };
  const pqKey = l => Object.keys(l).filter(x => x !== '__name__').sort().map(x => x + '=' + l[x]).join(',');
  const PQ_F = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b,
    '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a === b, '!=': (a, b) => a !== b };
  // { s: number } ya { v: [{ l: labels, v: number }] }  — t = minute
  function pqEval(n, t, data) {
    if (n.num != null) return { s: n.num };
    if (n.sel) {
      if (n.range) { const e = new Error('range vector seedha nahi dikhta — rate(...[5m]) ya increase(...) ke andar likho'); e.pq = true; throw e; }
      return { v: data.filter(x => pqMatch(n.sel, x.labels)).map(x => ({ l: x.labels, v: x.at(t) })) };
    }
    if (n.fn) {
      const w = n.fn === 'irate' ? 1 : pqMin(n.a.range);
      return { v: data.filter(x => pqMatch(n.a.sel, x.labels)).map(x => { const inc = Math.max(0, x.at(t) - x.at(t - w)); return { l: noName(x.labels), v: n.fn === 'increase' ? inc : inc / (w * 60) }; }) };
    }
    if (n.agg) {
      const r = pqEval(n.e, t, data);
      if (!r.v) { const e = new Error(`expected type instant vector in aggregation expression, got scalar`); e.pq = true; throw e; }
      const g = {};
      r.v.forEach(x => {
        const l = {};
        Object.keys(x.l).forEach(k => { if (k !== '__name__' && n.mod && (n.mod.w === 'by' ? n.mod.ls.includes(k) : !n.mod.ls.includes(k))) l[k] = x.l[k]; });
        const key = pqKey(l); (g[key] = g[key] || { l, vs: [] }).vs.push(x.v);
      });
      return { v: Object.values(g).map(x => ({ l: x.l, v: n.agg === 'sum' ? x.vs.reduce((a, b) => a + b, 0) : n.agg === 'avg' ? x.vs.reduce((a, b) => a + b, 0) / x.vs.length
        : n.agg === 'max' ? Math.max(...x.vs) : n.agg === 'min' ? Math.min(...x.vs) : x.vs.length })) };
    }
    const a = pqEval(n.l, t, data), b = pqEval(n.r, t, data), f = PQ_F[n.op];
    if (a.s != null && b.s != null) {
      if (n.cmp) { const e = new Error('comparisons between scalars must use BOOL modifier'); e.pq = true; throw e; }
      return { s: f(a.s, b.s) };
    }
    if (a.v && b.s != null) return { v: a.v.map(x => n.cmp ? (f(x.v, b.s) ? x : null) : { l: noName(x.l), v: f(x.v, b.s) }).filter(Boolean) };
    if (a.s != null && b.v) return { v: b.v.map(x => n.cmp ? (f(a.s, x.v) ? x : null) : { l: noName(x.l), v: f(a.s, x.v) }).filter(Boolean) };
    const out = [];
    a.v.forEach(x => { const y = b.v.find(z => pqKey(z.l) === pqKey(x.l)); if (!y) return; if (n.cmp) { if (f(x.v, y.v)) out.push(x); } else out.push({ l: noName(x.l), v: f(x.v, y.v) }); });
    return { v: out };
  }
  const fmtL = l => '{' + Object.keys(l).sort().map(k => `${k}="${l[k]}"`).join(', ') + '}';
  const fmtNum = v => Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(15)));
  // asli Prometheus mein pay-api ke series (target labels ke saath) — t = minute, abhi = 0
  const PQ_LIVE = [];
  [['pay-api-6b8d7c-a1', '10.0.12.21'], ['pay-api-6b8d7c-b2', '10.0.13.21']].forEach(([pod, ip], i) => {
    [['200', 'POST', '/pay', 498, 18234512 - i * 44075], ['500', 'POST', '/pay', 0.5, 9123 - i * 36], ['200', 'GET', '/healthz', 6, 104233 - i * 12]].forEach(([code, method, route, perMin, base]) => {
      PQ_LIVE.push({ labels: { __name__: 'http_requests_total', code, container: 'pay-api', endpoint: 'http', instance: ip + ':8080', job: 'pay-api', method, namespace: 'payments', pod, route, service: 'pay-api' },
        at: t => Math.round(base + perMin * t) });
    });
    PQ_LIVE.push({ labels: { __name__: 'up', container: 'pay-api', endpoint: 'http', instance: ip + ':8080', job: 'pay-api', namespace: 'payments', pod, service: 'pay-api' }, at: () => 1 });
  });
  const METRICS_PAGE = pod => {
    const i = pod === 'pay-api-6b8d7c-b2' ? 1 : 0;
    return `# HELP http_requests_total Total HTTP requests handled by pay-api.
# TYPE http_requests_total counter
http_requests_total{code="200",method="POST",route="/pay"} ${18234512 - i * 44075}
http_requests_total{code="500",method="POST",route="/pay"} ${9123 - i * 36}
http_requests_total{code="200",method="GET",route="/healthz"} ${104233 - i * 12}
# HELP http_request_duration_seconds Request latency.
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{route="/pay",le="0.25"} ${15012345 - i * 30211}
http_request_duration_seconds_bucket{route="/pay",le="1"} ${18101877 - i * 43112}
http_request_duration_seconds_bucket{route="/pay",le="+Inf"} ${18243635 - i * 44111}
http_request_duration_seconds_sum{route="/pay"} ${2913022.4 - i * 7012.1}
http_request_duration_seconds_count{route="/pay"} ${18243635 - i * 44111}
# HELP go_goroutines Number of goroutines that currently exist.
# TYPE go_goroutines gauge
go_goroutines ${87 + i * 3}`;
  };
  const OB_RULE = `apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: pay-api-alerts
  namespace: payments
  labels:
    release: kps            # isi label se Prometheus yeh rules uthata hai
spec:
  groups:
  - name: pay-api
    rules:
    - alert: PayApiHighErrorRate
      # symptom alert: kitne % payments 5xx (server error) de rahe hain
      expr: |
        sum(rate(http_requests_total{service="pay-api",status=~"5.."}[5m]))
          /
        sum(rate(http_requests_total{service="pay-api"}[5m])) > 0.05
      for: 30m
      labels:
        severity: page
        team: payments
      annotations:
        summary: pay-api 5xx error rate 5% se upar
`;
  const OB_TEST = `# promtool unit test — kal (23 Nov) ke outage ka data, minute-dar-minute.
# 14:02 se 14:22 tak (minute 2 → 22) har 1000 payments mein se 300 par HTTP 500.
rule_files:
  - /tmp/pay-api.rules.yaml
evaluation_interval: 1m
tests:
  - interval: 1m
    input_series:
      - series: 'http_requests_total{service="pay-api",code="200",route="/pay"}'
        values: '0+1000x2 2700+700x19 17000+1000x18'
      - series: 'http_requests_total{service="pay-api",code="500",route="/pay"}'
        values: '0x2 300+300x19 6000x18'
    alert_rule_test:
      # outage ke beech (14:15) — page aana CHAHIYE tha
      - eval_time: 15m
        alertname: PayApiHighErrorRate
        exp_alerts:
          - exp_labels:
              severity: page
              team: payments
            exp_annotations:
              summary: pay-api 5xx error rate 5% se upar
      # outage ke baad (14:38) — sab theek, koi alert nahi
      - eval_time: 38m
        alertname: PayApiHighErrorRate
        exp_alerts: []
`;
  const OB_SH = `#!/bin/bash
# CI wala check — har PR par chalna chahiye (abhi tak kisi ne CI mein joda hi nahi tha!)
# 1) PrometheusRule se sirf rules (spec) nikaalo   2) kal ke outage ka data replay karo
set -e
yq '.spec' pay-api-alerts.yaml > /tmp/pay-api.rules.yaml
promtool test rules pay-api-alerts.test.yaml`;
  // promtool series notation: "0+1000x2" → 0,1000,2000 ; "6000x3" → 6000 ×4
  function expandSeries(vs) {
    const out = [];
    String(vs).trim().split(/\s+/).forEach(tok => {
      const m = tok.match(/^(-?\d+(?:\.\d+)?)(?:([+-])(\d+(?:\.\d+)?))?x(\d+)$/);
      if (m) { const a = Number(m[1]), b = m[3] ? Number(m[3]) * (m[2] === '-' ? -1 : 1) : 0; for (let j = 0; j <= Number(m[4]); j++) out.push(a + b * j); }
      else if (/^-?\d+(\.\d+)?$/.test(tok)) out.push(Number(tok));
    });
    return out;
  }
  const OB_TESTDOC = KG.yaml.parse(OB_TEST);
  const OB_DATA = OB_TESTDOC.tests[0].input_series.map(x => {
    const sel = pqParse(x.series).sel, labels = {};
    sel.forEach(m => { labels[m.k] = m.v; });
    const vals = expandSeries(x.values);
    return { labels, at: t => vals[Math.max(0, Math.min(vals.length - 1, Math.round(t)))] };
  });
  const OB_DUR_RE = /^(0|(([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?(([0-9]+)ms)?)$/;
  const obDurMin = d => { let t = 0; String(d).replace(/(\d+)(ms|y|w|d|h|m|s)/g, (_, n, u) => { t += Number(n) * { ms: 1 / 60000, y: 525600, w: 10080, d: 1440, h: 60, m: 1, s: 1 / 60 }[u]; }); return t; };
  const obText = s => (s.edited || {})['pay-api-alerts.yaml'] || OB_RULE;
  // rule file → { rule, expr } ya { load: 'promtool load error' }
  function obLoad(text) {
    let d;
    try { d = KG.yaml.parse(text); } catch (e) { return { yq: `Error: bad file 'pay-api-alerts.yaml': ${e.message}` }; }
    const groups = d && d.spec && d.spec.groups;
    if (!Array.isArray(groups)) return { load: `/tmp/pay-api.rules.yaml: yaml: unmarshal errors:\n      spec.groups list nahi hai (ya hai hi nahi)` };
    const g = groups[0] || {}, rules = g.rules || [];
    const ri = rules.findIndex(r => r && r.alert === 'PayApiHighErrorRate');
    const rule = rules[ri];
    if (!rule) return { rule: null };
    const where = `group "${g.name}", rule ${ri + 1}, "${rule.alert}"`;
    if (rule.for != null && (typeof rule.for !== 'string' || !OB_DUR_RE.test(rule.for))) return { load: `/tmp/pay-api.rules.yaml: yaml: unmarshal errors:\n      not a valid duration string: "${rule.for}"` };
    if (typeof rule.expr !== 'string' || !rule.expr.trim()) return { load: `/tmp/pay-api.rules.yaml: ${where}: field 'expr' must be set in rule` };
    let expr;
    try { expr = pqParse(rule.expr); } catch (e) { if (!e.pq) throw e; return { load: `/tmp/pay-api.rules.yaml: ${where}: could not parse expression: ${e.message}` }; }
    return { rule, expr, where };
  }
  // promtool test rules — kal ka outage replay, har minute alert ki state
  function obTest(text) {
    const L = obLoad(text);
    if (L.yq) return { out: L.yq, pass: false };
    const head = 'Unit Testing:  pay-api-alerts.test.yaml\n';
    if (L.load) return { out: head + '  FAILED:\n    ' + L.load, pass: false };
    const tests = OB_TESTDOC.tests[0].alert_rule_test;
    const maxT = Math.max(...tests.map(x => pqMin(x.eval_time)));
    const firingAt = {};
    if (L.rule) {
      const forMin = L.rule.for ? obDurMin(L.rule.for) : 0, active = {};
      for (let t = 0; t <= maxT; t++) {
        let r;
        try { r = pqEval(L.expr, t, OB_DATA); } catch (e) { if (!e.pq) throw e; return { out: head + '  FAILED:\n    ' + `/tmp/pay-api.rules.yaml: ${L.where}: ${e.message}`, pass: false }; }
        if (!r.v) return { out: head + '  FAILED:\n    ' + `/tmp/pay-api.rules.yaml: ${L.where}: invalid alert expression: scalar result (vector chahiye)`, pass: false };
        const now = {};
        r.v.forEach(x => { const k = pqKey(x.l); now[k] = x; if (active[k] == null) active[k] = t; });
        Object.keys(active).forEach(k => { if (!now[k]) delete active[k]; });
        firingAt[t] = Object.keys(now).filter(k => t - active[k] >= forMin).map(k => now[k]);
      }
    }
    const strObj = o => { const r = {}; Object.keys(o || {}).forEach(k => { r[k] = String(o[k]); }); return r; };
    const fails = [];
    tests.forEach(tc => {
      const T = pqMin(tc.eval_time);
      const got = (L.rule && L.rule.alert === tc.alertname ? (firingAt[T] || []) : []).map(x => ({
        labels: Object.assign(noName(x.l), strObj(L.rule.labels), { alertname: L.rule.alert }), ann: strObj(L.rule.annotations) }));
      const exp = (tc.exp_alerts || []).map(e => ({ labels: Object.assign(strObj(e.exp_labels), { alertname: tc.alertname }), ann: strObj(e.exp_annotations) }));
      const sig = a => a.map(x => fmtL(x.labels) + fmtL(x.ann)).sort().join('|');
      if (sig(got) !== sig(exp)) {
        const list = a => a.length ? '[\n' + a.map((x, i) => `            ${i}:\n              Labels:${fmtL(x.labels)}\n              Annotations:${fmtL(x.ann)}`).join('\n') + '\n            ]' : '[]';
        fails.push(`    alertname: ${tc.alertname}, time: ${tc.eval_time}, \n        exp:${list(exp)}, \n        got:${list(got)}`);
      }
    });
    return fails.length ? { out: head + '  FAILED:\n' + fails.join('\n'), pass: false } : { out: head + '  SUCCESS\n', pass: true };
  }
  function obRunTest(s) {
    const c = s.cluster, text = obText(s), r = obTest(text);
    c.tested = true;
    if (r.pass) c.passText = text; else { c.testFailSeen = true; c.passText = null; }
    return r.out;
  }
  const obSpec = text => text.split('\n').slice(text.split('\n').findIndex(l => /^spec:/.test(l)) + 1).map(l => l.replace(/^ {2}/, '')).join('\n');
  const T_OB = [
    { text: 'Alert rule padho (<code>cat pay-api-alerts.yaml</code>)', check: s => ran(s, /^(cat|vi|vim|nano) pay-api-alerts\.yaml$|^kubectl (get|describe) (prometheusrules?|promrules?)\b.*(pay-api-alerts|-o ?yaml)/) },
    { text: 'Kal ka outage replay karo: <code>bash test-alerts.sh</code> — alert fire hua?', check: s => !!s.cluster.testFailSeen },
    { text: '<code>pay-api</code> ke metric ke <b>asli labels</b> dekho — app ka <code>/metrics</code> page ya Prometheus query', check: s => !!s.cluster.sawLabels },
    { text: 'Rule theek karo — <code>bash test-alerts.sh</code> mein <b>SUCCESS</b>', check: s => s.cluster.passText != null && s.cluster.passText === obText(s) },
    { text: 'Test pass hua rule cluster par lagao (<code>kubectl apply -f pay-api-alerts.yaml</code>)', check: s => s.cluster.passText != null && s.cluster.passText === obText(s) && s.cluster.appliedText === obText(s) },
  ];
  addLab('observability', {
    type: 'terminal',
    title: '🖥️ Mission: outage hua, par pager chup raha',
    instructions: 'Kal (23 Nov) 14:02 se 14:22 tak ChaiPay ki pay-api ne har 1000 mein se 300 payments par HTTP 500 diya — ledger database ke connections bhar gaye the. Team ko pata tab chala jab ek merchant ne Twitter par likha. PagerDuty par koi page nahi aaya — jabki alert PayApiHighErrorRate bana hua hai. Yeh rule do mahine pehle notify team ke alert se copy hua tha.',
    goal: `Pata karo alert kyun nahi baja, rule theek karo, aur <b>saboot</b> do ki agli baar bajega: <code>bash test-alerts.sh</code> kal ka outage minute-dar-minute replay karta hai (<code>promtool test rules</code>).
      Rule badalne ke liye: <code>vi pay-api-alerts.yaml</code> → 💾 Save → test → <code>kubectl apply -f pay-api-alerts.yaml</code>.
      Prometheus se poochhne ke liye: <code>promtool query instant http://prometheus:9090 '&lt;PromQL&gt;'</code>.`,
    tasks: T_OB,
    cluster: {
      appliedText: OB_RULE,
      nodes: NODES,
      pods: PAY_API.concat([{ name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '12d', node: 'node-3', ip: '10.0.14.11' }]),
      deployments: [{ name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' }],
    },
    responses: [
      { re: /^kubectl exec (?:-it? |-ti )?(pay-api-\S+?|deploy(?:ment)?\/pay-api)(?: (?:-n|--namespace)[ =]payments)? -- (?:curl|wget)\b.*\/metrics\b.*$/,
        out: (s, m) => {
          const want = String((m && m[1]) || ''), pod = /^deploy/.test(want) ? 'pay-api-6b8d7c-a1' : want;
          if (!s.cluster.pods.some(p => p.name === pod)) return `Error from server (NotFound): pods "${pod}" not found`;
          s.cluster.sawLabels = true;
          return METRICS_PAGE(pod);
        } },
      { re: /^promtool query instant (\S+) (.+)$/,
        out: (s, m) => {
          if (!m || !m[2]) return 'usage: promtool query instant <server> <expr>';
          if (!/prometheus|localhost|127\.0\.0\.1/.test(m[1])) return `Error querying: Post "${m[1]}/api/v1/query": dial tcp: lookup ${m[1].replace(/^https?:\/\//, '').split(/[:/]/)[0]}: no such host`;
          const q = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
          let n, r;
          try { n = pqParse(q); r = pqEval(n, 0, PQ_LIVE); } catch (e) { if (!e.pq) throw e; return `query error: bad_data: invalid parameter "query": ${e.message}`; }
          if (r.s != null) return `scalar: ${fmtNum(r.s)} @[1763974920.000]`;
          if (!r.v.length) return '(khaali jawab — is query se ek bhi series match nahi hui)';
          if (/http_requests_total/.test(q) && r.v.some(x => x.l.code)) s.cluster.sawLabels = true;
          return r.v.map(x => `${x.l.__name__ || ''}${fmtL(noName(x.l))} => ${fmtNum(x.v)} @[1763974920.000]`).join('\n');
        } },
      { re: /^promtool test rules (\S+)$/,
        out: (s, m) => (m && m[1] && m[1].replace(/^\.\//, '') !== 'pay-api-alerts.test.yaml')
          ? `Unit Testing:  ${m[1]}\n  FAILED:\n    open ${m[1]}: no such file or directory`
          : '(rules: /tmp/pay-api.rules.yaml — pay-api-alerts.yaml ka spec, yq se nikala)\n' + obRunTest(s) },
      { re: /^promtool check rules (\S+)$/,
        out: (s, m) => /pay-api-alerts\.yaml$/.test(String(m && m[1]))
          ? `Checking ${m[1]}\n  FAILED:\n${m[1]}: yaml: unmarshal errors:\n  line 1: field apiVersion not found in type rulefmt.RuleGroups\n  line 2: field kind not found in type rulefmt.RuleGroups\n  line 3: field metadata not found in type rulefmt.RuleGroups\n  line 8: field spec not found in type rulefmt.RuleGroups\n(promtool ko Prometheus ka apna format chahiye — PrometheusRule ka sirf "spec" hissa. Isliye test-alerts.sh pehle yq '.spec' chalata hai.)`
          : `Checking ${(m && m[1]) || ''}\n  FAILED:\nopen ${(m && m[1]) || ''}: no such file or directory` },
      { re: /^yq\b.*pay-api-alerts\.yaml.*$/, out: s => { try { KG.yaml.parse(obText(s)); } catch (e) { return `Error: bad file 'pay-api-alerts.yaml': ${e.message}`; } return obSpec(obText(s)); } },
      { re: /^kubectl port-forward\b.*prometheus.*$/, out: 'Forwarding from 127.0.0.1:9090 -> 9090\n(simulator: ab promtool query instant http://localhost:9090 \'<PromQL>\' chalao — yahan prompt wapas mil jaata hai)' },
      { re: rx('kubectl get (?:prometheusrules?|promrules?)(?:[ /]pay-api-alerts)? -o ?yaml'), out: s => s.cluster.appliedText },
      { re: rx('kubectl get (?:prometheusrules?|promrules?)(?:[ /]pay-api-alerts)?'), out: tbl([['NAME', 'AGE'], ['ledger-alerts', '58d'], ['pay-api-alerts', '58d']]) },
      { re: rx('kubectl describe (?:prometheusrules?|promrules?)(?:[ /]pay-api-alerts)?'),
        out: s => 'Name:         pay-api-alerts\nNamespace:    payments\nLabels:       release=kps\nAPI Version:  monitoring.coreos.com/v1\nKind:         PrometheusRule\nSpec:\n' + obSpec(s.cluster.appliedText).split('\n').map(l => '  ' + l).join('\n') + '\nEvents:       <none>' },
    ],
    files: {
      'pay-api-alerts.yaml': {
        editable: true,
        desc: 'PrometheusRule — PayApiHighErrorRate alert (git se) — vi se badlo',
        content: OB_RULE,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {};
          if (d.kind !== 'PrometheusRule') return { err: `error: is file mein PrometheusRule chahiye (kind: ${d.kind || 'khaali'})` };
          if (!d.metadata || d.metadata.name !== 'pay-api-alerts') return { err: '(simulator ne roka) naam badal gaya — naya PrometheusRule banega aur purana (toota) wala bhi chalta rahega. metadata.name wapas pay-api-alerts karo.' };
          const groups = (d.spec || {}).groups;
          const P = 'spec.groups[0].rules[0]';
          const rule = Array.isArray(groups) && groups[0] && (groups[0].rules || [])[0];
          if (!rule) return { err: 'The PrometheusRule "pay-api-alerts" is invalid: spec.groups[0].rules: Required value' };
          const RK = ['alert', 'record', 'expr', 'for', 'keep_firing_for', 'labels', 'annotations'];
          const uk = Object.keys(rule).find(k => !RK.includes(k));
          if (uk) return { err: `Error from server (BadRequest): error when patching "pay-api-alerts.yaml": PrometheusRule in version "v1" cannot be handled as a PrometheusRule: strict decoding error: unknown field "${P}.${uk}"` };
          if (rule.for != null && typeof rule.for !== 'string') return { err: `The PrometheusRule "pay-api-alerts" is invalid: ${P}.for: Invalid value: "${typeof rule.for === 'number' ? 'integer' : typeof rule.for}": ${P}.for in body must be of type string: "${typeof rule.for === 'number' ? 'integer' : typeof rule.for}"` };
          if (rule.for != null && !OB_DUR_RE.test(rule.for)) return { err: `The PrometheusRule "pay-api-alerts" is invalid: ${P}.for: Invalid value: "${rule.for}": ${P}.for in body should match '${OB_DUR_RE.source}'` };
          try { pqParse(String(rule.expr || '')); } catch (e) { if (!e.pq) throw e; return { err: `Error from server: error when patching "pay-api-alerts.yaml": admission webhook "prometheusrulevalidate.monitoring.coreos.com" denied the request: Rules are not valid\n(expr: ${e.message})` }; }
          if (((d.metadata.labels || {}).release) !== 'kps') return { err: '(simulator ne roka) label release: kps hat gaya — Prometheus sirf release=kps wale rules uthata hai. Rule cluster mein hoga par kabhi chalega nahi. Label wapas lagao.' };
          if (text === c.appliedText) return 'prometheusrule.monitoring.coreos.com/pay-api-alerts unchanged';
          c.appliedText = text;
          return 'prometheusrule.monitoring.coreos.com/pay-api-alerts configured\n(Prometheus Operator ~1 minute mein naya rule Prometheus mein load kar dega.)' + (c.passText === text ? '' : '\n(Dhyan do: yeh version abhi test nahi hua — bash test-alerts.sh)');
        },
      },
      'pay-api-alerts.test.yaml': {
        desc: 'promtool unit test — kal ke outage ka data (sirf padhne ke liye)',
        content: OB_TEST,
        apply: () => ({ err: 'error: error validating "pay-api-alerts.test.yaml": error validating data: [apiVersion not set, kind not set]; if you choose to ignore these errors, turn validation off with --validate=false\n(Yeh Kubernetes object nahi — promtool ki test file hai: bash test-alerts.sh)' }),
      },
      'test-alerts.sh': {
        desc: 'CI wala check: yq se rules nikaalo, promtool se kal ka outage replay karo',
        content: OB_SH,
        apply: s => obRunTest(s),
      },
    },
    success: KG.allOf(T_OB),
    successText: `<b>Galti 1 — label ka naam:</b> rule <code>status=~"5.."</code> dhoondhta tha, par pay-api ka metric <code>code="500"</code> likhta hai (notify team ki app <code>status</code> likhti thi).
      Galat label = query <b>khaali</b> = alert kabhi nahi bajta — aur Prometheus koi error nahi deta. Label hamesha app ke <code>/metrics</code> page se milao.<br>
      <b>Galti 2 — <code>for: 30m</code>:</b> expr ko 30 minute lagatar sach rehna tha. Outage 20 minute ka tha — khatam ho gaya, alert "pending" se aage hi nahi badha. Page karne wale alert ke liye 5m jaisa chhota <code>for</code> rakho.<br>
      <b>PULL model:</b> Prometheus har 30s app ka <code>/metrics</code> khud padhta hai, aur <code>job</code>, <code>pod</code>, <code>service</code> jaise labels apni taraf se jodta hai.<br>
      <b>Saboot:</b> <code>promtool test rules</code> ko CI mein daalo — "outage ke beech bajna chahiye" aur "theek hone par chup rehna chahiye", dono test. Bina test ka alert = umeed, saboot nahi.`,
    hints: [
      'cat pay-api-alerts.yaml, phir bash test-alerts.sh — "got:[]" matlab 14:15 par alert fire nahi hua. Ab expr ke label pay-api ke asli metric se milao.',
      'kubectl exec pay-api-6b8d7c-a1 -- curl -s localhost:8080/metrics — http_requests_total ke labels mein "status" hai ya "code"? (Ya: promtool query instant http://prometheus:9090 \'http_requests_total{service="pay-api"}\')',
      'vi pay-api-alerts.yaml — status=~"5.." ko code=~"5.." karo. Outage 20 minute ka tha, toh "for: 30m" bhi chhota karo (jaise 5m). Save, bash test-alerts.sh (SUCCESS?), phir kubectl apply -f pay-api-alerts.yaml.',
    ],
    solution: ['cat pay-api-alerts.yaml', 'bash test-alerts.sh', 'kubectl exec pay-api-6b8d7c-a1 -- curl -s localhost:8080/metrics',
      { edit: 'pay-api-alerts.yaml', change: [['status=~"5.."', 'code=~"5.."'], ['for: 30m', 'for: 5m']] }, 'bash test-alerts.sh', 'kubectl apply -f pay-api-alerts.yaml'],
  }, {
    objectives: ['🖥️ <b>Mission:</b> outage mein alert kyun nahi baja? Label aur <code>for</code> theek karo, aur <code>promtool test rules</code> se saboot do'],
    success: ['Main khaali-query wala alert pakad sakta hoon aur alert rule ko promtool unit test se jaanch sakta hoon'],
    cards: [
      { front: 'Alert rule ka expr galat label (<code>status</code>) dhoondhta hai, metric mein <code>code</code> hai — kya hota hai?', back: 'Query <b>khaali</b> lautati hai → alert <b>kabhi nahi bajta</b> — koi error bhi nahi. Label app ke <code>/metrics</code> page se milao, aur rule ka <code>promtool test rules</code> likho.' },
      { front: '<code>for: 30m</code> wala alert, outage 20 minute ka — kya hoga?', back: 'Alert <b>pending</b> mein hi reh jaata hai, fire nahi hota. <code>for</code> = expr kitni der lagatar sach rahe. Page wale alerts ke liye chhota (jaise 5m).' },
    ],
  });

  /* =====================================================================
     🧰 helm (Helm & Kustomize) — Kustomize overlay ka "images:" naam
     image se match nahi hota → prod chupchaap 1.8.0 par. Chhota kustomize:
     resources → patches → namespace → replicas → images (IsImageMatched)
     ===================================================================== */
  const KZ_REPO = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api';
  const KZ_TAGS = ['1.7.2', '1.8.0', '1.9.0'];   // ECR mein yahi tags hain
  const KZ_FILES = {
    'base/kustomization.yaml': `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
`,
    'base/deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pay-api
  labels:
    app: pay-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pay-api
  template:
    metadata:
      labels:
        app: pay-api
    spec:
      containers:
      - name: pay-api
        image: ${KZ_REPO}:1.8.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
`,
    'base/service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: pay-api
  labels:
    app: pay-api
spec:
  selector:
    app: pay-api
  ports:
  - port: 80
    targetPort: 8080
`,
    'overlays/staging/kustomization.yaml': `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: payments-staging
resources:
- ../../base
images:
- name: ${KZ_REPO}
  newTag: "1.9.0"
`,
    'overlays/prod/kustomization.yaml': `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: payments
resources:
- ../../base
patches:
- path: replicas-patch.yaml
images:
- name: pay-api            # Meena ka PR #511: prod ko 1.9.0 par le jao
  newTag: "1.9.0"
`,
    'overlays/prod/replicas-patch.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pay-api
spec:
  replicas: 3
`,
  };
  const KZ_KEYS = ['apiVersion', 'kind', 'resources', 'namespace', 'namePrefix', 'nameSuffix', 'images', 'patches', 'patchesStrategicMerge', 'replicas',
    'labels', 'commonLabels', 'commonAnnotations', 'configMapGenerator', 'secretGenerator', 'generatorOptions', 'components'];
  const KZ_ORDER = ['Namespace', 'ServiceAccount', 'Role', 'RoleBinding', 'ConfigMap', 'Secret', 'Service', 'PersistentVolumeClaim', 'Deployment', 'StatefulSet', 'CronJob'];
  const kzRead = (s, p) => (s.edited || {})[p] != null ? s.edited[p] : KZ_FILES[p];
  const kzNorm = p => { const out = []; p.split('/').forEach(x => { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); }); return out.join('/'); };
  const kzClone = o => JSON.parse(JSON.stringify(o));
  // strategic merge (chhota): map → gehra merge; containers → name se merge; baaki list → poori badlo
  function kzMerge(a, b) {
    if (Array.isArray(b)) {
      if (Array.isArray(a) && b.every(x => x && x.name) && a.every(x => x && x.name))
        return a.map(x => { const y = b.find(z => z.name === x.name); return y ? kzMerge(x, y) : x; }).concat(b.filter(y => !a.some(x => x.name === y.name)));
      return kzClone(b);
    }
    if (b && typeof b === 'object') {
      const out = a && typeof a === 'object' && !Array.isArray(a) ? kzClone(a) : {};
      Object.keys(b).forEach(k => { out[k] = b[k] === null ? undefined : kzMerge(out[k], b[k]); if (out[k] === undefined) delete out[k]; });
      return out;
    }
    return b;
  }
  const kzMatch = (img, name) => { try { return new RegExp('^' + name.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '(@sha256)?(:[a-zA-Z0-9_.{}-]*)?$').test(img); } catch (e) { return false; } };
  // kustomize build <dir> → { docs, warn } ya { err }
  function kzBuild(s, dir, depth) {
    dir = kzNorm(dir);
    const kt = kzRead(s, dir + '/kustomization.yaml');
    if (kt == null) return { err: `unable to find one of 'kustomization.yaml', 'kustomization.yml' or 'Kustomization' in directory '/home/ravi/chaipay-deploy/${dir}'` };
    let k;
    try { k = KG.yaml.parse(kt); } catch (e) { return { err: `invalid Kustomization: error converting YAML to JSON: ${e.message}` }; }
    k = k || {};
    const uk = Object.keys(k).find(x => !KZ_KEYS.includes(x));
    if (uk) return { err: `invalid Kustomization: json: unknown field "${uk}"` + (/^image$/.test(uk) ? '\n(field ka naam "images" hai — aakhir mein s)' : '') };
    if (k.images != null && !Array.isArray(k.images)) return { err: 'invalid Kustomization: json: cannot unmarshal object into Go struct field Kustomization.images of type []types.Image' };
    for (const im of k.images || []) {
      for (const f of ['name', 'newName', 'newTag', 'digest']) if (im && im[f] != null && typeof im[f] !== 'string') return { err: `invalid Kustomization: json: cannot unmarshal ${typeof im[f] === 'number' ? 'number' : 'bool'} into Go struct field Image.images.${f} of type string` + (f === 'newTag' ? `\n(YAML ne ${im[f]} ko number bana diya — tag quotes mein likho: newTag: "${im[f]}")` : '') };
      const ik = Object.keys(im || {}).find(x => !['name', 'newName', 'newTag', 'digest', 'tagSuffix'].includes(x));
      if (ik) return { err: `invalid Kustomization: json: unknown field "${ik}"` };
    }
    let docs = [], warn = [];
    for (const r of k.resources || []) {
      const p = kzNorm(dir + '/' + r);
      if (/\.ya?ml$/.test(r)) {
        const t = kzRead(s, p);
        if (t == null) return { err: `accumulating resources: accumulation err='accumulating resources from '${r}': open /home/ravi/chaipay-deploy/${p}: no such file or directory'` };
        docs = docs.concat(KG.yaml.parseAll(t).filter(Boolean));
      } else {
        if ((depth || 0) > 4) return { err: 'cycle in resources' };
        const sub = kzBuild(s, p, (depth || 0) + 1);
        if (sub.err) return { err: sub.err.startsWith('unable to find') ? `accumulating resources: accumulation err='accumulating resources from '${r}': ${sub.err}'` : sub.err };
        docs = docs.concat(sub.docs); warn = warn.concat(sub.warn);
      }
    }
    const pl = (k.patches || []).map(x => x && x.path).filter(Boolean).concat(k.patchesStrategicMerge || []);
    if (k.patchesStrategicMerge) warn.push("# Warning: 'patchesStrategicMerge' is deprecated. Please use 'patches' instead. Run 'kustomize edit fix' to update your Kustomization automatically.");
    for (const pp of pl) {
      const t = kzRead(s, kzNorm(dir + '/' + pp));
      if (t == null) return { err: `trouble configuring builtin PatchTransformer with config: \`\npath: ${pp}\n\`: failed to get the patch file from path(${pp}): evalsymlink failure on '/home/ravi/chaipay-deploy/${kzNorm(dir + '/' + pp)}' : lstat /home/ravi/chaipay-deploy/${kzNorm(dir + '/' + pp)}: no such file or directory` };
      const pd = KG.yaml.parse(t) || {}, nm = (pd.metadata || {}).name;
      const id = `${pd.kind}.${String(pd.apiVersion || 'v1').split('/').reverse().join('.')}/${nm}.[noNs]`;
      const i = docs.findIndex(d => d.kind === pd.kind && (d.metadata || {}).name === nm);
      if (i < 0) return { err: `no resource matches strategic merge patch "${id}": no matches for Id ${id}; failed to find unique target for patch ${id}` };
      docs[i] = kzMerge(docs[i], pd);
    }
    docs = docs.map(d => {
      d = kzClone(d);
      d.metadata = d.metadata || {};
      if (k.namespace) d.metadata.namespace = k.namespace;
      if (k.namePrefix || k.nameSuffix) d.metadata.name = (k.namePrefix || '') + d.metadata.name + (k.nameSuffix || '');
      // commonLabels: metadata + selector + template sab mein; labels: sirf metadata (includeSelectors ho toh selector bhi)
      const all = Object.assign({}, k.commonLabels || {}), sel = Object.assign({}, k.commonLabels || {}), tpl = Object.assign({}, k.commonLabels || {});
      (Array.isArray(k.labels) ? k.labels : []).forEach(L => { Object.assign(all, (L && L.pairs) || {}); if (L && L.includeSelectors) { Object.assign(sel, L.pairs || {}); Object.assign(tpl, L.pairs || {}); } else if (L && L.includeTemplates) Object.assign(tpl, L.pairs || {}); });
      if (Object.keys(all).length) {
        d.metadata.labels = Object.assign({}, d.metadata.labels || {}, all);
        if (d.kind === 'Deployment' && d.spec) {
          d.spec.selector = { matchLabels: Object.assign({}, (d.spec.selector || {}).matchLabels || {}, sel) };
          d.spec.template.metadata = Object.assign({}, d.spec.template.metadata || {}, { labels: Object.assign({}, (d.spec.template.metadata || {}).labels || {}, tpl) });
        }
        if (d.kind === 'Service' && d.spec) d.spec.selector = Object.assign({}, d.spec.selector || {}, sel);
      }
      (k.replicas || []).forEach(r => { if (d.kind === 'Deployment' && r && r.name === d.metadata.name) d.spec.replicas = r.count; });
      const ps = d.spec && d.spec.template && d.spec.template.spec;
      if (ps) ['containers', 'initContainers'].forEach(f => (ps[f] || []).forEach(ctr => {
        const im = (k.images || []).find(x => x && x.name && kzMatch(String(ctr.image), x.name));
        if (!im) return;
        const base = String(ctr.image).replace(/(@sha256:[a-f0-9]+|:[a-zA-Z0-9_.{}-]*)$/, ''), tag = (String(ctr.image).match(/:([a-zA-Z0-9_.{}-]*)$/) || [])[1];
        ctr.image = (im.newName || base) + (im.digest ? '@' + im.digest : im.newTag ? ':' + im.newTag : tag ? ':' + tag : '');
      }));
      return d;
    });
    return { docs, warn };
  }
  // kustomize jaisa YAML: apiVersion/kind/metadata upar, baaki keys A→Z
  function kzDump(v, ind) {
    ind = ind || '';
    const sc = x => typeof x === 'string'
      ? (x === '' || /^(true|false|yes|no|on|off|null|~|[-+]?[0-9.]+([eE][-+]?\d+)?)$/i.test(x) || /^[\s&*!|>'"%@`{[\]#,-]|: |\s#|\s$/.test(x) ? JSON.stringify(x) : x)
      : String(x);
    const keys = o => { const ks = Object.keys(o).sort(); return ['apiVersion', 'kind', 'metadata'].filter(k => ks.includes(k)).concat(ks.filter(k => !['apiVersion', 'kind', 'metadata'].includes(k))); };
    if (Array.isArray(v)) return v.map(x => {
      if (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length) { const t = kzDump(x, ind + '  ').replace(/^\s+/, ''); return ind + '- ' + t; }
      return ind + '- ' + (x && typeof x === 'object' ? (Array.isArray(x) ? '[]' : '{}') : sc(x));
    }).join('\n');
    return keys(v).map(k => {
      const x = v[k];
      if (x && typeof x === 'object' && (Array.isArray(x) ? x.length : Object.keys(x).length))
        return ind + k + ':\n' + kzDump(x, Array.isArray(x) ? ind : ind + '  ');
      return ind + k + ': ' + (x && typeof x === 'object' ? (Array.isArray(x) ? '[]' : '{}') : sc(x));
    }).join('\n');
  }
  const kzSort = docs => docs.slice().sort((a, b) => (KZ_ORDER.indexOf(a.kind) + 1 || 99) - (KZ_ORDER.indexOf(b.kind) + 1 || 99));
  const kzRender = docs => kzSort(docs).map(d => kzDump(d)).join('\n---\n');
  const kzDeploy = docs => docs.find(d => d.kind === 'Deployment') || {};
  const kzImg = d => ((((d.spec || {}).template || {}).spec || {}).containers || [{}])[0].image;
  const KZ_RS = ['9d4c7b', '5e8f2a', '7b3d1e', '4c9a6f', '8e2b5d', '3f7c1a'];
  const kzPodDesc = (p, img) => `Name:             ${p.name}
Namespace:        payments
Node:             ${p.node}/10.0.1${2 + NODES.findIndex(n => n.name === p.node)}.5
Labels:           app=pay-api
                  pod-template-hash=${p.name.split('-')[2]}
Status:           ${p.status === 'Running' ? 'Running' : 'Pending'}
Controlled By:    ReplicaSet/pay-api-${p.name.split('-')[2]}
Containers:
  pay-api:
    Image:          ${img}
` + (p.status === 'Running' ? `    State:          Running
    Ready:          True
Events:
  Type    Reason   Age   From     Message
  ----    ------   ----  ----     -------
  Normal  Pulled   ${p.age}    kubelet  Successfully pulled image "${img}"
  Normal  Started  ${p.age}    kubelet  Started container pay-api` : `    State:          Waiting
      Reason:       ImagePullBackOff
    Ready:          False
Events:
  Type     Reason   Age   From     Message
  ----     ------   ----  ----     -------
  Normal   Pulling  20s   kubelet  Pulling image "${img}"
  Warning  Failed   19s   kubelet  Failed to pull image "${img}": rpc error: code = NotFound desc = failed to pull and unpack image "${img}": failed to resolve reference "${img}": ${img}: not found
  Warning  Failed   19s   kubelet  Error: ErrImagePull
  Normal   BackOff  6s    kubelet  Back-off pulling image "${img}"
  Warning  Failed   6s    kubelet  Error: ImagePullBackOff`);
  const kzDeployDesc = c => `Name:                   pay-api
Namespace:              payments
Labels:                 app=pay-api
Selector:               app=pay-api
Replicas:               ${c.live.replicas} desired | ${c.pods.filter(p => p.rs === c.live.hash).length} updated | ${c.pods.length} total | ${c.pods.filter(p => p.status === 'Running').length} available | ${c.pods.filter(p => p.status !== 'Running').length} unavailable
StrategyType:           RollingUpdate
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=pay-api
  Containers:
   pay-api:
    Image:      ${c.live.image}
    Port:       8080/TCP
    Requests:
      cpu:      250m
      memory:   256Mi
NewReplicaSet:   pay-api-${c.live.hash} (${c.pods.filter(p => p.rs === c.live.hash).length}/${c.live.replicas} replicas created)`;
  // Deployment ka naya template: image badla → naya ReplicaSet; tag ECR mein nahi → ek naya pod ImagePullBackOff, rollout atka
  function kzSetLive(c, img, n) {
    const L = c.live, imgChanged = img !== L.image;
    if (imgChanged) {
      c.rsN = (c.rsN || 0) + 1;
      L.hash = KZ_RS[(c.rsN - 1) % KZ_RS.length];
      L.image = img;
      const ok = KZ_TAGS.includes(img.split(':').pop()) && img.startsWith(KZ_REPO + ':');
      const mk = (i, status) => {
        const p = { name: `pay-api-${L.hash}-${['q1', 'w2', 'e3', 'r4', 't5', 'y6'][i]}`, ready: status === 'Running' ? '1/1' : '0/1', status, restarts: 0, age: '6s', node: NODES[i % 3].name, rs: L.hash, img };
        p.describe = kzPodDesc(p, img); return p;
      };
      if (ok) c.pods = Array.from({ length: n }, (_, i) => mk(i, 'Running'));
      else c.pods = c.pods.filter(p => p.status === 'Running' && p.rs !== L.hash).concat([mk(0, 'ImagePullBackOff')]);
    } else if (n !== L.replicas) {
      const good = c.pods.filter(p => p.rs === L.hash && p.status === 'Running');
      while (good.length < n) { const i = good.length; const p = { name: `pay-api-${L.hash}-${['q1', 'w2', 'e3', 'r4', 't5', 'y6'][i]}`, ready: '1/1', status: 'Running', restarts: 0, age: '6s', node: NODES[i % 3].name, rs: L.hash, img }; p.describe = kzPodDesc(p, img); good.push(p); }
      c.pods = good.slice(0, n);
    }
    L.replicas = n;
    const run = c.pods.filter(p => p.status === 'Running').length;
    Object.assign(c.deployments[0], { ready: Math.min(run, n) + '/' + n, upToDate: c.pods.filter(p => p.rs === L.hash).length, available: Math.min(run, n), describe: kzDeployDesc(c) });
  }
  const IMG190 = KZ_REPO + ':1.9.0';
  const kzProdImg = s => { const b = kzBuild(s, 'overlays/prod'); return b.err ? null : kzImg(kzDeploy(b.docs)); };
  const kzRolled = c => c.pods.length === c.live.replicas && c.pods.every(p => p.rs === c.live.hash && p.status === 'Running');
  const kzDirArg = cmd => (String(cmd).match(/(?:-k|--kustomize)[ =](\S+)|(?:kustomize|build) (\S+)/) || []).slice(1).find(Boolean);
  const T_KZ = [
    { text: 'Prod mein abhi kaunsa image chal raha hai? (<code>kubectl get deploy pay-api -o wide</code>)', check: s => ran(s, /^kubectl (get (deploy|deployments?)\b.*-o ?wide|describe (deploy|deployments?)\b)/) },
    { text: 'Prod overlay render karke dekho (<code>kubectl kustomize overlays/prod</code>) — image kya ban raha hai?', check: s => !!s.cluster.renderedProd },
    { text: 'Staging overlay (jo sahi chala) prod se milao (<code>cat overlays/staging/kustomization.yaml</code>)', check: s => ran(s, /^(cat|vi|vim|nano) overlays\/staging\/kustomization\.yaml$/) || !!s.cluster.renderedStaging },
    { text: 'Prod overlay theek karo — render mein <code>pay-api:1.9.0</code> aaye', check: s => kzProdImg(s) === IMG190 },
    { text: 'Cluster par lagao: <code>kubectl apply -k overlays/prod</code>', check: s => s.cluster.live.image === IMG190 && s.cluster.lastK === IMG190 && kzProdImg(s) === IMG190 },
    { text: '<code>kubectl rollout status deployment/pay-api</code> — rollout poora?', check: s => s.cluster.live.image === IMG190 && s.cluster.lastK === IMG190 && kzRolled(s.cluster) && ranAfter(s, s.cluster.kAt, /^kubectl rollout status (deploy(ment)?)[ \/]pay-api\b/) },
  ];
  const kzOut = (s, dir, tool) => {
    const b = kzBuild(s, dir);
    if (b.err) return (tool === 'kubectl' ? 'error: ' : 'Error: ') + b.err;
    if (dir === 'overlays/prod') s.cluster.renderedProd = true;
    if (dir === 'overlays/staging') s.cluster.renderedStaging = true;
    return (b.warn.length ? b.warn.join('\n') + '\n' : '') + kzRender(b.docs);
  };
  addLab('helm', {
    type: 'terminal',
    title: '🖥️ Mission: PR merge hua, CI hara, par prod purane version par',
    instructions: 'ChaiPay ke manifests Kustomize mein hain: ek base, aur har environment ka overlay (staging, prod). Meena ne PR #511 merge kiya: "prod ko pay-api 1.9.0 par le jao" (UPI Lite ka zaroori fix). CI ne kubectl apply -k overlays/prod chalaya aur hara ho gaya — par output tha "deployment.apps/pay-api unchanged". Staging kal se 1.9.0 par hai. Prod abhi bhi 1.8.0 par. Yeh terminal prod cluster (chaipay-prod) se juda hai; repo ki files ls se dikhti hain.',
    goal: `Prod ko <b>pay-api 1.9.0</b> par lao — <b>Kustomize overlay theek karke</b>, taaki git aur cluster ek hi baat bolein.
      Pehle dekho overlay sach mein kya banata hai: <code>kubectl kustomize overlays/prod</code>. Fix: <code>vi overlays/prod/kustomization.yaml</code> → 💾 Save → <code>kubectl apply -k overlays/prod</code>.`,
    tasks: T_KZ,
    cluster: {
      nodes: NODES, live: { image: KZ_REPO + ':1.8.0', replicas: 3, hash: '6b8d7c' }, rsN: 0, lastK: null,
      pods: ['a1', 'b2', 'c3'].map((x, i) => { const p = { name: 'pay-api-6b8d7c-' + x, ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: NODES[i].name, rs: '6b8d7c' }; p.describe = kzPodDesc(p, KZ_REPO + ':1.8.0'); return p; }),
      deployments: [{ name: 'pay-api', ready: '3/3', upToDate: 3, available: 3, age: '40d' }],
      services: [{ name: 'pay-api', type: 'ClusterIP', clusterIP: '10.100.41.7', ports: '80/TCP', age: '40d' }],
    },
    responses: [
      { re: /^kubectl kustomize(?: (\S+))?$/, out: (s, m) => kzOut(s, String((m && m[1]) || '.').replace(/\/$/, ''), 'kubectl') },
      { re: /^kustomize build(?: (\S+))?$/, out: (s, m) => kzOut(s, String((m && m[1]) || '.').replace(/\/$/, ''), 'kustomize') },
      { re: /^kubectl apply (?:-k|--kustomize)[ =](\S+?)\/?(?: (?:-n|--namespace)[ =]payments)?$/,
        out: (s, m) => {
          const c = s.cluster, dir = kzNorm(String((m && m[1]) || ''));
          const b = kzBuild(s, dir);
          if (b.err) return 'error: ' + b.err;
          const d = kzDeploy(b.docs), ns = (d.metadata || {}).namespace;
          if (ns !== 'payments') return `Error from server (NotFound): error when creating "${dir}": namespaces "${ns || 'default'}" not found\n(Yeh prod cluster hai — ${dir} kisi aur environment ka overlay hai.)`;
          if ((d.metadata || {}).name !== 'pay-api') return `(simulator ne roka) Deployment ka naam "${d.metadata.name}" ban raha hai — prod mein ek NAYA Deployment banta aur pay-api waisa hi rehta. namePrefix/nameSuffix hatao.`;
          const sel = ((d.spec || {}).selector || {}).matchLabels || {};
          if (JSON.stringify(sel) !== JSON.stringify({ app: 'pay-api' })) return `The Deployment "pay-api" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{${Object.keys(sel).map(k => `"${k}":"${sel[k]}"`).join(', ')}}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable\n(commonLabels selector mein bhi label jodta hai — Deployment ka selector badal nahi sakta. "labels:" use karo ya hatao.)`;
          const img = kzImg(d), n = (d.spec || {}).replicas;
          if (n !== 3) return `(simulator ne roka) overlay ab prod ko replicas: ${n} de raha hai (3 nahi) — replicas-patch.yaml ka patch hat gaya? Prod ko 3 pods chahiye. Sirf images: theek karo.`;
          const changed = img !== c.live.image || n !== c.live.replicas, wasImp = c.imperative ? c.live.image : null;
          kzSetLive(c, img, n);
          c.lastK = img; c.kAt = s.history.length;
          const note = wasImp && wasImp !== img ? `\n(Dhyan do: kubectl set image wala ${wasImp.split(':').pop()} hat gaya — overlay ${img.split(':').pop()} banata hai, toh cluster wapas usi par aa gaya. Git jo bolta hai, wahi jeet-ta hai.)` : '';
          c.imperative = false;
          return (b.warn.length ? b.warn.join('\n') + '\n' : '') + `service/pay-api unchanged\ndeployment.apps/pay-api ${changed ? 'configured' : 'unchanged'}` + note;
        } },
      { re: /^kubectl diff (?:-k|--kustomize)[ =](\S+?)\/?$/,
        out: (s, m) => {
          const c = s.cluster, dir = kzNorm(String((m && m[1]) || '')), b = kzBuild(s, dir);
          if (b.err) return 'error: ' + b.err;
          const d = kzDeploy(b.docs), img = kzImg(d), n = (d.spec || {}).replicas;
          if ((d.metadata || {}).namespace !== 'payments') return `Error from server (NotFound): namespaces "${(d.metadata || {}).namespace}" not found`;
          if (img === c.live.image && n === c.live.replicas) return '(kuch nahi chhapa = cluster aur overlay mein koi farak nahi. Overlay jo banata hai, wahi pehle se chal raha hai.)';
          const P = 'apps.v1.Deployment.payments.pay-api';
          return `diff -u -N /tmp/LIVE-2215417836/${P} /tmp/MERGED-1093762771/${P}\n--- /tmp/LIVE-2215417836/${P}\t2026-11-24 10:31:07.402117 +0530\n+++ /tmp/MERGED-1093762771/${P}\t2026-11-24 10:31:07.418204 +0530\n` +
            (n !== c.live.replicas ? `@@ -12,7 +12,7 @@\n spec:\n   progressDeadlineSeconds: 600\n-  replicas: ${c.live.replicas}\n+  replicas: ${n}\n   revisionHistoryLimit: 10\n` : '') +
            (img !== c.live.image ? `@@ -31,7 +31,7 @@\n     spec:\n       containers:\n-      - image: ${c.live.image}\n+      - image: ${img}\n         imagePullPolicy: IfNotPresent\n         name: pay-api` : '');
        } },
      { re: rx('kubectl get (?:deploy(?:ment)?s?)(?:[ /]pay-api)? (?:-o ?wide|-owide|--output=wide)'),
        out: s => tbl([['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE', 'CONTAINERS', 'IMAGES', 'SELECTOR'], ['pay-api', s.cluster.deployments[0].ready, s.cluster.deployments[0].upToDate, s.cluster.deployments[0].available, '40d', 'pay-api', s.cluster.live.image, 'app=pay-api']]) },
      { re: rx('kubectl describe (?:deploy(?:ment)?s?)(?:[ /]pay-api)?'), out: s => kzDeployDesc(s.cluster) },
      { re: /^kubectl set image (?:deploy(?:ment)?)[ /]pay-api (?:pay-api|\*)=(\S+?)(?: (?:-n|--namespace)[ =]payments)?$/,
        out: (s, m) => {
          const c = s.cluster, img = String((m && m[1]) || '');
          if (!img) return 'error: there is no need to specify a resource type as a separate argument when passing arguments in resource/name form';
          kzSetLive(c, img, c.live.replicas); c.imperative = true;
          return `deployment.apps/pay-api image updated\n(Cluster badal gaya — par overlays/prod abhi bhi ${(kzProdImg(s) || '?').split(':').pop()} banata hai. Agla CI deploy (kubectl apply -k overlays/prod) cluster ko wapas wahi kar dega. Overlay theek karo.)`;
        } },
      { re: rx('kubectl rollout status (?:deploy(?:ment)?)[ /]pay-api'),
        out: s => {
          const c = s.cluster, upd = c.pods.filter(p => p.rs === c.live.hash);
          if (kzRolled(c)) return `deployment "pay-api" successfully rolled out`;
          return `Waiting for deployment "pay-api" rollout to finish: ${upd.length} out of ${c.live.replicas} new replicas have been updated...\n(simulator: rollout atka hai — naya pod ${upd.find(p => p.status !== 'Running') ? upd.find(p => p.status !== 'Running').name + ' ' + upd.find(p => p.status !== 'Running').status + ' mein hai. kubectl describe pod se dekho.' : 'abhi bana nahi'})`;
        } },
      { re: /^ls(?: -l| -la)? (?!-)(\S+?)\/?$/,
        out: (s, m) => {
          const dir = kzNorm(String((m && m[1]) || '')), names = new Set();
          Object.keys(KZ_FILES).forEach(f => { if (f.startsWith(dir + '/')) names.add(f.slice(dir.length + 1).split('/')[0] + (f.slice(dir.length + 1).includes('/') ? '/' : '')); });
          return names.size ? [...names].join('  ') : `ls: cannot access '${(m && m[1]) || ''}': No such file or directory`;
        } },
      { re: /^git log\b.*$/, out: 'a91c3e2 (HEAD -> main, origin/main) prod: pay-api 1.9.0 — UPI Lite fix (#511) — Meena\n6f2d8b1 staging: pay-api 1.9.0 (#507) — Ravi\n3c7e9a4 prod: replicas 3 (#498) — Amit' },
      { re: /^git (?:show|diff)\b.*$/,
        out: 'commit a91c3e2 — prod: pay-api 1.9.0 — UPI Lite fix (#511)\n--- a/overlays/prod/kustomization.yaml\n+++ b/overlays/prod/kustomization.yaml\n@@ -6,3 +6,6 @@ resources:\n patches:\n - path: replicas-patch.yaml\n+images:\n+- name: pay-api            # Meena ka PR #511: prod ko 1.9.0 par le jao\n+  newTag: "1.9.0"' },
    ],
    files: Object.assign({}, ...Object.keys(KZ_FILES).map(f => ({
      [f]: {
        editable: f === 'overlays/prod/kustomization.yaml',
        desc: f === 'overlays/prod/kustomization.yaml' ? 'prod overlay — vi se badlo' : f.startsWith('base/') ? 'base (staging + prod dono ka) — sirf padhne ke liye' : f.includes('staging') ? 'staging overlay — 1.9.0 yahan sahi chala' : 'prod: replicas 3 ka patch',
        content: KZ_FILES[f],
        saveTip: f === 'overlays/prod/kustomization.yaml' ? 'Pehle render dekho: kubectl kustomize overlays/prod — phir lagao: kubectl apply -k overlays/prod' : undefined,
        apply: () => (/kustomization\.yaml$/.test(f)
          ? { err: `error: resource mapping not found for name: "" namespace: "" from "${f}": no matches for kind "Kustomization" in version "kustomize.config.k8s.io/v1beta1"\nensure CRDs are installed first\n(Kustomization koi cluster object nahi — folder ko -k se lagao: kubectl apply -k ${f.replace(/\/kustomization\.yaml$/, '')})` }
          : { err: `(simulator ne roka) ${f} akela lagane se namespace / patch / image nahi lagte — poora overlay lagao: kubectl apply -k overlays/prod` }),
      },
    }))),
    success: KG.allOf(T_KZ),
    successText: `<b>Asli wajah:</b> Kustomize ka <code>images:</code> naam <b>poore image naam</b> se milta hai (tag ke bina): <code>${KZ_REPO}</code>.
      Overlay mein sirf <code>pay-api</code> likha tha — kisi container se match nahi hua, toh Kustomize ne <b>chupchaap kuch nahi badla</b>. Koi error nahi, CI hara, aur apply ne "unchanged" bola.<br>
      <b>Pakadne ka tareeka:</b> deploy se pehle <code>kubectl kustomize overlays/prod | grep image</code> ya <code>kubectl diff -k overlays/prod</code>. Khaali diff = "kuch badlega hi nahi" — PR ke hisaab se yeh galat tha.<br>
      <b>Helm vs Kustomize:</b> Kustomize template nahi likhta — base YAML par patch lagata hai (namespace, replicas, image). Helm values + templates se YAML banata hai. Dono mein "render karke dekho" pehla kadam hai (<code>helm template</code> / <code>kubectl kustomize</code>).<br>
      <b>kubectl set image</b> bhi chalta, par git ka overlay 1.8.0 hi bolta — agla CI deploy prod ko wapas 1.8.0 kar deta.`,
    hints: [
      'kubectl get deploy pay-api -o wide — IMAGES column. Phir kubectl kustomize overlays/prod — rendered Deployment mein image kya hai?',
      'cat overlays/staging/kustomization.yaml aur cat overlays/prod/kustomization.yaml — dono ke images: name milao. Kustomize ka name, container ke image ke naam (tag ke bina) se poora milna chahiye.',
      'vi overlays/prod/kustomization.yaml — "- name: pay-api" ko "- name: 111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api" karo, Save. kubectl kustomize overlays/prod se dekho, phir kubectl apply -k overlays/prod aur kubectl rollout status deployment/pay-api.',
    ],
    solution: ['kubectl get deploy pay-api -o wide', 'kubectl kustomize overlays/prod', 'cat overlays/staging/kustomization.yaml',
      { edit: 'overlays/prod/kustomization.yaml', change: [['- name: pay-api            # Meena', `- name: ${KZ_REPO}   # Meena`]] },
      'kubectl kustomize overlays/prod', 'kubectl apply -k overlays/prod', 'kubectl rollout status deployment/pay-api'],
  }, {
    objectives: ['🖥️ <b>Mission:</b> Kustomize overlay ne chupchaap image nahi badla — render karke (kubectl kustomize / diff -k) galti pakdo aur overlay theek karo'],
    success: ['Main Kustomize overlay ko render karke jaanch sakta hoon, aur jaanta hoon ki images: ka naam poore image naam se milna chahiye'],
    cards: [
      { front: 'Kustomize <code>images: - name: pay-api</code>, container image <code>…ecr…/pay-api:1.8.0</code> — kya hoga?', back: '<b>Kuch nahi.</b> <code>name</code> poore image naam (tag ke bina) se milna chahiye: <code>111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api</code>. Match na ho toh Kustomize chupchaap chhod deta hai — koi error nahi.' },
      { front: 'PR ne version badla, par <code>kubectl apply -k</code> ne "unchanged" bola — pehle kya chalao?', back: '<code>kubectl kustomize &lt;overlay&gt; | grep image</code> ya <code>kubectl diff -k &lt;overlay&gt;</code>. Khaali diff = overlay kuch badal hi nahi raha.' },
    ],
  });

  /* =====================================================================
     🧩 helmtemplating — notify chart: range ke andar ".Values" (nil pointer)
     aur "indent" jahan "nindent" chahiye (YAML error). Asli Go-template
     engine (gotpl.js) se render; helm template / lint / upgrade.
     ===================================================================== */
  const HT_IMG = '111122223333.dkr.ecr.ap-south-1.amazonaws.com/notify';
  const HT_DEP = 'notify/templates/deployment.yaml';
  const HT_FILES = {
    'notify/Chart.yaml': `apiVersion: v2
name: notify
description: ChaiPay notify — SMS / email bhejne wali service
type: application
version: 0.7.0
appVersion: "2.4.0"
`,
    'notify/values.yaml': `# notify — SMS / email bhejne wali service (ChaiPay)
replicaCount: 2

image:
  repository: ${HT_IMG}
  tag: "2.4.0"

# 2.4.0 se har channel ka apna worker container (Priya, PR #530)
channels:
  - name: sms
    concurrency: 20
  - name: email
    concurrency: 5

resources:
  requests:
    cpu: 100m
    memory: 128Mi

service:
  port: 8080
`,
    'notify/templates/_helpers.tpl': `{{/* Release ke naam se chart ka poora naam (63 akshar tak) */}}
{{- define "notify.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "notify.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}
`,
    [HT_DEP]: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "notify.fullname" . }}
  labels:
    {{- include "notify.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ include "notify.fullname" . }}
  template:
    metadata:
      labels:
        app: {{ include "notify.fullname" . }}
    spec:
      containers:
      {{- range .Values.channels }}
      # Priya (PR #530): har channel ka apna worker container
      - name: worker-{{ .name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        args: ["--channel={{ .name }}", "--concurrency={{ .concurrency }}"]
        resources:
        {{ toYaml .Values.resources | indent 10 }}
      {{- end }}
`,
    'notify/templates/service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: {{ include "notify.fullname" . }}
  labels:
    {{- include "notify.labels" . | nindent 4 }}
spec:
  selector:
    app: {{ include "notify.fullname" . }}
  ports:
  - port: {{ .Values.service.port }}
    targetPort: {{ .Values.service.port }}
`,
  };
  const htText = (s, f) => (s.edited || {})[f] != null ? s.edited[f] : HT_FILES[f];
  const HT_KIND = ['Namespace', 'ServiceAccount', 'ConfigMap', 'Secret', 'Service', 'Deployment'];
  const RFC1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  // helm ki command line: positional args + flags
  function htArgs(cmd) {
    const t = String(cmd).split(' '), pos = [], fl = {};
    for (let i = 1; i < t.length; i++) {
      const x = t[i];
      if (/^(-n|--namespace|-f|--values|--set|--set-string|--version|--timeout)$/.test(x)) { fl[x.replace(/^--?/, '')] = t[++i]; continue; }
      const m = x.match(/^--?([a-z-]+)=(.*)$/);
      if (m) { fl[m[1]] = m[2]; continue; }
      if (/^-/.test(x)) { fl[x.replace(/^--?/, '')] = true; continue; }
      pos.push(x);
    }
    fl.ns = fl.n || fl.namespace;
    return { pos: pos.slice(1), fl, verb: pos[0] };
  }
  const htChart = p => /^(\.\/)?notify\/?$/.test(p || '');
  // poora chart render: { docs: [{ path, text, obj }] } ya { err, kind: 'tpl'|'yaml', path, text }
  function htRender(s, rel, ns) {
    let vals;
    try { vals = KG.yaml.parse(htText(s, 'notify/values.yaml')); } catch (e) { return { err: `failed to parse notify/values.yaml: error converting YAML to JSON: ${e.message}`, kind: 'tpl' }; }
    const files = {};
    Object.keys(HT_FILES).forEach(f => { if (/\/templates\//.test(f)) files[f] = htText(s, f); });
    const ctx = { Values: vals || {}, Release: { Name: rel, Namespace: ns, Revision: (s.cluster.rev || 3) + 1, IsUpgrade: true, IsInstall: false, Service: 'Helm' },
      Chart: { Name: 'notify', Version: '0.7.0', AppVersion: '2.4.0' }, Capabilities: { KubeVersion: { Version: 'v1.33.4', Major: '1', Minor: '33' } } };
    const r = KG.gotpl.renderChart(files, ctx);
    if (r.err) return { err: r.err, kind: 'tpl' };
    const docs = [];
    for (const path of Object.keys(r.files)) {
      const text = r.files[path];
      if (!text.trim()) continue;
      let obj;
      try { obj = KG.yaml.parse(text); } catch (e) { return { err: `YAML parse error on ${path}: error converting YAML to JSON: ${e.message}`, kind: 'yaml', path, text }; }
      docs.push({ path, text, obj });
    }
    docs.sort((a, b) => HT_KIND.indexOf((a.obj || {}).kind) - HT_KIND.indexOf((b.obj || {}).kind));
    return { docs };
  }
  const htOut = docs => docs.map(d => `---\n# Source: ${d.path}\n${d.text.replace(/\s+$/, '')}`).join('\n');
  // API server ke niyam (upgrade par) — rendered Deployment ke containers
  function htApiCheck(dep) {
    const ctrs = ((((dep || {}).spec || {}).template || {}).spec || {}).containers;
    const P = 'spec.template.spec.containers';
    if (!Array.isArray(ctrs) || !ctrs.length) return `Deployment.apps "notify" is invalid: ${P}: Required value`;
    const seen = new Set();
    for (let i = 0; i < ctrs.length; i++) {
      const c = ctrs[i] || {};
      if (!c.name) return `Deployment.apps "notify" is invalid: ${P}[${i}].name: Required value`;
      if (!RFC1123.test(String(c.name))) return `Deployment.apps "notify" is invalid: ${P}[${i}].name: Invalid value: "${c.name}": a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character (e.g. 'my-name',  or '123-abc', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?')`;
      if (seen.has(c.name)) return `Deployment.apps "notify" is invalid: ${P}[${i}].name: Duplicate value: "${c.name}"`;
      seen.add(c.name);
      if (!c.image || /^:|:$/.test(String(c.image))) return `Deployment.apps "notify" is invalid: ${P}[${i}].image: ${c.image ? `Invalid value: "${c.image}": invalid reference format` : 'Required value'}`;
      const rq = (c.resources || {}).requests;
      if (c.resources && typeof c.resources !== 'object') return `json: cannot unmarshal string into Go struct field Container.${P}.resources of type v1.ResourceRequirements`;
      if (rq && Object.keys(rq).some(k => !['cpu', 'memory', 'ephemeral-storage'].includes(k))) return `Deployment.apps "notify" is invalid: ${P}[${i}].resources.requests[${Object.keys(rq).find(k => !['cpu', 'memory', 'ephemeral-storage'].includes(k))}]: Invalid value: must be a standard resource type or fully qualified`;
    }
    return null;
  }
  const htPods = (c, n, ctrs) => Array.from({ length: n }, (_, i) => {
    const name = `notify-${c.hash}-${['q1w2e', 'r4t5y'][i % 2]}`;
    return { name, ready: `${ctrs.length}/${ctrs.length}`, status: 'Running', restarts: 0, age: '8s', node: NODES[i % 3].name, ip: '10.0.1' + (2 + i % 3) + '.' + (70 + i),
      describe: `Name:             ${name}\nNamespace:        payments\nNode:             ${NODES[i % 3].name}/10.0.1${2 + i % 3}.5\nLabels:           app=notify\n                  pod-template-hash=${c.hash}\nStatus:           Running\nControlled By:    ReplicaSet/notify-${c.hash}\nContainers:\n` +
        ctrs.map(x => `  ${x.name}:\n    Image:      ${x.image}\n    Args:\n${(x.args || []).map(a => '      ' + a).join('\n')}\n    State:      Running\n    Ready:      True`).join('\n') +
        `\nEvents:\n  Type    Reason     Age   From               Message\n  ----    ------     ----  ----               -------\n  Normal  Scheduled  9s    default-scheduler  Successfully assigned payments/${name} to ${NODES[i % 3].name}\n` +
        ctrs.map(x => `  Normal  Started    6s    kubelet            Started container ${x.name}`).join('\n') };
  });
  const HT_HIST = [['REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION', 'DESCRIPTION'],
    ['1', 'Mon Sep 29 11:20:05 2026', 'superseded', 'notify-0.6.0', '2.3.0', 'Install complete'],
    ['2', 'Fri Oct 17 15:02:44 2026', 'superseded', 'notify-0.6.1', '2.3.1', 'Upgrade complete'],
    ['3', 'Thu Nov 20 16:40:12 2026', 'deployed', 'notify-0.6.2', '2.3.1', 'Upgrade complete']];
  const htOk = s => { const r = htRender(s, 'notify', 'payments'); return !r.err && !htApiCheck((r.docs.find(d => (d.obj || {}).kind === 'Deployment') || {}).obj); };
  const T_HT = [
    { text: 'Chart render karo: <code>helm template notify ./notify</code> — error padho (kaunsi line, kaunsa field?)', check: s => !!s.cluster.rendered },
    { text: '<code>cat notify/values.yaml</code> — <code>range</code> kis list par ghoomta hai, aur us list ke har item mein kya hai?', check: s => ran(s, /^(cat|vi|vim|nano) (\.\/)?notify\/values\.yaml$|^helm (show|inspect) values\b/) },
    { text: 'Template theek karo — <code>helm template</code> bina error ke chale (aur YAML bhi sahi bane)', check: s => htOk(s) },
    { text: '<code>helm lint ./notify</code> — <b>0 chart(s) failed</b>', check: s => s.cluster.lintText != null && s.cluster.lintText === htText(s, HT_DEP) && htOk(s) },
    { text: 'Release upgrade karo: <code>helm upgrade notify ./notify -n payments</code>', check: s => s.cluster.rev === 4 && s.cluster.upText === htText(s, HT_DEP) },
    { text: '<code>kubectl get pods</code> — notify ke pods mein <b>2/2</b> containers?', check: s => s.cluster.rev === 4 && ranAfter(s, s.cluster.upAt, /^kubectl get (pods?|po)\b/) },
  ];
  addLab('helmtemplating', {
    type: 'terminal',
    title: '🖥️ Mission: naya template, aur helm upgrade ne mana kar diya',
    instructions: 'ChaiPay ki notify service SMS aur email bhejti hai. Version 2.4.0 mein Priya ne chart badla (PR #530): ab har channel (sms, email) ka apna worker container banega — values.yaml ki "channels" list se. CI mein helm upgrade fail ho gaya. Prod abhi purani revision 3 par hai, aur OTP SMS dheere ja rahe hain. Chart ki files ls se dikhti hain.',
    goal: `<code>notify</code> chart ko theek karo aur prod par <b>revision 4</b> lagao — har pod mein <b>2 containers</b> (worker-sms, worker-email).
      Template badalne ke liye: <code>vi notify/templates/deployment.yaml</code> → 💾 Save → <code>helm template notify ./notify</code> se dekho.
      Error aaye toh line number aur <code>at &lt;…&gt;</code> wala hissa padho.`,
    tasks: T_HT,
    cluster: {
      rev: 3, hash: '7c5d9b',
      nodes: NODES,
      pods: PAY_API.concat(['k2x7q', 'm4p8t'].map((x, i) => ({ name: 'notify-7c5d9b-' + x, ready: '1/1', status: 'Running', restarts: 0, age: '4d', node: NODES[i + 1].name, ip: '10.0.1' + (3 + i) + '.44' }))),
      deployments: [{ name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' }, { name: 'notify', ready: '2/2', upToDate: 2, available: 2, age: '56d' }],
      services: [{ name: 'notify', type: 'ClusterIP', clusterIP: '10.100.88.12', ports: '8080/TCP', age: '56d' }],
    },
    responses: [
      { re: /^helm template\b.*$/,
        out: (s, m) => {
          const a = htArgs((m && m[0]) || ''), chart = a.pos.length > 1 ? a.pos[1] : a.pos[0], rel = a.pos.length > 1 ? a.pos[0] : 'release-name';
          if (!chart) return 'Error: "helm template" requires at least 1 argument\n\nUsage:  helm template [NAME] [CHART] [flags]';
          if (!htChart(chart)) return `Error: path "${chart}" not found`;
          s.cluster.rendered = true;
          const r = htRender(s, rel, a.fl.ns || 'default');
          if (r.err && r.kind === 'yaml') return (a.fl.debug ? `---\n# Source: ${r.path}\n${r.text.replace(/\s+$/, '')}\n` : '') + `Error: ${r.err}\n` + (a.fl.debug ? '' : 'Use --debug flag to render out invalid YAML');
          if (r.err) return 'Error: ' + r.err;
          return htOut(r.docs);
        } },
      { re: /^helm lint\b.*$/,
        out: (s, m) => {
          const a = htArgs((m && m[0]) || ''), chart = a.pos[0] || '.';
          if (!htChart(chart)) return `==> Linting ${chart}\nError unable to check Chart.yaml file in chart: stat ${chart}/Chart.yaml: no such file or directory\n\nError: 1 chart(s) linted, 1 chart(s) failed`;
          const r = htRender(s, 'test-release', 'test-namespace'), head = `==> Linting ${chart}\n[INFO] Chart.yaml: icon is recommended\n`;
          if (r.err) { s.cluster.lintText = null; return head + (r.kind === 'yaml' ? `[ERROR] templates/${r.path.split('/').pop()}: unable to parse YAML: ${r.err.replace(/^YAML parse error on [^:]+: /, '')}` : `[ERROR] templates/: ${r.err}`) + '\n\nError: 1 chart(s) linted, 1 chart(s) failed'; }
          s.cluster.lintText = htText(s, HT_DEP);
          return head + '\n1 chart(s) linted, 0 chart(s) failed';
        } },
      { re: /^helm (?:upgrade|install)\b.*$/,
        out: (s, m) => {
          const c = s.cluster, a = htArgs((m && m[0]) || '');
          const [rel, chart] = a.pos;
          if (a.verb === 'install') return rel === 'notify' && (a.fl.ns === 'payments') ? 'Error: INSTALLATION FAILED: cannot re-use a name that is still in use' : '(simulator ne roka) naya release mat banao — prod par "notify" release pehle se hai: helm upgrade notify ./notify -n payments';
          if (!rel || !chart) return 'Error: "helm upgrade" requires 2 arguments\n\nUsage:  helm upgrade [RELEASE] [CHART] [flags]';
          if (!htChart(chart)) return `Error: path "${chart}" not found`;
          if (rel !== 'notify') return `Error: UPGRADE FAILED: "${rel}" has no deployed releases`;
          if (a.fl.ns !== 'payments') return a.fl.install ? '(simulator ne roka) -n payments bhool gaye — --install default namespace mein ek NAYA notify bana deta. -n payments jodo.' : 'Error: UPGRADE FAILED: "notify" has no deployed releases\n(release payments namespace mein hai — -n payments jodo)';
          if (a.fl.set || a.fl.values || a.fl.f) return '(simulator) is mission mein --set / -f nahi chahiye — galti template mein hai, values mein nahi.';
          const r = htRender(s, 'notify', 'payments');
          if (r.err) return 'Error: UPGRADE FAILED: ' + r.err;
          const dep = (r.docs.find(d => (d.obj || {}).kind === 'Deployment') || {}).obj;
          const apiErr = htApiCheck(dep);
          if (apiErr) return `Error: UPGRADE FAILED: cannot patch "notify" with kind Deployment: ${apiErr}`;
          if (c.rev === 4 && c.upText === htText(s, HT_DEP)) return `Release "notify" has been upgraded. Happy Helming!\nNAME: notify\nLAST DEPLOYED: Mon Nov 24 11:06:12 2026\nNAMESPACE: payments\nSTATUS: deployed\nREVISION: 5\nTEST SUITE: None\n(simulator: kuch nahi badla — naya revision bana par pods wahi.)`;
          const ctrs = dep.spec.template.spec.containers, n = Number(dep.spec.replicas) || 1;
          c.rev = 4; c.hash = '5f8e2a'; c.upText = htText(s, HT_DEP); c.upAt = s.history.length;
          c.pods = c.pods.filter(p => !/^notify-/.test(p.name)).concat(htPods(c, n, ctrs));
          Object.assign(c.deployments[1], { ready: `${n}/${n}`, upToDate: n, available: n });
          return `Release "notify" has been upgraded. Happy Helming!\nNAME: notify\nLAST DEPLOYED: Mon Nov 24 11:04:41 2026\nNAMESPACE: payments\nSTATUS: deployed\nREVISION: 4\nTEST SUITE: None`;
        } },
      { re: /^helm (?:list|ls)\b.*$/,
        out: (s, m) => /(-n|--namespace)[ =]payments|-A\b|--all-namespaces/.test(String(m && m[0]))
          ? tbl([['NAME', 'NAMESPACE', 'REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION'],
            s.cluster.rev === 4 ? ['notify', 'payments', '4', '2026-11-24 11:04:41.118204 +0530 IST', 'deployed', 'notify-0.7.0', '2.4.0'] : ['notify', 'payments', '3', '2026-11-20 16:40:12.402117 +0530 IST', 'deployed', 'notify-0.6.2', '2.3.1']])
          : 'NAME\tNAMESPACE\tREVISION\tUPDATED\tSTATUS\tCHART\tAPP VERSION\n(default namespace mein koi release nahi — -n payments jodo)' },
      { re: /^helm history\b.*$/,
        out: s => tbl(HT_HIST.map(r => r.slice()).map((r, i) => (i === 3 && s.cluster.rev === 4 ? Object.assign(r, { 2: 'superseded' }) : r))
          .concat(s.cluster.rev === 4 ? [['4', 'Mon Nov 24 11:04:41 2026', 'deployed', 'notify-0.7.0', '2.4.0', 'Upgrade complete']] : [])) + (s.cluster.rev === 4 ? '' : '\n(CI ka fail hua upgrade yahan nahi dikhta — template render hi nahi hua, toh revision bana hi nahi)') },
      { re: /^helm (?:show|inspect) values\b.*$/, out: s => htText(s, 'notify/values.yaml') },
      { re: /^helm get values\b.*$/, out: 'USER-SUPPLIED VALUES:\nnull' },
      { re: /^helm\b.*$/, err: true, out: '(simulator: is mission mein yeh helm commands chalte hain — template, lint, upgrade, list, history, show values)' },
      { re: /^ls(?: -l| -la)? (?!-)(\S+?)\/?$/,
        out: (s, m) => {
          const dir = String((m && m[1]) || '').replace(/^\.\//, ''), names = new Set();
          Object.keys(HT_FILES).forEach(f => { if (f.startsWith(dir + '/')) { const r = f.slice(dir.length + 1); names.add(r.includes('/') ? r.split('/')[0] + '/' : r); } });
          return names.size ? [...names].join('  ') : `ls: cannot access '${(m && m[1]) || ''}': No such file or directory`;
        } },
    ],
    files: Object.assign({}, ...Object.keys(HT_FILES).map(f => ({
      [f]: {
        editable: f === HT_DEP, rawApply: true,
        desc: f === HT_DEP ? 'Priya ka template — vi se badlo' : 'chart ki file (sirf padhne ke liye)',
        content: HT_FILES[f],
        saveTip: f === HT_DEP ? 'Render karke dekho: helm template notify ./notify' : undefined,
        apply: () => (/\{\{/.test(HT_FILES[f]) || f === HT_DEP
          ? { err: `error: error parsing ${f}: error converting YAML to JSON: yaml: invalid map key: map[interface {}]interface {}{"include \\"notify.fullname\\" .":interface {}(nil)}\n(Yeh Helm TEMPLATE hai, seedha YAML nahi — {{ }} Helm bharta hai. Lagane ke liye: helm upgrade notify ./notify -n payments)` }
          : { err: `(simulator ne roka) ${f} Kubernetes object nahi — chart ki file hai. helm template / helm upgrade use karo.` }),
      },
    }))),
    success: KG.allOf(T_HT),
    successText: `<b>Galti 1 — <code>range</code> ke andar <code>.</code> badal jaata hai:</b> <code>{{ range .Values.channels }}</code> ke andar <code>.</code> = ek channel (<code>{name, concurrency}</code>).
      Uske andar <code>.Values</code> hai hi nahi → <code>nil pointer evaluating interface {}.image</code>. Bahar ke root tak <code>$</code> se pahuncho: <code>$.Values.image.tag</code>. (<code>with</code> ke andar bhi yahi hota hai.)<br>
      <b>Galti 2 — <code>indent</code> vs <code>nindent</code>:</b> line par pehle se 8 space the, upar se <code>indent 10</code> ne pehli line ko aur khiska diya → <code>did not find expected key</code>.
      Pattern yaad rakho: <code>{{- toYaml … | nindent N }}</code> — <code>{{-</code> pichhli line ka khaali hissa khaata hai, <code>nindent</code> nayi line + N space deta hai.<br>
      <b>Kram:</b> <code>helm template</code> (aur <code>--debug</code>) → <code>helm lint</code> → <code>helm upgrade</code>. Render ka error template mein hota hai; upgrade ka error (jaise <code>Duplicate value</code>) Kubernetes API deta hai.`,
    hints: [
      'helm template notify ./notify — error ki line 21 hai, at <.Values.image.repository>. Phir cat notify/values.yaml: range .Values.channels ke andar "." ek channel hai ({name, concurrency}) — usme Values kahan?',
      'Range ke andar root tak $ se pahuncho: {{ $.Values.image.repository }} aur {{ $.Values.image.tag }}, aur toYaml $.Values.resources. Save, phir helm template notify ./notify.',
      'Ab YAML error? resources wali line ko {{- toYaml $.Values.resources | nindent 10 }} karo (indent ki jagah nindent, aur {{-). Phir helm lint ./notify aur helm upgrade notify ./notify -n payments.',
    ],
    solution: ['helm template notify ./notify', 'cat notify/values.yaml',
      { edit: HT_DEP, change: [['{{ .Values.image.repository }}:{{ .Values.image.tag }}', '{{ $.Values.image.repository }}:{{ $.Values.image.tag }}'],
        ['        {{ toYaml .Values.resources | indent 10 }}', '        {{- toYaml $.Values.resources | nindent 10 }}']] },
      'helm template notify ./notify', 'helm lint ./notify', 'helm upgrade notify ./notify -n payments', 'kubectl get pods'],
  }, {
    objectives: ['🖥️ <b>Mission:</b> asli Go-template engine par chart theek karo — <code>range</code> mein <code>$</code>, aur <code>toYaml | nindent</code>'],
    success: ['Main Helm ka "nil pointer evaluating" aur "did not find expected key" error padh kar template theek kar sakta hoon'],
    cards: [
      { front: '<code>{{ range .Values.channels }}</code> ke andar <code>{{ .Values.image.tag }}</code> — kya hoga?', back: '<code>nil pointer evaluating interface {}.image</code>. Range ke andar <code>.</code> = list ka ek item. Root ke liye <code>$</code>: <code>{{ $.Values.image.tag }}</code>.' },
      { front: 'Map ko YAML mein daalne ka sahi pattern?', back: '<code>{{- toYaml .Values.resources | nindent 10 }}</code>. Bina <code>toYaml</code> → <code>wrong type for value; expected string</code> (ya <code>map[…]</code> chhapta hai). <code>indent</code> + pehle se space = galat indentation.' },
    ],
  });

  /* =====================================================================
     🤖 operators — ledger-db (CloudNativePG Cluster CR) ki disk badhani hai,
     par apply par "failed calling webhook": webhook operator khud chalata hai,
     aur operator OOMKilled hai. Helm values se memory badhao → CR lagao.
     ===================================================================== */
  const OP_POD0 = 'cnpg-cloudnative-pg-6d8f9c7b5-x2k9p';
  const OP_PODS = ['cnpg-cloudnative-pg-7b4c2d9e1-q8w3r', 'cnpg-cloudnative-pg-5e9a3f7c2-m6t1z', 'cnpg-cloudnative-pg-8c1f6b4a9-d3k7n', 'cnpg-cloudnative-pg-4a7e2c8f5-h9p2w'];
  const OP_CR = `apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ledger-db
  namespace: payments
spec:
  instances: 3
  imageName: ghcr.io/cloudnative-pg/postgresql:16.4
  primaryUpdateStrategy: unsupervised
  storage:
    storageClass: gp3
    size: 100Gi          # Amit: 50Gi → 100Gi (disk 92% bhar gayi)
  postgresql:
    parameters:
      max_connections: "300"
`;
  const OP_VALUES = `# CloudNativePG operator — Helm values (platform team)
# 2025 mein cluster mein 3 Postgres clusters the; ab 41 hain (har team ka apna DB)
replicaCount: 1
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    memory: 200Mi
monitoring:
  podMonitorEnabled: true
`;
  const QTY_RE = /^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$/;
  const toMi = q => {
    if (typeof q === 'number') return q / 1048576;
    const m = String(q).match(/^([0-9.]+)(Ki|Mi|Gi|Ti|k|M|G|T|m)?$/);
    if (!m) return null;
    const n = Number(m[1]), u = m[2] || '';
    return n * ({ Ki: 1 / 1024, Mi: 1, Gi: 1024, Ti: 1048576, k: 1000 / 1048576, M: 1e6 / 1048576, G: 1e9 / 1048576, T: 1e12 / 1048576, m: 0.001 / 1048576 }[u] || 1 / 1048576);
  };
  const toGi = q => { const mi = toMi(q); return mi == null ? null : mi / 1024; };
  const opPod = c => c.opPods[c.opPods.length - 1];
  const opRow = c => { const p = opPod(c); return [p.name, p.ok ? '1/1' : '0/1', p.ok ? 'Running' : 'CrashLoopBackOff', p.ok ? '0' : `${p.restarts} (${p.restarts > 5 ? '3m12s' : '9s'} ago)`, p.age]; };
  const opDesc = c => {
    const p = opPod(c);
    return `Name:             ${p.name}
Namespace:        cnpg-system
Service Account:  cnpg-cloudnative-pg
Node:             node-2/10.0.13.5
Labels:           app.kubernetes.io/instance=cnpg
                  app.kubernetes.io/name=cloudnative-pg
Status:           Running
Controlled By:    ReplicaSet/${p.name.replace(/-[a-z0-9]{5}$/, '')}
Containers:
  manager:
    Image:         ghcr.io/cloudnative-pg/cloudnative-pg:1.24.1
    Port:          9443/TCP (webhook-server), 8080/TCP (metrics)
    Command:
      /manager
    Args:
      controller
      --leader-elect
      --webhook-port=9443
` + (p.ok ? `    State:          Running
      Started:      Mon, 24 Nov 2026 11:12:40 +0530
    Ready:          True
    Restart Count:  0` : `    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
      Started:      Mon, 24 Nov 2026 11:01:05 +0530
      Finished:     Mon, 24 Nov 2026 11:01:16 +0530
    Ready:          False
    Restart Count:  ${p.restarts}`) + `
    Limits:
      memory:  ${p.lim}
    Requests:
      cpu:     100m
      memory:  ${p.req}
    Readiness:  http-get https://:9443/readyz delay=0s timeout=1s period=10s #success=1 #failure=3
Events:
  Type     Reason   Age                  From     Message
  ----     ------   ----                 ----     -------
` + (p.ok ? `  Normal   Started  12s                  kubelet  Started container manager` : `  Normal   Pulled   ${p.restarts > 5 ? '3m12s (x24 over 3h)' : '9s (x3 over 40s)'}  kubelet  Container image "ghcr.io/cloudnative-pg/cloudnative-pg:1.24.1" already present on machine
  Warning  BackOff  ${p.restarts > 5 ? '41s (x790 over 3h)' : '4s (x4 over 35s)'}   kubelet  Back-off restarting failed container manager in pod ${p.name}_cnpg-system(8a1f3c5e-7b9d-4e2a-9c6f-1d3b5e7a9c2f)`);
  };
  const OP_LOGS = `{"level":"info","ts":"2026-11-24T05:31:05.118Z","msg":"Starting CloudNativePG Operator","version":"1.24.1","build":{"Version":"1.24.1","Commit":"3f96930d","Date":"2024-10-16"}}
{"level":"info","ts":"2026-11-24T05:31:05.412Z","logger":"setup","msg":"Listing namespaces to watch","namespaces":[""]}
{"level":"info","ts":"2026-11-24T05:31:06.877Z","msg":"Starting EventSource","controller":"cluster","controllerGroup":"postgresql.cnpg.io","controllerKind":"Cluster","source":"kind source: *v1.Cluster"}
{"level":"info","ts":"2026-11-24T05:31:09.204Z","msg":"Starting workers","controller":"cluster","controllerGroup":"postgresql.cnpg.io","controllerKind":"Cluster","worker count":10}
{"level":"info","ts":"2026-11-24T05:31:10.551Z","msg":"Reconciling Cluster","controller":"cluster","namespace":"fraud","name":"fraud-db"}
{"level":"info","ts":"2026-11-24T05:31:10.902Z","msg":"Reconciling Cluster","controller":"cluster","namespace":"kyc","name":"kyc-db"}`;
  const crDesc = c => `Name:         ledger-db
Namespace:    payments
API Version:  postgresql.cnpg.io/v1
Kind:         Cluster
Spec:
  Image Name:  ghcr.io/cloudnative-pg/postgresql:16.4
  Instances:   3
  Storage:
    Size:           ${c.size}
    Storage Class:  gp3
Status:
  Current Primary:  ledger-db-1
  Instances:        3
  Ready Instances:  3
  Phase:            Cluster in healthy state
  Conditions:
    Last Transition Time:  ${c.opOk ? '2026-11-24T05:43:12Z' : '2026-11-24T02:11:07Z'}
    Message:               Cluster is Ready
    Reason:                ClusterIsReady
    Status:                True
    Type:                  Ready
Events:                    <none>`;
  const pvcRow = (i, size) => ({ name: 'ledger-db-' + i, status: 'Bound', volume: 'pvc-' + ['3a9f1c2e', '7d4b8e6a', 'c2e5f9b1'][i - 1] + '-5b7d-4e1a-9c3f-8a2d6e4b1f7' + i, capacity: size, accessModes: 'RWO', storageClass: 'gp3', age: '40d' });
  // operator ki nayi pod: memory limit kaafi hai ya phir OOMKilled
  function opRoll(c, vals) {
    const r = (vals && vals.resources) || {}, lim = ((r.limits || {}).memory), req = ((r.requests || {}).memory);
    const n = c.opPods.length - 1;
    const ok = lim == null || toMi(lim) >= 384;
    c.opPods.push({ name: OP_PODS[n % OP_PODS.length], ok, restarts: ok ? 0 : 3, age: ok ? '14s' : '41s', lim: lim == null ? '<none>' : String(lim), req: req == null ? '<none>' : String(req) });
    c.opOk = ok;
  }
  const opWebhookErr = file => `Error from server (InternalError): error when applying patch:
{"spec":{"storage":{"size":"100Gi"}}}
to:
Resource: "postgresql.cnpg.io/v1, Resource=clusters", GroupVersionKind: "postgresql.cnpg.io/v1, Kind=Cluster"
Name: "ledger-db", Namespace: "payments"
for: "${file}": error when patching "${file}": Internal error occurred: failed calling webhook "mcluster.cnpg.io": failed to call webhook: Post "https://cnpg-webhook-service.cnpg-system.svc:443/mutate-postgresql-cnpg-io-v1-cluster?timeout=10s": no endpoints available for service "cnpg-webhook-service"`;
  const KSO = '(?=.*(?:-n|--namespace)[ =]cnpg-system\\b)';
  const T_OP = [
    { text: '<code>kubectl apply -f ledger-db.yaml</code> — error padho: kaunsa webhook, kaunsi service?', check: s => !!s.cluster.sawWh },
    { text: 'Webhook operator khud chalata hai — uske pods dekho (<code>kubectl get pods -n cnpg-system</code>)', check: s => !!s.cluster.sawOp },
    { text: 'Operator kyun gir raha hai? Pod ka describe padho (<b>Last State</b>)', check: s => !!s.cluster.sawOom },
    { text: 'Operator ki memory <b>Helm values</b> se badhao (<code>vi cnpg-values.yaml</code> → <code>helm upgrade …</code>)', check: s => !!s.cluster.opOk && !!s.cluster.viaHelm },
    { text: 'Ab CR lagao: <code>kubectl apply -f ledger-db.yaml</code>', check: s => s.cluster.size === '100Gi' },
    { text: '<code>kubectl get pvc</code> — ledger-db ki teeno disks <b>100Gi</b>?', check: s => s.cluster.size === '100Gi' && ranAfter(s, s.cluster.sizeAt, /^kubectl get (pvc|persistentvolumeclaims?)\b/) },
  ];
  addLab('operators', {
    type: 'terminal',
    title: '🖥️ Mission: disk 92% bhari, aur kubectl apply ko webhook ne rok diya',
    instructions: 'ChaiPay ka ledger database CloudNativePG (CNPG) operator chalata hai: Cluster naam ka custom resource (CR) "ledger-db" — 3 Postgres pods, har ek ki 50Gi disk. Disk 92% bhar chuki hai. Amit ne ledger-db.yaml mein size 100Gi kiya, par kubectl apply har baar fail ho raha hai. Amit ka sujhaav: "webhook hi delete kar do". Platform team ke operator ki Helm values cnpg-values.yaml mein hain.',
    goal: `ledger-db ki teeno disks <b>100Gi</b> karo — CR ke zariye, jaise operator chahta hai. Pehle samjho apply kyun fail hai: error mein webhook ka naam aur service padho.
      Operator <code>cnpg-system</code> namespace mein hai (<code>-n cnpg-system</code>). Helm release: <code>cnpg</code>, chart <code>cnpg/cloudnative-pg</code>.`,
    tasks: T_OP,
    cluster: {
      size: '50Gi', opOk: false,
      opPods: [{ name: OP_POD0, ok: false, restarts: 23, age: '3h', lim: '200Mi', req: '128Mi' }],
      nodes: NODES,
      pods: PAY_API.concat([1, 2, 3].map(i => ({ name: 'ledger-db-' + i, ready: '1/1', status: 'Running', restarts: 0, age: '40d', node: NODES[i - 1].name, ip: '10.0.1' + (1 + i) + '.31' }))),
      deployments: [{ name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' }],
      pvcs: [1, 2, 3].map(i => pvcRow(i, '50Gi')),
      custom: {
        cluster: { names: ['cluster', 'clusters', 'clusters.postgresql.cnpg.io'],
          cols: ['NAME', 'AGE', 'INSTANCES', 'READY', 'STATUS', 'PRIMARY'],
          items: [{ name: 'ledger-db', row: ['40d', '3', '3', 'Cluster in healthy state', 'ledger-db-1'] }] },
      },
    },
    responses: [
      { re: new RegExp('^kubectl ' + KSO + '(?:(?:-n|--namespace)[ =]cnpg-system )?get (?:pods?|po)\\b.*$'),
        out: s => { s.cluster.sawOp = true; return tbl([['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'], opRow(s.cluster)]); } },
      { re: new RegExp('^kubectl ' + KSO + '.*\\bdescribe\\b.*$'),
        out: s => { if (!s.cluster.opOk) s.cluster.sawOom = true; return opDesc(s.cluster); } },
      { re: new RegExp('^kubectl ' + KSO + '.*\\blogs\\b.*$'),
        out: s => s.cluster.opOk ? OP_LOGS.split('\n').slice(0, 4).join('\n') + '\n{"level":"info","ts":"2026-11-24T05:43:12.204Z","msg":"Reconciling Cluster","controller":"cluster","namespace":"payments","name":"ledger-db"}'
          : OP_LOGS + '\n(logs achanak ruk jaate hain — process ko bahar se maara gaya. Kisne aur kyun? Pod ke describe mein Last State dekho.)' },
      { re: new RegExp('^kubectl ' + KSO + '.*\\bget (?:endpoints?|ep)\\b.*$'),
        out: s => tbl([['NAME', 'ENDPOINTS', 'AGE'], ['cnpg-webhook-service', s.cluster.opOk ? '10.0.13.77:9443' : '<none>', '412d']]) + (s.cluster.opOk ? '' : '\n(ENDPOINTS khaali = koi Ready pod nahi jo webhook sune)') },
      { re: new RegExp('^kubectl ' + KSO + '.*\\brollout restart\\b.*$'),
        out: s => { const c = s.cluster; const p = opPod(c); opRoll(c, { resources: { limits: { memory: p.lim }, requests: { memory: p.req } } }); c.viaHelm = c.viaHelm && c.opOk; return `deployment.apps/cnpg-cloudnative-pg restarted${c.opOk ? '' : '\n(naya pod bhi wahi memory limit (' + p.lim + ') ke saath aaya — kubectl get pods -n cnpg-system se dekho)'}`; } },
      { re: new RegExp('^kubectl ' + KSO + '.*\\bset resources\\b.*$'),
        out: (s, m) => {
          const c = s.cluster, mm = String((m && m[0]) || '').match(/--limits=(?:\S*?)memory=([^,\s]+)/);
          if (!mm) return 'error: you must specify an update to requests or limits (in the form of --requests/--limits)';
          opRoll(c, { resources: { limits: { memory: mm[1] }, requests: { memory: opPod(c).req } } });
          c.viaHelm = false;
          return `deployment.apps/cnpg-cloudnative-pg resource requirements updated\n(Dhyan do: yeh Deployment Helm chalata hai. Agla "helm upgrade cnpg …" values file ka ${(() => { try { return ((((KG.yaml.parse((s.edited || {})['cnpg-values.yaml'] || OP_VALUES) || {}).resources || {}).limits || {}).memory) || 'limit'; } catch (e) { return 'limit'; } })()} wapas laga dega — memory cnpg-values.yaml mein likho.)`;
        } },
      { re: /^kubectl delete (?:validatingwebhookconfigurations?|mutatingwebhookconfigurations?)\b.*$/, err: true,
        out: '(simulator ne roka) Webhook delete karna = taala tod dena. Webhook hi CR ki jaanch karta hai (jaise "disk chhoti mat karo") — aur operator abhi bhi mara hua hai, toh CR lag bhi jaata toh disk badhane wala koi nahi. Pehle operator ko zinda karo.' },
      { re: /^kubectl get (?:validatingwebhookconfigurations?|mutatingwebhookconfigurations?)\b.*$/,
        out: (s, m) => tbl([['NAME', 'WEBHOOKS', 'AGE'], [/mutating/.test(String(m && m[0])) ? 'cnpg-mutating-webhook-configuration' : 'cnpg-validating-webhook-configuration', '5', '412d']]) },
      { re: /^kubectl get (?:crds?|customresourcedefinitions?)\b.*$/,
        out: tbl([['NAME', 'CREATED AT'], ['backups.postgresql.cnpg.io', '2025-10-08T06:12:41Z'], ['clusterimagecatalogs.postgresql.cnpg.io', '2025-10-08T06:12:41Z'], ['clusters.postgresql.cnpg.io', '2025-10-08T06:12:41Z'],
          ['databases.postgresql.cnpg.io', '2025-10-08T06:12:41Z'], ['poolers.postgresql.cnpg.io', '2025-10-08T06:12:41Z'], ['scheduledbackups.postgresql.cnpg.io', '2025-10-08T06:12:41Z']]) },
      { re: /^kubectl api-resources\b.*$/,
        out: tbl([['NAME', 'SHORTNAMES', 'APIVERSION', 'NAMESPACED', 'KIND'], ['backups', '', 'postgresql.cnpg.io/v1', 'true', 'Backup'], ['clusters', '', 'postgresql.cnpg.io/v1', 'true', 'Cluster'],
          ['poolers', '', 'postgresql.cnpg.io/v1', 'true', 'Pooler'], ['scheduledbackups', '', 'postgresql.cnpg.io/v1', 'true', 'ScheduledBackup']]) },
      { re: rx('kubectl describe (?:clusters?|clusters\\.postgresql\\.cnpg\\.io)(?:[ /]ledger-db)?'), out: s => crDesc(s.cluster) },
      { re: /^kubectl exec (?:-it? |-ti )?ledger-db-[123](?: (?:-n|--namespace)[ =]payments)? -- df\b.*$/,
        out: s => s.cluster.size === '100Gi' ? 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme1n1     98G   45G   53G  46% /var/lib/postgresql/data' : 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme1n1     49G   45G  4.0G  92% /var/lib/postgresql/data' },
      { re: /^helm\b.*$/,
        out: (s, m) => {
          const c = s.cluster, a = htArgs((m && m[0]) || '');
          if (a.verb === 'list' || a.verb === 'ls') return /cnpg-system|-A\b|--all-namespaces/.test(String(m && m[0]))
            ? tbl([['NAME', 'NAMESPACE', 'REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION'], ['cnpg', 'cnpg-system', String(c.opRev || 6), '2026-06-11 10:20:41.402117 +0530 IST', 'deployed', 'cloudnative-pg-0.22.1', '1.24.1']])
            : '(default namespace mein koi release nahi — -n cnpg-system jodo)';
          if (a.verb === 'get' && a.pos[0] === 'values') return 'USER-SUPPLIED VALUES:\n' + OP_VALUES.split('\n').filter(l => !/^#/.test(l)).join('\n');
          if (a.verb !== 'upgrade') return '(simulator: is mission mein helm list / get values / upgrade chalte hain)';
          const [rel, chart] = a.pos;
          if (rel !== 'cnpg' || chart !== 'cnpg/cloudnative-pg') return `Error: UPGRADE FAILED: ${rel !== 'cnpg' ? `"${rel}" has no deployed releases` : `chart "${chart}" not found — release cnpg ka chart cnpg/cloudnative-pg hai`}`;
          if (a.fl.ns !== 'cnpg-system') return 'Error: UPGRADE FAILED: "cnpg" has no deployed releases\n(operator cnpg-system namespace mein hai — -n cnpg-system jodo)';
          const vf = a.fl.f || a.fl.values;
          if (!vf) return '(simulator ne roka) -f cnpg-values.yaml ke bina upgrade = platform team ki saari custom values (monitoring waghairah) chart ke default par chali jaati. -f cnpg-values.yaml do.';
          if (vf.replace(/^\.\//, '') !== 'cnpg-values.yaml') return `Error: open ${vf}: no such file or directory`;
          let vals;
          try { vals = KG.yaml.parse((s.edited || {})['cnpg-values.yaml'] || OP_VALUES) || {}; } catch (e) { return `Error: failed to parse cnpg-values.yaml: error converting YAML to JSON: ${e.message}`; }
          const r = vals.resources || {}, lim = (r.limits || {}).memory, req = (r.requests || {}).memory;
          for (const [k, q] of [['limits', lim], ['requests', req]]) if (q != null && typeof q === 'string' && !QTY_RE.test(q))
            return `Error: UPGRADE FAILED: failed to create resource: quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$' (resources.${k}.memory: "${q}")`;
          if (lim != null && req != null && toMi(req) > toMi(lim)) return `Error: UPGRADE FAILED: cannot patch "cnpg-cloudnative-pg" with kind Deployment: Deployment.apps "cnpg-cloudnative-pg" is invalid: spec.template.spec.containers[0].resources.requests: Invalid value: "${req}": must be less than or equal to memory limit of ${lim}`;
          if (lim != null && toMi(lim) > 4096) return '(simulator) itni memory operator ko nahi chahiye — node ki memory doosre pods ki bhi hai. 512Mi–1Gi kaafi hai.';
          c.opRev = (c.opRev || 6) + 1;
          opRoll(c, vals);
          c.viaHelm = true;
          return `Release "cnpg" has been upgraded. Happy Helming!\nNAME: cnpg\nLAST DEPLOYED: Mon Nov 24 11:12:31 2026\nNAMESPACE: cnpg-system\nSTATUS: deployed\nREVISION: ${c.opRev}\nTEST SUITE: None\nNOTES:\nCloudNativePG operator should be installed in namespace "cnpg-system".`;
        } },
    ],
    files: {
      'ledger-db.yaml': {
        editable: true,
        desc: 'ledger-db Cluster CR (Amit ka badlaav: 100Gi)',
        content: OP_CR,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {};
          if (d.kind !== 'Cluster') return { err: `error: is file mein Cluster CR chahiye (kind: ${d.kind || 'khaali'})` };
          if (d.apiVersion !== 'postgresql.cnpg.io/v1') return { err: `error: resource mapping not found for name: "ledger-db" namespace: "payments" from "ledger-db.yaml": no matches for kind "Cluster" in version "${d.apiVersion}"\nensure CRDs are installed first` };
          if ((d.metadata || {}).name !== 'ledger-db') return { err: '(simulator ne roka) naam badla toh operator ek NAYA khaali database cluster bana dega. metadata.name: ledger-db rakho.' };
          const sp = d.spec || {}, st = sp.storage || {};
          const SK = ['instances', 'imageName', 'primaryUpdateStrategy', 'storage', 'postgresql', 'description', 'bootstrap', 'backup', 'monitoring', 'resources', 'affinity'];
          const uk = Object.keys(sp).find(k => !SK.includes(k)) || Object.keys(st).map(k => ['size', 'storageClass', 'resizeInUseVolumes', 'pvcTemplate'].includes(k) ? null : 'storage.' + k).find(Boolean);
          if (uk) return { err: `Error from server (BadRequest): error when patching "ledger-db.yaml": Cluster in version "v1" cannot be handled as a Cluster: strict decoding error: unknown field "spec.${uk}"` };
          // asli kram: strict decoding → mutating webhook (operator) → schema → validating webhook
          if (!c.opOk) { c.sawWh = true; return { err: opWebhookErr('ledger-db.yaml') }; }
          if (typeof sp.instances !== 'number') return { err: `The Cluster "ledger-db" is invalid: spec.instances: Invalid value: "${typeof sp.instances}": spec.instances in body must be of type integer: "${typeof sp.instances}"` };
          if (sp.instances < 1) return { err: `The Cluster "ledger-db" is invalid: spec.instances: Invalid value: ${sp.instances}: spec.instances in body should be greater than or equal to 1` };
          if (typeof st.size !== 'string') return { err: `The Cluster "ledger-db" is invalid: spec.storage.size: Invalid value: "${st.size == null ? 'null' : typeof st.size === 'number' ? 'integer' : typeof st.size}": spec.storage.size in body must be of type string: "${st.size == null ? 'null' : typeof st.size === 'number' ? 'integer' : typeof st.size}"` };
          const params = ((sp.postgresql || {}).parameters) || {};
          const bad = Object.keys(params).find(k => typeof params[k] !== 'string');
          if (bad) return { err: `The Cluster "ledger-db" is invalid: spec.postgresql.parameters.${bad}: Invalid value: "${typeof params[bad] === 'number' ? 'integer' : typeof params[bad]}": spec.postgresql.parameters.${bad} in body must be of type string: "${typeof params[bad] === 'number' ? 'integer' : typeof params[bad]}"` };
          if (!QTY_RE.test(st.size) || toGi(st.size) == null) return { err: `Error from server (Forbidden): error when patching "ledger-db.yaml": admission webhook "vcluster.cnpg.io" denied the request: Cluster.postgresql.cnpg.io "ledger-db" is invalid: spec.storage.size: Invalid value: "${st.size}": quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$'` };
          if (toGi(st.size) < toGi(c.size)) return { err: `Error from server (Forbidden): error when patching "ledger-db.yaml": admission webhook "vcluster.cnpg.io" denied the request: Cluster.postgresql.cnpg.io "ledger-db" is invalid: spec.storage.size: Invalid value: "${st.size}": can't shrink existing storage from ${c.size} to ${st.size}` };
          if (sp.instances !== 3 || st.storageClass !== 'gp3' || sp.imageName !== 'ghcr.io/cloudnative-pg/postgresql:16.4') return { err: '(simulator ne roka) is mission mein sirf storage.size badlo — instances / image / storageClass ka badlaav database ko restart ya re-create karwata.' };
          if (toGi(st.size) > 500) return { err: '(simulator) 500Gi se zyada ki zaroorat nahi — 100Gi kaafi hai.' };
          if (st.size === c.size) return 'cluster.postgresql.cnpg.io/ledger-db unchanged';
          c.size = st.size; c.sizeAt = s.history.length;
          c.pvcs = [1, 2, 3].map(i => pvcRow(i, st.size));
          return 'cluster.postgresql.cnpg.io/ledger-db configured\n(operator ne naya size dekha → teeno PVCs ko resize kiya; gp3 StorageClass mein allowVolumeExpansion: true hai, toh disk chalte chalte badhti hai)';
        },
      },
      'cnpg-values.yaml': {
        editable: true,
        desc: 'CNPG operator ki Helm values (release cnpg, namespace cnpg-system)',
        content: OP_VALUES,
        saveTip: 'Operator par lagao: helm upgrade cnpg cnpg/cloudnative-pg -n cnpg-system -f cnpg-values.yaml',
        apply: () => ({ err: 'error: error validating "cnpg-values.yaml": error validating data: [apiVersion not set, kind not set]; if you choose to ignore these errors, turn validation off with --validate=false\n(Yeh Helm values file hai, Kubernetes object nahi — helm upgrade cnpg cnpg/cloudnative-pg -n cnpg-system -f cnpg-values.yaml)' }),
      },
    },
    success: KG.allOf(T_OP),
    successText: `<b>Chain:</b> 41 Postgres clusters ka hisaab rakhte rakhte operator ki memory 200Mi se upar gayi → kernel ne maara (<b>OOMKilled</b>, exit 137) → pod CrashLoopBackOff →
      <code>cnpg-webhook-service</code> ke peeche koi Ready pod nahi → API server webhook ko call hi nahi kar paaya → <b>har</b> CNPG CR ka apply fail.<br>
      <b>Operator = CRD + controller:</b> CR sirf ek likhi hui ichha hai. Disk badhana, failover, backup — yeh kaam operator karta hai. Operator mara = CR badlo ya na badlo, kuch nahi hota.<br>
      <b>Webhook delete karna galat tha:</b> CR toh lag jaata, par badhane wala koi nahi — aur "disk chhoti mat karo" jaisi jaanch bhi chali jaati.<br>
      <b>Debug kram:</b> CR ka status → operator pods → describe (Last State) → logs. Memory <b>Helm values</b> mein badhao — <code>kubectl set resources</code> agla helm upgrade mita deta.`,
    hints: [
      'kubectl apply -f ledger-db.yaml — error mein "failed calling webhook" aur "no endpoints available for service cnpg-webhook-service". Webhook ka server kaun hai? kubectl get pods -n cnpg-system',
      `Operator CrashLoopBackOff mein hai. kubectl describe pod ${OP_POD0} -n cnpg-system — Last State: Reason kya hai? Limits mein memory kitni hai?`,
      'vi cnpg-values.yaml — limits.memory 200Mi ko 1Gi karo, Save. helm upgrade cnpg cnpg/cloudnative-pg -n cnpg-system -f cnpg-values.yaml. Phir kubectl get pods -n cnpg-system (Running?), kubectl apply -f ledger-db.yaml, kubectl get pvc.',
    ],
    solution: ['kubectl apply -f ledger-db.yaml', 'kubectl get pods -n cnpg-system', `kubectl describe pod ${OP_POD0} -n cnpg-system`,
      { edit: 'cnpg-values.yaml', change: [['    memory: 200Mi', '    memory: 1Gi']] },
      'helm upgrade cnpg cnpg/cloudnative-pg -n cnpg-system -f cnpg-values.yaml', 'kubectl get pods -n cnpg-system', 'kubectl apply -f ledger-db.yaml', 'kubectl get pvc'],
  }, {
    objectives: ['🖥️ <b>Mission:</b> operator OOMKilled → webhook bina endpoints → CR apply fail. CR status, operator pods aur Last State se jaanch karo'],
    success: ['Main "failed calling webhook" se operator tak pahunch kar uski memory Helm values se theek kar sakta hoon'],
    cards: [
      { front: '<code>kubectl apply</code> par <code>failed calling webhook … no endpoints available for service</code> — matlab?', back: 'Webhook ka server (aksar <b>operator ka pod</b>) Ready nahi. <code>kubectl get pods -n &lt;operator-ns&gt;</code> aur describe dekho. Webhook delete mat karo — operator mara hai toh CR lag kar bhi kuch nahi hoga.' },
      { front: 'Operator mara hua ho toh CR badalne se kya hota hai?', back: '<b>Kuch nahi.</b> CR sirf desired state hai — kaam operator (controller) karta hai. Operator wapas aate hi woh CR padh kar reconcile karta hai.' },
    ],
  });

  /* =====================================================================
     🕸️ istio — pay-api v2 canary (10%) ke requests 503:
     (1) VirtualService subset "v2" maangta hai, DestinationRule mein hai hi nahi (NC)
     (2) v2 pod mein sidecar band, par DR "ISTIO_MUTUAL" bhejta hai → TLS error (UF,URX)
     Har request ka nateeja live VS + DR + pods se nikalta hai.
     ===================================================================== */
  const IS_VS = `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: pay-api
  namespace: payments
spec:
  hosts:
  - pay-api
  http:
  - route:
    - destination:
        host: pay-api
        subset: v1
      weight: 90
    - destination:
        host: pay-api
        subset: v2           # Neha: naya UPI flow — 10% canary
      weight: 10
`;
  const IS_DR = `apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: pay-api
  namespace: payments
spec:
  host: pay-api
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL      # mesh ke andar mTLS (security team ka niyam)
  subsets:
  - name: v1
    labels:
      version: v1
`;
  const IS_V2 = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: pay-api-v2
  namespace: payments
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pay-api
      version: v2
  template:
    metadata:
      labels:
        app: pay-api
        version: v2
      annotations:
        sidecar.istio.io/inject: "false"   # debug ke liye band kiya tha
    spec:
      containers:
      - name: pay-api
        image: 111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api:2.0.0-rc1
        ports:
        - containerPort: 8080
`;
  const IS_SH = `#!/bin/bash
# sleep pod (mesh ke andar) se pay-api ko 100 requests.
# Har line: kitni baar | jawab ki body | HTTP code
kubectl exec deploy/sleep -c sleep -- sh -c '
  for i in $(seq 1 100); do
    curl -s -w " %{http_code}\\n" http://pay-api:8080/version
  done' | sort | uniq -c | sort -rn`;
  const IS_TLS = 'TLS_error:|268435703:SSL routines:OPENSSL_internal:WRONG_VERSION_NUMBER:TLS_error_end';
  const IS_DRK = ['host', 'trafficPolicy', 'subsets', 'exportTo', 'workloadSelector'];
  const isPods = c => {
    const v2 = c.v2Sidecar
      ? { name: 'pay-api-v2-7c2e9d-p3n8w', ready: '2/2', status: 'Running', restarts: 0, age: '9s', node: 'node-3', ip: '10.0.14.36', labels: { app: 'pay-api', version: 'v2' }, sidecar: true }
      : { name: 'pay-api-v2-9f4e1a-k7q2x', ready: '1/1', status: 'Running', restarts: 0, age: '2h', node: 'node-3', ip: '10.0.14.33', labels: { app: 'pay-api', version: 'v2' }, sidecar: false };
    v2.describe = `Name:             ${v2.name}
Namespace:        payments
Node:             node-3/10.0.14.5
Labels:           app=pay-api
                  version=v2
Annotations:      ${v2.sidecar ? 'istio.io/rev: default\n                  sidecar.istio.io/status: {"initContainers":["istio-init"],"containers":["istio-proxy"],"volumes":[...]}' : 'sidecar.istio.io/inject: false'}
Status:           Running
IP:               ${v2.ip}
Containers:
  pay-api:
    Image:          111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api:2.0.0-rc1
    Port:           8080/TCP
    State:          Running
    Ready:          True` + (v2.sidecar ? `
  istio-proxy:
    Image:          docker.io/istio/proxyv2:1.24.2
    State:          Running
    Ready:          True` : '');
    const v1 = ['a1', 'b2'].map((x, i) => ({ name: 'pay-api-v1-6b8d7c-' + x, ready: '2/2', status: 'Running', restarts: 0, age: '6d', node: NODES[i].name, ip: '10.0.1' + (2 + i) + '.21', labels: { app: 'pay-api', version: 'v1' }, sidecar: true }));
    return v1.concat([v2, { name: 'sleep-5d7c8b-x1m9t', ready: '2/2', status: 'Running', restarts: 0, age: '30d', node: 'node-1', ip: '10.0.12.40', labels: { app: 'sleep' }, sidecar: true }]);
  };
  // ek destination (subset) ka nateeja: ok / NC / UH / TLS / PLAIN
  function isOutcome(c, subset) {
    const sub = c.dr.subsets[subset];
    if (!sub) return { code: 503, flag: 'NC', detail: 'cluster_not_found', body: '' };
    const eps = c.pods.filter(p => p.labels.app === 'pay-api' && Object.keys(sub).every(k => p.labels[k] === String(sub[k])));
    if (!eps.length) return { code: 503, flag: 'UH', detail: 'no_healthy_upstream', body: 'no healthy upstream' };
    const p = eps[0];
    const mode = c.dr.tls;   // null = auto mTLS
    if (mode === 'ISTIO_MUTUAL' && !p.sidecar) return { code: 503, flag: 'UF,URX', detail: `upstream_reset_before_response_started{remote_connection_failure|${IS_TLS}}`, body: `upstream connect error or disconnect/reset before headers. retried and the latest reset reason: remote connection failure, transport failure reason: ${IS_TLS}`, ep: p };
    if ((mode === 'DISABLE' || mode === 'SIMPLE') && p.sidecar) return { code: 503, flag: 'UC,URX', detail: 'upstream_reset_before_response_started{connection_termination}', body: 'upstream connect error or disconnect/reset before headers. retried and the latest reset reason: connection termination', ep: p };
    return { code: 200, body: p.labels.version, ep: p };
  }
  function isTraffic(c) {
    const jitter = [1, -1, 0, 2, -2][(c.runs || 0) % 5];
    const routes = c.vs.slice();
    const counts = {};
    let left = 100;
    routes.forEach((r, i) => {
      let n = i === routes.length - 1 ? left : Math.round(r.weight + (i === 0 ? jitter : 0));
      n = Math.max(0, Math.min(left, n)); left -= n;
      const o = isOutcome(c, r.subset), key = `${o.body} ${o.code}`;
      counts[key] = (counts[key] || 0) + n;
    });
    return Object.keys(counts).filter(k => counts[k]).sort((a, b) => counts[b] - counts[a]).map(k => String(counts[k]).padStart(7) + ' ' + k).join('\n');
  }
  const isFails = c => c.vs.some(r => isOutcome(c, r.subset).code !== 200);
  function isAccessLog(c) {
    const rid = ['6c1d3b2a-9e4f-4a8b', 'a7d2c91e-4b3f-4c1e', '3e9b1c5a-7d2f-4b8e', 'f1b9e2c4-6a3d-4f7a'];
    const lines = [];
    c.vs.forEach((r, i) => {
      const o = isOutcome(c, r.subset), cl = `outbound|8080|${r.subset}|pay-api.payments.svc.cluster.local`;
      const up = o.ep ? `"${o.ep.ip}:8080" ${cl}` : `"-" ${o.flag === 'NC' ? '-' : cl}`;
      lines.push(`[2026-11-24T05:52:0${i + 1}.118Z] "GET /version HTTP/1.1" ${o.code} ${o.flag || '-'} ${o.code === 200 ? 'via_upstream' : o.detail} - "-" 0 ${o.body.length} ${o.code === 200 ? 3 : 12} ${o.code === 200 ? 2 : '-'} "-" "curl/8.5.0" "${rid[i % 4]}-b7c1-2f5e8d9a0c41" "pay-api:8080" ${up} ${o.ep ? '10.0.12.40:42110' : '-'} 10.100.71.3:8080 10.0.12.40:5123${i} - default`);
    });
    return lines.join('\n');
  }
  function isAnalyze(c, ns) {
    if (ns !== 'payments') return `✔ No validation issues found when analyzing namespace: ${ns}.`;
    const out = [];
    c.vs.forEach(r => { if (!c.dr.subsets[r.subset]) out.push(`Error [IST0101] (VirtualService payments/pay-api) Referenced host+subset in destinationrule not found: "pay-api+${r.subset}"`); });
    c.pods.filter(p => !p.sidecar).forEach(p => out.push(`Warning [IST0103] (Pod payments/${p.name}) The pod payments/${p.name} is missing the Istio proxy. This can often be resolved by restarting or redeploying the workload.`));
    if (!out.length) return '✔ No validation issues found when analyzing namespace: payments.';
    return out.join('\n') + (out.some(l => /^Error/.test(l)) ? '\nError: Analyzers found issues when analyzing namespace: payments.\nSee https://istio.io/v1.24/docs/reference/config/analysis for more information about causes and resolutions.' : '');
  }
  const isBad = (kind, file, msg) => ({ err: `Error from server (BadRequest): error when patching "${file}": ${kind} in version "v1" cannot be handled as a ${kind}: ${msg}` });
  const isWebhook = (file, msg) => ({ err: `Error from server: error when applying patch:\n...\nfor: "${file}": error when patching "${file}": admission webhook "validation.istio.io" denied the request: configuration is invalid: ${msg}` });
  const T_IS = [
    { text: 'Traffic test chalao: <code>bash test-traffic.sh</code> — 100 mein se kitne fail?', check: s => !!s.cluster.tested },
    { text: 'Istio se poochho: <code>istioctl analyze -n payments</code>', check: s => !!s.cluster.analyzed },
    { text: 'DestinationRule mein subset <code>v2</code> jodo — v2 pod tak raasta bane', check: s => !!s.cluster.dr.subsets.v2 && isOutcome(s.cluster, 'v2').flag !== 'NC' && isOutcome(s.cluster, 'v2').flag !== 'UH' },
    { text: 'v2 pod ko mesh mein lao — sidecar ke saath (<b>READY 2/2</b>)', check: s => !!s.cluster.v2Sidecar },
    { text: '<code>bash test-traffic.sh</code> dobara — <b>0 fail</b>, ~10% v2', check: s => !!s.cluster.cleanRun && !isFails(s.cluster) && s.cluster.v2Sidecar },
  ];
  addLab('istio', {
    type: 'terminal',
    title: '🖥️ Mission: canary 10% — aur woh 10% sab 503',
    instructions: 'ChaiPay ka payments namespace Istio mesh mein hai: har pod ke saath Envoy sidecar, aur pods aapas mein mTLS se baat karte hain (PeerAuthentication: STRICT). Neha pay-api v2 (naya UPI flow) ko canary chala rahi hai — VirtualService ne 90% traffic v1 aur 10% v2 ko bheja. Tab se lagbhag 10% payments 503 de rahe hain. Neha ki files: pay-api-vs.yaml, pay-api-dr.yaml, pay-api-v2-deploy.yaml.',
    goal: `Canary theek karo: 100 requests mein <b>0 fail</b>, lagbhag <b>10% v2</b> — aur v2 bhi mesh ke andar (sidecar + mTLS), bahar nahi.
      Jaanch ke tool: <code>bash test-traffic.sh</code>, <code>istioctl analyze -n payments</code>, sleep pod ke Envoy ka access log (<code>kubectl logs deploy/sleep -c istio-proxy</code>).`,
    tasks: T_IS,
    cluster: (() => {
      const c = { vs: [{ subset: 'v1', weight: 90 }, { subset: 'v2', weight: 10 }], dr: { tls: 'ISTIO_MUTUAL', subsets: { v1: { version: 'v1' } } }, v2Sidecar: false, runs: 0,
        vsText: IS_VS, drText: IS_DR, nodes: NODES,
        deployments: [{ name: 'pay-api-v1', ready: '2/2', upToDate: 2, available: 2, age: '6d' }, { name: 'pay-api-v2', ready: '1/1', upToDate: 1, available: 1, age: '2h' }, { name: 'sleep', ready: '1/1', upToDate: 1, available: 1, age: '30d' }],
        services: [{ name: 'pay-api', type: 'ClusterIP', clusterIP: '10.100.71.3', ports: '8080/TCP', age: '40d' }] };
      c.pods = isPods(c);
      return c;
    })(),
    responses: [
      { re: /^istioctl (?:analyze|x analyze)\b.*$/,
        out: (s, m) => { const ns = (String((m && m[0]) || '').match(/(?:-n|--namespace)[ =](\S+)/) || [])[1] || (/-A\b|--all-namespaces/.test(String(m && m[0])) ? 'payments' : 'default'); if (ns === 'payments') s.cluster.analyzed = true; return isAnalyze(s.cluster, ns); } },
      { re: /^istioctl (?:proxy-config|pc) (?:cluster|clusters) \S+.*$/,
        out: s => tbl([['SERVICE FQDN', 'PORT', 'SUBSET', 'DIRECTION', 'TYPE', 'DESTINATION RULE'], ['pay-api.payments.svc.cluster.local', '8080', '-', 'outbound', 'EDS', 'pay-api.payments']]
          .concat(Object.keys(s.cluster.dr.subsets).map(n => ['pay-api.payments.svc.cluster.local', '8080', n, 'outbound', 'EDS', 'pay-api.payments']))) + '\n(simulator: sirf pay-api ke clusters dikhaye)' },
      { re: /^istioctl (?:proxy-status|ps)\b.*$/,
        out: s => tbl([['NAME', 'CLUSTER', 'CDS', 'LDS', 'EDS', 'RDS', 'ECDS', 'ISTIOD', 'VERSION']].concat(s.cluster.pods.filter(p => p.sidecar).map(p => [p.name + '.payments', 'Kubernetes', 'SYNCED', 'SYNCED', 'SYNCED', 'SYNCED', 'IGNORED', 'istiod-7f6d8b9c4-tq2lw', '1.24.2']))) + (s.cluster.v2Sidecar ? '' : '\n(pay-api-v2 list mein nahi — uske paas Envoy hai hi nahi)') },
      { re: /^istioctl\b.*$/, err: true, out: '(simulator: is mission mein istioctl analyze, proxy-config cluster, proxy-status chalte hain)' },
      { re: /^kubectl logs\b.*sleep.*-c istio-proxy\b.*$|^kubectl logs\b.*-c istio-proxy\b.*sleep.*$/, out: s => isAccessLog(s.cluster) },
      { re: rx('kubectl get (?:vs|virtualservices?)(?:[ /]pay-api)? -o ?yaml'), out: s => s.cluster.vsText },
      { re: rx('kubectl get (?:dr|destinationrules?)(?:[ /]pay-api)? -o ?yaml'), out: s => s.cluster.drText },
      { re: rx('kubectl get (?:vs|virtualservices?)(?:[ /]pay-api)?'), out: tbl([['NAME', 'GATEWAYS', 'HOSTS', 'AGE'], ['pay-api', '', '["pay-api"]', '2h']]) },
      { re: rx('kubectl get (?:dr|destinationrules?)(?:[ /]pay-api)?'), out: tbl([['NAME', 'HOST', 'AGE'], ['pay-api', 'pay-api', '40d']]) },
      { re: rx('kubectl get (?:pa|peerauthentications?)(?:[ /]default)?'), out: tbl([['NAME', 'MODE', 'AGE'], ['default', 'STRICT', '90d']]) },
      { re: /^kubectl get (?:ns|namespaces?)(?:[ /]payments)?\b.*(--show-labels|-L).*$/, out: tbl([['NAME', 'STATUS', 'AGE', 'LABELS'], ['payments', 'Active', '412d', 'istio-injection=enabled,kubernetes.io/metadata.name=payments']]) },
      { re: /^kubectl get (?:pods?|po)\b.*--show-labels\b.*$/,
        out: s => tbl([['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE', 'LABELS']].concat(s.cluster.pods.map(p => [p.name, p.ready, p.status, '0', p.age, Object.entries(p.labels).map(([k, v]) => k + '=' + v).join(',')]))) },
    ],
    files: {
      'test-traffic.sh': { desc: 'sleep pod se pay-api ko 100 requests (jawab gin kar)', content: IS_SH,
        apply: s => { const c = s.cluster; c.tested = true; c.runs = (c.runs || 0) + 1; if (!isFails(c) && c.v2Sidecar) c.cleanRun = true; return isTraffic(c); } },
      'pay-api-vs.yaml': {
        editable: true, desc: 'VirtualService — 90/10 traffic split (Neha)', content: IS_VS,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {}, F = 'pay-api-vs.yaml';
          if (d.kind !== 'VirtualService' || (d.metadata || {}).name !== 'pay-api') return { err: '(simulator ne roka) is file mein VirtualService "pay-api" hi rehna chahiye.' };
          const http = ((d.spec || {}).http || [])[0] || {};
          const uk = Object.keys(d.spec || {}).find(k => !['hosts', 'http', 'gateways', 'tcp', 'tls', 'exportTo'].includes(k));
          if (uk) return isBad('VirtualService', F, `strict decoding error: unknown field "spec.${uk}"`);
          const routes = http.route || [];
          for (let i = 0; i < routes.length; i++) {
            const rk = Object.keys(routes[i] || {}).find(k => !['destination', 'weight', 'headers'].includes(k));
            if (rk) return isBad('VirtualService', F, `strict decoding error: unknown field "spec.http[0].route[${i}].${rk}"`);
            if (routes[i].weight != null && typeof routes[i].weight !== 'number') return isBad('VirtualService', F, `json: cannot unmarshal string into Go struct field HTTPRouteDestination.spec.http.route.weight of type int32`);
            if ((routes[i].weight || 0) < 0) return isWebhook(F, `weight ${routes[i].weight} < 0`);
          }
          if (!routes.length) return isWebhook(F, 'HTTP route is required');
          const total = routes.reduce((a, r) => a + (r.weight || 0), 0);
          if (routes.length > 1 && total !== 100) return isWebhook(F, `total destination weight ${total} != 100`);
          if (routes.some(r => ((r.destination || {}).host) !== 'pay-api')) return { err: '(simulator ne roka) destination host pay-api hi rakho.' };
          const vs = routes.map(r => ({ subset: (r.destination || {}).subset || 'v1', weight: routes.length === 1 ? 100 : r.weight || 0 }));
          if (!vs.some(r => r.subset === 'v2' && r.weight > 0)) return { err: '(simulator ne roka) v2 ka traffic 0 karna = canary band karna. Woh jaldi ka ilaaj hai — mission mein canary CHALANA hai: 10% v2, bina 503.' };
          if (JSON.stringify(vs) === JSON.stringify(c.vs)) return 'virtualservice.networking.istio.io/pay-api unchanged';
          c.vs = vs; c.vsText = text; c.cleanRun = false;
          return 'virtualservice.networking.istio.io/pay-api configured';
        },
      },
      'pay-api-dr.yaml': {
        editable: true, desc: 'DestinationRule — subsets + mTLS (Neha)', content: IS_DR,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {}, F = 'pay-api-dr.yaml', sp = d.spec || {};
          if (d.kind !== 'DestinationRule' || (d.metadata || {}).name !== 'pay-api') return { err: '(simulator ne roka) is file mein DestinationRule "pay-api" hi rehna chahiye.' };
          const uk = Object.keys(sp).find(k => !IS_DRK.includes(k));
          if (uk) return isBad('DestinationRule', F, `strict decoding error: unknown field "spec.${uk}"`);
          const subs = sp.subsets || [];
          if (!Array.isArray(subs)) return isBad('DestinationRule', F, 'json: cannot unmarshal object into Go struct field DestinationRule.spec.subsets of type []*v1.Subset');
          const map = {};
          for (let i = 0; i < subs.length; i++) {
            const sk = Object.keys(subs[i] || {}).find(k => !['name', 'labels', 'trafficPolicy'].includes(k));
            if (sk) return isBad('DestinationRule', F, `strict decoding error: unknown field "spec.subsets[${i}].${sk}"` + (sk === 'label' ? '\n(field ka naam "labels" hai)' : ''));
            if (!subs[i].name) return isWebhook(F, 'subset name is invalid: ""');
            if (map[subs[i].name]) return isWebhook(F, `duplicate subset names: ${subs[i].name}`);
            map[subs[i].name] = Object.assign({}, subs[i].labels || {});
          }
          const tls = (((sp.trafficPolicy || {}).tls) || {}).mode;
          const MODES = ['DISABLE', 'SIMPLE', 'MUTUAL', 'ISTIO_MUTUAL', 'OPTIONAL_MUTUAL'];
          if (tls != null && !MODES.includes(tls)) return { err: `The DestinationRule "pay-api" is invalid: spec.trafficPolicy.tls.mode: Unsupported value: "${tls}": supported values: ${MODES.map(x => `"${x}"`).join(', ')}` };
          const next = { tls: tls || null, subsets: map };
          if (JSON.stringify(next) === JSON.stringify(c.dr)) return 'destinationrule.networking.istio.io/pay-api unchanged';
          c.dr = next; c.drText = text; c.cleanRun = false;
          return 'destinationrule.networking.istio.io/pay-api configured' + (tls !== 'ISTIO_MUTUAL' ? '\n(Dhyan do: ISTIO_MUTUAL hata diya — security team ka niyam tha ki pay-api tak traffic mTLS se jaaye.)' : '');
        },
      },
      'pay-api-v2-deploy.yaml': {
        editable: true, desc: 'pay-api v2 ka Deployment (canary)', content: IS_V2,
        apply: (s, text, docs) => {
          const c = s.cluster, d = (docs || [])[0] || {}, F = 'pay-api-v2-deploy.yaml';
          if (d.kind !== 'Deployment' || (d.metadata || {}).name !== 'pay-api-v2') return { err: '(simulator ne roka) is file mein Deployment "pay-api-v2" hi rehna chahiye.' };
          const sel = ((d.spec || {}).selector || {}).matchLabels || {};
          if (sel.app !== 'pay-api' || sel.version !== 'v2' || Object.keys(sel).length !== 2) return { err: `The Deployment "pay-api-v2" is invalid: spec.selector: Invalid value: v1.LabelSelector{MatchLabels:map[string]string{${Object.keys(sel).map(k => `"${k}":"${sel[k]}"`).join(', ')}}, MatchExpressions:[]v1.LabelSelectorRequirement(nil)}: field is immutable` };
          const tm = ((d.spec || {}).template || {}).metadata || {}, ann = tm.annotations || {}, lab = tm.labels || {};
          const badAnn = Object.keys(ann).find(k => typeof ann[k] !== 'string');
          if (badAnn) return { err: `Error from server (BadRequest): error when patching "${F}": Deployment in version "v1" cannot be handled as a Deployment: json: cannot unmarshal ${typeof ann[badAnn] === 'boolean' ? 'bool' : 'number'} into Go struct field ObjectMeta.spec.template.metadata.annotations of type string\n(annotation ki value string hoti hai — "true" quotes mein)` };
          if (lab.app !== 'pay-api' || lab.version !== 'v2') return { err: '`selector` does not match template `labels` — labels app: pay-api, version: v2 rehne do.' };
          const img = ((((d.spec || {}).template || {}).spec || {}).containers || [{}])[0].image;
          if (img !== '111122223333.dkr.ecr.ap-south-1.amazonaws.com/pay-api:2.0.0-rc1') return { err: '(simulator ne roka) image mat badlo — sirf sidecar wali annotation.' };
          const inj = ann['sidecar.istio.io/inject'] == null ? (lab['sidecar.istio.io/inject'] || 'true') : ann['sidecar.istio.io/inject'];
          const want = String(inj) !== 'false';
          if (want === c.v2Sidecar) return 'deployment.apps/pay-api-v2 unchanged';
          c.v2Sidecar = want; c.pods = isPods(c); c.cleanRun = false;
          return 'deployment.apps/pay-api-v2 configured' + (want ? '\n(naya pod: istio-sidecar-injector webhook ne Envoy container joda — kubectl get pods)' : '');
        },
      },
    },
    success: KG.allOf(T_IS),
    successText: `<b>Galti 1 — subset nahi tha:</b> VirtualService ne 10% ko <code>subset: v2</code> bheja, par DestinationRule mein sirf v1 tha. Envoy ke paas <code>outbound|8080|v2|…</code> naam ka cluster hi nahi →
      <code>503 NC cluster_not_found</code>. <code>istioctl analyze</code> ne turant bataya (IST0101). <b>Niyam:</b> pehle DestinationRule (subsets), phir VirtualService.<br>
      <b>Galti 2 — sidecar band:</b> DR <code>ISTIO_MUTUAL</code> kehta hai: "har pod se TLS mein baat karo". v2 mein Envoy tha hi nahi — app ne seedha HTTP suna, TLS ka hello samajh nahi aaya → <code>WRONG_VERSION_NUMBER</code>.
      DR se mTLS hata dena "chal" jaata, par v2 mesh se bahar rehta (na mTLS, na metrics). Sahi ilaaj: v2 ko mesh mein laao.<br>
      <b>Debug kram:</b> traffic test → <code>istioctl analyze</code> → Envoy access log ka <b>response flag</b> (NC = cluster nahi, UH = healthy pod nahi, UF = connection fail) → <code>proxy-config cluster</code>.`,
    hints: [
      'bash test-traffic.sh — 503 kitne? Phir istioctl analyze -n payments (namespace zaroor do). IST0101 kya bolta hai?',
      'vi pay-api-dr.yaml — subsets mein v1 ke neeche ek aur subset jodo: name: v2, labels: version: v2 (v1 jaisi indentation). Save, kubectl apply -f pay-api-dr.yaml, phir bash test-traffic.sh.',
      'Ab TLS_error / WRONG_VERSION_NUMBER? kubectl get pods — pay-api-v2 1/1 hai (Envoy nahi). vi pay-api-v2-deploy.yaml — sidecar.istio.io/inject: "false" ko "true" karo, Save, apply, phir bash test-traffic.sh.',
    ],
    solution: ['bash test-traffic.sh', 'istioctl analyze -n payments',
      { edit: 'pay-api-dr.yaml', change: [['  - name: v1\n    labels:\n      version: v1\n', '  - name: v1\n    labels:\n      version: v1\n  - name: v2\n    labels:\n      version: v2\n']] },
      'kubectl apply -f pay-api-dr.yaml', 'bash test-traffic.sh', 'kubectl get pods',
      { edit: 'pay-api-v2-deploy.yaml', change: [['sidecar.istio.io/inject: "false"   # debug ke liye band kiya tha', 'sidecar.istio.io/inject: "true"']] },
      'kubectl apply -f pay-api-v2-deploy.yaml', 'bash test-traffic.sh'],
  }, {
    objectives: ['🖥️ <b>Mission:</b> canary ke 503 — DestinationRule ka gayab subset aur sidecar ke bina mTLS; <code>istioctl analyze</code> aur Envoy response flags se jaanch'],
    success: ['Main canary ke 503 ko istioctl analyze aur Envoy access log ke flags (NC / UH / UF) se pakad kar theek kar sakta hoon'],
    cards: [
      { front: 'Envoy access log mein <code>503 NC cluster_not_found</code> — sabse pehle kya dekho?', back: 'VirtualService jis <b>subset</b> ko bhejta hai, woh DestinationRule mein hai ya nahi. <code>istioctl analyze</code> → IST0101. Pehle DR (subsets), phir VS.' },
      { front: 'DR mein <code>tls.mode: ISTIO_MUTUAL</code>, par target pod 1/1 (sidecar nahi) — kya hoga?', back: 'Client Envoy TLS bhejta hai, app plain HTTP samajhti hai → <code>TLS_error … WRONG_VERSION_NUMBER</code>, 503 <code>UF</code>. Pod ko mesh mein lao (sidecar inject), mTLS mat hatao.' },
    ],
  });

  /* =====================================================================
     ⚡ kubectl Speed Drills (drill.js) — haath ki yaaddasht: sawal padho,
     command type karo. Teen drills: pod, deploy (rollout), kk-toolkit.
     ===================================================================== */
  const P1 = 'pay-api-6b8d7c-a1';
  addLab('pod', {
    type: 'drill', id: 'drill-pod', title: '⚡ Speed Drill: pod ki jaanch ke 8 commands', par: 110,
    intro: 'ChaiPay ke <code>payments</code> namespace mein pay-api ke pods chal rahe hain (jaise <code>' + P1 + '</code>). Har sawal ka command type karo — jitna tez, utna achha.',
    items: [
      { ask: 'Saare pods — unka <b>IP aur NODE</b> bhi dikhe', answers: ['kubectl get pods -o wide'], explain: '<code>-o wide</code> do column jodta hai: IP aur NODE.' },
      { ask: 'Sirf <code>pay-api</code> ke pods (label <code>app=pay-api</code>)', answers: ['kubectl get pods -l app=pay-api'], explain: '<code>-l</code> = label selector. Service bhi isi tarah pods chunti hai.' },
      { ask: 'Pod <code>' + P1 + '</code> ka poora haal — <b>Events</b> samet', answers: ['kubectl describe pod ' + P1], explain: 'Pending ya CrashLoop mein sabse pehle describe ke Events padho.' },
      { ask: '<code>' + P1 + '</code> ke logs — sirf <b>aakhri 50</b> lines', answers: ['kubectl logs ' + P1 + ' --tail=50'], explain: '<code>--tail=N</code> lambe logs mein se sirf aakhri N lines.' },
      { ask: 'Container crash hokar restart hua — <b>pichhli</b> run ke logs (<code>' + P1 + '</code>)', answers: ['kubectl logs ' + P1 + ' --previous'], explain: '<code>--previous</code> (ya <code>-p</code>) = mare hue container ke logs. Crash ki wajah wahin hoti hai.' },
      { ask: 'Pod <code>' + P1 + '</code> ke andar env variable <code>UPI_TIMEOUT_MS</code> ki value', answers: ['kubectl exec ' + P1 + ' -- printenv UPI_TIMEOUT_MS', 'kubectl exec ' + P1 + ' -- env | grep UPI_TIMEOUT_MS'], explain: '<code>--</code> ke baad wala command pod ke andar chalta hai.' },
      { ask: 'Namespace ke events — <b>time ke hisaab se sort</b> (naye sabse neeche)', answers: ['kubectl get events --sort-by=.lastTimestamp', 'kubectl get events --sort-by=.metadata.creationTimestamp'], explain: 'Bina sort ke events ulte-seedhe aate hain. <code>--sort-by=.lastTimestamp</code> kahani ko kram mein rakhta hai.' },
      { ask: 'Pods ki list <b>live</b> dekhte raho — badlaav aate hi nayi line aaye', answers: ['kubectl get pods -w'], explain: '<code>-w</code> (<code>--watch</code>) band nahi hota — Ctrl+C se roko.' },
    ],
  }, {
    objectives: ['⚡ <b>Speed drill:</b> pod ki jaanch ke 8 commands bina soche type karna'],
    success: ['Main pod debug karne ke 8 commands yaad se, tez type kar sakta hoon'],
    cards: [{ front: 'Crash hue container ke logs kaise dekhte ho?', back: '<code>kubectl logs &lt;pod&gt; --previous</code> (ya <code>-p</code>). Bina <code>--previous</code> naye (abhi chal rahe) container ke logs aate hain.' }],
  });
  addLab('deploy', {
    type: 'drill', id: 'drill-deploy', title: '⚡ Speed Drill: rollout ke 8 commands', par: 120,
    intro: 'Friday shaam, pay-api ka naya version. Rollout dekho, history padho, wapas jao, scale karo — sab type karke.',
    items: [
      { ask: '<code>pay-api</code> ka rollout poora hua? (jab tak na ho, rukkar dekhta rahe)', answers: ['kubectl rollout status deployment/pay-api'], explain: 'Rollout poora hone tak rukta hai — CI scripts mein bhi yahi.' },
      { ask: '<code>pay-api</code> ki rollout <b>history</b> (revisions)', answers: ['kubectl rollout history deployment/pay-api'], explain: 'Har revision = ek ReplicaSet. <code>--revision=N</code> se us revision ka template.' },
      { ask: 'Naya version kharab — <b>pichhle</b> version par wapas', answers: ['kubectl rollout undo deployment/pay-api'], explain: 'Turant rahat. Baad mein git ki file bhi theek karo, warna agla deploy phir wahi laayega.' },
      { ask: 'Seedha <b>revision 3</b> par wapas', answers: ['kubectl rollout undo deployment/pay-api --to-revision=3'], explain: '<code>--to-revision</code> ke bina hamesha sirf ek kadam peeche.' },
      { ask: 'Sale ke liye abhi turant <b>5 replicas</b>', answers: ['kubectl scale deployment/pay-api --replicas=5'], explain: 'Jaldi ka ilaaj. Git ki file mein bhi replicas badlo, warna agla apply wapas kar dega (drift).' },
      { ask: 'Container <code>pay-api</code> ka image <code>pay-api:1.9.0</code> karo', answers: ['kubectl set image deployment/pay-api pay-api=pay-api:1.9.0'], explain: 'Format: <code>&lt;container&gt;=&lt;image&gt;</code>. Naya rollout shuru hota hai.' },
      { ask: 'Image wahi, par saare pods <b>naye sire se</b> (ConfigMap dobara padhne ke liye)', answers: ['kubectl rollout restart deployment/pay-api'], explain: 'Template mein ek annotation (restartedAt) badalta hai → rolling update, bina downtime.' },
      { ask: '<code>pay-api</code> ke ReplicaSets dekho — purane bhi (label <code>app=pay-api</code>)', answers: ['kubectl get rs -l app=pay-api'], explain: 'Purane ReplicaSets 0 replicas par rakhe jaate hain — undo inhi se hota hai.' },
    ],
  }, {
    objectives: ['⚡ <b>Speed drill:</b> rollout status / history / undo / scale / set image — type karke'],
    success: ['Main rollout ke 8 commands yaad se, tez type kar sakta hoon'],
    cards: [{ front: 'Sirf ek kadam nahi, seedha revision 3 par wapas kaise jaate ho?', back: '<code>kubectl rollout undo deployment/pay-api --to-revision=3</code>. Revisions: <code>kubectl rollout history deployment/pay-api</code>.' }],
  });
  addLab('kk-toolkit', {
    type: 'drill', id: 'drill-toolkit', title: '⚡ Speed Drill: debugging toolkit ke 8 commands', par: 130,
    intro: 'Incident ke beech yeh commands bina soche niklne chahiye: kaun kya kar sakta hai, kaun memory kha raha hai, kaun Running nahi, node kaise khaali karein.',
    items: [
      { ask: 'Service account <code>notify</code> (namespace <code>payments</code>) kya <b>secrets padh</b> sakta hai?', answers: ['kubectl auth can-i get secrets --as=system:serviceaccount:payments:notify', 'kubectl auth can-i list secrets --as=system:serviceaccount:payments:notify'], explain: '<code>--as</code> se kisi aur ki nazar se poochho. Jawab bas <code>yes</code> / <code>no</code>.' },
      { ask: 'Sabse zyada <b>memory</b> khaane wale pods sabse upar', answers: ['kubectl top pods --sort-by=memory'], explain: 'metrics-server chahiye. <code>--sort-by=cpu</code> bhi chalta hai.' },
      { ask: 'Poore cluster mein woh pods jo <b>Running nahi</b> hain', answers: ['kubectl get pods -A --field-selector=status.phase!=Running'], explain: '<code>-A</code> = saare namespaces. <code>--field-selector</code> server par hi filter karta hai.' },
      { ask: '<code>pay-api</code> Service (port 8080) ko apne laptop ke port 8080 par lao', answers: ['kubectl port-forward svc/pay-api 8080:8080', 'kubectl port-forward svc/pay-api 8080'], explain: 'Format <code>local:remote</code>. Ingress / LB ke bina seedha test.' },
      { ask: 'Deployment ke <code>spec.strategy</code> field ka matlab — docs, terminal mein hi', answers: ['kubectl explain deployment.spec.strategy', 'kubectl explain deploy.spec.strategy'], explain: '<code>kubectl explain</code> cluster ke apne schema se padhta hai — version ke hisaab se sahi.' },
      { ask: '<code>node-2</code> par <b>naye</b> pods mat bhejo (maintenance se pehle)', answers: ['kubectl cordon node-2'], explain: 'Chal rahe pods rehte hain; sirf naye nahi aate. Wapas: <code>kubectl uncordon node-2</code>.' },
      { ask: '<code>node-2</code> khaali karo — DaemonSet ke pods chhod kar', answers: ['kubectl drain node-2 --ignore-daemonsets', 'kubectl drain node-2 --ignore-daemonsets --delete-emptydir-data'], explain: 'drain = cordon + pods ko PDB ka dhyan rakhte hue nikaalna.' },
      { ask: '<code>pay-api</code> Service ke peeche kaun se <b>pod IP</b> hain?', answers: ['kubectl get endpoints pay-api', 'kubectl get endpointslices -l kubernetes.io/service-name=pay-api'], explain: 'Khaali endpoints = selector kisi Ready pod se match nahi karta.' },
    ],
  }, {
    objectives: ['⚡ <b>Speed drill:</b> can-i, top, field-selector, port-forward, explain, cordon/drain, endpoints — type karke'],
    success: ['Main incident ke 8 toolkit commands yaad se, tez type kar sakta hoon'],
    cards: [{ front: 'Kisi service account ki permission bina uska token liye kaise jaanchte ho?', back: '<code>kubectl auth can-i get secrets --as=system:serviceaccount:&lt;ns&gt;:&lt;sa&gt;</code> — jawab yes/no.' }],
  });

  /* =====================================================================
     🎲 Chaos rounds (chaos.js) — teeno boss levels mein: har baar naya,
     random breakage. Level ke hisaab se breakages ka pool.
     ===================================================================== */
  addLab('boss1', { type: 'chaos', id: 'chaos-beginner', level: 1, title: '🎲 Chaos Round: kya toota, khud dhoondho',
    intro: 'Beginner pool: image tag, Service selector, replicas, memory, ConfigMap key.' }, {
    objectives: ['🎲 <b>Chaos round:</b> random toota hua pay-api — bina bataye wajah dhoondho aur file theek karo'],
    success: ['Main bina hint ke STATUS → describe → logs ke kram se toota hua Deployment theek kar sakta hoon'],
    cards: [{ front: 'Pod ka STATUS dekh kar pehla shak? (Pending / ImagePullBackOff / CreateContainerConfigError / CrashLoopBackOff / 0/1)', back: 'Pending = scheduler (describe: FailedScheduling) · ImagePullBackOff = image/tag · CreateContainerConfigError = ConfigMap/Secret · CrashLoopBackOff = logs + Last State · Running 0/1 = readiness probe.' }],
  });
  addLab('boss2', { type: 'chaos', id: 'chaos-intermediate', level: 2, title: '🎲 Chaos Round: pre-sale chaos drill',
    intro: 'Intermediate pool: upar wale + CPU request, probes, targetPort, ConfigMap value, nodeSelector.' }, {
    objectives: ['🎲 <b>Chaos round:</b> probes, targetPort, scheduling — random breakage, khud pakdo'],
    success: ['Main "pods 1/1 par curl fail" aur "Running 0/1" jaisi chhupi galtiyan bhi pakad sakta hoon'],
    cards: [{ front: 'Pods 1/1 Running, endpoints bhi dikhte hain — phir bhi curl "Couldn\'t connect"?', back: 'Service ka <b>targetPort</b> dekho: endpoints kis port par hain (<code>kubectl get endpoints</code>) aur app kis port par sunti hai.' }],
  });
  addLab('boss3', { type: 'chaos', id: 'chaos-advanced', level: 3, title: '🎲 Chaos Round: senior on-call drill',
    intro: 'Advanced pool: sab 15 galtiyan — command, securityContext, ConfigMap naam, PORT env — aur kabhi do ek saath.' }, {
    objectives: ['🎲 <b>Chaos round:</b> 15 tarah ki galtiyan, kabhi do ek saath — senior ki tarah kram se jaancho'],
    success: ['Main ek saath do galtiyan bhi alag-alag pakad kar theek kar sakta hoon'],
    cards: [{ front: 'CrashLoopBackOff aur <code>kubectl logs</code> bilkul khaali — kya dekho?', back: '<code>kubectl describe pod</code> ka <b>Last State</b>: <code>StartError</code> (exit 128, command/binary galat) ya <code>OOMKilled</code> (exit 137). Process shuru hi nahi hua toh logs nahi hote.' }],
  });

  /* =====================================================================
     📟 On-call shift (oncall.js) — boss2 (Production Outage Night) mein:
     4 jude hue incidents, simulated ghadi, aakhir mein report card.
     ===================================================================== */
  addLab('boss2', { type: 'oncall', id: 'oncall-sale', title: '📟 On-call Shift: Diwali sale ki raat (4 alerts)' }, {
    objectives: ['📟 <b>On-call shift:</b> 4 jude hue alerts ek ke baad ek — har fix ke baad pakka karo; aakhir mein MTTR wala report card'],
    success: ['Main ek raat ke jude hue incidents (crash → scaling → capacity → DB connections) kram se sambhal sakta hoon'],
    cards: [{ front: 'HPA max badhaya, phir DB "too many clients" — kyun?', back: 'Har pod apna connection pool kholta hai: <b>pods × pool</b> ≤ DB <code>max_connections</code> (minus reserved). Pool chhota karo aur <code>rollout restart</code> (env sirf start par padha jaata hai).' }],
  });

})();
