# imagery_public — 정사영상 타일 공개판(캐노피 채움, trees2 수관 제외)

- 만든 때: 2026-10-12 22:52 KST
- 코드: `src/umyeon/terrain/imagery_public.py`(umyeon-data, 9b 10-12 배정)
- 배치: `data/tiles/imagery`와 같다 — `{z}/{x}/{y}.webp`(XYZ, z12–19, WEBP q85) · `extent.json` · `NOTICE.txt`
- 타일: 3,875장 · 23.5 MB. imagery는 3,875장이고, 타일 목록이 같다: 예.
- 출처 표기: **국토지리정보원 정사영상(2025)**. 국외 반출 금지(NOTICE.txt).

## 화소 출처 — VWorld 픽셀 0

- 모든 화소는 국토지리정보원 정사영상 2025(25 cm, 도엽 7장 → `mosaic_5186.tif`) 원본이거나, 같은 원본 화소에서 계산한 채움 색이다.
- VWorld WMTS · 위성 배경 · 로드뷰 · 다른 영상의 화소는 **0**이다(파이프라인 입력에 없다).
- VWorld 자료는 마스크 '제외 면'(레지스트리 건물 · 물 벡터 일부, 공공누리 1유형)으로만 쓰였고, 화소로는 들어가지 않는다.

## 캐노피 마스크(1 m) 구성

공개판 마스크 = v1 ∪ R2 가로수 · 공원수 수관(어두운 화소만) ∪ 산악 터널 띠 = 646.55 ha

| 성분 | 면적 | 출처 · 라이선스 |
|---|---:|---|
| v1: 비오톱 현존식생 산림 13종 ∪ (조경수목식재지 ∩ WorldCover 수목) ∪ WorldCover 수목 ∪ OSM wood · forest · tree 4 m(σ 2 m 매끈하게) − 레지스트리 제외 면(건물 · 도로면 · 횡단보도 · 물) | 625.46 ha | 서울시 도시생태현황도(공공누리 1유형) · © ESA WorldCover 2021(CC BY 4.0) · © OpenStreetMap contributors(ODbL) · S-Map 오픈랩 |
| + R2 가로수 · 공원수 수관(반경 = crown_m / 2), 영상에서 어두운 화소(지면 휘도 하위 30 %)만 | 9.91 ha | 위치는 S-Map 보도 · 도로 · OSM · 비오톱 규칙 배치(3,309그루). 5c 인스턴스는 '겹치면 놓지 않음' 제외에만 쓰였다 |
| + 산악 터널 띠: v1 캐노피 합집합(제외 전) ∩ 산악 터널 구간(OSM 터널 링크, 지하차도 제외) − 건물 · 물 · 횡단보도 | 11.18 ha | 위와 같음 · © OpenStreetMap contributors |
| **뺀 것**: trees2(5c) 인스턴스 수관 | — | 산림청 임상도(공공누리 3유형 변경금지) 파라미터 배치라서 공개판 마스크에 넣지 않는다(파일도 읽지 않음) |

내부 기본(마스크 v3, `/tiles/imagery` · `imagery_next`)과의 차이:
- v3에만 있는 면적: 1.01 ha(trees2 수관 성분)
- 공개판에만 있는 면적: 0.0 ha(터널 띠 안에서 trees2 대신 v1 합집합으로 들어온 화소)
- 마스크 v3: 647.56 ha

## 채움 규칙(내부 v3와 같다)

1. 채움 색 = 마스크 밖 반경 15 m 지면(제외 면 · 영상 밖 빼고)의 3 m 칸 평균 중앙값이다. 그늘(AOI 지면 휘도 하위 30 %)은 뺀다.
2. 풀 표본이 4개 이상이면 풀만 쓴다. 휘도 ± 6 % 결을 얹는다.
3. 표본 없는 칸은 30 m까지 가장 가까운 색을 쓰고, 30 ~ 45 m에서 v1 채움(임상 질감)으로 넘어간다.
4. 비오톱 산림 안은 v1 채움을 그대로 둔다. 터널 띠는 v1 방식 임상 질감을 쓴다.
5. 25 cm 합성은 1.5 m 페더로 한다.

채움은 마스크 안 화소를 주변 지면 색으로 바꾼 것이다(새 정보 없음).

## 원본 해시(sha256)

| 파일 | sha256 |
|---|---|
| `data/interim/ngii_ortho/mosaic_5186.tif` | `bacc3834cbf1bcdceffda219a75323b5311473e77bdeb822c838503dc2d4e394` |
| `data/interim/ngii_ortho/mosaic_inpaint_5186.tif` | `393a6d9d1fc98d3c13e642cfb47b90cdc955e95c42ea16c4031231a2abaac18e` |
| `data/interim/ngii_ortho/canopy_mask_1m.tif` | `755ae5efd82cfe449bd9440c2e1bceda4ce3a05eacb08136a9b62fb172b59155` |
| `data/interim/trees/street_instances.parquet` | `b4184a8542a03ead1314c8b4f29c8cce4b82175e03239aeca570196f628b07d4` |
| `data/interim/ngii_ortho/canopy_mask_public_1m.tif` | `ad91070decf0b2696c25e30b4ab91dafebb188c1d78abe2864d568a0b92c08a8` |
| `data/interim/ngii_ortho/mosaic_inpaint_public_5186.tif` | `d6ff1afb3d02f237c3207f8a772851502f62a163f62539d9dea872702ddf7d37` |
