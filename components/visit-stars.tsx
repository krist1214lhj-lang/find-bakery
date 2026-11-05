export function VisitStars({ rating }: { rating: number }) {
  return (
    <span className="visit-stars">
      <span aria-hidden="true">
        {"★".repeat(rating)}
        <span className="visit-stars-empty">{"★".repeat(5 - rating)}</span>
      </span>
      <span className="sr-only">별점 {rating}점</span>
    </span>
  );
}
