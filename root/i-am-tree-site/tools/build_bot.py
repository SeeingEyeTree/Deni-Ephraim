"""An original, generic low-poly builder robot (not a copy of any game's unit). -> builder_bot.glb"""
import bpy, math, sys
out = sys.argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.6, metal=0.3, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = 2.5
    return m
STEEL = mat("Steel", (0.45, 0.48, 0.53)); DARK = mat("Dark", (0.09, 0.10, 0.13), 0.7)
BLUE = mat("Blue", (0.03, 0.22, 0.62), 0.45); VISOR = mat("Visor", (0.2, 0.8, 1.0), 0.2, 0, (0.3, 0.85, 1.0))
root = bpy.data.objects.new("BuilderBot", None); bpy.context.scene.collection.objects.link(root)

def finish(o, m, bevel):
    o.data.materials.append(m); o.parent = root
    if bevel:
        mod = o.modifiers.new("b", "BEVEL"); mod.width = bevel; mod.segments = 2
    for p in o.data.polygons: p.use_smooth = False
    return o
def box(name, loc, size, m, rot=(0, 0, 0), bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.object; o.name = name; o.scale = size
    return finish(o, m, bevel)
def cyl(name, loc, r, h, m, rot=(0, 0, 0), v=12, bevel=0.012):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=h, location=loc, rotation=rot); o = bpy.context.object; o.name = name
    return finish(o, m, bevel)
H = math.pi / 2
box("Torso", (0, 0, 0.62), (0.46, 0.30, 0.34), STEEL, bevel=0.04)
box("Chest", (0, -0.155, 0.66), (0.30, 0.03, 0.16), BLUE)
box("Hips", (0, 0, 0.40), (0.30, 0.22, 0.12), DARK)
cyl("Neck", (0, 0, 0.82), 0.07, 0.06, DARK)
cyl("Head", (0, 0, 0.92), 0.15, 0.15, STEEL, v=10, bevel=0.03)
box("Visor", (0, -0.135, 0.93), (0.20, 0.04, 0.045), VISOR, bevel=0.008)
cyl("Antenna", (0.09, 0.04, 1.08), 0.008, 0.20, DARK, bevel=0)
cyl("AntennaTip", (0.09, 0.04, 1.19), 0.022, 0.03, VISOR, v=8, bevel=0)
box("Pack", (0, 0.19, 0.66), (0.30, 0.10, 0.26), DARK)
for sx in (-1, 1):
    cyl("Shoulder", (sx * 0.29, 0, 0.72), 0.085, 0.10, BLUE, rot=(0, H, 0))
    box("UpperArm", (sx * 0.31, 0, 0.58), (0.09, 0.10, 0.22), STEEL)
    box("Forearm", (sx * 0.31, -0.07, 0.42), (0.10, 0.24, 0.10), STEEL, rot=(0.5, 0, 0))
    cyl("Hip", (sx * 0.12, 0, 0.33), 0.06, 0.10, DARK, rot=(0, H, 0))
    box("Thigh", (sx * 0.13, 0, 0.23), (0.11, 0.12, 0.18), STEEL)
    box("Shin", (sx * 0.13, 0.01, 0.10), (0.09, 0.10, 0.14), DARK)
    box("Foot", (sx * 0.13, -0.04, 0.03), (0.15, 0.26, 0.06), BLUE, bevel=0.02)
# right hand: a two-prong gripper; left hand: a welding nozzle with a lit tip
for dz in (-0.035, 0.035):
    box("Prong", (0.31, -0.24, 0.345 + dz), (0.03, 0.12, 0.022), DARK, rot=(0.5, 0, 0), bevel=0.005)
cyl("Nozzle", (-0.31, -0.22, 0.36), 0.035, 0.12, DARK, rot=(H + 0.5, 0, 0), v=8)
cyl("Spark", (-0.31, -0.285, 0.325), 0.02, 0.03, VISOR, rot=(H + 0.5, 0, 0), v=8, bevel=0)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_yup=True, export_animations=False)
