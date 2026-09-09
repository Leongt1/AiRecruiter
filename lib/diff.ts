import type { Filters, Rubric } from "@/lib/schemas";

/**
 * Pure diff helpers used to make a refinement round *visible*: after the recruiter's
 * feedback changes the filters/rubric, the UI highlights exactly what moved instead of
 * silently swapping values. Kept framework-free so it is trivial to unit-check.
 */

export function yearsLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Any";
  if (min != null && max != null) return `${min}-${max} yrs`;
  if (min != null) return `${min}+ yrs`;
  return `up to ${max} yrs`;
}

export interface ListDiff {
  added: string[];
  removed: string[];
}

export interface FiltersDiff {
  skills: ListDiff;
  locations: ListDiff;
  companyTypes: ListDiff;
  titles: ListDiff;
  years: { changed: boolean; from: string; to: string };
  any: boolean;
}

function listDiff(prev: string[], next: string[]): ListDiff {
  const p = new Set(prev.map((x) => x.toLowerCase()));
  const n = new Set(next.map((x) => x.toLowerCase()));
  return {
    added: next.filter((x) => !p.has(x.toLowerCase())),
    removed: prev.filter((x) => !n.has(x.toLowerCase())),
  };
}

export function diffFilters(prev: Filters, next: Filters): FiltersDiff {
  const skills = listDiff(prev.skills, next.skills);
  const locations = listDiff(prev.locations, next.locations);
  const companyTypes = listDiff(prev.companyTypes, next.companyTypes);
  const titles = listDiff(prev.titles, next.titles);
  const from = yearsLabel(prev.minYearsExperience, prev.maxYearsExperience);
  const to = yearsLabel(next.minYearsExperience, next.maxYearsExperience);
  const years = { changed: from !== to, from, to };

  const lists = [skills, locations, companyTypes, titles];
  const any = years.changed || lists.some((d) => d.added.length > 0 || d.removed.length > 0);
  return { skills, locations, companyTypes, titles, years, any };
}

export interface RubricDiff {
  summaryChanged: boolean;
  addedCriteria: string[];
  removedCriteria: string[];
  weightChanges: { name: string; from: number; to: number }[];
  any: boolean;
}

export function diffRubric(prev: Rubric, next: Rubric): RubricDiff {
  const prevByName = new Map(prev.criteria.map((c) => [c.name, c]));
  const nextByName = new Map(next.criteria.map((c) => [c.name, c]));

  const addedCriteria = next.criteria.filter((c) => !prevByName.has(c.name)).map((c) => c.name);
  const removedCriteria = prev.criteria.filter((c) => !nextByName.has(c.name)).map((c) => c.name);
  const weightChanges = next.criteria
    .filter((c) => {
      const before = prevByName.get(c.name);
      return before && before.weight !== c.weight;
    })
    .map((c) => ({ name: c.name, from: prevByName.get(c.name)!.weight, to: c.weight }));
  const summaryChanged = prev.summary.trim() !== next.summary.trim();

  const any =
    summaryChanged ||
    addedCriteria.length > 0 ||
    removedCriteria.length > 0 ||
    weightChanges.length > 0;
  return { summaryChanged, addedCriteria, removedCriteria, weightChanges, any };
}
