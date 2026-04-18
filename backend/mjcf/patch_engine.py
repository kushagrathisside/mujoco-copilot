import xml.etree.ElementTree as ET
from mjcf.parser import parse_xml_ast, serialize_xml_ast


def apply_xml_patch(xml_string: str, operations: list):
    if not isinstance(operations, list):
        raise ValueError("Patch operations must be a list")

    root = parse_xml_ast(xml_string)

    for index, op in enumerate(operations):
        if not isinstance(op, dict):
            raise ValueError(f"Patch operation #{index + 1} must be an object")

        if op.get("op") == "add_geom":

            body_name = op.get("parent_body")
            if not body_name:
                raise ValueError(f"Patch operation #{index + 1} missing parent_body")

            body = root.find(f".//body[@name='{body_name}']")

            if body is None:
                raise ValueError(f"Patch operation #{index + 1} references missing body '{body_name}'")

            geom = ET.SubElement(body, "geom")

            for k, v in op.items():
                if k not in ["op", "parent_body"]:
                    geom.set(k, str(v))


        elif op.get("op") == "modify_joint":

            joint_name = op.get("joint")
            if not joint_name:
                raise ValueError(f"Patch operation #{index + 1} missing joint")

            joint = root.find(f".//joint[@name='{joint_name}']")

            if joint is None:
                raise ValueError(f"Patch operation #{index + 1} references missing joint '{joint_name}'")

            for k, v in op.items():
                if k not in ["op", "joint"]:
                    joint.set(k, str(v))


        elif op.get("op") == "delete_body":

            body_name = op.get("body")
            if not body_name:
                raise ValueError(f"Patch operation #{index + 1} missing body")

            removed = False
            for parent in root.iter():

                for child in list(parent):

                    if child.tag == "body" and child.get("name") == body_name:
                        parent.remove(child)
                        removed = True

            if not removed:
                raise ValueError(f"Patch operation #{index + 1} references missing body '{body_name}'")


        elif op.get("op") == "set_body_pos":

            body_name = op.get("body")
            pos = op.get("pos")
            if not body_name:
                raise ValueError(f"Patch operation #{index + 1} missing body")
            if pos is None:
                raise ValueError(f"Patch operation #{index + 1} missing pos")

            body = root.find(f".//body[@name='{body_name}']")

            if body is not None:
                body.set("pos", str(pos))
            else:
                raise ValueError(f"Patch operation #{index + 1} references missing body '{body_name}'")

        else:
            raise ValueError(f"Patch operation #{index + 1} has unsupported op '{op.get('op')}'")


    return serialize_xml_ast(root)
