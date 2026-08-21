import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const PROMOTABLE_TYPES = new Set([
  'user_correction',
  'regression',
  'debugging_pattern',
  'workaround',
  'project_pattern'
])

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function slug(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'rule'
}

function fingerprint(event) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      type: event.type,
      title: normalizeText(event.title),
      instruction: normalizeText(event.instruction),
      scope: event.scope ?? 'project',
      applies_to: [...(event.applies_to ?? [])].sort()
    }))
    .digest('hex')
}

export function evaluateLearningEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('learning event must be an object')
  if (!PROMOTABLE_TYPES.has(event.type) && event.type !== 'one_off') throw new Error(`unsupported learning event type: ${event.type}`)
  if (!normalizeText(event.title)) throw new Error('learning event title is required')
  if (!normalizeText(event.instruction)) throw new Error('learning event instruction is required')
  if (event.scope && !['project', 'global'].includes(event.scope)) throw new Error('learning event scope must be project or global')

  const promotable = PROMOTABLE_TYPES.has(event.type) && event.promote !== false
  return {
    schema_version: 'nes.learning-decision.v1',
    promotable,
    reason: promotable ? 'reusable-pattern' : 'one-off-or-explicitly-blocked',
    fingerprint: fingerprint(event),
    normalized: {
      type: event.type,
      title: normalizeText(event.title),
      instruction: normalizeText(event.instruction),
      scope: event.scope ?? 'project',
      source_id: event.source_id ?? null,
      source: event.source ?? null,
      applies_to: event.applies_to ?? [],
      metadata: event.metadata ?? {}
    }
  }
}

function readIndex(file) {
  if (!fs.existsSync(file)) return { schema_version: 'nes.rules-index.v1', rules: [] }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function promoteLearningEvent(root, event) {
  const decision = evaluateLearningEvent(event)
  if (!decision.promotable) return { promoted: false, decision }

  const scopeDir = decision.normalized.scope === 'global' ? 'global' : 'project'
  const rulesDir = path.join(root, '.nes', 'rules', scopeDir)
  fs.mkdirSync(rulesDir, { recursive: true })

  const indexFile = path.join(root, '.nes', 'rules', 'index.json')
  fs.mkdirSync(path.dirname(indexFile), { recursive: true })
  const index = readIndex(indexFile)
  const existing = index.rules.find((rule) => rule.fingerprint === decision.fingerprint)
  if (existing) return { promoted: false, duplicate: true, decision, rule: existing }

  const sequence = String(index.rules.length + 1).padStart(3, '0')
  const ruleId = `RULE-${sequence}`
  const baseName = `${ruleId}-${slug(decision.normalized.title)}`
  const jsonFile = path.join(rulesDir, `${baseName}.json`)
  const markdownFile = path.join(rulesDir, `${baseName}.md`)
  const rule = {
    schema_version: 'nes.rule.v1',
    id: ruleId,
    fingerprint: decision.fingerprint,
    created_at: new Date().toISOString(),
    ...decision.normalized
  }

  fs.writeFileSync(jsonFile, JSON.stringify(rule, null, 2))
  const markdown = [
    `# ${rule.id} — ${rule.title}`,
    '',
    `- Scope: ${rule.scope}`,
    `- Type: ${rule.type}`,
    `- Created: ${rule.created_at}`,
    rule.source_id ? `- Source ID: ${rule.source_id}` : null,
    rule.source ? `- Source: ${rule.source}` : null,
    '',
    '## Rule',
    '',
    rule.instruction,
    '',
    rule.applies_to.length ? '## Applies to' : null,
    rule.applies_to.length ? '' : null,
    ...rule.applies_to.map((item) => `- ${item}`),
    ''
  ].filter((line) => line !== null).join('\n')
  fs.writeFileSync(markdownFile, markdown)

  index.rules.push({
    id: rule.id,
    fingerprint: rule.fingerprint,
    scope: rule.scope,
    type: rule.type,
    title: rule.title,
    json_file: path.relative(root, jsonFile).replaceAll('\\', '/'),
    markdown_file: path.relative(root, markdownFile).replaceAll('\\', '/')
  })
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2))

  return { promoted: true, decision, rule, json_file: jsonFile, markdown_file: markdownFile, index_file: indexFile }
}

export function loadRules(root, { scope = 'all' } = {}) {
  const indexFile = path.join(root, '.nes', 'rules', 'index.json')
  const index = readIndex(indexFile)
  const selected = scope === 'all' ? index.rules : index.rules.filter((rule) => rule.scope === scope)
  return selected.map((entry) => ({
    ...entry,
    rule: JSON.parse(fs.readFileSync(path.join(root, entry.json_file), 'utf8'))
  }))
}
