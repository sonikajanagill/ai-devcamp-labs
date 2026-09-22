# Cloud Run image for the social_poster agent (backend only — the Next.js
# frontend stays local, pointed at this service via ADK_BACKEND_URL).
# Run from the repo root:  docker build -t social-poster .
FROM python:3.12-slim

RUN pip install --no-cache-dir uv==0.8.13

WORKDIR /code

COPY pyproject.toml uv.lock ./
COPY backend ./backend
# agent.py loads these from disk (skills) and spawns this MCP server over
# stdio (mcp/) at import time — both resolved relative to the repo root, so
# both must be present in the image or the app fails to import.
COPY skills ./skills
COPY mcp ./mcp

# --no-dev: skip the eval/dev-only deps eval-gating already exercised in CI.
RUN uv sync --frozen --no-dev

# Cloud Run injects PORT; default matches local `run-backend.sh` for parity.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uv run uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
