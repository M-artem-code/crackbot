import 'server-only'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUNNER_ROOT = join(process.cwd(), 'runner')
const TEMPLATE_ROOT = join(RUNNER_ROOT, 'templates')
const ASSET_ROOT = join(RUNNER_ROOT, 'assets')

const requirements = [
  'nodriver==0.48.1',
  'requests==2.32.3',
  'rich==13.9.4',
].join('\n') + '\n'

export const DEFAULT_PYTHON_REQUIREMENTS = requirements

export function pythonTemplateFor(slug: string) {
  const template = slug === 'adflex' ? 'adflex' : 'v0'
  return readFileSync(join(TEMPLATE_ROOT, template, 'bot.py'), 'utf8')
}

export function pythonTemplateAssetsFor(slug: string) {
  const assets: Record<string, string> = {
    'mail_client.py': readFileSync(join(ASSET_ROOT, 'mail_client.py'), 'utf8'),
    'stealth.js': readFileSync(join(ASSET_ROOT, 'stealth.js'), 'utf8'),
  }
  if (slug !== 'adflex') assets['ref_pool.py'] = readFileSync(join(ASSET_ROOT, 'ref_pool.py'), 'utf8')
  return assets
}
