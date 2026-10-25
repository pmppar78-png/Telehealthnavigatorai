// Scheduled function (Netlify Functions v2): runs hourly on the published
// deploy, whether or not the chat gets traffic, and deletes chat rate-limit
// counters older than about 2 days (see ./lib/rate-limit.mjs).
// Scheduled functions have a 30-second execution limit, so the sweep stops
// after BUDGET_MS or 2,000 deletes; anything left goes in the next run.
// Logs counts only: never keys, hashes, IPs or message content.
import { getStore } from "@netlify/blobs";
import { sweepExpired } from "./lib/rate-limit.mjs";

export const BUDGET_MS = 25 * 1000;

export async function runSweep({ store, now = Date.now(), clock = Date.now, budgetMs = BUDGET_MS, maxDeletes } = {}) {
  const started = clock();
  try {
    store = store || getStore({ name: "chat-rate-limit", consistency: "strong" });
    const r = await sweepExpired(store, now, { deadline: started + budgetMs, clock, maxDeletes });
    console.log(
      `rate-limit sweep: deleted ${r.deleted}` +
      (r.capped ? " (hit delete cap; rest next run)" : "") +
      (r.timedOut ? " (hit time budget; rest next run)" : "")
    );
    return r;
  } catch (err) {
    console.error("rate-limit sweep failed:", err && err.name);
    return { deleted: 0, capped: false, timedOut: false, error: true };
  }
}

export default async () => {
  await runSweep();
};

export const config = {
  schedule: "@hourly",
};
