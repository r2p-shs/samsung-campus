# Animated visitor

Character source: three.js examples/models/gltf/Michelle.glb (Mixamo).
https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Michelle.glb
Motion reference: three.js examples/models/gltf/Soldier.glb (Idle, Walk, Run, TPose).
https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb
Character / motions: Mixamo. Application use guidance:
https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
Adobe permits characters and animations in personal/commercial/non-profit projects including games. This file is embedded as a runtime asset for this viewer, not offered as an asset-library download. It is not described as CC0 or covered solely by the three.js code MIT license.

Changes: runtime height normalization to 1.76 m, Z-up / forward-axis conversion, material roughness, crossfaded Idle/Walk/Run based on collision-resolved movement. Original character geometry and textures retained. World-space rotational retargeting aligns the two hip reference frames and preserves the destination limb lengths. Original capsule visitor is used only if loading fails.

Campus derivative: campus-visitor.glb bakes the same textured character into Idle plus 24 Walk and 10 Run poses. It uses the same source permissions, is not a new independently licensed character, and is rendered with normal campus depth testing.


## Casual character choices
Source: https://github.com/microsoft/Microsoft-Rocketbox (MIT; complete notice in ROCKETBOX-LICENSE.md).
- casual-male.glb: Assets/Avatars/Adults/Male_Adult_09 (m017), T-shirt and jeans.
- casual-female.glb: Assets/Avatars/Adults/Female_Adult_05 (f005), shirt and jeans.
- Native Rocketbox motion: m/f_walk_neutral.max.fbx and m/f_idle_neutral_01.max.fbx, in Assets/Animations/all_animations_max_motextr_xy and all_animations_max_motextr_static.
Changes: native rig rest-pose alignment, 1.76m nominal scale, in-place movement, Z-up/+Y facing, 1024px base-color textures, 1 idle, 24 walk and 10 run poses. Source geometry, UV and clothing retained; normal/specular texture layers omitted for the web derivative. No Mixamo motions are used in these two derivatives.
Rebuild: Blender background --python integration-tools/bake_casual_visitors.py -- <downloaded Rocketbox root> <assets/visitor output>. Preserve the source directory hierarchy.

Run update: casual models use m_run_neutral.max.fbx and f_run_neutral.max.fbx from the same Rocketbox repository. Michelle uses the existing Soldier Run clip (0.7s cycle), retargeted and sampled into 10 poses.
