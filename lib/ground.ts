import { PROFILES, type Profile } from "@/lib/profiles";

/**
 * Trust guardrail for the "why this matched" signals. The scoring prompt asks the model
 * to cite real fields, but "asks" is not "guarantees" - a single fabricated signal
 * (a company the candidate never worked at, a wrong year count) silently erodes the
 * recruiter's trust in the whole product. So we verify each signal against the profile
 * and drop only the ones that *contradict* it, keeping legitimate and generic phrasing.
 *
 * The check is deliberately conservative: it flags a signal only when it names a known
 * dataset entity (skill/company) that is not this candidate's, or an experience-year
 * count that is not real for them. Generic praise with no checkable claim passes through.
 */

const norm = (s: string) => s.toLowerCase().trim();

// Dataset-wide entity vocabularies, built once. Terms shorter than 3 chars are skipped
// to avoid spurious substring matches (e.g. "Go" inside "Google").
const ALL_SKILLS = new Set<string>();
const ALL_COMPANIES = new Set<string>();
for (const p of PROFILES) {
  p.skills.forEach((s) => ALL_SKILLS.add(norm(s)));
  ALL_COMPANIES.add(norm(p.current_company));
  p.past_companies.forEach((c) => ALL_COMPANIES.add(norm(c.company)));
}

interface ProfileTruth {
  skills: Set<string>;
  companies: Set<string>;
  years: Set<number>;
}

function profileTruth(p: Profile): ProfileTruth {
  return {
    skills: new Set(p.skills.map(norm)),
    companies: new Set([norm(p.current_company), ...p.past_companies.map((c) => norm(c.company))]),
    years: new Set([p.years_experience, ...p.past_companies.map((c) => c.years)]),
  };
}

/** Dataset terms from `vocab` that appear as substrings of the normalized signal. */
function mentioned(signal: string, vocab: Set<string>): string[] {
  const hits: string[] = [];
  for (const term of vocab) {
    if (term.length >= 3 && signal.includes(term)) hits.push(term);
  }
  return hits;
}

/** Experience-year counts a signal claims, e.g. "5 years", "7+ yrs", "3 year". */
function claimedYears(signal: string): number[] {
  const out: number[] = [];
  const re = /\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(signal))) out.push(Number(m[1]));
  return out;
}

/**
 * Whether any dataset entity mentioned in the signal is absent from the profile.
 * A short term is not a violation when it is a substring of a longer mentioned entity
 * that the profile *does* have (e.g. "aws" inside the real skill "aws rds").
 */
function mentionsAbsentEntity(signal: string, vocab: Set<string>, owned: Set<string>): boolean {
  const found = mentioned(signal, vocab);
  const present = found.filter((t) => owned.has(t));
  const absent = found.filter((t) => !owned.has(t));
  return absent.some((a) => !present.some((p) => p.includes(a)));
}

/** Keep only signals that do not contradict the profile. */
export function groundSignals(profile: Profile, signals: string[]): string[] {
  const truth = profileTruth(profile);
  return signals.filter((sig) => {
    const n = norm(sig);

    // A named dataset company must be one of this candidate's own.
    if (mentionsAbsentEntity(n, ALL_COMPANIES, truth.companies)) return false;
    // A named dataset skill must be one of this candidate's own.
    if (mentionsAbsentEntity(n, ALL_SKILLS, truth.skills)) return false;
    // A claimed years-of-experience count must be a real number for this candidate.
    if (claimedYears(n).some((y) => !truth.years.has(y))) return false;

    return true;
  });
}
