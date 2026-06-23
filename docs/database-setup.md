# Supabase 데이터베이스 설정

작성 기준일: 2026-06-23

## 현재 상태

- 초기 PostgreSQL 스키마와 RLS 정책: `supabase/migrations/202606180001_initial_schema.sql`
- UI 검증용 시드: `supabase/seed.sql`
- 로컬 스키마에서 생성한 TypeScript 타입: `lib/supabase/database.types.ts`
- 정적 스키마 계약 검사: `npm run verify:schema`
- 공식 출처 확인과 A등급 생성 RPC: `register_official_verification`

2026-06-19에 Docker 기반 로컬 Supabase에서 초기 마이그레이션과 시드를 실제 적용했다. PostgreSQL 스키마 린트, 공개 지점 조회 RLS, 익명 제보 직접 입력 차단, 일반 사용자의 검수 RPC 차단, 검수자 승인 트랜잭션을 확인했다.

## 로컬 데이터베이스 검증

Docker Desktop을 설치하고 실행한 뒤:

```bash
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > lib/supabase/database.types.ts
npm run verify
```

앱 실행 전 `.env.local`에 로컬 Supabase가 표시한 공개 값을 등록한다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<LOCAL_PUBLISHABLE_OR_ANON_KEY>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

공개 조회에는 anon/publishable 키만 사용한다. Secret 또는 service role 키를 `NEXT_PUBLIC_` 변수에 넣지 않는다.

확인 항목:

1. 모든 마이그레이션과 시드가 오류 없이 적용
2. `anon` 사용자가 공개 지점만 조회 가능
3. 익명 사용자가 `correction_reports`에 직접 INSERT 불가
4. 로그인 사용자가 자신의 저장 목록만 관리
5. 일반 로그인 사용자가 검수 RPC 실행 불가
6. `reviewer` 또는 `admin` 역할만 검수 RPC 실행 가능
7. 승인·반려 시 제보 상태와 `review_actions`가 한 트랜잭션으로 변경
8. 공식 확인 시 계정·출처·A등급·감사 이력이 한 트랜잭션으로 생성

2026-06-19 로컬 확인 결과:

- `npx supabase start`: 마이그레이션·시드 적용 성공
- `npx supabase db lint`: 스키마 오류 0건
- 시드 지점 3개와 `anon` 공개 조회 3개 일치
- 지점 1개를 트랜잭션 안에서 `draft`로 바꾸면 `anon` 조회가 2개로 감소
- `anon`의 `correction_reports` 직접 INSERT 권한 없음
- `anon`의 검수 RPC 실행 권한 없음
- 역할이 없는 `authenticated` 사용자의 검수 RPC 실행 차단
- `reviewer` 역할 승인 시 제보 상태 `accepted`와 감사 이력 1건이 같은 트랜잭션에서 생성
- `npx supabase gen types typescript --local` 생성본으로 타입 갱신 후 타입 검사 통과

2026-06-22 재검증:

- `npx supabase db reset`으로 빈 DB에서 마이그레이션·전체 시드 적용 성공
- 지점 3개, 영업시간 21개, 메뉴 6개, 출처·검증·유명세 근거 각 3개 생성
- 서버 제보 → 관리자 큐 → 검수 RPC 승인 → 감사 이력 흐름 통과
- 장소 후보·후보 검수 감사 테이블과 `review_place_candidate` RPC 마이그레이션 적용 성공
- 전체 17개 RLS 테이블 계약과 PostgreSQL 스키마 린트 오류 0건

장소 후보 검수 흐름:

1. 카카오 검색 결과의 서버 서명 토큰 검증
2. `place_candidates`에 `provider + external_id` 기준 멱등 저장
3. 기존 지점과 상호·주소·전화·좌표 중복 점수 계산
4. 관리자 보류·반려·중복·승인
5. 승인 시 브랜드·지점·지도 출처·C등급 검증 기록을 원자적으로 생성
6. 중복 시 새 지점을 만들지 않고 기존 지점 연결과 감사 기록만 보존

2026-06-22 실제 카카오 후보 저장→관리자 승인→정식 공개 통합 검증을 통과했다. 승인 결과로 `verification_needed` 지점, 카카오 지도 출처, 주소·좌표·전화 C등급 기록, 후보 감사 이력이 생성됨을 확인했고 검증 데이터는 제거했다.

공공데이터 교차 확인 근거를 가진 후보 승인 테스트도 통과했다. 일치 점수 100점의 상가정보 근거를 저장한 뒤 승인했을 때 주소·좌표의 카카오·공공데이터 기록이 모두 B등급으로 생성되고 `map_api`, `public_data` 출처가 함께 보존되었다. 검증 데이터는 제거해 시드 지점 3개 상태로 복구했다.

실제 공공 API 통합 검증에서는 카카오 `퍼먼트`와 상가정보 `퍼먼트알티드`가 상호 유사·주소 일치·좌표 1m 이내로 90점을 받았다. 근거 저장 후 승인했을 때 동일하게 B등급과 두 출처가 생성되었고 검증 데이터는 제거했다.

2026-06-23 공식 출처 검증:

- `official_verification_actions` RLS와 감사 주체 제약 적용
- 공식 홈페이지·SNS는 URL, 플랫폼, 공식성 판단 근거 필수
- 전화·현장 확인은 외부 계정 생성을 금지
- 현재 저장값이 없는 항목은 A등급 생성 차단
- 같은 지점·항목·메뉴의 기존 활성 검증은 `superseded`로 보존
- 기존 `conflicts` 기록도 명시적인 새 공식 확인이 성공하면 `superseded`로 전환
- 영업시간 공식 SNS 등록 → 출처·외부 계정·A등급·감사 이력 생성 확인
- 같은 공식 SNS로 영업시간·전화번호를 연속 확인해 외부 계정 1개와 감사 이력 2건 생성 확인
- 상세 화면에 새 확인일·발행 주체·공식 원문 링크 반영 확인
- 브라우저 검증 후 가상 공식 출처 데이터는 로컬 DB 초기화로 제거
- `next_review_at` 경과 기록의 공개 C등급 전환과 관리자 재검증 큐 노출 확인
- 테스트 충돌 기록의 공개 D등급 전환과 큐 최우선 정렬 확인

## 원격 테스트 프로젝트 연결

운영 프로젝트와 분리된 Supabase 테스트 프로젝트를 사용한다.

```bash
npx supabase login
npx supabase link --project-ref <TEST_PROJECT_REF>
npx supabase db push
npx supabase gen types typescript --project-id <TEST_PROJECT_REF> > lib/supabase/database.types.ts
```

그 후 Vercel Preview 환경에 다음 값을 등록한다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ENABLE_DEMO_ADMIN=false`
- `NEXT_PUBLIC_KAKAO_MAP_JS_KEY`

배포 전:

```bash
npm run verify
npm run verify:deploy-env
```

## 보안 원칙

- `SUPABASE_SECRET_KEY`와 레거시 `SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용
- 공개 브라우저는 anon/publishable key만 사용
- 익명 제보는 `/api/reports`를 통해 서버에서 검증 후 저장
- 관리자 상태 변경은 직접 UPDATE가 아니라 `review_correction_report` RPC 사용
- 공개 배포에서 로컬 데모 관리자 화면은 비활성화
- 실제 검수자 인증이 연결되기 전에는 운영 제보를 승인하지 않음
- 공개 테스트 전에 제보 API에 지속형 IP/기기 속도 제한과 모니터링 연결

## 타입 갱신 규칙

마이그레이션이 바뀌면 같은 변경에서 타입을 다시 생성하고 다음을 확인한다.

1. `lib/supabase/database.types.ts` 갱신
2. API 및 저장소 타입 검사
3. `npm run verify:schema` — 19개 RLS 테이블과 검수·공식 확인 RPC 계약 검사
4. `npm run typecheck`
5. 제보·검수 상태 전이 테스트
