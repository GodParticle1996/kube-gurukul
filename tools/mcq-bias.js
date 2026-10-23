// Dev tool: MCQ "length bias" — sahi jawab sabse lamba/chhota dikhe to learner bina padhe guess kar leta hai.
//   node tools/mcq-bias.js                  → MCQ/interview, incident aur Decision Dojo ka audit
//   node tools/mcq-bias.js list beginner    → flagged sawal (key, lengths) dikhao
//   node tools/mcq-bias.js --kind=incident  → good-vs-false choices; --json gives reviewable records
// MCQ/incident: sahi >= 1.15x every wrong option, or <= 0.85x every wrong option.
// Dojo: exact expected bias over every possible sample of four wrong leaves (decisions.js).
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const V = fs.readFileSync(path.join(DIR, 'validate.js'), 'utf8');
const stub = V.slice(V.indexOf('const noop'), V.indexOf('const FILES = ['));
const filesDecl = V.slice(V.indexOf('const FILES = ['), V.indexOf('const missing'));
const S = {};
eval(stub + filesDecl + "const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\\n'); eval(src + '; S.KG = KG;');");
const KG = S.KG;
// Count visible characters, including entity text, rather than HTML markup.
const visible = c => String(c).replace(/<[^>]+>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n))).replace(/&(lt|gt|amp|quot|apos|nbsp);/g, (_, n) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' })[n]);
const length = c => Array.from(visible(c)).length;
const out = [];
const add = (key, track, kind, choices, answers, sample) => {
  const lengths = choices.map(length), good = answers.map(i => lengths[i]), bad = lengths.filter((_, i) => !answers.includes(i));
  if (!good.length || !bad.length) return;
  // Decision practice samples four wrong leaves. Count the exact probability
  // that every sampled distractor is shorter/longer than the answer.
  const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i; return n < k ? 0 : r; };
  const probability = eligible => sample ? choose(eligible, Math.min(sample, bad.length)) / choose(bad.length, Math.min(sample, bad.length)) : Number(eligible === bad.length);
  const longest = probability(bad.filter(n => Math.min(...good) >= 1.15 * n).length);
  const shortest = probability(bad.filter(n => Math.max(...good) <= 0.85 * n).length);
  out.push({ key, track, kind, lengths, answers, longest, shortest, flag: longest ? 'LONGEST' : shortest ? 'shortest' : '', choices });
};
KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => {
  const question = (q, w) => q && q.choices && add(l.id + '|' + w, tr.id, 'mcq', q.choices, [q.answer]);
  l.stages.forEach((s, si) => {
    if (['quiz', 'render', 'triage'].includes(s.type)) (s.questions || []).forEach((q, j) => question(q, 's' + si + 'q' + j));
    if (s.type === 'flow') s.steps.forEach((x, j) => x.ask && question(x.ask, 's' + si + 'flow' + j));
    if (s.type === 'slider' && s.quiz) question(s.quiz, 's' + si + 'slider');
    if (s.type === 'docker') question(s.observe, 's' + si + 'docker');
    if (s.type === 'incident') Object.entries(s.nodes).forEach(([id, n]) => {
      if (n.choices) add(l.id + '|s' + si + '|' + id, tr.id, 'incident', n.choices.map(c => c.t), n.choices.map((c, i) => c.good ? i : -1).filter(i => i >= 0));
    });
  });
  (l.interview.questions || []).forEach((q, j) => question(q, 'iv' + j));
}));
(KG.decisions || []).forEach(tree => {
  const leaves = Object.entries(tree.nodes).filter(([, n]) => n.leaf);
  (tree.scenarios || []).forEach((s, i) => add(tree.id + '|scenario' + i, 'decision-dojo', 'decision', leaves.map(([, n]) => n.pick), [leaves.findIndex(([id]) => id === s.answer)], 4));
});
const args = process.argv.slice(2), positional = args.filter(x => !x.startsWith('--'));
const [mode, track] = positional, kindArg = args.find(x => x.startsWith('--kind=')), kind = kindArg ? kindArg.slice(7) : 'all';
if (!['all', 'mcq', 'incident', 'decision'].includes(kind)) throw Error('Use --kind=all|mcq|incident|decision');
const selected = out.filter(m => (kind === 'all' || m.kind === kind) && (!track || m.track === track));
if (args.includes('--json')) console.log(JSON.stringify(selected, null, 2));
else if (mode === 'list') selected.forEach(m => {
  if (m.flag) console.log(m.kind.padEnd(9), m.flag.padEnd(9), m.key.padEnd(30), JSON.stringify(m.lengths), m.kind === 'decision' ? 'expected=' + ((m.longest + m.shortest) * 100).toFixed(1) + '%' : '');
});
else {
  const by = {};
  selected.forEach(m => {
    const key = m.kind + '/' + m.track, b = (by[key] = by[key] || { n: 0, f: 0, long: 0, short: 0 });
    b.n++; b.f += m.longest + m.shortest; b.long += m.longest; b.short += m.shortest;
  });
  Object.entries(by).forEach(([k, v]) => console.log(k.padEnd(27), 'n=' + v.n, 'flagged=' + (100 * v.f / v.n).toFixed(1) + '%', 'long=' + v.long.toFixed(2), 'short=' + v.short.toFixed(2)));
}
