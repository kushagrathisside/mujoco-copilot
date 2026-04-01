
// ─────────────────────────────────────────────────────────────────────────────
// PYTHON EXPORT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PythonExportModal({onClose, xml}){
  const code=useMemo(()=>generatePythonScript(xml),[xml]);
  const copy=()=>{navigator.clipboard.writeText(code);};
  const download=()=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([code],{type:"text/plain"}));
    a.download="simulate_robot.py";a.click();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,width:700,maxHeight:"90vh",display:"flex",flexDirection:"column",fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid #1e293b",flexShrink:0}}>
          <div>
            <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>🐍 Python Simulation Script</span>
            <div style={{fontSize:11,color:"#475569",marginTop:2}}>Ready to run with: <code style={{color:"#86efac"}}>pip install mujoco</code></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={copy} style={{padding:"6px 14px",background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>⎘ Copy</button>
            <button onClick={download} style={{padding:"6px 14px",background:"#1e3a5f",color:"#7dd3fc",border:"1px solid #2d5f8a",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>↓ Download</button>
            <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflow:"auto",padding:0}}>
          <pre style={{margin:0,padding:"16px 20px",fontSize:11,lineHeight:1.6,color:"#94a3b8",background:"transparent",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
            {code.split("\n").map((line,i)=>(
              <div key={i} style={{display:"flex"}}>
                <span style={{color:"#334155",minWidth:32,textAlign:"right",marginRight:16,userSelect:"none",flexShrink:0}}>{i+1}</span>
                <span style={{
                  color: line.trim().startsWith("#") ? "#475569"
                       : line.includes("def ") ? "#7dd3fc"
                       : line.includes("import") ? "#a78bfa"
                       : line.includes("print(") ? "#86efac"
                       : "#94a3b8"
                }}>{line}</span>
              </div>
            ))}
          </pre>
        </div>
        <div style={{padding:"10px 20px",borderTop:"1px solid #1e293b",fontSize:11,color:"#334155",flexShrink:0}}>
          Usage: <code style={{color:"#86efac"}}>python simulate_robot.py</code> &nbsp;·&nbsp;
          Viewer: <code style={{color:"#86efac"}}>python simulate_robot.py --viewer</code>
        </div>
      </div>
    </div>
  );
}

export default PythonExportModal;