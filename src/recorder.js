import { execa } from 'execa';
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

/**
 * Records terminal session by running shell commands and capturing output
 * Uses execa for command execution with simpler compatibility
 * @param {Array<{cmd: string, delay?: number}>} steps - Commands to simulate
 * @param {string} outPath - Output file path for recording data
 * @returns {Promise<{duration: number, frames: Array, output: string, path: string}>}
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
    // Create output directory
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    
    // Execute each command and capture output
    for (const step of steps) {
      const delay = step.delay || 500;
      
      // Wait before executing command
      await new Promise((res) => setTimeout(res, delay));
      
      const cmdStartTime = Date.now();
      
      try {
        // Execute command using execa
        const result = await execa('bash', ['-c', step.cmd], {
          all: true,
          reject: true,
        });

        const timestamp = Date.now() - startTime;
        const cmdOutput = result.all || [result.stdout, result.stderr].filter(Boolean).join('\n');
        
        output += `$ ${step.cmd}\n${cmdOutput}\n`;
        
        frames.push({
          timestamp,
          command: step.cmd,
          output: cmdOutput,
          exitCode: result.exitCode,
          caption: step.caption || '',
          stepIndex: step.stepIndex ?? frames.length,
          duration: Date.now() - cmdStartTime,
          type: 'command',
        });
      } catch (cmdErr) {
        // Still capture output even if command fails
        const timestamp = Date.now() - startTime;
        const cmdOutput = cmdErr.all ||
          [cmdErr.stdout, cmdErr.stderr].filter(Boolean).join('\n') ||
          cmdErr.message;
        
        output += `$ ${step.cmd}\n${cmdOutput}\n`;
        
        frames.push({
          timestamp,
          command: step.cmd,
          output: cmdOutput,
          error: true,
          allowFailure: Boolean(step.allowFailure),
          exitCode: cmdErr.exitCode ?? 1,
          caption: step.caption || '',
          stepIndex: step.stepIndex ?? frames.length,
          duration: Date.now() - cmdStartTime,
          type: 'command',
        });
      }
    }

    totalDuration = Date.now() - startTime;

    // Write recording data
    await fs.writeFile(
      outPath,
      JSON.stringify({ frames, duration: totalDuration, output }, null, 2)
    );

    return {
      duration: totalDuration,
      frames,
      output,
      path: outPath,
    };
  } catch (err) {
    throw new Error(`Failed to record terminal: ${err.message}`);
  }
}

/**
 * Records browser session using Playwright screenshots at each step.
 * Does NOT require ffmpeg — output is a JSON file with base64 PNG frames.
 * @param {Array<{action: string, target?: string, text?: string, delay?: number}>} steps
 * @param {string} outPath - Output JSON file path
 * @param {Object} opts - Options: { viewport: {width, height} }
 * @returns {Promise<{duration: number, frames: Array, path: string}>}
 */
export async function recordBrowser(steps, outPath, opts = {}) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('steps must be a non-empty array');
  }
  if (!outPath) {
    throw new Error('outPath is required');
  }

  const viewport = opts.viewport || { width: 1280, height: 720 };
  const dir = path.dirname(outPath);
  await fs.mkdir(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });

  const frames = [];
  const startTime = Date.now();

  try {
    const page = await context.newPage();

    for (const step of steps) {
      const delay = step.delay || 800;

      if (step.action === 'goto') {
        await page.goto(step.target, { waitUntil: 'networkidle', timeout: step.timeout || 60000 });
      } else if (step.action === 'click') {
        await page.click(step.target, { timeout: step.timeout || 60000 });
      } else if (step.action === 'fill' || step.action === 'type') {
        await page.fill(step.target, step.text || '', { timeout: step.timeout || 60000 });
      } else if (step.action === 'wait') {
        await page.waitForTimeout(delay);
      } else if (step.action === 'assert') {
        await page.waitForSelector(step.target, { timeout: step.timeout || 60000 });
      } else if (step.action !== 'screenshot') {
        throw new Error(`Unsupported browser action: ${step.action}`);
      }

      await new Promise((res) => setTimeout(res, delay));

      const screenshotBuf = await page.screenshot({ fullPage: false });
      frames.push({
        timestamp: Date.now() - startTime,
        screenshot: screenshotBuf.toString('base64'),
        action: step.action,
        caption: step.caption || '',
        frameDelay: step.frameDelay || delay,
        type: 'browser',
      });
    }

    const duration = Date.now() - startTime;
    await context.close();
    await browser.close();

    const recording = { type: 'browser', frames, duration, viewport };
    await fs.writeFile(outPath, JSON.stringify(recording, null, 2));

    return { duration, frames, path: outPath };
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
