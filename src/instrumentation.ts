export async function register() {
  // Only run on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initScheduler } = await import('@/lib/scheduler');
    
    // Initialize scheduler after a short delay to ensure DB is ready
    setTimeout(() => {
      try {
        initScheduler();
        console.log('[Instrumentation] Scheduler initialized');
      } catch (error) {
        console.error('[Instrumentation] Failed to initialize scheduler:', error);
      }
    }, 1000);
  }
}
