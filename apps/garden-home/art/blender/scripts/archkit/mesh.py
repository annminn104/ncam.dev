"""MeshBuilder: accumulate boxes, cylinders and blobs into one mesh object (one object, materials by face index)."""
import contextlib
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

# Box projection: for a face whose normal is mostly along axis k, UVs come from the other two axes.
_UV_AXES = {0: (1, 2), 1: (0, 2), 2: (0, 1)}
# The faces of MeshBuilder.octahedron by point, as create_uvsphere(u_segments=4, v_segments=2) winds them.
_OCTAHEDRON = ((1, 0, 2), (0, 3, 2), (1, 2, 4), (2, 3, 4), (1, 4, 5), (4, 3, 5), (1, 5, 0), (5, 3, 0))


class MeshBuilder:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.materials = []
        self.matrix = None  # set inside a placed() block: where the block's primitives go
        self.block = 0  # inside a placed(..., wind=) block: its number in self.wind, from 1
        self.wind = []  # (z0, z1) of every placed(..., wind=) block

    @contextlib.contextmanager
    def placed(self, pos, rot_z=0.0, wind=None):
        """Builds the block's primitives turned `rot_z` radians about Z and moved to pos (x, y, z), so a piece made in
        its own space (a catalog builder) joins a mesh shared with other pieces: the garden modules merge many pieces
        into a few objects, one draw call per material. wind=(z0, z1) gives the block's vertices a 'wind' weight from 0
        at z0 to 1 at z1 above pos (as planting.paint_wind does for an object); every other vertex of the mesh weighs 0.
        Blocks do not nest."""
        if self.matrix is not None:
            raise ValueError(f"{self.name}: placed() blocks do not nest")
        self.matrix = Matrix.Translation(Vector(pos)) @ Matrix.Rotation(rot_z, 4, "Z")
        if wind is not None:
            self._blocks()  # before the block builds anything
            self.wind.append((pos[2] + wind[0], pos[2] + wind[1]))
            self.block = len(self.wind)
        try:
            yield self
        finally:
            self.matrix, self.block = None, 0

    def _blocks(self):
        """The vertex layer that numbers the wind block a vertex was built in (0: none). A layer and not a list of
        vertices: some bmesh operators (a subdivided icosphere) leave earlier BMVert references dead."""
        layers = self.bm.verts.layers.int
        return layers.get("wind_block") or layers.new("wind_block")

    def box(self, mn, mx, mat, uv_tile=1.0, rot_z=0.0, uv_offset=None):
        """Box between corners mn and mx (metres), turned `rot_z` radians about its own vertical axis (monitors, chair
        spokes); axis-aligned by default. 1 UV unit = uv_tile metres; uv_offset as _finish's."""
        mn, mx = Vector(mn), Vector(mx)
        size = mx - mn
        matrix = Matrix.Translation((mn + mx) / 2)
        if rot_z:
            matrix = matrix @ Matrix.Rotation(rot_z, 4, "Z")
        matrix = matrix @ Matrix.Diagonal((size.x, size.y, size.z, 1.0))
        self._finish(bmesh.ops.create_cube(self.bm, size=1.0, matrix=matrix)["verts"], mat, uv_tile, uv_offset)
        return self

    def cylinder(self, base, radius, height, mat, segments=12, uv_tile=1.0, axis="z"):
        """Upright cylinder; `base` is the centre of its bottom face. axis="y" lays it along +Y from `base` instead
        (the round door of a washing machine)."""
        if axis == "y":
            matrix = Matrix.Translation(Vector(base) + Vector((0.0, height / 2, 0.0))) @ Matrix.Rotation(
                -math.pi / 2, 4, "X")
        elif axis == "z":
            matrix = Matrix.Translation(Vector(base) + Vector((0.0, 0.0, height / 2)))
        else:
            raise ValueError(f"cylinder axis must be 'z' or 'y', got {axis!r}")
        verts = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius,
                                      depth=height, matrix=matrix)["verts"]
        self._finish(verts, mat, uv_tile)
        return self

    def stem(self, start, end, radius, mat, radius_end=None, segments=5, uv_tile=1.0, uv_offset=None):
        """Capped cylinder between two points in any direction, tapering to `radius_end` (vine trunks); 1 UV unit =
        uv_tile metres; uv_offset as _finish's."""
        start, end = Vector(start), Vector(end)
        axis = end - start
        matrix = Matrix.Translation((start + end) / 2) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
        verts = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segments, radius1=radius,
                                      radius2=radius if radius_end is None else radius_end, depth=axis.length,
                                      matrix=matrix)["verts"]
        self._finish(verts, mat, uv_tile, uv_offset)
        return self

    def blob(self, center, radius, mat, subdivisions=2, squash=1.0):
        """Icosphere (shrubs, pillows); squash < 1 flattens it along Z."""
        return self.ellipsoid(center, (radius, radius, radius * squash), mat, subdivisions)

    def octahedron(self, center, radius, mat):
        """Octahedron with its six points `radius` from `center` along the axes: 8 triangles, the cheapest closed ball
        (the bulbs of a string of lights, a few pixels across).

        bmesh.ops.create_uvsphere(u_segments=4, v_segments=2) makes it, but welds its poles in an order that can change
        from run to run once the mesh is big: inside a placed() block (a garden module merging hundreds of flowers into
        one mesh) it is built point by point instead, with the operator's points and faces. Outside, the operator stays,
        so the modules built so far regenerate byte for byte."""
        matrix = Matrix.Translation(Vector(center))
        if self.matrix is None:
            verts = bmesh.ops.create_uvsphere(self.bm, u_segments=4, v_segments=2, radius=radius,
                                              matrix=matrix)["verts"]
        else:
            verts = [self.bm.verts.new(matrix @ Vector(point)) for point in
                     ((0.0, radius, 0.0), (0.0, 0.0, -radius), (radius, 0.0, 0.0), (0.0, 0.0, radius),
                      (0.0, -radius, 0.0), (-radius, 0.0, 0.0))]
            for face in _OCTAHEDRON:
                self.bm.faces.new([verts[i] for i in face])
        self._finish(verts, mat, 1.0)
        return self

    def ellipsoid(self, center, radii, mat, subdivisions=2):
        """Icosphere stretched to the radii (rx, ry, rz) along the axes (eggs, flat cushions)."""
        rx, ry, rz = radii
        matrix = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((rx, ry, rz, 1.0))
        verts = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=1.0, matrix=matrix)["verts"]
        self._finish(verts, mat, 1.0)
        return self

    def leaf(self, base, tip, width, mat, thickness=0.012, belly=0.4, side=None):
        """Flat blade from `base` to `tip` (fronds, fern fingers, paddle leaves): a stretched octahedron of 8 triangles,
        `width` across at `belly` of the way along and `thickness` through. The blade is broad across `side`, a
        direction that need not be exact (it is made square to the blade); by default that is horizontal, so a blade that
        arches or droops shows its upper face to the sky. A blade standing straight up falls back to X."""
        base, tip = Vector(base), Vector(tip)
        axis = tip - base
        if axis.length < 1e-6:
            raise ValueError(f"leaf from {tuple(base)} to {tuple(tip)} has no length")
        axis.normalize()
        across = axis.cross((0.0, 0.0, 1.0)) if side is None else Vector(side)
        across -= axis * across.dot(axis)
        if across.length < 1e-6:
            across = Vector((1.0, 0.0, 0.0)) - axis * axis.x
        across.normalize()
        normal = across.cross(axis)
        middle = base + (tip - base) * belly
        left, right = middle + across * (width / 2), middle - across * (width / 2)
        top, bottom = middle + normal * (thickness / 2), middle - normal * (thickness / 2)
        verts = [self.bm.verts.new(p) for p in (base, tip, left, right, top, bottom)]
        for end in verts[:2]:
            for edge in verts[2:4]:
                for face in verts[4:]:
                    corners = (end.co, edge.co, face.co)
                    outward = (corners[1] - corners[0]).cross(corners[2] - corners[0]).dot(sum(corners, Vector()) / 3 - middle)
                    self.bm.faces.new((end, edge, face) if outward > 0 else (end, face, edge))
        self._finish(verts, mat, 1.0)
        return self

    def slab(self, points, z0, z1, mat, uv_tile=1.0):
        """Upright prism from z0 to z1 over the convex polygon `points` (x, y), whichever way they wind: a driveway
        whose end follows a slanted gate, a paving stone that is not a rectangle. Four points cost what a box does."""
        area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]))
        ring = list(points) if area > 0 else list(reversed(points))  # counter-clockwise seen from above
        bottom = [self.bm.verts.new((x, y, z0)) for x, y in ring]
        top = [self.bm.verts.new((x, y, z1)) for x, y in ring]
        self.bm.faces.new(top)
        self.bm.faces.new(list(reversed(bottom)))
        for i in range(len(ring)):
            j = (i + 1) % len(ring)
            self.bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
        self._finish(bottom + top, mat, uv_tile)
        return self

    def disc(self, center, radius, mat, segments=12, start=0.0, sweep=2 * math.pi):
        """Flat fan facing up around `center` (x, y, z), `radius` across, from angle `start` through `sweep` radians
        (counter-clockwise from +X; a full turn by default) in round(segments * sweep / 2 pi) triangles: the pool of
        light under a garden lamp. Its UVs run outwards, u from 0 at the centre to 1 on the rim at v 0.5, so the
        website fades it out with a gradient instead of a texture of its own (prepareModule, GLOW_*)."""
        steps = max(1, round(segments * sweep / (2 * math.pi)))
        x, y, z = center
        middle = self.bm.verts.new((x, y, z))
        rim = [self.bm.verts.new((x + radius * math.cos(start + sweep * k / steps),
                                  y + radius * math.sin(start + sweep * k / steps), z))
               for k in range(steps + (0 if math.isclose(sweep, 2 * math.pi) else 1))]
        faces = [self.bm.faces.new((middle, a, b)) for a, b in list(zip(rim, rim[1:] + rim[:1]))[:steps]]
        self._finish([middle] + rim, mat, 1.0)
        for face in faces:
            for loop in face.loops:
                loop[self.uv].uv = (0.0 if loop.vert is middle else 1.0, 0.5)
        return self

    def wash(self, center, radius, mat, facing, segments=8, height=None):
        """Upright half disc standing on `center` (x, y, z), `radius` across and `height` up (a half ellipse; radius by
        default; a negative height hangs it down from `center`, the light a cove washes down a wall with), facing
        `facing` (radians from +X in the ground plane): the light a ground uplight washes up a wall with, laid a few
        millimetres off the wall's face. Its UVs run outwards as a disc's do (u from 0 at the centre to 1 on the rim, v
        0.5), so the website fades it out the same way (GLOW_*)."""
        x, y, z = center
        up = radius if height is None else height
        tx, ty = -math.sin(facing), math.cos(facing)  # along the wall's face
        middle = self.bm.verts.new((x, y, z))
        rim = [self.bm.verts.new((x + tx * radius * math.cos(a), y + ty * radius * math.cos(a), z + up * math.sin(a)))
               for a in (math.pi * k / segments for k in range(segments + 1))]
        faces = [self.bm.faces.new((middle, a, b) if up > 0 else (middle, b, a)) for a, b in zip(rim, rim[1:])]
        self._finish([middle] + rim, mat, 1.0)
        for face in faces:
            for loop in face.loops:
                loop[self.uv].uv = (0.0 if loop.vert is middle else 1.0, 0.5)
        return self

    def faces(self, points, faces, mat, uv_tile=1.0):
        """Any piece of mesh in one material: the `faces` over `points` (x, y, z), each face a tuple of indices into
        points, counter-clockwise seen from outside (the faceted rocks of a rockery, a koi, the bank of a pond). Only
        the points a face uses become vertices, so one set of points can be split between materials by calling this once
        per material with its faces (the seams are flat shaded anyway). Placed and box-projected like the other
        primitives."""
        if not faces:  # no material slot for a part that has no faces
            return self
        made = {}
        for face in faces:
            for i in face:
                if i not in made:
                    made[i] = self.bm.verts.new(points[i])
            self.bm.faces.new([made[i] for i in face])
        self._finish(list(made.values()), mat, uv_tile)
        return self

    def _finish(self, verts, mat, uv_tile, uv_offset=None):
        """Moves the primitive where a placed() block puts it, gives its faces `mat` and box-projected UVs (1 unit =
        uv_tile metres) from where they end up; with uv_offset=(du, dv) from where the builder made them instead (the
        piece's own space, before placed() moves it), shifted by (du, dv): a small piece of a tiled texture then looks
        the same wherever it stands (the travertine bowls and drum tables, their middles mid-slab)."""
        if uv_offset is not None:
            du, dv = uv_offset
            for face in {face for vert in verts for face in vert.link_faces}:
                face.normal_update()
                u, v = _UV_AXES[max(range(3), key=lambda i: abs(face.normal[i]))]
                for loop in face.loops:
                    loop[self.uv].uv = (loop.vert.co[u] / uv_tile + du, loop.vert.co[v] / uv_tile + dv)
        if self.matrix is not None:
            bmesh.ops.transform(self.bm, matrix=self.matrix, verts=verts)
        if self.block:
            layer = self._blocks()
            for vert in verts:
                vert[layer] = self.block
        if mat not in self.materials:
            self.materials.append(mat)
        index = self.materials.index(mat)
        for face in {face for vert in verts for face in vert.link_faces}:
            face.normal_update()
            face.material_index = index
            if uv_offset is not None:
                continue
            u, v = _UV_AXES[max(range(3), key=lambda i: abs(face.normal[i]))]
            for loop in face.loops:
                loop[self.uv].uv = (loop.vert.co[u] / uv_tile, loop.vert.co[v] / uv_tile)

    def build(self, col, location=(0.0, 0.0, 0.0), rotation_z=0.0, **props):
        """Object named after the builder; custom properties (e.g. night_light=True) go on the object. A builder with
        placed(..., wind=) blocks paints the colour attribute 'wind' (R = sway weight) on the mesh."""
        weights = None
        if self.wind:  # in the order to_mesh writes the vertices, which need not be the order they were made in
            layer = self._blocks()
            weights = []
            for vert in self.bm.verts:
                block = vert[layer]
                z0, z1 = self.wind[block - 1] if block else (0.0, 1.0)
                weights.append(min(1.0, max(0.0, (vert.co.z - z0) / (z1 - z0))) if block else 0.0)
            self.bm.verts.layers.int.remove(layer)  # not a mesh attribute of its own
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.materials:
            mesh.materials.append(mat)
        if weights is not None:
            attr = mesh.color_attributes.new(name="wind", type="FLOAT_COLOR", domain="POINT")
            for i, weight in enumerate(weights):
                attr.data[i].color = (weight, 0.0, 0.0, 1.0)
        ob = bpy.data.objects.new(self.name, mesh)
        ob.location = location
        ob.rotation_euler = (0.0, 0.0, rotation_z)
        for key, value in props.items():
            ob[key] = value
        col.objects.link(ob)
        return ob
