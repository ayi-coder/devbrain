import { getCurriculumData, markSeen, getUserProgress } from '../js/db.js';
import { zoneColor, ZONE_NAMES, subcatName } from '../js/zones.js';
import { navigate } from '../js/router.js';

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
          '<div class="zone-row__name">' + name + '</div>' +
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
            '<span class="subcat-row__name">' + displayName + '</span>' +
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

// ── Level 3: concept list (stub — filled in Task 4) ────────────────────

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
        '<div class="concept-row__name">' + concept.name + '</div>' +
        '<div class="concept-row__status">' + STATUS_LABEL[status] + '</div>' +
      '</div>';
  }

  container.innerHTML =
    '<div class="curriculum-screen__header">' +
      '<button class="curriculum-screen__back">\u2190 ' + zoneName + '</button>' +
      '<span class="curriculum-screen__zone-tag" style="background:' + color + '">' +
        subcatDisplayName +
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
        '<div class="lesson__command">' + concept.example_command + '</div>' +
      '</div>'
    : '';

  // Examples: first visible one always shown; remaining behind Read more toggle
  const visible = concept.examples.filter((e) => e.visible);
  const hidden = concept.examples.filter((e) => !e.visible);
  const visibleHtml = visible.map((e) => '<div class="lesson__example">' + e.text + '</div>').join('');
  const hiddenHtml = hidden.length > 0
    ? '<div class="lesson__hidden-examples" style="display:none">' +
        hidden.map((e) => '<div class="lesson__example">' + e.text + '</div>').join('') +
      '</div>' +
      '<button class="lesson__read-more">Read more \u25be</button>'
    : '';

  container.innerHTML =
    '<div class="curriculum-screen__header">' +
      '<button class="curriculum-screen__back">\u2190 ' + subcatDisplayName + '</button>' +
    '</div>' +
    '<div class="lesson">' +
      '<div class="lesson__name">' + concept.name + '</div>' +
      '<span class="lesson__zone-tag" style="background:' + color + '">' + zoneName + '</span>' +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">What it is</div>' +
        '<div class="lesson-section__text" id="lesson-what-it-is">' + concept.what_it_is + '</div>' +
      '</div>' +
      commandBlock +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">Examples</div>' +
        visibleHtml +
        hiddenHtml +
      '</div>' +
      '<div class="lesson-section">' +
        '<div class="lesson-section__label">Use it when</div>' +
        '<div class="lesson-section__text">' + concept.use_when + '</div>' +
      '</div>' +
      '<div class="lesson-actions">' +
        '<button class="lesson-actions__btn lesson-actions__btn--secondary" id="btn-test-self">' +
          'Test yourself \u2192' +
        '</button>' +
        '<button class="lesson-actions__btn lesson-actions__btn--primary" id="btn-add-quiz">' +
          'Add to Quiz \u2192' +
        '</button>' +
      '</div>' +
    '</div>';

  container.querySelector('.curriculum-screen__back').addEventListener('click', () => {
    _navStack.pop();
    _render(container, data, dbName).catch((err) => {
      container.innerHTML = '<p style="padding:20px;color:var(--red)">' + err.message + '</p>';
    });
  });

  container.querySelector('#btn-test-self').addEventListener('click', () => {
    navigate('quiz', { preload: conceptId });
  });

  container.querySelector('#btn-add-quiz').addEventListener('click', () => {
    navigate('quiz', { preload: conceptId });
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
}
