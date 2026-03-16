import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getRunById } from '@/lib/db';
import { addProgressListener, removeProgressListener } from '@/lib/queue';

export const dynamic = 'force-dynamic';

// GET /api/runs/[id]/progress - SSE endpoint for run progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;
  const run = getRunById(id);

  if (!run) {
    return new Response('Run not found', { status: 404 });
  }

  // If run is already complete, return immediately
  if (run.status !== 'running' && run.status !== 'pending') {
    return new Response(
      `data: ${JSON.stringify({ type: 'completed', run })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const callback = (event: { type: string; message: string; data?: unknown }) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Close stream when run completes
        if (event.type === 'completed' || event.type === 'error') {
          setTimeout(() => {
            removeProgressListener(id, callback);
            controller.close();
          }, 100);
        }
      };

      addProgressListener(id, callback);

      // Send initial event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', runId: id })}\n\n`)
      );

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        removeProgressListener(id, callback);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
