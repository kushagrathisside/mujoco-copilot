import os
import httpx


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")


QUERY_SYSTEM = """
You are a MuJoCo robotics expert.
Answer questions about MuJoCo XML robot models clearly and concisely.
Do NOT modify any XML.
"""


async def process_query(req):

    provider = req.provider.lower()
    model = req.model or OLLAMA_MODEL
    key = req.api_key or os.getenv(f"{provider.upper()}_API_KEY", "")

    if provider == "ollama":

        payload = {
            "model": model,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 1024
            },
            "messages": [
                {"role": "system", "content": QUERY_SYSTEM},
                {"role": "user", "content": req.prompt}
            ]
        }

        async with httpx.AsyncClient(timeout=300.0) as c:
            r = await c.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)

        return {"answer": r.json().get("message", {}).get("content", "")}

    return {"answer": "Provider not supported for queries."}