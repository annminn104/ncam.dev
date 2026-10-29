"""Client for the Blender Lab MCP addon socket (127.0.0.1:9876).

Same wire protocol as blmcp/tools_helpers/connection.py:
{"type": "execute", "code": ..., "strict_json": false} + NUL, reply JSON + NUL.
Code assigns a JSON-serialisable dict to `result` to return data.

usage: python3 -I bl.py <file.py>      # run file in Blender
       python3 -I bl.py -c "<code>"     # run inline code
"""
import json
import socket
import sys


def send_code(code, timeout=600.0):
    req = json.dumps({"type": "execute", "code": code, "strict_json": False}) + "\0"
    with socket.create_connection(("127.0.0.1", 9876), timeout=timeout) as s:
        s.sendall(req.encode("utf-8"))
        buf = bytearray()
        while b"\0" not in buf:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf.extend(chunk)
    line = bytes(buf).partition(b"\0")[0]
    return json.loads(line.decode("utf-8"))


if __name__ == "__main__":
    if sys.argv[1] == "-c":
        code = sys.argv[2]
    else:
        with open(sys.argv[1]) as f:
            code = f.read()
    r = send_code(code)
    print(json.dumps(r, indent=1, default=repr)[:8000])
