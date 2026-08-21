import fs from 'node:fs'
import crypto from 'node:crypto'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function getByPath(value, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => acc?.[key], value)
}

function evaluateCheck(check, evidence) {
  const actual = getByPath(evidence, check.path)
  const op = check.op ?? 'eq'
  let passed = false

  if (op === 'eq') passed = actual === check.expected
  if (op === 'truthy') passed = Boolean(actual)
  if (op === 'gte') passed = Number(actual) >= Number(check.expected)
  if (op === 'lte') passed = Number(actual) <= Number(check.expected)
  if (op === 'exists') passed = actual !== undefined && actual !== null

  return {
    id: check.id,
    path: check.path,
    op,
    expected: check.expected ?? null,
    actual: actual ?? null,
    passed
  }
}

export function runGate(definitionPath, evidencePath) {
  const definition = readJson(definitionPath)
  const evidence = readJson(evidencePath)
  const checks = definition.checks.map((check) => evaluateCheck(check, evidence))
  const required = definition.success?.required ?? 'all'
  const passedCount = checks.filter((check) => check.passed).length
  const pass = required === 'all'
    ? passedCount === checks.length
    : passedCount >= Number(required)

  return {
    schema_version: 'nes.gate-result.v1',
    gate_id: definition.id,
    gate_type: definition.type ?? 'capability',
    status: pass ? 'PASS' : 'FAIL',
    summary: {
      total: checks.length,
      passed: passedCount,
      failed: checks.length - passedCount
    },
    checks,
    evidence_sha256: crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
    generated_at: new Date().toISOString()
  }
}
