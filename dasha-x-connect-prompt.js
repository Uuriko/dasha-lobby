/** Site-wide login status + /login controller. No account is required to browse. */
(function (global) {
  'use strict';
  var API = 'https://lobby.getdasha.com';

  function fetchJson(path, options) {
    var opts = options || {};
    opts.credentials = 'include';
    opts.mode = 'cors';
    opts.cache = 'no-store';
    if (opts.body) opts.headers = { 'Content-Type': 'application/json' };
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  function base58(bytes) {
    var alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var value = 0n;
    for (var i = 0; i < bytes.length; i++) value = value * 256n + BigInt(bytes[i]);
    var out = '';
    while (value) { out = alphabet[Number(value % 58n)] + out; value /= 58n; }
    for (var j = 0; j < bytes.length && bytes[j] === 0; j++) out = '1' + out;
    return out || '1';
  }

  function walletProvider() {
    return global.phantom && global.phantom.solana || global.solflare || global.solana || null;
  }

  function loginLabel(data) {
    if (!data || !data.loggedIn) return 'Log in';
    if (data.provider === 'x') return '@' + data.x.handle;
    if (data.provider === 'grok') return (data.grok && data.grok.display) || 'Grok Bot';
    return data.wallet && data.wallet.display || 'Log in';
  }

  function paintLinks(data) {
    var label = loginLabel(data);
    document.querySelectorAll('[data-dasha-login-link]').forEach(function (link) {
      link.textContent = label;
      link.setAttribute('aria-label', data && data.loggedIn ? 'Open login settings for ' + label : 'Log in to Dasha');
    });
  }

  function status() {
    return fetchJson('/auth/status').then(function (data) { paintLinks(data); return data; });
  }

  function bootLoginPage(root) {
    var methods = root.querySelector('[data-login-methods]');
    var grok = root.querySelector('[data-grok-login]');
    var x = root.querySelector('[data-x-login]');
    var wallet = root.querySelector('[data-wallet-login]');
    var logout = root.querySelector('[data-logout]');
    var message = root.querySelector('[data-login-status]');
    var next = root.querySelector('[data-login-next]');
    var nextLink = next.querySelector('a');
    var pair = root.querySelector('[data-grok-pair]');
    var pairCode = root.querySelector('[data-grok-code]');
    var pairSay = root.querySelector('[data-grok-say]');
    var returnTo = new URLSearchParams(location.search).get('return');
    if (!['/compute', '/compute#use', '/compute#provide', '/compute#night', '/compute#build', '/compute#source', '/compute#sponsor'].includes(returnTo)) returnTo = '';
    if (returnTo) nextLink.href = returnTo;
    var grokTimer = 0;

    function say(text, kind) { message.textContent = text || ''; message.dataset.kind = kind || ''; }
    function showPair(code) {
      if (pair) pair.hidden = false;
      if (pairCode) pairCode.textContent = code || '';
      if (pairSay) pairSay.textContent = code ? 'Open Grok Bot and say: sign me into getdasha.com with ' + code : '';
    }
    function hidePair() {
      if (pair) pair.hidden = true;
      if (pairCode) pairCode.textContent = '';
      if (pairSay) pairSay.textContent = '';
    }
    function stopGrok() {
      if (grokTimer) { clearInterval(grokTimer); grokTimer = 0; }
      if (grok) grok.removeAttribute('aria-disabled');
    }
    function paint(data) {
      var loggedIn = Boolean(data && data.loggedIn);
      methods.hidden = loggedIn;
      logout.hidden = !loggedIn;
      next.hidden = !loggedIn;
      if (loggedIn) hidePair();
      if (loggedIn) nextLink.textContent = returnTo ? 'Back to Dasha Compute →' : data.provider === 'x' ? 'Verify holder perks →' : data.provider === 'grok' ? 'Open Dasha →' : 'Holder perks need X + Board →';
      say(loggedIn
        ? data.provider === 'x' ? 'Logged in as @' + data.x.handle + '.' : data.provider === 'grok' ? 'Logged in with Grok Bot.' : 'Logged in as ' + data.wallet.display + '. Address control only.'
        : '', loggedIn ? 'ok' : '');
      paintLinks(data);
    }

    function startGrok() {
      if (!grok || grok.getAttribute('aria-disabled') === 'true') return;
      grok.setAttribute('aria-disabled', 'true');
      say('Starting Grok Bot login…', '');
      fetchJson('/auth/grok/start', { method: 'POST', body: '{}' }).then(function (data) {
        var code = data && data.code;
        if (!code) throw new Error('No pairing code');
        showPair(code);
        say('Open Grok Bot and say: sign me into getdasha.com with ' + code, '');
        var poll = data.poll || '/auth/grok/status';
        grokTimer = setInterval(function () {
          fetchJson(poll + (poll.indexOf('?') >= 0 ? '&' : '?') + 'code=' + encodeURIComponent(code)).then(function (row) {
            if (row.state === 'ok') {
              stopGrok();
              return status().then(paint);
            }
            if (row.state === 'expired') {
              stopGrok();
              hidePair();
              say('Code expired. Tap Sign in with Grok Bot again.', 'bad');
            }
          }).catch(function (error) {
            say(String(error.message || error).slice(0, 120), 'bad');
          });
        }, 1500);
      }).catch(function (error) {
        stopGrok();
        say(String(error.message || error).slice(0, 120), 'bad');
      });
    }

    if (grok) grok.addEventListener('click', function (event) {
      event.preventDefault();
      startGrok();
    });

    x.addEventListener('click', function (event) {
      event.preventDefault();
      var popup = global.open(x.href, 'dasha_x', 'width=520,height=700');
      if (!popup) { say('Allow popups to continue with X.', 'bad'); return; }
      say('Finish in the X window…', '');
    });

    wallet.addEventListener('click', function () {
      var provider = walletProvider();
      if (!provider || !provider.connect || !provider.signMessage) {
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
        } else say('Open this page in a Solana wallet.', 'bad');
        return;
      }
      wallet.disabled = true;
      say('Connect, then sign the login message…', '');
      var publicKey;
      provider.connect().then(function (connected) {
        var key = provider.publicKey || connected && connected.publicKey;
        if (!key) throw new Error('Wallet returned no public key');
        publicKey = key.toString();
        return fetchJson('/auth/wallet/challenge', { method: 'POST', body: JSON.stringify({ publicKey: publicKey }) });
      }).then(function (challenge) {
        return provider.signMessage(new TextEncoder().encode(challenge.message), 'utf8').then(function (signed) {
          var bytes = signed && signed.signature || signed;
          if (!bytes || typeof bytes.length !== 'number') throw new Error('Wallet returned no signature');
          return fetchJson('/auth/wallet/verify', {
            method: 'POST',
            body: JSON.stringify({ publicKey: publicKey, challenge: challenge.challenge, signature: base58(bytes) }),
          });
        });
      }).then(function () { return status(); }).then(paint).catch(function (error) {
        say(String(error.message || error).slice(0, 120), 'bad');
      }).finally(function () { wallet.disabled = false; });
    });

    logout.addEventListener('click', function () {
      logout.disabled = true;
      fetchJson('/auth/logout', { method: 'POST' }).then(function () { return status(); }).then(paint).catch(function (error) {
        say(String(error.message || error).slice(0, 120), 'bad');
      }).finally(function () { logout.disabled = false; });
    });

    global.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'dasha-x-linked' || event.origin !== API) return;
      status().then(paint);
    });
    status().then(function (data) {
      paint(data);
      if (location.hash === '#grok' && !(data && data.loggedIn)) startGrok();
    }).catch(function () { say('Login status unavailable.', 'bad'); });
  }

  function boot() {
    var root = document.querySelector('[data-dasha-login]');
    if (root) bootLoginPage(root);
    else status().catch(function () {});
  }

  global.DashaXConnectPrompt = { boot: boot, open: function () { location.href = 'https://www.getdasha.com/login'; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : this);
