/* =====================================================================
   KubeGurukul · "System Design and Architecture" playlist (Software Developer Diaries) — Kubernetes wala hissa
   Topic pehle se app mein → purane level ko BADHAYA (KG.extendLevel), naya level nahi:
     intermediate/probes ← #12 "The hidden cost of poorly-designed /health endpoints" — docker-labs/01-probes
   Saare numbers lab 01 ke asli run se (mini cluster: kubelet + endpoints + Service, Node processes).
   IIFE: games.js top level par `const el, shuffle, …` declare karti hai.
   ===================================================================== */
(function () {

KG.extendLevel('probes', {
  objectives: [
    '<b>Asli naap (lab 01):</b> deep liveness DB blip ko restart storm banata hai, deep readiness "zero targets" — shallow probes + app mein degrade',
    'Probe ka bill (4 pingers × pods), <code>startupProbe</code> vs <code>initialDelaySeconds</code> ka andaaza, aur SIGTERM par graceful drain',
  ],
  lesson: [
    `<h3>🩺 Ek deep <code>/healthz</code> ne teeno pods gira diye (lab 01)</h3>
     <p><b>Misaal:</b> society ka chowkidaar har ghante do sawaal poochhta hai. "Ghar mein koi <b>zinda</b> hai?" (liveness) aur
     "Kya ghar <b>mehmaan le sakta</b> hai?" (readiness). Paani ki supply (DB) band ho gayi toh ghar wala zinda hai — sirf mehmaan
     ko chai nahi pila sakta. Chowkidaar ghar tod de (restart) toh paani wapas nahi aata.</p>
     <p>3 pods (boot 6 s), DB t=6s se t=11s band, 40/s <code>/home</code> (DB nahi chahiye) + 40/s <code>/orders</code> (DB chahiye):</p>
     <pre>probe setup                        /home   /home (DB band ke dauraan)   /orders   restarts   DB wapas → /orders theek
liveness DB check karta hai        59.0%          17.5%                     55.0%       3          4.9 s baad
sirf readiness DB check karta hai  77.2%          19.5%                     72.7%       0          1.0 s baad
dono shallow, app khud degrade    100.0%         100.0%                     77.3%       0          0.0 s baad</pre>
     <ol>
       <li><b>Liveness mein DB check kyun galat?</b> DB 3 s gaya → kubelet ne teeno pods restart kiye → DB wapas aaya tab pods boot kar
         rahe the. 5 s ki blip → ~10 s ka outage.</li>
       <li><b>Readiness mein shared DB check kyun khatarnak?</b> Teeno pods ek saath NOT READY → endpoints khaali → <code>/home</code> bhi
         gaya (19.5%), jise DB chahiye hi nahi tha. Video ka "zero healthy targets".</li>
       <li><b>Accha design?</b> Probes shallow; shared dependency ki bimaari <b>request</b> mein sambhalo (<code>/orders</code> khud 503 de,
         <code>/home</code> chalta rahe). Readiness sirf woh cheezein jaanchti hai jo <b>isi pod</b> ki hain (cache garam hua? config load hua?).</li>
     </ol>
     <p class="tip">🎯 <b>Asli baat:</b> liveness = "kya main khud aisa toota hoon ki restart hi ilaaj hai?" Readiness = "kya <b>main</b> abhi
     traffic le sakta hoon?" Doosri service ki bimaari dono ka jawab nahi hai.</p>`,
    `<h3>💸 Probe ka bill, dheema boot, aur SIGTERM</h3>
     <p><b>Probe ka bill:</b> har pod ka <code>/readyz</code> har second 4 jagah se — kubelet, load balancer, service mesh, monitoring.</p>
     <pre>readiness                        DB queries/second (sirf probes se)   100 pods par
deep — har probe par DB                 18.5                          370
cached — har 2 s ek DB check             2.5                           50
shallow — DB nahi                        0.0                            0</pre>
     <p><b>Dheema boot</b> (Spring Boot / thandi JVM), liveness har 2 s, ek fail = restart:</p>
     <pre>liveness delay 5 s, boot 8 s          → kabhi READY nahi, 4 restarts, CrashLoopBackOff
liveness delay 10 s, boot 8 s         → 9.1 s par READY
liveness delay 10 s, boot 12 s        → kabhi READY nahi (jis din boot dheema tha)
startupProbe (1 s × 30), boot 12 s    → 12.1 s par READY, 0 restarts</pre>
     <p><b>Rolling restart</b> (3 pods, 100 req/s) — Service / LB ko pod hatne ki khabar ~1 s der se:</p>
     <pre>SIGTERM par turant exit                        → 75 requests fail
SIGTERM par readiness 503 + 2 s drain, phir exit → 0 fail</pre>
     <p class="tip">🎯 <b>Asli baat:</b> readiness ka jawab <b>cache</b> karo; dheeme boot ke liye <code>startupProbe</code>, andaaze wala
     <code>initialDelaySeconds</code> nahi; aur SIGTERM par pehle readiness 503 (+ <code>preStop: sleep</code>), phir drain, phir exit.
     Node mein Terminus, Spring mein Actuator, ASP.NET Core mein health checks — yeh sab built-in dete hain.</p>`,
  ],
  stages: [
    {
      type: 'docker',
      title: '🐳 Asli probes: DB blip aur probe ka bill',
      project: '01-probes',
      exercise: 'ex1-deep-shallow',
      goal: 'Mini cluster par 3 pods. DB 5 s ke liye band karo — deep liveness, deep readiness aur shallow probes mein farak naapo. Phir dekho probes khud DB par kitna bojh daalte hain.',
      why: `<code>services/cluster.js</code> ek chhota cluster hai: kubelet (asli probe niyam: startup, initialDelay, period, timeout,
        failureThreshold, CrashLoopBackOff), endpoints (sirf READY pods) aur Service (round robin). Har pod ek alag Node process.`,
      steps: [
        { text: 'Cluster (kubelet + Service) aur DB chalao.', cmd: 'cd kubegurukul/docker-labs/01-probes\nnpm start ex1-deep-shallow' },
        { text: 'DB blip — teen probe setup.', cmd: 'node tools/dbblip.js',
          expect: [
            '3 pods (boot 6 s) · 40/s /home + 40/s /orders · 22 s · DB t=6s–11s band',
            '',
            'probe setup                        /home safal   /home (DB band ke dauraan)   /orders safal   pod restarts   DB wapas → /orders theek',
            'liveness DB check karta hai           59.0%           17.5%                  55.0%          3           4.9 s baad',
            'sirf readiness DB check karta hai     77.2%           19.5%                  72.7%          0           1.0 s baad',
            'dono shallow, app khud degrade       100.0%          100.0%                  77.3%          0           0.0 s baad',
          ].join('\n') },
        { text: 'Probe ka bill (wahi cluster, naya tool).', cmd: 'node tools/probeload.js',
          expect: [
            'readiness                        DB queries/second (sirf probes se)   100 pods par (andaaza)',
            'deep — har probe par DB                18.5                            370',
            'cached — har 2 s ek DB check            2.5                            50',
            'shallow — DB nahi                       0.0                            0',
          ].join('\n') },
      ],
      observe: {
        q: 'Sirf readiness DB check karta tha (koi restart nahi). Phir bhi DB band hote hi /home — jise DB chahiye hi nahi — 19.5% par kyun gira?',
        choices: [
          'Teeno pods ne ek saath readiness fail ki → endpoints khaali → Service ke paas bhejne ko koi pod nahi ("zero targets")',
          '/home bhi chupke se DB use karta hai',
          'Kubelet ne pods restart kar diye',
          'Service ka load balancer dheema tha',
        ],
        answer: 0,
        explain: 'Readiness shared dependency jaanchegi toh saare pods ek saath bahar. Pod khud theek hai — readiness mein sirf pod ki apni cheezein rakho, DB ki bimaari request mein sambhalo.',
      },
      lesson: 'Liveness mein kabhi dependency nahi; readiness mein shared dependency nahi (ya kam se kam cached + soch samajh ke). Degrade request mein.',
    },
    {
      type: 'docker',
      title: '🐳 Dheema boot aur graceful shutdown',
      project: '01-probes',
      exercise: 'ex3-startup',
      goal: '8–12 s mein boot hone wala app: initialDelaySeconds ke andaaze vs startupProbe. Phir rolling restart mein SIGTERM par turant exit vs graceful drain.',
      steps: [
        { text: 'Cluster chalao.', cmd: 'cd kubegurukul/docker-labs/01-probes\nnpm start ex3-startup' },
        { text: 'Dheema boot — chaar setup.', cmd: 'node tools/slowstart.js',
          expect: [
            'setup                                  pehli baar READY   restarts   25 s par haal',
            'liveness delay 5 s, boot 8 s           kabhi nahi          4     CrashLoopBackOff',
            'liveness delay 10 s, boot 8 s               9.1 s          0     Running, READY',
            'liveness delay 10 s, boot 12 s         kabhi nahi          2     Running, NOT READY',
            'startupProbe (1 s × 30), boot 12 s         12.1 s          0     Running, READY',
          ].join('\n') },
        { text: 'Rolling restart — SIGTERM par app kya kare.', cmd: 'node tools/rollout.js',
          expect: [
            'SIGTERM par app kya karta hai                 requests   fail   rollout mein laga',
            'turant exit                                     1018     75     6.2 s',
            'readiness 503 + 2 s drain, phir exit            1019      0     6.2 s',
          ].join('\n') },
      ],
      observe: {
        q: 'initialDelaySeconds 10 ke saath 8 s wala boot theek chala, par 12 s wala boot CrashLoop mein gaya. startupProbe ne 12 s wala kaise bachaya?',
        choices: [
          'startupProbe pass hone tak kubelet liveness chalata hi nahi — app ko 30 s tak ki chhoot, aur shuru hote hi liveness apne tez niyam se',
          'startupProbe boot tez kar deta hai',
          'startupProbe liveness ko hamesha ke liye band kar deta hai',
          'startupProbe restart par CrashLoopBackOff hata deta hai',
        ],
        answer: 0,
        explain: 'initialDelaySeconds ek andaaza hai jo boot ke sabse bure din ko nahi jaanta. startupProbe boot ko "jitna lage" ki chhoot deta hai (failureThreshold × periodSeconds tak), phir liveness chalta hai.',
      },
      lesson: 'Dheeme app ke liye startupProbe. Deploy par errors chahiye nahi toh SIGTERM → readiness 503 → preStop sleep → drain → exit.',
    },
  ],
  success: [
    'Maine mini cluster par dekha ki deep liveness restart storm aur deep readiness "zero targets" kaise banata hai',
    'Main startupProbe aur graceful shutdown se dheema boot aur deploy ke errors theek kar sakta hoon',
  ],
  interview: [
    { q: 'Interviewer: "Humara /healthz DB se SELECT 1 karta hai aur liveness aur readiness dono mein laga hai. DB 30 s ke liye gaya aur poora app 2 minute down raha. Kyun?"',
      choices: [
        'Liveness fail → saare pods restart (boot + CrashLoopBackOff) aur readiness fail → endpoints khaali. DB wapas aane ke baad bhi pods boot kar rahe the. Liveness shallow karo, readiness mein shared DB mat jaancho',
        'DB ka failover dheema tha',
        'Pods ki memory kam thi',
        'Readiness ka periodSeconds bahut chhota tha',
      ],
      answer: 0,
      explain: 'Lab 01: deep liveness — 5 s ki DB blip, /orders DB ke 4.9 s baad theek, 3 restarts; shallow — 0 restarts, /home 100%.' },
  ],
  cards: [
    { front: 'Liveness probe mein DB check?', back: 'Kabhi nahi. DB blip = saare pods restart (lab 01: 5 s ki blip → ~10 s outage). Liveness sirf "kya yeh process khud toota hai?"' },
    { front: 'Readiness mein shared DB check ka khatra?', back: 'Saare pods ek saath NOT READY → endpoints khaali → jin pages ko DB nahi chahiye woh bhi gaye (lab 01: /home 19.5%).' },
    { front: 'Readiness ka jawab cache kyun?', back: 'kubelet + LB + mesh + monitoring × pods. Lab 01: deep 18.5 queries/s (5 pods) → 100 pods par ~370/s; cached (har 2 s) → 50/s.' },
    { front: 'Graceful shutdown ka kram?', back: 'SIGTERM → readiness 503 → preStop sleep (LB ko khabar pahunche) → chalte kaam poore → exit. Lab 01: turant exit 75 errors, graceful 0.' },
  ],
});

})();
