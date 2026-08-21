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

const detected = detectProject(root)
assert.equal(detected.runtime, 'node')
assert.equal(detected.packageManager, null)

console.log('NES SELFTEST PASS')
console.log(`MYVO-2.4C baseline: ${passResult.summary.passed}/${passResult.summary.total} PASS`)
console.log(`Negative control: ${failResult.summary.failed} expected failure detected`)
