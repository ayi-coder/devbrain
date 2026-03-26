import { getCurriculumData, markSeen, getUserProgress, saveCheckCompletion } from '../js/db.js';
import { zoneColor, ZONE_NAMES, subcatName, SUBCAT_DESCRIPTIONS, GROUP_ORDER } from '../js/zones.js';
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
let _openZones   = new Set(); // zone IDs with expanded accordion
let _openSubcats = new Set(); // subcat IDs with expanded content
let _openGroups  = new Set(); // "subcatId:groupName" keys with expanded content
let _navStack    = [];        // push entries: {type:'lesson',...}
let _scrollY     = 0;         // zones-view scroll position

function _animateIn(el) {
  if (!el.classList) return;
  el.classList.remove('nav-animate-in');
  void el.offsetWidth;
  el.classList.add('nav-animate-in');
}

/** TEST USE ONLY */
export function _resetCurriculumState(state = {}) {
  _openZones   = new Set(state.openZones ?? []);
  _openSubcats = new Set(state.openSubcats ?? []);
  _openGroups  = new Set(state.openGroups ?? []);
  _navStack    = state.navStack ? [...state.navStack] : [];
  _scrollY     = 0;
}

// ── Exported pure functions ────────────────────────────────────────────

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

export function conceptStatus(progress, today) {
  if (!today) today = new Date().toISOString().slice(0, 10);
  if (!progress || !progress.seen) return 'locked';
  if (!progress.practiced) return 'new';
  if (!progress.next_review_date || progress.next_review_date <= today) return 'due';
  return 'done';
}

/**
 * Selects up to 3 questions where for_check === true, across all question types.
 * Returns [{ type, index, question }, ...]
 */
export function _selectCheckQuestions(concept) {
  const result = [];
  for (const type of ['definition', 'usage', 'anatomy', 'build']) {
    const arr = concept.questions?.[type] ?? [];
    arr.forEach((q, i) => {
      if (q.for_check) result.push({ type, index: i, question: q });
    });
  }
  return result.slice(0, 3);
}

// ── Entry point ────────────────────────────────────────────────────────

export async function renderCurriculum(container, params = {}, dbName = 'devbrain') {
  const data = await getCurriculumData(dbName);
  await _render(container, data, dbName);
}

async function _render(container, data, dbName) {
  const top = _navStack[_navStack.length - 1];
  if (!top) {
    _renderZones(container, data, dbName);
  } else if (top.type === 'lesson') {
    await _renderLesson(container, data, top, dbName);
  }
}

// ── Level 1: zone accordion ────────────────────────────────────────────

function _renderZones(container, data, dbName) {
  const total = data.totalConcepts;

  let html =
    '<div class="curriculum-header">' +
      '<div class="curriculum-header__title">Curriculum</div>' +
      '<div class="curriculum-header__subtitle">' +
        data.zones.length + ' zones \u00b7 ' + total + ' concepts total' +
      '</div>' +
    '</div>';

  for (const zone of data.zones) {
    const color   = zoneColor(zone.id);
    const name    = ZONE_NAMES[zone.id] ?? zone.id;
    const barWidth = zone.total > 0 ? Math.round((zone.practiced / zone.total) * 100) : 0;
    const isOpen  = _openZones.has(zone.id);

    html +=
      '<div class="zone-row' + (isOpen ? ' zone-row--open' : '') + '" data-zone="' + zone.id + '">' +
        '<div class="zone-row__top">' +
          '<div class="zone-row__dot" style="background:' + color + '"></div>' +
          '<div class="zone-row__name">' + _esc(name) + '</div>' +
          '<div class="zone-row__progress">' + zone.practiced + ' / ' + zone.total + '</div>' +
          '<span class="zone-row__chevron">\u203a</span>' +
        '</div>' +
        '<div class="zone-row__bar">' +
          '<div class="zone-row__bar-fill" style="background:' + color + ';width:' + barWidth + '%"></div>' +
        '</div>' +
      '</div>';

    if (isOpen) {
      html += _subcatListHtml(zone, data, color);
    }
  }

  container.innerHTML = html;
  container.scrollTop = _scrollY;

  // Zone toggle
  container.querySelectorAll('.zone-row').forEach((row) => {
    row.querySelector('.zone-row__top').addEventListener('click', () => {
      const zoneId = row.dataset.zone;
      if (_openZones.has(zoneId)) _openZones.delete(zoneId);
      else _openZones.add(zoneId);
      _renderZones(container, data, dbName);
    });
  });

  // Subcategory label area → expand/collapse
  container.querySelectorAll('.subcat-row__label-area').forEach((area) => {
    area.addEventListener('click', () => {
      const row      = area.closest('.subcat-row');
      const subcatId = row.dataset.subcat;
      if (_openSubcats.has(subcatId)) _openSubcats.delete(subcatId);
      else _openSubcats.add(subcatId);
      _scrollY = container.scrollTop;
      _renderZones(container, data, dbName);
    });
  });

  // Subcategory arrow → info sheet
  container.querySelectorAll('.subcat-row__arrow').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row      = btn.closest('.subcat-row');
      const subcatId = row.dataset.subcat;
      const zoneId   = row.dataset.zone;
      _showSubcatInfo(subcatId, zoneId, data);
    });
  });

  // Group header toggle
  container.querySelectorAll('.group-row').forEach((row) => {
    row.addEventListener('click', () => {
      const key = row.dataset.groupKey;
      if (_openGroups.has(key)) _openGroups.delete(key);
      else _openGroups.add(key);
      _scrollY = container.scrollTop;
      _renderZones(container, data, dbName);
    });
  });

  // Concept row tap
  container.querySelectorAll('.concept-row').forEach((row) => {
    row.addEventListener('click', () => {
      const conceptId = row.dataset.concept;
      const zoneId    = row.dataset.zone;
      const subcatId  = row.dataset.subcat;
      _scrollY = container.scrollTop;
      _navStack.push({ type: 'lesson', conceptId, zoneId, subcatId });
      _renderLesson(container, data, { conceptId, zoneId, subcatId }, dbName).catch((err) => {
        container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
      });
    });
  });
}

// ── Subcategory list HTML builder ──────────────────────────────────────

function _subcatListHtml(zone, data, color) {
  const today = new Date().toISOString().slice(0, 10);
  let html = '<div class="subcat-list">';

  for (const subcat of zone.subcategories) {
    const displayName = subcatName(subcat.id);
    const isOpen = _openSubcats.has(subcat.id);

    html +=
      '<div class="subcat-row' + (isOpen ? ' subcat-row--open' : '') + '"' +
          ' data-subcat="' + subcat.id + '" data-zone="' + zone.id + '"' +
          ' style="border-left-color:' + color + '">' +
        '<div class="subcat-row__label-area">' +
          '<span class="subcat-row__chevron">\u203a</span>' +
          '<span class="subcat-row__name">' + _esc(displayName) + '</span>' +
          '<span class="subcat-row__count">' + subcat.total + '</span>' +
        '</div>' +
        '<button class="subcat-row__arrow" aria-label="About ' + _esc(displayName) + '">' +
          '\u2139' +
        '</button>' +
      '</div>';

    if (isOpen) {
      html += _subcatContentHtml(subcat.id, zone.id, data, today, color);
    }
  }

  html += '</div>';
  return html;
}

// ── Expanded subcategory content: grouped or flat ──────────────────────

function _subcatContentHtml(subcatId, zoneId, data, today, color) {
  const concepts = [...data.contentMap.values()].filter(
    (c) => c.zone === zoneId && c.subcategory === subcatId,
  );

  if (concepts.length === 0) return '';

  const hasGroups = concepts.some((c) => c.group);

  let html = '<div class="subcat-concepts">';

  if (hasGroups) {
    // Collect unique groups, ordered by GROUP_ORDER then first-seen
    const allGroupNames = new Set(concepts.map((c) => c.group ?? 'Other'));
    const groups = [
      ...GROUP_ORDER.filter((g) => allGroupNames.has(g)),
      ...[...allGroupNames].filter((g) => !GROUP_ORDER.includes(g)),
    ];

    for (const groupName of groups) {
      const groupConcepts = concepts.filter((c) => (c.group ?? 'Other') === groupName);
      const key = subcatId + ':' + groupName;
      const isOpen = _openGroups.has(key);

      html +=
        '<div class="group-row' + (isOpen ? ' group-row--open' : '') + '" data-group-key="' + _esc(key) + '">' +
          '<span class="group-row__name">' + _esc(groupName) + '</span>' +
          '<span class="group-row__count">' + groupConcepts.length + '</span>' +
          '<span class="group-row__chevron">\u203a</span>' +
        '</div>';

      if (isOpen) {
        html += _conceptRowsHtml(groupConcepts, zoneId, subcatId, data, today, color);
      }
    }
  } else {
    html += _conceptRowsHtml(concepts, zoneId, subcatId, data, today, color);
  }

  html += '</div>';
  return html;
}

// ── Concept rows HTML ──────────────────────────────────────────────────

function _conceptRowsHtml(concepts, zoneId, subcatId, data, today, color) {
  const STATUS_COLOR = { done: '#98c379', due: '#e5c07b', new: '#61afef', locked: '#3e4451' };
  const STATUS_LABEL = { done: 'done', due: 'review', new: 'new', locked: 'locked' };

  return concepts.map((concept) => {
    const progress = data.progressMap.get(concept.id);
    const status   = conceptStatus(progress, today);
    return (
      '<div class="concept-row"' +
          ' data-concept="' + concept.id + '"' +
          ' data-zone="' + zoneId + '"' +
          ' data-subcat="' + subcatId + '">' +
        '<div class="concept-row__dot" style="background:' + STATUS_COLOR[status] + '"></div>' +
        '<div class="concept-row__name">' + _esc(concept.name) + '</div>' +
        '<div class="concept-row__status">' + STATUS_LABEL[status] + '</div>' +
      '</div>'
    );
  }).join('');
}

// ── Subcategory info sheet ─────────────────────────────────────────────

function _showSubcatInfo(subcatId, zoneId, data) {
  const color       = zoneColor(zoneId);
  const zoneName    = ZONE_NAMES[zoneId] ?? zoneId;
  const name        = subcatName(subcatId);
  const description = SUBCAT_DESCRIPTIONS[subcatId] ?? null;

  const zoneData   = data.zones.find((z) => z.id === zoneId);
  const subcatData = zoneData?.subcategories.find((s) => s.id === subcatId);
  const count      = subcatData?.total ?? 0;

  const bodyHtml = description
    ? '<div class="overlay-sheet__text">' + _esc(description) + '</div>'
    : '<div class="overlay-sheet__text" style="color:#4b5263;">' +
        count + ' concept' + (count !== 1 ? 's' : '') +
      '</div>';

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'overlay-sheet';
  sheet.innerHTML =
    '<div class="overlay-sheet__handle"></div>' +
    '<div class="overlay-sheet__name" style="color:' + color + '">' + _esc(name) + '</div>' +
    '<span class="overlay-sheet__zone-tag" style="background:' + color + '">' + _esc(zoneName) + '</span>' +
    bodyHtml;

  const close = () => { backdrop.remove(); sheet.remove(); };
  backdrop.addEventListener('click', close);
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
}

// ── Linked text renderer ───────────────────────────────────────────────

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

function _showLinkedConcept(container, data, conceptId, backToName) {
  const concept = data.contentMap.get(conceptId);
  if (!concept) return;

  const progress = data.progressMap.get(conceptId);
  const isLocked = !progress || !progress.seen;
  const color    = zoneColor(concept.zone);
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

// ── Lesson screen ──────────────────────────────────────────────────────

async function _renderLesson(container, data, { conceptId, zoneId, subcatId }, dbName) {
  const concept = data.contentMap.get(conceptId);
  if (!concept) {
    container.innerHTML = '<p style="padding:20px;color:var(--red)">Concept not found</p>';
    return;
  }

  const color            = zoneColor(zoneId);
  const zoneName         = ZONE_NAMES[zoneId] ?? zoneId;
  const subcatDisplayName = subcatName(subcatId);

  await markSeen(conceptId, dbName);
  const updatedProgress = await getUserProgress(conceptId, dbName);
  if (updatedProgress) data.progressMap.set(conceptId, updatedProgress);

  const commandBlock = concept.example_command
    ? '<div class="lesson-section">' +
        '<div class="lesson-section__label">Example Command</div>' +
        '<div class="lesson__command">' + _esc(concept.example_command) + '</div>' +
      '</div>'
    : '';

  const visible    = concept.examples.filter((e) => e.visible);
  const hidden     = concept.examples.filter((e) => !e.visible);
  const visibleHtml = visible.map((e) => '<div class="lesson__example">' + _esc(e.text) + '</div>').join('');
  const hiddenHtml  = hidden.length > 0
    ? '<div class="lesson__hidden-examples" style="display:none">' +
        hidden.map((e) => '<div class="lesson__example">' + _esc(e.text) + '</div>').join('') +
      '</div>' +
      '<button class="lesson__read-more">Read more \u25be</button>'
    : '';

  _animateIn(container);
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
        '<div class="lesson-section__label">' + _esc(concept.examples_label ?? 'Examples') + '</div>' +
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

// ── Comprehension check ────────────────────────────────────────────────

function _showComprehensionCheck(container, data, concept, progress, dbName) {
  const questions = _selectCheckQuestions(concept);

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

  let qIndex   = 0;
  const answers = [];
  let answered  = false;
  let reviewShowing = false;

  backdrop.addEventListener('click', () => {
    if (reviewShowing) { close(); return; }
    if (answers.length === 0) { close(); return; }
    if (confirm('Leave the check? Your progress won\'t be saved.')) close();
  });

  function renderQuestion() {
    answered = false;
    const { question: q } = questions[qIndex];
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
        const correct       = selectedIndex === q.correct_index;

        btn.classList.add(correct ? 'check-option--correct' : 'check-option--wrong');
        sheet.querySelectorAll('.check-option').forEach((b) => {
          if (parseInt(b.dataset.index, 10) === q.correct_index) {
            b.classList.add('check-option--correct');
          }
          b.disabled = true;
        });

        if (!correct) {
          const expEl = sheet.querySelector('#check-exp');
          if (expEl) expEl.classList.add('check-explanation--open');

          const nextBtn = document.createElement('button');
          nextBtn.className = 'check-next';
          nextBtn.textContent = 'Next \u2192';
          nextBtn.addEventListener('click', advance);
          sheet.querySelector('.check-question').appendChild(nextBtn);
        }

        answers.push({ questionIndex: qIndex, selectedIndex, correct });
        if (correct) setTimeout(advance, 700);
      });
    });
  }

  function advance() {
    qIndex++;
    if (qIndex >= questions.length) renderReview();
    else renderQuestion();
  }

  function renderReview() {
    reviewShowing = true;

    const reviewItems = questions.map((q, i) => {
      const answer      = answers.find((a) => a.questionIndex === i);
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
      try {
        await saveCheckCompletion(concept.id, [], dbName);
        const refreshed = await getUserProgress(concept.id, dbName);
        if (refreshed) data.progressMap.set(concept.id, refreshed);
        close();
        const top = _navStack[_navStack.length - 1];
        if (top) await _renderLesson(container, data, top, dbName);
      } catch (err) {
        close();
        container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
      }
    });
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  renderQuestion();
}
