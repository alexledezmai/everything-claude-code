#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { detectProject } from './lib/project-detect.js'
import { runGate } from './lib/gates.js'
import { verifyProject } from './lib/verify.js'
import { createCheckpoint, compareCheckpoints } from './lib/checkpoint.js'
import { writeCodemap, writeAdr, writeProductBible } from './lib/docs.js'
import { promoteLearningEvent, loadRules } from './lib/learning.js'
import { writeAdapter, writeAllAdapters } from './lib/adapters.js'
import { initProject } from './lib/init.js'
import { doctorProject } from './lib/doctor.js'

const [, , command, ...args] = process.argv
const cwd = process.cwd()
const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)

try {
  if (command === 'init') {
    print(initProject(args[0] ? path.resolve(args[0]) : cwd))
  } else if (command === 'doctor') {
    const result = doctorProject(args[0] ? path.resolve(args[0]) : cwd)
    print(result)
    process.exitCode = result.status === 'ERROR' ? 1 : 0
  } else if (command === 'detect') {
    print(detectProject(args[0] ? path.resolve(args[0]) : cwd))
  } else if (command === 'gate') {
    if (!args[0] || !args[1]) throw new Error('Usage: npm run gate -- <definition.json> <evidence.json> [baseline.json]')
    const result = runGate(path.resolve(args[0]), path.resolve(args[1]), args[2] ? path.resolve(args[2]) : null)
    print(result)
    process.exitCode = result.status === 'PASS' ? 0 : 1
  } else if (command === 'verify') {
    const result = verifyProject(args[0] ? path.resolve(args[0]) : cwd)
    print(result)
    process.exitCode = result.status === 'READY' ? 0 : 1
  } else if (command === 'checkpoint') {
    const id = args[0]
    if (!id) throw new Error('Usage: npm run checkpoint -- <id> [gate-result.json] [verification-result.json]')
    const gate = args[1] ? JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')) : null
    const verification = args[2] ? JSON.parse(fs.readFileSync(path.resolve(args[2]), 'utf8')) : null
    print(createCheckpoint({ root: cwd, id, gate, verification }))
  } else if (command === 'compare') {
    if (!args[0] || !args[1]) throw new Error('Usage: npm run compare -- <checkpoint-a.json> <checkpoint-b.json> [project-root]')
    const result = compareCheckpoints(path.resolve(args[0]), path.resolve(args[1]), args[2] ? path.resolve(args[2]) : cwd)
    print(result)
    process.exitCode = result.status === 'REGRESSION' ? 1 : 0
  } else if (command === 'codemap') {
    print(writeCodemap(args[0] ? path.resolve(args[0]) : cwd))
  } else if (command === 'adr') {
    if (!args[0]) throw new Error('Usage: npm run adr -- <adr.json> [project-root]')
    const adr = JSON.parse(fs.readFileSync(path.resolve(args[0]), 'utf8'))
    print(writeAdr(args[1] ? path.resolve(args[1]) : cwd, adr))
  } else if (command === 'bible') {
    if (!args[0]) throw new Error('Usage: npm run bible -- <product.json> [capabilities.json] [project-root]')
    const product = JSON.parse(fs.readFileSync(path.resolve(args[0]), 'utf8'))
    const capabilities = args[1] ? JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')) : []
    print(writeProductBible({ root: args[2] ? path.resolve(args[2]) : cwd, product, capabilities }))
  } else if (command === 'learn') {
    if (!args[0]) throw new Error('Usage: npm run learn -- <learning-event.json> [project-root]')
    const event = JSON.parse(fs.readFileSync(path.resolve(args[0]), 'utf8'))
    print(promoteLearningEvent(args[1] ? path.resolve(args[1]) : cwd, event))
  } else if (command === 'rules') {
    const scope = args[0] ?? 'all'
    if (!['all', 'project', 'global'].includes(scope)) throw new Error('Usage: npm run rules -- [all|project|global] [project-root]')
    print(loadRules(args[1] ? path.resolve(args[1]) : cwd, { scope }))
  } else if (command === 'adapter') {
    const adapter = args[0] ?? 'all'
    const root = args[1] ? path.resolve(args[1]) : cwd
    if (adapter === 'all') print(writeAllAdapters(root))
    else print(writeAdapter(root, adapter))
  } else {
    process.stderr.write('NES v0.7\nCommands: init | doctor | detect | gate | verify | checkpoint | compare | codemap | adr | bible | learn | rules | adapter\n')
    process.exitCode = command ? 1 : 0
  }
} catch (error) {
  const payload = {
    schema_version: 'nes.error.v1',
    status: 'ERROR',
    code: error.code ?? 'NES_COMMAND_FAILED',
    message: error.message,
    details: error.details ?? null
  }
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`)
  process.exitCode = 1
}
