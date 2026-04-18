import os
import httpx
from fastapi import HTTPException


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "8192"))


# ── Build message list ──────────────────────────────────────────────
def build_messages(prompt: str, history: list):

    msgs = []

    for h in (history or []):
        msgs.append({"role": h.role, "content": h.content})

    msgs.append({"role": "user", "content": prompt})

    return msgs


# ── Ollama ──────────────────────────────────────────────────────────
async def call_ollama(
    prompt: str,
    model: str,
    history: list,
    system_prompt: str,
    timeout_seconds: float | None = None,
    num_predict: int | None = None,
):

    timeout_seconds = sanitize_ollama_timeout(timeout_seconds)
    num_predict = sanitize_ollama_num_predict(num_predict)

    messages = [{"role": "system", "content": system_prompt}] + build_messages(prompt, history)

    payload = {
        "model": model,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": num_predict,
            "num_ctx": 4096
        },
        "messages": messages
    }

    last_error = None

    for attempt in range(3):

        try:

            async with httpx.AsyncClient(timeout=timeout_seconds) as c:
                r = await c.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)

            if r.status_code != 200:
                raise HTTPException(502, f"Ollama {r.status_code}: {r.text[:400]}")

            raw = r.json().get("message", {}).get("content", "")

            return raw

        except Exception as e:

            last_error = e
            print(f"Ollama attempt {attempt+1} failed:", e)

    raise HTTPException(502, f"Ollama failed after retries: {last_error}")


def sanitize_ollama_timeout(value: float | None) -> float:
    if value is None:
        return OLLAMA_TIMEOUT_SECONDS
    return max(30.0, float(value))


def sanitize_ollama_num_predict(value: int | None) -> int:
    if value is None:
        return OLLAMA_NUM_PREDICT
    return max(256, int(value))


# ── Anthropic ───────────────────────────────────────────────────────
async def call_anthropic(prompt: str, model: str, api_key: str, history: list, system_prompt: str):

    payload = {
        "model": model,
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": build_messages(prompt, history)
    }

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    async with httpx.AsyncClient(timeout=120.0) as c:
        r = await c.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)

    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Anthropic: {r.text[:400]}")

    return "".join(b.get("text", "") for b in r.json().get("content", []))


# ── OpenAI ──────────────────────────────────────────────────────────
async def call_openai(prompt: str, model: str, api_key: str, history: list, system_prompt: str):

    messages = [{"role": "system", "content": system_prompt}] + build_messages(prompt, history)

    payload = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 4096,
        "messages": messages
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=120.0) as c:
        r = await c.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)

    if r.status_code != 200:
        raise HTTPException(r.status_code, f"OpenAI: {r.text[:400]}")

    return r.json()["choices"][0]["message"]["content"]


# ── Gemini ──────────────────────────────────────────────────────────
async def call_gemini(prompt: str, model: str, api_key: str, history: list, system_prompt: str):

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    contents = []

    for h in (history or []):
        role = "user" if h.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": h.content}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096
        }
    }

    async with httpx.AsyncClient(timeout=120.0) as c:
        r = await c.post(url, json=payload)

    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Gemini: {r.text[:400]}")

    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


# ── Groq ────────────────────────────────────────────────────────────
async def call_groq(prompt: str, model: str, api_key: str, history: list, system_prompt: str):

    messages = [{"role": "system", "content": system_prompt}] + build_messages(prompt, history)

    payload = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 4096,
        "messages": messages
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=120.0) as c:
        r = await c.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)

    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Groq: {r.text[:400]}")

    return r.json()["choices"][0]["message"]["content"]
