import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detectProject } from './project-detect.js'
import { validateGateDefinition } from './gates.js'

function result(id, level, ok, message, remediation = null, details = null) {
  return { id, level, ok, message, remediation, details }
}

function safeJson(file) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

function validateConfig(config) {
  const errors = []
  if (!config || typeof config !== 'object' || Array.isArray(config)) errors.push('config must be an object')
  if (config?.schema_version !== 'nes.config.v1') errors.push('schema_version must be nes.config.v1')
  if (!config?.nes_version || typeof config.nes_version !== 'string') errors.push('nes_version is required')
  if (!config?.project?.name || typeof config.project.name !== 'string') errors.push('project.name is required')
  if (!config?.project?.detected?.runtime || typeof config.project.detected.runtime !== 'string') errors.push('project.detected.runtime is required')
  if (config?.policies?.protect_existing !== true) errors.push('policies.protect_existing must be true')
  if (typeof config?.policies?.require_gate_before_release !== 'boolean') errors.push('policies.require_gate_before_release must be boolean')
  if (!['curated', 'off'].includes(config?.policies?.learning_mode)) errors.push('policies.learning_mode must be curated or off')
  return errors
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
}

export function doctorProject(root = process.cwd()) {
  const resolved = path.resolve(root)
  const detected = detectProject(resolved)
  const checks = []
  const nesDir = path.join(resolved, '.nes')
  const configFile = path.join(nesDir, 'config.json')

  checks.push(result('runtime-supported', 'ERROR', ['node', 'php', 'python'].includes(detected.runtime),
    `Detected runtime: ${detected.runtime}`,
    'Use NES in a project with a supported runtime or extend project detection.'))

  checks.push(result('node-version', 'WARNING', process.versions?.node ? Number(process.versions.node.split('.')[0]) >= 20 : true,
    process.versions?.node ? `Node ${process.versions.node}` : 'Node version not available',
    'Use Node.js 20 or newer for the NES CLI.'))

  checks.push(result('nes-directory', 'ERROR', fs.existsSync(nesDir),
    fs.existsSync(nesDir) ? '.nes directory exists' : '.nes directory is missing',
    'Run `nes init` before using project-owned NES state.'))

  if (fs.existsSync(configFile)) {
    const parsed = safeJson(configFile)
    if (!parsed.ok) {
      checks.push(result('config-json', 'ERROR', false, 'NES config is not valid JSON',
        'Repair .nes/config.json or restore it from version control.', parsed.error))
    } else {
      checks.push(result('config-json', 'ERROR', true, 'NES config JSON is readable'))
      const configErrors = validateConfig(parsed.value)
      checks.push(result('config-contract', 'ERROR', configErrors.length === 0,
        configErrors.length ? 'NES config violates its contract' : 'NES config contract valid',
        'Run `nes init` in a clean project and compare the generated config.', configErrors))
    }
  } else {
    checks.push(result('config-json', 'ERROR', false, '.nes/config.json is missing', 'Run `nes init`.'))
  }

  for (const dirName of ['gates', 'evidence', 'checkpoints', 'rules', 'docs', 'adapters']) {
    const dir = path.join(nesDir, dirName)
    checks.push(result(`dir-${dirName}`, 'ERROR', fs.existsSync(dir),
      fs.existsSync(dir) ? `${dirName}/ exists` : `${dirName}/ is missing`,
      'Run `nes init` to recreate missing NES directories.'))
  }

  const gateFiles = listJsonFiles(path.join(nesDir, 'gates'))
  if (gateFiles.length === 0) {
    checks.push(result('gates-present', 'WARNING', false, 'No gate definitions found',
      'Add at least one project-owned capability or regression gate before release.'))
  } else {
    checks.push(result('gates-present', 'WARNING', true, `${gateFiles.length} gate definition(s) found`))
  }

  for (const gateFile of gateFiles) {
    const parsed = safeJson(gateFile)
    if (!parsed.ok) {
      checks.push(result(`gate:${path.basename(gateFile)}`, 'ERROR', false, 'Gate JSON is corrupt',
        `Repair ${path.relative(resolved, gateFile)}.`, parsed.error))
      continue
    }
    try {
      validateGateDefinition(parsed.value)
      checks.push(result(`gate:${path.basename(gateFile)}`, 'ERROR', true, 'Gate definition valid'))
    } catch (error) {
      checks.push(result(`gate:${path.basename(gateFile)}`, 'ERROR', false, 'Gate definition invalid',
        `Repair ${path.relative(resolved, gateFile)}.`, error.details ?? [error.message]))
    }
  }

  for (const jsonDir of ['evidence', 'checkpoints']) {
    for (const file of listJsonFiles(path.join(nesDir, jsonDir))) {
      const parsed = safeJson(file)
      checks.push(result(`${jsonDir}:${path.basename(file)}`, 'ERROR', parsed.ok,
        parsed.ok ? `${jsonDir} JSON readable` : `${jsonDir} JSON is corrupt`,
        `Repair ${path.relative(resolved, file)} or restore it from version control.`, parsed.ok ? null : parsed.error))
    }
  }

  const tempProbe = path.join(nesDir, `.doctor-write-${process.pid}-${Date.now()}`)
  try {
    fs.writeFileSync(tempProbe, os.platform())
    fs.rmSync(tempProbe, { force: true })
    checks.push(result('state-writable', 'ERROR', true, '.nes state is writable'))
  } catch (error) {
    checks.push(result('state-writable', 'ERROR', false, '.nes state is not writable',
      'Fix filesystem permissions before running NES write operations.', error.message))
  }

  const errors = checks.filter((check) => !check.ok && check.level === 'ERROR').length
  const warnings = checks.filter((check) => !check.ok && check.level === 'WARNING').length
  const status = errors > 0 ? 'ERROR' : warnings > 0 ? 'WARNING' : 'OK'

  return {
    schema_version: 'nes.doctor-result.v1',
    root: resolved,
    status,
    summary: { total: checks.length, errors, warnings, passed: checks.filter((check) => check.ok).length },
    project: detected,
    checks,
    generated_at: new Date().toISOString()
  }
}
