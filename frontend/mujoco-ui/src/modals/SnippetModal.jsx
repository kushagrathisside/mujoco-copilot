
// ─────────────────────────────────────────────────────────────────────────────
// SNIPPET MODAL
// ─────────────────────────────────────────────────────────────────────────────
function SnippetModal({onClose,onInsert,customSnippets,setCustomSnippets}){
  const [newName,setNewName]=useState("");const [newXml,setNewXml]=useState("");
  const all=[...SNIPPETS,...customSnippets];
  const save=()=>{
    if(!newName.trim()||!newXml.trim())return;
    const updated=[...customSnippets,{name:newName,icon:"📌",xml:newXml,custom:true}];
    setCustomSnippets(updated);localStorage.setItem("mujoco_snippets",JSON.stringify(updated));
    setNewName("");setNewXml("");
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,width:560,maxHeight:"88vh",overflow:"auto",padding:22,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>📦 Snippet Library</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {all.map((s,i)=>(
            <div key={i} style={{background:"#1e293b",borderRadius:8,padding:12,border:"1px solid #334155",cursor:"pointer",transition:"all 0.15s"}}
              onClick={()=>{onInsert(s.xml);onClose();}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#7dd3fc"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
              <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
              <div style={{fontSize:12,color:"#e2e8f0",fontWeight:600,marginBottom:3}}>{s.name}</div>
              <div style={{fontSize:10,color:"#475569",overflow:"hidden",maxHeight:36,textOverflow:"ellipsis"}}>{s.xml.slice(0,70)}…</div>
              {s.custom&&<div style={{marginTop:3,fontSize:9,color:"#a78bfa"}}>● custom</div>}
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid #1e293b",paddingTop:12}}>
          <div style={{fontSize:11,color:"#475569",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.06em"}}>Save Custom Snippet</div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name"
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",marginBottom:7}}/>
          <textarea value={newXml} onChange={e=>setNewXml(e.target.value)} placeholder="XML…" rows={3}
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:11,fontFamily:"inherit",outline:"none",resize:"vertical",marginBottom:7}}/>
          <button onClick={save} disabled={!newName.trim()||!newXml.trim()}
            style={{padding:"6px 16px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default SnippetModal;