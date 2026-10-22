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
