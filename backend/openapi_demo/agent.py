"""Standalone example: ADK's third way to call an API — OpenAPIToolset.

Not part of social_poster. This is a self-contained demo agent showing that
ADK can turn an OpenAPI spec directly into tools, with no hand-written
function (contrast: tools.py's generate_image) and no MCP server to run
(contrast: mcp/linkedin_server.py). Discoverable as its own app in `adk web`.

Backed by postman-echo.com (a public request-echo service, zero auth, zero
setup) rather than a real pet store — every call is a genuine HTTP round
trip, it just echoes back whatever was sent instead of managing real data.
(httpbin.org, ADK's own docs example, was down/503 when this was built —
postman-echo.com is the more reliable choice; see LEARNINGS.md.)
"""

import pathlib

from google.adk.agents import Agent
from google.adk.tools.openapi_tool.openapi_spec_parser.openapi_toolset import (
    OpenAPIToolset,
)

SPEC_PATH = pathlib.Path(__file__).parent / "pet_store_spec.json"

pet_store_toolset = OpenAPIToolset(
    spec_str=SPEC_PATH.read_text(),
    spec_str_type="json",
)

root_agent = Agent(
    name="openapi_demo",
    model="gemini-flash-latest",
    description="Demo agent showing ADK's OpenAPIToolset: tools generated directly from an OpenAPI spec.",
    instruction="""You manage a (mock) pet store. Use list_pets and create_pet
as needed. Every response is echoed back by the test server, not real pet
data — that's expected, this agent exists to show how OpenAPIToolset turns a
spec into callable tools, not to actually manage pets.""",
    tools=[pet_store_toolset],
)
