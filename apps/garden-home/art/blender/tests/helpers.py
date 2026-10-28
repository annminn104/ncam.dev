"""Shared helpers for the Blender integration tests (system Python, spawns Blender headless)."""
import json
import os
import struct
import subprocess

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLENDER_DIR = os.path.join(REPO, "blender")
SCRIPTS_DIR = os.path.join(BLENDER_DIR, "scripts")
DEFAULT_BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"


def blender_bin():
    return os.environ.get("BLENDER_BIN", DEFAULT_BLENDER)


def blender_available():
    return os.path.exists(blender_bin())


def run_blender(blend, script, *args, pre_expr=None):
    """Runs scripts/<script> on <blend>; pre_expr (Python source) runs first, to tweak the scene in memory."""
    pre = ["--python-expr", pre_expr] if pre_expr else []
    cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1",
           blend, *pre, "-P", os.path.join(SCRIPTS_DIR, script), "--", *args]
    return subprocess.run(cmd, capture_output=True, text=True)


def run_blender_expr(expr):
    """Runs a Python expression in a fresh headless Blender (no .blend loaded)."""
    cmd = [blender_bin(), "-b", "--factory-startup", "--python-exit-code", "1", "--python-expr", expr]
    return subprocess.run(cmd, capture_output=True, text=True)


def glb_triangle_count(gltf):
    """Triangles of every TRIANGLES primitive (mode 4, the default) in a parsed glTF JSON."""
    total = 0
    for mesh in gltf["meshes"]:
        for primitive in mesh["primitives"]:
            if primitive.get("mode", 4) == 4:
                total += gltf["accessors"][primitive["indices"]]["count"] // 3
    return total


def read_glb_json(path):
    return read_glb(path)[0]


def read_glb(path):
    """The parsed JSON chunk and the raw BIN chunk (b"" when there is none) of a .glb."""
    with open(path, "rb") as f:
        data = f.read()
    (length,) = struct.unpack("<I", data[12:16])
    gltf = json.loads(data[20:20 + length].decode("utf-8"))
    start = 20 + length
    if start + 8 > len(data):
        return gltf, b""
    (bin_length,) = struct.unpack("<I", data[start:start + 4])
    return gltf, data[start + 8:start + 8 + bin_length]


_COMPONENTS = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}
_WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def accessor_rows(gltf, binary, index):
    """Every element of accessor `index` as a tuple (plain, non-sparse accessors: what the raw Blender export writes)."""
    accessor = gltf["accessors"][index]
    view = gltf["bufferViews"][accessor["bufferView"]]
    fmt = "<" + _COMPONENTS[accessor["componentType"]] * _WIDTHS[accessor["type"]]
    stride = view.get("byteStride", struct.calcsize(fmt))
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    return [struct.unpack_from(fmt, binary, start + i * stride) for i in range(accessor["count"])]
