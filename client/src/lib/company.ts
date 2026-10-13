/**
 * Public company facts — the single source for who runs CodedSwitch.
 *
 * Payment processors and partner programs verify a site by matching these
 * against business registries and the domain, so every public page that
 * names the company (footer, About, Terms, Privacy) reads from here.
 */
export const COMPANY = {
  brandName: "CodedSwitch",
  /** Registered entity name exactly as filed, e.g. "CodedSwitch LLC". */
  legalName: "CodedSwitch" as string | null,
  /** State/country whose laws govern the Terms, e.g. "the State of Texas". */
  jurisdiction: "the State of Utah, United States" as string | null,
  founder: "Rusty Alsup",
  founded: "July 7, 2026",
  location: "Utah, United States",
  contactEmail: "Rustyalsup@codedswitch.com",
  website: "https://www.codedswitch.com",
} as const;

/** "CodedSwitch LLC" once the legal name is set, otherwise the brand name. */
export const companyDisplayName = COMPANY.legalName ?? COMPANY.brandName;
