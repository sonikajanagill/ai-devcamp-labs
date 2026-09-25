# LEARNINGS

Every gotcha hit while building this. Each entry should become a lab step, a deliberate-error
callout, or a slide caveat.

Entries are grouped by pillar.

---

<!-- BEGIN: General -->
## General

*Applies to every pillar. Ships with every tag.*

<!-- Add new General entries here, newest first. -->

### `agents-cli` coverage is genuinely uneven across the four pillars, and that unevenness is worth teaching rather than hiding

Checked per pillar rather than assumed: **Build** — `agents-cli setup` is
valuable (installs the CLI plus ADK skills into whichever coding agent the
attendee has), but `scaffold create`/`enhance` does *not* fit this repo, as
already established in `docs/cloud-run-deploy.md` back in August (it clobbers
the hand-pinned `pyproject.toml` and expects `app/`, not
`backend/social_poster/`). **Scale** — `agents-cli deploy` is the documented
path, full stop. **Govern** — no commands exist for Agent Gateway or Semantic
Governance; it's REST/gcloud/Terraform/Console. **Optimise** — `agents-cli
eval` fits. **Codelab material**: standardise on `agents-cli` where it exists
so attendees learn one tool rather than four idioms, and say out loud in Lab 3
why Govern drops to raw APIs. "Here is where the tooling is mature and here is
where it isn't yet" is more useful to someone taking this back to their own
org than a uniform-looking set of commands would be.

### An early test accidentally published a real post via Buffer

A test script assumed `DRY_RUN=true` covered all posting
paths; it doesn't — Buffer's remote MCP server has no dry-run concept at
all (only the local LinkedIn MCP server respects `DRY_RUN`), and the
script's `POST_VIA` override was a no-op because the loaded `.env` already
set it. **Fix, now shipped**: `BUFFER_REVIEW_DELAY_MINUTES` (default 60,
`agent.py`) forces every real Buffer post to `customScheduled` at least N
minutes out, regardless of what mode the model picks — a real safety net,
not just a documented caution. **Codelab material**: this is worth a
callout in whichever lab first wires up Buffer — dry-run assumptions don't
automatically extend to every posting path, check each one specifically.

<!-- END: General -->

<!-- BEGIN: Build -->
## Build

*Agent design, tools, skills, MCP, images, hosting for previews.*

<!-- Add new Build entries here, newest first. -->

### The GCS "public bucket" setup in `.env.example` doesn't work when Public Access Prevention is on, and this project's own bucket is a live example

`upload_image` (tools.py) returns a plain
`storage.googleapis.com` object URL on the assumption the bucket has
`allUsers:objectViewer` — `.env.example`'s own setup steps tell you to grant
it. Tried it live on the reference project's bucket:
`gcloud storage buckets add-iam-policy-binding ... --member=allUsers
--role=roles/storage.objectViewer` → `HTTPError 412: The member bindings
allUsers and allAuthenticatedUsers are not allowed since public access
prevention is enforced.` Checked the bucket's actual IAM policy directly
(`gcloud storage buckets get-iam-policy`) — no `allUsers` binding exists at
all, confirming every hosted URL this app has ever produced 403s to a plain
browser fetch; nobody had actually opened one until embedding it as a chat
image made that visible. **Public Access Prevention is a common default on
managed/shared GCP projects** (the reference project had it; a personal project without an organisation usually doesn't) — don't assume
`.env.example`'s bucket instructions will work as written; check first with
`gcloud storage buckets describe gs://YOUR_BUCKET
--format="value(iamConfiguration.publicAccessPrevention)"`. **Fix (shipped,
`agent.py`)**: don't depend on the hosted URL for the in-chat image
*preview* at all — a new `current_image_display_url` state key
(`BACKEND_PUBLIC_ORIGIN` + `/outputs/<filename>`, the same static route
`backend/main.py` already serves for `PostGallery.tsx`) is computed
server-side in `_track_image_state` and the orchestrator's instruction
embeds that exact pre-resolved URL verbatim as Markdown
(`![post image]({{current_image_display_url?}})`) — deterministic, no
reliance on the model correctly picking/copying a URL out of draft_agent's
free-text result. The GCS hosted URL is untouched and still what
`upload_image`/Buffer's `create_post` use for actual posting — this fix is
preview-only. **Codelab material**: worth a callout in whichever lab
introduces GCS image hosting — "this bucket step may 412 on managed
projects, and the in-chat preview doesn't need it to work" saves attendees
from concluding the whole feature is broken.
**Follow-up (shipped, `tools.py`)**: fixed the actual posting path too, not
just the preview — `upload_image` now returns a V4 *signed* URL instead of
a plain public one, signed via service-account impersonation
(`google.auth.impersonated_credentials`, a new `GCS_SIGNING_SERVICE_ACCOUNT`
env var) rather than a downloaded key file, which this project's
credentials policy doesn't allow. Confirmed the impersonation path is
required, not optional, for local dev specifically: this project's ADC is
an `authorized_user` (a human Google account via `gcloud auth
application-default login`), and only service-account credentials carry a
signable identity — a human identity can't self-sign at all, it has to
borrow a service account's identity for exactly that. Needs a one-time,
human-run IAM setup (create the uploader SA, grant it
`storage.objectAdmin` on the bucket, grant the calling identity
`iam.serviceAccountTokenCreator` on that SA) — first shipped as raw gcloud
commands in `.env.example`'s comments, then promoted to an actual
idempotent script (`gcp-setup.sh`, repo root) once it became
clear a comment block isn't discoverable enough for attendees to actually
find and run correctly by hand. **This is NOT part of Lab 1's taught
curriculum** — Lab 1
deliberately keeps Buffer posts text-only and only attaches images via
LinkedIn's own tool (Step 7), specifically to avoid this exact complexity;
this fix is for the reference app's more advanced capability, so it's
documented as an explicitly optional step in
`docs/setup-guide.html` (Step 6), not folded into the
mandatory pre-camp steps everyone has to do.

<!-- END: Build -->



