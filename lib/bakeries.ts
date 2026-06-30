import type { Bakery, BakerySearchInput, BreadCategory } from "@/lib/types";
import { filterBakeries } from "@/lib/bakery-repository";

export const breadCategories: BreadCategory[] = [
  { name: "소금빵", slug: "salt-bread", emoji: "🥐" },
  { name: "베이글", slug: "bagel", emoji: "🥯" },
  { name: "크루아상", slug: "croissant", emoji: "🌙" },
  { name: "식사빵", slug: "meal-bread", emoji: "🍞" },
  { name: "케이크", slug: "cake", emoji: "🍰" },
  { name: "구움과자", slug: "baked-sweets", emoji: "🧁" },
];

export const bakeries: Bakery[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    slug: "mellow-oven-seongsu",
    name: "멜로우 오븐 성수점",
    searchAliases: [
      "MELLOW OVEN",
      "멜로우오븐",
      "멜로우 오븐 성수",
      "멜로우오븐 성수점",
    ],
    region: "서울 성동구",
    roadAddress: "서울 성동구 연무장길 00",
    latitude: 37.5445,
    longitude: 127.056,
    phone: "02-000-1001",
    categories: ["소금빵", "크루아상"],
    categorySlugs: ["salt-bread", "croissant"],
    imageTone: "gold",
    heroEmoji: "🥐",
    categoryImage: "/categories/salt-bread.jpg",
    todayHours: "10:00–19:00",
    opensAt: "10:00",
    closesAt: "19:00",
    specialSchedules: [],
    scheduleNote: "재료 소진 시 대표 메뉴가 일찍 품절될 수 있어요.",
    facilities: ["포장 가능", "좌석 적음", "주차 없음"],
    fameReason:
      "결이 선명한 크루아상과 매일 굽는 소금빵을 중심으로 소개하는 베이커리예요.",
    fameSource: "데모용 편집 시드 데이터",
    verification: {
      grade: "A",
      checkedAt: "2026-06-16T03:00:00+09:00",
      nextReviewAt: "2026-07-16T03:00:00+09:00",
      state: "current",
      sourceLabel: "공식 인스타그램",
      sourceUrl: "https://www.instagram.com/",
    },
    menus: [
      {
        id: "menu-001",
        name: "버터 소금빵",
        price: 3500,
        emoji: "🥐",
        checkedAt: "2026-06-10T10:00:00+09:00",
      },
      {
        id: "menu-002",
        name: "아몬드 크루아상",
        price: 4800,
        emoji: "🌙",
        checkedAt: "2026-06-10T10:00:00+09:00",
      },
    ],
    signatures: [],
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    slug: "old-town-bakery-daejeon",
    name: "오래뜰 제과",
    searchAliases: [
      "OLD TOWN BAKERY",
      "올드 타운 베이커리",
      "올드타운베이커리",
    ],
    region: "대전 중구",
    roadAddress: "대전 중구 중앙로 00",
    latitude: 36.328,
    longitude: 127.427,
    phone: "042-000-2002",
    categories: ["전통빵", "식사빵"],
    categorySlugs: ["meal-bread"],
    imageTone: "berry",
    heroEmoji: "🍞",
    categoryImage: "/categories/meal-bread.jpg",
    todayHours: "08:00–21:00",
    opensAt: "08:00",
    closesAt: "21:00",
    specialSchedules: [
      {
        id: "schedule-daejeon-001",
        date: "2026-06-18",
        type: "temporary-closed",
        note: "설비 점검으로 오늘 하루 쉬어갑니다.",
        confirmed: true,
        sourceLabel: "공식 SNS 임시휴무 공지",
      },
    ],
    scheduleNote: "명절 기간은 공식 채널의 별도 공지를 확인해 주세요.",
    facilities: ["포장 가능", "좌석 있음", "인근 유료 주차"],
    fameReason:
      "지역에서 오래 운영한 제과점이라는 설정으로 정보 검증 화면을 시험하기 위한 시드예요.",
    fameSource: "데모용 편집 시드 데이터",
    verification: {
      grade: "B",
      checkedAt: "2026-05-25T11:00:00+09:00",
      nextReviewAt: "2026-08-23T11:00:00+09:00",
      state: "current",
      sourceLabel: "지도·공공데이터 교차 확인",
      sourceUrl: "https://map.kakao.com/",
    },
    menus: [
      {
        id: "menu-003",
        name: "팥소보로",
        price: 2800,
        emoji: "🫘",
        checkedAt: "2026-05-20T10:00:00+09:00",
      },
      {
        id: "menu-004",
        name: "우유 식빵",
        price: 5200,
        emoji: "🍞",
        checkedAt: "2026-05-20T10:00:00+09:00",
      },
    ],
    signatures: [],
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    slug: "wave-bagel-busan",
    name: "웨이브 베이글",
    searchAliases: ["WAVE BAGEL", "웨이브베이글", "웨이브 베이글 부산"],
    region: "부산 수영구",
    roadAddress: "부산 수영구 광안해변로 00",
    latitude: 35.1532,
    longitude: 129.1187,
    phone: "051-000-3003",
    categories: ["베이글", "샌드위치"],
    categorySlugs: ["bagel", "meal-bread"],
    imageTone: "sage",
    heroEmoji: "🥯",
    categoryImage: "/categories/bagel.jpg",
    todayHours: "09:00–18:00",
    opensAt: "09:00",
    closesAt: "18:00",
    specialSchedules: [],
    scheduleNote: "시드 정보가 오래되어 방문 전 공식 채널 확인이 필요해요.",
    facilities: ["포장 가능", "좌석 있음", "주차 확인 필요"],
    fameReason:
      "해변 산책과 함께 들르기 좋은 베이글 전문점이라는 데모 테마로 구성했어요.",
    fameSource: "데모용 편집 시드 데이터",
    verification: {
      grade: "C",
      checkedAt: "2026-02-12T12:00:00+09:00",
      nextReviewAt: "2026-05-13T12:00:00+09:00",
      state: "expired",
      sourceLabel: "공식 메뉴 게시물",
      sourceUrl: "https://www.instagram.com/",
    },
    menus: [
      {
        id: "menu-005",
        name: "플레인 베이글",
        price: 3200,
        emoji: "🥯",
        checkedAt: "2026-02-12T12:00:00+09:00",
      },
      {
        id: "menu-006",
        name: "쪽파 크림치즈",
        price: 2900,
        emoji: "🌿",
        checkedAt: "2026-02-12T12:00:00+09:00",
      },
    ],
    signatures: [],
  },
];

export function getBakeryBySlug(slug: string) {
  return bakeries.find((bakery) => bakery.slug === slug);
}

export function getRecentlyVerifiedBakeries(limit: number) {
  return [...bakeries]
    .sort(
      (left, right) =>
        Date.parse(right.verification.checkedAt) -
        Date.parse(left.verification.checkedAt),
    )
    .slice(0, limit);
}

export function searchBakeries(input: BakerySearchInput) {
  return filterBakeries(bakeries, input);
}
