'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

function normalizeUrlForComparison(url: string): string {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).toLowerCase().replace(/\/+$/, '') || u.origin.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Extract compareTo values from a YAML config string.
 * Returns an array of { forUrl, compareTo } pairs.
 * Uses a simple regex approach so we don't need a YAML parser on the client.
 */
function extractCompareTo(yaml: string): { forUrl: string; compareTo: string }[] {
  const results: { forUrl: string; compareTo: string }[] = [];

  // Split into URL-level blocks by looking for top-level keys that look like URLs
  // We parse line by line tracking the current URL context
  let currentUrl: string | null = null;
  let currentIndent = 0;

  for (const line of yaml.split('\n')) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.trimStart().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const keyMatch = trimmed.match(/^(\s*)(https?:\/\/[^:]+):\s*$/);
    if (keyMatch && indent === 0) {
      // Top-level URL key (pages section)
      currentUrl = keyMatch[2].trim();
      currentIndent = 0;
      continue;
    }

    if (currentUrl) {
      const compareToMatch = trimmed.match(/^\s+compareTo:\s*["']?(.+?)["']?\s*$/);
      if (compareToMatch) {
        results.push({ forUrl: currentUrl, compareTo: compareToMatch[1].trim() });
      }
    }
  }

  return results;
}

export default function NewRunPage() {
  const router = useRouter();
  const [config, setConfig] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [baselineUrls, setBaselineUrls] = useState<string[] | null>(null);

  useEffect(() => {
    // Load default on-demand config and current baseline URLs in parallel
    Promise.all([
      fetch('/api/config/on-demand').then((r) => r.json()),
      fetch('/api/baselines/current').then((r) => r.json()),
    ])
      .then(([configData, baselineData]) => {
        setConfig(configData.config);
        setBaselineUrls(baselineData.urls ?? []);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load configuration');
        setIsLoading(false);
      });
  }, []);

  // Validate compareTo values whenever config or baseline URLs change
  const validateCompareTo = useCallback(
    (yaml: string, urls: string[] | null) => {
      if (urls === null) return; // still loading

      const pairs = extractCompareTo(yaml);
      if (pairs.length === 0) {
        setValidationErrors([]);
        return;
      }

      const normalizedBaselineUrls = urls.map(normalizeUrlForComparison);
      const errors: string[] = [];

      for (const { forUrl, compareTo } of pairs) {
        const normalized = normalizeUrlForComparison(compareTo);
        if (!normalizedBaselineUrls.includes(normalized)) {
          if (urls.length === 0) {
            errors.push(
              `compareTo "${compareTo}" (for ${forUrl}): no current baseline exists or it has no recorded URLs.`
            );
          } else {
            errors.push(
              `compareTo "${compareTo}" (for ${forUrl}) was not found in the current baseline.`
            );
          }
        }
      }

      setValidationErrors(errors);
    },
    []
  );

  useEffect(() => {
    validateCompareTo(config, baselineUrls);
  }, [config, baselineUrls, validateCompareTo]);

  const handleSubmit = async () => {
    if (validationErrors.length > 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (response.ok) {
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

  const hasValidationErrors = validationErrors.length > 0;

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

              {hasValidationErrors && (
                <div className="bg-[var(--destructive)]/10 border border-[var(--destructive)] text-[var(--destructive)] rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium">Cannot start run — invalid compareTo values:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {validationErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <div className="bg-[var(--destructive)]/10 border border-[var(--destructive)] text-[var(--destructive)] rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !config.trim() || hasValidationErrors}
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
