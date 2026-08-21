#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { detectProject } from './lib/project-detect.js'
import { runGate } from './lib/gates.js'
import { verifyProject } from './lib/verify.js'
import { createCheckpoint } from './lib/checkpoint.js'

const [, , command, ...args] = process.argv
const cwd = process.cwd()
const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)

if (command === 'detect') {
  print(detectProject(args[0] ? path.resolve(args[0]) : cwd))
} else if (command === 'gate') {
  if (!args[0] || !args[1]) throw new Error('Usage: npm run gate -- <definition.json> <evidence.json>')
  const result = runGate(path.resolve(args[0]), path.resolve(args[1]))
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
} else {
  process.stderr.write('NES v0.1\nCommands: detect | gate | verify | checkpoint\n')
  process.exitCode = command ? 1 : 0
}
