# Navi Engineering System (NES)

AI-agnostic engineering infrastructure for defining success, proving behavior, recording state, and shipping with evidence.

> Think it. Build it. Verify it. Ship it. Learn from it.

## v0.1 Scope

NES v0.1 intentionally starts small:

1. **Project Detection** - inspect a repository and infer runtime, framework, package manager, Docker, tests and common scripts.
2. **Gate Engine** - evaluate deterministic capability/regression gates against machine-readable evidence.
3. **Verification Engine** - build a project-aware verification plan and execute available build/type/lint/test scripts.
4. **Checkpoint Engine** - bind project state to Git SHA, branch, dirty files, gate result and verification result.
5. **Reference Baseline** - reproduce the known myvo Phase 2.4C PASS as the first real NES fixture.

NES is not coupled to Claude Code, ChatGPT, Codex, or any specific agent runtime. Adapters come later; the engineering contract lives in the project.

## Commands

From `nes/`:

```bash
node src/cli.js detect [project-path]
node src/cli.js gate <gate-definition.json> <evidence.json>
node src/cli.js verify [project-path]
node src/cli.js checkpoint <id> [gate-result.json] [verification-result.json]
node tests/selftest.js
```

## Gate Contract

A gate definition is deterministic JSON:

```json
{
  "id": "EXAMPLE-1",
  "type": "capability",
  "checks": [
    { "id": "durable", "path": "durable", "op": "eq", "expected": true },
    { "id": "delivered", "path": "sent_total", "op": "gte", "expected": 1 }
  ],
  "success": { "required": "all" }
}
```

Supported v0.1 operators: `eq`, `truthy`, `gte`, `lte`, `exists`.

The result includes PASS/FAIL, each check, totals, timestamp, and SHA-256 of the evidence payload.

## myvo 2.4C Reference Fixture

`examples/myvo-2.4c/` contains:

- `gate.json` - 10 deterministic capability checks.
- `evidence.pass.json` - evidence captured from the already validated physical/edge gate.

The self-test verifies both:

- the baseline evidence must PASS 10/10;
- an intentionally corrupted `kill_recovery_delivered=false` fixture must FAIL exactly one check.

This prevents a gate implementation that simply approves everything.

## Design Rules

- **Builder != Verifier.** Implementation and approval are separate responsibilities.
- **Evidence before confidence.** A statement that something works is not a gate result.
- **Deterministic graders first.** Use code/data checks whenever possible.
- **Project-owned state.** Checkpoints and gates travel with the repository.
- **Extend, do not replace.** New capabilities should preserve established behavior unless replacement is explicit.
- **AI runtime is an adapter.** Core engineering contracts must remain usable without a specific model/vendor.

## Roadmap

### v0.2
- JSON Schema validation for definitions/results.
- richer project detection.
- git diff capture between checkpoints.
- verification report persistence.
- explicit regression gate type.

### v0.3
- Living codemaps.
- Product Bible synchronization.
- Architecture Decision Records.

### v0.4
- Security gate.
- secrets/input/auth/database checks.

### v0.5
- Learning engine for reusable corrections and project rules.

### Adapters
- ChatGPT / Navi
- Claude Code
- Codex
- GitHub Actions

## Provenance

NES is a new, AI-agnostic implementation inspired by useful engineering patterns observed in `everything-claude-code`, especially eval-driven development, verification loops, checkpoints, documentation synchronization, and continuous learning. It intentionally does not copy the Claude-specific command/runtime architecture.
