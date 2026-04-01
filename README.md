# MuJoCo XML Editor

LLM-powered editor with live 3D preview, multi-provider support, and version history.

## Providers

| Provider  | Key needed | Recommended model         |
|-----------|-----------|---------------------------|
| 🦙 Ollama | No        | qwen2.5:14b (local)       |
| ◆ Anthropic | Yes     | claude-sonnet-4-20250514  |
| ⬡ OpenAI  | Yes       | gpt-4o                    |
| ✦ Gemini  | Yes       | gemini-1.5-pro            |
| ⚡ Groq    | Yes       | llama-3.3-70b-versatile   |

---

## Setup

### 1. Ollama (local, no internet needed)
```bash
# macOS
brew install ollama
# Linux
curl -fsSL https://ollama.com/install.sh | sh

ollama pull qwen2.5:14b
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env       # edit if needed
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
npm create vite@latest mujoco-ui -- --template react
cd mujoco-ui && npm install
# Copy mujoco-editor.jsx → src/App.jsx
# Add to vite.config.js: optimizeDeps: { include: ['three'] }
npm install three
npm run dev
```

Open http://localhost:5173

---

## Features

- **3D Preview** — live Three.js visualisation of geoms/bodies, drag to orbit, scroll to zoom
- **XML Validation** — instant error/warning panel (body missing geom, bad joint refs, etc.)
- **Multi-provider** — switch between Ollama, Anthropic, OpenAI, Gemini, Groq in ⚙ Settings
- **API key storage** — keys saved in browser localStorage, never sent to any third party
- **Diff view** — line-by-line coloured diff after every LLM edit
- **Version history** — full undo/redo tree, click any past version to restore
- **Direct editing** — edit XML by hand; 3D view and validation update instantly

---

## Architecture

```
React UI (localhost:5173)
  ├─ Provider Settings modal  →  localStorage (API keys, active provider)
  ├─ POST /edit { xml, prompt, provider, model, api_key }
  │      ↓
  FastAPI (localhost:8000)
  ├─ /api/chat  →  Ollama (localhost:11434)     [no key]
  ├─ /v1/messages → Anthropic API               [key from request]
  ├─ /v1/chat/completions → OpenAI API          [key from request]
  ├─ /generateContent → Gemini API              [key from request]
  └─ /openai/v1/chat/completions → Groq API     [key from request]
         ↓
  JSON { strategy, reasoning, xml, changes }
         ↓
  React: update XML + run validation + rebuild Three.js scene + push history
```
