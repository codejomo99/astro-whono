import type {
  HomeIntroLinkKey,
  SidebarNavId,
  SiteSocialPresetId
} from '@/lib/theme-settings';
import {
  ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH,
  ADMIN_EMAIL_RE,
  ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH,
  ADMIN_FOOTER_START_YEAR_MIN,
  ADMIN_GITHUB_HOSTS,
  ADMIN_HERO_IMAGE_ALT_MAX_LENGTH,
  ADMIN_HERO_PRESET_SET,
  ADMIN_HOME_INTRO_LINK_LIMIT,
  ADMIN_HOME_INTRO_MAX_LENGTH,
  ADMIN_LOCALE_RE,
  ADMIN_NAV_IDS,
  ADMIN_NAV_ORDER_MAX,
  ADMIN_NAV_ORDER_MIN,
  ADMIN_NAV_ORNAMENT_MAX_LENGTH,
  ADMIN_PAGE_SUBTITLE_MAX_LENGTH,
  ADMIN_PAGE_TITLE_MAX_LENGTH,
  ADMIN_SOCIAL_CUSTOM_LIMIT,
  ADMIN_SOCIAL_ORDER_MAX,
  ADMIN_SOCIAL_ORDER_MIN,
  ADMIN_SOCIAL_PRESET_IDS,
  ADMIN_X_HOSTS,
  getAdminNavOrderIssues,
  getAdminSocialOrderIssues,
  isAdminAllowedHttpsUrl,
  isAdminHomeIntroLinkKey,
  isAdminSidebarDividerVariant,
  isAdminSocialIconKey,
  isAdminSocialPresetId,
  normalizeAdminBitsAvatarPath,
  normalizeAdminHeroImageSrc
} from '@/lib/admin-console/shared';
import { normalizeEmail, type EditableSettings } from './form-codec';

export type ValidationIssue = {
  message: string;
  focusTarget?: () => HTMLElement | null;
};

type QueryAll = <T extends Element>(parent: ParentNode, selector: string) => T[];

type ValidationContext = {
  form: HTMLFormElement;
  queryAll: QueryAll;
  footerStartYearMax: number;
  socialCustomAddBtn: HTMLButtonElement;
  inputSiteTitle: HTMLInputElement;
  inputSiteDescription: HTMLTextAreaElement;
  inputSiteDefaultLocale: HTMLInputElement;
  inputSiteFooterStartYear: HTMLInputElement;
  inputSiteFooterShowCurrentYear: HTMLInputElement;
  inputSiteFooterCopyright: HTMLInputElement;
  inputSiteSocialGithub: HTMLInputElement;
  inputSiteSocialX: HTMLInputElement;
  inputSiteSocialEmail: HTMLInputElement;
  inputShellBrandTitle: HTMLInputElement;
  inputShellQuote: HTMLTextAreaElement;
  inputHomeIntroLead: HTMLTextAreaElement;
  inputHomeShowIntroLead: HTMLInputElement;
  inputHomeIntroMore: HTMLTextAreaElement;
  inputHomeShowIntroMore: HTMLInputElement;
  inputHomeIntroMoreLinkPrimary: HTMLSelectElement;
  inputHomeShowHero: HTMLInputElement;
  inputHeroImageSrc: HTMLInputElement;
  inputHeroImageAlt: HTMLInputElement;
  inputPageEssayTitle: HTMLInputElement;
  inputPageArchiveTitle: HTMLInputElement;
  inputPageBitsTitle: HTMLInputElement;
  inputPageMemoTitle: HTMLInputElement;
  inputPageAboutTitle: HTMLInputElement;
  inputPageEssaySubtitle: HTMLInputElement;
  inputPageArchiveSubtitle: HTMLInputElement;
  inputPageBitsSubtitle: HTMLInputElement;
  inputPageMemoSubtitle: HTMLInputElement;
  inputPageAboutSubtitle: HTMLInputElement;
  inputArticleMetaShowDate: HTMLInputElement;
  inputArticleMetaDateLabel: HTMLInputElement;
  inputArticleMetaShowTags: HTMLInputElement;
  inputArticleMetaShowWordCount: HTMLInputElement;
  inputArticleMetaShowReadingTime: HTMLInputElement;
  inputPageBitsAuthorName: HTMLInputElement;
  inputPageBitsAuthorAvatar: HTMLInputElement;
  inputSidebarDividerDefault: HTMLInputElement;
  getPresetFieldTarget: (id: SiteSocialPresetId, field: 'order' | 'href') => () => HTMLElement | null;
  getCustomFieldTarget: (
    index: number,
    field: 'order' | 'iconKey' | 'id' | 'label' | 'href'
  ) => () => HTMLElement | null;
  getCustomVisibilityTarget: (index: number) => () => HTMLElement | null;
  getNavFieldTarget: (
    id: SidebarNavId,
    field: 'label' | 'ornament' | 'order' | 'visible'
  ) => () => HTMLElement | null;
  getFirstNavLabelTarget: () => HTMLElement | null;
};

export const createValidation = ({
  form,
  queryAll,
  footerStartYearMax,
  socialCustomAddBtn,
  inputSiteTitle,
  inputSiteDescription,
  inputSiteDefaultLocale,
  inputSiteFooterStartYear,
  inputSiteFooterShowCurrentYear,
  inputSiteFooterCopyright,
  inputSiteSocialGithub,
  inputSiteSocialX,
  inputSiteSocialEmail,
  inputShellBrandTitle,
  inputShellQuote,
  inputHomeIntroLead,
  inputHomeShowIntroLead,
  inputHomeIntroMore,
  inputHomeShowIntroMore,
  inputHomeIntroMoreLinkPrimary,
  inputHomeShowHero,
  inputHeroImageSrc,
  inputHeroImageAlt,
  inputPageEssayTitle,
  inputPageArchiveTitle,
  inputPageBitsTitle,
  inputPageMemoTitle,
  inputPageAboutTitle,
  inputPageEssaySubtitle,
  inputPageArchiveSubtitle,
  inputPageBitsSubtitle,
  inputPageMemoSubtitle,
  inputPageAboutSubtitle,
  inputArticleMetaShowDate,
  inputArticleMetaDateLabel,
  inputArticleMetaShowTags,
  inputArticleMetaShowWordCount,
  inputArticleMetaShowReadingTime,
  inputPageBitsAuthorName,
  inputPageBitsAuthorAvatar,
  inputSidebarDividerDefault,
  getPresetFieldTarget,
  getCustomFieldTarget,
  getCustomVisibilityTarget,
  getNavFieldTarget,
  getFirstNavLabelTarget
}: ValidationContext) => {
  const createIssue = (message: string, focusTarget?: () => HTMLElement | null): ValidationIssue =>
    focusTarget ? { message, focusTarget } : { message };

  const resolveIssueField = (issue: ValidationIssue): HTMLElement | null => {
    const candidate = issue.focusTarget?.();
    return candidate instanceof HTMLElement ? candidate : null;
  };

  const clearInvalidFields = (): void => {
    queryAll<HTMLElement>(form, '[aria-invalid="true"]')
      .forEach((element) => element.removeAttribute('aria-invalid'));
  };

  const markInvalidFields = (issues: readonly ValidationIssue[]): void => {
    clearInvalidFields();
    const seen = new Set<HTMLElement>();
    issues.forEach((issue) => {
      const field = resolveIssueField(issue);
      if (!field || seen.has(field)) return;
      field.setAttribute('aria-invalid', 'true');
      seen.add(field);
    });
  };

  const validateSettings = (settings: EditableSettings): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const pushIssue = (message: string, focusTarget?: () => HTMLElement | null): void => {
      issues.push(createIssue(message, focusTarget));
    };

    if (!settings.site.title) pushIssue('站点标题不能为空', () => inputSiteTitle);
    if (!settings.site.description) pushIssue('站点描述不能为空', () => inputSiteDescription);
    if (!settings.site.defaultLocale) {
      pushIssue('默认语言不能为空', () => inputSiteDefaultLocale);
    } else if (!ADMIN_LOCALE_RE.test(settings.site.defaultLocale)) {
      pushIssue('默认语言格式无效（示例：zh-CN）', () => inputSiteDefaultLocale);
    }

    if (!Number.isInteger(settings.site.footer?.startYear)) {
      pushIssue('页脚起始年份必须是整数', () => inputSiteFooterStartYear);
    } else if (
      settings.site.footer.startYear < ADMIN_FOOTER_START_YEAR_MIN ||
      settings.site.footer.startYear > footerStartYearMax
    ) {
      pushIssue('页脚起始年份超出允许范围', () => inputSiteFooterStartYear);
    }

    if (typeof settings.site.footer?.showCurrentYear !== 'boolean') {
      pushIssue('是否显示当前年必须是布尔值', () => inputSiteFooterShowCurrentYear);
    }

    if (!settings.site.footer?.copyright) {
      pushIssue('页脚版权行不能为空', () => inputSiteFooterCopyright);
    } else if (
      settings.site.footer.copyright.includes('\n') ||
      settings.site.footer.copyright.includes('\r')
    ) {
      pushIssue('页脚版权行只允许单行文本', () => inputSiteFooterCopyright);
    } else if (settings.site.footer.copyright.length > ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH) {
      pushIssue(`页脚版权行不能超过 ${ADMIN_FOOTER_COPYRIGHT_MAX_LENGTH} 个字符`, () => inputSiteFooterCopyright);
    }

    if (
      settings.site.socialLinks?.github &&
      !isAdminAllowedHttpsUrl(settings.site.socialLinks.github, ADMIN_GITHUB_HOSTS)
    ) {
      pushIssue('GitHub 链接只允许 https://github.com/... ', () => inputSiteSocialGithub);
    }
    if (
      settings.site.socialLinks?.x &&
      !isAdminAllowedHttpsUrl(settings.site.socialLinks.x, ADMIN_X_HOSTS)
    ) {
      pushIssue('X / Twitter 链接只允许 https://x.com/... 或 https://twitter.com/... ', () => inputSiteSocialX);
    }
    if (
      settings.site.socialLinks?.email &&
      !ADMIN_EMAIL_RE.test(normalizeEmail(settings.site.socialLinks.email))
    ) {
      pushIssue('Email 必须是合法邮箱地址', () => inputSiteSocialEmail);
    }

    const presetOrder = settings.site.socialLinks.presetOrder;
    const customLinks = Array.isArray(settings.site.socialLinks?.custom) ? settings.site.socialLinks.custom : [];
    const socialOrderIssues = getAdminSocialOrderIssues(
      presetOrder,
      customLinks.map((item, index) => ({
        key: String(index),
        order: item.order
      }))
    );
    const presetOrderIssues = new Map<SiteSocialPresetId, 'range' | 'duplicate'>();
    const customOrderIssues = new Map<number, 'range' | 'duplicate'>();

    socialOrderIssues.forEach((issue) => {
      if (issue.scope === 'preset') {
        if (isAdminSocialPresetId(issue.key)) {
          presetOrderIssues.set(issue.key, issue.type);
        }
        return;
      }

      const index = Number.parseInt(issue.key, 10);
      if (Number.isInteger(index)) {
        customOrderIssues.set(index, issue.type);
      }
    });

    ADMIN_SOCIAL_PRESET_IDS.forEach((id) => {
      const order = presetOrder[id];
      const rowLabel = id === 'github' ? 'GitHub' : id === 'x' ? 'X / Twitter' : 'Email';
      const orderIssue = presetOrderIssues.get(id);
      if (orderIssue === 'range') {
        pushIssue(
          `${rowLabel} 的位置排序必须为 ${ADMIN_SOCIAL_ORDER_MIN}-${ADMIN_SOCIAL_ORDER_MAX} 的整数`,
          getPresetFieldTarget(id, 'order')
        );
        return;
      }
      if (orderIssue === 'duplicate') {
        pushIssue(`社交链接位置排序不能重复：${order}`, getPresetFieldTarget(id, 'order'));
      }
    });

    if (customLinks.length > ADMIN_SOCIAL_CUSTOM_LIMIT) {
      pushIssue(`自定义链接最多只能添加 ${ADMIN_SOCIAL_CUSTOM_LIMIT} 条`, () => socialCustomAddBtn);
    }

    const seenCustomIds = new Set<string>();
    customLinks.forEach((item, index) => {
      const rowLabel = `自定义链接 #${index + 1}`;
      if (!item.id) {
        pushIssue(`${rowLabel} 的 ID 不能为空`, getCustomFieldTarget(index, 'id'));
      } else {
        if (item.id.includes('\n') || item.id.includes('\r')) {
          pushIssue(`${rowLabel} 的 ID 只允许单行文本`, getCustomFieldTarget(index, 'id'));
        }
        if (seenCustomIds.has(item.id)) {
          pushIssue(`自定义链接 ID 重复：${item.id}`, getCustomFieldTarget(index, 'id'));
        }
        seenCustomIds.add(item.id);
      }

      if (!item.label) {
        pushIssue(`${rowLabel} 的显示名称不能为空`, getCustomFieldTarget(index, 'label'));
      } else if (item.label.includes('\n') || item.label.includes('\r')) {
        pushIssue(`${rowLabel} 的显示名称只允许单行文本`, getCustomFieldTarget(index, 'label'));
      }

      if (!item.href || !isAdminAllowedHttpsUrl(item.href)) {
        pushIssue(`${rowLabel} 的链接必须是合法 https:// 地址`, getCustomFieldTarget(index, 'href'));
      }
      if (!isAdminSocialIconKey(item.iconKey)) {
        pushIssue(`${rowLabel} 的图标必须从白名单中选择`, getCustomFieldTarget(index, 'iconKey'));
      }
      const orderIssue = customOrderIssues.get(index);
      if (orderIssue === 'range') {
        pushIssue(
          `${rowLabel} 的位置排序必须为 ${ADMIN_SOCIAL_ORDER_MIN}-${ADMIN_SOCIAL_ORDER_MAX} 的整数`,
          getCustomFieldTarget(index, 'order')
        );
      } else if (orderIssue === 'duplicate') {
        pushIssue(`社交链接位置排序不能重复：${item.order}`, getCustomFieldTarget(index, 'order'));
      }
      if (typeof item.visible !== 'boolean') {
        pushIssue(`${rowLabel} 的 visible 必须是布尔值`, getCustomVisibilityTarget(index));
      }
    });

    if (!settings.shell.brandTitle) pushIssue('侧栏站点名不能为空', () => inputShellBrandTitle);
    if (!settings.shell.quote) pushIssue('侧栏引用文案不能为空', () => inputShellQuote);

    if (!settings.home.introLead) {
      pushIssue('首页导语主文案不能为空', () => inputHomeIntroLead);
    } else if (settings.home.introLead.length > ADMIN_HOME_INTRO_MAX_LENGTH) {
      pushIssue(`首页导语主文案不能超过 ${ADMIN_HOME_INTRO_MAX_LENGTH} 个字符`, () => inputHomeIntroLead);
    }

    if (typeof settings.home.showIntroLead !== 'boolean') {
      pushIssue('首页导语主文案展示开关必须是布尔值', () => inputHomeShowIntroLead);
    }

    if (!settings.home.introMore) {
      pushIssue('首页导语补充文案不能为空', () => inputHomeIntroMore);
    } else if (settings.home.introMore.length > ADMIN_HOME_INTRO_MAX_LENGTH) {
      pushIssue(`首页导语补充文案不能超过 ${ADMIN_HOME_INTRO_MAX_LENGTH} 个字符`, () => inputHomeIntroMore);
    }

    if (typeof settings.home.showIntroMore !== 'boolean') {
      pushIssue('首页导语补充文案展示开关必须是布尔值', () => inputHomeShowIntroMore);
    }

    if (!Array.isArray(settings.home.introMoreLinks)) {
      pushIssue('首页导语补充链接必须是数组', () => inputHomeIntroMoreLinkPrimary);
    } else if (
      settings.home.introMoreLinks.length < 1 ||
      settings.home.introMoreLinks.length > ADMIN_HOME_INTRO_LINK_LIMIT
    ) {
      pushIssue(`首页导语补充链接必须选择 1-${ADMIN_HOME_INTRO_LINK_LIMIT} 个入口`, () => inputHomeIntroMoreLinkPrimary);
    } else {
      const seenHomeIntroLinks = new Set<HomeIntroLinkKey>();
      settings.home.introMoreLinks.forEach((linkKey, index) => {
        if (!isAdminHomeIntroLinkKey(linkKey)) {
          pushIssue(`首页导语补充链接 #${index + 1} 非法：${String(linkKey)}`, () => inputHomeIntroMoreLinkPrimary);
          return;
        }
        if (seenHomeIntroLinks.has(linkKey)) {
          pushIssue(`首页导语补充链接不能重复：${linkKey}`, () => inputHomeIntroMoreLinkPrimary);
          return;
        }
        seenHomeIntroLinks.add(linkKey);
      });
    }

    if (!ADMIN_HERO_PRESET_SET.has(settings.home.heroPresetId)) {
      pushIssue('Hero 展示模式只允许 default/none', () => inputHomeShowHero);
    }

    if (
      settings.home.heroImageSrc !== null &&
      normalizeAdminHeroImageSrc(settings.home.heroImageSrc) === undefined
    ) {
      pushIssue(
        'Hero 图片地址只允许 src/assets/**、public/**（或 / 开头路径）以及 https:// 图片地址',
        () => inputHeroImageSrc
      );
    }

    if (!settings.home.heroImageAlt) {
      pushIssue('Hero 图片说明不能为空', () => inputHeroImageAlt);
    } else if (
      settings.home.heroImageAlt.includes('\n') ||
      settings.home.heroImageAlt.includes('\r')
    ) {
      pushIssue('Hero 图片说明只允许单行文本', () => inputHeroImageAlt);
    } else if (settings.home.heroImageAlt.length > ADMIN_HERO_IMAGE_ALT_MAX_LENGTH) {
      pushIssue(`Hero 图片说明不能超过 ${ADMIN_HERO_IMAGE_ALT_MAX_LENGTH} 个字符`, () => inputHeroImageAlt);
    }

    const pageTitleMap: Array<[string | null, string, () => HTMLElement | null]> = [
      [settings.page.essay?.title, '/essay/ 页面主标题', () => inputPageEssayTitle],
      [settings.page.archive?.title, '/archive/ 页面主标题', () => inputPageArchiveTitle],
      [settings.page.bits?.title, '/bits/ 页面主标题', () => inputPageBitsTitle],
      [settings.page.memo?.title, '/memo/ 页面主标题', () => inputPageMemoTitle],
      [settings.page.about?.title, '/about/ 页面主标题', () => inputPageAboutTitle]
    ];

    pageTitleMap.forEach(([title, label, focusTarget]) => {
      if (title == null) return;
      if (typeof title !== 'string') {
        pushIssue(`${label} 必须是字符串或留空`, focusTarget);
        return;
      }
      if (title.includes('\n') || title.includes('\r')) {
        pushIssue(`${label} 只允许单行文本`, focusTarget);
      }
      if (title.length > ADMIN_PAGE_TITLE_MAX_LENGTH) {
        pushIssue(`${label} 不能超过 ${ADMIN_PAGE_TITLE_MAX_LENGTH} 个字符`, focusTarget);
      }
    });

    const pageSubtitleMap: Array<[string | null, string, () => HTMLElement | null]> = [
      [settings.page.essay?.subtitle, '/essay/ 页面副标题', () => inputPageEssaySubtitle],
      [settings.page.archive?.subtitle, '/archive/ 页面副标题', () => inputPageArchiveSubtitle],
      [settings.page.bits?.subtitle, '/bits/ 页面副标题', () => inputPageBitsSubtitle],
      [settings.page.memo?.subtitle, '/memo/ 页面副标题', () => inputPageMemoSubtitle],
      [settings.page.about?.subtitle, '/about/ 页面副标题', () => inputPageAboutSubtitle]
    ];

    pageSubtitleMap.forEach(([subtitle, label, focusTarget]) => {
      if (subtitle == null) return;
      if (typeof subtitle !== 'string') {
        pushIssue(`${label} 必须是字符串或留空`, focusTarget);
        return;
      }
      if (subtitle.includes('\n') || subtitle.includes('\r')) {
        pushIssue(`${label} 只允许单行文本`, focusTarget);
      }
      if (subtitle.length > ADMIN_PAGE_SUBTITLE_MAX_LENGTH) {
        pushIssue(`${label} 不能超过 ${ADMIN_PAGE_SUBTITLE_MAX_LENGTH} 个字符`, focusTarget);
      }
    });

    if (!settings.page.bits?.defaultAuthor?.name) {
      pushIssue('Bits 默认作者名不能为空', () => inputPageBitsAuthorName);
    }
    if (settings.page.bits?.defaultAuthor?.avatar) {
      if (normalizeAdminBitsAvatarPath(settings.page.bits.defaultAuthor.avatar) === undefined) {
        pushIssue(
          'Bits 默认头像只允许相对图片路径（例如 author/avatar.webp），不要带 public/、不要以 / 开头，也不要包含 URL、..、?、#',
          () => inputPageBitsAuthorAvatar
        );
      }
    }

    if (typeof settings.ui?.articleMeta?.showDate !== 'boolean') {
      pushIssue('文章元信息里的“显示发布日期”必须是布尔值', () => inputArticleMetaShowDate);
    }

    if (typeof settings.ui?.articleMeta?.dateLabel !== 'string') {
      pushIssue('文章元信息里的“日期前缀”必须是字符串', () => inputArticleMetaDateLabel);
    } else if (
      settings.ui.articleMeta.dateLabel.includes('\n') ||
      settings.ui.articleMeta.dateLabel.includes('\r')
    ) {
      pushIssue('文章元信息里的“日期前缀”只允许单行文本', () => inputArticleMetaDateLabel);
    } else if (settings.ui.articleMeta.dateLabel.length > ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH) {
      pushIssue(
        `文章元信息里的“日期前缀”不能超过 ${ADMIN_ARTICLE_META_DATE_LABEL_MAX_LENGTH} 个字符`,
        () => inputArticleMetaDateLabel
      );
    }

    if (typeof settings.ui?.articleMeta?.showTags !== 'boolean') {
      pushIssue('文章元信息里的“显示标签”必须是布尔值', () => inputArticleMetaShowTags);
    }

    if (typeof settings.ui?.articleMeta?.showWordCount !== 'boolean') {
      pushIssue('文章元信息里的“显示字数”必须是布尔值', () => inputArticleMetaShowWordCount);
    }

    if (typeof settings.ui?.articleMeta?.showReadingTime !== 'boolean') {
      pushIssue('文章元信息里的“显示阅读时长”必须是布尔值', () => inputArticleMetaShowReadingTime);
    }

    if (!isAdminSidebarDividerVariant(settings.ui?.layout?.sidebarDivider ?? '')) {
      pushIssue('侧栏分隔线只允许 默认 / 弱化 / 隐藏', () => inputSidebarDividerDefault);
    }

    const nav = Array.isArray(settings.shell.nav) ? settings.shell.nav : [];
    if (nav.length !== ADMIN_NAV_IDS.length) {
      pushIssue('Sidebar 导航项数量必须与既有导航一致', getFirstNavLabelTarget);
    }

    const seenIds = new Set<SidebarNavId>();
    const navOrderIssues = new Map<SidebarNavId, 'range' | 'duplicate'>();
    getAdminNavOrderIssues(
      nav.flatMap((item) =>
        ADMIN_NAV_IDS.includes(item.id)
          ? [
              {
                key: item.id as SidebarNavId,
                order: item.order
              }
            ]
          : []
      )
    ).forEach((issue) => {
      navOrderIssues.set(issue.key, issue.type);
    });

    nav.forEach((item) => {
      const navId = ADMIN_NAV_IDS.includes(item.id) ? item.id : null;
      if (!navId) {
        pushIssue(`存在非法导航项 ID：${item.id}`, getFirstNavLabelTarget);
      } else if (seenIds.has(navId)) {
        pushIssue(`导航项 ID 重复：${navId}`, getNavFieldTarget(navId, 'label'));
      }
      if (navId) seenIds.add(navId);

      if (!item.label) {
        pushIssue(
          `导航项 ${item.id} 的显示名称不能为空`,
          navId ? getNavFieldTarget(navId, 'label') : getFirstNavLabelTarget
        );
      }
      if (item.ornament !== null) {
        if (typeof item.ornament !== 'string') {
          pushIssue(
            `导航项 ${item.id} 的点缀必须是字符串或留空`,
            navId ? getNavFieldTarget(navId, 'ornament') : getFirstNavLabelTarget
          );
        } else if (item.ornament.includes('\n') || item.ornament.includes('\r')) {
          pushIssue(
            `导航项 ${item.id} 的点缀只允许单行文本`,
            navId ? getNavFieldTarget(navId, 'ornament') : getFirstNavLabelTarget
          );
        } else if (item.ornament.length > ADMIN_NAV_ORNAMENT_MAX_LENGTH) {
          pushIssue(
            `导航项 ${item.id} 的点缀不能超过 ${ADMIN_NAV_ORNAMENT_MAX_LENGTH} 个字符`,
            navId ? getNavFieldTarget(navId, 'ornament') : getFirstNavLabelTarget
          );
        }
      }
      if (
        !Number.isInteger(item.order) ||
        item.order < ADMIN_NAV_ORDER_MIN ||
        item.order > ADMIN_NAV_ORDER_MAX
      ) {
        pushIssue(
          `导航项 ${item.id} 的位置排序必须为 ${ADMIN_NAV_ORDER_MIN}-${ADMIN_NAV_ORDER_MAX} 的整数`,
          navId ? getNavFieldTarget(navId, 'order') : getFirstNavLabelTarget
        );
      } else if (navId && navOrderIssues.get(navId) === 'duplicate') {
        pushIssue(
          `位置排序不能重复：${item.order}`,
          navId ? getNavFieldTarget(navId, 'order') : getFirstNavLabelTarget
        );
      }
      if (typeof item.visible !== 'boolean') {
        pushIssue(
          `导航项 ${item.id} 的 visible 必须是布尔值`,
          navId ? getNavFieldTarget(navId, 'visible') : getFirstNavLabelTarget
        );
      }
    });

    return issues;
  };

  return {
    validateSettings,
    clearInvalidFields,
    markInvalidFields,
    resolveIssueField
  };
};
