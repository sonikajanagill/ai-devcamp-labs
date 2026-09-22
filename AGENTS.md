# AGENTS.md

Project conventions for any coding agent (Antigravity, Claude Code, Gemini
CLI, Codex) working in this repo. Read this before making changes.

## What this project is

Social Spark: an ADK agent that turns an idea into a researched, on-brand,
illustrated social media post, approved by a human, then published via
LinkedIn or Buffer. Built across four labs matching Google's Gemini
Enterprise Agent Platform pillars — Build, Scale, Govern, Optimize (see
`docs/index.html` for all four).

## What's given vs. what you build

| Given — don't rewrite | You build |
|---|---|
| `frontend/` — Next.js + CopilotKit UI | `backend/social_poster/agent.py` — the actual agent |
| `mcp/linkedin_server.py` — LinkedIn's local MCP server | |
| `skills/post-formatter/`, `platform-style/`, `poster-style/` | `skills/brand-voice/SKILL.md` — you personalize this one |
| `backend/social_poster/tools.py`, `db.py` | |
| Pinned `pyproject.toml` / `uv.lock` | |

Each lab (`docs/lab-N-*.html`) gives you a concept, a prompt to hand your
coding agent, and a checkpoint to verify — not a diff to copy. Trust a lab's
own code blocks only where it says the ADK API itself is non-obvious.

## Running it

```bash
uv sync
uv run adk web backend    # chat + trace inspector, no frontend needed
./run-backend.sh          # AG-UI backend on :8000
./run-frontend.sh         # CopilotKit frontend on :3000, second terminal
```

## ADK conventions this project follows

- Multi-agent: an orchestrator (`root_agent`) routes to specialist sub-agents
  via `AgentTool`, and never drafts or researches itself.
- `google_search` (a built-in tool) stays isolated in its own agent — Agent Platform
  AI rejects mixing it with function tools in one model call.
- Any tool with a real side effect (posting) is gated with
  `require_confirmation=True` — don't rely on instruction text alone for
  approval.
- Keep an MCP toolset's `tool_filter` scoped to exactly what's used, not
  "everything except X". A large, schema-varied toolset (a remote MCP
  server's full tool list, say) can break structured function-calling on
  some models when combined with `AgentTool` — see `docs/LEARNINGS.md` for
  the specific incident this project hit.
- Session state (`output_key`) carries data between agents; instruction
  text is not the place for that.

## Tooling

- **`agents-cli`** (`uvx google-agents-cli setup`) is Google's own
  scaffolding/deploy/eval CLI for ADK projects. `setup` installs the CLI and
  also detects your installed coding agents (Antigravity, Claude Code,
  Cursor, Windsurf…) and installs ADK development skills into each — do this
  before building, so your agent's ADK answers match the current API rather
  than stale training data. `--dry-run` previews; `--workspace` installs into
  this project instead of globally. The CLI already auto-detects this exact
  file as its Claude Code guidance-file convention (`CLAUDE.md` for Claude
  Code, `GEMINI.md` for Gemini CLI, this file otherwise). Useful:
  `agents-cli scaffold`, `agents-cli eval run`, `agents-cli deploy`.
  Note the naming collision: those are skills for the coding agent. The
  markdown in this repo's `skills/` folder is a different thing — ADK **Agent
  Skills**, loaded at runtime by `draft_agent`'s `SkillToolset`.
- If your coding agent has a documentation-lookup capability (an MCP server
  that fetches live docs), use it — ADK and the Agent Platform move fast
  enough that training data goes stale. Two root sources either way:
  `https://google.github.io/adk-docs/` and
  `https://docs.cloud.google.com/gemini-enterprise-agent-platform/`.

## Real gotchas already hit — don't rediscover these

See `docs/LEARNINGS.md` for the full list. Worth reading before any
Scale-pillar (Agent Runtime deployment) work specifically: pinned models
only resolve regionally, exact package pins matter more than you'd expect,
and Secret Manager grants go to a specific platform service agent, not the
one you'd guess first.
