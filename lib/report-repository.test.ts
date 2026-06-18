import { describe, expect, it, vi } from "vitest";
import { submitCorrectionDraft } from "@/lib/report-repository";
import { readCorrectionReports } from "@/lib/storage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const draft = {
  bakeryId: "20000000-0000-4000-8000-000000000001",
  bakeryName: "멜로우 오븐 성수점",
  category: "hours" as const,
  description: "공식 계정에서 임시휴무 공지를 확인했습니다.",
  sourceUrl: "https://example.com/notice",
};

describe("correction report repository", () => {
  it("uses the server result when the API is available", async () => {
    const storage = new MemoryStorage();
    const serverReport = {
      ...draft,
      id: "server-report",
      status: "submitted" as const,
      createdAt: "2026-06-18T03:00:00.000Z",
    };
    const fetcher = vi.fn(async () =>
      Response.json({ report: serverReport }, { status: 201 }),
    );

    await expect(
      submitCorrectionDraft(draft, storage, fetcher),
    ).resolves.toEqual({
      report: serverReport,
      persistence: "server",
    });
    expect(readCorrectionReports(storage)).toEqual([]);
  });

  it("falls back to local storage on server or network failure", async () => {
    const storage = new MemoryStorage();
    const fetcher = vi.fn(async () =>
      Response.json({ message: "not configured" }, { status: 503 }),
    );

    const result = await submitCorrectionDraft(draft, storage, fetcher);

    expect(result.persistence).toBe("local");
    expect(readCorrectionReports(storage)).toHaveLength(1);
  });

  it("uses local storage when the API explicitly negotiates local-only mode", async () => {
    const storage = new MemoryStorage();
    const fetcher = vi.fn(async () =>
      Response.json({ mode: "local-only" }, { status: 200 }),
    );

    const result = await submitCorrectionDraft(draft, storage, fetcher);

    expect(result.persistence).toBe("local");
    expect(readCorrectionReports(storage)).toHaveLength(1);
  });

  it("does not hide a client validation error behind local fallback", async () => {
    const storage = new MemoryStorage();
    const fetcher = vi.fn(async () =>
      Response.json(
        { message: "제보할 빵집을 찾을 수 없어요." },
        { status: 404 },
      ),
    );

    await expect(
      submitCorrectionDraft(draft, storage, fetcher),
    ).rejects.toThrow("제보할 빵집을 찾을 수 없어요.");
    expect(readCorrectionReports(storage)).toEqual([]);
  });
});
