import cron from 'node-cron';
import { runSimulationCycle } from '../services/simulation.service';

// Default to running every 6 hours if no custom environment override is set
const cronExpression = process.env.SIMULATION_CRON || '0 */6 * * *';
const triggerAiOnTick = process.env.SIMULATION_TRIGGER_AI === 'true';

console.log(`[Scheduler] Initializing market simulation cron: "${cronExpression}" (triggerAiOnTick=${triggerAiOnTick})`);

cron.schedule(cronExpression, async () => {
  console.log('[Scheduler] Starting automated daily market simulation tick...');
  try {
    await runSimulationCycle(triggerAiOnTick);
    console.log('[Scheduler] Automated daily market simulation tick completed.');
  } catch (err: any) {
    console.error('[Scheduler] Automated market simulation tick failed:', err);
  }
});
