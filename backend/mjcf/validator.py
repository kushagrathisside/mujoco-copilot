from mjcf.parser import parse_xml_ast
from fastapi import HTTPException


def validate_mjcf(xml_string: str):

    root = parse_xml_ast(xml_string)
    errors = []

    if root.tag != "mujoco":
        errors.append("Root element must be <mujoco>")

    if root.find("worldbody") is None:
        errors.append("MJCF must contain a <worldbody> element")

    body_names = collect_named(root, "body")
    geom_names = collect_named(root, "geom")
    joint_names = collect_named(root, "joint")
    site_names = collect_named(root, "site")
    material_names = collect_named(root, "material")

    errors.extend(find_duplicate_name_errors(root, ("body", "geom", "joint", "site", "material")))

    for body in root.findall(".//body"):

        geoms = body.findall("geom")

        if len(geoms) == 0:

            errors.append(f"Body '{body.get('name')}' must contain at least one geom")

    for geom in root.findall(".//geom"):
        material = geom.get("material")
        if material and material not in material_names:
            errors.append(f"Geom '{geom.get('name')}' references missing material '{material}'")

    for actuator in root.findall(".//actuator/*"):
        joint = actuator.get("joint")
        if joint and joint not in joint_names:
            errors.append(f"Actuator '{actuator.get('name')}' references missing joint '{joint}'")

    for sensor in root.findall(".//sensor/*"):
        check_reference(errors, sensor, "joint", joint_names)
        check_reference(errors, sensor, "body", body_names)
        check_reference(errors, sensor, "geom", geom_names)
        check_reference(errors, sensor, "site", site_names)

    if errors:
        raise HTTPException(400, "; ".join(errors))

    return True


def collect_named(root, tag):
    return {
        element.get("name")
        for element in root.findall(f".//{tag}")
        if element.get("name")
    }


def find_duplicate_name_errors(root, tags):
    errors = []

    for tag in tags:
        seen = set()
        duplicates = set()

        for element in root.findall(f".//{tag}"):
            name = element.get("name")
            if not name:
                continue
            if name in seen:
                duplicates.add(name)
            seen.add(name)

        for name in sorted(duplicates):
            errors.append(f"Duplicate <{tag}> name '{name}'")

    return errors


def check_reference(errors, element, attr, valid_names):
    value = element.get(attr)

    if value and value not in valid_names:
        errors.append(
            f"Sensor '{element.get('name')}' references missing {attr} '{value}'"
        )
