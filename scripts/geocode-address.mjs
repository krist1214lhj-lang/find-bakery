// 주소 → 좌표(위도/경도) 변환 스크립트 (카카오 주소 검색 API)
// 사용법: node scripts/geocode-address.mjs "서울 광진구 영화사로 45"
//
// - 서버 전용 KAKAO_REST_API_KEY 를 사용 (환경변수 우선, 없으면 .env.local 에서 읽음).
// - 카카오가 반환한 원본 x(경도)/y(위도) 를 그대로 출력. 추측값 없음.
// - 새 빵집을 추가할 때 이 스크립트로 좌표를 뽑아 bakery_locations 에 넣으면 된다.

import { readFileSync } from "node:fs";

function loadKakaoRestKey() {
  const fromEnv = process.env.KAKAO_REST_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*KAKAO_REST_API_KEY\s*=\s*(.*)\s*$/);
      if (match) return match[1].trim();
    }
  } catch {
    // .env.local 이 없으면 무시 (환경변수로 넘겼을 수 있음)
  }
  return "";
}

const address = process.argv.slice(2).join(" ").trim();
if (!address) {
  console.error('사용법: node scripts/geocode-address.mjs "<주소>"');
  process.exit(1);
}

const apiKey = loadKakaoRestKey();
if (!apiKey) {
  console.error(
    "KAKAO_REST_API_KEY 를 찾지 못했습니다 (.env.local 또는 환경변수에 설정하세요).",
  );
  process.exit(1);
}

const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
url.searchParams.set("query", address);
url.searchParams.set("size", "5");

const response = await fetch(url, {
  headers: { Authorization: `KakaoAK ${apiKey}` },
});

if (!response.ok) {
  console.error(`카카오 API 오류: HTTP ${response.status} ${response.statusText}`);
  process.exit(1);
}

const data = await response.json();
const doc = data.documents?.[0];
if (!doc) {
  console.error(`좌표를 찾지 못했습니다: "${address}"`);
  process.exit(1);
}

// 도로명 좌표가 있으면 우선, 없으면 지번 좌표(문서 대표 좌표) 사용.
const road = doc.road_address;
const longitude = Number(road?.x ?? doc.x);
const latitude = Number(road?.y ?? doc.y);

console.log(
  JSON.stringify(
    {
      query: address,
      matched_address: doc.address?.address_name ?? null,
      matched_road_address: road?.address_name ?? null,
      raw_x_longitude: road?.x ?? doc.x,
      raw_y_latitude: road?.y ?? doc.y,
      latitude,
      longitude,
      total_count: data.meta?.total_count ?? null,
    },
    null,
    2,
  ),
);
