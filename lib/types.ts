export type VerificationGrade = "A" | "B" | "C" | "D";
export type VerificationState =
  | "current"
  | "due-soon"
  | "expired"
  | "conflict"
  | "unverified";
export type ImageTone = "gold" | "berry" | "sage";
export type SpecialScheduleType =
  | "temporary-closed"
  | "special-open"
  | "changed-hours";
export type CorrectionCategory =
  | "hours"
  | "closure"
  | "relocation"
  | "menu-price"
  | "phone-address"
  | "other";
export type CorrectionReportStatus =
  | "submitted"
  | "triaged"
  | "in-review"
  | "accepted"
  | "rejected"
  | "duplicate";
export type CorrectionReviewAction =
  | "triage"
  | "approve"
  | "reject"
  | "hold"
  | "mark-duplicate"
  | "request-more-info";

export type VerificationSummary = {
  grade: VerificationGrade;
  checkedAt: string;
  nextReviewAt: string;
  state: VerificationState;
  sourceLabel: string;
  sourceUrl?: string;
};

export type MenuItem = {
  id: string;
  name: string;
  price?: number;
  emoji: string;
  checkedAt?: string;
};

export type SpecialSchedule = {
  id: string;
  date: string;
  type: SpecialScheduleType;
  opensAt?: string;
  closesAt?: string;
  note: string;
  confirmed: boolean;
  sourceLabel: string;
};

export type Bakery = {
  id: string;
  slug: string;
  name: string;
  searchAliases: string[];
  region: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  phone?: string;
  categories: string[];
  categorySlugs: string[];
  imageTone: ImageTone;
  heroEmoji: string;
  categoryImage: string;
  todayHours: string;
  opensAt: string;
  closesAt: string;
  specialSchedules: SpecialSchedule[];
  scheduleNote: string;
  facilities: string[];
  fameReason: string;
  fameSource: string;
  verification: VerificationSummary;
  menus: MenuItem[];
};

export type BreadCategory = {
  name: string;
  slug: string;
  emoji: string;
};

export type BakerySearchInput = {
  q?: string;
  category?: string;
  region?: string;
};

export type CorrectionDraft = {
  bakeryId: string;
  bakeryName: string;
  category: CorrectionCategory;
  description: string;
  sourceUrl?: string;
};

export type StoredCorrectionReport = CorrectionDraft & {
  id: string;
  status: CorrectionReportStatus;
  createdAt: string;
  resolvedAt?: string;
};

export type StoredReviewAction = {
  id: string;
  reportId: string;
  action: CorrectionReviewAction;
  reason: string;
  previousStatus: CorrectionReportStatus;
  nextStatus: CorrectionReportStatus;
  createdAt: string;
};
