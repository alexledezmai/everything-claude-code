import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { runGate } from '../src/lib/gates.js'
import { detectProject } from '../src/lib/project-detect.js'
import { compareCheckpoints } from '../src/lib/checkpoint.js'
import { generateCodemap, writeAdr, writeProductBible } from '../src/lib/docs.js'
import { evaluateLearningEvent, promoteLearningEvent, loadRules } from '../src/lib/learning.js'
import { createAdapterManifest, writeAllAdapters } from '../src/lib/adapters.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const gate = path.join(root, 'examples', 'myvo-2.4c', 'gate.json')
const evidence = path.join(root, 'examples', 'myvo-2.4c', 'evidence.pass.json')

const passResult = runGate(gate, evidence)
assert.equal(passResult.status, 'PASS')
assert.equal(passResult.summary.failed, 0)
assert.equal(passResult.summary.passed, 10)

const brokenEvidence = JSON.parse(fs.readFileSync(evidence, 'utf8'))
brokenEvidence.kill_recovery_delivered = false
const temp = path.join(os.tmpdir(), `nes-evidence-${process.pid}.json`)
fs.writeFileSync(temp, JSON.stringify(brokenEvidence))
const failResult = runGate(gate, temp)
fs.rmSync(temp, { force: true })

assert.equal(failResult.status, 'FAIL')
assert.equal(failResult.summary.failed, 1)
assert.equal(failResult.checks.find((c) => c.id === 'kill-recovery-delivered').passed, false)

const regressionDefinition = {
  id: 'NES-REGRESSION-SELFTEST',
  type: 'regression',
  success: { required: 'all' },
  checks: [
    { id: 'delivery-preserved', path: 'kill_recovery_delivered', op: 'preserve' },
    { id: 'sent-total-not-lower', path: 'final_sent_total', op: 'gte-baseline' },
    { id: 'quarantine-not-higher', path: 'final_quarantined_total', op: 'lte-baseline' }
  ]
}

const regressionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nes-regression-'))
const regressionGateFile = path.join(regressionDir, 'gate.json')
const baselineFile = path.join(regressionDir, 'baseline.json')
const candidatePassFile = path.join(regressionDir, 'candidate-pass.json')
const candidateFailFile = path.join(regressionDir, 'candidate-fail.json')
const baseline = JSON.parse(fs.readFileSync(evidence, 'utf8'))
const candidatePass = { ...baseline, final_sent_total: baseline.final_sent_total + 1 }
const candidateFail = { ...candidatePass, kill_recovery_delivered: false }

fs.writeFileSync(regressionGateFile, JSON.stringify(regressionDefinition))
fs.writeFileSync(baselineFile, JSON.stringify(baseline))
fs.writeFileSync(candidatePassFile, JSON.stringify(candidatePass))
fs.writeFileSync(candidateFailFile, JSON.stringify(candidateFail))

const regressionPass = runGate(regressionGateFile, candidatePassFile, baselineFile)
const regressionFail = runGate(regressionGateFile, candidateFailFile, baselineFile)

assert.equal(regressionPass.status, 'PASS')
assert.equal(regressionPass.summary.passed, 3)
assert.equal(regressionFail.status, 'FAIL')
assert.equal(regressionFail.summary.failed, 1)
assert.ok(regressionPass.baseline_sha256)

const checkpointA = path.join(regressionDir, 'checkpoint-a.json')
const checkpointB = path.join(regressionDir, 'checkpoint-b.json')
fs.writeFileSync(checkpointA, JSON.stringify({
  schema_version: 'nes.checkpoint.v1',
  id: 'A',
  created_at: new Date().toISOString(),
  git: { sha: 'same', branch: 'test', dirty_files: [] },
  gate: { status: 'PASS' },
  verification: { status: 'READY' }
}))
fs.writeFileSync(checkpointB, JSON.stringify({
  schema_version: 'nes.checkpoint.v1',
  id: 'B',
  created_at: new Date().toISOString(),
  git: { sha: 'same', branch: 'test', dirty_files: [] },
  gate: { status: 'FAIL' },
  verification: { status: 'NOT_READY' }
}))

const checkpointDiff = compareCheckpoints(checkpointA, checkpointB, root)
assert.equal(checkpointDiff.status, 'REGRESSION')
assert.equal(checkpointDiff.gate.regression, true)
assert.equal(checkpointDiff.verification.regression, true)

const codemap = generateCodemap(root)
assert.equal(codemap.schema_version, 'nes.codemap.v1')
assert.equal(codemap.project.runtime, 'node')
assert.ok(codemap.file_count > 0)
assert.ok(codemap.content_sha256)

const docsRoot = path.join(regressionDir, 'docs-project')
fs.mkdirSync(path.join(docsRoot, 'src'), { recursive: true })
fs.writeFileSync(path.join(docsRoot, 'package.json'), JSON.stringify({ name: 'docs-test', scripts: {} }))
fs.writeFileSync(path.join(docsRoot, 'src', 'index.js'), 'export const ok = true\n')

const adrResult = writeAdr(docsRoot, {
  id: 'ADR-001',
  title: 'Durable events',
  status: 'accepted',
  context: 'Events must survive transient failures.',
  decision: 'Persist before delivery.',
  consequences: ['Delivery can resume after restart.'],
  alternatives: ['Best-effort delivery only.']
})
assert.ok(fs.existsSync(adrResult.json_file))
assert.ok(fs.existsSync(adrResult.markdown_file))

const bibleResult = writeProductBible({
  root: docsRoot,
  product: { name: 'myvo', description: 'Retail intelligence platform.' },
  capabilities: [{
    id: 'MYVO-LIVE',
    name: 'Live Intelligence',
    status: 'verified',
    description: 'Live operational intelligence from edge events.',
    source_paths: ['src/index.js'],
    gate_ids: ['MYVO-2.4C'],
    adr_ids: ['ADR-001']
  }]
})
assert.ok(fs.existsSync(bibleResult.file))
const bibleText = fs.readFileSync(bibleResult.file, 'utf8')
assert.ok(bibleText.includes('Live Intelligence'))
assert.ok(bibleText.includes('MYVO-2.4C'))
assert.ok(bibleText.includes('ADR-001'))

const learningRoot = path.join(regressionDir, 'learning-project')
fs.mkdirSync(learningRoot, { recursive: true })
const reusableEvent = {
  type: 'user_correction',
  title: 'Preserve established views',
  instruction: 'Feature additions must extend existing UI architecture and must not replace established views unless explicitly requested.',
  scope: 'project',
  source_id: 'selftest-correction-001',
  applies_to: ['ui', 'feature-development']
}
const learningDecision = evaluateLearningEvent(reusableEvent)
assert.equal(learningDecision.promotable, true)

const promoted = promoteLearningEvent(learningRoot, reusableEvent)
assert.equal(promoted.promoted, true)
assert.equal(promoted.rule.id, 'RULE-001')
assert.ok(fs.existsSync(promoted.json_file))
assert.ok(fs.existsSync(promoted.markdown_file))

const duplicate = promoteLearningEvent(learningRoot, reusableEvent)
assert.equal(duplicate.promoted, false)
assert.equal(duplicate.duplicate, true)

const oneOff = promoteLearningEvent(learningRoot, {
  type: 'one_off',
  title: 'Temporary demo copy',
  instruction: 'Use temporary copy for this one demonstration only.',
  scope: 'project'
})
assert.equal(oneOff.promoted, false)
assert.equal(oneOff.decision.promotable, false)

const rules = loadRules(learningRoot)
assert.equal(rules.length, 1)
assert.equal(rules[0].rule.instruction, reusableEvent.instruction)

const adapterRoot = path.join(regressionDir, 'adapter-project')
fs.mkdirSync(adapterRoot, { recursive: true })
const adapters = writeAllAdapters(adapterRoot)
assert.equal(adapters.length, 4)
const manifests = adapters.map((entry) => entry.manifest)
for (const manifest of manifests) {
  assert.equal(manifest.schema_version, 'nes.adapter.v1')
  assert.equal(manifest.protocol_version, '1')
  assert.equal(manifest.entrypoint, 'nes/src/cli.js')
  assert.ok(fs.existsSync(path.join(adapterRoot, '.nes', 'adapters', manifest.adapter, 'manifest.json')))
  assert.ok(fs.existsSync(path.join(adapterRoot, '.nes', 'adapters', manifest.adapter, 'INSTRUCTIONS.md')))
}
const canonicalCommands = JSON.stringify(createAdapterManifest('chatgpt').commands)
for (const host of ['claude-code', 'codex', 'github-actions']) {
  assert.equal(JSON.stringify(createAdapterManifest(host).commands), canonicalCommands)
}
assert.throws(() => createAdapterManifest('unsupported-host'), /Unsupported adapter/)

fs.rmSync(regressionDir, { recursive: true, force: true })

const detected = detectProject(root)
assert.equal(detected.runtime, 'node')
assert.equal(detected.packageManager, null)

console.log('NES SELFTEST PASS')
console.log(`MYVO-2.4C baseline: ${passResult.summary.passed}/${passResult.summary.total} PASS`)
console.log(`Negative control: ${failResult.summary.failed} expected failure detected`)
console.log(`Regression control: ${regressionPass.summary.passed}/3 PASS; ${regressionFail.summary.failed} expected regression detected`)
console.log(`Checkpoint control: ${checkpointDiff.status}`)
console.log(`Codemap control: ${codemap.file_count} files indexed`)
console.log('Living docs control: ADR + Product Bible generated')
console.log('Learning control: reusable correction promoted, duplicate blocked, one-off ignored')
console.log('Adapter control: 4 hosts share one canonical NES command contract')
