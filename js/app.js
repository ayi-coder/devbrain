import { openDB } from './db.js';
import { loadCurriculum } from './curriculum-loader.js';
import { initRouter } from './router.js';
import { renderProgress } from '../views/home.js';
import { renderCurriculum } from '../views/curriculum.js';
import { renderQuiz } from '../views/quiz.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

async function init() {
  await openDB();
  await loadCurriculum();

  initRouter({
    explore:  (params) => renderCurriculum(document.getElementById('view-explore'), params),
    quiz:     (params) => renderQuiz(document.getElementById('view-quiz'), params),
    progress: (params) => renderProgress(document.getElementById('view-progress'), params),
  });
}

init().catch((err) => {
  console.error('Init failed:', err);
  const el = document.getElementById('view-explore');
  el.textContent = 'Failed to start: ' + err.message;
  el.style.cssText = 'padding:20px;color:var(--red)';
  el.classList.add('view--active');
});
