import fs from 'node:fs'
import crypto from 'node:crypto'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function getByPath(value, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => acc?.[key], value)
}

export function validateGateDefinition(definition) {
  const errors = []
  const allowedTypes = new Set(['capability', 'regression', 'architecture', 'security', 'production'])
  const allowedOps = new Set(['eq', 'truthy', 'gte', 'lte', 'exists', 'preserve', 'gte-baseline', 'lte-baseline'])

  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) errors.push('definition must be an object')
  if (!definition?.id || typeof definition.id !== 'string') errors.push('definition.id is required')
  if (definition?.type && !allowedTypes.has(definition.type)) errors.push(`unsupported gate type: ${definition.type}`)
  if (!Array.isArray(definition?.checks) || definition.checks.length === 0) errors.push('definition.checks must contain at least one check')

  const ids = new Set()
  for (const [index, check] of (definition?.checks ?? []).entries()) {
    if (!check?.id || typeof check.id !== 'string') errors.push(`checks[${index}].id is required`)
    if (!check?.path || typeof check.path !== 'string') errors.push(`checks[${index}].path is required`)
    if (check?.id && ids.has(check.id)) errors.push(`duplicate check id: ${check.id}`)
    if (check?.id) ids.add(check.id)
    const op = check?.op ?? 'eq'
    if (!allowedOps.has(op)) errors.push(`unsupported operator '${op}' in check ${check?.id ?? index}`)
    if (['preserve', 'gte-baseline', 'lte-baseline'].includes(op) && definition?.type !== 'regression') {
      errors.push(`operator '${op}' requires gate type regression`)
    }
  }

  const required = definition?.success?.required ?? 'all'
  if (required !== 'all' && (!Number.isInteger(required) || required < 1 || required > (definition?.checks?.length ?? 0))) {
    errors.push('success.required must be "all" or an integer between 1 and number of checks')
  }

  if (errors.length) {
    const error = new Error(`Invalid gate definition:\n- ${errors.join('\n- ')}`)
    error.code = 'NES_INVALID_GATE_DEFINITION'
    error.details = errors
    throw error
  }

  return { valid: true, errors: [] }
}

function evaluateCheck(check, evidence, baseline = null) {
  const actual = getByPath(evidence, check.path)
  const baselineValue = baseline ? getByPath(baseline, check.path) : undefined
  const op = check.op ?? 'eq'
  let passed = false
  let expected = check.expected

  if (op === 'eq') passed = actual === check.expected
  if (op === 'truthy') passed = Boolean(actual)
  if (op === 'gte') passed = Number(actual) >= Number(check.expected)
  if (op === 'lte') passed = Number(actual) <= Number(check.expected)
  if (op === 'exists') passed = actual !== undefined && actual !== null
  if (op === 'preserve') {
    expected = baselineValue
    passed = actual === baselineValue
  }
  if (op === 'gte-baseline') {
    expected = baselineValue
    passed = Number(actual) >= Number(baselineValue)
  }
  if (op === 'lte-baseline') {
    expected = baselineValue
    passed = Number(actual) <= Number(baselineValue)
  }

  return {
    id: check.id,
    path: check.path,
    op,
    expected: expected ?? null,
    baseline: ['preserve', 'gte-baseline', 'lte-baseline'].includes(op) ? (baselineValue ?? null) : null,
    actual: actual ?? null,
    passed
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function runGate(definitionPath, evidencePath, baselinePath = null) {
  const definition = readJson(definitionPath)
  validateGateDefinition(definition)

  const evidence = readJson(evidencePath)
  const baseline = baselinePath ? readJson(baselinePath) : null
  if (definition.type === 'regression' && definition.checks.some((c) => ['preserve', 'gte-baseline', 'lte-baseline'].includes(c.op)) && !baseline) {
    const error = new Error('Regression gate uses baseline operators but no baseline evidence was provided')
    error.code = 'NES_BASELINE_REQUIRED'
    throw error
  }

  const checks = definition.checks.map((check) => evaluateCheck(check, evidence, baseline))
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
    evidence_sha256: sha256(evidence),
    baseline_sha256: baseline ? sha256(baseline) : null,
    generated_at: new Date().toISOString()
  }
}
