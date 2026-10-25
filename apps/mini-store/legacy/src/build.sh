#!/bin/sh
# Ghép các phần thành 1 file HTML duy nhất (chạy offline)
cd "$(dirname "$0")"
cat p0_head.html p1_math.js p1_atlas.js p2_builder.js p3_people.js p3_vehicles.js \
    p3_scene_a.js p3_interior.js p3_scene_b.js p3_scene_c.js p4_shaders.js p5_render.js p9_tail.html > ../circle-k-dem-mua.html
