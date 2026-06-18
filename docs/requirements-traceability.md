# 요구사항 추적표

작성 기준일: 2026-06-18

제품 요구사항이 화면, 데이터, 테스트 중 한 곳에서 빠지는 일을 줄이기 위한 연결 기준이다. 구현이 시작되면 코드 경로와 테스트 이름을 추가한다.

| ID | 상태 | 제품 요구사항 | UX/화면 | 데이터·로직 | 구현·검증 증거 |
|---|---|---|---|---|---|
| R-001 | 부분 | 지역·테마·대표 메뉴 추천 | 홈 | BreadCategory, FameEvidence, BakeryLocation | `app/page.tsx`, `lib/bakeries.ts`; 테마·실데이터 근거는 미구현 |
| R-002 | 예정 | 지도/목록 전환 탐색 | 탐색 | 공통 SearchQuery, 동일 결과 ID 집합 | 목록 구현, 지도 미구현 |
| R-003 | 부분 | 지역·빵 종류·영업·편의·검증 필터 | 탐색 필터 | BakeryLocation, BreadCategory, 영업 상태 계산, VerificationRecord | `app/explore/page.tsx`, `searchBakeries`; 지역·종류 단위 테스트 통과 |
| R-004 | 부분 | 정확한 지점 상세 정보 | 상세 | BakeryLocation, BusinessHour, SpecialSchedule | `app/bakery/[slug]/page.tsx`; 특별 일정 연결, 정적 시드만 사용 |
| R-005 | 부분 | 대표 메뉴와 가격 | 상세 메뉴 | MenuItem, VerificationRecord | 메뉴·가격·확인일 표시, 실제 출처 미연동 |
| R-006 | 부분 | 공식 출처와 검증 상태 | 상세·출처 기록 | Source, ExternalAccount, VerificationRecord | `VerificationBadge`, 신선도 테스트; 항목별 기록 화면 미구현 |
| R-007 | 구현 | 빵집 저장 | 상세·저장 | SavedBakery, 로컬 저장 병합 | `SavedBakeriesProvider`, `SaveButton`, 저장 유지·해제 브라우저 검증 |
| R-008 | 부분 | 정보 오류 제보 | 제보 화면 | CorrectionReport | 입력 검증, API 우선·로컬 폴백, 접수번호 구현; 원격 DB 실행 미검증 |
| R-009 | 부분 | 관리자 검수 | 관리자 | ReviewAction, VerificationRecord | 로컬 큐·상태 전이·감사 이력 및 Supabase RPC 구현; 인증·원격 실행 미검증 |
| R-010 | 부분 | 임시휴무와 특별영업 | 상세·관리자 | SpecialSchedule | 우선순위 계산과 단위 테스트, 임시휴무 실브라우저 검증; 관리자 입력 미구현 |
| R-011 | 예정 | SNS 최신 공지 검증 | 출처 기록·관리자 | ExternalAccount, Source | 연동 계약과 검증 규칙만 존재 |
| R-012 | 부분 | 유명한 이유 설명 | 홈·상세 | FameEvidence, Source | 상세 시드 문구 표시; 실근거 미연동 |
| R-013 | 예정 | 위치 권한 거부 대안 | 탐색 | 지역 직접 선택 상태 | 지역 링크만 구현 |
| R-014 | 부분 | 로딩·빈 결과·오류 상태 | 모든 핵심 화면 | 공통 오류 모델 | 빈 결과·404 구현; 로딩·외부 오류 미구현 |
| R-015 | 부분 | 모바일 접근성 | 모든 핵심 화면 | 디자인 토큰·컴포넌트 | 시맨틱 스냅샷·모바일 실브라우저 확인; 자동 접근성 검사 미구현 |
| R-016 | 부분 | 외부 지도 길찾기 | 상세 | 공급자 URL 생성기 | 카카오맵 링크 구현; URL 생성 단위 테스트 미구현 |
| R-017 | 예정 | 폐점·이전 이력 보존 | 상세·관리자 | Location status, 변경 이력 | 논리 모델만 존재 |
| R-018 | 부분 | 테스트 배포 | 베타 전체 | 환경 변수·배포 설정 | 로컬 production build·배포 환경 계약 구현; 원격 미리보기 미배포 |

## 구현 중 갱신 규칙

각 요구사항에 다음 증거가 생기면 표에 추가한다.

- 구현 파일
- 단위 테스트
- 통합 테스트
- 브라우저 흐름 테스트
- 마이그레이션
- 배포 확인 URL 또는 결과

요구사항이 변경되면 기존 ID를 다른 의미로 재사용하지 않는다. 폐기된 요구사항은 삭제하지 않고 상태와 결정 근거를 기록한다.
