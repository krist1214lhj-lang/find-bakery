// 지역 표시·필터 유틸. 서버 의존성 없는 순수 함수(테스트 용이).

// 도로명(…로 / …길, 끝에 숫자 가능)인지 판별.
// 행정구역 접미사(구/군/시/읍/면/동)는 해당하지 않으므로 안전하게 구분된다.
function isRoadName(value: string): boolean {
  return /(?:로|길)\d*$/.test(value);
}

// 화면에 보여줄 "시·도 + 구/동" 라벨을 만든다.
// 세종처럼 구가 없어 region_level_2 에 도로명이 들어온 경우엔 동(region_level_3)으로 대체한다.
export function formatRegionLabel(
  level1: string | null,
  level2: string | null,
  level3: string | null,
): string {
  const second = level2 && isRoadName(level2) ? level3 : level2;
  return [level1, second].filter(Boolean).join(" ");
}

// 지역 필터 매칭. 표시 라벨을 공백으로 나눈 각 토큰의 "시작"과 비교한다.
// startsWith 만 쓰면 '전주'(전북특별자치도 전주시)처럼 시·도와 시 이름이 다를 때 누락되므로,
// 토큰 단위로 검사해 시·도/시 어느 쪽으로 눌러도 매칭되게 한다(중간 일치는 허용 안 함).
export function matchesRegionFilter(region: string, filter: string): boolean {
  if (!filter) return true;
  return region.split(/\s+/).some((token) => token.startsWith(filter));
}
