import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDERS = {
  ollama:    { label:"Ollama",    icon:"🦙", color:"#a78bfa", needsKey:false, models:[], defaultModel:"qwen2.5:7b" },
  anthropic: { label:"Anthropic", icon:"◆",  color:"#f97316", needsKey:true,
               models:["claude-sonnet-4-20250514","claude-opus-4-20250514","claude-haiku-4-5-20251001"], defaultModel:"claude-sonnet-4-20250514" },
  openai:    { label:"OpenAI",    icon:"⬡",  color:"#22c55e", needsKey:true,
               models:["gpt-4o","gpt-4o-mini","gpt-4-turbo"], defaultModel:"gpt-4o" },
  gemini:    { label:"Gemini",    icon:"✦",  color:"#3b82f6", needsKey:true,
               models:["gemini-1.5-pro","gemini-1.5-flash","gemini-2.0-flash"], defaultModel:"gemini-1.5-pro" },
  groq:      { label:"Groq",      icon:"⚡",  color:"#eab308", needsKey:true,
               models:["llama-3.3-70b-versatile","mixtral-8x7b-32768","llama3-70b-8192"], defaultModel:"llama-3.3-70b-versatile" },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT XML
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_XML = `<mujoco model="simple_robot">
  <option gravity="0 0 -9.81" timestep="0.002"/>
  <asset>
    <material name="body_mat"   rgba="0.3 0.6 0.9 1"/>
    <material name="joint_mat"  rgba="0.9 0.5 0.2 1"/>
    <material name="ground_mat" rgba="0.15 0.15 0.18 1"/>
  </asset>
  <worldbody>
    <light pos="0 0 4" dir="0 0 -1" diffuse="1 1 1"/>
    <geom name="floor" type="plane" size="5 5 0.1" material="ground_mat"/>
    <body name="torso" pos="0 0 0.5">
      <joint name="root_x" type="slide" axis="1 0 0"/>
      <joint name="root_z" type="slide" axis="0 0 1"/>
      <geom name="torso_geom" type="box" size="0.2 0.15 0.25" material="body_mat" mass="5"/>
      <body name="left_thigh" pos="-0.1 0 -0.25">
        <joint name="left_hip" type="hinge" axis="0 1 0" range="-60 60"/>
        <geom name="left_thigh_geom" type="capsule" fromto="0 0 0 0 0 -0.3" size="0.05" material="body_mat" mass="1.5"/>
        <body name="left_shin" pos="0 0 -0.3">
          <joint name="left_knee" type="hinge" axis="0 1 0" range="0 120"/>
          <geom name="left_shin_geom" type="capsule" fromto="0 0 0 0 0 -0.25" size="0.04" material="body_mat" mass="1"/>
        </body>
      </body>
      <body name="right_thigh" pos="0.1 0 -0.25">
        <joint name="right_hip" type="hinge" axis="0 1 0" range="-60 60"/>
        <geom name="right_thigh_geom" type="capsule" fromto="0 0 0 0 0 -0.3" size="0.05" material="body_mat" mass="1.5"/>
        <body name="right_shin" pos="0 0 -0.3">
          <joint name="right_knee" type="hinge" axis="0 1 0" range="0 120"/>
          <geom name="right_shin_geom" type="capsule" fromto="0 0 0 0 0 -0.25" size="0.04" material="body_mat" mass="1"/>
        </body>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="left_hip_act"   joint="left_hip"   gear="100"/>
    <motor name="left_knee_act"  joint="left_knee"  gear="80"/>
    <motor name="right_hip_act"  joint="right_hip"  gear="100"/>
    <motor name="right_knee_act" joint="right_knee" gear="80"/>
  </actuator>
</mujoco>`;

// ─────────────────────────────────────────────────────────────────────────────
// SNIPPETS
// ─────────────────────────────────────────────────────────────────────────────
const SNIPPETS = [
  { name:"6-DOF Arm", icon:"🦾", xml:`<body name="shoulder" pos="0 0 1.0">
  <joint name="sh_pan"  type="hinge" axis="0 0 1" range="-180 180"/>
  <geom type="cylinder" size="0.05 0.08" material="body_mat" mass="1"/>
  <body name="upper_arm" pos="0 0 0.08">
    <joint name="sh_lift" type="hinge" axis="0 1 0" range="-90 90"/>
    <geom type="capsule" fromto="0 0 0 0 0 0.3" size="0.04" material="body_mat" mass="0.8"/>
    <body name="forearm" pos="0 0 0.3">
      <joint name="elbow" type="hinge" axis="0 1 0" range="-120 0"/>
      <geom type="capsule" fromto="0 0 0 0 0 0.25" size="0.035" material="body_mat" mass="0.6"/>
      <body name="wrist1" pos="0 0 0.25">
        <joint name="wrist_roll"  type="hinge" axis="0 0 1" range="-180 180"/>
        <joint name="wrist_pitch" type="hinge" axis="0 1 0" range="-90 90"/>
        <joint name="wrist_yaw"   type="hinge" axis="1 0 0" range="-90 90"/>
        <geom type="sphere" size="0.04" material="joint_mat" mass="0.3"/>
      </body>
    </body>
  </body>
</body>` },
  { name:"Gripper", icon:"✊", xml:`<body name="gripper_base" pos="0 0 0">
  <geom type="box" size="0.04 0.04 0.02" material="body_mat" mass="0.2"/>
  <body name="finger_left" pos="-0.03 0 0.02">
    <joint name="finger_left_j" type="slide" axis="1 0 0" range="0 0.04"/>
    <geom type="box" size="0.01 0.012 0.05" material="joint_mat" mass="0.05"/>
  </body>
  <body name="finger_right" pos="0.03 0 0.02">
    <joint name="finger_right_j" type="slide" axis="-1 0 0" range="0 0.04"/>
    <geom type="box" size="0.01 0.012 0.05" material="joint_mat" mass="0.05"/>
  </body>
</body>` },
  { name:"Wheeled Base", icon:"🛞", xml:`<body name="base" pos="0 0 0.1">
  <joint name="base_x" type="slide" axis="1 0 0"/>
  <joint name="base_y" type="slide" axis="0 1 0"/>
  <joint name="base_yaw" type="hinge" axis="0 0 1"/>
  <geom type="box" size="0.2 0.15 0.05" material="body_mat" mass="3"/>
  <body name="wheel_fl" pos="-0.18 0.13 -0.05">
    <joint name="wfl" type="hinge" axis="0 1 0"/>
    <geom type="cylinder" size="0.06 0.02" material="joint_mat" mass="0.3"/>
  </body>
  <body name="wheel_fr" pos="0.18 0.13 -0.05">
    <joint name="wfr" type="hinge" axis="0 1 0"/>
    <geom type="cylinder" size="0.06 0.02" material="joint_mat" mass="0.3"/>
  </body>
</body>` },
  { name:"IMU Sensors", icon:"📡", xml:`<!-- Add to <sensor> block -->
<accelerometer name="imu_acc"  site="imu_site"/>
<gyro          name="imu_gyro" site="imu_site"/>
<!-- Add to a body: <site name="imu_site" pos="0 0 0"/> -->` },
  { name:"Cameras", icon:"📷", xml:`<camera name="front_cam" pos="0 -1.5 1.0" xyaxes="1 0 0 0 0.5 1"/>
<camera name="top_cam"   pos="0 0 3.0"  xyaxes="1 0 0 0 1 0"/>` },
];

// ─────────────────────────────────────────────────────────────────────────────
// BUILT-IN PROMPT MACROS
// ─────────────────────────────────────────────────────────────────────────────
const BUILTIN_MACROS = [
  { name:"Standard Sensors", icon:"📡", prompt:"Add a complete sensor suite: joint position sensors for all joints, joint velocity sensors for all joints, and an accelerometer on the torso." },
  { name:"Mirror Left→Right", icon:"🔄", prompt:"Mirror all left-side bodies, joints and actuators to create identical right-side counterparts. Ensure symmetric naming (replace 'left' with 'right')." },
  { name:"Add Damping",       icon:"🔧", prompt:"Add appropriate damping to all hinge joints to prevent oscillation. Use damping=1.0 for large joints and damping=0.5 for small joints." },
  { name:"Colorize by Type",  icon:"🎨", prompt:"Set distinct rgba colors: blue (0.3 0.6 0.9 1) for torso/base bodies, orange (0.9 0.5 0.2 1) for limb segments, green (0.3 0.8 0.4 1) for end-effectors." },
  { name:"Add Limits",        icon:"🔒", prompt:"Add realistic joint range limits to all hinge joints that are missing them. Use anatomically plausible ranges." },
  { name:"Fix Actuators",     icon:"⚡", prompt:"Add motor actuators for every hinge and slide joint that currently lacks an actuator. Use gear=100 for large joints, gear=50 for small ones." },
];

// ─────────────────────────────────────────────────────────────────────────────
// PYTHON EXPORT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function generatePythonScript(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const modelName = doc.documentElement?.getAttribute("model") || "robot";
  const joints = [...doc.querySelectorAll("joint")].map(j => j.getAttribute("name")).filter(Boolean);
  const actuators = [...doc.querySelectorAll("actuator > *")].map(a => a.getAttribute("name")).filter(Boolean);
  const hingeJoints = [...doc.querySelectorAll("joint[type='hinge']")].map(j => j.getAttribute("name")).filter(Boolean);

  return `"""
MuJoCo simulation script for: ${modelName}
Generated by MuJoCo XML Editor
"""
import mujoco
import mujoco.viewer
import numpy as np
import time

# ── Load model ────────────────────────────────────────────────────────────────
XML = """
${xml.replace(/`/g, "'")}
"""

model = mujoco.MjModel.from_xml_string(XML)
data  = mujoco.MjData(model)

# ── Model info ────────────────────────────────────────────────────────────────
print(f"Model: ${modelName}")
print(f"  Bodies:    {model.nbody}")
print(f"  Joints:    {model.njnt}")
print(f"  Actuators: {model.nu}")
print(f"  DOF:       {model.nv}")

# ── Joint name → index helpers ────────────────────────────────────────────────
def joint_id(name):
    return mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)

def actuator_id(name):
    return mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_ACTUATOR, name)

${joints.length > 0 ? `# Joint indices
${joints.map(j => `jid_${j.replace(/[^a-zA-Z0-9_]/g,"_")} = joint_id("${j}")`).join("\n")}` : "# No named joints found"}

${actuators.length > 0 ? `# Actuator indices
${actuators.map(a => `aid_${a.replace(/[^a-zA-Z0-9_]/g,"_")} = actuator_id("${a}")`).join("\n")}` : "# No actuators found"}

# ── Simulation loop ───────────────────────────────────────────────────────────
def controller(model, data):
    """Apply control signals here."""
    t = data.time
${actuators.length > 0
  ? actuators.map(a => `    data.ctrl[aid_${a.replace(/[^a-zA-Z0-9_]/g,"_")}] = 0.0  # TODO: set control for ${a}`).join("\n")
  : "    pass  # No actuators"}

def run_headless(duration=5.0, dt=None):
    """Run simulation without viewer."""
    mujoco.mj_resetData(model, data)
    dt = dt or model.opt.timestep
    steps = int(duration / dt)
    print(f"\\nRunning {duration}s headless simulation ({steps} steps)...")
    t0 = time.time()
    for i in range(steps):
        controller(model, data)
        mujoco.mj_step(model, data)
        if i % 1000 == 0:
            print(f"  t={data.time:.2f}s  qpos={np.round(data.qpos[:4],3)}")
    wall = time.time() - t0
    print(f"Done. Wall time: {wall:.2f}s  ({steps/wall:.0f} steps/sec)")

def run_viewer():
    """Run simulation with interactive viewer."""
    print("\\nLaunching viewer (close window to exit)...")
    with mujoco.viewer.launch_passive(model, data) as v:
        mujoco.mj_resetData(model, data)
        while v.is_running():
            controller(model, data)
            mujoco.mj_step(model, data)
            v.sync()

if __name__ == "__main__":
    import sys
    if "--viewer" in sys.argv:
        run_viewer()
    else:
        run_headless(duration=5.0)
        print("\\nTip: run with --viewer for interactive simulation")
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// XML VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────
function validateMuJoCoXML(xmlStr) {
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

function buildXMLSummary(xmlStr) {
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

// ─────────────────────────────────────────────────────────────────────────────
// BODY TREE
// ─────────────────────────────────────────────────────────────────────────────
function parseBodyTree(doc) {
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

function BodyTreeNode({node,onSelect,selected}){
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

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const pv=(s,d=[0,0,0])=>{if(!s)return d;const n=s.trim().split(/\s+/).map(Number);return n.length>=3?[n[0],n[1],n[2]]:d;};
const psz=s=>{if(!s)return[0.1,0.1,0.1];return s.trim().split(/\s+/).map(Number);};
const prgba=s=>{if(!s)return 0x4a9fd4;const[r,g,b]=s.trim().split(/\s+/).map(Number);return((Math.round(r*255)<<16)|(Math.round(g*255)<<8)|Math.round(b*255));};
const dtr=d=>d*Math.PI/180;
const peu=s=>{if(!s)return[0,0,0];return s.trim().split(/\s+/).map(v=>dtr(parseFloat(v)||0));};

// ── Feature: Joint Axis Arrows ───────────────────────────────────────────────
function addJointAxes(scene, xmlDoc, showAxes) {
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

// ── WASM Physics simulation ───────────────────────────────────────────────────
// We simulate kinematically using sine-wave joint motion (no WASM required)
function kinematicStep(xmlDoc, t, jointStates) {
  // Returns map of joint name → angle (radians) for hinge joints
  const result = {};
  [...(xmlDoc?.querySelectorAll("joint[type='hinge']")||[])].forEach((j,i) => {
    const name = j.getAttribute("name")||`j${i}`;
    const rangeStr = j.getAttribute("range");
    let mn=-Math.PI/4, mx=Math.PI/4;
    if(rangeStr){const[a,b]=rangeStr.trim().split(/\s+/).map(v=>dtr(parseFloat(v)));mn=a;mx=b;}
    const mid=(mn+mx)/2, amp=(mx-mn)/2*0.5;
    result[name] = mid + amp*Math.sin(t*0.8 + i*0.7);
  });
  return result;
}

// ── Build Three.js scene with optional joint angles ───────────────────────────
function buildThreeScene(scene, xmlDoc, materials, selectedBody, jointAngles={}) {
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

// ─────────────────────────────────────────────────────────────────────────────
// 3D VIEWER — now with showAxes + simulating props
// ─────────────────────────────────────────────────────────────────────────────
function RobotViewer({validationResult, selectedBody, showAxes, simulating}){
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

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ValidationPanel({result}){
  if(!result)return null;
  return(
    <div style={{padding:"7px 14px",borderTop:"1px solid #1e293b",fontSize:11,fontFamily:"'JetBrains Mono',monospace",maxHeight:100,overflowY:"auto",flexShrink:0}}>
      {result.errors.map((e,i)=><div key={i} style={{color:"#fca5a5",marginBottom:2}}>✗ {e}</div>)}
      {result.warnings.map((w,i)=><div key={i} style={{color:"#fde68a",marginBottom:2}}>⚠ {w}</div>)}
      {result.valid&&result.warnings.length===0&&<div style={{color:"#86efac"}}>✓ No errors or warnings</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SNIPPET MODAL
// ─────────────────────────────────────────────────────────────────────────────
function SnippetModal({onClose,onInsert,customSnippets,setCustomSnippets}){
  const [newName,setNewName]=useState("");const [newXml,setNewXml]=useState("");
  const all=[...SNIPPETS,...customSnippets];
  const save=()=>{
    if(!newName.trim()||!newXml.trim())return;
    const updated=[...customSnippets,{name:newName,icon:"📌",xml:newXml,custom:true}];
    setCustomSnippets(updated);localStorage.setItem("mujoco_snippets",JSON.stringify(updated));
    setNewName("");setNewXml("");
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,width:560,maxHeight:"88vh",overflow:"auto",padding:22,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>📦 Snippet Library</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {all.map((s,i)=>(
            <div key={i} style={{background:"#1e293b",borderRadius:8,padding:12,border:"1px solid #334155",cursor:"pointer",transition:"all 0.15s"}}
              onClick={()=>{onInsert(s.xml);onClose();}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#7dd3fc"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
              <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
              <div style={{fontSize:12,color:"#e2e8f0",fontWeight:600,marginBottom:3}}>{s.name}</div>
              <div style={{fontSize:10,color:"#475569",overflow:"hidden",maxHeight:36,textOverflow:"ellipsis"}}>{s.xml.slice(0,70)}…</div>
              {s.custom&&<div style={{marginTop:3,fontSize:9,color:"#a78bfa"}}>● custom</div>}
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid #1e293b",paddingTop:12}}>
          <div style={{fontSize:11,color:"#475569",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.06em"}}>Save Custom Snippet</div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name"
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",marginBottom:7}}/>
          <textarea value={newXml} onChange={e=>setNewXml(e.target.value)} placeholder="XML…" rows={3}
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:11,fontFamily:"inherit",outline:"none",resize:"vertical",marginBottom:7}}/>
          <button onClick={save} disabled={!newName.trim()||!newXml.trim()}
            style={{padding:"6px 16px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO MODAL — Prompt Template Macros
// ─────────────────────────────────────────────────────────────────────────────
function MacroModal({onClose, onRun, customMacros, setCustomMacros}){
  const [newName,setNewName]=useState(""); const [newPrompt,setNewPrompt]=useState("");
  const all=[...BUILTIN_MACROS,...customMacros];
  const save=()=>{
    if(!newName.trim()||!newPrompt.trim())return;
    const updated=[...customMacros,{name:newName,icon:"📌",prompt:newPrompt,custom:true}];
    setCustomMacros(updated);localStorage.setItem("mujoco_macros",JSON.stringify(updated));
    setNewName("");setNewPrompt("");
  };
  const del=(idx)=>{
    const updated=customMacros.filter((_,i)=>i!==idx);
    setCustomMacros(updated);localStorage.setItem("mujoco_macros",JSON.stringify(updated));
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,width:580,maxHeight:"88vh",overflow:"auto",padding:22,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>⚡ Prompt Macros</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{fontSize:11,color:"#475569",marginBottom:12}}>Click any macro to run it instantly on your current XML.</div>
        <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
          {all.map((m,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#1e293b",borderRadius:8,padding:"10px 14px",border:"1px solid #334155",cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#7dd3fc"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
              <span style={{fontSize:16,flexShrink:0}}>{m.icon}</span>
              <div style={{flex:1}} onClick={()=>{onRun(m.prompt);onClose();}}>
                <div style={{fontSize:12,color:"#e2e8f0",fontWeight:600,marginBottom:2}}>{m.name}</div>
                <div style={{fontSize:10,color:"#64748b",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{m.prompt.slice(0,90)}…</div>
              </div>
              {m.custom&&(
                <button onClick={()=>del(i-BUILTIN_MACROS.length)}
                  style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:12,padding:"2px 6px"}}>✕</button>
              )}
              <button onClick={()=>{onRun(m.prompt);onClose();}}
                style={{padding:"5px 12px",background:"#1e3a5f",color:"#7dd3fc",border:"1px solid #2d5f8a",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit",flexShrink:0}}>
                Run ↑
              </button>
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid #1e293b",paddingTop:12}}>
          <div style={{fontSize:11,color:"#475569",marginBottom:7,textTransform:"uppercase",letterSpacing:"0.06em"}}>Save Custom Macro</div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Macro name"
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",marginBottom:7}}/>
          <textarea value={newPrompt} onChange={e=>setNewPrompt(e.target.value)} placeholder="Prompt text…" rows={3}
            style={{width:"100%",background:"#1e293b",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:11,fontFamily:"inherit",outline:"none",resize:"vertical",marginBottom:7}}/>
          <button onClick={save} disabled={!newName.trim()||!newPrompt.trim()}
            style={{padding:"6px 16px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Save Macro</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────────
function SettingsModal({onClose,providerCfg,setProviderCfg,ollamaModels,ollamaStatus}){
  const [local,setLocal]=useState(()=>JSON.parse(JSON.stringify(providerCfg)));
  const [showKey,setShowKey]=useState({});
  const save=()=>{
    Object.entries(local).forEach(([p,cfg])=>{
      if(cfg?.apiKey) localStorage.setItem(`mujoco_key_${p}`,cfg.apiKey);
      else localStorage.removeItem(`mujoco_key_${p}`);
    });
    localStorage.setItem("mujoco_provider",local.active);
    localStorage.setItem("mujoco_model",local[local.active]?.model||"");
    setProviderCfg(local);onClose();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,width:520,maxHeight:"88vh",overflow:"auto",padding:24,fontFamily:"'JetBrains Mono',monospace"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <span style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>⚙ Provider Settings</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Active Provider</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {Object.keys(PROVIDERS).map(p=>{
              const{label,icon,color}=PROVIDERS[p];const active=local.active===p;
              return(<button key={p} onClick={()=>setLocal(l=>({...l,active:p}))}
                style={{padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",
                  border:`1px solid ${active?color:"#334155"}`,background:active?`${color}22`:"#1e293b",color:active?color:"#94a3b8"}}>{icon} {label}</button>);
            })}
          </div>
        </div>
        <div style={{background:"#1e293b",borderRadius:8,padding:14,marginBottom:10,border:"1px solid #334155"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{color:"#a78bfa",fontWeight:600,fontSize:12}}>🦙 Ollama (local)</span>
            <span style={{fontSize:11,color:ollamaStatus?"#86efac":"#fca5a5"}}>{ollamaStatus?"● running":"● not detected"}</span>
          </div>
          {ollamaModels.length>0
            ?<select value={local.ollama?.model||""} onChange={e=>setLocal(l=>({...l,ollama:{...l.ollama,model:e.target.value}}))}
                style={{width:"100%",background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit"}}>
               {ollamaModels.map(m=><option key={m} value={m}>{m}</option>)}
             </select>
            :<div style={{fontSize:11,color:"#475569"}}>No models. Run: <code style={{color:"#a78bfa"}}>ollama pull qwen2.5:14b</code></div>}
        </div>
        {Object.keys(PROVIDERS).filter(p=>p!=="ollama").map(p=>{
          const{label,icon,color,models,defaultModel}=PROVIDERS[p];
          const cfg=local[p]||{apiKey:"",model:defaultModel};
          return(
            <div key={p} style={{background:"#1e293b",borderRadius:8,padding:14,marginBottom:10,border:"1px solid #334155"}}>
              <div style={{color,fontWeight:600,fontSize:12,marginBottom:10}}>{icon} {label}</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input type={showKey[p]?"text":"password"} placeholder={`${label} API key`}
                  value={cfg.apiKey||""} onChange={e=>setLocal(l=>({...l,[p]:{...cfg,apiKey:e.target.value}}))}
                  style={{flex:1,background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                <button onClick={()=>setShowKey(s=>({...s,[p]:!s[p]}))}
                  style={{background:"#334155",border:"none",color:"#94a3b8",borderRadius:6,padding:"0 10px",cursor:"pointer",fontSize:12}}>
                  {showKey[p]?"Hide":"Show"}
                </button>
              </div>
              <select value={cfg.model||defaultModel} onChange={e=>setLocal(l=>({...l,[p]:{...cfg,model:e.target.value}}))}
                style={{width:"100%",background:"#0f172a",border:"1px solid #334155",color:"#e2e8f0",padding:"6px 10px",borderRadius:6,fontSize:12,fontFamily:"inherit"}}>
                {models.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          );
        })}
        <div style={{display:"flex",gap:10,marginTop:18}}>
          <button onClick={save} style={{flex:1,padding:"10px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}}>Save & Apply</button>
          <button onClick={onClose} style={{padding:"10px 20px",background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

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

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT + DIFF + TOAST
// ─────────────────────────────────────────────────────────────────────────────
function highlightXML(xml){
  return xml.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/(&lt;\/?)([\w:]+)/g,'<span style="color:#7dd3fc">$1$2</span>')
    .replace(/([\w:-]+)(=)/g,'<span style="color:#a5b4fc">$1</span>$2')
    .replace(/="([^"]*)"/g,'=<span style="color:#86efac">"$1"</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<span style="color:#64748b;font-style:italic">$1</span>');
}
function computeDiff(a,b){
  const al=a.split("\n"),bl=b.split("\n"),r=[],mx=Math.max(al.length,bl.length);
  for(let i=0;i<mx;i++){
    const o=al[i],n=bl[i];
    if(o===undefined)r.push({type:"add",line:n,num:i+1});
    else if(n===undefined)r.push({type:"remove",line:o,num:i+1});
    else if(o!==n){r.push({type:"remove",line:o,num:i+1});r.push({type:"add",line:n,num:i+1});}
    else r.push({type:"same",line:o,num:i+1});
  }
  return r;
}
function Toast({message,type,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[]);
  return(<div style={{position:"fixed",bottom:24,right:24,background:type==="error"?"#ef4444":type==="warn"?"#f59e0b":"#22c55e",
    color:"#fff",padding:"10px 18px",borderRadius:8,fontSize:12,fontFamily:"'JetBrains Mono',monospace",
    zIndex:9999,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",animation:"slideUp 0.3s ease"}}>{message}</div>);
}

function loadStoredConfig(){
  const active=localStorage.getItem("mujoco_provider")||"ollama";
  const cfg={active};
  Object.keys(PROVIDERS).forEach(p=>{
    const key=localStorage.getItem(`mujoco_key_${p}`)||"";
    const model=p===active?(localStorage.getItem("mujoco_model")||PROVIDERS[p].defaultModel):PROVIDERS[p].defaultModel;
    cfg[p]={apiKey:key,model};
  });
  return cfg;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function MuJoCoEditor(){
  const [xml,setXml]             = useState(DEFAULT_XML);
  const [input,setInput]         = useState("");
  const [messages,setMessages]   = useState([{role:"assistant",content:"Hello! I'm your MuJoCo XML editor.\n\n**New:** ⚡ Macros · 🐍 Python export · 🎯 Joint axis arrows · ▶ Kinematic sim\n\nTry a macro or ask me anything about the robot."}]);
  const [chatHistory,setChatHistory] = useState([]);
  const [history,setHistory]     = useState([{xml:DEFAULT_XML,label:"Initial state",ts:Date.now()}]);
  const [historyIdx,setHistIdx]  = useState(0);
  const [loading,setLoading]     = useState(false);
  const [elapsed,setElapsed]     = useState(0);
  const elapsedRef               = useRef(null);
  const [diffLines,setDiffLines] = useState([]);
  const [toast,setToast]         = useState(null);
  const [panel,setPanel]         = useState("tree");
  const [centerTab,setCenterTab] = useState("editor");
  const [showSettings,setShowSettings]   = useState(false);
  const [showSnippets,setShowSnippets]   = useState(false);
  const [showMacros,setShowMacros]       = useState(false);
  const [showPython,setShowPython]       = useState(false);
  const [providerCfg,setProviderCfg]     = useState(loadStoredConfig);
  const [ollamaModels,setOllamaModels]   = useState([]);
  const [ollamaStatus,setOllamaStatus]   = useState(false);
  const [selectedBody,setSelectedBody]   = useState(null);
  // New feature state
  const [showAxes,setShowAxes]           = useState(false);
  const [simulating,setSimulating]       = useState(false);
  const [queryMode,setQueryMode]         = useState(false); // NL query mode
  const [customSnippets,setCustomSnippets] = useState(()=>{try{return JSON.parse(localStorage.getItem("mujoco_snippets")||"[]");}catch{return[];}});
  const [customMacros,setCustomMacros]   = useState(()=>{try{return JSON.parse(localStorage.getItem("mujoco_macros")||"[]");}catch{return[];}});
  const chatEndRef = useRef(null);

  const validation = useMemo(()=>validateMuJoCoXML(xml),[xml]);
  const bodyTree   = useMemo(()=>parseBodyTree(validation.doc),[validation.doc]);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>{
    fetch("http://localhost:8000/ollama/models")
      .then(r=>r.json()).then(d=>{setOllamaModels(d.models||[]);setOllamaStatus(true);})
      .catch(()=>setOllamaStatus(false));
  },[]);

  const showToast=(msg,type="success")=>setToast({message:msg,type});
  const applyVersion=idx=>{setXml(history[idx].xml);setHistIdx(idx);setDiffLines([]);setCenterTab("editor");};
  const pushHistory=(newXml,label)=>{
    setHistory(prev=>[...prev.slice(0,historyIdx+1),{xml:newXml,label,ts:Date.now()}]);
    setHistIdx(prev=>prev+1);
  };
  const undo=()=>{if(historyIdx>0)applyVersion(historyIdx-1);};
  const redo=()=>{if(historyIdx<history.length-1)applyVersion(historyIdx+1);};

  const insertSnippet=useCallback((snippetXml)=>{
    const ins=`\n  <!-- Snippet -->\n  ${snippetXml.replace(/\n/g,"\n  ")}\n`;
    const idx=xml.lastIndexOf("</worldbody>");
    const newXml=idx>=0?xml.slice(0,idx)+ins+xml.slice(idx):xml+ins;
    setXml(newXml);pushHistory(newXml,"Snippet inserted");showToast("Snippet inserted");
  },[xml,historyIdx]);

  const repairXML=useCallback(async(badXml,errors,provider,pCfg,attempt=1)=>{
    if(attempt>3)return badXml;
    const repairPrompt=`Fix ALL validation errors in this MuJoCo XML:\nErrors:\n${errors.map(e=>`- ${e}`).join("\n")}\n\nXML:\n${badXml}`;
    try{
      const resp=await fetch("http://localhost:8000/edit",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({xml:badXml,prompt:repairPrompt,provider,model:pCfg?.model,api_key:pCfg?.apiKey})});
      if(!resp.ok)return badXml;
      const data=await resp.json();
      const fixed=data.xml||badXml;
      const check=validateMuJoCoXML(fixed);
      if(check.valid)return fixed;
      return repairXML(fixed,check.errors,provider,pCfg,attempt+1);
    }catch{return badXml;}
  },[]);

  // ── Natural Language Query (read-only, no XML edit) ───────────────────────
  const sendQuery=useCallback(async(q)=>{
    if(!q.trim()||loading)return;
    setInput("");
    setMessages(prev=>[...prev,{role:"user",content:`🔍 ${q}`}]);
    setLoading(true);setElapsed(0);
    elapsedRef.current=setInterval(()=>setElapsed(s=>s+1),1000);
    const active=providerCfg.active||"ollama";
    const pCfg=providerCfg[active]||{};
    const summary=buildXMLSummary(xml);
    const queryPrompt=`You are a MuJoCo expert. Answer this question about the robot — do NOT modify the XML, just answer clearly and concisely.\n\n${summary}\n\nFull XML:\n${xml}\n\nQuestion: ${q}`;
    try{
      const resp=await fetch("http://localhost:8000/query",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:queryPrompt,provider:active,model:pCfg.model,api_key:pCfg.apiKey})});
      const data=await resp.json();
      setMessages(prev=>[...prev,{role:"assistant",content:`**Answer:** ${data.answer||data.detail||"No response"}\n\n*${elapsed}s · ${active}*`}]);
    }catch(err){
      setMessages(prev=>[...prev,{role:"assistant",content:`❌ ${err.message}`}]);
    }
    clearInterval(elapsedRef.current);setLoading(false);
  },[xml,providerCfg,loading,elapsed]);

  // ── Main edit send ────────────────────────────────────────────────────────
  const sendMessage=useCallback(async(overridePrompt)=>{
    const userMsg=(overridePrompt||input).trim();
    if(!userMsg||loading)return;
    setInput("");
    // Route to query mode if toggled
    if(queryMode&&!overridePrompt){sendQuery(userMsg);return;}
    setMessages(prev=>[...prev,{role:"user",content:userMsg}]);
    setLoading(true);setElapsed(0);
    elapsedRef.current=setInterval(()=>setElapsed(s=>s+1),1000);
    const active=providerCfg.active||"ollama";
    const pCfg=providerCfg[active]||{};
    const summary=buildXMLSummary(xml);
    const bodyCtx=selectedBody?`\nFocus on body "${selectedBody}".`:"";
    const fullPrompt=`${summary?summary+"\n\n":""}${bodyCtx}Current XML:\n${xml}\n\nRequest: ${userMsg}`;
    const recentHistory=chatHistory.slice(-12);
    try{
      const resp=await fetch("http://localhost:8000/edit",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({xml,prompt:fullPrompt,provider:active,model:pCfg.model||undefined,api_key:pCfg.apiKey||undefined,history:recentHistory})});
      if(!resp.ok){const err=await resp.json().catch(()=>({detail:resp.statusText}));throw new Error(err.detail||`Server error ${resp.status}`);}
      const parsed=await resp.json();
      let newXml=parsed.xml||xml;
      const check=validateMuJoCoXML(newXml);
      if(!check.valid&&check.errors.length>0){
        setMessages(prev=>[...prev,{role:"assistant",content:`⚠ Auto-repairing ${check.errors.length} error(s)…`}]);
        newXml=await repairXML(newXml,check.errors,active,pCfg);
        const fc=validateMuJoCoXML(newXml);
        if(fc.valid)showToast("Auto-repair succeeded ✓");else showToast(`${fc.errors.length} errors remain`,"warn");
      }
      const diff=computeDiff(xml,newXml);
      setDiffLines(diff);setXml(newXml);
      pushHistory(newXml,userMsg.slice(0,48));
      setCenterTab("3d");
      const adds=diff.filter(d=>d.type==="add").length,dels=diff.filter(d=>d.type==="remove").length;
      const assistantMsg=`**${parsed.reasoning||"Done"}**\n\n${(parsed.changes||[]).map(c=>`• ${c}`).join("\n")}\n\n*+${adds}/-${dels} lines · ${parsed.model_used||active} · ${elapsed}s*`;
      setMessages(prev=>[...prev,{role:"assistant",content:assistantMsg}]);
      setChatHistory(prev=>[...prev,{role:"user",content:userMsg},{role:"assistant",content:assistantMsg}]);
      showToast(`Updated (+${adds}/-${dels}) · ${elapsed}s`);
    }catch(err){
      setMessages(prev=>[...prev,{role:"assistant",content:`❌ ${err.message}`}]);
      showToast(err.message,"error");
    }
    clearInterval(elapsedRef.current);setLoading(false);
  },[input,xml,loading,historyIdx,providerCfg,chatHistory,selectedBody,elapsed,queryMode]);

  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}};
  const copyXml=()=>{navigator.clipboard.writeText(xml);showToast("Copied!");};
  const downloadXml=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([xml],{type:"text/xml"}));a.download="robot.xml";a.click();};
  const formatTs=ts=>new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const handleBodySelect=name=>{setSelectedBody(s=>s===name?null:name);if(name)setInput(`Modify the "${name}" body: `);setCenterTab("3d");};

  const active=providerCfg.active||"ollama";
  const pInfo=PROVIDERS[active]||PROVIDERS.ollama;
  const xmlLines=xml.split("\n");

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#0a0f1a",fontFamily:"'JetBrains Mono','Fira Code',monospace",color:"#e2e8f0",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#0f172a}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn{cursor:pointer;border:none;outline:none;transition:all 0.15s}.btn:hover{filter:brightness(1.2)}.btn:active{transform:scale(0.97)}
        .tab{background:none;border:none;cursor:pointer;padding:5px 10px;font-family:inherit;font-size:10px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;border-bottom:2px solid transparent;transition:all 0.15s;color:#64748b}
        .tab.on{color:#7dd3fc;border-bottom-color:#7dd3fc}.tab:hover{color:#94a3b8}
        .hist{padding:7px 12px;cursor:pointer;border-left:2px solid transparent;transition:all 0.15s;font-size:11px}
        .hist:hover{background:rgba(125,211,252,0.05);border-left-color:#475569}.hist.on{background:rgba(125,211,252,0.1);border-left-color:#7dd3fc}
        textarea{outline:none;resize:none}
      `}</style>

      {/* HEADER */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:46,background:"#0f172a",borderBottom:"1px solid #1e293b",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:22,height:22,background:"linear-gradient(135deg,#3b82f6,#7c3aed)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>⚙</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:"#f1f5f9"}}>MuJoCo</span>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:"#7dd3fc"}}>XML Editor</span>
          <div style={{width:1,height:14,background:"#1e293b"}}/>
          {/* Provider badge */}
          <div style={{display:"flex",alignItems:"center",gap:5,background:"#1e293b",border:`1px solid ${pInfo.color}44`,borderRadius:6,padding:"2px 9px",cursor:"pointer"}} onClick={()=>setShowSettings(true)}>
            <span style={{fontSize:11}}>{pInfo.icon}</span>
            <span style={{fontSize:11,color:pInfo.color,fontWeight:600}}>{pInfo.label}</span>
            <span style={{fontSize:10,color:"#475569",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{providerCfg[active]?.model||""}</span>
            <span style={{fontSize:9,color:"#334155"}}>▾</span>
          </div>
          {chatHistory.length>0&&(
            <div style={{fontSize:10,color:"#64748b",background:"#1e293b",padding:"2px 7px",borderRadius:4,border:"1px solid #334155"}}>
              💬 {chatHistory.length/2|0}t
              <button onClick={()=>setChatHistory([])} style={{marginLeft:4,background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:10,padding:0}}>✕</button>
            </div>
          )}
          {/* Query mode toggle */}
          <button onClick={()=>setQueryMode(q=>!q)}
            title="Toggle Query Mode — ask questions without editing XML"
            style={{padding:"2px 9px",background:queryMode?"rgba(59,130,246,0.2)":"#1e293b",
              color:queryMode?"#7dd3fc":"#475569",borderRadius:5,fontSize:10,
              border:`1px solid ${queryMode?"#3b82f6":"#334155"}`,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
            {queryMode?"🔍 QUERY":"🔍"}
          </button>
          <div style={{fontSize:10,padding:"2px 7px",borderRadius:4,
            background:validation.valid?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",
            color:validation.valid?"#86efac":"#fca5a5",
            border:`1px solid ${validation.valid?"#166534":"#7f1d1d"}`}}>
            {validation.valid?`✓${validation.warnings.length>0?` ${validation.warnings.length}w`:""}`:
             `✗${validation.errors.length}e`}
          </div>
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          <button className="btn" onClick={()=>setShowMacros(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#eab308",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>⚡ Macros</button>
          <button className="btn" onClick={()=>setShowSnippets(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#a78bfa",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>📦</button>
          <button className="btn" onClick={()=>setShowPython(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#86efac",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>🐍 Python</button>
          <button className="btn" onClick={undo} disabled={historyIdx===0}
            style={{padding:"3px 9px",background:historyIdx===0?"#1e293b":"#1e3a5f",color:historyIdx===0?"#334155":"#7dd3fc",borderRadius:5,fontSize:11,border:"1px solid",borderColor:historyIdx===0?"#1e293b":"#2d5f8a"}}>↩</button>
          <button className="btn" onClick={redo} disabled={historyIdx>=history.length-1}
            style={{padding:"3px 9px",background:historyIdx>=history.length-1?"#1e293b":"#1e3a5f",color:historyIdx>=history.length-1?"#334155":"#7dd3fc",borderRadius:5,fontSize:11,border:"1px solid",borderColor:historyIdx>=history.length-1?"#1e293b":"#2d5f8a"}}>↪</button>
          <button className="btn" onClick={()=>setShowSettings(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#94a3b8",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>⚙</button>
          <button className="btn" onClick={copyXml}
            style={{padding:"3px 9px",background:"#1e293b",color:"#94a3b8",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>⎘</button>
          <button className="btn" onClick={downloadXml}
            style={{padding:"3px 9px",background:"#1e3a5f",color:"#7dd3fc",borderRadius:5,fontSize:11,border:"1px solid #2d5f8a"}}>↓ .xml</button>
        </div>
      </div>

      {/* BODY */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* LEFT: Chat */}
        <div style={{width:305,display:"flex",flexDirection:"column",borderRight:"1px solid #1e293b",background:"#0d1525",flexShrink:0}}>
          <div style={{padding:"6px 12px",borderBottom:"1px solid #1e293b",fontSize:10,color:"#475569",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>Assistant {chatHistory.length>0&&<span style={{color:"#3b82f6"}}>· memory</span>}</span>
            {queryMode&&<span style={{color:"#3b82f6",fontSize:10,fontWeight:700}}>🔍 QUERY MODE</span>}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"9px 11px",display:"flex",flexDirection:"column",gap:7}}>
            {messages.map((msg,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"93%",padding:"7px 10px",borderRadius:10,fontSize:12,lineHeight:1.6,
                  background:msg.role==="user"
                    ?queryMode?"linear-gradient(135deg,#1d3a6e,#3b82f6)":"linear-gradient(135deg,#1d4ed8,#3b82f6)"
                    :"#1e293b",
                  color:msg.role==="user"?"#eff6ff":"#cbd5e1",
                  borderBottomRightRadius:msg.role==="user"?2:10,borderBottomLeftRadius:msg.role==="assistant"?2:10}}>
                  <div dangerouslySetInnerHTML={{__html:
                    msg.content
                      .replace(/\*\*(.*?)\*\*/g,"<strong style='color:#e2e8f0'>$1</strong>")
                      .replace(/\*(.*?)\*/g,"<em style='color:#94a3b8'>$1</em>")
                      .replace(/`(.*?)`/g,"<code style='color:#86efac;background:#0f172a;padding:1px 4px;border-radius:3px'>$1</code>")
                      .replace(/\n/g,"<br/>")}}/>
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",alignItems:"center",gap:8,color:"#64748b",fontSize:12}}>
                <div style={{width:14,height:14,border:"2px solid #334155",borderTopColor:pInfo.color,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                <div>
                  <div>{queryMode?"🔍":"⚙"} {pInfo.icon} {elapsed}s{queryMode?" (query)":""}</div>
                  {elapsed>30&&<div style={{fontSize:10,color:"#334155",marginTop:1}}>CPU mode — please wait…</div>}
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>
          <div style={{padding:"7px 9px",borderTop:"1px solid #1e293b",background:"#0a0f1a"}}>
            {selectedBody&&(
              <div style={{marginBottom:5,padding:"3px 7px",background:"rgba(251,191,36,0.1)",borderRadius:4,border:"1px solid rgba(251,191,36,0.2)",fontSize:11,color:"#fbbf24",display:"flex",justifyContent:"space-between"}}>
                <span>🟡 {selectedBody}</span>
                <button onClick={()=>{setSelectedBody(null);setInput(i=>i.replace(/^Modify the ".*?" body: /,""));}} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:11}}>✕</button>
              </div>
            )}
            <div style={{display:"flex",gap:5,alignItems:"flex-end"}}>
              <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={queryMode?"Ask a question about the robot…":"Describe a change…"} rows={3}
                style={{flex:1,background:"#1e293b",border:`1px solid ${queryMode?"#3b82f6":"#334155"}`,borderRadius:8,color:"#e2e8f0",padding:"6px 8px",fontSize:12,lineHeight:1.5,fontFamily:"inherit",minHeight:56}}/>
              <button className="btn" onClick={()=>sendMessage()} disabled={loading||!input.trim()}
                style={{padding:"6px 9px",background:loading||!input.trim()?"#1e293b":queryMode?"#3b82f6":pInfo.color,
                  color:loading||!input.trim()?"#334155":"#fff",borderRadius:8,fontSize:18,border:"none",height:56,width:40,opacity:loading||!input.trim()?0.4:1}}>
                {loading?"…":queryMode?"?":"↑"}
              </button>
            </div>
            <div style={{marginTop:3,fontSize:10,color:"#334155"}}>Enter · Shift+Enter newline{queryMode?" · query mode — no XML edit":""}</div>
          </div>
        </div>

        {/* CENTER */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid #1e293b",background:"#0f172a",padding:"0 12px",height:36,flexShrink:0,gap:2}}>
            <button className={`tab ${centerTab==="editor"?"on":""}`} onClick={()=>setCenterTab("editor")}>◉ XML</button>
            <button className={`tab ${centerTab==="diff"?"on":""}`} onClick={()=>setCenterTab("diff")}>
              ± Diff {diffLines.filter(d=>d.type!=="same").length>0&&
                <span style={{background:"#1e3a5f",color:"#7dd3fc",borderRadius:3,padding:"1px 4px",marginLeft:3,fontSize:9}}>
                  {diffLines.filter(d=>d.type!=="same").length}
                </span>}
            </button>
            <button className={`tab ${centerTab==="3d"?"on":""}`} onClick={()=>setCenterTab("3d")}>
              ◈ 3D{!validation.valid&&<span style={{marginLeft:2,color:"#fca5a5",fontSize:9}}>!</span>}
            </button>
            {/* 3D controls (only shown in 3D tab) */}
            {centerTab==="3d"&&(
              <div style={{marginLeft:8,display:"flex",gap:5}}>
                <button onClick={()=>setShowAxes(a=>!a)}
                  style={{padding:"2px 8px",background:showAxes?"rgba(239,68,68,0.15)":"#1e293b",
                    color:showAxes?"#ef4444":"#475569",borderRadius:4,fontSize:10,
                    border:`1px solid ${showAxes?"#7f1d1d":"#334155"}`,cursor:"pointer",fontFamily:"inherit"}}>
                  🎯 Axes
                </button>
                <button onClick={()=>setSimulating(s=>!s)}
                  style={{padding:"2px 8px",background:simulating?"rgba(34,197,94,0.15)":"#1e293b",
                    color:simulating?"#86efac":"#475569",borderRadius:4,fontSize:10,
                    border:`1px solid ${simulating?"#166534":"#334155"}`,cursor:"pointer",fontFamily:"inherit"}}>
                  {simulating?"⏹ Stop":"▶ Simulate"}
                </button>
              </div>
            )}
            <div style={{marginLeft:"auto",fontSize:10,color:"#334155"}}>{xmlLines.length}ln</div>
          </div>

          {centerTab==="editor"&&(
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
              <div style={{flex:1,overflow:"hidden",position:"relative"}}>
                <div style={{position:"absolute",inset:0,display:"flex",overflow:"auto"}}>
                  <div style={{flexShrink:0,padding:"12px 0",background:"#0a0f1a",borderRight:"1px solid #1e293b",userSelect:"none",minWidth:40,textAlign:"right"}}>
                    {xmlLines.map((_,i)=><div key={i} style={{padding:"0 6px 0 4px",lineHeight:"20px",fontSize:10,color:"#334155"}}>{i+1}</div>)}
                  </div>
                  <div style={{flex:1,position:"relative"}}>
                    <div style={{position:"absolute",inset:0,padding:"12px 12px",fontSize:12,lineHeight:"20px",pointerEvents:"none",whiteSpace:"pre",fontFamily:"inherit",color:"transparent",overflow:"hidden"}}>
                      <div dangerouslySetInnerHTML={{__html:highlightXML(xml)}} style={{color:"inherit"}}/>
                    </div>
                    <textarea value={xml} onChange={e=>{setXml(e.target.value);setDiffLines([]);}} spellCheck={false}
                      style={{position:"absolute",inset:0,width:"100%",height:"100%",background:"transparent",border:"none",color:"#e2e8f0",caretColor:"#7dd3fc",padding:"12px 12px",fontSize:12,lineHeight:"20px",fontFamily:"inherit",whiteSpace:"pre",overflowWrap:"normal",overflowX:"auto"}}/>
                  </div>
                </div>
              </div>
              <ValidationPanel result={validation}/>
            </div>
          )}

          {centerTab==="diff"&&(
            <div style={{flex:1,overflow:"auto"}}>
              {diffLines.length===0
                ?<div style={{padding:32,color:"#334155",fontSize:12,textAlign:"center"}}>No diff yet — send a prompt to see changes</div>
                :<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <tbody>{diffLines.map((line,i)=>(
                    <tr key={i} style={{background:line.type==="add"?"rgba(34,197,94,0.07)":line.type==="remove"?"rgba(239,68,68,0.07)":"transparent"}}>
                      <td style={{width:36,padding:"0 5px",color:"#334155",textAlign:"right",userSelect:"none",borderRight:"1px solid #1e293b"}}>{line.num}</td>
                      <td style={{width:14,padding:"0 5px",color:line.type==="add"?"#86efac":line.type==="remove"?"#fca5a5":"#475569",userSelect:"none"}}>{line.type==="add"?"+":line.type==="remove"?"−":" "}</td>
                      <td style={{padding:"0 10px",color:line.type==="same"?"#475569":"#e2e8f0",whiteSpace:"pre",fontFamily:"inherit",lineHeight:"20px"}}>{line.line}</td>
                    </tr>
                  ))}</tbody>
                </table>}
            </div>
          )}

          {centerTab==="3d"&&(
            <div style={{flex:1,overflow:"hidden",position:"relative"}}>
              <RobotViewer validationResult={validation} selectedBody={selectedBody} showAxes={showAxes} simulating={simulating}/>
              {!validation.valid&&(
                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(10,15,26,0.92)",borderTop:"1px solid #7f1d1d",padding:"6px 14px",maxHeight:80,overflowY:"auto"}}>
                  {validation.errors.map((e,i)=><div key={i} style={{color:"#fca5a5",fontSize:11,marginBottom:2}}>✗ {e}</div>)}
                  {validation.warnings.map((w,i)=><div key={i} style={{color:"#fde68a",fontSize:11,marginBottom:2}}>⚠ {w}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{width:242,display:"flex",flexDirection:"column",borderLeft:"1px solid #1e293b",background:"#0d1525",flexShrink:0}}>
          <div style={{display:"flex",borderBottom:"1px solid #1e293b",height:36}}>
            <button className={`tab ${panel==="tree"?"on":""}`}    style={{flex:1}} onClick={()=>setPanel("tree")}>Tree</button>
            <button className={`tab ${panel==="history"?"on":""}`} style={{flex:1}} onClick={()=>setPanel("history")}>Hist</button>
            <button className={`tab ${panel==="info"?"on":""}`}    style={{flex:1}} onClick={()=>setPanel("info")}>Info</button>
          </div>

          {panel==="tree"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <div style={{padding:"5px 10px",fontSize:10,color:"#334155",letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:"1px solid #0f172a"}}>
                {[...(validation.doc?.querySelectorAll("body")||[])].length} bodies
                {selectedBody&&<span style={{color:"#fbbf24",marginLeft:5}}>· {selectedBody}</span>}
              </div>
              {bodyTree.length===0
                ?<div style={{padding:14,fontSize:11,color:"#334155"}}>No bodies found</div>
                :bodyTree.map(node=><BodyTreeNode key={node.name} node={node} onSelect={handleBodySelect} selected={selectedBody}/>)}
              {validation.doc&&[...validation.doc.querySelectorAll("actuator > *")].length>0&&(
                <div style={{padding:"7px 10px",borderTop:"1px solid #1e293b",marginTop:3}}>
                  <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Actuators</div>
                  {[...validation.doc.querySelectorAll("actuator > *")].map((a,i)=>(
                    <div key={i} style={{fontSize:11,color:"#64748b",padding:"2px 4px",display:"flex",gap:5}}>
                      <span style={{color:"#f97316",fontSize:9,marginTop:2}}>▶</span>
                      <span>{a.getAttribute("name")||"?"}</span>
                      <span style={{color:"#334155",marginLeft:"auto"}}>→{a.getAttribute("joint")||"?"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {panel==="history"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <div style={{padding:"5px 12px",fontSize:10,color:"#334155",letterSpacing:"0.06em",textTransform:"uppercase"}}>{history.length} version{history.length!==1?"s":""}</div>
              {[...history].reverse().map((entry,ri)=>{
                const idx=history.length-1-ri,isCurrent=idx===historyIdx;
                return(
                  <div key={idx} className={`hist ${isCurrent?"on":""}`} onClick={()=>applyVersion(idx)}>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                      <div style={{width:5,height:5,borderRadius:"50%",flexShrink:0,background:isCurrent?"#7dd3fc":idx===0?"#a78bfa":"#3b82f6"}}/>
                      <span style={{color:isCurrent?"#7dd3fc":"#94a3b8",fontSize:11,fontWeight:isCurrent?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.label}</span>
                    </div>
                    <div style={{paddingLeft:10,fontSize:10,color:"#334155"}}>{formatTs(entry.ts)} · {entry.xml.split("\n").length}ln</div>
                  </div>
                );
              })}
            </div>
          )}

          {panel==="info"&&(
            <div style={{flex:1,overflowY:"auto",padding:"9px"}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:7,letterSpacing:"0.06em",textTransform:"uppercase"}}>Quick Prompts</div>
              {["Add an arm with 3 joints","Add a camera sensor","Make all geoms red","Add a ball on floor",
                "Double hip actuator gear","Add touch sensors","Add a second robot 2m right",
                "Remove all actuators","Change torso to sphere","Add wrist to the arm",
              ].map((ex,i)=>(
                <div key={i} onClick={()=>setInput(ex)}
                  style={{padding:"5px 7px",background:"#1e293b",borderRadius:5,fontSize:11,color:"#94a3b8",marginBottom:4,cursor:"pointer",border:"1px solid #334155",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#253451";e.currentTarget.style.color="#cbd5e1";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#1e293b";e.currentTarget.style.color="#94a3b8";}}>
                  {ex}
                </div>
              ))}
              <div style={{marginTop:10,fontSize:10,color:"#475569",marginBottom:7,letterSpacing:"0.06em",textTransform:"uppercase"}}>Query Examples</div>
              {["How many DOF does this robot have?","Which joints have no actuator?","What is the total mass?","Is the robot symmetric?","List all sensor names",
              ].map((ex,i)=>(
                <div key={i} onClick={()=>{setQueryMode(true);setInput(ex);}}
                  style={{padding:"5px 7px",background:"rgba(59,130,246,0.08)",borderRadius:5,fontSize:11,color:"#7dd3fc",marginBottom:4,cursor:"pointer",border:"1px solid #1e3a5f",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(59,130,246,0.15)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(59,130,246,0.08)";}}>
                  🔍 {ex}
                </div>
              ))}
            </div>
          )}

          <div style={{padding:"6px 12px",borderTop:"1px solid #1e293b",fontSize:10,color:"#334155",display:"flex",justifyContent:"space-between"}}>
            <span>v{historyIdx+1}/{history.length}</span>
            <span style={{color:validation.valid?"#166534":"#7f1d1d"}}>{validation.valid?"✓":"✗"} {showAxes?"🎯":""}{simulating?"▶":""}</span>
          </div>
        </div>
      </div>

      {showSettings&&<SettingsModal onClose={()=>setShowSettings(false)} providerCfg={providerCfg} setProviderCfg={setProviderCfg} ollamaModels={ollamaModels} ollamaStatus={ollamaStatus}/>}
      {showSnippets&&<SnippetModal onClose={()=>setShowSnippets(false)} onInsert={insertSnippet} customSnippets={customSnippets} setCustomSnippets={setCustomSnippets}/>}
      {showMacros&&<MacroModal onClose={()=>setShowMacros(false)} onRun={p=>{setQueryMode(false);sendMessage(p);}} customMacros={customMacros} setCustomMacros={setCustomMacros}/>}
      {showPython&&<PythonExportModal onClose={()=>setShowPython(false)} xml={xml}/>}
      {toast&&<Toast message={toast.message} type={toast.type} onDone={()=>setToast(null)}/>}
    </div>
  );
}
