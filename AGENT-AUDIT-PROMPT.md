# Gurukul Audit & Upgrade — Master Prompt for AI Agents

> Copy everything below the line into a fresh agent session.
> Fill the `{{...}}` placeholders first. Works for any "*-gurukul" style learning app
> (kube-gurukul, sys-design-gurukul, linux-gurukul, aws-gurukul, ...).

---

## 0. Context (fill these in)

- **Repo:** `{{OWNER/REPO}}`  (e.g. `godparticle1996/sys-design-gurukul`)
- **Work branch:** `{{BRANCH}}` — commit and push only here. Do NOT open a PR or touch `main` unless I explicitly ask.
- **Domain:** `{{DOMAIN}}` (e.g. "System Design — HLD/LLD, scaling, databases, caching, queues, consistency")
- **Target learner:** someone preparing for real jobs + interviews, wants **production depth**, not textbook trivia.
- **Language of learner-facing content:** Hinglish (Roman script Hindi + English tech terms). No Devanagari characters anywhere.
- **Learner profile:** ADHD-friendly — short chunks, one idea per screen, zero guesswork, every step says *what to do* and *why*.

## 1. Your mission

You are a senior engineer + senior instructor. Deeply audit the entire codebase and its content, then:

1. **Find and fix every issue** — code bugs, wrong facts, outdated info, broken/unsolvable exercises, misleading explanations, biased quizzes, UI problems.
2. **Improve the teaching** — make concepts interactive, add hands-on exercises, and teach **decisions** ("kab kya use karein", "X vs Y", trade-offs, decision trees), not just definitions.
3. **Leave the repo strictly better and provably correct** — automated checks that prove the content works, and a handoff doc if you can't finish.

When something is genuinely ambiguous (scope, audience, depth, a big redesign), **ask me** with concrete options and your recommendation. For everything else, decide sensibly and move on.

## 2. Phase 1 — Discover (do this before changing anything)

1. Read README, any HANDOFF/TODO/CONTRIBUTING docs, and the git log to understand history and prior intentions.
2. Map the architecture: entry HTML, how content is registered (levels/modules/lessons), simulators/engines, quiz format, storage/progress, any build or validate script.
3. Run whatever checks exist (`node validate.js`, `npm test`, lint). Record the baseline: what passes, what fails, what warns.
4. Open the app in a headless browser (Playwright/Chromium is usually available) and click through: home, one lesson of each level, one exercise/mission, one quiz. Note console errors.
5. Produce an **inventory**: number of levels, lessons, missions/exercises, quiz questions, simulators. This is your coverage checklist — every item must be audited by the end.

## 3. Phase 2 — Audit checklist

Work through every category. Keep a findings log (file in scratchpad or `AUDIT-FINDINGS.md`) with: `ID | file:line | category | severity (P0 broken / P1 wrong / P2 weak / P3 polish) | finding | fix`.

### A. Factual correctness (highest priority)
- Every technical claim must be **true for current versions** (state the version where it matters). Watch for things that changed recently — deprecated flags, removed commands, new defaults, renamed features.
- **Verify, don't trust memory.** Order of preference:
  1. Run it for real (docker / local tool / kind / a real DB/Redis/Kafka container) and capture exact output.
  2. Official docs, release notes, changelogs, source code.
  3. Reputable engineering blogs — only as a last resort, and cross-check.
- Numbers must be defensible: latencies, throughput, limits, quotas, default timeouts, sizes, costs. Give orders of magnitude with units and context ("~1 ms same-DC round trip"), never fake precision.
- Domain examples for **system design**: CAP/PACELC wording, consistency models, replication (sync vs async, quorum math `R+W>N`), sharding/consistent hashing, cache strategies (aside / through / back / eviction), queue semantics (at-least-once vs exactly-once — be honest about the caveats), DB isolation levels and what anomalies each prevents, rate-limiter algorithms, back-of-envelope estimates (check the arithmetic!), CDN/DNS/load-balancer layers (L4 vs L7).
- Simulated tool output (terminal, CLI, query results, error messages) must **match the real tool byte-for-byte where practical** — exact error strings, column names, exit codes. Learners will meet the real thing in interviews and on the job.

### B. Exercises / missions are actually solvable — and only the right way
- For every exercise, write the **intended solution** as data (e.g. a `solution: [...]` array of commands/actions) and build a **replay test** that runs it through the engine and asserts the mission is won — and won **only after the final step** (not earlier by accident).
- Try **shortcuts and cheats**: wrong-but-plausible answers, skipping steps, deleting/resetting everything, brute-force options. If a wrong approach "wins", the exercise teaches the wrong lesson → fix the engine or the win condition.
- Win conditions must check the **real state** (e.g. "pods are Running after fix", "p99 latency under target"), not just "user typed command X".
- Hints must be progressive (nudge → stronger hint → near-answer) and must never contradict the solution.
- Every failure path should give a **useful, realistic error** that teaches debugging, not a generic "wrong".

### C. Engine / simulator code quality
- Grep for crash paths: regex match results used without guards (`m[1]` when `m` may be `[]`/null), undefined lookups, unhandled branches in command parsers.
- Feed the engine garbage, empty input, extra whitespace, flags in different order, `sudo` prefixes, uppercase, aliases. It must never throw.
- State must reset cleanly between missions; progress storage must survive reloads and schema changes.
- Keep helpers namespaced (no stray globals that collide across data files).

### D. Pedagogy (ADHD-friendly, no guesswork)
- One idea per chunk. Lead with **why it matters / the real-world pain**, then the concept, then a tiny example, then a hands-on step.
- Every instruction is explicit: what to type/click, what you should see, what it means. No "figure it out".
- Every major topic gets a **decision section**: "Kab use karein / kab nahi", "X vs Y" comparison table, and a small decision tree. Include real company-scale examples and common interview follow-ups.
- Add "Galti jo sab karte hain" (common mistakes) and "Production me kya hota hai" (what actually breaks at scale) boxes.
- Progression must be coherent: no concept used before it's taught; difficulty ramps smoothly.
- Consistent Hinglish tone; tech terms stay in English; no Devanagari; no mixed-script typos.

### E. Quiz / MCQ quality
- **Length bias:** the correct option must not be systematically the longest (or shortest). Build a small script that flags any question where the correct answer is ≥1.15× longer than every distractor or ≤0.85× of them. Target: under ~5% flagged.
- **Position bias:** correct answers spread roughly evenly across A/B/C/D.
- Distractors must be **plausible misconceptions**, not obviously silly. Avoid "all of the above"/give-away wording ("always", "never" only on wrong options).
- Every question has an explanation that says why the right answer is right **and** why each tempting wrong answer is wrong.
- Re-verify the facts in every question (see A).

### F. UI / UX
- Works at phone width (360px) without horizontal scroll; keyboard navigable; readable contrast in light and dark.
- No console errors on any screen. Progress indicators accurate. Loading of all data files succeeds.

## 4. Phase 3 — Build guard-rails (so it stays fixed)

Add/extend lightweight dev tools (plain Node, no heavy deps):
- `validate.js` (or equivalent): loads all content, checks schema (required fields, unique IDs, no Devanagari, links resolve), and **replays every exercise solution**. Start missing-solution as a warning; make it strict once all exercises have solutions.
- `tools/replay-*.js`: list / inspect / run a single exercise step-by-step for debugging.
- `tools/mcq-bias.js`: reports length and position bias per file.
- Run all of these before every commit. Never commit with the validator red.

## 5. Phase 4 — Enhancements (after the fixes, not instead of them)

Pick the highest-value ones for the domain; ask me if a big new module is in doubt. Ideas for **system design**:
- Interactive **back-of-envelope calculator** (QPS, storage/yr, bandwidth, cache size) with step-by-step reasoning.
- **Architecture builder**: learner picks components (LB, cache, DB, queue, CDN) for a scenario; the sim scores it against load/failure scenarios and explains what breaks.
- **Failure-injection labs**: "DB primary died", "cache stampede", "hot shard", "queue backlog" — learner must choose the mitigation; wrong choices show realistic consequences.
- **Trade-off duels**: SQL vs NoSQL, Kafka vs RabbitMQ vs SQS, push vs pull fan-out, strong vs eventual consistency — with a decision tree and real examples.
- **Interview mode**: classic problems (URL shortener, rate limiter, chat, news feed, payment system) with timed stages: requirements → estimates → API → data model → HLD → deep dives → bottlenecks, and a rubric.
- Optional **real labs** with docker-compose (Redis, Postgres replicas, Kafka) so learners can see replication lag, eviction, consumer groups for real.

## 6. Working rules

- **Small, focused commits** with clear messages (one theme per commit: "fix: ...", "content: ...", "feat: ...", "test: ..."). Validator green before each.
- Push to `{{BRANCH}}` with `git push -u origin {{BRANCH}}`; retry on network errors with backoff. No PRs, no force-push, no merging to main unless asked.
- Don't delete or rewrite large content blindly — read it first; preserve what is good.
- Prefer fixing the engine over special-casing one exercise.
- If you verified a fact by running real tools, note the version and command in the commit message or a comment.
- **If you are running low on context/tokens**, stop starting new work and write `HANDOFF.md`: what's done (with commit hashes), what's left (ordered by priority), exact steps and file locations for each remaining item, known gotchas, and how to run the checks. Commit and push it.

## 7. Definition of done

- [ ] Every item in the inventory audited; findings log complete with each finding fixed or explicitly deferred with a reason.
- [ ] All facts verified against current versions; simulated outputs match real tools.
- [ ] Every exercise has a solution and passes replay; validator is strict and green.
- [ ] MCQ bias under target in every file; every question has full explanations.
- [ ] Every major topic has a "kab kya / X vs Y" decision section.
- [ ] No console errors; mobile layout works.
- [ ] README updated (how to run, how to validate, how to add content).
- [ ] All work pushed to `{{BRANCH}}`.
- [ ] Final summary for me **in Hinglish**: what was wrong (top issues), what you fixed, what you added, numbers before → after (bugs, replay-proven exercises, MCQ bias %), and what's left.
