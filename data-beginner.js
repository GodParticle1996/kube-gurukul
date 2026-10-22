/* =====================================================================
   KubeGurukul — Track 1: 🌱 Beginner (Shishya Path)
   Docker aata hai — ab orchestration se cluster tak.
   Naya level add karna ho? Bas is file mein ek aur object,
   ya kahin bhi: KG.registerLevels('beginner', [ {...} ]);
   ===================================================================== */

KG.registerLevels('beginner', [

  /* ================= LEVEL 1: Docker se Kubernetes ================= */
  {
    id: 'whyk8s',
    icon: '🐳',
    title: 'Docker se Kubernetes — Orchestration kyun?',
    badge: 'Orchestration Samajhdar',
    objectives: [
      'Samjho ki sirf Docker production mein kyun kaafi nahi hai',
      '<b>Desired state</b> ka concept — Kubernetes ka dil',
      'Self-healing, scaling, aur rolling updates — orchestration ke 3 superpowers',
      'Cluster, node, aur pod — basic shabdon ki pehchaan',
    ],
    lesson: [
      `<h3>🌃 Raat 3 baje ki kahani</h3>
       <p>Socho tumhari e-commerce app Docker par chal rahi hai — ek server, 5 containers.
       <b>Diwali sale</b> ki raat, 3 baje: payment container crash ho gaya. Kya hota hai?</p>
       <ul>
         <li>🐳 <b>Sirf Docker:</b> container mara pada rehta hai. Alert aata hai (agar lagaya ho!),
             tum neend se uthke SSH karte ho, <code>docker restart</code> maarte ho. Tab tak orders fail. 💸</li>
         <li>☸️ <b>Kubernetes:</b> container marte hi K8s khud naya bana deta hai — <b>seconds mein</b>.
             Tum subah uthke sirf graph mein ek chhota sa dip dekhte ho.</li>
       </ul>
       <div class="war-story"><b>⚡ Real incident:</b> 2020 mein ek badi Indian e-commerce
       company ka sale-day outage isi wajah se hua — containers manually manage ho rahe the,
       traffic 8x aaya, aur team scale hi nahi kar paayi. Aaj woh sab Kubernetes par hain.
       Yeh problem itni common hai ki iska naam hai: <i>"pets vs cattle"</i> — servers ko
       paalna band karo, herd manage karo.</div>`,
      `<h3>🧠 Desired State — K8s ka magic mantra</h3>
       <p>Docker mein tum <b>commands</b> dete ho: "yeh container chalao". Kubernetes mein tum
       <b>desired state</b> declare karte ho: <i>"mujhe hamesha web ke 3 replicas chahiye"</i>.</p>
       <pre>replicas: 3   # bas itna likho

K8s ka promise:
  actual state (2 chal rahe) ≠ desired state (3 chahiye)
  → K8s khud 1 aur bana dega. Har waqt. Bina bole.</pre>
       <p>Yeh farak <b>imperative</b> (kya KARO) vs <b>declarative</b> (kya CHAHIYE) ka hai.
       Interview mein yeh line bolo toh interviewer khush: <i>"Kubernetes is a declarative
       system — you declare desired state, controllers reconcile actual state towards it."</i></p>`,
      `<h3>📖 Nayi dictionary (Docker → K8s)</h3>
       <table>
         <tr><th>Tumhe pata hai (Docker)</th><th>Ab seekhoge (K8s)</th></tr>
         <tr><td><code>docker run</code> se container</td><td><b>Pod</b> — containers ka wrapper (Level 4)</td></tr>
         <tr><td><code>docker-compose scale</code></td><td><b>Deployment</b> — replicas + updates (Level 5)</td></tr>
         <tr><td>ek machine</td><td><b>Node</b> — cluster ki ek machine (worker)</td></tr>
         <tr><td>saari machines milke</td><td><b>Cluster</b> — control plane + worker nodes</td></tr>
         <tr><td><code>docker network</code> + ports</td><td><b>Service</b> — stable naam + load balancing (Level 6)</td></tr>
       </table>
       <p>💡 Docker ka gyaan bekaar nahi jaayega — K8s ke andar bhi containers hi chalte hain
       (containerd runtime se). K8s unke <b>upar</b> ka manager hai.</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Kiska kaam? — Docker vs Kubernetes',
        instructions: 'Har situation ko sahi bin mein daalo: yeh kaam <b>Docker akela</b> kar leta hai, ya iske liye <b>Kubernetes (orchestrator)</b> chahiye?',
        bins: [
          { id: 'docker', label: '🐳 Docker akela kaafi hai' },
          { id: 'k8s', label: '☸️ Orchestrator (K8s) chahiye' },
        ],
        items: [
          { text: 'Ek container image banana (build)', bin: 'docker', explain: 'docker build — image banana Docker ka core kaam hai. K8s images banata hi nahi!' },
          { text: 'Laptop par ek container chalana', bin: 'docker', explain: 'docker run — single container, single machine = classic Docker.' },
          { text: 'Crash hote hi auto naya container', bin: 'k8s', explain: 'Self-healing — ReplicaSet actual state ko desired state se match karata hai.' },
          { text: '50 machines par containers baantna', bin: 'k8s', explain: 'Scheduling across nodes — yehi toh orchestration hai. Docker sirf apni machine dekhta hai.' },
          { text: 'Traffic badhne par 3 → 30 replicas', bin: 'k8s', explain: 'Scaling — declarative: replicas badlo, K8s baaki sambhal lega (aage HPA se auto bhi hoga).' },
          { text: 'Zero-downtime version update', bin: 'k8s', explain: 'Rolling update — naye pods dheere-dheere aate hain, purane tab hatate hain jab naye ready ho jaayein.' },
          { text: 'Image ko registry par push karna', bin: 'docker', explain: 'docker push — registry par image bhejna Docker/CI ka kaam hai; K8s wahan se sirf PULL karta hai.' },
        ],
      },
      {
        type: 'quiz',
        title: 'Desired State Quick-fire',
        questions: [
          {
            q: 'Tumne bola "replicas: 3". Ek pod crash ho gaya. Kubernetes kya karega?',
            choices: [
              'Turant ek naya pod banayega — actual ko desired se match karne ke liye',
              'Tumhe email bhejega ki pod mar gaya, action tum loge',
              'Baaki 2 pods ko restart karega',
              'Kuch nahi — agle manual apply ka wait karega',
            ],
            answer: 0,
            explain: 'Yehi reconciliation loop hai: controllers har waqt actual vs desired compare karte hain aur farak khud mitate hain. Isliye K8s "self-healing" hai.',
          },
          {
            q: '"Declarative" ka matlab kya hai Kubernetes mein?',
            choices: [
              'Tum batate ho KYA chahiye (end state), K8s figure karta hai KAISE',
              'Tum har step ka command dete ho, K8s follow karta hai',
              'Sab kuch YAML mein likhna zaroori hai',
              'Cluster khud decide karta hai kitne replicas chahiye',
            ],
            answer: 0,
            explain: '"Kya chahiye" declare karo (YAML mein desired state) — kaise achieve hoga, woh K8s ke controllers ka kaam. Imperative hota: "container X ko node Y par abhi start karo".',
          },
          {
            q: 'Kubernetes containers ke liye images kahan se laata hai?',
            choices: [
              'Container registry se pull karta hai (Docker Hub, ECR, GCR...)',
              'Khud source code se build karta hai',
              'Developer ke laptop se copy karta hai',
              'Har node par pehle se hote hain',
            ],
            answer: 0,
            explain: 'K8s images BUILD nahi karta — sirf registry se PULL karta hai. Build CI/CD ka kaam hai. (Isi se aage ImagePullBackOff error bhi samjhoge!)',
          },
        ],
      },
      {
        type: 'match',
        bonus: true,
        title: 'Good to Know — K8s ki duniya ke naam',
        instructions: 'Bonus round! Har term ko uske matlab se milao.',
        pairs: [
          { left: 'Cluster', right: 'Poora setup — control plane + saare worker nodes milke', explain: 'Ek cluster = ek Kubernetes "installation". Company mein aksar dev/staging/prod alag clusters hote hain.' },
          { left: 'Node', right: 'Cluster ki ek machine (VM ya physical server)', explain: 'Node = ek worker machine. AWS par EC2 instance, ghar par ek VM — K8s ke liye sab "node".' },
          { left: 'Pod', right: 'Sabse chhoti deployable unit — 1+ containers ka wrapper', explain: 'K8s containers ko directly nahi, pods ko chalata hai. Level 4 mein deep dive!' },
          { left: 'kubectl', right: 'CLI jo cluster se baat karti hai', explain: '"kube-control" — tumhara main tool. Har level mein use karoge.' },
          { left: 'k8s', right: '"Kubernetes" ka short form — k + 8 letters + s', explain: 'K-u-b-e-r-n-e-t-e-s: beech ke 8 letters ko "8" likh diya. Greek mein "helmsman" (jahaaz ka captain) hota hai!' },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Orchestration Basics',
      instructions: 'Pehla mock interview! Interviewer ko impress karo. 🎤',
      questions: [
        {
          q: 'Tumhari team Docker Compose se production chala rahi hai aur baar-baar outages ho rahe hain. Manager poochta hai: Kubernetes kyun laayein? Sabse strong reason kya hai?',
          choices: [
            'Self-healing + declarative scaling — failures par system khud recover karta hai, human ka wait nahi',
            'Kubernetes naya hai isliye better hai',
            'Docker slow hota hai, K8s containers ko fast chalata hai',
            'K8s mein YAML likhna aasan hai',
          ],
          answer: 0,
          explain: 'Container speed same hi hai (runtime toh wahi hai). Asli value: reconciliation — crash, node failure, traffic spike sab par system KHUD react karta hai. Interviews mein hamesha "self-healing + desired state" bolo.',
        },
        {
          q: 'Interviewer: "Kubernetes aur Docker mein kya relation hai — kya K8s Docker ko replace karta hai?"',
          choices: [
            'Nahi — K8s containers ko ORCHESTRATE karta hai; container chalane ke liye runtime (containerd) use karta hai. Docker build/push ab bhi zinda hai',
            'Haan — K8s aane ke baad Docker ki koi zaroorat nahi',
            'Dono same kaam karte hain, bas company alag hai',
            'K8s sirf Docker containers hi chala sakta hai',
          ],
          answer: 0,
          explain: 'Classic trick question! K8s runtime-agnostic hai (containerd, CRI-O). "Docker deprecated in K8s" ka matlab sirf dockershim hatna tha — Docker-built images aaj bhi 100% chalti hain (OCI standard).',
        },
        {
          q: 'Scenario: ek pod baar-baar crash ho raha hai aur K8s usse baar-baar restart kar raha hai. Kya self-healing yahan problem SOLVE kar dega?',
          choices: [
            'Nahi — restart symptom chhupata hai; root cause (bug, config, memory) tumhe hi fix karna hoga',
            'Haan — K8s hai toh ab koi problem nahi',
            'Haan — kaafi restarts ke baad K8s khud bug fix kar deta hai',
            'Nahi — kyunki K8s crashed pods ko kabhi restart nahi karta',
          ],
          answer: 0,
          explain: 'Mature answer! Self-healing infrastructure failures ke liye hai. App-level bug par milta hai CrashLoopBackOff (Level 4 mein isse debug karoge). K8s magic nahi hai — samajhdaari se use karna padta hai.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki production mein orchestrator kyun zaroori hai (self-healing, scaling, rolling updates)',
      'Main desired state vs actual state ka farak samjha sakta hoon',
      'Main cluster, node, pod, kubectl — sab shabdon ka matlab jaanta hoon',
      'Main interview mein "K8s vs Docker" ka jawab confidently de sakta hoon',
    ],
    homework: `<p>Apne WSL mein ek real single-node cluster banao:</p>
      <pre># minikube install karo (ek baar)
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

minikube start          # 2-3 min lagenge
kubectl get nodes       # ek node "Ready" dikhna chahiye 🎉</pre>
      <p>✅ Self-check: <code>kubectl get nodes</code> mein STATUS = <b>Ready</b> dikha? Congrats — tumhara pehla cluster zinda hai!</p>`,
    cards: [
      { front: 'Kubernetes ka "desired state" model kya hai?', back: 'Tum declare karte ho KYA chahiye (e.g. <code>replicas: 3</code>), controllers har waqt actual state ko usse match karate rehte hain. Crash → auto-replace. Isse <b>reconciliation loop</b> kehte hain.' },
        { front: 'K8s vs Docker — ek line mein relation?', back: 'Docker images <b>banata</b> hai, K8s containers ko <b>orchestrate</b> karta hai (runtime: containerd). K8s images build nahi karta, sirf registry se pull karta hai.' },
      { front: 'Orchestrator ke 3 superpowers jo akela Docker nahi de sakta?', back: '1) <b>Self-healing</b> (crash → auto naya pod), 2) <b>Scaling</b> (replicas: 3 → 30), 3) <b>Rolling updates</b> (zero-downtime deploy). Sab multi-machine cluster par.' },
      { front: 'Cluster, Node, Pod — hierarchy kya hai?', back: '<b>Cluster</b> ⊃ <b>Nodes</b> (machines) ⊃ <b>Pods</b> (1+ containers ka wrapper). K8s pods ko schedule karta hai nodes par.' },
    ],
  },

  /* ================= LEVEL 2: Control Plane ================= */
  {
    id: 'controlplane',
    icon: '🧠',
    title: 'Cluster ka Dimaag — Control Plane',
    badge: 'Control Plane Pandit',
    objectives: [
      'Control Plane ke 4 components: <b>API Server, etcd, Scheduler, Controller Manager</b>',
      'API Server hi single entry point kyun hai — aur yeh design itna powerful kyun hai',
      'etcd mein kya rakha hai aur woh itna keemti kyun hai',
      '<code>kubectl apply</code> ke baad control plane ke andar kya-kya hota hai',
    ],
    lesson: [
      `<h3>🏢 Ek company ki tarah socho</h3>
       <p>Control Plane = cluster ka <b>head office</b>. Har component ka ek clear role:</p>
       <table>
         <tr><th>Component</th><th>Company mein kaun</th><th>Kaam</th></tr>
         <tr><td>🚪 <b>API Server</b></td><td>Reception + security gate</td><td><b>Har</b> request yahin aati hai — kubectl, components, sab. Validate karta hai, auth check karta hai, etcd mein likhta hai</td></tr>
         <tr><td>📔 <b>etcd</b></td><td>Company ki registry/tijori</td><td>Poore cluster ka <b>saara data</b> — kaunse pods, kaunse nodes, kya config. Key-value store, distributed, consistent</td></tr>
         <tr><td>⚖️ <b>Scheduler</b></td><td>HR ka placement officer</td><td>Naye pod ke liye <b>best node</b> chunta hai (resources, rules dekhkar) — chalata NAHI, sirf decide karta hai</td></tr>
         <tr><td>👮 <b>Controller Manager</b></td><td>Supervisors ki army</td><td>Reconciliation loops — desired vs actual state ka farak dekhte hi action (ReplicaSet controller, Node controller...)</td></tr>
       </table>`,
      `<h3>🚪 Sab raaste API Server se guzarte hain</h3>
       <p>Sabse important design decision: <b>koi bhi component doosre se direct baat nahi karta</b>.
       Scheduler etcd ko nahi chhoo sakta. kubelet Scheduler se nahi milta. Sab API Server ke through.</p>
       <pre>kubectl ──┐
Scheduler ──┤──▶ 🚪 API Server ──▶ 📔 etcd
Controllers─┤         (ekmatra darwaza)
kubelet ────┘</pre>
       <p>Kyun? <b>Security</b> (ek jagah auth/audit), <b>consistency</b> (ek hi source of truth),
       <b>simplicity</b> (naya component jodna easy). Interview mein poocha jaata hai:
       <i>"etcd se kaun directly baat karta hai?"</i> — jawab: <b>sirf API Server</b>.</p>
       <div class="war-story"><b>⚡ Real incident:</b> Ek fintech company ka etcd disk full ho
       gaya (backups bhi wahi the 🤦). Cluster "read-only" ho gaya — purane pods chalte rahe,
       lekin naya deploy, scale, ya self-healing sab band. Seekh: <b>etcd hi cluster hai</b> —
       uska backup lo, uski disk monitor karo. (Advanced track mein aur milega.)</div>`,
      `<h3>🎬 kubectl apply ki film — scene by scene</h3>
       <pre>$ kubectl apply -f deployment.yaml   (replicas: 3)

1. 🚪 API Server: request validate + authenticate → etcd mein likha
   "Deployment web chahiye, 3 replicas" — ab yeh DESIRED STATE hai
2. 👮 Deployment/ReplicaSet controllers (watch kar rahe the):
   "3 chahiye, 0 hain!" → 3 Pod objects bana diye (abhi sirf kaagaz par)
3. ⚖️ Scheduler (watch kar raha tha): "3 pods ka node assign nahi hai"
   → har pod ke liye best node chuna, API Server ko bataya
4. 🧑‍🔧 kubelet (har node par, watch kar raha tha): "mere node par pod aaya!"
   → containerd se containers chalwaye → status wapas report kiya</pre>
       <p>Notice karo: sab log <b>watch</b> kar rahe hain (API Server par) aur apna-apna kaam
       kar rahe hain. Koi central "boss script" nahi hai — yeh <b>choreography</b> hai,
       conductor-less orchestra. 🎻</p>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Kaun kya karta hai?',
        instructions: 'Control plane ke har component ko uske kaam se milao.',
        pairs: [
          { left: '🚪 API Server', right: 'Cluster ka ekmatra darwaza — har request validate karke etcd mein likhta hai', explain: 'kubectl se lekar kubelet tak — SAB isi se baat karte hain. REST API + auth + validation.' },
          { left: '📔 etcd', right: 'Poore cluster ka data store — desired + actual state ka single source of truth', explain: 'Distributed key-value store. Yeh gaya toh cluster ki yaaddaasht gayi — isliye backup zaroori.' },
          { left: '⚖️ Scheduler', right: 'Har naye pod ke liye best node CHUNTA hai (chalata nahi)', explain: 'Filter (kahan chal SAKTA hai) + score (kahan BEST chalega). Decision API Server ko batata hai — chalana kubelet ka kaam.' },
          { left: '👮 Controller Manager', right: 'Reconciliation loops — desired vs actual ka farak mitane wale controllers', explain: 'ReplicaSet controller, Node controller, Job controller... sab ek binary mein. Yehi "self-healing" ka engine hai.' },
          { left: '🧑‍🔧 kubelet', right: 'Worker node ka agent — API Server se pod spec lekar containers chalwata hai', explain: 'Control plane ka nahi, WORKER node ka component hai — par is kahani ka zaroori kirdaar. Level 3 mein full entry!' },
        ],
      },
      {
        type: 'hotspot',
        title: 'Diagram Detective',
        instructions: 'Diagram ke sahi component par <b>click</b> karo. (Boxes clickable hain!)',
        visual: 'controlplane',
        questions: [
          { q: '<code>kubectl apply</code> ki request sabse pehle kahan jaati hai?', target: 'apiserver', explain: 'API Server — har request ka pehla (aur ekmatra) stop. Auth → validation → etcd.' },
          { q: 'Cluster ka saara state/data kahan saved rehta hai?', target: 'etcd', explain: 'etcd — cluster ki diary. API Server ke alawa koi isse direct baat nahi karta.' },
          { q: '"Yeh pod kis node par chalega?" — yeh decision kaun leta hai?', target: 'scheduler', explain: 'Scheduler — filter + score karke best node chunta hai. (Chalata kubelet hai!)' },
          { q: 'Desired state vs actual state ka farak kaun watch karta rehta hai?', target: 'controller', explain: 'Controller Manager — reconciliation loops ki army. Farak dikha nahi ki action shuru.' },
          { q: 'Worker node par containers ko actually kaun chalwata hai?', target: 'kubelet', explain: 'kubelet — har node ka manager. API Server se spec leta hai, containerd se chalwata hai.' },
        ],
      },
      {
        type: 'order',
        title: 'kubectl apply ki timeline',
        instructions: '<code>kubectl apply -f deployment.yaml</code> (replicas: 3) ke baad jo hota hai, usse sahi order mein lagao.',
        steps: [
          { text: 'API Server request ko validate + authenticate karta hai', explain: 'Pehla stop hamesha API Server — bina auth ke andar entry nahi.' },
          { text: 'Desired state etcd mein likhi jaati hai', explain: 'Ab cluster ki "diary" mein likha hai: web ke 3 replicas chahiye.' },
          { text: 'Controller dekhta hai: 3 chahiye, 0 hain → 3 Pod objects banata hai', explain: 'ReplicaSet controller ka reconciliation — abhi pods sirf etcd mein hain, kisi machine par nahi.' },
          { text: 'Scheduler har pod ke liye best node chunta hai', explain: 'Filter + score. Assignment API Server ke through etcd mein update hota hai.' },
          { text: 'Us node ka kubelet pod spec dekhta hai aur containers chalwata hai', explain: 'kubelet → containerd → image pull → container start. Ab pod REAL hai!' },
          { text: 'kubelet pod ka status wapas API Server ko report karta hai', explain: 'Loop poora hua — ab actual state bhi etcd mein hai. kubectl get pods mein "Running" yahi se aata hai.' },
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Control Plane trivia',
        questions: [
          {
            q: 'Agar poora control plane 10 minute ke liye down ho jaaye, toh tumhari RUNNING app ka kya hoga?',
            choices: [
              'App chalti rahegi! Bas naye deploys/scaling/self-healing ruk jayenge',
              'Saare pods turant band ho jayenge',
              'Traffic aana band ho jayega',
              'Nodes cluster se delete ho jayenge',
            ],
            answer: 0,
            explain: 'Bahut popular interview question! Data plane (nodes + pods + kube-proxy) already-running cheezein chalata rehta hai. Control plane sirf CHANGES ke liye chahiye. Isliye control plane outage = "management freeze", not "app down".',
          },
          {
            q: 'Production mein etcd/control plane ke kitne instances rakhte hain — aur kyun ODD number (3, 5)?',
            choices: [
              'Odd number (3 ya 5) — taaki network split mein majority (quorum) decide ho sake',
              'Hamesha exactly 1 — simple rehta hai',
              'Even number (2 ya 4) — load balance ke liye',
              'Jitne worker nodes, utne hi control planes',
            ],
            answer: 0,
            explain: 'etcd Raft consensus use karta hai — decisions ke liye majority chahiye. 3 mein se 1 mar jaaye toh 2 ki majority hai; 2 mein se 1 mare toh 1 akela majority nahi bana sakta (split-brain). Isliye HA = 3 ya 5.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Control Plane',
      instructions: 'Architecture round — senior engineers se yeh zaroor poocha jaata hai. 🎤',
      questions: [
        {
          q: '"kubectl apply se lekar pod Running hone tak ka poora flow batao" — 30 seconds mein. Sabse SAHI summary kaunsi hai?',
          choices: [
            'API Server validate karke etcd mein likhta hai → controllers pods banate hain → Scheduler node chunta hai → us node ka kubelet containers chalwata hai → status wapas report hota hai',
            'kubectl seedha kubelet ko bolta hai, kubelet containers chala deta hai',
            'Scheduler request receive karta hai, etcd mein likhta hai, phir API Server pods chalata hai',
            'etcd pods banata hai aur Scheduler unhe chalata hai',
          ],
          answer: 0,
          explain: 'Yeh THE architecture question hai. Key points jo bolne hain: (1) sab kuch API Server se, (2) etcd = source of truth, (3) Scheduler sirf DECIDE karta hai, (4) kubelet RUN karta hai. Is flow ko sapne mein bhi bol paao, itna practice karo!',
        },
        {
          q: 'Scheduler down hai. Tum kubectl apply se naya Deployment banate ho. Kya hoga?',
          choices: [
            'Deployment aur Pod objects ban jayenge, par pods PENDING mein atke rahenge — koi node assign nahi karega',
            'kubectl error dega — cluster accept hi nahi karega',
            'Pods chal jayenge, kyunki kubelet khud node chun leta hai',
            'API Server khud scheduling kar dega',
          ],
          answer: 0,
          explain: 'Har component ka apna kaam: API Server accept karega (woh zinda hai), controllers Pod objects banayenge, par nodeName assign karne wala Scheduler so raha hai → pods Pending. Yeh samajhna = components ke roles asli mein samajhna.',
        },
        {
          q: 'Interviewer: "etcd ka backup kyun critical hai, jab saare pods toh nodes par chal rahe hain?"',
          choices: [
            'Kyunki etcd mein DESIRED STATE hai — woh kho gaya toh cluster ko pata hi nahi kya chalna chahiye tha; recovery namumkin ho jaati hai',
            'Kyunki etcd mein container images stored hoti hain',
            'Kyunki etcd ke bina pods ka network band ho jaata hai',
            'Backup sirf compliance ke liye hota hai, technically zaroori nahi',
          ],
          answer: 0,
          explain: 'Pods toh cattle hain — mar jaayein, phir ban jayenge... PAR TABHI jab desired state pata ho. etcd = cluster ki poori memory: Deployments, Services, Secrets, sab. "etcd is the cluster" — yeh line yaad rakho.',
        },
      ],
    },
    success: [
      'Main control plane ke 4 components aur unke exact roles bata sakta hoon',
      'Main kubectl apply → Running pod ka poora flow explain kar sakta hoon (interview-ready!)',
      'Main samajhta hoon ki sab kuch API Server ke through kyun jaata hai',
      'Main bata sakta hoon ki control plane down hone par running apps kyun chalti rehti hain',
    ],
    homework: `<p>Apne minikube cluster ke control plane ko khud dekho:</p>
      <pre>kubectl get pods -n kube-system
# dhundo: etcd-minikube, kube-apiserver-minikube,
#         kube-scheduler-minikube, kube-controller-manager-minikube

kubectl describe pod etcd-minikube -n kube-system | head -20</pre>
      <p>✅ Self-check: Chaaron control plane components pods ke roop mein dikhe? (Haan — control plane khud bhi pods mein chalta hai! 🤯)</p>`,
    cards: [
      { front: 'Control Plane ke 4 components aur ek-line roles?', back: '🚪 <b>API Server</b> — ekmatra entry, validate+auth. 📔 <b>etcd</b> — saara state. ⚖️ <b>Scheduler</b> — pod ke liye node chunta hai. 👮 <b>Controller Manager</b> — desired vs actual reconcile.' },
      { front: 'kubectl apply → pod Running: poora flow?', back: 'API Server (validate, etcd mein likho) → Controllers (Pod objects banao) → Scheduler (node chuno) → kubelet (containers chalao) → status wapas API Server ko.' },
      { front: 'etcd se directly kaun baat kar sakta hai?', back: 'Sirf <b>API Server</b>. Baaki sab (Scheduler, controllers, kubelet, kubectl) API Server ke through. Ek darwaza = security + consistency.' },
      { front: 'Control plane 10 min down — running app ka kya hoga?', back: 'App <b>chalti rahegi</b>! Data plane independent hai. Sirf changes (deploy/scale/self-healing) freeze ho jayenge. Popular interview question!' },
      { front: 'etcd HA mein 3 ya 5 instances hi kyun (odd)?', back: 'Raft consensus ko majority (quorum) chahiye. Odd number se network split mein ek side majority bana leti hai — split-brain nahi hota.' },
    ],
  },

  /* ================= LEVEL 3: Worker Nodes ================= */
  {
    id: 'workernode',
    icon: '💪',
    title: 'Worker Nodes — Jahan asli kaam hota hai',
    badge: 'Node Nigraan',
    objectives: [
      'Worker node ke 3 components: <b>kubelet, kube-proxy, container runtime</b>',
      'kubelet kaise API Server se orders lekar containers chalwata hai',
      'kube-proxy ka networking role (Services ke liye foundation)',
      'Pehli baar <b>kubectl terminal</b> mein haath — get, describe, logs',
    ],
    lesson: [
      `<h3>🏗️ Control plane sochta hai, worker karta hai</h3>
       <p>Level 2 mein dimaag dekha — ab haath-pair. <b>Har worker node par yeh 3 cheezein
       chalti hain:</b></p>
       <table>
         <tr><th>Component</th><th>Role</th><th>Ek line mein</th></tr>
         <tr><td>🧑‍🔧 <b>kubelet</b></td><td>Node ka site-manager</td><td>API Server ko watch karta hai — "mere node par kaunse pods hone chahiye?" — phir runtime se chalwata hai aur health report bhejta hai</td></tr>
         <tr><td>⚙️ <b>containerd</b></td><td>Container runtime</td><td>Image pull, container start/stop — Docker engine ka jo core tha, wahi. kubelet iska boss hai</td></tr>
         <tr><td>🚦 <b>kube-proxy</b></td><td>Traffic ka policeman</td><td>Har node par network rules (iptables/IPVS) set karta hai taaki Service ka traffic sahi pods tak pahunche</td></tr>
       </table>
       <p>💡 Docker connection: <code>containerd</code> wahi runtime hai jo Docker ke andar tha.
       K8s ne beech ka Docker engine hata ke seedha containerd se baat karna shuru kiya —
       isliye "Docker deprecated" headlines aayi thi, par images wahi OCI images hain.</p>`,
      `<h3>💓 kubelet — node ki dhadkan</h3>
       <p>kubelet har kuch seconds mein API Server ko batata hai: <i>"Main zinda hoon,
       mere pods yeh hain, unki health yeh hai"</i>. Isse <b>heartbeat</b> kehte hain.</p>
       <div class="war-story"><b>⚡ Real incident:</b> Ek gaming company ke node ki disk full
       ho gayi → kubelet heartbeat bhejna band → control plane ne 5 min baad node ko
       <b>NotReady</b> mark kiya → uske pods doosre nodes par reschedule hue. Players ko
       sirf ek chhota lag spike mila. Yehi to hai self-healing at node level! (Interview
       Q: "node NotReady ho toh pods ka kya hota hai?" — ab tum jawab jaante ho: ~5 min
       default eviction timeout ke baad doosre nodes par.)</div>
       <p>Commands jo ab tumhare dost banenge:</p>
       <pre>kubectl get nodes              # saare nodes + status
kubectl get pods -o wide       # pods + KAUNSE NODE par hain
kubectl describe pod &lt;name&gt;    # pod ki poori kundli + events
kubectl logs &lt;pod-name&gt;        # container ke logs (stdout)</pre>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Node ke andar kaun kya karta hai?',
        instructions: 'Worker node ke components ko unke kaam se milao.',
        pairs: [
          { left: '🧑‍🔧 kubelet', right: 'API Server se pod specs lekar containers chalwana + health report bhejna', explain: 'Node ka manager. Watch → run → report. Har node par exactly ek.' },
          { left: '⚙️ containerd', right: 'Images pull karna aur containers start/stop karna', explain: 'Runtime — kubelet ke orders par asli containers yahi chalata hai. (Docker ka core yahi tha!)' },
          { left: '🚦 kube-proxy', right: 'Service traffic ke liye har node par network rules banana', explain: 'iptables/IPVS rules — "Service X ka traffic in pods par bhejo". Level 6 (Services) ka hero.' },
          { left: '💓 heartbeat', right: 'kubelet ka regular "main zinda hoon" signal API Server ko', explain: 'Yeh ruk jaaye toh node NotReady — aur uske pods doosre nodes par reschedule hote hain.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Pehla Mission: Cluster Explorer',
        instructions: 'Tumhara pehla kubectl terminal! Mock cluster explore karo — commands type karke (help se list milegi).',
        goal: 'Cluster ko explore karo: <b>(1)</b> nodes ki list dekho, <b>(2)</b> pods kaunse node par hain dekho (<code>-o wide</code>), <b>(3)</b> kisi ek pod ko <code>describe</code> karo.',
        tasks: [
          { text: 'kubectl get nodes — nodes dekho', check: s => s.history.some(h => /^(kubectl|k) get (nodes|no)\b/.test(h)) },
          { text: 'kubectl get pods -o wide — pods + unke nodes', check: s => s.history.some(h => /^(kubectl|k) get (pods|po|pod)\b.*-o ?wide/.test(h)) },
          { text: 'kubectl describe pod &lt;naam&gt; — kisi pod ki kundli', check: s => s.history.some(h => /^(kubectl|k) describe (pod|pods|po) \S+/.test(h)) },
        ],
        cluster: {
          nodes: [
            { name: 'node-1', status: 'Ready', roles: 'control-plane', age: '30d', version: 'v1.30.2', top: '22% 48%' },
            { name: 'node-2', status: 'Ready', roles: '<none>', age: '30d', version: 'v1.30.2', top: '35% 61%' },
            { name: 'node-3', status: 'Ready', roles: '<none>', age: '12d', version: 'v1.30.2', top: '11% 30%' },
          ],
          pods: [
            { name: 'web-7d4f8b9c6d-x2k4p', ready: '1/1', status: 'Running', restarts: 0, age: '2d', node: 'node-2', ip: '10.244.2.14', logs: '10.244.1.1 - - "GET / HTTP/1.1" 200\n10.244.1.1 - - "GET /health HTTP/1.1" 200', events: ['Normal  Scheduled  2d   Successfully assigned default/web-7d4f8b9c6d-x2k4p to node-2', 'Normal  Pulled     2d   Container image "nginx:1.25" already present', 'Normal  Started    2d   Started container web'] },
            { name: 'web-7d4f8b9c6d-m9qzt', ready: '1/1', status: 'Running', restarts: 0, age: '2d', node: 'node-3', ip: '10.244.3.8', logs: '10.244.1.1 - - "GET / HTTP/1.1" 200', events: ['Normal  Scheduled  2d   Successfully assigned default/web-7d4f8b9c6d-m9qzt to node-3', 'Normal  Started    2d   Started container web'] },
            { name: 'api-5c6d7e8f9a-tk3wn', ready: '1/1', status: 'Running', restarts: 1, age: '5d', node: 'node-2', ip: '10.244.2.9', logs: '{"level":"info","msg":"listening on :8080"}', events: ['Normal  Started  5d  Started container api'] },
          ],
          deployments: [
            { name: 'web', ready: '2/2', upToDate: 2, available: 2, age: '2d' },
            { name: 'api', ready: '1/1', upToDate: 1, available: 1, age: '5d' },
          ],
          services: [],
        },
        success: s => [
          /^(kubectl|k) get (nodes|no)\b/,
          /^(kubectl|k) get (pods|po|pod)\b.*-o ?wide/,
          /^(kubectl|k) describe (pod|pods|po) \S+/,
        ].every(re => s.history.some(h => re.test(h))),
        successText: 'Teeno commands chal gayi! Notice kiya? <b>-o wide</b> se dikha ki web ke 2 pods alag-alag nodes par hain (node-2, node-3) — Scheduler ne khud baanta. Aur describe mein <b>Events</b> section pod ki poori kahani batata hai — yeh tumhara #1 debugging tool banega.',
        hints: [
          'Shuru karo: kubectl get nodes',
          'Pods kaunse node par? kubectl get pods -o wide',
          'Kundli kholo: kubectl describe pod web-7d4f8b9c6d-x2k4p (naam ka shuru bhi kaafi hai: describe pod web)',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Node NotReady drama',
        questions: [
          {
            q: 'Node-2 ka power cable nikal gaya. Control plane ko kaise pata chalega?',
            choices: [
              'kubelet ki heartbeat aani band ho jayegi → node NotReady mark hoga',
              'containerd control plane ko SOS bhejega',
              'Pods khud doosre node par bhaag jayenge',
              'kube-proxy alarm bajayega',
            ],
            answer: 0,
            explain: 'Heartbeat hi zariya hai. Default: ~40s tak heartbeat nahi → NotReady; ~5 min baad pods evict hokar doosre nodes par reschedule. (Interview mein yeh timeline impressive lagti hai!)',
          },
          {
            q: 'kubectl logs kis output ko dikhata hai?',
            choices: [
              'Container ke stdout/stderr — jo bhi app ne print kiya',
              'Node ke system logs (syslog)',
              'API Server ke audit logs',
              'Sirf error messages, info nahi',
            ],
            answer: 0,
            explain: 'Container mein jo stdout/stderr par likha, wahi kubectl logs. Isliye best practice: apps file mein nahi, stdout par log karein — 12-factor style. (Observability level mein aur aayega.)',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Nodes & Components',
      instructions: 'Component-knowledge check — yahan clarity dikhao. 🎤',
      questions: [
        {
          q: 'Ek node NotReady ho gaya. Us par chal rahe pods ka kya hoga? (Yeh top-10 interview question hai!)',
          choices: [
            'Default ~5 min baad controller unhe evict karta hai; ReplicaSet-managed pods doosre Ready nodes par naye banaye jaate hain',
            'Pods turant (0 second mein) doosre node par shift ho jaate hain',
            'Pods hamesha ke liye kho jaate hain, manually banane padte hain',
            'Kuch nahi hota — node wapas aane ka intezaar hota hai, chahe kabhi na aaye',
          ],
          answer: 0,
          explain: 'Points to hit: (1) heartbeat miss → NotReady, (2) eviction timeout (~5 min default) ke BAAD eviction — turant nahi, kyunki network blip ho sakta hai, (3) pods "move" nahi hote — NAYE pods bante hain (cattle, not pets!), (4) yeh sirf controller-managed pods ke liye — akela "naked pod" gaya toh gaya.',
        },
        {
          q: 'kubelet aur kube-proxy — dono har node par hain. Farak kya hai?',
          choices: [
            'kubelet PODS ki zindagi sambhalta hai (run/health), kube-proxy NETWORK sambhalta hai (Service traffic routing)',
            'kubelet control plane par hota hai, kube-proxy worker par',
            'Dono same kaam karte hain, naam alag hai',
            'kube-proxy pods chalata hai, kubelet sirf logs collect karta hai',
          ],
          answer: 0,
          explain: 'Simple divide: kubelet = compute (containers chalao, health dekho, report karo), kube-proxy = network (Service ClusterIP ka traffic asli pod IPs tak pahunchane ke iptables/IPVS rules). Dono DaemonSet-style har node par.',
        },
        {
          terminal: {
            title: 'Hands-on: Restart Detective',
            goal: '🧑‍💼 Interviewer: "Is cluster mein ek pod ne restart kiya hai. <b>Dhundo kaunsa</b>, aur uske logs check karke batao sab theek hai ya nahi." (Pehle pods list karo, RESTARTS column dekho, phir logs.)',
            cluster: {
              nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '9d', version: 'v1.30.2' }],
              pods: [
                { name: 'frontend-abc123-aaa', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.244.1.2', logs: 'serving on :3000' },
                { name: 'payments-def456-bbb', ready: '1/1', status: 'Running', restarts: 3, age: '3d', node: 'node-1', ip: '10.244.1.3', logs: '{"level":"info","msg":"recovered, connected to db","attempt":4}', prevLogs: 'panic: connection refused to db:5432 (db not ready yet)', events: ['Warning  BackOff  2d  Back-off restarting failed container'] },
                { name: 'cache-ghi789-ccc', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.244.1.4', logs: 'ready to accept connections' },
              ],
              deployments: [], services: [],
            },
            tasks: [
              { text: 'Pods list karke RESTARTS column dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po|pod)\b/.test(h)) },
              { text: 'Restart hue pod ke logs dekho', check: s => s.history.some(h => /^(kubectl|k) logs payments/.test(h)) },
            ],
            success: s => s.history.some(h => /^(kubectl|k) logs payments/.test(h)),
            successText: 'Mila! <b>payments</b> pod ne 3 baar restart kiya tha — shuruaat mein DB ready nahi tha, isliye crash hota raha; ab "recovered" hai. Pro-tip jo tumne use kiya: current logs OK dikhe toh <code>kubectl logs --previous</code> se PICHHLI crash ke logs milte hain. Interviewer: "Hired." 😎',
            hints: ['kubectl get pods — RESTARTS column par nazar', 'kubectl logs payments-def456-bbb (ya bas: logs payments)', 'Crash ki wajah dekhni ho toh: kubectl logs payments --previous'],
          },
        },
      ],
    },
    success: [
      'Main worker node ke 3 components (kubelet, containerd, kube-proxy) ke roles bata sakta hoon',
      'Main node NotReady hone par pods ka poora eviction flow explain kar sakta hoon',
      'Main kubectl get/describe/logs se cluster explore kar sakta hoon',
      'Main jaanta hoon ki describe ke Events aur logs --previous kab kaam aate hain',
    ],
    homework: `<p>Minikube mein multi-node cluster banao aur explore karo:</p>
      <pre>minikube start --nodes 2 -p multinode
kubectl get nodes                     # 2 nodes!
kubectl get pods -A -o wide           # -A = saare namespaces
# dekho: kube-proxy HAR node par hai (DaemonSet!)</pre>
      <p>✅ Self-check: kube-proxy ke kitne pods dikhe? (Nodes jitne — kyun, yeh Level 11 mein aur clear hoga 😉)</p>`,
    cards: [
      { front: 'Worker node ke 3 components aur roles?', back: '🧑‍🔧 <b>kubelet</b> — pods chalwana + health report. ⚙️ <b>containerd</b> — images pull, containers run. 🚦 <b>kube-proxy</b> — Service traffic ke network rules.' },
      { front: 'Node NotReady → pods ka kya hota hai?', back: 'Heartbeat miss (~40s) → NotReady. ~5 min (default) baad eviction → ReplicaSet doosre nodes par NAYE pods banata hai. Pods "move" nahi hote, replace hote hain.' },
      { front: 'kubectl describe pod mein sabse keemti section?', back: '<b>Events</b> — Scheduled, Pulled, Started, ya Warning (BackOff, FailedScheduling...). Pod ki poori timeline. Debugging ka pehla stop.' },
      { front: 'kubectl logs --previous kab use karte hain?', back: 'Jab container CRASH karke restart ho chuka ho — current logs naye container ke hote hain, <code>--previous</code> pichhle (crashed) container ke logs dikhata hai. CrashLoop debugging ka hathiyaar.' },
    ],
  },

  /* ================= LEVEL 4: Pods ================= */
  {
    id: 'pod',
    icon: '📦',
    title: 'Pod — Sabse Chhoti Unit',
    badge: 'Pod Pakadne Wala',
    objectives: [
      'Pod kya hai aur K8s containers ko directly kyun nahi chalata',
      'Multi-container pods — <b>sidecar pattern</b> kab sahi, kab galat',
      'Pod lifecycle: Pending → Running → Succeeded/Failed, aur states ka matlab',
      '<b>CrashLoopBackOff</b> ko khud debug karna (terminal mission!)',
    ],
    lesson: [
      `<h3>📦 Pod = containers ka shared ghar</h3>
       <p>K8s ki sabse chhoti unit container nahi, <b>Pod</b> hai. Pod ek wrapper hai jisme
       1+ containers rehte hain jo share karte hain:</p>
       <ul>
         <li>🌐 <b>Ek network namespace</b> — ek hi IP, aapas mein <code>localhost</code> par baat</li>
         <li>📂 <b>Volumes</b> — shared folders</li>
         <li>💀 <b>Kismat</b> — saath schedule hote hain, saath marte hain</li>
       </ul>
       <p><b>95% pods mein sirf 1 container hota hai.</b> Multi-container tab jab do processes
       ko itna kaske saath rehna ho ki alag scale karna bekaar ho — jaise app + uska
       <b>log-shipper sidecar</b>, ya app + service-mesh proxy (Istio, advanced track mein!).</p>
       <p>❌ <b>Galat use:</b> web + database ek pod mein. Kyun? Dono ko alag scale karna hai,
       alag update karna hai. Alag pods + Service se jodo.</p>`,
      `<h3>🔄 Pod ki zindagi ke phases</h3>
       <table>
         <tr><th>Phase/Status</th><th>Matlab</th><th>Tumhara move</th></tr>
         <tr><td><code>Pending</code></td><td>Accept ho gaya, par abhi kisi node par containers start nahi hue (scheduling ya image pull baaki)</td><td>Zyada der atka? <code>describe</code> → Events</td></tr>
         <tr><td><code>Running</code></td><td>Node mil gaya, containers chal rahe hain</td><td>😌 (par READY column bhi dekho!)</td></tr>
         <tr><td><code>Succeeded</code></td><td>Container apna kaam karke exit 0 se band hua (Jobs mein normal)</td><td>Kuch nahi</td></tr>
         <tr><td><code>CrashLoopBackOff</code></td><td>Container crash → restart → phir crash → K8s ab rukh-rukh ke try kar raha hai (backoff)</td><td><code>logs</code> + <code>logs --previous</code> + <code>describe</code></td></tr>
         <tr><td><code>ImagePullBackOff</code></td><td>Image download hi nahi ho paa rahi (naam galat / registry auth / network)</td><td><code>describe</code> → Events mein exact reason</td></tr>
       </table>
       <div class="war-story"><b>⚡ Real incident (har company mein hua hai):</b> Deploy ke baad
       pod CrashLoopBackOff. Logs mein: <code>Error: DB_HOST env var not set</code>. Kisi ne
       naya required env var code mein daala, par manifest update karna bhool gaya. 10 minute
       ka outage, ek line ka fix. <b>Ab tum yehi incident terminal mission mein khud solve
       karoge.</b> 👇</div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Same Pod ya Alag Pod?',
        instructions: 'Architecture decision time! Har jodi ko sahi bin mein daalo — kya yeh containers <b>ek pod mein saath</b> hone chahiye, ya <b>alag-alag pods</b> mein?',
        bins: [
          { id: 'same', label: '📦 Same pod (sidecar)' },
          { id: 'diff', label: '📦📦 Alag pods' },
        ],
        items: [
          { text: 'App + uske logs bhejne wala agent', bin: 'same', explain: 'Classic sidecar! Log-shipper ko app ke files/stdout chahiye — shared volume, saath scale. Perfect couple.' },
          { text: 'Web server + PostgreSQL database', bin: 'diff', explain: 'Kabhi nahi ek saath! Alag scaling (web 10x, db 1x), alag lifecycle. Web ke har replica ke saath ek DB? 🙈' },
          { text: 'App + TLS/proxy sidecar (mesh)', bin: 'same', explain: 'Service mesh pattern — proxy har request intercept karta hai, localhost par hi milna zaroori. (Istio yehi karta hai — advanced track!)' },
          { text: 'Frontend + Backend API', bin: 'diff', explain: 'Alag deploy cycles, alag scaling, alag teams. Service se jodo, pod mein mat thooso.' },
          { text: 'App + git-sync (config folder sync karne wala)', bin: 'same', explain: 'Sidecar — shared volume mein config latest rakhta hai. App ko pata bhi nahi chalta.' },
          { text: 'API + Redis cache (sab services use karti hain)', bin: 'diff', explain: 'SHARED cache hai — ek app ka sidecar nahi. Apna Deployment + Service milna chahiye.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: CrashLoop Detective',
        instructions: 'Production incident recreate kiya hai — wahi wala jo lesson mein padha. Ab tum on-call ho!',
        goal: '<b>web</b> pod CrashLoopBackOff mein hai. <b>(1)</b> Pods dekho, <b>(2)</b> logs se root cause dhundo, <b>(3)</b> sahi fix file apply karo (<code>ls</code> se files dekho) — pod Running ho jaana chahiye.',
        tasks: [
          { text: 'Pod ka status dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po|pod)\b/.test(h)) },
          { text: 'Logs se crash ki wajah pakdo', check: s => s.history.some(h => /^(kubectl|k) logs web/.test(h)) },
          { text: 'Sahi fix apply karo → pod Running', check: s => s.cluster.pods.some(p => p.name.startsWith('web') && p.status === 'Running') },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '15d', version: 'v1.30.2' }],
          pods: [
            {
              name: 'web-6f9c5b7d8e-p4tj2', ready: '0/1', status: 'CrashLoopBackOff', restarts: 5, age: '9m', node: 'node-1', ip: '10.244.1.7',
              logs: 'Starting web service v2.4.0...\nLoading config from environment...\nError: DB_HOST env var not set\nprocess exited with code 1',
              prevLogs: 'Starting web service v2.4.0...\nLoading config from environment...\nError: DB_HOST env var not set\nprocess exited with code 1',
              events: ['Normal   Pulled   9m                 Container image "shop/web:2.4.0" already present', 'Warning  BackOff  2m (x21 over 9m)  Back-off restarting failed container web'],
            },
            { name: 'db-0', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.244.1.3', logs: 'database system is ready to accept connections' },
          ],
          deployments: [{ name: 'web', ready: '0/1', upToDate: 1, available: 0, age: '9m' }],
          services: [],
        },
        files: {
          'fix-env.yaml': {
            desc: 'Deployment mein DB_HOST env var add karta hai',
            apply: s => {
              const p = s.cluster.pods.find(p => p.name.startsWith('web'));
              if (p) {
                p.status = 'Running'; p.ready = '1/1'; p.restarts = 5;
                p.logs = 'Starting web service v2.4.0...\nLoading config from environment...\nConnected to db:5432 ✓\nListening on :8080';
              }
              const d = s.cluster.deployments.find(d => d.name === 'web');
              if (d) { d.ready = '1/1'; d.available = 1; }
              return 'deployment.apps/web configured\n(naya pod ban raha hai... DB_HOST=db set hua... Running! ✓)';
            },
          },
          'fix-restart.yaml': {
            desc: 'Bas pod ko restart karta hai (kuch change nahi)',
            apply: () => 'deployment.apps/web unchanged\n(pod restart hua... phir crash: "Error: DB_HOST env var not set" — restart se config problems fix NAHI hoti!)',
          },
          'fix-image.yaml': {
            desc: 'Image ko purane version par rollback karta hai',
            apply: () => 'deployment.apps/web configured\n(web:2.3.9 aa gaya... par yeh version bhi DB_HOST maangta hai → phir crash. Image problem thi hi nahi!)',
          },
        },
        success: s => s.cluster.pods.some(p => p.name.startsWith('web') && p.status === 'Running') && s.history.some(h => /^(kubectl|k) logs web/.test(h)),
        successText: 'Incident resolved! 🧯 Flow yaad rakho — yeh REAL debugging ka muscle-memory hai: <b>get pods</b> (status dekha) → <b>logs</b> (root cause: missing env var) → <b>targeted fix</b> (env add kiya, na ki andha restart). Galat fixes try kiye ho toh dekha hoga: restart/rollback se config problem theek nahi hoti — root cause fix hota hai.',
        hints: [
          'kubectl get pods → web CrashLoopBackOff mein dikhega',
          'kubectl logs web-6f9c5b7d8e-p4tj2 (ya: logs web) → error message padho',
          '"DB_HOST env var not set" = config missing. ls karke dekho — kaunsi file env var ADD karti hai? kubectl apply -f fix-env.yaml',
        ],
      },
      {
        type: 'fill',
        title: 'Pehla Pod Manifest',
        instructions: 'YAML se daro mat — tokens drag karke pehla Pod manifest poora karo. Har field ka matlab explain milega.',
        template: 'apiVersion: v1\nkind: {0}\nmetadata:\n  name: web\n  labels:\n    app: {1}\nspec:\n  containers:\n  - name: web\n    image: {2}\n    ports:\n    - containerPort: {3}',
        blanks: [
          { answer: 'Pod', explain: 'kind batata hai KYA bana rahe ho. Aage Deployment, Service bhi likhoge — sab isi pattern par.' },
          { answer: 'web', explain: 'Labels = chipki hui parchi. Service isi label se pods dhundhega (Level 6 ka pura khel yehi hai!).' },
          { answer: 'nginx:1.25', explain: 'Registry se yahi image pull hogi. Tag (:1.25) hamesha likho — :latest production mein bomb hai 💣.' },
          { answer: '8080', explain: 'Container kis port par sun raha hai — documentation + Service ke liye zaroori.' },
        ],
        tokens: ['Pod', 'web', 'nginx:1.25', '8080', 'Deployment', 'database', 'localhost', '22'],
      },
    ],
    interview: {
      title: 'Interview Round — Pods',
      instructions: 'CrashLoopBackOff wala sawal har K8s interview mein aata hai. Ready? 🎤',
      questions: [
        {
          q: '"Pod CrashLoopBackOff mein hai — apne troubleshooting steps batao." Best FIRST steps kaunse hain?',
          choices: [
            'kubectl logs (+ --previous) aur kubectl describe pod — root cause pehle, action baad mein',
            'Pod delete karo — naya ban jayega, theek ho jayega',
            'Node ko restart karo',
            'Replicas badha do taaki kam se kam kuch pods toh chalein',
          ],
          answer: 0,
          explain: 'Interviewer process dekh raha hai: (1) logs/--previous → app kyun mar rahi hai, (2) describe → Events (OOMKilled? probe fail?), (3) TAB fix. Delete karna = wahi crash phir hoga (ReplicaSet naya banayega, config wahi hai). Replicas badhana = 5 crashed pods > 1 crashed pod 🤦.',
        },
        {
          q: 'CrashLoopBackOff mein "BackOff" ka exact matlab kya hai?',
          choices: [
            'K8s har crash ke baad restart ka wait time BADHATA jaata hai (10s, 20s, 40s... max 5 min)',
            'K8s ne pod ko hamesha ke liye chhod diya hai',
            'Pod peeche wale node par chala gaya hai',
            'Container start hone se pehle hi fail ho raha hai',
          ],
          answer: 0,
          explain: 'Exponential backoff — taaki ek pagal crash-loop poore node ka CPU na kha jaaye. Isliye status kabhi "Running (2s)" phir turant crash dikhta hai. Restart policy + backoff samajhna = pod lifecycle samajhna.',
        },
        {
          q: 'Ek pod mein 2 containers hain: app + log-shipper. App container crash ho gaya. Log-shipper ka kya hoga?',
          choices: [
            'Log-shipper chalta rahega; sirf app container restart hoga (restartPolicy ke hisaab se) — READY 1/2 dikhega',
            'Poora pod turant delete ho jayega',
            'Log-shipper bhi turant crash ho jayega',
            'Dono containers naye node par chale jayenge',
          ],
          answer: 0,
          explain: 'Containers individually restart hote hain — pod wahi rehta hai, wahi IP. READY column "1/2" batayega. Poora pod sirf tab replace hota hai jab pod-level problem ho (eviction, node fail, delete).',
        },
      ],
    },
    success: [
      'Main samjha sakta hoon ki K8s pods ko (na ki containers ko) kyun manage karta hai',
      'Main sidecar pattern ke sahi/galat use-cases pehchan sakta hoon',
      'Main CrashLoopBackOff ko logs → describe → targeted fix flow se debug kar sakta hoon',
      'Main basic Pod YAML likh/padh sakta hoon',
    ],
    homework: `<p>Apne cluster mein khud CrashLoop banao aur debug karo (todna = seekhna!):</p>
      <pre>kubectl run crasher --image=busybox -- sh -c "echo main abhi marunga; exit 1"
kubectl get pods -w          # CrashLoopBackOff aate dekho (-w = watch)
kubectl logs crasher
kubectl describe pod crasher  # Events mein Back-off dekho
kubectl delete pod crasher    # safai</pre>
      <p>✅ Self-check: RESTARTS badhte dekhe? Backoff ka badhta wait notice kiya?</p>`,
    cards: [
      { front: 'Pod ke containers kya-kya share karte hain?', back: '<b>Network namespace</b> (ek IP, localhost par baat), <b>volumes</b>, aur <b>lifecycle</b> (saath schedule, saath evict). Isliye pod = "logical host".' },
      { front: 'CrashLoopBackOff debug flow?', back: '1) <code>kubectl logs</code> (+ <code>--previous</code>) — app ka error. 2) <code>describe pod</code> — Events (OOM? probe?). 3) Root cause fix — andha restart/delete NAHI (wahi crash repeat hoga).' },
      { front: 'Sidecar pattern kab SAHI hai?', back: 'Jab helper container app se kaskar juda ho: log-shipper, mesh proxy, config-syncer. Test: "kya inhe alag scale karna hai?" Haan → alag pods. (Web+DB kabhi same pod nahi!)' },
      { front: 'Pending vs CrashLoopBackOff vs ImagePullBackOff?', back: '<b>Pending</b> — node/image ka intezaar (scheduling issue). <b>CrashLoop</b> — container chal ke MAR raha hai (app/config issue). <b>ImagePull</b> — image download hi fail (naam/auth issue).' },
      { front: 'ImagePullBackOff ke top 3 reasons?', back: '1) Image naam/tag galat (typo!), 2) Private registry — auth/imagePullSecret missing, 3) Network/registry down. <code>describe pod</code> → Events mein exact wajah.' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('beginner', [

  /* ================= LEVEL 5: Deployments & ReplicaSets ================= */
  {
    id: 'deploy',
    icon: '🚀',
    title: 'Deployments — Self-Healing ka Engine',
    badge: 'Rollout Rakshak',
    objectives: [
      'Deployment → ReplicaSet → Pods ki hierarchy — kaun kya sambhalta hai',
      'Ek pod crash hone par <b>peeche kya hota hai</b> (interview favourite!)',
      'Rolling updates — zero-downtime deploy kaise hota hai',
      '<b>Kharab rollout ko safely rollback</b> karna (terminal mission)',
    ],
    lesson: [
      `<h3>👑 Deployment: teen layers ki baraat</h3>
       <pre>🚀 Deployment "web"        ← tum YEH likhte/badalte ho
   └─ 👯 ReplicaSet (v2)     ← ginti ka thekedaar: "hamesha 3"
        ├─ 📦 web-...-x2k4p  ← asli pods (naam = deploy-rsHash-random)
        ├─ 📦 web-...-m9qzt
        └─ 📦 web-...-tk3wn</pre>
       <table>
         <tr><th>Layer</th><th>Zimmedari</th></tr>
         <tr><td><b>Deployment</b></td><td>Versions/updates ka manager — naya image? Rolling update + rollback history</td></tr>
         <tr><td><b>ReplicaSet</b></td><td>Sirf GINTI: "kitne chahiye vs kitne hain" — kam? banao. Zyada? maaro</td></tr>
         <tr><td><b>Pod</b></td><td>Asli kaam — containers chalana</td></tr>
       </table>
       <p><b>Interview classic:</b> "Deployment has 3 replicas, one pod crashes — what happens
       behind the scenes?" → kubelet report karta hai → ReplicaSet controller ko farak dikha
       (2 ≠ 3) → naya Pod object → Scheduler node deta hai → kubelet chalata hai.
       <b>Tum kuch nahi karte.</b> 😴</p>`,
      `<h3>🌊 Rolling Update — bina rukawat naya version</h3>
       <p><code>image: web:v2</code> karte hi Deployment NAYA ReplicaSet banata hai aur
       dheere-dheere shift karta hai:</p>
       <pre>RS-old (v1): 3 → 2 → 1 → 0
RS-new (v2): 0 → 1 → 2 → 3     ← ek-ek karke, ready hote hue

Control knobs:
  maxSurge: 1         # desired se kitne ZYADA temporarily chal sakte
  maxUnavailable: 0   # kitne KAM chalna allowed (0 = kabhi kami nahi)</pre>
       <p>Aur agar v2 kharab nikla? Purana ReplicaSet abhi bhi wahin hai (0 replicas par so raha) —
       <code>kubectl rollout undo</code> usse wapas jaga deta hai. <b>Isi liye history rehti hai!</b></p>
       <div class="war-story"><b>⚡ Real incident (Friday, 5:55 PM 😱):</b> Deploy hua —
       image tag mein typo: <code>web:v2.1</code> ki jagah <code>web:v21</code>. Naye pods
       ImagePullBackOff. Lekin <code>maxUnavailable: 0</code> tha, isliye purane v2.0 pods
       traffic serve karte rahe — <b>zero user impact</b>. On-call ne
       <code>kubectl rollout undo</code> mara, 30 second mein sab normal. Rolling update ka
       safety net asli hai — ab terminal mein khud karoge.</div>`,
    ],
    stages: [
      {
        type: 'fill',
        title: 'Deployment Manifest Banao',
        instructions: 'Ab bade log wala YAML — Deployment manifest ke blanks bharo.',
        template: 'apiVersion: apps/v1\nkind: {0}\nmetadata:\n  name: web\nspec:\n  replicas: {1}\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: {2}\n    spec:\n      containers:\n      - name: web\n        image: {3}',
        blanks: [
          { answer: 'Deployment', explain: 'apps/v1 ka Deployment — pods ka version-manager. (Pod ka apiVersion sirf v1 tha, yeh apps/v1 hai — dhyan rakhna!)' },
          { answer: '3', explain: 'Desired state: hamesha 3 pods. ReplicaSet controller isi number ki raksha karega.' },
          { answer: 'web', explain: 'CRITICAL: template ke labels selector ke matchLabels se MATCH hone chahiye — warna Deployment reject ho jayega. Yeh jodi hi to batati hai "yeh pods mere hain".' },
          { answer: 'shop/web:2.4.0', explain: 'Pinned tag! Yeh badloge toh rolling update trigger hoga — aur history mein purana version rollback ke liye ready rahega.' },
        ],
        tokens: ['Deployment', '3', 'web', 'shop/web:2.4.0', 'Pod', 'database', 'latest', '300'],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Friday Evening Rollback',
        instructions: 'Wahi Friday 5:55 PM incident — ab tum on-call ho. Lesson ka safety net khud use karo.',
        goal: 'Naya deploy hua hai aur kuch pods <b>ImagePullBackOff</b> mein hain. <b>(1)</b> Damage assess karo, <b>(2)</b> describe se exact reason nikalo, <b>(3)</b> <code>kubectl rollout undo deployment/web</code> se rollback karo.',
        tasks: [
          { text: 'get pods — kaunse pods bimar hain?', check: s => s.history.some(h => /^(kubectl|k) get (pods|po|pod)\b/.test(h)) },
          { text: 'describe se ImagePull ki wajah dhundo', check: s => s.history.some(h => /^(kubectl|k) describe (pod|pods|po) web/.test(h)) },
          { text: 'rollout undo → sab Running', check: s => s.cluster.pods.every(p => p.status === 'Running') },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '30d', version: 'v1.30.2' }],
          pods: [
            { name: 'web-5f6a7b8c9d-aaa11', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.5', logs: '[v2.0] serving on :8080' },
            { name: 'web-5f6a7b8c9d-bbb22', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.6', logs: '[v2.0] serving on :8080' },
            { name: 'web-9x8y7z6w5v-ccc33', ready: '0/1', status: 'ImagePullBackOff', restarts: 0, age: '4m', node: 'node-1', ip: '10.244.1.9',
              logs: 'Error from server (BadRequest): container "web" in pod "web-9x8y7z6w5v-ccc33" is waiting to start: trying and failing to pull image',
              events: ['Normal   Pulling  4m               Pulling image "shop/web:v21"', 'Warning  Failed   3m               Failed to pull image "shop/web:v21": manifest for shop/web:v21 not found', 'Warning  Failed   3m               Error: ErrImagePull', 'Normal   BackOff  1m (x6 over 3m)  Back-off pulling image "shop/web:v21"'],
              describe: 'Name:         web-9x8y7z6w5v-ccc33\nNamespace:    default\nNode:         node-1\nStatus:       Pending\nImage:        shop/web:v21   ← 👀 yahan dekho\n\nEvents:\n  Normal   Pulling  4m     Pulling image "shop/web:v21"\n  Warning  Failed   3m     Failed to pull image "shop/web:v21": manifest for shop/web:v21 not found\n  Warning  Failed   3m     Error: ErrImagePull\n  Normal   BackOff  1m     Back-off pulling image "shop/web:v21"' },
          ],
          deployments: [{ name: 'web', ready: '2/3', upToDate: 1, available: 2, age: '6d' }],
          services: [],
        },
        responses: [
          {
            re: /^(kubectl|k) rollout undo (deployment\/web|deploy\/web|deployment web|deploy web)$/,
            mutate: s => {
              s.cluster.pods = s.cluster.pods.filter(p => !p.name.startsWith('web-9x8y7z6w5v'));
              s.cluster.pods.push({ name: 'web-5f6a7b8c9d-ddd44', ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.11', logs: '[v2.0] serving on :8080' });
              const d = s.cluster.deployments[0];
              d.ready = '3/3'; d.upToDate = 3; d.available = 3;
            },
            out: 'deployment.apps/web rolled back\n(purana ReplicaSet v2.0 wapas scale up... naya pod Running ✓)',
          },
          {
            re: /^(kubectl|k) rollout history (deployment\/web|deploy\/web|deployment web|deploy web)$/,
            out: 'deployment.apps/web\nREVISION  CHANGE-CAUSE\n1         image updated to shop/web:v2.0\n2         image updated to shop/web:v21   ← current (broken)',
          },
          {
            re: /^(kubectl|k) rollout status (deployment\/web|deploy\/web|deployment web|deploy web)$/,
            out: s => s.cluster.pods.every(p => p.status === 'Running')
              ? 'deployment "web" successfully rolled out'
              : 'Waiting for deployment "web" rollout to finish: 2 out of 3 new replicas have been updated...\n(atka hua hai — naya pod kabhi ready nahi hoga, image hi nahi mil rahi!)',
          },
        ],
        success: s => s.cluster.pods.every(p => p.status === 'Running') && s.history.some(h => /^(kubectl|k) describe/.test(h)),
        successText: 'Rollback done, users ko kuch pata bhi nahi chala! 🧯 Notice karo: (1) purane v2.0 pods poore time serve karte rahe — <code>maxUnavailable: 0</code> ka kamaal, (2) describe ne EXACT reason diya: <code>manifest for shop/web:v21 not found</code> — tag typo, (3) rollout undo ne purana ReplicaSet wapas jagaya. Bonus seekha: <code>rollout history</code> se revisions dikhti hain.',
        hints: [
          'kubectl get pods → kaunsa pod ImagePullBackOff mein hai?',
          'kubectl describe pod web-9x8y7z6w5v-ccc33 → Events mein image ka naam dhyan se padho (v21? 🤔)',
          'Fix: kubectl rollout undo deployment/web',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Rollout ke andar ki baatein',
        questions: [
          {
            q: 'kubectl scale deploy web --replicas=10 karne par kya hota hai?',
            choices: [
              'ReplicaSet ka desired count 10 hota hai → controller 7 naye pods banata hai (rolling update NAHI hota)',
              'Naya ReplicaSet banta hai aur rolling update hota hai',
              '10 naye pods bante hain, purane 3 delete hote hain',
              'Error — replicas sirf YAML se badal sakte hain',
            ],
            answer: 0,
            explain: 'Scaling ≠ update! Sirf ginti badalti hai, ReplicaSet wahi rehta hai. Naya ReplicaSet sirf POD TEMPLATE (image, env, labels...) change par banta hai.',
          },
          {
            q: 'Deployment ke pods ka naam "web-7d4f8b9c6d-x2k4p" jaisa kyun hota hai?',
            choices: [
              'deployment-naam + ReplicaSet-hash + random pod suffix — hash se pata chalta hai pod kis revision ka hai',
              'Bas random hai, koi matlab nahi',
              'x2k4p node ka naam hota hai',
              '7d4f8b9c6d pod ki IP ka encoded form hai',
            ],
            answer: 0,
            explain: 'web-&lt;rs-hash&gt;-&lt;random&gt;. Do alag hash dikhein get pods mein = do revisions ke pods ek saath (rolling update chal raha hai ya atka hai). Debugging mein yeh pattern padhna kaam aata hai!',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Deployments',
      instructions: 'Rollout aur self-healing — production ke sabse zaroori sawal. 🎤',
      questions: [
        {
          q: '"Deployment mein 3 replicas hain, ek pod crash ho gaya — behind the scenes kya hota hai?" (Screenshot wala Q8!)',
          choices: [
            'kubelet failure report karta hai → ReplicaSet controller ko 2≠3 dikhta hai → naya Pod object → Scheduler node deta hai → kubelet chalata hai. Sab automatic',
            'Deployment controller crashed pod ko SSH karke restart karta hai',
            'kube-proxy naya pod banata hai',
            'Admin ko alert jaata hai, admin naya pod banata hai',
          ],
          answer: 0,
          explain: 'Poora reconciliation chain bolo — yeh dikhata hai ki tum architecture samajhte ho, sirf commands nahi. Keywords: kubelet report, ReplicaSet controller, desired vs actual, Scheduler, naya pod (not "restart").',
        },
        {
          q: '"Rollout fail ho gaya production mein — safely rollback kaise karoge?" (Screenshot wala Q11!)',
          choices: [
            'Pehle rollout status/history se assess, phir kubectl rollout undo — aur post-mortem ke liye history preserve',
            'Saare pods delete kar do, purane apne aap aa jayenge',
            'kubectl delete deployment, phir purana YAML apply',
            'Cluster restart kar do',
          ],
          answer: 0,
          explain: 'Delete deployment = OUTAGE (saare pods jaate hain)! rollout undo purane ReplicaSet ko scale up karta hai — graceful, fast, zero-downtime. Pro answer mein yeh bhi bolo: "phir CI/CD mein root cause fix karke aage badhenge, kyunki undo temporary hai".',
        },
        {
          q: 'maxSurge: 1, maxUnavailable: 0 ka matlab kya hai during rolling update (replicas: 3)?',
          choices: [
            'Ek waqt par max 4 pods (3+1 surge) chal sakte hain, aur kabhi bhi 3 se kam READY nahi honge — full capacity hamesha',
            'Max 1 pod update hoga, baaki purane rahenge',
            'Update ke waqt sirf 1 pod chalega',
            'Surge ka matlab traffic spike hai, pods se lena-dena nahi',
          ],
          answer: 0,
          explain: 'maxSurge = kitne EXTRA allowed (naya pod pehle aayega), maxUnavailable = kitne MISSING allowed (0 = purana tab hatega jab naya READY ho). Yeh combo = sabse safe rollout, thodi extra capacity ki keemat par.',
        },
      ],
    },
    success: [
      'Main Deployment → ReplicaSet → Pod hierarchy aur har layer ka role samjha sakta hoon',
      'Main "pod crash → behind the scenes" ka poora chain bata sakta hoon',
      'Main atke hue rollout ko assess karke safely rollback kar sakta hoon',
      'Main maxSurge/maxUnavailable ka matlab jaanta hoon',
    ],
    homework: `<p>Real rolling update + rollback khelo:</p>
      <pre>kubectl create deployment web --image=nginx:1.25 --replicas=3
kubectl get pods -w                        # 3 pods aate dekho (Ctrl+C)
kubectl set image deployment/web nginx=nginx:1.26
kubectl rollout status deployment/web      # rolling update live!
kubectl set image deployment/web nginx=nginx:i-dont-exist
kubectl get pods                           # ImagePullBackOff dekho — par purane zinda!
kubectl rollout undo deployment/web        # bachao!
kubectl delete deployment web              # safai</pre>
      <p>✅ Self-check: broken image ke time bhi purane pods Running rahe? Yehi safety net hai.</p>`,
    cards: [
      { front: 'Deployment vs ReplicaSet — kiska kya kaam?', back: '<b>Deployment</b> = versions/updates (rolling update, rollback, history). <b>ReplicaSet</b> = sirf ginti (desired count maintain). Tum hamesha Deployment se khelte ho, RS uska minion hai.' },
      { front: '1 of 3 replicas crash — behind the scenes?', back: 'kubelet report → ReplicaSet controller (2≠3) → naya Pod object → Scheduler → kubelet → Running. Human involvement: zero. Yeh chain interview mein ratta maar ke bolo!' },
      { front: 'Failed rollout — safe rollback command aur kyun safe?', back: '<code>kubectl rollout undo deployment/X</code> — purana ReplicaSet (jo 0 par so raha tha) wapas scale up hota hai. Delete deployment kabhi nahi — woh outage hai!' },
      { front: 'Rolling update kab trigger hota hai, kab nahi?', back: 'Pod TEMPLATE change (image, env...) → naya RS + rolling update. Sirf <code>replicas</code> change → scaling only, koi update nahi.' },
      { front: 'maxSurge / maxUnavailable?', back: '<b>maxSurge</b>: desired se kitne ZYADA temporarily OK. <b>maxUnavailable</b>: kitne KAM READY chalega. Surge=1, Unavailable=0 = naya pehle aayega, purana tabhi jayega — full capacity hamesha.' },
    ],
  },

  /* ================= LEVEL 6: Services ================= */
  {
    id: 'service',
    icon: '📞',
    title: 'Services — Pods ka Stable Phone Number',
    badge: 'Service Sanchalak',
    objectives: [
      'Services kyun zaroori hain (pods ki IPs bharosemand nahi!)',
      '<b>Labels & selectors</b> — Service pods ko kaise dhundta hai',
      'ClusterIP vs NodePort vs LoadBalancer — kab kaunsa',
      '<b>Endpoints</b> — aur "Service has no endpoints" ka classic incident (terminal!)',
    ],
    lesson: [
      `<h3>📞 Problem: pods ka number badalta rehta hai</h3>
       <p>Pods cattle hain — marte hain, bante hain, <b>har baar nayi IP</b>. Frontend
       backend ko kaise dhunde? Hardcoded IP? Kal hi toot jayegi.</p>
       <p><b>Service</b> = ek stable virtual IP + DNS naam, jiske peeche matching pods ka
       group hai:</p>
       <pre>Service "api-svc" (10.96.0.42, DNS: api-svc)
   selector: app=api      ← "app=api label wale pods mere hain"
        │
   Endpoints: 10.244.1.5:8080, 10.244.2.7:8080   ← LIVE list
        │                    (pod aaya → add, mara → remove)
   kube-proxy har node par traffic in IPs par baantta hai</pre>
       <p>💡 DNS bhi milta hai free mein: usi namespace mein <code>http://api-svc</code>,
       doosre namespace se <code>api-svc.team-b</code>, full form
       <code>api-svc.team-b.svc.cluster.local</code>.</p>`,
      `<h3>🚪 Teen darwaze — Service types</h3>
       <table>
         <tr><th>Type</th><th>Kaun access kar sakta hai</th><th>Kab use</th></tr>
         <tr><td><code>ClusterIP</code> (default)</td><td>Sirf cluster ke andar</td><td>Internal services — DB, cache, backend APIs. 90% yahi</td></tr>
         <tr><td><code>NodePort</code></td><td>Har node ki IP par ek high port (30000–32767)</td><td>Dev/testing, ya on-prem jugaad. Production entry ke liye nahi</td></tr>
         <tr><td><code>LoadBalancer</code></td><td>Internet (cloud ka LB + public IP)</td><td>Cloud mein app ko bahar kholna — har service ke liye alag LB = ₹₹₹ (isliye aage Ingress aayega!)</td></tr>
       </table>
       <div class="war-story"><b>⚡ Real incident (itna common hai ki meme ban chuka hai):</b>
       Deploy ke baad "app down!" — pods sab <b>Running</b>, service bhi hai. 20 minute
       ke panic ke baad kisi ne <code>kubectl get endpoints</code> mara: <b>ENDPOINTS: &lt;none&gt;</b>.
       Service ka selector tha <code>app: web</code>, pods ka label tha <code>app: webapp</code>.
       Ek shabd ka farak = poora outage. <b>Seekh: "Running pods + no traffic" sunte hi
       endpoints check karo.</b> Terminal mission mein yehi case solve karoge.</div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Kaunsa Service Type?',
        instructions: 'Har scenario ke liye sahi Service type chuno.',
        bins: [
          { id: 'clusterip', label: '🏠 ClusterIP' },
          { id: 'nodeport', label: '🚪 NodePort' },
          { id: 'lb', label: '🌍 LoadBalancer' },
        ],
        items: [
          { text: 'PostgreSQL — sirf backend use kare', bin: 'clusterip', explain: 'DB ko internet se door rakho! ClusterIP = sirf andar walon ke liye. Security 101.' },
          { text: 'Public website AWS EKS par', bin: 'lb', explain: 'Cloud LoadBalancer = managed public entry (ELB provision hota hai). Internet-facing ka standard.' },
          { text: 'Internal metrics API (sirf doosri services ke liye)', bin: 'clusterip', explain: 'Internal = ClusterIP. DNS naam se doosri services access karengi.' },
          { text: 'Laptop ke kind cluster par quick demo', bin: 'nodeport', explain: 'Local mein LB nahi hota — NodePort se node-ip:30xxx par turant access. Dev jugaad zindabad.' },
          { text: 'Redis cache — backend pods ke liye', bin: 'clusterip', explain: 'Story yaad hai? Shared cache = apna ClusterIP Service. Bahar se koi zaroorat nahi.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: The Case of No Endpoints',
        instructions: 'Lesson wala meme-incident, ab tumhari shift mein. Pods Running, app down. Go!',
        goal: 'Users bol rahe hain app down hai, par pods <b>Running</b> hain! <b>(1)</b> Pods + service dekho, <b>(2)</b> <code>kubectl get endpoints</code> se asli problem pakdo, <b>(3)</b> describe/labels compare karke sahi fix apply karo.',
        tasks: [
          { text: 'Pods aur service ki halat dekho', check: s => s.history.some(h => /^(kubectl|k) get (svc|service|services)\b/.test(h)) },
          { text: 'Endpoints check karo — smoking gun 🔫', check: s => s.history.some(h => /^(kubectl|k) get (endpoints|ep)\b/.test(h)) },
          { text: 'Selector fix karo → endpoints wapas', check: s => { const ep = s.cluster.endpoints.find(e => e.name === 'web-svc'); return ep && ep.endpoints !== '<none>'; } },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '30d', version: 'v1.30.2' }],
          pods: [
            { name: 'web-7d4f8b9c6d-aaa', ready: '1/1', status: 'Running', restarts: 0, age: '25m', node: 'node-1', ip: '10.244.1.21', logs: 'serving on :8080 (koi request nahi aa rahi... akela hoon 😢)', describe: 'Name:    web-7d4f8b9c6d-aaa\nLabels:  app=web\n         pod-template-hash=7d4f8b9c6d\nStatus:  Running\nIP:      10.244.1.21' },
            { name: 'web-7d4f8b9c6d-bbb', ready: '1/1', status: 'Running', restarts: 0, age: '25m', node: 'node-1', ip: '10.244.1.22', logs: 'serving on :8080', describe: 'Name:    web-7d4f8b9c6d-bbb\nLabels:  app=web\n         pod-template-hash=7d4f8b9c6d\nStatus:  Running\nIP:      10.244.1.22' },
          ],
          deployments: [{ name: 'web', ready: '2/2', upToDate: 2, available: 2, age: '25m' }],
          services: [{ name: 'web-svc', type: 'ClusterIP', clusterIP: '10.96.0.42', ports: '80/TCP', age: '25m', describe: 'Name:              web-svc\nType:              ClusterIP\nIP:                10.96.0.42\nPort:              80/TCP → 8080\nSelector:          app=webb   ← 👀 dhyan se padho\nEndpoints:         <none>     ← 🚨' }],
          endpoints: [{ name: 'web-svc', endpoints: '<none>', age: '25m' }],
        },
        files: {
          'fix-selector.yaml': {
            desc: 'Service ka selector app=webb → app=web karta hai',
            apply: s => {
              const ep = s.cluster.endpoints.find(e => e.name === 'web-svc');
              ep.endpoints = '10.244.1.21:8080,10.244.1.22:8080';
              const svc = s.cluster.services.find(x => x.name === 'web-svc');
              svc.describe = svc.describe.replace('app=webb   ← 👀 dhyan se padho', 'app=web    ✓ fixed').replace('<none>     ← 🚨', '10.244.1.21:8080,10.244.1.22:8080 ✓');
              return 'service/web-svc configured\n(selector app=web hua... endpoints controller ne matching pods dhundhe... 2 endpoints add ✓)';
            },
          },
          'fix-restart-pods.yaml': {
            desc: 'Pods ko restart karta hai',
            apply: () => 'deployment.apps/web restarted\n(pods naye ban gaye... par endpoints ab bhi <none> — pods ki problem thi hi nahi! Selector ab bhi app=webb hai.)',
          },
          'fix-port.yaml': {
            desc: 'Service ka port 80 → 8080 karta hai',
            apply: () => 'service/web-svc configured\n(port badla... par endpoints ab bhi <none>. Port tab matter karta jab pods JUDE hote. Pehle selector match karao!)',
          },
        },
        success: s => { const ep = s.cluster.endpoints.find(e => e.name === 'web-svc'); return ep && ep.endpoints !== '<none>' && s.history.some(h => /^(kubectl|k) get (endpoints|ep)\b/.test(h)); },
        successText: 'Case closed! 🕵️ Ab yeh tumhara reflex hona chahiye: <b>"pods Running + app down" → <code>kubectl get endpoints</code></b>. &lt;none&gt; dikha? → service ka selector vs pods ke labels compare karo (<code>describe svc</code> + <code>describe pod</code>). Ek typo (webb vs web) poora outage bana sakta hai — labels ko copy-paste karo, type nahi!',
        hints: [
          'kubectl get svc aur kubectl get endpoints dono chalao — endpoints <none> dikhega',
          'kubectl describe svc web-svc → Selector padho. Phir kubectl describe pod web → Labels padho. Farak dikha?',
          'Selector galat hai (webb ≠ web) → kubectl apply -f fix-selector.yaml',
        ],
      },
      {
        type: 'order',
        title: 'Request ka Poora Safar',
        instructions: 'User ke browser se pod tak — request ka poora raasta sahi order mein lagao. (Interview Q7: "Explain the complete request flow"!)',
        steps: [
          { text: 'User browser mein URL kholta hai → DNS cloud LoadBalancer ki IP deta hai', explain: 'Public DNS (shop.com) LB ki public IP par point karta hai.' },
          { text: 'Cloud LoadBalancer request ko cluster ke Ingress controller tak bhejta hai', explain: 'LB = building ka main gate. Ingress controller (nginx pod) tak pahunchata hai. (Ingress ki full story intermediate mein!)' },
          { text: 'Ingress rules dekh kar sahi Service chunta hai (host/path se)', explain: 'shop.com/api → api-svc, shop.com/ → web-svc. Ingress = routing rules ki kitaab.' },
          { text: 'Service ke endpoints mein se ek healthy pod IP chunta hai', explain: 'Service = stable naam, endpoints = live pod list. Yahin load balancing hota hai.' },
          { text: 'kube-proxy ke rules traffic ko us pod tak pahunchate hain', explain: 'iptables/IPVS magic — ClusterIP se asli pod IP tak translation.' },
          { text: 'Pod ka container request process karke response deta hai', explain: 'Wapas usi raaste se. Ab tum Q7 "User → Ingress → Service → Pod" confidently explain kar sakte ho!' },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Services & Networking',
      instructions: 'Screenshot ke Q2, Q3, Q15 — sab yahin milenge. 🎤',
      questions: [
        {
          q: '"Saare pods Running hain par application inaccessible hai — kahan se shuru karoge?" (Q2!)',
          choices: [
            'Service layer se: kubectl get endpoints — selector/labels mismatch ya port galat hona sabse common hai; phir DNS aur network path',
            'Pods delete karke naye banaunga',
            'Node restart karunga',
            'Replicas badha dunga taaki traffic mile',
          ],
          answer: 0,
          explain: 'Structure bolo: pods OK (Running + READY?) → Service→endpoints (selector match? port sahi? targetPort?) → DNS (nslookup svc) → Ingress/LB config. "Endpoints check karna" bolte hi interviewer samajh jaata hai ki tumne asli debugging ki hai.',
        },
        {
          q: '"Ek replica ko traffic mil raha hai, doosre ko nahi — kaise debug karoge?" (Q3!)',
          choices: [
            'Dono pods ke labels + READY state compare karunga, aur endpoints list mein dono IPs hain ya nahi dekhunga',
            'Jisse traffic nahi mil raha usse delete kar dunga',
            'Service ko NodePort bana dunga',
            'Dono pods ke logs same hone chahiye, bas',
          ],
          answer: 0,
          explain: 'Traffic sirf endpoints-listed pods ko milta hai. Pod endpoints se bahar kyun? (1) label alag/missing, (2) READY nahi (readiness probe fail — intermediate mein!), (3) alag namespace. get endpoints + describe pod = 2 min mein jawab.',
        },
        {
          q: 'Frontend pod se backend Service ko access karna hai (same namespace). Best URL kya hai?',
          choices: [
            'http://backend-svc — Service ka DNS naam; stable hai, IP badle toh bhi chalta hai',
            'http://10.244.1.5:8080 — pod ki IP directly',
            'http://node-1:30080 — NodePort se',
            'Backend ki IP env var mein hardcode karo deploy ke waqt',
          ],
          answer: 0,
          explain: 'DNS naam hi THE way hai. Pod IPs ephemeral hain, NodePort andar walon ke liye bekaar detour hai. Cross-namespace ho toh backend-svc.other-ns. Yeh chhota sa sawal seniors ko juniors se alag karta hai.',
        },
      ],
    },
    success: [
      'Main samjha sakta hoon ki Services kyun zaroori hain aur selectors kaise kaam karte hain',
      'Main ClusterIP/NodePort/LoadBalancer mein sahi choice kar sakta hoon',
      'Main "Running pods par app down" ko endpoints se debug kar sakta hoon',
      'Main User → LB → Ingress → Service → Pod ka poora flow bata sakta hoon',
    ],
    homework: `<p>No-endpoints incident khud recreate karo — todna hi asli practice hai:</p>
      <pre>kubectl create deployment web --image=nginx --replicas=2
kubectl expose deployment web --name=web-svc --port=80 --selector=app=webb  # galat selector — jaan boojh ke!
kubectl get endpoints web-svc      # &lt;none&gt; 🚨
kubectl delete svc web-svc
kubectl expose deployment web --name=web-svc --port=80    # sahi (selector auto)
kubectl get endpoints web-svc      # ab IPs dikhengi ✓
kubectl run test --rm -it --image=busybox -- wget -qO- web-svc   # andar se test!
kubectl delete deployment web; kubectl delete svc web-svc</pre>
      <p>✅ Self-check: wget se nginx ka HTML aaya? Congrats — tumne Service DNS + endpoints dono verify kiye.</p>`,
    cards: [
      { front: 'Service pods ko kaise dhundta hai?', back: '<b>Label selector</b> se — selector <code>app=web</code> matlab "app=web label wale saare READY pods mere endpoints hain". Endpoints list live update hoti hai.' },
      { front: '"Pods Running par app down" — pehla command?', back: '<code>kubectl get endpoints</code>! &lt;none&gt; = selector/labels mismatch ya pods NOT READY. Yeh K8s ka sabse common production bug hai.' },
      { front: 'ClusterIP vs NodePort vs LoadBalancer?', back: '<b>ClusterIP</b> — sirf andar (default, DBs/APIs). <b>NodePort</b> — har node par 30000+ port (dev/test). <b>LoadBalancer</b> — cloud LB + public IP (internet-facing).' },
      { front: 'Service ka DNS naam pattern?', back: 'Same namespace: <code>svc-name</code>. Cross: <code>svc-name.namespace</code>. Full: <code>svc-name.ns.svc.cluster.local</code>. Hamesha DNS use karo, kabhi pod IP nahi.' },
      { front: 'User → app tak request flow (Q7)?', back: 'User → DNS → <b>Cloud LB</b> → <b>Ingress controller</b> (host/path rules) → <b>Service</b> (endpoints se pod chuno) → <b>kube-proxy rules</b> → <b>Pod</b>. Ratta maaro, roz kaam aayega!' },
    ],
  },

  /* ================= LEVEL 7: ConfigMaps, Secrets & Namespaces ================= */
  {
    id: 'config',
    icon: '🎒',
    title: 'ConfigMaps, Secrets & Namespaces',
    badge: 'Config Chanakya',
    objectives: [
      'Config ko image se bahar kyun rakhte hain (12-factor)',
      'ConfigMap vs Secret — kab kya, aur Secret ki <b>base64 wali sachai</b>',
      'env vars vs volume mount — dono tarike aur unka farak',
      'Namespaces — ek cluster mein alag-alag mohalle',
    ],
    lesson: [
      `<h3>🎒 Code ek, config alag-alag</h3>
       <p>Golden rule: <b>same image har environment mein</b> — staging, prod, sab.
       Farak sirf config ka: DB ka address, feature flags, API keys. Yeh sab image ke
       BAHAR rehta hai:</p>
       <table>
         <tr><th></th><th>ConfigMap</th><th>Secret</th></tr>
         <tr><td>Kya rakhein</td><td>Non-sensitive: URLs, flags, log level</td><td>Sensitive: passwords, tokens, TLS keys</td></tr>
         <tr><td>Storage</td><td>Plain text</td><td><b>base64 — encryption NAHI!</b> Bas encoding</td></tr>
         <tr><td>Extra suraksha</td><td>—</td><td>RBAC se access control + etcd encryption-at-rest (+ asli solution: Vault/ESO — advanced track)</td></tr>
       </table>
       <div class="war-story"><b>⚡ Real leak:</b> 2023 mein researchers ne hazaaron public
       GitHub repos mein K8s Secrets ke YAML paaye — log soch rahe the base64 = safe.
       <code>echo cGFzc3dvcmQ= | base64 -d</code> → "password". 2 second mein decode.
       <b>Secret YAML kabhi git mein commit mat karo</b> (advanced track mein iska
       proper solution: External Secrets Operator).</div>`,
      `<h3>💉 Pod mein config kaise ghusti hai — 2 raaste</h3>
       <pre># Raasta 1: env vars (simple, common)
env:
- name: DB_HOST
  valueFrom:
    configMapKeyRef: { name: app-config, key: db_host }

# Raasta 2: volume mount (files ban ke aati hai)
volumes:
- name: config-vol
  configMap: { name: app-config }   # → /etc/config/db_host file</pre>
       <p><b>Farak jo interview mein poocha jaata hai:</b> env vars pod start par FIX ho
       jaate hain (config badli → pod restart chahiye); volume-mounted files LIVE update
       hoti hain (thodi der mein) — app agar file re-read kare toh restart ki zaroorat nahi.</p>
       <h3>🏘️ Namespaces — cluster ke mohalle</h3>
       <pre>kubectl get pods                  # default namespace
kubectl get pods -n team-payments # us mohalle ke pods
kubectl get pods -A               # saare mohalle</pre>
       <p>Alag teams/environments/apps ko alag namespace — naam clash nahi hote,
       RBAC se access alag (advanced), ResourceQuota se hadd tay hoti hai.
       <code>kube-system</code> yaad hai? Control plane ka apna mohalla!</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'ConfigMap ya Secret?',
        instructions: 'Har cheez ko sahi jagah daalo. Galti yahan = production leak wahan!',
        bins: [
          { id: 'cm', label: '🗒️ ConfigMap' },
          { id: 'secret', label: '🔑 Secret' },
        ],
        items: [
          { text: 'DB_HOST=postgres.internal', bin: 'cm', explain: 'Address sensitive nahi hai — ConfigMap. (Password hota toh alag baat!)' },
          { text: 'DB_PASSWORD=s3cr3t!', bin: 'secret', explain: 'Password = Secret. Hamesha. RBAC se protect karo aur git mein kabhi mat rakho.' },
          { text: 'LOG_LEVEL=debug', bin: 'cm', explain: 'Behaviour flag — ConfigMap ka textbook case.' },
          { text: 'Stripe API key', bin: 'secret', explain: 'Payment credentials leak = seedha paisa jaata hai. Secret + (aage) external vault.' },
          { text: 'TLS certificate ki private key', bin: 'secret', explain: 'kubernetes.io/tls type ka Secret — Ingress SSL ke liye yahi use hota hai (intermediate mein!).' },
          { text: 'FEATURE_DARK_MODE=true', bin: 'cm', explain: 'Feature flag — public ho jaaye toh bhi koi khatra nahi. ConfigMap.' },
        ],
      },
      {
        type: 'fill',
        title: 'Config Inject Karo',
        instructions: 'ConfigMap banao aur uski value pod mein env var ki tarah inject karo.',
        template: 'apiVersion: v1\nkind: {0}\nmetadata:\n  name: app-config\ndata:\n  db_host: {1}\n---\n# Pod spec (concept):\n  env:\n  - name: DB_HOST\n    valueFrom:\n      {2}:\n        name: app-config\n        key: {3}',
        blanks: [
          { answer: 'ConfigMap', explain: 'kind: ConfigMap — non-sensitive config ka ghar.' },
          { answer: 'postgres.internal', explain: 'Value — DB ka address. Har environment ke ConfigMap mein alag ho sakta hai, image same rahegi.' },
          { answer: 'configMapKeyRef', explain: 'env var ki value ConfigMap ki key se aayegi. (Secret hota toh: secretKeyRef — pattern same!)' },
          { answer: 'db_host', explain: 'ConfigMap ke data section ki exact key. Typo kiya toh pod start hi nahi hoga: CreateContainerConfigError.' },
        ],
        tokens: ['ConfigMap', 'postgres.internal', 'configMapKeyRef', 'db_host', 'Secret', 'secretKeyRef', 'password123', 'DB_HOST'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Config ki barikiyan',
        questions: [
          {
            q: 'ConfigMap update ki, par pod ENV VARS mein purani value hi hai. Kyun?',
            choices: [
              'Env vars pod START par set hote hain — nayi value ke liye pod restart/rollout chahiye',
              'ConfigMap update karna allowed nahi hai',
              'kubectl bug hai',
              'Env vars sirf Secrets se aa sakte hain',
            ],
            answer: 0,
            explain: 'Classic gotcha! Env = snapshot at start. Isliye: kubectl rollout restart deployment/X. Volume-mounted config hoti toh file thodi der mein khud update ho jaati.',
          },
          {
            q: 'kubectl get pods chalaya, apna pod nahi dikha — par tumhe pata hai woh zinda hai. Sabse likely wajah?',
            choices: [
              'Woh doosre NAMESPACE mein hai — kubectl get pods -A se dhundo',
              'Pod invisible mode mein hai',
              'kubectl purana hai',
              'Pod sirf describe se dikhta hai',
            ],
            answer: 0,
            explain: 'Har kubectl command namespace-scoped hai (default: "default"). Roz ka confusion: -n &lt;namespace&gt; ya -A lagao. Yeh chhoti cheez ghanton bacha leti hai!',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Config & Namespaces',
      instructions: 'Security-minded jawab do — yahi senior sign hai. 🎤',
      questions: [
        {
          q: '"Kubernetes Secrets kitne secure hain by default?" — honest jawab kya hai?',
          choices: [
            'Sirf base64-encoded hain (encryption nahi) — RBAC + etcd encryption-at-rest lagana padta hai, aur serious setups external managers (Vault/ESO) use karte hain',
            'Military-grade encrypted hote hain by default',
            'Insecure hain isliye kabhi use nahi karne chahiye',
            'Sirf cluster admin hi unhe padh sakta hai, hamesha',
          ],
          answer: 0,
          explain: 'Nuanced jawab hi sahi jawab hai: base64 ≠ encryption (2 sec mein decode), DEFAULT etcd mein plaintext, isliye: RBAC tight karo, encryption-at-rest on karo, git mein kabhi nahi, aur scale par Vault/External Secrets. Yeh depth advanced track mein aayegi.',
        },
        {
          q: 'Staging aur production ke liye best practice kya hai — config kaise alag karoge?',
          choices: [
            'Same image, alag namespace/cluster mein alag ConfigMaps/Secrets — deploy pipeline sirf config badalti hai',
            'Staging aur prod ke liye alag-alag images banao (config baked-in)',
            'Code mein if(env=="prod") likho',
            'Prod config ko default rakho, staging manually badlo',
          ],
          answer: 0,
          explain: '"Build once, deploy everywhere" — 12-factor. Config baked images = har env ka alag build = "staging mein toh chal raha tha" bugs. (Aage Kustomize overlays isi ko aur clean karenge — advanced track!)',
        },
        {
          q: 'Ek pod ko namespace team-a mein hai, usse team-b ke Service "db-svc" se baat karni hai. Kya likhoge?',
          choices: [
            'http://db-svc.team-b — service-name.namespace DNS pattern',
            'Impossible — namespaces ke beech traffic nahi jaa sakta',
            'http://db-svc — DNS khud dhundh lega',
            'team-b ke pod ki IP hardcode karo',
          ],
          answer: 0,
          explain: 'Namespaces NAMING isolation dete hain, network isolation NAHI (by default sab sabse baat kar sakte hain — yeh problem NetworkPolicies solve karengi, intermediate mein!). Cross-namespace DNS: svc.namespace.',
        },
      ],
    },
    success: [
      'Main config ko image se bahar rakhne ka principle samjha sakta hoon',
      'Main ConfigMap vs Secret ka sahi use aur Secret ki limitations jaanta hoon',
      'Main env vars vs volume mounts ka practical farak bata sakta hoon',
      'Main namespaces mein kaam kar sakta hoon (-n, -A, cross-namespace DNS)',
    ],
    homework: `<p>Config inject karke dekho:</p>
      <pre>kubectl create configmap app-config --from-literal=db_host=postgres.internal
kubectl create secret generic app-secret --from-literal=db_pass=s3cr3t
kubectl get secret app-secret -o yaml       # base64 dekho
echo &lt;woh-value&gt; | base64 -d                # 🤯 2 second mein decode!
kubectl run test --rm -it --image=busybox --env-from=configMapRef:app-config? </pre>
      <p>(env-from wala syntax thoda alag hai — <code>kubectl explain pod.spec.containers.envFrom</code> se khudai karo, yehi asli seekhna hai!)</p>
      <p>✅ Self-check: base64 decode karke value dekhi? Ab kabhi Secret ko "encrypted" mat bolna. 😄</p>`,
    cards: [
      { front: 'Secret base64 — kya yeh encryption hai?', back: '<b>NAHI!</b> Base64 sirf encoding hai — <code>base64 -d</code> se 2 sec mein decode. Suraksha aati hai: RBAC + etcd encryption-at-rest + external managers (Vault/ESO) se.' },
      { front: 'ConfigMap update ki — pod ko nayi value kab milegi?', back: '<b>Env vars</b>: sirf restart par (rollout restart karo). <b>Volume mount</b>: file thodi der mein live update ho jaati hai. Yeh farak interview + debugging dono mein aata hai.' },
      { front: 'Namespace kya isolate karta hai, kya NAHI?', back: 'Karta hai: naam, RBAC scope, quotas. <b>NAHI karta: network!</b> By default har pod har namespace ke pod se baat kar sakta hai — network isolation ke liye NetworkPolicy chahiye.' },
      { front: 'Cross-namespace service access?', back: '<code>service-name.namespace</code> (e.g. <code>db-svc.team-b</code>). Full: <code>db-svc.team-b.svc.cluster.local</code>.' },
    ],
  },

  /* ================= LEVEL 8: BOSS ================= */
  {
    id: 'boss1',
    icon: '🐉',
    title: 'BOSS: Pehla Production Deploy',
    badge: 'Pod Pandit',
    objectives: [
      'Track 1 ka sab kuch ek saath: deploy → verify → debug → expose → verify',
      'Ek asli incident ko decision-tree mein solve karna',
      'Final interview gauntlet — 4 sawal, koi hint nahi 😈',
    ],
    lesson: [
      `<h3>🐉 Boss fight rules</h3>
       <p>Nayi company, pehla din, aur DevOps engineer chhutti par. Tumhe "shop" app
       production mein utaarni hai — poora flow, akele. Jo seekha hai sab lagega:</p>
       <ul>
         <li>🖥️ <b>Round 1:</b> Terminal — deploy from scratch (apply → verify → debug → service → endpoints)</li>
         <li>🚨 <b>Round 2:</b> Incident — live outage, sahi decisions lo</li>
         <li>🎤 <b>Round 3:</b> Interview gauntlet — Track 1 ka sab kuch</li>
       </ul>
       <p>Diagram (intro wala) hi tumhara map hai. All the best, Shishya! 🙏</p>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Round 1: Deploy From Scratch',
        instructions: 'Khaali cluster, teen YAML files (ls se dekho), ek goal: app LIVE karo.',
        goal: '<b>(1)</b> <code>deployment.yaml</code> apply karo, <b>(2)</b> pods verify karo — ek problem milegi, logs se solve karo, <b>(3)</b> <code>service.yaml</code> apply karke <b>(4)</b> endpoints verify karo. App live = jeet!',
        tasks: [
          { text: 'Deployment apply karo', check: s => s.history.some(h => /apply -f deployment.yaml/.test(h)) },
          { text: 'Config problem dhundo aur fix karo (logs!)', check: s => s.cluster.pods.length > 0 && s.cluster.pods.every(p => p.status === 'Running') },
          { text: 'Service apply karo', check: s => s.history.some(h => /apply -f service.yaml/.test(h)) },
          { text: 'Endpoints verify karo (get endpoints)', check: s => s.history.some(h => /^(kubectl|k) get (endpoints|ep)\b/.test(h)) },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '45d', version: 'v1.30.2' }, { name: 'node-2', status: 'Ready', roles: '<none>', age: '45d', version: 'v1.30.2' }],
          pods: [], deployments: [], services: [], endpoints: [], configmaps: [{ name: 'shop-config', dataCount: 1, age: '45d' }],
        },
        files: {
          'deployment.yaml': {
            desc: 'shop app ka Deployment (2 replicas)',
            apply: s => {
              if (s.cluster.deployments.some(d => d.name === 'shop')) return 'deployment.apps/shop unchanged';
              s.cluster.deployments.push({ name: 'shop', ready: '0/2', upToDate: 2, available: 0, age: '5s' });
              s.cluster.pods.push(
                { name: 'shop-abc123-p1', ready: '0/1', status: 'CrashLoopBackOff', restarts: 1, age: '5s', node: 'node-1', ip: '10.244.1.30', logs: 'shop v1.0 starting...\nFATAL: env CURRENCY not set (INR? USD?)\nexit 1', events: ['Warning  BackOff  1s  Back-off restarting failed container'] },
                { name: 'shop-abc123-p2', ready: '0/1', status: 'CrashLoopBackOff', restarts: 1, age: '5s', node: 'node-2', ip: '10.244.2.30', logs: 'shop v1.0 starting...\nFATAL: env CURRENCY not set (INR? USD?)\nexit 1', events: ['Warning  BackOff  1s  Back-off restarting failed container'] },
              );
              return 'deployment.apps/shop created\n(pods aa rahe hain... get pods se dekho)';
            },
          },
          'fix-currency.yaml': {
            desc: 'Deployment mein CURRENCY env var add karta hai (shop-config se)',
            apply: s => {
              if (!s.cluster.deployments.some(d => d.name === 'shop')) return 'error: pehle deployment.yaml apply karo!';
              s.cluster.pods.forEach(p => { if (p.name.startsWith('shop')) { p.status = 'Running'; p.ready = '1/1'; p.logs = 'shop v1.0 starting...\nCURRENCY=INR ✓\nlistening on :3000'; } });
              const d = s.cluster.deployments.find(d => d.name === 'shop');
              d.ready = '2/2'; d.available = 2;
              const ep = s.cluster.endpoints.find(e => e.name === 'shop-svc');
              if (ep) ep.endpoints = '10.244.1.30:3000,10.244.2.30:3000';
              return 'deployment.apps/shop configured\n(CURRENCY env inject hua... pods restart... Running ✓)';
            },
          },
          'service.yaml': {
            desc: 'shop-svc ClusterIP Service (selector: app=shop)',
            apply: s => {
              if (s.cluster.services.some(x => x.name === 'shop-svc')) return 'service/shop-svc unchanged';
              s.cluster.services.push({ name: 'shop-svc', type: 'ClusterIP', clusterIP: '10.96.0.77', ports: '80/TCP', age: '2s' });
              const running = s.cluster.pods.filter(p => p.name.startsWith('shop') && p.status === 'Running');
              s.cluster.endpoints.push({ name: 'shop-svc', endpoints: running.length ? running.map(p => p.ip + ':3000').join(',') : '<none>', age: '2s' });
              return 'service/shop-svc created' + (running.length ? '' : '\n(⚠️ endpoints <none> — pods abhi Running nahi hain! Pehle unhe theek karo.)');
            },
          },
        },
        success: s =>
          s.cluster.pods.length > 0 && s.cluster.pods.every(p => p.status === 'Running') &&
          (s.cluster.endpoints.find(e => e.name === 'shop-svc') || {}).endpoints &&
          (s.cluster.endpoints.find(e => e.name === 'shop-svc') || {}).endpoints !== '<none>' &&
          s.history.some(h => /^(kubectl|k) get (endpoints|ep)\b/.test(h)),
        successText: 'APP IS LIVE! 🎉 Tumne akele poora deploy kiya: apply → CrashLoop mila → logs se root cause (missing env) → targeted fix → service → <b>endpoints verify</b>. Yeh last step hi junior aur senior ka farak hai — deploy "ho gaya" nahi, deploy "verify hua" bolo!',
        hints: [
          'Shuru: ls → kubectl apply -f deployment.yaml → get pods',
          'CrashLoopBackOff? kubectl logs shop-abc123-p1 → CURRENCY missing → fix-currency.yaml apply karo',
          'Phir: apply -f service.yaml → get endpoints → dono pod IPs dikhni chahiye',
        ],
      },
      {
        type: 'incident',
        title: '🚨 Round 2: Checkout Down!',
        instructions: 'Ab decision-making test hogi. Har galat move ka cost hai — socho, phir chuno.',
        pager: '<b>ALERT:</b> checkout-service 5xx errors 94% · 3:07 AM · revenue impact ₹₹₹/min<br>Deploy hua tha 20 min pehle (v3.2 → v3.3)',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ kubectl get pods -l app=checkout\nNAME                  READY  STATUS             RESTARTS  AGE\ncheckout-9f8e7-aaa    0/1    CrashLoopBackOff   4         18m\ncheckout-9f8e7-bbb    0/1    CrashLoopBackOff   4         17m\ncheckout-5d6c4-ccc    1/1    Running            0         6d',
            text: 'Teen pods — do naye crash ho rahe, ek purana zinda. Pehla move?',
            choices: [
              { t: 'kubectl logs checkout-9f8e7-aaa — naye pods kyun mar rahe hain?', good: true, next: 'n2', explain: 'Sahi! Root cause pehle. Logs = crash ki zubaan.' },
              { t: 'Teeno pods delete karo — fresh start', good: false, explain: 'Naye pods wahi crash karenge (config wahi hai), aur PURANA HEALTHY POD bhi mar jayega — 100% outage bana doge! Kabhi bhi "sab delete" 3 AM ka move nahi hai.' },
              { t: 'Node restart karo', good: false, explain: 'Node ki koi galti nahi dikh rahi — purana pod usi node par mast chal raha hai. Shotgun debugging = aur bada blast radius.' },
            ],
          },
          n2: {
            sitrep: '$ kubectl logs checkout-9f8e7-aaa\ncheckout v3.3 starting...\nconnecting to payments-gateway...\nFATAL: PAYMENT_API_KEY invalid (expired 2024-01-01)\nexit 1',
            text: 'Logs saaf bol rahe hain: v3.3 ka PAYMENT_API_KEY expired hai. Ab kya?',
            choices: [
              { t: 'kubectl rollout undo deployment/checkout — pehle service bachao', good: true, next: 'n3', explain: 'Bilkul! 3 AM ka rule: MITIGATE FIRST. v3.2 chal raha tha — usse wapas lao. Key ka permanent fix subah team ke saath.' },
              { t: 'Naya API key generate karke abhi Secret update karo', good: false, explain: 'Payment provider ka portal, access, approvals — 3 AM par? 30+ min lagenge, revenue jalta rahega. Rollback 30 SECOND ka hai. Mitigate first, fix later!' },
              { t: 'Crashing pods ko scale down karke sirf purana chalne do', good: false, explain: 'Manual jugaad — deployment desired state wapas ladegi, aur ek pod pura load nahi utha payega. Rollback hi clean move hai.' },
            ],
          },
          n3: {
            sitrep: '$ kubectl rollout undo deployment/checkout\ndeployment.apps/checkout rolled back\n\n$ kubectl get pods -l app=checkout\ncheckout-5d6c4-ccc    1/1  Running  0  6d\ncheckout-5d6c4-ddd    1/1  Running  0  40s\ncheckout-5d6c4-eee    1/1  Running  0  38s\n\n5xx rate: 94% → 0.2% 📉',
            text: 'Service theek! Incident band karne se pehle aakhri zaroori kaam?',
            choices: [
              { t: 'Endpoints/traffic verify karo + incident notes likho (timeline, root cause, follow-up: key rotation)', good: true, next: 'end', explain: 'Verify + document. Subah ki team ko timeline chahiye, aur "expired key detection" jaisa follow-up warna 6 mahine baad phir 3 AM. 📝' },
              { t: 'So jao — kaam ho gaya', good: false, explain: 'Verify kiye bina kabhi incident band nahi karte! Aur bina notes ke root cause fix hoga hi nahi — sirf snooze kiya hai problem ko.' },
              { t: 'v3.3 dobara deploy karke dekho, shayad ab chale', good: false, explain: '😱 Wahi expired key, wahi crash, wapas outage. Bina fix ke re-deploy = incident #2 khud bulaya.' },
            ],
          },
          end: {
            end: true,
            text: 'Incident resolved — like a pro! 🧯',
            summary: '<b>Tumne kya sahi kiya:</b> (1) Logs pehle — root cause without guessing, (2) <b>Mitigate first</b> — rollback (30 sec) > perfect fix (30 min) at 3 AM, (3) Verify + document. Yeh decision pattern har real incident mein repeat hoga. On-call ke liye ready ho!',
          },
        },
      },
      {
        type: 'quiz',
        title: '🎤 Round 3 warm-up: Speed Round',
        instructions: 'Interview gauntlet se pehle — 3 rapid-fire. Bina soche jawab aana chahiye ab!',
        questions: [
          { q: 'kubectl apply ke baad pod ko node kaun assign karta hai?', choices: ['Scheduler', 'kubelet', 'API Server', 'kube-proxy'], answer: 0, explain: 'Scheduler decide karta hai, kubelet chalata hai. Ab toh neend mein bhi bolo!' },
          { q: 'Service ke endpoints &lt;none&gt; hain. Sabse pehla shak?', choices: ['Selector vs pod labels mismatch (ya pods NOT READY)', 'etcd down hai', 'DNS kharab hai', 'Node NotReady hai'], answer: 0, explain: 'No-endpoints = 90% selector/label mismatch, 10% not-ready pods. Muscle memory ban gayi? 💪' },
          { q: 'CrashLoopBackOff — pehla command?', choices: ['kubectl logs (+ --previous)', 'kubectl delete pod', 'kubectl scale --replicas=0', 'node restart'], answer: 0, explain: 'Logs → root cause → targeted fix. Track 1 ka sabse bada sabak.' },
        ],
      },
    ],
    interview: {
      title: '🎤 FINAL Interview Gauntlet — Track 1',
      instructions: 'Sab kuch mila-jula. Yeh pass = tum genuinely K8s foundations jaante ho.',
      questions: [
        {
          q: 'Poora flow: kubectl apply -f deploy.yaml (replicas: 2) se lekar user ki request pod tak pahunchne tak — kaunsa chain SAHI hai?',
          choices: [
            'API Server→etcd → controllers pods banate → Scheduler nodes chunta → kubelet chalata → Service endpoints jodta → kube-proxy route karta → user ki request pod tak',
            'kubectl→kubelet→containerd→pods→Scheduler registers→Service',
            'API Server→Scheduler→etcd→kube-proxy pods banata→Service→kubelet route karta',
            'Controllers→API Server→kubelet→Scheduler→endpoints→pod',
          ],
          answer: 0,
          explain: 'Control plane (apply→running) + data path (request→pod) dono ek saath — yeh poori Track 1 story hai. Yeh ek jawab clear = foundations clear.',
        },
        {
          q: 'Deploy kiya, kuch pods "Pending" mein atke hain. Kaunsi jagah dekhoge sabse pehle?',
          choices: [
            'kubectl describe pod → Events (FailedScheduling? resources? image?)',
            'kubectl logs — pod ke logs',
            'Service ke endpoints',
            'kubectl rollout undo turant',
          ],
          answer: 0,
          explain: 'Trick: Pending pod ke LOGS nahi hote (container start hi nahi hua)! describe→Events hi batayega kyun schedule nahi hua. "Pending = describe, Crash = logs" — yaad rakho.',
        },
        {
          q: 'Tumhare paas ek Running pod hai jo READY 0/1 dikha raha hai. Iska matlab?',
          choices: [
            'Container chal raha hai par readiness check pass nahi — Service traffic NAHI bhejega isse',
            'Pod crash hone wala hai',
            'Pod doosre node par migrate ho raha hai',
            'READY column ka koi khaas matlab nahi',
          ],
          answer: 0,
          explain: 'Running ≠ Ready! READY endpoints membership decide karta hai. (Readiness probes ki poori kahani agle track ke Level 2 mein — yeh sawal wahan ka trailer hai 😉)',
        },
        {
          q: 'Ek junior ne "quick fix" ke liye production pod ke andar exec karke config file edit kar di. Sabse badi problem?',
          choices: [
            'Pod replace hote hi fix GAYAB — desired state (YAML/git) mein change hai hi nahi; K8s mein truth hamesha declarative config mein hota hai',
            'exec karna hamesha illegal hai',
            'File edit se pod slow ho jaata hai',
            'Kuch galat nahi — kaam toh ho gaya',
          ],
          answer: 0,
          explain: 'Cattle, not pets! Pod kabhi bhi replace ho sakta hai (crash, eviction, rollout) — manual changes bhaap ban ke ud jaate hain. Fix hamesha manifest mein (aur aage: git mein — GitOps, advanced track ka finale).',
        },
      ],
    },
    success: [
      'Main zero se app deploy karke endpoints tak verify kar sakta hoon',
      'Main 3 AM incident mein sahi decisions le sakta hoon (mitigate first!)',
      'Main Track 1 ke saare interview questions confidently face kar sakta hoon',
      'Main officially Pod Pandit hoon 🏆 — Intermediate track unlocked!',
    ],
    homework: `<p>Graduation project — sab kuch ek saath, apne real cluster par:</p>
      <pre>kubectl create ns shop
kubectl -n shop create configmap shop-cfg --from-literal=CURRENCY=INR
kubectl -n shop create deployment shop --image=nginx --replicas=2
kubectl -n shop expose deployment shop --port=80
kubectl -n shop get endpoints shop     # verify!
kubectl -n shop run test --rm -it --image=busybox -- wget -qO- shop
kubectl delete ns shop                 # ek command mein poora mohalla saaf</pre>
      <p>✅ Self-check: wget response aaya? Namespace delete se sab clean hua? Track 1 COMPLETE! 🎓</p>`,
    cards: [
      { front: '3 AM incident ka golden rule?', back: '<b>Mitigate first, fix later.</b> Rollback (30 sec) > perfect fix (30 min) jab revenue jal raha ho. Root cause subah, service abhi. Aur band karne se pehle: VERIFY + document.' },
      { front: '"Pending" vs "CrashLoopBackOff" — debugging ka pehla tool?', back: '<b>Pending</b> → describe (Events) — logs hote hi nahi. <b>CrashLoop</b> → logs/--previous — container chala tha, bola kya jaake dekho.' },
      { front: 'Pod ke andar manual fix (exec se edit) kyun bura hai?', back: 'Pod replace hote hi fix gayab — desired state mein woh change tha hi nahi. K8s mein truth = declarative manifest (aage: git). Cattle, not pets!' },
    ],
  },

]);
