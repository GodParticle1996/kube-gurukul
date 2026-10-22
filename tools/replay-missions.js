// usage: node tools/replay-missions.js list | info <key> | run [solutions.json] [key]
// Dev tool: terminal missions ko asli renderer mein headless replay karta hai.
//   list                      → har mission + solution hai ya nahi
//   info <levelId>            → goal, tasks (check source), files, responses, hints
//   run [sols.json] [key]     → solutions chalao; key do to poora transcript
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const V = fs.readFileSync(path.join(DIR, 'validate.js'), 'utf8');
const stub = V.slice(V.indexOf('const noop'), V.indexOf("const FILES = ["));
const filesDecl = V.slice(V.indexOf("const FILES = ["), V.indexOf('const missing'));
const S = {};
eval(stub + filesDecl + `
const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\\n');
eval(src + '; S.KG = KG;');`);
const KG = S.KG;
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function missions() {
  const out = [];
  KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => {
    l.stages.filter(x => x.type === 'terminal').forEach((m, i) => out.push([l.id + '|t' + i, m, tr.id]));
    (l.interview.questions || []).filter(q => q.terminal).forEach((q, i) => out.push([l.id + '|iv' + i, q.terminal, tr.id]));
  }));
  return out;
}
function runOne(m, cmds) {
  const arena = document.createElement('div');
  KG.renderers.terminal(m, arena, () => {});
  const termEl = arena.children[1];
  const input = termEl.querySelector('input'), outEl = termEl.querySelector('.term-out');
  const won = () => arena.children.some(c => c.classList && c.classList.contains('stage-summary'));
  const log = []; let wonAt = -1;
  cmds.forEach((cmd, i) => {
    const before = outEl.children.length;
    input.value = cmd; input.fire('keydown', { key: 'Enter' });
    const out = outEl.children.slice(before).filter(c => !c.classList.contains('t-cmd')).map(c => c.textContent).join('\n');
    log.push('$ ' + cmd + '\n' + out);
    if (won() && wonAt < 0) wonAt = i;
  });
  // task status: tasks list li elements
  const goalBox = arena.children[0];
  const ul = goalBox && goalBox.children.find(c => c.tag === 'ul');
  const tasks = (m.tasks || []).map((t, i) => ((ul && ul.children[i] && ul.children[i].classList.contains('done')) ? '✅ ' : '⬜ ') + strip(t.text));
  return { won: won(), wonAt, log, tasks };
}
const [mode, a1, a2] = process.argv.slice(2);
const all = missions();
if (mode === 'list') all.forEach(([k, m, tr]) => console.log(k.padEnd(34), tr.padEnd(12), m.solution ? 'SOL' : '---', strip(m.title)));
if (mode === 'info') {
  all.filter(([k]) => k === a1 || k.startsWith(a1 + '|')).forEach(([k, m]) => {
    console.log('=== ' + k + ' — ' + strip(m.title));
    console.log('GOAL: ' + strip(m.goal));
    (m.tasks || []).forEach(t => console.log('  task: ' + strip(t.text) + '   ⟶ ' + String(t.check).replace(/\s+/g, ' ').slice(0, 220)));
    console.log('  success: ' + String(m.success).replace(/\s+/g, ' ').slice(0, 200));
    Object.entries(m.files || {}).forEach(([f, v]) => console.log('  file: ' + f + ' — ' + strip(v.desc)));
    (m.responses || []).forEach(r => console.log('  resp: ' + r.re));
    (m.hints || []).forEach(h => console.log('  hint: ' + strip(h)));
    const c = m.cluster || {};
    console.log('  pods: ' + (c.pods || []).map(p => p.name + '(' + p.status + ')').join(', '));
    ['deployments', 'services', 'releases', 'apps', 'rollouts', 'nodepools', 'charts'].forEach(kind => { if (c[kind]) console.log('  ' + kind + ': ' + (Array.isArray(c[kind]) ? c[kind].map(x => x.name).join(', ') : Object.keys(c[kind]).join(', '))); });
    if (m.solution) console.log('  SOLUTION: ' + JSON.stringify(m.solution));
  });
}
if (mode === 'run') {
  const sols = a1 && fs.existsSync(a1) ? JSON.parse(fs.readFileSync(a1, 'utf8')) : {};
  let pass = 0, fail = 0, none = 0;
  all.forEach(([k, m]) => {
    if (a2 && k !== a2) return;
    const cmds = sols[k] || m.solution;
    if (!cmds) { none++; return; }
    const r = runOne(m, cmds);
    const early = r.won && r.wonAt < cmds.length - 1;
    if (r.won && !early) { pass++; if (a2) { console.log(r.log.join('\n')); } return; }
    fail++;
    console.log('\n❌ ' + k + (early ? '  (won early at #' + r.wonAt + ')' : '  (not won)'));
    r.tasks.forEach(t => console.log('   ' + t));
    if (a2 || process.env.V) console.log(r.log.join('\n')); else console.log(r.log.slice(-3).join('\n').slice(0, 1500));
  });
  console.log(`\npass ${pass}  fail ${fail}  no-solution ${none}`);
}
if (mode === 'titles') {
  const sols = JSON.parse(fs.readFileSync(a1, 'utf8'));
  const out = {};
  all.forEach(([k, m]) => { if (sols[k]) out[k] = { title: m.title, solution: sols[k] }; });
  fs.writeFileSync(a2, JSON.stringify(out, null, 1));
  console.log('wrote', Object.keys(out).length);
}
