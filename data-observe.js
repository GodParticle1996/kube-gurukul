/* =====================================================================
   KubeGurukul — Track: 📈 Observability & Autoscaling Gurukul  (2026-11)
   "Kuch toota hai — kaise pata chalega, kahan toota hai, aur load badhe toh kaun sambhalega?"

   Kahani wahi company: ChaiPay (pay-api, ledger, notify). Monitoring stack:
     Prometheus (metrics) + Alertmanager (alerts) + Grafana (dashboard),  Helm release ka naam: kps
     Loki (logs) + OpenTelemetry/Tempo (traces)
   Scenes isi file mein hain (VISUALS[...] = …).
   ===================================================================== */
(function () {

/* ------------------------------------------------------------------ */
/* LEVEL 1 — Prometheus metrics                                        */
/* ------------------------------------------------------------------ */
VISUALS['ob-metrics'] = {
  t: 'Prometheus — number pod se graph tak kaise pahunchta hai',
  scene: {
    intro: '<b>Sawal:</b> Grafana par <code>pay-api</code> ka graph khaali hai. Number raaste mein kahan atak sakta hai?',
    aria: 'Prometheus ka scrape raasta: pod, Service, ServiceMonitor, Prometheus, Grafana — 6 kadam',
    nodes: [
      { id: 'pod', col: 0, row: 0, icon: '📦', label: 'pod: pay-api', sub: '/metrics par number', tone: 'good', about: 'App khud apne number ek HTTP page par rakhti hai: <code>/metrics</code>. Jaise <code>http_requests_total 18442</code>.' },
      { id: 'svc', col: 1, row: 0, icon: '📞', label: 'Service: pay-api', sub: 'label app=pay-api', about: 'Wahi Service jo traffic ke liye hai. ServiceMonitor is Service ko label se dhoondhta hai.' },
      { id: 'sm', col: 2, row: 0, icon: '🔎', label: 'ServiceMonitor', sub: 'kise scrape karna hai', tone: 'gold', about: 'Ek chhota object jo Prometheus ko batata hai: kaun si Service, kaun sa port, kitni der mein. ServiceMonitor khud kuch scrape nahi karta.' },
      { id: 'prom', col: 2, row: 1, icon: '🔥', label: 'Prometheus', sub: 'har 30 s mein poochhta hai', tone: 'accent', about: 'Prometheus khud pods ke paas jaakar <code>/metrics</code> padhta hai (pull). Pods Prometheus ko kuch nahi bhejte.' },
      { id: 'tsdb', col: 1, row: 1, icon: '🗄️', label: 'Time-series data', sub: 'number + samay', about: 'Har number samay ke saath likha jaata hai. Isi se "pichhle 5 minute mein kitna badha" nikalta hai.' },
      { id: 'graf', col: 0, row: 1, icon: '📊', label: 'Grafana', sub: 'PromQL se graph', about: 'Grafana Prometheus se PromQL mein sawal poochhta hai aur jawab ka graph banata hai.' },
    ],
    steps: [
      { at: ['pod'], say: '<b>pod: pay-api</b> apne number ek page par rakhta hai: <code>GET /metrics</code>. pod kisi ko kuch bhejta nahi — bas page taiyaar rakhta hai.' },
      { from: 'sm', to: 'svc', label: 'selector: app=pay-api', tone: 'gold', say: '<b>ServiceMonitor</b> label se <b>Service: pay-api</b> ko chunta hai, aur batata hai ki Service ke kis port par <code>/metrics</code> hai.' },
      { from: 'prom', to: 'sm', label: 'release=kps wale chuno', say: '<b>Prometheus</b> har ServiceMonitor ko nahi padhta. Prometheus sirf woh ServiceMonitors chunta hai jin par ek khaas label hai (ChaiPay mein <code>release: kps</code>). Label na ho toh ServiceMonitor nazarandaz ho jaata hai — <b>bina kisi error ke</b>.' },
      { from: 'prom', to: 'pod', label: 'GET /metrics', bend: 40, say: '<b>Prometheus</b> ko ab pata hai kise scrape karna hai. Prometheus har 30 second mein seedha <b>pod: pay-api</b> ke paas jaata hai aur <code>/metrics</code> padhta hai. Is jodi ko <b>target</b> kehte hain.' },
      { from: 'prom', to: 'tsdb', label: 'number + samay', say: '<b>Prometheus</b> har number ko samay ke saath <b>Time-series data</b> mein likhta hai.' },
      { from: 'graf', to: 'tsdb', label: 'PromQL', tone: 'good', say: '<b>Grafana</b> PromQL se poochhta hai, jaise <code>rate(http_requests_total[5m])</code>, aur graph banata hai. Graph khaali ho toh ulta chalo: target hai? → ServiceMonitor chuna gaya? → Service ka label mila?' },
    ],
  },
};

const T_METRICS = [
  { text: 'Prometheus ke targets dekho (<code>bash show-targets.sh</code>) — kya pay-api list mein hai?', check: s => !!s.cluster.sawTargets },
  { text: '<code>pay-api</code> ke ServiceMonitor ka <code>describe</code> padho — us par kaun se labels hain?', check: s => s.history.some(h => /^kubectl describe (servicemonitors?|smon)[ \/]pay-api\b/.test(h)) },
  { text: 'Dekho Prometheus kaun se ServiceMonitors chunta hai (<code>kubectl get prometheus kps -o yaml</code>)', check: s => s.history.some(h => /^kubectl get prometheus(es)?[ \/]kps\b.*-o ?yaml/.test(h)) },
  { text: 'ServiceMonitor theek karo', check: s => !!s.cluster.smFixed },
  { text: 'Targets dobara dekho — pay-api ke teeno pods <code>up</code> hone chahiye', check: s => !!s.cluster.verified },
];
const smDescribe = fixed => `Name:         pay-api\nNamespace:    payments\nLabels:       app=pay-api${fixed ? '\n              release=kps' : ''}\nKind:         ServiceMonitor\nSpec:\n  Endpoints:\n    Interval:  30s\n    Path:      /metrics\n    Port:      http\n  Selector:\n    Match Labels:\n      app:  pay-api${fixed ? '' : '\n(Labels wali line dhyaan se dekho. ledger ke ServiceMonitor se milao: kubectl describe servicemonitor ledger)'}`;

/* ------------------------------------------------------------------ */
/* LEVEL 2 — alerts & SLO                                              */
/* ------------------------------------------------------------------ */
VISUALS['ob-alerts'] = {
  t: 'Alert ka safar — number se pager tak',
  scene: {
    intro: '<b>Sawal:</b> raat 3 baje phone kab bajna chahiye — aur kab nahi?',
    aria: 'alert ka raasta: Prometheus rule, pending, firing, Alertmanager, route, pager — 6 kadam',
    nodes: [
      { id: 'rule', col: 0, row: 0, icon: '📐', label: 'Alert rule', sub: 'PromQL + "for: 5m"', tone: 'accent', about: 'Prometheus ke andar ek niyam: "yeh PromQL sach ho, aur itni der tak sach rahe, toh alert". Jaise: error ratio > 1.44% for 5m.' },
      { id: 'pend', col: 1, row: 0, icon: '⏳', label: 'Pending', sub: 'sach hai, par abhi ruko', tone: 'gold', about: 'Shart sach ho gayi, par <code>for:</code> ka samay poora nahi hua. 2 minute ki halchal yahin mar jaati hai — phone nahi bajta.' },
      { id: 'fire', col: 2, row: 0, icon: '🔥', label: 'Firing', sub: '5 min se sach hai', tone: 'bad', about: 'Shart <code>for:</code> ke poore samay tak sach rahi. Prometheus ab alert ko Alertmanager ko bhejta hai.' },
      { id: 'am', col: 2, row: 1, icon: '📮', label: 'Alertmanager', sub: 'jodo · daba do · raasta do', about: 'Alertmanager teen kaam karta hai: milte-julte alerts ko ek mein <b>jodna</b> (grouping), kam zaroori ko <b>dabana</b> (inhibition/silence), aur sahi team ko <b>bhejna</b> (routing).' },
      { id: 'page', col: 1, row: 1, icon: '📟', label: 'Pager (on-call)', sub: 'severity: page', tone: 'bad', about: 'Insaan ko abhi jagana hai. Sirf tab, jab user ko dard ho raha ho aur kuch kiya ja sakta ho.' },
      { id: 'tick', col: 0, row: 1, icon: '🎫', label: 'Ticket / Slack', sub: 'severity: ticket', about: 'Zaroori hai, par subah tak ruk sakta hai. Jaise: disk 4 din mein bharegi.' },
    ],
    steps: [
      { at: ['rule'], say: '<b>Alert rule</b> har 30 second mein apna PromQL chalata hai. ChaiPay ka niyam: "pay-api ke fail hone wale requests ka hissa bahut zyada hai".' },
      { from: 'rule', to: 'pend', label: 'shart sach', tone: 'gold', say: 'Shart sach hui. Alert <b>Pending</b> mein jaata hai. Abhi kisi ko kuch nahi bheja gaya. Agar gadbad 2 minute mein khud theek ho jaye, alert yahin khatam.' },
      { from: 'pend', to: 'fire', label: '5 min tak sach', tone: 'bad', say: 'Shart poore 5 minute sach rahi. Alert <b>Firing</b> ho gaya. Prometheus alert ko Alertmanager ke paas bhejta hai.' },
      { from: 'fire', to: 'am', label: 'alert + labels', say: '<b>Alertmanager</b> ko alert milta hai, labels ke saath: <code>severity=page</code>, <code>team=payments</code>. Agar 40 pods ek saath alert bhejen, Alertmanager unhe <b>ek</b> sandesh mein jod deta hai.' },
      { from: 'am', to: 'page', label: 'severity=page', tone: 'bad', say: 'Label <code>severity=page</code> hai, toh <b>Alertmanager</b> on-call insaan ka <b>Pager</b> bajata hai. Page ka matlab: user ko abhi dard hai.' },
      { from: 'am', to: 'tick', label: 'severity=ticket', bend: 30, say: 'Label <code>severity=ticket</code> hota toh wahi <b>Alertmanager</b> alert ko <b>Ticket / Slack</b> mein daalta. Koi nahi jagta. Raasta alert ke label se tay hota hai — isliye label sahi lagana alert likhne jitna hi zaroori hai.' },
    ],
  },
};
const SLOS = [99, 99.5, 99.9, 99.99];
const burn = (errPct, slo) => errPct / (100 - slo);

KG.registerLevels('observe', [
  /* ================================================================== */
  {
    id: 'ob-metrics',
    icon: '🔥',
    title: 'Prometheus — number kahan se aate hain, aur graph khaali kyun hai',
    badge: 'Metric Mistri',
    objectives: [
      'Prometheus ka <b>pull</b> model: Prometheus khud pods se number padhta hai',
      'Teen tarah ke metric: counter, gauge, histogram',
      'PromQL ke do sabse kaam ke roop: <code>rate()</code> aur error ka hissa',
      '"Grafana mein No data" ko raaste ke har padav par jaanchna (terminal)',
    ],
    lesson: [
      `<h3>🩺 Misaal: doctor ka round</h3>
       <p>Aspataal mein mareez doctor ke paas report lekar nahi daudte. <b>Doctor har bistar par jaakar chart padhta hai.</b></p>
       <p>Prometheus bhi aisa hi hai:</p>
       <ul>
         <li>Har pod apne number ek page par rakhta hai: <code>/metrics</code> (bistar ka chart).</li>
         <li><b>Prometheus</b> har 30 second mein pod ke paas jaakar page padhta hai (round). Isko <b>scrape</b> kehte hain.</li>
         <li>Jis pod ko Prometheus padhta hai, use <b>target</b> kehte hain.</li>
       </ul>
       <p><b>Asli baat:</b> pod Prometheus ko kuch nahi bhejta. Agar Prometheus ko pata hi na ho ki pod maujood hai, toh graph khaali rahega — aur <b>koi error nahi aayega</b>.</p>
       <p>Prometheus ko "kise padhna hai" batane wala object: <b>ServiceMonitor</b>.</p>`,
      `<h3>🔢 Teen tarah ke number</h3>
       <table>
         <tr><th>Type</th><th>Kaisa chalta hai</th><th>Misaal</th></tr>
         <tr><td><b>Counter</b></td><td>Sirf <b>badhta</b> hai (restart par 0)</td><td><code>http_requests_total</code></td></tr>
         <tr><td><b>Gauge</b></td><td>Upar-neeche dono</td><td><code>memory_usage_bytes</code>, queue ki lambai</td></tr>
         <tr><td><b>Histogram</b></td><td>Kitne requests kitne samay mein — dabbon (buckets) mein</td><td><code>request_duration_seconds_bucket</code></td></tr>
       </table>
       <p><b>Counter ka jaal:</b> counter ka seedha number bekaar hai ("18,442 requests" — kab se?). Counter par hamesha <code>rate()</code> lagao:</p>
       <pre>rate(http_requests_total[5m])        # pichhle 5 min mein prati second kitne requests</pre>
       <p><b>Sabse kaam ka sawal — kitne pratishat requests fail ho rahe hain:</b></p>
       <pre>sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))</pre>`,
      `<h3>🚦 Chaar number jo har service ke liye dekhne hain</h3>
       <p>Google ki SRE team inhe "four golden signals" kehti hai:</p>
       <table>
         <tr><th>Signal</th><th>Sawal</th><th>Metric type</th></tr>
         <tr><td><b>Traffic</b></td><td>Kitne requests aa rahe hain?</td><td>counter + rate()</td></tr>
         <tr><td><b>Errors</b></td><td>Kitne fail ho rahe hain?</td><td>counter + rate()</td></tr>
         <tr><td><b>Latency</b></td><td>Kitna samay lag raha hai? (p99)</td><td>histogram</td></tr>
         <tr><td><b>Saturation</b></td><td>Kitna bhar chuka hai? (CPU, memory, queue)</td><td>gauge</td></tr>
       </table>
       <p><b>Label ka jaal:</b> metric ke label mein kabhi <code>user_id</code> ya <code>txn_id</code> mat daalo.
       Har alag value ek alag time-series banati hai. 10 lakh users = 10 lakh series = Prometheus ki memory khatam.</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Counter, gauge ya histogram?',
        instructions: 'Har number ko sahi type ke dabbe mein daalo. Socho: yeh number sirf badhta hai, upar-neeche hota hai, ya "kitna samay laga" ka bantwara hai?',
        bins: [
          { id: 'c', label: '➕ Counter (sirf badhta hai)' },
          { id: 'g', label: '↕️ Gauge (upar-neeche)' },
          { id: 'h', label: '📊 Histogram (samay ke dabbe)' },
        ],
        items: [
          { text: 'Ab tak kul kitne payments aaye', bin: 'c', explain: 'Kul ginti sirf badhti hai. PromQL mein hamesha rate() ke saath.' },
          { text: 'notify ki queue mein abhi kitne SMS pade hain', bin: 'g', explain: 'Queue bharti bhi hai, khaali bhi hoti hai → gauge.' },
          { text: 'Har payment ko poora hone mein kitna samay laga', bin: 'h', explain: 'Samay ka bantwara → histogram. Isi se p99 nikalta hai: histogram_quantile(0.99, …).' },
          { text: 'Ab tak kul kitne payments fail hue', bin: 'c', explain: 'Fail hone ki kul ginti bhi sirf badhti hai. Error ka hissa = fail ka rate / kul ka rate.' },
          { text: 'pay-api pod abhi kitni memory le raha hai', bin: 'g', explain: 'Memory badhti-ghatti hai → gauge. rate() lagana galat hoga.' },
          { text: 'ledger ko har query mein kitne millisecond lage', bin: 'h', explain: 'Phir se samay ka bantwara. Average mat dekho — ek dheemi query average mein chhup jaati hai.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Grafana mein "No data"',
        instructions: 'pay-api ka naya version do din pehle deploy hua. Tab se Grafana ke pay-api dashboard par "No data" hai. App theek chal rahi hai.',
        goal: `<b>pay-api</b> ke metrics Prometheus tak nahi pahunch rahe. Raaste ko ulta jaancho: <b>target</b> hai? → <b>ServiceMonitor</b> chuna gaya? → theek karo → targets dobara dekho.<br>
          Prometheus ke targets dekhne ka tool: <code>bash show-targets.sh</code> (file mein asli commands likhe hain: <code>cat show-targets.sh</code>).`,
        tasks: T_METRICS,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '2d', node: 'node-1', ip: '10.244.1.20', logs: 'level=info msg="pay-api listening" port=8080\nlevel=info msg="metrics on /metrics"' },
            { name: 'pay-api-6b8d7c-b2', ready: '1/1', status: 'Running', restarts: 0, age: '2d', node: 'node-1', ip: '10.244.1.21', logs: 'level=info msg="pay-api listening" port=8080\nlevel=info msg="metrics on /metrics"' },
            { name: 'pay-api-6b8d7c-c3', ready: '1/1', status: 'Running', restarts: 0, age: '2d', node: 'node-1', ip: '10.244.1.22', logs: 'level=info msg="pay-api listening" port=8080\nlevel=info msg="metrics on /metrics"' },
            { name: 'ledger-0', ready: '1/1', status: 'Running', restarts: 0, age: '9d', node: 'node-1', ip: '10.244.1.30' },
            { name: 'prometheus-kps-0', ready: '2/2', status: 'Running', restarts: 0, age: '9d', node: 'node-1', ip: '10.244.1.40' },
          ],
          services: [
            { name: 'pay-api', type: 'ClusterIP', clusterIP: '10.96.11.3', ports: '8080/TCP', age: '40d', describe: 'Name:        pay-api\nLabels:      app=pay-api\nSelector:    app=pay-api\nPort:        http  8080/TCP\nEndpoints:   10.244.1.20:8080,10.244.1.21:8080,10.244.1.22:8080' },
            { name: 'ledger', type: 'ClusterIP', clusterIP: '10.96.14.7', ports: '8080/TCP', age: '40d' },
          ],
          custom: {
            servicemonitor: {
              names: ['servicemonitor', 'servicemonitors', 'smon'], cols: ['NAME', 'AGE'],
              items: [
                { name: 'ledger', row: ['40d'], describe: 'Name:         ledger\nNamespace:    payments\nLabels:       app=ledger\n              release=kps\nKind:         ServiceMonitor\nSpec:\n  Endpoints:\n    Interval:  30s\n    Path:      /metrics\n    Port:      http\n  Selector:\n    Match Labels:\n      app:  ledger' },
                { name: 'pay-api', row: ['2d'], describe: smDescribe(false) },
              ],
            },
            prometheus: {
              names: ['prometheus', 'prometheuses'], cols: ['NAME', 'VERSION', 'DESIRED', 'READY', 'AGE'],
              items: [{ name: 'kps', row: ['v3.5.0', '1', '1', '9d'],
                describe: 'Name:  kps\nSpec:\n  Service Monitor Selector:\n    Match Labels:\n      Release:  kps',
                yaml: 'apiVersion: monitoring.coreos.com/v1\nkind: Prometheus\nmetadata:\n  name: kps\n  namespace: monitoring\nspec:\n  replicas: 1\n  scrapeInterval: 30s\n  serviceMonitorNamespaceSelector: {}      # saare namespaces\n  serviceMonitorSelector:\n    matchLabels:\n      release: kps                         # <-- sirf yeh label wale ServiceMonitor chune jaate hain' }],
            },
          },
        },
        responses: [],
        files: {
          'show-targets.sh': {
            desc: 'Prometheus ke active targets dikhata hai (job, kitne pods up)',
            content: '#!/bin/sh\n# Prometheus ka UI/API cluster ke andar hai — port-forward se laptop par lao\nkubectl -n monitoring port-forward svc/prometheus-operated 9090 >/dev/null &\nsleep 2\n# har target ka job aur health nikaalo\ncurl -s localhost:9090/api/v1/targets \\\n  | jq -r \'.data.activeTargets[] | [.labels.job, .labels.pod, .health] | @tsv\'\n# (browser mein: http://localhost:9090/targets)',
            apply: s => {
              const c = s.cluster;
              c.sawTargets = true;
              if (c.smFixed) c.verified = true;
              return 'JOB       POD                  HEALTH\nledger    ledger-0             up\n' +
                (c.smFixed ? 'pay-api   pay-api-6b8d7c-a1    up\npay-api   pay-api-6b8d7c-b2    up\npay-api   pay-api-6b8d7c-c3    up\n(pay-api ke teeno pods ab targets hain — 30 second mein Grafana par graph aa jayega)'
                           : '(pay-api ka ek bhi target nahi hai. "down" bhi nahi — list mein hai hi nahi. Matlab: Prometheus ko pata hi nahi ki pay-api ko scrape karna hai.)');
            },
          },
          'fix-servicemonitor-label.yaml': {
            desc: 'pay-api ke ServiceMonitor par label release: kps jodta hai',
            content: 'apiVersion: monitoring.coreos.com/v1\nkind: ServiceMonitor\nmetadata:\n  name: pay-api\n  namespace: payments\n  labels:\n    app: pay-api\n    release: kps        # <-- yeh label naye chart mein chhoot gaya tha\nspec:\n  selector:\n    matchLabels:\n      app: pay-api\n  endpoints:\n    - port: http\n      path: /metrics\n      interval: 30s',
            apply: s => {
              const c = s.cluster;
              c.smFixed = true;
              c.custom.servicemonitor.items.find(x => x.name === 'pay-api').describe = smDescribe(true);
              return 'servicemonitor.monitoring.coreos.com/pay-api configured\n(ab targets dobara dekho: bash show-targets.sh)';
            },
          },
          'fix-restart-prometheus.yaml': {
            desc: 'Prometheus pod ko restart karta hai',
            apply: () => 'pod "prometheus-kps-0" restarted\n(kuch nahi badla. Prometheus restart ke baad bhi wahi ServiceMonitors chunta hai jin par release=kps hai. pay-api ka ServiceMonitor ab bhi nazarandaz hai.)',
          },
          'fix-pod-annotations.yaml': {
            desc: 'pay-api pods par prometheus.io/scrape: "true" annotation jodta hai',
            apply: () => 'deployment.apps/pay-api configured\n(kuch nahi badla. prometheus.io/scrape wale annotations sirf purane, haath se likhe scrape config mein kaam karte hain. Is cluster ka Prometheus Operator se chalta hai — Operator sirf ServiceMonitor/PodMonitor dekhta hai.)',
          },
        },
        success: KG.allOf(T_METRICS),
        successText: `Raasta ulta jaancha: <b>target</b> list mein tha hi nahi → matlab Prometheus ne ServiceMonitor chuna hi nahi → <code>kubectl get prometheus kps -o yaml</code> ne bataya ki Prometheus sirf <code>release: kps</code> label wale ServiceMonitors chunta hai → pay-api ke ServiceMonitor par woh label nahi tha.
          <b>Yaad rakho:</b> monitoring ki sabse aam kharabi <b>chup</b> hoti hai. Koi error nahi, koi "down" nahi — bas number nahi aate. Isliye "No data" dikhe toh sabse pehle targets ki list dekho.`,
        hints: [
          'bash show-targets.sh chalao. pay-api list mein hai? Phir kubectl get servicemonitor aur kubectl describe servicemonitor pay-api.',
          'ledger ka ServiceMonitor kaam kar raha hai. kubectl describe servicemonitor ledger se Labels milao. Phir kubectl get prometheus kps -o yaml mein serviceMonitorSelector dekho.',
          'pay-api ke ServiceMonitor par release=kps label nahi hai. kubectl apply -f fix-servicemonitor-label.yaml, phir bash show-targets.sh.',
        ],
        solution: [
          'bash show-targets.sh',
          'kubectl get servicemonitor',
          'kubectl describe servicemonitor pay-api',
          'kubectl describe servicemonitor ledger',
          'kubectl get prometheus kps -o yaml',
          'kubectl apply -f fix-servicemonitor-label.yaml',
          'bash show-targets.sh',
        ],
      },
      {
        type: 'fill',
        title: 'PromQL: kitne pratishat payments fail ho rahe hain?',
        instructions: 'pay-api ke fail hone wale requests ka hissa nikaalo, pichhle 5 minute ka. Tokens ko khaali jagah mein rakho.',
        template: 'sum({0}(http_requests_total{job="pay-api", status=~"{1}"}[{2}]))\n  /\nsum(rate(http_requests_total{job="pay-api"}[5m]))',
        blanks: [
          { answer: 'rate', explain: 'http_requests_total ek counter hai. Counter par hamesha rate() — "prati second kitna badha".' },
          { answer: '5..', explain: 'status=~"5.." ka matlab: 5 se shuru hone wala teen ank ka code (500, 502, 503…). =~ regex match hai.' },
          { answer: '5m', explain: '[5m] = pichhle 5 minute ki khidki. Upar aur neeche dono jagah ek hi khidki honi chahiye.' },
        ],
        tokens: ['rate', '5..', '5m', 'sum', '2..', 'max', '30d'],
      },
    ],
    interview: {
      title: 'Interview Round — metrics',
      instructions: 'Interviewer jaanna chahta hai ki tum monitoring ko "dashboard dekhna" se aage samajhte ho. 🎤',
      questions: [
        {
          q: '"Prometheus pull model use karta hai. Iska kya matlab hai, aur isse kaun si galti chupchaap ho jaati hai?"',
          choices: [
            'Pods apne metrics Prometheus ko bhejte hain; galti tab hoti hai jab pod ka network band ho aur error log mein aata hai',
            'Prometheus khud targets se /metrics padhta hai; target list mein na ho toh number nahi aate aur koi error bhi nahi aata',
            'Prometheus metrics ko Grafana se kheenchta hai; galti tab hoti hai jab Grafana ka datasource galat ho',
            'Prometheus har pod ke logs padhkar number banata hai; galti tab hoti hai jab log ka format badal jaye',
          ],
          answer: 1,
          explain: 'Pull ka faayda: Prometheus ko pata hota hai ki target zinda hai ya nahi (up metric). Pull ka jaal: jo target kabhi list mein aaya hi nahi, uske liye na "down" hai na error. Isliye naye service ke baad targets ki list jaanchna aadat banao.',
        },
        {
          q: '"http_requests_total ka graph seedha lagaya toh ek hi line upar jaati dikhti hai. Kya galat hai?"',
          choices: [
            'Kuch galat nahi; counter ka graph aisa hi dikhta hai aur usi se traffic samjha jaata hai',
            'Metric gauge hona chahiye tha; counter ko Grafana graph nahi kar sakta',
            'Counter sirf badhta hai; traffic dekhne ke liye rate(http_requests_total[5m]) lagana hota hai',
            'Scrape interval bahut chhota hai; 5 minute kar dene se line seedhi ho jayegi',
          ],
          answer: 2,
          explain: 'Counter kul ginti hai. Kaam ka sawal hai "prati second kitne" — woh rate() deta hai. rate() counter ke restart (0 par lautna) ko bhi sambhal leta hai.',
        },
        {
          q: '"Ek developer ne metric mein user_id ka label jod diya. Tum kyun rokoge?"',
          choices: [
            'user_id niji jaankari hai; Prometheus mein niji jaankari rakhna kanoonan mana hai, isi wajah se',
            'Label ki value 63 akshar se lambi nahi ho sakti, aur user_id aksar lamba hota hai',
            'Har alag user_id ek nayi time-series banata hai; lakhon series se Prometheus ki memory bhar jaati hai',
            'Label sirf Kubernetes objects par lagte hain; metric par label lagane se scrape fail hota hai',
          ],
          answer: 2,
          explain: 'Isko "cardinality explosion" kehte hain. Label ki values ginti ki honi chahiye (status code, method, service). Har user ya har transaction ki jaankari logs aur traces mein jaati hai, metrics mein nahi.',
        },
      ],
    },
    success: [
      'Main Prometheus ka scrape raasta (pod → Service → ServiceMonitor → Prometheus) samjha sakta hoon',
      'Main "No data" ko targets ki list se shuru karke debug kar sakta hoon',
      'Main counter par rate() aur error ka hissa nikaalne wala PromQL likh sakta hoon',
    ],
    homework: `<p>Asli cluster par (kube-prometheus-stack laga ho toh):</p>
      <pre>kubectl get servicemonitor -A
kubectl get prometheus -A -o yaml | grep -A4 serviceMonitorSelector
kubectl -n monitoring port-forward svc/prometheus-operated 9090   # phir http://localhost:9090/targets</pre>`,
    cards: [
      { front: 'Prometheus ka "pull" model kya hai?', back: 'Prometheus khud har target ke <code>/metrics</code> page ko padhta hai (scrape), har ~30 s. Pod kuch nahi bhejta.' },
      { front: 'Grafana mein "No data". Pehli jaanch?', back: 'Prometheus ke <b>targets</b> ki list. Target hai hi nahi → ServiceMonitor chuna nahi gaya (label) ya Service ka label/port nahi mila.' },
      { front: 'Counter par kaun sa function lagta hai, aur kyun?', back: '<code>rate(x_total[5m])</code>. Counter kul ginti hai jo sirf badhti hai; rate() "prati second kitna badha" deta hai.' },
      { front: 'Error ka hissa nikaalne wala PromQL?', back: '<code>sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))</code>' },
      { front: 'Metric ke label mein user_id kyun nahi?', back: 'Har alag value ek nayi time-series. Lakhon series = Prometheus ki memory khatam (cardinality explosion).' },
    ],
  },

  /* ================================================================== */
  {
    id: 'ob-alerts',
    icon: '📟',
    title: 'Alerts aur SLO — phone kab baje, kab nahi',
    badge: 'Alert Adhikari',
    objectives: [
      'Alert <b>lakshan</b> par (user ka dard), <b>wajah</b> par nahi (CPU 80%)',
      'SLO aur <b>error budget</b>: 99.9% ka matlab mahine mein 43 minute',
      '<b>Burn rate</b>: budget kitni tezi se jal raha hai',
      'Aisa alert banana jo tez aag par page kare aur halki gadbad par nahi (slider)',
    ],
    lesson: [
      `<h3>🚒 Misaal: aag ka alarm</h3>
       <p>Ghar ka alarm <b>dhuen</b> par bajta hai — "gas ka chulha jal raha hai" par nahi. Chulha roz jalta hai.</p>
       <p>Alert ka bhi yahi niyam:</p>
       <table>
         <tr><th>Alert</th><th>Kis par hai</th><th>Raat 3 baje jagana?</th></tr>
         <tr><td>"pay-api ke 3% payments fail ho rahe hain"</td><td><b>Lakshan</b> — user ko dard</td><td>✅ haan</td></tr>
         <tr><td>"node-2 ka CPU 85% hai"</td><td><b>Wajah</b> — shayad kuch na ho</td><td>❌ nahi (dashboard)</td></tr>
       </table>
       <p><b>Asli baat:</b> jo alert baar-baar jhootha bajta hai, use log band kar dete hain. Phir sachche alert par bhi koi nahi uthta.
       Isko <b>alert fatigue</b> kehte hain. Har page ke liye poochho: "kya user ko abhi dard hai, aur kya main kuch kar sakta hoon?"</p>`,
      `<h3>🎯 SLO aur error budget</h3>
       <p><b>SLO</b> = waada. ChaiPay ka waada: "30 din mein <b>99.9%</b> payments safal honge".</p>
       <p>Ulta padho: <b>0.1% fail ho sakte hain</b>. Yahi <b>error budget</b> hai.</p>
       <table>
         <tr><th>SLO</th><th>30 din mein kitna fail "allowed"</th></tr>
         <tr><td>99%</td><td>7.2 ghante</td></tr>
         <tr><td>99.9%</td><td><b>43 minute</b></td></tr>
         <tr><td>99.99%</td><td>4.3 minute</td></tr>
       </table>
       <p><b>Budget kyun?</b> 100% ka waada namumkin hai, aur har "9" bahut mehenga hai. Budget bacha ho toh naye features deploy karo.
       Budget khatam ho toh deploy roko aur bharosa theek karo. Budget ek <b>number</b> hai jis par dev aur ops dono sehmat ho sakte hain.</p>`,
      `<h3>🔥 Burn rate: budget kitni tezi se jal raha hai</h3>
       <p><b>Burn rate = abhi ka error % ÷ budget %.</b></p>
       <p>SLO 99.9% (budget 0.1%) par:</p>
       <table>
         <tr><th>Abhi kitne % fail</th><th>Burn rate</th><th>30 din ka budget kab khatam</th><th>Kya karein</th></tr>
         <tr><td>0.1%</td><td>1</td><td>30 din mein</td><td>Theek</td></tr>
         <tr><td>0.15%</td><td>1.5</td><td>20 din mein</td><td>🎫 Ticket — subah dekho</td></tr>
         <tr><td>2%</td><td>20</td><td>36 ghante mein</td><td>📟 Page — abhi utho</td></tr>
       </table>
       <p>Achha alert do cheezein milata hai: <b>burn rate kitna hai</b> aur <b>kitni der se hai</b> (<code>for: 5m</code>).
       2 minute ki halchal par mat jagao. 15 minute se zyada der bhi mat karo.</p>`,
    ],
    stages: [
      {
        type: 'bins',
        title: 'Page, ticket, ya sirf dashboard?',
        instructions: 'Har alert ke liye socho: user ko abhi dard hai? Kuch kiya ja sakta hai? Subah tak ruk sakta hai?',
        bins: [
          { id: 'page', label: '📟 Page (abhi jagao)' },
          { id: 'ticket', label: '🎫 Ticket (subah dekho)' },
          { id: 'dash', label: '📊 Sirf dashboard (alert nahi)' },
        ],
        items: [
          { text: 'pay-api ke 4% payments 10 minute se fail ho rahe hain', bin: 'page', explain: 'User ka seedha dard, abhi, aur lagataar. Yahi page ka kaam hai.' },
          { text: 'ledger ki disk 4 din mein bhar jayegi', bin: 'ticket', explain: 'Zaroori hai, par 4 din hain. Raat ko jagane ki zaroorat nahi — subah ka ticket.' },
          { text: 'node-2 ka CPU 85% hai, par latency aur errors theek hain', bin: 'dash', explain: 'Wajah, lakshan nahi. User ko koi dard nahi. CPU 85% ka matlab bas itna hai ki node kaam kar raha hai.' },
          { text: 'pay-api ka p99 latency 15 minute se 3 second hai (waada: 500 ms)', bin: 'page', explain: 'Dheema payment bhi toota payment hai — user ke liye. Latency ka lakshan page ke layak hai.' },
          { text: 'TLS certificate 12 din mein expire hoga', bin: 'ticket', explain: 'Abhi koi dard nahi, par kaam karna hi hai. Ticket — aur expire hone se 2 din pehle page.' },
          { text: 'Ek pay-api pod restart hua; baaki 5 pods chal rahe hain', bin: 'dash', explain: 'Kubernetes ne khud theek kar liya. Ek restart par jagaoge toh log alert band kar denge. Baar-baar restart ho aur errors badhen, tab lakshan wala alert bajega.' },
        ],
      },
      {
        type: 'slider',
        title: '🎚️ Lab: aisa alert jo sirf sachchi aag par baje',
        instructions: 'Teen knob ghumao. Neeche teen haalaat likhe hain — har haalat mein alert ko sahi kaam karna hai.',
        scenario: `ChaiPay ke pay-api ka alert tumhe banana hai. Alert teen haalaat mein parkha jayega:
          <ul><li>🔥 <b>Tez aag:</b> 2% payments fail, lagataar</li>
          <li>🕯️ <b>Halki gadbad:</b> 0.15% payments fail, lagataar</li>
          <li>⚡ <b>Halchal:</b> 3 minute ke liye 5% fail, phir khud theek</li></ul>`,
        goal: 'SLO ko ChaiPay ke waade (99.9%) par rakho. Phir threshold aur "for" aise chuno ki: tez aag par page aaye (15 minute ke andar), halki gadbad par page NA aaye, aur 3 minute ki halchal par page NA aaye.',
        knobs: [
          { id: 'slo', label: 'SLO (waada)', min: 0, max: 3, step: 1, value: 0, fmt: v => SLOS[v] + '%' },
          { id: 'thr', label: 'Page ka threshold (burn rate)', min: 1, max: 30, step: 1, value: 1, unit: '×' },
          { id: 'dur', label: 'for: (kitni der tak sach rahe)', min: 0, max: 30, step: 1, value: 0, unit: ' min' },
        ],
        readouts: k => {
          const slo = SLOS[k.slo], fast = burn(2, slo), slow = burn(0.15, slo);
          const budgetMin = 30 * 24 * 60 * (100 - slo) / 100;
          return [
            { label: 'Error budget (30 din)', value: budgetMin >= 120 ? (budgetMin / 60).toFixed(1) + ' ghante' : budgetMin.toFixed(1) + ' min', state: k.slo === 2 ? 'good' : 'warn',
              hint: k.slo === 2 ? 'ChaiPay ka waada 99.9% hai ✓' : 'ChaiPay ka waada 99.9% hai — SLO ko waade par rakho' },
            { label: '🔥 Tez aag (2% fail)', value: 'burn ' + fast.toFixed(1) + '× → ' + (fast >= k.thr ? 'PAGE' : 'chup'), state: fast >= k.thr && k.dur <= 15 ? 'good' : 'bad',
              hint: fast < k.thr ? 'threshold burn rate se upar hai → page nahi aayega' : k.dur > 15 ? `page ${k.dur} min baad aayega — bahut der` : `page ${k.dur} min baad` },
            { label: '🕯️ Halki gadbad (0.15%)', value: 'burn ' + slow.toFixed(1) + '× → ' + (slow >= k.thr ? 'PAGE' : 'chup'), state: slow >= k.thr ? 'bad' : 'good',
              hint: slow >= k.thr ? 'raat ko jagana pada — is haalat ke liye ticket kaafi tha' : 'page nahi (ticket wala alert alag se sambhalega)' },
            { label: '⚡ Halchal (3 min, 5%)', value: burn(5, slo) >= k.thr && k.dur < 3 ? 'PAGE' : 'chup', state: burn(5, slo) >= k.thr && k.dur < 3 ? 'bad' : 'good',
              hint: k.dur < 3 ? '"for" 3 minute se kam hai → halchal bhi page ban jaati hai' : 'halchal "for" se pehle khatam → page nahi' },
          ];
        },
        verdict: k => {
          const slo = SLOS[k.slo], fast = burn(2, slo), slow = burn(0.15, slo);
          if (k.slo !== 2) return { ok: false, text: `SLO ${slo}% ChaiPay ka waada nahi hai. SLO badalne se har burn rate badal jaata hai — pehle SLO ko 99.9% par rakho.` };
          if (slow >= k.thr) return { ok: false, text: 'Threshold bahut neeche hai: halki gadbad (burn 1.5×) par bhi raat ko phone bajega. Kuch hafton mein log is alert ko band kar denge.' };
          if (fast < k.thr) return { ok: false, text: 'Threshold bahut upar hai: 2% payments fail ho rahe hain (burn 20×) aur alert chup hai.' };
          if (k.dur < 3) return { ok: false, text: '"for" bahut chhota hai: 3 minute ki halchal, jo khud theek ho gayi, bhi page ban gayi.' };
          if (k.dur > 15) return { ok: false, text: '"for" bahut lamba hai: tez aag mein 15 minute se zyada chup rehna matlab budget ka bada hissa jal chuka.' };
          return { ok: true, text: 'Alert teeno haalaat mein sahi hai: tez aag par page, halki gadbad par chup, halchal par chup.' };
        },
        check: k => { const fast = burn(2, 99.9), slow = burn(0.15, 99.9); return k.slo === 2 && slow < k.thr && fast >= k.thr && k.dur >= 3 && k.dur <= 15; },
        lesson: 'Do knob do alag galtiyon se bachate hain. <b>Threshold</b> "kitni badi aag" tay karta hai (halki gadbad ko alag rakhta hai). <b>for</b> "kitni der se" tay karta hai (halchal ko alag rakhta hai). Aur dhyaan do: SLO badalte hi wahi 2% error alag burn rate ban gaya — burn rate hamesha waade ke muqable mein hota hai.',
        quiz: {
          q: 'SLO 99.9% hai aur abhi 2% payments fail ho rahe hain. Burn rate kitna hai?',
          choices: ['2× — error 2% hai', '20× — 2% ÷ 0.1%', '0.2× — 0.1% ÷ 2% ka ulta', '200× — 2% × 100'],
          answer: 1,
          explain: 'Burn rate = abhi ka error % ÷ budget %. Budget = 100 − 99.9 = 0.1%. Toh 2 ÷ 0.1 = 20. Matlab budget 20 guna tezi se jal raha hai: 30 din ka budget 36 ghante mein khatam.',
        },
      },
      {
        type: 'match',
        bonus: true,
        title: 'Good to Know — Alertmanager ke chaar auzaar',
        instructions: 'Baayen problem hai, daayen Alertmanager ka woh auzaar jo us problem ko hal karta hai.',
        pairs: [
          { left: '40 pods ek saath crash hue aur 40 alag sandesh aaye', right: 'Grouping (group_by)', explain: 'Ek jaise labels wale alerts ek hi sandesh mein jud jaate hain. On-call ko 1 page milta hai, 40 nahi.' },
          { left: 'Poora node gir gaya; ab us node ke har pod ka alert bhi baj raha hai', right: 'Inhibition', explain: 'Bada alert (node down) chhote alerts (us node ke pods) ko daba deta hai. Wajah ek hi hai.' },
          { left: 'Aaj raat planned upgrade hai; alerts bajenge par sabko pata hai', right: 'Silence', explain: 'Tay samay ke liye chuninda alerts ko chup karna. Samay khatam hote hi silence khud hat jaata hai.' },
          { left: 'Payments ke alert database team ke pager par ja rahe hain', right: 'Routing (labels se)', explain: 'Alert ke labels (team, severity) tay karte hain ki sandesh kis receiver ko jayega.' },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — alerting aur SLO',
      instructions: 'SRE / platform role ke interview ka pasandida hissa. 🎤',
      questions: [
        {
          q: '"Tumhari team ko roz 60 alerts aate hain aur log unhe dekhte bhi nahi. Kya badloge?"',
          choices: [
            'Saare alerts ka threshold 10% badha dunga taaki ginti apne aap aadhi ho jaye',
            'Page sirf user ke dard wale lakshanon par; baaki ticket ya dashboard mein bhejunga',
            'Ek aur on-call insaan rakhunga taaki roz ke 60 alerts do logon mein barabar bant jayen',
            'Alerts ko email par bhej dunga; email mein log aaram se sab padh lete hain',
          ],
          answer: 1,
          explain: 'Alert fatigue ka ilaaj ginti kam karna nahi, <b>arth</b> badhana hai. Har page ke liye: user ko dard hai? kuch kiya ja sakta hai? Nahi → page nahi. Wajah wale alerts (CPU, ek pod ka restart) dashboard mein jaate hain.',
        },
        {
          q: '"SLO 99.9% hai. Error budget kya hai, aur budget khatam ho jaye toh kya hota hai?"',
          choices: [
            'Budget woh paisa hai jo monitoring par kharch hota hai; khatam hone par Prometheus band ho jaata hai',
            'Budget 99.9% uptime hai; khatam hone par cloud provider cluster ko kuch der rok deta hai',
            'Budget 0.1% fail hone ki chhoot hai (~43 min); khatam ho toh risky deploys rokte hain',
            'Budget alerts ki ginti hai; khatam hone par Alertmanager naye alerts bhejna band kar deta hai',
          ],
          answer: 2,
          explain: 'Error budget = 100% − SLO. Yeh ek sehmati ka number hai: budget bacha hai → features tezi se deploy karo. Budget khatam → naye risk roko. Isse "dev ko raftaar chahiye, ops ko shaanti" wali behes number par aa jaati hai.',
        },
        {
          q: '"\'Error rate > 1% for 1m\' wala alert kyun kharab hai, aur burn-rate alert behtar kyun hai?"',
          choices: [
            'Kharab nahi hai; 1% ek saaf number hai aur har service ke liye bilkul ek jaisa kaam karta hai',
            '1 minute ki khidki halchal par baj jaati hai; burn rate waade (SLO) ke muqable mein naapta hai',
            'Prometheus 1% jaise chhote number ko sahi nahi naap sakta; burn rate bade number deta hai',
            'for: 1m Alertmanager mein allowed nahi hai; kam se kam 5 minute rakhna padta hai',
          ],
          answer: 1,
          explain: 'Achha alert do sawal milata hai: kitna bura (waade ke muqable mein — burn rate) aur kitni der se (khidki / for). Aksar do alert hote hain: tez burn → page, dheema burn → ticket.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki kaun sa alert page hai, kaun sa ticket, aur kaun sa sirf dashboard',
      'Main SLO se error budget aur burn rate nikaal sakta hoon',
      'Main threshold aur "for" se aisa alert bana sakta hoon jo halchal par na baje',
    ],
    homework: `<p>Apni kisi ek service ke liye kaagaz par likho:</p>
      <pre>1. Waada (SLO) kya hai?          jaise: 99.9% requests safal, 30 din mein
2. Error budget kitna?            jaise: 0.1% = 43 minute
3. Page kab?                      jaise: burn rate 14× se upar, 5 min tak
4. Ticket kab?                    jaise: burn rate 1× se upar, 6 ghante tak</pre>`,
    cards: [
      { front: 'Alert lakshan par ho ya wajah par?', back: '<b>Lakshan</b> par (user ka dard: errors, latency). Wajah (CPU 85%, ek pod restart) dashboard mein.' },
      { front: 'SLO 99.9% ka error budget (30 din)?', back: '0.1% = lagbhag <b>43 minute</b>. (99% → 7.2 ghante, 99.99% → 4.3 minute.)' },
      { front: 'Burn rate ka formula?', back: 'Abhi ka error % ÷ budget %. SLO 99.9% par 2% errors = 2 ÷ 0.1 = <b>20×</b> (budget 36 ghante mein khatam).' },
      { front: 'Alert rule mein <code>for: 5m</code> kya karta hai?', back: 'Shart 5 minute lagataar sach rahe tabhi alert Firing hota hai. Tab tak Pending. Chhoti halchal par phone nahi bajta.' },
      { front: 'Alertmanager ke 4 auzaar?', back: '<b>Grouping</b> (jodna), <b>Inhibition</b> (bada alert chhote ko dabaye), <b>Silence</b> (tay samay ke liye chup), <b>Routing</b> (labels se sahi team).' },
    ],
  },
]);

/* ------------------------------------------------------------------ */
/* LEVEL 3 — logs + traces                                             */
/* ------------------------------------------------------------------ */
VISUALS['ob-traces'] = {
  t: 'Trace — ek request ka poora raasta, service-dar-service',
  scene: {
    intro: '<b>Sawal:</b> ek payment 2.7 second le raha hai aur raaste mein 4 services hain. Samay kis service mein ja raha hai?',
    aria: 'ek trace kaise banti hai: trace_id ka aage badhna, spans, OTel Collector, Tempo — 6 kadam',
    nodes: [
      { id: 'gw', col: 0, row: 0, icon: '🚪', label: 'API gateway', sub: 'trace_id banata hai', about: 'Request sabse pehle yahan aati hai. Gateway request ko ek anokha <code>trace_id</code> deta hai.' },
      { id: 'pay', col: 1, row: 0, icon: '💳', label: 'pay-api', sub: 'span: 2.70 s', tone: 'accent', about: 'pay-api ka poora kaam ek <b>span</b> hai. Span = ek service ke ek kaam ka shuru aur khatam hone ka samay.' },
      { id: 'fraud', col: 2, row: 0, icon: '🕵️', label: 'fraud-check', sub: 'span: ?', about: 'pay-api har payment se pehle fraud-check ko call karta hai.' },
      { id: 'ledger', col: 2, row: 1, icon: '📒', label: 'ledger', sub: 'span: ?', about: 'pay-api hisaab likhne ke liye ledger ko call karta hai.' },
      { id: 'otel', col: 1, row: 1, icon: '📡', label: 'OTel Collector', sub: 'spans jama karta hai', tone: 'gold', about: 'OpenTelemetry Collector. Har service apne spans yahan bhejti hai. Collector unhe aage storage tak pahunchata hai.' },
      { id: 'tempo', col: 0, row: 1, icon: '🧵', label: 'Tempo', sub: 'trace jodta hai', about: 'Trace ka storage. Ek hi trace_id wale saare spans ko jodkar ek ped (tree) dikhata hai.' },
    ],
    steps: [
      { from: 'gw', to: 'pay', label: 'trace_id=4bf9…', say: '<b>API gateway</b> request ko <code>trace_id=4bf9…</code> deta hai aur <code>traceparent</code> header mein <b>pay-api</b> ko bhejta hai. Yeh ID is request ki pehchaan hai — poore raaste mein.' },
      { from: 'pay', to: 'fraud', label: 'wahi trace_id', set: { fraud: { sub: 'span: 2.61 s' } }, say: '<b>pay-api</b> jab <b>fraud-check</b> ko call karta hai, toh wahi <code>traceparent</code> header aage bhejta hai. fraud-check ka kaam ek alag span banta hai: 2.61 second.' },
      { from: 'pay', to: 'ledger', label: 'wahi trace_id', set: { ledger: { sub: 'span: 0.04 s' } }, say: '<b>pay-api</b> phir <b>ledger</b> ko call karta hai, usi trace_id ke saath. ledger ka span: 0.04 second. Agar koi service header aage na bheje, toh trace wahin toot jaati hai.' },
      { from: 'pay', to: 'otel', label: 'spans', tone: 'gold', say: 'Teeno services (pay-api, fraud-check, ledger) apne-apne spans <b>OTel Collector</b> ko bhejti hain. Har span par wahi trace_id likha hai.' },
      { from: 'otel', to: 'tempo', label: 'jama karo', tone: 'gold', say: '<b>OTel Collector</b> spans ko <b>Tempo</b> mein rakhta hai. Tempo trace_id <code>4bf9…</code> wale saare spans ko jodkar ek ped banata hai.' },
      { at: ['fraud'], set: { fraud: { tone: 'bad', sub: 'span: 2.61 s 🐢' } }, say: 'Trace kholte hi jawab dikhta hai: 2.70 second mein se <b>2.61 second fraud-check</b> ke span mein gaye. Ab andaaza nahi lagana — seedha fraud-check ke logs mein wahi trace_id dhoondho.' },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* LEVEL 4 — HPA                                                       */
/* ------------------------------------------------------------------ */
VISUALS['as-hpa'] = {
  t: 'HPA — naapo, hisaab lagao, replicas badlo',
  scene: {
    intro: '<b>Sawal:</b> salary wale din traffic 3 guna ho gaya. pods ki ginti kaun badhata hai, aur kis number ko dekh kar?',
    aria: 'HPA ka chakkar: traffic, metrics-server, HPA ka formula, Deployment, naye pods — 7 kadam',
    nodes: [
      { id: 'users', col: 0, row: 0, icon: '👥', label: 'Traffic', sub: 'aam din', about: 'Users ke payments.' },
      { id: 'pods', col: 1, row: 0, icon: '📦', label: 'pay-api pods', sub: '2 pods · CPU 50%', tone: 'good', about: 'CPU % hamesha <b>request</b> ke muqable mein hota hai. Request 500m aur use 250m → 50%.' },
      { id: 'ms', col: 2, row: 0, icon: '📏', label: 'metrics-server', sub: 'CPU/memory naapta hai', about: 'Cluster ka chhota add-on. kubelet se har pod ka CPU/memory padhta hai. <code>kubectl top</code> bhi isi se chalta hai.' },
      { id: 'dep', col: 1, row: 1, icon: '🚀', label: 'Deployment: pay-api', sub: 'replicas: 2', about: 'HPA pods ko seedha nahi banata. HPA sirf Deployment ka <code>replicas</code> number badalta hai.' },
      { id: 'hpa', col: 2, row: 1, icon: '⚖️', label: 'HPA', sub: 'target: CPU 60%', tone: 'accent', about: 'HorizontalPodAutoscaler. Har 15 second mein ek hi hisaab lagata hai: desired = ceil(abhi ke replicas × abhi ka % ÷ target %).' },
    ],
    steps: [
      { from: 'users', to: 'pods', label: '3 guna traffic', tone: 'bad', set: { users: { sub: 'salary ka din' }, pods: { sub: '2 pods · CPU 150%', tone: 'bad' } }, say: 'Salary wale din <b>Traffic</b> 3 guna ho gaya. <b>pay-api pods</b> ka CPU 150% par pahunch gaya. (150% ka matlab: har pod apni CPU request ka 1.5 guna use kar raha hai.)' },
      { from: 'ms', to: 'pods', label: 'har 15 s naapo', say: '<b>metrics-server</b> har pod ka CPU naapta rehta hai.' },
      { from: 'hpa', to: 'ms', label: 'average CPU?', say: '<b>HPA</b> har 15 second mein <b>metrics-server</b> se poochhta hai: "pay-api ke pods ka average CPU kitna hai?" Jawab: 150%.' },
      { at: ['hpa'], say: '<b>HPA</b> hisaab lagata hai: <code>desired = ceil(2 × 150 ÷ 60) = 5</code>. Yaani target 60% par laane ke liye 5 pods chahiye.' },
      { from: 'hpa', to: 'dep', label: 'replicas: 5', tone: 'good', set: { dep: { sub: 'replicas: 5' } }, say: '<b>HPA</b> <b>Deployment: pay-api</b> ka replicas 2 se 5 kar deta hai. HPA ka kaam bas itna hi hai.' },
      { from: 'dep', to: 'pods', label: '3 naye pods', tone: 'good', set: { pods: { sub: '5 pods · CPU 60%', tone: 'good' } }, say: '<b>Deployment: pay-api</b> 3 naye pods banata hai. Wahi traffic ab 5 pods mein bant gaya: average CPU 60%.' },
      { at: ['hpa'], say: 'Traffic girne par <b>HPA</b> turant neeche nahi aata. HPA 5 minute tak intezaar karta hai (stabilization window). Warna pods har minute upar-neeche jhoolte rehte.' },
    ],
  },
};

const T_HPA = [
  { text: '<code>kubectl get hpa</code> — TARGETS column mein kya likha hai?', check: s => s.history.some(h => /^kubectl get (hpa|hpas)\b/.test(h)) },
  { text: '<code>kubectl describe hpa pay-api</code> — HPA khud kya wajah bata raha hai?', check: s => s.history.some(h => /^kubectl describe (hpa|hpas)[ \/]pay-api\b/.test(h)) },
  { text: 'Jaancho ki metrics-server chal raha hai (<code>kubectl top pods</code>)', check: s => s.history.some(h => /^kubectl top (pods?|po)\b/.test(h)) },
  { text: 'Asli wajah theek karo', check: s => !!s.cluster.fixed },
  { text: 'HPA ko scale karte dekho — <code>kubectl get hpa</code> tab tak chalao jab tak REPLICAS badh na jaye', check: s => !!s.cluster.scaledSeen },
];
const hpaRow = (t, r) => `NAME      REFERENCE            TARGETS         MINPODS   MAXPODS   REPLICAS   AGE\npay-api   Deployment/pay-api   ${t.padEnd(13)}   2         10        ${r}          3d`;
const hpaDescribe = c => `Name:                     pay-api\nReference:                Deployment/pay-api\nMetrics:                  ( current / target )\n  resource cpu on pods  (as a percentage of request):  ${c.scaled ? '59% (296m)' : c.fixed ? '148% (740m)' : '<unknown>'} / 60%\nMin replicas:             2\nMax replicas:             10\nDeployment pods:          ${c.scaled ? '5 current / 5 desired' : '2 current / 2 desired'}\nConditions:\n  Type           Status  Reason\n  ----           ------  ------\n  AbleToScale    True    ${c.fixed ? 'ReadyForNewScale' : 'SucceededGetScale'}\n  ScalingActive  ${c.fixed ? 'True    ValidMetricFound' : 'False   FailedGetResourceMetric'}\nEvents:\n` +
  (c.fixed ? (c.scaled ? '  Normal  SuccessfulRescale  30s  horizontal-pod-autoscaler  New size: 5; reason: cpu resource utilization (percentage of request) above target' : '  (abhi koi naya event nahi — HPA agle 15 second mein hisaab lagayega)')
           : '  Warning  FailedGetResourceMetric  2m (x720 over 3d)  horizontal-pod-autoscaler  failed to get cpu utilization: missing request for cpu in container pay-api of Pod pay-api-6b8d7c-a1\n(dhyaan do: "missing request for cpu". HPA ka CPU % request ke muqable mein hota hai — request hi nahi hai toh % nikle kaise?)');
function hpaGet(s) {
  const c = s.cluster;
  if (!c.fixed) return hpaRow('<unknown>/60%', 2) + '\n(TARGETS mein <unknown> = HPA ko number mil hi nahi raha. Jab tak number nahi, HPA kuch nahi karega — chahe traffic kitna bhi badh jaye.)';
  if (!c.sawHigh) { c.sawHigh = true; return hpaRow('148%/60%', 2) + '\n(ab number aa gaya: 148%. HPA har 15 second mein hisaab lagata hai — kubectl get hpa dobara chalao.)'; }
  if (!c.scaled) {
    c.scaled = true;
    ['c3', 'd4', 'e5'].forEach((x, i) => c.pods.push({ name: 'pay-api-7c9e8d-' + x, ready: '1/1', status: 'Running', restarts: 0, age: '20s', node: 'node-' + (i % 2 + 1), ip: '10.244.' + (i % 2 + 1) + '.5' + i, top: '296m 590Mi' }));
    c.pods.forEach(p => { if (/^pay-api/.test(p.name)) p.top = '296m 590Mi'; });
    const d = c.deployments.find(x => x.name === 'pay-api'); d.ready = '5/5'; d.upToDate = 5; d.available = 5;
    const h = c.hpas[0]; h.targets = '59%/60%'; h.replicas = 5;
  }
  c.scaledSeen = true;
  return hpaRow('59%/60%', 5) + '\n(HPA ne hisaab lagaya: ceil(2 × 148 ÷ 60) = 5. Paanch pods par wahi load 59% ho gaya.)';
}

KG.registerLevels('observe', [
  /* ================================================================== */
  {
    id: 'ob-traces',
    icon: '🧵',
    title: 'Logs aur Traces — "kuch dheema hai" se asli wajah tak',
    badge: 'Trace Tracker',
    objectives: [
      'Teen auzaar, teen sawal: metric = <b>kya</b>, trace = <b>kahan</b>, log = <b>kyun</b>',
      '<code>kubectl logs</code> ki seema, aur central logging (Fluent Bit → Loki) kyun',
      'Trace, span aur <code>trace_id</code> ka ek service se doosri tak jaana',
      'Ek alert se shuru karke asli wajah tak pahunchna (flow) + tooti hui trace ka case',
    ],
    lesson: [
      `<h3>📦 Misaal: courier ka parcel</h3>
       <p>Ek courier company ke paas teen tarah ki jaankari hoti hai:</p>
       <table>
         <tr><th>Courier mein</th><th>Kubernetes mein</th><th>Kis sawal ka jawab</th></tr>
         <tr><td>"Aaj 5% parcels late hain"</td><td><b>Metric</b></td><td><b>Kya</b> kuch gadbad hai?</td></tr>
         <tr><td>Ek parcel ki tracking: har godown ka scan aur samay</td><td><b>Trace</b></td><td>Samay <b>kahan</b> gaya?</td></tr>
         <tr><td>Us godown ka register: "truck kharab tha"</td><td><b>Log</b></td><td><b>Kyun</b> hua?</td></tr>
       </table>
       <p><b>Asli baat:</b> teeno ko isi kram mein istemal karo. Metric batata hai ki <i>dekhna hai</i>. Trace batata hai <i>kahan dekhna hai</i>.
       Log batata hai <i>kya hua</i>. Seedha logs mein kood jaoge toh 40 services ke logs mein kho jaoge.</p>`,
      `<h3>📜 Logs: kubectl logs kaafi kyun nahi</h3>
       <p>Container jo bhi <code>stdout</code> par likhta hai, node par ek file mein jaata hai. <code>kubectl logs</code> wahi file padhta hai.</p>
       <p><b>Seema:</b></p>
       <ul>
         <li>Pod delete hua → uske logs <b>gaye</b>.</li>
         <li>Container restart hua → sirf <b>ek</b> pichhla run milta hai (<code>--previous</code>).</li>
         <li>20 pods mein ek line dhoondhni ho → 20 baar command.</li>
       </ul>
       <p><b>Hal — central logging:</b> har node par ek chhota agent (<b>Fluent Bit</b>, DaemonSet) log files padhkar <b>Loki</b> ko bhejta hai.</p>
       <pre># LogQL: pay-api ke saare pods ke logs mein ek trace_id dhoondho
{namespace="payments", app="pay-api"} |= "trace_id=4bf92f35"</pre>
       <p><b>Loki ka niyam:</b> Loki sirf <b>labels</b> (namespace, app, pod) ka index banata hai, log ke andar ke shabdon ka nahi.
       Isliye <code>user_id</code> ya <code>trace_id</code> ko label mat banao — log ki line ke andar likho.</p>`,
      `<h3>🧵 Trace: ek request ki poori kahani</h3>
       <ul>
         <li><b>Span</b> = ek service ke ek kaam ka samay (shuru → khatam).</li>
         <li><b>Trace</b> = ek request ke saare spans, ek ped (tree) ki tarah.</li>
         <li><b>trace_id</b> = us request ki pehchaan. Har service ise agli service ko <code>traceparent</code> HTTP header mein bhejti hai.</li>
       </ul>
       <pre>trace 4bf92f35  (kul 2.71 s)
└─ api-gateway        2.71 s
   └─ pay-api         2.70 s
      ├─ fraud-check  2.61 s   ← samay yahan gaya
      └─ ledger       0.04 s</pre>
       <p><b>Do jaal:</b> (1) Koi ek service header aage na bheje → trace do tukdon mein toot jaati hai.
       (2) Har request ki trace rakhna mehenga hai, isliye aksar 1–10% hi rakhi jaati hain (<b>sampling</b>) — aur errors/dheemi requests ko alag se pakka rakha jaata hai.</p>`,
    ],
    stages: [
      {
        type: 'flow',
        title: '🎬 Flow: ek alert se asli wajah tak',
        instructions: '"Agla kadam" dabao. Har kadam par dekho ki kaun sa auzaar istemal ho raha hai. Teen sawal beech mein aayenge.',
        lanes: [
          { id: 'alert', label: 'Alertmanager', icon: '📟' },
          { id: 'metric', label: 'Grafana (metrics)', icon: '📊' },
          { id: 'trace', label: 'Tempo (traces)', icon: '🧵' },
          { id: 'log', label: 'Loki (logs)', icon: '📜' },
          { id: 'you', label: 'Tum (kubectl)', icon: '🧑‍💻' },
        ],
        steps: [
          { lane: 'alert', t: 'Page: pay-api ka p99 latency 2.8 s hai (waada 500 ms), 10 minute se', detail: '<b>Lakshan</b> wala alert. Abhi sirf itna pata hai ki payments dheeme hain. Kahan aur kyun — nahi pata.' },
          { lane: 'metric', t: 'Dashboard: traffic normal, errors normal (0.1%), latency sirf POST /pay par badhi hai', detail: 'Metrics ne daayra chhota kiya: gadbad sirf <code>POST /pay</code> mein hai, aur requests fail nahi ho rahe — bas dheeme hain.',
            ask: { q: 'Metrics se tumhe kya pata chala, aur kya NAHI pata chala?',
              choices: [
                'Pata chala ki POST /pay dheema hai; nahi pata ki raaste ki kis service mein samay ja raha hai',
                'Pata chala ki ledger database dheema hai; nahi pata ki ledger ki kaun si query dheemi hai',
                'Pata chala ki pay-api ka CPU kam hai; nahi pata ki kitne replicas chahiye',
                'Kuch pata nahi chala; errors 0.1% hain, matlab alert jhootha hai',
              ], answer: 0,
              explain: 'Metric "kya" batata hai. POST /pay ke peeche pay-api, fraud-check aur ledger teeno hain. Kaun sa dheema hai, yeh trace batayegi.' } },
          { lane: 'metric', t: 'Latency graph ke ek dheeme point par click: exemplar trace_id = 4bf92f35', detail: '<b>Exemplar</b> = graph ke ek point se judi ek asli request ki trace_id. Yahi metric se trace tak ka pul hai.' },
          { lane: 'trace', t: 'Trace 4bf92f35: gateway 2.71 s → pay-api 2.70 s → fraud-check 2.61 s, ledger 0.04 s', detail: '<pre>trace 4bf92f35  (kul 2.71 s)\n└─ api-gateway        2.71 s\n   └─ pay-api         2.70 s\n      ├─ fraud-check  2.61 s\n      └─ ledger       0.04 s</pre>',
            ask: { q: 'Ab kis service ke logs dekhoge?',
              choices: [
                'pay-api — pay-api ka span sabse lamba (2.70 s) hai',
                'ledger — database hamesha sabse pehla shak hota hai',
                'fraud-check — 2.70 s mein se 2.61 s isi span ke hain',
                'api-gateway — request sabse pehle gateway par aayi thi',
              ], answer: 2,
              explain: 'pay-api ka span lamba isliye hai ki pay-api fraud-check ka intezaar kar raha hai. Trace mein hamesha woh span dhoondho jiska <b>apna</b> samay zyada hai — yahan fraud-check.' } },
          { lane: 'log', t: 'LogQL: {app="fraud-check"} |= "4bf92f35"', detail: '<pre>level=warn msg="rules cache miss, loading 48000 rules from S3" trace_id=4bf92f35 dur=2.58s</pre>Trace ne service batayi; log ne <b>wajah</b> batayi: fraud-check har request par 48,000 niyam S3 se dobara padh raha hai.' },
          { lane: 'log', t: 'LogQL: "cache miss" kitni baar? → 09:40 ke baad se har request par', detail: 'Ek request ki kahani ko poori tasveer se milaya: 09:40 se pehle "cache miss" din mein 2–3 baar aata tha. 09:40 ke baad har request par.' },
          { lane: 'you', t: 'kubectl rollout history deployment/fraud-check → revision 12, 09:38: CACHE_TTL=0s', detail: '<pre>REVISION  CHANGE-CAUSE\n11        image fraud-check:2.4.1\n12        set env CACHE_TTL=0s        (09:38)</pre>',
            ask: { q: 'Asli wajah kya hai?',
              choices: [
                'S3 dheema ho gaya hai; AWS ki taraf se koi kharabi hai',
                'fraud-check ke naye deploy ne cache band kar diya (CACHE_TTL=0s)',
                'pay-api ke replicas kam hain; zyada pods se latency theek ho jayegi',
                'ledger ka span 0.04 s hai, jo normal se zyada hai',
              ], answer: 1,
              explain: 'Samay (09:38 ka deploy) aur lakshan (09:40 se har request par cache miss) mil gaye. Zyada replicas se kuch nahi badalta — har pod wahi dheema kaam karta.' } },
          { lane: 'you', t: 'kubectl rollout undo deployment/fraud-check → p99 latency wapas 180 ms', detail: 'Pehle <b>chot rokna</b> (rollback), phir aaram se asli sudhaar (CACHE_TTL ka sahi maan). Poora safar: alert → metric → trace → log → deploy history → rollback.' },
        ],
        summary: '<b>Kram yaad rakho:</b> 📊 metric ne bataya <i>kya</i> (POST /pay dheema) → 🧵 trace ne bataya <i>kahan</i> (fraud-check) → 📜 log ne bataya <i>kyun</i> (cache miss) → 🧑‍💻 deploy history ne bataya <i>kab se</i> (09:38). Har auzaar ne agle auzaar ka daayra chhota kiya.',
      },
      {
        type: 'triage',
        title: '🩺 Case: trace do tukdon mein kyun hai?',
        instructions: 'Commands chuno. Saare clue milne par sawal khulega.',
        symptom: `Tempo mein pay-api ki trace adhoori dikhti hai: <b>ledger ka span hai hi nahi</b>.<br>
          Team ka kehna hai: "ledger traces bhej hi nahi raha — OTel Collector kharab hoga."`,
        commands: [
          { cmd: 'tempo: trace 4bf92f35', clue: true,
            out: 'trace 4bf92f35  (kul 2.71 s)\n└─ api-gateway        2.71 s\n   └─ pay-api         2.70 s\n      └─ fraud-check  2.61 s\n(ledger ka span is trace mein nahi hai)',
            note: 'fraud-check ka span juda hai, ledger ka nahi. Dono ko pay-api hi call karta hai — toh farak pay-api ke <b>call karne ke tareeke</b> mein hoga.' },
          { cmd: 'kubectl logs ledger-0 --tail=3', clue: true,
            out: 'level=info msg="write ok" trace_id=9c1d77e0 dur=41ms\nlevel=debug msg="no traceparent header on request, starting new trace" trace_id=9c1d77e0\nlevel=info msg="write ok" trace_id=a22f0b14 dur=38ms',
            note: 'ledger traces bana raha hai — par <b>naye trace_id</b> ke saath (<code>9c1d77e0</code>), kyunki ledger ko <code>traceparent</code> header mila hi nahi.' },
          { cmd: 'kubectl logs deploy/pay-api --tail=4 | grep ledger', clue: true,
            out: 'level=debug msg="calling fraud-check" client=otelhttp trace_id=4bf92f35\nlevel=debug msg="calling ledger" client=net/http(raw) trace_id=4bf92f35',
            note: 'pay-api fraud-check ko <code>otelhttp</code> client se call karta hai (header apne aap jata hai). ledger ko <b>saade</b> HTTP client se — header aage nahi jaata.' },
          { cmd: 'kubectl get pods -n observability', clue: false,
            out: 'NAME                              READY   STATUS    RESTARTS   AGE\notel-collector-7d8f9c6b5-k2m4x    1/1     Running   0          12d\ntempo-0                           1/1     Running   0          12d\nloki-0                            1/1     Running   0          12d',
            note: 'OTel Collector aur Tempo dono chal rahe hain. Aur fraud-check ke spans pahunch rahe hain — Collector kharab hota toh koi span nahi aata.' },
          { cmd: 'tempo: trace 9c1d77e0', clue: false,
            out: 'trace 9c1d77e0  (kul 0.04 s)\n└─ ledger   0.04 s\n(akela span — kisi maa-baap ke bina)',
            note: 'ledger ka span Tempo mein hai — par alag trace mein, akela. Yaani ledger se Tempo tak ka raasta theek hai.' },
        ],
        questions: [
          {
            q: 'ledger ka span pay-api ki trace se kyun nahi juda?',
            choices: [
              'OTel Collector ledger ke spans gira raha hai kyunki Collector par load zyada hai',
              'pay-api ledger ko traceparent header nahi bhejta, toh ledger naya trace_id bana leta hai',
              'Sampling 10% hai, isliye ledger ke 90% spans jaan-boojhkar nahi rakhe jaate',
              'ledger StatefulSet hai, aur StatefulSet ke pods traces mein nahi jud sakte',
            ],
            answer: 1,
            explain: 'ledger ke log ne khud bataya: "no traceparent header … starting new trace". Trace tabhi judti hai jab har service trace_id ko agli service tak pahunchaye. Sampling poori trace par lagti hai, ek span par nahi.',
          },
          {
            q: 'Sahi fix kya hai?',
            choices: [
              'pay-api ke ledger wale HTTP client ko OpenTelemetry se instrument karo',
              'Tempo ki sampling 100% kar do taaki koi span na chhoote',
              'OTel Collector ke replicas badhao taaki spans na giren',
              'ledger ko restart karo taaki ledger purana trace_id dobara istemal kare',
            ],
            answer: 0,
            explain: 'Kharabi "context propagation" ki hai: pay-api → ledger wale call mein header nahi ja raha. Client ko instrument karo (jaise otelhttp), bas. Sampling ya replicas se tooti hui kadi nahi judti.',
          },
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — logs ke niyam',
        questions: [
          {
            q: 'pay-api ka ek pod raat ko crash hokar delete ho gaya (node hi hat gaya). Subah tum uske logs dekhna chahte ho. kubectl logs se milenge?',
            choices: [
              'Haan — kubectl logs --previous hamesha pichhle pod ke logs deta hai',
              'Nahi — pod aur node dono gaye; logs tabhi milenge jab koi agent unhe pehle bhej chuka ho',
              'Haan — API Server har pod ke logs 7 din tak etcd mein rakhta hai',
              'Nahi — kubectl logs sirf Running pods par chalta hai, crash hue pods par kabhi nahi',
            ],
            answer: 1,
            explain: 'Logs node ki file mein hote hain. --previous sirf usi pod ke pichhle container run ke logs deta hai, aur woh bhi tab jab pod abhi maujood ho. Node gaya toh file bhi gayi. Isi liye central logging chahiye.',
          },
          {
            q: 'Ek engineer Loki mein trace_id ko label banana chahta hai taaki search tez ho. Kya kahoge?',
            choices: [
              'Achha idea hai — jitne zyada labels, Loki utna tez',
              'Mat karo — har trace_id ek naya stream banata hai; use log ki line mein rakho',
              'Mat karo — Loki mein label ki value sirf 8 akshar ki ho sakti hai',
              'Achha idea hai — par label ka naam traceID hona chahiye, trace_id nahi',
            ],
            answer: 1,
            explain: 'Loki labels ka index banata hai. Har alag label value ek alag stream hai. Lakhon trace_id = lakhon streams = Loki dheema aur mehenga. Labels thode aur sthir rakho (namespace, app); baaki sab line ke andar.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — observability',
      instructions: 'Interviewer ek asli ghatna dega aur dekhega ki tum kis kram mein sochte ho. 🎤',
      questions: [
        {
          q: '"Metrics, logs aur traces — teeno ka kaam kya hai, aur ghatna ke waqt kis kram mein dekhte ho?"',
          choices: [
            'Pehle logs (sab kuch wahin likha hai), phir traces, aur aakhir mein metrics se pakka karta hoon',
            'Metric: kya gadbad hai. Trace: samay ya error kis service mein hai. Log: us service mein kyun. Isi kram mein',
            'Teeno ek hi jaankari dete hain; jo tool sabse pehle khul jaye, usi se kaam chal jaata hai',
            'Pehle traces, kyunki traces mein metrics aur logs dono shaamil hote hain',
          ],
          answer: 1,
          explain: 'Har auzaar agle ka daayra chhota karta hai. Seedha logs se shuru karna = 40 services ke logs mein andaaze se dhoondhna. Kram: kya → kahan → kyun.',
        },
        {
          q: '"Trace mein pay-api ka span 2.7 s hai aur uske andar fraud-check ka span 2.6 s. Dheema kaun hai?"',
          choices: [
            'pay-api — sabse lamba span hamesha doshi hota hai',
            'Dono barabar — kyunki dono ke span lagbhag ek jitne hain',
            'fraud-check — pay-api ka apna samay sirf 0.1 s hai; baaki intezaar',
            'Bata nahi sakte — span ka samay sirf network ka samay hota hai',
          ],
          answer: 2,
          explain: 'Maa-baap span mein bachche ka samay shaamil hota hai. Hamesha "apna samay" (self time) dekho: pay-api 2.7 − 2.6 = 0.1 s. Samay fraud-check mein ja raha hai.',
        },
        {
          q: '"Humari traces aksar beech mein toot jaati hain. Sabse aam wajah?"',
          choices: [
            'Tempo ki disk bhar jaati hai aur Tempo purane spans mita deta hai',
            'Do services ki ghadi alag hoti hai, isliye spans jud nahi paate',
            'Beech ki koi service traceparent header aage nahi bhejti',
            'Kubernetes Service har request ka header badal deta hai',
          ],
          answer: 2,
          explain: 'Trace_id ek service se doosri tak header mein jaata hai. Ek bhi kadi (saada HTTP client, message queue, purani library) header gira de toh aage naya trace_id ban jaata hai. Fix: us kadi ko instrument karo.',
        },
      ],
    },
    success: [
      'Main ghatna ke waqt metric → trace → log ke kram mein chal sakta hoon',
      'Main trace padhkar bata sakta hoon ki samay kis service mein ja raha hai',
      'Main tooti hui trace ki wajah (header aage na jaana) pehchaan sakta hoon',
    ],
    homework: `<p>Apni kisi service ke logs dekho aur teen sawal poochho:</p>
      <pre>kubectl logs deploy/&lt;app&gt; --tail=20
# 1. Kya har line mein trace_id hai?
# 2. Kya logs JSON (structured) hain, ya saade vaakya?
# 3. Pod delete ho jaye toh yeh logs kahan milenge?</pre>`,
    cards: [
      { front: 'Metric, trace aur log — teeno ka sawal?', back: '<b>Metric</b>: kya gadbad hai. <b>Trace</b>: kahan (kis service mein). <b>Log</b>: kyun. Isi kram mein dekho.' },
      { front: '<code>kubectl logs</code> ki teen seema?', back: 'Pod delete → logs gaye. Restart → sirf ek pichhla run (<code>--previous</code>). Kai pods → ek-ek karke. Hal: Fluent Bit → Loki.' },
      { front: 'Span, trace aur trace_id?', back: '<b>Span</b> = ek service ke ek kaam ka samay. <b>Trace</b> = ek request ke saare spans ka ped. <b>trace_id</b> = request ki pehchaan, <code>traceparent</code> header mein aage jaati hai.' },
      { front: 'Trace beech mein kyun toot jaati hai?', back: 'Koi service <code>traceparent</code> header aage nahi bhejti (context propagation). Agli service naya trace_id bana leti hai.' },
      { front: 'Loki mein user_id / trace_id label kyun nahi?', back: 'Loki sirf labels ka index banata hai; har alag value ek naya stream. Inhe log ki line mein rakho aur <code>|=</code> se dhoondho.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'as-hpa',
    icon: '⚖️',
    title: 'HPA — load badhe toh pods apne aap badhen',
    badge: 'Scale Sardar',
    objectives: [
      'HPA ka ek hi formula: <code>desired = ceil(replicas × abhi ka % ÷ target %)</code>',
      'CPU % <b>request</b> ke muqable mein hota hai — request nahi toh HPA andha',
      'Scale-up tez, scale-down dheema (5 minute) — aur kyun',
      'TARGETS mein <code>&lt;unknown&gt;</code> wale HPA ko theek karna (terminal) + sahi target chunna (slider)',
    ],
    lesson: [
      `<h3>🍛 Misaal: dhabe ka manager</h3>
       <p>Dhabe par 2 rotiwale hain. Dopahar ko bheed 3 guna ho jaati hai. Manager kya karta hai?</p>
       <ol>
         <li><b>Naapta hai:</b> har rotiwala kitna vyast hai? (150% — apni kshamta se zyada)</li>
         <li><b>Hisaab lagata hai:</b> "main chahta hoon har koi 60% vyast rahe. Toh 2 × 150 ÷ 60 = 5 rotiwale chahiye."</li>
         <li><b>Bulata hai:</b> 3 aur rotiwale.</li>
       </ol>
       <p>Kubernetes mein yeh manager <b>HPA</b> (HorizontalPodAutoscaler) hai. Poora HPA ek hi formula hai:</p>
       <pre>desired replicas = ceil( abhi ke replicas × abhi ka metric ÷ target metric )</pre>
       <p>HPA yeh hisaab har <b>15 second</b> mein lagata hai.</p>`,
      `<h3>⚠️ HPA ko do cheezein chahiye — warna &lt;unknown&gt;</h3>
       <p><b>1. metrics-server.</b> Yahi add-on pods ka CPU/memory naapta hai. <code>kubectl top pods</code> chalta hai → metrics-server theek hai.</p>
       <p><b>2. CPU request.</b> HPA ka "CPU 60%" ka matlab hai: <b>request ka 60%</b>. Limit ka nahi, node ka nahi.</p>
       <pre>request 500m, use 750m  →  150%
request nahi hai         →  % nikle kaise?  →  &lt;unknown&gt;</pre>
       <p>Dono mein se ek bhi na ho toh:</p>
       <pre>NAME      REFERENCE            TARGETS         REPLICAS
pay-api   Deployment/pay-api   &lt;unknown&gt;/60%   2</pre>
       <p><b>Asli baat:</b> <code>&lt;unknown&gt;</code> wala HPA <b>kuch nahi karta</b>. Koi error nahi, koi alert nahi — bas salary wale din pods nahi badhte.
       Wajah hamesha <code>kubectl describe hpa</code> ke Events mein likhi hoti hai.</p>`,
      `<h3>🎚️ Teen number jo tum chunte ho</h3>
       <table>
         <tr><th>Number</th><th>Bahut kam rakha toh</th><th>Bahut zyada rakha toh</th></tr>
         <tr><td><b>target %</b></td><td>Zyada pods, zyada paisa</td><td>Peak par headroom nahi — naye pods aane tak users ko dheema</td></tr>
         <tr><td><b>minReplicas</b></td><td>1 pod = ek node gira toh service band</td><td>Raat ko khaali pods ka paisa</td></tr>
         <tr><td><b>maxReplicas</b></td><td>HPA chhat par atak jaata hai, load badhta rehta hai</td><td>Bug ya hamle mein bill beqaabu</td></tr>
       </table>
       <p><b>Scale-up tez, scale-down dheema:</b> upar jaate waqt HPA turant badhata hai. Neeche aate waqt HPA pichhle <b>5 minute</b> ka
       sabse bada jawab maanta hai (stabilization window) — taaki traffic ke har chhote gadhe par pods maare na jayen.</p>
       <p><b>GitOps ka jaal:</b> HPA laga ho toh Deployment ke YAML mein <code>replicas</code> mat likho. Warna ArgoCD har sync par HPA ka number mita dega.</p>`,
    ],
    stages: [
      {
        type: 'slider',
        title: '🎚️ Lab: salary wale din ke liye HPA',
        instructions: 'Teen knob ghumao. HPA ka formula har badlaav par dobara chalta hai.',
        scenario: `ChaiPay ki <b>pay-api</b>: abhi 4 pods, CPU request 500m har pod.
          <ul><li>☀️ <b>Salary ka din:</b> kul load itna ki 4 pods par CPU <b>150%</b> ho jaata hai</li>
          <li>🌙 <b>Raat:</b> kul load itna ki 1 pod par CPU <b>80%</b> hota</li></ul>
          Naye pod ko taiyaar hone mein ~1 minute lagta hai, isliye peak par thodi khaali jagah (headroom) chahiye.`,
        goal: 'Aisa HPA banao ki: salary wale din scale hone ke baad CPU 75% se upar na rahe, HPA maxReplicas ki chhat se na takraye, ek node girne par service band na ho (min 2), aur raat ko 3 se zyada pods na chalen.',
        knobs: [
          { id: 'target', label: 'target CPU %', min: 30, max: 90, step: 5, value: 90, unit: '%' },
          { id: 'max', label: 'maxReplicas', min: 4, max: 20, step: 1, value: 6, unit: ' pods' },
          { id: 'min', label: 'minReplicas', min: 1, max: 6, step: 1, value: 1, unit: ' pods' },
        ],
        readouts: k => {
          const want = Math.ceil(4 * 150 / k.target), day = Math.max(k.min, Math.min(k.max, want)), util = Math.round(600 / day);
          const night = Math.max(k.min, Math.min(k.max, Math.ceil(80 / k.target)));
          return [
            { label: '☀️ HPA ka hisaab', value: `ceil(4 × 150 ÷ ${k.target}) = ${want}`, state: 'neutral', hint: 'desired = ceil(replicas × abhi ka % ÷ target %)' },
            { label: '☀️ Asal mein pods', value: day + (want > k.max ? ' (chhat!)' : ''), state: want > k.max ? 'bad' : 'good', hint: want > k.max ? `HPA ${want} chahta hai, par maxReplicas ${k.max} hai` : 'chhat se neeche' },
            { label: '☀️ Scale ke baad CPU', value: util + '%', state: util <= 75 ? 'good' : 'bad', hint: util <= 75 ? 'naye pod aane tak ki jagah bachi hai' : 'headroom nahi — agla uchhaal users ko dheema lagega' },
            { label: '🌙 Raat ke pods', value: String(night), state: night >= 2 && night <= 3 ? 'good' : 'bad', hint: night < 2 ? '1 pod: node gira toh service band' : night > 3 ? 'raat ko khaali pods ka paisa' : '2–3 pods: surakshit aur sasta' },
          ];
        },
        bars: k => {
          const day = Math.max(k.min, Math.min(k.max, Math.ceil(600 / k.target))), util = Math.round(600 / day);
          return [{ label: 'Salary ke din CPU', pct: Math.min(100, util / 1.5), state: util <= 75 ? 'good' : 'bad', cap: util + '% (seema 75%)' }];
        },
        verdict: k => {
          const want = Math.ceil(600 / k.target), day = Math.max(k.min, Math.min(k.max, want)), util = 600 / day;
          const night = Math.max(k.min, Math.min(k.max, Math.ceil(80 / k.target)));
          if (want > k.max) return { ok: false, text: `HPA ${want} pods chahta hai par maxReplicas ${k.max} par atka hai. Load badhta rahega aur HPA kuch nahi kar payega.` };
          if (util > 75) return { ok: false, text: `Scale ke baad bhi CPU ${Math.round(util)}% hai. Target bahut ooncha hai: HPA tab tak naye pods nahi mangata jab tak pods lagbhag bhar na jayen.` };
          if (night < 2) return { ok: false, text: 'Raat ko sirf 1 pod bachta hai. Us pod ka node gira toh pay-api poori tarah band.' };
          if (night > 3) return { ok: false, text: `Raat ko ${night} pods chal rahe hain jabki load 1 pod ka bhi nahi. Yeh khaali pods ka paisa hai.` };
          return { ok: true, text: 'HPA dono samay sahi hai: din mein headroom ke saath scale, raat mein 2–3 pods.' };
        },
        check: k => { const want = Math.ceil(600 / k.target), day = Math.max(k.min, Math.min(k.max, want)); const night = Math.max(k.min, Math.min(k.max, Math.ceil(80 / k.target))); return want <= k.max && 600 / day <= 75 && night >= 2 && night <= 3; },
        lesson: 'Shuru mein target 90% tha: HPA sirf 7 pods mangata aur CPU 86% par rehta — headroom nahi. Target neeche laane se HPA <b>pehle</b> aur <b>zyada</b> pods mangata hai. Aur minReplicas 2 ka load se koi rishta nahi — woh ek node ke girne ka bima hai.',
        quiz: {
          q: 'HPA: 4 pods chal rahe hain, average CPU 150%, target 60%. HPA kitne replicas maangega?',
          choices: ['6 — 4 + 2', '10 — ceil(4 × 150 ÷ 60)', '8 — 4 × 2', '5 — ceil(150 ÷ 60) + 2'],
          answer: 1,
          explain: 'desired = ceil(abhi ke replicas × abhi ka % ÷ target %) = ceil(4 × 150 ÷ 60) = ceil(10) = 10. (Agar maxReplicas 10 se kam hota toh HPA chhat par ruk jaata.)',
        },
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: HPA jo kuch karta hi nahi',
        instructions: 'Salary ka din hai. pay-api dheemi hai. Team kehti hai "HPA toh laga hai" — par pods 2 ke 2 hi hain.',
        goal: `<b>pay-api</b> ka HPA teen din se laga hai par ek baar bhi scale nahi hua. Wajah dhoondho, theek karo, aur HPA ko 2 se zyada replicas tak jaate dekho.`,
        tasks: T_HPA,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }, { name: 'node-2', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: 'pay-api-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-1', ip: '10.244.1.20', top: '740m 600Mi',
              describe: 'Name:         pay-api-6b8d7c-a1\nStatus:       Running\nContainers:\n  pay-api:\n    Image:      chaipay/pay-api:3.2.0\n    Limits:     <none>\n    Requests:   <none>        <-- na request, na limit' },
            { name: 'pay-api-6b8d7c-b2', ready: '1/1', status: 'Running', restarts: 0, age: '3d', node: 'node-2', ip: '10.244.2.20', top: '742m 598Mi',
              describe: 'Name:         pay-api-6b8d7c-b2\nStatus:       Running\nContainers:\n  pay-api:\n    Image:      chaipay/pay-api:3.2.0\n    Limits:     <none>\n    Requests:   <none>        <-- na request, na limit' },
            { name: 'metrics-server-5f9c8d7b6-z4k1p', ready: '1/1', status: 'Running', restarts: 0, age: '40d', node: 'node-1', ip: '10.244.1.5', top: '4m 22Mi' },
          ],
          deployments: [{ name: 'pay-api', ready: '2/2', upToDate: 2, available: 2, age: '40d' }],
          hpas: [{ name: 'pay-api', reference: 'Deployment/pay-api', targets: '<unknown>/60%', min: 2, max: 10, replicas: 2, age: '3d' }],
        },
        responses: [
          { re: /^kubectl get (hpa|hpas|horizontalpodautoscalers?)\b/, mutate: s => { s.cluster.lastHpa = hpaGet(s); }, out: s => s.cluster.lastHpa || '' },
          { re: /^kubectl describe (hpa|hpas|horizontalpodautoscalers?)([ \/]pay-api)?$/, out: s => hpaDescribe(s.cluster) },
        ],
        files: {
          'fix-pay-api-requests.yaml': {
            desc: 'pay-api ke container mein CPU request 500m aur memory request/limit 1Gi jodta hai',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: pay-api\nspec:\n  template:\n    spec:\n      containers:\n        - name: pay-api\n          resources:\n            requests:\n              cpu: 500m        # <-- HPA ka % isi ke muqable mein niklega\n              memory: 1Gi\n            limits:\n              memory: 1Gi',
            apply: s => {
              const c = s.cluster;
              if (c.fixed) return 'deployment.apps/pay-api unchanged';
              c.fixed = true;
              c.pods = c.pods.filter(p => !/^pay-api/.test(p.name));
              ['a1', 'b2'].forEach((x, i) => c.pods.unshift({ name: 'pay-api-7c9e8d-' + x, ready: '1/1', status: 'Running', restarts: 0, age: '30s', node: 'node-' + (i + 1), ip: '10.244.' + (i + 1) + '.4' + i, top: '740m 600Mi',
                describe: 'Name:         pay-api-7c9e8d-' + x + '\nStatus:       Running\nContainers:\n  pay-api:\n    Limits:\n      memory:  1Gi\n    Requests:\n      cpu:     500m\n      memory:  1Gi' }));
              c.hpas[0].targets = '148%/60%';
              return 'deployment.apps/pay-api configured\n(rolling update: do naye pods CPU request 500m ke saath Running hain. Ab kubectl get hpa dekho.)';
            },
          },
          'install-metrics-server.sh': {
            desc: 'metrics-server install karta hai',
            content: '#!/bin/sh\nkubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml',
            apply: () => 'deployment.apps/metrics-server unchanged\n(metrics-server pehle se chal raha hai — kubectl top pods number de raha hai. HPA ki kharabi metrics-server mein nahi hai.)',
          },
          'fix-hpa-target-30.yaml': {
            desc: 'HPA ka target 60% se 30% karta hai',
            apply: s => 'horizontalpodautoscaler.autoscaling/pay-api configured\n(TARGETS abhi bhi ' + (s.cluster.fixed ? 'number dikha raha hai' : '<unknown> hai') + '. Target badalne se <unknown> nahi hatta: kharabi "abhi ka %" nikaalne mein hai, target mein nahi. Simulator ne target wapas 60% kar diya.)',
          },
        },
        success: KG.allOf(T_HPA),
        successText: `<code>&lt;unknown&gt;</code> ki wajah <code>kubectl describe hpa</code> ke Events mein saaf likhi thi: <b>missing request for cpu</b>. HPA ka CPU % request ke muqable mein hota hai; request thi hi nahi, toh HPA teen din se andha tha.
          metrics-server theek tha (<code>kubectl top pods</code> chal raha tha) — isliye use dobara install karna bekaar hota.
          <b>Yaad rakho:</b> naya HPA lagane ke baad hamesha <code>kubectl get hpa</code> mein TARGETS dekho. Number dikhe → theek. <code>&lt;unknown&gt;</code> dikhe → HPA so raha hai.`,
        hints: [
          'kubectl get hpa mein TARGETS dekho. Phir kubectl describe hpa pay-api — Events ki aakhri line poori padho.',
          '"missing request for cpu". kubectl top pods chalta hai, toh metrics-server theek hai. ls se files dekho.',
          'kubectl apply -f fix-pay-api-requests.yaml, phir kubectl get hpa do baar (HPA har 15 second mein hisaab lagata hai).',
        ],
        solution: [
          'kubectl get hpa',
          'kubectl describe hpa pay-api',
          'kubectl top pods',
          'kubectl apply -f fix-pay-api-requests.yaml',
          'kubectl get hpa',
          'kubectl get hpa',
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — HPA ka bartaav',
        questions: [
          {
            q: 'Traffic achanak gir gaya. HPA ke hisaab se ab 2 pods kaafi hain, par 5 minute tak pods 6 ke 6 rahe. Kya HPA kharab hai?',
            choices: [
              'Haan — HPA ko har 15 second mein turant scale-down karna chahiye tha',
              'Nahi — scale-down mein HPA pichhle 5 minute ka sabse bada jawab maanta hai',
              'Haan — metrics-server ka data 5 minute purana hai, use restart karna hoga',
              'Nahi — HPA kabhi scale-down nahi karta; pods ko haath se kam karna padta hai',
            ],
            answer: 1,
            explain: 'Scale-down ka default stabilization window 300 second hai. Faayda: traffic ke chhote gadhe par pods maar kar phir dobara banane ka jhoola nahi banta. Zaroorat ho toh HPA ke behavior field se badla ja sakta hai.',
          },
          {
            q: 'ArgoCD use hota hai. Deployment ke YAML mein replicas: 2 likha hai aur HPA bhi laga hai. Kya problem aayegi?',
            choices: [
              'Koi problem nahi — HPA ka number hamesha YAML ke number se upar maana jaata hai',
              'HPA replicas ko 6 karega, aur ArgoCD agle sync par wapas 2 — dono ladte rahenge',
              'ArgoCD HPA object ko delete kar dega kyunki replicas do jagah likhe hain',
              'Deployment apply hi nahi hoga; API Server replicas aur HPA ko saath allow nahi karta',
            ],
            answer: 1,
            explain: 'HPA Deployment ka replicas badalta hai; Git mein 2 likha hai; ArgoCD ko farak dikhta hai aur ArgoCD use "theek" kar deta hai. Hal: HPA wale Deployment ke YAML se replicas hata do (ya ArgoCD mein us field ko ignoreDifferences mein daalo).',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — autoscaling',
      instructions: 'HPA ka formula aur uske jaal — dono poochhe jaate hain. 🎤',
      questions: [
        {
          q: '"HPA replicas ki ginti kaise nikalta hai? Ek misaal do."',
          choices: [
            'desired = abhi ke replicas + 1, jab tak CPU target se neeche na aa jaye; har 15 second mein ek pod',
            'desired = ceil(abhi ke replicas × abhi ka metric ÷ target); jaise 3 pods, 120% CPU, target 60% → 6',
            'desired = node ke khaali CPU ÷ pod ki CPU limit; jitne pods node par aa sakte hain utne',
            'desired = maxReplicas, jaise hi CPU target ko paar kare; HPA seedha chhat par jaata hai',
          ],
          answer: 1,
          explain: 'Formula anupaat ka hai, isliye HPA ek hi kadam mein sahi ginti par pahunch jaata hai (ek-ek pod nahi badhata). Saath mein bolo: 10% ke andar ka farak HPA nazarandaz karta hai, aur ginti min/max ke beech rehti hai.',
        },
        {
          q: '"kubectl get hpa mein TARGETS &lt;unknown&gt;/60% hai. Kya-kya jaanchoge?"',
          context: 'NAME      REFERENCE            TARGETS         MINPODS   MAXPODS   REPLICAS\npay-api   Deployment/pay-api   <unknown>/60%   2         10        2',
          choices: [
            'HPA ka maxReplicas — &lt;unknown&gt; ka matlab hai ki HPA chhat par pahunch chuka hai',
            'Node ka CPU — &lt;unknown&gt; tab aata hai jab node par CPU bilkul khaali ho',
            'describe hpa ke Events; phir metrics-server aur container ki CPU request',
            'Deployment ka image — &lt;unknown&gt; ka matlab hai ki image mein metrics endpoint nahi hai',
          ],
          answer: 2,
          explain: 'Do hi aam wajah hain: (1) metrics-server nahi chal raha → kubectl top bhi fail hoga. (2) container mein CPU request nahi → "missing request for cpu". describe hpa ke Events seedha bata dete hain kaun si.',
        },
        {
          q: '"HPA ka CPU target 90% rakhna kyun khatarnak ho sakta hai?"',
          choices: [
            'Kyunki 90% par kernel pods ko throttle karna shuru kar deta hai, chahe limit ho ya na ho',
            'Kyunki HPA 80% se upar ke target ko maanta hi nahi aur chupchaap 80% par kaam karta hai',
            'Kyunki HPA tab scale karta hai jab pods lagbhag bhar chuke hon; naye pod aane tak headroom nahi bachta',
            'Kyunki 90% target par HPA scale-down kabhi nahi karta aur pods hamesha max par rehte hain',
          ],
          answer: 2,
          explain: 'Naye pod ko schedule + image pull + start + readiness mein samay lagta hai (aksar 30–90 s, naya node chahiye ho toh aur zyada). Us dauraan purane pods ko hi load uthana hai. Target jitna ooncha, utni kam jagah.',
        },
      ],
    },
    success: [
      'Main HPA ka formula haath se laga sakta hoon',
      'Main &lt;unknown&gt; wale HPA ki wajah describe se nikaal kar theek kar sakta hoon',
      'Main target, minReplicas aur maxReplicas ko load ke hisaab se chun sakta hoon',
    ],
    homework: `<p>Asli cluster par: <b>🧪 Real Lab 10 — HPA</b> (Home → Real Cluster Labs). Wahan asli load daalkar HPA ko scale hote dekho.</p>
      <pre>kubectl get hpa -A                      # koi &lt;unknown&gt; hai?
kubectl describe hpa &lt;naam&gt;             # Events padho
kubectl top pods                        # metrics-server chal raha hai?</pre>`,
    cards: [
      { front: 'HPA ka formula?', back: '<code>desired = ceil(abhi ke replicas × abhi ka metric ÷ target metric)</code>. Har 15 s. Jaise ceil(2 × 150 ÷ 60) = 5.' },
      { front: 'HPA ka "CPU 60%" kis ka 60% hai?', back: 'Pod ki <b>CPU request</b> ka. Request na ho → <code>&lt;unknown&gt;</code> → HPA kuch nahi karta.' },
      { front: 'TARGETS <code>&lt;unknown&gt;</code> ki do aam wajah?', back: '(1) metrics-server nahi chal raha (<code>kubectl top</code> fail). (2) container mein CPU request nahi ("missing request for cpu"). <code>kubectl describe hpa</code> ke Events dekho.' },
      { front: 'HPA scale-down mein 5 minute kyun leta hai?', back: 'Stabilization window (default 300 s): pichhle 5 min ka sabse bada jawab maana jaata hai, taaki pods upar-neeche na jhoolen.' },
      { front: 'HPA + GitOps ka jaal?', back: 'Deployment ke YAML mein <code>replicas</code> likha ho toh ArgoCD har sync par HPA ka number mita deta hai. Hal: replicas ko YAML se hatao.' },
    ],
  },
]);

})();
