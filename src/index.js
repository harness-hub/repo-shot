#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import chalk from 'chalk';

import { detectContext, runLocal, runAction, commentOnPR } from './action.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf8')
);

const program = new Command();

program
  .name('repo-shot')
  .version(packageJson.version)
  .description('Generate automated demos and GIFs from scenarios')
  .addHelpCommand();

// run <scenario> - Execute scenario and generate artifacts
program
  .command('run <scenario>')
  .description('Run scenario and generate demo/GIF')
  .option('-o, --output <dir>', 'Output directory for artifacts', './artifacts')
  .option('--gif', 'Generate GIF (default: true)', true)
  .option('--no-optimize', 'Skip optimization step')
  .option('-t, --timeout <ms>', 'Timeout for recording (ms)', '60000')
  .option('-W, --width <px>', 'GIF/viewport width in pixels')
  .option('-H, --height <px>', 'GIF/viewport height in pixels')
  .action(async (scenario, opts) => {
    try {
      console.log(chalk.blue(`\n▶ Running scenario: ${scenario}`));
      
      const result = await runLocal(scenario, {
        output: opts.output,
        timeout: parseInt(opts.timeout, 10),
        width: opts.width ? parseInt(opts.width, 10) : undefined,
        height: opts.height ? parseInt(opts.height, 10) : undefined,
      });

      if (result.status === 'error') {
        console.error(chalk.red(`✗ Error: ${result.message}`));
        process.exit(1);
      }

      console.log(chalk.green(`✓ Demo generated successfully`));
      if (result.artifacts.length > 0) {
        console.log(chalk.gray(`\nArtifacts:`));
        result.artifacts.forEach((artifact) => {
          console.log(chalk.gray(`  • ${artifact}`));
        });
      }
      console.log(chalk.gray(`\nOutput: ${result.outputDir}\n`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to run scenario: ${error.message}`));
      process.exit(1);
    }
  });

// preview <scenario> - Run without optimization and show result
program
  .command('preview <scenario>')
  .description('Preview scenario result (unoptimized)')
  .option('-t, --timeout <ms>', 'Timeout for recording (ms)', '60000')
  .option('-W, --width <px>', 'GIF/viewport width in pixels')
  .option('-H, --height <px>', 'GIF/viewport height in pixels')
  .action(async (scenario, opts) => {
    try {
      console.log(chalk.blue(`\n▶ Previewing scenario: ${scenario}`));
      
      const result = await runLocal(scenario, {
        output: './preview',
        timeout: parseInt(opts.timeout, 10),
        width: opts.width ? parseInt(opts.width, 10) : undefined,
        height: opts.height ? parseInt(opts.height, 10) : undefined,
      });

      if (result.status === 'error') {
        console.error(chalk.red(`✗ Error: ${result.message}`));
        process.exit(1);
      }

      console.log(chalk.green(`✓ Preview generated`));
      if (result.artifacts.length > 0) {
        const gifArtifact = result.artifacts.find(a => a.endsWith('.gif'));
        if (gifArtifact) {
          console.log(chalk.gray(`\nOpening: ${gifArtifact}`));
          // Open the result (implementation depends on platform)
          console.log(chalk.gray(`Result: ${result.outputDir}\n`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to preview: ${error.message}`));
      process.exit(1);
    }
  });

// template - Template management subcommand
const templateCmd = program
  .command('template')
  .description('Manage templates');

templateCmd
  .command('list')
  .description('List available templates')
  .action(async () => {
    try {
      console.log(chalk.blue(`\n▶ Available templates:\n`));
      
      // Mock template list (can be replaced with real implementation)
      const templates = [
        { name: 'basic', description: 'Basic demo template' },
        { name: 'feature', description: 'Feature showcase template' },
        { name: 'github-action', description: 'GitHub Action workflow template' },
      ];

      templates.forEach(({ name, description }) => {
        console.log(chalk.cyan(`  ${name}`));
        console.log(chalk.gray(`    ${description}`));
      });
      
      console.log(chalk.gray(`\nUse: repo-shot template init <name>\n`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to list templates: ${error.message}`));
      process.exit(1);
    }
  });

templateCmd
  .command('init <name>')
  .description('Create template from scaffold')
  .option('-o, --output <file>', 'Output file for template', 'scenario.js')
  .action(async (name, opts) => {
    try {
      console.log(chalk.blue(`\n▶ Scaffolding template: ${name}`));
      
      const templates = {
        basic: `export default {
  name: '${name}',
  url: 'https://example.com',
  viewport: { width: 1280, height: 720 },
  steps: [
    { action: 'navigate', url: 'https://example.com' },
    { action: 'wait', duration: 2000 },
    { action: 'screenshot' },
  ],
};`,
        feature: `export default {
  name: '${name}',
  url: 'https://example.com',
  viewport: { width: 1280, height: 720 },
  steps: [
    { action: 'navigate', url: 'https://example.com' },
    { action: 'click', selector: 'button[data-feature]' },
    { action: 'wait', duration: 1000 },
    { action: 'screenshot' },
  ],
};`,
        'github-action': `export default {
  name: '${name}',
  url: process.env.DEMO_URL || 'https://example.com',
  viewport: { width: 1280, height: 720 },
  steps: [
    { action: 'navigate', url: '\${this.url}' },
    { action: 'wait', duration: 2000 },
    { action: 'screenshot' },
  ],
};`,
      };

      const template = templates[name];
      if (!template) {
        throw new Error(`Unknown template: ${name}`);
      }

      // In real implementation, write to file system
      console.log(chalk.green(`✓ Template scaffold:\n`));
      console.log(chalk.gray(template));
      console.log(chalk.gray(`\nSave to: ${opts.output}\n`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to create template: ${error.message}`));
      process.exit(1);
    }
  });

// action - Run as GitHub Action
program
  .command('action')
  .description('Run as GitHub Action (or dry-run locally)')
  .option('-s, --scenario <file>', 'Scenario file path', 'scenario.js')
  .option('--dry-run', 'Dry-run mode (show context, don\'t record)')
  .action(async (opts) => {
    try {
      const context = await detectContext();
      
      if (opts.dryRun) {
        console.log(chalk.blue(`\n▶ GitHub Actions dry-run\n`));
        console.log(chalk.cyan('Context:'));
        console.log(chalk.gray(JSON.stringify(context, null, 2)));
        console.log();
        return;
      }

      if (!context.isGitHub) {
        console.log(chalk.yellow(`\n⚠ Not running in GitHub Actions`));
        console.log(chalk.yellow(`Use --dry-run to test locally\n`));
        return;
      }

      console.log(chalk.blue(`\n▶ Running GitHub Action\n`));
      
      const result = await runAction(opts.scenario, {
        output: './artifacts',
        gif: true,
        optimize: true,
      });

      if (result.status === 'error') {
        console.error(chalk.red(`✗ Action failed: ${result.message}`));
        
        // Try to comment on PR
        if (context.token && context.prNumber) {
          try {
            await commentOnPR(context.token, {
              title: 'Demo Generation Failed',
              message: `Error: ${result.message}`,
            });
          } catch (e) {
            console.error(chalk.yellow(`Could not post comment: ${e.message}`));
          }
        }
        
        process.exit(1);
      }

      console.log(chalk.green(`✓ Action completed successfully`));
      
      // Post comment with artifacts
      if (context.token && context.prNumber && result.artifacts.length > 0) {
        try {
          await commentOnPR(context.token, {
            title: 'Demo Generated',
            artifacts: result.artifacts,
            url: `${context.serverUrl}/${context.repository}/actions/runs/${context.runId}`,
          });
          console.log(chalk.green(`✓ Posted comment to PR #${context.prNumber}`));
        } catch (e) {
          console.warn(chalk.yellow(`Could not post comment: ${e.message}`));
        }
      }
      
      console.log(chalk.gray(`\nArtifacts: ${result.artifacts.join(', ')}\n`));
    } catch (error) {
      console.error(chalk.red(`✗ Action failed: ${error.message}`));
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse(process.argv);
