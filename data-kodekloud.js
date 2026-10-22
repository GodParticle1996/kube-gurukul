/* =====================================================================
   KubeGurukul — 🩺 KodeKloud Gurukul (Scenario Path)

   Source: KodeKloud ke public course notes (notes.kodekloud.com) —
   "Kubernetes Troubleshooting for Application Developers", CKA
   (Cluster Maintenance + Security + Troubleshooting), CKS (System
   Hardening + Supply Chain + Runtime Security), aur Networking Deep Dive.

   Naya KodeKloud scenario aaya? Neeche wale kisi bhi chunk ke andar ek
   naya level object daal do — `KG.registerLevels` additive hai, aur har
   chunk apne IIFE mein hai isliye task-constants aapas mein nahi takrate.

   ✍️ Likhne ka niyam (ADHD-friendly): kisi bhi line mein "yeh / woh / isse /
   uska / wahan" pronoun ki tarah use NAHI karna. Har baar asli naam likho —
   "pod ka status", "kubelet ne", "checkout-api container". Har vaakya
   apne aap mein poora padha ja sake, pichhla vaakya yaad rakhe bina.
   ===================================================================== */

/* =====================================================================
   CHUNK 1 — Diagnosis ki buniyaad (levels 1-5)
   ===================================================================== */
(function () {
  const allOf = KG.allOf;

  /* ---- terminal mission checklists (registerLevels se PEHLE define) ---- */
  const T_TOOLKIT = [
    { text: 'kubectl get pods -n shop — pehle status dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
    { text: 'kubectl describe pod &lt;naam&gt; — Events padho', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S+/.test(h)) },
    { text: 'kubectl logs &lt;naam&gt; --previous — mare hue container ke logs', check: s => s.history.some(h => /^(kubectl|k) logs \S+.*--previous/.test(h)) },
    { text: 'Fix apply karo — kubectl apply -f add-dsn.yaml', check: s => s.cluster.pods.every(p => p.status === 'Running') },
  ];

  const T_IMAGEPULL = [
    { text: 'Teeno pod ka status dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
    { text: 'reports-api ko describe karo — asli reason Events mein hai', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S*reports/.test(h)) },
    { text: 'Teeno pod Running kar do', check: s => s.cluster.pods.every(p => p.status === 'Running') },
  ];

  const T_CRASH = [
    { text: 'Pod ka status + restart count dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
    { text: 'Last State ka exit code padho (describe)', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S+/.test(h)) },
    { text: 'Exit code ke hisaab se sahi fix apply karo', check: s => s.cluster.pods.every(p => p.status === 'Running') },
  ];

  KG.registerLevels('kodekloud', [

    /* ============================================================
       1. Diagnostic toolkit
       ============================================================ */
    {
      id: 'kk-toolkit',
      icon: '🔍',
      title: 'Diagnostic Toolkit — 8 command jo har cheez bata dete hain',
      badge: 'Toolkit Tantrik',
      objectives: [
        'Pod ke status se seedha samajhna ki AGLA command kaunsa chalana hai',
        '`kubectl logs` aur `kubectl logs --previous` ka farq — aur crash ke waqt kaunsa kaam aata hai',
        '`describe` ka Events section aur `get events --sort-by` ka farq',
        '`kubectl debug` (ephemeral container) se distroless image ke andar jhaankna',
      ],
      lesson: [
        `<h3>🔍 Pod ka status hi tumhara pehla clue hai</h3>
         <p>Har troubleshooting ek hi sawal se shuru hoti hai: <b>pod ka status kya likha hai?</b>
         Status batata hai ki pod lifecycle ke kis padav par atka hai, aur padav se pata chalta hai
         ki kaunsa component doshi hai.</p>
         <table class="kk-tbl">
           <tr><th>Status</th><th>Pod kahan atka</th><th>Agla command</th></tr>
           <tr><td><code>Pending</code></td><td>Scheduler ne abhi node chuna hi nahi</td><td><code>describe pod</code> → FailedScheduling</td></tr>
           <tr><td><code>ImagePullBackOff</code></td><td>kubelet image nahi utaar paa raha</td><td><code>describe pod</code> → Failed to pull</td></tr>
           <tr><td><code>CreateContainerConfigError</code></td><td>ConfigMap ya Secret gayab hai</td><td><code>describe pod</code> → "not found"</td></tr>
           <tr><td><code>CrashLoopBackOff</code></td><td>Container start hua, phir mar gaya</td><td><code>logs --previous</code></td></tr>
           <tr><td><code>Running</code> par <code>0/1</code></td><td>Readiness probe fail ho rahi hai</td><td><code>describe pod</code> → Readiness probe failed</td></tr>
           <tr><td><code>Terminating</code> hamesha ke liye</td><td>Finalizer atka hua hai</td><td><code>get pod -o yaml</code> → finalizers</td></tr>
         </table>
         <div class="war-story"><b>⚡ Asli galti:</b> log dekhne ki aadat sabse pehle padti hai.
         Par <code>Pending</code> pod ke paas log hote hi nahi — container kabhi bana hi nahi.
         Pending pod par <code>kubectl logs</code> chalana waqt ki barbadi hai; Pending pod par
         <code>kubectl describe pod</code> chalana chahiye, kyunki scheduler ka mana karne ka
         karan sirf Events section mein likha hota hai.</div>`,

        `<h3>🧰 Aath command, aath alag sawal</h3>
         <table class="kk-tbl">
           <tr><th>Command</th><th>Kaunsa sawal answer karta hai</th></tr>
           <tr><td><code>kubectl get pods -o wide</code></td><td>Pod kis node par hai, kaunsa IP mila</td></tr>
           <tr><td><code>kubectl describe pod</code></td><td>kubelet ne kya kaha — Events, Last State, exit code</td></tr>
           <tr><td><code>kubectl logs --previous</code></td><td>Marne se pehle container ne kya likha</td></tr>
           <tr><td><code>kubectl get events --sort-by=.lastTimestamp</code></td><td>Poore namespace mein aakhri 1 ghante mein kya-kya hua</td></tr>
           <tr><td><code>kubectl exec -it -- sh</code></td><td>Container ke andar se network/file kaisa dikhta hai</td></tr>
           <tr><td><code>kubectl debug -it --image=busybox</code></td><td>Distroless image, jisme shell hai hi nahi, uske andar jhaankna</td></tr>
           <tr><td><code>kubectl auth can-i --as=system:serviceaccount:…</code></td><td>Kya RBAC block kar raha hai</td></tr>
           <tr><td><code>kubectl diff -f app.yaml</code></td><td>File aur cluster ke beech ka farq, apply se PEHLE</td></tr>
         </table>
         <p><b>Do sabse zyada galat samjhe jaane wale:</b></p>
         <ul>
           <li><code>kubectl logs pod</code> <b>current</b> container ke logs deta hai. Jab container
           CrashLoopBackOff mein wait kar raha ho, current container hai hi nahi — isliye
           <code>kubectl logs</code> "container is waiting to start" bolta hai.</li>
           <li><code>kubectl logs pod --previous</code> <b>pichhle, mare hue</b> container ke logs deta hai.
           Crash ka asli error message sirf <code>--previous</code> mein milta hai.</li>
         </ul>`,
      ],
      stages: [
        {
          type: 'triage',
          title: '🩺 Triage: "Checkout page 502 de raha hai"',
          instructions: 'Command palette se ek-ek command chalao. Har command ka asli output milega. Saare clue mil jaane par root cause poocha jayega.',
          symptom: `<b>Support ticket, 14:02:</b> "Checkout page par <code>502 Bad Gateway</code> aa raha hai.
            Product page aur cart page dono theek chal rahe hain."<br>
            Namespace: <code>shop</code>. Deploy pichhle 20 minute mein hua tha.`,
          commands: [
            {
              cmd: 'kubectl get pods -n shop',
              clue: true,
              out: `NAME                            READY   STATUS             RESTARTS      AGE
cart-api-6b4d5f7c9-lm2wq        1/1     Running            0             9d
product-api-7f8c9d5b4-pq8rt     1/1     Running            0             9d
checkout-api-7d9c4b6f8-x2k4p    0/1     CrashLoopBackOff   6 (48s ago)   19m`,
              note: 'Teen mein se ek pod toota hai: <code>checkout-api</code> CrashLoopBackOff mein hai aur 6 baar restart ho chuka hai. Status "CrashLoopBackOff" ka matlab: container START to hua, phir mar gaya — isliye ab image ya scheduling par shaq karna band karo.',
            },
            {
              cmd: 'kubectl describe pod checkout-api-7d9c4b6f8-x2k4p -n shop',
              clue: true,
              out: `Containers:
  api:
    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       Error
      Exit Code:    1
      Started:      Mon, 04 Sep 2026 14:01:12
      Finished:     Mon, 04 Sep 2026 14:01:12
    Ready:          False
    Restart Count:  6
Events:
  Type     Reason     Age                From     Message
  ----     ------     ----               ----     -------
  Normal   Pulled     19m                kubelet  Container image "shop/checkout:2.4.1" already present
  Normal   Created    18m (x4 over 19m)  kubelet  Created container api
  Warning  BackOff    45s (x71 over 19m) kubelet  Back-off restarting failed container api`,
              note: '<b>Exit Code 1</b> = application khud crash hui (OOMKill hota to Exit Code 137 aata, aur Reason "OOMKilled" likha hota). Started aur Finished ka time same hai — checkout-api container ek second bhi zinda nahi raha.',
            },
            {
              cmd: 'kubectl logs checkout-api-7d9c4b6f8-x2k4p -n shop',
              clue: false,
              out: `Error from server (BadRequest): container "api" in pod "checkout-api-7d9c4b6f8-x2k4p" is waiting to start: CrashLoopBackOff`,
              note: 'Yahi woh galti hai jo sabse zyada hoti hai. Pod abhi backoff mein <i>wait</i> kar raha hai, isliye current container maujood hi nahi hai aur <code>kubectl logs</code> ke paas dikhane ko kuch nahi. Agla command <code>--previous</code> ke saath chalao.',
            },
            {
              cmd: 'kubectl logs checkout-api-7d9c4b6f8-x2k4p -n shop --previous',
              clue: true,
              out: `{"level":"info","msg":"checkout-api v2.4.1 booting"}
{"level":"info","msg":"reading config from env"}
panic: PG_DSN environment variable is empty

goroutine 1 [running]:
main.mustEnv(0x4c1a20, 0x6)
	/src/main.go:41 +0x105
main.main()
	/src/main.go:18 +0x37`,
              note: '<b>Yahan hai asli jawab.</b> checkout-api application <code>PG_DSN</code> environment variable maang rahi hai aur variable khaali hai, isliye application boot par hi panic kar rahi hai.',
            },
            {
              cmd: 'kubectl get svc,endpoints -n shop',
              clue: false,
              out: `NAME                   TYPE        CLUSTER-IP      PORT(S)    AGE
service/checkout-api   ClusterIP   10.96.144.31    80/TCP     9d
service/cart-api       ClusterIP   10.96.22.8      80/TCP     9d

NAME                     ENDPOINTS                       AGE
endpoints/checkout-api   <none>                          9d
endpoints/cart-api       10.244.1.9:8080                 9d`,
              note: '502 ka <i>seedha</i> karan yahan dikh gaya: <code>checkout-api</code> service ke endpoints khaali hain, isliye ingress ke paas bhejne ke liye koi backend nahi hai. Par endpoints khaali isliye hain kyunki pod ready nahi hai — root cause abhi bhi pod ke andar hai.',
            },
            {
              cmd: 'kubectl top pod -n shop',
              clue: false,
              out: `NAME                            CPU(cores)   MEMORY(bytes)
cart-api-6b4d5f7c9-lm2wq        4m           38Mi
product-api-7f8c9d5b4-pq8rt     6m           51Mi`,
              note: 'Dead end — aur dead end hona bhi ek information hai. checkout-api list mein hai hi nahi kyunki metrics-server sirf chalte hue containers se metrics leta hai. CPU/memory ka koi issue nahi dikh raha.',
            },
            {
              cmd: 'kubectl auth can-i get secrets -n shop --as=system:serviceaccount:shop:checkout',
              clue: false,
              out: `yes`,
              note: 'Dead end. RBAC block nahi kar raha, isliye "permission ka masla hai" wali theory yahin khatam.',
            },
          ],
          questions: [
            {
              q: 'Root cause kya hai?',
              choices: [
                'checkout-api application boot par panic karti hai kyunki PG_DSN environment variable khaali hai',
                'checkout-api service ka selector galat hai, isliye endpoints khaali hain',
                'checkout-api pod ko memory limit se zyada memory chahiye, isliye OOMKilled ho raha hai',
                'checkout-api ka image registry se nahi utar paa raha',
              ],
              answer: 0,
              explain: '<code>--previous</code> logs mein saaf likha hai: <code>panic: PG_DSN environment variable is empty</code>. Exit Code 1 ne bhi confirm kiya ki application khud mari, kubelet ne nahi maari (OOMKill hota to Exit Code 137 aata). Khaali endpoints ek <b>lakshan</b> the, karan nahi — pod ready nahi tha isliye endpoint list khaali thi.',
            },
            {
              q: 'Bina <code>--previous</code> ke <code>kubectl logs</code> ne kuch kyun nahi dikhaya?',
              choices: [
                'Bina flag ke kubectl logs CURRENT container maangta hai, aur backoff ke dauraan current container maujood hi nahi hota',
                'CrashLoopBackOff mein logs kubelet delete kar deta hai',
                'Namespace flag lagana bhool gaye the',
                'Logs sirf tab dikhte hain jab pod Ready ho',
              ],
              answer: 0,
              explain: 'Bina flag ke <code>kubectl logs</code> abhi ke container ka log stream maangta hai. CrashLoopBackOff ka matlab hai "kubelet agla restart karne se pehle ruk gaya hai" — us waqt koi container chal hi nahi raha. Mare hue container ka log kubelet thodi der rakhta hai, aur <code>--previous</code> se hi milta hai. <b>Yaad rakho:</b> CrashLoopBackOff dikhe to seedha <code>--previous</code> lagao.',
            },
          ],
        },
        {
          type: 'bins',
          title: 'Kaunsa command, kis symptom par?',
          instructions: 'Har symptom ko us command ke bin mein daalo jo us symptom ke liye SABSE pehla step hai.',
          bins: [
            { id: 'describe', label: '📋 describe pod' },
            { id: 'prev', label: '📜 logs --previous' },
            { id: 'exec', label: '🐚 exec / debug' },
            { id: 'events', label: '🗓️ get events' },
          ],
          items: [
            { text: 'Pod 10 minute se Pending hai', bin: 'describe', explain: 'Pending pod ke paas container hi nahi hai, isliye log nahi hote. Scheduler ka FailedScheduling message sirf describe ke Events section mein milta hai.' },
            { text: 'Status CrashLoopBackOff, restarts 12', bin: 'prev', explain: 'Container start hokar mara. Marne se pehle jo error print hua, woh sirf --previous mein bacha hai.' },
            { text: 'Status ImagePullBackOff', bin: 'describe', explain: 'describe ka Events section poora reason likhta hai — "manifest unknown" (tag galat) ya "unauthorized" (imagePullSecret gayab) ya "no such host" (registry DNS).' },
            { text: 'Pod Running hai par app apne database tak nahi pahunch paa rahi', bin: 'exec', explain: 'Pod ke andar se DNS aur connectivity test karni padegi — kubectl exec se shell lo, ya distroless image ho to kubectl debug se ephemeral container attach karo.' },
            { text: 'Aadhe ghante pehle poora namespace hil gaya tha, ab shaant hai', bin: 'events', explain: 'Ek pod ka describe sirf us pod ki kahani deta hai. Poore namespace ki timeline ke liye: kubectl get events --sort-by=.lastTimestamp' },
            { text: 'Pod Running hai par READY column 0/1 dikha raha hai', bin: 'describe', explain: 'Container zinda hai par readiness probe fail ho rahi hai. Probe ka exact failure message describe ke Events mein aata hai: "Readiness probe failed: HTTP probe failed with statuscode: 500".' },
            { text: 'Image distroless hai, usme sh aur bash dono nahi hain', bin: 'exec', explain: 'kubectl exec fail ho jayega kyunki shell binary hai hi nahi. kubectl debug -it &lt;pod&gt; --image=busybox --target=&lt;container&gt; ek ephemeral container chipka deta hai jo same network aur process namespace share karta hai.' },
            { text: 'Ek pod baar-baar Evicted ho raha hai, wajah nahi pata', bin: 'events', explain: 'Eviction node-level dabaav se hota hai (disk ya memory pressure). Namespace ke events mein kubelet ka "The node was low on resource: ephemeral-storage" message milta hai.' },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: toolkit se checkout-api ko zinda karo',
          instructions: 'Wahi cluster, ab asli terminal mein. Sahi kram mein commands chalao: status → describe → previous logs → fix.',
          goal: 'Toolkit ke teen kadam chalao — <b>(1)</b> <code>kubectl get pods -n shop</code>, <b>(2)</b> <code>kubectl describe pod</code>, <b>(3)</b> <code>kubectl logs &lt;pod&gt; --previous</code> — phir <code>ls</code> se fix file dhoondh ke apply karo.',
          tasks: T_TOOLKIT,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '9d', version: 'v1.30.2' }],
            pods: [
              { name: 'checkout-api-7d9c4b6f8-x2k4p', ready: '0/1', status: 'CrashLoopBackOff', restarts: 6, age: '19m', node: 'node-1', ip: '10.244.1.14',
                logs: 'Error from server (BadRequest): container "api" in pod is waiting to start: CrashLoopBackOff',
                prevLogs: '{"level":"info","msg":"checkout-api v2.4.1 booting"}\npanic: PG_DSN environment variable is empty\n\ngoroutine 1 [running]:\nmain.mustEnv(0x4c1a20, 0x6)\n\t/src/main.go:41 +0x105',
                describe: 'Name:         checkout-api-7d9c4b6f8-x2k4p\nNamespace:    shop\nStatus:       Running\nContainers:\n  api:\n    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1\n    Restart Count:  6\n    Environment:\n      PORT:  8080\nEvents:\n  Warning  BackOff  45s (x71 over 19m)  kubelet  Back-off restarting failed container api',
                events: ['Warning  BackOff  45s (x71 over 19m)  kubelet  Back-off restarting failed container api'] },
            ],
            deployments: [{ name: 'checkout-api', ready: '0/1', upToDate: 1, available: 0, age: '9d' }],
            services: [{ name: 'checkout-api', type: 'ClusterIP', clusterIP: '10.96.144.31', ports: '80/TCP', age: '9d' }],
            endpoints: [{ name: 'checkout-api', endpoints: '<none>', age: '9d' }],
          },
          files: {
            'add-dsn.yaml': {
              desc: 'checkout-api deployment mein PG_DSN environment variable jodta hai',
              apply: s => {
                s.cluster.pods.forEach(p => {
                  p.status = 'Running'; p.ready = '1/1'; p.restarts = 0;
                  p.logs = '{"level":"info","msg":"checkout-api v2.4.1 booting"}\n{"level":"info","msg":"connected to postgres"}\n{"level":"info","msg":"listening on :8080"}';
                });
                s.cluster.deployments[0].ready = '1/1';
                s.cluster.deployments[0].available = 1;
                s.cluster.endpoints[0].endpoints = '10.244.1.14:8080';
                return 'deployment.apps/checkout-api configured';
              },
            },
            'restart-pod.yaml': {
              desc: 'pod delete karke naya banata hai (config waisi ki waisi rehti hai)',
              apply: () => 'pod/checkout-api-7d9c4b6f8-x2k4p deleted\n\n⚠️  Naya pod bhi CrashLoopBackOff mein chala gaya. Restart karne se config ki galti nahi sudhti — PG_DSN abhi bhi khaali hai.',
            },
          },
          success: allOf(T_TOOLKIT),
          successText: 'Kram yaad rakho: <b>status → describe → previous logs → fix</b>. Har kadam agle kadam ko chunta hai. <code>get pods</code> ne bataya ki container start hokar mara (isliye image par shaq band). <code>describe</code> ne Exit Code 1 dikhaya (isliye OOMKill par shaq band). <code>--previous</code> ne exact panic message diya. Guess karne ki zaroorat kahin nahi padi.',
          hints: [
            'Shuru karo: kubectl get pods -n shop',
            'Ab describe karo: kubectl describe pod checkout-api-7d9c4b6f8-x2k4p',
            'CrashLoopBackOff ke logs --previous ke bina nahi milte: kubectl logs checkout-api-7d9c4b6f8-x2k4p --previous',
            'ls chalao — add-dsn.yaml ko kubectl apply -f add-dsn.yaml se lagao',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Ek pod Running hai par READY column 0/1 dikhata hai. Container zinda hai. Kya ho raha hai?"',
            choices: [
              'Readiness probe fail ho rahi hai — container chal raha hai par Service uske paas traffic nahi bhejegi',
              'Liveness probe fail ho rahi hai — kubelet container ko maar dega',
              'Pod ko scheduler ne abhi node nahi diya',
              'Image pull abhi chal raha hai',
            ],
            answer: 0,
            explain: 'READY column readiness probe ka result hai. Readiness fail hone par kubelet container ko maarta NAHI — kubelet sirf pod ko Service ke endpoints se hata deta hai. Liveness fail hoti to restart count badhta aur status CrashLoopBackOff ki taraf jaata. Farq yaad rakho: <b>readiness = traffic milega ya nahi</b>, <b>liveness = container zinda rahega ya nahi</b>.',
          },
          {
            q: 'Interviewer: "Image distroless hai — usme shell hai hi nahi. Pod ke andar se DNS test kaise karoge?"',
            choices: [
              'kubectl debug -it &lt;pod&gt; --image=busybox --target=&lt;container&gt; — ephemeral container same namespaces share karta hai',
              'kubectl exec -it &lt;pod&gt; -- /bin/sh chalega, kubectl apna shell inject karta hai',
              'Pod ko delete karke debug image ke saath dobara deploy karna hi ek raasta hai',
              'kubectl cp se busybox binary pod ke andar copy karo',
            ],
            answer: 0,
            explain: '<code>kubectl debug</code> ek <b>ephemeral container</b> chipkata hai jo target container ke network aur (target dete hi) process namespace share karta hai. Isliye busybox ke tools se wahi DNS aur wahi network dikhta hai jo application container ko dikhta hai — aur running pod ko restart bhi nahi karna padta. <code>kubectl exec</code> pod ke andar maujood binary hi chala sakta hai, isliye distroless par exec fail hota hai.',
          },
        ],
      },
      success: [
        'Main pod ke status se seedha bata sakta hoon ki agla command kaunsa chalana hai',
        'Main CrashLoopBackOff par bina soche `--previous` lagata hoon',
        'Main Exit Code 1 (app crash) aur Exit Code 137 (OOMKilled) mein farq kar sakta hoon',
        'Main distroless image ko `kubectl debug` se debug kar sakta hoon',
      ],
      homework: `<p>Apne kind/minikube cluster par jaan-boojh ke ek pod todo aur toolkit chalao:</p>
        <pre>kubectl run boom --image=busybox --restart=Never -- sh -c 'echo starting; exit 1'
kubectl get pod boom
kubectl describe pod boom | grep -A5 "Last State"
kubectl logs boom --previous</pre>
        <p>Phir ek Pending pod banao aur dekho ki <code>kubectl logs</code> kuch nahi deta par
        <code>kubectl describe</code> FailedScheduling message deta hai:</p>
        <pre>kubectl run huge --image=nginx --overrides='{"spec":{"containers":[{"name":"huge","image":"nginx","resources":{"requests":{"cpu":"500"}}}]}}'
kubectl describe pod huge | tail -5</pre>`,
      cards: [
        { front: 'CrashLoopBackOff par `kubectl logs` "container is waiting to start" kyun deta hai?', back: 'Bina flag ke `kubectl logs` CURRENT container maangta hai. Backoff ke dauraan koi container chal hi nahi raha. Mare hue container ka log <code>--previous</code> se aata hai.' },
        { front: 'Exit Code 1 vs Exit Code 137 — kya farq hai?', back: '<b>1</b> = application khud crash hui (bad config, panic, missing env). <b>137</b> = 128+9, yaani SIGKILL — kubelet ne memory limit todne par container ko maara (Reason: OOMKilled).' },
        { front: 'Pod Running par 0/1 READY — kya toota hai?', back: 'Readiness probe. Container zinda hai, par Service ne pod ko endpoints se hata diya hai. Exact probe error <code>kubectl describe pod</code> ke Events mein milta hai.' },
        { front: 'Poore namespace ki timeline kaise dekhein?', back: '<code>kubectl get events -n &lt;ns&gt; --sort-by=.lastTimestamp</code> — ek pod ka describe sirf usi pod ki kahani deta hai.' },
        { front: 'Distroless container ke andar debug kaise karein?', back: '<code>kubectl debug -it &lt;pod&gt; --image=busybox --target=&lt;container&gt;</code> — ephemeral container same network/process namespace mein chipakta hai, pod restart nahi hota.' },
      ],
    },

    /* ============================================================
       2. Image pull errors
       ============================================================ */
    {
      id: 'kk-imagepull',
      icon: '🖼️',
      title: 'ImagePullBackOff — image kyun nahi aayi',
      badge: 'Registry Rakshak',
      objectives: [
        '`ErrImagePull` aur `ImagePullBackOff` ka farq samajhna',
        'Paanch alag wajah pehchanna: typo, galat tag, private registry, rate limit, registry DNS',
        'Events ke exact message se seedha wajah tak pahunchna',
        '`imagePullSecrets` aur `imagePullPolicy` sahi jagah lagana',
      ],
      lesson: [
        `<h3>🖼️ Do alag status, ek hi kahani ke do padav</h3>
         <p><b>ErrImagePull</b> = kubelet ne image pull ki koshish ki aur koshish abhi-abhi fail hui.
         <b>ImagePullBackOff</b> = kubelet ne kai baar koshish ki, har baar fail hui, isliye kubelet ab
         agli koshish se pehle intezaar kar raha hai (10s, 20s, 40s… max 5 minute).</p>
         <p>Dono statuses ek hi baat kehte hain: <b>image node par nahi aa paayi</b>.
         Asli wajah kabhi bhi status mein nahi likhi hoti — asli wajah
         <code>kubectl describe pod</code> ke Events section mein likhi hoti hai.</p>
         <table class="kk-tbl">
           <tr><th>Events mein yeh message</th><th>Iska matlab</th><th>Fix</th></tr>
           <tr><td><code>manifest for … not found</code></td><td>Repo sahi hai, <b>tag</b> galat hai</td><td>Tag theek karo (<code>2.4.1</code> vs <code>v2.4.1</code>)</td></tr>
           <tr><td><code>repository does not exist</code></td><td>Image ke <b>naam</b> mein typo</td><td>Naam theek karo</td></tr>
           <tr><td><code>unauthorized</code> / <code>authentication required</code></td><td>Private registry, credentials nahi mile</td><td><code>imagePullSecrets</code> jodo</td></tr>
           <tr><td><code>toomanyrequests</code> / <code>rate limit</code></td><td>Docker Hub ka anonymous pull limit khatam</td><td>Login karo ya mirror/proxy use karo</td></tr>
           <tr><td><code>no such host</code> / <code>i/o timeout</code></td><td>Node registry tak pahunch hi nahi paa raha</td><td>Node ka DNS/firewall/proxy dekho</td></tr>
         </table>`,

        `<h3>🔐 imagePullSecrets kahan lagta hai</h3>
         <p>Private registry ka secret <b>docker-registry</b> type ka hota hai, aur secret usi
         namespace mein hona chahiye jisme pod chal raha hai:</p>
         <pre>kubectl create secret docker-registry regcred \\
  --docker-server=ghcr.io \\
  --docker-username=USER --docker-password=TOKEN \\
  -n shop</pre>
         <p>Secret ko pod tak pahunchane ke do raste hain:</p>
         <pre>spec:
  imagePullSecrets:          # raasta 1 — har deployment mein likho
    - name: regcred</pre>
         <pre># raasta 2 — ServiceAccount par ek baar, phir har pod ko apne aap milega
kubectl patch serviceaccount default -n shop \\
  -p '{"imagePullSecrets":[{"name":"regcred"}]}'</pre>
         <div class="war-story"><b>⚡ Asli incident:</b> ek team ne <code>regcred</code> secret
         <code>default</code> namespace mein banaya, par deployment <code>shop</code> namespace mein
         thi. Secret aur pod alag namespace mein the, isliye kubelet ko credentials mile hi nahi
         aur Events mein <code>unauthorized</code> aata raha. Secret namespace-scoped hoti hai —
         har namespace mein alag secret banani padti hai.</div>
         <p><b>imagePullPolicy ka jaal:</b> <code>:latest</code> tag ke saath default policy
         <code>Always</code> ho jaati hai; baaki har tag ke saath default <code>IfNotPresent</code> hoti hai.
         Isliye <code>myapp:1.0</code> ko naya push karne ke baad bhi node purani cached image chalata
         rehta hai — kyunki IfNotPresent policy node par maujood image ko hi kaafi maanti hai.</p>`,
      ],
      stages: [
        {
          type: 'triage',
          title: '🩺 Triage: teen naye pods, teen alag ImagePull failure',
          instructions: 'Teen pods ek hi deploy mein aaye, teeno mein ImagePullBackOff hai — par teeno ki wajah alag hai. Events padho.',
          symptom: `<b>Deploy ke baad:</b> namespace <code>staging</code> ke teen naye pods —
            <code>reports-api</code>, <code>mailer</code>, <code>scanner</code> — teeno
            <code>ImagePullBackOff</code> mein hain.<br>
            Chaar purane pods bilkul theek chal rahe hain.`,
          commands: [
            {
              cmd: 'kubectl get pods -n staging',
              clue: true,
              out: `NAME                           READY   STATUS             RESTARTS   AGE
reports-api-5f8b7c6d9-kk2mn    0/1     ImagePullBackOff   0          4m
mailer-6c9d8e7f5-tt4pq         0/1     ErrImagePull       0          4m
scanner-7a8b9c0d1-ww8rs        0/1     ImagePullBackOff   0          4m
web-6d5c4b3a2-zz1xy            1/1     Running            0          14d`,
              note: 'Teen naye pods atke hain, purana <code>web</code> pod chal raha hai. Node theek hai — agar node hi toota hota to purana pod bhi girta. <code>mailer</code> abhi <code>ErrImagePull</code> mein hai (abhi-abhi fail hua), baaki do backoff mein pahunch chuke hain.',
            },
            {
              cmd: 'kubectl describe pod reports-api-5f8b7c6d9-kk2mn -n staging | tail -8',
              clue: true,
              out: `Events:
  Type     Reason     Age                  From     Message
  ----     ------     ----                 ----     -------
  Normal   Pulling    4m (x4 over 4m)      kubelet  Pulling image "ghcr.io/acme/reports:v2.4.1"
  Warning  Failed     4m (x4 over 4m)      kubelet  Failed to pull image "ghcr.io/acme/reports:v2.4.1":
             rpc error: code = NotFound desc = failed to pull and unpack image:
             ghcr.io/acme/reports:v2.4.1: not found
  Warning  Failed     4m (x4 over 4m)      kubelet  Error: ErrImagePull
  Normal   BackOff    50s (x16 over 4m)    kubelet  Back-off pulling image "ghcr.io/acme/reports:v2.4.1"`,
              note: '<code>not found</code> — registry ne jawab diya, authentication bhi chali. Repository maujood hai, sirf <b>tag <code>v2.4.1</code> maujood nahi hai</b>. CI ne shayad tag <code>2.4.1</code> (bina <code>v</code> ke) push kiya tha.',
            },
            {
              cmd: 'kubectl describe pod mailer-6c9d8e7f5-tt4pq -n staging | tail -6',
              clue: true,
              out: `Events:
  Type     Reason   Age              From     Message
  ----     ------   ----             ----     -------
  Normal   Pulling  4m (x3 over 4m)  kubelet  Pulling image "ghcr.io/acme/mailer:1.2.0"
  Warning  Failed   4m (x3 over 4m)  kubelet  Failed to pull image "ghcr.io/acme/mailer:1.2.0":
             failed to resolve reference: unexpected status from HEAD request: 401 Unauthorized`,
              note: '<code>401 Unauthorized</code> — bilkul alag wajah. Tag theek hai, par registry ne credentials maange aur kubelet ke paas credentials the hi nahi. <code>mailer</code> ke liye <code>imagePullSecrets</code> chahiye.',
            },
            {
              cmd: 'kubectl describe pod scanner-7a8b9c0d1-ww8rs -n staging | tail -6',
              clue: true,
              out: `Events:
  Type     Reason   Age              From     Message
  ----     ------   ----             ----     -------
  Normal   Pulling  4m (x4 over 4m)  kubelet  Pulling image "docker.io/library/trivy:0.52"
  Warning  Failed   4m (x4 over 4m)  kubelet  Failed to pull image "docker.io/library/trivy:0.52":
             toomanyrequests: You have reached your pull rate limit.
             You may increase the limit by authenticating and upgrading`,
              note: '<code>toomanyrequests</code> — teesri alag wajah. Docker Hub ka anonymous pull limit (per IP) khatam ho gaya. Node ka public IP poore cluster ke saath share hota hai, isliye limit jaldi bharta hai.',
            },
            {
              cmd: 'kubectl get secrets -n staging',
              clue: false,
              out: `NAME       TYPE                             DATA   AGE
regcred    kubernetes.io/dockerconfigjson   1      14d`,
              note: 'Secret <code>regcred</code> namespace <code>staging</code> mein maujood hai. Toh secret gayab nahi hai — <code>mailer</code> deployment usse reference hi nahi kar rahi.',
            },
            {
              cmd: 'kubectl get nodes',
              clue: false,
              out: `NAME     STATUS   ROLES    AGE   VERSION
node-1   Ready    <none>   90d   v1.30.2
node-2   Ready    <none>   90d   v1.30.2`,
              note: 'Dead end. Dono nodes Ready hain, isliye "node down" wali theory khatam.',
            },
          ],
          questions: [
            {
              q: 'Teeno pods ek hi ImagePullBackOff dikha rahe hain. Kya ek hi fix teeno ko theek kar dega?',
              choices: [
                'Nahi — teeno ki wajah alag hai: reports-api ka tag galat, mailer ko pull secret chahiye, scanner Docker Hub rate limit se atka hai',
                'Haan — teeno ko imagePullSecrets chahiye',
                'Haan — teeno nodes ka registry DNS toota hai',
                'Nahi — par teeno ka ek hi fix hai: imagePullPolicy ko Never kar do',
              ],
              answer: 0,
              explain: 'Status sirf batata hai ki <i>image nahi aayi</i>. Wajah har baar Events mein alag likhi hoti hai: <code>not found</code> = tag galat, <code>401 Unauthorized</code> = credentials chahiye, <code>toomanyrequests</code> = registry rate limit. Teeno ke fix bhi alag hain. <b>Sabak:</b> ek jaisa status ka matlab ek jaisi wajah nahi hota.',
            },
            {
              q: '<code>mailer</code> ke liye secret <code>regcred</code> namespace mein pehle se maujood hai. Phir 401 kyun aa raha hai?',
              choices: [
                'Secret ka maujood hona kaafi nahi — mailer deployment mein spec.imagePullSecrets nahi likha, isliye kubelet ne secret uthaya hi nahi',
                'Secret ka type galat hai, Opaque hona chahiye',
                'Secret ko har node par manually copy karna padta hai',
                'kubelet secrets sirf default namespace se padhta hai',
              ],
              answer: 0,
              explain: 'kubelet apne aap namespace ki saari secrets nahi aazmata. kubelet sirf wahi secret use karta hai jo pod spec ke <code>imagePullSecrets</code> mein likhi ho, ya jo pod ke ServiceAccount par lagi ho. <b>Do fix:</b> deployment mein <code>imagePullSecrets: [{name: regcred}]</code> jodo, ya ServiceAccount par ek baar patch kar do taaki namespace ke saare pods ko apne aap mile.',
            },
          ],
        },
        {
          type: 'fill',
          title: '📄 Private registry ka secret aur pod spec',
          instructions: 'GHCR se private image kheenchne ke liye deployment ka spec poora karo.',
          template: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: mailer
  namespace: staging
spec:
  selector: { matchLabels: { app: mailer } }
  template:
    metadata: { labels: { app: mailer } }
    spec:
      {0}:                     # kubelet ko credentials yahan se milte hain
        - name: {1}
      containers:
        - name: mailer
          image: ghcr.io/acme/mailer:1.2.0
          imagePullPolicy: {2}   # naya tag har baar registry se laao`,
          blanks: [
            { answer: 'imagePullSecrets', explain: 'Pod spec ka field <code>imagePullSecrets</code> hai (pod ke level par, container ke level par nahi). kubelet sirf yahan likhi secrets aazmata hai.' },
            { answer: 'regcred', explain: 'Wahi secret jo <code>kubectl create secret docker-registry regcred -n staging</code> se bani. Secret usi namespace mein honi chahiye jisme pod hai.' },
            { answer: 'Always', explain: '<code>Always</code> har pod start par registry se manifest check karta hai. <code>IfNotPresent</code> node par cached image milte hi registry se baat hi nahi karta — isliye mutable tag (jaise <code>1.2.0</code> ko dobara push karna) ke saath purana code chalta rehta hai.' },
          ],
          tokens: ['imagePullSecrets', 'regcred', 'Always', 'IfNotPresent', 'Never', 'imagePullPolicy', 'dockerconfigjson'],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: teeno image pull theek karo',
          instructions: 'describe se har pod ki alag wajah padho, phir sahi fix file lagao. Har pod ka fix alag hai.',
          goal: 'Teeno pods ko <b>Running</b> laao. Pehle <code>kubectl get pods</code>, phir <code>kubectl describe pod</code> se wajah padho, phir <code>ls</code> se sahi fix file chuno.',
          tasks: T_IMAGEPULL,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '90d', version: 'v1.30.2' }],
            pods: [
              { name: 'reports-api-5f8b7c6d9-kk2mn', ready: '0/1', status: 'ImagePullBackOff', restarts: 0, age: '4m', node: 'node-1', ip: '<none>',
                describe: 'Name:    reports-api-5f8b7c6d9-kk2mn\nImage:   ghcr.io/acme/reports:v2.4.1\nEvents:\n  Warning  Failed   4m  kubelet  Failed to pull image "ghcr.io/acme/reports:v2.4.1": not found\n  Normal   BackOff  50s  kubelet  Back-off pulling image "ghcr.io/acme/reports:v2.4.1"',
                events: ['Warning  Failed  4m  kubelet  Failed to pull image "ghcr.io/acme/reports:v2.4.1": not found'] },
              { name: 'mailer-6c9d8e7f5-tt4pq', ready: '0/1', status: 'ImagePullBackOff', restarts: 0, age: '4m', node: 'node-1', ip: '<none>',
                describe: 'Name:    mailer-6c9d8e7f5-tt4pq\nImage:   ghcr.io/acme/mailer:1.2.0\nEvents:\n  Warning  Failed  4m  kubelet  Failed to pull image: 401 Unauthorized',
                events: ['Warning  Failed  4m  kubelet  Failed to pull image "ghcr.io/acme/mailer:1.2.0": 401 Unauthorized'] },
              { name: 'scanner-7a8b9c0d1-ww8rs', ready: '0/1', status: 'ImagePullBackOff', restarts: 0, age: '4m', node: 'node-1', ip: '<none>',
                describe: 'Name:    scanner-7a8b9c0d1-ww8rs\nImage:   docker.io/library/trivy:0.52\nEvents:\n  Warning  Failed  4m  kubelet  Failed to pull image: toomanyrequests: You have reached your pull rate limit',
                events: ['Warning  Failed  4m  kubelet  toomanyrequests: You have reached your pull rate limit'] },
            ],
            deployments: [
              { name: 'reports-api', ready: '0/1', upToDate: 1, available: 0, age: '4m' },
              { name: 'mailer', ready: '0/1', upToDate: 1, available: 0, age: '4m' },
              { name: 'scanner', ready: '0/1', upToDate: 1, available: 0, age: '4m' },
            ],
            services: [],
          },
          files: {
            'fix-tag.yaml': {
              desc: 'reports-api ka image tag v2.4.1 → 2.4.1 karta hai',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('reports-api'));
                if (!p) return 'reports-api pod nahi mila';
                p.status = 'Running'; p.ready = '1/1'; p.ip = '10.244.1.21';
                s.cluster.deployments[0].ready = '1/1'; s.cluster.deployments[0].available = 1;
                return 'deployment.apps/reports-api configured\n✅ reports-api ab Running hai — tag 2.4.1 registry mein maujood tha.';
              },
            },
            'add-pullsecret.yaml': {
              desc: 'mailer deployment mein imagePullSecrets: regcred jodta hai',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('mailer'));
                if (!p) return 'mailer pod nahi mila';
                p.status = 'Running'; p.ready = '1/1'; p.ip = '10.244.1.22';
                s.cluster.deployments[1].ready = '1/1'; s.cluster.deployments[1].available = 1;
                return 'deployment.apps/mailer configured\n✅ mailer ab Running hai — kubelet ko regcred se GHCR ke credentials mil gaye.';
              },
            },
            'use-mirror.yaml': {
              desc: 'scanner ka image Docker Hub se internal mirror registry par le jaata hai',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('scanner'));
                if (!p) return 'scanner pod nahi mila';
                p.status = 'Running'; p.ready = '1/1'; p.ip = '10.244.1.23';
                s.cluster.deployments[2].ready = '1/1'; s.cluster.deployments[2].available = 1;
                return 'deployment.apps/scanner configured\n✅ scanner ab Running hai — mirror registry par anonymous rate limit nahi lagta.';
              },
            },
            'restart-all.yaml': {
              desc: 'teeno deployments ko restart karta hai',
              apply: () => 'deployment.apps/reports-api restarted\ndeployment.apps/mailer restarted\ndeployment.apps/scanner restarted\n\n⚠️ Teeno naye pods bhi ImagePullBackOff mein hain. Restart se galat tag sahi nahi hota, gayab secret aa nahi jaati, aur rate limit reset nahi hoti.',
            },
          },
          success: allOf(T_IMAGEPULL),
          successText: 'Teen pods, teen alag fix — aur teeno ki wajah <b>Events</b> ki ek line mein likhi thi. Yaad rakho: <code>not found</code> = tag/naam galat · <code>401 Unauthorized</code> = imagePullSecrets chahiye · <code>toomanyrequests</code> = registry rate limit · <code>no such host</code> = node ka DNS. Status kabhi wajah nahi batata, Events hamesha batate hain.',
          hints: [
            'Pehle sabka status: kubectl get pods',
            'Har pod ki wajah alag hai: kubectl describe pod reports-api-5f8b7c6d9-kk2mn',
            'Baaki dono ko bhi describe karo — mailer par 401, scanner par toomanyrequests milega',
            'ls chalao, phir teeno fix lagao: fix-tag.yaml, add-pullsecret.yaml, use-mirror.yaml',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "CI ne image <code>myapp:1.0</code> dobara build karke push ki. Pods restart karne par bhi purana code chal raha hai. Kyun?"',
            choices: [
              'imagePullPolicy IfNotPresent hai — node par cached myapp:1.0 milte hi kubelet registry se baat hi nahi karta',
              'kubelet ki image cache 24 ghante tak refresh nahi hoti',
              'Deployment ka spec badla nahi, isliye naye pods bane hi nahi',
              'Registry ne purani layer serve ki',
            ],
            answer: 0,
            explain: 'Non-<code>latest</code> tag ke saath default <code>imagePullPolicy</code> <b>IfNotPresent</b> hoti hai. Node par <code>myapp:1.0</code> naam ki image pehle se maujood hai, isliye kubelet registry se poochta hi nahi ki naya digest aaya ya nahi. <b>Do sahi ilaaj:</b> har build par naya immutable tag do (<code>myapp:1.0-abc123</code>), ya digest se pin karo (<code>myapp@sha256:…</code>). <code>imagePullPolicy: Always</code> kaam karta hai par mutable tag ki asli bimari nahi hatata.',
          },
          {
            q: 'Interviewer: "Ek hi image do namespaces mein deploy ki. dev mein pull ho gayi, prod mein 401 aa raha hai. Secret dono jagah check kar li — dono mein hai."',
            choices: [
              'prod ke deployment spec mein imagePullSecrets likha hi nahi, ya prod ka ServiceAccount alag hai jispe secret attach nahi hai',
              'Secret ka data base64 mein double-encode ho gaya hai',
              'Registry ne prod cluster ka IP block kar diya',
              'prod namespace mein PodSecurity policy secrets padhne se rok rahi hai',
            ],
            answer: 0,
            explain: 'Secret ka maujood hona kaafi nahi — secret ko pod se <b>jodna</b> padta hai. Do jagah jodi jaati hai: pod spec ka <code>imagePullSecrets</code>, ya pod ke ServiceAccount ka <code>imagePullSecrets</code>. Aksar dev ke default ServiceAccount par secret patch kiya hota hai aur prod ke ServiceAccount par patch reh jaata hai. Check karo: <code>kubectl get sa default -n prod -o yaml</code>.',
          },
        ],
      },
      success: [
        'Main Events ke exact message se image failure ki wajah pehchan sakta hoon',
        'Main jaanta hoon ki imagePullSecrets pod spec ya ServiceAccount par lagti hai, aur secret namespace-scoped hoti hai',
        'Main samajhta hoon ki IfNotPresent policy mutable tag ke saath purana code chalati rehti hai',
      ],
      homework: `<p>Apne cluster par teeno failure khud paida karo aur Events ka farq dekho:</p>
        <pre># 1. tag galat
kubectl run t1 --image=nginx:does-not-exist
kubectl describe pod t1 | grep -A3 Failed

# 2. repo hi galat
kubectl run t2 --image=ghcr.io/no-such-org/no-such-image:1
kubectl describe pod t2 | grep -A3 Failed

# 3. private registry bina secret ke
kubectl run t3 --image=ghcr.io/acme/private-thing:1
kubectl describe pod t3 | grep -A3 Failed</pre>
        <p>Teeno ke Events padho — teeno ka message alag hoga, aur wahi message fix chunta hai.</p>`,
      cards: [
        { front: 'ErrImagePull vs ImagePullBackOff?', back: '<b>ErrImagePull</b> = abhi-abhi pull fail hui. <b>ImagePullBackOff</b> = kai baar fail hui, ab kubelet agli koshish se pehle ruk raha hai (10s → 20s → 40s … max 5 min). Wajah dono mein Events se milti hai.' },
        { front: 'Events mein <code>manifest not found</code> vs <code>401 Unauthorized</code>?', back: '<b>not found</b> = registry ne jawab diya, auth chali, par tag maujood nahi. <b>401</b> = registry ne credentials maange aur kubelet ke paas the hi nahi → imagePullSecrets chahiye.' },
        { front: 'imagePullSecrets kahan likhte hain?', back: 'Pod spec ke level par (container ke andar nahi), ya pod ke ServiceAccount par. Secret <b>usi namespace</b> mein honi chahiye jisme pod hai — secret namespace-scoped hoti hai.' },
        { front: 'imagePullPolicy ka default kya hai?', back: '<code>:latest</code> tag ya bina tag ke → <b>Always</b>. Baaki har tag → <b>IfNotPresent</b>. Isliye mutable tag dobara push karne par node purani cached image chalata rehta hai.' },
        { front: '<code>toomanyrequests</code> ka matlab?', back: 'Docker Hub ka anonymous pull rate limit khatam (per source IP, jo poore cluster mein share hota hai). Fix: registry mein login karo, ya internal mirror/pull-through cache use karo.' },
      ],
    },

    /* ============================================================
       3. CrashLoopBackOff — 6 causes
       ============================================================ */
    {
      id: 'kk-crashloop',
      icon: '💥',
      title: 'CrashLoopBackOff — chhe alag wajah, chhe alag ilaaj',
      badge: 'Crash Chikitsak',
      objectives: [
        'Exit code se seedha wajah tak pahunchna: 0, 1, 137, 139, 143',
        'Application crash aur OOMKilled ka farq bina guess kiye pakadna',
        'Liveness probe se hone wale "fake crash" ko pehchanna',
        'Init container ke fail hone ko main container ke crash se alag karna',
      ],
      lesson: [
        `<h3>💥 Exit code hi sabse tez raasta hai</h3>
         <p>CrashLoopBackOff ek status hai, wajah nahi. Wajah <code>kubectl describe pod</code> ke
         <b>Last State</b> block mein exit code ke roop mein milti hai.</p>
         <table class="kk-tbl">
           <tr><th>Exit Code</th><th>Kisne maara</th><th>Sabse aam wajah</th></tr>
           <tr><td><code>0</code></td><td>Koi nahi — process apna kaam karke khud khatam hua</td><td>Command batch jaisi hai (jaise <code>echo hi</code>). Deployment ko lambe samay tak chalne wala process chahiye — Job use karo.</td></tr>
           <tr><td><code>1</code></td><td>Application khud</td><td>Missing env var, galat config file, DB tak nahi pahunch paayi</td></tr>
           <tr><td><code>137</code></td><td>kubelet (SIGKILL)</td><td>Memory limit tod di → Reason: <b>OOMKilled</b></td></tr>
           <tr><td><code>139</code></td><td>Kernel (SIGSEGV)</td><td>Segfault — galat CPU architecture ki image, ya native library ka bug</td></tr>
           <tr><td><code>143</code></td><td>kubelet (SIGTERM)</td><td>Graceful shutdown chala. Aksar liveness probe fail hone ke baad.</td></tr>
           <tr><td><code>127</code></td><td>Shell</td><td>"command not found" — entrypoint ka path galat hai</td></tr>
         </table>
         <div class="war-story"><b>⚡ Sabse mehnga confusion:</b> Exit Code 137 dekhte hi log
         memory limit badha dete hain. Par 137 sirf "SIGKILL mila" kehta hai. Agar
         <code>Reason: OOMKilled</code> likha hai tabhi memory ka masla hai. Agar
         <code>Reason: Error</code> ke saath 137 hai, to kisi aur ne SIGKILL bheja — jaise
         node ka OOM killer ya koi sidecar. Reason padhe bina limit badhana andhera mein teer hai.</div>`,

        `<h3>🔁 Do "nakli" CrashLoop jo application ki galti nahi hote</h3>
         <p><b>1. Liveness probe bahut aggressive hai.</b> Application ko boot hone mein 40 second
         lagte hain, par liveness probe <code>initialDelaySeconds: 5</code> ke saath 5 second baad
         hi poochne lagti hai. Application abhi boot ho rahi hoti hai, probe fail hoti hai,
         kubelet container maar deta hai, container dobara boot hone lagta hai, probe phir fail
         hoti hai — anant loop. Container ki apni koi galti nahi hai.</p>
         <p><b>Ilaaj:</b> <code>startupProbe</code> lagao. Jab tak startupProbe pass nahi hoti,
         kubelet liveness aur readiness dono ko chalata hi nahi:</p>
         <pre>startupProbe:
  httpGet: { path: /healthz, port: 8080 }
  failureThreshold: 30      # 30 × 5s = 150 second ka slow-boot budget
  periodSeconds: 5
livenessProbe:
  httpGet: { path: /healthz, port: 8080 }
  periodSeconds: 10         # boot ke BAAD hi shuru hoti hai</pre>
         <p><b>2. Init container fail ho raha hai.</b> Pod ka status <code>Init:CrashLoopBackOff</code>
         dikhta hai, <code>CrashLoopBackOff</code> nahi. Main container abhi shuru hi nahi hua.
         Init container ke logs alag se maangne padte hain:</p>
         <pre>kubectl logs &lt;pod&gt; -c &lt;init-container-ka-naam&gt;</pre>
         <p>Status ka prefix <code>Init:</code> hi bata deta hai ki dekhna kahan hai — main
         container ke logs khaali honge kyunki main container chala hi nahi.</p>`,
      ],
      stages: [
        {
          type: 'bins',
          title: 'Exit code se wajah pehchano',
          instructions: 'Har describe-snippet ko us wajah ke bin mein daalo jo snippet saabit karta hai.',
          bins: [
            { id: 'app', label: '🐛 Application ki galti' },
            { id: 'oom', label: '🧠 Memory (OOMKilled)' },
            { id: 'probe', label: '🩺 Probe ne maara' },
            { id: 'spec', label: '📝 Spec/manifest ki galti' },
          ],
          items: [
            { text: 'Last State: Terminated · Reason: Error · Exit Code: 1', bin: 'app', explain: 'Exit Code 1 = process ne khud non-zero code se exit kiya. Application ne kuch galat paya (missing env, config file nahi mili, DB connect fail). Asli message --previous logs mein hai.' },
            { text: 'Last State: Terminated · Reason: OOMKilled · Exit Code: 137', bin: 'oom', explain: 'Reason OOMKilled likha hai — kubelet ne memory limit todne par SIGKILL bheja. Fix: memory limit badhao, ya application ka memory usage kam karo. Sirf 137 dekhkar OOM maan lena galat hai; Reason zaroor padho.' },
            { text: 'Events: Liveness probe failed: HTTP probe failed with statuscode: 503 (x8)', bin: 'probe', explain: 'kubelet ne probe fail hone par container ko SIGTERM bheja (Exit Code 143). Application shayad theek hai par abhi boot ho rahi thi. Fix: startupProbe jodo, ya initialDelaySeconds badhao.' },
            { text: 'Last State: Terminated · Reason: Completed · Exit Code: 0', bin: 'spec', explain: 'Container ne apna kaam poora kiya aur khatam ho gaya. Deployment ko hamesha chalne wala process chahiye, isliye kubelet dobara start karta hai — anant loop. Sahi resource Job ya CronJob hai, Deployment nahi.' },
            { text: 'Error: failed to create containerd task: exec: "/app/server": stat /app/server: no such file or directory', bin: 'spec', explain: 'Entrypoint path galat hai. Binary image ke andar us path par hai hi nahi. Fix: Dockerfile ka WORKDIR/COPY ya pod spec ka command/args theek karo.' },
            { text: 'Last State: Terminated · Reason: Error · Exit Code: 139', bin: 'app', explain: 'Exit Code 139 = 128+11 = SIGSEGV (segfault). Sabse aam wajah: arm64 node par amd64 image (ya ulta), ya kisi native library ka bug.' },
            { text: 'Status: Init:CrashLoopBackOff · Init Containers: wait-for-db (Terminated, Exit Code 1)', bin: 'spec', explain: 'Main container shuru hi nahi hua. Init container wait-for-db fail ho raha hai. Logs alag se maango: kubectl logs &lt;pod&gt; -c wait-for-db. Aksar init container ka DB host ka naam galat hota hai.' },
            { text: 'memory limit 128Mi, container ka RSS graph 126Mi par flat hai aur restart har 4 min', bin: 'oom', explain: 'Memory limit ke bilkul kinare par chal raha hai. Har GC spike limit paar karti hai aur kubelet SIGKILL bhejta hai. Fix: limit badhao (request bhi saath badhao warna QoS Burstable rehta hai aur eviction ka khatra bana rehta hai).' },
          ],
        },
        {
          type: 'triage',
          title: '🩺 Triage: "payments-api har 3 minute mein restart ho raha hai"',
          instructions: 'Restart hone ka matlab hamesha application ki galti nahi hota. Evidence jama karo.',
          symptom: `<b>Alert:</b> <code>payments-api</code> ka restart count 3 ghante mein 47 ho gaya.
            Har restart ke beech kareeb 3 minute ka gap hai.<br>
            Application team kehti hai: "hamare logs mein koi error nahi hai".`,
          commands: [
            {
              cmd: 'kubectl get pod payments-api-5d7f9c8b6-h3nqx -o wide',
              clue: true,
              out: `NAME                             READY   STATUS    RESTARTS       AGE    NODE
payments-api-5d7f9c8b6-h3nqx     1/1     Running   47 (2m ago)    3h12m  node-2`,
              note: 'Status <b>Running</b> hai aur READY <b>1/1</b> hai — pod is waqt bilkul theek hai. Restart count 47 hai. Matlab: container baar-baar mar ke wapas aa raha hai, par har baar theek se boot ho jaata hai. Yeh "application boot par crash ho rahi hai" wala pattern NAHI hai.',
            },
            {
              cmd: 'kubectl describe pod payments-api-5d7f9c8b6-h3nqx | grep -A6 "Last State"',
              clue: true,
              out: `    Last State:     Terminated
      Reason:       Error
      Exit Code:    143
      Started:      Mon, 04 Sep 2026 16:38:02
      Finished:     Mon, 04 Sep 2026 16:41:07`,
              note: '<b>Exit Code 143</b> = 128+15 = <b>SIGTERM</b>. Application ko graceful shutdown ka signal mila — application crash nahi hui, kisi ne usse band karne ko kaha. Started aur Finished ke beech 3 minute 5 second hain, jo restart ke gap se match karta hai.',
            },
            {
              cmd: 'kubectl describe pod payments-api-5d7f9c8b6-h3nqx | grep -A8 Events',
              clue: true,
              out: `Events:
  Type     Reason     Age                     From     Message
  ----     ------     ----                    ----     -------
  Warning  Unhealthy  2m (x141 over 3h)       kubelet  Liveness probe failed:
             Get "http://10.244.2.31:8080/healthz": context deadline exceeded
             (Client.Timeout exceeded while awaiting headers)
  Normal   Killing    2m (x47 over 3h)        kubelet  Container payments failed
             liveness probe, will be restarted`,
              note: '<b>Yahan hai jawab.</b> kubelet khud container ko maar raha hai kyunki liveness probe ka jawab timeout ke andar nahi aa raha. Application ki galti nahi hai — probe ka configuration galat hai. Note: 141 probe failures par sirf 47 restarts hue, kyunki failureThreshold 3 hai.',
            },
            {
              cmd: 'kubectl get deploy payments-api -o jsonpath="{.spec.template.spec.containers[0].livenessProbe}" | python3 -m json.tool',
              clue: true,
              out: `{
    "httpGet": { "path": "/healthz", "port": 8080 },
    "initialDelaySeconds": 5,
    "periodSeconds": 10,
    "timeoutSeconds": 1,
    "failureThreshold": 3
}`,
              note: '<code>timeoutSeconds: 1</code> — probe ko 1 second ke andar jawab chahiye. <code>/healthz</code> endpoint database ko ping karta hai, aur peak load par database 1 second se zyada le leta hai. Probe timeout hoti hai, 3 baar lagataar fail hoti hai, kubelet container maar deta hai.',
            },
            {
              cmd: 'kubectl logs payments-api-5d7f9c8b6-h3nqx --previous | tail -5',
              clue: false,
              out: `{"level":"info","msg":"handled POST /charge","ms":41}
{"level":"info","msg":"handled GET /healthz","ms":1180}
{"level":"info","msg":"handled POST /charge","ms":38}
{"level":"info","msg":"received SIGTERM, draining connections"}
{"level":"info","msg":"shutdown complete"}`,
              note: 'Application team sahi keh rahi thi — logs mein koi error nahi hai. Application ne shaanti se SIGTERM handle kiya. Par ek line par gaur karo: <code>/healthz</code> ne <b>1180 ms</b> liye, aur probe ka timeout 1000 ms hai.',
            },
            {
              cmd: 'kubectl top pod payments-api-5d7f9c8b6-h3nqx',
              clue: false,
              out: `NAME                             CPU(cores)   MEMORY(bytes)
payments-api-5d7f9c8b6-h3nqx     180m         210Mi`,
              note: 'Dead end. CPU aur memory dono aaram se limits ke andar hain, isliye OOMKill ya CPU throttling wali theory khatam.',
            },
          ],
          questions: [
            {
              q: 'payments-api ke restarts ki asli wajah kya hai?',
              choices: [
                'Liveness probe ka timeout 1s hai par /healthz endpoint peak par 1.1s+ leta hai — kubelet swasth container ko maar raha hai',
                'Application memory limit paar kar rahi hai aur OOMKilled ho rahi hai',
                'Application boot par crash kar rahi hai kyunki config missing hai',
                'Node par disk pressure hai isliye pod evict ho raha hai',
              ],
              answer: 0,
              explain: 'Teen sabooot jodo: <b>(1)</b> Exit Code 143 = SIGTERM, yaani kisi ne band karne ko kaha, application khud nahi mari. <b>(2)</b> Events mein <code>Liveness probe failed: context deadline exceeded</code> aur <code>Killing … failed liveness probe</code>. <b>(3)</b> Logs mein <code>/healthz</code> ne 1180 ms liye jabki <code>timeoutSeconds: 1</code> hai. kubelet ek bilkul swasth container ko maar raha hai.',
            },
            {
              q: 'Sabse behtar fix kya hai?',
              choices: [
                'timeoutSeconds badhao aur /healthz ko halka karo taaki healthz database ko ping na kare',
                'Liveness probe hata do — probe ke bina restart hi nahi hoga',
                'Memory limit dugni kar do',
                'failureThreshold ko 100 kar do',
              ],
              answer: 0,
              explain: 'Do cheezein saath karni hain. <b>(1)</b> <code>timeoutSeconds</code> ko 3-5 second karo taaki peak par bhi probe ko jawab mil jaye. <b>(2)</b> Aur zyada zaroori: <code>/healthz</code> endpoint ko sirf "process zinda hai?" ka jawab dena chahiye — database ko ping nahi karna chahiye. Database ki jaanch <b>readiness</b> probe ka kaam hai, kyunki readiness fail hone par pod sirf traffic se hatta hai, marta nahi. Liveness probe hata dena galat hai: phir asli deadlock hone par bhi kubelet kabhi restart nahi karega.',
            },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: exit code padho, sahi fix chuno',
          instructions: 'Ek pod CrashLoopBackOff mein hai. Exit code aur Reason padhe bina fix mat lagao — teen mein se do fix ulta nuksaan karenge.',
          goal: '<code>kubectl get pods</code> se status dekho, <code>kubectl describe pod</code> se <b>Last State</b> ka Exit Code aur Reason padho, phir <code>ls</code> se sahi fix chuno.',
          tasks: T_CRASH,
          cluster: {
            nodes: [{ name: 'node-2', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.30.2' }],
            pods: [
              { name: 'ingest-worker-6f5d4c3b2-nn8kp', ready: '0/1', status: 'CrashLoopBackOff', restarts: 11, age: '24m', node: 'node-2', ip: '10.244.2.44',
                logs: 'Error from server (BadRequest): container "worker" in pod is waiting to start: CrashLoopBackOff',
                prevLogs: '2026-09-04T16:02:11Z ingest-worker starting, batch size 5000\n2026-09-04T16:02:14Z loaded 5000 records into memory\n2026-09-04T16:02:19Z loaded 40000 records into memory\n<no further output — process killed>',
                describe: 'Name:         ingest-worker-6f5d4c3b2-nn8kp\nNamespace:    data\nStatus:       Running\nContainers:\n  worker:\n    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       OOMKilled\n      Exit Code:    137\n      Started:      Mon, 04 Sep 2026 16:02:11\n      Finished:     Mon, 04 Sep 2026 16:02:23\n    Restart Count:  11\n    Limits:\n      memory:  256Mi\n    Requests:\n      memory:  256Mi\nEvents:\n  Warning  BackOff  40s (x88 over 24m)  kubelet  Back-off restarting failed container worker',
                events: ['Warning  BackOff  40s (x88 over 24m)  kubelet  Back-off restarting failed container worker'] },
            ],
            deployments: [{ name: 'ingest-worker', ready: '0/1', upToDate: 1, available: 0, age: '24m' }],
            services: [],
          },
          files: {
            'raise-memory.yaml': {
              desc: 'ingest-worker ki memory request+limit 256Mi se 1Gi karta hai',
              apply: s => {
                const p = s.cluster.pods[0];
                p.status = 'Running'; p.ready = '1/1'; p.restarts = 0;
                p.logs = '2026-09-04T16:30:02Z ingest-worker starting, batch size 5000\n2026-09-04T16:30:41Z processed 250000 records, peak RSS 780Mi\n2026-09-04T16:30:41Z batch complete';
                p.describe = 'Name: ingest-worker-6f5d4c3b2-nn8kp\nContainers:\n  worker:\n    State:  Running\n    Limits:\n      memory:  1Gi\n    Requests:\n      memory:  1Gi';
                s.cluster.deployments[0].ready = '1/1'; s.cluster.deployments[0].available = 1;
                return 'deployment.apps/ingest-worker configured\n✅ Peak RSS 780Mi tha — 256Mi limit hamesha kam padti. Ab worker poora batch process kar leta hai.';
              },
            },
            'relax-liveness.yaml': {
              desc: 'liveness probe ka timeout aur failureThreshold badhata hai',
              apply: () => 'deployment.apps/ingest-worker configured\n\n⚠️ Naya pod bhi OOMKilled hua. Reason "OOMKilled" tha, "Liveness probe failed" nahi — is pod par koi probe fail hi nahi ho rahi thi. Probe theek karne se memory limit nahi badhti.',
            },
            'add-env.yaml': {
              desc: 'worker mein missing environment variables jodta hai',
              apply: () => 'deployment.apps/ingest-worker configured\n\n⚠️ Naya pod bhi OOMKilled hua. Exit Code 137 + Reason OOMKilled = kubelet ne memory limit par SIGKILL bheja. Exit Code 1 hota tab missing env var wali theory sahi hoti.',
            },
          },
          success: allOf(T_CRASH),
          successText: 'Do line ne poora jawab de diya tha: <code>Reason: OOMKilled</code> aur <code>Exit Code: 137</code>. <b>137 akela kaafi nahi</b> — Reason zaroor padho, kyunki 137 ke saath <code>Reason: Error</code> ka matlab hota hai ki SIGKILL kisi aur ne bheja (node ka OOM killer, ya koi sidecar). Aur logs ki aakhri line bhi clue thi: output beech mein hi kat gaya, jo SIGKILL ki pehchaan hai — SIGTERM par application "shutting down" likh paati hai.',
          hints: [
            'Pehle status: kubectl get pods',
            'Ab kundli kholo: kubectl describe pod ingest-worker-6f5d4c3b2-nn8kp',
            'Last State block dhundo — Reason aur Exit Code dono padho',
            'Reason OOMKilled hai → ls chalao aur raise-memory.yaml lagao',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Container ka Exit Code 137 hai par Reason <code>Error</code> likha hai, <code>OOMKilled</code> nahi. Kya matlab?"',
            choices: [
              'SIGKILL kisi aur ne bheja — container ne apni memory limit nahi todi. Node ka kernel OOM killer, ya koi sidecar/supervisor doshi ho sakta hai',
              'Matlab wahi hai, Kubernetes kabhi-kabhi Reason likhna bhool jaata hai',
              'Container ne khud exit(137) call kiya',
              'Image ka architecture galat hai',
            ],
            answer: 0,
            explain: '<code>OOMKilled</code> Reason kubelet <b>sirf tab</b> likhta hai jab container apni cgroup memory limit par maara gaya ho. 137 ke saath <code>Reason: Error</code> ka matlab hai SIGKILL to mila par container ki limit ki wajah se nahi. Aam wajah: node par kul memory khatam hui aur kernel ka OOM killer ne sabse bhaari process chuna (limit ke andar wale process bhi shikaar ban sakte hain), ya ek sidecar ne main process ko maara. Isliye <b>Reason padhe bina limit badhana</b> problem ko chhupata hai, hataata nahi.',
          },
          {
            terminal: {
              title: '🎤 Interview mission: init container fail ho raha hai',
              instructions: 'Interviewer ne ek Init:CrashLoopBackOff pod diya hai. Sahi container ke logs nikalo.',
              goal: '🧑‍💼 Interviewer: "Pod ka status <code>Init:CrashLoopBackOff</code> hai. <code>kubectl logs</code> ne main container ke logs khaali diye. Asli error nikalo aur fix lagao."',
              tasks: [
                { text: 'Pod ka status dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
                { text: 'Init container ke logs padho (-c wait-for-db)', check: s => s.history.some(h => /^(kubectl|k) logs \S+.*-c wait-for-db/.test(h)) },
                { text: 'Fix apply karo', check: s => s.cluster.pods.every(p => p.status === 'Running') },
              ],
              cluster: {
                nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '10d', version: 'v1.30.2' }],
                pods: [
                  { name: 'orders-api-8c7b6a5d4-vv2mz', ready: '0/1', status: 'Init:CrashLoopBackOff', restarts: 9, age: '18m', node: 'node-1', ip: '10.244.1.55',
                    logs: 'Error from server (BadRequest): container "api" in pod "orders-api-8c7b6a5d4-vv2mz" is waiting to start: PodInitializing',
                    describe: 'Name:    orders-api-8c7b6a5d4-vv2mz\nInit Containers:\n  wait-for-db:\n    State:       Waiting\n      Reason:    CrashLoopBackOff\n    Last State:  Terminated\n      Reason:    Error\n      Exit Code: 1\nContainers:\n  api:\n    State:  Waiting\n      Reason: PodInitializing',
                    events: ['Warning  BackOff  30s (x62 over 18m)  kubelet  Back-off restarting failed container wait-for-db'] },
                ],
                deployments: [{ name: 'orders-api', ready: '0/1', upToDate: 1, available: 0, age: '18m' }],
                services: [{ name: 'postgres', type: 'ClusterIP', clusterIP: '10.96.9.44', ports: '5432/TCP', age: '60d' }],
              },
              responses: [
                {
                  re: /^(kubectl|k) logs \S+ -c wait-for-db$/,
                  out: 'waiting for database at postgres-db.data.svc.cluster.local:5432\nnc: getaddrinfo: Name or service not known\nwaiting for database at postgres-db.data.svc.cluster.local:5432\nnc: getaddrinfo: Name or service not known\ntimed out after 60s',
                },
              ],
              files: {
                'fix-dbhost.yaml': {
                  desc: 'init container ka DB host postgres-db.data → postgres.default karta hai',
                  apply: s => {
                    const p = s.cluster.pods[0];
                    p.status = 'Running'; p.ready = '1/1'; p.restarts = 0;
                    p.logs = '{"msg":"orders-api listening on :8080"}';
                    s.cluster.deployments[0].ready = '1/1'; s.cluster.deployments[0].available = 1;
                    return 'deployment.apps/orders-api configured\n✅ Init container ko postgres.default.svc.cluster.local mil gaya aur pod boot ho gaya.';
                  },
                },
              },
              success: s => s.history.some(h => /^(kubectl|k) logs \S+.*-c wait-for-db/.test(h)) && s.cluster.pods.every(p => p.status === 'Running'),
              successText: 'Status ka prefix hi raasta batata hai: <code>Init:</code> ka matlab main container abhi chala hi nahi. Init container ke logs <code>-c &lt;init-container-naam&gt;</code> ke bina nahi milte. Yahan init container ka DNS naam <code>postgres-db.data</code> tha jabki asli Service <code>postgres</code> hai namespace <code>default</code> mein.',
              hints: [
                'kubectl get pods — status ka prefix dhyaan se padho',
                'Init container ka naam describe mein hai: wait-for-db',
                'kubectl logs orders-api-8c7b6a5d4-vv2mz -c wait-for-db',
                'ls → kubectl apply -f fix-dbhost.yaml',
              ],
            },
          },
        ],
      },
      success: [
        'Main exit code (0/1/137/139/143/127) se seedha wajah tak pahunch sakta hoon',
        'Main OOMKilled ko Reason se confirm karta hoon, sirf 137 dekhkar nahi',
        'Main liveness probe se hone wale nakli crash ko pehchan sakta hoon',
        'Main `Init:` prefix dekhte hi init container ke logs `-c` se maangta hoon',
      ],
      homework: `<p>Teen alag exit code khud paida karo aur describe mein farq dekho:</p>
        <pre># Exit Code 0 — Deployment ko lambe samay tak chalne wala process chahiye
kubectl create deployment quitter --image=busybox -- echo hello
kubectl describe pod -l app=quitter | grep -A3 "Last State"

# Exit Code 137 — OOMKilled
kubectl run hog --image=polinux/stress --restart=Never \\
  --overrides='{"spec":{"containers":[{"name":"hog","image":"polinux/stress","resources":{"limits":{"memory":"20Mi"}},"command":["stress","--vm","1","--vm-bytes","150M"]}]}}'
kubectl describe pod hog | grep -A4 "Last State"

# Exit Code 127 — command not found
kubectl run typo --image=busybox --restart=Never -- /bin/nosuchthing
kubectl describe pod typo | grep -A3 "Last State"</pre>`,
      cards: [
        { front: 'Exit Code 137 ke saath Reason "Error" (OOMKilled nahi) — kya matlab?', back: 'SIGKILL mila par container ki apni memory limit ki wajah se nahi. Aam wajah: node ka kernel OOM killer, ya kisi sidecar ne process ko maara. Limit badhane se theek nahi hoga.' },
        { front: 'Exit Code 0 par CrashLoopBackOff kaise?', back: 'Process apna kaam karke shaanti se khatam ho gaya. Deployment ko hamesha chalne wala process chahiye, isliye kubelet dobara start karta hai — anant loop. Sahi resource <b>Job</b> hai.' },
        { front: 'Liveness probe se hone wala restart kaise pehchanein?', back: 'Exit Code <b>143</b> (SIGTERM) + Events mein <code>Liveness probe failed</code> aur <code>Killing … failed liveness probe</code>. Application ke logs saaf honge — kyunki application ki galti hai hi nahi.' },
        { front: 'Slow-booting application ko liveness se kaise bachayein?', back: '<code>startupProbe</code> lagao. Jab tak startupProbe pass nahi hoti, kubelet liveness aur readiness dono chalata hi nahi. <code>failureThreshold × periodSeconds</code> = boot ka budget.' },
        { front: 'Status <code>Init:CrashLoopBackOff</code> par logs kahan se?', back: '<code>kubectl logs &lt;pod&gt; -c &lt;init-container-naam&gt;</code>. Main container abhi chala hi nahi, isliye main container ke logs khaali honge.' },
      ],
    },
  ]);
})();

/* =====================================================================
   CHUNK 2 — Container lifecycle, scheduling aur "pod hai hi nahi" (levels 4-6)
   ===================================================================== */
(function () {
  const allOf = KG.allOf;

  const T_LIFECYCLE = [
    { text: 'Dono pods ka status dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
    { text: 'demo-a ko describe karo — kaunsi cheez "not found" hai?', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S*demo-a/.test(h)) },
    { text: 'demo-b ko describe karo — CRI ne kya shikayat ki?', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S*demo-b/.test(h)) },
    { text: 'Dono pods Running karo', check: s => s.cluster.pods.every(p => p.status === 'Running') },
  ];

  const T_PENDING = [
    { text: 'Pending pods dhoondo', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
    { text: 'FailedScheduling message padho (describe)', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S+/.test(h)) },
    { text: 'Nodes aur unke labels/taints dekho', check: s => s.history.some(h => /^(kubectl|k) (get|describe) (nodes|no)\b/.test(h)) },
    { text: 'Teeno pods schedule karwao', check: s => s.cluster.pods.every(p => p.status === 'Running') },
  ];

  const T_QUOTA = [
    { text: 'Deployment aur ReplicaSet dono ka status dekho', check: s => s.history.some(h => /^(kubectl|k) get (rs|replicasets?)\b/.test(h)) },
    { text: 'ReplicaSet ke events padho — asli error wahan hai', check: s => s.history.some(h => /^(kubectl|k) describe (rs|replicaset) \S+/.test(h)) },
    { text: 'Namespace ka quota dekho', check: s => s.history.some(h => /^(kubectl|k) (get|describe) (quota|resourcequota|resourcequotas)\b/.test(h)) },
    { text: 'Pods bana ke dikhao', check: s => s.cluster.pods.length >= 3 && s.cluster.pods.every(p => p.status === 'Running') },
  ];

  KG.registerLevels('kodekloud', [

    /* ============================================================
       4. Container lifecycle errors
       ============================================================ */
    {
      id: 'kk-createcontainer',
      icon: '⚙️',
      title: 'CreateContainerConfigError vs CreateContainerError vs RunContainerError',
      badge: 'Lifecycle Lohar',
      objectives: [
        'Container ke chaar padav yaad karna: image pull → config → create → start',
        'Har padav ki apni error ko naam se pehchanna',
        'Error ke naam se seedha yeh nikalna ki galti YAML mein hai, cluster mein hai, ya image mein hai',
        'Ek jaise dikhne wale teen errors ke teen alag fix chunna',
      ],
      lesson: [
        `<h3>⚙️ Container banne ke chaar padav</h3>
         <p>kubelet container ko ek hi jhatke mein nahi chalata. kubelet chaar alag padav paar karta hai,
         aur har padav ki apni alag error hai. Error ka naam hi bata deta hai ki kaunsa padav toota:</p>
         <table class="kk-tbl">
           <tr><th>#</th><th>Padav</th><th>Fail hone par status</th><th>Galti kahan hai</th></tr>
           <tr><td>1</td><td><b>Image pull</b> — image node par laana</td><td><code>ErrImagePull</code> / <code>ImagePullBackOff</code></td><td>Image ka naam/tag, ya registry credentials</td></tr>
           <tr><td>2</td><td><b>Config assemble</b> — env, ConfigMap, Secret, volume padhna</td><td><code>CreateContainerConfigError</code></td><td>Cluster mein koi ConfigMap/Secret gayab hai</td></tr>
           <tr><td>3</td><td><b>Container create</b> — CRI ko OCI spec dena</td><td><code>CreateContainerError</code></td><td>Pod spec adhoori hai (jaise koi command hi nahi), ya CRI/runtime ka masla</td></tr>
           <tr><td>4</td><td><b>Process start</b> — entrypoint exec karna</td><td><code>RunContainerError</code> / <code>StartError</code></td><td>Entrypoint ka path galat, permission nahi, ya binary ka architecture galat</td></tr>
         </table>
         <p>Chaaron padav paar hone ke baad hi container "Running" banta hai. Uske baad koi
         gadbad hoti hai to status <code>CrashLoopBackOff</code> hota hai — jo bilkul alag bimari hai
         (container chala tha, phir mara).</p>`,

        `<h3>🔍 Do sabse confusing errors ka farq</h3>
         <p><b>CreateContainerConfigError</b> — kubelet pod spec ko poora nahi kar paaya kyunki
         spec kisi aisi cheez ko reference kar raha hai jo cluster mein hai hi nahi:</p>
         <pre>Warning  Failed  5m  kubelet  Error: secret "demo-a-secret" not found</pre>
         <p>Fix cluster mein hai — gayab Secret ya ConfigMap banao (ya naam ka typo theek karo).
         Aam wajah: <code>secretKeyRef</code> mein secret ka naam sahi hai par <b>key</b> ka naam galat,
         ya secret doosre namespace mein bani hai.</p>

         <p><b>CreateContainerError</b> — kubelet ne config to poori kar li, par CRI (containerd)
         ne container banane se mana kar diya:</p>
         <pre>Warning  Failed  12m  kubelet  Error: failed to generate spec: no command specified</pre>
         <p>Fix YAML mein hai — image ka apna ENTRYPOINT/CMD nahi hai aur pod spec mein bhi
         <code>command</code> nahi diya gaya, isliye CRI ke paas chalane ko kuch hai hi nahi.</p>

         <div class="war-story"><b>⚡ Yaad rakhne ka tarika:</b> <b>Config</b>Error ka matlab
         "cluster mein kuch gayab hai" (Secret/ConfigMap). Bina Config wala
         <b>CreateContainerError</b> ka matlab "YAML adhoori hai ya runtime ne mana kiya".
         Dono errors ek jaise dikhte hain par dono ke fix bilkul alag jagah hain.</div>`,
      ],
      stages: [
        {
          type: 'flow',
          title: '🎬 Flow: pod spec se chalte hue container tak — kahan-kahan toot sakta hai',
          instructions: '▶ dabao aur poora safar dekho. Har padav par kaun kaam kar raha hai, lane highlight se dikhega. Beech mein teen sawal aayenge.',
          lanes: [
            { id: 'sched', label: 'Scheduler', icon: '⚖️' },
            { id: 'kubelet', label: 'kubelet', icon: '🤖' },
            { id: 'cri', label: 'containerd (CRI)', icon: '📦' },
            { id: 'proc', label: 'Container process', icon: '🏃' },
          ],
          steps: [
            { lane: 'sched', t: 'Pod ko node-2 par bind kiya', detail: 'Scheduler ne node chuna aur API server par <code>spec.nodeName: node-2</code> likh diya. Event: <code>Scheduled</code>.<br><b>Yahan fail ho to:</b> pod <code>Pending</code> rehta hai aur Event <code>FailedScheduling</code> aata hai.' },
            { lane: 'kubelet', t: 'node-2 ke kubelet ne pod uthaya', detail: 'node-2 ka kubelet API server se apne node ke pods dekhta rehta hai. Naya pod dikha, kubelet ne kaam shuru kiya.' },
            { lane: 'kubelet', t: 'Sandbox banaya (pause container + network)', detail: 'kubelet ne CNI plugin bulaya. Pod ko IP mila aur network namespace bana. <br><b>Yahan fail ho to:</b> status <code>ContainerCreating</code> par atak jaata hai aur Event mein <code>failed to setup network for sandbox</code> aata hai — matlab CNI plugin ya IP pool ka masla.' },
            { lane: 'kubelet', t: 'Image node par laayi', detail: 'kubelet ne CRI se image pull karwayi.<br><b>Yahan fail ho to:</b> <code>ErrImagePull</code> → <code>ImagePullBackOff</code>.',
              ask: { q: 'Pod ka status <code>ImagePullBackOff</code> hai. kubelet abhi kis padav par atka hai?', choices: ['Padav 1 — image node par laane par; container abhi bana hi nahi', 'Padav 4 — process start karne par', 'Container chal raha tha aur ab mar gaya', 'Scheduler ne abhi node hi nahi chuna'], answer: 0, explain: 'ImagePullBackOff ka matlab image node tak pahunchi hi nahi. Jab image node par nahi hai, container object banane ka sawal hi nahi uthta. Isliye is padav par <code>kubectl logs</code> hamesha khaali hoga — container kabhi bana hi nahi.' } },
            { lane: 'kubelet', t: 'Config assemble ki — env, ConfigMap, Secret, volumes', detail: 'kubelet ne API server se har referenced ConfigMap aur Secret maangi taaki environment variables bhare ja sakein.<br><b>Yahan fail ho to:</b> <code>CreateContainerConfigError</code>, aur Event mein exact naam: <code>secret "demo-a-secret" not found</code>.',
              ask: { q: 'Status <code>CreateContainerConfigError</code> hai aur Event kehta hai <code>configmap "app-settings" not found</code>. Fix kahan lagega?', choices: ['Cluster mein — gayab ConfigMap "app-settings" banao (ya pod spec mein naam ka typo theek karo)', 'Image mein — Dockerfile ka ENTRYPOINT theek karo', 'Node par — containerd restart karo', 'Deployment mein — replicas badhao'], answer: 0, explain: 'ConfigError ka matlab hamesha yahi hai: pod spec kisi aisi cheez ko reference kar raha hai jo cluster mein maujood nahi. Do hi fix hain — gayab ConfigMap/Secret bana do, ya pod spec mein likha naam theek kar do. Image ya runtime ka is error se koi lena-dena nahi.' } },
            { lane: 'cri', t: 'CRI ne container object banaya (OCI spec)', detail: 'kubelet ne containerd ko poori spec di: image, env, mounts, aur chalane ke liye command. containerd ne OCI runtime spec generate ki.<br><b>Yahan fail ho to:</b> <code>CreateContainerError</code> — jaise <code>failed to generate spec: no command specified</code>.',
              ask: { q: 'Event: <code>Error: failed to generate spec: no command specified</code>. Kya toota hai?', choices: ['Image mein ENTRYPOINT/CMD nahi hai aur pod spec mein bhi command nahi diya — CRI ke paas chalane ko kuch hai hi nahi', 'Secret gayab hai', 'Node par memory khatam ho gayi', 'Image ka tag galat hai'], answer: 0, explain: 'containerd ko batana zaroori hai ki container ke andar kaunsa process chalega. Yeh jaankari do jagah se aa sakti hai: image ka ENTRYPOINT/CMD, ya pod spec ka <code>command</code>/<code>args</code>. Dono khaali hone par containerd OCI spec bana hi nahi sakta. Fix: pod spec mein <code>command: ["/app/server"]</code> daalo, ya image ko ENTRYPOINT ke saath dobara build karo.' } },
            { lane: 'proc', t: 'Process start hua — entrypoint exec', detail: 'containerd ne container ke andar entrypoint chalaya.<br><b>Yahan fail ho to:</b> <code>RunContainerError</code> / <code>StartError</code> — jaise <code>exec: "/app/server": stat /app/server: no such file or directory</code> (path galat) ya <code>permission denied</code> (execute bit nahi laga).' },
            { lane: 'proc', t: 'Container ab Running hai', detail: 'Chaaron padav paar. Ab jo bhi gadbad hogi woh <b>alag</b> bimari hogi: process khud mara to <code>CrashLoopBackOff</code>, readiness probe fail hui to <code>Running</code> par <code>0/1</code>.' },
            { lane: 'kubelet', t: 'kubelet ne probes chalu ki', detail: 'startupProbe pehle. startupProbe pass hone ke baad hi liveness aur readiness chalti hain. Readiness pass hone par pod Service ke endpoints mein add hota hai.' },
          ],
          summary: '✅ Chaar padav, chaar alag error. <b>Error ka naam hi bata deta hai ki dekhna kahan hai:</b> ImagePull = registry/tag · ConfigError = gayab ConfigMap/Secret · CreateContainerError = adhoori YAML ya CRI · RunContainerError = entrypoint ka path/permission · CrashLoopBackOff = container chala tha aur mar gaya (bilkul alag bimari).',
        },
        {
          type: 'quiz',
          title: 'Error ka naam padho, fix ki jagah batao',
          questions: [
            {
              q: 'Pod ka status <code>CreateContainerConfigError</code> hai. Event: <code>Error: secret "db-creds" not found</code>. Sabse pehla kadam?',
              context: 'NAME                      READY   STATUS                       RESTARTS   AGE\ndemo-a-75bf694876-2rxs4   0/1     CreateContainerConfigError   0          6m',
              choices: [
                'kubectl get secret db-creds -n &lt;pod ka namespace&gt; — dekho secret hai bhi ya nahi, aur usi namespace mein hai ya nahi',
                'kubectl logs demo-a-75bf694876-2rxs4 — application ka error padho',
                'Deployment restart karo',
                'Memory limit badhao',
              ],
              answer: 0,
              explain: 'Container abhi bana hi nahi hai, isliye logs khaali honge — <code>kubectl logs</code> yahan bekaar hai. Event ne naam bhi de diya hai: <code>db-creds</code>. Do cheezein check karo: <b>(1)</b> secret <code>db-creds</code> maujood hai? <b>(2)</b> secret usi namespace mein hai jisme pod hai? Secret namespace-scoped hoti hai, isliye "secret to bani hui hai" kehna kaafi nahi.',
            },
            {
              q: '<code>CreateContainerConfigError</code> aa raha hai par secret <code>db-creds</code> maujood hai aur sahi namespace mein hai. Ab kya dekhoge?',
              choices: [
                'secretKeyRef mein diya gaya KEY ka naam — secret mein woh key maujood hai ya nahi',
                'Node ka disk space',
                'Image ka tag',
                'Service ka selector',
              ],
              answer: 0,
              explain: 'Error message do tarah ka hota hai: <code>secret "x" not found</code> (secret hi nahi hai) aur <code>couldn\'t find key some_key in Secret ns/x</code> (secret hai par key nahi hai). Doosra case zyada aam hai — secret mein key <code>password</code> hai par pod spec <code>PASSWORD</code> maang raha hai. Check karo: <code>kubectl get secret db-creds -o jsonpath="{.data}"</code>.',
            },
            {
              q: 'Status <code>CreateContainerError</code> hai (bina "Config" ke). Event: <code>failed to generate spec: no command specified</code>. Kya karoge?',
              choices: [
                'Pod spec mein command/args do, ya image ko ENTRYPOINT ke saath dobara build karo',
                'Gayab ConfigMap banao',
                'imagePullSecrets jodo',
                'Liveness probe ka timeout badhao',
              ],
              answer: 0,
              explain: '"Config" shabd na hone se hi pata chal jaata hai ki masla ConfigMap/Secret ka nahi hai. Yahan CRI ko batana hi nahi gaya ki container ke andar kaunsa process chalega. Jaankari sirf do jagah se aa sakti hai: image ka ENTRYPOINT/CMD, ya pod spec ka <code>command</code>. Dono khaali hain.',
            },
            {
              q: 'Ek scratch image chalu karte hi status <code>RunContainerError</code> deta hai: <code>exec: "/app/server": permission denied</code>. Root cause?',
              choices: [
                'Binary par execute bit nahi laga (Dockerfile mein chmod +x chhoot gaya), ya securityContext ne read-only/nosuid laga rakha hai',
                'Image registry se nahi utri',
                'Secret gayab hai',
                'Pod ko node nahi mila',
              ],
              answer: 0,
              explain: '<code>permission denied</code> exec ke waqt aata hai — matlab file <b>maujood hai</b> (warna "no such file or directory" aata) par chalayi nahi ja sakti. Do aam wajah: Dockerfile mein <code>COPY</code> ke baad <code>chmod +x</code> chhoot gaya, ya <code>securityContext.runAsUser</code> ne aisa user diya jise us file par execute permission nahi hai.',
            },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: do pods, do alag lifecycle error',
          instructions: 'demo-a aur demo-b dono 0/1 hain par dono ki error alag padav ki hai. Describe se error ka poora naam padho, phir sahi fix chuno.',
          goal: 'Dono pods ko Running karo. Pehle <code>kubectl get pods</code>, phir dono ko <code>describe</code> karo aur Events padho, phir <code>ls</code> se sahi fix files lagao.',
          tasks: T_LIFECYCLE,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '30d', version: 'v1.30.2' }],
            pods: [
              { name: 'demo-a-75bf694876-2rxs4', ready: '0/1', status: 'CreateContainerConfigError', restarts: 0, age: '10m', node: 'node-1', ip: '10.244.1.23',
                logs: 'Error from server (BadRequest): container "demo-a" in pod "demo-a-75bf694876-2rxs4" is waiting to start: CreateContainerConfigError',
                describe: 'Name:         demo-a-75bf694876-2rxs4\nNamespace:    default\nContainers:\n  demo-a:\n    State:          Waiting\n      Reason:       CreateContainerConfigError\n    Ready:          False\n    Environment:\n      KEY_A:  <set to the key \'some_key\' in secret \'demo-a-secret\'>  Optional: false\nEvents:\n  Normal   Pulled  10m (x9 over 10m)  kubelet  Container image "nginx:1.25" already present on machine\n  Warning  Failed  10m (x9 over 10m)  kubelet  Error: secret "demo-a-secret" not found',
                events: ['Warning  Failed  10m (x9 over 10m)  kubelet  Error: secret "demo-a-secret" not found'] },
              { name: 'demo-b-f959d8b884-kvvpc', ready: '0/1', status: 'CreateContainerError', restarts: 0, age: '10m', node: 'node-1', ip: '10.244.1.20',
                logs: 'Error from server (BadRequest): container "demo-b" in pod "demo-b-f959d8b884-kvvpc" is waiting to start: CreateContainerError',
                describe: 'Name:         demo-b-f959d8b884-kvvpc\nNamespace:    default\nContainers:\n  demo-b:\n    State:          Waiting\n      Reason:       CreateContainerError\n    Ready:          False\n    Image:          gcr.io/distroless/static-debian12\n    Command:        <none>\nEvents:\n  Normal   Pulled  10m (x7 over 10m)  kubelet  Container image already present on machine\n  Warning  Failed  10m (x7 over 10m)  kubelet  Error: failed to generate spec: no command specified',
                events: ['Warning  Failed  10m (x7 over 10m)  kubelet  Error: failed to generate spec: no command specified'] },
            ],
            deployments: [
              { name: 'demo-a', ready: '0/1', upToDate: 1, available: 0, age: '10m' },
              { name: 'demo-b', ready: '0/1', upToDate: 1, available: 0, age: '10m' },
            ],
            services: [],
            configmaps: [{ name: 'kube-root-ca.crt', data: 1, age: '30d' }],
          },
          files: {
            'create-secret.yaml': {
              desc: 'demo-a-secret banata hai jisme key some_key hai',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('demo-a'));
                if (!p) return 'demo-a pod nahi mila';
                p.status = 'Running'; p.ready = '1/1';
                p.logs = 'nginx started, KEY_A injected from secret';
                p.describe = 'Name: demo-a-75bf694876-2rxs4\nContainers:\n  demo-a:\n    State:  Running\n    Environment:\n      KEY_A:  <set to the key \'some_key\' in secret \'demo-a-secret\'>';
                s.cluster.deployments[0].ready = '1/1'; s.cluster.deployments[0].available = 1;
                return 'secret/demo-a-secret created\n✅ kubelet ne secret padh li aur KEY_A inject ho gaya — demo-a ab Running hai.';
              },
            },
            'add-command.yaml': {
              desc: 'demo-b deployment mein command: ["/app/server"] jodta hai',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('demo-b'));
                if (!p) return 'demo-b pod nahi mila';
                p.status = 'Running'; p.ready = '1/1';
                p.logs = 'server listening on :8080';
                p.describe = 'Name: demo-b-f959d8b884-kvvpc\nContainers:\n  demo-b:\n    State:    Running\n    Command:  /app/server';
                s.cluster.deployments[1].ready = '1/1'; s.cluster.deployments[1].available = 1;
                return 'deployment.apps/demo-b configured\n✅ CRI ko ab pata hai ki container ke andar kya chalana hai — demo-b Running hai.';
              },
            },
            'bump-image.yaml': {
              desc: 'dono deployments ki image ka tag badalta hai',
              apply: () => 'deployment.apps/demo-a configured\ndeployment.apps/demo-b configured\n\n⚠️ Dono naye pods bhi wahi purani error de rahe hain. Dono errors image pull ke BAAD wale padav ki hain — Events mein "Container image already present" likha tha, yaani image to pehle hi aa chuki thi.',
            },
          },
          success: allOf(T_LIFECYCLE),
          successText: 'Do pods, do alag padav. <b>demo-a</b> padav 2 par atka tha (config assemble — cluster mein secret gayab thi), <b>demo-b</b> padav 3 par (CRI ko command hi nahi mili). Dono ke Events mein "Container image already present" likha tha, jisse pehle hi saaf ho gaya tha ki image pull wala padav paar ho chuka hai. <b>Error ka naam hi map hai</b>: "Config" shabd = cluster mein kuch gayab, bina "Config" ke = YAML adhoori ya runtime ka masla.',
          hints: [
            'kubectl get pods — dono ke status ke naam dhyaan se padho, dono alag hain',
            'kubectl describe pod demo-a-75bf694876-2rxs4 — Events ki aakhri line',
            'kubectl describe pod demo-b-f959d8b884-kvvpc — Events ki aakhri line',
            'ls chalao — create-secret.yaml demo-a ke liye, add-command.yaml demo-b ke liye',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Ek pod <code>CreateContainerConfigError</code> de raha hai. Kya main <code>kubectl logs</code> se error dekh sakta hoon?"',
            choices: [
              'Nahi — container abhi bana hi nahi, isliye koi log stream maujood nahi. Error sirf describe ke Events mein hai',
              'Haan — logs mein poora config error aata hai',
              'Haan, par --previous flag ke saath',
              'Nahi — par kubectl logs -c init se mil jayega',
            ],
            answer: 0,
            explain: 'Log stream tabhi banta hai jab container process shuru ho. <code>CreateContainerConfigError</code> padav 2 par hai — container object abhi bana hi nahi, process ka to sawal hi nahi. <code>--previous</code> bhi bekaar hai kyunki koi pichhla container bhi nahi tha. <b>Niyam:</b> "Waiting" state wali har error (ImagePullBackOff, CreateContainerConfigError, CreateContainerError) ka jawab <code>describe</code> ke Events mein hota hai, logs mein kabhi nahi.',
          },
          {
            q: 'Interviewer: "Sirf error ka naam sunke batao ki fix kahan lagega — <code>CreateContainerConfigError</code>, aur <code>CreateContainerError</code>."',
            choices: [
              'ConfigError → cluster mein gayab ConfigMap/Secret. CreateContainerError → pod spec adhoori (command nahi) ya CRI/runtime ka masla',
              'Dono → image dobara build karo',
              'ConfigError → node ka containerd restart. CreateContainerError → secret banao',
              'Dono → imagePullSecrets jodo',
            ],
            answer: 0,
            explain: 'Shabd "Config" hi batata hai ki kubelet <b>configuration jama karne</b> ke padav par atka — yaani API server se ConfigMap/Secret maangi aur cheez mili nahi. Bina "Config" wala <code>CreateContainerError</code> agla padav hai: config to jama ho gayi, par CRI ne container object banane se mana kar diya (aam wajah: <code>no command specified</code>).',
          },
        ],
      },
      success: [
        'Main container ke chaar padav aur unki chaar errors alag-alag bata sakta hoon',
        'Main jaanta hoon ki "Waiting" state ki errors logs mein nahi, describe ke Events mein milti hain',
        'Main CreateContainerConfigError aur CreateContainerError ka fix alag jagah dhoondhta hoon',
      ],
      homework: `<p>Teeno lifecycle errors khud paida karo:</p>
        <pre># CreateContainerConfigError — gayab secret
kubectl run cfg --image=nginx --restart=Never \\
  --overrides='{"spec":{"containers":[{"name":"cfg","image":"nginx","env":[{"name":"K","valueFrom":{"secretKeyRef":{"name":"nahi-hai","key":"k"}}}]}]}}'
kubectl describe pod cfg | tail -4

# RunContainerError — entrypoint ka path galat
kubectl run bad --image=busybox --restart=Never --command -- /nahi/hai
kubectl describe pod bad | tail -4</pre>
        <p>Dono ke Events padho — dono ka message alag hai, aur wahi message fix chunta hai.</p>`,
      cards: [
        { front: 'Container banne ke chaar padav kaunse hain?', back: '1. Image pull · 2. Config assemble (ConfigMap/Secret padhna) · 3. CRI se container create · 4. Entrypoint process start. Har padav ki apni error hai.' },
        { front: 'CreateContainerConfigError — fix kahan?', back: '<b>Cluster mein.</b> Koi ConfigMap ya Secret gayab hai, ya secretKeyRef ka key naam galat hai, ya secret doosre namespace mein hai. Event mein exact naam likha hota hai.' },
        { front: 'CreateContainerError (bina "Config" ke) — fix kahan?', back: '<b>Pod spec ya runtime mein.</b> Sabse aam: <code>failed to generate spec: no command specified</code> — image mein ENTRYPOINT nahi aur pod spec mein command bhi nahi.' },
        { front: 'RunContainerError ke do aam message?', back: '<code>no such file or directory</code> = entrypoint ka path galat. <code>permission denied</code> = file maujood hai par execute bit nahi laga (ya securityContext rok raha hai).' },
        { front: '"Waiting" state ki errors kahan padhein — logs ya describe?', back: 'Hamesha <b>describe ke Events</b> mein. Waiting ka matlab container process shuru hi nahi hua, isliye log stream maujood hi nahi hota.' },
      ],
    },

    /* ============================================================
       5. Pending pods — scheduler board lab
       ============================================================ */
    {
      id: 'kk-pending',
      icon: '⏳',
      title: 'Pending Pod — scheduler ne mana kyun kiya',
      badge: 'Placement Pandit',
      objectives: [
        'FailedScheduling message ko tod ke padhna: "0/4 nodes are available: …"',
        'Paanch aam wajah alag karna: capacity, nodeSelector, taint, podAntiAffinity, PVC',
        'Scheduler ke predicates ka kram samajhna aur khud ek board par pods place karna',
        'Preemption kab madad karta hai aur kab "Preemption is not helpful" aata hai',
      ],
      lesson: [
        `<h3>⏳ Pending ka matlab: scheduler ne abhi node chuna hi nahi</h3>
         <p>Pending pod ke paas container hai hi nahi, isliye <code>kubectl logs</code> par waqt mat gawao.
         Scheduler ka poora jawab <code>kubectl describe pod</code> ke Events mein ek line mein hota hai:</p>
         <pre>Warning  FailedScheduling  27s (x2 over 5m49s)  default-scheduler
  0/4 nodes are available: 1 Insufficient cpu,
  1 node(s) didn't match Pod's node affinity/selector,
  2 node(s) had untolerated taint {workload: machine-learning}.
  preemption: 0/4 nodes are available: 4 Preemption is not helpful for scheduling.</pre>
         <p>Line ko aise padho: har tukda batata hai ki <b>kitne nodes</b> <b>kis wajah</b> se hat gaye.
         Upar wale example mein 4 nodes the — 1 CPU ki kami se hata, 1 label match na hone se hata,
         2 taint se hate. Jab tak nodes ki ginti pooch nahi jaati, matlab saaf nahi hota.</p>
         <table class="kk-tbl">
           <tr><th>Message</th><th>Wajah</th><th>Fix</th></tr>
           <tr><td><code>Insufficient cpu</code> / <code>memory</code></td><td>Node par <b>requests</b> ke hisaab se jagah nahi (asli usage ki baat nahi ho rahi)</td><td>Request ghatao, ya node jodo</td></tr>
           <tr><td><code>didn't match Pod's node affinity/selector</code></td><td>Kisi node par woh label hai hi nahi</td><td>Node par label lagao, ya selector theek karo</td></tr>
           <tr><td><code>had untolerated taint {k: v}</code></td><td>Node par taint hai, pod ke paas toleration nahi</td><td>Toleration jodo, ya taint hatao</td></tr>
           <tr><td><code>didn't match pod anti-affinity rules</code></td><td>Same group ka pod pehle se us node par hai</td><td>Aur nodes do, ya rule ko preferred karo</td></tr>
           <tr><td><code>pod has unbound immediate PersistentVolumeClaims</code></td><td>PVC abhi bound nahi hui</td><td>StorageClass / PV / CSI driver dekho</td></tr>
         </table>`,

        `<h3>⚖️ Scheduler ke do charan, aur "Preemption is not helpful"</h3>
         <p>Scheduler do charan mein kaam karta hai:</p>
         <ol>
           <li><b>Filtering (predicates)</b> — har node par sawal: "kya pod yahan <i>ja sakta</i> hai?"
           Taint, nodeSelector, capacity, anti-affinity — sab yahan check hote hain. Bache hue nodes "feasible" kehlate hain.</li>
           <li><b>Scoring</b> — feasible nodes mein se sabse achha node chuna jaata hai (jahan zyada jagah bache, jahan image pehle se ho, waghera).</li>
         </ol>
         <p>Agar filtering ke baad ek bhi node nahi bacha, tab scheduler <b>preemption</b> sochta hai:
         kya kisi kam-priority pod ko hata dene se jagah ban jayegi? Do jawab aate hain:</p>
         <ul>
           <li><code>No preemption victims found</code> — jagah to CPU/memory ki kami se ruki hai, par jitne pods hatane padenge unki priority pending pod se kam nahi hai.</li>
           <li><code>Preemption is not helpful for scheduling</code> — <b>pods hatane se koi fayda hi nahi hoga</b>.
           Yeh message tab aata hai jab wajah capacity hai hi nahi — jaise taint ya nodeSelector. Node par
           chahe saare pods hata do, taint phir bhi wahin rahega.</li>
         </ul>
         <div class="war-story"><b>⚡ Sabse aam galti:</b> team ne <code>kubectl top nodes</code> dekha,
         CPU 30% par tha, aur bola "node khaali hai, pod Pending kyun hai?". Scheduler
         <b>asli usage</b> dekhta hi nahi — scheduler sirf <b>requests</b> ka jod dekhta hai.
         Node par 40 pods the jinme se har ek ne 200m CPU <i>request</i> ki thi par sirf 20m
         <i>use</i> kar rahe the. Requests ke hisaab se node bhara hua tha, usage ke hisaab se khaali.
         Scheduler ke liye node bhara hua tha.</div>`,
      ],
      stages: [
        {
          type: 'board',
          title: '🧲 Scheduler Board — paanch pods, chaar nodes, khud place karo',
          instructions: 'Pod chuno — har node turant ✅ ya ❌ aur uski wajah dikha dega. ❌ node par click karoge to asli FailedScheduling message milega.',
          goal: 'Paanchon pods ko sahi node par rakho. Node ke labels aur taints dhyaan se padho, aur CPU/MEM ka baccha hua hissa bhi dekho.',
          nodes: [
            { id: 'n1', name: 'node-1 (small)', labels: { type: 'general' }, taints: [], cpu: 2, mem: 4, usedCpu: 1.5, usedMem: 3 },
            { id: 'n2', name: 'node-2 (general)', labels: { type: 'general' }, taints: [], cpu: 4, mem: 8, usedCpu: 2, usedMem: 3 },
            { id: 'n3', name: 'node-3 (gpu)', labels: { type: 'gpu' }, taints: [{ key: 'workload', value: 'machine-learning', effect: 'NoSchedule' }], cpu: 8, mem: 16, usedCpu: 0, usedMem: 0 },
            { id: 'n4', name: 'node-4 (control-plane)', labels: { 'node-role.kubernetes.io/control-plane': 'true' }, taints: [{ key: 'node-role.kubernetes.io/control-plane', value: '', effect: 'NoSchedule' }], cpu: 4, mem: 8, usedCpu: 1, usedMem: 2 },
          ],
          pods: [
            { id: 'p1', name: 'ml-api', cpu: 2, mem: 4, nodeSelector: { type: 'gpu' }, tolerations: [{ key: 'workload', value: 'machine-learning' }] },
            { id: 'p2', name: 'gpu-trainer', cpu: 4, mem: 8, nodeSelector: { type: 'gpu' }, tolerations: [{ key: 'workload', operator: 'Exists' }] },
            { id: 'p3', name: 'data-processor', cpu: 1.5, mem: 2 },
            { id: 'p4', name: 'web-a', cpu: 0.4, mem: 0.5, spread: 'web' },
            { id: 'p5', name: 'web-b', cpu: 0.4, mem: 0.5, spread: 'web' },
          ],
          lesson: 'Gaur karo: <b>node-4</b> par 3 CPU khaali the phir bhi ek bhi pod wahan nahi gaya — control-plane ka taint har us pod ko rokta hai jiske paas uski toleration nahi. Aur <b>node-1</b> par <code>data-processor</code> nahi gaya kyunki node-1 par sirf 0.5 CPU bachi thi (asli usage nahi — <b>requests</b> ka jod). <code>web-a</code> aur <code>web-b</code> ko podAntiAffinity ne alag-alag node par bheja, taaki ek node girne par dono ek saath na girein.',
        },
        {
          type: 'triage',
          title: '🩺 Triage: "checkout-worker 40 minute se Pending hai"',
          instructions: 'FailedScheduling ki line ko tod ke padho — har tukda alag nodes ki ginti deta hai.',
          symptom: `<b>Deploy ke 40 minute baad:</b> <code>checkout-worker</code> ka ek bhi pod
            schedule nahi hua. Poora deployment <code>0/3</code> par atka hai.<br>
            Platform team kehti hai: "cluster khaali hai, dashboard par CPU 28% dikha raha hai".`,
          commands: [
            {
              cmd: 'kubectl get pods -n checkout',
              clue: true,
              out: `NAME                                READY   STATUS    RESTARTS   AGE
checkout-worker-6b8d9f7c5-aa1bb     0/1     Pending   0          40m
checkout-worker-6b8d9f7c5-cc2dd     0/1     Pending   0          40m
checkout-worker-6b8d9f7c5-ee3ff     0/1     Pending   0          40m`,
              note: 'Teeno replicas Pending hain. Ek bhi node nahi mila. Pending pod ke paas container nahi hota, isliye <code>kubectl logs</code> chalane ka koi fayda nahi — seedha describe par jao.',
            },
            {
              cmd: 'kubectl describe pod checkout-worker-6b8d9f7c5-aa1bb -n checkout | tail -6',
              clue: true,
              out: `Events:
  Type     Reason            Age                   From               Message
  ----     ------            ----                  ----               -------
  Warning  FailedScheduling  3m (x9 over 40m)      default-scheduler
    0/5 nodes are available: 2 Insufficient cpu,
    2 node(s) had untolerated taint {workload: batch},
    1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }.
    preemption: 0/5 nodes are available:
    2 No preemption victims found for incoming pod,
    3 Preemption is not helpful for scheduling.`,
              note: 'Line ko tod ke padho: <b>5 nodes the</b> — 2 CPU ki kami se hate, 2 batch taint se hate, 1 control-plane taint se hata. Yaani sirf 2 nodes hi asli candidate the aur dono par requests ke hisaab se jagah nahi thi. Baaki 3 nodes ke liye "Preemption is not helpful" likha hai, kyunki taint hatane ke liye pods hataane ka koi matlab nahi.',
            },
            {
              cmd: 'kubectl get nodes -L workload',
              clue: true,
              out: `NAME     STATUS   ROLES           AGE   VERSION   WORKLOAD
node-1   Ready    <none>          60d   v1.30.2   
node-2   Ready    <none>          60d   v1.30.2   
node-3   Ready    <none>          20d   v1.30.2   batch
node-4   Ready    <none>          20d   v1.30.2   batch
node-5   Ready    control-plane   60d   v1.30.2   `,
              note: 'Paanch nodes. node-3 aur node-4 batch ke liye reserve hain (unpar taint laga hai). node-5 control-plane hai. Toh checkout-worker ke liye asli mein sirf <b>node-1 aur node-2</b> bache — aur wahi do "Insufficient cpu" wale hain.',
            },
            {
              cmd: 'kubectl describe node node-1 | grep -A6 "Allocated resources"',
              clue: true,
              out: `Allocated resources:
  (Total limits may be over 100 percent, i.e., overcommitted.)
  Resource           Requests      Limits
  --------           --------      ------
  cpu                3750m (93%)   6200m (155%)
  memory             6Gi (78%)     11Gi (143%)`,
              note: '<b>Yahan hai asli jawab.</b> Requests ke hisaab se node-1 par 93% CPU pehle hi book ho chuki hai. Scheduler sirf requests ka jod dekhta hai — asli usage (28%) se scheduler ka koi lena-dena nahi.',
            },
            {
              cmd: 'kubectl get deploy checkout-worker -n checkout -o jsonpath="{.spec.template.spec.containers[0].resources}"',
              clue: true,
              out: `{"limits":{"cpu":"2","memory":"2Gi"},"requests":{"cpu":"2","memory":"2Gi"}}`,
              note: 'Har replica <b>2 poori CPU</b> request kar raha hai. node-1 par sirf 250m bachi hai, node-2 par bhi kuch aisi hi haalat hai. Pod ka request node ke bache hue hisse se bahut bada hai.',
            },
            {
              cmd: 'kubectl top nodes',
              clue: false,
              out: `NAME     CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
node-1   1130m        28%    4210Mi          54%
node-2   1080m        27%    3990Mi          51%`,
              note: 'Yahi woh output hai jisne platform team ko dhoka diya. Asli CPU usage sirf 28% hai — node "khaali" lagta hai. Par <b>scheduler usage dekhta hi nahi</b>. Scheduler requests ka jod dekhta hai, aur requests ke hisaab se node 93% bhara hua hai.',
            },
            {
              cmd: 'kubectl get events -n checkout --sort-by=.lastTimestamp | tail -3',
              clue: false,
              out: `40m   Warning   FailedScheduling   pod/checkout-worker-6b8d9f7c5-aa1bb   0/5 nodes are available
40m   Warning   FailedScheduling   pod/checkout-worker-6b8d9f7c5-cc2dd   0/5 nodes are available
40m   Warning   FailedScheduling   pod/checkout-worker-6b8d9f7c5-ee3ff   0/5 nodes are available`,
              note: 'Sirf wahi teen FailedScheduling. Koi aur cheez namespace mein nahi ho rahi — dead end, par confirm ho gaya ki masla sirf scheduling ka hai.',
            },
          ],
          questions: [
            {
              q: '<code>kubectl top nodes</code> 28% CPU dikha raha hai, phir bhi scheduler "Insufficient cpu" keh raha hai. Kyun?',
              choices: [
                'Scheduler asli usage nahi dekhta — scheduler node par pehle se book ki gayi REQUESTS ka jod dekhta hai, jo 93% hai',
                'metrics-server ka data purana hai, asli usage 93% hai',
                'Scheduler ne node-1 ko unhealthy maan liya hai',
                'CPU limits 155% hain isliye scheduler mana kar raha hai',
              ],
              answer: 0,
              explain: '<b>Requests = booking, usage = asli kharch.</b> Scheduler booking dekhta hai. Node-1 par pehle se chal rahe pods ne 3750m CPU <i>request</i> ki hui hai (93%), chahe woh asli mein sirf 1130m (28%) hi use kar rahe hon. Scheduler ke liye 93% jagah ja chuki hai. <code>kubectl top</code> ka number monitoring ke liye upyogi hai, scheduling ka faisla samajhne ke liye <code>kubectl describe node</code> ka <b>Allocated resources</b> block dekho.',
            },
            {
              q: '5 nodes mein se 3 ke liye "Preemption is not helpful for scheduling" likha hai. Iska kya matlab hai?',
              choices: [
                'Un 3 nodes par wajah taint hai, capacity nahi — pods hataane se taint nahi hatega, isliye preemption ka koi fayda nahi',
                'Un 3 nodes par saare pods ki priority zyada hai',
                'Preemption cluster mein disable hai',
                'Un 3 nodes NotReady hain',
              ],
              answer: 0,
              explain: 'Do alag preemption message hote hain. <b>"No preemption victims found"</b> = wajah capacity hai, par jinhe hatana padega unki priority kam nahi hai (2 nodes par yahi likha hai). <b>"Preemption is not helpful"</b> = wajah capacity hai hi nahi. Taint aur nodeSelector aise hi karan hain — node par chahe saare pods hata do, taint wahin rahega aur label nahi aayega. Message padh ke hi pata chal jaata hai ki priority badhana kaam karega ya nahi.',
            },
            {
              q: 'Sabse tez aur sabse safe fix kya hai?',
              choices: [
                'checkout-worker ka CPU request 2 se ghata ke asli zaroorat jitna (jaise 500m) karo — aur agar 2 CPU sach mein chahiye to naya node jodo',
                'node-3 aur node-4 se batch taint hata do',
                'Pod ki priority badha do taaki preemption chal jaye',
                'Limits hata do',
              ],
              answer: 0,
              explain: 'Request 2 CPU hai par asli usage se pata chalta hai ki itni zaroorat nahi. Request ko sahi karna turant kaam karta hai aur poore cluster ki packing sudhaar deta hai. <b>batch taint hatana galat hai</b> — taint jaan-boojh ke lagaya gaya hai taaki batch nodes par sirf batch kaam chale. <b>Priority badhana bhi kaam nahi karega</b> kyunki teen nodes par "Preemption is not helpful" likha hai, aur baaki do par preemption se doosre production pods marenge. Agar application ko sach mein 2 CPU chahiye, to sahi jawab naya node jodna hai (ya Cluster Autoscaler/Karpenter ko yeh kaam dena).',
            },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: teen Pending pods, teen alag wajah',
          instructions: 'Har pod ka FailedScheduling message alag hai. Nodes ke labels aur taints bhi dekho, phir sahi fix chuno.',
          goal: 'Teeno Pending pods ko Running karo. <code>kubectl get pods</code> → <code>kubectl describe pod</code> → <code>kubectl get nodes</code> → <code>ls</code> → sahi fix apply karo.',
          tasks: T_PENDING,
          cluster: {
            nodes: [
              { name: 'node-1', status: 'Ready', roles: '<none>', age: '60d', version: 'v1.30.2', top: '28% 54%' },
              { name: 'node-2', status: 'Ready', roles: 'control-plane', age: '60d', version: 'v1.30.2', top: '18% 40%' },
            ],
            pods: [
              { name: 'data-processor-7c9d8e6f5-hh1jj', ready: '0/1', status: 'Pending', restarts: 0, age: '12m', node: '<none>', ip: '<none>',
                describe: 'Name:      data-processor-7c9d8e6f5-hh1jj\nNamespace: default\nStatus:    Pending\nContainers:\n  proc:\n    Requests:\n      cpu:  4\nEvents:\n  Warning  FailedScheduling  2m (x5 over 12m)  default-scheduler  0/2 nodes are available: 1 Insufficient cpu, 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }. preemption: 0/2 nodes are available: 1 No preemption victims found for incoming pod, 1 Preemption is not helpful for scheduling.',
                events: ['Warning  FailedScheduling  2m (x5 over 12m)  default-scheduler  0/2 nodes are available: 1 Insufficient cpu, 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }.'] },
              { name: 'ml-api-5b6c7d8e9-kk2ll', ready: '0/1', status: 'Pending', restarts: 0, age: '12m', node: '<none>', ip: '<none>',
                describe: 'Name:      ml-api-5b6c7d8e9-kk2ll\nNamespace: default\nStatus:    Pending\nNode-Selectors:  type=gpu\nEvents:\n  Warning  FailedScheduling  2m (x5 over 12m)  default-scheduler  0/2 nodes are available: 1 node(s) didn\'t match Pod\'s node affinity/selector, 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }. preemption: 0/2 nodes are available: 2 Preemption is not helpful for scheduling.',
                events: ['Warning  FailedScheduling  2m (x5 over 12m)  default-scheduler  0/2 nodes are available: 1 node(s) didn\'t match Pod\'s node affinity/selector.'] },
              { name: 'log-collector-9a8b7c6d5-mm3nn', ready: '0/1', status: 'Pending', restarts: 0, age: '12m', node: '<none>', ip: '<none>',
                describe: 'Name:      log-collector-9a8b7c6d5-mm3nn\nNamespace: default\nStatus:    Pending\nTolerations:  <none>\nEvents:\n  Warning  FailedScheduling  2m (x5 over 12m)  default-scheduler  0/2 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 1 Insufficient cpu. preemption: 0/2 nodes are available: 1 Preemption is not helpful for scheduling, 1 No preemption victims found for incoming pod.',
                events: ['Warning  FailedScheduling  2m (x5 over 12m)  default-scheduler  0/2 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }.'] },
            ],
            deployments: [
              { name: 'data-processor', ready: '0/1', upToDate: 1, available: 0, age: '12m' },
              { name: 'ml-api', ready: '0/1', upToDate: 1, available: 0, age: '12m' },
              { name: 'log-collector', ready: '0/1', upToDate: 1, available: 0, age: '12m' },
            ],
            services: [],
          },
          responses: [
            { re: /^(kubectl|k) get (nodes|no) --show-labels$/, out: 'NAME     STATUS   ROLES           AGE   VERSION   LABELS\nnode-1   Ready    <none>          60d   v1.30.2   kubernetes.io/hostname=node-1,type=general\nnode-2   Ready    control-plane   60d   v1.30.2   kubernetes.io/hostname=node-2,node-role.kubernetes.io/control-plane=' },
          ],
          files: {
            'shrink-request.yaml': {
              desc: 'data-processor ka CPU request 4 se ghata ke 500m karta hai',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('data-processor'));
                if (!p) return 'pod nahi mila';
                p.status = 'Running'; p.ready = '1/1'; p.node = 'node-1'; p.ip = '10.244.1.31';
                s.cluster.deployments[0].ready = '1/1'; s.cluster.deployments[0].available = 1;
                return 'deployment.apps/data-processor configured\n✅ 500m request node-1 par fit ho gaya — pod Running hai.';
              },
            },
            'label-node.yaml': {
              desc: 'node-1 par label type=gpu lagata hai (node par GPU sach mein laga hai)',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('ml-api'));
                if (!p) return 'pod nahi mila';
                p.status = 'Running'; p.ready = '1/1'; p.node = 'node-1'; p.ip = '10.244.1.32';
                s.cluster.deployments[1].ready = '1/1'; s.cluster.deployments[1].available = 1;
                return 'node/node-1 labeled\n✅ Ab node-1 par label type=gpu hai, isliye ml-api ka nodeSelector match ho gaya.';
              },
            },
            'add-toleration.yaml': {
              desc: 'log-collector ko control-plane taint ki toleration deta hai (DaemonSet jaisa collector har node par chahiye)',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('log-collector'));
                if (!p) return 'pod nahi mila';
                p.status = 'Running'; p.ready = '1/1'; p.node = 'node-2'; p.ip = '10.244.2.19';
                s.cluster.deployments[2].ready = '1/1'; s.cluster.deployments[2].available = 1;
                return 'deployment.apps/log-collector configured\n✅ Toleration milte hi log-collector control-plane node par schedule ho gaya.';
              },
            },
            'bump-priority.yaml': {
              desc: 'teeno deployments ki priorityClass badhata hai',
              apply: () => 'deployment.apps/data-processor configured\ndeployment.apps/ml-api configured\ndeployment.apps/log-collector configured\n\n⚠️ Teeno abhi bhi Pending hain. Events mein "Preemption is not helpful for scheduling" likha tha — jab wajah taint ya nodeSelector ho, pods hataane se kuch nahi badalta, isliye priority badhana bekaar hai.',
            },
          },
          success: allOf(T_PENDING),
          successText: 'Teen Pending pods, teen alag wajah — aur teeno ek hi <code>FailedScheduling</code> line mein likhi thi. <b>Line ko tod ke padhna seekh gaye:</b> "1 Insufficient cpu" = capacity, "1 node(s) didn\'t match Pod\'s node affinity/selector" = label, "1 node(s) had untolerated taint" = taint. Aur "Preemption is not helpful" ne pehle hi bata diya tha ki priority badhana bekaar hai.',
          hints: [
            'kubectl get pods — teeno Pending hain',
            'Har ek ko describe karo, Events ki FailedScheduling line alag-alag hai',
            'kubectl get nodes --show-labels — dekho kaunsa label kahan hai',
            'ls chalao — shrink-request.yaml, label-node.yaml aur add-toleration.yaml teeno lagao',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Node par CPU usage 20% hai par naya pod Pending hai aur Insufficient cpu keh raha hai. Kaise samjhaoge?"',
            choices: [
              'Scheduler usage nahi, REQUESTS ka jod dekhta hai. Node par pehle se chal rahe pods ne apni requests se node book kar rakhi hai — describe node ka "Allocated resources" block sach dikhata hai',
              'metrics-server ka data purana hai',
              'Node par CPU throttling laga hua hai',
              'Pod ke limits bahut zyada hain',
            ],
            answer: 0,
            explain: 'Requests ek <b>booking</b> hai, usage ek <b>kharch</b>. Scheduler booking ke hisaab se jagah deta hai taaki har pod ko uski maangi hui jagah pakki mile. Isliye over-requesting (jaise har pod ke liye 1 CPU maangna jab 100m kaafi hai) cluster ki packing barbaad karti hai — nodes khaali dikhte hain par scheduler ke liye bhare hue hote hain. Sach dekhne ka command: <code>kubectl describe node &lt;n&gt; | grep -A6 "Allocated resources"</code>.',
          },
          {
            q: 'Interviewer: "PVC use karne wala StatefulSet pod Pending hai aur Event kehta hai <code>pod has unbound immediate PersistentVolumeClaims</code>. Kahan dekhoge?"',
            choices: [
              'PVC ka status aur StorageClass — PVC Pending hai kyunki koi PV match nahi hua ya CSI provisioner volume nahi bana paa raha',
              'Node ke taints',
              'Pod ke CPU requests',
              'Deployment ka replicas count',
            ],
            answer: 0,
            explain: 'Scheduler pod ko tab tak node nahi de sakta jab tak pod ki PVC bound na ho (volume ka topology node ke chunav ko badal sakta hai). Do kadam: <b>(1)</b> <code>kubectl get pvc</code> — Pending hai? <b>(2)</b> <code>kubectl describe pvc</code> — <code>no persistent volumes available for this claim</code> (static PV chahiye) ya provisioner ki error. Agar StorageClass ka <code>volumeBindingMode: WaitForFirstConsumer</code> hai to PVC ka Pending rehna <b>normal</b> hai — PVC tab bind hoti hai jab scheduler node chun leta hai.',
          },
        ],
      },
      success: [
        'Main FailedScheduling line ko tod ke padh sakta hoon — har tukda kitne nodes hataata hai',
        'Main jaanta hoon ki scheduler requests dekhta hai, asli usage nahi',
        'Main "Preemption is not helpful" aur "No preemption victims found" mein farq kar sakta hoon',
        'Main paanchon aam Pending wajah ke alag-alag fix bata sakta hoon',
      ],
      homework: `<p>Teeno Pending wajah khud paida karo aur describe ka message padho:</p>
        <pre># 1. Insufficient cpu
kubectl run big --image=nginx --overrides='{"spec":{"containers":[{"name":"big","image":"nginx","resources":{"requests":{"cpu":"500"}}}]}}'

# 2. nodeSelector match nahi hua
kubectl run picky --image=nginx --overrides='{"spec":{"nodeSelector":{"disktype":"nvme-does-not-exist"}}}'

# 3. taint
kubectl taint nodes &lt;node&gt; demo=yes:NoSchedule
kubectl run tainted --image=nginx

kubectl describe pod big picky tainted | grep -A4 FailedScheduling
kubectl taint nodes &lt;node&gt; demo-      # taint hatao</pre>
        <p>Aur booking vs usage ka farq dekho: <code>kubectl describe node &lt;node&gt; | grep -A6 "Allocated resources"</code> ko <code>kubectl top node &lt;node&gt;</code> ke saath compare karo.</p>`,
      cards: [
        { front: 'Pending pod par kaunsa command chalayein?', back: '<code>kubectl describe pod</code>. Pending pod ke paas container hai hi nahi, isliye <code>kubectl logs</code> hamesha khaali hoga. Scheduler ka poora jawab Events ki FailedScheduling line mein hai.' },
        { front: 'Scheduler requests dekhta hai ya asli usage?', back: 'Sirf <b>requests</b>. Node 20% usage par bhi "Insufficient cpu" de sakta hai agar pehle se chal rahe pods ki requests ka jod node ki capacity bhar chuka ho. Sach: <code>describe node</code> ka "Allocated resources".' },
        { front: '"Preemption is not helpful for scheduling" ka matlab?', back: 'Wajah capacity hai hi nahi — taint ya nodeSelector hai. Pods hataane se taint nahi hatega, isliye priority badhana bekaar hai. "No preemption victims found" alag baat hai (wajah capacity hai, par victim ki priority kam nahi).' },
        { front: 'Scheduler ke do charan kaunse hain?', back: '<b>Filtering</b> (predicates — taint, selector, capacity, anti-affinity se nodes hataao) phir <b>Scoring</b> (bache hue nodes mein se best chuno). Filtering ke baad zero node bache to preemption socha jaata hai.' },
        { front: '<code>pod has unbound immediate PersistentVolumeClaims</code>?', back: 'PVC abhi bound nahi hui, isliye scheduler ruk gaya. <code>kubectl describe pvc</code> dekho. Agar StorageClass ka volumeBindingMode <b>WaitForFirstConsumer</b> hai to PVC ka Pending rehna normal hai.' },
      ],
    },

    /* ============================================================
       6. Case of the Missing Pods — quota / limitrange
       ============================================================ */
    {
      id: 'kk-missing',
      icon: '🕵️',
      title: 'Case of the Missing Pods — Deployment hai, Pod hai hi nahi',
      badge: 'Quota Qazi',
      objectives: [
        'Deployment → ReplicaSet → Pod ki zanjeer mein tootne ki jagah dhoondhna',
        'ReplicaSet ke Events padhna — jab pod BANA hi nahi to error wahan hota hai',
        'ResourceQuota aur LimitRange ke messages pehchanna',
        'Pod-count quota, resource quota aur LimitRange ke default — teeno alag samajhna',
      ],
      lesson: [
        `<h3>🕵️ Jab pod list hi khaali ho</h3>
         <p>Ek alag tarah ki bimari: <code>kubectl get pods</code> chalao aur jawab aaye
         <code>No resources found</code>, jabki Deployment maujood hai. Yahan pod ka status
         padhne ka sawal hi nahi uthta — <b>pod bana hi nahi</b>.</p>
         <p>Pod banane ki zanjeer teen kadam ki hai, aur har kadam alag controller karta hai:</p>
         <pre>Deployment  ──(Deployment controller)──▶  ReplicaSet  ──(ReplicaSet controller)──▶  Pod</pre>
         <p>Jab pod nahi banta, error <b>ReplicaSet</b> ke Events mein hota hai — Deployment ke nahi.
         Deployment sirf itna kehta hai <code>ProgressDeadlineExceeded</code> / <code>MinimumReplicasUnavailable</code>,
         jo lakshan hai, karan nahi.</p>
         <pre>kubectl get rs -n &lt;ns&gt;
kubectl describe rs &lt;replicaset-ka-naam&gt; -n &lt;ns&gt;    # ← asli error yahan</pre>
         <div class="war-story"><b>⚡ Asli incident:</b> ek team ne <code>staging</code> namespace mein
         deploy kiya aur ghante bhar Deployment ko describe karti rahi. Deployment sirf
         <code>ProgressDeadlineExceeded</code> keh raha tha. ReplicaSet ke Events mein ek line thi:
         <code>pods "web-6d5c-" is forbidden: exceeded quota: staging-quota, requested: pods=1, used: pods=10, limited: pods=10</code>.
         Ek hi command — <code>kubectl describe rs</code> — ghante bhar ki bahes bacha sakti thi.</div>`,

        `<h3>📏 ResourceQuota aur LimitRange — do alag cheezein</h3>
         <p><b>ResourceQuota</b> namespace ki <b>kul seema</b> baandhti hai — poore namespace mein
         itne se zyada pods/CPU/memory/PVC nahi ho sakte:</p>
         <pre>apiVersion: v1
kind: ResourceQuota
metadata: { name: staging-quota, namespace: staging }
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: 8Gi
    persistentvolumeclaims: "3"</pre>
         <p><b>LimitRange</b> ek pod/container ki <b>apni</b> seema baandhti hai, aur sabse zaroori:
         LimitRange <b>default</b> requests/limits bhi bhar deti hai un containers mein jinme
         requests likhi hi nahi gayi:</p>
         <pre>apiVersion: v1
kind: LimitRange
metadata: { name: defaults, namespace: staging }
spec:
  limits:
    - type: Container
      default:        { cpu: 500m, memory: 512Mi }   # limits ka default
      defaultRequest: { cpu: 100m, memory: 128Mi }   # requests ka default
      max:            { cpu: "2",  memory: 2Gi }     # isse zyada maangna mana</pre>
         <p><b>Dono ka mel — ek chhupa hua jaal:</b> agar namespace par <code>requests.cpu</code> wali
         ResourceQuota lagi hai, to har container mein CPU request <b>likhna zaroori</b> ho jaata hai.
         Bina request wala pod turant reject hota hai:</p>
         <pre>Error creating: pods "api-7d9c-" is forbidden:
  failed quota: staging-quota: must specify requests.cpu</pre>
         <p>Ilaaj: ya to har deployment mein requests likho, ya namespace mein LimitRange lagao jo
         defaults bhar de. LimitRange lagane ke baad purane pods apne aap nahi badalte — sirf
         <b>naye</b> pods ko default milta hai.</p>`,
      ],
      stages: [
        {
          type: 'triage',
          title: '🩺 Triage: "Deploy ho gaya, par ek bhi pod nahi hai"',
          instructions: 'Deployment se ReplicaSet tak zanjeer ka peecha karo. Error us kadam par milega jahan cheez rukti hai.',
          symptom: `<b>Slack, 11:40:</b> "Maine <code>staging</code> namespace mein <code>reports-api</code>
            apply kar diya. <code>kubectl get deploy</code> mein dikh raha hai, par
            <code>kubectl get pods</code> mein reports-api ka ek bhi pod nahi hai. Koi error bhi nahi aaya."`,
          commands: [
            {
              cmd: 'kubectl get deploy -n staging',
              clue: true,
              out: `NAME          READY   UP-TO-DATE   AVAILABLE   AGE
web           4/4     4            4           30d
worker        6/6     6            6           30d
reports-api   0/2     0            0           9m`,
              note: 'Deployment maujood hai par <code>UP-TO-DATE</code> bhi 0 hai — matlab ReplicaSet ne ek bhi pod nahi banaya. Zanjeer Deployment ke <b>baad</b> tooti hai.',
            },
            {
              cmd: 'kubectl describe deploy reports-api -n staging | tail -8',
              clue: false,
              out: `Conditions:
  Type             Status  Reason
  ----             ------  ------
  Available        False   MinimumReplicasUnavailable
  Progressing      False   ProgressDeadlineExceeded
OldReplicaSets:    <none>
NewReplicaSet:     reports-api-6c8d9f7b5 (0/2 replicas created)
Events:            <none>`,
              note: 'Deployment ke Events <b>khaali</b> hain. <code>MinimumReplicasUnavailable</code> aur <code>ProgressDeadlineExceeded</code> sirf lakshan hain — "pods nahi aaye" ka doosra tarika. Par ek kaam ki cheez mili: ReplicaSet ka naam <code>reports-api-6c8d9f7b5</code>.',
            },
            {
              cmd: 'kubectl describe rs reports-api-6c8d9f7b5 -n staging | tail -6',
              clue: true,
              out: `Events:
  Type     Reason        Age                   From                   Message
  ----     ------        ----                  ----                   -------
  Warning  FailedCreate  9m (x9 over 9m)       replicaset-controller
    Error creating: pods "reports-api-6c8d9f7b5-" is forbidden:
    exceeded quota: staging-quota,
    requested: pods=1, used: pods=10, limited: pods=10`,
              note: '<b>Yahan hai jawab.</b> ReplicaSet controller ne pod banane ki koshish ki aur API server ne mana kar diya. Namespace <code>staging</code> ki ResourceQuota <code>staging-quota</code> mein pods ki seema 10 hai aur 10 pods pehle se chal rahe hain.',
            },
            {
              cmd: 'kubectl describe quota staging-quota -n staging',
              clue: true,
              out: `Name:                   staging-quota
Namespace:              staging
Resource                Used    Hard
--------                ----    ----
persistentvolumeclaims  1       3
pods                    10      10
requests.cpu            2100m   4
requests.memory         3560Mi  8Gi`,
              note: 'Quota ki poori tasveer. <b>pods 10/10</b> — bilkul bhara hua. Gaur karo: CPU (2100m/4) aur memory (3560Mi/8Gi) mein bahut jagah bachi hai. Sirf <b>pod ki ginti</b> ne roka hai, resources ne nahi.',
            },
            {
              cmd: 'kubectl get pods -n staging',
              clue: false,
              out: `NAME                       READY   STATUS      RESTARTS   AGE
web-5f6c7d8e9-aa1bb        1/1     Running     0          30d
web-5f6c7d8e9-cc2dd        1/1     Running     0          30d
web-5f6c7d8e9-ee3ff        1/1     Running     0          30d
web-5f6c7d8e9-gg4hh        1/1     Running     0          30d
worker-8a9b0c1d2-ii5jj     1/1     Running     0          30d
worker-8a9b0c1d2-kk6ll     1/1     Running     0          30d
worker-8a9b0c1d2-mm7nn     1/1     Running     0          30d
worker-8a9b0c1d2-oo8pp     1/1     Running     0          30d
worker-8a9b0c1d2-qq9rr     1/1     Running     0          30d
migration-once-xx0yy       0/1     Completed   0          14d`,
              note: 'Ek chhupa hua kaanta: <code>migration-once-xx0yy</code> <b>Completed</b> hai — kaam khatam ho chuka hai par pod object abhi bhi maujood hai. ResourceQuota <code>pods</code> ki ginti mein Completed pods bhi <b>gine jaate hain</b>. Ek mara hua pod ek zinda pod ki jagah roke baitha hai.',
            },
            {
              cmd: 'kubectl get limitrange -n staging',
              clue: false,
              out: `No resources found in staging namespace.`,
              note: 'Dead end (par kaam ka). Koi LimitRange nahi hai. Achha hua ki quota mein <code>requests.cpu</code> bhi hai — agar kisi deployment mein CPU request likhna bhool jaate to alag error aata: <code>must specify requests.cpu</code>.',
            },
            {
              cmd: 'kubectl get events -n staging --sort-by=.lastTimestamp | tail -3',
              clue: false,
              out: `9m   Warning   FailedCreate   replicaset/reports-api-6c8d9f7b5   Error creating: pods "reports-api-6c8d9f7b5-" is forbidden: exceeded quota
9m   Warning   FailedCreate   replicaset/reports-api-6c8d9f7b5   Error creating: pods "reports-api-6c8d9f7b5-" is forbidden: exceeded quota
9m   Warning   FailedCreate   replicaset/reports-api-6c8d9f7b5   Error creating: pods "reports-api-6c8d9f7b5-" is forbidden: exceeded quota`,
              note: 'Wahi FailedCreate event, namespace ke level par. Namespace ke events <code>describe rs</code> ka shortcut ban sakte the — dono jagah ek hi message aata hai.',
            },
          ],
          questions: [
            {
              q: 'Deployment ke describe mein Events khaali the par ReplicaSet ke describe mein poora error tha. Aisa kyun?',
              choices: [
                'Pod banane ka kaam ReplicaSet controller karta hai, isliye pod-creation ki har error ReplicaSet ke Events par lagti hai',
                'Deployment ke events 5 minute baad delete ho jaate hain',
                'Deployment ke events dekhne ke liye -o yaml chahiye',
                'Quota errors sirf namespace level par likhi jaati hain',
              ],
              answer: 0,
              explain: 'Zanjeer hai: <b>Deployment controller</b> ReplicaSet banata hai, <b>ReplicaSet controller</b> pods banata hai. Pod banane ki koshish ReplicaSet controller karta hai, isliye API server ka "forbidden" jawab ReplicaSet ke Events par record hota hai. Deployment ke paas sirf itni khabar hoti hai ki replicas poore nahi hue — isliye Deployment sirf <code>MinimumReplicasUnavailable</code> keh paata hai. <b>Niyam:</b> pod dikh hi nahi raha? Seedha <code>kubectl describe rs</code>.',
            },
            {
              q: 'Quota mein CPU (2100m/4) aur memory (3560Mi/8Gi) dono khaali hain, phir bhi pod nahi ban raha. Kyun?',
              choices: [
                'ResourceQuota mein pods ki alag ginti (10/10) hai, jo bhari hui hai — resources bache hone se koi fark nahi padta',
                'CPU quota me 2100m ka matlab hai ki 2 hi pods aa sakte hain',
                'Memory quota reserve mode mein hai',
                'Namespace read-only ho gaya hai',
              ],
              answer: 0,
              explain: 'ResourceQuota ki har line ek <b>alag</b> seema hai, aur <b>koi bhi ek</b> line bharne par naya object banna band ho jaata hai. Yahan <code>pods: 10</code> bhari hui hai. Object count ki seemayein (<code>pods</code>, <code>services</code>, <code>persistentvolumeclaims</code>, <code>configmaps</code>) resource seemaon se bilkul alag hain — dono ek saath lagti hain.',
            },
            {
              q: 'Sabse behtar turant fix kya hai?',
              choices: [
                'Completed pod migration-once-xx0yy delete karo — mara hua pod quota ki ginti mein jagah roke baitha hai',
                'Quota delete kar do',
                'reports-api ko doosre namespace mein deploy karo',
                'web deployment ko 4 se 2 replicas par le aao',
              ],
              answer: 0,
              explain: 'ResourceQuota ki <code>pods</code> ginti mein <b>Completed aur Failed pods bhi gine jaate hain</b>, kyunki pod object abhi bhi maujood hai. <code>migration-once</code> 14 din pehle apna kaam khatam kar chuka hai aur ab bas jagah ghere baitha hai. Usse delete karte hi ek slot khaali ho jayega. Lambi durusti: Job par <code>ttlSecondsAfterFinished</code> lagao taaki khatam hone ke baad Job apne pods khud saaf kar de. Quota delete karna ya production replicas ghatana upay nahi, nuksaan hai.',
            },
          ],
        },
        {
          type: 'order',
          title: '🔢 "Pod dikh hi nahi raha" — jaanch ka sahi kram',
          instructions: 'Sabse kam mehnat wale, sabse zyada jaankari dene wale kadam ko pehle rakho.',
          steps: [
            { text: 'kubectl get deploy — Deployment maujood hai? READY aur UP-TO-DATE kya keh rahe hain?', explain: 'Pehle confirm karo ki Deployment banaa bhi tha. UP-TO-DATE 0 dikhe to ReplicaSet ne ek bhi pod nahi banaya — masla neeche ki taraf hai.' },
            { text: 'kubectl get rs — ReplicaSet bana ya nahi, aur DESIRED kitna hai?', explain: 'ReplicaSet hi nahi bana to Deployment controller ki problem hai (bahut kam hota hai). ReplicaSet bana par CURRENT 0 hai to pod banane ki koshish fail ho rahi hai.' },
            { text: 'kubectl describe rs &lt;naam&gt; — Events mein FailedCreate ka poora message padho', explain: 'Yahan asli error milta hai: exceeded quota, forbidden by PodSecurity, must specify requests.cpu, ya RBAC ka jawab. Deployment ke Events yahan khaali hote hain.' },
            { text: 'Error ke hisaab se namespace ka policy object dekho — quota, limitrange, ya PSA labels', explain: 'kubectl describe quota / get limitrange / kubectl get ns &lt;ns&gt; --show-labels. Ab pata hai ki kaunsa policy object rok raha hai.' },
            { text: 'Fix lagao aur ReplicaSet ke Events dobara padho', explain: 'ReplicaSet controller apne aap dobara koshish karta hai (exponential backoff ke saath). Naya FailedCreate na aaye aur CURRENT badhe — matlab fix chal gaya.' },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: gayab pods dhoondo',
          instructions: 'Deployment hai, pods nahi. Zanjeer ka peecha karo: deploy → rs → describe rs → quota.',
          goal: '<code>kubectl get rs</code> se ReplicaSet dhoondo, <code>kubectl describe rs</code> se asli error padho, <code>kubectl describe quota</code> se seema dekho, phir fix lagao taaki teen pods Running ho jayein.',
          tasks: T_QUOTA,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '30d', version: 'v1.30.2' }],
            pods: [],
            deployments: [{ name: 'reports-api', ready: '0/3', upToDate: 0, available: 0, age: '9m' }],
            services: [],
            replicasets: [{ name: 'reports-api-6c8d9f7b5', desired: 3, current: 0, ready: 0, age: '9m' }],
          },
          responses: [
            {
              re: /^(kubectl|k) describe (rs|replicaset) \S+/,
              out: 'Name:           reports-api-6c8d9f7b5\nNamespace:      staging\nSelector:       app=reports-api,pod-template-hash=6c8d9f7b5\nReplicas:       0 current / 3 desired\nPods Status:    0 Running / 0 Waiting / 0 Succeeded / 0 Failed\nEvents:\n  Type     Reason        Age              From                    Message\n  ----     ------        ----             ----                    -------\n  Warning  FailedCreate  9m (x9 over 9m)  replicaset-controller   Error creating: pods "reports-api-6c8d9f7b5-" is forbidden: failed quota: staging-quota: must specify requests.cpu,requests.memory',
            },
            {
              re: /^(kubectl|k) (describe|get) (quota|resourcequota|resourcequotas)/,
              out: 'Name:            staging-quota\nNamespace:       staging\nResource         Used    Hard\n--------         ----    ----\npods             0       20\nrequests.cpu     0       4\nrequests.memory  0       8Gi',
            },
            { re: /^(kubectl|k) get (limitrange|limits)/, out: 'No resources found in staging namespace.' },
          ],
          files: {
            'add-requests.yaml': {
              desc: 'reports-api ke container mein requests.cpu aur requests.memory jodta hai',
              apply: s => {
                s.cluster.pods = [
                  { name: 'reports-api-6c8d9f7b5-aa1bb', ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.61', logs: 'reports-api listening on :8080' },
                  { name: 'reports-api-6c8d9f7b5-cc2dd', ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.62', logs: 'reports-api listening on :8080' },
                  { name: 'reports-api-6c8d9f7b5-ee3ff', ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.63', logs: 'reports-api listening on :8080' },
                ];
                s.cluster.deployments[0].ready = '3/3';
                s.cluster.deployments[0].upToDate = 3;
                s.cluster.deployments[0].available = 3;
                s.cluster.replicasets[0].current = 3;
                s.cluster.replicasets[0].ready = 3;
                return 'deployment.apps/reports-api configured\n✅ Requests likhte hi API server ne pods banne diye — teeno Running hain.';
              },
            },
            'add-limitrange.yaml': {
              desc: 'namespace mein LimitRange lagata hai jo defaultRequest bhar deti hai',
              apply: s => {
                s.cluster.pods = [
                  { name: 'reports-api-6c8d9f7b5-aa1bb', ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.61', logs: 'reports-api listening on :8080' },
                  { name: 'reports-api-6c8d9f7b5-cc2dd', ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.62', logs: 'reports-api listening on :8080' },
                  { name: 'reports-api-6c8d9f7b5-ee3ff', ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.63', logs: 'reports-api listening on :8080' },
                ];
                s.cluster.deployments[0].ready = '3/3';
                s.cluster.deployments[0].upToDate = 3;
                s.cluster.deployments[0].available = 3;
                s.cluster.replicasets[0].current = 3;
                s.cluster.replicasets[0].ready = 3;
                return 'limitrange/defaults created\n✅ LimitRange ne naye pods mein defaultRequest bhar diya, isliye quota ki shart poori ho gayi. Dhyaan: LimitRange sirf NAYE pods par lagti hai — purane pods waise ke waise rehte hain.';
              },
            },
            'scale-up.yaml': {
              desc: 'reports-api ko 3 se 6 replicas karta hai',
              apply: () => 'deployment.apps/reports-api scaled\n\n⚠️ Ab bhi 0 pods hain. Error "must specify requests.cpu,requests.memory" thi — replicas badhane se har naya pod bhi wahi error dega.',
            },
          },
          success: allOf(T_QUOTA),
          successText: 'Poori kahani ek command mein thi: <code>kubectl describe rs</code>. Error <code>failed quota: staging-quota: must specify requests.cpu,requests.memory</code> ne bata diya tha ki quota ne pods ki ginti nahi roki (pods 0/20 khaali the) — quota ne <b>requests likhna zaroori</b> kar diya tha. Do sahi fix hain: har deployment mein requests likho, ya namespace mein LimitRange lagao jo defaults bhar de. <b>Yaad rakho:</b> jab namespace ki quota mein <code>requests.cpu</code> likha ho, tab har container mein request likhna majboori ban jaata hai.',
          hints: [
            'kubectl get deploy — reports-api 0/3 par hai',
            'kubectl get rs — ReplicaSet bana hai par CURRENT 0 hai',
            'kubectl describe rs reports-api-6c8d9f7b5 — FailedCreate ka poora message padho',
            'kubectl describe quota — dekho pods ki ginti bhari hai ya kuch aur shart hai',
            'ls chalao — add-requests.yaml ya add-limitrange.yaml, dono kaam karenge',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Deployment 0/3 par atki hai aur ek bhi pod nahi bana. Pehla command kaunsa chalaoge?"',
            choices: [
              'kubectl describe rs &lt;replicaset&gt; — pod banane ki har error ReplicaSet ke Events par aati hai',
              'kubectl logs deployment/&lt;naam&gt; — deployment controller ke logs',
              'kubectl describe deployment &lt;naam&gt; — Events wahan hote hain',
              'kubectl get nodes — node capacity dekho',
            ],
            answer: 0,
            explain: 'Deployment ke Events aise case mein aksar khaali hote hain, kyunki Deployment ne apna kaam (ReplicaSet banana) kar diya tha. Pod banane ki koshish ReplicaSet controller karta hai, isliye <code>exceeded quota</code>, <code>forbidden by PodSecurity</code>, <code>must specify requests.cpu</code> jaisi saari errors ReplicaSet ke Events par likhi jaati hain. <b>Pod hai hi nahi → describe rs.</b> Pod hai par toota hai → describe pod.',
          },
          {
            q: 'Interviewer: "Namespace ki pod quota 10/10 bhari hai par sirf 6 pods Running dikh rahe hain. Baaki 4 kahan hain?"',
            choices: [
              'Completed aur Failed pods bhi quota ki ginti mein aate hain — Job ke khatam ho chuke pods jagah roke baithe hain',
              'Quota ka data 5 minute purana hota hai',
              'Terminating pods do baar gine jaate hain',
              'Doosre namespace ke pods bhi gine ja rahe hain',
            ],
            answer: 0,
            explain: 'ResourceQuota <b>pod objects</b> ginti hai, sirf Running pods nahi. Khatam ho chuke Job ke pods (<code>Completed</code>) aur crash hokar chhode gaye pods (<code>Failed</code>) tab tak gine jaate hain jab tak koi unhe delete na kare. Ilaaj: Job par <code>ttlSecondsAfterFinished: 300</code> lagao, ya CronJob par <code>successfulJobsHistoryLimit</code> aur <code>failedJobsHistoryLimit</code> set karo. Turant saaf karne ka tarika: <code>kubectl delete pod --field-selector=status.phase==Succeeded -n &lt;ns&gt;</code>.',
          },
        ],
      },
      success: [
        'Main "pod hai hi nahi" aur "pod hai par toota hai" ko alag treat karta hoon',
        'Main jaanta hoon ki pod-creation ki errors ReplicaSet ke Events par milti hain',
        'Main ResourceQuota (namespace ki kul seema) aur LimitRange (per-container seema + defaults) mein farq kar sakta hoon',
        'Main jaanta hoon ki Completed pods bhi quota ki ginti mein aate hain',
      ],
      homework: `<p>Quota ka jaal khud bana ke dekho:</p>
        <pre>kubectl create ns qdemo
kubectl create quota tiny --hard=pods=2,requests.cpu=1 -n qdemo
kubectl create deployment web --image=nginx --replicas=3 -n qdemo

kubectl get pods -n qdemo          # 0 pods
kubectl get rs -n qdemo
kubectl describe rs -n qdemo | tail -5      # ← asli error yahan

# ab LimitRange se defaults bharo
kubectl create -f - <<'EOF'
apiVersion: v1
kind: LimitRange
metadata: { name: defaults, namespace: qdemo }
spec:
  limits:
    - type: Container
      defaultRequest: { cpu: 100m }
      default: { cpu: 200m }
EOF
kubectl rollout restart deploy/web -n qdemo
kubectl get pods -n qdemo          # ab 2 pods (quota pods=2)
kubectl delete ns qdemo</pre>`,
      cards: [
        { front: 'Deployment hai par ek bhi pod nahi bana — pehla command?', back: '<code>kubectl describe rs &lt;replicaset&gt;</code>. Pod banane ka kaam ReplicaSet controller karta hai, isliye FailedCreate ki error ReplicaSet ke Events par hoti hai. Deployment sirf MinimumReplicasUnavailable kehta hai.' },
        { front: 'ResourceQuota vs LimitRange?', back: '<b>ResourceQuota</b> = poore namespace ki kul seema (pods=10, requests.cpu=4). <b>LimitRange</b> = ek container ki seema, aur sabse kaam ki baat: LimitRange <b>default</b> requests/limits bhar deti hai.' },
        { front: 'Namespace quota mein requests.cpu hai par deployment mein request nahi likhi — kya hoga?', back: 'Pod banega hi nahi: <code>failed quota: … must specify requests.cpu</code>. Fix: requests likho, ya LimitRange lagao jo defaultRequest bhar de (sirf naye pods par lagta hai).' },
        { front: 'Quota ki pods ginti mein kaunse pods aate hain?', back: 'Saare pod objects — <b>Completed aur Failed bhi</b>. Khatam ho chuke Job pods jagah ghere rehte hain. Fix: Job par <code>ttlSecondsAfterFinished</code>.' },
        { front: 'Pod-banane ki zanjeer kaunsi hai?', back: 'Deployment ──▶ (Deployment controller) ──▶ ReplicaSet ──▶ (ReplicaSet controller) ──▶ Pod. Error us controller ke Events par hoti hai jiska kadam fail hua.' },
      ],
    },
  ]);
})();

/* =====================================================================
   CHUNK 3 — Service/selector, config staleness, stuck objects, network (levels 7-10)
   ===================================================================== */
(function () {
  const allOf = KG.allOf;

  const T_SELECTOR = [
    { text: 'Services aur endpoints saath mein dekho', check: s => s.history.some(h => /^(kubectl|k) get .*(endpoints|ep)\b/.test(h)) },
    { text: 'Label se pods dhoondo (-l version=v1)', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b.*-l /.test(h)) },
    { text: 'blue-service ka selector theek karo', check: s => s.cluster.endpoints.find(e => e.name === 'blue-service' && !/,/.test(e.endpoints)) },
  ];

  const T_CONFIG = [
    { text: 'ConfigMap ki asli value dekho', check: s => s.history.some(h => /^(kubectl|k) (get|describe) (cm|configmap|configmaps)\b/.test(h)) },
    { text: 'Pod ke andar se environment variable check karo', check: s => s.history.some(h => /^(kubectl|k) exec \S+.*(printenv|env)\b/.test(h)) },
    { text: 'Naye config ke saath pods chalao', check: s => s.cluster.pods.every(p => p.env === 'v2') },
  ];

  const T_STUCK = [
    { text: 'Atke hue namespace ka status dekho', check: s => s.history.some(h => /^(kubectl|k) get (ns|namespaces?)\b/.test(h)) },
    { text: 'Namespace ke conditions padho (-o yaml ya describe)', check: s => s.history.some(h => /^(kubectl|k) (describe (ns|namespace)|get (ns|namespace) \S+ -o ?yaml)/.test(h)) },
    { text: 'Finalizer hatao', check: s => s.cluster.namespaces.every(n => n.status === 'Active' || n.gone) },
  ];

  const T_DNS = [
    { text: 'Service aur endpoints dekho', check: s => s.history.some(h => /^(kubectl|k) get .*(endpoints|ep)\b/.test(h)) },
    { text: 'Pod ke andar se DNS resolve karo (exec + nslookup)', check: s => s.history.some(h => /^(kubectl|k) exec \S+.*nslookup/.test(h)) },
    { text: 'DNS theek karo — pod app tak pahunch jaye', check: s => s.cluster.pods.every(p => p.dnsOk !== false) },
  ];

  KG.registerLevels('kodekloud', [

    /* ============================================================
       7. Schrödinger's Deployment — selectors, endpoints, ports
       ============================================================ */
    {
      id: 'kk-schrodinger',
      icon: '🎭',
      title: "Schrodinger's Deployment — kabhi blue, kabhi green",
      badge: 'Selector Surakshak',
      objectives: [
        'Service ke selector aur pod ke labels ka rishta samajhna',
        'Endpoints object ko sach ka source maanna — Service ki YAML ko nahi',
        'Overlapping selectors se hone wale rukh-rukh ke bugs pehchanna',
        'port / targetPort / containerPort ka teen-tarfa mel theek karna',
      ],
      lesson: [
        `<h3>🎭 Service pods ko naam se nahi, label se dhoondhti hai</h3>
         <p>Service ka koi seedha rishta Deployment se hota hi nahi. Service sirf ek
         <b>label selector</b> chalati hai aur jo bhi pod match ho jaye, uska IP endpoints mein daal
         deti hai. Isliye Service galat pods bhi utha sakti hai — aur galti chup-chaap hoti hai.</p>
         <pre># blue-service ka selector
selector:
  version: v1              # ← sirf ek label

# green ke pods ke labels
labels:
  app: green
  version: v1              # ← green pods par bhi version: v1 laga hai!</pre>
         <p><code>blue-service</code> ka selector sirf <code>version: v1</code> maangta hai, aur green pods
         par bhi <code>version: v1</code> laga hai. Natija: <code>blue-service</code> blue aur green
         <b>dono</b> ke pods ko utha leti hai. User ko har refresh par kabhi blue page milta hai,
         kabhi green — 50% baar sahi, 50% baar galat.</p>
         <p><b>Sach ka source Endpoints object hai:</b></p>
         <pre>kubectl get endpoints
NAME            ENDPOINTS                                          AGE
blue-service    10.244.1.2:8080,10.244.1.3:8080,10.244.1.4:8080    34m   ← 4 IPs! (blue ke 2 hone chahiye the)
green-service   10.244.1.3:8080,10.244.1.5:8080                    34m</pre>
         <div class="war-story"><b>⚡ Kyun pakadna mushkil hota hai:</b> aisi galti par error kabhi
         nahi aata. Har request 200 OK deti hai — bas kabhi-kabhi <b>galat application</b> se aati hai.
         Monitoring "0% error rate" dikhata rehta hai. Pakadne ka ek hi pakka tarika hai:
         <code>kubectl get endpoints</code> mein IP <b>gino</b> aur replica count se milao.</div>`,

        `<h3>🔌 Port ka teen-tarfa mel (Port Mania)</h3>
         <p>Teen alag jagah teen alag port likhe jaate hain, aur teeno ka mel hona zaroori hai:</p>
         <pre>Service:
  ports:
    - port: 80             # (1) Service ka apna port — client yahan aata hai
      targetPort: 8080     # (2) Pod ke andar ka port — traffic yahan bheja jayega
      nodePort: 30102      # (only NodePort) node ka bahari port

Pod/Deployment:
  containers:
    - ports:
        - containerPort: 8080   # (3) sirf dastavez hai — application asli mein
                                #     kis port par sun rahi hai, wahi maayne rakhta hai</pre>
         <table class="kk-tbl">
           <tr><th>Galti</th><th>Lakshan</th><th>Kaise pakden</th></tr>
           <tr><td><code>targetPort</code> galat</td><td>Endpoints bhare hue hain par connection refused</td><td><code>kubectl exec &lt;pod&gt; -- curl localhost:&lt;asli-port&gt;</code></td></tr>
           <tr><td>Selector match nahi</td><td>Endpoints <code>&lt;none&gt;</code>, service 503 deti hai</td><td><code>kubectl get endpoints</code></td></tr>
           <tr><td>Selector zyada dhila</td><td>Kabhi sahi, kabhi galat jawab</td><td>Endpoints mein IP ginto</td></tr>
           <tr><td>Application galat port par sun rahi hai</td><td>containerPort 8080 likha hai par app 3000 par hai</td><td><code>kubectl exec &lt;pod&gt; -- netstat -tlnp</code></td></tr>
         </table>
         <p><b>Ek zaroori baat:</b> <code>containerPort</code> sirf dastavez hai. <code>containerPort</code>
         likhne se application us port par sunna shuru nahi kar deti, aur na likhne se traffic rukta hai.
         Asli baat sirf yeh hai ki application container ke andar kis port par sun rahi hai, aur
         Service ka <code>targetPort</code> usi port par ishara kare.</p>`,
      ],
      stages: [
        {
          type: 'triage',
          title: '🩺 Triage: "blue page kabhi-kabhi green dikhata hai"',
          instructions: 'Koi error nahi aa raha. Har request 200 deti hai. Endpoints ginne padenge.',
          symptom: `<b>QA ticket:</b> "<code>blue-service</code> ka page kabhi blue dikhata hai aur kabhi
            green. Refresh karte raho to kareeb aadhi baar green aata hai. Koi error nahi,
            hamesha HTTP 200."<br>
            Dono deployments — <code>blue</code> aur <code>green</code> — 2/2 Running hain.`,
          commands: [
            {
              cmd: 'kubectl get deploy,pods',
              clue: false,
              out: `NAME                    READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/blue    2/2     2            2           24m
deployment.apps/green   2/2     2            2           24m

NAME                         READY   STATUS    RESTARTS   AGE
pod/blue-6c7b7b965f-8vxwp    1/1     Running   0          21m
pod/blue-6c7b7b965f-zddzq    1/1     Running   0          24m
pod/green-864c4d957c-tnq9r   1/1     Running   0          24m
pod/green-864c4d957c-w7ktb   1/1     Running   0          93s`,
              note: 'Sab kuch bilkul theek dikh raha hai. Dono deployments 2/2, chaaron pods Running. Yahi "Schrodinger" wali baat hai — bimari status mein kahin dikhti hi nahi.',
            },
            {
              cmd: 'kubectl get endpoints',
              clue: true,
              out: `NAME            ENDPOINTS                                                       AGE
blue-service    10.244.1.2:8080,10.244.1.3:8080,10.244.1.4:8080 + 1 more...     24m
green-service   10.244.1.4:8080,10.244.1.5:8080                                 24m
kubernetes      192.147.9.6:6443                                                46m`,
              note: '<b>Yahan hai jawab.</b> <code>blue-service</code> ke paas <b>4 endpoints</b> hain jabki blue deployment ke sirf 2 pods hain. Aur gaur karo: IP <code>10.244.1.4</code> dono services ke endpoints mein hai. blue-service green ke pods bhi utha rahi hai.',
            },
            {
              cmd: 'kubectl get svc blue-service -o jsonpath="{.spec.selector}"',
              clue: true,
              out: `{"version":"v1"}`,
              note: '<code>blue-service</code> ka selector sirf ek label maangta hai: <code>version: v1</code>. Selector bahut dheela hai — koi bhi pod jispe <code>version: v1</code> laga ho, blue-service utha legi.',
            },
            {
              cmd: 'kubectl get pods -l version=v1 --show-labels',
              clue: true,
              out: `NAME                     READY   STATUS    AGE   LABELS
blue-6c7b7b965f-8vxwp    1/1     Running   21m   app=blue,version=v1,pod-template-hash=6c7b7b965f
blue-6c7b7b965f-zddzq    1/1     Running   24m   app=blue,version=v1,pod-template-hash=6c7b7b965f
green-864c4d957c-tnq9r   1/1     Running   24m   app=green,version=v1,pod-template-hash=864c4d957c
green-864c4d957c-w7ktb   1/1     Running   93s   app=green,version=v1,pod-template-hash=864c4d957c`,
              note: 'Chaaron pods par <code>version: v1</code> laga hai — blue par bhi, green par bhi. Green ke pods par ek extra label <code>app=green</code> bhi hai, jo unhe alag kar sakta tha, par blue-service us label ko maang hi nahi rahi.',
            },
            {
              cmd: 'kubectl get svc green-service -o jsonpath="{.spec.selector}"',
              clue: true,
              out: `{"app":"green","version":"v1"}`,
              note: '<code>green-service</code> ka selector <b>do</b> label maangta hai: <code>app=green</code> AUR <code>version=v1</code>. Isliye green-service sirf green ke pods uthati hai — green-service bilkul theek likhi hui hai. Sirf blue-service ka selector adhoora hai.',
            },
            {
              cmd: 'kubectl logs blue-6c7b7b965f-8vxwp --tail=3',
              clue: false,
              out: `10.244.0.1 - - [04/Sep/2026:14:22:01] "GET / HTTP/1.1" 200 512
10.244.0.1 - - [04/Sep/2026:14:22:04] "GET / HTTP/1.1" 200 512
10.244.0.1 - - [04/Sep/2026:14:22:09] "GET / HTTP/1.1" 200 512`,
              note: 'Dead end — aur yahi bimari ki sabse khatarnaak baat hai. blue pod ke logs mein sirf 200 hai. Green pod ke logs mein bhi sirf 200 hoga. Koi bhi log ya metric ismein kuch galat nahi dikhayega.',
            },
          ],
          questions: [
            {
              q: 'blue-service kabhi green ka page kyun deti hai?',
              choices: [
                'blue-service ka selector sirf version=v1 maangta hai, aur green pods par bhi version=v1 laga hai — isliye blue-service green ke pods bhi utha leti hai',
                'green-service ka nodePort blue-service se takra raha hai',
                'Ingress controller ne backends ki caching kar li hai',
                'Dono deployments ek hi ReplicaSet share kar rahe hain',
              ],
              answer: 0,
              explain: 'Service ka Deployment se koi seedha rishta hai hi nahi. Service sirf apna label selector chalati hai. <code>blue-service</code> ka selector <code>{version: v1}</code> chaaron pods se match hota hai, isliye endpoints mein 4 IP aa gaye aur kube-proxy unme se kisi bhi ek par traffic bhej deta hai — kareeb aadhi baar green par.',
            },
            {
              q: 'Aise bug ko pakadne ka sabse pakka tarika kya hai?',
              choices: [
                'kubectl get endpoints — endpoints mein IP gino aur us Deployment ke replica count se milao',
                'Application ke logs mein 5xx dhoondo',
                'Service ki YAML padho aur maan lo ki selector sahi hai',
                'kubectl top pods se load ka bantwara dekho',
              ],
              answer: 0,
              explain: 'Endpoints object <b>sach ka source</b> hai — endpoints mein wahi IP hote hain jinpar kube-proxy asli mein traffic bhejta hai. Service ki YAML padhna kaafi nahi, kyunki YAML sahi dikhne par bhi selector kisi aur pod se match kar sakta hai. Logs bhi bekaar hain kyunki dono applications 200 hi deti hain. <b>Ginti karo:</b> blue deployment 2 replicas ka hai par endpoints 4 hain — bug pakda gaya.',
            },
            {
              q: 'Sahi fix kya hai?',
              choices: [
                'blue-service ka selector {app: blue, version: v1} karo — har Service ka selector ek unique label par bhi tika hona chahiye',
                'green pods se version=v1 label hata do',
                'blue aur green ko alag namespaces mein daal do',
                'blue-service ko headless (clusterIP: None) bana do',
              ],
              answer: 0,
              explain: 'Sabse chhota aur sabse surakshit fix: <code>blue-service</code> ke selector mein <code>app: blue</code> jodo, taaki selector ek unique pehchaan par tike. green ke pods se <code>version=v1</code> hataana kaam to karega par galat hai — green ki apni versioning tootegi, aur green-service ka selector bhi <code>version=v1</code> maangta hai, isliye green-service ke endpoints khaali ho jayenge. <b>Niyam:</b> har Service ka selector kam se kam ek aisa label maange jo sirf usi workload par ho.',
            },
          ],
        },
        {
          type: 'fill',
          title: '📄 Service ka selector aur port ka mel',
          instructions: 'blue-service ko theek karo — selector unique bhi ho aur port ka mel bhi sahi ho. Application container ke andar port <b>8080</b> par sun rahi hai.',
          template: `apiVersion: v1
kind: Service
metadata:
  name: blue-service
spec:
  type: NodePort
  selector:
    version: v1
    {0}: blue          # unique label — sirf blue ke pods par
  ports:
    - port: {1}         # client Service ko is port par call karta hai
      targetPort: {2}   # pod ke andar application is port par sun rahi hai
      nodePort: 30102`,
          blanks: [
            { answer: 'app', explain: 'blue ke pods par <code>app=blue</code> laga hai aur green ke pods par <code>app=green</code>. <code>app</code> label jodte hi selector sirf blue ke pods se match karega, isliye endpoints 4 se ghat ke 2 ho jayenge.' },
            { answer: '80', explain: 'Service ka apna port. Client <code>http://blue-service:80</code> par aata hai. Yeh number pod ke port se alag ho sakta hai — dono ka koi rishta zaroori nahi.' },
            { answer: '8080', explain: 'targetPort = pod ke andar ka woh port jahan application <b>asli mein</b> sun rahi hai. Sawal mein diya gaya hai ki application 8080 par sun rahi hai. Agar targetPort galat likha to endpoints bhare hue dikhenge par connection refused milega.' },
          ],
          tokens: ['app', '80', '8080', 'version', '30102', 'name', '3000'],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: endpoints gino aur selector theek karo',
          instructions: 'Pehle endpoints ginti karo, phir label se pods dhoondo, phir selector theek karo.',
          goal: '<code>kubectl get svc,endpoints</code> se dekho ki blue-service ke paas kitne endpoints hain, <code>kubectl get pods -l version=v1 --show-labels</code> se wajah confirm karo, phir <code>ls</code> se fix lagao.',
          tasks: T_SELECTOR,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '46m', version: 'v1.30.2' }],
            pods: [
              { name: 'blue-6c7b7b965f-8vxwp', ready: '1/1', status: 'Running', restarts: 0, age: '21m', node: 'node-1', ip: '10.244.1.2', labels: 'app=blue,version=v1', logs: '10.244.0.1 - - "GET / HTTP/1.1" 200 512' },
              { name: 'blue-6c7b7b965f-zddzq', ready: '1/1', status: 'Running', restarts: 0, age: '24m', node: 'node-1', ip: '10.244.1.3', labels: 'app=blue,version=v1', logs: '10.244.0.1 - - "GET / HTTP/1.1" 200 512' },
              { name: 'green-864c4d957c-tnq9r', ready: '1/1', status: 'Running', restarts: 0, age: '24m', node: 'node-1', ip: '10.244.1.4', labels: 'app=green,version=v1', logs: '10.244.0.1 - - "GET / HTTP/1.1" 200 498' },
              { name: 'green-864c4d957c-w7ktb', ready: '1/1', status: 'Running', restarts: 0, age: '93s', node: 'node-1', ip: '10.244.1.5', labels: 'app=green,version=v1', logs: '10.244.0.1 - - "GET / HTTP/1.1" 200 498' },
            ],
            deployments: [
              { name: 'blue', ready: '2/2', upToDate: 2, available: 2, age: '24m' },
              { name: 'green', ready: '2/2', upToDate: 2, available: 2, age: '24m' },
            ],
            services: [
              { name: 'blue-service', type: 'NodePort', clusterIP: '10.98.48.50', ports: '8080:30102/TCP', age: '24m' },
              { name: 'green-service', type: 'NodePort', clusterIP: '10.107.193.230', ports: '8080:30101/TCP', age: '24m' },
            ],
            endpoints: [
              { name: 'blue-service', endpoints: '10.244.1.2:8080,10.244.1.3:8080,10.244.1.4:8080,10.244.1.5:8080', age: '24m' },
              { name: 'green-service', endpoints: '10.244.1.4:8080,10.244.1.5:8080', age: '24m' },
            ],
          },
          responses: [
            {
              re: /^(kubectl|k) get (pods|po)\b.*-l ?version=v1.*--show-labels|^(kubectl|k) get (pods|po)\b.*--show-labels.*-l ?version=v1/,
              out: 'NAME                     READY   STATUS    AGE   LABELS\nblue-6c7b7b965f-8vxwp    1/1     Running   21m   app=blue,version=v1\nblue-6c7b7b965f-zddzq    1/1     Running   24m   app=blue,version=v1\ngreen-864c4d957c-tnq9r   1/1     Running   24m   app=green,version=v1\ngreen-864c4d957c-w7ktb   1/1     Running   93s   app=green,version=v1',
            },
            {
              re: /^(kubectl|k) get (pods|po)\b.*-l ?version=v1$/,
              out: 'NAME                     READY   STATUS    RESTARTS   AGE\nblue-6c7b7b965f-8vxwp    1/1     Running   0          21m\nblue-6c7b7b965f-zddzq    1/1     Running   0          24m\ngreen-864c4d957c-tnq9r   1/1     Running   0          24m\ngreen-864c4d957c-w7ktb   1/1     Running   0          93s\n\n⚠️ 4 pods match hue — par blue deployment ke sirf 2 replicas hain.',
            },
            {
              re: /^(kubectl|k) get (svc|service|services) \S+ -o ?jsonpath/,
              out: '{"version":"v1"}',
            },
          ],
          files: {
            'fix-selector.yaml': {
              desc: 'blue-service ke selector mein app: blue jodta hai',
              apply: s => {
                const ep = s.cluster.endpoints.find(e => e.name === 'blue-service');
                ep.endpoints = '10.244.1.2:8080,10.244.1.3:8080';
                return 'service/blue-service configured\n✅ Endpoints 4 se ghat ke 2 ho gaye. Ab blue-service sirf blue ke pods par traffic bhejegi.';
              },
            },
            'strip-label.yaml': {
              desc: 'green ke pods se version=v1 label hata deta hai',
              apply: s => {
                const bep = s.cluster.endpoints.find(e => e.name === 'blue-service');
                const gep = s.cluster.endpoints.find(e => e.name === 'green-service');
                bep.endpoints = '10.244.1.2:8080,10.244.1.3:8080';
                gep.endpoints = '<none>';
                return 'deployment.apps/green configured\n\n⚠️ blue-service to theek ho gayi, par ab green-service ke endpoints <none> hain! green-service ka selector bhi version=v1 maangta hai. Ek bimari theek karke doosri paida kar di.';
              },
            },
          },
          success: allOf(T_SELECTOR),
          successText: 'Bug ka koi log nahi tha, koi 5xx nahi tha — sirf <b>endpoints ki ginti</b> ne pakda. blue deployment ke 2 replicas the par blue-service ke 4 endpoints. <b>Yaad rakho:</b> Service ka Deployment se koi rishta nahi hota, sirf label selector hota hai. Har Service ke selector mein kam se kam ek aisa label rakho jo sirf usi workload par ho. Aur agar tumne <code>strip-label.yaml</code> aazmaya, to dikha ki green ka label hataane se green-service tootti hai — sabse chhota fix hi sabse surakshit tha.',
          hints: [
            'kubectl get svc,endpoints — endpoints ki IP gino',
            'blue deployment ke kitne replicas hain? Endpoints se milao',
            'kubectl get pods -l version=v1 --show-labels — dekho kaun-kaun match ho raha hai',
            'ls chalao — fix-selector.yaml lagao (strip-label.yaml green-service tod dega)',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Service ke endpoints bhare hue hain par curl karne par connection refused aa raha hai. Kya galat hai?"',
            choices: [
              'targetPort galat hai — endpoints ban gaye kyunki selector match ho gaya, par application us port par sun hi nahi rahi',
              'Selector match nahi ho raha',
              'Pod NotReady hai',
              'NetworkPolicy block kar rahi hai',
            ],
            answer: 0,
            explain: 'Do alag lakshan, do alag wajah. <b>Endpoints khaali (<code>&lt;none&gt;</code>)</b> = selector match nahi hua, ya pods readiness probe fail kar rahe hain. <b>Endpoints bhare + connection refused</b> = selector to match ho gaya, par <code>targetPort</code> aise port par ishara kar raha hai jahan application sun hi nahi rahi. Confirm karo: <code>kubectl exec &lt;pod&gt; -- netstat -tlnp</code> se dekho application asli mein kis port par hai. (NetworkPolicy block karti to "connection refused" nahi, <b>timeout</b> aata.)',
          },
          {
            q: 'Interviewer: "Ek canary deploy ke baad 10% users purana version dekh rahe hain, par Deployment 100% naye ReplicaSet par hai. Kahan dekhoge?"',
            choices: [
              'kubectl get endpoints — purane ReplicaSet ka koi pod abhi bhi Service ke selector se match kar raha hoga (aksar Terminating pod ya orphan pod)',
              'Ingress controller ka cache',
              'CoreDNS ka TTL',
              'Deployment ka progressDeadlineSeconds',
            ],
            answer: 0,
            explain: 'Endpoints hi sach hai. Do aam wajah: <b>(1)</b> purana pod <code>Terminating</code> mein hai par abhi bhi endpoints mein hai (preStop hook ya lamba <code>terminationGracePeriodSeconds</code>); <b>(2)</b> kisi ne pehle <code>kubectl delete rs --cascade=orphan</code> chalaya tha, jisse purane pods bina maalik ke reh gaye aur ab bhi selector se match karte hain. Dekho: <code>kubectl get endpoints &lt;svc&gt; -o yaml</code> mein har IP ka <code>targetRef</code> — targetRef seedha pod ka naam bata deta hai.',
          },
        ],
      },
      success: [
        'Main Endpoints object ko sach ka source maanta hoon, Service ki YAML ko nahi',
        'Main endpoints ki ginti ko replica count se milata hoon',
        'Main har Service ke selector mein ek unique label rakhta hoon',
        'Main port / targetPort / containerPort ke teen-tarfa mel ko theek kar sakta hoon',
      ],
      homework: `<p>Overlapping selector ka bug khud banao:</p>
        <pre>kubectl create deployment blue --image=nginx
kubectl create deployment green --image=httpd
kubectl label deploy blue version=v1 --overwrite
kubectl patch deploy blue -p '{"spec":{"template":{"metadata":{"labels":{"version":"v1"}}}}}'
kubectl patch deploy green -p '{"spec":{"template":{"metadata":{"labels":{"version":"v1"}}}}}'

kubectl expose deployment blue --name=blue-svc --port=80 --selector=version=v1
kubectl get endpoints blue-svc          # ← 2 IP dikhenge, 1 hona chahiye tha

kubectl get endpoints blue-svc -o yaml | grep -A3 targetRef   # kaunsa pod hai, naam se
kubectl delete deploy blue green; kubectl delete svc blue-svc</pre>`,
      cards: [
        { front: 'Service pods ko kaise dhoondhti hai?', back: 'Sirf <b>label selector</b> se. Service ka Deployment se koi seedha rishta nahi hota. Isliye ek dheela selector doosre Deployment ke pods bhi utha sakta hai.' },
        { front: 'Endpoints khaali vs endpoints bhare + connection refused?', back: '<b>Khaali</b> = selector match nahi hua, ya pods readiness fail kar rahe hain. <b>Bhare + refused</b> = targetPort galat hai, application us port par sun hi nahi rahi.' },
        { front: 'Overlapping selector ka bug kaise pakdein?', back: '<code>kubectl get endpoints</code> mein IP <b>gino</b> aur Deployment ke replica count se milao. Logs mein kuch nahi milega — dono applications 200 hi deti hain.' },
        { front: 'containerPort ka kya kaam hai?', back: 'Sirf <b>dastavez</b>. containerPort likhne se application us port par sunna shuru nahi karti, aur na likhne se traffic rukta hai. Maayne sirf iska rakhta hai ki application asli mein kis port par sun rahi hai.' },
        { front: 'Endpoints se pod ka naam kaise nikalein?', back: '<code>kubectl get endpoints &lt;svc&gt; -o yaml</code> — har address ke neeche <code>targetRef</code> mein pod ka poora naam likha hota hai.' },
      ],
    },

    /* ============================================================
       8. Config out of date + enableServiceLinks + immutability
       ============================================================ */
    {
      id: 'kk-config',
      icon: '🔁',
      title: 'Config badla, Pod ko pata hi nahi — staleness ke teen jaal',
      badge: 'Config Chaukidar',
      objectives: [
        'Samajhna ki `envFrom` wali ConfigMap badalne par pod apne aap nahi badalta',
        'Volume-mounted ConfigMap ka apne aap update hona (aur uska ~60-90s ka lag)',
        '`field is immutable` error ka matlab aur uska sahi ilaaj',
        '`enableServiceLinks` ka chhupa hua "argument list too long" jaal',
      ],
      lesson: [
        `<h3>🔁 ConfigMap badla, par pod purani value hi chala raha hai</h3>
         <p>ConfigMap pod tak do raston se aati hai, aur dono raston ka behaviour bilkul alag hai:</p>
         <table class="kk-tbl">
           <tr><th>Raasta</th><th>ConfigMap badalne par</th><th>Kyun</th></tr>
           <tr><td><code>env</code> / <code>envFrom</code></td><td><b>Kuch nahi hota.</b> Pod purani value hi chalata rehta hai</td><td>Environment variables container ke banne ke waqt ek baar set hote hain. Linux mein chalte hue process ka env bahar se badla hi nahi ja sakta.</td></tr>
           <tr><td><code>volumeMounts</code> (file)</td><td>File <b>apne aap</b> badal jaati hai, ~60-90 second mein</td><td>kubelet mounted ConfigMap ko periodically sync karta hai. Par application ko file dobara padhni padegi (ya SIGHUP chahiye).</td></tr>
           <tr><td><code>subPath</code> ke saath mount</td><td><b>Kuch nahi hota</b> — jaal!</td><td><code>subPath</code> mount ek baar ka snapshot hai, kubelet usse update nahi karta.</td></tr>
         </table>
         <p><b>env wale raaste ka sahi ilaaj:</b> pods ko naya banana padega.</p>
         <pre>kubectl rollout restart deployment/&lt;naam&gt;      # sabse saaf tarika</pre>
         <p><b>GitOps-friendly ilaaj:</b> ConfigMap ke content ka hash pod template ke annotation mein
         daalo. ConfigMap badalte hi hash badlega, pod template badlega, aur rollout apne aap chalega:</p>
         <pre>spec:
  template:
    metadata:
      annotations:
        checksum/config: "{{ include (print $.Template.BasePath \\"/cm.yaml\\") . | sha256sum }}"</pre>
         <p><b>Automatic ilaaj:</b> <a>Reloader</a> naam ka ek chhota controller hai jo ConfigMap/Secret
         par nazar rakhta hai aur badalte hi rolling restart kar deta hai. Sirf ek annotation chahiye:</p>
         <pre>metadata:
  annotations:
    reloader.stakater.com/auto: "true"</pre>`,

        `<h3>🚫 "field is immutable" aur 🌊 enableServiceLinks</h3>
         <p><b>Immutable fields.</b> Deployment ke <code>spec.selector.matchLabels</code> ko badalne par
         API server saaf mana kar deta hai:</p>
         <pre>The Deployment "redis-deployment" is invalid: spec.selector:
  Invalid value: …: field is immutable</pre>
         <p>Selector isliye immutable hai kyunki selector hi ReplicaSet aur pods ka rishta tay karta hai.
         Selector chalte-chalte badal dene se purane pods anaath ho jaate aur naye pods ke saath
         do alag set chalte rehte. <b>Ilaaj:</b> Deployment delete karke naye selector ke saath
         dobara banao — ya zero-downtime chahiye to naye naam se doosri Deployment banao,
         traffic shift karo, phir purani hatao. Aise hi immutable hain:
         Job ka <code>spec.template</code>, PVC ka <code>spec.resources</code> (sirf badhaya ja sakta hai),
         Service ka <code>clusterIP</code>, aur ConfigMap/Secret jinpar <code>immutable: true</code> laga ho.</p>

         <div class="war-story"><b>⚡ Asli incident — "argument list too long".</b> Ek manifest
         <code>dev</code> namespace mein bilkul theek chali. Wahi manifest, bina ek akshar badle,
         <code>staging</code> mein crash karne lagi:
         <pre>standard_init_linux.go:228: exec user process caused: argument list too long</pre>
         Wajah: Kubernetes har pod mein <b>us namespace ki har Service</b> ke liye environment
         variables inject karta hai (<code>SERVICE_PAYMENTS_PORT_80_TCP=…</code> jaisi kai lines
         per service). <code>dev</code> mein sirf 2 services thi. <code>staging</code> mein 40+ services thi,
         isliye environment itna bada ho gaya ki Linux ka exec argument limit paar ho gaya.
         <b>Ilaaj:</b> pod spec mein <code>enableServiceLinks: false</code> — CoreDNS pehle se
         service discovery de raha hai, isliye yeh purane environment variables ki zaroorat hi nahi.</div>
         <pre>spec:
  template:
    spec:
      enableServiceLinks: false   # default TRUE hai — isse band karo</pre>`,
      ],
      stages: [
        {
          type: 'quiz',
          title: 'Config badla — pod ko pata chalega ya nahi?',
          questions: [
            {
              q: 'ConfigMap <code>app-settings</code> ko <code>envFrom</code> se pod mein liya gaya hai. ConfigMap ki value badal di. Pod mein kya hoga?',
              context: 'envFrom:\n  - configMapRef:\n      name: app-settings',
              choices: [
                'Kuch nahi — pod purani value hi chalata rahega jab tak pod dobara na bane',
                'Pod ke andar ki value ~60 second mein apne aap badal jayegi',
                'kubelet pod ko apne aap restart kar dega',
                'Pod turant CrashLoopBackOff mein chala jayega',
              ],
              answer: 0,
              explain: 'Environment variables container ke <b>banne ke waqt</b> ek baar set hote hain. Linux mein chalte hue process ka environment bahar se badla hi nahi ja sakta, isliye Kubernetes ke paas koi tarika hai hi nahi. Ilaaj: <code>kubectl rollout restart deployment/&lt;naam&gt;</code>, ya pod template mein config ka checksum annotation daalo, ya Reloader controller lagao.',
            },
            {
              q: 'Wahi ConfigMap ab volume ki tarah <code>/etc/app/config.yaml</code> par mount ki gayi hai (bina subPath ke). ConfigMap badalne par?',
              context: 'volumeMounts:\n  - name: cfg\n    mountPath: /etc/app\nvolumes:\n  - name: cfg\n    configMap:\n      name: app-settings',
              choices: [
                'File ~60-90 second mein apne aap badal jayegi — par application ko file dobara padhni padegi tab hi asar hoga',
                'File turant badal jayegi aur application apne aap naya config utha legi',
                'File kabhi nahi badlegi',
                'Pod restart ho jayega',
              ],
              answer: 0,
              explain: 'kubelet mounted ConfigMap ko periodically sync karta hai (default sync period ~60s, plus cache ka time — kul milakar 60-90 second). Par <b>file badal jaane se application ka behaviour apne aap nahi badalta</b>. Application ko ya to file par watch lagani hogi, ya SIGHUP par config dobara padhni hogi. Jo applications sirf boot par config padhti hain, unke liye volume mount aur env mein koi practical farq nahi rehta.',
            },
            {
              q: 'ConfigMap <code>subPath</code> ke saath mount ki gayi hai: <code>mountPath: /etc/app/config.yaml, subPath: config.yaml</code>. ConfigMap badalne par?',
              choices: [
                'Kuch nahi — subPath mount ek baar ka snapshot hota hai aur kubelet usse update nahi karta',
                'File ~60 second mein badal jayegi',
                'Pod CrashLoopBackOff mein chala jayega',
                'API server subPath ko reject kar dega',
              ],
              answer: 0,
              explain: 'Yeh sabse chupka hua jaal hai. <code>subPath</code> ka istemaal isliye hota hai ki poora directory replace na ho jaye (jaise <code>/etc/nginx/</code> mein sirf ek file daalni ho). Par <code>subPath</code> ke saath kubelet mount ko update <b>karta hi nahi</b>. Log volume mount samajh kar auto-update ki umeed lagaye baithe rehte hain aur ghanton pareshaan hote hain. Ilaaj: subPath hata do (poora directory mount karo aur symlink use karo), ya rollout restart karo.',
            },
            {
              q: 'Deployment ke <code>spec.selector.matchLabels</code> mein ek naya label jodne par API server "field is immutable" keh raha hai. Sahi ilaaj?',
              choices: [
                'Deployment delete karke naye selector ke saath dobara banao (ya zero-downtime chahiye to naye naam se nayi Deployment bana ke traffic shift karo)',
                'kubectl apply --force-conflicts lagao',
                'kubectl edit se badlo, edit immutability check skip karta hai',
                'Pehle replicas 0 karo, phir selector badal do',
              ],
              answer: 0,
              explain: 'Selector isliye immutable hai kyunki selector hi ReplicaSet aur pods ka rishta tay karta hai. Chalte-chalte selector badal dene se purane pods anaath ho jaate aur do alag set saath-saath chalte rehte. Koi flag immutability ko bypass nahi karta — <code>--force</code> asli mein delete-and-recreate karta hai (downtime ke saath). Zero-downtime raasta: naye naam se nayi Deployment + Service ka selector shift + purani Deployment hatao.',
            },
          ],
        },
        {
          type: 'flow',
          title: '🎬 Flow: naye pod mein environment variables kahan-kahan se aate hain',
          instructions: '▶ dabao. Dekho kubelet ek pod ka environment kaise jodta hai — aur staging namespace mein woh environment itna bada kaise ho gaya ki exec hi fail ho gaya.',
          lanes: [
            { id: 'api', label: 'API server', icon: '🏛️' },
            { id: 'kubelet', label: 'kubelet', icon: '🤖' },
            { id: 'cri', label: 'containerd', icon: '📦' },
            { id: 'proc', label: 'Container process', icon: '🏃' },
          ],
          steps: [
            { lane: 'api', t: 'Pod object bana — spec mein 3 env variables likhe hain', detail: 'Developer ne manifest mein sirf 3 environment variables likhe: <code>APP_ENV</code>, <code>LOG_LEVEL</code>, <code>PORT</code>. Developer ki umeed hai ki container ko bas 3 hi milenge.' },
            { lane: 'kubelet', t: 'kubelet ne pod spec ke env variables jama kiye', detail: 'Teeno variables list mein aa gaye. Ab tak sab theek — environment mein 3 entries hain.' },
            { lane: 'kubelet', t: 'kubelet ne ConfigMap aur Secret padhi', detail: '<code>envFrom</code> se ConfigMap ki 6 keys aur Secret ki 2 keys judi. Environment ab 11 entries ka ho gaya.' },
            { lane: 'kubelet', t: 'kubelet ne NAMESPACE KI HAR SERVICE ke variables jode', detail: 'Yahan chhupi hui cheez hai. <code>enableServiceLinks</code> ka default <b>true</b> hai, isliye kubelet namespace ki <b>har</b> Service ke liye ~7 environment variables jodta hai:<br><code>SERVICE_PAYMENTS_PORT_80_TCP</code>, <code>…_TCP_ADDR</code>, <code>…_TCP_PORT</code>, <code>…_TCP_PROTO</code>, <code>…_SERVICE_HOST</code>, <code>…_SERVICE_PORT</code>, <code>…_PORT</code>.',
              ask: { q: '<code>dev</code> namespace mein 2 services hain, <code>staging</code> mein 42. Dono jagah <b>ek hi</b> manifest deploy hui. Environment mein kitna farq padega?', choices: ['dev mein ~14 extra variables, staging mein ~294 extra — manifest bilkul same hone par bhi', 'Dono jagah barabar, kyunki manifest same hai', 'staging mein kam, kyunki wahan services shared hain', 'Koi farq nahi, service links sirf default namespace mein lagte hain'], answer: 0, explain: 'kubelet <b>har Service ke liye ~7 variables</b> jodta hai. 2 services = ~14 variables, 42 services = ~294 variables. Manifest ka isse koi lena-dena nahi — variables namespace ki halat se aate hain. Isliye ek hi manifest dev mein chalti hai aur staging mein crash karti hai, aur diff dekhne par kuch galat nahi milta.' } },
            { lane: 'cri', t: 'containerd ne poora environment le kar exec kiya', detail: 'containerd ne saare environment variables ke saath entrypoint chalane ki koshish ki. Linux mein <code>execve()</code> ke arguments + environment ka kul size seemit hota hai (aksar ~2MB, aur per-string limit alag).' },
            { lane: 'proc', t: 'staging mein exec fail: "argument list too long"', detail: '<code>standard_init_linux.go:228: exec user process caused: argument list too long</code><br>Container start hi nahi hua. Application ke logs khaali honge, kyunki application chali hi nahi.',
              ask: { q: 'Sabse achha ilaaj kya hai?', choices: ['Pod spec mein enableServiceLinks: false — CoreDNS pehle se service discovery deta hai, isliye purane environment variables bekaar hain', 'staging namespace se services ghata do', 'Container ka entrypoint chhota kar do', 'Memory limit badha do'], answer: 0, explain: '<code>enableServiceLinks: false</code> kubelet ko Service wale variables inject karne se rok deta hai. Feature Kubernetes ke shuruaati dinon ka hai, jab DNS-based discovery pakka nahi tha. Aaj CoreDNS har cluster mein hota hai aur applications <code>payments.staging.svc.cluster.local</code> use karti hain, isliye variables ki zaroorat hi nahi. Namespace se services hataana asli kaam todega, aur memory limit ka is error se koi rishta nahi hai.' } },
            { lane: 'proc', t: 'enableServiceLinks: false lagane ke baad — container Running', detail: 'Ab environment mein sirf pod spec, ConfigMap, Secret aur ~7 <code>KUBERNETES_*</code> variables hain. Kul milakar ~18 entries, 300+ nahi. Container turant boot ho gaya.' },
          ],
          summary: '✅ Ek hi manifest, do namespaces, alag natija — kyunki <b>environment ka aadha hissa manifest se aata hi nahi</b>. <code>enableServiceLinks</code> ka default true hai aur namespace ki har Service pod ka environment badhati hai. Nayi services ke liye <code>enableServiceLinks: false</code> ek achha default hai.',
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: ConfigMap badal chuki hai, pod ko pata nahi',
          instructions: 'ConfigMap mein LOG_LEVEL ab debug hai, par pod ke andar abhi bhi info hai. Confirm karo, phir sahi tarike se rollout karo.',
          goal: '<code>kubectl get cm</code> se ConfigMap ki asli value dekho, <code>kubectl exec &lt;pod&gt; -- printenv</code> se pod ke andar ki value dekho, phir <code>ls</code> se sahi fix chuno.',
          tasks: T_CONFIG,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '20d', version: 'v1.30.2' }],
            pods: [
              { name: 'api-7d9c4b6f8-aa1bb', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.244.1.11', env: 'v1', logs: '{"level":"info","msg":"api started, log level info"}', exec: { 'printenv': 'PATH=/usr/local/bin:/usr/bin:/bin\nHOSTNAME=api-7d9c4b6f8-aa1bb\nLOG_LEVEL=info\nAPP_ENV=production\nKUBERNETES_SERVICE_HOST=10.96.0.1', 'env': 'PATH=/usr/local/bin:/usr/bin:/bin\nHOSTNAME=api-7d9c4b6f8-aa1bb\nLOG_LEVEL=info\nAPP_ENV=production\nKUBERNETES_SERVICE_HOST=10.96.0.1' } },
              { name: 'api-7d9c4b6f8-cc2dd', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.244.1.12', env: 'v1', logs: '{"level":"info","msg":"api started, log level info"}', exec: { 'printenv': 'LOG_LEVEL=info\nAPP_ENV=production', 'env': 'LOG_LEVEL=info\nAPP_ENV=production' } },
            ],
            deployments: [{ name: 'api', ready: '2/2', upToDate: 2, available: 2, age: '3d' }],
            services: [],
            configmaps: [{ name: 'api-settings', data: 2, age: '3d' }],
          },
          responses: [
            { re: /^(kubectl|k) (get|describe) (cm|configmap|configmaps) ?\S*$/, out: 'Name:         api-settings\nNamespace:    default\n\nData\n====\nAPP_ENV:\n----\nproduction\nLOG_LEVEL:\n----\ndebug\n\n⚠️ ConfigMap mein LOG_LEVEL ab "debug" hai (kisi ne 20 minute pehle badla tha).' },
          ],
          files: {
            'rollout-restart.yaml': {
              desc: 'api deployment ka rolling restart karta hai (naye pods, naya environment)',
              apply: s => {
                s.cluster.pods = [
                  { name: 'api-8e0d5c7g9-ff5gg', ready: '1/1', status: 'Running', restarts: 0, age: '4s', node: 'node-1', ip: '10.244.1.14', env: 'v2', logs: '{"level":"debug","msg":"api started, log level debug"}', exec: { 'printenv': 'LOG_LEVEL=debug\nAPP_ENV=production', 'env': 'LOG_LEVEL=debug\nAPP_ENV=production' } },
                  { name: 'api-8e0d5c7g9-hh6jj', ready: '1/1', status: 'Running', restarts: 0, age: '4s', node: 'node-1', ip: '10.244.1.15', env: 'v2', logs: '{"level":"debug","msg":"api started, log level debug"}', exec: { 'printenv': 'LOG_LEVEL=debug\nAPP_ENV=production', 'env': 'LOG_LEVEL=debug\nAPP_ENV=production' } },
                ];
                return 'deployment.apps/api restarted\n✅ Naye pods ban gaye aur naye containers ne ConfigMap ki nayi value uthayi — LOG_LEVEL ab debug hai.';
              },
            },
            'edit-configmap.yaml': {
              desc: 'ConfigMap ko dobara apply karta hai (value pehle se debug hai)',
              apply: () => 'configmap/api-settings configured\n\n⚠️ Pods ke andar abhi bhi LOG_LEVEL=info hai. envFrom se aayi values container ke BANNE ke waqt set hoti hain — ConfigMap ko chhune se chalte hue container ka environment nahi badalta.',
            },
            'add-checksum.yaml': {
              desc: 'pod template mein ConfigMap ka checksum annotation jodta hai (GitOps-friendly)',
              apply: s => {
                s.cluster.pods = [
                  { name: 'api-9f1e6d8h0-kk7ll', ready: '1/1', status: 'Running', restarts: 0, age: '4s', node: 'node-1', ip: '10.244.1.16', env: 'v2', logs: '{"level":"debug","msg":"api started, log level debug"}', exec: { 'printenv': 'LOG_LEVEL=debug\nAPP_ENV=production', 'env': 'LOG_LEVEL=debug\nAPP_ENV=production' } },
                  { name: 'api-9f1e6d8h0-mm8nn', ready: '1/1', status: 'Running', restarts: 0, age: '4s', node: 'node-1', ip: '10.244.1.17', env: 'v2', logs: '{"level":"debug","msg":"api started, log level debug"}', exec: { 'printenv': 'LOG_LEVEL=debug\nAPP_ENV=production', 'env': 'LOG_LEVEL=debug\nAPP_ENV=production' } },
                ];
                return 'deployment.apps/api configured\n✅ Checksum annotation badla → pod template badla → rollout apne aap chala. Aage se ConfigMap badalte hi rollout khud ho jayega.';
              },
            },
          },
          success: allOf(T_CONFIG),
          successText: 'ConfigMap 20 minute pehle badal chuki thi par pods ke andar purani value hi chal rahi thi. <b>envFrom ki values container ke banne ke waqt ek baar set hoti hain</b> — Linux chalte hue process ka environment badal hi nahi sakta. Teen sahi ilaaj hain: <code>kubectl rollout restart</code> (turant, manual), checksum annotation (GitOps-friendly, apne aap chalta hai), ya Reloader controller (poore cluster ke liye automatic).',
          hints: [
            'kubectl get cm api-settings — ConfigMap mein LOG_LEVEL ab kya hai?',
            'kubectl exec api-7d9c4b6f8-aa1bb -- printenv — pod ke andar LOG_LEVEL kya hai?',
            'Dono alag hain — matlab pod ne purani value pakad rakhi hai',
            'ls chalao — rollout-restart.yaml ya add-checksum.yaml, dono kaam karenge',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "ConfigMap badalne par pods apne aap update ho jaayein — GitOps setup mein kaise karoge?"',
            choices: [
              'Pod template ke annotation mein ConfigMap ka checksum daalo — ConfigMap badalte hi checksum badlega, pod template badlega, aur rollout apne aap chalega',
              'ConfigMap ko volume ki tarah mount kar do, bas ho gaya',
              'CI pipeline se har deploy par kubectl rollout restart chalao',
              'ConfigMap par immutable: true laga do',
            ],
            answer: 0,
            explain: 'GitOps ka niyam hai: cluster ki halat sirf git se badle. <code>kubectl rollout restart</code> ek imperative command hai aur ArgoCD ke agle sync mein uska koi nishan nahi bachta. Checksum annotation puri tarah declarative hai — ConfigMap ka content badalta hai to annotation badalta hai, pod template ka hash badalta hai, aur Deployment controller apne aap rolling update chalata hai. (Cluster-wide automatic chahiye to <b>Reloader</b> controller lagao, jo sirf ek annotation maangta hai.) <code>immutable: true</code> ulta kaam karta hai — ConfigMap badalne hi nahi deta.',
          },
          {
            q: 'Interviewer: "Ek manifest dev mein chalti hai aur staging mein <code>argument list too long</code> deti hai. Manifest bilkul same hai. Kya ho raha hai?"',
            choices: [
              'enableServiceLinks default true hai — staging namespace mein bahut zyada Services hain, aur kubelet har Service ke ~7 environment variables inject karta hai',
              'staging ke nodes ka kernel purana hai',
              'staging mein image ka architecture alag hai',
              'staging namespace mein memory limit kam hai',
            ],
            answer: 0,
            explain: 'Environment ka aadha hissa manifest se aata hi nahi. <code>enableServiceLinks</code> ka default <b>true</b> hai, aur kubelet namespace ki har Service ke liye ~7 variables jodta hai (<code>&lt;SVC&gt;_SERVICE_HOST</code>, <code>&lt;SVC&gt;_PORT_80_TCP</code>, waghera). 40+ services wale namespace mein environment 300+ entries ka ho jaata hai aur Linux ka exec limit paar ho jaata hai. Isliye ek hi manifest do namespaces mein alag behave karti hai aur diff mein kuch galat nahi milta. Ilaaj: <code>enableServiceLinks: false</code> — CoreDNS pehle se service discovery de raha hai.',
          },
        ],
      },
      success: [
        'Main jaanta hoon ki envFrom wali values pod restart ke bina nahi badalti',
        'Main volume mount ka ~60-90s auto-update aur subPath ka "kabhi update nahi" wala jaal jaanta hoon',
        'Main `field is immutable` par delete-and-recreate ya naye-naam-wala raasta chunta hoon',
        'Main naye workloads mein enableServiceLinks: false rakhta hoon',
      ],
      homework: `<p>Teeno raaston ka farq khud dekho:</p>
        <pre>kubectl create cm demo --from-literal=LEVEL=info
kubectl create deployment envtest --image=busybox -- sh -c 'sleep 3600'
kubectl set env deploy/envtest --from=configmap/demo

kubectl exec deploy/envtest -- printenv LEVEL        # info
kubectl create cm demo --from-literal=LEVEL=debug --dry-run=client -o yaml | kubectl apply -f -
kubectl exec deploy/envtest -- printenv LEVEL        # ABHI BHI info
kubectl rollout restart deploy/envtest
kubectl exec deploy/envtest -- printenv LEVEL        # ab debug

# enableServiceLinks ka asar
kubectl exec deploy/envtest -- printenv | wc -l
kubectl patch deploy envtest -p '{"spec":{"template":{"spec":{"enableServiceLinks":false}}}}'
kubectl exec deploy/envtest -- printenv | wc -l      # kam ho gaya
kubectl delete deploy envtest; kubectl delete cm demo</pre>`,
      cards: [
        { front: 'envFrom wali ConfigMap badalne par pod mein kya hota hai?', back: '<b>Kuch nahi.</b> Environment variables container ke banne ke waqt ek baar set hote hain — chalte hue Linux process ka environment badla hi nahi ja sakta. Ilaaj: rollout restart, checksum annotation, ya Reloader.' },
        { front: 'Volume-mounted ConfigMap kab update hoti hai?', back: '~60-90 second mein kubelet file apne aap badal deta hai. Par application ko file dobara padhni padegi (watch ya SIGHUP), warna behaviour nahi badlega.' },
        { front: '<code>subPath</code> ke saath mount ki gayi ConfigMap?', back: '<b>Kabhi update nahi hoti</b> — subPath mount ek baar ka snapshot hai. Sabse chupka hua jaal. Ilaaj: subPath hatao ya rollout restart karo.' },
        { front: '<code>spec.selector: field is immutable</code> — kyun aur kya karein?', back: 'Selector hi ReplicaSet-pod ka rishta tay karta hai; badalne se purane pods anaath ho jaate. Ilaaj: delete karke dobara banao, ya zero-downtime chahiye to naye naam se nayi Deployment + traffic shift.' },
        { front: '<code>enableServiceLinks</code> kya karta hai?', back: 'Default <b>true</b> — kubelet namespace ki har Service ke ~7 environment variables pod mein inject karta hai. Bade namespace mein "argument list too long" ho sakta hai. CoreDNS ke rehte variables bekaar hain, isliye <code>false</code> achha default hai.' },
      ],
    },

    /* ============================================================
       9. Endlessly terminating + multi-attach
       ============================================================ */
    {
      id: 'kk-terminating',
      icon: '🧟',
      title: 'Terminating mein atka hua — finalizers aur Multi-Attach',
      badge: 'Finalizer Fakir',
      objectives: [
        'Finalizer ka kaam samajhna aur atke hue object ko surakshit tarike se chhudana',
        '`--force --grace-period=0` ka asli khatra jaanna',
        'Namespace ke `Terminating` mein atakne ki asli wajah (aksar APIService) dhoondhna',
        'Multi-Attach volume error aur RWO ke saath RollingUpdate ka takraav samajhna',
      ],
      lesson: [
        `<h3>🧟 Delete ka asli matlab: deletionTimestamp lagana</h3>
         <p><code>kubectl delete</code> object ko hataata nahi. <code>kubectl delete</code> sirf
         <code>metadata.deletionTimestamp</code> set karta hai. Object tabhi asli mein hatta hai jab
         uski <code>metadata.finalizers</code> list <b>khaali</b> ho jaye.</p>
         <p>Finalizer ek controller ka "ruko, pehle mera kaam" wala taala hai:</p>
         <table class="kk-tbl">
           <tr><th>Finalizer</th><th>Kaun lagata hai</th><th>Kya kaam karta hai</th></tr>
           <tr><td><code>kubernetes.io/pv-protection</code></td><td>PV controller</td><td>PV tab tak nahi hatega jab tak koi PVC usse baandhe hai</td></tr>
           <tr><td><code>kubernetes.io/pvc-protection</code></td><td>PVC controller</td><td>PVC tab tak nahi hategi jab tak koi pod usse use kar raha hai</td></tr>
           <tr><td><code>foregroundDeletion</code></td><td>garbage collector</td><td>Parent tab hatega jab saare children hat jaayein</td></tr>
           <tr><td>Custom (operator ka)</td><td>Koi bhi operator</td><td>Cloud resource, DNS record, backup — bahar ki cheez saaf karna</td></tr>
         </table>
         <p><b>Sahi kram (upar se neeche):</b></p>
         <pre>kubectl get pod &lt;p&gt; -o jsonpath='{.metadata.finalizers}'   # 1. kaunsa finalizer atka hai?
kubectl describe pod &lt;p&gt; | tail -20                        # 2. controller kya keh raha hai?
kubectl logs -n &lt;ns&gt; deploy/&lt;controller&gt;                    # 3. controller zinda bhi hai?
# 4. tabhi, aur sirf tabhi:
kubectl patch pod &lt;p&gt; -p '{"metadata":{"finalizers":null}}' --type=merge</pre>
         <div class="war-story"><b>⚡ <code>--force --grace-period=0</code> ka asli khatra:</b>
         yeh command pod ko <b>etcd se mita deti hai</b> par node par chal raha container zinda reh
         sakta hai. StatefulSet ke saath yeh khatarnak hai: Kubernetes maan leta hai ki purana pod
         mar chuka hai, isliye usi naam se naya pod bana deta hai. Ab do process ek hi volume par
         likh rahe hain — data corruption. Isliye <code>--force</code> tab tak nahi jab tak tumne
         khud confirm na kar liya ho ki node par process sach mein mar chuka hai.</div>`,

        `<h3>💾 Multi-Attach: RWO volume aur RollingUpdate ka takraav</h3>
         <pre>Warning  FailedAttachVolume  kubelet  Multi-Attach error for volume "pvc-8f3c…":
  Volume is already exclusively attached to one node and can't be attached to another</pre>
         <p>Wajah seedhi hai. Volume ka access mode <code>ReadWriteOnce</code> hai — volume ek waqt par
         sirf <b>ek node</b> par attach ho sakta hai. Deployment ki default strategy
         <code>RollingUpdate</code> hai — naya pod <b>pehle</b> banta hai, purana pod uske
         <b>baad</b> hatta hai. Agar naya pod doosre node par gaya, to naya pod volume maangta hai
         jo abhi purane node par attached hai. Naya pod atak jaata hai.</p>
         <table class="kk-tbl">
           <tr><th>Ilaaj</th><th>Kya karta hai</th><th>Kab chuno</th></tr>
           <tr><td><code>strategy: Recreate</code></td><td>Purana pod pehle poori tarah hatta hai, tab naya banta hai</td><td>Single-replica stateful app jahan thodi downtime chalti hai</td></tr>
           <tr><td>Scale 0 phir 1</td><td>Manual wahi kaam</td><td>Ek baar ka emergency fix</td></tr>
           <tr><td>RWX storage (NFS, EFS, CephFS)</td><td>Volume kai nodes par ek saath attach ho sakta hai</td><td>Jab kai replicas ko sach mein ek hi data chahiye</td></tr>
           <tr><td>StatefulSet + per-pod PVC</td><td>Har replica ka apna volume</td><td>Databases — asli sahi jawab</td></tr>
         </table>
         <p><b>Ek aur baat:</b> agar volume ka <code>ReadWriteOnce</code> hai aur dono pods
         <b>usi node</b> par chale jaayein, to Multi-Attach error aayega hi nahi (RWO node-level
         hai, pod-level nahi). Isliye yeh bug rukh-rukh ke aata hai — jab tak scheduler naya pod
         usi node par rakhta hai, kisi ko pata hi nahi chalta.</p>`,
      ],
      stages: [
        {
          type: 'incident',
          title: '🚨 3AM: "namespace 40 minute se Terminating hai"',
          pager: `<b>PagerDuty · 03:12</b><br>
            Cleanup job ne <code>legacy-tools</code> namespace delete kiya tha.<br>
            40 minute ho gaye, namespace abhi bhi <code>Terminating</code> mein hai.<br>
            Deployment pipeline ruki hui hai kyunki wahi naam dobara chahiye.`,
          start: 'n1',
          nodes: {
            n1: {
              sitrep: `$ kubectl get ns legacy-tools
NAME            STATUS        AGE
legacy-tools    Terminating   214d

$ kubectl get all -n legacy-tools
No resources found in legacy-tools namespace.`,
              text: 'Namespace ke andar koi resource nahi bacha, phir bhi namespace Terminating mein hai. Pehla kadam?',
              choices: [
                { t: 'kubectl get ns legacy-tools -o yaml — status.conditions aur spec.finalizers padho', good: true, next: 'n2', explain: 'Bilkul sahi. Namespace ke <code>status.conditions</code> mein Kubernetes saaf likhta hai ki kaunsi cheez atki hai. Guess karne se pehle Kubernetes se poochna hamesha behtar hai.' },
                { t: 'kubectl delete ns legacy-tools --force --grace-period=0', good: false, explain: 'Namespace par <code>--force</code> ka koi asar hi nahi hota — namespace deletion ka apna alag protocol hai. Aur agar asar hota bhi, to <b>abhi tak wajah pata hi nahi</b> hai. Wajah jaane bina force lagana andhera mein teer hai.' },
                { t: 'Namespace ka finalizer seedha hata do', good: false, explain: 'Yahi ek din corrupted state chhod deta hai. Finalizer isliye laga hai kyunki koi controller kehta hai "mera kaam baaki hai". Pehle <b>kaunsa</b> controller aur <b>kyun</b> — uske baad hi zabardasti.' },
                { t: 'kube-controller-manager restart karo', good: false, explain: 'Bahut bada hathoda hai, aur abhi tak koi saboot nahi hai ki controller-manager doshi hai. Control plane restart karne se pehle diagnosis poori honi chahiye.' },
              ],
            },
            n2: {
              sitrep: `$ kubectl get ns legacy-tools -o yaml | tail -18
status:
  conditions:
  - type: NamespaceDeletionDiscoveryFailure
    status: "True"
    reason: DiscoveryFailed
    message: 'Discovery failed for some groups, 1 failing:
      unable to retrieve the complete list of server APIs:
      metrics.k8s.io/v1beta1: stale GroupVersion discovery:
      metrics.k8s.io/v1beta1'
  phase: Terminating
spec:
  finalizers:
  - kubernetes`,
              text: 'Kubernetes ne khud wajah likh di hai: <code>metrics.k8s.io/v1beta1</code> ka discovery fail ho raha hai. Ab kya?',
              choices: [
                { t: 'kubectl get apiservice — dekho kaunsi APIService unavailable hai', good: true, next: 'n3', explain: 'Sahi. <code>metrics.k8s.io/v1beta1</code> ek <b>aggregated API</b> hai jo metrics-server deta hai. Namespace controller har API group se poochta hai "tumhare paas is namespace ka koi object hai?" — ek bhi group jawab na de, to namespace controller ruk jaata hai.' },
                { t: 'Namespace ka finalizer ab hata do, wajah to mil gayi', good: false, explain: 'Wajah mil gayi hai par wajah <b>theek karne layak</b> hai. Finalizer hataane se yeh namespace to chala jayega, par ek toota hua APIService cluster mein reh jayega jo <b>har agli namespace deletion</b> ko atkaayega. Asli fix zyada door nahi hai.' },
                { t: 'metrics-server ko dobara install karo', good: false, explain: 'Shayad sahi disha hai par bahut jaldi hai. Pehle confirm karo ki APIService sach mein unavailable hai aur metrics-server ke pods ki halat kya hai. 3AM par bina jaanche install karna naya outage bana sakta hai.' },
              ],
            },
            n3: {
              sitrep: `$ kubectl get apiservice | grep -v True
NAME                     SERVICE                      AVAILABLE                  AGE
v1beta1.metrics.k8s.io   kube-system/metrics-server   False (ServiceNotFound)    180d

$ kubectl get pods -n kube-system | grep metrics
(kuch nahi)

$ kubectl get svc -n kube-system metrics-server
Error from server (NotFound): services "metrics-server" not found`,
              text: 'metrics-server ka Deployment aur Service dono gayab hain — kisi ne 3 mahine pehle uninstall kiya tha, par APIService object peeche chhod diya. Ab sahi kadam?',
              choices: [
                { t: 'Anaath APIService delete karo: kubectl delete apiservice v1beta1.metrics.k8s.io', good: true, next: 'end', explain: 'Yahi asli fix hai. APIService object API server ko batata hai ki <code>metrics.k8s.io/v1beta1</code> ke liye <code>kube-system/metrics-server</code> se poochna hai. Service maujood hi nahi hai, isliye har discovery call fail hoti hai. Anaath APIService hataate hi discovery theek ho jaata hai aur namespace apne aap hat jaata hai.' },
                { t: 'Namespace ka finalizer API se zabardasti hatao', good: false, explain: 'Yeh namespace chala jayega par toota hua APIService cluster mein bacha rahega — aur agli har namespace deletion phir atkegi. Tum lakshan theek kar rahe ho, bimari nahi.' },
                { t: 'metrics-server dobara install karo', good: false, explain: 'Namespace to chhoot jayega, par tum ek aisa component wapas la rahe ho jo team ne jaan-boojh ke hataya tha. Agar metrics-server chahiye tha to alag ticket hona chahiye. Abhi ka kaam anaath APIService hataana hai.' },
                { t: 'API server restart karo', good: false, explain: 'Discovery ki halat etcd mein APIService object se aati hai, memory se nahi. Restart ke baad API server phir wahi anaath APIService padhega aur wahi fail hoga.' },
              ],
            },
            end: {
              end: true,
              text: 'Namespace 4 second mein chala gaya 🧯',
              summary: `<b>Kya hua tha:</b> teen mahine pehle kisi ne metrics-server uninstall kiya par
                <code>v1beta1.metrics.k8s.io</code> APIService object peeche chhod diya. Namespace controller
                delete karne se pehle <b>har</b> API group se poochta hai "is namespace mein tumhara koi object hai?".
                Anaath APIService ka backing Service maujood hi nahi tha, isliye discovery fail hoti rahi aur
                namespace controller ne aage badhne se mana kar diya.<br><br>
                <b>Teen seekh:</b><br>
                1️⃣ Atka hua namespace? Pehla command <code>kubectl get ns &lt;n&gt; -o yaml</code> —
                <code>status.conditions</code> mein Kubernetes khud wajah likhta hai.<br>
                2️⃣ <code>NamespaceDeletionDiscoveryFailure</code> ka matlab lagbhag hamesha ek anaath
                APIService hai. Dekho: <code>kubectl get apiservice | grep -v True</code>.<br>
                3️⃣ Finalizer zabardasti hataana <b>lakshan</b> theek karta hai. Agar wajah cluster mein
                bachi rahe, to agli namespace deletion phir atkegi.`,
            },
          },
        },
        {
          type: 'match',
          title: '🔗 Atka hua object — wajah se ilaaj milao',
          instructions: 'Har lakshan ko uske sahi pehle-kadam se jodo.',
          pairs: [
            { left: 'Pod Terminating mein hai, node NotReady hai', right: 'Node ki halat theek karo — kubelet zinda hone par pod apne aap saaf hoga', explain: 'Pod ko asli mein kubelet hi hataata hai. Node NotReady hai to kubelet ke paas khabar pahunch hi nahi rahi. Node wapas aane par pod turant chala jayega. Agar node hamesha ke liye gaya hai, tab node object delete karo — pods apne aap saaf ho jayenge.' },
            { left: 'PVC Terminating mein hai par hat nahi rahi', right: 'kubectl get pods se dekho kaunsa pod abhi bhi PVC use kar raha hai', explain: 'Finalizer <code>kubernetes.io/pvc-protection</code> jaan-boojh ke rokta hai — PVC tab tak nahi hategi jab tak koi pod usse maunted rakhe hai. Pehle pod hatao, PVC apne aap chali jayegi.' },
            { left: 'Namespace Terminating, andar kuch bhi nahi', right: 'kubectl get ns &lt;n&gt; -o yaml — status.conditions padho, phir anaath APIService dhoondo', explain: 'Namespace controller har API group se poochta hai. Ek bhi group jawab na de (aksar anaath APIService), to namespace atak jaata hai. Wajah conditions mein saaf likhi hoti hai.' },
            { left: 'Custom resource Terminating, operator ka finalizer laga hai', right: 'Operator ke pods aur logs dekho — operator zinda hai ya nahi', explain: 'Custom finalizer wahi operator hataata hai jisne lagaya tha. Operator crash ya scale-to-zero hai to koi finalizer hataane wala hai hi nahi. Operator ko zinda karo — usually 30 second mein object apne aap saaf ho jaata hai.' },
            { left: 'Naya pod ContainerCreating mein atka: "Multi-Attach error"', right: 'strategy: Recreate lagao, ya replicas 0 karke phir 1 karo', explain: 'RWO volume ek waqt par ek hi node par attach ho sakta hai. RollingUpdate naya pod pehle banata hai — naya pod doosre node par gaya to volume abhi purane node par attached hai. Recreate strategy purana pod pehle hataati hai.' },
            { left: 'Pod delete kiya, 5 minute se Terminating hai, node Ready hai', right: 'preStop hook aur terminationGracePeriodSeconds dekho', explain: 'kubelet SIGTERM bhejta hai aur grace period tak intezaar karta hai. Lamba grace period (jaise 300s) ya atka hua preStop hook pod ko Terminating mein rakhta hai. Application SIGTERM handle nahi karti to poora grace period lagta hai.' },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: atka hua namespace chhudao',
          instructions: 'Pehle conditions padho, phir asli wajah theek karo — zabardasti finalizer hataane se pehle.',
          goal: '<code>kubectl get ns</code> se Terminating namespace dekho, <code>kubectl describe ns</code> se conditions padho, phir <code>ls</code> se sahi fix chuno.',
          tasks: T_STUCK,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: 'control-plane', age: '180d', version: 'v1.30.2' }],
            pods: [],
            deployments: [],
            services: [],
            namespaces: [
              { name: 'default', status: 'Active', age: '180d' },
              { name: 'kube-system', status: 'Active', age: '180d' },
              { name: 'legacy-tools', status: 'Terminating', age: '214d' },
            ],
          },
          responses: [
            {
              re: /^(kubectl|k) get (ns|namespaces?)\b/,
              out: (s) => 'NAME           STATUS        AGE\n' + s.cluster.namespaces.filter(n => !n.gone).map(n => n.name.padEnd(15) + n.status.padEnd(14) + n.age).join('\n'),
            },
            {
              re: /^(kubectl|k) (describe (ns|namespace) \S+|get (ns|namespace) \S+ -o ?yaml)/,
              out: 'Name:         legacy-tools\nStatus:       Terminating\nConditions:\n  Type                                         Status  Reason           Message\n  ----                                         ------  ------           -------\n  NamespaceDeletionDiscoveryFailure            True    DiscoveryFailed  Discovery failed for some groups, 1 failing: unable to retrieve the complete list of server APIs: metrics.k8s.io/v1beta1: stale GroupVersion discovery: metrics.k8s.io/v1beta1\n  NamespaceDeletionContentFailure              False   ContentDeleted\n  NamespaceContentRemaining                    False   ContentRemoved\nspec:\n  finalizers:\n  - kubernetes',
            },
            {
              re: /^(kubectl|k) get apiservices?\b/,
              out: 'NAME                     SERVICE                      AVAILABLE                 AGE\nv1.                      Local                        True                      180d\nv1beta1.metrics.k8s.io   kube-system/metrics-server   False (ServiceNotFound)   180d',
            },
          ],
          files: {
            'delete-apiservice.yaml': {
              desc: 'anaath APIService v1beta1.metrics.k8s.io ko hataata hai',
              apply: s => {
                const ns = s.cluster.namespaces.find(n => n.name === 'legacy-tools');
                ns.gone = true;
                s.cluster.namespaces = s.cluster.namespaces.filter(n => !n.gone);
                return 'apiservice.apiregistration.k8s.io "v1beta1.metrics.k8s.io" deleted\n✅ Discovery theek ho gaya. Namespace controller ne 4 second mein legacy-tools hata diya.';
              },
            },
            'strip-finalizer.yaml': {
              desc: 'legacy-tools namespace ka finalizer zabardasti hataata hai',
              apply: s => {
                const ns = s.cluster.namespaces.find(n => n.name === 'legacy-tools');
                if (ns) ns.gone = true;
                s.cluster.namespaces = s.cluster.namespaces.filter(n => !n.gone);
                return 'namespace/legacy-tools finalized\n⚠️ Namespace to chala gaya, par anaath APIService v1beta1.metrics.k8s.io abhi bhi cluster mein hai. Agli har namespace deletion phir atkegi — tumne lakshan theek kiya, bimari nahi.';
              },
            },
          },
          success: allOf(T_STUCK),
          successText: 'Do raaste dono namespace hata dete hain, par ek hi asli fix hai. <b>delete-apiservice.yaml</b> ne wajah hataayi — anaath APIService jiska backing Service teen mahine pehle uninstall ho chuka tha. <b>strip-finalizer.yaml</b> ne sirf is ek namespace ko chhuda diya aur bimari cluster mein chhod di. Yaad rakho: <code>NamespaceDeletionDiscoveryFailure</code> ka matlab lagbhag hamesha ek anaath APIService hota hai — <code>kubectl get apiservice | grep -v True</code>.',
          hints: [
            'kubectl get ns — legacy-tools Terminating mein hai',
            'kubectl describe ns legacy-tools — Conditions padho, Kubernetes khud wajah likhta hai',
            'kubectl get apiservices — AVAILABLE False wali dhoondo',
            'ls chalao — delete-apiservice.yaml asli fix hai',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Ek StatefulSet ka pod Terminating mein atka hai kyunki node down hai. Kya <code>--force --grace-period=0</code> chalana theek hai?"',
            choices: [
              'Nahi — jab tak yeh pakka na ho ki node par process sach mein mar chuka hai. Force delete etcd se pod hataata hai, container zinda reh sakta hai — phir wahi naam ka naya pod usi volume par likhega',
              'Haan, StatefulSet pods ke liye force delete surakshit hai',
              'Haan, agar node 5 minute se NotReady hai',
              'Nahi — StatefulSet pods force delete ho hi nahi sakte',
            ],
            answer: 0,
            explain: 'StatefulSet ka poora vaada "ek waqt par ek hi pod, ek hi pehchaan" ka hai. Force delete Kubernetes ko yakeen dila deta hai ki purana pod mar chuka hai, jabki node network se katta hua ho sakta hai aur container waise ka waisa chal raha ho. Naya pod usi naam aur usi PVC ke saath uthta hai, aur <b>do writers ek hi volume par</b> — data corruption. Sahi tarika: node ko sach mein band karo (cloud console se), ya node object delete karo (jo saaf batata hai ki node gaya), tab pods surakshit tarike se saaf hote hain.',
          },
          {
            q: 'Interviewer: "Single-replica Deployment jo RWO PVC use karti hai — har deploy par naya pod Multi-Attach error deta hai. Sabse saaf fix?"',
            choices: [
              'strategy: Recreate lagao — purana pod poori tarah hatta hai, volume detach hota hai, tab naya pod banta hai',
              'maxSurge 200% kar do',
              'PVC ka access mode ReadWriteMany kar do',
              'terminationGracePeriodSeconds 0 kar do',
            ],
            answer: 0,
            explain: 'Default <code>RollingUpdate</code> naya pod <b>pehle</b> banata hai. Naya pod doosre node par gaya to naya pod woh volume maangta hai jo abhi purane node par attached hai. <code>Recreate</code> kram ulta kar deta hai. <b>maxSurge badhana ulta bura hai</b> — aur zyada pods ek saath volume maangenge. <b>Access mode badalna kaam nahi karega</b> agar underlying storage RWX support hi nahi karta (EBS, GCE PD RWO hi hain) — aur agar kar bhi de, to do writers ek hi filesystem par, jo aksar khatarnak hai. Multi-replica stateful chahiye to sahi jawab <b>StatefulSet + per-pod PVC</b> hai.',
          },
        ],
      },
      success: [
        'Main jaanta hoon ki delete sirf deletionTimestamp lagata hai; object finalizers khaali hone par hatta hai',
        'Main finalizer zabardasti hataane se pehle wajah dhoondhta hoon',
        'Main jaanta hoon ki --force --grace-period=0 StatefulSet ke saath data corruption kar sakta hai',
        'Main Multi-Attach error par RWO + RollingUpdate ka takraav pehchan leta hoon',
      ],
      homework: `<p>Finalizer ka behaviour khud dekho:</p>
        <pre>kubectl create ns findemo
kubectl create cm stuck -n findemo --from-literal=a=b
kubectl patch cm stuck -n findemo -p '{"metadata":{"finalizers":["demo.io/hold"]}}' --type=merge

kubectl delete cm stuck -n findemo &     # atak jayega
kubectl get cm stuck -n findemo -o jsonpath='{.metadata.deletionTimestamp}{"\\n"}'
kubectl get cm stuck -n findemo -o jsonpath='{.metadata.finalizers}{"\\n"}'

kubectl patch cm stuck -n findemo -p '{"metadata":{"finalizers":null}}' --type=merge
kubectl get cm -n findemo                # turant gayab
kubectl delete ns findemo</pre>
        <p>Aur cluster ki sehat check karo: <code>kubectl get apiservice | grep -v True</code> —
        agar koi anaath APIService dikhe, to agli namespace deletion wahin atkegi.</p>`,
      cards: [
        { front: '<code>kubectl delete</code> asli mein karta kya hai?', back: 'Sirf <code>metadata.deletionTimestamp</code> set karta hai. Object tabhi hatta hai jab <code>metadata.finalizers</code> list khaali ho jaye. Har finalizer kisi controller ka taala hai.' },
        { front: 'Namespace Terminating mein atka — pehla command?', back: '<code>kubectl get ns &lt;n&gt; -o yaml</code> aur <code>status.conditions</code> padho. <code>NamespaceDeletionDiscoveryFailure</code> ka matlab lagbhag hamesha anaath APIService — <code>kubectl get apiservice | grep -v True</code>.' },
        { front: '<code>--force --grace-period=0</code> ka khatra?', back: 'Pod etcd se mit jaata hai par node par container zinda reh sakta hai. StatefulSet mein usi naam ka naya pod usi volume par likhega — <b>data corruption</b>. Pehle confirm karo ki process sach mein mar chuka hai.' },
        { front: 'Multi-Attach volume error kyun aata hai?', back: 'RWO volume ek waqt par ek hi <b>node</b> par attach ho sakta hai, aur default RollingUpdate naya pod pehle banata hai. Naya pod doosre node par gaya to volume abhi purane node par hai. Fix: <code>strategy: Recreate</code>.' },
        { front: 'PVC Terminating mein atki hai — kya dekhein?', back: 'Finalizer <code>kubernetes.io/pvc-protection</code> jaan-boojh ke rok raha hai. Koi pod abhi bhi PVC mount kiye hue hai. Pehle us pod ko hatao, PVC apne aap chali jayegi.' },
      ],
    },

    /* ============================================================
       10. Networking deep dive
       ============================================================ */
    {
      id: 'kk-netdeep',
      icon: '🌐',
      title: 'Packet ka safar — CNI se kube-proxy se CoreDNS tak',
      badge: 'Packet Pathik',
      objectives: [
        'Ek curl ke poore raste ke har padav ka naam bata pana',
        'CoreDNS ka search-domain vyavhaar aur `ndots:5` ka asar samajhna',
        'kube-proxy ke iptables aur IPVS mode mein farq jaanna',
        'DNS ki gadbad, endpoint ki gadbad aur NetworkPolicy ki gadbad ko alag pehchanna',
      ],
      lesson: [
        `<h3>🌐 <code>curl http://payments</code> ke peeche kya-kya hota hai</h3>
         <ol>
           <li><b>DNS:</b> application <code>payments</code> resolve karti hai. Pod ka
           <code>/etc/resolv.conf</code> CoreDNS ke ClusterIP par ishara karta hai aur
           <code>search</code> domains ki list deta hai.</li>
           <li><b>CoreDNS</b> jawab mein Service ka <b>ClusterIP</b> deta hai (jaise <code>10.96.44.12</code>) —
           pod ka IP nahi.</li>
           <li><b>ClusterIP ek nakli IP hai.</b> Us IP par koi machine, koi interface, koi process nahi hai.
           ClusterIP sirf node ke <b>iptables/IPVS rules</b> mein maujood hai.</li>
           <li><b>kube-proxy</b> ne pehle se rules likh rakhe hain: "jo bhi packet 10.96.44.12:80 par jaye,
           usse DNAT karke in pod IPs mein se kisi ek par bhej do".</li>
           <li><b>CNI plugin</b> (Calico/Cilium/Flannel) packet ko us pod tak pahunchata hai, chahe pod
           doosre node par ho.</li>
           <li><b>NetworkPolicy</b> (agar lagi ho) CNI ke level par packet ko allow ya drop karti hai.</li>
         </ol>
         <p><b>Sabse zaroori nateeja:</b> "Service down hai" jaisi koi cheez hoti hi nahi. Service ek
         iptables rule hai. Jo cheez toot sakti hai woh hai: DNS ka jawab, endpoints ki list, ya packet ka raasta.</p>`,

        `<h3>🔎 DNS ka search domain aur <code>ndots:5</code></h3>
         <p>Har pod ka <code>/etc/resolv.conf</code> aisa dikhta hai:</p>
         <pre>nameserver 10.96.0.10
search shop.svc.cluster.local svc.cluster.local cluster.local
options ndots:5</pre>
         <p><code>ndots:5</code> ka matlab: agar naam mein <b>5 se kam</b> dot hain, to resolver pehle
         search domains lagaega, aur poora naam sabse aakhir mein aazmaega.</p>
         <table class="kk-tbl">
           <tr><th>Naam</th><th>Kitni DNS queries</th><th>Kyun</th></tr>
           <tr><td><code>payments</code></td><td>4 queries</td><td>payments.shop.svc… → payments.svc… → payments.cluster.local → payments (pehli hi mil jaati hai, isliye tez)</td></tr>
           <tr><td><code>payments.shop.svc.cluster.local.</code></td><td>1 query</td><td>Trailing dot = FQDN, resolver search bilkul nahi lagata — sabse tez</td></tr>
           <tr><td><code>api.github.com</code></td><td><b>4 queries</b></td><td>Sirf 2 dot hain (ndots 5 se kam), isliye teen search domains pehle aazmaye jaate hain aur teeno NXDOMAIN dete hain</td></tr>
         </table>
         <p><b>Isliye bahari API calls dhime lagte hain:</b> har external call se pehle 3 bekaar DNS
         queries jaati hain. Ilaaj: bahari naam ke aakhir mein dot lagao
         (<code>api.github.com.</code>), ya pod par <code>dnsConfig: { options: [{name: ndots, value: "2"}] }</code>.</p>

         <h3>⚖️ kube-proxy: iptables vs IPVS</h3>
         <table class="kk-tbl">
           <tr><th></th><th>iptables mode (default)</th><th>IPVS mode</th></tr>
           <tr><td>Rule dhoondhna</td><td>Chain mein ek-ek karke — O(n)</td><td>Hash table — O(1)</td></tr>
           <tr><td>Load balancing</td><td>Sirf random (probability-based)</td><td>rr, lc, sh, dh aur kai algorithms</td></tr>
           <tr><td>Bade cluster mein</td><td>5000+ services par rule update slow ho jaata hai</td><td>Bade cluster ke liye behtar</td></tr>
           <tr><td>Debug</td><td><code>iptables-save | grep &lt;clusterIP&gt;</code></td><td><code>ipvsadm -Ln</code></td></tr>
         </table>
         <div class="war-story"><b>⚡ Dono modes mein ek hi kami:</b> kube-proxy connection ko
         <b>ek baar</b> route karta hai. Long-lived connections (gRPC, HTTP/2 keep-alive, database
         pools) ek hi pod se chipak jaate hain. Naye replicas add karne par purane connections
         nahi baantte — naye pods khaali baithe rehte hain aur purane pods par load waise ka waisa
         rehta hai. Isi ke liye service mesh (Istio/Linkerd) ya client-side L7 balancing chahiye hoti hai.</div>`,
      ],
      stages: [
        {
          type: 'flow',
          title: '🎬 Flow: `curl http://payments` — poora raasta, ek-ek kadam',
          instructions: '▶ dabao. Har kadam par kaun kaam kar raha hai (application, CoreDNS, kube-proxy, CNI) — lane se dikhega. Teen sawal beech mein aayenge.',
          lanes: [
            { id: 'app', label: 'App container', icon: '🏃' },
            { id: 'dns', label: 'CoreDNS', icon: '📖' },
            { id: 'proxy', label: 'kube-proxy rules', icon: '⚖️' },
            { id: 'cni', label: 'CNI (Calico)', icon: '🕸️' },
            { id: 'dest', label: 'Destination pod', icon: '🎯' },
          ],
          steps: [
            { lane: 'app', t: 'Application ne curl http://payments chalaya', detail: 'Container ke andar ki application ne hostname <code>payments</code> resolve karne ko kaha. Container ka <code>/etc/resolv.conf</code> kubelet ne banaya tha aur usme CoreDNS ka ClusterIP <code>10.96.0.10</code> likha hai.' },
            { lane: 'dns', t: 'Resolver ne search domains lagaye', detail: '<code>ndots:5</code> aur naam <code>payments</code> mein 0 dot hain, isliye resolver pehle search domains aazmata hai:<br>1. <code>payments.shop.svc.cluster.local</code> ← <b>mil gaya</b><br>2. payments.svc.cluster.local<br>3. payments.cluster.local<br>4. payments',
              ask: { q: 'Application <code>api.github.com</code> call kar rahi hai aur latency zyada hai. Kitni DNS queries jaayengi?', choices: ['4 — kyunki api.github.com mein sirf 2 dot hain (ndots:5 se kam), isliye teen search domains pehle aazmaye jaate hain aur teeno NXDOMAIN dete hain', '1 — kyunki naam poora hai', '2 — ek IPv4 ke liye, ek IPv6 ke liye', '0 — bahari naam CoreDNS se hoke nahi jaate'], answer: 0, explain: '<code>ndots:5</code> ka niyam: naam mein 5 se kam dot hain to search domains <b>pehle</b> lagenge. <code>api.github.com</code> mein 2 dot hain, isliye pehle teen bekaar queries jaati hain (<code>api.github.com.shop.svc.cluster.local</code>, waghera), teeno NXDOMAIN deti hain, aur chauthi baar asli naam try hota hai. Ilaaj: aakhir mein dot lagao — <code>api.github.com.</code> — ya pod par <code>dnsConfig</code> se ndots ghata do.' } },
            { lane: 'dns', t: 'CoreDNS ne Service ka ClusterIP diya: 10.96.44.12', detail: 'Gaur karo: CoreDNS ne <b>pod ka IP nahi</b> diya. CoreDNS ne <b>Service ka ClusterIP</b> diya. ClusterIP poore cluster ke liye ek sthir pata hai jo pods ke aane-jaane par nahi badalta.' },
            { lane: 'app', t: 'Application ne 10.96.44.12:80 par TCP connection khola', detail: 'Packet container ke network namespace se nikal ke node ke network stack mein pahuncha.',
              ask: { q: '<code>10.96.44.12</code> par asli mein kaun sun raha hai?', choices: ['Koi nahi — ClusterIP ek nakli IP hai jo sirf node ke iptables/IPVS rules mein maujood hai', 'Service ka apna proxy pod', 'kube-proxy 10.96.44.12 par listen karta hai', 'Node ka ek virtual interface'], answer: 0, explain: 'ClusterIP kisi machine ko assign nahi hota. ClusterIP ke liye koi interface, koi process, koi ARP entry nahi hoti. ClusterIP sirf ek <b>DNAT target</b> hai jo kube-proxy ne iptables (ya IPVS) rules mein likha hai. Isliye ClusterIP ko ping karna kabhi kaam nahi karta — aur usse "service down" mat samajh lena. Aur isliye "Service down hai" jaisi cheez hoti hi nahi: toot sakta hai to DNS, endpoints, ya raasta.' } },
            { lane: 'proxy', t: 'iptables ne DNAT kiya — destination IP badal gayi', detail: 'kube-proxy ne pehle se rules likh rakhe the:<br><code>-A KUBE-SERVICES -d 10.96.44.12/32 -p tcp --dport 80 -j KUBE-SVC-XYZ</code><br><code>-A KUBE-SVC-XYZ -m statistic --probability 0.5 -j KUBE-SEP-A</code><br><code>-A KUBE-SEP-A -j DNAT --to-destination 10.244.2.31:8080</code><br>Destination ab <b>10.244.2.31:8080</b> hai — ek asli pod ka IP.' },
            { lane: 'cni', t: 'CNI plugin ne packet doosre node tak pahunchaya', detail: 'Destination pod node-3 par hai. Calico ne packet ko node-3 tak bheja (BGP route ya VXLAN tunnel se, installation ke hisaab se). Yahi padav MTU aur overlay ki gadbadiyon mein toot-ta hai — aur uska lakshan hota hai: chhote request chalte hain, bade request atak jaate hain.',
              ask: { q: 'Endpoints bhare hue hain, DNS sahi resolve ho raha hai, par connection <b>timeout</b> ho raha hai (connection refused nahi). Sabse aam wajah?', choices: ['NetworkPolicy traffic drop kar rahi hai — drop hone par packet ka koi jawab hi nahi aata, isliye timeout hota hai', 'targetPort galat hai', 'Pod CrashLoopBackOff mein hai', 'CoreDNS down hai'], answer: 0, explain: '<b>Refused aur timeout ka farq yaad rakho.</b> <code>Connection refused</code> ka matlab packet pahunch gaya aur kisi ne TCP RST bheja — yaani us port par koi sun nahi raha (aksar galat <code>targetPort</code>). <code>Timeout</code> ka matlab packet ka koi jawab hi nahi aaya — packet chup-chaap gira diya gaya. NetworkPolicy drop hi karti hai, reject nahi. Isliye timeout par pehle NetworkPolicy dekho: <code>kubectl get netpol -n &lt;ns&gt;</code>. Yaad rakho: namespace mein ek bhi NetworkPolicy lagte hi us namespace ke selected pods "default deny" ho jaate hain.' } },
            { lane: 'dest', t: 'Destination pod ne request receive kiya', detail: 'Application ne 8080 par request paya. Application ko dikhne wala source IP client pod ka asli IP hai (kyunki ClusterIP traffic ke liye SNAT nahi hota). NodePort ke through aane par source IP node ka IP ban sakta hai — isse rokne ke liye <code>externalTrafficPolicy: Local</code> hota hai.' },
          ],
          summary: '✅ Chaar alag component, chaar alag failure. <b>DNS</b> galat naam ya CoreDNS down → "name or service not known". <b>Endpoints</b> khaali → 503 ya "no route". <b>targetPort</b> galat → connection <b>refused</b>. <b>NetworkPolicy</b> ya CNI → connection <b>timeout</b>. Error ka type hi bata deta hai ki kaunsa padav toota.',
        },
        {
          type: 'triage',
          title: '🩺 Triage: "orders pod payments tak nahi pahunch paa raha"',
          instructions: 'Har padav ko alag-alag test karo: DNS → endpoints → port → policy.',
          symptom: `<b>Report:</b> <code>orders</code> pod se <code>payments</code> service call karne par
            error aa raha hai. <code>payments</code> ke pods 3/3 Running hain aur unke logs saaf hain.<br>
            Namespace: <code>shop</code>.`,
          commands: [
            {
              cmd: 'kubectl get pods,svc,endpoints -n shop',
              clue: true,
              out: `NAME                            READY   STATUS    RESTARTS   AGE
pod/orders-7d8c9b6a5-aa1bb      1/1     Running   0          2d
pod/payments-6c5b4a3d2-cc2dd    1/1     Running   0          2d
pod/payments-6c5b4a3d2-ee3ff    1/1     Running   0          2d
pod/payments-6c5b4a3d2-gg4hh    1/1     Running   0          2d

NAME                TYPE        CLUSTER-IP     PORT(S)   AGE
service/payments    ClusterIP   10.96.44.12    80/TCP    2d

NAME                  ENDPOINTS                                             AGE
endpoints/payments    10.244.2.31:8080,10.244.2.32:8080,10.244.3.19:8080    2d`,
              note: 'Endpoints bhare hue hain — teeno payment pods ke IP maujood hain. Matlab Service ka selector theek hai aur teeno pods readiness pass kar rahe hain. Masla Service object ka nahi hai.',
            },
            {
              cmd: 'kubectl exec -n shop orders-7d8c9b6a5-aa1bb -- nslookup payments',
              clue: true,
              out: `Server:    10.96.0.10
Address:   10.96.0.10#53

Name:      payments.shop.svc.cluster.local
Address:   10.96.44.12`,
              note: 'DNS bilkul theek hai. CoreDNS ne sahi ClusterIP <code>10.96.44.12</code> diya, jo <code>kubectl get svc</code> ke ClusterIP se match karta hai. DNS wala padav paar.',
            },
            {
              cmd: 'kubectl exec -n shop orders-7d8c9b6a5-aa1bb -- curl -sS -m 5 http://payments',
              clue: true,
              out: `curl: (28) Connection timed out after 5001 milliseconds
command terminated with exit code 28`,
              note: '<b>Timeout</b> — "connection refused" nahi. Yeh farq bahut bada hai. Refused hota to packet pahunch jaata aur koi TCP RST bhejta (yaani port galat). Timeout ka matlab packet ka <b>koi jawab hi nahi aaya</b> — packet kahin chup-chaap gira diya gaya.',
            },
            {
              cmd: 'kubectl exec -n shop orders-7d8c9b6a5-aa1bb -- curl -sS -m 5 http://10.244.2.31:8080',
              clue: true,
              out: `curl: (28) Connection timed out after 5002 milliseconds
command terminated with exit code 28`,
              note: 'Seedha pod ke IP par bhi timeout. Toh masla Service ya kube-proxy ke DNAT ka nahi hai — packet pod tak pahunch hi nahi paa raha. Ab shaq NetworkPolicy ya CNI par jaata hai.',
            },
            {
              cmd: 'kubectl get networkpolicy -n shop',
              clue: true,
              out: `NAME                   POD-SELECTOR       AGE
payments-allow-web     app=payments       3h`,
              note: 'Ek NetworkPolicy hai, aur woh <code>app=payments</code> wale pods par lagi hai. Teen ghante purani hai — aur bug bhi kareeb teen ghante purana hai.',
            },
            {
              cmd: 'kubectl describe networkpolicy payments-allow-web -n shop',
              clue: true,
              out: `Name:         payments-allow-web
Namespace:    shop
Spec:
  PodSelector:     app=payments
  Allowing ingress traffic:
    To Port: 8080/TCP
    From:
      PodSelector: app=web
  Policy Types: Ingress`,
              note: '<b>Yahan hai jawab.</b> Policy sirf <code>app=web</code> wale pods se traffic allow karti hai. <code>orders</code> pod par label <code>app=orders</code> hai, <code>app=web</code> nahi. Aur zaroori baat: namespace mein ek bhi NetworkPolicy lagte hi selected pods <b>default deny</b> ho jaate hain — jo allow list mein nahi, woh drop.',
            },
            {
              cmd: 'kubectl logs -n shop payments-6c5b4a3d2-cc2dd --tail=3',
              clue: false,
              out: `{"level":"info","msg":"payments listening on :8080"}
{"level":"info","msg":"handled POST /charge from 10.244.1.8","ms":22}
{"level":"info","msg":"handled POST /charge from 10.244.1.8","ms":19}`,
              note: 'Dead end — par bahut kuch batata hai. payments pod bilkul theek hai aur request handle kar raha hai... par sirf <code>10.244.1.8</code> se, jo web pod ka IP hai. orders ki ek bhi request logs mein nahi hai, kyunki orders ki request pod tak pahunchi hi nahi.',
            },
          ],
          questions: [
            {
              q: 'Error "connection timed out" hai, "connection refused" nahi. Yeh farq kya batata hai?',
              choices: [
                'Timeout = packet chup-chaap gira diya gaya (NetworkPolicy ya CNI). Refused = packet pahunch gaya par us port par koi sun nahi raha (galat targetPort)',
                'Dono ka matlab ek hi hai, bas curl ke version ka farq hai',
                'Timeout = pod busy hai. Refused = pod down hai',
                'Timeout = DNS fail. Refused = DNS theek par IP galat',
              ],
              answer: 0,
              explain: 'TCP ke do alag jawab hain. <b>RST (refused)</b> tab aata hai jab packet host tak pahunch jaye par us port par koi listener na ho — yaani raasta theek hai, port galat hai (aksar <code>targetPort</code> ki galti). <b>Timeout</b> tab aata hai jab koi jawab hi na aaye — packet drop ho gaya. NetworkPolicy <b>drop</b> karti hai, reject nahi, isliye NetworkPolicy ka lakshan hamesha timeout hota hai. <b>Sabse pehla sawal jo troubleshooting mein poochna chahiye: refused ya timeout?</b>',
            },
            {
              q: 'orders ko payments tak pahunchane ka sabse surakshit fix kya hai?',
              choices: [
                'NetworkPolicy ke ingress from list mein podSelector app=orders jodo — yaani jo chahiye sirf woh khol do',
                'NetworkPolicy delete kar do',
                'orders pod ka label badal ke app=web kar do',
                'payments Service ko NodePort bana do',
              ],
              answer: 0,
              explain: 'Policy ka kaam hi yahi hai — allow-list rakhna. Sahi fix hai <code>app=orders</code> ko allow list mein jodna. <b>Policy delete karna</b> poore payments service ko har pod ke liye khol dega, jo security ka nuksaan hai. <b>orders ka label badalna sabse bura hai</b> — us label par orders ki apni Service, uski Deployment ka selector, aur monitoring sab tikay hain; ek label badalne se teen cheezein toot sakti hain. NodePort banane se NetworkPolicy hategi hi nahi (policy pod par lagi hai, Service par nahi).',
            },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: DNS toota hai ya endpoints?',
          instructions: 'Ek hi lakshan, do alag wajah ho sakti hain. Alag-alag test karo, phir sahi fix chuno.',
          goal: '<code>kubectl get svc,endpoints</code> se endpoints dekho, <code>kubectl exec &lt;pod&gt; -- nslookup &lt;svc&gt;</code> se DNS test karo, phir <code>ls</code> se sahi fix lagao.',
          tasks: T_DNS,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '15d', version: 'v1.30.2' }],
            pods: [
              { name: 'frontend-5d6c7b8a9-aa1bb', ready: '1/1', status: 'Running', restarts: 0, age: '15d', node: 'node-1', ip: '10.244.1.8', dnsOk: false,
                logs: 'Error: getaddrinfo ENOTFOUND backend-svc.shop.svc.cluster.local',
                exec: {
                  'nslookup backend-svc': 'Server:    10.96.0.10\nAddress:   10.96.0.10#53\n\n** server can\'t find backend-svc.shop.svc.cluster.local: NXDOMAIN\n\n⚠️ CoreDNS ne kaha ki aisa koi naam hai hi nahi.',
                  'nslookup backend': 'Server:    10.96.0.10\nAddress:   10.96.0.10#53\n\nName:      backend.shop.svc.cluster.local\nAddress:   10.96.77.9\n\n✅ Service ka asli naam "backend" hai, "backend-svc" nahi.',
                  'cat /etc/resolv.conf': 'nameserver 10.96.0.10\nsearch shop.svc.cluster.local svc.cluster.local cluster.local\noptions ndots:5',
                } },
            ],
            deployments: [
              { name: 'frontend', ready: '1/1', upToDate: 1, available: 1, age: '15d' },
              { name: 'backend', ready: '2/2', upToDate: 2, available: 2, age: '15d' },
            ],
            services: [{ name: 'backend', type: 'ClusterIP', clusterIP: '10.96.77.9', ports: '80/TCP', age: '15d' }],
            endpoints: [{ name: 'backend', endpoints: '10.244.1.21:8080,10.244.1.22:8080', age: '15d' }],
          },
          files: {
            'fix-hostname.yaml': {
              desc: 'frontend ka BACKEND_URL http://backend-svc se http://backend karta hai',
              apply: s => {
                const p = s.cluster.pods[0];
                p.dnsOk = true;
                p.logs = '{"msg":"frontend started"}\n{"msg":"GET http://backend/health -> 200"}';
                return 'deployment.apps/frontend configured\n✅ Service ka asli naam "backend" hai. Naam theek karte hi frontend ne backend se baat kar li.';
              },
            },
            'rename-service.yaml': {
              desc: 'Service ka naam backend se backend-svc karta hai',
              apply: s => {
                const p = s.cluster.pods[0];
                p.dnsOk = true;
                p.logs = '{"msg":"frontend started"}\n{"msg":"GET http://backend-svc/health -> 200"}';
                s.cluster.services[0].name = 'backend-svc';
                s.cluster.endpoints[0].name = 'backend-svc';
                return 'service/backend-svc created, service "backend" deleted\n✅ Kaam kar gaya — par dhyaan rakho: Service ka naam badalne se har doosri application bhi tootegi jo purane naam "backend" par call kar rahi thi.';
              },
            },
            'restart-coredns.yaml': {
              desc: 'CoreDNS deployment ko restart karta hai',
              apply: () => 'deployment.apps/coredns restarted\n\n⚠️ Kuch nahi badla. CoreDNS bilkul theek chal raha tha — nslookup backend sahi jawab de raha tha (10.96.77.9). Sirf backend-svc naam ka koi Service hai hi nahi. CoreDNS ka NXDOMAIN sach bol raha tha.',
            },
          },
          success: allOf(T_DNS),
          successText: 'CoreDNS ne <b>sach</b> bola tha: <code>backend-svc</code> naam ka koi Service hai hi nahi. NXDOMAIN ka matlab "DNS toota hai" nahi hota — NXDOMAIN ka matlab "aisa naam maujood nahi" hota. <b>Do alag test hamesha alag chalao:</b> <code>nslookup &lt;galat-naam&gt;</code> aur <code>nslookup &lt;sahi-naam&gt;</code>. Agar sahi naam resolve ho jaye, to CoreDNS bilkul theek hai aur galti application ke config mein hai. CoreDNS restart karna aam "cargo cult" fix hai jo yahan kuch nahi karta.',
          hints: [
            'kubectl get svc,endpoints — Service ka asli naam kya hai?',
            'kubectl exec frontend-5d6c7b8a9-aa1bb -- nslookup backend-svc — NXDOMAIN milega',
            'Ab sahi naam try karo: kubectl exec frontend-5d6c7b8a9-aa1bb -- nslookup backend',
            'ls chalao — fix-hostname.yaml sabse chhota aur surakshit fix hai',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Pod se ClusterIP ping karne par jawab nahi aata. Kya Service down hai?"',
            choices: [
              'Nahi — ClusterIP ping ka jawab deta hi nahi. ClusterIP kisi interface par nahi hota, sirf iptables/IPVS ka DNAT target hai. Test karna hai to TCP se karo (curl/nc), ping se nahi',
              'Haan, ping fail hone ka matlab Service down hai',
              'Haan, kube-proxy crash ho gaya hoga',
              'Nahi — ping ke liye ICMP NetworkPolicy chahiye hoti hai',
            ],
            answer: 0,
            explain: 'ClusterIP ek <b>nakli</b> IP hai. Us IP par koi machine, koi interface, koi ARP entry nahi hoti. iptables rules sirf us <b>TCP/UDP port</b> ke packets ko DNAT karte hain jo Service ne declare kiya hai — ICMP (ping) ka koi rule hai hi nahi, isliye ping hamesha silently gir jaata hai, chahe Service bilkul swasth ho. Sahi test: <code>curl http://&lt;clusterIP&gt;:&lt;port&gt;</code> ya <code>nc -zv &lt;clusterIP&gt; &lt;port&gt;</code>.',
          },
          {
            q: 'Interviewer: "Naye replicas add kiye par purane pods par load ghata hi nahi. gRPC use kar rahe hain. Kyun?"',
            choices: [
              'kube-proxy connection ko sirf EK BAAR route karta hai — gRPC ek hi TCP connection par chalta rehta hai, isliye purane connections naye pods par nahi jaate',
              'Readiness probe ne naye pods ko endpoints mein add nahi kiya',
              'HPA ne abhi scale nahi kiya',
              'DNS ne naye pod IPs cache kar rakhe hain',
            ],
            answer: 0,
            explain: 'kube-proxy <b>connection-level</b> load balancing karta hai, request-level nahi. Naya TCP connection banega tabhi naya pod chun-a jayega. gRPC, HTTP/2 keep-alive aur database pools ek hi connection ko ghanton zinda rakhte hain, isliye woh apne pehle chune hue pod se chipke rehte hain. <b>Teen ilaaj:</b> <b>(1)</b> service mesh (Istio/Linkerd) jo L7 par har request balance karta hai; <b>(2)</b> client-side balancing — headless Service (<code>clusterIP: None</code>) se saare pod IP lo aur gRPC ke round-robin resolver ko do; <b>(3)</b> client par connection ki max age set karo taaki connections samay-samay par naye bante rahein.',
          },
        ],
      },
      success: [
        'Main ek curl ke poore raste ke saare padav naam se bata sakta hoon',
        'Main "connection refused" (port galat) aur "timeout" (packet drop) mein turant farq karta hoon',
        'Main jaanta hoon ki ClusterIP ping ka jawab nahi deta aur kyun',
        'Main ndots:5 ki wajah se bahari calls par lagne wali extra DNS queries samajhta hoon',
      ],
      homework: `<p>Poora raasta apne cluster par kholo:</p>
        <pre>kubectl run probe --image=nicolaka/netshoot -it --rm -- bash

# andar se:
cat /etc/resolv.conf                     # search domains + ndots
nslookup kubernetes.default              # ClusterIP milega
dig +search +short kubernetes.default    # search kaise lagta hai dekho
nc -zv kubernetes.default 443            # TCP test (ping nahi)
ping -c2 10.96.0.1                       # jawab NAHI aayega — normal hai!</pre>
        <p>Aur node par kube-proxy ke asli rules dekho:</p>
        <pre>kubectl get svc kubernetes -o jsonpath='{.spec.clusterIP}{"\\n"}'
# node par (ya kubectl debug node/&lt;node&gt; se):
sudo iptables-save | grep &lt;clusterIP&gt;</pre>`,
      cards: [
        { front: 'ClusterIP par asli mein kaun sun raha hai?', back: '<b>Koi nahi.</b> ClusterIP kisi interface par nahi hota — ClusterIP sirf kube-proxy ke iptables/IPVS DNAT rules mein maujood hai. Isliye ping kabhi jawab nahi deta; test TCP se karo.' },
        { front: '"Connection refused" vs "connection timed out"?', back: '<b>Refused</b> = packet pahunch gaya, port par koi sun nahi raha (aksar galat targetPort). <b>Timeout</b> = packet chup-chaap gira (NetworkPolicy ya CNI). Sabse pehla sawal yahi poochna chahiye.' },
        { front: '<code>ndots:5</code> ka asar kya hai?', back: '5 se kam dot wale naam par pehle search domains lagte hain. <code>api.github.com</code> = 4 DNS queries (3 bekaar). Ilaaj: naam ke aakhir mein dot (<code>api.github.com.</code>) ya pod par dnsConfig se ndots ghatao.' },
        { front: 'kube-proxy iptables vs IPVS?', back: '<b>iptables</b>: rule lookup O(n), sirf random balancing, 5000+ services par slow. <b>IPVS</b>: hash table O(1), kai algorithms (rr/lc/sh), bade cluster ke liye behtar. Dono connection-level hain.' },
        { front: 'gRPC ke saath naye replicas par load kyun nahi jaata?', back: 'kube-proxy connection ko ek baar route karta hai. Long-lived gRPC/HTTP2 connections apne pehle chune pod se chipke rehte hain. Ilaaj: service mesh, headless Service + client-side balancing, ya connection max-age.' },
      ],
    },
  ]);
})();

/* =====================================================================
   CHUNK 4 — Cluster ops, certificates, hardening, Boss (levels 11-14)
   ===================================================================== */
(function () {
  const allOf = KG.allOf;

  /* ---- drain + PDB ka cost model (slider lab isse chalata hai) ---- */
  const perNode = (replicas, nodes) => Math.ceil(replicas / nodes);
  const allowedDisruptions = (replicas, minAvail) => Math.max(0, replicas - minAvail);
  const drainWaves = (replicas, nodes, minAvail) => {
    const a = allowedDisruptions(replicas, minAvail);
    return a <= 0 ? Infinity : Math.ceil(perNode(replicas, nodes) / a);
  };
  const drainSeconds = (replicas, nodes, minAvail, readySec) => {
    const w = drainWaves(replicas, nodes, minAvail);
    return w === Infinity ? Infinity : w * readySec;
  };

  const T_ETCD = [
    { text: 'Control plane pods ka haal dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
    { text: 'etcd snapshot ka status padho', check: s => s.history.some(h => /etcdctl.*snapshot status/.test(h)) },
    { text: 'Snapshot restore karo', check: s => s.history.some(h => /etcdctl.*snapshot restore/.test(h)) },
    { text: 'Cluster wapas swasth karo', check: s => s.cluster.pods.every(p => p.status === 'Running') && s.cluster.restored === true },
  ];

  const T_CERT = [
    { text: 'Certificates ki expiry check karo', check: s => s.history.some(h => /kubeadm certs check-expiration/.test(h)) },
    { text: 'Certificates renew karo', check: s => s.history.some(h => /kubeadm certs renew/.test(h)) },
    { text: 'Naya admin kubeconfig lo aur cluster tak pahuncho', check: s => s.cluster.apiReachable === true },
  ];

  const T_HARDEN = [
    { text: 'Pod ka securityContext dekho', check: s => s.history.some(h => /^(kubectl|k) (describe (pod|po)|get (pod|po) \S+ -o ?yaml)/.test(h)) },
    { text: 'Namespace ke PodSecurity labels dekho', check: s => s.history.some(h => /^(kubectl|k) get (ns|namespace)\b.*--show-labels/.test(h)) },
    { text: 'Pod ko hardened spec ke saath chalao', check: s => s.cluster.pods.every(p => p.status === 'Running' && p.hardened === true) },
  ];

  const T_BOSS = [
    { text: 'Poore namespace ka haal ek nazar mein dekho', check: s => s.history.some(h => /^(kubectl|k) get (all|pods|po)\b/.test(h)) },
    { text: 'Pending pod ki wajah padho', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S*checkout/.test(h)) },
    { text: 'CrashLoop pod ke previous logs padho', check: s => s.history.some(h => /^(kubectl|k) logs \S+.*--previous/.test(h)) },
    { text: 'Endpoints se selector ki gadbad pakdo', check: s => s.history.some(h => /^(kubectl|k) get .*(endpoints|ep)\b/.test(h)) },
    { text: 'Teeno bimariyan theek karo — saare pods Running aur endpoints sahi', check: s => s.cluster.pods.length > 0 && s.cluster.pods.every(p => p.status === 'Running') && s.cluster.endpoints.every(e => e.fixed === true) },
  ];

  KG.registerLevels('kodekloud', [

    /* ============================================================
       11. Cluster maintenance — drain, upgrade, etcd
       ============================================================ */
    {
      id: 'kk-clusterops',
      icon: '🔧',
      title: 'Cluster Maintenance — drain, upgrade, aur etcd restore',
      badge: 'Maintenance Mahant',
      objectives: [
        'cordon, drain aur uncordon ka farq aur sahi kram jaanna',
        'PodDisruptionBudget ka ganit khud slider par chala ke dekhna',
        'kubeadm cluster upgrade ka sahi kram — control plane pehle, worker baad mein',
        'etcd snapshot lena aur restore karna — aur restore ka asli matlab samajhna',
      ],
      lesson: [
        `<h3>🔧 Node maintenance ke teen command</h3>
         <table class="kk-tbl">
           <tr><th>Command</th><th>Kya karta hai</th><th>Chal rahe pods par asar</th></tr>
           <tr><td><code>kubectl cordon &lt;node&gt;</code></td><td>Node ko <code>SchedulingDisabled</code> mark karta hai</td><td>Koi asar nahi — sirf NAYE pods rukte hain</td></tr>
           <tr><td><code>kubectl drain &lt;node&gt;</code></td><td>cordon karta hai AUR pods ko evict karta hai</td><td>Pods hatte hain, PDB ka poora samman karte hue</td></tr>
           <tr><td><code>kubectl uncordon &lt;node&gt;</code></td><td>Node ko phir se schedulable karta hai</td><td>Purane pods wapas nahi aate — naye pods aa sakte hain</td></tr>
         </table>
         <p><b>drain ke do zaroori flags:</b></p>
         <pre># --ignore-daemonsets     → DaemonSet pods evict nahi ho sakte, warna drain shuru hi nahi hoga
# --delete-emptydir-data  → emptyDir wale pods ke liye — data KHO jayega, jaan-boojh ke maango
kubectl drain node-3 \\
  --ignore-daemonsets \\
  --delete-emptydir-data</pre>
         <p><b>Eviction aur delete ka farq:</b> <code>kubectl delete pod</code> PDB ko poori tarah ignore
         karta hai. <code>kubectl drain</code> Eviction API se chalta hai, jo PDB ko maanta hai. Isliye
         drain safe hai aur delete nahi.</p>
         <p><b>PDB ka ganit:</b></p>
         <pre>allowed disruptions = healthy pods − minAvailable

replicas=6, minAvailable=4  →  allowed = 2  (ek saath 2 pod hi hat sakte hain)
replicas=3, minAvailable=3  →  allowed = 0  (drain HAMESHA atka rahega)</pre>
         <div class="war-story"><b>⚡ Sabse aam PDB galti:</b> <code>minAvailable</code> ko replicas
         ke barabar rakh dena. Aisa PDB "kabhi kuch mat hatao" kehta hai, aur drain hamesha ke liye
         atak jaata hai — cluster upgrade beech mein hi ruk jaata hai. Behtar tarika:
         <code>maxUnavailable: 1</code> likho, kyunki maxUnavailable replicas ke saath apne aap
         adjust hota hai jabki minAvailable fix number reh jaata hai.</div>`,

        `<h3>⬆️ kubeadm upgrade ka kram, aur 💾 etcd</h3>
         <p><b>Upgrade ka kram badla nahi ja sakta.</b> Control plane pehle, worker baad mein.
         Version skew ka niyam: kubelet API server se <b>zyada naya</b> kabhi nahi ho sakta.</p>
         <pre># 1. Control plane node par
apt-mark unhold kubeadm && apt-get install -y kubeadm=1.31.1-1.1
kubeadm upgrade plan                       # kya-kya upgrade hoga, dekho
kubeadm upgrade apply v1.31.1              # ← yahi asli upgrade hai
# ab usi node ka kubelet:
kubectl drain &lt;cp-node&gt; --ignore-daemonsets
apt-get install -y kubelet=1.31.1-1.1 kubectl=1.31.1-1.1
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon &lt;cp-node&gt;

# 2. Har worker node par, EK-EK karke
kubectl drain worker-1 --ignore-daemonsets --delete-emptydir-data
# worker par SSH karke:
kubeadm upgrade node                       # ← worker par "apply" nahi, "node"
apt-get install -y kubelet=1.31.1-1.1
systemctl daemon-reload && systemctl restart kubelet
kubectl uncordon worker-1</pre>

         <p><b>etcd — cluster ka poora dimaag ek hi jagah.</b> Har object (pods, secrets, RBAC, CRDs)
         sirf etcd mein hai. etcd gaya to cluster gaya.</p>
         <pre># Snapshot lena
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%F).db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-2026-09-04.db --write-out=table

# Restore — NAYI data directory mein
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-2026-09-04.db \\
  --data-dir=/var/lib/etcd-restored
# phir /etc/kubernetes/manifests/etcd.yaml ka hostPath NAYI directory par point karo
# kubelet static pod ko apne aap dobara chalu kar dega</pre>
         <div class="war-story"><b>⚡ Restore ka asli matlab:</b> etcd restore cluster ko snapshot
         wale <b>exact waqt</b> par le jaata hai. Snapshot ke baad bane har object — har naya
         Deployment, har naya Secret, har naya PVC — <b>gayab</b> ho jaata hai. Aur nodes par chal
         rahe containers ka etcd ko pata hi nahi hota, isliye restore ke baad orphan containers bach
         sakte hain. Restore aakhri hathiyaar hai, roz ka aujaar nahi.</div>`,
      ],
      stages: [
        {
          type: 'slider',
          title: '🎚️ Lab: PDB ka ganit — drain chalega ya hamesha atka rahega?',
          instructions: 'Slider ghumao. Har number khud compute hota hai — koi hardcoded jawab nahi hai. Neeche verdict live badlega.',
          scenario: `Tum <code>node-3</code> ko OS patch ke liye drain karna chahte ho.
            Ek deployment ke replicas cluster ke nodes par barabar bante hain.
            Deployment par ek <b>PodDisruptionBudget</b> laga hai jo <code>minAvailable</code> maangta hai.
            <br><br><b>Sawal:</b> drain poora hoga? Kitni der lagegi? Aur drain ke dauraan kitne pods zinda rahenge?`,
          goal: 'Aisa setup banao jahan (1) drain <b>90 second se kam</b> mein poora ho, AUR (2) drain ke dauraan hamesha <b>kam se kam 3 pods</b> zinda rahein.',
          knobs: [
            { id: 'replicas', label: 'Deployment ke replicas', min: 2, max: 12, step: 1, value: 4, unit: ' pods' },
            { id: 'nodes', label: 'Cluster mein nodes', min: 2, max: 8, step: 1, value: 2, unit: ' nodes' },
            { id: 'minAvail', label: 'PDB minAvailable', min: 1, max: 12, step: 1, value: 4, unit: ' pods' },
            { id: 'ready', label: 'Naya pod Ready hone ka time', min: 5, max: 120, step: 5, value: 30, unit: ' s' },
          ],
          readouts: k => {
            const pn = perNode(k.replicas, k.nodes);
            const allowed = allowedDisruptions(k.replicas, k.minAvail);
            const secs = drainSeconds(k.replicas, k.nodes, k.minAvail, k.ready);
            const waves = drainWaves(k.replicas, k.nodes, k.minAvail);
            return [
              { label: 'node-3 par kitne pods', value: pn + ' pods', state: 'neutral', hint: 'ceil(replicas ÷ nodes) — barabar bantwara' },
              { label: 'PDB allowed disruptions', value: String(allowed), state: allowed === 0 ? 'bad' : allowed >= pn ? 'good' : 'warn', hint: 'replicas − minAvailable' },
              { label: 'Eviction ke waves', value: waves === Infinity ? '∞ (atka)' : String(waves), state: waves === Infinity ? 'bad' : waves === 1 ? 'good' : 'warn', hint: 'ek wave mein "allowed" pods hi hat sakte hain' },
              { label: 'Drain ka kul time', value: secs === Infinity ? 'kabhi nahi' : secs + ' s', state: secs === Infinity ? 'bad' : secs < 90 ? 'good' : 'warn', hint: 'waves × pod ke ready hone ka time' },
              { label: 'Drain ke dauraan zinda pods', value: String(Math.min(k.minAvail, k.replicas)), state: Math.min(k.minAvail, k.replicas) >= 3 ? 'good' : 'bad', hint: 'PDB isse neeche kabhi nahi jaane dega' },
            ];
          },
          bars: k => {
            const allowed = allowedDisruptions(k.replicas, k.minAvail);
            const secs = drainSeconds(k.replicas, k.nodes, k.minAvail, k.ready);
            return [
              { label: 'Availability (minAvailable ÷ replicas)', pct: Math.min(k.minAvail, k.replicas) / k.replicas * 100, state: Math.min(k.minAvail, k.replicas) >= 3 ? 'good' : 'bad', cap: Math.min(k.minAvail, k.replicas) + '/' + k.replicas },
              { label: 'Drain speed (90s budget ka)', pct: secs === Infinity ? 100 : secs / 90 * 100, state: secs === Infinity ? 'bad' : secs < 90 ? 'good' : 'warn', cap: secs === Infinity ? 'atka' : secs + 's / 90s' },
              { label: 'Ek saath hataye ja sakte pods', pct: allowed / Math.max(1, k.replicas) * 100, state: allowed === 0 ? 'bad' : 'good', cap: allowed + ' pods' },
            ];
          },
          verdict: k => {
            const allowed = allowedDisruptions(k.replicas, k.minAvail);
            const secs = drainSeconds(k.replicas, k.nodes, k.minAvail, k.ready);
            const alive = Math.min(k.minAvail, k.replicas);
            if (allowed === 0)
              return { ok: false, text: `<b>Drain HAMESHA atka rahega.</b> minAvailable (${k.minAvail}) replicas (${k.replicas}) se kam nahi hai, isliye PDB ek bhi pod hataane nahi dega. <code>kubectl drain</code> "Cannot evict pod as it would violate the pod's disruption budget" kehta rahega, hamesha ke liye.` };
            if (alive < 3)
              return { ok: false, text: `Drain to chal jayega (${secs}s), par drain ke dauraan sirf <b>${alive} pod</b> zinda rahenge. Ek aur gadbad ho gayi to service down. minAvailable badhao.` };
            if (secs >= 90)
              return { ok: false, text: `Availability theek hai (${alive} pods zinda), par drain <b>${secs}s</b> lega — 90s ke budget se zyada. Ya to minAvailable ghatao (zyada pods ek saath hatenge), ya nodes badhao (node-3 par kam pods honge), ya pod ka ready time ghatao.` };
            return { ok: true, text: `<b>Sahi santulan.</b> node-3 par ${perNode(k.replicas, k.nodes)} pods hain, PDB ${allowed} pods ek saath hataane deta hai, isliye drain ${drainWaves(k.replicas, k.nodes, k.minAvail)} wave mein <b>${secs}s</b> mein poora hoga — aur poore samay <b>${alive} pods</b> traffic le rahe honge.` };
          },
          check: k => allowedDisruptions(k.replicas, k.minAvail) > 0
            && drainSeconds(k.replicas, k.nodes, k.minAvail, k.ready) < 90
            && Math.min(k.minAvail, k.replicas) >= 3,
          lesson: 'Gaur karo ki <b>nodes badhane</b> se drain tez ho gaya — kyunki har node par kam pods the, isliye kam pods evict karne pade. Aur <b>minAvailable ko replicas ke barabar rakhne</b> se allowed disruptions 0 ho jaata hai aur drain hamesha ke liye atak jaata hai. Isliye production mein <code>maxUnavailable: 1</code> likhna behtar hai — maxUnavailable replicas ke saath apne aap adjust hota hai, minAvailable ek fix number reh jaata hai jo scale-down par khatarnak ban jaata hai.',
          quiz: {
            q: 'Ek team <code>replicas: 3</code> aur <code>minAvailable: 3</code> rakhti hai. Cluster upgrade beech mein hi atak gaya. Sabse achha permanent fix?',
            choices: [
              'PDB ko maxUnavailable: 1 par le jao — maxUnavailable replicas ke saath apne aap adjust hota hai',
              'PDB delete kar do',
              'kubectl delete pod se pods hata do (delete PDB ko ignore karta hai)',
              'drain par --force laga do',
            ],
            answer: 0,
            explain: '<code>minAvailable: 3</code> ke saath <code>replicas: 3</code> ka matlab "kabhi kuch mat hatao" — allowed disruptions 0. <code>maxUnavailable: 1</code> hamesha ek pod hataane deta hai, chahe replicas 3 hon ya 30, isliye upgrade kabhi atkega nahi aur availability ka vaada bhi bacha rehta hai. <b>PDB delete karna</b> saari suraksha hata deta hai. <b>kubectl delete pod</b> sach mein PDB ko ignore karta hai, par isi wajah se woh galat aujaar hai — PDB ka poora maksad hi yahi hai ki maintenance se availability na toote.',
          },
        },
        {
          type: 'order',
          title: '🔢 kubeadm upgrade — sahi kram lagao',
          instructions: 'v1.30 se v1.31 par upgrade. Kram galat hua to version skew ka niyam tootega aur kubelet API server se connect nahi kar payega.',
          steps: [
            { text: 'etcd ka snapshot lo aur snapshot status se verify karo', explain: 'Upgrade ka pehla kadam hamesha backup hai. Upgrade fail hone par etcd snapshot hi ek raasta bachta hai. Sirf snapshot lena kaafi nahi — status se verify bhi karo ki file padhi ja sakti hai.' },
            { text: 'Control plane node par kubeadm ko naye version par upgrade karo', explain: 'kubeadm binary khud pehle naya hona chahiye, kyunki agla kadam wahi binary chalayega. Node ka kubelet abhi purana hi rahega.' },
            { text: 'kubeadm upgrade plan chalao', explain: 'Plan batata hai ki kaunse component upgrade honge, kaunsa version target hai, aur koi rukawat to nahi. Apply se pehle plan padhna hamesha zaroori hai.' },
            { text: 'kubeadm upgrade apply v1.31.1 — control plane components upgrade karo', explain: 'API server, controller-manager, scheduler aur etcd ke static pod manifests ab naye version par likhe jaate hain. Ab API server naya hai aur kubelets purane — yeh haalat theek hai, kyunki kubelet API server se purana ho sakta hai (ulta nahi).' },
            { text: 'Control plane node ka kubelet aur kubectl upgrade karke kubelet restart karo', explain: 'Control plane ke apne node ka kubelet ab naye version par aata hai. Restart ke baad node naye version par Ready dikhega.' },
            { text: 'Pehla worker drain karo (--ignore-daemonsets --delete-emptydir-data)', explain: 'Worker ka kaam shuru. Ek-ek karke drain karo taaki poora capacity ek saath na gire. PDB drain ko safe rakhta hai.' },
            { text: 'Us worker par kubeadm upgrade node chalao', explain: 'Worker par <code>upgrade apply</code> nahi — <code>upgrade node</code>. Yeh sirf us node ka kubelet config aur local certificates update karta hai, control plane ko nahi chhoota.' },
            { text: 'Us worker ka kubelet upgrade karke restart karo, phir uncordon karo', explain: 'kubelet naye version par aaya, node phir se schedulable hua. Ab agle worker par yahi teen kadam dohrao — ek-ek karke, saath mein nahi.' },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: etcd se cluster wapas laao',
          instructions: 'API server upar nahi aa raha. Snapshot maujood hai. Pehle snapshot verify karo, phir restore karo.',
          goal: 'Control plane wapas laao: <code>kubectl get pods -n kube-system</code> se halat dekho, <code>etcdctl snapshot status</code> se snapshot verify karo, phir <code>etcdctl snapshot restore</code> chalao aur <code>ls</code> se manifest ka fix lagao.',
          tasks: T_ETCD,
          cluster: {
            restored: false,
            nodes: [{ name: 'cp-1', status: 'Ready', roles: 'control-plane', age: '210d', version: 'v1.30.2' }],
            pods: [
              { name: 'etcd-cp-1', ready: '0/1', status: 'CrashLoopBackOff', restarts: 24, age: '38m', node: 'cp-1', ip: '10.0.0.10',
                logs: 'Error from server (BadRequest): container "etcd" in pod "etcd-cp-1" is waiting to start: CrashLoopBackOff',
                prevLogs: '{"level":"warn","msg":"failed to find database file"}\n{"level":"fatal","msg":"walpb: crc mismatch","dir":"/var/lib/etcd/member/wal"}\npanic: freepages: failed to get all reachable pages',
                describe: 'Name:  etcd-cp-1\nNamespace: kube-system\nContainers:\n  etcd:\n    State:       Waiting\n      Reason:    CrashLoopBackOff\n    Last State:  Terminated\n      Reason:    Error\n      Exit Code: 2\n    Command:\n      etcd\n      --data-dir=/var/lib/etcd\nEvents:\n  Warning  BackOff  30s (x160 over 38m)  kubelet  Back-off restarting failed container etcd',
                events: ['Warning  BackOff  30s (x160 over 38m)  kubelet  Back-off restarting failed container etcd'] },
              { name: 'kube-apiserver-cp-1', ready: '0/1', status: 'CrashLoopBackOff', restarts: 19, age: '38m', node: 'cp-1', ip: '10.0.0.10',
                logs: 'Error from server (BadRequest): container "kube-apiserver" is waiting to start: CrashLoopBackOff',
                prevLogs: 'E0904 03:41:22 etcdserver: request timed out\nF0904 03:41:52 Error creating self-signed certificates: context deadline exceeded (etcd unreachable)',
                describe: 'Name:  kube-apiserver-cp-1\nNamespace: kube-system\nContainers:\n  kube-apiserver:\n    State:  Waiting\n      Reason: CrashLoopBackOff\n    Last State: Terminated\n      Exit Code: 1\nEvents:\n  Warning  Unhealthy  1m (x88 over 38m)  kubelet  Liveness probe failed: connection refused',
                events: ['Warning  Unhealthy  1m (x88 over 38m)  kubelet  Liveness probe failed: connection refused'] },
            ],
            deployments: [],
            services: [],
          },
          responses: [
            { re: /^ls -la? \/backup\/?$/, out: 'total 62M\n-rw-r--r-- 1 root root 61M Sep  4 02:00 etcd-2026-09-04.db\n-rw-r--r-- 1 root root 60M Sep  3 02:00 etcd-2026-09-03.db' },
            {
              re: /etcdctl.*snapshot status/,
              out: '+----------+----------+------------+------------+\n|   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |\n+----------+----------+------------+------------+\n| 8f2c1a4e |   492817 |       1642 |      61 MB |\n+----------+----------+------------+------------+\n\n✅ Snapshot padha ja sakta hai — 1642 keys, 61 MB. Restore ke liye theek hai.',
            },
            {
              re: /etcdctl.*snapshot restore/,
              out: (s) => {
                s.cluster.snapshotRestored = true;
                return '2026-09-04T04:12:08Z\tinfo\tsnapshot/v3_snapshot.go:260\trestoring snapshot\t{"path": "/backup/etcd-2026-09-04.db", "wal-dir": "/var/lib/etcd-restored/member/wal"}\n2026-09-04T04:12:11Z\tinfo\tmembership/store.go:141\tadded member\n2026-09-04T04:12:11Z\tinfo\tsnapshot/v3_snapshot.go:287\trestored snapshot\n\n✅ Nayi data directory ban gayi: /var/lib/etcd-restored\n⚠️ etcd abhi bhi PURANI directory (/var/lib/etcd) padh raha hai. Agla kadam: static pod manifest ka hostPath nayi directory par point karo.';
              },
            },
          ],
          files: {
            'point-manifest.yaml': {
              desc: '/etc/kubernetes/manifests/etcd.yaml ka hostPath /var/lib/etcd-restored par le jaata hai',
              apply: s => {
                if (!s.cluster.snapshotRestored)
                  return '⚠️ Nayi data directory /var/lib/etcd-restored maujood hi nahi hai. Pehle etcdctl snapshot restore --data-dir=/var/lib/etcd-restored chalao, tab manifest ko us directory par point karo.';
                s.cluster.restored = true;
                s.cluster.pods.forEach(p => {
                  p.status = 'Running'; p.ready = '1/1'; p.restarts = 0;
                  p.logs = p.name.startsWith('etcd')
                    ? '{"level":"info","msg":"serving client traffic","address":"127.0.0.1:2379"}'
                    : 'I0904 04:13:02 Serving securely on [::]:6443\nI0904 04:13:04 Storage version of apiregistration.k8s.io updated';
                });
                return 'etcd.yaml updated (hostPath → /var/lib/etcd-restored)\nkubelet ne static pod ko dobara chalu kiya\n\n✅ etcd Running · kube-apiserver Running\n⚠️ Cluster ab 02:00 wale snapshot par hai. 02:00 ke baad bane objects gayab hain — team ko batao.';
              },
            },
            'restart-kubelet.yaml': {
              desc: 'cp-1 par kubelet restart karta hai',
              apply: () => 'systemctl restart kubelet\n\n⚠️ etcd phir wahi crash de raha hai: "walpb: crc mismatch". etcd ki data directory corrupt hai — restart se corrupt file theek nahi hoti. Snapshot restore hi ek raasta hai.',
            },
            'delete-etcd-pod.yaml': {
              desc: 'etcd pod delete karta hai taaki naya bane',
              apply: () => 'pod "etcd-cp-1" deleted\n\n⚠️ etcd ek STATIC POD hai — kubelet usse /etc/kubernetes/manifests/etcd.yaml se seedha banata hai, koi controller nahi. Delete karte hi kubelet ne wahi pod dobara bana diya, aur wahi corrupt data directory phir se padhi. Status waisa ka waisa: CrashLoopBackOff.',
            },
          },
          success: allOf(T_ETCD),
          successText: 'Do cheezein saabit hui. <b>Pehli:</b> etcd aur kube-apiserver <b>static pods</b> hain — kubelet unhe seedha <code>/etc/kubernetes/manifests/</code> se banata hai, isliye pod delete karne ya kubelet restart karne se kuch nahi badalta; asli badlav manifest file mein hota hai. <b>Doosri:</b> restore sirf snapshot restore chalane se poora nahi hota — <code>--data-dir</code> ek <b>nayi</b> directory banata hai, aur etcd tab tak purani corrupt directory hi padhta rehta hai jab tak manifest ka hostPath nayi directory par na jaye. Aur yaad rakho: cluster ab 02:00 ke snapshot par hai, isliye 02:00 ke baad bana har object gayab hai.',
          hints: [
            'kubectl get pods -n kube-system — etcd aur apiserver dono CrashLoopBackOff mein hain',
            'kubectl logs etcd-cp-1 --previous — "walpb: crc mismatch" matlab data directory corrupt hai',
            'ls /backup — snapshot maujood hai. Pehle verify: ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-2026-09-04.db',
            'ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-2026-09-04.db --data-dir=/var/lib/etcd-restored',
            'ls chalao — point-manifest.yaml se etcd.yaml ka hostPath nayi directory par le jao',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "<code>kubectl drain</code> aur <code>kubectl delete pod</code> mein PDB ke hisaab se kya farq hai?"',
            choices: [
              'drain Eviction API se chalta hai jo PDB maanti hai; delete seedha object hataata hai aur PDB ko poori tarah ignore karta hai',
              'Dono PDB maante hain',
              'Dono PDB ignore karte hain',
              'delete PDB maanta hai, drain nahi',
            ],
            answer: 0,
            explain: 'PDB ka lagoo hona sirf <b>Eviction API</b> (<code>POST /pods/&lt;name&gt;/eviction</code>) par hota hai. <code>kubectl drain</code> wahi API use karta hai, isliye drain safe hai — PDB tootne wali eviction reject ho jaati hai. <code>kubectl delete pod</code> seedha object delete karta hai aur PDB check hota hi nahi. Isliye maintenance ke liye hamesha drain, kabhi delete nahi. (Node ka kernel OOM killer aur node ka crash bhi PDB nahi maante — PDB sirf <i>voluntary</i> disruptions se bachata hai.)',
          },
          {
            q: 'Interviewer: "etcd snapshot restore ke baad kya-kya khoya hai, yeh kaise batao ge?"',
            choices: [
              'Sab kuch jo snapshot ke BAAD bana ya badla — naye Deployments, naye Secrets, naye PVC, RBAC ke badlav — aur nodes par chal rahe orphan containers bhi ho sakte hain',
              'Kuch nahi khota, etcd apne aap sync kar leta hai',
              'Sirf pods khote hain, baaki objects bach jaate hain',
              'Sirf woh objects khote hain jo default namespace mein the',
            ],
            answer: 0,
            explain: 'etcd cluster ka <b>poora</b> state rakhta hai. Restore cluster ko snapshot wale exact waqt par le jaata hai — us waqt ke baad ka har badlav gayab. Do khaas khatre: <b>(1)</b> nodes par chal rahe containers ka etcd ko pata hi nahi tha, isliye restore ke baad aise pods chal rahe honge jinka koi object hi nahi hai (orphans) — inhe dhoondh ke saaf karna padta hai; <b>(2)</b> agar kisi ne snapshot ke baad Secret rotate ki thi, to purani (rotate ho chuki) Secret wapas aa jayegi. Isliye restore ke baad har application ki halat khud verify karni padti hai.',
          },
        ],
      },
      success: [
        'Main cordon, drain aur uncordon ka farq aur sahi kram jaanta hoon',
        'Main PDB ka ganit (allowed = healthy − minAvailable) khud laga sakta hoon',
        'Main kubeadm upgrade ka kram jaanta hoon: control plane pehle, phir worker ek-ek karke',
        'Main etcd snapshot le sakta hoon, verify kar sakta hoon, aur restore ka asli asar samajhta hoon',
      ],
      homework: `<p>Drain aur PDB ka takraav khud dekho (kind/minikube par):</p>
        <pre>kubectl create deployment web --image=nginx --replicas=3
kubectl create pdb web-pdb --selector=app=web --min-available=3

kubectl get nodes
kubectl drain &lt;koi-worker&gt; --ignore-daemonsets --delete-emptydir-data
# "Cannot evict pod as it would violate the pod's disruption budget" — hamesha ke liye atka

# ab PDB theek karo
kubectl delete pdb web-pdb
kubectl create pdb web-pdb --selector=app=web --max-unavailable=1
kubectl drain &lt;koi-worker&gt; --ignore-daemonsets --delete-emptydir-data   # ab chalega
kubectl uncordon &lt;koi-worker&gt;</pre>
        <p>Aur agar tumhare paas kubeadm cluster hai, to snapshot lena aur
        <code>snapshot status</code> se verify karna zaroor practice karo — restore se pehle
        verify karna hamesha zaroori hai.</p>`,
      cards: [
        { front: 'cordon vs drain vs uncordon?', back: '<b>cordon</b> = sirf naye pods roko (chal rahe pods par asar nahi). <b>drain</b> = cordon + pods evict karo (PDB maante hue). <b>uncordon</b> = phir se schedulable karo (purane pods wapas nahi aate).' },
        { front: 'PDB ka ganit kya hai?', back: '<code>allowed disruptions = healthy pods − minAvailable</code>. <code>replicas=3, minAvailable=3</code> → allowed 0 → drain hamesha atka. Behtar: <code>maxUnavailable: 1</code>, jo replicas ke saath apne aap adjust hota hai.' },
        { front: 'drain PDB maanta hai par delete kyun nahi?', back: 'drain <b>Eviction API</b> use karta hai, jispar PDB lagoo hota hai. <code>kubectl delete pod</code> seedha object hataata hai — koi PDB check hota hi nahi.' },
        { front: 'kubeadm upgrade ka kram?', back: 'Control plane pehle (<code>kubeadm upgrade apply</code>), phir har worker ek-ek karke (<code>kubeadm upgrade node</code>). Niyam: kubelet API server se zyada naya kabhi nahi ho sakta.' },
        { front: 'etcd restore ke baad kya khota hai?', back: 'Snapshot ke <b>baad</b> ka sab kuch — naye Deployments, Secrets, PVC, RBAC. Plus nodes par orphan containers bach sakte hain jinka koi object nahi. Restore aakhri hathiyaar hai.' },
        { front: 'etcd aur kube-apiserver ke pods delete karne se kya hota hai?', back: 'Kuch nahi — dono <b>static pods</b> hain. kubelet unhe <code>/etc/kubernetes/manifests/</code> se seedha banata hai, isliye delete karte hi wahi pod dobara ban jaata hai. Badlav manifest file mein karna padta hai.' },
      ],
    },

    /* ============================================================
       12. TLS, kubeconfig, certificate expiry
       ============================================================ */
    {
      id: 'kk-certs',
      icon: '🔐',
      title: 'Certificates aur kubeconfig — "Unable to connect to the server"',
      badge: 'Praman Palak',
      objectives: [
        'kubeconfig ke teen hisse — cluster, user, context — alag-alag samajhna',
        'x509 errors padhna: expired, unknown authority, aur "not valid for" ka farq',
        '`kubeadm certs check-expiration` aur `renew` chalana',
        'CertificateSigningRequest API se naye user ka certificate banana',
      ],
      lesson: [
        `<h3>🔐 kubeconfig ke teen alag hisse</h3>
         <pre>clusters:                       # KAHAN jana hai + KISPAR bharosa karna hai
  - name: prod
    cluster:
      server: https://10.0.0.10:6443
      certificate-authority-data: LS0t…      # cluster ki CA — API server ko verify karta hai

users:                          # TUM KAUN HO
  - name: alice
    user:
      client-certificate-data: LS0t…        # tumhara certificate (CN = username, O = group)
      client-key-data: LS0t…                # tumhari private key

contexts:                       # KAUN, KAHAN, KIS NAMESPACE MEIN
  - name: alice@prod
    context: { cluster: prod, user: alice, namespace: shop }
current-context: alice@prod</pre>
         <p>Kubernetes ke paas User naam ka koi object hai hi nahi. API server client certificate ke
         <b>CN</b> field ko username maanta hai aur <b>O</b> (organization) field ko group.
         Isliye RBAC ka <code>subjects: kind: User, name: alice</code> asli mein certificate ke CN se judta hai.</p>
         <table class="kk-tbl">
           <tr><th>Error</th><th>Kya toota hai</th><th>Fix</th></tr>
           <tr><td><code>x509: certificate has expired or is not yet valid</code></td><td>Client ya server ka certificate expire ho gaya (kubeadm certs 1 saal ke hote hain)</td><td><code>kubeadm certs renew all</code> phir naya admin.conf lo</td></tr>
           <tr><td><code>x509: certificate signed by unknown authority</code></td><td>kubeconfig ki CA cluster ki asli CA se match nahi karti</td><td>Sahi <code>certificate-authority-data</code> lo (aksar cluster rebuild ke baad hota hai)</td></tr>
           <tr><td><code>x509: certificate is valid for X, not Y</code></td><td>Server certificate mein woh naam/IP hai hi nahi jisse tum connect kar rahe ho</td><td>API server certificate ke SAN mein naya naam jodo</td></tr>
           <tr><td><code>Unauthorized</code> (401)</td><td>Certificate to valid hai par API server usse pehchanta nahi</td><td>CA aur user ki jodi galat hai</td></tr>
           <tr><td><code>Forbidden</code> (403)</td><td>Pehchaan ho gayi, par RBAC permission nahi</td><td><code>kubectl auth can-i … --as=&lt;user&gt;</code> se check karo</td></tr>
         </table>
         <p><b>401 aur 403 ka farq yaad rakho:</b> 401 ka matlab "tum kaun ho, pata hi nahi chala"
         (certificate/CA ka masla). 403 ka matlab "tum kaun ho, pata hai — par tumhe ijaazat nahi"
         (RBAC ka masla). Dono ka fix bilkul alag jagah hai.</p>`,

        `<h3>📜 Certificates renew karna aur naya user banana</h3>
         <pre># Saari expiry ek nazar mein — control plane node par
kubeadm certs check-expiration

CERTIFICATE                EXPIRES                  RESIDUAL TIME
admin.conf                 Sep 04, 2026 03:11 UTC   &lt;invalid&gt;      ← expire ho chuka
apiserver                  Sep 04, 2026 03:11 UTC   &lt;invalid&gt;
apiserver-kubelet-client   Sep 04, 2026 03:11 UTC   &lt;invalid&gt;
front-proxy-client         Sep 04, 2026 03:11 UTC   &lt;invalid&gt;
CERTIFICATE AUTHORITY      EXPIRES                  RESIDUAL TIME
ca                         Sep 02, 2035 03:11 UTC   8y             ← CA 10 saal ki hai

# Sab renew karo
kubeadm certs renew all
# static pods ko naya certificate uthana hoga:
# /etc/kubernetes/manifests/ ki file ko touch karo ya kubelet restart karo
# aur NAYA admin kubeconfig lo:
cp /etc/kubernetes/admin.conf ~/.kube/config</pre>
         <div class="war-story"><b>⚡ Saal mein ek baar aane wala outage:</b> kubeadm ke client
         certificates <b>1 saal</b> ke hote hain, par CA <b>10 saal</b> ki. Jo cluster har kuch mahine
         upgrade hota hai, uske certificates har <code>kubeadm upgrade apply</code> par apne aap renew
         ho jaate hain. Par jo cluster ek saal se chhua hi nahi gaya, uska certificate chup-chaap
         expire ho jaata hai — aur ek din <code>kubectl</code> chalate hi
         <code>Unable to connect to the server: x509: certificate has expired</code> aata hai.
         <b>Yaad rakho:</b> chal rahe pods bilkul theek chalte rehte hain. Sirf control plane
         tak pahunch bandh hoti hai — dhokha yahi hai ki "cluster down hai" lagta hai jabki
         applications chal rahi hoti hain.</div>

         <h3>🆕 CSR API se naya user</h3>
         <pre># 1. Key aur CSR banao (CN = username, O = group)
openssl genrsa -out alice.key 2048
openssl req -new -key alice.key -out alice.csr -subj "/CN=alice/O=developers"

# 2. Kubernetes ko approve karne ko do
cat &lt;&lt;EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata: { name: alice }
spec:
  request: $(cat alice.csr | base64 | tr -d '\\n')
  signerName: kubernetes.io/kube-apiserver-client
  usages: ["client auth"]
EOF

kubectl certificate approve alice
kubectl get csr alice -o jsonpath='{.status.certificate}' | base64 -d &gt; alice.crt

# 3. Certificate mila — par RBAC abhi bhi alag kaam hai!
kubectl create rolebinding alice-dev --clusterrole=edit --user=alice -n shop</pre>
         <p><b>Sabse zaroori baat:</b> certificate se sirf <b>pehchaan</b> milti hai, <b>ijaazat</b> nahi.
         Naya user bina RBAC binding ke har command par <code>Forbidden</code> paayega — aur
         <code>Forbidden</code> ka matlab hai ki certificate bilkul theek kaam kar raha hai.</p>`,
      ],
      stages: [
        {
          type: 'triage',
          title: '🩺 Triage: "poora cluster down hai" — ya sirf kubectl?',
          instructions: 'Ek badi galti se bachna hai: "kubectl nahi chal raha" aur "cluster down hai" do alag baatein hain.',
          symptom: `<b>Subah 09:15:</b> platform team ka message — "poora production cluster down hai,
            <code>kubectl</code> kuch bhi nahi chala raha".<br>
            Par customer support ka kehna hai ki website bilkul theek chal rahi hai aur orders aa rahe hain.`,
          commands: [
            {
              cmd: 'kubectl get nodes',
              clue: true,
              out: `E0904 09:15:02  couldn't get current server API group list:
  Get "https://10.0.0.10:6443/api?timeout=32s":
  tls: failed to verify certificate: x509: certificate has expired or is not yet valid:
  current time 2026-09-04T09:15:02Z is after 2026-09-04T03:11:47Z

Unable to connect to the server: x509: certificate has expired or is not yet valid`,
              note: '<b>x509: certificate has expired.</b> Message mein exact waqt bhi likha hai — certificate 03:11 par expire hua. Yeh TLS handshake ke padav ki error hai; API server tak request pahunchi hi nahi.',
            },
            {
              cmd: 'curl -sk https://10.0.0.10:6443/healthz',
              clue: true,
              out: `ok`,
              note: '<b>API server bilkul zinda hai.</b> <code>-k</code> flag ne certificate verification skip kiya aur API server ne <code>ok</code> diya. Toh "cluster down hai" wali baat galat hai — sirf certificate se pehchaan nahi ban paa rahi.',
            },
            {
              cmd: 'curl -sS https://shop.example.com/api/health',
              clue: true,
              out: `{"status":"ok","orders_last_5m":412}`,
              note: 'Application traffic bilkul theek chal raha hai — pichhle 5 minute mein 412 orders. Chal rahe pods ko control plane ki zaroorat nahi hoti; kube-proxy ke iptables rules aur chal rahe containers apne aap kaam karte rehte hain.',
            },
            {
              cmd: 'openssl x509 -in ~/.kube/config-cert.pem -noout -dates',
              clue: true,
              out: `notBefore=Sep  4 03:11:47 2025 GMT
notAfter=Sep  4 03:11:47 2026 GMT`,
              note: '<b>Theek ek saal</b> ka certificate tha, aur aaj wahi saal poora hua. kubeadm ke client certificates default 1 saal ke hote hain. Cluster ek saal se upgrade nahi hua, isliye certificates apne aap renew nahi hue.',
            },
            {
              cmd: 'sudo kubeadm certs check-expiration',
              clue: true,
              out: `CERTIFICATE                EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED
admin.conf                 Sep 04, 2026 03:11 UTC   <invalid>       no
apiserver                  Sep 04, 2026 03:11 UTC   <invalid>       no
apiserver-etcd-client      Sep 04, 2026 03:11 UTC   <invalid>       no
apiserver-kubelet-client   Sep 04, 2026 03:11 UTC   <invalid>       no
controller-manager.conf    Sep 04, 2026 03:11 UTC   <invalid>       no
front-proxy-client         Sep 04, 2026 03:11 UTC   <invalid>       no
scheduler.conf             Sep 04, 2026 03:11 UTC   <invalid>       no

CERTIFICATE AUTHORITY      EXPIRES                  RESIDUAL TIME
ca                         Sep 02, 2035 03:11 UTC   8y
etcd-ca                    Sep 02, 2035 03:11 UTC   8y
front-proxy-ca             Sep 02, 2035 03:11 UTC   8y`,
              note: '<b>Saare</b> client certificates ek saath expire hue hain (sab ek hi din bane the). CA abhi 8 saal aur chalegi — isliye poora cluster dobara banane ki zaroorat bilkul nahi hai, sirf renew karna hai.',
            },
            {
              cmd: 'kubectl get pods --kubeconfig /etc/kubernetes/admin.conf',
              clue: false,
              out: `Unable to connect to the server: x509: certificate has expired or is not yet valid`,
              note: 'Dead end — par kaam ka. <code>admin.conf</code> bhi wahi expired certificate rakhta hai, isliye doosri kubeconfig aazmane se kuch nahi hoga. Certificates ko renew karna hi padega.',
            },
            {
              cmd: 'date -u',
              clue: false,
              out: `Fri Sep  4 09:15:44 UTC 2026`,
              note: 'Dead end, par check karne layak. Kabhi-kabhi "certificate is not yet valid" isliye aata hai kyunki machine ki ghadi galat hai. Yahan ghadi bilkul sahi hai — certificate sach mein expire hua hai.',
            },
          ],
          questions: [
            {
              q: 'Kya production cluster sach mein down hai?',
              choices: [
                'Nahi — API server zinda hai (healthz ok) aur applications traffic le rahi hain. Sirf admin ki kubectl pahunch tooti hai kyunki client certificate expire ho gaya',
                'Haan — poora control plane down hai',
                'Haan — nodes ka etcd se rishta toot gaya hai',
                'Nahi — sirf DNS ka masla hai',
              ],
              answer: 0,
              explain: 'Teen saboot: <code>curl -k https://…/healthz</code> ne <code>ok</code> diya (API server zinda), application endpoint ne 412 orders dikhaye (traffic chal raha hai), aur error TLS handshake ke padav par hai. <b>Chal rahe pods ko control plane ki zaroorat hoti hi nahi</b> — kubelet apne containers chalaata rehta hai aur kube-proxy ke iptables rules waise ke waise kaam karte hain. Certificate expiry admin ki pahunch todti hai, applications nahi. (Haan, jab tak control plane wapas na aaye, koi naya deploy ya scaling nahi ho sakti.)',
            },
            {
              q: 'CA 8 saal aur chalegi par saare client certificates expire hain. Sahi ilaaj?',
              choices: [
                'sudo kubeadm certs renew all — phir static pods restart karo aur naya /etc/kubernetes/admin.conf le lo',
                'Cluster ko kubeadm reset karke dobara banao',
                'kubectl ko --insecure-skip-tls-verify ke saath chalao',
                'Har node par ghadi peeche kar do',
              ],
              answer: 0,
              explain: 'CA zinda hai, isliye <code>kubeadm certs renew all</code> usi CA se saare leaf certificates dobara jaari kar deta hai — kuch second ka kaam. Uske baad do cheezein zaroori hain: <b>(1)</b> control plane ke static pods ko naye certificate uthane hain (manifest file <code>touch</code> karo ya kubelet restart karo); <b>(2)</b> <code>/etc/kubernetes/admin.conf</code> se naya kubeconfig copy karo, kyunki purani admin.conf mein purana expired certificate embedded hai. <code>--insecure-skip-tls-verify</code> yahan kaam bhi nahi karega — problem <b>client</b> certificate ki hai, server ke verification ki nahi. Ghadi peeche karna cluster-wide corruption ka nyota hai.',
            },
          ],
        },
        {
          type: 'fill',
          title: '📄 Naye developer ke liye CSR + RBAC',
          instructions: 'alice ko <code>shop</code> namespace mein edit ki ijaazat deni hai. CSR aur RoleBinding dono poore karo.',
          template: `# 1. CSR banate waqt subject
openssl req -new -key alice.key -out alice.csr \\
  -subj "/{0}=alice/O=developers"     # yeh field API server ke liye USERNAME banta hai

# 2. Kubernetes CSR object
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: alice
spec:
  request: <base64 of alice.csr>
  signerName: kubernetes.io/{1}
  usages: ["client auth"]

# 3. Approve karo
kubectl certificate {2} alice

# 4. Certificate se sirf PEHCHAAN mili — ijaazat abhi bhi alag kaam hai
kubectl create rolebinding alice-edit \\
  --clusterrole=edit --{3}=alice -n shop`,
          blanks: [
            { answer: 'CN', explain: 'API server client certificate ke <b>CN</b> (Common Name) ko username maanta hai, aur <b>O</b> (Organization) ko group. Kubernetes mein User naam ka koi object hota hi nahi — pehchaan certificate ke in do field se aati hai.' },
            { answer: 'kube-apiserver-client', explain: '<code>kubernetes.io/kube-apiserver-client</code> signer aise certificates banata hai jinse API server ke saath client authentication hoti hai. Doosre signers ka kaam alag hai: <code>kubelet-serving</code> kubelet ke server certificate ke liye, <code>kube-apiserver-client-kubelet</code> khaas kubelet ke client certificate ke liye.' },
            { answer: 'approve', explain: '<code>kubectl certificate approve &lt;naam&gt;</code>. CSR banane se certificate nahi milta — koi (insaan ya controller) approve kare tabhi signer usse sign karta hai. Mana karna ho to <code>kubectl certificate deny</code>.' },
            { answer: 'user', explain: 'RoleBinding ka <code>--user=alice</code> certificate ke CN se match hota hai. Group ke liye <code>--group=developers</code> hota, jo certificate ke O se match karta. <b>Yaad rakho:</b> certificate = pehchaan, RBAC = ijaazat — dono alag kadam hain.' },
          ],
          tokens: ['CN', 'kube-apiserver-client', 'approve', 'user', 'O', 'legacy-unknown', 'sign', 'group'],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: expired certificates renew karo',
          instructions: 'kubectl kaam nahi kar raha. Pehle expiry confirm karo, phir renew karo, phir naya kubeconfig lo.',
          goal: '<code>kubeadm certs check-expiration</code> chalao, phir <code>kubeadm certs renew all</code>, phir <code>ls</code> se naya kubeconfig lagao.',
          tasks: T_CERT,
          cluster: {
            apiReachable: false,
            renewed: false,
            nodes: [{ name: 'cp-1', status: 'Ready', roles: 'control-plane', age: '366d', version: 'v1.30.2' }],
            pods: [{ name: 'shop-api-6b7c8d9e0-aa1bb', ready: '1/1', status: 'Running', restarts: 0, age: '92d', node: 'cp-1', ip: '10.244.1.5', logs: '{"msg":"handled GET /health","status":200}' }],
            deployments: [{ name: 'shop-api', ready: '1/1', upToDate: 1, available: 1, age: '92d' }],
            services: [],
          },
          responses: [
            {
              re: /kubeadm certs check-expiration/,
              out: 'CERTIFICATE                EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED\nadmin.conf                 Sep 04, 2026 03:11 UTC   <invalid>       no\napiserver                  Sep 04, 2026 03:11 UTC   <invalid>       no\napiserver-etcd-client      Sep 04, 2026 03:11 UTC   <invalid>       no\napiserver-kubelet-client   Sep 04, 2026 03:11 UTC   <invalid>       no\ncontroller-manager.conf    Sep 04, 2026 03:11 UTC   <invalid>       no\nfront-proxy-client         Sep 04, 2026 03:11 UTC   <invalid>       no\nscheduler.conf             Sep 04, 2026 03:11 UTC   <invalid>       no\n\nCERTIFICATE AUTHORITY      EXPIRES                  RESIDUAL TIME\nca                         Sep 02, 2035 03:11 UTC   8y\netcd-ca                    Sep 02, 2035 03:11 UTC   8y\n\n⚠️ Saare client certificates expire ho chuke hain. CA 8 saal aur chalegi — sirf renew chahiye.',
            },
            {
              re: /kubeadm certs renew all/,
              out: (s) => {
                s.cluster.renewed = true;
                return 'certificate embedded in the kubeconfig file for the admin to use renewed\ncertificate for serving the Kubernetes API renewed\ncertificate the apiserver uses to access etcd renewed\ncertificate for the API server to connect to kubelet renewed\ncertificate embedded in the kubeconfig file for the controller manager to use renewed\ncertificate for the front proxy client renewed\ncertificate embedded in the kubeconfig file for the scheduler manager to use renewed\n\nDone renewing certificates. You must restart the kube-apiserver, kube-controller-manager,\nkube-scheduler and etcd, so that they can use the new certificates.\n\n⚠️ Certificates renew ho gaye par tumhari ~/.kube/config mein abhi bhi PURANA certificate hai.';
              },
            },
            { re: /curl -sk? https?:\/\/\S*healthz/, out: 'ok' },
          ],
          files: {
            'copy-admin-conf.yaml': {
              desc: '/etc/kubernetes/admin.conf ko ~/.kube/config par copy karta hai (naya certificate embedded ke saath)',
              apply: s => {
                if (!s.cluster.renewed)
                  return '⚠️ admin.conf mein abhi bhi purana expired certificate hai. Pehle "sudo kubeadm certs renew all" chalao, tab admin.conf copy karo.';
                s.cluster.apiReachable = true;
                return 'cp /etc/kubernetes/admin.conf ~/.kube/config\n\n$ kubectl get nodes\nNAME   STATUS   ROLES           AGE    VERSION\ncp-1   Ready    control-plane   366d   v1.30.2\n\n✅ kubectl wapas chal raha hai. Yaad rakho: renew ke baad naya admin.conf lena zaroori tha, kyunki purani kubeconfig mein purana certificate EMBEDDED tha.';
              },
            },
            'skip-tls.yaml': {
              desc: 'kubeconfig mein insecure-skip-tls-verify: true lagata hai',
              apply: () => 'error: specifying a root certificates file with the insecure flag is not allowed\n\n⚠️ Aur agar chal bhi jaata, to kaam nahi karta. <code>--insecure-skip-tls-verify</code> ka asar sirf itna hai ki client SERVER ka certificate verify na kare. Yahan CLIENT ka certificate expire hua hai — API server usse reject kar raha hai. Flag galat problem par lagaya ja raha hai.',
            },
            'reset-cluster.yaml': {
              desc: 'kubeadm reset karke cluster dobara banata hai',
              apply: () => '⚠️ ROKO. check-expiration ne dikhaya tha ki CA 8 saal aur chalegi. CA zinda ho to poora cluster dobara banane ki zaroorat bilkul nahi — "kubeadm certs renew all" kuch second ka kaam hai. Reset se saare workloads, saare secrets aur saara etcd data chala jayega.',
            },
          },
          success: allOf(T_CERT),
          successText: 'Do cheezein yaad rakhne layak. <b>Pehli:</b> certificate expiry se applications nahi rukti — chal rahe pods, kube-proxy ke rules, sab kaam karte rehte hain; sirf control plane tak <i>admin ki pahunch</i> rukti hai. <b>Doosri:</b> <code>kubeadm certs renew all</code> ke baad naya <code>admin.conf</code> lena zaroori hai, kyunki purani kubeconfig mein purana certificate <b>embedded</b> hota hai — file khud badalti nahi. Aur CA 10 saal ki hoti hai, isliye leaf certificates expire hone par cluster dobara banane ka sawal hi nahi uthta.',
          hints: [
            'sudo kubeadm certs check-expiration — dekho kya expire hua aur CA kitni bachi hai',
            'CA 8 saal aur chalegi, isliye sirf renew chahiye: sudo kubeadm certs renew all',
            'Renew ke baad bhi purani kubeconfig mein purana certificate embedded hai',
            'ls chalao — copy-admin-conf.yaml se naya kubeconfig lo',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Ek user ko <code>Unauthorized</code> (401) mil raha hai aur doosre ko <code>Forbidden</code> (403). Dono ke liye kahan dekhoge?"',
            choices: [
              '401 = pehchaan hi nahi bani (certificate/CA/token ka masla). 403 = pehchaan ban gayi par RBAC permission nahi. Do bilkul alag jagah',
              'Dono RBAC ka masla hai',
              'Dono certificate ka masla hai',
              '401 = RBAC, 403 = certificate',
            ],
            answer: 0,
            explain: '<b>401 Unauthorized</b> authentication ka padav hai — API server yeh tay hi nahi kar paaya ki tum kaun ho. Wajah: certificate expire, galat CA se signed, ya token invalid. <b>403 Forbidden</b> authorization ka padav hai — API server jaanta hai ki tum kaun ho (message mein aksar naam bhi likha hota hai: <code>User "alice" cannot list pods</code>) par RBAC ne mana kar diya. 403 asli mein ek achhi khabar hai: iska matlab certificate bilkul theek kaam kar raha hai. Debug: <code>kubectl auth can-i list pods --as=alice -n shop</code>.',
          },
          {
            terminal: {
              title: '🎤 Interview mission: naye user ko cluster tak pahunch do',
              instructions: 'Interviewer chahta hai ki tum RBAC aur certificate ka farq saabit karo.',
              goal: '🧑‍💼 Interviewer: "alice ka CSR approve ho chuka hai aur usse certificate mil gaya hai, par har command par <code>Forbidden</code> aa raha hai. Pehle saabit karo ki masla RBAC ka hai, phir theek karo."',
              tasks: [
                { text: 'alice ki permission check karo (auth can-i --as=alice)', check: s => s.history.some(h => /auth can-i .*--as=alice/.test(h)) },
                { text: 'alice ko shop namespace mein edit ka access do', check: s => s.cluster.aliceCanEdit === true },
              ],
              cluster: {
                aliceCanEdit: false,
                nodes: [{ name: 'cp-1', status: 'Ready', roles: 'control-plane', age: '30d', version: 'v1.30.2' }],
                pods: [{ name: 'shop-api-1', ready: '1/1', status: 'Running', restarts: 0, age: '30d', node: 'cp-1', ip: '10.244.1.5', logs: 'ok' }],
                deployments: [{ name: 'shop-api', ready: '1/1', upToDate: 1, available: 1, age: '30d' }],
                services: [],
              },
              responses: [
                {
                  re: /auth can-i \S+ \S+ .*--as=alice|auth can-i .*--as=alice/,
                  out: (s) => s.cluster.aliceCanEdit
                    ? 'yes'
                    : 'no - RBAC: no RoleBinding or ClusterRoleBinding found for user "alice"\n\n💡 Gaur karo: jawab "no" hai, koi certificate error nahi. Matlab API server ne alice ko PEHCHAAN liya (certificate theek hai) par koi permission nahi mili.',
                },
                {
                  re: /^(kubectl|k) create rolebinding \S+.*--user=alice/,
                  out: (s) => { s.cluster.aliceCanEdit = true; return 'rolebinding.rbac.authorization.k8s.io/alice-edit created\n\n✅ Ab "kubectl auth can-i create deployments --as=alice -n shop" yes dega.'; },
                },
              ],
              success: s => s.history.some(h => /auth can-i .*--as=alice/.test(h)) && s.cluster.aliceCanEdit === true,
              successText: '<code>Forbidden</code> asli mein achhi khabar thi — <code>Forbidden</code> ka matlab hai ki certificate poori tarah kaam kar raha hai aur API server ne alice ko pehchaan liya. Sirf RBAC binding nahi thi. <b>Certificate = pehchaan, RBAC = ijaazat</b> — dono hamesha alag kadam hain, aur error ka code (401 vs 403) hi bata deta hai ki kaunsa kadam toota hai.',
              hints: [
                'Pehle saabit karo masla kahan hai: kubectl auth can-i create deployments --as=alice -n shop',
                'Jawab "no" hai, koi x509 error nahi — matlab certificate theek hai',
                'kubectl create rolebinding alice-edit --clusterrole=edit --user=alice -n shop',
              ],
            },
          },
        ],
      },
      success: [
        'Main kubeconfig ke teen hisse (cluster, user, context) alag-alag bata sakta hoon',
        'Main x509 ke teeno errors (expired / unknown authority / not valid for) mein farq kar sakta hoon',
        'Main jaanta hoon ki 401 authentication ka aur 403 authorization ka masla hai',
        'Main kubeadm certs renew kar sakta hoon aur naya admin.conf lena nahi bhoolta',
      ],
      homework: `<p>Apna certificate padho:</p>
        <pre>kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' \\
  | base64 -d | openssl x509 -noout -subject -dates
# Subject ka CN = tumhara username, O = tumhare groups</pre>
        <p>Aur naya user bana ke dekho ki certificate ijaazat nahi deta:</p>
        <pre>openssl genrsa -out bob.key 2048
openssl req -new -key bob.key -out bob.csr -subj "/CN=bob/O=developers"
# CSR banao, approve karo, certificate nikalo (upar wala template)

kubectl auth can-i list pods --as=bob          # no
kubectl create rolebinding bob-view --clusterrole=view --user=bob
kubectl auth can-i list pods --as=bob          # yes</pre>
        <p>kubeadm cluster hai to expiry zaroor check karo — kabhi na kabhi kaam aayega:
        <code>sudo kubeadm certs check-expiration</code></p>`,
      cards: [
        { front: 'kubeconfig ke teen hisse?', back: '<b>clusters</b> (kahan jana + kispar bharosa: server URL + CA), <b>users</b> (tum kaun ho: client cert + key), <b>contexts</b> (kaun + kahan + kis namespace mein). <code>current-context</code> chunta hai kaunsa chalega.' },
        { front: 'API server username kahan se leta hai?', back: 'Client certificate ke <b>CN</b> field se username, aur <b>O</b> field se group. Kubernetes mein User naam ka koi object hota hi nahi.' },
        { front: '401 vs 403 — kya farq hai?', back: '<b>401 Unauthorized</b> = pehchaan hi nahi bani (certificate expire, galat CA, invalid token). <b>403 Forbidden</b> = pehchaan ban gayi par RBAC ne mana kiya. 403 ka matlab certificate theek kaam kar raha hai.' },
        { front: 'kubeadm certificates kitne samay ke hote hain?', back: 'Client/serving certificates <b>1 saal</b>, CA <b>10 saal</b>. Har <code>kubeadm upgrade apply</code> par apne aap renew hote hain — isliye jo cluster saal bhar chhua na jaye, uska certificate chup-chaap expire ho jaata hai.' },
        { front: 'Certificate expire hone par applications rukti hain?', back: '<b>Nahi.</b> Chal rahe pods, kubelet ke containers aur kube-proxy ke rules sab chalte rehte hain. Sirf control plane tak admin ki pahunch rukti hai (naye deploy aur scaling nahi ho sakti).' },
        { front: 'renew ke baad bhi kubectl kyun nahi chalta?', back: 'Purani kubeconfig mein purana certificate <b>embedded</b> hota hai — renew se file khud nahi badalti. Naya lo: <code>cp /etc/kubernetes/admin.conf ~/.kube/config</code>. Static pods ko bhi restart karna hota hai.' },
      ],
    },

    /* ============================================================
       13. Hardening — CKS/KCSA
       ============================================================ */
    {
      id: 'kk-hardening',
      icon: '🛡️',
      title: 'Hardening — securityContext, seccomp, AppArmor aur supply chain',
      badge: 'Kavach Karta',
      objectives: [
        '4C ka model (Cloud, Cluster, Container, Code) aur har layer ka apna control jaanna',
        'securityContext ke paanch zaroori field sahi lagana',
        'seccomp, AppArmor aur Linux capabilities mein farq karna',
        'Supply chain ke controls: image scanning, SBOM, allowed registries, aur admission policy',
      ],
      lesson: [
        `<h3>🛡️ securityContext — paanch field jo 90% kaam kar dete hain</h3>
         <pre>securityContext:
  runAsNonRoot: true              # container root banke chala to kubelet usse chalne hi nahi dega
  runAsUser: 10001                # koi bhi non-zero UID
  allowPrivilegeEscalation: false # setuid binary se root nahi ban sakte (no_new_privs)
  readOnlyRootFilesystem: true    # / read-only; likhna hai to emptyDir mount karo
  capabilities:
    drop: ["ALL"]                 # Docker ke default 14 capabilities bhi hata do
    add:  ["NET_BIND_SERVICE"]    # sirf jo sach mein chahiye (port &lt;1024 bind karne ke liye)</pre>
         <p><b>Pod-level aur container-level securityContext alag hain.</b> Pod ke level par
         <code>fsGroup</code> aur <code>runAsUser</code> lagte hain jo saare containers par asar
         karte hain. Container ke level par likha hua pod ke level ko <b>overwrite</b> kar deta hai.
         <code>capabilities</code> aur <code>readOnlyRootFilesystem</code> sirf container ke
         level par lagte hain.</p>

         <h3>🔒 Teen alag suraksha layer — teeno alag cheez rokte hain</h3>
         <table class="kk-tbl">
           <tr><th>Control</th><th>Kya rokta hai</th><th>Kaise lagta hai</th></tr>
           <tr><td><b>Linux capabilities</b></td><td>Root ke <b>adhikar</b> ke tukde — <code>NET_ADMIN</code>, <code>SYS_TIME</code>, <code>CHOWN</code></td><td><code>capabilities.drop: ["ALL"]</code></td></tr>
           <tr><td><b>seccomp</b></td><td>Poore <b>syscalls</b> — kernel se kaunsi baat ho sakti hai</td><td><code>seccompProfile.type: RuntimeDefault</code></td></tr>
           <tr><td><b>AppArmor</b></td><td><b>File paths</b> aur uske adhikar — kaunsi file padhi/likhi ja sakti hai</td><td>Annotation ya (v1.30+) <code>appArmorProfile</code> field</td></tr>
         </table>
         <p>Teeno saath lagte hain aur ek doosre ka kaam nahi karte. Capability <code>SYS_TIME</code>
         hataane se container ghadi nahi badal sakta, par file abhi bhi padh sakta hai.
         seccomp <code>RuntimeDefault</code> ~44 khatarnak syscalls block karta hai (jaise
         <code>kexec_load</code>, <code>bpf</code>), par allowed syscalls se file abhi bhi padhi ja
         sakti hai. AppArmor path-level par rokta hai.</p>
         <div class="war-story"><b>⚡ Sabse aam ek line ka sudhaar:</b>
         <code>seccompProfile: { type: RuntimeDefault }</code>. Default seccomp profile
         <b>Unconfined</b> hoti hai — yaani container kernel se koi bhi syscall kar sakta hai.
         <code>RuntimeDefault</code> lagate hi container runtime ki curated blocklist lag jaati hai,
         aur 99% applications par koi asar nahi padta.</p></div>`,

        `<h3>📦 Supply chain — image kahan se aayi aur usme kya hai</h3>
         <table class="kk-tbl">
           <tr><th>Control</th><th>Kya karta hai</th><th>Aujaar</th></tr>
           <tr><td><b>Base image chhoti karo</b></td><td>Kam packages = kam CVE. distroless mein shell tak nahi hota</td><td><code>gcr.io/distroless/*</code>, alpine, scratch</td></tr>
           <tr><td><b>Vulnerability scanning</b></td><td>Known CVE dhoondhna, build ke waqt aur registry mein</td><td>Trivy, Grype</td></tr>
           <tr><td><b>SBOM</b></td><td>Har package ki list — naya CVE aane par turant pata chale kaun-kaun affected hai</td><td>Syft (SPDX / CycloneDX format)</td></tr>
           <tr><td><b>Allowed registries</b></td><td>Sirf bharose ke registry se image chale</td><td>OPA Gatekeeper, Kyverno, ImagePolicyWebhook</td></tr>
           <tr><td><b>Image signing</b></td><td>Saabit karna ki image tumhare pipeline ne banayi hai</td><td>Cosign / Sigstore</td></tr>
           <tr><td><b>Manifest linting</b></td><td>Deploy se pehle hi galat securityContext pakadna</td><td>KubeLinter, kubesec</td></tr>
         </table>
         <p><b>Admission control</b> hi wo jagah hai jahan policy asli mein lagoo hoti hai:</p>
         <pre># Pod Security Admission — namespace label se, kuch install kiye bina
kubectl label ns shop \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/warn=restricted

# Teen level: privileged (kuch nahi rokta) &lt; baseline (jaani-maani badi cheezein rokta hai)
#             &lt; restricted (runAsNonRoot + drop ALL + seccomp RuntimeDefault maangta hai)</pre>
         <p>Zyada bareek niyam chahiye (jaise "sirf ghcr.io/acme/* se image") to
         <b>Kyverno</b> ya <b>OPA Gatekeeper</b> chahiye, ya Kubernetes ka apna
         <b>ValidatingAdmissionPolicy</b> (CEL expressions, koi webhook nahi).</p>
         <p><b>Runtime pe nazar:</b> <b>Falco</b> chalte hue containers ke syscalls dekhta hai aur
         shaq wale kaam par alert karta hai — "container ke andar shell khula", "/etc/shadow padha gaya",
         "outbound connection ek naye IP par". Admission control deploy ke waqt rokta hai;
         Falco chalte hue pakadta hai. Dono ki zaroorat hai.</p>`,
      ],
      stages: [
        {
          type: 'bins',
          title: 'Control ko sahi layer mein daalo',
          instructions: 'Har suraksha control ko us layer ke bin mein daalo jahan control asli mein lagta hai.',
          bins: [
            { id: 'cluster', label: '☸️ Cluster (API/RBAC/policy)' },
            { id: 'container', label: '📦 Container (runtime)' },
            { id: 'supply', label: '🚚 Supply chain (build/registry)' },
            { id: 'node', label: '🖥️ Node (OS)' },
          ],
          items: [
            { text: 'seccompProfile: RuntimeDefault', bin: 'container', explain: 'Container ke chalne ke waqt syscalls par pehra. Default Unconfined hoti hai — RuntimeDefault ~44 khatarnak syscalls block karti hai bina 99% applications ko chhue.' },
            { text: 'capabilities.drop: ["ALL"]', bin: 'container', explain: 'Container runtime ke default 14 Linux capabilities hata deta hai. Sirf wahi wapas add karo jo application sach mein maangti hai (jaise port 80 bind karne ke liye NET_BIND_SERVICE).' },
            { text: 'pod-security.kubernetes.io/enforce=restricted', bin: 'cluster', explain: 'Pod Security Admission API server ke andar hi chalta hai — koi controller install nahi karna padta. Namespace ka ek label pod ke banne se pehle hi galat spec reject kar deta hai.' },
            { text: 'RBAC — ServiceAccount ko sirf zaroori verbs dena', bin: 'cluster', explain: 'API server ka authorization padav. Compromise hone par bhi attacker sirf utna hi kar payega jitna us ServiceAccount ko diya gaya hai. Default ServiceAccount ke token ko automount karna band karo (<code>automountServiceAccountToken: false</code>).' },
            { text: 'Trivy se image scan karna CI mein', bin: 'supply', explain: 'Build ke waqt CVE pakadna sabse sasta hai. Cluster tak vulnerable image pahunchne se pehle hi pipeline fail ho jaati hai.' },
            { text: 'Cosign se image sign karna', bin: 'supply', explain: 'Saabit karta hai ki image tumhare pipeline ne banayi hai. Admission policy phir bina signature wali image ko cluster mein aane hi nahi deti.' },
            { text: 'Sirf ghcr.io/acme/* registry allow karna', bin: 'supply', explain: 'Kyverno/Gatekeeper policy ya ImagePolicyWebhook. Random public image cluster mein aane hi nahi deti — supply chain ka sabse bada darwaza yahi hai.' },
            { text: 'AppArmor profile jo /etc/shadow padhna rokti hai', bin: 'container', explain: 'AppArmor path-level Mandatory Access Control hai. Capabilities root ke adhikar rokti hain, seccomp syscalls rokti hai, aur AppArmor batati hai kaunsi file padhi/likhi ja sakti hai.' },
            { text: 'kube-bench se CIS benchmark chalana', bin: 'node', explain: 'kube-bench node ki configuration ko CIS Kubernetes Benchmark se milaata hai — kubelet ke flags, file permissions, API server ke arguments. Node/OS level ki jaanch hai.' },
            { text: 'Nodes ka cloud metadata endpoint block karna (169.254.169.254)', bin: 'node', explain: 'Bina block kiye koi bhi pod node ka IAM role credential nikal sakta hai aur poore cloud account tak pahunch sakta hai. NetworkPolicy ya iptables se block karo, aur IMDSv2 zaroori karo.' },
            { text: 'Falco alert: "container ke andar shell khula"', bin: 'node', explain: 'Falco node par eBPF/kernel module se syscalls dekhta hai. Admission control <i>deploy ke waqt</i> rokta hai; Falco <i>chalte hue</i> pakadta hai — dono zaroori hain.' },
            { text: 'ValidatingAdmissionPolicy (CEL) se latest tag mana karna', bin: 'cluster', explain: 'Kubernetes ka apna admission control — CEL expressions API server ke andar chalte hain, koi webhook pod nahi. Webhook wale controllers ke mukable ek kam single point of failure.' },
          ],
        },
        {
          type: 'fill',
          title: '📄 Hardened pod spec',
          instructions: 'Ek restricted PodSecurity namespace mein chalne layak spec poori karo. Application port 8080 par sunti hai aur <code>/tmp</code> mein likhti hai.',
          template: `apiVersion: v1
kind: Pod
metadata:
  name: hardened
  namespace: shop
spec:
  securityContext:
    runAsNonRoot: {0}          # kubelet root wale container ko chalne hi nahi dega
    runAsUser: 10001
    seccompProfile:
      type: {1}                # default Unconfined hoti hai — badalna zaroori hai
  containers:
    - name: app
      image: ghcr.io/acme/app@sha256:9f2c…    # digest se pin (mutable tag nahi)
      securityContext:
        allowPrivilegeEscalation: {2}
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["{3}"]
      volumeMounts:
        - name: tmp
          mountPath: /tmp      # readOnlyRootFilesystem ke saath likhne ki jagah
  volumes:
    - name: tmp
      emptyDir: {}`,
          blanks: [
            { answer: 'true', explain: '<code>runAsNonRoot: true</code> ke saath kubelet image ke user ko check karta hai aur UID 0 hone par container chalata hi nahi (status <code>CreateContainerConfigError</code> ke saath "container has runAsNonRoot and image will run as root"). <code>restricted</code> PodSecurity level ismein zaroori maangta hai.' },
            { answer: 'RuntimeDefault', explain: 'Default seccomp profile <b>Unconfined</b> hoti hai, yaani koi bhi syscall allowed. <code>RuntimeDefault</code> container runtime ki curated blocklist lagati hai (~44 khatarnak syscalls block). Ek line ka sabse bada faayda.' },
            { answer: 'false', explain: '<code>allowPrivilegeEscalation: false</code> kernel ka <code>no_new_privs</code> flag lagata hai — setuid binary chalane par bhi process naye adhikar nahi pa sakta. <code>restricted</code> level ismein zaroori maangta hai.' },
            { answer: 'ALL', explain: '<code>drop: ["ALL"]</code> container runtime ke default 14 capabilities hata deta hai. Application ko port 8080 chahiye (1024 se upar), isliye <code>NET_BIND_SERVICE</code> bhi wapas add karne ki zaroorat nahi.' },
          ],
          tokens: ['true', 'RuntimeDefault', 'false', 'ALL', 'Unconfined', 'NET_ADMIN', 'Localhost', 'SYS_ADMIN'],
        },
        {
          type: 'terminal',
          title: '🖥️ Mission: restricted namespace mein pod chalao',
          instructions: 'Pod reject ho raha hai. Namespace ke PodSecurity labels padho, phir spec ko us level ke hisaab se theek karo.',
          goal: 'Pod ko Running karo. <code>kubectl describe pod</code> se reject hone ki wajah padho, <code>kubectl get ns --show-labels</code> se PodSecurity level dekho, phir <code>ls</code> se sahi spec lagao.',
          tasks: T_HARDEN,
          cluster: {
            nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.30.2' }],
            pods: [
              { name: 'legacy-app-7c8d9e0f1-aa1bb', ready: '0/1', status: 'CreateContainerConfigError', restarts: 0, age: '6m', node: 'node-1', ip: '10.244.1.9', hardened: false,
                logs: 'Error from server (BadRequest): container "app" in pod "legacy-app-7c8d9e0f1-aa1bb" is waiting to start: CreateContainerConfigError',
                describe: 'Name:       legacy-app-7c8d9e0f1-aa1bb\nNamespace:  shop\nContainers:\n  app:\n    State:          Waiting\n      Reason:       CreateContainerConfigError\n    Image:          acme/legacy:1.4\n    SecurityContext:\n      runAsNonRoot:  true\nEvents:\n  Warning  Failed  6m (x18 over 6m)  kubelet  Error: container has runAsNonRoot and image will run as root (pod: "legacy-app-7c8d9e0f1-aa1bb", container: app)',
                events: ['Warning  Failed  6m (x18 over 6m)  kubelet  Error: container has runAsNonRoot and image will run as root'] },
            ],
            deployments: [{ name: 'legacy-app', ready: '0/1', upToDate: 1, available: 0, age: '6m' }],
            services: [],
          },
          responses: [
            {
              re: /^(kubectl|k) get (ns|namespaces?)\b.*--show-labels/,
              out: 'NAME          STATUS   AGE    LABELS\ndefault       Active   40d    kubernetes.io/metadata.name=default\nshop          Active   40d    kubernetes.io/metadata.name=shop,pod-security.kubernetes.io/enforce=restricted,pod-security.kubernetes.io/warn=restricted\n\n💡 shop namespace par "restricted" enforce laga hai — restricted level runAsNonRoot, drop ALL capabilities, allowPrivilegeEscalation false aur seccompProfile RuntimeDefault maangta hai.',
            },
          ],
          files: {
            'hardened-spec.yaml': {
              desc: 'runAsUser 10001, drop ALL, allowPrivilegeEscalation false, seccomp RuntimeDefault — poora restricted-compliant spec',
              apply: s => {
                const p = s.cluster.pods[0];
                p.status = 'Running'; p.ready = '1/1'; p.hardened = true;
                p.logs = '{"msg":"app started as uid 10001"}\n{"msg":"listening on :8080"}';
                p.describe = 'Name: legacy-app-8d9e0f1g2-cc2dd\nNamespace: shop\nContainers:\n  app:\n    State: Running\n    SecurityContext:\n      runAsNonRoot: true\n      runAsUser: 10001\n      allowPrivilegeEscalation: false\n      readOnlyRootFilesystem: true\n      capabilities: { drop: [ALL] }\n      seccompProfile: { type: RuntimeDefault }';
                s.cluster.deployments[0].ready = '1/1'; s.cluster.deployments[0].available = 1;
                return 'deployment.apps/legacy-app configured\n✅ Pod Running hai. runAsUser: 10001 diya gaya, isliye kubelet ko pata chal gaya ki container root nahi banega.';
              },
            },
            'drop-runasnonroot.yaml': {
              desc: 'runAsNonRoot: true hata deta hai taaki image root ke roop mein chal sake',
              apply: () => 'Error from server (Forbidden): admission webhook denied the request:\npods "legacy-app-…" is forbidden: violates PodSecurity "restricted:latest":\nrunAsNonRoot != true, allowPrivilegeEscalation != false,\nunrestricted capabilities (container "app" must set securityContext.capabilities.drop=["ALL"]),\nseccompProfile (pod or container must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")\n\n⚠️ Ab Pod Security Admission ne pod ko BANNE hi nahi diya. Namespace par restricted enforce laga hai — runAsNonRoot hataana ulta aur bura hai.',
            },
            'label-privileged.yaml': {
              desc: 'shop namespace ka PodSecurity level restricted se privileged karta hai',
              apply: () => 'namespace/shop labeled\n\n⚠️ Pod chal to jayega, par tumne poore production namespace ki suraksha hata di — sirf ek purani image chalane ke liye. Sahi jawab image ko theek karna hai, policy ko girana nahi. (Agar sach mein exception chahiye, to us workload ke liye alag namespace banao — poora shop namespace mat kholo.)',
            },
          },
          success: allOf(T_HARDEN),
          successText: 'Do alag darwaze the aur dono ne alag jagah roka. <b>kubelet</b> ne <code>runAsNonRoot: true</code> par image ka user check kiya aur root dekh ke container banaya hi nahi (<code>CreateContainerConfigError</code>). Aur jab tumne <code>runAsNonRoot</code> hataane ki koshish ki, tab <b>Pod Security Admission</b> ne pod ko API server par hi reject kar diya (<code>Forbidden</code>). Yaad rakho: <b>policy girana kabhi fix nahi hota</b>. Sahi jawab spec ko level ke hisaab se theek karna hai; sach mein exception chahiye to alag namespace banao, poora production namespace mat kholo.',
          hints: [
            'kubectl describe pod legacy-app-7c8d9e0f1-aa1bb — Events padho',
            '"container has runAsNonRoot and image will run as root" — kubelet ne roka hai',
            'kubectl get ns --show-labels — dekho shop par kaunsa PodSecurity level laga hai',
            'ls chalao — hardened-spec.yaml poora restricted-compliant spec lagata hai',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Ek line ka badlav jo har container ki suraksha sabse zyada badhaye — kaunsa?"',
            choices: [
              'seccompProfile: { type: RuntimeDefault } — default Unconfined hoti hai, yaani container koi bhi syscall kar sakta hai',
              'runAsUser: 1000',
              'readOnlyRootFilesystem: true',
              'imagePullPolicy: Always',
            ],
            answer: 0,
            explain: 'Sabse chaunkane wali baat yeh hai ki Kubernetes ka default seccomp profile <b>Unconfined</b> hai — yaani container kernel se koi bhi syscall kar sakta hai, jisme container-escape wale khatarnak syscalls bhi shamil hain. <code>RuntimeDefault</code> container runtime ki curated blocklist lagata hai (~44 syscalls block, jaise <code>kexec_load</code>, <code>bpf</code>, <code>mount</code>) aur 99% applications par koi asar nahi padta. Baaki options bhi achhe hain par kam asar dete hain: <code>runAsUser</code> ke saath <code>runAsNonRoot: true</code> chahiye warna image apna user bhi de sakta hai; <code>readOnlyRootFilesystem</code> zaroori hai par escape nahi rokta; <code>imagePullPolicy</code> ka suraksha se seedha rishta hi nahi.',
          },
          {
            q: 'Interviewer: "Team kehti hai ki unka pod restricted namespace mein nahi chal raha, isliye namespace ko privileged kar do. Tumhara jawab?"',
            choices: [
              'Nahi — pehle exact violation dekho (PodSecurity message poori list deta hai) aur spec theek karo. Sach mein exception chahiye to us workload ke liye alag namespace banao',
              'Haan, unblock karna sabse zaroori hai',
              'Haan, par baad mein ticket bana denge',
              'Nahi — restricted namespace mein koi pod chal hi nahi sakta',
            ],
            answer: 0,
            explain: 'PodSecurity ka error message har violation naam se likhta hai (<code>runAsNonRoot != true</code>, <code>seccompProfile</code>, <code>capabilities.drop</code>), isliye fix karne mein aksar 5 minute lagte hain. Namespace ko <code>privileged</code> karna us namespace ke <b>har</b> workload ki suraksha hata deta hai — aaj ka ek pod kal ke pachaas pods ka rasta khol deta hai. Agar koi workload sach mein privileged chahiye (jaise ek node agent), to usse apne alag namespace mein rakho jispe alag label ho, aur uske ServiceAccount ki RBAC bhi tight rakho. <b>Ek workload ke liye poora namespace kholna galat trade hai.</b>',
          },
        ],
      },
      success: [
        'Main securityContext ke paanch zaroori field bina dekhe likh sakta hoon',
        'Main capabilities, seccomp aur AppArmor ke kaam alag-alag bata sakta hoon',
        'Main jaanta hoon ki default seccomp profile Unconfined hoti hai',
        'Main policy girane ki jagah spec theek karna chunta hoon',
      ],
      homework: `<p>PodSecurity ko khud aazmao:</p>
        <pre>kubectl create ns hard
kubectl label ns hard pod-security.kubernetes.io/enforce=restricted

kubectl run bad --image=nginx -n hard            # reject — poora violation message padho

kubectl run good --image=nginx -n hard --overrides='{
 "spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":10001,
   "seccompProfile":{"type":"RuntimeDefault"}},
 "containers":[{"name":"good","image":"nginxinc/nginx-unprivileged",
   "securityContext":{"allowPrivilegeEscalation":false,
     "capabilities":{"drop":["ALL"]}}}]}}'
kubectl get pod good -n hard
kubectl delete ns hard</pre>
        <p>Aur image scan karke dekho ki kitna farq padta hai:</p>
        <pre>trivy image nginx:latest --severity HIGH,CRITICAL | head -20
trivy image gcr.io/distroless/static-debian12 --severity HIGH,CRITICAL</pre>`,
      cards: [
        { front: 'securityContext ke paanch zaroori field?', back: '<code>runAsNonRoot: true</code> · <code>runAsUser: &lt;non-zero&gt;</code> · <code>allowPrivilegeEscalation: false</code> · <code>readOnlyRootFilesystem: true</code> · <code>capabilities.drop: ["ALL"]</code>. Plus <code>seccompProfile: RuntimeDefault</code>.' },
        { front: 'Default seccomp profile kya hoti hai?', back: '<b>Unconfined</b> — container koi bhi syscall kar sakta hai. <code>RuntimeDefault</code> lagana ek line ka sabse bada suraksha faayda hai (~44 khatarnak syscalls block, 99% apps par koi asar nahi).' },
        { front: 'capabilities vs seccomp vs AppArmor?', back: '<b>capabilities</b> = root ke adhikar ke tukde (NET_ADMIN, SYS_TIME). <b>seccomp</b> = kaunse syscalls allowed hain. <b>AppArmor</b> = kaunsi file paths padhi/likhi ja sakti hain. Teeno alag cheez rokte hain, teeno saath lagte hain.' },
        { front: 'Pod Security Admission ke teen level?', back: '<b>privileged</b> (kuch nahi rokta) · <b>baseline</b> (jaani-maani badi cheezein rokta hai — hostNetwork, privileged) · <b>restricted</b> (runAsNonRoot + drop ALL + allowPrivilegeEscalation false + seccomp RuntimeDefault maangta hai). Namespace label se lagta hai.' },
        { front: 'Admission control aur Falco mein kya farq hai?', back: '<b>Admission control</b> deploy ke waqt rokta hai (galat spec cluster mein aata hi nahi). <b>Falco</b> chalte hue pakadta hai (syscalls dekh ke alert). Dono chahiye — ek darwaza, doosra pehredaar.' },
        { front: 'Supply chain ke chaar control?', back: 'Chhoti base image (distroless) · CI mein Trivy scan · SBOM (Syft) taaki naya CVE aane par affected images turant milen · allowed-registry policy (Kyverno/Gatekeeper) + Cosign signing.' },
      ],
    },

    /* ============================================================
       14. BOSS
       ============================================================ */
    {
      id: 'kk-boss',
      icon: '👑',
      title: 'BOSS: KodeKloud Challenge — teen bimari, ek cluster',
      badge: 'Scenario Samrat',
      objectives: [
        'Ek hi cluster mein teen alag-alag bimariyon ko alag karna',
        'Har bimari ke liye sahi diagnostic raasta chunna, guess kiye bina',
        'Lakshan aur karan mein farq karna jab kai cheezein ek saath tooti hon',
        'Poora troubleshooting playbook ek saath chalana',
      ],
      lesson: [
        `<h3>👑 Aakhri imtihaan — teen bimari, ek saath</h3>
         <p>Asli outage mein cheezein saaf-saaf ek-ek karke nahi tootti. Ek deploy teen alag
         gadbadiyan la deta hai, aur teeno ke lakshan aapas mein ghul-mil jaate hain.
         Yahan tumhara kaam hai teeno ko <b>alag karna</b> aur har ek ka apna raasta chalana.</p>
         <p><b>Kram jo hamesha kaam karta hai:</b></p>
         <ol>
           <li><b>Poora namespace ek nazar mein dekho</b> — <code>kubectl get all</code>. Kitni cheezein tooti hain, ginto.</li>
           <li><b>Har toote pod ko uske status ke hisaab se baanto</b> — Pending? CrashLoop? Running par 0/1?
           Har status ka apna alag raasta hai.</li>
           <li><b>Ek waqt par ek bimari</b>. Teeno ke liye ek jaisa fix dhoondhne ki koshish mat karo —
           aksar teeno ka karan alag hota hai.</li>
           <li><b>Endpoints hamesha check karo</b>, chahe pods Running hi kyun na hon. Running pod ka
           matlab yeh nahi ki Service usse traffic bhej rahi hai.</li>
           <li><b>Har fix ke baad dobara dekho</b>. Ek fix doosri bimari ka lakshan badal sakta hai.</li>
         </ol>
         <div class="war-story"><b>⚡ Boss ki asli chunauti:</b> ek bimari doosri ko <b>chhupa</b> deti hai.
         Jab checkout-api ke saare pods Pending hain, tab payments ka endpoint khaali dikhega
         aur lagega ki payments ki Service tooti hai. Pehle Pending theek karo, phir dobara dekho —
         aadhi "bimariyan" apne aap gayab ho jaayengi. Isliye <b>ek waqt par ek fix, aur har fix ke baad
         dobara jaanch</b> — yahi tarika hai.</div>`,
      ],
      stages: [
        {
          type: 'triage',
          title: '🩺 Boss Triage: ek deploy, teen alag failure',
          instructions: 'Teeno bimariyon ko alag karo. Yaad rakho: ek jaisa status ka matlab ek jaisi wajah nahi hota.',
          symptom: `<b>15:20 — release ke 6 minute baad.</b> Namespace <code>shop</code>:<br>
            • <code>checkout-api</code> — teeno replicas Pending<br>
            • <code>payments-api</code> — CrashLoopBackOff, 9 restarts<br>
            • <code>catalog-api</code> — pods Running hain par users ko purana data dikh raha hai<br>
            Release mein sirf teen deployments aur ek ConfigMap badle the.`,
          commands: [
            {
              cmd: 'kubectl get all -n shop',
              clue: true,
              out: `NAME                                READY   STATUS             RESTARTS      AGE
pod/checkout-api-7d9c4b6f8-aa1bb    0/1     Pending            0             6m
pod/checkout-api-7d9c4b6f8-cc2dd    0/1     Pending            0             6m
pod/checkout-api-7d9c4b6f8-ee3ff    0/1     Pending            0             6m
pod/payments-api-6b5c4d3e2-gg4hh    0/1     CrashLoopBackOff   9 (24s ago)   6m
pod/catalog-api-5a4b3c2d1-ii5jj     1/1     Running            0             41d
pod/catalog-api-5a4b3c2d1-kk6ll     1/1     Running            0             41d

NAME                    TYPE        CLUSTER-IP     PORT(S)   AGE
service/checkout-api    ClusterIP   10.96.10.5     80/TCP    41d
service/payments-api    ClusterIP   10.96.10.6     80/TCP    41d
service/catalog-api     ClusterIP   10.96.10.7     80/TCP    41d`,
              note: 'Teen alag status: <b>Pending</b> (scheduler ne node hi nahi diya), <b>CrashLoopBackOff</b> (container start hokar mara), aur <b>Running 1/1</b> (pod bilkul theek hai). Teen alag status = teen alag raaste. catalog-api 41 din purana hai, yaani release ne uske pods ko chhua bhi nahi.',
            },
            {
              cmd: 'kubectl describe pod checkout-api-7d9c4b6f8-aa1bb -n shop | tail -5',
              clue: true,
              out: `Events:
  Type     Reason            Age                From               Message
  ----     ------            ----               ----               -------
  Warning  FailedScheduling  1m (x6 over 6m)    default-scheduler
    0/3 nodes are available: 3 Insufficient memory.
    preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.`,
              note: '<b>Bimari 1:</b> <code>3 Insufficient memory</code> — teeno nodes par memory ki booking bhari hui hai. Aur "No preemption victims found" ka matlab hai ki wajah sach mein capacity hai (taint ya selector hota to "Preemption is not helpful" likha hota).',
            },
            {
              cmd: 'kubectl get deploy checkout-api -n shop -o jsonpath="{.spec.template.spec.containers[0].resources}"',
              clue: true,
              out: `{"limits":{"cpu":"1","memory":"16Gi"},"requests":{"cpu":"1","memory":"16Gi"}}`,
              note: '<b>16Gi memory request</b> — har replica ke liye. Release mein kisi ne <code>1Gi</code> ki jagah <code>16Gi</code> likh diya (ek zero zyada). Cluster ke nodes 8Gi wale hain, isliye koi bhi node itna bada request kabhi poora nahi kar sakta.',
            },
            {
              cmd: 'kubectl logs payments-api-6b5c4d3e2-gg4hh -n shop --previous',
              clue: true,
              out: `{"level":"info","msg":"payments-api v3.1.0 starting"}
{"level":"info","msg":"loading config"}
{"level":"fatal","msg":"STRIPE_WEBHOOK_SECRET is empty, refusing to start"}`,
              note: '<b>Bimari 2:</b> bilkul alag wajah. payments-api container start to hua par ek missing environment variable par khud mar gaya. checkout-api ki memory wali baat se koi lena-dena nahi.',
            },
            {
              cmd: 'kubectl get endpoints -n shop',
              clue: true,
              out: `NAME           ENDPOINTS                             AGE
checkout-api   <none>                                41d
payments-api   <none>                                41d
catalog-api    10.244.1.51:8080,10.244.2.60:8080     41d`,
              note: 'Dhyaan se dekho. <code>checkout-api</code> aur <code>payments-api</code> ke endpoints khaali hain — <b>par yeh lakshan hai, karan nahi</b>. Endpoints isliye khaali hain kyunki unke pods ready hi nahi hain. <code>catalog-api</code> ke endpoints bhare hue hain, isliye catalog ki bimari kuch aur hai.',
            },
            {
              cmd: 'kubectl get cm catalog-settings -n shop -o jsonpath="{.data.FEATURE_FLAGS}"',
              clue: true,
              out: `new_pricing=true,bundles=true`,
              note: 'ConfigMap mein nayi value maujood hai. Release ne ConfigMap sahi update ki thi.',
            },
            {
              cmd: 'kubectl exec -n shop catalog-api-5a4b3c2d1-ii5jj -- printenv FEATURE_FLAGS',
              clue: true,
              out: `new_pricing=false,bundles=false`,
              note: '<b>Bimari 3:</b> ConfigMap mein nayi value hai par pod ke andar purani. catalog-api ke pods 41 din purane hain — ConfigMap badalne se <code>envFrom</code> wale environment variables nahi badalte. Pods ko naya banana padega.',
            },
            {
              cmd: 'kubectl top nodes',
              clue: false,
              out: `NAME     CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
node-1   410m         10%    3100Mi          38%
node-2   380m         9%     2900Mi          36%
node-3   350m         8%     2800Mi          35%`,
              note: 'Dead end, par yahi wo jaal hai jo aksar bhatka deta hai. Asli memory usage sirf ~37% hai, isliye nodes "khaali" lagte hain. Par scheduler asli usage dekhta hi nahi — scheduler requests ka jod dekhta hai, aur ek pod ne akele 16Gi maang liya hai.',
            },
          ],
          questions: [
            {
              q: 'checkout-api aur payments-api dono ke endpoints khaali hain. Kya dono ki bimari ek hai?',
              choices: [
                'Nahi — khaali endpoints dono jagah ek lakshan hai. checkout-api Pending hai (16Gi request), payments-api CrashLoop mein hai (missing env var). Endpoints isliye khaali hain kyunki dono ke pods ready nahi hain',
                'Haan — dono ke Service selectors galat hain',
                'Haan — dono ke targetPort galat hain',
                'Nahi — checkout-api ka selector galat hai aur payments-api ka targetPort',
              ],
              answer: 0,
              explain: 'Endpoints ek <b>derived</b> cheez hai: endpoint controller wahi pods daalta hai jo selector se match karein <b>aur</b> ready hon. Ek bhi ready pod na ho to endpoints khaali. Isliye khaali endpoints se hamesha selector par shaq karna galat hai — pehle dekho ki koi ready pod hai bhi ya nahi. Yahan checkout-api ke pods Pending hain aur payments-api ke pods CrashLoop mein — dono jagah zero ready pods, isliye dono jagah khaali endpoints. Dono ke fix bilkul alag hain.',
            },
            {
              q: 'catalog-api ke pods Running hain, endpoints bhare hain, phir bhi purana data dikh raha hai. Kyun?',
              choices: [
                'ConfigMap update ho gayi par pods 41 din purane hain — envFrom wale environment variables container ke banne ke waqt set hote hain aur pod restart ke bina nahi badalte',
                'catalog-api ki Service ka selector galat hai',
                'CoreDNS purana IP cache kiye baitha hai',
                'catalog-api ki readiness probe fail ho rahi hai',
              ],
              answer: 0,
              explain: 'Sabooot saaf hai: ConfigMap mein <code>new_pricing=true</code> hai par pod ke andar <code>printenv</code> ne <code>new_pricing=false</code> diya. Pods ki age 41 din hai, yaani unke containers ConfigMap ke purane version ke saath bane the. <code>envFrom</code> se aayi values pod ke dobara bane bina nahi badalti. Fix: <code>kubectl rollout restart deployment/catalog-api -n shop</code>, aur aage ke liye pod template mein config ka checksum annotation daalo.',
            },
            {
              q: 'Teeno ko theek karne ka sabse achha kram kya hai?',
              choices: [
                'Teeno ko alag-alag theek karo, aur har fix ke baad get all + get endpoints dobara chalao — kyunki ek fix doosri bimari ka lakshan badal sakta hai',
                'Poore namespace ko delete karke dobara deploy karo',
                'Pehle teeno deployments ko rollout undo karo, phir soch ke aage badho',
                'Nodes badha do — teeno ka karan capacity hi hai',
              ],
              answer: 0,
              explain: 'Teeno bimariyon ka karan alag hai (galat memory request, missing environment variable, stale config), isliye teeno ke fix bhi alag hain. Ek fix ke baad dobara dekhna zaroori hai kyunki lakshan aapas mein jude hote hain — checkout-api theek hote hi uske endpoints apne aap bhar jayenge, aur "endpoints tooti hai" wali theory apne aap khatm ho jayegi. <b>Namespace delete karna</b> asli galtiyan chhod dega aur naye pods bhi wahi teen bimariyan lekar aayenge. <b>Rollout undo</b> theek hai agar tumhe pata ho ki release se pehle sab theek tha — par catalog-api ki bimari release se pehle bhi maujood thi (ConfigMap 41 din se stale thi), isliye undo usse theek nahi karta.',
            },
          ],
        },
        {
          type: 'terminal',
          title: '🖥️ FINAL BOSS: teeno bimariyan theek karo',
          instructions: 'Poora playbook chalao. Ek waqt par ek bimari, aur har fix ke baad dobara jaanch.',
          goal: 'Saare pods <b>Running</b> karo aur teeno services ke endpoints sahi karo. Kram: <code>get all</code> → har toote pod ka apna raasta → <code>get endpoints</code> → fix → dobara jaanch.',
          tasks: T_BOSS,
          cluster: {
            nodes: [
              { name: 'node-1', status: 'Ready', roles: '<none>', age: '41d', version: 'v1.30.2', top: '10% 38%' },
              { name: 'node-2', status: 'Ready', roles: '<none>', age: '41d', version: 'v1.30.2', top: '9% 36%' },
              { name: 'node-3', status: 'Ready', roles: '<none>', age: '41d', version: 'v1.30.2', top: '8% 35%' },
            ],
            pods: [
              { name: 'checkout-api-7d9c4b6f8-aa1bb', ready: '0/1', status: 'Pending', restarts: 0, age: '6m', node: '<none>', ip: '<none>',
                describe: 'Name:      checkout-api-7d9c4b6f8-aa1bb\nNamespace: shop\nStatus:    Pending\nContainers:\n  api:\n    Requests:\n      cpu:     1\n      memory:  16Gi\nEvents:\n  Warning  FailedScheduling  1m (x6 over 6m)  default-scheduler  0/3 nodes are available: 3 Insufficient memory. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.',
                events: ['Warning  FailedScheduling  1m (x6 over 6m)  default-scheduler  0/3 nodes are available: 3 Insufficient memory.'] },
              { name: 'payments-api-6b5c4d3e2-gg4hh', ready: '0/1', status: 'CrashLoopBackOff', restarts: 9, age: '6m', node: 'node-2', ip: '10.244.2.44',
                logs: 'Error from server (BadRequest): container "api" in pod is waiting to start: CrashLoopBackOff',
                prevLogs: '{"level":"info","msg":"payments-api v3.1.0 starting"}\n{"level":"info","msg":"loading config"}\n{"level":"fatal","msg":"STRIPE_WEBHOOK_SECRET is empty, refusing to start"}',
                describe: 'Name:      payments-api-6b5c4d3e2-gg4hh\nNamespace: shop\nContainers:\n  api:\n    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1\n    Restart Count:  9\nEvents:\n  Warning  BackOff  24s (x38 over 6m)  kubelet  Back-off restarting failed container api',
                events: ['Warning  BackOff  24s (x38 over 6m)  kubelet  Back-off restarting failed container api'] },
              { name: 'catalog-api-5a4b3c2d1-ii5jj', ready: '1/1', status: 'Running', restarts: 0, age: '41d', node: 'node-1', ip: '10.244.1.51', stale: true,
                logs: '{"msg":"catalog-api serving, flags: new_pricing=false,bundles=false"}',
                exec: { 'printenv FEATURE_FLAGS': 'new_pricing=false,bundles=false', 'printenv': 'FEATURE_FLAGS=new_pricing=false,bundles=false\nPORT=8080' } },
              { name: 'catalog-api-5a4b3c2d1-kk6ll', ready: '1/1', status: 'Running', restarts: 0, age: '41d', node: 'node-2', ip: '10.244.2.60', stale: true,
                logs: '{"msg":"catalog-api serving, flags: new_pricing=false,bundles=false"}',
                exec: { 'printenv FEATURE_FLAGS': 'new_pricing=false,bundles=false', 'printenv': 'FEATURE_FLAGS=new_pricing=false,bundles=false\nPORT=8080' } },
            ],
            deployments: [
              { name: 'checkout-api', ready: '0/3', upToDate: 3, available: 0, age: '41d' },
              { name: 'payments-api', ready: '0/1', upToDate: 1, available: 0, age: '41d' },
              { name: 'catalog-api', ready: '2/2', upToDate: 2, available: 2, age: '41d' },
            ],
            services: [
              { name: 'checkout-api', type: 'ClusterIP', clusterIP: '10.96.10.5', ports: '80/TCP', age: '41d' },
              { name: 'payments-api', type: 'ClusterIP', clusterIP: '10.96.10.6', ports: '80/TCP', age: '41d' },
              { name: 'catalog-api', type: 'ClusterIP', clusterIP: '10.96.10.7', ports: '80/TCP', age: '41d' },
            ],
            endpoints: [
              { name: 'checkout-api', endpoints: '<none>', age: '41d', fixed: false },
              { name: 'payments-api', endpoints: '<none>', age: '41d', fixed: false },
              { name: 'catalog-api', endpoints: '10.244.1.51:8080,10.244.2.60:8080', age: '41d', fixed: true },
            ],
            configmaps: [{ name: 'catalog-settings', data: 1, age: '41d' }],
          },
          responses: [
            { re: /^(kubectl|k) (get|describe) (cm|configmap|configmaps)\b/, out: 'Name:      catalog-settings\nNamespace: shop\n\nData\n====\nFEATURE_FLAGS:\n----\nnew_pricing=true,bundles=true\n\n💡 ConfigMap mein NAYI value hai. Ab pod ke andar ki value se milao.' },
            { re: /^(kubectl|k) get (deploy|deployments?) \S+ -o ?jsonpath/, out: '{"limits":{"cpu":"1","memory":"16Gi"},"requests":{"cpu":"1","memory":"16Gi"}}\n\n💡 16Gi memory request — nodes 8Gi ke hain.' },
          ],
          files: {
            'fix-memory.yaml': {
              desc: 'checkout-api ka memory request+limit 16Gi se 1Gi karta hai (release mein ek zero zyada lag gaya tha)',
              apply: s => {
                let ip = 70;
                s.cluster.pods = s.cluster.pods.filter(p => !p.name.startsWith('checkout-api'));
                ['aa1bb', 'cc2dd', 'ee3ff'].forEach((sfx, i) => {
                  s.cluster.pods.unshift({ name: 'checkout-api-8e0d5c7g9-' + sfx, ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-' + (i + 1), ip: '10.244.' + (i + 1) + '.' + (ip++), logs: '{"msg":"checkout-api listening on :8080"}' });
                });
                const d = s.cluster.deployments.find(x => x.name === 'checkout-api');
                d.ready = '3/3'; d.available = 3;
                const e = s.cluster.endpoints.find(x => x.name === 'checkout-api');
                e.endpoints = '10.244.1.70:8080,10.244.2.71:8080,10.244.3.72:8080'; e.fixed = true;
                return 'deployment.apps/checkout-api configured\n✅ 1Gi request nodes par fit ho gaya — teeno pods Running hain aur endpoints apne aap bhar gaye.\n💡 Gaur karo: endpoints "tooti" nahi thi. Endpoints khaali the kyunki koi ready pod hi nahi tha.';
              },
            },
            'add-stripe-secret.yaml': {
              desc: 'payments-api mein STRIPE_WEBHOOK_SECRET jodta hai (secret pehle se maujood thi, deployment usse reference nahi kar rahi thi)',
              apply: s => {
                const p = s.cluster.pods.find(x => x.name.startsWith('payments-api'));
                if (!p) return 'payments-api pod nahi mila';
                p.status = 'Running'; p.ready = '1/1'; p.restarts = 0;
                p.logs = '{"level":"info","msg":"payments-api v3.1.0 listening on :8080"}';
                const d = s.cluster.deployments.find(x => x.name === 'payments-api');
                d.ready = '1/1'; d.available = 1;
                const e = s.cluster.endpoints.find(x => x.name === 'payments-api');
                e.endpoints = '10.244.2.44:8080'; e.fixed = true;
                return 'deployment.apps/payments-api configured\n✅ payments-api Running hai aur endpoint bhar gaya.';
              },
            },
            'restart-catalog.yaml': {
              desc: 'catalog-api ka rollout restart karta hai taaki naye pods nayi ConfigMap uthayein',
              apply: s => {
                s.cluster.pods = s.cluster.pods.filter(p => !p.name.startsWith('catalog-api'));
                [['ii5jj', 'node-1', '10.244.1.55'], ['kk6ll', 'node-2', '10.244.2.65']].forEach(([sfx, node, ip]) => {
                  s.cluster.pods.push({ name: 'catalog-api-6b5c4d3e2-' + sfx, ready: '1/1', status: 'Running', restarts: 0, age: '5s', node, ip, stale: false,
                    logs: '{"msg":"catalog-api serving, flags: new_pricing=true,bundles=true"}',
                    exec: { 'printenv FEATURE_FLAGS': 'new_pricing=true,bundles=true', 'printenv': 'FEATURE_FLAGS=new_pricing=true,bundles=true\nPORT=8080' } });
                });
                const e = s.cluster.endpoints.find(x => x.name === 'catalog-api');
                e.endpoints = '10.244.1.55:8080,10.244.2.65:8080'; e.fixed = true;
                return 'deployment.apps/catalog-api restarted\n✅ Naye pods ne nayi ConfigMap uthayi — flags ab new_pricing=true, bundles=true hain.';
              },
            },
            'add-nodes.yaml': {
              desc: 'cluster mein do aur 8Gi nodes jodta hai',
              apply: () => 'node/node-4 created\nnode/node-5 created\n\n⚠️ checkout-api abhi bhi Pending hai. Har naya node bhi 8Gi ka hai aur ek pod akele 16Gi maang raha hai — koi bhi 8Gi node 16Gi ka request kabhi poora nahi kar sakta. Asli galti request mein hai, cluster ke size mein nahi.',
            },
            'rollout-undo-all.yaml': {
              desc: 'teeno deployments ko pichhle revision par le jaata hai',
              apply: () => 'deployment.apps/checkout-api rolled back\ndeployment.apps/payments-api rolled back\ndeployment.apps/catalog-api rolled back\n\n⚠️ checkout-api aur payments-api to theek ho gaye, par catalog-api abhi bhi purana data de raha hai — catalog-api ki bimari release se AAYI hi nahi thi. ConfigMap 41 din se stale thi aur rollback usse theek nahi karta. Aur ab tum release ke sahi badlav bhi kho chuke ho.',
            },
          },
          success: allOf(T_BOSS),
          successText: `🏆 <b>Teen bimari, teen alag karan, teen alag fix.</b><br><br>
            <b>1. checkout-api Pending</b> — release mein memory request <code>1Gi</code> se <code>16Gi</code> ho gaya tha (ek zero zyada).
            <code>kubectl top nodes</code> ne 37% dikhaya tha aur bhatkaya tha — par scheduler asli usage dekhta hi nahi, scheduler requests ka jod dekhta hai.<br>
            <b>2. payments-api CrashLoop</b> — missing environment variable. Jawab sirf <code>--previous</code> logs mein tha.<br>
            <b>3. catalog-api stale</b> — pods Running the, endpoints bhare the, par 41 din purane containers purani ConfigMap chala rahe the. <code>envFrom</code> restart ke bina nahi badalta.<br><br>
            Aur sabse badi seekh: <b>khaali endpoints ek lakshan the, karan nahi.</b> Do services ke endpoints khaali the sirf isliye ki unka koi pod ready nahi tha. Pods theek hote hi endpoints apne aap bhar gaye — Service ko chhuna pada hi nahi.`,
          hints: [
            'kubectl get all -n shop — teen alag status hain, teen alag raaste',
            'Pending par: kubectl describe pod checkout-api-7d9c4b6f8-aa1bb (FailedScheduling padho)',
            'CrashLoop par: kubectl logs payments-api-6b5c4d3e2-gg4hh --previous',
            'Running par 0 asar: kubectl get cm catalog-settings, phir kubectl exec catalog-api-5a4b3c2d1-ii5jj -- printenv FEATURE_FLAGS',
            'kubectl get endpoints — dekho konsi khaali hain aur kyun',
            'ls chalao — fix-memory.yaml, add-stripe-secret.yaml aur restart-catalog.yaml teeno lagao',
          ],
        },
      ],
      interview: {
        questions: [
          {
            q: 'Interviewer: "Ek outage mein paanch cheezein ek saath tooti hui dikh rahi hain. Kahan se shuru karoge?"',
            choices: [
              'Har toote hue cheez ko uske status ke hisaab se baanto (Pending / CrashLoop / Running-not-ready), phir ek waqt par ek theek karo aur har fix ke baad dobara jaancho',
              'Poora namespace delete karke dobara deploy karo',
              'Saare deployments ko rollout undo kar do',
              'Aur nodes jod do — zyadatar outages capacity ke hote hain',
            ],
            answer: 0,
            explain: 'Bade outage mein sabse zaroori kaam hai <b>alag karna</b> — kyunki paanch lakshan aksar do ya teen karan se aate hain, aur kuch lakshan doosre lakshan ka <i>natija</i> hote hain (jaise khaali endpoints, jo asli mein "koi ready pod nahi" ka natija hai). Status ke hisaab se baantne se har group ka apna diagnostic raasta mil jaata hai. Ek waqt par ek fix karne se pata chalta rehta hai ki kaunsa fix kis lakshan ko hataata hai — aur aksar aadhe lakshan pehle fix ke baad hi gayab ho jaate hain.',
          },
          {
            terminal: {
              title: '🎤 Interview mission: paanch minute mein diagnose karo',
              instructions: 'Interviewer sirf diagnosis dekhna chahta hai — fix nahi.',
              goal: '🧑‍💼 Interviewer: "Yeh pod 0/1 Running hai. Paanch minute hain. Sirf batao ki kya toota hai — theek mat karo."',
              tasks: [
                { text: 'Pod ka status dekho', check: s => s.history.some(h => /^(kubectl|k) get (pods|po)\b/.test(h)) },
                { text: 'describe se probe ki error padho', check: s => s.history.some(h => /^(kubectl|k) describe (pod|po) \S+/.test(h)) },
                { text: 'Endpoints se confirm karo ki Service ne pod hata diya hai', check: s => s.history.some(h => /^(kubectl|k) get .*(endpoints|ep)\b/.test(h)) },
              ],
              cluster: {
                nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '12d', version: 'v1.30.2' }],
                pods: [
                  { name: 'search-api-9d8c7b6a5-aa1bb', ready: '0/1', status: 'Running', restarts: 0, age: '22m', node: 'node-1', ip: '10.244.1.88',
                    logs: '{"level":"info","msg":"search-api listening on :8080"}\n{"level":"warn","msg":"elasticsearch ping failed, /ready returns 503"}',
                    describe: 'Name:      search-api-9d8c7b6a5-aa1bb\nNamespace: default\nStatus:    Running\nContainers:\n  api:\n    State:      Running\n    Ready:      False\n    Restart Count: 0\n    Readiness:  http-get http://:8080/ready delay=5s timeout=1s period=10s #success=1 #failure=3\n    Liveness:   http-get http://:8080/healthz delay=5s timeout=1s period=10s #success=1 #failure=3\nEvents:\n  Warning  Unhealthy  30s (x120 over 22m)  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 503',
                    events: ['Warning  Unhealthy  30s (x120 over 22m)  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 503'] },
                ],
                deployments: [{ name: 'search-api', ready: '0/1', upToDate: 1, available: 0, age: '12d' }],
                services: [{ name: 'search-api', type: 'ClusterIP', clusterIP: '10.96.5.5', ports: '80/TCP', age: '12d' }],
                endpoints: [{ name: 'search-api', endpoints: '<none>', age: '12d' }],
              },
              success: s => ['get pods', 'describe pod', 'endpoints'].every((_, i) =>
                [/^(kubectl|k) get (pods|po)\b/, /^(kubectl|k) describe (pod|po) \S+/, /^(kubectl|k) get .*(endpoints|ep)\b/][i].test(s.history.find(h =>
                  [/^(kubectl|k) get (pods|po)\b/, /^(kubectl|k) describe (pod|po) \S+/, /^(kubectl|k) get .*(endpoints|ep)\b/][i].test(h)) || '')),
              successText: 'Poori kahani teen command mein: <b>Running par 0/1</b> = container zinda hai par readiness fail. <b>describe</b> = <code>Readiness probe failed: statuscode 503</code> aur restart count 0 (liveness bilkul nahi chhedi gayi, sirf readiness fail hai). <b>endpoints &lt;none&gt;</b> = Service ne pod ko traffic se hata diya. Aur logs ne wajah bhi de di: elasticsearch ping fail ho raha hai, isliye <code>/ready</code> 503 de raha hai. <b>Asli root cause search-api mein nahi, elasticsearch mein hai</b> — aur readiness probe ne bilkul wahi kiya jo usse karna chahiye tha: adhoore pod ko traffic se bachaya.',
              hints: [
                'kubectl get pods — Running par 0/1, restart count 0',
                'kubectl describe pod search-api-9d8c7b6a5-aa1bb — Events mein probe ka exact statuscode',
                'kubectl get endpoints — Service ne pod ko hata diya hai',
              ],
            },
          },
        ],
      },
      success: [
        'Main ek saath tooti hui kai cheezon ko status ke hisaab se alag kar sakta hoon',
        'Main lakshan (khaali endpoints) aur karan (koi ready pod nahi) mein farq karta hoon',
        'Main ek waqt par ek bimari theek karta hoon aur har fix ke baad dobara jaanchta hoon',
        'Main poora KodeKloud troubleshooting playbook bina hints ke chala sakta hoon',
      ],
      homework: `<p>Apna khud ka boss scenario banao — ek script jo teen alag bimariyan ek saath laaye:</p>
        <pre>kubectl create ns boss

# 1. Pending — request nodes se badi
kubectl create deployment big --image=nginx -n boss
kubectl set resources deploy/big -n boss --requests=memory=64Gi

# 2. CrashLoop — missing env
kubectl create deployment crash --image=busybox -n boss -- sh -c 'test -n "$NEEDED" || (echo NEEDED missing; exit 1); sleep 3600'

# 3. Running par 0/1 — readiness hamesha fail
kubectl create deployment notready --image=nginx -n boss
kubectl patch deploy notready -n boss -p '{"spec":{"template":{"spec":{"containers":[{"name":"nginx","readinessProbe":{"httpGet":{"path":"/nope","port":80},"periodSeconds":5}}]}}}}'

kubectl get all -n boss
kubectl get endpoints -n boss
# ab teeno ko alag-alag diagnose karo — playbook chalao
kubectl delete ns boss</pre>`,
      cards: [
        { front: 'Kai cheezein ek saath tooti hain — pehla kadam?', back: '<code>kubectl get all</code> se poora namespace dekho, phir har toote pod ko <b>status ke hisaab se baanto</b> (Pending / CrashLoop / Running-not-ready). Har status ka apna alag raasta hai.' },
        { front: 'Khaali endpoints — hamesha selector ki galti?', back: '<b>Nahi.</b> Endpoint controller sirf wahi pods daalta hai jo selector se match karein <b>aur ready hon</b>. Zero ready pods = khaali endpoints, chahe selector bilkul sahi ho. Pehle dekho koi ready pod hai bhi ya nahi.' },
        { front: 'Ek fix ke baad kya karna chahiye?', back: '<b>Dobara jaancho</b> — <code>get all</code> aur <code>get endpoints</code> phir se. Kai "bimariyan" asli mein doosri bimari ka natija hoti hain aur pehle fix ke baad apne aap gayab ho jaati hain.' },
        { front: 'Running par 0/1, restart count 0 — kya matlab?', back: 'Readiness fail ho rahi hai, liveness nahi (warna restart count badhta). Container zinda hai, Service ne usse endpoints se hata diya hai. Aksar asli root cause kisi <b>dependency</b> mein hota hai jise readiness probe check karti hai.' },
        { front: 'Poore namespace ko delete karke dobara deploy — kab sahi hai?', back: 'Lagbhag kabhi nahi. Asli galtiyan manifests mein hoti hain, isliye naye pods bhi wahi bimariyan lekar aayenge — aur beech mein tumne saara diagnostic evidence bhi mita diya.' },
      ],
    },
  ]);
})();
