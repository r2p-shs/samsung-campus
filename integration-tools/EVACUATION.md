# F Tower evacuation prototype

Open `evacuate-ftower.html`; linked from walking page. Campus terrain and walking controls unchanged.

## Scope
Ten floor labels: 1,2,3,5,6,7,8,9,10,11. Upper floors and stairs are assumed, not site-verified escape paths.
Graph generated from GLB sections at foot+0.35,1.0,1.6m with 0.24m clearance. Grid edges sampled; voids and stair shafts excluded. Explicit front doors held open. No invented wall openings. Stair centerlines follow the walk-tested flights and landings.
Fire condition blocks selected well's descending flight at chosen floor from time zero. Floor 1 blocks the 2-to-1 flight. No fire spread.
Occupants sampled only from baseline exterior-connected cells: disconnected rooms excluded. Same seed gives identical occupants in comparisons.
Fixed 0.1s steps; node occupancy and target reservation; single-file stairs. No forced advance through occupied nodes. This is a graph model, not body contact dynamics or calibrated flow capacity.
No smoke, heat, toxicity, mobility impairments, elevators, escalators, opening delay or responder counterflow. Exterior endpoint is not a verified safe refuge. Three-height sections may miss obstacles between sample heights.

## Default test
20 people/floor, total 200; seed42. Flat 1.2m/s, stairs0.65m/s, personal factor0.85-1.15; response5-30s after alarm. These are assumptions.

| Scenario | Arrivals | Completion | 95% | Peak waiting |
|---|---:|---:|---:|---:|
| No closure | 200 | 633.1s | 602.6s | 110 |
| Floor3 left flight closed | 200 | 665.4s | 636.2s | 82 |

Not a prediction of actual fire safety. Lower peak queue does not imply safer conditions; congestion is distributed differently.
Tests: person conservation, unique node/target occupancy, closed-node exclusion, identical scenario populations, route completion, browser rendering.
Rebuild: `python integration-tools/build_evac_graph.py` (numpy,trimesh). Graph and result export include GLB SHA256.
Reference: [NIST TN1822](https://www.nist.gov/publications/process-verification-and-validation-building-fire-evacuation-models): pre-evacuation, navigation, exit usage, route availability and flow constraints. Prototype is not certified against this framework.
