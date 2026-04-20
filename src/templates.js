import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const TEMPLATES = {
  'cli-demo': `name: CLI Demo
output: cli-output.png
steps:
  - type: command
    command: echo "Starting CLI demonstration"
    delay: 500
  - type: command
    command: ls -la
    delay: 1000
  - type: command
    command: echo "Demo complete!"
    delay: 500`,

  'web-ui-flow': `name: Web UI Flow
output: web-ui-flow.png
steps:
  - type: navigation
    command: goto https://example.com
    delay: 2000
  - type: interaction
    command: click button[type="submit"]
    delay: 1000
  - type: screenshot
    command: full
    delay: 500`,

  'install-hello': `name: Install Hello World
output: install-demo.png
steps:
  - type: command
    command: npm init -y
    delay: 1000
  - type: command
    command: npm install express
    delay: 2000
  - type: command
    command: echo "Installation complete!"
    delay: 500`
};

export function listTemplates() {
  return Object.keys(TEMPLATES);
}

export function getTemplate(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Template name must be a non-empty string');
  }

  const template = TEMPLATES[name];
  if (!template) {
    const available = listTemplates().join(', ');
    throw new Error(`Template "${name}" not found. Available templates: ${available}`);
  }

  return template;
}

export function scaffoldTemplate(name, dest) {
  if (!name || typeof name !== 'string') {
    throw new Error('Template name must be a non-empty string');
  }

  if (!dest || typeof dest !== 'string') {
    throw new Error('Destination path must be a non-empty string');
  }

  const template = getTemplate(name);
  const destDir = path.dirname(dest);

  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(dest, template, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to write template to ${dest}: ${err.message}`);
  }
}
