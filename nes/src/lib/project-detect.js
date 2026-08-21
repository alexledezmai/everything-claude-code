import fs from 'node:fs'
import path from 'node:path'

const exists = (root, file) => fs.existsSync(path.join(root, file))

function readPackageJson(root) {
  const file = path.join(root, 'package.json')
  if (!fs.existsSync(file)) return { exists: false, value: null, issue: null }
  try {
    return { exists: true, value: JSON.parse(fs.readFileSync(file, 'utf8')), issue: null }
  } catch (error) {
    return {
      exists: true,
      value: null,
      issue: {
        code: 'NES_INVALID_PACKAGE_JSON',
        file,
        message: error.message
      }
    }
  }
}

function declaredPackageManager(packageJson) {
  const raw = packageJson?.packageManager
  if (typeof raw !== 'string') return null
  const name = raw.split('@')[0]
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(name) ? name : null
}

export function detectProject(root = process.cwd()) {
  const packageInfo = readPackageJson(root)
  const packageJson = packageInfo.value
  const scripts = packageJson?.scripts ?? {}
  const dependencies = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {})
  }

  const packageManager = exists(root, 'pnpm-lock.yaml')
    ? 'pnpm'
    : exists(root, 'yarn.lock')
      ? 'yarn'
      : exists(root, 'bun.lockb') || exists(root, 'bun.lock')
        ? 'bun'
        : exists(root, 'package-lock.json')
          ? 'npm'
          : declaredPackageManager(packageJson)

  const framework = dependencies.next
    ? 'nextjs'
    : dependencies.react
      ? 'react'
      : exists(root, 'wp-config.php') || exists(root, 'wp-content')
        ? 'wordpress'
        : null

  const tests = dependencies.vitest
    ? 'vitest'
    : dependencies.jest
      ? 'jest'
      : exists(root, 'pytest.ini') || exists(root, 'pyproject.toml')
        ? 'pytest'
        : null

  const e2e = dependencies['@playwright/test']
    ? 'playwright'
    : dependencies.cypress
      ? 'cypress'
      : null

  return {
    root: path.resolve(root),
    runtime: packageInfo.exists ? 'node' : exists(root, 'composer.json') ? 'php' : exists(root, 'pyproject.toml') ? 'python' : 'unknown',
    packageManager,
    framework,
    database: exists(root, 'supabase') ? 'supabase' : null,
    docker: exists(root, 'docker-compose.yml') || exists(root, 'compose.yml') || exists(root, 'Dockerfile'),
    tests,
    e2e,
    scripts: {
      build: scripts.build ?? null,
      lint: scripts.lint ?? null,
      test: scripts.test ?? null,
      typecheck: scripts.typecheck ?? scripts['type-check'] ?? null
    },
    issues: packageInfo.issue ? [packageInfo.issue] : []
  }
}
