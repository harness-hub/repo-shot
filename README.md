# repo-shot

<div align="center">

<img src="./docs/logo.png" alt="repo-shot" width="120" />

**Stop recording demos by hand. Write YAML once, GIF forever.**

**Turn any CLI workflow or browser session into a polished GIF — automatically.**


[![npm version](https://img.shields.io/npm/v/readme-repo-shot?color=ff6b6b&style=flat-square)](https://www.npmjs.com/package/readme-repo-shot)
[![license](https://img.shields.io/npm/l/readme-repo-shot?color=4ecdc4&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org/)
[![playwright](https://img.shields.io/badge/powered%20by-Playwright-2EAD33?style=flat-square)](https://playwright.dev/)


![repo-shot terminal demo](./docs/demo-terminal.gif)

> Write a YAML file. Run one command. Ship a perfect GIF to your README, PR, or docs — forever.

[**Quickstart**](#quickstart) · [**Templates**](#template-library) · [**Examples**](#examples) · [**CLI Reference**](#cli-reference)

</div>

---

## The Problem

Your README screenshots are **stale**. Your demo GIFs are **outdated**. Your docs team is
running OBS and Gifski manually every sprint. You paste in a screenshot that was taken 3
months ago and still shows the old logo.

**repo-shot fixes that.**

Define your demo in YAML once. Every time you push, it re-records and regenerates — real
commands, real browser, real output. No lies, no stale screenshots, no busywork.

---

## What It Looks Like

### Terminal Demos

![CLI demo GIF](./docs/demo-cli.gif)

> Record real shell commands — `npm install`, API calls, file operations, piped output.

### Browser Demos

![Browser demo GIF](./docs/demo-browser.gif)

> Automate any web UI — login flows, dropdowns, form submission, checkout journeys.

### Mobile Viewport

![Mobile demo GIF](./docs/demo-mobile.gif)

> Record at 375×667 or any resolution. Desktop, tablet, mobile — all covered.

---

## Quickstart

**Prerequisites:** Node.js 18+

```bash
npm install -g readme-repo-shot
repo-shot init
repo-shot run scenario.yml --open
```

The npm package is `readme-repo-shot`; the installed command is `repo-shot`.

You can also try it without installing globally:

```bash
npx readme-repo-shot run templates/cli-demo.yml
```

Or create `scenario.yml` manually:

```yaml
scenario:
  name: My First Demo
  steps:
    - type: shell
      command: echo "Hello, repo-shot!"
      caption: "Running my first command"
    - type: shell
      command: ls -la
      caption: "Listing files"
```

Run it:

```bash
repo-shot run scenario.yml
# ✓ Demo generated successfully
# Artifacts:
#   • ./artifacts/demo.gif
```

That's it. Open `./artifacts/demo.gif` and drop it in your README.

---

## Features

<table>
<tr>
<td width="50%">

### 🖥️ Terminal Recording
Record actual shell commands with authentic output — not fake typed animations.
Supports pipes, multi-step sequences, and complex commands like `curl | jq`.

</td>
<td width="50%">

### 🌐 Browser Automation
Playwright-powered browser recording. Navigate, click, fill forms, take screenshots.
Works with any site — no special setup needed.

</td>
</tr>
<tr>
<td width="50%">

### 🎬 Pure JS GIFs
No ffmpeg. No external dependencies. Canvas-based rendering with macOS-style terminal
UI. Generate GIFs at any resolution.

</td>
<td width="50%">

### 🤖 GitHub Actions
Generate demo artifacts in CI with a bundled composite action or copy-pasteable
workflow. Every pull request can rebuild the README GIFs from source.

</td>
</tr>
<tr>
<td width="50%">

### 📐 Any Resolution
Pass `--width` and `--height` flags, or set viewport in YAML. 1280×720, 375×667
mobile, 1920×1080 full-HD — your call.

</td>
<td width="50%">

### 📦 9 Ready Templates
Terminal, browser, mobile, e-commerce, API testing, and a deterministic local
browser fixture — copy one and customize.

</td>
</tr>
</table>

---

## Examples

### Example 1 — CLI Demo

![CLI example GIF](./docs/example-cli.gif)

```bash
repo-shot run templates/cli-demo.yml
```

```yaml
scenario:
  name: CLI Demo
  steps:
    - type: shell
      command: echo "Hello from repo-shot"
      caption: "Say hello"
    - type: shell
      command: ls -la
      caption: "List project files"
```

---

### Example 2 — API Testing with `curl | jq`

![API testing GIF](./docs/example-api.gif)

```bash
repo-shot run templates/api-testing.yml
```

```yaml
scenario:
  name: API Testing
  steps:
    - type: shell
      command: curl -s https://jsonplaceholder.typicode.com/posts/1 | jq '.title'
      caption: "Fetch a post title"
```

---

### Example 3 — Browser Login Flow

![Browser login GIF](./docs/example-browser.gif)

```bash
repo-shot run templates/form-submission.yml
```

```yaml
scenario:
  name: Login Flow
  steps:
    - type: navigate
      url: https://the-internet.herokuapp.com/login
      caption: "Open login page"
    - type: fill
      selector: "#username"
      text: "tomsmith"
      caption: "Enter username"
    - type: fill
      selector: "#password"
      text: "SuperSecretPassword!"
      caption: "Enter password"
    - type: click
      selector: "button.radius"
      caption: "Submit"
    - type: screenshot
      caption: "Logged in!"
```

---

### Example 4 — E-Commerce Checkout

![E-commerce checkout GIF](./docs/example-ecommerce.gif)

```bash
repo-shot run templates/ecommerce-checkout.yml
```

Full flow: login → add to cart → proceed to checkout → fill shipping → confirm.

---

### Example 5 — Mobile Responsive at 375×667

![Mobile responsive GIF](./docs/example-mobile.gif)

```bash
repo-shot run templates/mobile-responsive.yml
```

Records at iPhone SE dimensions. Shows exactly what mobile users see.

---

### Example 6 — Mixed Terminal + Browser

```yaml
scenario:
  name: Full Deploy Workflow
  steps:
    # Terminal: build the project
    - type: shell
      command: npm run build
      caption: "Build project"

    # Browser: verify in the UI
    - type: navigate
      url: http://localhost:3000
      caption: "Open in browser"
    - type: screenshot
      caption: "Build deployed!"
```

Generates two GIFs: `demo.gif` (terminal) and `browser-demo.gif` (browser).

---

### Example 7 — GitHub Actions

Use the bundled action from your workflow:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: OWNER/repo-shot@v1
    with:
      scenario: scenario.yml
      output: artifacts
      format: gif
      name: readme-demo
```

A ready-made workflow is also included at [`.github/workflows/repo-shot.yml`](.github/workflows/repo-shot.yml). It runs on pull requests and can be triggered manually.

```yaml
# .github/workflows/repo-shot.yml
name: repo-shot Demonstration

on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:

jobs:
  repo-shot-demo:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm install -g readme-repo-shot
      - run: npx playwright install chromium --with-deps

      # Record terminal demo
      - run: repo-shot run templates/cli-demo.yml --output artifacts/cli-demo

      # Record browser demo
      - run: repo-shot run templates/local-browser.yml --output artifacts/local-browser

      # Upload GIFs as workflow artifacts
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: repo-shot-artifacts
          path: artifacts/
          if-no-files-found: error
```

**Key points:**
- Scenario paths are relative to the repo root
- `npx playwright install chromium --with-deps` installs the browser runtime needed in CI
- GIFs are available under the **Artifacts** tab of the Actions run for 30 days

To use this in your own repo, copy `.github/workflows/repo-shot.yml` and adjust the scenario paths to point at your own files.

---

## Template Library

9 production-ready templates, including one browser flow that runs against a bundled local HTML fixture.

### Terminal Templates

| Template | What It Does | Command |
|---|---|---|
| `cli-demo.yml` | Echo, ls, file ops | `repo-shot run templates/cli-demo.yml` |
| `install-hello.yml` | npm install + verification | `repo-shot run templates/install-hello.yml` |
| `api-testing.yml` | REST API calls with `curl \| jq` | `repo-shot run templates/api-testing.yml` |

### Browser Templates

| Template | What It Does | Site |
|---|---|---|
| `web-ui-flow.yml` | Dropdown interaction | the-internet.herokuapp.com |
| `form-submission.yml` | Login form with validation | the-internet.herokuapp.com |
| `dashboard-analytics.yml` | Add/remove elements | the-internet.herokuapp.com |
| `ecommerce-checkout.yml` | Login → cart → checkout | saucedemo.com |
| `local-browser.yml` | Local form flow | bundled fixture |
| `mobile-responsive.yml` | Mobile 375×667 shopping flow | saucedemo.com |

Use any template as-is or as a starting point:

```bash
cp templates/ecommerce-checkout.yml my-shop-demo.yml
# Edit selectors for your own site
repo-shot run my-shop-demo.yml
```

---

## CLI Reference

```
repo-shot run <scenario>        Record and generate GIF/MP4/WebM
  --output <dir>                Output directory       (default: ./artifacts)
  --format <fmt>                Output format: gif, mp4, webm (default: gif)
  --name <name>                 Base artifact name     (default: demo)
  --open                        Open the generated artifact
  --theme  <name>               Terminal theme: dark, light, dracula, nord (default: dark)
  --width  <px>                 Width in pixels        (default: 1280)
  --height <px>                 Height in pixels       (default: 720)
  --timeout <ms>                Step timeout           (default: 60000)

repo-shot preview <scenario>    Quick preview, no optimization
  --format <fmt>                Output format: gif, mp4, webm (default: gif)
  --theme  <name>               Terminal theme: dark, light, dracula, nord (default: dark)

repo-shot init                  Create scenario.yml from cli-demo
  --template <name>             Template to use        (default: cli-demo)
  --output <file>               Output scenario file   (default: scenario.yml)
  --force                       Overwrite existing file

repo-shot doctor                Check Node, Canvas, Playwright, ffmpeg, and output permissions
repo-shot template list         List built-in templates
repo-shot template init <name>  Scaffold a new scenario file
  --force                       Overwrite existing file
repo-shot template show <name>  Print a built-in template
```

GIF export does not require ffmpeg. MP4 and WebM export do.

For editor validation, point your YAML language server at [`scenario.schema.json`](./scenario.schema.json).

**Resolution priority** (highest wins):
1. `--width` / `--height` CLI flags
2. `metadata.browser_config.viewport` in YAML
3. Default: `1280 × 720`

---

## Step Reference

### Terminal Steps

```yaml
- type: shell         # Run a single command
  command: npm test
  caption: "Running tests"
  delay: 500

- type: sequence      # Run multiple commands in order
  commands:
    - npm install
    - npm run build
    - npm test
  caption: "Full build pipeline"
```

### Browser Steps

```yaml
- type: navigate      # Go to a URL
  url: https://example.com
  timeout: 30000

- type: navigate      # Relative local files are resolved from the scenario file
  url: ./examples/local-browser/index.html

- type: click         # Click an element
  selector: "button.primary"

- type: fill          # Fill a form field
  selector: "#email"
  text: "user@example.com"

- type: wait          # Pause
  delay: 1500

- type: screenshot    # Capture the current state
  caption: "Result"

- type: assert        # Wait for an element to exist
  selector: "#result"
  caption: "Result rendered"
```

---

## Installation Notes

**macOS:**
```bash
xcode-select --install   # Build tools for native modules
npm install -g readme-repo-shot
npx playwright install chromium
```

**Ubuntu/Debian:**
```bash
apt-get install -y python3 build-essential
npm install -g readme-repo-shot
npx playwright install chromium --with-deps
```

**Windows:** Requires Visual Studio Build Tools and Python 3. See [node-gyp docs](https://github.com/nodejs/node-gyp#on-windows).

---

## Roadmap

- [x] Terminal recording
- [x] Browser recording (Playwright)
- [x] Pure JS GIF generation (no ffmpeg)
- [x] Configurable resolution
- [x] GitHub Actions integration
- [x] 9 production templates
- [x] MP4 / WebM export
- [x] Custom terminal themes (dark, light, Dracula, Nord)
- [ ] Cloud upload (S3, Cloudinary, Vercel Blob)
- [ ] VS Code extension
- [ ] Batch scenario runner
- [ ] Interactive scenario builder UI

---

## Contributing

```bash
git clone <your-fork-url>
cd repo-shot
npm install
npm test
```

1. Fork → branch → commit → PR.
2. Run `npm test` before submitting.
3. Add a template in `templates/` if your PR adds a new use case.

---

## License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">

**Built for developers who ship.**

*Stop recording demos by hand. Write YAML once, GIF forever.*

</div>
