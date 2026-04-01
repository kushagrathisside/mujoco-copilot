from mjcf.parser import parse_xml_ast


def build_robot_graph(xml_string: str):

    root = parse_xml_ast(xml_string)

    graph = {
        "nodes": [],
        "edges": []
    }

    worldbody = root.find("worldbody")

    if worldbody is None:
        return graph

    def traverse(body, parent=None):

        body_name = body.get("name")

        graph["nodes"].append({
            "id": body_name,
            "type": "body"
        })

        if parent:
            graph["edges"].append({
                "from": parent,
                "to": body_name,
                "type": "body_link"
            })

        for joint in body.findall("joint"):

            joint_name = joint.get("name")

            graph["nodes"].append({
                "id": joint_name,
                "type": "joint",
                "joint_type": joint.get("type")
            })

            graph["edges"].append({
                "from": parent,
                "to": joint_name,
                "type": "joint_connection"
            })

            graph["edges"].append({
                "from": joint_name,
                "to": body_name,
                "type": "joint_connection"
            })

        for child in body.findall("body"):
            traverse(child, body_name)

    for body in worldbody.findall("body"):
        traverse(body)

    return graph