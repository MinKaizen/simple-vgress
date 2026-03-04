// Queue processor module
// Handles processing of queued runs

import { 
  getNextQueuedItem, 
  updateQueueItem, 
  isRunInProgress,
  getUserById,
  RunQueueItem,
  Run,
} from '@/lib/db';
import { executeRun, RunProgressCallback } from '@/lib/core/runner';
import { sendRunNotification } from '@/lib/notifications';

// Store for active run progress listeners
const progressListeners = new Map<string, Set<RunProgressCallback>>();

// Processing lock
let isProcessing = false;

/**
 * Add a progress listener for a run
 */
export function addProgressListener(runId: string, callback: RunProgressCallback): void {
  if (!progressListeners.has(runId)) {
    progressListeners.set(runId, new Set());
  }
  progressListeners.get(runId)!.add(callback);
}

/**
 * Remove a progress listener
 */
export function removeProgressListener(runId: string, callback: RunProgressCallback): void {
  const listeners = progressListeners.get(runId);
  if (listeners) {
    listeners.delete(callback);
    if (listeners.size === 0) {
      progressListeners.delete(runId);
    }
  }
}

/**
 * Notify all listeners for a run
 */
function notifyListeners(runId: string, event: Parameters<RunProgressCallback>[0]): void {
  const listeners = progressListeners.get(runId);
  if (listeners) {
    for (const callback of listeners) {
      try {
        callback(event);
      } catch (error) {
        console.error('[Queue] Listener error:', error);
      }
    }
  }
}

/**
 * Process the next item in the queue
 */
export async function processQueue(): Promise<void> {
  // Check if already processing
  if (isProcessing) {
    console.log('[Queue] Already processing, skipping');
    return;
  }
  
  // Check if a run is already in progress
  if (isRunInProgress()) {
    console.log('[Queue] Run already in progress, skipping');
    return;
  }
  
  // Get next queued item
  const queueItem = getNextQueuedItem();
  if (!queueItem) {
    console.log('[Queue] No items in queue');
    return;
  }
  
  isProcessing = true;
  
  try {
    console.log(`[Queue] Processing queue item: ${queueItem.id}`);
    
    // Mark as processing
    updateQueueItem(queueItem.id, 'processing');
    
    // Get user info if available
    let userEmail: string | null = null;
    if (queueItem.requested_by_user_id) {
      const user = getUserById(queueItem.requested_by_user_id);
      userEmail = user?.email || null;
    }
    
    // Execute the run
    const run = await executeRun(
      queueItem.config_yaml,
      queueItem.trigger_type,
      queueItem.requested_by_user_id,
      userEmail,
      (event) => {
        // Forward progress to any listeners
        if (event.data?.runId) {
          notifyListeners(event.data.runId, event);
        }
      }
    );
    
    // Mark queue item as completed
    updateQueueItem(queueItem.id, 'completed');
    
    // Send notification
    await sendRunNotification(run);
    
    console.log(`[Queue] Completed queue item: ${queueItem.id}, run: ${run.id}`);
    
    // Process next item if any
    isProcessing = false;
    setImmediate(() => processQueue());
    
  } catch (error) {
    console.error('[Queue] Processing error:', error);
    updateQueueItem(queueItem.id, 'completed');
    isProcessing = false;
  }
}

/**
 * Add a run to the queue and start processing
 */
export function enqueueRun(
  queueId: string,
  configYaml: string,
  triggerType: 'manual' | 'scheduled',
  userId: string | null
): void {
  const { addToQueue } = require('@/lib/db');
  
  addToQueue({
    id: queueId,
    requested_by_user_id: userId,
    trigger_type: triggerType,
    config_yaml: configYaml,
  });
  
  // Start processing (will check if already processing)
  setImmediate(() => processQueue());
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
  isProcessing: boolean;
  queueLength: number;
  currentRunId: string | null;
} {
  const { getQueuedCount, getRunningRun } = require('@/lib/db');
  const runningRun = getRunningRun();
  
  return {
    isProcessing,
    queueLength: getQueuedCount(),
    currentRunId: runningRun?.id || null,
  };
}
