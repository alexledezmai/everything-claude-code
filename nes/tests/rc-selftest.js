import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { detectProject } from '../src/lib/project-detect.js'
import { verifyProject, buildVerificationPlan } from '../src/lib/verify.js'
import { initProject } from '../src/lib/init.js'
import { createAdapterManifest } from '../src/lib/adapters.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nes-rc-'))

fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
  name: 'rc-test',
  scripts: { test: 'node -e "process.exit(0)"' }
}))

const detected = detectProject(root)
assert.equal(detected.runtime, 'node')
assert.equal(detected.packageManager, null)
assert.equal(detected.issues.length, 0)

const plan = buildVerificationPlan(root)
assert.equal(plan.plan.length, 1)
assert.equal(plan.plan[0].command, 'npm')

const verified = verifyProject(root)
assert.equal(verified.status, 'READY')
assert.equal(verified.results.length, 1)

fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'no-steps', scripts: {} }))
const noSteps = verifyProject(root)
assert.equal(noSteps.status, 'NOT_READY')
assert.equal(noSteps.reason, 'NO_VERIFICATION_STEPS')

fs.writeFileSync(path.join(root, 'package.json'), '{broken json')
const broken = detectProject(root)
assert.equal(broken.runtime, 'node')
assert.equal(broken.issues[0].code, 'NES_INVALID_PACKAGE_JSON')
const brokenVerify = verifyProject(root)
assert.equal(brokenVerify.status, 'NOT_READY')
assert.equal(brokenVerify.reason, 'PROJECT_DETECTION_ISSUES')

fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'rc-test', scripts: {} }))
const initialized = initProject(root)
assert.equal(initialized.nes_version, '1.0.0-rc.1')
const config = JSON.parse(fs.readFileSync(path.join(root, '.nes', 'config.json'), 'utf8'))
assert.equal(config.nes_version, '1.0.0-rc.1')

for (const host of ['chatgpt', 'claude-code', 'codex', 'github-actions']) {
  const manifest = createAdapterManifest(host)
  assert.ok(manifest.commands.init)
  assert.ok(manifest.commands.doctor)
  assert.equal(Object.keys(manifest.commands).length, 12)
}

fs.rmSync(root, { recursive: true, force: true })

console.log('NES RC SELFTEST PASS')
console.log('RC controls: npm fallback verified, empty verification blocked, corrupt package detected, versions aligned, adapters complete')
