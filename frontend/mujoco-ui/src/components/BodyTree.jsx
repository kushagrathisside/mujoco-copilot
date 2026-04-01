// ─────────────────────────────────────────────────────────────────────────────
// BODY TREE
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

export function BodyTreeNode({node,onSelect,selected}){
  const [open,setOpen]=useState(true);
  const isSel=selected===node.name;
  return(
    <div>
      <div onClick={()=>onSelect(node.name)}
        style={{display:"flex",alignItems:"center",gap:4,padding:"3px 6px",paddingLeft:`${8+node.depth*14}px`,
          cursor:"pointer",borderRadius:4,borderLeft:isSel?"2px solid #7dd3fc":"2px solid transparent",
          background:isSel?"rgba(125,211,252,0.12)":"transparent",transition:"all 0.1s"}}
        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
        {node.children.length>0
          ?<span onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} style={{color:"#475569",fontSize:9,width:10,flexShrink:0}}>{open?"▾":"▸"}</span>
          :<span style={{width:10,flexShrink:0}}/>}
        <span style={{fontSize:11,color:isSel?"#7dd3fc":"#94a3b8"}}>⬡</span>
        <span style={{fontSize:11,color:isSel?"#e2e8f0":"#94a3b8",fontWeight:isSel?600:400}}>{node.name}</span>
        <span style={{marginLeft:"auto",display:"flex",gap:3}}>
          {node.joints.map(j=><span key={j.name} title={`${j.name}(${j.type})`} style={{fontSize:9,background:"rgba(167,139,250,0.2)",color:"#a78bfa",padding:"1px 4px",borderRadius:3}}>J</span>)}
          {node.geoms.map(g=><span key={g.name} title={`${g.name}(${g.type})`} style={{fontSize:9,background:"rgba(125,211,252,0.15)",color:"#7dd3fc",padding:"1px 4px",borderRadius:3}}>{g.type[0].toUpperCase()}</span>)}
        </span>
      </div>
      {open&&node.children.map(c=><BodyTreeNode key={c.name} node={c} onSelect={onSelect} selected={selected}/>)}
    </div>
  );
}