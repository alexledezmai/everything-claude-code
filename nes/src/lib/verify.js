import { spawnSync } from 'node:child_process'
import { detectProject } from './project-detect.js'

function commandFor(pm, script) {
  if (!pm || !script) return null
  if (pm === 'npm') return ['npm', ['run', script]]
  return [pm, [script]]
}

function runStep(name, command, args, cwd) {
  const started = Date.now()
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })

  return {
    name,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exit_code: result.status,
    duration_ms: Date.now() - started,
    stdout: (result.stdout ?? '').slice(-8000),
    stderr: (result.stderr ?? result.error?.message ?? '').slice(-8000)
  }
}

export function buildVerificationPlan(root = process.cwd()) {
  const project = detectProject(root)
  const plan = []
  const packageManager = project.packageManager ?? (project.runtime === 'node' ? 'npm' : null)

  for (const [name, script] of Object.entries(project.scripts)) {
    if (!script) continue
    const command = commandFor(packageManager, name)
    if (command) plan.push({ name, command: command[0], args: command[1] })
  }

  if (project.tests && !project.scripts.test) {
    if (project.tests === 'pytest') plan.push({ name: 'test', command: 'pytest', args: [] })
  }

  return { project, plan }
}

export function verifyProject(root = process.cwd()) {
  const { project, plan } = buildVerificationPlan(root)
  const results = []

  if (project.issues?.length) {
    return {
      schema_version: 'nes.verification-result.v1',
      status: 'NOT_READY',
      project,
      results,
      reason: 'PROJECT_DETECTION_ISSUES',
      generated_at: new Date().toISOString()
    }
  }

  if (plan.length === 0) {
    return {
      schema_version: 'nes.verification-result.v1',
      status: 'NOT_READY',
      project,
      results,
      reason: 'NO_VERIFICATION_STEPS',
      generated_at: new Date().toISOString()
    }
  }

  for (const step of plan) {
    const result = runStep(step.name, step.command, step.args, root)
    results.push(result)
    if (step.name === 'build' && result.status === 'FAIL') break
  }

  const failed = results.filter((result) => result.status === 'FAIL')
  return {
    schema_version: 'nes.verification-result.v1',
    status: failed.length ? 'NOT_READY' : 'READY',
    project,
    results,
    reason: failed.length ? 'VERIFICATION_FAILED' : null,
    generated_at: new Date().toISOString()
  }
}
