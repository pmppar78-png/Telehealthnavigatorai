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

  function hasConsented() {
    return getCookie(COOKIE_NAME) === 'accepted';
  }

  function createConsentBanner() {
    if (hasConsented()) return;

    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<div class="cookie-consent-content">' +
        '<p>' +
          'We use cookies and similar technologies to improve your experience, analyze site traffic, and for advertising purposes. ' +
          'By clicking "Accept," you consent to the use of cookies. ' +
          '<a href="privacy.html">Learn more in our Privacy Policy</a>.' +
        '</p>' +
        '<div class="cookie-consent-buttons">' +
          '<button id="cookie-accept-btn" class="cookie-btn cookie-btn-accept">Accept</button>' +
          '<button id="cookie-decline-btn" class="cookie-btn cookie-btn-decline">Decline Non-Essential</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);

    document.getElementById('cookie-accept-btn').addEventListener('click', function() {
      setCookie(COOKIE_NAME, 'accepted', COOKIE_EXPIRY_DAYS);
      banner.remove();
    });

    document.getElementById('cookie-decline-btn').addEventListener('click', function() {
      setCookie(COOKIE_NAME, 'declined', COOKIE_EXPIRY_DAYS);
      banner.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createConsentBanner);
  } else {
    createConsentBanner();
  }
})();
