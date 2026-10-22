/* =====================================================================
   KubeGurukul — Track 4: ⛵ Helm Gurukul
   Helm ka poora shastra — har level mein asli `helm` terminal.
   Ek chart ("shop") poore track mein step-by-step banta jaata hai.
   ===================================================================== */

KG.registerLevels('helm', [

  /* ================= LEVEL H1: Pehla Release ================= */
  {
    id: 'helmbasics',
    icon: '⛵',
    title: 'Pehla Release — helm install se shuruaat',
    badge: 'Release Rider',
    objectives: [
      'Helm kya hai — "K8s ka apt/npm" + templating engine',
      '<b>Chart / Release / Revision</b> — teen shabd jo sab kuch samjha dete hain',
      'repo add → search → install → list → status → uninstall ka poora chakkar',
      'Values override karna: <code>-f</code> file aur <code>--set</code>',
    ],
    lesson: [
      `<h3>⛵ Helm kyun? — 15 YAML files ka dard</h3>
       <p>Ek chhoti si app ke liye tumhe chahiye: Deployment, Service, Ingress, ConfigMap,
       Secret, HPA, ServiceAccount… <b>7-8 files</b>. Ab 3 environments (dev/staging/prod)
       = 24 files, jismein 90% content SAME hai, bas 3-4 values alag.</p>
       <p>Aur agar Prometheus install karna ho? Uske 40+ manifests khud likhoge? 🙈</p>
       <p><b>Helm do problems solve karta hai:</b></p>
       <table>
         <tr><th>Role</th><th>Matlab</th></tr>
         <tr><td>📦 <b>Package manager</b></td><td>Doosron ke banaye charts ek command mein install: <code>helm install monitoring prometheus-community/kube-prometheus-stack</code></td></tr>
         <tr><td>🪄 <b>Templating engine</b></td><td>Apni app ka EK chart, har env ke liye alag values — copy-paste khatam</td></tr>
       </table>
       <div class="war-story"><b>⚡ Real pattern:</b> Track 3 ke Observability level mein
       tumne <code>helm install monitoring prometheus-community/kube-prometheus-stack</code>
       chalaya tha — us ek line ne <b>50+ manifests</b> (Deployments, DaemonSet, CRDs,
       ServiceMonitors, Grafana dashboards) install kar diye the. Manually likhte toh
       do din lagte. Yehi Helm ki asli taakat hai.</div>`,
      `<h3>🚢 Teen shabd: Chart, Release, Revision</h3>
       <pre>📦 CHART    = blueprint (templates + default values). Ek baar banao.
🚢 RELEASE  = us chart ka ek INSTALLED instance, apne naam ke saath.
              Ek hi chart se 3 releases: shop-dev, shop-staging, shop-prod
🔢 REVISION = us release ka version number. Har install/upgrade/rollback
              se +1. History rehti hai → isliye rollback possible hai.</pre>
       <p>Roz ke commands:</p>
       <pre>helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo nginx              # repo mein kya hai?
helm show values bitnami/nginx      # is chart mein kya configure kar sakta hoon?

helm install web bitnami/nginx      # release "web" bana
helm list                           # kya-kya chal raha hai
helm status web                     # ek release ki halat + NOTES
helm uninstall web                  # bye</pre>
       <p>⚠️ <b>Sabse pehla habit:</b> koi bhi naya chart install karne se pehle
       <code>helm show values &lt;chart&gt;</code> chalao — woh chart ka "menu card" hai.
       Bina menu dekhe order mat karo!</p>`,
      `<h3>🎛️ Values override — do tarike</h3>
       <pre># 1) File se (production ke liye — git mein rehti hai, review hoti hai)
helm install shop ./shop -f values-prod.yaml

# 2) --set se (chhoti cheez, ya CI se image tag)
helm install shop ./shop --set image.tag=2.5 --set replicas=4

# Dono saath bhi:
helm install shop ./shop -f values-prod.yaml --set image.tag=2.5
#                        └─ base config ─┘   └─ yeh JEETEGA ─┘</pre>
       <p><b>Rule:</b> <code>--set</code> hamesha <code>-f</code> se strong hai
       (poori precedence Level 4 mein). Aur <code>helm get values &lt;release&gt;</code>
       se hamesha check kar sakte ho ki asli mein kya laga hai.</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Naya Chart Install Karne ka Sahi Order',
        instructions: 'Ek nayi 3rd-party chart (jaise nginx) install karni hai. Sahi professional order lagao.',
        steps: [
          { text: 'helm repo add bitnami https://charts.bitnami.com/bitnami', explain: 'Pehle repo add — Helm ko pata hona chahiye charts kahan se laane hain.' },
          { text: 'helm repo update', explain: 'Local index refresh — warna purane versions dikhenge ("chart not found" ka #1 reason!).' },
          { text: 'helm search repo nginx', explain: 'Chart ka exact naam + available versions dekho.' },
          { text: 'helm show values bitnami/nginx', explain: 'Menu card! Kaunse knobs hain — replicas? image? service type? Bina yeh dekhe install = andha install.' },
          { text: 'helm install web bitnami/nginx -f my-values.yaml', explain: 'Ab soch-samajh ke install, apni values ke saath.' },
          { text: 'helm list + helm status web', explain: 'Verify — deployed hua? NOTES kya keh rahe hain? (Track 1 ka sabak: deploy "ho gaya" nahi, "verify hua" bolo!)' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Pehla Helm Release',
        instructions: 'Asli helm terminal! Commands type karo — `helm help` se list milegi.',
        goal: 'Ek nginx chart install karo: <b>(1)</b> repo add + update, <b>(2)</b> <code>helm search repo nginx</code>, <b>(3)</b> <code>helm show values</code> se options dekho, <b>(4)</b> install karo release ka naam <code>web</code> rakhke aur <code>--set replicaCount=3</code>, <b>(5)</b> <code>helm list</code> se verify.',
        tasks: [
          { text: 'helm repo add + update', check: s => s.history.some(h => /helm repo add/.test(h)) && s.history.some(h => /helm repo update/.test(h)) },
          { text: 'search + show values (chart ka menu padho)', check: s => s.history.some(h => /helm search repo/.test(h)) && s.history.some(h => /helm show values/.test(h)) },
          { text: 'install karo (release: web, replicaCount=3)', check: s => (s.cluster.releases || []).some(r => r.name === 'web' && r.values.replicaCount === 3) },
          { text: 'helm list se verify', check: s => s.history.some(h => /^helm (list|ls)/.test(h)) },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '10d', version: 'v1.30.2' }],
          pods: [], deployments: [], services: [], releases: [], repos: [],
          searchIndex: [
            { name: 'bitnami/nginx', version: '15.4.2', appVersion: '1.25.3', description: 'NGINX Open Source web server' },
            { name: 'bitnami/postgresql', version: '13.2.24', appVersion: '16.1.0', description: 'PostgreSQL database' },
            { name: 'bitnami/redis', version: '18.6.1', appVersion: '7.2.3', description: 'Redis in-memory data store' },
          ],
          charts: {
            'bitnami/nginx': {
              name: 'nginx', version: '15.4.2', appVersion: '1.25.3',
              defaults: { replicaCount: 1, image: { repository: 'bitnami/nginx', tag: '1.25.3' }, service: { type: 'LoadBalancer', port: 80 } },
              valuesYaml: 'replicaCount: 1\nimage:\n  repository: bitnami/nginx\n  tag: 1.25.3\nservice:\n  type: LoadBalancer\n  port: 80\nresources: {}\n\n(yeh chart ka "menu card" hai — inhi keys ko -f/--set se badal sakte ho)',
              notes: '1. Get the application URL:\n   kubectl get svc web-nginx\n2. Watch the deployment:\n   kubectl get pods -l app.kubernetes.io/name=nginx -w',
              render: (v, rel) => `# Source: nginx/templates/deployment.yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${rel.name}-nginx\nspec:\n  replicas: ${v.replicaCount}\n  template:\n    spec:\n      containers:\n      - name: nginx\n        image: ${v.image.repository}:${v.image.tag}`,
              onInstall: (sim, rel) => {
                const n = rel.values.replicaCount || 1;
                for (let i = 0; i < n; i++)
                  sim.cluster.pods.push({ name: `${rel.name}-nginx-7d4f8b-${'abcde'[i] || 'x'}${i}`, ready: '1/1', status: 'Running', restarts: 0, age: '5s', node: 'node-1', ip: '10.244.1.' + (20 + i), logs: 'nginx: ready to handle connections' });
                sim.cluster.deployments.push({ name: rel.name + '-nginx', ready: n + '/' + n, upToDate: n, available: n, age: '5s' });
              },
            },
          },
        },
        success: s => (s.cluster.releases || []).some(r => r.name === 'web' && r.values.replicaCount === 3) &&
          s.history.some(h => /helm show values/.test(h)) && s.history.some(h => /^helm (list|ls)/.test(h)),
        successText: 'Pehla release deployed! 🚢 Notice karo: <b>(1)</b> repo add ke bina search kaam hi nahi karta, <b>(2)</b> <code>helm show values</code> ne bataya ki <code>replicaCount</code> hi sahi key hai (<code>replicas</code> nahi — har chart ke apne naam hote hain, isliye menu padhna zaroori hai!), <b>(3)</b> install ne pods bhi bana diye — <code>kubectl get pods</code> se dekh sakte ho. Ek command, poora stack.',
        hints: [
          'helm repo add bitnami https://charts.bitnami.com/bitnami — phir helm repo update',
          'helm search repo nginx → phir helm show values bitnami/nginx (key ka naam dhyan se padho!)',
          'helm install web bitnami/nginx --set replicaCount=3 → phir helm list',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Release ki barikiyan',
        questions: [
          {
            q: 'Ek hi chart se same cluster mein 3 releases (shop-dev, shop-staging, shop-prod) — possible?',
            choices: [
              'Haan — chart blueprint hai, release uska instance; har release ka apna naam, apni values, apni revision history',
              'Nahi — ek chart ka ek hi release ho sakta hai',
              'Haan par sabki values same hongi',
              'Sirf alag clusters mein possible hai',
            ],
            answer: 0,
            explain: 'Yehi chart-vs-release ka farak hai (class vs object jaisa). Isliye release ka naam resources ke naam mein aata hai — <code>{{ .Release.Name }}</code> — taaki 3 releases takraayein nahi.',
          },
          {
            q: 'helm uninstall karne par by default release ki history ka kya hota hai?',
            choices: [
              'History bhi delete ho jaati hai — rollback ab possible nahi (bachane ke liye: --keep-history)',
              'History hamesha rehti hai',
              'History 30 din tak rehti hai',
              'History etcd mein permanent save rehti hai',
            ],
            answer: 0,
            explain: 'Helm 3 mein release ka data namespace ke Secrets mein rehta hai (sh.helm.release.v1.*). Uninstall = woh bhi gaya. --keep-history rakhe toh release "uninstalled" status mein dikhta hai aur rollback ho sakta hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Helm Basics',
      instructions: 'Pehla Helm round — definitions crisp honi chahiye. 🎤',
      questions: [
        {
          q: '"Helm kya hai aur kyun use karte ho?" — sabse complete jawab?',
          choices: [
            'Do cheezein: (1) K8s ka package manager — 3rd-party stacks ek command mein install/upgrade, (2) templating + release management — apni app ka ek chart, har env ki alag values, aur revision history se rollback',
            'Helm YAML files ko chhota karne ka tool hai',
            'Helm Kubernetes ka alternative hai',
            'Helm sirf Kubernetes install karne ke liye hota hai',
          ],
          answer: 0,
          explain: 'Dono roles bolo — bahut log sirf "templating" bolte hain aur package-manager wala hissa bhool jaate hain. Release management (revisions + rollback) ka mention extra points deta hai.',
        },
        {
          q: 'Chart, Release aur Revision mein farak?',
          choices: [
            'Chart = blueprint/package (templates + defaults); Release = cluster mein us chart ka ek named instance; Revision = us release ka version number (har upgrade/rollback par +1)',
            'Teeno same cheez ke naam hain',
            'Chart = installed app, Release = YAML file, Revision = git commit',
            'Release chart ka naya version hota hai',
          ],
          answer: 0,
          explain: 'Class → object → version. Ek line mein bolo: "Ek chart se kai releases; har release ki apni revision history."',
        },
        {
          terminal: {
            title: 'Hands-on: Release Inspector',
            goal: '🧑‍💼 Interviewer: "Yeh cluster mein ek release chal raha hai. Batao: <b>kaunsi values</b> di gayi thi install ke waqt, aur release <b>kis revision</b> par hai?" (Hint: helm list, helm get values)',
            cluster: {
              nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '30d', version: 'v1.30.2' }],
              pods: [{ name: 'cache-redis-master-0', ready: '1/1', status: 'Running', restarts: 0, age: '4d', node: 'node-1', ip: '10.244.1.9', logs: 'Ready to accept connections' }],
              deployments: [], services: [], repos: [{ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }],
              releases: [{
                name: 'cache', namespace: 'default', chart: 'redis-18.6.1', chartRef: 'bitnami/redis',
                appVersion: '7.2.3', revision: 3, status: 'deployed', updated: '2026-07-15 09:12:44 UTC',
                values: { architecture: 'standalone', auth: { enabled: true }, master: { persistence: { size: '20Gi' } } },
                history: [
                  { revision: 1, updated: '2026-07-01 10:00:00 UTC', status: 'superseded', chart: 'redis-18.6.1', appVersion: '7.2.3', description: 'Install complete', values: { architecture: 'standalone' } },
                  { revision: 2, updated: '2026-07-09 14:20:00 UTC', status: 'superseded', chart: 'redis-18.6.1', appVersion: '7.2.3', description: 'Upgrade complete', values: { architecture: 'standalone', auth: { enabled: true } } },
                  { revision: 3, updated: '2026-07-15 09:12:44 UTC', status: 'deployed', chart: 'redis-18.6.1', appVersion: '7.2.3', description: 'Upgrade complete', values: { architecture: 'standalone', auth: { enabled: true }, master: { persistence: { size: '20Gi' } } } },
                ],
                notes: 'Redis can be accessed at cache-redis-master.default.svc.cluster.local',
              }],
              charts: { 'bitnami/redis': { name: 'redis', version: '18.6.1', appVersion: '7.2.3', defaults: { architecture: 'replication' } } },
            },
            tasks: [
              { text: 'helm list — release aur revision dekho', check: s => s.history.some(h => /^helm (list|ls)/.test(h)) },
              { text: 'helm get values cache — di gayi values', check: s => s.history.some(h => /helm get values cache/.test(h)) },
            ],
            success: s => s.history.some(h => /^helm (list|ls)/.test(h)) && s.history.some(h => /helm get values cache/.test(h)),
            successText: 'Bilkul sahi! Release <b>cache</b> revision <b>3</b> par hai, aur user-supplied values thi: standalone architecture, auth on, 20Gi persistence. Do commands jo har Helm debugging shuru karte hain: <code>helm list</code> (kya chal raha hai) + <code>helm get values</code> (kis config par). Bonus: <code>helm history cache</code> se poori kahani dikhti hai — 3 revisions.',
            hints: ['helm list se releases aur unke revisions dikhte hain', 'helm get values cache — "USER-SUPPLIED VALUES" section padho', 'Aur detail chahiye? helm history cache'],
          },
        },
      ],
    },
    success: [
      'Main Helm ke dono roles (package manager + templating/release manager) samjha sakta hoon',
      'Main chart / release / revision ka farak bata sakta hoon',
      'Main repo add → search → show values → install → verify ka flow chala sakta hoon',
      'Main -f aur --set se values override kar sakta hoon',
    ],
    homework: `<p>Asli Helm, apne minikube par:</p>
      <pre>helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo nginx
helm show values bitnami/nginx | head -40      # menu card padho!
helm install web bitnami/nginx --set replicaCount=2 --set service.type=ClusterIP
helm list
helm status web
kubectl get pods                                # Helm ne banaye!
helm get values web                             # sirf tumhari values
helm uninstall web</pre>
      <p>✅ Self-check: <code>helm get values web</code> mein sirf woh 2 values dikhi jo tumne di? (Chart ke defaults nahi — woh <code>--all</code> se dikhte hain.)</p>`,
    cards: [
      { front: 'Chart vs Release vs Revision?', back: '📦 <b>Chart</b> = blueprint (templates+defaults). 🚢 <b>Release</b> = cluster mein us chart ka named instance (ek chart → kai releases). 🔢 <b>Revision</b> = release ka version, har install/upgrade/rollback par +1 (isliye rollback possible).' },
      { front: 'Naya chart install karne se PEHLE kaunsa command?', back: '<code>helm show values &lt;chart&gt;</code> — chart ka "menu card". Har chart ke apne key naam hote hain (<code>replicaCount</code> vs <code>replicas</code>!). Bina menu dekhe install = andha install.' },
      { front: 'Helm ke do roles?', back: '1) <b>Package manager</b> — doosron ke charts (Prometheus, nginx) ek command mein. 2) <b>Templating + release manager</b> — apni app ka ek chart, har env alag values, revision history se rollback.' },
      { front: '"helm search repo" kuch nahi dikha raha — pehla shak?', back: '<code>helm repo add</code> kiya? Aur <code>helm repo update</code>? Local index purana ho toh naye charts/versions dikhte hi nahi — yeh "chart not found" ka #1 reason hai.' },
    ],
  },

  /* ================= LEVEL H2: Chart ki Anatomy ================= */
  {
    id: 'helmanatomy',
    icon: '📦',
    title: 'Chart ki Anatomy — apna chart banao',
    badge: 'Chart Kaarigar',
    objectives: [
      'Chart ka folder structure — har file ka kaam',
      '<b>version vs appVersion</b> — classic interview gotcha',
      '<code>helm create</code> → <code>lint</code> → <code>template</code> → <code>install</code> ka dev loop',
      '_helpers.tpl aur NOTES.txt kyun hote hain',
    ],
    lesson: [
      `<h3>📁 Chart ke andar — file by file</h3>
       <pre>shop/
├── Chart.yaml          # chart ka "passport": naam, version, appVersion
├── values.yaml         # DEFAULT config (menu card jo users padhte hain)
├── values.schema.json  # (optional) values ka validation — Level 4
├── charts/             # subcharts / dependencies — Level 5
├── .helmignore         # package mein kya na jaaye (.git, *.md…)
└── templates/
    ├── deployment.yaml # {{ }} wale manifests
    ├── service.yaml
    ├── _helpers.tpl    # reusable snippets (underscore = render nahi hota!)
    ├── NOTES.txt       # install ke baad screen par jo message aata hai
    └── tests/
        └── test-connection.yaml   # helm test — Level 6</pre>
       <p>⚠️ <b>Underscore rule:</b> <code>templates/</code> ki har file render hoti hai —
       SIVA un ke jo <code>_</code> se shuru hoti hain. Isliye helpers hamesha
       <code>_helpers.tpl</code>. Agar galti se <code>helpers.tpl</code> naam rakha,
       toh Helm usse manifest samajh ke apply karne ki koshish karega. 💥</p>`,
      `<h3>🪪 Chart.yaml — aur version ka jaal</h3>
       <pre>apiVersion: v2          # Helm 3 ka chart format (v1 = purana Helm 2)
name: shop
description: Shop microservice
type: application       # ya "library" (sirf helpers, install nahi hota)
version: 0.2.0          # ⚠️ CHART ka version (SemVer, mandatory)
appVersion: "2.5.0"     # ⚠️ ANDAR chal rahi APP ka version (quotes mein!)</pre>
       <table>
         <tr><th></th><th>version</th><th>appVersion</th></tr>
         <tr><td>Kiska version</td><td><b>Chart</b> ka (templates/packaging)</td><td><b>App</b> ka (image tag jaisa)</td></tr>
         <tr><td>Kab badhta hai</td><td>Template/values badle</td><td>App ka naya release</td></tr>
         <tr><td>Rules</td><td>SemVer mandatory, package ka naam isi se</td><td>Kuch bhi (string) — quotes lagao warna 2.10 → 2.1 ban jaayega!</td></tr>
       </table>
       <div class="war-story"><b>⚡ Real galti (har team karti hai):</b> Team ne image tag
       badla par <code>version</code> nahi badhaya. Chart repo mein
       <code>shop-0.1.0.tgz</code> pehle se tha — naya package usi naam se bana, kuch
       systems ne <b>purana cached chart</b> use kiya. Deploy "successful" dikha par
       purana code chalta raha. Ghanton debugging. <b>Rule: chart ka content badla toh
       version BADHAO — hamesha.</b></div>`,
      `<h3>🔁 Chart dev ka loop (yeh ratta maar lo)</h3>
       <pre>helm create shop        # scaffold (pehli baar)
vim shop/templates/...  # badlo

helm lint shop          # 1. syntax/best-practice check (sabse sasta)
helm template shop      # 2. rendered YAML AANKHON se dekho
helm install shop ./shop --dry-run --debug   # 3. server-side validation bhi
helm install shop ./shop                     # 4. asli install</pre>
       <p><b>Kyun yeh order?</b> Har step pichle se mehenga hai. lint 1 second mein
       typo pakad leta hai; dry-run cluster tak jaata hai. <b>Kabhi bhi seedha install
       mat karo</b> — pehle render dekho, warna "ye 40 lines ka YAML kahan se aaya?"
       wala confusion.</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Chart ki File Kahan Jaati Hai?',
        instructions: 'Har cheez ko sahi jagah daalo — chart structure ka test.',
        bins: [
          { id: 'chartyaml', label: '🪪 Chart.yaml' },
          { id: 'values', label: '🎛️ values.yaml' },
          { id: 'templates', label: '🧩 templates/' },
          { id: 'never', label: '🚫 Chart mein NAHI' },
        ],
        items: [
          { text: 'appVersion: "2.5.0"', bin: 'chartyaml', explain: 'Chart ka passport — naam/version/appVersion/dependencies sab Chart.yaml mein.' },
          { text: 'replicaCount: 2 (default)', bin: 'values', explain: 'Default config values.yaml mein — yahi users ka "menu card" hai.' },
          { text: 'deployment.yaml with {{ .Values.replicaCount }}', bin: 'templates', explain: 'Templates folder — render hoke asli manifest banega.' },
          { text: '_helpers.tpl (naming ke shortcuts)', bin: 'templates', explain: 'templates/ mein hi, par underscore ki wajah se render nahi hota — sirf define/include ke liye.' },
          { text: 'DB ka production password', bin: 'never', explain: 'Secrets values.yaml/chart mein KABHI nahi (git mein chala jayega — Track 3 ka sabak!). ESO/Vault se aayega — Level 7 mein.' },
          { text: 'NOTES.txt (install ke baad ka message)', bin: 'templates', explain: 'templates/NOTES.txt — yeh bhi template hai! {{ .Release.Name }} use kar sakta hai.' },
          { text: 'dependencies: [postgresql]', bin: 'chartyaml', explain: 'Helm 3 mein dependencies Chart.yaml mein (Helm 2 mein requirements.yaml thi — purana blog dekho toh confuse mat hona).' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Chart Doctor',
        instructions: 'Ek naya chart likha gaya hai par install se pehle usme galtiyan hain. Dev loop se pakdo!',
        goal: 'Chart <code>./shop</code> mein kuch galat hai. <b>(1)</b> <code>helm lint ./shop</code> chalao, <b>(2)</b> galti samjho, <b>(3)</b> <code>ls</code> se fix file dekho aur apply karo, <b>(4)</b> phir se lint + <code>helm template ./shop</code> se rendered YAML verify karo, <b>(5)</b> install karo.',
        tasks: [
          { text: 'helm lint se galti pakdo', check: s => s.history.some(h => /helm lint/.test(h)) },
          { text: 'Chart fix karo', check: s => s.cluster.charts['./shop'].fixed === true },
          { text: 'helm template se render verify karo', check: s => s.history.some(h => /helm template/.test(h)) },
          { text: 'Install karo (release: shop)', check: s => (s.cluster.releases || []).some(r => r.name === 'shop') },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '5d', version: 'v1.30.2' }],
          pods: [], deployments: [], services: [], releases: [], repos: [],
          charts: {
            './shop': {
              name: 'shop', version: '0.1.0', appVersion: '2.4.0', fixed: false,
              defaults: { replicaCount: 2, image: { repository: 'shop/web', tag: '2.4.0' } },
              valuesYaml: 'replicaCount: 2\nimage:\n  repository: shop/web\n  tag: 2.4.0',
              lint: ['==> Linting ./shop',
                '[ERROR] Chart.yaml: version is required',
                '[WARNING] templates/: file extension \'.tpl\' should be \'_helpers.tpl\' — helpers.tpl RENDER ho jayegi!',
                '',
                'Error: 1 chart(s) linted, 1 chart(s) failed'],
              lintFailed: true,
              render: (v, rel) => `# Source: shop/templates/deployment.yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${rel.name}-shop\nspec:\n  replicas: ${v.replicaCount}\n  template:\n    spec:\n      containers:\n      - name: shop\n        image: ${v.image.repository}:${v.image.tag}`,
              notes: 'Shop chal raha hai! URL: kubectl port-forward svc/{{ .Release.Name }}-shop 8080:80',
              onInstall: (sim, rel) => {
                const n = rel.values.replicaCount || 1;
                sim.cluster.deployments.push({ name: rel.name + '-shop', ready: n + '/' + n, upToDate: n, available: n, age: '3s' });
                for (let i = 0; i < n; i++)
                  sim.cluster.pods.push({ name: `${rel.name}-shop-6f7a8b-p${i}`, ready: '1/1', status: 'Running', restarts: 0, age: '3s', node: 'node-1', ip: '10.244.1.' + (30 + i), logs: '[shop] listening on :8080' });
              },
            },
          },
        },
        files: {
          'fix-chart.yaml': {
            desc: 'Chart.yaml mein version add karta hai + helpers.tpl ko _helpers.tpl rename',
            apply: s => {
              const c = s.cluster.charts['./shop'];
              c.fixed = true; c.lintFailed = false;
              c.lint = ['==> Linting ./shop', '[INFO] Chart.yaml: icon is recommended', '', '1 chart(s) linted, 0 chart(s) failed'];
              return 'Chart.yaml patched (version: 0.1.0 added) + helpers.tpl → _helpers.tpl renamed ✓\n(ab dobara "helm lint ./shop" chalao)';
            },
          },
          'skip-lint-install.yaml': {
            desc: 'Lint skip karke seedha install karne ki koshish',
            apply: () => 'Error: INSTALLATION FAILED: chart metadata (Chart.yaml) is missing "version"\n\n(Lint ne yeh 1 second mein bata diya tha — install ne 20 second baad. Isliye dev loop ka order: lint → template → install!)',
          },
        },
        success: s => s.cluster.charts['./shop'].fixed === true &&
          (s.cluster.releases || []).some(r => r.name === 'shop') &&
          s.history.some(h => /helm template/.test(h)),
        successText: 'Chart theek aur deployed! 🩺 Dev loop ka fayda dekha: <b>lint</b> ne 1 second mein do problems batayi (missing <code>version</code>, aur <code>helpers.tpl</code> jo galti se render ho jaati), <b>template</b> ne render dekhne diya, phir install. Agar seedha install karte toh cryptic error milta. Yaad rakho: <b>lint → template → dry-run → install</b>.',
        hints: [
          'helm lint ./shop — output mein [ERROR] aur [WARNING] dono padho',
          'ls karo — fix-chart.yaml Chart.yaml ki version aur helpers file dono theek karta hai',
          'Fix ke baad: helm lint ./shop (ab pass), helm template ./shop (render dekho), helm install shop ./shop',
        ],
      },
      {
        type: 'quiz',
        title: 'version vs appVersion',
        questions: [
          {
            q: 'Tumne sirf image tag 2.4.0 → 2.5.0 badla (koi template change nahi). Chart.yaml mein kya update karoge?',
            choices: [
              'Dono: appVersion "2.5.0" (app badli) aur version 0.1.1 (chart ka content badla, isliye naya package version)',
              'Sirf appVersion — chart toh waisa hi hai',
              'Sirf version',
              'Kuch nahi — image tag values.yaml mein hai',
            ],
            answer: 0,
            explain: 'War-story yaad karo: chart ka content (default tag bhi content hai!) badla toh version BADHAO, warna cached/duplicate package ka khatra. appVersion app ke liye, version chart ke liye — dono.',
          },
          {
            q: 'appVersion: 2.10 (bina quotes) likha. Problem?',
            choices: [
              'YAML isse NUMBER samjhega → 2.1 ban jayega (trailing zero gayab)! Isliye appVersion hamesha quotes mein: "2.10"',
              'Koi problem nahi',
              'Helm reject kar dega',
              'Version 210 ban jayega',
            ],
            answer: 0,
            explain: 'Classic YAML trap. 2.10 float hai → 2.1. Image tag "2.10" chahiye tha, mila "2.1" → wrong image ya ImagePullBackOff. Quotes = free insurance.',
          },
          {
            q: 'templates/ mein file ka naam "_helpers.tpl" — underscore kyun?',
            choices: [
              'Underscore se shuru hone wali files render/apply NAHI hoti — sirf define/include ke liye partials hoti hain',
              'Sirf convention hai, koi technical matlab nahi',
              'Underscore se file sabse pehle load hoti hai',
              'Helm 2 ki purani zaroorat thi',
            ],
            answer: 0,
            explain: 'Technical rule hai! Bina underscore ke Helm usse manifest samajhkar apply karega → "error validating data: kind not set" jaisa error. Partials = underscore.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Chart Structure',
      instructions: 'Chart authoring ke sawal — practical detail dikhao. 🎤',
      questions: [
        {
          q: '"Chart.yaml mein version aur appVersion ka farak?" (Bahut poocha jaata hai!)',
          choices: [
            'version = CHART ka apna SemVer (templates/values badle toh badhao, package ka naam isi se banta hai); appVersion = andar chal rahi APP ka version (informational, aksar default image tag) — hamesha quotes mein rakho',
            'Dono same hote hain, alias hain',
            'version app ka, appVersion chart ka',
            'appVersion sirf display ke liye hai, koi farak nahi padta',
          ],
          answer: 0,
          explain: 'Farak + "kab badhta hai" + quotes wala gotcha — teeno bolo. Bonus: "chart content badla par version nahi badha toh repo mein duplicate/cached package ka risk hota hai" — real experience ka signal.',
        },
        {
          q: 'Naya chart likha hai, install se pehle tumhara verification flow?',
          choices: [
            'helm lint (sasta syntax/best-practice check) → helm template (rendered YAML aankhon se padho) → helm install --dry-run --debug (server-side validation) → tab install',
            'Seedha install karo, error aaye toh dekhenge',
            'Sirf helm install --dry-run kaafi hai',
            'YAML file manually padh lo, tools ki zaroorat nahi',
          ],
          answer: 0,
          explain: 'Escalating cost ka principle: har step pichle se mehenga par zyada thorough. Bolna mat bhoolo ki template se ACTUAL rendered output dikhta hai — "template + values dono sahi lag rahe the par render kuch aur nikla" bahut common hai.',
        },
        {
          q: 'Team ka shared chart hai — usme kaunsi cheez kabhi commit nahi karni chahiye?',
          choices: [
            'Real secrets (DB passwords, API keys) values.yaml ya templates mein — woh git mein chale jaayenge; secrets ESO/Vault/helm-secrets se aane chahiye',
            'values.yaml — woh har user apna banata hai',
            'NOTES.txt — woh auto-generate hota hai',
            'Chart.yaml ka appVersion',
          ],
          answer: 0,
          explain: 'Track 3 (Secrets) ka gyaan yahan lagta hai. Chart mein secret ka PLACEHOLDER/reference ho (existingSecret: my-secret), value nahi. Yeh awareness security-minded engineer ka signal hai.',
        },
      ],
    },
    success: [
      'Main chart ki har file ka kaam bata sakta hoon (Chart.yaml, values, templates, _helpers, charts/)',
      'Main version vs appVersion ka farak aur quotes wala gotcha jaanta hoon',
      'Main lint → template → dry-run → install ka dev loop follow karta hoon',
      'Main jaanta hoon ki chart mein secrets kabhi nahi jaate',
    ],
    homework: `<p>Apna pehla chart khud banao aur uske andar jhaanko:</p>
      <pre>helm create shop
tree shop                       # ya: find shop -type f
cat shop/Chart.yaml             # version + appVersion dekho
cat shop/templates/_helpers.tpl # naming helpers — abhi samajh na aaye toh theek hai (Level 3!)
helm lint shop
helm template shop | head -60   # rendered YAML — {{ }} gayab, asli values aa gayi!
helm template shop | grep -c "kind:"   # kitne manifests bane?
helm install shop ./shop --dry-run --debug | head -30
rm -rf shop</pre>
      <p>✅ Self-check: <code>helm template</code> ke output mein <code>{{ }}</code> bacha? Nahi na — sab render ho gaya. Yeh output hi cluster mein jaata hai.</p>`,
    cards: [
      { front: 'version vs appVersion (Chart.yaml)?', back: '<b>version</b> = CHART ka SemVer — templates/values badle toh badhao (package naam isi se). <b>appVersion</b> = andar ki APP ka version (aksar default image tag). Hamesha quotes: <code>appVersion: "2.10"</code> warna YAML 2.1 bana dega!' },
      { front: 'templates/ mein underscore file (_helpers.tpl) kyun?', back: 'Underscore se shuru hone wali files <b>render/apply nahi hoti</b> — woh sirf partials hain (define/include ke liye). Bina underscore ke Helm usse manifest samajhkar apply karega → error.' },
      { front: 'Chart dev ka loop?', back: '<code>helm lint</code> (1 sec, syntax) → <code>helm template</code> (rendered YAML aankhon se dekho) → <code>helm install --dry-run --debug</code> (server validation) → <code>helm install</code>. Har step pichle se mehenga — sasta pehle.' },
      { front: 'Chart ki 4 mukhya cheezein?', back: '<b>Chart.yaml</b> (passport: naam/version/appVersion/deps), <b>values.yaml</b> (defaults = menu card), <b>templates/</b> ({{ }} wale manifests + _helpers.tpl + NOTES.txt), <b>charts/</b> (subcharts).' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('helm', [

  /* ================= LEVEL H3: Templating Jaadu ================= */
  {
    id: 'helmtemplating',
    icon: '🪄',
    title: 'Templating Jaadu — Go templates ka khel',
    badge: 'Template Tantrik',
    objectives: [
      'Built-in objects: <code>.Values .Release .Chart .Capabilities .Files</code>',
      'Pipelines aur functions: <code>default quote upper toYaml nindent required</code>',
      'Control flow: <code>if/else</code>, <code>range</code>, <code>with</code>',
      '<b>Whitespace chomping</b> <code>{{- -}}</code> aur named templates (<code>define/include</code>)',
    ],
    lesson: [
      `<h3>🪄 Helm YAML nahi, TEXT banata hai</h3>
       <p>Sabse zaroori baat pehle: <b>Helm ko YAML ki samajh nahi hai.</b> Woh sirf
       Go-template engine chala kar TEXT paida karta hai; phir woh text Kubernetes ko
       bheja jaata hai jo usse YAML ki tarah parse karta hai.</p>
       <p>Isliye <b>indentation aur whitespace</b> tumhari zimmedari hai — yehi Helm ka
       sabse bada dukh aur sabse bada sabak hai.</p>
       <pre>values.yaml:                template:                    render:
replicaCount: 3      +      replicas: {{ .Values.replicaCount }}   →   replicas: 3</pre>
       <h3>📚 Built-in objects (capital letter se shuru!)</h3>
       <table>
         <tr><th>Object</th><th>Kya deta hai</th><th>Example</th></tr>
         <tr><td><code>.Values</code></td><td>values.yaml + -f + --set ka merged data</td><td><code>{{ .Values.image.tag }}</code></td></tr>
         <tr><td><code>.Release</code></td><td>Release ki info</td><td><code>{{ .Release.Name }}</code>, <code>.Namespace</code>, <code>.IsUpgrade</code></td></tr>
         <tr><td><code>.Chart</code></td><td>Chart.yaml ka data</td><td><code>{{ .Chart.AppVersion }}</code></td></tr>
         <tr><td><code>.Capabilities</code></td><td>Cluster kya support karta hai</td><td><code>.Capabilities.APIVersions.Has "batch/v1"</code></td></tr>
         <tr><td><code>.Files</code></td><td>Chart ki non-template files</td><td><code>.Files.Get "config.ini"</code></td></tr>
       </table>`,
      `<h3>🔧 Pipelines — Unix pipe jaisa hi</h3>
       <pre>{{ .Values.name | default "shop" | upper | quote }}
#     value    →  khaali? default  →  BADA  →  "SHOP"

Roz kaam aane wale functions:
  default "x"     # value na ho toh yeh use karo
  quote           # "value" — string ko quote karo (YAML surprises se bacho!)
  upper / lower / trunc 63 / trimSuffix "-"
  toYaml          # object ko YAML text banao
  nindent 8       # newline + 8 spaces indent (YAML ki jaan!)
  required "msg"  # value na ho toh RENDER FAIL karo (message ke saath)
  b64enc          # Secrets ke liye base64</pre>
       <p><b>toYaml + nindent ki jodi</b> — yeh sabse zyada use hoti hai:</p>
       <pre># values.yaml:  resources: { limits: { memory: 512Mi } }
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
# render:
        resources:
          limits:
            memory: 512Mi</pre>
       <p><code>nindent 10</code> = pehle newline daalo, phir har line ko 10 space se
       indent karo. <code>indent</code> newline nahi daalta — isliye 90% cases mein
       <b>nindent</b> chahiye.</p>`,
      `<h3>🎛️ Control flow + whitespace ka khel</h3>
       <pre>{{- if .Values.ingress.enabled }}      # if
apiVersion: networking.k8s.io/v1
kind: Ingress
{{- end }}

{{- range .Values.hosts }}             # loop — andar "." har item ban jaata hai
  - host: {{ . | quote }}
{{- end }}

{{- with .Values.podAnnotations }}     # scope badlo (null ho toh block skip)
annotations:
  {{- toYaml . | nindent 2 }}
{{- end }}</pre>
       <p><b>Whitespace chomping — {{- aur -}}:</b></p>
       <pre>{{- }}   left ka whitespace+newline kha jao
{{ -}}   right ka whitespace+newline kha jao</pre>
       <div class="war-story"><b>⚡ Har Helm beginner ka dard:</b> <code>{{ if }}</code>
       likha bina dash ke — render mein khaali lines reh gayi. Kabhi kabhi YAML phir bhi
       chal jaata hai (khaali line se farak nahi padta), par jab woh khaali line kisi
       <code>list item</code> ke beech aayi toh: <code>error converting YAML to JSON:
       did not find expected key</code>. 3 ghante debugging, fix = ek <code>-</code>.
       <b>Isliye control-flow lines par hamesha <code>{{-</code> lagao</b> — habit bana lo.</div>
       <h3>🧩 Named templates — apne functions</h3>
       <pre># _helpers.tpl mein define karo:
{{- define "shop.fullname" -}}
{{ .Release.Name }}-{{ .Chart.Name }}
{{- end }}

# templates mein use karo:
metadata:
  name: {{ include "shop.fullname" . }}   # "." = poora context pass karo!</pre>
       <p><code>include</code> use karo, <code>template</code> nahi — kyunki
       <code>include</code> ka output pipe kiya ja sakta hai
       (<code>include "x" . | nindent 4</code>), <code>template</code> ka nahi.</p>`,
    ],
    stages: [
      {
        type: 'render',
        title: '🧩 Chart Workbench — render kya hoga?',
        instructions: 'Left mein values, right mein template. Batao Helm kya banayega. (Yehi asli skill hai — render "dekhna" aa jaye toh Helm aasan ho jaata hai.)',
        values: 'replicaCount: 3\nimage:\n  repository: shop/web\n  # tag: (set nahi hai!)\nnameOverride: ""\nresources:\n  limits:\n    memory: 512Mi',
        template: 'metadata:\n  name: {{ .Release.Name }}-shop\nspec:\n  replicas: {{ .Values.replicaCount }}\n  containers:\n  - image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"\n    resources:\n      {{- toYaml .Values.resources | nindent 6 }}',
        file: 'deployment.yaml',
        questions: [
          {
            q: 'Release ka naam <code>shop-prod</code> hai. <code>metadata.name</code> kya render hoga?',
            focus: 'name: {{ .Release.Name }}-shop',
            choices: ['name: shop-prod-shop', 'name: shop-shop', 'name: {{ .Release.Name }}-shop', 'name: shop-prod'],
            answer: 0,
            explain: '<code>.Release.Name</code> = install ke waqt diya naam (shop-prod), phir literal "-shop". Isliye asli charts <code>{{ include "shop.fullname" . }}</code> use karte hain jo yeh naam-jodne ka kaam smartly (63-char truncate ke saath) karta hai.',
          },
          {
            q: 'values mein <code>image.tag</code> set NAHI hai, aur Chart.yaml mein <code>appVersion: "2.4.0"</code> hai. Image line kya banegi?',
            focus: 'image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"',
            choices: ['image: "shop/web:2.4.0"', 'image: "shop/web:"', 'image: "shop/web:latest"', 'Render fail hoga — tag missing hai'],
            answer: 0,
            explain: '<code>default</code> pipeline: tag khaali/missing hai → fallback <code>.Chart.AppVersion</code> = 2.4.0. Yeh THE standard pattern hai — isiliye appVersion ko app ka version rakhna matlab rakhta hai!',
          },
          {
            q: '<code>{{- toYaml .Values.resources | nindent 6 }}</code> ka output?',
            focus: '    resources:\n      {{- toYaml .Values.resources | nindent 6 }}',
            choices: [
              'resources:\n      limits:\n        memory: 512Mi',
              'resources: {limits: {memory: 512Mi}}',
              'resources:\nlimits:\nmemory: 512Mi',
              'resources: 512Mi',
            ],
            answer: 0,
            explain: '<code>toYaml</code> object ko YAML text mein badalta hai, <code>nindent 6</code> newline + 6 spaces ka indent lagata hai har line par. Yeh jodi (toYaml+nindent) har production chart mein milegi — resources, nodeSelector, annotations sab ke liye.',
          },
          {
            q: 'Agar <code>nindent 6</code> ki jagah <code>indent 6</code> likh dein toh?',
            choices: [
              'Newline nahi lagega — output "resources:      limits:" jaisa ek hi line par chipak jayega → YAML parse error',
              'Bilkul same output',
              'Indent 6 ki jagah 7 ho jayega',
              'Helm error dega ki indent invalid hai',
            ],
            answer: 0,
            explain: '<b>n</b>indent = <b>n</b>ewline + indent. Sirf indent karo toh content pichli line se juda rehta hai. Yeh #1 "did not find expected key" ka reason hai. Yaad rakho: block start kar rahe ho toh nindent.',
          },
        ],
      },
      {
        type: 'fill',
        title: 'Template Likho — helpers ke saath',
        instructions: 'Production-style deployment template poora karo.',
        template: '{{- {0} "shop.fullname" -}}\n{{ .Release.Name }}-{{ .Chart.Name }}\n{{- end }}\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {{ {1} "shop.fullname" . }}\nspec:\n  replicas: {{ .Values.replicaCount }}\n  template:\n    spec:\n      containers:\n      - name: shop\n        image: "{{ .Values.image.repo }}:{{ .Values.image.tag | {2} .Chart.AppVersion }}"\n        env:\n        - name: DB_HOST\n          value: {{ .Values.dbHost | {3} "dbHost values.yaml mein zaroori hai!" }}',
        blanks: [
          { answer: 'define', explain: '<code>define</code> se named template banta hai (_helpers.tpl mein). Naam hamesha chart ke naam se prefix karo — subcharts mein clash na ho.' },
          { answer: 'include', explain: '<code>include</code> (na ki template) — kyunki iska output pipe kiya ja sakta hai. Aur "." zaroori hai: poora context pass karna padta hai warna .Release andar dikhega hi nahi!' },
          { answer: 'default', explain: 'tag na ho toh appVersion — classic fallback. (Ulta likhna galti hai: <code>default .Values.image.tag .Chart.AppVersion</code> — pipeline mein value LEFT se aati hai.)' },
          { answer: 'required', explain: '<code>required</code> value missing hone par render hi FAIL kar deta hai, tumhare message ke saath — chup-chaap khaali value se hazaar guna behtar. Zaroori config par hamesha lagao.' },
        ],
        tokens: ['define', 'include', 'default', 'required', 'template', 'range', 'quote', 'optional'],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Templating ke jaal',
        questions: [
          {
            q: '<code>{{ if }}</code> vs <code>{{- if }}</code> — farak?',
            choices: [
              '{{- }} left ka whitespace+newline kha jaata hai — bina iske render mein khaali lines rehti hain jo list items ke beech YAML tod sakti hain',
              'Koi farak nahi, style choice hai',
              '{{- }} tez chalta hai',
              '{{- }} sirf comments ke liye hai',
            ],
            answer: 0,
            explain: 'War-story wala 3-ghante-ka-dard. Control-flow lines ({{- if }}, {{- end }}, {{- range }}) par dash lagana habit bana lo — 99% cases mein wahi chahiye hota hai.',
          },
          {
            q: 'Named template mein <code>{{ include "shop.labels" }}</code> likha (bina "." ke). Kya hoga?',
            choices: [
              'Andar .Values/.Release kuch nahi dikhega (context pass hi nahi hua) — khaali ya galat output',
              'Automatic context mil jaata hai',
              'Syntax error',
              'Sirf .Chart dikhega',
            ],
            answer: 0,
            explain: 'Bahut common galti! <code>include "name" .</code> — woh akela dot poora context (Values/Release/Chart) pass karta hai. Bhool gaye toh chup-chaap khaali output — sabse confusing bug.',
          },
          {
            q: '<code>{{ .Values.podAnnotations }}</code> khaali object hai. Best practice kya hai?',
            choices: [
              '{{- with .Values.podAnnotations }} block use karo — khaali ho toh poora annotations: section skip ho jaayega',
              'Seedha toYaml kar do, khaali chalega',
              'if-else se manually check karo har jagah',
              'Khaali values allow mat karo',
            ],
            answer: 0,
            explain: '<code>with</code> do kaam karta hai: (1) null/khaali par block skip, (2) andar "." ko us value par set kar deta hai. Isse "annotations:" likh ke neeche kuch na hone wala invalid YAML nahi banta.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Templating',
      instructions: 'Yahan practical detail hi sab kuch hai. 🎤',
      questions: [
        {
          q: '"Helm chart render ho gaya par kubectl apply par YAML error aa raha hai — kaise debug karoge?"',
          choices: [
            'helm template se rendered output nikaalo aur AANKHON se padho — 90% cases indentation/whitespace ka hota hai (nindent bhool gaye, ya {{- }} na hone se khaali lines); phir --debug se aur detail',
            'Chart delete karke naya banao',
            'Values file se saari optional values hata do',
            'Kubernetes version upgrade karo',
          ],
          answer: 0,
          explain: 'Core insight bolo: <b>Helm YAML nahi samajhta, text banata hai</b> — isliye indentation bug template ka bug hai. helm template + padhna hi asli debugging hai. "did not find expected key" ≈ whitespace problem.',
        },
        {
          q: '<code>include</code> aur <code>template</code> mein farak — aur tum kaunsa use karte ho?',
          choices: [
            'include ka output pipe ho sakta hai (include "x" . | nindent 4), template ka nahi — isliye hamesha include, khaaskar jab indentation chahiye',
            'template naya hai, include purana',
            'Dono bilkul same hain',
            'template sirf subcharts mein chalta hai',
          ],
          answer: 0,
          explain: 'Chhota par pakka signal ki tumne asli charts likhe hain. Yaad rakhne ka trick: "include = pipe-able".',
        },
        {
          q: 'Zaroori value (jaise dbHost) miss ho jaye toh chart ko kya karna chahiye?',
          choices: [
            'required "dbHost is required" se render FAIL karo — early aur clear error, chup-chaap khaali value se pod baad mein CrashLoop karega',
            'Khaali chhod do, K8s handle kar lega',
            'default "" laga do',
            'Docs mein likh do ki yeh zaroori hai',
          ],
          answer: 0,
          explain: 'Fail fast! Track 1 ka CrashLoop war-story yaad hai (missing DB_HOST)? <code>required</code> usi class ke bugs ko deploy se PEHLE pakad leta hai. Interviewer ko yeh connection batao — pura system dikhai deta hai.',
        },
      ],
    },
    success: [
      'Main .Values/.Release/.Chart objects aur pipelines use kar sakta hoon',
      'Main toYaml+nindent se nested config sahi indent kar sakta hoon',
      'Main if/range/with aur whitespace chomping ({{- -}}) samajhta hoon',
      'Main _helpers.tpl mein named templates likh aur include kar sakta hoon',
    ],
    homework: `<p>Templating khud tod-jod ke seekho — yehi sabse tezi se sikhata hai:</p>
      <pre>helm create lab
# 1) render dekho:
helm template lab | grep -A5 "resources"
# 2) values badal ke asar dekho:
helm template lab --set replicaCount=5 | grep replicas
# 3) JAAN BOOJH KE todo — nindent hata do:
sed -i 's/nindent 12/indent 12/' lab/templates/deployment.yaml
helm template lab            # error dekho! yehi woh classic error hai
sed -i 's/indent 12/nindent 12/' lab/templates/deployment.yaml
# 4) helpers padho — asli production pattern:
cat lab/templates/_helpers.tpl
helm template lab | grep "name:"      # fullname helper ka kaam dekho
rm -rf lab</pre>
      <p>✅ Self-check: indent/nindent wala error khud paida karke dekha? Ab woh error jab production mein aayega, 5 second mein pehchan loge.</p>`,
    cards: [
      { front: 'Helm YAML samajhta hai ya text banata hai?', back: '<b>Sirf TEXT banata hai</b> (Go templates se), phir K8s usse YAML parse karta hai. Isliye indentation/whitespace TUMHARI zimmedari — aur isliye <code>nindent</code> aur <code>{{- -}}</code> itne important hain.' },
      { front: 'toYaml | nindent 6 kya karta hai?', back: 'Object ko YAML text banata hai, phir <b>newline + 6 spaces</b> ka indent har line par. <code>indent</code> newline NAHI daalta → content pichli line se chipak jaata hai → "did not find expected key". Block start karo toh hamesha <b>n</b>indent.' },
      { front: 'include vs template?', back: '<b>include</b> ka output pipe ho sakta hai (<code>include "x" . | nindent 4</code>), template ka nahi. Hamesha include. Aur "<b>.</b>" pass karna mat bhoolo — warna andar .Values/.Release dikhega hi nahi!' },
      { front: '{{- if }} mein dash kyun?', back: 'Left ka whitespace+newline chomp karta hai. Bina dash ke render mein <b>khaali lines</b> reh jaati hain jo list items ke beech aakar YAML tod deti hain. Control-flow lines par hamesha dash — habit bana lo.' },
      { front: 'Zaroori value missing ho toh?', back: '<code>{{ required "dbHost chahiye!" .Values.dbHost }}</code> — render hi FAIL ho, clear message ke saath. Chup-chaap khaali value = baad mein CrashLoopBackOff. Fail fast!' },
    ],
  },

  /* ================= LEVEL H4: Values ka Khel ================= */
  {
    id: 'helmvalues',
    icon: '🎛️',
    title: 'Values ka Khel — precedence aur environments',
    badge: 'Values Vazir',
    objectives: [
      '<b>Precedence chain</b> — kaunsi value kispe jeetti hai',
      'Multiple <code>-f</code> layering (base → env → region)',
      '<code>--set</code> ke gotchas aur <code>--reuse-values</code> ka jaal',
      '<code>values.schema.json</code> se validation — galat config deploy se pehle rukey',
    ],
    lesson: [
      `<h3>🥊 Precedence — kaun kispe jeetta hai</h3>
       <p>Yeh THE most practical Helm knowledge hai. Neeche wala hamesha upar wale ko
       override karta hai:</p>
       <pre>1. chart ki values.yaml (defaults)        ← sabse kamzor
2. parent chart ki values (subchart ke liye — Level 5)
3. -f values-a.yaml
4. -f values-b.yaml                      ← baad wali file jeetti hai
5. --set key=value                       ← 👑 SABSE STRONG</pre>
       <pre># Real production pattern — layering (neeche wali upar wali ko override karti hai):
#   values-common.yaml   → base (sab env ke liye common)
#   values-prod.yaml     → prod ke overrides
#   values-prod-eu.yaml  → region ke overrides
#   --set image.tag      → CI se aata hai (sabse upar)
helm upgrade shop ./shop \\
  -f values-common.yaml \\
  -f values-prod.yaml \\
  -f values-prod-eu.yaml \\
  --set image.tag=$GIT_SHA</pre>
       <p>⚠️ <b>Bash gotcha:</b> <code>\\</code> ke baad usi line par <code># comment</code> mat likho —
       backslash phir newline ko nahi, space ko escape karta hai aur command wahin toot jaati hai.
       Isliye comments upar alag lines mein.</p>
       <p><b>Debugging ka pehla command:</b> <code>helm get values &lt;release&gt;</code> —
       isse dikhta hai ki ASLI mein kya laga (sirf user-supplied). Chart defaults bhi
       chahiye toh <code>--all</code>. "Maine toh prod values di thi!" wale confusion ka
       jawab yahin milta hai.</p>`,
      `<h3>⚠️ Do bade jaal</h3>
       <p><b>Jaal 1: --set agle upgrade mein gayab</b></p>
       <pre>helm install shop ./shop --set replicaCount=10     # rev 1: 10 replicas ✓
helm upgrade shop ./shop -f values-prod.yaml      # rev 2: replicaCount wapas
                                                  #        default (2)! 😱</pre>
       <p>Helm har upgrade par values <b>naye sire se</b> compute karta hai (chart defaults
       + jo tumne AB diya). Purane <code>--set</code> yaad nahi rehte. Isliye production
       mein config <b>files mein</b> rakho (git mein, review ke saath) — <code>--set</code>
       sirf CI ke image tag jaisi ek-do cheezon ke liye.</p>
       <p><b>Jaal 2: --reuse-values</b> — yeh purani values ko base banata hai. Sunne mein
       fix lagta hai, par isse <b>chart ke naye defaults nahi aate</b> (chart upgrade karne
       par naye fields missing reh jaate hain) aur drift ban jaata hai. Aaj kal advice:
       <code>--reuse-values</code> se bacho, poori values file do.</p>
       <div class="war-story"><b>⚡ Real incident:</b> On-call ne 3 AM par
       <code>helm upgrade --set replicaCount=20</code> karke traffic spike sambhala.
       Agle din normal deploy chala (<code>-f values-prod.yaml</code>) —
       <b>replicas wapas 3 ho gaye</b>, site phir se gir gayi. Kisi ko samajh nahi aaya
       ki "humne toh kuch nahi badla". Fix: emergency change bhi <b>values file mein
       commit</b> karo (GitOps ka wahi sabak — Track 3 Level 24!).</div>`,
      `<h3>🛡️ values.schema.json — galat config ko roko</h3>
       <pre>{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["image", "replicaCount"],
  "properties": {
    "replicaCount": { "type": "integer", "minimum": 1, "maximum": 50 },
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": { "repository": { "type": "string" } }
    },
    "service": {
      "properties": { "type": { "enum": ["ClusterIP","NodePort","LoadBalancer"] } }
    }
  }
}</pre>
       <p>Ab <code>--set replicaCount=0</code> ya <code>service.type=Loadbalancer</code>
       (chhota b!) par install/upgrade <b>fail</b> ho jayega — clear message ke saath,
       deploy se PEHLE. Ek shared chart mein yeh file poori team ke liye guard-rail hai.</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Precedence Ladder',
        instructions: 'Sabse KAMZOR se sabse STRONG tak — values ki precedence lagao.',
        steps: [
          { text: 'Chart ki values.yaml (defaults)', explain: 'Chart author ki di hui base config — sabse neeche.' },
          { text: 'Parent chart ki values (subchart ke liye)', explain: 'Umbrella chart apne subcharts ke defaults override karta hai (Level 5 mein detail).' },
          { text: '-f values-base.yaml (pehli file)', explain: 'Command-line se di gayi pehli file.' },
          { text: '-f values-prod.yaml (baad wali file)', explain: 'Files LEFT→RIGHT merge hoti hain — baad wali jeetti hai. Isliye order maayne rakhta hai!' },
          { text: '--set image.tag=2.5', explain: '👑 Sabse strong. Isliye CI ka image tag yahan se aata hai — koi file usse override nahi kar sakti.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Values Detective',
        instructions: 'Production release mein replicas galat hain. Precedence samajh ke fix karo.',
        goal: '<b>shop</b> release prod mein hai par replicas 2 hain, 10 hone chahiye the. <b>(1)</b> <code>helm get values shop</code> se dekho asli mein kya laga hai, <b>(2)</b> <code>helm history shop</code> se samjho kya hua, <b>(3)</b> sahi tarike se fix karo taaki <b>agle upgrade par bhi bacha rahe</b> (values file use karo, --set nahi!).',
        tasks: [
          { text: 'helm get values shop — asli config dekho', check: s => s.history.some(h => /helm get values shop/.test(h)) },
          { text: 'helm history shop — kahani samjho', check: s => s.history.some(h => /helm history shop/.test(h)) },
          { text: 'values FILE se upgrade karo → replicas 10', check: s => { const r = (s.cluster.releases || []).find(x => x.name === 'shop'); return r && r.values.replicaCount === 10 && (r.lastFiles || []).includes('values-prod.yaml'); } },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '60d', version: 'v1.30.2' }],
          pods: [], deployments: [{ name: 'shop-web', ready: '2/2', upToDate: 2, available: 2, age: '1d' }],
          services: [], repos: [],
          valuesFiles: {
            'values-prod.yaml': { replicaCount: 10, image: { tag: '2.4.0' }, resources: { limits: { memory: '1Gi' } } },
            'values-staging.yaml': { replicaCount: 2, image: { tag: '2.4.0' } },
          },
          releases: [{
            name: 'shop', namespace: 'default', chart: 'shop-0.3.0', chartRef: './shop', appVersion: '2.4.0',
            revision: 4, status: 'deployed', updated: '2026-07-18 11:02:00 UTC',
            values: { replicaCount: 2, image: { tag: '2.4.0' } },
            history: [
              { revision: 1, updated: '2026-07-10 09:00:00 UTC', status: 'superseded', chart: 'shop-0.3.0', appVersion: '2.4.0', description: 'Install complete (-f values-prod.yaml)', values: { replicaCount: 10, image: { tag: '2.3.0' } } },
              { revision: 2, updated: '2026-07-14 22:40:00 UTC', status: 'superseded', chart: 'shop-0.3.0', appVersion: '2.4.0', description: 'Upgrade complete (--set replicaCount=20 — traffic spike)', values: { replicaCount: 20, image: { tag: '2.3.0' } } },
              { revision: 3, updated: '2026-07-17 16:15:00 UTC', status: 'superseded', chart: 'shop-0.3.0', appVersion: '2.4.0', description: 'Upgrade complete (-f values-prod.yaml)', values: { replicaCount: 10, image: { tag: '2.4.0' } } },
              { revision: 4, updated: '2026-07-18 11:02:00 UTC', status: 'deployed', chart: 'shop-0.3.0', appVersion: '2.4.0', description: 'Upgrade complete (-f values-staging.yaml — GALAT FILE! 🙈)', values: { replicaCount: 2, image: { tag: '2.4.0' } } },
            ],
            notes: 'Shop is running.',
          }],
          charts: {
            './shop': {
              name: 'shop', version: '0.3.0', appVersion: '2.4.0',
              defaults: { replicaCount: 1, image: { repository: 'shop/web', tag: '2.4.0' } },
              valuesYaml: 'replicaCount: 1\nimage:\n  repository: shop/web\n  tag: 2.4.0',
              render: (v, rel) => `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${rel.name}-web\nspec:\n  replicas: ${v.replicaCount}`,
              onUpgrade: (sim, rel) => {
                const d = sim.cluster.deployments.find(x => x.name === 'shop-web');
                const n = rel.values.replicaCount;
                if (d) { d.ready = n + '/' + n; d.upToDate = n; d.available = n; }
              },
            },
          },
        },
        success: s => {
          const r = (s.cluster.releases || []).find(x => x.name === 'shop');
          return r && r.values.replicaCount === 10 &&
            (r.lastFiles || []).includes('values-prod.yaml') &&   // file se, --set se nahi!
            s.history.some(h => /helm get values shop/.test(h));
        },
        successText: 'Case solved! 🕵️ History ne poori kahani batayi: rev 2 mein kisi ne <code>--set replicaCount=20</code> kiya (traffic spike), rev 3 mein prod file se 10 aaya, aur rev 4 mein galti se <b>values-staging.yaml</b> laga di → replicas 2. Do sabak: <b>(1)</b> <code>helm history</code> har release ki diary hai — description padho, <b>(2)</b> config hamesha <b>files</b> se (git mein, review hoke) — <code>--set</code> se kiya change agle upgrade mein gayab ho jaata hai.',
        hints: [
          'helm get values shop → dikhega replicaCount: 2 (staging wali values!)',
          'helm history shop → har revision ka description padho — rev 4 mein galat file lagi thi',
          'Fix: helm upgrade shop ./shop -f values-prod.yaml  (file se, --set se nahi!)',
        ],
      },
      {
        type: 'quiz',
        title: 'Precedence & Schema',
        questions: [
          {
            q: '<code>helm upgrade shop ./shop -f base.yaml -f prod.yaml --set replicaCount=5</code> — base mein 2, prod mein 10. Final replicas?',
            choices: ['5 — --set sabse strong hai', '10 — baad wali file jeetti hai', '2 — pehli file base hoti hai', '17 — sab jud jaate hain'],
            answer: 0,
            explain: 'Ladder yaad karo: defaults < -f (left→right) < --set. Files mein prod (10) ne base (2) ko haraya, phir --set (5) ne dono ko. CI se image tag isliye --set se dete hain — koi file usse badal nahi sakti.',
          },
          {
            q: 'Pichle upgrade mein <code>--set debug=true</code> diya tha. Aaj sirf <code>-f values-prod.yaml</code> se upgrade kiya. debug ab?',
            choices: [
              'Gayab — false/default ho gaya; Helm har upgrade par values naye sire se banata hai',
              'true hi rahega — Helm purani values yaad rakhta hai',
              'Error aayega ki debug missing hai',
              'true rahega par warning aayegi',
            ],
            answer: 0,
            explain: 'THE gotcha (war-story wala 3 AM incident). Har upgrade = fresh computation. --reuse-values isse "fix" karta hai par woh apni problem laata hai (naye chart defaults nahi aate). Sahi tarika: sab kuch values file mein.',
          },
          {
            q: 'values.schema.json ka sabse bada fayda?',
            choices: [
              'Galat config (replicaCount: 0, typo wala service.type) install/upgrade se PEHLE fail karti hai, clear message ke saath — team ke liye guard-rail',
              'Chart ko fast banata hai',
              'Values file automatically bana deta hai',
              'Secrets ko encrypt karta hai',
            ],
            answer: 0,
            explain: 'Shift-left validation: broken YAML cluster tak pahunchne se pehle ruk jaati hai. Shared/platform charts mein yeh must hai — warna har team apne tarike se galti karegi.',
          },
        ],
      },
      {
        type: 'render',
        bonus: true,
        title: '🎁 Good to Know — Merge kaise hota hai',
        instructions: 'Bonus: values merge deep hota hai ya replace? Dekho.',
        values: '# chart values.yaml (defaults):\nimage:\n  repository: shop/web\n  tag: "2.4.0"\n  pullPolicy: IfNotPresent\nresources:\n  limits:\n    memory: 512Mi\nhosts:\n  - shop.com\n  - www.shop.com',
        template: '# user ne diya:\n#   -f my.yaml  jisme:\n#\n#   image:\n#     tag: "2.5.0"\n#   hosts:\n#     - beta.shop.com',
        file: 'merge-behaviour',
        questions: [
          {
            q: 'Final <code>image</code> object kya banega?',
            choices: [
              'repository: shop/web, tag: 2.5.0, pullPolicy: IfNotPresent — maps DEEP merge hote hain',
              'sirf tag: 2.5.0 — poora image object replace ho jata hai',
              'Error — repository missing hai',
              'tag: "2.4.0" — default jeetta hai',
            ],
            answer: 0,
            explain: 'Maps (objects) <b>deep merge</b> hote hain — tumne sirf tag diya, baaki keys defaults se aa gayi. Isliye chhoti values file likhna kaafi hota hai.',
          },
          {
            q: 'Final <code>hosts</code> list kya banegi?',
            choices: [
              '[beta.shop.com] — LISTS replace hoti hain, merge NAHI',
              '[shop.com, www.shop.com, beta.shop.com] — jud jaati hain',
              '[shop.com] — default jeetta hai',
              'Error — list conflict',
            ],
            answer: 0,
            explain: '⚠️ Bada gotcha: <b>maps merge hote hain, arrays REPLACE</b>. Ek host add karna ho toh poori list dobara likhni padegi. Isliye kai charts list ki jagah map use karte hain (jaise <code>hosts: {main: {...}}</code>).',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Values',
      instructions: 'Roz ke kaam ke sawal — yahan experience jhalakta hai. 🎤',
      questions: [
        {
          q: '"Values ki precedence order batao" — poora chain?',
          choices: [
            'chart values.yaml (defaults) < parent chart ki values (subcharts ke liye) < -f files (left→right) < --set / --set-string — neeche wala hamesha jeetta hai',
            '--set sabse kamzor, values.yaml sabse strong',
            'Sab merge hoke average nikalta hai',
            'Jo alphabetically baad mein aaye woh jeetta hai',
          ],
          answer: 0,
          explain: 'Poora chain bolo (subchart wala step bhi!). Aur practical line jodo: "debug karne ke liye <code>helm get values</code> chalata hoon — usse pata chalta hai asli mein kya laga."',
        },
        {
          q: 'Team ka rule kya hona chahiye — --set ya values files?',
          choices: [
            'Config values FILES mein (git mein, PR review, reproducible); --set sirf CI se aane wali dynamic cheez (image tag/git SHA) ke liye — kyunki --set agle upgrade par gayab ho jaata hai',
            '--set hi use karo, files bekar hain',
            'Dono barabar hain, jo aasan lage',
            'Sirf --set production mein, files dev mein',
          ],
          answer: 0,
          explain: 'Yeh sawal reproducibility ka hai. War-story sunao (3 AM --set → agle deploy par gayab → outage). Aur GitOps se jodo: "config git mein honi chahiye, command history mein nahi".',
        },
        {
          q: 'User ne <code>-f my.yaml</code> mein sirf <code>image.tag</code> diya. Baaki image fields (repository, pullPolicy) ka kya hoga?',
          choices: [
            'Defaults se aa jayenge — maps DEEP merge hote hain (par arrays/lists REPLACE hoti hain, woh gotcha yaad rakhna)',
            'Sab gayab ho jayenge — poora object replace hota hai',
            'Error aayega',
            'pullPolicy default "Always" ho jayegi',
          ],
          answer: 0,
          explain: 'Deep-merge for maps, replace for arrays — yeh ek line poore Helm values model ko cover karti hai. Array wala exception bolna hi seniority dikhata hai.',
        },
      ],
    },
    success: [
      'Main poori precedence chain bata sakta hoon aur debug ke liye helm get values use karta hoon',
      'Main multi-file layering (base → env → region) set kar sakta hoon',
      'Main --set ke gayab hone wale gotcha se bach sakta hoon',
      'Main values.schema.json se team ke liye guard-rails bana sakta hoon',
    ],
    homework: `<p>Precedence khud dekho — yeh 5 min ka experiment sab clear kar dega:</p>
      <pre>helm create lab
echo "replicaCount: 7" > base.yaml
echo "replicaCount: 9" > over.yaml

helm template lab -f base.yaml | grep replicas:                    # 7
helm template lab -f base.yaml -f over.yaml | grep replicas:       # 9 (baad wali file)
helm template lab -f base.yaml -f over.yaml --set replicaCount=99 | grep replicas:   # 99 (--set 👑)

# --set ka gayab hona:
helm install lab ./lab --set replicaCount=5
helm get values lab                    # replicaCount: 5
helm upgrade lab ./lab -f base.yaml
helm get values lab                    # ab replicaCount: 7 — 5 GAYAB! 😱
helm uninstall lab; rm -rf lab base.yaml over.yaml</pre>
      <p>✅ Self-check: --set wali value upgrade ke baad gayab hote dekhi? Ab yeh galti kabhi nahi karoge.</p>`,
    cards: [
      { front: 'Values precedence (kamzor → strong)?', back: '1) chart values.yaml → 2) parent chart ki values (subcharts) → 3) <code>-f</code> files (left→right, baad wali jeetti) → 4) <b><code>--set</code></b> 👑. Debug: <code>helm get values &lt;release&gt;</code>.' },
      { front: '--set ka bada gotcha?', back: 'Agle <code>helm upgrade</code> par woh value <b>GAYAB</b> — Helm har upgrade par values naye sire se banata hai. Isliye config <b>files</b> mein (git+review); --set sirf CI ke image tag jaisi cheez ke liye.' },
      { front: 'Values merge: maps vs arrays?', back: '<b>Maps DEEP merge</b> hote hain (sirf tag do, baaki defaults se aa jayenge). <b>Arrays REPLACE</b> hoti hain (ek host add karna ho toh poori list dobara likho). Yeh exception yaad rakho!' },
      { front: 'values.schema.json kya deta hai?', back: 'Values ka <b>JSON-schema validation</b> — galat config (replicaCount: 0, typo wala service.type) install se PEHLE fail. Shared/platform charts mein team ke liye guard-rail.' },
      { front: '--reuse-values kyun avoid karte hain?', back: 'Purani values base ban jaati hain par <b>chart ke naye defaults nahi aate</b> → chart upgrade par naye fields missing, drift. Better: poori values file har baar do.' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('helm', [

  /* ================= LEVEL H5: Dependencies & Umbrella ================= */
  {
    id: 'helmdeps',
    icon: '🧩',
    title: 'Dependencies & Umbrella Charts',
    badge: 'Umbrella Ustaad',
    objectives: [
      'Chart.yaml dependencies + <code>helm dependency update</code> + <b>Chart.lock</b>',
      'Subchart values kaise override karte hain (naam ke neeche!)',
      '<b>global values</b> — sab charts ko ek saath kuch dena',
      '<code>condition</code>/<code>tags</code> se subchart on-off, aur <b>library charts</b>',
    ],
    lesson: [
      `<h3>☂️ Umbrella chart — ek command, poori app</h3>
       <p>Microservices: web + api + worker + postgres + redis. Har ek ka apna chart?
       5 <code>helm install</code>, 5 alag versions, 5 jagah config. Dukh.</p>
       <p><b>Umbrella (parent) chart</b> in sabko ek chart bana deta hai:</p>
       <pre># shop/Chart.yaml
apiVersion: v2
name: shop
version: 1.0.0
dependencies:
  - name: web
    version: "0.3.x"                    # SemVer range chalega
    repository: "file://../web"          # local path
  - name: postgresql
    version: "13.2.24"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled        # on/off switch
  - name: redis
    version: "18.6.1"
    repository: "https://charts.bitnami.com/bitnami"
    tags: [ cache ]                      # group on/off
    alias: sessioncache                  # doosre naam se use karo</pre>
       <pre>helm dependency update ./shop   # subcharts → charts/ mein .tgz + Chart.lock bane
helm dependency list ./shop     # status: ok / missing
helm install shop ./shop        # sab ek saath! 🎉</pre>
       <p><b>Chart.lock</b> = package-lock.json jaisa — exact versions pin karta hai
       taaki teammate ke paas bhi wahi subchart versions aayein. <b>Commit karo isse.</b></p>`,
      `<h3>🎛️ Subchart ki values kaise set karein</h3>
       <p>Parent ki values.yaml mein subchart ka <b>naam</b> ek key ban jaata hai:</p>
       <pre># shop/values.yaml (parent)
replicaCount: 2            # yeh PARENT ke apne templates ke liye

web:                       # ← "web" subchart ki values
  replicaCount: 5
  image:
    tag: "2.5.0"

postgresql:                # ← subchart ka naam (ya alias)
  enabled: true            # condition isi ko dekhta hai
  auth:
    database: shopdb

global:                    # ← SAB charts ko dikhta hai (parent + har subchart)
  environment: production
  imageRegistry: registry.company.com</pre>
       <p><b>global</b> hi ek tareeka hai jisse subcharts aapas mein kuch share kar sakte
       hain (registry, environment, storageClass). Baaki har subchart apne island mein hai.</p>
       <div class="war-story"><b>⚡ Real galti:</b> Team ne parent values mein seedha
       <code>image: {tag: "2.5"}</code> likha, soch ke ki web subchart ko mil jayega.
       Nahi mila — woh PARENT ki value ban gayi, subchart ne apna default use kiya.
       Deploy "successful", par purana image chala. <b>Rule: subchart ki har value uske
       NAAM ke neeche nest karo.</b> Verify: <code>helm template ./shop | grep image:</code></div>`,
      `<h3>📚 Library charts — sirf helpers, install nahi</h3>
       <pre># common/Chart.yaml
type: library        # ← install NAHI hota, sirf templates share karta hai

# common/templates/_labels.tpl
{{- define "common.labels" -}}
app.kubernetes.io/managed-by: {{ .Release.Service }}
env: {{ .Values.global.environment | default "dev" }}
{{- end }}

# har service chart isse dependency ki tarah leta hai aur:
metadata:
  labels: {{- include "common.labels" . | nindent 4 }}</pre>
       <p>15 microservices, ek jagah labels/naming/security-context ka standard —
       fix ek jagah, sab jagah lagta hai (Track 3 ka DRY war-story yaad hai?).</p>`,
    ],
    stages: [
      {
        type: 'fill',
        title: 'Umbrella Chart Likho',
        instructions: 'shop umbrella chart ka Chart.yaml + values.yaml poora karo.',
        template: '# shop/Chart.yaml\napiVersion: v2\nname: shop\nversion: 1.0.0\n{0}:\n  - name: postgresql\n    version: "13.2.24"\n    repository: "https://charts.bitnami.com/bitnami"\n    {1}: postgresql.enabled\n---\n# shop/values.yaml\n{2}:                    # ← subchart ka naam = uski values ka key\n  enabled: true\n  auth:\n    database: shopdb\n\n{3}:                    # ← yeh SAB charts (parent + subcharts) ko dikhta hai\n  environment: production\n  imageRegistry: registry.company.com',
        blanks: [
          { answer: 'dependencies', explain: 'Helm 3 mein Chart.yaml ke andar (Helm 2 ki requirements.yaml purani baat hai).' },
          { answer: 'condition', explain: '<code>condition: postgresql.enabled</code> — us value ke true/false se subchart install hoga ya skip. Prod mein managed RDS use karna ho? enabled: false.' },
          { answer: 'postgresql', explain: 'Subchart ki values uske NAAM ke neeche nest hoti hain (alias diya ho toh alias ke neeche). War-story wali galti yahin hoti hai!' },
          { answer: 'global', explain: '<code>global</code> ek special key hai jo parent + har subchart ko dikhti hai — registry, environment, storageClass share karne ka ekmatra saaf tarika.' },
        ],
        tokens: ['dependencies', 'condition', 'postgresql', 'global', 'requirements', 'tags', 'database', 'shared'],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Umbrella Assembly',
        instructions: 'Umbrella chart install karna hai — par pehle dependencies laani padengi.',
        goal: '<code>./shop</code> umbrella chart hai jisme <b>web</b> aur <b>postgresql</b> subcharts hain. <b>(1)</b> <code>helm dependency list ./shop</code> se status dekho, <b>(2)</b> seedha install try karo (fail hoga — kyun?), <b>(3)</b> <code>helm dependency update ./shop</code>, <b>(4)</b> install karo <code>-f values-prod.yaml</code> ke saath, <b>(5)</b> <code>helm template</code> ya <code>kubectl get pods</code> se verify karo ki web ke <b>5</b> replicas hain aur postgres SKIP hua hai.',
        tasks: [
          { text: 'dependency list — status dekho (missing?)', check: s => s.history.some(h => /helm dep(endency)? (list|ls)/.test(h)) },
          { text: 'dependency update — subcharts laao', check: s => s.cluster.charts['./shop']._depsBuilt === true },
          { text: 'Install with -f values-prod.yaml', check: s => (s.cluster.releases || []).some(r => r.name === 'shop' && (r.lastFiles || []).includes('values-prod.yaml')) },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '20d', version: 'v1.30.2' }],
          pods: [], deployments: [], services: [], releases: [],
          repos: [{ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }],
          valuesFiles: {
            'values-prod.yaml': {
              global: { environment: 'production' },
              web: { replicaCount: 5, image: { tag: '2.5.0' } },
              postgresql: { enabled: false },   // prod mein managed RDS
            },
          },
          charts: {
            './shop': {
              name: 'shop', version: '1.0.0', appVersion: '2.5.0',
              needsDeps: true,
              deps: [
                { name: 'web', version: '0.3.2', repository: 'file://../web' },
                { name: 'postgresql', version: '13.2.24', repository: 'https://charts.bitnami.com/bitnami', condition: 'postgresql.enabled' },
              ],
              defaults: { web: { replicaCount: 2, image: { tag: '2.4.0' } }, postgresql: { enabled: true } },
              valuesYaml: 'web:\n  replicaCount: 2\n  image:\n    tag: "2.4.0"\npostgresql:\n  enabled: true\nglobal:\n  environment: dev',
              render: (v, rel) => {
                let out = `# Source: shop/charts/web/templates/deployment.yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${rel.name}-web\n  labels:\n    env: ${(v.global && v.global.environment) || 'dev'}\nspec:\n  replicas: ${v.web.replicaCount}\n  template:\n    spec:\n      containers:\n      - image: shop/web:${v.web.image.tag}`;
                if (v.postgresql && v.postgresql.enabled)
                  out += `\n---\n# Source: shop/charts/postgresql/templates/statefulset.yaml\nkind: StatefulSet\nmetadata:\n  name: ${rel.name}-postgresql`;
                else
                  out += `\n\n# (postgresql SKIP — condition postgresql.enabled = false)`;
                return out;
              },
              notes: 'Shop umbrella deployed. Subcharts: web' + '',
              onInstall: (sim, rel) => {
                const n = rel.values.web.replicaCount;
                sim.cluster.deployments.push({ name: rel.name + '-web', ready: n + '/' + n, upToDate: n, available: n, age: '4s' });
                for (let i = 0; i < n; i++)
                  sim.cluster.pods.push({ name: `${rel.name}-web-8c9d-${i}`, ready: '1/1', status: 'Running', restarts: 0, age: '4s', node: 'node-1', ip: '10.244.1.' + (40 + i), logs: '[web] up' });
                if (rel.values.postgresql && rel.values.postgresql.enabled)
                  sim.cluster.pods.push({ name: rel.name + '-postgresql-0', ready: '1/1', status: 'Running', restarts: 0, age: '4s', node: 'node-1', ip: '10.244.1.60', logs: 'database ready' });
              },
            },
          },
        },
        success: s => {
          const r = (s.cluster.releases || []).find(x => x.name === 'shop');
          return r && s.cluster.charts['./shop']._depsBuilt === true &&
            (r.lastFiles || []).includes('values-prod.yaml') &&
            r.values.web.replicaCount === 5 &&
            r.values.postgresql.enabled === false;
        },
        successText: 'Umbrella deployed! ☂️ Teen cheezein sikhi: <b>(1)</b> <code>dependency update</code> ke bina install fail hota hai ("missing in charts/ directory") — subcharts pehle laane padte hain (+ Chart.lock banti hai, usse commit karo), <b>(2)</b> subchart ki values uske <b>naam ke neeche</b> jaati hain (<code>web.replicaCount: 5</code>), <b>(3)</b> <code>condition: postgresql.enabled</code> false hone se poora postgres subchart SKIP ho gaya — prod mein managed RDS ka classic pattern. <code>helm template</code> se yeh confirm bhi kiya ja sakta hai.',
        hints: [
          'helm dependency list ./shop → status "missing" dikhega',
          'Seedha install karke dekho — error batayega ki charts/ mein subcharts nahi hain. Phir: helm dependency update ./shop',
          'helm install shop ./shop -f values-prod.yaml — phir helm template ./shop -f values-prod.yaml se dekho postgres skip hua ya nahi',
        ],
      },
      {
        type: 'quiz',
        bonus: true,
        title: 'Good to Know — Subchart ke rules',
        questions: [
          {
            q: 'Parent values mein <code>image: {tag: "2.5"}</code> likha, chahte the ki web subchart ko mile. Kya hoga?',
            choices: [
              'Subchart ko NAHI milega — woh parent ki apni value ban gayi; subchart ke liye "web:" ke neeche nest karna padta hai',
              'Subchart ko mil jayega automatically',
              'Error aayega',
              'Dono ko mil jayega',
            ],
            answer: 0,
            explain: 'War-story wali galti. Har subchart apne naam ke scope mein rehta hai. Verify karne ka tarika: <code>helm template ./parent | grep image:</code> — aankhon se dekho.',
          },
          {
            q: 'Do subcharts ko same registry chahiye. Sabse saaf tarika?',
            choices: [
              'global.imageRegistry — global values parent aur SAB subcharts ko dikhti hain',
              'Har subchart mein alag-alag likho',
              'Environment variable se',
              'Subcharts ke beech values share ho hi nahi sakti',
            ],
            answer: 0,
            explain: '<code>global</code> hi cross-chart sharing ka official raasta hai. Bitnami charts isse heavily use karte hain (global.imageRegistry, global.storageClass). Baaki har subchart isolated hai.',
          },
          {
            q: 'Chart.lock file ka kaam?',
            choices: [
              'Dependencies ke EXACT versions pin karti hai (package-lock.json jaisa) — sabke paas same subchart versions aayein; isse git mein commit karo',
              'Chart ko read-only bana deti hai',
              'Concurrent installs rokti hai',
              'Values ko lock karti hai',
            ],
            answer: 0,
            explain: '<code>version: "0.3.x"</code> range likhi hai toh alag-alag time par alag versions aa sakte hain — lock file wahi problem rokti hai. "Mere laptop par chal raha tha" ka ilaaj.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — Dependencies',
      instructions: 'Multi-service architecture ke sawal. 🎤',
      questions: [
        {
          q: '"5 microservices hain — ek umbrella chart ya har service ka apna chart?" Kya bologe?',
          choices: [
            'Depends: umbrella tab jab sab ek saath deploy/version hote hain (tightly coupled, ek release train); alag charts tab jab teams independently deploy karti hain — aksar best: har service ka apna chart + shared LIBRARY chart standards ke liye',
            'Hamesha umbrella — ek command better hai',
            'Hamesha alag charts',
            'Helm microservices ke liye bana hi nahi hai',
          ],
          answer: 0,
          explain: 'Trade-off dikhao: umbrella = atomic release + ek jagah config, par ek service ka chhota change poore stack ko re-deploy karta hai aur teams block hoti hain. Library chart wala jawab senior-level hai.',
        },
        {
          q: 'Subchart (postgresql) ko dev mein chahiye, prod mein managed RDS use karna hai. Kaise?',
          choices: [
            'Chart.yaml mein condition: postgresql.enabled, aur values-prod.yaml mein postgresql.enabled: false — poora subchart render hi nahi hoga',
            'Prod ke liye alag umbrella chart banao',
            'Prod mein install ke baad manually delete kar do',
            'Possible nahi hai',
          ],
          answer: 0,
          explain: 'condition/tags exactly isi liye hain. Ek chart, dono environments — 12-factor ka wahi principle (Track 1 Level 7). Bonus: "tags se ek saath multiple subcharts on/off kar sakte hain".',
        },
        {
          q: 'helm dependency update kab chalana padta hai aur kya banta hai?',
          choices: [
            'Jab Chart.yaml ki dependencies badlein (ya pehli baar) — subcharts .tgz banke charts/ mein aate hain aur Chart.lock (exact versions) banti/update hoti hai; bina iske install "missing in charts/ directory" se fail hota hai',
            'Har install se pehle zaroori hai',
            'Sirf tab jab subchart ka code badle',
            'Woh cluster se subcharts download karta hai',
          ],
          answer: 0,
          explain: 'Practical detail: CI mein yeh step aksar bhoola jaata hai → pipeline fail. Lock file commit karne ki baat bhi karo — reproducibility.',
        },
      ],
    },
    success: [
      'Main umbrella chart ki dependencies (+ lock file) manage kar sakta hoon',
      'Main subchart values sahi nesting ke saath override kar sakta hoon',
      'Main global values aur condition/tags ka use jaanta hoon',
      'Main library charts se team-wide standards share kar sakta hoon',
    ],
    homework: `<p>Umbrella chart khud banao — dependency ka asar dekho:</p>
      <pre>helm create parent
mkdir -p parent/charts
helm create parent/charts/child          # local subchart (dependency update ki bhi zaroorat nahi)
# parent/values.yaml mein add karo:
cat &gt;&gt; parent/values.yaml &lt;&lt;'EOF'
child:
  replicaCount: 7
global:
  environment: production
EOF
helm template parent | grep -B3 "replicas:"   # dono charts ke deployments dikhenge!
# ab GALAT tarika try karo (nesting ke bina):
helm template parent --set replicaCount=99 | grep replicas:   # sirf parent ka badla, child ka nahi!
helm template parent --set child.replicaCount=99 | grep replicas:  # ab child ka badla ✓
rm -rf parent</pre>
      <p>✅ Self-check: nesting ke bina child ki value nahi badli? Yehi war-story wali galti hai — ab tumne khud dekh li.</p>`,
    cards: [
      { front: 'Subchart ki values kahan likhte hain?', back: 'Parent values.yaml mein <b>subchart ke NAAM (ya alias) ke neeche</b>: <code>web:\\n  replicaCount: 5</code>. Seedha likhoge toh woh parent ki value banegi, subchart ko milegi hi nahi — silent bug!' },
      { front: 'global values kya hain?', back: 'Special <code>global:</code> key jo <b>parent + har subchart</b> ko dikhti hai — registry, environment, storageClass share karne ka ekmatra saaf tarika. Baaki har subchart isolated scope mein hai.' },
      { front: 'helm dependency update kya karta hai?', back: 'Subcharts ko <code>charts/</code> mein <b>.tgz</b> ke roop mein laata hai + <b>Chart.lock</b> (exact versions) banata hai. Bina iske install fail: "missing in charts/ directory". Lock file git mein commit karo.' },
      { front: 'Dev mein postgres subchart, prod mein managed RDS — kaise?', back: 'Chart.yaml mein <code>condition: postgresql.enabled</code>, aur values-prod mein <code>postgresql.enabled: false</code> → poora subchart render hi nahi hota. Ek chart, dono env.' },
      { front: 'Library chart kya hai?', back: '<code>type: library</code> — install NAHI hota, sirf named templates (labels, naming, securityContext) share karta hai. 15 services ka standard ek jagah — fix ek baar, lage sab jagah.' },
    ],
  },

  /* ================= LEVEL H6: Hooks, Tests & Lifecycle ================= */
  {
    id: 'helmhooks',
    icon: '🪝',
    title: 'Hooks, Tests & Stuck Releases',
    badge: 'Lifecycle Lohar',
    objectives: [
      'Hooks: <code>pre-install</code>, <code>post-upgrade</code>, weight, delete-policy',
      '<code>helm test</code> — chart ke apne smoke tests',
      '<code>--atomic --wait --timeout</code> — production upgrade ka safety net',
      '<b>Stuck release</b> ("another operation in progress") aur CRD gotchas se nikalna',
    ],
    lesson: [
      `<h3>🪝 Hooks — install ke beech mein apna kaam ghusao</h3>
       <p>DB migration deploy se PEHLE chalni chahiye. Cache warm-up deploy ke BAAD.
       Yeh "beech ke steps" hooks se hote hain — bas ek annotation:</p>
       <pre>apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-migrate
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install      # kab chale
    "helm.sh/hook-weight": "-5"                  # order (chhota pehle)
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded</pre>
       <table>
         <tr><th>Hook</th><th>Kab</th><th>Typical use</th></tr>
         <tr><td><code>pre-install</code> / <code>pre-upgrade</code></td><td>Manifests apply hone se PEHLE</td><td>DB migration, backup lena</td></tr>
         <tr><td><code>post-install</code> / <code>post-upgrade</code></td><td>Sab apply hone ke BAAD</td><td>Seed data, cache warm, Slack notify</td></tr>
         <tr><td><code>pre-delete</code> / <code>post-delete</code></td><td>Uninstall ke aas-paas</td><td>Final backup, external cleanup</td></tr>
         <tr><td><code>test</code></td><td>Sirf <code>helm test</code> par</td><td>Smoke test — "app sach mein kaam kar rahi?"</td></tr>
       </table>
       <p><b>hook-delete-policy</b> zaroori hai: <code>before-hook-creation</code> (purana
       Job hatao warna "already exists" error) + <code>hook-succeeded</code> (pass hone par
       safai). Fail hua Job jaan-boojh ke chhodo — logs chahiye honge!</p>`,
      `<h3>🧪 helm test — chart ka apna smoke test</h3>
       <pre># templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ .Release.Name }}-test"
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
  - name: curl
    image: curlimages/curl
    args: ['-sf', 'http://{{ .Release.Name }}-web/healthz']

# chalao:
helm test shop        # pod chalta hai; exit 0 = PASS</pre>
       <p>Deploy ke baad "sach mein kaam kar raha hai?" ka automated jawab — CI mein
       <code>helm upgrade --wait && helm test</code> ek acchi gate hai.</p>
       <h3>🛡️ Production upgrade ka safety kit</h3>
       <pre># Helm 4:
helm upgrade shop ./shop -f values-prod.yaml \\
  --rollback-on-failure \\
  --timeout 5m

# Helm 3 (wahi cheez, purana naam):
helm upgrade shop ./shop -f values-prod.yaml --atomic --timeout 5m</pre>
       <ul>
         <li><code>--rollback-on-failure</code> (Helm 3 mein <code>--atomic</code>) — fail hua toh <b>khud rollback</b>; <code>--wait</code> apne-aap lag jaata hai</li>
         <li><code>--timeout 5m</code> — kitna intezaar (default 5m), uske baad "fail" maana jaayega</li>
         <li>Helm 4 mein <code>--atomic</code> ab bhi chalta hai par warning deta hai:
           <code>Flag --atomic has been deprecated, use --rollback-on-failure instead</code></li>
       </ul>
       <p>Yeh flag = insurance. Iske bina fail hone par release
       <code>failed</code> status mein latka rehta hai aur aadha-adhoora state cluster
       mein reh jaata hai.</p>
       <div class="war-story"><b>🆕 Helm 4 (Nov 2025 se GA) — kya badla?</b> Helm 3 ab sirf security
       fixes le raha hai (10 Feb 2027 tak). Roz ke commands wahi hain; farak yeh hain:
       <ul>
         <li><code>--atomic</code> → <code>--rollback-on-failure</code>, <code>--force</code> → <code>--force-replace</code> (purane naam warning ke saath chalte hain); <code>--recreate-pods</code> hat gaya</li>
         <li>Naye install <b>server-side apply</b> se hote hain (<code>--server-side</code> default); purane Helm 3 releases upgrade par apna purana tareeka hi rakhte hain (<code>auto</code>)</li>
         <li><code>--wait</code> ab kstatus "watcher" use karta hai — chart ke resources par <code>list</code> + <code>watch</code> RBAC chahiye</li>
         <li><code>--post-renderer</code> ab sirf plugin ka naam leta hai (seedha script path nahi)</li>
       </ul>
       CRDs wala jaal (neeche) Helm 4 mein bhi waisa hi hai. (KubeGurukul ne yeh sab Helm 4.0.4 par chala ke check kiya.)</div>`,
      `<h3>🚑 Jab cheezein atak jaati hain (asli dukh)</h3>
       <pre>Error: UPGRADE FAILED: another operation (install/upgrade/rollback)
       is in progress</pre>
       <p><b>Matlab:</b> release <code>pending-upgrade</code>/<code>pending-install</code>
       mein atki hai — pichla operation beech mein mar gaya (CI timeout, laptop band,
       network). Helm ka "lock" laga reh gaya.</p>
       <pre># Ilaaj:
helm history shop                    # kaunsa revision pending hai dekho
helm rollback shop &lt;last-good-rev&gt;   # aksar isse hi nikal jaata hai
# ya (agar kabhi deploy hi na hua ho): helm uninstall shop</pre>
       <div class="war-story"><b>⚡ Real incident (CRD wala, sabse mehenga):</b> Team ne
       cert-manager chart upgrade kiya. Chart ke <code>crds/</code> folder mein CRDs the.
       <b>Helm (3 aur 4 dono) CRDs ko install par banata hai par upgrade par CHHOOTA NAHI</b> — naye
       fields wali CRD kabhi apply hi nahi hui. Naye Certificate resources "unknown field"
       se reject hone lage. Ghanton confusion. <b>Rule: CRD upgrades manually karo
       (<code>kubectl apply -f crds/</code>) — Helm par bharosa mat karo.</b> Yeh
       interview mein bhi poocha jaata hai!</div>
       <p><b>Ek aur classic:</b> <code>field is immutable</code> — Deployment ka
       <code>selector</code> ya Service ka <code>clusterIP</code> badal diya. Helm rollback
       bhi nahi bachaayega; woh resource delete karke banana padta hai (planned downtime).</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Upgrade ke waqt kya-kya chalta hai',
        instructions: '<code>helm upgrade</code> (hooks wale chart par) ka poora sequence lagao.',
        steps: [
          { text: 'pre-upgrade hooks chalte hain (weight ke order mein) — jaise DB migration Job', explain: 'Manifests apply hone se PEHLE. Hook fail = upgrade wahin ruk jaata hai (aur naye manifests apply hi nahi hote).' },
          { text: 'Helm rendered manifests cluster par apply karta hai (3-way merge)', explain: 'Purani manifest + live state + nayi manifest ka merge — isliye kisi aur ke kiye manual change ko Helm smartly handle karta hai.' },
          { text: '--wait ho toh resources ready hone ka intezaar', explain: 'Pods Ready, Deployments available. Yahin --timeout ka hisaab chalta hai.' },
          { text: 'post-upgrade hooks chalte hain — cache warm / notify', explain: 'Sab apply hone ke baad ka kaam.' },
          { text: 'Release status "deployed", naya revision history mein', explain: 'Ab helm history mein woh revision dikhega. Fail hota (bina --atomic) toh status "failed" hota.' },
          { text: 'helm test se smoke test (manually ya CI se)', explain: 'test hook wale pods chalte hain — "sach mein kaam kar raha hai?" ka jawab.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Stuck Release Rescue',
        instructions: 'Raat ka CI job beech mein mar gaya. Ab koi upgrade nahi ho raha. On-call tum ho.',
        goal: 'Release <b>shop</b> par upgrade chalana hai par error aa raha hai. <b>(1)</b> Upgrade try karo aur error padho, <b>(2)</b> <code>helm history shop</code> se samjho kaunsa revision atka hai, <b>(3)</b> <code>helm rollback</code> se release ko unstick karo, <b>(4)</b> ab sahi tarike se upgrade karo — <b>--rollback-on-failure ke saath</b> (Helm 3 mein: <code>--atomic</code>; image tag 2.6.0).',
        tasks: [
          { text: 'history se pending revision dhundo', check: s => s.history.some(h => /helm history shop/.test(h)) },
          { text: 'rollback se release unstick karo', check: s => { const r = (s.cluster.releases || []).find(x => x.name === 'shop'); return r && r.status === 'deployed'; } },
          { text: '--rollback-on-failure (ya --atomic) ke saath upgrade (tag 2.6.0)', check: s => { const r = (s.cluster.releases || []).find(x => x.name === 'shop'); return r && r.values.image && r.values.image.tag === '2.6.0' && r.status === 'deployed'; } },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '90d', version: 'v1.30.2' }],
          pods: [{ name: 'shop-web-5f6a-aa', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.244.1.70', logs: '[shop 2.5.0] serving' }],
          deployments: [{ name: 'shop-web', ready: '1/1', upToDate: 1, available: 1, age: '6d' }],
          services: [], repos: [],
          valuesFiles: { 'values-prod.yaml': { image: { tag: '2.6.0' }, replicaCount: 1 } },
          releases: [{
            name: 'shop', namespace: 'default', chart: 'shop-0.4.0', chartRef: './shop', appVersion: '2.5.0',
            revision: 8, status: 'pending-upgrade', updated: '2026-07-19 02:14:00 UTC',
            values: { image: { tag: '2.6.0' }, replicaCount: 1 },
            history: [
              { revision: 6, updated: '2026-07-12 10:00:00 UTC', status: 'superseded', chart: 'shop-0.4.0', appVersion: '2.4.0', description: 'Upgrade complete', values: { image: { tag: '2.4.0' }, replicaCount: 1 } },
              { revision: 7, updated: '2026-07-13 11:30:00 UTC', status: 'deployed', chart: 'shop-0.4.0', appVersion: '2.5.0', description: 'Upgrade complete', values: { image: { tag: '2.5.0' }, replicaCount: 1 } },
              { revision: 8, updated: '2026-07-19 02:14:00 UTC', status: 'pending-upgrade', chart: 'shop-0.4.0', appVersion: '2.6.0', description: 'Preparing upgrade (CI job killed 💀)', values: { image: { tag: '2.6.0' }, replicaCount: 1 } },
            ],
            notes: 'Shop is running.',
          }],
          charts: {
            './shop': {
              name: 'shop', version: '0.4.0', appVersion: '2.6.0',
              defaults: { image: { repository: 'shop/web', tag: '2.5.0' }, replicaCount: 1 },
              valuesYaml: 'image:\n  repository: shop/web\n  tag: "2.5.0"\nreplicaCount: 1',
              render: (v, rel) => `kind: Deployment\nmetadata:\n  name: ${rel.name}-web\nspec:\n  replicas: ${v.replicaCount}\n  template:\n    spec:\n      containers:\n      - image: ${v.image.repository}:${v.image.tag}`,
              onUpgrade: (sim, rel) => {
                const p = sim.cluster.pods[0];
                if (p) p.logs = `[shop ${rel.values.image.tag}] serving`;
              },
              onRollback: (sim, rel, target) => {
                const p = sim.cluster.pods[0];
                if (p) p.logs = `[shop ${(target.values.image || {}).tag}] serving (rolled back)`;
              },
            },
          },
        },
        success: s => {
          const r = (s.cluster.releases || []).find(x => x.name === 'shop');
          return r && r.status === 'deployed' && r.values.image && r.values.image.tag === '2.6.0' &&
            s.history.some(h => /helm history shop/.test(h)) &&
            s.history.some(h => /helm rollback shop/.test(h)) &&
            s.history.some(h => /helm upgrade shop.*(--atomic|--rollback-on-failure)/.test(h));
        },
        successText: 'Release rescued! 🚑 Yeh sequence har Helm engineer ko aana chahiye: <b>"another operation in progress"</b> → <code>helm history</code> (kaunsa revision <b>pending-upgrade</b> mein atka hai) → <code>helm rollback</code> (lock hatao, last-good par jao) → phir <b>--rollback-on-failure</b> (Helm 3: <code>--atomic</code>) ke saath dobara upgrade. Aur dhyan do: rollback ne bhi <b>naya revision</b> banaya — Helm history kabhi peeche nahi jaati, hamesha aage badhti hai.',
        hints: [
          'Pehle upgrade try karo: helm upgrade shop ./shop -f values-prod.yaml → error padho',
          'helm history shop → revision 8 "pending-upgrade" mein atka hai (CI raat ko mar gaya tha)',
          'helm rollback shop 7 → phir: helm upgrade shop ./shop -f values-prod.yaml --rollback-on-failure   (Helm 3: --atomic)',
        ],
      },
      {
        type: 'incident',
        title: '🚨 CRD Upgrade ka Dhoka',
        instructions: 'War-story wala CRD incident — ab tum solve karo.',
        pager: '<b>ALERT:</b> cert-manager upgrade ke baad naye Certificate resources reject ho rahe hain · "unknown field spec.privateKey.rotationPolicy" · TLS renewals ruk gaye',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: '$ helm list -n cert-manager\nNAME          REVISION  STATUS    CHART               APP VERSION\ncert-manager  4         deployed  cert-manager-1.14.2  v1.14.2\n\n$ kubectl apply -f new-cert.yaml\nerror: error validating "new-cert.yaml": ValidationError(Certificate.spec.privateKey):\n  unknown field "rotationPolicy"',
            text: 'Helm upgrade "deployed" dikha raha hai, chart v1.14.2 hai — par naya CRD field pehchana hi nahi jaa raha. Pehla shak?',
            choices: [
              { t: 'CRDs upgrade hue hi nahi — Helm 3 chart ke crds/ folder ko install par banata hai par UPGRADE par chhoota nahi', good: true, next: 'n2', explain: 'Bilkul! Yeh Helm 3 ka jaana-maana design decision hai (CRD delete/upgrade khatarnak hota hai — data chala jaata hai). Isliye purani CRD hi cluster mein padi hai.' },
              { t: 'Chart version galat hai — dobara upgrade karo', good: false, explain: 'Chart toh sahi v1.14.2 hai (helm list confirm kar raha hai). Dobara upgrade karne se CRDs phir bhi nahi badlenge — same result, time waste.' },
              { t: 'Kubernetes version purana hai, cluster upgrade karo', good: false, explain: 'Error CRD schema ka hai, K8s API ka nahi — "unknown field" ka matlab CRD mein woh field defined hi nahi. Cluster upgrade = bada risk, galat direction.' },
            ],
          },
          n2: {
            sitrep: '$ kubectl get crd certificates.cert-manager.io -o jsonpath="{.metadata.annotations}"\n{"controller-gen.kubebuilder.io/version":"v0.12.0"}   ← purani (chart mein v0.14 hai)',
            text: 'Confirm: CRD purani hai. Ab sahi fix kya hai?',
            choices: [
              { t: 'Chart ke crds/ folder se CRDs manually apply karo (kubectl apply -f), phir verify — aur is step ko upgrade runbook mein likho', good: true, next: 'n3', explain: 'Yehi official tarika hai: CRDs ka lifecycle Helm ke bahar manage karo. Har cert-manager/Prometheus upgrade ke docs mein yeh step likha hota hai — log padhte nahi. 😄' },
              { t: 'helm uninstall + helm install — fresh CRDs aa jayengi', good: false, explain: '😱 Uninstall se saare Certificates/Issuers DELETE ho jaayenge — poore cluster ke TLS certs gayab. Cure worse than disease!' },
              { t: 'CRD delete karke helm upgrade dobara chalao', good: false, explain: 'CRD delete = us kind ke SAARE resources delete (cascading!). Saare Certificates chale jaayenge. CRD kabhi casually delete mat karo.' },
            ],
          },
          n3: {
            sitrep: '$ kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.2/cert-manager.crds.yaml\ncustomresourcedefinition.apiextensions.k8s.io/certificates.cert-manager.io configured\n\n$ kubectl apply -f new-cert.yaml\ncertificate.cert-manager.io/shop-tls created ✓',
            text: 'Fix ho gaya. Aage se yeh na ho, iske liye kya karoge?',
            choices: [
              { t: 'Upgrade runbook/CI mein CRD-apply step add karo (chart upgrade se pehle), aur release notes padhne ko process banao — CRD changes hamesha wahan likhi hoti hain', good: true, next: 'end', explain: 'Process fix > memory fix. CI mein: kubectl apply -f crds/ → phir helm upgrade. Aur "CRD version" ko monitor karna bhi accha idea hai.' },
              { t: 'Kuch nahi — ab pata chal gaya, yaad rahega', good: false, explain: '6 mahine baad, dusra engineer, wahi incident. Jo cheez sirf "yaad" par tiki hai woh process nahi hai — Track 3 ka wahi sabak.' },
              { t: 'cert-manager hata ke manual certs use karo', good: false, explain: 'Ek chart ke ek gotcha ki wajah se poora automation chhodna? Manual certs = expiry incidents (jo Level 25 mein padha tha). Overreaction.' },
            ],
          },
          end: {
            end: true,
            text: 'CRD mystery solved. 🧯',
            summary: '<b>Yaad rakho:</b> Helm 3 CRDs ko <code>crds/</code> se sirf INSTALL par banata hai — <b>upgrade par touch nahi karta</b> (jaan-boojh ke, kyunki CRD delete = saare custom resources delete). Isliye har operator/chart upgrade mein CRDs manually apply karna runbook ka step hona chahiye. Yeh interview ka bhi favourite sawal hai!',
          },
        },
      },
    ],
    interview: {
      title: 'Interview Round — Lifecycle & Troubleshooting',
      instructions: 'Yeh round asli production experience test karta hai. 🎤',
      questions: [
        {
          q: '"Error: another operation (install/upgrade/rollback) is in progress" — kya karoge?',
          choices: [
            'Release pending-* status mein atki hai (pichla operation beech mein mara). helm history se pending revision dekho → helm rollback &lt;last-good&gt; se unstick karo (ya kabhi deploy hi na hua ho toh helm uninstall) → phir --atomic ke saath dobara',
            'Cluster restart karo',
            'Helm reinstall karo',
            'Kuch der wait karo, apne aap theek ho jayega',
          ],
          answer: 0,
          explain: 'Bahut common real-world situation (CI timeout se hota hai). Diagnosis + fix + prevention (--atomic --timeout) teeno bolo — tab pata chalta hai ki tumne yeh sach mein bhugta hai.',
        },
        {
          q: '"Helm 3 CRDs ko kaise handle karta hai?" (Favourite gotcha question!)',
          choices: [
            'crds/ folder ki CRDs sirf INSTALL par banti hain — upgrade/rollback par Helm unhe chhoota nahi (kyunki CRD delete = saare custom resources delete). Isliye CRD upgrades manually (kubectl apply -f crds/) ya operator ke docs ke hisaab se karne padte hain',
            'Helm CRDs ko baaki manifests ki tarah manage karta hai',
            'Helm CRDs support hi nahi karta',
            'CRDs har upgrade par automatically replace hoti hain',
          ],
          answer: 0,
          explain: 'Design ka REASON bolna important hai (safety — CRD delete cascading hai). War-story bhi sunao: purani CRD → naye fields reject → "unknown field" errors.',
        },
        {
          q: 'Production upgrade mein tum kaunse flags lagate ho aur kyun?',
          choices: [
            '--atomic (fail par khud rollback — aadha-adhoora state nahi bachta) + --timeout (kitna intezaar) ; aur deploy ke baad helm test se smoke test',
            '--force --no-hooks — jaldi ho jaata hai',
            'Koi flag nahi, default theek hai',
            '--dry-run production mein',
          ],
          answer: 0,
          explain: '--atomic = insurance. Ulta bhi bolo: <code>--force</code> se bacho (woh resources delete/recreate kar sakta hai = downtime), aur <code>--no-hooks</code> se migrations skip ho jaayengi. Kya NAHI karna, yeh bhi expertise hai.',
        },
      ],
    },
    success: [
      'Main hooks (pre/post, weight, delete-policy) se deploy-time kaam automate kar sakta hoon',
      'Main helm test se deploy ke baad smoke test chala sakta hoon',
      'Main stuck release ko history → rollback se recover kar sakta hoon',
      'Main CRD upgrade gotcha aur immutable-field errors handle kar sakta hoon',
    ],
    homework: `<p>Hook aur atomic ko live dekho:</p>
      <pre>helm create hooklab
# ek pre-install hook Job add karo:
cat &gt; hooklab/templates/migrate-job.yaml &lt;&lt;'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: busybox
        command: ["sh","-c","echo 'running migration...'; sleep 5; echo done"]
EOF
helm install hooklab ./hooklab
kubectl get jobs                      # hook Job dikha? (succeeded hone par delete ho jayega)
helm test hooklab                     # built-in test-connection hook chalega

# ab --atomic ka jaadu — jaan boojh ke kharab image:
helm upgrade hooklab ./hooklab --set image.tag=nahi-hai --atomic --timeout 60s
helm history hooklab                  # dekho: failed revision + AUTO rollback wala revision!
helm uninstall hooklab; rm -rf hooklab</pre>
      <p>✅ Self-check: history mein "Rollback to ..." wala revision khud bana? Yehi --atomic ka insurance hai.</p>`,
    cards: [
      { front: 'Helm hooks ke 4 mukhya types?', back: '<b>pre-install/pre-upgrade</b> (manifests se pehle — DB migration), <b>post-install/post-upgrade</b> (baad mein — seed/notify), <b>pre/post-delete</b>, <b>test</b> (<code>helm test</code> par). Annotations: hook, hook-weight (order), hook-delete-policy (safai).' },
      { front: '"another operation in progress" error ka ilaaj?', back: 'Release <b>pending-upgrade/pending-install</b> mein atki hai (CI/laptop beech mein mara). <code>helm history</code> → <code>helm rollback &lt;last-good&gt;</code> → phir <code>--atomic</code> ke saath dobara upgrade.' },
      { front: 'Helm 3 aur CRDs — THE gotcha?', back: '<code>crds/</code> folder ki CRDs <b>sirf install par</b> banti hain; upgrade/rollback par Helm unhe <b>chhoota nahi</b> (CRD delete = saare CRs delete, isliye safe-by-default). CRD upgrade <b>manually</b> karo: <code>kubectl apply -f crds/</code>.' },
      { front: 'Production upgrade ke flags?', back: '<code>--atomic</code> (fail = auto rollback, aadha state nahi bachta) + <code>--timeout 5m</code>, phir <code>helm test</code>. BACHO: <code>--force</code> (delete/recreate = downtime) aur <code>--no-hooks</code> (migrations skip!).' },
      { front: 'hook-delete-policy kyun chahiye?', back: '<code>before-hook-creation</code> = purana hook Job hatao (warna "already exists" error), <code>hook-succeeded</code> = pass hone par safai. <b>Fail hue Job ko chhodo</b> — uske logs chahiye honge!' },
    ],
  },

]);

/* ===================================================================== */
KG.registerLevels('helm', [

  /* ================= LEVEL H7: BOSS — Ship It ================= */
  {
    id: 'helmship',
    icon: '🐉',
    title: 'BOSS: Ship It — Publish, GitOps & Secrets',
    badge: 'Helm Hakim',
    objectives: [
      '<code>package</code> → chart repo / <b>OCI registry</b> (modern way) → consume',
      'Helm + <b>ArgoCD</b> — GitOps mein chart kaise chalta hai',
      'Helm ke saath <b>secrets</b> — kya karo, kya bilkul nahi',
      'Boss: poora release pipeline chalao + final interview',
    ],
    lesson: [
      `<h3>📦 Chart ship karna — package se registry tak</h3>
       <pre>helm lint ./shop                     # 1. saaf hai?
helm package ./shop                  # 2. shop-0.4.0.tgz bana (version se naam!)

# Purana tarika: chart repo (index.yaml + tgz files kisi HTTP server par)
helm repo index . --url https://charts.company.com

# Modern tarika (Helm 3.8+): OCI registry — wahi jagah jahan images rehti hain!
helm registry login registry.company.com
helm push shop-0.4.0.tgz oci://registry.company.com/charts
helm install shop oci://registry.company.com/charts/shop --version 0.4.0</pre>
       <p><b>OCI kyun jeet raha hai:</b> alag chart-server maintain karne ki zaroorat nahi
       (ECR/GHCR/Harbor pehle se hai), wahi auth/RBAC jo images ke liye hai, aur signing/
       provenance ka same ecosystem. Naye setups mein default yahi hona chahiye.</p>
       <p>⚠️ <b>Version discipline (Level 2 ka war-story):</b> package ka naam
       <code>version</code> se banta hai. Content badla par version nahi badhaya = wahi
       naam, purana cached chart, "deploy hua par kuch nahi badla" wala bhoot. 👻</p>`,
      `<h3>🔄 Helm + ArgoCD — GitOps mein Helm</h3>
       <pre># ArgoCD Application (Track 3 Level 24 yaad hai?)
spec:
  source:
    repoURL: https://github.com/company/shop-charts
    path: charts/shop
    targetRevision: main
    helm:
      valueFiles: [ values-prod.yaml ]
      parameters:
        - name: image.tag
          value: "2.6.0"</pre>
       <p><b>Bahut zaroori samajhne wali baat:</b> ArgoCD <code>helm install</code> NAHI
       chalata — woh chart ko <b>render</b> karta hai (<code>helm template</code> jaisa)
       aur rendered manifests apply karta hai.</p>
       <table>
         <tr><th></th><th>helm install (CLI)</th><th>ArgoCD + Helm</th></tr>
         <tr><td>Release kahan</td><td>Cluster ke Secrets mein (sh.helm.release.*)</td><td><b>Koi Helm release nahi!</b> ArgoCD Application hi truth hai</td></tr>
         <tr><td><code>helm list</code></td><td>Dikhega</td><td><b>Khaali</b> — confuse mat hona!</td></tr>
         <tr><td>Rollback</td><td><code>helm rollback</code></td><td><b>git revert</b> (+ sync)</td></tr>
         <tr><td>Hooks</td><td>Helm hooks chalte hain</td><td>Argo hooks ki tarah treat karta hai (sync phases)</td></tr>
       </table>
       <div class="war-story"><b>⚡ Real confusion:</b> Team ne ArgoCD adopt kiya. Naya
       engineer debugging ke liye <code>helm list</code> chalata hai — <b>khaali</b>.
       "App toh chal rahi hai, release kahan gaya?!" 30 minute barbaad. Jawab: GitOps mein
       Helm sirf <b>template engine</b> hai, release manager ArgoCD hai. Truth git mein
       hai — <code>argocd app get shop</code> dekho, <code>helm list</code> nahi.</div>`,
      `<h3>🔐 Helm aur secrets — teen raaste</h3>
       <table>
         <tr><th>Tarika</th><th>Kaisa hai</th></tr>
         <tr><td>❌ values.yaml mein plain secret</td><td><b>Kabhi nahi</b> — git mein chala jayega (Track 3 ka leak war-story)</td></tr>
         <tr><td>✅ <b>existingSecret</b> pattern</td><td>Chart sirf Secret ka NAAM leta hai; Secret ESO/Vault se banta hai — <b>best practice</b></td></tr>
         <tr><td>🟡 helm-secrets (SOPS)</td><td>Values file encrypted git mein; decrypt deploy ke waqt. Chalta hai, par key management ka jhanjhat</td></tr>
       </table>
       <pre># Chart ka sahi design (Track 3 ke ESO se milata hua):
# values.yaml
db:
  existingSecret: shop-db-creds      # sirf NAAM — value nahi!
  secretKey: password

# template:
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.db.existingSecret }}
      key: {{ .Values.db.secretKey }}</pre>
       <p>Ab woh Secret ExternalSecret (ESO) se banta hai — Vault se sync, rotate hota hai,
       aur git mein sirf <b>reference</b> jaata hai. Helm + ESO = clean separation.</p>`,
    ],
    stages: [
      {
        type: 'terminal',
        title: '🖥️ Boss Round 1: Full Release Pipeline',
        instructions: 'Chart ko zero se ship karo — lint se registry tak, jaise asli release day.',
        goal: 'Poora pipeline: <b>(1)</b> <code>helm lint ./shop</code>, <b>(2)</b> <code>helm template ./shop -f values-prod.yaml</code> se render verify, <b>(3)</b> <code>helm package ./shop</code>, <b>(4)</b> <code>helm push shop-0.5.0.tgz oci://registry.company.com/charts</code>, <b>(5)</b> registry se install karke prove karo: <code>helm install shop oci://registry.company.com/charts/shop</code> — aur <code>helm list</code> se verify.',
        tasks: [
          { text: 'lint + template (verify before ship)', check: s => s.history.some(h => /helm lint/.test(h)) && s.history.some(h => /helm template/.test(h)) },
          { text: 'package → .tgz bana', check: s => (s.cluster.packages || []).length > 0 },
          { text: 'push to OCI registry', check: s => (s.cluster.pushed || []).length > 0 },
          { text: 'registry se install + verify', check: s => (s.cluster.releases || []).some(r => r.name === 'shop') && s.history.some(h => /^helm (list|ls)/.test(h)) },
        ],
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '120d', version: 'v1.30.2' }],
          pods: [], deployments: [], services: [], releases: [], repos: [], packages: [], pushed: [],
          valuesFiles: { 'values-prod.yaml': { replicaCount: 4, image: { tag: '2.6.0' }, db: { existingSecret: 'shop-db-creds' } } },
          charts: {
            './shop': {
              name: 'shop', version: '0.5.0', appVersion: '2.6.0',
              defaults: { replicaCount: 2, image: { repository: 'shop/web', tag: '2.6.0' }, db: { existingSecret: 'shop-db-creds', secretKey: 'password' } },
              valuesYaml: 'replicaCount: 2\nimage:\n  repository: shop/web\n  tag: "2.6.0"\ndb:\n  existingSecret: shop-db-creds   # sirf NAAM — password yahan NAHI!\n  secretKey: password',
              lint: ['==> Linting ./shop', '[INFO] Chart.yaml: icon is recommended', '', '1 chart(s) linted, 0 chart(s) failed'],
              render: (v, rel) => `kind: Deployment\nmetadata:\n  name: ${rel.name}-web\nspec:\n  replicas: ${v.replicaCount}\n  template:\n    spec:\n      containers:\n      - image: ${v.image.repository}:${v.image.tag}\n        env:\n        - name: DB_PASSWORD\n          valueFrom:\n            secretKeyRef:\n              name: ${v.db.existingSecret}     # ✓ sirf reference — value ESO se aayegi\n              key: ${v.db.secretKey}`,
              notes: 'Shop shipped from OCI registry 🎉',
              onInstall: (sim, rel) => {
                const n = rel.values.replicaCount || 1;
                sim.cluster.deployments.push({ name: rel.name + '-web', ready: n + '/' + n, upToDate: n, available: n, age: '2s' });
                for (let i = 0; i < n; i++)
                  sim.cluster.pods.push({ name: `${rel.name}-web-9a8b-${i}`, ready: '1/1', status: 'Running', restarts: 0, age: '2s', node: 'node-1', ip: '10.244.1.' + (80 + i), logs: '[shop 2.6.0] serving' });
              },
            },
            'oci://registry.company.com/charts/shop': {
              name: 'shop', version: '0.5.0', appVersion: '2.6.0',
              defaults: { replicaCount: 2, image: { repository: 'shop/web', tag: '2.6.0' }, db: { existingSecret: 'shop-db-creds', secretKey: 'password' } },
              valuesYaml: 'replicaCount: 2\nimage:\n  tag: "2.6.0"',
              render: (v, rel) => `kind: Deployment\nmetadata:\n  name: ${rel.name}-web\nspec:\n  replicas: ${v.replicaCount}`,
              notes: 'Shop shipped from OCI registry 🎉',
              onInstall: (sim, rel) => {
                const n = rel.values.replicaCount || 1;
                sim.cluster.deployments.push({ name: rel.name + '-web', ready: n + '/' + n, upToDate: n, available: n, age: '2s' });
                for (let i = 0; i < n; i++)
                  sim.cluster.pods.push({ name: `${rel.name}-web-9a8b-${i}`, ready: '1/1', status: 'Running', restarts: 0, age: '2s', node: 'node-1', ip: '10.244.1.' + (80 + i), logs: '[shop 2.6.0] serving' });
              },
            },
          },
        },
        success: s => (s.cluster.pushed || []).length > 0 && (s.cluster.releases || []).some(r => r.name === 'shop') &&
          s.history.some(h => /helm lint/.test(h)) && s.history.some(h => /helm template/.test(h)) &&
          s.history.some(h => /^helm (list|ls)/.test(h)),
        successText: 'CHART SHIPPED! 🚢 Tumne poora release pipeline chalaya: <b>lint</b> (saaf hai?) → <b>template</b> (render verify — dekha? DB password nahi, sirf <code>secretKeyRef</code> ka reference hai ✓) → <b>package</b> (version se naam bana: shop-<b>0.5.0</b>.tgz) → <b>push</b> to OCI registry → <b>install from registry</b> → verify. Yehi flow har company mein chalta hai (bas CI mein automated).',
        hints: [
          'helm lint ./shop → phir helm template ./shop -f values-prod.yaml (render mein secret ka reference dekho)',
          'helm package ./shop → shop-0.5.0.tgz banega (naam version se aata hai!)',
          'helm push shop-0.5.0.tgz oci://registry.company.com/charts → phir: helm install shop oci://registry.company.com/charts/shop → helm list',
        ],
      },
      {
        type: 'bins',
        title: 'Boss Round 2: Helm CLI ya GitOps?',
        instructions: 'Team ArgoCD use karti hai. Har situation ke liye sahi jagah chuno — yeh confusion bahut common hai!',
        bins: [
          { id: 'git', label: '📚 Git mein change (ArgoCD sync)' },
          { id: 'helm', label: '⛵ Helm CLI directly' },
          { id: 'never', label: '🚫 Kabhi nahi' },
        ],
        items: [
          { text: 'Prod mein image tag 2.6.0 karna', bin: 'git', explain: 'GitOps: values-prod.yaml mein tag badlo, PR merge → ArgoCD sync. Audit + review + rollback (git revert) free.' },
          { text: 'Local laptop par chart test karna (helm template/lint)', bin: 'helm', explain: 'Development loop hamesha CLI se — lint/template/dry-run. Yeh cluster ko chhoota hi nahi.' },
          { text: 'Prod mein "jaldi" replicas badhana kubectl/helm se', bin: 'never', explain: 'Drift! Agla ArgoCD sync usse mita dega (Track 3 ka drift war-story). Emergency bhi git se — fast-track PR.' },
          { text: 'DB password values.yaml mein daalna', bin: 'never', explain: 'Git mein secret = leak. existingSecret pattern + ESO/Vault. Yeh galti career mein ek baar hi karni chahiye — kisi aur ki. 😄' },
          { text: 'Naya chart version registry mein push karna', bin: 'helm', explain: 'package + push CLI/CI ka kaam hai. ArgoCD phir us version ko git se reference karega.' },
          { text: 'Prod release ko pichle version par le jaana', bin: 'git', explain: 'GitOps mein rollback = <b>git revert</b> + sync (helm rollback nahi — wahan release hi nahi hai!).' },
        ],
      },
      {
        type: 'quiz',
        title: 'Boss Round 3: Speed Round',
        instructions: 'Poore track ka rapid-fire. Ab yeh sab reflex hona chahiye!',
        questions: [
          { q: 'Values precedence mein sabse strong kaun?', choices: ['--set', 'chart ki values.yaml', 'pehli -f file', 'Chart.yaml'], answer: 0, explain: 'defaults < -f (left→right) < --set 👑. Aur --set agle upgrade par gayab ho jaata hai!' },
          { q: 'toYaml ke saath indent ki jagah nindent kyun?', choices: ['nindent newline + indent dono karta hai — bina newline ke content pichli line se chipak jaata hai', 'nindent tez hai', 'indent deprecated hai', 'Koi farak nahi'], answer: 0, explain: '"did not find expected key" ka #1 reason. Block start kar rahe ho toh nindent.' },
          { q: 'helm upgrade fail hone par cluster aadha-adhoora na rahe — kaunsa flag?', choices: ['--atomic', '--force', '--no-hooks', '--dry-run'], answer: 0, explain: '--atomic = fail par auto rollback. --force khatarnak hai (delete/recreate), --no-hooks migrations skip kar dega.' },
          { q: 'ArgoCD wale cluster mein "helm list" khaali hai — kyun?', choices: ['ArgoCD chart RENDER karke apply karta hai — koi Helm release banti hi nahi; truth git/Application mein hai', 'Helm crash ho gaya', 'Galat namespace', 'Release delete ho gayi'], answer: 0, explain: 'GitOps mein Helm = template engine, ArgoCD = release manager. 30 minute bachao apne aap ka. 😄' },
          { q: 'Chart ka content badla — Chart.yaml mein kya karna ZAROORI hai?', choices: ['version badhao (package ka naam usi se banta hai)', 'sirf appVersion badhao', 'kuch nahi', 'description update karo'], answer: 0, explain: 'Warna wahi package naam, purana cached chart, "deploy hua par kuch nahi badla" wala bhoot. 👻' },
        ],
      },
    ],
    interview: {
      title: '🎤 FINAL Interview — Helm Mastery',
      instructions: 'Helm ka aakhri round. Yeh clear = tum production Helm confidently sambhal sakte ho.',
      questions: [
        {
          q: '"Apni company mein Helm kaise organize karoge?" — ek platform engineer ka jawab?',
          choices: [
            'Har service ka apna chart + ek shared LIBRARY chart (labels/naming/security standards); values files per-env git mein; charts OCI registry mein versioned; deploy GitOps (ArgoCD) se; secrets sirf existingSecret + ESO; CI mein lint/template/schema validation',
            'Ek bada umbrella chart jisme sab services hon',
            'Har developer apna chart apne tarike se banaye',
            'Charts ki zaroorat nahi, plain YAML kaafi hai',
          ],
          answer: 0,
          explain: 'Yeh poore track ka synthesis hai: independence (per-service charts) + standards (library chart) + reproducibility (versioned OCI + git values) + security (ESO) + guard-rails (CI validation). Har hissa ek level tha.',
        },
        {
          q: '"Deploy successful dikha par cluster mein purana version chal raha hai" — Helm-specific top suspects?',
          choices: [
            '(1) Chart version nahi badhaya → purana cached chart use hua, (2) values precedence — --set/file ne image.tag override kar diya (helm get values se check), (3) GitOps setup hai toh ArgoCD ne abhi sync hi nahi kiya',
            'Kubernetes ka bug hai',
            'Image registry down hai',
            'Helm hamesha 5 minute late deploy karta hai',
          ],
          answer: 0,
          explain: 'Teeno suspects alag levels se aaye (version discipline, precedence, GitOps). Debug command bhi bolo: <code>helm get values</code> + <code>helm get manifest</code> — asli mein cluster mein KYA gaya, woh yahin dikhta hai.',
        },
        {
          q: 'Junior poochta hai: "Helm ki jagah sirf Kustomize use kar lein?" Tumhara balanced jawab?',
          choices: [
            'Dono ka apna kaam: Helm = packaging + distribution + release lifecycle (3rd-party stacks, versioned charts, rollback); Kustomize = template-free env patching, kubectl built-in. Aksar dono saath — Helm chart render karke Kustomize se patch, ya ArgoCD dono support karta hai',
            'Haan, Kustomize har jagah better hai',
            'Nahi, Kustomize bekaar hai',
            'Dono ek hi cheez hain',
          ],
          answer: 0,
          explain: 'Track 3 Level 22 ka jawab, ab Helm ki gehri samajh ke saath. Key line: "Kustomize se tum Prometheus stack distribute nahi kar sakte; Helm se ek-line patch karna over-engineering hai." Right tool, right job.',
        },
        {
          q: 'Aakhri sawal: Helm ka mental model ek line mein?',
          choices: [
            'Chart (templates + default values) + tumhari Values = rendered manifests → ek named Release, jiski har change ek naya Revision hai (isliye rollback possible) — packaging, configuration aur lifecycle teeno ek jagah',
            'Helm YAML ko chhota karne ka tool hai',
            'Helm Kubernetes ka package installer hai, bas',
            'Helm sirf templating hai',
          ],
          answer: 0,
          explain: '🏆 Perfect. Chart + Values → Release (revisions ke saath). Yeh ek line poora track hai — aur ab tumhare paas iske peeche ka pura gyaan bhi hai: templating, precedence, dependencies, hooks, publishing. <b>Helm Hakim ban gaye ho!</b> ⛵',
        },
      ],
    },
    success: [
      'Main chart ko lint → template → package → OCI registry tak ship kar sakta hoon',
      'Main jaanta hoon ki ArgoCD ke saath Helm sirf template engine hai (helm list khaali kyun hota hai)',
      'Main Helm ke saath secrets ka sahi pattern (existingSecret + ESO) use karta hoon',
      'Main HELM HAKIM hoon ⛵ — chart craftsmanship complete!',
    ],
    homework: `<p>🎓 Graduation — apna chart poori tarah ship karo:</p>
      <pre># 1) chart banao aur version discipline follow karo
helm create shop && sed -i 's/^version:.*/version: 0.1.0/' shop/Chart.yaml
helm lint shop && helm template shop > /tmp/rendered.yaml
wc -l /tmp/rendered.yaml            # kitna YAML tumne NAHI likha 😄

# 2) package + local repo (OCI ke bina bhi practice ho jayegi)
helm package shop                    # shop-0.1.0.tgz
helm repo index . --url http://localhost:8080
python3 -m http.server 8080 &        # mini chart repo!
helm repo add local http://localhost:8080 && helm repo update
helm search repo local
helm install shop local/shop
helm list && helm test shop

# 3) upgrade + rollback ka poora chakkar
sed -i 's/^version:.*/version: 0.2.0/' shop/Chart.yaml   # version BADHAO
helm package shop && helm repo index . --url http://localhost:8080
helm repo update && helm upgrade shop local/shop --atomic
helm history shop                    # 2 revisions!
helm rollback shop 1 && helm history shop   # 3rd revision = rollback

# safai
helm uninstall shop; kill %1; rm -rf shop *.tgz index.yaml</pre>
      <p>✅ Self-check: apna chart repo bana ke usse install kiya? History mein rollback wala teesra revision dikha? <b>Track COMPLETE — HELM HAKIM! ⛵🎓</b></p>`,
    cards: [
      { front: 'Chart ship karne ka pipeline?', back: '<code>lint</code> → <code>template</code> (verify) → <code>package</code> (naam <b>version</b> se banta hai!) → <code>push oci://…</code> → <code>install oci://…/chart --version x.y.z</code>. OCI registry = modern default (wahi jagah jahan images hain).' },
      { front: 'ArgoCD ke saath Helm — release kahan hai?', back: '<b>Kahin nahi!</b> ArgoCD chart ko RENDER karke (helm template jaisa) manifests apply karta hai — koi Helm release nahi banti, <code>helm list</code> KHAALI dikhega. Truth = git + ArgoCD Application. Rollback = <b>git revert</b>.' },
      { front: 'Helm ke saath secrets ka sahi pattern?', back: '<b>existingSecret</b>: chart sirf Secret ka NAAM leta hai (<code>secretKeyRef</code>), asli Secret ESO/Vault se banta hai. values.yaml mein plain secret = git leak. helm-secrets/SOPS bhi option hai par key-management ka jhanjhat.' },
      { front: 'Helm ka mental model ek line mein?', back: '<b>Chart</b> (templates + defaults) + <b>Values</b> = rendered manifests → ek named <b>Release</b>, jiska har change naya <b>Revision</b> (isliye rollback). Packaging + configuration + lifecycle, teeno ek jagah.' },
    ],
  },

]);
