from fastapi import HTTPException
import os
import time

from llm.providers import (
    call_ollama,
    call_openai,
    call_anthropic,
    call_gemini,
    call_groq
)

from llm.response_pipeline import (
    LLMResponseBusinessError,
    LLMResponseMJCFValidationError,
    LLMResponseParseError,
    LLMResponseSchemaError,
    run_llm_response_pipeline,
)
from utils.action_logger import log_action, summarize_text

from schemas.requests import EditRequest


OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")


async def process_edit(req: EditRequest, system_prompt: str):

    provider = req.provider.lower()
    history = req.history or []
    started_at = time.perf_counter()
    model = req.model or OLLAMA_MODEL

    try:

        if provider == "ollama":

            model = req.model or OLLAMA_MODEL
            log_edit_event("llm_edit_started", req, provider, model, started_at)
            raw_result = await call_ollama(
                req.prompt,
                model,
                history,
                system_prompt,
                timeout_seconds=req.ollama_timeout_seconds,
                num_predict=req.ollama_num_predict,
            )

        elif provider == "anthropic":

            model = req.model or "claude-sonnet-4-20250514"
            key = req.api_key or os.getenv("ANTHROPIC_API_KEY", "")
            if not key:
                raise HTTPException(400, "Anthropic API key required")

            log_edit_event("llm_edit_started", req, provider, model, started_at)
            raw_result = await call_anthropic(req.prompt, model, key, history, system_prompt)

        elif provider == "openai":

            model = req.model or "gpt-4o"
            key = req.api_key or os.getenv("OPENAI_API_KEY", "")
            if not key:
                raise HTTPException(400, "OpenAI API key required")

            log_edit_event("llm_edit_started", req, provider, model, started_at)
            raw_result = await call_openai(req.prompt, model, key, history, system_prompt)

        elif provider == "gemini":

            model = req.model or "gemini-1.5-pro"
            key = req.api_key or os.getenv("GOOGLE_API_KEY", "")
            if not key:
                raise HTTPException(400, "Google API key required")

            log_edit_event("llm_edit_started", req, provider, model, started_at)
            raw_result = await call_gemini(req.prompt, model, key, history, system_prompt)

        elif provider == "groq":

            model = req.model or "llama-3.3-70b-versatile"
            key = req.api_key or os.getenv("GROQ_API_KEY", "")
            if not key:
                raise HTTPException(400, "Groq API key required")

            log_edit_event("llm_edit_started", req, provider, model, started_at)
            raw_result = await call_groq(req.prompt, model, key, history, system_prompt)

        else:
            raise HTTPException(400, f"Unknown provider: {provider}")

    except HTTPException as e:
        log_edit_event(
            "llm_edit_failed",
            req,
            provider,
            model,
            started_at,
            {"error": str(e.detail), "status_code": e.status_code},
        )
        raise
    except ValueError as e:
        log_edit_event("llm_edit_failed", req, provider, model, started_at, {"error": str(e)})
        raise HTTPException(502, str(e))

    try:
        result = run_llm_response_pipeline(raw_result, req.xml)
    except (LLMResponseParseError, LLMResponseSchemaError) as e:
        log_edit_event("llm_edit_failed", req, provider, model, started_at, {"error": str(e), "stage": "parse_schema"})
        raise HTTPException(502, str(e))
    except LLMResponseBusinessError as e:
        log_edit_event("llm_edit_failed", req, provider, model, started_at, {"error": str(e), "stage": "business"})
        raise HTTPException(500, str(e))
    except LLMResponseMJCFValidationError as e:
        print("\n=== VALIDATION ERROR ===")
        print(str(e))
        print("=======================\n")
        log_edit_event("llm_edit_failed", req, provider, model, started_at, {"error": str(e), "stage": "mjcf_validation"})
        raise HTTPException(422, str(e))

    log_edit_event(
        "llm_edit_completed",
        req,
        provider,
        model,
        started_at,
        {
            "strategy": result.strategy,
            "changes_count": len(result.changes),
            "output_xml": summarize_text(result.xml),
        },
    )

    return {
        "strategy": result.strategy,
        "reasoning": result.reasoning,
        "xml": result.xml,
        "changes": result.changes,
        "model_used": model,
        "provider": provider,
    }


def log_edit_event(event_type, req, provider, model, started_at, extra=None):
    details = {
        "provider": provider,
        "model": model,
        "history_count": len(req.history or []),
        "duration_ms": round((time.perf_counter() - started_at) * 1000),
        "prompt": summarize_text(req.prompt),
        "input_xml": summarize_text(req.xml),
    }
    if provider == "ollama":
        details["ollama_timeout_seconds"] = req.ollama_timeout_seconds
        details["ollama_num_predict"] = req.ollama_num_predict
    details.update(extra or {})
    log_action(event_type, details=details)
