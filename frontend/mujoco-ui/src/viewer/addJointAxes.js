
// ── Feature: Joint Axis Arrows ───────────────────────────────────────────────
export function addJointAxes(scene, xmlDoc, showAxes) {
  const toRemove=[];
  scene.traverse(o=>{if(o.userData.jointAxis)toRemove.push(o);});
  toRemove.forEach(o=>scene.remove(o));
  if(!showAxes||!xmlDoc) return;

  const AXIS_COLORS = { hinge:0xef4444, slide:0x22c55e, ball:0xa78bfa, free:0xfbbf24 };

  function processBody(bodyEl, parentMatrix) {
    const pos=pv(bodyEl.getAttribute("pos"));
    const euler=peu(bodyEl.getAttribute("euler"));
    const localMat=new THREE.Matrix4().compose(
      new THREE.Vector3(pos[0],pos[2],-pos[1]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(euler[0],euler[2],euler[1],"XYZ")),
      new THREE.Vector3(1,1,1)
    );
    const worldMat=new THREE.Matrix4().multiplyMatrices(parentMatrix,localMat);
    const wPos=new THREE.Vector3(),wQ=new THREE.Quaternion(),wS=new THREE.Vector3(1,1,1);
    worldMat.decompose(wPos,wQ,wS);

    [...bodyEl.children].filter(c=>c.tagName==="joint").forEach(j=>{
      const type=j.getAttribute("type")||"hinge";
      const axis=pv(j.getAttribute("axis"),[0,0,1]);
      const color=AXIS_COLORS[type]||0xffffff;
      // Transform axis to world
      const axisVec=new THREE.Vector3(axis[0],axis[2],-axis[1]).applyQuaternion(wQ).normalize();
      const arrow=new THREE.ArrowHelper(axisVec, wPos, 0.25, color, 0.07, 0.05);
      arrow.userData.jointAxis=true;
      scene.add(arrow);
      // Range arc for hinge joints
      if(type==="hinge"){
        const rangeStr=j.getAttribute("range");
        if(rangeStr){
          const[mn,mx]=rangeStr.trim().split(/\s+/).map(v=>dtr(parseFloat(v)));
          const pts=[];
          const steps=24;
          for(let i=0;i<=steps;i++){
            const a=mn+(mx-mn)*i/steps;
            const perp=new THREE.Vector3(1,0,0);
            if(Math.abs(axisVec.dot(perp))>0.9) perp.set(0,1,0);
            const r=perp.clone().cross(axisVec).normalize();
            const q=new THREE.Quaternion().setFromAxisAngle(axisVec,a);
            const p=r.clone().applyQuaternion(q).multiplyScalar(0.18).add(wPos);
            pts.push(p);
          }
          const geo=new THREE.BufferGeometry().setFromPoints(pts);
          const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,opacity:0.5,transparent:true}));
          line.userData.jointAxis=true;
          scene.add(line);
        }
      }
    });
    [...bodyEl.children].filter(c=>c.tagName==="body").forEach(c=>processBody(c,worldMat));
  }

  const wb=xmlDoc.querySelector("worldbody");
  if(!wb) return;
  const I=new THREE.Matrix4().identity();
  [...wb.children].filter(c=>c.tagName==="body").forEach(c=>processBody(c,I));
}