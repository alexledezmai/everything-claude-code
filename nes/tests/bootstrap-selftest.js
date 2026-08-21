import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { initProject } from '../src/lib/init.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nes-init-'))
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'bootstrap-test', scripts: {} }))
fs.writeFileSync(path.join(root, 'existing.txt'), 'preserve me\n')

const first = initProject(root)
assert.equal(first.status, 'INITIALIZED')
assert.equal(first.detected.runtime, 'node')
assert.equal(first.adapters.length, 4)
assert.ok(fs.existsSync(path.join(root, '.nes', 'config.json')))
assert.ok(fs.existsSync(path.join(root, '.nes', 'gates', 'foundation.example.json')))
assert.ok(fs.existsSync(path.join(root, '.nes', 'evidence', 'foundation.example.json')))
assert.equal(fs.readFileSync(path.join(root, 'existing.txt'), 'utf8'), 'preserve me\n')

const configPath = path.join(root, '.nes', 'config.json')
const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
customConfig.policies.require_gate_before_release = false
fs.writeFileSync(configPath, `${JSON.stringify(customConfig, null, 2)}\n`)

const gatePath = path.join(root, '.nes', 'gates', 'foundation.example.json')
fs.writeFileSync(gatePath, '{"custom":true}\n')

const second = initProject(root)
assert.equal(second.status, 'INITIALIZED')
assert.ok(second.preserved.includes(configPath))
assert.ok(second.preserved.includes(gatePath))
assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).policies.require_gate_before_release, false)
assert.equal(fs.readFileSync(gatePath, 'utf8'), '{"custom":true}\n')
assert.equal(fs.readFileSync(path.join(root, 'existing.txt'), 'utf8'), 'preserve me\n')

const manifest = JSON.parse(fs.readFileSync(path.join(root, '.nes', 'adapters', 'chatgpt', 'manifest.json'), 'utf8'))
assert.equal(manifest.schema_version, 'nes.adapter.v1')

fs.rmSync(root, { recursive: true, force: true })

console.log('NES BOOTSTRAP SELFTEST PASS')
console.log('Init control: project initialized, rerun preserved custom config/gate, existing business file untouched')
