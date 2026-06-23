# 빵길(bbang-gil) 프로젝트 점검 보고서

작성일: 2026-06-23
대상 브랜치: `codex/map-list-sync`
검토 범위: 코덱스 작업분 코드·문서·품질 게이트

---

## 1. 프로젝트 개요

신뢰할 수 있는 빵집 탐색 앱. 외부 검색 결과를 바로 게시하지 않고 **다중 출처 교차 확인 → 관리자 승인 → 출처·확인일·검증등급(A~D) 기록**을 거치는 것이 핵심 차별점이다.

- 스택: Next.js 16, React 19, TypeScript, Supabase(RLS), Kakao Local API, 소상공인 상가정보 API
- 단계: 로컬 기능형 MVP (실데이터·인증·원격배포는 미완)

---

## 2. 이번 브랜치가 한 일 (로드맵 3단계 "지도·탐색")

목록과 지도를 하나의 결과 모델로 통합한 작업이다.

| 구분 | 파일 | 내용 |
|------|------|------|
| 신규 | `lib/explore-map.ts` | 검증 빵집 + 카카오 후보를 단일 `ExploreMapItem`으로 합치는 공통 모델, bounds 필터, 중심/반경 계산 |
| 신규 | `lib/explore-map.test.ts` | ID 분리·bounds 필터·반경 클램프 단위 테스트 |
| 신규 | `components/explore-workspace.tsx` | 목록/지도 전환, 선택 동기화, "이 지역 검색", 후보 검수요청 |
| 신규 | `components/kakao-map.tsx` | Kakao Maps SDK 로더, 마커, 키 없을 때 폴백 화면 |
| 삭제 | `components/nearby-bakery-search.tsx` | 위 워크스페이스로 대체 |
| 수정 | `app/api/places/search/route.ts` | `radius` 파라미터 추가·검증 |
| 수정 | `app/explore/page.tsx` | 필터 링크가 현재 검색조건 보존, `view` 상태 유지 |
| 수정 | `app/globals.css` | +308줄 (분할 보기/지도 UI 스타일) |

### 품질 게이트 (직접 실행 확인)

- ✅ `npm run lint` 통과
- ✅ `npm run typecheck` 통과
- ✅ `npm test` — 56개 전부 통과

설계 품질은 양호하다. 외부 응답을 내부 도메인 모델로 변환하고, 목록과 지도가 같은 `visibleItems`를 공유하며, `radius`가 좌표 없이 오면 거부하는 등 `AGENTS.md` 원칙을 잘 지켰다.

---

## 3. 개선점·수정사항

### 🔴 1순위 — 지도 마커 선택 시 화면이 튀는 버그 (`components/kakao-map.tsx`)

마커 생성 effect(135~166행)의 의존성 배열에 `selectedId`가 포함되어 있다.

```ts
}, [items, onSelect, selectedId, status]);
```

`selectedId`는 단지 마커 zIndex를 올리는 데만 쓰이는데 의존성에 있어서, **마커를 클릭해 선택할 때마다**:

1. 전체 마커를 모두 파괴·재생성하고,
2. `items.length > 1`이면 `map.setBounds(bounds)`로 **지도를 전체 결과에 다시 맞춘다.**

그런데 바로 아래(168~179행)의 별도 effect는 선택 항목으로 `panTo`를 한다. 결과적으로 한 번의 클릭에서 "전체 보기로 줌아웃 → 선택 지점으로 이동"이 충돌해 화면이 튀고, 마커도 매 선택마다 불필요하게 재생성된다.

**수정 방향:** 마커 생성(`items`, `status`)과 선택 강조(`selectedId`)를 분리한다. `selectedId`를 마커 재생성 effect에서 빼고, 선택 effect에서 이전/현재 마커 비교 후 `setZIndex` + `panTo`만 처리한다.

### 🟠 2순위 — `.tmp/`가 .gitignore에 없음

```
?? .tmp/   ← docx-render 등 무관한 산출물이 추적 대상으로 노출됨
```

`.tmp/`는 이 프로젝트와 무관한 임시 산출물인데 무시 목록에 없어 실수로 커밋될 위험이 있다. `.gitignore`에 `.tmp/` 한 줄을 추가한다.

### 🟠 3순위 — 문서 간 수치 불일치

`docs/project-status-and-roadmap.md`가 뒤처져 있다.

- 로드맵: **"단위 테스트 42개"**, "최신 커밋 `cefed87`"
- 실제 / `docs/implementation-status.md`: **56개**, 최신 커밋 `6e96ec3`

`AGENTS.md`의 "문서는 코드와 같은 변경에서 함께 갱신한다" 원칙에 맞게 로드맵 문서의 테스트 개수·커밋 해시를 갱신한다. 두 문서가 같은 수치를 중복 보관하는 구조라 앞으로도 어긋날 수 있으므로, 한쪽만 단일 기준으로 두는 편이 낫다.

### 🟡 4순위 — SDK 로드 실패 시 재시도 불가 (`components/kakao-map.tsx`)

`sdkPromise`가 모듈 전역 싱글톤이라 첫 로드가 실패하면 거부된 promise가 계속 재사용되어, 이후 어떤 마운트에서도 재시도하지 않는다. `.catch` 시 `sdkPromise = null`로 리셋하면 일시적 네트워크 오류에서 복구된다.

### 🟡 참고 — 상태가 URL에 완전히 보존되지 않음

`changeView`가 `view`만 `replaceState`로 반영하고, 선택 항목·검색한 후보는 새로고침 시 사라진다. MVP 단계에선 허용 범위이나, 추후 공유 링크/뒤로가기 대응 시 고려 대상이다.

---

## 4. 종합 의견

코덱스 작업분은 **로드맵 3단계의 핵심(목록·지도 통합 모델, 선택 동기화, 영역 검색)을 깔끔하게 구현**했고 린트·타입·테스트가 모두 통과한다. 구조적 완성도는 좋다.

배포 전 반드시 손볼 것은 **1순위(지도 선택 튐 버그)** 하나이고, 2·3순위(`.tmp` 무시, 문서 수치)는 즉시 처리 가능한 정리 작업이다.

다음 우선순위는 로드맵대로 **카카오 지도 JS 키·허용 도메인 설정 후 실제 타일/마커 검증 → 영업·검증등급 필터 → 관리자 인증**이다.
