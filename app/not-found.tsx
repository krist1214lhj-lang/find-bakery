import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-section">
      <div className="empty-state">
        <span aria-hidden="true">🍞</span>
        <h1>빵집을 찾을 수 없어요.</h1>
        <p>주소가 바뀌었거나 아직 공개되지 않은 빵집일 수 있어요.</p>
        <Link className="primary-link" href="/explore">
          다른 빵집 찾기
        </Link>
      </div>
    </section>
  );
}
