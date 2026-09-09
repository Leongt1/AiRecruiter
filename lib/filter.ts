import type { Filters } from "@/lib/schemas";
import { PROFILES, type Profile } from "@/lib/profiles";

/**
 * Deterministic application of the objective filters. This is intentionally NOT an
 * LLM call: the objective axes (skills, years, location, company background, title)
 * are exact and cheap, so we apply them in code. Only the subjective rubric goes to
 * the model. That keeps the objective step fast, free, and trustworthy.
 */

const norm = (s: string) => s.toLowerCase().trim();

// A few well-known aliases so recruiter shorthand matches the data.
const SKILL_ALIASES: Record<string, string[]> = {
  rds: ["aws rds"],
  postgres: ["postgresql"],
  "node": ["node.js"],
  js: ["javascript", "node.js"],
  k8s: ["kubernetes"],
};

function expand(term: string): string[] {
  const n = norm(term);
  return [n, ...(SKILL_ALIASES[n] ?? [])];
}

/** Does the profile have a skill satisfying `required` (alias- and substring-aware)? */
function hasSkill(profile: Profile, required: string): boolean {
  const wanted = expand(required);
  const owned = profile.skills.map(norm);
  return wanted.some((w) =>
    owned.some((o) => o === w || (w.length >= 3 && (o.includes(w) || w.includes(o))))
  );
}

function matchesLocation(profile: Profile, locations: string[]): boolean {
  if (locations.length === 0) return true;
  const loc = norm(profile.location);
  return locations.some((l) => {
    const n = norm(l);
    return loc === n || loc.includes(n) || n.includes(loc);
  });
}

function matchesCompanyType(profile: Profile, types: string[]): boolean {
  if (types.length === 0) return true;
  const wanted = new Set(types.map(norm));
  if (wanted.has(norm(profile.current_company_type))) return true;
  return profile.past_companies.some((c) => wanted.has(norm(c.company_type)));
}

function matchesTitle(profile: Profile, titles: string[]): boolean {
  if (titles.length === 0) return true;
  const current = norm(profile.current_title);
  const past = profile.past_companies.map((c) => norm(c.title));
  return titles.some((t) => {
    const n = norm(t);
    return [current, ...past].some((title) => title.includes(n) || n.includes(title));
  });
}

/** Per-constraint pass counts - used to explain an empty result set to the recruiter. */
export interface FilterStats {
  total: number;
  passingSkills: number;
  passingYears: number;
  passingLocation: number;
  passingCompanyType: number;
  passingTitle: number;
  passingAll: number;
}

export interface FilterOutcome {
  passing: Profile[];
  stats: FilterStats;
}

export function filterProfiles(filters: Filters): FilterOutcome {
  const { skills, minYearsExperience, maxYearsExperience, locations, companyTypes, titles } =
    filters;

  const okSkills = (p: Profile) => skills.every((s) => hasSkill(p, s));
  const okYears = (p: Profile) =>
    (minYearsExperience == null || p.years_experience >= minYearsExperience) &&
    (maxYearsExperience == null || p.years_experience <= maxYearsExperience);
  const okLocation = (p: Profile) => matchesLocation(p, locations);
  const okCompany = (p: Profile) => matchesCompanyType(p, companyTypes);
  const okTitle = (p: Profile) => matchesTitle(p, titles);

  const passing = PROFILES.filter(
    (p) => okSkills(p) && okYears(p) && okLocation(p) && okCompany(p) && okTitle(p)
  );

  const stats: FilterStats = {
    total: PROFILES.length,
    passingSkills: PROFILES.filter(okSkills).length,
    passingYears: PROFILES.filter(okYears).length,
    passingLocation: PROFILES.filter(okLocation).length,
    passingCompanyType: PROFILES.filter(okCompany).length,
    passingTitle: PROFILES.filter(okTitle).length,
    passingAll: passing.length,
  };

  return { passing, stats };
}
