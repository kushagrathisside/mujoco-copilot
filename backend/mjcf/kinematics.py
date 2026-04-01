from collections import deque
from mjcf.graph_builder import build_robot_graph


def find_kinematic_path(xml_string, start_body, end_body):

    graph = build_robot_graph(xml_string)

    adj = {}

    for edge in graph["edges"]:

        a = edge["from"]
        b = edge["to"]

        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)

    queue = deque([(start_body, [start_body])])
    visited = set()

    while queue:

        node, path = queue.popleft()

        if node == end_body:
            return path

        visited.add(node)

        for neighbor in adj.get(node, []):

            if neighbor not in visited:
                queue.append((neighbor, path + [neighbor]))

    return None