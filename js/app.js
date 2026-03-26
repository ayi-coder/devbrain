import { openDB } from './db.js';
import { loadCurriculum } from './curriculum-loader.js';
import { initRouter } from './router.js';
import { renderHome } from '../views/home.js';
import { renderCurriculum } from '../views/curriculum.js';
import { renderQuiz } from '../views/quiz.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

async function init() {
  await openDB();
  await loadCurriculum();

  initRouter({
    home:       (params) => renderHome(document.getElementById('view-home'), params),
    curriculum: (params) => renderCurriculum(document.getElementById('view-curriculum'), params),
    quiz:       (params) => renderQuiz(document.getElementById('view-quiz'), params),
  });
}

init().catch((err) => {
  console.error('Init failed:', err);
  const el = document.getElementById('view-home');
  el.textContent = 'Failed to start: ' + err.message;
  el.style.cssText = 'padding:20px;color:var(--red)';
  el.classList.add('view--active');
});
