import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateScenario, loadScenario } from '../src/scenario.js';

describe('scenario.js', () => {
  let tempDir;
  let fixtures = [];

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `test-scenario-${Date.now()}`);
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
        // ignore cleanup errors
      }
    });
    fixtures = [];
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });

  describe('validateScenario', () => {
    it('should throw when data is null', () => {
      expect(() => validateScenario(null)).toThrow('Scenario must be a valid object');
    });

    it('should throw when data is undefined', () => {
      expect(() => validateScenario(undefined)).toThrow('Scenario must be a valid object');
    });

    it('should throw when name is missing', () => {
      expect(() => validateScenario({ output: 'out.png', steps: [{ type: 'command' }] })).toThrow('Scenario must have a "name" field');
    });

    it('should throw when name is not a string', () => {
      expect(() => validateScenario({ name: 123, output: 'out.png', steps: [{ type: 'command' }] })).toThrow('Scenario must have a "name" field');
    });

    it('should pass when output is missing', () => {
      expect(() => validateScenario({ name: 'Test', steps: [{ type: 'command', command: 'echo hello' }] })).not.toThrow();
    });

    it('should throw when output is not a string', () => {
      expect(() => validateScenario({ name: 'Test', output: 123, steps: [{ type: 'command', command: 'echo hello' }] })).toThrow('Scenario "output" field must be a string');
    });

    it('should throw when steps is not an array', () => {
      expect(() => validateScenario({ name: 'Test', output: 'out.png', steps: {} })).toThrow('Scenario must have a "steps" field (array)');
    });

    it('should throw when steps is empty', () => {
      expect(() => validateScenario({ name: 'Test', output: 'out.png', steps: [] })).toThrow('Scenario "steps" array must not be empty');
    });

    it('should throw when step is not an object', () => {
      expect(() => validateScenario({ name: 'Test', output: 'out.png', steps: ['not-an-object'] })).toThrow('Step 0 must be a valid object');
    });

    it('should throw when step has neither type nor command', () => {
      expect(() => validateScenario({ name: 'Test', output: 'out.png', steps: [{ delay: 100 }] })).toThrow('Step 0 must have "type", "command", or "commands" field');
    });

    it('should throw when step type is not a string', () => {
      expect(() => validateScenario({ name: 'Test', output: 'out.png', steps: [{ type: 123 }] })).toThrow('Step 0: "type" must be a string');
    });

    it('should throw when step command is not a string', () => {
      expect(() => validateScenario({ name: 'Test', output: 'out.png', steps: [{ command: 123 }] })).toThrow('Step 0: "command" must be a string');
    });

    it('should throw for unsupported step type', () => {
      expect(() => validateScenario({ name: 'Test', steps: [{ type: 'navigation', url: 'https://example.com' }] })).toThrow('unsupported type "navigation"');
    });

    it('should throw when navigate step is missing url', () => {
      expect(() => validateScenario({ name: 'Test', steps: [{ type: 'navigate' }] })).toThrow('navigate steps must include "url"');
    });

    it('should throw when assert step is missing selector', () => {
      expect(() => validateScenario({ name: 'Test', steps: [{ type: 'assert' }] })).toThrow('assert steps must include "selector"');
    });

    it('should throw when sequence step is missing commands', () => {
      expect(() => validateScenario({ name: 'Test', steps: [{ type: 'sequence' }] })).toThrow('sequence steps must include "commands"');
    });

    it('should pass with valid data', () => {
      const validData = {
        name: 'Valid Scenario',
        output: 'output.png',
        steps: [{ type: 'command', command: 'echo hello' }]
      };
      expect(() => validateScenario(validData)).not.toThrow();
    });
  });

  describe('loadScenario', () => {
    it('should throw when filePath is empty', () => {
      expect(() => loadScenario('')).toThrow('Scenario path is required');
    });

    it('should throw when filePath is null', () => {
      expect(() => loadScenario(null)).toThrow('Scenario path is required');
    });

    it('should throw when file does not exist', () => {
      expect(() => loadScenario('/nonexistent/path/scenario.json')).toThrow('Scenario file not found');
    });

    it('should load and parse valid JSON file', () => {
      const jsonPath = path.join(tempDir, 'scenario.json');
      const data = { name: 'JSON Test', output: 'out.png', steps: [{ type: 'command', command: 'ls' }] };
      fs.writeFileSync(jsonPath, JSON.stringify(data));
      fixtures.push(jsonPath);

      const loaded = loadScenario(jsonPath);
      expect(loaded.name).toBe('JSON Test');
      expect(loaded.output).toBe('out.png');
    });

    it('should load and parse valid YAML file', () => {
      const yamlPath = path.join(tempDir, 'scenario.yaml');
      const yaml = `name: YAML Test
output: out.png
steps:
  - type: command
    command: ls`;
      fs.writeFileSync(yamlPath, yaml);
      fixtures.push(yamlPath);

      const loaded = loadScenario(yamlPath);
      expect(loaded.name).toBe('YAML Test');
      expect(loaded.output).toBe('out.png');
    });

    it('should load and parse valid YML file', () => {
      const ymlPath = path.join(tempDir, 'scenario.yml');
      const yaml = `name: YML Test
output: out.png
steps:
  - type: command
    command: ls`;
      fs.writeFileSync(ymlPath, yaml);
      fixtures.push(ymlPath);

      const loaded = loadScenario(ymlPath);
      expect(loaded.name).toBe('YML Test');
    });

    it('should throw for unsupported file extension', () => {
      const txtPath = path.join(tempDir, 'scenario.txt');
      fs.writeFileSync(txtPath, 'some content');
      fixtures.push(txtPath);

      expect(() => loadScenario(txtPath)).toThrow('Unsupported file format');
    });

    it('should validate loaded data', () => {
      const jsonPath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(jsonPath, JSON.stringify({ name: 'Missing steps' }));
      fixtures.push(jsonPath);

      expect(() => loadScenario(jsonPath)).toThrow('Scenario must have a "steps" field');
    });
  });
});
