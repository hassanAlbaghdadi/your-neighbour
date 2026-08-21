/**
 * Allergen strings are free text typed by the owner in the admin form, so
 * they arrive with a "Contains" prefix or not, in any casing, sometimes with
 * a trailing "etc", and occasionally misspelled. Everything that reads them
 * goes through here so the menu note and the cards can't disagree about what
 * a product contains.
 */

/** Lowercased, de-prefixed tokens. Comparison form, not display form. */
export function parseAllergens(raw: string | null | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const part of raw.replace(/^\s*contains,?\s*/i, "").split(",")) {
    const token = part
      .trim()
      .replace(/\s*etc\.?\s*$/i, "")
      .trim()
      .toLowerCase()
    if (token) seen.add(token)
  }
  return [...seen]
}

/**
 * Allergens present in every product on the menu, so they can be stated once
 * instead of on every card.
 *
 * Two deliberate fail-safes. An empty allergen field on any product returns
 * nothing at all -- we can't claim something holds menu-wide when one item
 * never declared anything -- and tokens are compared as typed, so a
 * misspelling ("seasame seed" against "sesame seeds") simply fails to match
 * and stays on its own card. Both failure directions push allergens back
 * onto individual cards, never off them.
 */
export function sharedAllergens(raws: (string | null | undefined)[]): string[] {
  if (raws.length === 0) return []
  const lists = raws.map(parseAllergens)
  if (lists.some((list) => list.length === 0)) return []
  return lists.reduce((shared, list) =>
    shared.filter((token) => list.includes(token)),
  )
}

/** "gluten", "gluten and dairy", "gluten, dairy and eggs" */
export function formatAllergenProse(tokens: string[]): string {
  if (tokens.length <= 1) return tokens.join("")
  return `${tokens.slice(0, -1).join(", ")} and ${tokens[tokens.length - 1]}`
}
