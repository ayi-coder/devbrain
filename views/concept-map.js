import { getAllProgress } from '../js/db.js';
import { getMasteryStatus } from '../js/adaptive.js';
import { navigate } from '../js/router.js';

export async function renderConceptMap(container) {
  const allProgress = await getAllProgress();
  const progressMap = new Map();
  allProgress.forEach((p) => progressMap.set(p.concept_id, p));

  const concepts = window.CONCEPTS;
  const categories = [...new Set(concepts.map((c) => c.category))];

  let activeCategory = null;
  let searchTerm = '';
  let debounceTimer = null;

  function getStatusIcon(conceptId) {
    const status = getMasteryStatus(progressMap.get(conceptId) || null);
    if (status === 'mastered') return '<span class="status-icon" style="color:var(--green)">\u2713</span>';
    if (status === 'review_soon') return '<span class="status-icon" style="color:var(--orange)">\u21BB</span>';
    return '<span class="status-icon" style="color:var(--text-muted)">\u25CB</span>';
  }

  function getFilteredConcepts() {
    return concepts.filter((c) => {
      const matchCat = !activeCategory || c.category === activeCategory;
      const matchSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }

  function renderGrid() {
    const filtered = getFilteredConcepts();
    const gridEl = container.querySelector('#concept-grid');
    gridEl.innerHTML = filtered.map((c) => `
      <div class="concept-card" data-id="${c.id}">
        <div style="font-size:22px;margin-bottom:4px;">${c.emoji}</div>
        ${getStatusIcon(c.id)}
        <div class="concept-name">${c.name}</div>
      </div>
    `).join('');

    gridEl.querySelectorAll('.concept-card').forEach((card) => {
      card.addEventListener('click', () => {
        navigate('#learn/' + card.dataset.id);
      });
    });
  }

  function renderChips() {
    const chipsEl = container.querySelector('#category-chips');
    chipsEl.innerHTML = `
      <button class="chip ${!activeCategory ? 'chip--active' : ''}" data-cat="">All</button>
      ${categories.map((cat) => `
        <button class="chip ${activeCategory === cat ? 'chip--active' : ''}" data-cat="${cat}">${cat}</button>
      `).join('')}
    `;
    chipsEl.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeCategory = chip.dataset.cat || null;
        renderChips();
        renderGrid();
      });
    });
  }

  container.innerHTML = `
    <div class="screen-header">
      <div style="font-size:20px;font-weight:700;">\u{1F5FA}\uFE0F Concept Map</div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${concepts.length} concepts to explore</div>
    </div>
    <input type="text" class="search-input" id="concept-search" placeholder="Search concepts...">
    <div class="category-chips" id="category-chips"></div>
    <div class="concept-grid" id="concept-grid"></div>
  `;

  renderChips();
  renderGrid();

  const searchInput = container.querySelector('#concept-search');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const value = e.target.value;
    debounceTimer = setTimeout(() => {
      searchTerm = value;
      renderGrid();
    }, 150);
  });

  // Cancel any pending debounce when this view is torn down
  const observer = new MutationObserver(() => {
    if (!container.querySelector('#concept-search')) {
      clearTimeout(debounceTimer);
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true });
}
