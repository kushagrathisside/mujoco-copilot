
// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function ValidationPanel({result}){
  if(!result)return null;
  return(
    <div style={{padding:"7px 14px",borderTop:"1px solid #1e293b",fontSize:11,fontFamily:"'JetBrains Mono',monospace",maxHeight:100,overflowY:"auto",flexShrink:0}}>
      {result.errors.map((e,i)=><div key={i} style={{color:"#fca5a5",marginBottom:2}}>✗ {e}</div>)}
      {result.warnings.map((w,i)=><div key={i} style={{color:"#fde68a",marginBottom:2}}>⚠ {w}</div>)}
      {result.valid&&result.warnings.length===0&&<div style={{color:"#86efac"}}>✓ No errors or warnings</div>}
    </div>
  );
}