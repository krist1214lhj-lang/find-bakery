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
- **자동화 2단계(Claude 2차 검증)** 스크립트 완성 — 실제 Claude 호출판으로 재작성(옛 버전은 호출 없이 표시만 했음).
- 광진구 15곳 테스트: 승인후보 14 / 보류 0 / 제외 1, **뺑드미가 중복(약 5m)으로 정확히 제외**됨.
- ⚠️ 단, 로컬에 `ANTHROPIC_API_KEY`가 없어 **실제 Claude HTTP 호출 경로는 아직 미검증**(테스트셋이 전부 규칙으로 확정되어 Claude 호출 0건). 라우팅·폴백은 확인함.

## 자동화 전체 그림
```
후보 입력 → [카카오 1차검증] → [Claude 2차검증] → 내 승인 → DB 저장
            ✅ 완성            ✅ 완성(코드)       🔜 다음 차례
```

## 자동화 2단계(Claude 2차 검증) 요약 — `scripts/verify-stage2-claude.mjs`
- 입력: `output/stage1-kakao.json` → 출력: 표 + `output/stage2-verified.json`
- **하이브리드 판정**: 명확한 규칙은 코드 자동, 애매한 경계만 모아 **raw fetch로 Claude 1회 호출**(per-bakery 반복 아님)
- **3축**: ① 카테고리 적합성 ② DB 중복(읽기 전용) ③ 이름 정합성
- **결과 3갈래**: 승인후보 / 보류(사람확인) / 제외 (`decided_by`=rule·claude·fallback)
- 모델 `claude-sonnet-4-6`(상단 `CLAUDE_MODEL` 상수로 교체 가능). 키 없거나 호출 실패 시 애매한 건 안전하게 '보류' 폴백
- **프랜차이즈는 `is_franchise=true` 표시만 하고 통과**(제외 안 함)

## 바로 다음 할 일
1. (선택) `.env.local`에 `ANTHROPIC_API_KEY` 넣고 **Claude 분기 실제 호출 검증**
2. 파이프라인 마지막 두 조각 **내 승인 → DB 저장** 설계·구현

## 꼭 지킬 규칙
- 작업 전 **계획 보여주고 승인** 받기.
- **민감정보 금지**: 키·비밀번호·`.env*` 값을 코드/커밋/채팅/문서에 넣지 않기(자격증명은 gitignored 파일에서만 읽음).
- **좌표는 카카오 API 값만**(추측 금지).
- **`quest_` 테이블 손대지 않기**.
- DB는 **구조 변경 없이 행만**, SQL은 재실행 안전하게. 쓰기는 승인 후.
- 커밋은 관련 파일만·한글 메시지, push는 별도 승인. `next-env.d.ts`는 커밋 제외.

## 열린 항목
- 커밋 `03928c1`(1차 검증)·2차 재작성 커밋 등 **push 안 함**(승인 후 push).
- **2차의 실제 Claude 호출 미검증** — `.env.local`에 `ANTHROPIC_API_KEY` 필요.
- 한때 노출됐던 Supabase secret key **rotate** 여부 확인 필요.
