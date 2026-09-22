"use client";

import { useCoAgent } from "@copilotkit/react-core";

type AgentState = {
  pipeline_stage?: string;
};

// Image generation happens inside draft_agent (folded into Drafting);
// memory consultation happens ahead of research.
const STAGES: { key: string; icon: string; label: string }[] = [
  { key: "idea", icon: "💡", label: "Idea" },
  { key: "consulting_memory", icon: "🧠", label: "Consulting memory" },
  { key: "researching", icon: "🔍", label: "Researching" },
  { key: "drafting", icon: "✍️", label: "Drafting" },
  { key: "awaiting_approval", icon: "⏳", label: "Approval" },
  { key: "posted", icon: "🚀", label: "Posted" },
];

/** Horizontal stepper mirroring the backend's pipeline_stage shared state. */
export function StagePanel() {
  const { state } = useCoAgent<AgentState>({ name: "social_poster" });
  const current = state?.pipeline_stage ?? "idea";
  const currentIdx = STAGES.findIndex((s) => s.key === current);

  return (
    <section className="card">
      <h2>Pipeline</h2>
      <ol className="stepper">
        {STAGES.map((stage, i) => {
          const status =
            i < currentIdx ? "done" : i === currentIdx ? "current" : "";
          return (
            <li key={stage.key} className={`step ${status}`}>
              <div className="dot">{i < currentIdx ? "✓" : stage.icon}</div>
              {stage.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
