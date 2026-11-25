"""Camera rough for a clip whose camera travels (rules 3am.1, section 8 job 4). Free, no generation.

    blender -b -P scrollcraft/starter/camera_rough.py -- plan.json

plan.json (sizes in metres, z is up, times in seconds):
    {"seconds": 8, "fps": 24, "size": [1280, 720], "out": "gen/board/rough-1.mp4",
     "boxes":  [{"at": [0, 0, 1], "size": [2, 2, 2]}, {"at": [0, 6, 4], "size": [8, 1, 8]}],
     "camera": [{"t": 0, "at": [0, -12, 2], "look": [0, 0, 1]},
                {"t": 8, "at": [6, -4, 6], "look": [0, 6, 3]}],
     "lens": 35}
Grey boxes, a ground, a keyframed camera that always looks at its "look" point, rendered with the quick Workbench
engine to an MP4. The clip's prompt is then written second by second from this video.
"""
import json
import sys

import bpy
from mathutils import Vector

plan = json.load(open(sys.argv[sys.argv.index('--') + 1], encoding='utf-8'))
fps, secs = plan.get('fps', 24), plan['seconds']

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.fps = fps
scene.frame_start, scene.frame_end = 1, int(secs * fps)
scene.render.resolution_x, scene.render.resolution_y = plan.get('size', [1280, 720])
if hasattr(scene.render.image_settings, 'media_type'):              # Blender 5: video is its own media type
    scene.render.image_settings.media_type = 'VIDEO'
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format, scene.render.ffmpeg.codec = 'MPEG4', 'H264'
scene.render.filepath = plan['out']                              # relative to where blender is run from
scene.display.shading.light = 'STUDIO'
scene.display.shading.show_cavity = True

bpy.ops.mesh.primitive_plane_add(size=200)                       # the ground
for b in plan.get('boxes', []):
    bpy.ops.mesh.primitive_cube_add(size=1, location=b['at'])
    bpy.context.object.scale = b['size']

bpy.ops.object.camera_add()
cam = bpy.context.object
cam.data.lens = plan.get('lens', 35)
scene.camera = cam
for k in plan['camera']:
    f = 1 + round(k['t'] * fps)
    cam.location = k['at']
    # ponytail: the look direction is keyed per point and blended as angles, fine for a rough; a camera turning more
    # than half a circle between two points needs a point in between
    cam.rotation_euler = (Vector(k['look']) - Vector(k['at'])).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert('location', frame=f)
    cam.keyframe_insert('rotation_euler', frame=f)

bpy.ops.render.render(animation=True)
print('rough written:', plan['out'])
