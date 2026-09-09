import raw from "@/data/profiles.json";
import type { COMPANY_TYPES } from "@/lib/schemas";

export type CompanyType = (typeof COMPANY_TYPES)[number];

export interface PastCompany {
  company: string;
  company_type: string;
  title: string;
  years: number;
}

export interface Profile {
  id: string;
  name: string;
  current_title: string;
  years_experience: number;
  location: string;
  current_company: string;
  current_company_type: string;
  skills: string[];
  past_companies: PastCompany[];
  education: string;
  summary: string;
}

/** The entire talent pool for this exercise: the supplied file, loaded once. */
export const PROFILES: Profile[] = raw as Profile[];

export function getProfilesByIds(ids: string[]): Profile[] {
  const byId = new Map(PROFILES.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Profile => Boolean(p));
}
