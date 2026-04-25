import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { chromium } from 'playwright';
import { runLocal } from '../src/action.js';

describe('repo-shot integration', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `repo-shot-integration-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('generates a non-empty terminal GIF from a scenario', async () => {
    const scenarioPath = path.join(tempDir, 'scenario.yml');
    fs.writeFileSync(scenarioPath, `scenario:
  name: Integration Terminal
  steps:
    - type: shell
      command: echo "integration works"
      caption: "Run a deterministic shell command"
      delay: 1
`);

    const result = await runLocal(scenarioPath, {
      output: path.join(tempDir, 'artifacts'),
      width: 480,
      height: 270,
      name: 'terminal-check',
    });

    expect(result.status).toBe('success');
    expect(result.artifacts).toHaveLength(1);
    expect(path.basename(result.artifacts[0])).toBe('terminal-check.gif');
    expect(fs.statSync(result.artifacts[0]).size).toBeGreaterThan(0);
  });

  it('generates a browser GIF from a local HTML fixture when Chromium is installed', async () => {
    try {
      const browser = await chromium.launch({ headless: true });
      await browser.close();
    } catch {
      return;
    }

    const htmlPath = path.join(tempDir, 'page.html');
    fs.writeFileSync(htmlPath, `<!doctype html>
<html>
  <body>
    <input id="email">
    <button id="submit" type="button">Submit</button>
    <div id="result"></div>
    <script>
      document.querySelector('#submit').addEventListener('click', () => {
        document.querySelector('#result').textContent = 'Done';
      });
    </script>
  </body>
</html>
`);

    const scenarioPath = path.join(tempDir, 'browser.yml');
    fs.writeFileSync(scenarioPath, `scenario:
  name: Local Browser Integration
  steps:
    - type: navigate
      url: page.html
      caption: "Open local page"
      delay: 1
    - type: fill
      selector: "#email"
      text: "test@example.com"
      caption: "Fill field"
      delay: 1
    - type: click
      selector: "#submit"
      caption: "Submit"
      delay: 1
    - type: assert
      selector: "#result"
      caption: "Check result"
      delay: 1
`);

    const result = await runLocal(scenarioPath, {
      output: path.join(tempDir, 'browser-artifacts'),
      width: 480,
      height: 270,
      name: 'browser-check',
    });

    expect(result.status).toBe('success');
    expect(result.artifacts).toHaveLength(1);
    expect(path.basename(result.artifacts[0])).toBe('browser-check-browser.gif');
    expect(fs.statSync(result.artifacts[0]).size).toBeGreaterThan(0);
  });
});
