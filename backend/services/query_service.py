import os
import time
import httpx
from fastapi import HTTPException

from llm.providers import sanitize_ollama_num_predict, sanitize_ollama_timeout
from utils.action_logger import log_action, summarize_text


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "1024"))


QUERY_SYSTEM = """
You are a MuJoCo robotics expert.
Answer questions about MuJoCo XML robot models clearly and concisely.
Do NOT modify any XML.
"""


async def process_query(req):

    provider = req.provider.lower()
    model = req.model or OLLAMA_MODEL
    started_at = time.perf_counter()
    log_query_event("llm_query_started", req, provider, model, started_at)
    env_key_map = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "gemini": "GOOGLE_API_KEY",
        "groq": "GROQ_API_KEY",
    }
    key = req.api_key or os.getenv(env_key_map.get(provider, ""), "")

    if provider == "ollama":
        timeout_seconds = sanitize_ollama_timeout(req.ollama_timeout_seconds)
        num_predict = sanitize_ollama_num_predict(req.ollama_num_predict)

        payload = {
            "model": model,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": num_predict
            },
            "messages": [
                {"role": "system", "content": QUERY_SYSTEM},
                {"role": "user", "content": req.prompt}
            ]
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as c:
            r = await c.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)

        answer = r.json().get("message", {}).get("content", "")
        log_query_event("llm_query_completed", req, provider, model, started_at, {"answer": summarize_text(answer)})
        return {"answer": answer}

    if provider == "anthropic":
        if not key:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": "Anthropic API key required", "status_code": 400})
            raise HTTPException(400, "Anthropic API key required")

        payload = {
            "model": model or "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "system": QUERY_SYSTEM,
            "messages": [{"role": "user", "content": req.prompt}],
        }

        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
        if r.status_code != 200:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": r.text[:400], "status_code": r.status_code})
            raise HTTPException(r.status_code, f"Anthropic query failed: {r.text[:400]}")

        answer = "".join(block.get("text", "") for block in r.json().get("content", []))
        log_query_event("llm_query_completed", req, provider, model, started_at, {"answer": summarize_text(answer)})
        return {"answer": answer}

    if provider == "openai":
        if not key:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": "OpenAI API key required", "status_code": 400})
            raise HTTPException(400, "OpenAI API key required")

        payload = {
            "model": model or "gpt-4o",
            "temperature": 0.2,
            "max_tokens": 1024,
            "messages": [
                {"role": "system", "content": QUERY_SYSTEM},
                {"role": "user", "content": req.prompt},
            ],
        }

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
        if r.status_code != 200:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": r.text[:400], "status_code": r.status_code})
            raise HTTPException(r.status_code, f"OpenAI query failed: {r.text[:400]}")

        answer = r.json()["choices"][0]["message"]["content"]
        log_query_event("llm_query_completed", req, provider, model, started_at, {"answer": summarize_text(answer)})
        return {"answer": answer}

    if provider == "gemini":
        if not key:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": "Google API key required", "status_code": 400})
            raise HTTPException(400, "Google API key required")

        payload = {
            "system_instruction": {"parts": [{"text": QUERY_SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": req.prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
            },
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model or 'gemini-1.5-pro'}:generateContent?key={key}"

        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post(url, json=payload)
        if r.status_code != 200:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": r.text[:400], "status_code": r.status_code})
            raise HTTPException(r.status_code, f"Gemini query failed: {r.text[:400]}")

        answer = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        log_query_event("llm_query_completed", req, provider, model, started_at, {"answer": summarize_text(answer)})
        return {"answer": answer}

    if provider == "groq":
        if not key:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": "Groq API key required", "status_code": 400})
            raise HTTPException(400, "Groq API key required")

        payload = {
            "model": model or "llama-3.3-70b-versatile",
            "temperature": 0.2,
            "max_tokens": 1024,
            "messages": [
                {"role": "system", "content": QUERY_SYSTEM},
                {"role": "user", "content": req.prompt},
            ],
        }

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
        if r.status_code != 200:
            log_query_event("llm_query_failed", req, provider, model, started_at, {"error": r.text[:400], "status_code": r.status_code})
            raise HTTPException(r.status_code, f"Groq query failed: {r.text[:400]}")

        answer = r.json()["choices"][0]["message"]["content"]
        log_query_event("llm_query_completed", req, provider, model, started_at, {"answer": summarize_text(answer)})
        return {"answer": answer}

    log_query_event("llm_query_failed", req, provider, model, started_at, {"error": "Provider not supported"})
    return {"answer": "Provider not supported for queries."}


def log_query_event(event_type, req, provider, model, started_at, extra=None):
    details = {
        "provider": provider,
        "model": model,
        "duration_ms": round((time.perf_counter() - started_at) * 1000),
        "prompt": summarize_text(req.prompt),
    }
    if provider == "ollama":
        details["ollama_timeout_seconds"] = req.ollama_timeout_seconds
        details["ollama_num_predict"] = req.ollama_num_predict
    details.update(extra or {})
    log_action(event_type, details=details)
