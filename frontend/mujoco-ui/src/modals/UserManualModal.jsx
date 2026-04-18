function UserManualModal({ onClose }) {
  const sectionTitle = {
    fontSize: 11,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  };

  const cardStyle = {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  };

  const bodyStyle = {
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 1.7,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, width: 760, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", padding: 24, fontFamily: "'JetBrains Mono',monospace" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>📘 User Manual</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Quick orientation for first-time mujoco-copilot users.</div>
          </div>
          <button title="Close User Manual: return to the editor." onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>Two Working Modes</div>
          <div style={bodyStyle}>
            <div><span style={{ color: "#86efac", fontWeight: 700 }}>Edit mode</span> changes the XML. Use it for requests like “Add a second robot 2m right” or “Make the torso a sphere”.</div>
            <div><span style={{ color: "#7dd3fc", fontWeight: 700 }}>Query mode</span> answers questions only. Use it for requests like “How many DOF does this robot have?” or “What is the total mass?”.</div>
            <div style={{ color: "#94a3b8", marginTop: 6 }}>Tip: the send button shows <strong style={{ color: "#e2e8f0" }}>↑</strong> in edit mode and <strong style={{ color: "#e2e8f0" }}>?</strong> in query mode.</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>Main Layout</div>
          <div style={bodyStyle}>
            <div><span style={{ color: "#f8fafc" }}>Left panel:</span> conversation with the AI, mode hint, and prompt box.</div>
            <div><span style={{ color: "#f8fafc" }}>Center panel:</span> XML editor, diff viewer, and 3D preview tabs.</div>
            <div><span style={{ color: "#f8fafc" }}>Right panel:</span> body tree, version history, quick prompts, and query examples.</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>Recommended Workflow</div>
          <div style={bodyStyle}>
            <div>1. Start in edit mode and describe the change you want.</div>
            <div>2. Review the updated XML or open the diff tab.</div>
            <div>3. Switch to 3D to inspect the result visually.</div>
            <div>4. Use history to undo or restore older versions if needed.</div>
            <div>5. Use query mode when you want analysis without changing the model.</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>Useful Buttons</div>
          <div style={bodyStyle}>
            <div><span style={{ color: "#eab308" }}>Macros</span> runs reusable edit prompts.</div>
            <div><span style={{ color: "#a78bfa" }}>Snippet Library</span> inserts saved XML fragments.</div>
            <div><span style={{ color: "#86efac" }}>Python Export</span> generates a simulation script.</div>
            <div><span style={{ color: "#7dd3fc" }}>Diff</span> shows exactly what changed.</div>
            <div><span style={{ color: "#ef4444" }}>Axes</span> overlays joint axes in the 3D viewer.</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>Good First Prompts</div>
          <div style={bodyStyle}>
            <div>`Add an arm with 3 joints`</div>
            <div>`Add a camera sensor`</div>
            <div>`Make all geoms red`</div>
            <div>`How many DOF does this robot have?`</div>
            <div>`Which joints have no actuator?`</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button title="Close User Manual: continue to the editor." onClick={onClose} style={{ padding: "10px 18px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserManualModal;
