import xml.etree.ElementTree as ET
from mjcf.parser import parse_xml_ast, serialize_xml_ast


def apply_xml_patch(xml_string: str, operations: list):

    root = parse_xml_ast(xml_string)

    for op in operations:

        if op.get("op") == "add_geom":

            body_name = op.get("parent_body")

            body = root.find(f".//body[@name='{body_name}']")

            if body is None:
                continue

            geom = ET.SubElement(body, "geom")

            for k, v in op.items():
                if k not in ["op", "parent_body"]:
                    geom.set(k, str(v))


        elif op.get("op") == "modify_joint":

            joint_name = op.get("joint")

            joint = root.find(f".//joint[@name='{joint_name}']")

            if joint is None:
                continue

            for k, v in op.items():
                if k not in ["op", "joint"]:
                    joint.set(k, str(v))


        elif op.get("op") == "delete_body":

            body_name = op.get("body")

            for parent in root.iter():

                for child in list(parent):

                    if child.tag == "body" and child.get("name") == body_name:
                        parent.remove(child)


        elif op.get("op") == "set_body_pos":

            body = root.find(f".//body[@name='{op.get('body')}']")

            if body is not None:
                body.set("pos", op.get("pos"))


    return serialize_xml_ast(root)