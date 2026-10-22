// Dev tool: MCQ "length bias" — sahi jawab sabse lamba/chhota dikhe to learner bina padhe guess kar leta hai.
//   node tools/mcq-bias.js            → har track ka % (clearly-longest = sahi ≥ 1.15× har galat option)
//   node tools/mcq-bias.js list beginner → flagged sawal (key, lengths) dikhao
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
const V = fs.readFileSync(path.join(DIR, 'validate.js'), 'utf8');
const stub = V.slice(V.indexOf('const noop'), V.indexOf('const FILES = ['));
const filesDecl = V.slice(V.indexOf('const FILES = ['), V.indexOf('const missing'));
const S = {};
eval(stub + filesDecl + "const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\\n'); eval(src + '; S.KG = KG;');");
const KG = S.KG, strip = c => String(c).replace(/<[^>]+>/g, '');
const out = [];
KG.tracks.forEach(tr => KG.levelsOf(tr).forEach(l => {
  const add = (q, w) => q && q.choices && out.push({ key: l.id + '|' + w, track: tr.id, q });
  l.stages.forEach((s, si) => {
    if (['quiz', 'render', 'triage'].includes(s.type)) (s.questions || []).forEach((q, j) => add(q, 's' + si + 'q' + j));
    if (s.type === 'flow') s.steps.forEach((x, j) => x.ask && add(x.ask, 's' + si + 'flow' + j));
    if (s.type === 'slider' && s.quiz) add(s.quiz, 's' + si + 'slider');
    if (s.type === 'docker') add(s.observe, 's' + si + 'docker');
  });
  (l.interview.questions || []).forEach((q, j) => q.choices && add(q, 'iv' + j));
}));
const [mode, track] = process.argv.slice(2);
const by = {};
out.forEach(m => {
  const L = m.q.choices.map(c => strip(c).length), c = L[m.q.answer], o = L.filter((_, i) => i !== m.q.answer);
  const flag = c >= 1.15 * Math.max(...o) ? 'LONGEST' : c <= 0.85 * Math.min(...o) ? 'shortest' : '';
  const b = (by[m.track] = by[m.track] || { n: 0, f: 0 }); b.n++; if (flag) b.f++;
  if (mode === 'list' && flag && (!track || m.track === track)) console.log(flag.padEnd(9), m.key.padEnd(28), JSON.stringify(L));
});
if (mode !== 'list') Object.entries(by).forEach(([k, v]) => console.log(k.padEnd(13), 'n=' + v.n, 'flagged ' + Math.round(100 * v.f / v.n) + '%'));
