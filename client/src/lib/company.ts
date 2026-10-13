/**
 * Public company facts — the single source for who runs CodedSwitch.
 *
 * Payment processors and partner programs verify a site by matching these
 * against business registries and the domain, so every public page that
 * names the company (footer, About, Terms, Privacy) reads from here.
 *
 * `legalName` and `jurisdiction` are null until the registered entity is
 * confirmed — pages omit those lines rather than show a guess.
 */
export const COMPANY = {
  brandName: "CodedSwitch",
  /** Registered entity name exactly as filed, e.g. "CodedSwitch LLC". */
  legalName: null as string | null,
  /** State/country whose laws govern the Terms, e.g. "the State of Texas". */
  jurisdiction: null as string | null,
  founder: "Rusty Alsup",
  contactEmail: "Rustyalsup@codedswitch.com",
  website: "https://www.codedswitch.com",
} as const;

/** "CodedSwitch LLC" once the legal name is set, otherwise the brand name. */
export const companyDisplayName = COMPANY.legalName ?? COMPANY.brandName;
