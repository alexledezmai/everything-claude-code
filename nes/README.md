# Navi Engineering System (NES)

AI-agnostic engineering infrastructure for defining success, proving behavior, recording project state, preserving product knowledge, and shipping with evidence.

> Think it. Build it. Verify it. Ship it. Learn from it.

## Release candidate

Current version: **1.0.0-rc.1**

NES is designed to be project-owned infrastructure rather than agent-owned behavior. ChatGPT/Navi, Claude Code, Codex and GitHub Actions are adapters over the same deterministic engineering contract.

## Core capabilities

- Project detection for Node, PHP and Python repositories.
- Capability and regression gates with deterministic evidence checks.
- Verification plans that execute available build, lint, test and typecheck scripts.
- Durable checkpoints bound to Git state, gates and verification results.
- Checkpoint comparison with regression detection.
- Living Codemap, ADR and Product Bible generation.
- Curated Learning Engine for reusable project/global rules.
- Host adapters for ChatGPT/Navi, Claude Code, Codex and GitHub Actions.
- Non-destructive, idempotent project bootstrap through `init`.
- `doctor` diagnostics for corrupt or inconsistent NES project state.
- Machine-readable CLI errors.

## Commands

From the repository root when NES lives under `nes/`:

```bash
node nes/src/cli.js init [project-path]
node nes/src/cli.js doctor [project-path]
node nes/src/cli.js detect [project-path]
node nes/src/cli.js verify [project-path]
node nes/src/cli.js gate <definition.json> <evidence.json> [baseline.json]
node nes/src/cli.js checkpoint <id> [gate-result.json] [verification-result.json]
node nes/src/cli.js compare <checkpoint-a.json> <checkpoint-b.json> [project-root]
node nes/src/cli.js codemap [project-path]
node nes/src/cli.js adr <adr.json> [project-root]
node nes/src/cli.js bible <product.json> [capabilities.json] [project-root]
node nes/src/cli.js learn <learning-event.json> [project-root]
node nes/src/cli.js rules [all|project|global] [project-root]
node nes/src/cli.js adapter [all|chatgpt|claude-code|codex|github-actions] [project-root]
```

## Release discipline

NES does not treat prose as proof.

A release should be considered ready only when the relevant evidence is available:

1. `doctor` has no ERROR state.
2. Required capability/regression gates PASS.
3. `verify` returns READY.
4. Checkpoint comparison shows no unresolved REGRESSION.
5. Product documentation reflects current project-owned contracts.

`verify` never returns READY when no verification steps exist. A missing test/build/lint/typecheck plan is `NOT_READY`, not silent success.

## Project state

`nes init` creates a non-destructive `.nes/` tree:

```text
.nes/
├── config.json
├── gates/
├── evidence/
├── checkpoints/
├── rules/
│   ├── project/
│   └── global/
├── docs/
│   └── adr/
└── adapters/
```

Existing project-owned files are preserved. Bootstrap does not overwrite existing config, gates, evidence, rules, docs or business files.

## Gate contract

Supported operators:

- `eq`
- `truthy`
- `gte`
- `lte`
- `exists`
- `preserve`
- `gte-baseline`
- `lte-baseline`

Regression baseline operators require a regression gate and baseline evidence.

## Living documentation

NES documentation is derived from repository state plus explicit project-owned contracts.

- Codemap: deterministic file/project inventory with SHA-256 binding.
- ADR: architecture decisions stored as JSON source + Markdown representation.
- Product Bible: product capabilities connected to code paths, gates and ADRs.

An AI host may help author a contract, but it cannot invent product truth or claim verification without NES evidence.

## Learning engine

Reusable corrections and patterns may be promoted into persistent rules. One-off instructions are not automatically learned. Duplicate rules are blocked by deterministic fingerprints.

## Adapters

Adapters contain execution instructions only. They do not implement NES policy.

Supported hosts:

- ChatGPT / Navi
- Claude Code
- Codex
- GitHub Actions

Every adapter resolves to the same canonical NES CLI commands.

## Hardening

`doctor` reports `OK`, `WARNING` or `ERROR` and checks:

- supported runtime;
- Node CLI compatibility;
- `.nes/` structure;
- config JSON and contract;
- gate JSON and gate definitions;
- evidence/checkpoint JSON readability;
- writable project state.

CLI failures use the `nes.error.v1` machine-readable envelope.

## Reference baseline: myvo 2.4C

`examples/myvo-2.4c/` contains the first real reference gate. It reproduces an already-observed myvo Phase 2.4C PASS and includes a negative control that must fail when durable recovery evidence is corrupted.

This fixture exists to prove the Gate Engine against real engineering evidence rather than a toy example.

## CI

The release-candidate workflow runs:

- the complete NES suite on Ubuntu;
- bootstrap, hardening and RC regression controls on Windows;
- bootstrap, hardening and RC regression controls on macOS.

## v1.0 exit criteria

1. RC CI is green across supported operating systems.
2. Full diff/release review has no critical unresolved issue.
3. NES is moved into the standalone `navi-engineering-system` repository.
4. myvo adopts NES as the first real project reference implementation.
5. myvo's existing 2.4C evidence reproduces PASS under the standalone installation.

## Provenance

NES is a new AI-agnostic implementation inspired by useful engineering patterns observed in `everything-claude-code`, including eval-driven development, verification loops, checkpoints, documentation synchronization and continuous learning. It intentionally does not copy Claude-specific runtime architecture.
