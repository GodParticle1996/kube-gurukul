/* =====================================================================
   KubeGurukul — 🎲 Chaos decks: production tracks ke boss levels mein
   (2026-11-25, labs job part 2 ka batch 11). Engine: chaos.js
   (KG.chaos.addDeck). Har deck = ek git file + us file se poore cluster
   ki haalat. Chaos monkey file mein ek galti daalta hai; learner saboot
   se dhoondhta hai aur FILE theek karta hai.

   Decks:
     'helm'   helmship       values-prod.yaml (chart chaipay/notify 3.3.0, values.schema.json)
     'argo'   argoboss       pay-api-app.yaml (ArgoCD Application)
     'karp'   karpenterboss  nodepool-batch.yaml (Karpenter NodePool "batch")

   Helm 4 ke error formats 2026-11-25 ko kind + Helm v4.3.2 se milaye:
   schema ("- at '/replicaCount': got string, want integer", "minimum: got 0,
   want 1"), values file ka YAML error ("cannot unmarshal yaml document: …").
   Yeh file data-oncall.js ke BAAD load hoti hai.
   ===================================================================== */
(function () {
  const tbl = KG.oncall.tbl;
  const ECR = '111122223333.dkr.ecr.ap-south-1.amazonaws.com';
  function addLab(levelId, stage, extra) {
    const lvl = KG.extendLevel(levelId, extra || {});
    const i = lvl.stages.findIndex(s => s.bonus);
    lvl.stages.splice(i < 0 ? lvl.stages.length : i, 0, stage);
  }
  const applyBreaks = (base, B, ids) => ids.reduce((t, id) => t.replace(B.find(b => b.id === id).from, B.find(b => b.id === id).to), base);
  const memMi = q => { const m = String(q == null ? '' : q).match(/^(\d+(?:\.\d+)?)(Mi|Gi)?$/); return m ? Number(m[1]) * (m[2] === 'Gi' ? 1024 : 1) : NaN; };
  // values / NodePool file mein indentation ki galti: asli YAML parser pichhli line ka number batata hai
  function indentErr(text) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim() || /^\s*#/.test(l)) continue;
      const ind = l.match(/^ */)[0].length;
      if (ind % 2 === 1) return i;   // i = 0-based → pichhli line ka 1-based number = i
    }
    return -1;
  }

  /* =====================================================================
     🎲 Deck 'helm' — helmship: values-prod.yaml (notify chart 3.3.0)
     ===================================================================== */
  (function () {
    const FILE = 'values-prod.yaml';
    const BASE = `# notify — production values (chart chaipay/notify 3.3.0)
replicaCount: 2
image:
  tag: "3.3.0"
sms:
  provider: gupshup
  apiKeySecret: notify-gupshup-key
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    memory: 512Mi
service:
  port: 80
  targetPort: 8080
`;
    const BREAKS = [
      { id: 'replica-string', level: 1, title: 'replicaCount quotes mein', from: 'replicaCount: 2\n', to: 'replicaCount: "2"\n', fix: 'replicaCount: "2" ke quotes hatao (2)',
        clue: 'bash ci-deploy.sh — helm upgrade kis value par ruka? Chart ka values.schema.json kya maangta hai?',
        reveal: '<code>replicaCount: "2"</code> — quotes ne number ko <b>string</b> bana diya. Chart ka <code>values.schema.json</code> integer maangta hai → Helm ne upgrade shuru hi nahi kiya: <code>at \'/replicaCount\': got string, want integer</code>.' },
      { id: 'replica-zero', level: 1, title: 'replicaCount: 0', from: 'replicaCount: 2\n', to: 'replicaCount: 0\n', fix: 'replicaCount: 0 ko 2 karo',
        clue: 'bash ci-deploy.sh — schema ki kaunsi seema tooti?',
        reveal: '<code>replicaCount: 0</code> — schema mein <code>minimum: 1</code> hai → <code>minimum: got 0, want 1</code>. Schema ne ek "khaali notify" deploy hone se bacha liya.' },
      { id: 'image-tag', level: 1, title: 'image tag mein O', from: '  tag: "3.3.0"', to: '  tag: "3.3.O"', fix: 'image.tag "3.3.O" ko "3.3.0" karo (zero)',
        clue: 'Upgrade ho gaya, par naye pods ImagePullBackOff. kubectl describe pod — kaunsa tag maanga?',
        reveal: 'Tag <code>3.3.O</code> (angrezi O) — ECR mein hai hi nahi → <code>ImagePullBackOff</code>. Schema string ke andar typo nahi pakad sakta.' },
      { id: 'secret-name', level: 1, title: 'Secret ka naam galat', from: '  apiKeySecret: notify-gupshup-key', to: '  apiKeySecret: notify-sms', fix: 'sms.apiKeySecret notify-sms ko notify-gupshup-key karo',
        clue: 'Naye pods CreateContainerConfigError. kubectl describe pod / kubectl get events — kaunsa Secret nahi mila? kubectl get secrets',
        reveal: '<code>sms.apiKeySecret: notify-sms</code> — prod ka Secret <code>notify-gupshup-key</code> hai → <code>Error: secret "notify-sms" not found</code>, container bana hi nahi.' },
      { id: 'yaml-indent', level: 2, title: 'YAML indentation', from: '  apiKeySecret: notify-gupshup-key', to: ' apiKeySecret: notify-gupshup-key', fix: 'apiKeySecret ke aage 2 space (1 nahi)',
        clue: 'bash ci-deploy.sh — Helm file hi nahi padh paaya. Error kaunsi line batata hai? Us line ke aas-paas spaces gino.',
        reveal: '<code>apiKeySecret</code> ke aage <b>1 space</b> — YAML ke liye na <code>sms</code> ka bachcha, na top-level → <code>did not find expected key</code>. Error pichhli line ka number batata hai.' },
      { id: 'oom', level: 2, title: 'memory bahut kam', from: '    memory: 256Mi\n  limits:\n    memory: 512Mi', to: '    memory: 64Mi\n  limits:\n    memory: 96Mi', fix: 'memory requests 256Mi, limits 512Mi wapas',
        clue: 'Naye pods CrashLoopBackOff. kubectl describe pod — Last State ka Reason aur Exit Code? values mein memory?',
        reveal: 'Memory limit <b>96Mi</b> — notify (JVM) ko ~300Mi chahiye → <code>OOMKilled</code> (exit 137) → CrashLoopBackOff.' },
      { id: 'target-port', level: 2, title: 'service.targetPort galat', from: '  targetPort: 8080', to: '  targetPort: 80', fix: 'service.targetPort 80 ko 8080 karo',
        clue: 'Pods 1/1 Running, phir bhi curl fail. kubectl get endpoints notify — kis PORT par? App kis port par sunti hai (logs)?',
        reveal: '<code>service.targetPort: 80</code> — Service traffic pod ke port 80 par bhejti hai, notify 8080 par sunta hai → connection refused. Pods theek dikhte the, isliye galti chhupi rahi.' },
      { id: 'provider', level: 2, title: 'SMS provider ka typo', from: '  provider: gupshup', to: '  provider: gupshop', fix: 'sms.provider gupshop ko gupshup karo',
        clue: 'Naye pods CrashLoopBackOff, exit 1 (137 nahi). kubectl logs <pod> --previous — app kya kehti hai?',
        reveal: '<code>sms.provider: gupshop</code> — app sirf gupshup / msg91 / twilio jaanti hai → start par hi <code>fatal</code>, exit 1. Schema mein <code>enum</code> hota toh deploy se pehle pakda jaata.' },
    ];
    const NEW = 'notify-5e8a2d6c1', OLD = 'notify-7c4f9b8d2';
    const GOOD_OLD = { replicaCount: 2, image: { tag: '3.2.1' }, smsSecret: 'notify-gupshup-key', resources: { requests: { cpu: '100m', memory: '256Mi' }, limits: { memory: '512Mi' } }, service: { port: 80, targetPort: 8080 } };
    // helm upgrade -f values-prod.yaml → { err } ya { values }
    function render(text) {
      const bad = indentErr(text);
      if (bad >= 0) return { err: `Error: failed to parse ${FILE}: cannot unmarshal yaml document: error converting YAML to JSON: yaml: line ${bad}: did not find expected key` };
      let v;
      try { v = KG.yaml.parseAll(text)[0] || {}; } catch (e) { return { err: `Error: failed to parse ${FILE}: cannot unmarshal yaml document: error converting YAML to JSON: yaml: line ${(e && e.line) || 1}: ${(e && e.message) || 'could not find expected \':\''}` }; }
      const rc = v.replicaCount;
      if (rc != null && typeof rc !== 'number') return { err: `Error: UPGRADE FAILED: values don't meet the specifications of the schema(s) in the following chart(s):\nnotify:\n- at '/replicaCount': got ${typeof rc}, want integer` };
      if (typeof rc === 'number' && rc < 1) return { err: `Error: UPGRADE FAILED: values don't meet the specifications of the schema(s) in the following chart(s):\nnotify:\n- at '/replicaCount': minimum: got ${rc}, want 1` };
      if (rc > 6) return { err: '(simulator ne roka) 6 se zyada replicas nahi — SMS gateway ki rate limit.' };
      if (!v.sms || typeof v.sms !== 'object') return { err: 'Error: UPGRADE FAILED: notify/templates/deployment.yaml:45:31\n  executing "notify/templates/deployment.yaml" at <.Values.sms.provider>:\n    nil pointer evaluating interface {}.provider' };
      return { values: v };
    }
    function podState(v) {
      const tag = String(((v.image || {}).tag) || '3.3.0');
      if (!['3.3.0', '3.2.1'].includes(tag)) return { st: 'ImagePullBackOff', why: 'image', tag };
      const sec = (v.sms || {}).apiKeySecret || v.smsSecret;
      if (sec !== 'notify-gupshup-key') return { st: 'CreateContainerConfigError', why: 'secret', sec };
      if (v.sms && !['gupshup', 'msg91', 'twilio'].includes(v.sms.provider)) return { st: 'CrashLoopBackOff', why: 'provider' };
      const lim = memMi((((v.resources || {}).limits) || {}).memory);
      if (!(lim >= 300)) return { st: 'CrashLoopBackOff', why: 'oom' };
      return { st: 'Running' };
    }
    function views(c) {
      const v = c.live, ver = c.liveVer, ps = podState(v), n = v.replicaCount || 2, newBad = ver === '3.3.0' && ps.st !== 'Running';
      const mk = (pre, i, st, age) => ({ name: `${pre}-${['k2x7q', 'm4p8t', 'r8w3z', 'c5n1v', 'h6j2b', 'q9d4s'][i]}`, app: 'notify', ready: st === 'Running' ? '1/1' : '0/1', status: st, restarts: st === 'CrashLoopBackOff' ? 4 + c.clock : 0, age, node: 'node-' + (1 + i % 3), ip: '10.0.1' + (2 + i % 3) + '.' + (70 + i) });
      let pods;
      if (ver === '3.2.1') pods = Array.from({ length: 2 }, (_, i) => mk(OLD, i, 'Running', '6d'));
      else if (newBad) pods = Array.from({ length: 2 }, (_, i) => mk(OLD, i, 'Running', '6d')).concat([mk(NEW, 2, ps.st, (4 + c.clock) + 'm')]);   // rolling update atka: purane chal rahe, naya fail
      else pods = Array.from({ length: n }, (_, i) => mk(NEW, i, 'Running', (c.upAt != null ? c.clock - c.upAt : 4 + c.clock) + 'm'));
      pods.forEach(p => {
        if (!p.name.startsWith(NEW) || p.status === 'Running') return;
        const ev = ps.why === 'image' ? `  Warning  Failed     1m (x4)   kubelet  Failed to pull image "${ECR}/notify:${ps.tag}": rpc error: code = NotFound desc = failed to pull and unpack image "${ECR}/notify:${ps.tag}": failed to resolve reference "${ECR}/notify:${ps.tag}": ${ECR}/notify:${ps.tag}: not found\n  Warning  Failed     1m (x4)   kubelet  Error: ErrImagePull`
          : ps.why === 'secret' ? `  Warning  Failed     20s (x6)  kubelet  Error: secret "${ps.sec}" not found`
            : `  Warning  BackOff    20s (x9)  kubelet  Back-off restarting failed container notify in pod ${p.name}_payments(4e1c…)`;
        const last = ps.why === 'oom' ? '    Last State:     Terminated\n      Reason:       OOMKilled\n      Exit Code:    137\n' : ps.why === 'provider' ? '    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1\n' : '';
        p.describe = `Name:             ${p.name}\nNamespace:        payments\nStatus:           ${p.status === 'CrashLoopBackOff' ? 'Running' : 'Pending'}\nContainers:\n  notify:\n    Image:          ${ECR}/notify:${ps.tag || (v.image || {}).tag}\n    State:          Waiting\n      Reason:       ${p.status}\n${last}    Limits:\n      memory:  ${(((v.resources || {}).limits) || {}).memory}\n    Environment:\n      SMS_PROVIDER:  ${(v.sms || {}).provider}\n      SMS_API_KEY:   <set to the key 'apiKey' in secret '${(v.sms || {}).apiKeySecret}'>  Optional: false\nEvents:\n  Type     Reason     Age       From     Message\n  ----     ------     ----      ----     -------\n${ev}`;
      });
      c.pods = pods.concat([{ name: 'sleep-6c8d9f-x1', app: '', ready: '1/1', status: 'Running', restarts: 0, age: '40d', node: 'node-1', ip: '10.0.12.9' }]);
      const tp = Number(((v.service || {}).targetPort) || 8080);
      const ready = pods.filter(p => p.status === 'Running');
      c.services = [{ name: 'notify', type: 'ClusterIP', clusterIP: '10.100.44.7', ports: '80/TCP', age: '120d' }];
      c.endpoints = [{ name: 'notify', endpoints: ready.map(p => p.ip + ':' + tp).join(',') || '<none>', age: '120d' }];
      c.deployments = [{ name: 'notify', ready: `${ready.length}/${newBad ? 2 : pods.length}`, upToDate: newBad ? 1 : pods.length, available: ready.length, age: '120d' }, { name: 'sleep', ready: '1/1', upToDate: 1, available: 1, age: '40d' }];
      c.secrets = [{ name: 'ledger-db', type: 'Opaque', dataCount: 2, age: '120d' }, { name: 'notify-gupshup-key', type: 'Opaque', dataCount: 1, age: '120d' }];
      const ev = [['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE']];
      pods.filter(p => p.status !== 'Running').forEach(p => ev.push(['20s', 'Warning', ps.why === 'image' ? 'Failed' : ps.why === 'secret' ? 'Failed' : 'BackOff', 'pod/' + p.name,
        ps.why === 'image' ? `Failed to pull image "${ECR}/notify:${ps.tag}": … not found` : ps.why === 'secret' ? `Error: secret "${ps.sec}" not found` : `Back-off restarting failed container notify in pod ${p.name}_payments(4e1c…)`]));
      c.events = ev.length > 1 ? tbl(ev).split('\n') : ['No events found in payments namespace.'];
      c.svcOk = tp === 8080;
      c.healthy = ver === '3.3.0' && !newBad && pods.every(p => p.status === 'Running') && c.svcOk;
    }
    function upgrade(s) {
      const c = s.cluster, text = (s.edited && s.edited[FILE] != null) ? s.edited[FILE] : s.files[FILE].content, r = render(text);
      if (r.err) return r.err;
      c.live = r.values; c.liveVer = '3.3.0'; c.rev++; c.curlOk = false; c.upAt = c.clock;
      c.hist.push([c.rev, 'deployed', '3.3.0', 'Upgrade complete']);
      c.hist.forEach((h, i) => { if (i < c.hist.length - 1 && h[1] === 'deployed') h[1] = 'superseded'; });
      views(c);
      return `Release "notify" has been upgraded. Happy Helming!\nNAME: notify\nLAST DEPLOYED: Wed Nov 25 18:${String(10 + c.rev).padStart(2, '0')}:12 2026\nNAMESPACE: payments\nSTATUS: deployed\nREVISION: ${c.rev}\nDESCRIPTION: Upgrade complete`;
    }
    function mission(ids) {
      const text = applyBreaks(BASE, BREAKS, ids), B = ids.map(id => BREAKS.find(b => b.id === id));
      const c = { clock: 0, rev: 13, live: GOOD_OLD, liveVer: '3.2.1', hist: [[12, 'superseded', '3.2.0', 'Upgrade complete'], [13, 'deployed', '3.2.1', 'Upgrade complete']], curlOk: false, upAt: null };
      const r0 = render(text);
      if (!r0.err) { c.live = r0.values; c.liveVer = '3.3.0'; c.rev = 14; c.hist[1][1] = 'superseded'; c.hist.push([14, 'deployed', '3.3.0', 'Upgrade complete']); }
      c.ciErr = r0.err || null;
      views(c);
      const T = [
        { text: 'Wajah dhoondho — <code>bash ci-deploy.sh</code>, <code>helm history</code>, <code>kubectl describe</code> / <code>logs</code> / endpoints', check: s => s.history.some(h => /^bash ci-deploy\.sh|^helm (history|status|get)|^kubectl (describe|logs|get (events?|endpoints?|ep|secrets?))\b/.test(h)) },
        { text: '<code>values-prod.yaml</code> theek karke <code>helm upgrade … -f values-prod.yaml</code> — notify 3.3.0 ke saare pods <b>1/1 Running</b> aur Service sahi port par', check: s => !!s.cluster.healthy },
        { text: 'Andar se test: <code>kubectl exec deploy/sleep -- curl -s http://notify/healthz</code> → <b>ok</b>', check: s => !!s.cluster.healthy && !!s.cluster.curlOk },
      ];
      const UP = 'helm upgrade notify chaipay/notify --version 3.3.0 -n payments -f values-prod.yaml';
      return {
        type: 'terminal', chaos: ids.slice(), title: '🎲 Chaos round (Helm values)',
        instructions: 'Shaam 6 baje CI ne notify ka chart 3.3.0 production par bheja. 🎲 Chaos monkey ne git ki values-prod.yaml mein KUCHH toda hai — kya, yeh tumhe dhoondhna hai. Kabhi Helm deploy hi nahi karta, kabhi deploy ho jaata hai par pods toot-te hain.',
        goal: `notify 3.3.0 ko zinda karo: <code>${UP}</code> safal, saare pods <b>1/1 Running</b>, aur Service ke zariye <code>curl</code> par <b>ok</b>.
          Fix sirf FILE mein: <code>vi values-prod.yaml</code> → 💾 Save → <code>bash ci-deploy.sh</code> (ya upar wala helm upgrade).`,
        tasks: T, cluster: c,
        responses: [
          { re: /^helm upgrade notify\b(.*)$/, out: (s, m) => /--set\b/.test(m[1]) ? '(simulator ne roka) --set se jodi value git mein nahi rehti — agla CI deploy phir wahi galti laayega. values-prod.yaml theek karo.' : upgrade(s) },
          { re: /^helm (?:history|hist) notify\b.*$/, out: s => tbl([['REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION', 'DESCRIPTION']].concat(s.cluster.hist.map(h => [h[0], 'Wed Nov 25 18:0' + (h[0] % 10) + ':12 2026', h[1], 'notify-' + h[2], h[2], h[3]]))) },
          { re: /^helm (?:list|ls|status notify)\b.*$/, out: s => `NAME: notify\nNAMESPACE: payments\nSTATUS: deployed\nREVISION: ${s.cluster.rev}\nCHART: notify-${s.cluster.liveVer}` },
          { re: /^helm get values notify\b.*$/, out: s => 'USER-SUPPLIED VALUES:\n' + JSON.stringify(s.cluster.live, null, 2).replace(/[{}",]/g, '').split('\n').filter(l => l.trim()).join('\n') },
          { re: /^helm show values\b.*$/, out: 'replicaCount: 2\nimage:\n  tag: "3.3.0"\nsms:\n  provider: gupshup      # gupshup | msg91 | twilio\n  apiKeySecret: notify-sms\nresources: {}\nservice:\n  port: 80\n  targetPort: 8080       # notify isi port par sunta hai\n(values.schema.json: replicaCount integer, minimum 1)' },
          { re: /^helm\b.*$/, err: true, out: 'Is round mein: bash ci-deploy.sh · helm history notify · helm status notify · helm get values notify · helm show values chaipay/notify --version 3.3.0 · ' + UP },
          { re: /^kubectl logs\b.*$/,
            out: (s, m) => { const c2 = s.cluster, name = (String(m[0]).split(/\s+/).slice(2).filter(t => !/^-/.test(t))[0]) || '', p = c2.pods.find(x => x.name === name || (name.startsWith('deploy') && x.app === 'notify'));
              if (!p) return `Error from server (NotFound): pods "${name}" not found`;
              const ps = podState(c2.live);
              if (p.name.startsWith(NEW) && ps.why === 'provider') return '{"level":"info","msg":"notify 3.3.0 starting"}\n{"level":"fatal","msg":"config: unknown sms.provider \\"' + c2.live.sms.provider + '\\" (allowed: gupshup, msg91, twilio)"}';
              if (p.name.startsWith(NEW) && ps.why === 'oom') return '{"level":"info","msg":"notify 3.3.0 starting"}\n{"level":"info","msg":"sms queue drain shuru","queued":18234}';
              if (p.status !== 'Running') return `Error from server (BadRequest): container "notify" in pod "${p.name}" is waiting to start: ${p.status}`;
              return `{"level":"info","msg":"notify ${p.name.startsWith(NEW) ? '3.3.0' : '3.2.1'} listening","port":8080}\n{"level":"info","msg":"sms sent","provider":"gupshup"}`; } },
          { re: /^kubectl exec\b.*-- curl\b.*$/,
            out: s => { const c2 = s.cluster; if (!c2.pods.some(p => p.app === 'notify' && p.status === 'Running')) return 'curl: (7) Failed to connect to notify port 80 after 3 ms: Couldn\'t connect to server\ncommand terminated with exit code 7';
              if (!c2.svcOk) return `curl: (7) Failed to connect to notify port 80 after 2 ms: Couldn't connect to server\ncommand terminated with exit code 7\n(simulator: endpoints ${c2.endpoints[0].endpoints})`;
              c2.curlOk = c2.healthy; return c2.healthy ? 'ok' : 'ok\n(simulator: abhi purane 3.2.1 pods jawab de rahe hain — 3.3.0 abhi chala nahi)'; } },
          { re: /^kubectl (?:edit|patch|set|scale|rollout undo)\b.*$/, err: true, out: '(simulator ne roka) notify Helm se chalta hai — kubectl se badla toh agla helm upgrade palat dega. Ilaaj values-prod.yaml mein.' },
        ],
        files: {
          [FILE]: { editable: true, rawApply: true, desc: 'notify ki production values (git)', content: text, saveTip: 'Ab: bash ci-deploy.sh (ya ' + UP + ')',
            apply: () => ({ err: 'error: values-prod.yaml Kubernetes manifest nahi, Helm values hain. Lagane ke liye: bash ci-deploy.sh' }) },
          'ci-deploy.sh': { desc: 'CI ka deploy step', content: '#!/bin/sh\n' + UP + '\n', apply: s => '$ ' + UP + '\n' + upgrade(s) },
        },
        success: KG.allOf(T),
        successText: `<b>🎲 Kya toota tha:</b><br>${B.map(b => '• <b>' + b.title + ':</b> ' + b.reveal).join('<br>')}<br>
          <b>Kram yaad rakho:</b> Helm ruka (parse / schema / template) → error ki line padho · deploy hua par pods toote → describe / logs · pods theek par curl fail → endpoints aur targetPort.
          <code>values.schema.json</code> galat type / seema deploy se PEHLE rokta hai — enum jodo toh typo bhi.`,
        hints: ['bash ci-deploy.sh — Helm ruka ya deploy hua? Phir kubectl get pods; toote pod ka kubectl describe pod / kubectl logs --previous; sab 1/1 ho toh kubectl get endpoints notify.',
          B.map(b => b.clue).join(' ║ '), 'vi values-prod.yaml — ' + B.map(b => b.fix).join('; ') + '. Save, bash ci-deploy.sh, kubectl get pods, phir curl.'],
        solution: ['bash ci-deploy.sh', 'kubectl get pods'].concat(B.some(b => ['image-tag', 'secret-name', 'oom', 'provider'].includes(b.id)) ? [`kubectl describe pod ${NEW}-r8w3z`] : [], B.some(b => b.id === 'target-port') ? ['kubectl get endpoints notify'] : [],
          [{ edit: FILE, change: B.map(b => [b.to, b.from]) }, 'bash ci-deploy.sh', 'kubectl get pods', 'kubectl exec deploy/sleep -- curl -s http://notify/healthz']),
      };
    }
    KG.chaos.addDeck({ id: 'helm', file: FILE, BREAKS, BASE, mission });
  })();

  addLab('helmship', { type: 'chaos', id: 'chaos-helm', deck: 'helm', level: 2, title: '🎲 Chaos Round: values-prod.yaml mein kya toota?',
    intro: 'Helm deck: schema, YAML indentation, image tag, Secret ka naam, memory, targetPort, provider ka typo.' }, {
    objectives: ['🎲 <b>Chaos round (Helm):</b> random tooti values file — Helm ruka ya pods toote, khud pakdo'],
    success: ['Main Helm ke "deploy hi nahi hua" aur "deploy hua par toota" mein farak karke values file theek kar sakta hoon'],
    cards: [{ front: 'Helm 4: "values don\'t meet the specifications of the schema(s) … at \'/replicaCount\': got string, want integer" — kya karo?', back: 'values file mein <code>replicaCount: "2"</code> jaisa quote wala number. Quotes hatao. Schema ne galat type ko deploy se pehle roka.' }],
  });
  /* =====================================================================
     🎲 Deck 'argo' — argoboss: pay-api-app.yaml (ArgoCD Application)
     Naye cluster par bootstrap: Application lagi, par pay-api aaya hi nahi.
     ===================================================================== */
  (function () {
    const FILE = 'pay-api-app.yaml', REPO = 'https://github.com/chaipay/chaipay-gitops';
    const BASE = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pay-api
  namespace: argocd
spec:
  project: payments
  source:
    repoURL: ${REPO}
    targetRevision: main
    path: pay-api
  destination:
    server: https://kubernetes.default.svc
    namespace: payments
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
`;
    const GEN = 'Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = ';
    const BREAKS = [
      { id: 'repo-url', level: 1, title: 'repoURL ka typo', from: `repoURL: ${REPO}\n`, to: `repoURL: ${REPO.replace('gitops', 'gitop')}\n`, fix: 'repoURL chaipay-gitop ko chaipay-gitops karo',
        clue: 'argocd app get pay-api — CONDITION mein kya likha hai? argocd repo list — ArgoCD ko kaunsa repo pata hai? Dono URL akshar-akshar milao.',
        reveal: '<code>repoURL: …/chaipay-gitop</code> (s gayab) — aisa repo hai hi nahi → <code>ComparisonError … repository not found</code>. ArgoCD manifests bana hi nahi paaya, isliye kuch sync nahi hua.' },
      { id: 'revision', level: 1, title: 'targetRevision ka typo', from: '    targetRevision: main\n', to: '    targetRevision: mian\n', fix: 'targetRevision mian ko main karo',
        clue: 'argocd app get pay-api — CONDITION ka message: kis naam ko commit SHA mein badal nahi paaya?',
        reveal: '<code>targetRevision: mian</code> — na branch, na tag → <code>unable to resolve \'mian\' to a commit SHA</code>.' },
      { id: 'path', level: 1, title: 'path galat', from: '    path: pay-api\n', to: '    path: payapi\n', fix: 'path payapi ko pay-api karo',
        clue: 'argocd app get pay-api — "app path does not exist" kaunsa path? Repo mein folder ka naam kya hai (argocd app get ka Path aur runbook)?',
        reveal: '<code>path: payapi</code> — repo mein folder <code>pay-api</code> hai → <code>payapi: app path does not exist</code>.' },
      { id: 'project', level: 2, title: 'galat AppProject', from: '  project: payments\n', to: '  project: platform\n', fix: 'project platform ko payments karo',
        clue: 'argocd app get pay-api — InvalidSpecError. argocd proj get platform — yeh project kin namespaces mein deploy karne deta hai?',
        reveal: '<code>project: platform</code> — platform project sirf <code>platform-*</code> namespaces mein deploy karne deta hai → <code>InvalidSpecError</code>. AppProject = ArgoCD ki suraksha deewar.' },
      { id: 'namespace', level: 2, title: 'destination namespace ka typo', from: '    namespace: payments\n  syncPolicy', to: '    namespace: payment\n  syncPolicy', fix: 'destination.namespace payment ko payments karo',
        clue: 'Manifests ban gaye par sync fail. argocd app get pay-api — Message kya hai? kubectl get ns',
        reveal: '<code>destination.namespace: payment</code> (s gayab) — aisa namespace nahi, aur <code>CreateNamespace=true</code> bhi nahi → <code>namespaces "payment" not found</code>.' },
      { id: 'manual', level: 2, title: 'auto-sync gayab', from: '  syncPolicy:\n    automated:\n      prune: true\n      selfHeal: true\n', to: '  syncPolicy: {}\n', fix: 'syncPolicy mein automated (prune: true, selfHeal: true) wapas',
        clue: 'Koi error nahi — bas OutOfSync / Missing. argocd app get pay-api — Sync Policy kya hai?',
        reveal: '<code>syncPolicy: {}</code> — automated hi nahi. Error koi nahi, ArgoCD bas intezaar karta raha ki koi sync dabaye. Haath se sync kaam chala dega, par agla commit phir nahi aayega.' },
    ];
    function derive(app) {
      const sp = app.spec || {}, src = sp.source || {}, dst = sp.destination || {};
      const auto = !!((sp.syncPolicy || {}).automated);
      if (sp.project !== 'payments') return { cond: ['InvalidSpecError', `application destination server '${dst.server}' and namespace '${dst.namespace}' do not match any of the allowed destinations in project '${sp.project}'`], sync: 'Unknown', health: 'Missing', auto };
      if (src.repoURL !== REPO) return { cond: ['ComparisonError', GEN + 'failed to list refs: repository not found'], sync: 'Unknown', health: 'Missing', auto };
      if (src.targetRevision !== 'main' && src.targetRevision !== 'HEAD') return { cond: ['ComparisonError', GEN + `unable to resolve '${src.targetRevision}' to a commit SHA`], sync: 'Unknown', health: 'Missing', auto };
      if (src.path !== 'pay-api') return { cond: ['ComparisonError', GEN + `${src.path}: app path does not exist`], sync: 'Unknown', health: 'Missing', auto };
      if (dst.namespace !== 'payments') return { op: `one or more objects failed to apply, reason: namespaces "${dst.namespace}" not found`, sync: 'OutOfSync', health: 'Missing', auto };
      return { sync: auto ? 'Synced' : 'OutOfSync', health: auto ? 'Healthy' : 'Missing', auto, ok: true };
    }
    function views(c) {
      const d = c.state, up = d.ok && (d.auto || c.manualSynced);
      c.pods = (up ? ['pay-api-6b8d7c-a1', 'pay-api-6b8d7c-b2'].map((n, i) => ({ name: n, app: 'pay-api', ready: '1/1', status: 'Running', restarts: 0, age: '1m', node: 'node-' + (1 + i), ip: '10.0.1' + (2 + i) + '.41' })) : [])
        .concat([{ name: 'sleep-6c8d9f-x1', ready: '1/1', status: 'Running', restarts: 0, age: '2h', node: 'node-1', ip: '10.0.12.9' }]);
      c.healthy = up && d.auto;
      c.apps = [{ name: 'pay-api', project: (c.app.spec || {}).project, sync: up ? 'Synced' : d.sync, health: up ? 'Healthy' : d.health, revision: 'e7f3a91', destNamespace: ((c.app.spec || {}).destination || {}).namespace, syncPolicy: { automated: d.auto ? { prune: true, selfHeal: true } : null } }];
    }
    function appGet(c) {
      const sp = c.app.spec || {}, src = sp.source || {}, dst = sp.destination || {}, d = c.state, up = d.ok && (d.auto || c.manualSynced);
      return `Name:               argocd/pay-api\nProject:            ${sp.project}\nServer:             ${dst.server}\nNamespace:          ${dst.namespace}\nURL:                https://argocd.chaipay.in/applications/pay-api\nSource:\n- Repo:             ${src.repoURL}\n  Target:           ${src.targetRevision}\n  Path:             ${src.path}\nSyncWindow:         Sync Allowed\nSync Policy:        ${d.auto ? 'Automated (Prune)' : 'Manual'}\nSync Status:        ${up ? 'Synced to main (e7f3a91)' : d.sync}\nHealth Status:      ${up ? 'Healthy' : d.health}` +
        (d.cond ? `\n\nCONDITION          MESSAGE                                                    LAST TRANSITION\n${d.cond[0].padEnd(19)}${d.cond[1]}  2026-11-25 18:04:11 +0530 IST` : '') +
        (d.op ? `\n\nOperation:          Sync\nPhase:              Failed\nMessage:            ${d.op}` : '') +
        (up ? '\n\nGROUP  KIND        NAMESPACE  NAME     STATUS  HEALTH   HOOK  MESSAGE\n       Service     payments   pay-api  Synced  Healthy        service/pay-api created\napps   Deployment  payments   pay-api  Synced  Healthy        deployment.apps/pay-api created' : '');
    }
    function mission(ids) {
      const text = applyBreaks(BASE, BREAKS, ids), B = ids.map(id => BREAKS.find(b => b.id === id));
      const c = { app: KG.yaml.parseAll(text)[0], manualSynced: false };
      c.state = derive(c.app); views(c);
      const T = [
        { text: 'Wajah dhoondho — <code>argocd app get pay-api</code>, <code>argocd repo list</code>, <code>argocd proj get</code>, <code>kubectl get ns</code>', check: s => s.history.some(h => /^argocd (app get|repo list|proj (get|list))|^kubectl get (ns|namespaces?|applications?|app)\b/.test(h)) },
        { text: '<code>pay-api-app.yaml</code> theek karke <code>kubectl apply -f pay-api-app.yaml</code> — app <b>Synced + Healthy</b>, auto-sync ON', check: s => !!s.cluster.healthy },
        { text: 'pay-api ke pods <b>1/1 Running</b> dekho (<code>kubectl get pods</code>)', check: s => !!s.cluster.healthy && s.history.some((h, i) => i >= (s.cluster.healthyAt || 1e9) && /^kubectl get (pods?|po)\b/.test(h)) },
      ];
      return {
        type: 'terminal', chaos: ids.slice(), title: '🎲 Chaos round (ArgoCD Application)',
        instructions: 'Naya cluster chaipay-prod-2 tayaar hai. Bootstrap mein ArgoCD ki Application pay-api lagi — par pay-api aaya hi nahi. 🎲 Chaos monkey ne pay-api-app.yaml mein KUCHH toda hai — kya, yeh tumhe dhoondhna hai.',
        goal: `pay-api ko naye cluster par lao: Application <b>Synced + Healthy</b>, auto-sync ON, aur pods <b>1/1 Running</b>.
          Fix sirf FILE mein: <code>vi pay-api-app.yaml</code> → 💾 Save → <code>kubectl apply -f pay-api-app.yaml</code>.`,
        tasks: T, cluster: c,
        responses: [
          { re: /^argocd app get pay-api\b.*$/, out: s => appGet(s.cluster) },
          { re: /^argocd app list\b.*$/, out: s => { const a = s.cluster.apps[0]; return tbl([['NAME', 'CLUSTER', 'NAMESPACE', 'PROJECT', 'STATUS', 'HEALTH', 'SYNCPOLICY', 'CONDITIONS'], ['argocd/pay-api', 'in-cluster', a.destNamespace, a.project, a.sync, a.health, s.cluster.state.auto ? 'Auto-Prune' : 'Manual', s.cluster.state.cond ? s.cluster.state.cond[0] : '<none>']]); } },
          { re: /^argocd app sync pay-api\b.*$/,
            out: s => { const c2 = s.cluster, d = c2.state;
              if (d.cond) return `FATA[0001] rpc error: code = FailedPrecondition desc = ${d.cond[1]}`;
              if (d.op) return `FATA[0004] Operation has completed with phase: Failed\nMessage: ${d.op}`;
              c2.manualSynced = true; views(c2); if (c2.healthy && c2.healthyAt == null) c2.healthyAt = s.history.length;
              return 'Name:               argocd/pay-api\nOperation:          Sync\nPhase:              Succeeded\nMessage:            successfully synced (all tasks run)' + (d.auto ? '' : '\n(dhyan do: auto-sync abhi bhi band — agla git commit apne aap nahi aayega. File mein syncPolicy.automated wapas lao.)'); } },
          { re: /^argocd repo list\b.*$/, out: tbl([['TYPE', 'NAME', 'REPO', 'INSECURE', 'OCI', 'LFS', 'CREDS', 'STATUS', 'MESSAGE', 'PROJECT'], ['git', '', REPO, 'false', 'false', 'false', 'true', 'Successful', '', '']]) },
          { re: /^argocd proj list\b.*$/, out: tbl([['NAME', 'DESCRIPTION', 'DESTINATIONS', 'SOURCES'], ['default', '', '*,*', '*'], ['payments', 'ChaiPay payments', 'https://kubernetes.default.svc,payments', REPO], ['platform', 'Platform add-ons', 'https://kubernetes.default.svc,platform-*', 'https://github.com/chaipay/platform']]) },
          { re: /^argocd proj get (\S+).*$/, out: (s, m) => m[1] === 'platform' ? `Name:                        platform\nDescription:                 Platform add-ons\nDestinations:                https://kubernetes.default.svc,platform-*\nRepositories:                https://github.com/chaipay/platform` : m[1] === 'payments' ? `Name:                        payments\nDescription:                 ChaiPay payments\nDestinations:                https://kubernetes.default.svc,payments\nRepositories:                ${REPO}` : `FATA[0000] rpc error: code = NotFound desc = appprojects.argoproj.io "${m[1]}" not found` },
          { re: /^kubectl get (?:ns|namespaces?)\b.*$/, out: tbl([['NAME', 'STATUS', 'AGE'], ['argocd', 'Active', '3h'], ['default', 'Active', '3h'], ['kube-system', 'Active', '3h'], ['payments', 'Active', '2h'], ['platform-ingress', 'Active', '2h']]) },
          { re: /^kubectl get (?:applications?|app)\b.*-o ?yaml.*$/, out: s => { const d = s.cluster.state; return text0(s) + `status:\n  sync:\n    status: ${d.sync}\n  health:\n    status: ${d.health}` + (d.cond ? `\n  conditions:\n  - type: ${d.cond[0]}\n    message: "${d.cond[1]}"` : '') + (d.op ? `\n  operationState:\n    phase: Failed\n    message: '${d.op}'` : ''); } },
          { re: /^(?:argocd app (?:set|patch|create)|kubectl (?:edit|patch))\b.*$/, err: true, out: '(simulator ne roka) Application ki sachchai pay-api-app.yaml (git) hai — wahi theek karo aur kubectl apply -f pay-api-app.yaml. Haath ka badlaav agle bootstrap mein phir toot jaayega.' },
        ],
        files: {
          [FILE]: { editable: true, desc: 'pay-api ki ArgoCD Application (git: bootstrap/)', content: text,
            apply: (s, txt, docs) => {
              const c2 = s.cluster, d = (docs || [])[0] || {};
              if (d.kind !== 'Application' || (d.metadata || {}).name !== 'pay-api' || (d.metadata || {}).namespace !== 'argocd') return { err: '(simulator ne roka) is file mein Application pay-api (namespace argocd) hi rahe.' };
              if (JSON.stringify(d) === JSON.stringify(c2.app)) return 'application.argoproj.io/pay-api unchanged';
              c2.app = d; c2.state = derive(d); c2.manualSynced = false; views(c2);
              if (c2.healthy && c2.healthyAt == null) c2.healthyAt = s.history.length;
              return 'application.argoproj.io/pay-api configured' + (c2.state.ok && c2.state.auto ? '\n(ArgoCD: refresh → auto-sync → pay-api ke objects ban rahe hain)' : '');
            } },
        },
        success: KG.allOf(T),
        successText: `<b>🎲 Kya toota tha:</b><br>${B.map(b => '• <b>' + b.title + ':</b> ' + b.reveal).join('<br>')}<br>
          <b>Kram yaad rakho:</b> <code>argocd app get</code> ki CONDITION padho — <b>ComparisonError</b> = manifests hi nahi bane (repo / revision / path) · <b>InvalidSpecError</b> = project ki deewar · sync <b>Failed</b> = cluster ne mana kiya (namespace, RBAC) · koi error nahi par OutOfSync = sync policy.`,
        hints: ['argocd app get pay-api — Sync / Health Status aur neeche CONDITION ya Message. Phir us message ke hisaab se: argocd repo list, argocd proj get <project>, kubectl get ns.',
          B.map(b => b.clue).join(' ║ '), 'vi pay-api-app.yaml — ' + B.map(b => b.fix).join('; ') + '. Save, kubectl apply -f pay-api-app.yaml, argocd app get pay-api, kubectl get pods.'],
        solution: ['argocd app get pay-api'].concat(B.some(b => b.id === 'repo-url') ? ['argocd repo list'] : [], B.some(b => b.id === 'project') ? ['argocd proj get platform'] : [], B.some(b => b.id === 'namespace') ? ['kubectl get ns'] : [],
          [{ edit: FILE, change: B.map(b => [b.to, b.from]) }, `kubectl apply -f ${FILE}`, 'argocd app get pay-api', 'kubectl get pods']),
      };
      function text0(s) { return ((s.edited && s.edited[FILE] != null) ? s.edited[FILE] : s.files[FILE].content); }
    }
    KG.chaos.addDeck({ id: 'argo', file: FILE, BREAKS, BASE, mission });
  })();

  addLab('argoboss', { type: 'chaos', id: 'chaos-argo', deck: 'argo', level: 2, title: '🎲 Chaos Round: Application aayi, app nahi aaya',
    intro: 'ArgoCD deck: repoURL, targetRevision, path, AppProject, destination namespace, auto-sync.' }, {
    objectives: ['🎲 <b>Chaos round (ArgoCD):</b> random tooti Application — CONDITION padh kar parat pehchaano'],
    success: ['Main ArgoCD ke ComparisonError / InvalidSpecError / sync Failed / OutOfSync ka farak samajh kar Application theek kar sakta hoon'],
    cards: [{ front: 'argocd app get: Sync Status "Unknown", CONDITION ComparisonError — kahan dekho?', back: 'Manifests hi nahi bane: <b>repoURL</b> (argocd repo list), <b>targetRevision</b> ("unable to resolve … to a commit SHA"), ya <b>path</b> ("app path does not exist").' }],
  });
  /* =====================================================================
     🎲 Deck 'karp' — karpenterboss: nodepool-batch.yaml (NodePool "batch")
     Raat ka settlement batch: 6 pods (har ek 2 CPU / 4Gi), sirf "batch" NodePool par.
     ===================================================================== */
  (function () {
    const FILE = 'nodepool-batch.yaml';
    const BASE = `apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: batch
spec:
  template:
    spec:
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
      requirements:
      - key: karpenter.sh/capacity-type
        operator: In
        values: ["spot", "on-demand"]
      - key: karpenter.k8s.aws/instance-family
        operator: In
        values: ["m6i", "m7i", "m7g"]
      - key: kubernetes.io/arch
        operator: In
        values: ["amd64"]
      taints:
      - key: workload
        value: batch
        effect: NoSchedule
  limits:
    cpu: "64"
`;
    const BREAKS = [
      { id: 'limit', level: 1, title: 'limits.cpu bahut kam', from: '    cpu: "64"', to: '    cpu: "4"', fix: 'limits cpu "4" ko "64" karo',
        clue: 'kubectl describe pod <settlement pod> — karpenter ka event? kubectl describe nodepool batch — Limits?',
        reveal: '<code>limits.cpu: "4"</code> — 6 pods ko ~16 vCPU chahiye; ek bhi 8-vCPU node limit todta → <code>all available instance types exceed limits for nodepool: "batch"</code>.' },
      { id: 'family', level: 1, title: 'instance-family ka typo', from: 'values: ["m6i", "m7i", "m7g"]', to: 'values: ["m6ii"]', fix: 'instance-family ["m6ii"] ko ["m6i", "m7i", "m7g"] karo',
        clue: 'karpenter ka event: "no instance type satisfied resources … and requirements" — requirements ki list padho. Aisi family hai bhi?',
        reveal: '<code>instance-family: [m6ii]</code> — aisi koi EC2 family nahi → <b>koi</b> instance type nahi bacha → pods Pending.' },
      { id: 'taint', level: 1, title: 'taint ki value badli', from: '        value: batch\n', to: '        value: batch-jobs\n', fix: 'taint value batch-jobs ko batch karo',
        clue: 'karpenter ka event: "did not tolerate …" — pod ki toleration (kubectl get pod <pod> -o yaml) aur NodePool ka taint milao.',
        reveal: 'NodePool taint <code>workload=batch-jobs</code>, pods ki toleration <code>workload=batch</code> → Karpenter jaanta hai ki naye node par pod tik hi nahi payega, isliye node banata hi nahi.' },
      { id: 'size', level: 2, title: 'sirf "large" size', from: '      taints:', to: '      - key: karpenter.k8s.aws/instance-size\n        operator: In\n        values: ["large"]\n      taints:', fix: 'instance-size ["large"] wali requirement (3 lines) hatao',
        clue: 'karpenter ka event: "no instance type satisfied resources {"cpu":"2200m" …}" — large mein kitne vCPU? Pod + daemonsets ko kitne chahiye?',
        reveal: '<code>instance-size: [large]</code> = 2 vCPU. Har pod 2 CPU + DaemonSets ka ~200m → 2.2 vCPU kisi large mein nahi samata. Size ko Karpenter par chhodo (ya xlarge+).' },
      { id: 'nodeclass', level: 2, title: 'nodeClassRef ka typo', from: '        name: default\n      requirements', to: '        name: defualt\n      requirements', fix: 'nodeClassRef name defualt ko default karo',
        clue: 'karpenter ka event: "no nodepools found"? kubectl describe nodepool batch — Conditions mein kya False hai? kubectl get ec2nodeclass',
        reveal: '<code>nodeClassRef.name: defualt</code> — aisi EC2NodeClass nahi → NodePool <b>Ready nahi</b> (NodeClassReady=False) → Karpenter use chunta hi nahi.' },
      { id: 'arch', level: 2, title: 'arch ki requirement gayab', from: '      - key: kubernetes.io/arch\n        operator: In\n        values: ["amd64"]\n', to: '', fix: 'kubernetes.io/arch In ["amd64"] wali requirement wapas jodo (ya m7g hatao)',
        clue: 'Nodes aaye, pods CrashLoopBackOff. kubectl logs <pod> — "exec format error"? kubectl get nodes -L kubernetes.io/arch,node.kubernetes.io/instance-type',
        reveal: 'Arch ki requirement hati toh Karpenter ne <b>sabse sasta</b> chuna: Graviton <code>m7g</code> (<b>arm64</b>). settlement ka image sirf amd64 → <code>exec /app/settlement: exec format error</code>. Multi-arch image banao, ya arch bandho.' },
    ];
    const NEED = 'resources {"cpu":"2200m","memory":"4336Mi","pods":"6"}';
    function derive(np) {
      const sp = np.spec || {}, t = (sp.template || {}).spec || {}, reqs = t.requirements || [];
      const vals = k => { const r = reqs.find(x => x && x.key === k); return r ? [].concat(r.values || []) : null; };
      const fam = vals('karpenter.k8s.aws/instance-family') || ['m6i', 'm7i', 'm7g', 'c6i', 'r6i'], arch = vals('kubernetes.io/arch'), size = vals('karpenter.k8s.aws/instance-size');
      const reqText = reqs.map(r => `${r.key} ${r.operator} [${[].concat(r.values || []).join(' ')}]`).concat(['karpenter.sh/nodepool In [batch]']).join(', ');
      if (((t.nodeClassRef || {}).name) !== 'default') return { pend: 'Failed to schedule pod, no nodepools found', notReady: (t.nodeClassRef || {}).name };
      const taint = (t.taints || [])[0] || {};
      if (taint.key && !(taint.key === 'workload' && taint.value === 'batch' && taint.effect === 'NoSchedule')) return { pend: `Failed to schedule pod, incompatible with nodepool "batch", did not tolerate ${taint.key}=${taint.value}:${taint.effect}` };
      const known = ['m6i', 'm7i', 'm7g', 'c6i', 'c7g', 'r6i', 'm5', 'c5'];
      const famOk = fam.filter(f => known.includes(f));
      const amdFam = famOk.filter(f => !/g$/.test(f)), armFam = famOk.filter(f => /g$/.test(f));
      const archOk = a => !arch || arch.includes(a);
      const sizeOk = !size || size.some(z => ['xlarge', '2xlarge', '4xlarge'].includes(z));
      const pickFam = archOk('arm64') && armFam.length ? { f: armFam[0], arm: true } : archOk('amd64') && amdFam.length ? { f: amdFam[0], arm: false } : null;   // Karpenter: sabse sasta (Graviton)
      if (!pickFam || !sizeOk) return { pend: `Failed to schedule pod, incompatible with nodepool "batch", daemonset overhead={"cpu":"200m","memory":"240Mi","pods":"5"}, no instance type satisfied ${NEED} and requirements ${reqText} (no instance type has enough resources or compatible requirements)` };
      const lim = String(((sp.limits || {}).cpu) == null ? '1000' : sp.limits.cpu);
      if (Number(lim) < 16) return { pend: 'Failed to schedule pod, all available instance types exceed limits for nodepool: "batch"' };
      return { type: pickFam.f + '.2xlarge', arm: pickFam.arm };
    }
    const PODS = ['x7k2p', 'm3q9d', 'b8w4t', 'r5n1c', 'h2v6k', 'f9t3j'].map(x => 'settlement-29188610-' + x);
    function views(c) {
      const d = c.state;
      c.nodes = ['ip-10-0-12-31', 'ip-10-0-13-38', 'ip-10-0-14-45'].map((n, i) => ({ name: n + '.ap-south-1.compute.internal', status: 'Ready', roles: '<none>', age: '12d', version: 'v1.33.4-eks-8d1c2f5', instanceType: 'm6i.xlarge', capacityType: 'on-demand', zone: 'ap-south-1' + 'abc'[i], nodepool: 'default', labels: { 'kubernetes.io/arch': 'amd64' } }))
        .concat(d.type ? [0, 1].map(i => ({ name: `ip-10-0-1${2 + i}-${150 + i}.ap-south-1.compute.internal`, status: 'Ready', roles: '<none>', age: '1m', version: 'v1.33.4-eks-8d1c2f5', instanceType: d.type, capacityType: 'spot', zone: 'ap-south-1' + 'ab'[i], nodepool: 'batch', labels: { 'kubernetes.io/arch': d.arm ? 'arm64' : 'amd64' } })) : []);
      const st = d.pend ? 'Pending' : d.arm ? 'CrashLoopBackOff' : 'Running';
      c.pods = PODS.map((n, i) => ({ name: n, app: 'settlement', ready: st === 'Running' ? '1/1' : '0/1', status: st, restarts: st === 'CrashLoopBackOff' ? 3 : 0, age: '9m', node: d.pend ? '<none>' : c.nodes[3 + (i % 2)].name, ip: d.pend ? '<none>' : '10.0.1' + (2 + i % 2) + '.' + (160 + i),
        describe: `Name:             ${n}\nNamespace:        payments\nNode:             ${d.pend ? '<none>' : c.nodes[3 + (i % 2)].name}\nStatus:           ${d.pend ? 'Pending' : 'Running'}\nControlled By:    Job/settlement-29188610\nContainers:\n  settlement:\n    Image:          ${ECR}/settlement:4.1.0     (linux/amd64)\n    Requests:\n      cpu:     2\n      memory:  4Gi\n` +
          (d.arm ? '    State:          Waiting\n      Reason:       CrashLoopBackOff\n    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    255\n' : '') +
          `Node-Selectors:   karpenter.sh/nodepool=batch\nTolerations:      workload=batch:NoSchedule\nEvents:\n  Type     Reason            Age   From               Message\n  ----     ------            ----  ----               -------\n` +
          (d.pend ? `  Warning  FailedScheduling  2m    default-scheduler  0/3 nodes are available: 3 node(s) didn't match Pod's node affinity/selector. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.\n  Warning  FailedScheduling  30s   karpenter          ${d.pend}`
            : d.arm ? `  Normal   Started           2m    kubelet            Started container settlement\n  Warning  BackOff           20s   kubelet            Back-off restarting failed container settlement in pod ${n}_payments(7c1e…)` : '  Normal   Started           1m    kubelet            Started container settlement') }));
      c.custom = {
        nodepool: { names: ['nodepool', 'nodepools', 'np'], cols: ['NAME', 'NODECLASS', 'NODES', 'READY', 'AGE'], items: [
          { name: 'batch', row: [((c.np.spec.template || {}).spec.nodeClassRef || {}).name, d.type ? '2' : '0', d.notReady ? 'False' : 'True', '30d'],
            describe: `Name:         batch\nKind:         NodePool\nSpec:\n  Limits:\n    Cpu:  ${(c.np.spec.limits || {}).cpu}\n  Template:\n    Spec:\n      Node Class Ref:\n        Name:  ${((c.np.spec.template || {}).spec.nodeClassRef || {}).name}\n      Requirements:\n` +
              ((c.np.spec.template || {}).spec.requirements || []).map(r => `        ${r.key} ${r.operator} ${[].concat(r.values || []).join(', ')}`).join('\n') + `\n      Taints:\n` + ((c.np.spec.template || {}).spec.taints || []).map(t => `        ${t.key}=${t.value}:${t.effect}`).join('\n') +
              `\nStatus:\n  Conditions:\n    Type:     NodeClassReady\n    Status:   ${d.notReady ? 'False' : 'True'}\n    Reason:   ${d.notReady ? 'NodeClassNotFound' : 'NodeClassReady'}${d.notReady ? `\n    Message:  EC2NodeClass "${d.notReady}" not found` : ''}\n    Type:     Ready\n    Status:   ${d.notReady ? 'False' : 'True'}\n  Resources:\n    Cpu:  ${d.type ? 16 : 0}` },
          { name: 'default', row: ['default', '3', 'True', '90d'] }] },
        ec2nodeclass: { names: ['ec2nodeclass', 'ec2nodeclasses', 'ec2nc'], cols: ['NAME', 'READY', 'AGE'], items: [{ name: 'default', row: ['True', '90d'] }] },
        nodeclaim: { names: ['nodeclaim', 'nodeclaims', 'nc'], cols: ['NAME', 'TYPE', 'CAPACITY', 'ZONE', 'NODE', 'READY', 'AGE'],
          items: (d.type ? [0, 1].map(i => ({ name: 'batch-' + ['q4k8z', 'w7n2c'][i], row: [d.type, 'spot', 'ap-south-1' + 'ab'[i], c.nodes[3 + i].name.split('.')[0], 'True', '1m'] })) : []) },
      };
      c.healthy = !d.pend && !d.arm;
    }
    function mission(ids) {
      const text = applyBreaks(BASE, BREAKS, ids), B = ids.map(id => BREAKS.find(b => b.id === id));
      const c = { np: KG.yaml.parseAll(text)[0] };
      c.state = derive(c.np); views(c);
      const T = [
        { text: 'Wajah dhoondho — <code>kubectl describe pod</code> (karpenter ka event), <code>kubectl describe nodepool batch</code>, logs', check: s => s.history.some(h => /^kubectl (describe (pods?|po|nodepools?|np)|logs|get (nodeclaims?|nc|nodes?|no|ec2nodeclass\S*))\b/.test(h)) },
        { text: '<code>nodepool-batch.yaml</code> theek karke apply — saare 6 settlement pods <b>Running</b>', check: s => !!s.cluster.healthy },
        { text: 'Pakka karo: <code>kubectl get pods</code>', check: s => !!s.cluster.healthy && s.history.some((h, i) => i >= (s.cluster.healthyAt || 1e9) && /^kubectl get (pods?|po)\b/.test(h)) },
      ];
      return {
        type: 'terminal', chaos: ids.slice(), title: '🎲 Chaos round (Karpenter NodePool)',
        instructions: 'Raat 1 baje ka settlement batch (6 pods, har ek 2 CPU / 4Gi) sirf "batch" NodePool ke nodes par chalta hai. Aaj woh shuru hi nahi hua — ya shuru hokar gir raha hai. 🎲 Chaos monkey ne nodepool-batch.yaml mein KUCHH toda hai.',
        goal: `Settlement ke saare 6 pods <b>Running</b> karo. Fix sirf FILE mein: <code>vi nodepool-batch.yaml</code> → 💾 Save → <code>kubectl apply -f nodepool-batch.yaml</code>.`,
        tasks: T, cluster: c,
        responses: [
          { re: /^kubectl logs\b.*\bkarpenter\b.*$/, out: s => { const d = s.cluster.state; return '(simulator: Karpenter ke JSON log — zaroori fields)\n' + (d.pend ? `{"level":"ERROR","logger":"controller","message":"could not schedule pod","controller":"provisioner","Pod":{"name":"${PODS[0]}","namespace":"payments"},"error":${JSON.stringify(d.pend.replace(/^Failed to schedule pod, /, ''))}}` : `{"level":"INFO","logger":"controller","message":"launched nodeclaim","controller":"nodeclaim.lifecycle","NodeClaim":{"name":"batch-q4k8z"},"instance-type":"${d.type}","capacity-type":"spot"}`); } },
          { re: /^kubectl logs\b.*\bsettlement-\S+.*$/, out: s => { const d = s.cluster.state; return d.pend ? `Error from server (BadRequest): container "settlement" in pod "${PODS[0]}" is waiting to start: ContainerCreating` : d.arm ? 'exec /app/settlement: exec format error' : '{"level":"info","msg":"settlement batch 29188610 shuru","merchants":184220}'; } },
          { re: /^kubectl get (?:pods?|po)[ /](settlement-\S+)\b.*-o ?yaml.*$/, out: (s, m) => `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${m[1]}\n  namespace: payments\nspec:\n  nodeSelector:\n    karpenter.sh/nodepool: batch\n  tolerations:\n  - key: workload\n    operator: Equal\n    value: batch\n    effect: NoSchedule\n  containers:\n  - name: settlement\n    image: ${ECR}/settlement:4.1.0\n    resources:\n      requests:\n        cpu: "2"\n        memory: 4Gi` },
          { re: /^kubectl (?:edit|patch)\b.*$/, err: true, out: '(simulator ne roka) NodePool git mein hai: vi nodepool-batch.yaml → Save → kubectl apply -f nodepool-batch.yaml' },
          { re: /^kubectl delete\b.*$/, err: true, out: '(simulator ne roka) delete se kuch theek nahi hoga — NodePool ki file mein galti hai.' },
        ],
        files: {
          [FILE]: { editable: true, desc: 'git: Karpenter NodePool "batch"', content: text,
            apply: (s, txt, docs) => {
              const c2 = s.cluster, d = (docs || [])[0] || {};
              if (d.kind !== 'NodePool' || (d.metadata || {}).name !== 'batch') return { err: '(simulator ne roka) is file mein NodePool batch hi rahe.' };
              if (JSON.stringify(d) === JSON.stringify(c2.np)) return 'nodepool.karpenter.sh/batch unchanged';
              const t = ((d.spec || {}).template || {}).spec || {};
              if (!(t.taints || []).length) return { err: '(simulator ne roka) taint mat hatao — warna doosre apps bhi batch ke mehnge nodes par aa jaayenge. Value theek karo.' };
              c2.np = d; c2.state = derive(d); views(c2);
              if (c2.healthy && c2.healthyAt == null) c2.healthyAt = s.history.length;
              return 'nodepool.karpenter.sh/batch configured' + (c2.state.type ? `\n(Karpenter: 2 × ${c2.state.type} launch — ~1 minute mein nodes)` : '');
            } },
        },
        success: KG.allOf(T),
        successText: `<b>🎲 Kya toota tha:</b><br>${B.map(b => '• <b>' + b.title + ':</b> ' + b.reveal).join('<br>')}<br>
          <b>Kram yaad rakho:</b> pod ke Events mein <b>karpenter</b> ki line sabse kaam ki — "exceed limits" = limits · "no instance type satisfied" = requirements / size · "did not tolerate" = taints · "no nodepools found" = NodePool Ready nahi (nodeClassRef) · nodes aaye par crash = arch / image.`,
        hints: ['kubectl get pods — Pending ya CrashLoop? Pending: kubectl describe pod <pod> ka karpenter event + kubectl describe nodepool batch. CrashLoop: kubectl logs <pod> + kubectl get nodes -L kubernetes.io/arch.',
          B.map(b => b.clue).join(' ║ '), 'vi nodepool-batch.yaml — ' + B.map(b => b.fix).join('; ') + '. Save, kubectl apply -f nodepool-batch.yaml, kubectl get pods.'],
        solution: ['kubectl get pods', B.some(b => b.id === 'arch') ? `kubectl logs ${PODS[0]}` : `kubectl describe pod ${PODS[0]}`, 'kubectl describe nodepool batch',
          { edit: FILE, change: B.map(b => [b.to || b.from, b.from]).map(([a, b2], i) => B[i].to ? [a, b2] : ['      taints:', b2 + '      taints:']) }, `kubectl apply -f ${FILE}`, 'kubectl get pods'],
      };
    }
    KG.chaos.addDeck({ id: 'karp', file: FILE, BREAKS, BASE, mission });
  })();

  addLab('karpenterboss', { type: 'chaos', id: 'chaos-karp', deck: 'karp', level: 2, title: '🎲 Chaos Round: settlement batch kyun nahi chala?',
    intro: 'Karpenter deck: limits, instance-family, taints, instance-size, nodeClassRef, arch.' }, {
    objectives: ['🎲 <b>Chaos round (Karpenter):</b> random tooti NodePool — pod ke karpenter event se parat pehchaano'],
    success: ['Main Karpenter ke "exceed limits / no instance type / did not tolerate / no nodepools / exec format error" ka matlab samajh kar NodePool theek kar sakta hoon'],
    cards: [{ front: 'NodePool se arch ki requirement hati, nodes aaye, par pods "exec format error" — kyun?', back: 'Karpenter sabse sasta chunta hai — aksar Graviton (<b>arm64</b>). Image sirf amd64 ho toh binary chalti hi nahi. <code>kubernetes.io/arch</code> bandho, ya multi-arch image.' }],
  });
})();
