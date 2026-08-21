# NES standalone migration

Target repository: `navi-engineering-system`

## Goal

Move the validated NES implementation out of the staging fork without changing behavior or project-owned contracts.

## Required repository contents

Move the complete `nes/` directory contents to the root of the standalone repository:

- `src/`
- `schemas/`
- `tests/`
- `examples/`
- `README.md`
- `MIGRATION.md`
- `package.json`

Move the release-candidate workflow to `.github/workflows/nes-runtime-gate.yml` and update its triggers for the standalone repository default branch.

## Standalone layout

```text
navi-engineering-system/
├── .github/workflows/nes-runtime-gate.yml
├── examples/
├── schemas/
├── src/
├── tests/
├── README.md
├── MIGRATION.md
└── package.json
```

## Adapter entrypoint change

The staging implementation uses `nes/src/cli.js` because NES is nested inside another repository. In the standalone repository the canonical entrypoint should become `src/cli.js`.

Before v1.0 release:

1. change adapter `entrypoint` to `src/cli.js`;
2. change adapter commands from `node nes/src/cli.js ...` to `node src/cli.js ...`;
3. update adapter schema/self-tests accordingly;
4. run the full RC workflow again.

## Release migration gate

The standalone migration is accepted only when:

- the complete test suite passes on Ubuntu;
- bootstrap/hardening/RC tests pass on Windows and macOS;
- the myvo 2.4C fixture remains 10/10 PASS;
- its negative control remains FAIL;
- `doctor` reports no ERROR for a freshly initialized reference project.

## First project: myvo

Use `examples/myvo-reference/INSTALL.md` as the first real adoption procedure. Do not replace myvo's existing code, gates, Product Bible or architecture documents; NES state must be additive.
