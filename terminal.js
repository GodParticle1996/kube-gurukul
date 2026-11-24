/* =====================================================================
   KubeGurukul — kubectl Simulator (terminal missions)

   Mission stage shape (data files mein):
   {
     type: 'terminal', title, instructions,
     goal: 'HTML — kya karna hai',
     cluster: { nodes:[], pods:[], deployments:[], services:[], configmaps:[], events:[],
                apiError?: 'text' | fn(sim) -> 'text'|null },     // API server down → har kubectl yahi error
     files: { 'fix.yaml': { desc, apply(sim, text, docs) -> 'message' | { err: 'message' }, content?, editable? } },
            // editable: true → learner `vi fix.yaml` se badal sakta hai (YAML fix editor). apply ko badla hua
            // `text` aur KG.yaml se parse hue `docs` milte hain; YAML hi galat ho toh apply chalta hi nahi
            // (terminal kubectl jaisa "error converting YAML to JSON" chhapta hai).
            // '.sh' files node par chalne wali scripts hain: bash fix.sh (API down ho tab bhi chalti hain)
     responses: [ { re: /regex/, out: 'text' | fn(sim, m), mutate?: fn(sim, m) } ],
     tasks: [ { text, check(sim) -> bool } ],                    // checklist (optional)
     success: fn(sim) -> bool,  successText: 'HTML',
     hints: ['pehla hint', 'doosra hint', ...],
     solution: ['kubectl get pods', { edit: 'fix.yaml', change: [['purana text', 'naya text']] }, 'kubectl apply -f fix.yaml'],
            // { edit } step = `vi fix.yaml` + editor mein yeh badlaav + Save (validator/replay isi se chalate hain)
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
  sim.edited = {};   // vi se save hui files: { 'fix.yaml': 'naya text' } — stage.files kabhi nahi badalte
  const fileText = name => (sim.edited[name] != null ? sim.edited[name] : (sim.files[name] && sim.files[name].content) || '');
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
      spellcheck="false" placeholder="kubectl get pods   (madad: help · Tab = naam poora)"></div>`;
  const out = term.querySelector('.term-out');
  const input = term.querySelector('input');

  /* mission ka solution, ek-ek command mein toda hua (a && b → a, b) — "agla command", command chips aur
     "is roop mein likho" wale tips isi se bante hain */
  const normCmd = c => String(c).replace(/\s+/g, ' ').trim().replace(/^sudo\s+/, '').replace(/^k(?= |$)/, 'kubectl');
  const solSteps = (stage.solution || []).flatMap(c => (c && typeof c === 'object' && c.edit)
    ? [{ cmd: 'vi ' + c.edit, edit: c }]
    : splitTop(String(c).replace(/\s+/g, ' ').trim(), ['&&', ';']).map(x => ({ cmd: normCmd(x.text) })));
  const solFlat = solSteps.map(x => x.cmd);
  /* command ka "dhaancha": kubectl get pods web-1 -o wide → "kubectl get pods " (naam aur flags nahi) */
  function shapeOf(cmd) {
    const t = normCmd(cmd).split(' ');
    if (/^(bash|sh|cat)$/.test(t[0])) return t[0] + ' ';
    if (!['kubectl', 'helm', 'argocd'].includes(t[0])) {   // doosre CLI (velero, cosign, trivy…): shuru ke sub-command shabd rakho
      let k = 1;
      while (k < 3 && t[k] && /^[a-z][a-z-]*$/.test(t[k])) k++;
      return t.slice(0, k).join(' ') + (t.length > k ? ' ' : '');
    }
    if (t[0] === 'kubectl' && t[1] === 'apply') return 'kubectl apply -f ';
    let n = 2;
    if (/^(kubectl (rollout|auth|config|get|describe|top|delete|create|set)|helm (repo|dependency|get|show|search|diff)|argocd (app|appset|proj|cluster))$/.test(t.slice(0, 2).join(' '))) n = 3;
    if (t[1] === 'argo' && t[2] === 'rollouts') n = 4;
    n = Math.min(n, t.length);
    return t.slice(0, n).join(' ') + (t.length > n ? ' ' : '');
  }
  const shapes = [...new Set(solFlat.map(shapeOf))].sort();

  const btns = el('div', 'term-btns');
  const hintBtn = el('button', 'btn small ghost', `💡 Hint (−${KG.HINT_COST} XP)`);
  hintBtn.onclick = () => giveHint();
  btns.appendChild(hintBtn);
  /* 🧰 free madad: is mission mein kaun se commands kaam aate hain (sirf dhaancha — naam/flags learner khud bharta hai) */
  const palette = el('div', 'term-palette');
  palette.style.display = 'none';
  if (shapes.length) {
    const palBtn = el('button', 'btn small ghost', '🧰 Is mission ke commands (free)');
    palBtn.onclick = () => {
      const show = palette.style.display === 'none';
      palette.style.display = show ? '' : 'none';
      palBtn.textContent = show ? '🧰 Commands chhupao' : '🧰 Is mission ke commands (free)';
    };
    btns.appendChild(palBtn);
    palette.appendChild(el('div', 'tp-note', 'Yeh commands is mission mein kaam aate hain (kram alag hai). Chip dabao → command neeche input mein aa jayega. <code>…</code> ki jagah naam khud likho; <b>Tab</b> dabane se naam poora ho jaata hai.'));
    const row = el('div', 'tp-row');
    shapes.concat(Object.keys(sim.files).length && !shapes.includes('ls') ? ['ls'] : []).forEach(sh => {
      const chip = el('button', 'tp-chip');
      chip.textContent = sh.trim() + (/ $/.test(sh) ? ' …' : '');
      chip.onclick = () => { input.value = sh; input.focus(); };
      row.appendChild(chip);
    });
    palette.appendChild(row);
    /* 🆘 poora atak gaye? solution ka agla command dikhao (mehenga hint) */
    const nextBtn = el('button', 'btn small ghost', `🆘 Agla command dikhao (−${KG.HINT_COST * 2} XP)`);
    nextBtn.onclick = () => showNextCommand();
    btns.appendChild(nextBtn);
  }

  arena.append(goalBox, term, btns, palette);

  /* ---------- ✏️ YAML fix editor: `vi <file>` → badlo → 💾 Save → kubectl apply -f <file> ----------
     Terminal ke andar hi khulta hai (input line chhup jaati hai). Tab = 2 space (YAML mein tab mana),
     Ctrl+S = save, Esc = cancel. Save ke baad terminal mein badli lines ka diff aata hai. */
  const termIn = term.querySelector('.term-in');
  const editor = el('div', 'term-editor');
  editor.style.display = 'none';
  const edHead = el('div', 'te-head');
  const edBody = el('div', 'te-body');
  const gutter = el('pre', 'te-gutter');
  const ta = el('textarea', 'te-text');
  ta.spellcheck = false; ta.wrap = 'off';
  edBody.append(gutter, ta);
  const edBtns = el('div', 'te-btns');
  const saveBtn = el('button', 'btn small te-save', '💾 Save (Ctrl+S)');
  const cancelBtn = el('button', 'btn small ghost te-cancel', '✖ Cancel (Esc)');
  edBtns.append(saveBtn, cancelBtn);
  editor.append(edHead, edBody, edBtns);
  term.appendChild(editor);
  let edFile = null;
  function paintGutter() {
    const n = String(ta.value).split('\n').length;
    gutter.textContent = Array.from({ length: n }, (_, k) => k + 1).join('\n');
    ta.rows = n + 1;
  }
  function openEditor(fname) {
    edFile = fname;
    edHead.innerHTML = `✏️ <b>${escapeHtml(fname)}</b> — line badlo, phir <b>💾 Save</b>. YAML mein <b>space</b> se indent (tab nahi).`;
    ta.value = fileText(fname);
    paintGutter();
    editor.style.display = '';
    termIn.style.display = 'none';
    input.disabled = true;
    setTimeout(() => { try { ta.focus(); } catch (e) { /* headless */ } }, 50);
  }
  function closeEditor() {
    edFile = null;
    editor.style.display = 'none';
    termIn.style.display = '';
    input.disabled = sim.done;
    setTimeout(() => input.focus(), 50);
  }
  function saveEditor() {
    if (!edFile) return;
    const fname = edFile, text = String(ta.value);
    const d = KG.yaml.diff(fileText(fname), text);
    sim.edited[fname] = text;
    closeEditor();
    const f = sim.files[fname] || {};
    if (!d.length) print('sys', `"${fname}" save hui — koi line nahi badli.`);
    else {
      print('ok', `"${fname}" save hui — ${d.filter(x => x.op === '+').length || d.length} line badli:\n` + d.map(x => `${x.op} ${String(x.line).padStart(3)} │ ${x.text}`).join('\n'));
      // onSave: file ko koi aur khud padhta hai (static pod → kubelet) — kubectl apply wala tip nahi
      if (f.saveTip) tip(f.saveTip);
      else if (!f.onSave && !f.noApplyTip) tip(`Cluster par lagane ke liye: kubectl apply -f ${fname}`);
    }
    if (d.length && f.onSave) {
      let docs = null, perr = null;
      try { docs = KG.yaml.parseAll(text); } catch (e) { if (!e || !e.yaml) throw e; perr = e; }
      try {
        const msg = f.onSave(sim, text, docs, perr);
        if (msg && typeof msg === 'object' && msg.err) print('err', msg.err);
        else if (msg) print('ok', msg);
      } catch (e) { print('err', `⚠️ Simulator error: ${e && e.message ? e.message : e} — yeh app ka bug hai, tumhara nahi.`); }
    }
    try { refresh(); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
  }
  saveBtn.onclick = saveEditor;
  cancelBtn.onclick = () => { if (!edFile) return; closeEditor(); print('sys', '(editor band — koi badlaav save nahi hua)'); };
  ta.addEventListener('input', paintGutter);
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveEditor(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelBtn.onclick(); }
    else if (e.key === 'Tab' && typeof ta.selectionStart === 'number') {
      e.preventDefault();
      const a = ta.selectionStart, b = ta.selectionEnd;
      ta.value = ta.value.slice(0, a) + '  ' + ta.value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + 2;
      paintGutter();
    }
  });
  // validator / replay tool isi se editor chalate hain (asli button click, asli save)
  term._editor = { ta, save: saveBtn, cancel: cancelBtn, isOpen: () => !!edFile };
  print('sys', `Mock cluster ready. Commands type karo — 'help' se list milegi. Tab = naam poora karo.`);
  setTimeout(() => input.focus(), 100);

  const cmdHistory = [];
  let histIdx = -1;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const raw = input.value.trim();
      input.value = '';
      if (raw) { cmdHistory.push(raw); histIdx = cmdHistory.length; run(raw); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
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
    // hintsFor(sim) → { key, list }: abhi ke hisse (jaise on-call ka incident) ke hints, har key ki apni ginti
    if (typeof stage.hintsFor === 'function') {
      const h = stage.hintsFor(sim) || { key: '_', list: [] };
      sim.hintPos = sim.hintPos || {};
      const pos = sim.hintPos[h.key] || 0;
      if (pos >= h.list.length) { print('hint', '💡 Is hisse ke aur hints nahi hain — tum kar sakte ho!'); return; }
      print('hint', `💡 Hint ${pos + 1}: ${h.list[pos]}`);
      sim.hintPos[h.key] = pos + 1; sim.hintsUsed++;
      return;
    }
    const hints = stage.hints || [];
    if (sim.hintsUsed >= hints.length) { print('hint', '💡 Aur hints nahi hain — tum kar sakte ho!'); return; }
    print('hint', `💡 Hint ${sim.hintsUsed + 1}: ${hints[sim.hintsUsed]}`);
    sim.hintsUsed++;
  }

  /* 🆘 solution ka pehla command jo learner ne abhi tak (kram mein) nahi chalaya */
  function nextSolution() {
    let p = 0;
    for (const h of sim.history) if (p < solFlat.length && solFlat[p] === h) p++;
    return p < solFlat.length ? solSteps[p] : null;
  }
  function showNextCommand() {
    if (sim.done) return;
    const step = nextSolution();
    const cmd = step && step.cmd;
    if (!cmd) { print('hint', '🆘 Solution ke saare commands chal chuke hain — checklist mein jo kaam ⬜ hai use dobara padho.'); return; }
    sim.hintsUsed += 2;
    const todo = (stage.tasks || []).find(t => { try { return !t.check(sim); } catch (e) { return true; } });
    const how = step.edit ? '\n   Editor mein yeh badlo, phir 💾 Save:' + (step.edit.change || []).map(([a, b]) => `\n     "${a}"  →  "${b}"`).join('') : '';
    print('hint', `🆘 Agla command: ${cmd}` + how + (todo ? `\n   (kaam: ${plain(todo.text)})` : '') + '\n   Command input mein rakh diya hai — Enter dabao.');
    input.value = cmd;
    input.focus();
  }
  const plain = html => String(html).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const tip = text => print('hint', '💡 ' + text);

  /* typo? sabse milta-julta shabd (edit distance) — "kya tumhara matlab … tha?" */
  function closest(word, cands) {
    if (!word) return null;
    const dist = (a, b) => {
      const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
      for (let j = 1; j <= b.length; j++) d[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
          i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : Infinity);
      return d[a.length][b.length];
    };
    let best = null, bd = Infinity;
    [...new Set(cands)].forEach(c => { const x = dist(word, c); if (x < bd) { bd = x; best = c; } });
    return best && best !== word && bd <= (word.length <= 4 ? 1 : 2) ? best : null;
  }
  const CMDS = ['kubectl', 'helm', 'argocd', 'ls', 'cat', 'vi', 'bash', 'help', 'hint', 'clear'];
  const VERBS = ['get', 'describe', 'logs', 'exec', 'apply', 'delete', 'top'];
  /* object nahi mila → batao ki us kind ke kaun se naam maujood hain */
  function notFoundTip(kind, name) {
    const names = list(kind).map(r => r && r.name).filter(Boolean);
    if (!names.length) { tip(`Is cluster mein koi ${kind} hai hi nahi.`); return; }
    const near = closest(name, names);
    tip((near ? `Kya tumhara matlab "${near}" tha? ` : '') + `Maujood ${kind}: ${names.slice(0, 8).join(', ')}${names.length > 8 ? ', …' : ''}  (Tab se naam poora hota hai)`);
  }
  /* command asli hai par is mission mein is roop mein scripted nahi → saaf batao ki kya chalega */
  function notScripted(norm, what) {
    const same = solFlat.filter(c => shapeOf(c) === shapeOf(norm) && c !== norm);
    if (same.length) {
      print('err', `Simulator '${what}' ko is roop mein nahi samajh paaya. Yeh simulator ki seema hai — tumhara idea sahi disha mein hai.`);
      tip(`Is mission mein yeh roop chalta hai:  ${same[0]}`);
      return;
    }
    print('err', `Is mission mein '${what}' ki zaroorat nahi hai (scripted nahi hai).`);
    if (shapes.length) tip(`Is mission mein kaam aane wale commands: ${shapes.map(x => x.trim()).join('  ·  ')}`);
  }

  /* ---------- Tab completion: verb → kind → object ka naam / file ka naam ---------- */
  const KIND_WORD = { pods: 'pods', deployments: 'deployments', services: 'services', nodes: 'nodes', configmaps: 'configmaps',
    secrets: 'secrets', endpoints: 'endpoints', events: 'events', statefulsets: 'statefulsets', daemonsets: 'daemonsets',
    ingresses: 'ingress', networkpolicies: 'networkpolicies', hpas: 'hpa', pvcs: 'pvc', pvs: 'pv', nodepools: 'nodepools',
    nodeclaims: 'nodeclaims', ec2nodeclasses: 'ec2nodeclasses', apps: 'applications', appsets: 'applicationsets', rollouts: 'rollouts' };
  function complete() {
    const m = input.value.match(/^(.*?)(\S*)$/);
    const head = m[1]; let last = m[2];
    const toks = head.trim().replace(/^sudo\s+/, '').split(/\s+/).filter(Boolean);
    if (toks[0] === 'k') toks[0] = 'kubectl';
    const prevTok = toks[toks.length - 1];
    const files = Object.keys(sim.files).concat(Object.keys(sim.saved || {}));
    const namesOf = kind => list(kind).map(r => r && r.name).filter(x => typeof x === 'string');
    const allNames = () => Object.keys(sim.cluster).flatMap(k => Array.isArray(sim.cluster[k]) ? namesOf(k) : []);
    const solAt = n => solFlat.map(c => c.split(' ')).filter(t => t.length > n && t.slice(0, n).join(' ') === toks.join(' ')).map(t => t[n]);
    let cands, prefix = '';
    const sl = last.match(/^([a-z0-9]+)\/(.*)$/);
    const custNames = w => { const ck = customKind(w); return ck ? (ck.items || []).map(x => x.name) : null; };
    if (sl && (RES_ALIAS[sl[1]] || custNames(sl[1]))) { cands = custNames(sl[1]) || namesOf(RES_ALIAS[sl[1]]); prefix = sl[1] + '/'; last = sl[2]; }
    else if (!toks.length) cands = CMDS;
    else if (prevTok === '-f' || prevTok === '--filename' || (/^(cat|bash|sh|vi|vim|nano|edit)$/.test(toks[0]) && toks.length === 1)) cands = files;
    else if (toks[0] === 'kubectl' && toks.length === 1) cands = VERBS.concat(solAt(1));
    else if (toks[0] === 'kubectl' && toks.length === 2 && /^(get|describe|delete|top|scale|edit|label|annotate|patch)$/.test(toks[1]))
      cands = Object.keys(KIND_WORD).filter(k => list(k).length).map(k => KIND_WORD[k]).concat(Object.keys(sim.cluster.custom || {}));
    else if (toks[0] === 'kubectl' && toks.length >= 3 && custNames(toks[2])) cands = custNames(toks[2]);
    else if (toks[0] === 'kubectl' && /^(logs|exec|debug|attach|port-forward|cp)$/.test(toks[1])) cands = namesOf('pods');
    else if (toks[0] === 'kubectl' && toks.length >= 3 && RES_ALIAS[toks[2]] && RES_ALIAS[toks[2]] !== 'all') cands = namesOf(RES_ALIAS[toks[2]]);
    else if ((toks[0] === 'helm' || toks[0] === 'argocd') && toks.length <= 2 && solAt(toks.length).length && !last.startsWith('-')) cands = solAt(toks.length).filter(x => /^[a-z-]+$/.test(x));
    else cands = allNames().concat(files);
    const hits = [...new Set(cands)].filter(c => c.startsWith(last)).sort();
    if (!hits.length) return;
    if (hits.length === 1) { input.value = head + prefix + hits[0] + ' '; return; }
    let common = hits[0];
    hits.forEach(h => { while (!h.startsWith(common)) common = common.slice(0, -1); });
    if (common.length > last.length) input.value = head + prefix + common;
    else print('sys', hits.join('   '));
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
  /* ---------- custom kinds: mission apne kinds khud la sakta hai (PDB, ServiceAccount, Certificate, HTTPRoute…) ----------
     cluster.custom = { pdb: { names: ['pdb', 'poddisruptionbudget', 'poddisruptionbudgets'],
                               cols: ['NAME', 'MIN AVAILABLE', 'ALLOWED DISRUPTIONS', 'AGE'],
                               items: [ { name: 'web-pdb', row: ['1', '0', '40d'], describe: 'text', yaml: 'text' } ] } }
     `kubectl get pdb [naam] [-o yaml]` aur `kubectl describe pdb <naam>` apne aap chalte hain; state `items` mein rehta hai,
     isliye fix file ka apply(sim) bas items badalta hai aur get/describe turant naya sach dikhate hain (regex responses mein yeh
     baar-baar stale ho jaata tha). */
  function customKind(word) {
    const c = sim.cluster.custom || {};
    const key = Object.keys(c).find(k => k === word || (c[k].names || []).includes(word));
    return key ? c[key] : null;
  }
  const customItem = (ck, name) => (ck.items || []).find(x => x.name === name) || (ck.items || []).find(x => String(x.name).startsWith(name));
  function customGet(ck, word, names, outFmt) {
    const items = ck.items || [];
    const picked = names.length ? names.map(n => customItem(ck, n)) : items;
    const miss = names.find((n, i) => !picked[i]);
    if (miss) {
      print('err', `Error from server (NotFound): ${(ck.names || [word])[0]} "${miss}" not found`);
      tip(items.length ? `Maujood ${word}: ${items.map(x => x.name).join(', ')}` : `Is cluster mein koi ${word} nahi hai.`);
      return null;
    }
    if (/^(yaml|json)$/.test(outFmt)) return picked.map(x => x.yaml || `# ${x.name}\n# (is object ka YAML is mission mein nahi diya — kubectl describe ${word} ${x.name} chalao)`).join('\n---\n');
    if (!picked.length) return 'No resources found in default namespace.';
    return table([ck.cols].concat(picked.map(x => [x.name].concat(x.row || []))));
  }
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
  function podTable(wide, items, labelCols) {
    labelCols = labelCols || [];
    const head = ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE'];
    if (wide) head.push('IP', 'NODE');
    const rows = [head.concat(labelCols.map(labelHeader))];
    (items || list('pods')).forEach(p => {
      const r = [p.name, p.ready, p.status, p.restarts, p.age];
      if (wide) r.push(p.ip || '<none>', p.node || '<none>');
      rows.push(r.concat(labelCols.map(k => (p.labels || {})[k] || '')));
    });
    return table(rows);
  }
  /* node/pod labels — `kubectl get nodes -L karpenter.sh/capacity-type` ke liye.
     Karpenter nodes ke fields asli well-known labels par map hote hain. */
  function labelsOf(r) {
    const l = Object.assign({}, r.labels || {});
    if (r.instanceType) l['node.kubernetes.io/instance-type'] = r.instanceType;
    if (r.capacityType) l['karpenter.sh/capacity-type'] = r.capacityType;
    if (r.zone) l['topology.kubernetes.io/zone'] = r.zone;
    if (r.nodepool) l['karpenter.sh/nodepool'] = r.nodepool;
    return l;
  }
  // -L ka column header = label key ka aakhri hissa, UPPERCASE (asli kubectl jaisa)
  const labelHeader = k => k.split('/').pop().toUpperCase();
  function genericTable(kind, items, opts) {
    const labelCols = (opts && opts.labelCols) || [];
    const defs = {
      deployments: ['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE'],
      services: ['NAME', 'TYPE', 'CLUSTER-IP', 'PORT(S)', 'AGE'],
      nodes: ['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION'],
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
      const t = KG.karpenter.tables(sim, opts && opts.wide)[kind];
      const rows = items ? t.rows.filter(r => items.some(x => x.name === r[0])) : t.rows;
      return rows.length ? table([t.cols, ...rows]) : 'No resources found.';
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
    const rows = [cols.concat(labelCols.map(labelHeader))];
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
    }).concat(labelCols.map(k => labelsOf(r)[k] || ''))));
    return table(rows);
  }

  function kindTip(word) {
    const cust = Object.keys(sim.cluster.custom || {});
    const near = closest(word, Object.keys(RES_ALIAS).concat(cust));
    const here = Object.keys(KIND_WORD).filter(k => list(k).length).map(k => KIND_WORD[k]).concat(cust);
    tip((near ? `Kya tumhara matlab "${near}" tha? ` : '') + (here.length ? `Is cluster mein yeh kinds hain: ${here.join(', ')}` : ''));
  }
  function describePod(p) {
    if (p.describe) return p.describe;
    let s = `Name:         ${p.name}\nNamespace:    ${p.ns || 'default'}\nNode:         ${p.node || '<none>'}\nStatus:       ${p.status}\nIP:           ${p.ip || '<none>'}\nRestarts:     ${p.restarts}`;
    if (p.events && p.events.length) s += `\n\nEvents:\n  ` + p.events.join('\n  ');
    return s;
  }

  /* ---------- checklist: ✅ ho chuke kaam, 👉 abhi wala kaam ---------- */
  const taskOk = [];
  function paintTasks(announce) {
    if (!stage.tasks) return;
    // checklist ABHI ki state dikhaye: koi kaam bigad gaya toh tick hat jaata hai
    // (success = KG.allOf(tasks) — sab ek saath sach hone chahiye)
    let now = -1, fresh = false;
    stage.tasks.forEach((t, i) => {
      let ok = false;
      try { ok = !!(t.check && t.check(sim)); } catch (e) { ok = false; }
      const li = taskList.children[i];
      if (li) { if (ok) li.classList.add('done'); else li.classList.remove('done'); li.classList.remove('now'); }
      if (!ok && now < 0) now = i;
      if (announce && ok && !taskOk[i]) { fresh = true; print('task', `✅ Kaam ${i + 1}/${stage.tasks.length} poora: ${plain(t.text)}`); }
      taskOk[i] = ok;
    });
    if (now >= 0 && taskList.children[now]) taskList.children[now].classList.add('now');
    if (fresh && now >= 0) print('task', `👉 Ab kaam ${now + 1}: ${plain(stage.tasks[now].text)}`);
  }
  paintTasks(false);

  /* ---------- checks after every command ---------- */
  function refresh() {
    // Karpenter ek controller hai — har command ke baad reconcile hota hai
    if (sim.cluster.karpenter && typeof KG.karpenter === 'object') KG.karpenter.reconcile(sim);
    // onTick: mission ka apna "controller" (on-call shift ki ghadi + incidents) — har command / save ke baad
    if (typeof stage.onTick === 'function') stage.onTick(sim, print);
    paintTasks(true);
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
    // 'sudo' bhi hata do — node par asli admin "sudo crictl ps" hi likhta hai
    const norm = cmdline.replace(/^sudo\s+/, '').replace(/^k(?= |$)/, 'kubectl');
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
        '  vi <file>                      (YAML file kholo, badlo, 💾 Save — phir kubectl apply -f <file>)',
        '  bash <file>.sh                 (node par chalne wali script — API down ho tab bhi)',
        '  kubectl exec [-it] <pod> -- <cmd>',
        '  kubectl top <pods|nodes>',
        '  helm <cmd>                     (Helm mission: "helm help")',
        '  argocd <cmd>                   (GitOps mission: "argocd help")',
        '  kubectl argo rollouts get rollout <name> | promote | abort',
        '  kubectl get nodepools|nodeclaims|ec2nodeclasses [-o wide|-o yaml]   (Karpenter mission)',
        '  kubectl get nodes -L karpenter.sh/capacity-type -L node.kubernetes.io/instance-type',
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
      if (f) { print('ok', fileText(fname) || `# ${fname}\n# ${String(f.desc || '(is file ka content mission mein nahi diya)').replace(/<[^>]+>/g, '')}`); return; }
      print('err', `cat: ${fname}: No such file or directory ('ls' se files dekho)`);
      return;
    }
    const vm = norm.match(/^(vi|vim|nano|edit)(?:\s+(\S+))?$/);
    if (vm) {
      const editable = Object.keys(sim.files).filter(n => sim.files[n].editable);
      const fname = (vm[2] || '').replace(/^\.\//, '');
      if (!fname) { print('err', `${vm[1]}: file ka naam do — jaise: vi ${editable[0] || '<file>'}`); return; }
      if (!sim.files[fname]) { print('err', `${vm[1]}: ${fname}: No such file ('ls' se files dekho)`); return; }
      if (!sim.files[fname].editable) {
        print('err', `"${fname}" is mission mein sirf padhne ke liye hai (cat ${fname}).`);
        if (editable.length) tip(`Badalne wali files: ${editable.join(', ')}`);
        return;
      }
      openEditor(fname);
      return;
    }

    let toks = norm.split(' ');
    // node par script: bash fix.sh / sh fix.sh / ./fix.sh — kubectl se alag, API down ho tab bhi chalti hai
    const script = /^(bash|sh)$/.test(toks[0]) && toks.length === 2 ? toks[1] : (toks.length === 1 && /^\.\/\S+$/.test(toks[0]) ? toks[0] : null);
    if (script) {
      const fname = script.replace(/^\.\//, '');
      const f = sim.files[fname];
      if (!f) { print('err', `${toks[0] === fname ? 'bash' : toks[0]}: ${fname}: No such file or directory ('ls' se files dekho)`); return; }
      if (!/\.sh$/.test(fname)) { print('err', `${fname}: line 1: apiVersion:: command not found — yeh YAML hai, script nahi. Lagane ke liye: kubectl apply -f ${fname}`); return; }
      const msg = f.apply(sim);
      print('ok', msg || `${fname} chal gayi`);
      return;
    }
    // helm commands helmsim.js sambhalta hai
    if (toks[0] === 'helm' && typeof KG.helm === 'function') { KG.helm(sim, toks, print); return; }
    // argocd CLI aur `kubectl argo rollouts ...` argosim.js sambhalta hai
    if (toks[0] === 'argocd' && typeof KG.argo === 'function') { KG.argo(sim, toks, print); return; }
    if (toks[0] === 'kubectl' && toks[1] === 'argo' && typeof KG.argo === 'function') { KG.argo(sim, toks, print); return; }
    if (toks[0] !== 'kubectl') {
      print('err', `bash: ${toks[0]}: command not found — yahan kubectl${typeof KG.helm === 'function' ? ', helm, argocd' : ''} aur ls/cat/bash chalte hain ('help' try karo)`);
      const near = closest(toks[0], CMDS);
      if (near) tip(`Kya tumhara matlab "${near}" tha?  →  ${[near].concat(toks.slice(1)).join(' ')}`);
      return;
    }
    // API server down (etcd toota, certificate expire) → kubectl ka har command wahin atakta hai
    const apiErr = typeof sim.cluster.apiError === 'function' ? sim.cluster.apiError(sim) : sim.cluster.apiError;
    if (apiErr && !/^kubectl (help|version --client|config )/.test(norm)) { print('err', apiErr); return; }
    // flags nikal do jo hum ignore/parse karte hain
    const wide = toks.includes('-o') && toks[toks.indexOf('-o') + 1] === 'wide' || toks.includes('-owide') || toks.includes('-o=wide') || toks.includes('--output=wide');
    // -o yaml / json / jsonpath=… (wide ke alawa koi bhi output format)
    const fmtTok = toks.find((t, i) => /^(-o|--output)=?./.test(t) && t !== '-o' || toks[i - 1] === '-o');
    const outFmt = fmtTok ? fmtTok.replace(/^(-o|--output)=?/, '') : '';
    // -L key  /  -L=key  /  --label-columns=a,b  → extra label columns
    const labelCols = [];
    toks.forEach((t, i) => {
      if ((t === '-L' || t === '--label-columns') && toks[i + 1]) labelCols.push(...toks[i + 1].split(','));
      else if (/^(-L|--label-columns)=/.test(t)) labelCols.push(...t.split('=').slice(1).join('=').split(','));
    });
    const prev = toks.includes('--previous') || toks.includes('-p') || toks.includes('--previous=true');
    toks = toks.filter((t, i) => !(t === '-o' || (toks[i - 1] === '-o') || /^(-o|--output)=?./.test(t) || t === '--previous' || t === '-p' || t === '-n' || toks[i - 1] === '-n' || t === '--namespace' || toks[i - 1] === '--namespace'));

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
        const ck = customKind(r);
        if (ck) {
          const text = customGet(ck, r, names, outFmt);
          if (text == null) return;
          blocks.push(kinds.length > 1 ? `── ${r} ──\n${text}` : text);
          continue;
        }
        const kind = RES_ALIAS[r];
        if (!kind) { print('err', `error: the server doesn't have a resource type "${r}"`); kindTip(r); return; }
        const pick = items => {
          if (!names.length) return items;
          return names.map(n => items.find(x => x.name === n) || items.find(x => (x.name || '').startsWith(n))).filter(Boolean);
        };
        // karpenter ke tables karpentersim se aate hain — unhe naam se filter nahi karte
        const dynamic = ['nodepools', 'nodeclaims', 'ec2nodeclasses'].includes(kind);
        if (names.length && kind !== 'all' && kind !== 'events') {
          const found = pick(list(kind));
          const missing = names.filter(n => !found.some(x => x.name === n || (x.name || '').startsWith(n)));
          if (missing.length) { print('err', `Error from server (NotFound): ${kind} "${missing[0]}" not found`); notFoundTip(kind, missing[0]); return; }
        }
        let text;
        // -o yaml: Karpenter CRs ka asli-jaisa YAML (baaki kinds ka poora spec simulator mein nahi hai)
        if (outFmt && outFmt !== 'wide' && outFmt !== 'name') {
          if (dynamic && /^(yaml|json)$/.test(outFmt) && KG.karpenter && KG.karpenter.toYaml) {
            const objs = names.length ? pick(list(kind)) : list(kind);
            if (names.length && !objs.length) { print('err', `Error from server (NotFound): ${kind} "${names[0]}" not found`); return; }
            text = objs.map(o => KG.karpenter.toYaml(sim, kind, o)).join('\n---\n');
            if (outFmt === 'json') print('sys', '(simulator: json ki jagah yaml dikha raha hoon — fields wahi hain)');
            blocks.push(text);
            continue;
          }
          print('sys', `(simulator: '-o ${outFmt}' sirf Karpenter resources ke liye hai — yahan table dikha raha hoon. Asli cluster par poora output aata. Details ke liye: kubectl describe ${r} <naam>)`);
        }
        if (outFmt === 'name') {
          const objs = names.length ? pick(list(kind)) : list(kind);
          text = objs.map(o => `${kind.replace(/s$/, '')}/${o.name}`).join('\n') || 'No resources found.';
        } else if (kind === 'all') {
          text = ['── pods ──', podTable(wide), '', '── deployments ──', genericTable('deployments') || 'No resources found.', '', '── services ──', genericTable('services') || 'No resources found.'].join('\n');
        } else if (kind === 'pods') {
          const pl = pick(list('pods'));
          // asli kubectl: koi pod na ho toh sirf header nahi, yeh line aati hai
          text = pl.length ? podTable(wide, pl, labelCols) : 'No resources found in default namespace.';
        } else if (kind === 'events') {
          const evs = list('events');
          text = evs.length ? evs.join('\n') : 'No events found.';
        } else {
          const t = genericTable(kind, names.length ? pick(list(kind)) : null, { wide, labelCols });
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
      const ckd = customKind(res);
      if (ckd) {
        const its = name ? [customItem(ckd, name)] : (ckd.items || []);
        if (name && !its[0]) {
          print('err', `Error from server (NotFound): ${(ckd.names || [res])[0]} "${name}" not found`);
          tip((ckd.items || []).length ? `Maujood ${res}: ${ckd.items.map(x => x.name).join(', ')}` : `Is cluster mein koi ${res} nahi hai.`);
          return;
        }
        if (!its.length) { print('ok', 'No resources found in default namespace.'); return; }
        print('ok', its.map(x => typeof x.describe === 'function' ? x.describe(sim, x) : (x.describe || `Name:  ${x.name}\n(describe output is mission mein limited hai)`)).join('\n\n\n'));
        return;
      }
      const kind = RES_ALIAS[res];
      if (!kind) { print('err', `error: the server doesn't have a resource type "${res || ''}"`); kindTip(res); return; }
      const descOne = obj => {
        const kd = ['nodepools', 'nodeclaims', 'ec2nodeclasses'].includes(kind) && KG.karpenter && KG.karpenter.describe
          ? KG.karpenter.describe(sim, kind, obj) : null;
        return kind === 'pods' ? describePod(obj) : (obj.describe || kd || `Name: ${obj.name}\n(describe output is mission mein limited hai)`);
      };
      // asli kubectl: naam na do toh us kind ke SAARE objects describe hote hain
      if (!name) {
        if (!list(kind).length) { print('ok', 'No resources found in default namespace.'); return; }
        print('ok', list(kind).map(descOne).join('\n\n\n'));
        return;
      }
      const obj = find(kind, name);
      if (!obj) { print('err', `Error from server (NotFound): ${kind} "${name || ''}" not found`); notFoundTip(kind, name); return; }
      print('ok', descOne(obj));
      return;
    }

    if (verb === 'logs') {
      const args = positional(toks.slice(2), ['-c', '--container', '-l', '--selector', '--tail', '--since', '--since-time']);
      const want = podName(args[0]);
      const p = find('pods', want);
      if (!p) { print('err', `Error from server (NotFound): pods "${want || ''}" not found`); notFoundTip('pods', want); return; }
      const cname = p.container || p.name.replace(/(-[a-z0-9]{6,10})?-[a-z0-9]{5}$/, '');
      // asli kubelet: --previous sirf tab jab container kam se kam ek baar mar ke restart hua ho
      if (prev && !p.prevLogs && !p.restarts) {
        print('err', `Error from server (BadRequest): previous terminated container "${cname}" in pod "${p.name}" not found`);
        return;
      }
      // bina flag: sabse naya run. Naya run shuru na hua ho (CrashLoopBackOff ka wait) toh kubelet aakhri mara hua run deta hai
      const logs = prev ? (p.prevLogs || p.logs) : (p.logs != null ? p.logs : p.prevLogs);
      if (logs == null && !prev) {
        if (p.status === 'Pending' && (!p.node || p.node === '<none>')) {
          print('sys', '(kuch nahi aaya — pod kisi node par schedule hi nahi hua, container bana hi nahi. Wajah describe ke Events mein hai.)');
          return;
        }
        // container kabhi start hi nahi hua → logs hain hi nahi
        const waitMsg = { ImagePullBackOff: 'trying and failing to pull image', ErrImagePull: "image can't be pulled" }[p.status]
          || (/^Init:/.test(p.status) ? 'PodInitializing'
          : /^(ContainerCreating|CreateContainerConfigError|CreateContainerError|PodInitializing|RunContainerError)$/.test(p.status) ? p.status : null);
        if (waitMsg) { print('err', `Error from server (BadRequest): container "${cname}" in pod "${p.name}" is waiting to start: ${waitMsg}`); return; }
      }
      print('ok', typeof logs === 'function' ? logs(sim) : (logs || '(no logs)'));
      return;
    }

    if (verb === 'delete') {
      const args = positional(toks.slice(2), ['--grace-period', '-l', '--selector', '--cascade', '-f', '--filename']);
      if (toks.includes('-f') || toks.includes('--filename')) {
        notScripted(norm, 'kubectl delete -f');
        return;
      }
      let res = args[0], names = args.slice(1);
      if (res && res.includes('/')) { const [a, b] = res.split('/'); res = a; names = [b, ...names]; }
      const kind = RES_ALIAS[res];
      if (kind !== 'pods') { notScripted(norm, `kubectl delete ${res || ''}`.trim()); return; }
      if (!names.length) { print('err', 'error: resource(s) were provided, but no name was specified'); return; }
      for (const n of names) {
        const p = find('pods', n);
        if (!p) { print('err', `Error from server (NotFound): pods "${n}" not found`); notFoundTip('pods', n); continue; }
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
      if (!f) {
        print('err', `error: the path "${fname}" does not exist`);
        const fl = Object.keys(sim.files);
        tip(fl.length ? `Is mission ki files: ${fl.join(', ')}` : 'Is mission mein koi file nahi hai — fix kisi aur command se hoga.');
        return;
      }
      if (/\.sh$/.test(fname)) { print('err', `error: error parsing ${fname}: error converting YAML to JSON — yeh shell script hai, manifest nahi. Chalane ke liye: bash ${fname}`); return; }
      const text = fileText(fname);
      let docs = null;
      if (f.editable && !f.rawApply) {   // rawApply: file YAML nahi (Helm template) — mission khud jawab deta hai
        try { docs = KG.yaml.parseAll(text); }
        catch (e) {
          if (!e || !e.yaml) throw e;
          print('err', `error: error parsing ${fname}: error converting YAML to JSON: ${e.message}`);
          tip(`vi ${fname} se line ${e.line} dekho (aas-paas ki lines ki indent bhi).`);
          return;
        }
      }
      const msg = f.apply(sim, text, docs);
      if (msg && typeof msg === 'object' && msg.err) print('err', msg.err);
      else print('ok', msg || `${fname} applied`);
      return;
    }

    if (verb === 'exec') {
      // kubectl exec [-it] <pod> [-c ctr] -- cmd...
      const ddi = toks.indexOf('--');
      const args = positional(toks.slice(2, ddi > -1 ? ddi : undefined), ['-c', '--container']);
      const want = podName(args[0]);
      const p = find('pods', want);
      if (!p) { print('err', `Error from server (NotFound): pods "${want || ''}" not found`); notFoundTip('pods', want); return; }
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
        // asli header (kubectl v1.32): NAME CPU(cores) CPU(%) MEMORY(bytes) MEMORY(%)
        const rows = [['NAME', 'CPU(cores)', 'CPU(%)', 'MEMORY(bytes)', 'MEMORY(%)']];
        only(list('nodes')).forEach(n => {
          const [c, m] = (n.top || '18% 42%').split(' ');
          const cores = Math.round(parseFloat(c) / 100 * (n.cpu || 4) * 1000) + 'm';
          const bytes = Math.round(parseFloat(m) / 100 * (n.mem || 16) * 1024) + 'Mi';
          rows.push([n.name, cores, c, bytes, m]);
        });
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
    if (verb === 'edit' && Object.keys(sim.files).some(n => sim.files[n].editable)) {
      print('err', 'kubectl edit is simulator mein nahi chalta. Wahi kaam: file kholo  →  vi <file>  →  💾 Save  →  kubectl apply -f <file>');
      tip(`Badalne wali files: ${Object.keys(sim.files).filter(n => sim.files[n].editable).join(', ')}`);
      return;
    }
    if (REAL_VERBS.includes(verb)) { notScripted(norm, `kubectl ${verb}`); return; }

    print('err', `error: unknown command "${verb}" for "kubectl" ('help' se supported commands dekho)`);
    const nearVerb = closest(verb, VERBS.concat(REAL_VERBS));
    if (nearVerb) tip(`Kya tumhara matlab "kubectl ${nearVerb}" tha?`);
  }
};
