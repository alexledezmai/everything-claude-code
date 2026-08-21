# myvo + NES reference adoption

myvo is the first real project that should adopt NES after the standalone migration.

## Principle

NES must be additive. It must not replace myvo code, the Living Product Bible, existing architecture records, phase evidence, or operational Docker configuration.

## Adoption sequence

1. Add the standalone NES package/tooling to the myvo development environment.
2. Run `nes init` at the myvo repository root.
3. Run `nes doctor` and resolve ERROR findings before importing project evidence.
4. Replace the starter foundation example with project-owned myvo gates.
5. Import the Phase 2.4C gate definition and its already-observed evidence.
6. Run the Phase 2.4C gate and require 10/10 PASS.
7. Corrupt the negative-control recovery field and require the gate to FAIL exactly one check.
8. Generate the codemap.
9. Represent myvo Live Intelligence / Vista en vivo as an explicit Product Capability contract connected to its code paths, ADRs and gates.
10. Generate/sync the Living Product Bible from those project-owned contracts.
11. Create a checkpoint after the validated baseline.
12. Use regression gates/checkpoint comparison for the next myvo phase before release.

## Phase 2.4C acceptance

Expected positive evidence:

- durable real local event;
- revoked credential retains queued work;
- active credential resumes delivery;
- duplicate replay remains idempotent;
- unauthorized camera is quarantined;
- quarantine code is `camera_not_authorized`;
- kill during sync retains queue;
- recovery delivers after restart;
- sent total is at least 5;
- quarantined total is at least 2.

The canonical staging fixture lives in `examples/myvo-2.4c/`.

## Reference capability

Suggested capability contract:

```json
{
  "id": "MYVO-LIVE-INTELLIGENCE",
  "name": "myvo Live Intelligence / Vista en vivo",
  "status": "verified",
  "description": "Operational live intelligence derived from edge camera events and durable delivery state.",
  "source_paths": [
    "<myvo edge/event bridge paths>",
    "<myvo live intelligence UI paths>"
  ],
  "gate_ids": ["MYVO-2.4C"],
  "adr_ids": []
}
```

Replace placeholder source paths with paths observed in the actual myvo repository. NES must not fabricate them.

## Definition of successful adoption

myvo is considered the first NES reference implementation when:

- `doctor` has no ERROR;
- Phase 2.4C reproduces 10/10 PASS;
- the negative control fails as designed;
- a myvo checkpoint is created;
- the Product Bible contains the explicit Live Intelligence capability tied to real source paths/gates;
- the next phase uses NES regression/verification gates rather than prose-only approval.
