/* =====================================================================
   KubeGurukul — Track 5: 🔄 ArgoCD Gurukul
   GitOps ka poora shastra — har level mein asli `argocd` terminal.
   ===================================================================== */

KG.registerLevels('argocd', [

  /* ================= LEVEL A1: Pehla Application ================= */
  {
    id: 'argobasics',
    icon: '🔄',
    title: 'Pehla Application — Sync aur Health',
    badge: 'Application Aarambhak',
    objectives: [
      'Application CR ke 4 hisse: <b>source</b> (repo/path/revision) + <b>destination</b>',
      '<b>Sync status</b> vs <b>Health status</b> — do bilkul alag sawal',
      '<code>argocd app list / get / diff / sync</code> ka roz ka flow',
      '"Synced par Degraded" jaise confusing states ko padhna',
    ],
    lesson: [
      `<h3>🔄 Application = git ka pointer</h3>
       <p>ArgoCD mein sab kuch ek CR se shuru hota hai — <b>Application</b>. Woh sirf itna
       batata hai: <i>"is git folder ko us cluster-namespace mein le jao"</i>.</p>
       <pre>apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shop
  namespace: argocd            # Application HAMESHA argocd namespace mein rehti hai
spec:
  project: default
  source:                       # KAHAN SE
    repoURL: https://github.com/company/manifests
    path: apps/shop/prod
    targetRevision: main        # branch / tag / commit SHA
  destination:                  # KAHAN
    server: https://kubernetes.default.svc
    namespace: shop</pre>
       <p>Bas. Ab ArgoCD har ~3 minute git ko poll karta hai (ya webhook se turant),
       manifests render karta hai, aur cluster se compare karta hai.</p>`,
      `<h3>🚦 Do statuses — sabse zaroori concept</h3>
       <p>Naye log yahin confuse hote hain. ArgoCD do <b>alag</b> sawal poochta hai:</p>
       <table>
         <tr><th></th><th>SYNC STATUS</th><th>HEALTH STATUS</th></tr>
         <tr><td>Sawal</td><td>"Cluster git se <b>match</b> karta hai?"</td><td>"Jo chal raha hai woh <b>theek</b> hai?"</td></tr>
         <tr><td>Values</td><td><code>Synced</code> / <code>OutOfSync</code></td><td><code>Healthy</code> / <code>Progressing</code> / <code>Degraded</code> / <code>Missing</code></td></tr>
         <tr><td>Kaun decide karta</td><td>git ↔ cluster ka diff</td><td>Resource ke apne signals (pods ready? rollout complete?)</td></tr>
       </table>
       <p><b>Char combinations, char matlab:</b></p>
       <pre>Synced    + Healthy    → 😌 sab theek
OutOfSync + Healthy    → app chal rahi hai, par git kuch aur bolta hai (sync pending / drift)
Synced    + Degraded   → 🔥 git ka manifest hi kharab hai! (cluster sahi se git follow kar raha hai)
OutOfSync + Missing    → abhi tak deploy hi nahi hua (naya app)</pre>
       <div class="war-story"><b>⚡ Real confusion:</b> Deploy ke baad dashboard "Synced ✓"
       dikha raha tha, par app down thi. Team ghante bhar ArgoCD ko blame karti rahi.
       Health <b>Degraded</b> tha — yaani ArgoCD ne apna kaam PERFECT kiya (git ka manifest
       hu-ba-hu apply kiya), par us manifest mein hi image tag galat tha. <b>Synced ≠
       working.</b> Sync git ka sawal hai, Health app ka.</div>`,
      `<h3>⌨️ Roz ke 4 commands</h3>
       <pre>argocd app list                 # sab apps: sync + health ek nazar mein
argocd app get shop             # ek app ki poori kundli + resource-wise status
argocd app diff shop            # git vs cluster ka EXACT farak (yeh sabse kaam ka!)
argocd app sync shop            # git wala state apply karo</pre>
       <p>💡 <code>app diff</code> ko apna dost bana lo — "kya change hoga?" ka jawab
       apply se PEHLE mil jaata hai. Aur <code>app get</code> resource-by-resource batata
       hai ki kaunsa Deployment/Service OutOfSync ya Degraded hai.</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Status Padhna Seekho',
        instructions: 'Har situation ko sahi status-combination mein daalo. (Yeh reflex banna zaroori hai!)',
        bins: [
          { id: 'sd', label: '✅ Synced + Healthy' },
          { id: 'oh', label: '🟡 OutOfSync + Healthy' },
          { id: 'sdeg', label: '🔥 Synced + Degraded' },
          { id: 'om', label: '⚪ OutOfSync + Missing' },
        ],
        items: [
          { text: 'Sab theek — koi kaam nahi', bin: 'sd', explain: 'Ideal state. Git aur cluster same, aur app healthy.' },
          { text: 'Kisi ne kubectl se replicas badha diye', bin: 'oh', explain: 'Drift! App chal rahi hai (Healthy) par cluster git se alag ho gaya. selfHeal on ho toh apne aap wapas.' },
          { text: 'Git mein naya image tag push hua, sync abhi nahi hua', bin: 'oh', explain: 'Purana version chal raha hai (Healthy), git aage nikal gaya. Auto-sync on karo ya manually sync.' },
          { text: 'Git ke manifest mein image tag galat tha → pods CrashLoop', bin: 'sdeg', explain: 'War-story wala case! ArgoCD ne sahi apply kiya (Synced), par app hi kharab (Degraded). Ab yeh ArgoCD ka nahi, tumhare manifest ka bug hai.' },
          { text: 'Abhi-abhi Application banayi, kabhi sync nahi hua', bin: 'om', explain: 'Resources cluster mein hain hi nahi (Missing) aur git se match bhi nahi (OutOfSync). Pehla sync baaki hai.' },
          { text: 'Deployment rolling update ke beech mein hai', bin: 'sd', explain: 'Thodi der Health "Progressing" hoga, phir Healthy. Sync toh Synced hi rahega — git match kar raha hai. (Progressing = temporary, Degraded nahi!)' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Pehla Sync',
        instructions: 'Asli argocd terminal! `argocd help` se commands dekh sakte ho.',
        goal: 'Ek nayi Application deploy karo: <b>(1)</b> <code>argocd app list</code> se dekho kya hai, <b>(2)</b> <code>argocd app get shop</code> se status samjho, <b>(3)</b> <code>argocd app diff shop</code> se dekho kya apply hoga, <b>(4)</b> <code>argocd app sync shop</code> — app Synced + Healthy hona chahiye.',
        tasks: [
          { text: 'app list — sab apps dekho', check: s => s.history.some(h => /^argocd app list/.test(h)) },
          { text: 'app get shop — status padho', check: s => s.history.some(h => /^argocd app get shop/.test(h)) },
          { text: 'app diff shop — kya change hoga?', check: s => s.history.some(h => /^argocd app diff shop/.test(h)) },
          { text: 'sync karo → Synced + Healthy', check: s => { const a = (s.cluster.apps || []).find(x => x.name === 'shop'); return a && a.sync === 'Synced' && a.health === 'Healthy'; } },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.30.2' }],
          pods: [], deployments: [], services: [],
          apps: [
            {
              name: 'shop', project: 'default', repo: 'https://github.com/company/manifests',
              path: 'apps/shop/prod', targetRevision: 'main', destNamespace: 'shop',
              sync: 'OutOfSync', health: 'Missing', revision: 'a1b2c3d',
              targetRevisionSha: 'a1b2c3d',
              resources: [
                { group: '', kind: 'Namespace', name: 'shop', status: 'OutOfSync', health: '' },
                { group: 'apps', kind: 'Deployment', name: 'shop-web', status: 'OutOfSync', health: 'Missing' },
                { group: '', kind: 'Service', name: 'shop-web', status: 'OutOfSync', health: '' },
              ],
              diff: `===== apps/Deployment shop/shop-web ======
+ apiVersion: apps/v1
+ kind: Deployment
+ metadata:
+   name: shop-web
+ spec:
+   replicas: 3
+   template:
+     spec:
+       containers:
+       - image: shop/web:2.4.0

(sab kuch "+" hai — abhi cluster mein kuch hai hi nahi, yeh PEHLA deploy hai)`,
              history: [],
              onSync: (sim, app) => {
                sim.cluster.deployments.push({ name: 'shop-web', ready: '3/3', upToDate: 3, available: 3, age: '5s' });
                for (let i = 0; i < 3; i++)
                  sim.cluster.pods.push({ name: `shop-web-7d9f-${i}`, ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.' + (30 + i), logs: '[shop 2.4.0] serving on :8080' });
                sim.cluster.services.push({ name: 'shop-web', type: 'ClusterIP', clusterIP: '10.96.0.55', ports: '80/TCP', age: '5s' });
                app.resources.forEach(r => { r.health = r.kind === 'Deployment' ? 'Healthy' : r.health; });
                return true;
              },
            },
          ],
        },
        success: s => {
          const a = (s.cluster.apps || []).find(x => x.name === 'shop');
          return a && a.sync === 'Synced' && a.health === 'Healthy' &&
            s.history.some(h => /^argocd app diff shop/.test(h)) &&
            s.history.some(h => /^argocd app get shop/.test(h));
        },
        successText: 'Pehla GitOps deploy! 🔄 Dekha kya hua: shuru mein <b>OutOfSync + Missing</b> tha (git mein manifests hain, cluster mein kuch nahi), <code>diff</code> ne saara "+" dikhaya (sab naya banega), aur <code>sync</code> ke baad <b>Synced + Healthy</b>. Ab <code>kubectl get pods</code> karo — ArgoCD ne pods bana diye. Aur dhyan do: tumne <code>kubectl apply</code> ek baar bhi nahi kiya!',
        hints: [
          'argocd app list — shop OutOfSync/Missing dikhega',
          'argocd app get shop → resource-wise status. Phir argocd app diff shop',
          'argocd app sync shop — phir kubectl get pods se verify karo',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Application ki barikiyan',
        questions: [
          {
            q: 'App "Synced" hai par dashboard "OutOfSync" dikha raha tha 3 min pehle. ArgoCD ne kaise pata lagaya ki git badla?',
            choices: [
              'ArgoCD har ~3 min git poll karta hai (default) — ya git webhook se turant pata chal jaata hai',
              'Kubernetes ArgoCD ko batata hai',
              'Developer ko manually refresh karna padta hai',
              'Har commit par ArgoCD ko email jaata hai',
            ],
            answer: 0,
            explain: 'Default polling 3 min hai — isliye "maine push kiya, deploy kyun nahi hua?" ka jawab aksar "thodi der ruko" hota hai. Production mein webhook lagao (instant), aur turant chahiye toh: <code>argocd app get &lt;app&gt; --hard-refresh</code>.',
          },
          {
            q: 'Application CR khud kis namespace mein rehta hai?',
            choices: [
              'argocd namespace mein (ya jahan ArgoCD install hai) — app ke resources destination namespace mein jaate hain',
              'Jis namespace mein app deploy hoti hai',
              'default namespace mein hamesha',
              'kube-system mein',
            ],
            answer: 0,
            explain: 'Do alag namespaces: Application object <b>argocd</b> mein, uske deploy kiye resources <b>destination.namespace</b> mein. Isliye <code>kubectl get applications -n argocd</code> karna padta hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — ArgoCD Basics',
      instructions: 'GitOps ka pehla round — definitions crisp. 🎤',
      questions: [
        {
          q: '"Sync status aur Health status mein farak?" — sabse spasht jawab?',
          choices: [
            'Sync = "cluster git se match karta hai?" (Synced/OutOfSync). Health = "jo chal raha hai woh theek hai?" (Healthy/Progressing/Degraded/Missing). Do alag axes — isliye "Synced + Degraded" possible hai: ArgoCD ne sahi apply kiya par manifest hi kharab tha',
            'Dono same cheez hain, alag naam',
            'Sync pods ke liye, Health nodes ke liye',
            'Health sirf Deployments ka hota hai',
          ],
          answer: 0,
          explain: '"Synced + Degraded" wala example dena hi asli samajh dikhata hai — yeh batata hai ki tumne GitOps debug kiya hai, sirf padha nahi.',
        },
        {
          q: 'Application spec mein source aur destination kya define karte hain?',
          choices: [
            'source = KAHAN SE (repoURL + path + targetRevision), destination = KAHAN (cluster server + namespace) — beech mein ArgoCD render+compare+apply karta hai',
            'source = pods, destination = services',
            'source = ArgoCD server, destination = git',
            'Dono optional hain',
          ],
          answer: 0,
          explain: 'targetRevision ka mention karo (branch/tag/SHA) — aur bolo ki production mein floating branch (main) ki jagah tag/SHA pin karna zyada safe hota hai.',
        },
        {
          q: 'Developer bolta hai "maine git push kiya 30 second pehle, deploy kyun nahi hua?"',
          choices: [
            'ArgoCD default 3 min poll karta hai — webhook laga do (instant), ya turant chahiye toh hard-refresh/manual sync. Aur check karo: auto-sync on hai ya manual?',
            'Git repo kharab hai',
            'ArgoCD restart karo',
            'Deploy kabhi automatic nahi hota GitOps mein',
          ],
          answer: 0,
          explain: 'Do cheezein check karni hain: (1) ArgoCD ne git badla DEKHA ya nahi (poll/webhook), (2) auto-sync policy ON hai ya nahi (agli level!). Yeh roz ka sawal hai — jawab ready rakho.',
        },
      ],
    },
    success: [
      'Main Application CR ke source/destination samjha sakta hoon',
      'Main Sync aur Health ko alag-alag axes ki tarah padh sakta hoon',
      'Main app list/get/diff/sync se ek app deploy kar sakta hoon',
      'Main "Synced par Degraded" ka matlab jaanta hoon',
    ],
    homework: `<p>Asli ArgoCD — 15 min ka setup, zindagi bhar ka fayda:</p>
      <pre>kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deploy/argocd-server
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
# browser: https://localhost:8080  (admin / upar wala password)

# CLI se guestbook deploy karo:
argocd login localhost:8080 --insecure
argocd app create guestbook \\
  --repo https://github.com/argoproj/argocd-example-apps.git \\
  --path guestbook --dest-server https://kubernetes.default.svc --dest-namespace default
argocd app get guestbook        # OutOfSync + Missing!
argocd app diff guestbook
argocd app sync guestbook
argocd app get guestbook        # Synced + Healthy ✓
kubectl get pods                # ArgoCD ne banaye!</pre>
      <p>✅ Self-check: OutOfSync+Missing se Synced+Healthy tak ka safar khud dekha? UI mein resource tree bhi kholo — bahut satisfying hai.</p>`,
    cards: [
      { front: 'Sync status vs Health status?', back: '<b>Sync</b> = "cluster git se match karta hai?" (Synced/OutOfSync). <b>Health</b> = "jo chal raha hai theek hai?" (Healthy/Progressing/Degraded/Missing). Do ALAG axes — isliye <b>Synced+Degraded</b> possible: ArgoCD ne sahi apply kiya, manifest hi kharab tha.' },
      { front: 'Application CR ke 2 mukhya hisse?', back: '<b>source</b>: repoURL + path + targetRevision (kahan se). <b>destination</b>: server + namespace (kahan). Application object khud <code>argocd</code> namespace mein rehta hai, uske resources destination namespace mein.' },
      { front: '"git push kiya par deploy nahi hua" — 2 checks?', back: '1) ArgoCD ne git badla DEKHA? (default poll ~3 min — webhook lagao ya <code>--hard-refresh</code>), 2) <b>auto-sync policy</b> ON hai ya manual sync chahiye?' },
      { front: 'Roz ke 4 argocd commands?', back: '<code>app list</code> (sab ka status), <code>app get X</code> (resource-wise kundli), <code>app diff X</code> (git vs cluster — apply se PEHLE dekho), <code>app sync X</code> (apply).' },
    ],
  },

  /* ================= LEVEL A2: Sync Policies & Drift ================= */
  {
    id: 'argosync',
    icon: '🩹',
    title: 'Sync Policies — Auto, Prune & Self-Heal',
    badge: 'Drift Daman',
    objectives: [
      'Manual vs automated sync — kab kaunsa',
      '<b>prune</b> — git se hata hua resource cluster se kyun nahi hatta',
      '<b>selfHeal</b> — manual kubectl changes ka automatic ilaaj',
      '<code>ignoreDifferences</code> — HPA jaise "jaan-boojh ke alag" fields',
    ],
    lesson: [
      `<h3>🎚️ Teen switch — teen alag kaam</h3>
       <pre>spec:
  syncPolicy:
    automated:
      prune: true        # git se DELETE hua → cluster se bhi delete
      selfHeal: true     # cluster manually badla → git wala wapas laga do
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true</pre>
       <table>
         <tr><th>Switch</th><th>Off hone par kya hota hai</th></tr>
         <tr><td><code>automated</code></td><td>Git badalta rahega, cluster wahi rahega — har baar manually <code>argocd app sync</code> karna padega</td></tr>
         <tr><td><code>prune</code></td><td>Git se file delete ki? Resource cluster mein <b>zinda rahega</b> aur app hamesha <b>OutOfSync</b> dikhega (bahut confusing!)</td></tr>
         <tr><td><code>selfHeal</code></td><td>Kisi ne <code>kubectl edit</code> kiya toh drift <b>dikhega</b> par theek nahi hoga — koi manually sync kare tab</td></tr>
       </table>
       <p>⚠️ <code>prune: true</code> shakti bhi hai aur khatra bhi: galat path ya khaali
       folder git mein push hua toh ArgoCD <b>sab kuch delete</b> kar dega. Isliye
       production mein <code>prune</code> ke saath <b>PR review</b> aur
       <code>PruneLast=true</code> jaise options use hote hain.</p>`,
      `<h3>🩹 selfHeal — drift ka ilaaj</h3>
       <pre>3:00 AM  on-call: kubectl scale deploy/shop --replicas=20   (traffic spike)
3:00:30  ArgoCD: "cluster git se alag hai" → OutOfSync
3:00:45  selfHeal: replicas wapas 3 😱  → site phir gir gayi</pre>
       <div class="war-story"><b>⚡ Real incident:</b> Yeh exact scene bahut teams ke saath
       hua hai. Sabak <b>selfHeal band karna nahi</b> hai — sabak yeh hai ki
       <b>emergency change bhi git se hona chahiye</b> (fast-track PR, 2 min). selfHeal
       tumhe bacha raha hai: woh guarantee de raha hai ki cluster ka sach hamesha git
       mein likha hai. Warna 2 hafte baad koi aur deploy karega aur woh "invisible" fix
       gayab ho jayega (Track 3 ka drift war-story!).</div>
       <h3>🙈 ignoreDifferences — jaan-boojh ke alag rakhna</h3>
       <p>Kuch fields cluster mein badalti hi rehti hain — HPA replicas badalta hai,
       webhook injection annotations daalta hai. Unpe drift dikhana bekaar hai:</p>
       <pre>spec:
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
      - /spec/replicas          # HPA ise manage karta hai — ArgoCD chhod de</pre>
       <p>Bina iske: HPA ne 3→8 kiya → ArgoCD "OutOfSync" → selfHeal ne 3 kar diya →
       HPA ne phir 8 kiya → <b>infinite fight</b> 🥊. Yeh classic hai — HPA + GitOps ek
       saath use karte ho toh yeh setting must hai.</p>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Mission: Drift War',
        instructions: 'Kisi ne cluster ko haath laga diya. Ab GitOps ke tarike se handle karo.',
        goal: 'App <b>shop</b> auto-sync par hai. <b>(1)</b> <code>argocd app get shop</code> se status dekho, <b>(2)</b> pata karo drift kya hai (<code>argocd app diff shop</code>), <b>(3)</b> ek resource git se hata diya gaya hai par cluster mein pada hai — usse hatane ke liye <b>prune</b> ke saath sync karo (<code>argocd app sync shop --prune</code>), <b>(4)</b> app Synced hona chahiye.',
        tasks: [
          { text: 'app get se drift dekho', check: s => s.history.some(h => /^argocd app get shop/.test(h)) },
          { text: 'app diff se exact farak', check: s => s.history.some(h => /^argocd app diff shop/.test(h)) },
          { text: '--prune ke saath sync → Synced', check: s => { const a = (s.cluster.apps || []).find(x => x.name === 'shop'); return a && a.sync === 'Synced' && !(a.resources || []).some(r => r.pruneMe && !r.pruned); } },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '80d', version: 'v1.30.2' }],
          pods: [{ name: 'shop-web-7d9f-a', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.31', logs: '[shop] serving' }],
          deployments: [{ name: 'shop-web', ready: '5/5', upToDate: 5, available: 5, age: '6d' }],
          services: [{ name: 'shop-web', type: 'ClusterIP', clusterIP: '10.96.0.55', ports: '80/TCP', age: '6d' },
                     { name: 'shop-debug', type: 'ClusterIP', clusterIP: '10.96.0.99', ports: '9000/TCP', age: '20d' }],
          apps: [
            {
              name: 'shop', project: 'default', repo: 'https://github.com/company/manifests',
              path: 'apps/shop/prod', targetRevision: 'main', destNamespace: 'shop',
              sync: 'OutOfSync', health: 'Healthy', revision: 'd4e5f6a', targetRevisionSha: 'd4e5f6a',
              syncPolicy: { automated: { prune: false, selfHeal: false } },
              resources: [
                { group: 'apps', kind: 'Deployment', name: 'shop-web', status: 'OutOfSync', health: 'Healthy' },
                { group: '', kind: 'Service', name: 'shop-web', status: 'Synced', health: '' },
                { group: '', kind: 'Service', name: 'shop-debug', status: 'OutOfSync', health: '', pruneMe: true },
              ],
              diff: `===== apps/Deployment shop/shop-web ======
  spec:
-   replicas: 5          # ← cluster mein (kisi ne kubectl scale kiya tha)
+   replicas: 3          # ← git mein

===== /Service shop/shop-debug ======
- (poora resource cluster mein hai par GIT SE HAT CHUKA hai)
- kind: Service
- metadata:
-   name: shop-debug

⚠️  yeh resource bina --prune ke NAHI hatega — app hamesha OutOfSync rahega!`,
              history: [{ id: 1, revision: 'c3d4e5f', deployedAt: '2026-08-20T10:00:00Z', note: 'Sync' }],
              onSync: (sim, app) => {
                const d = sim.cluster.deployments.find(x => x.name === 'shop-web');
                if (d) { d.ready = '3/3'; d.upToDate = 3; d.available = 3; }
                const pruned = (app.resources || []).filter(r => r.pruneMe && r.pruned).map(r => r.name);
                sim.cluster.services = sim.cluster.services.filter(s2 => !pruned.includes(s2.name));
                return true;
              },
            },
          ],
        },
        success: s => {
          const a = (s.cluster.apps || []).find(x => x.name === 'shop');
          return a && a.sync === 'Synced' &&
            !(a.resources || []).some(r => r.pruneMe && !r.pruned) &&
            s.history.some(h => /^argocd app diff shop/.test(h));
        },
        successText: 'Drift saaf! 🩹 Do alag-alag drift dekhe: <b>(1)</b> <code>replicas: 5 vs 3</code> — kisi ne <code>kubectl scale</code> kiya tha, normal sync ne theek kar diya. <b>(2)</b> <code>shop-debug</code> Service git se hat chuki thi par cluster mein zinda thi — <b>bina <code>--prune</code> ke woh kabhi nahi hatti</b>, aur app hamesha OutOfSync dikhta rehta. Yeh "app OutOfSync hai par diff mein kuch samajh nahi aa raha" wala classic case hai.',
        hints: [
          'argocd app get shop → resource-wise dekho, shop-debug OutOfSync hai',
          'argocd app diff shop → do problems dikhengi: replicas ka farak, aur ek poora resource jo git se hat gaya',
          'argocd app sync shop --prune  (bina --prune ke shop-debug nahi hatega!)',
        ],
      },
      {
        type: 'render',
        title: '🧩 Git vs Cluster — ArgoCD kya bolega?',
        instructions: 'Left mein git ka manifest, right mein cluster ki asli halat. Batao ArgoCD ka verdict kya hoga.',
        leftHead: '📚 Git (desired)',
        rightHead: '☸️ Cluster (actual)',
        values: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: shop-web\nspec:\n  replicas: 3\n  template:\n    spec:\n      containers:\n      - image: shop/web:2.4.0',
        template: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: shop-web\nspec:\n  replicas: 8        # HPA ne badhaya\n  template:\n    spec:\n      containers:\n      - image: shop/web:2.4.0\n\nstatus:\n  readyReplicas: 8   # sab pods Running',
        questions: [
          {
            q: 'Bina kisi ignoreDifferences ke, ArgoCD ka Sync + Health status kya hoga?',
            choices: [
              'OutOfSync + Healthy — replicas match nahi karte (3 vs 8) par pods sab chal rahe hain',
              'Synced + Healthy — pods toh theek hain',
              'OutOfSync + Degraded — mismatch matlab degraded',
              'Synced + Progressing',
            ],
            answer: 0,
            explain: 'Sync git-comparison hai (3 ≠ 8 → OutOfSync), Health app ki halat (8/8 ready → Healthy). Yehi "OutOfSync + Healthy" ka sabse common real case hai.',
          },
          {
            q: 'Ab <code>selfHeal: true</code> bhi ON kar do. Kya hoga?',
            choices: [
              'ArgoCD replicas 3 kar dega → HPA phir 8 karega → ArgoCD phir 3 → infinite fight 🥊',
              'ArgoCD HPA ko band kar dega',
              'Kuch nahi — selfHeal HPA ko pehchan leta hai',
              'App Degraded ho jayega',
            ],
            answer: 0,
            explain: 'Classic HPA + GitOps ki ladai! Dono controllers apna-apna "desired state" enforce karte hain. Ilaaj: <code>ignoreDifferences</code> mein <code>/spec/replicas</code> daalo — ArgoCD us field ko dekhega hi nahi.',
          },
          {
            q: 'Sahi <code>ignoreDifferences</code> config kaunsi hai?',
            choices: [
              'group: apps, kind: Deployment, jsonPointers: [/spec/replicas]',
              'ignoreDifferences: all',
              'syncPolicy.automated.selfHeal: false',
              'HPA ko delete kar do',
            ],
            answer: 0,
            explain: 'Surgical fix: sirf woh EK field ignore karo jo doosra controller manage karta hai — baaki sab par GitOps ka control bana rahe. selfHeal band karna = poori suraksha khona sirf ek field ke liye.',
          },
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Sync options',
        questions: [
          {
            q: '<code>CreateNamespace=true</code> syncOption kab chahiye?',
            choices: [
              'Jab destination namespace pehle se exist nahi karta — warna sync fail hoga "namespace not found"',
              'Har app ke liye zaroori hai',
              'Sirf multi-cluster mein',
              'Namespace delete karne ke liye',
            ],
            answer: 0,
            explain: 'Naya app + naya namespace = classic first-sync failure. Ya toh Namespace manifest git mein rakho (wave -1 par!), ya yeh syncOption laga do.',
          },
          {
            q: 'Auto-sync ON hai. Rollback karna hai — sahi tarika?',
            choices: [
              'git revert + push (ArgoCD khud sync kar dega) — argocd app rollback auto-sync ke saath kaam nahi karta',
              'argocd app rollback hamesha best hai',
              'kubectl rollout undo',
              'Auto-sync band karke rollback, phir wapas on',
            ],
            answer: 0,
            explain: 'Auto-sync ON matlab git hi boss hai — cluster ko peeche le jaoge toh agla sync usse wapas aage kar dega. <b>Rollback = git revert.</b> (Isliye GitOps mein "rollback" ka matlab hi badal jaata hai.)',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Sync & Drift',
      instructions: 'Yeh round roz ke operations ka hai. 🎤',
      questions: [
        {
          q: '"App hamesha OutOfSync dikha raha hai par diff mein kuch major nahi" — top suspects?',
          choices: [
            '(1) Git se delete hua resource cluster mein pada hai aur prune OFF hai, (2) koi doosra controller (HPA/webhook) field badal raha hai — ignoreDifferences chahiye, (3) mutating webhook annotations inject kar raha hai',
            'ArgoCD ka bug hai, restart karo',
            'Git repo corrupt hai',
            'Cluster ka network slow hai',
          ],
          answer: 0,
          explain: 'Teeno real hain. Prune-wala sabse common aur sabse confusing (diff mein woh dikhta hai par log "extra resource" par dhyan nahi dete). Second wala HPA+GitOps ki classic ladai hai.',
        },
        {
          q: 'selfHeal ON rakhna chahiye production mein? Trade-off?',
          choices: [
            'Haan — woh guarantee deta hai ki cluster ka sach git mein likha hai (drift ka permanent ilaaj). Trade-off: emergency manual fix revert ho jayega, isliye break-glass process bhi git se hona chahiye (fast-track PR)',
            'Nahi — emergency mein dikkat hoti hai',
            'Sirf dev mein rakho',
            'selfHeal ka koi asar nahi padta',
          ],
          answer: 0,
          explain: 'Balanced jawab: benefit (no invisible drift) + cost (emergency process badalna padta hai) + mitigation (fast-track PR). "Process fix, feature band nahi" — yeh maturity dikhata hai.',
        },
        {
          q: '<code>prune: true</code> ka risk kya hai aur kaise manage karte ho?',
          choices: [
            'Galat path/khaali folder git mein push hua toh ArgoCD sab delete kar dega — isliye PR review, path pinning, aur PruneLast/prune-propagation options; critical resources par Prune=false annotation bhi laga sakte ho',
            'Koi risk nahi',
            'Prune sirf Services delete karta hai',
            'Prune se cluster crash ho jaata hai',
          ],
          answer: 0,
          explain: 'Power + danger dono bolo. Real safeguards: review, <code>argocd.argoproj.io/sync-options: Prune=false</code> critical resources par, aur dry-run diff dekhna. "Maine path galat likha aur prod uda diya" wali kahaniyan asli hain.',
        },
      ],
    },
    success: [
      'Main automated/prune/selfHeal teeno switches ka asar bata sakta hoon',
      'Main "hamesha OutOfSync" wale app ko debug kar sakta hoon',
      'Main HPA + GitOps ki ladai ko ignoreDifferences se solve kar sakta hoon',
      'Main jaanta hoon ki auto-sync ke saath rollback = git revert',
    ],
    homework: `<p>Drift aur selfHeal ko apni aankhon se dekho:</p>
      <pre># guestbook app pehle se hai (pichla homework)
argocd app set guestbook --sync-policy automated --self-heal --auto-prune
kubectl scale deploy/guestbook-ui --replicas=5     # drift banao!
kubectl get deploy guestbook-ui -w                 # 30-60 sec dekho...
# → ArgoCD ne wapas 1 kar diya! 🩹 (Ctrl+C)

argocd app get guestbook | head -20                # Sync Policy line padho
# ab ignoreDifferences try karo:
kubectl -n argocd patch app guestbook --type merge -p '{"spec":{"ignoreDifferences":[{"group":"apps","kind":"Deployment","jsonPointers":["/spec/replicas"]}]}}'
kubectl scale deploy/guestbook-ui --replicas=5
argocd app get guestbook                           # ab Synced hi rahega! 🙈</pre>
      <p>✅ Self-check: selfHeal ne replicas wapas kiye? Phir ignoreDifferences ke baad drift dikhna band ho gaya?</p>`,
    cards: [
      { front: 'syncPolicy ke 3 switches?', back: '<b>automated</b> (git badla → khud apply), <b>prune</b> (git se hata → cluster se bhi hatao), <b>selfHeal</b> (manual change → git wala wapas). Teeno alag kaam karte hain — ek on karne se baaki nahi hote.' },
      { front: 'App "hamesha OutOfSync" — #1 chhupa hua reason?', back: 'Koi resource <b>git se delete</b> ho chuka hai par cluster mein zinda hai aur <code>prune</code> OFF hai. Bina <code>--prune</code> ke woh kabhi nahi hatega. (Doosra reason: HPA/webhook field badal raha hai → ignoreDifferences.)' },
      { front: 'HPA + GitOps ki ladai kya hai?', back: 'HPA replicas 3→8 karta hai, ArgoCD selfHeal 8→3 karta hai, infinite fight 🥊. Fix: <code>ignoreDifferences</code> mein <code>/spec/replicas</code> — sirf woh field ignore, baaki sab par GitOps ka control.' },
      { front: 'Auto-sync ON hai — rollback kaise?', back: '<b>git revert + push</b>. <code>argocd app rollback</code> auto-sync ke saath kaam nahi karta (agla sync usse wapas aage kar dega). GitOps mein rollback = git ka operation hai, cluster ka nahi.' },
      { front: 'prune: true ka risk?', back: 'Galat path/khaali folder push hua toh <b>sab delete</b>. Safeguards: PR review, critical resources par <code>Prune=false</code> annotation, aur sync se pehle diff dekhna.' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('argocd', [

  /* ================= LEVEL A3: Sync Waves & Hooks ================= */
  {
    id: 'argowaves',
    icon: '🌊',
    title: 'Sync Waves & Hooks — order ka khel',
    badge: 'Wave Wali',
    objectives: [
      '<code>sync-wave</code> annotation — kaun pehle apply hoga',
      'Hooks: <b>PreSync / Sync / PostSync / SyncFail</b> aur unka delete policy',
      'Agla wave kab shuru hota hai (health-gated!)',
      'Argo hooks vs Helm hooks — confusion khatam',
    ],
    lesson: [
      `<h3>🌊 Waves — apply ka order</h3>
       <p>Default mein ArgoCD sab kuch ek saath apply karta hai (thoda smart ordering ke
       saath: Namespace/CRD pehle). Par aksar tumhe apna order chahiye — DB migration
       pehle, app baad mein.</p>
       <pre>metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"     # chhota number PEHLE (negative bhi chalta hai)</pre>
       <pre>wave -1  →  Namespace, CRDs, PVCs
wave  0  →  ConfigMap, Secret, ServiceAccount   (default agar annotation na ho)
wave  1  →  Deployment, StatefulSet
wave  2  →  Ingress, HPA</pre>
       <p><b>Sabse zaroori rule:</b> agla wave tabhi shuru hota hai jab pichle wave ke
       saare resources <b>Healthy</b> ho jaayein. Yeh sirf "apply order" nahi —
       <b>readiness-gated order</b> hai. Isiliye DB ke StatefulSet ko wave 1 aur app ko
       wave 2 par rakhne se app tabhi aayegi jab DB sach mein ready ho.</p>`,
      `<h3>🪝 Hooks — sync ke beech mein apna kaam</h3>
       <pre>metadata:
  annotations:
    argocd.argoproj.io/hook: PreSync              # kab
    argocd.argoproj.io/hook-delete-policy: HookSucceeded   # safai</pre>
       <table>
         <tr><th>Hook</th><th>Kab chalta hai</th><th>Use</th></tr>
         <tr><td><code>PreSync</code></td><td>Manifests apply hone se PEHLE</td><td>DB migration, backup</td></tr>
         <tr><td><code>Sync</code></td><td>Apply ke saath (waves ke andar)</td><td>Custom ordering</td></tr>
         <tr><td><code>PostSync</code></td><td>Sab Healthy hone ke BAAD</td><td>Smoke test, cache warm, Slack notify</td></tr>
         <tr><td><code>SyncFail</code></td><td>Sync FAIL hone par</td><td>Alert bhejo, cleanup</td></tr>
       </table>
       <p><b>delete-policy:</b> <code>HookSucceeded</code> (pass hua toh safai),
       <code>HookFailed</code>, <code>BeforeHookCreation</code> (purana hook pehle hatao —
       warna "already exists" error). Fail hue Job ko jaan-boojh ke chhodo — logs chahiye!</p>
       <div class="war-story"><b>⚡ Real incident:</b> Team ne DB migration Job ko normal
       manifest ki tarah rakha (koi hook/wave nahi). Deploy hua — <b>app aur migration ek
       saath</b> chale. Naya code purane schema par chala, 4 minute tak 500 errors, phir
       migration complete hui. Har deploy par yahi. Fix: migration Job par
       <code>hook: PreSync</code> — ab app tabhi aati hai jab schema ready ho. <b>Do line
       ka annotation, poora problem khatam.</b></div>`,
      `<h3>🤔 Argo hooks vs Helm hooks — dono alag hain!</h3>
       <table>
         <tr><th></th><th>Helm hook</th><th>Argo hook</th></tr>
         <tr><td>Annotation</td><td><code>helm.sh/hook: pre-install</code></td><td><code>argocd.argoproj.io/hook: PreSync</code></td></tr>
         <tr><td>Kaun chalata</td><td>Helm CLI (install/upgrade par)</td><td>ArgoCD (sync par)</td></tr>
         <tr><td>GitOps mein</td><td>ArgoCD Helm hooks ko <b>Argo hooks ki tarah</b> treat karta hai (mapping)</td><td>Native</td></tr>
       </table>
       <p>Yaad rakho (Helm track ka sabak): ArgoCD <code>helm install</code> chalata hi
       nahi — woh chart <b>render</b> karta hai. Isliye <code>helm list</code> khaali hota
       hai, aur hooks Argo ke rules se chalte hain.</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Sync ka Poora Order',
        instructions: 'Ek app jisme migration hook + waves hain — sync ka sequence sahi lagao.',
        steps: [
          { text: 'PreSync hook: DB migration Job chalta hai (aur SUCCEED hota hai)', explain: 'Sabse pehle — manifests apply hone se bhi pehle. Fail hua toh poora sync wahin ruk jaata hai, app touch bhi nahi hoti.' },
          { text: 'wave -1: Namespace + CRDs apply', explain: 'Negative wave — foundation pehle. CRDs ke bina unke CRs apply hi nahi ho sakte.' },
          { text: 'wave 0: ConfigMap + Secret apply (default wave)', explain: 'Annotation na ho toh sab wave 0 mein aata hai. Config pods se pehle hona chahiye.' },
          { text: 'wave 1: Deployment apply — aur pods HEALTHY hone ka intezaar', explain: 'Yahin asli magic hai: ArgoCD agla wave tab tak nahi chalata jab tak yeh Healthy na ho jaye.' },
          { text: 'wave 2: Ingress + HPA apply', explain: 'Traffic tabhi aayega jab app ready ho. HPA bhi baad mein — warna woh khaali deployment ko scale karta rahega.' },
          { text: 'PostSync hook: smoke test Job chalta hai', explain: 'Sab Healthy hone ke baad — "sach mein kaam kar raha hai?" ka jawab. Fail ho toh alert.' },
        ],
      },
      {
        type: 'fill',
        title: 'Migration Job ko Hook Banao',
        instructions: 'War-story wala fix likho — migration app se pehle chale aur safai bhi ho.',
        template: 'apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: shop-db-migrate\n  annotations:\n    argocd.argoproj.io/{0}: PreSync\n    argocd.argoproj.io/hook-delete-policy: {1}\nspec:\n  template:\n    spec:\n      restartPolicy: {2}\n      containers:\n      - name: migrate\n        image: shop/migrate:2.5.0\n---\n# Deployment par (app baad mein aaye):\nmetadata:\n  annotations:\n    argocd.argoproj.io/{3}: "1"',
        blanks: [
          { answer: 'hook', explain: '<code>argocd.argoproj.io/hook: PreSync</code> — yeh Job ab normal resource nahi, sync ka ek STEP hai. Fail hua toh app deploy hi nahi hogi.' },
          { answer: 'HookSucceeded', explain: 'Pass hone par Job delete — cluster saaf. Fail hone par Job RAHEGA (uske logs chahiye honge!). Aksar iske saath BeforeHookCreation bhi lagate hain.' },
          { answer: 'Never', explain: 'Jobs mein Always ILLEGAL hai. Never = fail toh fail (hook fail → sync ruk jayega, jo humein CHAHIYE). OnFailure retry karega.' },
          { answer: 'sync-wave', explain: '<code>sync-wave: "1"</code> — hooks ke baad, aur wave 0 (ConfigMaps) ke baad. Chhota number pehle.' },
        ],
        tokens: ['hook', 'HookSucceeded', 'Never', 'sync-wave', 'helm.sh/hook', 'HookFailed', 'Always', 'sync-order'],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Wave Atak Gaya',
        instructions: 'Sync beech mein atak gaya hai. Wave ka concept use karke pata karo kahan.',
        goal: 'App <b>shop</b> ka sync fail ho gaya. <b>(1)</b> <code>argocd app get shop</code> se resource-wise status dekho — kaunsa wave atka?, <b>(2)</b> jo resource Degraded hai uske pods ke <code>logs</code> dekho, <b>(3)</b> <code>ls</code> se fix file dekho aur <code>kubectl apply</code> karo, <b>(4)</b> phir se <code>argocd app sync shop</code> — poora Synced + Healthy.',
        tasks: [
          { text: 'app get se atka hua resource dhundo', check: s => s.history.some(h => /^argocd app get shop/.test(h)) },
          { text: 'logs se root cause', check: s => s.history.some(h => /kubectl logs (shop-db|shop-web)/.test(h)) },
          { text: 'Fix + sync → Synced + Healthy', check: s => { const a = (s.cluster.apps || []).find(x => x.name === 'shop'); return a && a.sync === 'Synced' && a.health === 'Healthy'; } },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '15d', version: 'v1.30.2' }],
          pods: [
            { name: 'shop-db-0', ready: '0/1', status: 'CrashLoopBackOff', restarts: 6, age: '4m', node: 'node-1', ip: '10.244.1.40',
              logs: '[postgres] FATAL: could not create directory "/var/lib/postgresql/data": Permission denied\n[postgres] initdb failed — fsGroup set nahi hai!',
              prevLogs: '[postgres] FATAL: could not create directory: Permission denied' },
          ],
          deployments: [], statefulsets: [{ name: 'shop-db', ready: '0/1', age: '4m' }],
          services: [{ name: 'shop-db', type: 'ClusterIP', clusterIP: 'None', ports: '5432/TCP', age: '4m' }],
          apps: [
            {
              name: 'shop', project: 'default', repo: 'https://github.com/company/manifests',
              path: 'apps/shop/prod', targetRevision: 'main', destNamespace: 'shop',
              sync: 'OutOfSync', health: 'Degraded', revision: 'e5f6a7b', targetRevisionSha: 'e5f6a7b',
              degradedReason: 'wave 1 atka hua hai',
              resources: [
                { group: '', kind: 'Namespace', name: 'shop', status: 'Synced', health: '', wave: -1 },
                { group: '', kind: 'ConfigMap', name: 'shop-config', status: 'Synced', health: '', wave: 0 },
                { group: 'apps', kind: 'StatefulSet', name: 'shop-db', status: 'Synced', health: 'Degraded', wave: 1 },
                { group: 'apps', kind: 'Deployment', name: 'shop-web', status: 'OutOfSync', health: 'Missing', wave: 2 },
                { group: 'networking.k8s.io', kind: 'Ingress', name: 'shop', status: 'OutOfSync', health: 'Missing', wave: 3 },
              ],
              diff: `===== apps/Deployment shop/shop-web ======
+ (poora resource — abhi apply hua hi nahi!)

⚠️  wave 2 aur 3 ke resources abhi apply NAHI hue —
    kyunki wave 1 (shop-db StatefulSet) Healthy nahi hua.
    ArgoCD agla wave tabhi chalata hai jab pichla wave HEALTHY ho.`,
              history: [],
              onSync: (sim, app) => {
                const db = sim.cluster.pods.find(p => p.name.startsWith('shop-db'));
                if (!db || db.status !== 'Running') {
                  app.syncError = 'wave 1 resource "shop-db" is Degraded — waiting for healthy state (timed out)';
                  return false;              // wave 1 healthy nahi → sync fail
                }
                sim.cluster.deployments.push({ name: 'shop-web', ready: '2/2', upToDate: 2, available: 2, age: '3s' });
                sim.cluster.pods.push({ name: 'shop-web-8a7b-x', ready: '1/1', status: 'Running', restarts: 0, age: '3s', node: 'node-1', ip: '10.244.1.45', logs: '[shop] connected to shop-db ✓' });
                sim.cluster.ingresses = [{ name: 'shop', class: 'nginx', hosts: 'shop.com', address: '10.0.0.9', ports: '80,443', age: '2s' }];
                app.resources.forEach(r => { r.health = r.kind === 'Service' ? '' : 'Healthy'; });
                app.degradedReason = null;
                app.health = 'Healthy';
                return true;
              },
            },
          ],
        },
        files: {
          'fix-db-fsgroup.yaml': {
            desc: 'shop-db StatefulSet mein securityContext.fsGroup: 999 add karta hai',
            apply: s => {
              const db = s.cluster.pods.find(p => p.name.startsWith('shop-db'));
              db.status = 'Running'; db.ready = '1/1';
              db.logs = '[postgres] database system is ready to accept connections ✓';
              const sts = s.cluster.statefulsets.find(x => x.name === 'shop-db');
              if (sts) sts.ready = '1/1';
              const app = s.cluster.apps[0];
              const r = app.resources.find(x => x.name === 'shop-db');
              if (r) r.health = 'Healthy';
              return 'statefulset.apps/shop-db configured (fsGroup: 999)\n(pod restart hua... postgres ab data dir likh paa raha hai... Running ✓)\n\n⚠️  Yaad rakho: asli GitOps mein yeh fix GIT mein jaana chahiye — warna agla sync ise mita dega!';
            },
          },
          'skip-waves.yaml': {
            desc: 'Saare sync-wave annotations hata deta hai (jugaad)',
            apply: () => 'annotations removed...\n\n(Ab sab ek saath apply hoga — shop-web bhi aa jayega. Par woh DB se connect nahi kar payega (DB abhi bhi CrashLoop mein hai) → CrashLoopBackOff.\nWaves problem NAHI thi — waves ne to tumhe BACHAYA: unhone aadhi-adhuri app deploy hone se roka! Asli problem DB ka fsGroup hai.)',
          },
        },
        success: s => { const a = (s.cluster.apps || []).find(x => x.name === 'shop'); return a && a.sync === 'Synced' && a.health === 'Healthy' && s.history.some(h => /^argocd app get shop/.test(h)); },
        successText: 'Wave chal padi! 🌊 Sabse bada sabak: <b>waves ne tumhe bachaya</b> — DB (wave 1) Healthy nahi tha, isliye ArgoCD ne app (wave 2) aur Ingress (wave 3) apply hi nahi kiye. Bina waves ke: app deploy ho jaati, DB se connect na kar paati, aur users ko 500 milte. <code>app get</code> ka resource-wise view hi batata hai kaunsa wave atka hai — yahi GitOps debugging ka pehla step hai.',
        hints: [
          'argocd app get shop → StatefulSet shop-db "Degraded" hai, aur uske baad wale resources "Missing"',
          'kubectl logs shop-db-0 → "Permission denied" — postgres data dir nahi likh paa raha (fsGroup missing)',
          'ls → kubectl apply -f fix-db-fsgroup.yaml → phir argocd app sync shop',
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Waves & Hooks',
      instructions: 'Ordering ke sawal — production deploy design ka test. 🎤',
      questions: [
        {
          q: '"DB migration app se pehle chalni chahiye — GitOps mein kaise karoge?"',
          choices: [
            'Migration Job par argocd.argoproj.io/hook: PreSync (+ hook-delete-policy) — woh manifests apply hone se PEHLE chalega aur fail hone par poora sync ruk jayega; ya sync-wave se ordering (DB wave 1, app wave 2)',
            'Deployment mein initContainer se',
            'Manually migration chala ke phir deploy karo',
            'CI pipeline mein kubectl se',
          ],
          answer: 0,
          explain: 'Hook + fail-behaviour dono bolo: "fail hua toh app deploy hi nahi hogi" — yeh safety hi asli value hai. War-story (app aur migration saath chale, 4 min ke 500s) sunao toh aur strong.',
        },
        {
          q: 'Sync waves ka sabse important rule kya hai?',
          choices: [
            'Agla wave tabhi shuru hota hai jab pichle wave ke resources HEALTHY ho jaayein — yeh sirf apply-order nahi, readiness-gated order hai',
            'Waves random order mein chalte hain',
            'Sabse bada number pehle chalta hai',
            'Waves sirf Helm charts mein kaam karte hain',
          ],
          answer: 0,
          explain: 'Health-gating hi waves ko powerful banati hai. Isliye "DB wave 1, app wave 2" ka matlab hai app tabhi aayegi jab DB SACH MEIN ready ho — sirf "apply ho gaya" nahi.',
        },
        {
          q: 'Helm chart ArgoCD se deploy kar rahe ho — uske helm.sh/hook annotations ka kya hoga?',
          choices: [
            'ArgoCD unhe apne hooks ki tarah treat karta hai (mapping) — kyunki ArgoCD helm install nahi chalata, sirf chart RENDER karta hai aur apply karta hai',
            'Woh bilkul kaam nahi karenge',
            'Helm CLI unhe alag se chalata hai',
            'Chart install fail ho jayega',
          ],
          answer: 0,
          explain: 'Helm track ka connection: ArgoCD = template engine user, release manager nahi (<code>helm list</code> khaali!). Isliye hooks bhi Argo ke rules se chalte hain. Yeh detail bahut kam log jaante hain.',
        },
      ],
    },
    success: [
      'Main sync-wave se apply ka order control kar sakta hoon',
      'Main PreSync/PostSync hooks aur delete policies use kar sakta hoon',
      'Main "wave atka hai" wale sync failure ko debug kar sakta hoon',
      'Main Argo hooks vs Helm hooks ka farak jaanta hoon',
    ],
    homework: `<p>Waves ka asar khud dekho:</p>
      <pre># ek app banao jisme do resources alag waves mein hon
mkdir -p ~/wavelab && cd ~/wavelab
cat > cm.yaml <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: wave-demo
  annotations: { argocd.argoproj.io/sync-wave: "-1" }
data: { hello: "world" }
EOF
cat > job.yaml <<'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: presync-demo
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
spec:
  template:
    spec:
      restartPolicy: Never
      containers: [{ name: c, image: busybox, command: ["sh","-c","echo PRE-SYNC chal raha hai; sleep 10"] }]
EOF
# in files ko apne git repo mein push karo, phir:
argocd app sync <app> && kubectl get jobs -w    # PreSync Job pehle chalte dekho!</pre>
      <p>✅ Self-check: UI ke resource tree mein hook alag section mein dikha? Job manifests se PEHLE chala?</p>`,
    cards: [
      { front: 'sync-wave ka sabse important rule?', back: 'Chhota number pehle (negative bhi) — <b>par asli baat</b>: agla wave tabhi shuru hota hai jab pichle wave ke resources <b>Healthy</b> ho jaayein. Readiness-gated order, sirf apply-order nahi.' },
      { front: 'ArgoCD hooks ke 4 types?', back: '<b>PreSync</b> (manifests se pehle — DB migration), <b>Sync</b> (saath mein), <b>PostSync</b> (sab Healthy hone ke baad — smoke test), <b>SyncFail</b> (fail par alert/cleanup). Annotation: <code>argocd.argoproj.io/hook</code>.' },
      { front: 'hook-delete-policy kyun chahiye?', back: '<code>BeforeHookCreation</code> = purana hook Job hatao (warna "already exists"), <code>HookSucceeded</code> = pass hone par safai. <b>Fail hue Job ko chhodo</b> — uske logs chahiye honge!' },
      { front: 'Helm hooks ArgoCD mein kaise chalte hain?', back: 'ArgoCD unhe apne hooks ki tarah <b>map</b> karta hai — kyunki woh <code>helm install</code> nahi chalata, chart <b>render</b> karke apply karta hai (isliye <code>helm list</code> khaali hota hai).' },
    ],
  },

  /* ================= LEVEL A4: App-of-Apps & ApplicationSets ================= */
  {
    id: 'argoscale',
    icon: '🏭',
    title: 'App-of-Apps & ApplicationSets — scale par',
    badge: 'Fleet Nayak',
    objectives: [
      '<b>App-of-Apps</b> — ek root app se poora platform bootstrap',
      '<b>ApplicationSet</b> + generators (list / git / cluster / matrix)',
      '<b>AppProject</b> se RBAC aur guard-rails',
      'Multi-cluster / multi-env management ka pattern',
    ],
    lesson: [
      `<h3>☂️ App-of-Apps — bootstrap ka pattern</h3>
       <p>Problem: 30 apps hain. Naya cluster banaya — 30 baar <code>argocd app create</code>?
       Aur disaster recovery mein? 🙈</p>
       <p>Solution: ek <b>root Application</b> jiska git folder mein baaki Applications ke
       YAML hain:</p>
       <pre>git repo:
  apps/
    ├── shop.yaml          # kind: Application
    ├── payments.yaml      # kind: Application
    └── monitoring.yaml    # kind: Application

# root app (ek baar apply):
kind: Application
metadata: { name: root }
spec:
  source: { repoURL: ..., path: apps }    # yeh folder Applications se bhara hai
  syncPolicy: { automated: { prune: true, selfHeal: true } }</pre>
       <p>Ab <b>naya cluster = ek command</b>: root app apply karo, baaki sab khud aa jaayega.
       Yeh DR ka bhi jawab hai (Track 3 ka GitOps level yaad hai?).</p>`,
      `<h3>🏭 ApplicationSet — Applications ki factory</h3>
       <p>App-of-Apps mein bhi har app ki YAML <b>haath se</b> likhni padti hai. 3 env × 10
       services = 30 files, 90% same. ApplicationSet ek <b>template + generator</b> se
       Applications KHUD banata hai:</p>
       <pre>kind: ApplicationSet
spec:
  generators:
  - list:                                  # sabse simple generator
      elements:
      - env: dev
        cluster: https://dev.example.com
      - env: prod
        cluster: https://prod.example.com
  template:
    metadata: { name: 'shop-{{env}}' }     # → shop-dev, shop-prod
    spec:
      source:
        repoURL: https://github.com/company/manifests
        path: 'apps/shop/{{env}}'
      destination: { server: '{{cluster}}', namespace: 'shop' }</pre>
       <table>
         <tr><th>Generator</th><th>Kya karta hai</th></tr>
         <tr><td><code>list</code></td><td>Haath se di hui list (env/cluster) — simple aur explicit</td></tr>
         <tr><td><code>git</code> (directories)</td><td>Repo ke har folder ke liye ek app — <b>naya folder = naya app, apne aap</b></td></tr>
         <tr><td><code>cluster</code></td><td>ArgoCD ke har registered cluster par app — naya cluster jodo, app khud pahunch jaayega</td></tr>
         <tr><td><code>matrix</code></td><td>Do generators ka cross-product — 3 clusters × 10 services = 30 apps</td></tr>
       </table>
       <p>⚠️ <b>Golden rule:</b> generated Applications ko manually <b>mat</b> chhedo —
       ApplicationSet controller unhe wapas apne template jaisa bana dega. Badalna hai toh
       <b>generator ya template</b> badlo.</p>`,
      `<h3>🛡️ AppProject — guard-rails</h3>
       <p>Default project mein <b>sab kuch allowed</b> hai — koi bhi repo, koi bhi cluster,
       koi bhi kind. Production mein yeh khatra hai:</p>
       <pre>kind: AppProject
metadata: { name: team-shop }
spec:
  sourceRepos:
    - 'https://github.com/company/shop-*'     # sirf apne repos
  destinations:
    - server: https://kubernetes.default.svc
      namespace: 'shop-*'                     # sirf apne namespaces
  clusterResourceWhitelist: []                # cluster-scoped kuch nahi bana sakte!
  namespaceResourceBlacklist:
    - group: '', kind: ResourceQuota          # quota se ched-chaad nahi</pre>
       <div class="war-story"><b>⚡ Real incident:</b> Ek team ne apni Application ka
       <code>destination.namespace</code> galti se <code>kube-system</code> likh diya
       (copy-paste). Auto-sync ne wahan resources bana diye — cluster-level services ke
       saath naam clash hua. Agar AppProject mein namespace restriction hoti, ArgoCD
       usse <b>reject</b> kar deta: <i>"application destination is not permitted in
       project"</i>. <b>Projects boring lagte hain — jab tak koi prod namespace mein
       ghus na jaaye.</b></div>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Kaunsa Pattern Use Karoge?',
        instructions: 'Har situation ke liye sahi tool chuno.',
        bins: [
          { id: 'aoa', label: '☂️ App-of-Apps' },
          { id: 'appset', label: '🏭 ApplicationSet' },
          { id: 'proj', label: '🛡️ AppProject' },
        ],
        items: [
          { text: 'Naya cluster — poora platform ek command se bootstrap', bin: 'aoa', explain: 'Root app apply karo, baaki 30 apps khud aa jaayengi. DR ka bhi jawab.' },
          { text: 'Ek hi service, 3 environments (dev/stg/prod) mein', bin: 'appset', explain: 'list ya git generator + template — 3 apps auto-generate. Ek jagah change, teeno par lagega.' },
          { text: 'Team A sirf apne repos aur apne namespaces mein deploy kar paaye', bin: 'proj', explain: 'AppProject se sourceRepos + destinations restrict karo. Multi-team cluster mein must.' },
          { text: '20 clusters par monitoring agent deploy karna hai', bin: 'appset', explain: 'cluster generator — har registered cluster ke liye ek app. Naya cluster jodo, agent khud pahunch jaayega.' },
          { text: 'Repo mein naya service folder banao → app apne aap ban jaaye', bin: 'appset', explain: 'git directories generator — folder hi source of truth. Developer folder banata hai, app khud aa jaati hai.' },
          { text: 'Kisi app ko kube-system mein deploy karne se rokna', bin: 'proj', explain: 'War-story wala fix — destinations whitelist. ArgoCD "not permitted in project" se reject karega.' },
        ],
      },
      {
        type: 'fill',
        title: 'ApplicationSet Likho',
        instructions: 'Ek service, teen environments — matrix ke bina, simple list generator se.',
        template: 'apiVersion: argoproj.io/v1alpha1\nkind: {0}\nmetadata:\n  name: shop-all-envs\n  namespace: argocd\nspec:\n  generators:\n  - {1}:\n      elements:\n      - env: dev\n      - env: staging\n      - env: prod\n  template:\n    metadata:\n      name: shop-{{2}}\n    spec:\n      project: team-shop\n      source:\n        repoURL: https://github.com/company/manifests\n        path: apps/shop/{{env}}\n      destination:\n        server: https://kubernetes.default.svc\n        namespace: shop-{{env}}\n      syncPolicy:\n        {3}:\n          prune: true\n          selfHeal: true',
        blanks: [
          { answer: 'ApplicationSet', explain: 'Yeh khud ek controller hai jo Applications BANATA hai — Application se ek level upar.' },
          { answer: 'list', explain: 'Sabse simple generator: explicit list. (git/cluster/matrix advanced hain — par list se shuru karna best hai, debug aasan.)' },
          { answer: '{env}', explain: 'Template variable — <code>{{env}}</code> har element ke liye replace hoga: shop-dev, shop-staging, shop-prod.' },
          { answer: 'automated', explain: 'Generated apps ko bhi auto-sync mil jayega — ek jagah likho, teeno par lagega. Yehi ApplicationSet ka fayda hai.' },
        ],
        tokens: ['ApplicationSet', 'list', '{env}', 'automated', 'Application', 'matrix', '{name}', 'manual'],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Fleet Inspector',
        instructions: 'Ek platform inherit kiya hai. Samjho yeh chal kaise raha hai.',
        goal: 'Naye cluster ka structure samjho: <b>(1)</b> <code>argocd app list</code> — kitne apps hain?, <b>(2)</b> <code>argocd appset list</code> aur <code>argocd appset get shop-envs</code> — kaunse apps auto-generated hain?, <b>(3)</b> <code>argocd proj list</code> — guard-rails kya hain?, <b>(4)</b> ek app <b>OutOfSync</b> hai — usse dhundo aur sync karo.',
        tasks: [
          { text: 'app list — poora fleet dekho', check: s => s.history.some(h => /^argocd app list/.test(h)) },
          { text: 'appset get — auto-generated apps', check: s => s.history.some(h => /^argocd appset (get|list)/.test(h)) },
          { text: 'proj list — guard-rails', check: s => s.history.some(h => /^argocd proj/.test(h)) },
          { text: 'OutOfSync app ko sync karo', check: s => (s.cluster.apps || []).every(a => a.sync === 'Synced') },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '100d', version: 'v1.30.2' }],
          pods: [], deployments: [], services: [],
          appsets: [
            { name: 'shop-envs', generator: 'list (dev, staging, prod)', project: 'team-shop', produces: ['shop-dev', 'shop-staging', 'shop-prod'] },
          ],
          projects: [
            { name: 'team-shop', description: 'Shop team ka project', sourceRepos: ['https://github.com/company/shop-*'], destinations: ['in-cluster/shop-*'], allowedKinds: ['(none — cluster-scoped resources banned)'] },
            { name: 'platform', description: 'Platform team (monitoring, ingress)', sourceRepos: ['*'], destinations: ['*'], allowedKinds: ['*'] },
          ],
          argoClusters: [
            { server: 'https://kubernetes.default.svc', name: 'in-cluster', version: '1.30', status: 'Successful' },
          ],
          apps: [
            { name: 'root', project: 'platform', path: 'apps', sync: 'Synced', health: 'Healthy', revision: 'aa11bb2', destNamespace: 'argocd',
              resources: [{ group: 'argoproj.io', kind: 'Application', name: 'monitoring', status: 'Synced', health: 'Healthy' },
                          { group: 'argoproj.io', kind: 'ApplicationSet', name: 'shop-envs', status: 'Synced', health: 'Healthy' }] },
            { name: 'monitoring', project: 'platform', path: 'infra/monitoring', sync: 'Synced', health: 'Healthy', revision: 'aa11bb2', destNamespace: 'monitoring', resources: [] },
            { name: 'shop-dev', project: 'team-shop', path: 'apps/shop/dev', sync: 'Synced', health: 'Healthy', revision: 'aa11bb2', destNamespace: 'shop-dev', resources: [] },
            { name: 'shop-staging', project: 'team-shop', path: 'apps/shop/staging', sync: 'Synced', health: 'Healthy', revision: 'aa11bb2', destNamespace: 'shop-staging', resources: [] },
            {
              name: 'shop-prod', project: 'team-shop', path: 'apps/shop/prod', sync: 'OutOfSync', health: 'Healthy',
              revision: 'aa11bb2', targetRevisionSha: 'cc33dd4', destNamespace: 'shop-prod',
              resources: [{ group: 'apps', kind: 'Deployment', name: 'shop-web', status: 'OutOfSync', health: 'Healthy' }],
              diff: `===== apps/Deployment shop-prod/shop-web ======
  spec:
    template:
      spec:
        containers:
-       - image: shop/web:2.4.0      # cluster mein
+       - image: shop/web:2.5.0      # git mein (naya release)

(dev aur staging pehle se 2.5.0 par hain — prod peeche reh gaya)`,
              history: [{ id: 1, revision: 'aa11bb2', deployedAt: '2026-08-25T09:00:00Z', note: 'Sync' }],
              onSync: () => true,
            },
          ],
        },
        success: s => (s.cluster.apps || []).every(a => a.sync === 'Synced') &&
          s.history.some(h => /^argocd appset (get|list)/.test(h)) &&
          s.history.some(h => /^argocd proj/.test(h)),
        successText: 'Fleet samajh aa gaya! 🏭 Structure dekha: <b>root</b> app (App-of-Apps) ne <code>monitoring</code> aur <code>shop-envs</code> ApplicationSet ko manage kiya; ApplicationSet ne teen env apps (dev/staging/prod) <b>auto-generate</b> ki; aur <b>AppProject</b> <code>team-shop</code> ne unhe sirf apne repos + <code>shop-*</code> namespaces tak seemit rakha. Prod peeche reh gaya tha (2.4.0 vs 2.5.0) — sync se aage aa gaya. <b>Yeh exact structure asli companies mein chalta hai.</b>',
        hints: [
          'argocd app list → 5 apps dikhengi, ek OutOfSync hai',
          'argocd appset list, phir argocd appset get shop-envs → dekho kaunsi 3 apps auto-generated hain',
          'argocd proj list (aur proj get team-shop) → phir: argocd app sync shop-prod',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Fleet ke jaal',
        questions: [
          {
            q: 'Kisi ne ApplicationSet se generated app <code>shop-dev</code> ko manually edit kar diya. Kya hoga?',
            choices: [
              'ApplicationSet controller usse wapas template jaisa bana dega — generated apps manually edit karna bekaar hai, generator/template badlo',
              'Change permanent rahega',
              'ApplicationSet crash ho jayega',
              'Sirf warning aayegi',
            ],
            answer: 0,
            explain: 'ApplicationSet bhi ek reconciliation controller hai — uska desired state template hai. Yeh "GitOps ke upar GitOps" hai. Naye log yahin phasate hain.',
          },
          {
            q: 'App-of-Apps aur ApplicationSet mein se kaunsa "naya folder banao → app khud ban jaaye" deta hai?',
            choices: [
              'ApplicationSet with git directories generator — folder discovery automatic hai; App-of-Apps mein har Application YAML haath se likhni padti hai',
              'App-of-Apps',
              'Dono barabar',
              'Koi nahi — hamesha manual',
            ],
            answer: 0,
            explain: 'Yeh farak interview mein poocha jaata hai. App-of-Apps = manual list (par simple, explicit). ApplicationSet = dynamic generation (powerful, par debug karna thoda mushkil).',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Scale & Governance',
      instructions: 'Platform-engineer level ke sawal. 🎤',
      questions: [
        {
          q: '"50 microservices × 3 environments — ArgoCD kaise organize karoge?"',
          choices: [
            'ApplicationSet (git ya matrix generator) se apps auto-generate; ek root App-of-Apps se bootstrap; per-team AppProjects se repo/namespace guard-rails; values/overlays git mein per-env',
            'Har app manually argocd app create se',
            'Ek hi Application mein sab kuch',
            '150 alag ArgoCD instances',
          ],
          answer: 0,
          explain: 'Teen layers bolo: bootstrap (App-of-Apps) → generation (ApplicationSet) → governance (AppProject). Aur mention karo ki config per-env git mein rehti hai (Helm values/Kustomize overlays) — poora system connect ho jaata hai.',
        },
        {
          q: 'AppProject ka asli fayda kya hai?',
          choices: [
            'Guard-rails: kaunse repos se deploy ho sakta hai, kaunse cluster/namespaces mein, kaunse resource kinds allowed hain — multi-team cluster mein galti se prod/kube-system mein deploy hone se bachata hai',
            'Apps ko folder mein organize karta hai (sirf cosmetic)',
            'Performance badhata hai',
            'Sirf UI mein grouping ke liye',
          ],
          answer: 0,
          explain: 'War-story sunao (kube-system wala copy-paste). "default project sab kuch allow karta hai" — yeh line bolne se pata chalta hai ki tumne security ke chashme se dekha hai.',
        },
        {
          q: 'Disaster recovery: poora cluster udd gaya. GitOps mein recovery kya hai?',
          choices: [
            'Naya cluster + ArgoCD install + root Application apply → poora platform (saare apps, ApplicationSets, configs) git se apne aap wapas aa jaata hai',
            'Backup se restore karo (Velero)',
            'Har app manually redeploy karo',
            'Recovery possible nahi',
          ],
          answer: 0,
          explain: 'Yeh App-of-Apps ki killer feature hai. (Nuance bhi bolo: <b>stateful data</b> phir bhi backup/Velero se aayega — GitOps config recover karta hai, data nahi. Yeh distinction senior-level hai.)',
        },
      ],
    },
    success: [
      'Main App-of-Apps se poora platform bootstrap kar sakta hoon',
      'Main ApplicationSet + generators se apps auto-generate kar sakta hoon',
      'Main AppProject se team guard-rails laga sakta hoon',
      'Main GitOps-based DR ka flow explain kar sakta hoon',
    ],
    homework: `<p>ApplicationSet khud banao — magic dekho:</p>
      <pre>kubectl apply -n argocd -f - <<'EOF'
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: { name: guestbook-envs }
spec:
  generators:
  - list:
      elements:
      - env: dev
      - env: staging
  template:
    metadata: { name: 'guestbook-{{env}}' }
    spec:
      project: default
      source:
        repoURL: https://github.com/argoproj/argocd-example-apps.git
        path: guestbook
        targetRevision: HEAD
      destination:
        server: https://kubernetes.default.svc
        namespace: 'gb-{{env}}'
      syncPolicy:
        automated: {}
        syncOptions: [CreateNamespace=true]
EOF
argocd app list                    # guestbook-dev aur guestbook-staging KHUD ban gaye! 🏭
kubectl -n argocd get applicationset
# ab ek generated app delete karke dekho:
argocd app delete guestbook-dev --yes
argocd app list                    # thodi der mein WAPAS aa jayega (controller ne banaya!)
kubectl -n argocd delete applicationset guestbook-envs</pre>
      <p>✅ Self-check: delete kiya app khud wapas aa gaya? Yehi "GitOps ke upar GitOps" hai.</p>`,
    cards: [
      { front: 'App-of-Apps pattern kya hai?', back: 'Ek <b>root Application</b> jiska git path baaki Applications ke YAMLs se bhara hai. Naya cluster = root apply karo, poora platform aa jaata hai. <b>DR ka jawab</b> (par stateful data phir bhi backup se!).' },
      { front: 'ApplicationSet vs App-of-Apps?', back: '<b>App-of-Apps</b>: har Application YAML haath se (simple, explicit). <b>ApplicationSet</b>: template + generator (list/git/cluster/matrix) se apps <b>auto-generate</b> — naya folder/cluster = naya app apne aap.' },
      { front: 'Generated app ko manually edit kiya — kya hoga?', back: 'ApplicationSet controller usse <b>wapas template jaisa</b> bana dega (woh bhi reconciliation loop hai!). Badalna hai toh <b>generator ya template</b> badlo — "GitOps ke upar GitOps".' },
      { front: 'AppProject kis liye?', back: '<b>Guard-rails</b>: sourceRepos (kaunse repos), destinations (kaunse cluster/namespaces), allowed resource kinds. Default project sab allow karta hai — multi-team cluster mein per-team project banao.' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('argocd', [

  /* ================= LEVEL A5: Argo Rollouts ================= */
  {
    id: 'argorollouts',
    icon: '🐤',
    title: 'Argo Rollouts — Canary aur Blue-Green',
    badge: 'Canary Kaptaan',
    objectives: [
      '<b>Rollout</b> resource — Deployment se kya alag hai',
      'Canary steps: <code>setWeight</code> + <code>pause</code>, aur manual promote',
      '<b>AnalysisTemplate</b> — Prometheus metrics se auto-promote / auto-rollback',
      'Blue-Green: activeService vs previewService',
    ],
    lesson: [
      `<h3>🐤 Deployment vs Rollout — asli farak</h3>
       <table>
         <tr><th></th><th>Deployment (rolling update)</th><th>Rollout (canary)</th></tr>
         <tr><td>Kya control karta</td><td><b>Pods</b> — purane hatao, naye lao</td><td><b>Traffic</b> — kitne % users naye version par</td></tr>
         <tr><td>Blast radius</td><td>Aakhir mein 100% users</td><td>Jitna weight set kiya (5%, 10%...)</td></tr>
         <tr><td>Rollback</td><td>Purana ReplicaSet wapas scale up (~30s)</td><td>Weight 0 — <b>turant</b>, koi pod surgery nahi</td></tr>
         <tr><td>Faisla</td><td>Insaan dekhta hai dashboards</td><td><b>AnalysisRun</b> khud metrics dekhkar decide karta hai</td></tr>
       </table>
       <pre>apiVersion: argoproj.io/v1alpha1
kind: Rollout                     # Deployment ki jagah — baaki spec same!
metadata: { name: shop-web }
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10             # 10% traffic v2 par
      - pause: { duration: 5m }   # 5 min dekho
      - setWeight: 50
      - pause: {}                 # {} = ANANT pause — manual promote ka intezaar
      - setWeight: 100</pre>
       <p><code>pause: {}</code> (bina duration) = rollout wahin ruk jaayega jab tak koi
       <code>kubectl argo rollouts promote shop-web</code> na kare. Yeh "human gate" hai —
       risky releases mein bahut kaam ka.</p>`,
      `<h3>📊 AnalysisTemplate — robot decide karega</h3>
       <pre>kind: AnalysisTemplate
metadata: { name: success-rate }
spec:
  metrics:
  - name: success-rate
    interval: 1m
    successCondition: result[0] >= 0.95     # 95% se kam? FAIL
    failureLimit: 2                          # 2 baar fail → abort
    provider:
      prometheus:
        address: http://prometheus.monitoring:9090
        query: |
          sum(rate(http_requests_total{app="shop",code!~"5.."}[2m]))
          / sum(rate(http_requests_total{app="shop"}[2m]))

# Rollout mein jodo:
    canary:
      analysis:
        templates: [{ templateName: success-rate }]
        startingStep: 1                       # pehle setWeight ke baad se</pre>
       <p>Ab har step par AnalysisRun chalta hai. Success rate gira? <b>Rollout khud abort
       ho jaayega</b> — traffic 100% stable par wapas, aadhi raat ko kisi ko uthaye bina.
       Yehi <b>progressive delivery</b> hai.</p>
       <div class="war-story"><b>⚡ Real incident (jo NAHI hua):</b> Payment service ka v2
       deploy hua — canary 5% par. Ek edge case bug tha jo sirf international cards par
       aata tha. AnalysisRun ne error rate 0.2% → 4.1% dekha, 2 minute mein
       <b>auto-abort</b>. Impact: 5% users, 2 minute. Bina Rollouts ke: 100% users, jab tak
       koi dashboard na dekhta. <b>Canary ki keemat = ek extra ReplicaSet; bachaav =
       poora outage.</b></div>`,
      `<h3>🔵🟢 Blue-Green — instant switch</h3>
       <pre>  strategy:
    blueGreen:
      activeService: shop-web-active      # asli users yahan
      previewService: shop-web-preview    # QA/tests yahan
      autoPromotionEnabled: false         # manual switch
      prePromotionAnalysis: { templates: [{ templateName: smoke-test }] }</pre>
       <p>Dono versions poore chalte hain; switch ek Service selector badalne jitna
       instant hai. <b>Canary vs Blue-Green:</b> canary sasta hai (thode extra pods) par
       dheere; blue-green mein double resources lagte hain par switch/rollback instant.</p>
       <p>⌨️ Roz ke commands:</p>
       <pre>kubectl argo rollouts get rollout shop-web --watch   # live dashboard!
kubectl argo rollouts promote shop-web              # agla step
kubectl argo rollouts promote shop-web --full       # saare steps skip (emergency)
kubectl argo rollouts abort shop-web                # turant stable par wapas</pre>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Mission: Canary Night',
        instructions: 'v2 canary par hai. Metrics dekho aur sahi faisla lo.',
        goal: 'Rollout <b>shop-web</b> canary mein hai. <b>(1)</b> <code>kubectl argo rollouts get rollout shop-web</code> se status dekho, <b>(2)</b> canary pods ke logs check karo, <b>(3)</b> analysis kya keh raha hai dekho — aur us hisaab se <b>promote</b> ya <b>abort</b> karo. (Soch samajh ke — users daav par hain!)',
        tasks: [
          { text: 'rollout ka status dekho', check: s => s.history.some(h => /argo rollouts get/.test(h)) },
          { text: 'canary pod ke logs padho', check: s => s.history.some(h => /kubectl logs shop-web-canary/.test(h)) },
          { text: 'Sahi faisla lo (abort — metrics kharab hain!)', check: s => { const r = (s.cluster.rollouts || [])[0]; return r && r.aborted; } },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '50d', version: 'v1.30.2' }],
          pods: [
            { name: 'shop-web-stable-a', ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: 'node-1', ip: '10.244.1.50', logs: '[shop 2.4.0] 200 OK · error rate 0.18%' },
            { name: 'shop-web-stable-b', ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: 'node-1', ip: '10.244.1.51', logs: '[shop 2.4.0] 200 OK · error rate 0.20%' },
            { name: 'shop-web-canary-x', ready: '1/1', status: 'Running', restarts: 0, age: '4m', node: 'node-1', ip: '10.244.1.60',
              logs: '[shop 2.5.0] 200 OK\n[shop 2.5.0] 500 ERROR: currency conversion failed for card_country=SG\n[shop 2.5.0] 500 ERROR: currency conversion failed for card_country=AE\n[shop 2.5.0] 200 OK\n[shop 2.5.0] 500 ERROR: currency conversion failed for card_country=SG\n→ error rate is pod par: 4.1% (stable: 0.2%)' },
          ],
          deployments: [], services: [
            { name: 'shop-web', type: 'ClusterIP', clusterIP: '10.96.0.70', ports: '80/TCP', age: '9d' },
          ],
          rollouts: [
            {
              name: 'shop-web', strategy: 'canary', status: 'Paused', step: 1, weight: 10,
              steps: ['setWeight: 10', 'pause: {duration: 5m}', 'setWeight: 50', 'pause: {}', 'setWeight: 100'],
              desired: 10, current: 10, ready: 10,
              images: ['shop/web:2.4.0 (stable)', 'shop/web:2.5.0 (canary)'],
              analysisMsg: 'AnalysisRun "shop-web-success-rate": ✗ FAILING\n    success-rate: 0.959 → 0.941 → 0.938  (threshold: >= 0.95)\n    failures: 2/3  — ek aur fail par rollout KHUD abort ho jayega',
              onChange: (sim, ro) => {
                if (ro.aborted) {
                  sim.cluster.pods = sim.cluster.pods.filter(p => !p.name.includes('canary'));
                }
              },
            },
          ],
        },
        success: s => { const r = (s.cluster.rollouts || [])[0]; return r && r.aborted && s.history.some(h => /kubectl logs shop-web-canary/.test(h)); },
        successText: 'Sahi faisla! 🐤 Metrics jhooth nahi bolte: canary ka error rate <b>4.1%</b> vs stable ka <b>0.2%</b> — aur AnalysisRun already 2/3 fail par tha. <code>abort</code> se traffic turant 100% stable par wapas, canary pods scale down. <b>Impact: sirf 10% users, 4 minute.</b> Agar tumne <code>promote</code> kiya hota toh 50% users us bug par chale jaate. Aur dhyan do — asli setup mein AnalysisRun teesre fail par <b>khud</b> abort kar deta; tumne bas usse jaldi kar diya.',
        hints: [
          'kubectl argo rollouts get rollout shop-web → step 1/5, weight 10%, aur ANALYSIS section dhyan se padho',
          'kubectl logs shop-web-canary-x → error rate compare karo stable pods se',
          'Metrics kharab hain → kubectl argo rollouts abort shop-web (promote MAT karna!)',
        ],
      },
      {
        type: 'order',
        title: 'Canary ka Poora Safar',
        instructions: 'Ek successful canary rollout ke steps sahi order mein lagao.',
        steps: [
          { text: 'Git mein image tag 2.5.0 push hua → ArgoCD ne Rollout update kiya', explain: 'GitOps + Rollouts ek saath: git hi trigger hai. Rollout spec badla, canary shuru.' },
          { text: 'Canary ReplicaSet bana, setWeight: 10 — 10% traffic v2 par', explain: 'Stable pods abhi bhi 90% traffic le rahe hain. Blast radius = 10%.' },
          { text: 'AnalysisRun shuru — Prometheus se success-rate query har 1 min', explain: 'Robot dekh raha hai. Insaan ko dashboard ghoorne ki zaroorat nahi.' },
          { text: 'Analysis pass — pause duration khatam — setWeight: 50', explain: 'Metrics theek hain toh weight badhta hai. Har step par analysis phir chalta hai.' },
          { text: 'pause: {} par ruka — manual promote ka intezaar', explain: 'Human gate: bade jump (50→100) se pehle koi insaan haan bole. <code>rollouts promote</code>.' },
          { text: 'setWeight: 100 — canary ab stable ban gaya, purana ReplicaSet scale down', explain: 'Rollout complete, status Healthy. Ab v2 hi "stable" hai — agli baar isse compare hoga.' },
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Rollouts ki barikiyan',
        questions: [
          {
            q: 'Rollout ke saath ArgoCD ka health status kaisa behave karta hai?',
            choices: [
              'Rollout "Paused" (canary ke beech) hone par ArgoCD app "Progressing" dikhata hai — Degraded nahi; abort hone par Degraded',
              'ArgoCD Rollouts ko samajhta hi nahi',
              'Hamesha Healthy dikhata hai',
              'Rollout hamesha Degraded dikhta hai',
            ],
            answer: 0,
            explain: 'ArgoCD ke paas Rollout ke liye built-in health check hai. Isliye CI mein <code>argocd app wait --health</code> canary ke complete hone ka intezaar kar leta hai — dono tools ek saath design kiye gaye hain (dono Argo project ke hain!).',
          },
          {
            q: 'Deployment ko Rollout mein migrate karna hai — sabse aasan tarika?',
            choices: [
              'kind: Deployment → kind: Rollout karo aur strategy add karo (baaki spec same rehti hai); ya workloadRef se existing Deployment ko reference karo',
              'Poora naya app banana padega',
              'Migration possible nahi hai',
              'Pehle saare pods delete karo',
            ],
            answer: 0,
            explain: 'Rollout spec Deployment ka superset hai — isliye migration aasan hai. <code>workloadRef</code> wala tarika aur bhi safe hai (Deployment scale-to-zero hota hai, Rollout usko reference karta hai).',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Progressive Delivery',
      instructions: 'Yeh modern delivery ka round hai — yahan senior soch dikhao. 🎤',
      questions: [
        {
          q: '"Canary aur rolling update mein farak?" — sabse spasht jawab?',
          choices: [
            'Rolling update PODS replace karta hai (traffic control nahi — aakhir mein 100% users naye version par); canary TRAFFIC ka percentage control karta hai aur metrics dekh kar aage badhta ya abort hota hai — blast radius weight jitna, rollback instant (weight 0)',
            'Canary rolling update ka naya naam hai',
            'Canary sirf frontend ke liye hota hai',
            'Rolling update zyada safe hai',
          ],
          answer: 0,
          explain: 'Axis ka farak (pods vs traffic) + blast radius + rollback speed — teeno bolo. Payment war-story sunao: 5% users vs 100% users.',
        },
        {
          q: 'AnalysisTemplate ka fayda kya hai — sirf pause kaafi nahi?',
          choices: [
            'Pause insaan par depend karta hai (raat 2 baje kaun dashboard dekhega?); Analysis Prometheus se objective metrics leta hai aur khud promote/abort karta hai — human error aur reaction time dono hat jaate hain',
            'Analysis sirf logging ke liye hai',
            'Pause aur analysis same hain',
            'Analysis rollout ko fast banata hai',
          ],
          answer: 0,
          explain: '"Automate the decision, not just the deployment" — yeh line bolo. Aur Observability level se jodo: analysis tabhi possible hai jab metrics already achhe se instrumented hon.',
        },
        {
          q: 'Canary vs Blue-Green — kab kaunsa chunoge?',
          choices: [
            'Canary: gradual risk reduction chahiye, resources bachane hain, metrics-driven confidence (typical web/API). Blue-Green: instant switch/rollback chahiye, testing preview par karni hai, aur double resources afford kar sakte ho (DB migration wale releases, strict cutover)',
            'Blue-Green hamesha better hai',
            'Canary hamesha better hai',
            'Dono same hain, naam alag',
          ],
          answer: 0,
          explain: 'Trade-off: canary = sasta+dheema+granular, blue-green = mehenga+instant+binary. Mention karo ki blue-green mein DB backward-compatibility ka sawal bada hota hai (dono versions ek hi DB par).',
        },
      ],
    },
    success: [
      'Main Rollout aur Deployment ka farak (traffic vs pods) samjha sakta hoon',
      'Main canary steps + manual promote/abort chala sakta hoon',
      'Main AnalysisTemplate se metrics-driven auto-rollback design kar sakta hoon',
      'Main canary vs blue-green ka informed choice kar sakta hoon',
    ],
    homework: `<p>Argo Rollouts khud chalao — canary aankhon se dekho:</p>
      <pre>kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
# kubectl plugin (bahut useful):
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x kubectl-argo-rollouts-linux-amd64 && sudo mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts

kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-rollouts/master/docs/getting-started/basic/rollout.yaml
kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-rollouts/master/docs/getting-started/basic/service.yaml
kubectl argo rollouts get rollout rollouts-demo --watch    # live dashboard! (Ctrl+C)

# naya version deploy karo:
kubectl argo rollouts set image rollouts-demo rollouts-demo=argoproj/rollouts-demo:yellow
kubectl argo rollouts get rollout rollouts-demo --watch    # PAUSED at step 1 dikhega!
kubectl argo rollouts promote rollouts-demo                # aage badhao
kubectl argo rollouts abort rollouts-demo                  # ya wapas!
kubectl delete ns argo-rollouts</pre>
      <p>✅ Self-check: <code>--watch</code> dashboard mein canary/stable pods ka split dekha? Promote karte hi weight badhta dekha?</p>`,
    cards: [
      { front: 'Rollout vs Deployment?', back: '<b>Deployment</b> = pods replace (traffic control nahi, aakhir mein 100% users). <b>Rollout</b> = <b>traffic %</b> control (canary weight), metrics se auto-promote/abort, rollback = weight 0 (instant, koi pod surgery nahi).' },
      { front: 'AnalysisTemplate kya karta hai?', back: 'Prometheus (ya aur provider) se query chalata hai har step par — <code>successCondition</code> fail ho toh rollout <b>khud abort</b>. "Automate the decision, not just the deployment." Raat 2 baje koi dashboard nahi ghoorta.' },
      { front: 'pause: {} vs pause: {duration: 5m}?', back: '<code>duration</code> = itni der ruk kar KHUD aage. <code>{}</code> (khaali) = <b>anant pause</b> — manual <code>kubectl argo rollouts promote</code> ka intezaar (human gate for risky jumps).' },
      { front: 'Canary vs Blue-Green — kab kya?', back: '<b>Canary</b>: gradual, sasta (thode extra pods), metrics-driven — typical web/API. <b>Blue-Green</b>: dono versions poore chalte hain, switch/rollback INSTANT, par double resources; strict cutover ya preview testing chahiye tab.' },
    ],
  },

  /* ================= LEVEL A6: BOSS ================= */
  {
    id: 'argoboss',
    icon: '🐉',
    title: 'BOSS: GitOps War Room',
    badge: 'GitOps Guru',
    objectives: [
      'Poore track ka gyaan ek incident mein',
      'Sync vs Health se sahi diagnosis',
      'GitOps mein secrets (ESO ke saath) aur emergency process',
      'Final interview — GitOps philosophy + practice',
    ],
    lesson: [
      `<h3>🐉 Aaj ki raat</h3>
       <p>Tum platform on-call ho. Ek release chal raha hai, aur teen alag layers par
       cheezein toot rahi hain. Sab kuch jo is track mein seekha — Application states,
       sync policies, waves, ApplicationSets, Rollouts — sab lagega.</p>
       <ul>
         <li>🖥️ <b>Round 1:</b> Terminal — multi-app GitOps triage</li>
         <li>🚨 <b>Round 2:</b> Incident — "sabne kuch nahi kiya" par prod badal gaya</li>
         <li>🎤 <b>Round 3:</b> Final interview</li>
       </ul>
       <div class="war-story"><b>🔐 Boss ke liye ek zaroori concept — GitOps + Secrets:</b>
       Git mein Secret ka YAML kabhi nahi jaata (Track 3 ka sabak). GitOps mein pattern
       yeh hai: git mein <b>ExternalSecret</b> (sirf vault path ka reference) jaata hai,
       ESO usse asli K8s Secret banata hai, aur app <code>secretKeyRef</code> se use karta
       hai. ArgoCD ke liye ExternalSecret ek normal resource hai — woh usse sync karta hai,
       par uske andar ki <b>value kabhi git mein nahi</b> hoti. Isliye "ArgoCD ne secret
       leak kar diya" kabhi nahi hota — agar tumne SealedSecrets/ESO sahi lagaya ho.</div>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Round 1: GitOps Triage',
        instructions: 'Teen apps, teen alag problems. Har ek ko sahi tarike se diagnose karo.',
        goal: 'Cluster mein 3 apps hain, teeno alag tarah se bimaar. <b>(1)</b> <code>argocd app list</code> se teeno ka status padho, <b>(2)</b> har ek ko diagnose karo (<code>app get</code> / <code>app diff</code> / <code>kubectl logs</code>), <b>(3)</b> teeno ko theek karo — <code>shop</code> ko sync, <code>payments</code> ka manifest fix (<code>ls</code>), aur <code>legacy</code> ka extra resource prune.',
        tasks: [
          { text: 'Teeno apps ka status padho', check: s => s.history.some(h => /^argocd app list/.test(h)) },
          { text: 'payments Degraded kyun — logs dekho', check: s => s.history.some(h => /kubectl logs payments/.test(h)) },
          { text: 'Teeno apps Synced + Healthy karo', check: s => (s.cluster.apps || []).every(a => a.sync === 'Synced' && a.health === 'Healthy') },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '200d', version: 'v1.30.2' }],
          pods: [
            { name: 'shop-web-1', ready: '1/1', status: 'Running', restarts: 0, age: '7d', node: 'node-1', ip: '10.244.1.71', logs: '[shop 2.4.0] serving' },
            { name: 'payments-web-9f8e', ready: '0/1', status: 'CrashLoopBackOff', restarts: 8, age: '11m', node: 'node-1', ip: '10.244.1.72',
              logs: '[payments 3.1.0] starting...\nFATAL: env STRIPE_KEY not set\nexit 1',
              prevLogs: '[payments 3.1.0] starting...\nFATAL: env STRIPE_KEY not set' },
            { name: 'legacy-app-aa', ready: '1/1', status: 'Running', restarts: 0, age: '90d', node: 'node-1', ip: '10.244.1.73', logs: '[legacy] ok' },
          ],
          deployments: [
            { name: 'shop-web', ready: '1/1', upToDate: 1, available: 1, age: '7d' },
            { name: 'payments-web', ready: '0/1', upToDate: 1, available: 0, age: '11m' },
            { name: 'legacy-app', ready: '1/1', upToDate: 1, available: 1, age: '90d' },
          ],
          services: [
            { name: 'legacy-old-svc', type: 'ClusterIP', clusterIP: '10.96.0.88', ports: '80/TCP', age: '90d' },
          ],
          apps: [
            {
              name: 'shop', project: 'default', path: 'apps/shop', sync: 'OutOfSync', health: 'Healthy',
              revision: 'aa1', targetRevisionSha: 'bb2', destNamespace: 'default',
              resources: [{ group: 'apps', kind: 'Deployment', name: 'shop-web', status: 'OutOfSync', health: 'Healthy' }],
              diff: '===== apps/Deployment default/shop-web ======\n-   image: shop/web:2.4.0\n+   image: shop/web:2.5.0\n\n(git aage hai — bas sync karna hai)',
              history: [{ id: 1, revision: 'aa1', deployedAt: '2026-08-28T10:00:00Z', note: 'Sync' }],
              onSync: (sim) => { const p = sim.cluster.pods.find(x => x.name.startsWith('shop-web')); if (p) p.logs = '[shop 2.5.0] serving'; return true; },
            },
            {
              name: 'payments', project: 'default', path: 'apps/payments', sync: 'Synced', health: 'Degraded',
              revision: 'bb2', targetRevisionSha: 'bb2', destNamespace: 'default',
              degradedReason: 'pods CrashLoopBackOff',
              resources: [{ group: 'apps', kind: 'Deployment', name: 'payments-web', status: 'Synced', health: 'Degraded' }],
              diff: '(koi diff nahi — git aur cluster match karte hain ✓)',
              history: [{ id: 1, revision: 'bb2', deployedAt: '2026-09-01T21:40:00Z', note: 'Sync' }],
              onSync: (sim, app) => {
                const p = sim.cluster.pods.find(x => x.name.startsWith('payments'));
                if (p && p.status !== 'Running') { app.syncError = 'Deployment payments-web is Degraded'; return false; }
                return true;
              },
            },
            {
              name: 'legacy', project: 'default', path: 'apps/legacy', sync: 'OutOfSync', health: 'Healthy',
              revision: 'cc3', targetRevisionSha: 'cc3', destNamespace: 'default',
              syncPolicy: { automated: { prune: false, selfHeal: true } },
              resources: [
                { group: 'apps', kind: 'Deployment', name: 'legacy-app', status: 'Synced', health: 'Healthy' },
                { group: '', kind: 'Service', name: 'legacy-old-svc', status: 'OutOfSync', health: '', pruneMe: true },
              ],
              diff: '===== /Service default/legacy-old-svc ======\n- (git se 3 mahine pehle hata diya gaya tha, par cluster mein zinda hai)\n\n⚠️  prune OFF hai — isliye app hamesha OutOfSync dikh raha hai',
              history: [{ id: 1, revision: 'cc3', deployedAt: '2026-06-01T10:00:00Z', note: 'Sync' }],
              onSync: (sim, app) => {
                const pruned = (app.resources || []).filter(r => r.pruneMe && r.pruned).map(r => r.name);
                sim.cluster.services = sim.cluster.services.filter(s2 => !pruned.includes(s2.name));
                return true;
              },
            },
          ],
        },
        files: {
          'fix-payments-secret.yaml': {
            desc: 'payments Deployment mein STRIPE_KEY ka secretKeyRef add karta hai (ExternalSecret se aata hai)',
            apply: s => {
              const p = s.cluster.pods.find(x => x.name.startsWith('payments'));
              p.status = 'Running'; p.ready = '1/1';
              p.logs = '[payments 3.1.0] STRIPE_KEY loaded from secret ✓\n[payments 3.1.0] serving on :8080';
              const d = s.cluster.deployments.find(x => x.name === 'payments-web');
              if (d) { d.ready = '1/1'; d.available = 1; }
              const app = s.cluster.apps.find(a => a.name === 'payments');
              app.health = 'Healthy'; app.degradedReason = null;
              app.resources.forEach(r => { r.health = 'Healthy'; });
              return 'deployment.apps/payments-web configured\n(STRIPE_KEY ab secretKeyRef se aa raha hai — value ExternalSecret/Vault se, git mein sirf reference ✓)\n\n⚠️  Asli GitOps mein: yeh fix GIT mein commit karo, warna selfHeal/agla sync ise mita dega!';
            },
          },
          'restart-payments.yaml': {
            desc: 'payments pods ko restart karta hai',
            apply: () => 'deployment restarted...\n(phir wahi: "FATAL: env STRIPE_KEY not set". Restart config nahi badalta — Track 1 ka sabak yahan bhi lagu hai!)',
          },
        },
        success: s => (s.cluster.apps || []).every(a => a.sync === 'Synced' && a.health === 'Healthy') &&
          s.history.some(h => /kubectl logs payments/.test(h)),
        successText: 'Teeno theek! 🧯 Teen bilkul alag problems, teen alag ilaaj: <b>(1) shop</b> — OutOfSync+Healthy = git aage tha, bas <code>sync</code>. <b>(2) payments</b> — <b>Synced+Degraded</b> = ArgoCD ne apna kaam sahi kiya, manifest hi galat tha (missing secret ref) → yeh ArgoCD ka nahi, tumhare YAML ka bug tha. <b>(3) legacy</b> — OutOfSync+Healthy par diff mein purana resource: prune OFF hone se woh kabhi hatta hi nahi tha → <code>sync --prune</code>. <b>Status padhna aa gaya toh aadha kaam ho gaya.</b>',
        hints: [
          'argocd app list → shop (OutOfSync+Healthy), payments (Synced+Degraded), legacy (OutOfSync+Healthy)',
          'payments Synced hai matlab manifest sahi apply hua — problem manifest MEIN hai: kubectl logs payments-web-9f8e',
          'shop: argocd app sync shop · payments: apply -f fix-payments-secret.yaml · legacy: argocd app sync legacy --prune',
        ],
      },
      {
        type: 'incident',
        title: '🚨 Round 2: "Kisi ne kuch nahi kiya"',
        instructions: 'Prod apne aap badal gaya. GitOps detective banna padega.',
        pager: '<b>ALERT:</b> prod mein replicas 12 → 3 ho gaye · latency spike · <b>koi deploy nahi hua</b> (last commit 2 din purana) · 8:40 PM',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ argocd app get shop-prod | head -12\nSync Policy:   Automated (Prune) (Self Heal)\nSync Status:   Synced (f7a8b9c)\nHealth Status: Healthy\n\n$ kubectl get deploy shop-web\nNAME       READY   UP-TO-DATE   AVAILABLE\nshop-web   3/3     3            3          ← 12 hone chahiye the!',
            text: 'App "Synced + Healthy" hai, par replicas 12 se 3 ho gaye. Deploy bhi nahi hua. Pehla shak?',
            choices: [
              { t: 'Kisi ne 12 replicas manually (kubectl scale) set kiye the — git mein hamesha 3 tha; aaj selfHeal ne usse "theek" kar diya', good: true, next: 'n2', explain: 'Bilkul! selfHeal ne apna kaam kiya — cluster ko git jaisa banaya. "Kisi ne kuch nahi kiya" sach hai... aaj. Galti purani hai: 12 kabhi git mein gaya hi nahi.' },
              { t: 'ArgoCD ka bug hai — usse restart karo', good: false, explain: 'App Synced+Healthy hai — ArgoCD apna kaam theek kar raha hai. Restart se woh phir git wala state hi lagayega. Tool ko blame karne se pehle git dekho.' },
              { t: 'HPA ne scale down kiya hoga', good: false, explain: 'Accha guess — par HPA hota toh app OutOfSync dikhta (ya ignoreDifferences hoti). Yahan Synced hai = cluster GIT jaisa hai, matlab git mein hi 3 likha hai.' },
            ],
          },
          n2: {
            sitrep: '$ git log --oneline -3 -- apps/shop/prod/deployment.yaml\nf7a8b9c (2 din pehle) bump image to 2.5.0\nc4d5e6f (3 hafte pehle) initial prod manifests\n\n$ git show f7a8b9c:apps/shop/prod/deployment.yaml | grep replicas\n  replicas: 3        ← git mein HAMESHA 3 tha\n\n$ kubectl get events | grep -i scaled | tail -2\n38m  Normal  ScalingReplicaSet  Scaled down replica set shop-web-7d4f to 3',
            text: 'Confirm: git mein hamesha 3. Kisi ne 3 hafte pehle manually 12 kiya tha, aur aaj selfHeal ne wapas 3 kar diya. Ab kya?',
            choices: [
              { t: 'Emergency PR: git mein replicas 12 (ya sahi number) karo → merge → ArgoCD sync — aur post-mortem mein HPA lagane ka action item', good: true, next: 'n3', explain: 'GitOps ka ekmatra sahi raasta: fix GIT mein. Aur asli sawal — "12 kyun chahiye?" — ka permanent jawab HPA hai, manual scale nahi.' },
              { t: 'kubectl scale se turant 12 karo, git baad mein', good: false, explain: '😱 selfHeal ON hai — 30 second mein wapas 3 ho jayega! Yehi galti 3 hafte pehle kisi ne ki thi, aur aaj hum uska natija bhugat rahe hain.' },
              { t: 'selfHeal band kar do taaki aisa dobara na ho', good: false, explain: 'Ulta! selfHeal ne to problem BATAYI hai (chhupi hui drift ko saamne laaya). Usse band karne ka matlab: agli baar drift 3 hafte tak chhupi rahegi, aur kisi bure waqt par phatt jayegi.' },
            ],
          },
          n3: {
            sitrep: '$ git commit -m "prod: replicas 3 -> 12 (traffic growth)" && git push\n$ argocd app sync shop-prod\nSynced ✓  replicas: 12\n\nLatency wapas normal. 📉',
            text: 'Service theek. Post-mortem mein permanent fix kya likhoge?',
            choices: [
              { t: 'HPA lagao (min 12 / max 40) + uske /spec/replicas ko ignoreDifferences mein daalo; aur team ko batao ki har change git se — emergency ke liye fast-track PR process', good: true, next: 'end', explain: 'Teen layers ka fix: (1) sahi tool (HPA — manual scaling ki zaroorat hi na pade), (2) tooling conflict ka ilaaj (ignoreDifferences warna HPA vs selfHeal ki ladai), (3) process (fast-track PR). Yeh poora Track 2 + Track 5 ka gyaan ek saath hai.' },
              { t: 'Bas git mein 12 likh diya, kaam ho gaya', good: false, explain: 'Aaj 12 kaafi hai, agle sale par 40 chahiye honge — phir wahi manual scaling, wahi drift. Static number traffic-driven problem ka jawab nahi.' },
              { t: 'Sabko bol do ki kubectl scale mat karna', good: false, explain: 'Sirf "bol dena" process nahi hai. 6 mahine baad naya engineer, wahi galti. Tool-level fix (HPA) + process (fast-track PR) chahiye — insaan ki yaaddasht par mat tiko.' },
            ],
          },
          end: {
            end: true,
            text: 'Drift mystery solved. 🕵️',
            summary: '<b>Is incident ke 3 sabak:</b> (1) <b>Synced + Healthy</b> ka matlab hai ArgoCD sahi hai — problem git mein ya process mein hai, tool mein nahi. (2) selfHeal <b>dushman nahi</b> — usne 3 hafte purani chhupi drift saamne laayi; usse band karna problem ko andhere mein dhakelna hai. (3) Har change git se — aur agar koi cheez baar-baar manually badalni pad rahi hai, toh woh <b>galat tool</b> ka signal hai (yahan: HPA chahiye tha).',
          },
        },
      },
      {
        type: 'quiz',
        title: 'Round 3 warm-up: Speed Round',
        instructions: 'Final interview se pehle — reflex check!',
        questions: [
          { q: 'App "Synced + Degraded" — problem kahan hai?', choices: ['Git ke manifest mein (ArgoCD ne sahi apply kiya)', 'ArgoCD mein', 'Cluster network mein', 'Git server down hai'], answer: 0, explain: 'Synced = cluster git jaisa hai. Degraded = jo hai woh kharab hai. Matlab git ka sach hi bimaar hai.' },
          { q: 'Auto-sync ON hai — rollback kaise?', choices: ['git revert + push', 'argocd app rollback', 'kubectl rollout undo', 'ArgoCD restart'], answer: 0, explain: 'Auto-sync mein git boss hai — cluster ko peeche kheencho toh agla sync usse wapas kar dega.' },
          { q: 'App hamesha OutOfSync, diff mein ek extra Service — fix?', choices: ['sync --prune (ya prune: true)', 'App delete karke banao', 'Service ko manually delete karo', 'ignoreDifferences'], answer: 0, explain: 'Git se hata resource cluster mein zinda hai. Manual delete bhi chalega par prune enable karna asli fix hai.' },
          { q: 'ApplicationSet se bani app ko manually edit kiya — kya hoga?', choices: ['Controller usse wapas template jaisa bana dega', 'Change permanent rahega', 'ApplicationSet delete ho jayega', 'Error aayega'], answer: 0, explain: 'ApplicationSet bhi reconciliation loop hai — generator/template badlo, generated app nahi.' },
          { q: 'Canary ke beech mein metrics kharab — command?', choices: ['kubectl argo rollouts abort <name>', 'promote --full', 'kubectl delete rollout', 'argocd app sync'], answer: 0, explain: 'Abort = traffic 100% stable par turant wapas. Promote --full toh ulta khatra badha dega!' },
        ],
      },
    ],
    interview: {
      title: '🎤 FINAL Interview — GitOps Mastery',
      instructions: 'ArgoCD track ka aakhri round. Yeh clear = tum GitOps production mein sambhal sakte ho.',
      questions: [
        {
          q: '"GitOps adopt kar rahe hain — tumhara rollout plan kya hoga?" (Platform engineer ka jawab)',
          choices: [
            'ArgoCD install → ek non-critical app manual sync se shuru → confidence badhe toh automated+selfHeal → App-of-Apps se bootstrap + ApplicationSets se scale → AppProjects se team guard-rails → secrets ESO se (git mein sirf reference) → critical services par Argo Rollouts + analysis',
            'Ek din mein sab kuch ArgoCD par shift karo',
            'Sirf dev environment mein rakho',
            'Pehle saare apps ko Helm charts mein convert karo',
          ],
          answer: 0,
          explain: 'Incremental adoption + har step ka reason. Manual→auto ka progression important hai (team ka trust build hota hai). Secrets aur guard-rails ka mention security-awareness dikhata hai.',
        },
        {
          q: 'GitOps mein secrets kaise handle karte ho? (Track 3 + yeh track)',
          choices: [
            'Git mein sirf REFERENCE (ExternalSecret CR ya SealedSecret) — asli value Vault/AWS SM mein; ESO usse K8s Secret banata hai; ArgoCD ke liye woh normal resource hai, par value kabhi git mein nahi jaati',
            'Secrets ko base64 karke git mein daal do',
            'Private repo hai toh plain secrets theek hain',
            'GitOps ke saath secrets use nahi kar sakte',
          ],
          answer: 0,
          explain: 'Reference-in-git pattern. "Private repo = safe" wali galti call out karo. Rotation ka bonus: Vault mein rotate karo, ESO sync kar dega — git ko chhoona bhi nahi padta.',
        },
        {
          q: 'Team bolti hai "GitOps ne emergency response slow kar diya". Kya jawab dogey?',
          choices: [
            'Fast-track PR process banao (1 approver/break-glass) — 5-10 min mein change; kyunki manual kubectl fix agle sync par UDD jaata hai aur uska koi record nahi hota (jo aaj wale incident mein exactly hua). Speed process se aati hai, GitOps todne se nahi',
            'Emergency mein ArgoCD band kar do',
            'Sahi hai — GitOps emergencies ke liye nahi hai',
            'selfHeal band kar do permanently',
          ],
          answer: 0,
          explain: 'Yeh THE cultural question hai. Drift-incident ki kahani sunao. "Process fix, tool nahi todna" — aur ek line jodo: "manual fix ka koi audit trail nahi hota, isliye woh sirf fast lagta hai, safe nahi."',
        },
        {
          q: 'Aakhri sawal: GitOps ka core idea ek line mein?',
          choices: [
            'Git = desired state ka single source of truth; cluster ke ANDAR ka agent continuously actual ko usse milata hai (pull + reconcile) — yaani wahi Kubernetes wala reconciliation loop, ab poore delivery pipeline par lagaya gaya',
            'YAML files git mein rakhna',
            'CI/CD pipeline ka naya naam',
            'kubectl apply automate karna',
          ],
          answer: 0,
          explain: '🏆 Perfect ending — aur poore course ka bow-tie: Level 2 (controllers reconcile karte hain) → Level 23 (CRD+controller = operator) → yeh track (git = desired state, ArgoCD = controller). <b>Ek hi pattern, har layer par.</b> GitOps Guru! 🔄',
        },
      ],
    },
    success: [
      'Main sync/health se GitOps issues ka sahi diagnosis kar sakta hoon',
      'Main drift incidents ko git-first tarike se resolve kar sakta hoon',
      'Main GitOps + secrets (ESO reference pattern) design kar sakta hoon',
      'Main GITOPS GURU hoon 🔄 — git hi sach hai!',
    ],
    homework: `<p>🎓 Graduation — apna poora GitOps platform:</p>
      <pre># 1) Apna manifests repo banao (GitHub par)
#    apps/
#      ├── root.yaml            (App-of-Apps)
#      ├── my-app/deployment.yaml + service.yaml
# 2) root Application apply karo:
kubectl apply -n argocd -f - <<'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: root, namespace: argocd }
spec:
  project: default
  source: { repoURL: 'https://github.com/&lt;tum&gt;/manifests', path: apps, targetRevision: main }
  destination: { server: https://kubernetes.default.svc, namespace: argocd }
  syncPolicy: { automated: { prune: true, selfHeal: true } }
EOF
# 3) Ab sirf git push karo — cluster khud badlega. kubectl apply BAND. 🔄
# 4) Drift test: kubectl scale se kuch badlo, 1 min mein wapas hote dekho
# 5) Rollback test: git revert karo, sync hote dekho</pre>
      <p>✅ Self-check: ek poora din bina <code>kubectl apply</code> ke nikaal paaye? Tab tum sach mein GitOps kar rahe ho. 🎓</p>`,
    cards: [
      { front: 'GitOps ka core idea (ek line)?', back: '<b>Git = desired state ka single source of truth</b>; cluster ke andar ka agent (ArgoCD) continuously actual ko usse milata hai — wahi K8s reconciliation loop, ab poore delivery pipeline par. Pull-based, isliye CI ke paas cluster creds bhi nahi chahiye.' },
      { front: '"Prod apne aap badal gaya, kisi ne kuch nahi kiya" — GitOps diagnosis?', back: 'App <b>Synced</b> hai? Toh ArgoCD ne cluster ko GIT jaisa banaya — matlab pehle koi <b>manual drift</b> thi jo ab theek ho gayi. <code>git log</code> dekho, tool ko blame mat karo. Permanent fix: sahi tool (HPA) + git-first process.' },
      { front: 'GitOps mein secrets ka pattern?', back: 'Git mein sirf <b>reference</b> — ExternalSecret (ESO) ya SealedSecret. Asli value Vault/AWS SM mein. ArgoCD uske liye normal resource hai. Rotation vault mein — git ko chhoona bhi nahi padta.' },
      { front: '"GitOps emergencies mein slow hai" — jawab?', back: '<b>Fast-track PR</b> process (1 approver/break-glass) = 5-10 min. Manual kubectl fix agle sync par UDD jaata hai aur uska koi audit trail nahi — woh fast LAGTA hai, safe nahi. Process fix karo, tool mat todo.' },
    ],
  },

]);
