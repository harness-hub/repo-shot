import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const SUPPORTED_STEP_TYPES = new Set([
  'shell',
  'command',
  'sequence',
  'navigate',
  'click',
  'type',
  'fill',
  'wait',
  'screenshot',
  'assert',
]);

export function loadScenario(filePath) {
  if (!filePath) {
    throw new Error('Scenario path is required');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Scenario file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  let data;
  try {
    if (ext === '.json') {
      data = JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      data = yaml.load(content);
    } else {
      throw new Error(`Unsupported file format: ${ext}. Use .json, .yaml, or .yml`);
    }
  } catch (err) {
    throw new Error(`Failed to parse scenario file: ${err.message}`);
  }

  // Unwrap if data has a 'scenario' wrapper key
  if (data && data.scenario && typeof data.scenario === 'object') {
    data = data.scenario;
  }

  validateScenario(data);
  return data;
}

export function validateScenario(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Scenario must be a valid object');
  }

  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Scenario must have a "name" field (string)');
  }

  if (data.output !== undefined && typeof data.output !== 'string') {
    throw new Error('Scenario "output" field must be a string when provided');
  }

  if (!Array.isArray(data.steps)) {
    throw new Error('Scenario must have a "steps" field (array)');
  }

  if (data.steps.length === 0) {
    throw new Error('Scenario "steps" array must not be empty');
  }

  data.steps.forEach((step, index) => {
    if (!step || typeof step !== 'object') {
      throw new Error(`Step ${index} must be a valid object`);
    }

    if (!step.type && !step.command && !step.commands) {
      throw new Error(`Step ${index} must have "type", "command", or "commands" field`);
    }

    if (step.type && typeof step.type !== 'string') {
      throw new Error(`Step ${index}: "type" must be a string`);
    }

    if (step.type && !SUPPORTED_STEP_TYPES.has(step.type)) {
      const supported = Array.from(SUPPORTED_STEP_TYPES).join(', ');
      throw new Error(`Step ${index}: unsupported type "${step.type}". Supported types: ${supported}`);
    }

    if (step.command && typeof step.command !== 'string') {
      throw new Error(`Step ${index}: "command" must be a string`);
    }

    if (step.commands !== undefined) {
      if (!Array.isArray(step.commands) || step.commands.length === 0) {
        throw new Error(`Step ${index}: "commands" must be a non-empty array`);
      }

      step.commands.forEach((command, commandIndex) => {
        if (typeof command !== 'string' || command.length === 0) {
          throw new Error(`Step ${index}: "commands[${commandIndex}]" must be a non-empty string`);
        }
      });
    }

    if ((step.type === 'shell' || step.type === 'command') && !step.command && !step.commands) {
      throw new Error(`Step ${index}: terminal steps must include "command" or "commands"`);
    }

    if (step.type === 'sequence' && !step.commands) {
      throw new Error(`Step ${index}: sequence steps must include "commands"`);
    }

    if (step.type === 'navigate' && (typeof step.url !== 'string' || step.url.length === 0)) {
      throw new Error(`Step ${index}: navigate steps must include "url"`);
    }

    if ((step.type === 'click' || step.type === 'fill' || step.type === 'type' || step.type === 'assert') &&
        (typeof step.selector !== 'string' || step.selector.length === 0)) {
      throw new Error(`Step ${index}: ${step.type} steps must include "selector"`);
    }

    if ((step.type === 'fill' || step.type === 'type') &&
        step.text !== undefined &&
        typeof step.text !== 'string') {
      throw new Error(`Step ${index}: "text" must be a string when provided`);
    }
  });
}
