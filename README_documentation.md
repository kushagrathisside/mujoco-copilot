# MuJoCo XML Editor

A full-stack AI-powered editor for MuJoCo robot XML files. Write a prompt, get a modified robot. See it in 3D. Simulate the joints. Export to Python. All in the browser.

---

## Table of Contents

1. [What It Is](#what-it-is)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
   - [Backend](#backend-setup)
   - [Frontend](#frontend-setup)
   - [Ollama (local models)](#ollama-setup)
5. [Running the App](#running-the-app)
6. [Feature Reference](#feature-reference)
   - [AI Chat Editor](#ai-chat-editor)
   - [Multi-turn Memory](#multi-turn-memory)
   - [Query Mode](#query-mode)
   - [3D Preview](#3d-preview)
   - [Kinematic Simulation](#kinematic-simulation)
   - [Joint Axis Arrows](#joint-axis-arrows)
   - [Body Tree Sidebar](#body-tree-sidebar)
   - [XML Editor](#xml-editor)
   - [Diff View](#diff-view)
   - [Validation](#validation)
   - [Auto-Repair Loop](#auto-repair-loop)
   - [Version History](#version-history)
   - [Snippet Library](#snippet-library)
   - [Prompt Macros](#prompt-macros)
   - [Python Export](#python-export)
7. [Provider Configuration](#provider-configuration)
   - [Ollama (local)](#ollama-local)
   - [Anthropic](#anthropic)
   - [OpenAI](#openai)
   - [Google Gemini](#google-gemini)
   - [Groq](#groq)
8. [API Reference](#api-reference)
9. [MuJoCo XML Quick Reference](#mujoco-xml-quick-reference)
10. [Performance & Hardware Notes](#performance--hardware-notes)
11. [Troubleshooting](#troubleshooting)
12. [Project Structure](#project-structure)
13. [Design Decisions](#design-decisions)

---

## What It Is

MuJoCo XML Editor lets you design and iterate on robot models using natural language. Instead of hand-editing verbose XML, you describe what you want ("add a 6-DOF arm to the torso", "mirror the left leg", "add damping to all joints") and an LLM rewrites the XML for you. You see the result immediately in a 3D viewer with orbit controls, can animate the joints kinematically, inspect the body hierarchy in a tree, and export a ready-to-run Python simulation script.

It supports five LLM backends (Ollama locally, Anthropic, OpenAI, Gemini, Groq) and works entirely offline if you have Ollama installed.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Browser (React + Vite)          │
│                                              │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │ AI Chat │  │ XML/Diff │  │ Three.js   │  │
│  │ Panel   │  │ Editor   │  │ 3D Viewer  │  │
│  └────┬────┘  └──────────┘  └────────────┘  │
│       │                                      │
│  ┌────▼──────────────────────────────────┐   │
│  │  Browser-side validation + body tree  │   │
│  │  DOMParser · Three.js · localStorage  │   │
│  └────┬──────────────────────────────────┘   │
└───────┼─────────────────────────────────────┘
        │ HTTP POST /edit  /query
        ▼
┌─────────────────────────────────────────────┐
│           FastAPI Backend (Python)           │
│                                             │
│  POST /edit   → LLM rewrite → JSON          │
│  POST /query  → LLM answer  → plain text    │
│  GET  /health → Ollama status               │
│  GET  /ollama/models → available models     │
│                                             │
│  Providers: Ollama · Anthropic · OpenAI     │
│             Gemini · Groq                   │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
  Ollama (local)     Cloud APIs
  qwen2.5:14b        claude / gpt-4o / etc.
```

**Key design choices:**
- The LLM always returns the **full rewritten XML** (not a patch/diff). Simple and reliable.
- Validation runs **entirely in the browser** using `DOMParser`. No MuJoCo WASM needed.
- API keys are stored in `localStorage` and sent per-request. They are never logged server-side.
- The backend is a thin proxy — it adds the system prompt and routes to the right provider. All state lives in the browser.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 18 | For the React frontend |
| npm | ≥ 9 | Comes with Node.js |
| Python | ≥ 3.10 | For the FastAPI backend |
| pip | any | Python package manager |
| Ollama | latest | Only if using local models |

You need at least one of: Ollama running locally, or an API key for Anthropic / OpenAI / Gemini / Groq.

---

## Installation

### Backend Setup

```bash
# Clone or copy the project
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy the example env file
cp .env.example .env

# Edit .env to set your preferred defaults (optional)
# OLLAMA_MODEL=qwen2.5:14b
# OLLAMA_BASE_URL=http://localhost:11434
```

**`requirements.txt` contents:**
```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
httpx>=0.27.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

### Frontend Setup

```bash
# Create a new Vite + React project
npm create vite@latest mujoco-ui -- --template react
cd mujoco-ui

# Install dependencies
npm install

# Install Three.js (required for 3D viewer)
npm install three

# Replace the default App.jsx with the editor
cp /path/to/mujoco-editor.jsx src/App.jsx

# Remove default CSS imports if any from src/main.jsx
# The editor uses all inline styles — no external CSS needed
```

### Ollama Setup

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (choose based on your RAM — see Performance section)
ollama pull qwen2.5:14b      # recommended — ~9GB RAM
ollama pull qwen2.5:7b       # lighter — ~5GB RAM
ollama pull llama3.1:8b      # alternative — ~5GB RAM

# Verify Ollama is running
ollama list
curl http://localhost:11434/api/tags
```

---

## Running the App

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

**Terminal 2 — Frontend:**
```bash
cd mujoco-ui
npm run dev
```

Open `http://localhost:5173` in your browser.

**Quick health check:**
```bash
curl http://localhost:8000/health
# {"status":"ok","ollama_running":true,"ollama_url":"http://localhost:11434"}
```

---

## Feature Reference

### AI Chat Editor

The left panel is a conversation interface. Type a natural language instruction and press **Enter** (or Shift+Enter for newline). The editor sends your current XML + structural summary to the LLM, which returns a fully rewritten XML with a brief explanation of what changed.

**What to say:**
```
Add an arm with shoulder, elbow and wrist joints
Make the torso a sphere instead of a box
Add actuators for all joints that don't have one
Double the gear ratio on the hip motors
Add a camera looking forward from the torso
Remove the left leg entirely
Make all materials blue
Add a floor contact sensor
```

After each successful edit:
- The XML updates in the editor
- The 3D view switches automatically to show the result
- A diff is computed and available in the Diff tab
- A history entry is created

---

### Multi-turn Memory

The editor maintains **conversation memory** across turns. The last 6 exchanges (12 messages) are sent with every request, so you can have follow-up conversations:

```
You:        Add an arm to the torso
Assistant:  Added 6-DOF arm with shoulder, elbow, wrist...

You:        Make the arm longer
Assistant:  Extended upper arm from 0.3m to 0.45m...

You:        Now add a gripper at the end
Assistant:  Added gripper fingers to the wrist body...
```

The **memory badge** in the header shows how many turns are stored (`💬 3t`). Click the `✕` next to it to clear memory and start fresh. Memory is not persisted across page reloads.

---

### Query Mode

Toggle **🔍** in the header to enter Query Mode. In this mode, your messages are answered as questions — the LLM reads your XML and responds in plain text without modifying anything.

**What to ask:**
```
How many degrees of freedom does this robot have?
Which joints have no actuator?
What is the total mass of all bodies?
Is the robot bilaterally symmetric?
List all sensor names and their types
What would happen if I doubled the gravity?
Is the gear ratio on the hip motor realistic?
Explain what the root_x joint does
```

Query mode is indicated by:
- Blue input border
- `🔍` send button
- `🔍 QUERY MODE` label in the chat header
- `🔍` prefix on your messages in chat

The Info panel (right sidebar) has a set of pre-written query examples that enable query mode and populate the input when clicked.

---

### 3D Preview

The **◈ 3D** tab shows a real-time Three.js render of your robot. It rebuilds automatically whenever the XML changes (with debouncing to avoid rebuilding on every keystroke).

**Controls:**
| Input | Action |
|-------|--------|
| Click + drag | Orbit camera |
| Scroll wheel | Zoom in/out |
| — | No pan (camera always looks at robot centre) |

**Geometry support:**

| MuJoCo type | Three.js geometry | Notes |
|-------------|-------------------|-------|
| `box` | `BoxGeometry` | Uses `size` as half-extents |
| `sphere` | `SphereGeometry` | Uses `size[0]` as radius |
| `cylinder` | `CylinderGeometry` | Uses `size[0]` radius, `size[1]` half-height |
| `capsule` | Cylinder + 2× Sphere | Supports both `size`+`pos` and `fromto` |
| `plane` | `PlaneGeometry` | Rotated flat, dark ground colour |

**Materials:** If a geom references a `<material>` by name, that material's `rgba` is parsed and applied. Otherwise the geom's own `rgba` attribute is used. Selected bodies (via the tree) render in gold.

**Coordinate system:** MuJoCo uses Z-up; Three.js uses Y-up. The viewer applies the mapping `(x, y, z) → (x, z, -y)` throughout.

---

### Kinematic Simulation

Click **▶ Simulate** in the 3D tab toolbar to animate all hinge joints through their range of motion using sine waves. Each joint gets a unique phase offset so limbs move independently rather than in lockstep.

The simulation is **purely kinematic** — no physics, no collision detection, no contact forces. It is useful for:
- Checking that your joint ranges make anatomical sense
- Verifying that the body tree hierarchy is correct (child bodies follow parents)
- Seeing which joints actually move vs. which are unactuated/unranged
- Confirming visual proportions in motion

Click **⏹ Stop** to freeze the pose. The XML is not modified by simulation.

**How it works internally:** On each animation frame, `kinematicStep()` computes a sine-wave angle for every `type="hinge"` joint, clamped to its `range`. These angles are passed into `buildThreeScene()` which applies them as quaternion rotations at each body's joint before computing its world matrix.

---

### Joint Axis Arrows

Click **🎯 Axes** in the 3D tab toolbar to overlay joint axis visualisations on the robot.

| Element | Colour | Meaning |
|---------|--------|---------|
| Arrow shaft + head | Red | Hinge joint axis |
| Arrow shaft + head | Green | Slide joint axis |
| Arrow shaft + head | Purple | Ball joint axis |
| Arc curve | Matching | Hinge range of motion |

Arrows are drawn in world space at the body's origin, pointing along the joint's axis vector (transformed by accumulated parent rotations). The range arc sweeps from `range[0]` to `range[1]` degrees at a radius of 0.18m.

You can combine **Axes + Simulate** to watch the arrows move with the animated joints — useful for debugging axis directions.

---

### Body Tree Sidebar

The **Tree** tab in the right sidebar shows the full `<worldbody>` hierarchy as a collapsible tree.

Each row shows:
- **▸/▾** — expand/collapse children
- **⬡** — body icon (blue when selected)
- **Body name**
- **J badges** (purple) — one per joint on this body, hover for name and type
- **Geometry type badges** (teal) — B=box, S=sphere, C=capsule/cylinder

**Clicking a body:**
1. Highlights it gold in the 3D viewer
2. Pre-fills the chat input with `"Modify the "bodyname" body: "`
3. Adds a context hint to the LLM prompt: `"Focus on body 'bodyname'"`
4. Switches the center panel to 3D view

The selected body is shown as a gold pill below the chat input. Click **✕** to deselect.

**Actuator list:** Below the body tree, all actuators are listed with their target joint (`motor_name → joint_name`).

---

### XML Editor

The **◉ XML** tab is a full-text editor with:
- **Syntax highlighting** — tag names (teal), attribute names (indigo), attribute values (green), comments (grey)
- **Line numbers** — fixed left gutter
- **Live validation** — runs on every keystroke, results shown in the panel below the editor
- **Undo/redo** — native textarea undo (`Ctrl+Z`) for character-level edits; the version history buttons for LLM-level undo

You can freely hand-edit the XML at any time. The 3D view and validation update immediately.

**Copy / Export:**
- **⎘** button in header — copies raw XML to clipboard
- **↓ .xml** button in header — downloads as `robot.xml`

---

### Diff View

The **± Diff** tab shows a line-by-line comparison between the XML before and after the last LLM edit.

| Line type | Background | Prefix |
|-----------|------------|--------|
| Added | Green tint | `+` |
| Removed | Red tint | `−` |
| Unchanged | Transparent | ` ` |

The tab label shows a count of changed lines (e.g. `± Diff 14`). The diff resets when you make a manual edit in the XML editor.

---

### Validation

Validation runs **browser-side in real time** using `DOMParser`. It checks:

**Errors (block simulation):**
- Root element must be `<mujoco>`
- Every `<body>` must contain at least one `<geom>`
- Every actuator must reference an existing joint name

**Warnings (non-blocking):**
- Sensors referencing unknown joints
- Geoms missing `size` attribute
- Mass ratio > 1000:1 between any two geoms (physics instability risk)

The validation badge in the header shows `✓` (green) or `✗ Ne` (red, N = error count). The panel below the XML editor lists all errors and warnings with their messages.

---

### Auto-Repair Loop

If the LLM produces XML that fails validation, the editor automatically sends a repair request — up to **3 attempts**.

Each repair attempt:
1. Sends the broken XML + list of error messages back to the LLM
2. Instructs it to fix only the errors, nothing else
3. Re-validates the result
4. If still invalid, tries again (up to 3×)

The chat shows `"⚠ Auto-repairing N error(s)…"` while this happens. On success: `"Auto-repair succeeded ✓"`. If errors persist after 3 attempts, a warning toast shows how many remain, and the (partially fixed) XML is still applied.

---

### Version History

Every LLM edit and snippet insertion creates a history entry. The **Hist** tab in the right sidebar shows all versions in reverse-chronological order (newest first).

Each entry shows:
- Coloured dot (purple = initial, blue = LLM edit, cyan = current)
- Label (first 48 chars of the prompt that created it)
- Timestamp and line count

**Click any entry** to restore that version. The XML editor, 3D view, and validation all update immediately.

**Undo/Redo buttons** in the header step through the history linearly:
- `↩ Undo` — go to previous version
- `↪ Redo` — go to next version (after undo)

Making a new edit while viewing an old version trims all forward history (like Git).

---

### Snippet Library

Click **📦** in the header to open the Snippet Library modal.

**Built-in snippets:**

| Snippet | Description |
|---------|-------------|
| 🦾 6-DOF Arm | Shoulder pan/lift + elbow + 3-axis wrist, capsule links |
| ✊ Gripper | Two-finger parallel gripper with slide joints |
| 🛞 Wheeled Base | Box body with 4 cylinder wheels, x/y/yaw joints |
| 📡 IMU Sensors | Accelerometer + gyro + frame quaternion sensor template |
| 📷 Cameras | Front and top camera definitions |

Clicking a snippet inserts it just before `</worldbody>` in the current XML and creates a history entry.

**Custom snippets:** At the bottom of the modal, enter a name and paste XML to save a custom snippet. Custom snippets are stored in `localStorage` under `mujoco_snippets` and marked with a purple `● custom` tag.

---

### Prompt Macros

Click **⚡ Macros** in the header to open the Macro modal.

Macros are pre-written prompts that fire the full LLM edit pipeline when you click **Run ↑**.

**Built-in macros:**

| Macro | What it does |
|-------|-------------|
| 📡 Standard Sensors | Adds joint position + velocity sensors for every joint, plus an accelerometer on the torso |
| 🔄 Mirror Left→Right | Duplicates all left-side bodies/joints/actuators as right-side counterparts |
| 🔧 Add Damping | Adds `damping` attributes to all hinge joints (1.0 large, 0.5 small) |
| 🎨 Colorize by Type | Sets distinct rgba colours for torso (blue), limbs (orange), end-effectors (green) |
| 🔒 Add Limits | Adds anatomically plausible `range` to all hinge joints missing one |
| ⚡ Fix Actuators | Adds motor actuators for all joints without one |

**Custom macros:** Enter a name and prompt text at the bottom of the modal. Custom macros are saved to `localStorage` under `mujoco_macros` and can be deleted with the `✕` button.

---

### Python Export

Click **🐍 Python** in the header to generate a complete simulation script for your current XML.

The script includes:

- Your entire XML embedded as a Python string
- `mujoco.MjModel` and `mujoco.MjData` initialisation
- Model info printout (nbody, njnt, nu, nv)
- Auto-generated named index variables for every joint and actuator:
  ```python
  jid_left_hip   = joint_id("left_hip")
  aid_left_knee_act = actuator_id("left_knee_act")
  ```
- A `controller(model, data)` stub where you fill in control signals
- `run_headless(duration)` — runs without a window, prints state every 1000 steps
- `run_viewer()` — launches MuJoCo's interactive passive viewer

**Usage:**
```bash
pip install mujoco

python simulate_robot.py           # headless, 5 seconds
python simulate_robot.py --viewer  # interactive viewer window
```

The modal shows the script syntax-highlighted with line numbers. Use **⎘ Copy** or **↓ Download** to save it.

---

## Provider Configuration

Click **⚙** or the provider badge in the header to open Settings.

### Ollama (local)

No API key required. Ollama must be running locally on port 11434.

```bash
ollama serve          # starts Ollama daemon
ollama pull <model>   # download a model first
```

The settings panel shows a live `● running` / `● not detected` status and a dropdown of all pulled models.

**Recommended models by RAM:**

| Model | RAM needed | Speed (CPU) | Quality |
|-------|-----------|-------------|---------|
| `qwen2.5:3b` | ~2.5GB | ~30s | Acceptable |
| `qwen2.5:7b` | ~5GB | ~2–5 min | Good |
| `qwen2.5:14b` | ~9GB | ~5–12 min | Excellent |
| `llama3.1:8b` | ~5GB | ~2–5 min | Good |
| `qwen2.5:32b` | ~20GB | Very slow | Overkill |

With a GPU (CUDA/Metal), all models run in seconds.

### Anthropic

```
API key: sk-ant-...
Get one at: https://console.anthropic.com
```

Available models:
- `claude-sonnet-4-20250514` — default, fast and capable
- `claude-opus-4-20250514` — most capable, slower
- `claude-haiku-4-5-20251001` — fastest, lighter

### OpenAI

```
API key: sk-...
Get one at: https://platform.openai.com
```

Available models:
- `gpt-4o` — default
- `gpt-4o-mini` — faster, cheaper
- `gpt-4-turbo`

### Google Gemini

```
API key: AIza...
Get one at: https://aistudio.google.com
```

Available models:
- `gemini-1.5-pro` — default
- `gemini-1.5-flash` — faster
- `gemini-2.0-flash`

### Groq

```
API key: gsk_...
Get one at: https://console.groq.com
```

Available models:
- `llama-3.3-70b-versatile` — default
- `mixtral-8x7b-32768`
- `llama3-70b-8192`

**API key storage:** Keys are stored in browser `localStorage` as `mujoco_key_{provider}`. They are sent to the backend per-request in the POST body and are never written to logs or disk on the server.

To use environment variables on the backend instead (for a shared deployment):

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
```

If a key is present in `.env`, it is used as a fallback when no key is sent from the browser.

---

## API Reference

Base URL: `http://localhost:8000`

---

### `GET /health`

Check server and Ollama status.

**Response:**
```json
{
  "status": "ok",
  "ollama_running": true,
  "ollama_url": "http://localhost:11434"
}
```

---

### `GET /ollama/models`

List all locally pulled Ollama models.

**Response:**
```json
{
  "models": ["qwen2.5:14b", "llama3.1:8b"],
  "default": "qwen2.5:14b"
}
```

**Error:** `502` if Ollama is not reachable.

---

### `POST /edit`

Send an XML + prompt to the LLM and get back a rewritten XML.

**Request body:**
```json
{
  "xml": "<mujoco>...</mujoco>",
  "prompt": "Add an arm to the torso",
  "provider": "ollama",
  "model": "qwen2.5:14b",
  "api_key": "",
  "history": [
    { "role": "user",      "content": "previous message" },
    { "role": "assistant", "content": "previous reply" }
  ]
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `xml` | string | yes | — | Current MuJoCo XML |
| `prompt` | string | yes | — | Full prompt including structural summary |
| `provider` | string | no | `"ollama"` | One of: `ollama`, `anthropic`, `openai`, `gemini`, `groq` |
| `model` | string | no | provider default | Model name to use |
| `api_key` | string | no | `""` | API key (falls back to env var) |
| `history` | array | no | `[]` | Prior conversation turns for multi-turn memory |

**Response:**
```json
{
  "strategy": "full_rewrite",
  "reasoning": "Added 6-DOF arm body hierarchy attached to torso",
  "xml": "<mujoco>...</mujoco>",
  "changes": [
    "Added shoulder body with pan/lift joints",
    "Added forearm with elbow joint",
    "Added wrist with 3-axis rotation"
  ],
  "model_used": "qwen2.5:14b",
  "provider": "ollama"
}
```

**Errors:**
- `400` — missing/invalid provider or missing API key
- `502` — upstream LLM error (Ollama not running, invalid key, etc.)

---

### `POST /query`

Ask a question about the XML without editing it. Returns plain text.

**Request body:**
```json
{
  "prompt": "How many DOF does this robot have?\n\nRobot structure:\n...\n\nFull XML:\n...",
  "provider": "ollama",
  "model": "qwen2.5:14b",
  "api_key": ""
}
```

**Response:**
```json
{
  "answer": "This robot has 6 degrees of freedom: left_hip (hinge), left_knee (hinge), right_hip (hinge), right_knee (hinge), root_x (slide), root_z (slide)."
}
```

---

## MuJoCo XML Quick Reference

The LLM knows these, but this is useful for manual edits:

```xml
<mujoco model="name">

  <!-- Simulation options -->
  <option gravity="0 0 -9.81" timestep="0.002" integrator="RK4"/>

  <!-- Assets: materials, meshes, textures -->
  <asset>
    <material name="mat" rgba="0.3 0.6 0.9 1" specular="0.5"/>
    <mesh file="part.stl" scale="1 1 1"/>
    <texture type="2d" file="tex.png"/>
  </asset>

  <!-- Scene -->
  <worldbody>
    <light pos="0 0 4" dir="0 0 -1"/>
    <geom name="floor" type="plane" size="5 5 0.1"/>

    <!-- Each body must have ≥1 geom -->
    <body name="torso" pos="0 0 1.0">
      <joint name="root" type="free"/>
      <geom type="box" size="0.15 0.1 0.2" mass="5" rgba="0.3 0.6 0.9 1"/>

      <body name="head" pos="0 0 0.3">
        <joint name="neck" type="hinge" axis="0 1 0" range="-45 45"/>
        <geom type="sphere" size="0.08" mass="1"/>
      </body>
    </body>
  </worldbody>

  <!-- Actuators -->
  <actuator>
    <motor name="neck_act" joint="neck" gear="50"/>
    <position name="pos_ctrl" joint="neck" kp="100"/>
  </actuator>

  <!-- Sensors -->
  <sensor>
    <jointpos  name="neck_pos"  joint="neck"/>
    <jointvel  name="neck_vel"  joint="neck"/>
    <touch     name="foot_touch" site="foot_site"/>
    <gyro      name="gyro"      site="imu"/>
    <accelerometer name="acc"   site="imu"/>
  </sensor>

  <!-- Equality constraints -->
  <equality>
    <joint joint1="left_finger" joint2="right_finger" polycoef="0 1 0 0 0"/>
  </equality>

</mujoco>
```

**Geometry types and their `size` attribute:**

| Type | `size` format | `fromto` support |
|------|---------------|-----------------|
| `box` | `half_x half_y half_z` | No |
| `sphere` | `radius` | No |
| `cylinder` | `radius half_height` | Yes |
| `capsule` | `radius [half_height]` | Yes |
| `plane` | `half_x half_y thickness` | No |
| `ellipsoid` | `half_x half_y half_z` | No |
| `mesh` | — | No |

**Joint types:**

| Type | DOF | `axis` required | `range` |
|------|-----|-----------------|---------|
| `hinge` | 1 | yes | degrees |
| `slide` | 1 | yes | metres |
| `ball` | 3 | no | degrees (limited) |
| `free` | 6 | no | — |

---

## Performance & Hardware Notes

### CPU (no GPU)

On a 16 GB RAM CPU-only machine, expect:

| Model | RAM | Response time |
|-------|-----|---------------|
| `qwen2.5:7b` | ~5 GB | 2–5 min |
| `qwen2.5:14b` | ~9 GB | 5–12 min |

The elapsed timer in the chat (e.g. `⚙ 🦙 47s`) shows wall time. After 30 seconds a note appears: *"CPU mode — please wait…"*

The backend Ollama timeout is set to **900 seconds** to accommodate slow hardware. Cloud providers (Anthropic, Groq, etc.) time out after **120 seconds** — strongly preferred if you have an API key and want fast iteration.

### GPU (CUDA / Apple Metal)

With Ollama on GPU, `qwen2.5:14b` responds in **5–15 seconds**. No configuration needed — Ollama auto-detects GPU.

### Context window

Large XML files (>200 lines) consume significant tokens. The editor includes a structural summary (bodies, joints, actuators) before the full XML to help the LLM reason efficiently. Conversation memory is capped at 12 messages (6 turns) to avoid context overflow.

---

## Troubleshooting

**`Failed to fetch` / CORS error in browser console**

The backend is not running. Start it:
```bash
cd backend && uvicorn main:app --reload --port 8000
```

**`● not detected` for Ollama in Settings**

Ollama is not running or is on a different port.
```bash
ollama serve
# or check the URL in .env: OLLAMA_BASE_URL=http://localhost:11434
```

**`No models. Run: ollama pull qwen2.5:14b`**

You have Ollama running but no models downloaded.
```bash
ollama pull qwen2.5:14b
```

**LLM returns garbled XML or a non-JSON response**

The model is too small or ran out of context. Try:
1. Switch to a larger model
2. Simplify the XML (fewer bodies)
3. Use a cloud provider instead

The auto-repair loop will attempt to fix validation errors, but cannot fix totally malformed output.

**3D view is blank / shows only the grid**

Your XML has validation errors — check the badge in the header and the validation panel. Common cause: a `<body>` with no `<geom>`. The 3D viewer only renders when `validationResult.doc` is non-null (i.e. XML parses successfully).

**`502 Upstream LLM error`**

Check:
- Ollama: is the model pulled? (`ollama list`)
- Cloud: is the API key correct and has quota?
- Network: is the backend able to reach `api.anthropic.com` etc.?

**Python export script fails**

```bash
# Missing mujoco package
pip install mujoco

# macOS arm64
pip install mujoco --extra-index-url https://pypi.org/simple/
```

If the XML has errors that passed browser validation (edge cases), `mujoco.MjModel.from_xml_string()` will raise — fix the XML first.

---

## Project Structure

```
mujoco-editor.jsx          # Full React frontend (single file)
backend/
  main.py                  # FastAPI server, all provider routing
  requirements.txt         # Python dependencies
  .env.example             # Environment variable template
README.md                  # This file
```

**Key sections inside `mujoco-editor.jsx`:**

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| `PROVIDERS` | top | Provider config (models, colors, keys) |
| `DEFAULT_XML` | top | The biped robot loaded on first launch |
| `SNIPPETS` | top | Built-in XML snippet library |
| `BUILTIN_MACROS` | top | Built-in prompt macros |
| `generatePythonScript()` | function | Python export generator |
| `validateMuJoCoXML()` | function | Browser-side validator |
| `buildXMLSummary()` | function | Structural summary for LLM context |
| `parseBodyTree()` | function | DOM → tree data structure |
| `BodyTreeNode` | component | Recursive tree row |
| `addJointAxes()` | function | Three.js arrow/arc overlays |
| `kinematicStep()` | function | Sine-wave joint angles for simulation |
| `buildThreeScene()` | function | MuJoCo XML → Three.js objects |
| `RobotViewer` | component | Three.js canvas + orbit controls |
| `ValidationPanel` | component | Error/warning list below XML editor |
| `SnippetModal` | component | Snippet library modal |
| `MacroModal` | component | Prompt macro modal |
| `SettingsModal` | component | Provider/model/key settings |
| `PythonExportModal` | component | Python script viewer + download |
| `MuJoCoEditor` | component | Main app, all state |

---

## Design Decisions

**Full XML rewrite vs. patch/diff**
The LLM always returns the complete rewritten XML. A patch approach (returning only changed lines) was considered but rejected: LLMs produce unreliable diffs, especially for structured XML. A full rewrite is easier to validate, always results in syntactically correct XML (when the LLM works correctly), and makes the auto-repair loop straightforward.

**Browser-side validation, no MuJoCo WASM**
`DOMParser` runs in microseconds and catches the most common authoring errors. A full MuJoCo WASM build would take seconds to load, requires a WASM bundle, and is overkill for the subset of validation that matters during editing. The Python export script can be used for full physics validation.

**Kinematic simulation instead of physics WASM**
Physics simulation in the browser (via mujoco-wasm) is technically possible but adds significant complexity: WASM bundle size, threading, memory management, and the simulation state must be kept in sync with XML edits. Kinematic preview catches the most common issues (wrong hierarchy, wrong axis direction, unrealistic ranges) with zero overhead.

**Single-file architecture**
Both the frontend (one `.jsx` file) and backend (one `main.py` file) are intentionally kept as single files. This makes the project easy to read, copy, and modify without a build system or module bundler configuration. Everything is visible and nothing is hidden in sub-packages.

**API keys in localStorage, not cookies**
API keys stored in cookies would be sent automatically with every request, creating CSRF risk. `localStorage` is scoped to the origin and is explicitly sent only when needed. The backend never writes keys to disk, logs, or any persistent store.

**Robot-aware context in every prompt**
Rather than sending only the raw XML to the LLM, every prompt includes a structural summary (`Bodies(5): torso, left_thigh...`) prepended before the full XML. This helps the LLM reason about the robot structurally — especially useful for large XML files where the token budget is tight — and produces more accurate edits with fewer hallucinated names.
