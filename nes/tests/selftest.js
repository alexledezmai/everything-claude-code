import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { runGate } from '../src/lib/gates.js'
import { detectProject } from '../src/lib/project-detect.js'

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
fs.rmSync(regressionDir, { recursive: true, force: true })

assert.equal(regressionPass.status, 'PASS')
assert.equal(regressionPass.summary.passed, 3)
assert.equal(regressionFail.status, 'FAIL')
assert.equal(regressionFail.summary.failed, 1)
assert.ok(regressionPass.baseline_sha256)

const detected = detectProject(root)
assert.equal(detected.runtime, 'node')
assert.equal(detected.packageManager, null)

console.log('NES SELFTEST PASS')
console.log(`MYVO-2.4C baseline: ${passResult.summary.passed}/${passResult.summary.total} PASS`)
console.log(`Negative control: ${failResult.summary.failed} expected failure detected`)
console.log(`Regression control: ${regressionPass.summary.passed}/3 PASS; ${regressionFail.summary.failed} expected regression detected`)
