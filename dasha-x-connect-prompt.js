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

  function walletCandidates() {
    var out = [];
    function add(p) { if (p && out.indexOf(p) < 0) out.push(p); }
    if (global.phantom && global.phantom.solana) add(global.phantom.solana);
    add(global.solflare);
    add(global.backpack);
    add(global.solana);
    return out;
  }

  function walletProvider() {
    var list = walletCandidates();
    var i;
    // Prefer wallet-standard one-click `signIn` (Phantom 23.11+, Solflare, Backpack).
    for (i = 0; i < list.length; i++) if (typeof list[i].signIn === 'function') return list[i];
    for (i = 0; i < list.length; i++) if (list[i].connect && list[i].signMessage) return list[i];
    return list[0] || null;
  }

  function walletSigBase58(sig) {
    if (typeof sig === 'string') return sig;
    return base58(sig);
  }

  function isMobileWalletUa() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function rememberWallet() {
    try { localStorage.setItem('dasha_last_provider', 'wallet'); } catch (e) {}
  }

  function walletErrorKind(error) {
    var msg = String((error && error.message) || error || '');
    if (/user rejected|rejected the request|denied|cancelled|canceled|declined/i.test(msg)) return 'cancelled';
    if (/wallet login unavailable/i.test(msg)) return 'unavailable';
    if (/rate limited|too many/i.test(msg)) return 'limited';
    if (/already used|expired/i.test(msg)) return 'expired';
    if (/network|failed to fetch|load failed/i.test(msg)) return 'network';
    return 'other';
  }

  // One-click Sign in with Solana: a single wallet approval covers connect +
  // sign. The server issued an origin-bound, single-use nonce (challenge);
  // the wallet echoes it inside the standardized SIWS message it builds.
  function walletSigninOneClick(provider) {
    return fetchJson('/auth/wallet/challenge', { method: 'POST', body: JSON.stringify({ mode: 'signin' }) })
      .then(function (c) {
        if (!c || !c.nonce || !c.challenge) throw new Error('Wallet login unavailable');
        return Promise.resolve().then(function () {
          return provider.signIn({
            domain: c.domain,
            uri: c.uri,
            statement: c.statement,
            nonce: c.nonce,
            chainId: c.chainId || 'solana:mainnet',
            version: c.version || '1',
          });
        }).then(function (out) { return { out: out, challenge: c.challenge }; });
      })
      .then(function (r) {
        var out = r.out || {};
        var account = out.account || {};
        var address = account.address || (account.publicKey ? String(account.publicKey) : '');
        var msgBytes = out.signedMessage;
        var sigBytes = out.signature;
        if (!address || !msgBytes || !sigBytes) throw new Error('Wallet returned no signature');
        var message = typeof msgBytes === 'string' ? msgBytes : new TextDecoder().decode(msgBytes);
        return fetchJson('/auth/wallet/verify', {
          method: 'POST',
          body: JSON.stringify({ mode: 'signin', challenge: r.challenge, message: message, signature: walletSigBase58(sigBytes) }),
        });
      });
  }

  // Legacy two-step fallback for wallets without wallet-standard `signIn`.
  function walletLegacyConnectSign(provider) {
    var publicKey;
    return provider.connect().then(function (connected) {
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
          body: JSON.stringify({ publicKey: publicKey, challenge: challenge.challenge, signature: walletSigBase58(bytes) }),
        });
      });
    });
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
    if (!['/compute', '/compute#use', '/compute#ask', '/compute#provide', '/compute#night', '/compute#build', '/compute#source', '/compute#sponsor', '/compute#earn', '/compute#credits', '/compute#pay'].includes(returnTo)) returnTo = '';
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

    function sayWalletLink(text, href, linkText) {
      message.textContent = '';
      message.dataset.kind = '';
      message.appendChild(document.createTextNode(text + ' '));
      var a = document.createElement('a');
      a.href = href;
      a.textContent = linkText;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.color = 'inherit';
      message.appendChild(a);
    }

    function walletFail(error) {
      switch (walletErrorKind(error)) {
        case 'cancelled': say('Sign-in cancelled.', ''); break;
        case 'unavailable': say('Sign-in with Solana isn\u2019t available right now.', 'bad'); break;
        case 'limited': say('Too many tries. Wait a bit, then try again.', 'bad'); break;
        case 'expired': say('That sign-in expired. Try again.', 'bad'); break;
        case 'network': say('Network error \u2014 try again.', 'bad'); break;
        default: say('Couldn\u2019t sign in. Try again.', 'bad');
      }
    }

    wallet.addEventListener('click', function () {
      var provider = walletProvider();
      if (!provider) {
        if (isMobileWalletUa()) {
          say('Opening your wallet\u2026', '');
          location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
        } else {
          sayWalletLink('No Solana wallet found on this browser.', 'https://phantom.com', 'Get Phantom');
        }
        return;
      }
      wallet.disabled = true;
      say('Check your wallet\u2026', '');
      var flow = typeof provider.signIn === 'function'
        ? walletSigninOneClick(provider)
        : walletLegacyConnectSign(provider);
      flow.then(function () { return status(); }).then(function (data) {
        rememberWallet();
        paint(data);
      }).catch(walletFail).finally(function () { wallet.disabled = false; });
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
