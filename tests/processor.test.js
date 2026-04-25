import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

// Mock execa and fs/promises at the top level
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ stdout: '10' })
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    mkdtemp: vi.fn().mockImplementation(async (prefix) => `${prefix}mock`),
    readdir: vi.fn().mockResolvedValue([]),
    rmdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 1000 }),
    unlink: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(JSON.stringify({
      type: 'terminal',
      title: 'test',
      frames: [{ type: 'command', command: 'echo hello', output: 'hello' }],
      duration: 1,
    })),
  }
}));

import { trimVideo, addCaptions, convertToGif, optimizeOutput, exportVideo, THEMES } from '../src/processor.js';
import { execa } from 'execa';
import fs from 'fs/promises';

describe('processor.js', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `test-processor-${Date.now()}`);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trimVideo', () => {
    it('should throw when inPath is missing', async () => {
      await expect(trimVideo(null, `${tempDir}/out.mp4`)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when outPath is missing', async () => {
      await expect(trimVideo(`${tempDir}/in.mp4`, null)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when input file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'));
      await expect(trimVideo(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`)).rejects.toThrow('Input file not found');
    });

    it('should call mkdir to create output directory', async () => {
      await trimVideo(`${tempDir}/in.mp4`, `${tempDir}/output/out.mp4`);
      expect(vi.mocked(fs.mkdir)).toHaveBeenCalledWith(`${tempDir}/output`, { recursive: true });
    });

    it('should call execa with ffmpeg command', async () => {
      await trimVideo(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`);
      expect(vi.mocked(execa)).toHaveBeenCalledWith('ffmpeg', expect.any(Array));
    });

    it('should return correct shape with duration and path', async () => {
      const result = await trimVideo(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`);
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('path');
      expect(result.path).toBe(`${tempDir}/out.mp4`);
    });
  });

  describe('addCaptions', () => {
    it('should throw when inPath is missing', async () => {
      await expect(addCaptions(null, `${tempDir}/out.mp4`, [{ time: 0, text: 'test' }])).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when outPath is missing', async () => {
      await expect(addCaptions(`${tempDir}/in.mp4`, null, [{ time: 0, text: 'test' }])).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when captions is not an array', async () => {
      await expect(addCaptions(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`, null)).rejects.toThrow('captions must be a non-empty array');
    });

    it('should throw when captions array is empty', async () => {
      await expect(addCaptions(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`, [])).rejects.toThrow('captions must be a non-empty array');
    });

    it('should throw when input file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'));
      await expect(addCaptions(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`, [{ time: 0, text: 'test' }])).rejects.toThrow('Input file not found');
    });

    it('should return correct shape with path', async () => {
      const result = await addCaptions(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`, [{ time: 0, text: 'test' }]);
      expect(result).toHaveProperty('path');
      expect(result.path).toBe(`${tempDir}/out.mp4`);
    });
  });

  describe('convertToGif', () => {
    it('should throw when inPath is missing', async () => {
      await expect(convertToGif(null, `${tempDir}/out.gif`)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when outPath is missing', async () => {
      await expect(convertToGif(`${tempDir}/in.mp4`, null)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when input file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'));
      await expect(convertToGif(`${tempDir}/in.mp4`, `${tempDir}/out.gif`)).rejects.toThrow('Input file not found');
    });

    it('should call mkdir to create output directory', async () => {
      await convertToGif(`${tempDir}/in.mp4`, `${tempDir}/output/out.gif`);
      expect(vi.mocked(fs.mkdir)).toHaveBeenCalledWith(`${tempDir}/output`, { recursive: true });
    });

    it('should return correct shape with path and size', async () => {
      const result = await convertToGif(`${tempDir}/in.mp4`, `${tempDir}/out.gif`);
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('size');
      expect(result.path).toBe(`${tempDir}/out.gif`);
    });
  });

  describe('optimizeOutput', () => {
    it('should throw when inPath is missing', async () => {
      await expect(optimizeOutput(null, `${tempDir}/out.mp4`)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when outPath is missing', async () => {
      await expect(optimizeOutput(`${tempDir}/in.mp4`, null)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when input file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'));
      await expect(optimizeOutput(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`)).rejects.toThrow('Input file not found');
    });

    it('should call mkdir to create output directory', async () => {
      await optimizeOutput(`${tempDir}/in.mp4`, `${tempDir}/output/out.mp4`);
      expect(vi.mocked(fs.mkdir)).toHaveBeenCalledWith(`${tempDir}/output`, { recursive: true });
    });

    it('should return correct shape with originalSize and newSize', async () => {
      const result = await optimizeOutput(`${tempDir}/in.mp4`, `${tempDir}/out.mp4`);
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('newSize');
    });
  });

  describe('exportVideo', () => {
    it('should throw when inPath is missing', async () => {
      await expect(exportVideo(null, `${tempDir}/out.mp4`)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when outPath is missing', async () => {
      await expect(exportVideo(`${tempDir}/in.json`, null)).rejects.toThrow('inPath and outPath are required');
    });

    it('should throw when input file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'));
      await expect(exportVideo(`${tempDir}/in.json`, `${tempDir}/out.mp4`)).rejects.toThrow('Input file not found');
    });

    it('should throw when ffmpeg is not available', async () => {
      vi.mocked(execa).mockRejectedValueOnce(new Error('ffmpeg not found'));
      await expect(exportVideo(`${tempDir}/in.json`, `${tempDir}/out.mp4`)).rejects.toThrow('ffmpeg is required');
    });

    it('should call mkdir to create output directory', async () => {
      await exportVideo(`${tempDir}/in.json`, `${tempDir}/output/out.mp4`);
      expect(vi.mocked(fs.mkdir)).toHaveBeenCalledWith(`${tempDir}/output`, { recursive: true });
    });

    it('should return correct shape for mp4 output', async () => {
      const result = await exportVideo(`${tempDir}/in.json`, `${tempDir}/out.mp4`);
      expect(result).toHaveProperty('path', `${tempDir}/out.mp4`);
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('format', 'mp4');
      expect(result).toHaveProperty('frames');
    });

    it('should return correct shape for webm output', async () => {
      const result = await exportVideo(`${tempDir}/in.json`, `${tempDir}/out.webm`);
      expect(result).toHaveProperty('path', `${tempDir}/out.webm`);
      expect(result).toHaveProperty('format', 'webm');
    });

    it('should call ffmpeg with libvpx-vp9 codec for webm', async () => {
      vi.mocked(execa).mockClear();
      await exportVideo(`${tempDir}/in.json`, `${tempDir}/out.webm`);
      const ffmpegCalls = vi.mocked(execa).mock.calls.filter(c => c[0] === 'ffmpeg');
      const encodeCall = ffmpegCalls[ffmpegCalls.length - 1];
      expect(encodeCall[1]).toContain('libvpx-vp9');
    });

    it('should call ffmpeg with libx264 codec for mp4', async () => {
      vi.mocked(execa).mockClear();
      await exportVideo(`${tempDir}/in.json`, `${tempDir}/out.mp4`);
      const ffmpegCalls = vi.mocked(execa).mock.calls.filter(c => c[0] === 'ffmpeg');
      const encodeCall = ffmpegCalls[ffmpegCalls.length - 1];
      expect(encodeCall[1]).toContain('libx264');
    });

    it('should handle browser recording type', async () => {
      // Minimal valid 1x1 PNG (base64)
      const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        type: 'browser',
        title: 'browser-test',
        frames: [{ type: 'browser', screenshot: png1x1, frameDelay: 500 }],
        duration: 1,
        viewport: { width: 1280, height: 720 },
      }));
      const result = await exportVideo(`${tempDir}/in.json`, `${tempDir}/out.mp4`);
      expect(result).toHaveProperty('format', 'mp4');
    });
  });

  describe('THEMES', () => {
    it('should export all four themes', () => {
      expect(THEMES).toHaveProperty('dark');
      expect(THEMES).toHaveProperty('light');
      expect(THEMES).toHaveProperty('dracula');
      expect(THEMES).toHaveProperty('nord');
    });

    it('each theme should have all required colour keys', () => {
      const keys = ['background', 'chrome', 'title', 'prompt', 'muted', 'text', 'cursor'];
      for (const [name, theme] of Object.entries(THEMES)) {
        keys.forEach(k => {
          expect(theme, `${name}.${k}`).toHaveProperty(k);
          expect(typeof theme[k]).toBe('string');
        });
      }
    });

    it('trimVideo should pass theme to GIF renderer without error', async () => {
      // Terminal recording with nord theme
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        type: 'terminal',
        title: 'nord-test',
        frames: [{ type: 'command', command: 'echo hi', output: 'hi' }],
        duration: 1,
      }));
      await expect(
        trimVideo(`${tempDir}/in.json`, `${tempDir}/out.gif`, { theme: 'nord' })
      ).resolves.toHaveProperty('path');
    });

    it('trimVideo should pass theme to GIF renderer for dracula', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        type: 'terminal',
        title: 'dracula-test',
        frames: [{ type: 'command', command: 'echo hi', output: 'hi' }],
        duration: 1,
      }));
      await expect(
        trimVideo(`${tempDir}/in.json`, `${tempDir}/out.gif`, { theme: 'dracula' })
      ).resolves.toHaveProperty('path');
    });

    it('trimVideo should fall back to dark theme for unknown theme name', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify({
        type: 'terminal',
        title: 'unknown-theme-test',
        frames: [{ type: 'command', command: 'ls', output: 'file.txt' }],
        duration: 1,
      }));
      await expect(
        trimVideo(`${tempDir}/in.json`, `${tempDir}/out.gif`, { theme: 'nonexistent' })
      ).resolves.toHaveProperty('path');
    });

    it('exportVideo should accept theme option', async () => {
      const result = await exportVideo(`${tempDir}/in.json`, `${tempDir}/out.mp4`, { theme: 'light' });
      expect(result).toHaveProperty('format', 'mp4');
    });
  });
});
