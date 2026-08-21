import fs from 'node:fs'
import path from 'node:path'
import { detectProject } from './project-detect.js'
import { writeAllAdapters } from './adapters.js'

const NES_VERSION = '1.0.0-rc.1'

function readPackageName(root) {
  const file = path.join(root, 'package.json')
  if (!fs.existsSync(file)) return path.basename(root)
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).name ?? path.basename(root)
  } catch {
    return path.basename(root)
  }
}

function writeIfMissing(file, content, created, preserved) {
  if (fs.existsSync(file)) {
    preserved.push(file)
    return false
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  created.push(file)
  return true
}

export function initProject(root = process.cwd(), { adapters = true } = {}) {
  const resolved = path.resolve(root)
  const detected = detectProject(resolved)
  const nesDir = path.join(resolved, '.nes')
  const created = []
  const preserved = []

  fs.mkdirSync(nesDir, { recursive: true })
  for (const dir of ['gates', 'evidence', 'checkpoints', 'rules/project', 'rules/global', 'docs/adr']) {
    fs.mkdirSync(path.join(nesDir, dir), { recursive: true })
  }

  const config = {
    schema_version: 'nes.config.v1',
    nes_version: NES_VERSION,
    project: {
      name: readPackageName(resolved),
      detected: {
        runtime: detected.runtime,
        package_manager: detected.packageManager,
        framework: detected.framework,
        database: detected.database,
        docker: detected.docker,
        tests: detected.tests,
        e2e: detected.e2e
      }
    },
    policies: {
      protect_existing: true,
      require_gate_before_release: true,
      learning_mode: 'curated'
    }
  }

  const configFile = path.join(nesDir, 'config.json')
  writeIfMissing(configFile, `${JSON.stringify(config, null, 2)}\n`, created, preserved)

  const readme = `# NES project state\n\nThis directory contains project-owned engineering contracts.\n\n- gates/: capability and regression definitions\n- evidence/: gate evidence and baselines\n- checkpoints/: durable project-state snapshots\n- rules/: curated project/global rules\n- docs/: generated codemap, ADRs and Product Bible\n- adapters/: host-specific execution instructions\n\nNES initialization is non-destructive: existing files are preserved.\n`
  writeIfMissing(path.join(nesDir, 'README.md'), readme, created, preserved)

  const exampleGate = {
    id: 'PROJECT-FOUNDATION',
    type: 'capability',
    description: 'Starter gate created by nes init. Replace checks with project-owned requirements.',
    success: { required: 'all' },
    checks: [{ id: 'project-detected', path: 'project_detected', op: 'truthy' }]
  }
  writeIfMissing(
    path.join(nesDir, 'gates', 'foundation.example.json'),
    `${JSON.stringify(exampleGate, null, 2)}\n`,
    created,
    preserved
  )

  const exampleEvidence = { project_detected: true }
  writeIfMissing(
    path.join(nesDir, 'evidence', 'foundation.example.json'),
    `${JSON.stringify(exampleEvidence, null, 2)}\n`,
    created,
    preserved
  )

  let adapterResults = []
  if (adapters) adapterResults = writeAllAdapters(resolved)

  return {
    schema_version: 'nes.init-result.v1',
    nes_version: NES_VERSION,
    root: resolved,
    config_file: configFile,
    created,
    preserved,
    adapters: adapterResults.map((entry) => entry.manifest.adapter),
    detected,
    status: 'INITIALIZED'
  }
}
