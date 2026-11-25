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
      { from: 'kubelet', to: 'dbg', label: 'start', tone: 'good', set: { dbg: { tone: 'accent', sub: 'busybox — shell hai ✓' } }, say: '<b>kubelet</b> usi pod ke andar <b>debugger-x7k2p</b> container chala deta hai. Ab pod mein do containers hain: asli app aur tumhara toolbox.' },
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
          Abhi naap andaaze se rakha gaya hai: CPU request <b>200m</b>, CPU limit <b>600m</b>, memory limit <b>512Mi</b>.`,
        goal: 'Aisa naap chuno ki: peak par throttling na ho, peak par OOMKilled na ho, CPU request p95 (400m) se kam na ho, aur barbaad paisa ₹5,000/mahina se zyada na ho.',
        knobs: [
          { id: 'req', label: 'CPU request', min: 100, max: 2000, step: 100, value: 200, unit: 'm' },
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
        lesson: 'Dhyaan do ki har number ka apna kaam hai: <b>CPU request</b> ko p95 ke paas rakha (guarantee mile, paisa barbaad na ho), <b>CPU limit</b> ko peak ke upar (throttling nahi), aur <b>memory limit</b> ko peak ke upar (OOMKilled nahi). Shuru wala naap teeno jagah galat tha. CPU request ko 1500m tak kheench kar dekho: sab "chalta" hai, par ₹55,000/mahina khaali reserve ki hui jagah par jaata hai.',
        quiz: {
          q: 'Maan lo koi "safe rehne ke liye" CPU request 1500m rakh de, jabki asli p95 usage 400m hai. Scheduler ke hisaab se har replica node par kitna CPU "bhara" hai?',
          choices: ['400m — Scheduler asli usage dekhta hai', '1500m — Scheduler sirf request dekhta hai', '600m — Scheduler CPU limit dekhta hai', '900m — Scheduler peak usage dekhta hai'],
          answer: 1,
          explain: 'Scheduler sirf requests jodta hai. 20 replicas × 1500m = 30 vCPU reserve hote, jabki asli zaroorat 8 vCPU ki hai. Baaki 22 vCPU ke liye nodes kharidne padte jo khaali chalte.',
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
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 17 — CPU throttling</b>. Wahan tum container ka <code>cpu.stat</code> khud padhoge.</p>
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

/* ------------------------------------------------------------------ */
/* LEVEL 3 — cluster upgrade                                           */
/* ------------------------------------------------------------------ */
VISUALS['d2-upgrade'] = {
  t: 'Cluster upgrade — kis kram mein, aur PDB kahan rokta hai',
  scene: {
    intro: '<b>Sawal:</b> ChaiPay ka cluster v1.32 se v1.33 par jaana hai, aur payments ek second ke liye bhi band nahi hone chahiye. Kram kya hai?',
    aria: 'cluster upgrade ke 8 kadam: jaanch, control plane, add-ons, naya node, cordon, drain, PDB, purana node hatana',
    nodes: [
      { id: 'git', col: 0, row: 0, icon: '📁', label: 'Git ke manifests', sub: 'purane apiVersion?', about: 'Tumhare Deployment/HPA/Ingress ke YAML aur Helm charts. Kubernetes ke naye version mein kuch purane <code>apiVersion</code> hata diye jaate hain.' },
      { id: 'cp', col: 1, row: 0, icon: '🧠', label: 'Control Plane', sub: 'v1.32', tone: 'accent', about: 'API Server, etcd, Scheduler, Controller Manager. EKS par AWS chalata hai; tum bas "upgrade" dabate ho.' },
      { id: 'addons', col: 2, row: 0, icon: '🧩', label: 'Add-ons', sub: 'CoreDNS, kube-proxy, CNI', about: 'Cluster ke apne helper: DNS (CoreDNS), Service routing (kube-proxy), pod networking (CNI). Har add-on ka version cluster version se mel khana chahiye.' },
      { id: 'old', col: 0, row: 1, icon: '🖥️', label: 'node-old-1', sub: 'kubelet v1.32', about: 'Purana worker node. Is par abhi pay-api ka ek pod chal raha hai.' },
      { id: 'pdb', col: 1, row: 1, icon: '🛡️', label: 'PDB: pay-api-pdb', sub: 'minAvailable: 1', tone: 'gold', about: 'PodDisruptionBudget. Niyam: "pay-api ke kam se kam 1 pod hamesha chalte rehne chahiye". Drain is niyam ko todne wali eviction nahi kar sakta.' },
      { id: 'new', col: 2, row: 1, icon: '🖥️', label: 'node-new-1', sub: 'abhi nahi bana', tone: 'muted', about: 'Naye version ka worker node.' },
    ],
    steps: [
      { at: ['git'], say: 'Sabse pehle <b>Git ke manifests</b> jaancho. Kya koi YAML aisa <code>apiVersion</code> use karta hai jo v1.33 mein nahi hai? Tools: <code>kubent</code>, <code>pluto</code>, aur EKS ka "Upgrade insights" tab. Deprecated API ki jaanch upgrade se <b>pehle</b> hoti hai.' },
      { at: ['cp'], set: { cp: { sub: 'v1.33 ✓', tone: 'good' } }, say: '<b>Control Plane</b> pehle upgrade hota hai, aur ek baar mein sirf <b>ek minor version</b> (1.32 → 1.33). Dhyaan do: Control Plane ko wapas purane version par nahi laya ja sakta.' },
      { from: 'cp', to: 'addons', label: 'version milao', say: '<b>Add-ons</b> (CoreDNS, kube-proxy, CNI) ko us version par lao jo naye <b>Control Plane</b> ke saath chalta hai.' },
      { at: ['new'], set: { new: { sub: 'kubelet v1.33 ✓', tone: 'good' } }, say: 'Naya node <b>node-new-1</b> v1.33 ke kubelet ke saath judta hai. <b>node-old-1</b> abhi bhi chal raha hai: kubelet Control Plane se 3 minor version tak purana ho sakta hai, par naya kabhi nahi.' },
      { from: 'cp', to: 'old', label: 'cordon', tone: 'gold', set: { old: { sub: 'SchedulingDisabled', tone: 'gold' } }, say: '<code>kubectl cordon node-old-1</code>: Scheduler ab <b>node-old-1</b> par koi naya pod nahi bhejega. Purane pods abhi chal rahe hain.' },
      { from: 'old', to: 'pdb', label: 'pay-api pod hataun?', say: '<code>kubectl drain node-old-1</code> har pod ke liye <b>eviction</b> maangta hai. <b>PDB: pay-api-pdb</b> jaanchta hai: is pod ke jaane ke baad bhi kam se kam 1 pay-api pod chalta rahega?' },
      { from: 'pdb', to: 'new', label: 'haan — naya pod yahan', tone: 'good', say: 'pay-api ke 2 pods hain, toh jawab "haan" hai. Pod <b>node-old-1</b> se hatta hai aur ReplicaSet naya pod <b>node-new-1</b> par banata hai. Agar pay-api ka sirf 1 pod hota, toh PDB mana kar deta aur drain atka rehta.' },
      { at: ['old'], set: { old: { sub: 'khaali → terminate', tone: 'muted' } }, say: '<b>node-old-1</b> khaali ho gaya. Ab node-old-1 ko terminate karo. Yahi teen kadam (cordon → drain → terminate) har purane node ke liye dohrao.' },
    ],
  },
};

const T_UPGRADE = [
  { text: '<code>node-old-1</code> ko drain karne ki koshish karo aur error padho', check: s => !!s.cluster.drainBlocked },
  { text: 'PDB dekho: kaun sa PDB 0 disruption allow kar raha hai?', check: s => s.history.some(h => /^kubectl (get|describe) (pdb|poddisruptionbudgets?)\b/.test(h)) },
  { text: '<code>notify</code> ko drain-layak banao — PDB ko hataye bina', check: s => s.cluster.notifyReplicas === 2 },
  { text: '<code>node-old-1</code> ka drain poora karo', check: s => !!s.cluster.drained },
  { text: 'Drain ke baad <code>kubectl get pods -o wide</code> se pakka karo ki app pods naye node par hain', check: s => !!s.cluster.drained && s.history.slice(s.cluster.drainedAt).some(h => /^kubectl get (pods?|po)\b.*-o ?wide/.test(h)) },
];
/* drain ka poora niyam ek jagah: cordon → DaemonSet flag → eviction (PDB) */
function drainOld1(s, flags) {
  const c = s.cluster;
  const node = c.nodes.find(n => n.name === 'node-old-1');
  node.status = 'Ready,SchedulingDisabled';
  if (/--force|--disable-eviction/.test(flags)) {
    return '(simulator ne roka) --force / --disable-eviction PDB ko bypass kar dete hain: notify ka akela pod turant mar jaata aur notify tab tak band rehta jab tak naya pod Ready na ho. Production mein yahi outage hota hai. PDB ka kehna maano — pehle notify ko drain-layak banao.';
  }
  if (!/--ignore-daemonsets/.test(flags)) {
    return 'node/node-old-1 cordoned\nerror: unable to drain node "node-old-1" due to error: cannot delete DaemonSet-managed Pods (use --ignore-daemonsets to ignore): kube-system/kube-proxy-7xk2m, continuing command...\nThere are pending nodes to be drained:\n node-old-1\n(DaemonSet ka pod har node par hota hi hai — use hatane ka koi matlab nahi. Flag jodo: --ignore-daemonsets)';
  }
  const out = ['node/node-old-1 cordoned', 'Warning: ignoring DaemonSet-managed Pods: kube-system/kube-proxy-7xk2m'];
  const pay = c.pods.find(p => p.name === 'pay-api-6b8d7c-a1');
  if (pay) {
    out.push('evicting pod default/pay-api-6b8d7c-a1', 'pod/pay-api-6b8d7c-a1 evicted');
    c.pods.splice(c.pods.indexOf(pay), 1, { name: 'pay-api-6b8d7c-n7', ready: '1/1', status: 'Running', restarts: 0, age: '20s', node: 'node-new-1', ip: '10.244.3.11' });
  }
  const old = c.pods.find(p => p.name === 'notify-5c9d4f-k3');
  if (old && c.notifyReplicas !== 2) {
    c.drainBlocked = true;
    out.push('evicting pod default/notify-5c9d4f-k3',
      'error when evicting pods/"notify-5c9d4f-k3" -n "default" (will retry after 5s): Cannot evict pod as it would violate the pod\'s disruption budget.',
      'evicting pod default/notify-5c9d4f-k3',
      'error when evicting pods/"notify-5c9d4f-k3" -n "default" (will retry after 5s): Cannot evict pod as it would violate the pod\'s disruption budget.',
      '^C  (drain har 5 second par dobara koshish karta rehta hai. Tumne Ctrl+C se roka. node-old-1 abhi bhi cordoned hai.)');
    return out.join('\n');
  }
  if (old) {
    out.push('evicting pod default/notify-5c9d4f-k3', 'pod/notify-5c9d4f-k3 evicted');
    c.pods.splice(c.pods.indexOf(old), 1, { name: 'notify-5c9d4f-q4', ready: '1/1', status: 'Running', restarts: 0, age: '15s', node: 'node-new-1', ip: '10.244.3.13' });
  }
  c.drained = true;
  c.drainedAt = s.history.length;
  out.push('node/node-old-1 drained');
  return out.join('\n');
}
function notifyTo2(s) {
  const c = s.cluster;
  if (c.notifyReplicas === 2) return 'deployment.apps/notify unchanged';
  c.notifyReplicas = 2;
  c.pods.push({ name: 'notify-5c9d4f-p8', ready: '1/1', status: 'Running', restarts: 0, age: '10s', node: 'node-new-1', ip: '10.244.3.12' });
  c.deployments.find(d => d.name === 'notify').ready = '2/2';
  const pdb = c.custom.pdb.items.find(x => x.name === 'notify-pdb');
  pdb.row = ['1', 'N/A', '1', '40d'];
  pdb.describe = 'Name:           notify-pdb\nMin available:  1\nSelector:       app=notify\nStatus:\n    Allowed disruptions:  1     <-- ab 1 pod hat sakta hai\n    Current:              2\n    Desired:              1\n    Total:                2';
  return 'deployment.apps/notify configured\n(notify ka doosra pod notify-5c9d4f-p8 node-new-1 par Running hai. Ab notify-pdb 1 disruption allow karta hai.)';
}

/* ------------------------------------------------------------------ */
/* LEVEL 4 — backup & restore                                          */
/* ------------------------------------------------------------------ */
VISUALS['d2-backup'] = {
  t: 'Velero — backup kahan jaata hai, restore kahan se aata hai',
  scene: {
    intro: '<b>Sawal:</b> kisi ne galti se <code>payments</code> namespace delete kar diya. Wapas kya-kya aa sakta hai, aur kahan se?',
    aria: 'Velero backup aur restore ke 6 kadam',
    nodes: [
      { id: 'cli', col: 0, row: 0, icon: '💻', label: 'velero CLI', sub: 'tumhara laptop', about: 'CLI khud backup nahi leta. CLI sirf cluster mein ek <code>Backup</code> object banata hai.' },
      { id: 'api', col: 1, row: 0, icon: '🚪', label: 'API Server', sub: 'saare objects yahin', tone: 'accent' },
      { id: 's3', col: 2, row: 0, icon: '🪣', label: 'S3 bucket', sub: 'objects ka tarball', tone: 'gold', about: 'Cluster ke BAHAR ka storage. Kubernetes objects (YAML/JSON) yahan ek tarball mein rakhe jaate hain. Cluster poora ud jaye tab bhi bucket bachi rehti hai.' },
      { id: 'pv', col: 0, row: 1, icon: '💽', label: 'PV: ledger-data', sub: 'ledger ki disk (EBS)', about: 'ledger-0 ka asli data isi disk par hai. Objects ka tarball disk ke andar ka data nahi rakhta.' },
      { id: 'velero', col: 1, row: 1, icon: '⛵', label: 'Velero pod', sub: 'cluster ke andar', tone: 'good', about: 'Velero ka server. Yahi pod asli kaam karta hai: objects padhna, S3 mein likhna, disk ka snapshot banwana.' },
      { id: 'snap', col: 0, row: 2, icon: '📸', label: 'EBS snapshot', sub: 'disk ki tasveer', tone: 'gold', about: 'Disk ka point-in-time copy, AWS ke paas. Velero CSI driver se snapshot banwata hai.' },
    ],
    steps: [
      { from: 'cli', to: 'api', label: 'Backup object', say: '<b>velero CLI</b> <b>API Server</b> mein ek <code>Backup</code> object banata hai: "payments namespace ka backup lo".' },
      { from: 'api', to: 'velero', label: 'naya Backup', say: '<b>Velero pod</b> API Server ko dekh raha tha. Velero pod ko naya <code>Backup</code> object dikhta hai.' },
      { from: 'velero', to: 'api', label: 'saare objects do', bend: 26, say: '<b>Velero pod</b> <b>API Server</b> se payments namespace ke saare objects maangta hai: Deployments, Services, ConfigMaps, Secrets, PVCs.' },
      { from: 'velero', to: 's3', label: 'tarball upload', tone: 'gold', say: '<b>Velero pod</b> un objects ko ek tarball banakar <b>S3 bucket</b> mein rakh deta hai. Ab objects cluster ke bahar surakshit hain.' },
      { from: 'pv', to: 'snap', label: 'snapshot', tone: 'gold', say: 'Objects mein disk ka <b>data</b> nahi hota. Isliye Velero CSI driver se <b>PV: ledger-data</b> ka <b>EBS snapshot</b> banwata hai. Snapshot fail ho jaye toh backup ka status <code>PartiallyFailed</code> hota hai — objects hain, data nahi.' },
      { from: 's3', to: 'velero', label: 'restore', tone: 'good', say: 'Restore ulta chalta hai: <b>Velero pod</b> <b>S3 bucket</b> se objects padhkar API Server mein dobara banata hai, aur EBS snapshot se nayi disk banti hai. Dhyaan do: jo object cluster mein pehle se maujood hai, Velero use <b>chhod deta hai</b> — overwrite nahi karta.' },
    ],
  },
};

const BK_BAD = 'payments-daily-20261114020010', BK_GOOD = 'payments-daily-20261113020011';
const T_BACKUP = [
  { text: 'Dekho ki cluster se kya gayab hai (<code>kubectl get ns</code> ya <code>kubectl get pods</code>)', check: s => s.history.some(h => /^kubectl get (ns|namespaces?|pods?|po)\b/.test(h)) },
  { text: 'Velero ke backups ki list dekho', check: s => s.history.includes('velero backup get') },
  { text: 'Dono backups ka <code>describe --details</code> padho — kaun sa backup poora hai?', check: s => !!s.cluster.sawBad && !!s.cluster.sawGood },
  { text: 'Us backup se restore karo jisme ledger ki disk ka snapshot hai', check: s => s.cluster.restored === 'good' },
  { text: 'Restore ke baad <code>ledger-0</code> ke log se pakka karo ki entries wapas aa gayi', check: s => s.cluster.restored === 'good' && s.history.slice(s.cluster.restoredAt).some(h => /^kubectl logs ledger-0\b/.test(h)) },
];
function veleroRestore(s, backup) {
  const c = s.cluster;
  if (backup !== BK_BAD && backup !== BK_GOOD) return `An error occurred: backups.velero.io "${backup}" not found\n(naam galat hai — velero backup get se sahi naam copy karo)`;
  const rname = backup + '-20261114110' + (5 + c.restores.length);
  if (c.restored) {
    c.restores.push({ name: rname, backup, status: 'Completed', warn: 48 });
    return `Restore request "${rname}" submitted successfully.\n...\nRestore completed with status: Completed. Warnings: 48\n  Namespaces: payments: could not restore, Deployment "pay-api" already exists. Warning: the in-cluster version is different than the backed-up version.\n  (aisi 48 lines)\n(Velero ne kuch nahi badla: payments namespace ke objects pehle se maujood hain, aur Velero maujood object ko overwrite nahi karta.\n Galat restore hata kar dobara karna ho toh pehle: kubectl delete namespace payments)`;
  }
  const good = backup === BK_GOOD;
  c.restored = good ? 'good' : 'bad';
  c.restoredAt = s.history.length;
  c.restores.push({ name: rname, backup, status: good ? 'Completed' : 'PartiallyFailed', warn: 0 });
  c.custom.ns.items.push({ name: 'payments', row: ['Active', '30s'] });
  c.pods.push(
    { name: 'pay-api-6b8d7c-r1', ready: '1/1', status: 'Running', restarts: 0, age: '25s', node: 'node-1', ip: '10.244.1.31', logs: 'level=info msg="pay-api listening" port=8080' },
    { name: 'pay-api-6b8d7c-r2', ready: '1/1', status: 'Running', restarts: 0, age: '25s', node: 'node-2', ip: '10.244.2.31', logs: 'level=info msg="pay-api listening" port=8080' },
    { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '20s', node: 'node-2', ip: '10.244.2.32',
      logs: good ? 'ledger starting...\ndata dir /var/lib/ledger: found\nledger: 18,442 entries loaded\nlast entry: 2026-11-13 01:58:41 IST\nledger listening on :8080'
                 : 'ledger starting...\ndata dir /var/lib/ledger: EMPTY — initializing new ledger\nledger: 0 entries loaded      <-- disk khaali hai: is backup mein disk ka snapshot tha hi nahi\nledger listening on :8080' });
  return `Restore request "${rname}" submitted successfully.\nRun \`velero restore describe ${rname}\` or \`velero restore logs ${rname}\` for more details.\n...\nRestore completed with status: ${good ? 'Completed' : 'PartiallyFailed'}.` +
    (good ? '\n(48 objects wapas bane. ledger-data ki disk EBS snapshot se bani.)' : '\n(48 objects wapas bane, par ledger-data ke liye koi snapshot nahi tha → nayi KHAALI disk bani.)');
}

KG.registerLevels('day2', [
  /* ================================================================== */
  {
    id: 'd2-upgrade',
    icon: '⬆️',
    title: 'Cluster Upgrade — bina outage ke, sahi kram mein',
    badge: 'Upgrade Ustaad',
    objectives: [
      'Upgrade ka kram: jaanch → Control Plane → add-ons → nodes',
      'Version skew: kubelet Control Plane se kitna purana ho sakta hai',
      '<code>cordon</code>, <code>drain</code> aur <b>PodDisruptionBudget (PDB)</b> ka rishta',
      'PDB se atke hue drain ko bina outage ke kholna (terminal)',
    ],
    lesson: [
      `<h3>🏗️ Upgrade kyun, aur kitni baar?</h3>
       <p>Kubernetes ka naya minor version lagbhag har <b>4 mahine</b> mein aata hai (1.32, 1.33, 1.34 …).
       Purane version ka support khatam ho jaata hai. EKS par ek version ka standard support lagbhag <b>14 mahine</b> chalta hai;
       uske baad "extended support" ka alag se paisa lagta hai.</p>
       <p>Yaani upgrade ek baar ka kaam nahi hai. Yeh <b>saal mein 2–3 baar</b> ka kaam hai.</p>
       <p><b>Do pakke niyam:</b></p>
       <ul>
         <li>Control Plane ek baar mein <b>ek hi minor version</b> upar jaata hai. 1.31 se seedha 1.33 nahi.</li>
         <li>Control Plane ko <b>wapas neeche nahi</b> la sakte. Isliye jaanch upgrade se <b>pehle</b> hoti hai.</li>
       </ul>`,
      `<h3>🔢 Kram: jaanch → Control Plane → add-ons → nodes</h3>
       <ol>
         <li><b>Jaanch:</b> kya tumhare YAML / Helm charts koi aisa <code>apiVersion</code> use karte hain jo naye version mein hata diya gaya?
         Tools: <code>kubent</code>, <code>pluto</code>, EKS "Upgrade insights".</li>
         <li><b>Control Plane</b> upgrade.</li>
         <li><b>Add-ons</b>: CoreDNS, kube-proxy, CNI.</li>
         <li><b>Nodes</b>: naye version ke nodes jodo, purane nodes ek-ek karke khaali karo aur hatao.</li>
       </ol>
       <p><b>Version skew:</b> kubelet Control Plane se <b>3 minor version tak purana</b> chal sakta hai, par <b>naya kabhi nahi</b>.
       Isi liye Control Plane pehle, nodes baad mein.</p>
       <p><b>Hataye gaye API ka jaal:</b> cluster ke andar ke purane objects chalte rehte hain. Tootta hai <b>agla deploy</b>. Jaise v1.26 mein
       <code>autoscaling/v2beta2</code> (HPA) hata tha — us upgrade ke baad purana YAML:</p>
       <pre>error: resource mapping not found ... no matches for kind
"HorizontalPodAutoscaler" in version "autoscaling/v2beta2"</pre>
       <p><b>Deprecated ≠ removed:</b> deprecated API abhi chalta hai (sirf warning); removed API chalta hi nahi. Haal ke hataye gaye:
       v1.32 mein <code>flowcontrol.apiserver.k8s.io/v1beta3</code>; v1.33 mein koi API hata nahi, bas <code>v1 Endpoints</code> deprecated hua
       (warning: <code>v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice</code>). Sahi list: Kubernetes ki "Deprecated API Migration Guide".</p>`,
      `<h3>🛡️ drain aur PDB — outage se bachane wali jodi</h3>
       <p><code>kubectl cordon NODE</code> → node par naye pods aana band. Purane pods chalte rehte hain.</p>
       <p><code>kubectl drain NODE</code> → node ke pods ko ek-ek karke <b>evict</b> karta hai. Controller doosre node par naya pod bana deta hai.</p>
       <p><b>PodDisruptionBudget (PDB)</b> ek niyam hai: "is app ke kam se kam itne pods hamesha chalne chahiye".
       Drain PDB todne wali eviction nahi kar sakta — drain ruk kar baar-baar koshish karta rehta hai.</p>
       <pre>kubectl drain node-old-1 --ignore-daemonsets --delete-emptydir-data</pre>
       <p><b>Sabse aam jaal:</b> app ka <b>1 hi replica</b> hai aur PDB kehta hai <code>minAvailable: 1</code>.
       1 mein se 0 pod hat sakte hain → drain hamesha ke liye atka. Hal PDB hatana <b>nahi</b> hai. Hal: replicas 2 karo.</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Upgrade ka sahi kram banao',
        instructions: 'ChaiPay ka cluster v1.32 se v1.33 par ja raha hai. Kadam sahi kram mein lagao.',
        steps: [
          { text: 'kubent / pluto se jaancho: koi manifest hataya gaya apiVersion toh nahi use karta', explain: 'Control Plane wapas neeche nahi aata. Isliye toot-phoot ki jaanch sabse pehle.' },
          { text: 'Control Plane ko v1.33 par upgrade karo', explain: 'Control Plane hamesha pehle. kubelet Control Plane se naya nahi ho sakta.' },
          { text: 'Add-ons (CoreDNS, kube-proxy, CNI) ko v1.33 ke saath chalne wale version par lao', explain: 'Add-ons Control Plane ke version par nirbhar hain. Nodes badalne se pehle inhe theek karo.' },
          { text: 'v1.33 wale naye nodes cluster mein jodo', explain: 'Pehle nayi jagah banao, phir purani khaali karo. Ulta karoge toh evict hue pods ko jagah nahi milegi.' },
          { text: 'Purane node ko cordon karo, phir drain karo', explain: 'cordon = naye pods band. drain = purane pods ko PDB ka dhyaan rakhte hue hatao.' },
          { text: 'Khaali purane node ko terminate karo; agle purane node par jao', explain: 'Ek-ek node. Saare purane nodes ek saath drain karoge toh capacity achanak gir jayegi.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: drain jo khatam hi nahi hota',
        instructions: 'Control Plane v1.33 par ja chuka hai. node-new-1 jud chuka hai. Ab node-old-1 ko khaali karna hai — bina kisi service ko band kiye.',
        goal: `<b>node-old-1</b> ko drain karo. Drain kisi wajah se atkega. Wajah dhoondho aur aisa hal nikalo jisme <b>notify</b> service ek second ke liye bhi band na ho.
          Drain ka command: <code>kubectl drain node-old-1 --ignore-daemonsets --delete-emptydir-data</code>`,
        tasks: T_UPGRADE,
        cluster: {
          notifyReplicas: 1,
          nodes: [
            { name: 'node-old-1', status: 'Ready', roles: '<none>', age: '120d', version: 'v1.32.9' },
            { name: 'node-old-2', status: 'Ready', roles: '<none>', age: '120d', version: 'v1.32.9' },
            { name: 'node-new-1', status: 'Ready', roles: '<none>', age: '12m', version: 'v1.33.4' },
          ],
          pods: [
            { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-old-1', ip: '10.244.1.20' },
            { name: 'pay-api-6b8d7c-b2', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-old-2', ip: '10.244.2.20' },
            { name: 'notify-5c9d4f-k3', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-old-1', ip: '10.244.1.21' },
            { name: 'kube-proxy-7xk2m', ready: '1/1', status: 'Running', restarts: 0, age: '120d', node: 'node-old-1', ip: '10.0.1.14' },
          ],
          deployments: [
            { name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' },
            { name: 'notify', ready: '1/1', upToDate: 1, available: 1, age: '40d' },
          ],
          custom: {
            pdb: {
              names: ['pdb', 'poddisruptionbudget', 'poddisruptionbudgets'],
              cols: ['NAME', 'MIN AVAILABLE', 'MAX UNAVAILABLE', 'ALLOWED DISRUPTIONS', 'AGE'],
              items: [
                { name: 'pay-api-pdb', row: ['1', 'N/A', '1', '40d'],
                  describe: 'Name:           pay-api-pdb\nMin available:  1\nSelector:       app=pay-api\nStatus:\n    Allowed disruptions:  1\n    Current:              2\n    Desired:              1\n    Total:                2' },
                { name: 'notify-pdb', row: ['1', 'N/A', '0', '40d'],
                  describe: 'Name:           notify-pdb\nMin available:  1\nSelector:       app=notify\nStatus:\n    Allowed disruptions:  0     <-- ek bhi pod nahi hat sakta\n    Current:              1     <-- notify ka sirf 1 pod hai\n    Desired:              1\n    Total:                1' },
              ],
            },
          },
        },
        responses: [
          { re: /^kubectl cordon node-old-1$/, mutate: s => { s.cluster.nodes.find(n => n.name === 'node-old-1').status = 'Ready,SchedulingDisabled'; }, out: 'node/node-old-1 cordoned' },
          { re: /^kubectl uncordon node-old-1$/, mutate: s => { s.cluster.nodes.find(n => n.name === 'node-old-1').status = 'Ready'; }, out: 'node/node-old-1 uncordoned' },
          { re: /^kubectl drain node-old-1\b(.*)$/, mutate: (s, m) => { s.cluster.lastDrain = drainOld1(s, m[1] || ''); }, out: s => s.cluster.lastDrain || '' },
          { re: /^kubectl drain \S+/, err: true, out: 'Is mission mein sirf node-old-1 ko drain karna hai. node-old-2 ki baari iske baad aayegi.' },
          { re: /^kubectl scale (deploy|deployment|deployments)[ \/]notify --replicas[= ]2$/, mutate: s => { s.cluster.lastScale = notifyTo2(s); }, out: s => (s.cluster.lastScale || '').replace('configured', 'scaled') },
          { re: /^kubectl delete (pdb|poddisruptionbudgets?)[ \/]notify-pdb$/, err: true,
            out: '(simulator ne roka) PDB hatane se drain chal jayega, par notify ka akela pod evict hote hi notify band ho jayega jab tak naya pod Ready na ho. Aur hataya hua PDB wapas lagana aksar log bhool jaate hain. Mission ki shart: PDB ko hataye bina.' },
        ],
        files: {
          'fix-notify-replicas.yaml': {
            desc: 'notify Deployment ke replicas 1 se 2 karta hai',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: notify\nspec:\n  replicas: 2        # pehle 1 tha\n  # ... baaki waisa hi',
            apply: s => notifyTo2(s),
          },
          'force-drain.sh': {
            desc: 'kubectl drain node-old-1 --force --disable-eviction chalata hai',
            content: '#!/bin/sh\n# PDB ko bypass karke pods ko seedha delete karta hai\nkubectl drain node-old-1 --ignore-daemonsets --delete-emptydir-data --force --disable-eviction',
            apply: s => drainOld1(s, '--force --disable-eviction'),
          },
        },
        success: KG.allOf(T_UPGRADE),
        successText: `Drain isliye atka tha ki <b>notify</b> ka 1 hi pod tha aur <code>notify-pdb</code> kehta tha "kam se kam 1 chalna chahiye" → 0 pod hat sakte the.
          Tumne PDB ko nahi toda; tumne <b>notify ke replicas 2</b> kiye. Ab PDB 1 disruption allow karta hai aur drain nikal gaya, jabki notify ka ek pod poore waqt chalta raha.
          <b>Yaad rakho:</b> <code>minAvailable: 1</code> + 1 replica = aisa node jo kabhi drain nahi hoga. Upgrade se pehle <code>kubectl get pdb</code> mein <code>ALLOWED DISRUPTIONS = 0</code> dhoondho.`,
        hints: [
          'kubectl drain node-old-1 --ignore-daemonsets --delete-emptydir-data chalao. Error mein "disruption budget" likha aayega.',
          'kubectl get pdb chalao. Jis PDB ke ALLOWED DISRUPTIONS 0 hain, us app ke replicas kitne hain? kubectl describe pdb notify-pdb',
          'notify ke replicas 2 karo: kubectl apply -f fix-notify-replicas.yaml. Phir drain dobara chalao, aur aakhir mein kubectl get pods -o wide.',
        ],
        solution: [
          'kubectl get nodes',
          'kubectl get pods -o wide',
          'kubectl drain node-old-1 --ignore-daemonsets --delete-emptydir-data',
          'kubectl get pdb',
          'kubectl describe pdb notify-pdb',
          'kubectl apply -f fix-notify-replicas.yaml',
          'kubectl drain node-old-1 --ignore-daemonsets --delete-emptydir-data',
          'kubectl get pods -o wide',
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — version aur API ke niyam',
        questions: [
          {
            q: 'Control Plane v1.33 par hai. In mein se kaun sa kubelet version is Control Plane ke saath NAHI chal sakta?',
            choices: ['kubelet v1.33', 'kubelet v1.31', 'kubelet v1.34', 'kubelet v1.30'],
            answer: 2,
            explain: 'kubelet Control Plane se naya nahi ho sakta. Purana ho sakta hai, 3 minor version tak: v1.33 ke saath v1.32, v1.31, v1.30 chalte hain. Isi liye Control Plane pehle upgrade hota hai.',
          },
          {
            q: 'Ek purane cluster ko v1.25 se v1.26 par upgrade kiya. Cluster theek chal raha hai. Do din baad CI pipeline ka deploy fail hota hai: "no matches for kind HorizontalPodAutoscaler in version autoscaling/v2beta2". Kyun?',
            context: 'error: resource mapping not found for name: "pay-api" namespace: "payments"\nno matches for kind "HorizontalPodAutoscaler" in version "autoscaling/v2beta2"\nensure CRDs are installed first',
            choices: [
              'Upgrade ne cluster ke saare HPA objects delete kar diye; unhe Git se dobara banana padega',
              'Git ke YAML mein purana apiVersion likha hai jo v1.26 mein hata diya gaya; use autoscaling/v2 karo',
              'metrics-server upgrade ke baad band ho gaya; HPA ko metrics nahi mil rahe isliye API gayab hai',
              'CI pipeline ka kubectl bahut purana hai; kubectl ko upgrade karne se yahi YAML chal jayega',
            ],
            answer: 1,
            explain: 'Cluster ke andar ka HPA object chalta rehta hai (API Server use naye version mein dikhata hai). Tootta woh YAML hai jo Git mein purane apiVersion ke saath likha hai — aur pata agle deploy par chalta hai. Isi liye jaanch upgrade se pehle hoti hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — upgrades',
      instructions: 'Senior role ke interview mein upgrade ka sawal lagbhag pakka hai. 🎤',
      questions: [
        {
          q: '"Production EKS cluster ko zero-downtime ke saath upgrade karne ka tumhara tareeka kya hai?"',
          choices: [
            'Pehle saare nodes naye version par, phir Control Plane; beech mein PDB hata deta hoon taaki drain na atke',
            'Hataye gaye APIs ki jaanch, phir Control Plane, add-ons, phir naye nodes jodkar purane ek-ek drain — PDB ke saath',
            'Naya cluster banakar DNS badal deta hoon; ek hi cluster ko upgrade karna kabhi zero-downtime nahi ho sakta',
            'Control Plane aur saare nodes ek saath upgrade karta hoon taaki version skew ek minute ke liye bhi na bane',
          ],
          answer: 1,
          explain: 'Kram + wajah dono bolo: jaanch pehle (Control Plane wapas nahi aata), Control Plane nodes se pehle (kubelet naya nahi ho sakta), nodes ek-ek (capacity na gire), PDB + 2+ replicas (drain ke dauraan app chalti rahe).',
        },
        {
          q: '"kubectl drain 20 minute se atka hai. Kya dekhoge?"',
          context: 'error when evicting pods/"notify-5c9d4f-k3" (will retry after 5s):\nCannot evict pod as it would violate the pod\'s disruption budget.',
          choices: [
            'kubectl get pdb mein ALLOWED DISRUPTIONS 0 wala PDB, aur us app ke replicas — aksar 1 replica + minAvailable 1',
            'Node ki disk aur memory; drain tabhi atakta hai jab node par DiskPressure ya MemoryPressure ho',
            'kube-proxy DaemonSet ka status; DaemonSet pod Ready na ho toh drain kisi pod ko evict nahi karta',
            'Scheduler ke logs; drain atakne ka matlab hai Scheduler ko evict hue pod ke liye node nahi mil raha',
          ],
          answer: 0,
          explain: 'Error khud keh raha hai: "disruption budget". kubectl get pdb → ALLOWED DISRUPTIONS = 0. Hal: replicas badhao (ya PDB ko maxUnavailable: 1 karo agar thoda downtime manzoor hai). --force ya PDB delete = outage.',
        },
        {
          q: '"PDB aur replicas ka kaun sa combination node upgrade ko hamesha ke liye rok deta hai?"',
          choices: [
            'replicas: 3 aur minAvailable: 2 — teen mein se do hamesha chahiye, isliye koi pod nahi hat sakta',
            'replicas: 2 aur maxUnavailable: 1 — ek pod ke hatne par doosra bhi turant hat jaata hai',
            'replicas: 1 aur minAvailable: 1 — ek mein se zero pod hat sakte hain, isliye eviction kabhi allow nahi hogi',
            'replicas: 4 aur minAvailable: 50% — pratishat wale PDB ko drain samajh nahi paata aur ruk jaata hai',
          ],
          answer: 2,
          explain: 'Allowed disruptions = current healthy pods − minAvailable = 1 − 1 = 0. (maxUnavailable: 0 ka bhi yahi asar hai.) Isko upgrade se pehle hi pakdo: kubectl get pdb -A mein ALLOWED DISRUPTIONS = 0 dhoondho.',
        },
      ],
    },
    success: [
      'Main cluster upgrade ka kram aur har kadam ki wajah bata sakta hoon',
      'Main PDB se atke drain ko bina outage ke khol sakta hoon',
      'Main upgrade se pehle hataye gaye APIs aur ALLOWED DISRUPTIONS = 0 wale PDB dhoondh sakta hoon',
    ],
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 11 — Rollout + PDB</b> mein PDB ka asar khud dekho.</p>
      <pre>kubectl get pdb -A                      # ALLOWED DISRUPTIONS = 0 dhoondho
kubectl cordon &lt;node&gt;
kubectl drain &lt;node&gt; --ignore-daemonsets --delete-emptydir-data
kubectl uncordon &lt;node&gt;                 # galti se cordon kiya ho toh</pre>`,
    cards: [
      { front: 'Cluster upgrade ka kram?', back: '(1) Hataye gaye APIs ki jaanch → (2) Control Plane → (3) add-ons → (4) naye nodes jodo → (5) purane nodes: cordon → drain → terminate, ek-ek karke.' },
      { front: 'kubelet aur Control Plane ke version ka niyam?', back: 'kubelet Control Plane se <b>3 minor version tak purana</b> ho sakta hai, <b>naya kabhi nahi</b>. Isi liye Control Plane pehle.' },
      { front: '<code>cordon</code> aur <code>drain</code> mein farak?', back: '<code>cordon</code>: naye pods band, purane chalte rehte hain. <code>drain</code>: cordon + purane pods ko evict karta hai (PDB ka dhyaan rakhte hue).' },
      { front: 'Drain "would violate the pod\'s disruption budget" par atka hai. Wajah aur hal?', back: 'Kisi PDB ke ALLOWED DISRUPTIONS = 0 hain (aksar 1 replica + minAvailable 1). Hal: replicas badhao. PDB delete ya --force = outage.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'd2-backup',
    icon: '💾',
    title: 'Backup aur Restore — Velero, aur "namespace delete ho gaya"',
    badge: 'Backup Bahadur',
    objectives: [
      'Kya cheez kahan se wapas aati hai: Git, Velero, ya alag backup',
      'Velero ka backup do hisson mein: objects (S3) + disk ka data (snapshot)',
      '<code>Completed</code> aur <code>PartiallyFailed</code> backup mein farak',
      'Delete hua namespace sahi backup se wapas lana (terminal)',
    ],
    lesson: [
      `<h3>😱 Problem: ek command, poora namespace gayab</h3>
       <p>ChaiPay mein kisi ne galat terminal mein yeh chala diya:</p>
       <pre>kubectl delete namespace payments</pre>
       <p><code>pay-api</code>, <code>ledger</code>, unke Secrets, aur ledger ki disk ka PVC — sab gaya.</p>
       <p>"Sab Git mein hai, dobara apply kar denge" — yeh aadha sach hai:</p>
       <table>
         <tr><th>Cheez</th><th>Git se wapas?</th></tr>
         <tr><td>Deployment, Service, ConfigMap ke YAML</td><td>✅ haan</td></tr>
         <tr><td>Woh Secret jo kisi ne <code>kubectl create secret</code> se banaya tha</td><td>❌ nahi</td></tr>
         <tr><td>ledger ki disk ka <b>data</b> (18,000 entries)</td><td>❌ nahi</td></tr>
       </table>
       <p><b>Asli baat:</b> Git mein <i>likha hua irada</i> hai. Chalte cluster ka <i>data</i> Git mein nahi hota.</p>`,
      `<h3>⛵ Velero: do hisson wala backup</h3>
       <p><b>Velero</b> cluster ke andar chalne wala backup tool hai. Ek backup ke do hisse hote hain:</p>
       <ol>
         <li><b>Objects</b> → namespace ke saare Kubernetes objects ek tarball mein → <b>S3 bucket</b> (cluster ke bahar).</li>
         <li><b>Disk ka data</b> → har PersistentVolume ka <b>snapshot</b> (EBS snapshot).</li>
       </ol>
       <pre>velero backup create payments-now --include-namespaces payments
velero schedule create payments-daily --schedule="0 2 * * *" \\
  --include-namespaces payments --ttl 720h
velero backup get
velero backup describe &lt;naam&gt; --details
velero restore create --from-backup &lt;naam&gt;</pre>
       <p><b>Status dhyaan se padho:</b> <code>Completed</code> = dono hisse theek.
       <code>PartiallyFailed</code> = kuch hissa fail hua — aksar disk ka snapshot. Objects hain, data nahi.</p>`,
      `<h3>⚠️ Restore ke 3 niyam jo log bhoolte hain</h3>
       <ul>
         <li><b>Velero overwrite nahi karta.</b> Jo object cluster mein pehle se hai, restore use chhod deta hai (warning deta hai).
         Galat restore ho gaya toh pehle use hatao, phir sahi restore karo.</li>
         <li><b>Jo backup kabhi restore karke nahi dekha, woh backup nahi hai.</b> Har mahine ek test restore karo
         (<code>--namespace-mappings payments:payments-test</code> se alag namespace mein).</li>
         <li><b>Cluster ke bahar ka data Velero nahi bachata.</b> RDS database ya S3 ke objects ke liye AWS ka apna backup chahiye.</li>
       </ul>
       <p><b>Do shabd jo interview mein aate hain:</b><br>
       <b>RPO</b> = kitna data kho sakte ho = pichhle achhe backup se ab tak ka waqt.<br>
       <b>RTO</b> = wapas chalu hone mein kitna waqt = restore ka waqt.</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Kahan se wapas aayega?',
        instructions: 'payments namespace delete ho gaya hai. Har cheez ko us dabbe mein daalo jahan se woh cheez wapas aa sakti hai.',
        bins: [
          { id: 'git', label: '📁 Git (GitOps) kaafi hai' },
          { id: 'velero', label: '⛵ Velero backup chahiye' },
          { id: 'other', label: '☁️ Cluster ke bahar ka alag backup' },
        ],
        items: [
          { text: 'pay-api ka Deployment YAML', bin: 'git', explain: 'YAML Git mein hai. ArgoCD ya kubectl apply se wapas ban jaata hai.' },
          { text: 'ledger ki disk par likhi 18,000 entries', bin: 'velero', explain: 'Disk ka data Git mein nahi hota. Velero ka volume snapshot (EBS snapshot) chahiye.' },
          { text: 'Secret jo ek engineer ne kubectl create secret se banaya tha', bin: 'velero', explain: 'Yeh Secret kabhi Git mein gaya hi nahi. Sirf cluster mein tha — Velero ke objects wale hisse se wapas aata hai.' },
          { text: 'RDS PostgreSQL database ke andar ka data', bin: 'other', explain: 'RDS cluster ke bahar hai. Velero RDS ko nahi chhuta. RDS automated backups / snapshots chahiye.' },
          { text: 'pay-api ka Service aur ConfigMap', bin: 'git', explain: 'Dono ke YAML Git mein hain. Koi data nahi khoya.' },
          { text: 'S3 bucket mein rakhi customers ki receipts (PDF)', bin: 'other', explain: 'S3 ke objects cluster ke bahar hain. S3 versioning / replication alag se chahiye.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: payments namespace wapas lao',
        instructions: 'Aaj 14 November, subah 11 baje. Kisi ne payments namespace delete kar diya. Velero roz raat 2 baje backup leta hai.',
        goal: `<b>payments</b> namespace wapas lao — <b>ledger ke data ke saath</b>. Do backups hain; dono ek jaise nahi hain.
          Restore se pehle dono ka <code>velero backup describe &lt;naam&gt; --details</code> padho.`,
        tasks: T_BACKUP,
        cluster: {
          restored: null, restores: [],
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }, { name: 'node-2', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [],
          custom: {
            ns: { names: ['ns', 'namespace', 'namespaces'], cols: ['NAME', 'STATUS', 'AGE'],
              items: [{ name: 'default', row: ['Active', '40d'] }, { name: 'kube-system', row: ['Active', '40d'] }, { name: 'velero', row: ['Active', '39d'] }] },
          },
        },
        responses: [
          { re: /^velero backup get$/,
            out: `NAME                            STATUS            ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION\n${BK_BAD}   PartiallyFailed   1        0          2026-11-14 02:00:10 +0530 IST   29d       default\n${BK_GOOD}   Completed         0        0          2026-11-13 02:00:11 +0530 IST   28d       default` },
          { re: new RegExp('^velero backup describe ' + BK_BAD + '( --details)?$'), mutate: s => { s.cluster.sawBad = true; },
            out: `Name:         ${BK_BAD}\nPhase:        PartiallyFailed (run \`velero backup logs ${BK_BAD}\` for more information)\nErrors:    1\nWarnings:  0\nNamespaces:\n  Included:  payments\nStarted:    2026-11-14 02:00:10 +0530 IST\nTotal items to be backed up:  48\nItems backed up:              48\nBackup Volumes:\n  CSI Snapshots:\n    payments/ledger-data-ledger-0:\n      Result:  failed   <-- ledger ki disk ka snapshot NAHI bana\n      Error:   SnapshotLimitExceeded: maximum allowed snapshots exceeded\n(matlab: is backup mein 48 objects hain, par ledger ki disk ka data nahi hai)` },
          { re: new RegExp('^velero backup describe ' + BK_GOOD + '( --details)?$'), mutate: s => { s.cluster.sawGood = true; },
            out: `Name:         ${BK_GOOD}\nPhase:        Completed\nErrors:    0\nWarnings:  0\nNamespaces:\n  Included:  payments\nStarted:    2026-11-13 02:00:11 +0530 IST\nTotal items to be backed up:  48\nItems backed up:              48\nBackup Volumes:\n  CSI Snapshots:\n    payments/ledger-data-ledger-0:\n      Result:  succeeded   <-- ledger ki disk ka snapshot hai\n      Snapshot: snap-0a41f7c2d9e1b6a55\n(matlab: 48 objects + ledger ki disk ka data, 13 November raat 2 baje tak ka)` },
          { re: /^velero backup describe\b/, err: true, out: 'An error occurred: backup naam galat hai.\n(velero backup get se naam copy karo. Roop: velero backup describe <naam> --details)' },
          { re: /^velero restore create(?: \S+)? --from-backup[= ](\S+)$/, mutate: (s, m) => { s.cluster.lastRestore = veleroRestore(s, m[1] || ''); }, out: s => s.cluster.lastRestore || '' },
          { re: /^velero restore get$/,
            out: s => s.cluster.restores.length
              ? ['NAME                                           BACKUP                          STATUS            WARNINGS'].concat(s.cluster.restores.map(r => `${r.name}   ${r.backup}   ${r.status.padEnd(15)}   ${r.warn}`)).join('\n')
              : 'No restores found.' },
          { re: /^kubectl delete (ns|namespaces?)[ \/]payments$/,
            mutate: s => { const c = s.cluster; if (!c.restored) return; c.restored = null; c.pods.length = 0; c.custom.ns.items = c.custom.ns.items.filter(x => x.name !== 'payments'); c.deleted = true; },
            out: s => s.cluster.deleted ? 'namespace "payments" deleted\n(payments ke saare objects phir se hat gaye. Ab sahi backup se restore karo.)' : 'Error from server (NotFound): namespaces "payments" not found' },
          { re: /^velero schedule get$/, out: 'NAME             STATUS    CREATED                         SCHEDULE    BACKUP TTL   LAST BACKUP   SELECTOR\npayments-daily   Enabled   2026-10-06 11:20:44 +0530 IST   0 2 * * *   720h0m0s     9h ago        <none>' },
          { re: /^velero\b/, out: 'Is mission mein velero ke yeh commands chalte hain:\n  velero backup get\n  velero backup describe <naam> --details\n  velero restore create --from-backup <naam>\n  velero restore get\n  velero schedule get' },
        ],
        files: {},
        success: KG.allOf(T_BACKUP),
        successText: `Tumne <b>status padh kar</b> backup chuna. Sabse naya backup (14 Nov) <code>PartiallyFailed</code> tha: objects the, par ledger ki disk ka snapshot nahi. Us backup se restore karte toh ledger <b>khaali</b> uthta.
          13 Nov wala backup <code>Completed</code> tha. <b>Keemat:</b> 13 Nov raat 2 baje se aaj 11 baje tak ka ledger data (33 ghante) gaya — yahi <b>RPO</b> hai.
          <b>Is ghatna ke baad ka kaam:</b> <code>PartiallyFailed</code> backup par alert lagao, taaki snapshot ka fail hona usi raat pata chale, ghatna wale din nahi.`,
        hints: [
          'kubectl get ns se dekho payments gayab hai. Phir velero backup get — STATUS column dhyaan se padho.',
          'Dono backups ka describe chalao: velero backup describe ' + BK_BAD + ' --details aur velero backup describe ' + BK_GOOD + ' --details. "CSI Snapshots" wala hissa dekho.',
          'velero restore create --from-backup ' + BK_GOOD + ' chalao. Phir kubectl logs ledger-0 se entries dekho. (Galat backup se restore ho gaya? Pehle kubectl delete namespace payments.)',
        ],
        solution: [
          'kubectl get ns',
          'velero backup get',
          `velero backup describe ${BK_BAD} --details`,
          `velero backup describe ${BK_GOOD} --details`,
          `velero restore create --from-backup ${BK_GOOD}`,
          'velero restore get',
          'kubectl get pods',
          'kubectl logs ledger-0',
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — restore ke niyam',
        questions: [
          {
            q: 'Tumne galti se PartiallyFailed backup se restore kar diya. ledger khaali utha. Ab tum Completed backup se dobara restore chalate ho. Kya hoga?',
            choices: [
              'Velero purane objects ko naye backup ke objects se badal dega aur ledger ka data aa jayega',
              'Velero maujood objects ko chhod dega (warnings dega); ledger khaali hi rahega',
              'Velero error dekar ruk jayega kyunki ek namespace par do restore allowed nahi hain',
              'Velero pehle namespace delete karega, phir sab kuch dobara banayega — thoda downtime hoga',
            ],
            answer: 1,
            explain: 'Velero default mein maujood object ko overwrite nahi karta. PVC pehle se maujood hai (khaali disk ke saath), toh snapshot wali disk banti hi nahi. Pehle galat restore hatao (namespace delete), phir sahi backup se restore karo.',
          },
          {
            q: 'Backup roz raat 2 baje hota hai. Ghatna subah 11 baje hui, aur pichhli raat ka backup theek tha. RPO (kitna data gaya) kitna hai?',
            choices: ['0 ghante — backup Completed tha', '24 ghante — backup roz hota hai', '9 ghante — raat 2 se subah 11', '2 ghante — restore ka waqt'],
            answer: 2,
            explain: 'RPO = pichhle achhe backup se ghatna tak ka waqt = 9 ghante. Is waqt mein jo likha gaya, woh gaya. RPO kam karna ho toh backup zyada baar lo (ya data ko cluster ke bahar managed database mein rakho). Restore ka waqt RTO kehlata hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — backup aur disaster recovery',
      instructions: 'Interviewer dekhna chahta hai ki tum "sab Git mein hai" se aage sochte ho ya nahi. 🎤',
      questions: [
        {
          q: '"Hum GitOps use karte hain, sab kuch Git mein hai. Phir Velero jaisa backup tool kyun chahiye?"',
          choices: [
            'Nahi chahiye — GitOps ke saath cluster ko kabhi bhi Git se poora dobara banaya ja sakta hai, data ke saath',
            'Git mein manifests hain; PV ka data aur haath se bane Secrets/objects Git mein nahi hote — unke liye backup chahiye',
            'Velero Git se tez hai; restore ke waqt ArgoCD ke sync se pehle objects ban jaate hain, bas itna farak hai',
            'Git sirf Deployments rakh sakta hai; Services aur ConfigMaps ke liye Velero zaroori hai',
          ],
          answer: 1,
          explain: 'GitOps = irada (manifests). Backup = haalat (data). PersistentVolume ka data, runtime par bane objects, aur Git ke bahar bane Secrets sirf backup se wapas aate hain.',
        },
        {
          q: '"Velero backup ka status PartiallyFailed hai. Iska kya matlab hai aur tum kya karoge?"',
          choices: [
            'Backup bekaar hai aur restore ho hi nahi sakta; Velero use agli raat apne aap delete kar deta hai',
            'Sirf ek warning hai; backup poora hai aur restore mein koi farak nahi padega',
            'Kuch hissa fail hua — describe --details se dekhunga kya; aksar volume snapshot hota hai',
            'S3 bucket bhar gayi hai; bucket khaali karke backup apne aap Completed ho jayega',
          ],
          answer: 2,
          explain: 'PartiallyFailed backup restore ho sakta hai, par jo hissa fail hua woh nahi aayega. Sabse khatarnak case: objects hain, disk ka snapshot nahi. describe --details padho, wajah theek karo, aur PartiallyFailed/Failed par alert lagao.',
        },
        {
          q: '"Tumhe kaise pata ki tumhara backup sach mein kaam karega?"',
          choices: [
            'velero backup get mein STATUS Completed dikhta hai — itna kaafi saboot hai',
            'S3 bucket mein tarball ka size dekhta hoon; size badh raha hai toh backup theek hai',
            'Backup ke logs mein error nahi hai; Velero khud verify kar leta hai ki restore chalega',
            'Niyamit test restore karta hoon — alag namespace mein — aur app ka data jaanchta hoon',
          ],
          answer: 3,
          explain: 'Jo backup kabhi restore nahi hua, uska koi saboot nahi. --namespace-mappings payments:payments-test se alag namespace mein restore karo aur app ke data ko jaancho. Isse RTO (restore ka asli waqt) bhi pata chalta hai.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki kaun si cheez Git se, Velero se, ya alag backup se wapas aati hai',
      'Main backup ka status padh kar sahi backup chun sakta hoon',
      'Main RPO aur RTO ko ek asli ghatna par samjha sakta hoon',
    ],
    homework: `<p>Apne kind cluster par Velero lagana thoda lamba kaam hai (object storage chahiye). Chhota abhyas:</p>
      <pre>kubectl get pv,pvc -A                 # kaun sa data cluster ke andar hai?
kubectl get secret -A | wc -l         # kitne Secrets hain — kitne Git mein hain?</pre>
      <p>Har PV aur har Secret ke liye khud se poochho: "Yeh aaj delete ho jaye toh kahan se wapas aayega?"</p>`,
    cards: [
      /* (boss level is file ke aakhir mein alag registerLevels call mein hai) */
      { front: 'Velero backup ke do hisse?', back: '(1) Kubernetes <b>objects</b> ka tarball → S3 bucket. (2) Har PersistentVolume ka <b>snapshot</b> (disk ka data).' },
      { front: 'Backup status <code>PartiallyFailed</code> ka matlab?', back: 'Kuch hissa fail hua — aksar disk ka snapshot. Objects restore honge, data nahi. <code>velero backup describe NAAM --details</code> se dekho.' },
      { front: 'Velero restore maujood objects ke saath kya karta hai?', back: 'Chhod deta hai (warning deta hai). Overwrite nahi karta. Galat restore ko pehle hatao, phir sahi restore karo.' },
      { front: 'RPO aur RTO?', back: '<b>RPO</b> = kitna data kho sakte ho (pichhle achhe backup se ab tak). <b>RTO</b> = wapas chalu hone ka waqt (restore ka waqt).' },
      { front: 'GitOps hai toh backup kyun?', back: 'Git mein manifests (irada) hain. PV ka data, haath se bane Secrets aur runtime objects Git mein nahi hote.' },
    ],
  },
]);

/* ------------------------------------------------------------------ */
/* LEVEL 5 — BOSS                                                      */
/* ------------------------------------------------------------------ */
VISUALS['d2-boss'] = {
  t: 'Day-2 ka chakkar — chaar kaam jo kabhi khatam nahi hote',
  scene: {
    intro: 'Is track ke chaar hunar ek chakkar banate hain. Boss level mein chaaron ek saath kaam aayenge.',
    aria: 'Day-2 ke chaar kaam: debug, naap, upgrade, backup',
    nodes: [
      { id: 'debug', col: 0, row: 0, icon: '🧰', label: 'Debug', sub: 'kubectl debug', tone: 'accent', about: 'Bina shell wale container ko usi pod ke andar se jaanchna.' },
      { id: 'size', col: 1, row: 0, icon: '📏', label: 'Sahi naap', sub: 'requests / limits', tone: 'gold', about: 'Request = Scheduler ki reservation. Limit = kernel ki chhat.' },
      { id: 'upgrade', col: 1, row: 1, icon: '⬆️', label: 'Upgrade', sub: 'cordon → drain → PDB', tone: 'good', about: 'Jaanch → Control Plane → add-ons → nodes, ek-ek karke.' },
      { id: 'backup', col: 0, row: 1, icon: '💾', label: 'Backup', sub: 'Velero + test restore', about: 'Objects S3 mein, disk ka data snapshot mein. Restore karke hi bharosa.' },
    ],
    steps: [
      { at: ['debug'], say: '<b>Debug:</b> kuch toota hai toh pehle <b>saboot</b>. <code>kubectl debug -it POD --image=busybox:1.36 --target=CTR</code> se usi pod ke network se jaancho — andaaza mat lagao.' },
      { from: 'debug', to: 'size', label: 'wajah: galat naap', say: '<b>Sahi naap:</b> bahut si "ajeeb" problems asal mein galat naap hoti hain. CPU limit kam → throttling. Memory limit kam → OOMKilled. Request zyada → pods Pending aur bill zyada.' },
      { from: 'size', to: 'upgrade', label: 'har 4 mahine', tone: 'good', say: '<b>Upgrade:</b> naya version har ~4 mahine mein. Kram: jaanch → Control Plane → add-ons → nodes. Drain ko PDB rokta hai — <code>ALLOWED DISRUPTIONS = 0</code> ko upgrade se pehle pakdo.' },
      { from: 'upgrade', to: 'backup', label: 'pehle backup', tone: 'gold', say: '<b>Backup:</b> har bade badlaav se pehle pakka karo ki backup chal raha hai aur <code>Completed</code> hai. Jo backup kabhi restore nahi hua, us par bharosa mat karo.' },
      { from: 'backup', to: 'debug', label: 'phir se', say: 'Aur chakkar dobara shuru. Day-2 koi project nahi hai jo khatam ho jaye — <b>Day-2 hi naukri hai</b>.' },
    ],
  },
};

const BOSS_PENDING = ['notify-7f6b9d-p3', 'notify-7f6b9d-p4'];
const T_D2BOSS = [
  { text: 'Pending pod ka <code>describe</code> padho — Scheduler kya keh raha hai?', check: s => s.history.some(h => /^kubectl describe (pods?|po)[ \/]notify-7f6b9d-p[34]\b/.test(h)) },
  { text: 'Nodes ka <b>asli CPU usage</b> (<code>kubectl top nodes</code>) aur <b>reserve hua CPU</b> (<code>kubectl describe node</code>) dono dekho', check: s => s.history.some(h => /^kubectl top (nodes?|no)\b/.test(h)) && s.history.some(h => /^kubectl describe (nodes?|no)[ \/]node-new-\d/.test(h)) },
  { text: '<code>notify</code> ki CPU request ka naap theek karo → chaaron notify pods Running', check: s => !!s.cluster.notifyFixed },
  { text: 'Velero ke schedule ki haalat dekho (<code>velero schedule get</code>)', check: s => s.history.includes('velero schedule get') },
  { text: '<code>payments</code> namespace ka roz raat 2 baje ka schedule banao (naam: <code>payments-daily</code>)', check: s => !!s.cluster.schedule },
  { text: 'Raat 2 baje ka intezaar mat karo — schedule se abhi ek backup lo', check: s => !!s.cluster.backupNow },
];
const nodeDesc = (name, fixed) => `Name:               ${name}\nRoles:              <none>\nKubelet Version:    v1.33.4\nCapacity:\n  cpu:     4\n  memory:  16Gi\nAllocatable:\n  cpu:     3920m\n  memory:  15Gi\nAllocated resources:\n  (Total limits may be over 100 percent, i.e., overcommitted.)\n  Resource   Requests        Limits\n  --------   --------        ------\n  cpu        ${fixed ? '1900m (48%)' : '3700m (94%)'}     4 (102%)\n  memory     6Gi (40%)       8Gi (53%)\n${fixed ? '(reserve hua CPU ab asli usage ke paas hai)' : '(94% CPU reserve hai — par kubectl top nodes dekho: asli usage sirf ~20% hai)'}`;

KG.registerLevels('day2', [
  {
    id: 'd2-boss',
    icon: '👑',
    title: 'BOSS: Somvaar subah — upgrade ke baad ka din',
    badge: 'Cluster ka Doctor',
    objectives: [
      'Upgrade ki raat ke faisle sahi kram mein lena (incident)',
      'Pending pods ki wajah dhoondhna: asli usage vs reserve hua CPU',
      'Gayab backup schedule ko pakadna aur wapas lagana',
      'Chaaron Day-2 hunar ek hi cluster par milakar istemal karna',
    ],
    lesson: [
      `<h3>👑 Boss level: koi naya concept nahi</h3>
       <p>Is level mein kuch naya nahi seekhna. Pichhle chaar levels ke hunar <b>ek saath</b> lagane hain — bilkul waise jaise asli naukri mein hota hai.</p>
       <p><b>Kahani:</b> ChaiPay ne shanivaar raat cluster ko v1.32 se v1.33 par upgrade kiya. Somvaar subah do cheezein toot gayi hain.
       Dono ka upgrade se seedha rishta nahi dikhta — par dono upgrade ki wajah se saamne aayi hain.</p>
       <p><b>Yaad rakhne ka kram:</b> pehle <b>saboot</b> (describe, top, get), phir <b>wajah</b>, phir <b>sabse chhota sahi fix</b>, aakhir mein <b>pakka karna</b>.</p>`,
    ],
    stages: [
      {
        type: 'incident',
        title: '🚨 Upgrade ki raat — har mod par ek faisla',
        pager: '<b>Shanivaar 11:00 PM — upgrade window shuru.</b><br>Cluster: <code>chaipay-prod</code>, v1.32 → v1.33. Tum upgrade ke zimmedaar ho.',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ kubent --target-version 1.33.0\n(koi object nahi mila — v1.33 mein koi API HATAYA nahi gaya)\n\n$ kubectl logs deploy/notify | grep -i deprecated\nW1122 22:58:41.118     1 warnings.go:70] v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice\n(notify ka purana code SMS gateway ke pods dhoondhne ke liye v1 Endpoints padhta hai)',
            text: 'Upgrade se pehle ki jaanch: koi HATAYA gaya API nahi mila. Par notify ke logs mein ek DEPRECATED warning hai. Ab kya?',
            choices: [
              { t: 'Upgrade chalne do; deprecated abhi chalta hai — EndpointSlice ka ticket banao', good: true, next: 'n2', explain: 'Deprecated aur removed alag hain. v1 Endpoints v1.33 mein deprecated hua, hata nahi — stable (v1) API Kubernetes 1.x mein hataya nahi jaata. Upgrade sirf HATAYA gaya API rokta hai (jaise v1.26 mein autoscaling/v2beta2, v1.32 mein flowcontrol…/v1beta3). Warning ka kaam: aage ki taiyaari ka ticket.' },
              { t: 'Upgrade rok do; pehle notify ka code EndpointSlice par lao, phir upgrade', good: false, explain: 'Deprecated API chalta rehta hai — v1.33 par notify bilkul waise hi chalega. Upgrade rokne se cluster security patches aur support se door hota hai. Upgrade rokta sirf hataya gaya (removed) API hai.' },
              { t: 'Warning ko log filter se chhupa do; deprecated warnings ka koi matlab nahi', good: false, explain: 'Warning saboot hai ki code purane raaste par hai. Chhupana nahi — ticket banao, taaki naye features (EndpointSlice) ka faayda mile aur kal ka koi sach mein hataya gaya API achanak na pakde.' },
            ],
          },
          n2: {
            sitrep: 'Control Plane:  v1.33 ✓\nAdd-ons:        CoreDNS ✓  kube-proxy ✓  CNI ✓\nNodes:          node-old-1 (v1.32)  node-old-2 (v1.32)  node-old-3 (v1.32)',
            text: 'Control Plane aur add-ons ho gaye. Teen purane nodes bache hain. Nodes kaise badloge?',
            choices: [
              { t: 'Teeno purane nodes ek saath drain karo — kaam jaldi khatam hoga', good: false, explain: 'Teeno ek saath drain = saari capacity ek saath gayab. Evict hue pods ko jagah nahi milegi aur PDB bhi sab kuch rok dega.' },
              { t: 'Pehle teen naye nodes jodo, phir purane nodes ko ek-ek karke cordon aur drain karo', good: true, next: 'n3', explain: 'Pehle nayi jagah, phir purani khaali. Ek-ek node se capacity kabhi achanak nahi girti.' },
              { t: 'Purane nodes ko seedha terminate karo; ReplicaSet pods ko apne aap dobara bana dega', good: false, explain: 'Terminate mein eviction nahi hoti: PDB ki sunwai nahi, graceful shutdown nahi. Chal rahe payments beech mein toot jayenge.' },
            ],
          },
          n3: {
            sitrep: '$ kubectl drain node-old-2 --ignore-daemonsets --delete-emptydir-data\nerror when evicting pods/"ledger-0" (will retry after 5s):\nCannot evict pod as it would violate the pod\'s disruption budget.\n\n$ kubectl get pdb ledger-pdb\nNAME         MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS\nledger-pdb   N/A             0                 0',
            text: 'ledger ek StatefulSet hai jiska 1 hi replica hai (ledger-0), aur PDB kehta hai maxUnavailable: 0. ledger ko 2 replicas par le jaana aaj raat mumkin nahi. Ab?',
            choices: [
              { t: 'node-old-2 ko hamesha ke liye v1.32 par hi chhod do; ledger ko chhedna bahut khatarnak hai', good: false, explain: 'Purana node security patches se door hota jayega, aur agle upgrade par version skew ki seema toot jayegi. Taalne se problem badi hoti hai.' },
              { t: 'kubectl drain --force --disable-eviction chalao; kisi ko batane ki zaroorat nahi', good: false, explain: 'ledger achanak band hoga, chal rahe likhne beech mein tootenge, aur kisi ko pata nahi hoga kyun. Planned downtime aur chupchaap outage mein yahi farak hai.' },
              { t: 'Team ko batao; kam traffic ke waqt PDB ko kuch der dheela karke ledger-0 hatao, phir PDB wapas', good: true, next: 'n4', explain: '1 replica wali stateful app ko hataye bina node khaali nahi hota — thoda downtime tay hai. Sahi tareeka: bata kar, kam traffic mein, aur PDB ko wapas lagana likh kar rakho. Lamba hal: ledger ke 2+ replicas.' },
            ],
          },
          n4: {
            sitrep: 'Saare nodes: v1.33.4 ✓\nSaare pods: Running ✓',
            text: 'Upgrade "ho gaya". Sone se pehle aakhri kaam kya hai?',
            choices: [
              { t: 'Kuch nahi — pods Running hain, matlab sab theek hai', good: false, explain: 'Running ka matlab sirf itna hai ki container chal raha hai. PDB, backup schedule aur agla deploy — in teeno ki jaanch baaki hai.' },
              { t: 'Jaancho: PDB wapas laga ya nahi, backup schedule chal raha hai ya nahi, aur ek test deploy', good: true, next: 'end', explain: 'Upgrade ke dauraan jo cheezein "kuch der ke liye" badli gayi thi, unhe wapas dekhna. Yahi woh jagah hai jahan somvaar subah ki problems janm leti hain.' },
              { t: 'Purane version par wapas jaane ka plan likho, taaki subah kuch toote toh rollback ho sake', good: false, explain: 'Control Plane ko purane version par wapas nahi laya ja sakta. Rollback ka plan upgrade se pehle ki jaanch aur backup hi hai.' },
            ],
          },
          end: {
            end: true,
            text: 'Upgrade poora — sahi kram mein',
            summary: '<b>Chaar faisle:</b> (1) <b>deprecated</b> (abhi chalta hai → ticket) aur <b>removed</b> (upgrade rokta hai) ka farak — v1.33 mein koi API hata nahi tha, isliye upgrade chala. (2) Pehle naye nodes, phir purane <b>ek-ek</b>. (3) 1-replica stateful app ke liye <b>bata kar</b> planned downtime, chupchaap --force nahi. (4) "Kuch der ke liye" badli cheezon ko <b>wapas jaancha</b>.<br><br>Asli kahani mein kadam 4 kisi ne nahi kiya. Agla challenge usi ka nateeja hai.',
          },
        },
      },
      {
        type: 'terminal',
        title: '🖥️ Boss Mission: do bimariyan, ek cluster',
        instructions: 'Somvaar subah 9 baje. Diwali campaign ke liye notify ko 4 replicas par scale kiya gaya — do pods Pending hain. Aur kisi ne poochha: "Pichhla backup kab hua tha?"',
        goal: `<b>Bimari 1:</b> <code>notify</code> ke 4 mein se 2 pods <b>Pending</b> hain. Wajah dhoondho aur theek karo — naya node kharide bina.<br>
          <b>Bimari 2:</b> pata karo ki Velero ka backup chal raha hai ya nahi. Na chal raha ho toh <code>payments</code> namespace ka roz raat 2 baje ka schedule <code>payments-daily</code> banao (30 din = <code>--ttl 720h</code>), aur abhi ek backup bhi lo.`,
        tasks: T_D2BOSS,
        cluster: {
          nodes: [
            { name: 'node-new-1', status: 'Ready', roles: '<none>', age: '36h', version: 'v1.33.4', cpu: 4, mem: 16, top: '21% 38%', describe: nodeDesc('node-new-1', false) },
            { name: 'node-new-2', status: 'Ready', roles: '<none>', age: '36h', version: 'v1.33.4', cpu: 4, mem: 16, top: '19% 41%', describe: nodeDesc('node-new-2', false) },
            { name: 'node-new-3', status: 'Ready', roles: '<none>', age: '36h', version: 'v1.33.4', cpu: 4, mem: 16, top: '18% 36%', describe: nodeDesc('node-new-3', false) },
          ],
          pods: [
            { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '36h', node: 'node-new-1', ip: '10.244.1.20', top: '410m 600Mi' },
            { name: 'pay-api-6b8d7c-b2', ready: '1/1', status: 'Running', restarts: 0, age: '36h', node: 'node-new-2', ip: '10.244.2.20', top: '395m 590Mi' },
            { name: 'pay-api-6b8d7c-c3', ready: '1/1', status: 'Running', restarts: 0, age: '36h', node: 'node-new-3', ip: '10.244.3.20', top: '402m 610Mi' },
            { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '36h', node: 'node-new-3', ip: '10.244.3.21', top: '220m 900Mi' },
            { name: 'notify-7f6b9d-p1', ready: '1/1', status: 'Running', restarts: 0, age: '36h', node: 'node-new-1', ip: '10.244.1.25', top: '140m 90Mi' },
            { name: 'notify-7f6b9d-p2', ready: '1/1', status: 'Running', restarts: 0, age: '36h', node: 'node-new-2', ip: '10.244.2.25', top: '155m 95Mi' },
            { name: BOSS_PENDING[0], ready: '0/1', status: 'Pending', restarts: 0, age: '12m', node: '<none>',
              describe: `Name:         ${BOSS_PENDING[0]}\nStatus:       Pending\nContainers:\n  notify:\n    Requests:\n      cpu:     2          <-- har notify pod 2 poore CPU reserve karna chahta hai\n      memory:  256Mi\nEvents:\n  Warning  FailedScheduling  12m  default-scheduler  0/3 nodes are available: 3 Insufficient cpu. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.` },
            { name: BOSS_PENDING[1], ready: '0/1', status: 'Pending', restarts: 0, age: '12m', node: '<none>',
              describe: `Name:         ${BOSS_PENDING[1]}\nStatus:       Pending\nContainers:\n  notify:\n    Requests:\n      cpu:     2          <-- har notify pod 2 poore CPU reserve karna chahta hai\n      memory:  256Mi\nEvents:\n  Warning  FailedScheduling  12m  default-scheduler  0/3 nodes are available: 3 Insufficient cpu. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.` },
          ],
          deployments: [
            { name: 'pay-api', ready: '3/3', upToDate: 3, available: 3, age: '40d' },
            { name: 'notify', ready: '2/4', upToDate: 4, available: 2, age: '40d' },
          ],
          backups: ['payments-daily-20261114020010   Completed   0   0   2026-11-14 02:00:10 +0530 IST   27d   default'],
        },
        responses: [
          { re: /^velero schedule get$/,
            out: s => s.cluster.schedule
              ? 'NAME             STATUS    CREATED                         SCHEDULE    BACKUP TTL   LAST BACKUP   SELECTOR\npayments-daily   Enabled   2026-11-16 09:14:02 +0530 IST   0 2 * * *   720h0m0s     ' + (s.cluster.backupNow ? '1m ago ' : 'n/a    ') + '       <none>'
              : 'No schedules found.\n(Schedule object gayab hai. Upgrade ki raat Velero ko naye version par dobara install kiya gaya tha — purana Schedule us install mein tha hi nahi.)' },
          { re: /^velero backup get$/,
            out: s => 'NAME                            STATUS      ERRORS   WARNINGS   CREATED                         EXPIRES   STORAGE LOCATION\n' + s.cluster.backups.join('\n') +
              (s.cluster.backupNow ? '' : '\n(aaj 16 November hai. Aakhri backup 14 November ka hai — do raat se koi backup nahi hua.)') },
          { re: /^velero schedule create (\S+)(.*)$/,
            mutate: (s, m) => {
              const name = m[1] || '', rest = m[2] || '';
              const cron = /--schedule[= ]["']?0 2 \* \* \*["']?/.test(rest), ns = /--include-namespaces[= ]payments\b/.test(rest), ttl = /--ttl[= ]720h/.test(rest);
              if (name !== 'payments-daily') s.cluster.lastSched = 'Mission mein schedule ka naam payments-daily maanga gaya hai.';
              else if (!cron) s.cluster.lastSched = 'error: --schedule mein cron chahiye. Roz raat 2 baje = --schedule="0 2 * * *"  (minute ghanta din mahina hafte-ka-din)';
              else if (!ns) s.cluster.lastSched = '(simulator ne roka) --include-namespaces payments nahi diya. Bina iske Velero poore cluster ka backup lega — mission sirf payments namespace ka schedule maangta hai.';
              else if (!ttl) s.cluster.lastSched = '(simulator ne roka) --ttl 720h nahi diya. TTL = backup kitne din rakha jayega. Mission 30 din (720h) maangta hai.';
              else { s.cluster.schedule = true; s.cluster.lastSched = 'Schedule "payments-daily" created successfully.'; }
            },
            out: s => s.cluster.lastSched || '' },
          { re: /^velero backup create (\S+ )?--from-schedule[= ]payments-daily$/,
            mutate: s => { if (!s.cluster.schedule || s.cluster.backupNow) return; s.cluster.backupNow = true; s.cluster.backups.unshift('payments-daily-20261116091502   Completed   0   0   2026-11-16 09:15:02 +0530 IST   29d   default'); },
            out: s => s.cluster.schedule ? 'Creating backup from schedule, all other filters are ignored.\nBackup request "payments-daily-20261116091502" submitted successfully.\n...\nBackup completed with status: Completed.' : 'An error occurred: schedules.velero.io "payments-daily" not found\n(pehle schedule banao)' },
          { re: /^velero\b/, out: 'Is mission mein velero ke yeh commands chalte hain:\n  velero schedule get\n  velero backup get\n  velero schedule create payments-daily --schedule="0 2 * * *" --include-namespaces payments --ttl 720h\n  velero backup create --from-schedule payments-daily' },
        ],
        files: {
          'fix-notify-requests.yaml': {
            desc: 'notify ki CPU request 2 (2000m) se 200m karta hai — asli usage ~150m hai',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: notify\nspec:\n  replicas: 4\n  template:\n    spec:\n      containers:\n        - name: notify\n          resources:\n            requests:\n              cpu: 200m      # pehle "2" tha — asli p95 usage 150m hai\n              memory: 256Mi\n            limits:\n              memory: 256Mi',
            apply: s => {
              const c = s.cluster;
              if (c.notifyFixed) return 'deployment.apps/notify unchanged';
              c.notifyFixed = true;
              c.pods = c.pods.filter(p => !/^notify-/.test(p.name));
              ['node-new-1', 'node-new-2', 'node-new-3', 'node-new-1'].forEach((n, i) => c.pods.push({ name: 'notify-5d8c7b-r' + (i + 1), ready: '1/1', status: 'Running', restarts: 0, age: '40s', node: n, ip: '10.244.' + (i % 3 + 1) + '.4' + i, top: '150m 92Mi' }));
              c.deployments.find(d => d.name === 'notify').ready = '4/4';
              c.deployments.find(d => d.name === 'notify').available = 4;
              c.nodes.forEach(n => { n.describe = nodeDesc(n.name, true); });
              return 'deployment.apps/notify configured\n(rolling update: chaaron notify pods naye naap ke saath Running hain. Koi pod Pending nahi.)';
            },
          },
          'add-node.sh': {
            desc: 'Cluster mein chautha node jodta hai',
            content: '#!/bin/sh\n# node group ka desired size 3 se 4\naws eks update-nodegroup-config --cluster-name chaipay-prod --nodegroup-name ng-133 --scaling-config desiredSize=4',
            apply: () => '(simulator ne roka) Chautha node jodne se Pending pods chal jayenge — par kubectl top nodes dekho: teeno nodes ka asli CPU usage ~20% hai. Tum khaali nodes ke upar ek aur khaali node kharid rahe ho (lagbhag ₹10,000/mahina). Wajah capacity nahi, galat naap hai.',
          },
          'fix-notify-priority.yaml': {
            desc: 'notify ko unchi PriorityClass deta hai',
            apply: () => '(simulator ne roka) Unchi priority se Scheduler notify ke liye pay-api ke pods ko hata deta (preemption). Notification bhejne ke liye payment lene wali service ko maarna ulta sauda hai.',
          },
        },
        success: KG.allOf(T_D2BOSS),
        successText: `<b>Bimari 1:</b> nodes ka asli usage ~20% tha, par 94% CPU <i>reserve</i> tha — kyunki har notify pod 2 CPU maang raha tha aur ~150m use kar raha tha. Scheduler requests ginta hai, usage nahi. Sahi fix naap theek karna tha, node kharidna nahi.<br>
          <b>Bimari 2:</b> upgrade ki raat Velero dobara install hua aur Schedule gayab ho gaya. Do raat koi backup nahi hua aur kisi ko pata nahi chala. Tumne schedule wapas lagaya <b>aur</b> turant ek backup liya.<br>
          <b>Dono ka sabak ek hai:</b> "sab Running hai" ka matlab "sab theek hai" nahi hota. Bade badlaav ke baad woh cheezein jaancho jo chupchaap tootti hain.`,
        hints: [
          'kubectl get pods se Pending pods ke naam dekho. kubectl describe pod notify-7f6b9d-p3 → Events mein wajah. Phir kubectl top nodes aur kubectl describe node node-new-1 ka "Allocated resources" milao.',
          'Usage ~20%, reserve 94% → request bahut badi hai. ls se files dekho; kubectl apply -f fix-notify-requests.yaml. Phir velero schedule get aur velero backup get.',
          'velero schedule create payments-daily --schedule="0 2 * * *" --include-namespaces payments --ttl 720h  aur phir  velero backup create --from-schedule payments-daily',
        ],
        solution: [
          'kubectl get pods',
          'kubectl describe pod notify-7f6b9d-p3',
          'kubectl top nodes',
          'kubectl describe node node-new-1',
          'kubectl apply -f fix-notify-requests.yaml',
          'kubectl get pods',
          'velero schedule get',
          'velero backup get',
          'velero schedule create payments-daily --schedule="0 2 * * *" --include-namespaces payments --ttl 720h',
          'velero backup create --from-schedule payments-daily',
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Day-2 ka poora daayra',
      instructions: 'Aakhri round. Interviewer ek hi kahani mein chaaron hunar jaanchega. 🎤',
      questions: [
        {
          q: '"Pods Pending hain: \'0/3 nodes are available: 3 Insufficient cpu\'. Par monitoring mein nodes ka CPU 20% hai. Samjhao."',
          choices: [
            'Monitoring galat hai; Scheduler asli usage dekhta hai, isliye nodes sach mein bhare honge',
            'Scheduler requests jodta hai, usage nahi; pods ki requests itni badi hain ki nodes kaagaz par bhar gaye',
            'Nodes par taint laga hai; Insufficient cpu ka matlab hota hai ki pod taint ko tolerate nahi karta',
            'kubelet band hai; isi wajah se usage kam dikh raha hai aur Scheduler nodes ko bhara maan raha hai',
          ],
          answer: 1,
          explain: 'kubectl describe node ka "Allocated resources" (requests ka jod) aur kubectl top nodes (asli usage) ka farak dikhao. Farak bada ho toh requests ka naap galat hai — fix naap hai, naya node nahi.',
        },
        {
          q: '"Upgrade ke agle hafte pata chala ki 5 din se backup nahi hua. Aisa dobara na ho, iske liye kya badloge?"',
          choices: [
            'Backup ko din mein do baar chalaunga; zyada backups honge toh ek-do chhootne se farak nahi padega',
            'Upgrade ke baad haath se velero backup get chalane ka ek reminder calendar mein daal dunga',
            'Backup ki umr par alert lagaunga (26 ghante se purana → page), aur Schedule ko Git mein rakhunga',
            'Velero ko hata kar etcd snapshot par chala jaunga; etcd snapshot kabhi chupchaap band nahi hota',
          ],
          answer: 2,
          explain: 'Jo cheez chupchaap tootti hai, use alert se pakdo: "aakhri Completed backup kitna purana hai". Aur Schedule ko GitOps mein rakho taaki dobara install par Schedule apne aap wapas aaye. Insaan ki yaaddasht par bharosa mat karo.',
        },
        {
          q: '"Ek 1-replica StatefulSet hai jiske PDB mein maxUnavailable: 0 hai. Node upgrade kaise karoge?"',
          choices: [
            'Lamba hal 2+ replicas; aaj team ko bata kar kam traffic mein PDB dheela karke pod hataunga',
            'PDB ko hamesha ke liye delete kar dunga; 1 replica wali app ko PDB ki zaroorat hi nahi hoti',
            'kubectl drain --force chalaunga; StatefulSet ka pod waise bhi apne aap wapas ban jaata hai',
            'Us node ko upgrade se bahar rakhunga; purana kubelet naye Control Plane ke saath hamesha chalta hai',
          ],
          answer: 0,
          explain: '1 replica ka matlab hai ki pod hatega toh app kuch der band rahegi — isse bachne ka koi jaadu nahi. Sahi jawab mein teen cheezein hain: bata kar, kam traffic mein, aur PDB wapas lagana. Lamba hal: replicas badhana.',
        },
      ],
    },
    success: [
      'Main upgrade ki raat ke faisle sahi kram mein le sakta hoon',
      'Main "Insufficient cpu" ko asli usage aur reserve hue CPU ke farak se samjha sakta hoon',
      'Main chupchaap tooti cheezon (backup schedule, PDB) ko jaanch kar pakad sakta hoon',
    ],
    homework: `<p>Apne (ya office ke) cluster par yeh teen jaanch aaj hi karo:</p>
      <pre>kubectl get pdb -A                         # ALLOWED DISRUPTIONS = 0 kahan hai?
kubectl top nodes; kubectl describe nodes | grep -A8 "Allocated resources"
velero schedule get; velero backup get     # aakhri Completed backup kab ka hai?</pre>`,
    cards: [
      { front: '"Insufficient cpu" par pods Pending, par nodes ka usage kam. Pehla shak?', back: 'Requests bahut badi hain. <code>kubectl describe node</code> ka "Allocated resources" vs <code>kubectl top nodes</code> milao.' },
      { front: 'Bade badlaav (upgrade) ke baad kaun si teen cheezein jaanchni hain?', back: '(1) PDB wapas lage hain? (2) Backup schedule chal raha hai aur aakhri backup Completed hai? (3) Ek test deploy chalta hai?' },
      { front: 'Backup chupchaap band na ho, iske liye?', back: 'Alert: "aakhri Completed backup X ghante se purana". Aur Schedule ko Git (GitOps) mein rakho.' },
      { front: 'Velero mein roz raat 2 baje, 30 din rakhne wala schedule?', back: '<code>velero schedule create NAAM --schedule="0 2 * * *" --include-namespaces NS --ttl 720h</code>' },
    ],
  },
]);

})();
