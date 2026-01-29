(function() {
  'use strict';

  var COOKIE_NAME = 'tn_cookie_consent';
  var COOKIE_EXPIRY_DAYS = 365;

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
    document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
  }

  function getConsentStatus() {
    return getCookie(COOKIE_NAME);
  }

  function hasAcceptedCookies() {
    return getConsentStatus() === 'accepted';
  }

  function hasDeclinedCookies() {
    return getConsentStatus() === 'declined';
  }

  function hasMadeChoice() {
    var status = getConsentStatus();
    return status === 'accepted' || status === 'declined';
  }

  // Block tracking scripts until consent is given
  // This function can be called by ad scripts to check consent status
  window.cookieConsentGiven = function() {
    return hasAcceptedCookies();
  };

  // Function to load analytics/advertising scripts only after consent
  function loadTrackingScripts() {
    // This function would be called to load Google AdSense, analytics, etc.
    // after user accepts cookies. Ad network scripts should check
    // window.cookieConsentGiven() before setting cookies.

    // Dispatch custom event that ad scripts can listen for
    var event = new CustomEvent('cookieConsentAccepted');
    document.dispatchEvent(event);
  }

  function createConsentBanner() {
    // Don't show banner if user has already made a choice
    if (hasMadeChoice()) {
      // If they accepted, load tracking scripts
      if (hasAcceptedCookies()) {
        loadTrackingScripts();
      }
      return;
    }

    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.setAttribute('aria-describedby', 'cookie-consent-description');
    banner.innerHTML =
      '<div class="cookie-consent-content">' +
        '<p id="cookie-consent-description">' +
          'We use essential cookies for basic site functionality. We also use optional cookies for analytics and advertising (including Google AdSense). ' +
          'Non-essential cookies are blocked until you accept. ' +
          'By clicking "Accept All," you consent to our use of all cookies. ' +
          '<a href="privacy.html">Learn more in our Privacy Policy</a>.' +
        '</p>' +
        '<div class="cookie-consent-buttons">' +
          '<button id="cookie-accept-btn" class="cookie-btn cookie-btn-accept">Accept All Cookies</button>' +
          '<button id="cookie-decline-btn" class="cookie-btn cookie-btn-decline">Essential Only</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);

    document.getElementById('cookie-accept-btn').addEventListener('click', function() {
      setCookie(COOKIE_NAME, 'accepted', COOKIE_EXPIRY_DAYS);
      banner.remove();
      loadTrackingScripts();
    });

    document.getElementById('cookie-decline-btn').addEventListener('click', function() {
      setCookie(COOKIE_NAME, 'declined', COOKIE_EXPIRY_DAYS);
      banner.remove();
      // Do not load tracking scripts - user declined
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createConsentBanner);
  } else {
    createConsentBanner();
  }
})();
