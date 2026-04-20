import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { listTemplates, getTemplate, scaffoldTemplate } from '../src/templates.js';

describe('templates.js', () => {
  let tempDir;
  let fixtures = [];

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `test-templates-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    fixtures.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // ignore
      }
    });
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore
    }
  });

  describe('listTemplates', () => {
    it('should return an array', () => {
      const templates = listTemplates();
      expect(Array.isArray(templates)).toBe(true);
    });

    it('should contain cli-demo', () => {
      const templates = listTemplates();
      expect(templates).toContain('cli-demo');
    });

    it('should contain web-ui-flow', () => {
      const templates = listTemplates();
      expect(templates).toContain('web-ui-flow');
    });

    it('should contain install-hello', () => {
      const templates = listTemplates();
      expect(templates).toContain('install-hello');
    });

    it('should return exactly 3 templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBe(3);
    });
  });

  describe('getTemplate', () => {
    it('should throw when name is null', () => {
      expect(() => getTemplate(null)).toThrow('Template name must be a non-empty string');
    });

    it('should throw when name is undefined', () => {
      expect(() => getTemplate(undefined)).toThrow('Template name must be a non-empty string');
    });

    it('should throw when name is empty string', () => {
      expect(() => getTemplate('')).toThrow('Template name must be a non-empty string');
    });

    it('should throw when name is not a string', () => {
      expect(() => getTemplate(123)).toThrow('Template name must be a non-empty string');
    });

    it('should return YAML string for cli-demo', () => {
      const template = getTemplate('cli-demo');
      expect(typeof template).toBe('string');
      expect(template).toContain('name: CLI Demo');
    });

    it('should return YAML string for web-ui-flow', () => {
      const template = getTemplate('web-ui-flow');
      expect(typeof template).toBe('string');
      expect(template).toContain('name: Web UI Flow');
    });

    it('should return YAML string for install-hello', () => {
      const template = getTemplate('install-hello');
      expect(typeof template).toBe('string');
      expect(template).toContain('name: Install Hello World');
    });

    it('should throw with available templates message when unknown template', () => {
      expect(() => getTemplate('unknown-template')).toThrow('Template "unknown-template" not found. Available templates: cli-demo, web-ui-flow, install-hello');
    });
  });

  describe('scaffoldTemplate', () => {
    it('should throw when name is null', () => {
      const destPath = path.join(tempDir, 'scenario.yaml');
      expect(() => scaffoldTemplate(null, destPath)).toThrow('Template name must be a non-empty string');
    });

    it('should throw when name is empty', () => {
      const destPath = path.join(tempDir, 'scenario.yaml');
      expect(() => scaffoldTemplate('', destPath)).toThrow('Template name must be a non-empty string');
    });

    it('should throw when dest is null', () => {
      expect(() => scaffoldTemplate('cli-demo', null)).toThrow('Destination path must be a non-empty string');
    });

    it('should throw when dest is empty', () => {
      expect(() => scaffoldTemplate('cli-demo', '')).toThrow('Destination path must be a non-empty string');
    });

    it('should throw for unknown template', () => {
      const destPath = path.join(tempDir, 'scenario.yaml');
      expect(() => scaffoldTemplate('unknown-template', destPath)).toThrow('Template "unknown-template" not found');
    });

    it('should create parent directories if they do not exist', () => {
      const destPath = path.join(tempDir, 'subdir', 'nested', 'scenario.yaml');
      scaffoldTemplate('cli-demo', destPath);
      fixtures.push(destPath);

      expect(fs.existsSync(destPath)).toBe(true);
      expect(fs.existsSync(path.dirname(destPath))).toBe(true);
    });

    it('should write correct template content to destination', () => {
      const destPath = path.join(tempDir, 'scenario.yaml');
      scaffoldTemplate('cli-demo', destPath);
      fixtures.push(destPath);

      const content = fs.readFileSync(destPath, 'utf-8');
      expect(content).toContain('name: CLI Demo');
      expect(content).toContain('output: cli-output.png');
    });

    it('should write web-ui-flow template correctly', () => {
      const destPath = path.join(tempDir, 'web.yaml');
      scaffoldTemplate('web-ui-flow', destPath);
      fixtures.push(destPath);

      const content = fs.readFileSync(destPath, 'utf-8');
      expect(content).toContain('name: Web UI Flow');
      expect(content).toContain('https://example.com');
    });

    it('should write install-hello template correctly', () => {
      const destPath = path.join(tempDir, 'install.yaml');
      scaffoldTemplate('install-hello', destPath);
      fixtures.push(destPath);

      const content = fs.readFileSync(destPath, 'utf-8');
      expect(content).toContain('name: Install Hello World');
      expect(content).toContain('npm init -y');
    });

    it('should handle relative paths', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tempDir);
        scaffoldTemplate('cli-demo', 'scenario.yaml');
        fixtures.push(path.join(tempDir, 'scenario.yaml'));

        expect(fs.existsSync('scenario.yaml')).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
