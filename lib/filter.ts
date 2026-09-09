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

/**
 * Does the profile have a skill satisfying `required` (alias- and substring-aware)?
 *
 * The substring check is one-directional: an OWNED skill may contain the WANTED term
 * ("AWS RDS" satisfies a query for "RDS"), but NOT the reverse. Matching the reverse
 * direction would let a shorter owned skill satisfy a longer query - e.g. "AWS" would
 * match "AWS RDS", or "SQL" would match "PostgreSQL" - which is a false positive.
 * Recruiter shorthand ("rds", "k8s", "postgres") is handled by `SKILL_ALIASES`, not by
 * loose reverse-substring matching.
 */
function hasSkill(profile: Profile, required: string): boolean {
  const wanted = expand(required);
  const owned = profile.skills.map(norm);
  return wanted.some((w) =>
    owned.some((o) => o === w || (w.length >= 3 && o.includes(w)))
  );
}

/**
 * Discipline words ("frontend", "backend", "devops", ...) name a role, not a literal
 * skill. The model sometimes routes them into the `skills` axis (e.g. skills:
 * ["frontend experience"]), where no profile has a matching skill and everyone is
 * filtered out. So when a required "skill" is really a discipline, we satisfy it by a
 * matching title (the reliable signal - disciplines appear as titles in the data) OR a
 * discipline-exclusive skill, instead of requiring a literal skill by that name.
 */
const DISCIPLINES: Record<string, { titles: string[]; skills: string[] }> = {
  frontend: { titles: ["frontend", "front end", "front-end"], skills: ["react", "css", "next.js", "design systems", "accessibility"] },
  backend: { titles: ["backend", "back end", "back-end"], skills: ["node.js", "django", "celery", "grpc", "kafka"] },
  fullstack: { titles: ["full stack", "fullstack", "full-stack"], skills: ["mongodb", "graphql"] },
  mobile: { titles: ["mobile", "ios", "android"], skills: ["swift", "swiftui", "combine", "core data", "kotlin", "jetpack compose", "coroutines"] },
  ios: { titles: ["ios"], skills: ["swift", "swiftui", "combine", "core data"] },
  android: { titles: ["android"], skills: ["kotlin", "jetpack compose", "coroutines"] },
  devops: { titles: ["devops", "dev ops"], skills: ["kubernetes", "ci/cd"] },
  ml: { titles: ["machine learning"], skills: ["pytorch", "llms", "rag", "vector dbs"] },
  data: { titles: ["data engineer"], skills: ["spark", "airflow", "dbt", "sql"] },
  qa: { titles: ["qa", "quality", "automation"], skills: ["selenium", "playwright"] },
  database: { titles: ["database reliability", "database"], skills: ["monitoring"] },
};

// Alternate spellings a term can arrive as, mapped to the canonical discipline key.
const DISCIPLINE_SYNONYMS: Record<string, string> = {
  frontend: "frontend", "front end": "frontend", "front-end": "frontend",
  backend: "backend", "back end": "backend", "back-end": "backend",
  fullstack: "fullstack", "full stack": "fullstack", "full-stack": "fullstack",
  mobile: "mobile", ios: "ios", android: "android",
  devops: "devops", "dev ops": "devops",
  ml: "ml", "machine learning": "ml",
  data: "data",
  qa: "qa", "quality assurance": "qa", automation: "qa",
  database: "database", dba: "database",
};

// Words that decorate a discipline term but carry no meaning for classification.
const DISCIPLINE_FILLER = /\b(experience|engineers?|engineering|developers?|development|devs?|skills?|background|expertise|roles?)\b/g;

/** If `term` is really a discipline word, return its mapping; otherwise null. */
function disciplineFor(term: string): { titles: string[]; skills: string[] } | null {
  const cleaned = norm(term).replace(DISCIPLINE_FILLER, " ").replace(/\s+/g, " ").trim();
  const key = DISCIPLINE_SYNONYMS[cleaned] ?? cleaned.split(" ").map((w) => DISCIPLINE_SYNONYMS[w]).find(Boolean);
  return key ? DISCIPLINES[key] : null;
}

function matchesDiscipline(profile: Profile, disc: { titles: string[]; skills: string[] }): boolean {
  const titles = [norm(profile.current_title), ...profile.past_companies.map((c) => norm(c.title))];
  if (disc.titles.some((t) => titles.some((title) => title.includes(t)))) return true;
  const owned = new Set(profile.skills.map(norm));
  return disc.skills.some((s) => owned.has(s));
}

/** Satisfy a required "skill": as a discipline (title/skills) if it is one, else literally. */
function matchesRequiredSkill(profile: Profile, required: string): boolean {
  const disc = disciplineFor(required);
  return disc ? matchesDiscipline(profile, disc) : hasSkill(profile, required);
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

  const okSkills = (p: Profile) => skills.every((s) => matchesRequiredSkill(p, s));
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
