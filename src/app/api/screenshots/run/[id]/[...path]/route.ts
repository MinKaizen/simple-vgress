import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScreenshotPath } from '@/lib/storage';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

// GET /api/screenshots/run/[id]/[...path] - Serve run screenshots
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, path: pathParts } = await params;
  const filename = pathParts.join('/');
  
  const filePath = getScreenshotPath('run', id, filename);
  
  if (!filePath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
