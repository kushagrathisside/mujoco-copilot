import xml.etree.ElementTree as ET
from fastapi import HTTPException


def parse_xml_ast(xml_string: str):

    try:
        return ET.fromstring(xml_string)

    except ET.ParseError as e:
        raise HTTPException(400, format_xml_parse_error(xml_string, e))


def serialize_xml_ast(root):

    return ET.tostring(root, encoding="unicode")


def format_xml_parse_error(xml_string: str, error: ET.ParseError, window: int = 2) -> str:
    detail = f"Invalid XML: {error}"
    position = getattr(error, "position", None)

    if not position:
        return detail

    line_no, column_no = position
    lines = xml_string.splitlines()

    if not lines:
        return detail

    start = max(1, line_no - window)
    end = min(len(lines), line_no + window)
    width = len(str(end))
    excerpt = ["XML context:"]

    for current in range(start, end + 1):
        marker = ">" if current == line_no else " "
        excerpt.append(f"{marker} {current:>{width}} | {lines[current - 1]}")

        if current == line_no:
            excerpt.append(f"  {' ' * width} | {' ' * column_no}^")

    return detail + "\n\n" + "\n".join(excerpt)
