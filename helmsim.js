/* =====================================================================
   KubeGurukul — Helm Simulator
   terminal.js `helm ...` commands ko yahan bhejta hai.

   Mission cluster mein (data-helm.js dekho):
     releases:    [ { name, chart, appVersion, namespace, revision, status,
                      updated, values:{}, history:[], notes, manifest } ]
     repos:       [ { name, url } ]
     searchIndex: [ { name, version, appVersion, description } ]
     valuesFiles: { 'values-prod.yaml': { replicas: 10 } }
     charts: {
       './shop': {
         name, version, appVersion,
         valuesYaml: 'text (helm show values)',
         defaults: { ... },                 // chart ke default values (merge base)
         render: (vals, rel) => 'rendered yaml',
         lint:   [ '==> Linting ./shop', ... ],
         notes:  'NOTES.txt text',
         deps:   [ { name, version, repository, condition } ],
         onInstall: (sim, rel) => {},       // pods waghairah banao
         onUpgrade: (sim, rel, prev) => {},
         testOut: 'helm test output',
       }
     }
   ===================================================================== */

KG.helm = (function () {

  /* ---------- chhote helpers ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o === undefined ? null : o)); }

  function deepMerge(base, over) {
    const out = clone(base) || {};
    Object.keys(over || {}).forEach(k => {
      const v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]))
        out[k] = deepMerge(out[k], v);
      else out[k] = clone(v);
    });
    return out;
  }

  // "image.tag=2.0" -> { image: { tag: '2.0' } }   (numbers/bools cast hote hain)
  function setPath(obj, expr) {
    const eq = expr.indexOf('=');
    if (eq < 0) return obj;
    const path = expr.slice(0, eq).split('.');
    let raw = expr.slice(eq + 1);
    let val = raw;
    if (/^-?\d+$/.test(raw)) val = parseInt(raw, 10);
    else if (/^-?\d*\.\d+$/.test(raw)) val = parseFloat(raw);
    else if (raw === 'true') val = true;
    else if (raw === 'false') val = false;
    else if (raw === 'null') val = null;
    let cur = obj;
    path.forEach((p, i) => {
      if (i === path.length - 1) cur[p] = val;
      else { if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}; cur = cur[p]; }
    });
    return obj;
  }

  function toYaml(obj, indent) {
    indent = indent || 0;
    const pad = ' '.repeat(indent);
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return String(obj);
    if (Array.isArray(obj))
      return obj.map(v => pad + '- ' + (typeof v === 'object' ? '\n' + toYaml(v, indent + 2) : String(v))).join('\n');
    return Object.keys(obj).map(k => {
      const v = obj[k];
      if (v && typeof v === 'object')
        return pad + k + ':\n' + toYaml(v, indent + 2);
      return pad + k + ': ' + (v === null ? 'null' : String(v));
    }).join('\n');
  }

  function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(1, n - s.length)); }
  function table(rows) {
    if (!rows.length) return '';
    const w = rows[0].map((_, c) => Math.max(...rows.map(r => String(r[c]).length)) + 2);
    return rows.map(r => r.map((c, i) => pad(c, w[i])).join('').trimEnd()).join('\n');
  }
  function stamp() {
    const d = new Date();
    return d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  }

  /* ---------- flag parsing ---------- */
  function parseFlags(toks, sim, print) {
    const f = { values: {}, files: [], sets: [], flags: new Set(), namespace: 'default', revision: null, bad: null };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === '-f' || t === '--values') {
        const name = toks[++i];
        const vf = (sim.cluster.valuesFiles || {})[name];
        if (vf === undefined) { f.bad = `Error: open ${name}: no such file or directory`; return f; }
        f.files.push(name);
        f.values = deepMerge(f.values, vf);
      } else if (t === '--set' || t === '--set-string') {
        const expr = toks[++i];
        if (expr) { f.sets.push(expr); setPath(f.values, expr); }
      } else if (t === '-n' || t === '--namespace') {
        f.namespace = toks[++i] || 'default';
      } else if (t === '--revision') {
        f.revision = parseInt(toks[++i], 10);
      } else if (t.startsWith('--')) {
        f.flags.add(t.slice(2));
      } else if (t.startsWith('-') && t.length > 1 && !/^-\d/.test(t)) {
        f.flags.add(t.slice(1));
      } else {
        f.args = f.args || [];
        f.args.push(t);
      }
    }
    f.args = f.args || [];
    return f;
  }

  function findChart(sim, ref) {
    const charts = sim.cluster.charts || {};
    if (charts[ref]) return charts[ref];
    // "./shop" ~ "shop" ~ "bitnami/nginx" — thoda flexible raho
    const key = Object.keys(charts).find(k => k === ref || k.replace(/^\.\//, '') === ref.replace(/^\.\//, ''));
    return key ? charts[key] : null;
  }
  function findRelease(sim, name) {
    return (sim.cluster.releases || []).find(r => r.name === name) || null;
  }
  function mergedValues(chart, userValues) {
    return deepMerge(chart.defaults || {}, userValues || {});
  }

  /* ---------- release banana / badalna ---------- */
  function newRelease(sim, chart, name, userVals, coalesced, ns) {
    const rel = {
      name, namespace: ns || 'default',
      chart: chart.name + '-' + chart.version,
      chartRef: chart._ref,
      appVersion: chart.appVersion || '1.0.0',
      revision: 1, status: 'deployed', updated: stamp(),
      // values     = coalesced (chart defaults + user) — rendering ke liye
      // userValues = SIRF user ne jo diya (helm get values yahi dikhata hai)
      values: clone(coalesced) || {},
      userValues: clone(userVals) || {},
      history: [{ revision: 1, updated: stamp(), status: 'deployed',
                  chart: chart.name + '-' + chart.version, appVersion: chart.appVersion || '1.0.0',
                  description: 'Install complete',
                  values: clone(coalesced) || {}, userValues: clone(userVals) || {} }],
      notes: chart.notes || '',
    };
    (sim.cluster.releases = sim.cluster.releases || []).push(rel);
    return rel;
  }

  /* =====================================================================
     MAIN — terminal.js yahan bhejta hai. true = handled.
     ===================================================================== */
  return function helmExec(sim, toks, print) {
    sim.cluster.releases = sim.cluster.releases || [];
    sim.cluster.repos = sim.cluster.repos || [];
    // charts par apna ref yaad rakho (release -> chart wapas dhundhne ke liye)
    Object.keys(sim.cluster.charts || {}).forEach(k => { sim.cluster.charts[k]._ref = k; });

    const verb = toks[1];
    const rest = toks.slice(2);
    const f = parseFlags(rest, sim, print);
    if (f.bad) { print('err', f.bad); return true; }
    const a = f.args;

    if (!verb || verb === '--help' || verb === 'help') {
      print('sys', [
        'Helm commands (is mission mein):',
        '  helm repo add <name> <url> · helm repo list · helm repo update',
        '  helm search repo <term>',
        '  helm install <release> <chart> [-f values.yaml] [--set k=v] [--dry-run]',
        '  helm upgrade <release> <chart> [-f] [--set] [--atomic] [--install]',
        '  helm rollback <release> [revision] · helm history <release>',
        '  helm list · helm status <release> · helm uninstall <release>',
        '  helm get values|manifest|notes <release>',
        '  helm template <chart> [-f] · helm lint <chart> · helm show values <chart>',
        '  helm dependency list|update <chart> · helm test <release>',
        '  helm diff upgrade <release> <chart> [-f]   (plugin)',
        '  helm package <chart> · helm push <file> oci://... · helm version',
      ].join('\n'));
      return true;
    }

    /* ---------------- repo ---------------- */
    if (verb === 'repo') {
      const sub = a[0];
      if (sub === 'add') {
        const [, name, url] = a;
        if (!name || !url) { print('err', 'Error: "helm repo add" requires 2 arguments'); return true; }
        if (sim.cluster.repos.some(r => r.name === name)) { print('ok', `"${name}" already exists with the same configuration, skipping`); return true; }
        sim.cluster.repos.push({ name, url });
        print('ok', `"${name}" has been added to your repositories`);
        return true;
      }
      if (sub === 'list' || sub === 'ls') {
        if (!sim.cluster.repos.length) { print('err', 'Error: no repositories to show'); return true; }
        print('ok', table([['NAME', 'URL'], ...sim.cluster.repos.map(r => [r.name, r.url])]));
        return true;
      }
      if (sub === 'update' || sub === 'up') {
        if (!sim.cluster.repos.length) { print('err', 'Error: no repositories found. You must add one before updating'); return true; }
        print('ok', 'Hang tight while we grab the latest from your chart repositories...\n' +
          sim.cluster.repos.map(r => `...Successfully got an update from the "${r.name}" chart repository`).join('\n') +
          '\nUpdate Complete. ⎈Happy Helming!⎈');
        return true;
      }
      print('err', `Error: unknown command "helm repo ${sub || ''}"`);
      return true;
    }

    /* ---------------- search ---------------- */
    if (verb === 'search') {
      const term = (a[1] || '').toLowerCase();
      const idx = sim.cluster.searchIndex || [];
      if (!sim.cluster.repos.length) { print('err', 'Error: no repositories configured — pehle "helm repo add" karo'); return true; }
      const hits = idx.filter(c => !term || c.name.toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term));
      if (!hits.length) { print('ok', 'No results found'); return true; }
      print('ok', table([['NAME', 'CHART VERSION', 'APP VERSION', 'DESCRIPTION'],
        ...hits.map(c => [c.name, c.version, c.appVersion, c.description || ''])]));
      return true;
    }

    /* ---------------- list ---------------- */
    if (verb === 'list' || verb === 'ls') {
      const rels = sim.cluster.releases;
      if (!rels.length) { print('ok', 'NAME\tNAMESPACE\tREVISION\tUPDATED\tSTATUS\tCHART\tAPP VERSION\n(koi release nahi — "helm install" karo)'); return true; }
      print('ok', table([['NAME', 'NAMESPACE', 'REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION'],
        ...rels.map(r => [r.name, r.namespace, r.revision, r.updated, r.status, r.chart, r.appVersion])]));
      return true;
    }

    /* ---------------- install ---------------- */
    if (verb === 'install') {
      const [name, chartRef] = a;
      if (!name || !chartRef) { print('err', 'Error: must specify a release name and a chart\n(helm install <release> <chart>)'); return true; }
      if (findRelease(sim, name)) { print('err', `Error: INSTALLATION FAILED: cannot re-use a name that is still in use\n(chal raha hai — "helm upgrade ${name}" karo ya "helm uninstall ${name}")`); return true; }
      const chart = findChart(sim, chartRef);
      if (!chart) { print('err', `Error: failed to download "${chartRef}"\n(chart nahi mila — "ls" se local charts dekho, ya "helm repo add" + "helm search repo")`); return true; }
      if (chart.needsDeps && !chart._depsBuilt) {
        print('err', 'Error: An error occurred while checking for chart dependencies. You may need to run `helm dependency build` to fetch missing dependencies: found in Chart.yaml, but missing in charts/ directory: ' +
          (chart.deps || []).map(d => d.name).join(', '));
        return true;
      }
      const vals = mergedValues(chart, f.values);
      if (f.flags.has('dry-run')) {
        print('ok', `NAME: ${name}\nLAST DEPLOYED: ${stamp()}\nSTATUS: pending-install\nREVISION: 1\nHOOKS:\nMANIFEST:\n` +
          (chart.render ? chart.render(vals, { name, namespace: f.namespace }) : '(no templates)') +
          '\n\n(--dry-run: kuch install NAHI hua — sirf render karke dikhaya)');
        return true;
      }
      const rel = newRelease(sim, chart, name, f.values, vals, f.namespace);
      rel.lastFiles = f.files.slice();
      rel.lastSets = f.sets.slice();
      if (chart.onInstall) chart.onInstall(sim, rel);
      print('ok', `NAME: ${name}\nLAST DEPLOYED: ${rel.updated}\nNAMESPACE: ${rel.namespace}\nSTATUS: deployed\nREVISION: 1\n` +
        (rel.notes ? 'NOTES:\n' + rel.notes : ''));
      return true;
    }

    /* ---------------- upgrade ---------------- */
    if (verb === 'upgrade') {
      const [name, chartRef] = a;
      let rel = findRelease(sim, name);
      if (!rel) {
        if (f.flags.has('install')) {
          const chart = findChart(sim, chartRef);
          if (!chart) { print('err', `Error: failed to download "${chartRef}"`); return true; }
          const r = newRelease(sim, chart, name, f.values, mergedValues(chart, f.values), f.namespace);
          if (chart.onInstall) chart.onInstall(sim, r);
          print('ok', `Release "${name}" does not exist. Installing it now.\nNAME: ${name}\nSTATUS: deployed\nREVISION: 1`);
          return true;
        }
        print('err', `Error: UPGRADE FAILED: release: not found\n(--install flag se install-ya-upgrade dono ho jaate hain)`);
        return true;
      }
      if (rel.status === 'pending-upgrade' || rel.status === 'pending-install') {
        print('err', `Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress\n` +
          `(release "${name}" ${rel.status} mein atki hai — "helm history ${name}" dekho, phir "helm rollback ${name}" se nikaalo)`);
        return true;
      }
      const chart = findChart(sim, chartRef) || findChart(sim, rel.chartRef);
      if (!chart) { print('err', `Error: failed to download "${chartRef}"`); return true; }
      const prev = clone(rel);
      // --reuse-values = purani values base; default = chart defaults + naye -f/--set
      const reuse = f.flags.has('reuse-values');
      const userVals = reuse ? deepMerge(rel.userValues || {}, f.values) : f.values;
      const base = reuse ? rel.values : (chart.defaults || {});
      const vals = deepMerge(base, f.values);
      rel.values = vals;
      rel.userValues = clone(userVals);
      rel.revision += 1;
      rel.chart = chart.name + '-' + chart.version;
      rel.chartRef = chart._ref;
      rel.appVersion = chart.appVersion || rel.appVersion;
      rel.updated = stamp();
      rel.status = 'deployed';
      rel.lastFiles = f.files.slice();
      rel.lastSets = f.sets.slice();
      rel.history.push({ revision: rel.revision, updated: rel.updated, status: 'deployed',
        chart: rel.chart, appVersion: rel.appVersion,
        description: 'Upgrade complete' + (f.files.length ? ' (-f ' + f.files.join(' -f ') + ')' : '') +
          (f.sets.length ? ' (--set ' + f.sets.join(' --set ') + ')' : ''),
        values: clone(vals), userValues: clone(userVals) });
      let failed = false;
      if (chart.onUpgrade) failed = chart.onUpgrade(sim, rel, prev) === false;
      if (failed) {
        rel.status = f.flags.has('atomic') ? 'deployed' : 'failed';
        rel.history[rel.history.length - 1].status = 'failed';
        rel.history[rel.history.length - 1].description = 'Upgrade "' + name + '" failed';
        if (f.flags.has('atomic')) {
          // atomic = fail par khud rollback
          const target = rel.history[rel.history.length - 2];
          rel.revision += 1;
          rel.values = clone(target.values);
          rel.userValues = clone(target.userValues || {});
          rel.updated = stamp();
          rel.history.push({ revision: rel.revision, updated: rel.updated, status: 'deployed',
            chart: target.chart, appVersion: target.appVersion,
            description: 'Rollback to ' + target.revision + ' (--atomic)',
            values: clone(target.values), userValues: clone(target.userValues || {}) });
          if (chart.onRollback) chart.onRollback(sim, rel, target);
          print('err', `Error: UPGRADE FAILED: timed out waiting for the condition\n` +
            `(--atomic laga tha → automatic rollback ho gaya, revision ${rel.revision} = purana state ✓)`);
          return true;
        }
        print('err', `Error: UPGRADE FAILED: timed out waiting for the condition\n` +
          `(release ab "failed" hai — "helm rollback ${name}" se wapas jao. --atomic hota toh yeh khud ho jaata!)`);
        return true;
      }
      print('ok', `Release "${name}" has been upgraded. Happy Helming!\nNAME: ${name}\nSTATUS: deployed\nREVISION: ${rel.revision}`);
      return true;
    }

    /* ---------------- rollback ---------------- */
    if (verb === 'rollback') {
      const name = a[0];
      const rel = findRelease(sim, name);
      if (!rel) { print('err', 'Error: release: not found'); return true; }
      let target = a[1] ? rel.history.find(h => h.revision === parseInt(a[1], 10))
                        : [...rel.history].reverse().find(h => h.revision < rel.revision && h.status !== 'failed');
      if (!target) { print('err', `Error: release has no ${a[1] ? 'revision ' + a[1] : 'previous good revision'}`); return true; }
      rel.revision += 1;
      rel.values = clone(target.values);
      rel.userValues = clone(target.userValues || {});
      rel.chart = target.chart;
      rel.appVersion = target.appVersion;
      rel.status = 'deployed';
      rel.updated = stamp();
      rel.history.push({ revision: rel.revision, updated: rel.updated, status: 'deployed',
        chart: target.chart, appVersion: target.appVersion,
        description: 'Rollback to ' + target.revision,
        values: clone(target.values), userValues: clone(target.userValues || {}) });
      const chart = findChart(sim, rel.chartRef);
      if (chart && chart.onRollback) chart.onRollback(sim, rel, target);
      print('ok', `Rollback was a success! Happy Helming!\n(revision ${target.revision} ki values wapas lagi — naya revision ${rel.revision} bana; history kabhi delete nahi hoti)`);
      return true;
    }

    /* ---------------- history ---------------- */
    if (verb === 'history' || verb === 'hist') {
      const rel = findRelease(sim, a[0]);
      if (!rel) { print('err', 'Error: release: not found'); return true; }
      print('ok', table([['REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION', 'DESCRIPTION'],
        ...rel.history.map(h => [h.revision, h.updated, h.status, h.chart, h.appVersion, h.description])]));
      return true;
    }

    /* ---------------- status ---------------- */
    if (verb === 'status') {
      const rel = findRelease(sim, a[0]);
      if (!rel) { print('err', 'Error: release: not found'); return true; }
      print('ok', `NAME: ${rel.name}\nLAST DEPLOYED: ${rel.updated}\nNAMESPACE: ${rel.namespace}\n` +
        `STATUS: ${rel.status}\nREVISION: ${rel.revision}\n` + (rel.notes ? 'NOTES:\n' + rel.notes : ''));
      return true;
    }

    /* ---------------- uninstall ---------------- */
    if (verb === 'uninstall' || verb === 'delete' || verb === 'del') {
      const rel = findRelease(sim, a[0]);
      if (!rel) { print('err', `Error: uninstall: Release not loaded: ${a[0] || ''}`); return true; }
      sim.cluster.releases = sim.cluster.releases.filter(r => r !== rel);
      const chart = findChart(sim, rel.chartRef);
      if (chart && chart.onUninstall) chart.onUninstall(sim, rel);
      print('ok', `release "${rel.name}" uninstalled` +
        (f.flags.has('keep-history') ? '' : '\n(history bhi gayi — "--keep-history" se bachti hai)'));
      return true;
    }

    /* ---------------- get ---------------- */
    if (verb === 'get') {
      const what = a[0];
      const rel = findRelease(sim, a[1]);
      if (!rel) { print('err', 'Error: release: not found'); return true; }
      const hist = f.revision ? rel.history.find(h => h.revision === f.revision) : null;
      const coalesced = hist ? hist.values : rel.values;
      const userVals = hist ? (hist.userValues || {}) : (rel.userValues || {});
      if (what === 'values') {
        if (f.flags.has('all')) {
          print('ok', 'COMPUTED VALUES:\n' + toYaml(coalesced) +
            '\n\n(chart defaults + tumhari values — yahi render mein use hoti hain)');
          return true;
        }
        print('ok', 'USER-SUPPLIED VALUES:\n' + (Object.keys(userVals).length ? toYaml(userVals) : 'null') +
          '\n\n(sirf tumhari di hui values — chart defaults ke saath dekhne ke liye: helm get values ' + rel.name + ' --all)');
        return true;
      }
      if (what === 'manifest') {
        const chart = findChart(sim, rel.chartRef);
        print('ok', chart && chart.render ? chart.render(coalesced, rel) : '(manifest is mission mein available nahi)');
        return true;
      }
      if (what === 'notes') { print('ok', rel.notes || '(no notes)'); return true; }
      if (what === 'all') { print('ok', `NAME: ${rel.name}\nREVISION: ${rel.revision}\nUSER-SUPPLIED VALUES:\n${toYaml(userVals)}\nCOMPUTED VALUES:\n${toYaml(coalesced)}`); return true; }
      print('err', 'Error: helm get [values|manifest|notes|all] <release>');
      return true;
    }

    /* ---------------- template / lint / show ---------------- */
    if (verb === 'template') {
      const chart = findChart(sim, a[0] || a[1]);
      if (!chart) { print('err', `Error: failed to download "${a[0] || ''}"`); return true; }
      const vals = mergedValues(chart, f.values);
      print('ok', chart.render ? chart.render(vals, { name: a[0] && a[1] ? a[0] : 'release-name', namespace: f.namespace })
        : '(is chart ka render is mission mein define nahi)');
      return true;
    }
    if (verb === 'lint') {
      const chart = findChart(sim, a[0]);
      if (!chart) { print('err', `Error: failed to download "${a[0] || ''}"`); return true; }
      print(chart.lintFailed ? 'err' : 'ok', (chart.lint || ['==> Linting ' + a[0], '', '1 chart(s) linted, 0 chart(s) failed']).join('\n'));
      return true;
    }
    if (verb === 'show' || verb === 'inspect') {
      const chart = findChart(sim, a[1]);
      if (!chart) { print('err', `Error: failed to download "${a[1] || ''}"`); return true; }
      if (a[0] === 'values') { print('ok', chart.valuesYaml || toYaml(chart.defaults || {})); return true; }
      if (a[0] === 'chart') {
        print('ok', `apiVersion: v2\nname: ${chart.name}\nversion: ${chart.version}\nappVersion: "${chart.appVersion}"` +
          (chart.deps && chart.deps.length ? '\ndependencies:\n' + chart.deps.map(d => `  - name: ${d.name}\n    version: ${d.version}\n    repository: ${d.repository}` + (d.condition ? `\n    condition: ${d.condition}` : '')).join('\n') : ''));
        return true;
      }
      print('err', 'Error: helm show [values|chart] <chart>');
      return true;
    }

    /* ---------------- dependency ---------------- */
    if (verb === 'dependency' || verb === 'dep') {
      const sub = a[0];
      const chart = findChart(sim, a[1]);
      if (!chart) { print('err', `Error: chart "${a[1] || ''}" nahi mila`); return true; }
      if (sub === 'list' || sub === 'ls') {
        if (!(chart.deps || []).length) { print('ok', 'WARNING: no dependencies at ' + a[1] + '/charts'); return true; }
        print('ok', table([['NAME', 'VERSION', 'REPOSITORY', 'STATUS'],
          ...chart.deps.map(d => [d.name, d.version, d.repository, chart._depsBuilt ? 'ok' : 'missing'])]));
        return true;
      }
      if (sub === 'update' || sub === 'up' || sub === 'build') {
        chart._depsBuilt = true;
        print('ok', 'Hang tight while we grab the latest from your chart repositories...\n' +
          'Update Complete. ⎈Happy Helming!⎈\n' +
          (chart.deps || []).map(d => `Saving 1 charts\nDownloading ${d.name} from repo ${d.repository}`).join('\n') +
          '\nDeleting outdated charts\n(charts/ mein .tgz aa gaye + Chart.lock update hui ✓)');
        return true;
      }
      print('err', 'Error: helm dependency [list|update] <chart>');
      return true;
    }

    /* ---------------- test ---------------- */
    if (verb === 'test') {
      const rel = findRelease(sim, a[0]);
      if (!rel) { print('err', 'Error: release: not found'); return true; }
      const chart = findChart(sim, rel.chartRef);
      print(chart && chart.testFailed ? 'err' : 'ok',
        (chart && chart.testOut) || `NAME: ${rel.name}\nLAST DEPLOYED: ${rel.updated}\nSTATUS: deployed\nTEST SUITE: ${rel.name}-test-connection\nPhase: Succeeded`);
      return true;
    }

    /* ---------------- diff (plugin) ---------------- */
    if (verb === 'diff') {
      const rel = findRelease(sim, a[1]);
      if (!rel) { print('err', 'Error: release: not found'); return true; }
      const chart = findChart(sim, a[2]) || findChart(sim, rel.chartRef);
      const next = deepMerge(chart ? (chart.defaults || {}) : {}, f.values);
      const before = toYaml(rel.values).split('\n');
      const after = toYaml(next).split('\n');
      const out = ['default, ' + rel.name + ', Deployment (apps) has changed:'];
      before.forEach(l => { if (!after.includes(l)) out.push('- ' + l); });
      after.forEach(l => { if (!before.includes(l)) out.push('+ ' + l); });
      print('ok', out.length === 1 ? '(koi farak nahi — values same hain)' : out.join('\n'));
      return true;
    }

    /* ---------------- package / push / version ---------------- */
    if (verb === 'package') {
      const chart = findChart(sim, a[0]);
      if (!chart) { print('err', `Error: chart "${a[0] || ''}" nahi mila`); return true; }
      sim.cluster.packages = sim.cluster.packages || [];
      const tgz = `${chart.name}-${chart.version}.tgz`;
      if (!sim.cluster.packages.includes(tgz)) sim.cluster.packages.push(tgz);
      print('ok', `Successfully packaged chart and saved it to: /home/shishya/${tgz}`);
      return true;
    }
    if (verb === 'push') {
      const [tgz, dest] = a;
      if (!(sim.cluster.packages || []).includes(tgz)) {
        print('err', `Error: open ${tgz || '<file>'}: no such file or directory\n(pehle "helm package <chart>" karo)`);
        return true;
      }
      if (!dest || !dest.startsWith('oci://')) { print('err', 'Error: helm push <chart.tgz> oci://<registry>/<repo>'); return true; }
      sim.cluster.pushed = sim.cluster.pushed || [];
      sim.cluster.pushed.push({ tgz, dest });
      print('ok', `Pushed: ${dest.replace('oci://', '')}/${tgz.replace(/-[\d.]+\.tgz$/, '')}:${(tgz.match(/-([\d.]+)\.tgz$/) || [, '0.1.0'])[1]}\nDigest: sha256:${'a1b2c3d4'.repeat(8).slice(0, 64)}`);
      return true;
    }
    if (verb === 'version') { print('ok', 'version.BuildInfo{Version:"v3.15.2", GoVersion:"go1.22.4"}'); return true; }

    print('err', `Error: unknown command "${verb}" for "helm"\n('helm help' se list dekho)`);
    return true;
  };
})();
