# 🔧 KubeGurukul Extend Karna

Naya concept seekha (kahin blog/video/incident se) aur app mein daalna hai?
**Sirf data files edit karni hain — engine files (core/games/terminal/app.js) ko
chhoona nahi padta.** Yeh guide sab patterns cover karti hai.

## 1. Naya level add karna

Kisi bhi `data-*.js` file mein (ya nayi file bana ke) bas yeh call karo —
registry additive hai, jitni baar chaaho call karo:

```js
KG.registerLevels('intermediate', [   // 'beginner' | 'intermediate' | 'advanced'
  {
    id: 'mera-topic',            // unique, kebab-case (visuals + storage isi se judte hain)
    icon: '🧩',
    title: 'Mera Naya Topic — Hinglish Title',
    badge: 'Topic Tycoon',
    objectives: [ 'Yeh seekhoge', 'Woh seekhoge' ],          // intro screen par
    lesson: [                                                 // 1-3 HTML cards
      `<h3>🧩 Concept</h3><p>Hinglish explanation...</p>
       <div class="war-story"><b>⚡ Real incident:</b> ...</div>`,
    ],
    stages: [ /* neeche game types dekho */ ],
    interview: { questions: [ /* MCQ ya terminal — neeche */ ] },
    success: [ 'Main ab X kar sakta hoon' ],                 // completion checklist
    homework: `<p>Real cluster commands...</p>`,             // optional (null bhi chalega)
    cards: [                                                  // Revision Dojo flashcards
      { front: 'Sawal?', back: 'Jawab — <code>code</code> aur <b>bold</b> chalta hai.' },
    ],
  },
]);
```

Level track ke aakhir mein jud jaata hai. **Bas file save karo, browser refresh — done.**

### Track ke BEECH mein level daalna (boss se pehle)

`registerLevels` hamesha aakhir mein append karta hai — isliye naya level **boss ke baad**
chala jaata hai, jo galat hai. Beech mein daalna ho to:

```js
KG.registerLevelsAfter('intermediate', 'affinity', [ { id: 'priority', ... } ]);
```

**Do shartein:** target level (`afterId`) pehle se registered hona chahiye, isliye tumhari
file `index.html` mein us track ki data file ke **baad** load honi chahiye. Iske liye
`data-gaps.js` sabse aakhir mein load hoti hai. (`afterId` na mile to levels chup-chaap
aakhir mein jud jaate hain — safe fallback.)
(Naya level tabhi khulega jab uske pehle wala complete ho.)

## 2. Level ka diagram

`visuals.js` mein entry add karo — key = level `id`:

```js
VISUALS['mera-topic'] = {
  t: 'Chhota diagram title',
  html: `<div class="dg-flow">
    <div class="dg-node is-accent"><span class="ni">📦</span><span class="nl">Label</span><span class="ns">subtitle</span></div>
    <div class="dg-arrow flow"></div>
    <div class="dg-node is-good"><span class="ni">✓</span><span class="nl">Result</span></div>
  </div>
  <div class="dg-cap">Caption — <b>bold</b> allowed.</div>`,
};
```

Building blocks (style.css mein sab ready hai): `dg-flow`/`dg-col`/`dg-split`/`dg-stack`
(layout), `dg-node` (+ `is-good/is-bad/is-accent/is-gold/is-muted/pulse`), `dg-pill`
(+ good/bad/acc/gold), `dg-arrow` (+ flow/good/bad/gold/two), `dg-down`, `dg-box`
(+ bx-label — dashed group box), `dg-ladder`/`dg-rung`, `dg-legend`, `dg-cap`.
Sab diagrams ek saath dekhne ke liye: `gallery.html`.

## 3. Game types (stages)

```js
// 🗂️ BINS — categories mein sort karo
{ type: 'bins', title: '...', instructions: '...',
  bins: [ { id: 'a', label: '🅰️ Category A' }, { id: 'b', label: '🅱️ B' } ],
  items: [ { text: 'cheez', bin: 'a', explain: 'kyun A mein — Hinglish' } ] }

// 🔢 ORDER — sahi sequence banao
{ type: 'order', title: '...', instructions: '...',
  steps: [ { text: 'pehla step', explain: 'kyun pehla' }, ... ] }  // SAHI order mein likho

// 🔗 MATCH — jodi milao
{ type: 'match', title: '...', instructions: '...',
  pairs: [ { left: 'Term', right: 'Definition', explain: '...' } ] }

// 🧠 QUIZ — MCQ (context optional — code block dikhata hai)
{ type: 'quiz', title: '...',
  questions: [ { q: 'Sawal?', choices: ['A','B','C','D'], answer: 0,
                 explain: '...', context: 'optional\nterminal output' } ] }

// 📄 FILL — YAML/command ke blanks (drag tokens)
{ type: 'fill', title: '...', instructions: '...',
  template: 'kind: {0}\nmetadata:\n  name: {1}',   // {0},{1}... = blanks
  blanks: [ { answer: 'Pod', explain: '...' }, { answer: 'web', explain: '...' } ],
  tokens: [ 'Pod', 'web', 'galat-option', 'aur-ek' ] }  // sahi answers + decoys

// 🎯 HOTSPOT — diagram ke sahi hisse par click
// (VISUALS[visual] ke nodes par data-hs="target" attribute hona chahiye)
{ type: 'hotspot', title: '...', visual: 'controlplane',
  questions: [ { q: 'Kahan click?', target: 'apiserver', explain: '...' } ] }

// 🚨 INCIDENT — 3AM pager decision tree
{ type: 'incident', title: '...', pager: 'ALERT text (HTML)', start: 'n1',
  nodes: {
    n1: { sitrep: 'kubectl output...', text: 'Kya karoge?',
          choices: [ { t: 'Sahi move', good: true, next: 'n2', explain: '...' },
                     { t: 'Galat move', good: false, explain: 'kyun galat' } ] },
    n2: { ... },
    end: { end: true, text: 'Resolved!', summary: 'Seekh (HTML)' },
  } }

// 🧩 RENDER — chart workbench (values + template side-by-side, output predict karo)
{ type: 'render', title: '...', instructions: '...',
  values: 'replicaCount: 3\nimage:\n  tag: "2.0"',        // left pane
  template: 'replicas: {{ .Values.replicaCount }}',        // right pane
  file: 'deployment.yaml',                                 // optional pane heading
  questions: [ { q: 'Kya render hoga?', focus: 'us line ka snippet (optional)',
                 choices: ['replicas: 3', 'replicas: {{ ... }}'], answer: 0, explain: '...' } ] }

// 🩺 TRIAGE — KodeKloud-style diagnostic ladder (labs.js)
// Symptom milta hai + command palette. Learner khud chunta hai ki agla command kaunsa chale.
// Verdict tab khulta hai jab SAARE clue-commands chal jaayein — YA jab palette ki har
// command chal jaaye (isliye lab hamesha solvable hai, kisi bhi order mein).
{ type: 'triage', title: '...', instructions: '...',
  symptom: 'HTML — pager/user report',
  commands: [                              // 3+ chahiye, kam se kam ek clue: true
    { cmd: 'kubectl get pods -n shop', out: 'asli output...', clue: true,
      note: 'is output se kya pata chala (HTML)' },
    { cmd: 'kubectl top pod', out: '...', clue: false,
      note: 'dead end — aur dead end hona bhi ek sabak hai' } ],
  questions: [ { q: 'Root cause?', choices: [...], answer: 0, explain: '...' } ] }

// 🎚️ SLIDER — knob ghumao, number khud badalta hai (labs.js)
// readouts/verdict/check FUNCTIONS hain — numbers compute hote hain, hardcode nahi.
{ type: 'slider', title: '...', instructions: '...',
  scenario: 'HTML — problem statement',
  goal: 'text — kya haasil karna hai (screen par 🎯 KAAM ke roop mein dikhta hai)',
  knobs: [ { id: 'replicas', label: 'Replicas', min: 2, max: 12, step: 1, value: 4, unit: ' pods' } ],
  readouts: k => [ { label: '...', value: '...', state: 'good'|'warn'|'bad'|'neutral', hint: '...' } ],
  bars:     k => [ { label: '...', pct: 0-100, state: '...', cap: 'right side text' } ],  // optional
  verdict:  k => ({ ok: bool, text: 'HTML — har knob move par badalta hai' }),
  check:    k => bool,                     // goal poora hua?
  lesson:   'HTML — goal ke baad dikhta hai',
  quiz:     { q, choices, answer, explain } }   // optional scored test

// 🎬 FLOW — kadam-dar-kadam player, play/pause + beech mein sawaal (labs.js)
{ type: 'flow', title: '...', instructions: '...',
  lanes: [ { id: 'kubelet', label: 'kubelet', icon: '🤖' } ],
  steps: [ { lane: 'kubelet', t: 'chhota text', detail: 'HTML — neeche panel mein',
             ask: { q, choices, answer, explain } } ],   // ask optional; flow ruk jaata hai
  summary: 'HTML — aakhir mein' }

// 🧲 BOARD — pod ko node par rakho, asli scheduler predicates (labs.js)
// Engine khud check karta hai: nodeSelector → taints → podAntiAffinity → capacity.
// Pod select karte hi HAR node ✅/❌ + asli FailedScheduling wajah dikhata hai.
{ type: 'board', title: '...', instructions: '...', goal: '...',
  nodes: [ { id: 'n1', name: 'node-1', labels: { type: 'gpu' },
             taints: [ { key: 'workload', value: 'ml', effect: 'NoSchedule' } ],
             cpu: 8, mem: 16, usedCpu: 0, usedMem: 0 } ],
  pods:  [ { id: 'p1', name: 'ml-api', cpu: 2, mem: 4,
             nodeSelector: { type: 'gpu' },
             tolerations: [ { key: 'workload', value: 'ml' } ],   // ya { key, operator: 'Exists' }
             spread: 'web' } ],            // spread = podAntiAffinity group (hostname topology)
  lesson: 'HTML — saare pods rakhne ke baad' }

// 🎁 BONUS — kisi bhi stage mein `bonus: true` daalo → golden bonus round ban jaata hai
```

## 4. Terminal mission (kubectl simulator)

```js
{ type: 'terminal', title: '🖥️ Mission: ...', instructions: '...',
  goal: 'Kya karna hai (HTML)',
  tasks: [   // checklist — har command ke baad check hota hai
    { text: 'Pods dekho', check: s => s.history.some(h => /get pods/.test(h)) },
  ],
  cluster: {   // mock cluster — jo dena chahte ho wahi do
    nodes: [ { name: 'node-1', status: 'Ready', roles: '<none>', age: '9d', version: 'v1.30.2' } ],
    pods: [ { name: 'web-abc-x1', ready: '0/1', status: 'CrashLoopBackOff', restarts: 5,
              age: '9m', node: 'node-1', ip: '10.244.1.7',
              logs: 'Error: ...',            // kubectl logs
              prevLogs: '...',               // logs --previous
              describe: '...',               // custom describe (warna auto-generate)
              events: ['Warning BackOff ...'],
              exec: { 'nslookup db': '...' }, // kubectl exec pod -- <cmd>
              respawn: { ...podSpec } } ],   // delete par ReplicaSet naya banaye
    deployments: [...], services: [...], endpoints: [...], configmaps: [...],
    events: [...], hpas: [...], statefulsets: [...], // jo tables chahiye
  },
  files: {   // kubectl apply -f <naam> ke fixes ('ls' se dikhte hain)
    'fix-x.yaml': { desc: '...', apply: s => { /* s.cluster mutate karo */ return 'output'; } },
  },
  responses: [   // KISI BHI command ko script karo (builtins se pehle match hota hai)
    { re: /^kubectl rollout undo deployment\/web$/, out: 'text ya fn(s)', mutate: s => {...} },
  ],
  success: s => s.cluster.pods.every(p => p.status === 'Running'),  // mission complete kab
  successText: 'Jeetne par seekh (HTML)',
  hints: [ 'Hint 1', 'Hint 2' ] }   // har hint −5 XP
```

Builtin commands jo free milte hain: `get` (pods/deploy/svc/nodes/cm/endpoints/events/
sts/ds/ing/netpol/hpa/pvc/all, `-o wide`), `describe`, `logs` (`--previous`),
`delete pod`, `apply -f`, `exec`, `top`, plus `help`/`ls`/`clear`/`hint`.
Kuch aur chahiye (scale, rollout, argocd, koi bhi command)? → `responses` mein regex se script karo.

### ⛵ Helm missions (helmsim.js)

`helm ...` commands apne aap kaam karte hain — bas mission ke `cluster` mein Helm state do:

```js
cluster: {
  repos: [ { name: 'bitnami', url: 'https://…' } ],
  searchIndex: [ { name: 'bitnami/nginx', version: '15.4.2', appVersion: '1.25.3', description: '…' } ],
  valuesFiles: { 'values-prod.yaml': { replicaCount: 10 } },   // -f ke liye
  releases: [ { name, chart, chartRef, appVersion, revision, status, updated,
                values: {}, userValues: {}, history: [ { revision, status, chart,
                appVersion, description, values, userValues } ], notes } ],
  charts: {
    './shop': {
      name: 'shop', version: '0.1.0', appVersion: '2.4.0',
      defaults: { replicaCount: 2 },          // chart ki values.yaml (merge base)
      valuesYaml: 'text…',                    // helm show values
      lint: ['==> Linting ./shop', …], lintFailed: false,
      needsDeps: true, deps: [ { name, version, repository, condition } ],
      render: (vals, rel) => 'rendered yaml', // helm template / get manifest
      notes: 'NOTES.txt text',
      onInstall:  (sim, rel) => { /* pods banao */ },
      onUpgrade:  (sim, rel, prev) => { /* return false = upgrade FAIL (atomic test!) */ },
      onRollback: (sim, rel, target) => {},
      onUninstall:(sim, rel) => {},
      testOut: 'helm test output', testFailed: false,
    }
  }
}
```

Free milta hai: `repo add/list/update`, `search repo`, `install` (+`--dry-run`),
`upgrade` (+`--install --atomic --reuse-values`), `rollback`, `history`, `status`,
`list`, `uninstall`, `get values|manifest|notes|all` (+`--all`, `--revision`),
`template`, `lint`, `show values|chart`, `dependency list|update`, `test`,
`diff upgrade`, `package`, `push oci://…`, `version`.

Values precedence (defaults < `-f` left→right < `--set`), deep-merge, revision history
aur `pending-upgrade` wala stuck-release behaviour sab simulate hota hai —
mission ke `success()` mein `sim.cluster.releases[0].values` / `.userValues` /
`.lastFiles` / `.lastSets` / `.status` / `.revision` check kar sakte ho.

## 5. Interview round

`interview.questions` mein do type mix kar sakte ho:

```js
// MCQ (context optional):
{ q: 'Interviewer ka sawal?', choices: [...], answer: 0, explain: '...' }
// Hands-on (embedded terminal mission — same format as section 4):
{ terminal: { title: '...', goal: '🧑‍💼 Interviewer: "..."', cluster: {...}, success: ..., hints: [...] } }
```

## 6. Naya track add karna

1. `data-core.js` → `KG.tracks` mein entry (id/icon/name/blurb/certTitle/certSub/motto/formula).
   Side-track banana ho jo sequential gating se bahar rahe (jaise Helm)? `alwaysUnlocked: true` daalo.
2. Nayi file `data-<track>.js` banao jo `KG.registerLevels('<track-id>', [...])` kare
3. `index.html` mein `<script src="data-<track>.js"></script>` (data-advanced ke baad, app.js se pehle)

Tracks order mein unlock hote hain (`KG.tracks` ka order = unlock order).

## 7. Sirf flashcards add karna (bina naye level ke)

Kisi level ke `cards` array mein naya card daalo — **dhyan:** cards level complete
karne par ek baar enroll hote hain (id = `levelId-c<index>`), toh naya card purane
players ko tab milega jab woh level REPLAY complete karenge, ya console se:

```js
KG.addCard('custom-1', 'Front sawal?', 'Back jawab', '🏷️ Tag');
```

## 8. Ranks / XP tuning

- Ranks: `data-core.js` → `RANKS` (xp thresholds + naam)
- XP knobs: `core.js` top — `XP_PER_ITEM`, `PERFECT_BONUS`, `TERMINAL_XP`,
  `HINT_COST`, `CARD_XP`, `POP_XP`, `SRS_INTERVALS`

## Checklist naye content ke liye

- [ ] Level `id` unique hai aur `VISUALS[id]` add kiya
- [ ] Har `explain` Hinglish mein hai aur "kyun" batata hai (sirf "kya" nahi)
- [ ] Fill stages: har `blanks[].answer` `tokens` mein maujood hai (+ 2-4 decoys)
- [ ] Incident: har non-end node mein exactly ek `good: true` choice + `next` valid
- [ ] Terminal: `success()` fresh cluster par crash nahi karta
- [ ] Terminal: `success()` ko `KG.allOf(TASKS)` se banaya (neeche 🪤 jaal dekho)
- [ ] Slider: default knob values par goal poora NAHI hona chahiye, aur kisi na kisi
      combination par poora hona chahiye — validator dono check karta hai
- [ ] Triage: kam se kam ek `clue: true` command hai, aur koi duplicate `cmd` nahi
- [ ] Board: saare pods ek saath schedule ho sakte hain, aur har pod ke liye kam se kam
      ek node ❌ hai (warna lab kuch sikhata hi nahi)
- [ ] 3-5 `cards` — front = sawal, back = crisp jawab
- [ ] Browser mein khel ke dekha 😄

### 🔄 ArgoCD missions (argosim.js)

`argocd ...` aur `kubectl argo rollouts ...` apne aap chalte hain — cluster mein state do:

```js
cluster: {
  apps: [ {
    name, project, repo, path, targetRevision, destNamespace, destServer,
    sync: 'OutOfSync', health: 'Missing',        // do ALAG axes
    revision, targetRevisionSha,
    syncPolicy: { automated: { prune: true, selfHeal: true } },
    resources: [ { group, kind, name, status, health, wave, pruneMe: true } ],
    diff: 'text' | (sim, app) => 'text',          // argocd app diff
    history: [ { id, revision, deployedAt, note } ],
    onSync: (sim, app) => true | false,           // false = sync FAIL (app Degraded)
    syncError: 'kyun fail hua',
    onRollback: (sim, app, entry) => {},
  } ],
  appsets:  [ { name, generator, produces: ['a-dev','a-prod'] } ],
  projects: [ { name, description, sourceRepos, destinations, allowedKinds } ],
  argoClusters: [ { server, name, version, status } ],
  rollouts: [ { name, strategy:'canary', status:'Paused', step, weight,
                steps: ['setWeight: 10','pause: {}'], images, analysisMsg,
                onChange: (sim, ro) => {} } ],
}
```

Free milta hai: `app list/get/diff/sync (--prune, --dry-run)/history/rollback/set/
create/delete/wait/refresh/manifests`, `appset list|get`, `proj list|get`,
`cluster`, `login`, `version`, aur `kubectl argo rollouts get rollout|list|
promote (--full)|abort|undo|status`. `pruneMe: true` wale resources bina `--prune`
ke nahi hatte (aur app OutOfSync hi rehta hai) — yeh classic sabak khud simulate hota hai.

### 🌲 Karpenter missions (karpentersim.js)

Karpenter ek **controller** hai — `cluster.karpenter = { enabled: true }` set karte hi
har command ke baad `reconcile()` chalta hai:

```js
cluster: {
  karpenter: { enabled: true, tick: 0, log: [] },
  nodepools: [ { name, weight, nodeClassRef,
    requirements: [ { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot'] },
                    { key: 'karpenter.k8s.aws/instance-category', operator: 'In', values: ['c','m','r'] } ],
    limits: { cpu: 1000 }, used: { cpu: 0 },
    taints: [ { key, value, effect } ],
    disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized' } } ],
  ec2nodeclasses: [ { name, amiFamily, role, drifted: false } ],
  nodeclaims: [],                          // controller khud bharta hai
  pods: [ { name, status: 'Pending', requests: { cpu: '3', memory: '6Gi' },
            tolerations: [ { key } ], doNotDisrupt: true } ],
}
```

Controller khud karta hai: Pending pod → NodeClaim → (agla command) Node Ready → pod
scheduled; khaali/kam-bhare nodes par consolidation (`doNotDisrupt` respect karta hai);
EC2NodeClass `drifted: true` par nodes drifted mark. Failure reasons pod ke `describe`
mein aate hain (no NodePool match / koi instance type fit nahi / limit reached) — aur
har reconcile par **dobara evaluate** hote hain, isliye learner kisi bhi order mein fix
kare, kaam karega. `KG.karpenter.cost(sim)` se monthly cost estimate milta hai.

## 🪤 Do jaal jo pehle bhi pakde ja chuke hain

**1. `success()` tasks se aage nikal jaata hai.** Mission ka `success()` alag likhne par
woh checklist ke aakhri item se pehle hi `true` ho jaata hai — mission "done" ho jaata hai
aur learner ka aakhri kadam kabhi chalta hi nahi. Isliye dono ko ek hi jagah se banao:

```js
const T_MISSION = [
  { text: 'Pods dekho',   check: s => s.history.some(h => /get pods/.test(h)) },
  { text: 'Fix apply karo', check: s => s.cluster.pods.every(p => p.status === 'Running') },
];
// ...
tasks: T_MISSION,
success: KG.allOf(T_MISSION),   // ← tasks aur success ab kabhi alag nahi ho sakte
```

Task-constants ko `KG.registerLevels(...)` call se **upar** rakho (array literal ke andar
`const` likhne par file parse hi nahi hogi), aur har chunk ko apne IIFE mein lapeto taaki
alag-alag files ke constants aapas mein na takrayein.

**2. Non-Latin akshar chup-chaap ghus jaate hain.** `rukа` (Cyrillic а) aur `मरegi`
(Devanagari) browser mein bilkul theek dikhte hain. Validator inhe pakadta hai — `node
validate.js` chalana isi liye zaroori hai.

## 10. Validator

Naya content add karne ke baad **hamesha**:

```bash
node validate.js
```

Yeh pakadta hai: missing visuals, toote fill-tokens, unreachable incident nodes,
answer-index out of range, khaali bins, pre-solved terminal missions, callbacks jo
clone mein kho jaayein, aur simulators ke regressions.

**Labs ke liye validator sirf structure nahi dekhta — labs ko sach mein RENDER karta hai
aur unke goals ko solvable saabit karta hai:**

| Lab | Validator kya karta hai |
|-----|-------------------------|
| `triage` | Palette ki har command "click" karta hai, phir har choice — verdict khulna aur lab poora hona chahiye. Na khule to **SOFTLOCK** report hoti hai. Duplicate `cmd` bhi pakadta hai (Set mein ek hi register hoti hai) |
| `slider` | **Poora knob sweep** — har combination par `readouts/bars/verdict/check` chalata hai. Ek bhi combination `check()` true na kare → **UNSOLVABLE**. Aur default values par `check()` already true ho → **"goal shuru mein hi poora hai"** |
| `flow` | Poora flow chala ke, har `ask` ka sahi jawab de ke, aakhir tak pahunchta hai. Na pahunche to **SOFTLOCK** |
| `board` | **Backtracking** se saabit karta hai ki saare pods ek saath schedule ho sakte hain. Plus: koi pod HAR node par fit ho (to lab kuch sikhata hi nahi), ya khaali board par bhi kahin fit na ho — dono report hote hain |

Aur ek guard jo baar-baar kaam aaya hai: **non-Latin script leak**. Content Hinglish hai
(Latin akshar), par typing ke dauraan Cyrillic `а` ya Devanagari `ा` chup-chaap ghus jaata
hai — browser mein shabd bilkul theek dikhta hai par word toota hua hota hai (`rukа`,
`मरegi`). Validator har content file scan karta hai aur file:line ke saath report karta hai.
(Emoji aur arrows allowed hain — sirf alphabet scripts pakde jaate hain.)

## 11. 🐳 `docker` stage + `docker-labs/` (2026-09-30)

Laptop par asli processes chalwane wala stage (System Gurukul / SQL Gurukul jaisa, `dockerlab.js` mein, IIFE):

```js
{
  type: 'docker', title,
  project: '01-probes',               // docker-labs/<project> — folder hona chahiye
  exercise: 'ex1-deep-shallow',       // project README mein yeh naam hona chahiye (validator check karta hai)
  goal: 'HTML', why?: 'HTML',
  steps: [{ text, cmd?, expect? }],   // expect = README wala ASLI output (andaaza nahi)
  observe: { q, choices, answer, explain },
  lesson?: 'HTML',
}
```

- Validator structure jaanchta hai, phir stage ko render karke saare steps tick karta hai, **DOM dobara collect** karke sahi
  option (`dataset.i`) dabata hai aur `dk-done` tak pahunchta hai.
- Machine par Docker / Kubernetes nahi hai — isliye labs **Node processes** hain: `docker-labs/01-probes/services/cluster.js`
  ek mini cluster hai (kubelet ke asli probe niyam, endpoints, Service). Har README "Asli cluster par" wale YAML ke saath.
- Purane level mein naya video → `KG.extendLevel(id, { objectives, lesson, stages, success, cards, interview, homework })`
  (`core.js`), level na mile toh ERROR. Batch files (`data-ext-sdd.js`) sabse aakhir mein, `app.js` se pehle load hoti hain.
