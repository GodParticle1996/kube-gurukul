/* =====================================================================
   KubeGurukul — Gap levels (existing tracks ke BEECH mein daale gaye)

   Yeh file baaki saari data files ke BAAD load hoti hai, kyunki
   `KG.registerLevelsAfter` ko target level pehle se registered chahiye.
   Naya gap level yahin daalo — track ke aakhir mein append karne se
   naya level boss ke BAAD chala jaata hai, jo galat hai.

   Source: KodeKloud CKA (Scheduling → Priority Classes / Static Pods,
   2025 Updates → Admission Controllers) aur CKS (Minimize Microservice
   Vulnerabilities → OPA / Validating & Mutating Admission).

   ✍️ ADHD-friendly likhne ka niyam: "yeh / woh / isse / uska" pronoun ki
   tarah use nahi karna — har baar asli naam likho.
   ===================================================================== */

(function () {

  /* ---- QoS + priority ka cost model (slider lab isse chalata hai) ---- */
  const NODE_ALLOCATABLE_GI = 8;          // node ki allocatable memory
  const INCOMING_PRIORITY = 100000;       // jo pod preempt karne aa raha hai

  function qosOf(req, lim) {
    if (req === 0 && lim === 0) return 'BestEffort';
    if (req > 0 && req === lim) return 'Guaranteed';
    return 'Burstable';
  }
  function oomScoreAdj(req, lim) {
    const q = qosOf(req, lim);
    if (q === 'Guaranteed') return -997;
    if (q === 'BestEffort') return 1000;
    /* Burstable: node ka jitna bada hissa request kiya, utna kam score */
    const v = Math.round(1000 - (1000 * req) / NODE_ALLOCATABLE_GI);
    return Math.max(2, Math.min(999, v));
  }
  function evictionRank(req, lim, usage) {
    /* 1 = kubelet sabse pehle isse maarega */
    const q = qosOf(req, lim);
    if (q === 'BestEffort') return 1;
    if (usage > req) return 2;            // request se zyada use kar raha hai
    if (q === 'Burstable') return 3;
    return 4;                             // Guaranteed, budget ke andar
  }
  const preemptionSafe = priority => priority >= INCOMING_PRIORITY;

  /* =====================================================================
     GAP 1 — intermediate track, `affinity` ke baad
     ===================================================================== */
  KG.registerLevelsAfter('intermediate', 'affinity', [{
    id: 'priority',
    icon: '🎖️',
    title: 'PriorityClass, Preemption aur Static Pods',
    badge: 'Priority Pandit',
    objectives: [
      'PriorityClass banana aur preemption ka asli matlab samajhna',
      'Preemption (scheduler ka kaam) aur eviction (kubelet ka kaam) mein farq karna',
      'QoS class aur priority milkar kaise tay karte hain ki kaun pehle marega',
      'Static pods pehchanna — aur unhe kubectl se delete na kar paana',
    ],
    lesson: [
      `<h3>🎖️ PriorityClass — kaun pehle jagah paata hai</h3>
       <pre>apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: payments-critical
value: 100000                 # jitna zyada, utni zyada ahmiyat
preemptionPolicy: PreemptLowerPriority    # default; Never bhi ho sakta hai
globalDefault: false
description: "Payment flow — cluster bhara ho to bhi jagah milni chahiye"</pre>
       <p>Pod spec mein sirf naam likhna hota hai:</p>
       <pre>spec:
  priorityClassName: payments-critical</pre>
       <p>Do built-in PriorityClass har cluster mein pehle se hote hain:
       <code>system-cluster-critical</code> (2000000000) aur
       <code>system-node-critical</code> (2000001000). Inka istemal apne
       application ke liye kabhi mat karo — inhi ke bharose control plane
       aur CNI ke pods chalte hain.</p>

       <h3>⚔️ Preemption aur Eviction — do bilkul alag cheezein</h3>
       <table class="kk-tbl">
         <tr><th></th><th>Preemption</th><th>Eviction</th></tr>
         <tr><td>Kaun karta hai</td><td><b>Scheduler</b></td><td><b>kubelet</b> (node par)</td></tr>
         <tr><td>Kab hota hai</td><td>Jab ek high-priority pod Pending hai aur kahin jagah nahi</td><td>Jab node par memory/disk khatam ho rahi hai</td></tr>
         <tr><td>Kaun chunta hai shikaar</td><td>Sabse kam <b>priority</b> wale pods</td><td>Sabse kharab <b>QoS</b> wale pods (BestEffort pehle)</td></tr>
         <tr><td>Kahan dikhta hai</td><td>Pending pod ke Events</td><td>Node ke Events + evicted pod ka status <code>Evicted</code></td></tr>
       </table>
       <div class="war-story"><b>⚡ Sabse aam confusion:</b> team ne pod ki priority
       badha di taaki pod evict na ho — aur pod phir bhi evict hua. Kyunki
       <b>kubelet ki eviction priority nahi, QoS dekhti hai</b>. Priority sirf scheduler
       ke preemption faisle mein kaam aati hai. Eviction se bachna hai to
       <code>requests = limits</code> rakh ke QoS ko <b>Guaranteed</b> banao.
       (Kubernetes 1.22+ mein kubelet ek hi QoS class ke andar priority ko
       tie-breaker ki tarah dekhta hai — par QoS pehle aati hai, hamesha.)</div>`,

      `<h3>📌 Static Pods — kubelet ke apne pods</h3>
       <p>Static pod woh pod hai jo <b>kubelet seedha ek file se</b> banata hai, bina API
       server ke. Control plane ke saare components (API server, etcd, scheduler,
       controller-manager) static pods hi hote hain — warna murgi-anda ki samasya ho jaati:
       API server ko chalane ke liye API server chahiye hota.</p>
       <pre>ls /etc/kubernetes/manifests/
etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml</pre>
       <table class="kk-tbl">
         <tr><th>Sawal</th><th>Static pod ka jawab</th></tr>
         <tr><td>Kaun banata hai</td><td>Node ka kubelet, directly file se</td></tr>
         <tr><td>Naam kaisa hota hai</td><td><code>&lt;pod-naam&gt;-&lt;node-naam&gt;</code> — jaise <code>etcd-cp-1</code></td></tr>
         <tr><td><code>kubectl delete pod</code> se hatega?</td><td><b>Nahi.</b> Pod hat jaayega aur kubelet turant wahi pod dobara bana dega</td></tr>
         <tr><td>Asli mein kaise hataayein</td><td>Manifest file <code>/etc/kubernetes/manifests/</code> se hatao</td></tr>
         <tr><td>API server mein kya dikhta hai</td><td>Sirf ek read-only <b>mirror pod</b> — asli pod node par hai</td></tr>
       </table>
       <p><b>Pehchanne ka tarika:</b> <code>kubectl get pod &lt;naam&gt; -o yaml</code> mein
       <code>ownerReferences</code> dekho. Static pod ka owner <code>kind: Node</code> hota hai,
       ReplicaSet ya DaemonSet nahi.</p>`,
    ],
    stages: [
      {
        type: 'slider',
        title: '🎚️ Lab: QoS + priority — kaun pehle marega?',
        instructions: 'Slider ghumao. QoS class, oom_score_adj aur eviction ka number khud compute hote hain. Verdict neeche live badalta hai.',
        scenario: `Node par <b>8Gi allocatable memory</b> hai aur node memory pressure mein aa raha hai.
          Ek doosra pod <code>priority 100000</code> ke saath schedule hone ki koshish kar raha hai.<br><br>
          Tum apne pod ke <b>memory request</b>, <b>memory limit</b>, <b>asli usage</b> aur
          <b>priority</b> tay kar sakte ho.`,
        goal: 'Aisa pod banao jo (1) memory pressure mein <b>sabse aakhir</b> mein evict ho, AUR (2) high-priority pod ke preemption se bhi <b>bacha</b> rahe.',
        knobs: [
          { id: 'req', label: 'Memory request', min: 0, max: 4, step: 0.5, value: 1, unit: ' Gi' },
          { id: 'lim', label: 'Memory limit', min: 0, max: 4, step: 0.5, value: 3, unit: ' Gi' },
          { id: 'use', label: 'Asli memory usage', min: 0, max: 4, step: 0.5, value: 2.5, unit: ' Gi' },
          { id: 'prio', label: 'PriorityClass value', min: 0, max: 200000, step: 25000, value: 0, unit: '' },
        ],
        readouts: k => {
          const q = qosOf(k.req, k.lim);
          const rank = evictionRank(k.req, k.lim, k.use);
          const names = { 1: '1 — SABSE PEHLE', 2: '2 — jaldi', 3: '3 — baad mein', 4: '4 — SABSE AAKHIR' };
          return [
            { label: 'QoS class', value: q, state: q === 'Guaranteed' ? 'good' : q === 'Burstable' ? 'warn' : 'bad',
              hint: q === 'Guaranteed' ? 'request === limit aur dono > 0' : q === 'BestEffort' ? 'na request, na limit' : 'request aur limit alag hain' },
            { label: 'oom_score_adj', value: String(oomScoreAdj(k.req, k.lim)), state: oomScoreAdj(k.req, k.lim) < 0 ? 'good' : oomScoreAdj(k.req, k.lim) > 900 ? 'bad' : 'warn',
              hint: 'kernel ka OOM killer zyada score wale ko pehle maarta hai' },
            { label: 'Usage vs request', value: k.use.toFixed(1) + ' / ' + k.req.toFixed(1) + ' Gi', state: k.use > k.req ? 'bad' : 'good',
              hint: k.use > k.req ? 'request se zyada — kubelet ki hit-list par' : 'apne budget ke andar' },
            { label: 'kubelet eviction order', value: names[rank], state: rank === 4 ? 'good' : rank === 1 ? 'bad' : 'warn',
              hint: 'kubelet QoS dekhta hai, priority nahi' },
            { label: 'Preemption (priority 100000 ke saamne)', value: preemptionSafe(k.prio) ? 'SURAKSHIT' : 'PREEMPT HO JAYEGA', state: preemptionSafe(k.prio) ? 'good' : 'bad',
              hint: 'scheduler priority dekhta hai, QoS nahi' },
          ];
        },
        bars: k => [
          { label: 'Node memory ka booked hissa', pct: (k.req / NODE_ALLOCATABLE_GI) * 100, state: 'neutral', cap: k.req.toFixed(1) + ' / 8 Gi' },
          { label: 'Limit ka istemal', pct: k.lim > 0 ? Math.min(100, (k.use / k.lim) * 100) : 100, state: k.lim > 0 && k.use > k.lim ? 'bad' : k.lim === 0 ? 'bad' : 'good', cap: k.lim > 0 ? k.use.toFixed(1) + ' / ' + k.lim.toFixed(1) + ' Gi' : 'koi limit nahi' },
          { label: 'Priority (100000 chahiye)', pct: (k.prio / INCOMING_PRIORITY) * 100, state: preemptionSafe(k.prio) ? 'good' : 'bad', cap: String(k.prio) },
        ],
        verdict: k => {
          const q = qosOf(k.req, k.lim);
          const rank = evictionRank(k.req, k.lim, k.use);
          const safe = preemptionSafe(k.prio);
          if (q === 'BestEffort')
            return { ok: false, text: '<b>BestEffort</b> — na request, na limit. kubelet memory pressure par <b>sabse pehle</b> isi pod ko maarega, aur oom_score_adj 1000 hai (kernel ke liye sabse aasan shikaar).' };
          if (rank === 2)
            return { ok: false, text: `Pod apne request (${k.req.toFixed(1)}Gi) se <b>zyada</b> (${k.use.toFixed(1)}Gi) use kar raha hai. kubelet aise pods ko QoS ke baad turant chunta hai. Ya usage ghatao, ya request badhao.` };
          if (q === 'Burstable')
            return { ok: false, text: `<b>Burstable</b> — request (${k.req.toFixed(1)}Gi) aur limit (${k.lim.toFixed(1)}Gi) alag hain. Guaranteed banane ke liye dono barabar karo (aur dono > 0).${safe ? '' : ' Priority bhi 100000 se kam hai, isliye preemption se bhi bachav nahi.'}` };
          if (!safe)
            return { ok: false, text: `QoS <b>Guaranteed</b> hai — eviction se bachav ho gaya. Par priority ${k.prio} hai aur aane wale pod ki priority 100000 hai, isliye <b>scheduler is pod ko preempt kar dega</b>. Priority badhao.` };
          return { ok: true, text: `<b>Dono taraf se surakshit.</b> QoS Guaranteed hai (request === limit === ${k.req.toFixed(1)}Gi) aur usage budget ke andar hai, isliye kubelet is pod ko <b>sabse aakhir</b> mein chunega (oom_score_adj ${oomScoreAdj(k.req, k.lim)}). Aur priority ${k.prio} ≥ 100000 hai, isliye scheduler preempt bhi nahi kar sakta.` };
        },
        check: k => k.req > 0 && k.req === k.lim && k.use <= k.req && k.prio >= INCOMING_PRIORITY,
        lesson: 'Sabse zaroori baat jo slider se saaf ho gayi: <b>eviction aur preemption do alag knob se bache</b>. Priority ko 200000 tak le jao — QoS class phir bhi BestEffort rah sakti hai aur kubelet phir bhi sabse pehle usi pod ko maarega. Aur ulta bhi sach hai: Guaranteed QoS ke saath priority 0 rakho, to kubelet to nahi maarega par scheduler preempt kar dega. <b>QoS = kubelet se bachav, priority = scheduler se bachav.</b>',
        quiz: {
          q: 'Ek team ne apne pod ki <code>priorityClassName</code> badha di taaki pod evict na ho. Pod phir bhi <code>Evicted</code> ho gaya. Kyun?',
          choices: [
            'kubelet ki eviction QoS class dekhti hai, priority nahi. Bachav ke liye requests = limits karke QoS Guaranteed banana padta hai',
            'PriorityClass ka value bahut kam tha',
            'PriorityClass namespace-scoped hai aur galat namespace mein bani thi',
            'Eviction hamesha random pod chunti hai',
          ],
          answer: 0,
          explain: 'Do bilkul alag mechanism hain. <b>Preemption</b> scheduler karta hai jab high-priority pod ko jagah nahi milti — wahan priority chalti hai. <b>Eviction</b> kubelet karta hai jab node par memory ya disk khatam ho rahi hai — wahan <b>QoS class</b> chalti hai (BestEffort pehle, phir apne request se zyada use karne wale Burstable, phir baaki). Priority badhane se eviction nahi rukti. (PriorityClass cluster-scoped hai, namespace-scoped nahi — isliye teesra option bhi galat hai.)',
        },
      },
      {
        type: 'bins',
        title: 'Kaunsa mechanism — preemption ya eviction?',
        instructions: 'Har ghatna ko us mechanism ke bin mein daalo jo asli mein zimmedar hai.',
        bins: [
          { id: 'preempt', label: '⚔️ Preemption (scheduler)' },
          { id: 'evict', label: '🚪 Eviction (kubelet)' },
          { id: 'static', label: '📌 Static pod ka vyavhaar' },
        ],
        items: [
          { text: 'Pending pod ke Events: "preempted by pod payments/checkout-9f8b"', bin: 'preempt', explain: 'Scheduler ne ek high-priority Pending pod ke liye jagah banayi. Scheduler ne sabse kam priority wale pods chune aur unhe hataya. Message hamesha Pending pod ke Events mein aata hai.' },
          { text: 'Pod ka status Evicted, node ke Events mein "The node was low on resource: memory"', bin: 'evict', explain: 'kubelet ne node ko bachane ke liye pods maare. Chunav QoS ke hisaab se hua — BestEffort pehle, phir apne request se zyada use karne wale Burstable.' },
          { text: 'kubectl delete pod etcd-cp-1 chalaya, par pod 2 second mein wapas aa gaya', bin: 'static', explain: 'etcd ek static pod hai. kubelet usse <code>/etc/kubernetes/manifests/etcd.yaml</code> se seedha banata hai — koi controller beech mein nahi hai. Hataana hai to manifest file hatao.' },
          { text: 'requests = limits rakhne se pod bach gaya', bin: 'evict', explain: 'requests = limits ka matlab QoS Guaranteed. kubelet Guaranteed pods ko sabse aakhir mein chunta hai aur unka oom_score_adj -997 hota hai (kernel ke OOM killer ke liye sabse mushkil shikaar).' },
          { text: 'priorityClassName: system-cluster-critical lagane se pod bach gaya', bin: 'preempt', explain: 'Priority sirf scheduler ke preemption faisle mein chalti hai. (Aur application ke liye system-cluster-critical lagana galat hai — us class ke bharose control plane ke pods chalte hain.)' },
          { text: 'Pod ka ownerReferences mein kind: Node likha hai', bin: 'static', explain: 'Static pod ka mirror object hi aisa dikhta hai — owner Node hai, ReplicaSet ya DaemonSet nahi. Yahi sabse pakka pehchanne ka tarika hai.' },
          { text: 'Node par disk bhar gayi aur do pods hat gaye', bin: 'evict', explain: 'kubelet ki eviction sirf memory par nahi, <b>ephemeral-storage</b> par bhi chalti hai. Aksar wajah application ke logs hote hain jo emptyDir ya container ki writable layer bhar dete hain.' },
          { text: 'Events: "0/5 nodes are available … preemption: No preemption victims found"', bin: 'preempt', explain: 'Scheduler ne preemption socha aur mana kar diya — jitne pods hataane padte, unki priority Pending pod se kam nahi thi. Iska matlab preemption ka mechanism chala, bas kaam nahi aaya.' },
        ],
      },
      {
        type: 'quiz',
        title: 'PriorityClass aur static pods',
        questions: [
          {
            q: 'Ek PriorityClass par <code>preemptionPolicy: Never</code> laga hai. Iska kya matlab hai?',
            choices: [
              'Pod ko queue mein aage ki jagah milegi (high priority), par pod kisi doosre pod ko hataayega nahi — jagah khaali hone ka intezaar karega',
              'Pod ko kabhi schedule nahi kiya jayega',
              'Pod ko koi doosra pod preempt nahi kar sakta',
              'PriorityClass ka value ignore ho jayega',
            ],
            answer: 0,
            explain: '<code>preemptionPolicy: Never</code> priority aur preemption ko alag kar deta hai. Pod ko scheduling queue mein apni priority ke hisaab se aage ki jagah milti hai (yaani kam priority wale pods se pehle try hoga), par jagah na milne par pod kisi ko hataata nahi — Pending rehta hai. Batch aur analytics workloads ke liye bilkul sahi: "jaldi chahiye, par kisi ki jagah cheen ke nahi". Dhyaan do: yeh policy is pod ke <b>doosron ko preempt karne</b> ko rokti hai, doosron ke <b>is pod ko preempt karne</b> ko nahi.',
          },
          {
            q: 'Node par <code>/etc/kubernetes/manifests/nginx.yaml</code> rakh di. Pod ban gaya. Ab <code>kubectl delete pod nginx-node01</code> chalaya. Kya hoga?',
            context: 'NAME            READY   STATUS    RESTARTS   AGE\nnginx-node01    1/1     Running   0          4m',
            choices: [
              'Pod kuch second ke liye hatega aur kubelet turant wahi pod dobara bana dega — kyunki kubelet manifest file dekh raha hai',
              'Pod poori tarah hat jayega',
              'kubectl error dega ki static pod delete nahi ho sakta',
              'Pod Terminating mein hamesha ke liye atak jayega',
            ],
            answer: 0,
            explain: '<code>kubectl delete</code> sirf API server ka <b>mirror pod</b> object hataata hai. Asli container node par chal raha hai aur kubelet ke paas manifest file abhi bhi maujood hai. Agle sync par kubelet mirror pod dobara bana deta hai. Sach mein hataana hai to manifest file hatao: <code>rm /etc/kubernetes/manifests/nginx.yaml</code> — kubelet turant container bhi band kar dega. (Yahi wajah hai ki etcd ya kube-apiserver ka pod delete karne se control plane theek nahi hota.)',
          },
          {
            q: 'kubelet static pod ki directory kahan se padhta hai, yeh kaise pata karoge?',
            choices: [
              'kubelet ki config file mein staticPodPath dekho — /var/lib/kubelet/config.yaml',
              'kubectl get configmap kubelet-config -n kube-system, sirf wahi jagah hai',
              'Directory hamesha /etc/kubernetes/manifests hi hoti hai, badli nahi ja sakti',
              'kubectl describe node par likha hota hai',
            ],
            answer: 0,
            explain: 'Path <code>staticPodPath</code> field se aata hai jo kubelet ki config file mein hota hai (kubeadm clusters mein <code>/var/lib/kubelet/config.yaml</code>). Default <code>/etc/kubernetes/manifests</code> hai par badla ja sakta hai. Purane setups mein kubelet ke <code>--pod-manifest-path</code> flag se bhi aata tha (<code>systemctl cat kubelet</code> se dikh jayega). CKA exam mein yeh sawal aksar aata hai kyunki path guess karne se time barbaad hota hai.',
          },
        ],
      },
    ],
    interview: {
      questions: [
        {
          q: 'Interviewer: "Preemption aur eviction — dono ka farq batao, aur har ek se bachne ka tarika."',
          choices: [
            'Preemption scheduler karta hai aur PRIORITY dekhta hai (bachav: high PriorityClass). Eviction kubelet karta hai aur QoS dekhta hai (bachav: requests = limits se Guaranteed QoS)',
            'Dono kubelet karta hai, dono QoS dekhte hain',
            'Dono scheduler karta hai, dono priority dekhte hain',
            'Preemption node ki disk par hota hai, eviction memory par',
          ],
          answer: 0,
          explain: 'Do alag component, do alag signal, do alag bachav. <b>Preemption</b>: scheduler ke paas ek Pending high-priority pod hai aur kahin jagah nahi, isliye scheduler kam priority wale pods hataata hai — Pending pod ke Events mein dikhta hai. <b>Eviction</b>: node par memory ya disk khatam ho rahi hai, isliye kubelet pods maarta hai — QoS ke kram mein (BestEffort → request se zyada use karne wale Burstable → baaki Burstable → Guaranteed). Isliye <b>priority badhane se eviction nahi rukti</b>, aur <b>Guaranteed QoS se preemption nahi rukti</b>. Dono chahiye to dono set karo.',
        },
        {
          q: 'Interviewer: "Production cluster mein har team apne pods ko <code>system-cluster-critical</code> laga rahi hai. Kya galat ho sakta hai?"',
          choices: [
            'Priority ka poora matlab hi khatm ho jaata hai (sab barabar), aur asli control-plane pods ko jagah nahi milegi — CNI ya CoreDNS ke pods preempt ho sakte hain aur poora cluster gir sakta hai',
            'Kuch galat nahi, sirf ek label hai',
            'Pods evict hona band ho jaayenge',
            'Scheduler crash kar jayega',
          ],
          answer: 0,
          explain: 'Priority ek <b>relative</b> paimana hai. Jab sab log sabse upar ki class le lete hain, to kisi ke paas koi faayda nahi bachta — aur system ki apni cheezein khatre mein aa jaati hain, kyunki <code>system-cluster-critical</code> (2000000000) ke bharose CoreDNS aur CNI jaise components chalte hain. Sahi tarika: apni classes ka apna paimana banao (jaise <code>tier-critical: 100000</code>, <code>tier-normal: 10000</code>, <code>tier-batch: 100</code>), <code>system-*</code> classes ko sirf cluster ke apne components ke liye chhodo, aur ResourceQuota ke <code>scopeSelector</code> se rok lagao taaki har namespace har class na le sake.',
        },
      ],
    },
    success: [
      'Main PriorityClass bana sakta hoon aur preemptionPolicy ka matlab jaanta hoon',
      'Main preemption (scheduler + priority) aur eviction (kubelet + QoS) ka farq bata sakta hoon',
      'Main jaanta hoon ki eviction se bachne ke liye requests = limits chahiye, priority nahi',
      'Main static pod pehchan sakta hoon aur jaanta hoon ki kubectl delete usse nahi hataata',
    ],
    homework: `<p>Preemption khud dekho:</p>
      <pre>kubectl create priorityclass low --value=100 --description="test"
kubectl create priorityclass high --value=100000 --description="test"

# node ko bhar do
kubectl create deployment filler --image=nginx --replicas=6
kubectl set resources deploy/filler --requests=cpu=400m
kubectl patch deploy filler -p '{"spec":{"template":{"spec":{"priorityClassName":"low"}}}}'

# ab high-priority pod bhejo
kubectl run vip --image=nginx --overrides='{"spec":{"priorityClassName":"high","containers":[{"name":"vip","image":"nginx","resources":{"requests":{"cpu":"1"}}}]}}'
kubectl get events --sort-by=.lastTimestamp | grep -i preempt

kubectl delete deploy filler; kubectl delete pod vip
kubectl delete priorityclass low high</pre>
      <p>Aur static pod bana ke delete karke dekho ki wapas aa jaata hai
      (kind cluster ke node mein: <code>docker exec -it &lt;node&gt; bash</code>, phir
      <code>/etc/kubernetes/manifests/</code> mein ek pod manifest rakho).</p>`,
    cards: [
      { front: 'Preemption vs eviction — kaun karta hai, kya dekhta hai?', back: '<b>Preemption</b>: scheduler, <b>priority</b> dekhta hai, Pending pod ke liye jagah banata hai. <b>Eviction</b>: kubelet, <b>QoS</b> dekhta hai, node ko memory/disk pressure se bachata hai.' },
      { front: 'Eviction se bachne ka tarika?', back: '<code>requests = limits</code> (dono > 0) → QoS <b>Guaranteed</b>, oom_score_adj −997. Priority badhane se eviction nahi rukti — kubelet priority dekhta hi nahi (QoS pehle aati hai).' },
      { front: '<code>preemptionPolicy: Never</code> ka matlab?', back: 'Pod ko queue mein priority ke hisaab se aage ki jagah milegi, par pod kisi ko hataayega nahi — jagah khaali hone ka intezaar karega. Batch workloads ke liye sahi.' },
      { front: 'Static pod kya hai aur kaise pehchanein?', back: 'kubelet seedha <code>/etc/kubernetes/manifests/</code> se banata hai, bina API server ke. Naam <code>&lt;pod&gt;-&lt;node&gt;</code> hota hai aur <code>ownerReferences</code> mein <code>kind: Node</code> likha hota hai.' },
      { front: 'Static pod ko kubectl delete se hata sakte hain?', back: '<b>Nahi.</b> Delete sirf mirror object hataata hai; kubelet ke paas manifest file hai isliye pod turant wapas aa jaata hai. Manifest file hatao: <code>rm /etc/kubernetes/manifests/&lt;file&gt;</code>.' },
      { front: 'system-cluster-critical apne app par kyun nahi lagana chahiye?', back: 'Us class (2000000000) ke bharose CoreDNS, CNI aur control plane ke pods chalte hain. Sab log lagane lagein to priority ka matlab hi khatm aur system pods preempt ho sakte hain.' },
    ],
  }]);

  /* =====================================================================
     GAP 2 — advanced track, `podsecurity` ke baad
     ===================================================================== */
  KG.registerLevelsAfter('advanced', 'podsecurity', [{
    id: 'admission',
    icon: '🚦',
    title: 'Admission Control — request ko etcd tak pahunchne se pehle rokna',
    badge: 'Gate Rakhwala',
    objectives: [
      'API request ka poora raasta yaad karna: authn → authz → mutating → schema → validating → etcd',
      'Mutating aur validating admission ka farq aur kram jaanna',
      'Kyverno / OPA Gatekeeper aur ValidatingAdmissionPolicy mein chunav karna',
      'failurePolicy ka khatra samajhna — ek webhook poore cluster ko rok sakta hai',
    ],
    lesson: [
      `<h3>🚦 Har API request ka poora raasta</h3>
       <pre>kubectl apply
   │
   ▼
1. Authentication   ← tum kaun ho?          (certificate / token) — fail = 401
2. Authorization    ← tumhe ijaazat hai?    (RBAC)                — fail = 403
3. MUTATING admission   ← request ko BADLA ja sakta hai
4. Schema validation    ← API server apna OpenAPI schema check karta hai
5. VALIDATING admission ← sirf haan/na — badla kuch nahi ja sakta
   │
   ▼
6. etcd mein likha gaya</pre>
       <p><b>Kram ka asar:</b> mutating pehle chalta hai, isliye Kyverno pehle
       <code>seccompProfile: RuntimeDefault</code> <i>daal</i> sakta hai aur uske baad
       validating policy usi field ko <i>check</i> kar sakti hai — aur check pass ho jayega.
       Ulta kram hota to policy apne hi lagaye field ko na dekh paati.</p>
       <table class="kk-tbl">
         <tr><th></th><th>Mutating</th><th>Validating</th></tr>
         <tr><td>Kya kar sakta hai</td><td>Object badal sakta hai (field jodo, default bharo, sidecar inject karo)</td><td>Sirf allow / deny</td></tr>
         <tr><td>Kab chalta hai</td><td>Schema validation se <b>pehle</b></td><td>Schema validation ke <b>baad</b></td></tr>
         <tr><td>Aam misaal</td><td>Istio ka sidecar injection, LimitRange ke defaults</td><td>PodSecurity, "latest tag mana hai", "har pod par owner label chahiye"</td></tr>
         <tr><td>Ek se zyada</td><td>Ek ke baad ek chalte hain — pichhle ka natija agle ko milta hai</td><td>Sab ek saath chal sakte hain — ek bhi deny kare to request reject</td></tr>
       </table>

       <h3>⚙️ Built-in admission plugins jo pehle se chal rahe hain</h3>
       <p>API server ke andar hi kai admission plugins chalte hain (<code>--enable-admission-plugins</code>).
       Kai bahut jaani-pehchani cheezein asli mein admission plugin hi hain:</p>
       <table class="kk-tbl">
         <tr><th>Plugin</th><th>Kya karta hai</th><th>Type</th></tr>
         <tr><td><code>NamespaceLifecycle</code></td><td>Terminating namespace mein naya object banne se rokta hai</td><td>Validating</td></tr>
         <tr><td><code>LimitRanger</code></td><td>LimitRange ke default requests/limits bharta hai</td><td>Mutating</td></tr>
         <tr><td><code>ResourceQuota</code></td><td>Namespace ki quota check karta hai</td><td>Validating</td></tr>
         <tr><td><code>ServiceAccount</code></td><td>Pod mein default ServiceAccount aur uska token jodta hai</td><td>Mutating</td></tr>
         <tr><td><code>PodSecurity</code></td><td>Namespace ke label ke hisaab se pod spec check karta hai</td><td>Validating</td></tr>
         <tr><td><code>DefaultStorageClass</code></td><td>Bina StorageClass wali PVC mein default StorageClass bharta hai</td><td>Mutating</td></tr>
       </table>`,

      `<h3>🧰 Custom policy ke teen raaste</h3>
       <table class="kk-tbl">
         <tr><th></th><th>Kyverno</th><th>OPA Gatekeeper</th><th>ValidatingAdmissionPolicy</th></tr>
         <tr><td>Bhasha</td><td>YAML</td><td>Rego</td><td>CEL</td></tr>
         <tr><td>Kahan chalta hai</td><td>Cluster mein pods (webhook)</td><td>Cluster mein pods (webhook)</td><td><b>API server ke andar</b> — koi pod nahi</td></tr>
         <tr><td>Mutate kar sakta hai</td><td>Haan</td><td>Haan (v3.10+)</td><td>Haan (MutatingAdmissionPolicy, 1.32+ alpha)</td></tr>
         <tr><td>Webhook down ho to</td><td>failurePolicy par nirbhar</td><td>failurePolicy par nirbhar</td><td><b>Aisi koi samasya nahi</b></td></tr>
         <tr><td>Kab chuno</td><td>Kubernetes-native, generate/mutate bhi chahiye</td><td>Complex logic, ek se zyada system</td><td>Simple validation, sabse kam risk</td></tr>
       </table>
       <pre># ValidatingAdmissionPolicy — koi controller install kiye bina
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: { name: no-latest-tag }
spec:
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
  validations:
    - expression: "object.spec.template.spec.containers.all(c, !c.image.endsWith(':latest'))"
      message: "':latest' tag mana hai — immutable tag ya digest use karo"</pre>

       <div class="war-story"><b>⚡ Poora cluster rokne wali ek line: <code>failurePolicy: Fail</code>.</b>
       Ek team ne validating webhook lagaya jo <b>har</b> pod par chalta tha, aur
       <code>failurePolicy: Fail</code> rakha (default yahi hai). Ek din webhook ke apne pods
       CrashLoop mein chale gaye. Ab API server har pod create par webhook se poochta,
       jawab nahi milta, aur request reject ho jaati — <b>webhook ke apne pods bhi nahi ban paate</b>.
       Cluster deadlock mein chala gaya aur usse nikalne ka ek hi raasta bacha:
       <code>kubectl delete validatingwebhookconfiguration &lt;naam&gt;</code>.<br><br>
       <b>Teen bachav:</b> <b>(1)</b> <code>namespaceSelector</code> se <code>kube-system</code>
       aur webhook ke apne namespace ko baahar rakho; <b>(2)</b> non-critical policy ke liye
       <code>failurePolicy: Ignore</code> rakho; <b>(3)</b> <code>timeoutSeconds</code> chhota
       rakho (default 10s, 2-3s behtar) taaki dhima webhook har API call ko na ghaseete.</div>`,
    ],
    stages: [
      {
        type: 'flow',
        title: '🎬 Flow: kubectl apply se etcd tak — har darwaza',
        instructions: '▶ dabao. Har padav par kaun rok sakta hai, lane se dikhega. Teen sawal beech mein aayenge.',
        lanes: [
          { id: 'client', label: 'kubectl', icon: '💻' },
          { id: 'authn', label: 'Authentication', icon: '🪪' },
          { id: 'authz', label: 'RBAC', icon: '🔐' },
          { id: 'mut', label: 'Mutating admission', icon: '✏️' },
          { id: 'val', label: 'Validating admission', icon: '🚦' },
          { id: 'etcd', label: 'etcd', icon: '📔' },
        ],
        steps: [
          { lane: 'client', t: 'kubectl apply -f deploy.yaml bheja', detail: 'Manifest mein sirf <code>image: acme/api:1.4</code> aur <code>replicas: 3</code> hai. Koi securityContext nahi, koi ServiceAccount nahi, koi resources nahi likhe.' },
          { lane: 'authn', t: 'Client certificate se pehchaan bani: CN=alice, O=developers', detail: 'API server ne certificate ke CN se username <code>alice</code> aur O se group <code>developers</code> nikala.<br><b>Yahan fail ho to:</b> <code>401 Unauthorized</code> — certificate expired, ya galat CA se signed.' },
          { lane: 'authz', t: 'RBAC ne check kiya: kya alice shop namespace mein deployments bana sakti hai?', detail: 'RoleBinding <code>alice-edit</code> milla, ClusterRole <code>edit</code> ke saath. Ijaazat hai.<br><b>Yahan fail ho to:</b> <code>403 Forbidden: User "alice" cannot create deployments</code>.',
            ask: { q: 'alice ko <code>403 Forbidden</code> mila. Kya uska certificate kharab hai?', choices: ['Nahi — 403 ka matlab pehchaan BAN GAYI (certificate theek hai), par RBAC ne ijaazat nahi di. Certificate ka masla hota to 401 aata', 'Haan, certificate expire ho gaya hai', 'Haan, CA galat hai', 'Nahi, 403 ka matlab API server down hai'], answer: 0, explain: '403 asli mein achhi khabar hai. API server ne alice ko pehchaan liya — message mein aksar naam bhi likha hota hai (<code>User "alice" cannot create...</code>) — par RBAC ne mana kar diya. Pehchaan hi na banti to request <b>authn</b> ke padav par 401 ke saath ruk jaati aur RBAC tak pahunchti hi nahi. <b>401 = authentication, 403 = authorization.</b>' } },
          { lane: 'mut', t: 'ServiceAccount plugin ne default SA aur uska token jod diya', detail: 'Manifest mein <code>serviceAccountName</code> likha hi nahi tha. Built-in mutating plugin ne <code>default</code> ServiceAccount aur uska projected token volume pod mein daal diya. Request ka object ab badal chuka hai.' },
          { lane: 'mut', t: 'LimitRanger ne namespace ke default requests/limits bhare', detail: 'Namespace <code>shop</code> par ek LimitRange lagi hai. Manifest mein resources likhe hi nahi the, isliye LimitRanger ne <code>requests: {cpu: 100m, memory: 128Mi}</code> daal diya. Yeh bhi mutating hi hai.' },
          { lane: 'mut', t: 'Kyverno ne seccompProfile: RuntimeDefault inject kiya', detail: 'Cluster ki ek Kyverno mutate policy har pod mein <code>seccompProfile.type: RuntimeDefault</code> daalti hai. Ab pod spec mein woh field maujood hai — jabki alice ne likha hi nahi tha.',
            ask: { q: 'Kyverno ne <code>seccompProfile</code> daala, aur aage <code>PodSecurity: restricted</code> usi field ko check karega. Kya check pass hoga?', choices: ['Haan — mutating admission validating se PEHLE chalta hai, isliye validating ko badla hua object hi milta hai', 'Nahi — validating original manifest dekhta hai', 'Nahi — dono ek saath chalte hain aur natija random hota hai', 'Haan, par sirf tab jab dono ek hi webhook mein hon'], answer: 0, explain: 'Kram hi is design ka poora maksad hai. <b>Mutating pehle, validating baad mein</b> — isliye validating ko hamesha <i>final</i> object dikhta hai. Yahi wajah hai ki "policy khud hi field bhar deti hai aur phir khud hi check karti hai" wala pattern kaam karta hai: user ko manually likhna nahi padta, aur phir bhi compliance pakki rehti hai. Ulta kram hota to Kyverno ka apna daala field kabhi check hi na ho paata.' } },
          { lane: 'client', t: 'API server ne OpenAPI schema check kiya', detail: 'Ab jab saare mutations lag chuke hain, tab API server dekhta hai ki final object schema ke hisaab se sahi hai — har field maujood hai aur har type sahi hai.<br><b>Yahan fail ho to:</b> <code>error validating data: unknown field "replicaCount"</code>.' },
          { lane: 'val', t: 'PodSecurity ne restricted level ke hisaab se pod check kiya', detail: 'Namespace par <code>pod-security.kubernetes.io/enforce=restricted</code> laga hai. PodSecurity ne final object dekha: <code>runAsNonRoot</code>, <code>allowPrivilegeEscalation</code>, <code>capabilities.drop</code>, <code>seccompProfile</code> — sab maujood hain (kuch Kyverno ne bhare the). Pass.' },
          { lane: 'val', t: 'Custom webhook: "latest tag mana hai" — image acme/api:1.4 hai, pass', detail: 'Ek ValidatingWebhookConfiguration har Deployment par chalta hai. Image ka tag <code>1.4</code> hai, <code>latest</code> nahi — allow.<br><b>Yahan fail ho to:</b> <code>admission webhook "no-latest.acme.io" denied the request</code>.',
            ask: { q: 'Is webhook ke apne pods CrashLoop mein chale jaayein aur <code>failurePolicy: Fail</code> laga ho, to kya hoga?', choices: ['API server har Deployment create ko reject karega — webhook ke apne pods samet — aur cluster deadlock mein aa jayega', 'Webhook apne aap skip ho jayega', 'API server 30 second intezaar karke allow kar dega', 'Sirf naye namespaces par asar padega'], answer: 0, explain: '<code>failurePolicy: Fail</code> (jo default hai) kehta hai: "webhook se jawab nahi mila to request reject karo". Webhook ke pods gir gaye to jawab kabhi nahi aayega, isliye har matching request reject hoti hai — <b>webhook ke apne deployment samet</b>. Nikalne ka ek hi raasta bachta hai: <code>kubectl delete validatingwebhookconfiguration &lt;naam&gt;</code>. Bachav ke teen tarike: <code>namespaceSelector</code> se kube-system aur apna namespace baahar rakho, non-critical policy ke liye <code>failurePolicy: Ignore</code> rakho, aur <code>timeoutSeconds</code> 2-3 rakho.' } },
          { lane: 'etcd', t: 'Object etcd mein likha gaya', detail: 'Ab jaake Deployment sach mein maujood hai. Gaur karo: jo object etcd mein gaya woh alice ke bheje manifest se <b>alag</b> hai — usme default ServiceAccount, LimitRange ke resources, aur Kyverno ka seccompProfile bhi hai. Isliye <code>kubectl get -o yaml</code> hamesha bheje hue manifest se bada dikhta hai.' },
        ],
        summary: '✅ Chhe darwaze, chhe alag error. <b>401</b> = authentication · <b>403</b> = RBAC · <code>admission webhook denied</code> = validating policy · <code>unknown field</code> = schema · <code>context deadline exceeded calling webhook</code> = webhook dhima ya down. Error ka message hi bata deta hai kaunsa darwaza band hua.',
      },
      {
        type: 'match',
        title: '🔗 Admission ka error message — kaunsa darwaza band hua?',
        instructions: 'Har error ko us padav se jodo jahan request rukti hai.',
        pairs: [
          { left: 'error: You must be logged in to the server (Unauthorized)', right: '1. Authentication — pehchaan hi nahi bani', explain: 'Certificate expire, galat CA se signed, ya token invalid. RBAC tak request pahunchi hi nahi. Debug: certificate ki expiry aur CA check karo.' },
          { left: 'Error from server (Forbidden): User "alice" cannot create deployments', right: '2. Authorization (RBAC) — pehchaan ban gayi, ijaazat nahi', explain: 'Message mein username likha hai, matlab authentication pass ho chuki hai. Sirf RoleBinding chahiye. Debug: <code>kubectl auth can-i create deployments --as=alice -n shop</code>.' },
          { left: 'error validating data: ValidationError(Deployment.spec): unknown field "replicaCount"', right: '4. Schema validation — field API mein hai hi nahi', explain: 'Mutating admission ke baad API server apna OpenAPI schema check karta hai. Yahan spelling ki galti hai (<code>replicaCount</code> Helm ka field hai, Kubernetes ka nahi — Kubernetes mein <code>replicas</code> hota hai).' },
          { left: 'admission webhook "validate.kyverno.svc" denied the request: latest tag not allowed', right: '5. Validating admission — policy ne mana kiya', explain: 'Object schema ke hisaab se bilkul sahi hai, par cluster ki ek policy ne reject kiya. Message mein webhook ka naam hota hai, jisse pata chal jaata hai kaunsi policy zimmedar hai.' },
          { left: 'Internal error: failed calling webhook "x.io": context deadline exceeded', right: '5b. Validating admission — webhook dhima ya down hai', explain: 'Policy ne mana nahi kiya — policy ne <b>jawab hi nahi diya</b>. <code>failurePolicy: Fail</code> ke saath yeh request reject kar deta hai. Webhook ke pods aur uski service ke endpoints dekho.' },
          { left: 'Pod spec mein serviceAccountName likha hi nahi tha, par pod mein aa gaya', right: '3. Mutating admission — object badal diya gaya', explain: 'Built-in <code>ServiceAccount</code> plugin ne default SA aur uska token volume jod diya. Isi wajah se <code>kubectl get pod -o yaml</code> hamesha bheje hue manifest se bada dikhta hai.' },
        ],
      },
      {
        type: 'fill',
        title: '📄 ValidatingAdmissionPolicy — bina kisi controller ke',
        instructions: 'Aisi policy likho jo har Deployment mein <code>owner</code> label zaroori kar de. Koi webhook pod install nahi karna.',
        template: `apiVersion: admissionregistration.k8s.io/v1
kind: {0}
metadata:
  name: require-owner-label
spec:
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["{1}"]
  validations:
    - expression: '{2} in object.metadata.labels'
      message: "har Deployment par owner label zaroori hai"`,
        blanks: [
          { answer: 'ValidatingAdmissionPolicy', explain: 'Yeh Kubernetes ka apna admission mechanism hai — CEL expressions API server ke <b>andar</b> chalte hain. Koi webhook pod nahi, isliye na <code>failurePolicy</code> ka deadlock, na network latency, na ek aur cheez jo gir sakti ho.' },
          { answer: 'deployments', explain: '<code>resources</code> mein API ka plural naam aata hai, lowercase mein — <code>deployments</code>, <code>pods</code>, <code>services</code>. Kind ka naam (<code>Deployment</code>) yahan nahi chalta.' },
          { answer: '"owner"', explain: 'CEL mein string double quotes mein likhi jaati hai. <code>"owner" in object.metadata.labels</code> map mein key ki maujoodgi check karta hai. Dhyaan: label bilkul na ho to <code>metadata.labels</code> khud hi nahi hota, isliye production policy mein <code>has(object.metadata.labels) &amp;&amp; "owner" in object.metadata.labels</code> likhna behtar hai.' },
        ],
        tokens: ['ValidatingAdmissionPolicy', 'deployments', '"owner"', 'MutatingWebhookConfiguration', 'Deployment', 'owner', 'ValidatingWebhookConfiguration'],
      },
      {
        type: 'incident',
        title: '🚨 3AM: "har deploy fail ho raha hai"',
        pager: `<b>PagerDuty · 03:40</b><br>
          Har namespace mein har <code>kubectl apply</code> fail ho raha hai.<br>
          Chal rahe pods bilkul theek chal rahe hain, traffic normal hai.<br>
          Ek release 20 minute pehle gaya tha.`,
        start: 'a1',
        nodes: {
          a1: {
            sitrep: `$ kubectl apply -f web.yaml
Error from server (InternalError): Internal error occurred:
  failed calling webhook "validate.policy-guard.svc":
  failed to call webhook: Post "https://policy-guard.security.svc:443/validate?timeout=10s":
  context deadline exceeded

$ kubectl get pods -A | grep -v Running | head
NAMESPACE   NAME                              READY   STATUS             RESTARTS   AGE
security    policy-guard-7d8c9b6a5-kk2ll      0/1     CrashLoopBackOff   14         21m`,
            text: 'Ek admission webhook jawab nahi de raha aur uske apne pods CrashLoop mein hain. Pehla kadam?',
            choices: [
              { t: 'Webhook ka failurePolicy aur namespaceSelector dekho: kubectl get validatingwebhookconfiguration policy-guard -o yaml', good: true, next: 'a2', explain: 'Sahi. Pehle yeh samjho ki webhook <b>kis-kis par</b> lagta hai aur jawab na milne par <b>kya karta hai</b>. Dono baatein isi ek object mein likhi hain, aur dono aage ka faisla badal deti hain.' },
              { t: 'validatingwebhookconfiguration turant delete kar do', good: false, explain: 'Yeh aakhri hathiyaar hai, pehla kadam nahi. Delete karte hi poore cluster ki security policy hat jayegi. Pehle 10 second lagao yeh dekhne mein ki kya webhook ko apne hi namespace se baahar rakh ke bhi kaam ban sakta hai.' },
              { t: 'policy-guard ke pods delete karo taaki naye banein', good: false, explain: 'Pod already CrashLoopBackOff mein hai — kubelet pehle se baar-baar restart kar raha hai. Ek aur restart wahi natija dega. Aur naya pod banane ke liye API server ko wahi webhook call karna pad sakta hai jo down hai.' },
              { t: 'API server restart karo', good: false, explain: 'Webhook ki configuration etcd mein hai, API server ki memory mein nahi. Restart ke baad API server wahi webhook dobara call karega aur wahi timeout milega. Aur 3AM par control plane restart karna naya outage bana sakta hai.' },
            ],
          },
          a2: {
            sitrep: `$ kubectl get validatingwebhookconfiguration policy-guard -o yaml | grep -A8 "webhooks:"
webhooks:
  - name: validate.policy-guard.svc
    failurePolicy: Fail          # ← jawab na mile to REJECT
    timeoutSeconds: 10
    namespaceSelector: {}        # ← HAR namespace, security bhi
    rules:
      - operations: ["CREATE","UPDATE"]
        apiGroups: ["*"]
        resources: ["pods","deployments"]`,
            text: '<code>failurePolicy: Fail</code> hai aur <code>namespaceSelector: {}</code> ka matlab har namespace. Yeh combination kya banata hai?',
            choices: [
              { t: 'Deadlock — policy-guard ke apne naye pods bhi nahi ban sakte, kyunki unke liye bhi wahi (down) webhook call hota hai', good: true, next: 'a3', explain: 'Bilkul. Webhook apne hi namespace par bhi lagta hai. policy-guard ka naya pod banane ke liye API server policy-guard se poochta hai, policy-guard down hai, request reject — aur policy-guard kabhi upar nahi aa paata. Yahi classic admission deadlock hai.' },
              { t: 'Kuch khaas nahi — 10 second baad request apne aap allow ho jayegi', good: false, explain: 'Ulta hai. <code>timeoutSeconds: 10</code> sirf itna kehta hai ki 10 second tak intezaar karo; uske baad <code>failurePolicy</code> tay karta hai kya karna hai. <code>Fail</code> hai, isliye 10 second baad request <b>reject</b> hoti hai, allow nahi.' },
              { t: 'Sirf naye namespaces par asar padega', good: false, explain: '<code>namespaceSelector: {}</code> ka matlab "koi filter nahi" — yaani <b>har</b> namespace, purana bhi aur naya bhi, aur <code>kube-system</code> bhi.' },
            ],
          },
          a3: {
            sitrep: `$ kubectl logs -n security policy-guard-7d8c9b6a5-kk2ll --previous
{"level":"fatal","msg":"failed to load policy bundle: /policies/rules.yaml: no such file"}

$ kubectl get cm -n security
NAME              DATA   AGE
kube-root-ca.crt  1      210d

(20 minute pehle wale release mein policy-rules ConfigMap ka naam badla tha)`,
            text: 'Asli wajah mil gayi: release ne ConfigMap ka naam badal diya aur policy-guard usse dhoondh nahi paa raha. Ab sabse achha kadam?',
            choices: [
              { t: 'Gayab ConfigMap wapas laao — release rollback karo ya sahi naam se ConfigMap dobara banao', good: true, next: 'a4', explain: 'Sahi — asli karan yahi hai. ConfigMap wapas aate hi policy-guard boot ho jayega, webhook jawab dene lagega, aur deploys apne aap chalne lagenge. Koi security hataani nahi padegi.' },
              { t: 'validatingwebhookconfiguration delete kar do, baad mein dekhenge', good: false, explain: 'Cluster to chal padega par poore cluster ki admission policy hat jayegi, aur 3AM ke "baad mein dekhenge" aksar hafton tak reh jaate hain. Asli karan (gayab ConfigMap) 30 second mein theek ho sakta hai — pehle wahi karo.' },
              { t: 'failurePolicy ko Ignore kar do', good: false, explain: 'Deploys chal padenge par har policy check chup-chaap skip hone lagega — <b>bina kisi ko pata chale</b>. Yeh usse bhi khatarnak hai jitna webhook delete karna, kyunki cluster surakshit <i>dikhta</i> rahega. Agar turant unblock karna hi ho to yeh raasta le sakte ho, par uske turant baad asli fix karna zaroori hai.' },
            ],
          },
          a4: {
            sitrep: `$ kubectl create cm policy-rules -n security --from-file=rules.yaml
configmap/policy-rules created

$ kubectl get pods -n security
NAME                            READY   STATUS    RESTARTS   AGE
policy-guard-7d8c9b6a5-kk2ll    1/1     Running   14         26m

$ kubectl apply -f web.yaml
deployment.apps/web configured`,
            text: 'Cluster wapas chal pada. Ab aage ke liye kya badalna zaroori hai?',
            choices: [
              { t: 'namespaceSelector se security aur kube-system ko baahar rakho, aur timeoutSeconds 2-3 karo', good: true, next: 'aend', explain: 'Yahi asli sudhaar hai. Webhook ko apne hi namespace se baahar rakhne se deadlock ka raasta hamesha ke liye band ho jaata hai — policy-guard hamesha apne pods bana paayega, chahe policy-guard khud down ho. Aur chhota timeout ek dhime webhook ko har API call ghaseetne se rokta hai.' },
              { t: 'failurePolicy hamesha ke liye Ignore rakh do', good: false, explain: 'Tab policy ka koi matlab hi nahi bachta — webhook down hote hi har cheez chup-chaap allow ho jayegi. <code>Fail</code> theek default hai; asli sudhaar <b>scope chhota karna</b> hai, policy kamzor karna nahi.' },
              { t: 'policy-guard ki replicas 1 se 3 kar do, bas', good: false, explain: 'Replicas badhana achha hai (aur karna bhi chahiye — PodDisruptionBudget ke saath), par deadlock ka raasta khula rehta hai. Agar teeno replicas ek hi gayab ConfigMap par crash karein, to phir wahi haalat. <b>namespaceSelector se apna namespace baahar rakhna</b> hi wo cheez hai jo deadlock ko structurally namumkin banati hai.' },
            ],
          },
          aend: {
            end: true,
            text: 'Cluster surakshit bhi, chalta hua bhi 🧯',
            summary: `<b>Kya hua tha:</b> ek release ne <code>policy-rules</code> ConfigMap ka naam badal diya.
              policy-guard boot par woh ConfigMap dhoondhta hai, mila nahi, isliye CrashLoop mein chala gaya.
              Webhook par <code>failurePolicy: Fail</code> aur <code>namespaceSelector: {}</code> the, isliye
              <b>har</b> namespace mein har pod aur deployment create reject hone laga —
              policy-guard ke apne naye pods samet. Classic admission deadlock.<br><br>
              <b>Chaar seekh:</b><br>
              1️⃣ <code>failed calling webhook … context deadline exceeded</code> ka matlab policy ne mana nahi kiya —
              policy ne <b>jawab hi nahi diya</b>.<br>
              2️⃣ <code>failurePolicy: Fail</code> + <code>namespaceSelector: {}</code> = deadlock ka nuskha.
              Webhook ko hamesha apne aur <code>kube-system</code> namespace se <b>baahar</b> rakho.<br>
              3️⃣ Emergency exit yaad rakho: <code>kubectl delete validatingwebhookconfiguration &lt;naam&gt;</code> —
              par pehle 30 second asli karan dhoondhne mein lagao.<br>
              4️⃣ Chal rahe pods bilkul theek chal rahe the. Admission sirf <b>naye ya badalte</b> objects par lagta hai,
              isliye traffic par koi asar nahi tha — sirf har badlav ruk gaya tha.`,
          },
        },
      },
    ],
    interview: {
      questions: [
        {
          q: 'Interviewer: "Mutating aur validating admission ka kram kya hai, aur kram kyun maayne rakhta hai?"',
          choices: [
            'Mutating pehle, phir schema validation, phir validating. Kram isliye maayne rakhta hai kyunki validating ko FINAL object dikhta hai — isliye ek policy pehle field bhar sakti hai aur baad mein wahi field check kar sakti hai',
            'Validating pehle, mutating baad mein — pehle check karo phir badlo',
            'Dono ek saath chalte hain',
            'Kram cluster ke configuration par nirbhar karta hai',
          ],
          answer: 0,
          explain: 'Poora raasta: authn → authz → <b>mutating</b> → schema validation → <b>validating</b> → etcd. Mutating pehle isliye rakha gaya taaki validating ko wahi object mile jo asli mein etcd mein jayega. Isi design ki wajah se yeh bahut kaam ka pattern chalta hai: Kyverno ki ek mutate policy har pod mein <code>seccompProfile: RuntimeDefault</code> daal deti hai, aur uske baad PodSecurity ka <code>restricted</code> check pass ho jaata hai — user ko kuch likhna nahi padta aur compliance bhi pakki. Ulta kram hota to policy apne hi daale field ko kabhi na dekh paati. (Schema validation beech mein isliye hai taaki mutations bhi schema ke daayre mein rahein.)',
        },
        {
          q: 'Interviewer: "Ek naya policy check lagana hai: koi bhi Deployment <code>:latest</code> tag use na kare. Kaunsa aujaar chunoge aur kyun?"',
          choices: [
            'ValidatingAdmissionPolicy (CEL) — check simple hai, API server ke andar chalta hai, isliye na webhook pod, na failurePolicy ka deadlock, na network latency',
            'Ek custom mutating webhook likhoge Go mein',
            'CI pipeline mein check daal doge, cluster mein kuch nahi',
            'PodSecurity ka restricted level',
          ],
          answer: 0,
          explain: 'Check simple hai — ek string ka suffix. <code>ValidatingAdmissionPolicy</code> ke CEL expressions API server ke <b>andar</b> chalte hain, isliye ek bhi extra pod nahi chahiye, koi webhook down nahi ho sakta, aur har API call par network hop nahi lagta. Webhook (Kyverno/Gatekeeper) tab chahiye jab logic complex ho, ya generate/mutate bhi karna ho, ya cluster ke bahar ki jaankari chahiye ho. <b>Sirf CI check kaafi nahi</b> — CI ko bypass karke koi bhi <code>kubectl apply</code> chala sakta hai; cluster-level enforcement hi asli guarantee deta hai. <code>PodSecurity</code> yahan kaam nahi karega — PodSecurity image tags nahi, sirf pod ke security fields dekhta hai.',
        },
      ],
    },
    success: [
      'Main API request ka poora raasta kram se bata sakta hoon',
      'Main mutating aur validating admission ka farq aur kram jaanta hoon',
      'Main Kyverno, Gatekeeper aur ValidatingAdmissionPolicy mein soch-samajh ke chunav kar sakta hoon',
      'Main failurePolicy: Fail ke deadlock ko pehchan sakta hoon aur usse bacha sakta hoon',
    ],
    homework: `<p>Bina kuch install kiye ek policy lagao (Kubernetes 1.30+):</p>
      <pre>kubectl apply -f - <<'EOF'
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: { name: no-latest }
spec:
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE","UPDATE"]
        resources: ["deployments"]
  validations:
    - expression: "object.spec.template.spec.containers.all(c, !c.image.endsWith(':latest'))"
      message: "':latest' tag mana hai"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: { name: no-latest-binding }
spec:
  policyName: no-latest
  validationActions: ["Deny"]
  matchResources:
    namespaceSelector: {}
EOF

kubectl create deployment bad --image=nginx:latest    # ← reject hoga
kubectl create deployment good --image=nginx:1.25     # ← chalega
kubectl delete validatingadmissionpolicybinding no-latest-binding
kubectl delete validatingadmissionpolicy no-latest
kubectl delete deploy good</pre>
      <p>Aur dekho ki mutating admission ne tumhare manifest mein kya-kya jod diya:</p>
      <pre>kubectl create deployment demo --image=nginx
kubectl get deploy demo -o yaml | head -50    # bheje hue manifest se bahut bada
kubectl delete deploy demo</pre>`,
    cards: [
      { front: 'API request ka poora raasta kya hai?', back: 'authn (401) → authz/RBAC (403) → <b>mutating</b> admission → schema validation → <b>validating</b> admission → etcd. Har padav ka apna alag error message hota hai.' },
      { front: 'Mutating pehle kyun chalta hai?', back: 'Taaki validating ko <b>final</b> object mile. Isi se yeh pattern kaam karta hai: Kyverno pehle <code>seccompProfile</code> daal deta hai, phir PodSecurity ka restricted check usi field par pass ho jaata hai.' },
      { front: '<code>failurePolicy: Fail</code> ka khatra?', back: 'Webhook se jawab na mile to request reject. Webhook ke apne pods gir jaayein to unke naye pods bhi nahi ban paate — <b>deadlock</b>. Bachav: namespaceSelector se apna aur kube-system namespace baahar rakho.' },
      { front: 'ValidatingAdmissionPolicy webhook se behtar kab hai?', back: 'Jab check simple ho. CEL expressions API server ke <b>andar</b> chalte hain — koi webhook pod nahi, koi failurePolicy deadlock nahi, koi network hop nahi.' },
      { front: '<code>failed calling webhook … context deadline exceeded</code>?', back: 'Policy ne mana <b>nahi</b> kiya — policy ne <b>jawab hi nahi diya</b>. Webhook ke pods aur uski Service ke endpoints dekho. Emergency exit: <code>kubectl delete validatingwebhookconfiguration &lt;naam&gt;</code>.' },
      { front: 'Kaunsi jaani-pehchani cheezein asli mein admission plugin hain?', back: '<code>LimitRanger</code> (defaults bharta hai — mutating), <code>ResourceQuota</code> (validating), <code>ServiceAccount</code> (default SA + token jodta hai — mutating), <code>PodSecurity</code>, <code>NamespaceLifecycle</code>, <code>DefaultStorageClass</code>.' },
    ],
  }]);

})();
