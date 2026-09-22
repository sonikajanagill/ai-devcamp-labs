"use client";

// Renders ADK's framework-level approval gate (McpToolset(require_confirmation=True))
// in the chat. ADK synthesizes a call named "adk_request_confirmation" — see
// google/adk/flows/llm_flows/functions.py::generate_request_confirmation_event —
// carrying { originalFunctionCall, toolConfirmation }. Nothing renders it unless
// the frontend registers a matching action; the plain-text "yes, post it." reply
// alone never resolves the pending call.

import { useCopilotAction } from "@copilotkit/react-core";

export function ConfirmAction() {
  useCopilotAction(
    {
      name: "adk_request_confirmation",
      description: "Approve or reject a pending tool call before it runs.",
      parameters: [
        { name: "originalFunctionCall", type: "object", attributes: [] },
        { name: "toolConfirmation", type: "object", attributes: [] },
      ],
      renderAndWaitForResponse: ({ args, status, respond }) => {
        const call = (args as any)?.originalFunctionCall ?? {};
        const hint = (args as any)?.toolConfirmation?.hint as string | undefined;
        const toolName = call?.name ?? "this action";
        const callArgs = call?.args ?? {};
        const hasArgs = Object.keys(callArgs).length > 0;

        if (status === "complete") {
          return <p className="confirm-done">Responded.</p>;
        }

        return (
          <div className="confirm-card">
            <p>{hint || `Approve ${toolName}?`}</p>
            {hasArgs && (
              <details>
                <summary>details</summary>
                <pre>{JSON.stringify(callArgs, null, 2)}</pre>
              </details>
            )}
            <div className="confirm-buttons">
              <button
                className="confirm-approve"
                disabled={status !== "executing"}
                onClick={() => respond?.({ confirmed: true })}
              >
                Approve
              </button>
              <button
                className="confirm-reject"
                disabled={status !== "executing"}
                onClick={() => respond?.({ confirmed: false })}
              >
                Reject
              </button>
            </div>
          </div>
        );
      },
    },
    [],
  );

  return null;
}
