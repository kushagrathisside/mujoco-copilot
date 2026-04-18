import json

from json_repair import loads as repair_json_loads


class LLMJSONParseError(ValueError):
    pass


def extract_json(raw: str) -> dict:
    return parse_json_with_repair(raw)


def parse_json_with_repair(raw: str) -> dict:
    text = (raw or "").strip()

    if not text:
        raise LLMJSONParseError("LLM returned an empty response")

    strict_error = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        strict_error = e
    else:
        if isinstance(parsed, dict):
            return parsed
        raise LLMJSONParseError(
            f"LLM JSON root must be an object, got {type(parsed).__name__}"
        )

    try:
        repaired = repair_json_loads(text)
    except Exception as e:
        raise LLMJSONParseError(
            f"LLM returned invalid JSON and repair failed: {strict_error}; {e}"
        ) from e

    if isinstance(repaired, dict):
        return repaired

    raise LLMJSONParseError(
        f"LLM returned invalid JSON; repair produced {type(repaired).__name__}"
    )
