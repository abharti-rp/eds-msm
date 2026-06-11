import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import {
  getLanguage,
  discoverLanguagesFromPlaceholders,
  computeLocalizedUrl,
} from '../../scripts/utils.js';
/* eslint-disable max-len */

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  if (navSections) {
    const navDrops = navSections.querySelectorAll('.nav-drop');
    if (isDesktop.matches) {
      navDrops.forEach((drop) => {
        if (!drop.hasAttribute('tabindex')) {
          drop.setAttribute('tabindex', 0);
          drop.addEventListener('focus', focusNavSection);
        }
      });
    } else {
      navDrops.forEach((drop) => {
        drop.removeAttribute('tabindex');
        drop.removeEventListener('focus', focusNavSection);
      });
    }
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const currentLang = getLanguage();
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  const navTools = nav.querySelector('.nav-tools');
  if (navTools) {
    const contentWrapper = nav.querySelector('.nav-tools > div[class = "default-content-wrapper"]');
    // Language switcher (minimal UI)
    try {
      const langWrap = document.createElement('div');
      langWrap.className = 'lang-switcher';
      const langBtn = document.createElement('button');
      langBtn.type = 'button';
      langBtn.className = 'lang-button';
      langBtn.setAttribute('aria-haspopup', 'listbox');
      langBtn.setAttribute('aria-expanded', 'false');
      langBtn.textContent = `${currentLang.langCode.toUpperCase()}${currentLang.countryCode ? `-${currentLang.countryCode.toUpperCase()}` : ''}`;
      const langMenu = document.createElement('ul');
      langMenu.className = 'lang-menu';
      langMenu.setAttribute('role', 'listbox');
      const langResult = await discoverLanguagesFromPlaceholders();
      let uniqueLangs = [];
      let isLangOnly = true;
      if (langResult) {
        if (langResult.isLangOnly) {
          uniqueLangs = [...new Set(langResult.langs && langResult.langs.length ? langResult.langs : ['en'])];
        } else {
          isLangOnly = false;
          uniqueLangs = langResult.langs;
        }
      }
      if (uniqueLangs.length <= 1) {
        langBtn.setAttribute('disabled', 'true');
        langWrap.classList.add('single-lang');
      }
      const regionNames = (() => {
        try { return new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }); } catch (e) { return null; }
      })();
      const languageNames = (() => {
        try { return new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }); } catch (e) { return null; }
      })();

      uniqueLangs.forEach((raw) => {
        let displayCode;
        let langCode;
        let country;
        let countryCode;
        if (isLangOnly) {
          const code = String(raw).replace('_', '-').toLowerCase();
          const [langPart, regionPart] = code.split('-');
          displayCode = `${langPart}${regionPart ? `-${regionPart}` : ''}`.toUpperCase();
          // eslint-disable-next-line no-nested-ternary
          country = regionPart ? (regionNames ? regionNames.of(regionPart.toUpperCase()) : regionPart.toUpperCase())
            : (languageNames ? languageNames.of(langPart) : langPart.toUpperCase());
          langCode = langPart;
        } else {
          langCode = raw.lang;
          displayCode = raw.langText;
          country = raw.langRegText;
          countryCode = raw.langReg;
        }

        const isLangSelected = langCode === currentLang.langCode && (!countryCode || !currentLang.countryCode || countryCode === currentLang.countryCode);
        const li = document.createElement('li');
        li.className = 'lang-item';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', isLangSelected ? 'true' : 'false');

        const link = document.createElement('a');
        // Use only language segment for routing if site paths are language-based
        link.href = computeLocalizedUrl(langCode, countryCode);

        const pre = document.createElement('span');
        pre.className = 'lang-pretitle';
        pre.textContent = displayCode;

        const name = document.createElement('span');
        name.className = 'lang-country';
        name.textContent = country;
        if (countryCode) {
          name.setAttribute('lang-country-code', countryCode);
        }

        link.append(name, pre);
        li.append(link);
        langMenu.append(li);
      });
      langBtn.addEventListener('click', () => {
        const expanded = langBtn.getAttribute('aria-expanded') === 'true';
        langBtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        langWrap.classList.toggle('open', !expanded);
      });
      document.addEventListener('click', (e) => {
        if (!langWrap.contains(e.target)) {
          langBtn.setAttribute('aria-expanded', 'false');
          langWrap.classList.remove('open');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          langBtn.setAttribute('aria-expanded', 'false');
          langWrap.classList.remove('open');
        }
      });
      langWrap.append(langBtn, langMenu);
      const targetContainer = contentWrapper || navTools;
      targetContainer.append(langWrap);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Language switcher init failed', e);
    }
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
