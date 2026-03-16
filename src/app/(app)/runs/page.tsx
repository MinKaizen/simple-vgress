import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, AlertCircle, Play } from 'lucide-react';
import { getAllRuns, getRunsCount } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const runs = getAllRuns(50, 0);
  const totalRuns = getRunsCount();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Run History</h1>
          <p className="text-[var(--muted-foreground)]">
            {totalRuns} total runs
          </p>
        </div>
        <Button asChild>
          <Link href="/runs/new">
            <Play className="h-4 w-4 mr-2" />
            New Run
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Runs</CardTitle>
          <CardDescription>
            Click on a run to view details and results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length > 0 ? (
            <div className="space-y-2">
              {runs.map((run) => {
                const summary = run.summary_json ? JSON.parse(run.summary_json) : null;
                
                return (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="block p-4 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {run.status === 'success' && (
                          <CheckCircle className="h-5 w-5 text-[var(--success)]" />
                        )}
                        {run.status === 'failed' && (
                          <XCircle className="h-5 w-5 text-[var(--destructive)]" />
                        )}
                        {run.status === 'running' && (
                          <Clock className="h-5 w-5 text-[var(--warning)] animate-pulse" />
                        )}
                        {run.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-[var(--destructive)]" />
                        )}
                        {run.status === 'pending' && (
                          <Clock className="h-5 w-5 text-[var(--muted-foreground)]" />
                        )}
                        <div>
                          <p className="font-medium">
                            {format(new Date(run.started_at), 'PPpp')}
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {run.trigger_type === 'scheduled' ? 'Scheduled' : 'Manual'} run
                            {run.triggered_by_user_email && ` by ${run.triggered_by_user_email}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {summary && (
                          <div className="flex gap-1">
                            <Badge variant="success">{summary.passed} passed</Badge>
                            {summary.failed > 0 && (
                              <Badge variant="destructive">{summary.failed} failed</Badge>
                            )}
                            {summary.errors > 0 && (
                              <Badge variant="warning">{summary.errors} errors</Badge>
                            )}
                          </div>
                        )}
                        <Badge
                          variant={
                            run.status === 'success' ? 'success' :
                            run.status === 'failed' ? 'destructive' :
                            run.status === 'running' ? 'warning' :
                            'secondary'
                          }
                        >
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-[var(--muted-foreground)] mb-4" />
              <h3 className="text-lg font-semibold mb-2">No runs yet</h3>
              <p className="text-[var(--muted-foreground)] mb-4">
                Start your first visual regression test
              </p>
              <Button asChild>
                <Link href="/runs/new">
                  <Play className="h-4 w-4 mr-2" />
                  Start First Run
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
