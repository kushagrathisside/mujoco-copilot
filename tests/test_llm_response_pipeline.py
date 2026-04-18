import json
import sys
from pathlib import Path

import pytest


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from llm.response_pipeline import (  # noqa: E402
    LLMResponseBusinessError,
    LLMResponseMJCFValidationError,
    LLMResponseSchemaError,
    parse_and_normalize_response,
    run_llm_response_pipeline,
)


VALID_XML = (
    '<mujoco model="robot">'
    "<worldbody>"
    '<body name="base">'
    '<geom name="base_geom" type="sphere" size="0.1"/>'
    '<joint name="hinge" type="hinge" axis="0 0 1"/>'
    "</body>"
    "</worldbody>"
    '<actuator><motor name="hinge_motor" joint="hinge"/></actuator>'
    "</mujoco>"
)


def test_repairs_noisy_markdown_json():
    raw = (
        "Here is the update:\n"
        "```json\n"
        f"{{strategy: 'full_rewrite', xml: {VALID_XML!r}, changes: ['added base',],}}\n"
        "```\n"
        "Done."
    )

    result = run_llm_response_pipeline(raw, VALID_XML)

    assert result.xml == VALID_XML
    assert result.strategy == "full_rewrite"
    assert result.changes == ["added base"]


def test_raw_xml_recovery_only_after_json_parse_failure():
    raw = f"```xml\n{VALID_XML}\n```"

    result = run_llm_response_pipeline(raw, VALID_XML)

    assert result.xml == VALID_XML
    assert result.recovered_from_raw_xml is True
    assert result.changes == []


def test_missing_xml_fails_even_when_other_fields_exist():
    raw = json.dumps({"reasoning": "The XML would contain <mujoco></mujoco>."})

    with pytest.raises(LLMResponseSchemaError, match="missing required 'xml'"):
        parse_and_normalize_response(raw)


def test_invalid_mjcf_reference_fails_validation():
    invalid_xml = (
        '<mujoco model="robot">'
        "<worldbody>"
        '<body name="base"><geom type="sphere" size="0.1"/></body>'
        "</worldbody>"
        '<actuator><motor name="bad_motor" joint="missing_joint"/></actuator>'
        "</mujoco>"
    )
    raw = json.dumps({"xml": invalid_xml})

    with pytest.raises(LLMResponseMJCFValidationError, match="missing joint"):
        run_llm_response_pipeline(raw, VALID_XML)


def test_patch_strategy_applies_patch_engine():
    raw = json.dumps({
        "strategy": "patch",
        "xml": VALID_XML,
        "operations": [{"op": "set_body_pos", "body": "base", "pos": "1 0 0"}],
    })

    result = run_llm_response_pipeline(raw, VALID_XML)

    assert result.strategy == "patch"
    assert 'pos="1 0 0"' in result.xml


def test_patch_strategy_fails_when_operation_references_missing_target():
    raw = json.dumps({
        "strategy": "patch",
        "xml": VALID_XML,
        "operations": [{"op": "set_body_pos", "body": "missing", "pos": "1 0 0"}],
    })

    with pytest.raises(LLMResponseBusinessError, match="references missing body"):
        run_llm_response_pipeline(raw, VALID_XML)
