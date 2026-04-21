import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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

  if (!data.output || typeof data.output !== 'string') {
    throw new Error('Scenario must have an "output" field (string)');
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

    if (!step.type && !step.command) {
      throw new Error(`Step ${index} must have either "type" or "command" field`);
    }

    if (step.type && typeof step.type !== 'string') {
      throw new Error(`Step ${index}: "type" must be a string`);
    }

    if (step.command && typeof step.command !== 'string') {
      throw new Error(`Step ${index}: "command" must be a string`);
    }
  });
}
