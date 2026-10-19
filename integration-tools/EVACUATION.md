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


## V6: independent stair discharge and four 2F descents
Two lanes now retain separate floor-grid portals at y=-9.2. Their last approach points sit at y=-8.4 (0.8m longitudinal clearance), preventing one lane from reserving the adjacent lane's exit. Continuous stair motion includes the approach aprons. Same-family admission uses the lane portal actually reached; nearby arrivals, the stair tail and relative active lane load contribute to predicted lane queue delay. A sibling-lane load surplus beyond one person adds1.2 nominal headways per person; distant assigned agents are excluded. Admission to a different sibling portal occurs only when it is not more congested. Floor walkers can take a local obstacle-aware detour after2s blocked without changing their stair/exit destination.
The common stair approach openings in the assumed upper-floor partitions are widened to4.2m. The left 1F/2F back wall and 2F gallery glazing/posts receive matching openings; columns and prior escalator openings remain. Triangle clipping preserves prior holes. models/evac-geometry.json contains the exact replacement meshes used both by graph sectioning and by evac-view.js. These are authorized evacuation-model geometry proposals, not surveyed dimensions; the source walk GLB is unchanged.
2F→1F offers four physical connections: left stairwell(two lanes), right stairwell(two lanes), and each of the two stopped escalators(one lane each): six lane routes total. Neither staircase transfers to the opposite stairwell at2F. The four-route overview colors these connections and retains closure controls.
Tests explicitly verify parallel motion on landings and discharge aprons, independent exit portals, unobstructed approach segments, all six lane routes reaching1F and the exterior, and all200 finishing no/left/right closure. test_stair_exits.mjs checks a simultaneous pair with zero exit waiting. Final scenario times:449.1s/500.1s/477.2s; these are model estimates, not calibrated evacuation predictions.

## V8: full frontage exits and measured stair slowdown
The old exit routing forced all agents into three single-file corridors even with door leaves hidden. The evacuation geometry now removes the lower entry fixed glazing, mullions/jambs and rotor surround/spindle between x=-15.01 and -3.89, below z=3.4. Structural piers and upper frontage remain. This is a user-requested full-opening proposal, not a claim about existing certified door capacity. The source GLB and general walking scene are unchanged.
Thirteen mesh-checked parallel lanes spaced 0.8m run from y=-20.4 to -24.4 with unique floor nodes and independent downstream connections. test_full_width_exits.mjs confirms 13 people move through together, cross within the same 0.2s window and reach the exterior.
The previous queue estimator ignored most slowly moving stair occupants. With 400 people it produced zero well switches and left/right active counts of 245/12 at t=200s. Flight speed is now observed from actual continuous motion, smoothed over 6s when at least three occupants are present. Speed-derived extra transit time (bounded below at 0.12m/s for estimation) is included for the current flight and subsequent flights of the same well. A floor portal remains eligible for reconsideration until the agent enters the actual flight. In-flight switching remains prohibited.
New 400-person diagnostic: 25 well switches, left/right active 89/169 at t=200s and 98/100 at t=300s; all exit at624.6s. These are regression outcomes, not calibrated predictions. The old771.5s used the old three-lane geometry as well, so it is not an isolated routing performance comparison.
Default200 scenarios no/left/right closure:445.6s/474.7s/476.6s. Existing continuous following, independent discharge, four descent connections and body-clearance tests remain required.

Matched 400-person comparison on the same V8 geometry: distance-only804.0s versus congestion-aware624.6s; at200s left/right active248/12 versus89/169. test_dense_routing.mjs checks completion, actual cross-well switches and right-well use under this fixed congestion case.

## V9: nearest current-floor portal
Supersedes full-route scoring and downstream queue prediction. travelTime now equals floor approach field / personal speed; no transit free-time or static outdoor distance is added. congestionDelay includes only the selected passage queue and measured slowdown. Dist-to-exterior remains a reachability filter, not a ranking term. On landing, agents select a new local portal. test_local_portal_choice.mjs checks every initial free-flow choice, the right-near 3F example and independence from finite downstream exit costs. The existing portal/flight lock, congestion reconsideration and thirteen exit lanes remain.

## V10: right rear stair access
Compared the supplied floor-3 plan (viewer/assets/ftower-plans/floor-3.jpg) with the interpreted F3-08 stair region and F3-02/F3-03 corridors. The model uses generic stairs and provisional registration, so the plan supports the right-side circulation topology but not an exact measured door width. The prior rear opening fed a stair-shaft dead end; the front opening ended at x=21.6, leaving no body-clearance connection for the side corridor. Routing therefore returned via x=-0.8.
The evacuation override widens the right rear partition opening at y=5.5 and right front opening at y=-7.5 to x=23.6, retaining the shaft, side walls, structure and overhead wall. The side circulation band is approximately x=21.4..23.6; cut headroom is2.5m. This is applied to floor3 and repeated floors5..11, not inferred across the different 1F/2F layouts. Render replacements and mesh-section graph use the same clipped geometry. Source general-walk GLB is unchanged.
From local(20,10) the right inner-lane portal route falls60.8m→22.4m; nearest outer portal is21.6m. test_right_rear_access.mjs verifies all eight levels choose right, stay in the right zone and never cross the shaft. Existing200-person no/left/right closure tests complete444.7s/497.3s/481.6s; minimum tested stair body spacing remains0.52m. Node additions change the deterministic sampled spawn set, so these timings are not a controlled performance claim against the prior version.
The new “우측 뒤편→계단 진입” button displays the local access path on the selected upper floor (default3).

## V11: four escalator walking lanes and persistent local detours
Each stopped escalator now has two centerlines at±0.3m from its existing center, inside the1.24m rail span. Landings are independent, with node-clearance conflicts checked for escalators as well as stairs. The four physical2F→1F connections now carry eight lane routes. A mesh-checked floor connector runs from the left stair arrival portal around the handrail tops into the escalator upper landing chain. It stays outside the stair shaft and F2 void; no floor or bridge across the void was invented. Previously the coarse stair-apron exclusion left these arrivals disconnected from the upper landings, so only the initial F2 occupants used escalators.
A400-person reproduction identified repeated visits by agents252,281 and389 near the right1F stair/lobby. The local detour expired after6s even while the agent was progressing, returning them to the blocked original route. Detours now remain valid for the same goal while progressing; a newly blocked detour is replanned, and failed replanning retains the previous plan instead of reverting. Selecting a different goal still clears the plan.
Regression: four simultaneous escalator lanes with0.6m minimum spacing; all eight downward lane routes reach the exterior; default200 no/left/right closure all complete444.7s/541.2s/471.0s.400 people all exit573.9s, no floor1 node visited four or more times, escalator completions7/8/47/54 (116 total versus25 in the original reproduction). These are deterministic model tests, not measured evacuation times.

The 400-person progress regression records80 upper-floor occupants using escalators after120s, with escalator use through419.6s. Shared navigation on campus map, comparison, walking and evacuation pages links to the same four relative destinations; SWM main page adds the same F-tower destinations under /campus/. No revision-specific links are embedded.
