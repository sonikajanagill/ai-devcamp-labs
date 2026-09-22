"use client";

// adk-web-style "Events" panel: every tool call the agent makes, with its
// arguments and result, straight from the CopilotKit message stream.

import { useState } from "react";
import { useCopilotChatInternal } from "@copilotkit/react-core";

const TOOL_ICONS: Record<string, string> = {
  memory_agent: "🧠",
  research_agent: "🔍",
  draft_agent: "✍️",
  load_skill: "📚",
  generate_image: "🖼️",
  get_profile: "👤",
  create_post: "🚀",
  linkedin_get_profile: "👤",
  linkedin_create_post: "🚀",
};

type Entry = {
  id: string;
  name: string;
  args: string;
  result?: string;
  error?: boolean;
};

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// AG-UI message shape (@ag-ui/core): AssistantMessage.toolCalls[].function
// = {name, arguments}, ToolMessage = {role: "tool", toolCallId, content}.
function collectEntries(messages: any[]): Entry[] {
  const entries: Entry[] = [];
  const byCallId = new Map<string, Entry>();

  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.toolCalls)) {
      for (const call of msg.toolCalls) {
        const entry: Entry = {
          id: call.id,
          name: call.function?.name ?? "unknown_tool",
          args: pretty(call.function?.arguments ?? ""),
        };
        entries.push(entry);
        byCallId.set(call.id, entry);
      }
    } else if (msg.role === "tool" && msg.toolCallId) {
      const entry = byCallId.get(msg.toolCallId);
      if (entry) {
        const content =
          typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        entry.result = pretty(content ?? "");
        entry.error = Boolean(msg.error) || /"error"|isError": ?true/i.test(content ?? "");
      }
    }
  }
  return entries;
}

export function ActivityFeed() {
  // useCopilotChat()'s public wrapper only forwards `visibleMessages`, which
  // is unpopulated in CopilotKit 1.62.3 (dead field, see LEARNINGS.md).
  // useCopilotChatInternal (also exported) is the real implementation and
  // returns the live `messages` array in AG-UI format, resolved against the
  // <CopilotKit agent="social_poster"> chat configuration context.
  const { messages } = useCopilotChatInternal();
  const [open, setOpen] = useState(true);
  const entries = collectEntries((messages as any[]) ?? []);

  return (
    <section className="card">
      <button
        className="activity-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        Agent activity
        {entries.length > 0 && <span className="badge">{entries.length}</span>}
        <span className={`chevron ${open ? "open" : ""}`}>▾</span>
      </button>

      {open &&
        (entries.length === 0 ? (
          <p className="activity-empty">
            No tool calls yet — ask for a post in the chat and watch the
            agent&apos;s research, skill and image calls appear here live.
          </p>
        ) : (
          <ol className="activity-list">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={`activity-item ${
                  entry.error ? "error" : entry.result ? "ok" : ""
                }`}
              >
                <span className="status">
                  {entry.error ? "error" : entry.result ? "done" : "running…"}
                </span>
                {TOOL_ICONS[entry.name] ?? "🛠️"}{" "}
                <span className="tool-name">{entry.name}</span>
                {entry.args && entry.args !== "{}" && (
                  <details>
                    <summary>arguments</summary>
                    <pre>{entry.args}</pre>
                  </details>
                )}
                {entry.result && (
                  <details>
                    <summary>result</summary>
                    <pre>{entry.result.slice(0, 2000)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
