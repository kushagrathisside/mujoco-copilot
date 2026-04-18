from dataclasses import dataclass, replace
from typing import Any, Dict, List, Optional

from llm.json_parser import LLMJSONParseError, parse_json_with_repair
from mjcf.patch_engine import apply_xml_patch
from mjcf.validator import validate_mjcf


class LLMResponseError(ValueError):
    pass


class LLMResponseParseError(LLMResponseError):
    pass


class LLMResponseSchemaError(LLMResponseError):
    pass


class LLMResponseBusinessError(LLMResponseError):
    pass


class LLMResponseMJCFValidationError(LLMResponseError):
    pass


@dataclass(frozen=True)
class LLMResponse:
    xml: str
    changes: List[str]
    reasoning: str
    strategy: str
    operations: List[Dict[str, Any]]
    recovered_from_raw_xml: bool = False


ALLOWED_RESPONSE_FIELDS = {"xml", "changes", "reasoning", "strategy", "operations"}


def run_llm_response_pipeline(raw: str, original_xml: str) -> LLMResponse:
    response = parse_and_normalize_response(raw)
    response = apply_response_business_logic(response, original_xml)
    validate_response_mjcf(response.xml)
    return response


def parse_and_normalize_response(raw: str) -> LLMResponse:
    try:
        payload = parse_json_with_repair(raw)
    except LLMJSONParseError as e:
        raw_xml = extract_raw_mujoco_xml(raw)

        if raw_xml is None:
            raise LLMResponseParseError(
                "LLM response could not be parsed as JSON and did not contain "
                f"raw <mujoco> XML. JSON error: {e}. Excerpt: {excerpt(raw)}"
            ) from e

        payload = {"xml": raw_xml}
        return normalize_response(validate_response_schema(payload), recovered_from_raw_xml=True)

    return normalize_response(validate_response_schema(payload))


def validate_response_schema(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise LLMResponseSchemaError(
            f"LLM response root must be an object, got {type(payload).__name__}"
        )

    extra_fields = sorted(set(payload) - ALLOWED_RESPONSE_FIELDS)
    if extra_fields:
        raise LLMResponseSchemaError(
            "LLM response contains unsupported field(s): " + ", ".join(extra_fields)
        )

    if "xml" not in payload:
        raise LLMResponseSchemaError("LLM response missing required 'xml' field")

    if not isinstance(payload["xml"], str) or not payload["xml"].strip():
        raise LLMResponseSchemaError("LLM response field 'xml' must be a non-empty string")

    if "changes" in payload:
        changes = payload["changes"]
        if not isinstance(changes, list) or any(not isinstance(item, str) for item in changes):
            raise LLMResponseSchemaError("LLM response field 'changes' must be a list of strings")

    if "reasoning" in payload and not isinstance(payload["reasoning"], str):
        raise LLMResponseSchemaError("LLM response field 'reasoning' must be a string")

    if "strategy" in payload and not isinstance(payload["strategy"], str):
        raise LLMResponseSchemaError("LLM response field 'strategy' must be a string")

    strategy = payload.get("strategy", "full_rewrite")
    has_operations = "operations" in payload

    if has_operations:
        operations = payload["operations"]
        if not isinstance(operations, list) or any(not isinstance(item, dict) for item in operations):
            raise LLMResponseSchemaError("LLM response field 'operations' must be a list of objects")

    if strategy == "patch" and not payload.get("operations"):
        raise LLMResponseSchemaError("LLM patch responses require a non-empty 'operations' list")

    if strategy != "patch" and has_operations:
        raise LLMResponseSchemaError("LLM response field 'operations' is only valid for patch strategy")

    return payload


def normalize_response(payload: Dict[str, Any], recovered_from_raw_xml: bool = False) -> LLMResponse:
    return LLMResponse(
        xml=payload["xml"].strip(),
        changes=payload.get("changes", []),
        reasoning=payload.get("reasoning", ""),
        strategy=payload.get("strategy", "full_rewrite"),
        operations=payload.get("operations", []),
        recovered_from_raw_xml=recovered_from_raw_xml,
    )


def apply_response_business_logic(response: LLMResponse, original_xml: str) -> LLMResponse:
    if response.strategy != "patch":
        return replace(response, strategy="full_rewrite")

    try:
        xml_out = apply_xml_patch(original_xml, response.operations)
    except Exception as e:
        raise LLMResponseBusinessError(f"Patch application failed: {format_error(e)}") from e

    return replace(response, xml=xml_out, strategy="patch")


def validate_response_mjcf(xml: str) -> None:
    try:
        validate_mjcf(xml)
    except Exception as e:
        raise LLMResponseMJCFValidationError(f"Invalid MJCF: {format_error(e)}") from e


def extract_raw_mujoco_xml(raw: str) -> Optional[str]:
    text = (raw or "").strip()
    start = text.find("<mujoco")

    if start == -1:
        return None

    closing_tag = "</mujoco>"
    end = text.rfind(closing_tag)

    if end > start:
        return text[start : end + len(closing_tag)].strip()

    tag_end = text.find(">", start)

    if tag_end != -1 and text[tag_end - 1] == "/":
        return text[start : tag_end + 1].strip()

    return None


def excerpt(raw: str, max_chars: int = 400) -> str:
    text = " ".join((raw or "").strip().split())
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."


def format_error(error: Exception) -> str:
    detail = getattr(error, "detail", None)
    if detail:
        return str(detail)
    return str(error)
