import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.resolve(__dirname, '../templates');

function templateFileName(name) {
  return name.endsWith('.yml') || name.endsWith('.yaml') ? name : `${name}.yml`;
}

export function listTemplates() {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    return [];
  }

  return fs.readdirSync(TEMPLATE_DIR)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .map((file) => path.basename(file, path.extname(file)))
    .sort();
}

export function getTemplate(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Template name must be a non-empty string');
  }

  const templatePath = path.join(TEMPLATE_DIR, templateFileName(name));
  if (!fs.existsSync(templatePath)) {
    const available = listTemplates().join(', ');
    throw new Error(`Template "${name}" not found. Available templates: ${available}`);
  }

  return fs.readFileSync(templatePath, 'utf-8');
}

export function scaffoldTemplate(name, dest, opts = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('Template name must be a non-empty string');
  }

  if (!dest || typeof dest !== 'string') {
    throw new Error('Destination path must be a non-empty string');
  }

  const template = getTemplate(name);
  const destDir = path.dirname(dest);

  try {
    if (fs.existsSync(dest) && !opts.force) {
      throw new Error(`Destination already exists: ${dest}. Use --force to overwrite.`);
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(dest, template, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to write template to ${dest}: ${err.message}`);
  }
}
