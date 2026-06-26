# 인수인계 한 장 요약 (HANDOFF)

> 새 채팅을 시작할 때 이 파일 내용을 붙여넣으면 맥락이 이어집니다.
> 자세한 내용은 `WORKLOG.md` 참고. 민감정보는 여기에 없습니다.

## 프로젝트
- **빵길(study-find-bakery)** — 빵집 정보 서비스(Next.js + Supabase + 카카오 지도), Vercel 배포.
- 배포: https://find-bakery.vercel.app · 작업 브랜치: `codex/map-list-sync`

## 지금까지
**2026-06-24**
- 배포 Supabase 연결 실패 해결(원인: Vercel env의 URL 칸에 secret key 오입력). 빌드 검증 가드 추가.
- 빵집 **뺑드미 아차산점** DB 추가 + 좌표를 카카오 검증값으로 교정 완료.
- 운영 도구 스크립트 완성: 주소→좌표 변환, 원격 DB 접속.
- **자동화 1단계(카카오 1차 검증)** 스크립트 완성.

**2026-06-25**
- **자동화 2단계(Claude 2차 검증)** 스크립트 완성 — 실제 Claude 호출판으로 재작성(옛 버전은 호출 없이 표시만 했음). 모델 Sonnet 4.6.
- 광진구 15곳 테스트: 승인후보 14 / 보류 0 / 제외 1, **뺑드미가 중복(약 5m)으로 정확히 제외**됨.
- **실제 Claude 호출까지 검증 완료** — 연남동 30곳(빵집+디저트 혼합) 실행: 승인후보 19 / **보류 7** / 제외 4. 카페·디저트카페를 **보류(사람확인)** 로, 치킨·고기·양식·술집을 제외로 정확히 분류. **보류 케이스 작동 확인.**
- **비용 실측(대략)**: 애매한 11건을 **1회 호출로 묶어** 처리 → 빵집 1곳당 **약 1.5원**(Sonnet 4.6 토큰 추정). 규칙으로 확정된 건은 호출 0.
- **자동화 3단계(내 승인 → DB 저장)** 완성 — `scripts/approve-and-save.mjs`. 플래그 3단계(목록 → `--approve` 드라이런 → `--confirm` 저장). **첫 실제 저장: 스택베이커리 1곳**(서울 광진구) DB 입력 + 배포 앱 상세페이지 노출 확인. → **자동화 5단계 전 과정(수집→검증→승인→저장→노출) 완성.**
- ⚠️ 자동수집 빵집은 **검증기록 없이(미검증, 신뢰등급 D 수준)** 저장됨 → 추후 검증·등급 부여 필요(다음 과제).
- ⚠️ 빵 카테고리는 이름 키워드로만 보수적 추정 → 다수가 **카테고리 미정**으로 저장됨 → 보완 필요(다음 과제).
- **로컬 전용 관리자 "작업대"(보기 단계)** 완성 — `/admin/workbench`. 2차 결과(stage2-verified.json)를 승인후보/보류/제외 3구역 카드 + 공용 카카오 지도(KakaoMap 재사용)로 표시. **이중 잠금**: 페이지 가드 + `middleware.ts` 배포 하드 404. UI는 CSS 모듈로 격리.
- **관리자 작업대 2단계(쓰기 3종)** 완성 — 카드에서 승인 저장 / 카테고리 지정 / 수동 등급(D/C/B/A). 작업대는 `.env.remote.local`로 **원격(라이브) DB**에 연결(approve-and-save와 동일). 등급은 뺑드미와 동일 구조. 스택베이커리로 원격 테스트 통과(적용 확인 후 라이브 보호 위해 테스트값 되돌림).
- **카카오 JS 지도 켜짐** — 카카오 디벨로퍼스 > 앱 설정 > 플랫폼 > Web 사이트 도메인에 `http://localhost:3000` 등록(카카오 사이트 설정, 코드 변경 없음) → 작업대 지도 핀 정상 표시. **작업대 완전 완성**(카드·지도·카테고리·승인·등급).

**2026-06-26**
- **중복표시 버그 수정 완료** — 탐색(explore)에서 저장된 빵집이 카카오 "미검증 후보"로도 떠 중복 표시되던 문제 해결. `lib/explore-map.ts`의 `buildExploreMapItems`에 dedup 추가: **① placeId 일치 최우선**(빵집 slug=`kakao-<id>` ↔ 카카오 후보 `externalId`, 같으면 무조건 같은 가게로 보고 후보 제외 — 오판 0) → **② placeId 없을 때만 이름·주소·전화·좌표 점수 ≥ 55(신호 2개 이상)**. 안전 우선: 단일 신호(이름만/주소만/좌표만)로는 안 거르고 남김 → 다른 빵집을 잘못 숨기지 않음. 빵집(verified)은 그대로, 겹치는 후보만 제외. 기존 검증 매처 `findPossibleDuplicateLocations` 재사용.
- **안내 문구도 보정** — `explore-workspace.tsx`에서 "미검증 카카오 후보 N곳" 문구를 **중복 제거 후 실제 표시 개수**로 세도록 변경. 후보가 전부 중복이라 0곳이면 문구 숨김.
- **검증**: 단위테스트 4종 추가(`explore-map.test.ts`) → 전체 통과 / 타입체크·린트 OK. **실데이터 베리스베어**(slug=`kakao-1512893541`)로 확인: 라이브 카카오 후보(id=`1512893541`)가 제거되어 병합 결과 빵집 1 + 후보 0(중복 사라짐). **DB·API·`quest_` 변경 0.**
- **→ main 배포 반영 완료**: 중복 수정 3파일만 `main` 기준 새 브랜치에 얹어 **PR #3(squash, `0a98363`) 머지 → Vercel production 배포.** preview에서 베리스베어 1개만 확인 후 머지. (production은 `main` 기준이라 코드 변경은 main 머지해야 반영됨 — 이게 그동안 배포에 안 보이던 이유였음.)
- **로컬 dev DB = 원격 읽기전용 전환 완료**: 로컬 Supabase(Docker) 꺼져 `fetch failed` 나던 문제 해결. `scripts/switch-env-remote.mjs`로 `.env.local`을 원격 URL+anon(읽기)으로, **secret 비워 쓰기 차단**(실데이터 보호). 로컬 원래값은 `[LOCAL-BACKUP]` 주석 보존. 대량 쓰기·마이그레이션 땐 로컬 Docker(`npx supabase start`)로 되돌리기 — 자세히는 `WORKLOG.md`. (전환 커밋 `7ba32ac`는 `codex/map-list-sync`에 로컬, push 미정.)
- **검증등급 자동화 완성** — 작업대 카드 **"정밀 검증(웹검색)"** 버튼: ① 카카오 사전점검(카드의 카카오 카테고리·주소·원문) ② Claude **Haiku 4.5** + `web_search`(2회 캡)로 블로그·뉴스·맛집매체 교차확인 → **등급 C/B/A + 빵 카테고리를 같은 검색 1회로 동시 제안**(추가 비용 없음). 결과에 출처·근거·확신도 + "추천 카테고리(근거)" 표시, 추천 카테고리는 체크박스에 **미리 체크**. **추측 금지**: 웹 근거 있는 것만, 근거 없으면 미정. DB 쓰기는 사용자가 **등급 "적용"/카테고리 "저장"** 누른 것만(verification_records에 증거 포함). **곳당 ≈60~75원**. 베리스베어 실측: 등급 B + 카테고리 **케이크**(다이닝코드 대표메뉴 근거). 파일: `lib/verification-research{,-core}.ts`(+테스트 12종), `app/api/admin/workbench/verify/route.ts`, 작업대 UI. 로컬 전용(기존 이중잠금). ⚠️ 카카오 평점·리뷰는 공식 API 미제공·비공식 404 → 등급·카테고리 모두 **웹검색 근거에서만**.

## 자동화 전체 그림 (5단계 전부 완성)
```
후보 → [카카오 1차검증] → [Claude 2차검증] → [내 승인 → DB 저장] → 앱 노출
        ✅ 완성            ✅ 완성·검증        ✅ 완성              ✅ 확인
```

## 자동화 2단계(Claude 2차 검증) 요약 — `scripts/verify-stage2-claude.mjs`
- 입력: `output/stage1-kakao.json` → 출력: 표 + `output/stage2-verified.json`
- **하이브리드 판정**: 명확한 규칙은 코드 자동, 애매한 경계만 모아 **raw fetch로 Claude 1회 호출**(per-bakery 반복 아님)
- **3축**: ① 카테고리 적합성 ② DB 중복(읽기 전용) ③ 이름 정합성
- **결과 3갈래**: 승인후보 / 보류(사람확인) / 제외 (`decided_by`=rule·claude·fallback)
- 모델 `claude-sonnet-4-6`(상단 `CLAUDE_MODEL` 상수로 교체 가능). 키 없거나 호출 실패 시 애매한 건 안전하게 '보류' 폴백
- **프랜차이즈는 `is_franchise=true` 표시만 하고 통과**(제외 안 함)

## 자동화 3단계(승인 → 저장) 요약 — `scripts/approve-and-save.mjs`
- 입력: `output/stage2-verified.json` 중 `decision==="승인후보"` 만 대상
- **플래그 3단계**: 목록 → `--approve 1,3,5`(드라이런·저장X) → `--approve 1,3,5 --confirm`(저장)
- 저장: `bakery_brands`(find-or-create) + `bakery_locations`(status=active, 즉시 노출) + `location_bread_categories`(추정된 것만)
- slug/seed_key = `kakao-<placeId>`(재실행 안전). 프랜차이즈는 매핑된 것만 공유 브랜드, 나머지는 위치별 브랜드
- 안전: `--confirm` 없으면 쓰기 없음 / 저장 직전 DB 중복 재조회 / 좌표·주소 카카오값만 / 카테고리 불확실하면 미정(추측 금지)

## 관리자 작업대 요약 — `/admin/workbench` (로컬 전용)
- 파일: `app/admin/workbench/page.tsx`, `lib/workbench.ts`(읽기+DB상태), `lib/workbench-write.ts`(쓰기+원격클라이언트), `app/api/admin/workbench/{approve,categories,grade}/route.ts`, `components/admin-workbench.tsx`(+`.module.css`), `middleware.ts`
- 입력: `output/stage2-verified.json` + DB 상태(저장여부·기존 카테고리·현재 등급) 첨부.
- **DB 연결: 원격(라이브)** — `createWorkbenchClient()`가 `.env.remote.local`을 읽어 원격에 연결(approve-and-save.mjs와 동일). 앱 나머지는 `.env.local`=로컬 dev DB.
- **쓰기 3종**(모두 window.confirm 1회 + 저장된 빵집에만 활성):
  - 승인: approve API → 브랜드+location(active) 저장, 멱등.
  - 카테고리: 6종 체크박스(+이름기반 "추정" 힌트, 자동저장X) → location_bread_categories add/remove 동기화.
  - 등급: D/C/B/A → 뺑드미 동일 구조(sources→verification_records, field=business_hours, verified_at=오늘).
- 보안 이중 잠금: 페이지 가드 + 미들웨어(배포 시 `/admin/*`·`/api/admin/*` 하드 404). `.env.remote.local`은 gitignored 로컬 파일 → 배포에 없음. **로컬 dev에서만 동작 → 외부 노출 없음.**

## 바로 다음 할 일
1. **대량 수집** — 더 많은 동네를 1·2차로 모아 작업대에서 승인·정비(현재 광진구/연남동 위주). 모인 빵집은 작업대 **"정밀 검증"** 으로 등급+카테고리 일괄 정비.
- (선택) 보류(사람확인) 건 검토 흐름, 프랜차이즈 체인 ASCII slug 매핑 확대. 정밀 검증 정확도 아쉬우면 `VERIFY_MODEL`→Sonnet.
- ~~검증등급 자동화~~ → **2026-06-26 완성**(위 "지금까지" 참고). ~~중복표시 버그 수정~~ → **2026-06-26 완료**.

## 꼭 지킬 규칙
- 작업 전 **계획 보여주고 승인** 받기.
- **민감정보 금지**: 키·비밀번호·`.env*` 값을 코드/커밋/채팅/문서에 넣지 않기(자격증명은 gitignored 파일에서만 읽음).
- **좌표는 카카오 API 값만**(추측 금지).
- **`quest_` 테이블 손대지 않기**.
- DB는 **구조 변경 없이 행만**, SQL은 재실행 안전하게. 쓰기는 승인 후.
- 커밋은 관련 파일만·한글 메시지, push는 별도 승인. `next-env.d.ts`는 커밋 제외.

## 열린 항목
- ✅ **해결·배포**: 탐색(explore) 저장 빵집 카카오 후보 **중복 표시** 버그 → 2026-06-26 dedup 수정(placeId 최우선 + 점수 ≥55) → **PR #3로 `main` 머지·production 배포 반영 완료**.
- **배포 구조**: production = `main` 브랜치. `codex/map-list-sync`의 코드 변경은 **main 머지(PR)** 해야 배포됨(작업대·자동화 등은 아직 main 미반영, 의도적). 로컬 `7ba32ac`(원격전환)는 push 미정.
- **결정**: `insane-search` 보류 → 검증등급 자동화는 **Claude API 웹검색 + 카카오 API**로.
- **DB 상태**: 스택베이커리(slug=`kakao-78696240`) active 저장. 재실행해도 중복 안 들어감.
- 자동수집 빵집 **미검증(D 수준)** + **카테고리 미정** → 작업대로 보완.
- 한때 노출됐던 Supabase secret key **rotate** 여부 확인 필요.
