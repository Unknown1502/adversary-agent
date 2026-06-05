# Adversary — Gap-Closure Plan (path to a flawless, judge-wowing submission)

> Status snapshot taken 2026-06-05. Tracks everything between "code exists" and
> "demo lands." Check items off as you go. 🔴 = blocks the demo, 🟡 = needed for
> the "wow", 🟢 = polish.

---

## 0. What's already verified working (good news)

These were checked end-to-end in a clean `.venv` on this machine:

- ✅ All Python deps install cleanly (`arize-phoenix 17.2.0`, `google-adk 2.2.0`,
  `mcp 1.27.2`, `google-genai 2.8.0`). `requirements.lock` is frozen.
- ✅ **Phase-0 smoke passes** — the whole integration spine works on current versions:
  - `google.adk.tools.mcp_tool.mcp_toolset` imports (ADK MCP path intact).
  - `adversary.telemetry.init_telemetry` imports.
  - `npx @arizeai/phoenix-mcp` launches → "Phoenix MCP Server running on stdio".
- ✅ **12/12 pytest tests pass** in the venv. (One stale assertion fixed — it
  assumed the loop stops after 1 attempt, but a blocked verdict retries to the
  attempt budget.)
- ✅ `docs/images/architecture.png` rendered from the mermaid source.
- ✅ Real Phoenix key + personal endpoint moved out of `.env.example` (now
  placeholders) and into the gitignored `.env`. **Not a leak** — this is not yet
  a git repo (no `.git`, no remote), so nothing was ever committed or pushed. This
  is just hygiene for when you do `git init` + push.

So the architecture is real and the integration is sound. The remaining gaps are
**credentials, a real run, and demo assets** — not code.

---

## 1. 🔴 CRITICAL — do these or there is no demo

### 1.1 Make this a public git repo (submission requires it)
This is **not yet a git repository** (no `.git`, no remote), yet the submission
checklist promises a "Public repo with Apache-2.0 license." Not a security item —
the Phoenix key was never leaked because nothing was ever committed.
- [ ] `git init` and make a first commit.
- [ ] Before pushing, confirm `.env` is gitignored (it is) and that the real key
      is NOT in `.env.example` (already moved to placeholders).
- [ ] Create the public GitHub repo and push. Confirm `LICENSE` shows in the
      About panel.

### 1.2 Stand up Google Cloud (you said "nothing set up yet")
A live campaign against real Gemini is impossible until this exists.
- [ ] Create a GCP project; note the project id.
- [ ] **Enable billing** on it (Vertex AI calls require it).
- [ ] Enable the **Vertex AI API** (`aiplatform.googleapis.com`).
- [ ] Install the gcloud CLI (not present on this machine) and
      `gcloud auth application-default login`.
- [ ] Put the project id in `.env` → `GOOGLE_CLOUD_PROJECT=`.

### 1.3 Confirm the real Gemini model IDs ⚠️ single biggest live-demo risk
`config.py` defaults to `gemini-3-pro` / `gemini-3-flash` — these are **guesses**
flagged as "CONFIRM" in the code and `.env.example`. Wrong ids → every agent call
500s → nothing works on camera.
- [ ] Open Vertex AI **Model Garden** in your project, find the exact current ids.
- [ ] Set `MODEL_PRO` / `MODEL_FLASH` in `.env` to the confirmed ids.
- [ ] Smoke a single call: a 3-line script that builds the Attacker and asks it
      one prompt. If you get text back, the ids + auth + billing are all good.

### 1.4 Prove one real end-to-end campaign
- [ ] With 1.1–1.3 done: `.\make.ps1 demo-run` (uses the venv python).
- [ ] Confirm `reports/<id>.json` and `reports/<id>.md` actually get written.
- [ ] Confirm at least one class reaches **breach** on the vulnerable target
      (the refund ledger grew). If nothing breaches, tune the attack prompts in
      `adversary/attacks/` and the vulnerable instruction in
      `target/support_agent.py` until the seeded story reproduces.

---

## 2. 🟡 IMPORTANT — this is where the "wow" actually comes from

### 2.1 Seed Phoenix so the self-improvement beat has memory to read
This is **the entire scored value** of the Arize track, and seeding needs **only
Phoenix, not GCP** — so you can do it today.
- [ ] `.\make.ps1 seed-dry` — eyeball the two fixture campaigns.
- [ ] `.\make.ps1 seed` — push them to Phoenix.
- [ ] In Phoenix UI, confirm the spans landed in the `adversary` project with the
      `attack.class` / `technique` / verdict attributes.

### 2.2 Witness the live adaptive break on screen
This is the money shot for the video (README "The one beat").
- [ ] Run a campaign and watch the Strategist call Phoenix MCP, get the
      `authority_framing → breach` evidence, re-craft, and break the target.
- [ ] If the Strategist isn't actually calling MCP tools, check `strategist.py`
      logs for "Phoenix MCP toolset unavailable" — that means it silently fell
      back to the prompt-only ladder and the wow moment won't happen.

### 2.3 Record the 3-minute demo video
The submission checklist already claims this is done; it can't be yet.
- [ ] Script the 3 beats: seeded history → live MCP query → adaptive breach.
- [ ] Show the Phoenix trace pane and the refund-ledger breach side by side.
- [ ] Keep it under 3:00.

### 2.4 Replace the aspirational README numbers with real ones
The metrics tables say "expected outcomes... copied into this README at
submission time."
- [ ] After 1.4, copy the actual per-class verdicts from `reports/<id>.md` into
      the README tables. Judges can tell seeded fixtures from real runs.

---

## 3. 🟢 POLISH

- [ ] Run the frontend (`.\make.ps1 frontend`) and confirm the SSE stream renders
      the campaign tree + live trace pane against a real backend.
- [ ] Decide hosting: the README promises a warm Cloud Run URL (min-instances=1).
      That needs gcloud + a successful `deploy/deploy.ps1`. If you won't deploy,
      soften that claim in the README and the checklist.
- [ ] `.gcloudignore` / Dockerfile: confirm the image builds locally
      (`docker build .`) before trusting the Cloud Run path.
- [ ] Confirm `LICENSE` (Apache-2.0) is detected by GitHub's About panel.

---

## 4. Dependency-version watch-outs

The lock pinned versions **newer** than the README's stated ranges. Smoke proved
imports still work, but if anything breaks at runtime, suspect these first:
- `google-adk 2.2.0` — session API (`create_session` sync/async) and
  `MCPToolset` / `StdioServerParameters` signatures. The orchestrator already
  defends against both via `_ensure_session`.
- `arize-phoenix 17.2.0` — `phoenix.otel.register` signature and the
  `phoenix_log` verdict-annotation API (the test logs warn "no compatible API
  found" — verify the live annotation path actually writes to Phoenix).

---

## 5. The fastest "no-GCP" fallback (if cloud setup stalls before the deadline)

If GCP can't be ready in time, you can still demo the **scored** part:
1. Seed Phoenix (§2.1) — no GCP needed.
2. Record the Strategist's MCP self-introspection reading that history.
3. The actual Gemini breach is the only piece that needs GCP. Consider adding a
   small `--offline` flag to `scripts/run_campaign.py` that feeds scripted agent
   responses (the test fixtures already prove the loop runs with mocked agents) —
   this would let you produce a deterministic recorded campaign with zero cloud
   credentials. **This flag does not exist yet**; it's the one piece of new code
   worth writing if the deadline gets tight.
