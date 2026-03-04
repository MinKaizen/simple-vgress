'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Image, History, ChevronDown } from 'lucide-react';
import { Baseline } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageStitcher } from '@/components/ui/image-stitcher';

interface BaselineViewerProps {
  baseline: Baseline;
  groups: Array<{ url: string; device: string; parts: string[] }>;
}

export function BaselineViewer({ baseline, groups }: BaselineViewerProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>(
    groups.length > 0 ? `${groups[0].url}::${groups[0].device}` : ''
  );

  const currentGroup = groups.find(
    (g) => `${g.url}::${g.device}` === selectedGroup
  );

  const getScreenshotUrl = (filename: string) => {
    return `/api/screenshots/baseline/${baseline.id}/${filename}`;
  };

  // Get unique URLs and devices for filtering
  const urls = [...new Set(groups.map((g) => g.url))];
  const devices = [...new Set(groups.map((g) => g.device))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Current Baseline</h1>
          <p className="text-[var(--muted-foreground)]">
            Promoted on {format(new Date(baseline.created_at), 'PPpp')}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/baseline/history">
            <History className="h-4 w-4 mr-2" />
            View History
          </Link>
        </Button>
      </div>

      {/* Baseline Info */}
      <Card>
        <CardHeader>
          <CardTitle>Baseline Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Promoted By</p>
              <p className="font-medium">
                {baseline.promoted_by_user_email || 'System'}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Reason</p>
              <p className="font-medium">{baseline.promotion_reason}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Screenshots</p>
              <p className="font-medium">
                {groups.length} URL/Device combinations
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Screenshot Viewer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Screenshots
          </CardTitle>
          <CardDescription>
            View baseline screenshots by URL and device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groups.length > 0 ? (
            <>
              <div className="flex gap-4">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select URL and device" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem
                        key={`${group.url}::${group.device}`}
                        value={`${group.url}::${group.device}`}
                      >
                        {group.url} ({group.device})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentGroup && (
                <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <ImageStitcher
                    images={currentGroup.parts.map(getScreenshotUrl)}
                    alt={`${currentGroup.url} - ${currentGroup.device}`}
                    className="max-h-[70vh] overflow-auto"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-[var(--muted-foreground)]">
              No screenshots available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
