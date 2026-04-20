import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

/**
 * Trims dead frames from video using ffmpeg
 * @param {string} inPath - Input video file path
 * @param {string} outPath - Output video file path
 * @param {Object} opts - Options (silence threshold, frame detection, etc.)
 * @returns {Promise<{duration: number, path: string}>}
 */
export async function trimVideo(inPath, outPath, opts = {}) {
  if (!inPath || !outPath) {
    throw new Error('inPath and outPath are required');
  }

  // Check if input file exists
  try {
    await fs.access(inPath);
  } catch {
    throw new Error(`Input file not found: ${inPath}`);
  }

  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });

  const silenceThreshold = opts.silenceThreshold || -40;
  const silenceDuration = opts.silenceDuration || 0.5;

  try {
    // Use ffmpeg to detect and remove silent sections
    const result = await execa('ffmpeg', [
      '-i',
      inPath,
      '-af',
      `silenceremove=1:${silenceThreshold}dB:${silenceDuration}`,
      '-y',
      outPath,
    ]);

    // Get video duration
    const probeResult = await execa('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1:noprint_wrappers=1',
      outPath,
    ]).catch(() => ({ stdout: '0' }));

    const duration = parseFloat(probeResult.stdout) || 0;

    return {
      duration,
      path: outPath,
    };
  } catch (err) {
    throw new Error(`Failed to trim video: ${err.message}`);
  }
}

/**
 * Adds text captions to video using ffmpeg drawtext
 * @param {string} inPath - Input video file path
 * @param {string} outPath - Output video file path
 * @param {Array<{time: number|string, text: string}>} captions - Captions with timestamps
 * @returns {Promise<{path: string}>}
 */
export async function addCaptions(inPath, outPath, captions) {
  if (!inPath || !outPath) {
    throw new Error('inPath and outPath are required');
  }
  if (!Array.isArray(captions) || captions.length === 0) {
    throw new Error('captions must be a non-empty array');
  }

  // Check if input file exists
  try {
    await fs.access(inPath);
  } catch {
    throw new Error(`Input file not found: ${inPath}`);
  }

  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });

  try {
    // Build drawtext filter with multiple captions
    let drawFilter = '';

    for (let i = 0; i < captions.length; i++) {
      const caption = captions[i];
      const timeSeconds =
        typeof caption.time === 'string'
          ? parseFloat(caption.time)
          : caption.time;

      const escapedText = caption.text.replace(/'/g, "\\'");

      if (i > 0) {
        drawFilter += ',';
      }

      drawFilter += `drawtext=fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=24:fontcolor=white:text='${escapedText}':x=10:y=10:enable='between(t\\,${timeSeconds}\\,${timeSeconds + 3})'`;
    }

    const args = ['-i', inPath, '-vf', drawFilter, '-y', outPath];

    await execa('ffmpeg', args);

    return {
      path: outPath,
    };
  } catch (err) {
    throw new Error(`Failed to add captions: ${err.message}`);
  }
}

/**
 * Converts video to optimized GIF using ffmpeg and gifsicle
 * @param {string} inPath - Input video file path
 * @param {string} outPath - Output GIF file path
 * @param {Object} opts - Options (fps, scale, lossy, colors)
 * @returns {Promise<{path: string, size: number}>}
 */
export async function convertToGif(inPath, outPath, opts = {}) {
  if (!inPath || !outPath) {
    throw new Error('inPath and outPath are required');
  }

  // Check if input file exists
  try {
    await fs.access(inPath);
  } catch {
    throw new Error(`Input file not found: ${inPath}`);
  }

  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });

  const fps = opts.fps || 10;
  const scale = opts.scale || '800:-1';
  const colors = opts.colors || 256;

  try {
    // Generate palette first for better quality
    const paletteFile = outPath.replace('.gif', '_palette.png');
    await execa('ffmpeg', [
      '-i',
      inPath,
      '-vf',
      `fps=${fps},scale=${scale}:flags=lanczos,palettegen=max_colors=${colors}`,
      '-y',
      paletteFile,
    ]);

    // Generate GIF with palette
    await execa('ffmpeg', [
      '-i',
      inPath,
      '-i',
      paletteFile,
      '-filter_complex',
      `[0:v]fps=${fps},scale=${scale}:flags=lanczos[v];[v][1:p]paletteuse=dither=sierra2_4a`,
      '-y',
      outPath,
    ]);

    // Optimize with gifsicle if available
    try {
      const lossy = opts.lossy !== undefined ? opts.lossy : 80;
      await execa('gifsicle', [
        '-i',
        outPath,
        '--optimize=3',
        `--lossy=${lossy}`,
        '-o',
        outPath,
      ]);
    } catch {
      // gifsicle may not be installed, continue with unoptimized GIF
    }

    // Clean up palette file
    await fs.unlink(paletteFile).catch(() => {});

    // Get file size
    const stats = await fs.stat(outPath);

    return {
      path: outPath,
      size: stats.size,
    };
  } catch (err) {
    throw new Error(`Failed to convert to GIF: ${err.message}`);
  }
}

/**
 * Optimizes video output: scales to 800px wide and compresses
 * @param {string} inPath - Input video file path
 * @param {string} outPath - Output video file path
 * @param {Object} opts - Options (crf, scale, codec)
 * @returns {Promise<{path: string, originalSize: number, newSize: number}>}
 */
export async function optimizeOutput(inPath, outPath, opts = {}) {
  if (!inPath || !outPath) {
    throw new Error('inPath and outPath are required');
  }

  // Check if input file exists
  try {
    await fs.access(inPath);
  } catch {
    throw new Error(`Input file not found: ${inPath}`);
  }

  const outDir = path.dirname(outPath);
  await fs.mkdir(outDir, { recursive: true });

  const crf = opts.crf || 28; // Quality (0-51, lower is better, 28 is default)
  const scale = opts.scale || '800:-1'; // Scale to 800px wide, maintain aspect ratio
  const codec = opts.codec || 'libx264';

  try {
    // Get original file size
    const inStats = await fs.stat(inPath);
    const originalSize = inStats.size;

    // Encode with optimization
    await execa('ffmpeg', [
      '-i',
      inPath,
      '-vf',
      `scale=${scale}`,
      '-c:v',
      codec,
      '-crf',
      crf.toString(),
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-y',
      outPath,
    ]);

    // Get new file size
    const outStats = await fs.stat(outPath);
    const newSize = outStats.size;

    return {
      path: outPath,
      originalSize,
      newSize,
    };
  } catch (err) {
    throw new Error(`Failed to optimize output: ${err.message}`);
  }
}
