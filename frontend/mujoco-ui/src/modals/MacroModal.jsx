
// ─────────────────────────────────────────────────────────────────────────────
// MACRO MODAL — Prompt Template Macros
// ─────────────────────────────────────────────────────────────────────────────
function MacroModal({onClose, onRun, customMacros, setCustomMacros}){
  const [newName,setNewName]=useState(""); const [newPrompt,setNewPrompt]=useState("");
  const all=[...BUILTIN_MACROS,...customMacros];
  const save=()=>{
    if(!newName.trim()||!newPrompt.trim())return;
    const updated=[...customMacros,{name:newName,icon:"📌",prompt:newPrompt,custom:true}];
    setCustomMacros(updated);localStorage.setItem("mujoco_macros",JSON.stringify(updated));
    setNewName("");setNewPrompt("");
  };
  const del=(idx)=>{
    const updated=customMacros.filter((_,i)=>i!==idx);
    setCustomMacros(updated);localStorage.setItem("mujoco_macros",JSON.stringify(updated));
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,width:580,maxHeight:"88vh",overflow:"auto",padding:22,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>⚡ Prompt Macros</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{fontSize:11,color:"#475569",marginBottom:12}}>Click any macro to run it instantly on your current XML.</div>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
          {all.map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#1e293b",borderRadius:8,padding:"10px 14px",border:"1px solid #334155",cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#7dd3fc"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
              <span style={{fontSize:16,flexShrink:0}}>{m.icon}</span>
              <div style={{flex:1}} onClick={()=>{onRun(m.prompt);onClose();}}>
                <div style={{fontSize:12,color:"#e2e8f0",fontWeight:600,marginBottom:2}}>{m.name}</div>
                <div style={{fontSize:10,color:"#64748b",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{m.prompt.slice(0,90)}…</div>
              </div>
              {m.custom&&(
                <button onClick={()=>del(i-BUILTIN_MACROS.length)}
                  style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:12,padding:"2px 6px"}}>✕</button>
              )}
              <button onClick={()=>{onRun(m.prompt);onClose();}}
                style={{padding:"5px 12px",background:"#1e3a5f",color:"#7dd3fc",border:"1px solid #2d5f8a",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit",flexShrink:0}}>
                Run ↑
              </button>
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid #1e293b",paddingTop:12}}>
          <div style={{fontSize:11,color:"#475569",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.06em"}}>Save Custom Macro</div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Macro name"
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",marginBottom:7}}/>
          <textarea value={newPrompt} onChange={e=>setNewPrompt(e.target.value)} placeholder="Prompt text…" rows={3}
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:11,fontFamily:"inherit",outline:"none",resize:"vertical",marginBottom:7}}/>
          <button onClick={save} disabled={!newName.trim()||!newPrompt.trim()}
            style={{padding:"6px 16px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Save Macro</button>
        </div>
      </div>
    </div>
  );
}

export default MacroModal;