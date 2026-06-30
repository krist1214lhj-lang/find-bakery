import { describe, expect, it } from "vitest";
import { getCategoryImage } from "@/lib/category-image";

describe("getCategoryImage", () => {
  it("maps each known category slug to its example image", () => {
    expect(getCategoryImage("salt-bread")).toBe("/categories/salt-bread.jpg");
    expect(getCategoryImage("bagel")).toBe("/categories/bagel.jpg");
    expect(getCategoryImage("baked-sweets")).toBe(
      "/categories/baked-sweets.jpg",
    );
    expect(getCategoryImage("meal-bread")).toBe("/categories/meal-bread.jpg");
    expect(getCategoryImage("cake")).toBe("/categories/cake.jpg");
    expect(getCategoryImage("croissant")).toBe("/categories/croissant.jpg");
  });

  it("falls back to the generic image for unknown or missing category", () => {
    expect(getCategoryImage(undefined)).toBe("/categories/generic.jpg");
    expect(getCategoryImage("")).toBe("/categories/generic.jpg");
    expect(getCategoryImage("not-a-category")).toBe("/categories/generic.jpg");
  });
});
