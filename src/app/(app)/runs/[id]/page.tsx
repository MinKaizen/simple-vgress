import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getRunById, getBaselineById, RunResult } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RunDetailClient } from './client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const run = getRunById(id);

  if (!run) {
    notFound();
  }

  const baseline = run.baseline_id_at_run ? getBaselineById(run.baseline_id_at_run) : null;
  const summary = run.summary_json ? JSON.parse(run.summary_json) : null;
  const results: RunResult[] = run.results_json ? JSON.parse(run.results_json) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/runs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Run Details
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {format(new Date(run.started_at), 'PPpp')}
          </p>
        </div>
        <Badge
          variant={
            run.status === 'success' ? 'success' :
            run.status === 'failed' ? 'destructive' :
            run.status === 'running' ? 'warning' :
            'secondary'
          }
          className="text-base px-4 py-2"
        >
          {run.status === 'success' && <CheckCircle className="h-4 w-4 mr-2" />}
          {run.status === 'failed' && <XCircle className="h-4 w-4 mr-2" />}
          {run.status === 'running' && <Clock className="h-4 w-4 mr-2 animate-pulse" />}
          {run.status === 'error' && <AlertCircle className="h-4 w-4 mr-2" />}
          {run.status}
        </Badge>
      </div>

      {/* Run Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trigger</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{run.trigger_type}</p>
            {run.triggered_by_user_email && (
              <p className="text-sm text-[var(--muted-foreground)]">
                by {run.triggered_by_user_email}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duration</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {run.completed_at
                ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                : 'In progress...'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Baseline Used</CardDescription>
          </CardHeader>
          <CardContent>
            {baseline ? (
              <>
                <p className="text-lg font-semibold">
                  {format(new Date(baseline.created_at), 'PP')}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {baseline.promotion_reason}
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold text-[var(--muted-foreground)]">
                No baseline (first run)
              </p>
            )}
          </CardContent>
        </Card>

        {summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge variant="success">{summary.passed} passed</Badge>
                {summary.failed > 0 && (
                  <Badge variant="destructive">{summary.failed} failed</Badge>
                )}
                {summary.errors > 0 && (
                  <Badge variant="warning">{summary.errors} errors</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error Message */}
      {run.error_message && (
        <Card className="border-[var(--destructive)]">
          <CardHeader>
            <CardTitle className="text-[var(--destructive)]">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-[var(--muted)] p-4 rounded-lg">
              {run.error_message}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Results Table & Diff Viewer */}
      <RunDetailClient run={run} results={results} />
    </div>
  );
}
