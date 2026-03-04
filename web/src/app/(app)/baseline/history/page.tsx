'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, RotateCcw, Loader2 } from 'lucide-react';
import { Baseline } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function BaselineHistoryPage() {
  const router = useRouter();
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBaseline, setSelectedBaseline] = useState<Baseline | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    fetch('/api/baselines')
      .then((res) => res.json())
      .then((data) => {
        setBaselines(data.baselines);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handleRestore = async () => {
    if (!selectedBaseline) return;

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/baselines/${selectedBaseline.id}/restore`, {
        method: 'POST',
      });

      if (response.ok) {
        router.refresh();
        setSelectedBaseline(null);
        // Refresh baselines list
        const res = await fetch('/api/baselines');
        const data = await res.json();
        setBaselines(data.baselines);
      } else {
        const error = await response.json();
        alert(`Failed to restore: ${error.error}`);
      }
    } catch {
      alert('Failed to restore baseline');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/baseline">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Baseline History</h1>
          <p className="text-[var(--muted-foreground)]">
            View and restore previous baselines
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Baselines</CardTitle>
          <CardDescription>
            Baselines are kept according to your retention settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : baselines.length > 0 ? (
            <div className="space-y-4">
              {baselines.map((baseline) => (
                <div
                  key={baseline.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-[var(--border)]"
                >
                  <div className="flex items-center gap-4">
                    {baseline.is_current && (
                      <Badge variant="success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Current
                      </Badge>
                    )}
                    <div>
                      <p className="font-medium">
                        {format(new Date(baseline.created_at), 'PPpp')}
                      </p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {baseline.promotion_reason}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Promoted by {baseline.promoted_by_user_email || 'System'}
                      </p>
                    </div>
                  </div>
                  {!baseline.is_current && (
                    <Button
                      variant="outline"
                      onClick={() => setSelectedBaseline(baseline)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              No baselines available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!selectedBaseline} onOpenChange={() => setSelectedBaseline(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Baseline?</DialogTitle>
            <DialogDescription>
              This will set the baseline from{' '}
              {selectedBaseline && format(new Date(selectedBaseline.created_at), 'PPpp')}{' '}
              as the current baseline. Future runs will compare against this baseline.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBaseline(null)}>
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                'Confirm Restore'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
