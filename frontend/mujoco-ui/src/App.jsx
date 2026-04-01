import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { validateMuJoCoXML } from "./utils/xmlValidator";
import { computeDiff } from "./utils/xmlDiff";
import { buildXMLSummary } from "./utils/xmlSummary";
import { parseBodyTree } from "./utils/bodyTreeParser";
import { highlightXML } from "./utils/highlightXML";

import ChatPanel from "./components/ChatPanel"
import RobotViewer from "./components/RobotViewer"
import XMLViewer from "./components/XMLViewer"
import DiffViewer from "./components/DiffViewer"
import BodyTreeNode from "./components/BodyTree"
import { Toast } from "./components/Toast";
import { ValidationPanel } from "./components/ValidationPanel"; 

import InfoPanel from "./panels/InfoPanel"
import HistoryPanel from "./panels/HistoryPanel"

import SnippetModal from "./modals/SnippetModal"
import MacroModal from "./modals/MacroModal"
import SettingsModal from "./modals/SettingsModal"
import PythonExportModal from "./modals/PythonExportModal"


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
// THREE.JS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const pv=(s,d=[0,0,0])=>{if(!s)return d;const n=s.trim().split(/\s+/).map(Number);return n.length>=3?[n[0],n[1],n[2]]:d;};
const psz=s=>{if(!s)return[0.1,0.1,0.1];return s.trim().split(/\s+/).map(Number);};
const prgba=s=>{if(!s)return 0x4a9fd4;const[r,g,b]=s.trim().split(/\s+/).map(Number);return((Math.round(r*255)<<16)|(Math.round(g*255)<<8)|Math.round(b*255));};
const dtr=d=>d*Math.PI/180;
const peu=s=>{if(!s)return[0,0,0];return s.trim().split(/\s+/).map(v=>dtr(parseFloat(v)||0));};


// ── WASM Physics simulation ───────────────────────────────────────────────────





// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT + DIFF + TOAST
// ─────────────────────────────────────────────────────────────────────────────



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
            <XMLViewer xml={xml} setXml={setXml} setDiffLines={setDiffLines} validation={validation}/>
          )}

          {centerTab==="diff"&&(
            <DiffViewer diffLines={diffLines} />
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
