"""
mujoco-copilot — FastAPI Backend
Providers: Ollama · Anthropic · OpenAI · Gemini · Groq
Features:  Multi-turn history · Robot-aware context · Auto-repair loop
"""

import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from schemas.requests import ActionEventRequest, EditRequest, QueryRequest

load_dotenv()

from services.editor_service import process_edit
from services.query_service import process_query
from mjcf.analyzer import analyze_robot_structure
from mjcf.graph_builder import build_robot_graph
from mjcf.kinematics import find_kinematic_path
from mjcf.converters.urdf_to_mjcf import urdf_to_mjcf
from utils.action_logger import get_activity_log_path, log_action

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "qwen2.5:7b")

app = FastAPI(title="mujoco-copilot API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are an expert MuJoCo XML editor. You modify robot and environment XML files precisely and correctly.

MuJoCo XML reference:
- <mujoco model="name">            root element
- <option gravity="x y z"/>        simulation settings
- <asset>                          materials, meshes, textures
- <worldbody>                      scene root — holds <body>, <geom>, <light>
- <body name="..." pos="x y z">    rigid body — MUST contain at least one <geom>
- <geom type="box|sphere|capsule|cylinder|plane" size="..." pos="..." mass="..."/>
- <joint type="hinge|slide|ball|free" axis="x y z" range="min max"/>
- <actuator> <motor joint="..." gear="..."/>
- <sensor>   <jointpos/jointvel name="..." joint="..."/>
- capsule: size="radius", fromto="x1 y1 z1 x2 y2 z2"

Rules:
- Every <body> must have ≥1 <geom>
- Positions in metres, angles in degrees
- Actuators/sensors must reference existing joint names

Return ONLY a JSON object, no markdown, no fences, no extra text:
{
  "strategy": "full_rewrite",
  "reasoning": "one sentence explanation",
  "xml": "<complete updated mujoco XML>",
  "changes": ["change 1", "change 2"]
}"""

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    ok=False
    try:
        async with httpx.AsyncClient(timeout=3.0) as c: r=await c.get(f"{OLLAMA_BASE_URL}/api/tags")
        ok=r.status_code==200
    except: pass
    return {"status":"ok","ollama_running":ok,"ollama_url":OLLAMA_BASE_URL}


@app.get("/ollama/models")
async def ollama_models():
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r=await c.get(f"{OLLAMA_BASE_URL}/api/tags"); r.raise_for_status()
        return {"models":[m["name"] for m in r.json().get("models",[])],"default":OLLAMA_MODEL}
    except Exception as e: raise HTTPException(502,f"Cannot reach Ollama: {e}")


@app.post("/edit")
async def edit_xml(req: EditRequest):

    return await process_edit(req, SYSTEM_PROMPT)

@app.post("/query")
async def query_xml(req: QueryRequest):

    return await process_query(req)

@app.post("/events")
async def record_event(req: ActionEventRequest):

    log_action(req.event_type, source=req.source, details=req.details)
    return {"ok": True}

@app.get("/logs/activity")
async def download_activity_log():

    path = get_activity_log_path()
    log_action(
        "activity_log_downloaded",
        details={"size_bytes": path.stat().st_size},
    )
    return FileResponse(
        path,
        media_type="application/x-ndjson",
        filename="mujoco-copilot-activity.jsonl",
    )

@app.post("/analyze")
async def analyze_xml(req: EditRequest):

    structure = analyze_robot_structure(req.xml)

    return {
        "robot": structure
    }

@app.post("/graph")
async def robot_graph(req: EditRequest):

    graph = build_robot_graph(req.xml)

    return {
        "graph": graph
    }

@app.post("/kinematics/path")
async def kinematic_path(req: EditRequest, start: str, end: str):

    path = find_kinematic_path(req.xml, start, end)

    return {
        "start": start,
        "end": end,
        "path": path
    }

# Backward-compatible alias for an earlier typo plus the correct public route.
@app.post("/covert/urdf")
@app.post("/convert/urdf")
async def convert_urdf(urdf: str):

    mjcf = urdf_to_mjcf(urdf)
    return {
        "mjcf": mjcf
    }
