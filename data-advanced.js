/* =====================================================================
   KubeGurukul — Track 3: 🚀 Advanced (Guru Path)
   Senior engineer ka shastra: security, observability, packaging,
   operators, GitOps, service mesh.
   ===================================================================== */

KG.registerLevels('advanced', [

  /* ================= LEVEL 18: RBAC ================= */
  {
    id: 'rbac',
    icon: '🔐',
    title: 'RBAC — Kaun Kya Kar Sakta Hai',
    badge: 'RBAC Rakshak',
    objectives: [
      '<b>Role vs ClusterRole</b> — namespace-scoped vs cluster-scoped',
      'ServiceAccounts — apps ki identity (insaano ki nahi!)',
      'RoleBinding chain: identity → binding → permissions',
      '"Forbidden" errors ko debug karna + <code>kubectl auth can-i</code> (terminal!)',
    ],
    lesson: [
      `<h3>🔐 Teen sawal: kaun? kya? kahan?</h3>
       <p>API Server har request par poochta hai: <b>kaun ho</b> (authentication),
       <b>kya karna chahte ho</b> (verb+resource), <b>ijazat hai?</b> (RBAC). Building blocks:</p>
       <table>
         <tr><th>Object</th><th>Kya hai</th><th>Scope</th></tr>
         <tr><td>🤖 <b>ServiceAccount</b></td><td>App/pod ki identity (har pod ke paas ek hota hai — default se savdhan!)</td><td>Namespace</td></tr>
         <tr><td>📜 <b>Role</b></td><td>Permissions ki list: "pods par get/list/watch"</td><td><b>Ek namespace</b></td></tr>
         <tr><td>🌍 <b>ClusterRole</b></td><td>Wahi, par poore cluster ke liye (+ non-namespaced cheezein: nodes, PVs)</td><td><b>Poora cluster</b></td></tr>
         <tr><td>🔗 <b>RoleBinding</b></td><td>Identity ↔ Role ka jod ("is SA ko yeh Role do")</td><td>Namespace</td></tr>
         <tr><td>🔗 <b>ClusterRoleBinding</b></td><td>Identity ↔ ClusterRole, har jagah</td><td>Cluster</td></tr>
       </table>
       <pre># Chain hamesha yehi: Identity → Binding → Role
kubectl create serviceaccount app-sa
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding app-sa-reads \\
  --role=pod-reader --serviceaccount=default:app-sa</pre>`,
      `<h3>⚠️ Do golden rules (interview + audit dono mein)</h3>
       <ul>
         <li><b>Apps ko ServiceAccount se bandho, human users se kabhi nahi.</b> Insaan
         chhutti par jaate hain, chhod ke jaate hain — unke credentials se chalti app
         ek din achanak maregi (ya worse: unke saare rights ke saath chalegi).</li>
         <li><b>Least privilege:</b> jo chahiye bas wahi. "cluster-admin de do, kaam toh
         chal raha hai" = audit mein fail + breach mein poora cluster gaya.</li>
       </ul>
       <pre># Debugging ka Swiss knife:
kubectl auth can-i list pods --as=system:serviceaccount:default:app-sa
# yes/no — guessing khatam!</pre>
       <div class="war-story"><b>⚡ Real pattern (security audits ka #1 finding):</b> Ek
       startup mein CI/CD pipeline <code>cluster-admin</code> token se deploy karti thi
       ("shuru mein jaldi thi"). Pipeline ka ek plugin compromise hua — attacker ke paas
       ab PURA cluster tha: secrets, DBs, sab. Post-incident: har app/pipeline ka apna SA,
       namespace-scoped Roles, aur can-i se quarterly audit. <b>RBAC boring lagta hai jab
       tak breach na ho.</b></div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Role ya ClusterRole?',
        instructions: 'Har permission requirement ke liye sahi scope chuno.',
        bins: [
          { id: 'role', label: '📜 Role (namespace)' },
          { id: 'crole', label: '🌍 ClusterRole' },
        ],
        items: [
          { text: 'App apne NS ke ConfigMaps padhe', bin: 'role', explain: 'Ek namespace ki cheez = Role. 90% app permissions yahi hone chahiye — least privilege.' },
          { text: 'Monitoring agent SAARE namespaces ke pods dekhe', bin: 'crole', explain: 'Cross-namespace read = ClusterRole (+ ClusterRoleBinding). Prometheus jaise tools ka typical setup.' },
          { text: 'Nodes ki list dekhna', bin: 'crole', explain: 'Nodes namespaced hote hi nahi — inke liye ClusterRole HI lag sakta hai. (PVs bhi aise hi.)' },
          { text: 'CI pipeline sirf "shop" NS mein deploy kare', bin: 'role', explain: 'War-story ka fix! Pipeline ko uske namespace mein Deployment/Service verbs — cluster-admin kabhi nahi.' },
          { text: 'Ingress controller saare NS ke Ingress resources padhe', bin: 'crole', explain: 'Controller ka kaam hi cluster-wide watch hai — legitimate ClusterRole case. Har cheez Role mein nahi aati, judgement chahiye.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Forbidden ka Case',
        instructions: 'Ek app ke logs "Forbidden" se bhare hain. RBAC chain trace karke theek karo.',
        goal: '<b>reporter</b> pod pods ki list nahi le paa raha (403 Forbidden). <b>(1)</b> Logs dekho, <b>(2)</b> <code>kubectl auth can-i list pods --as=system:serviceaccount:default:reporter-sa</code> se confirm karo, <b>(3)</b> sahi fix apply karo.',
        tasks: [
          { text: 'reporter ke logs mein Forbidden dekho', check: s => s.history.some(h => /^(kubectl|k) logs reporter/.test(h)) },
          { text: 'auth can-i se permission verify karo', check: s => s.history.some(h => /auth can-i/.test(h)) },
          { text: 'RBAC fix karo → app kaam kare', check: s => s.cluster.pods[0].logs.includes('200 OK') },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '120d', version: 'v1.30.2' }],
          pods: [
            {
              name: 'reporter-6c7d8e-r1', ready: '1/1', status: 'Running', restarts: 0, age: '20m', node: 'node-1', ip: '10.244.1.80',
              logs: '[reporter] fetching pod list for report...\nGET /api/v1/namespaces/default/pods → 403 Forbidden\npods is forbidden: User "system:serviceaccount:default:reporter-sa"\ncannot list resource "pods" in API group "" in the namespace "default"',
              describe: 'Name:            reporter-6c7d8e-r1\nService Account: reporter-sa   ← identity yeh hai\nStatus:          Running',
            },
          ],
          deployments: [{ name: 'reporter', ready: '1/1', upToDate: 1, available: 1, age: '20m' }],
          services: [],
        },
        responses: [
          {
            re: /auth can-i list pods --as=system:serviceaccount:default:reporter-sa/,
            out: s => s.cluster.pods[0].logs.includes('200 OK') ? 'yes' : 'no',
          },
          {
            re: /auth can-i .*/,
            out: 'no\n(hint: exact syntax: kubectl auth can-i list pods --as=system:serviceaccount:default:reporter-sa)',
          },
          {
            re: /^(kubectl|k) get (role|roles)\b/,
            out: 'NAME         CREATED AT\npod-reader   2026-07-01T10:00:00Z\n\n(Role toh HAI... par kya woh reporter-sa se BANDHA hai? get rolebindings dekho!)',
          },
          {
            re: /^(kubectl|k) get (rolebinding|rolebindings)\b/,
            out: s => s.cluster.pods[0].logs.includes('200 OK')
              ? 'NAME              ROLE             AGE\nreporter-reads    Role/pod-reader  1m'
              : 'No resources found in default namespace.\n(🚨 smoking gun: Role exist karta hai par BINDING koi nahi — chain tooti hui hai!)',
          },
        ],
        files: {
          'fix-rolebinding.yaml': {
            desc: 'reporter-sa ko pod-reader Role se bandhta hai (RoleBinding)',
            apply: s => {
              const p = s.cluster.pods[0];
              p.logs = '[reporter] fetching pod list for report...\nGET /api/v1/namespaces/default/pods → 200 OK ✓\n[reporter] report generated: 12 pods, all healthy 📊';
              return 'rolebinding.rbac.authorization.k8s.io/reporter-reads created\n(chain complete: reporter-sa → RoleBinding → pod-reader ✓)';
            },
          },
          'fix-cluster-admin.yaml': {
            desc: 'reporter-sa ko cluster-admin de deta hai (jugaad)',
            apply: () => 'clusterrolebinding created...\n⚠️ REJECTED by policy check (aur accha hai!): report banane ke liye PURA CLUSTER admin?\nWar-story yaad karo — least privilege. Sahi fix: namespace-scoped RoleBinding.',
          },
          'fix-restart-pod.yaml': {
            desc: 'Pod restart karta hai',
            apply: () => 'pod restarted...\n(phir 403 — permissions pod mein nahi, RBAC objects mein hote hain. Restart se kuch nahi badla.)',
          },
        },
        success: s => s.cluster.pods[0].logs.includes('200 OK') && s.history.some(h => /auth can-i/.test(h)),
        successText: 'RBAC chain complete! 🔗 Debug pattern yaad rakho: <b>403 message khud batata hai kaun aur kya</b> ("User system:serviceaccount:default:reporter-sa cannot list pods") → <code>auth can-i</code> se confirm → chain trace karo: SA hai? Role hai? <b>BINDING hai?</b> (Missing binding = #1 cause). Aur cluster-admin ka shortcut kabhi nahi — audit-proof socho.',
        hints: [
          'kubectl logs reporter → 403 message mein poori identity likhi hai',
          'kubectl auth can-i list pods --as=system:serviceaccount:default:reporter-sa → "no". Ab: get roles AUR get rolebindings dono dekho',
          'Role hai, binding NAHI — fix-rolebinding.yaml (cluster-admin wala jugaad mat karna!)',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — RBAC ke corners',
        questions: [
          {
            q: 'ClusterRole ko RoleBinding (namespace wali) se bind karna — yeh combination kya karta hai?',
            choices: [
              'ClusterRole ki permissions ko USI namespace tak limit kar deta hai — reusable role definition, scoped grant. Pro pattern!',
              'Error deta hai — ClusterRole sirf ClusterRoleBinding se hi bind ho sakta hai, RoleBinding ke saath apply reject hota hai',
              'Poore cluster ki permissions de deta hai — RoleBinding ka namespace sirf metadata hai, ClusterRole ka scope jeet jaata hai',
              'Sirf us namespace ke cluster-scoped resources (nodes, PVs) ki permissions deta hai, namespaced resources ki nahi',
            ],
            answer: 0,
            explain: 'Underrated combo: ek baar ClusterRole "app-deployer" define karo, har team ke NS mein RoleBinding se do — definition ek, scope alag-alag. DRY + least privilege ek saath.',
          },
          {
            q: 'Har pod ko by default "default" ServiceAccount milta hai. Iska security implication?',
            choices: [
              'Us SA par jo bhi permissions bind hui hain, HAR pod ke paas hain — isliye default SA ko permissions dena galti hai; apps ko apna SA do',
              'Koi implication nahi — default SA ke paas kabhi permission nahi hoti aur API server use kisi Role se bind hi nahi karne deta',
              'Default SA sirf kube-system mein hota hai; baaki namespaces ke pods bina kisi identity ke chalte hain, isliye bilkul safe',
              'Default SA ka token sirf 1 ghante chalta hai aur pod ke andar mount nahi hota, isliye permissions dene se bhi koi khatra nahi',
            ],
            answer: 0,
            explain: 'Kisi ne "jaldi mein" default SA ko secrets-read de diya → ab NAMESPACE KE HAR POD ke paas woh hai. Best practice: automountServiceAccountToken: false jab API access chahiye hi nahi.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — RBAC',
      instructions: 'Security round — yahan galti mehengi padti hai. 🎤',
      questions: [
        {
          q: '"Role vs ClusterRole — aur ServiceAccounts se securely kaise bind karte ho?" (User ke syllabus ka exact sawal!)',
          choices: [
            'Role = namespace-scoped, ClusterRole = cluster-wide (+ non-namespaced resources); apps ko APNA ServiceAccount + namespace RoleBinding se least-privilege — cluster-admin kabhi nahi',
            'Role humans (kubectl users) ke liye hota hai aur ClusterRole ServiceAccounts ke liye; apps ko ClusterRoleBinding se bind karo taaki har namespace mein chal sakein',
            'Dono same hain, ClusterRole bas naya version hai; ServiceAccount ko default SA ke saath share karna safe hai kyunki token pod ke andar hi rehta hai',
            'Role sirf read permissions de sakta hai aur ClusterRole write bhi; isliye deploy karne wale apps ko hamesha ClusterRole + ClusterRoleBinding chahiye',
          ],
          answer: 0,
          explain: 'Scope + binding + least-privilege — teeno bolo. Bonus: "nodes/PVs namespaced nahi hain isliye unke liye ClusterRole hi lagta hai" — yeh detail atki hui samajh dikhati hai.',
        },
        {
          q: 'App ke logs mein "secrets is forbidden... cannot list secrets" — debugging ka sabse tez systematic path?',
          choices: [
            'Error se identity+verb+resource nikalo → kubectl auth can-i --as se confirm → SA→Binding→Role chain check (binding aksar missing) → minimal Role/Binding add',
            'cluster-admin bind kar do taaki app turant chal pade — permissions baad mein audit logs dekh ke tighten karenge, abhi outage bachana zaroori hai',
            'Pod restart karo — RBAC changes ka cache pod ke token mein hota hai, naya token aane par permissions apne aap theek ho jaati hain',
            'API server ke audit logs kholo aur poore din ka data download karo — forbidden error ka reason sirf wahin milta hai, message mein nahi',
          ],
          answer: 0,
          explain: '403 ka message SAB bata deta hai — usse parse karna hi aadha debugging hai. "Baad mein tighten" kabhi nahi hota — interviewer ko yeh awareness dikhana bhi zaroori hai.',
        },
        {
          q: 'Junior ne poocha: "RBAC verbs mein get vs list vs watch ka farak kya hai?"',
          choices: [
            'get = naam se ek object; list = poori collection; watch = live changes ka stream — controllers ko teeno chahiye, isliye read-only Role mein get, list, watch',
            'Teeno same hain — Kubernetes andar se teeno ko ek hi read permission maanta hai, alag likhna purani style hai, ek hi kaafi hai',
            'watch sirf kubectl get -w jaise debugging ke liye hai; controllers list ko har second poll karte hain, isliye unke Role mein watch dene ki zaroorat nahi',
            'list mein get apne aap aa jaata hai aur get mein watch — isliye sirf list dena kaafi hai, baaki verbs redundant hain',
          ],
          answer: 0,
          explain: 'Chhota sawal, par yeh batata hai tumne asli Roles likhe hain. Watch hi woh verb hai jisse controllers/operators reconcile karte hain — Level 23 (Operators) mein yeh circle poora hoga!',
        },
      ],
    },
    success: [
      'Main Role/ClusterRole/Binding/SA ka poora model explain kar sakta hoon',
      'Main 403 Forbidden ko can-i + chain-trace se debug kar sakta hoon',
      'Main least-privilege RBAC design kar sakta hoon (cluster-admin ke bina!)',
      'Main default-SA jaise subtle risks jaanta hoon',
    ],
    homework: `<p>Poori RBAC chain khud banao aur can-i se verify karo:</p>
      <pre>kubectl create serviceaccount test-sa
kubectl auth can-i list pods --as=system:serviceaccount:default:test-sa   # no
kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl auth can-i list pods --as=system:serviceaccount:default:test-sa   # STILL no! (binding?)
kubectl create rolebinding test-reads --role=pod-reader \\
  --serviceaccount=default:test-sa
kubectl auth can-i list pods --as=system:serviceaccount:default:test-sa   # YES ✓
kubectl auth can-i delete pods --as=system:serviceaccount:default:test-sa # no (least privilege!)
kubectl delete rolebinding test-reads; kubectl delete role pod-reader; kubectl delete sa test-sa</pre>
      <p>✅ Self-check: Role banane ke BAAD bhi "no" dekha? Binding hi asli chaabi hai — bhoolna mat.</p>`,
    cards: [
      { front: 'RBAC chain ke 3 hisse?', back: '<b>Identity</b> (ServiceAccount) → <b>Binding</b> (RoleBinding/ClusterRoleBinding) → <b>Permissions</b> (Role/ClusterRole). Chain mein sabse common missing link: BINDING.' },
      { front: 'Role vs ClusterRole — kab kya?', back: '<b>Role</b>: ek namespace (apps ka default). <b>ClusterRole</b>: cluster-wide + non-namespaced cheezein (nodes, PVs) — controllers/monitoring ke liye. Pro combo: ClusterRole + RoleBinding = reusable definition, scoped grant.' },
      { front: '403 Forbidden debug ka fast path?', back: 'Error message se identity+verb+resource parse karo → <code>kubectl auth can-i X --as=system:serviceaccount:NS:SA</code> → SA→Binding→Role chain check. Guessing zero.' },
      { front: 'Apps ko human users se bind kyun nahi karte?', back: 'Insaan jaate hain, credentials rotate hote hain — app achanak todegi ya unke saare rights ke saath chalegi. Apps = apna <b>ServiceAccount</b> + least-privilege Role. CI/CD ko cluster-admin = breach ka invitation.' },
    ],
  },

  /* ================= LEVEL 19: Pod Security Admission ================= */
  {
    id: 'podsecurity',
    icon: '🛡️',
    title: 'Pod Security Admission — Container Jail',
    badge: 'PSA Prahari',
    objectives: [
      'Root container kyun khatarnak hai (container ≠ VM!)',
      'PSA ke 3 levels: <b>privileged / baseline / restricted</b>',
      '3 modes: <b>enforce / audit / warn</b> — rollout strategy',
      'securityContext — restricted-compliant pod likhna',
    ],
    lesson: [
      `<h3>🛡️ Container ek darwaza hai, deewar nahi</h3>
       <p>Container = process + namespace isolation — VM jaisi pakki deewar NAHI. Root
       container + kernel bug/misconfig = <b>node par escape</b>. Aur node par root matlab:
       us node ke SAARE pods ke secrets, kubelet credentials... game over.</p>
       <p><b>PSA (Pod Security Admission)</b> = API Server ka built-in gatekeeper (purane
       PodSecurityPolicy ka replacement). Namespace par label lagao, standards enforce:</p>
       <pre>kubectl label namespace prod \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/warn=restricted

# Ab root/privileged pod REJECT hoga — API Server par hi:
Error: pods "bad-pod" is forbidden: violates PodSecurity
"restricted:latest": runAsNonRoot != true ...</pre>
       <table>
         <tr><th>Level</th><th>Kya rokta hai</th><th>Kahan</th></tr>
         <tr><td>🔓 <b>privileged</b></td><td>Kuch nahi — sab allowed</td><td>kube-system, CNI/storage drivers</td></tr>
         <tr><td>🔒 <b>baseline</b></td><td>Known-bad: privileged mode, hostNetwork/hostPID, host paths</td><td>Aam namespaces ka minimum</td></tr>
         <tr><td>🔐 <b>restricted</b></td><td>Baseline + non-root ZAROORI, no privilege escalation, saare capabilities drop, seccomp</td><td>Production target</td></tr>
       </table>`,
      `<h3>⚙️ Restricted-compliant pod + rollout ki chaal</h3>
       <pre>spec:
  securityContext:
    runAsNonRoot: true
    seccompProfile: { type: RuntimeDefault }
  containers:
  - name: app
    image: shop/web:2.4.0        # Dockerfile mein bhi: USER 1000
    securityContext:
      allowPrivilegeEscalation: false
      capabilities: { drop: ["ALL"] }
      readOnlyRootFilesystem: true   # bonus hardening</pre>
       <p><b>Modes ka smart rollout</b> (seedha enforce = sab tod doge):
       pehle <code>warn</code>+<code>audit</code> lagao → warnings collect karo → apps fix
       karo → TAB <code>enforce</code>. Zero-downtime security rollout.</p>
       <div class="war-story"><b>⚡ Real pattern (kai public incidents ka common thread):</b>
       Cryptomining attacks aksar aise hue: exposed dashboard/CI se ek pod create hua —
       <b>privileged + hostPath: /</b> — node ka poora filesystem mount, kubelet creds
       chori, poore cluster mein miners. PSA restricted hota toh woh pod API Server par
       hi REJECT ho jaata. <b>Ek namespace label = poori attack class band.</b></div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'PSA Judge — Pass ya Reject?',
        instructions: 'Namespace par enforce=restricted hai. Har pod spec ka faisla karo.',
        bins: [
          { id: 'pass', label: '✅ ADMITTED' },
          { id: 'reject', label: '🚫 REJECTED' },
        ],
        items: [
          { text: 'runAsNonRoot + drop ALL caps + no escalation', bin: 'pass', explain: 'Textbook restricted-compliant. Yehi template har prod app ka hona chahiye.' },
          { text: 'privileged: true (docker-in-docker ke liye)', bin: 'reject', explain: 'Privileged = container ki deewarein hi hata di. Restricted mein kabhi nahi — DinD ke liye alag solutions hain (kaniko, buildkit).' },
          { text: 'hostPath: / mount karta hai', bin: 'reject', explain: 'War-story wala attack vector! Node ka root filesystem pod mein = escape ready-made. Baseline bhi isse rokta hai.' },
          { text: 'runAsUser: 0 (root) "kyunki port 80 chahiye"', bin: 'reject', explain: 'Classic bahana! Port 80 ke liye root nahi chahiye — 8080 par suno, Service 80→8080 map karega. runAsNonRoot violation = reject.' },
          { text: 'hostNetwork: true (performance ke liye)', bin: 'reject', explain: 'Host ka network namespace = node ke saare interfaces/traffic dikhte hain. Baseline level par hi banned. "Performance" ka excuse audit mein nahi chalta.' },
          { text: 'readOnlyRootFilesystem + non-root + seccomp', bin: 'pass', explain: 'Restricted se bhi aage — read-only root toh required bhi nahi hai, par excellent hardening. Malware khud ko likh hi nahi paayega.' },
        ],
      },
      {
        type: 'fill',
        title: 'Restricted-Compliant Pod Likho',
        instructions: 'Is pod ko restricted namespace mein admit hone laayak banao.',
        template: 'spec:\n  securityContext:\n    runAsNonRoot: {0}\n    seccompProfile:\n      type: {1}\n  containers:\n  - name: app\n    image: shop/web:2.4.0\n    ports:\n    - containerPort: {2}   # 80 nahi — root-only port se bacho\n    securityContext:\n      allowPrivilegeEscalation: {3}\n      capabilities:\n        drop: ["ALL"]',
        blanks: [
          { answer: 'true', explain: 'runAsNonRoot: true = kubelet container start hone se pehle verify karega ki user root nahi hai. (Image mein USER instruction bhi ho — dono layers.)' },
          { answer: 'RuntimeDefault', explain: 'Seccomp = syscall filter — kernel ke khatarnak syscalls band. RuntimeDefault profile restricted ka requirement hai.' },
          { answer: '8080', explain: '1024 ke neeche ke ports root maangte hain (traditionally). 8080 par suno — Service/Ingress user ko 80/443 dikhayega. Root ka bahana khatam.' },
          { answer: 'false', explain: 'allowPrivilegeEscalation: false = setuid binaries se privileges nahi badha sakte. Restricted ka core requirement.' },
        ],
        tokens: ['true', 'RuntimeDefault', '8080', 'false', 'root', 'Unconfined', '80', 'sudo'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — PSA operations',
        questions: [
          {
            q: 'Purane namespace par seedha enforce=restricted lagaya — kya risk hai?',
            choices: [
              'MAUJOODA pods chalte rahenge, par NAYE pods (rollout, scale-up, eviction ke baad replacement) reject honge — achanak outage! Pehle warn+audit, fix, phir enforce',
              'Koi risk nahi — PSA labels sirf naye namespaces par lagte hain; purane namespace ke pods aur unke replacements par asar nahi padta',
              'Saare violating pods turant terminate ho jaayenge — enforce label lagte hi API server unhe evict kar deta hai, isliye maintenance window chahiye',
              'Sirf logs aur kubectl warnings aayengi — enforce mode bhi violating pods ko block nahi karta, sirf audit annotation lagata hai',
            ],
            answer: 0,
            explain: 'Sabse tricky part: admission CREATE par hota hai — running pods ko kuch nahi, par unka agla restart/reschedule fail hoga. "Kal raat sab theek tha, aaj rollout fail" — yeh PSA enforce ka classic delayed blast hai.',
          },
          {
            q: 'kube-system namespace ko restricted kyun NAHI karte?',
            choices: [
              'CNI, storage drivers, kube-proxy jaise system components ko legitimately host access chahiye — unka kaam hi node-level hai',
              'kube-system par PSA technically lag hi nahi sakta — API server us namespace ke labels ignore karta hai, isliye restricted ka koi asar nahi',
              'Restricted level system pods ki CPU performance 30-40% gira deta hai, kyunki seccomp profiles har syscall check karte hain',
              'Kubernetes docs kube-system ko restricted karna mana karte hain kyunki wahan pods ko node ka root password chahiye hota hai',
            ],
            answer: 0,
            explain: 'Nuance: privileged EXISTS isliye hai. Security absolutes mein nahi, layers mein sochte hain: system NS privileged (tightly controlled access), app NS restricted. Right tool, right place.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Pod Security',
      instructions: 'Container security ka soch-samajh dikhana hai. 🎤',
      questions: [
        {
          q: '"Containers root par kyun nahi chalane chahiye — VM se alag kya hai?"',
          choices: [
            'Container sirf namespace/cgroup isolation hai, VM jaisi hardware boundary nahi — root + kernel bug/misconfig = node escape, aur node root = saare pods, secrets, kubelet creds',
            'Root containers slow chalte hain kyunki kernel har root syscall ka audit karta hai — non-root se 20-30% performance milti hai, security bas side-benefit hai',
            'Container mein root ka matlab host ka root nahi hota — user namespaces hamesha on hain, isliye khatra sirf compliance checkbox ka hai, technical nahi',
            'VM aur container mein koi farak nahi — dono hypervisor par chalte hain, isliye root container bhi VM jitna isolated hai, bas policy ka maamla hai',
          ],
          answer: 0,
          explain: 'Isolation model ka farak hi core answer hai: shared kernel! Escape chain bolo: container root → kernel bug → node → kubelet creds → cluster. Yeh chain sunte hi interviewer ko pata chal jaata hai ki tum samajhte ho.',
        },
        {
          q: 'Company mein PSA restricted rollout ka safe plan?',
          choices: [
            'Pehle warn+audit labels (kuch nahi tootta) → violations collect/fix (non-root images, drop caps) → namespace-by-namespace enforce → exceptions ke liye alag privileged NS + tight RBAC',
            'Ek hi weekend mein saare namespaces par enforce lagao aur jo apps tootein unhe Monday ko fix karo — dheere rollout se teams kabhi fix nahi karti, deadline zaroori hai',
            'Sirf naye apps par restricted lagao, purane hamesha privileged rehne do — legacy ko chhedna risky hai, unka exception permanent rakho',
            'PSA ki jagah ek wiki page likho jisme non-root guidelines hon — teams khud follow karengi, enforcement se developers naraz hote hain',
          ],
          answer: 0,
          explain: 'Operational maturity ka sawal hai: warn/audit = free telemetry, phir gradual enforce. "Enforce on day 1" = outage stories. Exceptions ko bhi design karna (privileged NS + RBAC) — absolute nahi, managed risk.',
        },
        {
          q: 'App bolti hai "mujhe port 80 par bind karna hai isliye root chahiye". Senior jawab?',
          choices: [
            'Nahi chahiye — container 8080 par sune, Service/Ingress 80 map kar dega; root ka har reason aksar aise hi solve hota hai (files? fsGroup; capability? sirf woh add karo)',
            'Theek hai — port 80 ke liye root zaroori hai, isliye sirf is app ke namespace ko privileged kar do aur baaki saare namespaces restricted rakho; exception documented rahe',
            'Port 80 ki jagah hostNetwork: true use karo — node ka port seedha mil jaata hai aur container ko root ki zaroorat bhi nahi padti',
            'App ko VM par shift kar do — Kubernetes mein privileged ports ka koi tareeka nahi, yeh platform ki limitation hai jise maanna padta hai',
          ],
          answer: 0,
          explain: 'Har root-request ke peeche ek non-root solution hota hai — yeh pattern-matching hi seniority hai. Port→Service mapping, file-permissions→fsGroup, ek capability→drop ALL + add NET_BIND_SERVICE. Excuses ki list khatam.',
        },
      ],
    },
    success: [
      'Main container-vs-VM isolation aur root ke risk ki chain samjha sakta hoon',
      'Main privileged/baseline/restricted + enforce/audit/warn ka matrix jaanta hoon',
      'Main restricted-compliant securityContext likh sakta hoon',
      'Main PSA ka safe rollout plan bana sakta hoon',
    ],
    homework: `<p>PSA ko action mein dekho:</p>
      <pre>kubectl create ns locked
kubectl label ns locked pod-security.kubernetes.io/enforce=restricted
# root pod try karo:
kubectl -n locked run bad --image=nginx     # nginx root se chalta hai...
# REJECTED ya pod fail — error message padho, PSA ki har objection likhi hai!
# ab compliant version:
kubectl -n locked run good --image=nginxinc/nginx-unprivileged \\
  --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"good","image":"nginxinc/nginx-unprivileged","securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}}}]}}'
kubectl -n locked get pods                  # Running ✓
kubectl delete ns locked</pre>
      <p>✅ Self-check: reject ka error message padha? Usme har violation ka naam tha — free compliance checklist!</p>`,
    cards: [
      { front: 'Root container ka escape chain?', back: 'Container = namespaces, VM-wall nahi (shared kernel!). Root container → kernel vuln/hostPath → <b>node escape</b> → kubelet creds + saare pods ke secrets → cluster. Isliye runAsNonRoot.' },
      { front: 'PSA ke 3 levels + 3 modes?', back: 'Levels: <b>privileged</b> (sab allowed — system NS) / <b>baseline</b> (known-bad band) / <b>restricted</b> (non-root+no-escalation+drop caps). Modes: <b>enforce/audit/warn</b> — namespace labels se.' },
      { front: 'PSA enforce ka "delayed blast" kya hai?', back: 'Admission CREATE par hota hai — running pods bach jaate hain, par unka AGLA restart/rollout reject hoga. Isliye: warn+audit pehle, violations fix, phir enforce. Kabhi day-1 enforce nahi.' },
      { front: '"Port 80 ke liye root chahiye" ka jawab?', back: 'Container <b>8080</b> par sune, Service/Ingress 80→8080 map karega. Har root-excuse ka non-root solution hai: files→fsGroup, capability→drop ALL + specific add.' },
    ],
  },

  /* ================= LEVEL 20: Secrets Management ================= */
  {
    id: 'secrets',
    icon: '🗝️',
    title: 'Secrets Management — Vault & External Secrets',
    badge: 'Secret Sanrakshak',
    objectives: [
      'Native Secrets ki limitations (Level 7 ka base64 yaad hai?)',
      'GitOps zamane mein secrets ka paradox — git mein Secret kaise rakhein?',
      '<b>External Secrets Operator (ESO)</b> — Vault/AWS SM se sync',
      'Rotation, audit, aur least-access — enterprise-grade thinking',
    ],
    lesson: [
      `<h3>🗝️ Native Secrets ki poori report card</h3>
       <table>
         <tr><th>Problem</th><th>Detail</th></tr>
         <tr><td>base64 ≠ encryption</td><td>Level 7 se pata hai — 2 second mein decode</td></tr>
         <tr><td>etcd mein plaintext (default)</td><td>encryption-at-rest KHUD on karna padta hai</td></tr>
         <tr><td>Git paradox</td><td>GitOps bolta hai "sab git mein" — par Secret YAML git mein = leak (2023 wala research yaad karo: hazaaron repos mein live credentials)</td></tr>
         <tr><td>Rotation?</td><td>Password badla toh har cluster/namespace mein haath se update? 🙈</td></tr>
         <tr><td>Audit?</td><td>Kisne kab kaunsa secret dekha — native mein kuch nahi</td></tr>
       </table>
       <p>Enterprise jawab: asli secrets ek <b>dedicated manager</b> mein rakho —
       HashiCorp <b>Vault</b>, <b>AWS Secrets Manager</b>, Azure Key Vault — jahan
       encryption, rotation, audit, fine-grained access sab built-in hai.</p>`,
      `<h3>🔁 External Secrets Operator — pul dono duniyaon ka</h3>
       <pre># Git mein SIRF yeh jaata hai (koi secret value NAHI — sirf pointer):
kind: ExternalSecret
spec:
  refreshInterval: 1h                  # har ghante sync/rotation check
  secretStoreRef: { name: vault-store }
  target: { name: db-creds }           # yeh K8s Secret banega
  data:
  - secretKey: password
    remoteRef:
      key: prod/db                     # Vault ka path
      property: password</pre>
       <p>Flow (diagram dekho): ESO ExternalSecret padhta hai → Vault se value laata hai →
       K8s Secret banata/refresh karta hai → pod normally use karta hai. <b>Rotation
       Vault mein karo — cluster apne aap naya le lega.</b> Git mein sirf reference —
       GitOps paradox solved. ✓</p>
       <div class="war-story"><b>⚡ Real incident (huge public breach pattern):</b> Kai bade
       breaches (jaise 2022-23 ke kuch famous CI/CD leaks) ka common thread: long-lived
       static credentials repos/CI vars mein pade the — mahino purane, kabhi rotate nahi
       hue, kisi audit mein nahi dikhe. Vault-style setup hota: short-lived dynamic creds
       (DB password jo 1 ghante mein khud expire!), har access audit-logged, rotation ek
       jagah. <b>Static secret jo rotate nahi hota = time bomb with unknown timer.</b></div>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'ESO ka Sync Flow',
        instructions: 'Password rotation ka poora safar — Vault se pod tak. Order lagao.',
        steps: [
          { text: 'DBA Vault mein prod/db ka password rotate karta hai', explain: 'EK jagah rotation — na 12 clusters mein, na 40 YAML files mein. Audit log bhi yahin.' },
          { text: 'ESO refreshInterval par Vault se latest value fetch karta hai', explain: 'ExternalSecret ka refreshInterval: 1h — polling sync. (Push-based setups bhi hote hain, par pull simple aur reliable hai.)' },
          { text: 'ESO K8s Secret (db-creds) ko nayi value se update karta hai', explain: 'Wahi native Secret object — apps ke liye kuch naya seekhna nahi. ESO = invisible bridge.' },
          { text: 'Volume-mounted secret file pod mein auto-update hoti hai', explain: 'Level 7 ka gyaan wapas: volume mounts LIVE update hote hain, env vars NAHI — isliye secrets ko volume se mount karna better hai!' },
          { text: 'App nayi value use karti hai (file re-read ya connection refresh par)', explain: 'App ko sirf "file se padho, reconnect par re-read karo" ka pattern chahiye. Poora chain: zero manual cluster touch.' },
        ],
      },
      {
        type: 'bins',
        title: 'Git Mein Kya Jaa Sakta Hai?',
        instructions: 'GitOps repo bana rahe ho. Har cheez ka faisla karo — git mein commit hogi ya NAHI?',
        bins: [
          { id: 'git', label: '✅ Git mein OK' },
          { id: 'nogit', label: '🚫 Git mein KABHI NAHI' },
        ],
        items: [
          { text: 'ExternalSecret YAML (vault path ka reference)', bin: 'git', explain: 'Sirf pointer hai — "prod/db se password lena". Value Vault mein hai. Yehi ESO ka poora point hai!' },
          { text: 'Secret YAML with base64 values', bin: 'nogit', explain: 'base64 = 2-second decode. 2023 research: hazaaron public repos mein aise live credentials mile. Git history se delete karna bhi almost impossible!' },
          { text: 'Deployment/Service/Ingress manifests', bin: 'git', explain: 'Bilkul — yehi GitOps hai. Config as code, PR review, git log = audit.' },
          { text: 'TLS private key ("bas staging ka hai")', bin: 'nogit', explain: '"Sirf staging" — har leak ki opening line! Staging se prod ka raasta attackers ko pata hai. Keys = cert-manager ya vault, kabhi git nahi.' },
          { text: 'SealedSecret (encrypted, sirf cluster decrypt kar sakta hai)', bin: 'git', explain: 'Bitnami SealedSecrets = ESO ka alternative pattern: value encrypted committed, cluster ka controller hi kholta hai. Git-safe by design. (ESO vs Sealed — dono valid, ESO rotation mein jeetta hai.)' },
          { text: '.env file "temporarily" debugging ke liye', bin: 'nogit', explain: '"Temporary" commits git history mein PERMANENT hote hain. .gitignore mein .env day-1 se. Leak hua toh rotate karna hi padega — history scrub bharosemand nahi.' },
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Secrets ops',
        questions: [
          {
            q: 'Vault ke "dynamic secrets" static se fundamentally better kyun hain?',
            choices: [
              'Har app/session ko SHORT-LIVED unique credential milta hai (jaise 1-hour DB password) — leak hua bhi toh khud expire, aur audit mein pata hai kaunsa cred kiska tha',
              'Dynamic secrets lambe aur random hote hain (64+ characters), isliye brute-force namumkin hai — static passwords chhote aur guessable hote hain',
              'Dynamic secrets kabhi disk par nahi likhe jaate, sirf RAM mein rehte hain — isliye leak ho hi nahi sakte, rotation ki zaroorat nahi',
              'Static secrets Kubernetes 1.30 se deprecated hain — Vault dynamic secrets hi naya official replacement hain, ESO bina dynamic ke chalta hi nahi',
            ],
            answer: 0,
            explain: 'Paradigm shift: "secret ko protect karo" se "secret ko DISPOSABLE banao". 1-hour TTL wala leaked password attacker ke liye almost bekar. Yeh concept interview mein bolo — enterprise-grade thinking ka signal.',
          },
          {
            q: 'ESO install hai, ExternalSecret apply kiya, par K8s Secret ban hi nahi raha. Pehla check?',
            choices: [
              'kubectl describe externalsecret — status/events mein exact wajah hogi (SecretStore auth fail? vault path galat? property missing?)',
              'Cluster restart karo — ESO controller kabhi-kabhi naye CRDs register nahi karta, restart se sab sync ho jaata hai',
              'Jab tak theek na ho, Secret manually bana do — ESO baad mein usse adopt kar lega aur sync apne aap chalu ho jaayega',
              'refreshInterval ko 1s kar do — default interval bahut lamba hai, isliye pehla sync ghanton baad hota hai',
            ],
            answer: 0,
            explain: 'ESO apna status ExternalSecret object par likhta hai — SecretSynced condition, error messages sab. Wahi describe-first habit (Track 1 se chali aa rahi!) yahan bhi. Manual secret banana = drift + "kyun sync nahi ho raha" ka mystery hamesha ke liye.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Secrets Management',
      instructions: 'Security depth ka asli test. 🎤',
      questions: [
        {
          q: '"Native K8s Secrets production ke liye kaafi hain?" — complete senior jawab?',
          choices: [
            'Akele nahi: base64-only, vanilla etcd plaintext, rotation/audit nahi, git paradox — production mein external manager (Vault/AWS SM) + ESO sync, RBAC tight, etcd encryption on',
            'Haan — Secrets etcd mein default se encrypted hote hain aur sirf usi namespace ke pods padh sakte hain, isliye Vault/ESO jaisi extra tooling production mein bhi overkill hai',
            'Nahi — Secrets kabhi use hi mat karo; har app ko Vault SDK se seedha baat karni chahiye, Kubernetes Secret object bilkul bekaar hai',
            'Haan agar ConfigMap mein base64 karke rakho — ConfigMap ka RBAC Secrets se strict hota hai, isliye wahi zyada safe jagah hai',
          ],
          answer: 0,
          explain: 'Layered jawab do: limitations gino → mitigations gino → architecture (external manager + ESO). Note karo: native Secret object phir bhi USE hota hai (ESO usi mein sync karta hai) — "kaafi nahi" ≠ "bekaar hai".',
        },
        {
          q: 'GitOps adopt kar rahe ho — secrets ka paradox kaise solve hoga?',
          choices: [
            'Git mein sirf ExternalSecret references (ya SealedSecrets) — asli values Vault/cloud manager mein; ESO cluster mein sync karta hai, rotation git chhuye bina',
            'Repo private hai toh Secret YAML commit kar do — sirf company ke log access kar sakte hain, aur git history audit trail bhi deti hai',
            'Secrets ko GitOps se hamesha bahar rakho aur har cluster mein manually kubectl create karo — GitOps sirf non-sensitive config ke liye hai',
            'Secrets ko base64 ki jagah do baar encode karke commit karo — scanners pakad nahi paate aur ArgoCD decode kar leta hai',
          ],
          answer: 0,
          explain: '"Private repo = safe" sabse common galti hai (2023 research, ex-employees, CI leaks, repo accidentally public...). Reference-in-git pattern hi THE answer hai. SealedSecrets ko alternative bolna = breadth points.',
        },
        {
          q: 'DB password leak ho gaya (logs mein aa gaya tha). Vault+ESO setup mein incident response?',
          choices: [
            'Vault mein turant rotate → ESO agli sync par saare clusters update → apps naya credential uthati hain; audit log se dekho kisne access kiya — static setup mein har cluster manually',
            'Sirf woh log file delete kar do aur log retention 1 din kar do — jab password logs mein hi nahi bachega toh leak bhi khatam ho jaayega',
            'Password wahi rakho par Secret ko naye namespace mein shift kar do — attacker ko naya path pata nahi hoga, rotation ki zaroorat nahi',
            'Poora cluster rebuild karo — leak hua password etcd snapshots aur backups mein bhi hai, isliye naye cluster aur naye backups ke bina woh credential kabhi safe nahi hoga',
          ],
          answer: 0,
          explain: 'Yeh sawal architecture ka payoff dikhata hai: rotation = one-place fix + auto-propagation. Compare bolo (static nightmare vs vault 5-minute) — architecture decisions ka business case yahi hota hai.',
        },
      ],
    },
    success: [
      'Main native Secrets ki har limitation aur uska mitigation bata sakta hoon',
      'Main ESO ka poora sync flow (Vault → Secret → pod) explain kar sakta hoon',
      'Main GitOps + secrets paradox ke dono solutions (ESO refs, SealedSecrets) jaanta hoon',
      'Main leak-incident par fast rotation response design kar sakta hoon',
    ],
    homework: `<p>ESO ka feel local mein (fake provider ke saath):</p>
      <pre># ESO install (helm aayega agle levels mein, abhi manifest se):
kubectl apply -f https://github.com/external-secrets/external-secrets/releases/latest/download/external-secrets.yaml
kubectl get pods -n external-secrets      # operator chal raha?
kubectl get crds | grep external          # naye kinds! (CRDs — Level 23 ka teaser)
# fake SecretStore + ExternalSecret docs se try karo:
# https://external-secrets.io/latest/provider/fake/
kubectl explain externalsecret.spec       # structure khudai karo</pre>
      <p>✅ Self-check: CRDs list mein externalsecrets dikha? Operator pattern ka pehla darshan ho gaya — Level 23 mein poora milega!</p>`,
    cards: [
      { front: 'Native Secrets ki 4 limitations?', back: '1) base64 ≠ encryption, 2) etcd mein default plaintext, 3) rotation manual (har cluster!), 4) no audit + <b>git paradox</b> (GitOps mein commit nahi kar sakte). Isliye: Vault/AWS SM + ESO.' },
      { front: 'ESO ka flow ek line mein?', back: 'Git mein <b>ExternalSecret</b> (sirf vault-path ka pointer) → ESO Vault se value laata hai → native K8s Secret banata/refresh karta hai → pod normally use karta hai. Rotation = sirf Vault mein.' },
      { front: 'Secrets env vars se ya volume se — kya better aur kyun?', back: '<b>Volume mount</b> — files LIVE update hoti hain (rotation propagate hota hai); env vars pod start par freeze (Level 7!). App bas re-read/reconnect kare.' },
      { front: 'Dynamic secrets ka superpower?', back: 'Short-lived, per-app unique creds (1-hour DB password) — leak bhi ho toh <b>khud expire</b>. "Secret ko protect karo" → "secret ko disposable banao". Vault ka killer feature.' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('advanced', [

  /* ================= LEVEL 21: Observability ================= */
  {
    id: 'observability',
    icon: '📊',
    title: 'Observability — Prometheus, Grafana & Logs',
    badge: 'Metrics Maharishi',
    objectives: [
      '<b>Prometheus PULL model</b> — /metrics scraping kaise kaam karta hai',
      'Logs ka safar: stdout → DaemonSet agent → aggregator (Loki/ES)',
      '<b>Golden signals</b>: rate, errors, duration, saturation',
      'Alerting philosophy — symptom par alert karo, cause par nahi',
    ],
    lesson: [
      `<h3>📈 Prometheus — PULL, push nahi</h3>
       <p>Har app ek <code>/metrics</code> endpoint deta hai (plain text counters/gauges),
       Prometheus har 15s sab pods se khud <b>scrape</b> karta hai. Naye pods kaise
       milte hain? <b>Service discovery</b> — Prometheus K8s API se pods/services ki live
       list rakhta hai (wahi watch pattern!). Annotations/ServiceMonitor batate hain kise
       scrape karna hai.</p>
       <pre># App ke /metrics ka sample:
http_requests_total{path="/checkout",code="500"} 42   # counter
process_resident_memory_bytes 3.2e+08                 # gauge

# PromQL — sawal poochne ki bhasha:
rate(http_requests_total{code="500"}[5m])   # 500s/sec, 5-min window
histogram_quantile(0.99, ...)               # p99 latency</pre>
       <p><b>Pull kyun better hai?</b> Central config (apps ko pata bhi nahi kaun scrape
       karta), health free mein milti hai (scrape fail = target down!), aur firehose-push
       se system nahi doobta.</p>`,
      `<h3>🪵 Logs + 🔔 Alerts — poora nervous system</h3>
       <pre>App → stdout/stderr likho (files NAHI — 12-factor!)
  → node par kubelet /var/log/containers/ mein rakhta hai
  → DaemonSet agent (Fluent Bit/Promtail) HAR node se uthata hai   ← Level 11!
  → aggregator (Loki / Elasticsearch) → Grafana mein search</pre>
       <p><b>Golden signals</b> — kisi bhi service ki sehat ke 4 sawal:
       <b>Rate</b> (kitna traffic), <b>Errors</b> (kitne fail), <b>Duration</b> (kitni der — p99!),
       <b>Saturation</b> (kitna bhara — CPU/memory/queue).</p>
       <div class="war-story"><b>⚡ Real incident (alert fatigue ka classic):</b> Ek team ke
       paas 400+ alerts the — CPU 80%, disk 70%, har chhoti cheez. On-call ne notifications
       mute kar rakhi thi (obviously). Ek raat DB ki disk 100% hui — woh alert bhi 399
       doosron mein doob gaya. 4 ghante ka outage. Post-mortem fix: alerts sirf SYMPTOMS
       par (users ko dikh raha error rate/latency), causes dashboards mein. Alert = "user
       ko dard ho raha hai", dashboard = "kyun ho raha hai". <b>Jo alert actionable nahi,
       woh noise hai.</b></div>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Observability Stack — Kaun Kya?',
        instructions: 'Har component ko uske kaam se milao.',
        pairs: [
          { left: '🔥 Prometheus', right: 'Metrics ko PULL/scrape karke time-series DB mein rakhta hai', explain: 'Har 15s /metrics endpoints se. Service discovery K8s API se — naye pods khud mil jaate hain.' },
          { left: '📊 Grafana', right: 'Dashboards + alerts ka UI — Prometheus/Loki dono ka face', explain: 'Data store nahi hai — visualization layer hai. Golden-signals dashboard har service ka pehla page.' },
          { left: '🚛 Fluent Bit / Promtail (DaemonSet)', right: 'HAR node se container logs uthata hai', explain: 'Level 11 ka DaemonSet use-case live! stdout → /var/log/containers → agent → aggregator.' },
          { left: '🗄️ Loki / Elasticsearch', right: 'Logs ka searchable central store', explain: 'Loki = "logs ka Prometheus" (labels se search, sasta); ES = full-text power (mehenga). Dono Grafana mein dikhte hain.' },
          { left: '📐 PromQL rate(...[5m])', right: 'Counter ki per-second speed — 5-min window par', explain: 'Counters hamesha badhte hain — unka RATE hi useful hai. rate(http_requests_total{code="500"}[5m]) = THE error-rate query.' },
        ],
      },
      {
        type: 'quiz',
        title: 'Golden Signals Thinking',
        questions: [
          {
            q: 'Checkout service ke liye PEHLA alert kaunsa banaoge (sirf ek chun sakte ho)?',
            choices: [
              'Error rate > 2% for 5 min — user-facing symptom, hamesha actionable',
              'CPU > 80% for 5 min — resource saturation sabse pehle dikhti hai',
              'Pod restarts > 0 — koi bhi restart ho toh turant pata chale',
              'Disk 70% full — kisi bhi node par, pehle se warning mile',
            ],
            answer: 0,
            explain: 'Symptom-based alerting! CPU 80% par users ko shayad koi dard nahi (HPA handle karega); error rate = definitely dard. Baaki sab dashboards mein — alert fatigue war-story yaad rakho.',
          },
          {
            q: 'p99 latency 2s hai par average 200ms. Manager bolta hai "average toh theek hai!" — tumhara jawab?',
            choices: [
              '100 mein se 1 request 2+ second leti hai — high traffic par yeh HAZAARON users hain; tail latency hi asli experience hai, average usse chhupa deta hai',
              'Average theek hai toh sab theek hai — p99 sirf 1% outliers hain, jo aksar bots aur health checks hote hain, real users nahi',
              'p99 ka data galat hoga — histogram buckets ki wajah se p99 hamesha 10x inflate hota hai, average hi bharosemand metric hai',
              'p99 sirf load-testing benchmarks ke liye hota hai — production SLOs average latency par hi likhe jaate hain, industry standard yahi hai',
            ],
            answer: 0,
            explain: 'Percentile thinking = SRE thinking. Average jhooth bolta hai (1 slow request 99 fast mein chhup jaati hai). Isliye SLOs p99/p95 par likhe jaate hain, average par kabhi nahi.',
          },
          {
            q: 'Prometheus target "DOWN" dikha raha hai ek service ka. Iska matlab kya ho sakta hai?',
            choices: [
              'Scrape fail ho raha hai — pod sach mein down ho sakta hai, ya /metrics endpoint nahi hai, ya NetworkPolicy ne Prometheus ko block kiya',
              'Sirf yeh ki pod crash ho chuka hai — Prometheus DOWN tabhi dikhata hai jab pod ka status Running se badal jaaye, network ya endpoint se nahi',
              'Prometheus khud overload hai — jab uski memory bharti hai toh woh random targets ko DOWN mark kar deta hai',
              'Grafana ka dashboard cache purana hai — target asal mein UP hai, browser refresh karne se theek dikhega',
            ],
            answer: 0,
            explain: 'DOWN = "main usse baat nahi kar paa raha" — reasons kai. NetPol wala case bahut real hai: default-deny lagaya, Prometheus ka scrape bhi kat gaya, sab targets DOWN. Layers connect ho rahe hain? Yehi advanced hona hai.',
          },
        ],
      },
      {
        type: 'fill',
        bonus: true,
        title: 'Good to Know — Scrape Config',
        instructions: 'Bonus: apni app ko Prometheus se scrape karwao (annotation pattern).',
        template: '# Deployment ke pod template mein:\n  metadata:\n    annotations:\n      prometheus.io/scrape: "{0}"\n      prometheus.io/port: "{1}"\n      prometheus.io/path: "{2}"\n\n# App code mein (koi bhi language ka prom client):\n#   counter: http_requests_total\n#   histogram: {3}',
        blanks: [
          { answer: 'true', explain: 'Discovery flag — Prometheus ki config in annotations ko dhundhti hai. (Operator-based setups mein ServiceMonitor CRD use hota hai — same idea, typed.)' },
          { answer: '9090', explain: 'Metrics ka port — main app port se alag rakhna accha pattern hai (internal-only, Ingress se expose mat karna!).' },
          { answer: '/metrics', explain: 'Standard path. Prometheus client library (har language mein) yeh endpoint bana deti hai.' },
          { answer: 'http_request_duration_seconds', explain: 'Histogram = duration ka distribution → issi se p99 nikalta hai (histogram_quantile). Naming convention: unit suffix (_seconds) zaroori hai!' },
        ],
        tokens: ['true', '9090', '/metrics', 'http_request_duration_seconds', 'false', '80', '/health', 'cpu_usage'],
      },
    ],
    interview: {
      title: 'Interview Round — Observability',
      instructions: '"Monitoring kaise karte ho" — har senior interview ka pakka sawal. 🎤',
      questions: [
        {
          q: '"K8s mein logs kaise collect hote hain — poora path batao" (user ke syllabus ka exact topic!)',
          choices: [
            'Apps stdout/stderr par likhti hain → node par /var/log/containers mein files → DaemonSet agent (Fluent Bit) har node se uthake Loki/ES bhejta hai → Grafana/Kibana mein search',
            'Har app apne logs seedha Elasticsearch/database mein likhti hai — sidecar ya agent ki zaroorat nahi, isliye har language mein logging library zaroori hai',
            'kubectl logs hi production logging hai — API server saare pods ke logs etcd mein 30 din tak rakhta hai, search wahin se hoti hai',
            'Logs sirf node ki disk par rehte hain aur pod delete hote hi kubelet unhe central storage mein copy kar deta hai — alag setup nahi chahiye',
          ],
          answer: 0,
          explain: 'Chain ke har link ka reason bolo: stdout (12-factor, container-native), DaemonSet (per-node concern — Level 11!), aggregator (search + retention — pods mare toh logs bache!). kubectl logs sirf live debugging hai, pod gaya toh woh bhi gaya.',
        },
        {
          q: 'Prometheus PULL model ke fayde push ke against — architecture sawal?',
          choices: [
            'Central control (kya/kab scrape), target health free mein (scrape fail = DOWN signal), app ko monitoring ka pata nahi chahiye, load Prometheus control karta hai',
            'Pull hamesha kam network use karta hai kyunki data compressed aata hai — push mein har sample alag HTTP request hota hai, bas yahi farak hai',
            'Pull sirf chhote clusters mein chalta hai — 100+ nodes par Prometheus scrape nahi kar pata, isliye bade setups push hi use karte hain',
            'Koi khaas farak nahi — dono same data dete hain; pull bas Prometheus ka historical design choice hai jo ab badal raha hai',
          ],
          answer: 0,
          explain: '"Scrape failure is itself a signal" — yeh line bolo. Balanced: short-lived jobs (batch/Lambda-style) ke liye Pushgateway exception hai — exception jaanna bhi depth hai.',
        },
        {
          q: 'On-call rotation ke liye alerting philosophy design karo — kya rules rakhoge?',
          choices: [
            'Alerts sirf user-facing symptoms par (errors, p99, availability), actionable + runbook linked; causes (CPU/disk/restarts) dashboards mein; jo alert mahino se fire nahi hua, delete',
            'Har metric par alert lagao — CPU, memory, disk, restarts sab; coverage full hogi toh koi incident miss nahi hoga, on-call engineer khud filter kar lega kaunsa zaroori hai',
            'Sirf critical alerts CEO aur CTO ko jaayein — engineers ko alerts bhejne se alert fatigue hota hai, leadership priority decide karegi',
            'Alerts ki zaroorat nahi — subah standup mein dashboards dekh lenge; raat ke incidents users khud support ticket se report kar dete hain',
          ],
          answer: 0,
          explain: 'Alert fatigue war-story ka framework: symptom-based, actionable, runbook, pruning. "Jo alert 3 AM uthne laayak nahi, woh alert nahi hona chahiye" — yeh line interviewer yaad rakhega.',
        },
      ],
    },
    success: [
      'Main Prometheus pull model + service discovery explain kar sakta hoon',
      'Main logs ka poora path (stdout → DaemonSet → aggregator) bata sakta hoon',
      'Main golden signals par dashboards/alerts design kar sakta hoon',
      'Main symptom-vs-cause alerting philosophy defend kar sakta hoon',
    ],
    homework: `<p>Poora stack ek command se (kube-prometheus-stack):</p>
      <pre># Helm chahiye hoga — agla level ka preview 😉:
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack
kubectl get pods -w      # prometheus, grafana, node-exporter (DaemonSet!), operator...
kubectl port-forward svc/monitoring-grafana 3000:80
# browser: localhost:3000 (admin / prom-operator)
# → "Kubernetes / Compute Resources" dashboards explore karo!
helm uninstall monitoring</pre>
      <p>✅ Self-check: Grafana mein apne cluster ke pods ki CPU/memory dikhi? node-exporter kitne pods tha — aur WOH kaunsa workload type hai? 😏</p>`,
    cards: [
      { front: 'Prometheus PULL model — 3 fayde?', back: '1) Central control (apps ko monitoring ki khabar nahi), 2) <b>scrape fail = free DOWN signal</b>, 3) load controlled (push storm nahi). Apps sirf /metrics endpoint dete hain, Prometheus har 15s aata hai.' },
      { front: 'K8s logs ka poora path?', back: 'App <b>stdout</b> → kubelet (/var/log/containers) → <b>DaemonSet agent</b> (Fluent Bit) → aggregator (Loki/ES) → Grafana. Pod mar jaaye, logs aggregator mein zinda. kubectl logs sirf live debugging.' },
      { front: 'Golden signals — 4 sawal?', back: '<b>Rate</b> (kitna traffic), <b>Errors</b> (kitne fail), <b>Duration</b> (p99 — average jhooth bolta hai!), <b>Saturation</b> (kitna bhara). Har service ka dashboard inhi 4 se shuru.' },
      { front: 'Alert kab banate hain, kab nahi?', back: 'Alert = <b>user-facing symptom</b> (error rate, p99) + actionable + runbook. Causes (CPU, disk, restarts) = dashboards. Jo alert 3 AM uthne laayak nahi = noise = delete.' },
    ],
  },

  /* ================= LEVEL 22: Helm & Kustomize ================= */
  {
    id: 'helm',
    icon: '⛵',
    title: 'Helm & Kustomize — YAML ka Intezaam',
    badge: 'Chart Chalak',
    objectives: [
      'YAML sprawl ki problem — 15 services × 3 environments = ?',
      '<b>Helm</b>: charts, values, releases — templating + package manager',
      '<b>Kustomize</b>: base + overlays — template-free patching',
      'Kab kaunsa (aur dono saath kaise) — real-world judgement',
    ],
    lesson: [
      `<h3>⛵ Helm — K8s ka package manager</h3>
       <pre>chart/
├── Chart.yaml          # naam, version
├── values.yaml         # defaults: replicas: 2, image.tag: "1.0"
└── templates/
    └── deployment.yaml # replicas: {{ .Values.replicas }}

helm install shop ./chart -f values-prod.yaml   # prod: replicas 10
helm upgrade shop ./chart --set image.tag=2.0
helm rollback shop 1                            # release history!</pre>
       <p>Do superpowers: <b>(1) Templating</b> — ek chart, har env ke values;
       <b>(2) Package manager</b> — duniya ke software ek command mein:
       <code>helm install prometheus prometheus-community/kube-prometheus-stack</code>
       (homework mein kiya!). Release history bhi — <code>helm rollback</code> free mein.</p>
       <p>Dark side: templates YAML nahi rehte (Go-template soup — <code>{{ if }}</code>
       indent nightmares), values.yaml ka jungle, aur debugging ke liye
       <code>helm template</code> chala ke output padhna padta hai.</p>`,
      `<h3>🩹 Kustomize — template-free, kubectl built-in</h3>
       <pre>base/deployment.yaml        # PURA VALID YAML (template nahi!)
overlays/prod/kustomization.yaml:
  resources: [../../base]
  patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 10

kubectl apply -k overlays/prod    # built-in! (-k flag)</pre>
       <p>Philosophy ka farak: Helm <b>generate</b> karta hai (template→YAML), Kustomize
       <b>patch</b> karta hai (YAML+diff→YAML). Base file valid YAML hai — IDE validation,
       diffs saaf.</p>
       <table>
         <tr><th>Situation</th><th>Choice</th></tr>
         <tr><td>3rd-party install (Prometheus, Ingress, ESO)</td><td><b>Helm</b> — ecosystem yahi hai</td></tr>
         <tr><td>Apni app, env-specific tweaks (staging vs prod)</td><td><b>Kustomize</b> — simple, GitOps-friendly</td></tr>
         <tr><td>Complex reusable internal platform chart</td><td>Helm (ya dono: <code>helm template | kustomize</code>)</td></tr>
       </table>
       <div class="war-story"><b>⚡ Real incident (copy-paste ka badla):</b> Ek team 15
       services ke liye YAML copy-paste karti thi. Security fix (runAsNonRoot) 15 jagah
       lagana tha — 13 mein laga, <b>2 bhool gaye</b>. Audit mein wahi 2 pakde gaye, aur
       unmein se ek mein incident bhi hua. Ab unka setup: ek shared Helm chart (ya kustomize
       base) — fix EK jagah, sab jagah lagta hai. <b>DRY sirf code ka nahi, YAML ka bhi
       usool hai.</b></div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Helm ya Kustomize?',
        instructions: 'Har situation ke liye pehla choice chuno. (Kuch mein dono chal sakte hain — best-fit socho!)',
        bins: [
          { id: 'helm', label: '⛵ Helm' },
          { id: 'kustomize', label: '🩹 Kustomize' },
        ],
        items: [
          { text: 'Prometheus stack install karna hai', bin: 'helm', explain: '3rd-party ecosystem = Helm charts. Community maintained, values se configure, upgrade path bhi.' },
          { text: 'Apni app: staging mein 2 replicas, prod mein 10', bin: 'kustomize', explain: 'Base + do overlays — template-free, kubectl built-in (-k), GitOps mein sabse clean diffs.' },
          { text: 'Product 50 customers ko distribute karna hai (sabki config alag)', bin: 'helm', explain: 'Package + versioned release + values interface = Helm ka janm isi liye hua. Kustomize distribute nahi karta.' },
          { text: 'Vendor ke YAML mein bas ek env var add karni hai', bin: 'kustomize', explain: 'Kisi ka bhi YAML patch kar do — fork nahi, template nahi. Kustomize ka superpower: strategic merge patch on anything.' },
          { text: 'Release history + ek-command rollback chahiye', bin: 'helm', explain: 'helm rollback shop 1 — release tracking built-in hai. (GitOps mein yeh git revert se hota hai — agla level!)' },
        ],
      },
      {
        type: 'fill',
        title: 'Helm Template Likho',
        instructions: 'Chart ke deployment template ke blanks bharo.',
        template: '# values.yaml:\nreplicas: 2\nimage:\n  repo: shop/web\n  tag: "2.4.0"\n---\n# templates/deployment.yaml:\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {0}-web\nspec:\n  replicas: {{ .Values.{1} }}\n  template:\n    spec:\n      containers:\n      - name: web\n        image: "{{ .Values.image.repo }}:{{ .Values.image.{2} }}"\n---\n# prod install:\nhelm install shop ./chart {3} values-prod.yaml',
        blanks: [
          { answer: '{{ .Release.Name }}', explain: 'Release ka naam template mein — ek chart se kai installs (shop-web, shop2-web...) bina naam takraaye.' },
          { answer: 'replicas', explain: '.Values = values.yaml ka tree. Prod values file isse override karegi (2 → 10).' },
          { answer: 'tag', explain: 'Nested access: .Values.image.tag. Tag ko quote karna ("2.4.0") YAML ka number-banne se bachata hai — classic Helm gotcha!' },
          { answer: '-f', explain: '-f values-prod.yaml = defaults ke upar prod overrides. Multiple -f bhi chalega (base → env → region layering).' },
        ],
        tokens: ['{{ .Release.Name }}', 'replicas', 'tag', '-f', '{{ .Chart.Name }}', 'replicaCount', 'version', '--dry-run'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Helm ops',
        questions: [
          {
            q: 'helm upgrade fail ho gaya beech mein — release "pending-upgrade" mein atki hai. Kya karoge?',
            choices: [
              'helm history se dekho, phir helm rollback — Helm release-level state rakhta hai; aage ke liye --rollback-on-failure (Helm 3: --atomic) se fail = auto-rollback',
              'Saare chart resources kubectl se manually delete karke helm install dobara chalao — release secret apne aap saaf ho jaayega aur lock bhi hat jaayega',
              'Cluster restart karo — pending-upgrade ka lock API server ki memory mein hota hai, restart se release unlock ho jaati hai',
              'helm delete --purge hi ekmatra raasta hai — pending release ka rollback Helm mein allowed nahi, fresh install karna padega',
            ],
            answer: 0,
            explain: 'Release history = Helm ka asli value. Pro-tip jo bolna: production upgrades mein --rollback-on-failure (Helm 3 mein --atomic) + --timeout lagao — fail hua toh khud rollback. Manual cleanup = drift + Helm confused forever. (helm delete --purge Helm 2 ka syntax tha.)',
          },
          {
            q: 'Helm chart install se pehle "isme actually KYA apply hoga" kaise dekhoge?',
            choices: [
              'helm template ./chart -f values.yaml (ya helm install --dry-run) — rendered YAML padho',
              'Install karke dekho, galat hua toh helm uninstall — dev cluster mein risk nahi',
              'Chart ke templates/ folder ki files ek-ek karke padho — wahi exact YAML hai',
              'values.yaml padh lo — jo values mein hai, wahi cluster mein jaata hai, aur kuch nahi',
            ],
            answer: 0,
            explain: 'KABHI andha install nahi — 3rd-party chart cluster-admin RBAC ya hostPath bhi laga sakta hai! helm template + grep for "ClusterRole\\|hostPath\\|privileged" = 2-minute security review.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Packaging',
      instructions: '"Helm ya Kustomize?" — trick question hai, dono bolo. 🎤',
      questions: [
        {
          q: '"Helm vs Kustomize — kab kya use karte ho?" (User ke syllabus ka exact sawal!)',
          choices: [
            'Helm = templating + packaging + releases (3rd-party installs, distributable charts); Kustomize = template-free base+overlay patching (apni apps, GitOps) — aksar DONO saath',
            'Helm purana hai aur Kustomize ne use replace kar diya — kubectl mein built-in hone ki wajah se ab sab naye projects aur vendors bhi Kustomize hi use karte hain',
            'Kustomize sirf chhote projects ke liye hai kyunki usme loops/conditions nahi hote; 10+ services hote hi Helm par migrate karna padta hai',
            'Dono same kaam karte hain — farak sirf syntax ka hai (Go templates vs YAML patches), team jo pehle seekh le wahi chuno, technical farak nahi',
          ],
          answer: 0,
          explain: '"Ya nahi, DONO" — mature answer. Concrete bolo: "Prometheus Helm se, apni services kustomize overlays se, aur vendor charts ko helm template | kustomize se patch karte hain." Real-world texture instant credibility deta hai.',
        },
        {
          q: 'Ek hi chart se staging (2 replicas, debug on) aur prod (10 replicas, resources bade) — Helm mein kaise?',
          choices: [
            'Ek chart + values-staging.yaml / values-prod.yaml — install par -f se layer karo; secrets values mein NAHI (ESO/pipeline se — pichhla level!)',
            'Staging aur prod ke do alag charts banao — environments ka code alag rehna chahiye taaki ek ki galti doosre mein na jaaye',
            'Template mein har jagah if eq .Values.env prod likho — ek hi values file mein saare environments ki logic rakho, files kam',
            'Ek chart install karo aur prod ke liye install ke baad kubectl edit se replicas/resources badal do — Helm ko baad ke changes se farak nahi',
          ],
          answer: 0,
          explain: '"Build once (chart), configure per env (values)" — Level 7 ka 12-factor principle packaging layer par repeat. Do charts = drift guarantee. Aur secrets-in-values ka red flag khud raise karna = security awareness.',
        },
        {
          q: '3rd-party Helm chart install karne se pehle tumhari review checklist?',
          choices: [
            'helm template se rendered YAML dekho — RBAC (cluster-admin?!), privileged/hostPath, resource requests, image sources — phir chart version pin karke install',
            'GitHub stars aur Artifact Hub downloads dekho — popular charts community review ho chuke hote hain, isliye unka latest version seedha install karna safe hai',
            'Chart ka README padhna kaafi hai — maintainers saari permissions aur risks README mein likhte hain, YAML padhne ki zaroorat nahi',
            'Kuch nahi — Helm install se pehle chart ko sandbox mein chalata hai aur khatarnaak RBAC apne aap block kar deta hai',
          ],
          answer: 0,
          explain: 'Supply-chain thinking (Level 15 ka war-story yaad hai?): chart = cluster mein arbitrary YAML. Template-review + version pinning + values audit. "Charts are code — review like code."',
        },
      ],
    },
    success: [
      'Main Helm (template+package+release) aur Kustomize (base+overlay) dono ka model jaanta hoon',
      'Main sahi tool chun sakta hoon — aur dono ko combine bhi kar sakta hoon',
      'Main chart likhna, values layer karna, aur release rollback karna jaanta hoon',
      'Main 3rd-party charts ko security-review karke install karta hoon',
    ],
    homework: `<p>Ek hi app, teen tarike — farak khud mehsoos karo:</p>
      <pre># 1) Helm:
helm create myapp && cat myapp/templates/deployment.yaml   # template soup dekho
helm template myapp ./myapp | head -40                     # rendered output
# 2) Kustomize:
mkdir -p kust/base kust/prod
# base mein plain deployment.yaml + kustomization.yaml likho,
# prod overlay mein replicas patch — phir:
kubectl kustomize kust/prod                                # rendered output
# 3) compare: kaunsa padhna easy tha? kaunsa likhna?</pre>
      <p>✅ Self-check: dono ka rendered output dekha? Ab tumhari opinion experience-based hai, ratti hui nahi. 🎓</p>`,
    cards: [
      { front: 'Helm vs Kustomize — ek line ka divide?', back: '<b>Helm</b> = GENERATE (template + values + package + release history) — 3rd-party installs ka standard. <b>Kustomize</b> = PATCH (valid base YAML + overlays) — apni apps ke env variants, kubectl built-in (-k). Aksar dono saath!' },
      { front: 'Staging vs prod config Helm mein kaise?', back: 'EK chart + alag values files (<code>-f values-prod.yaml</code>). Do charts kabhi nahi (drift!). Template mein env-if bhi nahi. Secrets values mein NAHI — ESO se.' },
      { front: '3rd-party chart install se pehle kya?', back: '<code>helm template</code> se rendered YAML REVIEW: cluster-admin RBAC? privileged/hostPath? resources? Phir version pin karke install. Chart = arbitrary YAML = code ki tarah review karo.' },
      { front: 'helm upgrade production mein kaunse flags?', back: '<code>--atomic</code> (fail = auto-rollback) + <code>--timeout</code>. Release history rehti hai — <code>helm rollback shop 1</code> ek command mein wapas. (GitOps mein yahi git revert banega!)' },
    ],
  },

  /* ================= LEVEL 23: CRDs & Operators ================= */
  {
    id: 'operators',
    icon: '🤖',
    title: 'CRDs & Operators — API Ko Sikhao Naye Kaam',
    badge: 'Operator Ojha',
    objectives: [
      '<b>CRD</b> — Kubernetes API mein apna naya "kind" register karna',
      '<b>Operator pattern</b> = CRD + custom controller (wahi reconciliation!)',
      'Operators kya automate karte hain — DB failover, backups, upgrades',
      'Operator debugging — CR status + operator logs',
    ],
    lesson: [
      `<h3>🤖 Track ka sabse bada "aha!" moment</h3>
       <p>Level 2 yaad karo: controllers desired state ko actual se milate hain. Ab socho —
       <b>agar tum APNA object type bana sako aur uska APNA controller likh sako?</b></p>
       <pre># 1) CRD: API Server ko naya kind sikhao
kind: CustomResourceDefinition
spec:
  group: db.example.com
  names: { kind: PostgresCluster }
  # ab "kubectl get postgresclusters" ek REAL command hai!

# 2) Custom Resource: developer ki wish
kind: PostgresCluster
metadata: { name: shop-db }
spec:
  replicas: 3
  version: "16"
  backup: { schedule: "0 2 * * *" }

# 3) Operator (controller pod): wish → reality
#    watch PostgresCluster → StatefulSet+PVCs banao, replication
#    set karo, backups chalao, failover sambhalo, upgrades karo</pre>
       <p>Operator = <b>senior DBA ki expertise, code mein</b> — 24/7, bina thake. Prometheus
       stack ke saath ek "operator" pod aaya tha homework mein — yahi tha! cert-manager,
       ESO (Level 20!), sab operators hain. Tumne already 3 use kar liye hain. 😄</p>`,
      `<h3>🔄 Reconciliation — ab TUMHARE object par</h3>
       <p>Operator ka loop bilkul ReplicaSet controller jaisa: watch → compare desired
       (CR spec) vs actual → act → status update. Kubernetes ka core pattern <b>extend</b>
       ho gaya — yehi "platform banane wala platform" hone ki asli taakat hai.</p>
       <pre># Debugging bhi wahi patterns:
kubectl get postgresclusters                  # CR list + STATUS column
kubectl describe postgrescluster shop-db      # status conditions + events
kubectl logs -n operators deploy/pg-operator  # operator ke apne logs!</pre>
       <div class="war-story"><b>⚡ Real incident (operator ki jeet):</b> Ek company ka
       Postgres primary node raat 2:40 par hardware failure se gaya. Postgres operator ne:
       failure detect kiya (10s), replica ko promote kiya (30s), Services ka endpoint naye
       primary par kiya, aur naya replica provision karna shuru kar diya. <b>Total downtime:
       ~45 second. On-call ko subah pata chala.</b> Manual process hota: page → uthna →
       samajhna → promote commands → 30-60 min minimum. Yehi operator pattern ka business
       case hai — aur isi liye "operators for stateful apps" ab default expectation hai.</div>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Operator ki Kahani — Failover Night',
        instructions: 'Postgres primary crash hua. Operator ka reconciliation flow sahi order mein lagao.',
        steps: [
          { text: 'Operator health-check mein dekhta hai: db-0 (primary) respond nahi kar raha', explain: 'Operator continuously watch kar raha tha — CR ka desired state pata hai (3 healthy replicas, ek primary).' },
          { text: 'Actual ≠ desired: primary missing! Reconcile shuru', explain: 'Wahi Level 2 wala moment — farak dikha, action shuru. Bas ab logic PostgreSQL-aware hai.' },
          { text: 'Sabse up-to-date replica (db-1) ko primary PROMOTE karta hai', explain: 'Yeh DBA-expertise hai code mein: replication lag compare karke sahi candidate chunna — random nahi!' },
          { text: 'Service/endpoints ko naye primary par point karta hai', explain: 'Apps ka connection string wahi (db-primary-svc) — unhe khabar bhi nahi hui ki primary badla.' },
          { text: 'Naya replica provision karke replication join karata hai', explain: 'Desired: 3 replicas. Actual: 2. Ek aur banao — StatefulSet+PVC ka sab gyaan (Level 11-12) operator ke andar chal raha hai.' },
          { text: 'CR ka status update: "Healthy, primary: db-1, replicas: 3/3"', explain: 'kubectl get postgresclusters mein yahi dikhega. Total: ~45 seconds, zero human. 🤖' },
        ],
      },
      {
        type: 'match',
        title: 'Operator Ecosystem',
        instructions: 'Famous operators ko unke kaam se milao — inme se kuch tum use kar chuke ho!',
        pairs: [
          { left: 'cert-manager', right: 'TLS certificates auto-issue + renew (Let\'s Encrypt se)', explain: 'Certificate CRD likho → operator issue/renew sambhalta hai. Level 14 ke Ingress TLS ka best friend — expired-cert incidents ki maut.' },
          { left: 'External Secrets Operator', right: 'Vault/AWS SM se K8s Secrets sync', explain: 'Level 20 mein use kiya! ExternalSecret CRD + sync controller = operator pattern textbook.' },
          { left: 'Prometheus Operator', right: 'ServiceMonitor CRDs se monitoring stack manage', explain: 'Level 21 ke homework mein aaya tha. Scrape configs ab typed CRDs hain — annotations ka jungle khatam.' },
          { left: 'Postgres/MySQL operators', right: 'DB provisioning, failover, backups, upgrades — full DBA automation', explain: 'War-story wala hero. CloudNativePG, Zalando postgres-operator... stateful apps ka standard ab yahi hai.' },
          { left: 'ArgoCD', right: 'Application CRD se GitOps sync (agla level! 😉)', explain: 'Haan — ArgoCD bhi operator hai! Application CR = desired (git repo), controller = sync. Sab kuch connect ho raha hai...' },
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Operator judgement',
        questions: [
          {
            q: 'Har cheez ke liye operator likhna chahiye? Apni simple stateless web-app ke liye?',
            choices: [
              'Nahi! Deployment+HPA pehle se sab karta hai — operator tab jab OPERATIONAL knowledge automate karna ho (failover, backups, complex upgrades); stateless app ke liye overkill',
              'Haan — operator hamesha better hai kyunki woh app ko Kubernetes-native banata hai; Deployment purana pattern hai jo dheere-dheere operators se replace ho raha hai',
              'Nahi — operators sirf databases ke liye allowed hain; Kubernetes stateless apps ke liye CRD banane ki ijaazat nahi deta',
              'Haan — Operator SDK se 10 minute ka kaam hai, aur operator har app ko apne aap autoscaling aur self-healing deta hai jo Deployment nahi deta',
            ],
            answer: 0,
            explain: 'Judgement question! Operator ki cost hai: likhna, test karna, MAINTAIN karna (controller bugs = naye outage modes!). Rule: "kya main runbook automate kar raha hoon jo built-ins nahi kar sakte?" Nahi → built-ins use karo.',
          },
          {
            q: 'kubectl get crds se kya pata chalta hai cluster ke baare mein?',
            choices: [
              'Kaunse operators/extensions installed hain — cluster ka "extended vocabulary" (externalsecrets? servicemonitors? applications? = ESO, Prometheus, ArgoCD hai)',
              'Sirf Kubernetes ka version aur enabled feature gates — CRD list har version mein alag hoti hai, isliye usse cluster ka exact version aur flags pata chalte hain',
              'Kitne pods aur namespaces chal rahe hain — har CRD ek running workload ko represent karta hai, isliye yeh capacity ka naksha hai',
              'Kuch khaas nahi — CRDs sirf Kubernetes ke built-in types hain (Pod, Service...) jo har cluster mein same hote hain',
            ],
            answer: 0,
            explain: 'Naye cluster mein ghuste hi yeh command chalao — CRD list = "yahan kaun se robots kaam karte hain" ka naksha. Debugging mein bhi: unknown kind dikhe toh CRD check karo.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — CRDs & Operators',
      instructions: 'Architecture-level samajh ka test — core pattern ko extend karna. 🎤',
      questions: [
        {
          q: '"Operator pattern kya hai aur kab justify hota hai?" — complete jawab?',
          choices: [
            'CRD (naya API type) + custom controller (reconcile loop) = domain expertise automated; justify jab complex OPERATIONAL knowledge ho — DB failover, backup/restore, coordinated upgrades',
            'Operator = koi bhi controller jo pods banata hai — Deployment controller bhi operator hai, isliye har app ke liye apna ek operator likhna hi best practice maana jaata hai',
            'Operator = ek on-call engineer ka role jo cluster chalata hai; Kubernetes mein yeh sirf documentation ka shabd hai, koi technical pattern nahi',
            'Operator = Red Hat OpenShift ka product jo sirf OpenShift par chalta hai; vanilla Kubernetes mein CRDs ke saath controllers allowed nahi',
          ],
          answer: 0,
          explain: 'Formula bolo: CRD + controller + reconciliation. Phir justify-kab: "runbook jo baar-baar chalta hai aur galti-prone hai = operator candidate". Anti-case bhi bolo (stateless app? overkill) — balance hi seniority hai.',
        },
        {
          q: 'PostgresCluster CR apply kiya par DB pods nahi ban rahe. Debug path?',
          choices: [
            'kubectl describe postgrescluster (status + events) → operator pod ke LOGS (reconcile kyun fail? RBAC? quota? storage?) → operator ka RBAC/config check',
            'CR delete karke dobara apply karo — operator kabhi-kabhi pehla event miss kar deta hai, naya create event reconcile ko phir se trigger karega aur pods ban jaayenge',
            'Postgres image ko ek normal Deployment mein manually chala do — operator baad mein us pod ko adopt karke manage karne lagega',
            'CRD reinstall karo — CRD ka schema kharab hai toh controller CR padh hi nahi paata, reinstall se schema refresh hota hai',
          ],
          answer: 0,
          explain: 'Naya layer, wahi method: CR ka status → controller ke logs. "Operator bhi ek pod hai jiske apne logs/RBAC hain" — yeh realize karna hi operator-debugging hai. (Operator ka RBAC missing = silent no-op, classic!)',
        },
        {
          q: 'CRD aur ConfigMap dono mein config rakh sakte ho — CRD kab better hai?',
          choices: [
            'Jab TYPED schema (API-level validation), status reporting aur us par act karne wala controller chahiye — CRD first-class API hai; ConfigMap bas ek data bag',
            'CRD hamesha better hai — ConfigMap ka size 1MB tak limited hai jabki CRD objects mein koi limit nahi, isliye saara config CRD mein rakho',
            'ConfigMap deprecated ho raha hai — Kubernetes 1.32 se naye config ke liye CRD recommended hai, ConfigMap sirf backward compatibility ke liye',
            'Dono bilkul same hain — CRD bas ConfigMap ka naya naam hai jisme apiVersion likhna padta hai, validation dono mein same hota hai',
          ],
          answer: 0,
          explain: 'Subtle design question! CRD = validation (galat spec REJECT at apply), versioning, RBAC per-type, status subresource, kubectl UX. ConfigMap = untyped bag. "Agar controller act karega aur schema hai → CRD" — crisp rule.',
        },
      ],
    },
    success: [
      'Main CRD + controller = operator ka formula aur reconciliation connection samjha sakta hoon',
      'Main operators ka business case (45-second failover!) explain kar sakta hoon',
      'Main CR status + operator logs se operator issues debug kar sakta hoon',
      'Main "operator kab overkill hai" ka judgement de sakta hoon',
    ],
    homework: `<p>cert-manager install karke operator pattern ko chhoo ke dekho:</p>
      <pre>helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \\
  --namespace cert-manager --create-namespace --set crds.enabled=true
kubectl get crds | grep cert-manager     # naye kinds: certificates, issuers...
# self-signed issuer + certificate banao:
kubectl apply -f - &lt;&lt;EOF
apiVersion: cert-manager.io/v1
kind: Issuer
metadata: { name: selfsigned }
spec: { selfSigned: {} }
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: { name: my-cert }
spec:
  secretName: my-cert-tls
  dnsNames: [ myapp.local ]
  issuerRef: { name: selfsigned, kind: Issuer }
EOF
kubectl get certificate -w       # READY True hote dekho
kubectl get secret my-cert-tls   # operator ne TLS secret BANA diya! 🤖
helm uninstall cert-manager -n cert-manager</pre>
      <p>✅ Self-check: tumne CR likha, operator ne Secret banaya — desired → actual, tumhare object par. Pattern click hua?</p>`,
    cards: [
      { front: 'Operator = ? (formula)', back: '<b>CRD</b> (naya API kind) + <b>custom controller</b> (reconciliation loop) = operational expertise automated. Wahi Level-2 pattern, ab TUMHARE object par. Examples tum use kar chuke: ESO, cert-manager, Prometheus operator.' },
      { front: 'Operator kab justified, kab overkill?', back: 'Justified: complex ops knowledge — DB failover, backups, coordinated upgrades (runbook automation). Overkill: stateless apps — Deployment+HPA kaafi. Operator ki maintenance cost real hai!' },
      { front: 'CR apply kiya, kuch nahi hua — debug path?', back: '1) <code>describe &lt;cr&gt;</code> — status conditions/events, 2) <b>operator pod ke logs</b> (reconcile error yahin dikhega), 3) operator ka RBAC (missing = silent no-op). Operator bhi bas ek pod hai!' },
      { front: 'Naye cluster mein pehli explorer command?', back: '<code>kubectl get crds</code> — cluster ka extended vocabulary = kaunse operators/robots yahan kaam karte hain (externalsecrets? applications? certificates?). Cluster ki personality ka naksha.' },
    ],
  },

  /* ================= LEVEL 24: GitOps with ArgoCD ================= */
  {
    id: 'gitops',
    icon: '🔄',
    title: 'GitOps — ArgoCD se Cluster Ko Git Se Bandho',
    badge: 'GitOps Guru',
    objectives: [
      'GitOps ke 4 usool — aur "laptop se kubectl apply" ka ant',
      '<b>ArgoCD</b>: Application CR, sync, health — operator pattern in action',
      '<b>Drift detection</b> — manual changes ka khatma',
      'Rollback = git revert; audit = git log',
    ],
    lesson: [
      `<h3>🔄 Push se Pull tak</h3>
       <p>Ab tak: CI pipeline (ya tum) <code>kubectl apply</code> PUSH karte the. Problems:
       cluster credentials CI mein (Level 18 ka war-story!), kisne kya change kiya pata
       nahi, cluster ka asli state kya hai koi nahi jaanta.</p>
       <p><b>GitOps ulta karta hai — cluster khud PULL karta hai:</b></p>
       <pre>1. Declarative  — poora system YAML mein described
2. Versioned    — git = single source of truth
3. Auto-pulled  — agent (ArgoCD) cluster KE ANDAR se git dekhta hai
4. Reconciled   — continuously: git vs cluster compare, farak = fix</pre>
       <pre># ArgoCD Application CR (haan — CRD! Level 23 se seedha):
kind: Application
spec:
  source: { repoURL: git@...:shop-manifests, path: prod }
  destination: { namespace: shop }
  syncPolicy:
    automated: { prune: true, selfHeal: true }   # drift ka ilaaj</pre>
       <p>Deploy ka naya matlab: <b>PR merge karo. Bas.</b> ArgoCD 3 min mein sync kar dega.
       Rollback? <b>git revert</b> + sync. Audit? <b>git log</b>. Access? Cluster creds kisi
       CI mein NAHI — ArgoCD andar hai, bahar se koi apply nahi karta.</p>`,
      `<h3>🕵️ Drift — GitOps ka killer feature</h3>
       <p>Koi manually <code>kubectl edit deploy</code> kar de (3 AM jugaad!)? ArgoCD turant
       dikhata hai: <b>OutOfSync</b> — git kuch aur bolta hai, cluster kuch aur.
       <code>selfHeal: true</code> ho toh wapas git wala laga bhi deta hai — automatically.</p>
       <div class="war-story"><b>⚡ Real incident (drift ka klasik):</b> On-call ne 3 AM par
       memory limit manually badha di (sahi mitigation!) — par git update karna bhool gaya.
       2 hafte baad kisi aur ne unrelated change deploy kiya — ArgoCD/pipeline ne poora
       manifest sync kiya — <b>limit wapas purani ho gayi, OOM outage wapas aa gaya</b>.
       Sab confused: "yeh toh fix ho chuka tha?!" GitOps ka rule: <b>har change, chahe
       3 AM ka ho, git se hoke jaayega</b> (emergency PR + fast-track merge). Cluster ko
       haath lagana = us fix ko udhaar par jeena.</div>
       <p>💡 ArgoCD khud bhi operator hai (Application CRD + sync controller) — Level 23
       ka pattern. Aur uski "app health" Grafana-jaisi dikhti hai — sab levels mil rahe
       hain ab. 🧩</p>
       <p>🔄 <b>ArgoCD ka poora shastra</b> — sync policies, waves & hooks, App-of-Apps,
       ApplicationSets, Projects/RBAC aur <b>Argo Rollouts se canary</b> — <b>🔄 ArgoCD
       Gurukul</b> track mein hai (home screen par, hamesha unlocked), asli
       <code>argocd</code> terminal ke saath. Yeh level GitOps ki neev hai; woh track uski
       poori imaarat.</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'GitOps Deploy ka Safar',
        instructions: 'Feature deploy karna hai — GitOps duniya mein. Sahi order lagao.',
        steps: [
          { text: 'Developer manifest change ka PR banata hai (image: v2.5)', explain: 'Change ka janm GIT mein hota hai — kubectl mein nahi. PR = review + approval + record.' },
          { text: 'Review + CI checks pass → PR merge hota hai', explain: 'Yahin AUDIT ban gaya: kisne, kab, kya, kisne approve kiya — git log mein hamesha.' },
          { text: 'ArgoCD (cluster ke andar) git poll karta hai → naya commit dikha', explain: 'PULL model: cluster bahar jhankta hai, koi bahar se ghusta nahi. CI ke paas cluster creds hain hi nahi!' },
          { text: 'ArgoCD diff nikalta hai: git (v2.5) vs cluster (v2.4) → OutOfSync', explain: 'Comparison continuous hai. Manual drift bhi ISI mechanism se pakda jaata hai.' },
          { text: 'Auto-sync: ArgoCD apply karta hai → rolling update chalta hai', explain: 'Wahi Deployment machinery (Track 1!) — bas trigger ab git hai, human nahi.' },
          { text: 'Health check: naye pods READY → Application "Healthy + Synced" ✓', explain: 'ArgoCD readiness tak dekhta hai (Level 10 ka payoff!). Fail hota toh red — aur rollback = git revert.' },
        ],
      },
      {
        type: 'incident',
        title: '🚨 Deploy Gayab Ho Gaya!',
        instructions: 'GitOps-era ka incident — purane reflexes yahan dhokha denge.',
        pager: '<b>ALERT:</b> payment-service ki memory limit wapas purani ho gayi — OOMKills phir shuru · 2 hafte pehle "fix" hua tha',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ kubectl describe deploy payments | grep -i memory\n  memory: 256Mi        ← 2 hafte pehle 512Mi kiya tha?!\n\n$ argocd app history payments\nID  DATE         REVISION\n41  today 09:12  abc123 (unrelated config change, synced OK)',
            text: 'Limit khud "wapas" kaise ho gayi? Sabse pehla shak?',
            choices: [
              { t: 'Git check karo — 3 AM wala fix shayad sirf cluster mein tha, git mein kabhi aaya hi nahi; aaj ke sync ne git ka (purana) sach wapas laga diya', good: true, next: 'n2', explain: 'GitOps mein cluster ki har "memory" git se aati hai. Manual fix = udhaar — agla sync usse wasool leta hai. War-story live!' },
              { t: 'ArgoCD ka bug hai — usse restart karo', good: false, explain: 'ArgoCD ne apna kaam PERFECT kiya: git jo bolta tha wahi lagaya. Bug system mein nahi, PROCESS mein tha (fix git tak nahi pahuncha).' },
              { t: 'Kisi ne jaan-boojh ke revert kiya hoga — logs kholo, culprit dhundo', good: false, explain: 'Blame-hunt se pehle mechanism samjho. git log 2 min mein dikha dega ki limit-change commit KABHI EXIST hi nahi karta tha. No villain, just drift.' },
            ],
          },
          n2: {
            sitrep: '$ git log --oneline -- prod/payments/\nabc123 (today) update config\ndef456 (3wk ago) add payments HPA\n# ... koi "memory 512Mi" commit NAHI hai. Confirmed: fix git mein kabhi gaya hi nahi.',
            text: 'Ab OOMKills phir ho rahe hain. Sahi sequence kya hai?',
            choices: [
              { t: 'Emergency PR: limit 512Mi → fast-track review → merge → ArgoCD sync — 10 min mein fix, is baar PERMANENT', good: true, next: 'end', explain: 'GitOps ka emergency path bhi git se hai — bas fast lane mein. Ab yeh fix kabhi "gayab" nahi hoga, aur git log mein iski kahani bhi hai.' },
              { t: 'kubectl edit se abhi badha do, PR baad mein bana denge', good: false, explain: 'YEHI galti dobara?! selfHeal on hua toh ArgoCD minutes mein revert kar dega; nahi bhi ho toh "baad mein" kabhi nahi aata — do hafte pehle bhi yahi socha tha. 😅' },
              { t: 'ArgoCD ka auto-sync band kar do, phir manual fix karo aaram se', good: false, explain: 'Drift-protection ko maarna = GitOps ke saare fayde maarna. Ek incident ke liye poore system ka immune system band? Fix PROCESS se karo, system todke nahi.' },
            ],
          },
          end: {
            end: true,
            text: 'Fix merged, synced — aur ab AMAR hai. 🧯',
            summary: '<b>GitOps ka pehla usool ab khoon mein hai:</b> cluster ko kabhi seedha mat chhuo — har change (emergency bhi!) git → sync se. Manual jugaad = udhaar jo agla sync wasoolega. Aur jab kuch "khud badal jaaye": pehle <code>git log</code>, phir shak.',
          },
        },
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — ArgoCD ops',
        questions: [
          {
            q: 'ArgoCD Application "Synced" hai par "Degraded" (health red). Matlab?',
            choices: [
              'Git aur cluster MATCH karte hain (synced), par resources unhealthy hain — jaise pods CrashLoop mein (git ka YAML hi kharab deploy laya!). Sync ≠ working',
              'ArgoCD confuse ho gaya hai — Synced aur Degraded ek saath hona impossible hai, application controller restart karo toh sahi status aa jaayega',
              'Git repo down hai — ArgoCD aakhri cached state ko Synced dikhata hai aur repo na milne ko Degraded health se batata hai',
              'Sync abhi chal raha hai — Degraded ka matlab sync adhoora hai; complete hote hi health apne aap Healthy ho jaayegi, kuch karna nahi',
            ],
            answer: 0,
            explain: 'Do alag axes: Sync (git==cluster?) aur Health (resources theek?). Synced+Degraded = "git ka sach hi bimaar hai" — ab Track 1-2 ki debugging (logs/describe/events) shuru. GitOps delivery fix karta hai, bugs nahi!',
          },
          {
            q: 'App-of-apps pattern kya hai ArgoCD mein?',
            choices: [
              'Ek parent Application jo aur Applications ko manage karta hai — poore platform ka bootstrap ek CR se (sab teams/apps ka tree)',
              'Do ArgoCD instances ek doosre ko manage karte hain — ek gir jaaye toh doosra use wapas install kar deta hai (HA pattern)',
              'Ek Application ke andar ke saare pods ko apps kehte hain — app-of-apps unki list dikhane wala view hai, alag resource nahi',
              'Purana deprecated feature hai — ArgoCD 2.x mein ApplicationSet ne ise poori tarah hata diya, ab yeh kaam nahi karta',
            ],
            answer: 0,
            explain: 'Scale ka pattern: apps/ folder mein har team ki Application CRs, ek root Application unhe point karta hai. Naya cluster? Root apply karo — POORA platform khud khada ho jaata hai. Disaster recovery ka bhi jawab yahi hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — GitOps',
      instructions: 'Modern delivery ka final word. 🎤',
      questions: [
        {
          q: '"GitOps kya hai aur push-based CI/CD se better kyun?" — complete pitch?',
          choices: [
            'Git = declarative source of truth; cluster ke ANDAR ka agent pull+reconcile karta hai — fayde: CI ke paas cluster creds nahi, drift detect+self-heal, audit = git log, rollback = git revert',
            'GitOps matlab YAML ko git mein rakhna — deploy CI se kubectl apply ho ya haath se, jab tak file git mein hai woh GitOps hai; tool aur pull/push se koi farak nahi padta',
            'GitOps sirf ArgoCD ka marketing naam hai — andar se woh bhi CI ki tarah kubectl push karta hai, bas UI acchi hai aur dashboard milta hai',
            'Push wala CI/CD hi better hai — GitOps mein har change ke liye PR banana padta hai jo slow hai, aur pull-based agent extra attack surface hai',
          ],
          answer: 0,
          explain: '5 fayde ginwao: security (pull!), drift, audit, rollback, DR. Har ek pichhle levels se juda hai — RBAC war-story (CI creds), drift incident, operators pattern. Story sunao, features mat rato.',
        },
        {
          q: 'Production emergency mein GitOps slow nahi ho jaata? ("PR review ka time kahan hai 3 AM par?")',
          choices: [
            'Emergency lane: fast-track approval (1 reviewer/break-glass), phir bhi git SE — 5-10 min; kyunki manual kubectl fix agle sync par ud jaata hai aur uska record nahi rehta',
            'Haan — isliye emergencies mein ArgoCD ka auto-sync band karke kubectl se fix karte hain aur git ko baad mein kabhi update nahi karte; drift chalta rehta hai',
            'ArgoCD ko us raat delete karke manually chalate hain — GitOps sirf normal din ke liye hai, incident mein speed hi sab kuch hai',
            'GitOps mein emergencies hoti hi nahi — har change PR se review hota hai, isliye production incidents ka chance zero ho jaata hai',
          ],
          answer: 0,
          explain: 'Drift-incident ki kahani sunao (fix gayab hone wali). "Break-glass process bhi git through" — yeh operational maturity ka jawab hai. Alternative (manual + baad mein sync) ke failure modes gina do.',
        },
        {
          q: 'ArgoCD khud kis pattern par bana hai — aur yeh kyun elegant hai?',
          choices: [
            'Operator pattern: Application CRD + reconcile controller — wahi core K8s loop (desired = git, actual = cluster); K8s ki philosophy se hi K8s deploy hota hai 🐢',
            'Webhooks ke jaal par — har git push par GitHub ArgoCD ko webhook bhejta hai aur ArgoCD seedha kubectl apply chalata hai, beech mein koi reconcile loop nahi hota',
            'Cron jobs par — har 3 minute mein ek CronJob git pull karke kubectl apply karta hai; isliye ArgoCD sync ka default 3 minute hai',
            'SSH par — ArgoCD har node par SSH karke containers start karta hai, isliye use cluster-admin aur node keys dono chahiye',
          ],
          answer: 0,
          explain: 'Yeh jawab poore course ka bow-tie hai: Level 2 (reconciliation) → Level 23 (CRD+controller) → Level 24 (git as desired state). Interviewer ko yeh connection dikhao — "system ko ek pattern ke roop mein dekhta hai" wala impression.',
        },
      ],
    },
    success: [
      'Main GitOps ke 4 usool aur unke concrete fayde gina sakta hoon',
      'Main ArgoCD ka sync/health model aur drift detection samjha sakta hoon',
      'Main "manual fix gayab" jaisa drift incident pehchaan aur roka sakta hoon',
      'Main emergency-change ka GitOps-compatible process design kar sakta hoon',
    ],
    homework: `<p>ArgoCD ko khud chala ke dekho — 20 min ka best investment:</p>
      <pre>kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl get pods -n argocd -w             # sab Running tak
kubectl port-forward svc/argocd-server -n argocd 8080:443
# password:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
# browser: https://localhost:8080 (admin / upar wala)
# UI se: NEW APP → koi bhi public repo (argoproj/argocd-example-apps ka
# guestbook path try karo) → SYNC → tree view mein resources dekho!
# phir kubectl se kuch manually edit karo → OutOfSync hote dekho 🕵️</pre>
      <p>✅ Self-check: OutOfSync hota dekha manual edit par? Ab drift tumhare liye abstract nahi, aankhon-dekha hai.</p>`,
    cards: [
      { front: 'GitOps ke 4 usool?', back: '1) <b>Declarative</b> (sab YAML), 2) <b>Versioned</b> (git = truth), 3) <b>Pulled</b> (agent andar se — CI ke paas cluster creds NAHI), 4) <b>Reconciled</b> (continuous git-vs-cluster compare). Deploy = PR merge.' },
      { front: 'Drift kya hai aur GitOps kaise handle karta hai?', back: 'Manual change (kubectl edit) → cluster ≠ git → ArgoCD <b>OutOfSync</b> dikhata hai; selfHeal on ho toh git wala wapas laga deta hai. Moral: 3 AM ka fix bhi GIT se (emergency PR) — warna agla sync usse kha jayega!' },
      { front: 'ArgoCD Synced par Degraded — matlab?', back: 'Git==cluster (synced) par resources bimaar (CrashLoop etc.) — <b>git ka sach hi kharab hai</b>. Sync ≠ working! Ab normal debugging: logs/describe/events. GitOps delivery theek karta hai, bugs nahi.' },
      { front: 'GitOps mein rollback aur audit?', back: '<b>Rollback = git revert</b> (+ sync). <b>Audit = git log</b> (kaun/kab/kya/kisne approve). DR bonus: naya cluster + root Application apply = poora platform rebuild (app-of-apps).' },
    ],
  },

  /* ================= LEVEL 25: Service Mesh — Istio ================= */
  {
    id: 'istio',
    icon: '🕸️',
    title: 'Service Mesh — Istio ka mTLS aur Canary Jaadu',
    badge: 'Mesh Mahant',
    objectives: [
      'Mesh KYUN exist karta hai — 3 problems jo app-code mein solve karna galat hai',
      'Sidecar model: Envoy proxy har pod mein — bina code change',
      '<b>mTLS</b> — pod-to-pod encryption + identity',
      '<b>Canary deployments</b> — VirtualService se 90/10 traffic split',
    ],
    lesson: [
      `<h3>🕸️ Teen problems, ek pattern</h3>
       <p>50 microservices ho gaye. Ab chahiye: (1) <b>service-to-service encryption</b>
       (Level 14 ka loose end — SSL termination ke baad andar plaintext tha!), (2) <b>smart
       traffic control</b> (canary: naya version sirf 10% users par), (3) <b>uniform
       observability</b> (har service ki golden metrics — Level 21). Har team apne code mein
       yeh banaye? 50 baar, 5 languages mein, alag-alag bugs ke saath? 🙈</p>
       <p><b>Service mesh ka idea:</b> yeh sab NETWORK layer ka kaam hai — app se nikaalo,
       proxy mein daalo:</p>
       <pre>Har pod mein Envoy sidecar inject hota hai (ya ambient mode mein
node-level) — app ka SAB traffic proxy se guzarta hai:

  app-A → [envoy-A] ══mTLS══ [envoy-B] → app-B

App ko kuch nahi pata. Code zero badla. Par ab:
  ✓ traffic encrypted + both sides verified (mTLS)
  ✓ retries, timeouts, circuit breaking — config se
  ✓ har request ki metrics/traces — free</pre>
       <p>Control plane <b>istiod</b>: certificates deta hai (har service ki identity!),
       proxies ko config bhejta hai. (Linkerd = simpler alternative, same idea.)</p>`,
      `<h3>🐤 Canary — traffic ka remote control</h3>
       <pre>kind: VirtualService              # Istio CRD (operators level!)
spec:
  http:
  - route:
    - destination: { host: payments, subset: v1 }
      weight: 90
    - destination: { host: payments, subset: v2 }
      weight: 10                     # naya version = sirf 10% traffic</pre>
       <p>Rollout se farak samjho: Deployment ka rolling update = pods REPLACE hote hain
       (sab users naye version par jaayenge hi). Canary = <b>dono versions zinda, traffic
       ka percentage TUM control karte ho</b> — metrics dekho (error rate v2 ka!), theek
       hai toh 10→50→100, kharab toh weight: 0 — instant rollback, koi pod nahi mara.</p>
       <div class="war-story"><b>⚡ Real pattern (mesh ka payoff):</b> Ek fintech ne payments
       v2 canary par 5% traffic diya. Grafana mein v2 ka error rate 0.2% → 4% dikha (ek edge
       case bug) — <b>sirf 5% users affected, 30 second mein weight 0</b>, fix karke phir
       try. Bina mesh ke yahi bug 100% users par jaata, full rollback drama hota. Aur Argo
       Rollouts jodo toh yeh weight-shifting METRICS dekh kar AUTOMATIC hoti hai —
       progressive delivery. Sab kuch jud gaya: mesh + observability + GitOps. 🧩</div>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Mesh ke Kirdaar',
        instructions: 'Istio ki duniya ke har kirdaar ko uske role se milao.',
        pairs: [
          { left: '🕵️ Envoy sidecar', right: 'Har pod ka proxy — saara traffic intercept, mTLS, metrics', explain: 'Data plane. App ke saath same pod (Level 4 ka sidecar pattern — THE sidecar yahi hai!).' },
          { left: '🧠 istiod', right: 'Control plane — certificates + proxy config distribute karta hai', explain: 'Har workload ko identity certificate (SPIFFE) deta hai — mTLS ki neev. Proxies ko routing rules bhejta hai.' },
          { left: '🔐 mTLS', right: 'DONO sides verify + traffic encrypted — pod-to-pod', explain: 'Mutual = client bhi verify hota hai (normal TLS mein sirf server). "Network pe hona" ≠ "trusted hona" — zero-trust ka network layer (Level 15 ka bada bhai).' },
          { left: '🐤 VirtualService (weight 90/10)', right: 'Traffic ka percentage split — canary ka engine', explain: 'Rolling update pods badalta hai; canary TRAFFIC baantta hai — dono versions zinda, tum dial ghumate ho.' },
          { left: '📊 Mesh telemetry', right: 'Har service ki rate/errors/latency — BINA code change', explain: 'Proxy har request dekhta hai = golden signals free (Level 21 ka shortcut). Kiali jaisa tool service-graph bhi bana deta hai.' },
        ],
      },
      {
        type: 'quiz',
        title: 'Mesh Judgement',
        questions: [
          {
            q: 'Rolling update vs canary (mesh wala) — core farak kya hai?',
            choices: [
              'Rolling update PODS replace karta hai (traffic % control nahi); canary TRAFFIC split karta hai — dono versions zinda, percentage tumhare haath',
              'Canary bas rolling update ka naya naam hai — dono mein pods ek-ek karke badalte hain, mesh sirf dashboard deta hai',
              'Rolling update fast hai aur canary slow — dono traffic split karte hain, farak sirf maxSurge jaise speed settings ka hai',
              'Canary sirf frontend services ke liye hota hai jahan users dikhte hain; backend services hamesha rolling update se hi jaati hain',
            ],
            answer: 0,
            explain: 'Axis alag hai: pods vs traffic. Rolling mein "naya pod ready = purana gaya" — users ka % control NAHI hota. Canary mein v2 ka blast radius = weight jitna. Isi liye high-risk services (payments!) canary maangti hain.',
          },
          {
            q: '5-service ki chhoti app, ek team, low traffic — Istio lagayein?',
            choices: [
              'Shayad nahi — mesh ki cost real hai (sidecar resources, latency hop, ops complexity); NetworkPolicy + Ingress TLS + basic metrics se kaam chalega; mesh tab jab scale maange',
              'Haan — service mesh 2026 mein best practice hai, jitni chhoti app utna aasan setup; bina mesh ke koi bhi app production-ready nahi maani jaati, size se farak nahi',
              'Haan — Istio ke bina Kubernetes ka network unencrypted aur insecure hota hai, isliye 5 services par bhi compliance ke liye zaroori hai',
              'Kabhi nahi — mesh sirf Google-size companies ke liye hai; 1000 se kam services par Istio performance aur stability dono kharab karta hai',
            ],
            answer: 0,
            explain: 'Trade-off judgement = senior signal. Mesh ke fayde scale par compound hote hain (50 services × 5 languages); 5 services par uska operational tax zyada hai. "You don\'t need a mesh until you know exactly why you need it."',
          },
          {
            q: 'mTLS "mutual" kyun — normal TLS se kya zyada?',
            choices: [
              'Normal TLS mein sirf SERVER apni identity prove karta hai; mTLS mein CLIENT bhi certificate dikhata hai — dono verified, sirf network par hona access nahi dilata',
              'mTLS bas double encryption hai — data do baar encrypt hota hai (client aur server dono keys se), isliye normal TLS se do guna secure',
              'mTLS mein certificate ke saath username/password bhi lagta hai — isliye mutual: ek taraf certificate se, doosri taraf password se authentication hota hai',
              'Koi technical farak nahi — mTLS Istio ki branding hai; normal TLS mein bhi client hamesha apna certificate bhejta hai',
            ],
            answer: 0,
            explain: 'Identity-based security: har workload ka certificate (istiod se, auto-rotated) = "payments service HI hai yeh, koi imposter pod nahi". NetworkPolicy (IP/label) + mTLS (cryptographic identity) = defense in depth.',
          },
        ],
      },
      {
        type: 'fill',
        bonus: true,
        title: 'Good to Know — Canary Config',
        instructions: 'Bonus: payments v2 ko 10% traffic dene wala VirtualService poora karo.',
        template: 'apiVersion: networking.istio.io/v1\nkind: {0}\nmetadata:\n  name: payments\nspec:\n  hosts: [ payments ]\n  http:\n  - route:\n    - destination:\n        host: payments\n        subset: v1\n      weight: {1}\n    - destination:\n        host: payments\n        subset: {2}\n      weight: 10\n\n# Kharab metrics dikhe toh instant rollback:\n#   v2 ka weight: {3}  (koi pod delete NAHI hota!)',
        blanks: [
          { answer: 'VirtualService', explain: 'Istio ka routing CRD (Level 23 ka pattern — mesh ke apne kinds). DestinationRule subsets define karta hai (v1/v2 = pod labels se).' },
          { answer: '90', explain: 'Weights ka total 100 — v1 ko 90%. Dial dheere ghumao: 90/10 → 50/50 → 0/100.' },
          { answer: 'v2', explain: 'Canary subset — naye version ke pods. Dono versions ke Deployments EK SAATH chal rahe hain.' },
          { answer: '0', explain: 'Rollback = config change, pod surgery nahi. 30 second, zero drama — war-story wala move. Argo Rollouts yeh dial metrics se AUTO ghumata hai (progressive delivery).' },
        ],
        tokens: ['VirtualService', '90', 'v2', '0', 'Ingress', '50', 'canary', '100'],
      },
    ],
    interview: {
      title: 'Interview Round — Service Mesh',
      instructions: 'Aakhri concept-level — ab tum senior ki tarah bol sakte ho. 🎤',
      questions: [
        {
          q: '"Service mesh kyun exist karta hai?" — user ke syllabus ka EXACT sawal. Best jawab?',
          choices: [
            'Cross-cutting network concerns (mTLS, traffic splitting, retries, observability) ko app code se nikaal ke sidecar/proxy mein — har language mein duplicate karne ki jagah, ek jagah, bina code change',
            'Kubernetes ka built-in networking slow hai — mesh ke sidecars kernel bypass karke packets tez bhejte hain, isliye high-traffic apps ko performance ke liye mesh chahiye',
            'Mesh ke bina services aapas mein connect hi nahi ho sakti — Kubernetes Service sirf bahar ke traffic ke liye hai, andar ka raasta mesh banata hai',
            'Yeh sirf observability tool hai — Prometheus jaise metrics dene ke liye; security aur traffic control ke liye alag tools chahiye hote hain',
          ],
          answer: 0,
          explain: '"Why" ka core: separation of concerns at network layer. Teen pillars gino (security/traffic/observability) + "no code change" + polyglot argument. Phir judgement dikhao: "chhote setups mein overkill" — balanced close.',
        },
        {
          q: 'Payments v2 deploy karna hai — high risk. Mesh ke saath tumhara safe rollout plan?',
          choices: [
            'Dono versions deploy → VirtualService 95/5 → error rate/p99 dekho → theek toh 5→25→50→100, spike toh weight 0 (instant rollback); Argo Rollouts se auto',
            'Friday shaam ko 100% deploy karo jab traffic kam hota hai — weekend mein issues aaye toh kam users prabhavit honge, Monday ko poori team fix karegi',
            'Rolling update kaafi hai — maxUnavailable 0 aur readiness probe ke saath zero-downtime milta hai; canary sirf extra drama, extra YAML aur extra cost hai',
            'Pehle prod mein 100% deploy karke dekho, phir staging mein — prod ka data real hota hai isliye bugs wahin jaldi milte hain, staging sirf formality hai',
          ],
          answer: 0,
          explain: 'Progressive delivery ka poora playbook: split → observe → increment → auto-rollback. Metrics kaunsi dekh rahe ho bolo (Level 21 ka payoff). Yeh jawab 3 levels ka gyaan ek saath dikhata hai.',
        },
        {
          q: 'NetworkPolicy (Level 15) already hai — mTLS uske upar kya add karta hai?',
          choices: [
            'NetPol = kaun kisse connect ho sakta hai (IP/label); mTLS = connection ke andar ENCRYPTION + cryptographic IDENTITY — sniffing/spoofing se suraksha; dono complementary (defense in depth)',
            'Kuch nahi — dono same kaam karte hain; mTLS lagane ke baad NetworkPolicy delete kar dena chahiye warna double filtering se latency badhti hai',
            'mTLS NetworkPolicy ko poori tarah replace kar deta hai — sirf certificate wale pods hi baat kar sakte hain, isliye IP/label-level rules ki zaroorat bilkul khatam ho jaati hai',
            'NetPol mTLS se zyada secure hai kyunki kernel level par chalta hai — mTLS sirf application layer hai jise bypass karna aasan hai',
          ],
          answer: 0,
          explain: 'Layered security ka crisp jawab: reachability control vs traffic protection+identity. "Network par hona ≠ trusted hona" — zero-trust ki final form. In dono ko jodkar bolna = security architecture samajh.',
        },
      ],
    },
    success: [
      'Main mesh ke 3 pillars (mTLS/traffic/observability) aur "why" samjha sakta hoon',
      'Main sidecar model aur istiod ka role explain kar sakta hoon',
      'Main canary rollout design kar sakta hoon (weights + metrics + instant rollback)',
      'Main "mesh kab overkill hai" ka judgement de sakta hoon',
    ],
    homework: `<p>Istio ka demo profile try karo (resources allowing — 4GB+ minikube):</p>
      <pre>minikube start -p mesh --memory=4096
curl -L https://istio.io/downloadIstio | sh - && cd istio-*
bin/istioctl install --set profile=demo -y
kubectl label namespace default istio-injection=enabled
kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml
kubectl get pods            # READY 2/2 — doosra container? SIDECAR! 🕵️
# ek pod describe karo — istio-proxy container dekho
kubectl describe pod -l app=ratings | grep -A2 istio-proxy
minikube delete -p mesh</pre>
      <p>✅ Self-check: READY 2/2 dekha? Woh /2 hi mesh hai — har pod mein ghusa hua Envoy. Ab "sidecar injection" tumhare liye sirf shabd nahi.</p>`,
    cards: [
      { front: 'Service mesh kyun exist karta hai — 3 pillars?', back: '1) <b>mTLS</b> (pod-to-pod encryption+identity), 2) <b>Traffic control</b> (canary splits, retries, timeouts), 3) <b>Observability</b> (har service ki golden metrics) — sab BINA app code badle, sidecar proxy (Envoy) se. 50 services × 5 languages ka duplication khatam.' },
      { front: 'Canary vs rolling update?', back: 'Rolling = <b>pods</b> replace (traffic sab naye par jayega hi). Canary = <b>traffic</b> split (90/10 → dial ghumao, metrics dekho). Rollback = weight 0 — instant, koi pod nahi marta. High-risk services ka standard.' },
      { front: 'mTLS normal TLS se zyada kya karta hai?', back: '<b>Dono sides verify</b> hoti hain (client bhi cert dikhata hai — istiod se auto-issued/rotated identity). "Network par hona ≠ trusted hona." NetPol (reachability) + mTLS (identity+encryption) = defense in depth.' },
      { front: 'Mesh kab overkill hai?', back: 'Chhota setup (few services, ek team): sidecar resources + latency + ops complexity ka tax > fayda. NetPol + Ingress TLS + metrics kaafi. Mesh tab jab scale/polyglot/compliance maange. Judgement > hype!' },
    ],
  },

  /* ================= LEVEL 26: FINAL BOSS ================= */
  {
    id: 'boss3',
    icon: '🐉',
    title: 'FINAL BOSS: Senior Engineer ka Gauntlet',
    badge: 'Kubernetes Mahaguru',
    objectives: [
      'Poore course ka sab kuch — ek multi-layer production crisis',
      'Layers ke paar debugging: app → RBAC → secrets → GitOps → mesh',
      'Aakhri interview — senior-level system thinking',
    ],
    lesson: [
      `<h3>🐉 Aakhri Parv</h3>
       <p>Tum ab us company ke senior platform engineer ho. Aaj ke crisis mein Track 1 ki
       basics se lekar Track 3 ke saare shastra lagenge. Teen rounds:</p>
       <ul>
         <li>🖥️ <b>Round 1:</b> Terminal — multi-layer platform debugging (RBAC + ESO + ArgoCD ek saath!)</li>
         <li>🚨 <b>Round 2:</b> Incident — DNS ka mahayudh (senior engineers ki asli agni-pariksha)</li>
         <li>🎤 <b>Round 3:</b> THE Interview — system-level synthesis</li>
       </ul>
       <p>Jeet gaye toh: <b>Kubernetes Mahaguru</b> 👑. Chalo — cluster bula raha hai.</p>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Round 1: Platform Meltdown',
        instructions: 'Subah 9 baje. Teen alag layers par teen problems — senior ka kaam: sahi ORDER mein solve karna (dependencies hain!).',
        goal: 'payments app down hai. Chain: <b>(1)</b> payments pod kyun crash ho raha hai? (logs → secret missing!) <b>(2)</b> Secret kyun nahi hai? (ExternalSecret dekho → ESO operator ka RBAC toota!) <b>(3)</b> RBAC kisne toda? (ArgoCD drift!) — teeno layers fix karo, root se.',
        tasks: [
          { text: 'payments crash ki wajah (logs)', check: s => s.history.some(h => /^(kubectl|k) logs payments/.test(h)) },
          { text: 'ExternalSecret ka status check (describe)', check: s => s.history.some(h => /describe externalsecret/.test(h)) },
          { text: 'Root fix: RBAC git se restore → chain heal', check: s => s.cluster.pods.every(p => p.status === 'Running') },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '200d', version: 'v1.31.0' }],
          pods: [
            {
              name: 'payments-9d8e7f-p1', ready: '0/1', status: 'CreateContainerConfigError', restarts: 0, age: '25m', node: 'node-1', ip: '10.244.1.90',
              logs: 'Error from server (BadRequest): container "payments" in pod "payments-9d8e7f-p1" is waiting to start: CreateContainerConfigError',
              describe: 'Name:    payments-9d8e7f-p1\nStatus:  Pending (CreateContainerConfigError)\nEvents:\n  Warning  Failed  2m (x12)  Error: secret "payments-db-creds" not found   ← 🚨\n\n(Secret hona chahiye tha — ESO banata hai isse. ExternalSecret check karo: kubectl get externalsecrets)',
            },
            {
              name: 'eso-operator-5a4b3c-e1', ready: '1/1', status: 'Running', restarts: 0, age: '25m', node: 'node-1', ip: '10.244.1.91',
              logs: '{"level":"error","msg":"reconcile failed","externalsecret":"payments-db-creds","error":"secrets is forbidden: User \\"system:serviceaccount:external-secrets:eso-sa\\" cannot create resource \\"secrets\\" in namespace \\"default\\""}\n(ESO ka RBAC toota hua hai — woh Secret bana hi nahi paa raha!)',
            },
          ],
          deployments: [
            { name: 'payments', ready: '0/1', upToDate: 1, available: 0, age: '25m' },
            { name: 'eso-operator', ready: '1/1', upToDate: 1, available: 1, age: '90d' },
          ],
          services: [],
        },
        responses: [
          {
            re: /^(kubectl|k) get externalsecrets?\b/,
            out: s => s.cluster.pods.every(p => p.status === 'Running')
              ? 'NAME                STORE        REFRESH   STATUS\npayments-db-creds   vault-store  1h        SecretSynced ✓'
              : 'NAME                STORE        REFRESH   STATUS\npayments-db-creds   vault-store  1h        SecretSyncedError   ← 🚨',
          },
          {
            re: /^(kubectl|k) describe externalsecrets? payments/,
            out: s => s.cluster.pods.every(p => p.status === 'Running')
              ? 'Name:   payments-db-creds\nStatus:\n  Conditions:\n    Type: Ready, Status: True, Reason: SecretSynced ✓'
              : 'Name:   payments-db-creds\nStatus:\n  Conditions:\n    Type:    Ready\n    Status:  False\n    Reason:  SecretSyncedError\n    Message: could not create target secret: secrets is forbidden:\n      User "system:serviceaccount:external-secrets:eso-sa"\n      cannot create resource "secrets" in namespace "default"\n\n(ESO ka RBAC missing! Kisne hataya? argocd app diff dekho...)',
          },
          {
            re: /^argocd app (list|diff)/,
            out: s => s.cluster.pods.every(p => p.status === 'Running')
              ? 'platform-rbac: Synced ✓ Healthy ✓'
              : 'APP             SYNC        HEALTH\nplatform-rbac   OutOfSync   Healthy   ← 🕵️\n\n$ argocd app diff platform-rbac (summary):\n- git mein HAI:     ClusterRoleBinding eso-secrets-writer\n- cluster mein NAHI (kal raat kisi ne "cleanup" mein delete kiya — drift!)\n\n(Fix: git ka sach wapas lagao → argocd app sync platform-rbac, ya apply -f restore-rbac.yaml)',
          },
          {
            re: /^argocd app sync platform-rbac$/,
            mutate: s => {
              const pay = s.cluster.pods.find(p => p.name.startsWith('payments'));
              pay.status = 'Running'; pay.ready = '1/1';
              pay.logs = '[payments] db-creds loaded from secret ✓\n[payments] connected to db\n[payments] serving on :8080';
              const eso = s.cluster.pods.find(p => p.name.startsWith('eso'));
              eso.logs = '{"level":"info","msg":"reconciled","externalsecret":"payments-db-creds","status":"SecretSynced"}';
              s.cluster.deployments.find(d => d.name === 'payments').ready = '1/1';
            },
            out: 'argocd: syncing platform-rbac...\nClusterRoleBinding eso-secrets-writer created ✓ (git ka sach wapas)\n→ ESO reconcile hua → Secret "payments-db-creds" ban gaya ✓\n→ payments pod restart → Running ✓\n\nSynced + Healthy. Chain heal ho gayi — ROOT se.',
          },
        ],
        files: {
          'restore-rbac.yaml': {
            desc: 'ESO ka ClusterRoleBinding wapas lagata hai (git wala sach)',
            apply: s => {
              const pay = s.cluster.pods.find(p => p.name.startsWith('payments'));
              pay.status = 'Running'; pay.ready = '1/1';
              pay.logs = '[payments] db-creds loaded ✓ serving on :8080';
              const eso = s.cluster.pods.find(p => p.name.startsWith('eso'));
              eso.logs = '{"level":"info","msg":"reconciled","status":"SecretSynced"}';
              s.cluster.deployments.find(d => d.name === 'payments').ready = '1/1';
              return 'clusterrolebinding/eso-secrets-writer created ✓\n→ ESO ne Secret bana diya → payments Running ✓\n\n(Asli zindagi mein: yeh apply bhi ArgoCD sync se hota — argocd app sync platform-rbac. Drift ko drift se fix mat karna! 😄)';
            },
          },
          'fix-manual-secret.yaml': {
            desc: 'payments-db-creds Secret haath se bana deta hai (jugaad)',
            apply: () => 'secret/payments-db-creds created...\npayments TEMPORARILY Running... par:\n⚠️ ESO ab bhi broken hai (RBAC missing) — rotation kabhi sync nahi hogi, aur yeh manual Secret DRIFT hai jo agla cleanup kha jayega. SYMPTOM patch kiya, ROOT nahi. Root: RBAC → ArgoCD se restore karo.\n(Pod abhi bhi effectively at-risk — mission incomplete!)',
          },
        },
        success: s => s.cluster.pods.every(p => p.status === 'Running') && s.history.some(h => /describe externalsecret/.test(h)) && s.history.some(h => /^(kubectl|k) logs payments|describe (pod|pods|po) payments/.test(h)),
        successText: 'MAHAGURU-LEVEL DEBUGGING! 👑 Dekho kya kiya tumne: <b>symptom</b> (pod ConfigError) → <b>layer 1</b> (Secret missing) → <b>layer 2</b> (ESO ka RBAC Forbidden) → <b>root</b> (drift — kisi ne binding delete ki, git ka sach alag tha) → <b>fix at root</b> (ArgoCD sync). Junior symptom patch karta (manual Secret — try kiya ho toh dekha uska anjaam!), senior chain TRACE karta hai. Yehi poore course ka nichod hai.',
        hints: [
          'kubectl describe pod payments → "secret not found". Woh secret ESO banata hai → kubectl get externalsecrets',
          'kubectl describe externalsecret payments-db-creds → ESO ka RBAC Forbidden! ESO operator ke logs bhi dekho. Phir: argocd app list (drift?)',
          'argocd app diff platform-rbac → binding git mein hai, cluster mein nahi (drift!) → argocd app sync platform-rbac (root fix — manual secret mat banana!)',
        ],
      },
      {
        type: 'incident',
        title: '🚨 Round 2: DNS ka Mahayudh',
        instructions: 'Senior engineers ka asli test — woh incident jo har layer ko chhoota hai. (Screenshot ka Q14 live!)',
        pager: '<b>ALERT:</b> checkout p99 latency 300ms → 2.5s (sudden) · errors nahi badhe · deploy KOI nahi hua aaj · 11:40 AM',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ kubectl top pods -l app=checkout\nNAME             CPU    MEMORY\ncheckout-aaa     180m   410Mi     (normal range)\n\nGrafana: checkout ka apna processing time NORMAL (80ms)\npar "upstream call duration" 2.2s — external API calls slow!',
            text: 'App khud fast hai, uski OUTGOING calls slow hain. Errors zero. Deploy koi nahi. Pehla investigative move?',
            choices: [
              { t: 'Ek pod mein exec karke us external call ko manually time karo — DNS resolve vs connect vs response alag-alag naapo', good: true, next: 'n2', explain: 'Perfect isolation: "call slow hai" ko todo — DNS? TCP connect? TLS? server response? curl -w se har phase ka time milta hai. Guessing zero, measurement full.' },
              { t: 'Checkout ke replicas double kar do — latency baant jayegi', good: false, explain: 'Latency LOAD se nahi aa rahi (CPU normal!) — har pod ki HAR call slow hai. 2x pods = 2x slow calls. Symptom ko samjhe bina scaling = paisa jala kar wahi problem.' },
              { t: 'External API provider ko blame-mail bhejo', good: false, explain: 'Ho sakta hai woh ho — par PROOF ke bina? Pehle apni taraf ka data lo (DNS/connect/response times). "Evidence first, blame later" — senior ka pehla usool.' },
            ],
          },
          n2: {
            sitrep: '$ kubectl exec checkout-aaa -- sh -c \'time nslookup api.stripe.com\'\n;; connection timed out; no servers could be reached (first try)\nreal    0m4.02s     ← 4 SECOND sirf DNS?!\n\n$ kubectl get pods -n kube-system -l k8s-app=kube-dns\ncoredns-aaa   1/1   Running   0   45d\ncoredns-bbb   0/1   Running   14  45d    ← 👀 restarts + NOT READY',
            text: 'DNS resolution 4s le raha hai — aur ek CoreDNS pod bimar hai. Diagnosis + sahi soch?',
            choices: [
              { t: 'CoreDNS ka ek replica unhealthy hai — kuch queries usi ke paas jaa ke time-out ho rahi hain (retry ke baad doosre se resolve → isliye errors nahi, sirf LATENCY). CoreDNS ko fix/restart karo aur uski memory/limits dekho', good: true, next: 'n3', explain: 'Exactly! DNS half-broken = latency without errors (retries bacha lete hain). READY 0/1 wala pod endpoints se to nikla hoga par... nahi — READY 0/1 hokar bhi kube-dns Service mein tha kya? Restart count bolta hai OOM/crash cycle. describe karke dekho.' },
              { t: 'ndots ki problem hai — resolv.conf mein ndots:5 hata do sab jagah turant', good: false, explain: 'Accha guess (ndots REAL cheez hai — external names par 4-5 extra internal lookups hote hain!) — PAR woh problem PEHLE DIN se hoti, aaj SUDDEN nahi. Aaj ka trigger: bimar CoreDNS pod. ndots optimization = valid follow-up, root cause of today ≠.' },
              { t: 'Saare checkout pods restart karo — DNS cache clear ho jayega', good: false, explain: 'App pods ki galti hi nahi — DNS SERVER side bimar hai. Restart se naye pods WAHI bimaar CoreDNS se poochhenge. Galat component ki surgery!' },
            ],
          },
          n3: {
            sitrep: '$ kubectl describe pod coredns-bbb -n kube-system | grep -A3 "Last State"\nLast State: Terminated\n  Reason:   OOMKilled          ← purana dost! 😄\n  Exit Code: 137\n\n(CoreDNS ki memory limit chhoti thi; ek naye internal service ne\n DNS queries ka toofan shuru kiya tha aaj subah — cache overflow)',
            text: 'CoreDNS OOMKill loop mein tha. Poora fix package kya hoga? (Senior answer!)',
            choices: [
              { t: 'Ab: CoreDNS memory limit badhao (git/GitOps se!) + recover karo. Phir: DNS query toofan wale service ka fix, CoreDNS metrics par alert (symptom: p99!), aur ndots/NodeLocal DNSCache evaluation — poori chain document karo', good: true, next: 'end', explain: 'COMPLETE package: immediate (limit via git — drift nahi!), root-root cause (query storm), detection gap (alert tha hi nahi), aur systemic hardening (NodeLocal DNSCache = har node par DNS cache, CoreDNS ka load hi gir jaata). Yeh 4-layer thinking hi seniority hai.' },
              { t: 'Bas limit badha do kubectl edit se, kaam ho gaya', good: false, explain: 'Teen galtiyan ek mein: (1) kubectl edit = DRIFT (Round 1 se kuch seekha? 😄), (2) query-storm root cause zinda, (3) detection gap zinda — agli baar phir p99 se hi pata chalega. Patch ≠ fix.' },
              { t: 'CoreDNS ko hata ke har pod mein public DNS (8.8.8.8) daal do', good: false, explain: '💀 Cluster DNS ke bina Services ka naam-resolution hi mar jayega (web-svc kaun batayega?). 8.8.8.8 ko tumhare internal names ka koi pata nahi. Cure worse than disease — architecture samjho, todo mat.' },
            ],
          },
          end: {
            end: true,
            text: 'DNS Mahayudh jeet liya. Tum ab officially "the person they page" ho. 👑',
            summary: '<b>Is incident ne sab test kiya:</b> latency-without-errors ka pattern (half-broken dependency + retries), layer isolation (app → upstream → DNS phase-timing), OOMKilled ka purana gyaan NAYI jagah (CoreDNS bhi bas ek pod hai!), GitOps discipline (fix via git), aur systemic thinking (alert + cache + storm-fix). <b>Kubernetes ka asli raaz: sab kuch pods hi hain — DNS bhi, operators bhi, ArgoCD bhi. Jo debugging Track 1 mein seekhi, wahi har layer par chalti hai.</b>',
          },
        },
      },
    ],
    interview: {
      title: '🎤 Round 3: THE FINAL INTERVIEW',
      instructions: 'Senior Platform Engineer position. Panel round. Sab kuch allowed. All the best! 🙏',
      questions: [
        {
          q: 'PANEL: "Ek naya production-grade platform zero se design karo — kaunse layers, kaunse tools, kya order?" (2 minute ka whiteboard jawab)',
          choices: [
            'GitOps + managed cluster day-1 → security (RBAC least-priv, PSA restricted, NetPol default-deny, ESO) → reliability (requests/limits, probes, spread, autoscaling) → observability (symptom alerts) → traffic (Gateway; mesh jab maange)',
            'Pehle saari apps jaldi deploy karo taaki business value dikhe → security, RBAC aur NetworkPolicies baad mein jab pehla audit aaye → monitoring tab jab pehla incident ho → GitOps tab jab team badi ho',
            'Day-1 par sab kuch ek saath: Istio, Vault, ArgoCD, Karpenter, OPA, Backstage — platform shuru se complete hona chahiye, baad mein add karna mushkil hai, order ka farak nahi',
            'Kubernetes mat use karo — VMs sasti aur simple hain; ek bade VM par Docker Compose + cron backups + ek load balancer har startup ke liye kaafi hai, scale baad mein dekhenge',
          ],
          answer: 0,
          explain: 'Layered + sequenced + judgement (mesh "jab scale maange"!). Yeh jawab tumhare 26 levels ka map hai — literally. Panel isme dekh raha hai: kya yeh vyakti PRIORITIZE kar sakta hai? Order hi seniority hai.',
        },
        {
          q: 'PANEL: "Tumhara sabse bada production incident kya tha aur usne tumhe kya sikhaya?" — is course ke incidents mein se sabse SEEKH-bhara pattern?',
          choices: [
            'Common thread: symptom se root tak CHAIN trace karna (pod→secret→RBAC→drift), peak par pehle mitigate, fix git se, aur har incident ke baad detection gap bharo + document karo',
            'Incidents se bachne ka ek hi tareeka hai: deploy kam karo — har deploy risk hai, isliye monthly release train rakho aur freeze periods badhao',
            'Har incident mein pehle sab restart karo (pods, nodes), phir sochna — restart 80% problems solve kar deta hai aur root cause ka time bachta hai',
            'Incidents junior engineers handle karte hain aur seniors sirf post-mortem review karte hain — isse juniors jaldi seekhte hain aur seniors ka time design par bachta hai',
          ],
          answer: 0,
          explain: 'Meta-learning ka sawal hai — specific incident nahi, PATTERN. Chain-tracing, mitigate-first, git-discipline, learning-loop: yeh 4 habits hi is poore course ka asli certificate hain. Ab jaake asli cluster todo-jodo. 😄',
        },
        {
          q: 'PANEL (aakhri sawal): "Kubernetes ka EK core idea jo sab kuch jodta hai — naye engineer ko kya samjhaoge?"',
          choices: [
            'Reconciliation: desired state declare karo (YAML/git), controllers actual ko continuously usse milate hain — ReplicaSet se operators aur ArgoCD tak SAB yahi loop hai',
            'YAML syntax perfect karna — Kubernetes ka 90% kaam sahi indentation aur sahi fields hai; jo YAML samajh gaya, woh Kubernetes bhi samajh gaya, baaki tools hain',
            'kubectl ki saari commands aur flags yaad karna — CKA mein yahi poocha jaata hai, aur production mein bhi speed hi sab kuch hai',
            'Pods hi sab kuch hain — Deployments, Services, operators sab pods ke wrappers hain; pod ka lifecycle samajh liya toh baaki apne aap',
          ],
          answer: 0,
          explain: '🏆 PERFECT ENDING. Level 1 mein yeh "desired state" ek definition thi; ab yeh tumhara worldview hai — pods (RS controller), nodes (NotReady eviction), storage (PVC binding), operators (custom loops), GitOps (git as desired). EK pattern, poora system. Congratulations, Mahaguru — ab jao, apna cluster banao. 🛕👑',
        },
      ],
    },
    success: [
      'Main multi-layer platform issues ko root tak trace kar sakta hoon',
      'Main "latency without errors" jaise senior-level patterns pehchanta hoon',
      'Main zero se production platform design kar sakta hoon — sahi order mein',
      'Main KUBERNETES MAHAGURU hoon 👑 — reconciliation meri rag-rag mein hai',
    ],
    homework: `<p>🎓 <b>Graduation — ab asli duniya:</b></p>
      <pre># 1. Apna homelab: k3s ya kind cluster + ArgoCD + apna app repo
#    → GitOps se apni koi side-project deploy karo, end-to-end
# 2. CKA/CKAD exam consider karo — is course ke baad syllabus
#    familiar lagega (exam pure hands-on hai, tumhari taiyari perfect hai)
# 3. Revision Dojo roz kholo — 35-din intervals tak cards le jaao,
#    concepts hamesha ke liye tumhare ho jayenge
# 4. Kisi aur ko sikhao — jo samjha sakte ho, wahi asli mein aata hai 🙏</pre>
      <p>✅ Aakhri self-check: kya tum ab K8s incident mein "pehla command" bina soche bol sakte ho? Toh jaao — the clusters need you. 🛕</p>`,
    cards: [
      { front: 'Multi-layer debugging ka senior pattern?', back: 'Symptom se <b>chain trace</b> karo root tak (pod → secret → operator → RBAC → drift) — har layer par wahi tools (describe/logs/events). Symptom-patch (manual secret) = udhaar; root-fix (git sync) = ilaaj.' },
      { front: '"Latency badhi, errors nahi" — kya pattern hai?', back: '<b>Half-broken dependency + retries</b>: kuch requests bimaar replica (e.g. ek CoreDNS pod) par timeout hoti hain, retry bacha leta hai — result: p99 spike, error rate flat. Phase-timing (DNS/connect/response) se pakdo.' },
      { front: 'Kubernetes ka EK core idea jo sab jodta hai?', back: '<b>Reconciliation</b>: desired state (YAML/git) declare karo, controllers actual ko continuously milate hain. ReplicaSet → StatefulSet → operators → ArgoCD — sab YAHI loop hai. Isse samjho, sab predictable.' },
      { front: 'Course khatam — retention ka plan?', back: '<b>Revision Dojo roz</b> (35-din intervals tak), real cluster par har concept ek baar todo-jodo, aur kisi ko sikhao. Jo samjha sakte ho, wahi asli mein tumhara hai. 🛕' },
    ],
  },

]);
