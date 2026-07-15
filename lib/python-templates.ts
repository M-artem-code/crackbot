import 'server-only'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const TEMPLATE_ROOT = join(process.cwd(), 'agent', 'templates')

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
    'mail_client.py': readFileSync(join(TEMPLATE_ROOT, 'shared', 'mail_client.py'), 'utf8'),
    'stealth.js': readFileSync(join(TEMPLATE_ROOT, 'shared', 'stealth.js'), 'utf8'),
  }
  if (slug !== 'adflex') assets['ref_pool.py'] = readFileSync(join(TEMPLATE_ROOT, 'v0', 'ref_pool.py'), 'utf8')
  return assets
}
