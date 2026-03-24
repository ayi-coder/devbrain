let quizActive = false;

export function setQuizActive(val) {
  quizActive = val;
}

export function navigate(hash, params = {}) {
  sessionStorage.setItem('routeParams', JSON.stringify(params));
  location.hash = hash;
}

export function getParams() {
  try {
    return JSON.parse(sessionStorage.getItem('routeParams') || '{}');
  } catch {
    return {};
  }
}

export function initRouter(routes) {
  window.addEventListener('hashchange', () => handleRoute(routes));
  handleRoute(routes);
}

function handleRoute(routes) {
  const raw = location.hash.replace('#', '') || 'home';
  const [view, ...rest] = raw.split('/');

  if (quizActive && view !== 'quiz' && view !== 'results') {
    const leave = confirm('Quit quiz? Progress will be lost.');
    if (!leave) {
      location.hash = 'quiz';
      return;
    }
    quizActive = false;
  }

  // Hide all views
  document.querySelectorAll('.view').forEach((el) => {
    el.classList.remove('view--active');
  });

  // Show target view
  const target = document.getElementById('view-' + view);
  if (target) {
    target.classList.add('view--active');
  }

  // Call route handler
  if (routes[view]) {
    routes[view](rest.join('/'));
  }

  // Update bottom nav active tab
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.remove('nav-tab--active');
    if (tab.dataset.view === view) {
      tab.classList.add('nav-tab--active');
    }
  });
}
