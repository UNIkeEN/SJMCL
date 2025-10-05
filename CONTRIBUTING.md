# Contributing

We warmly welcome all forms of contributions to SJMCL, including issues, new features, documentation, and more. 🥰

The following is a set of guidelines for contributing to SJMCL. Please take a few minutes to review these guidelines before submitting an issue or pull request.

## Code of Conduct

We have adopted a [Code of Conduct](https://github.com/UNIkeEN/SJMCL/blob/main/CODE_OF_CONDUCT.md) that all project participants are expected to follow. Please take a moment to read the full text to understand the actions that are acceptable and those that will not be tolerated.

## Bugs

We are using [GitHub Issues](https://github.com/UNIkeEN/SJMCL/issues) for bug tracking. Use the `Bug report` issue template to provide information that will help us confirm the bug, such as steps to reproduce, expected behavior, running environment and any additional context. 

Before you report a bug, please make sure you've searched existing issues.

## Proposing a Change

If you wish to propose or add a new feature, we encourage you to first open an issue (using the `Feature Request` template) to discuss it with the core team. This process allows us to determine whether the feature is suitable for SJMCL and helps refine the idea before development begins.

<!-- ### Your First Pull Request (TBD)-->

## Sending a Pull Request

The core team monitors pull requests regularly. We will review your pull request and either merge it, request changes, or close it with an explanation.

**Before submitting a pull request**, please make sure the following is done:

* Fork the repository and create your own branch.
* Test your changes locally to ensure they work as expected.
* Update documentation if necessary.
* Ensure code style and commit messages align with the project’s conventions. (PRs with non-conventional commit messages may be closed or squashed.)
* Ensure your code passes linting (`npm run lint-staged`). Tip: Linting runs automatically when you `git commit`.
* Finally, please make sure that all GitHub CI checks pass.

## Development Workflow

### Preliminaries

This project uses **[Tauri v2](https://v2.tauri.app/)**. Please make sure you have installed [node >=22](https://nodejs.org/) and [Rust](https://www.rust-lang.org/learn/get-started).

We use `npm` as the preferred package manager for the frontend. After cloning the repository, use the following command to install the dependencies:

```bash
npm install
```

### Configure environment variables

Copy the `.env.template` file to `.env`, and fill in the required environment variables based on the comments in the template.

These values will be embedded into the Rust backend as compile-time constants.

### Run locally

Run the project in development mode.

```bash
npm run tauri dev
```

### Check the code style

We use `ESLint` and `Prettier` for frontend code and `rustfmt` for backend code to ensure consistent formatting. 

```bash
npm run lint-staged
```

Alternatively, to manually check and fix formatting issues, run the following commands:

```bash
# For frontend part
npx eslint "src/**/*.{js,jsx,ts,tsx}" --no-fix     # check
npx eslint "src/**/*.{js,jsx,ts,tsx}" --fix        # fix

# For backend part (For Linux, macOS or Git Bash on Windows)
rustfmt --check src-tauri/src/**/*.rs              # check
rustfmt src-tauri/src/**/*.rs                      # fix

# For backend part (For Windows PowerShell)
cd src-tauri
cargo fmt -- --check src/**/*.rs                   # check
cargo fmt -- src/**/*.rs                           # fix
```

If you use VS Code for developing this project, we recommend setting `rust-analyzer.check.command` to `clippy` in your workspace settings for stricter code checking.

### Build

Build the project into an executable.

```bash
npm run tauri build
```

For cross-platform compilation, packaging in a specific format, or more details, please refer to the official [Tauri distribution guide](https://tauri.app/distribute/).

## Being a collaborator

If you’re an active contributor and are interested in working closely with the SJMCL Team on our open-source workflow 💪, please contact us at [launcher@sjmc.club](mailto:launcher@sjmc.club).