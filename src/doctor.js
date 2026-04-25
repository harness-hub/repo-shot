import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

export async function runDoctor(opts = {}) {
  const checks = [];
  const outputDir = opts.output || './artifacts';

  checks.push(checkNodeVersion());
  checks.push(await checkWritableDirectory(outputDir));
  checks.push(await checkCanvas());
  checks.push(await checkPlaywright());
  checks.push(await checkFfmpeg());

  return {
    ok: checks.every((check) => check.ok || check.optional),
    checks,
  };
}

function checkNodeVersion() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  return {
    name: 'Node.js >= 18',
    ok: major >= 18,
    detail: `current ${process.versions.node}`,
    fix: 'Install Node.js 18 or newer.',
  };
}

async function checkWritableDirectory(outputDir) {
  try {
    await fs.mkdir(outputDir, { recursive: true });
    const probe = path.join(outputDir, `.repo-shot-doctor-${Date.now()}`);
    await fs.writeFile(probe, 'ok');
    await fs.unlink(probe);
    return {
      name: 'Output directory writable',
      ok: true,
      detail: outputDir,
    };
  } catch (error) {
    return {
      name: 'Output directory writable',
      ok: false,
      detail: error.message,
      fix: `Choose a writable directory with --output, or fix permissions for ${outputDir}.`,
    };
  }
}

async function checkCanvas() {
  try {
    const { createCanvas } = await import('canvas');
    const canvas = createCanvas(1, 1);
    canvas.getContext('2d').fillRect(0, 0, 1, 1);
    return {
      name: 'Canvas renderer',
      ok: true,
      detail: 'native canvas module loaded',
    };
  } catch (error) {
    return {
      name: 'Canvas renderer',
      ok: false,
      detail: error.message,
      fix: 'Install native build tools, then reinstall dependencies.',
    };
  }
}

async function checkPlaywright() {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return {
      name: 'Playwright Chromium',
      ok: true,
      detail: 'browser launches successfully',
    };
  } catch (error) {
    return {
      name: 'Playwright Chromium',
      ok: false,
      detail: error.message.split('\n')[0],
      fix: 'Run: npx playwright install chromium',
    };
  }
}

async function checkFfmpeg() {
  try {
    await execa('ffmpeg', ['-version']);
    return {
      name: 'ffmpeg for MP4/WebM',
      ok: true,
      optional: true,
      detail: 'available',
    };
  } catch {
    return {
      name: 'ffmpeg for MP4/WebM',
      ok: false,
      optional: true,
      detail: 'not found',
      fix: 'GIF export works without ffmpeg. Install ffmpeg only for MP4/WebM.',
    };
  }
}
