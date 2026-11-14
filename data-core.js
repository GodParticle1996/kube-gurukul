/* =====================================================================
   KubeGurukul — Ranks & Tracks
   Naya track add karna ho? Yahan ek entry + ek nayi data-<track>.js file.
   ===================================================================== */

const RANKS = [
  { xp: 0,    name: 'Pod Shishya',        icon: '🐣' },
  { xp: 200,  name: 'Container Chela',    icon: '📦' },
  { xp: 450,  name: 'Deployment Dost',    icon: '🚀' },
  { xp: 750,  name: 'Service Sevak',      icon: '📞' },
  { xp: 1100, name: 'Cluster Sadhak',     icon: '🧘' },
  { xp: 1500, name: 'Scheduler Siddha',   icon: '⚖️' },
  { xp: 1950, name: 'Ingress Acharya',    icon: '🚪' },
  { xp: 2450, name: 'RBAC Rakshak',       icon: '🔐' },
  { xp: 3000, name: 'Helm Hakim',         icon: '⛵' },
  { xp: 3600, name: 'GitOps Guru',        icon: '🔄' },
  { xp: 4300, name: 'Triage Tantrik',     icon: '🩺' },
  { xp: 5100, name: 'Kavach Karta',       icon: '🛡️' },
  { xp: 6000, name: 'Kubernetes Mahaguru', icon: '👑' },
];

/* Tracks sequentially unlock hote hain: Beginner → Intermediate → Advanced.
   Sirf `alwaysUnlocked: true` wale side-tracks (jaise Helm) kabhi bhi khel sakte ho.
   `levels` lazily resolve hote hain KG.levelSets se (data-*.js bharti hain). */
/* Home screen par tracks in groups mein dikhte hain (isi kram mein). Har track ka `group` yahan ki ek id hai.
   Naya group = yahan ek entry. Naye track mein `group` na do toh woh pehle group mein jaata hai. */
KG.trackGroups = [
  { id: 'main',     title: '🛤️ Mukhya raasta — isi kram mein',
    sub: 'Beginner → Intermediate → Advanced. Har track pichhla track poora hone par khulta hai.' },
  { id: 'scenario', title: '🩺 Scenario practice — toota hua cluster theek karo',
    sub: 'Beginner track ke baad kabhi bhi. Interview ke "yeh toota hai, kaise dhoondhoge?" sawaal yahin se aate hain.' },
  { id: 'prod',     title: '🏭 Production skills — naukri mein roz ka kaam',
    sub: 'Kabhi bhi khelo (Beginner ke baad behtar). Har level ek asli production scenario hai: debug, upgrade, security, monitoring, EKS networking.' },
  { id: 'tools',    title: '🧰 Tools — Helm, ArgoCD, Karpenter',
    sub: 'Kabhi bhi khelo. Har track ek tool ko asli terminal ke saath sikhata hai.' },
];

KG.tracks = [
  {
    id: 'beginner',
    group: 'main',
    icon: '🌱',
    name: 'Beginner — Shishya Path',
    blurb: 'Docker se Kubernetes tak ka safar — cluster architecture (API Server, etcd, Scheduler…), Pods, Deployments, Services, ConfigMaps. Yahan se shuruaat!',
    certTitle: 'POD PANDIT',
    certSub: 'Certificate of Kubernetes Foundations',
    motto: 'Desired state batao, Kubernetes usse nibhayega.',
    formula: 'Cluster = Control Plane (dimaag) + Worker Nodes (haath)',
  },
  {
    id: 'intermediate',
    group: 'main',
    icon: '🔥',
    name: 'Intermediate — Sadhak Path',
    blurb: 'Production ki asli duniya — Scheduler, QoS & evictions, Probes, StatefulSets, Storage, Ingress, NetworkPolicies, Autoscaling. Jahan outages hote hain, wahan ke hathiyaar.',
    certTitle: 'CLUSTER SADHAK',
    certSub: 'Certificate of Production Readiness',
    motto: 'Requests set karo, limits samjho — warna OOMKilled milega.',
    formula: 'Reliability = Probes + Requests/Limits + PodAntiAffinity',
  },
  {
    id: 'advanced',
    group: 'main',
    icon: '🚀',
    name: 'Advanced — Guru Path',
    blurb: 'Senior engineer ka shastra — RBAC, Pod Security, Vault/ESO, Prometheus/Grafana, Helm & Kustomize, Operators, ArgoCD GitOps, Istio service mesh.',
    certTitle: 'KUBERNETES MAHAGURU',
    certSub: 'Certificate of Cluster Mastery',
    motto: 'Git mein likho, cluster khud sync hoga. Laptop se kubectl apply ab band.',
    formula: 'Senior = Security (RBAC+PSA) + Observability + GitOps + Mesh',
  },
  {
    id: 'helm',
    group: 'tools',
    icon: '⛵',
    name: 'Helm Gurukul',
    blurb: 'Helm ka poora shastra — chart anatomy, templating jaadu, values ka khel, subcharts & umbrella, hooks/tests/rollback, aur chart publish + GitOps. Har level mein asli `helm` terminal!',
    certTitle: 'HELM HAKIM',
    certSub: 'Certificate of Chart Craftsmanship',
    motto: 'Chart likho ek baar, deploy karo har environment mein.',
    formula: 'Release = Chart (template) + Values (config) + Revision (history)',
    alwaysUnlocked: true,   // kabhi bhi khelo — Track 1 ka basic gyaan kaafi hai
  },
  {
    id: 'argocd',
    group: 'tools',
    icon: '🔄',
    name: 'ArgoCD Gurukul',
    blurb: 'GitOps ka poora shastra — Application, sync policies (prune/selfHeal), sync waves & hooks, App-of-Apps + ApplicationSets, Projects/RBAC, aur Argo Rollouts se canary. Asli `argocd` terminal ke saath!',
    certTitle: 'GITOPS GURU',
    certSub: 'Certificate of Declarative Delivery',
    motto: 'Cluster ko mat chhuo — git ko badlo, cluster khud sudhar jayega.',
    formula: 'Desired = Git · Actual = Cluster · ArgoCD = reconciliation loop',
    alwaysUnlocked: true,
  },
  {
    id: 'karpenter',
    group: 'tools',
    icon: '🌲',
    name: 'Karpenter Gurukul',
    blurb: 'EKS pe nodes ka asli khel — NodePool + EC2NodeClass, just-in-time provisioning, consolidation se paisa bachana, spot interruption, drift aur disruption budgets. Node controller live simulate hota hai!',
    certTitle: 'NODE NAWAB',
    certSub: 'Certificate of Compute Efficiency',
    motto: 'Pod ko jagah chahiye? Node abhi banega — aur khaali hote hi mit jayega.',
    formula: 'Pending pod → NodeClaim → EC2 → Node · khaali node → consolidation → 💰',
    alwaysUnlocked: true,
  },
  {
    id: 'day2',
    group: 'prod',
    icon: '🛠️',
    name: 'Day-2 Ops Gurukul',
    blurb: 'Deploy ho gaya — ab cluster ko mahinon tak zinda kaise rakhein? Bina shell wale container ko debug karna, requests/limits ka sahi naap, cluster upgrade bina outage ke, backup aur restore. Ek hi company (ChaiPay) ki kahani.',
    certTitle: 'CLUSTER KA DOCTOR',
    certSub: 'Certificate of Day-2 Operations',
    motto: 'Deploy karna Day-1 hai. Chalaye rakhna Day-2 hai — aur naukri Day-2 ki hoti hai.',
    formula: 'Day-2 = debug + sahi naap + upgrade + backup',
    alwaysUnlocked: true,
  },
  {
    id: 'kodekloud',
    group: 'scenario',
    icon: '🩺',
    name: 'KodeKloud Gurukul — Scenario Path',
    blurb: 'Sirf scenario. Har level ek toota hua cluster deta hai aur poochta hai: kya toota, kaise pata chala, ab kya karoge? ImagePullBackOff se lekar etcd restore aur seccomp tak — KodeKloud ke troubleshooting, CKA aur CKS scenarios se banaya gaya.',
    certTitle: 'TRIAGE TANTRIK',
    certSub: 'Certificate of Cluster Diagnosis',
    motto: 'Pehle evidence, phir theory. Pod ka status batata hai KAHAN dekhna hai.',
    formula: 'Status → describe/events → logs → root cause → fix (guess kabhi nahi)',
    alwaysUnlocked: true,   // troubleshooting kabhi bhi kaam aata hai
  },
];
