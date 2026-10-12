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
    const div = el('div', 't-' + kind);
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
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

  /* ---------- table printers ---------- */
  function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(1, n - s.length)); }
  function table(rows) {
    if (!rows.length) return 'No resources found.';
    const widths = rows[0].map((_, c) => Math.max(...rows.map(r => String(r[c]).length)) + 3);
    return rows.map(r => r.map((cell, c) => pad(cell, widths[c])).join('').trimEnd()).join('\n');
  }
  function podTable(wide) {
    const head = ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'];
    if (wide) head.push('IP', 'NODE');
    const rows = [head];
    list('pods').forEach(p => {
      const r = [p.name, p.ready, p.status, p.restarts, p.age];
      if (wide) r.push(p.ip || '<none>', p.node || '<none>');
      rows.push(r);
    });
    return table(rows);
  }
  function genericTable(kind) {
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
      const a = list('apps');
      return a.length ? table([['NAME', 'SYNC STATUS', 'HEALTH STATUS', 'PROJECT', 'REVISION'],
        ...a.map(x => [x.name, x.sync, x.health, x.project || 'default', x.revision || '-'])]) : 'No resources found.';
    }
    if (kind === 'appsets') {
      const a = list('appsets');
      return a.length ? table([['NAME', 'GENERATOR', 'APPS'], ...a.map(x => [x.name, x.generator, (x.produces || []).length])]) : 'No resources found.';
    }
    if (kind === 'rollouts') {
      const r = list('rollouts');
      return r.length ? table([['NAME', 'STRATEGY', 'STATUS', 'STEP', 'WEIGHT'],
        ...r.map(x => [x.name, x.strategy, x.status, (x.step != null ? x.step + '/' + (x.steps || []).length : '-'), x.weight != null ? x.weight + '%' : '-'])]) : 'No resources found.';
    }
    const cols = defs[kind];
    if (!cols) return null;
    const rows = [cols];
    list(kind).forEach(r => rows.push(cols.map(c => {
      const key = c.toLowerCase().replace(/[^a-z]/g, '');
      const map = {
        name: r.name, ready: r.ready, uptodate: r.upToDate, available: r.available,
        age: r.age, type: r.type, clusterip: r.clusterIP, ports: r.ports,
        status: r.status, roles: r.roles, version: r.version, data: r.dataCount,
        endpoints: r.endpoints, desired: r.desired, current: r.current, class: r.class,
        hosts: r.hosts, address: r.address, podselector: r.podSelector,
        reference: r.reference, targets: r.targets, minpods: r.min, maxpods: r.max,
        replicas: r.replicas, volume: r.volume, capacity: r.capacity,
        accessmodes: r.accessModes, storageclass: r.storageClass,
        reclaimpolicy: r.reclaimPolicy, claim: r.claim,
        instancetype: r.instanceType, capacity: r.capacityType, zone: r.zone, nodepool: r.nodepool,
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
      stage.tasks.forEach((t, i) => {
        if (t.check && t.check(sim)) taskList.children[i].classList.add('done');
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
    const norm = raw.replace(/\s+/g, ' ').trim();
    sim.history.push(norm);
    exec(norm);
    refresh();   // har command ke baad — error paths ke baad bhi tasks/success update hon
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
        '  kubectl get <pods|deploy|svc|nodes|cm|endpoints|events|all> [-o wide]',
        '  kubectl describe <pod|deploy|svc|node> <name>',
        '  kubectl logs <pod> [--previous]',
        '  kubectl delete pod <name>',
        '  kubectl apply -f <file>        (files dekhne ke liye: ls)',
        '  kubectl exec <pod> -- <cmd>',
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
    if (norm === 'ls') {
      const names = Object.keys(sim.files);
      print('ok', names.length ? names.join('\n') : '(koi files nahi hain is mission mein)');
      return;
    }

    let toks = norm.split(' ');
    if (toks[0] === 'k') toks[0] = 'kubectl';
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
    const wide = toks.includes('-o') && toks[toks.indexOf('-o') + 1] === 'wide' || toks.includes('-owide');
    const prev = toks.includes('--previous') || toks.includes('-p');
    toks = toks.filter((t, i) => !(t === '-o' || (toks[i - 1] === '-o') || t === '-owide' || t === '--previous' || t === '-p' || t === '-n' || toks[i - 1] === '-n'));

    const verb = toks[1];

    if (!verb) { print('sys', 'kubectl controls the Kubernetes cluster manager. Try: kubectl get pods'); return; }

    if (verb === 'get') {
      let res = toks[2];
      // "kubectl get pod web-abc" bhi table dikhata hai
      if (!res) { print('err', 'error: resource batana zaroori hai, e.g. kubectl get pods'); return; }
      // slash form: deploy/web
      if (res.includes('/')) { const [a] = res.split('/'); res = a; }
      const kind = RES_ALIAS[res];
      if (!kind) { print('err', `error: the server doesn't have a resource type "${res}"`); return; }
      if (kind === 'all') {
        print('ok', ['── pods ──', podTable(wide), '', '── deployments ──', genericTable('deployments') || 'No resources found.', '', '── services ──', genericTable('services') || 'No resources found.'].join('\n'));
      } else if (kind === 'pods') {
        print('ok', podTable(wide));
      } else if (kind === 'events') {
        const evs = list('events');
        print('ok', evs.length ? evs.join('\n') : 'No events found.');
      } else {
        const t = genericTable(kind);
        print('ok', t != null ? (list(kind).length ? t : 'No resources found.') : 'No resources found.');
      }
      return;
    }

    if (verb === 'describe') {
      let res = toks[2], name = toks[3];
      if (res && res.includes('/')) { const [a, b] = res.split('/'); res = a; name = b; }
      const kind = RES_ALIAS[res];
      if (!kind) { print('err', `error: the server doesn't have a resource type "${res || ''}"`); return; }
      const obj = find(kind, name);
      if (!obj) { print('err', `Error from server (NotFound): ${kind} "${name || ''}" not found`); return; }
      print('ok', kind === 'pods' ? describePod(obj) : (obj.describe || `Name: ${obj.name}\n(describe output is mission mein limited hai)`));
      return;
    }

    if (verb === 'logs') {
      const p = find('pods', toks[2]);
      if (!p) { print('err', `Error from server (NotFound): pods "${toks[2] || ''}" not found`); return; }
      const logs = prev ? (p.prevLogs || p.logs) : p.logs;
      print('ok', typeof logs === 'function' ? logs(sim) : (logs || '(no logs)'));
      return;
    }

    if (verb === 'delete') {
      const kind = RES_ALIAS[toks[2]];
      if (kind !== 'pods') { print('err', 'Is mission mein sirf pods delete kar sakte ho.'); return; }
      const p = find('pods', toks[3]);
      if (!p) { print('err', `Error from server (NotFound): pods "${toks[3] || ''}" not found`); return; }
      const pods = list('pods');
      pods.splice(pods.indexOf(p), 1);
      print('ok', `pod "${p.name}" deleted`);
      if (p.respawn) {
        pods.push(JSON.parse(JSON.stringify(p.respawn)));
        print('sys', `(ReplicaSet ne turant naya pod bana diya — self-healing!)`);
      }
      return;
    }

    if (verb === 'apply') {
      const fi = toks.indexOf('-f');
      const fname = fi > -1 ? toks[fi + 1] : null;
      if (!fname) { print('err', 'error: must specify -f <file>'); return; }
      const f = sim.files[fname];
      if (!f) { print('err', `error: the path "${fname}" does not exist ('ls' se files dekho)`); return; }
      const msg = f.apply(sim);
      print('ok', msg || `${fname} applied`);
      return;
    }

    if (verb === 'exec') {
      // kubectl exec <pod> -- cmd...
      const ddi = toks.indexOf('--');
      const p = find('pods', toks[2] === '-it' ? toks[3] : toks[2]);
      if (!p) { print('err', `Error from server (NotFound): pods "${toks[2] || ''}" not found`); return; }
      const cmd = ddi > -1 ? toks.slice(ddi + 1).join(' ') : '';
      if (!cmd) { print('err', 'error: you must specify a command after --'); return; }
      const outText = p.exec && p.exec[cmd];
      if (outText != null) print('ok', outText);
      else if (p.status !== 'Running') print('err', `error: cannot exec into a container in a non-running pod: current phase is ${p.status}`);
      else print('err', `OCI runtime exec failed: exec: "${cmd.split(' ')[0]}": executable file not found in $PATH`);
      return;
    }

    if (verb === 'top') {
      const kind = RES_ALIAS[toks[2]];
      if (kind === 'pods') {
        const rows = [['NAME', 'CPU(cores)', 'MEMORY(bytes)']];
        list('pods').forEach(p => rows.push([p.name, (p.top || '5m 20Mi').split(' ')[0], (p.top || '5m 20Mi').split(' ')[1]]));
        print('ok', table(rows));
      } else if (kind === 'nodes') {
        const rows = [['NAME', 'CPU%', 'MEMORY%']];
        list('nodes').forEach(n => rows.push([n.name, (n.top || '18% 42%').split(' ')[0], (n.top || '18% 42%').split(' ')[1]]));
        print('ok', table(rows));
      } else print('err', 'error: kubectl top [pods|nodes]');
      return;
    }

    if (verb === 'scale' || verb === 'rollout' || verb === 'edit' || verb === 'create' || verb === 'set') {
      print('err', `Is mission mein '${verb}' scripted nahi hai — mission ka goal padho, koi aur raasta hai. ('hint' bhi le sakte ho)`);
      return;
    }

    print('err', `error: unknown command "${verb}" ('help' se supported commands dekho)`);
  }
};
