import type { Database } from "@/lib/supabase/database.types";

export const officialVerificationFields = [
  "address",
  "phone",
  "business_hours",
  "closure",
  "menu",
  "price",
  "facility",
  "official_account",
] as const;

export const officialSourceTypes = [
  "official_site",
  "official_sns",
  "phone",
  "onsite",
] as const;

export const officialAccountPlatforms = [
  "website",
  "instagram",
  "naver_blog",
  "naver_place",
  "kakao_channel",
  "youtube",
  "other",
] as const;

export type OfficialVerificationField =
  (typeof officialVerificationFields)[number];
export type OfficialSourceType = (typeof officialSourceTypes)[number];
export type OfficialAccountPlatform =
  (typeof officialAccountPlatforms)[number];

export type OfficialVerificationDraft = {
  locationId: string;
  field: OfficialVerificationField;
  menuItemId?: string;
  sourceType: OfficialSourceType;
  publisher: string;
  sourceUrl?: string;
  publishedAt?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  accountPlatform?: OfficialAccountPlatform;
  accountHandle?: string;
  officialityEvidence?: string;
  note: string;
};

export type AdminOfficialVerificationLocation = {
  id: string;
  name: string;
  roadAddress: string;
  phone?: string;
  status: Database["public"]["Enums"]["location_status"];
  facilities: string;
  menus: {
    id: string;
    name: string;
    price?: number;
    availability: Database["public"]["Enums"]["menu_availability"];
  }[];
};

export type StoredOfficialVerificationAction = {
  id: string;
  locationId: string;
  bakeryName: string;
  menuItemId?: string;
  menuName?: string;
  field: OfficialVerificationField;
  sourceType: OfficialSourceType;
  publisher: string;
  sourceUrl?: string;
  note: string;
  verifiedAt: string;
  nextReviewAt: string;
};

export type AdminOfficialVerificationQueue = {
  locations: AdminOfficialVerificationLocation[];
  actions: StoredOfficialVerificationAction[];
};

export type OfficialVerificationSelection = {
  locationId?: string;
  field?: OfficialVerificationField;
  menuItemId?: string;
};

export function parseOfficialVerificationDraft(
  value: unknown,
):
  | { ok: true; value: OfficialVerificationDraft }
  | { ok: false; message: string } {
  if (!value || typeof value !== "object") {
    return invalid("공식 확인 요청 형식을 확인해 주세요.");
  }

  const input = value as Record<string, unknown>;
  if (
    typeof input.locationId !== "string" ||
    !input.locationId.trim() ||
    typeof input.field !== "string" ||
    !officialVerificationFields.includes(
      input.field as OfficialVerificationField,
    ) ||
    typeof input.sourceType !== "string" ||
    !officialSourceTypes.includes(input.sourceType as OfficialSourceType) ||
    typeof input.publisher !== "string" ||
    input.publisher.trim().length < 2 ||
    typeof input.note !== "string" ||
    input.note.trim().length < 5
  ) {
    return invalid("지점, 확인 항목, 출처와 판단 근거를 확인해 주세요.");
  }

  const field = input.field as OfficialVerificationField;
  const sourceType = input.sourceType as OfficialSourceType;
  const menuItemId = optionalString(input.menuItemId);
  const sourceUrl = optionalString(input.sourceUrl);
  const accountPlatform = optionalString(input.accountPlatform);
  const officialityEvidence = optionalString(input.officialityEvidence);

  if ((field === "menu" || field === "price") && !menuItemId) {
    return invalid("메뉴 또는 가격 확인에는 메뉴를 선택해 주세요.");
  }
  if (field !== "menu" && field !== "price" && menuItemId) {
    return invalid("선택한 확인 항목에는 메뉴를 지정할 수 없습니다.");
  }

  const isWebSource =
    sourceType === "official_site" || sourceType === "official_sns";
  if (field === "official_account" && !isWebSource) {
    return invalid("공식 계정 확인은 공식 홈페이지나 SNS로 등록해 주세요.");
  }
  if (isWebSource) {
    if (!sourceUrl || !isHttpUrl(sourceUrl)) {
      return invalid("공식 웹 출처의 원문 URL을 입력해 주세요.");
    }
    if (
      !accountPlatform ||
      !officialAccountPlatforms.includes(
        accountPlatform as OfficialAccountPlatform,
      )
    ) {
      return invalid("공식 계정의 플랫폼을 선택해 주세요.");
    }
    if (sourceType === "official_site" && accountPlatform !== "website") {
      return invalid("공식 홈페이지는 웹사이트 플랫폼으로 등록해 주세요.");
    }
    if (sourceType === "official_sns" && accountPlatform === "website") {
      return invalid("공식 SNS에 맞는 플랫폼을 선택해 주세요.");
    }
    if (!officialityEvidence || officialityEvidence.length < 5) {
      return invalid("공식 계정이라고 판단한 근거를 5자 이상 입력해 주세요.");
    }
  } else if (sourceUrl || accountPlatform) {
    return invalid("전화·현장 확인에는 외부 계정 정보를 입력할 수 없습니다.");
  }

  const publishedAt = optionalDateTime(input.publishedAt);
  const effectiveFrom = optionalDateTime(input.effectiveFrom);
  const effectiveUntil = optionalDateTime(input.effectiveUntil);
  if (
    publishedAt === null ||
    effectiveFrom === null ||
    effectiveUntil === null
  ) {
    return invalid("날짜와 시간 형식을 확인해 주세요.");
  }
  if (
    effectiveFrom &&
    effectiveUntil &&
    Date.parse(effectiveUntil) < Date.parse(effectiveFrom)
  ) {
    return invalid("적용 종료 시각은 시작 시각보다 빠를 수 없습니다.");
  }

  return {
    ok: true,
    value: {
      locationId: input.locationId.trim(),
      field,
      menuItemId,
      sourceType,
      publisher: input.publisher.trim(),
      sourceUrl,
      publishedAt,
      effectiveFrom,
      effectiveUntil,
      accountPlatform: accountPlatform as
        | OfficialAccountPlatform
        | undefined,
      accountHandle: optionalString(input.accountHandle),
      officialityEvidence,
      note: input.note.trim(),
    },
  };
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function optionalDateTime(value: unknown): string | undefined | null {
  const text = optionalString(value);
  if (!text) {
    return undefined;
  }
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function invalid(message: string) {
  return { ok: false as const, message };
}
