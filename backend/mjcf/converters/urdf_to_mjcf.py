import xml.etree.ElementTree as ET


def parse_origin(origin):

    if origin is None:
        return "0 0 0"

    xyz = origin.get("xyz", "0 0 0")

    return xyz

def register_mesh(asset, filename):

    name = filename.split("/")[-1].split(".")[0]

    ET.SubElement(
        asset,
        "mesh",
        {
            "name": name,
            "file": filename
        }
    )

    return name

def convert_geometry(geom_parent, geometry, asset=None):

    if geometry is None:
        return

    mesh = geometry.find("mesh")

    if mesh is not None:

        filename = mesh.get("filename")

        mesh_name = register_mesh(asset, filename)

        ET.SubElement(
            geom_parent,
            "geom",
            {
                "type": "mesh",
                "mesh": mesh_name,
            },
        )
        return

    box = geometry.find("box")

    if box is not None:

        size = box.get("size")

        ET.SubElement(
            geom_parent,
            "geom",
            {
                "type": "box",
                "size": size,
            },
        )
        return

    cylinder = geometry.find("cylinder")

    if cylinder is not None:

        radius = cylinder.get("radius")
        length = cylinder.get("length")

        ET.SubElement(
            geom_parent,
            "geom",
            {
                "type": "cylinder",
                "size": f"{radius} {length}",
            },
        )
        return

    sphere = geometry.find("sphere")

    if sphere is not None:

        radius = sphere.get("radius")

        ET.SubElement(
            geom_parent,
            "geom",
            {
                "type": "sphere",
                "size": radius,
            },
        )


def urdf_to_mjcf(urdf_string: str):

    urdf_root = ET.fromstring(urdf_string)

    robot_name = urdf_root.get("name", "converted_robot")

    mujoco = ET.Element("mujoco", {"model": robot_name})

    worldbody = ET.SubElement(mujoco, "worldbody")

    asset = ET.SubElement(mujoco, "asset")

    geoms = ET.SubElement(asset, "material", {
        "name": "robot_material",
        "rgba": "0.7 0.7 0.7 1"
    })

    link_map = {}

    # create bodies
    for link in urdf_root.findall("link"):

        name = link.get("name")

        body = ET.SubElement(
            worldbody,
            "body",
            {
                "name": name,
                "pos": "0 0 0",
            },
        )

        link_map[name] = body

        # inertial
        inertial = link.find("inertial")

        if inertial is not None:

            mass = inertial.find("mass")

            if mass is not None:

                ET.SubElement(
                    body,
                    "geom",
                    {
                        "type": "sphere",
                        "size": "0.02",
                        "mass": mass.get("value", "1"),
                    },
                )

        # visual geometry
        visual = link.find("visual")

        if visual is not None:

            geometry = visual.find("geometry")

            convert_geometry(body, geometry)

    # joints
    for joint in urdf_root.findall("joint"):

        parent = joint.find("parent").get("link")
        child = joint.find("child").get("link")

        body = link_map.get(child)

        if body is None:
            continue

        origin = parse_origin(joint.find("origin"))

        joint_type = joint.get("type", "hinge")

        axis = joint.find("axis")

        axis_vec = axis.get("xyz", "0 0 1") if axis is not None else "0 0 1"

        joint_attrib = {
            "name": joint.get("name"),
            "type": joint_type,
            "axis": axis_vec,
            "pos": origin,
        }

        limit = joint.find("limit")

        if limit is not None:

            lower = limit.get("lower")
            upper = limit.get("upper")

            if lower and upper:
                joint_attrib["range"] = f"{lower} {upper}"

        ET.SubElement(body, "joint", joint_attrib)

    return ET.tostring(mujoco, encoding="unicode")