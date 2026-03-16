'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, AlertCircle, Eye, ArrowUpCircle, Columns2, SlidersHorizontal } from 'lucide-react';
import { Run, RunResult } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DiffSlider } from '@/components/ui/diff-slider';
import { ImageStitcher } from '@/components/ui/image-stitcher';

interface RunDetailClientProps {
  run: Run;
  results: RunResult[];
}

export function RunDetailClient({ run, results }: RunDetailClientProps) {
  const router = useRouter();
  const [selectedResult, setSelectedResult] = useState<RunResult | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'sidebyside' | 'slider'>('sidebyside');
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoteReason, setPromoteReason] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  const handlePromote = async () => {
    setIsPromoting(true);
    try {
      const response = await fetch(`/api/runs/${run.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: run.status === 'success' ? 'All tests passed' : promoteReason,
        }),
      });

      if (response.ok) {
        setShowPromoteDialog(false);
        router.refresh();
      } else {
        const error = await response.json();
        alert(`Failed to promote: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to promote run');
    } finally {
      setIsPromoting(false);
    }
  };

  const getScreenshotUrl = (filename: string) => {
    return `/api/screenshots/run/${run.id}/${filename}`;
  };

  const getDiffUrl = (filename: string) => {
    return `/api/screenshots/run/${run.id}/diffs/${filename}`;
  };

  const baselineScreenshotUrl = (filename: string) => {
    if (!run.baseline_id_at_run) return '';
    return `/api/screenshots/baseline/${run.baseline_id_at_run}/${filename}`;
  };

  return (
    <>
      {/* Results Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Visual comparison results for each URL and device
            </CardDescription>
          </div>
          <Button onClick={() => setShowPromoteDialog(true)}>
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Promote to Baseline
          </Button>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full">
                <thead className="bg-[var(--muted)]">
                  <tr>
                    <th className="text-left p-3 font-medium">URL</th>
                    <th className="text-left p-3 font-medium">Device</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Diff %</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr
                      key={`${result.url}-${result.device}`}
                      className={`border-t border-[var(--border)] ${
                        result.status === 'failed' ? 'bg-[var(--destructive)]/5' :
                        result.status === 'error' ? 'bg-[var(--warning)]/5' : ''
                      }`}
                    >
                      <td className="p-3">
                        <span className="font-mono text-sm truncate max-w-[300px] block" title={result.url}>
                          {result.url}
                        </span>
                      </td>
                      <td className="p-3 capitalize">{result.device}</td>
                      <td className="p-3">
                        {result.status === 'passed' && (
                          <Badge variant="success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Passed
                          </Badge>
                        )}
                        {result.status === 'failed' && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                        {result.status === 'error' && (
                          <Badge variant="warning">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {result.diffPercentage !== undefined
                          ? `${result.diffPercentage.toFixed(2)}%`
                          : '-'}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedResult(result);
                            setViewMode('sidebyside');
                            setShowDiffDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              {run.status === 'running'
                ? 'Test is still running...'
                : 'No results available'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diff Viewer Dialog */}
      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedResult?.url} ({selectedResult?.device})
            </DialogTitle>
            <DialogDescription>
              {selectedResult?.status === 'passed' && 'No visual differences detected'}
              {selectedResult?.status === 'failed' && `${selectedResult.diffPercentage?.toFixed(2)}% difference detected`}
              {selectedResult?.status === 'error' && selectedResult.errorMessage}
            </DialogDescription>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-4">
              {selectedResult.status === 'failed' && selectedResult.diffImages && selectedResult.diffImages.length > 0 && run.baseline_id_at_run ? (
                <div className="space-y-4">
                  {/* View mode toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('sidebyside')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        viewMode === 'sidebyside'
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/80'
                      }`}
                    >
                      <Columns2 className="h-4 w-4" />
                      Side by Side
                    </button>
                    <button
                      onClick={() => setViewMode('slider')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        viewMode === 'slider'
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                          : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/80'
                      }`}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Slider
                    </button>
                  </div>

                  {viewMode === 'sidebyside' ? (
                    selectedResult.diffImages.filter(f => f.includes('-diff.')).length > 0 && (
                      <ImageStitcher
                        images={selectedResult.diffImages.filter(f => f.includes('-diff.')).map(getDiffUrl)}
                        className="rounded-lg border border-[var(--border)]"
                      />
                    )
                  ) : (
                    <DiffSlider
                      baselineUrls={selectedResult.screenshotParts.map(baselineScreenshotUrl)}
                      currentUrls={selectedResult.screenshotParts.map(getScreenshotUrl)}
                      className="rounded-lg border border-[var(--border)]"
                    />
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium mb-2">Current Screenshot:</div>
                  <ImageStitcher
                    images={selectedResult.screenshotParts.map(getScreenshotUrl)}
                    className="rounded-lg border border-[var(--border)]"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Promote Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {run.status === 'failed' || run.status === 'error'
                ? 'Promote Failed Run?'
                : 'Promote to Baseline'}
            </DialogTitle>
            <DialogDescription>
              {run.status === 'failed' || run.status === 'error' ? (
                <span className="text-[var(--destructive)] font-medium">
                  Warning: This run has failures. Are you sure you want to promote it as the new baseline?
                </span>
              ) : (
                'This will set the screenshots from this run as the new baseline for future comparisons.'
              )}
            </DialogDescription>
          </DialogHeader>
          
          {(run.status === 'failed' || run.status === 'error') && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for promotion (required)</Label>
                <Textarea
                  id="reason"
                  placeholder="Please explain why you are promoting this failed run..."
                  value={promoteReason}
                  onChange={(e) => setPromoteReason(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPromoteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant={run.status === 'success' ? 'default' : 'destructive'}
              onClick={handlePromote}
              disabled={
                isPromoting ||
                ((run.status === 'failed' || run.status === 'error') && !promoteReason.trim())
              }
            >
              {isPromoting ? 'Promoting...' : 'Confirm Promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
