import {
  openDB, getSRSQueues, getAllContent, getAllUserProgress,
  applyQuizResult, saveQuizSession, getExploredToday,
  getWrongAnswerConcepts, getSavedSession, saveMidSession, deleteSavedSession,
  applyWrongAnswers,
} from '../js/db.js';
import { zoneColor, ZONE_NAMES, ZONE_ORDER } from '../js/zones.js';
import { navigate, setQuizActive } from '../js/router.js';
import { renderSearch, cleanupSearchOverlays } from './quiz-search.js';

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Module-level state ─────────────────────────────────────────────────────
let _mode     = 'stats';
let _session  = [];
let _queue    = [];
let _queuePos = 0;
let _answers  = [];
let _quizData = null;

export function _resetQuizState(state = {}) {
  _mode     = state.mode     ?? 'stats';
  _session  = state.session  ? [...state.session]  : [];
  _queue    = state.queue    ? [...state.queue]    : [];
  _queuePos = state.queuePos ?? 0;
  _answers  = state.answers  ? [...state.answers]  : [];
  _quizData = state.quizData ?? null;
}

// ── Pure functions ─────────────────────────────────────────────────────────

export function selectQuizQuestions(concept, progress, restrictToWrong = false) {
  if (restrictToWrong) {
    const wrong = progress?.wrong_answer_indices ?? {};
    const picks = [];
    for (const type of ['definition', 'usage', 'anatomy', 'build']) {
      const indices   = wrong[type] ?? [];
      const questions = concept.questions?.[type] ?? [];
      for (const index of indices) {
        const question = questions[index];
        if (question !== undefined) picks.push({ type, index, question });
      }
    }
    return picks;
  }

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
  cleanupSearchOverlays();
  await openDB(dbName);
  if (params.preload && !_session.includes(params.preload)) {
    _session.push(params.preload);
    _mode = 'quiz';
  }
  if (_mode === 'active')       _renderQuestion(container, dbName);
  else if (_mode === 'results') await _renderResults(container, dbName);
  else                          await _renderBuilder(container, dbName);
}

// ── Session builder ────────────────────────────────────────────────────────

async function _renderBuilder(container, dbName) {
  const [exploredToday, { recommended, overdue }, wrongConcepts, savedSession] = await Promise.all([
    getExploredToday(dbName),
    getSRSQueues(dbName),
    getWrongAnswerConcepts(dbName),
    getSavedSession(dbName),
  ]);

  const inQuizMode = _mode === 'quiz';

  // Resume banner
  let resumeHtml = '';
  if (savedSession) {
    const names = (savedSession.session ?? []).slice(0, 3).join(' \u00b7 ');
    const done  = savedSession.queuePos ?? 0;
    const total = (savedSession.queue   ?? []).length;
    resumeHtml =
      '<div class="quiz-resume-banner">' +
        '<div class="quiz-resume-banner__title">\u25b6 Session in progress</div>' +
        '<div class="quiz-resume-banner__sub">' + _esc(names) + ' \u2014 ' + done + ' / ' + total + ' done</div>' +
        '<div class="quiz-resume-banner__btns">' +
          '<button class="quiz-resume-banner__continue" id="quiz-resume-continue">Continue \u2192</button>' +
          '<button class="quiz-resume-banner__discard"  id="quiz-resume-discard">Discard</button>' +
        '</div>' +
      '</div>';
  }

  // Explored Today
  let todayHtml = '';
  if (exploredToday.length > 0) {
    todayHtml = '<div class="quiz-compartment">' +
      '<div class="quiz-compartment__label quiz-compartment__label--today">EXPLORED TODAY</div>';
    for (const { content } of exploredToday) {
      const inSession = _session.includes(content.id);
      const color = zoneColor(content.zone);
      todayHtml +=
        '<div class="quiz-comp-row">' +
          '<span class="quiz-comp-row__dot" style="background:' + color + '"></span>' +
          '<span class="quiz-comp-row__name">' + _esc(content.name) + '</span>' +
          (inQuizMode
            ? '<button class="quiz-comp-row__add' + (inSession ? ' quiz-comp-row__add--added' : '') +
              '" data-add="' + _esc(content.id) + '">' + (inSession ? '\u2713' : '+') + '</button>'
            : '') +
        '</div>';
    }
    todayHtml += '</div>';
  }

  // Spaced Repetition
  const srItems = [...recommended, ...overdue];
  let srHtml = '';
  if (srItems.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    srHtml = '<div class="quiz-compartment">' +
      '<div class="quiz-compartment__label quiz-compartment__label--sr">SPACED REPETITION</div>';
    for (const { content, progress } of srItems) {
      const inSession   = _session.includes(content.id);
      const color       = zoneColor(content.zone);
      const daysOverdue = progress.next_review_date
        ? Math.round((new Date(today) - new Date(progress.next_review_date)) / 86_400_000)
        : null;
      const badgeHtml = daysOverdue !== null && daysOverdue > 0
        ? '<span class="quiz-comp-row__badge quiz-comp-row__badge--due">' + daysOverdue + 'd</span>'
        : '<span class="quiz-comp-row__badge quiz-comp-row__badge--new">NEW</span>';
      srHtml +=
        '<div class="quiz-comp-row">' +
          '<span class="quiz-comp-row__dot" style="background:' + color + '"></span>' +
          '<span class="quiz-comp-row__name">' + _esc(content.name) + '</span>' +
          badgeHtml +
          (inQuizMode
            ? '<button class="quiz-comp-row__add' + (inSession ? ' quiz-comp-row__add--added' : '') +
              '" data-add="' + _esc(content.id) + '">' + (inSession ? '\u2713' : '+') + '</button>'
            : '') +
        '</div>';
    }
    srHtml += '</div>';
  }

  // Revise Wrong Answers
  let wrongHtml = '';
  if (wrongConcepts.length > 0) {
    wrongHtml = '<div class="quiz-compartment">' +
      '<div class="quiz-compartment__label quiz-compartment__label--wrong">REVISE WRONG ANSWERS</div>';
    for (const { content, progress } of wrongConcepts) {
      const inSession  = _session.includes(content.id);
      const color      = zoneColor(content.zone);
      const wrongCount = Object.values(progress.wrong_answer_indices ?? {})
        .reduce((sum, arr) => sum + arr.length, 0);
      wrongHtml +=
        '<div class="quiz-comp-row">' +
          '<span class="quiz-comp-row__dot" style="background:' + color + '"></span>' +
          '<span class="quiz-comp-row__name">' + _esc(content.name) + '</span>' +
          '<span class="quiz-comp-row__badge quiz-comp-row__badge--wrong">' + wrongCount + ' wrong</span>' +
          (inQuizMode
            ? '<button class="quiz-comp-row__add' + (inSession ? ' quiz-comp-row__add--added' : '') +
              '" data-add="' + _esc(content.id) + '">' + (inSession ? '\u2713' : '+') + '</button>'
            : '') +
        '</div>';
    }
    wrongHtml += '</div>';
  }

  const searchHtml = inQuizMode
    ? '<div class="quiz-mode-header">' +
        '<button class="quiz-mode-header__back" id="quiz-mode-back">\u2190 Stats</button>' +
        '<div class="quiz-search-bar" id="quiz-search-bar">' +
          '<span class="quiz-search-bar__icon">\u2315</span>' +
          '<span class="quiz-search-bar__placeholder">Search all concepts...</span>' +
        '</div>' +
      '</div>'
    : '';

  const nameMap = new Map();
  for (const { content } of [...exploredToday, ...srItems, ...wrongConcepts]) {
    if (content) nameMap.set(content.id, content.name);
  }

  container.innerHTML =
    '<div class="quiz-builder-wrap">' +
      searchHtml + resumeHtml + todayHtml + srHtml + wrongHtml +
    '</div>' +
    _buildFooterHtml(nameMap);

  _attachBuilderListeners(container, dbName);
}


function _buildFooterHtml(nameMap = new Map()) {
  if (_mode === 'stats') {
    return '<div class="quiz-footer quiz-footer--stats">' +
      '<span class="quiz-footer__hint">Nothing selected</span>' +
      '<button class="quiz-footer__quiz-btn" id="quiz-mode-enter">Quiz \u203a</button>' +
    '</div>';
  }
  if (_session.length === 0) {
    return '<div class="quiz-footer quiz-footer--quiz-empty">' +
      '<span class="quiz-footer__hint">Tap + or search to add concepts</span>' +
    '</div>';
  }
  const chips = _session.map((id) =>
    '<div class="quiz-chip">' +
      '<span class="quiz-chip__name">' + _esc(nameMap.get(id) ?? id) + '</span>' +
      '<button class="quiz-chip__remove" data-remove="' + _esc(id) + '">\u00d7</button>' +
    '</div>',
  ).join('');
  return '<div class="quiz-footer quiz-footer--quiz-active">' +
    '<div class="quiz-footer__chips">' + chips + '</div>' +
    '<button class="quiz-footer__start" id="quiz-start-btn">Start \u2192</button>' +
  '</div>';
}

function _attachBuilderListeners(container, dbName) {
  const rerender = () => _renderBuilder(container, dbName).catch((err) => {
    container.innerHTML = '<p style="padding:20px;color:var(--red)">' + _esc(err.message) + '</p>';
  });

  container.querySelector('#quiz-mode-back')
    ?.addEventListener('click', () => { _mode = 'stats'; _session = []; rerender(); });

  container.querySelector('#quiz-mode-enter')
    ?.addEventListener('click', () => _showStartSheet(container, dbName));

  container.querySelector('#quiz-resume-continue')
    ?.addEventListener('click', async () => {
      const saved = await getSavedSession(dbName);
      if (!saved) return;
      _session = saved.session ?? []; _queue = saved.queue ?? [];
      _queuePos = saved.queuePos ?? 0; _answers = saved.answers ?? [];
      const [content, prog] = await Promise.all([getAllContent(dbName), getAllUserProgress(dbName)]);
      _quizData = {
        contentMap:  new Map(content.map(c  => [c.id, c])),
        progressMap: new Map(prog.map(p => [p.id, p])),
      };
      _mode = 'active';
      setQuizActive(true);
      _renderQuestion(container, dbName);
    });

  container.querySelector('#quiz-resume-discard')
    ?.addEventListener('click', async () => {
      await deleteSavedSession(dbName);
      rerender();
    });

  container.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.add;
      _session = _session.includes(id)
        ? _session.filter((s) => s !== id)
        : [..._session, id];
      rerender();
    });
  });

  container.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _session = _session.filter((s) => s !== btn.dataset.remove);
      rerender();
    });
  });

  container.querySelector('#quiz-start-btn')
    ?.addEventListener('click', () => _startSession(container, dbName));

  container.querySelector('#quiz-search-bar')
    ?.addEventListener('click', () =>
      renderSearch(container, _session, dbName, (updated) => {
        _session = updated;
        rerender();
      }),
    );
}

function _showStartSheet(container, dbName) {
  const rerender = () => _renderBuilder(container, dbName).catch(() => {});
  const sheet = document.createElement('div');
  sheet.className = 'quiz-start-sheet-overlay';
  sheet.innerHTML =
    '<div class="quiz-start-sheet">' +
      '<div class="quiz-start-sheet__handle"></div>' +
      '<div class="quiz-start-sheet__title">Start a session</div>' +
      '<div id="sheet-resume-slot"></div>' +
      '<button class="quiz-start-sheet__btn quiz-start-sheet__btn--add"    id="sheet-add">+ Add from today\'s concepts</button>' +
      '<button class="quiz-start-sheet__btn quiz-start-sheet__btn--search" id="sheet-search">\u2315 Search all concepts</button>' +
    '</div>';

  document.body.appendChild(sheet);

  getSavedSession(dbName).then((saved) => {
    if (!saved) return;
    const slot  = sheet.querySelector('#sheet-resume-slot');
    const names = (saved.session ?? []).slice(0, 3).join(' \u00b7 ');
    const done  = saved.queuePos ?? 0;
    const total = (saved.queue ?? []).length;
    slot.innerHTML =
      '<button class="quiz-start-sheet__btn quiz-start-sheet__btn--resume" id="sheet-resume">' +
        '\u25b6 Resume saved session' +
        '<span class="quiz-start-sheet__meta">' + _esc(names) + ' \u2014 ' + done + ' / ' + total + ' done</span>' +
      '</button>';
    sheet.querySelector('#sheet-resume')?.addEventListener('click', async () => {
      sheet.remove();
      _session = saved.session ?? []; _queue = saved.queue ?? [];
      _queuePos = saved.queuePos ?? 0; _answers = saved.answers ?? [];
      const [content, prog] = await Promise.all([getAllContent(dbName), getAllUserProgress(dbName)]);
      _quizData = {
        contentMap:  new Map(content.map(c  => [c.id, c])),
        progressMap: new Map(prog.map(p => [p.id, p])),
      };
      _mode = 'active';
      setQuizActive(true);
      _renderQuestion(container, dbName);
    });
  });

  sheet.querySelector('#sheet-add').addEventListener('click', () => {
    sheet.remove(); _mode = 'quiz'; rerender();
  });
  sheet.querySelector('#sheet-search').addEventListener('click', () => {
    sheet.remove(); _mode = 'quiz';
    renderSearch(container, _session, dbName, (updated) => {
      _session = updated; rerender();
    });
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
}

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
    const hasWrong = prog?.wrong_answer_indices &&
      Object.values(prog.wrong_answer_indices).some((arr) => arr.length > 0);
    selectQuizQuestions(concept, prog, hasWrong)
      .forEach((pick) => _queue.push({ conceptId, ...pick }));
  }
  _mode = 'active'; _queuePos = 0; _answers = [];
  setQuizActive(true);
  _renderQuestion(container, dbName);
}

// ── Active quiz ────────────────────────────────────────────────────────────

function _advance(container, dbName) {
  _queuePos++;
  _renderQuestion(container, dbName);
}

async function _handleExit(container, dbName) {
  if (_queuePos >= _queue.length) { _cleanupSession(container, dbName); return; }
  const dialog = document.createElement('div');
  dialog.className = 'quiz-exit-dialog-overlay';
  dialog.innerHTML =
    '<div class="quiz-exit-dialog">' +
      '<div class="quiz-exit-dialog__title">Leave this session?</div>' +
      '<div class="quiz-exit-dialog__sub">You\'re ' + _queuePos + ' / ' + _queue.length + ' questions in.</div>' +
      '<button class="quiz-exit-dialog__btn quiz-exit-dialog__btn--save"   id="exit-save">\ud83d\udcbe Save &amp; exit</button>' +
      '<button class="quiz-exit-dialog__btn quiz-exit-dialog__btn--end"    id="exit-end">End session</button>' +
      '<button class="quiz-exit-dialog__btn quiz-exit-dialog__btn--cancel" id="exit-cancel">Cancel \u2014 stay in quiz</button>' +
    '</div>';
  document.body.appendChild(dialog);

  dialog.querySelector('#exit-save').addEventListener('click', async () => {
    dialog.remove();
    await saveMidSession({ session: _session, queue: _queue, queuePos: _queuePos, answers: _answers }, dbName);
    _cleanupSession(container, dbName);
  });
  dialog.querySelector('#exit-end').addEventListener('click', () => {
    dialog.remove(); _cleanupSession(container, dbName);
  });
  dialog.querySelector('#exit-cancel').addEventListener('click', () => dialog.remove());
}

function _cleanupSession(container, dbName) {
  setQuizActive(false);
  _mode = 'stats'; _session = []; _queue = []; _queuePos = 0; _answers = []; _quizData = null;
  _renderBuilder(container, dbName).catch(() => {});
}

function _renderQuestion(container, dbName) {
  if (_queuePos >= _queue.length) {
    _mode = 'results';
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
  const explanationHtml = q.explanation
    ? '<div class="quiz-explanation" id="quiz-explanation">' +
        '<div class="quiz-explanation__inner">' +
          '<div class="quiz-explanation__text">' + _esc(q.explanation) + '</div>' +
        '</div>' +
      '</div>'
    : '';
  const html =
    headerHtml +
    '<div class="quiz-question">' +
      '<div class="quiz-question__prompt">' + _esc(q.prompt) + '</div>' +
      '<div class="quiz-mc-options">' + optionsHtml + '</div>' +
      explanationHtml +
      '<button class="quiz-next-btn" id="quiz-next-btn" style="display:none">Next \u2192</button>' +
    '</div>';
  container.innerHTML = html;
  container.querySelectorAll('.quiz-mc-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const chosen  = parseInt(btn.dataset.opt, 10);
      const correct = chosen === q.correct_index;
      container.querySelectorAll('.quiz-mc-option').forEach(b => {
        b.disabled = true;
        if (parseInt(b.dataset.opt, 10) === q.correct_index) b.classList.add('quiz-mc-option--correct');
      });
      await applyQuizResult(item.conceptId, correct, item.type, item.index, dbName);
      _answers.push({ conceptId: item.conceptId, type: item.type, index: item.index, correct });
      if (!correct) {
        btn.classList.add('quiz-mc-option--wrong');
        const exp = container.querySelector('#quiz-explanation');
        if (exp) exp.classList.add('quiz-explanation--open');
        const nextBtn = container.querySelector('#quiz-next-btn');
        if (nextBtn) {
          nextBtn.style.display = 'block';
          nextBtn.addEventListener('click', () => _advance(container, dbName));
        }
      } else {
        setTimeout(() => _advance(container, dbName), 1000);
      }
    });
  });
}

function _renderAnatomyQuestion(container, item, dbName, headerHtml) {
  const q = item.question;
  if (!q.tokens || q.tokens.length === 0) {
    _advance(container, dbName);
    return;
  }
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

  await saveQuizSession({
    session_id: Date.now().toString(), date: today,
    total_questions: totalQ, correct_count: totalC,
  }, dbName);
  await deleteSavedSession(dbName);

  for (const conceptId of [...new Set(_session)]) {
    const conceptAnswers = _answers
      .filter((a) => a.conceptId === conceptId)
      .map(({ type, index, correct }) => ({ type, index, correct }));
    if (conceptAnswers.length > 0) await applyWrongAnswers(conceptId, conceptAnswers, dbName);
  }

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
      _cleanupSession(container, dbName);
    });
  }
}
