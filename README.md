# repo-shot

> **Turn any CLI workflow into a polished GIF — automatically.**

![repo-shot demo](./docs/demo.gif)

---

## Why repo-shot?

Your README demos are stale. Your docs go out of sync. Your screenshots lie.
**repo-shot** captures real terminal sessions and browser interactions, turns them
into optimized GIFs, and automatically posts them to your PRs. Write once in YAML,
record once, GIF it forever—no manual screen recording, no outdated images, no
excuses.

---

## Prerequisites

Before installing `repo-shot`, ensure you have:

- **Node.js 18+** — [Download](https://nodejs.org/)
- **ffmpeg** — Required for video processing
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `apt-get install ffmpeg`
  - Windows: [Download](https://ffmpeg.org/download.html)
- **gifsicle** *(optional)* — For advanced GIF optimization
  - macOS: `brew install gifsicle`
  - Ubuntu/Debian: `apt-get install gifsicle`
  - Windows: [Download](https://www.lcdf.org/gifsicle/)

---

## Installation

Install globally via npm:

```bash
npm install -g repo-shot
```

Or run directly without installation:

```bash
npx repo-shot --version
```

---

## Quickstart

### 1. Create a scenario file

Create a `scenario.yml` to describe your demo:

```yaml
scenario:
  name: Install Dependencies
  description: Installing npm packages for a Node.js project
  
  steps:
    - type: shell
      command: npm install
      caption: "Installing dependencies..."
      output_capture: true
    
    - type: shell
      command: npm test
      caption: "Running tests"
      output_capture: true
```

### 2. Run the scenario

```bash
repo-shot run scenario.yml
```

Your GIF will be saved to `./artifacts/` by default. Use `--output` to customize:

```bash
repo-shot run scenario.yml --output ./my-demos
```

### 3. Preview before committing

Generate an unoptimized version for quick feedback:

```bash
repo-shot preview scenario.yml
```

---

## Features

### 🖥️ Terminal Recording

- **Node-PTY integration** — Real pseudo-terminal capture with authentic output
- **Multi-step scripts** — Chain complex shell commands with `type: sequence`
- **Output capture** — Preserve command output in the GIF frame

### 🌐 Browser Recording

- **Playwright-powered** — Automate any web UI (click, type, navigate)
- **Viewport control** — Record at any resolution (mobile, tablet, desktop)
- **Interactions** — Click buttons, submit forms, test workflows

### 🎬 GIF Optimization

- **FFmpeg conversion** — Video → GIF with tunable quality
- **gifsicle compression** — Ultra-small file sizes (optional)
- **Configurable speed** — Adjust playback speed to match your narrative

### 🤖 GitHub Actions Integration

- **Auto-comment PRs** — Post GIFs directly to pull requests
- **Environment detection** — Works seamlessly in CI/CD
- **Artifact linking** — Build URLs point to Actions artifacts

### 📝 Flexible Scenario Format

- **YAML & JSON** — Choose your syntax
- **Captions & metadata** — Add context and difficulty levels
- **Validation** — Built-in schema checking

### 🏷️ Interactive Captions

- Display overlay text during playback
- Highlight key moments in your demo

---

## Examples

### Example 1: CLI Demo Scenario

```yaml
scenario:
  name: CLI Demo - Basic Commands
  description: Demonstrates basic shell operations
  captions:
    intro: "Let's explore some basic commands"
    demo: "Running commands in the terminal"
    conclusion: "That's how you use the CLI!"
  
  steps:
    - type: shell
      command: echo "Welcome to repo-shot"
      caption: "Echo a welcome message"
      output_capture: true
    
    - type: shell
      command: pwd && ls -la
      caption: "Show current directory and files"
      output_capture: true
    
    - type: sequence
      caption: "Create and verify a file"
      commands:
        - echo "Hello from repo-shot" > demo.txt
        - cat demo.txt
        - rm demo.txt
      output_capture: true
```

### Example 2: Browser UI Demo

```yaml
scenario:
  name: Feature Walkthrough
  description: Interactive web UI demo
  
  steps:
    - type: navigate
      url: https://example.com
      caption: "Opening the app"
    
    - type: click
      selector: "button[data-feature]"
      caption: "Clicking the feature button"
    
    - type: screenshot
      caption: "Feature is now active"
```

### Example 3: GitHub Actions Workflow

Add this to your `.github/workflows/demo.yml`:

```yaml
name: Generate Demo

on:
  pull_request:
    paths:
      - 'scenario.yml'
      - 'src/**'

jobs:
  demo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install ffmpeg
        run: |
          sudo apt-get update
          sudo apt-get install -y ffmpeg
      
      - name: Install repo-shot
        run: npm install -g repo-shot
      
      - name: Generate demo
        run: repo-shot action --scenario scenario.yml
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Example 4: Template Scaffolding

Bootstrap a new scenario from a template:

```bash
# List available templates
repo-shot template list

# Create a basic template
repo-shot template init basic --output my-scenario.js

# Create a feature showcase template
repo-shot template init feature --output feature-demo.js
```

---

## CLI Commands

```bash
# Run a scenario and generate a GIF
repo-shot run <scenario>
  --output <dir>         Output directory (default: ./artifacts)
  --no-optimize          Skip gifsicle optimization
  --timeout <ms>         Recording timeout in milliseconds (default: 60000)

# Preview a scenario without optimization
repo-shot preview <scenario>
  --timeout <ms>         Recording timeout in milliseconds

# List available templates
repo-shot template list

# Create a template scaffold
repo-shot template init <name>
  --output <file>        Save to file (default: scenario.js)

# Run as GitHub Action
repo-shot action
  --scenario <file>      Path to scenario file (default: scenario.yml)
  --dry-run              Test locally without recording
```

---

## Roadmap

- [ ] **MP4 Export** — In addition to GIFs, generate MP4 videos with audio
- [ ] **Custom Themes** — Syntax highlighting, custom fonts, dark mode
- [ ] **Cloud Upload** — Auto-upload artifacts to S3, Cloudinary, or Vercel
- [ ] **VS Code Extension** — Record scenarios directly from the editor
- [ ] **Multi-language Captions** — i18n support for global docs
- [ ] **Batch Processing** — Run multiple scenarios in one command
- [ ] **Interactive Mode** — Click-through scenario builder UI

---

## Contributing

We love contributions! Here's how to get started:

1. **Fork** this repository
2. **Create a branch** for your feature:

   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes** and test thoroughly
4. **Commit** with a clear message:

   ```bash
   git commit -m "feat: add your awesome feature"
   ```

5. **Push** and open a **Pull Request**

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
```

---

## License

MIT — See [LICENSE](./LICENSE) for details.

---

**Made with ❤️ by developers, for developers.**
