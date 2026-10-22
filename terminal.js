/* =====================================================================
   KubeGurukul — kubectl Simulator (terminal missions)

   Mission stage shape (data files mein):
   {
     type: 'terminal', title, instructions,
     goal: 'HTML — kya karna hai',
     cluster: { nodes:[], pods:[], deployments:[], services:[], configmaps:[], events:[] },
     files: { 'fix.yaml': { desc, apply(sim) -> 'message' } },   // kubectl apply -f ke liye
     responses: [ { re: /regex/, out: 'text' | fn(sim, m), mutate?: fn(sim, m) } ],
     tasks: [ { text, check(sim) -> bool } ],                    // checklist (optional)
     success: fn(sim) -> bool,  successText: 'HTML',
     hints: ['pehla hint', 'doosra hint', ...],
   }
   Pod ke special fields: logs, prevLogs, describe, events:[], exec:{cmd:out},
   respawn:{...} (delete hone par ReplicaSet naya pod banati hai), top.
   ===================================================================== */

/* Cluster ka deep clone — DATA copy hota hai (replay fresh rahe) par
   FUNCTIONS (onSync/render/onInstall/check…) reference se pass hote hain.
   JSON.parse(JSON.stringify()) yeh functions chup-chaap gira deta tha. */
KG.cloneCluster = function cloneCluster(o) {
  if (Array.isArray(o)) return o.map(KG.cloneCluster);
  if (o && typeof o === 'object') {
    const out = {};
    for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = KG.cloneCluster(o[k]);
    return out;
  }
  return o;   // primitives aur functions jaise ke waise
};

KG.renderers.terminal = function renderTerminal(stage, arena, onDone) {
  // deep-clone the cluster so replays start fresh (functions preserved)
  const sim = {
    cluster: KG.cloneCluster(stage.cluster || {}),
    history: [],       // executed commands (normalized)
    hintsUsed: 0,
    done: false,
    stage,
  };
  // non-serializable bits (functions) survive via reference to the stage
  sim.files = stage.files || {};
  sim.responses = stage.responses || [];
  /* sink != null → output pipe mein ja raha hai (| grep ...). Errors (stderr) pipe
     ko bypass karke seedha screen par aate hain — bilkul asli shell jaisa.
     (print() se PEHLE declare — warna pehla print hi TDZ error deta) */
  let sink = null, sawErr = false;

  /* ---------- UI ---------- */
  const goalBox = el('div', 'term-goal');
  goalBox.innerHTML = `<h4>🎯 Mission</h4><div>${stage.goal}</div>`;
  const taskList = el('ul', 'term-tasks');
  (stage.tasks || []).forEach(t => taskList.appendChild(el('li', '', t.text)));
  if (stage.tasks) goalBox.appendChild(taskList);

  const term = el('div', 'terminal');
  term.innerHTML = `
    <div class="term-bar">
      <span class="dot" style="background:#f87171"></span>
      <span class="dot" style="background:#ffb347"></span>
      <span class="dot" style="background:#34d399"></span>
      <span>&nbsp;shishya@kubegurukul — kubectl</span>
    </div>
    <div class="term-out"></div>
    <div class="term-in"><span class="ps1">$</span><input type="text" autocomplete="off"
      spellcheck="false" placeholder="kubectl get pods   (madad ke liye: help)"></div>`;
  const out = term.querySelector('.term-out');
  const input = term.querySelector('input');

  const btns = el('div', 'term-btns');
  const hintBtn = el('button', 'btn small ghost', `💡 Hint (−${KG.HINT_COST} XP)`);
  hintBtn.onclick = () => giveHint();
  btns.appendChild(hintBtn);

  arena.append(goalBox, term, btns);
  print('sys', `Mock cluster ready. Commands type karo — 'help' se list milegi.`);
  setTimeout(() => input.focus(), 100);

  const cmdHistory = [];
  let histIdx = -1;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const raw = input.value.trim();
      input.value = '';
      if (raw) { cmdHistory.push(raw); histIdx = cmdHistory.length; run(raw); }
    } else if (e.key === 'ArrowUp') {
      if (histIdx > 0) { histIdx--; input.value = cmdHistory[histIdx] || ''; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (histIdx < cmdHistory.length) { histIdx++; input.value = cmdHistory[histIdx] || ''; }
      e.preventDefault();
    }
  });

  function print(kind, text) {
    if (kind === 'err') sawErr = true;
    if (sink && (kind === 'ok' || kind === 'sys')) { sink.push(String(text)); return; }
    const div = el('div', 't-' + kind);
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  /* ---------- mini shell: a && b ; c | grep x | head -5 > file ---------- */
  function splitTop(s, seps) {
    // quotes ke andar ke separators mat todo
    const parts = []; let cur = '', q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) q = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      const sep = seps.find(x => s.startsWith(x, i) && !(x === '|' && (s[i + 1] === '|' || s[i - 1] === '|')));
      if (sep) { parts.push({ text: cur.trim(), sep }); cur = ''; i += sep.length - 1; continue; }
      cur += ch;
    }
    parts.push({ text: cur.trim(), sep: null });
    return parts.filter(p => p.text);
  }
  function applyFilter(text, filt) {
    const t = filt.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    const name = t[0];
    const unq = s => s.replace(/^(["'])(.*)\1$/, '$2');
    const lines = text.split('\n');
    if (name === 'grep' || name === 'egrep') {
      let inv = false, ci = false, cnt = false, num = false, A = 0, B = 0, pat = null;
      for (let i = 1; i < t.length; i++) {
        const x = t[i];
        if (/^-[ABC]$/.test(x)) { const n = parseInt(t[++i], 10) || 0; if (x !== '-B') A = n; if (x !== '-A') B = n; }
        else if (/^-[ABC]\d+$/.test(x)) { const n = parseInt(x.slice(2), 10); if (x[1] !== 'B') A = n; if (x[1] !== 'A') B = n; }
        else if (x === '-e') pat = unq(t[++i] || '');
        else if (/^-[ivcnEwo]+$/.test(x)) { if (x.includes('v')) inv = true; if (x.includes('i')) ci = true; if (x.includes('c')) cnt = true; if (x.includes('n')) num = true; }
        else if (pat === null) pat = unq(x);
      }
      if (pat === null) return { err: 'grep: pattern chahiye  (e.g. ... | grep replicas)' };
      let re;
      try { re = new RegExp(pat, ci ? 'i' : ''); }
      catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ci ? 'i' : ''); }
      const hit = lines.map(l => re.test(l) !== inv);
      if (cnt) return { text: String(hit.filter(Boolean).length) };
      const keep = new Set();
      hit.forEach((h, i) => { if (h) for (let j = Math.max(0, i - B); j <= Math.min(lines.length - 1, i + A); j++) keep.add(j); });
      const res = []; let last = -2;
      [...keep].sort((a, b) => a - b).forEach(i => {
        if ((A || B) && last >= 0 && i > last + 1) res.push('--');
        res.push((num ? (i + 1) + ':' : '') + lines[i]); last = i;
      });
      return { text: res.join('\n'), note: res.length ? null : '(grep: koi line match nahi hui)' };
    }
    if (name === 'head' || name === 'tail') {
      let n = 10;
      for (let i = 1; i < t.length; i++) {
        const x = t[i];
        if (x === '-n') n = parseInt(t[++i], 10);
        else if (/^-n?\d+$/.test(x)) n = parseInt(x.replace(/^-n?/, ''), 10);
        else if (/^\d+$/.test(x)) n = parseInt(x, 10);
      }
      if (!(n >= 0)) n = 10;
      return { text: (name === 'head' ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n))).join('\n') };
    }
    if (name === 'wc') return { text: String(t.includes('-l') ? lines.filter((l, i) => l !== '' || i < lines.length - 1).length : text.split(/\s+/).filter(Boolean).length) };
    if (name === 'sort') return { text: lines.slice().sort().join('\n') };
    if (name === 'uniq') return { text: lines.filter((l, i) => l !== lines[i - 1]).join('\n') };
    if (['less', 'more', 'cat', 'tee'].includes(name)) return { text };
    return { err: `bash: '${name}' is mission ke pipe mein supported nahi — grep · head · tail · wc · sort chalte hain` };
  }
  function giveHint() {
    const hints = stage.hints || [];
    if (sim.hintsUsed >= hints.length) { print('hint', '💡 Aur hints nahi hain — tum kar sakte ho!'); return; }
    print('hint', `💡 Hint ${sim.hintsUsed + 1}: ${hints[sim.hintsUsed]}`);
    sim.hintsUsed++;
  }

  /* ---------- resource lookup ---------- */
  const RES_ALIAS = {
    pod: 'pods', pods: 'pods', po: 'pods',
    deployment: 'deployments', deployments: 'deployments', deploy: 'deployments',
    service: 'services', services: 'services', svc: 'services',
    node: 'nodes', nodes: 'nodes', no: 'nodes',
    configmap: 'configmaps', configmaps: 'configmaps', cm: 'configmaps',
    secret: 'secrets', secrets: 'secrets',
    endpoints: 'endpoints', ep: 'endpoints',
    event: 'events', events: 'events', ev: 'events',
    statefulset: 'statefulsets', statefulsets: 'statefulsets', sts: 'statefulsets',
    daemonset: 'daemonsets', daemonsets: 'daemonsets', ds: 'daemonsets',
    ingress: 'ingresses', ingresses: 'ingresses', ing: 'ingresses',
    networkpolicy: 'networkpolicies', networkpolicies: 'networkpolicies', netpol: 'networkpolicies',
    hpa: 'hpas', hpas: 'hpas',
    pvc: 'pvcs', pvcs: 'pvcs', pv: 'pvs', pvs: 'pvs',
    // Karpenter (karpentersim.js)
    nodepool: 'nodepools', nodepools: 'nodepools', np: 'nodepools',
    nodeclaim: 'nodeclaims', nodeclaims: 'nodeclaims', nc: 'nodeclaims',
    ec2nodeclass: 'ec2nodeclasses', ec2nodeclasses: 'ec2nodeclasses', ec2nc: 'ec2nodeclasses',
    // ArgoCD (argosim.js)
    application: 'apps', applications: 'apps', app: 'apps', apps: 'apps',
    applicationset: 'appsets', applicationsets: 'appsets', appset: 'appsets', appsets: 'appsets',
    rollout: 'rollouts', rollouts: 'rollouts', ro: 'rollouts',
    all: 'all',
  };
  function list(kind) { return sim.cluster[kind] || []; }
  function find(kind, name) {
    if (!name) return null;
    const items = list(kind);
    const hit = items.find(r => r.name === name);
    if (hit) return hit;
    // learning-friendly: naam ka prefix bhi chalega (pehla match)
    return items.find(r => r.name.startsWith(name)) || null;
  }
  /* flags hata ke sirf positional args do. valueFlags = woh flags jo agla token
     value ke roop mein lete hain (-c app, -l app=web) — unki value bhi hatti hai. */
  function positional(arr, valueFlags) {
    const outArgs = [];
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i];
      if (t === '--') break;
      if (t.startsWith('-')) { if (valueFlags.includes(t)) i++; continue; }
      outArgs.push(t);
    }
    return outArgs;
  }

  /* ---------- table printers ---------- */
  function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(1, n - s.length)); }
  function table(rows) {
    if (!rows.length) return 'No resources found.';
    const widths = rows[0].map((_, c) => Math.max(...rows.map(r => String(r[c]).length)) + 3);
    return rows.map(r => r.map((cell, c) => pad(cell, widths[c])).join('').trimEnd()).join('\n');
  }
  function podTable(wide, items) {
    const head = ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'];
    if (wide) head.push('IP', 'NODE');
    const rows = [head];
    (items || list('pods')).forEach(p => {
      const r = [p.name, p.ready, p.status, p.restarts, p.age];
      if (wide) r.push(p.ip || '<none>', p.node || '<none>');
      rows.push(r);
    });
    return table(rows);
  }
  function genericTable(kind, items) {
    const defs = {
      deployments: ['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE'],
      services: ['NAME', 'TYPE', 'CLUSTER-IP', 'PORT(S)', 'AGE'],
      nodes: (sim.cluster.karpenter && sim.cluster.karpenter.enabled)
        ? ['NAME', 'STATUS', 'INSTANCE-TYPE', 'CAPACITY', 'ZONE', 'NODEPOOL', 'AGE']
        : ['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION'],
      configmaps: ['NAME', 'DATA', 'AGE'],
      secrets: ['NAME', 'TYPE', 'DATA', 'AGE'],
      endpoints: ['NAME', 'ENDPOINTS', 'AGE'],
      statefulsets: ['NAME', 'READY', 'AGE'],
      daemonsets: ['NAME', 'DESIRED', 'CURRENT', 'READY', 'AGE'],
      ingresses: ['NAME', 'CLASS', 'HOSTS', 'ADDRESS', 'PORTS', 'AGE'],
      networkpolicies: ['NAME', 'POD-SELECTOR', 'AGE'],
      hpas: ['NAME', 'REFERENCE', 'TARGETS', 'MINPODS', 'MAXPODS', 'REPLICAS', 'AGE'],
      pvcs: ['NAME', 'STATUS', 'VOLUME', 'CAPACITY', 'ACCESS MODES', 'STORAGECLASS', 'AGE'],
      pvs: ['NAME', 'CAPACITY', 'ACCESS MODES', 'RECLAIM POLICY', 'STATUS', 'CLAIM', 'AGE'],
    };
    // Karpenter ke tables karpentersim.js se aate hain (dynamic)
    if (typeof KG.karpenter === 'object' && ['nodepools', 'nodeclaims', 'ec2nodeclasses'].includes(kind)) {
      const t = KG.karpenter.tables(sim)[kind];
      return t.rows.length ? table([t.cols, ...t.rows]) : 'No resources found.';
    }
    if (kind === 'apps') {
      const a = items || list('apps');
      return a.length ? table([['NAME', 'SYNC STATUS', 'HEALTH STATUS', 'PROJECT', 'REVISION'],
        ...a.map(x => [x.name, x.sync, x.health, x.project || 'default', x.revision || '-'])]) : 'No resources found.';
    }
    if (kind === 'appsets') {
      const a = items || list('appsets');
      return a.length ? table([['NAME', 'GENERATOR', 'APPS'], ...a.map(x => [x.name, x.generator, (x.produces || []).length])]) : 'No resources found.';
    }
    if (kind === 'rollouts') {
      const r = items || list('rollouts');
      return r.length ? table([['NAME', 'STRATEGY', 'STATUS', 'STEP', 'WEIGHT'],
        ...r.map(x => [x.name, x.strategy, x.status, (x.step != null ? x.step + '/' + (x.steps || []).length : '-'), x.weight != null ? x.weight + '%' : '-'])]) : 'No resources found.';
    }
    const cols = defs[kind];
    if (!cols) return null;
    const rows = [cols];
    (items || list(kind)).forEach(r => rows.push(cols.map(c => {
      const key = c.toLowerCase().replace(/[^a-z]/g, '');
      const map = {
        name: r.name, ready: r.ready, uptodate: r.upToDate, available: r.available,
        age: r.age, type: r.type, clusterip: r.clusterIP, ports: r.ports,
        status: r.status, roles: r.roles, version: r.version, data: r.dataCount,
        endpoints: r.endpoints, desired: r.desired, current: r.current, class: r.class,
        hosts: r.hosts, address: r.address, podselector: r.podSelector,
        reference: r.reference, targets: r.targets, minpods: r.min, maxpods: r.max,
        replicas: r.replicas, volume: r.volume,
        // CAPACITY: PVC/PV ke liye size (10Gi), Karpenter node ke liye spot/on-demand.
        // (pehle yahan `capacity` key do baar thi — doosri pehli ko overwrite karke PVC ka size gayab kar deti thi)
        capacity: kind === 'nodes' ? r.capacityType : r.capacity,
        accessmodes: r.accessModes, storageclass: r.storageClass,
        reclaimpolicy: r.reclaimPolicy, claim: r.claim,
        instancetype: r.instanceType, zone: r.zone, nodepool: r.nodepool,
      };
      return map[key] != null ? map[key] : '<none>';
    })));
    return table(rows);
  }

  function describePod(p) {
    if (p.describe) return p.describe;
    let s = `Name:         ${p.name}\nNamespace:    ${p.ns || 'default'}\nNode:         ${p.node || '<none>'}\nStatus:       ${p.status}\nIP:           ${p.ip || '<none>'}\nRestarts:     ${p.restarts}`;
    if (p.events && p.events.length) s += `\n\nEvents:\n  ` + p.events.join('\n  ');
    return s;
  }

  /* ---------- checks after every command ---------- */
  function refresh() {
    // Karpenter ek controller hai — har command ke baad reconcile hota hai
    if (sim.cluster.karpenter && typeof KG.karpenter === 'object') KG.karpenter.reconcile(sim);
    if (stage.tasks) {
      // checklist ABHI ki state dikhaye: koi kaam bigad gaya toh tick hat jaata hai
      // (success = KG.allOf(tasks) — sab ek saath sach hone chahiye)
      stage.tasks.forEach((t, i) => {
        let ok = false;
        try { ok = !!(t.check && t.check(sim)); } catch (e) { ok = false; }
        const li = taskList.children[i];
        if (li) { if (ok) li.classList.add('done'); else li.classList.remove('done'); }
      });
    }
    if (!sim.done && stage.success && stage.success(sim)) {
      sim.done = true;
      input.disabled = true;
      const xp = Math.max(10, KG.TERMINAL_XP - sim.hintsUsed * KG.HINT_COST);
      KG.addXP(xp);
      const win = el('div', 'stage-summary pop');
      win.innerHTML = `
        <div class="sum-emoji">🎉</div>
        <div class="sum-title">Mission complete! +${xp} XP${sim.hintsUsed ? ` (${sim.hintsUsed} hint use hue)` : ' — bina hint ke! 🔥'}</div>
        <div class="sum-detail" style="text-align:left;line-height:1.6;margin-top:8px">${stage.successText || ''}</div>`;
      arena.appendChild(win);
      win.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => onDone({ firstTry: sim.hintsUsed === 0 ? 1 : 0, total: 1 }), 300);
    }
  }

  /* ---------- command execution ---------- */
  function run(raw) {
    print('cmd', raw);
    if (sim.done) return;
    // "a && b ; c" — har hissa apna command hai (history mein alag entry, tasks alag check)
    const chain = splitTop(raw.replace(/\s+/g, ' ').trim(), ['&&', ';']);
    for (let i = 0; i < chain.length; i++) {
      if (sim.done) break;
      const failed = runOne(chain[i].text);
      if (failed && chain[i].sep === '&&') break;   // asli shell: pehla fail → && ke aage kuch nahi
    }
  }

  function runOne(cmdline) {
    // 'k' alias YAHIN kubectl ban jaata hai — taaki scripted responses (/^kubectl rollout.../)
    // aur history-based tasks dono 'k ...' ko bhi pehchaanein
    const norm = cmdline.replace(/^k(?= |$)/, 'kubectl');
    sim.history.push(norm);
    sawErr = false;
    // "cmd > file" — output file mein (screen par nahi)
    let redirect = null;
    let body = norm;
    const rm = body.match(/^(.*?)\s+>>?\s*(\S+)$/);
    if (rm && !/["']/.test(rm[2])) { body = rm[1]; redirect = rm[2]; }
    const segs = splitTop(body, ['|']).map(p => p.text);
    const piped = segs.length > 1 || redirect;
    if (piped) sink = [];
    try { exec(segs[0]); }
    catch (e) {
      // mission/simulator ka koi callback phat gaya — learner ko khaali screen nahi, saaf message mile
      sink = null;
      print('err', `⚠️ Simulator error: ${e && e.message ? e.message : e} — yeh app ka bug hai, tumhara nahi. Doosra command try karo.`);
      if (typeof console !== 'undefined') console.error(e);
    }
    if (piped) {
      let text = (sink || []).join('\n');
      sink = null;
      let note = null;
      for (const filt of segs.slice(1)) {
        const r = applyFilter(text, filt);
        if (r.err) { print('err', r.err); text = null; break; }
        text = r.text; note = r.note || null;
      }
      if (text != null) {
        if (redirect) {
          sim.saved = sim.saved || {};
          sim.saved[redirect.replace(/^\.\//, '')] = text;
          print('sys', `(output → ${redirect} — dekhne ke liye: cat ${redirect})`);
        } else if (text) print('ok', text);
        if (note && !redirect) print('sys', note);
      }
    }
    try { refresh(); }   // har command ke baad — error paths ke baad bhi tasks/success update hon
    catch (e) { if (typeof console !== 'undefined') console.error(e); }
    return sawErr;
  }

  function exec(norm) {
    // mission-scripted overrides pehle
    for (const r of sim.responses) {
      const m = norm.match(r.re);
      if (m) {
        if (r.mutate) r.mutate(sim, m);
        const text = typeof r.out === 'function' ? r.out(sim, m) : r.out;
        if (text) print(r.err ? 'err' : 'ok', text);
        return;
      }
    }

    // shell-ish extras
    if (norm === 'help') {
      print('sys', [
        'Supported commands (is mission mein):',
        '  kubectl get <pods|deploy|svc|nodes|cm|endpoints|events|all> [name] [-o wide]',
        '  kubectl get pods,svc            (comma se kai kinds ek saath)',
        '  kubectl describe <pod|deploy|svc|node> <name>   (ya pod/<name>)',
        '  kubectl logs <pod> [--previous] [-c <container>]',
        '  kubectl delete pod <name>',
        '  kubectl apply -f <file>        (files dekhne ke liye: ls)',
        '  kubectl exec [-it] <pod> -- <cmd>',
        '  kubectl top <pods|nodes>',
        '  helm <cmd>                     (Helm mission: "helm help")',
        '  argocd <cmd>                   (GitOps mission: "argocd help")',
        '  kubectl argo rollouts get rollout <name> | promote | abort',
        '  kubectl get nodepools|nodeclaims|ec2nodeclasses   (Karpenter mission)',
        '  ls · clear · hint · help',
        `  shortcut: 'k' bhi chalega (k get po)`,
      ].join('\n'));
      return;
    }
    if (norm === 'clear') { out.innerHTML = ''; return; }
    if (norm === 'hint') { giveHint(); return; }
    if (norm === 'ls' || norm === 'ls -l' || norm === 'ls -la') {
      const names = Object.keys(sim.files).concat(Object.keys(sim.saved || {}));
      print('ok', names.length ? names.join('\n') : '(koi files nahi hain is mission mein)');
      return;
    }
    if (/^cat \S+$/.test(norm)) {
      const fname = norm.slice(4).replace(/^\.\//, '');
      if (sim.saved && sim.saved[fname] != null) { print('ok', sim.saved[fname]); return; }
      const f = sim.files[fname];
      if (f) { print('ok', f.content || `# ${fname}\n# ${String(f.desc || '(is file ka content mission mein nahi diya)').replace(/<[^>]+>/g, '')}`); return; }
      print('err', `cat: ${fname}: No such file or directory ('ls' se files dekho)`);
      return;
    }

    let toks = norm.split(' ');
    // helm commands helmsim.js sambhalta hai
    if (toks[0] === 'helm' && typeof KG.helm === 'function') { KG.helm(sim, toks, print); return; }
    // argocd CLI aur `kubectl argo rollouts ...` argosim.js sambhalta hai
    if (toks[0] === 'argocd' && typeof KG.argo === 'function') { KG.argo(sim, toks, print); return; }
    if (toks[0] === 'kubectl' && toks[1] === 'argo' && typeof KG.argo === 'function') { KG.argo(sim, toks, print); return; }
    if (toks[0] !== 'kubectl') {
      print('err', `bash: ${toks[0]}: command not found — yahan sirf kubectl chalta hai 🙂 ('help' try karo)`);
      return;
    }
    // flags nikal do jo hum ignore/parse karte hain
    const wide = toks.includes('-o') && toks[toks.indexOf('-o') + 1] === 'wide' || toks.includes('-owide') || toks.includes('-o=wide') || toks.includes('--output=wide');
    const prev = toks.includes('--previous') || toks.includes('-p') || toks.includes('--previous=true');
    toks = toks.filter((t, i) => !(t === '-o' || (toks[i - 1] === '-o') || t === '-owide' || t === '--previous' || t === '-p' || t === '-n' || toks[i - 1] === '-n' || t === '--namespace' || toks[i - 1] === '--namespace'));

    const verb = toks[1];

    if (!verb) { print('sys', 'kubectl controls the Kubernetes cluster manager. Try: kubectl get pods'); return; }

    // "pod/web-1", "pods/web-1" → "web-1";  "deploy/web" → "web" (pehla matching pod)
    const podName = s => (s || '').replace(/^(pods?|po|deploy(ment)?s?|rs|replicasets?|sts|statefulsets?)\//, '');

    if (verb === 'get') {
      const args = positional(toks.slice(2), ['-l', '--selector', '--field-selector', '--sort-by', '-L', '--label-columns', '-c']);
      let res = args[0];
      if (!res) { print('err', 'error: resource batana zaroori hai, e.g. kubectl get pods'); return; }
      let names = args.slice(1);
      // slash form: deploy/web
      if (res.includes('/')) { const [a, b] = res.split('/'); res = a; if (b) names = [b, ...names]; }
      // comma form: kubectl get pods,svc
      const kinds = res.split(',').filter(Boolean);
      const blocks = [];
      for (const r of kinds) {
        const kind = RES_ALIAS[r];
        if (!kind) { print('err', `error: the server doesn't have a resource type "${r}"`); return; }
        const pick = items => {
          if (!names.length) return items;
          return names.map(n => items.find(x => x.name === n) || items.find(x => (x.name || '').startsWith(n))).filter(Boolean);
        };
        // karpenter ke tables karpentersim se aate hain — unhe naam se filter nahi karte
        const dynamic = ['nodepools', 'nodeclaims', 'ec2nodeclasses'].includes(kind);
        if (names.length && kind !== 'all' && kind !== 'events' && !dynamic) {
          const found = pick(list(kind));
          const missing = names.filter(n => !found.some(x => x.name === n || (x.name || '').startsWith(n)));
          if (missing.length) { print('err', `Error from server (NotFound): ${kind} "${missing[0]}" not found`); return; }
        }
        let text;
        if (kind === 'all') {
          text = ['── pods ──', podTable(wide), '', '── deployments ──', genericTable('deployments') || 'No resources found.', '', '── services ──', genericTable('services') || 'No resources found.'].join('\n');
        } else if (kind === 'pods') {
          text = podTable(wide, pick(list('pods')));
        } else if (kind === 'events') {
          const evs = list('events');
          text = evs.length ? evs.join('\n') : 'No events found.';
        } else {
          const t = genericTable(kind, names.length && !dynamic ? pick(list(kind)) : null);
          text = (t == null || (!list(kind).length && !dynamic)) ? 'No resources found.' : t;
        }
        blocks.push(kinds.length > 1 ? `── ${kind} ──\n${text}` : text);
      }
      print('ok', blocks.join('\n\n'));
      return;
    }

    if (verb === 'describe') {
      const args = positional(toks.slice(2), ['-l', '--selector']);
      let res = args[0], name = args[1];
      if (res && res.includes('/')) { const [a, b] = res.split('/'); res = a; name = b; }
      const kind = RES_ALIAS[res];
      if (!kind) { print('err', `error: the server doesn't have a resource type "${res || ''}"`); return; }
      if (!name && list(kind).length === 1) name = list(kind)[0].name;   // kubectl describe <kind> = sab dikhata hai
      const obj = find(kind, name);
      if (!obj) { print('err', `Error from server (NotFound): ${kind} "${name || ''}" not found`); return; }
      print('ok', kind === 'pods' ? describePod(obj) : (obj.describe || `Name: ${obj.name}\n(describe output is mission mein limited hai)`));
      return;
    }

    if (verb === 'logs') {
      const args = positional(toks.slice(2), ['-c', '--container', '-l', '--selector', '--tail', '--since', '--since-time']);
      const want = podName(args[0]);
      const p = find('pods', want);
      if (!p) { print('err', `Error from server (NotFound): pods "${want || ''}" not found`); return; }
      const logs = prev ? (p.prevLogs || p.logs) : p.logs;
      print('ok', typeof logs === 'function' ? logs(sim) : (logs || '(no logs)'));
      return;
    }

    if (verb === 'delete') {
      const args = positional(toks.slice(2), ['--grace-period', '-l', '--selector', '--cascade', '-f', '--filename']);
      if (toks.includes('-f') || toks.includes('--filename')) {
        print('err', `Is mission mein 'delete -f' scripted nahi hai — goal padho ('hint' bhi le sakte ho)`);
        return;
      }
      let res = args[0], names = args.slice(1);
      if (res && res.includes('/')) { const [a, b] = res.split('/'); res = a; names = [b, ...names]; }
      const kind = RES_ALIAS[res];
      if (kind !== 'pods') { print('err', 'Is mission mein sirf pods delete kar sakte ho.'); return; }
      if (!names.length) { print('err', 'error: resource(s) were provided, but no name was specified'); return; }
      for (const n of names) {
        const p = find('pods', n);
        if (!p) { print('err', `Error from server (NotFound): pods "${n}" not found`); continue; }
        const pods = list('pods');
        pods.splice(pods.indexOf(p), 1);
        print('ok', `pod "${p.name}" deleted`);
        if (p.respawn) {
          pods.push(KG.cloneCluster(p.respawn));   // functions (logs: fn) bhi bachen
          print('sys', `(ReplicaSet ne turant naya pod bana diya — self-healing!)`);
        }
      }
      return;
    }

    if (verb === 'apply') {
      const fi = toks.findIndex(t => t === '-f' || t === '--filename');
      let fname = fi > -1 ? toks[fi + 1] : null;
      const eq = toks.find(t => /^(-f|--filename)=/.test(t));
      if (!fname && eq) fname = eq.split('=').slice(1).join('=');
      if (!fname) { print('err', 'error: must specify -f <file>'); return; }
      fname = fname.replace(/^\.\//, '');
      const f = sim.files[fname];
      if (!f) { print('err', `error: the path "${fname}" does not exist ('ls' se files dekho)`); return; }
      const msg = f.apply(sim);
      print('ok', msg || `${fname} applied`);
      return;
    }

    if (verb === 'exec') {
      // kubectl exec [-it] <pod> [-c ctr] -- cmd...
      const ddi = toks.indexOf('--');
      const args = positional(toks.slice(2, ddi > -1 ? ddi : undefined), ['-c', '--container']);
      const want = podName(args[0]);
      const p = find('pods', want);
      if (!p) { print('err', `Error from server (NotFound): pods "${want || ''}" not found`); return; }
      const cmd = ddi > -1 ? toks.slice(ddi + 1).join(' ') : '';
      if (!cmd) { print('err', 'error: you must specify a command after --  (e.g. kubectl exec ' + p.name + ' -- ls)'); return; }
      const outText = p.exec && p.exec[cmd];
      if (outText != null) print('ok', typeof outText === 'function' ? outText(sim) : outText);
      else if (p.status !== 'Running') print('err', `error: cannot exec into a container in a non-running pod: current phase is ${p.status}`);
      else print('err', `OCI runtime exec failed: exec: "${cmd.split(' ')[0]}": executable file not found in $PATH`);
      return;
    }

    if (verb === 'top') {
      const args = positional(toks.slice(2), ['-l', '--selector', '--sort-by']);
      const kind = RES_ALIAS[args[0]];
      const only = (items) => args[1] ? items.filter(x => x.name === args[1] || x.name.startsWith(args[1])) : items;
      if (kind === 'pods') {
        const rows = [['NAME', 'CPU(cores)', 'MEMORY(bytes)']];
        only(list('pods')).forEach(p => rows.push([p.name, (p.top || '5m 20Mi').split(' ')[0], (p.top || '5m 20Mi').split(' ')[1]]));
        print('ok', table(rows));
      } else if (kind === 'nodes') {
        const rows = [['NAME', 'CPU%', 'MEMORY%']];
        only(list('nodes')).forEach(n => rows.push([n.name, (n.top || '18% 42%').split(' ')[0], (n.top || '18% 42%').split(' ')[1]]));
        print('ok', table(rows));
      } else print('err', 'error: kubectl top [pods|nodes]');
      return;
    }

    if (verb === 'version') {
      print('ok', 'Client Version: v1.31.2\nKustomize Version: v5.4.2\nServer Version: v1.30.2');
      return;
    }

    if (verb === 'create' && (toks.includes('-f') || toks.includes('--filename'))) {
      print('err', `'kubectl create -f' sirf NAYA object banata hai (maujood ho toh AlreadyExists error).\nFix apply karne ke liye: kubectl apply -f <file>   ('ls' se files dekho)`);
      return;
    }

    // asli kubectl verbs jo is mission mein scripted nahi — "unknown command" bolna galat seekh hogi
    const REAL_VERBS = ['scale', 'rollout', 'edit', 'create', 'set', 'patch', 'label', 'annotate', 'cordon',
      'uncordon', 'drain', 'taint', 'expose', 'run', 'port-forward', 'auth', 'config', 'cp', 'explain',
      'api-resources', 'api-versions', 'cluster-info', 'wait', 'debug', 'replace', 'autoscale', 'certificate',
      'attach', 'proxy', 'kustomize', 'diff', 'events'];
    if (REAL_VERBS.includes(verb)) {
      print('err', `Is mission mein 'kubectl ${verb}' scripted nahi hai — mission ka goal padho, koi aur raasta hai. ('hint' bhi le sakte ho)`);
      return;
    }

    print('err', `error: unknown command "${verb}" for "kubectl" ('help' se supported commands dekho)`);
  }
};
