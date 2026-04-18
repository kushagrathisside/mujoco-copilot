import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


ROOT_DIR = Path(__file__).resolve().parents[2]
LOG_DIR = Path(os.getenv("ACTION_LOG_DIR", ROOT_DIR / "logs"))
LOG_FILE = LOG_DIR / "activity.jsonl"
INCLUDE_CONTENT = os.getenv("ACTION_LOG_INCLUDE_CONTENT", "false").lower() == "true"
MAX_CONTENT_CHARS = int(os.getenv("ACTION_LOG_MAX_CONTENT_CHARS", "2000"))

SECRET_KEYWORDS = ("api_key", "authorization", "password", "secret", "token")
SECRET_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{12,}"),
    re.compile(r"sk-ant-[A-Za-z0-9_-]{12,}"),
    re.compile(r"gsk_[A-Za-z0-9_-]{12,}"),
    re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
)


def log_action(event_type: str, source: str = "backend", details: Optional[Dict[str, Any]] = None) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "event_type": event_type,
        "details": sanitize(details or {}),
    }

    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")


def get_activity_log_path() -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.touch(exist_ok=True)
    return LOG_FILE


def summarize_text(value: Optional[str], include_content: bool = INCLUDE_CONTENT) -> Dict[str, Any]:
    text = value or ""
    summary = {
        "chars": len(text),
        "lines": text.count("\n") + 1 if text else 0,
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest() if text else "",
    }

    if include_content:
        summary["content"] = redact_secrets(text[:MAX_CONTENT_CHARS])
        summary["truncated"] = len(text) > MAX_CONTENT_CHARS

    return summary


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if any(secret in str(key).lower() for secret in SECRET_KEYWORDS):
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = sanitize(item)
        return cleaned

    if isinstance(value, list):
        return [sanitize(item) for item in value]

    if isinstance(value, str):
        return redact_secrets(value)

    return value


def redact_secrets(text: str) -> str:
    redacted = text
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub("[redacted]", redacted)
    return redacted
