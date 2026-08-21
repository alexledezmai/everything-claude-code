import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { initProject } from '../src/lib/init.js'
import { doctorProject } from '../src/lib/doctor.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nes-doctor-'))
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'doctor-test', scripts: {} }))
initProject(root)

const healthy = doctorProject(root)
assert.notEqual(healthy.status, 'ERROR')
assert.equal(healthy.summary.errors, 0)
assert.ok(healthy.checks.find((check) => check.id === 'config-contract')?.ok)
assert.ok(healthy.checks.find((check) => check.id === 'gate:foundation.example.json')?.ok)

const configFile = path.join(root, '.nes', 'config.json')
const goodConfig = fs.readFileSync(configFile, 'utf8')
fs.writeFileSync(configFile, '{bad json')
const corruptConfig = doctorProject(root)
assert.equal(corruptConfig.status, 'ERROR')
assert.equal(corruptConfig.checks.find((check) => check.id === 'config-json')?.ok, false)
fs.writeFileSync(configFile, goodConfig)

const gateFile = path.join(root, '.nes', 'gates', 'foundation.example.json')
const goodGate = fs.readFileSync(gateFile, 'utf8')
fs.writeFileSync(gateFile, JSON.stringify({ id: 'BROKEN', type: 'capability', checks: [{ id: 'x', path: 'x', op: 'preserve' }] }))
const brokenGate = doctorProject(root)
assert.equal(brokenGate.status, 'ERROR')
assert.equal(brokenGate.checks.find((check) => check.id === 'gate:foundation.example.json')?.ok, false)
fs.writeFileSync(gateFile, goodGate)

fs.writeFileSync(path.join(root, '.nes', 'evidence', 'corrupt.json'), '{nope')
const corruptState = doctorProject(root)
assert.equal(corruptState.status, 'ERROR')
assert.equal(corruptState.checks.find((check) => check.id === 'evidence:corrupt.json')?.ok, false)

fs.rmSync(root, { recursive: true, force: true })

console.log('NES HARDENING SELFTEST PASS')
console.log('Doctor control: healthy state accepted; corrupt config, invalid gate and corrupt evidence detected safely')
