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

export function compareCheckpoints(a, b) {
  const left = JSON.parse(fs.readFileSync(a, 'utf8'))
  const right = JSON.parse(fs.readFileSync(b, 'utf8'))

  return {
    from: left.id,
    to: right.id,
    sha_changed: left.git?.sha !== right.git?.sha,
    gate: {
      from: left.gate?.status ?? null,
      to: right.gate?.status ?? null
    },
    verification: {
      from: left.verification?.status ?? null,
      to: right.verification?.status ?? null
    }
  }
}
