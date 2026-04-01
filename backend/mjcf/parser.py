import xml.etree.ElementTree as ET
from fastapi import HTTPException


def parse_xml_ast(xml_string: str):

    try:
        return ET.fromstring(xml_string)

    except ET.ParseError as e:
        raise HTTPException(400, f"Invalid XML: {e}")


def serialize_xml_ast(root):

    return ET.tostring(root, encoding="unicode")