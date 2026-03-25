import { getCurriculumData, markSeen, getUserProgress, saveCheckCompletion } from '../js/db.js';
import { zoneColor, ZONE_NAMES, subcatName } from '../js/zones.js';
import { navigate } from '../js/router.js';

/** Escapes HTML special characters for safe innerHTML insertion. */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Module-level navigation state ─────────────────────────────────────
// Persists across tab switches. Reset via _resetCurriculumState() in tests.
let _openZones = new Set(); // zone IDs with expanded accordion rows
let _navStack = [];         // push entries: {type:'concepts',...} | {type:'lesson',...}
let _scrollY = 0;           // zones-view scroll position, saved before navigating away

/** TEST USE ONLY — reset navigation state between tests. */
export function _resetCurriculumState(state = {}) {
  _openZones = new Set(state.openZones ?? []);
  _navStack = state.navStack ? [...state.navStack] : [];
  _scrollY = 0;
}

// ── Exported pure functions ────────────────────────────────────────────

/**
 * Parses [display text](concept-id) link syntax into an array of segments.
 * String segments are plain text; object segments are { text, conceptId }.
 * Exported for testing.
 */
export function parseLinks(text) {
  const result = [];
  let last = 0;
  for (const match of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (match.index > last) result.push(text.slice(last, match.index));
    result.push({ text: match[1], conceptId: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

/**
 * Returns the display status for a concept: 'locked' | 'new' | 'due' | 'done'
 * today: ISO date string YYYY-MM-DD; defaults to today if omitted.
 * Exported for testing.
 */
export function conceptStatus(progress, today) {
  if (!today) today = new Date().toISOString().slice(0, 10);
  if (!progress || !progress.seen) return 'locked';
  if (!progress.practiced) return 'new';
  if (!progress.next_review_date || progress.next_review_date <= today) return 'due';
  return 'done';
}

/**
 * Selects up to 3 definition questions using LRU logic.
 * Prefers unused indices; cycles from full pool when all are used.
 * Exported for testing.
 */
export function _selectCheckQuestions(concept, progress) {
  const defs = concept.questions?.definition ?? [];
  const usedIndices = progress?.check_used_indices?.definition ?? [];
  const unused = defs.map((_, i) => i).filter((i) => !usedIndices.includes(i));
  const fill = defs.map((_, i) => i).filter((i) => !unused.includes(i));
  const pool = [...unused, ...fill];
  return pool.slice(0, 3).map((i) => ({ index: i, question: defs[i] }));
}

// ── Entry point ────────────────────────────────────────────────────────

export async function renderCurriculum(container, params = {}, dbName = 'devbrain') {
  const data = await getCurriculumData(dbName);
  await _render(container, data, dbName);
}

// ── Internal render dispatcher ─────────────────────────────────────────

async function _render(container, data, dbName) {
  const top = _navStack[_navStack.length - 1];
  if (!top) {
    _renderZones(container, data, dbName);
  } else if (top.type === 'concepts') {
    _renderConceptList(container, data, top, dbName);
  } else if (top.type === 'lesson') {
    await _renderLesson(container, data, top, dbName);
  }
}

// ── Level 1/2: zone accordion + subcategory list ───────────────────────

function _renderZones(container, data, dbName) {
  const total = data.totalConcepts;

  let html =
    '<div class="curriculum-header">' +
      '<div class="curriculum-header__title">Curriculum</div>' +
      '<div class="curriculum-header__subtitle">' + data.zones.length + ' zones \u00b7 ' + total + ' concepts total</div>' +
    '</div>';

  for (const zone of data.zones) {
    const color = zoneColor(zone.id);
    const name = ZONE_NAMES[zone.id] ?? zone.id;
    const barWidth = zone.total > 0 ? Math.round((zone.practiced / zone.total) * 100) : 0;
    const isOpen = _openZones.has(zone.id);

    html +=
      '<div class="zone-row' + (isOpen ? ' zone-row--open' : '') + '" data-zone="' + zone.id + '">' +
        '<div class="zone-row__top">' +
          '<div class="zone-row__dot" style="background:' + color + '"></div>' +
          '<div class="zone-row__name">' + _esc(name) + '</div>' +
          '<div class="zone-row__progress">' + zone.practiced + ' / ' + zone.total + '</div>' +
          '<button class="zone-row__map-btn" data-mapzone="' + zone.id + '">Map \u2197</button>' +
          '<span class="zone-row__chevron">\u203a</span>' +
        '</div>' +
        '<div class="zone-row__bar">' +
          '<div class="zone-row__bar-fill" style="background:' + color + ';width:' + barWidth + '%"></div>' +
        '</div>' +
      '</div>';

    if (isOpen) {
      html += '<div class="subcat-list">';
      for (const subcat of zone.subcategories) {
        const displayName = subcatName(subcat.id);
        html +=
          '<div class="subcat-row" data-subcat="' + subcat.id + '" data-subcat-zone="' + zone.id + '"' +
              ' style="border-left-color:' + color + '">' +
            '<span class="subcat-row__name">' + _esc(displayName) + '</span>' +
            '<span class="subcat-row__count">' + subcat.total + '</span>' +
            '<button class="subcat-row__map-btn" data-mapsubcat="' + subcat.id + '">Map \u2197</button>' +
          '</div>';
      }
      html += '</div>';
    }
  }

  container.innerHTML = html;
  container.scrollTop = _scrollY;

  // Zone accordion toggle (zone-row__top click, not Map button)
  container.querySelectorAll('.zone-row').forEach((row) => {
    row.querySelector('.zone-row__top').addEventListener('click', (e) => {
      if (e.target.closest('[data-mapzone]')) return;
      const zoneId = row.dataset.zone;
      if (_openZones.has(zoneId)) _openZones.delete(zoneId);
      else _openZones.add(zoneId);
      _renderZones(container, data, dbName);
    });
  });

  // Map buttons — save scroll position then navigate to Map tab
  container.querySelectorAll('[data-mapzone], [data-mapsubcat]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _scrollY = container.scrollTop;
      navigate('map');
    });
  });

  // Subcategory row tap — push to concept list
  container.querySelectorAll('.subcat-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-mapsubcat]')) return;
      const subcatId = row.dataset.subcat;
      const zoneId = row.dataset.subcatZone;
      _scrollY = container.scrollTop;
      _navStack.push({ type: 'concepts', zoneId, subcatId });
      _renderConceptList(container, data, { zoneId, subcatId }, dbName);
    });
  });
}

// ── Level 3: concept list ────────────────────────────────────────────

function _renderConceptList(container, data, { zoneId, subcatId }, dbName) {
  const today = new Date().toISOString().slice(0, 10);
  const color = zoneColor(zoneId);
  const zoneName = ZONE_NAMES[zoneId] ?? zoneId;
  const subcatDisplayName = subcatName(subcatId);

  const STATUS_COLOR = { done: '#98c379', due: '#e5c07b', new: '#61afef', locked: '#3e4451' };
  const STATUS_LABEL = { done: 'done', due: 'review', new: 'new', locked: 'locked' };

  const concepts = [...data.contentMap.values()].filter(
    (c) => !c.is_bridge && c.subcategory === subcatId,
  );

  let rows = '';
  for (const concept of concepts) {
    const progress = data.progressMap.get(concept.id);
    const status = conceptStatus(progress, today);
    rows +=
      '<div class="concept-row" data-concept="' + concept.id + '">' +
        '<div class="concept-row__dot" style="background:' + STATUS_COLOR[status] + '"></div>' +
        '<div class="concept-row__name">' + _esc(concept.name) + '</div>' +
        '<div class="concept-row__status">' + STATUS_LABEL[status] + '</div>' +
      '</div>';
  }

  container.innerHTML =
    '<div class="curriculum-screen__header">' +
      '<button class="curriculum-screen__back">\u2190 ' + _esc(zoneName) + '</button>' +
      '<span class="curriculum-screen__zone-tag" style="background:' + color + '">' +
        _esc(subcatDisplayName) +
      '</span>' +
    '</div>' +
    '<div>' + rows + '</div>';

  container.querySelector('.curriculum-screen__back').addEventListener('click', () => {
    _navStack.pop();
    _render(container, data, dbName).catch((err) => {
      container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
    });
  });

  container.querySelectorAll('.concept-row').forEach((row) => {
    row.addEventListener('click', () => {
      const conceptId = row.dataset.concept;
      _navStack.push({ type: 'lesson', conceptId, zoneId, subcatId });
      _renderLesson(container, data, { conceptId, zoneId, subcatId }, dbName).catch((err) => {
        container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
      });
    });
  });
}

// ── Linked text renderer ───────────────────────────────────────────────

/**
 * Renders text with [term](concept-id) links as colored <span> elements.
 * isOverlay=true: spans are colored but not clickable (overlay depth cap — spec §3.5.1).
 * Unknown concept IDs fall back to plain text.
 */
function renderLinkedText(text, contentMap, isOverlay) {
  const segments = parseLinks(text);
  return segments.map((seg) => {
    if (typeof seg === 'string') return seg;
    const linked = contentMap.get(seg.conceptId);
    if (!linked) return seg.text;
    const color = zoneColor(linked.zone);
    if (isOverlay) {
      return '<span class="concept-link" style="color:' + color + '">' + _esc(seg.text) + '</span>';
    }
    return '<span class="concept-link" data-concept-id="' + seg.conceptId + '"' +
      ' style="color:' + color + '">' + _esc(seg.text) + '</span>';
  }).join('');
}

/**
 * Opens a bottom sheet overlay for a linked concept.
 * Shows full what_it_is (with non-clickable links) or a locked message.
 * Only called in browser context — guarded in _renderLesson.
 */
function _showLinkedConcept(container, data, conceptId, backToName) {
  const concept = data.contentMap.get(conceptId);
  if (!concept) return;

  const progress = data.progressMap.get(conceptId);
  const isLocked = !progress || !progress.seen;
  const color = zoneColor(concept.zone);
  const zoneName = ZONE_NAMES[concept.zone] ?? concept.zone;

  const bodyHTML = isLocked
    ? '<p class="overlay-sheet__locked">Explore more of this zone to unlock</p>'
    : '<div class="overlay-sheet__text">' +
        renderLinkedText(concept.what_it_is, data.contentMap, true) +
      '</div>';

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'overlay-sheet';
  sheet.innerHTML =
    '<div class="overlay-sheet__handle"></div>' +
    '<button class="overlay-sheet__back">\u2190 Back to ' + _esc(backToName) + '</button>' +
    '<div class="overlay-sheet__name">' + _esc(concept.name) + '</div>' +
    '<span class="overlay-sheet__zone-tag" style="background:' + color + '">' + _esc(zoneName) + '</span>' +
    bodyHTML;

  const close = () => { backdrop.remove(); sheet.remove(); };
  backdrop.addEventListener('click', close);
  sheet.querySelector('.overlay-sheet__back').addEventListener('click', close);

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
}

// ── Level 4: lesson screen ─────────────────────────────────────────────

async function _renderLesson(container, data, { conceptId, zoneId, subcatId }, dbName) {
  const concept = data.contentMap.get(conceptId);
  if (!concept) {
    container.innerHTML = '<p style="padding:20px;color:var(--red)">Concept not found</p>';
    return;
  }

  const color = zoneColor(zoneId);
  const zoneName = ZONE_NAMES[zoneId] ?? zoneId;
  const subcatDisplayName = subcatName(subcatId);

  // Mark concept as seen and refresh progressMap so concept list shows updated status on back
  await markSeen(conceptId, dbName);
  const updatedProgress = await getUserProgress(conceptId, dbName);
  if (updatedProgress) data.progressMap.set(conceptId, updatedProgress);

  // Command block (only if concept has an example_command)
  const commandBlock = concept.example_command
    ? '<div class="lesson-section">' +
        '<div class="lesson-section__label">Example Command</div>' +
        '<div class="lesson__command">' + _esc(concept.example_command) + '</div>' +
      '</div>'
    : '';

  // Examples: first visible one always shown; remaining behind Read more toggle
  const visible = concept.examples.filter((e) => e.visible);
  const hidden = concept.examples.filter((e) => !e.visible);
  const visibleHtml = visible.map((e) => '<div class="lesson__example">' + _esc(e.text) + '</div>').join('');
  const hiddenHtml = hidden.length > 0
    ? '<div class="lesson__hidden-examples" style="display:none">' +
        hidden.map((e) => '<div class="lesson__example">' + _esc(e.text) + '</div>').join('') +
      '</div>' +
      '<button class="lesson__read-more">Read more \u25be</button>'
    : '';

  container.innerHTML =
    '<div class="curriculum-screen__header">' +
      '<button class="curriculum-screen__back">\u2190 ' + _esc(subcatDisplayName) + '</button>' +
    '</div>' +
    '<div class="lesson">' +
      '<div class="lesson__name">' + _esc(concept.name) + '</div>' +
      '<span class="lesson__zone-tag" style="background:' + color + '">' + _esc(zoneName) + '</span>' +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">What it is</div>' +
        '<div class="lesson-section__text" id="lesson-what-it-is">' +
          renderLinkedText(concept.what_it_is, data.contentMap, false) +
        '</div>' +
      '</div>' +
      commandBlock +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">Examples</div>' +
        visibleHtml +
        hiddenHtml +
      '</div>' +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">Use it when</div>' +
        '<div class="lesson-section__text">' + _esc(concept.use_when) + '</div>' +
      '</div>' +
      '<div class="lesson-actions">' +
        '<button class="lesson-actions__btn lesson-actions__btn--primary" id="btn-check">' +
          (updatedProgress?.check_completed ? 'Check again \u2192' : 'Check my understanding \u2192') +
        '</button>' +
      '</div>' +
    '</div>';

  container.querySelector('.curriculum-screen__back').addEventListener('click', () => {
    _navStack.pop();
    _render(container, data, dbName).catch((err) => {
      container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
    });
  });

  const readMoreBtn = container.querySelector('.lesson__read-more');
  if (readMoreBtn) {
    readMoreBtn.addEventListener('click', () => {
      const hiddenSection = container.querySelector('.lesson__hidden-examples');
      if (hiddenSection.style.display === 'none') {
        hiddenSection.style.display = 'block';
        readMoreBtn.textContent = 'Read less \u25b4';
      } else {
        hiddenSection.style.display = 'none';
        readMoreBtn.textContent = 'Read more \u25be';
      }
    });
  }

  // Concept hyperlinks + comprehension check — browser only (document.body unavailable in Node.js tests)
  if (typeof document !== 'undefined' && document.body) {
    container.querySelectorAll('.concept-link').forEach((link) => {
      link.addEventListener('click', () => {
        _showLinkedConcept(container, data, link.dataset.conceptId, concept.name);
      });
    });

    container.querySelector('#btn-check').addEventListener('click', () => {
      _showComprehensionCheck(container, data, concept, updatedProgress, dbName);
    });
  }
}

// ── Comprehension check bottom sheet ──────────────────────────────────

function _showComprehensionCheck(container, data, concept, progress, dbName) {
  const questions = _selectCheckQuestions(concept, progress);

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'overlay-sheet';
  sheet.style.maxHeight = '85vh';

  const close = () => { backdrop.remove(); sheet.remove(); };

  if (questions.length === 0) {
    sheet.innerHTML =
      '<div class="overlay-sheet__handle"></div>' +
      '<div style="padding:24px 16px;color:#abb2bf;font-size:15px;">No questions available for this concept yet.</div>';
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    return;
  }

  let qIndex = 0;
  const answers = [];
  let answered = false;
  let reviewShowing = false;

  backdrop.addEventListener('click', () => {
    if (reviewShowing) { close(); return; }   // review done — just close
    if (answers.length === 0) { close(); return; }  // before first answer — just close
    if (confirm('Leave the check? Your progress won\'t be saved.')) close();
  });

  function renderQuestion() {
    answered = false;
    const { index: qIdx, question: q } = questions[qIndex];
    const optionsHtml = q.options.map((opt, i) =>
      '<button class="check-option" data-index="' + i + '">' + _esc(opt) + '</button>',
    ).join('');

    const explanationHtml = q.explanation
      ? '<div class="check-explanation" id="check-exp">' +
          '<div class="check-explanation__inner">' +
            '<div class="check-explanation__text">' + _esc(q.explanation) + '</div>' +
          '</div>' +
        '</div>'
      : '';

    sheet.innerHTML =
      '<div class="overlay-sheet__handle"></div>' +
      '<div class="check-question">' +
        '<div class="check-question__prompt">' + _esc(q.prompt) + '</div>' +
        '<div class="check-options">' + optionsHtml + '</div>' +
        explanationHtml +
      '</div>';

    sheet.querySelectorAll('.check-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;

        const selectedIndex = parseInt(btn.dataset.index, 10);
        const correct = selectedIndex === q.correct_index;

        // Mark selected option
        btn.classList.add(correct ? 'check-option--correct' : 'check-option--wrong');

        // Always mark the correct answer green and disable all options
        sheet.querySelectorAll('.check-option').forEach((b) => {
          if (parseInt(b.dataset.index, 10) === q.correct_index) {
            b.classList.add('check-option--correct');
          }
          b.disabled = true;
        });

        // Show explanation + Next button on wrong answer
        if (!correct) {
          const expEl = sheet.querySelector('#check-exp');
          if (expEl) expEl.classList.add('check-explanation--open');

          const nextBtn = document.createElement('button');
          nextBtn.className = 'check-next';
          nextBtn.textContent = 'Next \u2192';
          nextBtn.addEventListener('click', advance);
          sheet.querySelector('.check-question').appendChild(nextBtn);
        }

        answers.push({ questionIndex: qIdx, selectedIndex, correct });

        if (correct) {
          setTimeout(advance, 700);
        }
      });
    });
  }

  function advance() {
    qIndex++;
    if (qIndex >= questions.length) {
      renderReview();
    } else {
      renderQuestion();
    }
  }

  function renderReview() {
    reviewShowing = true;
    const usedIndices = questions.map((q) => q.index);

    const reviewItems = questions.map((q) => {
      const answer = answers.find((a) => a.questionIndex === q.index);
      const correctText = _esc(q.question.options[q.question.correct_index]);
      let wrongHtml = '';
      if (answer && !answer.correct) {
        wrongHtml =
          '<div class="check-review__answer check-review__answer--wrong">\u2717 ' +
          _esc(q.question.options[answer.selectedIndex]) + '</div>';
      }
      return (
        '<div class="check-review__item">' +
          '<div class="check-review__prompt">' + _esc(q.question.prompt) + '</div>' +
          '<div class="check-review__answer check-review__answer--correct">\u2713 ' + correctText + '</div>' +
          wrongHtml +
        '</div>'
      );
    }).join('');

    sheet.innerHTML =
      '<div class="overlay-sheet__handle"></div>' +
      '<div class="check-review__message">Done \u2014 all ' + questions.length + ' checked</div>' +
      reviewItems +
      '<button class="check-review__back">Back to lesson</button>';

    sheet.querySelector('.check-review__back').addEventListener('click', async () => {
      await saveCheckCompletion(concept.id, usedIndices, dbName);
      const refreshed = await getUserProgress(concept.id, dbName);
      if (refreshed) data.progressMap.set(concept.id, refreshed);
      close();
      await _renderLesson(container, data, _navStack[_navStack.length - 1], dbName);
    });
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  renderQuestion();
}
