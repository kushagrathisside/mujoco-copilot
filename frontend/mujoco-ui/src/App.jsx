import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { downloadActivityLog, logAction } from "./api/activityLog";
import BodyTreeNode from "./components/BodyTree";
import DiffViewer from "./components/DiffViewer";
import RobotViewer from "./components/RobotViewer";
import { Toast } from "./components/Toast";
import XMLViewer from "./components/XMLViewer";
import { DEFAULT_XML, PROVIDERS, loadStoredConfig } from "./editorConfig";
import AboutDeveloperModal from "./modals/AboutDeveloperModal";
import MacroModal from "./modals/MacroModal";
import PythonExportModal from "./modals/PythonExportModal";
import SettingsModal from "./modals/SettingsModal";
import SnippetModal from "./modals/SnippetModal";
import UserManualModal from "./modals/UserManualModal";
import { parseBodyTree } from "./utils/bodyTreeParser";
import { computeDiff } from "./utils/xmlDiff";
import { buildXMLSummary } from "./utils/xmlSummary";
import { validateMuJoCoXML } from "./utils/xmlValidator";

const EMPTY_PROCESSING = {mode:null,title:"",detail:"",steps:[]};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function MuJoCoEditor(){
  const [xml,setXml]             = useState(DEFAULT_XML);
  const [input,setInput]         = useState("");
  const [messages,setMessages]   = useState([{role:"assistant",content:"Hello! I'm mujoco-copilot.\n\n**New:** ⚡ Macros · 🐍 Python export · 🎯 Joint axis arrows · ▶ Kinematic sim\n\n**How to use:** `↑` edits the XML. `QUERY` or `?` answers questions only.\n\nTry a macro, a quick prompt, or ask about DOF, mass, joints, or sensors."}]);
  const [chatHistory,setChatHistory] = useState([]);
  const [history,setHistory]     = useState([{xml:DEFAULT_XML,label:"Initial state",ts:Date.now()}]);
  const [historyIdx,setHistIdx]  = useState(0);
  const [loading,setLoading]     = useState(false);
  const [elapsed,setElapsed]     = useState(0);
  const elapsedRef               = useRef(null);
  const stageTimersRef           = useRef([]);
  const [processing,setProcessing] = useState(EMPTY_PROCESSING);
  const [diffLines,setDiffLines] = useState([]);
  const [toast,setToast]         = useState(null);
  const [panel,setPanel]         = useState("tree");
  const [centerTab,setCenterTab] = useState("editor");
  const [showSettings,setShowSettings]   = useState(false);
  const [showSnippets,setShowSnippets]   = useState(false);
  const [showMacros,setShowMacros]       = useState(false);
  const [showPython,setShowPython]       = useState(false);
  const [showManual,setShowManual]       = useState(false);
  const [showAbout,setShowAbout]         = useState(false);
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
  const didLogOpenRef = useRef(false);

  const validation = useMemo(()=>validateMuJoCoXML(xml),[xml]);
  const bodyTree   = useMemo(()=>parseBodyTree(validation.doc),[validation.doc]);
  const xmlStats=useCallback((value=xml)=>({
    chars:value.length,
    lines:value.split("\n").length,
    valid:validateMuJoCoXML(value).valid,
  }),[xml]);

  const clearStageTimers=useCallback(()=>{
    stageTimersRef.current.forEach(timer=>clearTimeout(timer));
    stageTimersRef.current=[];
  },[]);
  const startProcessing=useCallback((mode,title,detail="")=>{
    clearStageTimers();
    setProcessing({mode,title,detail,steps:[{title,detail,status:"active"}]});
  },[clearStageTimers]);
  const advanceProcessing=useCallback((title,detail="")=>{
    setProcessing(prev=>{
      if(!prev.mode)return prev;
      const completed=prev.steps.map((step,i)=>i===prev.steps.length-1?{...step,status:"done"}:step);
      return {...prev,title,detail,steps:[...completed,{title,detail,status:"active"}].slice(-5)};
    });
  },[]);
  const scheduleProcessingStage=useCallback((delay,title,detail="")=>{
    const timer=setTimeout(()=>advanceProcessing(title,detail),delay);
    stageTimersRef.current.push(timer);
  },[advanceProcessing]);
  const finishProcessing=useCallback(()=>{
    clearStageTimers();
    setProcessing(EMPTY_PROCESSING);
  },[clearStageTimers]);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>()=>clearStageTimers(),[clearStageTimers]);
  useEffect(()=>{
    if(didLogOpenRef.current)return;
    didLogOpenRef.current=true;
    logAction("app_opened",{xml:xmlStats(),provider:providerCfg.active||"ollama"});
  },[providerCfg.active,xmlStats]);
  useEffect(()=>{
    fetch("http://localhost:8000/ollama/models")
      .then(r=>r.json()).then(d=>{setOllamaModels(d.models||[]);setOllamaStatus(true);})
      .catch(()=>setOllamaStatus(false));
  },[]);
  useEffect(()=>{
    const seenManual = localStorage.getItem("mujoco_manual_seen");
    if (!seenManual) {
      setShowManual(true);
    }
  },[]);

  const showToast=(msg,type="success")=>setToast({message:msg,type});
  const closeManual=()=>{
    logAction("manual_closed");
    localStorage.setItem("mujoco_manual_seen","true");
    setShowManual(false);
  };
  const applyVersion=idx=>{
    const entry=history[idx];
    logAction("history_version_restored",{index:idx,label:entry?.label,xml:entry?xmlStats(entry.xml):null});
    setXml(entry.xml);setHistIdx(idx);setDiffLines([]);setCenterTab("editor");
  };
  const pushHistory=useCallback((newXml,label)=>{
    setHistory(prev=>[...prev.slice(0,historyIdx+1),{xml:newXml,label,ts:Date.now()}]);
    setHistIdx(historyIdx+1);
  },[historyIdx]);
  const undo=()=>{if(historyIdx>0)applyVersion(historyIdx-1);};
  const redo=()=>{if(historyIdx<history.length-1)applyVersion(historyIdx+1);};

  const insertSnippet=useCallback((snippetXml)=>{
    const ins=`\n  <!-- Snippet -->\n  ${snippetXml.replace(/\n/g,"\n  ")}\n`;
    const idx=xml.lastIndexOf("</worldbody>");
    const newXml=idx>=0?xml.slice(0,idx)+ins+xml.slice(idx):xml+ins;
    logAction("snippet_inserted",{snippet_chars:snippetXml.length,before:xmlStats(xml),after:xmlStats(newXml)});
    setXml(newXml);pushHistory(newXml,"Snippet inserted");showToast("Snippet inserted");
  },[xml,pushHistory,xmlStats]);

  const repairXML=useCallback(async(badXml,errors,provider,pCfg,attempt=1)=>{
    if(attempt>3)return badXml;
    const repairPrompt=`Fix ALL validation errors in this MuJoCo XML:\nErrors:\n${errors.map(e=>`- ${e}`).join("\n")}\n\nXML:\n${badXml}`;
    try{
      const resp=await fetch("http://localhost:8000/edit",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          xml:badXml,
          prompt:repairPrompt,
          provider,
          model:pCfg?.model,
          api_key:pCfg?.apiKey,
          ollama_timeout_seconds:pCfg?.ollamaTimeoutSeconds,
          ollama_num_predict:pCfg?.ollamaNumPredict,
        })});
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
    const requestStartedAt=Date.now();
    setInput("");
    setMessages(prev=>[...prev,{role:"user",content:`🔍 ${q}`}]);
    setLoading(true);setElapsed(0);
    if(elapsedRef.current)clearInterval(elapsedRef.current);
    elapsedRef.current=setInterval(()=>setElapsed(s=>s+1),1000);
    const active=providerCfg.active||"ollama";
    const pCfg=providerCfg[active]||{};
    const providerInfo=PROVIDERS[active]||PROVIDERS.ollama;
    startProcessing("query","Preparing question","Building read-only robot context");
    const summary=buildXMLSummary(xml);
    const queryPrompt=`You are a MuJoCo expert. Answer this question about the robot — do NOT modify the XML, just answer clearly and concisely.\n\n${summary}\n\nFull XML:\n${xml}\n\nQuestion: ${q}`;
    logAction("query_submitted",{provider:active,model:pCfg.model,prompt_chars:q.length,xml:xmlStats()});
    try{
      advanceProcessing("Generating answer",`${providerInfo.label}${pCfg.model?` · ${pCfg.model}`:""}`);
      scheduleProcessingStage(10000,"Still generating","Waiting for the provider response");
      const resp=await fetch("http://localhost:8000/query",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          prompt:queryPrompt,
          provider:active,
          model:pCfg.model,
          api_key:pCfg.apiKey,
          ollama_timeout_seconds:pCfg?.ollamaTimeoutSeconds,
          ollama_num_predict:pCfg?.ollamaNumPredict,
        })});
      advanceProcessing("Reading answer","Formatting assistant response");
      const data=await resp.json();
      const elapsedSeconds=getRequestElapsedSeconds(requestStartedAt);
      logAction("query_completed",{provider:active,model:pCfg.model,answer_chars:(data.answer||"").length});
      setMessages(prev=>[...prev,{role:"assistant",content:`**Answer:** ${data.answer||data.detail||"No response"}\n\n*${elapsedSeconds}s · ${active}*`}]);
    }catch(err){
      logAction("query_failed",{provider:active,model:pCfg.model,error:err.message});
      setMessages(prev=>[...prev,{role:"assistant",content:`❌ ${err.message}`}]);
    }
    clearInterval(elapsedRef.current);finishProcessing();setLoading(false);
  },[xml,providerCfg,loading,xmlStats,startProcessing,advanceProcessing,scheduleProcessingStage,finishProcessing]);

  // ── Main edit send ────────────────────────────────────────────────────────
  const sendMessage=useCallback(async(overridePrompt)=>{
    const userMsg=(overridePrompt||input).trim();
    if(!userMsg||loading)return;
    const requestStartedAt=Date.now();
    setInput("");
    // Route to query mode if toggled
    if(queryMode&&!overridePrompt){sendQuery(userMsg);return;}
    setMessages(prev=>[...prev,{role:"user",content:userMsg}]);
    setLoading(true);setElapsed(0);
    if(elapsedRef.current)clearInterval(elapsedRef.current);
    elapsedRef.current=setInterval(()=>setElapsed(s=>s+1),1000);
    const active=providerCfg.active||"ollama";
    const pCfg=providerCfg[active]||{};
    const providerInfo=PROVIDERS[active]||PROVIDERS.ollama;
    startProcessing("edit","Preparing edit","Building XML summary and request context");
    const summary=buildXMLSummary(xml);
    const bodyCtx=selectedBody?`\nFocus on body "${selectedBody}".`:"";
    const fullPrompt=`${summary?summary+"\n\n":""}${bodyCtx}Current XML:\n${xml}\n\nRequest: ${userMsg}`;
    const recentHistory=chatHistory.slice(-12);
    logAction("edit_submitted",{provider:active,model:pCfg.model,prompt_chars:userMsg.length,selected_body:selectedBody,history_count:recentHistory.length,xml:xmlStats()});
    try{
      advanceProcessing("Generating XML",`${providerInfo.label}${pCfg.model?` · ${pCfg.model}`:""}`);
      scheduleProcessingStage(10000,"Waiting for model","The model is composing an MJCF update");
      scheduleProcessingStage(30000,"Long-running generation","Large XML or local CPU inference can take longer");
      const resp=await fetch("http://localhost:8000/edit",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          xml,
          prompt:fullPrompt,
          provider:active,
          model:pCfg.model||undefined,
          api_key:pCfg.apiKey||undefined,
          ollama_timeout_seconds:pCfg?.ollamaTimeoutSeconds,
          ollama_num_predict:pCfg?.ollamaNumPredict,
          history:recentHistory,
        })});
      if(!resp.ok){const err=await resp.json().catch(()=>({detail:resp.statusText}));throw new Error(err.detail||`Server error ${resp.status}`);}
      advanceProcessing("Receiving response","Backend parsing and MJCF validation completed");
      const parsed=await resp.json();
      advanceProcessing("Applying validated XML","Checking the result in the browser");
      let newXml=parsed.xml||xml;
      const check=validateMuJoCoXML(newXml);
      if(!check.valid&&check.errors.length>0){
        advanceProcessing("Auto-repairing XML",`${check.errors.length} frontend validation issue(s) found`);
        setMessages(prev=>[...prev,{role:"assistant",content:`⚠ Auto-repairing ${check.errors.length} error(s)…`}]);
        newXml=await repairXML(newXml,check.errors,active,pCfg);
        const fc=validateMuJoCoXML(newXml);
        if(fc.valid)showToast("Auto-repair succeeded ✓");else showToast(`${fc.errors.length} errors remain`,"warn");
      }
      advanceProcessing("Updating workspace","Computing diff, history, and preview state");
      const diff=computeDiff(xml,newXml);
      setDiffLines(diff);setXml(newXml);
      pushHistory(newXml,userMsg.slice(0,48));
      setCenterTab("3d");
      const elapsedSeconds=getRequestElapsedSeconds(requestStartedAt);
      const adds=diff.filter(d=>d.type==="add").length,dels=diff.filter(d=>d.type==="remove").length;
      logAction("edit_completed",{provider:active,model:pCfg.model,strategy:parsed.strategy,adds,dels,changes_count:(parsed.changes||[]).length,before:xmlStats(xml),after:xmlStats(newXml)});
      const assistantMsg=`**${parsed.reasoning||"Done"}**\n\n${(parsed.changes||[]).map(c=>`• ${c}`).join("\n")}\n\n*+${adds}/-${dels} lines · ${parsed.model_used||active} · ${elapsedSeconds}s*`;
      setMessages(prev=>[...prev,{role:"assistant",content:assistantMsg}]);
      setChatHistory(prev=>[...prev,{role:"user",content:userMsg},{role:"assistant",content:assistantMsg}]);
      showToast(`Updated (+${adds}/-${dels}) · ${elapsedSeconds}s`);
    }catch(err){
      logAction("edit_failed",{provider:active,model:pCfg.model,error:err.message,prompt_chars:userMsg.length,xml:xmlStats()});
      setMessages(prev=>[...prev,{role:"assistant",content:`❌ ${err.message}`}]);
      showToast(err.message,"error");
    }
    clearInterval(elapsedRef.current);finishProcessing();setLoading(false);
  },[input,xml,loading,providerCfg,chatHistory,selectedBody,queryMode,pushHistory,repairXML,sendQuery,xmlStats,startProcessing,advanceProcessing,scheduleProcessingStage,finishProcessing]);

  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}};
  const copyXml=()=>{logAction("xml_copied",{xml:xmlStats()});navigator.clipboard.writeText(xml);showToast("Copied!");};
  const downloadXml=()=>{logAction("xml_downloaded",{xml:xmlStats()});const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([xml],{type:"text/xml"}));a.download="robot.xml";a.click();};
  const downloadLog=async()=>{
    try{
      await logAction("activity_log_download_requested",{history_count:history.length,xml:xmlStats()});
      await downloadActivityLog();
      showToast("Activity log downloaded");
    }catch(err){
      showToast(err.message,"error");
    }
  };
  const getRequestElapsedSeconds=(startedAt)=>Math.max(1, Math.round((Date.now()-startedAt)/1000));
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
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:"#f1f5f9"}}>mujoco-</span>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:"#7dd3fc"}}>copilot</span>
          <div style={{width:1,height:14,background:"#1e293b"}}/>
          {/* Provider badge */}
          <div title="Provider Settings: open provider and model settings for the current AI service." style={{display:"flex",alignItems:"center",gap:5,background:"#1e293b",border:`1px solid ${pInfo.color}44`,borderRadius:6,padding:"2px 9px",cursor:"pointer"}} onClick={()=>setShowSettings(true)}>
            <span style={{fontSize:11}}>{pInfo.icon}</span>
            <span style={{fontSize:11,color:pInfo.color,fontWeight:600}}>{pInfo.label}</span>
            <span style={{fontSize:10,color:"#475569",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{providerCfg[active]?.model||""}</span>
            <span style={{fontSize:9,color:"#334155"}}>▾</span>
          </div>
          {chatHistory.length>0&&(
            <div style={{fontSize:10,color:"#64748b",background:"#1e293b",padding:"2px 7px",borderRadius:4,border:"1px solid #334155"}}>
              💬 {chatHistory.length/2|0}t
              <button title="Clear Memory: remove the recent conversation context for future AI requests." onClick={()=>setChatHistory([])} style={{marginLeft:4,background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:10,padding:0}}>✕</button>
            </div>
          )}
          {/* Query mode toggle */}
          <button onClick={()=>setQueryMode(q=>!q)}
            title={queryMode?"Edit Mode: switch back to XML editing so prompts can change the robot.":"Query Mode: ask questions about the robot without changing the XML."}
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
          <button className="btn" title="User Manual: open the quick start guide for new users." onClick={()=>setShowManual(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#7dd3fc",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>📘 Manual</button>
          <button className="btn" title="About Developer: open the developer profile page." onClick={()=>setShowAbout(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#94a3b8",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>ℹ About</button>
          <button className="btn" title="Macros: open reusable edit prompts for common MuJoCo changes." onClick={()=>setShowMacros(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#eab308",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>⚡ Macros</button>
          <button className="btn" title="Snippet Library: insert saved XML building blocks into the current model." onClick={()=>setShowSnippets(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#a78bfa",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>📦</button>
          <button className="btn" title="Python Export: generate a Python simulation script from the current XML." onClick={()=>setShowPython(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#86efac",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>🐍 Python</button>
          <button className="btn" title="Undo: restore the previous XML version from history." onClick={undo} disabled={historyIdx===0}
            style={{padding:"3px 9px",background:historyIdx===0?"#1e293b":"#1e3a5f",color:historyIdx===0?"#334155":"#7dd3fc",borderRadius:5,fontSize:11,border:"1px solid",borderColor:historyIdx===0?"#1e293b":"#2d5f8a"}}>↩</button>
          <button className="btn" title="Redo: reapply the next XML version from history." onClick={redo} disabled={historyIdx>=history.length-1}
            style={{padding:"3px 9px",background:historyIdx>=history.length-1?"#1e293b":"#1e3a5f",color:historyIdx>=history.length-1?"#334155":"#7dd3fc",borderRadius:5,fontSize:11,border:"1px solid",borderColor:historyIdx>=history.length-1?"#1e293b":"#2d5f8a"}}>↪</button>
          <button className="btn" title="Settings: manage providers, API keys, and model selection." onClick={()=>setShowSettings(true)}
            style={{padding:"3px 9px",background:"#1e293b",color:"#94a3b8",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>⚙</button>
          <button className="btn" title="Copy XML: copy the current MuJoCo XML to the clipboard." onClick={copyXml}
            style={{padding:"3px 9px",background:"#1e293b",color:"#94a3b8",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>⎘</button>
          <button className="btn" title="Download Activity Log: save a JSONL history of major app actions for analysis or GPT troubleshooting." onClick={downloadLog}
            style={{padding:"3px 9px",background:"#1e293b",color:"#fbbf24",borderRadius:5,fontSize:11,border:"1px solid #334155"}}>↓ log</button>
          <button className="btn" title="Download XML: save the current robot model as an XML file." onClick={downloadXml}
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
              <div style={{display:"flex",alignItems:"flex-start",gap:8,color:"#64748b",fontSize:12}}>
                <div style={{width:14,height:14,border:"2px solid #334155",borderTopColor:pInfo.color,borderRadius:"50%",animation:"spin 0.8s linear infinite",marginTop:2,flexShrink:0}}/>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span>{queryMode?"🔍":"⚙"} {pInfo.icon} {elapsed}s{queryMode?" (query)":""}</span>
                    {processing.title&&<span style={{color:pInfo.color,fontWeight:600}}>{processing.title}</span>}
                  </div>
                  {processing.detail&&<div style={{fontSize:10,color:"#64748b",marginTop:2,lineHeight:1.45}}>{processing.detail}</div>}
                  {processing.steps.length>1&&(
                    <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:5}}>
                      {processing.steps.map((step,i)=>(
                        <div key={`${step.title}-${i}`} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:step.status==="done"?"#475569":pInfo.color,lineHeight:1.35}}>
                          <span style={{width:10,display:"inline-block",color:step.status==="done"?"#166534":pInfo.color}}>{step.status==="done"?"✓":"•"}</span>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{step.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {elapsed>30&&<div style={{fontSize:10,color:"#334155",marginTop:4}}>CPU mode or large model — please wait…</div>}
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>
	          <div style={{padding:"7px 9px",borderTop:"1px solid #1e293b",background:"#0a0f1a"}}>
	            <div style={{marginBottom:6,padding:"5px 7px",background:queryMode?"rgba(59,130,246,0.08)":"rgba(34,197,94,0.08)",border:"1px solid",borderColor:queryMode?"#1e3a5f":"#166534",borderRadius:6,fontSize:10,lineHeight:1.5,color:queryMode?"#7dd3fc":"#86efac"}}>
	              {queryMode
	                ? "QUERY mode: ask about DOF, mass, joints, sensors, or structure. The XML will not change."
	                : "EDIT mode: describe a change to the robot or scene, then send with ↑ to update the XML."}
	            </div>
	            {selectedBody&&(
	              <div style={{marginBottom:5,padding:"3px 7px",background:"rgba(251,191,36,0.1)",borderRadius:4,border:"1px solid rgba(251,191,36,0.2)",fontSize:11,color:"#fbbf24",display:"flex",justifyContent:"space-between"}}>
	                <span>🟡 {selectedBody}</span>
                <button title="Clear Body Focus: stop targeting this selected body in edit prompts." onClick={()=>{setSelectedBody(null);setInput(i=>i.replace(/^Modify the ".*?" body: /,""));}} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:11}}>✕</button>
              </div>
            )}
            <div style={{display:"flex",gap:5,alignItems:"flex-end"}}>
              <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={queryMode?"Ask a question about the robot…":"Describe a change…"} rows={3}
                style={{flex:1,background:"#1e293b",border:`1px solid ${queryMode?"#3b82f6":"#334155"}`,borderRadius:8,color:"#e2e8f0",padding:"6px 8px",fontSize:12,lineHeight:1.5,fontFamily:"inherit",minHeight:56}}/>
              <button className="btn" title={queryMode?"Ask Question: send this prompt as a read-only question about the robot.":"Send Edit: ask the AI to modify the XML using this prompt."} onClick={()=>sendMessage()} disabled={loading||!input.trim()}
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
            <button className={`tab ${centerTab==="editor"?"on":""}`} title="XML Editor: view and directly edit the current MuJoCo XML." onClick={()=>setCenterTab("editor")}>◉ XML</button>
            <button className={`tab ${centerTab==="diff"?"on":""}`} title="Diff View: compare the latest XML changes line by line." onClick={()=>setCenterTab("diff")}>
              ± Diff {diffLines.filter(d=>d.type!=="same").length>0&&
                <span style={{background:"#1e3a5f",color:"#7dd3fc",borderRadius:3,padding:"1px 4px",marginLeft:3,fontSize:9}}>
                  {diffLines.filter(d=>d.type!=="same").length}
                </span>}
            </button>
            <button className={`tab ${centerTab==="3d"?"on":""}`} title="3D Viewer: inspect the robot visually and preview scene changes." onClick={()=>setCenterTab("3d")}>
              ◈ 3D{!validation.valid&&<span style={{marginLeft:2,color:"#fca5a5",fontSize:9}}>!</span>}
            </button>
            {/* 3D controls (only shown in 3D tab) */}
            {centerTab==="3d"&&(
              <div style={{marginLeft:8,display:"flex",gap:5}}>
                <button title={showAxes?"Hide Joint Axes: remove joint axis helpers from the 3D viewer.":"Show Joint Axes: display hinge and slide axes in the 3D viewer."} onClick={()=>setShowAxes(a=>!a)}
                  style={{padding:"2px 8px",background:showAxes?"rgba(239,68,68,0.15)":"#1e293b",
                    color:showAxes?"#ef4444":"#475569",borderRadius:4,fontSize:10,
                    border:`1px solid ${showAxes?"#7f1d1d":"#334155"}`,cursor:"pointer",fontFamily:"inherit"}}>
                  🎯 Axes
                </button>
                <button title={simulating?"Stop Simulation: pause the kinematic motion preview in the 3D viewer.":"Start Simulation: animate the robot with a kinematic motion preview."} onClick={()=>setSimulating(s=>!s)}
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
            <button className={`tab ${panel==="tree"?"on":""}`} title="Body Tree: browse bodies, joints, and geoms in the current robot." style={{flex:1}} onClick={()=>setPanel("tree")}>Tree</button>
            <button className={`tab ${panel==="history"?"on":""}`} title="History: review and restore previous XML versions." style={{flex:1}} onClick={()=>setPanel("history")}>Hist</button>
            <button className={`tab ${panel==="info"?"on":""}`} title="Info: open usage tips, quick edit prompts, and query examples." style={{flex:1}} onClick={()=>setPanel("info")}>Info</button>
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
              <div style={{padding:"8px 9px",marginBottom:10,background:"#111827",border:"1px solid #334155",borderRadius:7}}>
                <div style={{fontSize:10,color:"#475569",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>How To Use</div>
                <div style={{fontSize:11,color:"#cbd5e1",lineHeight:1.6}}>
                  <div><span style={{color:"#86efac",fontWeight:700}}>↑ Edit mode</span> changes the XML.</div>
                  <div><span style={{color:"#7dd3fc",fontWeight:700}}>QUERY / ?</span> answers questions only.</div>
                  <div style={{color:"#94a3b8"}}>Quick Prompts switch to edit mode. Query Examples switch to query mode.</div>
                  <div style={{color:"#94a3b8"}}>Use <span style={{color:"#7dd3fc"}}>📘 Manual</span> for the full quick-start guide and <span style={{color:"#cbd5e1"}}>ℹ About</span> for the developer page.</div>
                </div>
              </div>
	              <div style={{fontSize:10,color:"#475569",marginBottom:7,letterSpacing:"0.06em",textTransform:"uppercase"}}>Quick Prompts</div>
	              {["Add an arm with 3 joints","Add a camera sensor","Make all geoms red","Add a ball on floor",
	                "Double hip actuator gear","Add touch sensors","Add a second robot 2m right",
                "Remove all actuators","Change torso to sphere","Add wrist to the arm",
              ].map((ex,i)=>(
                <div key={i} onClick={()=>{setQueryMode(false);setInput(ex);}}
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

      {showManual&&<UserManualModal onClose={closeManual}/>}
      {showAbout&&<AboutDeveloperModal onClose={()=>setShowAbout(false)}/>}
      {showSettings&&<SettingsModal onClose={()=>setShowSettings(false)} providerCfg={providerCfg} setProviderCfg={setProviderCfg} ollamaModels={ollamaModels} ollamaStatus={ollamaStatus}/>}
      {showSnippets&&<SnippetModal onClose={()=>setShowSnippets(false)} onInsert={insertSnippet} customSnippets={customSnippets} setCustomSnippets={setCustomSnippets}/>}
      {showMacros&&<MacroModal onClose={()=>setShowMacros(false)} onRun={p=>{setQueryMode(false);sendMessage(p);}} customMacros={customMacros} setCustomMacros={setCustomMacros}/>}
      {showPython&&<PythonExportModal onClose={()=>setShowPython(false)} xml={xml}/>}
      {toast&&<Toast message={toast.message} type={toast.type} onDone={()=>setToast(null)}/>}
    </div>
  );
}
