/* =====================================================================
   KubeGurukul — Track: 🌐 Networking & EKS Gurukul  (2026-11)
   "Bahar ka user pod tak kaise pahunchta hai — aur pod AWS tak kaise?"

   Kahani wahi company: ChaiPay. Cluster: EKS (AWS), naam chaipay-prod, region ap-south-1.
     gw-api        Gateway API: bahar ka traffic andar lana
     net-certs     cert-manager + ExternalDNS: HTTPS certificate aur DNS apne aap
     eks-identity  pod ko AWS ki pehchaan (EKS Pod Identity / IRSA)
     eks-vpccni    VPC CNI: har pod ko VPC ka IP — aur IP khatam hona
     eks-alb       AWS Load Balancer Controller: ALB, target type, deploy ke dauraan 502
   Scenes isi file mein hain (VISUALS[...] = …).
   ===================================================================== */
(function () {

/* ------------------------------------------------------------------ */
/* LEVEL 1 — Gateway API                                               */
/* ------------------------------------------------------------------ */
VISUALS['gw-api'] = {
  t: 'Gateway API — teen objects, teen zimmedaar',
  scene: {
    intro: '<b>Sawal:</b> user <code>https://pay.chaipay.in</code> kholta hai. Request <code>pay-api</code> pod tak kin objects se hokar pahunchti hai — aur har object kiski zimmedari hai?',
    aria: 'Gateway API ka raasta: GatewayClass, Gateway, HTTPRoute, Service, pods — 6 kadam',
    nodes: [
      { id: 'user', col: 0, row: 0, icon: '📱', label: 'User', sub: 'pay.chaipay.in', about: 'Bahar ka user, internet se.' },
      { id: 'gw', col: 1, row: 0, icon: '🚪', label: 'Gateway: public-gw', sub: 'port 443, TLS', tone: 'accent', about: 'Cluster ka bahar ka darwaza: ek asli load balancer. <b>Platform team</b> ka object. Yahin tay hota hai: kaun sa port, kaun sa certificate, aur kaun se namespaces apne routes jod sakte hain.' },
      { id: 'gc', col: 2, row: 0, icon: '🏭', label: 'GatewayClass', sub: 'kaun sa controller', about: 'Batata hai ki Gateway ko asal mein kaun banayega (AWS, Envoy, Cilium…). <b>Infra provider</b> ka object. Tum ise bas naam se chunte ho.' },
      { id: 'route', col: 1, row: 1, icon: '🧭', label: 'HTTPRoute: pay-route', sub: 'host + path → Service', tone: 'gold', about: 'Raaste ke niyam: kaun sa host, kaun sa path, kis Service ko, kitne pratishat. <b>App team</b> ka object — apne namespace mein.' },
      { id: 'v1', col: 0, row: 1, icon: '📦', label: 'Service: pay-api-v1', sub: 'purana version', tone: 'good' },
      { id: 'v2', col: 2, row: 1, icon: '📦', label: 'Service: pay-api-v2', sub: 'naya version', tone: 'good' },
    ],
    steps: [
      { from: 'gc', to: 'gw', label: 'load balancer banao', say: '<b>GatewayClass</b> batata hai ki kaun sa controller kaam karega. Platform team ek <b>Gateway: public-gw</b> likhti hai; controller uske liye ek asli load balancer bana deta hai.' },
      { from: 'route', to: 'gw', label: 'parentRef: public-gw', tone: 'gold', say: 'App team apne namespace mein <b>HTTPRoute: pay-route</b> likhti hai aur kehti hai: "mujhe public-gw se jodo" (<code>parentRefs</code>). Route tabhi judta hai jab Gateway us namespace ko ijaazat de (<code>allowedRoutes</code>).' },
      { from: 'user', to: 'gw', label: 'HTTPS 443', say: '<b>User</b> ki request <b>Gateway: public-gw</b> par aati hai. Gateway TLS kholta hai aur host ka naam dekhta hai: <code>pay.chaipay.in</code>.' },
      { from: 'gw', to: 'route', label: 'kaun sa route?', say: '<b>Gateway: public-gw</b> us route ko dhoondhta hai jiska host aur path request se milta hai: <b>HTTPRoute: pay-route</b>.' },
      { from: 'route', to: 'v1', label: 'weight 90', tone: 'good', say: '<b>HTTPRoute: pay-route</b> mein do backends likhe hain. 100 mein se 90 requests <b>Service: pay-api-v1</b> ko jaati hain.' },
      { from: 'route', to: 'v2', label: 'weight 10', tone: 'good', say: 'Baaki 10 requests <b>Service: pay-api-v2</b> ko. Yahi canary hai — ek YAML ki do lines se, kisi annotation ke bina. Dhyaan do: Gateway platform team ka hai, HTTPRoute app team ka; dono ek doosre ke kaam mein dakhal nahi dete.' },
    ],
  },
};

const T_GW = [
  { text: 'HTTPRoute <code>pay-route</code> ka status padho — Gateway ne route ko maana ya nahi?', check: s => s.history.some(h => /^kubectl describe (httproutes?)[ \/]pay-route\b/.test(h)) },
  { text: 'Gateway <code>public-gw</code> ka listener dekho — kaun se namespaces route jod sakte hain?', check: s => s.history.some(h => /^kubectl describe (gateways?|gtw)[ \/]public-gw\b/.test(h)) },
  { text: 'Sahi fix lagao: sirf <code>payments</code> namespace ko ijaazat mile', check: s => !!s.cluster.gwFixed },
  { text: 'Pakka karo: <code>kubectl get httproute</code> mein ACCEPTED ab <code>True</code> hai', check: s => !!s.cluster.gwVerified },
  { text: 'Canary lagao: 90% traffic v1 ko, 10% v2 ko', check: s => !!s.cluster.canary },
  { text: '20 requests bhej kar bantwara dekho (<code>bash send-20-requests.sh</code>)', check: s => !!s.cluster.sawSplit },
];
const routeDesc = c => `Name:         pay-route\nNamespace:    payments\nSpec:\n  Hostnames:  pay.chaipay.in\n  Parent Refs:\n    Name:       public-gw\n    Namespace:  infra\n  Rules:\n    Backend Refs:\n` +
  (c.canary ? '      Name: pay-api-v1   Port: 8080   Weight: 90\n      Name: pay-api-v2   Port: 8080   Weight: 10\n' : '      Name: pay-api-v1   Port: 8080   Weight: 100\n') +
  `Status:\n  Parents:\n    Parent Ref:  infra/public-gw\n    Conditions:\n      Type:     Accepted\n      Status:   ${c.gwFixed ? 'True' : 'False'}\n      Reason:   ${c.gwFixed ? 'Accepted' : 'NotAllowedByListeners'}\n` +
  (c.gwFixed ? '      Type:     ResolvedRefs\n      Status:   True\n      Reason:   ResolvedRefs' : '      Message:  No listener of Gateway infra/public-gw allows routes from namespace "payments"\n(route sahi likha hai — par Gateway ne use joda hi nahi. Isliye user ko 404 milta hai. Gateway ka listener dekho.)');
const gwDesc = c => `Name:         public-gw\nNamespace:    infra\nSpec:\n  Gateway Class Name:  aws-alb\n  Listeners:\n    Name:      https\n    Port:      443\n    Protocol:  HTTPS\n    Allowed Routes:\n      Namespaces:\n        From:  ${c.gwFixed ? 'Selector\n        Selector:\n          Match Labels:\n            gateway-access:  public' : 'Same        <-- sirf Gateway ke APNE namespace (infra) ke routes jud sakte hain'}\nStatus:\n  Addresses:  k8s-infra-publicgw-1a2b3c.ap-south-1.elb.amazonaws.com\n  Listeners:\n    Name:             https\n    Attached Routes:  ${c.gwFixed ? 1 : 0}`;

/* ------------------------------------------------------------------ */
/* LEVEL 2 — cert-manager + ExternalDNS                                */
/* ------------------------------------------------------------------ */
VISUALS['net-certs'] = {
  t: 'HTTPS certificate apne aap — cert-manager aur ExternalDNS',
  scene: {
    intro: '<b>Sawal:</b> naye host <code>pay.chaipay.in</code> ke liye HTTPS certificate chahiye. Kaun maangta hai, kaun deta hai, aur dene wale ko kaise bharosa hota hai ki yeh domain tumhara hi hai?',
    aria: 'certificate ka safar: Certificate object, cert-manager, ExternalDNS, DNS, Let\'s Encrypt ki jaanch, Secret — 7 kadam',
    nodes: [
      { id: 'cert', col: 0, row: 0, icon: '📜', label: 'Certificate: pay-tls', sub: 'Ready: False', tone: 'gold', about: 'Tumhara likha hua object: "mujhe pay.chaipay.in ka certificate chahiye, Secret pay-tls mein rakho". Yeh sirf maang hai.' },
      { id: 'cm', col: 1, row: 0, icon: '🤖', label: 'cert-manager', sub: 'certificate laata hai', tone: 'accent', about: 'Cluster ka add-on. Certificate object dekh kar Let\'s Encrypt se asli certificate laata hai, aur expire hone se pehle khud naya le aata hai.' },
      { id: 'le', col: 2, row: 0, icon: '🏛️', label: 'Let\'s Encrypt', sub: 'certificate deta hai', about: 'Muft certificate dene wali sanstha. Dene se pehle jaanchti hai ki domain sach mein tumhare kabze mein hai (challenge).' },
      { id: 'sec', col: 0, row: 1, icon: '🗝️', label: 'Secret: pay-tls', sub: 'abhi nahi bana', tone: 'muted', about: 'Yahan certificate (tls.crt) aur private key (tls.key) rakhe jaate hain. Gateway isi Secret se HTTPS chalata hai.' },
      { id: 'edns', col: 1, row: 1, icon: '📇', label: 'ExternalDNS', sub: 'DNS record banata hai', about: 'Doosra add-on. Gateway/Ingress ke host dekh kar Route 53 mein DNS record khud banata hai.' },
      { id: 'dns', col: 2, row: 1, icon: '🌍', label: 'Route 53 (DNS)', sub: 'pay.chaipay.in → ?', about: 'AWS ki DNS service. Yahi batati hai ki pay.chaipay.in kis load balancer par jaata hai.' },
    ],
    steps: [
      { from: 'cert', to: 'cm', label: 'certificate chahiye', tone: 'gold', say: 'Tum <b>Certificate: pay-tls</b> likhte ho. <b>cert-manager</b> ko naya Certificate dikhta hai.' },
      { from: 'cm', to: 'le', label: 'Order', say: '<b>cert-manager</b> <b>Let\'s Encrypt</b> ko ek <b>Order</b> bhejta hai: "pay.chaipay.in ka certificate do".' },
      { from: 'le', to: 'cm', label: 'Challenge: saabit karo', bend: 24, say: '<b>Let\'s Encrypt</b> kehta hai: "saabit karo ki domain tumhara hai. Main <code>http://pay.chaipay.in/.well-known/acme-challenge/…</code> kholunga — wahan ek khaas token milna chahiye." Is jaanch ka naam <b>HTTP-01 challenge</b> hai.' },
      { from: 'edns', to: 'dns', label: 'record banao', say: 'Challenge tabhi paas hoga jab <code>pay.chaipay.in</code> ka DNS record ho. <b>ExternalDNS</b> Gateway ka host dekh kar <b>Route 53 (DNS)</b> mein record banata hai: pay.chaipay.in → load balancer.', set: { dns: { sub: 'pay.chaipay.in → LB ✓', tone: 'good' } } },
      { from: 'le', to: 'dns', label: 'pay.chaipay.in kahan?', say: '<b>Let\'s Encrypt</b> DNS se poochhta hai, load balancer tak pahunchta hai, aur token wala page kholta hai. Token mil gaya → challenge paas.' },
      { from: 'le', to: 'cm', label: 'certificate', tone: 'good', bend: -24, say: '<b>Let\'s Encrypt</b> certificate de deta hai (90 din ka).' },
      { from: 'cm', to: 'sec', label: 'tls.crt + tls.key', tone: 'good', set: { sec: { sub: 'certificate rakha hai ✓', tone: 'good' }, cert: { sub: 'Ready: True ✓', tone: 'good' } }, say: '<b>cert-manager</b> certificate ko <b>Secret: pay-tls</b> mein rakhta hai. <b>Certificate: pay-tls</b> ab <code>Ready: True</code> hai. 60 din baad cert-manager yahi poora chakkar khud dobara chalayega — koi insaan nahi chahiye.' },
    ],
  },
};

const T_CERT = [
  { text: '<code>kubectl describe certificate pay-tls</code> — Certificate kis cheez ka intezaar kar raha hai?', check: s => s.history.some(h => /^kubectl describe (certificates?|cert)[ \/]pay-tls\b/.test(h)) },
  { text: 'Kadi ke aakhir tak jao: <code>kubectl describe challenge</code> — Let\'s Encrypt ki jaanch kyun fail ho rahi hai?', check: s => s.history.some(h => /^kubectl describe (challenges?)\b/.test(h)) },
  { text: 'DNS record kaun banata hai? Us add-on ke logs dekho', check: s => s.history.some(h => /^kubectl logs (deploy(ment)?\/)?external-dns\b/.test(h)) },
  { text: 'Asli wajah theek karo', check: s => !!s.cluster.dnsFixed },
  { text: 'Pakka karo: <code>kubectl get certificate</code> mein READY ab <code>True</code> hai', check: s => !!s.cluster.certOk },
];
const certDesc = c => c.dnsFixed
  ? 'Name:         pay-tls\nNamespace:    infra\nSpec:\n  Dns Names:    pay.chaipay.in\n  Issuer Ref:   ClusterIssuer/letsencrypt-prod\n  Secret Name:  pay-tls\nStatus:\n  Conditions:\n    Type:    Ready\n    Status:  True\n    Reason:  Ready\n    Message: Certificate is up to date and has not expired\n  Not After:     2027-02-12T06:40:11Z\n  Renewal Time:  2027-01-13T06:40:11Z      <-- cert-manager isi din khud naya certificate layega'
  : 'Name:         pay-tls\nNamespace:    infra\nSpec:\n  Dns Names:    pay.chaipay.in\n  Issuer Ref:   ClusterIssuer/letsencrypt-prod\n  Secret Name:  pay-tls\nStatus:\n  Conditions:\n    Type:    Ready\n    Status:  False\n    Reason:  DoesNotExist\n    Message: Issuing certificate as Secret does not exist\n    Type:    Issuing\n    Status:  True\n    Message: Waiting on certificate issuance from order infra/pay-tls-1-2847039: "pending"\nEvents:\n  Normal  Requested  22m  cert-manager  Created new CertificateRequest resource "pay-tls-1"\n(Certificate khud kuch nahi karta — Certificate ek Order ka intezaar kar raha hai. Kadi mein aage badho: kubectl get order, kubectl describe challenge)';
const chalDesc = c => c.dnsFixed
  ? 'No resources found in infra namespace.\n(challenge paas hokar hat gaya — paas hua challenge cert-manager khud saaf kar deta hai)'
  : 'Name:         pay-tls-1-2847039-3712\nNamespace:    infra\nSpec:\n  Dns Name:  pay.chaipay.in\n  Type:      HTTP-01\nStatus:\n  Presented:   true\n  Processing:  true\n  State:       pending\n  Reason:      Waiting for HTTP-01 challenge propagation: failed to perform self check GET request \'http://pay.chaipay.in/.well-known/acme-challenge/kJ8s…\': Get "http://pay.chaipay.in/.well-known/acme-challenge/kJ8s…": dial tcp: lookup pay.chaipay.in on 10.96.0.10:53: no such host\n(dhyaan do aakhri shabd: "no such host". pay.chaipay.in ka DNS record hai hi nahi. cert-manager theek hai — DNS gayab hai.)';

KG.registerLevels('eksnet', [
  /* ================================================================== */
  {
    id: 'gw-api',
    icon: '🚪',
    title: 'Gateway API — bahar ka traffic andar, aur Ingress ke baad ki duniya',
    badge: 'Gateway Guru',
    objectives: [
      'Ingress ki seema, aur Gateway API teen objects mein kaam kyun baantta hai',
      '<b>GatewayClass</b>, <b>Gateway</b>, <b>HTTPRoute</b> — kaun kiska zimmedaar',
      'Route "juda" hai ya nahi: <code>Accepted</code> condition padhna',
      'Atke hue HTTPRoute ko theek karna + 90/10 canary lagana (terminal)',
    ],
    lesson: [
      `<h3>🏢 Misaal: mall aur dukaanein</h3>
       <p>Ek mall mein teen log alag kaam karte hain:</p>
       <ul>
         <li><b>Builder</b> tay karta hai ki darwaze kis company ke lagenge.</li>
         <li><b>Mall ka manager</b> tay karta hai ki mukhya darwaza kahan hai, kab khulta hai, aur kaun si dukaanein board laga sakti hain.</li>
         <li><b>Dukaandaar</b> apna board lagata hai: "chai — pehli manzil, baayen".</li>
       </ul>
       <p>Purana <b>Ingress</b> in teeno kaamon ko <b>ek hi object</b> mein thoons deta tha, aur har controller ke apne annotations the.</p>
       <p><b>Gateway API</b> teeno ko alag karta hai:</p>
       <table>
         <tr><th>Object</th><th>Mall mein</th><th>Zimmedaar</th></tr>
         <tr><td><b>GatewayClass</b></td><td>Darwaze ki company</td><td>Infra provider</td></tr>
         <tr><td><b>Gateway</b></td><td>Mukhya darwaza</td><td>Platform team</td></tr>
         <tr><td><b>HTTPRoute</b></td><td>Dukaan ka board</td><td>App team</td></tr>
       </table>`,
      `<h3>🧭 HTTPRoute: niyam YAML mein, annotation mein nahi</h3>
       <pre>apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: pay-route
  namespace: payments            # app team ka namespace
spec:
  parentRefs:
    - name: public-gw            # kis Gateway se judna hai
      namespace: infra
  hostnames: ["pay.chaipay.in"]
  rules:
    - backendRefs:
        - name: pay-api-v1
          port: 8080
          weight: 90             # 90% purane ko
        - name: pay-api-v2
          port: 8080
          weight: 10             # 10% naye ko (canary)</pre>
       <p><b>Do taraf ki haan:</b> route kehta hai "mujhe is Gateway se jodo" (<code>parentRefs</code>).
       Gateway kehta hai "main in namespaces ke routes leta hoon" (<code>allowedRoutes</code>). Dono haan → route juda.</p>
       <p>Gateway ka default <code>allowedRoutes.namespaces.from: Same</code> hai: sirf Gateway ke <b>apne</b> namespace ke routes.</p>`,
      `<h3>🔎 Route juda ya nahi? Status padho</h3>
       <p>Gateway API ki sabse kaam ki cheez: har route apne <code>status</code> mein batata hai ki kya hua.</p>
       <pre>kubectl describe httproute pay-route
...
Conditions:
  Type:    Accepted
  Status:  False
  Reason:  NotAllowedByListeners</pre>
       <table>
         <tr><th>Condition</th><th>False ka matlab</th></tr>
         <tr><td><code>Accepted</code></td><td>Gateway ne route ko liya hi nahi (namespace allowed nahi, host nahi mila)</td></tr>
         <tr><td><code>ResolvedRefs</code></td><td>Route mein likha Service nahi mila, ya doosre namespace ka hai aur ijaazat nahi</td></tr>
       </table>
       <p><b>Ingress kyun chhodein?</b> Ingress ka API ab aage nahi badh raha — naye features sirf Gateway API mein aate hain.
       Aur sabse mash-hoor Ingress controller (community ka <code>ingress-nginx</code>) March 2026 mein retire ho gaya: ab use naye security fixes nahi milte.
       Naya kaam Gateway API par shuru karo.</p>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Kaun sa kaam, kaun sa object?',
        instructions: 'Baayen ek zaroorat hai. Daayen Gateway API ka woh object jisme yeh zaroorat likhi jaati hai.',
        pairs: [
          { left: '"Is cluster mein Gateways AWS ke controller se banenge"', right: 'GatewayClass', explain: 'GatewayClass batata hai ki kaun sa controller Gateway ko asli load balancer mein badlega.' },
          { left: '"Port 443 par HTTPS suno, yeh certificate use karo"', right: 'Gateway (listener)', explain: 'Port, protocol aur TLS Gateway ke listener mein likhe jaate hain. Platform team ka kaam.' },
          { left: '"pay.chaipay.in ka /refund path refund-svc ko bhejo"', right: 'HTTPRoute (rules)', explain: 'Host, path aur backend ke niyam HTTPRoute mein. App team apne namespace mein likhti hai.' },
          { left: '"Sirf payments namespace is Gateway par route jod sakta hai"', right: 'Gateway (allowedRoutes)', explain: 'Kaun jud sakta hai, yeh Gateway tay karta hai — route khud ko zabardasti nahi jod sakta.' },
          { left: '"infra ka route payments ke Service ko traffic bhej sakta hai"', right: 'ReferenceGrant', explain: 'Doosre namespace ke object ki taraf ishaara karne ke liye us namespace ki ijaazat chahiye: ReferenceGrant.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: route likha hai, phir bhi 404',
        instructions: 'App team ne pay.chaipay.in ke liye HTTPRoute banaya. User ko 404 mil raha hai. Platform team tum ho.',
        goal: `<b>pay-route</b> (namespace <code>payments</code>) user tak nahi pahunch raha. Route ka <b>status</b> padho, Gateway ka listener dekho, aur aisa fix lagao ki sirf <code>payments</code> namespace ko ijaazat mile.
          Phir canary lagao: 90% <code>pay-api-v1</code>, 10% <code>pay-api-v2</code>.`,
        tasks: T_GW,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: 'pay-api-v1-6b8d7c-a1', ready: '1/1', status: 'Running', restarts: 0, age: '6d', node: 'node-1', ip: '10.0.1.20' },
            { name: 'pay-api-v2-9c7e5d-b1', ready: '1/1', status: 'Running', restarts: 0, age: '1h', node: 'node-1', ip: '10.0.1.24' },
          ],
          services: [
            { name: 'pay-api-v1', type: 'ClusterIP', clusterIP: '172.20.11.3', ports: '8080/TCP', age: '40d' },
            { name: 'pay-api-v2', type: 'ClusterIP', clusterIP: '172.20.11.9', ports: '8080/TCP', age: '1h' },
          ],
          custom: {
            gateway: { names: ['gateway', 'gateways', 'gtw'], cols: ['NAME', 'CLASS', 'ADDRESS', 'PROGRAMMED', 'AGE'],
              items: [{ name: 'public-gw', row: ['aws-alb', 'k8s-infra-publicgw-1a2b3c.ap-south-1.elb.amazonaws.com', 'True', '40d'], describe: s => gwDesc(s.cluster) }] },
            httproute: { names: ['httproute', 'httproutes'], cols: ['NAME', 'HOSTNAMES', 'ACCEPTED', 'AGE'],
              items: [{ name: 'pay-route', row: ['["pay.chaipay.in"]', 'False', '35m'], describe: s => routeDesc(s.cluster) }] },
            gatewayclass: { names: ['gatewayclass', 'gatewayclasses', 'gc'], cols: ['NAME', 'CONTROLLER', 'ACCEPTED', 'AGE'],
              items: [{ name: 'aws-alb', row: ['gateway.k8s.aws/alb', 'True', '40d'] }] },
          },
        },
        responses: [
          { re: /^kubectl get (httproutes?)\b/, mutate: s => { if (s.cluster.gwFixed) s.cluster.gwVerified = true; },
            out: s => 'NAME        HOSTNAMES            ACCEPTED   AGE\npay-route   ["pay.chaipay.in"]   ' + (s.cluster.gwFixed ? 'True ' : 'False') + '      35m' +
              (s.cluster.gwFixed ? '' : '\n(ACCEPTED False = Gateway ne route ko joda hi nahi. Wajah: kubectl describe httproute pay-route)') },
        ],
        files: {
          'fix-gateway-allow-payments.yaml': {
            desc: 'Gateway ke listener mein allowedRoutes: label gateway-access=public wale namespaces; aur payments namespace par wahi label',
            content: 'apiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: public-gw\n  namespace: infra\nspec:\n  gatewayClassName: aws-alb\n  listeners:\n    - name: https\n      port: 443\n      protocol: HTTPS\n      allowedRoutes:\n        namespaces:\n          from: Selector                 # pehle: Same\n          selector:\n            matchLabels:\n              gateway-access: public\n---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: payments\n  labels:\n    gateway-access: public             # sirf label wale namespaces jud sakte hain',
            apply: s => { s.cluster.gwFixed = true; return 'gateway.gateway.networking.k8s.io/public-gw configured\nnamespace/payments labeled\n(ab label gateway-access=public wale namespaces is Gateway par route jod sakte hain — abhi sirf payments)'; },
          },
          'fix-gateway-allow-all.yaml': {
            desc: 'Gateway ke listener mein allowedRoutes.namespaces.from: All',
            apply: () => '(simulator ne roka) from: All se pay-route jud jayega — aur cluster ka HAR namespace is public Gateway par apna route jod payega. Koi bhi team (ya compromise hua namespace) pay.chaipay.in ka traffic apni taraf mod sakti hai. Mission ki shart: sirf payments ko ijaazat.',
          },
          'fix-move-route-to-infra.yaml': {
            desc: 'pay-route ko payments namespace se infra namespace mein le jaata hai',
            apply: () => '(simulator ne roka) Route infra mein jud jayega, par do nayi problem: (1) ab app team ko apna route badalne ke liye infra namespace ki ijaazat chahiye, (2) infra ka route payments ke Service ki taraf ishaara karega — iske liye ReferenceGrant chahiye. Gateway API ka maqsad ulta hai: route app team ke apne namespace mein rahe.',
          },
          'pay-route-canary.yaml': {
            desc: 'pay-route mein do backends: pay-api-v1 weight 90, pay-api-v2 weight 10',
            content: 'apiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: pay-route\n  namespace: payments\nspec:\n  parentRefs:\n    - name: public-gw\n      namespace: infra\n  hostnames: ["pay.chaipay.in"]\n  rules:\n    - backendRefs:\n        - name: pay-api-v1\n          port: 8080\n          weight: 90\n        - name: pay-api-v2\n          port: 8080\n          weight: 10',
            apply: s => { s.cluster.canary = true; return 'httproute.gateway.networking.k8s.io/pay-route configured' + (s.cluster.gwFixed ? '\n(90/10 ka bantwara lagu. Jaancho: bash send-20-requests.sh)' : '\n(niyam badal gaye, par route abhi bhi Gateway se juda nahi hai — ACCEPTED False. Traffic aayega hi nahi.)'); },
          },
          'send-20-requests.sh': {
            desc: 'pay.chaipay.in par 20 requests bhejta hai aur ginta hai ki kis version ne jawab diya',
            content: '#!/bin/sh\nfor i in $(seq 1 20); do\n  curl -s https://pay.chaipay.in/version\n  echo\ndone | sort | uniq -c',
            apply: s => {
              const c = s.cluster;
              if (!c.gwFixed) return '     20 404 page not found\n(Gateway ke paas pay.chaipay.in ke liye koi juda hua route nahi hai)';
              if (!c.canary) return '     20 pay-api v1\n(saari requests v1 ko — route mein abhi ek hi backend hai)';
              c.sawSplit = true;
              return '     18 pay-api v1\n      2 pay-api v2\n(20 mein se 18 v1 ko aur 2 v2 ko: lagbhag 90/10. v2 mein gadbad nikle toh sirf 10% users par asar — aur wapas jaana ek line ka badlaav hai.)';
            },
          },
        },
        success: KG.allOf(T_GW),
        successText: `Route sahi likha tha; Gateway ne use <b>joda</b> hi nahi tha. <code>Accepted: False, Reason: NotAllowedByListeners</code> ne seedha bataya ki rukawat Gateway ke <code>allowedRoutes</code> mein hai (default: <code>Same</code>).
          Tumne darwaza sabke liye nahi khola (<code>All</code>) — sirf label wale namespace ke liye. Phir do lines se 90/10 canary.
          <b>Yaad rakho:</b> Gateway API mein "kaam kyun nahi kar raha" ka jawab lagbhag hamesha object ke <code>status.conditions</code> mein likha hota hai.`,
        hints: [
          'kubectl get httproute → ACCEPTED column. Phir kubectl describe httproute pay-route — Reason padho.',
          'kubectl describe gateway public-gw → Allowed Routes → From: Same. ls se fix files dekho; har file ka desc padho (cat <file>).',
          'kubectl apply -f fix-gateway-allow-payments.yaml, kubectl get httproute, kubectl apply -f pay-route-canary.yaml, bash send-20-requests.sh',
        ],
        solution: [
          'kubectl get httproute',
          'kubectl describe httproute pay-route',
          'kubectl describe gateway public-gw',
          'kubectl apply -f fix-gateway-allow-payments.yaml',
          'kubectl get httproute',
          'kubectl apply -f pay-route-canary.yaml',
          'bash send-20-requests.sh',
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — Gateway API',
        questions: [
          {
            q: 'HTTPRoute ka status: Accepted True, par ResolvedRefs False (Reason: BackendNotFound). User ko kya milega, aur kyun?',
            choices: [
              '404 — Gateway ne route ko joda hi nahi',
              'Error — route juda hai, par usme likha Service nahi mila',
              'Sab theek chalega — ResolvedRefs sirf ek chetavni hai',
              'TLS error — ResolvedRefs ka rishta certificate se hai',
            ],
            answer: 1,
            explain: 'Accepted True = Gateway ne route liya. ResolvedRefs False = backendRefs mein likha Service nahi mila (naam ki galti, galat port, ya doosra namespace bina ReferenceGrant). Request aati hai par bhejne ko jagah nahi. Service ka naam aur namespace jaancho.',
          },
          {
            q: 'Platform team chahti hai ki app teams apne routes khud sambhalen, par Gateway (port, TLS) ko na chhu saken. Gateway API mein yeh kaise hota hai?',
            choices: [
              'Har app team ko Gateway object par edit ki RBAC ijaazat dekar',
              'Gateway infra namespace mein, HTTPRoute app ke namespace mein; RBAC alag',
              'Sab kuch ek hi YAML file mein rakh kar aur code review se',
              'Yeh mumkin nahi — route aur Gateway hamesha ek hi namespace mein hote hain',
            ],
            answer: 1,
            explain: 'Yahi Gateway API ka asli faayda hai: do alag objects, do alag namespaces, do alag RBAC. App team sirf apne namespace mein HTTPRoute likh sakti hai; Gateway ko chhune ki ijaazat nahi hoti. Gateway ka allowedRoutes tay karta hai ki kaun se namespaces jud sakte hain.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — ingress aur Gateway API',
      instructions: '2026 mein yeh sawal lagbhag har platform interview mein hai. 🎤',
      questions: [
        {
          q: '"Ingress aur Gateway API mein kya farak hai? Naye project mein kya chunoge?"',
          choices: [
            'Koi farak nahi — Gateway API Ingress ka sirf naya naam hai; dono ke YAML ek jaise hain',
            'Ingress ek object + annotations; Gateway API kaam ko teen objects mein baantta hai — naya kaam isi par',
            'Gateway API sirf service mesh ke liye hai; bahar ke traffic ke liye Ingress hi chalta hai',
            'Ingress tez hai kyunki usme kam objects hain; Gateway API sirf bade clusters ke liye hai',
          ],
          answer: 1,
          explain: 'Teen baatein bolo: (1) role ke hisaab se bantwara (infra / platform / app), (2) features YAML mein, annotations mein nahi — weights, header match, cross-namespace, (3) status conditions se debug. Aur Ingress ka API ab jama hua hai; naye features Gateway API mein aate hain.',
        },
        {
          q: '"HTTPRoute apply ho gaya, koi error nahi, par traffic nahi aa raha. Pehla command?"',
          choices: [
            'kubectl logs — route ke pod ke logs dekhunga',
            'kubectl describe httproute — status ki conditions padhunga',
            'kubectl delete httproute — aur dobara apply karunga',
            'kubectl get nodes — dekhunga ki koi node NotReady toh nahi',
          ],
          answer: 1,
          explain: 'HTTPRoute ka koi pod nahi hota. Sach uske status mein hai: Accepted False → Gateway ki taraf dekho (allowedRoutes, hostname). ResolvedRefs False → backend Service ki taraf dekho.',
        },
        {
          q: '"Gateway API se canary deploy kaise karoge?"',
          choices: [
            'Do Gateways banakar aur DNS mein 90/10 ka weighted record lagakar',
            'HTTPRoute ke backendRefs mein do Services aur unke weight (90 aur 10) likhkar',
            'Deployment ke replicas 9 aur 1 rakhkar — traffic apne aap bant jaata hai',
            'Gateway par annotation canary-weight: "10" lagakar',
          ],
          answer: 1,
          explain: 'backendRefs mein har Service ka weight. Yeh controller se azad, standard YAML hai. (Replicas ke anupaat se bantwara mota hota hai aur autoscaling ke saath bigad jaata hai.)',
        },
      ],
    },
    success: [
      'Main GatewayClass, Gateway aur HTTPRoute ki zimmedari alag-alag bata sakta hoon',
      'Main HTTPRoute ke status se pata kar sakta hoon ki route kyun nahi juda',
      'Main HTTPRoute ke weights se canary laga sakta hoon',
    ],
    homework: `<p>Jis cluster mein Gateway API laga ho, wahan:</p>
      <pre>kubectl get gatewayclass,gateway -A
kubectl get httproute -A
kubectl describe httproute &lt;naam&gt; -n &lt;ns&gt;      # Accepted / ResolvedRefs</pre>`,
    cards: [
      { front: 'Gateway API ke teen objects aur unke zimmedaar?', back: '<b>GatewayClass</b> (infra provider) · <b>Gateway</b> (platform team: port, TLS, allowedRoutes) · <b>HTTPRoute</b> (app team: host, path, backends).' },
      { front: 'Route Gateway se kab judta hai?', back: 'Do taraf ki haan: route ka <code>parentRefs</code> + Gateway ka <code>allowedRoutes</code> (default <code>Same</code> = sirf apna namespace).' },
      { front: 'HTTPRoute ki do status conditions?', back: '<code>Accepted</code> (Gateway ne liya?) · <code>ResolvedRefs</code> (backend Service mila?).' },
      { front: 'Gateway API mein 90/10 canary?', back: '<code>backendRefs</code> mein do Services: <code>weight: 90</code> aur <code>weight: 10</code>.' },
      { front: 'Naye kaam ke liye Ingress kyun nahi?', back: 'Ingress API jama hua hai; naye features Gateway API mein. Community ka ingress-nginx March 2026 mein retire ho gaya.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'net-certs',
    icon: '📜',
    title: 'cert-manager aur ExternalDNS — HTTPS aur DNS, bina haath lagaye',
    badge: 'Certificate Sardar',
    objectives: [
      'Certificate haath se kyun nahi: expire hona hi sabse aam outage hai',
      'cert-manager ki kadi: Certificate → Order → Challenge',
      'HTTP-01 aur DNS-01 challenge ka farak',
      'Atke hue Certificate ko kadi-dar-kadi debug karna (terminal)',
    ],
    lesson: [
      `<h3>⏰ Problem: certificate jo kisi ko yaad nahi tha</h3>
       <p>HTTPS certificate ki ek umr hoti hai. Let's Encrypt ka certificate <b>90 din</b> chalta hai.</p>
       <p>Haath se sambhaloge toh kahani hamesha ek hi hoti hai: kisi ne ek saal pehle certificate lagaya, calendar mein reminder daala,
       phir woh insaan team chhod gaya. Ek subah saare users ko "Your connection is not private" dikhta hai.</p>
       <p><b>Asli baat:</b> certificate ka expire hona koi rare hadsa nahi — yeh <b>tay tareekh</b> wala outage hai. Iska ek hi ilaaj hai: insaan ko beech se hata do.</p>
       <p>Do add-ons yeh kaam karte hain:</p>
       <ul>
         <li><b>cert-manager</b> — certificate laata hai aur expire hone se pehle khud badalta hai.</li>
         <li><b>ExternalDNS</b> — Gateway/Ingress ke host dekh kar DNS record khud banata hai.</li>
       </ul>`,
      `<h3>⛓️ cert-manager ki kadi</h3>
       <p>Tum bas ek <b>Certificate</b> object likhte ho. Baaki objects cert-manager khud banata hai:</p>
       <pre>Certificate          "mujhe pay.chaipay.in ka cert chahiye"
  └─ CertificateRequest   ek baar ki maang
       └─ Order              Let's Encrypt ke paas order
            └─ Challenge       "saabit karo ki domain tumhara hai"</pre>
       <p><b>Debug ka niyam:</b> upar se neeche chalo. Har object apne <code>describe</code> mein batata hai ki woh agle ka intezaar kar raha hai.
       Asli wajah lagbhag hamesha <b>sabse neeche</b> — Challenge mein — likhi hoti hai.</p>
       <pre>kubectl describe certificate pay-tls
kubectl get order
kubectl describe challenge</pre>
       <p>cert-manager certificate ko ek <b>Secret</b> mein rakhta hai (<code>tls.crt</code>, <code>tls.key</code>), aur umr ke do-tihai hisse par (90 din wale ke liye ~60 din) khud naya le aata hai.</p>`,
      `<h3>🧪 Challenge: "saabit karo ki domain tumhara hai"</h3>
       <table>
         <tr><th></th><th>HTTP-01</th><th>DNS-01</th></tr>
         <tr><td>Let's Encrypt kya jaanchta hai</td><td>Ek URL: <code>http://domain/.well-known/acme-challenge/…</code></td><td>Ek DNS TXT record: <code>_acme-challenge.domain</code></td></tr>
         <tr><td>Kya chahiye</td><td>Domain ka DNS record + internet se port 80 khula</td><td>DNS provider (Route 53) mein record likhne ki ijaazat</td></tr>
         <tr><td>Wildcard (<code>*.chaipay.in</code>)</td><td>❌ nahi</td><td>✅ haan</td></tr>
         <tr><td>Private cluster (internet se band)</td><td>❌ nahi</td><td>✅ haan</td></tr>
       </table>
       <p><b>ExternalDNS ka jaal:</b> ExternalDNS sirf un domains ke record banata hai jo uske <code>--domain-filter</code> mein likhe hain.
       Filter galat ho toh ExternalDNS chupchaap record nahi banata — aur HTTP-01 challenge "no such host" par atak jaata hai.</p>
       <p><b>Test ke liye:</b> Let's Encrypt ka <b>staging</b> issuer use karo. Asli (prod) issuer par ginti ki seema hai — baar-baar fail hue toh kuch der ke liye block.</p>`,
    ],
    stages: [
      {
        type: 'order',
        title: 'Certificate ka safar — sahi kram',
        instructions: 'Ek naye host ke liye certificate banne tak ke kadam sahi kram mein lagao.',
        steps: [
          { text: 'Tum Certificate object likhte ho (dnsNames, secretName, issuerRef)', explain: 'Yahi ek object tumhara kaam hai. Baaki sab cert-manager karta hai.' },
          { text: 'cert-manager ek CertificateRequest aur phir ek Order banata hai', explain: 'Order = Let\'s Encrypt ke paas "is domain ka certificate do" ki maang.' },
          { text: 'Let\'s Encrypt ek Challenge deta hai: "saabit karo ki domain tumhara hai"', explain: 'Bina saboot ke koi bhi kisi ke domain ka certificate le leta.' },
          { text: 'cert-manager challenge ka jawab taiyaar karta hai (token wala URL ya TXT record)', explain: 'HTTP-01 mein ek chhota sa route; DNS-01 mein ek TXT record.' },
          { text: 'Let\'s Encrypt jawab jaanchta hai; challenge paas hota hai', explain: 'Yahin sabse zyada cheezein atakti hain: DNS record nahi, port 80 band, galat ijaazat.' },
          { text: 'cert-manager certificate ko Secret mein rakhta hai; Certificate Ready: True', explain: 'Gateway/Ingress isi Secret se HTTPS chalata hai. 60 din baad yahi chakkar khud dobara.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: Certificate 22 minute se Ready nahi',
        instructions: 'Naya host pay.chaipay.in aaj launch hona hai. Browser "connection is not private" dikha raha hai. Certificate pay-tls atka hua hai.',
        goal: `<b>Certificate pay-tls</b> 22 minute se <code>Ready: False</code> hai. Kadi mein upar se neeche chalo — <b>Certificate → Order → Challenge</b> — aur asli wajah theek karo.`,
        tasks: T_CERT,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [
            { name: 'cert-manager-7d9c8b6f5-q2w4e', ready: '1/1', status: 'Running', restarts: 0, age: '40d', node: 'node-1', ip: '10.0.1.8',
              logs: 'I1114 cert-manager/challenges "msg"="propagation check failed" "dnsName"="pay.chaipay.in" "err"="failed to perform self check GET request: no such host"\n(cert-manager theek chal raha hai; cert-manager baar-baar keh raha hai ki domain ka naam hi nahi mil raha)' },
            { name: 'external-dns-5c8f7d9b4-r7t1y', ready: '1/1', status: 'Running', restarts: 0, age: '40d', node: 'node-1', ip: '10.0.1.9',
              logs: 'time="2026-11-14T06:18:02Z" level=info msg="Instantiating new Kubernetes client"\ntime="2026-11-14T06:18:03Z" level=info msg="config: {DomainFilter:[chaipay.com] Provider:aws Policy:upsert-only}"\ntime="2026-11-14T06:19:03Z" level=debug msg="Skipping record pay.chaipay.in because it was filtered out by the specified --domain-filter"\ntime="2026-11-14T06:20:03Z" level=info msg="All records are already up to date"\n(dhyaan do: DomainFilter mein chaipay.com likha hai. Host pay.chaipay.IN hai.)' },
          ],
          deployments: [{ name: 'cert-manager', ready: '1/1', upToDate: 1, available: 1, age: '40d' }, { name: 'external-dns', ready: '1/1', upToDate: 1, available: 1, age: '40d' }],
          custom: {
            certificate: { names: ['certificate', 'certificates', 'cert'], cols: ['NAME', 'READY', 'SECRET', 'AGE'],
              items: [{ name: 'pay-tls', row: ['False', 'pay-tls', '22m'], describe: s => certDesc(s.cluster) }] },
            order: { names: ['order', 'orders'], cols: ['NAME', 'STATE', 'AGE'],
              items: [{ name: 'pay-tls-1-2847039', row: ['pending', '22m'], describe: 'Name:    pay-tls-1-2847039\nStatus:\n  State:  pending\n  Authorizations:\n    Identifier:  pay.chaipay.in\n    Challenges:  http-01\n(Order ek Challenge ke paas hone ka intezaar kar raha hai: kubectl describe challenge)' }] },
            challenge: { names: ['challenge', 'challenges'], cols: ['NAME', 'STATE', 'DOMAIN', 'AGE'],
              items: [{ name: 'pay-tls-1-2847039-3712', row: ['pending', 'pay.chaipay.in', '22m'], describe: s => chalDesc(s.cluster) }] },
          },
        },
        responses: [
          { re: /^kubectl get (certificates?|cert)\b/, mutate: s => { if (s.cluster.dnsFixed) s.cluster.certOk = true; },
            out: s => 'NAME      READY   SECRET    AGE\npay-tls   ' + (s.cluster.dnsFixed ? 'True ' : 'False') + '   pay-tls   ' + (s.cluster.dnsFixed ? '25m\n(ExternalDNS ne record banaya → challenge paas → certificate Secret pay-tls mein rakha gaya)' : '22m') },
        ],
        files: {
          'fix-external-dns-domain.yaml': {
            desc: 'ExternalDNS ka --domain-filter chaipay.com se chaipay.in karta hai',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: external-dns\nspec:\n  template:\n    spec:\n      containers:\n        - name: external-dns\n          args:\n            - --source=gateway-httproute\n            - --provider=aws\n            - --domain-filter=chaipay.in      # pehle: chaipay.com\n            - --policy=upsert-only',
            apply: s => {
              const c = s.cluster;
              c.dnsFixed = true;
              c.pods.find(p => /^external-dns/.test(p.name)).logs = 'level=info msg="config: {DomainFilter:[chaipay.in] Provider:aws Policy:upsert-only}"\nlevel=info msg="Desired change: CREATE pay.chaipay.in A"\nlevel=info msg="Desired change: CREATE pay.chaipay.in TXT"\nlevel=info msg="2 record(s) were successfully updated"';
              c.custom.certificate.items[0].row = ['True', 'pay-tls', '25m'];
              c.custom.order.items[0].row = ['valid', '25m'];
              c.custom.challenge.items = [];
              return 'deployment.apps/external-dns configured\n(ExternalDNS dobara chala: Route 53 mein pay.chaipay.in ka record ban gaya. cert-manager agli koshish mein challenge paas kar lega.)';
            },
          },
          'recreate-certificate.sh': {
            desc: 'Certificate pay-tls ko delete karke dobara banata hai',
            content: '#!/bin/sh\nkubectl delete certificate pay-tls\nkubectl apply -f certificate-pay-tls.yaml',
            apply: s => s.cluster.dnsFixed ? 'certificate "pay-tls" deleted\ncertificate/pay-tls created\n(zaroorat nahi thi — Certificate pehle hi Ready tha)' : 'certificate "pay-tls" deleted\ncertificate/pay-tls created\n(naya Order bana, naya Challenge bana — aur wahi "no such host". DNS record ab bhi nahi hai. Aur dhyaan do: baar-baar fail hone wale Orders Let\'s Encrypt ki ginti ki seema ke kareeb le jaate hain.)',
          },
          'fix-restart-cert-manager.yaml': {
            desc: 'cert-manager pod ko restart karta hai',
            apply: () => 'deployment.apps/cert-manager restarted\n(kuch nahi badla. cert-manager apna kaam sahi kar raha tha: woh Let\'s Encrypt ki jaanch ke liye taiyaar hai. Jaanch DNS par fail ho rahi hai.)',
          },
        },
        success: KG.allOf(T_CERT),
        successText: `Kadi upar se neeche: <b>Certificate</b> ne kaha "Order ka intezaar" → <b>Order</b> ne kaha "Challenge ka intezaar" → <b>Challenge</b> ne asli wajah di: <code>no such host</code>.
          Certificate ki problem asal mein <b>DNS</b> ki problem thi: ExternalDNS ka <code>--domain-filter</code> <code>chaipay.com</code> tha, host <code>chaipay.in</code>. ExternalDNS ne chupchaap record nahi banaya.
          <b>Yaad rakho:</b> cert-manager ko restart ya Certificate ko delete karna ilaaj nahi hai. Kadi ke sabse neeche wale object ka <code>describe</code> padho.`,
        hints: [
          'kubectl describe certificate pay-tls → "Waiting on certificate issuance from order". Phir kubectl get order aur kubectl describe challenge.',
          'Challenge kehta hai "no such host": pay.chaipay.in ka DNS record nahi hai. DNS record ExternalDNS banata hai: kubectl logs external-dns-5c8f7d9b4-r7t1y',
          'DomainFilter chaipay.com hai. kubectl apply -f fix-external-dns-domain.yaml, phir kubectl get certificate.',
        ],
        solution: [
          'kubectl get certificate',
          'kubectl describe certificate pay-tls',
          'kubectl get order',
          'kubectl describe challenge',
          'kubectl logs external-dns-5c8f7d9b4-r7t1y',
          'kubectl apply -f fix-external-dns-domain.yaml',
          'kubectl get certificate',
        ],
      },
      {
        type: 'bins',
        title: 'HTTP-01 ya DNS-01?',
        instructions: 'Har zaroorat ke liye sahi challenge chuno.',
        bins: [
          { id: 'http', label: '🌐 HTTP-01 (URL ki jaanch)' },
          { id: 'dns', label: '📇 DNS-01 (TXT record ki jaanch)' },
        ],
        items: [
          { text: 'Wildcard certificate: *.chaipay.in', bin: 'dns', explain: 'Wildcard sirf DNS-01 se milta hai. HTTP-01 ek-ek host ko jaanchta hai.' },
          { text: 'Public website; DNS provider ki koi API key nahi dena chahte', bin: 'http', explain: 'HTTP-01 ko DNS mein likhne ki ijaazat nahi chahiye — bas port 80 internet se khula ho.' },
          { text: 'Internal dashboard jo internet se pahunch mein hi nahi hai', bin: 'dns', explain: 'Let\'s Encrypt internal URL tak nahi pahunch sakta. DNS-01 mein use sirf public DNS ka TXT record dekhna hota hai.' },
          { text: 'Ek saada public API: api.chaipay.in', bin: 'http', explain: 'Ek host, public, port 80 khula — HTTP-01 sabse saada hai.' },
          { text: 'Load balancer par port 80 security niyam se band hai', bin: 'dns', explain: 'HTTP-01 port 80 par hi jaanch karta hai. Port band ho toh DNS-01.' },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — TLS aur DNS automation',
      instructions: 'Chhota topic, par outage ki kahaniyon mein sabse upar. 🎤',
      questions: [
        {
          q: '"cert-manager ka Certificate Ready nahi ho raha. Kaise debug karoge?"',
          choices: [
            'cert-manager ke pod ko restart karunga; zyadatar baar isi se theek ho jaata hai',
            'Kadi mein neeche chalunga: Certificate → Order → Challenge; wajah Challenge mein hoti hai',
            'Certificate ko delete karke dobara banaunga jab tak Ready na ho jaye',
            'Secret ko haath se bana dunga aur usme purana certificate daal dunga',
          ],
          answer: 1,
          explain: 'Har object agle ka intezaar karta hai. Asli wajah (DNS nahi, port band, ijaazat nahi) Challenge ke Reason mein likhi hoti hai. Baar-baar delete karna Let\'s Encrypt ki ginti ki seema tak pahuncha sakta hai.',
        },
        {
          q: '"Wildcard certificate ke liye kaun sa challenge chahiye, aur uske liye cluster ko kya ijaazat deni padti hai?"',
          choices: [
            'HTTP-01; cluster ko sirf port 80 khula rakhna hota hai',
            'DNS-01; cert-manager ko DNS mein TXT record likhne ki ijaazat',
            'Koi bhi; wildcard dono challenge se mil jaata hai',
            'TLS-ALPN-01; cluster ko node ke port 443 ki ijaazat chahiye',
          ],
          answer: 1,
          explain: 'Wildcard sirf DNS-01 se. cert-manager ko Route 53 mein _acme-challenge record likhna hota hai — EKS par yeh ijaazat Pod Identity / IRSA se dete hain, sirf usi hosted zone tak seemit.',
        },
        {
          q: '"Certificate renewal ko insaan par kyun nahi chhodna chahiye?"',
          choices: [
            'Kyunki insaan certificate banana jaante hi nahi; yeh kaam sirf machine kar sakti hai',
            'Kyunki haath se banaya certificate browsers mein kaam nahi karta',
            'Kyunki expire hone ki tareekh tay hai aur log badalte rehte hain — bhoolna pakka hai',
            'Kyunki Let\'s Encrypt insaanon ko certificate deta hi nahi',
          ],
          answer: 2,
          explain: 'Yeh "kabhi-kabhi hone wali galti" nahi, tay tareekh wala outage hai. Automation (cert-manager) + ek alert ("certificate 14 din mein expire hoga aur renew nahi hua") = do deewarein.',
        },
      ],
    },
    success: [
      'Main cert-manager ki kadi (Certificate → Order → Challenge) samjha sakta hoon',
      'Main atke hue Certificate ki wajah Challenge se nikaal sakta hoon',
      'Main HTTP-01 aur DNS-01 mein se sahi challenge chun sakta hoon',
    ],
    homework: `<p>Jis cluster mein cert-manager ho, wahan:</p>
      <pre>kubectl get certificate -A                  # koi READY False hai?
kubectl get certificate -A -o custom-columns=NAME:.metadata.name,EXPIRES:.status.notAfter
kubectl get challenge -A                    # atke hue challenges</pre>`,
    cards: [
      { front: 'cert-manager ki kadi?', back: 'Certificate → CertificateRequest → Order → Challenge. Debug upar se neeche; wajah Challenge mein.' },
      { front: 'HTTP-01 aur DNS-01 ka farak?', back: '<b>HTTP-01</b>: ek URL ki jaanch; DNS record + port 80 chahiye; wildcard nahi. <b>DNS-01</b>: TXT record; DNS mein likhne ki ijaazat chahiye; wildcard aur private cluster ke liye.' },
      { front: 'Challenge mein "no such host". Kahan dekhoge?', back: 'DNS record nahi bana. ExternalDNS ke logs (<code>--domain-filter</code>, ijaazat) dekho.' },
      { front: 'cert-manager certificate kahan rakhta hai, aur kab badalta hai?', back: 'Ek <b>Secret</b> mein (<code>tls.crt</code>, <code>tls.key</code>). Umr ke ~2/3 par khud naya (90 din wale ke liye ~60 din).' },
    ],
  },
]);

/* ------------------------------------------------------------------ */
/* LEVEL 3 — pod ko AWS ki pehchaan                                    */
/* ------------------------------------------------------------------ */
VISUALS['eks-identity'] = {
  t: 'EKS Pod Identity — pod ko AWS ka apna, chhota sa role',
  scene: {
    intro: '<b>Sawal:</b> <code>notify</code> pod ko SQS queue padhni hai. AWS ko kaise pata chalega ki yeh request <code>notify</code> ki hai — aur notify ko sirf isi queue ki ijaazat kaise milegi?',
    aria: 'EKS Pod Identity ka raasta: pod, agent, EKS Auth API, IAM role, SQS, aur node ka role — 6 kadam',
    nodes: [
      { id: 'pod', col: 0, row: 0, icon: '📦', label: 'pod: notify', sub: 'SA: notify-sa', tone: 'good', about: 'Pod ke andar AWS SDK chalta hai. SDK ko AWS ke credentials chahiye.' },
      { id: 'agent', col: 1, row: 0, icon: '🤝', label: 'Pod Identity Agent', sub: 'har node par', tone: 'accent', about: 'EKS ka add-on, DaemonSet. Pod ka SDK credentials isi agent se maangta hai.' },
      { id: 'eks', col: 2, row: 0, icon: '☸️', label: 'EKS Auth API', sub: 'association dekhta hai', about: 'AWS ki taraf ka hissa. Dekhta hai: is cluster + namespace + ServiceAccount ke liye kaun sa IAM role likha hai (association).' },
      { id: 'node', col: 0, row: 1, icon: '🖥️', label: 'Node ka IAM Role', sub: 'saare pods ka saanjha', tone: 'bad', about: 'EC2 node ka apna role. Node ke saare pods is tak pahunch sakte hain. Ise app ki ijaazat dena galat hai.' },
      { id: 'sqs', col: 1, row: 1, icon: '📬', label: 'SQS: notify-queue', sub: 'notify ka kaam', about: 'Woh AWS resource jise notify ko padhna hai.' },
      { id: 'role', col: 2, row: 1, icon: '🪪', label: 'IAM Role', sub: 'notify-sqs-role', tone: 'gold', about: 'Sirf notify ke liye bana role. Ijaazat: sirf notify-queue se padhna. Aur kuch nahi.' },
    ],
    steps: [
      { from: 'pod', to: 'agent', label: 'credentials do', say: '<b>pod: notify</b> ke andar AWS SDK credentials maangta hai. Request node par chal rahe <b>Pod Identity Agent</b> ke paas jaati hai — pod ke ServiceAccount token ke saath.' },
      { from: 'agent', to: 'eks', label: 'payments / notify-sa', say: '<b>Pod Identity Agent</b> token ko <b>EKS Auth API</b> tak pahunchata hai: "namespace payments, ServiceAccount notify-sa — iske liye kaun sa role?"' },
      { from: 'eks', to: 'role', label: 'association mila', tone: 'gold', say: '<b>EKS Auth API</b> associations ki list dekhta hai. Likha hai: payments + notify-sa → <b>IAM Role</b> <code>notify-sqs-role</code>. Namespace ya naam ek akshar bhi alag ho toh association nahi milta.' },
      { from: 'eks', to: 'agent', label: 'thodi der ke credentials', tone: 'good', bend: 24, say: '<b>EKS Auth API</b> us role ke <b>temporary</b> credentials lautata hai (kuch ghanton ke). <b>Pod Identity Agent</b> unhe pod ko de deta hai. Koi key kahin likhi nahi gayi.' },
      { from: 'pod', to: 'sqs', label: 'ReceiveMessage', tone: 'good', say: '<b>pod: notify</b> ab <code>notify-sqs-role</code> ban kar <b>SQS: notify-queue</b> ko call karta hai. AWS ko dikhta hai: call karne wala notify hai, aur notify ko sirf isi queue ki ijaazat hai.' },
      { from: 'pod', to: 'node', label: 'association nahi mila', tone: 'bad', say: 'Agar association <b>nahi</b> milta, aur pod node ke metadata tak pahunch sakta hai, toh SDK chupchaap <b>Node ka IAM Role</b> use kar leta hai. Nateeja: <code>AccessDenied</code> — ya AccessDenied se bhi bura: zaroorat se zyada ijaazat.' },
    ],
  },
};

const ID_NODE = 'arn:aws:sts::111122223333:assumed-role/eks-node-role/i-0a1b2c3d4e5f6';
const ID_GOOD = 'arn:aws:sts::111122223333:assumed-role/notify-sqs-role/eks-chaipay-pr-notify-7a6-4f1c';
const idOk = s => !!(s.cluster.assoc && s.cluster.restarted);
const notifyLogs = s => idOk(s)
  ? 'notify starting...\nSQS: connected to notify-queue (ap-south-1)\nreceived 10 messages\nsent 10 SMS'
  : `notify starting...\nSQS ReceiveMessage failed: AccessDenied: User: ${ID_NODE} is not authorized to perform: sqs:ReceiveMessage on resource: arn:aws:sqs:ap-south-1:111122223333:notify-queue because no identity-based policy allows the sqs:ReceiveMessage action\n(dhyaan do "assumed-role/eks-node-role": AWS ko notify nahi, NODE dikh raha hai)`;
const callerId = s => `{\n    "UserId": "AROAEXAMPLEID:${idOk(s) ? 'eks-chaipay-pr-notify-7a6-4f1c' : 'i-0a1b2c3d4e5f6'}",\n    "Account": "111122223333",\n    "Arn": "${idOk(s) ? ID_GOOD : ID_NODE}"\n}` +
  (idOk(s) ? '\n(ab AWS ko notify-sqs-role dikh raha hai — notify ki apni pehchaan)' : '\n(Arn mein eks-node-role hai: pod node ki pehchaan use kar raha hai, apni nahi)');
const notifyPod = name => ({ name, ready: '1/1', status: 'Running', restarts: 0, age: '2h', node: 'node-1', ip: '10.0.1.21', logs: notifyLogs, exec: { 'aws sts get-caller-identity': callerId } });
const T_ID = [
  { text: 'notify ke logs padho — AWS ko kaun si pehchaan dikh rahi hai?', check: s => s.history.some(h => /^kubectl logs (deploy(ment)?\/)?notify\b/.test(h)) },
  { text: 'Pod ke andar se pehchaan pakki karo: <code>kubectl exec deploy/notify -- aws sts get-caller-identity</code>', check: s => s.history.some(h => /^kubectl exec .*notify\S* -- aws sts get-caller-identity$/.test(h)) },
  { text: 'Cluster ke Pod Identity associations dekho', check: s => s.history.some(h => /^aws eks list-pod-identity-associations\b/.test(h)) },
  { text: 'Sahi association banao (namespace <code>payments</code>, ServiceAccount <code>notify-sa</code>)', check: s => !!s.cluster.assoc },
  { text: 'notify ke pods ko dobara banao — chalte pod ko naye credentials nahi milte', check: s => idOk(s) },
  { text: 'Pakka karo: <code>get-caller-identity</code> ab <code>notify-sqs-role</code> dikhata hai', check: s => idOk(s) && s.history.slice(s.cluster.restartedAt).some(h => /get-caller-identity$/.test(h)) },
];
function recreateNotify(s) {
  const c = s.cluster;
  c.pods = c.pods.filter(p => !/^notify-/.test(p.name));
  c.pods.unshift(notifyPod('notify-7a6b5c-m4'));
  c.pods[0].age = '10s';
  if (c.assoc) { c.restarted = true; c.restartedAt = s.history.length; }
}

/* ------------------------------------------------------------------ */
/* LEVEL 4 — VPC CNI aur IP khatam hona                                */
/* ------------------------------------------------------------------ */
VISUALS['eks-vpccni'] = {
  t: 'VPC CNI — har pod ko VPC ka ek asli IP',
  scene: {
    intro: '<b>Sawal:</b> node par CPU aur memory khaali hai, phir bhi naya pod <code>ContainerCreating</code> mein atka hai. Pod ko kaun si cheez nahi mil rahi?',
    aria: 'VPC CNI kaise pod ko IP deta hai aur subnet ke IP kaise khatam hote hain — 6 kadam',
    groups: [{ label: '🖥️ Node (m5.large)', cols: [1, 2], rows: [0, 1], tone: 'good' }],
    nodes: [
      { id: 'sub', col: 0, row: 0, icon: '🏘️', label: 'Subnet 10.0.1.0/24', sub: '251 IP kul', tone: 'gold', about: 'VPC ka ek hissa. /24 subnet mein 256 pate hote hain; AWS 5 apne paas rakhta hai → 251 kaam ke. Nodes aur pods dono yahin se IP lete hain.' },
      { id: 'cni', col: 1, row: 0, icon: '🔌', label: 'VPC CNI (aws-node)', sub: 'IP ka intezaam', tone: 'accent', about: 'Har node par chalne wala add-on. Subnet se IP maangta hai aur pods ko deta hai. Kuch IP pehle se "garam" rakhta hai taaki naya pod tez shuru ho.' },
      { id: 'eni', col: 2, row: 0, icon: '🧷', label: 'ENI (network card)', sub: '3 ENI × 10 IP', about: 'Node ke network cards. Har instance type par ENI ki ginti aur har ENI par IP ki ginti tay hai. m5.large: 3 ENI, har ek par 10 IP.' },
      { id: 'pod', col: 1, row: 1, icon: '📦', label: 'naya pod', sub: 'ContainerCreating', tone: 'muted' },
      { id: 'old', col: 2, row: 1, icon: '📦', label: 'purane pods', sub: 'har ek ka apna VPC IP', tone: 'good' },
      { id: 'aws', col: 0, row: 1, icon: '☁️', label: 'VPC ki baaki duniya', sub: 'RDS, doosre VPC', about: 'Pod ka IP asli VPC IP hai, isliye RDS, security groups aur doosre VPC pod ko seedha dekh sakte hain.' },
    ],
    steps: [
      { from: 'cni', to: 'sub', label: 'IP do', say: '<b>VPC CNI (aws-node)</b> node ke shuru hote hi <b>Subnet 10.0.1.0/24</b> se IP maang leta hai — pods aane se <b>pehle</b>. Default mein VPC CNI ek poore khaali ENI jitne IP "garam" rakhta hai.' },
      { from: 'sub', to: 'eni', label: '10 IP', tone: 'gold', bend: 110, say: '<b>Subnet 10.0.1.0/24</b> ke IP <b>ENI (network card)</b> par chadh jaate hain. Ab 10 IP is node ke naam hain — chahe koi pod unhe use kare ya na kare.' },
      { from: 'eni', to: 'old', label: 'ek pod, ek IP', tone: 'good', say: 'Har pod ko ENI se ek asli VPC IP milta hai. m5.large par zyada se zyada <code>3 × (10 − 1) + 2 = 29</code> pods. CPU bacha ho tab bhi 30vaan pod is node par nahi aa sakta.' },
      { from: 'old', to: 'aws', label: 'seedha VPC IP', bend: 110, say: 'Faayda: <b>purane pods</b> ka IP asli VPC IP hai, toh <b>VPC ki baaki duniya</b> (RDS, security groups) pod se seedhi baat karti hai. Koi overlay nahi.' },
      { from: 'cni', to: 'sub', label: 'aur IP do', tone: 'bad', bend: 24, set: { sub: { sub: '0 IP bache', tone: 'bad' } }, say: 'Keemat: cluster badha, har node ne apne "garam" IP rakh liye, aur <b>Subnet 10.0.1.0/24</b> ke 251 IP khatam ho gaye. <b>VPC CNI (aws-node)</b> aur IP maangta hai — subnet ke paas dene ko kuch nahi.' },
      { at: ['pod'], set: { pod: { tone: 'bad', sub: 'IP nahi mila' } }, say: '<b>naya pod</b> node par schedule ho chuka hai, par IP ke bina sandbox nahi banta. Pod <code>ContainerCreating</code> mein atka rehta hai. Event: <code>failed to assign an IP address to container</code>. CPU aur memory ka IP ki kami se koi rishta nahi.' },
    ],
  },
};
const ITYPES = [{ n: 't3.medium', eni: 3, ip: 6 }, { n: 'm5.large', eni: 3, ip: 10 }, { n: 'm5.xlarge', eni: 4, ip: 15 }];
const SUBNETS = [{ n: '/24', ips: 251 }, { n: '/23', ips: 507 }, { n: '/22', ips: 1019 }];
/* saada model (asli ginti warm-pool ki settings par nirbhar karti hai) */
function cniModel(k) {
  const t = ITYPES[k.type], sub = SUBNETS[k.subnet], need = 600;
  const maxPods = k.pd ? 110 : t.eni * (t.ip - 1) + 2;
  const capacity = k.nodes * maxPods;
  const pods = Math.min(need, capacity);
  const ipNeed = k.pd
    ? k.nodes * (1 + 16 * (Math.ceil(pods / k.nodes / 16) + 1))
    : Math.min(k.nodes * t.eni * t.ip, pods + k.nodes * (t.eni + t.ip));
  const freePct = Math.round((sub.ips - ipNeed) / sub.ips * 100);
  return { t, sub, need, maxPods, capacity, ipNeed, freePct, fits: ipNeed <= sub.ips };
}

KG.registerLevels('eksnet', [
  /* ================================================================== */
  {
    id: 'eks-identity',
    icon: '🪪',
    title: 'Pod ko AWS ki pehchaan — EKS Pod Identity aur IRSA',
    badge: 'Pehchaan Pandit',
    objectives: [
      'Pod AWS (S3, SQS) ko call kare toh AWS ko <b>kaun</b> dikhta hai',
      'Teen tareeke: likhi hui key, node ka role, pod ka apna role — aur kaun sa sahi',
      'EKS Pod Identity ka association; IRSA ka annotation',
      '<code>AccessDenied</code> ko <code>aws sts get-caller-identity</code> se debug karna (terminal)',
    ],
    lesson: [
      `<h3>🏢 Misaal: office ka visitor pass</h3>
       <p>Ek delivery wala office building mein aata hai. Teen tareeke hain use andar bhejne ke:</p>
       <table>
         <tr><th>Tareeka</th><th>Kubernetes mein</th><th>Problem</th></tr>
         <tr><td>Use building ki <b>master chaabi</b> ki copy de do</td><td>AWS access key ko Secret mein likhna</td><td>Chaabi kabhi expire nahi hoti; ek baar leak → hamesha ke liye</td></tr>
         <tr><td>Use <b>guard ka pass</b> pehna do</td><td>Node ke IAM role ko ijaazat dena</td><td>Us node ka <b>har</b> pod wahi pass pehen leta hai</td></tr>
         <tr><td>Reception se <b>uske naam ka</b>, 4 ghante ka pass</td><td>Pod ka apna IAM role</td><td>— (yahi sahi hai)</td></tr>
       </table>
       <p><b>Asli baat:</b> AWS ke liye sawal hamesha yahi hai — "yeh request <b>kaun</b> bhej raha hai?" Tumhe pakka karna hai ki jawab "notify" ho, "koi node" nahi.</p>`,
      `<h3>🤝 EKS Pod Identity: teen cheezein</h3>
       <ol>
         <li><b>Agent</b>: add-on <code>eks-pod-identity-agent</code> (har node par).</li>
         <li><b>IAM role</b>: jiski ijaazat chhoti ho (sirf <code>notify-queue</code> padhna), aur jiska trust <code>pods.eks.amazonaws.com</code> par ho.</li>
         <li><b>Association</b>: "is cluster ke is namespace ke is ServiceAccount ko yeh role do".</li>
       </ol>
       <pre>aws eks create-pod-identity-association \\
  --cluster-name chaipay-prod \\
  --namespace payments --service-account notify-sa \\
  --role-arn arn:aws:iam::111122223333:role/notify-sqs-role</pre>
       <p><b>Do jaal:</b></p>
       <ul>
         <li>Namespace ya ServiceAccount ka naam ek akshar bhi galat → association kisi pod se nahi milta. <b>Koi error nahi aata.</b></li>
         <li>Association banane ke baad <b>chalte pods ko kuch nahi milta</b>. Pods ko dobara banana padta hai (<code>kubectl rollout restart</code>).</li>
       </ul>
       <p><b>IRSA</b> (purana tareeka, ab bhi bahut jagah): association ki jagah ServiceAccount par annotation
       <code>eks.amazonaws.com/role-arn</code>, aur IAM role ke trust policy mein <code>system:serviceaccount:payments:notify-sa</code> likha hota hai.</p>`,
      `<h3>🔎 AccessDenied? Pehle poochho "main kaun hoon"</h3>
       <pre>kubectl exec deploy/notify -- aws sts get-caller-identity</pre>
       <p>Jawab ke <code>Arn</code> mein jo role dikhta hai, wahi AWS ko dikh raha hai:</p>
       <table>
         <tr><th>Arn mein kya dikha</th><th>Matlab</th><th>Kahan dekhna hai</th></tr>
         <tr><td><code>…/eks-node-role/i-0a1b…</code></td><td>Pod <b>node</b> ki pehchaan use kar raha hai</td><td>Association / annotation; pod restart hua?</td></tr>
         <tr><td><code>…/notify-sqs-role/…</code> + AccessDenied</td><td>Pehchaan sahi, <b>ijaazat</b> kam</td><td>IAM role ki policy: action aur resource</td></tr>
         <tr><td>Error: <code>AssumeRoleWithWebIdentity</code> not authorized (IRSA)</td><td>Role pod par <b>bharosa</b> nahi karta</td><td>Trust policy mein namespace / SA ka naam</td></tr>
       </table>
       <p>AccessDenied ke error mein bhi yahi likha hota hai: <code>User: arn:aws:sts::…:assumed-role/<b>eks-node-role</b>/…</code>. Us ek shabd ko padhna seekh lo.</p>`,
    ],
    stages: [
      {
        type: 'match',
        title: 'Lakshan aur wajah',
        instructions: 'Baayen woh hai jo tumhe dikha. Daayen uski wajah.',
        pairs: [
          { left: 'get-caller-identity mein node ka role dikhta hai', right: 'Pod ko apna role mila hi nahi: association/annotation galat, ya pod restart nahi hua', explain: 'SDK ko pod ke credentials nahi mile, toh SDK node ke role par gir gaya.' },
          { left: 'Sahi role dikhta hai, phir bhi AccessDenied on sqs:ReceiveMessage', right: 'IAM role ki policy mein woh action ya woh queue nahi hai', explain: 'Pehchaan theek hai. Ijaazat ki list (policy) mein kami hai.' },
          { left: 'Association kal bana tha; pods 6 din purane hain; ab bhi node ka role', right: 'Chalte pods ko naye credentials nahi milte', explain: 'Credentials pod banne ke waqt jodne ka intezaam hota hai. kubectl rollout restart.' },
          { left: 'Do alag apps ke pods ko ek hi S3 bucket ki poori ijaazat mil gayi', right: 'Ijaazat node ke IAM role ko di gayi thi', explain: 'Node ka role us node ke har pod ka saanjha hai. App ki ijaazat kabhi node ke role par mat rakho.' },
        ],
      },
      {
        type: 'terminal',
        title: '🖥️ Mission: AccessDenied — par kis ko?',
        instructions: 'notify SQS queue nahi padh paa raha. DevOps team kehti hai "Pod Identity toh laga diya tha". Pata karo AWS ko asal mein kaun dikh raha hai.',
        goal: `<b>notify</b> ko <code>notify-queue</code> padhne ki ijaazat nahi mil rahi. Pata karo ki pod AWS ke saamne <b>kaun</b> ban kar ja raha hai, galti dhoondho, aur theek karo.<br>
          Kaam ke roop: <code>kubectl exec deploy/notify -- aws sts get-caller-identity</code> · <code>aws eks list-pod-identity-associations --cluster-name chaipay-prod</code>`,
        tasks: T_ID,
        cluster: {
          nodes: [{ name: 'node-1', status: 'Ready', roles: '<none>', age: '40d', version: 'v1.33.4' }],
          pods: [notifyPod('notify-5c9d4f-k3')],
          deployments: [{ name: 'notify', ready: '1/1', upToDate: 1, available: 1, age: '40d' }],
          custom: {
            sa: { names: ['sa', 'serviceaccount', 'serviceaccounts'], cols: ['NAME', 'SECRETS', 'AGE'],
              items: [{ name: 'default', row: ['0', '40d'] }, { name: 'notify-sa', row: ['0', '40d'], describe: 'Name:         notify-sa\nNamespace:    payments\nAnnotations:  <none>\n(Pod Identity mein ServiceAccount par annotation nahi hota — rishta AWS ki taraf "association" mein likha hota hai)' }] },
          },
        },
        responses: [
          { re: /^aws eks list-pod-identity-associations\b/,
            out: s => 'ASSOCIATION ID   NAMESPACE   SERVICE ACCOUNT   ROLE\na-9k2m4x7q1w3e   payment     notify-sa         notify-sqs-role' +
              (s.cluster.assoc ? '\na-5t8r2y6u0i4o   payments    notify-sa         notify-sqs-role' : '\n(NAMESPACE dhyaan se padho: "payment". notify ka namespace "payments" hai — ek akshar ka farak. Yeh association kisi pod se nahi milta, aur koi error bhi nahi deta.)') },
          { re: /^kubectl rollout restart (deploy|deployment|deployments)[ \/]notify$/, mutate: s => recreateNotify(s),
            out: s => 'deployment.apps/notify restarted' + (s.cluster.assoc ? '\n(naya pod notify-7a6b5c-m4 bana — is baar pod ko notify-sqs-role ke credentials mile)' : '\n(naya pod bana, par association abhi bhi galat namespace par hai — naye pod ko bhi node ka hi role mila)') },
          { re: /^kubectl delete (pods?|po)[ \/]notify\S*$/, mutate: s => recreateNotify(s),
            out: s => 'pod deleted\n(ReplicaSet ne naya pod notify-7a6b5c-m4 banaya' + (s.cluster.assoc ? ' — is baar notify-sqs-role ke credentials ke saath)' : ' — association abhi bhi galat hai, naye pod ko bhi node ka role mila)') },
          { re: /^aws\b/, err: true, out: 'Is mission mein laptop se aws ka yeh command chalta hai:\n  aws eks list-pod-identity-associations --cluster-name chaipay-prod\nPod ke andar se:\n  kubectl exec deploy/notify -- aws sts get-caller-identity' },
        ],
        files: {
          'fix-association.sh': {
            desc: 'Sahi association banata hai: namespace payments + ServiceAccount notify-sa → notify-sqs-role',
            content: '#!/bin/sh\naws eks create-pod-identity-association \\\n  --cluster-name chaipay-prod \\\n  --namespace payments \\\n  --service-account notify-sa \\\n  --role-arn arn:aws:iam::111122223333:role/notify-sqs-role\n# (galat wala association "payment" baad mein hata dena: aws eks delete-pod-identity-association …)',
            apply: s => { s.cluster.assoc = true; return '{\n    "association": { "namespace": "payments", "serviceAccount": "notify-sa", "roleArn": "arn:aws:iam::111122223333:role/notify-sqs-role" }\n}\n(association ban gaya. Dhyaan do: jo notify pod abhi chal raha hai, use kuch nahi mila. Credentials pod BANNE ke waqt jodte hain.)'; },
          },
          'fix-node-role-sqs.sh': {
            desc: 'Node ke IAM role (eks-node-role) ko sqs:* ki ijaazat deta hai',
            content: '#!/bin/sh\naws iam attach-role-policy --role-name eks-node-role --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess',
            apply: () => '(simulator ne roka) Isse notify chal jayega — aur is node ka HAR pod (pay-api, koi bhi naya pod, koi compromise hua pod) account ki har SQS queue padh aur mita sakega. Node ka role saanjha hai. Ijaazat pod ke apne role par honi chahiye.',
          },
          'fix-access-key-secret.yaml': {
            desc: 'Ek IAM user ki access key ko Secret mein rakhta hai aur notify ko env mein deta hai',
            apply: () => '(simulator ne roka) Access key kabhi expire nahi hoti. Secret, env, logs ya kisi backup se ek baar leak hui toh attacker ke paas hamesha ke liye hai — aur CloudTrail mein "notify" nahi, ek benaam user dikhega. Pod Identity ke credentials kuch ghanton mein khud badal jaate hain.',
          },
        },
        success: KG.allOf(T_ID),
        successText: `AccessDenied ka error khud bata raha tha ki AWS ko <code>eks-node-role</code> dikh raha hai, <code>notify</code> nahi. <code>get-caller-identity</code> ne pakka kiya.
          Wajah: association namespace <code>payment</code> par bana tha, pods <code>payments</code> mein hain. Ek akshar. Koi error nahi.
          Phir doosra jaal: association theek hone ke baad bhi purana pod node ke role par raha — <b>pod ko dobara banana pada</b>.
          <b>Yaad rakho:</b> AWS ki ijaazat ki har problem mein pehla sawal "ijaazat kya hai?" nahi, <b>"main kaun hoon?"</b> hai.`,
        hints: [
          'kubectl logs deploy/notify — error mein "assumed-role/…" ke baad kaun sa role likha hai? Phir kubectl exec deploy/notify -- aws sts get-caller-identity',
          'aws eks list-pod-identity-associations --cluster-name chaipay-prod — NAMESPACE column dhyaan se padho.',
          'bash fix-association.sh, phir kubectl rollout restart deployment notify, phir get-caller-identity dobara.',
        ],
        solution: [
          'kubectl logs deploy/notify',
          'kubectl exec deploy/notify -- aws sts get-caller-identity',
          'aws eks list-pod-identity-associations --cluster-name chaipay-prod',
          'bash fix-association.sh',
          'kubectl rollout restart deployment notify',
          'kubectl exec deploy/notify -- aws sts get-caller-identity',
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — pehchaan ke niyam',
        questions: [
          {
            q: 'Team ne "jaldi mein" node ke IAM role ko S3 ki poori ijaazat de di taaki ek app chal jaye. Isme sabse bada khatra kya hai?',
            choices: [
              'Node ka role 12 ghante mein expire ho jaata hai aur app ruk jayegi',
              'Us node par chalne wale har pod ko wahi S3 ijaazat mil jaati hai',
              'S3 ke requests dheeme ho jaate hain kyunki node beech mein aata hai',
              'Kuch nahi — node ka role sirf kubelet use kar sakta hai, pods nahi',
            ],
            answer: 1,
            explain: 'Node ka role saanjha hai. Ek compromise hua pod, ya kisi doosri team ka pod, wahi ijaazat pa leta hai. Isi liye app ki ijaazat pod ke apne role par (Pod Identity / IRSA), aur node ke metadata tak pods ki pahunch band.',
          },
          {
            q: 'IRSA wale cluster mein pod ko yeh error milta hai: "Not authorized to perform sts:AssumeRoleWithWebIdentity". Sabse pehle kya jaanchoge?',
            choices: [
              'IAM role ki permission policy — usme sqs:ReceiveMessage hai ya nahi',
              'IAM role ka trust policy — namespace aur ServiceAccount ka naam sahi hai?',
              'Pod ki CPU limit — AssumeRole CPU kam hone par fail hota hai',
              'SQS queue ki encryption settings',
            ],
            answer: 1,
            explain: 'Yeh error role "pehenne" ke waqt aata hai, kaam karne ke waqt nahi. Role ka trust policy tay karta hai ki kaun use pehen sakta hai: system:serviceaccount:NAMESPACE:SA. Naam ya namespace galat → AWS mana kar deta hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — EKS par AWS ki ijaazat',
      instructions: 'EKS wale role ke interview ka pakka sawal. 🎤',
      questions: [
        {
          q: '"EKS par pod ko S3 ki ijaazat kaise dete ho? Aur kya nahi karte?"',
          choices: [
            'Access key ko ConfigMap mein rakhta hoon; ConfigMap encrypted hota hai isliye surakshit hai',
            'Pod ke ServiceAccount ko ek chhota IAM role (Pod Identity ya IRSA); key ya node ka role nahi',
            'Node ke IAM role ko S3 ki ijaazat deta hoon; sabse saada aur AWS ka sujhaya hua tareeka yahi hai',
            'Har pod mein AWS CLI install karke aws configure chalata hoon',
          ],
          answer: 1,
          explain: 'Teen baatein: (1) har app ka apna ServiceAccount aur apna role, (2) role ki ijaazat ek hi resource tak, (3) credentials temporary. "Kya nahi" bhi bolo: likhi hui keys nahi, node ka role nahi.',
        },
        {
          q: '"EKS Pod Identity aur IRSA mein kya farak hai?"',
          choices: [
            'Pod Identity sirf Fargate par chalta hai aur IRSA sirf EC2 nodes par',
            'IRSA mein credentials hamesha ke liye hote hain; Pod Identity mein temporary',
            'IRSA: OIDC provider + SA par annotation. Pod Identity: agent + AWS ki taraf association',
            'Koi farak nahi — Pod Identity IRSA ka sirf naya naam hai',
          ],
          answer: 2,
          explain: 'Dono ka maqsad ek hai (pod ko apna role, temporary credentials). Pod Identity mein har cluster ke liye OIDC provider aur trust policy badalna nahi padta; ek hi role kai clusters mein chal jaata hai. IRSA ab bhi bahut jagah chal raha hai — dono padhna aana chahiye.',
        },
        {
          q: '"Pod ko AccessDenied mil raha hai. Tumhara pehla command?"',
          choices: [
            'aws iam list-policies — account ki saari policies dekhunga',
            'kubectl delete pod — naya pod aksar theek chal jaata hai',
            'Pod ke andar aws sts get-caller-identity — AWS ko kaun dikh raha hai',
            'kubectl top pod — AccessDenied aksar memory kam hone se aata hai',
          ],
          answer: 2,
          explain: 'Pehle "kaun", phir "kya". Node ka role dikhe → pehchaan ki problem (association/annotation/restart). Sahi role dikhe → ijaazat ki problem (policy). Yeh ek command aadha debug bacha deta hai.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki pod AWS ke saamne kaun ban kar jaata hai',
      'Main AccessDenied ko get-caller-identity se do hisson mein baant sakta hoon: pehchaan ya ijaazat',
      'Main Pod Identity ka association bana kar pods ko naye credentials dila sakta hoon',
    ],
    homework: `<p>EKS cluster par:</p>
      <pre>aws eks list-pod-identity-associations --cluster-name &lt;cluster&gt;
kubectl get sa -A -o yaml | grep -B3 eks.amazonaws.com/role-arn     # IRSA wale ServiceAccounts
kubectl exec deploy/&lt;app&gt; -- aws sts get-caller-identity            # kaun dikh raha hai?</pre>`,
    cards: [
      { front: 'Pod ko AWS ki ijaazat dene ke teen tareeke — kaun sa sahi?', back: 'Likhi hui key ❌ · node ka IAM role ❌ (saare pods ka saanjha) · pod ka apna role ✅ (Pod Identity / IRSA, temporary credentials).' },
      { front: 'EKS Pod Identity ki teen cheezein?', back: 'Agent add-on · chhota IAM role (trust: <code>pods.eks.amazonaws.com</code>) · association (cluster + namespace + ServiceAccount → role).' },
      { front: 'Association banane ke baad kya karna zaroori hai?', back: 'Pods ko dobara banana (<code>kubectl rollout restart</code>). Chalte pods ko naye credentials nahi milte.' },
      { front: 'AccessDenied ka pehla command?', back: '<code>kubectl exec deploy/APP -- aws sts get-caller-identity</code> — node ka role dikhe → pehchaan ki problem; sahi role → policy ki problem.' },
      { front: 'IRSA mein role aur ServiceAccount kaise jude hote hain?', back: 'SA par annotation <code>eks.amazonaws.com/role-arn</code>; role ke trust policy mein <code>system:serviceaccount:NS:SA</code>.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'eks-vpccni',
    icon: '🔌',
    title: 'VPC CNI — har pod ko VPC ka IP, aur IP khatam hona',
    badge: 'IP Inspector',
    objectives: [
      'EKS mein har pod ko <b>VPC ka asli IP</b> milta hai — faayda aur keemat',
      'Ek node par pods ki seema: <code>ENI × (IP − 1) + 2</code>',
      'Subnet ke IP khatam hone ke lakshan aur ilaaj (prefix delegation, bada subnet)',
      '600 pods ke liye cluster ka naap chunna (slider) + IP khatam hone ka case (triage)',
    ],
    lesson: [
      `<h3>🏘️ Misaal: colony ke makaan number</h3>
       <p>Ek colony mein <b>251 makaan number</b> hain. Har parivaar ko apna number chahiye — dak seedhi ghar aati hai.</p>
       <p>EKS mein:</p>
       <ul>
         <li><b>Subnet</b> = colony. <code>/24</code> subnet mein 251 kaam ke IP.</li>
         <li><b>Har pod</b> ko subnet ka ek <b>asli IP</b> milta hai (VPC CNI add-on deta hai).</li>
       </ul>
       <p><b>Faayda:</b> pod ka IP asli hai, toh RDS, security groups aur doosre VPC pod se seedhi baat karte hain. Koi overlay network nahi.</p>
       <p><b>Keemat:</b> IP ginti ke hain. 251 number khatam → naya parivaar nahi bas sakta, chahe zameen (CPU, memory) kitni bhi khaali ho.</p>
       <p><b>Asli baat:</b> EKS mein ek teesra resource hai jo CPU aur memory ki tarah khatam hota hai: <b>IP address</b>. Aur iska koi metric default dashboard par nahi hota.</p>`,
      `<h3>🧮 Ek node par kitne pods?</h3>
       <p>Node ke network cards (<b>ENI</b>) ginti ke hain, aur har ENI par IP ginti ke:</p>
       <pre>max pods = ENI × (har ENI ke IP − 1) + 2</pre>
       <table>
         <tr><th>Instance</th><th>ENI</th><th>IP / ENI</th><th>Max pods</th></tr>
         <tr><td>t3.medium</td><td>3</td><td>6</td><td>3 × 5 + 2 = <b>17</b></td></tr>
         <tr><td>m5.large</td><td>3</td><td>10</td><td>3 × 9 + 2 = <b>29</b></td></tr>
         <tr><td>m5.xlarge</td><td>4</td><td>15</td><td>4 × 14 + 2 = <b>58</b></td></tr>
       </table>
       <p><b>"Garam" IP:</b> VPC CNI naye pod ko tez shuru karne ke liye kuch IP pehle se pakad kar rakhta hai — default mein ek poore khaali ENI jitne.
       Yaani 10 pods wala m5.large node bhi 20–30 IP gher sakta hai.</p>`,
      `<h3>🩹 IP khatam: lakshan aur ilaaj</h3>
       <pre>NAME              READY   STATUS              AGE
pay-api-…-x7      0/1     ContainerCreating   9m

Warning  FailedCreatePodSandBox  ... failed to assign an IP address to container</pre>
       <table>
         <tr><th>Ilaaj</th><th>Kya karta hai</th><th>Kya nahi karta</th></tr>
         <tr><td><b>Prefix delegation</b></td><td>Har ENI slot par 1 IP ki jagah 16 IP ka guchha (/28). Ek node par 110 pods tak.</td><td>Naye IP <b>nahi banata</b>. Subnet chhota hai toh ab bhi khatam hoga.</td></tr>
         <tr><td><b>Bada / naya subnet</b></td><td>VPC mein doosra CIDR (jaise 100.64.0.0/16) jodkar pods ko wahan se IP dena</td><td>Thoda setup (custom networking)</td></tr>
         <tr><td><b>"Garam" IP kam karna</b></td><td><code>WARM_IP_TARGET</code> se har node ki jamakhori ghatana</td><td>Naya pod thoda dheere IP paata hai</td></tr>
       </table>
       <p><b>Yaad rakho:</b> prefix delegation "ek node par kitne pods" ka ilaaj hai. "Subnet mein kitne IP" ka ilaaj bada subnet hai. Dono alag problem hain.</p>`,
    ],
    stages: [
      {
        type: 'slider',
        title: '🎚️ Lab: 600 pods ke liye cluster ka naap',
        instructions: 'Chaar knob ghumao. Har number turant badalta hai. Yeh ek saada model hai — asli ginti VPC CNI ki "garam IP" settings par bhi nirbhar karti hai.',
        scenario: `ChaiPay ko Diwali ke liye <b>600 pods</b> chalane hain. Abhi cluster: 6 nodes, <code>t3.medium</code>, ek <code>/24</code> subnet.
          <ul><li>Budget: zyada se zyada <b>12 nodes</b></li>
          <li>Subnet mein kam se kam <b>15% IP khaali</b> rehne chahiye (naye nodes aur deploys ke liye)</li></ul>`,
        goal: 'Aisa naap chuno ki: 600 pods ki jagah ho, subnet ke IP kaafi hon (15% khaali), aur nodes 12 se zyada na hon.',
        knobs: [
          { id: 'type', label: 'Instance type', min: 0, max: 2, step: 1, value: 0, fmt: v => ITYPES[v].n },
          { id: 'nodes', label: 'Nodes', min: 2, max: 25, step: 1, value: 6, unit: ' nodes' },
          { id: 'pd', label: 'Prefix delegation', min: 0, max: 1, step: 1, value: 0, fmt: v => (v ? 'ON' : 'OFF') },
          { id: 'subnet', label: 'Subnet ka size', min: 0, max: 2, step: 1, value: 0, fmt: v => SUBNETS[v].n + ' (' + SUBNETS[v].ips + ' IP)' },
        ],
        readouts: k => {
          const m = cniModel(k);
          return [
            { label: 'Ek node par max pods', value: String(m.maxPods), state: 'neutral', hint: k.pd ? 'prefix delegation: 110 tak' : `${m.t.eni} × (${m.t.ip} − 1) + 2` },
            { label: 'Cluster mein pods ki jagah', value: m.capacity + ' / 600', state: m.capacity >= 600 ? 'good' : 'bad', hint: `${k.nodes} nodes × ${m.maxPods}` },
            { label: 'IP chahiye', value: m.ipNeed + ' / ' + m.sub.ips, state: m.fits ? (m.freePct >= 15 ? 'good' : 'warn') : 'bad', hint: m.fits ? `subnet mein ${m.freePct}% khaali` : 'subnet ke IP kam pad gaye — pods ContainerCreating mein atkenge' },
            { label: 'Nodes', value: String(k.nodes), state: k.nodes <= 12 ? 'good' : 'bad', hint: k.nodes <= 12 ? 'budget ke andar' : 'budget 12 nodes ka hai' },
          ];
        },
        bars: k => { const m = cniModel(k); return [{ label: 'Subnet ke IP', pct: Math.min(100, m.ipNeed / m.sub.ips * 100), state: m.fits && m.freePct >= 15 ? 'good' : 'bad', cap: `${m.ipNeed} / ${m.sub.ips}` }]; },
        verdict: k => {
          const m = cniModel(k);
          if (m.capacity < 600) return { ok: false, text: `Sirf ${m.capacity} pods ki jagah hai. Har ${m.t.n} node par ${m.maxPods} se zyada pods nahi aa sakte — CPU khaali ho tab bhi.` };
          if (!m.fits) return { ok: false, text: `Pods ki jagah toh hai, par ${m.ipNeed} IP chahiye aur subnet ${m.sub.n} mein sirf ${m.sub.ips} hain. Prefix delegation naye IP nahi banata — subnet bada karo.` };
          if (m.freePct < 15) return { ok: false, text: `Subnet lagbhag bhar gaya (${m.freePct}% khaali). Agla node ya rolling deploy IP ke bina atkega.` };
          if (k.nodes > 12) return { ok: false, text: `${k.nodes} nodes budget se bahar hain. Kam nodes par zyada pods chahiye: bada instance ya prefix delegation.` };
          return { ok: true, text: '600 pods ki jagah, IP kaafi, aur nodes budget ke andar.' };
        },
        check: k => { const m = cniModel(k); return m.capacity >= 600 && m.fits && m.freePct >= 15 && k.nodes <= 12; },
        lesson: 'Do alag seema thi. <b>Ek node par pods ki seema</b> (ENI aur IP) — iska ilaaj bada instance ya prefix delegation. <b>Subnet ke kul IP</b> — iska ilaaj sirf bada subnet. Prefix delegation ON karke bhi /24 mein 600 pods nahi aa sakte: 600 pods ko kam se kam 600 IP chahiye.',
        quiz: {
          q: 'm5.large par 3 ENI hain, har ENI par 10 IP. Bina prefix delegation ke ek m5.large node par zyada se zyada kitne pods?',
          choices: ['30 — 3 × 10', '29 — 3 × (10 − 1) + 2', '110 — Kubernetes ki default seema', '27 — 3 × (10 − 1)'],
          answer: 1,
          explain: 'Har ENI ka pehla IP node ka apna hota hai, isliye (10 − 1). Aur 2 pods (jo host network use karte hain) ko alag IP nahi chahiye, isliye + 2. 3 × 9 + 2 = 29.',
        },
      },
      {
        type: 'triage',
        title: '🩺 Case: node khaali hai, pod phir bhi atka',
        instructions: 'Commands chuno. Saare clue milne par sawal khulega.',
        symptom: `Deploy ke dauraan <code>pay-api</code> ke 8 naye pods 9 minute se <b>ContainerCreating</b> mein hain.<br>
          Team ka kehna hai: "Nodes par 60% CPU khaali hai. Zaroor image pull dheema hai."`,
        commands: [
          { cmd: 'kubectl describe pod pay-api-7c9e8d-x7', clue: true,
            out: 'Status:  Pending\nNode:    node-4\nEvents:\n  Normal   Scheduled               9m   default-scheduler  Successfully assigned payments/pay-api-7c9e8d-x7 to node-4\n  Warning  FailedCreatePodSandBox  8m (x34 over 9m)  kubelet  Failed to create pod sandbox: rpc error: plugin type="aws-cni" name="aws-cni" failed (add): add cmd: failed to assign an IP address to container',
            note: 'Pod <b>schedule ho chuka hai</b> (node-4 mil gaya) — matlab CPU/memory ki problem nahi. Pod <b>IP</b> par atka hai: <code>failed to assign an IP address</code>. Image pull tak baat pahunchi hi nahi.' },
          { cmd: 'aws ec2 describe-subnets --query "Subnets[].{Subnet:SubnetId,Free:AvailableIpAddressCount}"', clue: true,
            out: '[\n  { "Subnet": "subnet-0a1b (10.0.1.0/24)", "Free": 0 },\n  { "Subnet": "subnet-0c2d (10.0.2.0/24)", "Free": 3 }\n]',
            note: 'Dono subnets lagbhag khaali ho chuke hain: <b>0</b> aur <b>3</b> IP. Yahi asli wajah hai.' },
          { cmd: 'kubectl -n kube-system get ds aws-node -o yaml | grep -A1 WARM', clue: true,
            out: '        - name: WARM_ENI_TARGET\n          value: "1"\n        - name: WARM_PREFIX_TARGET\n          value: "1"',
            note: '<code>WARM_ENI_TARGET=1</code>: har node ek poora khaali ENI (10 IP) "garam" rakhta hai. 18 nodes × 10 = 180 IP sirf intezaar mein gheri hui hain.' },
          { cmd: 'kubectl top nodes', clue: false,
            out: 'NAME     CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)\nnode-1   780m         39%      4100Mi          52%\nnode-4   810m         40%      3900Mi          49%',
            note: 'CPU aur memory khaali hain — team sahi thi. Par IP ek alag resource hai, aur woh is output mein dikhta hi nahi.' },
          { cmd: 'kubectl get events --field-selector reason=Failed | grep -i pull', clue: false,
            out: 'No resources found in payments namespace.',
            note: 'Image pull ka koi error nahi. Pull shuru hi nahi hua — sandbox (aur uska IP) pull se pehle banta hai.' },
        ],
        questions: [
          {
            q: 'Pods kyun atke hain?',
            choices: [
              'Image registry dheemi hai; pull poora hone ka intezaar hai',
              'Subnets ke IP khatam; VPC CNI naye pods ko IP nahi de paa raha',
              'Nodes par CPU kam hai; Scheduler ko jagah nahi mil rahi',
              'pay-api ka readiness probe fail ho raha hai',
            ],
            answer: 1,
            explain: 'Teen saboot: event "failed to assign an IP address", subnets mein 0 aur 3 IP, aur har node ki "garam" IP ki jamakhori. Pod schedule ho chuka tha, isliye CPU wajah nahi ho sakta.',
          },
          {
            q: 'Sabse sahi, tikau ilaaj?',
            choices: [
              'Nodes ko bade instance type par le jao taaki har node par zyada CPU ho',
              'Prefix delegation ON kar do — isse subnet mein naye IP ban jaate hain',
              'VPC mein naya CIDR jodkar pods ke liye bade subnets banao',
              'pay-api ke replicas kam kar do taaki IP ki zaroorat hi na pade',
            ],
            answer: 2,
            explain: 'Problem subnet ke kul IP ki hai, toh ilaaj bhi IP badhana hai: naya CIDR + bade subnets (pods ke liye alag subnets). WARM settings kam karne se turant kuch IP wapas milte hain. Prefix delegation naye IP nahi banata.',
          },
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — IP ka hisaab',
        questions: [
          {
            q: 'Ek /24 subnet mein AWS ke hisaab se kitne IP kaam ke hote hain, aur kyun?',
            choices: ['256 — /24 mein 256 pate hote hain', '254 — pehla aur aakhri pata network ke liye', '251 — AWS har subnet ke 5 pate rakhta hai', '250 — har ENI ek pata aur le leta hai'],
            answer: 2,
            explain: '/24 = 256 pate. AWS har subnet ke pehle 4 aur aakhri 1 pata apne paas rakhta hai → 251. Chhote subnets (/27, /28) mein yeh 5 ka nuksaan bahut bada ho jaata hai.',
          },
          {
            q: 'Team ne prefix delegation ON kiya, par nayi nodes par bhi pods ko IP nahi mil raha. Subnet mein 40 IP khaali dikhte hain. Sabse sambhav wajah?',
            choices: [
              'Prefix delegation sirf t3 instances par chalta hai',
              'Khaali IP bikhre hue hain; 16 lagataar IP ka koi guchha nahi bacha',
              'Prefix delegation ke liye cluster ko dobara banana padta hai',
              '40 IP kaafi hain; problem kahin aur hogi',
            ],
            answer: 1,
            explain: 'Prefix delegation /28 ke guchhe (16 lagataar IP) maangta hai. Purane, bikhre hue subnet mein 40 IP khaali ho sakte hain par ek bhi poora /28 nahi. Isi liye prefix delegation ke liye naye, khaali subnets sabse achhe hain.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — EKS networking',
      instructions: 'Yeh sawal EKS chalane wale aur EKS sirf padhne wale mein fark karta hai. 🎤',
      questions: [
        {
          q: '"EKS ka default networking (VPC CNI) doosre CNIs se kaise alag hai, aur iski keemat kya hai?"',
          choices: [
            'VPC CNI overlay network banata hai; keemat yeh ki har packet par encapsulation ka bojh padta hai',
            'Har pod ko VPC ka asli IP milta hai; keemat yeh ki subnet ke IP khatam ho sakte hain',
            'VPC CNI pods ko public IP deta hai; keemat yeh ki har pod internet se dikhta hai',
            'VPC CNI sirf NetworkPolicy lagu karta hai; pods ko IP kubelet deta hai',
          ],
          answer: 1,
          explain: 'Faayda: pod VPC ka pehle darje ka nagrik hai (RDS, security groups, VPC peering sab seedhe). Keemat: IP address ek ginti ka resource ban jaata hai — subnet ka size cluster ki seema tay karta hai.',
        },
        {
          q: '"Pods ContainerCreating mein atke hain aur event mein \'failed to assign an IP address\' hai. Kya jaanchoge?"',
          choices: [
            'Image ka size aur registry ki speed',
            'Subnets ke khaali IP aur aws-node ke logs',
            'Pod ki memory limit aur OOMKilled events',
            'CoreDNS ke replicas aur DNS ke logs',
          ],
          answer: 1,
          explain: 'Yeh error seedha VPC CNI ka hai. Do jagah: (1) subnet mein IP bache hain? (2) node apni ENI/IP ki seema par hai? aws-node ke logs aur WARM_* settings batate hain ki IP kahan gheri hui hain.',
        },
        {
          q: '"Prefix delegation kya hal karta hai aur kya nahi?"',
          choices: [
            'Hal karta hai: subnet ke kul IP badhata hai. Nahi karta: ek node par pods ki ginti',
            'Hal karta hai: pods ko IPv6 deta hai. Nahi karta: IPv4 ka koi kaam',
            'Hal karta hai: ek node par pods ki ginti (110 tak). Nahi karta: subnet ke kul IP nahi badhata',
            'Hal karta hai: NetworkPolicy ki speed. Nahi karta: IP ka koi kaam',
          ],
          answer: 2,
          explain: 'Prefix delegation har ENI slot par /28 (16 IP) deta hai, isliye chhote node par bhi bahut pods aa jaate hain. Par 600 pods ko ab bhi 600+ IP chahiye. Subnet chhota ho toh naya CIDR / bade subnets hi ilaaj hain.',
        },
      ],
    },
    success: [
      'Main ek instance type ke liye max pods ka hisaab laga sakta hoon',
      'Main "failed to assign an IP address" ko subnet ke IP se jod sakta hoon',
      'Main bata sakta hoon ki prefix delegation kya hal karta hai aur kya nahi',
    ],
    homework: `<p>EKS cluster par IP ki haalat dekho:</p>
      <pre>aws ec2 describe-subnets --query "Subnets[].{Id:SubnetId,Cidr:CidrBlock,Free:AvailableIpAddressCount}"
kubectl get nodes -o custom-columns=NAME:.metadata.name,MAXPODS:.status.allocatable.pods
kubectl -n kube-system get ds aws-node -o yaml | grep -A1 -E "WARM|PREFIX"</pre>`,
    cards: [
      /* (ALB aur boss level is file ke aakhir mein alag registerLevels call mein hain) */
      { front: 'EKS mein pod ka IP kahan se aata hai?', back: 'VPC CNI node ke subnet se <b>asli VPC IP</b> deta hai (ENI ke secondary IP).' },
      { front: 'Ek node par max pods ka formula (bina prefix delegation)?', back: '<code>ENI × (har ENI ke IP − 1) + 2</code>. m5.large: 3 × 9 + 2 = 29.' },
      { front: 'IP khatam hone ka lakshan?', back: 'Pod <code>ContainerCreating</code> mein atka; event <code>failed to assign an IP address to container</code>. CPU/memory khaali hote hain.' },
      { front: 'Prefix delegation kya hal karta hai, kya nahi?', back: 'Hal: ek node par pods (110 tak). Nahi: subnet ke kul IP nahi badhata.' },
      { front: '/24 subnet mein kaam ke IP?', back: '251 — AWS har subnet ke 5 pate rakhta hai.' },
    ],
  },
]);

/* ------------------------------------------------------------------ */
/* LEVEL 5 — AWS Load Balancer Controller                              */
/* ------------------------------------------------------------------ */
VISUALS['eks-alb'] = {
  t: 'ALB se pod tak — do raaste: instance aur ip',
  scene: {
    intro: '<b>Sawal:</b> AWS ka ALB cluster ke bahar hai. ALB request ko pod tak kaise pahunchata hai — aur deploy ke dauraan 502 kahan se aata hai?',
    aria: 'AWS Load Balancer Controller: Ingress se ALB, aur ALB se pod tak ke do raaste — 6 kadam',
    nodes: [
      { id: 'ing', col: 0, row: 0, icon: '📝', label: 'Ingress: pay', sub: 'class: alb', tone: 'gold', about: 'Tumhara likha hua object: "pay.chaipay.in ko pay-api Service par bhejo". <code>ingressClassName: alb</code>.' },
      { id: 'lbc', col: 1, row: 0, icon: '🤖', label: 'LB Controller', sub: 'Ingress → asli ALB', tone: 'accent', about: 'AWS Load Balancer Controller. Cluster ke andar chalta hai. Ingress dekh kar AWS mein asli ALB, listener aur target group banata hai — aur pods ke aane-jaane par target group ko badalta rehta hai.' },
      { id: 'alb', col: 2, row: 0, icon: '⚖️', label: 'ALB', sub: 'AWS mein, cluster ke bahar', about: 'Application Load Balancer. Apna health check khud chalata hai. ALB ko Kubernetes ke readiness probe ke baare mein kuch nahi pata.' },
      { id: 'user', col: 3, row: 0, icon: '📱', label: 'User', sub: 'pay.chaipay.in' },
      { id: 'node', col: 2, row: 1, icon: '🖥️', label: 'Node (NodePort)', sub: 'kube-proxy', about: 'target-type: instance mein ALB node ke ek port (NodePort) par bhejta hai. Wahan se kube-proxy pod tak pahunchata hai.' },
      { id: 'pod', col: 3, row: 1, icon: '📦', label: 'pod: pay-api', sub: 'IP 10.0.1.20', tone: 'good', about: 'VPC CNI ki wajah se pod ka IP asli VPC IP hai — isliye ALB pod ko seedha bhej sakta hai.' },
    ],
    steps: [
      { from: 'ing', to: 'lbc', label: 'naya Ingress', tone: 'gold', say: 'Tum <b>Ingress: pay</b> likhte ho. <b>LB Controller</b> ko naya Ingress dikhta hai.' },
      { from: 'lbc', to: 'alb', label: 'ALB + target group', say: '<b>LB Controller</b> AWS mein ek asli <b>ALB</b> banata hai, aur ek <b>target group</b> — ek list jisme likha hai ki ALB traffic kahan bheje.' },
      { from: 'user', to: 'alb', label: 'HTTPS', say: '<b>User</b> ki request <b>ALB</b> par aati hai.' },
      { from: 'alb', to: 'node', label: 'target-type: instance', tone: 'gold', say: 'Pehla raasta — <code>target-type: instance</code>: target group mein <b>nodes</b> likhe hain. <b>ALB</b> request ko <b>Node (NodePort)</b> par bhejta hai.' },
      { from: 'node', to: 'pod', label: 'ek aur chhalaang', say: '<b>Node (NodePort)</b> par kube-proxy request ko <b>pod: pay-api</b> tak pahunchata hai — pod kisi doosre node par bhi ho sakta hai. Ek chhalaang zyada, aur ALB ka health check node ko dekhta hai, pod ko nahi.' },
      { from: 'alb', to: 'pod', label: 'target-type: ip', tone: 'good', say: 'Doosra raasta — <code>target-type: ip</code>: target group mein <b>pods ke IP</b> likhe hain. <b>ALB</b> seedha <b>pod: pay-api</b> ko bhejta hai. Tez aur saaf. Par ab ALB aur Kubernetes ko har pod ke aane-jaane par <b>taal milana</b> padta hai — aur deploy ke dauraan 502 yahin se aata hai.' },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* LEVEL 6 — BOSS                                                      */
/* ------------------------------------------------------------------ */
VISUALS['eks-boss'] = {
  t: 'User se AWS tak — paanch paratein, paanch jagah jahan cheez atakti hai',
  scene: {
    intro: 'Ek naye service ke launch par request in paanch paraton se guzarti hai. Har parat apna sach kahin likhti hai.',
    aria: 'request ka poora raasta: DNS aur certificate, Gateway aur route, pod ka IP, pod ki AWS pehchaan — 5 kadam',
    nodes: [
      { id: 'dns', col: 0, row: 0, icon: '🌍', label: 'DNS + certificate', sub: 'ExternalDNS, cert-manager', tone: 'gold', about: 'Sach kahan likha hai: <code>kubectl describe challenge</code>, ExternalDNS ke logs.' },
      { id: 'lb', col: 1, row: 0, icon: '⚖️', label: 'Load balancer', sub: 'ALB / target group', about: 'Sach kahan likha hai: Ingress/Gateway ke Events, target group ka health.' },
      { id: 'gw', col: 2, row: 0, icon: '🚪', label: 'Gateway + route', sub: 'Accepted? ResolvedRefs?', tone: 'accent', about: 'Sach kahan likha hai: <code>kubectl describe httproute</code> ke conditions.' },
      { id: 'pod', col: 2, row: 1, icon: '📦', label: 'Pod', sub: 'IP mila? (VPC CNI)', tone: 'good', about: 'Sach kahan likha hai: <code>kubectl describe pod</code> ke Events — "failed to assign an IP address".' },
      { id: 'aws', col: 1, row: 1, icon: '☁️', label: 'AWS (S3, SQS…)', sub: 'kaun dikh raha hai?', about: 'Sach kahan likha hai: <code>aws sts get-caller-identity</code> aur AccessDenied ke error ka "assumed-role/…".' },
    ],
    steps: [
      { at: ['dns'], say: '<b>DNS + certificate:</b> user sabse pehle naam poochhta hai aur HTTPS certificate jaanchta hai. Record nahi → "no such host". Certificate nahi → browser ki chetavni. Sach: Challenge ka <code>describe</code>, ExternalDNS ke logs.' },
      { from: 'dns', to: 'lb', label: 'IP mil gaya', say: '<b>Load balancer:</b> request ALB par aati hai. ALB bana hi nahi (subnet tags), ya target unhealthy hain → 503/504. Sach: Ingress/Gateway ke Events.' },
      { from: 'lb', to: 'gw', label: 'host + path', say: '<b>Gateway + route:</b> Gateway route dhoondhta hai. Route juda nahi → 404. Sach: HTTPRoute ke <code>Accepted</code> aur <code>ResolvedRefs</code> conditions.' },
      { from: 'gw', to: 'pod', label: 'Service → pod', tone: 'good', say: '<b>Pod:</b> request pod tak pahunchti hai — agar pod ko IP mila ho. Subnet ke IP khatam → pod <code>ContainerCreating</code> mein. Sach: pod ke Events.' },
      { from: 'pod', to: 'aws', label: 'S3 / SQS call', say: '<b>AWS:</b> pod AWS ko call karta hai. AWS ko node dikha, pod nahi → <code>AccessDenied</code>. Sach: <code>get-caller-identity</code>. Paanch paratein, paanch alag jagah — par niyam ek: andaaza mat lagao, us parat ka sach padho.' },
    ],
  },
};

KG.registerLevels('eksnet', [
  /* ================================================================== */
  {
    id: 'eks-alb',
    icon: '⚖️',
    title: 'ALB aur pods — target type, aur deploy ke dauraan 502',
    badge: 'ALB Ustaad',
    objectives: [
      'AWS Load Balancer Controller: Ingress se asli ALB kaise banta hai',
      '<code>target-type: instance</code> aur <code>ip</code> ka farak',
      'Deploy ke dauraan 502/503 kyun aate hain: do ghadiyan jo saath nahi chalti',
      'Teen ilaaj: <code>preStop</code> sleep, pod readiness gate, chhota deregistration delay',
    ],
    lesson: [
      `<h3>🏗️ ALB kaun banata hai?</h3>
       <p>Kubernetes khud AWS mein load balancer nahi bana sakta. Yeh kaam ek add-on karta hai: <b>AWS Load Balancer Controller</b>.</p>
       <pre>apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pay
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:
  ingressClassName: alb
  rules:
    - host: pay.chaipay.in
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: pay-api, port: { number: 8080 } } }</pre>
       <p>Controller Ingress dekh kar ek asli <b>ALB</b> aur ek <b>target group</b> banata hai. (Service <code>type: LoadBalancer</code> ke liye wahi controller <b>NLB</b> banata hai.)</p>
       <p><b>Ek jaal:</b> controller ko pata hona chahiye ki ALB kis subnet mein banega. Iske liye public subnets par tag chahiye:
       <code>kubernetes.io/role/elb = 1</code>. Tag na ho toh Ingress ka ADDRESS hamesha khaali rehta hai.</p>`,
      `<h3>🎯 target-type: instance ya ip?</h3>
       <table>
         <tr><th></th><th><code>instance</code></th><th><code>ip</code></th></tr>
         <tr><td>Target group mein kya likha hai</td><td>Nodes (NodePort)</td><td>Pods ke IP</td></tr>
         <tr><td>Raasta</td><td>ALB → node → kube-proxy → pod</td><td>ALB → pod</td></tr>
         <tr><td>ALB ka health check kise dekhta hai</td><td>Node ko</td><td>Pod ko</td></tr>
         <tr><td>Service ka type</td><td>NodePort chahiye</td><td>ClusterIP kaafi</td></tr>
       </table>
       <p>EKS mein aksar <code>ip</code> chuna jaata hai: kam chhalaang, aur ALB ko asli pod ki sehat dikhti hai.
       (Yeh isliye mumkin hai ki VPC CNI pod ko asli VPC IP deta hai.)</p>
       <p><b>Keemat:</b> ab ALB ke target group mein <b>pods</b> hain. Har deploy par pods badalte hain — toh ALB ki list bhi badalni padti hai. Aur yeh badlaav <b>turant nahi</b> hota.</p>`,
      `<h3>⏱️ Do ghadiyan: Kubernetes aur ALB</h3>
       <p>Deploy ke dauraan do alag systems apni-apni raftaar se chalte hain:</p>
       <table>
         <tr><th>Ghatna</th><th>Kubernetes</th><th>ALB</th><th>Nateeja</th></tr>
         <tr><td>Purana pod hatana</td><td>Turant SIGTERM → pod 1 s mein band</td><td>Target ko list se hatane mein kuch second</td><td>Un seconds mein requests mare hue pod par → <b>502</b></td></tr>
         <tr><td>Naya pod aana</td><td>Readiness probe paas → "Ready"</td><td>Apna health check abhi paas nahi hua</td><td>Purane pod hat gaye, naye abhi "healthy" nahi → <b>503</b></td></tr>
       </table>
       <p><b>Teen ilaaj:</b></p>
       <ol>
         <li><b><code>preStop</code> sleep</b> — pod SIGTERM se pehle 15–30 second zinda rehkar serve karta hai; itne mein ALB use hata chuka hota hai.</li>
         <li><b>Pod readiness gate</b> — namespace par label <code>elbv2.k8s.aws/pod-readiness-gate-inject=enabled</code>. Naya pod tab tak "Ready" nahi jab tak ALB use healthy na maan le.</li>
         <li><b>Deregistration delay kam</b> — default 300 second se 30 second, taaki purane pod jaldi chhooten.</li>
       </ol>`,
    ],
    stages: [
      {
        type: 'flow',
        title: '🎬 Flow: ek deploy, second-dar-second — 502 kahan se aaya?',
        instructions: '"Agla kadam" dabao. Har kadam par dekho ki kaun kaam kar raha hai: Kubernetes, ALB, purana pod ya naya pod. Teen sawal beech mein aayenge.',
        lanes: [
          { id: 'k8s', label: 'Kubernetes', icon: '☸️' },
          { id: 'new', label: 'naya pod', icon: '🆕' },
          { id: 'old', label: 'purana pod', icon: '📦' },
          { id: 'alb', label: 'ALB', icon: '⚖️' },
          { id: 'user', label: 'User', icon: '📱' },
        ],
        steps: [
          { lane: 'k8s', t: 'Rolling update shuru: naya pod pay-api-new banaya', detail: 'Deployment ka naya version. Kubernetes pehle ek naya pod banata hai, phir ek purana hatata hai.' },
          { lane: 'new', t: 'pay-api-new start hua; readiness probe paas → Kubernetes ke liye "Ready"', detail: 'Kubernetes ke hisaab se naya pod taiyaar hai. Par Kubernetes ka readiness probe aur ALB ka health check <b>do alag jaanch</b> hain.' },
          { lane: 'alb', t: 'ALB ne pay-api-new ko target group mein joda; health check abhi chal raha hai (state: initial)', detail: 'ALB ko naye target ko "healthy" maanne ke liye health check kai baar lagataar paas chahiye (jaise 15 s ke antar par 2 baar). Tab tak ALB naye pod ko traffic nahi bhejta.',
            ask: { q: 'Kubernetes ke liye naya pod Ready hai; ALB ke liye abhi nahi. Agar Kubernetes abhi purana pod hata de, toh kya hoga?',
              choices: [
                'Kuch nahi — ALB Kubernetes ke Ready ko apna maan leta hai',
                'Kuch second ALB ke paas koi healthy target nahi hoga → users ko 503',
                'ALB naya pod delete kar dega kyunki health check adhoora hai',
                'Kubernetes ALB ke health check ka intezaar apne aap karta hai, hamesha',
              ], answer: 1,
              explain: 'Kubernetes ko ALB ke baare mein kuch nahi pata — jab tak tum use batao nahi. Batane ka tareeka: pod readiness gate. Uske bina Kubernetes apni ghadi se chalta hai.' } },
          { lane: 'k8s', t: 'Kubernetes: "naya Ready hai" → purane pod pay-api-old ko SIGTERM', detail: 'Rolling update ka agla kadam. Kubernetes saath hi pay-api-old ko Endpoints se bhi hata deta hai.' },
          { lane: 'old', t: 'pay-api-old ko SIGTERM mila → process 1 second mein band', detail: 'App ne SIGTERM ko seedha maan liya aur band ho gayi. Jo requests beech mein thi, toot gayi.' },
          { lane: 'alb', t: 'LB Controller ne ALB ko bola "pay-api-old hatao"; ALB ko yeh baat poori tarah lagu karne mein kuch second lage', detail: 'Controller ko pod ke hatne ka pata chalta hai → AWS API call → ALB ke saare hisson tak baat pahunchne mein samay. Is beech ALB pay-api-old ke IP par requests bhejta rehta hai.',
            ask: { q: 'In kuch seconds mein jo requests pay-api-old ke IP par gayi, un users ko kya mila?',
              choices: [
                '200 OK — ALB request ko apne aap naye pod par mod deta hai',
                '404 Not Found — kyunki route hat chuka hai',
                '502 Bad Gateway — ALB ne ek band ho chuke pod ko request bheji',
                'Kuch nahi — ALB requests ko queue mein rakh leta hai',
              ], answer: 2,
              explain: '502 ka matlab: load balancer ne peeche wale ko request bheji, aur peeche se sahi jawab nahi aaya. Yahan peeche wala pod mar chuka tha. Har deploy par aisi 20–30 requests = "deploy ke waqt thode errors toh aate hi hain" wali galat aadat.' } },
          { lane: 'user', t: 'User: 502 Bad Gateway', detail: 'User ka payment fail. Dashboard par har deploy ke samay errors ka ek chhota nukeela pahaad.' },
          { lane: 'old', t: 'Ilaaj 1 — preStop: sleep 20. Purana pod SIGTERM se pehle 20 second zinda rehkar serve karta hai', detail: '<pre>lifecycle:\n  preStop:\n    exec: { command: ["sleep", "20"] }</pre>Ab pod Endpoints se hat chuka hai (naye connections nahi aane chahiye), par 20 second tak chal raha hai. Itne mein ALB use apni list se hata chuka hota hai.',
            ask: { q: 'preStop mein sleep 20 hai. terminationGracePeriodSeconds kitna hona chahiye?',
              choices: [
                '20 se kam — taaki pod jaldi hat jaye',
                'Theek 20 — dono barabar hone chahiye',
                '20 se zyada — sleep ke baad app ko band hone ka samay bhi chahiye',
                'Farak nahi padta — preStop grace period se bahar ginta hai',
              ], answer: 2,
              explain: 'Grace period ki ghadi preStop ke saath hi shuru ho jaati hai. Agar grace period 20 ho aur sleep bhi 20, toh sleep khatam hote hi kubelet SIGKILL bhej dega — app ko saaf band hone ka samay nahi milega. Default 30 hai; sleep 20 ke liye theek, sleep 40 ke liye badhana padega.' } },
          { lane: 'new', t: 'Ilaaj 2 — pod readiness gate: naya pod tab tak "Ready" nahi jab tak ALB use healthy na maan le', detail: 'Namespace par label <code>elbv2.k8s.aws/pod-readiness-gate-inject=enabled</code>. LB Controller har naye pod mein ek extra shart jodta hai. Ab Kubernetes purana pod tabhi hatata hai jab ALB naye pod ko sach mein traffic de sakta ho.' },
          { lane: 'user', t: 'Agla deploy: 0 errors', detail: 'Dono ghadiyan ab saath chalti hain: naya pod ALB ke liye taiyaar hone ke baad hi "Ready" (readiness gate), aur purana pod ALB se hatne ke baad hi band (preStop).' },
        ],
        summary: '<b>502/503 ki jad:</b> Kubernetes aur ALB do alag ghadiyon se chalte hain. <b>Purana pod</b> ALB ki list se hatne se pehle mar jaata hai (502). <b>Naya pod</b> ALB ke liye healthy hone se pehle "Ready" maan liya jaata hai (503). <b>Ilaaj:</b> preStop sleep + pod readiness gate (+ chhota deregistration delay).',
      },
      {
        type: 'triage',
        title: '🩺 Case: Ingress ka ADDRESS 15 minute se khaali',
        instructions: 'Commands chuno. Saare clue milne par sawal khulega.',
        symptom: `Naye cluster par pehla Ingress banaya. <code>kubectl get ingress</code> mein <b>ADDRESS khaali</b> hai, 15 minute se.<br>
          Team ka kehna hai: "ALB banne mein samay lagta hai, thoda aur ruko."`,
        commands: [
          { cmd: 'kubectl describe ingress pay', clue: true,
            out: 'Name:             pay\nIngress Class:    alb\nAddress:\nEvents:\n  Warning  FailedBuildModel  2m (x9 over 15m)  ingress  Failed build model due to couldn\'t auto-discover subnets: unable to resolve at least one subnet (0 match VPC and tags: [kubernetes.io/role/elb])',
            note: 'ALB "ban raha" nahi hai — controller 15 minute se <b>fail</b> ho raha hai. Wajah likhi hai: controller ko koi aisa subnet nahi mila jis par tag <code>kubernetes.io/role/elb</code> ho.' },
          { cmd: 'aws ec2 describe-subnets --query "Subnets[].{Id:SubnetId,Public:MapPublicIpOnLaunch,Tags:Tags[].Key}"', clue: true,
            out: '[\n  { "Id": "subnet-0a1b", "Public": true,  "Tags": ["Name"] },\n  { "Id": "subnet-0c2d", "Public": true,  "Tags": ["Name"] },\n  { "Id": "subnet-0e3f", "Public": false, "Tags": ["Name", "kubernetes.io/role/internal-elb"] }\n]',
            note: 'Do public subnets hain, par dono par sirf <code>Name</code> tag hai. Internet-facing ALB ke liye public subnets par <code>kubernetes.io/role/elb = 1</code> chahiye.' },
          { cmd: 'kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller', clue: false,
            out: 'NAME                                            READY   STATUS    RESTARTS   AGE\naws-load-balancer-controller-6d8f9c7b5-h4k2m    1/1     Running   0          3h',
            note: 'Controller chal raha hai. Controller kharab nahi hai — controller ko zaroori jaankari (subnet) nahi mil rahi.' },
          { cmd: 'kubectl get ingressclass', clue: false,
            out: 'NAME   CONTROLLER            PARAMETERS   AGE\nalb    ingress.k8s.aws/alb   <none>       3h',
            note: 'IngressClass <code>alb</code> maujood hai. Ingress sahi controller tak pahunch raha hai.' },
          { cmd: 'kubectl get pods -n payments', clue: false,
            out: 'NAME                READY   STATUS    RESTARTS   AGE\npay-api-6b8d7c-a1   1/1     Running   0          20m',
            note: 'pay-api chal raha hai. Par ALB bana hi nahi, toh pods ki sehat ka abhi koi rishta nahi.' },
        ],
        questions: [
          {
            q: 'ALB kyun nahi ban raha?',
            choices: [
              'ALB banne mein 15–20 minute lagte hain; thoda aur intezaar karna hai',
              'Public subnets par tag kubernetes.io/role/elb nahi hai',
              'AWS Load Balancer Controller crash ho gaya hai',
              'pay-api pods Ready nahi hain, isliye controller ALB nahi bana raha',
            ],
            answer: 1,
            explain: 'Event saaf kehta hai: "couldn\'t auto-discover subnets … tags: [kubernetes.io/role/elb]". ALB aam taur par 2–3 minute mein ban jaata hai. 15 minute ka khaali ADDRESS intezaar nahi, error hai — describe ke Events padho.',
          },
          {
            q: 'Sahi fix?',
            choices: [
              'Ingress ko delete karke dobara banao jab tak ADDRESS na aa jaye',
              'Controller ke pod ko restart karo',
              'Public subnets par tag kubernetes.io/role/elb = 1 lagao',
              'Ingress mein target-type ko ip se instance kar do',
            ],
            answer: 2,
            explain: 'Controller tags se subnet dhoondhta hai: public ke liye kubernetes.io/role/elb, private (internal ALB) ke liye kubernetes.io/role/internal-elb. (Doosra raasta: Ingress ke annotation mein subnet IDs seedhe likh dena.)',
          },
        ],
      },
      {
        type: 'quiz',
        title: 'Pakka karo — ALB ke niyam',
        questions: [
          {
            q: 'target-type: ip mein ALB seedha pod ke IP par bhejta hai. Yeh EKS mein kis wajah se mumkin hai?',
            choices: [
              'Kyunki kube-proxy ALB ke andar chalta hai',
              'Kyunki VPC CNI pod ko asli VPC IP deta hai',
              'Kyunki har pod ko ek public IP milta hai',
              'Kyunki ALB cluster ke andar ek pod ki tarah chalta hai',
            ],
            answer: 1,
            explain: 'ALB VPC ke andar hai, aur pod ka IP bhi VPC ka asli IP hai — toh ALB pod ko seedha route kar sakta hai. Overlay network wale CNI mein pod ka IP VPC ke liye anjaan hota hai.',
          },
          {
            q: 'Cluster mein 30 Ingress hain aur har ek ne apna alag ALB bana liya. Bill bahut badh gaya. Sabse saada ilaaj?',
            choices: [
              'Har Ingress ko Service type LoadBalancer mein badal do',
              'Ingresses ko ek IngressGroup mein daalo taaki sab ek hi ALB saanjha karen',
              'target-type ko instance kar do; instance mode mein ALB muft hota hai',
              'Ingress ki jagah NodePort Services use karo',
            ],
            answer: 1,
            explain: 'Annotation alb.ingress.kubernetes.io/group.name: NAAM. Ek hi group ke saare Ingress ek ALB par alag-alag rules ban jaate hain. Har ALB ka ek maheene ka tay kiraya hota hai — 30 ALB vs 1 ALB ka farak bada hai.',
          },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — load balancer aur zero-downtime deploy',
      instructions: 'Yeh sawal un logon ko alag karta hai jinhone sach mein production deploy sambhala hai. 🎤',
      questions: [
        {
          q: '"Har deploy par kuch second 502 aate hain. ALB target-type ip hai. Kyun, aur kya karoge?"',
          choices: [
            'ALB ka size chhota hai; bada ALB lene se 502 band ho jayenge',
            'Purana pod ALB se hatne se pehle band hota hai; preStop + readiness gate',
            'Pods ki CPU limit kam hai; deploy ke waqt throttling se 502 aata hai',
            'Yeh normal hai; rolling update mein thode errors hamesha aate hain',
          ],
          answer: 1,
          explain: 'Kubernetes aur ALB do alag ghadiyon se chalte hain. preStop sleep purane pod ko ALB se hatne tak zinda rakhta hai. Readiness gate naye pod ko tab tak "Ready" nahi hone deta jab tak ALB use healthy na maan le. Deploy ke errors "normal" nahi hain.',
        },
        {
          q: '"target-type instance aur ip mein kya chunoge, aur kyun?"',
          choices: [
            'instance — kyunki usme ALB seedha pod ko bhejta hai aur ek chhalaang kam hoti hai',
            'ip — ALB seedha pod ko bhejta hai aur health check pod ka hota hai',
            'Dono ek saath — ek Ingress mein dono target types likhe ja sakte hain',
            'Farak nahi padta — dono mein raasta aur health check ek jaisa hai',
          ],
          answer: 1,
          explain: 'ip: ALB → pod (kam chhalaang, pod ka asli health). instance: ALB → node → kube-proxy → pod. ip ki keemat: target group pods ke saath badalta hai, isliye preStop / readiness gate zaroori.',
        },
        {
          q: '"Ingress banaya, par ADDRESS khaali hai. Kahan dekhoge?"',
          choices: [
            'kubectl get nodes — shayad koi node NotReady ho',
            'kubectl describe ingress ke Events; controller ke logs',
            'kubectl top pods — shayad pods par load zyada ho',
            'DNS ke records — ADDRESS DNS se aata hai',
          ],
          answer: 1,
          explain: 'ADDRESS khaali = controller ALB bana nahi paaya. Wajah Events mein: subnet nahi mile (tags), IAM ijaazat nahi (controller ka role), ya IngressClass galat. Intezaar karne se pehle Events padho.',
        },
      ],
    },
    success: [
      'Main bata sakta hoon ki Ingress se asli ALB kaise banta hai',
      'Main target-type instance aur ip ka farak samjha sakta hoon',
      'Main deploy ke dauraan ke 502/503 ki wajah aur teen ilaaj bata sakta hoon',
    ],
    homework: `<p>EKS cluster par:</p>
      <pre>kubectl get ingress -A                                 # koi ADDRESS khaali?
kubectl get deploy &lt;app&gt; -o yaml | grep -A4 preStop     # preStop hai?
kubectl get ns --show-labels | grep readiness-gate     # readiness gate kis namespace par?</pre>`,
    cards: [
      { front: 'AWS Load Balancer Controller kya banata hai?', back: 'Ingress (class <code>alb</code>) → <b>ALB</b> + target group. Service <code>type: LoadBalancer</code> → <b>NLB</b>.' },
      { front: 'target-type instance vs ip?', back: '<b>instance</b>: ALB → node (NodePort) → kube-proxy → pod. <b>ip</b>: ALB → pod seedha; health check pod ka.' },
      { front: 'Deploy ke dauraan 502 kyun?', back: 'Purana pod ALB ki target list se hatne se pehle band ho jaata hai. ALB kuch second mare hue pod ko request bhejta hai.' },
      { front: '502/503 ke teen ilaaj?', back: '<code>preStop</code> sleep (15–30 s) · pod readiness gate (namespace label) · deregistration delay kam (30 s).' },
      { front: 'Ingress ka ADDRESS khaali — sabse aam wajah?', back: 'Subnets par tag nahi: <code>kubernetes.io/role/elb=1</code> (public) / <code>internal-elb=1</code> (private). <code>kubectl describe ingress</code> ke Events dekho.' },
    ],
  },

  /* ================================================================== */
  {
    id: 'eks-boss',
    icon: '👑',
    title: 'BOSS: launch ka din — receipts.chaipay.in',
    badge: 'Network Nawab',
    objectives: [
      'Ek naye service ke launch par paanchon paraton ko kram se jaanchna',
      'Har parat ka "sach" kahan likha hai, yeh yaad rakhna',
      'Jaldbaazi ke jugaad (All, node ka role, haath se DNS) ko pehchaanna',
      'Lakshan dekh kar sahi parat chunna',
    ],
    lesson: [
      `<h3>👑 Boss level: ek launch, chaar rukawatein</h3>
       <p>Koi naya concept nahi. ChaiPay aaj ek naya service launch kar raha hai: <code>receipts</code>, host <code>receipts.chaipay.in</code>.</p>
       <p>Launch ke din cheezein <b>ek ke baad ek</b> atakti hain — aur har baar ek alag parat mein:</p>
       <ol>
         <li>🌍 DNS + certificate</li>
         <li>⚖️ Load balancer</li>
         <li>🚪 Gateway + route</li>
         <li>📦 Pod ka IP</li>
         <li>☁️ Pod ki AWS pehchaan</li>
       </ol>
       <p><b>Ek hi niyam:</b> andaaza mat lagao. Har parat apna sach kahin likhti hai — <code>describe</code> ke Events mein, <code>status.conditions</code> mein, ya error ke ek shabd mein.</p>`,
    ],
    stages: [
      {
        type: 'incident',
        title: '🚀 Launch ka din — har rukawat par ek faisla',
        pager: '<b>10:00 AM — receipts.chaipay.in launch.</b><br>Marketing ka email 11:00 baje jayega. Abhi site nahi khul rahi.',
        start: 'n1',
        nodes: {
          n1: {
            sitrep: 'Browser: NET::ERR_CERT_AUTHORITY_INVALID\n\n$ kubectl get certificate\nNAME           READY   SECRET         AGE\nreceipts-tls   False   receipts-tls   12m',
            text: 'Certificate 12 minute se Ready nahi. Pehla kadam?',
            choices: [
              { t: 'cert-manager ke pod ko restart karo aur 5 minute intezaar karo', good: false, explain: 'cert-manager shayad bilkul theek hai. Restart se pehle poochho: Certificate kis cheez ka intezaar kar raha hai?' },
              { t: 'Kadi mein neeche chalo: describe certificate → order → challenge', good: true, next: 'n2', explain: 'Certificate → Order → Challenge. Asli wajah hamesha sabse neeche wale object mein likhi hoti hai.' },
              { t: 'Certificate ko delete karke dobara banao, jab tak Ready na ho', good: false, explain: 'Naya Order usi jagah atkega, aur baar-baar fail hone par Let\'s Encrypt ki ginti ki seema paas aati hai.' },
            ],
          },
          n2: {
            sitrep: 'Challenge: ... lookup receipts.chaipay.in: no such host\n\n$ kubectl logs deploy/external-dns --tail=1\nlevel=error msg="AccessDenied: User: arn:aws:sts::111122223333:assumed-role/eks-node-role/i-0a1b2c is not authorized to perform: route53:ChangeResourceRecordSets"',
            text: 'DNS record nahi bana, kyunki ExternalDNS ko Route 53 mein likhne ki ijaazat nahi mili. Error dhyaan se padho. Ab?',
            choices: [
              { t: 'Node ke IAM role (eks-node-role) ko Route 53 ki poori ijaazat de do', good: false, explain: 'Ab cluster ka har pod ChaiPay ke DNS records badal sakta hai. Ek compromise hua pod pay.chaipay.in ko apne server par mod dega.' },
              { t: 'Route 53 mein record haath se bana do; ExternalDNS ko baad mein dekhenge', good: false, explain: 'Aaj kaam chal jayega. Par agla host, ya load balancer ka pata badalna — sab phir tootega, aur tab kisi ko yaad nahi hoga kyun.' },
              { t: 'ExternalDNS ko apna role nahi mila — association theek karo, pod restart', good: true, next: 'n3', explain: '"assumed-role/eks-node-role" = pod ko apna role mila hi nahi. Association (namespace + ServiceAccount) theek karo aur pod ko dobara banao — chalte pod ko naye credentials nahi milte.' },
            ],
          },
          n3: {
            sitrep: 'Certificate: Ready True ✓   DNS: receipts.chaipay.in → ALB ✓\nBrowser: 404 Not Found\n\n$ kubectl get httproute -n receipts\nNAME             HOSTNAMES                  ACCEPTED\nreceipts-route   ["receipts.chaipay.in"]    False\n\nReason: NotAllowedByListeners',
            text: 'HTTPS chal gaya, par 404. Route juda nahi hai. Kya karoge?',
            choices: [
              { t: 'receipts namespace ko Gateway ke allowedRoutes wala label do', good: true, next: 'n4', explain: 'Gateway sirf label wale namespaces ke routes leta hai (pichhle mission ka fix). Naye namespace par label lagana hi sahi, chhota badlaav hai.' },
              { t: 'Gateway ke allowedRoutes ko from: All kar do — launch ka din hai', good: false, explain: 'Ab koi bhi namespace public Gateway par route jod sakta hai. Jaldbaazi mein khola darwaza aksar hamesha khula rehta hai.' },
              { t: 'receipts-route ko infra namespace mein le jao jahan Gateway hai', good: false, explain: 'App team apna route khud nahi badal payegi, aur infra ka route receipts ke Service tak pahunchne ke liye ReferenceGrant maangega.' },
            ],
          },
          n4: {
            sitrep: '10:52 AM — site chal rahi hai ✓\n11:05 AM — marketing email gaya, HPA ne receipts ko 4 se 16 pods par scale kiya\n\n$ kubectl get pods -n receipts | grep -c ContainerCreating\n12\n\nEvent: failed to assign an IP address to container',
            text: '12 naye pods atke hain. Nodes par CPU aur memory khaali hai. Ab?',
            choices: [
              { t: 'Nodes ko bade instance type par le jao — zyada CPU chahiye', good: false, explain: 'Pods schedule ho chuke hain; CPU ki koi kami nahi. Event IP ke baare mein hai.' },
              { t: 'Prefix delegation turant ON kar do — isse naye IP ban jayenge', good: false, explain: 'Prefix delegation ek node par zyada pods aane deta hai. Subnet ke kul IP nahi badhata — aur yahan subnet hi khaali ho chuka hai.' },
              { t: 'Subnets ke khaali IP dekho; pods ke liye bada subnet / naya CIDR jodo', good: true, next: 'end', explain: '"failed to assign an IP address" = VPC CNI ko subnet se IP nahi mila. aws ec2 describe-subnets mein AvailableIpAddressCount dekho. Tikau ilaaj: pods ke liye bade subnets.' },
            ],
          },
          end: {
            end: true,
            text: 'Launch ho gaya — chaar rukawatein, chaar paratein',
            summary: '<b>Chaar rukawatein, isi kram mein:</b><br>🌍 Certificate atka → wajah Challenge mein (<code>no such host</code>)<br>☁️ DNS nahi bana → ExternalDNS node ke role se chal raha tha (<code>assumed-role/eks-node-role</code>)<br>🚪 404 → HTTPRoute <code>Accepted: False</code><br>📦 Pods atke → <code>failed to assign an IP address</code><br><br><b>Har baar sach likha hua tha</b> — ek <code>describe</code>, ek log line, ek condition mein. Aur har baar ek tez jugaad maujood tha (restart, node ka role, from: All, bada instance) jo ya toh kaam nahi karta, ya kal ki problem banta.',
          },
        },
      },
      {
        type: 'bins',
        title: 'Lakshan dekho, parat chuno',
        instructions: 'Har lakshan ke liye socho: raaste ki kaun si parat mein dekhna hai?',
        bins: [
          { id: 'dns', label: '🌍 DNS / certificate' },
          { id: 'gw', label: '🚪 Gateway / route' },
          { id: 'ip', label: '📦 Pod ka IP (VPC CNI)' },
          { id: 'id', label: '☁️ AWS pehchaan' },
          { id: 'alb', label: '⚖️ ALB / deploy' },
        ],
        items: [
          { text: 'Browser: "Your connection is not private"; Certificate READY False', bin: 'dns', explain: 'Certificate ki kadi mein neeche chalo: Order → Challenge.' },
          { text: 'HTTPS theek hai, par 404; HTTPRoute ACCEPTED False', bin: 'gw', explain: 'Gateway ne route ko joda nahi. allowedRoutes aur hostname dekho.' },
          { text: 'Pod ContainerCreating; event "failed to assign an IP address"', bin: 'ip', explain: 'Subnet ke IP khatam, ya node apni ENI/IP ki seema par.' },
          { text: 'App ke log: AccessDenied … assumed-role/eks-node-role/…', bin: 'id', explain: 'Pod node ki pehchaan use kar raha hai. Association / annotation aur pod restart.' },
          { text: 'Sirf deploy ke dauraan 20–30 requests par 502', bin: 'alb', explain: 'Purana pod ALB ki list se hatne se pehle band ho raha hai. preStop + readiness gate.' },
          { text: 'Challenge: "lookup shop.chaipay.in: no such host"', bin: 'dns', explain: 'DNS record nahi bana. ExternalDNS ke logs: domain-filter ya ijaazat.' },
          { text: 'Ingress ka ADDRESS 15 minute se khaali', bin: 'alb', explain: 'LB Controller ALB bana nahi paaya. Ingress ke Events: subnet tags ya IAM.' },
        ],
      },
    ],
    interview: {
      title: 'Interview Round — request ka poora raasta',
      instructions: 'Aakhri round. Interviewer ek hi sawal poochhega, kai tarah se: "request kahan atki?" 🎤',
      questions: [
        {
          q: '"User browser mein hamara URL kholta hai. EKS mein request pod tak kaise pahunchti hai? Mukhya padav batao."',
          choices: [
            'User → kubectl → API Server → etcd → pod',
            'User → DNS → ALB → Gateway/Ingress → Service → pod',
            'User → node ka public IP → kubelet → container',
            'User → CoreDNS → Scheduler → pod',
          ],
          answer: 1,
          explain: 'Paanch padav: naam (DNS) → darwaza (ALB) → niyam (Gateway/route) → Service (kaun se pods) → pod (IP). Har padav ka apna "sach": DNS record, target health, route ke conditions, Endpoints, pod ke Events.',
        },
        {
          q: '"Naya service 404 de raha hai. Kaise tay karoge ki problem kis parat mein hai?"',
          choices: [
            'Sab kuch restart karke dekhunga ki kaun sa restart kaam karta hai',
            'Bahar se andar chalunga: DNS → certificate → load balancer → route → pod',
            'Seedha pod ke logs dekhunga; 404 hamesha app se aata hai',
            'Node ko reboot karunga; network ki problem aksar node se hoti hai',
          ],
          answer: 1,
          explain: '404 ka matlab: request kisi tak pahunchi, par us "kisi" ko raasta nahi mila. Aksar woh Gateway hota hai (route juda nahi). Bahar se andar chalne se har kadam par aadha daayra hat jaata hai.',
        },
        {
          q: '"Launch ke din tumhare saathi ne Gateway ko from: All kar diya \'taaki kaam chal jaye\'. Kya kahoge?"',
          choices: [
            'Theek kiya — launch ke din raftaar suraksha se zyada zaroori hai',
            'Sahi fix ek label ka tha; from: All se har namespace traffic mod sakta hai',
            'Koi farak nahi padta — allowedRoutes sirf ek salaah hai, Gateway use maanta nahi',
            'Gateway ko delete karke naya banana chahiye tha',
          ],
          answer: 1,
          explain: 'Jaldbaazi ke jugaad ki do pehchaan: (1) woh daayra bada karta hai (All, node ka role, cluster-admin), (2) use wapas karna koi yaad nahi rakhta. Sahi fix aksar utna hi chhota hota hai — bas dhoondhna padta hai.',
        },
      ],
    },
    success: [
      'Main request ke raaste ki paanchon paratein kram se bata sakta hoon',
      'Main lakshan dekh kar sahi parat chun sakta hoon',
      'Main jaldbaazi ke jugaad aur sahi chhote fix mein farak kar sakta hoon',
    ],
    homework: `<p>Apne kisi ek service ke liye kaagaz par poora raasta banao, aur har padav ke aage woh command likho jo us padav ka sach batata hai:</p>
      <pre>DNS         →  dig &lt;host&gt;
Certificate →  kubectl get certificate ; kubectl describe challenge
ALB         →  kubectl describe ingress|gateway
Route       →  kubectl describe httproute
Service     →  kubectl get endpoints &lt;svc&gt;
Pod         →  kubectl describe pod &lt;pod&gt;
AWS         →  kubectl exec deploy/&lt;app&gt; -- aws sts get-caller-identity</pre>`,
    cards: [
      { front: 'Request ke raaste ki paanch paratein?', back: 'DNS + certificate → load balancer → Gateway + route → pod (IP) → AWS (pehchaan).' },
      { front: 'Har parat ka "sach" kahan likha hai?', back: 'Challenge ka describe · Ingress/Gateway ke Events · HTTPRoute ke conditions · pod ke Events · <code>get-caller-identity</code>.' },
      { front: 'Jaldbaazi ke jugaad ki do pehchaan?', back: '(1) Daayra bada karta hai (from: All, node ka role, cluster-admin). (2) Wapas karna koi yaad nahi rakhta.' },
      { front: '404 par debug ki disha?', back: 'Bahar se andar: DNS → certificate → load balancer → route ke conditions → Service ke Endpoints → pod.' },
    ],
  },
]);

})();
