import { openDB, getAllContent, getAllUserProgress } from '../js/db.js';
import { zoneColor, ZONE_NAMES, ZONE_ORDER } from '../js/zones.js';

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Pure — exported for testing. */
export function _filterConcepts(concepts, query) {
  if (!query) return concepts;
  const q = query.toLowerCase();
  return concepts.filter((c) => c.name.toLowerCase().includes(q));
}

function _highlightMatch(name, query) {
  if (!query) return _esc(name);
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return _esc(name);
  return _esc(name.slice(0, idx)) +
    '<span class="qs-match">' + _esc(name.slice(idx, idx + query.length)) + '</span>' +
    _esc(name.slice(idx + query.length));
}

export async function renderSearch(container, session, dbName, onDone) {
  await openDB(dbName);
  const [allContent, allProgress] = await Promise.all([
    getAllContent(dbName),
    getAllUserProgress(dbName),
  ]);
  const progressMap = new Map(allProgress.map((p) => [p.id, p]));
  const nonBridge   = allContent.filter((c) => !c.is_bridge);

  let currentSession = [...session];
  let query = '';

  function buildRows() {
    const filtered = _filterConcepts(nonBridge, query);
    const byZone   = new Map(ZONE_ORDER.map((z) => [z, []]));
    for (const c of filtered) {
      if (!byZone.has(c.zone)) byZone.set(c.zone, []);
      byZone.get(c.zone).push(c);
    }
    let html = '';
    for (const zoneId of ZONE_ORDER) {
      const items = byZone.get(zoneId) ?? [];
      if (items.length === 0) continue;
      html += '<div class="qs-zone-divider" style="color:' + zoneColor(zoneId) + '">' +
        _esc((ZONE_NAMES[zoneId] ?? zoneId).toUpperCase()) + '</div>';
      for (const c of items) {
        const unseen = !(progressMap.get(c.id)?.seen);
        const inSess = currentSession.includes(c.id);
        html +=
          '<div class="qs-row">' +
            '<span class="qs-row__dot" style="background:' + zoneColor(c.zone) + '"></span>' +
            '<span class="qs-row__name">' +
              _highlightMatch(c.name, query) +
              (unseen ? '<span class="qs-row__unseen">unseen</span>' : '') +
            '</span>' +
            '<button class="qs-row__add' + (inSess ? ' qs-row__add--added' : '') +
              '" data-cid="' + _esc(c.id) + '" data-unseen="' + unseen + '">' +
              (inSess ? '\u2713' : '+') + '</button>' +
          '</div>';
      }
    }
    if (!html) html = '<div class="qs-empty">No concepts match \u201c' + _esc(query) + '\u201d</div>';
    return html;
  }

  const overlay = document.createElement('div');
  overlay.className = 'qs-overlay';
  overlay.innerHTML =
    '<div class="qs-header">' +
      '<button class="qs-back" id="qs-back">\u2190</button>' +
      '<div class="qs-input-wrap">' +
        '<span class="qs-icon">\u2315</span>' +
        '<input class="qs-input" id="qs-input" type="text" placeholder="Search all concepts..." autocomplete="off">' +
        '<button class="qs-clear" id="qs-clear" style="display:none">\u2715</button>' +
      '</div>' +
    '</div>' +
    '<div class="qs-list" id="qs-list">' + buildRows() + '</div>';

  document.body.appendChild(overlay);
  overlay.querySelector('#qs-input').focus();

  function rerender() {
    overlay.querySelector('#qs-list').innerHTML = buildRows();
    attachRows();
  }

  function close() { overlay.remove(); onDone(currentSession); }

  function attachRows() {
    overlay.querySelectorAll('[data-cid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid    = btn.dataset.cid;
        const unseen = btn.dataset.unseen === 'true';
        if (currentSession.includes(cid)) {
          currentSession = currentSession.filter((s) => s !== cid);
          rerender(); return;
        }
        if (unseen) _showUnseenPopup(overlay, cid, allContent, () => {
          if (!currentSession.includes(cid)) currentSession.push(cid);
          rerender();
        });
        else { currentSession.push(cid); rerender(); }
      });
    });
  }

  overlay.querySelector('#qs-back').addEventListener('click', close);
  overlay.querySelector('#qs-input').addEventListener('input', (e) => {
    query = e.target.value;
    overlay.querySelector('#qs-clear').style.display = query ? 'block' : 'none';
    rerender();
  });
  overlay.querySelector('#qs-clear').addEventListener('click', () => {
    query = ''; overlay.querySelector('#qs-input').value = '';
    overlay.querySelector('#qs-clear').style.display = 'none';
    rerender();
  });

  attachRows();
}

function _showUnseenPopup(overlay, conceptId, allContent, onAdd) {
  const concept = allContent.find((c) => c.id === conceptId);
  if (!concept) { onAdd(); return; }

  function makePopup(showAddToQuiz) {
    const popup = document.createElement('div');
    popup.className = 'qs-unseen-popup-overlay';
    popup.innerHTML =
      '<div class="qs-unseen-popup">' +
        '<div class="qs-unseen-popup__dot" style="background:' + zoneColor(concept.zone) + '"></div>' +
        '<div class="qs-unseen-popup__name">' + _esc(concept.name) + '</div>' +
        '<div class="qs-unseen-popup__msg">' +
          (showAddToQuiz ? 'Ready to add this to your quiz?' : 'You haven\u2019t studied this one yet.') +
        '</div>' +
        (!showAddToQuiz
          ? '<button class="qs-unseen-popup__btn qs-unseen-popup__btn--card"   id="up-card">View info card</button>'
          : '') +
        '<button class="qs-unseen-popup__btn qs-unseen-popup__btn--add" id="up-add">' +
          (showAddToQuiz ? 'Add to quiz' : 'Add anyway') + '</button>' +
        (showAddToQuiz
          ? '<button class="qs-unseen-popup__btn qs-unseen-popup__btn--cancel" id="up-cancel">Cancel</button>'
          : '') +
      '</div>';
    overlay.appendChild(popup);
    popup.querySelector('#up-add').addEventListener('click', () => { popup.remove(); onAdd(); });
    popup.querySelector('#up-cancel')?.addEventListener('click', () => popup.remove());
    popup.querySelector('#up-card')?.addEventListener('click', () => {
      popup.remove();
      _showInfoCard(overlay, concept, () => makePopup(true));
    });
  }

  makePopup(false);
}

function _showInfoCard(overlay, concept, onBack) {
  const card = document.createElement('div');
  card.className = 'qs-info-card';
  card.innerHTML =
    '<button class="qs-info-card__back" id="ic-back">\u2190 Back</button>' +
    '<div class="qs-info-card__name">' + _esc(concept.name) + '</div>' +
    '<div class="qs-info-card__zone" style="color:' + zoneColor(concept.zone) + '">' +
      _esc(ZONE_NAMES[concept.zone] ?? concept.zone) + '</div>' +
    '<div class="qs-info-card__body">' + _esc(concept.what_it_is ?? '') + '</div>';
  overlay.appendChild(card);
  card.querySelector('#ic-back').addEventListener('click', () => { card.remove(); onBack(); });
}
