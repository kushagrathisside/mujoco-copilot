export function parseBodyTree(doc) {
  if(!doc) return [];
  function parseNode(el,depth=0){
    return {
      name:el.getAttribute("name")||"(unnamed)", depth,
      joints:[...el.children].filter(c=>c.tagName==="joint").map(j=>({name:j.getAttribute("name")||"?",type:j.getAttribute("type")||"hinge"})),
      geoms:[...el.children].filter(c=>c.tagName==="geom").map(g=>({name:g.getAttribute("name")||"?",type:g.getAttribute("type")||"sphere"})),
      children:[...el.children].filter(c=>c.tagName==="body").map(c=>parseNode(c,depth+1))
    };
  }
  const wb=doc.querySelector("worldbody");
  if(!wb) return [];
  return [...wb.children].filter(c=>c.tagName==="body").map(c=>parseNode(c,0));
}