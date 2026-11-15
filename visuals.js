/* =====================================================================
   KubeGurukul — Concept Visuals
   Har level ka ek signature diagram, style.css ke .dg-* primitives se.
   Pure HTML/CSS/emoji — koi dependency nahi.
   Entry: { t: chhota title, html: diagram markup }
   Hotspot games ke liye clickable nodes par data-hs="<target>" hota hai.
   ===================================================================== */

const VISUALS = {

  /* ================= TRACK 1 — BEGINNER ================= */

  whyk8s: {
    t: 'Docker akela vs Kubernetes ke saath',
    html: `
      <div class="dg-split">
        <div class="dg-box is-bad"><span class="bx-label">🐳 Sirf Docker</span>
          <div class="dg-col">
            <div class="dg-node is-bad"><span class="ni">💥</span><span class="nl">Container crash</span><span class="ns">raat 3 baje</span></div>
            <span class="dg-pill bad">😴 tum: manually ssh + docker restart</span>
            <span class="dg-pill bad">📈 traffic 10x? manually 10 aur chalao</span>
          </div>
        </div>
        <div class="dg-box is-good"><span class="bx-label">☸️ Kubernetes ke saath</span>
          <div class="dg-col">
            <div class="dg-node is-good pulse"><span class="ni">🤖</span><span class="nl">Self-healing</span><span class="ns">crash → auto restart</span></div>
            <span class="dg-pill good">😴 tum: chain ki neend</span>
            <span class="dg-pill good">📈 traffic 10x? replicas: 30 — done</span>
          </div>
        </div>
      </div>
      <div class="dg-cap">Tum <b>desired state</b> batate ho ("mujhe 3 replicas chahiye") — Kubernetes din-raat usse <b>maintain</b> karta hai. Yehi orchestration hai.</div>`,
  },

  controlplane: {
    t: 'Control Plane — cluster ka dimaag',
    scene: {
      intro: '<b>Sawal:</b> <code>kubectl apply</code> ke baad pod chalne tak kaun-kaun kya karta hai?',
      aria: 'kubectl apply se pod Running tak ke 9 kadam',
      groups: [
        { label: '🧠 Control Plane', cols: [1, 2], rows: [0, 1], tone: 'accent' },
        { label: '💪 Worker Node', cols: [1, 2], rows: [2, 2], tone: 'good' },
      ],
      nodes: [
        { id: 'kubectl', col: 0, row: 1, icon: '💻', label: 'kubectl', sub: 'tumhara laptop', about: 'Command-line tool. kubectl sirf API Server se baat karta hai — kisi node ya etcd se seedha nahi.' },
        { id: 'sched', col: 1, row: 0, icon: '⚖️', label: 'Scheduler', sub: 'pod → kaunsa node?', about: 'Scheduler sirf <b>faisla</b> karta hai ki pod kis node par jayega. Scheduler pod ko chalata nahi.' },
        { id: 'api', col: 1, row: 1, icon: '🚪', label: 'API Server', sub: 'ek hi darwaza', tone: 'accent', about: 'Cluster ka ek hi darwaza. Har component (kubectl, Scheduler, Controller Manager, kubelet) sirf API Server se baat karta hai.' },
        { id: 'etcd', col: 2, row: 0, icon: '📔', label: 'etcd', sub: 'cluster ki diary', tone: 'gold', about: 'Key-value database. Cluster ka saara state yahin likha hai. etcd se sirf API Server baat karta hai.' },
        { id: 'cm', col: 2, row: 1, icon: '👮', label: 'Controller Manager', sub: 'chahiye vs hai', about: 'Kai controllers ka group. Har controller ek hi kaam karta hai: "kitne chahiye" aur "kitne hain" ka farak mitana.' },
        { id: 'kubelet', col: 1, row: 2, icon: '🧑‍🔧', label: 'kubelet', sub: 'node ka manager', tone: 'good', about: 'Har worker node par ek kubelet chalta hai. kubelet us node ke pods ke containers chalwata hai.' },
        { id: 'pod', col: 2, row: 2, icon: '📦', label: 'Pod: web', sub: 'abhi nahi bana', tone: 'muted', about: 'Tumhari app ka container isi ke andar chalta hai.' },
      ],
      steps: [
        { from: 'kubectl', to: 'api', label: 'apply -f', say: '<b>kubectl</b> Deployment ka YAML <b>API Server</b> ko bhejta hai. API Server pehle jaanchta hai: tum kaun ho, aur tumhe Deployment banane ki ijaazat hai ya nahi.' },
        { from: 'api', to: 'etcd', label: 'likho', tone: 'gold', say: '<b>API Server</b> Deployment ko <b>etcd</b> mein likhta hai. Ab "web ke 3 pods chahiye" cluster ka <b>desired state</b> hai. Abhi tak koi pod nahi bana.' },
        { from: 'api', to: 'cm', label: 'naya Deployment', say: '<b>Controller Manager</b> API Server ko lagataar dekhta rehta hai (watch). Controller Manager ko naya Deployment dikhta hai: chahiye 3 pods, hain 0.' },
        { from: 'cm', to: 'api', label: '3 Pod objects', bend: 26, set: { pod: { sub: 'Pending (node nahi)', tone: '' } }, say: '<b>Controller Manager</b> API Server se 3 Pod objects banwata hai (Deployment controller → ReplicaSet → Pods). Pods abhi sirf likhe gaye hain — kisi node par nahi chal rahe. Status: <code>Pending</code>.' },
        { from: 'api', to: 'sched', label: 'Pending pod', say: '<b>Scheduler</b> bhi API Server ko dekh raha tha. Scheduler ko dikhta hai ki 3 pods ke paas koi node nahi hai.' },
        { from: 'sched', to: 'api', label: 'node-1 chuna', bend: 26, set: { pod: { sub: 'node-1 mila' } }, say: '<b>Scheduler</b> har pod ke liye ek node chunta hai (CPU/memory aur rules dekh kar) aur node ka naam <b>API Server</b> ko likhwa deta hai. Scheduler ka kaam yahin khatam.' },
        { from: 'api', to: 'kubelet', label: 'tumhara pod', say: 'node-1 ka <b>kubelet</b> API Server ko dekh raha tha. kubelet ko dikhta hai ki ek pod node-1 ko diya gaya hai.' },
        { from: 'kubelet', to: 'pod', label: 'container start', tone: 'good', set: { pod: { sub: 'Running ✓', tone: 'good' } }, say: '<b>kubelet</b> container runtime (containerd) se image pull karwata hai aur container chalwata hai. Ab <b>Pod: web</b> sach mein chal raha hai.' },
        { from: 'kubelet', to: 'api', label: 'status: Running', tone: 'good', bend: -26, say: '<b>kubelet</b> pod ka status <b>API Server</b> ko wapas bhejta hai. Isi liye <code>kubectl get pods</code> mein <code>Running</code> dikhta hai. Dhyaan do: har teer API Server se hokar gaya — components aapas mein seedhi baat nahi karte.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">💻</span><span class="nl">kubectl</span><span class="ns">apply -f app.yaml</span></div>
        <div class="dg-link"><span class="dg-pill acc">REST API</span><div class="dg-arrow flow"></div></div>
        <div class="dg-col">
          <div class="dg-box is-accent"><span class="bx-label">🧠 Control Plane</span>
            <div class="dg-flow">
              <div class="dg-node is-accent pulse" data-hs="apiserver"><span class="ni">🚪</span><span class="nl">API Server</span><span class="ns">sab isse baat karte hain</span></div>
              <div class="dg-node is-gold" data-hs="etcd"><span class="ni">📔</span><span class="nl">etcd</span><span class="ns">cluster ki diary</span></div>
            </div>
            <div class="dg-flow" style="margin-top:10px">
              <div class="dg-node" data-hs="scheduler"><span class="ni">⚖️</span><span class="nl">Scheduler</span><span class="ns">pod → kaunsa node?</span></div>
              <div class="dg-node" data-hs="controller"><span class="ni">👮</span><span class="nl">Controller Mgr</span><span class="ns">desired vs actual</span></div>
            </div>
          </div>
          <div class="dg-down flow"></div>
          <div class="dg-box is-good"><span class="bx-label">💪 Worker Node</span>
            <div class="dg-flow">
              <div class="dg-node is-good" data-hs="kubelet"><span class="ni">🧑‍🔧</span><span class="nl">kubelet</span><span class="ns">pods chalata hai</span></div>
              <div class="dg-node is-good"><span class="ni">📦</span><span class="nl">Pods</span><span class="ns">tumhari app</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="dg-cap"><b>API Server</b> hi ekmatra darwaza hai — kubectl, Scheduler, kubelet <i>sab</i> usi se baat karte hain. Components aapas mein direct baat <b>nahi</b> karte.</div>`,
  },

  workernode: {
    t: 'Worker Node ke andar kya chalta hai',
    scene: {
      intro: '<b>Sawal:</b> Scheduler ne kaha "pod: web node-1 par chalega". Ab node-1 ke andar kaun kya karta hai?',
      aria: 'Worker node ke andar kubelet, containerd aur kube-proxy ka kaam, 9 kadam',
      groups: [{ label: '🖥️ Worker Node: node-1', cols: [1, 2], rows: [0, 1], tone: 'good' }],
      nodes: [
        { id: 'api', col: 0, row: 0, icon: '🧠', label: 'API Server', sub: 'control plane mein', tone: 'accent', about: 'Cluster ka ek hi darwaza. Node ke teeno hisse (kubelet, kube-proxy) API Server se hi jaankari lete hain.' },
        { id: 'kubelet', col: 1, row: 0, icon: '🧑‍🔧', label: 'kubelet', sub: 'node ka manager', about: 'Har node par ek kubelet. kubelet API Server se apne node ke pods ki list leta hai, container runtime se pods chalwata hai, probes chalata hai aur node ki sehat ki report bhejta hai.' },
        { id: 'crt', col: 2, row: 0, icon: '⚙️', label: 'containerd', sub: 'container runtime', about: 'Asli kaam karne wala: image kheenchna aur container shuru/band karna. kubelet containerd se CRI naam ke raaste se baat karta hai.' },
        { id: 'client', col: 0, row: 1, icon: '🧑', label: 'Client', sub: 'web-svc ko bulata hai', about: 'Cluster ke andar ka koi doosra pod jo Service: web-svc ko call karta hai.' },
        { id: 'proxy', col: 1, row: 1, icon: '🚦', label: 'kube-proxy', sub: 'traffic ke niyam', about: 'Har node par ek kube-proxy. kube-proxy node par niyam (iptables / IPVS) likhta hai: "Service ka IP → in pod IPs par bhejo".' },
        { id: 'pod', col: 2, row: 1, icon: '📦', label: 'pod: web', sub: 'abhi bana nahi', tone: 'muted', about: 'pod: web ko Scheduler ne node-1 par rakha hai.' },
      ],
      steps: [
        { at: ['api'], say: 'Scheduler ka faisla <b>API Server</b> mein likha hai: "pod: web → node-1". Abhi tak node-1 par kuch nahi chala.' },
        { from: 'kubelet', to: 'api', label: 'mere liye naya pod?', say: '<b>kubelet</b> node-1 ka manager hai. <b>kubelet</b> lagataar <b>API Server</b> ko dekhta rehta hai: "node-1 ke liye koi naya pod hai?" API Server kubelet ko call nahi karta — kubelet khud dekhta hai.' },
        { from: 'kubelet', to: 'crt', label: 'image lao, chalao', say: '<b>kubelet</b> khud container nahi chalata. <b>kubelet</b> <b>containerd</b> ko kehta hai: "image kheencho aur container shuru karo".' },
        { from: 'crt', to: 'pod', label: 'container shuru', tone: 'good', set: { pod: { tone: 'good', sub: 'Running · 10.244.1.7' } }, say: '<b>containerd</b> image kheenchta hai aur container shuru karta hai. <b>pod: web</b> ab Running hai.' },
        { from: 'kubelet', to: 'pod', label: 'probes', say: '<b>kubelet</b> <b>pod: web</b> par probes chalata hai: "zinda ho? traffic le sakte ho?" Container mar jaye toh kubelet hi container ko dobara shuru karwata hai.' },
        { from: 'kubelet', to: 'api', label: 'status: Running', tone: 'good', say: '<b>kubelet</b> <b>API Server</b> ko batata hai: "pod: web Running hai". kubelet node-1 ki sehat ki report bhi bhejta rehta hai. Report band → node NotReady.' },
        { from: 'proxy', to: 'api', label: 'Service ki list', say: '<b>kube-proxy</b> bhi <b>API Server</b> ko dekhta hai: kis Service ke peeche kaun se pod IP hain. kube-proxy us list se node par traffic ke niyam likhta hai.' },
        { from: 'client', to: 'proxy', label: 'web-svc:80', say: '<b>Client</b> Service web-svc ka IP bulata hai. Node par <b>kube-proxy</b> ke likhe niyam us request ko pakad lete hain.' },
        { from: 'proxy', to: 'pod', label: 'pod ke IP par', tone: 'good', say: 'Niyam request ko <b>pod: web</b> ke asli IP (10.244.1.7) par bhej dete hain. Dhyaan do: kube-proxy khud traffic nahi uthata. kube-proxy sirf niyam likhta hai; traffic Linux kernel bhejta hai.' },
        { at: ['kubelet', 'crt', 'proxy'], say: 'Yaad rakho — har worker node par teen cheezein: <b>kubelet</b> (manager), <b>containerd</b> (container chalane wala), <b>kube-proxy</b> (Service ke traffic ke niyam).' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">🧠</span><span class="nl">Control Plane</span><span class="ns">API Server</span></div>
        <div class="dg-link"><span class="dg-pill acc">"yeh pod chalao"</span><div class="dg-arrow flow"></div></div>
        <div class="dg-box is-good"><span class="bx-label">💪 Worker Node</span>
          <div class="dg-flow">
            <div class="dg-node is-good pulse" data-hs="kubelet"><span class="ni">🧑‍🔧</span><span class="nl">kubelet</span><span class="ns">node ka manager</span></div>
            <div class="dg-node" data-hs="runtime"><span class="ni">⚙️</span><span class="nl">containerd</span><span class="ns">container runtime</span></div>
            <div class="dg-node is-gold" data-hs="kubeproxy"><span class="ni">🚦</span><span class="nl">kube-proxy</span><span class="ns">traffic ka policeman</span></div>
          </div>
          <div class="dg-flow" style="margin-top:10px">
            <div class="dg-node"><span class="ni">📦</span><span class="nl">pod: web</span><span class="ns">nginx</span></div>
            <div class="dg-node"><span class="ni">📦</span><span class="nl">pod: api</span><span class="ns">node.js</span></div>
            <div class="dg-node is-muted"><span class="ni">📦</span><span class="nl">pod: cache</span><span class="ns">redis</span></div>
          </div>
        </div>
      </div>
      <div class="dg-cap"><b>kubelet</b> = site supervisor (API Server se orders leta hai, containerd se pods banwata hai, health report bhejta hai) · <b>kube-proxy</b> = Service traffic ko sahi pod tak pahunchata hai.</div>`,
  },

  pod: {
    t: 'Pod — ek ghar, ek se zyada kamre',
    scene: {
      intro: '<b>Sawal:</b> Kubernetes container ko seedha kyun nahi chalata? Pod naam ka dabba beech mein kyun hai?',
      aria: 'Ek pod ke do containers: saajha IP, localhost aur volume; container restart, 8 kadam',
      groups: [{ label: '📦 Pod: web · IP 10.244.1.7', cols: [1, 2], rows: [0, 1], tone: 'good' }],
      nodes: [
        { id: 'client', col: 0, row: 0, icon: '🧑', label: 'Client', sub: 'request bhejta hai' },
        { id: 'app', col: 1, row: 0, icon: '🍳', label: 'container: app', sub: 'port 8080', tone: 'accent', about: 'Pod ka mukhya container. Asli kaam (API, website) yahi karta hai.' },
        { id: 'ship', col: 2, row: 0, icon: '🧹', label: 'container: shipper', sub: 'sidecar (madadgaar)', about: 'Madadgaar container. container: app ki log file padh kar logs ko bahar bhejta hai. Aise madadgaar container ko sidecar kehte hain.' },
        { id: 'loki', col: 3, row: 0, icon: '🗃️', label: 'Loki', sub: 'central logs', about: 'Pod ke bahar ka system jahan saare logs jama hote hain.' },
        { id: 'kubelet', col: 0, row: 1, icon: '🧑‍🔧', label: 'kubelet', sub: 'node ka manager', about: 'kubelet pod ke containers par nazar rakhta hai. Container mare toh kubelet usi container ko dobara shuru karta hai.' },
        { id: 'vol', col: 1, row: 1, icon: '📂', label: 'volume: logs', sub: 'emptyDir (saajha)', about: 'Pod ke andar ka saajha folder. Pod ke dono containers is folder ko dekh sakte hain. emptyDir pod ke saath banta hai aur pod ke saath hi mit jaata hai.' },
      ],
      steps: [
        { at: ['app', 'ship'], say: '<b>Pod: web</b> ke andar do containers hain: <b>container: app</b> aur <b>container: shipper</b>. Kubernetes dono ko hamesha ek saath, ek hi node par rakhta hai.' },
        { from: 'client', to: 'app', label: '10.244.1.7:8080', say: 'Pod ka <b>ek hi IP</b> hai: 10.244.1.7. <b>Client</b> us IP ke port 8080 par <b>container: app</b> se baat karta hai.' },
        { from: 'app', to: 'vol', label: 'log file likho', say: '<b>container: app</b> apni log file <b>volume: logs</b> mein likhta hai.' },
        { from: 'ship', to: 'vol', label: 'log file padho', say: '<b>container: shipper</b> wahi file <b>volume: logs</b> se padhta hai. Dono containers ki filesystem alag-alag hai. Sirf saajha volume dono ko dikhta hai.' },
        { from: 'ship', to: 'app', label: 'localhost:8080', say: 'Dono containers ek hi network mein hain. <b>container: shipper</b> <b>container: app</b> ko <code>localhost:8080</code> par bula sakta hai. Isliye ek pod ke do containers ek hi port nahi le sakte.' },
        { from: 'ship', to: 'loki', label: 'logs bhejo', tone: 'good', say: '<b>container: shipper</b> logs ko <b>Loki</b> tak bhejta hai. container: app ko Loki ke baare mein kuch pata nahi. Yahi sidecar pattern hai: madadgaar kaam alag container mein.' },
        { from: 'kubelet', to: 'app', label: 'crash → restart', tone: 'bad', set: { app: { tone: 'gold', sub: 'restart #3' } }, say: 'Maan lo <b>container: app</b> crash ho gaya. <b>kubelet</b> sirf container: app ko dobara shuru karta hai. Pod wahi rehta hai: IP wahi, <b>volume: logs</b> ka data wahi. Baar-baar crash ho toh status <b>CrashLoopBackOff</b> dikhta hai.' },
        { at: ['app', 'ship', 'vol'], say: 'Yaad rakho: pod = saath jeene-marne wale containers ka ghar. <b>Saajha:</b> IP, localhost, volumes. <b>Alag:</b> filesystem aur CPU / memory limits. Pod delete hua → emptyDir volume ka data bhi gaya.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-box is-accent"><span class="bx-label">📦 Pod (ek IP: 10.244.1.7)</span>
          <div class="dg-flow">
            <div class="dg-node is-accent"><span class="ni">🍳</span><span class="nl">app container</span><span class="ns">main dish</span></div>
            <div class="dg-node is-gold"><span class="ni">🧹</span><span class="nl">sidecar</span><span class="ns">log shipper</span></div>
          </div>
          <div class="dg-flow" style="margin-top:8px">
            <span class="dg-pill acc">🔗 same network — localhost par baat</span>
            <span class="dg-pill gold">📂 shared volumes</span>
          </div>
        </div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <span class="dg-pill">Pending</span><div class="dg-arrow" style="flex-basis:24px"></div>
        <span class="dg-pill acc">Running</span><div class="dg-arrow" style="flex-basis:24px"></div>
        <span class="dg-pill good">Succeeded</span>
      </div>
      <div class="dg-flow" style="margin-top:6px">
        <span class="dg-pill bad">💥 crash → restart → crash → CrashLoopBackOff</span>
      </div>
      <div class="dg-cap">Pod = containers ka <b>ghar</b> — ek IP, ek saath schedule, ek saath marte hain. K8s containers ko nahi, <b>pods</b> ko manage karta hai.</div>`,
  },

  deploy: {
    t: 'Deployment → ReplicaSet → Pods',
    scene: {
      intro: '<b>Sawal:</b> raat ko ek pod mar jaye toh naya pod kaun banata hai?',
      aria: 'Deployment, ReplicaSet aur self-healing ke 6 kadam',
      nodes: [
        { id: 'dep', col: 1, row: 0, icon: '🚀', label: 'Deployment: web', sub: 'replicas: 3', tone: 'accent', about: 'Tum Deployment likhte ho. Deployment ek ReplicaSet banata hai, aur naye version par rolling update + rollback sambhalta hai.' },
        { id: 'rs', col: 1, row: 1, icon: '👯', label: 'ReplicaSet', sub: 'ginti: hamesha 3', tone: 'gold', about: 'ReplicaSet ka ek hi kaam hai: pods ki ginti utni rakhna jitni likhi hai. Pod kam hua → naya banao. Zyada hua → ek hatao.' },
        { id: 'p1', col: 0, row: 2, icon: '📦', label: 'web-pod-1', sub: 'Running', tone: 'good' },
        { id: 'p2', col: 1, row: 2, icon: '📦', label: 'web-pod-2', sub: 'Running', tone: 'good' },
        { id: 'p3', col: 2, row: 2, icon: '📦', label: 'web-pod-3', sub: 'Running', tone: 'good' },
        { id: 'p4', col: 3, row: 2, icon: '✨', label: 'web-pod-4', sub: 'abhi nahi bana', tone: 'muted' },
      ],
      steps: [
        { from: 'dep', to: 'rs', label: 'replicas: 3', say: '<b>Deployment: web</b> ek <b>ReplicaSet</b> banata hai aur use ginti deta hai: 3 pods.' },
        { at: ['rs', 'p1', 'p2', 'p3'], say: '<b>ReplicaSet</b> 3 pods banata hai: web-pod-1, web-pod-2, web-pod-3. Teeno <code>Running</code> hain. Chahiye 3, hain 3 — ReplicaSet shaant hai.' },
        { at: ['p2'], set: { p2: { tone: 'bad', sub: 'mar gaya 💀' } }, say: 'Raat 3 baje <b>web-pod-2</b> ka node crash ho jaata hai. web-pod-2 mar gaya. Tum so rahe ho.' },
        { from: 'p2', to: 'rs', label: 'ab sirf 2 hain', tone: 'bad', say: '<b>ReplicaSet</b> ginta hai: chahiye 3, hain 2. Ek pod kam hai.' },
        { from: 'rs', to: 'p4', label: 'naya pod banao', tone: 'good', set: { p4: { tone: 'good', sub: 'Running ✓' } }, say: '<b>ReplicaSet</b> turant ek naya pod banata hai: <b>web-pod-4</b>. Dhyaan do: purana web-pod-2 zinda nahi hota — ek <b>naya</b> pod banta hai, naye naam aur naye IP ke saath.' },
        { at: ['dep', 'rs'], say: 'Ginti phir 3 ho gayi, bina tumhare uthe. Yahi <b>self-healing</b> hai. <b>Deployment</b> ka apna kaam alag hai: image badalne par naya ReplicaSet banana (rolling update) aur zaroorat par purane par lautna (rollback).' },
      ],
    },
    html: `
      <div class="dg-col">
        <div class="dg-node is-accent pulse"><span class="ni">🚀</span><span class="nl">Deployment: web</span><span class="ns">replicas: 3, image: v2</span></div>
        <div class="dg-down flow"></div>
        <div class="dg-node is-gold"><span class="ni">👯</span><span class="nl">ReplicaSet</span><span class="ns">ginti ka thekedaar: hamesha 3</span></div>
        <div class="dg-down flow"></div>
        <div class="dg-flow">
          <div class="dg-node is-good"><span class="ni">📦</span><span class="nl">pod-1</span><span class="ns">Running</span></div>
          <div class="dg-node is-bad"><span class="ni">💀</span><span class="nl">pod-2</span><span class="ns">node crash!</span></div>
          <div class="dg-node is-good pulse"><span class="ni">✨</span><span class="nl">pod-2-new</span><span class="ns">auto-created</span></div>
        </div>
      </div>
      <div class="dg-cap">Pod mara? ReplicaSet <b>turant</b> naya bana deta hai — bina tumhare uthe. Deployment upar se <b>rolling updates & rollback</b> sambhalta hai.</div>`,
  },

  service: {
    t: 'Service — pods ka ek stable phone number',
    scene: {
      intro: '<b>Sawal:</b> pods ka IP badalta rehta hai — toh frontend hamesha sahi pod tak kaise pahunchta hai?',
      aria: 'Service label selector se pods tak traffic kaise pahunchata hai, 6 kadam',
      nodes: [
        { id: 'client', col: 0, row: 1, icon: '🧑‍💻', label: 'frontend pod', sub: 'client', about: 'Cluster ke andar ka koi bhi pod jo web app ko call karna chahta hai.' },
        { id: 'dns', col: 1, row: 0, icon: '📖', label: 'CoreDNS', sub: 'naam → IP', about: 'Cluster ka DNS server. Service ka naam (web-svc) dekar Service ka ClusterIP milta hai.' },
        { id: 'svc', col: 1, row: 1, icon: '📞', label: 'Service: web-svc', sub: 'selector: app=web', tone: 'accent', about: 'Ek stable naam + ek stable IP (ClusterIP). Service khud koi process nahi hai — Service ek niyam hai: "app=web label wale pods ko traffic do".' },
        { id: 'w1', col: 2, row: 0, icon: '📦', label: 'pod 10.244.1.7', sub: 'label: app=web', tone: 'good' },
        { id: 'w2', col: 2, row: 1, icon: '📦', label: 'pod 10.244.2.9', sub: 'label: app=web', tone: 'good' },
        { id: 'db', col: 2, row: 2, icon: '📦', label: 'pod 10.244.3.4', sub: 'label: app=db', tone: 'muted' },
      ],
      steps: [
        { from: 'client', to: 'dns', label: 'web-svc kahan hai?', say: '<b>frontend pod</b> ko sirf naam pata hai: <code>http://web-svc</code>. frontend pod <b>CoreDNS</b> se poochhta hai ki web-svc ka IP kya hai.' },
        { from: 'dns', to: 'client', label: '10.96.0.20', bend: 24, say: '<b>CoreDNS</b> Service ka <b>ClusterIP</b> lautata hai: <code>10.96.0.20</code>. ClusterIP kabhi nahi badalta, chahe pods kitni baar marein aur banein.' },
        { from: 'client', to: 'svc', label: 'request', say: '<b>frontend pod</b> request ko ClusterIP <code>10.96.0.20</code> par bhejta hai — yaani <b>Service: web-svc</b> par.' },
        { at: ['svc', 'w1', 'w2', 'db'], say: '<b>Service: web-svc</b> ka selector hai <code>app=web</code>. Do pods par label <code>app=web</code> hai — dono Service ke peeche jud jaate hain (Endpoints). Teesre pod par label <code>app=db</code> hai — teesra pod nahi judta.' },
        { from: 'svc', to: 'w1', label: 'is baar pod 1', tone: 'good', say: 'node par <b>kube-proxy</b> ke niyam request ko judey hue pods mein se ek par bhej dete hain. Is baar request <code>10.244.1.7</code> par gayi.' },
        { from: 'svc', to: 'w2', label: 'agli baar pod 2', tone: 'good', say: 'Agli request doosre pod <code>10.244.2.9</code> par ja sakti hai — load bant jaata hai. Koi pod mar kar naye IP ke saath bane, toh Service ki list apne aap badal jaati hai. frontend pod ko kuch badalna nahi padta.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node"><span class="ni">🧑‍💻</span><span class="nl">Client</span><span class="ns">frontend pod</span></div>
        <div class="dg-link"><span class="dg-pill acc">http://web-svc</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-accent pulse"><span class="ni">📞</span><span class="nl">Service: web-svc</span><span class="ns">selector: app=web</span></div>
        <div class="dg-col">
          <div class="dg-flow"><div class="dg-arrow good" style="flex-basis:30px"></div><div class="dg-node is-good"><span class="ni">📦</span><span class="nl">pod</span><span class="ns">app=web ✓</span></div></div>
          <div class="dg-flow"><div class="dg-arrow good" style="flex-basis:30px"></div><div class="dg-node is-good"><span class="ni">📦</span><span class="nl">pod</span><span class="ns">app=web ✓</span></div></div>
          <div class="dg-flow"><div class="dg-arrow muted" style="flex-basis:30px"></div><div class="dg-node is-muted"><span class="ni">📦</span><span class="nl">pod</span><span class="ns">app=db ✗ (label match nahi)</span></div></div>
        </div>
      </div>
      <div class="dg-cap">Pods marte-bante rehte hain, IP badalti rehti hai — <b>Service</b> ek stable naam+IP deta hai aur <b>label selector</b> se matching pods par traffic baantta hai.</div>`,
  },

  config: {
    t: 'Config alag, code alag',
    scene: {
      intro: '<b>Sawal:</b> Image <code>shop:1.4</code> staging aur production dono mein wahi hai. Toh pod ko DB ka address aur password kahan se milta hai?',
      aria: 'ConfigMap aur Secret pod tak env var aur volume ke raaste se; config badalne par kya hota hai, 9 kadam',
      nodes: [
        { id: 'cm', col: 0, row: 0, icon: '🗒️', label: 'ConfigMap: app-cfg', sub: 'DB_HOST=postgres', tone: 'accent', about: 'Saadi (gair-gupt) config: address, feature flags, config files.' },
        { id: 'kubelet', col: 1, row: 0, icon: '🧑‍🔧', label: 'kubelet', sub: 'pod shuru karta hai', about: 'Pod shuru karte samay kubelet hi ConfigMap aur Secret ki keemat pod ke andar pahunchata hai.' },
        { id: 'pod', col: 2, row: 0, icon: '📦', label: 'pod: web', sub: 'image: shop:1.4', tone: 'muted', about: 'Image ke andar koi address ya password nahi likha. Wahi image har environment mein chalti hai.' },
        { id: 'sec', col: 0, row: 1, icon: '🔑', label: 'Secret: app-secret', sub: 'DB_PASS (base64)', tone: 'gold', about: 'Gupt keemat: password, token, key. Secret ki keemat base64 mein hoti hai — base64 sirf encoding hai, encryption nahi.' },
        { id: 'vol', col: 2, row: 1, icon: '📂', label: 'volume: /etc/app', sub: 'config ki files', about: 'ConfigMap ya Secret ko folder ki tarah mount karne ka tareeka. Har key ek file ban jaati hai.' },
      ],
      steps: [
        { at: ['pod'], say: 'Image <b>shop:1.4</b> ke andar DB ka address ya password nahi likha. Config image ke <b>bahar</b> rakhi jaati hai, taaki wahi image staging aur production dono mein chal sake.' },
        { from: 'cm', to: 'kubelet', label: 'DB_HOST=postgres', say: 'Pod shuru hone se pehle <b>kubelet</b> <b>ConfigMap: app-cfg</b> padhta hai.' },
        { from: 'sec', to: 'kubelet', label: 'DB_PASS', tone: 'gold', say: '<b>kubelet</b> <b>Secret: app-secret</b> bhi padhta hai. Secret ki keemat sirf base64 mein hai. base64 encryption nahi hai — koi bhi 2 second mein khol sakta hai.' },
        { from: 'kubelet', to: 'pod', label: 'env vars', tone: 'good', set: { pod: { tone: 'good', sub: 'env: DB_HOST, DB_PASS' } }, say: 'Pehla tareeka: <b>kubelet</b> dono keemat <b>pod: web</b> ko environment variables ki tarah deta hai. Env vars sirf pod ke <b>shuru hote samay</b> set hote hain.' },
        { from: 'kubelet', to: 'vol', label: 'files ki tarah', say: 'Doosra tareeka: <b>kubelet</b> ConfigMap ko <b>volume: /etc/app</b> mein files ki tarah rakhta hai. pod: web un files ko padhta hai.' },
        { at: ['cm'], set: { cm: { tone: 'gold', sub: 'DB_HOST=postgres-v2' } }, say: 'Ab koi <b>ConfigMap: app-cfg</b> badal deta hai: DB_HOST=postgres-v2. Chalte hue pod ka kya hoga?' },
        { from: 'kubelet', to: 'vol', label: 'file update (~1 min)', tone: 'good', say: '<b>kubelet</b> <b>volume: /etc/app</b> ki file ko lagbhag ek minute mein naya kar deta hai. Jaal: <code>subPath</code> se mount ki gayi file <b>kabhi</b> update nahi hoti.' },
        { at: ['pod'], set: { pod: { tone: 'gold', sub: 'env: purana DB_HOST' } }, say: 'Par <b>pod: web</b> ke env vars <b>purane</b> hi rehte hain. Nayi keemat ke liye pod ko dobara banana padta hai: <code>kubectl rollout restart deploy/web</code>.' },
        { at: ['cm', 'sec', 'pod'], say: 'Yaad rakho: image ek, config alag. <b>Env var</b> = badlaav ke liye restart chahiye. <b>Volume ki file</b> = khud update hoti hai (subPath ko chhod kar). <b>Secret</b> = base64, encryption nahi.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-col">
          <div class="dg-node is-accent"><span class="ni">🗒️</span><span class="nl">ConfigMap</span><span class="ns">DB_HOST=postgres</span></div>
          <div class="dg-node is-gold"><span class="ni">🔑</span><span class="nl">Secret</span><span class="ns">DB_PASS=•••• (base64!)</span></div>
        </div>
        <div class="dg-link"><span class="dg-pill acc">env / volume</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-good"><span class="ni">📦</span><span class="nl">Pod</span><span class="ns">same image, har env mein</span></div>
      </div>
      <div class="dg-split" style="margin-top:12px">
        <div class="dg-box is-accent"><span class="bx-label">namespace: staging</span><span class="dg-pill acc">web · db · cache</span></div>
        <div class="dg-box is-gold"><span class="bx-label">namespace: production</span><span class="dg-pill gold">web · db · cache</span></div>
      </div>
      <div class="dg-cap">Image <b>ek</b>, config <b>alag-alag</b> — ConfigMap/Secret inject hote hain. Namespaces = ek cluster ke andar <b>alag-alag mohalle</b>. Yaad rakho: Secret sirf <b>base64</b> hai, encryption nahi!</div>`,
  },

  boss1: {
    t: 'Boss fight — deploy ka poora safar',
    html: `
      <div class="dg-ladder">
        <div class="dg-rung"><span class="lv">1</span><span class="cmd">kubectl apply -f deployment.yaml</span><span class="q">app ko cluster mein bhejo</span></div>
        <div class="dg-rung"><span class="lv">2</span><span class="cmd">kubectl get pods</span><span class="q">Running hain? restarts 0?</span></div>
        <div class="dg-rung"><span class="lv">3</span><span class="cmd">kubectl logs / describe</span><span class="q">kuch galat? yahin dikhega</span></div>
        <div class="dg-rung g"><span class="lv">4</span><span class="cmd">kubectl apply -f service.yaml</span><span class="q">stable naam + load balancing</span></div>
        <div class="dg-rung g"><span class="lv">5</span><span class="cmd">kubectl get endpoints</span><span class="q">service ↔ pods juda? verify!</span></div>
        <div class="dg-rung a"><span class="lv">🏆</span><span class="cmd">app LIVE 🎉</span><span class="q">Pod Pandit certificate</span></div>
      </div>
      <div class="dg-cap">Yehi flow har real deployment ka hai: <b>apply → verify pods → debug → service → verify endpoints</b>. Boss level mein tum yeh sab khud karoge.</div>`,
  },

  /* ================= TRACK 2 — INTERMEDIATE ================= */

  scheduler: {
    t: 'Requests, Limits & QoS — eviction ki line',
    scene: {
      intro: '<b>Sawal:</b> Scheduler node kaise chunta hai — aur node bhar jaaye toh pehle kaun sa pod nikalta hai?',
      aria: 'Request se scheduling, limit ka asar, aur QoS ke hisaab se eviction ka kram, 8 kadam',
      nodes: [
        { id: 'pod', col: 0, row: 0, icon: '📦', label: 'pod: api', sub: 'request 500m / 512Mi', about: 'Naya pod. Request = pod ka waada: "mujhe kam se kam itna chahiye". Limit = hadd: "limit se zyada nahi".' },
        { id: 'sched', col: 1, row: 0, icon: '🧮', label: 'Scheduler', sub: 'requests dekhta hai', tone: 'accent', about: 'Scheduler har naye pod ke liye ek node chunta hai. Scheduler sirf requests ka jod dekhta hai, asli usage nahi.' },
        { id: 'na', col: 2, row: 0, icon: '🖥️', label: 'node-a', sub: '300m CPU khaali', tone: 'muted' },
        { id: 'nb', col: 1, row: 1, icon: '🖥️', label: 'node-b', sub: '2 CPU khaali', tone: 'good' },
        { id: 'be', col: 0, row: 2, icon: '🥉', label: 'BestEffort', sub: 'kuch set nahi', tone: 'muted', about: 'Pod mein na request likhi, na limit. Node par dabav aaye toh sabse pehle nikalta hai.' },
        { id: 'bu', col: 1, row: 2, icon: '🥈', label: 'Burstable', sub: 'request limit se kam', tone: 'muted', about: 'Request likhi hai, par limit se kam (ya limit hai hi nahi). Zyadatar apps isi class mein hote hain.' },
        { id: 'gu', col: 2, row: 2, icon: '🥇', label: 'Guaranteed', sub: 'request = limit', tone: 'muted', about: 'Har container mein CPU aur memory dono ki request aur limit barabar. Sabse aakhir mein nikalta hai.' },
      ],
      steps: [
        { from: 'pod', to: 'sched', label: 'request: 500m, 512Mi', say: 'Naya pod <b>pod: api</b> bana. Pod kehta hai: mujhe kam se kam 500m CPU aur 512Mi memory chahiye. Is waade ka naam <b>request</b> hai.' },
        { from: 'sched', to: 'na', label: '300m khaali — kam hai', tone: 'bad', say: '<b>Scheduler</b> node-a ko dekhta hai. node-a par sirf 300m CPU khaali hai. 500m ki request fit nahi hoti. node-a list se bahar.' },
        { from: 'sched', to: 'nb', label: 'fit → yahan bhejo', tone: 'good', set: { nb: { sub: '1.5 CPU khaali' } }, say: 'node-b par 2 CPU khaali hai. Request fit hoti hai. <b>Scheduler</b> pod: api ko node-b par bhejta hai. Dhyan do: Scheduler <b>asli usage nahi</b>, sirf <b>requests ka jod</b> dekhta hai.' },
        { at: ['nb'], say: 'Ab <b>limit</b>. CPU limit paar → kernel container ko <b>dheema</b> kar deta hai (throttle). Memory limit paar → kernel container ko <b>maar deta hai</b> (OOMKilled, exit code 137).' },
        { at: ['nb'], set: { nb: { tone: 'bad', sub: 'memory full!' } }, say: 'Maan lo node-b ki memory hi bhar gayi. node-b ka <b>kubelet</b> kuch pods ko nikalta hai (evict). Pehle kaun nikalega? Pod ki <b>QoS class</b> tay karti hai.' },
        { at: ['be'], set: { be: { tone: 'bad' } }, say: 'Sabse pehle <b>BestEffort</b> pods nikalte hain — jin pods mein koi request ya limit nahi likhi.' },
        { at: ['bu'], set: { bu: { tone: 'gold' } }, say: 'Phir <b>Burstable</b> pods. Burstable pod tab nikalta hai jab Burstable pod apni request se zyada memory le raha ho. pod: api isi class mein hai.' },
        { at: ['gu'], set: { gu: { tone: 'good' } }, say: 'Sabse aakhir mein <b>Guaranteed</b> pods — jinki request aur limit barabar hain. Zaroori app (jaise database) ko Guaranteed banao.' },
      ],
    },
    html: `
      <div class="dg-split">
        <div class="dg-node is-good"><span class="ni">🥇</span><span class="nl">Guaranteed</span><span class="ns">requests == limits</span><span class="dg-pill good">sabse aakhri mein evict</span></div>
        <div class="dg-node is-gold"><span class="ni">🥈</span><span class="nl">Burstable</span><span class="ns">requests &lt; limits</span><span class="dg-pill gold">beech mein</span></div>
        <div class="dg-node is-bad"><span class="ni">🥉</span><span class="nl">BestEffort</span><span class="ns">kuch bhi set nahi</span><span class="dg-pill bad">sabse pehle evict 💀</span></div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <div class="dg-node is-bad pulse"><span class="ni">😰</span><span class="nl">Node memory full</span><span class="ns">kubelet: "koi toh niklo!"</span></div>
        <div class="dg-arrow bad flow"></div>
        <span class="dg-pill bad">BestEffort → Burstable → Guaranteed</span>
      </div>
      <div class="dg-cap"><b>Requests</b> = scheduling ka waada (Scheduler isi se node chunta hai) · <b>Limits</b> = hadd (paar ki toh CPU throttle / memory <b>OOMKill</b>). QoS class in dono se banti hai — aur eviction ki queue tay karti hai.</div>`,
  },

  probes: {
    t: 'Teen probes, teen sawal',
    scene: {
      intro: '<b>Sawal:</b> Kubernetes ko kaise pata chalta hai ki pod ko traffic dena hai, rokna hai, ya restart karna hai?',
      aria: 'Startup, readiness aur liveness probe ka kram aur har probe ke fail hone ka asar, 8 kadam',
      nodes: [
        { id: 'kubelet', col: 0, row: 0, icon: '👷', label: 'kubelet', sub: 'node ka agent', about: 'kubelet har node par chalta hai. Teeno probes kubelet hi chalata hai — Service ya API Server nahi.' },
        { id: 'pod', col: 1, row: 0, icon: '📦', label: 'pod: web', sub: 'boot ho raha hai', tone: 'muted', about: 'Ek pod jiska app boot hone mein 40 second leta hai.' },
        { id: 'user', col: 0, row: 1, icon: '🧑', label: 'User', sub: 'request bhejta hai' },
        { id: 'svc', col: 1, row: 1, icon: '📞', label: 'Service: web-svc', sub: 'sirf Ready pods', tone: 'accent', about: 'Service sirf un pods ko traffic deti hai jo Ready hain (jinka readiness probe paas hai).' },
      ],
      steps: [
        { at: ['pod'], say: 'Pod <b>pod: web</b> abhi start hua. App ko boot hone mein 40 second lagte hain. Is beech Kubernetes ko teen sawal poochhne hain.' },
        { from: 'kubelet', to: 'pod', label: 'startup: boot hua?', tone: 'gold', set: { pod: { sub: 'startup probe chal raha' } }, say: '<b>kubelet</b> pehle sirf <b>startup probe</b> chalata hai. Jab tak startup probe paas nahi hota, readiness aur liveness probe ruke rehte hain. Dheeme app ko boot ka samay mil jaata hai.' },
        { from: 'kubelet', to: 'pod', label: 'readiness: traffic doon?', set: { pod: { tone: 'good', sub: 'READY 1/1' } }, say: 'Startup probe paas. Ab <b>kubelet</b> <b>readiness probe</b> chalata hai. Readiness paas → pod ka IP Service ki list (Endpoints) mein jud jaata hai.' },
        { from: 'user', to: 'svc', label: 'request', say: 'User ki request <b>Service: web-svc</b> par aati hai.' },
        { from: 'svc', to: 'pod', label: 'sirf Ready pod ko', tone: 'good', say: '<b>Service: web-svc</b> request sirf un pods ko deti hai jo Ready hain. pod: web Ready hai, toh request pod: web tak pahunchti hai.' },
        { from: 'kubelet', to: 'pod', label: 'readiness FAIL', tone: 'bad', set: { pod: { tone: 'gold', sub: 'READY 0/1' } }, say: 'Maan lo database 30 second ke liye dheema hua aur readiness probe fail ho gaya. <b>kubelet</b> pod ko <b>restart nahi karta</b>. Pod sirf Service ki list se bahar ho jaata hai. Database theek hote hi pod wapas list mein aa jaata hai.' },
        { from: 'kubelet', to: 'pod', label: 'liveness FAIL → restart', tone: 'bad', set: { pod: { tone: 'bad', sub: 'container restart' } }, say: 'Ab maan lo app deadlock mein atak gaya — process zinda hai par jawab nahi deta. <b>liveness probe</b> fail hota hai. <b>kubelet</b> container ko <b>restart</b> kar deta hai.' },
        { at: ['kubelet', 'pod', 'svc'], say: 'Yaad rakho: <b>startup</b> = boot ka intezaar. <b>readiness</b> = traffic ka gate (fail → list se bahar). <b>liveness</b> = restart ka button (fail → container restart). Liveness probe mein database check mat daalo — database dheema hote hi saare pods restart hone lagenge.' },
      ],
    },
    html: `
      <div class="dg-split">
        <div class="dg-node is-gold"><span class="ni">🐣</span><span class="nl">Startup</span><span class="ns">"boot ho gaya?"</span><span class="dg-pill gold">jab tak fail — baaki probes ruke</span></div>
        <div class="dg-node is-accent"><span class="ni">🚦</span><span class="nl">Readiness</span><span class="ns">"traffic doon?"</span><span class="dg-pill acc">fail → endpoints se BAHAR</span></div>
        <div class="dg-node is-bad"><span class="ni">💓</span><span class="nl">Liveness</span><span class="ns">"zinda ho?"</span><span class="dg-pill bad">fail → container RESTART</span></div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <div class="dg-node"><span class="ni">📞</span><span class="nl">Service</span></div>
        <div class="dg-link"><span class="dg-pill good">READY 1/1 ✓</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node is-good"><span class="ni">📦</span><span class="nl">pod-a</span></div>
        <div class="dg-link"><span class="dg-pill bad">READY 0/1 ✗</span><div class="dg-arrow bad"></div></div>
        <div class="dg-node is-muted"><span class="ni">📦</span><span class="nl">pod-b (booting)</span></div>
      </div>
      <div class="dg-cap">Yaad rakhne ka formula: <b>Startup</b> = intezaar · <b>Readiness</b> = traffic ka gate · <b>Liveness</b> = restart ka trigger. Galat probe = khud banaya outage!</div>`,
  },

  workloads: {
    t: 'Deployment vs StatefulSet vs DaemonSet',
    html: `
      <div class="dg-split">
        <div class="dg-box is-accent"><span class="bx-label">🚀 Deployment</span>
          <div class="dg-flow"><div class="dg-node"><span class="ni">📦</span><span class="ns">web-x8k2</span></div><div class="dg-node"><span class="ni">📦</span><span class="ns">web-p9q1</span></div></div>
          <div class="dg-cap">clone sena — naam random, sab barabar, koi bhi mare koi gham nahi</div>
        </div>
        <div class="dg-box is-gold"><span class="bx-label">🗿 StatefulSet</span>
          <div class="dg-flow"><div class="dg-node is-gold"><span class="ni">🗄️</span><span class="ns">db-0 + PVC-0</span></div><div class="dg-node is-gold"><span class="ni">🗄️</span><span class="ns">db-1 + PVC-1</span></div></div>
          <div class="dg-cap">naam pakka, APNI storage, order se aate hain — databases ke liye</div>
        </div>
        <div class="dg-box is-good"><span class="bx-label">👮 DaemonSet</span>
          <div class="dg-flow"><div class="dg-node is-good"><span class="ni">🪵</span><span class="ns">node-1: agent</span></div><div class="dg-node is-good"><span class="ni">🪵</span><span class="ns">node-2: agent</span></div></div>
          <div class="dg-cap">HAR node par exactly ek — logging/monitoring agents</div>
        </div>
      </div>
      <div class="dg-cap"><b>Kaun kab?</b> Stateless app → Deployment · DB/Kafka (stable naam+storage chahiye) → StatefulSet · har-node-par-ek agent → DaemonSet</div>`,
  },

  storage: {
    t: 'PVC → StorageClass → PV — storage ki chain',
    scene: {
      intro: '<b>Sawal:</b> pod mar jaata hai toh data kahan rehta hai — aur disk banti kaise hai?',
      aria: 'Pod se PVC, StorageClass, CSI driver aur PV tak ki chain, 7 kadam',
      nodes: [
        { id: 'pod', col: 0, row: 0, icon: '📦', label: 'Pod: db-0', sub: 'disk chahiye', about: 'Database ka pod. Pod khud disk nahi banata; pod sirf ek PVC ka naam leta hai.' },
        { id: 'pvc', col: 1, row: 0, icon: '🎫', label: 'PVC: data-db-0', sub: '10Gi, fast-ssd', tone: 'accent', about: 'PersistentVolumeClaim = disk ki maang ki parchi. Developer likhta hai: kitni badi, kaunsi class.' },
        { id: 'sc', col: 2, row: 0, icon: '🏭', label: 'StorageClass', sub: 'fast-ssd (recipe)', about: 'Disk banane ki recipe: kaunsa driver, kaunsa disk type. Platform team banati hai.' },
        { id: 'csi', col: 2, row: 1, icon: '🔧', label: 'CSI driver', sub: 'cloud se baat', about: 'Driver jo cloud (AWS EBS, GCP PD) ko bolta hai: disk banao, node se jodo.' },
        { id: 'pv', col: 1, row: 1, icon: '💾', label: 'PV', sub: 'asli disk (EBS)', tone: 'muted', about: 'PersistentVolume = asli disk ka Kubernetes record. Dynamic provisioning mein PV apne aap banta hai.' },
      ],
      steps: [
        { from: 'pod', to: 'pvc', label: 'claim', say: '<b>Pod: db-0</b> ke YAML mein likha hai: mujhe <b>PVC: data-db-0</b> wali disk chahiye. PVC ek <b>parchi</b> hai: 10Gi, fast-ssd wali.' },
        { from: 'pvc', to: 'sc', label: 'kaunsi recipe?', say: 'PVC mein <code>storageClassName: fast-ssd</code> likha hai. <b>StorageClass</b> disk banane ki <b>recipe</b> hai: kaunsa disk type, kaunsa driver.' },
        { from: 'sc', to: 'csi', label: 'disk banao', say: 'StorageClass ka <b>CSI driver</b> cloud ko bolta hai: 10Gi ki ek SSD disk banao.' },
        { from: 'csi', to: 'pv', label: 'PV ban gaya', tone: 'good', set: { pv: { tone: 'good' } }, say: 'Cloud ne asli disk bana di. Kubernetes mein us disk ka record <b>PV</b> (PersistentVolume) ke naam se banta hai.' },
        { from: 'pv', to: 'pvc', label: 'Bound', tone: 'good', set: { pvc: { tone: 'good', sub: 'STATUS: Bound' } }, say: '<b>PV</b> aur <b>PVC</b> jud jaate hain. PVC ka status <code>Bound</code> ho jaata hai. Ek PV sirf ek PVC se judta hai.' },
        { from: 'pvc', to: 'pod', label: 'mount', tone: 'good', set: { pod: { tone: 'good', sub: 'disk /data par' } }, say: 'Disk node se judti hai aur <b>Pod: db-0</b> ke andar <code>/data</code> par mount hoti hai.' },
        { at: ['pod', 'pv'], set: { pod: { tone: 'bad', sub: 'pod mar gaya' } }, say: 'Pod: db-0 mar gaya? <b>PV</b> aur data wahin rehte hain. Naya Pod: db-0 usi PVC ko maangta hai aur wahi disk wapas milti hai. Data pod ke saath nahi marta.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">Pod</span><span class="ns">"mujhe disk chahiye"</span></div>
        <div class="dg-link"><span class="dg-pill acc">claim</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-gold pulse"><span class="ni">🎫</span><span class="nl">PVC</span><span class="ns">"10Gi, fast wali"</span></div>
        <div class="dg-link"><span class="dg-pill gold">provision</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node"><span class="ni">🏭</span><span class="nl">StorageClass</span><span class="ns">"fast-ssd" (recipe)</span></div>
        <div class="dg-link"><span class="dg-pill good">create</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node is-good"><span class="ni">💾</span><span class="nl">PV</span><span class="ns">asli disk (EBS/...)</span></div>
      </div>
      <div class="dg-cap"><b>PVC</b> = demand ki parchi (developer likhta hai) · <b>StorageClass</b> = disk banane ki recipe · <b>PV</b> = asli disk. Dynamic provisioning = parchi do, disk apne aap ban jaati hai.</div>`,
  },

  affinity: {
    t: 'Affinity kheenchti hai, Taint bhagata hai',
    html: `
      <div class="dg-split">
        <div class="dg-box is-accent"><span class="bx-label">🧲 Affinity — "wahan chalo"</span>
          <div class="dg-flow">
            <div class="dg-node"><span class="ni">📦</span><span class="nl">frontend</span><span class="ns">"disk=ssd wale node par"</span></div>
            <div class="dg-arrow good flow"></div>
            <div class="dg-node is-good"><span class="ni">🖥️</span><span class="nl">node-ssd</span><span class="ns">label: disk=ssd</span></div>
          </div>
        </div>
        <div class="dg-box is-bad"><span class="bx-label">🚫 Taint — "door raho"</span>
          <div class="dg-flow">
            <div class="dg-node"><span class="ni">📦</span><span class="nl">aam pod</span></div>
            <div class="dg-arrow bad"></div>
            <div class="dg-node is-bad"><span class="ni">🎮</span><span class="nl">node-gpu</span><span class="ns">taint: gpu=true:NoSchedule</span></div>
          </div>
          <div class="dg-flow" style="margin-top:6px"><span class="dg-pill good">sirf toleration wale pods andar 🎟️</span></div>
        </div>
      </div>
      <div class="dg-cap"><b>Affinity</b> pod ki pasand hai (pod bolta hai kahan jaana hai) · <b>Taint</b> node ka pehra hai (node bolta hai kaun aa sakta hai) · <b>Anti-affinity</b> = replicas ko alag-alag nodes par phailao (HA!).</div>`,
  },

  ingress: {
    t: 'Ek darwaza, saari services',
    scene: {
      intro: '<b>Sawal:</b> 3 services hain — kya 3 Load Balancer kharidne padenge?',
      aria: 'User se Load Balancer, Ingress Controller aur host/path ke niyam se sahi Service tak, 8 kadam',
      nodes: [
        { id: 'user', col: 0, row: 1, icon: '🌍', label: 'User', sub: 'internet se' },
        { id: 'lb', col: 1, row: 1, icon: '⚖️', label: 'Load Balancer', sub: 'ek hi (cloud ka)', about: 'Cloud ka Load Balancer. Poore cluster ke liye ek — har service ka alag nahi (paisa bachta hai).' },
        { id: 'ic', col: 2, row: 1, icon: '🚪', label: 'Ingress Controller', sub: 'nginx pod + TLS', tone: 'accent', about: 'Ek asli chalta hua pod (nginx, traefik). Ingress ke niyam padhkar request ko sahi Service par bhejta hai.' },
        { id: 'rules', col: 3, row: 0, icon: '📋', label: 'Ingress', sub: 'niyam: host + path', about: 'Ingress ek YAML object hai — sirf niyamon ki list. Ingress khud koi process nahi hai.' },
        { id: 'api', col: 2, row: 0, icon: '📞', label: 'api-svc', sub: 'path /api' },
        { id: 'web', col: 3, row: 1, icon: '📞', label: 'web-svc', sub: 'path /' },
        { id: 'admin', col: 2, row: 2, icon: '📞', label: 'admin-svc', sub: 'admin.shop.com' },
      ],
      steps: [
        { from: 'user', to: 'lb', label: 'https://shop.com/api', say: 'User <code>https://shop.com/api</code> kholta hai. Request cloud ke <b>Load Balancer</b> par aati hai. Poore cluster ke liye ek hi Load Balancer hai — har service ka alag nahi.' },
        { from: 'lb', to: 'ic', label: 'aage bhejo', say: '<b>Load Balancer</b> request ko <b>Ingress Controller</b> ke pod ko deta hai. Ingress Controller ek asli chalta hua pod hai (nginx ya traefik).' },
        { at: ['ic'], say: '<b>Ingress Controller</b> HTTPS ko yahin kholta hai (TLS termination). Certificate ek jagah, saari services ke liye.' },
        { from: 'ic', to: 'rules', label: 'niyam padho', say: '<b>Ingress Controller</b> <b>Ingress</b> object ke niyam padhta hai. Ingress khud koi process nahi — Ingress sirf niyamon ki list hai: kaunsa host aur path kis Service par jaaye.' },
        { from: 'ic', to: 'api', label: '/api → api-svc', tone: 'good', say: 'Path <code>/api</code> hai. Niyam kehta hai: <code>/api</code> → <b>api-svc</b>. Request api-svc par jaati hai.' },
        { from: 'ic', to: 'web', label: '/ → web-svc', tone: 'good', say: 'Koi doosra user <code>shop.com/</code> kholta hai. Niyam: <code>/</code> → <b>web-svc</b>.' },
        { from: 'ic', to: 'admin', label: 'host: admin.shop.com', tone: 'good', say: 'Teesra user <code>admin.shop.com</code> kholta hai. Host alag hai. Niyam: host <code>admin.shop.com</code> → <b>admin-svc</b>.' },
        { at: ['rules', 'ic'], say: 'Do naam alag rakho: <b>Ingress</b> = niyam (YAML). <b>Ingress Controller</b> = niyam chalane wala pod. Controller install nahi kiya toh Ingress YAML kuch nahi karta. Naya standard <b>Gateway API</b> hai — soch wahi, zimmedaari alag-alag teams mein banti hai.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node"><span class="ni">🌍</span><span class="nl">Internet</span><span class="ns">shop.com</span></div>
        <div class="dg-link"><span class="dg-pill acc">ek hi LB 💰</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-accent pulse"><span class="ni">🚪</span><span class="nl">Ingress Controller</span><span class="ns">nginx/traefik pod + TLS yahin</span></div>
        <div class="dg-col">
          <div class="dg-flow"><span class="dg-pill">/api →</span><div class="dg-arrow good" style="flex-basis:26px"></div><div class="dg-node is-good"><span class="ni">📞</span><span class="nl">api-svc</span></div></div>
          <div class="dg-flow"><span class="dg-pill">/ →</span><div class="dg-arrow good" style="flex-basis:26px"></div><div class="dg-node is-good"><span class="ni">📞</span><span class="nl">web-svc</span></div></div>
          <div class="dg-flow"><span class="dg-pill">admin.shop.com →</span><div class="dg-arrow gold" style="flex-basis:26px"></div><div class="dg-node is-gold"><span class="ni">📞</span><span class="nl">admin-svc</span></div></div>
        </div>
      </div>
      <div class="dg-cap">Har service ka apna LoadBalancer = ₹₹₹. <b>Ingress</b> = ek LB ke peeche host/path-based routing + <b>SSL termination</b>. Naya standard ban raha hai: <b>Gateway API</b> (roles alag: infra vs routes).</div>`,
  },

  netpol: {
    t: 'Default: sab khula. Policy: zero-trust',
    scene: {
      intro: '<b>Sawal:</b> ek pod hack ho jaaye toh kya hacked pod seedha database tak pahunch sakta hai?',
      aria: 'Bina policy ke sab khula, phir default-deny, phir ek allow policy, 7 kadam',
      nodes: [
        { id: 'fe', col: 0, row: 0, icon: '🎨', label: 'frontend', sub: 'app=frontend' },
        { id: 'be', col: 1, row: 0, icon: '⚙️', label: 'backend', sub: 'app=backend' },
        { id: 'db', col: 2, row: 0, icon: '🗄️', label: 'database', sub: 'app=db, port 5432', tone: 'accent' },
        { id: 'bad', col: 1, row: 1, icon: '🦹', label: 'hacked pod', sub: 'attacker andar', tone: 'bad', about: 'Koi bhi pod jisme attacker ghus gaya. Usi namespace mein hai, par label app=backend nahi hai.' },
        { id: 'pol', col: 2, row: 1, icon: '🧱', label: 'NetworkPolicy', sub: 'abhi koi nahi', tone: 'muted', about: 'Pods ke beech ka firewall. Policy label se pods chunti hai. CNI (Calico, Cilium) policy ko lagu karta hai.' },
      ],
      steps: [
        { from: 'fe', to: 'be', label: 'theek', tone: 'good', say: 'Shuru mein koi NetworkPolicy nahi hai. <b>frontend</b> → <b>backend</b> call chalti hai. Yahan tak sab theek.' },
        { from: 'bad', to: 'db', label: 'seedha DB tak', tone: 'bad', say: 'Par bina policy ke <b>har pod har pod se</b> baat kar sakta hai. <b>hacked pod</b> seedha <b>database</b> tak pahunch jaata hai.' },
        { at: ['pol', 'db'], set: { pol: { tone: 'accent', sub: 'default-deny' } }, say: 'Pehla kadam: <b>default-deny</b> policy. Namespace ke saare pods ka aane wala traffic band. Ab koi kisi se baat nahi kar sakta — backend bhi database se nahi.' },
        { from: 'be', to: 'db', label: 'allow: 5432', tone: 'good', set: { pol: { sub: 'deny + allow' } }, say: 'Doosra kadam: ek <b>allow</b> policy. Sirf <code>app=backend</code> label wale pods, <b>database</b> ke port 5432 par aa sakte hain. (frontend → backend ke liye bhi aisi hi ek allow policy chahiye.)' },
        { from: 'bad', to: 'db', label: 'DENIED', tone: 'bad', say: '<b>hacked pod</b> phir koshish karta hai. hacked pod par label <code>app=backend</code> nahi hai. Request ruk jaati hai (timeout).' },
        { from: 'fe', to: 'db', label: 'DENIED', tone: 'bad', bend: 110, say: '<b>frontend</b> bhi seedha <b>database</b> tak nahi ja sakta. frontend ko backend se hokar jaana padega.' },
        { at: ['pol'], say: 'Teen niyam: (1) policy <b>label</b> se pods chunti hai, IP se nahi. (2) Policies sirf <b>allow</b> karti hain; kai policies ka allow jud jaata hai. (3) CNI policy lagu na kare toh policy chupchaap ignore hoti hai — koi error nahi aata.' },
      ],
    },
    html: `
      <div class="dg-split">
        <div class="dg-box is-bad"><span class="bx-label">😱 Default — no policy</span>
          <div class="dg-flow">
            <div class="dg-node"><span class="ni">🎨</span><span class="nl">frontend</span></div>
            <div class="dg-arrow bad two"></div>
            <div class="dg-node is-bad"><span class="ni">🗄️</span><span class="nl">database</span></div>
          </div>
          <div class="dg-flow" style="margin-top:6px"><span class="dg-pill bad">HAR pod HAR pod se baat kar sakta hai</span></div>
        </div>
        <div class="dg-box is-good"><span class="bx-label">🔒 NetworkPolicy ke saath</span>
          <div class="dg-col">
            <div class="dg-flow"><div class="dg-node"><span class="ni">⚙️</span><span class="nl">backend</span></div><div class="dg-arrow good flow" style="flex-basis:30px"></div><div class="dg-node is-good"><span class="ni">🗄️</span><span class="nl">database</span></div></div>
            <div class="dg-flow"><div class="dg-node"><span class="ni">🎨</span><span class="nl">frontend</span></div><div class="dg-arrow bad" style="flex-basis:30px"></div><span class="dg-pill bad">✗ DENIED</span></div>
          </div>
        </div>
      </div>
      <div class="dg-cap">NetworkPolicy = pods ke beech ka <b>internal firewall</b>. Pattern: pehle <b>default-deny</b>, phir sirf zaroori raaste kholo ("sirf backend → db:5432"). Yehi zero-trust hai.</div>`,
  },

  autoscale: {
    t: 'HPA pods badhata hai, Cluster Autoscaler nodes',
    scene: {
      intro: '<b>Sawal:</b> traffic achanak badhe toh pods kaun badhata hai — aur pods ke liye jagah na ho toh?',
      aria: 'Traffic spike se metrics-server, HPA, Deployment, Pending pod aur naye node tak, 8 kadam',
      nodes: [
        { id: 'users', col: 0, row: 0, icon: '📈', label: 'Traffic', sub: 'achanak badha' },
        { id: 'pods', col: 1, row: 0, icon: '📦', label: 'web pods', sub: '3 pods, CPU 85%', tone: 'bad' },
        { id: 'deploy', col: 2, row: 0, icon: '🚀', label: 'Deployment: web', sub: 'replicas: 3' },
        { id: 'node', col: 3, row: 0, icon: '🖥️', label: 'naya node', sub: 'abhi nahi hai', tone: 'muted' },
        { id: 'ms', col: 1, row: 1, icon: '📏', label: 'metrics-server', sub: 'CPU naapta hai', about: 'Har pod ka CPU aur memory naapta hai. metrics-server na ho toh HPA ko number nahi milta.' },
        { id: 'hpa', col: 2, row: 1, icon: '🤖', label: 'HPA', sub: 'target: CPU 60%', tone: 'accent', about: 'HorizontalPodAutoscaler. Sirf pods ki ginti badalta hai. HPA nodes nahi la sakta.' },
        { id: 'ca', col: 3, row: 1, icon: '🏗️', label: 'Karpenter / CA', sub: 'nodes laata hai', about: 'Karpenter ya Cluster Autoscaler. Pending pods dekhkar cloud se naya node laata hai.' },
      ],
      steps: [
        { from: 'users', to: 'pods', label: 'zyada requests', tone: 'bad', say: 'Traffic achanak badha. <b>web pods</b> ka CPU 85% tak pahunch gaya.' },
        { from: 'pods', to: 'ms', label: 'CPU kitna?', say: '<b>metrics-server</b> har pod ka CPU naapta hai. metrics-server na ho toh HPA andha hai — HPA ke TARGETS mein <code>unknown</code> dikhta hai.' },
        { from: 'ms', to: 'hpa', label: '85%', say: '<b>HPA</b> metrics-server se number leta hai: average CPU 85%. Yaani pods apni CPU <b>request</b> ka 85% use kar rahe hain. Target 60% hai.' },
        { from: 'hpa', to: 'deploy', label: 'replicas: 3 → 5', tone: 'gold', set: { deploy: { sub: 'replicas: 5' } }, say: '<b>HPA</b> hisaab lagata hai: 3 × 85 ÷ 60 = 4.25 → upar round = 5. HPA <b>Deployment: web</b> ke replicas 3 se 5 kar deta hai.' },
        { from: 'deploy', to: 'pods', label: '2 naye pods', set: { pods: { tone: 'gold', sub: '4 Running, 1 Pending' } }, say: 'Deployment 2 naye pods banata hai. Ek pod ko jagah mil gayi. Doosra pod <b>Pending</b> hai — kisi node par itni CPU request khaali nahi.' },
        { at: ['ca', 'pods'], say: '<b>Karpenter / CA</b> Pending pod ko dekhta hai. HPA nodes nahi la sakta — HPA sirf pods ginta hai.' },
        { from: 'ca', to: 'node', label: 'cloud se naya node', tone: 'good', set: { node: { tone: 'good', sub: 'Ready' } }, say: '<b>Karpenter / CA</b> cloud se ek <b>naya node</b> maangta hai. 1–2 minute mein naya node Ready ho jaata hai.' },
        { at: ['pods', 'node'], set: { pods: { tone: 'good', sub: '5 Running, CPU 51%' } }, say: 'Pending pod naye node par chal jaata hai. Ab 5 pods hain aur average CPU 51% — target ke neeche. Traffic ghatega toh HPA pods ghatayega, aur khaali node hata diya jaayega.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-gold pulse"><span class="ni">📈</span><span class="nl">Traffic spike!</span><span class="ns">CPU 85% &gt; target 60%</span></div>
        <div class="dg-arrow gold flow"></div>
        <div class="dg-node is-accent"><span class="ni">🤖</span><span class="nl">HPA</span><span class="ns">replicas: 3 → 8</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node"><span class="ni">📦×8</span><span class="nl">Pods</span><span class="ns">5 naye... 2 Pending! 😰</span></div>
        <div class="dg-arrow bad flow"></div>
        <div class="dg-node is-good"><span class="ni">🏗️</span><span class="nl">Cluster Autoscaler</span><span class="ns">naya NODE lao (cloud se)</span></div>
      </div>
      <div class="dg-cap"><b>HPA</b> = pods ki ginti (metrics se) · <b>Cluster Autoscaler / Karpenter</b> = jab pods ke liye jagah hi na bache toh naye NODES. Dono ka combo = elastic cluster. (HPA requests par depend karta hai — Level 9 yaad hai?)</div>`,
  },

  boss2: {
    t: 'Production Outage Night — debugging ladder',
    html: `
      <div class="dg-ladder">
        <div class="dg-rung"><span class="lv">1</span><span class="cmd">get pods → status kya bol raha hai?</span><span class="q">Pending? Crash? ImagePull? 0/1?</span></div>
        <div class="dg-rung"><span class="lv">2</span><span class="cmd">Pending → describe (Events)</span><span class="q">resources? taint? affinity?</span></div>
        <div class="dg-rung"><span class="lv">3</span><span class="cmd">Crash/OOM → logs --previous + describe</span><span class="q">exit code 137 = OOMKilled</span></div>
        <div class="dg-rung g"><span class="lv">4</span><span class="cmd">Running par traffic nahi → get endpoints</span><span class="q">READY? selector? probes?</span></div>
        <div class="dg-rung g"><span class="lv">5</span><span class="cmd">DNS/netpol → exec se andar jaakar test</span><span class="q">nslookup svc · wget svc</span></div>
        <div class="dg-rung a"><span class="lv">🏆</span><span class="cmd">Cluster Sadhak 🔥</span><span class="q">boss down!</span></div>
      </div>
      <div class="dg-cap">Yeh ladder ratta maar lo — <b>symptom se seedha sahi tool</b> tak jaana hi production debugging hai.</div>`,
  },

  /* ================= TRACK 3 — ADVANCED ================= */

  rbac: {
    t: 'RBAC — kaun, kya, kahan',
    scene: {
      intro: '<b>Sawal:</b> API Server kaise tay karta hai ki kaun kya kar sakta hai?',
      aria: 'ServiceAccount ki request, RoleBinding aur Role ki jaanch, allowed aur Forbidden, 8 kadam',
      nodes: [
        { id: 'sa', col: 0, row: 0, icon: '🤖', label: 'SA: ci-bot', sub: 'namespace: dev', about: 'ServiceAccount = pod ki identity. Insaan ke liye User/Group hota hai, pod ke liye ServiceAccount.' },
        { id: 'api', col: 1, row: 0, icon: '🚪', label: 'API Server', sub: 'har request yahin', tone: 'accent', about: 'Har kubectl aur har pod ki request API Server se guzarti hai. Yahin ijaazat ki jaanch hoti hai.' },
        { id: 'pods', col: 2, row: 0, icon: '📦', label: 'pods (dev)', sub: 'Role mein likha hai' },
        { id: 'sec', col: 3, row: 0, icon: '🔑', label: 'secrets (dev)', sub: 'Role mein nahi', tone: 'muted' },
        { id: 'rb', col: 1, row: 1, icon: '🔗', label: 'RoleBinding', sub: 'ci-bot ↔ pod-reader', about: 'RoleBinding = jod. Kehta hai: is identity ko Role do. RoleBinding mein khud koi ijaazat nahi likhi hoti.' },
        { id: 'role', col: 2, row: 1, icon: '📜', label: 'Role: pod-reader', sub: 'get, list pods', about: 'Role = ijaazat ki list, ek namespace ke andar. Poore cluster ke liye ClusterRole hota hai.' },
      ],
      steps: [
        { from: 'sa', to: 'api', label: 'get pods -n dev', say: '<b>SA: ci-bot</b> (ek pod ki identity) API Server se poochhta hai: namespace dev ke pods dikhao.' },
        { at: ['api'], say: '<b>API Server</b> pehle pehchaanta hai <b>kaun</b> bol raha hai (authentication). Phir poochhta hai: ci-bot ko <b>ijaazat</b> hai? Ijaazat ki jaanch ka naam RBAC hai.' },
        { from: 'api', to: 'rb', label: 'ci-bot ka binding?', say: '<b>API Server</b> RoleBindings mein dhoondhta hai. Ek <b>RoleBinding</b> mila jo ci-bot ko Role: pod-reader se jodta hai.' },
        { from: 'rb', to: 'role', label: 'kaunsa Role?', say: '<b>RoleBinding</b> sirf jod hai. Asli ijaazat <b>Role: pod-reader</b> mein likhi hai: pods par <code>get</code> aur <code>list</code>.' },
        { from: 'api', to: 'pods', label: 'allowed', tone: 'good', say: 'Request <code>get pods</code> Role ki list mein hai. <b>API Server</b> pods ki list lauta deta hai.' },
        { from: 'sa', to: 'api', label: 'get secrets -n dev', tone: 'bad', say: 'Ab <b>SA: ci-bot</b> secrets maangta hai.' },
        { from: 'api', to: 'sec', label: 'Forbidden (403)', tone: 'bad', bend: 110, say: 'Role: pod-reader mein <code>secrets</code> likha hi nahi. RBAC mein jo likha nahi, <b>mana</b> hai. Jawab: <code>Forbidden</code>.' },
        { at: ['role', 'rb'], say: '<b>Role</b> + <b>RoleBinding</b> = ek namespace ke andar. Poore cluster ke liye <b>ClusterRole</b> + <b>ClusterRoleBinding</b>. Jaanch ka command: <code>kubectl auth can-i get secrets -n dev --as=system:serviceaccount:dev:ci-bot</code>' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">🤖</span><span class="nl">ServiceAccount</span><span class="ns">app ki identity</span></div>
        <div class="dg-link"><span class="dg-pill acc">RoleBinding</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-gold"><span class="ni">📜</span><span class="nl">Role</span><span class="ns">get/list pods (ek NS mein)</span></div>
      </div>
      <div class="dg-split" style="margin-top:12px">
        <div class="dg-box is-gold"><span class="bx-label">📜 Role — namespace-scoped</span>
          <span class="dg-pill gold">sirf apne mohalle mein</span>
          <div class="dg-cap">app ke liye yahi default</div>
        </div>
        <div class="dg-box is-bad"><span class="bx-label">🌍 ClusterRole — poora cluster</span>
          <span class="dg-pill bad">nodes, saare NS, PVs...</span>
          <div class="dg-cap">sirf jab sach mein zaroorat ho</div>
        </div>
      </div>
      <div class="dg-cap"><b>Identity</b> (ServiceAccount) + <b>Permissions</b> (Role) + <b>Jod</b> (RoleBinding) = RBAC. Apps ko SA se bandho, insaan wale groups se — aur hamesha <b>least privilege</b>.</div>`,
  },

  podsecurity: {
    t: 'Pod Security Admission — namespace ka gatekeeper',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-bad"><span class="ni">😈</span><span class="nl">Pod spec</span><span class="ns">runAsUser: 0 (root!)</span></div>
        <div class="dg-arrow bad flow"></div>
        <div class="dg-node is-gold pulse"><span class="ni">🛃</span><span class="nl">PSA Gate</span><span class="ns">ns label: enforce=restricted</span></div>
        <div class="dg-arrow bad"></div>
        <span class="dg-pill bad">✗ REJECTED at API Server</span>
      </div>
      <div class="dg-split" style="margin-top:12px">
        <div class="dg-node is-muted"><span class="ni">🔓</span><span class="nl">privileged</span><span class="ns">sab allowed (system NS)</span></div>
        <div class="dg-node is-gold"><span class="ni">🔒</span><span class="nl">baseline</span><span class="ns">known-bad band</span></div>
        <div class="dg-node is-good"><span class="ni">🔐</span><span class="nl">restricted</span><span class="ns">non-root, no escalation ✓</span></div>
      </div>
      <div class="dg-cap">PSA = namespace-level standards: <b>privileged / baseline / restricted</b>, modes: <b>enforce / audit / warn</b>. Container escape ka blast radius wahin ruk jaata hai.</div>`,
  },

  secrets: {
    t: 'Secrets — git se bahar, vault se andar',
    scene: {
      intro: '<b>Sawal:</b> DB ka password pod tak kaise pahunche — bina password ko Git mein likhe?',
      aria: 'External Secrets Operator: Git mein sirf pointer, asli password AWS Secrets Manager se cluster ke Secret tak, 9 kadam',
      nodes: [
        { id: 'git', col: 0, row: 0, icon: '📁', label: 'Git repo', sub: 'YAML yahan rehta hai', about: 'GitOps mein cluster ka saara YAML Git mein hota hai. Isliye Git mein asli password likhna = password sabko dikhana.' },
        { id: 'es', col: 1, row: 0, icon: '📄', label: 'ExternalSecret', sub: 'sirf pata: prod/db', tone: 'accent', about: 'Ek chhota object jisme password nahi hota. Sirf likha hota hai: "is store ke is path se keemat lo, aur is naam ka Secret banao".' },
        { id: 'vault', col: 2, row: 0, icon: '🏦', label: 'AWS Secrets Manager', sub: 'asli password yahan', tone: 'gold', about: 'Cluster ke bahar ki tijori. Asli password, uski history aur rotation yahin hote hain. (Vault bhi aisi hi tijori hai.)' },
        { id: 'pod', col: 0, row: 1, icon: '📦', label: 'pod: payments', sub: 'DB_PASS chahiye', tone: 'muted', about: 'App ko bas ek aam Kubernetes Secret dikhta hai. App ko pata nahi ki password kahan se aaya.' },
        { id: 'sec', col: 1, row: 1, icon: '🔑', label: 'Secret: db-creds', sub: 'abhi bana nahi', tone: 'muted', about: 'Aam Kubernetes Secret. Farak itna hai ki is Secret ko kisi insaan ne nahi, operator ne banaya hai.' },
        { id: 'eso', col: 2, row: 1, icon: '🔁', label: 'ESO (operator)', sub: 'External Secrets Operator', about: 'Cluster mein chalne wala controller. ESO ExternalSecret padhta hai, tijori se keemat laata hai, aur cluster mein Secret banata / naya karta hai.' },
      ],
      steps: [
        { at: ['git'], say: 'Secret ka YAML <b>Git repo</b> mein daalna = leak. Secret ki keemat sirf base64 mein hoti hai, aur base64 koi bhi 2 second mein khol leta hai.' },
        { from: 'git', to: 'es', label: 'sirf pointer', say: '<b>Git repo</b> se cluster mein sirf <b>ExternalSecret</b> jaata hai. ExternalSecret mein password nahi hai. Sirf pata likha hai: "AWS Secrets Manager ke path prod/db se lo".' },
        { from: 'eso', to: 'es', label: 'pata padho', say: '<b>ESO (operator)</b> cluster ke andar chalta hai. ESO <b>ExternalSecret</b> ko padhta hai.' },
        { from: 'eso', to: 'vault', label: 'prod/db ki keemat do', tone: 'gold', say: 'ESO <b>AWS Secrets Manager</b> se asli password maangta hai. ESO ko AWS ki ijaazat Pod Identity ya IRSA se milti hai — kisi likhi hui key se nahi.' },
        { from: 'eso', to: 'sec', label: 'Secret banao', tone: 'good', set: { sec: { tone: 'good', sub: 'DB_PASS ✓' } }, say: 'ESO cluster mein <b>Secret: db-creds</b> bana deta hai.' },
        { from: 'sec', to: 'pod', label: 'env / volume', tone: 'good', set: { pod: { tone: 'good', sub: 'DB_PASS mil gaya' } }, say: '<b>pod: payments</b> <b>Secret: db-creds</b> ko aam Secret ki tarah use karta hai.' },
        { at: ['vault'], set: { vault: { sub: 'password badla (rotate)' } }, say: 'Teen mahine baad password <b>AWS Secrets Manager</b> mein badla jaata hai (rotation). Git mein kuch nahi badla.' },
        { from: 'eso', to: 'sec', label: 'nayi keemat', tone: 'gold', say: 'ESO <code>refreshInterval</code> ke baad nayi keemat laata hai aur <b>Secret: db-creds</b> ko naya kar deta hai. Jaal: jo pod password ko env var se leta hai, us pod ko restart chahiye.' },
        { at: ['git', 'es', 'vault'], say: 'Yaad rakho: Git mein sirf <b>pointer</b> (ExternalSecret). Asli keemat sirf tijori mein. Rotation tijori mein karo — cluster khud naya ho jaata hai.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-gold"><span class="ni">🏦</span><span class="nl">Vault / AWS SM</span><span class="ns">asli secrets yahan</span></div>
        <div class="dg-link"><span class="dg-pill gold">sync + rotate</span><div class="dg-arrow gold flow"></div></div>
        <div class="dg-node is-accent pulse"><span class="ni">🔁</span><span class="nl">External Secrets Operator</span><span class="ns">ExternalSecret CR padhta hai</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node"><span class="ni">🔑</span><span class="nl">K8s Secret</span><span class="ns">auto-created</span></div>
        <div class="dg-arrow good flow"></div>
        <div class="dg-node is-good"><span class="ni">📦</span><span class="nl">Pod</span><span class="ns">env/volume</span></div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <span class="dg-pill bad">❌ git mein Secret YAML = leak (base64 ≠ encryption!)</span>
        <span class="dg-pill good">✓ git mein sirf ExternalSecret (reference)</span>
      </div>
      <div class="dg-cap">Git mein sirf <b>pointer</b> jaata hai ("vault ke is path se lo") — asli value kabhi nahi. Rotation vault mein karo, cluster khud sync ho jaata hai.</div>`,
  },

  observability: {
    t: 'Prometheus + Grafana + Logs — teen aankhein',
    html: `
      <div class="dg-split">
        <div class="dg-box is-accent"><span class="bx-label">📈 Metrics (pull!)</span>
          <div class="dg-flow">
            <div class="dg-node"><span class="ni">📦</span><span class="nl">pods</span><span class="ns">/metrics endpoint</span></div>
            <div class="dg-arrow two"></div>
            <div class="dg-node is-accent pulse"><span class="ni">🔥</span><span class="nl">Prometheus</span><span class="ns">scrape har 15s</span></div>
          </div>
        </div>
        <div class="dg-box is-good"><span class="bx-label">🪵 Logs (stdout!)</span>
          <div class="dg-flow">
            <div class="dg-node"><span class="ni">📦</span><span class="nl">stdout/stderr</span></div>
            <div class="dg-arrow good flow"></div>
            <div class="dg-node is-good"><span class="ni">🚛</span><span class="nl">DaemonSet agent</span><span class="ns">Fluent Bit → Loki/ES</span></div>
          </div>
        </div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <div class="dg-arrow gold flow"></div>
        <div class="dg-node is-gold"><span class="ni">📊</span><span class="nl">Grafana</span><span class="ns">dashboards + alerts</span></div>
        <div class="dg-arrow gold flow"></div>
        <span class="dg-pill gold">🔔 PagerDuty (3 AM 😅)</span>
      </div>
      <div class="dg-cap"><b>Prometheus PULL karta hai</b> (push nahi) · logs <b>stdout par likho</b>, DaemonSet agent uthayega (Level 11 yaad hai?) · Grafana dono dikhata hai. Bina iske production = aankhon par patti.</div>`,
  },

  helm: {
    t: 'Helm templates vs Kustomize patches',
    html: `
      <div class="dg-split">
        <div class="dg-box is-accent"><span class="bx-label">⛵ Helm — package + template</span>
          <div class="dg-col">
            <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">Chart</span><span class="ns">replicas: {{ .Values.replicas }}</span></div>
            <div class="dg-flow">
              <span class="dg-pill">values-staging: 2</span>
              <span class="dg-pill gold">values-prod: 10</span>
            </div>
          </div>
        </div>
        <div class="dg-box is-good"><span class="bx-label">🩹 Kustomize — base + patch</span>
          <div class="dg-col">
            <div class="dg-node is-good"><span class="ni">📄</span><span class="nl">base/</span><span class="ns">plain YAML (valid!)</span></div>
            <div class="dg-flow">
              <span class="dg-pill">overlays/staging</span>
              <span class="dg-pill gold">overlays/prod (+patch)</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dg-cap"><b>Helm</b> = templating + packaging + release lifecycle (3rd-party install ka standard: <code>helm install prometheus ...</code>) · <b>Kustomize</b> = template-free patches, kubectl mein built-in (<code>-k</code>). Aksar dono saath: Helm chart render → Kustomize patch.</div>`,
  },

  operators: {
    t: 'CRD + Controller = Operator',
    scene: {
      intro: '<b>Sawal:</b> PostgreSQL chalana sirf "3 pods" nahi hai. Failover, backup aur upgrade ek DBA ke kaam hain. Kya DBA ka gyaan code ban sakta hai?',
      aria: 'CRD aur Operator: custom resource se StatefulSet, failover aur backup tak, 9 kadam',
      nodes: [
        { id: 'user', col: 0, row: 0, icon: '🧑', label: 'Platform engineer', sub: 'kubectl apply', about: 'Insaan sirf "kya chahiye" likhta hai: 3 replicas, roz backup. "Kaise" operator ka kaam hai.' },
        { id: 'api', col: 1, row: 0, icon: '🚪', label: 'API Server', sub: 'kind: PostgresCluster', tone: 'accent', about: 'CRD (CustomResourceDefinition) API Server ko ek naya kind sikhata hai. Uske baad PostgresCluster bhi Pod ya Deployment ki tarah ek object hai: kubectl get, describe, RBAC — sab chalta hai.' },
        { id: 'op', col: 2, row: 0, icon: '🤖', label: 'Operator', sub: 'controller pod', tone: 'gold', about: 'Cluster mein chalne wala ek program. Operator apne kind ke objects ko dekhta hai aur "chahiye" aur "hai" ka farak mitata rehta hai. DBA ka gyaan is program ke code mein likha hai.' },
        { id: 'bkp', col: 0, row: 1, icon: '☁️', label: 'S3: backups', sub: 'roz ka backup', about: 'Cluster ke bahar ki jagah jahan operator database ka backup rakhta hai.' },
        { id: 'pods', col: 1, row: 1, icon: '📦', label: 'pods: pg-0…pg-2', sub: 'abhi bane nahi', tone: 'muted', about: 'PostgreSQL ke teen pods. Ek primary (likhna + padhna), do replicas (sirf padhna).' },
        { id: 'sts', col: 2, row: 1, icon: '🗄️', label: 'StatefulSet: pg', sub: 'abhi bana nahi', tone: 'muted', about: 'Operator khud pods nahi banata. Operator Kubernetes ke aam objects banata hai — StatefulSet, PVC, Service — aur baaki kaam Kubernetes karta hai.' },
      ],
      steps: [
        { at: ['api'], say: '<b>CRD</b> ne <b>API Server</b> ko ek naya kind sikha diya hai: <code>PostgresCluster</code>. Ab cluster "PostgresCluster" shabd samajhta hai.' },
        { from: 'user', to: 'api', label: 'replicas: 3, backup: daily', say: '<b>Platform engineer</b> sirf itna likhta hai: "3 replicas, roz backup". StatefulSet, PVC ya failover ke baare mein ek line bhi nahi.' },
        { from: 'op', to: 'api', label: 'watch', say: '<b>Operator</b> ek controller pod hai. Operator <b>API Server</b> par PostgresCluster objects ko dekhta (watch) rehta hai.' },
        { from: 'op', to: 'sts', label: 'banao', tone: 'good', set: { sts: { tone: 'good', sub: 'replicas: 3' } }, say: 'Operator dekhta hai: "3 replicas chahiye, abhi 0 hain". Operator <b>StatefulSet: pg</b>, PVCs aur Services bana deta hai.' },
        { from: 'sts', to: 'pods', label: '3 pods', tone: 'good', set: { pods: { tone: 'good', sub: 'pg-0 primary' } }, say: '<b>StatefulSet: pg</b> teen pods banata hai: pg-0 (primary), pg-1 aur pg-2 (replicas).' },
        { at: ['pods'], set: { pods: { tone: 'bad', sub: 'pg-0 mar gaya' } }, say: 'Raat 3 baje pg-0 (primary) mar jaata hai. Saada StatefulSet sirf pod ko dobara banata — par database ka naya primary kaun hoga, StatefulSet ko nahi pata.' },
        { from: 'op', to: 'pods', label: 'pg-1 ko primary banao', tone: 'gold', set: { pods: { tone: 'good', sub: 'pg-1 ab primary' } }, say: '<b>Operator</b> farak dekhta hai aur wahi karta hai jo ek DBA karta: pg-1 ko primary banata hai. Koi insaan nahi jaaga.' },
        { from: 'pods', to: 'bkp', label: 'roz ka backup', say: 'Operator roz backup bhi chalata hai. Data <b>S3: backups</b> mein jaata hai.' },
        { at: ['api', 'op'], say: 'Yaad rakho: <b>CRD</b> = API mein naya kind. <b>Operator</b> = us kind ko dekh kar kaam karne wala controller. Wahi purana loop: "chahiye" vs "hai". cert-manager, Prometheus Operator aur Karpenter — sab operators hain.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">📄</span><span class="nl">Custom Resource</span><span class="ns">kind: PostgresCluster<br>replicas: 3, backup: daily</span></div>
        <div class="dg-link"><span class="dg-pill acc">watch</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-gold pulse"><span class="ni">🤖</span><span class="nl">Operator</span><span class="ns">human expert, coded</span></div>
        <div class="dg-link"><span class="dg-pill gold">reconcile</span><div class="dg-arrow gold flow"></div></div>
        <div class="dg-col">
          <span class="dg-pill good">StatefulSet + PVCs</span>
          <span class="dg-pill good">failover sambhalta hai</span>
          <span class="dg-pill good">backups + upgrades</span>
        </div>
      </div>
      <div class="dg-cap"><b>CRD</b> = API mein naya kind register karo · <b>Operator</b> = us kind ko padhkar expert-level operations automate karne wala controller. Wahi reconciliation pattern (Level 2!) — bas ab TUMHARA object. Prometheus, cert-manager, DB operators — sab yahi hain.</div>`,
  },

  gitops: {
    t: 'GitOps — git bolta hai, cluster sunta hai',
    scene: {
      intro: '<b>Sawal:</b> agar koi raat ko cluster mein seedha badlaav kar de toh kya hota hai?',
      aria: 'PR se Git, ArgoCD ka pull aur sync, phir manual drift aur self-heal, 7 kadam',
      nodes: [
        { id: 'dev', col: 0, row: 0, icon: '🧑‍💻', label: 'Developer', sub: 'PR banata hai' },
        { id: 'git', col: 1, row: 0, icon: '📚', label: 'Git repo', sub: 'replicas: 3', about: 'Git repo mein likha YAML = cluster kaisa hona chahiye (desired state).' },
        { id: 'argo', col: 2, row: 0, icon: '🔄', label: 'ArgoCD', sub: 'cluster ke andar', tone: 'accent', about: 'ArgoCD cluster ke andar chalta hai. Git ko dekhta hai, cluster se tulna karta hai, fark mitata hai.' },
        { id: 'cluster', col: 3, row: 0, icon: '☸️', label: 'Cluster', sub: 'replicas: 3', tone: 'good', about: 'Cluster mein abhi jo chal raha hai (actual state).' },
        { id: 'human', col: 3, row: 1, icon: '🙋', label: 'koi insaan', sub: 'kubectl edit', tone: 'muted' },
      ],
      steps: [
        { from: 'dev', to: 'git', label: 'PR: replicas 3 → 5', set: { git: { sub: 'replicas: 5' } }, say: '<b>Developer</b> cluster ko haath nahi lagata. Developer <b>Git repo</b> mein PR banata hai: replicas 3 se 5. Review hota hai, merge hota hai.' },
        { from: 'argo', to: 'git', label: 'kuch badla?', say: '<b>ArgoCD</b> cluster ke andar chalta hai aur Git repo ko baar-baar dekhta hai (pull). Git ya CI ko cluster ka password dene ki zaroorat nahi.' },
        { at: ['argo', 'cluster'], set: { argo: { tone: 'gold', sub: 'OutOfSync' } }, say: '<b>ArgoCD</b> tulna karta hai: Git mein replicas 5, <b>Cluster</b> mein 3. Fark mila → status <code>OutOfSync</code>.' },
        { from: 'argo', to: 'cluster', label: 'sync (apply)', tone: 'good', set: { cluster: { sub: 'replicas: 5' }, argo: { tone: 'good', sub: 'Synced' } }, say: '<b>ArgoCD</b> Git wala YAML cluster par laga deta hai. Ab dono mein replicas 5 → status <code>Synced</code>.' },
        { from: 'human', to: 'cluster', label: 'kubectl edit → 2', tone: 'bad', set: { cluster: { tone: 'bad', sub: 'replicas: 2 (drift)' } }, say: 'Raat ko <b>koi insaan</b> seedha <code>kubectl edit</code> se replicas 2 kar deta hai. Git mein abhi bhi 5 likha hai. Is fark ka naam <b>drift</b> hai.' },
        { from: 'argo', to: 'cluster', label: 'self-heal: wapas 5', tone: 'good', set: { cluster: { tone: 'good', sub: 'replicas: 5' } }, say: '<b>ArgoCD</b> (selfHeal chalu ho toh) drift pakadta hai aur Git wala replicas 5 wapas laga deta hai.' },
        { at: ['git'], say: 'Isliye <b>Git repo</b> hi sach ka ek srot hai. Audit = <code>git log</code>. Rollback = <code>git revert</code>. Cluster mein seedha kiya badlaav tikta nahi.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">📚</span><span class="nl">Git repo</span><span class="ns">desired state (PR + review)</span></div>
        <div class="dg-link"><span class="dg-pill acc">pull + sync</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-gold pulse"><span class="ni">🔄</span><span class="nl">ArgoCD</span><span class="ns">compare: git vs cluster</span></div>
        <div class="dg-link"><span class="dg-pill good">apply</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node is-good"><span class="ni">☸️</span><span class="nl">Cluster</span><span class="ns">actual state</span></div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <span class="dg-pill bad">kisi ne manually kubectl edit kiya → DRIFT detected → ArgoCD wapas git wala laga deta hai 😎</span>
      </div>
      <div class="dg-cap">Laptop se <code>kubectl apply</code> band. <b>Git = single source of truth</b>: audit (git log), rollback (git revert), review (PR). Cluster khud ko git se milata rehta hai — reconciliation ka final boss.</div>`,
  },

  istio: {
    t: 'Service Mesh — har pod ka bodyguard proxy',
    scene: {
      intro: '<b>Sawal:</b> app: orders ko app: products se baat karni hai. Encryption, retry aur 90/10 canary chahiye — par app ka code nahi badalna.',
      aria: 'Service mesh: istiod se certificate aur niyam, sidecar proxy ke beech mTLS, aur 10 pratishat canary, 9 kadam',
      groups: [
        { label: '📦 pod A', cols: [0, 1], rows: [0, 0], tone: 'accent' },
        { label: '📦 pod B (v1)', cols: [2, 3], rows: [0, 0], tone: 'good' },
        { label: '📦 pod C (v2, canary)', cols: [2, 3], rows: [1, 1], tone: 'gold' },
      ],
      nodes: [
        { id: 'appA', col: 0, row: 0, icon: '🍳', label: 'app: orders', sub: 'saada HTTP bolta hai', about: 'App ka code mesh ke baare mein kuch nahi jaanta. app: orders bas http://products bulata hai.' },
        { id: 'envA', col: 1, row: 0, icon: '🕵️', label: 'envoy (pod A)', sub: 'sidecar proxy', tone: 'accent', about: 'Pod A ke andar ka doosra container. Pod A se nikalne wali aur aane wali har request envoy (pod A) se guzarti hai.' },
        { id: 'envB', col: 2, row: 0, icon: '🕵️', label: 'envoy (pod B)', sub: 'sidecar proxy', tone: 'accent', about: 'Pod B ke andar ka proxy. Bahar se aane wali request pehle envoy (pod B) ke paas aati hai.' },
        { id: 'appB', col: 3, row: 0, icon: '🍳', label: 'app: products v1', sub: 'purana version', about: 'products ka chalta hua version. 90% traffic yahan aata hai.' },
        { id: 'istiod', col: 1, row: 1, icon: '🧠', label: 'istiod', sub: 'certificate + niyam', tone: 'gold', about: 'Mesh ka control plane. istiod har proxy ko certificate (pehchaan) aur traffic ke niyam bhejta hai. Requests istiod se hokar nahi guzarti.' },
        { id: 'envC', col: 2, row: 1, icon: '🕵️', label: 'envoy (pod C)', sub: 'sidecar proxy', tone: 'accent', about: 'Pod C (naya version v2) ke andar ka proxy.' },
        { id: 'appC', col: 3, row: 1, icon: '🍳', label: 'app: products v2', sub: 'naya version', about: 'products ka naya version. Shuru mein sirf 10% traffic yahan aata hai.' },
      ],
      steps: [
        { at: ['appA', 'appB'], say: 'Bina mesh ke <b>app: orders</b> seedha <b>app: products v1</b> ko saada HTTP bhejta. Na encryption, na retry, na canary. Mesh har pod mein ek proxy container jod deta hai.' },
        { from: 'istiod', to: 'envA', label: 'certificate + niyam', tone: 'gold', say: '<b>istiod</b> <b>envoy (pod A)</b> ko do cheezein deta hai: ek certificate (pod A ki pehchaan) aur traffic ke niyam.' },
        { from: 'istiod', to: 'envB', label: 'certificate + niyam', tone: 'gold', say: '<b>istiod</b> wahi do cheezein <b>envoy (pod B)</b> ko bhi deta hai. Dhyaan do: requests istiod se hokar nahi jaati. istiod sirf niyam baant-ta hai.' },
        { from: 'appA', to: 'envA', label: 'saada HTTP', say: '<b>app: orders</b> saada HTTP request bhejta hai. Pod A ke andar <b>envoy (pod A)</b> us request ko pakad leta hai. app: orders ko pata bhi nahi chalta.' },
        { from: 'envA', to: 'envB', label: 'mTLS (encrypted)', tone: 'good', say: '<b>envoy (pod A)</b> request ko encrypt karke <b>envoy (pod B)</b> ko bhejta hai. Dono proxy ek doosre ka certificate jaanchte hain. Is do-tarfa jaanch ka naam <b>mTLS</b> hai.' },
        { from: 'envB', to: 'appB', label: 'saada HTTP', say: '<b>envoy (pod B)</b> request ko kholta hai aur <b>app: products v1</b> ko saada HTTP mein de deta hai.' },
        { from: 'envA', to: 'envC', label: '10% canary', tone: 'gold', say: 'Traffic ka niyam kehta hai: 90% v1 ko, 10% v2 ko. <b>envoy (pod A)</b> har 10 mein se 1 request <b>envoy (pod C)</b> ko bhejta hai.' },
        { from: 'envC', to: 'appC', label: 'saada HTTP', say: '<b>envoy (pod C)</b> request <b>app: products v2</b> ko deta hai. v2 mein errors badhen toh niyam mein 10% ko 0% kar do — deploy wapas lene ki zaroorat nahi.' },
        { at: ['envA', 'envB', 'istiod'], say: 'Yaad rakho: proxy har request ke beech mein baitha hai. Isliye mTLS, retries, canary aur metrics <b>bina app code badle</b> milte hain. Keemat: har pod mein ek extra container, aur ek naya system jise chalana seekhna padta hai.' },
      ],
    },
    html: `
      <div class="dg-flow">
        <div class="dg-box is-accent"><span class="bx-label">📦 pod A</span>
          <div class="dg-flow">
            <div class="dg-node"><span class="ni">🍳</span><span class="nl">app</span></div>
            <div class="dg-node is-accent"><span class="ni">🕵️</span><span class="nl">envoy</span><span class="ns">sidecar</span></div>
          </div>
        </div>
        <div class="dg-link"><span class="dg-pill good">🔐 mTLS</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-box is-accent"><span class="bx-label">📦 pod B</span>
          <div class="dg-flow">
            <div class="dg-node is-accent"><span class="ni">🕵️</span><span class="nl">envoy</span></div>
            <div class="dg-node"><span class="ni">🍳</span><span class="nl">app</span></div>
          </div>
        </div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <div class="dg-node is-gold"><span class="ni">🧠</span><span class="nl">istiod</span><span class="ns">control plane: certs + config</span></div>
        <div class="dg-col">
          <span class="dg-pill gold">v1 ← 90% traffic</span>
          <span class="dg-pill acc">v2 (canary) ← 10%</span>
        </div>
      </div>
      <div class="dg-cap">Proxy har request intercept karta hai — isliye <b>bina app code badle</b>: mTLS encryption, 90/10 canary splits, retries, aur golden metrics (rate/errors/latency) har service ke. Yehi mesh ka sauda hai — complexity ke badle superpowers.</div>`,
  },

  boss3: {
    t: 'Senior Engineer ka Gauntlet',
    html: `
      <div class="dg-ladder">
        <div class="dg-rung"><span class="lv">1</span><span class="cmd">Forbidden? → RBAC chain: SA → binding → role</span><span class="q">kubectl auth can-i</span></div>
        <div class="dg-rung"><span class="lv">2</span><span class="cmd">Secret stale? → ESO → vault path → sync status</span><span class="q">describe externalsecret</span></div>
        <div class="dg-rung g"><span class="lv">3</span><span class="cmd">Deploy gayab? → ArgoCD OutOfSync + drift</span><span class="q">git log dekho, cluster nahi</span></div>
        <div class="dg-rung g"><span class="lv">4</span><span class="cmd">Latency spike? → Grafana → golden metrics → mesh</span><span class="q">rate / errors / duration</span></div>
        <div class="dg-rung a"><span class="lv">🏆</span><span class="cmd">Kubernetes Mahaguru 👑</span><span class="q">the final certificate</span></div>
      </div>
      <div class="dg-cap">Senior hona = <b>layers ke paar sochna</b>: app → workload → network → security → delivery pipeline. Aakhri boss yahi test karega.</div>`,
  },


  /* ================= TRACK 4 — HELM GURUKUL ================= */

  helmbasics: {
    t: 'Chart + Values = Release',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">Chart</span><span class="ns">templates + defaults</span></div>
        <div class="dg-node"><span class="ni">➕</span></div>
        <div class="dg-node is-gold"><span class="ni">🎛️</span><span class="nl">Values</span><span class="ns">-f prod.yaml --set</span></div>
        <div class="dg-link"><span class="dg-pill acc">helm install</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-good pulse"><span class="ni">🚢</span><span class="nl">Release</span><span class="ns">shop · revision 1</span></div>
        <div class="dg-link"><span class="dg-pill good">rendered YAML</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node"><span class="ni">☸️</span><span class="nl">Cluster</span><span class="ns">Deployment, Service…</span></div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <span class="dg-pill">rev 1</span><div class="dg-arrow" style="flex-basis:24px"></div>
        <span class="dg-pill acc">rev 2 (upgrade)</span><div class="dg-arrow" style="flex-basis:24px"></div>
        <span class="dg-pill gold">rev 3 = rollback to 1</span>
      </div>
      <div class="dg-cap">Ek <b>chart</b> (blueprint) + alag-alag <b>values</b> = alag-alag <b>releases</b>. Har change ek naya <b>revision</b> — isliye <code>helm rollback</code> possible hai. Rollback bhi aage badhta hai (rev 3), peeche nahi jaata.</div>`,
  },

  helmanatomy: {
    t: 'Chart ke andar kya hota hai',
    html: `
      <div class="dg-split">
        <div class="dg-box is-accent"><span class="bx-label">📁 mychart/</span>
          <div class="dg-stack">
            <span class="dg-pill acc">Chart.yaml — naam, version, appVersion</span>
            <span class="dg-pill gold">values.yaml — DEFAULT config</span>
            <span class="dg-pill">templates/ — YAML + {{ }}</span>
            <span class="dg-pill">templates/_helpers.tpl — reusable snippets</span>
            <span class="dg-pill">templates/NOTES.txt — install ke baad ka message</span>
            <span class="dg-pill good">charts/ — subcharts (dependencies)</span>
            <span class="dg-pill">.helmignore — kya package na ho</span>
          </div>
        </div>
        <div class="dg-col">
          <div class="dg-node is-gold"><span class="ni">🔍</span><span class="nl">helm lint</span><span class="ns">galtiyan pakdo</span></div>
          <div class="dg-down flow"></div>
          <div class="dg-node is-accent"><span class="ni">🖨️</span><span class="nl">helm template</span><span class="ns">rendered YAML dekho</span></div>
          <div class="dg-down flow"></div>
          <div class="dg-node is-good"><span class="ni">🚢</span><span class="nl">helm install</span><span class="ns">cluster mein bhejo</span></div>
        </div>
      </div>
      <div class="dg-cap"><b>version</b> = chart ka apna version · <b>appVersion</b> = andar chal rahi app ka version — dono ALAG hote hain! Debug ka mantra: <b>lint → template → install</b>.</div>`,
  },

  helmtemplating: {
    t: 'Template + Values → Manifest',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-gold"><span class="ni">🎛️</span><span class="nl">.Values</span><span class="ns">values.yaml se</span></div>
        <div class="dg-node is-accent"><span class="ni">📛</span><span class="nl">.Release</span><span class="ns">.Name .Namespace</span></div>
        <div class="dg-node"><span class="ni">📦</span><span class="nl">.Chart</span><span class="ns">.Name .Version</span></div>
        <div class="dg-node is-muted"><span class="ni">🔌</span><span class="nl">.Capabilities</span><span class="ns">API versions</span></div>
      </div>
      <div class="dg-down flow"></div>
      <div class="dg-flow">
        <div class="dg-node is-accent pulse" style="min-width:210px"><span class="ni">🪄</span><span class="nl">Go template engine</span><span class="ns">{{ .Values.x | default "y" | quote }}</span></div>
        <div class="dg-link"><span class="dg-pill good">render</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node is-good"><span class="ni">📄</span><span class="nl">Plain YAML</span><span class="ns">K8s ko bheja jaata hai</span></div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <span class="dg-pill acc">if / else</span><span class="dg-pill acc">range</span><span class="dg-pill acc">with</span>
        <span class="dg-pill gold">| default</span><span class="dg-pill gold">| quote</span><span class="dg-pill gold">| toYaml | nindent</span>
        <span class="dg-pill bad">{{- -}} whitespace</span>
      </div>
      <div class="dg-cap">Helm YAML ko <b>samajhta nahi</b> — woh sirf TEXT banata hai, phir K8s usse YAML ki tarah padhta hai. Isliye <b>indentation</b> (nindent) aur <b>whitespace chomping</b> ({{- -}}) itne important hain.</div>`,
  },

  helmvalues: {
    t: 'Values ki precedence — kaun jeetta hai',
    html: `
      <div class="dg-ladder">
        <div class="dg-rung"><span class="lv">1</span><span class="cmd">chart ki values.yaml (defaults)</span><span class="q">sabse kamzor</span></div>
        <div class="dg-rung"><span class="lv">2</span><span class="cmd">parent chart ki values (subchart ke liye)</span><span class="q">upar wale jeette hain</span></div>
        <div class="dg-rung"><span class="lv">3</span><span class="cmd">-f values-staging.yaml</span><span class="q">file</span></div>
        <div class="dg-rung g"><span class="lv">4</span><span class="cmd">-f values-prod.yaml (baad wali file)</span><span class="q">pehli ko override</span></div>
        <div class="dg-rung a"><span class="lv">5</span><span class="cmd">--set image.tag=2.5</span><span class="q">👑 SABSE STRONG</span></div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <span class="dg-pill bad">⚠️ --set se kiya hua change agle upgrade mein GAYAB (jab tak dobara na do)</span>
      </div>
      <div class="dg-cap">Neeche wala hamesha jeetta hai. Multiple <code>-f</code> LEFT→RIGHT merge hoti hain. Debug: <code>helm get values &lt;release&gt;</code> se dekho ki asli mein kya laga hai.</div>`,
  },

  helmdeps: {
    t: 'Umbrella chart — ek chart, poori app',
    html: `
      <div class="dg-col">
        <div class="dg-node is-accent pulse"><span class="ni">☂️</span><span class="nl">shop (umbrella chart)</span><span class="ns">Chart.yaml → dependencies</span></div>
        <div class="dg-down flow"></div>
        <div class="dg-flow">
          <div class="dg-node is-good"><span class="ni">🌐</span><span class="nl">web</span><span class="ns">subchart</span></div>
          <div class="dg-node is-good"><span class="ni">⚙️</span><span class="nl">api</span><span class="ns">subchart</span></div>
          <div class="dg-node is-gold"><span class="ni">🗄️</span><span class="nl">postgresql</span><span class="ns">bitnami (condition)</span></div>
        </div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <span class="dg-pill acc">parent values: <b>api.replicas: 5</b> → subchart ko</span>
        <span class="dg-pill gold">global.env: prod → SABKO</span>
        <span class="dg-pill bad">postgresql.enabled: false → skip</span>
      </div>
      <div class="dg-cap"><code>helm dependency update</code> subcharts ko <b>charts/</b> mein laata hai aur <b>Chart.lock</b> banata hai. Parent ki values subchart ke naam ke neeche jaati hain; <b>global.</b> sabhi charts ko dikhta hai.</div>`,
  },

  helmhooks: {
    t: 'Hooks aur release lifecycle',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-gold"><span class="ni">🪝</span><span class="nl">pre-install</span><span class="ns">DB migration Job</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">install</span><span class="ns">manifests apply</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node is-good"><span class="ni">✅</span><span class="nl">post-install</span><span class="ns">seed data / notify</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node"><span class="ni">🧪</span><span class="nl">helm test</span><span class="ns">test hook chalta hai</span></div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <div class="dg-node is-bad"><span class="ni">💥</span><span class="nl">upgrade fail</span><span class="ns">status: failed</span></div>
        <div class="dg-link"><span class="dg-pill gold">--atomic tha?</span><div class="dg-arrow gold flow"></div></div>
        <div class="dg-node is-good"><span class="ni">↩️</span><span class="nl">auto rollback</span><span class="ns">purani revision wapas</span></div>
      </div>
      <div class="dg-cap">Hook annotations: <code>helm.sh/hook: pre-install</code>, <code>hook-weight</code> (order), <code>hook-delete-policy</code> (safai). Production upgrades mein hamesha <b>--atomic --timeout</b> — fail hua toh khud rollback.</div>`,
  },

  helmship: {
    t: 'Chart ship karo — package se GitOps tak',
    html: `
      <div class="dg-flow">
        <div class="dg-node"><span class="ni">🔍</span><span class="nl">lint</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">package</span><span class="ns">shop-0.2.0.tgz</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node is-gold pulse"><span class="ni">🏛️</span><span class="nl">OCI registry</span><span class="ns">helm push oci://…</span></div>
        <div class="dg-arrow good flow"></div>
        <div class="dg-node is-good"><span class="ni">🔄</span><span class="nl">ArgoCD</span><span class="ns">chart + values git se</span></div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <span class="dg-pill acc">version: 0.2.0 (chart badla)</span>
        <span class="dg-pill gold">appVersion: 2.5.0 (app badli)</span>
        <span class="dg-pill bad">secrets values.yaml mein NAHI → ESO</span>
      </div>
      <div class="dg-cap">ArgoCD chart ko khud <b>render</b> karta hai (<code>helm template</code> jaisa) aur apply karta hai — release "helm list" mein nahi dikhta, kyunki asli source ab <b>git</b> hai.</div>`,
  },


  /* ================= TRACK 5 — ARGOCD GURUKUL ================= */

  argobasics: {
    t: 'Application = git ka pointer + do statuses',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-accent"><span class="ni">📚</span><span class="nl">Git repo</span><span class="ns">repoURL · path · targetRevision</span></div>
        <div class="dg-link"><span class="dg-pill acc">Application CR</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-gold pulse"><span class="ni">🔄</span><span class="nl">ArgoCD</span><span class="ns">compare + apply</span></div>
        <div class="dg-link"><span class="dg-pill good">destination</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node is-good"><span class="ni">☸️</span><span class="nl">Cluster</span><span class="ns">server + namespace</span></div>
      </div>
      <div class="dg-split" style="margin-top:12px">
        <div class="dg-box is-accent"><span class="bx-label">SYNC STATUS — git se match?</span>
          <div class="dg-flow"><span class="dg-pill good">Synced</span><span class="dg-pill bad">OutOfSync</span></div>
        </div>
        <div class="dg-box is-good"><span class="bx-label">HEALTH STATUS — chal raha hai?</span>
          <div class="dg-flow"><span class="dg-pill good">Healthy</span><span class="dg-pill">Progressing</span><span class="dg-pill bad">Degraded</span><span class="dg-pill">Missing</span></div>
        </div>
      </div>
      <div class="dg-cap"><b>Do alag axes hain!</b> <code>Synced + Degraded</code> ka matlab: git aur cluster same hain — par git ka manifest hi kharab hai. <code>OutOfSync + Healthy</code>: app chal rahi hai, par git kuch aur bolta hai.</div>`,
  },

  argosync: {
    t: 'Auto-sync ke teen switch',
    html: `
      <div class="dg-flow">
        <div class="dg-node"><span class="ni">🤖</span><span class="nl">automated</span><span class="ns">git badla → khud apply</span></div>
        <div class="dg-node is-gold"><span class="ni">✂️</span><span class="nl">prune</span><span class="ns">git se hata → cluster se bhi hatao</span></div>
        <div class="dg-node is-good"><span class="ni">🩹</span><span class="nl">selfHeal</span><span class="ns">manual change → wapas git wala</span></div>
      </div>
      <div class="dg-flow" style="margin-top:14px">
        <div class="dg-node is-bad"><span class="ni">🧑‍💻</span><span class="nl">kubectl edit</span><span class="ns">"bas 2 min ka fix"</span></div>
        <div class="dg-link"><span class="dg-pill bad">DRIFT</span><div class="dg-arrow bad flow"></div></div>
        <div class="dg-node is-gold pulse"><span class="ni">👀</span><span class="nl">ArgoCD</span><span class="ns">OutOfSync detect</span></div>
        <div class="dg-link"><span class="dg-pill good">selfHeal</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node is-good"><span class="ni">↩️</span><span class="nl">git wala state wapas</span></div>
      </div>
      <div class="dg-cap">Bina <b>prune</b> ke: git se delete kiya resource cluster mein zinda rehta hai (app hamesha OutOfSync). Bina <b>selfHeal</b> ke: drift dikhta hai par theek nahi hota. <code>ignoreDifferences</code> se HPA-managed replicas jaise fields ko chhod do.</div>`,
  },

  argowaves: {
    t: 'Sync waves — kaun pehle, kaun baad mein',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-gold"><span class="ni">🪝</span><span class="nl">PreSync</span><span class="ns">DB migration Job</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node is-muted"><span class="ni">-1</span><span class="nl">wave -1</span><span class="ns">Namespace, CRDs</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node is-accent"><span class="ni">0️⃣</span><span class="nl">wave 0</span><span class="ns">ConfigMap, Secret</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node is-good"><span class="ni">1️⃣</span><span class="nl">wave 1</span><span class="ns">Deployment, Service</span></div>
        <div class="dg-arrow flow"></div>
        <div class="dg-node"><span class="ni">✅</span><span class="nl">PostSync</span><span class="ns">smoke test</span></div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <span class="dg-pill acc">annotation: argocd.argoproj.io/sync-wave: "1"</span>
        <span class="dg-pill gold">hook: PreSync / PostSync / SyncFail</span>
      </div>
      <div class="dg-cap">Chhota number pehle (negative bhi chalta hai). <b>Agla wave tabhi shuru hota hai jab pichla HEALTHY ho jaaye</b> — isliye DB pehle, app baad mein. Helm hooks ≠ Argo hooks: Argo apne annotations dekhta hai.</div>`,
  },

  argoscale: {
    t: 'App-of-Apps aur ApplicationSet',
    html: `
      <div class="dg-split">
        <div class="dg-box is-accent"><span class="bx-label">☂️ App-of-Apps</span>
          <div class="dg-col">
            <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">root Application</span><span class="ns">path: apps/</span></div>
            <div class="dg-down flow"></div>
            <div class="dg-flow">
              <div class="dg-node"><span class="ni">📄</span><span class="ns">app-web</span></div>
              <div class="dg-node"><span class="ni">📄</span><span class="ns">app-api</span></div>
              <div class="dg-node"><span class="ni">📄</span><span class="ns">monitoring</span></div>
            </div>
          </div>
          <div class="dg-cap">git mein Application YAMLs — haath se likhi hui</div>
        </div>
        <div class="dg-box is-gold"><span class="bx-label">🏭 ApplicationSet</span>
          <div class="dg-col">
            <div class="dg-node is-gold pulse"><span class="ni">⚙️</span><span class="nl">ApplicationSet</span><span class="ns">generator: git / cluster / matrix</span></div>
            <div class="dg-down flow"></div>
            <div class="dg-flow">
              <div class="dg-node is-good"><span class="ni">🤖</span><span class="ns">shop-dev</span></div>
              <div class="dg-node is-good"><span class="ni">🤖</span><span class="ns">shop-stg</span></div>
              <div class="dg-node is-good"><span class="ni">🤖</span><span class="ns">shop-prod</span></div>
            </div>
          </div>
          <div class="dg-cap">apne aap BANTI hain — template + generator se</div>
        </div>
      </div>
      <div class="dg-cap"><b>App-of-Apps</b> = ek root app jo baaki Applications ko manage kare (bootstrap ke liye). <b>ApplicationSet</b> = ek template + generator se N apps auto-generate (naya cluster/env/folder add hote hi app khud ban jaata hai). Generated apps ko manually edit mat karo — generator badlo!</div>`,
  },

  argorollouts: {
    t: 'Canary — traffic ka dial, metrics ka faisla',
    html: `
      <div class="dg-flow">
        <div class="dg-node"><span class="ni">🌍</span><span class="nl">Traffic</span></div>
        <div class="dg-col">
          <div class="dg-flow"><span class="dg-pill good">90%</span><div class="dg-arrow good" style="flex-basis:30px"></div><div class="dg-node is-good"><span class="ni">🟢</span><span class="nl">stable v1</span></div></div>
          <div class="dg-flow"><span class="dg-pill gold">10%</span><div class="dg-arrow gold" style="flex-basis:30px"></div><div class="dg-node is-gold pulse"><span class="ni">🐤</span><span class="nl">canary v2</span></div></div>
        </div>
        <div class="dg-link"><span class="dg-pill acc">metrics</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-accent"><span class="ni">📊</span><span class="nl">AnalysisRun</span><span class="ns">success-rate &gt; 95%?</span></div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <div class="dg-flow"><div class="dg-arrow good" style="flex-basis:26px"></div><span class="dg-pill good">✓ pass → 25% → 50% → 100%</span></div>
        <div class="dg-flow"><div class="dg-arrow bad" style="flex-basis:26px"></div><span class="dg-pill bad">✗ fail → AUTO ABORT, 0% (v1 par wapas)</span></div>
      </div>
      <div class="dg-cap"><b>Deployment</b> pods replace karta hai — sab users naye version par. <b>Rollout</b> traffic ka percentage control karta hai, aur <b>AnalysisTemplate</b> (Prometheus query) khud decide karta hai aage badhna hai ya abort. Blast radius = weight jitna.</div>`,
  },

  argoboss: {
    t: 'GitOps debugging ladder',
    html: `
      <div class="dg-ladder">
        <div class="dg-rung"><span class="lv">1</span><span class="cmd">argocd app list → Sync + Health dono padho</span><span class="q">kaunsa axis kharab?</span></div>
        <div class="dg-rung"><span class="lv">2</span><span class="cmd">OutOfSync? → argocd app diff</span><span class="q">git vs cluster ka farak</span></div>
        <div class="dg-rung"><span class="lv">3</span><span class="cmd">Degraded? → kubectl logs/describe</span><span class="q">git ka sach hi bimaar hai</span></div>
        <div class="dg-rung g"><span class="lv">4</span><span class="cmd">Sync fail? → app get (resource-wise status)</span><span class="q">kaunsa wave atka?</span></div>
        <div class="dg-rung g"><span class="lv">5</span><span class="cmd">Rollback = git revert (auto-sync ON ho toh)</span><span class="q">cluster nahi, GIT badlo</span></div>
        <div class="dg-rung a"><span class="lv">🏆</span><span class="cmd">GitOps Guru 🔄</span><span class="q">git hi sach hai</span></div>
      </div>
      <div class="dg-cap">Har GitOps incident yahin se shuru hota hai: <b>Sync</b> (git==cluster?) aur <b>Health</b> (chal raha hai?) — dono alag sawal hain, alag ilaaj.</div>`,
  },

  /* ================= TRACK 6 — KARPENTER GURUKUL ================= */

  karpenterbasics: {
    t: 'Pending pod se node tak — 40 second',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-bad"><span class="ni">📦</span><span class="nl">Pending pod</span><span class="ns">4 CPU chahiye</span></div>
        <div class="dg-link"><span class="dg-pill acc">watch</span><div class="dg-arrow flow"></div></div>
        <div class="dg-node is-accent pulse"><span class="ni">🌲</span><span class="nl">Karpenter</span><span class="ns">NodePool ke rules padho</span></div>
        <div class="dg-link"><span class="dg-pill gold">NodeClaim</span><div class="dg-arrow gold flow"></div></div>
        <div class="dg-node is-gold"><span class="ni">🧾</span><span class="nl">NodeClaim</span><span class="ns">"c6a.xlarge spot chahiye"</span></div>
        <div class="dg-link"><span class="dg-pill good">EC2 launch</span><div class="dg-arrow good flow"></div></div>
        <div class="dg-node is-good"><span class="ni">🖥️</span><span class="nl">Node Ready</span><span class="ns">pod schedule ✓</span></div>
      </div>
      <div class="dg-split" style="margin-top:12px">
        <div class="dg-box is-accent"><span class="bx-label">📋 NodePool — kya allowed hai</span>
          <span class="dg-pill acc">instance-category: c,m,r</span>
          <span class="dg-pill acc">capacity-type: spot, on-demand</span>
          <span class="dg-pill acc">limits: cpu 1000</span>
        </div>
        <div class="dg-box is-gold"><span class="bx-label">🔧 EC2NodeClass — AWS ki detail</span>
          <span class="dg-pill gold">amiSelectorTerms: al2023@…</span>
          <span class="dg-pill gold">subnetSelector / sgSelector</span>
          <span class="dg-pill gold">IAM role</span>
        </div>
      </div>
      <div class="dg-cap"><b>Cluster Autoscaler</b> pehle se bane node-groups ko scale karta hai. <b>Karpenter</b> pod ki zaroorat dekh kar <b>sahi size ka node KHUD chunta</b> hai — groups ki zaroorat nahi, isliye tez aur sasta.</div>`,
  },

  karpenterdisrupt: {
    t: 'Consolidation — paisa bachane wala controller',
    html: `
      <div class="dg-flow">
        <div class="dg-node is-muted"><span class="ni">🖥️</span><span class="nl">node-A</span><span class="ns">2 pods · 15% used</span></div>
        <div class="dg-node is-muted"><span class="ni">🖥️</span><span class="nl">node-B</span><span class="ns">1 pod · 10% used</span></div>
        <div class="dg-link"><span class="dg-pill gold">consolidate</span><div class="dg-arrow gold flow"></div></div>
        <div class="dg-node is-good pulse"><span class="ni">🖥️</span><span class="nl">node-C</span><span class="ns">3 pods · ek chhota node 💰</span></div>
      </div>
      <div class="dg-flow" style="margin-top:12px">
        <div class="dg-node is-accent"><span class="ni">🧹</span><span class="nl">WhenEmpty</span><span class="ns">sirf khaali node hatao</span></div>
        <div class="dg-node is-gold"><span class="ni">📉</span><span class="nl">WhenEmptyOrUnderutilized</span><span class="ns">kam bhare node bhi merge</span></div>
      </div>
      <div class="dg-flow" style="margin-top:10px">
        <span class="dg-pill bad">🛑 do-not-disrupt annotation → yeh pod hilega nahi</span>
        <span class="dg-pill acc">budgets: ek waqt mein sirf 10% nodes</span>
        <span class="dg-pill gold">drift → naya AMI aaya, node replace</span>
        <span class="dg-pill bad">spot interruption → 2 min warning</span>
      </div>
      <div class="dg-cap">Karpenter sirf nodes banata nahi — <b>hataata bhi hai</b>. Yehi cost saving ka asli engine hai. Par disruption se bachne ke liye: <b>PDBs</b>, <b>disruption budgets</b>, aur batch jobs par <code>do-not-disrupt</code>.</div>`,
  },

  karpenterboss: {
    t: 'Pending pod ka faisla-ped',
    html: `
      <div class="dg-ladder">
        <div class="dg-rung"><span class="lv">1</span><span class="cmd">kubectl describe pod → Events padho</span><span class="q">karpenter ne kya bola?</span></div>
        <div class="dg-rung"><span class="lv">2</span><span class="cmd">"no nodepool matched" → taints/tolerations, labels</span><span class="q">pod pool mein fit hi nahi</span></div>
        <div class="dg-rung"><span class="lv">3</span><span class="cmd">"no instance type" → requirements bahut tight</span><span class="q">4 CPU maanga, pool mein sirf large</span></div>
        <div class="dg-rung g"><span class="lv">4</span><span class="cmd">"limit reached" → NodePool limits.cpu full</span><span class="q">budget guard-rail lag gaya</span></div>
        <div class="dg-rung g"><span class="lv">5</span><span class="cmd">kubectl get nodeclaims → launch ho raha hai?</span><span class="q">EC2 capacity error?</span></div>
        <div class="dg-rung a"><span class="lv">🏆</span><span class="cmd">Node Nawab 🌲</span><span class="q">nodes + paisa dono control mein</span></div>
      </div>
      <div class="dg-cap">Karpenter chup-chaap fail nahi hota — <b>pod ke Events mein saaf likhta hai</b> ki node kyun nahi bana. Padhna aa gaya toh 90% Karpenter debugging ho gayi.</div>`,
  },

};

/* ================= TRACK 7 — KODEKLOUD (SCENARIO PATH) =================
   Diagrams flat object literal ke BAAD property-assignment se jud rahe hain —
   isse naye scenario aage bhi bina beech mein ghuse append kiye ja sakte hain. */

VISUALS['kk-toolkit'] = {
  t: 'Pod ka status → agla command',
  html: `
    <div class="dg-ladder">
      <div class="dg-rung"><span class="dg-pill bad">Pending</span><div class="dg-arrow flow"></div><span class="dg-pill acc">describe pod</span><span class="dg-pill">scheduler ka FailedScheduling</span></div>
      <div class="dg-rung"><span class="dg-pill bad">ImagePullBackOff</span><div class="dg-arrow flow"></div><span class="dg-pill acc">describe pod</span><span class="dg-pill">Events mein Failed to pull</span></div>
      <div class="dg-rung"><span class="dg-pill bad">CreateContainerConfigError</span><div class="dg-arrow flow"></div><span class="dg-pill acc">describe pod</span><span class="dg-pill">"secret … not found"</span></div>
      <div class="dg-rung"><span class="dg-pill bad">CrashLoopBackOff</span><div class="dg-arrow flow"></div><span class="dg-pill gold">logs --previous</span><span class="dg-pill">mare hue container ka error</span></div>
      <div class="dg-rung"><span class="dg-pill bad">Running par 0/1</span><div class="dg-arrow flow"></div><span class="dg-pill acc">describe pod</span><span class="dg-pill">Readiness probe failed</span></div>
      <div class="dg-rung"><span class="dg-pill bad">Terminating (hamesha)</span><div class="dg-arrow flow"></div><span class="dg-pill acc">get pod -o yaml</span><span class="dg-pill">metadata.finalizers</span></div>
    </div>
    <div class="dg-cap">Status hi batata hai ki pod lifecycle ke kis padav par atka hai — aur padav hi batata hai ki <b>agla command kaunsa</b> chalana hai. Guess karne ki zaroorat kabhi nahi padti.</div>`,
};

VISUALS['kk-imagepull'] = {
  t: 'Ek status, paanch alag wajah',
  html: `
    <div class="dg-flow">
      <div class="dg-node is-bad pulse"><span class="ni">🖼️</span><span class="nl">ImagePullBackOff</span><span class="ns">status wajah nahi batata</span></div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-box"><span class="bx-label">📋 describe pod → Events</span>
          <div class="dg-col">
            <span class="dg-pill bad">manifest not found</span><span class="dg-pill good">→ tag galat hai</span>
            <span class="dg-pill bad">repository does not exist</span><span class="dg-pill good">→ image ke naam mein typo</span>
            <span class="dg-pill bad">401 unauthorized</span><span class="dg-pill good">→ imagePullSecrets chahiye</span>
            <span class="dg-pill bad">toomanyrequests</span><span class="dg-pill good">→ registry rate limit</span>
            <span class="dg-pill bad">no such host</span><span class="dg-pill good">→ node ka DNS/proxy</span>
          </div>
        </div>
      </div>
    </div>
    <div class="dg-cap">Paanch bilkul alag bimariyan, ek jaisa status. Wajah hamesha <b>Events ki ek line</b> mein likhi hoti hai — aur wahi line fix chunti hai.</div>`,
};

VISUALS['kk-crashloop'] = {
  t: 'Exit code se seedha wajah tak',
  html: `
    <div class="dg-ladder">
      <div class="dg-rung"><span class="dg-pill gold">Exit 0</span><span class="dg-pill">Reason: Completed</span><div class="dg-arrow flow"></div><span class="dg-pill acc">process khud khatam hua → Job chahiye, Deployment nahi</span></div>
      <div class="dg-rung"><span class="dg-pill bad">Exit 1</span><span class="dg-pill">Reason: Error</span><div class="dg-arrow flow"></div><span class="dg-pill acc">application khud crash → logs --previous</span></div>
      <div class="dg-rung"><span class="dg-pill bad">Exit 137</span><span class="dg-pill bad">Reason: OOMKilled</span><div class="dg-arrow flow"></div><span class="dg-pill acc">kubelet ne memory limit par SIGKILL bheja</span></div>
      <div class="dg-rung"><span class="dg-pill bad">Exit 137</span><span class="dg-pill">Reason: Error</span><div class="dg-arrow flow"></div><span class="dg-pill acc">SIGKILL kisi AUR ne bheja — node ka OOM killer ya sidecar</span></div>
      <div class="dg-rung"><span class="dg-pill bad">Exit 139</span><div class="dg-arrow flow"></div><span class="dg-pill acc">SIGSEGV — aksar galat CPU architecture ki image</span></div>
      <div class="dg-rung"><span class="dg-pill gold">Exit 143</span><div class="dg-arrow flow"></div><span class="dg-pill acc">SIGTERM — aksar liveness probe ne container maara</span></div>
      <div class="dg-rung"><span class="dg-pill bad">Exit 127</span><div class="dg-arrow flow"></div><span class="dg-pill acc">command not found — entrypoint ka path galat</span></div>
    </div>
    <div class="dg-cap">137 akela kaafi nahi hai — <b>Reason zaroor padho</b>. <code>OOMKilled</code> ho to memory limit ka masla hai; <code>Error</code> ho to SIGKILL kisi aur ne bheja aur limit badhane se kuch nahi hoga.</div>`,
};

VISUALS['kk-createcontainer'] = {
  t: 'Container ke chaar padav, chaar alag error',
  html: `
    <div class="dg-flow">
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">1️⃣</span><span class="nl">Image pull</span><span class="ns">kubelet → CRI</span></div>
        <span class="dg-pill bad">ImagePullBackOff</span>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">2️⃣</span><span class="nl">Config assemble</span><span class="ns">ConfigMap + Secret padhna</span></div>
        <span class="dg-pill bad">CreateContainerConfigError</span>
        <span class="dg-pill">cluster mein kuch gayab hai</span>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">3️⃣</span><span class="nl">Container create</span><span class="ns">CRI ko OCI spec</span></div>
        <span class="dg-pill bad">CreateContainerError</span>
        <span class="dg-pill">YAML adhoori hai</span>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">4️⃣</span><span class="nl">Process start</span><span class="ns">entrypoint exec</span></div>
        <span class="dg-pill bad">RunContainerError</span>
        <span class="dg-pill">path / permission</span>
      </div>
      <div class="dg-arrow good"></div>
      <div class="dg-node is-good pulse"><span class="ni">✅</span><span class="nl">Running</span><span class="ns">ab CrashLoop alag bimari hai</span></div>
    </div>
    <div class="dg-cap">Error ka naam hi map hai. Shabd <b>"Config"</b> ka matlab: cluster mein ConfigMap/Secret gayab. Bina "Config" wala <b>CreateContainerError</b>: pod spec adhoori (aksar <code>no command specified</code>).</div>`,
};

VISUALS['kk-pending'] = {
  t: 'FailedScheduling ki line ko tod ke padho',
  html: `
    <div class="dg-col">
      <div class="dg-box is-bad"><span class="bx-label">📟 0/4 nodes are available:</span>
        <div class="dg-col">
          <div class="dg-rung"><span class="dg-pill bad">1 Insufficient cpu</span><div class="dg-arrow flow"></div><span class="dg-pill acc">requests ka jod bhara — usage nahi</span></div>
          <div class="dg-rung"><span class="dg-pill bad">1 didn't match node affinity/selector</span><div class="dg-arrow flow"></div><span class="dg-pill acc">node par label hi nahi hai</span></div>
          <div class="dg-rung"><span class="dg-pill bad">2 had untolerated taint</span><div class="dg-arrow flow"></div><span class="dg-pill acc">toleration chahiye</span></div>
        </div>
      </div>
      <div class="dg-down"></div>
      <div class="dg-split">
        <div class="dg-node is-gold"><span class="ni">⚖️</span><span class="nl">No preemption victims found</span><span class="ns">wajah capacity hai — par victim ki priority kam nahi</span></div>
        <div class="dg-node is-muted"><span class="ni">🚫</span><span class="nl">Preemption is not helpful</span><span class="ns">wajah capacity hai HI nahi — taint/selector hai</span></div>
      </div>
    </div>
    <div class="dg-cap">Har tukda batata hai <b>kitne nodes</b> <b>kis wajah</b> se hate. Aur preemption ka message pehle hi bata deta hai ki <b>priority badhana kaam karega ya nahi</b>.</div>`,
};

VISUALS['kk-missing'] = {
  t: 'Pod banne ki zanjeer — error kahan likhi jaati hai',
  html: `
    <div class="dg-flow">
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">Deployment</span></div>
        <span class="dg-pill">Events: MinimumReplicasUnavailable</span>
        <span class="dg-pill bad">lakshan — karan nahi</span>
      </div>
      <div class="dg-link"><span class="dg-pill acc">Deployment controller</span><div class="dg-arrow flow"></div></div>
      <div class="dg-col">
        <div class="dg-node is-gold pulse"><span class="ni">🧬</span><span class="nl">ReplicaSet</span></div>
        <span class="dg-pill gold">Events: FailedCreate</span>
        <span class="dg-pill good">← ASLI ERROR YAHAN</span>
      </div>
      <div class="dg-link"><span class="dg-pill acc">ReplicaSet controller</span><div class="dg-arrow flow"></div></div>
      <div class="dg-col">
        <div class="dg-node is-bad"><span class="ni">🚫</span><span class="nl">Pod</span><span class="ns">bana hi nahi</span></div>
        <span class="dg-pill bad">exceeded quota</span>
        <span class="dg-pill bad">must specify requests.cpu</span>
        <span class="dg-pill bad">forbidden by PodSecurity</span>
      </div>
    </div>
    <div class="dg-cap">Pod banane ki koshish <b>ReplicaSet controller</b> karta hai, isliye API server ka "forbidden" jawab ReplicaSet ke Events par lagta hai. <b>Pod dikh hi nahi raha? Seedha <code>kubectl describe rs</code>.</b></div>`,
};

VISUALS['kk-schrodinger'] = {
  t: 'Dheela selector — blue-service green ke pods utha rahi hai',
  html: `
    <div class="dg-split">
      <div class="dg-box is-bad"><span class="bx-label">❌ selector: {version: v1}</span>
        <div class="dg-col">
          <div class="dg-node is-accent"><span class="ni">🔵</span><span class="nl">blue-service</span></div>
          <div class="dg-arrow bad"></div>
          <div class="dg-split">
            <div class="dg-node is-good"><span class="ni">🔵</span><span class="nl">blue pod</span><span class="ns">app=blue, version=v1</span></div>
            <div class="dg-node is-good"><span class="ni">🔵</span><span class="nl">blue pod</span><span class="ns">app=blue, version=v1</span></div>
            <div class="dg-node is-bad pulse"><span class="ni">🟢</span><span class="nl">green pod</span><span class="ns">app=green, <b>version=v1</b></span></div>
            <div class="dg-node is-bad pulse"><span class="ni">🟢</span><span class="nl">green pod</span><span class="ns">app=green, <b>version=v1</b></span></div>
          </div>
          <span class="dg-pill bad">endpoints: 4 IP (2 hone chahiye the)</span>
        </div>
      </div>
      <div class="dg-box is-good"><span class="bx-label">✅ selector: {app: blue, version: v1}</span>
        <div class="dg-col">
          <div class="dg-node is-accent"><span class="ni">🔵</span><span class="nl">blue-service</span></div>
          <div class="dg-arrow good"></div>
          <div class="dg-split">
            <div class="dg-node is-good"><span class="ni">🔵</span><span class="nl">blue pod</span></div>
            <div class="dg-node is-good"><span class="ni">🔵</span><span class="nl">blue pod</span></div>
          </div>
          <span class="dg-pill good">endpoints: 2 IP ✓</span>
        </div>
      </div>
    </div>
    <div class="dg-cap">Bug ka koi log nahi, koi 5xx nahi — har request 200 deti hai, bas aadhi baar <b>galat application</b> se. Pakadne ka ek hi pakka tarika: <code>kubectl get endpoints</code> mein <b>IP gino</b> aur replica count se milao.</div>`,
};

VISUALS['kk-config'] = {
  t: 'ConfigMap pod tak — teen raaste, teen alag natije',
  html: `
    <div class="dg-flow">
      <div class="dg-node is-gold"><span class="ni">📋</span><span class="nl">ConfigMap badli</span></div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-rung"><span class="dg-pill acc">envFrom / env</span><div class="dg-arrow bad"></div><span class="dg-pill bad">kuch nahi hota — pod restart chahiye</span></div>
        <div class="dg-rung"><span class="dg-pill acc">volumeMount (file)</span><div class="dg-arrow good"></div><span class="dg-pill good">~60-90s mein file badal jaati hai</span></div>
        <div class="dg-rung"><span class="dg-pill acc">volumeMount + subPath</span><div class="dg-arrow bad"></div><span class="dg-pill bad">kabhi update nahi — snapshot hai</span></div>
      </div>
    </div>
    <div class="dg-down"></div>
    <div class="dg-split">
      <div class="dg-node is-good"><span class="ni">🔄</span><span class="nl">rollout restart</span><span class="ns">turant, manual</span></div>
      <div class="dg-node is-good"><span class="ni">#️⃣</span><span class="nl">checksum annotation</span><span class="ns">GitOps-friendly, apne aap</span></div>
      <div class="dg-node is-good"><span class="ni">🤖</span><span class="nl">Reloader controller</span><span class="ns">cluster-wide automatic</span></div>
    </div>
    <div class="dg-cap">Environment variables container ke <b>banne ke waqt</b> ek baar set hote hain — Linux mein chalte hue process ka environment badla hi nahi ja sakta. Isliye teeno ilaaj ka ek hi kaam hai: <b>naya pod banana</b>.</div>`,
};

VISUALS['kk-terminating'] = {
  t: 'delete ka asli matlab — finalizers ka taala',
  html: `
    <div class="dg-flow">
      <div class="dg-node is-accent"><span class="ni">🗑️</span><span class="nl">kubectl delete</span><span class="ns">object hataata NAHI</span></div>
      <div class="dg-arrow flow"></div>
      <div class="dg-node is-gold pulse"><span class="ni">🕐</span><span class="nl">deletionTimestamp lag gaya</span><span class="ns">status: Terminating</span></div>
      <div class="dg-arrow flow"></div>
      <div class="dg-box is-bad"><span class="bx-label">🔒 metadata.finalizers khaali hai?</span>
        <div class="dg-col">
          <span class="dg-pill bad">kubernetes.io/pvc-protection</span>
          <span class="dg-pill bad">foregroundDeletion</span>
          <span class="dg-pill bad">operator.io/cleanup</span>
        </div>
      </div>
      <div class="dg-split">
        <div class="dg-node is-bad"><span class="ni">🧟</span><span class="nl">Nahi</span><span class="ns">hamesha ke liye Terminating</span></div>
        <div class="dg-node is-good"><span class="ni">✅</span><span class="nl">Haan</span><span class="ns">object asli mein hat gaya</span></div>
      </div>
    </div>
    <div class="dg-cap">Har finalizer kisi controller ka taala hai: "ruko, pehle mera kaam". Zabardasti hataane se pehle poocho — <b>kaunsa</b> finalizer aur <b>kaunsa controller</b>. Namespace ke liye jawab aksar ek anaath APIService hota hai.</div>`,
};

VISUALS['kk-netdeep'] = {
  t: 'curl http://payments — poora raasta',
  html: `
    <div class="dg-flow">
      <div class="dg-node is-accent"><span class="ni">🏃</span><span class="nl">App container</span><span class="ns">curl http://payments</span></div>
      <div class="dg-link"><span class="dg-pill acc">1. DNS</span><div class="dg-arrow flow"></div></div>
      <div class="dg-col">
        <div class="dg-node is-gold"><span class="ni">📖</span><span class="nl">CoreDNS</span><span class="ns">ClusterIP deta hai, pod IP nahi</span></div>
        <span class="dg-pill bad">galat naam → NXDOMAIN</span>
      </div>
      <div class="dg-link"><span class="dg-pill acc">2. DNAT</span><div class="dg-arrow flow"></div></div>
      <div class="dg-col">
        <div class="dg-node is-gold"><span class="ni">⚖️</span><span class="nl">kube-proxy rules</span><span class="ns">10.96.44.12 → 10.244.2.31:8080</span></div>
        <span class="dg-pill bad">endpoints khaali → 503</span>
        <span class="dg-pill bad">targetPort galat → <b>refused</b></span>
      </div>
      <div class="dg-link"><span class="dg-pill acc">3. Route</span><div class="dg-arrow flow"></div></div>
      <div class="dg-col">
        <div class="dg-node is-gold"><span class="ni">🕸️</span><span class="nl">CNI + NetworkPolicy</span><span class="ns">Calico / Cilium</span></div>
        <span class="dg-pill bad">policy drop → <b>timeout</b></span>
      </div>
      <div class="dg-arrow good"></div>
      <div class="dg-node is-good pulse"><span class="ni">🎯</span><span class="nl">Destination pod</span></div>
    </div>
    <div class="dg-cap">"Service down hai" jaisi cheez hoti hi nahi — Service ek iptables rule hai. Toot sakte hain: <b>DNS ka jawab</b>, <b>endpoints ki list</b>, ya <b>packet ka raasta</b>. Aur error ka type hi bata deta hai kaunsa: <b>refused</b> = port galat, <b>timeout</b> = packet gira.</div>`,
};

VISUALS['kk-clusterops'] = {
  t: 'Drain + PDB ka ganit, aur upgrade ka kram',
  html: `
    <div class="dg-col">
      <div class="dg-box is-accent"><span class="bx-label">🎚️ PDB: allowed = healthy − minAvailable</span>
        <div class="dg-col">
          <div class="dg-rung"><span class="dg-pill">replicas 6 · minAvailable 4</span><div class="dg-arrow good"></div><span class="dg-pill good">allowed 2 — drain chalega</span></div>
          <div class="dg-rung"><span class="dg-pill">replicas 3 · minAvailable 3</span><div class="dg-arrow bad"></div><span class="dg-pill bad">allowed 0 — drain HAMESHA atka</span></div>
          <div class="dg-rung"><span class="dg-pill gold">maxUnavailable: 1</span><div class="dg-arrow good"></div><span class="dg-pill good">replicas ke saath apne aap adjust</span></div>
        </div>
      </div>
      <div class="dg-down"></div>
      <div class="dg-box is-gold"><span class="bx-label">⬆️ Upgrade ka kram — badla nahi ja sakta</span>
        <div class="dg-flow">
          <div class="dg-node is-gold"><span class="ni">💾</span><span class="nl">etcd snapshot</span><span class="ns">+ status se verify</span></div>
          <div class="dg-arrow flow"></div>
          <div class="dg-node is-accent"><span class="ni">🧠</span><span class="nl">Control plane</span><span class="ns">kubeadm upgrade apply</span></div>
          <div class="dg-arrow flow"></div>
          <div class="dg-node is-accent"><span class="ni">🖥️</span><span class="nl">Worker (ek-ek)</span><span class="ns">drain → upgrade node → uncordon</span></div>
        </div>
      </div>
    </div>
    <div class="dg-cap">Niyam: <b>kubelet API server se zyada naya kabhi nahi</b> ho sakta, isliye control plane hamesha pehle. Aur <code>drain</code> Eviction API se chalta hai (PDB maanta hai) jabki <code>delete pod</code> PDB ko poori tarah ignore karta hai.</div>`,
};

VISUALS['kk-certs'] = {
  t: 'kubeconfig ke teen hisse, aur 401 vs 403',
  html: `
    <div class="dg-split">
      <div class="dg-box is-accent"><span class="bx-label">📄 kubeconfig</span>
        <div class="dg-col">
          <div class="dg-node is-accent"><span class="ni">🏛️</span><span class="nl">clusters</span><span class="ns">server URL + CA</span></div>
          <div class="dg-node is-gold"><span class="ni">🧑</span><span class="nl">users</span><span class="ns">client cert (CN=user, O=group)</span></div>
          <div class="dg-node is-good"><span class="ni">🔗</span><span class="nl">contexts</span><span class="ns">kaun + kahan + kis namespace</span></div>
        </div>
      </div>
      <div class="dg-box is-bad"><span class="bx-label">🚦 Error ka code = toota hua padav</span>
        <div class="dg-col">
          <div class="dg-rung"><span class="dg-pill bad">x509 expired</span><div class="dg-arrow flow"></div><span class="dg-pill">kubeadm certs renew all</span></div>
          <div class="dg-rung"><span class="dg-pill bad">unknown authority</span><div class="dg-arrow flow"></div><span class="dg-pill">CA galat hai</span></div>
          <div class="dg-rung"><span class="dg-pill bad">401</span><div class="dg-arrow flow"></div><span class="dg-pill">pehchaan hi nahi bani</span></div>
          <div class="dg-rung"><span class="dg-pill gold">403</span><div class="dg-arrow flow"></div><span class="dg-pill good">pehchaan ban gayi — RBAC chahiye</span></div>
        </div>
      </div>
    </div>
    <div class="dg-cap"><b>Certificate = pehchaan, RBAC = ijaazat</b> — hamesha do alag kadam. <code>403 Forbidden</code> asli mein achhi khabar hai: iska matlab certificate poori tarah kaam kar raha hai. Aur certificate expire hone par <b>applications chalti rehti hain</b> — sirf admin ki pahunch rukti hai.</div>`,
};

VISUALS['kk-hardening'] = {
  t: 'Teen alag layer, teen alag cheez rokte hain',
  html: `
    <div class="dg-col">
      <div class="dg-split">
        <div class="dg-node is-accent"><span class="ni">🎖️</span><span class="nl">capabilities</span><span class="ns">root ke ADHIKAR ke tukde</span></div>
        <div class="dg-node is-gold"><span class="ni">🧬</span><span class="nl">seccomp</span><span class="ns">kaunse SYSCALLS allowed</span></div>
        <div class="dg-node is-good"><span class="ni">📁</span><span class="nl">AppArmor</span><span class="ns">kaunse FILE PATHS</span></div>
      </div>
      <div class="dg-down"></div>
      <div class="dg-box is-bad"><span class="bx-label">⚠️ Kubernetes ke defaults</span>
        <div class="dg-col">
          <span class="dg-pill bad">seccompProfile: <b>Unconfined</b> — koi bhi syscall</span>
          <span class="dg-pill bad">14 Linux capabilities pehle se lagi hui</span>
          <span class="dg-pill bad">container root ban ke chal sakta hai</span>
        </div>
      </div>
      <div class="dg-down"></div>
      <div class="dg-box is-good"><span class="bx-label">✅ restricted-compliant spec</span>
        <div class="dg-col">
          <span class="dg-pill good">runAsNonRoot: true · runAsUser: 10001</span>
          <span class="dg-pill good">allowPrivilegeEscalation: false</span>
          <span class="dg-pill good">capabilities.drop: ["ALL"]</span>
          <span class="dg-pill good">seccompProfile.type: RuntimeDefault</span>
          <span class="dg-pill good">readOnlyRootFilesystem: true</span>
        </div>
      </div>
    </div>
    <div class="dg-cap">Ek line ka sabse bada faayda: <code>seccompProfile: RuntimeDefault</code> — default <b>Unconfined</b> hoti hai, yaani container kernel se koi bhi syscall kar sakta hai. Aur <b>policy girana kabhi fix nahi hota</b>: exception chahiye to alag namespace banao.</div>`,
};

VISUALS['kk-boss'] = {
  t: 'Teen bimari, ek cluster — lakshan vs karan',
  html: `
    <div class="dg-col">
      <div class="dg-split">
        <div class="dg-box is-bad"><span class="bx-label">⏳ Pending × 3</span>
          <div class="dg-col"><span class="dg-pill bad">endpoints: none</span><span class="dg-pill acc">describe pod → FailedScheduling</span><span class="dg-pill good">karan: 16Gi memory request</span></div>
        </div>
        <div class="dg-box is-bad"><span class="bx-label">💥 CrashLoopBackOff</span>
          <div class="dg-col"><span class="dg-pill bad">endpoints: none</span><span class="dg-pill acc">logs --previous</span><span class="dg-pill good">karan: missing env var</span></div>
        </div>
        <div class="dg-box is-bad"><span class="bx-label">✅ Running 1/1, par purana data</span>
          <div class="dg-col"><span class="dg-pill good">endpoints bhare hain</span><span class="dg-pill acc">exec printenv vs get cm</span><span class="dg-pill good">karan: stale ConfigMap</span></div>
        </div>
      </div>
      <div class="dg-down"></div>
      <div class="dg-node is-gold pulse"><span class="ni">🪤</span><span class="nl">Do jagah "endpoints: none" — par selector bilkul theek hai</span><span class="ns">endpoints khaali the kyunki koi READY pod hi nahi tha</span></div>
    </div>
    <div class="dg-cap">Teen alag status = teen alag raaste. Aur sabse bada jaal: <b>khaali endpoints ek lakshan hai, karan nahi</b>. Pods theek hote hi endpoints apne aap bhar jaate hain — Service ko chhuna padta hi nahi.</div>`,
};

/* ================= GAP LEVELS (data-gaps.js) ================= */

VISUALS['priority'] = {
  t: 'Preemption vs Eviction — do alag mechanism',
  html: `
    <div class="dg-split">
      <div class="dg-box is-accent"><span class="bx-label">⚔️ Preemption — SCHEDULER karta hai</span>
        <div class="dg-col">
          <div class="dg-node is-accent"><span class="ni">⚖️</span><span class="nl">Scheduler</span><span class="ns">high-priority pod Pending hai</span></div>
          <div class="dg-arrow flow"></div>
          <span class="dg-pill acc">dekhta hai: <b>PriorityClass value</b></span>
          <span class="dg-pill">sabse KAM priority wale pods hataata hai</span>
          <div class="dg-arrow good"></div>
          <span class="dg-pill good">bachav: high PriorityClass</span>
        </div>
      </div>
      <div class="dg-box is-gold"><span class="bx-label">🚪 Eviction — KUBELET karta hai</span>
        <div class="dg-col">
          <div class="dg-node is-gold"><span class="ni">🤖</span><span class="nl">kubelet</span><span class="ns">node par memory/disk khatam</span></div>
          <div class="dg-arrow flow"></div>
          <span class="dg-pill gold">dekhta hai: <b>QoS class</b></span>
          <div class="dg-ladder">
            <div class="dg-rung"><span class="dg-pill bad">1️⃣ BestEffort</span><span class="dg-pill">oom_score_adj 1000</span></div>
            <div class="dg-rung"><span class="dg-pill bad">2️⃣ Burstable jo request se zyada use kare</span></div>
            <div class="dg-rung"><span class="dg-pill">3️⃣ baaki Burstable</span></div>
            <div class="dg-rung"><span class="dg-pill good">4️⃣ Guaranteed</span><span class="dg-pill good">oom_score_adj −997</span></div>
          </div>
          <span class="dg-pill good">bachav: requests = limits</span>
        </div>
      </div>
    </div>
    <div class="dg-cap">Sabse aam galti: priority badha ke eviction se bachne ki koshish. <b>kubelet priority dekhta hi nahi</b> — kubelet QoS dekhta hai. <b>QoS = kubelet se bachav, priority = scheduler se bachav.</b> Dono chahiye to dono set karo.</div>`,
};

VISUALS['admission'] = {
  t: 'kubectl apply se etcd tak — chhe darwaze',
  html: `
    <div class="dg-flow">
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">💻</span><span class="nl">kubectl apply</span></div>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">🪪</span><span class="nl">1. Authentication</span><span class="ns">tum kaun ho</span></div>
        <span class="dg-pill bad">fail → 401</span>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">🔐</span><span class="nl">2. Authorization</span><span class="ns">RBAC</span></div>
        <span class="dg-pill bad">fail → 403</span>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-gold pulse"><span class="ni">✏️</span><span class="nl">3. MUTATING</span><span class="ns">object BADAL sakta hai</span></div>
        <span class="dg-pill gold">ServiceAccount jodo</span>
        <span class="dg-pill gold">LimitRanger ke defaults</span>
        <span class="dg-pill gold">Kyverno mutate / Istio sidecar</span>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-accent"><span class="ni">📐</span><span class="nl">4. Schema</span><span class="ns">OpenAPI check</span></div>
        <span class="dg-pill bad">fail → unknown field</span>
      </div>
      <div class="dg-arrow flow"></div>
      <div class="dg-col">
        <div class="dg-node is-gold pulse"><span class="ni">🚦</span><span class="nl">5. VALIDATING</span><span class="ns">sirf haan / na</span></div>
        <span class="dg-pill">PodSecurity</span>
        <span class="dg-pill">ValidatingAdmissionPolicy</span>
        <span class="dg-pill bad">fail → webhook denied</span>
      </div>
      <div class="dg-arrow good"></div>
      <div class="dg-node is-good"><span class="ni">📔</span><span class="nl">6. etcd</span></div>
    </div>
    <div class="dg-cap"><b>Mutating pehle, validating baad mein</b> — isliye ek policy pehle <code>seccompProfile</code> daal sakti hai aur uske baad PodSecurity usi field ko check karke pass kar deti hai. Aur isliye <code>kubectl get -o yaml</code> hamesha tumhare bheje manifest se bada dikhta hai.</div>`,
};
