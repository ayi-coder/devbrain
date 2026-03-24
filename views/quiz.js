import { getAllProgress } from '../js/db.js';
import { getQuestionType, getMiniQuestionType, updateDifficulty } from '../js/adaptive.js';
import { navigate, setQuizActive } from '../js/router.js';

export async function renderQuiz(container) {
  const params = JSON.parse(sessionStorage.getItem('quizParams') || '{}');
  const conceptIds = params.conceptIds || [];
  const sessionType = params.sessionType || 'standard';

  if (conceptIds.length === 0) {
    container.innerHTML = '<p>No concepts to quiz. <a href="#home" style="color:var(--blue)">Go home</a></p>';
    return;
  }

  const concepts = window.CONCEPTS;
  let index = 0;
  let difficulty = 'Medium';
  let consCorrect = 0;
  let consWrong = 0;
  const results = [];
  const sessionId = crypto.randomUUID();
  let highestDifficulty = 'Medium';
  const diffOrder = ['Easy', 'Medium', 'Hard'];

  setQuizActive(true);

  function renderQuestion() {
    if (index >= conceptIds.length) {
      setQuizActive(false);
      sessionStorage.setItem('sessionResults', JSON.stringify({
        results,
        sessionId,
        highestDifficulty,
        sessionType,
        conceptIds,
      }));
      navigate('#results');
      return;
    }

    const conceptId = conceptIds[index];
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) {
      index++;
      renderQuestion();
      return;
    }

    const qType = sessionType === 'mini'
      ? getMiniQuestionType(index)
      : getQuestionType(difficulty);

    const question = concept.quiz.find((q) => q.type === qType) || concept.quiz[0];
    const total = conceptIds.length;
    const progressPct = Math.round(((index) / total) * 100);

    const diffBadgeColor = difficulty === 'Easy' ? 'var(--green)'
      : difficulty === 'Medium' ? 'var(--yellow)'
      : 'var(--red)';

    let answerHTML = '';
    if (question.type === 'mcq') {
      const letters = ['A', 'B', 'C', 'D'];
      answerHTML = question.options.map((opt, i) => `
        <button class="quiz-option" data-index="${i}">
          <span class="opt-letter">${letters[i]}</span>
          <span>${opt}</span>
        </button>
      `).join('');
    } else if (question.type === 'true_false') {
      answerHTML = `
        <button class="quiz-option" data-answer="true">
          <span class="opt-letter">T</span>
          <span>True</span>
        </button>
        <button class="quiz-option" data-answer="false">
          <span class="opt-letter">F</span>
          <span>False</span>
        </button>
      `;
    } else {
      answerHTML = `
        <div style="display:flex;gap:8px;">
          <input type="text" class="search-input" id="fill-input" placeholder="Type your answer..." style="margin-bottom:0;flex:1;">
          <button class="btn-primary" id="fill-submit" style="width:auto;padding:12px 20px;">Submit</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:13px;color:var(--text-muted);">Question ${index + 1} of ${total}</span>
        <span class="chip" style="background:${diffBadgeColor}22;color:${diffBadgeColor};border-color:${diffBadgeColor}44;">${difficulty}</span>
      </div>
      <div class="progress-bar mb-16">
        <div class="progress-fill" style="width:${progressPct}%"></div>
      </div>
      <div style="font-size:18px;margin-bottom:4px;">${concept.emoji} ${concept.name}</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:20px;line-height:1.5;">${question.question}</div>
      <div id="answer-area">${answerHTML}</div>
      <div id="feedback" style="margin-top:12px;"></div>
    `;

    let answered = false;

    function handleAnswer(isCorrect, selectedEl, correctEl) {
      if (answered) return;
      answered = true;

      results.push({ conceptId, correct: isCorrect });

      if (isCorrect) {
        consCorrect++;
        consWrong = 0;
      } else {
        consWrong++;
        consCorrect = 0;
      }

      difficulty = updateDifficulty(difficulty, consCorrect, consWrong);
      if (diffOrder.indexOf(difficulty) > diffOrder.indexOf(highestDifficulty)) {
        highestDifficulty = difficulty;
      }

      if (selectedEl) {
        selectedEl.classList.add(isCorrect ? 'quiz-option--correct' : 'quiz-option--wrong');
      }
      if (correctEl && !isCorrect) {
        correctEl.classList.add('quiz-option--correct');
      }

      const feedbackEl = container.querySelector('#feedback');
      if (isCorrect) {
        feedbackEl.innerHTML = '<span style="color:var(--green);font-weight:600;">\u2713 Correct!</span>';
      } else {
        const correctAnswer = question.type === 'mcq' ? question.options[question.answer] : String(question.answer);
        feedbackEl.innerHTML = '<span style="color:var(--red);font-weight:600;">\u2717 Wrong \u2014 the answer is: ' + correctAnswer + '</span>';
      }

      container.querySelectorAll('.quiz-option').forEach((btn) => {
        btn.style.pointerEvents = 'none';
      });

      setTimeout(() => {
        index++;
        renderQuestion();
      }, 1200);
    }

    if (question.type === 'mcq') {
      container.querySelectorAll('.quiz-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const selected = parseInt(btn.dataset.index);
          const isCorrect = selected === question.answer;
          const correctBtn = container.querySelector('.quiz-option[data-index="' + question.answer + '"]');
          handleAnswer(isCorrect, btn, correctBtn);
        });
      });
    } else if (question.type === 'true_false') {
      container.querySelectorAll('.quiz-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const selected = btn.dataset.answer === 'true';
          const isCorrect = selected === question.answer;
          const correctBtn = container.querySelector('.quiz-option[data-answer="' + question.answer + '"]');
          handleAnswer(isCorrect, btn, correctBtn);
        });
      });
    } else {
      const submitBtn = container.querySelector('#fill-submit');
      const input = container.querySelector('#fill-input');
      const doSubmit = () => {
        const userAnswer = input.value.trim().toLowerCase();
        const correctAnswer = String(question.answer).trim().toLowerCase();
        const isCorrect = userAnswer === correctAnswer;
        handleAnswer(isCorrect, null, null);
      };
      submitBtn.addEventListener('click', doSubmit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSubmit();
      });
    }
  }

  renderQuestion();
}
