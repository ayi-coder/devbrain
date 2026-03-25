/**
 * Zone ID -> hex color.
 * Pass zone ID from a content record's .zone field.
 * Bridge nodes have no zone -- use zoneColor(undefined) which returns the 'bridge' fallback.
 */
export const ZONE_COLORS = {
  'your-machine':   '#c678dd',
  'shell-terminal': '#e5c07b',
  'git-github':     '#e06c75',
  'the-web':        '#61afef',
  'editor-code':    '#98c379',
  'packages-env':   '#56b6c2',
  'ai-prompting':   '#d19a66',
  'cloud-deploy':   '#abb2bf',
  'bridge':         '#abb2bf',
};

export function zoneColor(zoneId) {
  return ZONE_COLORS[zoneId] ?? ZONE_COLORS['bridge'];
}

export const ZONE_NAMES = {
  'your-machine':   'Your Machine',
  'shell-terminal': 'Shell & Terminal',
  'git-github':     'Git & GitHub',
  'the-web':        'The Web',
  'editor-code':    'Editor & Code',
  'packages-env':   'Packages & Env',
  'ai-prompting':   'AI & Prompting',
  'cloud-deploy':   'Cloud & Deploy',
};

export const ZONE_ORDER = [
  'your-machine', 'shell-terminal', 'git-github', 'the-web',
  'editor-code', 'packages-env', 'ai-prompting', 'cloud-deploy',
];

/** Converts zone-style kebab IDs to Title Case display names.
 *  e.g. 'bash-commands' → 'Bash Commands' */
export function subcatName(id) {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
