import { useState, useRef, useEffect, useMemo } from "react"
import * as THREE from "three"

import { buildThreeScene } from "../viewer/buildThreeScene"
import { addJointAxes } from "../viewer/addJointAxes"
import { kinematicStep } from "../viewer/kinematicStep"
// ─────────────────────────────────────────────────────────────────────────────
// 3D VIEWER — now with showAxes + simulating props
// ─────────────────────────────────────────────────────────────────────────────


export function RobotViewer({validationResult, selectedBody, showAxes, simulating}){
  const mountRef=useRef(null);
  const rendererRef=useRef(null),sceneRef=useRef(null),cameraRef=useRef(null),animRef=useRef(null);
  const isDragging=useRef(false),lastMouse=useRef({x:0,y:0}),sph=useRef({theta:0.6,phi:1.1,r:3.5});
  const simTimeRef=useRef(0);
  const simulatingRef=useRef(simulating);
  useEffect(()=>{simulatingRef.current=simulating;},[simulating]);

  const materials=useMemo(()=>{
    if(!validationResult?.doc)return{};
    const m={};
    validationResult.doc.querySelectorAll("material").forEach(el=>{
      const nm=el.getAttribute("name"),rgba=el.getAttribute("rgba");
      if(nm&&rgba)m[nm]=prgba(rgba);
    });
    return m;
  },[validationResult?.doc]);

  useEffect(()=>{
    const el=mountRef.current;if(!el)return;
    const w=el.clientWidth,h=el.clientHeight;
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(w,h);renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0a0f1a,1);
    el.appendChild(renderer.domElement);rendererRef.current=renderer;
    const scene=new THREE.Scene();sceneRef.current=scene;
    scene.add(new THREE.AmbientLight(0xffffff,0.4));
    const sun=new THREE.DirectionalLight(0xffffff,1.2);sun.position.set(3,6,4);sun.castShadow=true;scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x334466,0x0a0f1a,0.5));
    const grid=new THREE.GridHelper(10,20,0x1e293b,0x1e293b);grid.material.opacity=0.4;grid.material.transparent=true;scene.add(grid);
    const cam=new THREE.PerspectiveCamera(45,w/h,0.01,100);cameraRef.current=cam;
    const updateCam=()=>{const{theta,phi,r}=sph.current;cam.position.set(r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.cos(theta));cam.lookAt(0,0.5,0);};
    updateCam();
    let last=performance.now();
    const animate=()=>{
      animRef.current=requestAnimationFrame(animate);
      const now=performance.now();const dt=(now-last)/1000;last=now;
      if(simulatingRef.current){
        simTimeRef.current+=dt;
        const doc=sceneRef.current?.userData?.xmlDoc;
        if(doc){
          const angles=kinematicStep(doc,simTimeRef.current,{});
          try{buildThreeScene(scene,doc,sceneRef.current.userData.materials||{},sceneRef.current.userData.selectedBody,angles);}catch(e){}
          addJointAxes(scene,doc,sceneRef.current.userData.showAxes);
        }
      }
      renderer.render(scene,cam);
    };
    animate();
    const onDown=e=>{isDragging.current=true;lastMouse.current={x:e.clientX,y:e.clientY};};
    const onUp=()=>{isDragging.current=false;};
    const onMove=e=>{
      if(!isDragging.current)return;
      sph.current.theta-=(e.clientX-lastMouse.current.x)*0.008;
      sph.current.phi=Math.max(0.1,Math.min(Math.PI-0.1,sph.current.phi+(e.clientY-lastMouse.current.y)*0.008));
      lastMouse.current={x:e.clientX,y:e.clientY};updateCam();
    };
    const onWheel=e=>{sph.current.r=Math.max(0.5,Math.min(14,sph.current.r+e.deltaY*0.005));updateCam();};
    const onResize=()=>{const w2=el.clientWidth,h2=el.clientHeight;renderer.setSize(w2,h2);cam.aspect=w2/h2;cam.updateProjectionMatrix();};
    el.addEventListener("mousedown",onDown);el.addEventListener("mouseup",onUp);
    el.addEventListener("mouseleave",onUp);el.addEventListener("mousemove",onMove);
    el.addEventListener("wheel",onWheel,{passive:true});window.addEventListener("resize",onResize);
    return()=>{cancelAnimationFrame(animRef.current);renderer.dispose();el.innerHTML="";window.removeEventListener("resize",onResize);};
  },[]);

  // Rebuild scene when xml/axes/selectedBody changes
  useEffect(()=>{
    if(!sceneRef.current||!validationResult?.doc)return;
    sceneRef.current.userData={xmlDoc:validationResult.doc,materials,selectedBody,showAxes};
    if(!simulatingRef.current){
      try{buildThreeScene(sceneRef.current,validationResult.doc,materials,selectedBody,{});}catch(e){console.warn(e);}
      addJointAxes(sceneRef.current,validationResult.doc,showAxes);
    }
  },[validationResult?.doc,materials,selectedBody,showAxes]);

  return(
    <div style={{position:"relative",width:"100%",height:"100%"}}>
      <div ref={mountRef} style={{width:"100%",height:"100%",cursor:"grab"}}/>
      <div style={{position:"absolute",top:8,left:8,fontSize:10,fontFamily:"'JetBrains Mono',monospace",
        color:"#334155",background:"rgba(10,15,26,0.8)",padding:"3px 8px",borderRadius:4}}>
        drag · scroll to zoom{selectedBody?` · 🟡 ${selectedBody}`:""}
        {simulating&&<span style={{color:"#86efac",marginLeft:6}}>● kinematic sim</span>}
      </div>
      {validationResult&&(
        <div style={{position:"absolute",top:8,right:8,fontSize:11,fontFamily:"'JetBrains Mono',monospace",
          background:validationResult.valid?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",
          color:validationResult.valid?"#86efac":"#fca5a5",
          border:`1px solid ${validationResult.valid?"#166534":"#7f1d1d"}`,padding:"4px 10px",borderRadius:6}}>
          {validationResult.valid?`✓ valid${validationResult.warnings.length>0?` · ${validationResult.warnings.length}w`:""}`:
           `✗ ${validationResult.errors.length} error${validationResult.errors.length!==1?"s":""}`}
        </div>
      )}
    </div>
  );
}

export default RobotViewer;