# 빵길(study-find-bakery) 작업일지

> 빵집 정보 서비스 + 빵집 등록 자동화 파이프라인 작업 기록.
> 민감정보(키·비밀번호·.env 값)는 이 문서에 절대 적지 않는다.

---

## 📌 현재 상태 (2026-06-27 기준)

- **브랜치:** `codex/map-list-sync`
- **배포:** https://find-bakery.vercel.app (Vercel), 원격 Supabase 연결 정상. **production은 `main` 기준** — 코드 변경은 main 머지(PR)해야 배포 반영됨(중복 수정은 PR #3, 탐색 단일 핀 포커스는 PR #4로 main 반영 완료).
- **배포 연결 문제 해결됨:** 케이크·식사빵 등 카테고리 정상 노출 확인
- **뺑드미 아차산점**: DB에 추가 완료 + 좌표를 카카오 검증값으로 교정 완료
- **자동화 1단계(카카오 1차 검증)**: 스크립트 완성·커밋·push
- **자동화 2단계(Claude 2차 검증)**: 스크립트 완성 + **실제 Claude 호출까지 검증 완료**. 연남동 30곳(빵집+디저트 혼합) 실행 → 승인후보 19 / 보류 7 / 제외 4, **보류 케이스 작동 확인**. 모델 Sonnet 4.6, 비용 ≈ 빵집 1곳당 1.5원(애매 건만 1회 묶음 호출)
- **자동화 3단계(내 승인 → DB 저장)**: 스크립트 `approve-and-save.mjs` 완성 + **첫 실제 저장 검증**(스택베이커리 1곳, 배포 앱 노출 확인). → **자동화 5단계 전 과정(수집→검증→승인→저장→노출) 완성.** ⚠️ 자동수집분은 미검증(D수준)·카테고리 미정 → 관리자 페이지로 보완 예정.
- **관리자 작업대(보기 단계)**: `/admin/workbench` 완성. 2차 결과를 승인후보/보류/제외 카드 + 공용 카카오 지도로 표시. **이중 잠금**(페이지 가드 + `middleware.ts` 배포 하드 404). 로컬 dev에서만 열림. 다음은 승인·카테고리·등급 버튼 연동.
- **중복표시 버그 수정(2026-06-26) → main 배포 반영 완료**: 탐색(explore)에서 저장 빵집이 카카오 후보로도 떠 중복되던 문제 해결. `buildExploreMapItems` dedup(placeId 최우선 + 점수 ≥55) + 안내 문구 보정. 단위테스트 4종, 실데이터(베리스베어) 확인. **PR #3(squash, `0a98363`)으로 main 머지 → Vercel production 배포.** 최소 변경(explore 3파일만, 빌드 가드·작업대 등 미포함).
- **로컬 dev DB = 원격 읽기전용 전환 완료(2026-06-26)**: 로컬 Supabase(Docker) 꺼져 `fetch failed` 나던 문제 → 평소 개발은 원격 DB를 읽기 전용으로(쓰기 차단). 자세히는 아래 "로컬 개발 DB 모드".
- **검증등급 자동화 완성(2026-06-26) — 카카오 사전점검 + 웹검색 등급 + 카테고리 자동제안**: 작업대 카드에 **"정밀 검증(웹검색)"** 버튼 추가. Claude **Haiku 4.5**(`VERIFY_MODEL` 상수, Sonnet 교체가능) + `web_search`(max **2회 하드캡**)로 블로그·뉴스·맛집매체 교차확인 → **등급 C/B/A "제안" + 빵 카테고리 "제안"을 같은 검색 1회로 동시 산출**(추가 웹검색·비용 없음). 결과에 출처 링크·근거·확신도 + "추천 카테고리(근거 포함)" 표시, **추천 카테고리는 기존 체크박스에 미리 체크**(사용자가 수정 후 "카테고리 저장"). **DB 쓰기는 "적용/저장" 누른 것만**(등급→verification_records 증거 포함; 카테고리→기존 저장 흐름). **추측 금지**: 등급·카테고리 모두 웹 근거 있는 것만, 근거 없으면 미정. **곳당 실비 ≈ 60~75원**(변동) — 베리스베어 실측: 제안 B + 카테고리 **케이크**(다이닝코드 대표메뉴 근거), 검색 2회. 파일: `lib/verification-research{,-core}.ts`(+테스트 12종), `app/api/admin/workbench/verify/route.ts`, 작업대 UI. 로컬 전용(기존 이중잠금). ⚠️ **카카오 평점·리뷰는 공식 API 미제공·비공식 엔드포인트 404(폐기)** → "무료 평점 자동 C"는 불가 → 등급·카테고리 모두 **웹검색 근거에서만** 산정(우리 원칙: 평점/이름만으론 확정 안 함).

- **대량수집 1라운드 완료(2026-06-27) — 6개 동네 90곳 수집·2차검증, 전부 승인후보**: 연남동·망원동·성수동·서촌·한남동·익선동 각 카카오 "빵집" 검색 15곳 → 합 90곳. 2차 결과 **승인후보 90 / 보류 0 / 제외 0**(전부 카카오 제과·베이커리 카테고리 + 기존 DB 10곳과 무중복 → 규칙으로 확정, **Claude 호출 0건 = 2차 비용 0원**). 프랜차이즈 3곳은 표시만(제외 아님). **DB 저장 안 함** — `output/stage2-verified.json`만 생성, 작업대(`/admin/workbench`)에서 승인·카테고리·정밀검증 등급 부여 예정. 2차 스크립트에 **25건 분할 호출 + 배치내 placeId 중복제거** 보강(이번엔 무발동, 다음 대량 라운드 대비).
- **대량수집 1라운드 승인 완료(2026-06-27) — 90곳 전부 작업대 UI로 저장·라이브 노출.** 사용자가 `/admin/workbench`에서 90곳을 직접 승인 → `bakery_locations` **10행 → 100행**(전부 `status=active`+`published_at`, 05:08~05:54 생성). 카테고리는 이름매칭 13곳 위주, 나머지 미정. 등급 미검증(D) — 원하는 곳만 정밀검증 예정.
- **`approve-and-save.mjs`에 `--approve all` 추가(2026-06-27)** — `parseSelection`에 `all` 분기(3줄), 승인후보 전체 선택. `--confirm` 게이트·중복 재조회·블로커 skip·멱등 전부 유지. 이름매칭 카테고리 자동연결 동일. **멱등 검증**: 1라운드 90곳이 이미 저장돼 있어 `--approve all` 드라이런이 "저장예정 0 / 건너뜀 90(중복)"로 정상 동작 확인. 다음 대량 라운드 일괄 승인용.
- **탐색 "지도에서 보기" → 단일 핀 포커스(2026-06-27) → PR #4로 main 배포 반영.** 탐색 결과 카드 "지도에서 보기" 클릭 시 지도에 후보 전부 대신 **선택 핀 1개만**(+`setLevel(4)` 확대), "전체 결과 보기"/새 검색으로 해제, 목록은 전체 유지. 코드 2파일(`explore-workspace.tsx`·`kakao-map.tsx`, +30/-3). **PR #4(squash `e174d5a`) → main → Vercel production.** typecheck/lint/테스트 + 헤드리스(gstack) 왕복 검증 완료.

### 커밋 현황
| 커밋 | 내용 | 원격 push |
|---|---|---|
| `9d7196b` | 배포 env 검증 빌드 가드 | ✅ |
| `3c00f24` | 뺑드미 아차산점 추가 SQL | ✅ |
| `7416bf1` | 좌표 변환 + 원격 DB 도구 스크립트 | ✅ |
| `03928c1` | 카카오 1차 검증 스크립트 | ✅ |
| `10aa4c1` | 작업일지·인수인계 문서 추가 | ✅ |
| `ea6aa3d` | 2차 검증 스크립트(옛 표시판, 호출 없음) | ✅ |
| `dd2476c` | 2차 검증 **실제 Claude 호출판 재작성** + 일지 | ✅ |
| `2b0aa4f` | 일지: 2차 실호출 검증 반영 | ✅ |
| `d72ce68` | 3단계 `approve-and-save` 추가 + 일지 | ✅ |
| `2fd0167` | 로컬 전용 관리자 작업대 페이지(보기) + 배포 차단 미들웨어 + 일지 | ✅ |
| `df80d5a` | 작업대 2단계: 쓰기 3종(승인·카테고리·등급) + 원격 연결 + 일지 | ✅ |
| `16b0515` | 일지 갱신(작업대 완성·insane-search 보류·버그 기록) | ✅ |
| `8c367f6` | 탐색 화면 저장 빵집 중복 표시 버그 수정 + 안내 문구 보정 + 일지 | ✅ (codex) |
| `7ba32ac` | 로컬 dev를 원격 읽기전용 DB로 전환 + 전환 도구 + 일지 | ✅ (codex) |
| `0a98363` | **PR #3 squash → `main` 배포 반영** (중복 수정 explore 3파일만) | ✅ `main` |
| `03ef826` | 2차 검증 **25건 분할호출 + 배치내 placeId 중복제거** 보강 + 대량수집 1라운드 일지 | ✅ (codex) |
| `64ccf45` | 작업대 카테고리 **이름추정 자동 미리체크** + HANDOFF 갱신 | ✅ (codex) |
| `e8b5733` | `approve-and-save.mjs` **`--approve all`** 추가 + 90곳 승인완료·일지 | ✅ (codex) |
| `9a031a8` | 탐색 "지도에서 보기" → **단일 핀 포커스**(+setLevel 확대) | ✅ (codex) |
| `e174d5a` | **PR #4 squash → `main` 배포 반영** (탐색 단일 핀 포커스 2파일) | ✅ `main` |

---

## 🔄 진행 중

- **자동화 5단계 + 관리자 작업대(지도 포함) 전부 완성·커밋·push 완료.**
- **대량수집 1라운드(6동네 90곳) 승인 완료 — 90곳 전부 작업대 UI로 저장, 라이브 노출 중(`bakery_locations` 100행).** 카테고리는 이름매칭 13곳 위주, 나머지 미정. 등급 미검증(D) — 원하는 곳만 정밀검증 예정. `approve-and-save.mjs`에 `--approve all` 추가(다음 라운드 일괄 승인용, 멱등 확인).
- 미커밋: `next-env.d.ts`(자동 생성, 커밋 제외).

## 🧪 로컬 개발 DB 모드 (2026-06-26)

> 로컬 dev 서버가 어느 Supabase를 보는지. `.env.local`은 gitignored(값은 문서·커밋에 없음).

- **현재 = B: 원격(라이브) 읽기 전용.** Docker 없이 항상 켜짐 + production과 같은 데이터(베리스베어 등) 확인 가능. 이유: 로컬 Supabase(Docker)가 꺼져 `fetch failed`가 났고, 매번 켜는 번거로움 회피.
  - 전환 방법: `node scripts/switch-env-remote.mjs` — `.env.local`의 로컬값을 `# [LOCAL-BACKUP]` 주석으로 보존하고, `NEXT_PUBLIC_SUPABASE_URL`=원격 / `ANON`=원격 anon 키 / **`SUPABASE_SECRET_KEY`·`SERVICE_ROLE`=비움(쓰기 차단)** 으로 바꿈. anon 키는 `npx supabase login` 후 CLI(`projects api-keys`)로 받아 직접 기록(화면 미출력).
  - **안전장치**: 공개 클라이언트는 anon+RLS라 읽기만. secret 비움 → 앱의 관리자/서버 쓰기 클라이언트 비활성 → dev에서 실데이터 못 바꿈. (작업대·`approve-and-save.mjs`는 원래 `.env.remote.local`로 따로 동작 — 무관.)

- **A로 되돌리기 (로컬 Docker, 대량 쓰기·마이그레이션·파이프라인 테스트 시 권장):**
  1. `.env.local`에서 `# === [원격 읽기전용 전환] BEGIN … END ===` 블록 삭제 + `# [LOCAL-BACKUP] ` 접두어를 떼서 로컬값 복원.
  2. Docker Desktop 실행(설정에서 로그인 시 자동시작 켜두면 편함).
  3. `npx supabase start` (포트 54321 기동, migration + `seed.sql` 자동 적용). 확인: `npx supabase status`.
  4. `npm run dev` → `.env.local`이 `http://127.0.0.1:54321`을 가리키므로 로컬 DB 사용.
  - 끄기: `npx supabase stop`(데이터 보존).
- ⚠️ B(원격)에서는 절대 대량 쓰기/마이그레이션 테스트 금지 → 그땐 A로.

## 🐞 알려진 버그
- (없음) ✅ **저장된 빵집이 카카오 후보로 중복 표시** 버그는 2026-06-26 해결 — `buildExploreMapItems`에서 placeId 일치(빵집 slug=`kakao-<id>` ↔ 후보 `externalId`) 최우선 제외, 없으면 이름·주소·전화·좌표 점수 ≥55(신호 2개 이상)일 때만 제외. 안전 우선이라 단일 신호로는 안 거름. 안내 문구도 제거 후 실제 개수로 보정. 실데이터(베리스베어, slug=`kakao-1512893541`) 확인.

---

## ✅ 다음 할 일

1. **대량 수집** — ✅ 1라운드(6동네: 연남·망원·성수·서촌·한남·익선, 90곳) 수집·**승인 완료**(2026-06-27, 90곳 전부 라이브 노출·`bakery_locations` 100행). 남은 것: 미정 카테고리 77곳 정밀검증(원하는 곳만)·등급(D→) 보완. **2라운드** 가능(합정·상수·부암동·가로수길·을지로·잠실 등) — `approve-and-save.mjs --approve all --confirm`로 일괄 승인 가능. ⚠️ 작업대는 `stage2-verified.json` 한 파일만 읽어 덮어쓰므로, 2라운드 stage2 전에 1라운드 산출물 백업/완료 확인.
2. (선택) 보류(사람확인) 건 검토 흐름, 프랜차이즈 체인 ASCII slug 매핑 확대. 정밀 검증 정확도 아쉬우면 `VERIFY_MODEL`을 Sonnet으로 교체.
3. (배포 보안) 한때 노출됐던 Supabase secret key **rotate** 여부 확인 — 사용자 확인 필요
- ~~검증등급 자동화~~ → **2026-06-26 완성**(위 "현재 상태" 참고). ~~중복표시 버그 수정~~ → **2026-06-26 완료**.

### 전체 파이프라인 그림 (5단계 전부 완성)
```
후보 → [카카오 1차검증] → [Claude 2차검증] → [내 승인 → DB 저장] → 앱 노출
        ✅ 완성            ✅ 완성·검증        ✅ 완성              ✅ 확인
```

---

## 📏 작업 규칙 (이 프로젝트에서 지키는 것)

- **계획 우선:** 작업 전 계획을 보여주고 승인받은 뒤 진행한다.
- **민감정보 금지:** 키·비밀번호·`.env*` 값을 코드/커밋/채팅/문서에 절대 넣지 않는다. 자격증명은 gitignored 파일에서만 읽는다.
- **좌표는 카카오 API 값만** 사용한다. 추측 좌표 금지.
- **`quest_` 접두사 테이블은 건드리지 않는다** (별도 교육앱용).
- **DB:** `bakery_locations` 등 기존 테이블 **구조는 바꾸지 않고 행만** 추가/수정. SQL은 재실행 안전(idempotent)하게.
- **커밋:** 관련 파일만 골라서, 한글 메시지로. `next-env.d.ts`(자동 생성)는 커밋 제외. push는 별도 승인.
- **DB 직접 작업:** 좌표·데이터 입력은 스크립트로 처리 가능. 쓰기 작업은 승인 후.

---

## 📁 주요 파일 목록

### 운영/자동화 스크립트 (`scripts/`)
| 파일 | 역할 | 상태 |
|---|---|---|
| `geocode-address.mjs` | 주소 → 좌표(카카오 주소검색) | 커밋·push됨 |
| `supabase-admin.mjs` | 원격 Supabase 접속·조회(읽기 테스트) | 커밋·push됨 |
| `verify-stage1-kakao.mjs` | 1차: 카카오 키워드 검색 검증 | 커밋됨(push 대기) |
| `verify-env.mjs` | 배포 env 계약 검증(빌드 시 실행) | 커밋·push됨 |
| `verify-stage2-claude.mjs` | 2차: 적합성·중복·이름 판정 + 애매 건 Claude(raw fetch) 호출 | 완성·실호출 검증·커밋·push |
| `approve-and-save.mjs` | 3차: 승인 후 DB 저장(브랜드·위치·카테고리), 플래그 3단계·idempotent | 완성·첫 저장 검증·커밋·push |

### 관리자 작업대 (로컬 전용, 보기 단계)
| 파일 | 역할 | 상태 |
|---|---|---|
| `app/admin/workbench/page.tsx` | 작업대 페이지(가드+데이터 로드) | 완성·커밋 대기 |
| `lib/workbench.ts` | `stage2-verified.json` 읽기(서버 fs) | 완성·커밋 대기 |
| `components/admin-workbench.tsx` (+`.module.css`) | 상태별 카드 3구역 + 공용 카카오 지도 + 쓰기 컨트롤 3종 | 보기 커밋됨 / 쓰기 미커밋 |
| `middleware.ts` | 배포에서 `/admin/*`·`/api/admin/*` 하드 404 차단 | 커밋됨 |
| `lib/workbench-write.ts` | 작업대 쓰기 로직 + 원격 클라이언트(`createWorkbenchClient`, .env.remote.local) | 완성·미커밋 |
| `app/api/admin/workbench/{approve,categories,grade}/route.ts` | 승인 저장 / 카테고리 동기화 / 수동 등급 API | 완성·미커밋 |

### 데이터/설정
| 파일 | 역할 | 비고 |
|---|---|---|
| `supabase/manual/add-paindemie-achasan.sql` | 뺑드미 추가 SQL | 커밋·push됨 |
| `supabase/migrations/*.sql` | DB 스키마 | 기존 |
| `supabase/seed.sql` | 예시 데이터 | 기존 |
| `lib/supabase/config.ts` | env 읽기·URL 검증 | 가드 추가됨 |
| `.env.local` | 로컬 개발용 자격증명 | **gitignored** |
| `.env.remote.local` | 원격 DB 자격증명 | **gitignored** |
| `output/stage1-kakao.json` | 1차 검증 산출물 | **gitignored** |
| `output/stage2-verified.json` | 2차 검증 산출물(3차 입력) | **gitignored** |

---

## 🗓️ 날짜별 기록

### 2026-06-27
1. **대량수집 1라운드(6개 동네) 실행 — 사용자 승인 후 끝까지 자동 진행.**
   - 동네: 연남동·망원동·성수동·서촌·한남동·익선동(원래 12동네 제안 → 사용자 요청으로 절반). 각 카카오 "빵집" 키워드검색 15곳 = 합 90곳.
   - **1차(카카오)**: 6쿼리 전부 통과, 90곳 수집(`output/stage1-kakao.json`). 무료(쿼터 내).
   - **2차(Claude 검증)**: 승인후보 90 / 보류 0 / 제외 0. 전부 카카오 `제과,베이커리` 카테고리 + 기존 DB 10곳과 무중복 → **규칙으로 확정**, 애매 건 0 → **Claude 호출 0건 = 비용 0원**(예상 ~270원보다 적음). 프랜차이즈 3곳(서촌1·한남2)은 `is_franchise` 표시만, 제외 안 함.
   - **2차 스크립트 보강 2종**: ① 애매 건 **25건씩 분할 호출**(많을 때 `max_tokens`로 응답 잘려 전부 '보류' 떨어지는 것 방지), ② **배치 내 placeId 중복제거**(인접 동네가 같은 가게 중복 반환 대비). 이번엔 애매 0·중복 0이라 둘 다 무발동이지만 다음 대량 라운드 대비. 문법검사·실행 확인.
   - **DB 쓰기 0건**(수집은 읽기만). 결과는 `output/stage2-verified.json`에만. **저장은 작업대에서 사용자 승인 시.**
   - ⚠️ 주의: 키워드가 일반 "빵집"이라 2차가 거른 게 없음 = 90곳은 "카카오 카테고리상 빵집·DB미존재" 수준의 1차 통과분일 뿐, **품질·등급 미검증(D)**. 작업대 정밀검증으로 등급·카테고리 부여 필요.
   - 다음: 로컬 dev `/admin/workbench`에서 승인·카테고리·정밀검증. 더 모으려면 2라운드.
2. **작업대 카테고리 이름추정 자동 미리체크 구현** — `components/admin-workbench.tsx`. 신규(미저장) 빵집은 이름에 `CAT_KEYWORDS` 단서 있으면 체크박스 미리체크, 저장된 빵집은 DB값 유지. `CAT_KEYWORDS` 크루아상에 "크루아쌍" 추가. 90곳 중 **13곳 이름매칭**(베이글3·구움과자4·케이크2·소금빵2·크루아상2), 77곳 미정. typecheck/lint + dev SSR 체크박스 13개로 검증. silent DB 쓰기 없음. (커밋 `64ccf45`)
3. **사용자가 작업대 UI에서 90곳 전부 승인 → 라이브 노출.** `bakery_locations` **10행 → 100행**(2026-06-27 05:08~05:54, 전부 active+published). 1라운드 전량 production 노출. (미검증 D·미정 카테고리 다수 — 정밀검증으로 추후 보완.)
4. **`approve-and-save.mjs --approve all` 추가** — `parseSelection`에 `all` 분기(승인후보 전체). `--confirm` 게이트·중복재조회·블로커skip·멱등·이름카테고리 자동연결 전부 유지. **멱등 검증**: 이미 저장된 90곳 대상 드라이런이 "저장예정 0 / 건너뜀 90(중복)"로 정상. 다음 라운드 일괄 승인용(`--approve all --confirm`). 정책: 미검증 D등급 자동 노출 수용(사용자 결정).
5. **탐색(explore) "지도에서 보기" → 단일 핀 포커스** — `components/explore-workspace.tsx` + `components/kakao-map.tsx`. 기존엔 카드 "지도에서 보기"가 `selectedId`만 바꿔 지도에 후보 전부 표시됐음. `focusedId` 상태 + `mapItems`(포커스 시 그 1개만) 추가 → 지도엔 **선택한 핀 1개만**. `KakaoMap`에 `setLevel(4)` 추가로 단일 핀이면 **적당히 확대**(B안). 새 "전체 결과 보기" 버튼/새 검색으로 해제. 목록은 전체 유지. **검증**: typecheck/lint/explore-map 테스트 7종 통과 + **헤드리스 브라우저(gstack)로 왕복 확인**(연남동 검색→카드 클릭 시 뷰=map·전체결과보기 버튼 등장·프리뷰="리틀빅토리"·목록 15 유지 → "전체 결과 보기" 클릭 시 해제). DB·API 변경 0. → **PR #4(main 기준 새 브랜치 `feat/explore-single-pin-focus`에 2파일만, squash `e174d5a`)로 main 머지 → Vercel production 배포 반영.**

### 2026-06-25
1. **자동화 2단계(Claude 2차 검증) 완성** — `verify-stage2-claude.mjs`를 **실제 Claude 호출판으로 재작성**.
   - 옛 버전(`ea6aa3d`)은 애매 건을 `needs_claude_review`로 표시만 하고 Claude를 부르지 않았음 → 실제 호출판으로 교체.
   - **하이브리드**: 명확한 규칙은 코드 자동(중복 확정·명백한 빵집), 애매한 경계만 모아 **raw fetch로 Claude 1회 호출**(per-bakery 반복 아님, 비용 절감).
   - **결과 3갈래**: 승인후보 / 보류(사람확인) / 제외 (`decided_by`=rule·claude·fallback).
   - 모델 결정: 사용자가 비용 표 보고 **Sonnet 4.6** 선택(상단 `CLAUDE_MODEL` 상수). 호출 방식은 1차 `geocode`/`stage1`과 일관되게 **raw fetch**(새 의존성 0).
   - 키 없거나 호출 실패 시 애매 건은 안전하게 **'보류' 폴백**.
2. **테스트(광진구 15곳)**: 승인후보 14 / 보류 0 / 제외 1. **뺑드미 → 중복("뺑드미 아차산점" 약 5m)으로 정확히 제외**. 아티제·파리바게뜨는 `is_franchise` 표시만 하고 승인후보 통과. 전부 규칙으로 확정되어 Claude 호출 0건.
3. **실제 Claude 호출 검증 완료**: `.env.local`에 `ANTHROPIC_API_KEY` 넣고 키 인식 확인(값 비노출). **연남동 30곳(빵집+디저트 혼합)** 으로 1차→2차 전체 흘림.
   - 결과: 승인후보 19 / **보류 7** / 제외 4. 카페·디저트카페(디저트뷰·홍콩데이디저트카페·마카롱롱롱 등)를 **보류(사람확인)** 로, 카카오 검색에 딸려온 치킨·고기·양식·술집을 제외로 정확히 분류. **보류 케이스 실제 작동 확인.**
   - **호출/비용**: 애매한 11건을 **1회 호출로 묶어** 처리(per-bakery 반복 아님). 빵집 1곳당 **약 1.5원**(Sonnet 4.6 토큰 추정). 규칙 확정 건은 호출 0.
   - (참고) loadKey 정규식을 bash `node -e`로 테스트하면 따옴표 처리 탓에 첫 글자가 떨어져 보이는 아티팩트가 있으나, 실제 `.mjs` 파일은 키를 정상(108자, sk-ant-)으로 읽음 — 임시 .mjs로 확정.
4. **자동화 3단계(내 승인 → DB 저장) 완성** — `scripts/approve-and-save.mjs`.
   - 승인 방식: **플래그 3단계** — 목록 → `--approve 1,3,5`(드라이런, 저장X) → `--approve … --confirm`(저장). 대화형 프롬프트 대신 플래그식(테스트 안전·멈춤 없음).
   - 저장: `bakery_brands`(slug로 find-or-create) + `bakery_locations`(status=active, published_at=now → 즉시 노출) + `location_bread_categories`(이름 키워드로 추정된 것만). slug/seed_key=`kakao-<placeId>`(재실행 안전). 프랜차이즈는 매핑된 것만 공유 브랜드, 미매핑 체인은 위치별 브랜드.
   - 카테고리: 이름에 빵 종류 단어 있을 때만 "추정", 불확실하면 **미정(추측 금지)**. 드라이런에서 "추정"/"미정" 표시.
   - 안전: `--confirm` 없으면 쓰기 없음 / 저장 직전 DB 중복 재조회(slug·seed_key·도로명·좌표50m+이름) / 좌표·주소 카카오값만 / `quest_` 미사용 / 키는 `.env.remote.local`만.
   - (수정) DB 연결 후 `process.exit()` 호출 시 Windows libuv assertion(exit 127) 떠서 → 연결 후 자연 종료로 변경.
5. **첫 실제 저장 검증**: 광진구 14곳 중 **#1 스택베이커리 1곳만** `--confirm`으로 저장.
   - DB 재조회로 확인: slug=`kakao-78696240`, status=active, 서울/광진구/자양동, 좌표 카카오값, 카테고리 미정(연결 없음).
   - 배포 앱 상세페이지 노출 확인: `https://find-bakery.vercel.app/bakery/kakao-78696240`. **5단계 전 과정 동작 확인 완료.**
   - ⚠️ 다음 과제: 자동수집 빵집 **검증·등급(현재 미검증/D)** 및 **카테고리 미정** 보완 → 관리자 페이지.

6. **로컬 전용 관리자 "작업대" 페이지(보기 단계) 완성** — `/admin/workbench`.
   - 새 파일만 추가(기존 코드 무수정): `app/admin/workbench/page.tsx`, `lib/workbench.ts`, `components/admin-workbench.tsx`(+`.module.css`), `middleware.ts`.
   - 화면: 2차 결과(stage2-verified.json)를 **승인후보/보류/제외 3구역 카드** + **공용 카카오 지도**(기존 `KakaoMap` 재사용, 카드 클릭→핀 강조)로 표시. 카드에 이름·주소·카테고리·검증등급(미검증·D)·출처(카카오 원문)·프랜차이즈·2차 사유.
   - UI는 **CSS 모듈로 격리**(전역 디자인 무손상). shadcn 아님 — 기존 전역 CSS 어휘(`admin-page` 등) + 모듈 병용.
   - **보안 이중 잠금**: ① 페이지 `isDemoAdminEnabled()` + `notFound()` ② `middleware.ts`가 배포(production)에서 `/admin/*`·`/api/admin/*`를 **요청 단계에서 진짜 404**로 차단. 둘 다 허용 조건은 `NODE_ENV!=="production" || ENABLE_DEMO_ADMIN==="true"`(=로컬 dev에서만).
   - 검증: `npm run dev`로 `/admin/workbench` 정상 렌더(콘솔 에러 0, 스크린샷). 운영 사이트에서 동일 가드 admin 페이지는 내용 미노출(not-found) 확인 — 미들웨어로 상태코드까지 하드 404로 강화. 지도는 Kakao JS 키 도메인 미등록 시 graceful 폴백.
7. **관리자 작업대 2단계(쓰기 3종) 완성** — 카테고리 지정 / 승인 저장 / 수동 등급부여.
   - 새 파일: `lib/workbench-write.ts`(쓰기 로직 + 원격 클라이언트), `app/api/admin/workbench/{approve,categories,grade}/route.ts`. `components/admin-workbench.tsx`에 카드 컨트롤 추가, `lib/workbench.ts`에 DB 상태(저장여부·기존카테고리·현재등급) 읽기 첨부.
   - 카테고리: 6종 체크박스 + 이름기반 "추정" 힌트(자동저장 X, 최종 선택은 사람) + add/remove 동기화. 승인: 확인→approve API(브랜드+location active, 멱등). 등급: D/C/B/A 토글 → 뺑드미 동일 구조로 verification_records 기록. 모든 쓰기 window.confirm 1회. 저장 안 된 빵집은 카테고리·등급 비활성(스키마상 location_id 필요).
   - **DB 연결 이슈 발견·해결**: dev 앱(`.env.local`)=로컬 Supabase(127.0.0.1), 파이프라인 스크립트=원격. 작업대만 원격을 보도록 `createWorkbenchClient()`(`.env.remote.local`) 추가 → 사용자 결정(원격 연결)대로 적용. 앱 나머지는 로컬 그대로.
   - 테스트: (로컬DB) 베리스베어 승인→카테고리→등급 end-to-end 통과. (원격 전환 후) 스택베이커리가 `저장됨`으로 표시, 카테고리 케이크+등급 C 적용·반영 확인 후 라이브 보호 위해 되돌림(미정/D). 멱등·입력방어(400) OK.
   - dev 서버 turbopack 스테일 청크로 한 번 에러 → 재시작으로 해결. (참고: 베리스베어 테스트행은 로컬 샌드박스 DB에만 남음.)
8. **작업대 지도 켜짐 → 작업대 완전 완성.** 카카오 디벨로퍼스 > 앱 설정 > 플랫폼 > Web 사이트 도메인에 `http://localhost:3000` 등록(카카오 사이트 설정, 코드 변경 없음). 카드+지도+카테고리+승인+등급 모두 동작 확인.
9. **`insane-search` 플러그인 검토 → 보류 결정.** 차단 우회 공개페이지 리더(Claude Code 플러그인). 네이버 블로그 읽기엔 유효하나 인스타 미지원. 보류 사유: 전역설치(pip/npm)·헤드리스 브라우저·미감사 3rd-party·ToS 회색지대 등 효과 대비 위험. → **검증등급 자동화는 Claude API 웹검색 + 카카오 API로** 진행하기로 결정.
10. **버그 발견(미수정)**: 탐색(explore)에서 이미 저장된 빵집이 카카오 "미검증 후보"로도 떠서 **중복 표시**됨 → 다음 과제로 기록.

### 2026-06-24
1. **배포 Supabase 연결 실패 해결**
   - Vercel 런타임 로그로 원인 확정: `NEXT_PUBLIC_SUPABASE_URL` 칸에 secret key가 잘못 입력되어 `Invalid URL` 발생(이전 추정인 localhost 문제가 아니었음).
   - 보안: secret key가 `NEXT_PUBLIC_`로 브라우저에 노출됨 → **rotate 권고**.
   - 재발 방지: `verify-env.mjs`가 Vercel 빌드 시 잘못된 env(키를 URL에 넣는 등)를 차단하도록 보강 + `package.json` build에 연결. (`9d7196b`)
2. **카테고리 필터 진단**: 코드는 정상. 구움과자·케이크는 시드에 빵집 연결이 없어 결과 0이 정상이었음. 진단용 SQL 제공.
3. **뺑드미 아차산점 추가**: 스키마에 맞춘 INSERT SQL 작성(이름·slug 중복 시 건너뜀, 재실행 안전). 사용자가 SQL Editor에서 실행 → 배포 앱 케이크·식사빵 카테고리 정상 노출 확인. (`3c00f24`)
4. **좌표 자동화**: `geocode-address.mjs`로 "서울 광진구 영화사로 45" 정확 좌표 조회.
5. **원격 DB 직접 접근 설정**: `.env.remote.local`(gitignored)에 원격 자격증명 보관, `supabase-admin.mjs`로 접속. 읽기 테스트 성공. (`vercel env pull`은 값이 Sensitive로 잠겨 사용 불가 → 수동 입력.)
6. **좌표 원격 업데이트**: 뺑드미 좌표를 카카오 검증값(위도 37.556124, 경도 127.091880)으로 업데이트 후 재조회로 확인. 도구 스크립트 커밋. (`7416bf1`)
7. **보안 점검 + push**: 민감정보 누출 없음 확인 후 `7416bf1`까지 push.
8. **자동화 1단계 작성**: `verify-stage1-kakao.mjs`. "광진구 빵집" 테스트 → 15건 통과, 뺑드미 포착 확인. JSON 출력. (`03928c1`, push 대기)
9. **2차 검증 설계 확정**: 하이브리드 판정 + 프랜차이즈는 표시만 하고 통과.
