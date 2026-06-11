export interface PharmacySite {
  name: string;
  baseURL: string;
  /** Set to true for sites only reachable locally (e.g. localhost). Excluded when CI=true. */
  ciSkip?: boolean;
}

/**
 * Add or remove pharmacy sites here.
 * Each entry becomes a separate Playwright project — visible as a checkbox
 * in `playwright test --ui` and selectable via `--project="<name>"` on the CLI.
 */
export const PHARMACY_SITES: PharmacySite[] = [
  { name: "Upton Pharmacy", baseURL: "https://uptonpharmacy-dev.healthya.co.uk/" },
  { name: "Slyne Pharmacy", baseURL: "https://slyne.healthya.co.uk/" },
];
