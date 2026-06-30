// 빵 카테고리 → 예시(대표) 이미지 경로. 서버 의존성 없는 순수 매핑(테스트 용이).
// 이미지는 public/categories/*.jpg (Pexels License, 출처는 public/categories/CREDITS.md).
// 실제 매장 사진이 아니라 카테고리 예시 이미지다.

const CATEGORY_IMAGES: Record<string, string> = {
  "salt-bread": "/categories/salt-bread.jpg",
  bagel: "/categories/bagel.jpg",
  "baked-sweets": "/categories/baked-sweets.jpg",
  "meal-bread": "/categories/meal-bread.jpg",
  cake: "/categories/cake.jpg",
  croissant: "/categories/croissant.jpg",
};

const GENERIC_IMAGE = "/categories/generic.jpg";

// 대표 카테고리(첫 번째) slug로 예시 이미지를 고른다. 미정/미매칭은 일반 빵 이미지.
export function getCategoryImage(primarySlug?: string): string {
  return (primarySlug && CATEGORY_IMAGES[primarySlug]) || GENERIC_IMAGE;
}
