export function validateMuJoCoXML(xmlStr) {
  const errors=[], warnings=[];
  let doc;
  try {
    doc = new DOMParser().parseFromString(xmlStr,"text/xml");
    const pe = doc.querySelector("parsererror");
    if(pe) return {valid:false,errors:[`XML parse error: ${pe.textContent.slice(0,120)}`],warnings,doc:null};
  } catch(e){ return {valid:false,errors:[`Parse exception: ${e.message}`],warnings,doc:null}; }
  if(doc.documentElement.tagName!=="mujoco") errors.push("Root element must be <mujoco>");
  doc.querySelectorAll("body").forEach(b=>{
    const name=b.getAttribute("name")||"(unnamed)";
    if(!Array.from(b.children).some(c=>c.tagName==="geom")) errors.push(`Body "${name}" has no <geom>`);
  });
  const jointNames=new Set([...doc.querySelectorAll("joint")].map(j=>j.getAttribute("name")).filter(Boolean));
  doc.querySelectorAll("actuator > *").forEach(a=>{
    const j=a.getAttribute("joint");
    if(j&&!jointNames.has(j)) errors.push(`Actuator "${a.getAttribute("name")||"?"}" → unknown joint "${j}"`);
  });
  doc.querySelectorAll("sensor > *").forEach(s=>{
    const j=s.getAttribute("joint");
    if(j&&!jointNames.has(j)) warnings.push(`Sensor "${s.getAttribute("name")||"?"}" → unknown joint "${j}"`);
  });
  doc.querySelectorAll("geom").forEach(g=>{
    const t=g.getAttribute("type")||"sphere";
    if(!g.hasAttribute("size")&&["box","sphere","cylinder","capsule","plane"].includes(t))
      warnings.push(`Geom "${g.getAttribute("name")||"?"}" (${t}) missing size`);
  });
  const masses=[...doc.querySelectorAll("geom")].map(g=>parseFloat(g.getAttribute("mass")||"0")).filter(m=>m>0);
  if(masses.length>1){const mx=Math.max(...masses),mn=Math.min(...masses);if(mx/mn>1000)warnings.push(`Mass ratio ${(mx/mn).toFixed(0)}:1 may cause instability`);}
  return {valid:errors.length===0, errors, warnings, doc};
}