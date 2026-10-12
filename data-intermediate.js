/* =====================================================================
   KubeGurukul — Track 2: 🔥 Intermediate (Sadhak Path)
   Production ki asli duniya — jahan outages hote hain.
   ===================================================================== */

KG.registerLevels('intermediate', [

  /* ================= LEVEL 9: Scheduler, Requests/Limits, QoS ================= */
  {
    id: 'scheduler',
    icon: '⚖️',
    title: 'Scheduler, Requests & Limits — OOMKilled ki Kahani',
    badge: 'QoS Qazi',
    objectives: [
      'Scheduler kaise node chunta hai (filter → score)',
      '<b>Requests vs Limits</b> — production outages ka #1 reason',
      'QoS classes: <b>Guaranteed / Burstable / BestEffort</b> — aur eviction order',
      'OOMKilled (exit code 137) ko pehchan\'na aur theek karna (terminal!)',
    ],
    lesson: [
      `<h3>⚖️ Scheduler ka 2-step dance</h3>
       <pre>Naya pod (requests: cpu 500m, memory 256Mi)
  1. FILTER: kaunse nodes par chal SAKTA hai?
     ✗ node-1 — memory bachi nahi   ✗ node-2 — taint hai
     ✓ node-3, node-4
  2. SCORE: bache huon mein BEST kaun? (kam bhara hua, spread...)
     🏆 node-3</pre>
       <p>Important: Scheduler <b>requests</b> dekhta hai, asli usage NAHI! Node par 90% RAM
       free ho, par requests ka hisaab full ho — pod <b>Pending</b> rahega. Aur ulta bhi:
       requests chhote rakhe, sab ek node par thus gaye — node phat gaya. 💥</p>`,
      `<h3>💣 Requests vs Limits — yahin outages bante hain</h3>
       <table>
         <tr><th></th><th>requests</th><th>limits</th></tr>
         <tr><td>Kya hai</td><td>"Itna toh chahiye" — <b>scheduling ka waada</b></td><td>"Isse zyada nahi" — <b>hadd</b></td></tr>
         <tr><td>CPU paar kiya</td><td>—</td><td><b>Throttle</b> (slow, par zinda)</td></tr>
         <tr><td>Memory paar ki</td><td>—</td><td><b>OOMKilled</b> 💀 (exit code 137, turant maut)</td></tr>
       </table>
       <p>QoS class in dono ke combination se banti hai (diagram dekho):
       <b>Guaranteed</b> (req==lim) → <b>Burstable</b> (req&lt;lim) → <b>BestEffort</b> (kuch nahi set).
       Node ki memory bharne par kubelet <b>isi ulte order mein evict</b> karta hai.</p>
       <div class="war-story"><b>⚡ Real incident (industry-famous pattern):</b> Ek team ne naye
       microservice par requests/limits lagana skip kiya ("chhota sa toh hai"). Memory leak
       aayi → BestEffort hone ki wajah se kubelet ne pehle USI ko maara — par tab tak node
       pressure mein aa chuka tha, aur usne 2 aur pods evict kiye. Woh pods doosre nodes par
       gaye, WAHAN pressure — <b>eviction cascade</b>, aadha cluster domino ki tarah gira.
       Ek missing <code>resources:</code> block = multi-service outage. Ab samjhe yeh
       "most common cause of production outages" kyun hai?</div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'QoS Class Batao',
        instructions: 'Har pod spec ko uski QoS class mein daalo. (Eviction order yaad rakhna!)',
        bins: [
          { id: 'guaranteed', label: '🥇 Guaranteed' },
          { id: 'burstable', label: '🥈 Burstable' },
          { id: 'besteffort', label: '🥉 BestEffort' },
        ],
        items: [
          { text: 'req: 500m/512Mi · lim: 500m/512Mi', bin: 'guaranteed', explain: 'requests == limits (dono resources par) = Guaranteed. Eviction mein sabse aakhri number. DBs ke liye yahi chahiye.' },
          { text: 'req: 250m/256Mi · lim: 1000m/1Gi', bin: 'burstable', explain: 'requests < limits = Burstable — zyada le sakta hai jab free ho, par pressure mein Guaranteed se pehle katega.' },
          { text: 'resources: {} (kuch nahi likha)', bin: 'besteffort', explain: 'Kuch set nahi = BestEffort = memory pressure mein PEHLA shikaar. Production mein yeh dikhe toh PR reject!' },
          { text: 'sirf limits: 500m/512Mi (requests nahi)', bin: 'guaranteed', explain: 'Gotcha! Sirf limits do toh K8s requests=limits set kar deta hai → Guaranteed ban jaata hai.' },
          { text: 'sirf requests: 100m/128Mi (limits nahi)', bin: 'burstable', explain: 'Requests hain par limits nahi = Burstable. Memory unlimited badh sakti hai — node ke liye khatra!' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Pending aur OOMKilled — Double Trouble',
        instructions: 'Do bimaar pods, do alag bimariyan. Dono ka sahi ilaaj karo.',
        goal: '<b>api</b> pod baar-baar <b>OOMKilled</b> ho raha hai aur <b>batch</b> pod <b>Pending</b> mein atka hai. Dono ki root cause nikalo (describe!) aur sahi fixes apply karo (<code>ls</code>).',
        tasks: [
          { text: 'api ke restarts ki wajah nikaalo (describe → exit code)', check: s => s.history.some(h => /^(kubectl|k) describe (pod|pods|po) api/.test(h)) },
          { text: 'batch Pending kyun hai (describe → Events)', check: s => s.history.some(h => /^(kubectl|k) describe (pod|pods|po) batch/.test(h)) },
          { text: 'Dono pods Running + stable karo', check: s => s.cluster.pods.every(p => p.status === 'Running') },
        ],
        cluster: {
          nodes: [
            { name: 'node-1', status: 'Ready', roles: '<none>', age: '60d', version: 'v1.30.2', top: '55% 78%' },
            { name: 'node-2', status: 'Ready', roles: '<none>', age: '60d', version: 'v1.30.2', top: '48% 81%' },
          ],
          pods: [
            {
              name: 'api-7b8c9d-qq1', ready: '0/1', status: 'CrashLoopBackOff', restarts: 7, age: '40m', node: 'node-1', ip: '10.244.1.40', top: '120m 254Mi',
              logs: '[api] processing large report...\n(logs achanak khatam — bina error ke. Suspicious! 🤔)',
              prevLogs: '[api] processing large report...\n[api] allocating buffer...\n(kill -9 jaisa cut — OOM kill mein app ko bolne ka mauka nahi milta)',
              describe: 'Name:         api-7b8c9d-qq1\nStatus:       Running (crash-looping)\nLimits:       memory: 256Mi\nRequests:     memory: 256Mi\n\nLast State:   Terminated\n  Reason:     OOMKilled        ← 💀\n  Exit Code:  137              ← 128 + 9 (SIGKILL)\n\nEvents:\n  Warning  BackOff  2m (x12)  Back-off restarting failed container',
            },
            {
              name: 'batch-5x6y7z-ww2', ready: '0/1', status: 'Pending', restarts: 0, age: '15m', node: '<none>', ip: '<none>',
              logs: 'Error from server (BadRequest): container not started — pod Pending hai, logs hote hi nahi!',
              describe: 'Name:      batch-5x6y7z-ww2\nStatus:    Pending\nRequests:  cpu: 16, memory: 64Gi   ← 👀 zara requests toh dekho\n\nEvents:\n  Warning  FailedScheduling  1m (x8)  0/2 nodes are available:\n    2 Insufficient cpu, 2 Insufficient memory.',
            },
          ],
          deployments: [
            { name: 'api', ready: '0/1', upToDate: 1, available: 0, age: '40m' },
            { name: 'batch', ready: '0/1', upToDate: 1, available: 0, age: '15m' },
          ],
          services: [],
        },
        files: {
          'fix-api-memory.yaml': {
            desc: 'api ki memory limit 256Mi → 768Mi (requests bhi)',
            apply: s => {
              const p = s.cluster.pods.find(p => p.name.startsWith('api'));
              p.status = 'Running'; p.ready = '1/1';
              p.logs = '[api] processing large report...\n[api] report done (peak memory: 610Mi) ✓\n[api] serving on :8080';
              p.describe = p.describe.replace(/memory: 256Mi/g, 'memory: 768Mi');
              s.cluster.deployments.find(d => d.name === 'api').ready = '1/1';
              return 'deployment.apps/api configured\n(limit 768Mi hua... naya pod... report process hua bina OOM ke ✓)\n\n💡 Asli zindagi mein: pehle "kubectl top pod" se PEAK usage naapte, phir limit uske upar rakhte.';
            },
          },
          'fix-batch-requests.yaml': {
            desc: 'batch ki requests 16cpu/64Gi → 2cpu/4Gi (realistic)',
            apply: s => {
              const p = s.cluster.pods.find(p => p.name.startsWith('batch'));
              p.status = 'Running'; p.ready = '1/1'; p.node = 'node-2'; p.ip = '10.244.2.50';
              p.logs = '[batch] started on node-2\n[batch] processing queue...';
              s.cluster.deployments.find(d => d.name === 'batch').ready = '1/1';
              return 'deployment.apps/batch configured\n(requests 2cpu/4Gi hue... Scheduler: node-2 fit hai! ✓ Running)';
            },
          },
          'fix-restart-all.yaml': {
            desc: 'Dono deployments restart karta hai',
            apply: () => 'restarted\n(api phir OOMKilled — limit wahi 256Mi. batch phir Pending — requests wahi 64Gi. Restart config nahi badalta, kabhi nahi!)',
          },
        },
        success: s => s.cluster.pods.every(p => p.status === 'Running') && s.history.some(h => /^(kubectl|k) describe/.test(h)),
        successText: 'Dono theek! 🎉 Do patterns hamesha yaad: <b>(1) Exit code 137 / Reason: OOMKilled</b> = memory limit paar — logs mein kuch nahi milega (SIGKILL bolne ka mauka nahi deta), describe mein milega. Fix = limit realistic karo (ya leak fix karo!). <b>(2) Pending + "Insufficient cpu/memory"</b> = requests itne bade ki koi node fit nahi. Scheduler REQUESTS dekhta hai, real usage nahi.',
        hints: [
          'kubectl describe pod api → "Last State: Terminated, Reason: OOMKilled, Exit Code: 137"',
          'kubectl describe pod batch → Events: "Insufficient cpu, Insufficient memory" — requests hi pagal hain (16 CPU, 64Gi!)',
          'api ko badi limit chahiye (fix-api-memory.yaml), batch ko chhoti requests (fix-batch-requests.yaml)',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — CPU vs Memory ka farak',
        questions: [
          {
            q: 'CPU limit paar karne par throttle, par memory limit paar karne par KILL kyun?',
            choices: [
              'CPU "compressible" hai (thoda kam do, app slow chalegi) — memory "incompressible" hai (wapas nahi le sakte, sirf process maar sakte ho)',
              'Kubernetes ka bug hai, dono kill hone chahiye',
              'Memory sasta hai isliye',
              'CPU limits optional hote hain isliye',
            ],
            answer: 0,
            explain: 'Fundamental systems concept: CPU time slice karke kam de sakte ho; allocated memory chheen nahi sakte. Isliye memory overflow = OOMKill hi ekmatra option. Interview mein yeh reasoning bolo — instant respect.',
          },
          {
            q: 'Exit code 137 ka exact matlab?',
            choices: [
              '128 + 9 = SIGKILL mila — 99% cases mein OOMKilled',
              'App ne khud exit(137) kiya',
              'Image corrupt thi',
              'Network timeout hua',
            ],
            answer: 0,
            explain: '128 + signal number. 137 = 128+9 (SIGKILL → OOM killer), 143 = 128+15 (SIGTERM → graceful shutdown). Yeh do numbers yaad rakho, debugging mein baar-baar dikhenge.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Resources & QoS',
      instructions: 'Yeh topic = "most common cause of production outages". Interviewer ki favourite. 🎤',
      questions: [
        {
          q: '"Pod repeatedly OOMKilled ho raha hai — investigate kaise karoge? Kya memory badhana hamesha sahi hai?" (Screenshot Q6!)',
          choices: [
            'describe se OOMKilled confirm, metrics/top se usage pattern dekho — STEADY growth = leak (fix code!), spiky legit peak = limit badhao. Andha limit badhana leak ko sirf postpone karta hai',
            'Haan — memory badha do, problem khatam',
            'Pod delete karke naya banao',
            'Liveness probe hata do taaki restart na ho',
          ],
          answer: 0,
          explain: 'Interviewer nuance dhundh raha hai: OOMKill ka fix "limit++" NAHI hai by default. Leak ho toh badi limit sirf crash ka time badhaati hai (aur node ke doosre pods ko risk mein daalti hai). Data dekho, phir decide.',
        },
        {
          q: '"Requests aur Limits scheduling aur runtime ko kaise affect karte hain?" (Screenshot Q13!)',
          choices: [
            'Requests sirf SCHEDULING mein (Scheduler unhi ka hisaab karta hai); Limits sirf RUNTIME mein (CPU throttle / memory OOMKill). Dono milke QoS class banate hain',
            'Dono scheduling mein use hote hain',
            'Requests runtime enforce hote hain, limits scheduling mein',
            'Yeh sirf billing/reporting ke liye hain',
          ],
          answer: 0,
          explain: 'Crisp divide: requests = placement-time promise, limits = runtime-enforcement. Aur bonus line: "requests galat → Pending ya overpacked nodes; limits galat → throttling ya OOMKill" — yeh ek line mein poora topic hai.',
        },
        {
          q: 'Node par memory pressure hai. Kubelet kis order mein pods evict karega?',
          choices: [
            'Pehle BestEffort, phir Burstable (jo request se zyada use kar rahe), aakhri mein Guaranteed',
            'Random order mein',
            'Sabse naye pods pehle',
            'Sabse bade pods pehle, QoS se koi matlab nahi',
          ],
          answer: 0,
          explain: 'QoS = eviction priority. Isliye critical services (DB, payment) ko Guaranteed rakhte hain — requests == limits. Aur isliye "resources: {}" wala pod production mein time-bomb hai.',
        },
      ],
    },
    success: [
      'Main requests vs limits ka scheduling/runtime farak samjha sakta hoon',
      'Main kisi bhi pod spec ki QoS class bata sakta hoon',
      'Main OOMKilled (137) aur Pending (FailedScheduling) dono debug kar sakta hoon',
      'Main eviction cascade jaisa outage explain kar sakta hoon',
    ],
    homework: `<p>OOMKill ko live dekho:</p>
      <pre>kubectl run oom-test --image=polinux/stress --restart=Never \\
  --limits=memory=100Mi --requests=memory=100Mi \\
  -- stress --vm 1 --vm-bytes 250M --vm-hang 1
kubectl get pods -w                    # OOMKilled aayega!
kubectl describe pod oom-test | grep -A3 "Last State"   # 137!
kubectl delete pod oom-test</pre>
      <p>✅ Self-check: "Reason: OOMKilled, Exit Code: 137" dikha? Ab yeh kabhi nahi bhoologe.</p>`,
    cards: [
      { front: 'Requests vs Limits — ek line mein?', back: '<b>Requests</b> = scheduling ka waada (Scheduler inhi se node chunta hai). <b>Limits</b> = runtime hadd (CPU → throttle, memory → <b>OOMKill</b>). #1 production outage topic!' },
      { front: 'QoS classes aur eviction order?', back: '<b>Guaranteed</b> (req==lim) &gt; <b>Burstable</b> (req&lt;lim) &gt; <b>BestEffort</b> (kuch nahi). Memory pressure par kubelet ULTA order mein evict karta hai — BestEffort pehle katega.' },
      { front: 'Exit code 137 dikha — kya hua, kahan dekhoge?', back: '137 = 128+9 = SIGKILL = <b>OOMKilled</b> (memory limit paar). Logs mein KUCH NAHI milega — <code>describe pod</code> → Last State → Reason dekho.' },
      { front: 'Pod Pending + "Insufficient cpu/memory" — kya matlab?', back: 'Requests ka hisaab kisi node par fit nahi (asli free RAM se koi matlab nahi — Scheduler REQUESTS ginta hai). Fix: requests realistic karo ya nodes badhao.' },
      { front: 'OOMKill par memory badhana kab GALAT hai?', back: 'Jab memory <b>steadily badh rahi ho</b> = leak — badi limit sirf crash postpone karti hai. Spiky-but-legit peak ho tabhi limit badhao. Pehle usage data dekho!' },
    ],
  },

  /* ================= LEVEL 10: Health Probes ================= */
  {
    id: 'probes',
    icon: '🩺',
    title: 'Health Probes — Liveness, Readiness, Startup',
    badge: 'Probe Praveen',
    objectives: [
      'Teen probes ke teen alag sawal — aur teen alag consequences',
      'Readiness ka endpoints se rishta (Track 1 ka "READY 0/1" mystery solved!)',
      'Galat probe = khud banaya outage — real patterns',
      'Slow-start apps ke liye startup probe',
    ],
    lesson: [
      `<h3>🩺 Teen probes = teen sawal</h3>
       <table>
         <tr><th>Probe</th><th>Sawal</th><th>Fail hua toh</th><th>Galat config ka natija</th></tr>
         <tr><td>🐣 <b>Startup</b></td><td>"Boot COMPLETE hua?"</td><td>Intezaar (baaki probes ruke rehte hain)</td><td>Na ho + slow app = liveness usse boot ke beech maar deta hai 🔁</td></tr>
         <tr><td>🚦 <b>Readiness</b></td><td>"ABHI traffic le sakta hoon?"</td><td>Endpoints se bahar (traffic band, container zinda)</td><td>Na ho = booting/overloaded pod ko traffic → errors</td></tr>
         <tr><td>💓 <b>Liveness</b></td><td>"Zinda hoon ya deadlock?"</td><td>Container RESTART</td><td>Galat/aggressive = healthy pods ka restart-loop 💀</td></tr>
       </table>
       <p><b>Track 1 ka loose end:</b> "Running par READY 0/1" = readiness probe fail.
       Ab poora circle samajh aaya — READY column probes se aata hai, aur endpoints
       membership READY se!</p>`,
      `<h3>⚙️ Config anatomy (yeh numbers interview mein pooche jaate hain)</h3>
       <pre>readinessProbe:
  httpGet: { path: /healthz, port: 8080 }
  initialDelaySeconds: 5    # pehla check kab
  periodSeconds: 10         # kitni baar
  failureThreshold: 3       # kitne fails ke baad action
livenessProbe:
  httpGet: { path: /healthz, port: 8080 }
  periodSeconds: 20         # readiness se DHEEMA rakho!
startupProbe:
  httpGet: { path: /healthz, port: 8080 }
  failureThreshold: 30      # 30 × 10s = 5 min tak boot ka intezaar</pre>
       <div class="war-story"><b>⚡ Real incident (readiness ka classic):</b> Ek team ki JVM
       app boot mein 90 second leti thi. Readiness probe tha hi nahi — deploy hote hi K8s ne
       naye pods ko endpoints mein daal diya, purane hata diye. 90 second tak <b>har request
       503</b>. Har deploy = mini-outage, mahino tak "deploy Friday ko mat karo" culture bana
       raha. Fix: 4 line ka readiness probe. 🤦<br><br>
       <b>⚡ Aur ulta case (liveness ka jaal):</b> Liveness probe <code>/health</code> DB ko
       ping karta tha. DB slow hua → liveness fail → K8s ne SAARI healthy app pods restart kar
       di → thundering herd → aur bada outage. <b>Seekh: liveness sirf apni process ki health
       check kare, dependencies ki NAHI.</b></div>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Kaunsa Probe, Kaunsa Anjaam?',
        instructions: 'Har situation ko sahi probe/behaviour se milao.',
        pairs: [
          { left: 'App boot mein 3 min leti hai', right: 'startupProbe (failureThreshold × period = boot window)', explain: 'Startup probe pass hone tak liveness/readiness ruke rehte hain — slow apps ki jaan bachti hai.' },
          { left: 'Pod overloaded — thodi der traffic mat do', right: 'readinessProbe fail → endpoints se bahar, RESTART nahi', explain: 'Readiness = traffic ka switch. Container chalta rehta hai, saans lene ka time milta hai, ready hote hi wapas.' },
          { left: 'App deadlock — thread atka, kabhi recover nahi hoga', right: 'livenessProbe fail → container restart', explain: 'Restart hi ilaaj hai deadlock ka. YEHI ek case hai jahan liveness hero hai.' },
          { left: 'Liveness /health DB ping karta hai, DB gira', right: 'Saare healthy pods restart — self-inflicted outage 💀', explain: 'Anti-pattern! Liveness mein sirf APNI process check karo. DB down par app pods maarne se DB wapas nahi aata — load aur badhta hai.' },
          { left: 'READY 0/1 par STATUS Running', right: 'Readiness fail ho raha hai — traffic nahi milega', explain: 'Track 1 ka mystery ab officially solved. get endpoints karo — yeh pod list mein nahi hoga.' },
        ],
      },
      {
        type: 'fill',
        title: 'Probes Likho',
        instructions: 'JVM app: boot 90s tak, /healthz par health endpoint, port 8080. Sahi probes banao.',
        template: 'containers:\n- name: api\n  image: shop/api:3.1\n  startupProbe:\n    httpGet: {{ path: /healthz, port: 8080 }}\n    periodSeconds: 10\n    failureThreshold: {0}     # 10s × yeh = max boot window\n  readinessProbe:\n    httpGet: {{ path: {1}, port: 8080 }}\n    periodSeconds: 10\n    failureThreshold: 3\n  livenessProbe:\n    httpGet: {{ path: /healthz, port: 8080 }}\n    periodSeconds: {2}       # readiness se dheema\n    failureThreshold: 3',
        blanks: [
          { answer: '12', explain: '12 × 10s = 120s window — 90s boot ke liye aaram se kaafi, thoda buffer bhi. (30s window rakhte toh boot ke beech maut!)' },
          { answer: '/healthz', explain: 'App ka health endpoint. Pro-tip: readiness mein "dependencies ready?" check chalega, par liveness mein sirf "main zinda hoon?".' },
          { answer: '20', explain: 'Liveness ko readiness se conservative rakho — restart bada hathoda hai, halki si dikkat par nahi chalana chahiye.' },
        ],
        tokens: ['12', '/healthz', '20', '3', '/index.html', '1', '99', '/metrics'],
      },
      {
        type: 'incident',
        title: '🚨 Har Deploy Par 503s!',
        instructions: 'Readiness wala war-story — ab tum ho decision seat par.',
        pager: '<b>ALERT:</b> checkout 503 spike — HAR DEPLOY ke baad exactly ~90 second · pattern 5 deploys se repeat',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ kubectl get pods\ncheckout-new-aaa   1/1  Running  0  30s   ← naya (READY?!)\ncheckout-new-bbb   1/1  Running  0  28s\n\n$ kubectl describe pod checkout-new-aaa | grep -i probe\n(no probes configured)',
            text: 'Naye pods turant 1/1 READY dikhte hain, phir bhi 90s tak 503. Root cause kya hai?',
            choices: [
              { t: 'Readiness probe hai hi nahi — K8s ko boot ka pata nahi, booting pods ko turant traffic de raha hai', good: true, next: 'n2', explain: 'Bilkul! Bina readiness ke "container started" == "READY" maan liya jaata hai. App 90s boot leti hai — us window mein saare requests 503.' },
              { t: 'Network slow hai, CNI ka issue hoga', good: false, explain: 'Network hota toh pattern random hota — yahan EXACTLY deploy ke baad, EXACTLY ~90s (app ka boot time!). Pattern hi clue hai.' },
              { t: 'Replicas kam hain, badha do', good: false, explain: 'Zyada replicas = zyada booting pods = zyada 503 sources. Ulta effect!' },
            ],
          },
          n2: {
            text: 'Fix design karo — sabse sahi combination?',
            choices: [
              { t: 'readinessProbe (/healthz) + startupProbe (12×10s window) add karke redeploy', good: true, next: 'end', explain: 'Readiness = boot ke waqt traffic band; startup = slow boot ka buffer. Ab rolling update mein naya pod tabhi endpoints mein aayega jab SACH mein ready hoga.' },
              { t: 'Deploy ke baad script se 90s sleep karke phir traffic on karna', good: false, explain: 'Jugaad — aur fragile (boot 120s ho gaya toh?). K8s ke paas iska FIRST-CLASS solution hai: probes. Platform se lado mat, use karo.' },
              { t: 'livenessProbe lagao periodSeconds: 5 ke saath', good: false, explain: 'Khatarnak! Boot 90s + aggressive liveness = boot ke BEECH restart → CrashLoop jaisa pattern. Liveness traffic control karta hi nahi — yeh readiness ka kaam hai.' },
            ],
          },
          end: {
            end: true,
            text: 'Deploy-time 503s khatam — hamesha ke liye! 🧯',
            summary: '<b>Pattern yaad rakho:</b> "har deploy par thodi der errors" ≈ readiness missing/galat. Probes deploy ke pehle socho, baad mein nahi. Aur liveness hamesha conservative — woh hathoda hai, screwdriver nahi.',
          },
        },
      },
    ],
    interview: {
      title: 'Interview Round — Probes',
      instructions: 'Screenshot Q4: "Explain probes with real production examples" — full marks lo. 🎤',
      questions: [
        {
          q: 'Liveness vs Readiness — sabse important operational farak?',
          choices: [
            'Liveness fail = container RESTART hota hai; Readiness fail = sirf traffic rukta hai (endpoints se bahar), container chalta rehta hai',
            'Liveness pehle chalta hai, readiness baad mein — bas timing ka farak',
            'Liveness HTTP hota hai, readiness TCP',
            'Dono same hain, naam alag',
          ],
          answer: 0,
          explain: 'Consequence hi farak hai: restart vs traffic-pause. Follow-up ke liye taiyar raho: "isliye DB-dependency check readiness mein OK hai (traffic roko), liveness mein DISASTER hai (mass restart)".',
        },
        {
          q: 'Slow-boot app (2 min) ke liye startup probe kyun, sirf initialDelaySeconds kyun nahi?',
          choices: [
            'startupProbe pass hote hi baaki probes turant active — fast boot par bhi jaldi coverage; initialDelay fixed andha intezaar hai, aur boot time badla toh phir tootega',
            'initialDelaySeconds deprecated ho chuka hai',
            'startupProbe zyada naya hai isliye',
            'Dono bilkul same kaam karte hain',
          ],
          answer: 0,
          explain: 'startupProbe adaptive hai: 30s mein boot hua toh 30s baad hi liveness shuru; 110s laga toh bhi covered. initialDelay=120 hamesha 120 barbaad karta hai aur 121s boot par fail. Yeh nuance senior-level jawab hai.',
        },
        {
          q: 'Deploy ke doraan purane pods READY the, naye aa rahe hain. Rolling update kab purana pod hataata hai?',
          choices: [
            'Jab naya pod READINESS pass kar leta hai (endpoints mein aa jaata hai) — isliye readiness hi zero-downtime ki chaabi hai',
            'Naya pod schedule hote hi',
            'Container start hote hi',
            'Fixed 30 second baad',
          ],
          answer: 0,
          explain: 'maxUnavailable ka hisaab READY pods se hota hai. Readiness nahi toh "started" = "ready" maan ke purane jaldi kat jaate hain → 503 window. Probes + rolling update ka yeh rishta interview gold hai.',
        },
      ],
    },
    success: [
      'Main teeno probes ke sawal, consequence, aur failure modes bata sakta hoon',
      'Main slow-boot app ke liye sahi probe combo design kar sakta hoon',
      'Main liveness-checks-DB jaisa anti-pattern pehchan sakta hoon',
      'Main "har deploy par errors" ka root cause turant bol sakta hoon',
    ],
    homework: `<p>Probes ke fields khudai karo aur ek probe-wala pod banao:</p>
      <pre>kubectl explain pod.spec.containers.readinessProbe   # saare fields!

kubectl apply -f - &lt;&lt;EOF
apiVersion: v1
kind: Pod
metadata: { name: probed }
spec:
  containers:
  - name: web
    image: nginx
    readinessProbe:
      httpGet: { path: /, port: 80 }
      periodSeconds: 5
    livenessProbe:
      httpGet: { path: /, port: 80 }
      periodSeconds: 15
EOF
kubectl get pod probed -w      # READY 0/1 → 1/1 transition dekho!
kubectl delete pod probed</pre>
      <p>✅ Self-check: READY 0/1 se 1/1 hote dekha? Woh transition = readiness pass hona.</p>`,
    cards: [
      { front: 'Teen probes — sawal aur consequence?', back: '🐣 <b>Startup</b>: "boot hua?" — fail = intezaar. 🚦 <b>Readiness</b>: "traffic doon?" — fail = endpoints se bahar. 💓 <b>Liveness</b>: "zinda ho?" — fail = RESTART.' },
      { front: 'Liveness probe mein DB check karna kyun disaster hai?', back: 'DB gira → saare pods ka liveness fail → K8s SAARI healthy pods restart karega → thundering herd → bada outage. Liveness sirf APNI process; dependency checks readiness mein.' },
      { front: '"Har deploy ke baad ~90s errors" — diagnosis?', back: 'Readiness probe missing/galat! K8s booting pods ko turant traffic de raha hai. Fix: readiness + (slow boot ho toh) startup probe. Rolling update readiness par hi chalta hai.' },
      { front: 'READY 0/1 vs RESTARTS badh rahe — kaunsa probe zimmedar?', back: 'READY 0/1 = <b>readiness</b> fail (traffic band). RESTARTS++ = <b>liveness</b> fail (ya crash). Symptom se probe pehchano — debugging aadhi ho gayi.' },
    ],
  },

  /* ================= LEVEL 11: StatefulSets, DaemonSets, Jobs ================= */
  {
    id: 'workloads',
    icon: '🗿',
    title: 'StatefulSets, DaemonSets, Jobs & CronJobs',
    badge: 'Workload Wazir',
    objectives: [
      '<b>Deployment vs StatefulSet vs DaemonSet</b> — kab kaunsa (interview Q9!)',
      'StatefulSet: stable naam (db-0, db-1), apni-apni storage, ordered start',
      'DaemonSet: har node par exactly ek — logging/monitoring agents',
      'Jobs & CronJobs — batch kaam jo khatam hote hain',
    ],
    lesson: [
      `<h3>🗿 Stateless clone vs Stateful vyakti</h3>
       <p>Deployment ke pods <b>clone</b> hain — koi bhi mare, naya random-naam wala aa jaata
       hai, kisi ko fark nahi padta. Par <b>database</b> aisa nahi hai:</p>
       <table>
         <tr><th></th><th>🚀 Deployment</th><th>🗿 StatefulSet</th></tr>
         <tr><td>Pod naam</td><td>web-7d4f-x2k4p (random)</td><td><b>db-0, db-1, db-2</b> (pakka, predictable)</td></tr>
         <tr><td>Storage</td><td>Common/ephemeral</td><td><b>Har pod ki APNI PVC</b> — db-0 mare, naya db-0 WAHI disk wapas paata hai</td></tr>
         <tr><td>Network ID</td><td>Sirf Service ka naam</td><td>Har pod ka apna DNS: <code>db-0.db-svc</code> (headless service)</td></tr>
         <tr><td>Start/stop order</td><td>Sab ek saath, dhakka-mukki</td><td>0 → 1 → 2 ordered (primary pehle, replicas baad)</td></tr>
         <tr><td>Use</td><td>Stateless: web, API</td><td>PostgreSQL, Kafka, MongoDB, Elasticsearch</td></tr>
       </table>
       <p>💡 <b>Kyun matter karta hai:</b> Postgres replica ko primary ka STABLE address
       chahiye (db-0.db-svc) — random pod naam se replication config likh hi nahi sakte.</p>`,
      `<h3>👮 DaemonSet + ⏰ Jobs</h3>
       <p><b>DaemonSet</b> = "har node par exactly ek pod". Naya node aaya? Us par bhi
       apne aap. Use: log collectors (Fluentd), monitoring agents (node-exporter),
       CNI/storage drivers. (Homework mein kube-proxy ke node-jitne pods dekhe the?
       Woh DaemonSet hi tha!)</p>
       <pre># Job — ek baar chala ke khatam (exit 0 = Succeeded)
kind: Job          → DB migration, report generation
  completions: 1, backoffLimit: 4

# CronJob — schedule par Job banata hai
kind: CronJob      → raat 2 baje ka backup
  schedule: "0 2 * * *"</pre>
       <div class="war-story"><b>⚡ Real pattern:</b> Ek team ne DB migration ko Deployment
       bana diya (copy-paste YAML 🙈). Migration complete → container exit → K8s ne "crash"
       samjha → restart → migration PHIR chali → duplicate data. <b>Rule: jo kaam KHATAM hota
       hai woh Job hai; jo hamesha chalta hai woh Deployment.</b> Restart policy hi alag hai
       (Job: OnFailure/Never; Deployment: Always).</div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Sahi Workload Chuno',
        instructions: 'Har use-case ko sahi workload type mein daalo. (Interview Q9 ki practice!)',
        bins: [
          { id: 'deploy', label: '🚀 Deployment' },
          { id: 'sts', label: '🗿 StatefulSet' },
          { id: 'ds', label: '👮 DaemonSet' },
          { id: 'job', label: '⏰ Job/CronJob' },
        ],
        items: [
          { text: 'REST API server (stateless, 10 replicas)', bin: 'deploy', explain: 'Stateless clones = Deployment. 90% apps yahi hain.' },
          { text: 'PostgreSQL primary + 2 replicas', bin: 'sts', explain: 'Stable naam (db-0=primary!), apni-apni disk, ordered start = StatefulSet. DB ka ghar.' },
          { text: 'Har node se logs uthane wala Fluentd', bin: 'ds', explain: 'Har node par ek = DaemonSet. Naya node aate hi us par bhi agent aa jaata hai.' },
          { text: 'Raat 2 baje DB backup', bin: 'job', explain: 'CronJob — schedule: "0 2 * * *". Har raat naya Job banata hai jo khatam ho jaata hai.' },
          { text: 'Kafka cluster (broker-0,1,2 apni disk ke saath)', bin: 'sts', explain: 'Kafka brokers ki identity aur unki disk ka rishta pakka hai — StatefulSet textbook case.' },
          { text: 'Node-level monitoring (node-exporter)', bin: 'ds', explain: 'Har node ki metrics chahiye = har node par pod = DaemonSet. (Prometheus stack ka hissa — advanced track!)' },
          { text: 'Ek baar chalne wala DB schema migration', bin: 'job', explain: 'War-story yaad hai? Khatam hone wala kaam = Job (restartPolicy: OnFailure). Deployment banaya toh loop mein chalega!' },
        ],
      },
      {
        type: 'quiz',
        title: 'StatefulSet ki barikiyan',
        questions: [
          {
            q: 'StatefulSet ka pod db-1 crash ho gaya. Naya pod kaisa hoga?',
            choices: [
              'Naam WAHI (db-1), aur WAHI purani PVC/disk wapas milegi — identity poori tarah preserve',
              'Naya random naam milega (db-x7k2p)',
              'db-3 banega, kyunki naam aage badhte hain',
              'Naye pod ko nayi khaali disk milegi',
            ],
            answer: 0,
            explain: 'Yehi "stable identity" ka matlab hai: naam + storage + DNS teeno wapas. Database ka data disk par tha — naya db-1 wahin se continue karega. Deployment mein aisa kuch nahi hota.',
          },
          {
            q: 'StatefulSet scale down kiya: 3 → 2. Kya hota hai?',
            choices: [
              'Sabse BADA ordinal jaata hai (db-2) — aur uski PVC by default BACHI rehti hai',
              'Random pod jaata hai',
              'db-0 jaata hai (sabse purana)',
              'Teeno restart hote hain 2 ban ke',
            ],
            answer: 0,
            explain: 'Ordered scaling: upar se katta hai (db-2 pehle), neeche se badhta hai. PVC jaan-boojh ke rehti hai — data accidentally delete na ho. Wapas scale up karo toh db-2 apni purani disk ke saath lautega!',
          },
          {
            q: 'DaemonSet ka pod us node par bhi chal sakta hai jahan taint laga hai (jaise control-plane) — kaise?',
            choices: [
              'DaemonSet ke pod spec mein matching toleration daal ke',
              'DaemonSet taints ko hamesha ignore karta hai automatically',
              'Impossible — tainted node par kuch nahi chal sakta',
              'Node ka taint hatana hi padega',
            ],
            answer: 0,
            explain: 'Tolerations (agla level!) se. System DaemonSets (kube-proxy, CNI) ke paas built-in tolerations hote hain — isliye woh HAR node par dikhte hain, control-plane par bhi.',
          },
        ],
      },
      {
        type: 'fill',
        bonus: true,
        title: 'Good to Know — CronJob Likho',
        instructions: 'Bonus: raat 2 baje daily backup ka CronJob poora karo.',
        template: 'apiVersion: batch/v1\nkind: {0}\nmetadata:\n  name: db-backup\nspec:\n  schedule: "{1}"\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: {2}\n          containers:\n          - name: backup\n            image: backup-tool:1.2\n            args: ["--target", "s3://backups/"]',
        blanks: [
          { answer: 'CronJob', explain: 'batch/v1 ka CronJob — schedule par Jobs banata hai (jo pods banate hain — teen level ki Matryoshka!).' },
          { answer: '0 2 * * *', explain: 'Cron syntax: min(0) hour(2) day(*) month(*) weekday(*) = roz raat 2 baje. crontab.guru bookmark kar lo!' },
          { answer: 'OnFailure', explain: 'Jobs mein Always ILLEGAL hai — kaam khatam hona chahiye. OnFailure = fail par retry, success par shanti.' },
        ],
        tokens: ['CronJob', '0 2 * * *', 'OnFailure', 'Deployment', '2 0 * * *', 'Always', '* * * * 2'],
      },
    ],
    interview: {
      title: 'Interview Round — Workload Types',
      instructions: 'Q9 ("Deployment vs StatefulSet vs DaemonSet — production use cases") ka full jawab yahin banega. 🎤',
      questions: [
        {
          q: '"PostgreSQL ko Deployment ki jagah StatefulSet mein kyun chalate hain?" — sabse complete jawab?',
          choices: [
            'Stable network identity (db-0.db-svc — replication config ke liye), per-pod persistent storage (pod mare toh WAHI disk wapas), aur ordered startup (primary pehle)',
            'StatefulSet zyada replicas support karta hai',
            'Deployment mein database slow chalta hai',
            'StatefulSet ke pods kabhi crash nahi hote',
          ],
          answer: 0,
          explain: 'Teen pillars bolo: naam + storage + order. Bonus point ke liye: "Deployment mein naya pod nayi identity ke saath aata hai — DB replica apna primary hi kho dega."',
        },
        {
          q: 'Monitoring agent ko Deployment (replicas = node count) ki jagah DaemonSet mein kyun?',
          choices: [
            'DaemonSet EXACTLY ek per node guarantee karta hai — naya node aate hi coverage; Deployment ki ginti nodes se sync nahi rehti aur do pods ek node par bhi ja sakte hain',
            'DaemonSet ke pods zyada powerful hote hain',
            'Deployment nodes par nahi chal sakta',
            'DaemonSet free hota hai, Deployment ke paise lagte hain',
          ],
          answer: 0,
          explain: '"Per-node concern = DaemonSet" — placement ki guarantee hi feature hai. Cluster autoscaler naya node laaye (Level 16!) toh bhi agent aap se aap wahan hoga.',
        },
        {
          q: 'CronJob raat ka backup 3 din se MISS kar raha hai — sabse pehle kya dekhoge?',
          choices: [
            'kubectl get cronjob (suspended? LAST SCHEDULE?) + get jobs (fail ho rahe? backoffLimit khatam?) + jobs ke pods ke logs',
            'Node restart karo',
            'CronJob delete karke naya banao',
            'Schedule ko har minute kar do testing ke liye',
          ],
          answer: 0,
          explain: 'Chain follow karo: CronJob → Jobs → Pods → logs. Common causes: suspend: true reh gaya, concurrencyPolicy ne skip kiya, ya Job fail hoke backoffLimit cross. Ordered debugging yahan bhi!',
        },
      ],
    },
    success: [
      'Main Deployment/StatefulSet/DaemonSet/Job mein sahi choice + reasoning de sakta hoon',
      'Main StatefulSet ki stable identity (naam+storage+DNS+order) explain kar sakta hoon',
      'Main "migration as Deployment" jaisi galtiyan pakad sakta hoon',
      'Main CronJob failures ko chain se debug kar sakta hoon',
    ],
    homework: `<p>StatefulSet ki stable identity live dekho:</p>
      <pre>kubectl apply -f - &lt;&lt;EOF
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: demo }
spec:
  serviceName: demo
  replicas: 3
  selector: { matchLabels: { app: demo } }
  template:
    metadata: { labels: { app: demo } }
    spec: { containers: [ { name: c, image: nginx } ] }
EOF
kubectl get pods -w        # demo-0 PEHLE, phir demo-1, phir demo-2 (order!)
kubectl delete pod demo-1
kubectl get pods           # naya pod ka naam? WAHI demo-1! 🗿
kubectl delete sts demo</pre>
      <p>✅ Self-check: ordered creation dekhi? demo-1 wapas demo-1 hi bana?</p>`,
    cards: [
      { front: 'Deployment vs StatefulSet vs DaemonSet — kab kya?', back: '<b>Stateless app</b> (web/API) → Deployment. <b>DB/Kafka</b> (stable naam+apni disk+order chahiye) → StatefulSet. <b>Har-node-par-ek</b> (logs/monitoring agent) → DaemonSet.' },
      { front: 'StatefulSet ke "stable identity" ke 3 pillars?', back: '1) <b>Naam</b>: db-0, db-1 (crash ke baad WAHI naam), 2) <b>Storage</b>: per-pod PVC (wahi disk wapas), 3) <b>DNS</b>: db-0.db-svc + ordered start/stop.' },
      { front: 'Khatam hone wala kaam Deployment mein daala toh?', back: 'Container exit → K8s "crash" samjhega → restart → kaam PHIR chalega (migration double!). Khatam hone wala kaam = <b>Job</b> (restartPolicy: OnFailure/Never).' },
      { front: 'kube-proxy har node par kaise pahunchta hai?', back: 'Woh <b>DaemonSet</b> hai! Har node par exactly ek, naye node par auto. System agents (CNI, log collectors) ka standard pattern — control-plane taints ke liye tolerations ke saath.' },
    ],
  },

  /* ================= LEVEL 12: Storage ================= */
  {
    id: 'storage',
    icon: '💾',
    title: 'Storage — PV, PVC & StorageClass',
    badge: 'Volume Vidwan',
    objectives: [
      'Container storage ephemeral kyun hai — aur iska ilaaj',
      '<b>PV / PVC / StorageClass</b> — teeno ka rishta (parchi-recipe-disk)',
      'Dynamic provisioning ka flow',
      'Access modes (RWO/RWX) aur reclaim policy ke production nuances',
    ],
    lesson: [
      `<h3>💾 Container mari, data gaya — by design</h3>
       <p>Container ka filesystem <b>ephemeral</b> hai — restart hote hi naya, saaf-suthra.
       Stateless app ke liye feature, database ke liye disaster. Isliye storage ko pod se
       ALAG rakha jaata hai — teen kirdaar:</p>
       <table>
         <tr><th>Object</th><th>Kaun banata</th><th>Kya hai</th></tr>
         <tr><td>🎫 <b>PVC</b> (PersistentVolumeClaim)</td><td>Developer</td><td>Demand ki parchi: "10Gi chahiye, fast-ssd class ki, RWO"</td></tr>
         <tr><td>🏭 <b>StorageClass</b></td><td>Platform/admin (ek baar)</td><td>Disk banane ki RECIPE: "fast-ssd = AWS gp3, encrypted..."</td></tr>
         <tr><td>💾 <b>PV</b> (PersistentVolume)</td><td>K8s khud (dynamic!)</td><td>ASLI disk ka handle — EBS volume, NFS share...</td></tr>
       </table>
       <pre>Pod → PVC ("10Gi fast wali") → StorageClass (recipe)
                                     → PV apne aap bana (EBS vol-abc123)
                                     → PVC ↔ PV BOUND ✓ → pod mount</pre>
       <p>Developer ko cloud ki details jaanni hi nahi padti — <b>yehi dynamic provisioning
       ka charm hai</b>. (Static/manual PV ab sirf legacy/on-prem corner cases mein.)</p>`,
      `<h3>🔐 Access modes + reclaim — production ke teekhe kone</h3>
       <pre>accessModes:
  ReadWriteOnce (RWO)  # EK node mount karega — EBS/block disks (default duniya)
  ReadWriteMany (RWX)  # KAI nodes ek saath — NFS/EFS/CephFS jaisi cheez chahiye
  ReadOnlyMany  (ROX)  # kai nodes, sirf padhna

reclaimPolicy:         # PVC DELETE hone par PV/disk ka kya ho?
  Delete   # disk bhi udd jaati hai (dynamic ka default!) 😱
  Retain   # disk bachi rehti hai — manual cleanup, par DATA SAFE</pre>
       <div class="war-story"><b>⚡ Real incident (do classics ek saath):</b> (1) Ek team ne
       2-replica Deployment mein RWO PVC laga di — dono pods alag nodes par schedule hue,
       doosra pod hamesha <code>ContainerCreating</code> mein atka: "Multi-Attach error".
       RWO = ek node ka bandhan! (2) Doosri team ne namespace cleanup mein PVCs delete ki —
       reclaimPolicy <code>Delete</code> tha — <b>production DB ki disk bhi cloud se udd
       gayi</b>. Backup 3 din purana tha. Tab se unke DB StorageClass mein
       <code>reclaimPolicy: Retain</code> hai. Dono galtiyan ek baar dekh lo, kabhi mat
       dohrana.</div>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Dynamic Provisioning ka Flow',
        instructions: 'Developer ne PVC apply ki — disk pod tak kaise pahunchti hai? Sahi order lagao.',
        steps: [
          { text: 'Developer PVC apply karta hai: "10Gi, class: fast-ssd"', explain: 'Sirf parchi — cloud ka naam-o-nishan nahi. Portability yahi se aati hai.' },
          { text: 'StorageClass "fast-ssd" ka provisioner activate hota hai', explain: 'CSI driver (jaise EBS CSI) recipe padhta hai: type gp3, encrypted, zone...' },
          { text: 'Cloud mein asli disk banti hai aur PV object register hota hai', explain: 'EBS volume vol-abc123 → K8s mein uska PV handle. Yeh step DYNAMIC hai — admin ne kuch nahi kiya.' },
          { text: 'PVC aur PV BOUND ho jaate hain', explain: 'Parchi ↔ disk ki shaadi. kubectl get pvc mein STATUS: Bound dikhega.' },
          { text: 'Pod schedule hota hai aur kubelet disk ko node par attach/mount karta hai', explain: 'Scheduler zone bhi dekh raha tha (disk jis zone mein, pod wahin!). Ab /data mein asli persistent disk hai.' },
        ],
      },
      {
        type: 'fill',
        title: 'PVC + Pod Mount Likho',
        instructions: 'Postgres ke liye PVC banao aur pod mein mount karo.',
        template: 'kind: {0}\nmetadata:\n  name: db-data\nspec:\n  accessModes: [ {1} ]\n  storageClassName: fast-ssd\n  resources:\n    requests:\n      storage: {2}\n---\n# Pod spec mein:\n  volumes:\n  - name: data\n    persistentVolumeClaim:\n      claimName: {3}\n  containers:\n  - name: postgres\n    volumeMounts:\n    - name: data\n      mountPath: /var/lib/postgresql/data',
        blanks: [
          { answer: 'PersistentVolumeClaim', explain: 'Developer sirf claim likhta hai — PV apne aap banega (dynamic provisioning).' },
          { answer: 'ReadWriteOnce', explain: 'Postgres = ek hi node likhega = RWO. (RWX chahiye hota toh NFS/EFS jaisa filesystem lagta.)' },
          { answer: '20Gi', explain: 'Size request. Pro-tip: kai StorageClasses online EXPAND allow karti hain (allowVolumeExpansion) — shrink koi nahi!' },
          { answer: 'db-data', explain: 'PVC ka naam — pod isi parchi se apni disk paata hai. StatefulSet mein yeh volumeClaimTemplates se PER-POD auto banta hai (pichhla level yaad karo!).' },
        ],
        tokens: ['PersistentVolumeClaim', 'ReadWriteOnce', '20Gi', 'db-data', 'PersistentVolume', 'ReadWriteMany', '20Mb', 'fast-ssd'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Storage ke nuqte',
        questions: [
          {
            q: '2-replica Deployment + ek RWO PVC — doosra pod "Multi-Attach error" mein atka. Kyun?',
            choices: [
              'RWO disk sirf EK node par mount hoti hai — doosra pod doosre node par gaya toh disk nahi milegi',
              'PVC ka size chhota hai',
              'StorageClass galat hai',
              'Deployment mein PVC allowed nahi hai',
            ],
            answer: 0,
            explain: 'War-story wala case! Solutions: (a) shared filesystem (EFS/NFS = RWX), (b) ya sahi design — replicas ko apni-apni disk chahiye toh StatefulSet + volumeClaimTemplates. RWO ka "Once" = one NODE.',
          },
          {
            q: 'kubectl get pvc dikhata hai STATUS: Pending. Sabse common wajah?',
            choices: [
              'StorageClass ka naam galat/missing hai — provisioner ko parchi mili hi nahi',
              'Pod abhi start nahi hua',
              'Disk full hai',
              'PVC ko manually Bound karna padta hai',
            ],
            answer: 0,
            explain: 'describe pvc → Events dekho: "storageclass not found" typical hai. WaitForFirstConsumer mode mein bhi Pending dikhta hai jab tak pod na aaye — woh normal hai! Events hi sach batayenge.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Storage',
      instructions: 'Data ke sawal = sabse mehenge sawal. Dhyan se. 🎤',
      questions: [
        {
          q: 'PV, PVC aur StorageClass ka rishta ek line mein — sabse acchi analogy?',
          choices: [
            'PVC = demand ki parchi (dev likhta hai), StorageClass = disk banane ki recipe (admin ek baar), PV = asli disk (dynamic provisioning se auto) — parchi aur disk BOUND hote hain',
            'PV = PVC ka backup hota hai, StorageClass unka folder',
            'Teeno ek hi cheez ke naam hain versions ke saath',
            'StorageClass developer banata hai, PVC admin',
          ],
          answer: 0,
          explain: 'Separation of concerns bolo: dev ko "kitna+kaisa" pata hai, platform ko "kahan se+kaise" — StorageClass beech ka contract hai. Yeh clarity hi interview mein alag dikhati hai.',
        },
        {
          q: 'Production database ki StorageClass mein reclaimPolicy kya rakhoge aur kyun?',
          choices: [
            'Retain — PVC galti se delete ho jaaye toh bhi ASLI DISK bachi rahe; cleanup manual karna manzoor, data khona nahi',
            'Delete — automatic cleanup clean rehta hai',
            'Recycle — disk format hoke reuse ho jaati hai',
            'Koi bhi — reclaimPolicy sirf label hai',
          ],
          answer: 0,
          explain: 'War-story yaad karo — Delete policy + galat namespace cleanup = DB disk cloud se gayab. Retain ek extra manual step ki keemat par data ki jaan bachata hai. (Recycle deprecated hai, mention mat karo.)',
        },
        {
          q: 'StatefulSet ke volumeClaimTemplates aur Deployment ke ek shared PVC mein architectural farak?',
          choices: [
            'volumeClaimTemplates HAR POD ki alag PVC banata hai (db-data-db-0, db-data-db-1...) — per-replica apna data; Deployment mein sab pods EK claim share karte (RWO ho toh ek node ka bandhan bhi)',
            'Dono same hain, syntax alag',
            'Deployment ki PVC zyada fast hoti hai',
            'volumeClaimTemplates sirf local disk ke liye hai',
          ],
          answer: 0,
          explain: 'Yehi StatefulSet+storage ka asli integration hai: pod db-1 mare → naya db-1 → WAHI db-data-db-1 PVC wapas. Identity + data ek saath travel karte hain.',
        },
      ],
    },
    success: [
      'Main PV/PVC/StorageClass ka rishta aur dynamic provisioning flow bata sakta hoon',
      'Main RWO vs RWX sahi chun sakta hoon (aur Multi-Attach error samajh sakta hoon)',
      'Main production DB ke liye Retain policy ka case bana sakta hoon',
      'Main Pending PVC ko describe → Events se debug kar sakta hoon',
    ],
    homework: `<p>Persistence ko test karo — data ko pod ki maut ke paar bhejo:</p>
      <pre>kubectl get storageclass          # minikube mein "standard"
cat &lt;&lt;EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: test-pvc }
spec:
  accessModes: [ReadWriteOnce]
  resources: { requests: { storage: 1Gi } }
EOF
kubectl get pvc                   # Bound (ya Pending till first pod — dono normal)
# writer pod: data likho, phir maro
kubectl run writer --image=busybox --restart=Never -- sh -c 'echo AMAR-DATA > /mnt/f'
# (volume attach karne ke liye YAML chahiye — kubectl explain pod.spec.volumes se
#  khud likho, yehi asli practice hai! Ya level ke fill-game wala pattern use karo.)
kubectl delete pvc test-pvc</pre>
      <p>✅ Self-check: PVC Bound dekhi? explain se volumes ka YAML khud likh paaye?</p>`,
    cards: [
      { front: 'PV / PVC / StorageClass — kaun kya?', back: '🎫 <b>PVC</b> = demand parchi (dev). 🏭 <b>StorageClass</b> = disk recipe (admin, ek baar). 💾 <b>PV</b> = asli disk (dynamic provisioning se auto). PVC↔PV = Bound.' },
      { front: 'RWO vs RWX — "Once" kiska?', back: '<b>RWO = ek NODE</b> mount kar sakta hai (block disks: EBS). RWX = kai nodes (NFS/EFS). 2 replicas + RWO alag nodes par = "Multi-Attach error"!' },
      { front: 'reclaimPolicy Delete vs Retain?', back: '<b>Delete</b> (dynamic default): PVC gayi → asli disk bhi gayi 😱. <b>Retain</b>: disk bachti hai, manual cleanup. Production DB = hamesha Retain.' },
      { front: 'PVC Pending — top 2 wajah?', back: '1) StorageClass naam galat/missing (describe → Events), 2) WaitForFirstConsumer — pod aane ka intezaar (yeh NORMAL hai). Events padho, guess mat karo.' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('intermediate', [

  /* ================= LEVEL 13: Affinity & Taints ================= */
  {
    id: 'affinity',
    icon: '🧲',
    title: 'Affinity, Anti-Affinity & Taints/Tolerations',
    badge: 'Placement Pradhan',
    objectives: [
      'Node affinity — "is TARAH ke node par chalao" (SSD, GPU, zone)',
      '<b>Pod anti-affinity</b> — replicas ko alag nodes par phailana (HA ka raaz)',
      '<b>Taints & Tolerations</b> — node ka pehra: "sirf khaas pods aayein"',
      'Affinity vs Taint — kaun kis direction mein kaam karta hai',
    ],
    lesson: [
      `<h3>🧲 Do direction, do tools</h3>
       <p>Scheduler ko placement ke rules dene ke do tarike — direction alag hai:</p>
       <table>
         <tr><th>Tool</th><th>Kaun bolta hai</th><th>Kya bolta hai</th></tr>
         <tr><td>🧲 <b>Node Affinity</b></td><td><b>Pod</b> bolta hai</td><td>"Mujhe disk=ssd wale node par chalao" (required ya preferred)</td></tr>
         <tr><td>👯 <b>Pod Anti-Affinity</b></td><td><b>Pod</b> bolta hai</td><td>"Mujhe apne hi jaise pods se DOOR rakho" — HA ke liye replicas alag nodes par</td></tr>
         <tr><td>🚫 <b>Taint + Toleration</b></td><td><b>Node</b> bolta hai</td><td>"Main khaas hoon (GPU) — jo mera taint TOLERATE kare wahi aaye"</td></tr>
       </table>
       <pre># Node ko taint karo (repel sab ko):
kubectl taint nodes gpu-node-1 gpu=true:NoSchedule

# Pod jo aana chahta hai (tolerate + attract dono chahiye!):
tolerations:                        # "mujhe gpu taint manzoor hai" 🎟️
- key: gpu, operator: Equal, value: "true", effect: NoSchedule
nodeSelector: { accelerator: nvidia }  # "aur mujhe GPU node CHAHIYE bhi"</pre>
       <p>⚠️ <b>Subtle point:</b> toleration sirf ALLOW karta hai, ATTRACT nahi.
       GPU pods GPU node par pakka bhejne ke liye affinity/nodeSelector BHI lagao.</p>`,
      `<h3>👯 Anti-affinity — HA ki asli chaabi</h3>
       <pre>affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector: { matchLabels: { app: web } }
      topologyKey: kubernetes.io/hostname   # "alag NODE"
      # topologyKey: topology.kubernetes.io/zone → "alag ZONE"</pre>
       <div class="war-story"><b>⚡ Real incident:</b> Ek company ke payment-service ke
       teeno replicas SAME node par the (Scheduler ne bas resources dekhe, spread ka rule
       koi tha nahi). Woh node hardware failure se gaya — <b>teeno replicas ek saath gaye</b>,
       "highly available" service 100% down. Post-mortem ki #1 action item: har critical
       service par required podAntiAffinity (hostname) + zone-level spread. Cloud provider
       ki ek zone bhi gir sakti hai — 2021 ke bade cloud outages yaad hain? Zone-spread wale
       bache the, baaki nahi.</div>
       <p>💡 Aaj kal isi kaam ka modern shortcut bhi hai: <code>topologySpreadConstraints</code>
       — even spreading ke liye. Interview mein mention karo, bonus points!</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Affinity ya Taint?',
        instructions: 'Har requirement ke liye sahi tool chuno. Direction yaad rakho: pod bolta hai ya node?',
        bins: [
          { id: 'nodeaff', label: '🧲 Node Affinity' },
          { id: 'antiaff', label: '👯 Pod Anti-Affinity' },
          { id: 'taint', label: '🚫 Taint + Toleration' },
        ],
        items: [
          { text: '"Frontend sirf SSD wale nodes par chale"', bin: 'nodeaff', explain: 'Pod ki demand node ke TYPE ke liye = node affinity (disk=ssd label par).' },
          { text: '"Web ke 2 replicas kabhi same node par na hon"', bin: 'antiaff', explain: 'Pod apne jaise pods se door = anti-affinity + topologyKey: hostname. HA 101.' },
          { text: '"GPU nodes par sirf ML workloads aayein, baaki sab door rahein"', bin: 'taint', explain: 'Node sabko repel kare, chosen ones tolerate karein = taint. Mehenga node aam pods se bachao!' },
          { text: '"Control-plane node par aam pods na aayein"', bin: 'taint', explain: 'K8s khud yahi karta hai: node-role.kubernetes.io/control-plane:NoSchedule taint. Ab samjhe pods wahan kyun nahi jaate!' },
          { text: '"Cache pod ko API pods ke PAAS rakho (same node)"', bin: 'antiaff', explain: 'Gotcha — yeh anti nahi, plain pod AFFINITY hai (paas lana)! Same mechanism, ulta matlab. Bin toh yahi hai, par yaad rakho: affinity = paas, anti = door.' },
          { text: '"DB pods zone ap-south-1a mein hi rahein (data residency)"', bin: 'nodeaff', explain: 'Zone label par node affinity — topology.kubernetes.io/zone=ap-south-1a. Compliance requirements aksar yahi banti hain.' },
        ],
      },
      {
        type: 'fill',
        title: 'HA ke liye Anti-Affinity Likho',
        instructions: 'payment-service ke replicas ko alag-alag nodes par pakka karne wala spec banao.',
        template: 'spec:\n  replicas: 3\n  template:\n    spec:\n      affinity:\n        {0}:\n          requiredDuringSchedulingIgnoredDuringExecution:\n          - labelSelector:\n              matchLabels:\n                app: {1}\n            topologyKey: {2}\n      tolerations:\n      - key: critical-only\n        operator: Equal\n        value: "true"\n        effect: {3}',
        blanks: [
          { answer: 'podAntiAffinity', explain: 'Anti-affinity = "in labels wale pods se door". (podAffinity hota toh PAAS jaata!)' },
          { answer: 'payment', explain: 'Kisse door? APNE hi jaise pods se — app: payment. Har replica doosre payment replicas se bachega.' },
          { answer: 'kubernetes.io/hostname', explain: '"Door" ka scope: hostname = alag NODE. zone likhte toh alag availability zone. Yeh war-story ka fix hai!' },
          { answer: 'NoSchedule', explain: 'Taint effect: NoSchedule = naye pods nahi aayenge. (NoExecute = jo hain unhe bhi nikalo — node drain jaisa.)' },
        ],
        tokens: ['podAntiAffinity', 'payment', 'kubernetes.io/hostname', 'NoSchedule', 'podAffinity', 'nodeSelector', 'topology.kubernetes.io/zone', 'Always'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Placement ke corner cases',
        questions: [
          {
            q: '3 nodes, required anti-affinity (hostname), replicas: 4. Chautha pod ka kya hoga?',
            choices: [
              'PENDING — required rule tootne nahi dega, aur koi 4th node hai nahi',
              'Kisi node par do pods chale jayenge',
              'Ek node par sab 4 aa jayenge',
              'Error aayega apply par hi',
            ],
            answer: 0,
            explain: 'required = HARD rule — Scheduler todega nahi, pod Pending. Isliye jahan flexibility chahiye wahan "preferred" use karo (soft rule: koshish karega, majboori mein todega). required vs preferred ka trade-off interview classic hai.',
          },
          {
            q: 'NoSchedule vs NoExecute taint effect ka farak?',
            choices: [
              'NoSchedule: naye pods nahi aayenge (purane rahenge); NoExecute: naye bhi nahi + JO HAIN WOH BHI evict',
              'Dono same hain',
              'NoExecute sirf DaemonSets par lagta hai',
              'NoSchedule pods ko restart karta hai',
            ],
            answer: 0,
            explain: 'NoExecute = nikaalo abhi! K8s khud use karta hai: node NotReady hone par node.kubernetes.io/not-ready:NoExecute taint lagta hai — WAHI 5-min eviction jo Track 1 mein padhi thi. Circle complete! 🔄',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Scheduling Rules',
      instructions: 'Placement ke sawal = "kya tumne real HA design kiya hai" ka test. 🎤',
      questions: [
        {
          q: 'Affinity aur Taints — dono placement control karte hain. Core conceptual farak?',
          choices: [
            'Affinity POD ki taraf se hai (pod batata hai kahan jaana/nahi jaana); Taint NODE ki taraf se hai (node batata hai kaun aa sakta hai) — direction ulta hai',
            'Affinity naya feature hai, taints purana',
            'Taints sirf control-plane ke liye hote hain',
            'Affinity YAML mein likhte hain, taints CLI se',
          ],
          answer: 0,
          explain: '"Pod chooses nodes vs node repels pods" — yeh ek line clarity dikhati hai. Aur yeh bhi: dono COMBINE hote hain (GPU example: taint sabko roke + affinity ML pods ko laaye).',
        },
        {
          q: 'Critical service ke saare replicas ek hi node par mile production mein. Permanent fix?',
          choices: [
            'required podAntiAffinity with topologyKey hostname (aur zone-spread bhi consider karo) — Scheduler ko HA ka rule DENA padta hai, woh khud nahi samajhta',
            'Manually pods delete karte raho jab tak alag na ho jayein',
            'Replicas 10 kar do, kahin toh phailenge',
            'Har replica ke liye alag Deployment banao alag nodeSelector se',
          ],
          answer: 0,
          explain: 'Root insight: Scheduler by default sirf resources+score dekhta hai — "spread for HA" TUMHARA rule hai, declare karo. Zone-level bhi bolo (cloud zone bhi girti hai) — yahi junior/senior divide hai.',
        },
        {
          q: 'Naye GPU nodes add kiye, taint bhi laga diya (gpu=true:NoSchedule). ML pods phir bhi CPU nodes par ja rahe hain. Kyun?',
          choices: [
            'Toleration sirf GPU node par jaane ki PERMISSION deta hai, majboori nahi — ML pods ko wahan KHEENCHNE ke liye nodeSelector/affinity bhi chahiye',
            'Taint galat lagaya hoga',
            'ML pods ko taint dikh nahi raha',
            'GPU nodes par kubelet nahi chal raha',
          ],
          answer: 0,
          explain: 'Classic gotcha jo real clusters mein hota hai! Toleration = allow, not attract. Complete GPU setup: taint (baaki sab door) + toleration (ML allowed) + affinity (ML pakka wahan). Teeno bolo — full marks.',
        },
      ],
    },
    success: [
      'Main affinity (pod ki pasand) vs taints (node ka pehra) ka direction samjha sakta hoon',
      'Main HA ke liye required/preferred anti-affinity design kar sakta hoon',
      'Main GPU-node jaisa dedicated pool sahi se set kar sakta hoon (taint+toleration+affinity)',
      'Main NoSchedule vs NoExecute aur unka NotReady-eviction connection jaanta hoon',
    ],
    homework: `<p>Taint ka asar khud dekho:</p>
      <pre>kubectl taint nodes minikube special=true:NoSchedule
kubectl run normal --image=nginx
kubectl get pods                        # PENDING! (single node + taint)
kubectl describe pod normal | grep -A3 Events   # "untolerated taint" 👀
kubectl taint nodes minikube special=true:NoSchedule-   # (- = taint hatao)
kubectl get pods                        # ab Running!
kubectl delete pod normal</pre>
      <p>✅ Self-check: "node(s) had untolerated taint" wala event dekha? Ab yeh error kabhi confuse nahi karega.</p>`,
    cards: [
      { front: 'Affinity vs Taint — direction kya hai?', back: '<b>Affinity</b>: POD bolta hai "mujhe waisa node do / mujhe un pods se door rakho". <b>Taint</b>: NODE bolta hai "sirf toleration wale aayein". Pod chooses vs node repels.' },
      { front: 'HA ke liye replicas alag nodes par — kaise?', back: '<code>podAntiAffinity</code> + <code>topologyKey: kubernetes.io/hostname</code> (required = pakka, preferred = koshish). Zone-spread ke liye topologyKey: zone. Scheduler ko HA ka rule DENA padta hai!' },
      { front: 'GPU node setup ke 3 hisse?', back: '1) <b>Taint</b> gpu=true:NoSchedule (aam pods door), 2) ML pods mein <b>toleration</b> (permission), 3) ML pods mein <b>affinity/nodeSelector</b> (attraction — toleration akela kheenchta NAHI!).' },
      { front: 'NoSchedule vs NoExecute?', back: '<b>NoSchedule</b>: naye pods nahi (purane rahenge). <b>NoExecute</b>: naye nahi + maujooda bhi EVICT. Node NotReady par K8s khud NoExecute taint lagata hai — wahi 5-min eviction!' },
    ],
  },

  /* ================= LEVEL 14: Ingress & Gateway API ================= */
  {
    id: 'ingress',
    icon: '🚪',
    title: 'Ingress & Gateway API — Cluster ka Main Gate',
    badge: 'Gateway Guru',
    objectives: [
      'Har service ka LoadBalancer kyun nahi — Ingress ka economics',
      '<b>Ingress controller vs Ingress resource</b> — do alag cheezein!',
      'Host/path routing + <b>SSL termination</b>',
      '<b>Gateway API</b> — naya standard kyun aa raha hai',
    ],
    lesson: [
      `<h3>🚪 Ek LB, saari services</h3>
       <p>Track 1 mein seekha: LoadBalancer Service = cloud LB = ₹₹₹ per service. 20
       microservices = 20 LBs? Pagalpan. <b>Ingress</b> = EK LB ke peeche smart HTTP router:</p>
       <pre>kind: Ingress
spec:
  tls: [ { hosts: [shop.com], secretName: shop-tls } ]  # SSL YAHIN terminate
  rules:
  - host: shop.com
    http:
      paths:
      - path: /api    → service: api-svc:80
      - path: /       → service: web-svc:80
  - host: admin.shop.com
    http:
      paths:
      - path: /       → service: admin-svc:80</pre>
       <p><b>Do cheezein confuse mat karo:</b></p>
       <ul>
         <li><b>Ingress resource</b> = upar wala YAML — sirf RULES ki kitaab</li>
         <li><b>Ingress CONTROLLER</b> = asli software (NGINX/Traefik ka pod) jo rules
             padhkar traffic route karta hai. <b>Controller install nahi kiya toh Ingress
             YAML sirf shelf par padhi kitaab hai — kuch nahi hoga!</b></li>
       </ul>
       <div class="war-story"><b>⚡ Real confusion (har naye engineer ke saath hota hai):</b>
       Ingress apply kiya, ADDRESS column khaali, traffic nahi aa raha. Ghanton debug —
       controller install hi nahi tha! Managed clusters (EKS/GKE) mein bhi controller
       aksar TUMHE lagana padta hai. Symptom yaad rakho: <code>kubectl get ingress</code>
       mein ADDRESS blank = controller missing/misconfigured.</div>`,
      `<h3>🔮 Gateway API — Ingress ka successor</h3>
       <p>Ingress ke limits: sirf HTTP, annotations ka jungle (har controller ke apne),
       aur ek hi resource mein infra+routing sab mila-jula. <b>Gateway API</b> roles ko
       alag karta hai:</p>
       <table>
         <tr><th>Resource</th><th>Kaun own karta</th><th>Kya hai</th></tr>
         <tr><td><code>GatewayClass</code></td><td>Infra provider</td><td>LB ki category (jaise StorageClass — pattern repeat!)</td></tr>
         <tr><td><code>Gateway</code></td><td>Platform team</td><td>Asli entry point — listeners, TLS, ports</td></tr>
         <tr><td><code>HTTPRoute</code></td><td>App developers</td><td>Apni service ke routing rules — header matching, traffic split (90/10 canary!), sab first-class</td></tr>
       </table>
       <p>Naye projects mein Gateway API dekhna aam hota jaa raha hai — interview mein
       "Ingress ke annotations ki jagah Gateway API portable, role-separated, aur
       TCP/gRPC-ready hai" bolo, up-to-date dikhoge. 😎</p>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Ingress ki Duniya',
        instructions: 'Har cheez ko uske role se milao.',
        pairs: [
          { left: 'Ingress resource (YAML)', right: 'Sirf routing RULES — khud kuch route nahi karta', explain: 'Kitaab hai, padhne wala chahiye. ADDRESS blank ho toh yaad karo: controller hai bhi?' },
          { left: 'Ingress Controller (NGINX/Traefik)', right: 'Asli router pod — rules padhkar traffic bhejta hai', explain: 'Yeh install karna padta hai (helm/manifest se). Yahi asli "main gate" hai.' },
          { left: 'SSL Termination', right: 'HTTPS yahin khulta hai — andar plain HTTP jaata hai', explain: 'Certificates ek jagah manage (TLS Secret — Level 7 ka kubernetes.io/tls yaad hai?). Apps ko cert ka jhanjhat nahi.' },
          { left: 'Path-based routing', right: 'shop.com/api → api-svc, shop.com/ → web-svc', explain: 'Ek domain, kai services. Virtual hosting (host-based) bhi isi ka bhai: admin.shop.com → admin-svc.' },
          { left: 'Gateway API ka HTTPRoute', right: 'Developer-owned routing — canary split, header matching first-class', explain: 'Role separation ka developer wala hissa. Annotations ka jungle khatam, portable YAML.' },
        ],
      },
      {
        type: 'fill',
        title: 'Ingress Likho',
        instructions: 'shop.com ke liye TLS + path routing wala Ingress banao.',
        template: 'apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop\nspec:\n  ingressClassName: {0}\n  tls:\n  - hosts: [ shop.com ]\n    secretName: {1}\n  rules:\n  - host: shop.com\n    http:\n      paths:\n      - path: {2}\n        pathType: Prefix\n        backend:\n          service:\n            name: {3}\n            port: { number: 80 }\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: web-svc\n            port: { number: 80 }',
        blanks: [
          { answer: 'nginx', explain: 'Kaunsa controller yeh Ingress handle karega — class ka naam. Galat/missing class = koi controller nahi uthayega = ADDRESS blank!' },
          { answer: 'shop-tls', explain: 'kubernetes.io/tls type ka Secret (cert + key) — SSL termination iske dum par. (cert-manager isse auto-renew karta hai — pro tip!)' },
          { answer: '/api', explain: 'Specific path PEHLE likho — /api ka rule / se pehle match hona chahiye.' },
          { answer: 'api-svc', explain: '/api ka traffic api-svc par. Ingress hamesha SERVICE ko point karta hai, pod ko kabhi nahi.' },
        ],
        tokens: ['nginx', 'shop-tls', '/api', 'api-svc', 'apache', 'shop-password', '/web', 'api-pod'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Ingress debugging',
        questions: [
          {
            q: 'kubectl get ingress — ADDRESS column khaali hai kaafi der se. Sabse likely wajah?',
            choices: [
              'Ingress controller install nahi hai (ya ingressClassName kisi controller se match nahi karta)',
              'DNS propagate nahi hua',
              'TLS secret galat hai',
              'Service ke endpoints nahi hain',
            ],
            answer: 0,
            explain: 'War-story wala case. ADDRESS controller assign karta hai — koi controller rules ko "adopt" hi nahi kare toh address kahan se? Check: controller pod chal raha hai? class match hai?',
          },
          {
            q: 'Ingress 404 de raha hai, par service ko direct (port-forward se) hit karo toh app chalti hai. Kahan dekhoge?',
            choices: [
              'Ingress rules — host/path match ho raha hai? (galat host header, path typo, pathType Exact vs Prefix)',
              'Pod ke logs',
              'etcd ki health',
              'Node ki disk',
            ],
            answer: 0,
            explain: 'App zinda + Ingress 404 = routing layer ka mismatch. Common: curl mein Host header nahi bheja (curl -H "Host: shop.com"), path Exact tha Prefix ki jagah. Layer isolate karna aa gaya — yehi senior debugging hai!',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Ingress & Gateway',
      instructions: 'Traffic ka poora path samjhaana hai — confidence se. 🎤',
      questions: [
        {
          q: '20 microservices internet par expose karne hain. LoadBalancer-per-service vs Ingress — kya bologe?',
          choices: [
            'Ek Ingress controller (ek LB) ke peeche host/path routing — sasta, certificates centralized, ek hi jagah rate-limiting/auth policies; per-service LB sirf non-HTTP ya special cases ke liye',
            '20 LoadBalancers — simple hai, sabka apna',
            'Sab NodePort kar do, LB ki zaroorat nahi',
            'Sirf ek service expose karo, baaki usse proxy karein',
          ],
          answer: 0,
          explain: 'Economics + operations dono bolo: LB cost × 20, certs × 20, firewall rules × 20 vs EK gate. Non-HTTP (raw TCP/UDP, jaise DB ya game server) ke liye LB/Gateway API ka TCP route — yeh exception mention karna hi depth hai.',
        },
        {
          q: 'SSL termination Ingress par karne ka matlab aur trade-off?',
          choices: [
            'HTTPS Ingress controller par decrypt hota hai, andar cluster mein plain HTTP — certs ek jagah, apps simple; trade-off: andar ka traffic encrypted nahi (iska ilaaj: service mesh ka mTLS — advanced track!)',
            'Har pod apna certificate rakhta hai',
            'SSL sirf LoadBalancer par ho sakta hai',
            'Termination ka matlab hai HTTPS band kar dena',
          ],
          answer: 0,
          explain: 'Trade-off bolna hi asli jawab hai: simplicity vs internal encryption. Aur "mTLS via service mesh" ka pointer dena = tumhe pata hai aage kya aata hai. (Istio Level 25 mein yahi solve hoga!)',
        },
        {
          q: 'Gateway API, Ingress se better kyun mana ja raha hai? (Modern interview question!)',
          choices: [
            'Role separation (infra/platform/dev apne-apne resources), annotations ki jagah portable typed fields, aur HTTP ke aage TCP/gRPC/traffic-splitting first-class',
            'Yeh sirf naya naam hai, same cheez hai',
            'Gateway API sirf AWS par chalta hai',
            'Ingress deprecated ho chuka hai, migrate karna zaroori hai',
          ],
          answer: 0,
          explain: 'Teen points: roles, portability, expressiveness. Aur balanced rehna: "Ingress abhi bhi widely used aur supported hai — naye projects mein Gateway API consider karo" — hype nahi, judgment.',
        },
      ],
    },
    success: [
      'Main Ingress resource vs controller ka farak (aur blank-ADDRESS symptom) jaanta hoon',
      'Main TLS + host/path routing wala Ingress likh sakta hoon',
      'Main "Ingress 404 par app zinda" jaise issues layer-by-layer debug kar sakta hoon',
      'Main Gateway API ka case explain kar sakta hoon',
    ],
    homework: `<p>Minikube mein poora Ingress flow:</p>
      <pre>minikube addons enable ingress          # NGINX controller install!
kubectl get pods -n ingress-nginx       # controller pod dekho
kubectl create deployment web --image=nginx
kubectl expose deployment web --port=80
kubectl create ingress web --rule="web.local/*=web:80"
kubectl get ingress -w                  # ADDRESS aane ka wait (controller ka kaam!)
# test (minikube ip se):
curl -H "Host: web.local" http://$(minikube ip)/
kubectl delete ingress web; kubectl delete deploy,svc web</pre>
      <p>✅ Self-check: Host header ke saath nginx page aaya? ADDRESS blank se filled hota dekha?</p>`,
    cards: [
      { front: 'Ingress resource vs Ingress controller?', back: '<b>Resource</b> = rules ka YAML (kitaab). <b>Controller</b> = NGINX/Traefik pod jo rules enforce karta hai (padhne wala). Controller nahi → ADDRESS blank → kuch route nahi hota!' },
      { front: 'Ek LB ke peeche 20 services kaise?', back: '<b>Ingress</b>: host-based (admin.shop.com→admin-svc) + path-based (/api→api-svc) routing, SSL termination bhi yahin (TLS Secret se). LB cost ×1, certs ek jagah.' },
      { front: 'SSL termination ka matlab + trade-off?', back: 'HTTPS Ingress par khulta hai, andar plain HTTP. ✓ certs centralized, apps simple. ✗ internal traffic unencrypted → ilaaj: service mesh mTLS (Istio).' },
      { front: 'Gateway API kya naya laata hai?', back: '<b>Role separation</b>: GatewayClass (infra) / Gateway (platform) / HTTPRoute (dev). Annotations ka jungle → typed portable fields. Canary split, header match, TCP/gRPC first-class. Ingress ka modern successor.' },
    ],
  },

  /* ================= LEVEL 15: NetworkPolicies ================= */
  {
    id: 'netpol',
    icon: '🔥',
    title: 'NetworkPolicies — Pods ka Internal Firewall',
    badge: 'Zero-Trust Thanedaar',
    objectives: [
      'Default: <b>har pod har pod se baat kar sakta hai</b> — aur yeh problem kyun hai',
      'NetworkPolicy anatomy: podSelector, ingress/egress, from/to',
      '<b>Default-deny</b> pattern — zero-trust ki neev',
      'Policy debugging — "kaam kyun nahi kar rahi" ke classic reasons',
    ],
    lesson: [
      `<h3>😱 Default: sab khula hai</h3>
       <p>Shayad K8s ka sabse surprising default: <b>koi bhi pod kisi bhi pod se baat kar
       sakta hai</b> — namespaces ke paar bhi (Level 7 mein bola tha — namespaces network
       isolate NAHI karte!). Frontend seedha DB se? Ho sakta hai. Compromised pod se poora
       cluster scan? Ho sakta hai. 🙈</p>
       <pre># Zero-trust ki neev — DEFAULT DENY (namespace mein sab band):
kind: NetworkPolicy
metadata: { name: default-deny, namespace: prod }
spec:
  podSelector: {}          # is namespace ke SAARE pods par lagu
  policyTypes: [Ingress]   # saara incoming BAND

# Phir sirf zaroori raaste kholo:
kind: NetworkPolicy
metadata: { name: allow-backend-to-db }
spec:
  podSelector: { matchLabels: { app: db } }        # kispe: db pods
  ingress:
  - from:
    - podSelector: { matchLabels: { app: backend } } # kaun aa sakta hai
    ports: [ { port: 5432 } ]                        # sirf is port par</pre>
       <p>Policies <b>additive</b> hain — deny list nahi hoti, sirf allow rules jude jaate
       hain. Deny-all + targeted allows = zero-trust.</p>`,
      `<h3>⚠️ Do cheezein jo sabko pakadti hain</h3>
       <ul>
         <li><b>CNI support chahiye!</b> NetworkPolicy tabhi enforce hoti hai jab CNI plugin
         kare (Calico, Cilium ✓ — kuch basic CNIs sirf ignore kar dete hain, error bhi nahi!).
         Policy lagayi, kuch nahi badla? Pehle poochho: CNI kaunsa hai?</li>
         <li><b>DNS mat bhoolna:</b> egress default-deny kiya toh DNS (port 53 → kube-dns) bhi
         band ho gaya — ab pods NAAM se kisi ko nahi dhundh paayenge. Har egress policy mein
         DNS allow karna muscle-memory bana lo.</li>
       </ul>
       <div class="war-story"><b>⚡ Real incident (security wala):</b> Ek fintech mein ek
       third-party dependency compromise hui (supply chain). Attacker frontend pod ke andar
       tha — aur wahan se DB, internal admin APIs, metrics — <b>sab kuch reachable tha</b>,
       kyunki policies thi hi nahi. Post-incident: default-deny har namespace mein, DB sirf
       backend se, egress sirf zaroori domains. Attacker hota toh ab sirf apne pod mein
       band hota. <b>Yehi "blast radius kam karna" hai.</b></div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Policy Judge',
        instructions: 'Namespace mein policies: (1) default-deny ingress sab par, (2) db ingress sirf backend se :5432. Har connection ka faisla karo.',
        bins: [
          { id: 'allow', label: '✅ ALLOWED' },
          { id: 'deny', label: '🚫 DENIED' },
        ],
        items: [
          { text: 'backend → db :5432', bin: 'allow', explain: 'Exactly allow rule se match: backend label + port 5432. Yahi ek raasta khula hai.' },
          { text: 'frontend → db :5432', bin: 'deny', explain: 'Allow rule sirf backend ko hai — frontend ke liye default-deny lagti hai. Zero-trust kaam kar raha hai!' },
          { text: 'backend → db :22 (SSH)', bin: 'deny', explain: 'Sahi pod, GALAT port — rule sirf 5432 kholta hai. Port-level precision hi to point hai.' },
          { text: 'db → backend :8080 (reply nahi, NAYI connection)', bin: 'deny', explain: 'Backend par bhi default-deny ingress hai, aur uske liye koi allow rule nahi. (Note: established connections ke REPLY packets hamesha chalte hain — stateful.)' },
          { text: 'frontend → backend :8080', bin: 'deny', explain: 'Default-deny sab par hai — backend ke liye koi allow rule banaya hi nahi. Har legitimate raaste ka apna rule chahiye!' },
        ],
      },
      {
        type: 'fill',
        title: 'Zero-Trust Policy Likho',
        instructions: 'War-story ka fix: db ko sirf backend se, sirf 5432 par allow karo.',
        template: 'apiVersion: networking.k8s.io/v1\nkind: {0}\nmetadata:\n  name: allow-backend-to-db\n  namespace: prod\nspec:\n  podSelector:\n    matchLabels:\n      app: {1}\n  policyTypes: [ Ingress ]\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          app: {2}\n    ports:\n    - protocol: TCP\n      port: {3}',
        blanks: [
          { answer: 'NetworkPolicy', explain: 'networking.k8s.io/v1 — pods ka firewall. (Enforce CNI karta hai — Calico/Cilium!)' },
          { answer: 'db', explain: 'podSelector = KISPE policy lagti hai. Yeh db pods ka bodyguard hai.' },
          { answer: 'backend', explain: 'from.podSelector = KAUN aa sakta hai. Sirf backend label wale. Frontend? Compromised pod? Sab bahar.' },
          { answer: '5432', explain: 'Sirf Postgres port. Backend bhi SSH ya metrics port par nahi aa sakta — least privilege, port tak.' },
        ],
        tokens: ['NetworkPolicy', 'db', 'backend', '5432', 'FirewallRule', 'frontend', '8080', '443'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Policy debugging',
        questions: [
          {
            q: 'NetworkPolicy apply ki, par traffic AB BHI sab jagah chal raha hai. Sabse pehla shak?',
            choices: [
              'CNI plugin NetworkPolicy support/enforce nahi karta — policy chup-chaap ignore ho rahi hai',
              'Policy ko restart chahiye',
              'kubectl ka version purana hai',
              'Policies sirf naye pods par lagti hain',
            ],
            answer: 0,
            explain: 'Sabse evil failure mode: NO ERROR, NO EFFECT. Policy object banta hai, enforce koi nahi karta. Minikube default CNI mein bhi yahi hota hai (isliye homework mein --cni=calico!). Pehla sawal hamesha: CNI kya hai?',
          },
          {
            q: 'Egress default-deny lagayi, ab pods "could not resolve host" de rahe hain. Kya hua?',
            choices: [
              'DNS (port 53 → kube-dns) bhi band ho gaya — egress policy mein DNS allow karna bhool gaye',
              'Internet down hai',
              'CoreDNS crash ho gaya',
              'Yeh normal hai, thodi der mein theek hoga',
            ],
            answer: 0,
            explain: 'THE classic egress galti. "Resolve" fail = DNS layer = tumne khud kaata. Har egress policy ke saath: allow UDP/TCP 53 to kube-system/kube-dns. Ab kabhi nahi bhoologe.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Network Security',
      instructions: 'Zero-trust ki soch dikhani hai — sirf syntax nahi. 🎤',
      questions: [
        {
          q: '"By default K8s mein pod-to-pod traffic ka kya rule hai, aur production mein isse kaise handle karte ho?"',
          choices: [
            'Default: SAB ALLOWED (namespaces ke paar bhi) — production mein har namespace mein default-deny + explicit allow rules (zero-trust), taaki compromised pod ka blast radius chhota rahe',
            'Default: sab blocked hota hai, allow karna padta hai',
            'Namespaces automatically network isolate karte hain',
            'Firewall cloud provider ka kaam hai, K8s ka nahi',
          ],
          answer: 0,
          explain: 'Do hisse: (1) surprising default clearly bolo, (2) default-deny pattern + WHY (blast radius). Supply-chain compromise ka example do — 2024-25 ke baad har interviewer ke dimaag mein yahi hai.',
        },
        {
          q: 'NetworkPolicy mein "deny specific pod" ka rule kaise likhoge?',
          choices: [
            'Deny rules hote hi nahi — policies ADDITIVE allows hain; deny chahiye toh default-deny lagao aur usse chhod ke baaki allow karo',
            'kind: DenyPolicy use karke',
            'ingress: deny: {...} section se',
            'Pod ko annotation laga ke',
          ],
          answer: 0,
          explain: 'Conceptual trap! NetworkPolicy mein deny primitive NAHI hai — model hi allow-list ka hai. Yeh samajhna = model samajhna. (Cilium jaise CNIs ke apne CRDs mein deny hota hai — woh alag baat hai, bonus mention.)',
        },
        {
          q: 'Policy sahi dikh rahi hai par traffic block nahi ho raha. Systematic debugging?',
          choices: [
            'CNI enforce karta hai? → policy SAHI namespace mein? → podSelector labels EXACT match? → phir test pod se (kubectl exec + nc/wget) verify',
            'Policy delete karke wapas apply karo',
            'Saare pods restart karo',
            'Cluster upgrade karo',
          ],
          answer: 0,
          explain: 'Order matter karta hai: enforcement layer pehle (CNI), phir scoping (namespace — policies namespace-scoped hain!), phir selectors (typo #1 cause), phir empirical test. Yeh checklist real debugging se aati hai.',
        },
      ],
    },
    success: [
      'Main K8s ke open-by-default network model ka risk samjha sakta hoon',
      'Main default-deny + targeted allow policies likh sakta hoon',
      'Main DNS-block aur CNI-no-enforce jaise classic traps jaanta hoon',
      'Main policy issues systematically debug kar sakta hoon',
    ],
    homework: `<p>Policy enforcement wale CNI ke saath khelo:</p>
      <pre>minikube start -p netpol-lab --cni=calico     # policy-capable CNI!
kubectl create deployment web --image=nginx
kubectl expose deployment web --port=80
kubectl run test --rm -it --image=busybox -- wget -qO- --timeout=2 web   # chalega
# ab default-deny lagao:
kubectl apply -f - &lt;&lt;EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny }
spec: { podSelector: {}, policyTypes: [Ingress] }
EOF
kubectl run test --rm -it --image=busybox -- wget -qO- --timeout=2 web   # TIMEOUT! 🔒
minikube delete -p netpol-lab</pre>
      <p>✅ Self-check: policy se pehle chala, baad mein timeout? Tumne abhi zero-trust ENFORCE kiya.</p>`,
    cards: [
      { front: 'K8s network ka surprising default?', back: '<b>Har pod har pod se baat kar sakta hai</b> — namespaces ke paar bhi. Namespace naming isolate karta hai, network NAHI. Fix: NetworkPolicies (default-deny + allows).' },
      { front: 'Zero-trust pattern K8s mein?', back: '1) Har namespace mein <b>default-deny</b> (podSelector: {}), 2) har legitimate raaste ka explicit allow (kaun→kispe→kis port). Deny rules hote hi nahi — model additive-allow hai!' },
      { front: 'Policy lagayi par koi asar nahi — pehla shak?', back: '<b>CNI enforce nahi karta!</b> (basic CNIs chup-chaap ignore karte hain — no error). Calico/Cilium chahiye. Phir: namespace sahi? selector labels exact?' },
      { front: 'Egress deny ke baad "could not resolve host"?', back: 'DNS bhi kat gaya! Egress policies mein port 53 (kube-dns) allow karna kabhi mat bhoolo — warna pods naam se kuch nahi dhundh paayenge.' },
    ],
  },

  /* ================= LEVEL 16: Autoscaling ================= */
  {
    id: 'autoscale',
    icon: '📈',
    title: 'Autoscaling — HPA & Cluster Autoscaler',
    badge: 'Scale Samrat',
    objectives: [
      '<b>HPA</b> — pods ki ginti metrics se (CPU/memory/custom)',
      'HPA ka requests se rishta — bina requests ke HPA andha hai!',
      '<b>Cluster Autoscaler vs Karpenter</b> — nodes ki ginti',
      'Dono ka dance: pod scale → jagah khatam → node scale',
    ],
    lesson: [
      `<h3>📈 HPA — demand ke saath pods</h3>
       <pre>kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef: { kind: Deployment, name: web }
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target: { type: Utilization, averageUtilization: 60 }</pre>
       <p><b>60% kiska?</b> — <b>REQUESTS ka!</b> "CPU usage / CPU request" average 60% cross
       kare toh replicas badhao. Isliye: <b>bina requests ke HPA kaam hi nahi karta</b>
       (Level 9 wapas aa gaya!). Aur metrics aate hain <b>metrics-server</b> se — woh nahi
       laga toh HPA "unknown" dikhata rahega.</p>
       <p>Custom metrics bhi: requests-per-second, queue length (Prometheus adapter se) —
       CPU se better signal aksar yahi hote hain.</p>`,
      `<h3>🏗️ Nodes bhi elastic — CA vs Karpenter</h3>
       <pre>HPA: replicas 3 → 12  →  5 pods PENDING ("Insufficient cpu")
                     ↓
Cluster Autoscaler: Pending dekha → node group +2 nodes (2-3 min)
        ya
Karpenter: Pending pods ka size dekha → PERFECT-FIT nodes seedha
           provision (~1 min, node groups ki zaroorat nahi)</pre>
       <table>
         <tr><th></th><th>Cluster Autoscaler</th><th>Karpenter (AWS-born, ab open)</th></tr>
         <tr><td>Kaise sochta hai</td><td>Pre-defined node GROUPS scale karta hai</td><td>Pod requirements se node TYPE khud chunta hai</td></tr>
         <tr><td>Speed</td><td>Dheema (group scaling)</td><td>Tez (direct provisioning)</td></tr>
         <tr><td>Cost</td><td>Group ka fixed size type</td><td>Right-sizing + spot-friendly = sasta</td></tr>
       </table>
       <p>💡 <b>Karpenter ki poori duniya</b> — NodePool/EC2NodeClass, consolidation se
       paisa bachana, spot interruption, drift — sab <b>🌲 Karpenter Gurukul</b> track mein
       hai (home screen par, hamesha unlocked). Yahan sirf autoscaling ki badi tasveer.</p>
       <div class="war-story"><b>⚡ Real incident (IPL final syndrome 🏏):</b> Ek streaming
       app ne HPA toh lagaya tha (max 50), par cluster mein nodes fixed the. Match shuru —
       HPA ne 50 pods maange, 30 Pending mein atke (jagah hi nahi!). Users ko buffering.
       Cluster Autoscaler tha hi nahi — "HPA hai na" waali galatfehmi. <b>Seekh: pods aur
       nodes DONO elastic hone chahiye — HPA bina CA ke aadha autoscaling hai.</b></div>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Traffic Spike ka Poora Dance',
        instructions: 'IPL final shuru hua — autoscaling ka poora chain sahi order mein lagao.',
        steps: [
          { text: 'Traffic 5x — pods ka CPU usage requests ke 85% par pahunch gaya', explain: 'Metrics-server har 15s scrape karta hai — yahi HPA ki aankhein hain.' },
          { text: 'HPA ne target (60%) cross dekha → desired replicas 6 → 15', explain: 'Formula: ceil(current × usage/target). HPA Deployment ka replicas field badalta hai — aage wahi purana ReplicaSet flow.' },
          { text: '9 naye pods bane — 5 Running, 4 PENDING (Insufficient cpu)', explain: 'Nodes ki capacity khatam — Scheduler ke paas jagah nahi. Yahin IPL-incident wali app atak gayi thi!' },
          { text: 'Cluster Autoscaler ne Pending pods dekhe → cloud se 2 naye nodes', explain: 'CA unschedulable pods ka signal uthata hai. (Karpenter hota toh pod-size dekh ke perfect nodes aur tezi se.)' },
          { text: 'Naye nodes Ready → Scheduler ne Pending pods unpar rakhe → sab Running', explain: 'Poora elastic loop complete. Match khatam hone par yahi ulta chalega — scale down (dheere, thrashing se bachne ke liye).' },
        ],
      },
      {
        type: 'fill',
        title: 'HPA Likho',
        instructions: 'web Deployment ke liye HPA — 3 se 20 replicas, CPU 60% target.',
        template: 'apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: web-hpa\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: {0}\n  minReplicas: {1}\n  maxReplicas: 20\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: {2}\n\n# Zaroori shart (pod spec mein):\n  resources:\n    requests:\n      cpu: {3}      # iske BINA HPA andha hai!',
        blanks: [
          { answer: 'web', explain: 'Kis Deployment ko scale karna hai. HPA bas replicas field ghumata hai — baaki wahi Deployment machinery.' },
          { answer: '3', explain: 'Floor — traffic zero par bhi 3 (HA ke liye, Level 13 ka anti-affinity in par lagana mat bhoolna!).' },
          { answer: '60', explain: 'Target: average CPU usage = requests ka 60%. Kam target = jaldi scale (mehenga), zyada = late scale (risky).' },
          { answer: '500m', explain: 'THE shart: utilization % REQUESTS ke against hota hai. Requests nahi = HPA "unknown" = koi scaling nahi. Level 9 → Level 16 ka pul!' },
        ],
        tokens: ['web', '3', '60', '500m', 'web-svc', '0', '100', 'unlimited'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Scaling ke nuances',
        questions: [
          {
            q: 'kubectl get hpa dikhata hai TARGETS: <unknown>/60%. Kya check karoge?',
            choices: [
              'metrics-server chal raha hai? + pods mein CPU requests set hain? — dono HPA ki aankhein hain',
              'HPA delete karke naya banao',
              'maxReplicas badhao',
              'Deployment restart karo',
            ],
            answer: 0,
            explain: '"unknown" = HPA ko data hi nahi mil raha. 90% cases: metrics-server missing (minikube: addons enable metrics-server) ya requests nahi likhe. Ab tumhe dono levels ka connection dikh raha hai!',
          },
          {
            q: 'HPA scale-up fast karta hai par scale-DOWN dheere (default 5 min stabilization). Kyun?',
            choices: [
              'Thrashing se bachne ke liye — traffic zigzag mein pods ka banna-marna app ko hila deta hai; scale-up urgent hai, scale-down patient',
              'Cloud provider scale-down charge karta hai',
              'K8s ka bug hai',
              'Pods delete karna slow operation hai',
            ],
            answer: 0,
            explain: 'Design philosophy: under-provisioning users ko dikhta hai (urgent), over-provisioning sirf bill mein (patient). behavior field se tune hota hai — advanced HPA configs mein yahi knob sabse pehle ghumate hain.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Autoscaling',
      instructions: 'HPA vs CA ka farak crisp bolna hai. 🎤',
      questions: [
        {
          q: 'HPA aur Cluster Autoscaler ka division of labour ek line mein?',
          choices: [
            'HPA PODS ki ginti badalta hai (metrics dekh ke); CA/Karpenter NODES ki ginti (Pending pods dekh ke) — HPA demand ka jawab hai, CA capacity ka',
            'Dono nodes scale karte hain alag speed se',
            'HPA vertical scaling karta hai, CA horizontal',
            'CA sirf scale-down ke liye hai',
          ],
          answer: 0,
          explain: 'Signal ka farak bhi bolo: HPA metrics sunta hai (CPU/custom), CA "unschedulable pods" sunta hai. Ek ke bina doosra aadha hai — IPL story sunao toh aur accha!',
        },
        {
          q: 'HPA lagane se pehle kaunsi cheez pod spec mein hona NON-NEGOTIABLE hai?',
          choices: [
            'CPU (ya jo metric use ho uski) REQUESTS — utilization % requests ke against hi calculate hota hai',
            'Liveness probe',
            'Anti-affinity rules',
            'PriorityClass',
          ],
          answer: 0,
          explain: 'Requests → QoS → scheduling → HPA — sab juda hai. "Requests are the currency of Kubernetes" — yeh line interview mein bolo, sab kuch isi se shuru hota hai.',
        },
        {
          q: 'Karpenter, Cluster Autoscaler se kab better choice hai?',
          choices: [
            'Diverse workloads + cost focus: pod requirements se right-sized nodes direct provision (spot bhi), node-groups ka rigid setup nahi, scaling faster',
            'Karpenter hamesha better hai, CA deprecated hai',
            'Sirf GPU workloads ke liye',
            'On-premise clusters ke liye',
          ],
          answer: 0,
          explain: 'Balanced jawab: CA battle-tested aur multi-cloud hai; Karpenter (AWS-born, ab CNCF) flexibility+cost+speed deta hai. "Naye AWS setups mein Karpenter default hota jaa raha hai" — current market ki awaaz.',
        },
      ],
    },
    success: [
      'Main HPA ka formula, requests-dependency aur metrics-server ka role jaanta hoon',
      'Main HPA + CA ka poora elastic chain explain kar sakta hoon',
      'Main "unknown targets" jaise HPA issues debug kar sakta hoon',
      'Main CA vs Karpenter ka informed comparison de sakta hoon',
    ],
    homework: `<p>HPA ko live scale hote dekho — sabse satisfying demo:</p>
      <pre>minikube addons enable metrics-server
kubectl create deployment php-apache --image=registry.k8s.io/hpa-example
kubectl set resources deployment php-apache --requests=cpu=200m
kubectl expose deployment php-apache --port=80
kubectl autoscale deployment php-apache --cpu-percent=50 --min=1 --max=10
kubectl get hpa -w        # pehle <unknown>, phir 0%/50%
# doosre terminal mein LOAD banao:
kubectl run load --rm -it --image=busybox -- \\
  sh -c "while true; do wget -q -O- http://php-apache; done"
# pehle terminal: TARGETS badhega... REPLICAS 1→4→7! 📈
# load wala Ctrl+C karo → 5 min mein wapas 1 (stabilization!)
kubectl delete deploy php-apache load --ignore-not-found; kubectl delete svc php-apache; kubectl delete hpa php-apache</pre>
      <p>✅ Self-check: replicas ko khud badhte-ghatate dekha? Scale-down ka 5-min patience notice kiya?</p>`,
    cards: [
      { front: 'HPA vs Cluster Autoscaler — kaun kya scale karta hai?', back: '<b>HPA</b>: pods (metrics se — CPU%/custom). <b>CA/Karpenter</b>: nodes (Pending pods ke signal se). HPA bina CA ke = pods Pending mein atkenge (IPL syndrome!).' },
      { front: 'HPA ka 60% target — kiska 60%?', back: '<b>REQUESTS ka!</b> usage/request ka average. Isliye bina CPU requests ke HPA "unknown" dikhata hai aur kuch nahi karta. metrics-server bhi zaroori (aankhein).' },
      { front: 'HPA scale-down dheema kyun (5 min)?', back: '<b>Thrashing se bachne ke liye</b> — zigzag traffic par pods ka turant banna-marna app hilaa deta hai. Up = urgent (users), down = patient (sirf bill). behavior field se tunable.' },
      { front: 'Karpenter ka pitch CA ke against?', back: 'Node groups nahi — <b>Pending pods ki requirements se right-sized nodes direct provision</b> (spot-friendly, faster, sasta). AWS-born, ab open/CNCF. Naye AWS setups ka default banta jaa raha hai.' },
    ],
  },

  /* ================= LEVEL 17: BOSS 2 ================= */
  {
    id: 'boss2',
    icon: '🐉',
    title: 'BOSS: Production Outage Night',
    badge: 'Cluster Sadhak',
    objectives: [
      'Track 2 ka sab kuch ek raat mein: QoS, probes, storage, netpol, scaling',
      'Multi-symptom outage ko systematically todna',
      'Final interview gauntlet — intermediate level clear!',
    ],
    lesson: [
      `<h3>🐉 Aaj ki raat lambi hai</h3>
       <p>Black Friday sale — traffic 10x expected. Tum senior on-call ho. Teen rounds:</p>
       <ul>
         <li>🖥️ <b>Round 1:</b> Terminal — sale se pehle ka health-check sweep (kai chhupi problems!)</li>
         <li>🚨 <b>Round 2:</b> Incident — sale LIVE, sab kuch ek saath tootta hai</li>
         <li>🎤 <b>Round 3:</b> Interview gauntlet — Track 2 ka nichod</li>
       </ul>
       <p>Debugging ladder (intro diagram) ko zehan mein rakho: <b>symptom → sahi tool</b>.
       Jai Kubernetes! 🙏</p>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Round 1: Pre-Sale Health Sweep',
        instructions: 'Sale 1 ghante mein. Cluster mein 3 chhupi problems hain — teeno dhundo aur fix karo. (Sab kuch Track 2 se hai!)',
        goal: 'Teen problems: <b>(1)</b> ek pod OOMKilled loop mein, <b>(2)</b> ek deployment ke pods READY 0/1 (traffic nahi milega!), <b>(3)</b> HPA "unknown" targets. Sab investigate karke fixes apply karo (<code>ls</code>).',
        tasks: [
          { text: 'checkout ka OOMKill root-cause + fix', check: s => { const p = s.cluster.pods.find(p => p.name.startsWith('checkout')); return p && p.status === 'Running'; } },
          { text: 'search pods READY karo (probe issue!)', check: s => { const p = s.cluster.pods.find(p => p.name.startsWith('search')); return p && p.ready === '1/1'; } },
          { text: 'HPA ko aankhein do (unknown fix)', check: s => { const h = s.cluster.hpas.find(h => h.name === 'web-hpa'); return h && !h.targets.includes('unknown'); } },
        ],
        cluster: {
          nodes: [
            { name: 'node-1', status: 'Ready', roles: '<none>', age: '90d', version: 'v1.30.2', top: '61% 74%' },
            { name: 'node-2', status: 'Ready', roles: '<none>', age: '90d', version: 'v1.30.2', top: '58% 69%' },
          ],
          pods: [
            {
              name: 'checkout-8a9b0c-x1', ready: '0/1', status: 'CrashLoopBackOff', restarts: 11, age: '2h', node: 'node-1', ip: '10.244.1.60',
              logs: '[checkout] warming cart cache...\n(cut — bina goodbye ke)',
              describe: 'Name:       checkout-8a9b0c-x1\nLimits:     memory: 128Mi   ← sale se pehle kisi ne "optimize" kiya 🙃\nRequests:   memory: 128Mi\nLast State: Terminated\n  Reason:   OOMKilled\n  Exit Code: 137\nEvents:\n  Warning BackOff 5m (x30)  Back-off restarting failed container',
            },
            {
              name: 'search-1d2e3f-y2', ready: '0/1', status: 'Running', restarts: 0, age: '30m', node: 'node-2', ip: '10.244.2.61',
              logs: '[search] index loading... 78%... (boot mein ~3 min lagte hain)',
              describe: 'Name:      search-1d2e3f-y2\nStatus:    Running\nReadiness: http-get :8080/ready delay=0s period=5s #failure=3\n  ← failureThreshold 3 × 5s = 15s window... par boot 3 MIN ka hai!\nEvents:\n  Warning Unhealthy 1m (x40) Readiness probe failed: connection refused',
            },
            { name: 'web-4g5h6i-z3', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.244.1.62', logs: 'serving', describe: 'Name: web-4g5h6i-z3\nStatus: Running\nRequests: <none>   ← 👀 HPA isi wajah se andha hai\nLimits:   <none>' },
          ],
          deployments: [
            { name: 'checkout', ready: '0/1', upToDate: 1, available: 0, age: '2h' },
            { name: 'search', ready: '0/1', upToDate: 1, available: 0, age: '30m' },
            { name: 'web', ready: '1/1', upToDate: 1, available: 1, age: '3d' },
          ],
          services: [
            { name: 'search-svc', type: 'ClusterIP', clusterIP: '10.96.0.90', ports: '80/TCP', age: '30d' },
          ],
          endpoints: [
            { name: 'search-svc', endpoints: '<none>', age: '30d' },
          ],
          hpas: [
            { name: 'web-hpa', reference: 'Deployment/web', targets: '<unknown>/60%', min: 3, max: 30, replicas: 1, age: '1d' },
          ],
        },
        files: {
          'fix-checkout-memory.yaml': {
            desc: 'checkout memory 128Mi → 512Mi (sale-load ke hisaab se)',
            apply: s => {
              const p = s.cluster.pods.find(p => p.name.startsWith('checkout'));
              p.status = 'Running'; p.ready = '1/1';
              p.logs = '[checkout] cart cache warm ✓ (peak 340Mi)\n[checkout] ready for sale 🛒';
              s.cluster.deployments.find(d => d.name === 'checkout').ready = '1/1';
              return 'deployment.apps/checkout configured (512Mi... Running ✓)';
            },
          },
          'fix-search-probe.yaml': {
            desc: 'search par startupProbe (40×5s) + readiness window realistic',
            apply: s => {
              const p = s.cluster.pods.find(p => p.name.startsWith('search'));
              p.ready = '1/1';
              p.logs = '[search] index loaded 100% ✓ ready';
              p.describe = p.describe.replace('← failureThreshold 3 × 5s = 15s window... par boot 3 MIN ka hai!', '✓ startupProbe ne boot ka intezaar kiya');
              s.cluster.deployments.find(d => d.name === 'search').ready = '1/1';
              const ep = s.cluster.endpoints.find(e => e.name === 'search-svc');
              ep.endpoints = '10.244.2.61:8080';
              return 'deployment.apps/search configured\n(startupProbe added: 40×5s = 200s boot window... index loaded... READY 1/1 ✓ endpoints updated!)';
            },
          },
          'fix-web-requests.yaml': {
            desc: 'web pods par CPU requests (300m) — HPA ki aankhein',
            apply: s => {
              const h = s.cluster.hpas.find(h => h.name === 'web-hpa');
              h.targets = '22%/60%'; h.replicas = 3;
              const p = s.cluster.pods.find(p => p.name.startsWith('web'));
              p.describe = p.describe.replace('Requests: <none>   ← 👀 HPA isi wajah se andha hai', 'Requests: cpu: 300m ✓');
              return 'deployment.apps/web configured\n(CPU requests set... HPA: <unknown> → 22%/60% ✓ — ab sale ke waqt scale karega. minReplicas 3 bhi active.)';
            },
          },
          'fix-restart-everything.yaml': {
            desc: 'Sab restart (jugaad)',
            apply: () => 'restarted...\n(checkout phir OOMKilled — limit wahi. search phir NotReady — probe wahi. HPA phir unknown — requests nahi. TEENO problems config ki hain, restart ki nahi!)',
          },
        },
        success: s =>
          s.cluster.pods.find(p => p.name.startsWith('checkout')).status === 'Running' &&
          s.cluster.pods.find(p => p.name.startsWith('search')).ready === '1/1' &&
          !s.cluster.hpas[0].targets.includes('unknown'),
        successText: 'Cluster sale-ready! 🛒 Teen classic patterns ek saath: <b>(1)</b> OOMKilled → describe → limit vs real usage, <b>(2)</b> READY 0/1 + slow boot → probe window chhota tha → startupProbe (aur dekha? endpoints khud aa gaye READY hote hi!), <b>(3)</b> HPA unknown → requests missing. Symptom → tool → targeted fix. Ladder kaam karti hai!',
        hints: [
          'Teen deployments teen problems: kubectl get pods se shuru, phir har bimaar ka describe',
          'checkout: describe → OOMKilled/137 → memory fix. search: describe → readiness window 15s par boot 3 min → probe fix',
          'HPA: kubectl get hpa → unknown → web ka describe → Requests: <none> → requests fix. (Restart-everything mat karna 😄)',
        ],
      },
      {
        type: 'incident',
        title: '🚨 Round 2: Sale is LIVE — Sab Toot Raha Hai',
        instructions: 'Traffic aa gaya. Ek ke baad ek surprises — Track 2 ke saare demons ek raat mein.',
        pager: '<b>ALERT STORM:</b> p99 latency 8s · checkout errors 40% · pods Pending: 14 · 9:00 PM sale peak',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ kubectl get pods | grep -c Pending\n14\n$ kubectl describe pod web-new-abc | tail -3\nWarning FailedScheduling 30s (x12)\n  0/6 nodes are available: 6 Insufficient cpu.',
            text: 'HPA ne scale kiya (accha!) par 14 pods Pending — "Insufficient cpu" har node par. Sabse sahi IMMEDIATE move?',
            choices: [
              { t: 'Cluster Autoscaler/node capacity check — nodes badhao (ya CA ka max limit unlock karo)', good: true, next: 'n2', explain: 'Pods elastic the, nodes nahi (IPL syndrome live!). CA hai toh uska max-nodes limit dekho — aksar wahi cap hota hai. Capacity ke bina scheduling ka koi jugaad nahi.' },
              { t: 'Pending pods delete karo — alerts kam ho jayenge', good: false, explain: 'HPA phir banayega (desired state!) — aur delete karne se CAPACITY nahi aati. Alert chhupana ≠ problem solve karna.' },
              { t: 'Requests ghata do sabke, sab fit ho jayenge', good: false, explain: 'Sale-peak par requests ghatana = overpacking = node-level OOM cascade ka invitation (Level 9 war-story!). Squeeze mat karo, capacity lao.' },
            ],
          },
          n2: {
            sitrep: '+3 nodes aa gaye. Pending clear. Par ab:\n$ kubectl get pods -l app=payments\npayments-aaa   1/1  Running  3  12m   ← restarts?!\npayments-bbb   1/1  Running  4  12m\n\n$ kubectl describe pod payments-aaa | grep -A2 "Last State"\nLast State: Terminated\n  Reason:   OOMKilled\n  Exit Code: 137',
            text: 'Payments pods LOAD mein OOMKill ho rahe hain — restart hote hain, phir load se phir marte hain. 9 PM hai. Best move?',
            choices: [
              { t: 'Memory limit turant badhao (rollout) — sale ke baad leak/profiling investigate', good: true, next: 'n3', explain: 'Mitigate first! Load-correlated OOM at peak = limit realistic karo ABHI (capacity ab hai). Leak vs legit growth ka post-mortem subah — Level 9 ka nuance, sahi time par lagaya.' },
              { t: 'Liveness probe hata do taaki restarts band hon', good: false, explain: 'OOMKill kernel/cgroup se hota hai, liveness se NAHI — probe hatane se kill nahi rukega, sirf visibility jayegi. Galat layer ka ilaaj!' },
              { t: 'Payments ke replicas ghata do — kam pods, kam OOM', good: false, explain: 'Ulta! Kam pods par WAHI traffic = har pod par ZYADA memory pressure = aur tez OOM. Peak par critical service ko chhota karna 🙈.' },
            ],
          },
          n3: {
            sitrep: 'Payments stable ✓. Par ab search team ka message:\n"search results khaali aa rahe kuch users ko"\n\n$ kubectl get endpoints search-svc\nNAME         ENDPOINTS\nsearch-svc   10.244.2.61:8080     ← sirf EK? replicas toh 4 hain!\n\n$ kubectl get pods -l app=search\nsearch-aaa  1/1  Running   ← yeh endpoints mein hai\nsearch-bbb  0/1  Running   ← 0/1!\nsearch-ccc  0/1  Running\nsearch-ddd  0/1  Running',
            text: '4 mein se 3 search pods READY 0/1 — endpoints se bahar, saara load ek pod par. Diagnosis?',
            choices: [
              { t: 'Naye pods (scale-up wale) abhi index load kar rahe hain — startupProbe unhe endpoints se sahi hi rok raha hai; ek warm pod overload na ho isliye thodi der min capacity / gradual scale manage karo', good: true, next: 'end', explain: 'Probes SAHI kaam kar rahe hain — booting pods ko traffic se bacha rahe hain! Problem timing ki hai: sale-peak par cold-start slow app. Ilaaj: pehle se warm replicas (minReplicas upar), ya boot fast karo. Probe hataana bhool ke bhi nahi!' },
              { t: 'Readiness probes hata do — sab endpoints mein aa jayenge, load batega', good: false, explain: 'NAHI! 0/1 pods ka index abhi LOADED hi nahi — unhe traffic doge toh woh KHAALI/error results denge (issi liye complaint aayi thi!). Probe symptom nahi, protection hai.' },
              { t: 'search-aaa ko delete karo, sab barabar ho jayenge', good: false, explain: 'Ekmatra WARM pod ko maar doge?! Phir 100% requests failing. 3 AM logic bhi isse better hota hai. 😅' },
            ],
          },
          end: {
            end: true,
            text: 'Sale bach gayi. Tum so sakte ho. 😴🏆',
            summary: '<b>Aaj raat ke sabak:</b> (1) HPA + CA ek jodi hai — pods elastic, nodes bhi. (2) Peak par mitigate-first: limit badhao, investigate subah. (3) READY 0/1 hamesha dushman nahi — probes ka KAAM hi booting pods ko traffic se bachana hai; asli fix warm capacity hai. Symptom ko nahi, SYSTEM ko samjho — yehi Track 2 tha.',
          },
        },
      },
    ],
    interview: {
      title: '🎤 FINAL Interview Gauntlet — Track 2',
      instructions: 'Intermediate ka nichod. Yeh clear = mid-level K8s engineer solid.',
      questions: [
        {
          q: 'Ek naye microservice ko production-ready bolne ke liye tumhari minimum checklist kya hogi? (Track 2 ka saara gyaan ek jawab mein!)',
          choices: [
            'Requests+limits (sahi QoS), readiness+liveness (+startup agar slow boot), anti-affinity/spread for HA, NetworkPolicy (least privilege), HPA agar variable load — aur PVC/StatefulSet agar state hai',
            'Bas image sahi ho aur replicas 3 hon',
            'LoadBalancer service aur bada node',
            'Monitoring laga do, baaki baad mein',
          ],
          answer: 0,
          explain: 'Yeh sawal interviews mein "design a production deployment" ban ke aata hai. 5 pillars gino: resources, probes, placement, network security, scaling. Har ek Track 2 ka level tha — ab yeh tumhari checklist hai, ratta nahi.',
        },
        {
          q: 'Pod Pending hai. Track 2 ke baad — POSSIBLE reasons ka sabse complete set?',
          choices: [
            'Insufficient resources (requests fit nahi), untolerated taint, required (anti-)affinity satisfy nahi, PVC pending/zone mismatch — sab describe→Events mein dikhega',
            'Sirf resources ki kami hoti hai',
            'Image pull fail hua hoga',
            'Network policy block kar rahi hogi',
          ],
          answer: 0,
          explain: 'Pending = SCHEDULING problem — 4 categories: resources, taints, affinity, volumes. (ImagePull scheduling ke BAAD hota hai — woh alag status hai; NetPol runtime hai.) Events ka message har case mein exact bolta hai — padhna seekh gaye ho ab.',
        },
        {
          q: 'Interviewer: "readiness probe aur Service endpoints ka rishta ek line mein — aur yeh HPA/rollout se kaise judta hai?"',
          choices: [
            'READY pods hi endpoints mein aate hain = traffic unhi ko; rolling update READY count par aage badhta hai, aur naye scaled pods bhi READY ke baad hi load lete hain — poora traffic-lifecycle readiness par khada hai',
            'Endpoints ka probes se koi lena-dena nahi',
            'HPA readiness probe ko trigger karta hai',
            'Rollout endpoints ko delete karta hai',
          ],
          answer: 0,
          explain: 'Readiness = traffic membership ka single source of truth: Services, rollouts, scaling — sab isi par. Yeh ek-line synthesis bolo toh interviewer samajh jaayega ki tumne system SAMJHA hai, features nahi rate.',
        },
      ],
    },
    success: [
      'Main multi-symptom production outage systematically handle kar sakta hoon',
      'Main production-readiness ki 5-pillar checklist de sakta hoon (resources/probes/placement/netpol/scaling)',
      'Main Pending ke saare scheduling reasons enumerate kar sakta hoon',
      'Main officially Cluster Sadhak hoon 🔥 — Advanced track unlocked!',
    ],
    homework: `<p>Apna Track 2 graduation: ek "production-grade" deployment likho jisme SAB ho —
      requests/limits, teeno probes, anti-affinity, HPA. Phir usse todo aur theek karo:</p>
      <pre># khud likho (bina copy kiye!) — phir verify:
kubectl describe deployment mera-app | grep -E "Limits|Requests|Liveness|Readiness"
kubectl get hpa
# todo: memory limit 32Mi kar do → OOMKill dekho → describe → wapas theek karo
# yeh cycle jitni baar karoge, utna reflex banega</pre>
      <p>✅ Self-check: bina google kiye poora YAML likh paaye? Track 2 COMPLETE! 🎓</p>`,
    cards: [
      { front: 'Production-readiness ke 5 pillars?', back: '1) <b>Resources</b> (req/lim → QoS), 2) <b>Probes</b> (startup/readiness/liveness), 3) <b>Placement</b> (anti-affinity/spread), 4) <b>NetworkPolicy</b> (least privilege), 5) <b>Scaling</b> (HPA+CA). Har naye service par yeh checklist.' },
      { front: 'Pod Pending ke 4 possible reason categories?', back: '1) Resources (requests fit nahi), 2) Taints (untolerated), 3) Affinity (required rules unsatisfiable), 4) Volumes (PVC pending/zone). Sab <code>describe → Events</code> mein exact milta hai.' },
      { front: 'Peak-load par OOMKill — sahi crisis response?', back: '<b>Mitigate first</b>: limit badhao abhi (capacity check karke), leak-vs-growth ka analysis subah. Probe hataana/replicas ghataana = galat layer ka ilaaj. Kam pods = per-pod zyada pressure!' },
      { front: 'READY 0/1 pods scale-up ke baad — hamesha bug?', back: 'NAHI! Booting pods ko probes traffic se BACHA rahe hain — yeh unka kaam hai. Asli fix: warm capacity (minReplicas), fast boot, gradual scale. Probe hataya toh khaali/error responses milenge.' },
    ],
  },

]);
