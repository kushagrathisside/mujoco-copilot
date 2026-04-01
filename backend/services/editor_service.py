from fastapi import HTTPException
import os

from llm.providers import (
    call_ollama,
    call_openai,
    call_anthropic,
    call_gemini,
    call_groq
)

from mjcf.patch_engine import apply_xml_patch
from mjcf.validator import validate_mjcf

from schemas.requests import EditRequest


OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")


async def process_edit(req: EditRequest, system_prompt: str):

    provider = req.provider.lower()
    history = req.history or []

    MAX_XML_CHARS = 20000
    xml = req.xml

    if xml and len(xml) > MAX_XML_CHARS:
        xml = xml[:MAX_XML_CHARS]

    try:

        if provider == "ollama":

            model = req.model or OLLAMA_MODEL
            result = await call_ollama(req.prompt, model, history, system_prompt)

        elif provider == "anthropic":

            key = req.api_key or os.getenv("ANTHROPIC_API_KEY", "")
            if not key:
                raise HTTPException(400, "Anthropic API key required")

            model = req.model or "claude-sonnet-4-20250514"
            result = await call_anthropic(req.prompt, model, key, history, system_prompt)

        elif provider == "openai":

            key = req.api_key or os.getenv("OPENAI_API_KEY", "")
            if not key:
                raise HTTPException(400, "OpenAI API key required")

            model = req.model or "gpt-4o"
            result = await call_openai(req.prompt, model, key, history, system_prompt)

        elif provider == "gemini":

            key = req.api_key or os.getenv("GOOGLE_API_KEY", "")
            if not key:
                raise HTTPException(400, "Google API key required")

            model = req.model or "gemini-1.5-pro"
            result = await call_gemini(req.prompt, model, key, history, system_prompt)

        elif provider == "groq":

            key = req.api_key or os.getenv("GROQ_API_KEY", "")
            if not key:
                raise HTTPException(400, "Groq API key required")

            model = req.model or "llama-3.3-70b-versatile"
            result = await call_groq(req.prompt, model, key, history, system_prompt)

        else:
            raise HTTPException(400, f"Unknown provider: {provider}")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(502, str(e))

    if not isinstance(result, dict):
        raise HTTPException(502, "Invalid LLM response format")

    xml_out = result.get("xml")

    if result.get("strategy") == "patch":

        operations = result.get("operations", [])

        try:
            xml_out = apply_xml_patch(req.xml, operations)

        except Exception as e:
            raise HTTPException(500, f"Patch application failed: {e}")

    if not xml_out:
        xml_out = xml if xml else req.xml

    validate_mjcf(xml_out)

    return {
        "strategy": result.get("strategy", "full_rewrite"),
        "reasoning": result.get("reasoning", ""),
        "xml": xml_out,
        "changes": result.get("changes", []),
        "model_used": model,
        "provider": provider,
    }