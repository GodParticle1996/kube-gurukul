/* =====================================================================
   KubeGurukul — Karpenter Simulator (AWS/EKS flavoured)
   Yeh ek CONTROLLER hai — har command ke baad reconcile hota hai,
   bilkul asli Karpenter ki tarah:
     Pending pod  →  NodeClaim banao  →  EC2 launch  →  Node Ready  →  pod schedule
     Underutilized nodes  →  consolidation  →  node disrupt

   Mission cluster mein (data-karpenter.js dekho):
     nodepools: [ {
       name, status:'Ready',
       requirements: [ { key, operator, values } ],       // instance-category, capacity-type…
       nodeClassRef: 'default',
       limits: { cpu: 100 },  used: { cpu: 0 },
       disruption: { consolidationPolicy: 'WhenEmptyOrUnderutilized',
                     consolidateAfter: '1m', budgets: [ { nodes: '10%' } ] },
       expireAfter: '720h',
       taints: [], weight: 10,
     } ]
     ec2nodeclasses: [ { name, amiFamily, role, subnetSelector, sgSelector, drifted } ]
     nodeclaims: [ ... ]   // aksar khaali — controller khud banata hai
     karpenter: { enabled: true, tick: 0, log: [] }
   ===================================================================== */

KG.karpenter = (function () {

  const TYPES = [
    { name: 'c6a.large',    cpu: 2,  mem: 4,   cat: 'c', gen: 6, arch: 'amd64', spot: 0.0289, od: 0.0765 },
    { name: 'c6a.xlarge',   cpu: 4,  mem: 8,   cat: 'c', gen: 6, arch: 'amd64', spot: 0.0578, od: 0.1530 },
    { name: 'c6a.2xlarge',  cpu: 8,  mem: 16,  cat: 'c', gen: 6, arch: 'amd64', spot: 0.1156, od: 0.3060 },
    { name: 'm6a.large',    cpu: 2,  mem: 8,   cat: 'm', gen: 6, arch: 'amd64', spot: 0.0324, od: 0.0864 },
    { name: 'm6a.xlarge',   cpu: 4,  mem: 16,  cat: 'm', gen: 6, arch: 'amd64', spot: 0.0648, od: 0.1728 },
    { name: 'm6a.2xlarge',  cpu: 8,  mem: 32,  cat: 'm', gen: 6, arch: 'amd64', spot: 0.1296, od: 0.3456 },
    { name: 'r6a.xlarge',   cpu: 4,  mem: 32,  cat: 'r', gen: 6, arch: 'amd64', spot: 0.0900, od: 0.2268 },
    { name: 'm7g.xlarge',   cpu: 4,  mem: 16,  cat: 'm', gen: 7, arch: 'arm64', spot: 0.0510, od: 0.1632 },
    { name: 'g5.xlarge',    cpu: 4,  mem: 16,  gpu: 1, cat: 'g', gen: 5, arch: 'amd64', spot: 0.30, od: 1.006 },
    { name: 'g5.2xlarge',   cpu: 8,  mem: 32,  gpu: 1, cat: 'g', gen: 5, arch: 'amd64', spot: 0.36, od: 1.212 },
  ].map(t => Object.assign({ gpu: 0 }, t));
  // Teaching fixtures, not live EC2 quotes. DaemonSets consume this much in these missions.
  const OVERHEAD = { cpu: 0.2, mem: 240 / 1024 };

  function parseCpu(v) {
    if (v == null) return 0;
    const s = String(v);
    return s.endsWith('m') ? parseInt(s, 10) / 1000 : parseFloat(s);
  }
  function parseMem(v) {
    if (v == null) return 0;
    const s = String(v);
    if (s.endsWith('Gi')) return parseFloat(s);
    if (s.endsWith('Mi')) return parseFloat(s) / 1024;
    return parseFloat(s) || 0;
  }
  function log(sim, msg) {
    const k = sim.cluster.karpenter;
    k.log = k.log || [];
    k.log.push(msg);
    (sim.cluster.events = sim.cluster.events || []).push(msg);
  }

  /* pod ki demand (requests) nikalo */
  function demand(p) {
    const r = (p.requests) || {};
    return { cpu: r.cpu == null ? 0.5 : parseCpu(r.cpu), mem: r.memory == null ? 1 : parseMem(r.memory),
      gpu: parseInt(r['nvidia.com/gpu'], 10) || 0 };
  }

  function labels(t) {
    return {
      'karpenter.k8s.aws/instance-category': t.cat,
      'karpenter.k8s.aws/instance-generation': String(t.gen),
      'karpenter.k8s.aws/instance-family': t.name.split('.')[0],
      'karpenter.k8s.aws/instance-size': t.name.split('.')[1],
      'karpenter.k8s.aws/instance-cpu': String(t.cpu),
      'karpenter.k8s.aws/instance-gpu-count': String(t.gpu),
      'karpenter.k8s.aws/instance-gpu-manufacturer': t.gpu ? 'nvidia' : undefined,
      'node.kubernetes.io/instance-type': t.name, 'kubernetes.io/arch': t.arch,
      'kubernetes.io/os': 'linux',
    };
  }
  function matches(value, req) {
    const vals = (req.values || []).map(String), exists = value !== undefined;
    switch (req.operator || 'In') {
      case 'In': return exists && vals.includes(String(value));
      case 'NotIn': return !exists || !vals.includes(String(value));
      case 'Gt': return exists && vals.length === 1 && Number(value) > Number(vals[0]);
      case 'Lt': return exists && vals.length === 1 && Number(value) < Number(vals[0]);
      case 'Exists': return exists;
      case 'DoesNotExist': return !exists;
      default: return false;
    }
  }
  function selectors(pod) {
    return Object.entries(pod.nodeSelector || {}).map(([key, value]) => ({ key, operator: 'In', values: [value] }));
  }
  /* Well-known instance labels; other NodePool requirements describe custom node labels. */
  function allowedTypes(np, pod) {
    const reqs = (np.requirements || []).concat(selectors(pod || {}));
    return TYPES.filter(t => {
      const ls = labels(t);
      return reqs.every(r => !Object.prototype.hasOwnProperty.call(ls, r.key) || matches(ls[r.key], r));
    }).sort((a, b) => a.gpu - b.gpu || a.cpu - b.cpu || a.mem - b.mem);
  }
  function capacityType(np, pod) {
    const reqs = (np.requirements || []).concat(selectors(pod || {}))
      .filter(r => r.key === 'karpenter.sh/capacity-type');
    if (!reqs.length) return 'on-demand';
    return ['spot', 'on-demand'].find(cap => reqs.every(r => matches(cap, r))) || null;
  }

  /* pod NodePool ke taints tolerate karta hai? */
  function tolerates(pod, np) {
    const taints = (np && np.taints) || [];
    if (!taints.length) return true;
    const tols = pod.tolerations || [];
    return taints.every(t => t.effect === 'PreferNoSchedule' || tols.some(tol =>
      (!tol.effect || tol.effect === t.effect) &&
      ((tol.operator === 'Exists' && (!tol.key || tol.key === t.key)) ||
      ((!tol.operator || tol.operator === 'Equal') && tol.key === t.key && (tol.value || '') === (t.value || '')))));
  }
  function poolOf(sim, node) {
    return (sim.cluster.nodepools || []).find(np => np.name === node.nodepool) || null;
  }
  /* node ki capacity ka hisaab: kaunse pod ne kitna liya (kubectl delete ke baad wapas milta hai) */
  function acct(node, pod, d) { (node._acct = node._acct || {})[pod.name] = d; }
  function fits(node, d) {
    return (node.cpu - (node.usedCpu || 0)) >= d.cpu && (node.mem - (node.usedMem || 0)) >= d.mem &&
      ((node.gpu || 0) - (node.usedGpu || 0)) >= d.gpu;
  }
  function accepts(sim, node, pod) {
    const np = poolOf(sim, node);
    const t = TYPES.find(t => t.name === node.instanceType);
    const ls = Object.assign({}, t ? labels(t) : {}, np && np.labels, node.labels,
      { 'karpenter.sh/nodepool': node.nodepool, 'karpenter.sh/capacity-type': node.capacityType });
    return tolerates(pod, np) && selectors(pod).every(r => matches(ls[r.key], r));
  }
  function scheduled(sim, pod, node) {
    pod.status = 'Running'; pod.ready = '1/1'; pod.node = node.name;
    pod.ip = '10.244.' + sim.cluster.nodes.length + '.' + (10 + Math.floor(Math.random() * 40));
    pod.runningAt = (sim.history || []).length;
    delete pod.waitingFor; delete pod.unschedulable;
    const base = pod._baseDescribe === undefined ? (pod.describe || '') : pod._baseDescribe;
    pod.describe = base.replace(/Status:\s*Pending/, 'Status:    Running') +
      '\n\nEvents (latest):\n  Normal  Scheduled  default-scheduler  Successfully assigned ' +
      (pod.namespace || 'default') + '/' + pod.name + ' to ' + node.name;
    const d = demand(pod);
    node.usedCpu = (node.usedCpu || 0) + d.cpu; node.usedMem = (node.usedMem || 0) + d.mem;
    node.usedGpu = (node.usedGpu || 0) + d.gpu; acct(node, pod, d);
    delete node.candidateSince;
    log(sim, `Normal  Scheduled  default-scheduler  Successfully assigned ${pod.namespace || 'default'}/${pod.name} to ${node.name}`);
  }
  function releaseNode(sim, node) {
    // node gaya → NodePool ka "used" bhi kam (warna limit jhooth-mooth bhar jaati)
    const np = poolOf(sim, node);
    if (np && np.used) {
      np.used.cpu = Math.max(0, parseCpu(np.used.cpu) - (node.cpu || 0));
      if (np.used.memory != null) np.used.memory = Math.max(0, parseMem(np.used.memory) - (node.mem || 0)) + 'Gi';
    }
    sim.cluster.nodes = sim.cluster.nodes.filter(x => x !== node);
    sim.cluster.nodeclaims = sim.cluster.nodeclaims.filter(nc => nc.nodeName !== node.name);
  }

  /* ---------------------------------------------------------------
     RECONCILE — har terminal command ke baad chalta hai
     --------------------------------------------------------------- */
  function reconcile(sim) {
    const k = sim.cluster.karpenter;
    if (!k || !k.enabled) return;
    k.tick = (k.tick || 0) + 1;
    sim.cluster.nodeclaims = sim.cluster.nodeclaims || [];
    sim.cluster.nodes = sim.cluster.nodes || [];
    sim.cluster.pods = sim.cluster.pods || [];
    (sim.cluster.nodepools || []).forEach(pool => {
      const provisioned = sim.cluster.nodes.filter(n => n.nodepool === pool.name)
        .concat(sim.cluster.nodeclaims.filter(n => n.nodepool === pool.name && n.ready !== 'True'));
      pool.used = pool.used || {};
      if (pool.used.cpu == null) pool.used.cpu = provisioned.reduce((sum, n) => sum + (n.cpu || 0), 0);
      if (pool.used.memory == null) pool.used.memory = provisioned.reduce((sum, n) => sum + (n.mem || 0), 0) + 'Gi';
    });

    /* 0) bookkeeping: jo pods node se chale gaye (kubectl delete pod), unki capacity wapas.
       Pehli baar dekhe gaye pods ka usage pehle se node.usedCpu mein maana jaata hai. */
    sim.cluster.nodes.filter(n => n.karpenter).forEach(n => {
      const here = sim.cluster.pods.filter(p => p.node === n.name);
      if (n.gpu == null) n.gpu = (TYPES.find(t => t.name === n.instanceType) || {}).gpu || 0;
      if (n.usedGpu == null) n.usedGpu = here.reduce((sum, p) => sum + demand(p).gpu, 0);
      if (!n._acct) { n._acct = {}; here.forEach(p => { n._acct[p.name] = demand(p); }); return; }
      Object.keys(n._acct).forEach(name => {
        if (here.some(p => p.name === name)) return;
        const d = n._acct[name];
        n.usedCpu = Math.max(0, (n.usedCpu || 0) - d.cpu);
        n.usedMem = Math.max(0, (n.usedMem || 0) - d.mem);
        n.usedGpu = Math.max(0, (n.usedGpu || 0) - d.gpu);
        delete n.candidateSince;
        delete n._acct[name];
      });
    });

    /* 1) launching NodeClaims → Ready nodes (agla tick) */
    sim.cluster.nodeclaims.filter(nc => nc.ready === 'Unknown').forEach(nc => {
      if (k.tick >= (nc.bornTick || 0) + (k.launchTicks == null ? 1 : k.launchTicks)) {
        nc.ready = 'True';
        nc.age = '10s';
        sim.cluster.nodes.push({
          name: nc.nodeName, status: 'Ready', roles: '<none>', age: '5s', version: 'v1.30.2',
          instanceType: nc.type, capacityType: nc.capacity, zone: nc.zone,
          nodepool: nc.nodepool, cpu: nc.cpu, mem: nc.mem, gpu: nc.gpu || 0,
          usedCpu: OVERHEAD.cpu, usedMem: OVERHEAD.mem, usedGpu: 0,
          karpenter: true, top: '5% 12%',
        });
        log(sim, `Normal  Ready  ${nc.nodeName}  Node became ready (${nc.type}, ${nc.capacity})`);
        // is NodeClaim ka intezaar kar rahe pods ab schedule ho jaate hain
        sim.cluster.pods.filter(p => p.status === 'Pending' && p.waitingFor === nc.name).forEach(p => {
          const node = sim.cluster.nodes.find(n => n.name === nc.nodeName);
          if (node && accepts(sim, node, p) && fits(node, demand(p))) scheduled(sim, p, node);
          else delete p.waitingFor; // Pod constraints may have changed while EC2 was launching.
        });
      }
    });

    /* 2) Pending pods → naya NodeClaim
       Asli Karpenter har loop mein pending pods ko DOBARA dekhta hai — isliye
       "unschedulable" permanent nahi hai. Cause fix hote hi (kisi bhi order mein)
       agla reconcile usse schedule kar dega. */
    const pending = sim.cluster.pods.filter(p => p.status === 'Pending' && !p.waitingFor);
    pending.forEach(p => {
      if (p._baseDescribe === undefined) p._baseDescribe = p.describe || '';
      p.unschedulable = false;
      const fail = reason => {
        p.unschedulable = true;
        p.describe = p._baseDescribe + '\n\nEvents (latest):\n  Warning  FailedScheduling  karpenter  Failed to schedule pod, ' + reason;
        log(sim, `Warning  FailedScheduling  karpenter  Failed to schedule pod, ${reason}`);
      };
      const d = demand(p);
      // pehle: kya kisi maujooda node par fit ho jaata hai? (us node ke NodePool ke taints bhi tolerate hone chahiye)
      const fit = sim.cluster.nodes.find(n => n.karpenter && (!n.status || n.status === 'Ready') && !n.drifted && accepts(sim, n, p) && fits(n, d));
      if (fit) {
        scheduled(sim, p, fit);
        return;
      }
      // NodePool dhundo jo isse le sake
      const pools = (sim.cluster.nodepools || []).slice()
        .sort((a, b) => (b.weight || 0) - (a.weight || 0));
      if (!pools.length) {
        fail('no NodePool available');
        return;
      }
      const reasons = [];
      let np, chosen, cap;
      for (const pool of pools) {
        if (!tolerates(p, pool)) {
          const taint = (pool.taints || []).find(t => !tolerates(p, { taints: [t] }));
          reasons.push(`incompatible with nodepool "${pool.name}", did not tolerate ${taint.key}=${taint.value || ''}:${taint.effect}`);
          continue;
        }
        const types = allowedTypes(pool, p).filter(t => t.cpu >= d.cpu + OVERHEAD.cpu &&
          t.mem >= d.mem + OVERHEAD.mem && t.gpu >= d.gpu);
        const capacity = capacityType(pool, p);
        const customSelectorMismatch = selectors(p).some(r => {
          if (Object.prototype.hasOwnProperty.call(labels(TYPES[0]), r.key) || r.key === 'karpenter.sh/capacity-type') return false;
          return !matches(r.key === 'karpenter.sh/nodepool' ? pool.name : (pool.labels || {})[r.key], r);
        });
        if (!types.length || !capacity || customSelectorMismatch) {
          const resources = { cpu: String(d.cpu), memory: d.mem + 'Gi' };
          if (d.gpu) resources['nvidia.com/gpu'] = String(d.gpu);
          resources.pods = '1';
          const reqs = (pool.requirements || []).concat(selectors(p)).map(r =>
            `${r.key} ${r.operator || 'In'} [${(r.values || []).join(', ')}]`).join(', ');
          reasons.push(`incompatible with nodepool "${pool.name}", daemonset overhead={"cpu":"200m","memory":"240Mi","pods":"5"}, no instance type satisfied resources ${JSON.stringify(resources)} and requirements ${reqs || '<none>'} (no instance type has enough resources or compatible requirements)`);
          continue;
        }
        const used = pool.used || {}, limits = pool.limits || {};
        const type = types.find(t => (limits.cpu == null || parseCpu(used.cpu || 0) + t.cpu <= parseCpu(limits.cpu)) &&
          (limits.memory == null || parseMem(used.memory || 0) + t.mem <= parseMem(limits.memory)));
        if (!type) {
          reasons.push(`all available instance types exceed limits for nodepool: "${pool.name}"`);
          continue;
        }
        np = pool; chosen = type; cap = capacity; break;
      }
      if (!np) { fail(reasons.join('; ')); return; }
      const zone = ['ap-south-1a', 'ap-south-1b', 'ap-south-1c'][sim.cluster.nodeclaims.length % 3];
      const id = Math.random().toString(36).slice(2, 7);
      let nodeIndex = k.nextNodeIndex == null ? 20 + sim.cluster.nodeclaims.length : k.nextNodeIndex;
      const nameOf = i => `ip-10-0-${i}-4.ap-south-1.compute.internal`;
      while (sim.cluster.nodes.some(n => n.name === nameOf(nodeIndex)) || sim.cluster.nodeclaims.some(n => n.nodeName === nameOf(nodeIndex))) nodeIndex++;
      k.nextNodeIndex = nodeIndex + 1;
      const nc = {
        name: `${np.name}-${id}`, nodeName: nameOf(nodeIndex),
        type: chosen.name, capacity: cap, zone, nodepool: np.name,
        cpu: chosen.cpu, mem: chosen.mem, gpu: chosen.gpu, nodeClassRef: np.nodeClassRef || 'default', ready: 'Unknown', age: '0s',
        price: cap === 'spot' ? chosen.spot : chosen.od,
        bornTick: k.tick,
      };
      sim.cluster.nodeclaims.push(nc);
      np.used = np.used || { cpu: 0 };
      np.used.cpu = parseCpu(np.used.cpu || 0) + chosen.cpu;
      np.used.memory = parseMem(np.used.memory || 0) + chosen.mem + 'Gi';
      p.waitingFor = nc.name;
      p.describe = p._baseDescribe + '\n\nEvents (latest):\n  Normal  Nominated  karpenter  Pod should schedule on: nodeclaim/' + nc.name;
      log(sim, `Normal  Nominated  karpenter  Pod should schedule on: nodeclaim/${nc.name}`);
      log(sim, `Normal  Launched    ${nc.name}  Launched ${cap} ${chosen.name} in ${zone} ($${nc.price}/hr)`);
    });

    /* 3) Consolidation — khaali ya kam bhare nodes hatao (har node apne NodePool ki policy maanta hai) */
    if (k.consolidate !== false) {
      sim.cluster.nodes.filter(n => n.karpenter).forEach(n => {
        if (!sim.cluster.nodes.includes(n)) return;          // is loop mein pehle hi hat chuka
        const pool = poolOf(sim, n) || (sim.cluster.nodepools || [])[0];
        const cpol = pool && pool.disruption && pool.disruption.consolidationPolicy;
        // asli Karpenter v1: consolidation band karne ka tarika = consolidateAfter: Never
        if (!cpol || pool.disruption.consolidateAfter === 'Never') return;
        const podsOn = sim.cluster.pods.filter(p => p.node === n.name);
        const blocked = podsOn.some(p => p.doNotDisrupt);
        const empty = podsOn.length === 0;
        const under = !empty && (n.usedCpu / n.cpu) < 0.4 && podsOn.length <= 2;
        const candidate = (empty && (cpol === 'WhenEmpty' || cpol === 'WhenEmptyOrUnderutilized')) ||
          (under && cpol === 'WhenEmptyOrUnderutilized');
        const fingerprint = podsOn.map(p => p.name).sort().join(',');
        if (!candidate) { delete n.candidateSince; delete n._candidatePods; return; }
        if (n.candidateSince == null || n._candidatePods !== fingerprint) {
          n.candidateSince = k.tick; n._candidatePods = fingerprint;
        }
        if (k.tick - n.candidateSince < (k.consolidateTicks || 0)) return;
        if (empty && (cpol === 'WhenEmpty' || cpol === 'WhenEmptyOrUnderutilized')) {
          if (blocked) return;
          releaseNode(sim, n);
          log(sim, `Normal  DisruptionTerminating  ${n.name}  Disrupting node via consolidation: EMPTY (paisa bach gaya 💰)`);
        } else if (under && cpol === 'WhenEmptyOrUnderutilized') {
          if (blocked) {
            log(sim, `Normal  DisruptionBlocked  ${n.name}  Cannot disrupt — pod has karpenter.sh/do-not-disrupt annotation`);
            return;
          }
          // pods ko doosre node par shift karo agar jagah ho (aur us node ke taints tolerate hon)
          const total = podsOn.reduce((sum, p) => {
            const d = demand(p); sum.cpu += d.cpu; sum.mem += d.mem; sum.gpu += d.gpu; return sum;
          }, { cpu: 0, mem: 0, gpu: 0 });
          const target = sim.cluster.nodes.find(o => o !== n && o.karpenter && (!o.status || o.status === 'Ready') && !o.drifted &&
            podsOn.every(p => accepts(sim, o, p)) && fits(o, total));
          if (!target) return;
          podsOn.forEach(p => {
            scheduled(sim, p, target);
            p.disruptions = (p.disruptions || 0) + 1;
            if (p.name.startsWith('spark')) p.logs = '[spark] job restarted from partition 0\n[spark] consolidation ne purana pod replace kiya; checkpoint ke bina progress kho gayi.';
          });
          releaseNode(sim, n);
          log(sim, `Normal  DisruptionTerminating  ${n.name}  Disrupting via consolidation: UNDERUTILIZED — pods ${target.name} par shift hue 💰`);
        }
      });
    }

    /* 4) Drift — EC2NodeClass badla toh nodes drifted */
    (sim.cluster.ec2nodeclasses || []).forEach(nc => {
      if (nc.drifted) {
        sim.cluster.nodes.filter(n => n.karpenter && !n.drifted && ((poolOf(sim, n) || {}).nodeClassRef || 'default') === nc.name).forEach(n => {
          n.drifted = true;
          log(sim, `Normal  Drifted  ${n.name}  Node drifted: EC2NodeClass "${nc.name}" badal gaya (naya AMI) — Karpenter isse replace karega`);
        });
      }
    });
  }

  /* ---------------------------------------------------------------
     Tables — kubectl get nodepools / nodeclaims / ec2nodeclasses
     --------------------------------------------------------------- */
  function tables(sim, wide) {
    // columns = asli Karpenter v1 CRDs ke additionalPrinterColumns (wide = priority 1 wale bhi)
    const nodesOf = np => (sim.cluster.nodes || []).filter(n => n.karpenter && (n.nodepool || 'default') === np.name);
    return {
      nodepools: {
        cols: ['NAME', 'NODECLASS', 'NODES', 'READY', 'AGE'].concat(wide ? ['WEIGHT', 'CPU', 'MEMORY'] : []),
        rows: (sim.cluster.nodepools || []).map(np => {
          const ns = nodesOf(np);
          const r = [np.name, np.nodeClassRef || 'default', ns.length, np.ready || 'True', np.age || '30d'];
          if (wide) r.push(np.weight != null ? np.weight : '', ns.reduce((a, n) => a + (n.cpu || 0), 0),
            ns.reduce((a, n) => a + (n.mem || 0), 0) + 'Gi');
          return r;
        }),
      },
      nodeclaims: {
        cols: ['NAME', 'TYPE', 'CAPACITY', 'ZONE', 'NODE', 'READY', 'AGE'].concat(wide ? ['NODEPOOL', 'NODECLASS'] : []),
        rows: (sim.cluster.nodeclaims || []).map(nc => {
          const r = [nc.name, nc.type, nc.capacity, nc.zone, nc.ready === 'True' ? (nc.nodeName || '').split('.')[0] : '', nc.ready, nc.age || '0s'];
          if (wide) r.push(nc.nodepool || 'default', nc.nodeClassRef || ((sim.cluster.nodepools || []).find(p => p.name === nc.nodepool) || {}).nodeClassRef || 'default');
          return r;
        }),
      },
      ec2nodeclasses: {
        cols: ['NAME', 'READY', 'AGE'].concat(wide ? ['ROLE'] : []),
        rows: (sim.cluster.ec2nodeclasses || []).map(c => {
          const r = [c.name, c.ready || 'True', c.age || '30d'];
          if (wide) r.push(c.role || 'KarpenterNodeRole');
          return r;
        }),
      },
    };
  }

  /* kubectl get <karpenter-kind> <name> -o yaml — CRs ki keys alphabetical aati hain (asli jaisa) */
  function toYaml(sim, kind, o) {
    const list = vs => (vs || []).map(v => `        - ${JSON.stringify(v)}`).join('\n');
    if (kind === 'nodepools') {
      const d = o.disruption || {};
      const ns = (sim.cluster.nodes || []).filter(n => n.karpenter && (n.nodepool || 'default') === o.name);
      return [
        'apiVersion: karpenter.sh/v1', 'kind: NodePool', 'metadata:', `  name: ${o.name}`, 'spec:',
        '  disruption:',
        '    budgets:', ...((d.budgets && d.budgets.length ? d.budgets : [{ nodes: '10%' }]).map(b =>
          `    - nodes: "${b.nodes}"` + (b.schedule ? `\n      schedule: "${b.schedule}"\n      duration: ${b.duration}` : ''))),
        `    consolidateAfter: ${d.consolidateAfter || '0s'}`,
        ...(d.consolidationPolicy ? [`    consolidationPolicy: ${d.consolidationPolicy}`] : []),
        ...(o.limits ? ['  limits:', ...Object.entries(o.limits).map(([k, v]) => `    ${k}: "${v}"`)] : []),
        '  template:', '    spec:', `      expireAfter: ${o.expireAfter || '720h'}`,
        '      nodeClassRef:', '        group: karpenter.k8s.aws', '        kind: EC2NodeClass', `        name: ${o.nodeClassRef || 'default'}`,
        '      requirements:', ...(o.requirements || []).map(r => `      - key: ${r.key}\n        operator: ${r.operator}` +
          ((r.values || []).length ? `\n        values:\n${list(r.values)}` : '')),
        ...((o.taints || []).length ? ['      taints:', ...o.taints.map(t => `      - effect: ${t.effect}\n        key: ${t.key}` + (t.value ? `\n        value: "${t.value}"` : ''))] : []),
        ...(o.weight != null ? [`  weight: ${o.weight}`] : []),
        'status:', '  resources:', `    cpu: "${ns.reduce((a, n) => a + (n.cpu || 0), 0)}"`,
        `    memory: ${ns.reduce((a, n) => a + (n.mem || 0), 0)}Gi`, `    nodes: "${ns.length}"`,
      ].join('\n');
    }
    if (kind === 'ec2nodeclasses') {
      return ['apiVersion: karpenter.k8s.aws/v1', 'kind: EC2NodeClass', 'metadata:', `  name: ${o.name}`, 'spec:',
        '  amiSelectorTerms:', ...(o.amiSelectorTerms || [{ alias: (o.amiFamily || 'AL2023').toLowerCase() + '@latest' }]).map(term =>
          '  - ' + Object.entries(term).map(([k, v]) => k + ': ' + JSON.stringify(v)).join('\n    ')),
        `  role: ${o.role || 'KarpenterNodeRole'}`,
        '  securityGroupSelectorTerms:', '  - tags:', '      karpenter.sh/discovery: prod',
        '  subnetSelectorTerms:', '  - tags:', '      karpenter.sh/discovery: prod',
        'status:', '  conditions:', `  - status: "${o.ready || 'True'}"`, '    type: Ready'].join('\n');
    }
    if (kind === 'nodeclaims') {
      return ['apiVersion: karpenter.sh/v1', 'kind: NodeClaim', 'metadata:', `  name: ${o.name}`,
        '  labels:', `    karpenter.sh/capacity-type: ${o.capacity}`, `    karpenter.sh/nodepool: ${o.nodepool || 'default'}`,
        `    node.kubernetes.io/instance-type: ${o.type}`, `    topology.kubernetes.io/zone: ${o.zone}`,
        'status:', '  conditions:', `  - status: "${o.ready || 'Unknown'}"`, '    type: Ready', `  nodeName: ${o.ready === 'True' ? (o.nodeName || '""') : '""'}`].join('\n');
    }
    return null;
  }

  /* kubectl describe nodepool/ec2nodeclass/nodeclaim — wahi fields, describe ke "Title Case" format mein */
  function describe(sim, kind, o) {
    const y = toYaml(sim, kind, o);
    if (!y) return null;
    const title = k => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
    const body = y.split('\n').filter(l => !/^(apiVersion|kind|metadata|  name):/.test(l)).map(l => {
      const m = l.match(/^(\s*)(- )?([A-Za-z.\/-]+):(.*)$/);
      if (!m || m[3].includes('/') || m[3].includes('.')) return l;      // label keys waise hi
      return m[1] + (m[2] || '') + title(m[3]) + ':' + m[4];
    });
    return [`Name:         ${o.name}`, 'Namespace:', `API Version:  ${kind === 'ec2nodeclasses' ? 'karpenter.k8s.aws/v1' : 'karpenter.sh/v1'}`,
      `Kind:         ${{ nodepools: 'NodePool', ec2nodeclasses: 'EC2NodeClass', nodeclaims: 'NodeClaim' }[kind]}`,
      ...body, 'Events:       <none>'].join('\n');
  }

  /* monthly cost estimate — cost-optimization missions ke liye */
  function cost(sim) {
    const nodes = (sim.cluster.nodes || []).filter(n => n.karpenter);
    let total = 0;
    nodes.forEach(n => {
      const t = TYPES.find(x => x.name === n.instanceType);
      if (t) total += (n.capacityType === 'spot' ? t.spot : t.od);
    });
    return { hourly: total, monthly: total * 730, nodes: nodes.length };
  }

  return { reconcile, tables, toYaml, describe, cost, TYPES };
})();
