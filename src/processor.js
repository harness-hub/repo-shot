import { execa } from 'execa';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import GifEncoder from 'gif-encoder-2';

const DEFAULTS = { width: 1280, height: 720 };
const FONT_SIZE = 13;
const LINE_HEIGHT = 18;
const PADDING = 14;
const HEADER_HEIGHT = 36;
const MAX_COLS = 90;

/**
 * Draw a single terminal frame onto a canvas context.
 */
function drawTerminalFrame(ctx, cumulativeOutput, title, width, height) {
  const maxLines = Math.floor((height - HEADER_HEIGHT - PADDING) / LINE_HEIGHT);

  // Background
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, width, height);

  // Window chrome strip
  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, 0, width, HEADER_HEIGHT);

  // Traffic-light dots
  const dots = ['#ff5f57', '#febc2e', '#28c840'];
  dots.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(16 + i * 20, HEADER_HEIGHT / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // Title
  ctx.fillStyle = '#8b949e';
  ctx.font = `bold ${FONT_SIZE}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(title || 'repo-shot', width / 2, HEADER_HEIGHT / 2 + 5);
  ctx.textAlign = 'left';

  // Terminal output
  ctx.font = `${FONT_SIZE}px monospace`;
  const allLines = cumulativeOutput.split('\n');
  const visibleLines = allLines.slice(-maxLines);

  visibleLines.forEach((line, i) => {
    const y = HEADER_HEIGHT + PADDING + i * LINE_HEIGHT;
    const text = line.substring(0, MAX_COLS);

    // Color prompt lines differently
    if (text.startsWith('$ ')) {
      ctx.fillStyle = '#79c0ff';
    } else if (text.startsWith('  ') || text.startsWith('\t')) {
      ctx.fillStyle = '#8b949e';
    } else {
      ctx.fillStyle = '#e6edf3';
    }

    ctx.fillText(text, PADDING, y);
  });

  // Blinking cursor on last line
  const lastLineY = HEADER_HEIGHT + PADDING + visibleLines.length * LINE_HEIGHT - 4;
  ctx.fillStyle = '#58a6ff';
  ctx.fillRect(PADDING, lastLineY, 8, 2);
}

/**
 * Render browser recording (base64 screenshots) as an animated GIF.
 */
async function createGifFromBrowserRecording(recording, width, height) {
  const encoder = new GifEncoder(width, height, 'neuquant', true);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  for (const frame of recording.frames) {
    if (frame.type !== 'browser' || !frame.screenshot) continue;

    const imgBuf = Buffer.from(frame.screenshot, 'base64');
    const img = await loadImage(imgBuf);

    // Draw screenshot scaled to target dimensions
    ctx.drawImage(img, 0, 0, width, height);

    encoder.setDelay(frame.frameDelay || 800);
    encoder.addFrame(ctx.getImageData(0, 0, width, height).data);
  }

  // Final hold frame
  encoder.setDelay(2500);
  encoder.addFrame(ctx.getImageData(0, 0, width, height).data);

  encoder.finish();
  return encoder.out.getData();
}

/**
 * Render terminal recording frames as an animated GIF.
 */
async function createGifFromRecording(recording, width, height) {
  const encoder = new GifEncoder(width, height, 'neuquant', true);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const title = recording.title || 'repo-shot';
  let cumulativeOutput = '';

  for (const frame of recording.frames) {
    if (frame.type !== 'command') continue;

    // Frame: show prompt + command
    cumulativeOutput += `$ ${frame.command}\n`;
    drawTerminalFrame(ctx, cumulativeOutput, title, width, height);
    encoder.setDelay(400);
    encoder.addFrame(ctx.getImageData(0, 0, width, height).data);

    // Frame: show command output
    if (frame.output) {
      cumulativeOutput += frame.output + '\n';
      drawTerminalFrame(ctx, cumulativeOutput, title, width, height);
      encoder.setDelay(frame.error ? 1500 : 800);
      encoder.addFrame(ctx.getImageData(0, 0, width, height).data);
    }
  }

  // Final hold frame
  drawTerminalFrame(ctx, cumulativeOutput, title, width, height);
  encoder.setDelay(2500);
  encoder.addFrame(ctx.getImageData(0, 0, width, height).data);

  encoder.finish();
  return encoder.out.getData();
}

/**
 * Process recording into output format (mock implementation)
 * For terminal recordings, creates a demo file with captured output
 * @param {string} inPath - Input recording file path
 * @param {string} outPath - Output file path
 * @param {Object} opts - Options
 * @returns {Promise<{duration: number, path: string}>}
 */
export async function trimVideo(inPath, outPath, opts = {}) {
  if (!inPath || !outPath) {
    throw new Error('inPath and outPath are required');
  }

  try {
    // Check if input file exists
    try {
      await fs.access(inPath);
    } catch {
      throw new Error(`Input file not found: ${inPath}`);
    }

    // Create output directory
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    // For JSON recordings (terminal or browser), render to GIF or video
    if (inPath.endsWith('.json')) {
      // Delegate to exportVideo for mp4/webm output
      if (outPath.endsWith('.mp4') || outPath.endsWith('.webm')) {
        return exportVideo(inPath, outPath, opts);
      }

      const recordingContent = await fs.readFile(inPath, 'utf-8');
      const recording = JSON.parse(recordingContent);

      const width = opts.width || (recording.viewport?.width) || DEFAULTS.width;
      const height = opts.height || (recording.viewport?.height) || DEFAULTS.height;

      const gifData = recording.type === 'browser'
        ? await createGifFromBrowserRecording(recording, width, height)
        : await createGifFromRecording(recording, width, height);

      await fs.writeFile(outPath, gifData);

      return {
        duration: recording.duration,
        path: outPath,
      };
    }

    // For video files, use ffmpeg to create GIF (if ffmpeg is available)
    try {
      await execa('which', ['ffmpeg']).catch(() => {
        throw new Error('ffmpeg not found');
      });

      // Use ffmpeg to convert to GIF
      await execa('ffmpeg', [
        '-i',
        inPath,
        '-vf',
        'fps=10',
        '-y',
        outPath,
      ]);

      return {
        duration: 0,
        path: outPath,
      };
    } catch (ffmpegErr) {
      // If ffmpeg is not available, create a placeholder
      console.warn(`ffmpeg not available: ${ffmpegErr.message}. Creating placeholder.`);
      await fs.writeFile(outPath, '', 'utf-8');
      return {
        duration: 0,
        path: outPath,
      };
    }
  } catch (err) {
    throw new Error(`Failed to process recording: ${err.message}`);
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

/**
 * Export a JSON recording to MP4 or WebM using canvas frame rendering + ffmpeg.
 * @param {string} inPath - Path to JSON recording file
 * @param {string} outPath - Output path (.mp4 or .webm)
 * @param {Object} opts - Options { width, height, fps, crf }
 * @returns {Promise<{path: string, size: number, format: string, frames: number}>}
 */
export async function exportVideo(inPath, outPath, opts = {}) {
  if (!inPath || !outPath) {
    throw new Error('inPath and outPath are required');
  }

  try {
    await fs.access(inPath);
  } catch {
    throw new Error(`Input file not found: ${inPath}`);
  }

  const format = outPath.endsWith('.webm') ? 'webm' : 'mp4';
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  // Verify ffmpeg is available
  try {
    await execa('ffmpeg', ['-version']);
  } catch {
    throw new Error(
      'ffmpeg is required for MP4/WebM export. ' +
      'Install it: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)'
    );
  }

  const recordingContent = await fs.readFile(inPath, 'utf-8');
  const recording = JSON.parse(recordingContent);

  const width = opts.width || recording.viewport?.width || DEFAULTS.width;
  const height = opts.height || recording.viewport?.height || DEFAULTS.height;
  const fps = opts.fps || 10;
  const msPerFrame = 1000 / fps;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-shot-frames-'));

  try {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    let frameIndex = 0;

    async function writeFrame(delayMs) {
      const count = Math.max(1, Math.round(delayMs / msPerFrame));
      const pngBuffer = canvas.toBuffer('image/png');
      for (let i = 0; i < count; i++) {
        const framePath = path.join(tmpDir, `frame${String(frameIndex++).padStart(6, '0')}.png`);
        await fs.writeFile(framePath, pngBuffer);
      }
    }

    if (recording.type === 'browser') {
      for (const frame of recording.frames) {
        if (frame.type !== 'browser' || !frame.screenshot) continue;
        const imgBuf = Buffer.from(frame.screenshot, 'base64');
        const img = await loadImage(imgBuf);
        ctx.drawImage(img, 0, 0, width, height);
        await writeFrame(frame.frameDelay || 800);
      }
      await writeFrame(2500);
    } else {
      const title = recording.title || 'repo-shot';
      let cumulativeOutput = '';
      for (const frame of recording.frames) {
        if (frame.type !== 'command') continue;
        cumulativeOutput += `$ ${frame.command}\n`;
        drawTerminalFrame(ctx, cumulativeOutput, title, width, height);
        await writeFrame(400);
        if (frame.output) {
          cumulativeOutput += frame.output + '\n';
          drawTerminalFrame(ctx, cumulativeOutput, title, width, height);
          await writeFrame(frame.error ? 1500 : 800);
        }
      }
      drawTerminalFrame(ctx, cumulativeOutput, title, width, height);
      await writeFrame(2500);
    }

    if (frameIndex === 0) {
      throw new Error('No frames to encode');
    }

    const ffmpegArgs = [
      '-framerate', String(fps),
      '-i', path.join(tmpDir, 'frame%06d.png'),
    ];

    if (format === 'webm') {
      ffmpegArgs.push(
        '-c:v', 'libvpx-vp9',
        '-pix_fmt', 'yuv420p',
        '-b:v', '0',
        '-crf', String(opts.crf || 33),
        '-an',
        '-y', outPath
      );
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-crf', String(opts.crf || 23),
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-an',
        '-movflags', '+faststart',
        '-y', outPath
      );
    }

    await execa('ffmpeg', ffmpegArgs);

    const stats = await fs.stat(outPath);
    return {
      path: outPath,
      size: stats.size,
      format,
      frames: frameIndex,
    };
  } finally {
    // Clean up temp frame files
    try {
      const files = await fs.readdir(tmpDir);
      await Promise.all(files.map(f => fs.unlink(path.join(tmpDir, f))));
      await fs.rmdir(tmpDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}
