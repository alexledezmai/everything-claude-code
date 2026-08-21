import fs from 'node:fs'
import path from 'node:path'

const exists = (root, file) => fs.existsSync(path.join(root, file))

export function detectProject(root = process.cwd()) {
  const packageJsonPath = path.join(root, 'package.json')
  const packageJson = exists(root, 'package.json')
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    : null

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
          : null

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
    runtime: packageJson ? 'node' : exists(root, 'composer.json') ? 'php' : exists(root, 'pyproject.toml') ? 'python' : 'unknown',
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
    }
  }
}
