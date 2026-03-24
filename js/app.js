import { openDB } from './db.js';
import { concepts } from './concepts.js';
import { initRouter } from './router.js';
import { renderHome } from '../views/home.js';
import { renderConceptMap } from '../views/concept-map.js';
import { renderLearn } from '../views/learn.js';
import { renderQuiz } from '../views/quiz.js';
import { renderResults } from '../views/results.js';
import { renderProgress } from '../views/progress.js';

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// Store concepts globally for views to access
window.CONCEPTS = concepts;

async function init() {
  await openDB();

  initRouter({
    home: () => renderHome(document.getElementById('view-home')),
    concepts: () => renderConceptMap(document.getElementById('view-concepts')),
    learn: (id) => renderLearn(document.getElementById('view-learn'), id),
    quiz: () => renderQuiz(document.getElementById('view-quiz')),
    results: () => renderResults(document.getElementById('view-results')),
    progress: () => renderProgress(document.getElementById('view-progress')),
  });
}

init().catch((err) => {
  console.error('Init failed:', err);
  const el = document.getElementById('view-home');
  const msg = document.createElement('p');
  msg.style.cssText = 'padding:20px;color:var(--red)';
  msg.textContent = 'Failed to start: ' + err.message;
  el.appendChild(msg);
  el.classList.add('view--active');
});
