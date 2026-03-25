import { openDB, getSRSQueues, getAllContent, getAllUserProgress,
         applyQuizResult, saveSession } from '../js/db.js';
import { zoneColor, ZONE_NAMES } from '../js/zones.js';
import { navigate } from '../js/router.js';

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Module-level state ─────────────────────────────────────────────────────
let _view     = 'builder';
let _session  = [];          // conceptId strings, max 5
let _queue    = [];          // [{conceptId, type, index, question}]
let _queuePos = 0;
let _answers  = [];          // [{conceptId, type, index, correct}]
let _quizData = null;        // {contentMap: Map, progressMap: Map}

/** TEST USE ONLY */
export function _resetQuizState(state = {}) {
  _view     = state.view     ?? 'builder';
  _session  = state.session  ? [...state.session]  : [];
  _queue    = state.queue    ? [...state.queue]    : [];
  _queuePos = state.queuePos ?? 0;
  _answers  = state.answers  ? [...state.answers]  : [];
  _quizData = state.quizData ?? null;
}

// ── Pure functions ─────────────────────────────────────────────────────────

/**
 * Selects quiz questions for one concept based on tier unlock state + LRU history.
 *
 * Tier unlock:
 *   T1 (definition): always
 *   T2 (usage): practiced===true AND concept has usage questions
 *   T3 (anatomy/build): T2 unlocked AND used.usage.length>0 AND anatomy/build data exists
 *
 * Count: T1 only→2 def; T1+T2→1 def+1 usage; T1+T2+T3→1 def+1 usage+1 anatomy/build
 * LRU: prefer unused indices; if all used, restart from full pool.
 * Returns [{type, index, question}]; filters picks where question===undefined.
 */
export function selectQuizQuestions(concept, progress) {
  const used = progress?.used_question_indices
    ?? { definition: [], usage: [], anatomy: [], build: [] };

  const defs      = concept.questions?.definition ?? [];
  const usages    = concept.questions?.usage      ?? [];
  const anatomies = concept.questions?.anatomy    ?? [];
  const builds    = concept.questions?.build      ?? [];

  function pickLRU(questions, usedIndices, count) {
    if (questions.length === 0) return [];
    const unused = questions.map((_, i) => i).filter(i => !usedIndices.includes(i));
    const pool   = unused.length >= count ? unused : questions.map((_, i) => i);
    return pool.slice(0, count).map(i => ({ index: i, question: questions[i] }));
  }

  const t2Unlocked = progress?.practiced === true && usages.length > 0;
  const t3Unlocked = t2Unlocked
    && (used.usage?.length ?? 0) > 0
    && (anatomies.length > 0 || builds.length > 0);

  const picks = [];

  if (!t2Unlocked) {
    pickLRU(defs, used.definition ?? [], 2)
      .forEach(({ index, question }) => picks.push({ type: 'definition', index, question }));
  } else if (!t3Unlocked) {
    pickLRU(defs, used.definition ?? [], 1)
      .forEach(({ index, question }) => picks.push({ type: 'definition', index, question }));
    pickLRU(usages, used.usage ?? [], 1)
      .forEach(({ index, question }) => picks.push({ type: 'usage', index, question }));
  } else {
    pickLRU(defs, used.definition ?? [], 1)
      .forEach(({ index, question }) => picks.push({ type: 'definition', index, question }));
    pickLRU(usages, used.usage ?? [], 1)
      .forEach(({ index, question }) => picks.push({ type: 'usage', index, question }));
    const t3pool = anatomies.length > 0
      ? { arr: anatomies, type: 'anatomy', used: used.anatomy ?? [] }
      : { arr: builds,    type: 'build',   used: used.build   ?? [] };
    pickLRU(t3pool.arr, t3pool.used, 1)
      .forEach(({ index, question }) => picks.push({ type: t3pool.type, index, question }));
  }

  return picks.filter(p => p.question !== undefined);
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function renderQuiz(container, params = {}, dbName = 'devbrain') {
  await openDB(dbName);
  if (params.preload && !_session.includes(params.preload) && _session.length < 5) {
    _session.push(params.preload);
  }
  if (_view === 'quiz')         _renderQuestion(container, dbName);
  else if (_view === 'results') await _renderResults(container, dbName);
  else                          await _renderBuilder(container, dbName);
}

// ── Session builder ────────────────────────────────────────────────────────

async function _renderBuilder(container, dbName) {
  const [{ recommended, overdue }, allProgress] = await Promise.all([
    getSRSQueues(dbName),
    getAllUserProgress(dbName),
  ]);
  const hasSeen = allProgress.some(p => p.seen);
  const isFull = _session.length >= 5;
  const today  = new Date().toISOString().slice(0, 10);
  const allItems   = [...recommended, ...overdue];
  const conceptMap = new Map(allItems.map(({ content }) => [content.id, content]));

  // Session card
  let chipsHtml = '';
  for (const id of _session) {
    const c     = conceptMap.get(id) ?? { name: id, zone: undefined };
    const color = zoneColor(c.zone);
    chipsHtml +=
      '<div class="quiz-chip">' +
        '<span class="quiz-chip__dot" style="background:' + color + '"></span>' +
        '<span>' + _esc(c.name) + '</span>' +
        '<button class="quiz-chip__remove" data-remove="' + _esc(id) + '">\u00d7</button>' +
      '</div>';
  }
  const builderHtml =
    '<div class="quiz-builder">' +
      '<div class="quiz-builder__header">' +
        '<span class="quiz-builder__title">Your session</span>' +
        '<span class="quiz-builder__count">' + _session.length + ' / 5</span>' +
      '</div>' +
      (_session.length === 0
        ? '<div class="quiz-builder__empty">Tap concepts below to add them</div>'
        : '<div class="quiz-builder__chips">' + chipsHtml + '</div>') +
      '<button class="quiz-start-btn"' + (_session.length === 0 ? ' disabled' : '') + '>Start session \u2192</button>' +
    '</div>';

  // Recommended section
  // hasSeen distinguishes "no concepts discovered yet" from "all caught up" (spec §5.6)
  let recHtml = '';
  if (!hasSeen) {
    recHtml =
      '<div class="quiz-empty">' +
        'Explore the map and read lessons first \u2014 concepts you discover will appear here.' +
      '</div>';
  } else if (recommended.length === 0 && overdue.length === 0) {
    recHtml =
      '<div class="quiz-empty">' +
        'You\u2019re all caught up \u2014 pick anything to practice anyway. ' +
        '<button class="quiz-empty__link" id="quiz-browse-link">Browse all concepts</button>' +
      '</div>';
  } else if (recommended.length > 0) {
    recHtml = '<div class="quiz-section-label">Recommended today</div>';
    for (const { content } of recommended) {
      const inSession = _session.includes(content.id);
      const color     = zoneColor(content.zone);
      const zoneName  = ZONE_NAMES[content.zone] ?? content.zone;
      const badgeCls  = !content.practiced ? 'rec-card__badge--new' : 'rec-card__badge--due';
      const badgeTxt  = !content.practiced ? 'NEW' : 'DUE';
      const dimmed    = isFull && !inSession ? ' rec-card--dimmed' : '';
      const addBtn    = isFull && !inSession
        ? '<span class="rec-card__full-label">Full</span>'
        : '<button class="rec-card__add-btn' + (inSession ? ' rec-card__add-btn--added' : '') +
            '" data-rec-add="' + _esc(content.id) + '">' + (inSession ? '\u2713' : '+') + '</button>';
      recHtml +=
        '<div class="rec-card' + dimmed + '">' +
          '<span class="rec-card__dot" style="background:' + color + '"></span>' +
          '<div class="rec-card__body">' +
            '<div class="rec-card__name">'  + _esc(content.name) + '</div>' +
            '<div class="rec-card__zone">'  + _esc(zoneName)     + '</div>' +
          '</div>' +
          '<span class="rec-card__badge ' + badgeCls + '">' + badgeTxt + '</span>' +
          addBtn +
        '</div>';
    }
  }

  // Overdue section
  let dueHtml = '';
  if (overdue.length > 0) {
    dueHtml = '<div class="quiz-section-label">Due for review</div>';
    for (const { content, progress } of overdue) {
      const inSession   = _session.includes(content.id);
      const color       = zoneColor(content.zone);
      const daysOverdue = progress.next_review_date
        ? Math.round((new Date(today) - new Date(progress.next_review_date)) / 86_400_000)
        : '?';
      const daysCls = daysOverdue >= 7 ? 'due-days--red' : daysOverdue >= 3 ? 'due-days--orange' : 'due-days--yellow';
      dueHtml +=
        '<div class="due-row' + (inSession ? ' due-row--added' : '') + '">' +
          '<span class="due-days ' + daysCls + '">' + daysOverdue + 'd</span>' +
          '<span class="due-row__dot" style="background:' + color + '"></span>' +
          '<span class="due-row__name">' + _esc(content.name) + '</span>' +
          '<button class="due-row__add-btn' + (inSession ? ' due-row__add-btn--added' : '') +
              '" data-due-add="' + _esc(content.id) + '"' +
              (isFull && !inSession ? ' disabled' : '') + '>' +
            (inSession ? '\u2713' : '+') +
          '</button>' +
        '</div>';
    }
  }

  container.innerHTML =
    '<div style="padding:16px">' + builderHtml + recHtml + dueHtml + '</div>';

  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _session = _session.filter(s => s !== btn.dataset.remove);
      _renderBuilder(container, dbName).catch((err) => {
        container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
      });
    });
  });
  container.querySelectorAll('[data-rec-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_session.includes(btn.dataset.recAdd) && _session.length < 5) {
        _session.push(btn.dataset.recAdd);
        _renderBuilder(container, dbName).catch((err) => {
          container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
        });
      }
    });
  });
  container.querySelectorAll('[data-due-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_session.includes(btn.dataset.dueAdd) && _session.length < 5) {
        _session.push(btn.dataset.dueAdd);
        _renderBuilder(container, dbName).catch((err) => {
          container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
        });
      }
    });
  });
  const browseLink = container.querySelector('#quiz-browse-link');
  if (browseLink) browseLink.addEventListener('click', () => navigate('curriculum'));
  const startBtn = container.querySelector('.quiz-start-btn');
  if (startBtn) startBtn.addEventListener('click', () => _startSession(container, dbName));
}

// ── Active quiz ────────────────────────────────────────────────────────────

async function _startSession(container, dbName) {
  const [content, progress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);
  _quizData = {
    contentMap:  new Map(content.map(c  => [c.id, c])),
    progressMap: new Map(progress.map(p => [p.id, p])),
  };
  _queue = [];
  for (const conceptId of _session) {
    const concept = _quizData.contentMap.get(conceptId);
    const prog    = _quizData.progressMap.get(conceptId);
    if (!concept) continue;
    selectQuizQuestions(concept, prog).forEach(pick => _queue.push({ conceptId, ...pick }));
  }
  _view = 'quiz'; _queuePos = 0; _answers = [];
  _renderQuestion(container, dbName);
}

function _advance(container, dbName) {
  _queuePos++;
  _renderQuestion(container, dbName);
}

function _handleExit(container, dbName) {
  const remaining = _queue.length - _queuePos;
  if (remaining > 0 && typeof confirm !== 'undefined' && !confirm('Exit quiz? Progress will be lost.')) return;
  _view = 'builder'; _session = []; _queue = []; _queuePos = 0; _answers = []; _quizData = null;
  _renderBuilder(container, dbName).catch((err) => {
    container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
  });
}

function _renderQuestion(container, dbName) {
  if (_queuePos >= _queue.length) {
    _view = 'results';
    _renderResults(container, dbName).catch((err) => {
      container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
    });
    return;
  }
  const item    = _queue[_queuePos];
  const pct     = Math.round((_queuePos / _queue.length) * 100);

  const stripHtml = [...new Set(_session)].map(cid => {
    const c      = _quizData.contentMap.get(cid);
    const color  = zoneColor(c?.zone);
    const isDone = cid !== item.conceptId &&
      _queue.filter(q => q.conceptId === cid)
            .every(q => _answers.some(a => a.conceptId === cid && a.type === q.type && a.index === q.index));
    const isCurr = cid === item.conceptId;
    const cls    = isCurr ? ' quiz-concept-pill--current' : isDone ? ' quiz-concept-pill--done' : '';
    const style  = isCurr ? ' style="color:' + color + ';border-color:' + color + '"' : '';
    return '<span class="quiz-concept-pill' + cls + '"' + style + '>' + _esc(c?.name ?? cid) + '</span>';
  }).join('');

  const headerHtml =
    '<div class="quiz-progress">' +
      '<div class="quiz-progress__top">' +
        '<button class="quiz-progress__exit" id="quiz-exit">\u2190</button>' +
        '<div class="quiz-progress__bar">' +
          '<div class="quiz-progress__fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<span class="quiz-progress__label">' + (_queuePos + 1) + ' / ' + _queue.length + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="quiz-concept-strip">' + stripHtml + '</div>';

  if (item.type === 'anatomy')        _renderAnatomyQuestion(container, item, dbName, headerHtml);
  else if (item.type === 'build')     _renderBuildQuestion(container, item, dbName, headerHtml);
  else                                _renderMCQuestion(container, item, dbName, headerHtml);

  const exitBtn = container.querySelector('#quiz-exit');
  if (exitBtn) exitBtn.addEventListener('click', () => _handleExit(container, dbName));
}

function _renderMCQuestion(container, item, dbName, headerHtml) {
  const q = item.question;
  const optionsHtml = q.options
    .map((opt, i) => '<button class="quiz-mc-option" data-opt="' + i + '">' + _esc(opt) + '</button>')
    .join('');
  container.innerHTML =
    headerHtml +
    '<div class="quiz-question">' +
      '<div class="quiz-question__prompt">' + _esc(q.prompt) + '</div>' +
      '<div class="quiz-mc-options">' + optionsHtml + '</div>' +
    '</div>';
  container.querySelectorAll('.quiz-mc-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const chosen  = parseInt(btn.dataset.opt, 10);
      const correct = chosen === q.correct_index;
      container.querySelectorAll('.quiz-mc-option').forEach(b => {
        b.disabled = true;
        if (parseInt(b.dataset.opt, 10) === q.correct_index) b.classList.add('quiz-mc-option--correct');
      });
      if (!correct) btn.classList.add('quiz-mc-option--wrong');
      await applyQuizResult(item.conceptId, correct, item.type, item.index, dbName);
      _answers.push({ conceptId: item.conceptId, type: item.type, index: item.index, correct });
      setTimeout(() => _advance(container, dbName), 1200);
    });
  });
}

function _renderAnatomyQuestion(container, item, dbName, headerHtml) {
  const q = item.question;
  const tokensHtml = (q.tokens ?? [])
    .map((tok, i) => '<span class="quiz-token" data-token="' + i + '">' + _esc(tok.text) + '</span>')
    .join('');
  const labelsHtml = (q.labels ?? [])
    .map(lbl => '<button class="quiz-label-btn" data-label="' + _esc(lbl) + '">' + _esc(lbl) + '</button>')
    .join('');
  container.innerHTML =
    headerHtml +
    '<div class="quiz-question">' +
      '<div class="quiz-question__prompt">' + _esc(q.prompt ?? '') + '</div>' +
      '<div class="quiz-anatomy__command">' + tokensHtml + '</div>' +
      '<div class="quiz-label-bank">' + labelsHtml + '</div>' +
    '</div>';

  let selectedToken = null;
  let labeled = 0;
  const totalTokens = (q.tokens ?? []).length;
  let allCorrect = true;

  container.querySelectorAll('.quiz-token').forEach(span => {
    span.addEventListener('click', () => {
      if (span.classList.contains('quiz-token--correct') || span.classList.contains('quiz-token--wrong')) return;
      container.querySelectorAll('.quiz-token').forEach(s => s.classList.remove('quiz-token--selected'));
      selectedToken = parseInt(span.dataset.token, 10);
      span.classList.add('quiz-token--selected');
    });
  });
  container.querySelectorAll('.quiz-label-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (selectedToken === null) return;
      const label   = btn.dataset.label;
      const tokenEl = container.querySelector('[data-token="' + selectedToken + '"]');
      const correct = label === q.tokens[selectedToken].label;
      tokenEl.classList.remove('quiz-token--selected');
      tokenEl.classList.add(correct ? 'quiz-token--correct' : 'quiz-token--wrong');
      if (!correct) allCorrect = false;
      btn.disabled = true;
      selectedToken = null;
      labeled++;
      if (labeled >= totalTokens) {
        await applyQuizResult(item.conceptId, allCorrect, item.type, item.index, dbName);
        _answers.push({ conceptId: item.conceptId, type: item.type, index: item.index, correct: allCorrect });
        setTimeout(() => _advance(container, dbName), 1200);
      }
    });
  });
}

function _renderBuildQuestion(container, item, dbName, headerHtml) {
  const q        = item.question;
  const wordBank = q.word_bank ?? [...(q.answer ?? [])];
  const wordsHtml = wordBank
    .map((w, i) => '<button class="quiz-build__word" data-bank-idx="' + i + '">' + _esc(w) + '</button>')
    .join('');
  container.innerHTML =
    headerHtml +
    '<div class="quiz-question">' +
      '<div class="quiz-question__prompt">' + _esc(q.prompt ?? '') + '</div>' +
      '<div class="quiz-build__answer"><span class="quiz-build__answer-empty">Tap words to build the command</span></div>' +
      '<div class="quiz-build__word-bank">' + wordsHtml + '</div>' +
      '<div class="quiz-build__feedback"></div>' +
      '<button class="quiz-build__submit" disabled>Check answer</button>' +
    '</div>';

  const placed    = [];
  const submitBtn = container.querySelector('.quiz-build__submit');

  function updateAnswerBar() {
    const bar = container.querySelector('.quiz-build__answer');
    if (placed.length === 0) {
      bar.innerHTML = '<span class="quiz-build__answer-empty">Tap words to build the command</span>';
    } else {
      bar.innerHTML = placed.map((p, i) =>
        '<span class="quiz-build__placed-word" data-placed-idx="' + i + '">' + _esc(p.word) + '</span>',
      ).join('');
      bar.querySelectorAll('[data-placed-idx]').forEach(span => {
        span.addEventListener('click', () => {
          const idx = parseInt(span.dataset.placedIdx, 10);
          const { bankIdx } = placed[idx];
          placed.splice(idx, 1);
          const bankBtn = container.querySelector('[data-bank-idx="' + bankIdx + '"]');
          if (bankBtn) bankBtn.classList.remove('quiz-build__word--placed');
          updateAnswerBar();
          submitBtn.disabled = placed.length === 0;
        });
      });
    }
  }

  container.querySelectorAll('.quiz-build__word').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('quiz-build__word--placed')) return;
      placed.push({ word: btn.textContent, bankIdx: parseInt(btn.dataset.bankIdx, 10) });
      btn.classList.add('quiz-build__word--placed');
      updateAnswerBar();
      submitBtn.disabled = false;
    });
  });

  submitBtn.addEventListener('click', async () => {
    const answer  = placed.map(p => p.word);
    const correct = JSON.stringify(answer) === JSON.stringify(q.answer ?? []);
    const feedback = container.querySelector('.quiz-build__feedback');
    feedback.textContent = correct ? 'Correct!' : 'Not quite \u2014 the answer was: ' + (q.answer ?? []).join(' ');
    feedback.className   = 'quiz-build__feedback quiz-build__feedback--' + (correct ? 'correct' : 'wrong');
    submitBtn.disabled   = true;
    container.querySelectorAll('.quiz-build__word').forEach(b => { b.disabled = true; });
    await applyQuizResult(item.conceptId, correct, item.type, item.index, dbName);
    _answers.push({ conceptId: item.conceptId, type: item.type, index: item.index, correct });
    setTimeout(() => _advance(container, dbName), 1500);
  });
}

// ── Results screen ─────────────────────────────────────────────────────────

async function _renderResults(container, dbName) {
  const today = new Date().toISOString().slice(0, 10);
  const tally = new Map();
  for (const { conceptId, correct } of _answers) {
    const t = tally.get(conceptId) ?? { correct: 0, total: 0 };
    t.total++;
    if (correct) t.correct++;
    tally.set(conceptId, t);
  }
  const totalQ = _answers.length;
  const totalC = _answers.filter(a => a.correct).length;

  await saveSession({
    session_id: Date.now().toString(), date: today,
    total_questions: totalQ, correct_count: totalC,
  }, dbName);

  const rowsHtml = [...new Set(_session)].map(cid => {
    const c = _quizData?.contentMap.get(cid);
    const t = tally.get(cid) ?? { correct: 0, total: 0 };
    return '<div class="quiz-results__concept-row">' +
      '<span class="quiz-results__concept-name">'  + _esc(c?.name ?? cid)          + '</span>' +
      '<span class="quiz-results__concept-score">' + t.correct + ' / ' + t.total   + '</span>' +
    '</div>';
  }).join('');

  container.innerHTML =
    '<div class="quiz-results">' +
      '<div class="quiz-results__header">Session complete</div>' +
      '<div class="quiz-results__score">' + totalC + ' / ' + totalQ + ' correct</div>' +
      rowsHtml +
      '<button class="quiz-results__done-btn" id="quiz-done">Done \u2192</button>' +
    '</div>';

  const doneBtn = container.querySelector('#quiz-done');
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      _view = 'builder'; _session = []; _queue = []; _queuePos = 0; _answers = []; _quizData = null;
      _renderBuilder(container, dbName).catch((err) => {
        container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
      });
    });
  }
}
