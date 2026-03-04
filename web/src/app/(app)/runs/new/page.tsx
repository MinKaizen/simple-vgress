'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function NewRunPage() {
  const router = useRouter();
  const [config, setConfig] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load the on-demand config
    fetch('/api/config/on-demand')
      .then((res) => res.json())
      .then((data) => {
        setConfig(data.config);
        setIsLoading(false);
      })
      .catch((err) => {
        setError('Failed to load configuration');
        setIsLoading(false);
      });
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to runs list - the run will appear there
        router.push('/runs');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to start run');
      }
    } catch (err) {
      setError('Failed to start run');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/runs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Run</h1>
          <p className="text-[var(--muted-foreground)]">
            Start a visual regression test
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Review and optionally modify the test configuration before starting the run.
            Changes here only affect this run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="config">YAML Configuration</Label>
                <Textarea
                  id="config"
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                  className="font-mono text-sm min-h-[400px]"
                  placeholder="Loading configuration..."
                />
              </div>

              {error && (
                <div className="bg-[var(--destructive)]/10 border border-[var(--destructive)] text-[var(--destructive)] rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !config.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Run
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/settings/config">Edit Default Config</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
