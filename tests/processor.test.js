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
    stat: vi.fn().mockResolvedValue({ size: 1000 }),
    unlink: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  }
}));

import { trimVideo, addCaptions, convertToGif, optimizeOutput } from '../src/processor.js';
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
});
