import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

// Mock playwright at the top level
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          click: vi.fn().mockResolvedValue(undefined),
          type: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          video: vi.fn().mockReturnValue({ path: vi.fn().mockResolvedValue('/tmp/video.mp4') })
        }),
        close: vi.fn().mockResolvedValue(undefined)
      }),
      close: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1000 })
  }
}));

import { recordTerminal, recordBrowser, recordScenario } from '../src/recorder.js';

describe('recorder.js', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `test-recorder-${Date.now()}`);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('recordTerminal', () => {
    it('should throw when steps is not an array', async () => {
      await expect(recordTerminal(null, `${tempDir}/output.json`)).rejects.toThrow('steps must be a non-empty array');
    });

    it('should throw when steps is empty array', async () => {
      await expect(recordTerminal([], `${tempDir}/output.json`)).rejects.toThrow('steps must be a non-empty array');
    });

    it('should throw when outPath is missing', async () => {
      await expect(recordTerminal([{ cmd: 'echo test' }], null)).rejects.toThrow('outPath is required');
    });

    it('should throw when outPath is empty', async () => {
      await expect(recordTerminal([{ cmd: 'echo test' }], '')).rejects.toThrow('outPath is required');
    });
  });

  describe('recordBrowser', () => {
    it('should throw when steps is not an array', async () => {
      await expect(recordBrowser(null, `${tempDir}/output.mp4`)).rejects.toThrow('steps must be a non-empty array');
    });

    it('should throw when steps is empty array', async () => {
      await expect(recordBrowser([], `${tempDir}/output.mp4`)).rejects.toThrow('steps must be a non-empty array');
    });

    it('should throw when outPath is missing', async () => {
      await expect(recordBrowser([{ action: 'goto', target: 'https://example.com' }], null)).rejects.toThrow('outPath is required');
    });

    it('should throw when outPath is empty', async () => {
      await expect(recordBrowser([{ action: 'goto', target: 'https://example.com' }], '')).rejects.toThrow('outPath is required');
    });
  });

  describe('recordScenario', () => {
    it('should throw when scenario is null', async () => {
      await expect(recordScenario(null, tempDir)).rejects.toThrow('scenario must be an object');
    });

    it('should throw when scenario is undefined', async () => {
      await expect(recordScenario(undefined, tempDir)).rejects.toThrow('scenario must be an object');
    });

    it('should throw when outDir is missing', async () => {
      await expect(recordScenario({ terminalSteps: [] }, null)).rejects.toThrow('outDir is required');
    });

    it('should throw when outDir is empty', async () => {
      await expect(recordScenario({ terminalSteps: [] }, '')).rejects.toThrow('outDir is required');
    });

    it('should return object with outDir', async () => {
      const result = await recordScenario({}, tempDir);
      expect(result).toHaveProperty('outDir');
      expect(result.outDir).toBe(tempDir);
    });

    it('should return object with terminal and browser as null when no steps', async () => {
      const result = await recordScenario({}, tempDir);
      expect(result.terminal).toBeNull();
      expect(result.browser).toBeNull();
    });
  });
});
