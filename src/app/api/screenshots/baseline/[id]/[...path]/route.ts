import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScreenshotPath } from '@/lib/storage';
import * as fs from 'fs';

export const dynamic = 'force-dynamic';

// GET /api/screenshots/baseline/[id]/[...path] - Serve baseline screenshots
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
  
  const filePath = getScreenshotPath('baseline', id, filename);
  
  if (!filePath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
