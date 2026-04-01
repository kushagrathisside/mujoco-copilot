export function buildXMLSummary(xmlStr) {
  try {
    const doc=new DOMParser().parseFromString(xmlStr,"text/xml");
    const bodies=[...doc.querySelectorAll("body")].map(b=>b.getAttribute("name")).filter(Boolean);
    const joints=[...doc.querySelectorAll("joint")].map(j=>`${j.getAttribute("name")||"?"}(${j.getAttribute("type")||"hinge"})`);
    const actuators=[...doc.querySelectorAll("actuator > *")].map(a=>a.getAttribute("name")||"?");
    const sensors=[...doc.querySelectorAll("sensor > *")].map(s=>s.getAttribute("name")||"?");
    const geoms=[...doc.querySelectorAll("geom")].map(g=>`${g.getAttribute("name")||"?"}:${g.getAttribute("type")||"sphere"}`);
    return `Robot structure:\n- Bodies(${bodies.length}): ${bodies.join(",")||"none"}\n- Joints(${joints.length}): ${joints.join(",")||"none"}\n- Geoms(${geoms.length}): ${geoms.join(",")||"none"}\n- Actuators(${actuators.length}): ${actuators.join(",")||"none"}\n- Sensors(${sensors.length}): ${sensors.join(",")||"none"}`;
  } catch{ return null; }
}