from mjcf.parser import parse_xml_ast
from fastapi import HTTPException


def validate_mjcf(xml_string: str):

    root = parse_xml_ast(xml_string)

    for body in root.findall(".//body"):

        geoms = body.findall("geom")

        if len(geoms) == 0:

            raise HTTPException(
                400,
                f"Body '{body.get('name')}' must contain at least one geom"
            )

    return True