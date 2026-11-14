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
      { from: 'le', to: 'cm', label: 'Challenge: saabit karo', bend: 24, say: '<b>Let\'s Encrypt</b> kehta hai: "saabit karo ki domain tumhara hai. Main <code>http://pay.chaipay.in/.well-known/acme-challenge/…</code> kholunga — wahan ek khaas token milna chahiye." Isko <b>HTTP-01 challenge</b> kehte hain.' },
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

})();
