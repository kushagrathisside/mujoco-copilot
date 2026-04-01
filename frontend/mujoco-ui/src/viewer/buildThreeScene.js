
// ── Build Three.js scene with optional joint angles ───────────────────────────
export function buildThreeScene(scene, xmlDoc, materials, selectedBody, jointAngles={}) {
  const toRemove=[];
  scene.traverse(o=>{if(o.userData.mujocoGeom)toRemove.push(o);});
  toRemove.forEach(o=>scene.remove(o));
  const matCache={};
  const getMat=(name,fallback)=>{
    if(matCache[name])return matCache[name];
    const hex=materials[name]||fallback||0x4a9fd4;
    return matCache[name]=new THREE.MeshStandardMaterial({color:hex,roughness:0.5,metalness:0.15});
  };
  function addGeom(geomEl,parentMatrix,bodyName){
    const type=geomEl.getAttribute("type")||"sphere";
    const pos=pv(geomEl.getAttribute("pos"));
    const euler=peu(geomEl.getAttribute("euler"));
    const sizes=psz(geomEl.getAttribute("size"));
    const fromto=geomEl.getAttribute("fromto");
    const isSel=bodyName===selectedBody;
    const matName=geomEl.getAttribute("material")||"";
    const rgba=geomEl.getAttribute("rgba");
    const mat=isSel
      ?new THREE.MeshStandardMaterial({color:0xfbbf24,roughness:0.3,metalness:0.2,emissive:0x7a5c00,emissiveIntensity:0.3})
      :matName?getMat(matName,null):new THREE.MeshStandardMaterial({color:rgba?prgba(rgba):0x4a9fd4,roughness:0.5,metalness:0.15});
    const wPos=new THREE.Vector3(),wQ=new THREE.Quaternion(),wS=new THREE.Vector3(1,1,1);
    parentMatrix.decompose(wPos,wQ,wS);
    let geo,mesh;
    if(type==="box"){const[sx,sy,sz]=[sizes[0]||0.1,sizes[1]||sizes[0]||0.1,sizes[2]||sizes[0]||0.1];geo=new THREE.BoxGeometry(sx*2,sy*2,sz*2);}
    else if(type==="sphere"){geo=new THREE.SphereGeometry(sizes[0]||0.1,16,12);}
    else if(type==="cylinder"){geo=new THREE.CylinderGeometry(sizes[0]||0.05,sizes[0]||0.05,(sizes[1]||0.1)*2,16);}
    else if(type==="capsule"){
      const r=sizes[0]||0.05;
      if(fromto){
        const[x1,y1,z1,x2,y2,z2]=fromto.trim().split(/\s+/).map(Number);
        const start=new THREE.Vector3(x1,z1,-y1),end=new THREE.Vector3(x2,z2,-y2);
        const len=start.distanceTo(end);
        const grp=new THREE.Group();
        const cyl=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,16),mat);
        const c1=new THREE.Mesh(new THREE.SphereGeometry(r,16,8),mat);c1.position.y=len/2;
        const c2=new THREE.Mesh(new THREE.SphereGeometry(r,16,8),mat);c2.position.y=-len/2;
        [cyl,c1,c2].forEach(m=>{m.castShadow=true;m.userData.mujocoGeom=true;m.userData.bodyName=bodyName;grp.add(m);});
        const mid=new THREE.Vector3().addVectors(start,end).multiplyScalar(0.5);
        const lp=mid.clone().applyQuaternion(wQ).add(wPos);
        grp.position.copy(lp);
        const dir=new THREE.Vector3().subVectors(end,start).normalize();
        grp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
        grp.userData.mujocoGeom=true;grp.userData.bodyName=bodyName;
        scene.add(grp);return;
      }
      geo=new THREE.CylinderGeometry(r,r,(sizes[1]||0.1)*2,16);
    } else if(type==="plane"){
      mesh=new THREE.Mesh(new THREE.PlaneGeometry((sizes[0]||5)*2,(sizes[1]||sizes[0]||5)*2),new THREE.MeshStandardMaterial({color:0x1a1f2e,roughness:0.9}));
      mesh.rotation.x=-Math.PI/2;mesh.userData.mujocoGeom=true;scene.add(mesh);return;
    } else{geo=new THREE.SphereGeometry(0.05,8,6);}
    mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData.mujocoGeom=true;mesh.userData.bodyName=bodyName;
    mesh.position.copy(new THREE.Vector3(pos[0],pos[2],-pos[1]).applyQuaternion(wQ).add(wPos));
    mesh.rotation.set(euler[0],euler[2],euler[1]);
    scene.add(mesh);
  }
  function traverseBody(bodyEl,parentMatrix){
    const pos=pv(bodyEl.getAttribute("pos"));
    const euler=peu(bodyEl.getAttribute("euler"));
    const bodyName=bodyEl.getAttribute("name")||"";
    // Apply joint rotation from simulation state
    let jointQ=new THREE.Quaternion();
    [...bodyEl.children].filter(c=>c.tagName==="joint").forEach(j=>{
      const jname=j.getAttribute("name")||"";
      const angle=jointAngles[jname];
      if(angle!==undefined&&j.getAttribute("type")==="hinge"){
        const axis=pv(j.getAttribute("axis"),[0,0,1]);
        const axVec=new THREE.Vector3(axis[0],axis[2],-axis[1]).normalize();
        const q=new THREE.Quaternion().setFromAxisAngle(axVec,angle);
        jointQ=q.multiply(jointQ);
      }
    });
    const baseQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(euler[0],euler[2],euler[1],"XYZ"));
    const worldQ=baseQ.clone().multiply(jointQ);
    const localMat=new THREE.Matrix4().compose(new THREE.Vector3(pos[0],pos[2],-pos[1]),worldQ,new THREE.Vector3(1,1,1));
    const worldMat=new THREE.Matrix4().multiplyMatrices(parentMatrix,localMat);
    [...bodyEl.children].forEach(c=>{
      if(c.tagName==="geom") addGeom(c,worldMat,bodyName);
      if(c.tagName==="body") traverseBody(c,worldMat);
    });
  }
  const wb=xmlDoc.querySelector("worldbody");if(!wb)return;
  const I=new THREE.Matrix4().identity();
  [...wb.children].forEach(c=>{
    if(c.tagName==="body") traverseBody(c,I);
    if(c.tagName==="geom") addGeom(c,I,"");
  });
}