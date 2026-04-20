/**
 * GitHub Actions integration module
 * - Reads GitHub environment context
 * - Runs the full demo pipeline in action context
 * - Posts comments with artifacts to PRs
 */

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
 * Run full pipeline in GitHub Actions context
 * Loads scenario, records, processes, writes step outputs
 * @param {string} scenarioPath - Path to scenario file
 * @param {Object} opts - Options {output, gif, optimize}
 * @returns {Promise<Object>} {status, artifacts, outputs}
 */
export async function runAction(scenarioPath, opts = {}) {
  const context = detectContext();
  
  if (!context.isGitHub) {
    throw new Error('Not running in GitHub Actions context');
  }
  
  if (!context.token) {
    throw new Error('GITHUB_TOKEN not available');
  }

  try {
    // Import pipeline modules
    const { readScenario } = await import('./scenario.js').catch(() => ({
      readScenario: null,
    }));
    
    const { recordSession } = await import('./recorder.js').catch(() => ({
      recordSession: null,
    }));
    
    const { processRecording } = await import('./processor.js').catch(() => ({
      processRecording: null,
    }));

    if (!readScenario || !recordSession || !processRecording) {
      return {
        status: 'error',
        message: 'Pipeline modules not available',
        artifacts: [],
      };
    }

    const outputDir = opts.output || `${context.workspace}/artifacts`;
    
    // 1. Read scenario
    const scenario = await readScenario(scenarioPath);
    
    // 2. Record session
    const recordingPath = await recordSession(scenario, {
      headless: true,
      timeout: opts.timeout || 60000,
    });
    
    // 3. Process recording
    const artifacts = await processRecording(recordingPath, {
      output: outputDir,
      gif: opts.gif !== false,
      optimize: opts.optimize !== false,
    });

    // 4. Set GitHub Actions step outputs
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
