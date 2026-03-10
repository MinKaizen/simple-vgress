import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCurrentBaseline, getRunById, RunResult } from '@/lib/db';
import * as fs from 'fs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/baselines/current
 * Returns the current baseline along with the list of URLs it contains.
 * URLs are sourced from the run the baseline was promoted from.
 * If the baseline has no associated run, an empty list is returned.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseline = getCurrentBaseline();
  if (!baseline) {
    return NextResponse.json({ baseline: null, urls: [] });
  }

  let urls: string[] = [];

  if (baseline.promoted_from_run_id) {
    const run = getRunById(baseline.promoted_from_run_id);
    if (run?.results_json) {
      try {
        const results: RunResult[] = JSON.parse(run.results_json);
        urls = [...new Set(results.map((r) => r.url))];
      } catch {
        // ignore parse errors – urls stays empty
      }
    }
  }

  return NextResponse.json({ baseline, urls });
}
