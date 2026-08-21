import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

export function createCheckpoint({ root = process.cwd(), id, gate = null, verification = null }) {
  if (!id) throw new Error('checkpoint id is required')

  const checkpoint = {
    schema_version: 'nes.checkpoint.v1',
    id,
    created_at: new Date().toISOString(),
    git: {
      sha: git(root, ['rev-parse', 'HEAD']),
      branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
      dirty_files: (git(root, ['status', '--porcelain']) ?? '')
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3))
    },
    gate,
    verification
  }

  const dir = path.join(root, '.nes', 'checkpoints')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${id}.json`)
  fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2))

  return { file, checkpoint }
}

function changedFiles(root, fromSha, toSha) {
  if (!fromSha || !toSha || fromSha === toSha) return []
  const output = git(root, ['diff', '--name-status', fromSha, toSha])
  if (!output) return []
  return output.split('\n').filter(Boolean).map((line) => {
    const [status, ...parts] = line.split('\t')
    return { status, path: parts.join('\t') }
  })
}

export function compareCheckpoints(a, b, root = process.cwd()) {
  const left = JSON.parse(fs.readFileSync(a, 'utf8'))
  const right = JSON.parse(fs.readFileSync(b, 'utf8'))
  const files = changedFiles(root, left.git?.sha, right.git?.sha)

  const gateFrom = left.gate?.status ?? null
  const gateTo = right.gate?.status ?? null
  const verificationFrom = left.verification?.status ?? null
  const verificationTo = right.verification?.status ?? null

  return {
    schema_version: 'nes.checkpoint-diff.v1',
    from: left.id,
    to: right.id,
    sha_changed: left.git?.sha !== right.git?.sha,
    files_changed: files.length,
    files,
    gate: {
      from: gateFrom,
      to: gateTo,
      regression: gateFrom === 'PASS' && gateTo === 'FAIL'
    },
    verification: {
      from: verificationFrom,
      to: verificationTo,
      regression: verificationFrom === 'READY' && verificationTo !== 'READY'
    },
    dirty_files: {
      from: left.git?.dirty_files ?? [],
      to: right.git?.dirty_files ?? []
    },
    status: (gateFrom === 'PASS' && gateTo === 'FAIL') || (verificationFrom === 'READY' && verificationTo !== 'READY')
      ? 'REGRESSION'
      : 'OK'
  }
}
