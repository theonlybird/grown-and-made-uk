/* ===========================================================================
   Grown and Made UK — analytics and cookie consent
   ---------------------------------------------------------------------------
   One file, loaded in the <head> of every public page. It does three things:

     1. Blocks Google Analytics until the visitor opts in. Nothing is sent to
        Google — not even a request for the gtag library — before someone
        clicks Accept. This is "basic consent mode": stricter than the usual
        load-it-anyway-with-consent-denied pattern, and the only version that
        squares with UK PECR and with what privacy.html promises.

     2. Draws the consent banner, and remembers the answer.

     3. Exposes window.gm.track(), a safe-to-call-anywhere event helper. If
        consent hasn't been given it does nothing at all. Callers never have to
        check. Instrumentation elsewhere in the site can therefore be a single
        unconditional line.

   ---------------------------------------------------------------------------
   SETUP: paste your GA4 Measurement ID below. It looks like G-XXXXXXXXXX and
   is found in Google Analytics under Admin → Data streams → your web stream.
   While it is left as null the banner still appears and choices are still
   remembered, but no analytics load. That is a safe state to deploy in.
   =========================================================================== */

(function () {
  'use strict';

  var MEASUREMENT_ID = null;   // e.g. 'G-ABC1234XYZ'

  /* Bump this when the policy changes materially enough to need re-asking.
     Everyone's stored choice is discarded and the banner returns. */
  var CONSENT_VERSION = 1;
  var STORE_KEY = 'gm_consent_v' + CONSENT_VERSION;

  /* ---------------------------------------------------------------------
     Storage. Wrapped because Safari private mode throws on access rather
     than returning null, and a thrown error here would take the page down.
     --------------------------------------------------------------------- */
  function readChoice() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function writeChoice(v) {
    try { localStorage.setItem(STORE_KEY, v); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------------
     Consent Mode v2 defaults. Pushed to the dataLayer before anything else
     so that if the library does load later, it has never once been in a
     permitted state.
     --------------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  var loaded = false;
  var granted = false;

  function loadGa() {
    if (loaded || !MEASUREMENT_ID) return;
    loaded = true;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, {
      /* Truncate the visitor's IP before it is stored. */
      anonymize_ip: true,
      /* Don't let Google write its own advertising identifiers. Nothing here
         is for advertising and this site will never run any. */
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function grant() {
    granted = true;
    gtag('consent', 'update', {
      analytics_storage: 'granted'
    });
    loadGa();
  }

  /* ---------------------------------------------------------------------
     The public helper.

     gm.track('business_click', { business_id: 'seh-kelly', ... })

     Silently does nothing without consent. Parameter values are coerced to
     something GA4 will accept: strings are trimmed to 100 characters, and
     null/undefined keys are dropped rather than sent as "undefined".
     --------------------------------------------------------------------- */
  function clean(params) {
    var out = {};
    if (!params) return out;
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === null || v === undefined || v === '') return;
      if (typeof v === 'string') v = v.slice(0, 100);
      out[k] = v;
    });
    return out;
  }

  function track(name, params) {
    if (!granted || !MEASUREMENT_ID) return;
    try { gtag('event', name, clean(params)); } catch (e) { /* never break the page */ }
  }

  /* Business events all want the same shape. Building it in one place means
     the dimensions line up across the map popup, the grid card and the list,
     so "which businesses get clicked" is one report rather than three. */
  function businessParams(b, extra) {
    if (!b) return clean(extra);
    var p = {
      business_id: b.id,
      business_name: b.name,
      business_tier: b.tier,
      business_category: b.category,
      business_county: b.county,
      business_nation: b.nation
    };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return clean(p);
  }

  window.gm = window.gm || {};
  window.gm.track = track;
  window.gm.businessParams = businessParams;
  window.gm.trackBusiness = function (name, b, extra) { track(name, businessParams(b, extra)); };
  window.gm.hasConsent = function () { return granted; };

  /* ---------------------------------------------------------------------
     Banner
     --------------------------------------------------------------------- */
  var STYLE = [
    '.gm-consent{position:fixed;left:0;right:0;bottom:0;z-index:99999;',
    'background:#FFFFFF;border-top:1px solid #D4C9B2;',
    'box-shadow:0 -6px 24px rgba(0,0,0,.10);',
    "font-family:'Karla',-apple-system,system-ui,sans-serif;color:#1E2621;",
    'padding:18px 20px calc(18px + env(safe-area-inset-bottom,0px));}',
    '.gm-consent-inner{max-width:1040px;margin:0 auto;display:flex;gap:20px;',
    'align-items:center;flex-wrap:wrap;justify-content:space-between}',
    '.gm-consent-copy{flex:1 1 380px;min-width:260px}',
    '.gm-consent h2{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;',
    'font-size:20px;margin:0 0 4px;color:#004225;letter-spacing:.01em}',
    '.gm-consent p{margin:0;font-size:13.5px;line-height:1.55;color:#57544B}',
    '.gm-consent a{color:#004225;text-decoration:underline;text-underline-offset:2px}',
    '.gm-consent-actions{display:flex;gap:10px;flex:0 0 auto;flex-wrap:wrap}',
    '.gm-consent button{font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;',
    'border-radius:8px;padding:11px 20px;border:1px solid #D4C9B2;background:#FFFFFF;',
    'color:#1E2621;transition:.15s;min-height:44px}',
    '.gm-consent button:hover{border-color:#004225}',
    '.gm-consent button.gm-accept{background:#004225;border-color:#004225;color:#fff}',
    '.gm-consent button.gm-accept:hover{background:#00301B}',
    '.gm-consent button:focus-visible{outline:2px solid #004225;outline-offset:2px}',
    '@media (max-width:600px){.gm-consent{padding:16px}',
    '.gm-consent-actions{width:100%}.gm-consent-actions button{flex:1}}',
    '.gm-consent-link{background:none;border:none;padding:0;font:inherit;cursor:pointer;',
    'color:inherit;text-decoration:underline;text-underline-offset:2px}'
  ].join('');

  var bannerEl = null;

  function removeBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
  }

  function showBanner() {
    if (bannerEl) return;

    if (!document.getElementById('gm-consent-style')) {
      var st = document.createElement('style');
      st.id = 'gm-consent-style';
      st.textContent = STYLE;
      document.head.appendChild(st);
    }

    bannerEl = document.createElement('div');
    bannerEl.className = 'gm-consent';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-live', 'polite');
    bannerEl.setAttribute('aria-label', 'Cookies');
    bannerEl.innerHTML =
      '<div class="gm-consent-inner">' +
        '<div class="gm-consent-copy">' +
          '<h2>A quiet word about cookies</h2>' +
          '<p>We would like to count visits and see which makers people click through to, ' +
          'so we know what is worth adding next. It is Google Analytics, it sets cookies, ' +
          'and it is entirely up to you. Say no and the map works exactly the same. ' +
          'More in our <a href="privacy.html">privacy policy</a>.</p>' +
        '</div>' +
        '<div class="gm-consent-actions">' +
          '<button type="button" class="gm-decline">No thanks</button>' +
          '<button type="button" class="gm-accept">Accept</button>' +
        '</div>' +
      '</div>';

    bannerEl.querySelector('.gm-accept').addEventListener('click', function () {
      writeChoice('granted');
      removeBanner();
      grant();
      track('consent_granted');
    });
    bannerEl.querySelector('.gm-decline').addEventListener('click', function () {
      writeChoice('denied');
      removeBanner();
    });

    document.body.appendChild(bannerEl);
  }

  /* A way back in for anyone who changes their mind. Wired to anything
     carrying data-consent-settings, and injected into the footer and the
     map's menu so every page has one. */
  window.gm.openConsent = function () { showBanner(); };

  function addSettingsLinks() {
    document.querySelectorAll('[data-consent-settings]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); showBanner(); });
    });

    /* Footer pages: slot it in beside the privacy policy link. */
    var privacyLink = document.querySelector('.foot-col a[href="privacy.html"]');
    if (privacyLink && !document.querySelector('.gm-foot-consent')) {
      var a = document.createElement('a');
      a.href = '#';
      a.className = 'gm-foot-consent';
      a.textContent = 'Cookie settings';
      a.addEventListener('click', function (e) { e.preventDefault(); showBanner(); });
      privacyLink.parentNode.insertBefore(a, privacyLink.nextSibling);
    }

    /* The map has no footer, so it goes in the burger menu instead. */
    var menu = document.getElementById('menu');
    if (menu && !menu.querySelector('.gm-menu-consent')) {
      var m = document.createElement('a');
      m.href = '#';
      m.className = 'gm-menu-consent';
      m.textContent = 'Cookie settings';
      m.addEventListener('click', function (e) { e.preventDefault(); showBanner(); });
      var cta = menu.querySelector('a.cta');
      if (cta) menu.insertBefore(m, cta); else menu.appendChild(m);
    }
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function boot() {
    addSettingsLinks();

    var choice = readChoice();
    if (choice === 'granted') {
      grant();
    } else if (choice !== 'denied') {
      /* The map opens with a full-screen introduction. Dropping a cookie
         banner on top of it would be two overlays at once, so wait until
         the introduction has been dismissed. Every other page shows it
         straight away. */
      if (document.body.classList.contains('intro')) {
        var tries = 0;
        var poll = setInterval(function () {
          if (!document.body.classList.contains('intro') || ++tries > 60) {
            clearInterval(poll);
            showBanner();
          }
        }, 500);
      } else {
        showBanner();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
