/* eslint-disable no-multi-spaces */
// eslint-disable-next-line import/no-cycle
import { isAuthorEnvironment } from './scripts.js';
import { fetchPlaceholders } from './placeholders.js';

export const INTERNAL_PAGES = ['/footer', '/nav', '/data', '/drafts'];
export const PATH_PREFIX = '/language-masters';
export const SUPPORTED_LANGUAGES = [
  'en',    // English
  'fr',    // French
  'de',    // German
  'es',    // Spanish
  'it',    // Italian
  'pt',    // Portuguese
  'nl',    // Dutch
  'sv',    // Swedish
  'da',    // Danish
  'ru',    // Russian
  'ja',    // Japanese
  'zh',    // Chinese (Simplified)
  'zh_TW', // Chinese (Traditional)
  'ko',    // Korean
  'ar',    // Arabic
  'he',    // Hebrew
];
let lang;

/**
 * Extracts the site name from the current URL pathname
 * @description Extracts the site name from paths following the pattern /content/site-name/...
 * For example:
 * - From "/content/eds-msm/language-masters/en/path" returns "eds-msm"
 * - From "/content/eds-msm/language-masters/en/path/to/content.html" returns "eds-msm"
 * @returns {string} The site name extracted from the path, or empty string if not found
 */
export async function getSiteName() {
  let siteName = '';
  try {
    if (isAuthorEnvironment()) {
      // Fallback to extracting from pathname
      const { pathname } = window.location;
      siteName = pathname.split('/content/')[1]?.split('/')[0] || '';
    } else {
      const listOfAllPlaceholdersData = await fetchPlaceholders();
      siteName = listOfAllPlaceholdersData?.siteName;
      if (siteName) {
        siteName = siteName.replaceAll('/content/', '');
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Error fetching placeholders for siteName:', error);
  }
  return siteName || '';
}

/**
 * Process current pathname and return details for use in language switching
 * Considers pathnames like /en/path/to/content and
 * /content/eds-msm/language-masters/en/path/to/content.html for both EDS and AEM
 */
export function getPathDetails() {
  const { pathname } = window.location;
  const isContentPath = pathname.startsWith('/content');
  const parts = pathname.split('/');
  const safePartGet = (index) => (parts.length > index ? parts[index] : '');
  /* 5 is the index of the language in the path for AEM content paths like
    /content/eds-msm/language-masters/en/path/to/content.html
    2 is the index of the language in the path for EDS paths like /en/path/to/content
  */
  let countryCode = isContentPath ? safePartGet(3) : safePartGet(1);
  let langCode = isContentPath ? safePartGet(4) : safePartGet(2);
  // remove suffix from lang and country if any
  if (countryCode.indexOf('.') > -1) {
    countryCode = countryCode.substring(0, countryCode.indexOf('.'));
  }
  if (langCode.indexOf('.') > -1) {
    langCode = langCode.substring(0, langCode.indexOf('.'));
  }
  if (!countryCode) countryCode = 'us'; // default to us
  if (!SUPPORTED_LANGUAGES.includes(langCode) && SUPPORTED_LANGUAGES.includes(countryCode)) {
    langCode = countryCode;
    countryCode = '';
  }
  if (!langCode) langCode = 'en'; // default to en
  // substring before lang
  const codeText = `${countryCode ? ('/' + countryCode) : ''}/${langCode}`;
  const prefix = pathname.substring(0, pathname.indexOf(codeText)) || '';
  let suffix = pathname.substring(pathname.indexOf(codeText) + codeText.length) || '';
  if (suffix.startsWith('/')) suffix = suffix.replace(/^\/+/, '');
  return {
    prefix,
    suffix,
    langCode,
    countryCode,
    isContentPath,
  };
}

/**
 * Fetch and return language of current page.
 * @returns language of current page
 */
export function getLanguage() {
  if (!lang) {
    const { langCode, countryCode } = getPathDetails();
    if (!SUPPORTED_LANGUAGES.includes(langCode)) {
      lang = { langCode: 'en', countryCode: '' };
    } else {
      lang = {langCode, countryCode};
    }
  }
  return lang;
}

export function setPageLanguage() {
  const currentLang = getLanguage().langCode;
  document.documentElement.lang = currentLang;
}

/**
 * Compute the URL of the current page for a target language.
 * Supports both EDS-style (/en/path) and AEM author (/content/{site}/language-masters/en/path.html)
 */
export function computeLocalizedUrl(targetLang, tragetCountryCode) {
  try {
    if (!targetLang || typeof targetLang !== 'string') return window.location.href;
    const { suffix, isContentPath } = getPathDetails();

    const url = new URL(window.location.href);
    const query = url.search || '';
    const hash = url.hash || '';

    if (!isContentPath) {
      // EDS: /{lang}/{suffix}
      const cleanSuffix = suffix ? suffix.replace(/^\/+/, '') : '';
      const next = `${tragetCountryCode ? ('/' + tragetCountryCode) : ''}/${targetLang}${cleanSuffix ? `/${cleanSuffix}` : ''}`;
      return `${next}${query}${hash}`;
    }

    // AEM author: /content/{site}/language-masters/{lang}/{suffix}.html
    // getSiteName can be async; fall back to path parsing if needed synchronously
    const { pathname } = window.location;
    const parts = pathname.split('/');
    const siteNameFromPath = parts[2] || '';
    const base = `/content/${siteNameFromPath}${tragetCountryCode ? ('/' + tragetCountryCode) : PATH_PREFIX}/${targetLang}`;
    // Normalize suffix:
    // - treat ".html" (language root) as empty
    // - strip any trailing .html from non-empty suffixes to avoid double extensions
    const normalizedSuffix = (() => {
      if (!suffix) return '';
      const withoutLeadingSlashes = suffix.replace(/^\/+/, '');
      // Remove one or more trailing ".html" occurrences
      const strippedTrailingHtml = withoutLeadingSlashes.replace(/(?:\.html)+$/i, '');
      // Treat purely ".html" (or repeated) as empty suffix
      if (!strippedTrailingHtml || strippedTrailingHtml === '.') return '';
      return strippedTrailingHtml;
    })();
    const withSuffix = normalizedSuffix ? `/${normalizedSuffix}` : '';
    return `${base}${withSuffix}.html${query}${hash}`;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('computeLocalizedUrl failed', e);
    return window.location.href;
  }
}

/**
 * Discover available languages from placeholders.
 * Authors can set a row in placeholders with Key=languages and Text="en,fr,de".
 * Falls back to ['en'] if not present.
 */
export async function discoverLanguagesFromPlaceholders() {
  const result = { isLangOnly: true, langs: ['en'] };
  try {
    const placeholders = await fetchPlaceholders();
    let raw = placeholders.countrylanguagelist;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.countryList) && parsed.countryList.length) {
        const langList = [];
        parsed.countryList.forEach((country) => {
          if (country && Array.isArray(country.languageList) && country.languageList.length) {
            country.languageList.forEach((lang) => {
              langList.push({
                lang: lang.key,
                langText: lang.text,
                langReg: country.key,
                langRegText: country.text
              });
            });
          }
        });
        if (langList.length) {
          result.isLangOnly = false;
          result.langs = langList;
        }
      }
    } else {
      raw = placeholders.languages || '';
      const parsed = String(raw)
        .split(',')
        .map((s) => s && s.trim())
        .filter(Boolean);
      if (parsed.length) result.langs = parsed;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('discoverLanguagesFromPlaceholders failed', e);
  }
  return result;
}

export async function fetchData(url, method = 'GET', headers = {}, body = null) {
  try {
    const options = { method, headers: { ...headers } };
    if (method === 'POST' && body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error fetching data from ${url}:`, error);
    return null;
  }
}
