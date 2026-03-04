import { redirect } from 'next/navigation';
import { getCurrentBaseline } from '@/lib/db';
import { listScreenshots } from '@/lib/storage';
import { BaselineViewer } from './client';

export const dynamic = 'force-dynamic';

export default async function BaselinePage() {
  const baseline = getCurrentBaseline();

  if (!baseline) {
    redirect('/');
  }

  // Get list of screenshots
  const screenshots = listScreenshots('baseline', baseline.id);

  // Group screenshots by URL+device
  const groups = new Map<string, { url: string; device: string; parts: string[] }>();

  for (const screenshot of screenshots) {
    // Parse filename: {url-slug}.{device}.png or {url-slug}.{device}.part1of2.png
    const match = screenshot.match(/^(.+)\.([^.]+)(\.part\d+of\d+)?\.png$/);
    if (!match) continue;

    const [, urlSlug, device] = match;
    const key = `${urlSlug}::${device}`;

    if (!groups.has(key)) {
      groups.set(key, { url: urlSlug, device, parts: [] });
    }
    groups.get(key)!.parts.push(screenshot);
  }

  // Sort parts within each group
  for (const group of groups.values()) {
    group.parts.sort();
  }

  const groupsArray = Array.from(groups.values());

  return (
    <BaselineViewer
      baseline={baseline}
      groups={groupsArray}
    />
  );
}
