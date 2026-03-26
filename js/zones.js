/**
 * Zone ID -> hex color.
 * Pass zone ID from a content record's .zone field.
 */
export const ZONE_COLORS = {
  'your-machine':   '#c678dd',
  'shell-terminal': '#e5c07b',
  'web-foundations':'#61afef',
  'code-concepts':  '#98c379',
  'git':            '#e06c75',
  'packages-env':   '#56b6c2',
  'databases':      '#4a9080',
  'apis':           '#d19a66',
  'deployment':     '#abb2bf',
  'ai-llms':        '#7b91f5',
};

export function zoneColor(zoneId) {
  return ZONE_COLORS[zoneId] ?? '#abb2bf';
}

export const ZONE_NAMES = {
  'your-machine':   'Your Machine',
  'shell-terminal': 'Shell & Terminal',
  'web-foundations':'Web Foundations',
  'code-concepts':  'Code Concepts',
  'git':            'Git & Version Control',
  'packages-env':   'Packages & Environment',
  'databases':      'Databases',
  'apis':           'APIs',
  'deployment':     'Deployment',
  'ai-llms':        'AI & LLMs',
};

export const ZONE_ORDER = [
  'your-machine',
  'shell-terminal',
  'web-foundations',
  'code-concepts',
  'packages-env',
  'git',
  'databases',
  'apis',
  'deployment',
  'ai-llms',
];

/** Converts subcategory IDs to display names. */
const SUBCAT_DISPLAY = {
  'powershell': 'PowerShell',
};

export function subcatName(id) {
  if (SUBCAT_DISPLAY[id]) return SUBCAT_DISPLAY[id];
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Short descriptions shown when tapping a subcategory label. */
export const SUBCAT_DESCRIPTIONS = {
  'operating-systems':
    'The software layer that runs your computer — managing hardware, memory, and every program that starts up.',
  'file-system':
    'How files and folders are organized on disk, and how your OS keeps track of where everything lives.',
  'paths':
    'How to reference any file or folder on your system — using either the full address from the root, or a direction relative to where you already are.',
  'bash':
    'The default shell on Linux and macOS. The language you type in the terminal to navigate files, run programs, and chain commands together.',
  'powershell':
    "Microsoft's modern shell for Windows — more powerful than Command Prompt, with object-based output, scripting built in, and cross-platform support.",
  'how-the-web-works':
    'How your browser talks to servers — the request/response cycle, HTTP, status codes, and DNS.',
  'the-browser':
    'The tools built into your browser for inspecting pages, debugging JavaScript, and watching network traffic.',
  'html-css':
    'The building blocks of every web page — structure, layout, and the rules that decide which styles win.',
  'fundamentals':
    'The core ideas every programming language shares — variables, types, functions, and how scope controls what can see what.',
  'errors':
    'How to read what went wrong, what the different error types mean, and how to catch them gracefully.',
  'async-programming':
    'How JavaScript handles work that takes time — callbacks, promises, and the async/await syntax that makes it readable.',
  'modules':
    'How code is split into files, shared between them, and how dependencies are managed.',
  'package-managers':
    'The tools that install, update, and manage the external code your project depends on — npm, npx, and how they work.',
  'project-config':
    'The files that define and configure your project — package.json, node_modules, scripts, and environment variables.',
  'dependencies':
    'How external packages are versioned, locked, and split between what your app needs to run and what only developers need.',
  'core-concepts':
    'The foundational ideas behind this zone — what the system is and how it fits together.',
  'working-locally':
    'The day-to-day workflow — staging changes, branching, merging, and resolving conflicts.',
  'remote-collaboration':
    'How to sync your work with a remote repository and collaborate with others through pull requests.',
  'sql':
    'The language for querying and manipulating data in relational databases.',
  'working-with-databases':
    'The tools and patterns used to connect your app to a database and manage its structure over time.',
  'authentication':
    'How APIs verify who is calling them — API keys, tokens, JWTs, and OAuth flows.',
  'advanced-concepts':
    'Beyond basic requests — rate limits, webhooks, and patterns that come up as you build more complex integrations.',
  'hosting':
    'Where your app actually runs — the difference between static and dynamic hosting, serverless functions, and SSL.',
  'devops-basics':
    'The infrastructure behind shipping code reliably — CI/CD pipelines, containers, and how logs help you debug production.',
  'how-llms-work':
    'What language models actually are under the hood — tokens, context windows, temperature, and why they sometimes make things up.',
  'working-with-ai':
    'How to use AI effectively as a developer — prompts, models, costs, and evaluating whether the output is trustworthy.',
  'building-with-ai':
    'The patterns for building AI-powered features — embeddings, vector search, RAG, agents, and using AI APIs in code.',
};

/**
 * Preferred display order for groups within a subcategory.
 * Groups not in this list are appended at the end in first-seen order.
 */
export const GROUP_ORDER = [
  'Shell Basics',
  'Navigation',
  'File Operations',
  'Reading & Output',
  'Key Concepts',
];
