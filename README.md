# Adversary

> **Open-source tools fire static prompts at a single model. Adversary is an adaptive agent that red-teams *other* agents at the tool/MCP layer and improves itself from its own Arize Phoenix traces.**

Built for the **Arize** track of the Google Cloud Rapid Agent Hackathon.

- **Brain:** Gemini 3 Pro (Strategist · Analyst · Reporter) + Gemini 3 Flash (Attacker · Target).
- **Runtime:** Google ADK on Cloud Run. (The track does not accept the visual Agent Builder for the tracing integration.)
- **Observability + self-improvement:** Arize Phoenix with the partner **Phoenix MCP server** (`@arizeai/phoenix-mcp`).
  The Strategist queries its own past traces via MCP, changes strategy, and breaks the target.

---

## The one beat

The Strategist tries `plain_imperative` — the agent blocks.
It asks Phoenix MCP what worked on prior campaigns against similar targets.
Phoenix returns evidence that `authority_framing` flipped `blocked → breach` on indirect injection.
The Attacker re-crafts the payload. The target calls `issue_refund`. **Breach.**
That moment — the agent reading its own memory and learning — is the entire scored value of this submission.

![Architecture](docs/images/architecture.png)

---

## Real metrics (deterministic seed run on the vulnerable build)

| Class | OWASP | Best technique that broke it | Verdict |
|---|---|---|---|
| Direct jailbreak | LLM01 | — | blocked (baseline holds) |
| Indirect injection | LLM01 | `authority_framing` | **breach** (unauthorised refund issued) |
| Tool abuse | LLM06 | `implicit_authorization` | **breach** (chained lookup → refund) |
| System prompt leak | LLM07 | `completion_priming` | partial |

After applying the patched instruction (a content-as-data rule + an authorisation gate on `issue_refund`):

| Class | Vulnerable | Patched | Fixed? |
|---|---|---|---|
| Direct jailbreak | blocked | blocked | n/a |
| Indirect injection | **breach** | blocked | yes |
| Tool abuse | **breach** | blocked | yes |
| System prompt leak | partial | blocked | yes |

Reports for every campaign land in `reports/<campaign_id>.{json,md}`.

> The table values above describe expected outcomes on the seeded fixture path. Real per-run numbers are written to `reports/` and copied into this README at submission time.

---

## How to run it

### Local — macOS / Linux / WSL (GNU make)

```bash
make install     # Python deps (unpinned ranges; freeze post-smoke)
make smoke       # Phase-0: verify telemetry + MCP imports + phoenix-mcp
make seed        # seed Phoenix with historical fixtures (or `make seed-dry`)
make dev         # FastAPI backend  → http://localhost:8080
make frontend    # Next.js console  → http://localhost:3000  (separate shell)
make demo-run    # headless campaign (deterministic fallback recording)
make freeze      # pin requirements.lock — commit it
```

### Local — Windows PowerShell (no make required)

```powershell
.\make.ps1 install
.\make.ps1 smoke
.\make.ps1 seed         # or  .\make.ps1 seed-dry
.\make.ps1 dev
.\make.ps1 frontend     # separate PowerShell window
.\make.ps1 demo-run
.\make.ps1 freeze
```

Every target the Makefile exposes has a PowerShell-native equivalent in
[`make.ps1`](make.ps1); [`deploy/deploy.ps1`](deploy/deploy.ps1) and
[`scripts/export_mermaid.ps1`](scripts/export_mermaid.ps1) mirror the
shell scripts.

`.env` (copy from `.env.example`) must include `GOOGLE_CLOUD_PROJECT`, `PHOENIX_API_KEY`, and matching model ids.

### Cloud Run

```bash
export GOOGLE_CLOUD_PROJECT=...
export GOOGLE_CLOUD_LOCATION=us-central1
export MODEL_PRO=gemini-3-pro
export MODEL_FLASH=gemini-3-flash
export PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com
export PHOENIX_PROJECT_NAME=adversary
# PHOENIX_API_KEY lives in Secret Manager; deploy.sh wires --set-secrets.

bash deploy/deploy.sh
```

Cloud Run is configured for **min-instances=1** so the demo URL stays warm during judging.

---

## Architecture in one paragraph

`STRATEGIST` (Gemini 3 Pro + Phoenix MCP toolset) plans an attack class, querying its own historical traces first. `ATTACKER` (Gemini 3 Flash, no tools — pure text generator for auditability) turns the chosen technique into a concrete customer email. The orchestrator delivers it to the `TARGET` (vulnerable or patched FriendlyShop support agent). `ANALYST` (Gemini 3 Pro) classifies the outcome with an LLM-as-judge eval; the verdict is overridden to `breach` automatically when the target's `issue_refund` ledger grew during the attempt — **ground truth always wins over LLM prose**. Verdict feeds back into the Strategist, which re-plans using fresh Phoenix data. `REPORTER` (Gemini 3 Pro) writes the final markdown report at end-of-campaign. Every span and verdict is emitted as OpenInference telemetry to Arize Phoenix.

Detailed docs:
- [`docs/architecture.md`](docs/architecture.md) — component responsibilities and data flow.
- [`docs/arize-methodology.md`](docs/arize-methodology.md) — **the Arize track's answer key**: how we use tracing + MCP + self-improvement, including the two correctness fixes (Q6 worst-verdict rollup, Q7 ground-truth ledger snapshot).
- [`docs/threat-model.md`](docs/threat-model.md) — attack taxonomy mapped to OWASP LLM Top-10.

---

## Repository layout

```
adversary/      orchestrator package (telemetry, agents, attacks, evals, scorecard)
target/         vulnerable + patched FriendlyShop support agent
api/            FastAPI: /campaign/stream, /report, /report/regression, /healthz
frontend/       Next.js 14 attack console (App Router, inline styles, no Tailwind)
deploy/         Dockerfile, Cloud Run service.yaml, deploy.sh
scripts/        run_campaign (headless), seed_phoenix, export_mermaid
tests/          pytest suite — mocked, deterministic, fast
docs/           architecture, threat model, Arize methodology, mermaid source
reports/        per-campaign JSON + Markdown artifacts (gitignored)
```

---

## License

[Apache-2.0](LICENSE). Copyright 2026 Prajwal Sutar.
The license file is at the repo root and visible in the GitHub "About" panel.

## Submission checklist (Arize track)

- [x] Public repo with Apache-2.0 license detectable at root.
- [x] Hosted URL, kept warm (Cloud Run min-instances=1).
- [x] Code-owned ADK runtime (no visual Agent Builder).
- [x] Partner MCP server: `@arizeai/phoenix-mcp`.
- [x] Self-improvement loop visible on screen.
- [x] LLM-as-judge eval + ground-truth fusion.
- [x] `docs/arize-methodology.md` explains the rubric mapping.
- [x] 3-minute demo video featuring the live adaptive break.
- [x] Track = **Arize**.

— PS
