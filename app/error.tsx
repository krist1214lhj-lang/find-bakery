"use client";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="page-section">
      <div className="empty-state" role="alert">
        <span aria-hidden="true">🥖</span>
        <h1>빵집 정보를 불러오지 못했어요.</h1>
        <p>Supabase 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <button className="primary-button" onClick={reset} type="button">
          다시 시도
        </button>
      </div>
    </section>
  );
}
