import json
import re


def extract_json(raw: str) -> dict:
    text = raw.strip()

    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    s = text.find("{")
    e = text.rfind("}") + 1

    if s != -1 and e > s:
        try:
            return json.loads(text[s:e])
        except json.JSONDecodeError:
            pass

    repaired = text.replace("'", '"')
    s = repaired.find("{")
    e = repaired.rfind("}") + 1

    if s != -1 and e > s:
        try:
            return json.loads(repaired[s:e])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"LLM returned invalid JSON:\n{raw[:800]}")