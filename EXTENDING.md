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
Data helpers ko `KG.meraHelper` par rakho, ya file ko IIFE mein lapeto. Alag script tags
aur validator ek global scope share karte hain; top-level `const`/`function` names takra sakte hain.
Hinglish mein object/command ka naam likho; vague "yeh/woh/isse" se learner ko guess karna padta hai.

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

**Kadam-dar-kadam diagram chahiye (kaun kisko kya bhejta hai, kis kram mein)?** `html` ki jagah `scene` likho — §17.1 dekho.
Naye levels ke liye `scene` hi pehli pasand hai.

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
// Engine khud check karta hai (asli scheduler ka order): taints → nodeSelector → capacity → podAntiAffinity.
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

// ⚡ DRILL — kubectl speed drill (drill.js, 2026-11-24). Sawal padho → command TYPE karo → Enter.
// Timer, har sawal par 2 koshish (phir sahi jawab dikhta hai, drill atakti nahi), Skip, ⭐ par (seconds),
// best score KG.state.drillBest[id] mein. Milaan KG.drill.canon() se: aliases (po = pods), flags ka kram,
// -o wide = -owide, deploy/x = deploy x, exec par -it optional, -n payments optional.
{ type: 'drill', id: 'drill-pod', title: '⚡ …', intro: 'HTML', par: 110,
  items: [ { ask: 'HTML', answers: ['kubectl get pods -o wide', /* variant */], explain: 'HTML' } ] }
// answers[0] learner ko dikhta hai — "kubectl …" se shuru ho. Jo variant canon() mein pehle se same hai,
// use mat likho (validator pakadta hai). Ek command do sawalon ka jawab na ho.

// 🎲 CHAOS — random breakage (chaos.js, 2026-11-24). pay-api ki ek file (ConfigMap + Deployment + Service) mein
// chaos monkey 15 mein se koi galti daalta hai (level 3 par kabhi do). Cluster ki poori haalat FILE se nikalti hai
// (kubelet ka kram: scheduling → image → config → start → app → memory → liveness → readiness → endpoints),
// isliye koi bhi sahi fix chalta hai. Har round naya; stats KG.state.chaosStats[id] mein.
{ type: 'chaos', id: 'chaos-beginner', title: '🎲 …', level: 1 /* 1 | 2 | 3 */, intro: 'HTML (optional)' }
// Naya breakage: KG.chaos.BREAKS mein { id, level, fix, title, from, to, diag, clue, reveal } — "from" BASE mein
// exactly ek baar ho; validator har akela breakage aur har do-galti combo apne solution se jeet kar dikhata hai.

// 📟 ONCALL — on-call shift (oncall.js, 2026-11-24): ek cluster, 4 JUDE hue incidents (crash → HPA max → CPU Pending →
// DB connections). Simulated ghadi (har command = 1 min), pager panel, incident tabhi resolve jab haalat theek AUR fix ke
// baad verify command chala. Khatarnaak commands roke + gine jaate hain. Aakhir mein report card (MTTR, hints, grade A/B/C).
{ type: 'oncall', id: 'oncall-sale', shift: 'sale', title: '📟 …' }   // shift na ho toh 'sale'
// Engine hooks jo isne joda (terminal.js): stage.onTick(sim, print) — har command / save ke baad mission ka apna controller;
// stage.hintsFor(sim) → { key, list } — hints abhi ke hisse (incident) ke hisaab se.
// 2026-11-25 se oncall.js ek GENERIC shift engine hai: KG.oncall.add({ id, start, INC, build, reconcile, views }).
// Engine ghadi, alerts ka kram, "theek → pakka karo", tasks, hints, risky(re, why) aur report card deta hai; shift sirf
// cluster ka model + files + kubectl jawab deti hai. Nayi shifts data-oncall.js mein (poora contract oncall.js ke header mein):
//   'sale'  boss2   Diwali sale (oncall.js ke andar)
//   'patch' d2-boss node migration AL2 → AL2023: PDB minAvailable = replicas → JDK 8u292 + cgroup v2 OOMKilled →
//                   Velero schedule paused → ledger ka planned move (PDB 0 → 1 → wapas 0)
//   'blind' ob-boss release ki raat: TargetDown (404, Service targetPort) → cardinality (txn_id) → error budget burn
//                   (fraud-check v2 timeout) → rollout undo ke baad TargetDown phir (aadha rollback)
// Har INC: { id, sev, text, fixed: c => bool, verify: /regex/, verifyText, hints: [3], onFire? }. fixed sirf STATE se tay ho
// (kis raaste se pahunche, isse nahi) — learner kisi bhi kram mein theek kare, engine sahi chalta hai.

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
    apiError: s => s.cluster.apiFixed ? null : 'Unable to connect to the server: ...',
  },
  files: {   // 'ls' / 'cat <naam>' se discover karo
    'fix-x.yaml': { desc: '...', apply: s => { /* s.cluster mutate karo */ return 'output'; } },
    'fix-node.sh': { desc: 'Node repair', content: '#!/bin/sh\n# learner ko asli steps dikhao',
      apply: s => { s.cluster.apiFixed = true; return 'Node repair complete'; } },
  },
  responses: [   // KISI BHI command ko script karo (builtins se pehle match hota hai)
    { re: /^kubectl rollout undo deployment\/web$/, out: 'text ya fn(s)', mutate: s => {...} },
  ],
  success: s => s.cluster.pods.every(p => p.status === 'Running'),  // mission complete kab
  successText: 'Jeetne par seekh (HTML)',
  hints: [ 'Hint 1', 'Hint 2' ],    // har hint −5 XP
  solution: [ 'kubectl get pods', 'bash fix-node.sh', 'kubectl apply -f fix-x.yaml' ] }
```

Builtin commands jo free milte hain: `get` (pods/deploy/svc/nodes/cm/endpoints/events/
sts/ds/ing/netpol/hpa/pvc/all, `-o wide`), `describe`, `logs` (`--previous`),
`delete pod`, `apply -f`, `exec`, `top`, plus `help`/`ls`/`clear`/`hint`.
Kuch aur chahiye (scale, rollout, argocd, koi bhi command)? → `responses` mein regex se script karo.

### ✏️ YAML fix editor (2026-11-23) — learner khud YAML badalta hai

```js
files: {
  'app-config.yaml': {
    editable: true,                       // `vi app-config.yaml` se khulti hai (vim/nano/edit bhi)
    content: 'kind: ConfigMap\n...',      // shuru ka text (git wali file)
    apply: (sim, text, docs) => {         // text = badla hua text, docs = KG.yaml.parseAll(text)
      // docs[0].data.X padho, asli API jaisa jawab do:
      return { err: 'Error from server (BadRequest): ...' }   // laal rang mein
      // ya: return 'configmap/app-config configured'
    } },
},
solution: [ ..., { edit: 'app-config.yaml', change: [['purana text', 'naya text']] }, 'kubectl apply -f app-config.yaml' ],
```

- Engine khud karta hai: editor (line numbers, Tab = 2 space, Ctrl+S, Esc), save par diff, `cat` mein naya text,
  aur **toota YAML** par `apply` chalata hi nahi — `error converting YAML to JSON: yaml: line N: …` chhapta hai (`yaml.js`).
- `yaml.js` go-yaml v2 jaisa hai: `yes/no/on/off` bool hain, tab se indent mana, duplicate key error. Anchors/tags nahi.
- `apply` mein asli API ke niyam khud likho: ConfigMap ki value string, strict decoding (`unknown field "spec.x"`),
  enum values (`Unsupported value`), type (`cannot unmarshal string into … of type bool`). Learner ki galti ka jawab
  wahi hona chahiye jo asli cluster deta.
- `{ edit }` step: validator aur `tools/replay-missions.js` `vi <file>` chalate hain, `change` ke jode text mein badalte hain,
  aur asli 💾 Save button dabate hain. `change` ka purana text file mein **exactly** hona chahiye.
- `kubectl edit` simulator mein nahi hai; editable files hon toh terminal `vi` wala raasta batata hai.
- **`onSave(sim, text, docs, parseErr)`** (2026-11-24): file ko koi aur khud padhta hai — jaise static pod ki file
  (`/etc/kubernetes/manifests/…`) jise kubelet padhta hai. Save par yeh chalta hai; `kubectl apply` wala tip nahi aata.
  `parseErr` = toota YAML (`.line`, `.message`). Asli tool ka log lautao (`kubelet: "Could not process manifest file"`).
- **`saveTip: 'text'`**: save ke baad apna tip (jaise Kustomize overlay: "kubectl kustomize … phir kubectl apply -k …").
  `noApplyTip: true` = koi tip nahi.
- **`rawApply: true`**: file YAML nahi (jaise Helm template) — `kubectl apply` pehle parse nahi karta, seedha `apply(sim, text, null)`.
- Editor ka `.te-body` `align-items: flex-start` hai — lambi file (50+ lines) mein gutter aur text saath scroll hote hain.

`solution` ko actual goal/tasks ke mutabik likho: validator asli renderer mein commands replay
karta hai aur **win aakhri command par** hona chahiye. Jeetne ke baad input disable hota hai;
verification command learner se chalwana hai toh task banao, `successText` mein mat chhupao.
Shell chains ke andar bhi har command alag history entry aur reconcile tick banata hai.

`.yaml` sirf cluster objects ke liye; node/etcd/certificate/git repair `.sh` + `bash fix-node.sh`
se model karo. Script ka `content` learner ko steps dikhata hai; simulator `apply(sim)` callback
chalata hai, asli shell nahi. `kubectl apply -f fix-node.sh` reject hota hai. `sudo` strip hota hai.
`cluster.apiError` string ya `(sim) => string|null` API-dependent kubectl commands ko rokta hai;
local `help`, `version --client` aur `config` chalte hain. Scripted `responses` builtins se pehle
match hote hain, isliye API-down scenario mein kubectl override soch kar do.

`responses[].out(sim, m)` mein captures ko `m[1] || ''` se guard karo (validator `out(sim, [])`
bhi call karta hai). Fix ke baad custom `describe`, events aur logs update karo. CrashLoopBackOff
mein `logs` last crashed run dikha sakta hai (`prevLogs` fallback); `--previous` zero restarts par
error deta hai, never-started containers ka waiting error alag hai.

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
      renderError: 'template: shop/templates/deployment.yaml: ...', // broken chart; fix par clear karo
      notes: 'NOTES.txt text',
      onInstall:  (sim, rel) => { /* pods banao */ },
      onUpgrade:  (sim, rel, prev) => { /* return false = upgrade FAIL (rollback test) */ },
      onRollback: (sim, rel, target) => {},
      onUninstall:(sim, rel) => {},
      testOut: 'helm test output', testFailed: false,
    }
  }
}
```

Helm 4 flavoured subset: `--rollback-on-failure` aur `--force-replace` use karo.
Helm 3 ke `--atomic` / `--force` aliases warning dete hain; `--recreate-pods` reject hota hai.
Chart ka `renderError` `template`, `install`, `upgrade` ko fail karata hai; `lintFailed` lint ka
alag result hai. Lint pass ko runtime correctness ka proof mat banao.

Free milta hai: `repo add/list/update`, `search repo`, `install` (+`--dry-run`),
`upgrade` (+`--install --rollback-on-failure --reuse-values`), `rollback`, `history`, `status`,
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

Har track par `group` zaroori hai (`main` / `scenario` / `prod` / `tools` — list `KG.trackGroups` mein, `data-core.js`).
Home page tracks ko isi group ke heading ke neeche dikhata hai. Naya group chahiye toh `KG.trackGroups` mein jodo.

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
- [ ] Terminal: `solution` replay last command par win karta hai; fix ke baad output stale nahi hai
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
  karpenter: { enabled: true, tick: 0, log: [], launchTicks: 4, consolidateTicks: 5 },
  nodepools: [ { name, weight, nodeClassRef,
    requirements: [ { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot'] },
                    { key: 'karpenter.k8s.aws/instance-category', operator: 'In', values: ['c','m','r'] } ],
    limits: { cpu: 1000 }, used: { cpu: 0 },
    taints: [ { key, value, effect } ],
    disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized' } } ],
  ec2nodeclasses: [ { name, amiFamily, role, drifted: false } ],
  nodeclaims: [],                          // controller khud bharta hai
  pods: [ { name, status: 'Pending', requests: { cpu: '3', memory: '6Gi', 'nvidia.com/gpu': '0' },
            tolerations: [ { key } ], doNotDisrupt: true } ],
}
```

Controller khud karta hai: Pending pod → NodeClaim (`Ready: Unknown`) → Node Ready → pod
scheduled; khaali/kam-bhare nodes par consolidation (`doNotDisrupt` respect karta hai);
EC2NodeClass `drifted: true` par nodes drifted mark. Failure reasons pod ke `describe`
mein aate hain (no NodePool match / koi instance type fit nahi / limit reached) — aur
har reconcile par **dobara evaluate** hote hain, isliye learner kisi bhi order mein fix
kare, kaam karega. `KG.karpenter.cost(sim)` se monthly cost estimate milta hai.

`launchTicks` = NodeClaim ke janam ke baad Ready hone tak reconciles; Ready se pehle NODE
column blank hai. `consolidateTicks` = node ko disruption candidate rehne ke liye required
reconciles (`candidateSince` tracks eligibility; workload badle toh timer reset hota hai).
Defaults `launchTicks: 1`, `consolidateTicks: 0` hain; mission mein delay badhao
taaki learner Pending/Unknown dekhe aur workload protect kar sake. Ticks terminal commands
hain, wall-clock seconds nahi; real Karpenter asynchronously reconcile karta hai.

NodePools weight order mein try hote hain; taint/resource/limit failure par agla pool try hota hai.
Instance requirements `In/NotIn/Gt/Lt/Exists/DoesNotExist` support karte hain: category,
generation, family, size, CPU, GPU count/manufacturer, instance type, architecture, OS aur
capacity type. Well-known `nodeSelector` labels match hote hain; arbitrary labels ka support limited hai.
CPU/memory/GPU requests placement aur consolidation mein count hote hain; GPU demand ke liye
`g5` types aur compatible toleration chahiye. Real EKS par NVIDIA AMI ke saath device plugin /
GPU Operator bhi chahiye; simulator GPU driver install nahi karta.

Yeh limited instance catalogue, request-fit aur consolidation model teaching ke liye hai.
Launch ke liye fixed 200m CPU + 240Mi overhead, illustrative prices, sequential provisioning aur command-based time ko real
AWS availability, billing, full scheduler, PDB/disruption budgets ya production capacity proof
mat samjho. Production choices ko real cluster/events aur provider documentation se verify karo.

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
node tools/replay-missions.js run
```

Yeh pakadta hai: missing visuals, toote fill-tokens, unreachable incident nodes,
answer-index out of range, khaali bins, pre-solved terminal missions, callbacks jo
clone mein kho jaayein, solution replay aur simulators ke regressions.

**Labs ke liye validator sirf structure nahi dekhta — labs ko sach mein RENDER karta hai
aur unke goals ko solvable saabit karta hai:**

| Lab | Validator kya karta hai |
|-----|-------------------------|
| `triage` | Palette ki har command "click" karta hai, phir har choice — verdict khulna aur lab poora hona chahiye. Na khule to **SOFTLOCK** report hoti hai. Duplicate `cmd` bhi pakadta hai (Set mein ek hi register hoti hai) |
| `slider` | **Poora knob sweep** — har combination par `readouts/bars/verdict/check` chalata hai. Ek bhi combination `check()` true na kare → **UNSOLVABLE**. Aur default values par `check()` already true ho → **"goal shuru mein hi poora hai"** |
| `flow` | Poora flow chala ke, har `ask` ka sahi jawab de ke, aakhir tak pahunchta hai. Na pahunche to **SOFTLOCK** |
| `oncall` | Har oncall stage ki poori shift ka solution asli terminal mein chalata hai → report card → "Aage badho"; bina hint `firstTry` = alerts ki ginti; `shift` registered hona chahiye. Har shift ka alag test: `sale` (kram, bina fix resolve nahi, restart ke bina pool ka asar nahi), `patch` (limit badhane se OOM nahi rukta, `-Xmx` se rukta hai; PDB ki asli errors; khatarnaak PDB badlaav gine jaate), `blind` (targets down = error query khaali; labeldrop / SLO metric girane wala regex roka; aadha rollback TargetDown phir laata hai) |
| `chaos` | Round shuru karta hai, jo breakage aaya uska solution asli terminal mein chalata hai, round jeet kar "Aage badho". Alag test: BASE theek hai, har breakage sach mein todta hai (`KG.chaos.works`), har akela (15) aur har do-galti combo (24) apne solution se jeetta hai |
| `drill` | "Shuru" dabata hai, har sawal ka aakhri answer type karke Enter, phir "Aage badho" — drill poori honi chahiye aur `firstTry` = sawalon ki ginti. Faltu (canonical same) variants aur do sawalon ka ek hi jawab bhi pakadta hai |
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

## 12. Decision Dojo (`decisions.js` + `data-decisions.js` + `data-decisions-prod.js`)

Abhi **23 trees aur 142 practice scenarios** hain. `data-decisions.js` mein purane 15 trees hain.
`data-decisions-prod.js` mein "Production ke kaam" tracks ke 8 trees hain (`debugtool`, `restore`, `alerting`, `signal`,
`admission`, `eksid`, `tlscert`, `eksip`) — sab ChaiPay ki kahani mein. Nayi tree file ko `index.html` aur `validate.js`
ki `FILES` list, dono mein jodo. Tree data register karo:

```js
KG.registerDecisions([{
  id: 'mera-decision', icon: '🧭', title: 'Kab kaunsa?', short: 'Topic',
  tldr: 'Decision ki ek-line rule', levels: ['mera-topic'], labs: ['01-crashloop-oom'],
  start: 'q1',
  nodes: {
    q1: { q: 'Constraint kya hai?', why: 'Constraint choice ko kaise badalta hai',
      options: [{ t: 'Stable identity chahiye', next: 'stateful' }, { t: 'Stateless replicas', next: 'deploy' }] },
    stateful: { leaf: true, pick: 'StatefulSet', icon: '🗄️', one: 'Stable identity + storage',
      why: 'Ordinal identity workload ki requirement hai', when: ['Stable identity'],
      avoid: ['Sirf interchangeable replicas'], gotchas: ['Backup aur replication app ki zimmedari hain'],
      yaml: 'kind: StatefulSet', example: 'Database replicas' },
    deploy: { leaf: true, pick: 'Deployment', icon: '📦', one: 'Interchangeable replicas',
      why: 'Har replica same traffic serve karta hai', when: ['Stateless API'],
      avoid: ['Ordinal identity chahiye'], gotchas: ['Persistent volume se app apne-aap stateful-safe nahi banta'] },
  },
  compare: { cols: ['Need', 'StatefulSet', 'Deployment'], rows: [['Pod identity', 'Stable ordinal', 'Replaceable']] },
  scenarios: [{ s: 'Replicas ko stable per-pod hostname chahiye.', answer: 'stateful',
    explain: 'Stable ordinal + headless Service per-pod DNS dete hain.' }],
}]);
```

Har edge valid node tak jaaye, har leaf reachable ho aur leaf ka `pick` tree ke andar unique ho.
Scenario ka `answer` leaf ID hai; practice options leaves se bante hain. Scenario mein decisive
constraint likho, options ki length se jawab reveal mat karo. Renderer recommendation, full map,
comparison aur answer ka decision-route dikhata hai. Mixed practice 8 scenarios leti hai;
galat jawab Revision Dojo mein mistake card banta hai. `levels`/`labs` links dono taraf sahi IDs do.

Teen baatein jo validator nahi pakadta:

1. **`pick` ki lambai barabar rakho.** Practice ke options leaves ke `pick` se bante hain. Ek tree ke andar sabse lamba
   `pick` sabse chhote `pick` ke 1.15 guna se kam ho. Jaanch: `node tools/mcq-bias.js list --kind=decision`
   (nayi tree ka naam is list mein nahi aana chahiye).
2. **`yaml` field escape hoti hai.** Wahan `<naam>` seedha likho, `&lt;naam&gt;` nahi. Baaki fields (`one`, `why`, `gotchas`,
   `example`) HTML hain — wahan `&lt;naam&gt;` likho.
3. **Tree ka `levels: [...]`** hi tay karta hai ki level ke shuru wale "🧭 Kab use karein?" box mein kaun sa tree dikhe.
   Sirf wahi level jodo jiska faisla tree mein sach mein hai.

## 13. Real Labs (`reallabs.js` + `real-labs/`)

Abhi **19 lab directories** hain — saare 2026-11-24 ko asli 3-node kind cluster par chale (kind v0.33.0, Kubernetes v1.37.0,
Helm v4.3.2): har lab ka setup → `verify.sh` ❌ → solution → `verify.sh` ✅, aur 16–19 ka har "👀 Dikhna chahiye" asli output se milaya.
Naya lab jo abhi cluster par nahi chala: catalogue mein `untested: true` likho (app mein chetavni apne aap dikhti hai) — chala kar hatao. Naye lab mein `README.md`, `verify.sh` aur `solution/` banao;
broken setup YAML/script, expected output, hints, decision recap aur cleanup document karo.
[`real-labs/README.md`](real-labs/README.md) mein setup aur verification helpers diye hain.
Phir `KG.realLabs` mein unique `id`, `num`, `title`, `mins`, `concept`, `decision`, related
`levels` aur `trees` register karo. Default start `kubectl apply -f setup.yaml`, cleanup
`kubectl delete ns lab<num>` hai; scripts/extra cluster resources wale labs explicit overrides dein.
Catalogue ke start/cleanup commands lab README mein bhi match hone chahiye.

App lab commands copy karwata hai aur completion localStorage mein **self-mark** karta hai;
browser cluster se connected nahi hai. `verify.sh` learner ke terminal par actual assertions
chalata hai. `node validate.js` catalogue/folders/links/commands check karta hai; manifests ko
real cluster par execute nahi karta. Purana kind v1.32 PASS record nayi lab/change ka proof nahi;
fresh cluster verification kiya ho toh cluster/version aur observed result saaf record karo.

## 14. Resume + mood picker

`KG.saveResume(session, stageIdx)` challenge boundaries par level ID, challenge index, score
aur replay flag save karta hai. `KG.getResume()` missing level ko reject karta hai;
`resumeLevel()` changed stage list ke liye index clamp karta hai. Stable level IDs rakho;
stages reorder karne par existing checkpoint ka meaning badal sakta hai. Mid-challenge terminal,
board ya typed input persist nahi hota: current challenge fresh renderer se khulta hai.

Home ka mood picker: ~5 min → due cards ya mixed decisions; 15–20 min → resume ya next
unlocked unfinished level; 45 min+ → pehla unmarked Real Lab. `realLabsDone` mark actual cluster
verification ka substitute nahi hai. Saari progress browser/origin ke localStorage mein hai.

## 15. Content tools

```bash
node tools/replay-missions.js list           # terminal + interview mission keys / solution status
node tools/replay-missions.js info kk-pending
node tools/replay-missions.js run            # saare stored solutions; pass/fail/no-solution
node tools/replay-missions.js run "" 'karpenterboss|t0' # transcript + task status
node tools/replay-missions.js run /tmp/solutions.json 'karpenterboss|t0'
node tools/mcq-bias.js                       # per-track answer-length heuristic
node tools/mcq-bias.js list beginner         # flagged keys + option lengths
node tools/mcq-bias.js --kind=incident       # incident good-vs-false options
node tools/mcq-bias.js --kind=decision       # expected bias of sampled Dojo options
node tools/mcq-bias.js --json                # visible lengths + audit records
```

Optional solutions JSON ka shape `{ "level-id|t0": ["command", "command"] }` hai;
interview missions ke keys `level-id|iv0` hain. Replay early win aur incomplete goal report
karta hai; `node validate.js` final gate hai. Saare missions ko solution chahiye; final command par
win aur saare checklist tasks done hone chahiye. Validator duplicate fill answers, matching/bin
items aur interview choices reject karta hai. Per-track MCQ length-bias ceiling 10% hai.
Bias tool MCQ, incident aur Decision Dojo practice measure karta hai: visible answer 1.15x sab
distractors se lamba, ya 0.85x sabse chhote distractor se chhota ho toh flag. Dojo mein four-wrong-leaf
sampling ki exact expected probability report hoti hai. Yeh diagnostic hai: report clean hone se
factual accuracy ya teaching quality prove nahi hoti; plausible distractors aur explanations review karo.

## 16. 🧯 Lab aur simulator ki galtiyan jo review mein pakdi gayin (2026-11-11)

Yeh section un galtiyon ki list hai jo ek poore review mein mili aur theek hui. Har point mein teen cheezein hain:
**kya galat tha**, **kyun galat tha** (asli Kubernetes/Helm/ArgoCD kya karta hai), aur **agli baar kaise bachein**.
Naya lab, mission ya simulator feature likhne se pehle yeh list padho. `node validate.js` in mein se sirf wahi pakadta hai
jiske liye test likha gaya hai (16.1, 16.2, 16.3) — baaki tumhe khud dekhna hai.

### 16.1 Scheduler ka "pehla reason" order asli order se alag tha (`labs.js` → `fitCheck`)

- **Galti:** board lab nodeSelector → taint → anti-affinity → capacity ke order mein check karta tha.
- **Asli order** (kube-scheduler ke default Filter plugins): `TaintToleration` → `NodeAffinity` (nodeSelector) →
  `NodeResourcesFit` (CPU/memory) → `InterPodAffinity` (anti-affinity).
- **Kyun maayne rakhta hai:** scheduler har node ka **sirf pehla** fail hua reason likhta hai. Tainted node par label bhi
  galat ho toh asli event `untolerated taint` kehta hai, `didn't match node selector` nahi. Order galat = learner ko
  woh message dikhta hai jo asli cluster kabhi nahi dega.
- **Bachav:** `FailedScheduling` ka koi bhi nakli message likhne se pehle har node ke liye isi order mein socho ki
  pehla fail kaunsa hai. Real lab 05 mein `setup.sh` ab taint **pehle** lagata hai aur pods **baad** mein banata hai;
  ulta order hone par pehli scheduling attempt taint ke bina hoti thi aur README ka expected message run-to-run badalta tha.

### 16.2 Karpenter simulator har pending pod ke liye alag node bana raha tha (`karpentersim.js`)

- **Galti:** 5 chhote pending pods → 5 NodeClaims. Lesson khud kehta hai "5 chhote pods = 1 node (bin-packing)".
- **Asli Karpenter:** pending pods ko ek batch window mein jama karta hai aur kam se kam nodes mein pack karta hai.
- **Bachav:** simulator ka behaviour lesson ke daave se **milao** — ek chhoti script se (jaise validator ka
  `karpenter: pending pods ek batch mein bin-pack hote hain` test). Agar lesson kuch kehta hai aur simulator kuch aur
  karta hai, toh learner simulator par bharosa karega.
- Consolidation ka `<40% CPU aur <=2 pods` wala candidate rule simulator ka shortcut hai, Karpenter ka niyam nahi.
  Lesson mein kabhi "40%" ko Karpenter ki setting mat likhna.

### 16.3 Helm aur ArgoCD ke do niyam aadhe the (`helmsim.js`, `argosim.js`)

- **Helm:** `helm upgrade <rel> <chart>` **bina kisi `-f`/`--set` ke** pichhli release ki user values dobara lagata hai.
  Ek bhi value flag aaya → values naye sire se (chart defaults + abhi wali values). `--reset-values` → sirf defaults.
  Simulator pehle har upgrade par reset karta tha. "Har upgrade par values naye sire se" likhte waqt yeh apvaad saath likho.
- **ArgoCD:** `argocd app rollback` tab fail hota hai jab auto-sync ON ho — `selfHeal` ho ya na ho. Simulator sirf
  `selfHeal` par rokta tha. Asli error: `rollback cannot be initiated when auto-sync is enabled`.
- **Bachav:** kisi tool ka niyam likhne se pehle uska **ulta case** bhi poochho ("aur agar flag na do toh?",
  "aur agar selfHeal off ho toh?"). Aadha niyam sabse aam conceptual bug hai.

### 16.4 Real labs (`real-labs/`) — commands jo race par nirbhar the

- `kubectl delete pod X` ke turant baad `kubectl wait --for=condition=Ready pod/X` mat likho. Naya pod abhi bana na ho
  toh `wait` turant `NotFound` se fail hota hai. Controller ke level par ruko: `kubectl rollout status sts/<naam>`
  (ya `deploy/<naam>`).
- Expected output mein node ki **ginti** ("2 Insufficient cpu") tabhi likho jab setup ka order use pakka karta ho.
- "Hamesha / kabhi nahi" wale vaakya ki shart saath likho. Do jagah shart chhooti thi:
  "Single-replica + PDB = drain kabhi nahi hoga" sirf tab sach hai jab PDB 0 disruption allow kare
  (`minAvailable: 1` ya `maxUnavailable: 0`). "Quota bhara ho toh rollout hamesha atka" sirf tab jab `maxUnavailable` 0 ho
  (default 25% chhote Deployment mein round hokar 0 ban jaata hai).
- Is machine par Docker, kind, kubectl aur helm **nahi** hain. Real labs sirf padh kar review hue hain, asli cluster par
  dobara nahi chale. Naya real lab ya badlaav "tested" tabhi likho jab sach mein cluster par chalaya ho, aur version likho.

### 16.5 Lab ka design — check karne ki chhoti list

1. Har expected output asli run se ho, ya saaf likha ho ki yeh simulator/model hai.
2. Jo cheez emulator/simulator nahi karta, woh usi step ke paas likho jahan learner use dekhega — neeche ki "limits" list mein nahi.
3. Har "galat" option/message asli tool ka asli message ho (flag ka naam, error ka text, column ka order).
4. Ek command, ek kaam: learner ko ek line paste karke do terminal ka kaam mat karwao.
5. Simulator mein naya niyam jode toh validator mein us niyam ka ek test bhi jodo (lesson ka daava = test ka assert).

## 17. 🧭 2026-11 ka UX pass — naye engine features aur unke niyam

User ne chaar dikkatein batayi thi: (1) terminal mission mein atakna, (2) ek screen par bahut text, (3) diagram saaf nahi,
(4) raasta saaf nahi (kahan ruka tha, aage kya). Neeche ke features inhi chaar ke jawab hain. **Inhe todna mat** — naya content
inhi ke upar likho.

### 17.1 Scene player (`scene.js`) — kadam-dar-kadam SVG diagram

`VISUALS['level-id'] = { t: 'Title', scene: { intro, aria, groups, nodes, steps } }`. Poora format `scene.js` ke upar likha hai.
Learner "Agla kadam →" dabata hai; har kadam = ek teer + chalta packet + neeche **ek** vaakya (`say`). Dabbe par click = `about`.

| Cheez | Hadd (validator fail karta hai) |
|---|---|
| node `label` | ≤ 20 akshar |
| node `sub` | ≤ 26 akshar |
| step `label` (teer par) | ≤ 28 akshar |
| `steps` | kam se kam 2; har step mein `say`; ya `from`+`to`, ya `at: [ids]` |
| ek grid cell (`col`,`row`) | ek hi dabba |
| `say` ke shabd | `yeh / woh / isse / usse / isko / usko` mana — dabbe ka **naam** likho |

- `set: { nodeId: { tone, sub } }` us kadam se dabbe ka rang/subtitle badal deta hai aur aage tak rehta hai (jaise pod `Pending` → `Running`).
- **Teer kisi teesre dabbe ke upar se nahi guzar sakta** (validator fail karta hai). Ek hi row/column mein ek dabba chhod kar
  jaana ho toh `bend: 110` do — teer rows ke beech ki khaali patti se ghoom kar jaata hai. Sabse achha: dabbon ko aise rakho
  ki teer sirf padosi dabbon ke beech chalein (seedha daayen/baayen/upar/neeche).
- **Label ki jagah engine khud chunta hai** (`placeLabel`): teer ke bagal mein; jagah na ho toh dabbon ke upar/neeche ki khaali
  patti mein; aakhri upaay mein teer ki line par. Label kabhi kisi dabbe ko nahi dhakta. Kahin jagah na mile toh validator bolta hai
  "label ke liye khaali jagah nahi" — tab label chhota karo ya layout badlo.
- Purana static `html` saath rakh sakte ho (hotspot game usi ko use karta hai). `scene` ho toh level intro mein scene dikhta hai.
- Naya scene likh kar `gallery.html` mein dekho, aur phone width (390px) par bhi.

### 17.2 Terminal ki madad (`terminal.js`) — mission mein learner ab atakta nahi

Har terminal mission ko yeh paanch cheezein **zaroori** hain: `tasks`, `success: KG.allOf(TASKS)`, `hints`, `successText`, `solution`.
`solution` sirf validator ke liye nahi hai — engine isi se learner ki madad banata hai:

| Feature | Kahan se aata hai |
|---|---|
| "👉 Ab kaam N: …" (abhi ka kaam highlight) | `tasks` ka kram. **Tasks usi kram mein likho jis kram mein learner unhe karega** |
| 🧰 "Is mission ke commands" palette (free) | `solution` ke commands ke **shape** (`kubectl get pods`, `velero backup describe` …) |
| 🆘 "Agla command dikhao" (−10 XP) | `solution` ka pehla command jo learner ne abhi tak nahi chalaya |
| Tab completion | verbs → kinds → cluster ke object/file naam |
| "Kya tumhara matlab … tha?" | edit distance se, object naam aur kind ke liye |
| Galat roop wala command | learner ka command `solution` ke kisi command jaisa ho toh sahi roop dikhta hai |

Niyam:
- `solution` ka **aakhri** command hi mission jitaaye (validator yahi jaanchta hai). Beech ke command par jeet = learner aadha mission chhod deta hai.
- `solution` mein har command wahi likho jo simulator sach mein samajhta hai. `node tools/replay-missions.js run` har mission ko replay karta hai.
- Arena ka DOM kram `[goalBox, terminal, buttons, palette]` hai. Validator `children[0..2]` padhta hai — naya element **aakhir** mein jodo.
- Mission ke `cluster` ke andar ke callbacks (`describe`, `logs`, `exec` function ho sakte hain) ko **missing function aur `[]` regex match** sahna
  chahiye: `validateMission` cluster ko JSON se clone karta hai, toh functions gir jaate hain.

### 17.3 Custom kinds — CRD ya koi bhi naya resource, bina engine chhede

```js
cluster: {
  custom: {
    pdb: { names: ['pdb', 'poddisruptionbudget', 'poddisruptionbudgets'],      // learner in mein se koi bhi likh sakta hai
           cols: ['NAME', 'MIN AVAILABLE', 'ALLOWED DISRUPTIONS', 'AGE'],
           items: [ { name: 'notify-pdb', row: ['1', '0', '40d'],              // row = NAME ke baad ke columns
                      describe: 'text'  /* ya (sim, item) => 'text' */, yaml: 'text' } ] },
  },
}
```

`kubectl get <kind>`, `get <kind> <naam>`, `get <kind>/<naam>`, `-o yaml`, `describe <kind> [naam]` aur Tab completion apne-aap chalte hain.
ServiceMonitor, HTTPRoute, Certificate, ClusterPolicy, PodIdentityAssociation — sab isi se bane hain (`data-observe.js`, `data-eksnet.js`,
`data-secure.js` mein misaalein). Jo command simulator nahi jaanta (velero, trivy, cosign, aws) uske liye mission ka `responses` use karo;
`err: true` us jawab ko error ke rang mein chhapta hai.

### 17.4 Flow player, hotspot, lesson pager, routing

- **Flow** (`type: 'flow'`): ab learner ke haath mein hai. Aage ke kadam chhupe rehte hain; "⏭ Agla kadam" / "⏮ Wapas" / "▶ Chalao (auto)".
  Auto ki raftaar text ki lambai se tay hoti hai. Step ke sawal ka jawab ek baar diya toh dobara nahi poocha jaata.
  `instructions` mein "▶ dabao" mat likho — likho "\"Agla kadam\" dabao".
- **Hotspot**: sahi jawab ke baad khud aage nahi badhta; "Agla sawal →" button hai (padhne ka samay learner tay kare).
- **Lesson pager**: `lesson` ke cards ek-ek karke dikhte hain ("Agla card →"). Isliye **har card apne aap mein poora ho** — "upar dekho" /
  "pichhle card mein" mat likho. Ek card = ek baat. Learner "saare cards ek saath" bhi chun sakta hai (`KG.state.lessonAll`).
- **Routing**: har screen ka hash hai — `#/`, `#/track/<id>`, `#/level/<id>`, `#/play/<id>`, `#/tree/<id>`, `#/lab/<id>`, `#/dojo`,
  `#/decisions`, `#/labs`. Browser ka Back button kaam karta hai. Nayi screen banao toh uske function ke shuru mein `setRoute('#/…')`
  bulao aur `app.js` ke `route()` mein uska case jodo. Band (locked) level ka link track page par le jaata hai.
- **Home**: sabse upar "agla kadam" card (`.resume-card.nextup`); har track card par "📍 Tum yahan ho" aur "Agla level: …".

### 17.5 Content ke niyam jo is pass mein validator ne pakde

1. **MCQ ki lambai.** Har track mein, sahi jawab "sabse lamba" ya "sabse chhota" 10% se zyada sawalon mein nahi ho sakta
   (sahi ≥ 1.15× sabse lambe galat se, ya ≤ 0.85× sabse chhote galat se). Sahi jawab **beech ki lambai** ka likho; ek galat jawab use lamba ho.
   Jaanch: `node tools/mcq-bias.js list <track>` (kuch na chhape = theek). Incident ke liye `--kind=incident`.
2. **Kachcha `<placeholder>` mana** HTML wale fields mein (`<pod>`, `<unknown>`): `&lt;pod&gt;` likho. `context` field ab chhoot mein hai (engine use escape karta hai).
3. **Slider ki shuruaati haalat**: `check` ko pehle se paas nahi karni chahiye, **aur** woh ek sach-mumkin haalat honi chahiye
   (jaise request ≤ limit). Galat shuruaat = learner galat cheez yaad karta hai.
4. **Ek kahani.** Naye tracks (`day2`, `observe`, `secure`, `eksnet`) sab **ChaiPay** company ki kahani hain: services `pay-api`, `ledger`
   (`ledger-0`), `notify`, `fraud-check`; namespace `payments`; EKS cluster `chaipay-prod`; account `111122223333`; region `ap-south-1`.
   Naya level inhi naamon ko dobara use kare. Real lab mein bhi wahi naam rakho jo us level ke mission mein the
   (Lab 19 mein hack hua pod `notify` hai, kyunki `sec-boss` mission mein bhi `notify` hai).
5. **Fill template**: `{0}..{n}` har placeholder theek ek baar. Template ko string functions se jodkar mat banao — seedha likho.
6. **Phone width.** Lambi cheezein (PromQL, `system:serviceaccount:…`, ARN) 390px par page ko chauda kar deti thi. CSS mein
   `overflow-wrap: anywhere` laga hai; naya chauda element banao toh 390px par dekho.
7. **Validator mein naya niyam jodo toh use ek baar FAIL karke dekho.** `validate.js` ka content wala block ek aam template string hai:
   uske andar regex ka backslash **double** likhna padta hai (`\\b`, `\\s`). Single `\b` chupchaap backspace ban jaata hai aur niyam
   kabhi nahi chalta — "caption mein yeh/woh mana" wala niyam isi wajah se likhe jaane ke din se hi band tha, aur 13 galat captions nikal gaye the. (`TESTS` block `String.raw` hai; wahan single theek hai.)

### 17.6 Browser mein jaanchna (validator ke alawa)

`node validate.js` DOM ko nakli banata hai — layout, overflow aur click ka kram nahi dekhta. Is pass mein har screen headless Chromium
(Playwright) se 1180px aur 390px par kholi gayi: page errors 0, horizontal overflow 0. Bada UI badlaav karo toh wahi dobara karo:
har level ka intro + har stage kholo, `document.documentElement.scrollWidth - clientWidth` 2px se kam ho, aur console/page error na ho.

**Jo is pass mein nahi hua:** purane 58 levels ka lesson text line-by-line dobara fact-check nahi hua (sirf version se jude
daavon ki khoj hui — etcd quorum, EndpointSlice, VPA in-place, Bitnami catalog theek hue); 58 purane diagrams mein se
17 scene bane (`controlplane`, `workernode`, `pod`, `deploy`, `service`, `config`, `scheduler`, `probes`, `storage`, `ingress`,
`netpol`, `autoscale`, `rbac`, `secrets`, `gitops`, `operators`, `istio`), baaki 41 abhi static `html` hain (Helm, ArgoCD,
Karpenter, KodeKloud tracks aur boss levels).

## 18. 🧪 `data-labs.js` — purane levels mein hands-on labs (2026-11-23 se)

User ne kaha: har level mein haath ka kaam ho. 2026-11-23 ko 16 levels mein sirf quiz / sort / match / fill tha. Un levels ke labs
**`data-labs.js`** mein jaate hain — level ki apni file mein nahi.

- `addLab(levelId, stage, extra)` = `KG.extendLevel(levelId, extra)` + stage ko us level ke 🎁 **bonus round se pehle** daalna
  (bonus na ho toh aakhir mein). `extra` mein ek `objectives` line, ek `success` line, aur 1–2 `cards` do — card Revision Dojo mein jaata hai.
- Kahani **ChaiPay** (§17.5): namespace `payments`, `pay-api`, `ledger`, `notify`, EKS `chaipay-prod`. Pehli line mein ek chhota
  parichay do ("ChaiPay (UPI payments startup) ki …") — beginner/intermediate learner ne production tracks shayad nahi dekhe.
- `-n payments` ke saath ya bina — dono chalein: scripted regex `rx('kubectl delete pvc reports-data')` se banao (`NS` jodta hai).
  `responses` builtins se **pehle** match hote hain aur `-n` abhi hata nahi hota — isliye yeh zaroori hai.
- **Galat fix bhi file ho**, aur uska jawab asli tool ka asli error ho (immutable PVC spec, RBAC Forbidden) ya `(simulator ne roka)`
  ke saath ek line ki wajah. Jo galat fix asli cluster mein chal jaata (HPA target 90%), use chalne do — asli nateeja khud sikhata hai.
- Fix ke **baad** ka verify-command task banao: `c.fixedAt = s.history.length` (apply ke andar) + `ranAfter(s, c.fixedAt, /…/)`.
- Har naya mission do baar chalao: `node tools/replay-missions.js run` (solution) **aur** ek galat-raaste wali `sols.json`
  (galat files, ulta kram, revert) — `run sols.json 'level|t0'` poora transcript chhapta hai.

Status (2026-11-23):
- Batch 1 (terminal): `storage` (PVC + StorageClass), `ingress` (IngressClass + pathType), `netpol` (default-deny: DNS +
  dono taraf allow), `autoscale` (HPA `<unknown>` = CPU request nahi).
- Batch 2 (✏️ YAML editor, §4): `config` (ConfigMap string + env ke liye rollout restart), `workloads` (CronJob UTC → `timeZone`),
  `podsecurity` (PSA restricted: `securityContext` sahi jagah + `runAsUser`), `secrets` (ExternalSecret `remoteRef.key` + pod restart).
- Batch 3 (2026-11-24): `whyk8s` (pod delete → self-healing; `replicas` file mein, `kubectl scale` = drift), `controlplane`
  (scheduler ki static pod file mein flag typo → pods Pending + `Events: <none>`; `onSave`), `affinity` (anti-affinity ka selector
  typo + zone `topologyKey` → asli rolling update atakta hai), `observability` (alert rule ka label + `for`; `promtool test rules`
  outage replay), `helm` (Kustomize `images:` ka naam image se match nahi → chupchaap 1.8.0).
- Batch 4 (2026-11-24): `helmtemplating` (notify chart: `range` ke andar `.Values` → `$`, `indent` → `nindent`; asli
  Go-template engine `gotpl.js`), `operators` (CNPG operator OOMKilled → "failed calling webhook … no endpoints"; Helm values se
  memory), `istio` (VS subset v2 DR mein nahi → `503 NC`; v2 bina sidecar + `ISTIO_MUTUAL` → TLS error). Naya lab type
  ⚡ **speed drill** (`drill.js`, §3) — drills `pod`, `deploy`, `kk-toolkit` mein. Ab saare 16 khaali levels mein hands-on hai.
- Batch 5 (2026-11-24): 🎲 **chaos mode** (`chaos.js`, §3) — chaos rounds `boss1` (level 1), `boss2` (2), `boss3` (3) mein.
  15 breakages, ek file se poora cluster (pods / describe / logs / events / endpoints / curl). Partial apply asli kubectl jaisa
  (jo doc theek, woh lagta hai; errors aakhir mein). `node tools/replay-missions.js run '' 'chaos|<id>'` (aur `chaos|a+b`) transcript deta hai.
- Batch 6 (2026-11-24): 📟 **on-call shift** (`oncall.js`, §3) — `boss2` mein "Diwali sale ki raat": 4 jude hue alerts, pager,
  report card. `node tools/replay-missions.js run '' 'oncall|sale'` poori shift ka transcript deta hai.
- Real labs: 2026-11-24 ko saare 19 asli kind cluster par test hue (§13) — 16–19 ka `untested` flag hata.
- Labs job part 2, batch 7 (2026-11-25): `oncall.js` generic shift engine bana; nayi file **`data-oncall.js`** (data-labs.js ke
  baad load) mein 2 nayi shifts — `d2-boss` ('patch') aur `ob-boss` ('blind'). `node tools/replay-missions.js run '' 'oncall|<shift>'`
  transcript deta hai. PDB (`get/describe pdb`, dono-set error, percent-string error, drain error), memory request > limit,
  Service targetPort errors, `describe svc`, `rollout history/undo` ke outputs 2026-11-25 ko asli kind (v1.37) se milaye.
  Velero (`schedule pause/unpause`, PAUSED column) cluster par NAHI jaancha — CLI download ki ijazat nahi mili.
- Real lab ke browser roop (2026-11-24): `d2-rightsize` = lab 17 (CPU throttling: `cpu.max`, `cpu.stat`, `set resources`, Pending),
  `sec-runtime` = lab 19 (quarantine ki NetworkPolicy starter ke TODO + 4 wget jaanch). Outputs asli cluster se pakde gaye; simulator
  ke do dawe (sirf-Ingress policy ke baad egress khula, egress band par naam se wget = `bad address`) cluster par dobara jaanche.
  Niyam: asli lab ka browser mission banao toh outputs cluster se pakdo, aur jo naya bartaav simulator dikhaye use cluster par chala kar milao.

**`gotpl.js` (`KG.gotpl`)** — chhota Go text/template + Sprig. `renderChart({ path: text }, ctx)` → `{ files }` ya `{ err }`.
Chalta hai: `{{- -}}` chomp, comments, `.a.b`, `$`, `$x :=`, `range` (list/map, `$i, $v :=`), `if / else if / else`, `with`,
`define / include / template`, pipelines, `( )`, aur Sprig ke aam functions (`toYaml nindent indent quote default required
trunc trimSuffix printf eq and or …`). Errors Helm jaise: `parse error at (f:L): function "x" not defined`,
`template: f:L:C: executing "f" at <.Values.x>: nil pointer evaluating interface {}.x`,
`… at <indent 10>: wrong type for value; expected string; got map[string]interface {}`, `execution error at (f:L:C): msg`.
Map ki missing key = khaali (Helm `missingkey=zero`). Naya function chahiye toh `FUNCS` mein jodo — validator ka `gotpl:` test bhi badhao.

Batch 3 ke chhote engines (sab `data-labs.js` ke andar, mission-specific):
- `tbl(rows)` — kubectl jaisi table. `deployChecks(file, doc)` — Deployment file ke aam API errors (strict decoding `spec.*`,
  `replicas` ka type, selector immutable, template labels).
- **affinity:** `afSchedule` (taint → CPU → required anti-affinity filter; preferred weight + free CPU score; asli
  `0/4 nodes are available: …` message) aur `afRoll` (maxSurge / maxUnavailable wala rolling update; atke pods dobara try).
- **observability:** `pqParse` / `pqEval` — chhota PromQL (selector + matchers, `rate/irate/increase`, `sum/avg/max/min/count by|without`,
  `+ - * /`, comparisons). `obTest` = `promtool test rules`: test file ke asli `input_series` (`0+1000x2` notation) se har minute
  alert ki state, `for` ke saath; output promtool jaisa (`FAILED: … exp:[…], got:[]`).
- **helm (Kustomize):** `kzBuild` (resources → patches (strategic merge) → namespace → commonLabels/labels → replicas → images,
  asli `IsImageMatched` niyam) aur `kzDump` (kustomize jaisa YAML: apiVersion/kind/metadata upar, baaki keys A→Z).

