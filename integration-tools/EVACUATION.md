# F Tower evacuation prototype

Open `evacuate-ftower.html`; linked from walking page. Campus terrain and walking controls unchanged.

## Scope
Ten floor labels: 1,2,3,5,6,7,8,9,10,11. Upper floors and stairs are assumed, not site-verified escape paths.
Graph generated from GLB sections at foot+0.35,1.0,1.6m with 0.24m clearance. Grid edges sampled; voids and stair shafts excluded. Explicit front doors held open. No invented wall openings. Stair centerlines follow the walk-tested flights and landings.
Fire condition blocks selected well's descending flight at chosen floor from time zero. Floor 1 blocks the 2-to-1 flight. No fire spread.
Occupants sampled only from baseline exterior-connected cells: disconnected rooms excluded. Same seed gives identical occupants in comparisons.
Fixed 0.1s steps; node occupancy and target reservation; single-file stairs. No forced advance through occupied nodes. This is a graph model, not body contact dynamics or calibrated flow capacity.
No smoke, heat, toxicity, mobility impairments, elevators, opening delay or responder counterflow. Both stopped escalators may be enabled as downward walking paths for this scenario; this requires site-specific operational validation. Exterior endpoint is not a verified safe refuge. Three-height sections may miss obstacles between sample heights.

## Previous v1 test (superseded by v2 below)
20 people/floor, total 200; seed42. Flat 1.2m/s, stairs0.65m/s, personal factor0.85-1.15; response5-30s after alarm. These are assumptions.

| Scenario | Arrivals | Completion | 95% | Peak waiting |
|---|---:|---:|---:|---:|
| No closure | 200 | 633.1s | 602.6s | 110 |
| Floor3 left flight closed | 200 | 665.4s | 636.2s | 82 |

Not a prediction of actual fire safety. Lower peak queue does not imply safer conditions; congestion is distributed differently.
Tests: person conservation, unique node/target occupancy, closed-node exclusion, identical scenario populations, route completion, browser rendering.
Rebuild: `python integration-tools/build_evac_graph.py` (numpy,trimesh). Graph and result export include GLB SHA256.
Reference: [NIST TN1822](https://www.nist.gov/publications/process-verification-and-validation-building-fire-evacuation-models): pre-evacuation, navigation, exit usage, route availability and flow constraints. Prototype is not certified against this framework.

## V2: character rendering, routing and observation
- Existing textured Rocketbox male/female meshes and 24 walk poses are shared using instancing. Movement distance drives pose phase; paused/waiting people use Idle. Foot rings show state.
- Four close views: left stair, right stair, both escalators, front doors. Selected floor controls stair flight observation; queue panel shows assigned/current waiting/completed counts.
- Initial route selection uses local distance, downstream distance and pending assignments (12 seconds/person for descent routes, 2 for exit routes). These are heuristic balancing weights, not calibrated predictions. Once a stairwell is entered, continue down the same well to 1F unless its next flight is blocked. This explicitly prevents right-stair 2F -> left-stair detours.
- Waiting floor walkers may reconsider their route after 8s. No teleportation or passage through occupied graph nodes. Goal reassignment is recorded by current route; cell reservation remains enforced.
- Stopped escalators: both existing lanes are directed 2F -> 1F; end connections checked against floor mesh sections. They are optional. This is a user-requested scenario assumption, not a fire evacuation instruction.
- Both paired side doors and the central revolving wings are considered open. Only rotating wings/stiles are removed for this scenario; fixed glazing, enclosure and spindle retained. Three door corridors are graph-checked and tracked separately. Actual emergency breakout operation remains unverified.
- Default has no stair closure so both routes are available. Explicit fire closure still respected; no artificial equal split through blocked routes.

V2 default 200 people, seed42: distance-first 466.8s, balancing 461.5s. Bottom stair counts shift from left116/right44 to left93/right75. Stopped escalators carry6+6 people; doors carry79/65/56. Left3F closure:200/200 in685.2s; right3F closure:200/200 in590.3s. Times depend on changed graph and heuristic; do not compare to v1 as an isolated balancing effect.

Run `node integration-tools/test_evacuation.mjs` for conservation, unique node/target occupancy, closed-flight exclusion, continuous right-stair descent and use of both escalators/all three doors. Browser checks additionally verify textured pose batches, four close viewpoints and absence of render errors.
