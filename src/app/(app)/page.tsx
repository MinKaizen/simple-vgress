import Link from 'next/link';
import { format } from 'date-fns';
import { Image, History, Play, Settings, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { getCurrentBaseline, getAllRuns, getRunsCount } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const currentBaseline = getCurrentBaseline();
  const recentRuns = getAllRuns(5, 0);
  const totalRuns = getRunsCount();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-[var(--muted-foreground)]">
          Visual regression testing overview
        </p>
      </div>

      {/* Current Baseline Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Current Baseline
          </CardTitle>
          <CardDescription>
            The baseline images used for visual comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentBaseline ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Promoted</p>
                  <p className="font-medium">
                    {format(new Date(currentBaseline.created_at), 'PPpp')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted-foreground)]">Promoted By</p>
                  <p className="font-medium">
                    {currentBaseline.promoted_by_user_email || 'System'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">Reason</p>
                <p className="font-medium">{currentBaseline.promotion_reason}</p>
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/baseline">View Baseline</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/baseline/history">View History</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-[var(--muted-foreground)] mb-4" />
              <p className="text-[var(--muted-foreground)] mb-4">
                No baseline set. Run your first test to create a baseline.
              </p>
              <Button asChild>
                <Link href="/runs/new">Create First Baseline</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:border-[var(--primary)] transition-colors">
          <Link href="/runs/new">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                  <Play className="h-6 w-6 text-[var(--primary-foreground)]" />
                </div>
                <div>
                  <h3 className="font-semibold">New Run</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Start a visual regression test
                  </p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-[var(--primary)] transition-colors">
          <Link href="/runs">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-[var(--secondary)] flex items-center justify-center">
                  <History className="h-6 w-6 text-[var(--secondary-foreground)]" />
                </div>
                <div>
                  <h3 className="font-semibold">Run History</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {totalRuns} total runs
                  </p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-[var(--primary)] transition-colors">
          <Link href="/settings">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-[var(--secondary)] flex items-center justify-center">
                  <Settings className="h-6 w-6 text-[var(--secondary-foreground)]" />
                </div>
                <div>
                  <h3 className="font-semibold">Settings</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Configure schedules & retention
                  </p>
                </div>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Runs
          </CardTitle>
          <CardDescription>Latest visual regression test results</CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length > 0 ? (
            <div className="space-y-4">
              {recentRuns.map((run) => {
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
                            {format(new Date(run.started_at), 'PPp')}
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {run.trigger_type === 'scheduled' ? 'Scheduled' : 'Manual'} run
                            {run.triggered_by_user_email && ` by ${run.triggered_by_user_email}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {summary && (
                          <>
                            <Badge variant="success">{summary.passed} passed</Badge>
                            {summary.failed > 0 && (
                              <Badge variant="destructive">{summary.failed} failed</Badge>
                            )}
                          </>
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
              
              <div className="text-center pt-4">
                <Button variant="outline" asChild>
                  <Link href="/runs">View All Runs</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--muted-foreground)]">
                No runs yet. Start your first test!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
