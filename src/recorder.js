import { execa } from 'execa';
import { chromium } from 'playwright';
import { spawn } from 'node-pty';
import fs from 'fs/promises';
import path from 'path';

/**
 * Records terminal session by simulating shell commands with ANSI output
 * @param {Array<{cmd: string, delay?: number}>} steps - Commands to simulate
 * @param {string} outPath - Output file path for recording data
 * @returns {Promise<{duration: number, frames: Array, output: string}>}
 */
export async function recordTerminal(steps, outPath) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('steps must be a non-empty array');
  }
  if (!outPath) {
    throw new Error('outPath is required');
  }

  const frames = [];
  let output = '';
  let totalDuration = 0;
  const startTime = Date.now();

  try {
    // Create a pseudo-terminal session
    const term = spawn('bash', [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
    });

    let buffer = '';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        term.kill();
        reject(new Error('Terminal recording timeout'));
      }, 30000);

      term.onData((data) => {
        buffer += data;
        output += data;
        const timestamp = Date.now() - startTime;
        frames.push({
          timestamp,
          data: data.toString(),
          type: 'output',
        });
      });

      term.onExit(() => {
        clearTimeout(timeout);
        totalDuration = Date.now() - startTime;

        // Write recording data
        fs.writeFile(
          outPath,
          JSON.stringify({ frames, duration: totalDuration, output }, null, 2)
        )
          .then(() => {
            resolve({
              duration: totalDuration,
              frames,
              output,
            });
          })
          .catch(reject);
      });

      // Execute commands with delays
      (async () => {
        try {
          for (const step of steps) {
            const delay = step.delay || 500;
            await new Promise((res) => setTimeout(res, delay));

            const cmd = step.cmd + '\n';
            term.write(cmd);

            // Wait for command to complete (simple heuristic)
            await new Promise((res) => setTimeout(res, 1000));
          }

          // Close terminal
          term.write('exit\n');
          await new Promise((res) => setTimeout(res, 500));
          term.kill();
        } catch (err) {
          term.kill();
          reject(err);
        }
      })();
    });
  } catch (err) {
    throw new Error(`Failed to record terminal: ${err.message}`);
  }
}

/**
 * Records browser session using Playwright
 * @param {Array<{action: string, target?: string, delay?: number}>} steps - Navigation/click actions
 * @param {string} outPath - Output video file path
 * @returns {Promise<{duration: number, videoPath: string}>}
 */
export async function recordBrowser(steps, outPath) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('steps must be a non-empty array');
  }
  if (!outPath) {
    throw new Error('outPath is required');
  }

  const dir = path.dirname(outPath);
  await fs.mkdir(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir },
  });

  const startTime = Date.now();

  try {
    const page = await context.newPage();

    for (const step of steps) {
      const delay = step.delay || 500;

      if (step.action === 'goto') {
        await page.goto(step.target, { waitUntil: 'networkidle' });
      } else if (step.action === 'click') {
        await page.click(step.target);
      } else if (step.action === 'type') {
        await page.type(step.target, step.text || '');
      } else if (step.action === 'wait') {
        await page.waitForTimeout(delay);
        continue;
      }

      await new Promise((res) => setTimeout(res, delay));
    }

    const duration = Date.now() - startTime;
    const videoPath = await page.video().path();

    await context.close();
    await browser.close();

    return {
      duration,
      videoPath,
    };
  } catch (err) {
    await context.close();
    await browser.close();
    throw new Error(`Failed to record browser: ${err.message}`);
  }
}

/**
 * Orchestrates both terminal and browser recordings
 * @param {Object} scenario - Scenario object with terminal and browser steps
 * @param {string} outDir - Output directory
 * @returns {Promise<{terminal: Object|null, browser: Object|null, outDir: string}>}
 */
export async function recordScenario(scenario, outDir) {
  if (!scenario || typeof scenario !== 'object') {
    throw new Error('scenario must be an object');
  }
  if (!outDir) {
    throw new Error('outDir is required');
  }

  await fs.mkdir(outDir, { recursive: true });

  const results = {
    terminal: null,
    browser: null,
    outDir,
  };

  try {
    // Record terminal if steps provided
    if (scenario.terminalSteps && Array.isArray(scenario.terminalSteps)) {
      const terminalPath = path.join(outDir, 'terminal.json');
      results.terminal = await recordTerminal(
        scenario.terminalSteps,
        terminalPath
      );
    }

    // Record browser if steps provided
    if (scenario.browserSteps && Array.isArray(scenario.browserSteps)) {
      const videoPath = path.join(outDir, 'browser.mp4');
      results.browser = await recordBrowser(scenario.browserSteps, videoPath);
    }

    return results;
  } catch (err) {
    throw new Error(`Failed to record scenario: ${err.message}`);
  }
}
