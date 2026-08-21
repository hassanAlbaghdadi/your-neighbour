import { describe, it, expect } from "vitest"
import { parseAllergens, sharedAllergens, formatAllergenProse } from "./allergens"

describe("parseAllergens", () => {
  it("normalises the shapes the admin form actually produces", () => {
    // Every one of these is a real value from the products table.
    expect(parseAllergens("Contains Gluten, Dairy, Eggs, Sesame Seeds, etc"))
      .toEqual(["gluten", "dairy", "eggs", "sesame seeds"])
    expect(parseAllergens("Contains gluten, dairy, sesame seed etc"))
      .toEqual(["gluten", "dairy", "sesame seed"])
    expect(parseAllergens("cONTAINS GLUTEN, DAIRY, EGGS, SEASAME SEED"))
      .toEqual(["gluten", "dairy", "eggs", "seasame seed"])
  })

  it("treats a missing field as no declaration, not as no allergens", () => {
    expect(parseAllergens(null)).toEqual([])
    expect(parseAllergens("")).toEqual([])
    expect(parseAllergens("Contains")).toEqual([])
  })
})

describe("sharedAllergens", () => {
  it("keeps only what every product declares", () => {
    expect(
      sharedAllergens([
        "Contains gluten, dairy, eggs",
        "Contains gluten, dairy, sesame seeds",
        "Contains Gluten, Dairy, Eggs, Sesame Seeds",
      ]),
    ).toEqual(["gluten", "dairy"])
  })

  it("claims nothing when any product has no allergen data", () => {
    // The dangerous failure would be asserting "everything contains X" off a
    // menu where one item never declared anything. Both cards keep their own
    // lists instead.
    expect(
      sharedAllergens(["Contains gluten, dairy", null, "Contains gluten"]),
    ).toEqual([])
    expect(sharedAllergens([])).toEqual([])
  })

  it("lets a misspelling fall back to the card rather than matching loosely", () => {
    // "seasame seed" is live in the products table today. It must not be
    // folded into a menu-wide claim about sesame.
    expect(
      sharedAllergens([
        "Contains gluten, sesame seeds",
        "Contains gluten, seasame seed",
      ]),
    ).toEqual(["gluten"])
  })

  it("returns nothing when products share no allergen at all", () => {
    expect(sharedAllergens(["Contains gluten", "Contains dairy"])).toEqual([])
  })
})

describe("formatAllergenProse", () => {
  it("reads as a sentence", () => {
    expect(formatAllergenProse([])).toBe("")
    expect(formatAllergenProse(["gluten"])).toBe("gluten")
    expect(formatAllergenProse(["gluten", "dairy"])).toBe("gluten and dairy")
    expect(formatAllergenProse(["gluten", "dairy", "eggs"])).toBe(
      "gluten, dairy and eggs",
    )
  })
})
