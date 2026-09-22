# Setup guide: the real memory agent (Agent Garden RAG → Agent Engine)

Week 2's `memory_agent` is any A2A-speaking agent that knows your past posts.
For local dev you can run the mock (`uv run python backend/mock_memory_agent.py`)
— this guide is for deploying the real thing. All console steps; ⏱ **time the
deploy and note any IAM friction** — both numbers go in the codelab.

## 1. Deploy the RAG sample from Agent Garden

1. Console → **Agent Platform → Agents → Agent Garden** (`console.cloud.google.com/vertex-ai/agents/agent-garden`).
2. Find the **RAG sample** (retrieval-augmented generation over a datastore).
3. **Deploy to Agent Engine**, project `YOUR_PROJECT_ID`, region `europe-west2`
   (same region as everything else; Agent Engine availability was implicitly
   verified when the project was set up — if the region picker refuses, note it
   in LEARNINGS.md and pick the nearest region, it doesn't need to colocate
   with Model Armor).
4. Accept the default service account unless you have a reason not to — but
   **write down every IAM prompt you see**; that friction list is codelab
   material.

## 2. Load your real past posts

1. The deploy creates (or asks you to create) a **Discovery Engine datastore**
   (the API was enabled during initial setup).
2. Upload **3–5 of your real past posts** as plain-text or PDF documents —
   copy-paste each post into its own `.txt` file first.
3. Wait for indexing (minutes, not seconds — grab a coffee, note the time).

## 3. Test in the playground

Ask it, in the playground UI:
- "What topics has the author posted about?"
- "How does the author usually open a post?"

If the answers clearly come from your uploaded posts, RAG is working.

## 4. Wire it into the orchestrator

> ⚠️ **Unverified.** This guide has not been run end to end, and no RAG agent is
> deployed in `YOUR_PROJECT_ID`. Where the card URL appears in the Console is
> not confirmed: the line below is the intended location, not a tested one.
> Record what you actually see, and correct this step.

1. Find the deployed agent's **A2A agent card URL** on the Agent Engine
   resource page (the `/.well-known/agent.json` endpoint of its serving URL).
2. Put it in `backend/social_poster/.env`:

   ```
   MEMORY_AGENT_CARD_URL=https://<your-agent-engine-endpoint>/.well-known/agent.json
   ```

3. Restart the backend. The orchestrator picks it up automatically (same
   conditional pattern as Buffer — blank env var means no memory consultation).

## 5. Verify the A2A hop

Run a drafting request in `adk web` and open the **Trace** tab: you should see
the `memory_agent` tool call as a remote hop before `draft_agent`. That trace
screenshot is Week 2 slide material.

## 6. Tear down (or park) — do not skip

Agent Engine bills while deployed. When done for the day either **delete the
deployment** or set **min instances 0**, and 📊 **record what the day cost**
(billing report, filtered to Agent Runtime) — note the number
down so you can compare before and after.
