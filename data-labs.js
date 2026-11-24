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

})();
