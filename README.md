# 캠퍼스 뷰어 (viewer_campus) — 삼성전자 서울R&D캠퍼스 F동 철거 전/후

우면동 뷰어(viewer/)를 복제해 줄인 독립 앱입니다. API 서버 없이 정적 파일만 읽습니다.

## 실행 (배포 폴더, 내장 그래픽 PC 기준)

배포 폴더 = `dist/` 내용 + `tiles/` + `models/`(+ 이 README, F_TOWER_ATTACH.md). 그 폴더에서 한 줄:

```bash
python -m http.server 8080
```

브라우저(Chrome · Edge)에서 `http://localhost:8080/` 을 엽니다. 처음 1~2분은 타일을 받느라 흐리게 보입니다.

- 3D 탭은 한 번에 하나만 엽니다(탭 하나가 그래픽 메모리 약 1 GB).
- 끊기면 왼쪽 '그림자'를 끄거나 주소 뒤에 `?r5=0`을 붙입니다.
- 주소 옵션: `?after=1`(철거 후로 시작) · `?tower=1`(새 F타워 켬) · `?preset=f_site` · `?hour=16` · `?date=2026-12-21` · `?shadows=0`.

## 화면

- **철거 전 / 철거 후**: 후 = F동 숨김 + 부지 잔디 + 부지 안 소품 · 차량 숨김 + (있으면) 철거 후 정사영상.
- **새 F타워 붙이기**: `models/f_tower.glb`가 있으면 그 모델, 없으면 발자국 × 높이 반투명 상자와 '여기에 새 F타워' 라벨. 접합 사양은 F_TOWER_ATTACH.md.
- 패널: 카메라 · 레이어 · 시간(태양) · 그림자. 건물을 누르면 오른쪽에 타일 메타데이터 카드.

## 설정 한 곳: `campus.config.json`

- `layers`: 모든 데이터 경로(`/tiles/…`). 값이 `null`이면 그 레이어를 쓰지 않습니다.
- `f`: F동 entity_id · 중심(경위도 · 지반고 · 타원체고) · yaw · 발자국 · 높이. `f_site.geojson`이 있으면 그 파일 값을 우선합니다(속성 `center_lon`/`center_lat`, `ground_z`, `geoid_n` 또는 `h_ell`, `yaw_deg`).
- 원경: 지구본은 `imagery_rect`(캠퍼스 범위) 안에서만 그리고 바깥은 `haze_color` 배경, 범위 밖으로 걸친 건물 · 수목 · 도로 타일은 잘라냅니다. `fog_density`는 Cesium 안개. `presets`: 카메라.
- `dev_mounts`: 개발 서버(`npm run dev`, 5175)에서 `/tiles` 등을 어느 폴더로 읽을지. 지금은 `../data/tiles`(우면동 전체), Tile 세션의 `exports/campus/`가 나오면 그 경로로 바꿉니다.

## tiles/ 에 있어야 하는 것 (앱이 읽는 경로)

`exports/campus/`(Tile 세션) 전체 + **`tex/`**(건물 파사드 재질 11 MB, `data/tiles/tex` — Tile 묶음에 없어 따로 복사). 앱이 읽는 경로: `terrain/` · `imagery_before/` · `buildings_lod2b/` · `landmarks/`(tileset.json · landmarks.json) · `landmarks_f/`(F동만) · `trees2/`(tileset.json · tint.json · schema.json) · `props_r7/`(tileset.json · hidden.json · wires.json · wires.bin) · `traffic_r8/`(tileset.json · palette.json) · `roads/`(tileset.json · tex/) · `tex/`(파사드 재질, v2/ 포함) · `vectors/ground_class_05m.{json,png}`(지면 재질) · 철거 후: `imagery_after/`(Data 세션 exports/campus_imagery/after) · `f_site.geojson`(exports/campus_imagery/f_site.geojson). 앱 루트에는 `typology.json`이 있습니다(dist에 포함).

## 개발

```bash
cd viewer_campus && npm run dev     # http://127.0.0.1:5175
npm run build                        # → dist/ (tsc + vite)
```
