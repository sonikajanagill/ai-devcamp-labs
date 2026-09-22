# Setup guide: observability (Optimize)

Once the agent is deployed (Cloud Run or Agent Runtime), use Google Cloud's
tracing and analytics to see what's actually happening in production.

## 0. Agent Runtime instrumentation (confirmed via a real deploy, Scale spike)

Agent Runtime deployments expose two console toggles under the engine's
**Traces** page (`agent-platform/runtimes/.../traces`), separate from
anything you set in `env_vars` at deploy time:

- **Enable instrumentation of OpenTelemetry traces, logs and metrics** —
  populates the agent observability dashboard and traces pages at all.
  Telemetry cost varies by volume ingested. The legacy `enable_tracing` flag
  must not be set to `false`, or it overrides this.
- **Enable the logging of prompt inputs and response outputs** — off by
  default (only a minimal skeleton of each prompt/response is captured, no
  actual content or tool-call parameters). Turning it on collects the full
  content of user prompts, responses, and the user ID, which **may include
  sensitive data or PII** — the console's own warning is explicit: ensure
  you have end-user consent, notices, and data-handling policies in place
  before enabling this on anything but a throwaway test engine. Same
  DLP-retention thinking as the Govern pillar's guardrails applies here.

Both map to environment variables you'll see listed alongside the toggles
(read-only there, but this is what they correspond to if you're setting them
via the deploy config's own `env_vars` instead):

| Env var | Value | What it does |
|---|---|---|
| `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY` | `true` | The OTel traces/logs/metrics toggle |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | `NO_CONTENT` (default) or full content | The prompt/response content toggle |
| `OTEL_SEMCONV_STABILITY_OPT_IN` | `gen_ai_latest_experimental` | Opts into the current (experimental) GenAI semantic-convention schema for span attributes |

## 1. Cloud Trace — find the slowest span

ADK emits OpenTelemetry traces automatically. In the console: **Trace →
Trace explorer**, filtered to the `social_poster` service.

Each request fans out into spans: orchestrator → `memory_agent` (remote A2A
hop) → `research_agent` → `draft_agent` → `create_post`. **Identify the slowest
span** — on this pipeline it's almost always either the A2A memory hop (network
+ a full RAG retrieval) or `research_agent` (google_search grounding). That
tells you where the Week 4 model-downgrade or a caching change would pay off.
📸 Trace waterfall screenshot = Week 4 latency slide.

> Tip: the Model Armor guardrail calls show up as their own spans too. If
> guardrails add noticeable latency, that's the trade-off to name explicitly on
> the governance slide — safety isn't free.

## 2. Prompt/response logging

For debugging what the model actually saw/said in prod, enable ADK's
prompt-response logging (see the ADK observability docs). Keep in mind these
logs may contain user content — apply the same DLP thinking to log retention
that Week 3 applies to posts.

## 3. BigQuery Agent Analytics

ADK's `BigQueryAgentAnalyticsPlugin` streams structured events (tool calls,
tokens, latencies) to a BigQuery dataset. Register it on the `App`:

```python
from google.adk.apps.app import App
from google.adk.plugins.bigquery_agent_analytics_plugin import (
    BigQueryAgentAnalyticsPlugin,
)

app = App(
    name="social_poster",
    root_agent=root_agent,
    plugins=[BigQueryAgentAnalyticsPlugin(
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        dataset="agent_analytics",
    )],
)
```

Then deploy the **BigQuery observability agent from Agent Garden** and ask it
questions about your telemetry in natural language, e.g.:

- "What's the p95 latency of create_post over the last day?"
- "How many turns hit the Model Armor refusal path?"

Two answered questions from that agent = the Week 4 observability demo.

## 4. What to actually look at first

For this app, the three numbers worth watching in prod:

1. **Guardrail refusal rate** — how often `guard_input` blocks a turn. A spike
   means either an attack or a false-positive regression (remember the fuzzy PI
   filter from Week 3).
2. **Approval → post conversion** — how many drafts actually get approved. Low
   conversion means drafting quality, not infra.
3. **Cost per completed post** — ties the Week 4 model mix back to money; this
   is the number that justifies flash-lite on research/orchestrator.
