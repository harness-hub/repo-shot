import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

const playwrightMocks = vi.hoisted(() => {
  const pageMock = {
    goto: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-image')),
    video: vi.fn().mockReturnValue({ path: vi.fn().mockResolvedValue('/tmp/video.mp4') }),
  };

  const contextMock = {
    newPage: vi.fn().mockResolvedValue(pageMock),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const browserMock = {
    newContext: vi.fn().mockResolvedValue(contextMock),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { pageMock, contextMock, browserMock };
});

// Mock playwright at the top level
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(playwrightMocks.browserMock),
  }
}));

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({
    all: 'test output',
    stdout: 'test output',
    stderr: '',
    exitCode: 0,
  }),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1000 })
  }
}));

import { recordTerminal, recordBrowser, recordScenario } from '../src/recorder.js';
import { execa } from 'execa';

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

    it('should honor explicit zero delay for terminal steps', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      await recordTerminal([{ cmd: 'echo test', delay: 0 }], `${tempDir}/output.json`);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
      expect(vi.mocked(execa)).toHaveBeenCalledWith('bash', ['-c', 'echo test'], expect.any(Object));
      setTimeoutSpy.mockRestore();
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

    it('should honor explicit zero delay for browser steps', async () => {
      const result = await recordBrowser([{ action: 'wait', delay: 0 }], `${tempDir}/output.json`);
      expect(playwrightMocks.pageMock.waitForTimeout).toHaveBeenCalledWith(0);
      expect(result.frames[0].frameDelay).toBe(0);
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
