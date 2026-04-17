# MuJoCo Copilot — AI-Powered Robot Design Studio

MuJoCo Copilot is a full-stack AI assistant for editing MuJoCo robot XML. It lets you describe a change in plain language, preview the result in 3D, inspect the diff, validate the XML, and export a Python simulation script from the browser.

## What You Get

- Natural-language MuJoCo XML editing
- Read-only query mode for questions like DOF, mass, and structure
- Live 3D viewer with body selection
- XML diff view and version history
- Validation warnings and error detection
- Prompt macros and snippet library
- Python export for simulation workflows
- Multi-provider support: Ollama, OpenAI, Anthropic, Gemini, and Groq

## Project Layout

```text
mujoco-copilot/
├── backend/                  FastAPI backend
├── frontend/mujoco-ui/       React + Vite frontend
├── requirements.txt          Python dependencies
├── README.md
└── README_documentation.md   Extended manual / technical reference
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+
- Optional: Ollama for local model usage

## Setup

### 1. Backend

From the repository root:

```bash
cd ./mujoco-copilot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Notes:

- `requirements.txt` lives at the repository root, not inside `backend/`.
- `.env.example` also lives at the repository root.
- The backend serves the editor API on `http://localhost:8000`.

### 2. Frontend

In a second terminal:

```bash
cd ./mujoco-copilot/frontend/mujoco-ui
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open:

```text
http://localhost:5173
```

## Optional: Ollama Local Models

If you want fully local editing/query support:

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

ollama serve
ollama pull qwen2.5:7b
```

The frontend checks Ollama availability through the backend and lists local models in Settings.

## Daily Run Commands

After the first install, you usually only need:

Backend:

```bash
cd mujoco-copilot
source venv/bin/activate
cd backend
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd mujoco-copilot/frontend/mujoco-ui
npm run dev
```

## How To Use

- `EDIT` mode changes the XML.
- `QUERY` mode answers questions without changing the XML.
- The left chat panel sends your prompt to the selected provider.
- The center tabs switch between XML, Diff, and 3D preview.
- The right panel shows the body tree, version history, and quick tips.
- New users see an in-app User Manual popup on first launch.

## Provider Support

| Provider | Edit XML | Query XML | API key required |
|----------|----------|-----------|------------------|
| Ollama   | Yes      | Yes       | No               |
| OpenAI   | Yes      | Yes       | Yes |
| Anthropic| Yes      | Yes       | Yes |
| Gemini   | Yes      | Yes       | Yes |
| Groq     | Yes      | Yes       | Yes |

## Key API Endpoints

Backend routes currently used by the UI:

- `GET /health`
- `GET /ollama/models`
- `POST /edit`
- `POST /query`
- `POST /analyze`
- `POST /graph`
- `POST /kinematics/path`

## Troubleshooting

### Frontend starts but no edits happen

- Check whether `QUERY` mode is enabled.
- In query mode, the app answers questions and does not modify XML.

### Ollama not detected

- Make sure `ollama serve` is running.
- Check `http://localhost:11434/api/tags`.

### Backend import errors

- Activate the virtual environment before starting Uvicorn.
- Install dependencies from the root `requirements.txt`.

## Documentation

For the full technical walkthrough, feature reference, and design notes, see:

- [README_documentation.md](./README_documentation.md)

## Development & AI Assistance

MuJoCo Copilot was developed through a hybrid workflow combining human engineering and AI-assisted development.

- Initial scaffolding, including the frontend and a minimal monolithic backend, was generated with assistance from Claude.
- The application was subsequently extended and re-architected by the developer into a full-featured system, including:
  - structured XML parsing and validation
  - patch-based LLM correction workflows
  - 3D visualization and kinematic simulation
  - interaction modes (edit/query) and system-level abstractions
- Final refinement and feature coverage checks were performed with assistance from OpenAI Codex to ensure completeness across edge cases and user workflows.

All architectural decisions, system design, and feature integrations were directed and implemented by the developer.

## License

This project is licensed under **PolyForm Noncommercial 1.0.0**.

- Educational, research, and other noncommercial use is allowed.
- Commercial use is not allowed under this license.
- This is **source-available**, not an OSI open-source license.

See [LICENSE](./LICENSE) for the full terms.
