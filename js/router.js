let quizActive = false;

export function setQuizActive(val) {
  quizActive = val;
}

/**
 * Pure function -- exported for tests.
 * Parses a full location.hash string (e.g. '#quiz?preload=foo') into { view, params }.
 */
export function parseHashParams(hash) {
  const raw = (hash || '').replace(/^#/, '') || 'explore';
  const [path, query] = raw.split('?');
  const view = path.split('/')[0] || 'explore';
  const params = {};
  if (query) {
    for (const part of query.split('&')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const k = decodeURIComponent(part.slice(0, eqIdx));
      const v = decodeURIComponent(part.slice(eqIdx + 1));
      params[k] = v;
    }
  }
  return { view, params };
}

/**
 * Pure function -- exported for tests.
 * Builds a hash string from a view name and optional params object.
 * Omits params with empty/undefined values.
 */
export function buildHashString(view, params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return view;
  const query = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${view}?${query}`;
}

export function navigate(view, params = {}) {
  location.hash = buildHashString(view, params);
}

export function initRouter(routes) {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => navigate(tab.dataset.view));
  });
  window.addEventListener('hashchange', () => handleRoute(routes));
  handleRoute(routes);
}

function handleRoute(routes) {
  const { view, params } = parseHashParams(location.hash);

  if (quizActive && view !== 'quiz') {
    const leave = confirm('Quit quiz? Progress will be lost.');
    if (!leave) {
      location.hash = 'quiz';
      return;
    }
    quizActive = false;
  }

  document.querySelectorAll('.view').forEach((el) => el.classList.remove('view--active'));

  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('view--active');

  if (routes[view]) routes[view](params);

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('nav-tab--active', tab.dataset.view === view);
  });
}
