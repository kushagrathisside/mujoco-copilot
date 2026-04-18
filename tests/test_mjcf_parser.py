import sys
from pathlib import Path

import pytest
from fastapi import HTTPException


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from mjcf.parser import parse_xml_ast  # noqa: E402


def test_parse_xml_ast_includes_line_context_for_parse_errors():
    broken_xml = "\n".join([
        "<mujoco>",
        "  <worldbody>",
        "    <body name=\"torso\">",
        "      <geom type=\"box\" size=\"0.2 0.2 0.2\"",
        "    </body>",
        "  </worldbody>",
        "</mujoco>",
    ])

    with pytest.raises(HTTPException) as exc_info:
        parse_xml_ast(broken_xml)

    detail = str(exc_info.value.detail)
    assert "Invalid XML:" in detail
    assert "XML context:" in detail
    assert "4 |       <geom type=\"box\" size=\"0.2 0.2 0.2\"" in detail
    assert "> 5 |     </body>" in detail
    assert "^" in detail
