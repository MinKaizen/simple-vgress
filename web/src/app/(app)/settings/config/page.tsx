'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_CONFIG = `# Visual Regression Test Configuration

_default:
  fullPage: true
  devices: ["desktop", "mobile", "tablet"]
  timeoutMs: 30000
  requiredSelectors: []
  abortIfFail: false
  waitUntil: load
  waitFor: []
  scrollPage: true
  additionalWaitMs: 5000
  maxScreenshotHeight: 7000
  visualRegressionThreshold: 1.0
  generateDiffMask: true

pages:
  # Add your URLs here
  # https://example.com/:
  #   requiredSelectors:
  #     - "nav"
  #     - "footer"
`;

export default function ConfigEditorPage() {
  const [onDemandConfig, setOnDemandConfig] = useState('');
  const [scheduledConfig, setScheduledConfig] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('on-demand');

  useEffect(() => {
    Promise.all([
      fetch('/api/config/on-demand').then(res => res.json()),
      fetch('/api/config/scheduled').then(res => res.json()),
    ])
      .then(([onDemand, scheduled]) => {
        setOnDemandConfig(onDemand.config);
        setScheduledConfig(scheduled.config);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSave = async (type: 'on-demand' | 'scheduled') => {
    setIsSaving(true);
    setMessage(null);

    const config = type === 'on-demand' ? onDemandConfig : scheduledConfig;

    try {
      const response = await fetch(`/api/config/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${type === 'on-demand' ? 'On-demand' : 'Scheduled'} config saved` });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save config' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save config' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (type: 'on-demand' | 'scheduled') => {
    if (type === 'on-demand') {
      setOnDemandConfig(DEFAULT_CONFIG);
    } else {
      setScheduledConfig(DEFAULT_CONFIG);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Config Editor</h1>
          <p className="text-[var(--muted-foreground)]">
            Edit YAML configuration for visual regression tests
          </p>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.type === 'success' 
            ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]'
            : 'bg-[var(--destructive)]/10 text-[var(--destructive)] border border-[var(--destructive)]'
        }`}>
          {message.text}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="on-demand">On-Demand Config</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Config</TabsTrigger>
        </TabsList>

        <TabsContent value="on-demand">
          <Card>
            <CardHeader>
              <CardTitle>On-Demand Configuration</CardTitle>
              <CardDescription>
                This configuration is used when you manually trigger a run
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={onDemandConfig}
                onChange={(e) => setOnDemandConfig(e.target.value)}
                className="font-mono text-sm min-h-[500px]"
              />
              <div className="flex gap-2">
                <Button onClick={() => handleSave('on-demand')} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => handleReset('on-demand')}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Configuration</CardTitle>
              <CardDescription>
                This configuration is used for automated scheduled runs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={scheduledConfig}
                onChange={(e) => setScheduledConfig(e.target.value)}
                className="font-mono text-sm min-h-[500px]"
              />
              <div className="flex gap-2">
                <Button onClick={() => handleSave('scheduled')} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => handleReset('scheduled')}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
