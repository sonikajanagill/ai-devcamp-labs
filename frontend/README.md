# Frontend — Social Spark UI

Next.js (App Router) + [CopilotKit](https://copilotkit.ai), talking to the
ADK backend over [AG-UI](https://github.com/ag-ui-protocol/ag-ui). Idea in,
draft + generated image out, approve, publish.

## Prerequisites

- Node.js 20+
- The backend running first — see [../backend/README.md](../backend/README.md).
  This UI has nothing to talk to without it.

## Setup

```bash
npm install
```

## Run

From the repo root, with the backend already running in another terminal:

```bash
./run-frontend.sh
```

(if you get `permission denied`, the script lost its executable bit — fix
once with `chmod +x run-backend.sh run-frontend.sh` from the repo root)

or from this directory:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Env vars (optional)

None of these are required for local dev against the default backend on
`:8000`. Override any of them in `frontend/.env.local` (git-ignored).

| Var | Default | Purpose |
|---|---|---|
| `ADK_BACKEND_URL` | `http://localhost:8000/api/adk` | where the CopilotKit runtime (`app/api/copilotkit/route.ts`) forwards agent requests — point this at a deployed backend instead of local, e.g. through the `gcloud run services proxy` setup in [docs/cloud-run-deploy.md](../docs/cloud-run-deploy.md) |
| `NEXT_PUBLIC_BACKEND_ORIGIN` | `http://localhost:8000` | where `app/components/PostGallery.tsx` fetches generated images from (the backend's `/outputs/...` route) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | unset | OAuth 2.0 Web client ID for Google sign-in (`app/components/auth.tsx`) — a plain Web client ID from any GCP project's Credentials page, no Firebase needed. Without it, users can still "Continue as guest" |

## Structure

- `app/api/copilotkit/route.ts` — bridges the browser to the ADK backend's AG-UI endpoint
- `app/components/` — chat UI, the generated-image gallery, and Google sign-in
- `app/page.tsx` / `app/layout.tsx` — the app shell

## Notes

This is a customized Next.js app, not a stock `create-next-app` starter — see
[AGENTS.md](AGENTS.md) before assuming training-data-era Next.js conventions
apply here.
