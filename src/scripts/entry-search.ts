import { getTagKeys, getTagPath, toTagKey, type TagScope } from '../lib/tags';
import { createWithBase } from '../utils/format';

type IndexItem = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  text: string;
  date: string | null;
};

type PageItem = {
  el: HTMLElement;
  slug: string;
};

const root = document.querySelector<HTMLElement>('[data-entry-filters]');
const FILTER_DEBOUNCE_MS = 120;
const HOVER_PREVIEW_CLOSE_DELAY_MS = 48;
const HOVER_PREVIEW_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const getQueryTerms = (query: string) =>
  Array.from(new Set(query.split(/\s+/).map((term) => term.trim().toLowerCase()).filter(Boolean)));

if (!root) {
  // Current page does not use entry search / tags.
} else {
  const searchRoot = root.querySelector<HTMLElement>('[data-entry-search]');
  const input = searchRoot?.querySelector<HTMLInputElement>('[data-entry-search-input]') ?? null;
  const toggleBtn = searchRoot?.querySelector<HTMLButtonElement>('[data-entry-search-toggle]') ?? null;
  const panel = searchRoot?.querySelector<HTMLElement>('[data-entry-search-panel]') ?? null;
  const feedbackEl = searchRoot?.querySelector<HTMLParagraphElement>('[data-entry-search-feedback]') ?? null;
  const liveEl = searchRoot?.querySelector<HTMLParagraphElement>('[data-entry-search-live]') ?? null;
  const tagTrigger = root.querySelector<HTMLAnchorElement>('[data-entry-tag-trigger]');
  const tagDialog = root.querySelector<HTMLDialogElement>('[data-entry-tag-dialog]');
  const tagCloseBtn = root.querySelector<HTMLButtonElement>('[data-entry-tag-close]');
  const tagDialogTitle = tagDialog?.querySelector<HTMLElement>('.entry-tags-dialog__title') ?? null;
  const indexUrlRaw = (root.dataset.indexUrl ?? '').trim();
  const sectionSelector = (root.dataset.sectionSelector ?? '').trim();
  const tagScopeRaw = (root.dataset.tagScope ?? '').trim();
  const activeTagKey = (root.dataset.activeTagKey ?? '').trim();
  const activeTagLabel = (root.dataset.activeTagLabel ?? '').trim();

  const base = import.meta.env.BASE_URL ?? '/';
  const withBase = createWithBase(base);
  const indexUrl = indexUrlRaw ? withBase(indexUrlRaw) : '';
  const shouldBypassIndexCache = import.meta.env.DEV;

  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-entry-item]')).map((el) => ({
    el,
    slug: (el.getAttribute('data-slug') || '').trim()
  })) as PageItem[];

  const sections = sectionSelector
    ? Array.from(document.querySelectorAll<HTMLElement>(sectionSelector))
    : [];
  const tagScope: TagScope | null = tagScopeRaw === 'archive' ? 'archive' : null;
  const availableTagKeys = new Set(
    Array.from(root.querySelectorAll<HTMLElement>('[data-entry-tag-key]'))
      .map((el) => (el.dataset.entryTagKey ?? '').trim())
      .filter(Boolean)
  );

  const setFeedbackStatus = (text: string) => {
    if (!feedbackEl) return;
    const next = text.trim();
    const nextHidden = next === '';
    if (feedbackEl.textContent === next && feedbackEl.hidden === nextHidden) return;
    feedbackEl.textContent = next;
    feedbackEl.hidden = nextHidden;
  };

  const setLiveStatus = (text: string) => {
    if (!liveEl) return;
    if (liveEl.textContent === text) return;
    liveEl.textContent = text;
  };

  const setStatus = (
    text: string,
    options: {
      announce?: boolean;
      visible?: boolean;
    } = {}
  ) => {
    const { announce = true, visible = true } = options;
    setFeedbackStatus(visible ? text : '');
    setLiveStatus(announce ? text : '');
  };

  const setItemVisible = (item: PageItem, visible: boolean) => {
    if (item.el.hidden === !visible) return;
    item.el.hidden = !visible;
  };

  const syncLegacyTagParam = () => {
    const url = new URL(window.location.href);
    const rawTag = (url.searchParams.get('tag') ?? '').trim();
    if (!rawTag) return;

    if (!tagScope) {
      url.searchParams.delete('tag');
      const fallback = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (fallback !== current) {
        window.history.replaceState({}, '', fallback);
      }
      return;
    }

    const tagKey = toTagKey(rawTag);
    url.searchParams.delete('tag');
    const search = url.searchParams.toString();
    const hash = url.hash || '';
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (!tagKey || (availableTagKeys.size > 0 && !availableTagKeys.has(tagKey))) {
      const fallback = `${url.pathname}${search ? `?${search}` : ''}${hash}`;
      if (fallback !== current) {
        window.history.replaceState({}, '', fallback);
      }
      return;
    }

    const targetPath = withBase(getTagPath(tagScope, tagKey));
    const target = `${targetPath}${search ? `?${search}` : ''}${hash}`;
    if (target !== current) {
      window.location.replace(target);
    }
  };

  const showAllItems = () => {
    for (const item of items) {
      setItemVisible(item, true);
    }
  };

  const syncSections = (hasActiveFilter: boolean) => {
    if (!sections.length) return;
    for (const section of sections) {
      const sectionItems = Array.from(section.querySelectorAll<HTMLElement>('[data-entry-item]'));
      const hasVisible = sectionItems.some((el) => !el.hidden);
      section.hidden = hasActiveFilter && !hasVisible;
    }
  };

  const buildHay = (item: IndexItem) => {
    const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
    return `${item.title ?? ''} ${item.description ?? ''} ${tags} ${item.text ?? ''}`.toLowerCase();
  };

  let indexPromise: Promise<IndexItem[] | null> | null = null;
  let indexCache: IndexItem[] | null = null;
  let indexHay: Map<string, string> | null = null;
  let indexTagKeys: Map<string, string[]> | null = null;
  let indexFailed = false;
  let filterTimer: number | null = null;
  let filterRunId = 0;
  let hoverCloseTimer: number | null = null;
  let hoverPreviewActive = false;
  const hoverPreviewMedia = window.matchMedia(HOVER_PREVIEW_MEDIA_QUERY);

  const isSearchOpen = () => searchRoot?.classList.contains('is-open') ?? false;
  const supportsHoverPreview = () => hoverPreviewMedia.matches;

  const setSearchOpen = (open: boolean) => {
    if (!searchRoot) return;
    searchRoot.classList.toggle('is-open', open);
    toggleBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel?.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (input) input.tabIndex = open ? 0 : -1;
  };

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimer === null) return;
    window.clearTimeout(hoverCloseTimer);
    hoverCloseTimer = null;
  };

  const hasSearchValue = () => Boolean(input?.value.trim());

  const isInputFocused = () => document.activeElement === input;

  const closeSearch = (options: { reset?: boolean } = {}) => {
    clearHoverCloseTimer();
    hoverPreviewActive = false;
    if (options.reset) {
      resetSearch();
    }
    setSearchOpen(false);
  };

  const openSearchInteractive = (options: { focusInput?: boolean; preloadIndex?: boolean } = {}) => {
    clearHoverCloseTimer();
    hoverPreviewActive = false;
    setSearchOpen(true);
    if (options.focusInput) {
      window.setTimeout(() => input?.focus(), 0);
    }
    if (options.preloadIndex) {
      void loadIndex();
    }
  };

  const openSearchHoverPreview = () => {
    if (!supportsHoverPreview() || indexFailed) return;
    clearHoverCloseTimer();
    if (isSearchOpen() && !hoverPreviewActive) return;
    hoverPreviewActive = true;
    setSearchOpen(true);
  };

  const scheduleHoverPreviewClose = () => {
    if (!supportsHoverPreview() || !hoverPreviewActive) return;
    clearHoverCloseTimer();
    hoverCloseTimer = window.setTimeout(() => {
      hoverCloseTimer = null;
      if (!hoverPreviewActive || hasSearchValue() || isInputFocused()) return;
      closeSearch();
    }, HOVER_PREVIEW_CLOSE_DELAY_MS);
  };

  const getStatusPrefix = (query: string, totalMatches: number) => {
    if (query && activeTagLabel) {
      return `태그 #${activeTagLabel} 내 총 ${totalMatches}건 일치`;
    }
    if (query) {
      return totalMatches === 0 ? '일치하는 항목 없음' : `총 ${totalMatches}건 일치`;
    }
    return '';
  };

  const updateStatusForMatches = (query: string, totalMatches: number, visibleMatches: number) => {
    const prefix = getStatusPrefix(query, totalMatches);
    if (!prefix) {
      setStatus('');
      return;
    }

    if (totalMatches === 0) {
      setStatus('일치하는 항목 없음');
      return;
    }
    if (visibleMatches === totalMatches) {
      setStatus(query && !activeTagKey ? `${totalMatches}건 일치` : prefix);
      return;
    }
    if (visibleMatches === 0) {
      setStatus(`${prefix} (현재 페이지에 결과 없음, 페이지를 넘겨 확인하세요)`);
      return;
    }
    setStatus(`${prefix} (현재 페이지 ${visibleMatches}건, 페이지를 넘겨 더 보기)`);
  };

  const scheduleApplyFilter = (delay = FILTER_DEBOUNCE_MS) => {
    if (filterTimer !== null) {
      window.clearTimeout(filterTimer);
    }
    filterTimer = window.setTimeout(() => {
      filterTimer = null;
      void applyFilter();
    }, delay);
  };

  const setDegradedMode = () => {
    if (input) {
      input.placeholder = '색인 로딩 실패';
      input.disabled = true;
      input.setAttribute('aria-disabled', 'true');
    }
    if (toggleBtn) {
      toggleBtn.disabled = true;
      toggleBtn.setAttribute('aria-disabled', 'true');
    }
    setSearchOpen(true);
    showAllItems();
    syncSections(false);
    setStatus('색인 로딩 실패, 검색이 비활성화되었습니다');
  };

  const loadIndex = async () => {
    if (!indexUrl) return null;
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
          indexHay = new Map(indexCache.map((item) => [item.slug, buildHay(item)]));
          indexTagKeys = new Map(indexCache.map((item) => [item.slug, getTagKeys(item.tags)]));
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

  const applyFilter = async () => {
    if (filterTimer !== null) {
      window.clearTimeout(filterTimer);
      filterTimer = null;
    }

    const runId = ++filterRunId;
    const rawQuery = (input?.value || '').trim();
    const queryTerms = getQueryTerms(rawQuery);

    if (queryTerms.length === 0) {
      showAllItems();
      syncSections(false);
      setStatus('');
      return;
    }

    const index = await loadIndex();
    if (runId !== filterRunId) return;
    if (!index || !indexHay || !indexTagKeys) return;

    const matchedSlugs = new Set<string>();
    for (const item of index) {
      const hay = indexHay.get(item.slug) || '';
      if (!queryTerms.every((term) => hay.includes(term))) continue;

      if (activeTagKey) {
        const normalizedTagKeys = indexTagKeys.get(item.slug) ?? [];
        if (!normalizedTagKeys.includes(activeTagKey)) continue;
      }

      matchedSlugs.add(item.slug);
    }

    let visibleMatches = 0;
    for (const item of items) {
      const matched = item.slug ? matchedSlugs.has(item.slug) : false;
      setItemVisible(item, matched);
      if (matched) visibleMatches += 1;
    }

    syncSections(true);
    updateStatusForMatches(rawQuery, matchedSlugs.size, visibleMatches);
  };

  const removePickerParam = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('picker') !== 'tag') return;
    url.searchParams.delete('picker');
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === next) return;
    window.history.replaceState({}, '', next);
  };

  const setTagDialogExpanded = (expanded: boolean) => {
    tagTrigger?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };

  const finalizeTagDialogClose = () => {
    if (tagDialog?.open) return;
    setTagDialogExpanded(false);
    removePickerParam();
  };

  const openTagDialog = (options: { focusTitle?: boolean } = {}) => {
    if (!tagDialog || tagDialog.open) return;
    if (typeof tagDialog.showModal === 'function') {
      tagDialog.showModal();
      if (options.focusTitle && tagDialogTitle) {
        window.requestAnimationFrame(() => {
          tagDialogTitle.focus({ preventScroll: true });
        });
      }
      setTagDialogExpanded(true);
      return;
    }
    tagDialog.setAttribute('open', '');
    if (options.focusTitle && tagDialogTitle) {
      window.requestAnimationFrame(() => {
        tagDialogTitle.focus({ preventScroll: true });
      });
    }
    setTagDialogExpanded(true);
  };

  const closeTagDialog = () => {
    if (!tagDialog) return;
    if (typeof tagDialog.close === 'function') {
      tagDialog.close();
      return;
    }
    tagDialog.removeAttribute('open');
    finalizeTagDialogClose();
  };

  const resetSearch = () => {
    if (input) input.value = '';
    showAllItems();
    syncSections(false);
    setStatus('');
  };

  syncLegacyTagParam();
  setSearchOpen(false);
  setTagDialogExpanded(false);

  toggleBtn?.addEventListener('click', () => {
    if (hoverPreviewActive) {
      openSearchInteractive({ focusInput: true, preloadIndex: true });
      return;
    }
    const next = !isSearchOpen();
    if (next) {
      openSearchInteractive({ focusInput: true, preloadIndex: true });
      return;
    }
    closeSearch({ reset: true });
  });

  input?.addEventListener('focus', () => {
    openSearchInteractive({ preloadIndex: true });
  });

  input?.addEventListener('input', () => {
    scheduleApplyFilter();
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSearch({ reset: true });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void applyFilter();
    }
  });

  const handleHoverPreviewEnter = () => {
    openSearchHoverPreview();
  };

  const handleHoverPreviewLeave = (event: PointerEvent) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && searchRoot?.contains(nextTarget)) return;
    scheduleHoverPreviewClose();
  };

  searchRoot?.addEventListener('pointerenter', handleHoverPreviewEnter);
  searchRoot?.addEventListener('pointerleave', handleHoverPreviewLeave);

  document.addEventListener('click', (event) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (!isSearchOpen()) return;
    if (indexFailed) return;
    if (searchRoot?.contains(target)) return;
    if (hasSearchValue()) return;
    closeSearch();
  });

  tagTrigger?.addEventListener('click', (event) => {
    event.preventDefault();
    openTagDialog();
  });

  tagCloseBtn?.addEventListener('click', () => {
    closeTagDialog();
  });

  tagDialog?.addEventListener('cancel', () => {
    window.requestAnimationFrame(() => {
      finalizeTagDialogClose();
    });
  });

  tagDialog?.addEventListener('close', () => {
    finalizeTagDialogClose();
  });

  tagDialog?.addEventListener('click', (event) => {
    if (event.target === tagDialog) {
      closeTagDialog();
    }
  });

  if (new URLSearchParams(window.location.search).get('picker') === 'tag') {
    if (tagDialog) {
      openTagDialog({ focusTitle: true });
    }
    removePickerParam();
  }
}
