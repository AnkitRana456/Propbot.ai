#!/usr/bin/env node
// Kill whatever process is holding PORT (default 3000) so tsx watch can bind it.
import { execSync } from 'node:child_process';
import process from 'node:process';

const port = process.env.PORT ?? '3000';
try {
  if (process.platform === 'win32') {
    const out = execSync(`netstat -aon | findstr :${port}`, { encoding: 'utf8' });
    const pids = [...new Set(out.trim().split('\n').map(l => l.trim().split(/\s+/).at(-1)).filter(Boolean))];
    for (const pid of pids) execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
  } else {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
  }
} catch { /* port was already free */ }
