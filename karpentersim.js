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
  ];

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
    return { cpu: parseCpu(r.cpu) || 0.5, mem: parseMem(r.memory) || 1 };
  }

  /* NodePool ke requirements se allowed instance types */
  function allowedTypes(np) {
    let list = TYPES.slice();
    (np.requirements || []).forEach(req => {
      const vals = req.values || [];
      const key = req.key;
      const inOp = !req.operator || req.operator === 'In';
      if (key.includes('instance-category')) list = list.filter(t => inOp === vals.includes(t.cat));
      else if (key.includes('instance-generation')) list = list.filter(t => inOp === vals.map(Number).includes(t.gen));
      else if (key.includes('kubernetes.io/arch') || key.includes('arch')) list = list.filter(t => inOp === vals.includes(t.arch));
      else if (key.includes('instance-family')) list = list.filter(t => inOp === vals.some(v => t.name.startsWith(v)));
      else if (key.includes('node.kubernetes.io/instance-type')) list = list.filter(t => inOp === vals.includes(t.name));
    });
    return list;
  }
  function capacityType(np) {
    const req = (np.requirements || []).find(r => r.key.includes('capacity-type'));
    const vals = (req && req.values) || ['on-demand'];
    return vals.includes('spot') ? 'spot' : 'on-demand';
  }

  /* pod NodePool ke taints tolerate karta hai? */
  function tolerates(pod, np) {
    const taints = np.taints || [];
    if (!taints.length) return true;
    const tols = pod.tolerations || [];
    return taints.every(t => tols.some(tol => tol.key === t.key));
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

    /* 1) launching NodeClaims → Ready nodes (agla tick) */
    sim.cluster.nodeclaims.filter(nc => nc.ready === 'Unknown').forEach(nc => {
      if (k.tick > (nc.bornTick || 0)) {
        nc.ready = 'True';
        nc.age = '10s';
        sim.cluster.nodes.push({
          name: nc.nodeName, status: 'Ready', roles: '<none>', age: '5s', version: 'v1.30.2',
          instanceType: nc.type, capacityType: nc.capacity, zone: nc.zone,
          nodepool: nc.nodepool, cpu: nc.cpu, mem: nc.mem, usedCpu: 0, usedMem: 0,
          karpenter: true, top: '5% 12%',
        });
        log(sim, `Normal  Ready  ${nc.nodeName}  Node became ready (${nc.type}, ${nc.capacity})`);
        // is NodeClaim ka intezaar kar rahe pods ab schedule ho jaate hain
        sim.cluster.pods.filter(p => p.status === 'Pending' && p.waitingFor === nc.name).forEach(p => {
          p.status = 'Running'; p.ready = p.ready === '0/1' ? '1/1' : p.ready; p.node = nc.nodeName;
          p.ip = '10.244.' + (sim.cluster.nodes.length) + '.' + (10 + Math.floor(Math.random() * 40));
          delete p.waitingFor;
          const d = demand(p);
          const node = sim.cluster.nodes.find(n => n.name === nc.nodeName);
          if (node) { node.usedCpu += d.cpu; node.usedMem += d.mem; }
          log(sim, `Normal  Scheduled  ${p.name}  Successfully assigned to ${nc.nodeName}`);
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
        p.describe = p._baseDescribe + '\n\nEvents (latest):\n  Warning  FailedProvisioning  karpenter: ' + reason;
      };
      const d = demand(p);
      // pehle: kya kisi maujooda node par fit ho jaata hai?
      const fit = sim.cluster.nodes.find(n => n.karpenter && (n.cpu - n.usedCpu) >= d.cpu && (n.mem - n.usedMem) >= d.mem);
      if (fit) {
        p.status = 'Running'; p.node = fit.name; p.ready = p.ready === '0/1' ? '1/1' : p.ready;
        fit.usedCpu += d.cpu; fit.usedMem += d.mem;
        log(sim, `Normal  Scheduled  ${p.name}  Assigned to existing node ${fit.name}`);
        return;
      }
      // NodePool dhundo jo isse le sake
      const pools = (sim.cluster.nodepools || []).filter(np => tolerates(p, np))
        .sort((a, b) => (b.weight || 0) - (a.weight || 0));
      if (!pools.length) {
        fail('koi NodePool is pod se match nahi karta' +
          ((sim.cluster.nodepools || []).length ? ' (taints/tolerations ya nodeSelector dekho)' : ' — cluster mein koi NodePool hai hi nahi!'));
        log(sim, `Warning  FailedProvisioning  ${p.name}  no nodepool matched pod`);
        return;
      }
      const np = pools[0];
      const types = allowedTypes(np).filter(t => t.cpu >= d.cpu && t.mem >= d.mem);
      if (!types.length) {
        fail(`NodePool "${np.name}" ke requirements se koi instance type itna bada nahi hai (pod chahta hai: ${d.cpu} CPU / ${d.mem}Gi)`);
        log(sim, `Warning  FailedProvisioning  ${p.name}  no instance type satisfies requirements of nodepool ${np.name}`);
        return;
      }
      // limits check
      const used = (np.used && parseCpu(np.used.cpu)) || 0;
      const limit = (np.limits && parseCpu(np.limits.cpu)) || Infinity;
      const chosen = types.sort((x, y) => x.cpu - y.cpu || x.mem - y.mem)[0];   // sabse chhota jo fit ho
      if (used + chosen.cpu > limit) {
        fail(`NodePool "${np.name}" ki cpu limit reached: limits.cpu = ${limit}, used = ${used} — naya node nahi banega`);
        log(sim, `Warning  FailedProvisioning  ${p.name}  nodepool ${np.name} cpu limit reached (${used}/${limit})`);
        return;
      }
      const cap = capacityType(np);
      const zone = ['ap-south-1a', 'ap-south-1b', 'ap-south-1c'][sim.cluster.nodeclaims.length % 3];
      const id = Math.random().toString(36).slice(2, 7);
      const nc = {
        name: `${np.name}-${id}`, nodeName: `ip-10-0-${20 + sim.cluster.nodeclaims.length}-4.ap-south-1.compute.internal`,
        type: chosen.name, capacity: cap, zone, nodepool: np.name,
        cpu: chosen.cpu, mem: chosen.mem, ready: 'Unknown', age: '0s',
        price: cap === 'spot' ? chosen.spot : chosen.od,
        bornTick: k.tick,
      };
      sim.cluster.nodeclaims.push(nc);
      np.used = np.used || { cpu: 0 };
      np.used.cpu = used + chosen.cpu;
      p.waitingFor = nc.name;
      log(sim, `Normal  Nominated   ${p.name}  karpenter: pod triggered NodeClaim ${nc.name}`);
      log(sim, `Normal  Launched    ${nc.name}  Launched ${cap} ${chosen.name} in ${zone} ($${nc.price}/hr)`);
    });

    /* 3) Consolidation — khaali ya kam bhare nodes hatao */
    const pol = (sim.cluster.nodepools || [])[0];
    const cpol = pol && pol.disruption && pol.disruption.consolidationPolicy;
    if (cpol && k.consolidate !== false) {
      sim.cluster.nodes.filter(n => n.karpenter).forEach(n => {
        const podsOn = sim.cluster.pods.filter(p => p.node === n.name);
        const blocked = podsOn.some(p => p.doNotDisrupt);
        const empty = podsOn.length === 0;
        const under = !empty && (n.usedCpu / n.cpu) < 0.4 && podsOn.length <= 2;
        if (empty && (cpol === 'WhenEmpty' || cpol === 'WhenEmptyOrUnderutilized')) {
          if (blocked) return;
          sim.cluster.nodes = sim.cluster.nodes.filter(x => x !== n);
          sim.cluster.nodeclaims = sim.cluster.nodeclaims.filter(nc => nc.nodeName !== n.name);
          log(sim, `Normal  DisruptionTerminating  ${n.name}  Disrupting node via consolidation: EMPTY (paisa bach gaya 💰)`);
        } else if (under && cpol === 'WhenEmptyOrUnderutilized') {
          if (blocked) {
            log(sim, `Normal  DisruptionBlocked  ${n.name}  Cannot disrupt — pod has karpenter.sh/do-not-disrupt annotation`);
            return;
          }
          // pods ko doosre node par shift karo agar jagah ho
          const target = sim.cluster.nodes.find(o => o !== n && o.karpenter &&
            (o.cpu - o.usedCpu) >= n.usedCpu && (o.mem - o.usedMem) >= n.usedMem);
          if (!target) return;
          podsOn.forEach(p => { p.node = target.name; });
          target.usedCpu += n.usedCpu; target.usedMem += n.usedMem;
          sim.cluster.nodes = sim.cluster.nodes.filter(x => x !== n);
          sim.cluster.nodeclaims = sim.cluster.nodeclaims.filter(nc => nc.nodeName !== n.name);
          log(sim, `Normal  DisruptionTerminating  ${n.name}  Disrupting via consolidation: UNDERUTILIZED — pods ${target.name} par shift hue 💰`);
        }
      });
    }

    /* 4) Drift — EC2NodeClass badla toh nodes drifted */
    (sim.cluster.ec2nodeclasses || []).forEach(nc => {
      if (nc.drifted) {
        sim.cluster.nodes.filter(n => n.karpenter && !n.drifted).forEach(n => {
          n.drifted = true;
          log(sim, `Normal  Drifted  ${n.name}  Node drifted: EC2NodeClass "${nc.name}" badal gaya (naya AMI) — Karpenter isse replace karega`);
        });
      }
    });
  }

  /* ---------------------------------------------------------------
     Tables — kubectl get nodepools / nodeclaims / ec2nodeclasses
     --------------------------------------------------------------- */
  function tables(sim) {
    return {
      nodepools: {
        cols: ['NAME', 'NODECLASS', 'WEIGHT', 'CPU-LIMIT', 'CPU-USED', 'CONSOLIDATION'],
        rows: (sim.cluster.nodepools || []).map(np => [
          np.name, np.nodeClassRef || 'default', np.weight != null ? np.weight : '-',
          (np.limits && np.limits.cpu) || '-', (np.used && np.used.cpu) || 0,
          (np.disruption && np.disruption.consolidationPolicy) || '-']),
      },
      nodeclaims: {
        cols: ['NAME', 'TYPE', 'CAPACITY', 'ZONE', 'NODE', 'READY', 'AGE'],
        rows: (sim.cluster.nodeclaims || []).map(nc => [
          nc.name, nc.type, nc.capacity, nc.zone,
          (nc.nodeName || '').split('.')[0], nc.ready, nc.age || '0s']),
      },
      ec2nodeclasses: {
        cols: ['NAME', 'AMI-FAMILY', 'ROLE', 'READY', 'AGE'],
        rows: (sim.cluster.ec2nodeclasses || []).map(c => [
          c.name, c.amiFamily || 'AL2023', c.role || 'KarpenterNodeRole', c.ready || 'True', c.age || '30d']),
      },
    };
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

  return { reconcile, tables, cost, TYPES };
})();
