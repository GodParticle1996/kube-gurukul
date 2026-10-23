# KubeGurukul improvement status — 2026-10-23

A–D implementation complete on `codex/kube-gurukul-handoff-completion`.
The original handoff below is retained as historical context: its old branch,
403 push result, environment paths and remaining-work list describe the earlier session.
Use the current checkout and Git remote state for delivery.

## Changes completed

- Karpenter: GPU types/requests/accounting; generic instance requirement operators;
  weighted NodePool fallback; CPU/memory limits; DaemonSet sizing overhead; readable
  scheduling events; fresh Running descriptions; launch/consolidation tick controls.
  Unknown NodeClaims have a blank NODE, and node names stay unique after consolidation.
- All three Karpenter missions now demonstrate the intended behavior. Spark is a real
  consolidation candidate: unprotected work restarts, while early annotation preserves progress.
  GPU training uses g5 capacity, matching taint/toleration and a NVIDIA EC2NodeClass.
  Deleting a required workload cannot complete or crash a mission.
- Added the 15 missing KodeKloud solutions and corrected selector/endpoints and final-boss
  win conditions. Fixed stale post-repair state, required final observations, script-vs-YAML
  actions, namespace finalization, seccomp defaults and related troubleshooting claims.
- Reviewed answer lengths and factual explanations across tracks: 303 MCQs and 29 incident
  nodes have no current heuristic flags. Decision Dojo expected flags fell from 24.1% to
  about 0.3% across 93 scenarios. This heuristic does not prove factual accuracy.
- Validator now requires a replayable solution for every mission, wins on the final command,
  and checks every task at the win. It also rejects duplicate single-use fill answers,
  matching/bin items and interview options; per-track MCQ bias ceiling is 10%.
- README/EXTENDING describe Decision Dojo, 15 Real Labs, stage-boundary resume, mood picker,
  Helm 4 behavior, Karpenter simulator limits, terminal contracts and both developer tools.
- Browser QA also exposed and fixed delayed stage callbacks contaminating another screen/session,
  plus mobile overflow from the long CreateContainerConfigError heading.

## Validation and evidence

```bash
node validate.js                       # ends with ✅ SAB THEEK
node tools/replay-missions.js run       # pass 43, fail 0, no-solution 0
node tools/mcq-bias.js                  # MCQ/incident/Dojo length audit
node tools/mcq-bias.js --kind=incident
node tools/mcq-bias.js --kind=decision
node tools/mcq-bias.js --json
git diff --check
```

Local Chromium QA: 252 checks, eight terminal replays, 27 screenshots; zero console/page
errors or document overflows. Covers a complete level plus interview in all seven tracks,
resume/reload, decisions/practice, all 15 Real Lab details, mood routes, and a 375px sweep
of all 58 intros. Both delayed-callback navigation regressions pass.
Final Karpenter browser recheck adds six passing scenarios: three solution replays,
two required-workload deletion paths, and a waiting GPU request mutation; no browser errors.
Artifacts for this workspace run: `/tmp/kube-gurukul-qa/REPORT.md`, `REPORT.json`,
`qa.cjs`, screenshots and `validate-final.log`. Earlier failures are preserved in `FIRST-RUN.*`.
Linux test fonts lack some emoji glyphs; text and layouts remain readable.

Real cluster exercises were viewed and their local files checked; they were **not rerun on
kind, minikube, EKS or real devices**. No Docker, cluster, server or deployment was started.
The simulator has illustrative instance prices and fixed overhead; it is not a full scheduler,
AWS capacity model, or production billing estimate. Resume restores challenge boundaries,
not partially executed terminal commands.

## Primary references used for corrections

- [Karpenter scheduling and GPU device plugins](https://karpenter.sh/docs/concepts/scheduling/)
- [Karpenter NodePools, weights and limits](https://karpenter.sh/docs/concepts/nodepools/)
- [Karpenter disruption and interruption](https://karpenter.sh/docs/concepts/disruption/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Kubernetes webhook practices](https://kubernetes.io/docs/concepts/cluster-administration/admission-webhooks-good-practices/)
- [Argo CD sync options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/)
- [Argo CD automated sync and allowEmpty](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)
- [Helm CRD handling](https://helm.sh/docs/chart_best_practices/custom_resource_definitions/)
- [cert-manager v1.14 chart CRD ownership](https://cert-manager.io/v1.14-docs/installation/helm/)

---

## Original handoff — historical, completed above

# 🤝 Handoff — KubeGurukul improvement work (for the next AI agent)

Branch: **`claude/gifted-thompson-nx168o`** · run `node validate.js` first (must end with `✅ SAB THEEK`).

## 1. What the user asked for (keep these goals in mind)

The owner (works with Kubernetes in production, ADHD) asked to: find and fix every incorrect thing in the app,
deeply; improve the app; teach concepts **interactively** with hands-on labs; explain so there is **no guesswork**
(clear mental pictures); and teach **decisions** ("kab kya use karein, X vs Y"). Their answers to earlier questions:

- Level: production depth (CKA/CKS, Helm, ArgoCD, Karpenter).
- Wants **decision trees** (→ Decision Dojo, done) and **real kind/minikube labs with verify scripts** (→ `real-labs/`, done).
- "Depends on mood" → mood picker + resume-anywhere (done).
- Language: **Hinglish** (Hindi in Latin script). The validator rejects Devanagari/Cyrillic/etc. characters.
- Writing rule (top of `data-kodekloud.js`): no vague pronouns ("yeh/woh/isse") — name the thing every time.

## 2. Rules for working in this repo

- Plain HTML/CSS/JS, global `KG`. Data files call `KG.registerLevels(track, [...])`. Index loads every script; `validate.js`
  evals all files together (DOM stub) — so **never add a top-level `const`/`function` in a data file** (name clashes across
  `<script>` tags). Put mission helpers on `KG.<name>` (see `KG.helmMission` in `data-helm.js`, `KG.argoMission` in
  `data-argocd.js`) or inside the file's IIFE (`data-kodekloud.js` uses IIFE chunks).
- `validate.js`: the big test block is `String.raw` — write `'\n'` literally there (a Python heredoc that writes `\n`
  turns into a real newline and breaks it — this already happened once).
- Commit trailer (required on every commit):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Q1ikuUPUhzVxfHdLUqEk3P
  ```
  No model names anywhere else in the repo. **Do not open a PR unless the user asks.**
- **Push is blocked (HTTP 403)** — the Claude GitHub App has no access to `GodParticle1996/kube-gurukul`. The user must
  reconnect GitHub at https://claude.ai/connect-github and install the Claude GitHub App on that repo, then:
  `git push -u origin claude/gifted-thompson-nx168o` (retry only on network errors: 2s, 4s, 8s, 16s).
  ⚠️ Until that push succeeds, all commits exist only in the session container.

### Terminal simulator features you will use (all in `terminal.js`)
| Need | How |
|---|---|
| Replayable proof a mission is solvable | `solution: ['cmd', ...]` on the mission (after `hints`). Validator replays it in the real renderer; the mission must be won by the **last** command (not earlier). |
| API server down (etcd broken, certs expired) | `cluster.apiError: 'text'` or `s => text|null` → every `kubectl` prints it. |
| Node-level / git-level fix (not a cluster object) | file named `x.sh` with `content` + `apply(sim)`; learner runs `bash x.sh`. `kubectl apply -f x.sh` refuses. Use `.yaml` + `kubectl apply -f` **only** for real cluster objects. |
| `sudo` | stripped automatically (`sudo crictl ps -a` works). |
| Scripted commands | `responses: [{ re, out(sim, m) }]` — always guard `m[1] || ''` (validator calls `out(sim, [])`). |
| Logs realism | plain `logs` falls back to `prevLogs` (CrashLoopBackOff wait), `--previous` errors when `restarts` is 0, never-started containers get the real "waiting to start" error. |
| Broken Helm chart | `charts[ref].renderError` → `helm template/install/upgrade` fail with it (`helmsim.js`). |

Dev tools (in `tools/`): `node tools/replay-missions.js list | info <levelId> | run [solutions.json] [key]`
(per-mission transcript + which tasks ticked) and `node tools/mcq-bias.js [list <track>]`.

## 3. Remaining work — in this order

### A. Karpenter simulator + its 3 missions (in progress, nothing edited yet)
Problems found by replay (`node tools/replay-missions.js run "" karpenterboss|t0` etc.):
1. **GPU pool launches a non-GPU instance** (`m6a.xlarge`). `karpentersim.js` `TYPES` has no GPU types and pods can't request GPUs.
2. **Everything is instant**: a pending pod gets a NodeClaim on the 1st command and is Running by the 3rd, so the learner never
   sees Pending/Unknown. Consolidation also fires on the 1st command — before the learner can protect the Spark job — and in
   the current data the Spark node is never even a candidate, so the mission's lesson is untested.
3. Event text is invented (`FailedProvisioning`); `describe` text stays "Pending" after the pod runs.
4. `huge-job` story: c/m/r families do have 32-vCPU types, so "no instance type" is only true if the NodePool restricts sizes.
5. `batch-worker` limit message should be Karpenter's real one.

Do this in `karpentersim.js`:
- `TYPES`: add `gpu` (0 for existing); add `g5.xlarge` (4 vCPU, 16 GiB, 1 GPU, cat `g`, gen 5) and `g5.2xlarge` (8/32/1).
- `demand(p)`: add `gpu: parseInt(requests['nvidia.com/gpu']) || 0`; fit checks, `usedGpu` accounting, node creation and
  consolidation targets must all respect GPU.
- `allowedTypes`: one generic matcher with operators `In/NotIn/Gt/Lt/Exists/DoesNotExist` for keys `instance-category`,
  `instance-generation`, `instance-family` (`name.split('.')[0]`), `instance-size` (`name.split('.')[1]`), `instance-cpu`,
  `instance-gpu-count`, `instance-gpu-manufacturer` (`nvidia` when gpu>0), `node.kubernetes.io/instance-type`, `arch`.
  Sort candidate types by `gpu` first (don't waste GPU nodes), then cpu, then mem.
- Try NodePools in weight order and **fall back** to the next pool; collect one reason per pool, join with `; `:
  - taint: `incompatible with nodepool "gpu", did not tolerate nvidia.com/gpu=true:NoSchedule`
  - no type: `incompatible with nodepool "default", daemonset overhead={"cpu":"200m","memory":"240Mi","pods":"5"}, no instance type satisfied resources {"cpu":"4","memory":"16Gi","nvidia.com/gpu":"1","pods":"1"} and requirements <key Op [values], ...> (no instance type has enough resources)`
  - limits: `all available instance types exceed limits for nodepool: "default"`
- Pod events in `describe`: failure → `Warning  FailedScheduling  karpenter  Failed to schedule pod, <reason>`;
  nominated → `Normal  Nominated  karpenter  Pod should schedule on: nodeclaim/<name>`; when it runs → replace
  `Status: Pending` with `Running`, append `Normal  Scheduled  default-scheduler  Successfully assigned default/<pod> to <node>`,
  and set `p.runningAt = sim.history.length` (lets a task require "`kubectl get pods` after it ran").
- Timing knobs on `cluster.karpenter` (defaults keep other missions unchanged): `launchTicks` (NodeClaim Ready at
  `bornTick + launchTicks`; keep NODE column blank until Ready) and `consolidateTicks` (a node must stay empty/underutilized
  that many reconciles before it is disrupted; track `n.candidateSince`).

Mission data (`data-karpenter.js`):
- **Pehla Node**: `launchTicks: 4`; add task "Pod Running dekho (`kubectl get pods`)" using `runningAt`; update success + add `solution`.
- **Consolidation Live**: put Spark on an under-utilized, pricier on-demand node listed **first** (e.g. `m6a.2xlarge`, 2/8 CPU) so it
  really is a consolidation candidate; `consolidateTicks: 5`; add a scripted
  `kubectl annotate pod spark-job-driver karpenter.sh/do-not-disrupt=true` response (same effect as `protect-spark.yaml`);
  if Spark's node is consolidated first, move the pod and reset its logs ("job restarted from partition 0") as the lesson.
- **Pending Pod Mystery**: `gpu-trainer` requests `nvidia.com/gpu: 1` (drop the `nvidia.com/gpu=true` nodeSelector — that
  label isn't added by Karpenter); default-scheduler line `0/1 nodes are available: 1 Insufficient cpu, 1 Insufficient nvidia.com/gpu.`;
  default NodePool gets `karpenter.k8s.aws/instance-size In [large, xlarge, 2xlarge]` so 32 CPU truly has no type;
  `fix-huge-job-requests` → 6 CPU / 12Gi (8 CPU won't fit an 8-vCPU node after overhead);
  `add-gpu-nodepool` → requirement `instance-family In [g5]`, taint `nvidia.com/gpu=true:NoSchedule`, `nodeClassRef: gpu` + push an
  EC2NodeClass `gpu` (NVIDIA AMI), toleration on the pod; successText: GPU nodes also need the NVIDIA device plugin / GPU Operator.
- Run all karpenter replays + `node validate.js` (karpenter has many engine tests).

### B. Solutions for the 15 KodeKloud missions
`node tools/replay-missions.js list` shows which still say `---`. For each: `info <levelId>`, write the commands, `run`, then
add `solution: [...]`. While replaying, fix the same classes of bugs already fixed elsewhere:
- fixes that are node-level or git-level but use `kubectl apply -f` → convert to `bash x.sh` (see etcd/cert/argowaves);
- a `successText` that tells the learner to run something (input is disabled after the win) → make it a task instead (see `argobasics`);
- static `describe`/`logs` text that stays stale after a fix;
- pods whose `logs` should be realistic for their state (see §2 table).

When all 43 missions have solutions, change the `TODO (HANDOFF.md)` warning in `validate.js` back into an `assert`.

### C. Small leftovers
- MCQ length bias: `node tools/mcq-bias.js list beginner` (16%), then advanced, argocd, intermediate, helm. Make wrong options
  as long and as plausible as the right one; keep explanations consistent. Choices are shuffled at render time, so only length matters.
- Not yet measured: `incident` choices (`good: true` vs false length) and Decision Dojo practice options.
- Validator hardening ideas: duplicate `fill` answers, duplicate `match`/`bins` items, duplicate interview choices, an MCQ-bias
  ceiling, the strict solution check from B.
- Content still worth a careful read (not audited line by line): `kk-hardening` and `kk-terminating` lessons, `kk-pending`, `kk-schrodinger`.

### D. Docs, QA, finish
- Update `README.md` and `EXTENDING.md`: Decision Dojo, Real Labs (`real-labs/`), resume-anywhere, mood picker, Helm 4 flavoured
  sim, Karpenter sim, terminal features from §2 (especially `solution`, `.sh` files, `apiError`, `renderError`), and the two tools.
- Browser QA with Playwright (Chromium at `/opt/pw-browsers`): open `index.html`, play one level per track, Decision Dojo,
  Real Labs page, a terminal mission; check 375px width (no horizontal scroll).
- Commit, push (see §2), then reply to the user in **Hinglish** with a short summary and a Sources list.

## 4. Facts already verified (don't re-research)
On a real kind 1.32 cluster:
- `kubectl logs` during CrashLoopBackOff = last crashed run; `--previous` needed once the container restarted and is Running.
  `--restart=Never` pod → status `Error`, `--previous` fails ("previous terminated container … not found").
- Pending (unscheduled) pod → `kubectl logs` prints nothing; ImagePull → "waiting to start: image can't be pulled".
- ResourceQuota `pods` counts only non-terminal pods: Completed/Failed don't count. Error text in 1.30+:
  `must specify requests.cpu for: <container>`. `rollout restart` under a full quota leaves the new ReplicaSet at 0.
- Service links: `REDIS_PORT=tcp://…`, `REDIS_SERVICE_HOST`, `REDIS_PORT_6379_TCP_*`; explicit env wins.
- Exec-form missing binary → `StartError`, exit 128; `sh -c 'missing'` → exit 127 ("sh: …: not found").
- OrderedReady StatefulSet: a CrashLoop pod is **not** replaced after a template fix — delete it ("forced rollback").
- Helm 3.16 / 4.0.4 lint: missing `version` stops lint before templates; `helpers.tpl` without `_` is **not** a lint warning;
  typo → `nil pointer evaluating interface {}.tag` (Helm 4 prints it on three lines).

From upstream sources:
- etcd 3.6 removed `etcdctl snapshot status/restore` → `etcdutl` (https://etcd.io/blog/2025/announcing-etcd-3.6/); kubeadm
  1.33 ships etcd 3.5.24, 1.34 ships 3.6.5 (kubeadm `constants.go`).
- kube-proxy: nftables GA 1.33 (kernel 5.13+), iptables still default, IPVS deprecated 1.35 (KEP-5495); IPVS binds ClusterIPs
  to `kube-ipvs0`, so ping answers there. Userspace mode removed in 1.26.
- kubeadm: restart control-plane static pods after `certs renew` (move manifests out ~20s); `kubeadm upgrade` renews certs.
- Non-graceful node shutdown: taint `node.kubernetes.io/out-of-service=nodeshutdown:NoExecute` (GA 1.28).
- Earlier sessions: Karpenter v1 CRD fields, Helm 4 flag renames (`--atomic`→`--rollback-on-failure`, `--force`→`--force-replace`),
  Helm 3 security fixes until Feb 10 2027, ingress-nginx retirement (March 2026).

## 5. Environment notes
This container had a kind cluster plus `kubectl`/`helm` wrappers in the session scratchpad; they are **not** in the repo.
A new session needs its own cluster (`kind create cluster`) to re-verify anything on a real cluster.
