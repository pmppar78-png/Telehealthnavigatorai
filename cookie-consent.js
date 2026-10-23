/*
 * Cookie consent for Telehealth Navigator AI.
 * Works with the Google Consent Mode v2 defaults set inline in each page <head>
 * (denied by default for EEA/UK/CH, granted elsewhere unless the visitor declines).
 * This script shows the banner, stores the choice, sends gtag('consent','update')
 * and adds a "Cookie settings" link to the footer so the choice can be changed.
 */
(function() {
  'use strict';

  var COOKIE_NAME = 'tn_cookie_consent';
  var COOKIE_EXPIRY_DAYS = 365;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== 'function') { window.gtag = gtag; }

  function getCookie(name) {
    var value = '; ' + document.cookie;
    var parts = value.split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax' + secure;
  }

  function getConsentStatus() { return getCookie(COOKIE_NAME); }
  function hasAcceptedCookies() { return getConsentStatus() === 'accepted'; }
  function hasMadeChoice() {
    var s = getConsentStatus();
    return s === 'accepted' || s === 'declined';
  }

  function applyConsent(status) {
    var g = status === 'accepted' ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      ad_storage: g,
      ad_user_data: g,
      ad_personalization: g,
      analytics_storage: g
    });
    var ads = (window.adsbygoogle = window.adsbygoogle || []);
    ads.requestNonPersonalizedAds = status === 'accepted' ? 0 : 1;
    if (status === 'accepted') {
      try { document.dispatchEvent(new CustomEvent('cookieConsentAccepted')); } catch (e) {}
    }
  }

  window.cookieConsentGiven = function() { return hasAcceptedCookies(); };

  function closeBanner() {
    var b = document.getElementById('cookie-consent-banner');
    if (b) b.parentNode.removeChild(b);
  }

  function choose(status) {
    setCookie(COOKIE_NAME, status, COOKIE_EXPIRY_DAYS);
    applyConsent(status);
    closeBanner();
  }

  function showBanner() {
    if (document.getElementById('cookie-consent-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<div class="cookie-consent-content">' +
        '<p id="cookie-consent-description">' +
          'We use essential cookies to run this site. With your permission, Google Analytics and Google AdSense also use cookies to measure visits and show ads. ' +
          'Choose "Accept all" to allow them or "Reject non-essential" to turn them off. You can change your choice any time with the Cookie settings link at the bottom of each page. ' +
          '<a href="/privacy">Privacy Policy</a>' +
        '</p>' +
        '<div class="cookie-consent-buttons">' +
          '<button type="button" id="cookie-accept-btn" class="cookie-btn cookie-btn-accept">Accept all</button>' +
          '<button type="button" id="cookie-decline-btn" class="cookie-btn cookie-btn-decline">Reject non-essential</button>' +
        '</div>' +
      '</div>';
    banner.querySelector('#cookie-consent-description').setAttribute('aria-live', 'polite');
    document.body.appendChild(banner);
    document.getElementById('cookie-accept-btn').addEventListener('click', function() { choose('accepted'); });
    document.getElementById('cookie-decline-btn').addEventListener('click', function() { choose('declined'); });
  }

  window.openCookieSettings = function() {
    showBanner();
    var btn = document.getElementById('cookie-accept-btn');
    if (btn) btn.focus();
  };

  function addFooterLink() {
    if (document.getElementById('cookie-settings-link')) return;
    var footer = document.querySelector('footer');
    if (!footer) return;
    var p = document.createElement('p');
    p.className = 'footer-text small';
    var a = document.createElement('a');
    a.href = '#cookie-settings';
    a.id = 'cookie-settings-link';
    a.setAttribute('role', 'button');
    a.textContent = 'Cookie settings';
    a.addEventListener('click', function(e) { e.preventDefault(); window.openCookieSettings(); });
    p.appendChild(a);
    (footer.querySelector('.container') || footer).appendChild(p);
  }

  function init() {
    addFooterLink();
    if (hasMadeChoice()) {
      applyConsent(getConsentStatus());
    } else {
      showBanner();
    }
    if (location.hash === '#cookie-settings') window.openCookieSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
