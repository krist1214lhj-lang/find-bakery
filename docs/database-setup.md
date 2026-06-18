# Supabase 데이터베이스 설정

작성 기준일: 2026-06-18

## 현재 상태

- 초기 PostgreSQL 스키마와 RLS 정책: `supabase/migrations/202606180001_initial_schema.sql`
- UI 검증용 시드: `supabase/seed.sql`
- Supabase 생성 형식과 호환되는 타입 스냅샷: `lib/supabase/database.types.ts`
- 정적 스키마 계약 검사: `npm run verify:schema`

현재 작업 환경에는 Docker가 없어 로컬 Supabase 컨테이너에 마이그레이션을 실제 적용하지 못했다. 정적 검사 통과는 실제 PostgreSQL 적용 성공을 대신하지 않는다.

## 로컬 데이터베이스 검증

Docker Desktop을 설치하고 실행한 뒤:

```bash
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > lib/supabase/database.types.ts
npm run verify
```

확인 항목:

1. 모든 마이그레이션과 시드가 오류 없이 적용
2. `anon` 사용자가 공개 지점만 조회 가능
3. 익명 사용자가 `correction_reports`에 직접 INSERT 불가
4. 로그인 사용자가 자신의 저장 목록만 관리
5. 일반 로그인 사용자가 검수 RPC 실행 불가
6. `reviewer` 또는 `admin` 역할만 검수 RPC 실행 가능
7. 승인·반려 시 제보 상태와 `review_actions`가 한 트랜잭션으로 변경

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
3. `npm run verify:schema`
4. `npm run typecheck`
5. 제보·검수 상태 전이 테스트
