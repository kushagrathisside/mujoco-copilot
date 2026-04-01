from mjcf.parser import parse_xml_ast


def build_body_tree(body):

    node = {
        "name": body.get("name"),
        "pos": body.get("pos"),
        "children": []
    }

    for child in body.findall("body"):
        node["children"].append(build_body_tree(child))

    return node


def analyze_robot_structure(xml_string: str):

    root = parse_xml_ast(xml_string)

    robot = {
        "model": root.get("model"),
        "body_tree": None,
        "joints": [],
        "actuators": [],
        "sensors": []
    }

    worldbody = root.find("worldbody")

    if worldbody is not None:

        bodies = worldbody.findall("body")

        robot["body_tree"] = [
            build_body_tree(body) for body in bodies
        ]

    # joints
    for joint in root.findall(".//joint"):

        robot["joints"].append({
            "name": joint.get("name"),
            "type": joint.get("type"),
            "range": joint.get("range")
        })

    # actuators
    for motor in root.findall(".//actuator/motor"):

        robot["actuators"].append({
            "joint": motor.get("joint"),
            "gear": motor.get("gear")
        })

    # sensors
    for sensor in root.findall(".//sensor/*"):

        robot["sensors"].append({
            "type": sensor.tag,
            "name": sensor.get("name"),
            "joint": sensor.get("joint")
        })

    return robot