# 도메인 데이터 모델

작성 기준일: 2026-06-18  
상태: 논리 모델 초안

## 1. 모델링 원칙

- 브랜드와 실제 방문 지점은 분리한다.
- 사실 값과 그 값을 증명하는 출처·검증 기록은 분리한다.
- 영구 영업시간과 임시휴무·특별영업은 분리한다.
- 외부 서비스의 ID는 내부 기본키로 사용하지 않는다.
- 폐점·이전된 지점은 삭제하지 않고 상태와 이력을 보존한다.
- 날짜·시간은 대한민국 지점 기준 `Asia/Seoul`을 기본으로 하되 시간대를 필드로 저장한다.
- 사용자 화면에 노출되는 주요 정보는 출처와 확인 시점을 추적할 수 있어야 한다.

## 2. 핵심 관계

```text
BakeryBrand 1 ── N BakeryLocation
BakeryLocation 1 ── N BusinessHour
BakeryLocation 1 ── N SpecialSchedule
BakeryLocation 1 ── N MenuItem
BakeryLocation N ── N BreadCategory
BakeryLocation 1 ── N ExternalAccount
BakeryLocation 1 ── N FameEvidence
PlaceCandidate 0..1 ── 1 BakeryLocation
PlaceCandidate 1 ── N PlaceCandidateReviewAction

Source 1 ── N VerificationRecord
VerificationRecord N ── 1 BakeryLocation
VerificationRecord N ── 0..1 MenuItem

User 1 ── N SavedBakery
User 1 ── N CorrectionReport
BakeryLocation 1 ── N CorrectionReport
CorrectionReport 1 ── N ReviewAction
BakeryLocation 1 ── N OfficialVerificationAction
```

## 3. 엔터티

### BakeryBrand

브랜드 또는 독립 빵집의 정체성이다.

| 필드                 | 타입        | 필수 | 설명                 |
| -------------------- | ----------- | ---: | -------------------- |
| `id`                 | UUID        |    O | 내부 식별자          |
| `name`               | text        |    O | 공식 브랜드명        |
| `slug`               | text        |    O | URL용 고유 값        |
| `description`        | text        |    X | 출처가 있는 소개     |
| `foundedYear`        | integer     |    X | 설립 연도            |
| `officialWebsiteUrl` | URL         |    X | 공식 웹사이트        |
| `status`             | enum        |    O | `active`, `inactive` |
| `createdAt`          | timestamptz |    O | 생성 시각            |
| `updatedAt`          | timestamptz |    O | 수정 시각            |

### BakeryLocation

사용자가 실제 방문하는 지점이다.

| 필드            | 타입        | 필수 | 설명                                                                                |
| --------------- | ----------- | ---: | ----------------------------------------------------------------------------------- |
| `id`            | UUID        |    O | 내부 식별자                                                                         |
| `brandId`       | UUID        |    O | 브랜드                                                                              |
| `name`          | text        |    O | 지점 표시명                                                                         |
| `searchAliases` | text[]      |    O | 외국어 공식명을 한글로 찾기 위한 검수된 별칭과 띄어쓰기 변형                        |
| `slug`          | text        |    O | URL용 고유 값                                                                       |
| `status`        | enum        |    O | `draft`, `active`, `temporary_closed`, `closed`, `relocated`, `verification_needed` |
| `roadAddress`   | text        |    O | 도로명 주소                                                                         |
| `lotAddress`    | text        |    X | 지번 주소                                                                           |
| `latitude`      | decimal     |    O | WGS84 위도                                                                          |
| `longitude`     | decimal     |    O | WGS84 경도                                                                          |
| `regionLevel1`  | text        |    O | 시·도                                                                               |
| `regionLevel2`  | text        |    O | 시·군·구                                                                            |
| `regionLevel3`  | text        |    X | 읍·면·동                                                                            |
| `phone`         | text        |    X | 전화번호                                                                            |
| `timezone`      | text        |    O | 기본 `Asia/Seoul`                                                                   |
| `parking`       | enum        |    O | `yes`, `no`, `limited`, `unknown`                                                   |
| `seating`       | enum        |    O | `yes`, `no`, `limited`, `unknown`                                                   |
| `takeout`       | enum        |    O | `yes`, `no`, `unknown`                                                              |
| `shipping`      | enum        |    O | `yes`, `no`, `unknown`                                                              |
| `publishedAt`   | timestamptz |    X | 공개 시각                                                                           |
| `createdAt`     | timestamptz |    O | 생성 시각                                                                           |
| `updatedAt`     | timestamptz |    O | 수정 시각                                                                           |

주소·좌표·전화번호 같은 값은 현재 조회 성능을 위해 지점에 보관하되, 각 값의 신뢰 근거는 `VerificationRecord`에서 추적한다.

외국어 상호의 한글 검색은 자동 번역이나 임의 음역에 의존하지 않고 `searchAliases`에 검수된 한글 표기, 공식 영문명, 통용 표기를 저장한다. 검색 시 대소문자·공백·일반 기호 차이는 정규화하되 서로 다른 브랜드를 자동 병합하지 않는다.

### PlaceCandidate

카카오 등 외부 공급자에서 발견한 장소를 정식 지점과 분리해 보관한다.

| 필드                 | 타입        | 필수 | 설명                                                           |
| -------------------- | ----------- | ---: | -------------------------------------------------------------- |
| `id`                 | UUID        |    O | 내부 식별자                                                    |
| `provider`           | text        |    O | 현재 `kakao`                                                   |
| `externalId`         | text        |    O | 공급자 장소 ID                                                 |
| `name`               | text        |    O | 공급자 상호                                                    |
| `address`            | text        |    O | 지번 주소                                                      |
| `roadAddress`        | text        |    X | 도로명 주소                                                    |
| `phone`              | text        |    X | 공급자 전화번호                                                |
| `latitude/longitude` | decimal     |    O | WGS84 좌표                                                     |
| `placeUrl`           | URL         |    O | 공급자 원문                                                    |
| `status`             | enum        |    O | `discovered`, `in_review`, `approved`, `rejected`, `duplicate` |
| `matchedLocationId`  | UUID        |    X | 중복 처리한 기존 지점                                          |
| `approvedLocationId` | UUID        |    X | 승인으로 생성된 정식 지점                                      |
| `firstSeenAt`        | timestamptz |    O | 최초 수집 시각                                                 |
| `lastSeenAt`         | timestamptz |    O | 마지막 공급자 조회 시각                                        |
| `reviewedAt`         | timestamptz |    X | 최종 검수 시각                                                 |

`provider + externalId`는 고유하다. 검색 응답의 서버 서명 단기 토큰을 검증한 후보만 저장한다.

승인 시 `BakeryBrand`, `BakeryLocation`, 지도 `Source`, 주소·좌표·전화 `VerificationRecord`를 한 트랜잭션으로 생성한다. 지도 단일 출처만 있는 승인 지점은 `verification_needed`와 C등급으로 공개하며 추가 출처 확인 대상으로 남긴다.

### PlaceCandidateReviewAction

외부 후보의 보류·승인·반려·중복 병합 감사 기록이다.

| 필드                | 타입        | 필수 | 설명                                          |
| ------------------- | ----------- | ---: | --------------------------------------------- |
| `candidateId`       | UUID        |    O | 장소 후보                                     |
| `reviewerId`        | UUID        |    X | 로그인 검수자                                 |
| `reviewerLabel`     | text        |    O | 서버 작업 포함 감사 주체                      |
| `action`            | enum        |    O | `hold`, `approve`, `reject`, `mark_duplicate` |
| `reason`            | text        |    O | 판단 근거                                     |
| `previousStatus`    | enum        |    O | 변경 전 상태                                  |
| `nextStatus`        | enum        |    O | 변경 후 상태                                  |
| `matchedLocationId` | UUID        |    X | 중복 처리 시 연결한 기존 지점                 |
| `createdAt`         | timestamptz |    O | 처리 시각                                     |

### PlaceCandidateEvidence

외부 후보와 독립 출처의 교차 확인 결과를 승인 전 근거로 보존한다.

| 필드              | 타입        | 필수 | 설명                     |
| ----------------- | ----------- | ---: | ------------------------ |
| `candidateId`     | UUID        |    O | 장소 후보                |
| `provider`        | text        |    O | 현재 `sbiz`              |
| `externalId`      | text        |    O | 공공 상가업소 번호       |
| `name`            | text        |    O | 공공데이터 상호          |
| `industry*`       | text        |    X | 대·중·소 업종명          |
| `lot/roadAddress` | text        |    X | 지번·도로명 주소         |
| `latitude`        | decimal     |    O | 공공데이터 위도          |
| `longitude`       | decimal     |    O | 공공데이터 경도          |
| `matchScore`      | integer     |    O | 상호·주소·좌표 일치 점수 |
| `matchReasons`    | text[]      |    O | 점수 근거                |
| `retrievedAt`     | timestamptz |    O | 공급자 조회 시각         |

70점 이상 근거가 있는 후보를 승인하면 공공데이터 `Source`와 주소·좌표 B등급 `VerificationRecord`를 생성하고 기존 카카오 기록도 B등급으로 승격한다.

### BusinessHour

반복되는 기본 영업시간이다.

| 필드         | 타입    | 필수 | 설명                     |
| ------------ | ------- | ---: | ------------------------ |
| `id`         | UUID    |    O | 식별자                   |
| `locationId` | UUID    |    O | 지점                     |
| `dayOfWeek`  | integer |    O | 1(월)~7(일)              |
| `sequence`   | integer |    O | 하루 복수 영업 구간 순서 |
| `opensAt`    | time    |    X | 휴무면 null              |
| `closesAt`   | time    |    X | 휴무면 null              |
| `isClosed`   | boolean |    O | 정기휴무 여부            |
| `validFrom`  | date    |    X | 적용 시작                |
| `validUntil` | date    |    X | 적용 종료                |

### SpecialSchedule

임시휴무, 특별영업, 행사 시간 변경을 저장한다.

| 필드         | 타입        | 필수 | 설명                                                         |
| ------------ | ----------- | ---: | ------------------------------------------------------------ |
| `id`         | UUID        |    O | 식별자                                                       |
| `locationId` | UUID        |    O | 지점                                                         |
| `type`       | enum        |    O | `temporary_closed`, `special_open`, `changed_hours`, `event` |
| `startsAt`   | timestamptz |    O | 시작                                                         |
| `endsAt`     | timestamptz |    O | 종료                                                         |
| `opensAt`    | time        |    X | 변경 영업 시작                                               |
| `closesAt`   | time        |    X | 변경 영업 종료                                               |
| `note`       | text        |    X | 사용자 표시 설명                                             |
| `sourceId`   | UUID        |    O | 근거 출처                                                    |
| `status`     | enum        |    O | `draft`, `confirmed`, `expired`, `cancelled`                 |

### MenuItem

지점에서 판매하는 메뉴다. 같은 브랜드여도 지점별 판매 여부가 다를 수 있어 지점에 귀속한다.

| 필드           | 타입        | 필수 | 설명                                                        |
| -------------- | ----------- | ---: | ----------------------------------------------------------- |
| `id`           | UUID        |    O | 식별자                                                      |
| `locationId`   | UUID        |    O | 지점                                                        |
| `name`         | text        |    O | 메뉴명                                                      |
| `description`  | text        |    X | 설명                                                        |
| `price`        | integer     |    X | 원 단위 가격                                                |
| `priceNote`    | text        |    X | 변동·옵션 설명                                              |
| `isSignature`  | boolean     |    O | 대표 메뉴 여부                                              |
| `availability` | enum        |    O | `regular`, `seasonal`, `limited`, `unknown`, `discontinued` |
| `imageId`      | UUID        |    X | 대표 이미지                                                 |
| `checkedAt`    | timestamptz |    X | 가격·판매 확인 시각                                         |
| `status`       | enum        |    O | `active`, `hidden`, `discontinued`                          |

### BreadCategory

검색 필터용 빵 분류다.

- 소금빵
- 크루아상·페이스트리
- 베이글
- 식빵
- 식사빵·사워도우
- 도넛
- 케이크
- 구움과자
- 전통빵
- 비건
- 글루텐 프리

분류는 계층 구조를 허용하되 MVP에서는 최대 2단계로 제한한다.

### ExternalAccount

공식 홈페이지와 SNS 계정을 관리한다.

| 필드                  | 타입        | 필수 | 설명                                                                                     |
| --------------------- | ----------- | ---: | ---------------------------------------------------------------------------------------- |
| `id`                  | UUID        |    O | 식별자                                                                                   |
| `locationId`          | UUID        |    X | 지점 계정                                                                                |
| `brandId`             | UUID        |    X | 브랜드 계정                                                                              |
| `platform`            | enum        |    O | `website`, `instagram`, `naver_blog`, `naver_place`, `kakao_channel`, `youtube`, `other` |
| `url`                 | URL         |    O | 계정 주소                                                                                |
| `handle`              | text        |    X | 계정명                                                                                   |
| `officiality`         | enum        |    O | `official`, `semi_official`, `user_generated`, `unknown`                                 |
| `officialityEvidence` | text        |    X | 공식성 판단 근거                                                                         |
| `verifiedAt`          | timestamptz |    X | 공식성 확인 시각                                                                         |
| `status`              | enum        |    O | `active`, `unavailable`, `private`, `deleted`                                            |

`brandId`와 `locationId` 중 정확히 하나 이상은 존재해야 한다. 지점별 계정이 없고 브랜드 계정만 있는 경우 게시물의 대상 지점을 별도로 확인한다.

### Source

정보의 원문 또는 확인 행위다.

| 필드                | 타입        | 필수 | 설명                                                                                                                          |
| ------------------- | ----------- | ---: | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`                | UUID        |    O | 식별자                                                                                                                        |
| `type`              | enum        |    O | `official_site`, `official_sns`, `phone`, `map_api`, `public_data`, `tourism_data`, `media`, `user_report`, `onsite`, `other` |
| `url`               | URL         |    X | 원문 주소                                                                                                                     |
| `externalAccountId` | UUID        |    X | SNS 계정                                                                                                                      |
| `publisher`         | text        |    X | 발행 주체                                                                                                                     |
| `publishedAt`       | timestamptz |    X | 게시 시각                                                                                                                     |
| `effectiveFrom`     | timestamptz |    X | 실제 적용 시작                                                                                                                |
| `effectiveUntil`    | timestamptz |    X | 실제 적용 종료                                                                                                                |
| `retrievedAt`       | timestamptz |    O | 확인 시각                                                                                                                     |
| `snapshotRef`       | text        |    X | 허용 범위 내 보존 참조                                                                                                        |
| `status`            | enum        |    O | `accessible`, `unavailable`, `deleted`, `private`                                                                             |

### VerificationRecord

특정 항목의 값이 어떤 출처로 검증되었는지 기록한다.

| 필드              | 타입        | 필수 | 설명                                                                                                                    |
| ----------------- | ----------- | ---: | ----------------------------------------------------------------------------------------------------------------------- |
| `id`              | UUID        |    O | 식별자                                                                                                                  |
| `locationId`      | UUID        |    O | 지점                                                                                                                    |
| `menuItemId`      | UUID        |    X | 메뉴 항목 검증 시                                                                                                       |
| `field`           | enum        |    O | `address`, `coordinates`, `phone`, `business_hours`, `closure`, `menu`, `price`, `facility`, `official_account`, `fame` |
| `normalizedValue` | jsonb       |    O | 비교 가능한 정규화 값                                                                                                   |
| `sourceId`        | UUID        |    O | 근거 출처                                                                                                               |
| `sourceAuthority` | enum        |    O | `official`, `authoritative`, `secondary`, `community`                                                                   |
| `result`          | enum        |    O | `confirmed`, `supports`, `conflicts`, `superseded`, `rejected`                                                          |
| `grade`           | enum        |    O | `A`, `B`, `C`, `D`                                                                                                      |
| `verifiedBy`      | UUID        |    X | 운영자 또는 시스템                                                                                                      |
| `verifiedAt`      | timestamptz |    O | 검증 시각                                                                                                               |
| `nextReviewAt`    | timestamptz |    O | 다음 검토 기한                                                                                                          |
| `note`            | text        |    X | 판단 메모                                                                                                               |

등급은 저장하되 원천 속성으로부터 다시 계산할 수 있어야 한다. 계산 규칙 변경 시 과거 기록을 재평가할 수 있게 규칙 버전을 추가할 수 있다.

공식 확인 등록은 현재 저장된 지점·메뉴 값을 검증 대상으로 삼는다. 출처 입력과 사실 값 수정은 분리하며, 값이 다르면 먼저 제보·검수 흐름에서 수정한다. 새 공식 확인이 등록되면 같은 항목의 기존 활성 기록은 삭제하지 않고 `superseded`로 전환한다.

사용자 화면의 표시 등급은 저장 등급을 그대로 복사하지 않는다.

- `nextReviewAt`이 지나면 A/B 기록도 C로 표시한다.
- 활성 `conflicts` 기록이 있으면 확인일과 무관하게 D로 표시한다.
- 재검토 기한 14일 전부터 관리자 대기열에 노출한다.
- `superseded`, `rejected` 기록은 현재 표시와 대기열 계산에서 제외한다.
- 충돌 기록은 최신 확인 기록보다 먼저 표시해 영업 중을 단정하지 않는다.

### OfficialVerificationAction

공식 홈페이지·SNS·전화·현장 확인으로 A등급을 생성한 감사 기록이다.

| 필드                   | 타입        | 필수 | 설명                                  |
| ---------------------- | ----------- | ---: | ------------------------------------- |
| `locationId`           | UUID        |    O | 대상 지점                             |
| `menuItemId`           | UUID        |    X | 메뉴·가격 확인 대상                   |
| `sourceId`             | UUID        |    O | 생성된 공식 출처                      |
| `verificationRecordId` | UUID        |    O | 생성된 A등급 검증 기록                |
| `reviewerId`           | UUID        |    X | 로그인 검수자                         |
| `reviewerLabel`        | text        |    O | 서버 작업을 포함한 감사 주체          |
| `field`                | enum        |    O | 확인한 정보 항목                      |
| `sourceType`           | enum        |    O | 공식 홈페이지·SNS·전화·현장 확인 방식 |
| `note`                 | text        |    O | 판단 근거                             |
| `createdAt`            | timestamptz |    O | 등록 시각                             |

`register_official_verification` RPC가 공식 계정, 출처, 검증 기록, 감사 기록을 한 트랜잭션으로 생성한다. 공식 웹 출처는 URL, 플랫폼, 공식성 판단 근거가 필수다.

### FameEvidence

‘유명한 이유’를 설명하는 근거다.

| 필드          | 타입 | 필수 | 설명                                                                                   |
| ------------- | ---- | ---: | -------------------------------------------------------------------------------------- |
| `id`          | UUID |    O | 식별자                                                                                 |
| `locationId`  | UUID |    O | 지점                                                                                   |
| `type`        | enum |    O | `award`, `media`, `heritage`, `local_landmark`, `specialty`, `editorial`, `save_count` |
| `title`       | text |    O | 화면 표시 제목                                                                         |
| `description` | text |    X | 설명                                                                                   |
| `sourceId`    | UUID |    X | 근거                                                                                   |
| `occurredAt`  | date |    X | 수상·방송 등 날짜                                                                      |
| `status`      | enum |    O | `active`, `expired`, `disputed`                                                        |

광고·협찬이면 별도의 상업적 표시를 강제한다.

### SavedBakery

| 필드         | 타입        | 필수 | 설명      |
| ------------ | ----------- | ---: | --------- |
| `userId`     | UUID        |    O | 사용자    |
| `locationId` | UUID        |    O | 지점      |
| `createdAt`  | timestamptz |    O | 저장 시각 |

`userId + locationId`는 고유하다. 비로그인 저장은 로컬 저장소에서 같은 구조로 관리하고 로그인 시 명시적 동의를 받아 병합한다.

### CorrectionReport

| 필드            | 타입        | 필수 | 설명                                                                     |
| --------------- | ----------- | ---: | ------------------------------------------------------------------------ |
| `id`            | UUID        |    O | 식별자                                                                   |
| `locationId`    | UUID        |    O | 대상 지점                                                                |
| `reporterId`    | UUID        |    X | 익명 가능                                                                |
| `category`      | enum        |    O | `hours`, `closure`, `relocation`, `menu_price`, `phone_address`, `other` |
| `proposedValue` | jsonb       |    X | 제안 값                                                                  |
| `description`   | text        |    O | 제보 설명                                                                |
| `sourceUrl`     | URL         |    X | 선택적 근거                                                              |
| `status`        | enum        |    O | `submitted`, `triaged`, `in_review`, `accepted`, `rejected`, `duplicate` |
| `createdAt`     | timestamptz |    O | 제출 시각                                                                |
| `resolvedAt`    | timestamptz |    X | 처리 시각                                                                |

제보에는 개인 연락처나 민감정보를 입력하지 않도록 안내하고 자유 입력은 운영자만 열람한다.

### ReviewAction

관리자 검수 이력이다.

| 필드            | 타입        | 필수 | 설명                                                                         |
| --------------- | ----------- | ---: | ---------------------------------------------------------------------------- |
| `id`            | UUID        |    O | 식별자                                                                       |
| `reportId`      | UUID        |    O | 제보                                                                         |
| `reviewerId`    | UUID        |    X | 로그인 검수자. 서버 작업이면 null                                            |
| `reviewerLabel` | text        |    O | `authenticated_reviewer`, `server_service` 등 감사 주체                      |
| `action`        | enum        |    O | `triage`, `approve`, `reject`, `hold`, `mark_duplicate`, `request_more_info` |
| `reason`        | text        |    O | 판단 근거                                                                    |
| `createdAt`     | timestamptz |    O | 처리 시각                                                                    |

## 4. 검증 등급 계산 초안

등급은 항목별로 계산한다.

### A

- 최근 30일 이내 매장 직접 확인 또는 공식 채널 확인
- 출처가 해당 지점을 명확히 지칭
- 충돌하는 최신 출처가 없음

### B

- 최근 90일 이내 공식 또는 권위 있는 출처 존재
- 독립된 두 출처의 정규화 값이 일치
- 충돌하는 더 최신의 공식 출처가 없음

### C

- 유효한 출처는 있으나 90일 이상 경과
- 또는 일부 값만 확인
- 또는 출처의 대상 지점이 다소 불명확

### D

- 사용자 제보만 존재
- 출처 간 값이 충돌
- 재검토 기한 초과 후 대체 출처 없음
- 원문 접근 불가로 현재 상태 확인 불가

정보 항목의 민감도에 따라 재검토 주기를 다르게 둔다.

| 항목           |          기본 재검토 |
| -------------- | -------------------: |
| 임시 일정      | 적용 기간 전·중 즉시 |
| 영업시간·휴무  |                 30일 |
| 메뉴·가격      |                 90일 |
| 전화·편의 정보 |                 90일 |
| 주소·좌표      |                180일 |
| 유명세 근거    |    365일 또는 만료일 |

## 5. 영업 상태 계산

입력:

- 지점 시간대의 현재 시각
- 유효한 기본 영업시간
- 확정된 특별 일정
- 지점 상태
- 영업시간 검증 등급

우선순위:

1. `closed`, `relocated` 상태면 영업 중으로 표시하지 않음
2. 현재 적용되는 확정 특별 일정이 기본 영업시간을 덮어씀
3. 특별 일정이 없으면 기본 영업시간 사용
4. 필요한 정보가 없거나 D 등급이면 `영업 여부 확인 필요`
5. 계산 결과와 함께 근거 확인일 표시

출력:

- `open`
- `closing_soon`
- `closed_today`
- `opens_later`
- `temporary_closed`
- `unknown`

`closing_soon` 기준은 초기 60분으로 하되 설정값으로 관리한다.

## 6. 무결성 규칙

- 공개 지점은 도로명 주소와 좌표가 필수
- 공개 지점의 핵심 필드에는 활성 검증 기록이 최소 하나 필요
- 메뉴 가격이 있으면 `checkedAt`과 가격 출처 검증 기록이 필요
- 확정 특별 일정에는 공식 또는 권위 있는 출처가 필요
- 공식 SNS 계정은 공식성 판단 근거와 확인 시각 필요
- 동일 외부 플랫폼 장소 ID가 여러 활성 지점에 연결되면 검수 대기
- 동일 브랜드 내 주소·전화·좌표 유사 중복을 자동 탐지
- 종료 시각은 시작 시각보다 뒤여야 하며 자정 초과 영업은 날짜 경계를 명시적으로 처리
- `effectiveUntil`은 `effectiveFrom`보다 빠를 수 없음
- 삭제 대신 상태 변경과 감사 기록을 우선

## 7. 권한 초안

- 공개 사용자: 공개 지점·메뉴·출처 요약 조회
- 로그인 사용자: 저장, 제보, 자신의 제보 상태 조회
- 검수자: 제보·출처 검토, 초안 수정
- 관리자: 게시, 권한 관리, 데이터 복구
- 서비스 역할: 승인된 외부 동기화 작업만 수행

자유 입력 제보, 내부 검수 메모, 사용자 식별 정보는 공개 API에서 반환하지 않는다.

## 8. 구현 시 생성할 단일 기준

- 데이터베이스 마이그레이션
- 생성된 TypeScript 데이터베이스 타입
- 도메인 타입과 런타임 스키마
- 상태·등급 enum과 사용자 표시 문구
- 외부 API 어댑터
- 검증 등급 계산기
- 영업 상태 계산기
- 시드 데이터 검증기

이 파일의 필드명을 그대로 복제하기보다, 구현 시 데이터베이스 명명 규칙을 정한 뒤 타입 생성으로 연결한다.
