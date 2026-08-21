import fs from 'node:fs'
import path from 'node:path'

const commands = {
  detect: 'node nes/src/cli.js detect',
  verify: 'node nes/src/cli.js verify',
  gate: 'node nes/src/cli.js gate',
  checkpoint: 'node nes/src/cli.js checkpoint',
  compare: 'node nes/src/cli.js compare',
  codemap: 'node nes/src/cli.js codemap',
  adr: 'node nes/src/cli.js adr',
  bible: 'node nes/src/cli.js bible',
  learn: 'node nes/src/cli.js learn',
  rules: 'node nes/src/cli.js rules'
}

const adapterNotes = {
  chatgpt: [
    'Use NES outputs as project truth. Do not invent gate results or product state.',
    'Load project/global rules before proposing implementation changes.',
    'Prefer independent verification before declaring READY.'
  ],
  'claude-code': [
    'Treat NES as the source of engineering truth; slash commands are only wrappers.',
    'Do not bypass NES gates with prose-only approvals.'
  ],
  codex: [
    'Run NES commands from the repository root and preserve machine-readable outputs.',
    'Use project rules before code edits and verification before completion.'
  ],
  'github-actions': [
    'CI is a runner for NES, not a second implementation of NES policy.',
    'Fail the workflow when NES reports FAIL, NOT_READY, or REGRESSION.'
  ]
}

export function createAdapterManifest(adapter) {
  if (!Object.hasOwn(adapterNotes, adapter)) throw new Error(`Unsupported adapter: ${adapter}`)
  return {
    schema_version: 'nes.adapter.v1',
    adapter,
    protocol_version: '1',
    entrypoint: 'nes/src/cli.js',
    commands,
    notes: adapterNotes[adapter]
  }
}

function instructionText(manifest) {
  const lines = [
    `# NES Adapter: ${manifest.adapter}`,
    '',
    'Navi Engineering System (NES) owns project engineering contracts. This adapter only translates the host environment to the NES CLI.',
    '',
    '## Required behavior',
    ...manifest.notes.map((note) => `- ${note}`),
    '',
    '## Commands',
    ...Object.entries(manifest.commands).map(([name, command]) => `- ${name}: \`${command}\``),
    '',
    '## Completion rule',
    'Do not report a gate as passed, a project as READY, or a regression as resolved unless the corresponding NES command produced that result.'
  ]
  return `${lines.join('\n')}\n`
}

export function writeAdapter(root, adapter) {
  const manifest = createAdapterManifest(adapter)
  const dir = path.join(root, '.nes', 'adapters', adapter)
  fs.mkdirSync(dir, { recursive: true })
  const manifestFile = path.join(dir, 'manifest.json')
  const instructionFile = path.join(dir, 'INSTRUCTIONS.md')
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
  fs.writeFileSync(instructionFile, instructionText(manifest))
  return { adapter, manifest_file: manifestFile, instruction_file: instructionFile, manifest }
}

export function writeAllAdapters(root) {
  return ['chatgpt', 'claude-code', 'codex', 'github-actions'].map((adapter) => writeAdapter(root, adapter))
}
