/**
 * GitHub Actions integration module
 * - Reads GitHub environment context
 * - Runs the full demo pipeline in action context
 * - Posts comments with artifacts to PRs
 */

import fs from 'fs/promises';

/**
 * Detect GitHub Actions context from environment variables
 * @returns {Object} Context object with GitHub metadata
 */
export async function detectContext() {
  const isGitHub = !!process.env.GITHUB_ACTIONS;
  
  return {
    isGitHub,
    eventName: process.env.GITHUB_EVENT_NAME || null,
    eventPath: process.env.GITHUB_EVENT_PATH || null,
    actor: process.env.GITHUB_ACTOR || null,
    repository: process.env.GITHUB_REPOSITORY || null,
    ref: process.env.GITHUB_REF || null,
    sha: process.env.GITHUB_SHA || null,
    token: process.env.GITHUB_TOKEN || null,
    serverUrl: process.env.GITHUB_SERVER_URL || 'https://github.com',
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    workspace: process.env.GITHUB_WORKSPACE || process.cwd(),
    runId: process.env.GITHUB_RUN_ID || null,
    runNumber: process.env.GITHUB_RUN_NUMBER || null,
    prNumber: await extractPRNumber(),
  };
}

/**
 * Extract PR number from GitHub event or ref
 * @returns {number|null}
 */
async function extractPRNumber() {
  // From pull_request event
  if (process.env.GITHUB_EVENT_PATH) {
    try {
      const { readFileSync } = await import('fs');
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      return event.pull_request?.number || null;
    } catch {
      return null;
    }
  }
  
  // From ref: refs/pull/123/merge
  const ref = process.env.GITHUB_REF || '';
  const match = ref.match(/refs\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Run pipeline locally (works anywhere, not just GitHub Actions)
 * Loads scenario, records, processes, returns artifacts
 * @param {string} scenarioPath - Path to scenario file
 * @param {Object} opts - Options {output, gif, optimize, timeout}
 * @returns {Promise<Object>} {status, artifacts, outputDir, message}
 */
export async function runLocal(scenarioPath, opts = {}) {
  try {
    // Import pipeline modules
    const { loadScenario } = await import('./scenario.js').catch(() => ({
      loadScenario: null,
    }));
    
    const { recordTerminal, recordBrowser } = await import('./recorder.js').catch(() => ({
      recordTerminal: null,
      recordBrowser: null,
    }));
    
    const { trimVideo } = await import('./processor.js').catch(() => ({
      trimVideo: null,
    }));

    if (!loadScenario || !recordTerminal || !recordBrowser || !trimVideo) {
      return {
        status: 'error',
        message: 'Pipeline modules not available',
        artifacts: [],
        outputDir: opts.output || './artifacts',
      };
    }

    const outputDir = opts.output || './artifacts';
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // 1. Load scenario
    const scenario = await loadScenario(scenarioPath);

    // Resolve viewport / resolution
    const scenarioViewport = scenario.metadata?.browser_config?.viewport;
    const width  = opts.width  || scenarioViewport?.width  || 1280;
    const height = opts.height || scenarioViewport?.height || 720;
    const viewport = { width, height };

    // Classify steps
    const BROWSER_TYPES = new Set(['navigate', 'click', 'type', 'fill', 'screenshot', 'assert', 'wait']);
    const browserSteps = scenario.steps.filter(s => BROWSER_TYPES.has(s.type));
    const terminalSteps = scenario.steps
      .filter(s => s.command || s.commands)
      .map(s => Array.isArray(s.commands)
        ? { cmd: s.commands.join(' && '), delay: s.delay || 1000 }
        : { cmd: s.command, delay: s.delay || 1000 }
      );

    if (terminalSteps.length === 0 && browserSteps.length === 0) {
      return {
        status: 'error',
        message: 'No executable steps found in scenario',
        artifacts: [],
        outputDir,
      };
    }

    const artifacts = [];

    // 2a. Terminal recording
    if (terminalSteps.length > 0) {
      const recordingData = await recordTerminal(terminalSteps, `${outputDir}/recording.json`);
      const gifPath = `${outputDir}/demo.gif`;
      await trimVideo(recordingData.path, gifPath, { width, height });
      artifacts.push(gifPath);
    }

    // 2b. Browser recording
    if (browserSteps.length > 0) {
      // Map YAML step types to recorder action format
      const recorderSteps = browserSteps.map(s => ({
        action: s.type === 'navigate' ? 'goto' : s.type,
        target: s.url || s.selector || null,
        text: s.text || s.value || null,
        caption: s.caption || '',
        delay: s.delay || 800,
        timeout: s.timeout,
      }));

      const browserRecording = await recordBrowser(
        recorderSteps,
        `${outputDir}/browser-recording.json`,
        { viewport }
      );
      const browserGifPath = `${outputDir}/browser-demo.gif`;
      await trimVideo(browserRecording.path, browserGifPath, { width, height });
      artifacts.push(browserGifPath);
    }

    return {
      status: 'success',
      artifacts,
      outputDir,
      message: `Demo generated successfully: ${artifacts.length} artifact(s)`,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      error,
      artifacts: [],
      outputDir: opts.output || './artifacts',
    };
  }
}

/**
 * Run full pipeline in GitHub Actions context
 * Loads scenario, records, processes, writes step outputs
 * @param {string} scenarioPath - Path to scenario file
 * @param {Object} opts - Options {output, gif, optimize, timeout}
 * @returns {Promise<Object>} {status, artifacts, outputs}
 */
export async function runAction(scenarioPath, opts = {}) {
  const context = await detectContext();
  
  if (!context.isGitHub) {
    throw new Error('Not running in GitHub Actions context');
  }
  
  if (!context.token) {
    throw new Error('GITHUB_TOKEN not available');
  }

  try {
    // Import pipeline modules
    const { loadScenario } = await import('./scenario.js').catch(() => ({
      loadScenario: null,
    }));
    
    const { recordTerminal } = await import('./recorder.js').catch(() => ({
      recordTerminal: null,
    }));
    
    const { trimVideo } = await import('./processor.js').catch(() => ({
      trimVideo: null,
    }));

    if (!loadScenario || !recordTerminal || !trimVideo) {
      return {
        status: 'error',
        message: 'Pipeline modules not available',
        artifacts: [],
      };
    }

    const outputDir = opts.output || `${context.workspace}/artifacts`;
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // 1. Load scenario
    const scenario = await loadScenario(scenarioPath);
    
    // 2. Transform scenario steps to recorder format
    const commands = scenario.steps
      .filter(step => step.command || step.commands)
      .map(step => {
        // Handle sequence steps with multiple commands
        if (Array.isArray(step.commands)) {
          return { cmd: step.commands.join(' && '), delay: step.delay || 1000 };
        }
        // Handle single command steps
        return { cmd: step.command, delay: step.delay || 1000 };
      });
    
    if (commands.length === 0) {
      return {
        status: 'error',
        message: 'No executable commands found in scenario steps',
        artifacts: [],
      };
    }
    
    // 3. Record session
    const recordingData = await recordTerminal(commands, `${outputDir}/recording.json`);
    
    // 4. Process recording (convert to GIF)
    const gifPath = `${outputDir}/demo.gif`;
    const result = await trimVideo(recordingData.path, gifPath, {
      silenceThreshold: opts.silenceThreshold || -40,
      silenceDuration: opts.silenceDuration || 0.5,
    });

    const artifacts = [gifPath];

    // 5. Set GitHub Actions step outputs
    if (artifacts.length > 0) {
      await setOutput('artifacts', artifacts.join(','));
      await setOutput('artifact-count', String(artifacts.length));
      
      const gifArtifact = artifacts.find(a => a.endsWith('.gif'));
      if (gifArtifact) {
        await setOutput('gif', gifArtifact);
      }
    }

    return {
      status: 'success',
      artifacts,
      context,
      outputDir,
    };
  } catch (error) {
    // Log error to action output
    console.error(`::error::${error.message}`);
    
    return {
      status: 'error',
      message: error.message,
      error,
      artifacts: [],
    };
  }
}

/**
 * Post comment on PR with artifact links
 * @param {string} token - GitHub token
 * @param {string|Object} body - Comment body or {artifacts, ...}
 * @returns {Promise<Object>} Comment response
 */
export async function commentOnPR(token, body) {
  const context = detectContext();
  
  if (!context.prNumber) {
    throw new Error('Not a pull request context');
  }
  
  if (!context.repository) {
    throw new Error('Repository not found in context');
  }

  const [owner, repo] = context.repository.split('/');
  const commentBody = typeof body === 'string' ? body : formatCommentBody(body);

  try {
    // Use GitHub API to post comment
    const response = await fetch(
      `${context.apiUrl}/repos/${owner}/${repo}/issues/${context.prNumber}/comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: commentBody }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to post comment: ${error.message}`);
    throw error;
  }
}

/**
 * Format comment body from artifacts
 * @param {Object} data - {artifacts, title, url, ...}
 * @returns {string}
 */
function formatCommentBody(data) {
  let body = '## repo-shot Demo Generated\n\n';
  
  if (data.title) {
    body += `### ${data.title}\n\n`;
  }
  
  if (Array.isArray(data.artifacts) && data.artifacts.length > 0) {
    body += '### Artifacts\n';
    data.artifacts.forEach((artifact) => {
      const url = data.url ? `${data.url}/${artifact}` : artifact;
      body += `- [${artifact}](${url})\n`;
    });
  }
  
  if (data.message) {
    body += `\n${data.message}\n`;
  }
  
  return body;
}

/**
 * Set GitHub Actions step output (mock or real)
 * @param {string} name
 * @param {string} value
 */
async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  } else {
    console.log(`::set-output name=${name}::${value}`);
  }
}
