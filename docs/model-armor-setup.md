# Guardrails setup: Model Armor and DLP

> The full walkthrough, with diagrams, is [Lab 3](lab-3-govern.html). This page is the
> short reference.

## What runs where

| Layer | What it does | Where it runs | Switch |
|---|---|---|---|
| Model Armor on the Gemini call | Screens the prompt and the reply | Agent Platform applies it around each Gemini call | `MODEL_ARMOR_TEMPLATE_ID` |
| Agent Gateway + Model Armor | Screens native traffic before the agent runs | The gateway, in front of the agent | Bind with `--agent-gateway-ingress` |
| DLP at the boundary | De-identifies each user message before the agent, model, session or Memory Bank see it | Middleware in `backend/main.py` | `PII_REDACTION=on` |
| DLP tool and pre-post pass | Cleans text the model shows you, and the post itself | Inside the agent | `PII_REDACTION=on` (pre-post) |

## Set it up

```bash
./gcp-setup.sh        # Steps 6-8: templates, grants, gateway
```

- **Templates:** `devcamp-guardrails` (input: injection + harm) and `devcamp-guardrails-output`
  (harm only), both in `us-central1`, both `INSPECT_AND_BLOCK`, both at **HIGH** confidence.
- **Permissions:** Agent Platform's own service agent needs `roles/modelarmor.user`. The Reasoning Engine
  service agent needs `roles/modelarmor.calloutUser` and `roles/modelarmor.user` for the gateway.
  Your agent's identity needs `roles/dlp.user`. All in Lab 3, Step 1.
- **Deploy settings:** `GOOGLE_CLOUD_LOCATION=us-central1` (Gemini must be in a region),
  `MODEL_ARMOR_TEMPLATE_ID`, `MODEL_ARMOR_REGION=us-central1`, `PROJECT_ID=<your project id>`,
  `PII_REDACTION=on`.

## Turn guardrails off on a deployed agent

```bash
agents-cli deploy -d agent_runtime \
  --project YOUR_PROJECT --region us-central1 --agent-identity \
  --service-name social-spark-poster \
  --update-env-vars "MODEL_ARMOR_TEMPLATE_ID=off" \
  --no-confirm-project
```

A deployed engine rejects an empty value, so `off` is the switch.

## Check that it really works

```bash
uv run python backend/probe_deployed.py     # says WHAT stopped each request
uv run python backend/probe_template.py     # is a template too jumpy or too lax?
./evals/run.sh evals/governance.json        # passes with guardrails on, FAILS with them off
```

`probe_deployed.py` tells "Model Armor blocked it" apart from "the model declined by itself".
Gemini refuses an obvious injection unaided, so "it was refused" proves nothing.

## Things that will trip you (each one was hit for real; see [LEARNINGS](LEARNINGS.md))

- **Gemini on `global` cannot use a Model Armor template.** Use a region. Pin the models.
- **Streamed Gemini calls are not screened at all**, silently. Guarded mode turns streaming off.
- **`INSPECT_ONLY` returns no verdict.** Nothing blocks and nothing errors.
- **A 401 from Model Armor inside your deployed agent** is google-auth's "prevent agent token
  sharing" default, not IAM. Do not switch it off; use the inline route.
- **Agent Platform's template lookup fails at random** ("template ... not found"). The model object retries.
- **DLP rejects the project number** Agent Runtime provides. Pass the ID as `PROJECT_ID`.
- **The gateway does not inspect our custom `/api/adk` route.** In-agent screening covers it.
