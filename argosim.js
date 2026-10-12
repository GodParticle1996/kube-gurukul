/* =====================================================================
   KubeGurukul — ArgoCD Simulator
   terminal.js `argocd ...` aur `kubectl argo rollouts ...` yahan bhejta hai.

   Mission cluster mein (data-argocd.js dekho):
     apps: [ {
       name, project, repo, path, targetRevision, destNamespace, destServer,
       sync: 'Synced'|'OutOfSync', health: 'Healthy'|'Degraded'|'Progressing'|'Missing',
       revision, syncPolicy: { automated: { prune, selfHeal } },
       resources: [ { group, kind, name, status, health, wave, hook } ],
       diff: 'text' | (sim, app) => 'text',      // argocd app diff
       history: [ { id, revision, deployedAt, note } ],
       onSync:     (sim, app) => true|false,     // false = sync FAIL
       onRollback: (sim, app, entry) => {},
       notes, degradedReason,
     } ]
     appsets:  [ { name, generator, produces: ['app-dev','app-prod'] } ]
     projects: [ { name, sourceRepos, destinations, allowedKinds } ]
     argoClusters: [ { server, name, version, status } ]
     rollouts: [ { name, strategy:'canary'|'blueGreen', status, step, steps:[],
                   weight, stable, canary, analysis: {...}, images } ]
   ===================================================================== */

KG.argo = (function () {

  function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(1, n - s.length)); }
  function table(rows) {
    if (!rows.length) return '';
    const w = rows[0].map((_, c) => Math.max(...rows.map(r => String(r[c]).length)) + 2);
    return rows.map(r => r.map((c, i) => pad(c, w[i])).join('').trimEnd()).join('\n');
  }
  function findApp(sim, name) {
    const apps = sim.cluster.apps || [];
    return apps.find(a => a.name === name) || apps.find(a => a.name.startsWith(name || '~')) || null;
  }
  function flags(toks) {
    const f = { set: new Set(), args: [], kv: {} };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === '--revision' || t === '--to' || t === '--dest-namespace' || t === '--project') { f.kv[t.replace(/^--/, '')] = toks[++i]; }
      else if (t.startsWith('--')) f.set.add(t.slice(2));
      else if (t.startsWith('-') && t.length === 2) f.set.add(t.slice(1));
      else f.args.push(t);
    }
    return f;
  }

  /* app ke resources ka status recompute (sync ke baad) */
  function markSynced(app) {
    app.sync = 'Synced';
    (app.resources || []).forEach(r => { if (!r.pruneMe) r.status = 'Synced'; });
    // prune wale resources hata do agar prune allowed hai
    if (app.resources) app.resources = app.resources.filter(r => !(r.pruneMe && r.pruned));
  }

  function appGet(sim, app) {
    const pol = app.syncPolicy && app.syncPolicy.automated;
    const lines = [
      `Name:               ${app.name}`,
      `Project:            ${app.project || 'default'}`,
      `Server:             ${app.destServer || 'https://kubernetes.default.svc'}`,
      `Namespace:          ${app.destNamespace || 'default'}`,
      `Repo:               ${app.repo || 'https://github.com/company/manifests'}`,
      `Target:             ${app.targetRevision || 'main'}`,
      `Path:               ${app.path || '.'}`,
      `SyncWindow:         Sync Allowed`,
      `Sync Policy:        ${pol ? 'Automated' + (pol.prune ? ' (Prune)' : '') + (pol.selfHeal ? ' (Self Heal)' : '') : '<none> (manual)'}`,
      `Sync Status:        ${app.sync}${app.sync === 'OutOfSync' ? ' from ' + (app.targetRevision || 'main') : ''} (${app.revision || 'abc1234'})`,
      `Health Status:      ${app.health}${app.degradedReason ? ' (' + app.degradedReason + ')' : ''}`,
      '',
    ];
    if ((app.resources || []).length) {
      lines.push(table([['GROUP', 'KIND', 'NAMESPACE', 'NAME', 'STATUS', 'HEALTH'],
        ...app.resources.map(r => [r.group || '', r.kind, app.destNamespace || 'default', r.name,
          r.status || 'Synced', r.health || (r.kind === 'Service' ? '' : 'Healthy')])]));
    }
    return lines.join('\n');
  }

  /* =====================================================================
     kubectl argo rollouts ...
     ===================================================================== */
  function rolloutsExec(sim, toks, print) {
    const ros = sim.cluster.rollouts || [];
    const sub = toks[3];                       // kubectl argo rollouts <sub>
    const name = toks[5] || toks[4];           // ... get rollout <name>  |  ... promote <name>
    const ro = ros.find(r => r.name === name) || ros[0];

    if (sub === 'list') {
      if (!ros.length) { print('err', 'No rollouts found'); return true; }
      print('ok', table([['NAME', 'STRATEGY', 'STATUS', 'STEP', 'SET-WEIGHT', 'READY', 'DESIRED'],
        ...ros.map(r => [r.name, r.strategy, r.status, (r.step != null ? r.step + '/' + (r.steps || []).length : '-'),
          r.weight != null ? r.weight : '-', r.ready || '3', r.desired || '3'])]));
      return true;
    }
    if (!ro) { print('err', `Error: rollouts.argoproj.io "${name || ''}" not found`); return true; }

    if (sub === 'get') {
      const stepList = (ro.steps || []).map((s, i) =>
        `   ${i === ro.step ? '►' : ' '} ${i}: ${s}`).join('\n');
      print('ok',
`Name:            ${ro.name}
Namespace:       default
Status:          ${ro.status === 'Paused' ? '⏸ Paused' : ro.status === 'Healthy' ? '✔ Healthy' : ro.status === 'Degraded' ? '✖ Degraded' : '◌ Progressing'}
Strategy:        ${ro.strategy === 'canary' ? 'Canary' : 'BlueGreen'}
${ro.strategy === 'canary' ? `  Step:          ${ro.step}/${(ro.steps || []).length}
  SetWeight:     ${ro.weight}
  ActualWeight:  ${ro.weight}` : `  ActiveService:  ${ro.name}-active
  PreviewService: ${ro.name}-preview`}
Images:          ${(ro.images || ['app:v1 (stable)', 'app:v2 (canary)']).join('\n                 ')}
Replicas:
  Desired:       ${ro.desired || 3}
  Current:       ${ro.current || 3}
  Ready:         ${ro.ready || 3}

STEPS:
${stepList || '   (no steps)'}
${ro.analysisMsg ? '\nANALYSIS:\n  ' + ro.analysisMsg : ''}`);
      return true;
    }
    if (sub === 'promote') {
      if (ro.status === 'Degraded') { print('err', `Error: rollout is Degraded — pehle "abort" karo ya naya version deploy karo`); return true; }
      if (toks.includes('--full')) {
        ro.step = (ro.steps || []).length; ro.weight = 100; ro.status = 'Healthy';
        ro.images = ['app:v2 (stable)'];
        print('ok', `rollout '${ro.name}' fully promoted\n(saare steps skip — 100% traffic v2 par. Analysis bhi skip hui!)`);
      } else {
        ro.step = Math.min((ro.step || 0) + 1, (ro.steps || []).length);
        const st = (ro.steps || [])[ro.step - 1] || '';
        const m = st.match(/setWeight:\s*(\d+)/);
        if (m) ro.weight = parseInt(m[1], 10);
        ro.status = ro.step >= (ro.steps || []).length ? 'Healthy' : 'Paused';
        if (ro.status === 'Healthy') { ro.weight = 100; ro.images = ['app:v2 (stable)']; }
        print('ok', `rollout '${ro.name}' promoted to step ${ro.step}${m ? ' (weight ' + ro.weight + '%)' : ''}`);
      }
      if (ro.onChange) ro.onChange(sim, ro);
      return true;
    }
    if (sub === 'abort') {
      ro.status = 'Degraded'; ro.aborted = true; ro.weight = 0;
      ro.images = ['app:v1 (stable)'];
      print('ok', `rollout '${ro.name}' aborted\n(traffic 100% STABLE version par wapas — canary pods scale down ho rahe hain. Rollout "Degraded" dikhega jab tak naya version deploy na ho.)`);
      if (ro.onChange) ro.onChange(sim, ro);
      return true;
    }
    if (sub === 'undo') {
      ro.status = 'Healthy'; ro.weight = 0; ro.images = ['app:v1 (stable)']; ro.step = 0;
      print('ok', `rollout '${ro.name}' undo — pichle revision par wapas`);
      return true;
    }
    if (sub === 'status') {
      print(ro.status === 'Degraded' ? 'err' : 'ok', `${ro.status === 'Paused' ? 'Paused - CanaryPauseStep' : ro.status}`);
      return true;
    }
    print('err', `Error: unknown rollouts command "${sub || ''}"\n(get rollout <name> | list rollouts | promote | abort | undo | status)`);
    return true;
  }

  /* =====================================================================
     MAIN
     ===================================================================== */
  return function argoExec(sim, toks, print) {
    sim.cluster.apps = sim.cluster.apps || [];

    // kubectl argo rollouts ...
    if (toks[0] === 'kubectl' && toks[1] === 'argo') return rolloutsExec(sim, toks, print);

    const verb = toks[1];
    const f = flags(toks.slice(2));
    const a = f.args;

    if (!verb || verb === 'help' || verb === '--help') {
      print('sys', [
        'ArgoCD commands (is mission mein):',
        '  argocd app list · argocd app get <app> · argocd app diff <app>',
        '  argocd app sync <app> [--prune] [--dry-run]',
        '  argocd app history <app> · argocd app rollback <app> <id>',
        '  argocd app set <app> --sync-policy automated|none [--auto-prune] [--self-heal]',
        '  argocd app delete <app> · argocd app wait <app>',
        '  argocd appset list · argocd proj list · argocd cluster list',
        '  argocd version · argocd login <server>',
        '  kubectl argo rollouts get rollout <name> | promote | abort | list rollouts',
      ].join('\n'));
      return true;
    }

    if (verb === 'version') { print('ok', 'argocd: v2.11.3+unknown\nargocd-server: v2.11.3'); return true; }
    if (verb === 'login') { print('ok', `'${a[0] || 'localhost:8080'}' logged in successfully\nContext '${a[0] || 'localhost:8080'}' updated`); return true; }

    if (verb === 'cluster') {
      const cl = sim.cluster.argoClusters || [{ server: 'https://kubernetes.default.svc', name: 'in-cluster', version: '1.30', status: 'Successful' }];
      print('ok', table([['SERVER', 'NAME', 'VERSION', 'STATUS'], ...cl.map(c => [c.server, c.name, c.version, c.status])]));
      return true;
    }

    if (verb === 'proj') {
      const pr = sim.cluster.projects || [];
      if (a[0] === 'get') {
        const p = pr.find(x => x.name === a[1]);
        if (!p) { print('err', `Error: project '${a[1] || ''}' not found`); return true; }
        print('ok', `Name:                        ${p.name}\nDescription:                 ${p.description || ''}\nDestinations:                ${(p.destinations || []).join(', ') || '*'}\nRepositories:                ${(p.sourceRepos || ['*']).join(', ')}\nAllowed Cluster Resources:   ${(p.allowedKinds || ['*']).join(', ')}`);
        return true;
      }
      if (!pr.length) { print('ok', 'NAME     DESCRIPTION\ndefault  (built-in — sab kuch allowed! production mein ise restrict karo)'); return true; }
      print('ok', table([['NAME', 'DESCRIPTION', 'DESTINATIONS', 'SOURCES'],
        ...pr.map(p => [p.name, p.description || '', (p.destinations || ['*']).join(','), (p.sourceRepos || ['*']).join(',')])]));
      return true;
    }

    if (verb === 'appset' || verb === 'applicationset') {
      const as = sim.cluster.appsets || [];
      if (!as.length) { print('err', 'No ApplicationSets found'); return true; }
      if (a[0] === 'get') {
        const s = as.find(x => x.name === a[1]) || as[0];
        print('ok', `Name:        ${s.name}\nProject:     ${s.project || 'default'}\nGenerator:   ${s.generator}\nGenerated Applications:\n  ` +
          (s.produces || []).join('\n  ') + `\n\n(ApplicationSet ek CONTROLLER hai jo Applications BANATA hai — inhe manually edit mat karo, generator badlo!)`);
        return true;
      }
      print('ok', table([['NAME', 'GENERATOR', 'APPS'], ...as.map(s => [s.name, s.generator, (s.produces || []).length])]));
      return true;
    }

    if (verb !== 'app') { print('err', `Error: unknown command "${verb}" for "argocd"\n('argocd help' dekho)`); return true; }

    /* ---------------- argocd app ... ---------------- */
    const sub = a[0];
    const app = findApp(sim, a[1]);

    if (sub === 'list' || !sub) {
      if (!sim.cluster.apps.length) { print('ok', 'NAME  CLUSTER  NAMESPACE  PROJECT  STATUS  HEALTH\n(koi Application nahi)'); return true; }
      print('ok', table([['NAME', 'CLUSTER', 'NAMESPACE', 'PROJECT', 'STATUS', 'HEALTH', 'SYNCPOLICY', 'REVISION'],
        ...sim.cluster.apps.map(x => [x.name, (x.destServer || 'in-cluster').replace('https://kubernetes.default.svc', 'in-cluster'),
          x.destNamespace || 'default', x.project || 'default', x.sync, x.health,
          x.syncPolicy && x.syncPolicy.automated ? 'Auto' + (x.syncPolicy.automated.prune ? '-Prune' : '') : 'Manual',
          x.revision || 'abc1234'])]));
      return true;
    }

    if (!app && ['get', 'diff', 'sync', 'history', 'rollback', 'set', 'delete', 'wait', 'manifests', 'refresh'].includes(sub)) {
      print('err', `Error: rpc error: code = NotFound desc = applications.argoproj.io "${a[1] || ''}" not found`);
      return true;
    }

    if (sub === 'get') { print('ok', appGet(sim, app)); return true; }

    if (sub === 'refresh') {
      print('ok', `Application '${app.name}' refreshed${f.set.has('hard-refresh') ? ' (hard — git se manifests dobara fetch + render hue)' : ' (cache se compare)'}`);
      return true;
    }

    if (sub === 'diff') {
      if (app.sync === 'Synced') { print('ok', '(koi diff nahi — git aur cluster match karte hain ✓)'); return true; }
      const d = typeof app.diff === 'function' ? app.diff(sim, app) : app.diff;
      print('ok', d || '===== apps/Deployment default/' + app.name + ' ======\n- image: app:v1\n+ image: app:v2');
      return true;
    }

    if (sub === 'manifests') {
      print('ok', app.manifests || '(rendered manifests is mission mein available nahi)');
      return true;
    }

    if (sub === 'sync') {
      if (f.set.has('dry-run')) {
        print('ok', `TIMESTAMP  GROUP  KIND  NAMESPACE  NAME  STATUS  HEALTH\n(dry-run — kuch apply nahi hua, sirf plan dikhaya)`);
        return true;
      }
      const needsPrune = (app.resources || []).some(r => r.pruneMe && !r.pruned);
      const autoPrune = app.syncPolicy && app.syncPolicy.automated && app.syncPolicy.automated.prune;
      let pruneNote = '';
      if (needsPrune && (f.set.has('prune') || autoPrune)) {
        (app.resources || []).forEach(r => { if (r.pruneMe) r.pruned = true; });
        pruneNote = '\n(--prune: git se hata hua resource cluster se bhi DELETE kar diya ✓)';
      } else if (needsPrune) {
        pruneNote = '\n⚠️  Ek resource git se hat chuka hai par cluster mein pada hai — bina --prune ke woh NAHI hatega (app OutOfSync hi rahega!)';
      }
      // sync waves ka order dikhao
      const waves = [...new Set((app.resources || []).map(r => r.wave || 0))].sort((x, y) => x - y);
      const waveLog = waves.length > 1
        ? '\nSync waves: ' + waves.map(w => 'wave ' + w + ' (' + (app.resources.filter(r => (r.wave || 0) === w).map(r => r.kind).join(', ')) + ')').join(' → ')
        : '';
      let okSync = true;
      if (app.onSync) okSync = app.onSync(sim, app) !== false;
      if (!okSync) {
        app.sync = 'OutOfSync';
        app.health = app.health === 'Missing' ? 'Missing' : 'Degraded';
        print('err', `FATAL: Operation terminated — sync FAILED\nMessage: ${app.syncError || 'one or more objects failed to apply'}\n` +
          `(app "${app.name}" ab ${app.sync}/${app.health} hai — "argocd app get" se resources dekho)`);
        return true;
      }
      markSynced(app);
      if (app.health === 'Missing') app.health = 'Healthy';
      app.revision = app.targetRevisionSha || 'def5678';
      (app.history = app.history || []).push({
        id: (app.history || []).length + 1, revision: app.revision,
        deployedAt: new Date().toISOString().slice(0, 19) + 'Z', note: 'Sync',
      });
      print('ok', `TIMESTAMP  GROUP  KIND  NAMESPACE  NAME  STATUS  HEALTH\n` +
        (app.resources || []).map(r => `           ${r.group || ''}  ${r.kind}  ${app.destNamespace || 'default'}  ${r.name}  Synced  ${r.health || 'Healthy'}`).join('\n') +
        waveLog + pruneNote +
        `\n\nApplication '${app.name}' synced — Sync: Synced, Health: ${app.health}`);
      return true;
    }

    if (sub === 'wait') {
      print(app.health === 'Degraded' ? 'err' : 'ok',
        app.health === 'Degraded'
          ? `Error: application '${app.name}' health is Degraded — timed out\n(CI mein "argocd app wait --health" isliye lagate hain: kharab deploy pipeline ko FAIL kare)`
          : `Application '${app.name}': Sync=${app.sync} Health=${app.health} ✓`);
      return true;
    }

    if (sub === 'history') {
      const h = app.history || [];
      if (!h.length) { print('ok', 'ID  DATE  REVISION\n(koi history nahi — abhi tak sync nahi hua)'); return true; }
      print('ok', table([['ID', 'DATE', 'REVISION', 'NOTE'],
        ...h.map(x => [x.id, x.deployedAt, x.revision, x.note || ''])]));
      return true;
    }

    if (sub === 'rollback') {
      const id = parseInt(a[2] || f.kv.to, 10);
      const entry = (app.history || []).find(x => x.id === id);
      if (!entry) { print('err', `Error: application '${app.name}' does not have history id ${a[2] || '?'}\n(argocd app history ${app.name} se IDs dekho)`); return true; }
      if (app.syncPolicy && app.syncPolicy.automated && app.syncPolicy.automated.selfHeal) {
        print('err',
`Error: rollback cannot be performed — application has automated sync with selfHeal enabled.

⚠️  GitOps ka asli sabak: auto-sync ON hai toh rollback ka matlab hai GIT ko peeche le jaana:
    git revert <commit> && git push   → ArgoCD khud sync kar dega.
    (argocd app rollback sirf tab kaam aata hai jab auto-sync OFF ho.)`);
        return true;
      }
      app.revision = entry.revision;
      markSynced(app);
      app.health = 'Healthy';
      (app.history = app.history || []).push({
        id: app.history.length + 1, revision: entry.revision,
        deployedAt: new Date().toISOString().slice(0, 19) + 'Z', note: 'Rollback to ' + id,
      });
      if (app.onRollback) app.onRollback(sim, app, entry);
      print('ok', `Application '${app.name}' rolled back to revision ${entry.revision} (history id ${id})\n⚠️  Cluster ab GIT se alag hai — git ko bhi theek karo warna agla sync ise wapas bigaad dega!`);
      return true;
    }

    if (sub === 'set') {
      const pol = toks.join(' ');
      app.syncPolicy = app.syncPolicy || {};
      if (/--sync-policy\s+automated/.test(pol)) {
        app.syncPolicy.automated = app.syncPolicy.automated || {};
        if (/--auto-prune/.test(pol)) app.syncPolicy.automated.prune = true;
        if (/--self-heal/.test(pol)) app.syncPolicy.automated.selfHeal = true;
        print('ok', `application '${app.name}' updated\nSync Policy: Automated` +
          (app.syncPolicy.automated.prune ? ' (Prune)' : '') +
          (app.syncPolicy.automated.selfHeal ? ' (Self Heal)' : '') +
          `\n(ab git hi boss hai — manual kubectl changes wapas revert ho jayenge)`);
      } else if (/--sync-policy\s+none/.test(pol)) {
        delete app.syncPolicy.automated;
        print('ok', `application '${app.name}' updated — Sync Policy: <none> (manual sync)`);
      } else {
        print('err', 'Error: argocd app set <app> --sync-policy automated|none [--auto-prune] [--self-heal]');
      }
      return true;
    }

    if (sub === 'delete') {
      sim.cluster.apps = sim.cluster.apps.filter(x => x !== app);
      print('ok', `application '${app.name}' deleted\n(cascade delete — uske resources bhi jaayenge. Sirf Application object hatana ho toh: --cascade=false)`);
      return true;
    }

    if (sub === 'create') {
      if (findApp(sim, a[1])) { print('err', `Error: application '${a[1]}' already exists`); return true; }
      sim.cluster.apps.push({
        name: a[1], project: f.kv.project || 'default', sync: 'OutOfSync', health: 'Missing',
        destNamespace: f.kv['dest-namespace'] || 'default', resources: [],
      });
      print('ok', `application '${a[1]}' created\n(abhi OutOfSync/Missing hai — "argocd app sync ${a[1]}" karo ya auto-sync on karo)`);
      return true;
    }

    print('err', `Error: unknown command "app ${sub}"\n(list|get|diff|sync|history|rollback|set|wait|refresh|create|delete)`);
    return true;
  };
})();
