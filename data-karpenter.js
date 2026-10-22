/* =====================================================================
   KubeGurukul — Track 6: 🌲 Karpenter Gurukul (AWS/EKS flavoured)
   Nodes ka asli khel — provisioning, consolidation, cost.
   Karpenter ek CONTROLLER hai: har command ke baad reconcile hota hai.
   ===================================================================== */

KG.registerLevels('karpenter', [

  /* ================= LEVEL K1: NodePool & Provisioning ================= */
  {
    id: 'karpenterbasics',
    icon: '🌲',
    title: 'NodePool & EC2NodeClass — node abhi banega',
    badge: 'NodePool Nirmata',
    objectives: [
      'Cluster Autoscaler vs <b>Karpenter</b> — architectural farak',
      '<b>NodePool</b> (kya allowed hai) + <b>EC2NodeClass</b> (AWS ki detail)',
      'Provisioning ka flow: Pending pod → NodeClaim → EC2 → Node Ready',
      'Requirements se instance type kaise chuna jaata hai',
    ],
    lesson: [
      `<h3>🌲 Karpenter kyun — CA se kya alag?</h3>
       <p>Track 2 (Autoscaling) mein dono ka naam suna tha. Ab asli farak:</p>
       <table>
         <tr><th></th><th>Cluster Autoscaler</th><th>Karpenter</th></tr>
         <tr><td>Kaam kaise karta</td><td>Pehle se bane <b>node groups (ASG)</b> ko scale karta hai</td><td>Pod ki zaroorat dekh kar <b>node khud design</b> karta hai</td></tr>
         <tr><td>Instance type</td><td>Group mein jo fix hai wahi (m5.large hi milega)</td><td>60+ types mein se <b>best fit</b> chunta hai</td></tr>
         <tr><td>Speed</td><td>ASG → EC2 → join (~2-4 min)</td><td>Seedha EC2 API (~40 sec)</td></tr>
         <tr><td>Groups</td><td>Har instance-type/zone combo ka alag group (10-15 groups aam baat)</td><td><b>Zero groups</b> — ek NodePool kaafi</td></tr>
         <tr><td>Cost</td><td>Group ka fixed size — aksar over-provisioned</td><td>Right-sizing + spot + consolidation</td></tr>
       </table>
       <p>Ek line mein: <b>CA groups scale karta hai, Karpenter nodes banata hai.</b></p>`,
      `<h3>📋 Do resources — do alag kaam</h3>
       <pre>apiVersion: karpenter.sh/v1
kind: NodePool                        # "KYA allowed hai" — cloud-neutral
metadata: { name: default }
spec:
  template:
    spec:
      nodeClassRef:                          # v1: group + kind + name — teeno zaroori
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
      requirements:
      - key: karpenter.sh/capacity-type
        operator: In
        values: ["spot", "on-demand"]        # spot pehle try karega (sasta!)
      - key: karpenter.k8s.aws/instance-category
        operator: In
        values: ["c", "m", "r"]              # compute/general/memory
      - key: karpenter.k8s.aws/instance-generation
        operator: Gt
        values: ["5"]                        # purani generations mat lo
  limits:
    cpu: 1000                                # 💰 budget guard-rail!
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 1m                     # v1.x: disruption likha toh yeh bhi zaroori
---
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass                    # "AWS ki DETAIL" — cloud-specific
metadata: { name: default }
spec:
  amiSelectorTerms: [{ alias: al2023@latest }]   # v1: AMI explicitly (prod mein version pin karo)
  role: KarpenterNodeRole-prod               # nodes ka IAM role
  subnetSelectorTerms:   [{ tags: { "karpenter.sh/discovery": "prod" } }]
  securityGroupSelectorTerms: [{ tags: { "karpenter.sh/discovery": "prod" } }]</pre>
       <p><b>Yaad rakhne ka tarika:</b> NodePool = <i>"kaisa node chal sakta hai"</i> (rules),
       EC2NodeClass = <i>"AWS mein use kaise banao"</i> (AMI, subnet, IAM, security group).
       Ek NodePool ek NodeClass ko point karta hai; kai NodePools ek hi NodeClass share kar sakte hain.</p>`,
      `<h3>⚡ Provisioning — 40 second ki kahani</h3>
       <pre>1. Pod Pending (koi node par fit nahi)
2. Karpenter pod ke requests + affinity + tolerations padhta hai
3. NodePool ke requirements se allowed instance types filter karta hai
4. Sabse SASTA type chunta hai jo pod ko fit kare (bin-packing!)
5. NodeClaim banata hai  → kubectl get nodeclaims mein dikhega
6. EC2 launch → kubelet join → Node Ready
7. Pod schedule ho jaata hai ✓</pre>
       <p>Sabse important: Karpenter <b>ek pod ke liye ek node</b> nahi banata — woh saare
       pending pods ko dekh kar <b>batch</b> mein sochta hai, aur aisa node chunta hai jisme
       zyada se zyada pods fit ho jaayein (bin-packing). Isliye 5 chhote pods ke liye ek
       medium node banega, 5 chhote nodes nahi.</p>
       <div class="war-story"><b>⚡ Real migration:</b> Ek company ke paas CA ke saath
       <b>14 node groups</b> the (har instance-type × zone ka alag). Naya workload aane par
       naya group banana padta tha — 2 din ka Terraform kaam. Karpenter par shift kiya:
       <b>2 NodePools</b> (general + gpu), zero groups. Provisioning 3 min se 45 sec, aur
       EC2 bill <b>~40% kam</b> (spot + right-sizing + consolidation). Yeh Karpenter ka
       asli pitch hai — sirf speed nahi, <b>operational simplicity + paisa</b>.</div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'NodePool ya EC2NodeClass?',
        instructions: 'Har setting sahi resource mein daalo. (Yeh confusion bahut common hai!)',
        bins: [
          { id: 'np', label: '📋 NodePool (kya allowed)' },
          { id: 'nc', label: '🔧 EC2NodeClass (AWS detail)' },
        ],
        items: [
          { text: 'capacity-type: spot, on-demand', bin: 'np', explain: 'Scheduling requirement — kaisa node chal sakta hai. Cloud-neutral concept.' },
          { text: 'amiSelectorTerms: [{ alias: al2023@latest }]', bin: 'nc', explain: 'AWS-specific: kaunsi AMI use karni hai (v1 mein yeh field zaroori hai). NodePool ko AMI se koi lena-dena nahi.' },
          { text: 'subnetSelectorTerms (tags se subnet dhundo)', bin: 'nc', explain: 'AWS networking detail — nodes kaunse subnets mein launch honge.' },
          { text: 'limits: cpu 1000', bin: 'np', explain: 'Budget guard-rail — is pool ke saare nodes milke max 1000 CPU. Limit pahunchne par naye nodes nahi banenge (pods Pending rahenge — jaan-boojh ke!).' },
          { text: 'IAM role: KarpenterNodeRole-prod', bin: 'nc', explain: 'Nodes ki AWS identity — EC2NodeClass mein. (IRSA/Pod Identity ka concept — AWS Gurukul se connect!)' },
          { text: 'instance-category: c, m, r', bin: 'np', explain: 'Kaunsi instance families allowed hain — scheduling requirement.' },
          { text: 'consolidationPolicy: WhenEmptyOrUnderutilized', bin: 'np', explain: 'Disruption behaviour — NodePool ki policy. (Agla level iska poora khel!)' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Pehla Node',
        instructions: 'Karpenter LIVE controller hai — har command ke baad woh reconcile karta hai. Pending pod par nazar rakho!',
        goal: 'Cluster mein NodePool laga hai par abhi koi Karpenter node nahi. <b>(1)</b> <code>kubectl get nodepools</code> aur <code>kubectl get ec2nodeclasses</code> se setup dekho, <b>(2)</b> <code>kubectl get pods</code> — ek pod <b>Pending</b> hai, <b>(3)</b> <code>kubectl describe pod</code> se dekho Karpenter ne kya bola, <b>(4)</b> <code>kubectl get nodeclaims</code> aur <code>kubectl get nodes</code> chalate raho — node banta hua dekho aur pod Running hote dekho.',
        tasks: [
          { text: 'NodePool + EC2NodeClass dekho', check: s => s.history.some(h => /get (nodepools|np)\b/.test(h)) && s.history.some(h => /get (ec2nodeclasses|ec2nc)\b/.test(h)) },
          { text: 'NodeClaim banta hua dekho', check: s => s.history.some(h => /get (nodeclaims|nc)\b/.test(h)) && (s.cluster.nodeclaims || []).length > 0 },
          { text: 'Pod Running ho jaaye (node ready)', check: s => (s.cluster.pods || []).every(p => p.status === 'Running') },
        ],
        cluster: {
          karpenter: { enabled: true, tick: 0, log: [] },
          nodes: [
            { name: 'ip-10-0-1-10.ap-south-1.compute.internal', status: 'Ready', roles: '<none>', age: '30d', version: 'v1.30.2', instanceType: 'm6a.large', capacityType: 'on-demand', zone: 'ap-south-1a', nodepool: '(managed node group)', cpu: 2, mem: 8, usedCpu: 1.8, usedMem: 6 },
          ],
          pods: [
            { name: 'api-7d8f9-aaa', ready: '1/1', status: 'Running', restarts: 0, age: '5d', node: 'ip-10-0-1-10.ap-south-1.compute.internal', ip: '10.244.1.5', logs: '[api] serving', requests: { cpu: '1500m', memory: '4Gi' } },
            { name: 'batch-report-xyz', ready: '0/1', status: 'Pending', restarts: 0, age: '30s', node: '<none>', ip: '<none>',
              requests: { cpu: '3', memory: '6Gi' },
              logs: 'Error from server (BadRequest): pod is Pending — container start hi nahi hua (logs nahi honge!)',
              describe: 'Name:      batch-report-xyz\nStatus:    Pending\nRequests:  cpu: 3, memory: 6Gi\n\nEvents:\n  Warning  FailedScheduling  30s   0/1 nodes are available: 1 Insufficient cpu.\n  Normal   Nominated         25s   karpenter: pod ne node provisioning trigger kiya — NodeClaim aa raha hai...\n\n(kubectl get nodeclaims chalao — naya node ban raha hai!)' },
          ],
          deployments: [], services: [],
          nodepools: [
            {
              name: 'default', weight: 10, nodeClassRef: 'default',
              requirements: [
                { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot', 'on-demand'] },
                { key: 'karpenter.k8s.aws/instance-category', operator: 'In', values: ['c', 'm', 'r'] },
              ],
              limits: { cpu: 1000 }, used: { cpu: 0 },
              disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized', consolidateAfter: '1m' },
            },
          ],
          ec2nodeclasses: [{ name: 'default', amiFamily: 'AL2023', role: 'KarpenterNodeRole-prod', ready: 'True', age: '30d' }],
          nodeclaims: [],
        },
        success: s => (s.cluster.pods || []).every(p => p.status === 'Running') &&
          s.history.some(h => /get (nodepools|np)\b/.test(h)) &&
          s.history.some(h => /get (nodeclaims|nc)\b/.test(h)),
        successText: 'Node ban gaya, pod chal pada! 🌲 Poora flow live dekha: <b>Pending pod</b> (3 CPU chahiye, maujooda node par sirf 0.2 bachi thi) → Karpenter ne NodePool ke requirements padhe → <b>NodeClaim</b> banaya → EC2 launch → <b>Node Ready</b> → pod schedule. Dhyan do konsa instance type chuna gaya — Karpenter ne <b>sabse chhota type jo fit kare</b> woh liya (bin-packing), aur <b>spot</b> capacity-type allowed thi toh sasta wala. <code>kubectl get events</code> se poori kahani dobara padh sakte ho.',
        hints: [
          'kubectl get nodepools · kubectl get ec2nodeclasses — setup samjho',
          'kubectl get pods → batch-report Pending. kubectl describe pod batch-report-xyz → Events padho',
          'kubectl get nodeclaims (naya claim!) → phir kubectl get nodes → phir kubectl get pods (ab Running!)',
        ],
      },
      {
        type: 'fill',
        title: 'NodePool Likho',
        instructions: 'Production NodePool banao — spot-first, modern instances, budget guard-rail ke saath.',
        template: 'apiVersion: karpenter.sh/v1\nkind: {0}\nmetadata:\n  name: default\nspec:\n  template:\n    spec:\n      nodeClassRef:\n        group: karpenter.k8s.aws\n        kind: EC2NodeClass\n        name: default\n      requirements:\n      - key: karpenter.sh/{1}\n        operator: In\n        values: ["spot", "on-demand"]      # spot pehle try hoga\n      - key: karpenter.k8s.aws/instance-category\n        operator: In\n        values: ["c", "m", "r"]\n  {2}:\n    cpu: 1000                              # budget guard-rail\n  disruption:\n    consolidationPolicy: {3}\n    consolidateAfter: 1m',
        blanks: [
          { answer: 'NodePool', explain: 'karpenter.sh/v1 ka NodePool — "kaisa node chal sakta hai" ke rules. (Purane blogs mein "Provisioner" milega — woh v1beta se pehle ka naam tha.)' },
          { answer: 'capacity-type', explain: 'spot + on-demand dono allowed → Karpenter spot pehle try karega (60-70% sasta), na mile toh on-demand. Fault-tolerant workloads ke liye best combo.' },
          { answer: 'limits', explain: 'Poore NodePool ki max capacity. Yeh <b>runaway cost ka brake</b> hai — koi buggy HPA 500 pods maange toh bhi bill nahi phategi (pods Pending rahenge, jo dikhta hai).' },
          { answer: 'WhenEmptyOrUnderutilized', explain: 'Khaali nodes bhi hatao aur kam bhare nodes bhi merge karo — max saving. (WhenEmpty conservative hai: sirf bilkul khaali nodes.)' },
        ],
        tokens: ['NodePool', 'capacity-type', 'limits', 'WhenEmptyOrUnderutilized', 'Provisioner', 'instance-type', 'requests', 'WhenEmpty'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Provisioning ke nuqte',
        questions: [
          {
            q: '5 chhote pods (0.5 CPU each) ek saath Pending ho gaye. Karpenter kya karega?',
            choices: [
              'Ek node banayega jisme paanchon fit ho jaayein (bin-packing) — na ki 5 chhote nodes',
              '5 alag nodes, har pod ke liye ek',
              'Sirf ek pod ke liye node, baaki Pending',
              'Kuch nahi karega — 5 pods bahut kam hain',
            ],
            answer: 0,
            explain: 'Karpenter saare pending pods ko <b>batch</b> mein dekhta hai aur best-fit node chunta hai. Yeh CA se bada farak hai (CA group ka fixed size scale karta hai, chahe zaroorat aadhi ho).',
          },
          {
            q: 'NodePool ki <code>limits.cpu</code> pahunch gayi. Naye Pending pods ka kya hoga?',
            choices: [
              'Pending hi rahenge — Karpenter naye nodes nahi banayega (yeh budget guard-rail jaan-boojh ke hai)',
              'Karpenter limit ignore kar dega',
              'Purane nodes delete karke jagah banayega',
              'Cluster crash ho jayega',
            ],
            answer: 0,
            explain: 'Limit ek <b>hard stop</b> hai. Pods Pending dikhenge (aur unke Events mein saaf likha hoga "limit reached") — yeh silent bill-shock se bahut behtar hai. Monitoring mein NodePool utilization par alert lagao.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Karpenter Basics',
      instructions: 'EKS ke interviews mein yeh ab standard sawal hai. 🎤',
      questions: [
        {
          q: '"Karpenter aur Cluster Autoscaler mein architectural farak?" — best jawab?',
          choices: [
            'CA pehle se bane node GROUPS (ASG) ko scale karta hai — group ka instance type fixed hai; Karpenter pending pods ki requirements dekh kar node KHUD design karta hai (60+ types mein se best-fit, spot-aware), groups ki zaroorat nahi — isliye tez (~40s vs ~3min), sasta (right-sizing + consolidation) aur operationally simple',
            'Karpenter naya hai isliye better hai',
            'Dono same hain, sirf AWS ka branding alag hai',
            'CA pods scale karta hai, Karpenter nodes',
          ],
          answer: 0,
          explain: 'Teen axes par compare karo: architecture (groups vs direct), speed, cost/ops. War-story ka number bhi bolo (14 node groups → 2 NodePools, 40% bill kam) — concrete numbers yaad rehte hain.',
        },
        {
          q: 'NodePool aur EC2NodeClass ka division of labour?',
          choices: [
            'NodePool = scheduling rules (capacity-type, instance-category, limits, disruption) — cloud-neutral; EC2NodeClass = AWS ki detail (AMI family, subnets, security groups, IAM role). NodePool ek NodeClass ko reference karta hai',
            'Dono same cheez ke naam hain',
            'EC2NodeClass pods define karta hai',
            'NodePool AWS-specific hai, EC2NodeClass generic',
          ],
          answer: 0,
          explain: '"Rules vs infrastructure detail" — ek line mein. Bonus: kai NodePools (general, gpu, batch) ek hi EC2NodeClass share kar sakte hain, ya alag-alag (alag subnets/AMIs ke liye).',
        },
        {
          q: 'Karpenter install karne ke baad purane managed node groups ka kya karoge?',
          choices: [
            'Ek chhota managed node group rakho (Karpenter khud, CoreDNS jaise critical system pods ke liye) — baaki workloads Karpenter ke nodes par migrate karo; Karpenter apne aapko host nahi kar sakta',
            'Saare node groups turant delete kar do',
            'Dono ko parallel chalate raho hamesha',
            'Node groups aur Karpenter ek saath nahi chal sakte',
          ],
          answer: 0,
          explain: 'Chicken-and-egg problem: Karpenter controller ko bhi kisi node par chalna hai. Standard practice: 2-node managed group system components ke liye, baaki sab Karpenter. Yeh practical detail dikhati hai ki tumne asli setup kiya hai.',
        },
      ],
    },
    success: [
      'Main CA vs Karpenter ka architectural farak samjha sakta hoon',
      'Main NodePool aur EC2NodeClass ka role alag-alag bata sakta hoon',
      'Main provisioning flow (Pending → NodeClaim → Node) trace kar sakta hoon',
      'Main limits se cost guard-rail laga sakta hoon',
    ],
    homework: `<p>Asli Karpenter EKS par (AWS account chahiye — ya sirf padh lo):</p>
      <pre># EKS cluster par Karpenter install (eksctl/helm — docs se):
helm upgrade --install karpenter oci://public.ecr.aws/karpenter/karpenter \\
  --namespace karpenter --create-namespace --version 1.0.6

# NodePool + EC2NodeClass apply karo (upar wala YAML)
kubectl get nodepools
kubectl get ec2nodeclasses

# ab ek bada pod maango aur node banta dekho:
kubectl create deployment inflate --image=public.ecr.aws/eks-distro/kubernetes/pause:3.7
kubectl set resources deploy inflate --requests=cpu=1
kubectl scale deploy inflate --replicas=8
kubectl get nodeclaims -w        # naya NodeClaim! (Ctrl+C)
kubectl get nodes -L karpenter.sh/capacity-type -L node.kubernetes.io/instance-type
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter -f   # controller ki soch padho!

kubectl delete deploy inflate    # ab consolidation dekho (agla level!)</pre>
      <p>✅ Self-check: Karpenter ke logs mein "launched nodeclaim" aur instance type ka faisla dikha? Woh logs padhna hi asli Karpenter debugging hai.</p>`,
    cards: [
      { front: 'Karpenter vs Cluster Autoscaler?', back: 'CA pehle se bane <b>node groups</b> scale karta hai (type fixed). Karpenter pending pods dekh kar <b>node khud design</b> karta hai (60+ types mein best-fit, spot-aware), groups ki zaroorat nahi → ~40s vs ~3min, aur right-sizing se sasta.' },
      { front: 'NodePool vs EC2NodeClass?', back: '<b>NodePool</b> = scheduling rules (capacity-type, instance-category, limits, disruption) — cloud-neutral. <b>EC2NodeClass</b> = AWS detail (AMI via amiSelectorTerms, subnets, security groups, IAM role). NodePool NodeClass ko reference karta hai.' },
      { front: 'Provisioning flow (5 steps)?', back: 'Pending pod → Karpenter requirements padhta hai → allowed instance types filter → <b>NodeClaim</b> banata hai → EC2 launch + kubelet join → Node Ready → pod schedule. ~40 second.' },
      { front: '5 chhote pending pods — kitne nodes?', back: '<b>Ek</b> (jitne fit ho jaayein) — Karpenter saare pending pods ko batch mein dekh kar <b>bin-packing</b> karta hai. CA ki tarah har group ko andha scale nahi karta.' },
      { front: 'NodePool limits.cpu ka kaam?', back: '<b>Budget guard-rail</b> — us pool ke saare nodes ki max capacity. Limit par pods <b>Pending</b> reh jaayenge (Events mein saaf likha hota hai) — silent bill-shock se behtar. Utilization par alert lagao.' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('karpenter', [

  /* ================= LEVEL K2: Consolidation & Disruption ================= */
  {
    id: 'karpenterdisrupt',
    icon: '💰',
    title: 'Consolidation, Spot & Disruption',
    badge: 'Cost Katari',
    objectives: [
      '<b>Consolidation</b> — Karpenter nodes hataata bhi hai (asli cost saving)',
      '<b>Disruption budgets</b> + PDBs + <code>do-not-disrupt</code>',
      '<b>Spot interruption</b> — 2 min ka warning aur uska handling',
      '<b>Drift</b> aur <code>expireAfter</code> — nodes ki umar',
    ],
    lesson: [
      `<h3>💰 Consolidation — paisa yahin bachta hai</h3>
       <p>Node banana aadha kaam hai. Asli saving tab hoti hai jab traffic kam ho aur
       Karpenter <b>khud nodes hata de</b>:</p>
       <table>
         <tr><th>consolidationPolicy</th><th>Kya karta hai</th><th>Kab</th></tr>
         <tr><td><code>WhenEmpty</code></td><td>Sirf bilkul <b>khaali</b> nodes hataata hai</td><td>Conservative — stateful/sensitive workloads</td></tr>
         <tr><td><code>WhenEmptyOrUnderutilized</code></td><td>Khaali + <b>kam bhare</b> nodes ke pods ko merge karke node hataata hai</td><td>Max saving — stateless apps (default choice)</td></tr>
       </table>
       <pre>disruption:
  consolidationPolicy: WhenEmptyOrUnderutilized
  consolidateAfter: 1m         # node par pod aaya/gaya → itni der shaant rahe tab consolidate (Never = band)
  budgets:
  - nodes: "10%"               # ek waqt mein max 10% nodes disrupt
  - nodes: "0"                 # ...par business hours mein bilkul nahi:
    schedule: "30 3 * * mon-fri"   # ⚠️ cron UTC mein hota hai — 03:30 UTC = 9:00 AM IST
    duration: 8h</pre>
       <p>Consolidation 3 tarah se hoti hai: <b>delete</b> (khaali node hatao),
       <b>replace</b> (bada node → chhota sasta node), aur multi-node consolidation
       (2 chhote → 1 medium). Har baar Karpenter pehle naya node banata hai, phir pods
       shift karta hai, phir purana hataata hai — <b>graceful</b>.</p>`,
      `<h3>🛡️ Disruption se bachaav — teen layers</h3>
       <pre>1. PodDisruptionBudget (PDB)          — "minAvailable: 2" — K8s ka standard
2. karpenter.sh/do-not-disrupt: "true" — pod annotation: "mujhe mat hilao"
3. disruption.budgets                  — NodePool level: kitne nodes ek saath</pre>
       <p><b>Kab kya:</b> Batch job jo 6 ghante chalti hai → <code>do-not-disrupt</code>
       annotation. Stateless web app → PDB kaafi (Karpenter usse respect karta hai).
       Poore cluster ki safety → budgets (business hours mein 0).</p>
       <div class="war-story"><b>⚡ Real incident:</b> Ek data team ki 4-ghante wali Spark
       job 3 baar fail hui. Wajah: consolidation ne us node ko "underutilized" samajh kar
       hata diya (job ka CPU usage burst-y tha — beech mein kam dikhta tha). Har baar 3
       ghante ka kaam barbaad. Fix: job pods par
       <code>karpenter.sh/do-not-disrupt: "true"</code>. <b>Ek annotation, teen din ka
       dukh khatam.</b> Sabak: consolidation stateless ke liye vardaan hai, long-running
       batch ke liye khatra — usse batao kya nahi chhoona.</div>`,
      `<h3>⚡ Spot interruption aur drift</h3>
       <pre>Spot node par AWS 2-minute ka warning bhejta hai (interruption notice)
  → Karpenter turant: naya node banao (spot ya on-demand)
  → pods gracefully shift karo
  → purana node cordon + drain
Yeh sab 2 min ke andar — isliye spot production mein bhi use hota hai!

Zaroori: Interruption Queue (SQS) configure karo, warna warning miss ho jaayega.</pre>
       <p><b>Drift:</b> EC2NodeClass badla (naya AMI, naya security group)? Karpenter
       maujooda nodes ko <b>drifted</b> mark karta hai aur dheere-dheere replace karta hai
       (budgets ke hisaab se). Yeh security patching ka automatic raasta hai —
       AMI update karo, cluster khud roll ho jaayega.</p>
       <p><b>expireAfter:</b> <code>expireAfter: 720h</code> (30 din) — koi node isse
       purana na ho. Node rotation = patched AMIs + koi "pet" node nahi. Yeh
       compliance walon ki favourite setting hai.</p>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Mission: Consolidation Live',
        instructions: 'Traffic kam ho gaya. Ab dekho Karpenter kaise paisa bachata hai — aur ek job ko kaise bachana hai.',
        goal: 'Cluster mein 3 Karpenter nodes hain par load kam hai. <b>(1)</b> <code>kubectl get nodes</code> aur <code>kubectl get pods -o wide</code> se dekho kaunsa node khaali/kam bhara hai, <b>(2)</b> ek lambi batch job chal rahi hai — usse consolidation se bachao (<code>ls</code> se fix dekho), <b>(3)</b> phir commands chalate raho aur <code>kubectl get events</code> se consolidation hote dekho — nodes kam hone chahiye.',
        tasks: [
          { text: 'Nodes aur pods ka distribution dekho', check: s => s.history.some(h => /get pods.*-o ?wide/.test(h)) },
          { text: 'Batch job ko do-not-disrupt se bachao', check: s => (s.cluster.pods || []).some(p => p.name.startsWith('spark') && p.doNotDisrupt) },
          { text: 'Consolidation hone do — nodes kam ho jaayein', check: s => (s.cluster.nodes || []).filter(n => n.karpenter).length < 3 },
        ],
        cluster: {
          karpenter: { enabled: true, tick: 0, log: [] },
          nodes: [
            { name: 'ip-10-0-20-4.ap-south-1.compute.internal', status: 'Ready', roles: '<none>', age: '2h', version: 'v1.30.2', instanceType: 'c6a.2xlarge', capacityType: 'spot', zone: 'ap-south-1a', nodepool: 'default', cpu: 8, mem: 16, usedCpu: 1, usedMem: 2, karpenter: true },
            { name: 'ip-10-0-21-4.ap-south-1.compute.internal', status: 'Ready', roles: '<none>', age: '2h', version: 'v1.30.2', instanceType: 'c6a.xlarge', capacityType: 'spot', zone: 'ap-south-1b', nodepool: 'default', cpu: 4, mem: 8, usedCpu: 0, usedMem: 0, karpenter: true },
            { name: 'ip-10-0-22-4.ap-south-1.compute.internal', status: 'Ready', roles: '<none>', age: '90m', version: 'v1.30.2', instanceType: 'm6a.xlarge', capacityType: 'on-demand', zone: 'ap-south-1c', nodepool: 'default', cpu: 4, mem: 16, usedCpu: 2, usedMem: 8, karpenter: true },
          ],
          pods: [
            { name: 'web-5f6a-a', ready: '1/1', status: 'Running', restarts: 0, age: '2h', node: 'ip-10-0-20-4.ap-south-1.compute.internal', ip: '10.244.2.5', requests: { cpu: '1', memory: '2Gi' }, logs: '[web] serving' },
            { name: 'spark-job-driver', ready: '1/1', status: 'Running', restarts: 0, age: '90m', node: 'ip-10-0-22-4.ap-south-1.compute.internal', ip: '10.244.4.7', requests: { cpu: '2', memory: '8Gi' },
              logs: '[spark] processing partition 340/900...\n[spark] estimated time remaining: 2h 10m\n⚠️  yeh job restart hui toh 90 min ka kaam barbaad!' },
          ],
          deployments: [], services: [],
          nodepools: [{
            name: 'default', weight: 10, nodeClassRef: 'default',
            requirements: [
              { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot', 'on-demand'] },
              { key: 'karpenter.k8s.aws/instance-category', operator: 'In', values: ['c', 'm', 'r'] },
            ],
            limits: { cpu: 1000 }, used: { cpu: 16 },
            disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized', consolidateAfter: '1m' },
          }],
          ec2nodeclasses: [{ name: 'default', amiFamily: 'AL2023', role: 'KarpenterNodeRole-prod', ready: 'True', age: '60d' }],
          nodeclaims: [
            { name: 'default-a1b2c', nodeName: 'ip-10-0-20-4.ap-south-1.compute.internal', type: 'c6a.2xlarge', capacity: 'spot', zone: 'ap-south-1a', nodepool: 'default', ready: 'True', age: '2h' },
            { name: 'default-d3e4f', nodeName: 'ip-10-0-21-4.ap-south-1.compute.internal', type: 'c6a.xlarge', capacity: 'spot', zone: 'ap-south-1b', nodepool: 'default', ready: 'True', age: '2h' },
            { name: 'default-g5h6i', nodeName: 'ip-10-0-22-4.ap-south-1.compute.internal', type: 'm6a.xlarge', capacity: 'on-demand', zone: 'ap-south-1c', nodepool: 'default', ready: 'True', age: '90m' },
          ],
        },
        files: {
          'protect-spark.yaml': {
            desc: 'spark-job-driver pod par karpenter.sh/do-not-disrupt: "true" annotation lagata hai',
            apply: s => {
              const p = s.cluster.pods.find(x => x.name.startsWith('spark'));
              p.doNotDisrupt = true;
              p.logs += '\n[karpenter] annotation lagi: do-not-disrupt=true — ab is node ko consolidation nahi chhoo sakta ✓';
              return 'pod/spark-job-driver annotated\n(karpenter.sh/do-not-disrupt="true" — 2 ghante ka baaki kaam ab safe hai ✓)';
            },
          },
          'disable-consolidation.yaml': {
            desc: 'NodePool par consolidateAfter: Never — consolidation poori tarah band',
            apply: s => {
              s.cluster.nodepools[0].disruption.consolidateAfter = 'Never';
              s.cluster.karpenter.consolidate = false;
              return 'nodepool.karpenter.sh/default configured (consolidateAfter: Never) — consolidation DISABLED\n\n⚠️  Job toh bach gayi, par ab khaali nodes bhi kabhi nahi hatenge — bill badhta rahega!\nSahi fix: consolidation chaalu rakho, sirf us POD ko do-not-disrupt karo (protect-spark.yaml).';
            },
          },
        },
        success: s => (s.cluster.pods || []).some(p => p.name.startsWith('spark') && p.doNotDisrupt) &&
          (s.cluster.nodes || []).filter(n => n.karpenter).length < 3 &&
          s.cluster.karpenter.consolidate !== false,
        successText: 'Paisa bacha aur job bhi bachi! 💰 Dekha kya hua: <b>khaali node</b> (ip-10-0-21-4, 0 pods) consolidation se hat gaya — turant saving. Aur <b>spark job wala node</b> nahi hila kyunki tumne <code>do-not-disrupt</code> annotation lagayi thi. <b>Galat raasta</b> yeh hota: consolidation poori tarah band kar dena — job bach jaati par khaali nodes bhi hamesha chalte rehte (bill 💸). <b>Sahi soch: policy poore cluster ke liye rakho, exception sirf us pod par lagao.</b>',
        hints: [
          'kubectl get nodes → 3 nodes; kubectl get pods -o wide → dekho kaunse node par kya hai (ek node bilkul khaali hai!)',
          'spark job 90 min chal chuki hai, 2 ghante baaki — usse bachao: ls → protect-spark.yaml (poori consolidation band MAT karo!)',
          'Fix ke baad 2-3 commands chalao (get nodes / get events) — consolidation ko reconcile hone do',
        ],
      },
      {
        type: 'bins',
        title: 'Disruption se Kaise Bachaoge?',
        instructions: 'Har workload ke liye sahi protection chuno.',
        bins: [
          { id: 'dnd', label: '🛑 do-not-disrupt annotation' },
          { id: 'pdb', label: '🛡️ PodDisruptionBudget' },
          { id: 'budget', label: '📅 NodePool disruption budget' },
          { id: 'none', label: '😌 Kuch nahi chahiye' },
        ],
        items: [
          { text: '4-ghante wali Spark batch job', bin: 'dnd', explain: 'War-story wala case! Restart = ghanton ka kaam barbaad. Single long-running pod = do-not-disrupt.' },
          { text: 'Web app, 10 replicas, stateless', bin: 'pdb', explain: 'PDB (minAvailable: 8) — Karpenter usse respect karta hai. Pods aa-ja sakte hain, bas ek saath sab nahi.' },
          { text: 'Business hours (9-5) mein koi disruption nahi chahiye', bin: 'budget', explain: 'NodePool budgets with schedule — cluster-wide policy, per-workload nahi.' },
          { text: 'Nightly cron job (5 min, retry-safe)', bin: 'none', explain: 'Chhota aur retry-safe — disrupt ho gaya toh phir chal jayega. Over-protection se consolidation ruk jaati hai (paisa jalta hai).' },
          { text: 'Database StatefulSet (3 replicas, quorum chahiye)', bin: 'pdb', explain: 'PDB minAvailable: 2 — quorum bacha rahega. (Aur nodes par anti-affinity bhi — Track 2 ka gyaan!)' },
          { text: 'Poore cluster mein max 10% nodes ek saath replace hon', bin: 'budget', explain: 'budgets: [{nodes: "10%"}] — AMI drift ke waqt poora cluster ek saath roll na ho jaaye.' },
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Spot aur drift',
        questions: [
          {
            q: 'Spot node par AWS interruption notice aaya (2 min). Karpenter kya karta hai?',
            choices: [
              'Turant naya node provision karta hai, pods gracefully shift karta hai, purana cordon+drain — 2 min ke andar (Interruption Queue/SQS configured hona chahiye!)',
              'Kuch nahi — pods mar jaate hain',
              'Poore cluster ko on-demand par shift karta hai',
              '2 min baad node ko wapas le aata hai',
            ],
            answer: 0,
            explain: 'Isliye spot production mein bhi viable hai. Par SQS interruption queue zaroori hai — bina uske Karpenter ko warning milega hi nahi aur pods achanak marenge. Yeh setup step log bhool jaate hain.',
          },
          {
            q: 'EC2NodeClass mein naya AMI aaya. Maujooda nodes ka kya hoga?',
            choices: [
              'Karpenter unhe "drifted" mark karega aur dheere-dheere (budgets ke hisaab se) replace karega — automatic patching',
              'Kuch nahi hoga, purane AMI par chalte rahenge',
              'Saare nodes ek saath replace honge',
              'Cluster restart karna padega',
            ],
            answer: 0,
            explain: '<b>Drift</b> = security patching ka automatic raasta. Par budgets zaroori hain warna poora cluster ek saath roll hone lagega. <code>expireAfter</code> bhi isi family ka hai (max node age).',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Cost & Disruption',
      instructions: 'Cost optimization ke sawal ab har senior interview mein hain. 🎤',
      questions: [
        {
          q: '"Karpenter se cost kaise kam hota hai?" — poora jawab?',
          choices: [
            'Teen tarah se: (1) right-sizing — pod ki zaroorat ka exact node, over-provisioned groups nahi; (2) spot-first capacity-type (60-70% sasta) with automatic interruption handling; (3) consolidation — load kam hote hi khaali/kam-bhare nodes hataata ya chhote se replace karta hai. Guard-rail: NodePool limits',
            'Sirf spot instances use karke',
            'Nodes ko band karke',
            'Karpenter cost kam nahi karta, sirf tez hai',
          ],
          answer: 0,
          explain: 'Teeno mechanisms bolo — bahut log sirf spot bolte hain aur consolidation bhool jaate hain (jo asli continuous saving hai). Limits ka mention cost-governance awareness dikhata hai.',
        },
        {
          q: 'Consolidation ne ek lambi batch job ko maar diya. Sahi fix kya hai?',
          choices: [
            'Us job ke pods par karpenter.sh/do-not-disrupt: "true" — consolidation poore cluster ke liye chalu rahe, exception sirf wahan jahan zaroori hai',
            'Poori consolidation band kar do',
            'Batch jobs Kubernetes par mat chalao',
            'Sirf on-demand nodes use karo',
          ],
          answer: 0,
          explain: 'Scope ka sawal hai: global policy vs targeted exception. "Consolidation band karna" = har node hamesha zinda = bill. Interviewer yahi dekh raha hai ki tum blunt instrument use karte ho ya precise.',
        },
        {
          q: 'Production mein spot instances par kaunse workloads NAHI daloge?',
          choices: [
            'Jo interruption tolerate na kar sakein — single-replica stateful cheezein, lambi non-checkpointed jobs, ya strict SLA wale singleton components; inke liye on-demand NodePool alag rakho (taint + toleration se)',
            'Kuch bhi nahi — spot har jagah theek hai',
            'Sab kuch — spot kabhi production mein nahi',
            'Sirf frontend spot par',
          ],
          answer: 0,
          explain: 'Nuanced jawab: spot default ho, exceptions ke liye alag NodePool (on-demand, taint ke saath — Track 2 ka taints/tolerations!). Yeh multi-NodePool strategy asli production pattern hai.',
        },
      ],
    },
    success: [
      'Main consolidation ke dono policies aur unka cost impact samjha sakta hoon',
      'Main sahi protection (do-not-disrupt / PDB / budgets) chun sakta hoon',
      'Main spot interruption aur drift ka flow bata sakta hoon',
      'Main global policy vs targeted exception ka farak samajhta hoon',
    ],
    homework: `<p>Consolidation apni aankhon se dekho (EKS par):</p>
      <pre># pichle homework se inflate deployment scale karo
kubectl scale deploy inflate --replicas=10
kubectl get nodes -w                    # naye nodes aate dekho (Ctrl+C)

# ab load hatao:
kubectl scale deploy inflate --replicas=1
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter -f | grep -i disrupt
# → "disrupting via consolidation" dikhega! nodes hatate dekho
kubectl get nodes -w

# do-not-disrupt test:
kubectl annotate pod &lt;pod-name&gt; karpenter.sh/do-not-disrupt=true
# ab us node ko consolidation nahi chhuyega — logs mein "blocked" dikhega

kubectl delete deploy inflate</pre>
      <p>✅ Self-check: Karpenter logs mein "consolidation" wali line dikhi? Node hatte hue dekhe? Woh line dikhne ka matlab hai tumhara paisa bach raha hai. 💰</p>`,
    cards: [
      { front: 'consolidationPolicy ke 2 options?', back: '<b>WhenEmpty</b> = sirf bilkul khaali nodes hatao (conservative). <b>WhenEmptyOrUnderutilized</b> = kam bhare nodes ke pods bhi merge karke node hatao (max saving, stateless ke liye default choice).' },
      { front: 'Lambi batch job ko consolidation se kaise bachao?', back: 'Pod par <code>karpenter.sh/do-not-disrupt: "true"</code>. <b>Poori consolidation band MAT karo</b> — global policy chalu rakho, exception sirf us pod par. (Warna khaali nodes bhi hamesha chalte rahenge = bill.)' },
      { front: 'Disruption se bachaav ki 3 layers?', back: '1) <b>PDB</b> (minAvailable — stateless/quorum workloads), 2) <b>do-not-disrupt</b> annotation (single long-running pod), 3) <b>NodePool budgets</b> (cluster-wide: "10% nodes" ya business hours mein 0).' },
      { front: 'Spot interruption Karpenter kaise handle karta hai?', back: 'AWS ka <b>2-min warning</b> (SQS Interruption Queue se) → naya node provision → pods graceful shift → purana cordon+drain. <b>SQS queue configure karna zaroori</b> hai warna warning miss ho jaayega!' },
      { front: 'Drift aur expireAfter kya karte hain?', back: '<b>Drift</b>: EC2NodeClass badla (naya AMI/SG) → nodes "drifted" → budgets ke hisaab se dheere-dheere replace (automatic patching). <b>expireAfter</b>: max node age (jaise 720h) — forced rotation, koi "pet" node nahi.' },
    ],
  },

  /* ================= LEVEL K3: BOSS ================= */
  {
    id: 'karpenterboss',
    icon: '🐉',
    title: 'BOSS: Pending Pods & Bill Shock',
    badge: 'Node Nawab',
    objectives: [
      'Pending pod ke saare Karpenter reasons debug karna',
      'Cost investigation — bill kyun badha?',
      'Multi-NodePool strategy (spot + on-demand + GPU)',
      'Final interview — capacity aur cost dono',
    ],
    lesson: [
      `<h3>🐉 Do problems, ek raat</h3>
       <p>Karpenter ke saath do hi tarah ke incidents hote hain:</p>
       <ul>
         <li>🔴 <b>Pods Pending hain</b> — node ban hi nahi raha (capacity ka problem)</li>
         <li>💸 <b>Bill phat gaya</b> — nodes ban toh rahe hain, par galat/zyada</li>
       </ul>
       <p><b>Pending pod ke 5 reasons (yeh checklist ratta maar lo):</b></p>
       <pre>1. Koi NodePool match nahi kiya    → pod ke taints/tolerations, nodeSelector dekho
2. Requirements se koi instance type fit nahi → pod 8 CPU maangta hai, pool mein max 4
3. NodePool limits pahunch gayi   → limits.cpu full (budget guard-rail lag gaya)
4. EC2 capacity error             → us zone mein spot capacity khatam (ya vCPU quota!)
5. EC2NodeClass galat             → subnet/SG selector se kuch match nahi hua</pre>
       <p>Har case mein jawab <b>ek hi jagah</b> milta hai: <code>kubectl describe pod</code>
       ke <b>Events</b>, aur <code>kubectl logs -n karpenter deploy/karpenter</code>.
       Karpenter chup-chaap fail nahi hota — woh saaf-saaf likhta hai.</p>
       <div class="war-story"><b>⚡ Real bill shock:</b> Ek team ka EKS bill ek mahine mein
       2x ho gaya. Investigation: kisi ne NodePool ke requirements se
       <code>capacity-type: spot</code> hata diya tha (debugging ke liye, wapas daalna
       bhool gaye) — poora cluster <b>on-demand</b> par chal raha tha, 3 hafte tak. Doosri
       galti: <code>consolidationPolicy</code> galti se <code>WhenEmpty</code> ho gayi thi,
       toh kam-bhare nodes kabhi merge hi nahi hue. <b>Do config lines = ₹4 lakh/mahina
       extra.</b> Isliye NodePool ke changes bhi git mein aur PR review se jaane chahiye —
       GitOps track yaad hai? 🔄</div>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Round 1: Pending Pod Mystery',
        instructions: 'Teen pods Pending hain — teen bilkul alag wajah se. Har ek ka Event padho.',
        goal: 'Teen Pending pods hain: <b>gpu-trainer</b>, <b>huge-job</b>, aur <b>batch-worker</b>. <b>(1)</b> Har ek ka <code>kubectl describe pod</code> karke Events padho, <b>(2)</b> samjho teeno ki wajah ALAG hai, <b>(3)</b> <code>ls</code> se fixes dekho aur sahi wale apply karo — teeno Running hone chahiye.',
        tasks: [
          { text: 'Teeno pods ke Events padho', check: s => ['gpu-trainer', 'huge-job', 'batch-worker'].every(n => s.history.some(h => new RegExp('describe pod ' + n).test(h))) },
          { text: 'Teeno fixes apply karo', check: s => (s.cluster.pods || []).every(p => p.status === 'Running') },
        ],
        cluster: {
          karpenter: { enabled: true, tick: 0, log: [] },
          nodes: [
            { name: 'ip-10-0-30-4.ap-south-1.compute.internal', status: 'Ready', roles: '<none>', age: '5h', version: 'v1.30.2', instanceType: 'c6a.xlarge', capacityType: 'spot', zone: 'ap-south-1a', nodepool: 'default', cpu: 4, mem: 8, usedCpu: 3.5, usedMem: 7, karpenter: true },
          ],
          pods: [
            { name: 'web-aaa', ready: '1/1', status: 'Running', restarts: 0, age: '5h', node: 'ip-10-0-30-4.ap-south-1.compute.internal', ip: '10.244.5.2', requests: { cpu: '3500m', memory: '7Gi' }, logs: '[web] serving' },
            {
              name: 'gpu-trainer', ready: '0/1', status: 'Pending', restarts: 0, age: '12m', node: '<none>', ip: '<none>',
              requests: { cpu: '4', memory: '16Gi' }, unschedulable: true,
              logs: 'Error from server: pod Pending — container start hi nahi hua',
              describe: 'Name:       gpu-trainer\nStatus:     Pending\nRequests:   cpu: 4, memory: 16Gi\nTolerations: <none>            ← 👀\nNodeSelector: nvidia.com/gpu=true\n\nEvents:\n  Warning  FailedScheduling    12m   0/1 nodes are available: 1 Insufficient cpu.\n  Warning  FailedProvisioning  11m   karpenter: incompatible with nodepool "default",\n     daemonset overhead={}, no instance type satisfied requirements:\n     nodeSelector nvidia.com/gpu=true — is NodePool mein GPU nodes allowed hi nahi hain\n\n(GPU ke liye ALAG NodePool chahiye — taint + toleration ke saath)',
            },
            {
              name: 'huge-job', ready: '0/1', status: 'Pending', restarts: 0, age: '9m', node: '<none>', ip: '<none>',
              requests: { cpu: '32', memory: '128Gi' }, unschedulable: true,
              logs: 'Error from server: pod Pending',
              describe: 'Name:      huge-job\nStatus:    Pending\nRequests:  cpu: 32, memory: 128Gi        ← 👀 itna bada?\n\nEvents:\n  Warning  FailedProvisioning  9m  karpenter: no instance type satisfied resources\n     {"cpu":"32","memory":"128Gi"} — NodePool "default" ke requirements\n     (instance-category c,m,r · generation > 5) mein itna bada type allowed nahi hai\n\n(Ya toh requests galat hain, ya NodePool mein bade types allow karne padenge)',
            },
            {
              name: 'batch-worker', ready: '0/1', status: 'Pending', restarts: 0, age: '6m', node: '<none>', ip: '<none>',
              requests: { cpu: '2', memory: '4Gi' }, unschedulable: true,
              logs: 'Error from server: pod Pending',
              describe: 'Name:      batch-worker\nStatus:    Pending\nRequests:  cpu: 2, memory: 4Gi         (normal size!)\n\nEvents:\n  Warning  FailedProvisioning  6m  karpenter: nodepool "default" cpu limit reached:\n     limits.cpu = 4, current usage = 4                      ← 👀\n\n(Node ban hi nahi sakta — budget guard-rail lag gaya hai)',
            },
          ],
          deployments: [], services: [],
          nodepools: [{
            name: 'default', weight: 10, nodeClassRef: 'default',
            requirements: [
              { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot', 'on-demand'] },
              { key: 'karpenter.k8s.aws/instance-category', operator: 'In', values: ['c', 'm', 'r'] },
            ],
            limits: { cpu: 4 }, used: { cpu: 4 },
            disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized' },
          }],
          ec2nodeclasses: [{ name: 'default', amiFamily: 'AL2023', role: 'KarpenterNodeRole-prod', ready: 'True', age: '90d' }],
          nodeclaims: [{ name: 'default-z9y8x', nodeName: 'ip-10-0-30-4.ap-south-1.compute.internal', type: 'c6a.xlarge', capacity: 'spot', zone: 'ap-south-1a', nodepool: 'default', ready: 'True', age: '5h' }],
        },
        files: {
          'add-gpu-nodepool.yaml': {
            desc: 'GPU ke liye alag NodePool (taint ke saath) + gpu-trainer par toleration',
            apply: s => {
              s.cluster.nodepools.push({
                name: 'gpu', weight: 20, nodeClassRef: 'gpu',
                requirements: [
                  { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['on-demand'] },
                  { key: 'karpenter.k8s.aws/instance-category', operator: 'In', values: ['m'] },
                ],
                limits: { cpu: 200 }, used: { cpu: 0 },
                taints: [{ key: 'nvidia.com/gpu', value: 'true', effect: 'NoSchedule' }],
                disruption: { consolidationPolicy: 'WhenEmpty' },
              });
              const p = s.cluster.pods.find(x => x.name === 'gpu-trainer');
              p.tolerations = [{ key: 'nvidia.com/gpu' }];
              delete p.unschedulable;
              return 'nodepool.karpenter.sh/gpu created + pod/gpu-trainer patched (toleration added)\n(ab GPU pool match karega — node ban raha hai... kubectl get nodeclaims dekho)';
            },
          },
          'fix-huge-job-requests.yaml': {
            desc: 'huge-job ke requests 32CPU/128Gi → 8CPU/16Gi (realistic)',
            apply: s => {
              const p = s.cluster.pods.find(x => x.name === 'huge-job');
              p.requests = { cpu: '8', memory: '16Gi' };
              delete p.unschedulable;
              return 'pod/huge-job configured — requests ab 8 CPU / 16Gi\n(kisi ne copy-paste mein 32/128 likh diya tha! Ab c6a.2xlarge fit ho jayega)';
            },
          },
          'raise-nodepool-limit.yaml': {
            desc: 'default NodePool ki limits.cpu 4 → 200',
            apply: s => {
              s.cluster.nodepools[0].limits.cpu = 200;
              s.cluster.pods.forEach(p => { if (p.name === 'batch-worker') delete p.unschedulable; });
              return 'nodepool/default configured — limits.cpu: 4 → 200\n(limit itni kam kisne rakhi thi?! Ab batch-worker ke liye node ban sakta hai ✓)';
            },
          },
          'scale-down-everything.yaml': {
            desc: 'Saare pods delete karke "jagah banao"',
            apply: () => 'pods deleted...\n\n(Pending pods gaye kyunki tumne unhe MAAR diya — problem solve nahi hui! Teeno ki asli wajah alag thi: GPU pool missing, galat requests, aur limit. Yeh "fix" nahi, "chhupana" hai.)',
          },
        },
        success: s => (s.cluster.pods || []).every(p => p.status === 'Running') &&
          ['gpu-trainer', 'huge-job', 'batch-worker'].every(n => s.history.some(h => new RegExp('describe pod ' + n).test(h))),
        successText: 'Teeno mysteries solved! 🕵️ <b>Teen alag wajah, teen alag fix:</b> (1) <b>gpu-trainer</b> — koi NodePool match nahi kiya (GPU ke liye alag pool + taint/toleration chahiye tha), (2) <b>huge-job</b> — requests hi pagal the (32 CPU! copy-paste ki galti) — koi allowed instance type itna bada nahi tha, (3) <b>batch-worker</b> — pod bilkul normal tha, par <b>NodePool ki limit</b> (cpu: 4) pahunch chuki thi. Note karo: <b>teeno ka jawab pod ke Events mein saaf likha tha</b> — Karpenter kabhi chup nahi rehta.',
        hints: [
          'kubectl describe pod gpu-trainer / huge-job / batch-worker — teeno ke Events ALAG kahani batate hain',
          'gpu-trainer: nodeSelector GPU maang raha hai par koi GPU NodePool hai hi nahi. huge-job: 32 CPU?! batch-worker: "limit reached"',
          'ls → teen alag fixes apply karo (scale-down-everything wala jugaad mat karna!)',
        ],
      },
      {
        type: 'incident',
        title: '🚨 Round 2: Bill Double Ho Gaya',
        instructions: 'Finance team ne ping kiya hai. Cost investigation karo.',
        pager: '<b>FINOPS ALERT:</b> EKS compute cost pichle mahine se <b>2.1x</b> · koi naya product launch nahi hua · traffic sirf 8% badha',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ kubectl get nodes -L karpenter.sh/capacity-type -L node.kubernetes.io/instance-type\nNAME              STATUS  CAPACITY-TYPE   INSTANCE-TYPE\nip-10-0-40-4      Ready   on-demand       m6a.2xlarge\nip-10-0-41-4      Ready   on-demand       m6a.2xlarge\nip-10-0-42-4      Ready   on-demand       m6a.2xlarge\nip-10-0-43-4      Ready   on-demand       m6a.2xlarge\n... (18 nodes — SAB on-demand)',
            text: 'Traffic 8% badha par cost 110%. Saare nodes on-demand hain. Pehla shak?',
            choices: [
              { t: 'NodePool ke requirements se spot capacity-type hat gaya hai — git history dekho ki kab aur kisne', good: true, next: 'n2', explain: 'Bilkul! Spot on-demand se 60-70% sasta hota hai. Saare nodes on-demand hona koi ittefaq nahi — config badla hai. Git history isse 2 min mein confirm kar degi.' },
              { t: 'AWS ne prices badha diye honge', good: false, explain: 'EC2 on-demand prices itni jaldi 2x nahi hote. Aur traffic sirf 8% badha — matlab problem RESOURCE ALLOCATION mein hai, pricing mein nahi. Bahar blame karne se pehle apna config dekho.' },
              { t: 'Nodes badha do taaki performance theek rahe', good: false, explain: '😱 Cost problem ka jawab aur cost badhana? Pehle samjho paisa ja kahan raha hai — abhi tak koi data hi nahi dekha.' },
            ],
          },
          n2: {
            sitrep: '$ git log -p --since="6 weeks ago" -- infra/nodepool.yaml | head -30\ncommit 8f3a2b1 (5 hafte pehle) "debug: temporarily force on-demand"\n-      - key: karpenter.sh/capacity-type\n-        operator: In\n-        values: ["spot", "on-demand"]\n+      - key: karpenter.sh/capacity-type\n+        operator: In\n+        values: ["on-demand"]          ← 5 HAFTE pehle "temporary" 🙈\n\n$ kubectl get nodepool default -o yaml | grep -A2 consolidationPolicy\n  consolidationPolicy: WhenEmpty       ← ye bhi badla hua hai!',
            text: 'Do config changes mile — dono "temporary" the, dono 5 hafte se zinda hain. Ab kya?',
            choices: [
              { t: 'Dono wapas theek karo GIT mein (spot+on-demand, WhenEmptyOrUnderutilized) → PR → merge → ArgoCD sync; aur staged rollout dekho', good: true, next: 'n3', explain: 'Git-first fix (GitOps track ka sabak!). Aur dono changes ek saath — spot se instant saving, consolidation se continuous saving. Rollout dheere dekho: drift se nodes replace honge.' },
              { t: 'kubectl edit se NodePool turant theek karo', good: false, explain: 'Agar GitOps chal raha hai toh agla sync ise wapas bigaad dega. Aur audit trail bhi nahi banega — yaani 5 hafte baad phir yahi mystery. Git se karo.' },
              { t: 'Sirf spot wapas karo, consolidation baad mein dekhenge', good: false, explain: 'Aadha fix. Consolidation WhenEmpty par hai matlab kam-bhare nodes kabhi merge nahi honge — 18 nodes shayad 11 mein sama sakte hain. Dono lines ek hi PR mein.' },
            ],
          },
          n3: {
            sitrep: '$ argocd app sync platform-nodepools\nSynced ✓\n\n(agle 40 min mein — drift se nodes replace hue)\n$ kubectl get nodes -L karpenter.sh/capacity-type\n11 nodes: 9 spot, 2 on-demand\n\nEstimated monthly: $8,400 → $3,900  📉  (-54%)',
            text: 'Cost aadha ho gaya. Aage se yeh na ho — permanent fix?',
            choices: [
              { t: 'NodePool changes par mandatory PR review + cost alert (bill spike par) + FinOps dashboard (spot % aur node utilization); aur "temporary" changes par expiry reminder/issue', good: true, next: 'end', explain: 'Teen layers: process (review), detection (alert — 5 hafte tak kisi ko pata nahi chala!), aur visibility (dashboard). Detection gap hi asli bug tha — cost 5 hafte tak silently badhta raha.' },
              { t: 'Bas fix ho gaya, aage se dhyan rakhenge', good: false, explain: '"Dhyan rakhenge" process nahi hai. Yeh galti hui hi isliye kyunki koi alert nahi tha — 5 hafte tak kisi ko pata nahi chala. Detection gap bharo.' },
              { t: 'Spot ko force kar do — on-demand allow hi mat karo', good: false, explain: 'Khatarnak! Spot capacity kabhi-kabhi milti nahi (khaas kar bade types) — tab pods Pending ho jaayenge. spot+on-demand dono allowed rakho: Karpenter spot pehle try karta hai, na mile toh on-demand. Availability > thodi si extra saving.' },
            ],
          },
          end: {
            end: true,
            text: 'Bill wapas normal. FinOps khush. 💰',
            summary: '<b>Is incident ke 3 sabak:</b> (1) <b>"Temporary" config change permanent ban jaata hai</b> — infra config bhi git + review se jaaye (GitOps track!). (2) <b>Cost ka bhi monitoring hota hai</b> — 5 hafte tak kisi ko pata nahi chala; spot%, node utilization aur bill spike par alert lagao. (3) <b>Spot ko force mat karo</b> — spot+on-demand dono allowed rakho, Karpenter khud sasta pehle try karega. Availability aur cost dono chahiye.',
          },
        },
      },
      {
        type: 'quiz',
        title: 'Round 3 warm-up: Speed Round',
        instructions: 'Karpenter reflexes check!',
        questions: [
          { q: 'Pod Pending + "no instance type satisfied requirements" — kya dekhoge?', choices: ['Pod ke requests aur NodePool ke requirements — koi allowed type itna bada nahi', 'Node ki disk', 'CoreDNS', 'Cluster version'], answer: 0, explain: 'Ya requests galat hain (32 CPU!) ya NodePool bahut restrictive hai. Dono compare karo.' },
          { q: 'Consolidation se lambi job bachani hai — sahi tarika?', choices: ['Us pod par do-not-disrupt annotation', 'Poori consolidation band karo', 'On-demand par shift karo', 'Job ko chhota karo'], answer: 0, explain: 'Global policy chalu, targeted exception. Consolidation band = har khaali node hamesha zinda = bill.' },
          { q: 'NodePool limits.cpu full — pods ka kya hoga?', choices: ['Pending rahenge (guard-rail jaan-boojh ke)', 'Karpenter limit ignore karega', 'Purane pods evict honge', 'Cluster crash'], answer: 0, explain: 'Hard stop — Events mein "limit reached" saaf likha hota hai. Alert lagao NodePool utilization par.' },
          { q: 'Spot node par 2-min interruption notice — Karpenter?', choices: ['Naya node banata hai + pods graceful shift + cordon/drain', 'Kuch nahi karta', 'Cluster ko on-demand par shift karta hai', 'Node ko wapas le aata hai'], answer: 0, explain: 'Isliye spot production-viable hai — par SQS interruption queue configure hona chahiye!' },
          { q: 'EC2NodeClass mein naya AMI — maujooda nodes?', choices: ['"Drifted" mark hoke budgets ke hisaab se replace honge', 'Kuch nahi hoga', 'Sab ek saath replace', 'Manual replace karna padega'], answer: 0, explain: 'Drift = automatic security patching. Budgets zaroori hain warna poora cluster ek saath roll ho jayega.' },
        ],
      },
    ],
    interview: {
      title: '🎤 FINAL Interview — Capacity & Cost',
      instructions: 'Karpenter ka aakhri round — platform + FinOps dono.',
      questions: [
        {
          q: '"Ek EKS cluster ke liye NodePool strategy design karo" — production answer?',
          choices: [
            'Multiple NodePools by workload class: (1) default — spot+on-demand, c/m/r families, consolidation on, limits set; (2) on-demand pool with taint — critical/stateful workloads ke liye (toleration se aayenge); (3) GPU/special pool with taint. Har pool par limits (budget) aur disruption budgets; sab config git mein',
            'Ek hi NodePool sab kuch allow kare',
            'Har service ka apna NodePool',
            'NodePools ki zaroorat nahi, defaults kaafi hain',
          ],
          answer: 0,
          explain: 'Workload-class based separation + taints (Track 2!) + limits + git. "Har service ka apna pool" = wahi node-group wala dukh jo Karpenter se bachna tha. Yeh design-level jawab hai.',
        },
        {
          q: 'Pod Pending hai aur Karpenter kuch nahi kar raha. Debugging order?',
          choices: [
            'kubectl describe pod → Events (karpenter saaf likhta hai kyun) → phir karpenter controller logs → phir check: NodePool match hua? (taints/nodeSelector) requirements fit? limits full? EC2 capacity/quota error?',
            'Karpenter pod restart karo',
            'Cluster autoscaler install karo',
            'Manually node bana do',
          ],
          answer: 0,
          explain: 'Events-first (Karpenter unusually verbose hai — use karo). Phir 4 categories: match / fit / limits / cloud-side. Yeh checklist bolna hi structured debugging dikhata hai.',
        },
        {
          q: 'Management poochta hai "Karpenter se kitna bachega?" — kaise answer karoge?',
          choices: [
            'Teen sources se: spot adoption % (60-70% sasta), right-sizing (over-provisioned groups khatam), consolidation (idle capacity continuous cleanup) — typical 30-50%; par pehle current spot%, node utilization aur idle capacity measure karo, phir estimate do',
            'Bas bol do 50% bachega',
            'Kuch nahi bachega, sirf speed badhegi',
            'Depends — kuch nahi kaha ja sakta',
          ],
          answer: 0,
          explain: 'Mechanisms + realistic range + "pehle measure karo" — yeh honest engineering hai. Andha number dena ya "depends" bolke chhod dena, dono kamzor jawab hain.',
        },
        {
          q: 'Aakhri sawal: Karpenter ka core idea ek line mein?',
          choices: [
            'Pending pods ki asli zaroorat dekh kar just-in-time sahi-size ka node banao, aur zaroorat khatam hote hi hata do — capacity ko fixed groups ki jagah continuously reconcile karo',
            'Nodes ko fast banata hai',
            'Spot instances use karta hai',
            'Cluster Autoscaler ka naya version hai',
          ],
          answer: 0,
          explain: '🏆 Aur dekho — yeh wahi <b>reconciliation loop</b> hai jo poore course mein chala aa raha hai: desired (pending pods ki zaroorat) vs actual (maujooda nodes), farak mitao. Pods, releases, git, aur ab capacity — <b>ek hi pattern, har layer par</b>. Node Nawab! 🌲',
        },
      ],
    },
    success: [
      'Main Pending pod ke saare Karpenter reasons systematically debug kar sakta hoon',
      'Main cost regression investigate kar sakta hoon (spot%, consolidation, git history)',
      'Main multi-NodePool strategy design kar sakta hoon',
      'Main NODE NAWAB hoon 🌲 — capacity aur cost dono control mein!',
    ],
    homework: `<p>🎓 Graduation — apna NodePool strategy banao:</p>
      <pre># 1) Do NodePools banao: default (spot-first) aur critical (on-demand + taint)
#    critical pool par taint: workload=critical:NoSchedule
#    critical pods par matching toleration
# 2) Cost dekho:
kubectl get nodes -L karpenter.sh/capacity-type   # kitne spot vs on-demand?
kubectl top nodes                                  # utilization kitna hai?
# 3) Karpenter ke logs se uski "soch" padho:
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter --tail=100 | grep -E "launched|disrupt|nominated"
# 4) Ek pod jaan-boojh ke Pending karao (bahut bade requests) aur Events padho:
kubectl run huge --image=nginx --requests=cpu=64
kubectl describe pod huge | tail -10               # karpenter ka message padho!
kubectl delete pod huge</pre>
      <p>✅ Self-check: Karpenter ke logs mein "launched nodeclaim" aur "disrupting via consolidation" dono dikhe? Aur Pending pod ke Events mein exact wajah? <b>Track COMPLETE — NODE NAWAB! 🌲🎓</b></p>`,
    cards: [
      { front: 'Pending pod ke 5 Karpenter reasons?', back: '1) Koi <b>NodePool match nahi</b> (taints/nodeSelector), 2) <b>requirements se koi instance type fit nahi</b> (requests bahut bade), 3) <b>NodePool limits</b> full, 4) <b>EC2 capacity/quota</b> error, 5) <b>EC2NodeClass</b> selectors galat. Jawab hamesha: <code>describe pod</code> → Events.' },
      { front: 'EKS bill achanak 2x — Karpenter checklist?', back: '1) <code>get nodes -L karpenter.sh/capacity-type</code> — spot% gira toh nahi? 2) consolidationPolicy <b>WhenEmpty</b> par toh nahi (merge nahi hoga)? 3) <b>git log</b> NodePool config par — koi "temporary" change zinda toh nahi? 4) node utilization.' },
      { front: 'Multi-NodePool strategy kya hoti hai?', back: 'Workload-class ke hisaab se: <b>default</b> (spot+on-demand, consolidation on), <b>critical/on-demand</b> (taint + toleration se sirf critical pods), <b>GPU/special</b> (taint). Har pool par <b>limits</b> = budget guard-rail.' },
      { front: 'Spot ko "force" kyun nahi karna chahiye?', back: 'Spot capacity kabhi-kabhi milti hi nahi (khaas kar bade types) → pods <b>Pending</b>. <code>values: ["spot","on-demand"]</code> rakho — Karpenter spot pehle try karega, na mile toh on-demand. Availability > thodi extra saving.' },
      { front: 'Karpenter ka core idea (ek line)?', back: 'Pending pods ki asli zaroorat dekh kar <b>just-in-time sahi-size ka node</b> banao, aur zaroorat khatam hote hi <b>hata do</b> — capacity ko fixed groups ki jagah continuously <b>reconcile</b> karo. (Wahi reconciliation pattern, ab compute par!)' },
    ],
  },

]);
