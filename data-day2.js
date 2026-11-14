/* =====================================================================
   KubeGurukul — Track: 🛠️ Day-2 Ops Gurukul  (2026-11)
   "Deploy ho gaya — ab cluster ko mahinon tak zinda kaise rakhein?"

   Saare levels ek hi company ki kahani hain: ChaiPay (UPI payments startup).
     pay-api   = payment lene wali service (Deployment)
     ledger    = hisaab likhne wali service (StatefulSet, ledger-0)
     notify    = SMS/notification worker
   Har level: chhote lesson cards → scene (kadam-dar-kadam diagram) → haath ka kaam → interview.
   Scenes isi file mein hain (VISUALS[...] = …) taaki track ek hi file mein poora rahe.
   ===================================================================== */
(function () {

/* ------------------------------------------------------------------ */
/* LEVEL 1 — kubectl debug                                             */
/* ------------------------------------------------------------------ */
VISUALS['d2-debug'] = {
  t: 'kubectl debug — chalte pod mein toolbox wala container jodna',
  scene: {
    intro: '<b>Sawal:</b> <code>pay-api</code> container mein shell hi nahi hai. Phir andar se network kaise jaanchein?',
    aria: 'kubectl debug se ephemeral container jodne ke 6 kadam',
    groups: [{ label: '📦 Pod: pay-api-7d9f8c6b5-x2k4q', cols: [2, 3], rows: [0, 1], tone: 'good' }],
    nodes: [
      { id: 'you', col: 0, row: 0, icon: '🧑‍💻', label: 'Tum (kubectl)', sub: 'on-call engineer' },
      { id: 'api', col: 1, row: 0, icon: '🚪', label: 'API Server', sub: 'pod spec badalta hai', tone: 'accent', about: 'kubectl debug pod ke spec mein ek naya hissa jodta hai: <code>ephemeralContainers</code>. Pod restart nahi hota.' },
      { id: 'kubelet', col: 1, row: 1, icon: '🧑‍🔧', label: 'kubelet', sub: 'node ka manager', about: 'kubelet ko pod spec mein naya ephemeral container dikhta hai aur kubelet us container ko usi pod ke andar chala deta hai.' },
      { id: 'app', col: 2, row: 0, icon: '📦', label: 'container: pay-api', sub: 'distroless — shell nahi', tone: 'good', about: 'Asli app. Image "distroless" hai: sirf app ki binary hai. <code>sh</code>, <code>curl</code>, <code>ps</code> kuch nahi.' },
      { id: 'dbg', col: 3, row: 0, icon: '🧰', label: 'debugger-x7k2p', sub: 'abhi nahi bana', tone: 'muted', about: 'Ephemeral container. Image <code>busybox</code> hai, isliye shell aur network tools hain. Pod ke saath hi khatam hota hai.' },
      { id: 'net', col: 2, row: 1, icon: '🌐', label: 'Pod ka network', sub: 'ek hi IP, ek hi localhost', tone: 'gold', about: 'Ek pod ke saare containers ek hi network namespace mein rehte hain: wahi IP, wahi <code>localhost</code>, wahi DNS settings.' },
      { id: 'ledger', col: 3, row: 1, icon: '📒', label: 'Service: ledger-svc', sub: 'hisaab wali service' },
    ],
    steps: [
      { from: 'you', to: 'api', label: 'kubectl exec … -- sh', tone: 'bad', say: '<b>Tum</b> pehle purana tareeka aazmate ho: <code>kubectl exec</code>. Jawab aata hai: <code>exec: "sh": executable file not found</code>. <b>container: pay-api</b> ki image mein shell hai hi nahi.' },
      { from: 'you', to: 'api', label: 'kubectl debug …', bend: 24, say: '<b>Tum</b> <code>kubectl debug</code> chalate ho. <b>API Server</b> pod ke spec mein ek <b>ephemeral container</b> jod deta hai. Pod restart nahi hota; <b>container: pay-api</b> chalta rehta hai.' },
      { from: 'api', to: 'kubelet', label: 'naya container', say: '<b>kubelet</b> ko pod spec ka badlaav dikhta hai. kubelet <code>busybox</code> image pull karta hai.' },
      { from: 'kubelet', to: 'dbg', label: 'start', tone: 'good', bend: -30, set: { dbg: { tone: 'accent', sub: 'busybox — shell hai ✓' } }, say: '<b>kubelet</b> usi pod ke andar <b>debugger-x7k2p</b> container chala deta hai. Ab pod mein do containers hain: asli app aur tumhara toolbox.' },
      { from: 'dbg', to: 'net', label: 'wahi localhost', tone: 'gold', say: '<b>debugger-x7k2p</b> aur <b>container: pay-api</b> ek hi <b>Pod ka network</b> istemal karte hain. debugger-x7k2p se <code>wget localhost:8080</code> seedha pay-api ko lagta hai. <code>--target=pay-api</code> diya ho toh debugger-x7k2p ko pay-api ke processes bhi dikhte hain.' },
      { from: 'dbg', to: 'ledger', label: 'wget ledger-svc', say: '<b>debugger-x7k2p</b> se tum wahi call karte ho jo pay-api karta hai: <code>wget http://ledger-svc:8080/healthz</code>. Jo error pay-api ko mil raha tha, wahi error ab tumhari aankhon ke saamne hai — usi pod ke IP aur usi DNS se.' },
    ],
  },
};

/* mission ke shared helpers — state cluster.* mein rehta hai (validator JSON-clone karta hai, isliye sirf data) */
const DBG_POD = 'pay-api-7d9f8c6b5-x2k4q';
const T_DEBUG = [
  { text: '<code>kubectl exec</code> aazmao aur dekho ki shell kyun nahi milta', check: s => !!s.cluster.triedExec },
  { text: 'pay-api pod mein debug container jodo (<code>kubectl debug</code>)', check: s => !!s.cluster.dbg },
  { text: 'Debug container se <code>ledger-svc</code> ko call karo — error dekho', check: s => !!s.cluster.sawSvcFail },
  { text: 'Debug container se ledger pod ke IP <code>10.244.2.15</code> ko seedha call karo', check: s => !!s.cluster.sawPodOk },
  { text: 'Service theek karo, phir debug container se <code>ledger-svc</code> dobara call karke pakka karo', check: s => !!s.cluster.verified },
];
const noDbg = `Error from server (BadRequest): container debugger-x7k2p is not valid for pod ${DBG_POD}\n(pehle kubectl debug se debug container jodo)`;

/* ------------------------------------------------------------------ */
/* LEVEL 2 — right-sizing                                              */
/* ------------------------------------------------------------------ */
VISUALS['d2-rightsize'] = {
  t: 'requests aur limits — kaun sa number kaun padhta hai',
  scene: {
    intro: '<b>Sawal:</b> pod ke YAML mein chaar number hain (CPU request, CPU limit, memory request, memory limit). Har number ko kaun istemal karta hai?',
    aria: 'requests aur limits ko Scheduler, kubelet aur Linux kernel kaise istemal karte hain, 5 kadam',
    groups: [{ label: '🖥️ Worker Node', cols: [1, 3], rows: [1, 1], tone: 'good' }],
    nodes: [
      { id: 'spec', col: 0, row: 0, icon: '📄', label: 'Pod spec: pay-api', sub: 'req 500m · limit 1000m', tone: 'accent', about: '<code>resources.requests</code> aur <code>resources.limits</code>. CPU "m" mein (1000m = 1 core), memory Mi/Gi mein.' },
      { id: 'sched', col: 1, row: 0, icon: '⚖️', label: 'Scheduler', sub: 'sirf REQUESTS padhta hai', about: 'Scheduler node chunte waqt sirf requests jodta hai. Scheduler limits ko dekhta hi nahi, aur asli usage ko bhi nahi.' },
      { id: 'kubelet', col: 1, row: 1, icon: '🧑‍🔧', label: 'kubelet', sub: 'cgroup set karta hai', about: 'kubelet requests/limits ko Linux cgroup ki settings mein badalta hai.' },
      { id: 'cfs', col: 2, row: 1, icon: '⏱️', label: 'Kernel: CPU (CFS)', sub: 'CPU LIMIT lagu karta hai', tone: 'gold', about: 'Linux ka CPU scheduler. Har 100 ms ki khidki mein container ko utna hi CPU time milta hai jitna CPU limit kehta hai. Time khatam → container agli khidki tak ruka rehta hai (throttle).' },
      { id: 'oom', col: 3, row: 1, icon: '💀', label: 'Kernel: OOM killer', sub: 'memory limit ka pehredaar', tone: 'bad', about: 'Container memory limit se zyada memory maange toh kernel container ko maar deta hai. Status: <code>OOMKilled</code>, exit code 137.' },
      { id: 'app', col: 2, row: 0, icon: '📦', label: 'container: pay-api', sub: 'chal raha hai', tone: 'good' },
    ],
    steps: [
      { from: 'spec', to: 'sched', label: 'requests: 500m, 512Mi', say: '<b>Scheduler</b> sirf <b>requests</b> padhta hai. Scheduler aisa node dhoondhta hai jahan 500m CPU aur 512Mi memory abhi kisi ne reserve nahi ki. Request = "itni jagah mere naam likh do".' },
      { from: 'sched', to: 'kubelet', label: 'node-1 par bhejo', say: 'Pod node-1 ko milta hai. node-1 ka <b>kubelet</b> requests aur limits ko Linux cgroup ki settings mein likh deta hai.' },
      { from: 'kubelet', to: 'cfs', label: 'CPU limit: 1000m', tone: 'gold', say: '<b>Kernel: CPU (CFS)</b> ko CPU limit milti hai. Niyam: har 100 ms mein <b>container: pay-api</b> zyada se zyada 100 ms CPU time le sakta hai (1000m = 1 core).' },
      { from: 'cfs', to: 'app', label: 'throttle!', tone: 'bad', set: { app: { tone: 'gold', sub: 'ruka hua (throttled)' } }, say: 'Salary wale din <b>container: pay-api</b> ko 1.5 core chahiye. <b>Kernel: CPU (CFS)</b> 100 ms ka kota 66 ms mein khatam kar deta hai aur baaki 34 ms container ko rok deta hai. Container marta nahi — bas <b>dheema</b> ho jaata hai. Node par CPU khaali ho tab bhi.' },
      { from: 'oom', to: 'app', label: 'OOMKilled (137)', tone: 'bad', set: { app: { tone: 'bad', sub: 'OOMKilled 💀' } }, say: 'Memory ka niyam alag hai. Memory ko "roka" nahi ja sakta. <b>container: pay-api</b> memory limit paar kare toh <b>Kernel: OOM killer</b> container ko seedha maar deta hai. CPU limit = dheema. Memory limit = maut.' },
    ],
  },
};

KG.registerLevels('day2', [
  /* ================================================================== */
  {
    id: 'd2-debug',
    icon: '🧰',
    title: 'kubectl debug — jab container mein shell hi na ho',
    badge: 'Debug Daroga',
    objectives: [
      'Samajhna ki <code>kubectl exec</code> distroless image par kyun fail hota hai',
      '<code>kubectl debug</code> se chalte pod mein <b>ephemeral container</b> jodna',
      'Teen roop: chalta pod · crash hota pod (<code>--copy-to</code>) · node (<code>node/…</code>)',
      'Debug container se "Service kharab hai ya pod kharab hai" alag karna (terminal)',
    ],
    lesson: [
      `<h3>😤 Problem: andar jhaankne ka darwaza band hai</h3>
       <p>ChaiPay ki <code>pay-api</code> service <b>502</b> de rahi hai. Tum purani aadat se likhte ho:</p>
       <pre>$ kubectl exec -it pay-api-7d9f8c6b5-x2k4q -- sh
error: ... exec: "sh": executable file not found in $PATH</pre>
       <p><b>Wajah:</b> <code>pay-api</code> ki image <b>distroless</b> hai. Distroless image mein sirf app ki binary hoti hai.
       Shell nahi, <code>curl</code> nahi, <code>ps</code> nahi.</p>
       <p><b>Distroless kyun?</b> Attacker container mein ghus bhi jaye toh attacker ke paas chalane ko koi tool nahi hota.
       Image chhoti bhi hoti hai. Yaani distroless achhi cheez hai — bas debug karne ka tareeka badalna padta hai.</p>`,
      `<h3>🧰 Hal: apna toolbox saath le jao</h3>
       <p><b>Misaal:</b> dukaan ke andar koi auzaar nahi hai. Mistri apna toolbox lekar <b>usi dukaan ke andar</b> jaata hai.</p>
       <pre>kubectl debug -it pay-api-7d9f8c6b5-x2k4q \\
  --image=busybox:1.36 --target=pay-api</pre>
       <ul>
         <li><code>--image=busybox:1.36</code> → toolbox wali image (shell + wget + nslookup).</li>
         <li><code>--target=pay-api</code> → toolbox ko <code>pay-api</code> container ke <b>processes</b> bhi dikhen.</li>
       </ul>
       <p>Kubernetes pod ke andar ek naya <b>ephemeral container</b> jod deta hai. Pod <b>restart nahi</b> hota.</p>
       <p><b>Asli baat:</b> ek pod ke saare containers ka <b>network ek hi</b> hota hai (wahi IP, wahi localhost, wahi DNS).
       Isliye debug container se kiya gaya har network test wahi dikhata hai jo <code>pay-api</code> ko dikh raha hai.</p>`,
      `<h3>🗂️ Ephemeral container ke 3 niyam + debug ke 3 roop</h3>
       <p><b>Ephemeral container ke niyam:</b> (1) kubelet ephemeral container ko dobara start nahi karta.
       (2) Ek baar jodne ke baad ephemeral container ko pod se hataya nahi ja sakta — pod delete hone par hi jaata hai.
       (3) Ephemeral container mein ports, probes aur resource requests nahi hote.</p>
       <table>
         <tr><th>Haalat</th><th>Command ka roop</th><th>Kya hota hai</th></tr>
         <tr><td>Pod <b>chal raha hai</b></td><td><code>kubectl debug -it POD --image=… --target=CTR</code></td><td>Usi pod mein ephemeral container</td></tr>
         <tr><td>Pod <b>CrashLoopBackOff</b> mein hai</td><td><code>kubectl debug POD -it --copy-to=POD-debug --container=CTR -- sh</code></td><td>Pod ki <b>copy</b> banti hai jisme command badal kar <code>sh</code> hai. Copy par labels nahi hote, isliye Service copy ko traffic nahi bhejta.</td></tr>
         <tr><td>Problem <b>node</b> par hai</td><td><code>kubectl debug node/NODE -it --image=busybox:1.36</code></td><td>Node par ek pod banta hai; node ka poora filesystem <code>/host</code> par milta hai</td></tr>
       </table>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Kaunsa debug roop?',
        instructions: 'Har haalat padho. Us haalat ke liye sahi debug roop wale dabbe mein daalo.',
        bins: [
          { id: 'eph', label: '🧰 Ephemeral container (chalta pod)' },
          { id: 'copy', label: '📋 --copy-to (pod ki copy)' },
          { id: 'node', label: '🖥️ node/… (node par)' },
        ],
        items: [
          { text: 'pay-api Running hai, par ledger-svc ko call nahi kar paa raha', bin: 'eph', explain: 'Pod chal raha hai aur problem abhi ho rahi hai. Usi pod ke network se test karna hai → ephemeral container.' },
          { text: 'notify pod 3 second mein crash hota hai — andar jaane ka waqt hi nahi milta', bin: 'copy', explain: 'Crash hote container mein ephemeral container jodne se faayda nahi: asli container baar-baar marta hai. --copy-to se copy banao jisme command sh hai, phir app ko haath se chalao.' },
          { text: 'node-3 par disk bhar gayi hai — /var/lib/containerd dekhna hai', bin: 'node', explain: 'Disk node ki hai, kisi pod ki nahi. kubectl debug node/node-3 se node ka filesystem /host par milta hai.' },
          { text: 'Dekhna hai ki pay-api ka process kitne file descriptors khol chuka hai', bin: 'eph', explain: '--target=pay-api dene par debug container ko pay-api ke processes dikhte hain. /proc/1/fd ginna ho jaata hai.' },
          { text: 'node-2 ka kubelet log padhna hai (SSH band hai)', bin: 'node', explain: 'kubelet node par chalta hai. node debug pod se /host/var/log aur chroot /host ke baad journalctl milta hai.' },
          { text: 'ledger pod start hote hi config file par atak kar mar jaata hai', bin: 'copy', explain: 'Copy mein command badal kar sh rakho. Phir config file padho aur app ko haath se chalao — crash ka asli error dikhega.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: 502 ka raaz, bina shell ke',
        instructions: 'ChaiPay ki pay-api har payment par 502 de rahi hai. pay-api ki image distroless hai. Debug container se asli wajah dhoondho.',
        goal: `<b>pay-api</b> pod <code>ledger-svc</code> ko call nahi kar paa raha. Pata karo ki kharabi <b>pod</b> mein hai ya <b>Service</b> mein, phir theek karo.
          Debug container ka naam <code>debugger-x7k2p</code> hoga. Debug container mein command aise chalao:
          <code>kubectl exec ${DBG_POD} -c debugger-x7k2p -- &lt;command&gt;</code>`,
        tasks: T_DEBUG,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }, { name: 'node-2', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: DBG_POD, ready: '1/1', status: 'Running', restarts: 0, age: '2h', node: 'node-1', ip: '10.244.1.22',
              logs: 'level=info msg="pay-api listening" port=8080\nlevel=error msg="payment failed" txn=TX8841 err="ledger: request failed"\nlevel=error msg="payment failed" txn=TX8842 err="ledger: request failed"\n(log sirf itna batata hai ki ledger wala call fail hua — kyun fail hua, nahi batata)' },
            { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: 'node-2', ip: '10.244.2.15',
              logs: 'ledger listening on :8080\nGET /healthz 200 (kubelet probe)\nGET /healthz 200 (kubelet probe)\n(ledger ko pay-api se koi request aa hi nahi rahi)' },
          ],
          deployments: [{ name: 'pay-api', ready: '1/1', upToDate: 1, available: 1, age: '2h' }],
          services: [
            { name: 'pay-api-svc', type: 'ClusterIP', clusterIP: '10.96.11.3', ports: '80/TCP', age: '40d' },
            { name: 'ledger-svc', type: 'ClusterIP', clusterIP: '10.96.14.7', ports: '8080/TCP', age: '2h',
              describe: 'Name:              ledger-svc\nSelector:          app=ledger\nType:              ClusterIP\nIP:                10.96.14.7\nPort:              http  8080/TCP\nTargetPort:        8081/TCP      <-- Service traffic ko pod ke port 8081 par bhej raha hai\nEndpoints:         10.244.2.15:8081\n(ledger-0 ka log dekho: ledger port 8080 par sun raha hai, 8081 par nahi)' },
          ],
          endpoints: [{ name: 'ledger-svc', endpoints: '10.244.2.15:8081', age: '2h' }],
        },
        responses: [
          { re: /^kubectl exec (?!.*(-c|--container)[ =])(-\S+ )*pay-api\S*( -\S+)* -- /, err: true,
            mutate: s => { s.cluster.triedExec = true; },
            out: 'error: Internal error occurred: error executing command in container: failed to exec in container: OCI runtime exec failed: exec failed: unable to start container process: exec: "sh": executable file not found in $PATH: unknown\n(pay-api ki image distroless hai — andar koi shell ya tool nahi hai)' },
          { re: /^kubectl debug (?=.*pay-api)(?=.*--image[= ]\S+)(?!.*--copy-to)(?!.*node\/).*$/,
            mutate: s => { s.cluster.dbg = true; },
            out: (s, m) => (/--target[= ]pay-api/.test(m[0] || '') ? 'Targeting container "pay-api". If you don\'t see processes from this container it may be because the container runtime doesn\'t support this feature.\n' : '') +
              'Defaulting debug container name to debugger-x7k2p.\n' +
              '(simulator: asli cluster par ab ek interactive shell khulta. Yahan debug container mein har command aise chalao:\n' +
              ` kubectl exec ${DBG_POD} -c debugger-x7k2p -- nslookup ledger-svc)` },
          { re: /^kubectl exec .*-c[ =]debugger-x7k2p.* -- nslookup ledger-svc\b/,
            err: false,
            out: s => s.cluster.dbg ? 'Server:    10.96.0.10\nAddress:   10.96.0.10:53\n\nName:      ledger-svc.default.svc.cluster.local\nAddress:   10.96.14.7\n(DNS theek hai: naam ledger-svc ka ClusterIP 10.96.14.7 mil gaya)' : noDbg },
          { re: /^kubectl exec .*-c[ =]debugger-x7k2p.* -- wget .*ledger-svc(:8080)?\b/,
            mutate: s => { if (!s.cluster.dbg) return; if (s.cluster.svcFixed) s.cluster.verified = true; else s.cluster.sawSvcFail = true; },
            out: s => !s.cluster.dbg ? noDbg : s.cluster.svcFixed ? 'ok\n(ledger-svc se jawab aa gaya — ab pay-api ke payments chalenge)'
              : 'wget: can\'t connect to remote host (10.96.14.7): Connection refused\n(ClusterIP tak baat pahunchi, par aage kisi ne darwaza nahi khola)' },
          { re: /^kubectl exec .*-c[ =]debugger-x7k2p.* -- wget .*10\.244\.2\.15(:8080)?\b/,
            mutate: s => { if (s.cluster.dbg) s.cluster.sawPodOk = true; },
            out: s => s.cluster.dbg ? 'ok\n(ledger pod seedhe IP par port 8080 se jawab de raha hai → pod theek hai. Kharabi pod aur client ke BEECH mein hai: Service.)' : noDbg },
          { re: /^kubectl exec .*-c[ =]debugger-x7k2p.* -- (ps|ps aux|ps -ef)$/,
            out: s => s.cluster.dbg ? 'PID   USER     TIME  COMMAND\n    1 65532     0:41 /pay-api          <-- --target ki wajah se pay-api ka process dikh raha hai\n   14 root      0:00 sh\n   21 root      0:00 ps' : noDbg },
          { re: /^kubectl exec .*-c[ =]debugger-x7k2p.* -- /,
            out: s => s.cluster.dbg ? '(simulator: debug container mein yeh commands chalte hain: nslookup ledger-svc · wget -qO- -T 3 http://ledger-svc:8080/healthz · wget -qO- -T 3 http://10.244.2.15:8080/healthz · ps)' : noDbg },
        ],
        files: {
          'fix-svc-targetport.yaml': {
            desc: 'Service ledger-svc ka targetPort 8081 se 8080 karta hai',
            content: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: ledger-svc\nspec:\n  selector:\n    app: ledger\n  ports:\n    - name: http\n      port: 8080\n      targetPort: 8080   # pehle 8081 tha',
            apply: s => {
              s.cluster.svcFixed = true;
              const svc = s.cluster.services.find(x => x.name === 'ledger-svc');
              svc.describe = 'Name:              ledger-svc\nSelector:          app=ledger\nType:              ClusterIP\nIP:                10.96.14.7\nPort:              http  8080/TCP\nTargetPort:        8080/TCP\nEndpoints:         10.244.2.15:8080';
              s.cluster.endpoints[0].endpoints = '10.244.2.15:8080';
              s.cluster.pods[0].logs = 'level=info msg="pay-api listening" port=8080\nlevel=info msg="payment ok" txn=TX8850 ledger=written';
              return 'service/ledger-svc configured\n(ab debug container se ledger-svc ko dobara call karke pakka karo)';
            },
          },
          'fix-restart-pay-api.yaml': {
            desc: 'pay-api Deployment ko restart karta hai',
            apply: () => 'deployment.apps/pay-api restarted\n(naya pod bhi wahi "Connection refused" pa raha hai. Restart se Service ka targetPort nahi badalta. Aur dhyaan do: purana pod gaya toh debug container bhi gaya.)',
          },
          'fix-coredns.yaml': {
            desc: 'CoreDNS ko restart karta hai',
            apply: () => 'deployment.apps/coredns restarted\n(kuch nahi badla. nslookup pehle se sahi IP de raha tha — DNS kabhi kharab tha hi nahi.)',
          },
        },
        success: KG.allOf(T_DEBUG),
        successText: `Tumne teen cheezein alag-alag jaanchi, isi kram mein: <b>DNS</b> (nslookup → theek), <b>Service</b> (wget ledger-svc → Connection refused), <b>pod</b> (wget pod IP → ok).
          Pod theek + Service kharab = Service ka <code>targetPort</code> galat. <b>Yaad rakho:</b> debug container usi pod ke network se test karta hai, isliye result par bharosa kiya ja sakta hai.
          Apne laptop se kiya gaya test doosre network se hota hai.`,
        hints: [
          'Pehle kubectl exec aazmao: kubectl exec ' + DBG_POD + ' -- sh. Error padho. Phir kubectl debug -it ' + DBG_POD + ' --image=busybox:1.36 --target=pay-api',
          'Debug container se teen test karo: nslookup ledger-svc, phir wget -qO- -T 3 http://ledger-svc:8080/healthz, phir wget -qO- -T 3 http://10.244.2.15:8080/healthz',
          'Pod IP par jawab aata hai, Service par nahi. kubectl describe svc ledger-svc mein TargetPort dekho. Fix: kubectl apply -f fix-svc-targetport.yaml, phir wget ledger-svc dobara.',
        ],
        solution: [
          'kubectl get pods -o wide',
          `kubectl logs ${DBG_POD}`,
          `kubectl exec ${DBG_POD} -- sh`,
          `kubectl debug -it ${DBG_POD} --image=busybox:1.36 --target=pay-api`,
          `kubectl exec ${DBG_POD} -c debugger-x7k2p -- nslookup ledger-svc`,
          `kubectl exec ${DBG_POD} -c debugger-x7k2p -- wget -qO- -T 3 http://ledger-svc:8080/healthz`,
          `kubectl exec ${DBG_POD} -c debugger-x7k2p -- wget -qO- -T 3 http://10.244.2.15:8080/healthz`,
          'kubectl describe svc ledger-svc',
          'kubectl apply -f fix-svc-targetport.yaml',
          `kubectl exec ${DBG_POD} -c debugger-x7k2p -- wget -qO- -T 3 http://ledger-svc:8080/healthz`,
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — debug container ke niyam',
        questions: [
          {
            q: 'Tumne pay-api pod mein debug container joda. Kaam ho gaya. Ab debug container ko pod se kaise hataoge?',
            choices: [
              'kubectl delete container debugger-x7k2p chala kar — ephemeral container alag object hai',
              'Hata nahi sakte — ephemeral container pod delete hone par hi jaata hai',
              'kubectl debug --remove chala kar — kubelet container ko turant band kar deta hai',
              'kubectl edit pod se ephemeralContainers wali line mita kar save karne par',
            ],
            answer: 1,
            explain: 'Ephemeral container ek baar judne ke baad pod spec se nahi hatta. Shell se bahar aane par container ruk jaata hai, par entry pod mein bani rehti hai. Pod ko saaf karna ho toh pod ko delete karo — Deployment naya pod bana dega.',
          },
          {
            q: 'notify pod CrashLoopBackOff mein hai. Tumne --copy-to se pod ki copy banayi. Copy ko Service ka traffic kyun nahi milta?',
            choices: [
              'Kyunki copy hamesha doosre namespace mein banti hai jahan Service nahi hai',
              'Kyunki copy ka container sh chala raha hai aur app ka port 8080 khula hi nahi hai',
              'Kyunki kubectl debug copy se labels hata deta hai; Service ka selector match nahi karta',
              'Kyunki copy par ek taint lagta hai jo kube-proxy ko traffic bhejne se rokta hai',
            ],
            answer: 2,
            explain: 'Service pods ko label selector se chunta hai. kubectl debug --copy-to default mein labels copy nahi karta, isliye copy na Service ke peeche judti hai na ReplicaSet ki ginti mein aati hai. Labels chahiye hon toh --keep-labels dena padta hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — production debugging',
      instructions: 'Interviewer jaanna chahta hai ki tum bina shell wale container ko kaise debug karte ho. 🎤',
      questions: [
        {
          q: '"Hamari images distroless hain. Production pod mein network problem debug kaise karoge?"',
          choices: [
            'Image mein curl aur bash jod kar dobara build aur deploy karunga, phir kubectl exec se andar jaunga',
            'kubectl debug se usi pod mein tools wali image ka ephemeral container jodunga; network wahi, restart nahi',
            'Node par SSH karke docker exec se container ke andar jaunga, kyunki node par saare tools hote hain',
            'Apne laptop se kubectl port-forward karke curl chalaunga; laptop ka test pod ke test jaisa hi hota hai',
          ],
          answer: 1,
          explain: 'Ephemeral container ka faayda: (1) image nahi badalti, (2) pod restart nahi hota toh bug gayab nahi hota, (3) test usi pod ke IP/DNS/NetworkPolicy se hota hai. Image mein tools jodna distroless ka maqsad hi tod deta hai.',
        },
        {
          q: '"--target flag kya karta hai, aur na do toh kya farak padta hai?"',
          choices: [
            '--target batata hai debug container kis node par chalega; na do toh scheduler koi bhi node chun leta hai',
            '--target debug container ko us container ka network deta hai; na do toh debug container ka alag IP hota hai',
            '--target us container ka process namespace share karta hai; na do toh us container ke processes nahi dikhte',
            '--target us container ko rok kar debug container ko uski jagah chalata hai; na do toh dono saath chalte hain',
          ],
          answer: 2,
          explain: 'Network namespace pod ke saare containers mein hamesha saanjha hota hai. Process namespace alag hota hai. --target=&lt;container&gt; se debug container ko us container ke processes (aur /proc/&lt;pid&gt;/root se files) dikhte hain.',
        },
        {
          q: '"Pod start hote hi crash ho jaata hai. kubectl debug ka kaunsa roop kaam aayega aur kyun?"',
          choices: [
            'Ephemeral container, kyunki ephemeral container asli container ko crash hone se rok deta hai',
            'kubectl debug node/…, kyunki crash hamesha node ki disk ya memory ki wajah se hota hai',
            'kubectl logs --previous kaafi hai; crash hote pod ke liye kubectl debug ka koi roop kaam nahi karta',
            '--copy-to wali copy jisme command badal kar sh ho; copy zinda rehti hai aur app ko haath se chalaya ja sakta hai',
          ],
          answer: 3,
          explain: 'Crash hote pod mein asli container baar-baar marta hai. Copy mein command sh hota hai, isliye copy zinda rehti hai. Andar jaakar config dekho aur app ko haath se chalao — asli error saamne aata hai. Kaam ke baad copy pod ko delete karna mat bhoolna.',
        },
      ],
    },
    success: [
      'Main distroless pod ko <code>kubectl debug</code> se debug kar sakta hoon',
      'Main bata sakta hoon ki kharabi DNS mein hai, Service mein hai ya pod mein',
      'Main chalta pod, crash hota pod aur node — teeno ke liye sahi debug roop chun sakta hoon',
    ],
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 16 — kubectl debug</b> (Home → Real Cluster Labs). Wahan asli distroless pod hai.</p>
      <pre>kubectl debug -it &lt;pod&gt; --image=busybox:1.36 --target=&lt;container&gt;
kubectl debug &lt;pod&gt; -it --copy-to=&lt;pod&gt;-debug --container=&lt;container&gt; -- sh
kubectl debug node/&lt;node&gt; -it --image=busybox:1.36    # node ka filesystem: /host</pre>`,
    cards: [
      { front: 'Distroless image par <code>kubectl exec -- sh</code> kyun fail hota hai?', back: 'Image mein shell hai hi nahi. Error: <code>exec: "sh": executable file not found in $PATH</code>. Hal: <code>kubectl debug</code>.' },
      { front: '<code>kubectl debug -it POD --image=busybox:1.36 --target=CTR</code> kya banata hai?', back: 'Usi pod mein ek <b>ephemeral container</b>. Network pod ka hi hota hai. <code>--target</code> se CTR ke processes bhi dikhte hain. Pod restart nahi hota.' },
      { front: 'Ephemeral container ke 3 niyam?', back: '(1) Dobara start nahi hota. (2) Pod se hataya nahi ja sakta. (3) Ports, probes, resource requests nahi hote.' },
      { front: 'CrashLoopBackOff wale pod ko debug karne ka roop?', back: '<code>kubectl debug POD -it --copy-to=POD-debug --container=CTR -- sh</code> — copy banti hai, command sh hota hai, labels nahi hote (Service traffic nahi bhejta).' },
      { front: 'Node ka filesystem bina SSH ke kaise dekhen?', back: '<code>kubectl debug node/NODE -it --image=busybox:1.36</code> — node ka root filesystem <code>/host</code> par milta hai.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'd2-rightsize',
    icon: '📏',
    title: 'Requests aur Limits ka sahi naap — throttling, OOM aur barbaad paisa',
    badge: 'Naap-Tol Ustaad',
    objectives: [
      'Request aur limit ka farak: kaun sa number <b>kaun</b> padhta hai',
      'CPU limit = dheema (throttle). Memory limit = maut (OOMKilled)',
      'Zyada request = barbaad paisa. Kam request = bheed mein CPU nahi',
      'Slider se pay-api ka sahi naap dhoondhna + throttling ka case pakadna',
    ],
    lesson: [
      `<h3>🍽️ Misaal: restaurant ki table</h3>
       <p><b>Request = booking.</b> Tumne 4 logon ki table book ki. Table tumhare naam hai, chahe 2 hi log aayein.
       Restaurant us table par kisi aur ko nahi bitha sakta.</p>
       <p><b>Limit = "isse zyada log nahi".</b> 6 log aa gaye toh 2 ko bahar rukna padega.</p>
       <p>Kubernetes mein:</p>
       <ul>
         <li><b>Request</b> ko <b>Scheduler</b> padhta hai. Scheduler node par jagah <i>reserve</i> karta hai.</li>
         <li><b>Limit</b> ko <b>Linux kernel</b> lagu karta hai, jab container chal raha hota hai.</li>
       </ul>
       <p><b>Asli baat:</b> Scheduler asli usage nahi dekhta. Pod 50m CPU use kare aur request 2000m ho, toh bhi node par 2000m "bhara hua" gina jaata hai.</p>`,
      `<h3>🐢 CPU limit = dheema &nbsp;·&nbsp; 💀 Memory limit = maut</h3>
       <p><b>CPU</b> ko roka ja sakta hai. Kernel har <b>100 ms</b> ki khidki mein container ko limit jitna CPU time deta hai.
       Kota khatam → container agli khidki tak ruka rehta hai. Isko <b>throttling</b> kehte hain.</p>
       <p>Throttling ka jaal: dashboard par CPU "sirf 40%" dikhta hai, node bhi khaali hai, phir bhi API <b>dheemi</b> hai.</p>
       <pre># throttling ka anupaat (Prometheus):
rate(container_cpu_cfs_throttled_periods_total[5m])
  / rate(container_cpu_cfs_periods_total[5m])</pre>
       <p><b>Memory</b> ko roka nahi ja sakta. Container memory limit paar kare toh kernel container ko maar deta hai:
       <code>OOMKilled</code>, exit code <code>137</code>.</p>`,
      `<h3>💸 Naap galat = do tarah ka nuksaan</h3>
       <table>
         <tr><th>Galti</th><th>Kya hota hai</th></tr>
         <tr><td>Request <b>bahut zyada</b></td><td>Node "bhara" dikhta hai par khaali chal raha hai. Zyada nodes kharidne padte hain. <b>Paisa barbaad.</b></td></tr>
         <tr><td>Request <b>bahut kam</b></td><td>Node par bheed ho toh CPU request ke anupaat mein bantta hai. Kam request wala pod <b>bhookha</b> reh jaata hai.</td></tr>
         <tr><td>CPU limit <b>bahut kam</b></td><td>Peak par <b>throttling</b> → latency badhti hai.</td></tr>
         <tr><td>Memory limit <b>bahut kam</b></td><td>Peak par <b>OOMKilled</b> → restart.</td></tr>
       </table>
       <p><b>Shuruaat ka niyam (kai teams yahi karti hain):</b> CPU request ≈ p95 usage. Memory request = memory limit ≈ peak + 20%.
       CPU limit ya toh peak se upar rakho, ya mat rakho. Naap hamesha <b>asli usage ke data</b> se nikalo
       (<code>kubectl top pod</code>, Prometheus, ya VPA ki recommendation) — andaaze se nahi.</p>`,
    ],
    stages: [
      {
        type: 'slider',
        title: '🎚️ Lab: pay-api ka sahi naap',
        instructions: 'Teen knob ghumao. Har number turant badalta hai. Neeche likha KAAM poora karo.',
        scenario: `ChaiPay ki <b>pay-api</b> ke <b>20 replicas</b> chalte hain. Pichhle 30 din ka data (har replica):
          <ul><li>CPU: aam din mein p95 = <b>400m</b>, salary wale din peak = <b>900m</b></li>
          <li>Memory: peak = <b>700Mi</b></li>
          <li>Maan lo 1 vCPU ka mahine ka kharcha <b>₹2,500</b> hai</li></ul>
          Abhi kisi ne "safe rehne ke liye" CPU request 1500m rakh di hai, aur CPU limit 600m.`,
        goal: 'Aisa naap chuno ki: peak par throttling na ho, peak par OOMKilled na ho, CPU request p95 (400m) se kam na ho, aur barbaad paisa ₹5,000/mahina se zyada na ho.',
        knobs: [
          { id: 'req', label: 'CPU request', min: 100, max: 2000, step: 100, value: 1500, unit: 'm' },
          { id: 'lim', label: 'CPU limit', min: 200, max: 2000, step: 100, value: 600, unit: 'm' },
          { id: 'mem', label: 'Memory limit', min: 256, max: 2048, step: 128, value: 512, unit: 'Mi' },
        ],
        readouts: k => {
          const waste = Math.max(0, k.req - 400) / 1000 * 20 * 2500;
          const thr = k.lim < 900 ? Math.round((900 - k.lim) / 900 * 100) : 0;
          return [
            { label: 'YAML valid?', value: k.lim >= k.req ? 'haan' : 'NAHI', state: k.lim >= k.req ? 'good' : 'bad',
              hint: k.lim >= k.req ? 'limit ≥ request' : 'API Server mana karega: request limit se badi nahi ho sakti' },
            { label: 'Peak par throttling', value: thr + '%', state: thr === 0 ? 'good' : thr < 20 ? 'warn' : 'bad',
              hint: thr === 0 ? 'peak 900m ≤ limit' : `peak 900m chahiye, limit ${k.lim}m hai → ${thr}% kaam rukta hai` },
            { label: 'Peak par memory', value: k.mem >= 700 ? 'theek' : 'OOMKilled', state: k.mem >= 700 ? 'good' : 'bad',
              hint: k.mem >= 700 ? `peak 700Mi ≤ limit ${k.mem}Mi` : `peak 700Mi > limit ${k.mem}Mi → kernel container ko maar dega` },
            { label: 'Bheed mein CPU ki guarantee', value: k.req >= 400 ? 'theek' : 'kam', state: k.req >= 400 ? 'good' : 'warn',
              hint: k.req >= 400 ? 'request p95 (400m) ko dhakti hai' : 'request p95 se kam → bheed wale node par pay-api bhookha rahega' },
            { label: 'Barbaad paisa / mahina', value: '₹' + waste.toLocaleString('en-IN'), state: waste <= 5000 ? 'good' : waste <= 20000 ? 'warn' : 'bad',
              hint: `(${k.req}m − 400m) × 20 replicas × ₹2,500` },
          ];
        },
        bars: k => [
          { label: 'CPU request vs p95', pct: Math.min(100, k.req / 20), state: k.req < 400 ? 'warn' : k.req <= 600 ? 'good' : 'bad', cap: `${k.req}m reserve · 400m istemal` },
          { label: 'CPU limit vs peak', pct: Math.min(100, k.lim / 20), state: k.lim >= 900 ? 'good' : 'bad', cap: `${k.lim}m limit · 900m peak` },
          { label: 'Memory limit vs peak', pct: Math.min(100, k.mem / 20.48), state: k.mem >= 700 ? 'good' : 'bad', cap: `${k.mem}Mi limit · 700Mi peak` },
        ],
        verdict: k => {
          if (k.lim < k.req) return { ok: false, text: 'CPU request CPU limit se badi hai. API Server pod ko banne hi nahi dega.' };
          if (k.mem < 700) return { ok: false, text: 'Salary wale din pay-api <b>OOMKilled</b> hoga: memory peak 700Mi hai aur limit usse kam.' };
          if (k.lim < 900) return { ok: false, text: 'Salary wale din pay-api <b>throttle</b> hoga: CPU peak 900m hai aur limit usse kam. Payments dheeme honge.' };
          if (k.req < 400) return { ok: false, text: 'CPU request p95 se kam hai. Bheed wale node par pay-api ko aam din ka CPU bhi pakka nahi milega.' };
          if (Math.max(0, k.req - 400) / 1000 * 20 * 2500 > 5000) return { ok: false, text: 'Sab chal raha hai, par CPU request zaroorat se bahut zyada hai. Har mahine paisa khaali reserve ki hui jagah par ja raha hai.' };
          return { ok: true, text: 'Naap sahi hai: peak par na throttling, na OOM. CPU request p95 ke paas hai, isliye paisa bhi barbaad nahi ho raha.' };
        },
        check: k => k.lim >= k.req && k.mem >= 700 && k.lim >= 900 && k.req >= 400 && Math.max(0, k.req - 400) / 1000 * 20 * 2500 <= 5000,
        lesson: 'Dhyaan do ki do number alag kaam karte hain: <b>CPU request</b> ko p95 ke paas rakha (paisa + guarantee), aur <b>CPU limit</b> ko peak ke upar (throttling nahi). Shuru wala naap ulta tha: request bahut badi (₹55,000/mahina barbaad) aur limit bahut chhoti (salary wale din throttling).',
        quiz: {
          q: 'Shuru mein CPU request 1500m thi aur asli p95 usage 400m. Scheduler ke hisaab se har replica node par kitna CPU "bhara" tha?',
          choices: ['400m — Scheduler asli usage dekhta hai', '1500m — Scheduler sirf request dekhta hai', '600m — Scheduler CPU limit dekhta hai', '900m — Scheduler peak usage dekhta hai'],
          answer: 1,
          explain: 'Scheduler sirf requests jodta hai. 20 replicas × 1500m = 30 vCPU reserve the, jabki asli zaroorat 8 vCPU ki thi. Baaki 22 vCPU ke liye nodes kharide gaye jo khaali chal rahe the.',
        },
      },
      {
        type: 'triage',
        title: '🩺 Case: "CPU sirf 45% hai, phir API dheemi kyun?"',
        instructions: 'Commands chuno. Har command asli output deta hai. Saare clue milne par sawal khulega.',
        symptom: `<b>Alert:</b> <code>pay-api</code> ka p99 latency 180 ms se <b>900 ms</b> ho gaya (salary wala din, subah 10 baje).<br>
          Team ka kehna hai: "CPU graph toh 45% hi dikha raha hai, aur node bhi khaali hai. Zaroor ledger database dheema hai."`,
        commands: [
          { cmd: 'kubectl top pod -l app=pay-api', clue: true,
            out: 'NAME                       CPU(cores)   MEMORY(bytes)\npay-api-7d9f8c6b5-x2k4q    498m         610Mi\npay-api-7d9f8c6b5-m8n2p    500m         598Mi\npay-api-7d9f8c6b5-q7w1z    497m         604Mi',
            note: 'Teeno pods <b>~500m</b> par atke hain — ek hi number par, jaise koi chhat ho. Asli load mein pods ka CPU alag-alag hota hai.' },
          { cmd: 'kubectl describe pod pay-api-7d9f8c6b5-x2k4q | grep -A6 Limits', clue: true,
            out: '    Limits:\n      cpu:     500m\n      memory:  1Gi\n    Requests:\n      cpu:     400m\n      memory:  1Gi',
            note: 'CPU <b>limit 500m</b> hai. Pods theek isi chhat par atke hain. ("45%" wala graph node ke CPU ka tha, pod ki limit ka nahi.)' },
          { cmd: 'promql: rate(container_cpu_cfs_throttled_periods_total{pod=~"pay-api.*"}[5m]) / rate(container_cpu_cfs_periods_total{pod=~"pay-api.*"}[5m])', clue: true,
            out: '{pod="pay-api-7d9f8c6b5-x2k4q"}  0.62\n{pod="pay-api-7d9f8c6b5-m8n2p"}  0.64\n{pod="pay-api-7d9f8c6b5-q7w1z"}  0.61',
            note: 'Har 100 khidkiyon mein se <b>~62</b> mein pay-api ko roka gaya. Yahi throttling hai — latency ka seedha kaaran.' },
          { cmd: 'kubectl top node', clue: false,
            out: 'NAME     CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)\nnode-1   1820m        45%      9800Mi          61%\nnode-2   1650m        41%      9100Mi          57%',
            note: 'Node par CPU khaali hai. Par CPU limit har container ki apni hoti hai — node khaali ho tab bhi limit wala container ruka rehta hai.' },
          { cmd: 'kubectl logs ledger-0 --tail=5', clue: false,
            out: 'query ok 4ms\nquery ok 3ms\nquery ok 5ms\nquery ok 4ms\nquery ok 3ms',
            note: 'ledger 3–5 ms mein jawab de raha hai. Database dheema nahi hai — team ka andaaza galat tha.' },
        ],
        questions: [
          {
            q: 'pay-api dheemi kyun hai?',
            choices: [
              'ledger database dheema hai, isliye pay-api ke requests line mein lag rahe hain',
              'pay-api ki CPU limit 500m hai; peak par kernel pay-api ko rok raha hai (throttling)',
              'Node par CPU khatam ho gaya hai, isliye saare pods ko kam CPU mil raha hai',
              'pay-api ki memory limit kam hai, isliye pods baar-baar OOMKilled ho rahe hain',
            ],
            answer: 1,
            explain: 'Teen saboot: (1) saare pods theek 500m par atke hain, (2) CPU limit 500m hai, (3) throttled periods ka anupaat 62% hai. Node khaali hai aur ledger tez hai — dono andaaze galat nikle.',
          },
          {
            q: 'Sabse sahi fix kya hai?',
            choices: [
              'pay-api ki CPU limit ko peak (900m) se upar le jao, ya CPU limit hata do',
              'pay-api ki memory limit 1Gi se 2Gi kar do taaki container ko zyada jagah mile',
              'Cluster mein do naye nodes jodo taaki node ka CPU 45% se neeche aa jaye',
              'ledger-0 ko bada instance do kyunki pay-api ka latency ledger par nirbhar hai',
            ],
            answer: 0,
            explain: 'Rukawat CPU limit hai, toh CPU limit ko badlo. Naye nodes se kuch nahi badlega: node pehle se khaali hai aur limit har container par alag lagti hai. Replicas badhana bhi madad karta, par wajah wahi rehti.',
          },
        ],
      },
      {
        type: 'match',
        bonus: true,
        title: 'Good to Know — lakshan aur wajah',
        instructions: 'Baayen lakshan hai, daayen uski wajah. Jodi banao.',
        pairs: [
          { left: 'Status OOMKilled, exit code 137', right: 'Container ne memory limit paar ki', explain: 'Memory ko roka nahi ja sakta, isliye kernel container ko maar deta hai. 137 = 128 + 9 (SIGKILL).' },
          { left: 'Latency zyada, pod ka CPU ek hi number par atka', right: 'CPU limit par throttling', explain: 'CPU limit par container marta nahi, rukta hai. cfs_throttled_periods badhta hai.' },
          { left: 'Pod Pending: "Insufficient cpu", par nodes khaali chal rahe hain', right: 'Doosre pods ki requests bahut badi hain', explain: 'Scheduler requests ginta hai, usage nahi. Badi requests node ko kaagaz par bhar deti hain.' },
          { left: 'Node par bheed mein ek pod bahut dheema, doosra theek', right: 'Dheeme pod ki CPU request bahut kam hai', explain: 'Bheed mein kernel CPU ko requests ke anupaat mein baantta hai. Kam request = chhota hissa.' },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — resources',
      instructions: 'Yeh sawal lagbhag har Kubernetes interview mein aata hai. 🎤',
      questions: [
        {
          q: '"Request aur limit mein kya farak hai? Kaun sa kab kaam aata hai?"',
          choices: [
            'Request minimum hai jo container ko start hote hi mil jaata hai; limit maximum hai jo sirf Scheduler dekhta hai',
            'Request Scheduler ke liye reservation hai; limit ko kernel runtime par lagu karta hai — CPU par throttle, memory par OOMKill',
            'Request aur limit dono Scheduler ke liye hain; kubelet runtime par sirf requests ko lagu karta hai',
            'Request CPU ke liye hoti hai aur limit memory ke liye; dono ko ek hi resource par nahi lagaya ja sakta',
          ],
          answer: 1,
          explain: 'Do alag waqt, do alag padhne wale. Scheduling ke waqt: Scheduler + requests. Chalte waqt: kernel + limits. Yeh ek vaakya interview mein bol do toh aadha sawal ho gaya.',
        },
        {
          q: '"Dashboard par pod ka CPU 50% hai, node khaali hai, phir bhi latency badh gayi. Kya jaanchoge?"',
          context: 'kubectl top pod → saare replicas ~500m\nLimits: cpu 500m',
          choices: [
            'CPU throttling ka metric (cfs_throttled_periods), aur pod ka CPU limit par atka hai ya nahi',
            'Node ka swap usage aur disk IOPS, kyunki latency ka kaaran hamesha disk hoti hai',
            'Pod ke restarts aur OOMKilled events, kyunki latency OOM se pehle badhti hai',
            'Service ke Endpoints, kyunki latency tab badhti hai jab Endpoints ki ginti kam ho jaye',
          ],
          answer: 0,
          explain: 'Saare replicas ka ek hi number par atakna = chhat (limit). Throttling ka metric yahi saabit karta hai. "50%" aksar node ya request ke muqable ka graph hota hai, limit ke muqable ka nahi.',
        },
        {
          q: '"Team har service ko 2 CPU request de deti hai \'safe rehne ke liye\'. Isme kya galat hai?"',
          choices: [
            'Kuch galat nahi; request sirf ek hint hai aur Scheduler asli usage ke hisaab se pods ko pack karta hai',
            'Zyada request se pods throttle hote hain, kyunki kernel request se upar ka CPU rok deta hai',
            'Scheduler requests se node bharta hai; nodes kaagaz par bhar jaate hain aur khaali chalte hain — bill badhta hai',
            'Zyada request se pods OOMKilled hote hain, kyunki memory request bhi apne aap badh jaati hai',
          ],
          answer: 2,
          explain: 'Request = reservation. 400m use karne wala pod 2000m reserve kare toh 1600m ka paisa barbaad. Naap asli usage (p95) se nikalo; VPA ki recommendation ya Prometheus ka data dekho.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki request aur limit ko kaun padhta hai aur kab',
      'Main CPU throttling ko pehchaan sakta hoon aur metric se saabit kar sakta hoon',
      'Main usage ke data se request aur limit ka naap nikaal sakta hoon',
    ],
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 17 — CPU throttling aur OOMKilled</b>. Wahan tum container ka <code>cpu.stat</code> khud padhoge.</p>
      <pre>kubectl top pod --containers
kubectl describe pod &lt;pod&gt; | grep -A6 Limits
kubectl exec &lt;pod&gt; -- cat /sys/fs/cgroup/cpu.stat   # nr_throttled, throttled_usec</pre>`,
    cards: [
      { front: 'Request ko kaun padhta hai? Limit ko kaun lagu karta hai?', back: '<b>Request</b> → Scheduler (node par jagah reserve). <b>Limit</b> → Linux kernel, jab container chal raha ho.' },
      { front: 'CPU limit paar karne par kya hota hai? Memory limit paar karne par?', back: 'CPU: container <b>throttle</b> hota hai (dheema, marta nahi). Memory: container <b>OOMKilled</b> (exit 137).' },
      { front: 'CPU throttling ko kis metric se saabit karte hain?', back: '<code>rate(container_cpu_cfs_throttled_periods_total[5m]) / rate(container_cpu_cfs_periods_total[5m])</code> — jitna zyada, utni zyada rukawat.' },
      { front: 'Request bahut badi rakhne ka nuksaan?', back: 'Scheduler requests ginta hai, usage nahi. Nodes kaagaz par bhar jaate hain, asal mein khaali chalte hain → zyada nodes → zyada bill.' },
    ],
  },
]);

})();
