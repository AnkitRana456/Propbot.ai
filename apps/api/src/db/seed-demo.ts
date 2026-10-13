import 'dotenv/config';
import { runComprehensiveSeed } from './seed.js';

export async function runDemoSeed() {
  await runComprehensiveSeed();
}

runDemoSeed()
  .catch(err => {
    console.error('Demo seed failed:', err);
    process.exit(1);
  })
  .then(() => process.exit(0));
