
export function Toast({message,type,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[]);
  return(<div style={{position:"fixed",bottom:24,right:24,background:type==="error"?"#ef4444":type==="warn"?"#f59e0b":"#22c55e",
    color:"#fff",padding:"10px 18px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono',monospace",
    zIndex:9999,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",animation:"slideUp 0.3s ease"}}>{message}</div>);
}