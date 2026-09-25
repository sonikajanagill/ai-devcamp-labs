"""Local mock of the Agent Engine RAG memory agent, served over A2A.

The real memory agent is the Agent Garden RAG sample deployed to
Agent Engine with your actual past posts in its datastore (see
docs/agent-engine-rag-setup.md). This mock serves the same A2A protocol
locally with a handful of hardcoded "past posts", so the A2A wiring, the
orchestrator's memory consultation, and the eval suite can all run without
a cloud deploy.

Run from the repo root (keep it running in its own terminal):

    uv run python backend/mock_memory_agent.py

Then point the orchestrator at it in backend/social_poster/.env:

    MEMORY_AGENT_CARD_URL=http://localhost:8001/.well-known/agent.json
"""

import pathlib

import uvicorn
from dotenv import load_dotenv
from google.adk.a2a.utils.agent_to_a2a import to_a2a
from google.adk.agents import Agent

load_dotenv(pathlib.Path(__file__).parent / "social_poster" / ".env")

# Stand-ins for the 3-5 real past posts the guide says to upload to the RAG
# datastore. Deliberately consistent in voice so "sounds like the user" is a
# testable property.
_PAST_POSTS = """
POST (LinkedIn, 3 months ago):
"Everyone demos agents. Almost nobody evals them. The gap between a slick
demo and a system you can trust is a regression suite for behaviour, and most
teams haven't started. What's in your eval set?"

POST (LinkedIn, 2 months ago):
"Spent the weekend wiring MCP servers into ADK. The protocol is the easy bit;
the interesting problems are all trust: which tools get exposed, who approves
a side effect, what happens when the model misreads intent."

POST (X, 6 weeks ago):
"hot take: prompt injection is a systems problem, not a prompting problem.
you don't fix it with a sterner system prompt, you fix it with layers that
don't trust the model."

POST (LinkedIn, 2 weeks ago):
"Organised a workshop run-through today. Lesson learnt: every gotcha you hit
while building IS the curriculum. Write them down as you go or lose them."
"""

memory_agent = Agent(
    name="memory_agent",
    model="gemini-flash-latest",
    description="Knows the user's past social media posts, topics, and writing voice.",
    instruction=f"""You are the user's posting memory. Their past posts:
{_PAST_POSTS}

When asked about past topics or voice, answer concisely from these posts:
themes they cover (agent evals, MCP/tooling trust, prompt injection, workshop
teaching), and voice traits (direct openers, questions to the reader, British
English, lowercase-casual on X, no hype words). If asked about something they
have never posted about, say so plainly.""",
)

app = to_a2a(memory_agent, port=8001)

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8001)
