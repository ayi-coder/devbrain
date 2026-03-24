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
