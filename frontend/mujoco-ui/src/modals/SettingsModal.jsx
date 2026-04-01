
// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────────
function SettingsModal({onClose,providerCfg,setProviderCfg,ollamaModels,ollamaStatus}){
  const [local,setLocal]=useState(()=>JSON.parse(JSON.stringify(providerCfg)));
  const [showKey,setShowKey]=useState({});
  const save=()=>{
    Object.entries(local).forEach(([p,cfg])=>{
      if(cfg?.apiKey) localStorage.setItem(`mujoco_key_${p}`,cfg.apiKey);
      else localStorage.removeItem(`mujoco_key_${p}`);
    });
    localStorage.setItem("mujoco_provider",local.active);
    localStorage.setItem("mujoco_model",local[local.active]?.model||"");
    setProviderCfg(local);onClose();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,width:520,maxHeight:"88vh",overflow:"auto",padding:24,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>⚙ Provider Settings</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Active Provider</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {Object.keys(PROVIDERS).map(p=>{
              const{label,icon,color}=PROVIDERS[p];const active=local.active===p;
              return(<button key={p} onClick={()=>setLocal(l=>({...l,active:p}))}
                style={{padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",
                  border:`1px solid ${active?color:"#334155"}`,background:active?`${color}22`:"#1e293b",color:active?color:"#94a3b8"}}>{icon} {label}</button>);
            })}
          </div>
        </div>
        <div style={{background:"#1e293b",borderRadius:8,padding:14,marginBottom:10,border:"1px solid #334155"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:"#a78bfa",fontWeight:600,fontSize:12}}>🦙 Ollama (local)</span>
            <span style={{fontSize:11,color:ollamaStatus?"#86efac":"#fca5a5"}}>{ollamaStatus?"● running":"● not detected"}</span>
          </div>
          {ollamaModels.length>0
            ?<select value={local.ollama?.model||""} onChange={e=>setLocal(l=>({...l,ollama:{...l.ollama,model:e.target.value}}))}
                style={{width:"100%",background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit"}}>
               {ollamaModels.map(m=><option key={m} value={m}>{m}</option>)}
             </select>
            :<div style={{fontSize:11,color:"#475569"}}>No models. Run: <code style={{color:"#a78bfa"}}>ollama pull qwen2.5:14b</code></div>}
        </div>
        {Object.keys(PROVIDERS).filter(p=>p!=="ollama").map(p=>{
          const{label,icon,color,models,defaultModel}=PROVIDERS[p];
          const cfg=local[p]||{apiKey:"",model:defaultModel};
          return(
            <div key={p} style={{background:"#1e293b",borderRadius:8,padding:14,marginBottom:10,border:"1px solid #334155"}}>
              <div style={{color,fontWeight:600,fontSize:12,marginBottom:10}}>{icon} {label}</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input type={showKey[p]?"text":"password"} placeholder={`${label} API key`}
                  value={cfg.apiKey||""} onChange={e=>setLocal(l=>({...l,[p]:{...cfg,apiKey:e.target.value}}))}
                  style={{flex:1,background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                <button onClick={()=>setShowKey(s=>({...s,[p]:!s[p]}))}
                  style={{background:"#334155",border:"none",color:"#94a3b8",borderRadius:6,padding:"0 10px",cursor:"pointer",fontSize:12}}>
                  {showKey[p]?"Hide":"Show"}
                </button>
              </div>
              <select value={cfg.model||defaultModel} onChange={e=>setLocal(l=>({...l,[p]:{...cfg,model:e.target.value}}))}
                style={{width:"100%",background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit"}}>
                {models.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          );
        })}
        <div style={{display:"flex",gap:10,marginTop:18}}>
          <button onClick={save} style={{flex:1,padding:"10px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}}>Save & Apply</button>
          <button onClick={onClose} style={{padding:"10px 20px",background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;