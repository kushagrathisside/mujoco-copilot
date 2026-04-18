import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from utils.action_logger import redact_secrets, sanitize, summarize_text  # noqa: E402


def test_sanitize_redacts_secret_fields_and_values():
    details = {
        "api_key": "sk-secret1234567890",
        "nested": {
            "authorization": "Bearer gsk_secret1234567890",
            "note": "token sk-ant-secret1234567890 should not leak",
        },
    }

    cleaned = sanitize(details)

    assert cleaned["api_key"] == "[redacted]"
    assert cleaned["nested"]["authorization"] == "[redacted]"
    assert "[redacted]" in cleaned["nested"]["note"]


def test_summarize_text_uses_hash_without_content_by_default():
    summary = summarize_text("line 1\nline 2", include_content=False)

    assert summary["chars"] == 13
    assert summary["lines"] == 2
    assert summary["sha256"]
    assert "content" not in summary


def test_redact_secrets_handles_common_provider_key_shapes():
    text = "sk-abc1234567890 gsk_abc1234567890 AIzaabc12345678901234567890"

    redacted = redact_secrets(text)

    assert "sk-abc" not in redacted
    assert "gsk_abc" not in redacted
    assert "AIza" not in redacted
