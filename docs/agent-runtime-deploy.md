# Setup guide: deploy to Agent Runtime (Scale pillar)

This deploys `social_poster` to **Agent Runtime** — Google's managed runtime for
agents, and the Scale pillar's main capability. The companion doc
[`cloud-run-deploy.md`](cloud-run-deploy.md) covers the older Cloud Run path,
which still works and is unaffected by anything here.

> **Everything below was run for real** against a test project on
> 2026-09-19, not transcribed from documentation. Gotchas are recorded in
> [`LEARNINGS.md`](LEARNINGS.md).

## 0. One-time setup

```bash
./gcp-setup.sh
```

Steps 2–5 of that script enable the APIs (including Cloud Resource Manager,
without which the deploy dies in a gRPC stack trace), grant you
`roles/aiplatform.user`, create a service account for the deployed frontend,
and put the Buffer key in Secret Manager. It is idempotent — re-run it whenever
a step is added.

## 1. Deploy the agent

```bash
agents-cli deploy -d agent_runtime \
  --project YOUR_PROJECT_ID --region us-central1 --agent-identity \
  --service-name social-spark-poster \
  --update-env-vars "POST_VIA=linkedin,DRY_RUN=true,RESEARCH_MODEL=gemini-2.5-flash,DRAFT_MODEL=gemini-2.5-flash,ORCHESTRATOR_MODEL=gemini-2.5-flash,GCS_BUCKET_NAME=YOUR_BUCKET" \
  --no-confirm-project --no-wait
```

Why each part:

- **`-d agent_runtime`** — required here because this project has no
  `agents-cli-manifest.yaml` (it was hand-built, not scaffolded). Without it the
  command errors with "No agents-cli-manifest.yaml found".
- **`--region us-central1`**, deliberately. The Govern pillar's Semantic
  Governance Policy Engine does not exist in `global` or `europe-west2`, and a
  policy can only bind to an agent in the region it was registered in. Deploy
  elsewhere and Session 3 cannot attach a policy to this agent at all.
- **`--agent-identity`** — mints the engine's identity principal. This is also
  what auto-registers the engine in Agent Registry carrying the
  `RuntimeIdentity` attribute that Governance Policies bind to.
- **`--no-wait`** — deploys take 5–10 minutes and can outlive a command
  timeout. The deployment continues server-side regardless.
- **Model pins** — a leftover caution from the older cloudpickle deploy path.
  `agents-cli` sets `GOOGLE_CLOUD_LOCATION: global` itself, so `-latest` models
  would resolve; pinning is belt-and-braces, not a requirement.

There is **no Dockerfile work to do**: Agent Runtime builds the image from this
repo's existing root `Dockerfile`, and file selection honours `.gitignore`, so
`backend/social_poster/.env` is excluded automatically.

### Checking on it

```bash
agents-cli deploy --status -d agent_runtime \
  --project YOUR_PROJECT_ID --region us-central1 --no-confirm-project
```

> **Gotcha**: `--status` needs `-d agent_runtime` too. Without it you get "No
> agents-cli-manifest.yaml found", which reads as though the *deploy* failed —
> it hasn't, only the status lookup has.

## 2. Talk to it

Agent Runtime exposes the container's own HTTP routes under an `/api` prefix:

```
https://{region}-aiplatform.googleapis.com/reasoningEngines/v1/{resource}/api/{container_path}
```

Since our container serves `backend/main.py`, which mounts AG-UI at `/api/adk`,
the deployed engine speaks AG-UI at `.../api/api/adk` — the first `/api` is the
passthrough, the second is our route. **No protocol bridge is needed.**

```bash
TOK=$(gcloud auth print-access-token)
BASE="https://us-central1-aiplatform.googleapis.com/reasoningEngines/v1/projects/PROJECT_NUMBER/locations/us-central1/reasoningEngines/ENGINE_ID/api"

curl -s -H "Authorization: Bearer $TOK" "$BASE/openapi.json" | head -c 200
```

That should return `"title": "social-agent AG-UI backend"` — proof it is our
app and not ADK's generic surface.

## 3. Point the frontend at it

```bash
# frontend/.env.local
ADK_BACKEND_ORIGIN=https://us-central1-aiplatform.googleapis.com/reasoningEngines/v1/projects/PROJECT_NUMBER/locations/us-central1/reasoningEngines/ENGINE_ID/api
```

Comment that line out to go back to a local backend on `http://localhost:8000`.
That single variable is the only difference between the two.

The browser never calls the backend directly — it cannot hold the bearer token
the passthrough requires. Three same-origin route handlers proxy everything
server-side and add the token: `app/api/adk` (AG-UI), `app/api/posts`, and
`app/outputs/[...path]`.

## 4. Deploy the frontend too

```bash
gcloud run deploy social-spark-frontend --source frontend \
  --region=us-central1 --project=YOUR_PROJECT_ID \
  --service-account=social-spark-frontend@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --set-env-vars="ADK_BACKEND_ORIGIN=<passthrough origin>" \
  --port=8080 --memory=1Gi --min-instances=0 --max-instances=3
```

The service is **private**. Reach it without any OAuth setup:

```bash
gcloud run services proxy social-spark-frontend \
  --region us-central1 --project YOUR_PROJECT_ID --port 8090
```

then open <http://localhost:8090>. The proxy authenticates as you. The app's own
Google sign-in is optional — it falls back to "Continue as guest" — so nothing
needs an OAuth client ID. IAP is the upgrade path for sharing it for real.

## 5. Durability

Two things do **not** survive a scale-to-zero unless configured:

- **Conversations.** `ag_ui_adk` defaults to `InMemorySessionService`.
  `backend/main.py` now switches to `VertexAiSessionService` when it detects it
  is running on Agent Runtime (it reads the engine's own resource name out of
  the injected `APP_URL`), so sessions become managed Agent Engine sessions.
  Verify with:
  ```bash
  curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    ".../reasoningEngines/ENGINE_ID/sessions" | python3 -m json.tool
  ```
- **Published posts.** `db.py` uses SQLite locally and switches to one JSON
  object per post in GCS when `GCS_BUCKET_NAME` is set, because a container
  filesystem is ephemeral. The Agent Identity principal needs write access:
  ```bash
  gcloud storage buckets add-iam-policy-binding gs://YOUR_BUCKET \
    --member="principalSet://agents.global.proj-PROJECT_NUMBER.system.id.goog/attribute.platformContainer/aiplatform/projects/PROJECT_NUMBER" \
    --role="roles/storage.objectAdmin"
  ```

## 6. Posting via Buffer (multi-platform)

`POST_VIA` **overrides the model's own routing**. With `POST_VIA=linkedin` the
Buffer toolset is never constructed, so asking for an X post still goes to
LinkedIn. Use Buffer to reach X and other channels:

```bash
agents-cli deploy -d agent_runtime ... \
  --secrets "BUFFER_API_KEY=buffer-api-key:latest" \
  --update-env-vars "POST_VIA=buffer,BUFFER_REVIEW_DELAY_MINUTES=60,..."
```

> **`BUFFER_REVIEW_DELAY_MINUTES` is not optional.** Buffer has no dry-run
> concept at all — `DRY_RUN` only covers the local LinkedIn MCP server — and an
> early test in this project published a real post by assuming otherwise. The
> delay forces any real post to `customScheduled` at least N minutes out,
> leaving a window to cancel it in Buffer.

**How the secret actually gets in** (this took six failed deploys — see
LEARNINGS): *not* via `--secrets`/`secretEnv`, which a container-based
deployment rejects with an opaque "The Reasoning Engine failed to be updated".
Instead the deployment carries only the secret's **name**, and the agent reads
the value at runtime with its own Agent Identity — the pattern Google's docs
prescribe. Grant the identity access once:

```bash
gcloud secrets add-iam-policy-binding buffer-api-key \
  --member="principalSet://agents.global.proj-PROJECT_NUMBER.system.id.goog/attribute.platformContainer/aiplatform/projects/PROJECT_NUMBER" \
  --role="roles/secretmanager.secretAccessor"
```

then deploy with the name only, no `--secrets`:

```bash
agents-cli deploy -d agent_runtime ... \
  --update-env-vars "POST_VIA=buffer,BUFFER_API_KEY_SECRET=buffer-api-key,BUFFER_REVIEW_DELAY_MINUTES=60,..."
```

`agent.py`'s `_resolve_buffer_key()` uses ADK's
`SecretManagerClient` (requires `google-cloud-secret-manager`). A hand-rolled
REST call with a bearer token returns **401 inside the container** even with the
grant in place — use the client.

**Verify it worked** by asking the deployed agent which platforms it can post
to. Buffer active lists many (Instagram, Facebook, Twitter, LinkedIn, …); if it
says only LinkedIn, the key did not resolve and it fell back — the container
logs will say so explicitly rather than crashing.

## 7. What's deployed right now?

An engine scales to zero when idle, so an empty-looking console does not mean
nothing is deployed — and the console's Agent Engine view is region-scoped,
which is the other common reason a deployment appears to have vanished. Ask
the CLI:

```bash
agents-cli deploy --list -d agent_runtime --project YOUR_PROJECT_ID --region us-central1 --no-confirm-project
```

```bash
gcloud run services list --project YOUR_PROJECT_ID --region us-central1
```

## 8. Teardown

Agent Runtime is the weekly teardown item. It scales to zero, so an idle engine
costs approximately nothing, but delete it when finished with:

```bash
agents-cli deploy --list -d agent_runtime --project YOUR_PROJECT_ID --region us-central1
gcloud run services delete social-spark-frontend --region us-central1 --project YOUR_PROJECT_ID
```
