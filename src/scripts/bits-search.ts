import { createWithBase } from '../utils/format';

const form = document.querySelector<HTMLFormElement>('[data-bits-search-form]');
const input = document.getElementById('bits-search') as HTMLInputElement | null;
const btn = document.getElementById('bits-search-btn') as HTMLButtonElement | null;
const statusEl = document.getElementById('bits-search-status') as HTMLDivElement | null;
const liveEl = document.getElementById('bits-search-live') as HTMLParagraphElement | null;
const browseRoot = document.querySelector<HTMLElement>('[data-bits-browse]');
const resultsRoot = document.querySelector<HTMLElement>('[data-bits-search-results]');
const resultsSummaryEl = document.querySelector<HTMLElement>('[data-bits-search-results-summary]');
const resultsListEl = document.querySelector<HTMLElement>('[data-bits-search-results-list]');
const clearBtn = document.querySelector<HTMLButtonElement>('[data-bits-search-clear]');
const tagDialog = document.querySelector<HTMLDialogElement>('[data-bits-tag-dialog]');
const tagTrigger = document.querySelector<HTMLButtonElement>('[data-bits-tag-trigger]');
const tagCloseBtn = document.querySelector<HTMLButtonElement>('[data-bits-tag-close]');
const tagButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-bits-tag-item]'));
const yearFilterRoot = document.querySelector<HTMLElement>('[data-bits-year-filter]');
const yearCursor = document.querySelector<HTMLElement>('[data-bits-year-cursor]');
const yearButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-bits-year-item]'));
const yearMoreRoot = document.querySelector<HTMLElement>('[data-bits-year-more]');
const yearMoreTrigger = document.querySelector<HTMLButtonElement>('[data-bits-year-more-trigger]');
const yearMoreLabel = document.querySelector<HTMLElement>('[data-bits-year-more-label]');
const yearMenu = document.querySelector<HTMLElement>('[data-bits-year-menu]');
const yearMenuButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-bits-year-menu-item]'));
const yearSelect = document.querySelector<HTMLSelectElement>('[data-bits-year-select]');
const yearSelectWrap = yearSelect?.closest<HTMLElement>('.bits-year-select-wrap') ?? null;

const base = import.meta.env.BASE_URL ?? '/';
const withBase = createWithBase(base);
const indexUrl = withBase('bits/index.json');

const FILTER_DEBOUNCE_MS = 120;
const MAX_VISIBLE_RESULTS = 50;
const QUERY_PARAM_QUERY = 'q';
const QUERY_PARAM_YEAR = 'year';
const QUERY_PARAM_TAG = 'tag';

type IndexItem = {
  key?: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  text: string;
  excerpt?: string;
  date: string | null;
  dateLabel?: string | null;
  year?: number | null;
  page?: number;
  href?: string;
  thumbnail?: {
    src: string;
    width: number;
    height: number;
    alt: string;
  } | null;
};

const getIndexKey = (item: Pick<IndexItem, 'key' | 'slug'>) => (item.key || item.slug || '').trim();
const getQueryTerms = (query: string) =>
  Array.from(new Set(query.split(/\s+/).map((term) => term.trim()).filter(Boolean)));
const getYearButtonValue = (button: HTMLButtonElement) => {
  const raw = (button.dataset.bitsYear ?? '').trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildHay = (item: IndexItem) => {
  const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
  return `${item.title ?? ''} ${item.description ?? ''} ${tags} ${item.text ?? ''}`.toLowerCase();
};

const availableYears = new Set(
  (yearSelect
    ? Array.from(yearSelect.options)
        .map((option) => option.value.trim())
        .filter(Boolean)
        .map((value) => Number(value))
        .filter((year): year is number => Number.isFinite(year))
    : [...yearButtons, ...yearMenuButtons]
        .map((button) => getYearButtonValue(button))
        .filter((year): year is number => year !== null))
);
const overflowYears = new Set(
  yearMenuButtons.map((button) => getYearButtonValue(button)).filter((year): year is number => year !== null)
);
const shouldBypassIndexCache = import.meta.env.DEV;

let indexPromise: Promise<IndexItem[] | null> | null = null;
let indexCache: IndexItem[] | null = null;
let indexHay: Map<string, string> | null = null;
let indexFailed = false;
let filterTimer: number | null = null;
let filterRunId = 0;
let activeYear: number | null = null;
let activeTag: string | null = null;
let isMoreMenuOpen = false;
let statusTimer: number | null = null;

const getTrimmedQuery = () => (input?.value || '').trim();
const getNormalizedQuery = () => getTrimmedQuery().toLowerCase();

const clearStatusTimer = () => {
  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
    statusTimer = null;
  }
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const includesAnyTerm = (value: string, terms: string[]) => {
  if (!value.trim()) return false;
  if (!terms.length) return true;
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
};

const getCurrentBitsPage = () => {
  const match = window.location.pathname.match(/\/bits(?:\/page\/(\d+))?\/?$/);
  if (!match) return 1;

  const page = Number(match[1] ?? '1');
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const getContextSnippet = (value: string, terms: string[], maxLength = 120) => {
  const normalized = value.trim();
  if (!normalized) return '';
  if (!terms.length) {
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
  }

  const lower = normalized.toLowerCase();
  let matchIndex = -1;
  let matchedTerm = '';

  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());
    if (index >= 0 && (matchIndex === -1 || index < matchIndex)) {
      matchIndex = index;
      matchedTerm = term;
    }
  }

  if (matchIndex < 0) {
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
  }

  const before = Math.max(0, matchIndex - Math.floor((maxLength - matchedTerm.length) / 2));
  const after = Math.min(normalized.length, before + maxLength);
  const snippet = normalized.slice(before, after).trim();
  const prefix = before > 0 ? '…' : '';
  const suffix = after < normalized.length ? '…' : '';
  return `${prefix}${snippet}${suffix}`;
};

const getDisplaySnippet = (item: IndexItem, terms: string[]) => {
  const candidates = [
    item.description?.trim() ?? '',
    item.excerpt?.trim() ?? '',
    item.text?.trim() ?? '',
    item.title?.trim() ?? ''
  ].filter(Boolean);

  const matchedCandidate = candidates.find((value) => includesAnyTerm(value, terms));
  const source = matchedCandidate || candidates[0] || '';
  if (!source) return '';

  return getContextSnippet(source, terms, 120);
};

const highlightText = (value: string, terms: string[]) => {
  if (!value) return '';
  if (!terms.length) return escapeHtml(value);

  const validTerms = terms
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!validTerms.length) return escapeHtml(value);

  const regex = new RegExp(`(${validTerms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = value.split(regex);

  return parts
    .map((part) => {
      if (!part) return '';
      const matched = validTerms.some((term) => part.toLowerCase() === term.toLowerCase());
      const escaped = escapeHtml(part);
      return matched ? `<mark class="bit-search-result__mark">${escaped}</mark>` : escaped;
    })
    .join('');
};

const getDisplayTags = (tags: string[]) => {
  const visibleTags = Array.isArray(tags)
    ? tags.filter((tag) => typeof tag === 'string' && tag.trim() !== '')
    : [];
  const placeTag = visibleTags.find((tag) => tag.toLowerCase().startsWith('loc:')) ?? '';
  const placeText = placeTag ? placeTag.slice(4).trim() : '';
  const normalTags = visibleTags.filter((tag) => tag !== placeTag);

  return {
    placeText,
    normalTags
  };
};

const setVisibleStatus = (text: string) => {
  if (!statusEl) return;
  if (statusEl.textContent !== text) {
    statusEl.textContent = text;
  }
};

const setLiveStatus = (text: string) => {
  if (!liveEl) return;
  if (liveEl.textContent !== text) {
    liveEl.textContent = text;
  }
};

const setStatus = (
  text: string,
  options: {
    announce?: boolean;
    autoClearMs?: number;
    visible?: boolean;
  } = {}
) => {
  clearStatusTimer();
  const { announce = true, autoClearMs, visible = true } = options;
  setVisibleStatus(visible ? text : '');
  setLiveStatus(announce ? text : '');
  if (text && options.autoClearMs) {
    statusTimer = window.setTimeout(() => {
      setVisibleStatus('');
      setLiveStatus('');
      statusTimer = null;
    }, autoClearMs);
  }
};

const formatResultsSummary = (count: number, year: number | null) => {
  const summary =
    count > MAX_VISIBLE_RESULTS
      ? `${count}건 중 상위 ${MAX_VISIBLE_RESULTS}건 표시`
      : `${count}건 검색됨`;
  return year ? `${year}년 · ${summary}` : summary;
};

const isResultsVisible = () => resultsRoot?.hasAttribute('hidden') === false;
const getFirstResultLink = () => resultsListEl?.querySelector<HTMLAnchorElement>('.bit-search-result__link') ?? null;
const isOverflowYear = (year: number | null): year is number => year !== null && overflowYears.has(year);
const getCursorTargetButton = () => {
  if ((isMoreMenuOpen || isOverflowYear(activeYear)) && yearMoreTrigger) {
    return yearMoreTrigger;
  }
  return yearButtons.find((button) => button.classList.contains('is-active')) ?? yearMoreTrigger ?? null;
};

const updateYearCursor = () => {
  if (!yearFilterRoot || !yearCursor) return;
  const activeButton = getCursorTargetButton();
  if (!activeButton) return;
  const rootRect = yearFilterRoot.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();
  const primaryCursorWidth = yearButtons
    .map((button) => ({
      button,
      year: getYearButtonValue(button)
    }))
    .filter((item) => item.year !== null)
    .reduce((width, item) => Math.max(width, item.button.offsetWidth), activeButton.offsetWidth);
  const cursorWidth =
    (isMoreMenuOpen || isOverflowYear(activeYear)) && yearMoreTrigger
      ? Math.max(yearMoreTrigger.offsetWidth, primaryCursorWidth)
      : Math.max(activeButton.offsetWidth, primaryCursorWidth);
  const centeredLeft = buttonRect.left - rootRect.left - (cursorWidth - activeButton.offsetWidth) / 2;
  const maxLeft = Math.max(rootRect.width - cursorWidth, 0);
  const cursorLeft = Math.min(Math.max(centeredLeft, 0), maxLeft);

  yearCursor.style.width = `${cursorWidth}px`;
  yearCursor.style.transform = `translateX(${cursorLeft}px)`;
};

const setMoreMenuOpen = (open: boolean) => {
  if (!yearMoreRoot || !yearMoreTrigger || !yearMenu) {
    isMoreMenuOpen = false;
    return;
  }
  isMoreMenuOpen = open;
  yearMoreRoot.dataset.open = String(open);
  yearMoreTrigger.classList.toggle('is-open', open);
  yearMoreTrigger.setAttribute('aria-expanded', String(open));
  if (open) {
    yearMenu.removeAttribute('hidden');
  } else {
    yearMenu.setAttribute('hidden', 'true');
  }
  window.requestAnimationFrame(updateYearCursor);
};

const closeMoreMenu = () => {
  if (!isMoreMenuOpen) return;
  setMoreMenuOpen(false);
};

const setActiveYearState = (year: number | null) => {
  activeYear = year;
  yearButtons.forEach((button) => {
    const buttonYear = getYearButtonValue(button);
    const isActive = buttonYear === year;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  yearMenuButtons.forEach((button) => {
    const buttonYear = getYearButtonValue(button);
    const isActive = buttonYear === year;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  if (yearMoreRoot && yearMoreTrigger) {
    const isMoreActive = isOverflowYear(year);
    yearMoreRoot.dataset.active = String(isMoreActive);
    yearMoreTrigger.classList.toggle('is-active', isMoreActive);
    yearMoreTrigger.setAttribute('aria-label', isMoreActive ? `더 많은 연도 필터 열기, 현재 ${year}년` : '더 많은 연도 필터 열기');
  }
  if (yearMoreLabel) {
    yearMoreLabel.textContent = isOverflowYear(year) ? String(year) : '더보기';
  }
  if (yearSelect) {
    yearSelect.value = year === null ? '' : String(year);
    yearSelect.dataset.empty = String(year === null);
  }
  if (yearSelectWrap) {
    yearSelectWrap.dataset.empty = String(year === null);
    yearSelectWrap.dataset.active = String(year !== null);
  }
  window.requestAnimationFrame(updateYearCursor);
};

const openTagDialog = () => {
  if (tagDialog && typeof tagDialog.showModal === 'function') {
    tagDialog.showModal();
    tagTrigger?.setAttribute('aria-expanded', 'true');
  }
};

const closeTagDialog = () => {
  if (tagDialog && typeof tagDialog.close === 'function') {
    tagDialog.close();
  }
  tagTrigger?.setAttribute('aria-expanded', 'false');
};

const setActiveTagState = (tag: string | null) => {
  activeTag = tag;
  tagButtons.forEach((button) => {
    const isActive = button.dataset.bitsTag === tag;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  if (tagTrigger) {
    tagTrigger.textContent = tag ? `#${tag} ×` : '#태그';
    tagTrigger.classList.toggle('is-active', tag !== null);
  }
};

const getFilterUrl = (query: string, year: number | null, tag: string | null = activeTag) => {
  const nextUrl = new URL(window.location.href);
  nextUrl.hash = '';
  if (query) {
    nextUrl.searchParams.set(QUERY_PARAM_QUERY, query);
  } else {
    nextUrl.searchParams.delete(QUERY_PARAM_QUERY);
  }
  if (year !== null) {
    nextUrl.searchParams.set(QUERY_PARAM_YEAR, String(year));
  } else {
    nextUrl.searchParams.delete(QUERY_PARAM_YEAR);
  }
  if (tag !== null) {
    nextUrl.searchParams.set(QUERY_PARAM_TAG, tag);
  } else {
    nextUrl.searchParams.delete(QUERY_PARAM_TAG);
  }
  const search = nextUrl.searchParams.toString();
  return `${nextUrl.pathname}${search ? `?${search}` : ''}`;
};

const syncUrlState = (query = getTrimmedQuery(), year = activeYear, tag = activeTag) => {
  const next = getFilterUrl(query, year, tag);
  const current = `${window.location.pathname}${window.location.search}`;
  if (next !== current) {
    window.history.replaceState({}, '', next);
  }
};

const readInitialState = () => {
  const url = new URL(window.location.href);
  const query = (url.searchParams.get(QUERY_PARAM_QUERY) ?? '').trim();
  const rawYear = (url.searchParams.get(QUERY_PARAM_YEAR) ?? '').trim();
  const rawTag = (url.searchParams.get(QUERY_PARAM_TAG) ?? '').trim();

  const parsedYear = rawYear ? Number(rawYear) : null;
  const year = parsedYear !== null && Number.isFinite(parsedYear) && availableYears.has(parsedYear)
    ? parsedYear
    : null;

  const tag = rawTag || null;

  return { query, year, tag };
};

const showBrowse = () => {
  browseRoot?.removeAttribute('hidden');
  resultsRoot?.setAttribute('hidden', 'true');
  if (resultsListEl) {
    resultsListEl.innerHTML = '';
  }
  if (resultsSummaryEl) {
    resultsSummaryEl.textContent = '검색 결과';
  }
};

const getEmptyResultsText = (query: string, year: number | null) => {
  if (year !== null && query) {
    return '해당 연도에 일치하는 항목이 없습니다. 다른 키워드나 연도를 시도해보세요.';
  }
  return '일치하는 항목을 찾을 수 없습니다. 다른 키워드를 시도해보세요.';
};

const renderResults = (matchedItems: IndexItem[]) => {
  if (!resultsRoot || !resultsListEl) return;

  const visibleItems = matchedItems.slice(0, MAX_VISIBLE_RESULTS);
  const summary = formatResultsSummary(matchedItems.length, activeYear);
  const currentBitsPage = getCurrentBitsPage();

  if (resultsSummaryEl) {
    resultsSummaryEl.textContent = summary;
  }

  resultsListEl.innerHTML = visibleItems
    .map((item) => {
      const query = getTrimmedQuery();
      const queryTerms = getQueryTerms(query);
      const snippet = getDisplaySnippet(item, queryTerms);
      const dateLabel = item.dateLabel?.trim() ?? '';
      const pageHint = item.page && item.page !== currentBitsPage ? `${item.page} 페이지` : '';
      const { placeText, normalTags } = getDisplayTags(item.tags ?? []);
      const place = placeText
        ? `<span class="bit-search-result__tag bit-search-result__tag--place">📍 ${highlightText(placeText, queryTerms)}</span>`
        : '';
      const tags = normalTags
        .slice(0, 3)
        .map((tag) => `<span class="bit-search-result__tag">#${highlightText(tag.trim(), queryTerms)}</span>`)
        .join('');
      const metaTrail = [
        dateLabel
          ? `<time class="bit-search-result__date" datetime="${escapeHtml(item.date ?? '')}">${escapeHtml(dateLabel)}</time>`
          : '',
        pageHint ? `<span class="bit-search-result__page">${escapeHtml(pageHint)}</span>` : ''
      ]
        .filter(Boolean)
        .join('<span class="bit-search-result__sep" aria-hidden="true">·</span>');
      const href = item.href ? escapeHtml(item.href) : withBase('bits/');
      const thumbnail = item.thumbnail
        ? `
          <div class="bit-search-result__thumb">
            <img
              src="${escapeHtml(item.thumbnail.src)}"
              alt="${escapeHtml(item.thumbnail.alt || snippet || '조각글 이미지')}"
              width="${item.thumbnail.width}"
              height="${item.thumbnail.height}"
              loading="lazy"
              decoding="async"
            />
          </div>
        `
        : '';

      return `
        <article class="bit-card bit-card--search-result">
          <a class="bit-search-result__link" href="${href}">
            <div class="bit-search-result__layout${thumbnail ? ' bit-search-result__layout--media' : ''}">
              ${thumbnail}
              <div class="bit-search-result__content">
                ${snippet ? `<p class="bit-search-result__excerpt">${highlightText(snippet, queryTerms)}</p>` : ''}
                ${place || tags || metaTrail
                  ? `
                    <div class="bit-search-result__footer">
                      ${place || tags ? `<div class="bit-search-result__tags">${place}${tags}</div>` : '<div></div>'}
                      ${metaTrail ? `<div class="bit-search-result__meta-line">${metaTrail}</div>` : ''}
                    </div>
                  `
                  : ''}
              </div>
            </div>
          </a>
        </article>
      `;
    })
    .join('');

  browseRoot?.setAttribute('hidden', 'true');
  resultsRoot.removeAttribute('hidden');
};

const filterIndexItems = (index: IndexItem[], queryTerms: string[], year: number | null, tag: string | null = activeTag) =>
  index.filter((item) => {
    const key = getIndexKey(item);
    if (!key) return false;
    if (year !== null && item.year !== year) return false;
    if (tag !== null && !item.tags.some((t) => t === tag)) return false;
    const hay = indexHay?.get(key) || '';
    return queryTerms.every((term) => hay.includes(term.toLowerCase()));
  });

const scheduleApplyFilter = (delay = FILTER_DEBOUNCE_MS) => {
  if (filterTimer !== null) {
    window.clearTimeout(filterTimer);
  }
  filterTimer = window.setTimeout(() => {
    filterTimer = null;
    void applyFilter();
  }, delay);
};

const resetFilters = (options: { focusInput?: boolean } = {}) => {
  filterRunId += 1;
  if (filterTimer !== null) {
    window.clearTimeout(filterTimer);
    filterTimer = null;
  }
  closeMoreMenu();
  if (input) {
    input.value = '';
  }
  setActiveYearState(null);
  setActiveTagState(null);
  showBrowse();
  setStatus('');
  syncUrlState('', null, null);
  if (options.focusInput) {
    input?.focus();
  }
};

const setDegradedMode = () => {
  if (input) {
    input.placeholder = '색인 로딩 실패';
    input.disabled = true;
    input.setAttribute('aria-disabled', 'true');
  }
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  }
  yearButtons.forEach((button) => {
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('disabled', 'true');
  });
  yearMoreTrigger?.setAttribute('aria-disabled', 'true');
  yearMoreTrigger?.setAttribute('disabled', 'true');
  yearMenuButtons.forEach((button) => {
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('disabled', 'true');
  });
  if (yearSelect) {
    yearSelect.disabled = true;
    yearSelect.setAttribute('aria-disabled', 'true');
  }
  yearSelectWrap?.setAttribute('data-disabled', 'true');
  closeMoreMenu();
  setStatus('색인 로딩 실패, 검색이 비활성화되었습니다');
  showBrowse();
};

const loadIndex = async () => {
  if (indexCache) return indexCache;
  if (indexFailed) return null;
  if (!indexPromise) {
    setStatus('색인 로딩 중...', { visible: false });
    indexPromise = fetch(indexUrl, {
      cache: shouldBypassIndexCache ? 'no-store' : 'default'
    })
      .then((response) => {
        if (!response.ok) throw new Error('index fetch failed');
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('index data invalid');
        indexCache = data as IndexItem[];
        indexHay = new Map(
          indexCache
            .map((item) => [getIndexKey(item), buildHay(item)] as const)
            .filter(([key]) => key !== '')
        );
        setStatus('');
        return indexCache;
      })
      .catch(() => {
        indexFailed = true;
        setDegradedMode();
        return null;
      });
  }
  return indexPromise;
};

const applyFilter = async (preloadedIndex: IndexItem[] | null = null) => {
  if (!input) return;
  if (filterTimer !== null) {
    window.clearTimeout(filterTimer);
    filterTimer = null;
  }

  const runId = ++filterRunId;
  const rawQuery = getTrimmedQuery();
  const queryTerms = getQueryTerms(rawQuery);
  const normalizedQuery = rawQuery.toLowerCase();

  if (rawQuery === '' && activeYear === null && activeTag === null) {
    showBrowse();
    setStatus('');
    syncUrlState('', null, null);
    return;
  }

  const index = preloadedIndex ?? (await loadIndex());
  if (runId !== filterRunId || getNormalizedQuery() !== normalizedQuery) {
    return;
  }
  if (!index || !indexHay) {
    showBrowse();
    return;
  }

  syncUrlState(rawQuery, activeYear);

  const matchedItems = filterIndexItems(index, queryTerms, activeYear, activeTag);
  if (matchedItems.length === 0) {
    showBrowse();
    if (resultsRoot && resultsListEl) {
      if (resultsSummaryEl) {
        resultsSummaryEl.textContent = '검색 결과 없음';
      }
      resultsListEl.innerHTML = `<p class="bits-search-results__empty">${escapeHtml(getEmptyResultsText(rawQuery, activeYear))}</p>`;
      browseRoot?.setAttribute('hidden', 'true');
      resultsRoot.removeAttribute('hidden');
    }
    setStatus('');
    return;
  }

  renderResults(matchedItems);
  setStatus('');
};

input?.addEventListener('focus', () => {
  void loadIndex();
});

input?.addEventListener('input', () => {
  scheduleApplyFilter();
});

input?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    resetFilters({ focusInput: true });
    return;
  }
  if (event.key !== 'ArrowDown' || !isResultsVisible()) return;
  const firstResultLink = getFirstResultLink();
  if (!firstResultLink) return;
  event.preventDefault();
  firstResultLink.focus();
});

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  void applyFilter();
});

clearBtn?.addEventListener('click', () => {
  resetFilters({ focusInput: true });
});

resultsListEl?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const link = target?.closest<HTMLAnchorElement>('a[href]');
  if (!link) return;

  const nextUrl = new URL(link.href, window.location.href);
  const currentUrl = new URL(window.location.href);
  if (nextUrl.pathname !== currentUrl.pathname) {
    return;
  }

  event.preventDefault();
  resetFilters();

  if (!nextUrl.hash) return;
  const targetEl = document.getElementById(nextUrl.hash.slice(1));
  if (!targetEl) {
    window.location.hash = nextUrl.hash;
    return;
  }

  const basePath = getFilterUrl('', null);
  window.history.replaceState({}, '', basePath);
  window.requestAnimationFrame(() => {
    window.location.hash = nextUrl.hash;
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

resultsListEl?.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowUp') return;
  const target = event.target as HTMLElement | null;
  const currentLink = target?.closest<HTMLAnchorElement>('.bit-search-result__link');
  const firstResultLink = getFirstResultLink();
  if (!currentLink || !firstResultLink || currentLink !== firstResultLink) return;
  event.preventDefault();
  input?.focus();
});

yearButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const year = getYearButtonValue(button);
    if (button.dataset.bitsYear !== '' && year === null) return;
    if (indexFailed || activeYear === year) return;

    closeMoreMenu();
    setActiveYearState(year);
    await applyFilter();
  });
});

yearMoreTrigger?.addEventListener('click', (event) => {
  event.preventDefault();
  if (indexFailed) return;
  setMoreMenuOpen(!isMoreMenuOpen);
});

yearMoreTrigger?.addEventListener('keydown', (event) => {
  if (indexFailed) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setMoreMenuOpen(true);
    (yearMenuButtons.find((button) => button.classList.contains('is-active')) ?? yearMenuButtons[0])?.focus();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMoreMenu();
    yearMoreTrigger.focus();
  }
});

yearMenuButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (indexFailed) return;
    const year = getYearButtonValue(button);
    if (year === null || activeYear === year) {
      closeMoreMenu();
      return;
    }

    setActiveYearState(year);
    closeMoreMenu();
    await applyFilter();
  });
});

yearMenu?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMoreMenu();
    yearMoreTrigger?.focus();
    return;
  }

  const currentIndex = yearMenuButtons.findIndex((button) => button === document.activeElement);
  if (currentIndex < 0) return;

  let nextIndex = currentIndex;
  if (event.key === 'ArrowDown') {
    nextIndex = currentIndex >= yearMenuButtons.length - 1 ? 0 : currentIndex + 1;
  } else if (event.key === 'ArrowUp') {
    nextIndex = currentIndex <= 0 ? yearMenuButtons.length - 1 : currentIndex - 1;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = yearMenuButtons.length - 1;
  }

  if (nextIndex === currentIndex) return;
  event.preventDefault();
  yearMenuButtons[nextIndex]?.focus();
});

yearSelect?.addEventListener('change', async () => {
  if (indexFailed) return;

  const raw = yearSelect.value.trim();
  const year = raw ? Number(raw) : null;
  if (raw && !Number.isFinite(year)) return;
  if (activeYear === year) return;

  closeMoreMenu();
  setActiveYearState(year);
  await applyFilter();
});

yearMoreRoot?.addEventListener('focusout', (event) => {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && yearMoreRoot.contains(nextTarget)) {
    return;
  }
  closeMoreMenu();
});

document.addEventListener('pointerdown', (event) => {
  if (!isMoreMenuOpen || !yearMoreRoot) return;
  const target = event.target;
  if (target instanceof Node && yearMoreRoot.contains(target)) return;
  closeMoreMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeMoreMenu();
});

window.addEventListener('resize', () => {
  closeMoreMenu();
  updateYearCursor();
});

yearFilterRoot?.setAttribute('data-ready', 'true');

tagTrigger?.addEventListener('click', () => {
  openTagDialog();
});

tagCloseBtn?.addEventListener('click', () => {
  closeTagDialog();
  tagTrigger?.focus();
});

tagDialog?.addEventListener('close', () => {
  tagTrigger?.setAttribute('aria-expanded', 'false');
});

tagDialog?.addEventListener('click', (event) => {
  if (event.target === tagDialog) {
    closeTagDialog();
  }
});

tagButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (indexFailed) return;
    const tag = button.dataset.bitsTag ?? null;
    if (!tag) return;
    closeTagDialog();
    tagTrigger?.focus();
    if (activeTag === tag) {
      setActiveTagState(null);
    } else {
      setActiveTagState(tag);
    }
    await applyFilter();
  });
});

const initialState = readInitialState();
if (input && initialState.query) {
  input.value = initialState.query;
}
setActiveYearState(initialState.year);
setActiveTagState(initialState.tag);
syncUrlState(initialState.query, initialState.year, initialState.tag);

if (initialState.query || initialState.year !== null || initialState.tag !== null) {
  void applyFilter();
}
