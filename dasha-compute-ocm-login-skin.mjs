/**
 * Lobby-only skin for Graham's logged-out OCM gate under /compute/ocm.
 * Does not rewrite ocm.getdasha.com. Leaves form method/action/name/id alone.
 * Permanent skin belongs in desk ocm/gateway/console.mjs when Graham ships.
 */

export const OCM_LOGIN_SKIN_ID = 'dasha-ocm-login-skin';

const SIGNIN_ACTION = /action=(["'])(?:\/compute\/ocm)?\/signin\1/i;
const SIGNUP_ACTION = /action=(["'])(?:\/compute\/ocm)?\/signup\1/i;
const KEY_FIELD = /name=(["'])key\1/i;
const EMAIL_FIELD = /name=(["'])email\1/i;

export function isOcmLoggedOutGate(html) {
  const s = String(html || '');
  return SIGNIN_ACTION.test(s) && SIGNUP_ACTION.test(s) && KEY_FIELD.test(s) && EMAIL_FIELD.test(s);
}

export const OCM_LOGIN_SKIN_CSS = `html.dasha-ocm-gate{--bg:#08070a;--fg:#f5eedb;--dim:#d4cce0;--line:#3d3743;--card:#121015;--ok:#dcff00;--idle:#aaa1b2;--warn:#ff3b81;--accent:#dcff00;--ink:#08070a;--paper:#f5eedb;--paper-muted:#d4cce0;--acid:#dcff00;--hot:#ff3b81;--panel:#121015}
@media(prefers-color-scheme:dark){html.dasha-ocm-gate{--bg:#08070a;--fg:#f5eedb;--dim:#d4cce0;--line:#3d3743;--card:#121015;--ok:#dcff00;--idle:#aaa1b2;--warn:#ff3b81;--accent:#dcff00}}
html.dasha-ocm-gate,html.dasha-ocm-gate body{background:#08070a;color:#f5eedb}
html.dasha-ocm-gate body{margin:0;font:16px/1.5 Arial,Helvetica,sans-serif;background:radial-gradient(circle at 82% 0,#2a1730 0,transparent 26rem),#08070a}
html.dasha-ocm-gate .wrap{max-width:560px;padding:28px 22px 72px}
html.dasha-ocm-gate .dasha-ocm-brand{display:inline-block;margin:0 0 36px;color:#f5eedb;text-decoration:none;font:900 12px/1 Arial,Helvetica,sans-serif;letter-spacing:.04em;text-transform:uppercase}
html.dasha-ocm-gate .dasha-ocm-brand span{color:#dcff00}
html.dasha-ocm-gate .dasha-ocm-brand:hover{color:#f5eedb}
html.dasha-ocm-gate h1{margin:0 0 10px;color:#f5eedb;font:800 clamp(36px,8vw,56px)/1.05 Arial,Helvetica,sans-serif;letter-spacing:-.03em}
html.dasha-ocm-gate .sub{margin:0 0 36px;color:#d4cce0;font:500 20px/1.35 Arial,Helvetica,sans-serif}
html.dasha-ocm-gate .row{display:grid;grid-template-columns:1fr;gap:22px;align-items:stretch}
html.dasha-ocm-gate .card{background:#121015;border:1px solid #3d3743;border-radius:12px;padding:22px 20px 24px}
html.dasha-ocm-gate .dasha-ocm-primary{border-color:#f5eedb}
html.dasha-ocm-gate .dasha-ocm-secondary{border-color:#3d3743}
html.dasha-ocm-gate h3{margin:0 0 6px;color:#f5eedb;font:800 22px/1.2 Arial,Helvetica,sans-serif;letter-spacing:-.02em}
html.dasha-ocm-gate .muted{margin:0 0 18px;color:#d4cce0;font:400 15px/1.45 Arial,Helvetica,sans-serif}
html.dasha-ocm-gate label{margin:16px 0 6px;color:#d4cce0;font:800 12px/1 Arial,Helvetica,sans-serif;letter-spacing:.06em}
html.dasha-ocm-gate input[type=text],html.dasha-ocm-gate input[type=email],html.dasha-ocm-gate input[type=password]{width:100%;min-height:52px;padding:14px 4px;font:18px/1.3 Arial,Helvetica,sans-serif;color:#f5eedb;background:transparent;border:0;border-bottom:1.5px solid #3d3743;border-radius:0;caret-color:#dcff00}
html.dasha-ocm-gate input[type=text]:focus,html.dasha-ocm-gate input[type=email]:focus,html.dasha-ocm-gate input[type=password]:focus{outline:none;border-bottom-color:#f5eedb}
html.dasha-ocm-gate input::placeholder{color:#aaa1b2;opacity:1}
html.dasha-ocm-gate button{width:100%;min-height:60px;margin-top:22px;padding:0 20px;border:1px solid #3d3743;border-radius:12px;background:transparent;color:#f5eedb;font:900 20px/1 Arial,Helvetica,sans-serif;letter-spacing:.02em;text-transform:uppercase;cursor:pointer}
html.dasha-ocm-gate .dasha-ocm-primary button[type=submit]{background:#dcff00;border-color:#dcff00;color:#08070a}
html.dasha-ocm-gate .dasha-ocm-primary button[type=submit]:hover,html.dasha-ocm-gate .dasha-ocm-primary button[type=submit]:focus-visible{background:#dcff00;border-color:#dcff00;color:#08070a}
html.dasha-ocm-gate .dasha-ocm-secondary button[type=submit]{min-height:54px;font-size:17px;font-weight:800;background:transparent;border-color:#3d3743;color:#f5eedb;text-transform:uppercase}
html.dasha-ocm-gate .note{margin:22px 0 0;padding:14px 16px;border:1px solid #3d3743;border-left:3px solid #3d3743;border-radius:12px;background:#121015;color:#d4cce0;font:400 14px/1.45 Arial,Helvetica,sans-serif}
html.dasha-ocm-gate .note.warn{border-color:#ff3b81;border-left-color:#ff3b81;color:#f5eedb}
html.dasha-ocm-gate footer{margin-top:40px;padding-top:16px;border-top:1px solid #3d3743;color:#aaa1b2;font:400 12px/1.45 Arial,Helvetica,sans-serif}
html.dasha-ocm-gate a{color:#dcff00}
html.dasha-ocm-gate a:hover{color:#f5eedb}
html.dasha-ocm-gate ::focus-visible{outline:2px solid #dcff00;outline-offset:2px}
@media(max-width:560px){html.dasha-ocm-gate .wrap{padding:22px 16px 56px}html.dasha-ocm-gate h1{font-size:36px}html.dasha-ocm-gate .sub{font-size:17px;margin-bottom:28px}html.dasha-ocm-gate button{min-height:56px;font-size:17px}html.dasha-ocm-gate input[type=text],html.dasha-ocm-gate input[type=email],html.dasha-ocm-gate input[type=password]{font-size:16px;min-height:48px}}`;

function addClassAttr(tag, className) {
  if (/\bclass\s*=/i.test(tag)) {
    return tag.replace(/class\s*=\s*(["'])([^"']*)\1/i, (_, q, cur) => {
      const parts = String(cur).split(/\s+/).filter(Boolean);
      if (parts.includes(className)) return `class=${q}${cur}${q}`;
      return `class=${q}${cur} ${className}${q}`;
    });
  }
  return tag.replace(/>$/, ` class="${className}">`);
}

function addHtmlClass(html, className) {
  return html.replace(/<html(\s[^>]*)?>/i, (full) => addClassAttr(full, className));
}

function addBodyClass(html, className) {
  return html.replace(/<body(\s[^>]*)?>/i, (full) => addClassAttr(full, className));
}

function markCards(html) {
  let out = html.replace(/<div class="card"><h3>Sign in<\/h3>/, '<div class="card dasha-ocm-primary"><h3>Sign in</h3>');
  out = out.replace(/<div class="card"><h3>Create an account<\/h3>/, '<div class="card dasha-ocm-secondary"><h3>Create an account</h3>');
  return out;
}

function insertBrand(html) {
  if (html.includes('dasha-ocm-brand')) return html;
  const brand = '<a class="dasha-ocm-brand" href="/compute">Dasha <span>Compute</span></a>';
  if (/<div class="wrap">/.test(html)) {
    return html.replace(/<div class="wrap">/, `<div class="wrap">${brand}`);
  }
  return html.replace(/<h1>/, `${brand}<h1>`);
}

function clarifyCopy(html) {
  let out = html.replace(/<h1>Open-Compute Marketplace<\/h1>/, '<h1>Marketplace.</h1>');
  out = out.replace(/<p class="sub">Alpha\.<\/p>/, '<p class="sub">Paste a developer key.</p>');
  return out;
}

function injectCss(html) {
  if (html.includes(`id="${OCM_LOGIN_SKIN_ID}"`)) return html;
  const tag = `<style id="${OCM_LOGIN_SKIN_ID}">${OCM_LOGIN_SKIN_CSS}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  if (/<head(\s[^>]*)?>/i.test(html)) return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${tag}`);
  if (/<html(\s[^>]*)?>/i.test(html)) return html.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${tag}</head>`);
  return `${tag}${html}`;
}

function ensureThemeColor(html) {
  if (/name=["']theme-color["']/i.test(html)) {
    return html.replace(/<meta name=["']theme-color["'][^>]*>/i, '<meta name="theme-color" content="#08070a">');
  }
  if (/<meta name="viewport"[^>]*>/i.test(html)) {
    return html.replace(/(<meta name="viewport"[^>]*>)/i, '$1<meta name="theme-color" content="#08070a">');
  }
  return html;
}

/**
 * Skin logged-out sign-in/signup only. Authenticated / provider / status HTML passes through.
 */
export function polishOcmLoginHtml(html) {
  const raw = String(html || '');
  if (!isOcmLoggedOutGate(raw)) return raw;
  if (raw.includes(`id="${OCM_LOGIN_SKIN_ID}"`)) return raw;
  let out = addHtmlClass(raw, 'dasha-ocm-gate');
  out = addBodyClass(out, 'dasha-ocm-gate');
  out = markCards(out);
  out = insertBrand(out);
  out = clarifyCopy(out);
  out = ensureThemeColor(out);
  out = injectCss(out);
  return out;
}
