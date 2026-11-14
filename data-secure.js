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
            'list zyada surakshit hai kyunki list mein data base64 mein hota hai',
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

})();
