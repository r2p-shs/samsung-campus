# Animated visitor

Character source: three.js examples/models/gltf/Michelle.glb (Mixamo).
https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Michelle.glb
Motion reference: three.js examples/models/gltf/Soldier.glb (Idle, Walk, Run, TPose).
https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb
Character / motions: Mixamo. Application use guidance:
https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
Adobe permits characters and animations in personal/commercial/non-profit projects including games. This file is embedded as a runtime asset for this viewer, not offered as an asset-library download. It is not described as CC0 or covered solely by the three.js code MIT license.

Changes: runtime height normalization to 1.76 m, Z-up / forward-axis conversion, material roughness, crossfaded Idle/Walk/Run based on collision-resolved movement. Original character geometry and textures retained. World-space rotational retargeting aligns the two hip reference frames and preserves the destination limb lengths. Original capsule visitor is used only if loading fails.

Campus derivative: campus-visitor.glb bakes the same textured character into Idle plus 24 Walk poses. It uses the same source permissions, is not a new independently licensed character, and is rendered with normal campus depth testing.
