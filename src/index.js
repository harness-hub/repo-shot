#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import chalk from 'chalk';

import { detectContext, runLocal, runAction, commentOnPR } from './action.js';
import { runDoctor } from './doctor.js';
import { openPath } from './open.js';
import { getTemplate, listTemplates, scaffoldTemplate } from './templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf8')
);

const program = new Command();

function parsePositiveInt(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseFormat(format) {
  const normalized = String(format || 'gif').toLowerCase();
  if (!['gif', 'mp4', 'webm'].includes(normalized)) {
    throw new Error('format must be one of: gif, mp4, webm');
  }
  return normalized;
}

function printArtifacts(result) {
  if (result.artifacts.length > 0) {
    console.log(chalk.gray(`\nArtifacts:`));
    result.artifacts.forEach((artifact) => {
      console.log(chalk.gray(`  • ${artifact}`));
    });
  }
  console.log(chalk.gray(`\nOutput: ${result.outputDir}\n`));
}

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
  .option('-f, --format <fmt>', 'Output format: gif, mp4, or webm', 'gif')
  .option('-n, --name <name>', 'Base name for generated artifact files')
  .option('--open', 'Open the generated artifact when complete')
  .option('--theme <name>', 'Terminal theme: dark, light, dracula, nord', 'dark')
  .action(async (scenario, opts) => {
    try {
      console.log(chalk.blue(`\n▶ Running scenario: ${scenario}`));

      const format = parseFormat(opts.format);
      if (format !== 'gif') {
        console.log(chalk.gray(`MP4/WebM export requires ffmpeg. Run "repo-shot doctor" if export fails.`));
      }
      
      const result = await runLocal(scenario, {
        output: opts.output,
        timeout: parsePositiveInt(opts.timeout, 'timeout'),
        width: opts.width ? parsePositiveInt(opts.width, 'width') : undefined,
        height: opts.height ? parsePositiveInt(opts.height, 'height') : undefined,
        format,
        name: opts.name,
        theme: opts.theme,
      });

      if (result.status === 'error') {
        console.error(chalk.red(`✗ Error: ${result.message}`));
        process.exit(1);
      }

      console.log(chalk.green(`✓ Demo generated successfully`));
      printArtifacts(result);

      if (opts.open && result.artifacts[0]) {
        openPath(result.artifacts[0]);
      }
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
  .option('-f, --format <fmt>', 'Output format: gif, mp4, or webm', 'gif')
  .option('-n, --name <name>', 'Base name for generated artifact files')
  .option('--open', 'Open the generated artifact when complete')
  .option('--theme <name>', 'Terminal theme: dark, light, dracula, nord', 'dark')
  .action(async (scenario, opts) => {
    try {
      console.log(chalk.blue(`\n▶ Previewing scenario: ${scenario}`));
      
      const result = await runLocal(scenario, {
        output: './preview',
        timeout: parsePositiveInt(opts.timeout, 'timeout'),
        width: opts.width ? parsePositiveInt(opts.width, 'width') : undefined,
        height: opts.height ? parsePositiveInt(opts.height, 'height') : undefined,
        format: parseFormat(opts.format),
        name: opts.name,
        theme: opts.theme,
      });

      if (result.status === 'error') {
        console.error(chalk.red(`✗ Error: ${result.message}`));
        process.exit(1);
      }

      console.log(chalk.green(`✓ Preview generated`));
      if (result.artifacts.length > 0) {
        const artifact = result.artifacts[0];
        console.log(chalk.gray(`\nResult: ${artifact}`));
        console.log(chalk.gray(`Output: ${result.outputDir}\n`));
        if (opts.open) {
          openPath(artifact);
        }
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to preview: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a starter scenario.yml')
  .option('-t, --template <name>', 'Template to use', 'cli-demo')
  .option('-o, --output <file>', 'Output scenario file', 'scenario.yml')
  .option('--force', 'Overwrite an existing scenario file')
  .action(async (opts) => {
    try {
      scaffoldTemplate(opts.template, opts.output, { force: opts.force });
      console.log(chalk.green(`✓ Created ${opts.output}`));
      console.log(chalk.gray(`Run: repo-shot run ${opts.output}\n`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to initialize scenario: ${error.message}`));
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
      
      const templates = listTemplates();

      templates.forEach((name) => {
        const firstLine = getTemplate(name).split('\n').find((line) => line.trim().startsWith('description:'));
        const description = firstLine ? firstLine.split(':').slice(1).join(':').trim() : 'Scenario template';
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
  .option('-o, --output <file>', 'Output file for template', 'scenario.yml')
  .option('--force', 'Overwrite an existing file')
  .action(async (name, opts) => {
    try {
      console.log(chalk.blue(`\n▶ Scaffolding template: ${name}`));
      scaffoldTemplate(name, opts.output, { force: opts.force });
      console.log(chalk.green(`✓ Template written to ${opts.output}\n`));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to create template: ${error.message}`));
      process.exit(1);
    }
  });

templateCmd
  .command('show <name>')
  .description('Print a built-in template')
  .action(async (name) => {
    try {
      console.log(getTemplate(name));
    } catch (error) {
      console.error(chalk.red(`✗ Failed to show template: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check local dependencies and environment')
  .option('-o, --output <dir>', 'Directory to check for write access', './artifacts')
  .action(async (opts) => {
    try {
      const result = await runDoctor({ output: opts.output });

      console.log(chalk.blue(`\n▶ repo-shot doctor\n`));
      result.checks.forEach((check) => {
        const icon = check.ok ? '✓' : check.optional ? '!' : '✗';
        const color = check.ok ? chalk.green : check.optional ? chalk.yellow : chalk.red;
        console.log(color(`${icon} ${check.name}`));
        console.log(chalk.gray(`  ${check.detail}`));
        if (!check.ok && check.fix) {
          console.log(chalk.gray(`  Fix: ${check.fix}`));
        }
      });

      console.log();
      if (!result.ok) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Doctor failed: ${error.message}`));
      process.exit(1);
    }
  });

// action - Run as GitHub Action
program
  .command('action')
  .description('Run as GitHub Action (or dry-run locally)')
  .option('-s, --scenario <file>', 'Scenario file path', 'scenario.yml')
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
