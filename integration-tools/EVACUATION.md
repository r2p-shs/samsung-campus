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

## V3 supersedes V2 behavior
Assigned-count balancing and the arbitrary 60s route avoidance penalty are removed. Full approach + transit + downstream cost includes the route segment itself. Free-flow choices minimize actual graph path time. Only observed waiting near the entry (within 8s approach), blocked entry occupancy and own observed blockage add estimated delay. Nominal headway is `2 * grid spacing / personal speed + 0.2s`. Own blockage estimate is capped at30s. Reconsider only on floor, after2s waiting, at least10s between decisions; change requires benefit greater than max(3s,10% of current travel time). Never change mid-flight. No fixed quotas. Queue estimates are heuristic, not calibrated measurements.

The right stair 1F connection was blocked by the existing lobby-end glazing. A scenario opening is defined in models/evac-openings.json and applied identically to visual geometry and graph sections. Position/size follow the user-described connection but exact dimensions are assumed. Fixed glass outside that opening remains. No graph-only wall crossing. Empty right stair landing now chooses right door: approach37.75m instead of left-detour87.01m. New preview button draws the path including door transit.

Tests cover nearest choice for all200 initial positions, no penalty for distant assigned occupants, queue-triggered alternative, decision cooldown, flight lock, no left-end detour and occupancy conservation. Default200:510.6s; left3F closure:615.5s; right3F closure:572.0s. These replace prior version results; geometry and policy both changed.

## V4: two people abreast on stairs
Each existing 1.4m flight has two lane centers spaced0.60m apart, each0.40m from the side boundary. Inner and outer landing turns are nested, not intersecting. Both ends connect independently to mesh-checked floor cells. The geometry is not widened. Both lanes descend in this evacuation scenario; opposing responders are not simulated.
Node reservation is supplemented by0.48m horizontal clearance (vertical overlap1.6m) around staircase and merge nodes. Near corner nodes cannot be occupied simultaneously just because they have distinct IDs. No change of lane in flight; nearest path/queue-delay selection chooses a lane before entry.
Tests:18 paired floor transitions, lane positions within original surfaces, simultaneous two-lane use, all200 occupants complete for no/left/right closure. Heavy-queue sample minimum separation0.60m between stair walkers and0.499m including floor merge walkers. `node integration-tools/test_stair_lanes.mjs` checks these. This is a discrete centerline model, not calibrated crowd/body-contact physics.
Default200 completes409.6s; left3F closure536.0s; right3F closure427.6s. Model estimates only. Queue panels report inner/outer lanes separately.


## V5: continuous stair following and rounded landings
Stair interiors use arc-length motion rather than cell-to-cell reservations. Followers regulate speed from the leader gap (0.62m nominal along-path clearance), accelerate at up to 0.8m/s², and obey 0.48m horizontal body clearance when vertically overlapping. Nested circular landing corners (inner radius0.2m, outer0.8m) replace right-angle pivots. Heading changes are limited to2.5rad/s and the rendered position, heading and gait distance interpolate between fixed simulation steps.
The short floor entry/exit links retain graph reservations. Continuous motion starts at the upper flight edge and hands back at the lower flight edge; already committed floor walkers have swept-path priority. This avoids merge deadlocks without letting a stair walker enter occupied floor space. Floor-wide crowd motion still uses graph cells. Stair queue headway now uses0.62m rather than twice the grid spacing.
Validation: three followers traverse a landing without stopping at samples; heading steps <=0.25rad, lane/merge clearance >=0.48m within numerical tolerance. All200 finish: default435.2s, left3F closure521.6s, right3F closure443.0s. Run test_stair_flow.mjs, test_stair_lanes.mjs and test_evacuation.mjs. These are model regression checks, not empirical crowd calibration.
