"""
MuJoCo XML Editor — FastAPI Backend
Providers: Ollama · Anthropic · OpenAI · Gemini · Groq
Features:  Multi-turn history · Robot-aware context · Auto-repair loop
"""

from pyexpat.errors import messages
import os, json, re
from unittest import result
import xml
from xml.parsers.expat import model
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional, List
from schemas.requests import EditRequest, QueryRequest, HistoryMsg
from llm.json_parser import extract_json
from llm.providers import call_ollama, call_openai, call_anthropic, call_gemini, call_groq
load_dotenv()

from mjcf.patch_engine import apply_xml_patch
from mjcf.validator import validate_mjcf
from services.editor_service import process_edit
from services.query_service import process_query
from mjcf.analyzer import analyze_robot_structure
from mjcf.graph_builder import build_robot_graph
from mjcf.kinematics import find_kinematic_path
from mjcf.converters.urdf_to_mjcf import urdf_to_mjcf

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL",    "qwen2.5:7b")

app = FastAPI(title="MuJoCo XML Editor API")
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

# ── Natural Language Query endpoint (read-only, no XML edit) ──────────────────

QUERY_SYSTEM = """You are a MuJoCo robotics expert. Answer questions about MuJoCo XML robot models clearly and concisely.
Do NOT modify any XML. Do NOT return JSON. Just answer the question in plain text."""

async def call_query(prompt: str, provider: str, model: str, api_key: str = "") -> str:
    msgs = [{"role": "user", "content": prompt}]
    if provider == "ollama":
        payload = {"model": model or OLLAMA_MODEL, "stream": False,
                   "options": {"temperature": 0.2, "num_predict": 1024},
                   "messages": [{"role": "system", "content": QUERY_SYSTEM}] + msgs}
        async with httpx.AsyncClient(timeout=300.0) as c:
            r = await c.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
        return r.json().get("message", {}).get("content", "")
    elif provider == "anthropic":
        payload = {"model": model or "claude-sonnet-4-20250514", "max_tokens": 1024,
                   "system": QUERY_SYSTEM, "messages": msgs}
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
        return "".join(b.get("text","") for b in r.json().get("content",[]))
    elif provider == "openai":
        payload = {"model": model or "gpt-4o", "temperature": 0.2, "max_tokens": 1024,
                   "messages": [{"role":"system","content":QUERY_SYSTEM}]+msgs}
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post("https://api.openai.com/v1/chat/completions", json=payload,
                             headers={"Authorization": f"Bearer {api_key}"})
        return r.json()["choices"][0]["message"]["content"]
    elif provider == "groq":
        payload = {"model": model or "llama-3.3-70b-versatile", "temperature": 0.2, "max_tokens": 1024,
                   "messages": [{"role":"system","content":QUERY_SYSTEM}]+msgs}
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post("https://api.groq.com/openai/v1/chat/completions", json=payload,
                             headers={"Authorization": f"Bearer {api_key}"})
        return r.json()["choices"][0]["message"]["content"]
    return "Provider not supported for queries."

@app.post("/query")
async def query_xml(req: QueryRequest):

    return await process_query(req)

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

@app.post("/covert/urdf")
async def convert_urdf(urdf: str):

    mjcf = urdf_to_mjcf(urdf)
    return {
        "mjcf": mjcf
    }