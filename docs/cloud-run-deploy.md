> **Optional reference, not part of the labs.** The labs deploy with `agents-cli deploy` to Agent Runtime (see [agent-runtime-deploy.md](agent-runtime-deploy.md)). This page documents the older Cloud Run + Cloud Build path with an eval-gated pipeline. You do not need it, or `cloudbuild.yaml`, to complete any lab.

# Setup guide: deploy to Cloud Run + CI/CD (Week 4)

This ships the governed agent to production on Cloud Run, with a Cloud Build
config that gates deploys on the eval set. All the app APIs were enabled
during initial setup. ⏱ **note deploy time and total spend** — the spend number opens the
Week 4 deck.

> **Updated 2026-08-17 with a real, tested runbook.** The original version of
> this doc pointed at `agents-cli scaffold enhance` and `agents-cli deploy` as
> the path to Cloud Run. That doesn't fit this project: it was hand-built, not
> `agents-cli scaffold`-generated, so `scaffold enhance` in place risks
> clobbering the hand-pinned `pyproject.toml` (go/no-go decision #4 — exact
> versions, not ranges) and misplacing files (the agent lives at
> `backend/social_poster/`, not the `app/` directory `enhance` expects). A
> reference project scaffolded into `/tmp` for comparison also generated a
> full multi-project Terraform CI/CD pipeline (separate staging/prod GCP
> projects, an Artifact Registry repo, GitHub repo connection, and
> `min_instance_count = 1`, i.e. an always-warm instance) — way more than a
> single-project workshop POC needs, and directly contradicts this doc's own
> §6 claim that Cloud Run idles at ~nil cost. **The `Dockerfile` and
> `cloudbuild.yaml` now committed in this repo's root were hand-written
> instead**, matching the project's actual layout and staying single-project,
> scale-to-zero. Everything below reflects what was actually run.

> **Why not `adk deploy cloud_run`?** ADK ships its own one-line Cloud Run
> deploy command (present in our pinned `google-adk==2.4.0` — check with
> `adk deploy cloud_run --help`). It doesn't fit this project: the container
> it builds always runs `adk api_server` inside (see
> `google/adk/cli/cli_deploy.py`), which serves ADK's native REST surface
> (`/run`, `/apps/{app}/...`) — not the AG-UI protocol endpoint
> (`/api/adk`, from `ag_ui_adk.add_adk_fastapi_endpoint` in `backend/main.py`)
> that the CopilotKit frontend actually calls. It's the right tool for a bare
> ADK agent with no custom FastAPI layer; this project has had one since
> Week 1. Use it for a quick agent-only smoke deploy if you ever want one,
> but it is not a substitute for the Dockerfile below.
>
> **Can it be pointed at a custom app instead?** No — checked
> `to_cloud_run()` in full. The container `CMD` is hardcoded to
> `adk api_server` (or `api_server --with_ui`); no flag swaps in a different
> entrypoint. You *can* inject extra pip deps via a `requirements.txt` in the
> agent folder, but that doesn't help — the entrypoint still starts ADK's own
> internal FastAPI app, never `backend/main.py`. The function also deletes
> its `--temp_folder` staging directory in a `finally` block right after
> calling `gcloud run deploy`, so there's no generate-then-patch-then-deploy
> window either (unlike the `agents-cli scaffold create` reference-project
> trick used elsewhere in this doc's history). Bottom line: a hand-owned
> Dockerfile is the correct, not just convenient, choice once a project has
> a custom FastAPI/AG-UI layer.

## 0. What's already in the repo

- [`Dockerfile`](../Dockerfile) — `python:3.12-slim`, `uv sync --frozen`,
  `uvicorn backend.main:app` on `$PORT`. Backend only — the Next.js frontend
  stays local and points at whichever backend URL you give it (see §3).
- [`cloudbuild.yaml`](../cloudbuild.yaml) — two steps: `eval-gate` then
  `deploy`. See §4 for the gotcha baked into the eval-gate step.

## 1. Service account + IAM

Don't reuse the default compute service account — create a scoped one for
this service:

```bash
gcloud iam service-accounts create social-poster-run \
  --display-name="social-poster Cloud Run service account" \
  --project=YOUR_PROJECT_ID
```

| Role | Why |
|---|---|
| `roles/aiplatform.user` | Gemini calls on Agent Platform |
| `roles/modelarmor.user` | guardrail sanitize calls |
| `roles/dlp.user` | PII redaction |
| `roles/secretmanager.secretAccessor` | read `MODEL_ARMOR_TEMPLATE_ID` |

`roles/discoveryengine.viewer` (for the memory agent's datastore) is **not**
granted here — the deployed service runs with `MEMORY_AGENT_CARD_URL` blank
(memory tool off in prod), matching the "optional integrations are env-gated,
blank = off" pattern used everywhere else in this POC. Add it if you deploy
the real Agent Engine memory agent from
[agent-engine-rag-setup.md](agent-engine-rag-setup.md) and wire it in.

```bash
SA="social-poster-run@YOUR_PROJECT_ID.iam.gserviceaccount.com"
for ROLE in roles/aiplatform.user roles/modelarmor.user roles/dlp.user roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:$SA" \
    --role="$ROLE" \
    --condition=None
done
```

⏱ **note any IAM friction** — it's codelab material (attendees will hit the
same missing-role errors).

> **Codelab aside**: a coding agent helping with this deploy will very likely
> get its own IAM-binding and Secret Manager commands blocked by its safety
> classifier — both count as "modifying security settings" / "handling
> credentials," which agents are (correctly) kept away from. That's a
> deliberate separation of duties, not a bug — worth calling out live if it
> comes up, it's a good teaching moment about agent guardrails outside this
> POC's own Model Armor/DLP layer.

## 2. Secret Manager

Only `MODEL_ARMOR_TEMPLATE_ID` needs to be a secret. `LINKEDIN_ACCESS_TOKEN`
and `BUFFER_API_KEY` are blank in local `.env` too — `DRY_RUN=true` short-
circuits before either is read (see `mcp/linkedin_server.py`), so a literal
empty string in `--set-env-vars` matches local behaviour exactly. Move them to
Secret Manager the day a real token exists.

```bash
gcloud services enable secretmanager.googleapis.com --project=YOUR_PROJECT_ID

echo -n "devcamp-guardrails" | gcloud secrets create model-armor-template-id \
  --data-file=- \
  --replication-policy=automatic \
  --project=YOUR_PROJECT_ID
```

## 3. Deploy

One-off manual deploy (builds via Cloud Build automatically from `--source`):

```bash
gcloud run deploy social-poster \
  --source=. \
  --region=us-central1 \
  --service-account=social-poster-run@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --min-instances=0 \
  --max-instances=3 \
  --set-env-vars=GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,RESEARCH_MODEL=gemini-flash-latest,DRAFT_MODEL=gemini-flash-latest,ORCHESTRATOR_MODEL=gemini-flash-latest,DRY_RUN=true,MEMORY_AGENT_CARD_URL=,IMAGE_MODEL_ID=gemini-3.1-flash-image,LINKEDIN_ACCESS_TOKEN=,BUFFER_API_KEY= \
  --set-secrets=MODEL_ARMOR_TEMPLATE_ID=model-armor-template-id:latest \
  --project=YOUR_PROJECT_ID
```

⏱ **note deploy time**.

**Why `--no-allow-unauthenticated`**: this is an LLM-calling endpoint; there's
no reason to expose it to the open internet for a workshop test. Verify
against it with an authenticated local proxy instead of a bare public URL:

```bash
gcloud run services proxy social-poster --region=us-central1 --port=8000
```

Leave that running in one terminal. In another, run the frontend as usual —
it already defaults to `http://localhost:8000` (`ADK_BACKEND_URL`,
`NEXT_PUBLIC_BACKEND_ORIGIN` in `frontend/app/api/copilotkit/route.ts` and
`frontend/app/components/PostGallery.tsx`), so the proxy transparently swaps
your prod deploy in for the local `uv run uvicorn` backend with zero frontend
changes. Walk the golden path: idea → draft → approve → dry-run post.

If you'd rather hit a public URL directly (simpler, but exposes the endpoint
publicly — DRY_RUN still protects against a real post, but not against
someone burning your Gemini quota), redeploy with `--allow-unauthenticated`
in place of `--no-allow-unauthenticated`.

## 4. CI/CD: eval-gated deploys

[`cloudbuild.yaml`](../cloudbuild.yaml) runs the golden evalset before
`gcloud run deploy`, so a change that breaks approval-gating or PII redaction
never reaches prod — same idea as the original sketch, but with one critical
fix:

> **Gotcha, verified 2026-08-17: `adk eval` always exits 0**, even when tests
> fail. Confirmed by deliberately forcing a known-flaky config (the
> `flash-lite` cost-experiment mix from this repo's README, which scores 2-4
> out of 5) and checking the subprocess return code directly — `0` both times,
> once at 5/5 and once at 3/5. A bare `uv run adk eval ...` step in CI would
> **silently let regressions through**. `cloudbuild.yaml`'s `eval-gate` step
> instead pipes the output through `tee`, greps `Tests failed: N` out of the
> summary, and does `exit 1` itself when `N > 0` (or when nothing parses, so
> a changed output format fails closed instead of open). This is the actual
> mechanism that blocks the `deploy` step on a regression — not `adk eval`'s
> own exit code.

The eval-gate step also runs `mock_memory_agent.py` as a background sidecar
in the same build step (same container, `&` + `sleep 5` before the eval
starts) — no separate memory-agent deployment needed for CI, matching the
prod service's `MEMORY_AGENT_CARD_URL=` (blank/off) choice above.

To wire this into an actual **Cloud Build trigger** on push to `main`, connect
this repo in Cloud Build (`gcloud builds triggers create github ...` or via
console) pointing at `cloudbuild.yaml`. Not yet done for this POC — the file
is ready, the trigger creation is a repo/GitHub-connection step to do once the
new repo (mentioned when this doc was last updated) exists. Push a trivial
change once wired and watch eval → deploy run in the Cloud Build history. 📸
That screenshot is the Week 4 "quality gate" slide.

## 5. The one real post, then flip back

Once prod is verified on dry-run: flip `DRY_RUN=false` in Secret Manager (or
`--update-env-vars` on the service), make **one** real post from prod to
prove the happy path, then flip it back to `true`. Same discipline as the
local one-real-post rule.

## 6. Tear-down note

Cloud Run scales to zero (`min-instances=0` above), so idle cost is ~nil —
but the memory agent (Agent Engine, if deployed) does NOT. Re-read
[agent-engine-rag-setup.md](agent-engine-rag-setup.md) §6 for that tear-down.
📊 **Record ACTUAL total POC spend** (billing report, whole project, whole
build) — that's the number for Week 4 slide 2.
