/**
 * End-to-end smoke test of the LLM pipeline against the running dev server.
 * Usage: start the app (npm run dev) with GEMINI_API_KEY set, then:
 *   node scripts/smoke.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const QUERY =
  "RDS developers with 4-7 years of experience who have worked at startups, for a role based in Bangalore";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}: ${JSON.stringify(data.error ?? data)}`);
  }
  return data;
}

console.log(`Query: "${QUERY}"\n`);

console.log("1/2  generate ...");
const gen = await post("/api/generate", { query: QUERY });
console.log("     filters:", JSON.stringify(gen.filters));
console.log("     rubric :", gen.rubric.summary);
console.log(
  "     criteria:",
  gen.rubric.criteria.map((c) => `${c.name} (${Math.round(c.weight * 100)}%)`).join(", ")
);

console.log("\n2/3  filter + score ...");
const search = await post("/api/search", { filters: gen.filters, rubric: gen.rubric });
console.log(`     ${search.totalPassed} passed filters, showing top ${Math.min(5, search.ranked.length)}:\n`);
const shown = search.ranked.slice(0, 5);
for (const r of shown) {
  console.log(`     [${r.score}] ${r.profile.name} - ${r.profile.current_title}`);
  console.log(`           ${r.explanation}`);
  console.log(`           signals: ${r.matchedSignals.join("; ")}\n`);
}

const FEEDBACK = "Drop anyone with less than 5 years - too junior for this role.";
console.log(`3/3  refine ("${FEEDBACK}") ...`);
const refine = await post("/api/refine", {
  query: QUERY,
  filters: gen.filters,
  rubric: gen.rubric,
  feedback: FEEDBACK,
  shownProfileIds: shown.map((r) => r.profile.id),
});
console.log("     changed :", refine.changeSummary);
console.log("     filters :", JSON.stringify(refine.filters));
const research = await post("/api/search", { filters: refine.filters, rubric: refine.rubric });
console.log(`     now ${research.totalPassed} pass filters, top:`);
for (const r of research.ranked.slice(0, 5)) {
  console.log(`       [${r.score}] ${r.profile.name} (${r.profile.years_experience} yrs)`);
}

console.log("\nSmoke test passed - full loop (generate -> filter -> score -> refine) works.");
