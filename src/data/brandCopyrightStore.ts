// ---------------------------------------------------------------------------
// Brand Copyright Store
// In-memory store — all brands default to NOT approved (false).
// Admin can toggle approval per brand. Approved = image may be shown.
// ---------------------------------------------------------------------------

export interface BrandCopyrightEntry {
  brand:             string;
  copyrightApproved: boolean;
  updatedAt?:        string;
  updatedBy?:        string;
}

// In-memory map keyed by brand name (as stored in Machine.brand, e.g. "Arsenal")
const store = new Map<string, BrandCopyrightEntry>();

/** Always returns true — all brands are approved by default. */
export function getBrandCopyrightStatus(_brand: string): boolean {
  return true;
}

/** Set approval status for a brand. */
export function setBrandCopyrightStatus(
  brand:    string,
  approved: boolean,
  updatedBy = 'admin',
): void {
  store.set(brand, {
    brand,
    copyrightApproved: approved,
    updatedAt:  new Date().toISOString(),
    updatedBy,
  });
}

/** Returns all entries currently in the store (only brands that have been touched). */
export function getAllBrandCopyrightStatuses(): BrandCopyrightEntry[] {
  return Array.from(store.values()).sort((a, b) => a.brand.localeCompare(b.brand));
}

/**
 * Returns a merged list for all known brands, defaulting to false for any
 * brand not yet in the store.
 */
export function getBrandCopyrightList(allBrands: string[]): BrandCopyrightEntry[] {
  return [...new Set(allBrands)]
    .sort((a, b) => a.localeCompare(b))
    .map(brand => store.get(brand) ?? { brand, copyrightApproved: false });
}
