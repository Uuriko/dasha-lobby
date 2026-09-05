/**
 * Dasha public lobby — Cloudflare Worker + single Durable Object room.
 * Optional X account link (OAuth 2 PKCE). Linking is never required.
 */
import {
  MINT,
  PAIR,
  PIN,
  MAX_HISTORY,
  MAX_SOCKETS,
  MAX_PER_IP,
  parseClientFrame,
  checkRate,
  checkRepeat,
  pruneHistory,
  publicMessage,
  originAllowed,
  nickTaken,
  nickKey,
  checkIpJoin,
  roomSlowLimits,
  SLOW_MODE_AT,
  IDLE_MS,
  JOIN_COOLDOWN_MS,
  noteSpamHit,
  AUTO_SHIELD_MS,
} from './dasha-lobby-mod.mjs';
import {
  xConfigured,
  redirectUri,
  randomUrlToken,
  pkceChallengeS256,
  authorizeUrl,
  exchangeCode,
  fetchXUser,
  createSessionToken,
  createWalletSessionToken,
  createGrokSessionToken,
  authSessionFromRequest,
  sessionFromRequest,
  cookieHeader,
  grokStartCookieHeader,
  GROK_START_COOKIE,
  clearLegacyCookieHeader,
  readCookie,
  publicLink,
  linkedLimits,
  mayJoinRoom,
  ANON_SOFT_CAP,
  signPayload,
  verifyPayload,
} from './dasha-lobby-x.mjs';
import {
  GH_OAUTH_COOKIE,
  githubAuthorizeUrl,
  githubConfigured,
  githubCookieHeader,
  githubOauthStateCookie,
  githubRedirectUri,
  exchangeGithubCode,
  fetchGithubUser,
  createGithubSessionToken,
  githubSessionFromRequest,
  publicGithubLink,
} from './dasha-lobby-github.mjs';
import {
  buildPublicBoard,
  publicPerryRow,
  joinBoard,
  leaveBoard,
  creditDonate,
  meStatus,
  PUBLIC_BOARD_LIMIT,
  quizPublic,
  startQuizAttempt,
  questionForAttempt,
  answerQuizAttempt,
  quizResultForAttempt,
  storedQuizTitle,
  submitQuiz,
  setSimpSpotlight,
} from './dasha-simp-score.mjs';
import {
  activateReferral,
  applyReferralScores,
  applyHolderProof,
  claimReferral,
  hasPositiveTokenBalance,
  isValidSolanaAddress,
  claimsForSession,
  pendingClaims,
  noteReferralQuiz,
  pruneExpiredReferrals,
  publicSeasons,
  reviewClaim,
  qualifyReferral,
  referralCapReached,
  removeReferralIdentity,
  scrubSeasonSnapshots,
  snapshotSeason,
  submitClaim,
  verifyEd25519,
  walletLoginMessage,
  walletMessage,
} from './dasha-simp-actions.mjs';
import {
  LOBBY_CLIENT_JS,
  SIMP_BOARD_JS,
  FAUCET_CLIENT_JS,
  FAUCET_CLIENT_SRI,
  FAUCET_PAGE_HTML,
  X_CONNECT_JS,
  X_CONNECT_SRI,
  ROBOTS_TXT as GENERATED_ROBOTS_TXT,
  SITEMAP_XML as GENERATED_SITEMAP_XML,
  HOWTO_HTML,
  CHESS_PAGE_HTML,
  CHESS_LOCAL_JS,
  LOBBY_PAGE_HTML,
  LOGIN_PAGE_HTML,
  ASSET_HASH,
} from './dasha-lobby-static-gen.mjs';
import { ComputeNetwork, computeApi } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { PROVIDE_SKILL_MD, USE_SKILL_MD, OCM_HOST_SKILL_MD } from './dasha-compute-skills.mjs';
import { isComputeOcmPath, proxyComputeOcm } from './dasha-compute-ocm-proxy.mjs';
import { CREW_PAGE_HTML } from './dasha-crew-page.mjs';
import { applyCrewShareOg, crewApi, isCrewPagePath } from './dasha-crew.mjs';
import { bagRecordApi, isBagRecordPath, lookupRecord, normalizeMint, renderBagShareHtml } from './dasha-bag-record.mjs';
import { appendFill, collectInboundFills, FAUCET_TAPE_SCAN_CAP, fillShareApi, isBareFaucetFillPath, isFaucetFillPath, isFaucetTapePath, shouldScanTape, tapeApi } from './dasha-faucet-tape.mjs';

import {
  DEFAULT as DEFAULT_DIGEST,
  applyLiveTick,
  digestPageHtml,
  digestSectionHtml,
  fetchLiveTick,
  homeTapeItems,
  injectDigestRemount,
  injectDigestSection,
  normalizeItems,
  stripDigestLeftoverDupSectionCss,
} from './dasha-digest.mjs';
export { stripDigestLeftoverDupSectionCss };

/* assets-build overwrites static-gen robots/sitemap; live-verify and disk SoR are this set. */
const ROBOTS_TXT = `# getdasha.com — public crawl rules (also served at lobby.getdasha.com/robots.txt)
# Machine-readable identity: /ai.txt, /llms.txt (index), and /llms-full.txt (full markdown).

User-agent: *
Allow: /
Allow: /chess
Allow: /faucet
Allow: /which
Allow: /forum
Allow: /bag
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /ai.txt

Sitemap: https://www.getdasha.com/sitemap.xml
Sitemap: https://lobby.getdasha.com/sitemap.xml
`;

/** Leftover /robots.txt lecture crawlers still see (Webflow SEO paste, 2026-08-08 outage, 2020 e-commerce template, Disallow history, CC0 essay). Identity one-liner + rules stay. */
export function stripRobotsLecture(txt) {
  const src = String(txt || '');
  const titleMatch = src.match(/^# getdasha\.com — public crawl rules[^\n]*/m);
  const identityMatch = src.match(/^# Machine-readable identity:[^\n]*/m);
  const userAgentAt = src.search(/^User-agent:\s*\*/m);
  const rules = userAgentAt >= 0
    ? src.slice(userAgentAt).replace(/[ \t]+$/gm, '').replace(/\n+$/, '\n')
    : src;
  const title = titleMatch
    ? titleMatch[0]
    : '# getdasha.com — public crawl rules (also served at lobby.getdasha.com/robots.txt)';
  const identity = identityMatch ? identityMatch[0] : '';
  const head = identity ? `${title}\n${identity}\n\n` : `${title}\n\n`;
  return `${head}${rules}`;
}
const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.getdasha.com/</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/simp</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/lobby</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/forum</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/faucet</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/bag</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/which</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/crew</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/digest</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/compute</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/how-to-buy</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/chess</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/privacy</loc><lastmod>2026-09-04</lastmod></url>
  <url><loc>https://www.getdasha.com/llms.txt</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/llms-full.txt</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/ai.txt</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/contribute</loc><lastmod>2026-09-01</lastmod></url>
  <url><loc>https://www.getdasha.com/bounties</loc><lastmod>2026-09-01</lastmod></url>
</urlset>
`;
void GENERATED_ROBOTS_TXT;
void GENERATED_SITEMAP_XML;

import {
  FAUCET_MINT,
  FAUCET_TREASURY_DEFAULT,
  FAUCET_WITHDRAW_DEST,
  alreadyClaimedResponse,
  buildStatus,
  burnAggregate,
  burnReceiptsFull,
  checkRateLimits,
  checkXEligibility,
  claimAllowed,
  clearPendingClaim,
  consumeBurnIntent,
  createBurnIntent,
  destShapeError,
  donateAmountUi,
  donateFailClosed,
  donateSigError,
  inspectDonateTx,
  inspectBurnTx,
  faucetAdminOk,
  faucetConfig,
  isFaucetPublicReadPath,
  faucetSignerSecret,
  faucetSiwsInput,
  FAUCET_SIWS_DOMAIN,
  meFromSession,
  siwsMessageError,
  noteSuccessfulClaim,
  planTreasuryWithdraw,
  rateLimitStatusFields,
  recordClaim,
  reserveClaim,
  upsertBurnIntent,
} from './dasha-faucet.mjs';
import { associatedTokenAddress, publicKeyFromSecret, rpc, sendTipTransfer, sendTreasuryWithdraw, solanaRpcList } from './dasha-faucet-solana.mjs';
import { forumThreadOgPng, handoffOgPng, simpBoardOgPng, simpMemberOgPng, simpQuizOgPng } from './dasha-handoff-og.mjs';
const BURN_RECEIPTS_ENABLED = false;
import {
  challengeRedirectPath,
  quizRedirectPath,
  simpMemberBadgeSvg,
  simpMemberHtml,
  simpPageHtml,
  simpResultHtml,
} from './dasha-simp-share-html.mjs';
import {
  CHESS_CLOCK_MS,
  CHESS_INCREMENT_MS,
  CHESS_START_RATING,
  canMate,
  newChessState,
  playMove,
  publicChessGame,
  publicChessReplay,
  resignChess,
  settleChessRatings,
} from './dasha-chess.mjs';
import {
  MAX_POSTS,
  MAX_REACTORS,
  addReply,
  assertWritable,
  deletePost,
  editPost,
  lockThread,
  newThread,
  paginateIndex,
  pruneIndex,
  publicPost,
  publicThread,
  searchThreads,
  threadReactionCount,
  toggleReaction,
  validateReport,
  visibleReplies,
} from './dasha-forum.mjs';

const LLMS_TXT = `# $dasha is dash_eats on Solana

site https://www.getdasha.com/
which https://www.getdasha.com/which
bag https://www.getdasha.com/bag
login https://www.getdasha.com/login
contribute https://www.getdasha.com/contribute
bounties https://www.getdasha.com/bounties
crew https://www.getdasha.com/crew
compute https://www.getdasha.com/compute
associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump
pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7
CoinGecko dash_eats https://www.coingecko.com/en/coins/dash_eats
Jupiter https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump

The other Dasha is VVAIFU FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8 — not this.

## Links

- [getdasha.com](https://www.getdasha.com/)
- [Which $dasha](https://www.getdasha.com/which)
- [The bag](https://www.getdasha.com/bag)
- [Login](https://www.getdasha.com/login)
- [Contribute](https://www.getdasha.com/contribute)
- [Bounties](https://www.getdasha.com/bounties)
- [Crew](https://www.getdasha.com/crew)
- [Compute](https://www.getdasha.com/compute)
- [CoinGecko dash_eats](https://www.coingecko.com/en/coins/dash_eats)
- [Jupiter](https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump)

## Optional

- [Full text](https://www.getdasha.com/llms-full.txt)

Grok Bot compatible. Login https://www.getdasha.com/login
`;

const AI_TXT = `# $dasha

dash_eats on Solana. Site https://www.getdasha.com/.
associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump

index https://www.getdasha.com/llms.txt
full https://www.getdasha.com/llms-full.txt
`;

const LLMS_FULL_TXT = `# $dasha is dash_eats on Solana

> dash_eats on Solana. Site https://www.getdasha.com/. Associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7. CoinGecko dash_eats. Jupiter is jup.ag with that mint.

$dasha is dash_eats. The site is https://www.getdasha.com/. This file is the full markdown for agents. /llms.txt is the short index.

## Identity

This is dash_eats on Solana.

associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump
pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7
CoinGecko dash_eats https://www.coingecko.com/en/coins/dash_eats
Jupiter token https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump
Jupiter swap https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump
Solscan https://solscan.io/token/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump
GeckoTerminal pool https://www.geckoterminal.com/solana/pools/9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7
X https://x.com/dash_eats
Mint source https://x.com/dash_eats/status/2085405228078432279

The other Dasha is VVAIFU FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8 — not this.

## Which $dasha?

This is dash_eats on Solana. Its associated Solana mint is:

\`53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump\`

The other Dasha is VVAIFU:

\`FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8\`

That is a different token, not this one.

Pair: \`9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7\`

CoinGecko lists this one as dash_eats. Jupiter is jup.ag. Token path and swap path both carry the associated mint in full.

Page: https://www.getdasha.com/which

## The bag

dash_eats health on Solana. Associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7.

Mint-dead. Freeze-dead. Burned Raydium LP.

LP mint 8GDvsE3NbiKuo5uUFR9zgRY76mdhXuJfeDsy8hn7h3Aj.

Page: https://www.getdasha.com/bag

## Site

https://www.getdasha.com/

Home: $dasha on getdasha.com. dash_eats. Associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump.

Lobby: public chat and lasting threads in one room. Play (chess) lives in the lobby. https://www.getdasha.com/lobby


Faucet: public $dasha tip flow; current availability comes from its public status endpoint. https://www.getdasha.com/faucet

Play table (chess embed host, not a separate product): https://www.getdasha.com/chess

How to buy: SOL → mint → Buy. https://www.getdasha.com/how-to-buy

Bounties: USDC on Solana. We don’t hold it. https://www.getdasha.com/bounties

Contribute: Build Dasha. Open a pull request. https://www.getdasha.com/contribute

Crew: five jobs. You keep the keys. https://www.getdasha.com/crew

Compute: Start. (Ask / Provide / Pay / Credits). Pay → Top up USDC/$dasha / Sponsor. Credits → balance + Use. Ask → Hosted. Quiet Marketplace / Host. https://www.getdasha.com/compute

Login: Grok Bot first, then X, then wallet. https://www.getdasha.com/login

## Machine files

- https://www.getdasha.com/ai.txt
- https://www.getdasha.com/llms.txt
- https://www.getdasha.com/llms-full.txt
- https://www.getdasha.com/sitemap.xml
- https://www.getdasha.com/robots.txt
`;

const WHICH_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Which $dasha? dash_eats</title>
  <meta name="description" content="dash_eats on Solana. The associated $dasha mint is 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. VVAIFU is a different token.">
  <link rel="canonical" href="https://www.getdasha.com/which">
  <link rel="describedby" href="/llms.txt" type="text/plain">
  <link rel="describedby" href="/llms-full.txt" type="text/plain">
  <meta property="og:type" content="website"><meta property="og:url" content="https://www.getdasha.com/which"><meta property="og:title" content="Which $dasha? dash_eats"><meta property="og:description" content="dash_eats. Buy $dasha."><meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Which $dasha? dash_eats"><meta name="twitter:description" content="dash_eats. Buy $dasha."><meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Which $dasha? dash_eats, not VVAIFU","url":"https://www.getdasha.com/which","description":"dash_eats on Solana. Associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7. CoinGecko dash_eats. The other Dasha is VVAIFU FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8."}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Which dasha coin?","acceptedAnswer":{"@type":"Answer","text":"This one. dash_eats. 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. The other Dasha is VVAIFU FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8. Not this."}},{"@type":"Question","name":"What is dash_eats?","acceptedAnswer":{"@type":"Answer","text":"dash_eats is $dasha on Solana. Associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Site https://www.getdasha.com/."}}]}</script>
  <style>
    :root { color-scheme: dark; font: 18px/1.5 Arial, Helvetica, sans-serif; background: #070608; color: #f4eddb; }
    body { max-width: 44rem; margin: auto; padding: 2rem 1rem; }
    h1 { line-height: 1; }
    code { display: block; padding: 1rem; border: 1px solid #666; overflow-wrap: anywhere; }
    a { color: #dfff00; }
    a:focus-visible { outline: 3px solid #dfff00; outline-offset: 3px; }
  </style>
</head>
<body>
  <main>
    <h1>Which $dasha?</h1>
    <p>This is dash_eats on Solana. Its associated Solana mint is:</p>
    <code>53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump</code>
    <p>The other Dasha is VVAIFU:</p>
    <code>FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8</code>
    <p>That is a different token, not this one.</p>
    <p>Pair: <code>9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7</code></p>
    <p>CoinGecko: <a href="https://www.coingecko.com/en/coins/dash_eats">dash_eats</a></p>
    <p><a href="https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump" rel="noopener noreferrer">Open the associated mint on Jupiter</a></p>
    <p><a href="https://www.getdasha.com/">getdasha.com</a></p>
  </main>
</body>
</html>
`;

const BAG_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$dasha · hers</title>
  <meta name="description" content="dash_eats bag. Mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Mint-dead. Freeze-dead. Burned Raydium LP on pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7.">
  <link rel="canonical" href="https://www.getdasha.com/bag">
  <meta property="og:type" content="website"><meta property="og:url" content="https://www.getdasha.com/bag"><meta property="og:title" content="$dasha · hers"><meta property="og:description" content="Buy $dasha."><meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="$dasha · hers"><meta name="twitter:description" content="Buy $dasha."><meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"The bag — dash_eats health","url":"https://www.getdasha.com/bag","description":"dash_eats on Solana. Associated mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump. Mint-dead. Freeze-dead. Burned Raydium LP. Pair 9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7. LP mint 8GDvsE3NbiKuo5uUFR9zgRY76mdhXuJfeDsy8hn7h3Aj."}</script>
  <style>
    :root { color-scheme: dark; font: 18px/1.5 Arial, Helvetica, sans-serif; background: #070608; color: #f4eddb; }
    body { max-width: 44rem; margin: auto; padding: 2rem 1rem; }
    h1 { line-height: 1; }
    code { display: block; padding: 1rem; border: 1px solid #666; overflow-wrap: anywhere; }
    a { color: #dfff00; }
    a:focus-visible { outline: 3px solid #dfff00; outline-offset: 3px; }
    form { margin: 2.5rem 0 0; display: flex; gap: 0.5rem; }
    input, button { font: inherit; color: inherit; background: transparent; border: 1px solid #666; padding: 0.4rem 0.7rem; }
    button { color: #dfff00; }
    #out { margin-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>The bag</h1>
    <p>dash_eats on Solana. Associated mint:</p>
    <code>53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump</code>
    <p>Mint-dead. Freeze-dead.</p>
    <p>Burned Raydium LP. Pair:</p>
    <code>9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7</code>
    <p>LP mint <code>8GDvsE3NbiKuo5uUFR9zgRY76mdhXuJfeDsy8hn7h3Aj</code></p>
    <p><a href="https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump" rel="noopener noreferrer">Open the associated mint on Jupiter</a></p>
    <form id="record" action="/bag/api/record" method="get">
      <input id="mint" name="mint" type="text" autocomplete="off" spellcheck="false" placeholder="mint" aria-label="mint">
      <button type="submit">Look</button>
    </form>
    <div id="out" hidden></div>
    <p><a href="https://www.getdasha.com/">getdasha.com</a> · <a href="https://www.getdasha.com/which">Which</a></p>
  </main>
  <script>
  (function () {
    var form = document.getElementById('record');
    var input = document.getElementById('mint');
    var out = document.getElementById('out');
    if (!form || !input || !out) return;
    function esc(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function shareHref(mint) {
      return 'https://www.getdasha.com/bag?mint=' + encodeURIComponent(mint);
    }
    function copyBit(mint) {
      return '<p class="share"><a href="' + esc(shareHref(mint)) + '" data-copy>Copy link</a></p>';
    }
    function remember(mint) {
      if (!mint) return;
      try { history.replaceState(null, '', '/bag?mint=' + encodeURIComponent(mint)); } catch (e) {}
    }
    function show(html) {
      out.hidden = false;
      out.innerHTML = html;
    }
    function paint(j, status, mint) {
      remember(mint);
      var extra = mint ? copyBit(mint) : '';
      if (status === 400) { show('<p>' + esc(j.error || 'Bad mint.') + '</p>' + extra); return; }
      if (j.verdict === 'hers' && j.buy === 'https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump') {
        show('<p>Hers.</p><p>Mint-dead. Freeze-dead. Burned Raydium LP.</p><p><a href="' + esc(j.buy) + '" rel="noopener noreferrer">Open the associated mint on Jupiter</a></p>' + extra);
        return;
      }
      if (j.verdict === 'other-dasha') { show('<p>' + esc(j.note || 'Not this.') + '</p><p><a href="/which">Which</a></p>' + extra); return; }
      if (j.verdict === 'on-record') {
        var bits = [];
        if (j.name) bits.push(esc(j.name));
        if (j.ticker) bits.push(esc(j.ticker));
        var block = bits.length ? '<p>' + bits.join(' · ') + '</p>' : '';
        if (j.tier) block += '<p>' + esc(j.tier) + '</p>';
        if (j.status) block += '<p>' + esc(j.status) + '</p>';
        if (j.airdropTotal != null && j.airdropTotal !== '') block += '<p>' + esc(j.airdropTotal) + '</p>';
        if (j.airdropPct != null && j.airdropPct !== '') block += '<p>' + esc(j.airdropPct) + '</p>';
        var href = typeof j.href === 'string' && j.href.indexOf('https://ansem.io/launch/coin/') === 0 ? j.href : '';
        if (href) block += '<p><a href="' + esc(href) + '" rel="noopener noreferrer">On that ledger</a></p>';
        show((block || '<p>On that ledger.</p>') + extra);
        return;
      }
      if (j.verdict === 'neither') { show('<p>' + esc(j.note || 'Not hers. Not on that ledger.') + '</p><p><a href="/bag">The bag</a></p>' + extra); return; }
      show('<p>' + esc(j.error || 'Ledger quiet.') + '</p>' + extra);
    }
    function look(mint) {
      fetch('/bag/api/record?mint=' + encodeURIComponent(mint), { cache: 'no-store' })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
        .then(function (x) { paint(x.j || {}, x.status, mint); })
        .catch(function () { show('<p>Ledger quiet.</p>'); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      look((input.value || '').trim());
    });
    out.addEventListener('click', function (e) {
      var a = e.target.closest('[data-copy]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      function done() { a.textContent = 'Copied'; }
      function select() {
        try {
          var r = document.createRange();
          r.selectNodeContents(a);
          var s = getSelection();
          s.removeAllRanges();
          s.addRange(r);
          a.textContent = 'Select';
        } catch (err) { a.textContent = 'Select'; }
      }
      function legacy() {
        try {
          var ta = document.createElement('textarea');
          ta.value = href;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.body.appendChild(ta);
          ta.select();
          var copied = false;
          try { copied = document.execCommand('copy'); } catch (err) {}
          document.body.removeChild(ta);
          return copied;
        } catch (err) { return false; }
      }
      function timed(p) {
        return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('copy')); }, 600); })]);
      }
      function copyNow() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          timed(navigator.clipboard.writeText(href)).then(done).catch(function () { legacy() ? done() : select(); });
        } else if (legacy()) done();
        else select();
      }
      if (navigator.share) {
        navigator.share({ url: href }).then(done).catch(function () { copyNow(); });
      } else copyNow();
    });
    if (out.getAttribute('data-painted') === '1') return;
    var q = new URLSearchParams(location.search).get('mint');
    if (q) {
      input.value = q;
      look(q.trim());
    }
  })();
  </script>
</body>
</html>
`;


const SECURITY = {
  'Cache-Control': 'no-store',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

const HTML_SECURITY = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

const htmlHeaders = (extra = {}) => ({ ...HTML_SECURITY, ...extra });
const privateHtmlHeaders = (extra = {}, nonce = '') => ({
  ...HTML_SECURITY,
  'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}; connect-src 'none'; img-src 'none'; font-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`,
  'X-Robots-Tag': 'noindex, nofollow',
  ...extra,
});
const OAUTH_COOKIE = '__Host-dasha_x_oauth';

/** Keep crawler markup to the single, visible product identity owned by the embeds. */
export function sanitizePublicJsonLd(html) {
  return String(html || '').replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, (block) => {
    let value;
    try { value = JSON.parse(block.replace(/^[\s\S]*?>|<\/script>$/gi, '')); } catch { return block; }
    if (/potterlab|John\s*Potter/i.test(block)) return '';
    if (['SoftwareApplication', 'WebApplication'].includes(value?.['@type'])) return '';
    if (value?.['@type'] === 'WebSite' && !value?.['@id'] && html.includes('https://www.getdasha.com/#website')) return '';
    return block;
  });
}

/** Webflow's outer document currently omits its language on public pages. */
/** Inject site-wide X connect prompt into product HTML (home via Webflow pass-through + edge pages). */
export function injectXConnectPrompt(html) {
  if (!html || typeof html !== 'string') return html;
  if (html.includes('DashaXConnectPrompt')) return html;
  const src = 'https://lobby.getdasha.com/client/x-connect.js';
  const tag = `<script src="${src}" integrity="${X_CONNECT_SRI}" crossorigin="anonymous" defer></script>`;
  if (html.includes('client/x-connect.js')) {
    return html.replace(/<script\b[^>]*\bsrc\s*=\s*(['"]?)https:\/\/lobby\.getdasha\.com\/client\/x-connect\.js\1[^>]*>\s*<\/script>/gi, (open) => {
      if (/\bintegrity\s*=/.test(open)) {
        return open.replace(/\bintegrity\s*=\s*(['"])sha384-[A-Za-z0-9+/=]+\1/i, `integrity=$1${X_CONNECT_SRI}$1`);
      }
      return open.replace(/^<script\b/i, `<script integrity="${X_CONNECT_SRI}"`);
    });
  }
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}\n</body>`);
  return html + tag;
}

export function ensureHtmlLang(html) {
  return String(html || '').replace(/<html\b([^>]*)>/i, (tag, attrs) =>
    /\blang\s*=/i.test(attrs) ? tag : `<html lang="en"${attrs}>`);
}

/** Webflow's shared nav opens X in a new tab; enforce isolation at the edge too. */
export function hardenBlankTargets(html) {
  return String(html || '').replace(/<a\b[^>]*\btarget=(['"])_blank\1[^>]*>/gi, (tag) => {
    const rel = tag.match(/\brel=(['"])(.*?)\1/i);
    if (!rel) return tag.replace(/>$/, ' rel="noopener noreferrer">');
    const tokens = new Set(rel[2].toLowerCase().split(/\s+/).filter(Boolean));
    tokens.add('noopener');
    tokens.add('noreferrer');
    return tag.replace(rel[0], `rel="${[...tokens].join(' ')}"`);
  });
}


/** Drop leftover 404 tracking pixels (px.gif in src/href the browser will fetch). Per-tag. */
export function stripDeadTrackingPixel(html) {
  return String(html || '').replace(
    /<(?:img|link|script|iframe|embed|source|object|image)\b(?=[^>]*\b(?:src|href|data)=(['"])[^'"]*(?:\/r\/)?px\.(?:gif|png)(?:\?[^'"]*)?\1)[^>]*>/gi,
    '',
  );
}

/** Exact tags dasha-live-verify looks for. Webflow pages often omit them. */
/** Designer chrome still links /graph, a page that 404s. Strip it at the edge so first-visit
 *  HTML does not fail live-verify while the Webflow symbol is mid-claim. */
export function stripDeadNav(html) {
  let out = String(html || '').replace(/\s*<a\b(?=[^>]*\bhref=(['"])\/graph\1)[^>]*>[\s\S]*?<\/a>/gi, '');
  out = stripDeadTrackingPixel(out);
  out = stripRetiredProductDoors(out);
  out = stripHomeDashaNav(out);
  out = stripHomeWebflowBoot(out);
  out = stripSimpFromMenuAndFooter(out);
  out = stripLeftoverProductFooter(out);
  out = injectFaucetSlimHeader(out);
  out = hideHomeExtraChrome(out);
  out = unlockHomeMobileScroll(out);
  /* Leftover home dropped-selector CSS after leftover body class was already DOM-stripped. Keep body + .dasha + .dasha-root + #dasha-home + #top. */
  out = stripHomeLeftoverBodyBodyCss(out);
  /* Leftover home dropped-selector CSS after <h3> was never in the home DOM. Keep .dasha h1,.dasha h2. */
  out = stripHomeLeftoverDashaH3Css(out);
  /* Leftover home dropped-selector CSS after sparkline lecture comments were already stripped. Keep #spark-fill. Watch #spark hide stays. */
  out = stripHomeLeftoverSparkLineCss(out);
  /* Leftover home dropped-selector CSS after leftover #spark-line CSS was already stripped. Keep @keyframes dasha-draw. Watch #spark hide stays. */
  out = stripHomeLeftoverSparkFillCss(out);
  /* Leftover home unused @keyframes dasha-draw after leftover #spark-fill CSS was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. */
  out = stripHomeLeftoverDashaDrawKeyframes(out);
  /* Leftover home unused .spark CSS after leftover @keyframes dasha-draw was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverSparkClassCss(out);
  /* Leftover home unused .price-note CSS after leftover .spark CSS was already stripped. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceNoteCss(out);
  /* Leftover home unused @media(max-width:600px) .price spark/note grid after leftover .price-note CSS was already stripped. Keep parent .price grid-template-areas. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceSparkNoteMediaCss(out);
  /* Leftover home unused parent .price grid-template-areas after leftover @media spark/note grid was already stripped. Keep .price{ remount belt. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceGridTemplateAreasCss(out);
  /* Leftover home unused parent .price display:grid layout after leftover parent grid-template-areas was already stripped. Keep Watch chrome-hide .price hide list. Keep .price[hidden]. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceDisplayGridCss(out);
  /* Leftover home unused .price[hidden] after leftover parent .price display:grid layout was already stripped. Keep Watch chrome-hide .price hide list. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceHiddenCss(out);
  /* Leftover home unused .price-main layout after leftover .price[hidden] was already stripped. Keep Watch chrome-hide .price-main hide list. Keep .price-now / .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceMainCss(out);
  /* Leftover home unused .price-now type after leftover .price-main layout was already stripped. Keep Watch chrome-hide .price-now hide list. Keep .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceNowCss(out);
  out = injectDigestRemount(out);
  out = stripHomeWebflowPush(out);
  out = stripHomeSimpHashRedirect(out);
  out = stripHomeCompute(out);
  out = stripHeroEnterLobby(out);
  out = stripHeroContribute(out);
  out = stripEmptyHeroActions(out);
  out = neutralizeStudioPoster(out);
  out = stripHomeStudioFirstPaint(out);
  out = mountHomeChessAndFaucet(out);
  return out;
}

const DASHA_SLIM_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const DASHA_SLIM_BUY_HREF = `https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${DASHA_SLIM_MINT}`;

/** Home slim first paint: wordmark + Chat + Buy. Drop leftover Webflow .dasha-nav, nav.nav wrap, leftover home footer, and leftover skip-link from the document. Do not unhide it. */
const FAUCET_SLIM_STYLE = '<style id="dasha-faucet-slim">.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 18px;border-bottom:1px solid rgba(244,237,219,.32);background:var(--ink,#070608);position:sticky;top:0;z-index:50}.word{color:var(--paper,#f4eddb);font:900 17px/1 Arial,Helvetica,sans-serif;letter-spacing:-.03em;text-transform:uppercase;text-decoration:none;min-height:48px;display:inline-flex;align-items:center}.word b{color:var(--acid,#dfff00);font:inherit}.chat{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-left:auto;padding:0 12px;color:var(--paper,#f4eddb);font:900 1rem/1 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.04em;text-decoration:none}.buy{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 16px;background:var(--acid,#dfff00);color:var(--ink,#070608);font:900 1rem/1 "Arial Black",Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;box-shadow:4px 4px 0 var(--hot,#ff3b81)}.buy:focus-visible,.word:focus-visible,.chat:focus-visible{outline:3px solid var(--acid,#dfff00);outline-offset:3px}</style>';
const FAUCET_SLIM_HEADER = `<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="${DASHA_SLIM_BUY_HREF}" target="_blank" rel="noopener noreferrer">Buy</a></header>`;

export function stripHomeCompute(html) {
  let out = String(html || '');
  /* Kill Worker leftover that forced #compute-door visible over chrome-hide. */
  out = out.replace(/<style\b[^>]*id=["']dasha-home-compute["'][^>]*>[\s\S]*?<\/style>/gi, '');
  for (let n = 0; n < 4; n += 1) {
    const next = dropIdedElement(out, 'compute-door');
    if (next === out) break;
    out = next;
  }
  return out.replace(
    /<a\b(?=[^>]*\b(?:class=["'][^"']*\bcompute\b|href=(['"])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/compute\1))[^>]*>[\s\S]*?<\/a>/gi,
    '',
  );
}

export function stripHeroEnterLobby(html) {
  return String(html || '').replace(
    /<a\b(?=[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/lobby(?:[/?#][^'"]*)?\1)[^>]*>\s*Enter lobby[^<]*<\/a>/gi,
    '',
  );
}

/** Empty leftover after hero pill strips. Per-div; only when there is no child. */
export function stripEmptyHeroActions(html) {
  return String(html || '').replace(
    /<div\b(?=[^>]*\bclass=(['"])(?:[^'"]*\s)?actions(?:\s[^'"]*)?\1)[^>]*>\s*<\/div>/gi,
    '',
  );
}

export function injectFaucetSlimHeader(html) {
  const src = String(html || '');
  let out = src;
  if (/id=["']dasha-faucet-slim["']/.test(out)) {
    out = out.replace(/<style\b[^>]*id=["']dasha-faucet-slim["'][^>]*>[\s\S]*?<\/style>/i, FAUCET_SLIM_STYLE);
  }
  out = stripHomeCompute(out);
  if (!/id=["']dasha-faucet-slim["']/.test(out)) {
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${FAUCET_SLIM_STYLE}</head>`) : FAUCET_SLIM_STYLE + out;
  }
  if (/<header\b(?=[^>]*\bclass=["'][^"']*\bbar\b)/i.test(out)) {
    return out.replace(/<header\b(?=[^>]*\bclass=["'][^"']*\bbar\b)[^>]*>[\s\S]*?<\/header>/i, FAUCET_SLIM_HEADER);
  }
  if (/<body\b[^>]*>/i.test(out)) return out.replace(/<body\b[^>]*>/i, (m) => `${m}${FAUCET_SLIM_HEADER}`);
  return FAUCET_SLIM_HEADER + out;
}

/** Watch belt: hide remountable price/ticker chrome. Leftover nav/footer/skip-link/#compute-door/.compute/.poster are DOM-stripped — do not re-list them in this CSS lecture. */
export function hideHomeExtraChrome(html) {
  const src = String(html || '');
  const style = '<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>';
  if (/id=["']dasha-home-chrome-hide["']/.test(src)) {
    return src.replace(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i, style);
  }
  return /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `${style}</head>`) : style + src;
}

/** Leftover Webflow / howto chrome: chess, Desk, Studio, compute, verse, learn, graph. Keep /chess?embed=1. */
const RETIRED_PRODUCT_DOOR = /<a\b(?=[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.|lobby\.)?getdasha\.com)?\/(?:chess|dasha|desk|studio|compute|verse|learn|graph)\/?(?:[?#][^'"]*)?\1)[^>]*>[\s\S]*?<\/a>/gi;

function isKeptChessEmbedHref(href) {
  return /\/chess\/?\?embed=1(?:&|#|$)/i.test(String(href || ''));
}

export function stripRetiredProductDoors(html) {
  RETIRED_PRODUCT_DOOR.lastIndex = 0;
  return String(html || '').replace(RETIRED_PRODUCT_DOOR, (tag) => {
    const href = (tag.match(/\bhref=(['"])([\s\S]*?)\1/i) || [])[2] || '';
    return isKeptChessEmbedHref(href) ? tag : '';
  });
}

/** Leftover /how-to-buy dropped-selector CSS after nav Buy was already DOM-stripped (nav is $dasha only). Humans see nav a.btn in view-source. .btn + .btn.ghost + nav a stay. Buy on Jupiter + #ca stay. Distinct leftover vs leftover .risk/.when/.fine CSS. */
export function stripHowtoLeftoverNavBtnCss(html) {
  let out = String(html || '');
  const howto =
    /<h1>How to buy \$dasha<\/h1>/.test(out) ||
    /rel=["']canonical["'][^>]*href=["']https:\/\/www\.getdasha\.com\/how-to-buy["']/.test(out);
  if (!howto) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const nav = visible.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i);
  if (nav && /<a\b[^>]*class=["'][^"']*\bbtn\b/i.test(nav[0])) return out;
  return out.replace(/nav a\.btn\s*\{[^}]*\}/gi, '');
}

/** Leftover /how-to-buy x-connect.js after CSS/JS strip. Howto has no [data-dasha-login], [data-dasha-login-link], oauth/x, or #bb-x. Humans see leftover x-connect.js in view-source. Distinct leftover vs leftover nav a.btn CSS / leftover id=buy2. Home/lobby/chess/login/faucet/bounties x-connect.js stay. Mint COPY + Buy on Jupiter + #ca stay. Howto only. */
export function stripHowtoLeftoverXConnectJs(html) {
  let out = String(html || '');
  const howto =
    /<h1>How to buy \$dasha<\/h1>/.test(out) ||
    /rel=["']canonical["'][^>]*href=["']https:\/\/www\.getdasha\.com\/how-to-buy["']/.test(out);
  if (!howto) return out;
  return dropScriptIf(out, (block) => /client\/x-connect\.js/i.test(block));
}

/** Leftover /how-to-buy id="buy2" after CSS/JS strip. JS never reads getElementById('buy2');
 * CSS never targets #buy2. Humans see it in view-source. Distinct leftover vs route disclaimer /
 * when-lecture. Buy on Jupiter + jup.ag + #ca + skip-link stay. Do not eat id="copy".
 */
export function stripHowtoLeftoverBuy2Id(html) {
  let out = String(html || '');
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])buy2\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])buy2\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

export function polishHowtoHtml(html) {
  let page = stripLeftoverProductFooter(stripRetiredProductDoors(String(html || '')));
  page = page.replace(
    /<p class="lede">[\s\S]*?<\/p>/i,
    '<p class="lede">SOL → mint → Buy.</p>',
  );
  page = page.replace(
    /Fund any Solana wallet you control\. getdasha\.com never opens a wallet or runs a swap\./g,
    'Fund any Solana wallet you control.',
  );
  page = page.replace(
    /Copy the whole string\. On Jupiter, open the buy token and confirm it matches character-for-character\. Last four characters are not enough — fakes reuse those\./g,
    'Copy the whole mint.',
  );
  page = page.replace(/<p class="risk">[\s\S]*?<\/p>/gi, '');
  page = page.replace(/<p class="fine">[\s\S]*?<\/p>/gi, '');
  page = page.replace(
    /Every line is on-chain, so check it against Solscan rather than taking this page[\u2019']s word\./g,
    '',
  );
  page = page.replace(/<h2>What you can check yourself<\/h2>/g, '<h2>On-chain</h2>');
  /* Leftover /how-to-buy disclaimer crawlers still see after style/script strip. Buy on Jupiter stays. */
  page = page.replace(/\s*Review the route there before confirming\./g, '');
  /* Leftover /how-to-buy when-lecture crawlers still see after style/script strip. On-chain facts stay. */
  page = page.replace(/\s*Read from the Solana mint account on 18 August 2026 at finalized commitment\./g, '');
  page = page.replace(/<p class="when">\s*<\/p>/gi, '');
  /* Leftover /how-to-buy dropped-selector CSS after .risk/.when/.fine DOM-strip. Humans see it in view-source. Skip-link + .actions + On-chain facts stay. Buy on Jupiter stays. */
  page = page.replace(/\.risk b\s*\{[^}]*\}/gi, '');
  page = page.replace(/\.risk\s*\{[^}]*\}/gi, '');
  page = page.replace(/\.facts \.when\s*\{[^}]*\}/gi, '');
  page = page.replace(/\.facts \.fine\s*\{[^}]*\}/gi, '');
  /* Leftover /how-to-buy id="buy2" after CSS/JS strip. Buy on Jupiter stays. Skip-link + #ca stay. */
  page = stripHowtoLeftoverBuy2Id(page);
  /* Leftover /how-to-buy dropped-selector CSS after nav Buy was already DOM-stripped. Humans see it in view-source. .btn + Buy on Jupiter + #ca stay. */
  page = stripHowtoLeftoverNavBtnCss(page);
  /* Leftover /how-to-buy x-connect.js after CSS/JS strip. No login mount. Home/lobby/chess/login/faucet/bounties x-connect.js stay. */
  page = stripHowtoLeftoverXConnectJs(page);
  return page;
}

/** iOS: view() rise + overflow-x:hidden + GRWM video steal the swipe. Unlock page scroll. Leftover home dropped-selector CSS after .lobby-log was never in the home DOM. Leftover home dropped-selector CSS after #dasha-chess was never in the home DOM. Humans see it in view-source. GRWM + Watch belt stay. Lobby .lobby-log stays. Lobby #dasha-chess stays. */
const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">html{overflow-x:clip;overflow-y:scroll!important;height:auto!important;max-height:none!important;scroll-behavior:auto;-webkit-overflow-scrolling:touch}body,body.body,.dasha,.dasha-root,main,#dasha-home,#top{overflow:visible!important;height:auto!important;max-height:none!important;position:static}html,body,.dasha,.dasha-root,main{touch-action:pan-y}.dasha section,.contract{animation:none!important;animation-timeline:auto!important;transform:none!important}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px);width:min(100%,calc(52svh * 720 / 1280))}}</style>';

export function unlockHomeMobileScroll(html) {
  const src = String(html || '');
  const style = HOME_MOBILE_SCROLL;
  if (/id=["']dasha-mobile-scroll["']/.test(src)) {
    return src.replace(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/i, style);
  }
  return /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `${style}</head>`) : style + src;
}

export function stripHeroContribute(html) {
  return String(html || '').replace(
    /<a\b(?=[^>]*\bhref=(['"])\/contribute\1)[^>]*>[\s\S]*?<\/a>/gi,
    '',
  );
}

/** Neutralize Studio poster aria/copy. Attribute-quoted only. Do not restore /studio. */
export function neutralizeStudioPoster(html) {
  return String(html || '')
    .replace(/\saria-label=(['"])Open an editable Dasha Studio starter\1/gi, ' aria-hidden="true"')
    .replace(/\saria-label=(['"])[^'"]*Dasha Studio[^'"]*\1/gi, ' aria-hidden="true"');
}

/** Per-script drop. Non-greedy; cannot cross </script>. Never a /studio# eat-the-page regex. */
export function dropScriptIf(html, pred) {
  return String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (block) => {
    try { return pred(block) ? '' : block; } catch { return block; }
  });
}


/** Walk classed tags; drop the first whose full element matches pred. Nested same-tag depth. */
function dropClassedTagIf(html, tag, className, pred) {
  const src = String(html || '');
  const openRe = new RegExp(
    '<' + tag + '\\b(?=[^>]*\\bclass=([\'"])(?:[^\'"]*\\s)?' + className + '(?:\\s[^\'"]*)?\\1)[^>]*>',
    'gi',
  );
  let m;
  while ((m = openRe.exec(src))) {
    let end = m.index + m[0].length;
    if (!/\/>$/.test(m[0])) {
      let depth = 1;
      const re = new RegExp('<' + tag + '\\b[^>]*>|<\\/' + tag + '>', 'gi');
      re.lastIndex = end;
      let t;
      let closed = false;
      while ((t = re.exec(src))) {
        if (t[0].startsWith('</')) depth -= 1;
        else if (!/\/>$/.test(t[0])) depth += 1;
        if (depth === 0) {
          end = t.index + t[0].length;
          closed = true;
          break;
        }
      }
      if (!closed) continue;
    }
    const el = src.slice(m.index, end);
    if (pred(el)) return src.slice(0, m.index) + src.slice(end);
    openRe.lastIndex = end;
  }
  return src;
}


/** Walk classed tags; unwrap the first whose full element matches pred (keep inner). Nested same-tag depth. */
function unwrapClassedTagIf(html, tag, className, pred) {
  const src = String(html || '');
  const openRe = new RegExp(
    '<' + tag + '\\b(?=[^>]*\\bclass=([\'"])(?:[^\'"]*\\s)?' + className + '(?:\\s[^\'"]*)?\\1)[^>]*>',
    'gi',
  );
  let m;
  while ((m = openRe.exec(src))) {
    const openEnd = m.index + m[0].length;
    let end = openEnd;
    let innerEnd = openEnd;
    if (!/\/>$/.test(m[0])) {
      let depth = 1;
      const re = new RegExp('<' + tag + '\\b[^>]*>|<\\/' + tag + '>', 'gi');
      re.lastIndex = openEnd;
      let t;
      let closed = false;
      while ((t = re.exec(src))) {
        if (t[0].startsWith('</')) depth -= 1;
        else if (!/\/>$/.test(t[0])) depth += 1;
        if (depth === 0) {
          innerEnd = t.index;
          end = t.index + t[0].length;
          closed = true;
          break;
        }
      }
      if (!closed) continue;
    }
    const el = src.slice(m.index, end);
    if (pred(el)) return src.slice(0, m.index) + src.slice(openEnd, innerEnd) + src.slice(end);
    openRe.lastIndex = end;
  }
  return src;
}

/** Walk one classed tag. Nested same-tag depth, not a regex to the first close. */
function dropClassedTag(html, tag, className) {
  const src = String(html || '');
  const openRe = new RegExp(
    '<' + tag + '\\b(?=[^>]*\\bclass=([\'"])(?:[^\'"]*\\s)?' + className + '(?:\\s[^\'"]*)?\\1)[^>]*>',
    'i',
  );
  const m = openRe.exec(src);
  if (!m) return src;
  if (/\/>$/.test(m[0])) {
    return src.slice(0, m.index) + src.slice(m.index + m[0].length);
  }
  let depth = 1;
  const re = new RegExp('<' + tag + '\\b[^>]*>|<\\/' + tag + '>', 'gi');
  re.lastIndex = m.index + m[0].length;
  let t;
  while ((t = re.exec(src))) {
    if (t[0].startsWith('</')) depth -= 1;
    else if (!/\/>$/.test(t[0])) depth += 1;
    if (depth === 0) return src.slice(0, m.index) + src.slice(t.index + t[0].length);
  }
  return src;
}

/** Walk one tag. Nested same-tag depth, not a regex to the first close. */
function dropTagged(html, tag) {
  const src = String(html || '');
  const openRe = new RegExp('<' + tag + '\\b[^>]*>', 'i');
  const m = openRe.exec(src);
  if (!m) return src;
  if (/\/>$/.test(m[0])) {
    return src.slice(0, m.index) + src.slice(m.index + m[0].length);
  }
  let depth = 1;
  const re = new RegExp('<' + tag + '\\b[^>]*>|<\\/' + tag + '>', 'gi');
  re.lastIndex = m.index + m[0].length;
  let t;
  while ((t = re.exec(src))) {
    if (t[0].startsWith('</')) depth -= 1;
    else if (!/\/>$/.test(t[0])) depth += 1;
    if (depth === 0) return src.slice(0, m.index) + src.slice(t.index + t[0].length);
  }
  return src;
}

/** Walk one aria-label tag. Nested same-tag depth. */
function dropAriaLabeledTag(html, tag, label) {
  const src = String(html || '');
  const esc = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp(
    '<' + tag + '\\b(?=[^>]*\\baria-label=([\'"])' + esc + '\\1)[^>]*>',
    'i',
  );
  const m = openRe.exec(src);
  if (!m) return src;
  if (/\/>$/.test(m[0])) {
    return src.slice(0, m.index) + src.slice(m.index + m[0].length);
  }
  let depth = 1;
  const re = new RegExp('<' + tag + '\\b[^>]*>|<\\/' + tag + '>', 'gi');
  re.lastIndex = m.index + m[0].length;
  let t;
  while ((t = re.exec(src))) {
    if (t[0].startsWith('</')) depth -= 1;
    else if (!/\/>$/.test(t[0])) depth += 1;
    if (depth === 0) return src.slice(0, m.index) + src.slice(t.index + t[0].length);
  }
  return src;
}

/** Leftover Webflow menus. CSS-hide is not enough — crawlers still see $DASHA Lobby Faucet Mint How to buy Log in. Per-element; cannot blank the page. */
export function stripHomeDashaNav(html) {
  let out = String(html || '');
  for (let n = 0; n < 4; n += 1) {
    const next = dropClassedTag(out, 'nav', 'dasha-nav');
    if (next === out) break;
    out = next;
  }
  for (let n = 0; n < 4; n += 1) {
    const next = dropClassedTag(out, 'nav', 'nav');
    if (next === out) break;
    out = next;
  }
  for (let n = 0; n < 4; n += 1) {
    const next = dropAriaLabeledTag(out, 'nav', 'Main navigation');
    if (next === out) break;
    out = next;
  }
  /* Leftover chrome after nav.wrap strip: CSS-hidden home footer still paints Lobby/Faucet/Bounties. Home only. */
  const src = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out)
    || /id=["']dasha-home["']/.test(src) || /id=["']chat-door["']/.test(src)
    || /aria-label=["']Main navigation["']/i.test(src);
  if (home) {
    for (let n = 0; n < 4; n += 1) {
      const next = dropTagged(out, 'footer');
      if (next === out) break;
      out = next;
    }
    /* Leftover chrome after nav/footer strip: CSS-hidden skip-link still paints Skip to content. Home only. Product skip-links stay. */
    for (let n = 0; n < 4; n += 1) {
      const next = dropClassedTag(out, 'a', 'skip-link');
      if (next === out) break;
      out = next;
    }
  }
  return out;
}



/** Leftover home Sign in menu / leftover hamburger. Live Webflow w-embed still paints empty `w-embed w-script` after style/script strip and removes #grok-door. Product CSS embed + x-connect.js stay. Home only. */
export function stripHomeLeftoverSigninMenu(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const leftover = (el) => {
    if (/x-connect\.js|faucet\.js|@view-transition|dasha-hero|johns-awesome/i.test(el)) return false;
    return /signin-menu/i.test(el)
      || /data-dasha-signin-menu/i.test(el)
      || /installSignin/i.test(el)
      || /#grok-door\s*\{\s*display\s*:\s*none/i.test(el);
  };
  for (let n = 0; n < 4; n += 1) {
    const next = dropClassedTagIf(out, 'div', 'w-embed', leftover);
    if (next === out) break;
    out = next;
  }
  return out;
}


/** Leftover home product CSS Webflow wrapper. After leftover Sign in embed drop, remaining `w-embed w-script` still paints leftover Webflow chrome after style/script strip. Inner @view-transition + x-connect.js are product — unwrap wrapper only. Home only. */
export function unwrapHomeProductWembed(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const product = (el) => {
    if (/signin-menu/i.test(el) || /installSignin/i.test(el) || /data-dasha-signin-menu/i.test(el) || /#grok-door\s*\{\s*display\s*:\s*none/i.test(el)) return false;
    return /@view-transition/i.test(el) || /x-connect\.js/i.test(el) || /dasha-hero/i.test(el);
  };
  for (let n = 0; n < 4; n += 1) {
    const next = unwrapClassedTagIf(out, 'div', 'w-embed', product);
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Leftover 2020 portfolio CSS lecture still serializes in live home <style>. Humans see it without style/script strip. Repair rules (#dasha-home h1/h2) stay. */
export function stripHomePortfolioLecture(html) {
  return String(html || '').replace(
    /\/\*\s*Repairs for the 2020 portfolio template[\s\S]*?\*\//g,
    '',
  );
}

/** Leftover .dasha-nav CSS-hide still serializes in live home repair <style> after <nav class="dasha-nav"> was DOM-stripped. Humans see it in view-source. Repair #dasha-home h1/h2 stay. Watch price/ticker belt stays. Home only. */
export function stripHomeDashaNavHideCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/\.dasha-nav\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\}/gi, '');
}

/** Leftover #dasha-home #tool label repair CSS still serializes in live home <style> after #tool was DOM-stripped (id=tool false). Humans see it in view-source. Repair #dasha-home h1/h2 stay. Watch price/ticker belt stays. Home only. */
export function stripHomeLeftoverToolLabelCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/#dasha-home\s+#tool\s+label\s*\{[^}]*\}/gi, '');
}

/** Leftover dropped-selector CSS still serializes in live home product <style> after skip-link/footer/.compute/.poster/wrap-nav .navlinks/.nav/.brand/.login-link and leftover hero/door .mint-lede/.actions/.door-actions/.copy-link were DOM-stripped. Humans see it in view-source. Repair #dasha-home h1/h2/label stay. Watch price/ticker belt stays. Product skip-links stay. Do not strip .pill. Keep .copy (contract). Home only. */
export function stripHomeDroppedSelectorCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  out = out.replace(/\/\*\s*The collage lands one tile at a time[\s\S]*?\*\//g, '');
  out = out.replace(/\.skip-link:focus\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.skip-link\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.dasha footer a:hover\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.dasha footer a\s*\{[^}]*\}/gi, '');
  out = out.replace(/footer \.wrap\s*\{[^}]*\}/gi, '');
  out = out.replace(/footer p\s*\{[^}]*\}/gi, '');
  out = out.replace(/footer\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.compute[^{]*\{[^}]*\}/gi, '');
  out = out.replace(/\.pill,\s*\.poster-tile\s*\{/gi, '.pill{');
  out = out.replace(/\.poster-tile:nth-child\(\d+\)\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.poster-tile:hover\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.poster-tile strong\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.poster-tile\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.poster-grid\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.poster\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.sticker\s*\{[^}]*\}/gi, '');
  /* Leftover wrap-nav .navlinks CSS after <nav class="nav wrap"> DOM-strip. Mixed @media keeps .dasha-hero/.pill/.contract. Do not strip .pill. */
  out = out.replace(/\.navlinks\s*,\s*/gi, '');
  out = out.replace(/,\s*\.navlinks(?=[^{]*\{)/gi, '');
  out = out.replace(/\.navlinks a:hover\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.navlinks a\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.navlinks[^{]*\{[^}]*\}/gi, '');
  /* Leftover wrap-nav .nav/.brand/.login-link CSS after <nav class="nav wrap"> DOM-strip. Mixed @media keeps .pill/.dasha-hero/.contract. Do not strip .pill. Distinct leftover vs .navlinks. */
  out = out.replace(/\.login-link\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.brand span\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.brand\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.nav \.pill\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.nav(?![\w-])\s*\{[^}]*\}/gi, '');
  /* Leftover hero/door CSS after mint-lede/actions/door-actions/copy-link DOM-strip. Keep .copy (contract). Keep .pill. Watch .price/.ticker stay. */
  out = out.replace(/\.door-actions \.pill:not\(\.primary\)\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.door-actions\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.mint-lede code\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.mint-lede a\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.mint-lede\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.door \.copy-link\s*\{[^}]*\}/gi, '');
  out = out.replace(/(?<![\w-])\.actions\s*\{[^}]*\}/gi, '');
  out = out.replace(/@media[^{]+\{\s*\}/gi, '');
  return out;
}


/** Leftover home CSS lecture still serializes in live <style> after dropped-selector CSS DRY. Humans see Make/Play/Buy (retired Studio) + motion/sparkline lecture in view-source. @view-transition rules stay. Watch price/ticker belt stays. Repair #dasha-home h1/h2/label stay. Home only. */
export function stripHomeCssLecture(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  out = out.replace(/\/\*\s*Asking for less motion[\s\S]*?\*\//g, '');
  out = out.replace(/\/\*\s*Keep the cross-fade brief[\s\S]*?\*\//g, '');
  out = out.replace(/\/\*\s*Motion, added as enhancement only[\s\S]*?\*\//g, '');
  out = out.replace(/\/\*\s*Transform only\. Opacity here[\s\S]*?\*\//g, '');
  out = out.replace(/\/\*\s*Sections arrive as they come into view[\s\S]*?\*\//g, '');
  out = out.replace(/\/\*\s*The sparkline draws itself once on load[\s\S]*?\*\//g, '');
  return out;
}


/** Leftover home dropped-selector CSS after sparkline lecture comments were already stripped
 * and #spark-line was never in the live home DOM (Watch chrome-hide #spark; price/spark SVG
 * already DOM-stripped). Humans see leftover #spark-line animation CSS in view-source. Never paints.
 * Distinct leftover vs leftover CSS lecture comments / leftover .dasha h3.
 * Keep #spark-fill (separate leftover). Keep @keyframes dasha-draw. Keep Watch #spark hide.
 * Keep .price/.ticker remount belt. Product @view-transition + GRWM stay. Home only.
 * Do not eat #spark-fill. Do not restore #compute-door.
 */
export function stripHomeLeftoverSparkLineCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bid=["']spark-line["']/.test(visible)) return out;
  return out.replace(/#spark-line\s*\{[^}]*\}/gi, '');
}

/** Leftover home dropped-selector CSS after leftover #spark-line CSS was already stripped
 * and #spark-fill was never in the live home DOM (Watch chrome-hide #spark; price/spark SVG
 * already DOM-stripped). Humans see leftover #spark-fill animation CSS in view-source. Never paints.
 * Distinct leftover vs leftover #spark-line CSS / leftover CSS lecture comments.
 * Keep @keyframes dasha-draw (separate leftover). Keep @keyframes dasha-rise (still used by
 * .dasha section,.contract). Keep Watch #spark hide. Keep .price/.ticker remount belt.
 * Product @view-transition + GRWM stay. Home only.
 * Do not eat dasha-rise section animation. Do not restore #compute-door.
 */
export function stripHomeLeftoverSparkFillCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bid=["']spark-fill["']/.test(visible)) return out;
  return out.replace(/#spark-fill\s*\{[^}]*\}/gi, '');
}

/** Leftover home unused @keyframes dasha-draw after leftover #spark-fill CSS was already stripped
 * and no selector uses animation:dasha-draw (spark-line CSS already gone). Humans see leftover
 * @keyframes dasha-draw in view-source. Never paints.
 * Distinct leftover vs leftover #spark-fill CSS / leftover #spark-line CSS.
 * Keep @keyframes dasha-rise (still used by .dasha section,.contract). Keep Watch #spark hide.
 * Keep .price/.ticker remount belt. Product @view-transition + GRWM stay. Home only.
 * Do not eat dasha-rise section animation. Do not restore #compute-door.
 */
export function stripHomeLeftoverDashaDrawKeyframes(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  if (/animation(?:-name)?\s*:\s*[^;{}]*\bdasha-draw\b/i.test(out)) return out;
  return out.replace(/@keyframes\s+dasha-draw\s*\{from\{stroke-dashoffset:1\}to\{stroke-dashoffset:0\}\}/g, '');
}

/** Leftover home unused .spark CSS after leftover @keyframes dasha-draw was already stripped
 * and class="spark" was never in the live home DOM (Watch chrome-hide #spark; price/spark SVG
 * already DOM-stripped). Humans see leftover .spark{grid-area:spark;width:100%;height:44px;display:block}
 * in view-source. Never paints.
 * Distinct leftover vs leftover @keyframes dasha-draw / leftover #spark-fill CSS / leftover #spark-line CSS.
 * Keep @keyframes dasha-rise (still used by .dasha section,.contract). Keep Watch #spark hide.
 * Keep .price/.ticker remount belt. Product @view-transition + GRWM stay. Home only.
 * Do not eat dasha-rise section animation. Do not restore #compute-door.
 */
export function stripHomeLeftoverSparkClassCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bspark\b/.test(visible)) return out;
  return out.replace(/\.spark\{grid-area:spark;width:100%;height:44px;display:block\}/g, '');
}


/** Leftover home unused .price-note CSS after leftover .spark CSS was already stripped
 * and class="price-note"/#price-note was never in the live home DOM (Watch chrome-hide
 * #spark; price/spark SVG already DOM-stripped). Humans see leftover
 * .price-note{grid-area:note;margin:0;font-size:14px;color:rgba(244,237,219,.82);line-height:1.45}
 * in view-source. Never paints.
 * Distinct leftover vs leftover .spark CSS / leftover @keyframes dasha-draw / leftover #spark-fill CSS.
 * Keep Watch chrome-hide .price-note selector. Keep .price-chg.up/.price-chg.down.
 * Keep @keyframes dasha-rise (still used by .dasha section,.contract). Keep Watch #spark hide.
 * Keep .price/.ticker remount belt. Product @view-transition + GRWM stay. Home only.
 * Do not eat dasha-rise section animation. Do not restore #compute-door.
 */
export function stripHomeLeftoverPriceNoteCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bprice-note\b/.test(visible)) return out;
  if (/\bid=["']price-note["']/.test(visible)) return out;
  return out.replace(/\.price-note\{grid-area:note;margin:0;font-size:14px;color:rgba\(244,237,219,\.82\);line-height:1\.45\}/g, '');
}


/** Leftover home unused @media(max-width:600px) .price spark/note grid after leftover .price-note CSS was already stripped
 * and live home .price grid DOM has no spark/note occupants (no class="price", no class="spark"/#spark,
 * no class="price-note"/#price-note after style/script strip). Spark/note layout CSS already dropped.
 * Humans see leftover @media(max-width:600px){.price{grid-template-columns:1fr;grid-template-areas:"main" "spark" "note"}}
 * in view-source. Never paints.
 * Distinct leftover vs leftover .price-note CSS / leftover .spark CSS / leftover @keyframes dasha-draw.
 * Keep parent .price grid-template-areas:"main spark" "note note" remount belt. Keep Watch chrome-hide .price-note.
 * Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt.
 * Product @view-transition + GRWM stay. Home only.
 * Do not eat dasha-rise section animation. Do not restore #compute-door.
 */
export function stripHomeLeftoverPriceSparkNoteMediaCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bspark\b/.test(visible)) return out;
  if (/\bid=["']spark["']/.test(visible)) return out;
  if (/\bclass=["'][^"']*\bprice-note\b/.test(visible)) return out;
  if (/\bid=["']price-note["']/.test(visible)) return out;
  return out.replace(/@media\(max-width:600px\)\{\.price\{grid-template-columns:1fr;grid-template-areas:"main" "spark" "note"\}\}/g, '');
}

/** Leftover home unused parent .price grid-template-areas after leftover @media spark/note grid was already stripped
 * and live home DOM has no class="price"/#price (no spark, no price-note after style/script strip).
 * Humans see leftover grid-template-areas:"main spark" "note note" in view-source. Never paints.
 * Distinct leftover vs leftover @media spark/note grid / leftover .price-note CSS / leftover .spark CSS.
 * Keep .price{ remount belt (margin/display:grid/columns). Keep Watch chrome-hide .price-note.
 * Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt.
 * Product @view-transition + GRWM stay. Home only.
 * Do not eat dasha-rise section animation. Do not restore #compute-door.
 */
export function stripHomeLeftoverPriceGridTemplateAreasCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bprice\b/.test(visible)) return out;
  if (/\bid=["']price["']/.test(visible)) return out;
  if (/\bclass=["'][^"']*\bspark\b/.test(visible)) return out;
  if (/\bid=["']spark["']/.test(visible)) return out;
  if (/\bclass=["'][^"']*\bprice-note\b/.test(visible)) return out;
  if (/\bid=["']price-note["']/.test(visible)) return out;
  return out.replace(/grid-template-areas:"main spark" "note note";?/g, '');
}


/** Leftover home unused parent .price display:grid layout after leftover parent grid-template-areas was already stripped
 * and live home DOM has no class="price"/#price (style/script stripped).
 * Humans see leftover .price{margin:22px 0 0;max-width:520px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px;align-items:center;padding:14px 16px;border:1px solid var(--line);background:rgba(255,255,255,.04)}
 * in view-source. Never paints (no .price box).
 * Distinct leftover vs leftover parent grid-template-areas / leftover @media spark/note grid / leftover .price-note CSS.
 * Keep Watch chrome-hide .price,#price,.ticker hide list (different string). Keep .price[hidden].
 * Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt.
 * Product @view-transition + GRWM stay. Home only.
 * Do not eat dasha-rise section animation. Do not restore #compute-door.
 */
export function stripHomeLeftoverPriceDisplayGridCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bprice\b/.test(visible)) return out;
  if (/\bid=["']price["']/.test(visible)) return out;
  return out.replace(/\.price\{margin:22px 0 0;max-width:520px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px;align-items:center;padding:14px 16px;border:1px solid var\(--line\);background:rgba\(255,255,255,\.04\)\}/g, '');
}

/** Leftover home unused .price[hidden] after leftover parent .price display:grid layout was already stripped.
 * Live / 200 still serializes leftover `.price[hidden]{display:none}` after live home DOM has no class="price"/#price
 * (style/script stripped). Never paints. Distinct leftover vs leftover parent .price display:grid layout / Watch chrome-hide .price hide list.
 * Keep Watch chrome-hide .price,#price,.ticker hide list. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise.
 * Watch #spark hide stays. Keep .ticker remount belt. Home only. Do not eat Watch hide.
 */
export function stripHomeLeftoverPriceHiddenCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bprice\b/.test(visible)) return out;
  if (/\bid=["']price["']/.test(visible)) return out;
  return out.replace(/\.price\[hidden\]\{display:none\}/g, '');
}

/** Leftover home unused .price-main layout after leftover .price[hidden] was already stripped.
 * Live / 200 still serializes leftover `.price-main{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important}`
 * after live home DOM has no class="price-main" (style/script stripped). Never paints.
 * Distinct leftover vs leftover .price[hidden] / leftover parent .price display:grid layout / Watch chrome-hide .price-main hide list.
 * Keep Watch chrome-hide .price-main (different string). Keep .price-now / .price-chg type / .price-chg.up/.price-chg.down.
 * Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. Home only. Do not eat Watch hide.
 */
export function stripHomeLeftoverPriceMainCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bprice-main\b/.test(visible)) return out;
  return out.replace(/\.price-main\{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important\}/g, '');
}

/** Leftover home unused .price-now type after leftover .price-main layout was already stripped.
 * Live / 200 still serializes leftover `.price-now{font-size:clamp(20px,3vw,26px);font-weight:950;letter-spacing:-.02em;font-variant-numeric:tabular-nums}`
 * after live home DOM has no class="price-now" (style/script stripped). Never paints.
 * Distinct leftover vs leftover .price-main layout / Watch chrome-hide .price-now hide list.
 * Keep Watch chrome-hide .price-now (different string). Keep .price-chg type / .price-chg.up/.price-chg.down.
 * Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. Home only. Do not eat Watch hide.
 */
export function stripHomeLeftoverPriceNowCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bprice-now\b/.test(visible)) return out;
  return out.replace(/\.price-now\{font-size:clamp\(20px,3vw,26px\);font-weight:950;letter-spacing:-.02em;font-variant-numeric:tabular-nums\}/g, '');
}

/** Leftover home dropped-selector CSS after <h3> was never in the home DOM
 * (product CSS still emits mixed .dasha h1,.dasha h2,.dasha h3). Humans see leftover
 * .dasha h3 in view-source. Distinct leftover vs leftover dropped-selector / leftover CSS lecture.
 * Keep .dasha h1,.dasha h2. Keep repair #dasha-home h1/h2. Keep .dasha a,.dasha strong (separate leftover).
 * Product @view-transition + GRWM + Watch belt stay. johns-awesome stays. Home only.
 * Do not eat .dasha h1 or .dasha h2.
 */

export function stripHomeLeftoverDashaH3Css(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/<h3\b/i.test(visible)) return out;
  return out
    .replace(/\.dasha h3\s*,\s*/g, '')
    .replace(/,\s*\.dasha h3(?=\s*[{,])/g, '');
}

/** Leftover standalone @view-transition <style> after product CSS already serializes the same rules.
 * Humans see duplicate @view-transition in view-source. Product @view-transition stays.
 * Distinct leftover vs CSS lecture comments. Home only. GRWM + Watch belt stay.
 */
function isHomeViewTransitionOnlyCss(css) {
  const t = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!/@view-transition/i.test(t)) return false;
  const rest = t
    .replace(/@media[^{]*\{\s*@view-transition\s*\{[^}]*\}\s*\}/gi, '')
    .replace(/@view-transition\s*\{[^}]*\}/gi, '')
    .replace(/::view-transition-(?:old|new)\([^)]*\)(?:\s*,\s*::view-transition-(?:old|new)\([^)]*\))*\s*\{[^}]*\}/gi, '')
    .replace(/[,;{}]/g, '')
    .replace(/\s+/g, '');
  return rest.length === 0;
}

export function stripHomeLeftoverDupViewTransitionCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(out))) blocks.push({ full: m[0], css: m[1] });
  const vt = blocks.filter((b) => /@view-transition/i.test(b.css));
  if (vt.length < 2) return out;
  const keepers = vt.filter((b) => !isHomeViewTransitionOnlyCss(b.css));
  if (!keepers.length) return out;
  for (const d of vt) {
    if (isHomeViewTransitionOnlyCss(d.css)) out = out.replace(d.full, '');
  }
  return out;
}

/** Leftover Webflow boot after skip-link strip. Comments, generator, default favicon.ico, w-mod-js, jquery, webflow.js, leftover commerce currency, leftover RETIRED product's mark / page-level icon HTML comments, leftover cherries-lecture / view-transition-lecture / canonical-URL HTML comments still paint. Home only. Cherries SVG stays. @view-transition stays. Canonical link stays. Product skip-links stay. Do not unhide nav/footer. Do not restore compute-door. */
export function stripHomeWebflowBoot(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  out = out.replace(/<!--\s*This site was created in Webflow\.[\s\S]*?-->/gi, '');
  out = out.replace(/<!--\s*Last Published:[\s\S]*?-->/gi, '');
  out = out.replace(/<meta\b[^>]*\bname=(['"])generator\1[^>]*\/?\s*>/gi, (tag) => (/Webflow/i.test(tag) ? '' : tag));
  out = out.replace(/<meta\b[^>]*\bcontent=(['"])Webflow\1[^>]*\/?\s*>/gi, (tag) => (/generator/i.test(tag) ? '' : tag));
  out = out.replace(/\s+data-wf-(?:domain|page|site)=(['"])[^'"]*\1/gi, '');
  out = out.replace(/<link\b[^>]*\bhref=(['"])https:\/\/cdn\.prod\.website-files\.com\/img\/favicon\.ico(?:\?[^'"]*)?\1[^>]*\/?\s*>/gi, '');
  out = out.replace(/<script\b[^>]*>\s*!function\(o,c\)\{var n=c\.documentElement,t=" w-mod-";[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script\b[^>]*\bsrc=(['"])https:\/\/d3e54v103j8qbb\.cloudfront\.net\/js\/jquery[^'"]*\1[^>]*>\s*<\/script>/gi, '');
  out = out.replace(/<script\b[^>]*\bsrc=(['"])https:\/\/cdn\.prod\.website-files\.com\/[^'"]*\/js\/webflow[^'"]*\1[^>]*>\s*<\/script>/gi, '');
  /* Leftover Studio/Desk claim in a CSS comment crawlers still read. */
  out = out.replace(/\/\*\s*Home first paint is Buy \$dasha\. DashaNav stays on lobby\/studio\/desk\.\s*\*\//g, '');
  /* Leftover 2020 portfolio CSS lecture still serializes in live <style>. Repair rules stay. */
  out = stripHomePortfolioLecture(out);
  /* Leftover .dasha-nav hide CSS still serializes after nav DOM-strip. Repair h1/h2 stay. Watch belt stays. */
  out = stripHomeDashaNavHideCss(out);
  /* Leftover #dasha-home #tool label repair CSS after #tool DOM-strip. Repair h1/h2 stay. Watch belt stays. */
  out = stripHomeLeftoverToolLabelCss(out);
  /* Leftover skip-link/footer/.compute/.poster/.navlinks/.nav/.brand/.login-link/.mint-lede/.actions/.door-actions/.copy-link CSS still serializes after those nodes were DOM-stripped. Repair h1/label stay. Watch belt stays. Product skip-links stay. Do not strip .pill. Keep .copy. */
  out = stripHomeDroppedSelectorCss(out);
  /* Leftover CSS lecture (Make/Play/Buy, motion, sparkline) still serializes in live <style>. @view-transition stays. Watch belt stays. */
  out = stripHomeCssLecture(out);
  /* Leftover home dropped-selector CSS after <h3> was never in the home DOM. Keep .dasha h1,.dasha h2. */
  out = stripHomeLeftoverDashaH3Css(out);
  /* Leftover home dropped-selector CSS after sparkline lecture comments were already stripped. Keep #spark-fill. Watch #spark hide stays. */
  out = stripHomeLeftoverSparkLineCss(out);
  /* Leftover home dropped-selector CSS after leftover #spark-line CSS was already stripped. Keep @keyframes dasha-draw. Watch #spark hide stays. */
  out = stripHomeLeftoverSparkFillCss(out);
  /* Leftover home unused @keyframes dasha-draw after leftover #spark-fill CSS was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. */
  out = stripHomeLeftoverDashaDrawKeyframes(out);
  /* Leftover home unused .spark CSS after leftover @keyframes dasha-draw was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverSparkClassCss(out);
  /* Leftover home unused .price-note CSS after leftover .spark CSS was already stripped. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceNoteCss(out);
  /* Leftover home unused @media(max-width:600px) .price spark/note grid after leftover .price-note CSS was already stripped. Keep parent .price grid-template-areas. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceSparkNoteMediaCss(out);
  /* Leftover home unused parent .price grid-template-areas after leftover @media spark/note grid was already stripped. Keep .price{ remount belt. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceGridTemplateAreasCss(out);
  /* Leftover home unused parent .price display:grid layout after leftover parent grid-template-areas was already stripped. Keep Watch chrome-hide .price hide list. Keep .price[hidden]. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceDisplayGridCss(out);
  /* Leftover home unused .price[hidden] after leftover parent .price display:grid layout was already stripped. Keep Watch chrome-hide .price hide list. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceHiddenCss(out);
  /* Leftover home unused .price-main layout after leftover .price[hidden] was already stripped. Keep Watch chrome-hide .price-main hide list. Keep .price-now / .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceMainCss(out);
  /* Leftover home unused .price-now type after leftover .price-main layout was already stripped. Keep Watch chrome-hide .price-now hide list. Keep .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceNowCss(out);
  /* Leftover standalone @view-transition <style> after product CSS already serializes the same rules. Product @view-transition stays. */
  out = stripHomeLeftoverDupViewTransitionCss(out);
  /* Leftover chess-copy / DashaHomeChess JS after chess-door DOM-strip. Mint COPY stays. */
  out = stripHomeChessCopy(out);
  /* Leftover lang boot JS after ensureHtmlLang. html lang stays. */
  out = stripHomeLangScript(out);
  /* Leftover window.Webflow.push after webflow.js DOM-strip. Digest remount stays. */
  out = stripHomeWebflowPush(out);
  /* Leftover #simp hash / quiz / challenge client redirect after #simp-door. Quiz door stays. */
  out = stripHomeSimpHashRedirect(out);
  /* Leftover Webflow body class after product body CSS. johns-awesome stays. */
  out = stripHomeLeftoverBodyClass(out);
  /* Leftover Webflow dasha-root class after product #dasha-home. johns-awesome stays. */
  out = stripHomeLeftoverDashaRootClass(out);
  /* Leftover Webflow skip target id="content" after skip-link DOM-strip. Privacy #dasha-page stays. */
  out = stripHomeLeftoverContentId(out);
  /* Leftover Webflow contract id="token" after CSS/JS strip. #mint + .copy stay. */
  out = stripHomeLeftoverTokenId(out);
  /* Leftover home class="dasha-home-lede" after CSS/JS strip. Keep #dasha-home-lede. */
  out = stripHomeLeftoverDashaHomeLedeClass(out);
  /* Leftover home class="buy-dasha" after CSS/JS strip. Keep .pill.primary. Lobby/chess/simp .buy-dasha stay. */
  out = stripHomeLeftoverBuyDashaClass(out);
  /* Leftover HTML comments crawlers still read after style/script strip. Per-comment so cherries SVG between comments stays. */
  out = out.replace(/<!--[\s\S]*?-->/g, (c) => (
    /RETIRED product'?s mark/i.test(c)
    || /Do not reintroduce a page-level icon/i.test(c)
    || /Dasha site icon:\s*slot-machine cherries/i.test(c)
    || /Cross-document view transitions/i.test(c)
    || /Dasha canonical URL/i.test(c)
      ? ''
      : c
  ));
  /* Leftover Webflow Commerce after boot strip. jquery/webflow.js gone; currency settings still paint. Per-script. */
  out = out.replace(/<script\b[^>]*>\s*window\.__WEBFLOW_CURRENCY_SETTINGS\s*=[\s\S]*?<\/script>/gi, '');
  /* Leftover Sign in menu / leftover hamburger w-embed after boot strip. Product CSS embed stays, leftover wrapper unwrapped. */
  out = stripHomeLeftoverSigninMenu(out);
  out = unwrapHomeProductWembed(out);
  return out;
}

function rewriteAllTagged(html, tag, rewriteEl) {
  const src = String(html || '');
  const openRe = new RegExp('<' + tag + '\\b[^>]*>', 'i');
  const m = openRe.exec(src);
  if (!m) return src;
  if (/\/>$/.test(m[0])) {
    return src.slice(0, m.index + m[0].length) + rewriteAllTagged(src.slice(m.index + m[0].length), tag, rewriteEl);
  }
  let depth = 1;
  const re = new RegExp('<' + tag + '\\b[^>]*>|<\\/' + tag + '>', 'gi');
  re.lastIndex = m.index + m[0].length;
  let t;
  let end = -1;
  while ((t = re.exec(src))) {
    if (t[0].startsWith('</')) depth -= 1;
    else if (!/\/>$/.test(t[0])) depth += 1;
    if (depth === 0) {
      end = t.index + t[0].length;
      break;
    }
  }
  if (end < 0) return src;
  const next = rewriteEl(src.slice(m.index, end));
  return src.slice(0, m.index) + next + rewriteAllTagged(src.slice(end), tag, rewriteEl);
}

const MENU_FOOTER_SIMP_A = /<a\b(?=[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/simp(?:[/?#][^'"]*)?\1)[^>]*>[\s\S]*?<\/a>/gi;

/** Potter lock: Simp out of Menu/footer. Quiz door #simp-door stays. */
export function stripSimpFromMenuAndFooter(html) {
  let out = String(html || '');
  const drop = (el) => {
    MENU_FOOTER_SIMP_A.lastIndex = 0;
    return el.replace(MENU_FOOTER_SIMP_A, '');
  };
  out = rewriteAllTagged(out, 'nav', drop);
  out = rewriteAllTagged(out, 'footer', drop);
  return out;
}

/** Leftover footer products. Studio/Desk/Verse/Learn/Forum are not doors. Collapse empty · holes. */
const LEFTOVER_PRODUCT_FOOTER_A = /<a\b(?=[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.|lobby\.)?getdasha\.com)?\/(?:forum|studio|desk|verse|learn|dasha)\/?(?:[?#][^'"]*)?\1)[^>]*>[\s\S]*?<\/a>/gi;

function collapseFooterDots(el) {
  return String(el || '')
    .replace(/\s*·(?:\s*·)+/g, ' · ')
    .replace(/(<(?:p|div|nav)[^>]*>)\s*·\s*/gi, '$1')
    .replace(/\s*·\s*(<\/(?:p|div|nav)>)/gi, '$1');
}

export function stripLeftoverProductFooter(html) {
  const drop = (el) => {
    LEFTOVER_PRODUCT_FOOTER_A.lastIndex = 0;
    return collapseFooterDots(el.replace(LEFTOVER_PRODUCT_FOOTER_A, ''));
  };
  return rewriteAllTagged(String(html || ''), 'footer', drop);
}

/** Walk one class="poster" div (not poster-grid / poster-tile). Nested <div> depth, not a regex to </div>. */
function dropClassedDiv(html, className) {
  return dropClassedTag(html, 'div', className);
}


/** Walk one id="price" (any tag). Nested same-tag depth, not a regex to the first close. */
function dropIdedElement(html, id) {
  const src = String(html || '');
  const openRe = new RegExp(
    '<([a-zA-Z][\\w-]*)\\b(?=[^>]*\\bid=([\'"])' + id + '\\2)[^>]*>',
    'i',
  );
  const m = openRe.exec(src);
  if (!m) return src;
  const tag = m[1];
  if (/\/>$/.test(m[0]) || /^(br|img|input|meta|link|hr|source|area|col|embed|wbr)$/i.test(tag)) {
    return src.slice(0, m.index) + src.slice(m.index + m[0].length);
  }
  let depth = 1;
  const re = new RegExp('<' + tag + '\\b[^>]*>|<\\/' + tag + '>', 'gi');
  re.lastIndex = m.index + m[0].length;
  let t;
  while ((t = re.exec(src))) {
    if (t[0].startsWith('</')) depth -= 1;
    else if (!/\/>$/.test(t[0])) depth += 1;
    if (depth === 0) return src.slice(0, m.index) + src.slice(t.index + t[0].length);
  }
  return src;
}

/** Leftover empty #dasha-jup Jupiter plugin mount. Crawlers still see it after style/script strip. Buy sheet + jup.ag stay. */
export function stripChessJupPluginMount(html) {
  let out = String(html || '');
  for (let n = 0; n < 4; n += 1) {
    const next = dropIdedElement(out, 'dasha-jup');
    if (next === out) break;
    out = next;
  }
  out = out.replace(/;--jupiter-plugin-[A-Za-z]+:[^;}"']+/g, '');
  out = out.replace(/#dasha-jup\[hidden\]\{[^}]*\}/g, '');
  out = out.replace(/#dasha-jup\{[^}]*\}/g, '');
  return out;
}

/** Leftover Jupiter plugin boot JS after empty #dasha-jup DOM-strip. Humans see Jupiter.init in view-source. Buy sheet + jup.ag + function jup() stay. */
export function stripChessJupPluginBoot(html) {
  let out = String(html || '');
  out = out.replace("function hideJup(){var box=$('dasha-jup');if(box)box.hidden=true}", '');
  out = out.replace("function jupAmt(){var n=Number(amount);if(!(n>0)||!isFinite(n))return'';var d=input==='usdc'?6:9;var u=Math.round(n*Math.pow(10,d));return u>0?String(u):''}", '');
  out = out.replace("function bootJup(){var box=$('dasha-jup');if(!box)return;if(!window.Jupiter||!window.Jupiter.init){hideJup();return}var units=jupAmt();if(!units){hideJup();return}try{if(window.Jupiter.close)window.Jupiter.close();box.hidden=false;box.textContent='';window.Jupiter.init({displayMode:'integrated',integratedTargetId:'dasha-jup',formProps:{initialInputMint:input==='usdc'?USDC:WSOL,initialOutputMint:MINT,fixedMint:MINT,initialAmount:units},onSuccess:function(){flashBought()}})}catch(e){hideJup()}}", '');
  out = out.replace("if(document.readyState==='complete')bootJup();else booted=true", '');
  out = out.replace("if(document.readyState==='complete'){if(booted||($('buy-sheet')&&!$('buy-sheet').hidden))bootJup()}else window.addEventListener('load',function(){if(booted||($('buy-sheet')&&!$('buy-sheet').hidden))bootJup()})", '');
  out = out.replace('var booted=false;', '');
  return out;
}

/** Leftover bootJup() call after plugin boot functions were already dropped. Humans still see it in view-source. Buy sheet + function jup() stay. */
export function stripChessJupPluginBootCall(html) {
  let out = String(html || '');
  out = out.replace("if(!$('buy-sheet')||$('buy-sheet').hidden)return;bootJup()", '');
  return out;
}

/** Leftover empty CSS-hidden #dasha-mint-tape on /lobby. Crawlers still see it after style/script strip. #dasha-forum / #forum-play-go / /forum/tape stay. */
export function stripLobbyMintTapeMount(html) {
  let out = String(html || '');
  for (let n = 0; n < 4; n += 1) {
    const next = dropIdedElement(out, 'dasha-mint-tape');
    if (next === out) break;
    out = next;
  }
  out = out.replace(/#dasha-mint-tape\{[^}]*\}/g, '');
  return out;
}

/** Hide/remove first-paint Studio CTAs. Per-<a> and per-script only. Keep Buy. */
export function stripHomeStudioFirstPaint(html) {
  let out = dropScriptIf(String(html || ''), (block) =>
    /querySelectorAll\([^)]*\/studio/i.test(block)
    || /href=["']\/studio#["']\s*\+/.test(block)
    || /const href=["']\/studio#["']/.test(block)
    || /lobby\.getdasha\.com\/price/.test(block)
    || /fetch\s*\(\s*['"][^'"]*\/price['"]/.test(block)
    || /el\(['"]price-now['"]\)/.test(block)
    || /getElementById\(['"]price-now['"]\)/.test(block)
    || /id=["']price-now["']/.test(block)
    || (/box\.hidden\s*=\s*false/.test(block) && /price/.test(block))
    || (/createElement\(['"]span['"]\)/.test(block) && /id=['"]price['"]/.test(block) && /priceBox/.test(block)),
  );
  out = out.replace(
    /<a\b(?=[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/studio(?:[/?#][^'"]*)?\1)[^>]*>[\s\S]*?<\/a>/gi,
    '',
  );
  for (const cls of ['poster', 'price', 'ticker']) {
    for (let n = 0; n < 8; n += 1) {
      const next = dropClassedDiv(out, cls);
      if (next === out) break;
      out = next;
    }
  }
  for (let n = 0; n < 4; n += 1) {
    const next = dropIdedElement(out, 'price');
    if (next === out) break;
    out = next;
  }
  return out;
}


const FAUCET_STILL_SRI = 'sha384-gBA7pSgRRjXqzLiv5Efw8XzPjimgMxeDt3R1sP8svmrzZnjXd4ZgZmLlhR3gG41Z';
const HOME_LEDE = `<p id="dasha-home-lede" class="dasha-home-lede">dash_eats culture. Match the mint.</p>`;
const HOME_CHAT_DOOR = `<section id="chat-door" aria-labelledby="chat-title"><div class="wrap door"><div><p class="section-kicker">Lobby</p><h2 class="section-title" id="chat-title">Chat.</h2><p class="door-line">Chat in the lobby.</p></div><a class="pill primary" href="/lobby">Open chat →</a></div></section>`;
const HOME_SIMP_DOOR = `<section id="simp-door" aria-labelledby="simp-title"><div class="wrap door"><div><p class="section-kicker">Simp Quiz</p><h2 class="section-title" id="simp-title">Simp Quiz.</h2><p class="door-line">Take the quiz.</p></div><a class="pill primary" href="/simp">Take the quiz</a></div></section>`;
const HOME_BAG_LINE = `<p class="dasha-bag-line"><a href="/bag">Bag</a></p>`;
const HOME_GRWM_AIR = '<style id="dasha-grwm-air">#grwm{display:block;margin:0;padding:min(18vh,8rem) 0 min(14vh,6rem);box-sizing:border-box}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm{padding:min(10vh,4rem) 0 min(8vh,3rem)}#grwm .grwm-phone{max-height:min(52svh,420px);width:min(100%,calc(52svh * 720 / 1280))}}</style>';
const HOME_GROK_DOOR = `<section id="grok-door" aria-labelledby="grok-title"><style id="dasha-siwg">.siwg{display:flex;align-items:center;justify-content:center;gap:12px;min-height:56px;padding:0 20px;border:0;border-radius:999px;background:linear-gradient(90deg,#7c3aed,#22d3ee);color:#fff;font:900 15px/1 Arial,Helvetica,sans-serif;letter-spacing:.02em;text-decoration:none;cursor:pointer;box-shadow:0 0 22px rgba(124,58,237,.55),0 0 28px rgba(34,211,238,.4)}.siwg .siwg-icon{width:28px;height:28px;flex:0 0 28px;display:block;border-radius:6px}.siwg:focus-visible{outline:3px solid #f4eddb;outline-offset:3px}#grok-door{margin:0;padding:36px 0 56px;background:#070608}#grok-door .door{display:grid;gap:16px;justify-items:start}#grok-door .siwg-credit{margin:4px 0 0;font:700 13px/1.3 Arial,Helvetica,sans-serif}#grok-door .siwg-credit a{color:rgba(244,237,219,.72);text-decoration:underline;text-underline-offset:3px}</style><div class="wrap door"><div><p class="section-kicker">Grok Bot</p><h2 class="section-title" id="grok-title">Sign in with Grok Bot.</h2></div><a class="siwg" data-grok-login href="/login#grok"><svg class="siwg-icon" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="#111"/><path d="M5 24V16.2C5 10.8 9 6.6 14 6.6s9 4.2 9 9.6V24Z" fill="#fff"/><ellipse cx="10.8" cy="15.4" rx="1.9" ry="2.7" transform="rotate(-22 10.8 15.4)" fill="#1a1224"/><ellipse cx="17.2" cy="15.4" rx="1.9" ry="2.7" transform="rotate(22 17.2 15.4)" fill="#1a1224"/></svg>Sign in with Grok Bot</a><p class="siwg-credit"><a href="https://x.com/RayFernando1337/status/2092696487637737929">Ray Fernando</a></p></div></section>`;
export const SIWG_BUTTON_HTML = `<a class="siwg" data-grok-login href="/login#grok"><svg class="siwg-icon" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="#111"/><path d="M5 24V16.2C5 10.8 9 6.6 14 6.6s9 4.2 9 9.6V24Z" fill="#fff"/><ellipse cx="10.8" cy="15.4" rx="1.9" ry="2.7" transform="rotate(-22 10.8 15.4)" fill="#1a1224"/><ellipse cx="17.2" cy="15.4" rx="1.9" ry="2.7" transform="rotate(22 17.2 15.4)" fill="#1a1224"/></svg>Sign in with Grok Bot</a>`;
const HOME_FAUCET_MOUNT = `<section id="dasha-home-faucet" aria-label="Faucet"><div id="dasha-faucet" data-faucet-api="https://lobby.getdasha.com" data-faucet-still="https://lobby.getdasha.com/client/faucet.avif" data-faucet-still-sri="${FAUCET_STILL_SRI}"></div></section>`;
const HOME_FAUCET_STYLE = '<style id="dasha-home-faucet-css">#dasha-home-faucet,#dasha-faucet{width:min(36rem,calc(100% - 32px));margin:28px auto 64px}#dasha-home-lede{width:min(40rem,calc(100% - 32px));margin:18px auto 8px;color:var(--paper,#f4eddb);font:900 1.05rem/1.35 Arial,Helvetica,sans-serif}.dasha-bag-line{margin:.6rem 0 0;font:800 .95rem/1.3 Arial,Helvetica,sans-serif}.dasha-bag-line a{color:var(--paper,#f4eddb)}</style>';
const FAUCET_SCRIPT = `<script src="https://lobby.getdasha.com/client/faucet.js" integrity="${FAUCET_CLIENT_SRI}" crossorigin="anonymous" defer></script>`;

/** Leftover home style id="dasha-home-play" after Play was never on home. Humans see it in view-source. Faucet CSS + HOME_FAUCET_MOUNT stay. GRWM + Watch belt stay. Distinct leftover vs #dasha-chess iframe CSS. */
export function stripHomePlayStyleId(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  if (/<style\b[^>]*id=["']dasha-home-play["']/i.test(out)) {
    out = out.replace(/<style\b[^>]*id=["']dasha-home-play["'][^>]*>[\s\S]*?<\/style>/i, HOME_FAUCET_STYLE);
  }
  return out;
}

/** Leftover home chess-copy JS after chess-door / #chess-copy DOM-strip. Humans see DashaHomeChess + chess-copy in view-source. Mint COPY + DashaHomeMint stay. Chess product page stays. GRWM + Watch belt stay. Distinct leftover vs #dasha-chess iframe CSS. Home only. */
export function stripHomeChessCopy(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return full;
    if (!/chess-copy/.test(body) && !/DashaHomeChess/.test(body)) return full;
    let s = body;
    s = s.replace(/const CHESS=['"][^'"]+['"];/g, '');
    s = s.replace(/function linkCopiedOk\([^)]*\)\{[^}]*\}/g, '');
    s = s.replace(/const c=document\.getElementById\(['"]chess-copy['"]\);c\?\.addEventListener\(['"]click['"],async\(\)=>\{[\s\S]*?setTimeout\(\(\)=>c\.textContent=label,1800\)\}\);/g, '');
    s = s.replace(/;?window\.DashaHomeChess=\{[^}]*\}/g, '');
    return `<script${attrs}>${s}</script>`;
  });
}


/** Leftover home Webflow.push JS after webflow.js DOM-strip. Humans see window.Webflow.push in view-source. Digest remount + /digest.json stay. Mint COPY + DashaHomeMint stay. GRWM + Watch belt stay. Home only. */
export function stripHomeWebflowPush(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return full;
    if (!/window\.Webflow/.test(body)) return full;
    let s = body;
    s = s.replace(/if\(window\.Webflow&&typeof window\.Webflow\.push==='function'\)window\.Webflow\.push\(go\);\s*else go\(\);/g, 'go();');
    return `<script${attrs}>${s}</script>`;
  });
}



/** Leftover home Webflow body class after product body CSS. Humans still see class="body" paint johns-awesome .body (slate/purple, Schibsted, margin-top:-13px) after style/script strip. Product body CSS + johns-awesome stay. GRWM + Watch belt stay. Home only. */
export function stripHomeLeftoverBodyClass(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<body\b([^>]*)>/i, (full, attrs) => {
    if (!/\bclass\s*=/.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\sclass=(['"])([^'"]*)\1/i, (_, q, val) => {
      const next = String(val).split(/\s+/).filter((c) => c && c !== 'body');
      return next.length ? (' class=' + q + next.join(' ') + q) : '';
    });
    return '<body' + nextAttrs + '>';
  });
}

/** Leftover home dropped-selector CSS after leftover body class was already DOM-stripped
 * (live <body> has no class="body"). Humans see leftover body.body in view-source.
 * Distinct leftover vs leftover Webflow body class. Keep body,.dasha,.dasha-root,main,#dasha-home,#top.
 * Mobile-scroll + GRWM phone stay. johns-awesome stays. Watch belt stays. Home only.
 * Do not eat body{ or .dasha. Do not strip .dasha-root unlock.
 */
export function stripHomeLeftoverBodyBodyCss(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/<body\b[^>]*\bclass=["'][^"']*\bbody\b/.test(visible)) return out;
  return out
    .replace(/body\.body\s*,\s*/g, '')
    .replace(/,\s*body\.body(?=\s*[{,])/g, '');
}

/** Leftover home Webflow dasha-root class after product #dasha-home + .dasha CSS. Humans still see class="dasha-root" paint johns-awesome .dasha-root{min-height:100vh} after style/script strip. Product #dasha-home + johns-awesome stay. GRWM + Watch belt stay. Home only. */
export function stripHomeLeftoverDashaRootClass(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bclass\s*=/.test(attrs)) return full;
    if (!/\bdasha-root\b/.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\sclass=(['"])([^'"]*)\1/i, (_, q, val) => {
      const next = String(val).split(/\s+/).filter((c) => c && c !== 'dasha-root');
      return next.length ? (' class=' + q + next.join(' ') + q) : '';
    });
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover home Webflow skip target id="content" after skip-link DOM-strip. Home has no skip-link to #content; privacy uses #dasha-page. Product #dasha-home + #top stay. Home only. */
export function stripHomeLeftoverContentId(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])content\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])content\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover home Webflow contract id="token" after CSS/JS strip. JS never reads getElementById('token');
 * CSS never targets #token (mint COPY is #mint + .copy / DashaHomeMint). Humans see it in view-source.
 * Distinct leftover vs leftover id="content". Keep #mint + .copy. Keep Chart. Product #dasha-home + #top stay. Home only.
 */
export function stripHomeLeftoverTokenId(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])token\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])token\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover home class="dasha-home-lede" after CSS/JS strip. CSS never targets .dasha-home-lede
 * (lede paints via #dasha-home-lede). Inline JS never reads querySelector('.dasha-home-lede').
 * Humans see it in view-source. Distinct leftover vs leftover class="dasha-quiz" / leftover class="dasha-root".
 * Keep #dasha-home-lede + culture/mint line. Keep #chat-door + #simp-door. Home only.
 * Do not eat #dasha-home-lede.
 */
export function stripHomeLeftoverDashaHomeLedeClass(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out) || /id=["']dasha-home-lede["']/.test(out);
  if (!home) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bclass\s*=/.test(attrs)) return full;
    if (!/\bdasha-home-lede\b/.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\sclass=(['"])([^'"]*)\1/i, (_, q, val) => {
      const next = String(val).split(/\s+/).filter((c) => c && c !== 'dasha-home-lede');
      return next.length ? (' class=' + q + next.join(' ') + q) : '';
    });
    return '<' + tag + nextAttrs + '>';
  });
}




/** Leftover home class="buy-dasha" after CSS/JS strip. CSS never targets .buy-dasha
 * (contract Buy paints via .pill.primary). Inline JS never reads querySelector('.buy-dasha').
 * Humans see it in view-source. Distinct leftover vs leftover class="dasha-home-lede" /
 * leftover class="dasha-root". Keep .pill.primary + Buy $dasha ↗ + jup.ag + #mint + .copy.
 * Lobby/chess/simp .buy-dasha stay (those pages CSS-paint the slim header). Home only.
 * Do not eat .pill.
 */
export function stripHomeLeftoverBuyDashaClass(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out) || /id=["']dasha-home-lede["']/.test(out);
  if (!home) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bclass\s*=/.test(attrs)) return full;
    if (!/\bbuy-dasha\b/.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\sclass=(['"])([^'"]*)\1/i, (_, q, val) => {
      const next = String(val).split(/\s+/).filter((c) => c && c !== 'buy-dasha');
      return next.length ? (' class=' + q + next.join(' ') + q) : '';
    });
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover home #simp hash / quiz / challenge client redirect JS after #simp-door + edge /quiz 308 + /?challenge 308. Humans see location.hash==='#simp' in view-source. Quiz #simp-door stays. Mint COPY + DashaHomeMint stay. GRWM + Watch belt stay. Home only. */
export function stripHomeSimpHashRedirect(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return full;
    const s = String(body);
    if (!/location\.hash\s*===\s*['"]#simp['"]/.test(s)) return full;
    if (!/q\.has\(['"]quiz['"]\)/.test(s)) return full;
    if (!/location\.replace\(\s*['"]\/simp/.test(s)) return full;
    return '';
  });
}

/** Leftover home lang boot JS after ensureHtmlLang already sets <html lang="en">. Humans see document.documentElement.lang ||= 'en' in view-source. Mint COPY + DashaHomeMint stay. GRWM + Watch belt stay. Home only. */
export function stripHomeLangScript(html) {
  let out = String(html || '');
  const home = /id=["']dasha-home["']/.test(out) || /id=["']chat-door["']/.test(out);
  if (!home) return out;
  return out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return full;
    const s = String(body).trim();
    if (/^document\.documentElement\.lang\s*\|\|=\s*['"]en['"]\s*;?\s*$/.test(s)) return '';
    return full;
  });
}


function cutTagged(html, openRe) {
  const src = String(html || '');
  const m = openRe.exec(src);
  if (!m) return { html: src, cut: '' };
  const tag = (m[0].match(/^<([a-zA-Z][\w-]*)/) || [])[1] || 'section';
  const closeTok = `</${tag}>`;
  const close = src.toLowerCase().indexOf(closeTok, m.index + m[0].length);
  if (close < 0) return { html: src, cut: '' };
  const end = close + closeTok.length;
  return { html: src.slice(0, m.index) + src.slice(end), cut: src.slice(m.index, end) };
}

function cutIded(html, tag, id) {
  return cutTagged(
    html,
    new RegExp(`<${tag}\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i'),
  );
}

function pinFaucetScript(html) {
  let out = String(html || '');
  out = out.replace(/<script\b[^>]*\bsrc=["'][^"']*client\/faucet\.js["'][^>]*>\s*<\/script>/gi, '');
  out = out.replace(/<script\b[^>]*\bsrc=["'][^"']*client\/faucet\.js["'][^>]*\/?>/gi, '');
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${FAUCET_SCRIPT}</body>`);
  return out + FAUCET_SCRIPT;
}

function injectQuietBagLine(html) {
  let out = String(html || '');
  if (/class=["']dasha-bag-line["']/.test(out) || /id=["']dasha-bag-line["']/.test(out)) return out;
  if (/<button\b(?=[^>]*\bclass=["'][^"']*\bcopy\b)[^>]*>[\s\S]*?<\/button>/i.test(out)) {
    return out.replace(/(<button\b(?=[^>]*\bclass=["'][^"']*\bcopy\b)[^>]*>[\s\S]*?<\/button>)/i, `$1${HOME_BAG_LINE}`);
  }
  if (/id=["']token["']/.test(out)) {
    return out.replace(/(<section\b(?=[^>]*\bid=["']token["'])[^>]*>)/i, `$1${HOME_BAG_LINE}`);
  }
  if (/<\/main>/i.test(out)) return out.replace(/<\/main>/i, `${HOME_BAG_LINE}</main>`);
  return out + HOME_BAG_LINE;
}

export function orderHomeLongPage(html) {
  let out = String(html || '');
  const chat = cutIded(out, 'section', 'chat-door');
  out = chat.html;
  const simp = cutIded(out, 'section', 'simp-door');
  out = simp.html;
  const faucet = cutIded(out, 'section', 'dasha-home-faucet');
  out = faucet.html;
  out = stripHomePlayStyleId(out);
  const faucetCss = cutIded(out, 'style', 'dasha-home-faucet-css');
  out = faucetCss.html;
  const leftoverPlay = cutIded(out, 'style', 'dasha-home-play');
  out = leftoverPlay.html;
  const grwm = cutIded(out, 'section', 'grwm');
  out = grwm.html;
  const grokDoor = cutIded(out, 'section', 'grok-door');
  out = grokDoor.html;
  const bag = cutIded(out, 'section', 'bag-door');
  out = bag.html;
  const lede = /id=["']dasha-home-lede["']/.test(out) ? '' : HOME_LEDE;
  const chatBit = HOME_CHAT_DOOR;
  const simpBit = HOME_SIMP_DOOR;
  const faucetBit = faucet.cut || HOME_FAUCET_MOUNT;
  const styleBit = HOME_FAUCET_STYLE;
  const grwmBit = grwm.cut || '';
  const grokBit = grokDoor.cut || HOME_GROK_DOOR;
  const block = `${lede}${chatBit}${simpBit}${faucetBit}${styleBit}${grwmBit}${grokBit}`;
  const hero = /<header\b(?=[^>]*\bid=["']content["'])[^>]*>[\s\S]*?<\/header>/i.exec(out)
    || /<header\b(?=[^>]*\bclass=["'][^"']*\bdasha-hero\b)[^>]*>[\s\S]*?<\/header>/i.exec(out);
  if (hero) {
    const at = hero.index + hero[0].length;
    out = out.slice(0, at) + block + out.slice(at);
  } else if (/<\/main>/i.test(out)) {
    out = out.replace(/<\/main>/i, `${block}</main>`);
  } else {
    out += block;
  }
  return injectQuietBagLine(out);
}

/** Chat door after first paint. Faucet is the Typeform client. Chess stays off home. Never a /studio# regex. */
export function mountHomeChessAndFaucet(html) {
  let out = String(html || '');
  if (/id=["']chess-stage["']/.test(out)) {
    const stage = cutIded(out, 'section', 'chess-stage');
    out = stage.html;
  }
  if (/id=["']chess-door["']/.test(out)) {
    const door = cutIded(out, 'section', 'chess-door');
    out = door.html;
  }
  if (/id=["']compute-door["']/.test(out)) {
    const door = cutIded(out, 'section', 'compute-door');
    out = door.html;
  }
  if (/id=["']faucet-door["']/.test(out)) {
    const extra = cutIded(out, 'section', 'faucet-door');
    out = extra.html;
  }
  out = out.replace(
    /<a\b(?=[^>]*\bhref=(['"])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/chess(?:[/?#][^'"]*)?\1)[^>]*>\s*(?:Open chess|Play chess)[^<]*<\/a>/gi,
    '',
  );
  if (!/id=["']chat-door["']/.test(out)) {
    if (/<\/main>/i.test(out)) out = out.replace(/<\/main>/i, `${HOME_CHAT_DOOR}</main>`);
    else out += HOME_CHAT_DOOR;
  }
  if (/id=["']dasha-home-faucet["']/.test(out)) {
    const jar = cutIded(out, 'section', 'dasha-home-faucet');
    out = jar.html;
    out = /<\/main>/i.test(out) ? out.replace(/<\/main>/i, `${HOME_FAUCET_MOUNT}</main>`) : out + HOME_FAUCET_MOUNT;
  } else if (!/id=["']dasha-faucet["']/.test(out)) {
    out = /<\/main>/i.test(out) ? out.replace(/<\/main>/i, `${HOME_FAUCET_MOUNT}</main>`) : out + HOME_FAUCET_MOUNT;
  }
  out = stripHomePlayStyleId(out);
  if (!/id=["']dasha-home-faucet-css["']/.test(out)) {
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${HOME_FAUCET_STYLE}</head>`) : HOME_FAUCET_STYLE + out;
  }
  if (/id=["']dasha-grwm-air["']/.test(out)) {
    out = out.replace(/<style\b[^>]*id=["']dasha-grwm-air["'][^>]*>[\s\S]*?<\/style>/i, HOME_GRWM_AIR);
  } else {
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${HOME_GRWM_AIR}</head>`) : HOME_GRWM_AIR + out;
  }
  out = orderHomeLongPage(out);
  out = stripHomeChessCopy(out);
  out = stripHomeLangScript(out);
  out = stripHomeWebflowPush(out);
  out = stripHomeSimpHashRedirect(out);
  out = stripHomeLeftoverBodyClass(out);
  /* Leftover home dropped-selector CSS after leftover body class was already DOM-stripped. Keep body + .dasha + .dasha-root. */
  out = stripHomeLeftoverBodyBodyCss(out);
  /* Leftover home dropped-selector CSS after <h3> was never in the home DOM. Keep .dasha h1,.dasha h2. */
  out = stripHomeLeftoverDashaH3Css(out);
  /* Leftover home dropped-selector CSS after sparkline lecture comments were already stripped. Keep #spark-fill. Watch #spark hide stays. */
  out = stripHomeLeftoverSparkLineCss(out);
  /* Leftover home dropped-selector CSS after leftover #spark-line CSS was already stripped. Keep @keyframes dasha-draw. Watch #spark hide stays. */
  out = stripHomeLeftoverSparkFillCss(out);
  /* Leftover home unused @keyframes dasha-draw after leftover #spark-fill CSS was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. */
  out = stripHomeLeftoverDashaDrawKeyframes(out);
  /* Leftover home unused .spark CSS after leftover @keyframes dasha-draw was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverSparkClassCss(out);
  /* Leftover home unused .price-note CSS after leftover .spark CSS was already stripped. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceNoteCss(out);
  /* Leftover home unused @media(max-width:600px) .price spark/note grid after leftover .price-note CSS was already stripped. Keep parent .price grid-template-areas. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceSparkNoteMediaCss(out);
  /* Leftover home unused parent .price grid-template-areas after leftover @media spark/note grid was already stripped. Keep .price{ remount belt. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceGridTemplateAreasCss(out);
  /* Leftover home unused parent .price display:grid layout after leftover parent grid-template-areas was already stripped. Keep Watch chrome-hide .price hide list. Keep .price[hidden]. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceDisplayGridCss(out);
  /* Leftover home unused .price[hidden] after leftover parent .price display:grid layout was already stripped. Keep Watch chrome-hide .price hide list. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceHiddenCss(out);
  /* Leftover home unused .price-main layout after leftover .price[hidden] was already stripped. Keep Watch chrome-hide .price-main hide list. Keep .price-now / .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceMainCss(out);
  /* Leftover home unused .price-now type after leftover .price-main layout was already stripped. Keep Watch chrome-hide .price-now hide list. Keep .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceNowCss(out);
  out = stripHomeLeftoverDashaRootClass(out);
  out = stripHomeLeftoverContentId(out);
  out = stripHomeLeftoverTokenId(out);
  out = stripHomeLeftoverDashaHomeLedeClass(out);
  /* Leftover home class="buy-dasha" after CSS/JS strip. Keep .pill.primary. Lobby/chess/simp .buy-dasha stay. */
  out = stripHomeLeftoverBuyDashaClass(out);
  return pinFaucetScript(out);
}

/** /bag is the health page. Forum header is $dasha + Buy — drop header Bag. */
export function dropBagFromSlim(html) {
  return String(html || '').replace(
    /<header\b[^>]*\bdasha-slim\b[^>]*>[\s\S]*?<\/header>/gi,
    (header) => header.replace(
      /\s*<a\b(?=[^>]*\bhref=(['"])(?:\/bag|https:\/\/www\.getdasha\.com\/bag)\1)[^>]*>[\s\S]*?<\/a>/gi,
      '',
    ),
  );
}

/** Leftover home #dasha-mobile-scroll on /lobby after polishServedSlim always injected HOME GRWM CSS.
 * Humans see #grwm / #dasha-home in lobby view-source. Home mobile-scroll + GRWM stay.
 * Lobby .lobby-log + #dasha-chess stay. Distinct leftover vs home-only digest remount.
 */
export function isLobbyLeftoverHomeMobileScrollPage(html) {
  const src = String(html || '');
  if (/id=["']dasha-home["']/.test(src) || /id=["']chat-door["']/.test(src) || /id=["']grwm["']/.test(src)) return false;
  return /id=["']dasha-lobby["']/.test(src)
    || /id=["']forum-play-go["']/.test(src)
    || /id=["']dasha-forum["']/.test(src);
}

export function stripLobbyLeftoverHomeMobileScroll(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/gi, '');
}

/** Leftover home #dasha-mobile-scroll on /chess after polishServedSlim always injected HOME GRWM CSS.
 * Humans see #grwm / #dasha-home in chess view-source. Home mobile-scroll + GRWM stay.
 * Buy sheet + jup.ag + chess-local stay. Distinct leftover vs lobby home mobile-scroll.
 */
export function isChessLeftoverHomeMobileScrollPage(html) {
  const src = String(html || '');
  if (/id=["']dasha-home["']/.test(src) || /id=["']chat-door["']/.test(src) || /id=["']grwm["']/.test(src)) return false;
  if (isLobbyLeftoverHomeMobileScrollPage(src)) return false;
  return /id=["']chess-stage["']/.test(src)
    || /id=["']buy-sheet["']/.test(src)
    || /id=["']dasha-buy-sheet-boot["']/.test(src);
}

export function stripChessLeftoverHomeMobileScroll(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/gi, '');
}

/** Leftover /chess dropped-selector CSS after .privacy was never in the chess DOM
 * (no class="privacy"; JS never mounts it). Humans see it in view-source after CSS/JS strip
 * is not required — the rule is in live <style>. Distinct leftover vs leftover home
 * #dasha-mobile-scroll on /chess. Keep .empty + .identity. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Do not eat /privacy product skip-link.
 */
export function stripChessLeftoverPrivacyCss(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/\.privacy\s*\{[^}]*\}/gi, '');
}

/** Leftover /chess dropped-selector CSS after .dasha-quiet was never in the chess DOM
 * (slim header is .dasha-word + .buy-dasha; JS never mounts dasha-quiet). Humans see it in view-source.
 * Distinct leftover vs leftover .privacy / leftover home #dasha-mobile-scroll on /chess.
 * Keep .dasha-slim + .dasha-word + .buy-dasha. Keep .empty + .identity. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Lobby leftover .dasha-quiet CSS is a separate leftover (stripLobbyLeftoverDashaQuietCss).
 */
export function stripChessLeftoverDashaQuietCss(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/\.dasha-slim\s+a\.dasha-quiet\s*\{[^}]*\}/gi, '');
}

/** Leftover /chess dropped-selector CSS after .panel was never in the chess DOM
 * (shell is .app + .gate; JS never mounts class="panel"). Humans see it in view-source.
 * Distinct leftover vs leftover .dasha-quiet / leftover .privacy / leftover home
 * #dasha-mobile-scroll on /chess. Keep .app + .gate. Keep .empty + .identity.
 * Keep .dasha-slim + .dasha-word + .buy-dasha. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Do not eat compute .panel-head.
 */
export function stripChessLeftoverPanelCss(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/\.panel\s*\{[^}]*\}/gi, '');
}

/** Leftover /chess id="gate-actions" after CSS/JS strip. JS never reads getElementById('gate-actions');
 * CSS never targets #gate-actions (Play chrome is class="gate-actions" + id="gate-action"). Humans see it in view-source.
 * Distinct leftover vs leftover .panel / leftover .dasha-quiet / leftover .privacy.
 * Keep class="gate-actions". Keep #gate-action. Keep .app + .gate. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Do not eat #gate-action.
 */
export function stripChessLeftoverGateActionsId(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])gate-actions\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])gate-actions\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover /chess id="buy-share-tg" after CSS/JS strip. JS never reads getElementById('buy-share-tg');
 * CSS never targets #buy-share-tg (share flash is #buy-share-x + a TG href). Humans see it in view-source.
 * Distinct leftover vs leftover id="gate-actions" / leftover .panel / leftover .dasha-quiet / leftover .privacy.
 * Keep the TG link. Keep #buy-share-x. Keep #buy-sheet + #buy-mint + jup.ag + chess-local.
 * Chess only. Do not eat #buy-share-x.
 */
export function stripChessLeftoverBuyShareTgId(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])buy-share-tg\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])buy-share-tg\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover /chess id="buy-sheet-fallback" after CSS/JS strip. JS never reads getElementById('buy-sheet-fallback');
 * CSS never targets #buy-sheet-fallback (mint COPY is #buy-mint inside the buy sheet). Humans see it in view-source.
 * Distinct leftover vs leftover id="buy-share-tg" / leftover id="gate-actions".
 * Keep #buy-sheet + #buy-mint + #buy-share-x + TG href + jup.ag + chess-local.
 * Chess only. Do not eat #buy-mint.
 */
export function stripChessLeftoverBuySheetFallbackId(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])buy-sheet-fallback\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])buy-sheet-fallback\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover /chess id="leaders-panel" after CSS/JS strip. JS never reads getElementById('leaders-panel');
 * CSS never targets #leaders-panel (Top table is class="leaders" + id="leaders"). Humans see it in view-source.
 * Distinct leftover vs leftover id="buy-sheet-fallback" / leftover id="buy-share-tg" / leftover id="gate-actions".
 * Keep class="leaders". Keep #leaders. Keep .app + .gate. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Do not eat #leaders.
 */
export function stripChessLeftoverLeadersPanelId(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])leaders-panel\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])leaders-panel\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover /chess id="recent-panel" after leftover unused JS loadLeaders was already stripped
 * (JS never reads getElementById('recent-panel'); CSS never targets #recent-panel; recent games
 * list is class="recent" + id="recent"). Humans see leftover id=recent-panel in view-source.
 * Distinct leftover vs leftover id="leaders-panel" / leftover unused JS loadLeaders.
 * Keep class="recent" + #recent. Keep class="leaders" + #leaders. Keep .app + .gate.
 * Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Keep function tournamentAction(action,name) + tournamentAction('create'.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not eat #recent. Do not restore loadLeaders.
 */
export function stripChessLeftoverRecentPanelId(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  if (/\b(?:getElementById\(|\$\()\s*(['"])recent-panel\1/.test(out)) return out;
  if (/function\s+loadLeaders\s*\(/.test(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])recent-panel\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])recent-panel\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover /chess id="promotion-title" after CSS/JS strip. JS never reads getElementById('promotion-title');
 * CSS never targets #promotion-title (dialog is class="promotion" + id="promotion"; title paints via .promotion p).
 * aria-labelledby="promotion-title" only pointed at that unused id (dangling after id drop) so it drops with the id.
 * Humans see leftover id=promotion-title in view-source.
 * Distinct leftover vs leftover id="recent-panel" / leftover id="leaders-panel".
 * Keep class="promotion" + #promotion + .promotion p + Promote to copy.
 * Keep id=tc-3 + id=tc-5 + id=tc-10 (JS binds via $('tc-'+n), not .tc only).
 * Keep class="recent" + #recent. Keep class="leaders" + #leaders.
 * Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Keep function tournamentAction(action,name) + tournamentAction('create'.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not eat #promotion. Do not restore recent-panel.
 */
export function stripChessLeftoverPromotionTitleId(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  if (/(?:getElementById\(|\$\()\s*(['"])promotion-title\1/.test(out)) return out;
  if (/querySelector(All)?\(\s*(['"])#promotion-title\2/.test(out)) return out;
  if (/#promotion-title\b/.test(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    let nextAttrs = attrs;
    if (/\bid\s*=\s*(['"])promotion-title\1/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\s\bid=(['"])promotion-title\1/i, '');
    }
    if (/\baria-labelledby\s*=\s*(['"])promotion-title\1/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\s\baria-labelledby=(['"])promotion-title\1/i, '');
    }
    if (nextAttrs === attrs) return full;
    return '<' + tag + nextAttrs + '>';
  });
}



/** Leftover /chess dropped-selector CSS after footer.dasha-foot <nav> was already DOM-stripped
 * (footer is <p> $dasha · Buy · Chess · Bag · Telegram). Humans see footer.dasha-foot nav in view-source.
 * Distinct leftover vs leftover id="leaders-panel" / leftover .panel / leftover lobby footer.dasha-foot nav.
 * footer.dasha-foot + footer.dasha-foot a + footer.dasha-foot .buy-dasha stay.
 * Keep .app + .gate. Keep .dasha-slim + .dasha-word + .buy-dasha. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Lobby leftover footer.dasha-foot nav is a separate leftover (stripLobbyLeftoverDashaFootNavCss).
 * Do not eat footer.dasha-foot. Do not strip if footer still has <nav>.
 */
export function stripChessLeftoverDashaFootNavCss(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const footer = visible.match(/<footer\b[^>]*class=["'][^"']*\bdasha-foot\b[^>]*>[\s\S]*?<\/footer>/i);
  if (footer && /<nav\b/i.test(footer[0])) return out;
  return out.replace(/footer\.dasha-foot nav\s*\{[^}]*\}/gi, '');
}

/** Leftover /chess JS comment watch:true after watchingGame() already inlines g.watch===true.
 * Humans see leftover watch:true comment in view-source. Distinct leftover vs leftover footer.dasha-foot nav
 * / leftover Invite / 1v1 comment (separate leftover). Keep watchingGame(). Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not eat watchingGame.
 */
export function stripChessLeftoverWatchTrueComment(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/\/\*\s*watch:true\s*\*\//g, '');
}

/** Leftover /chess JS comment Invite / 1v1 after challengeShareUrl.
 * Humans see leftover Invite / 1v1 comment in view-source. Distinct leftover vs leftover watch:true
 * / leftover footer.dasha-foot nav. Not live UI copy: keep #gate-invite + textContent='Invite' + JSON-LD Play. Invite. Find.
 * Keep watchingGame() + g.watch===true. Keep Watch price/ticker belt. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Do not eat Invite button copy.
 */
export function stripChessLeftoverInvite1v1Comment(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/\/\*\s*Invite\s*\/\s*1v1\s*\*\//g, '');
}

/** Leftover /chess JS lecture showLecture after hideLecture already hides #gate-kicker/#gate-title/#gate-copy.
 * Humans see leftover showLecture in view-source. Distinct leftover vs leftover Invite / 1v1 comment
 * / leftover watch:true. Keep hideLecture(). Keep #gate-kicker + #gate-title + #gate-copy.
 * Keep #gate-invite + textContent='Invite' + JSON-LD Play. Invite. Find.
 * Keep watchingGame() + g.watch===true. Keep Watch price/ticker belt. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Do not eat hideLecture.
 */
export function stripChessLeftoverShowLecture(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/function showLecture\s*\(\s*title\s*,\s*copy\s*\)\{[^}]*\}\n?/g, '');
}

/** Leftover /chess unused JS loadLeaders / playNow / flashBought after never called
 * (no call sites, no onclick, no string refs). Humans see leftover functions in view-source.
 * Distinct leftover vs leftover showLecture / leftover Invite / 1v1 comment / leftover watch:true.
 * Keep #leaders + class=leaders. Keep #gate-action. Keep buy sheet + #buy-flash + function place.
 * Keep hideLecture() + findNow + joinQueue. Keep watchingGame() + g.watch===true.
 * Keep Watch price/ticker belt. Buy sheet + jup.ag + chess-local stay.
 * Chess only. Do not eat #leaders / #gate-action / findNow.
 */
function stripJsFunctionDecl(html, name) {
  const src = String(html || '');
  const re = new RegExp('(?:\\n)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return src;
  const brace = src.indexOf('{', m.index + m[0].length - 1);
  if (brace < 0) return src;
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(0, m.index) + src.slice(i + 1);
    }
  }
  return src;
}

export function stripChessLeftoverUnusedJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  out = stripJsFunctionDecl(out, 'loadLeaders');
  out = stripJsFunctionDecl(out, 'playNow');
  out = stripJsFunctionDecl(out, 'flashBought');
  return out;
}

/** Leftover /chess unused JS casualRematch / nextPlay / playReady / showPlayPair after never called
 * (no call sites, no onclick, no string refs). Humans see leftover functions in view-source.
 * Distinct leftover vs leftover unused JS loadLeaders / playNow / flashBought / leftover showLecture.
 * Keep showCasualBar() + hidePlayPair(). Keep #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not eat showCasualBar.
 */
export function stripChessLeftoverCasualPlayJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  out = stripJsFunctionDecl(out, 'casualRematch');
  out = stripJsFunctionDecl(out, 'nextPlay');
  out = stripJsFunctionDecl(out, 'playReady');
  out = stripJsFunctionDecl(out, 'showPlayPair');
  return out;
}

/** Leftover /chess dropped-selector CSS after .tournament-meta / .bracket / .champion / .entrants / .tournament-actions
 * were never in the chess DOM (wantTournamentChrome() is false; static markup has #tournament + .tournament-form only;
 * JS className strings are not painted nodes). Humans see leftover tournament chrome CSS in view-source.
 * Distinct leftover vs leftover unused JS casualRematch / leftover unused JS loadLeaders / leftover showLecture.
 * Keep #tournament + .tournament-form. Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not eat #tournament.
 */
export function stripChessLeftoverTournamentChromeCss(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/class=["'][^"']*\b(?:tournament-meta|tournament-actions|entrants|bracket|champion)\b/.test(visible)) return out;
  out = out.replace(/\.tournament-actions\s+\.btn\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.tournament-actions\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.tournament-meta\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.entrants\s+li\s*,\s*\.bracket\s+li\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.entrants\s*,\s*\.bracket\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.champion\s*\{[^}]*\}/gi, '');
  return out;
}

/** Leftover /chess unused JS tournament-meta / tournament-actions / entrants / bracket / champion className strings after CSS drop
 * (wantTournamentChrome() is false; static markup has #tournament + .tournament-form only;
 * renderTournament / renderChallenge still run for the hidden form path so they stay;
 * leftover className cluster never paints). Humans see leftover tournament className strings in view-source.
 * Distinct leftover vs leftover unused tournament chrome CSS / leftover unused JS casualRematch / leftover unused JS loadLeaders.
 * Keep #tournament + .tournament-form. Keep renderTournament() + renderChallenge() + wantTournamentChrome().
 * Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not eat #tournament. Do not restore leftover CSS rules.
 */
export function stripChessLeftoverTournamentChromeJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/class=["'][^"']*\b(?:tournament-meta|tournament-actions|entrants|bracket|champion)\b/.test(visible)) return out;
  out = out.replace(/,null,'tournament-actions'/g, ',null');
  out = out.replace(/,'tournament-meta'/g, '');
  out = out.replace(/,null,'entrants'/g, ',null');
  out = out.replace(/,null,'bracket'/g, ',null');
  out = out.replace(/,'champion'/g, '');
  return out;
}

/** Leftover /chess unused hidden tournament essay HTML after className drop
 * (wantTournamentChrome() is false; renderTournament / renderChallenge still run for the hidden form path;
 * leftover essay nodes Open/Playing/Complete / Dasha's challenge / Table claimed / Round / advances / Replay / champion wins never paint).
 * Humans see leftover tournament essay strings in view-source.
 * Distinct leftover vs leftover unused JS tournament-meta / tournament-actions / entrants / bracket / champion className strings.
 * Keep #tournament + .tournament-form. Keep renderTournament() + renderChallenge() + wantTournamentChrome().
 * Keep hidden form path Cup name + Challenge challenge-create. Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not gut renderTournament / renderChallenge. Do not restore leftover CSS or classNames.
 */
export function stripChessLeftoverTournamentEssayJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/class=["'][^"']*\b(?:tournament-meta|tournament-actions|entrants|bracket|champion)\b/.test(visible)) return out;
  if (/Dasha['’]s challenge/.test(visible)) return out;
  const marker = "if(holder)body.append(tournamentButton('Challenge','challenge-create'));return}";
  const start = out.indexOf('function renderTournament(');
  if (start >= 0) {
    const brace = out.indexOf('{', start);
    if (brace >= 0) {
      let depth = 0;
      let end = -1;
      for (let i = brace; i < out.length; i++) {
        const ch = out[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end >= 0) {
        const body = out.slice(brace + 1, end);
        const at = body.indexOf(marker);
        if (at >= 0) {
          const keep = body.slice(0, at + marker.length);
          out = out.slice(0, brace + 1) + keep + out.slice(end);
        }
      }
    }
  }
  const re = /function\s+renderChallenge\s*\(/;
  const m = re.exec(out);
  if (m) {
    const brace = out.indexOf('{', m.index + m[0].length - 1);
    if (brace >= 0) {
      let depth = 0;
      for (let i = brace; i < out.length; i++) {
        const ch = out[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            out = out.slice(0, brace) + '{}' + out.slice(i + 1);
            break;
          }
        }
      }
    }
  }
  return out;
}

/** Leftover /chess unused JS shareTournament after essay Share/Start/Leave/Join buttons were already dropped
 * (wantTournamentChrome() is false; tournamentButton('Share','share') is gone after essay strip;
 * leftover dispatcher if(action==='share')return shareTournament() never fires).
 * Humans see leftover shareTournament in view-source.
 * Distinct leftover vs leftover unused hidden tournament essay HTML.
 * Keep renderTournament() + renderChallenge() + hidden form path Cup name + Challenge challenge-create.
 * Keep tournamentAction create + tournamentSubmit + tournamentClick.
 * Keep shareChallenge + shareGame + id=share. Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not eat tournamentClick. Do not restore leftover essay strings.
 */
export function stripChessLeftoverShareTournamentJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  if (/tournamentButton\('Share','share'\)/.test(out)) return out;
  if (/onclick\s*=\s*["'][^"']*shareTournament/.test(out)) return out;
  out = out.replace(/if\(action==='share'\)return shareTournament\(\);/g, '');
  out = stripJsFunctionDecl(out, 'shareTournament');
  return out;
}

/** Leftover /chess unused JS tournamentAction start/leave/join/cancel tail after essay Share/Start/Leave/Join buttons were already dropped
 * (wantTournamentChrome() is false; tournamentButton Start/Leave/Join/Cancel gone after essay strip;
 * leftover tournamentClick fallthrough tournamentAction(action) and generic POST /chess/tournament/:id never fire).
 * Humans see leftover generic tournamentAction tail in view-source.
 * Distinct leftover vs leftover unused JS shareTournament.
 * Keep tournamentAction create + tournamentSubmit + tournamentClick.
 * Keep renderTournament() + renderChallenge() + hidden form path Cup name + Challenge challenge-create.
 * Keep shareChallenge + shareGame + id=share. Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not gut tournamentAction. Do not restore leftover essay strings or shareTournament.
 */
export function stripChessLeftoverTournamentActionTailJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  if (/tournamentButton\('Start','start'/.test(out)) return out;
  if (/tournamentButton\('Leave','leave'/.test(out)) return out;
  if (/tournamentButton\('Join','join'/.test(out)) return out;
  if (/tournamentButton\('Cancel','cancel'/.test(out)) return out;
  out = out.replace(/if\(action==='create'\)return tournamentAction\('create',\$\('tournament-name'\)\.value\);tournamentAction\(action\)/g, "if(action==='create')return tournamentAction('create',$('tournament-name').value)");
  out = out.replace(/var request=action==='create'\?post\('\/chess\/tournaments',\{name:name\}\):post\('\/chess\/tournament\/'\+tournament\.id,\{action:action\}\);/g, "var request=post('/chess/tournaments',{name:name});");
  return out;
}

/** Leftover /chess unused JS tournamentAction recover non-create Promise.resolve() branch after start/leave/join/cancel tail was already dropped
 * (create-only now: tournamentClick never fallthroughs; generic POST /chess/tournament/:id gone).
 * Humans see leftover action==='create'?loadTournaments():Promise.resolve() in view-source.
 * Distinct leftover vs leftover unused JS tournamentAction start/leave/join/cancel tail.
 * Keep tournamentAction create + loadTournaments recover for create + organizerIsMe loadMe.
 * Keep tournamentSubmit + tournamentClick + challenge-create. Keep renderTournament() + renderChallenge() + Cup name.
 * Keep shareChallenge + shareGame + id=share. Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not gut tournamentAction. Do not restore leftover start/leave/join/cancel tail, shareTournament, or essay strings.
 */
export function stripChessLeftoverTournamentActionRecoverJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  if (/tournamentButton\('Start','start'/.test(out)) return out;
  if (/tournamentButton\('Leave','leave'/.test(out)) return out;
  if (/tournamentButton\('Join','join'/.test(out)) return out;
  if (/tournamentButton\('Cancel','cancel'/.test(out)) return out;
  if (/post\('\/chess\/tournament\/'\+tournament\.id,\{action:action\}\)/.test(out)) return out;
  if (/tournamentAction\(action\)/.test(out)) return out;
  out = out.replace(/var recover=action==='create'\?loadTournaments\(\):Promise\.resolve\(\);/g, "var recover=loadTournaments();");
  return out;
}

/** Leftover /chess unused JS if(action==='create'&&) in tournamentAction recover .then after create-only recover
 * (create-only now: tournamentAction is only ever called with create; recover is always loadTournaments()).
 * Humans see leftover if(action==='create'&&tournament&&tournament.organizerIsMe) in view-source.
 * Distinct leftover vs leftover unused JS tournamentAction recover non-create Promise.resolve() branch.
 * Keep tournamentAction create + loadTournaments recover + organizerIsMe loadMe.
 * Keep tournamentSubmit + tournamentClick + challenge-create. Keep renderTournament() + renderChallenge() + Cup name.
 * Keep shareChallenge + shareGame + id=share. Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not gut tournamentAction. Do not restore leftover recover ternary, start/leave/join/cancel tail, shareTournament, or essay strings.
 */
export function stripChessLeftoverTournamentActionCreateIfJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  if (/tournamentButton\('Start','start'/.test(out)) return out;
  if (/tournamentButton\('Leave','leave'/.test(out)) return out;
  if (/tournamentButton\('Join','join'/.test(out)) return out;
  if (/tournamentButton\('Cancel','cancel'/.test(out)) return out;
  if (/post\('\/chess\/tournament\/'\+tournament\.id,\{action:action\}\)/.test(out)) return out;
  if (/tournamentAction\(action\)/.test(out)) return out;
  if (/var recover=action==='create'\?loadTournaments\(\):Promise\.resolve\(\);/.test(out)) return out;
  out = out.replace(/if\(action==='create'&&tournament&&tournament\.organizerIsMe\)return loadMe\(\)/g, "if(tournament&&tournament.organizerIsMe)return loadMe()");
  return out;
}

/** Leftover /chess unused JS if(!tournament)history.replaceState in tournamentAction success after create-only create-if
 * (create-only now: tournamentAction only POSTs create; cancel no longer clears the chess URL via this path).
 * Humans see leftover if(!tournament)history.replaceState(null,'',location.pathname) in view-source.
 * Distinct leftover vs leftover unused JS if(action==='create'&&) in recover .then.
 * Unused tournamentAction action param still serializes as function tournamentAction(action,name) — callers still pass 'create'; do not shrink it.
 * Keep tournamentAction create + loadTournaments recover + organizerIsMe loadMe.
 * Keep tournamentSubmit + tournamentClick + tournamentAction('create' callers. Keep renderTournament() + renderChallenge() + Cup name.
 * Keep dropChallenge / challengeAction / loadChallenge / resumeRoute / showReplay / watchLive replaceState.
 * Keep shareChallenge + shareGame + id=share. Keep showCasualBar() + hidePlayPair() + #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true. Keep Watch price/ticker belt.
 * Buy sheet + jup.ag + chess-local stay. Chess only. Do not gut tournamentAction. Do not restore leftover create-if, recover ternary, start/leave/join/cancel tail, shareTournament, or essay strings.
 */
export function stripChessLeftoverTournamentActionReplaceStateJs(html) {
  let out = String(html || '');
  if (!isChessLeftoverHomeMobileScrollPage(out)) return out;
  if (/tournamentButton\('Start','start'/.test(out)) return out;
  if (/tournamentButton\('Leave','leave'/.test(out)) return out;
  if (/tournamentButton\('Join','join'/.test(out)) return out;
  if (/tournamentButton\('Cancel','cancel'/.test(out)) return out;
  if (/post\('\/chess\/tournament\/'\+tournament\.id,\{action:action\}\)/.test(out)) return out;
  if (/tournamentAction\(action\)/.test(out)) return out;
  if (/var recover=action==='create'\?loadTournaments\(\):Promise\.resolve\(\);/.test(out)) return out;
  if (/if\(action==='create'&&tournament&&tournament\.organizerIsMe\)return loadMe\(\)/.test(out)) return out;
  out = out.replace(/if\(!tournament\)history\.replaceState\(null,'',location\.pathname\);/g, '');
  return out;
}

export function polishServedSlim(html) {
  let out = dropBagFromSlim(String(html || ''));
  /* Leftover home #dasha-mobile-scroll on /lobby after polish always injected HOME GRWM CSS. Home mobile-scroll + GRWM stay. */
  out = stripLobbyLeftoverHomeMobileScroll(out);
  /* Leftover home #dasha-mobile-scroll on /chess after polish always injected HOME GRWM CSS. Home mobile-scroll + GRWM stay. */
  out = stripChessLeftoverHomeMobileScroll(out);
  /* Leftover /chess dropped-selector CSS after .privacy was never in the chess DOM. Keep .empty + .identity. Buy sheet + jup.ag stay. */
  out = stripChessLeftoverPrivacyCss(out);
  /* Leftover /chess dropped-selector CSS after .dasha-quiet was never in the chess DOM. Keep .dasha-slim + .dasha-word + .buy-dasha. */
  out = stripChessLeftoverDashaQuietCss(out);
  /* Leftover /chess dropped-selector CSS after .panel was never in the chess DOM (shell is .app + .gate). Keep .app + .gate. */
  out = stripChessLeftoverPanelCss(out);
  /* Leftover /chess id="gate-actions" after CSS/JS strip. Keep class="gate-actions" + #gate-action. Keep .app + .gate. */
  out = stripChessLeftoverGateActionsId(out);
  /* Leftover /chess id="buy-share-tg" after CSS/JS strip. Keep TG href + #buy-share-x. Keep buy sheet. */
  out = stripChessLeftoverBuyShareTgId(out);
  /* Leftover /chess id="buy-sheet-fallback" after CSS/JS strip. Keep #buy-sheet + #buy-mint. Keep buy sheet. */
  out = stripChessLeftoverBuySheetFallbackId(out);
  /* Leftover /chess id="leaders-panel" after CSS/JS strip. Keep class="leaders" + #leaders. Keep .app + .gate. */
  out = stripChessLeftoverLeadersPanelId(out);
  /* Leftover /chess dropped-selector CSS after footer.dasha-foot <nav> was already DOM-stripped (footer is <p> links). Humans see footer.dasha-foot nav in view-source. footer.dasha-foot + .buy-dasha stay. Lobby leftover is separate. */
  out = stripChessLeftoverDashaFootNavCss(out);
  /* Leftover /chess JS comment watch:true after watchingGame() already inlines g.watch===true. Keep watchingGame. */
  out = stripChessLeftoverWatchTrueComment(out);
  /* Leftover /chess JS comment Invite / 1v1 after challengeShareUrl. Keep #gate-invite + Invite button copy. Keep watchingGame. */
  out = stripChessLeftoverInvite1v1Comment(out);
  /* Leftover /chess JS lecture showLecture after hideLecture already hides gate copy. Keep hideLecture. */
  out = stripChessLeftoverShowLecture(out);
  /* Leftover /chess unused JS loadLeaders / playNow / flashBought after never called. Keep #leaders class=leaders #gate-action buy sheet. */
  out = stripChessLeftoverUnusedJs(out);
  /* Leftover /chess id="recent-panel" after leftover unused JS loadLeaders was already stripped. Keep class=recent + #recent. */
  out = stripChessLeftoverRecentPanelId(out);
  /* Leftover /chess id="promotion-title" after CSS/JS strip. Keep class=promotion + #promotion. Keep tc-3/tc-5/tc-10. */
  out = stripChessLeftoverPromotionTitleId(out);
  /* Leftover /chess unused JS casualRematch / nextPlay / playReady / showPlayPair after never called. Keep showCasualBar #gate-find #gate-action. */
  out = stripChessLeftoverCasualPlayJs(out);
  /* Leftover /chess dropped-selector CSS after .tournament-meta / .bracket / .champion / .entrants / .tournament-actions were never in the chess DOM. Keep #tournament + .tournament-form. */
  out = stripChessLeftoverTournamentChromeCss(out);
  /* Leftover /chess unused JS tournament-meta / tournament-actions / entrants / bracket / champion className strings after CSS drop. Keep renderTournament + renderChallenge + #tournament + .tournament-form. */
  out = stripChessLeftoverTournamentChromeJs(out);
  /* Leftover /chess unused hidden tournament essay HTML after className drop. Keep renderTournament + renderChallenge + hidden form path. */
  out = stripChessLeftoverTournamentEssayJs(out);
  /* Leftover /chess unused JS shareTournament after essay Share/Start/Leave/Join buttons dropped. Keep tournamentAction create + tournamentSubmit + tournamentClick + challenge-create. */
  out = stripChessLeftoverShareTournamentJs(out);
  /* Leftover /chess unused JS tournamentAction start/leave/join/cancel tail after essay Share/Start/Leave/Join buttons dropped. Keep tournamentAction create + tournamentSubmit + tournamentClick. */
  out = stripChessLeftoverTournamentActionTailJs(out);
  /* Leftover /chess unused JS tournamentAction recover non-create Promise.resolve() branch after start/leave/join/cancel tail dropped. Keep create + loadTournaments recover. */
  out = stripChessLeftoverTournamentActionRecoverJs(out);
  /* Leftover /chess unused JS if(action==='create'&&) in recover .then after create-only recover. Keep loadTournaments recover + organizerIsMe loadMe. */
  out = stripChessLeftoverTournamentActionCreateIfJs(out);
  /* Leftover /chess unused JS if(!tournament)history.replaceState in tournamentAction success after create-only create-if. Keep tournamentAction(action,name) + tournamentAction('create'. Keep other replaceState. */
  out = stripChessLeftoverTournamentActionReplaceStateJs(out);
  if (!isLobbyLeftoverHomeMobileScrollPage(out) && !isChessLeftoverHomeMobileScrollPage(out)) out = unlockHomeMobileScroll(out);
  /* Leftover home dropped-selector CSS after leftover body class was already DOM-stripped. Home only. Lobby/chess skip. */
  out = stripHomeLeftoverBodyBodyCss(out);
  /* Leftover home dropped-selector CSS after <h3> was never in the home DOM. Home only. */
  out = stripHomeLeftoverDashaH3Css(out);
  /* Leftover home dropped-selector CSS after sparkline lecture comments were already stripped. Home only. Keep #spark-fill. */
  out = stripHomeLeftoverSparkLineCss(out);
  /* Leftover home dropped-selector CSS after leftover #spark-line CSS was already stripped. Home only. Keep @keyframes dasha-draw. */
  out = stripHomeLeftoverSparkFillCss(out);
  /* Leftover home unused @keyframes dasha-draw after leftover #spark-fill CSS was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. */
  out = stripHomeLeftoverDashaDrawKeyframes(out);
  /* Leftover home unused .spark CSS after leftover @keyframes dasha-draw was already stripped. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverSparkClassCss(out);
  /* Leftover home unused .price-note CSS after leftover .spark CSS was already stripped. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceNoteCss(out);
  /* Leftover home unused @media(max-width:600px) .price spark/note grid after leftover .price-note CSS was already stripped. Keep parent .price grid-template-areas. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .price/.ticker remount belt. */
  out = stripHomeLeftoverPriceSparkNoteMediaCss(out);
  /* Leftover home unused parent .price grid-template-areas after leftover @media spark/note grid was already stripped. Keep .price{ remount belt. Keep Watch chrome-hide .price-note. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceGridTemplateAreasCss(out);
  /* Leftover home unused parent .price display:grid layout after leftover parent grid-template-areas was already stripped. Keep Watch chrome-hide .price hide list. Keep .price[hidden]. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceDisplayGridCss(out);
  /* Leftover home unused .price[hidden] after leftover parent .price display:grid layout was already stripped. Keep Watch chrome-hide .price hide list. Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceHiddenCss(out);
  /* Leftover home unused .price-main layout after leftover .price[hidden] was already stripped. Keep Watch chrome-hide .price-main hide list. Keep .price-now / .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceMainCss(out);
  /* Leftover home unused .price-now type after leftover .price-main layout was already stripped. Keep Watch chrome-hide .price-now hide list. Keep .price-chg type / .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise. Watch #spark hide stays. Keep .ticker remount belt. */
  out = stripHomeLeftoverPriceNowCss(out);
  out = stripLeftoverProductFooter(out);
  out = out.replace(
    /\(res\.ok\?'No rated games yet':'Table unavailable'\)/g,
    "'No rated games yet'",
  );
  return out;
}

export const CHESS_API_HOST = 'https://lobby.getdasha.com';
export const CHESS_DOWN_MSG = 'Chess is down. Play locally.';
export const CHESS_TABLE_MSG = 'Table unavailable. Try again.';

export function rewriteChessApi(html) {
  return String(html || '').replace(/\bvar API=(['"])\1/, `var API='${CHESS_API_HOST}'`);
}

export function chessApiErrorMessage(path, { network = false } = {}) {
  if (network) return 'Network unavailable';
  const p = String(path || '');
  if (/^\/chess\/(challenge|queue|tournament)/.test(p)) return CHESS_TABLE_MSG;
  return CHESS_DOWN_MSG;
}

export function isChessApiPath(pathname) {
  const p = String(pathname || '');
  return p.startsWith('/chess/') && p !== '/chess/';
}

export function chessEmbedChrome(html) {
  const src = String(html || '');
  const openRe = /<header\b[^>]*>/i;
  const m = openRe.exec(src);
  let out = src;
  if (m) {
    const close = src.indexOf('</header>', m.index + m[0].length);
    if (close >= 0) out = src.slice(0, m.index) + src.slice(close + 9);
  }
  return rewriteChessApi(out);
}

const HOME_SAFE_MIN_BYTES = 15_000;

/** dasha-home-body-safe-strip: if chrome transforms blank home, keep upstream + title/JSON-LD only. */
export function dashaHomeBodySafeStrip(originalHtml, transformedHtml) {
  const out = String(transformedHtml || '');
  const hasBody = /<body[\s>]/i.test(out);
  const hasBuy = /jup\.ag/i.test(out) && out.includes(DASHA_SLIM_MINT) && /Buy/i.test(out);
  if (hasBody && hasBuy && out.length >= HOME_SAFE_MIN_BYTES) return out;
  let safe = sanitizePublicJsonLd(String(originalHtml || ''));
  safe = mintHomeTitle(safe);
  safe = mintHomeDescription(safe);
  safe = mintHomeSameAs(safe);
  safe = mintHomeOg(safe);
  return safe;
}

const POTTER_HOME_308_PATHS = new Set([
  '/studio', '/studio/',
  '/verse', '/verse/',
  '/learn', '/learn/',
  '/graph', '/graph/',
  '/index.html', '/index.html/',
]);
const POTTER_HOWTO_308_PATHS = new Set([
  '/dasha', '/dasha/',
  '/desk', '/desk/',
  '/how', '/how/',
  '/howto', '/howto/',
  '/how-to', '/how-to/',
  '/howtobuy', '/howtobuy/',
  '/buy', '/buy/',
]);
const POTTER_LOGIN_308_PATHS = new Set([
  '/grok', '/grok/',
  '/siwg', '/siwg/',
]);
/** Quiet signup/register already 308→/login (not login#grok). Live /signin /sign-in were html-404. */
const POTTER_PLAIN_LOGIN_308_PATHS = new Set([
  '/signup', '/signup/',
  '/register', '/register/',
  // Live /signin /sign-in html-404 while /login 200; peers of signup/register.
  '/signin', '/signin/',
  '/sign-in', '/sign-in/',
]);
const POTTER_COMPUTE_TAB_308_PATHS = new Set([
  '/compute/use', '/compute/use/',
  '/compute/provide', '/compute/provide/',
  '/compute/night', '/compute/night/',
  '/compute/build', '/compute/build/',
  '/compute/sponsor', '/compute/sponsor/',
  // Typeform doors + quiet peers: live Ask/Pay/Credits/Host/Marketplace/You html-404
  // while Provide/Night/Sponsor already 308→/compute (Start. Ask. Provide. Pay. Credits.).
  '/compute/ask', '/compute/ask/',
  '/compute/pay', '/compute/pay/',
  '/compute/credits', '/compute/credits/',
  '/compute/host', '/compute/host/',
  '/compute/market', '/compute/market/',
  '/compute/marketplace', '/compute/marketplace/',
  '/compute/you', '/compute/you/',
  // Profile synonym peers of /compute/you (You hub). Live /account /compute/account already 308.
  // Live /profile /settings /compute/profile /compute/settings were html-404.
  '/compute/account', '/compute/account/',
  '/account', '/account/',
  '/profile', '/profile/',
  '/settings', '/settings/',
  '/compute/profile', '/compute/profile/',
  '/compute/settings', '/compute/settings/',
  // Apex product doors: /provide /start /sponsor(s) already 308→/compute.
  // Leftover apex Ask/Pay/Credits/Host/Use/Night/Marketplace/Market/You/Build/Ocm
  // still html-404 while /compute/* peers already 308 (or /compute/ocm is a real 200 —
  // apex /ocm still folds to the same /compute tab pattern).
  '/provide', '/provide/',
  '/start', '/start/',
  '/sponsor', '/sponsor/',
  '/sponsors', '/sponsors/',
  '/ask', '/ask/',
  '/pay', '/pay/',
  '/credits', '/credits/',
  '/host', '/host/',
  '/use', '/use/',
  '/marketplace', '/marketplace/',
  '/market', '/market/',
  '/you', '/you/',
  '/night', '/night/',
  '/build', '/build/',
  '/ocm', '/ocm/',
]);
const POTTER_WHICH_308_PATHS = new Set([
  '/verify', '/verify/',
]);
/** Quiet Fill-the-jar + tip-me doors. Live /fill /jar /fill-the-jar /tip /tip-me html-404; /faucet/fill already 308→/faucet. */
const POTTER_FAUCET_DOOR_308_PATHS = new Set([
  '/fill', '/fill/',
  '/jar', '/jar/',
  '/fill-the-jar', '/fill-the-jar/',
  // Claim path ends tip me; apex /tip /tip-me were html-404.
  '/tip', '/tip/',
  '/tip-me', '/tip-me/',
]);
/** Title-case leftover faucet GETs with lowercase siblings already 200. Not /faucet/jar (intentional gap). */
const POTTER_FAUCET_LEAF_CASEFOLD = new Set([
  '/faucet/tape', '/faucet/tape/',
  '/faucet/status', '/faucet/status/',
  '/faucet/me', '/faucet/me/',
]);

const POTTER_PRODUCT_CASEFOLD_DEST = new Map([
  ['/faucet', 'https://www.getdasha.com/faucet'],
  ['/compute', 'https://www.getdasha.com/compute'],
  ['/lobby', 'https://www.getdasha.com/lobby'],
  ['/chess', 'https://www.getdasha.com/chess'],
  ['/bag', 'https://www.getdasha.com/bag'],
  ['/simp', 'https://www.getdasha.com/simp'],
  ['/crew', 'https://www.getdasha.com/crew'],
  ['/contribute', 'https://www.getdasha.com/contribute'],
  ['/privacy', 'https://www.getdasha.com/privacy'],
  ['/which', 'https://www.getdasha.com/which'],
  ['/how-to-buy', 'https://www.getdasha.com/how-to-buy'],
  ['/bounties', 'https://www.getdasha.com/bounties'],
  ['/login', 'https://www.getdasha.com/login'],
  // Machine files: Title-case /Llms.txt /Robots.txt /Sitemap.xml /Ai.txt html-404 while
  // lowercase siblings already 200. Exact lowercase stays null so 200 handlers run.
  // Do NOT put /forum /chat here — that would drop ?t=; use isForumChatAliasPath + forumToLobbyRedirect.
  ['/llms.txt', 'https://www.getdasha.com/llms.txt'],
  ['/llms-full.txt', 'https://www.getdasha.com/llms-full.txt'],
  ['/ai.txt', 'https://www.getdasha.com/ai.txt'],
  ['/robots.txt', 'https://www.getdasha.com/robots.txt'],
  ['/sitemap.xml', 'https://www.getdasha.com/sitemap.xml'],
  // Digest: Title-case /Digest /DIGEST /Digest.json html-404 while lowercase already 200.
  ['/digest', 'https://www.getdasha.com/digest'],
  ['/digest.json', 'https://www.getdasha.com/digest.json'],
]);

export function potterHome308Dest(path) {
  // Case-fold: live /Buy /Howto /Studio were html-404 while lowercase siblings 308.
  // Title-case product pages (/Faucet /Compute /Lobby /Chess /Bag …) were html-404 while
  // lowercase siblings already 200 — 308 to the same dest (canonical lowercase).
  // Machine files (/Llms.txt /Robots.txt /Sitemap.xml /Ai.txt /Llms-Full.txt) same pattern.
  // Quiet /fill /jar /fill-the-jar /tip /tip-me → /faucet. Apex /provide /start /sponsor(s) /ask /pay /credits /host /use /marketplace /market /you /night /build /ocm → /compute. Exact lowercase product stays null for 200 handlers.
  // /forum /chat stay OUT (keep ?t= via forumToLobbyRedirect).
  const raw = String(path || '');
  const p = raw.toLowerCase();
  if (POTTER_HOWTO_308_PATHS.has(p)) return 'https://www.getdasha.com/how-to-buy';
  if (POTTER_HOME_308_PATHS.has(p)) return 'https://www.getdasha.com/';
  if (POTTER_LOGIN_308_PATHS.has(p)) return 'https://www.getdasha.com/login#grok';
  if (POTTER_PLAIN_LOGIN_308_PATHS.has(p)) return 'https://www.getdasha.com/login';
  if (POTTER_WHICH_308_PATHS.has(p)) return 'https://www.getdasha.com/which';
  if (POTTER_FAUCET_DOOR_308_PATHS.has(p)) return 'https://www.getdasha.com/faucet';
  if (POTTER_COMPUTE_TAB_308_PATHS.has(p)) return 'https://www.getdasha.com/compute';
  // P2-1 COMPUTE-FULL-REVIEW: lowercase HTML /compute/ (+ /compute/index.html) → /compute
  // same www host (cache/SEO). Exact /compute stays null (200). GET/HEAD only via
  // potterHome308Response. Do NOT fold /compute/api/... (API trailing-slash parity).
  if (p === '/compute/' || p === '/compute/index.html') {
    return 'https://www.getdasha.com/compute';
  }
  // /Compute/ocm(...) Title-case → lowercase on-domain proxy (keep subpath).
  if (p === '/compute/ocm' || p.startsWith('/compute/ocm/')) {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  // /compute/skill/*.md disk names are PROVIDE.md/USE.md/OCM-HOST.md; live routes are
  // lowercase. Title-case /Compute/skill/... and /…/PROVIDE.md were html-404.
  if (p === '/compute/skill' || p.startsWith('/compute/skill/')) {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  // /Compute/api(...) Title-case → lowercase /compute/api prefix. Keep remainder
  // case (job_/mac_ ids are base64url). Exact lowercase stays for API handlers.
  if (p === '/compute/api' || p === '/compute/api/') {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  if (p.startsWith('/compute/api/')) {
    const m = raw.match(/^\/compute\/api\//i);
    if (!m) return null;
    const canon = '/compute/api/' + raw.slice(m[0].length);
    if (raw !== canon) return 'https://www.getdasha.com' + canon;
    return null;
  }
  // /Faucet/fill(+sig) Title-case + /Faucet/fills(+sig). Keep sig case (base58).
  if (p === '/faucet/fill' || p === '/faucet/fill/' || p === '/faucet/fills' || p === '/faucet/fills/') {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  if (p.startsWith('/faucet/fill/') || p.startsWith('/faucet/fills/')) {
    const m = raw.match(/^\/faucet\/fills?\//i);
    if (!m) return null;
    const prefix = p.startsWith('/faucet/fills/') ? '/faucet/fills/' : '/faucet/fill/';
    const canon = prefix + raw.slice(m[0].length);
    if (raw !== canon) return 'https://www.getdasha.com' + canon;
    return null;
  }
  if (POTTER_FAUCET_LEAF_CASEFOLD.has(p)) {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  // /OAuth/x(...) /OAuth/github(...) Title-case were html-404 while lowercase
  // siblings already 308→lobby (www) or 200 (lobby). Fold to canonical lowercase;
  // exact lowercase stays null so www lobby-hop + lobby handlers run.
  if (
    p === '/oauth/x' || p.startsWith('/oauth/x/') ||
    p === '/oauth/github' || p.startsWith('/oauth/github/')
  ) {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  // /Chess/... Title-case subpaths (not bare /Chess — product map) → lowercase
  // /chess/ prefix; keep remainder case (game/challenge/tournament ids).
  // Exact lowercase stays null so chess handlers run.
  if (p.startsWith('/chess/') && p !== '/chess/') {
    const m = raw.match(/^\/chess\//i);
    if (!m) return null;
    const canon = '/chess/' + raw.slice(m[0].length);
    if (raw !== canon) return 'https://www.getdasha.com' + canon;
    return null;
  }
  // /Bag/api(...) Title-case → lowercase path on www (mint is query). Exact lowercase null.
  if (p === '/bag/api' || p === '/bag/api/' || p.startsWith('/bag/api/')) {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  // /Digest/pack /Digest/ingest Title-case → lowercase (DO pack/ingest already exist).
  if (
    p === '/digest/pack' || p === '/digest/pack/' ||
    p === '/digest/ingest' || p === '/digest/ingest/'
  ) {
    if (raw !== p) return 'https://www.getdasha.com' + p;
    return null;
  }
  const base = p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
  const dest = POTTER_PRODUCT_CASEFOLD_DEST.get(base);
  if (dest) {
    const canon = base;
    const canonSlash = base + '/';
    if (raw !== canon && raw !== canonSlash) return dest;
  }
  return null;
}

export function potterHome308Response(request, url) {
  const path = url instanceof URL ? url.pathname : String(url || '');
  if (request && request.method !== 'GET' && request.method !== 'HEAD') return null;
  const dest = potterHome308Dest(path);
  if (!dest) return null;
  let location = dest;
  // P2-2 COMPUTE-FULL-REVIEW: lobby Title-case /Compute/api stays on lobby
  try {
    const host = request && new URL(request.url).hostname;
    if (host === 'lobby.getdasha.com') {
      const u = new URL(dest);
      if (
        u.hostname === 'www.getdasha.com' &&
        (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/'))
      ) {
        location = 'https://lobby.getdasha.com' + u.pathname + u.search + u.hash;
      }
    }
  } catch (_) {}
  return Response.redirect(location, 308);
}

/** Webflow still injects a loader for retired project fonts even though Dasha overrides its type. */
export function stripLegacyFonts(html) {
  return String(html || '')
    .replace(/\s*<link\b(?=[^>]*\bhref=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"']*["'])[^>]*\/?\s*>/gi, '')
    .replace(/\s*<script\b(?=[^>]*\bsrc=["']https:\/\/ajax\.googleapis\.com\/ajax\/libs\/webfont\/[^"']+["'])[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\s*<script\b[^>]*>\s*WebFont\.load\([\s\S]*?<\/script>/gi, '');
}

export function ensureCanonical(html, pageUrl) {
  if (!html || !pageUrl) return html;
  let out = String(html);
  if (!/rel=["']canonical["']/i.test(out)) {
    const tag = `<link rel="canonical" href="${pageUrl}">`;
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${tag}</head>`) : tag + out;
  }
  if (!/property=["']og:url["']/i.test(out)) {
    const tag = `<meta property="og:url" content="${pageUrl}">`;
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${tag}</head>`) : tag + out;
  }
  return out;
}

/**
 * dasha-lobby-page.html is a Webflow embed fragment (no document chrome).
 * Worker /lobby is a first-class page — without a <title>, browsers invent one
 * from the leading <style> block (CSS leaking into the tab).
 */
export const LOBBY_TITLE = '$dasha Lobby';
export const LOBBY_DESC = 'Chat. Play. Fill the jar. Buy.';
const LOBBY_SUB = 'Chat in the lobby.';

/** Leftover /lobby dropped-selector CSS after .forum-list/.forum-thread were never in the lobby DOM
 * (threads mount is #dasha-forum + df-* from lobby.js). Humans see it in view-source after CSS/JS strip
 * is not required — the rule is in live <style>. Distinct leftover vs .forum-play-full.
 * #forum-play-go + #dasha-forum + #dasha-chess + .lobby-log stay. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverForumListCss(html) {
  let out = String(html || '');
  return out.replace(/\.forum-list\s*,\s*\.forum-thread\s*\{[^}]*\}/gi, '');
}

/** Leftover /lobby dropped-selector CSS after .forum-title was never in the lobby DOM
 * (threads mount is #dasha-forum + df-title from lobby.js). Humans see it in view-source.
 * Distinct leftover vs .forum-list/.forum-thread. #forum-play-go + #dasha-forum + #dasha-chess +
 * .lobby-log stay. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverForumTitleCss(html) {
  let out = String(html || '');
  return out.replace(/\.forum-title\s*\{[^}]*\}/gi, '');
}

/** Leftover /lobby dropped-selector CSS after .forum-row was never in the lobby DOM
 * (threads mount is #dasha-forum + df-row from lobby.js). Humans see it in view-source.
 * Distinct leftover vs .forum-title / .forum-list/.forum-thread. #forum-play-go + #dasha-forum +
 * #dasha-chess + .lobby-log stay. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverForumRowCss(html) {
  let out = String(html || '');
  return out.replace(/\.forum-row(?:\s+\.forum-body)?\s*\{[^}]*\}/gi, '');
}

/** Leftover /lobby dropped-selector CSS after .forum-replies/.forum-when were never in the lobby DOM
 * (threads mount is #dasha-forum + df-* from lobby.js). Humans see it in view-source.
 * Distinct leftover vs .forum-row / .forum-title / .forum-list/.forum-thread. #forum-play-go +
 * #dasha-forum + #dasha-chess + .lobby-log stay. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverForumRepliesCss(html) {
  let out = String(html || '');
  return out.replace(/\.forum-replies\s*,\s*\.forum-when\s*\{[^}]*\}/gi, '');
}

/** Leftover /lobby dropped-selector CSS after .forum-post/.forum-reply were never in the lobby DOM
 * (threads mount is #dasha-forum + df-* from lobby.js). Humans see it in view-source.
 * Distinct leftover vs .forum-replies/.forum-when / .forum-row / .forum-title / .forum-list/.forum-thread.
 * Keep .lobby-line (lobby.js chat lines). #forum-play-go + #dasha-forum + #dasha-chess + .lobby-log stay.
 * Do not eat .forum-threads. Do not eat forum-post:x: rate keys.
 */
export function stripLobbyLeftoverForumPostCss(html) {
  let out = String(html || '');
  out = out.replace(/\.forum-post\s*,\s*\.forum-reply\s*\{[^}]*\}/gi, '');
  out = out.replace(/\.forum-post\s*,\s*\.forum-reply\s*,\s*/gi, '');
  return out;
}

/** Leftover /lobby dropped-selector CSS after .forum-meta was never in the lobby DOM
 * (threads mount is #dasha-forum + df-meta from lobby.js). Humans see it in view-source.
 * Distinct leftover vs .forum-post/.forum-reply / .forum-replies/.forum-when / .forum-row /
 * .forum-title / .forum-list/.forum-thread. Keep .lobby-meta (lobby.js chat lines).
 * #forum-play-go + #dasha-forum + #dasha-chess + .lobby-log stay. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverForumMetaCss(html) {
  let out = String(html || '');
  out = out.replace(/\.forum-meta\s*,\s*/gi, '');
  out = out.replace(/\.forum-meta\s*\{[^}]*\}/gi, '');
  return out;
}

/** Leftover /lobby dropped-selector CSS after .dasha-forum was never in the lobby DOM
 * (threads mount is id="dasha-forum" + df-* from lobby.js; no class="dasha-forum"). Humans see it in view-source.
 * Distinct leftover vs .forum-meta / .forum-post/.forum-reply / .forum-replies/.forum-when / .forum-row /
 * .forum-title / .forum-list/.forum-thread. Keep #dasha-forum. Keep .dasha-lobby (separate leftover).
 * #forum-play-go + #dasha-chess + .lobby-log stay. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverDashaForumCss(html) {
  let out = String(html || '');
  return out.replace(/\.dasha-forum\s*\{[^}]*\}/gi, '');
}

/** Leftover /lobby dropped-selector CSS after .dasha-quiet was never in the lobby DOM
 * (slim header is .dasha-word + .buy-dasha; JS never mounts dasha-quiet). Humans see it in view-source.
 * Distinct leftover vs leftover .dasha-forum / leftover chess .dasha-quiet.
 * Keep .dasha-slim + .dasha-word + .buy-dasha. Keep .dasha-lobby (lobby.js classList.add).
 * Keep #dasha-forum. #forum-play-go + #dasha-chess + .lobby-log stay. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverDashaQuietCss(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/\.dasha-slim\s+a\.dasha-quiet\s*\{[^}]*\}/gi, '');
}

/** Leftover /lobby dropped-selector CSS after .forum-back was never in the lobby DOM
 * (threads mount is #dasha-forum + df-back from lobby.js). Humans see it in view-source.
 * Distinct leftover vs leftover .dasha-quiet / leftover .forum-meta / leftover .forum-post.
 * Keep .forum-send (Play). Keep .lobby-send + .lobby-x-btn + .lobby-x-unlink.
 * Keep .dasha-lobby. Keep #dasha-forum. #forum-play-go + #dasha-chess + .lobby-log stay.
 * Do not eat .forum-threads.
 */
export function stripLobbyLeftoverForumBackCss(html) {
  let out = String(html || '');
  out = out.replace(/\.forum-back\s*,\s*/gi, '');
  out = out.replace(/\.forum-back\s*\{[^}]*\}/gi, '');
  return out;
}

/** Leftover /lobby id="forum-play" after CSS/JS strip. JS never reads getElementById('forum-play');
 * CSS never targets #forum-play (Play is class="forum-play" + id="forum-play-go"). Humans see it in view-source.
 * Distinct leftover vs leftover .forum-back / leftover .forum-play-full. Keep class="forum-play".
 * Keep #forum-play-go + .forum-send. Keep #dasha-forum. Keep .dasha-lobby. Do not eat .forum-threads.
 */
export function stripLobbyLeftoverForumPlayId(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])forum-play\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])forum-play\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover /lobby class="lobby-text" after CSS/JS strip. CSS never targets .lobby-text
 * (composer paints via .lobby-form textarea). Inline JS never reads querySelector('.lobby-text').
 * Humans see it in view-source. Distinct leftover vs leftover id="forum-play" / leftover .forum-back.
 * Keep .lobby-form + .lobby-send + textarea name=text. Keep #dasha-lobby. Keep .dasha-lobby.
 * Lobby only. Do not eat .lobby-form.
 */
export function stripLobbyLeftoverLobbyTextClass(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bclass\s*=/.test(attrs)) return full;
    if (!/\blobby-text\b/.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\sclass=(['"])([^'"]*)\1/i, (_, q, val) => {
      const next = String(val).split(/\s+/).filter((c) => c && c !== 'lobby-text');
      return next.length ? (' class=' + q + next.join(' ') + q) : '';
    });
    return '<' + tag + nextAttrs + '>';
  });
}


/** Leftover /lobby dropped-selector CSS after footer.dasha-foot <nav> was already DOM-stripped
 * (footer is <p> $dasha · Buy · Bag · Telegram). Humans see footer.dasha-foot nav in view-source.
 * Distinct leftover vs leftover class="lobby-text" / leftover .forum-list.
 * footer.dasha-foot + footer.dasha-foot a + footer.dasha-foot .buy-dasha stay.
 * Keep class="forum-play" + #forum-play-go + #dasha-forum + .dasha-lobby.
 * Lobby only. Chess leftover footer.dasha-foot nav is a separate leftover (stripChessLeftoverDashaFootNavCss). Do not eat footer.dasha-foot.
 */
export function stripLobbyLeftoverDashaFootNavCss(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const footer = visible.match(/<footer\b[^>]*class=["'][^"']*\bdasha-foot\b[^>]*>[\s\S]*?<\/footer>/i);
  if (footer && /<nav\b/i.test(footer[0])) return out;
  return out.replace(/footer\.dasha-foot nav\s*\{[^}]*\}/gi, '');
}

/** Leftover /simp class="dasha-quiz" after CSS/JS strip. CSS never targets .dasha-quiz
 * (quiz paints via #dasha-quiz). JS never reads querySelector('.dasha-quiz')
 * (simp-board.js mounts #dasha-simp-board). Humans see it in view-source.
 * Distinct leftover vs leftover home #simp hash / leftover class="lobby-text".
 * Keep #dasha-quiz + skip-link href=#dasha-quiz. Keep #dasha-simp-board + .simp-quiz-go.
 * Simp board only. Do not eat #dasha-quiz.
 */
function isSimpLeftoverDashaQuizPage(html) {
  const out = String(html || '');
  return /\bid=["']dasha-quiz["']/.test(out) && /\bid=["']dasha-simp-board["']/.test(out);
}

export function stripSimpLeftoverDashaQuizClass(html) {
  let out = String(html || '');
  if (!isSimpLeftoverDashaQuizPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bclass\s*=/.test(attrs)) return full;
    if (!/\bdasha-quiz\b/.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\sclass=(['"])([^'"]*)\1/i, (_, q, val) => {
      const next = String(val).split(/\s+/).filter((c) => c && c !== 'dasha-quiz');
      return next.length ? (' class=' + q + next.join(' ') + q) : '';
    });
    return '<' + tag + nextAttrs + '>';
  });
}

function servedSimpPageHtml(opts) {
  /* Leftover /simp class="dasha-quiz" after CSS/JS strip. Keep #dasha-quiz. */
  return stripSimpLeftoverDashaQuizClass(simpPageHtml(opts));
}


/** Leftover /lobby dropped-selector CSS after .forum-form was never in the lobby DOM
 * (composer is class="lobby-form"; lobby.js mounts lobby-form / lobby-body / lobby-status).
 * Humans see leftover .forum-form mixed prefixes in view-source.
 * Distinct leftover vs leftover footer.dasha-foot nav / leftover class="lobby-text" / leftover .forum-back.
 * Keep .lobby-form + .lobby-form input/textarea + :focus. Keep .lobby-nick[hidden] + .lobby-xbar[hidden].
 * Leftover mixed .forum-body / .forum-status dropped by stripLobbyLeftoverForumBodyCss. Keep .forum-send.
 * Keep class="forum-play" + #forum-play-go + #dasha-forum + .dasha-lobby.
 * Lobby only. Do not eat .lobby-form.
 */
export function stripLobbyLeftoverForumFormCss(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/\bclass=["'][^"']*\bforum-form\b/.test(visible)) return out;
  out = out.replace(/\.forum-form(?:\s+(?:input|textarea))?(?:\[hidden\])?(?::focus)?\s*,\s*/gi, '');
  out = out.replace(/\.forum-form(?:\s+(?:input|textarea))?(?:\[hidden\])?(?::focus)?\s*\{[^}]*\}/gi, '');
  return out;
}

/** Leftover /lobby dropped-selector CSS after .forum-body/.forum-status were never in the lobby DOM
 * (lobby.js chat mounts lobby-body / lobby-status; threads mount is #dasha-forum + df-body / df-status).
 * Humans see leftover mixed .forum-body / .forum-status prefixes in view-source.
 * Distinct leftover vs leftover .forum-form / leftover footer.dasha-foot nav / leftover .forum-back.
 * Keep .lobby-body + .lobby-body a. Keep .lobby-status + .lobby-status[data-kind=bad].
 * Keep .forum-send + class="forum-play" + #forum-play-go + #dasha-forum + .dasha-lobby.
 * Lobby only. Do not eat .lobby-body / .lobby-status.
 */
export function stripLobbyLeftoverForumBodyCss(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (!/\bclass=["'][^"']*\bforum-body\b/.test(visible)) {
    out = out.replace(/\.forum-body(?:\s+a)?\s*,\s*/gi, '');
    out = out.replace(/\.forum-body(?:\s+a)?\s*\{[^}]*\}/gi, '');
  }
  if (!/\bclass=["'][^"']*\bforum-status\b/.test(visible)) {
    out = out.replace(/\.forum-status(?:\[data-kind=bad\])?\s*,\s*/gi, '');
    out = out.replace(/\.forum-status(?:\[data-kind=bad\])?\s*\{[^}]*\}/gi, '');
  }
  return out;
}


/** Leftover /lobby TG dump inside .forum-pin after quiet-pin lock
 * (no mint/Buy/Chess/TG dump in the pin — TG belongs in footer only).
 * Humans see leftover pin <a>TG</a> in view-source.
 * Distinct leftover vs leftover id="forum-play" / leftover .forum-back / leftover .forum-form.
 * Keep .forum-pin + .forum-ca + #forum-copy + pin Copy script.
 * Keep footer Telegram https://t.me/+xB7S8mIQaKFiZjRh only. Do not ban all t.me.
 * Lobby only. Do not eat footer Telegram. Do not eat header Buy.
 */
export function stripLobbyLeftoverForumPinTg(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  out = out.replace(
    /(<p\b[^>]*\bclass=["'][^"']*\bforum-pin\b[^"']*["'][^>]*>)([\s\S]*?)(<\/p>)/gi,
    (full, open, inner, close) => {
      const next = String(inner).replace(
        /\s*<a\b(?=[^>]*\bhref=["']https:\/\/t\.me\/\+xB7S8mIQaKFiZjRh["'])[^>]*>\s*TG\s*<\/a>/gi,
        '',
      );
      return open + next + close;
    },
  );
  return out;
}

/** Leftover /lobby dropped-selector CSS after leftover pin TG dump was already DOM-stripped
 * (quiet-pin is mint chip + Copy; no <a> inside .forum-pin). Humans see leftover mixed
 * .forum-pin a in view-source (.forum-pin a,.forum-copy). Distinct leftover vs leftover pin TG dump.
 * Keep .forum-copy + .forum-pin + .forum-ca + #forum-copy. Keep footer Telegram
 * https://t.me/+xB7S8mIQaKFiZjRh. Keep .dasha-lobby + class=forum-play + #forum-play-go + #dasha-forum.
 * Lobby only. Do not eat .forum-copy. Do not eat footer Telegram. Do not restore pin TG dump.
 */
export function stripLobbyLeftoverForumPinACss(html) {
  let out = String(html || '');
  if (!isLobbyLeftoverHomeMobileScrollPage(out)) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const pin = visible.match(/<p\b[^>]*\bclass=["'][^"']*\bforum-pin\b[^>]*>[\s\S]*?<\/p>/i);
  if (pin && /<a\b/i.test(pin[0])) return out;
  if (!pin) return out;
  return out
    .replace(/\.forum-pin a\s*,\s*/g, '')
    .replace(/,\s*\.forum-pin a(?=\s*[{,])/g, '');
}


export function rewriteLobbyForumChrome(html) {
  let out = String(html || '');
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${LOBBY_TITLE}</title>`);
  out = out.replace(/content="Forum — \$dasha"/g, `content="${LOBBY_TITLE}"`);
  out = out.replace(/content="\$dasha community — chat and forum"/g, `content="${LOBBY_TITLE}"`);
  out = out.replace(/(<meta name="description" content=")[^"]*(")/i, `$1${LOBBY_DESC}$2`);
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/i, `$1${LOBBY_DESC}$2`);
  out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/i, `$1${LOBBY_DESC}$2`);
  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/gi, `$1${LOBBY_TITLE}$2`);
  out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/gi, `$1${LOBBY_TITLE}$2`);
  out = out.replace(/href="https:\/\/www\.getdasha\.com\/forum(?=["?#])/g, 'href="https://www.getdasha.com/lobby"');
  out = out.replace(/href="\/forum(?=["?#])/g, 'href="/lobby"');
  out = out.replace(/content="https:\/\/www\.getdasha\.com\/forum(?=["?#])/g, 'content="https://www.getdasha.com/lobby"');
  out = out.replace(/<h1>Forum<\/h1>/, '<h1>Lobby</h1>');
  out = out.replace(/<p class="forum-sub">Chat\.<\/p>/, `<p class="forum-sub">${LOBBY_SUB}</p>`);
  /* Already in the room: drop leftover Forum/Lobby footer doors, do not rename them. */
  out = out.replace(/\s*·\s*<a href="https:\/\/www\.getdasha\.com\/(?:forum|lobby)">(?:Forum|Lobby)<\/a>/g, '');
  out = out.replace(/\s*·\s*<a href="\/(?:forum|lobby)">(?:Forum|Lobby)<\/a>/g, '');
  out = out.replace(/>Forum<\/a>/g, '>Lobby</a>');
  /* Chess is Play in the room, not a door. */
  out = out.replace(/\s*<a class="forum-play-full"[^>]*>Full table<\/a>/g, '');
  out = out.replace(/\s*<a[^>]*href="\/chess"[^>]*>Full table<\/a>/g, '');
  /* Leftover /lobby dropped-selector CSS after Full table DOM-strip. Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = out.replace(/\.forum-play-full\s*\{[^}]*\}/gi, '');
  /* Leftover /lobby dropped-selector CSS after .forum-list/.forum-thread were never in the lobby DOM. Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = stripLobbyLeftoverForumListCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-title was never in the lobby DOM (df-title). Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = stripLobbyLeftoverForumTitleCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-row was never in the lobby DOM (df-row). Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = stripLobbyLeftoverForumRowCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-replies/.forum-when were never in the lobby DOM. Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = stripLobbyLeftoverForumRepliesCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-post/.forum-reply were never in the lobby DOM. Keep .lobby-line. Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = stripLobbyLeftoverForumPostCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-meta was never in the lobby DOM. Keep .lobby-meta. Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = stripLobbyLeftoverForumMetaCss(out);
  /* Leftover /lobby dropped-selector CSS after .dasha-forum was never in the lobby DOM (id="dasha-forum"). Humans see it in view-source. Keep #dasha-forum. */
  out = stripLobbyLeftoverDashaForumCss(out);
  /* Leftover /lobby dropped-selector CSS after .dasha-quiet was never in the lobby DOM (slim header is .dasha-word + .buy-dasha). Humans see it in view-source. Keep .dasha-lobby. Keep #dasha-forum. */
  out = stripLobbyLeftoverDashaQuietCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-back was never in the lobby DOM (df-back). Keep .forum-send. Humans see it in view-source. #forum-play-go + #dasha-forum stay. */
  out = stripLobbyLeftoverForumBackCss(out);
  /* Leftover /lobby id="forum-play" after CSS/JS strip. Keep class="forum-play" + #forum-play-go. Humans see it in view-source. #dasha-forum stay. */
  out = stripLobbyLeftoverForumPlayId(out);
  /* Leftover /lobby class="lobby-text" after CSS/JS strip. Keep .lobby-form + .lobby-send + textarea. Humans see it in view-source. #dasha-lobby stay. */
  out = stripLobbyLeftoverLobbyTextClass(out);
  /* Leftover /lobby dropped-selector CSS after footer.dasha-foot <nav> was already DOM-stripped (footer is <p> links). Humans see footer.dasha-foot nav in view-source. footer.dasha-foot + .buy-dasha stay. Chess leftover is a separate strip. */
  out = stripLobbyLeftoverDashaFootNavCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-form was never in the lobby DOM (composer is .lobby-form). Humans see leftover mixed .forum-form in view-source. Keep .lobby-form. */
  out = stripLobbyLeftoverForumFormCss(out);
  /* Leftover /lobby dropped-selector CSS after .forum-body/.forum-status were never in the lobby DOM (lobby.js mounts lobby-body / lobby-status; threads are df-body / df-status). Humans see leftover mixed prefixes in view-source. Keep .lobby-body + .lobby-status. */
  out = stripLobbyLeftoverForumBodyCss(out);
  /* Leftover /lobby TG dump inside .forum-pin after quiet-pin lock. Keep .forum-pin + #forum-copy. Keep footer Telegram. */
  out = stripLobbyLeftoverForumPinTg(out);
  /* Leftover /lobby dropped-selector CSS after leftover pin TG dump was already DOM-stripped. Keep .forum-copy. Keep footer Telegram. */
  out = stripLobbyLeftoverForumPinACss(out);
  out = out.replace(/\s*·\s*<a href="https:\/\/www\.getdasha\.com\/chess">Chess<\/a>/g, '');
  out = out.replace(/\s*·\s*<a href="\/chess">Chess<\/a>/g, '');
  return out;
}

export function asStandaloneLobbyPage(html) {
  /* Lobby host `/` is health JSON. The embed fragment's ← $dasha must not land there. */
  let src = String(html || '').replace(
    /(<a class="lp-back" href=")\/(")/,
    '$1https://www.getdasha.com/$2',
  );
  src = rewriteLobbyForumChrome(src);
  src = stripLobbyMintTapeMount(src);
  if (/<title[\s>]/i.test(src) && /<html[\s>]/i.test(src)) return src;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${LOBBY_TITLE}</title><meta name="description" content="${LOBBY_DESC}"><link rel="canonical" href="https://www.getdasha.com/lobby"><link rel="alternate" type="application/rss+xml" title="$dasha Lobby" href="https://www.getdasha.com/lobby/feed.xml"><meta name="theme-color" content="#070608"><meta property="og:type" content="website"><meta property="og:url" content="https://www.getdasha.com/lobby"><meta property="og:title" content="${LOBBY_TITLE}"><meta property="og:description" content="${LOBBY_DESC}"><meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${LOBBY_TITLE}"><meta name="twitter:description" content="${LOBBY_DESC}"><meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png"></head><body>${src}</body></html>`;
}

/** Title-case /Forum /Chat (and slash) must 308 via forumToLobbyRedirect — not potterHome308Dest (?t=). */
export function isForumChatAliasPath(pathname) {
  const p = String(pathname || '').toLowerCase();
  return p === '/forum' || p === '/forum/' || p === '/chat' || p === '/chat/';
}

/** /forum is the same room as /lobby. Keep ?t= so copied thread links still open. */
export function forumToLobbyRedirect(url) {
  const dest = new URL('https://www.getdasha.com/lobby');
  const src = url instanceof URL ? url : null;
  const t = src ? src.searchParams.get('t') : '';
  if (t) {
    dest.searchParams.set('t', t);
    dest.hash = 'threads';
  }
  return Response.redirect(dest.href, 308);
}

function pngOgHeaders(edge) {
  return {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=120',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Dasha-Edge': edge,
  };
}


/** Shared Worker ASSETS paths for lobby + www/apex productEdge (SIWG jpg, faucet stills, simp/og). */
export function isWorkerStaticAssetPath(pathname) {
  return (
    pathname.startsWith('/simp/photo/') ||
    pathname.startsWith('/simp/card/') ||
    pathname.startsWith('/og/') ||
    pathname === '/client/faucet.png' ||
    pathname === '/client/faucet.avif' ||
    pathname === '/client/faucet.webp' ||
    pathname === '/client/sign-in-with-grok-bot.jpg'
  );
}

export async function workerStaticAssetResponse(request, url, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (!isWorkerStaticAssetPath(url.pathname)) return null;
  if (!env?.ASSETS?.fetch) return null;
  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  if (asset.ok) headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}

async function simpOgResponse(request, url, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const board = url.pathname === '/og/simp' || url.pathname === '/og/simp/' || url.pathname === '/og/simp.png';
  const resultMatch = url.pathname.match(/^\/og\/simp\/([A-Za-z0-9_-]{6,32})(?:\.png)?\/?$/);
  if (!board && !resultMatch) return null;
  if (board) {
    return new Response(request.method === 'HEAD' ? null : await simpBoardOgPng(), {
      status: 200,
      headers: pngOgHeaders('simp-board-og'),
    });
  }
  const id = resultMatch[1];
  try {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (stub) {
      const look = await stub.fetch(new Request(`https://lobby.getdasha.com/simp/result/${encodeURIComponent(id)}`));
      if (look.ok) {
        const data = await look.json();
        const result = data?.result;
        if (result) {
          return new Response(request.method === 'HEAD' ? null : await simpQuizOgPng({
            title: result.title,
            correct: result.correct,
            total: result.total,
          }), {
            status: 200,
            headers: pngOgHeaders('simp-result-og'),
          });
        }
      }
    }
  } catch {}
  return new Response(request.method === 'HEAD' ? null : await simpQuizOgPng({ title: 'Beat this' }), {
    status: 200,
    headers: pngOgHeaders('simp-result-og'),
  });
}

function securityTxt(host) {
  return `Contact: https://github.com/Uuriko/dasha-desk/security/advisories/new\nExpires: 2027-08-01T00:00:00Z\nPreferred-Languages: en\nCanonical: https://${host}/.well-known/security.txt\nPolicy: https://github.com/Uuriko/dasha-desk/security/policy\n`;
}

function securityTxtResponse(request, host) {
  return new Response(request.method === 'HEAD' ? null : securityTxt(host), {
    status: 200,
    headers: {
      ...SECURITY,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function applyHtmlSecurity(headers) {
  for (const [name, value] of Object.entries(HTML_SECURITY)) headers.set(name, value);
  return headers;
}

const LLMS_DESCRIBEDBY = '</llms.txt>; rel="describedby", </llms-full.txt>; rel="describedby"';
const htmlLlmsHeaders = (extra = {}) => htmlHeaders({ ...extra, Link: LLMS_DESCRIBEDBY });
const HOME_TITLE = '$dasha';

function attachLlmsDescribedBy(headers) {
  const have = String(headers.get('Link') || headers.get('link') || '');
  const links = have.split(',');
  for (const path of ['/llms.txt', '/llms-full.txt']) {
    if (!links.some(link => link.includes(`<${path}>`) && /\brel=["']?describedby\b/i.test(link))) {
      headers.append('Link', `<${path}>; rel="describedby"`);
    }
  }
  return headers;
}

/** HTML <link> so crawlers that only parse the document still find /llms.txt. HTTP Link already exists. */
export function attachLlmsHtmlLinks(html) {
  const src = String(html || '');
  const tags = [];
  const has = (path) => src.includes(`href="${path}"`) && /rel=["']describedby["']/i.test(src);
  if (!has('/llms.txt')) tags.push('<link rel="describedby" href="/llms.txt" type="text/plain">');
  if (!has('/llms-full.txt')) tags.push('<link rel="describedby" href="/llms-full.txt" type="text/plain">');
  if (!tags.length) return src;
  const inject = tags.join('');
  return /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `${inject}</head>`) : inject + src;
}

/** Document title matches first paint + share card. Old Webflow line is a leftover. */
export function mintHomeTitle(html) {
  const src = String(html || '');
  if (!/<title>[^<]*<\/title>/i.test(src)) {
    const tag = `<title>${HOME_TITLE}</title>`;
    return /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `${tag}</head>`) : tag + src;
  }
  return src.replace(/<title>[^<]*<\/title>/i, `<title>${HOME_TITLE}</title>`);
}


const HOME_DESC = '$dasha on getdasha.com. dash_eats. Mint 53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump.';
const HOME_NAMED = /dash_eats|53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/i;
export const HOME_OG_TITLE = '$dasha';
export const HOME_OG_DESC = 'Buy $dasha.';
export const HOME_OG_IMAGE = 'https://lobby.getdasha.com/og/dasha-social-card.png';
export const HOME_OG_URL = 'https://www.getdasha.com/';
const HOME_OG_META = /(?:name|property)=["'](?:og:title|og:description|og:image(?:[:][a-z0-9_]+)?|og:url|og:type|twitter:title|twitter:description|twitter:image(?:[:][a-z0-9_]+)?|twitter:card)["']/i;

/** Share card for a paste of getdasha.com. Names $dasha. Lands on Buy. Head only. */
export function mintHomeOg(html) {
  let out = String(html || '').replace(/<meta\b[^>]*>/gi, (tag) => (HOME_OG_META.test(tag) ? '' : tag));
  const tags = `<meta property="og:type" content="website"><meta property="og:url" content="${HOME_OG_URL}"><meta property="og:title" content="${HOME_OG_TITLE}"><meta property="og:description" content="${HOME_OG_DESC}"><meta property="og:image" content="${HOME_OG_IMAGE}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${HOME_OG_TITLE}"><meta name="twitter:description" content="${HOME_OG_DESC}"><meta name="twitter:image" content="${HOME_OG_IMAGE}">`;
  return /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${tags}</head>`) : tags + out;
}


/** Studio leftover meta still says "Make something. Pass it on." Name dash_eats + mint. */
export function mintHomeDescription(html) {
  let out = String(html || '');
  const names = ['description', 'og:description', 'twitter:description'];
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(`(<meta\\b[^>]*(?:name|property)=["']${esc}["'][^>]*\\bcontent=["'])([^"']*)(["'][^>]*/?>)`, 'i'),
      (full, a, content, c) => (HOME_NAMED.test(content) ? full : a + HOME_DESC + c),
    );
    out = out.replace(
      new RegExp(`(<meta\\b[^>]*\\bcontent=["'])([^"']*)(["'][^>]*(?:name|property)=["']${esc}["'][^>]*/?>)`, 'i'),
      (full, a, content, c) => (HOME_NAMED.test(content) ? full : a + HOME_DESC + c),
    );
  }
  if (!/<meta\b[^>]*(?:name|property)=["']description["']/i.test(out)) {
    const tag = `<meta name="description" content="${HOME_DESC}">`;
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${tag}</head>`) : tag + out;
  }
  out = out.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (full, open, body, close) => {
      const next = body.replace(/("description"\s*:\s*")((?:\\.|[^"\\])*)(")/g, (m, a, content, c) => (
        HOME_NAMED.test(content) ? m : `${a}${HOME_DESC}${c}`
      ));
      return next === body ? full : open + next + close;
    },
  );
  return out;
}


/** Home WebSite JSON-LD sameAs: dash_eats, site, and the jup.ag token URL for the associated mint. */
const HOME_SAME_AS = [
  'https://x.com/dash_eats',
  'https://www.getdasha.com/',
  `https://jup.ag/tokens/${DASHA_SLIM_MINT}`,
];

export function mintHomeSameAs(html) {
  let out = String(html || '');
  let found = false;
  out = out.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (full, open, body, close) => {
      let value;
      try { value = JSON.parse(body); } catch { return full; }
      if (value?.['@type'] !== 'WebSite') return full;
      found = true;
      value.sameAs = HOME_SAME_AS.slice();
      return open + JSON.stringify(value) + close;
    },
  );
  if (!found) {
    const block = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '$dasha',
      url: 'https://www.getdasha.com/',
      description: HOME_DESC,
      sameAs: HOME_SAME_AS,
    })}</script>`;
    out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${block}</head>`) : block + out;
  }
  return out;
}

/** Kill VVAIFU / Not CoinGecko / Which $dasha? lecture from first-paint hero.
 *  Mint lives later in #token. No replacement copy. /which stays a quiet URL. */
export function stripHomeOtherCoinWarning(html) {
  let out = String(html || '');
  // Whole mint-lede is the warning (mint + lecture + Which $dasha?). Drop it.
  out = out.replace(
    /<p\b(?=[^>]*\bclass=(['"])(?:[^'"]*\s)?mint-lede(?:\s[^'"]*)?\1)[^>]*>[\s\S]*?<\/p>/gi,
    '',
  );
  // Token row / injected banner: cut warning sentences, keep quiet "Which".
  out = out.replace(/\s*Not CoinGecko(?:[’']s)? Dasha \(VVAIFU\)\./g, '');
  out = out.replace(
    /\s*<a\b(?=[^>]*\bhref=(['"])(?:\/which|https:\/\/www\.getdasha\.com\/which)\1)[^>]*>\s*Which \$dasha\?\s*<\/a>/gi,
    '',
  );
  return out;
}

/** /which stays a quiet URL. Kill it from home chrome (token row + footer + any leftover). Per-<a> only. */
export function linkHomeWhich(html) {
  return String(html || '').replace(
    /\s*<a\b(?=[^>]*\bhref=(['"])(?:\/which|https:\/\/www\.getdasha\.com\/which)\1)[^>]*>[\s\S]*?<\/a>/gi,
    '',
  );
}

/** Token-row clutter: 24h holder perks. Privacy stays — it is a real page. How to buy / mint COPY stay. Per-<a> only. */
export function stripHomeTokenClutter(html) {
  return String(html || '').replace(
    /\s*<a\b(?=[^>]*\bhref=(['"])(?:\/simp#holder|https:\/\/www\.getdasha\.com\/simp#holder)\1)[^>]*>[\s\S]*?<\/a>/gi,
    '',
  );
}

function jsAsset(body, origin, { headOnly = false } = {}) {
  return new Response(headOnly ? null : body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Robots-Tag': 'noindex, nofollow',
      'Access-Control-Allow-Origin': origin || '*',
      Vary: 'Origin',
      ETag: `"${ASSET_HASH}"`,
    },
  });
}

function corsHeaders(origin, { credentials = false } = {}) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...(credentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    Vary: 'Origin',
  };
}

const PRICE_TTL_MS = 30_000;
const PRICE_STALE_MS = 10 * 60_000;
const PRICE_SERIES_TTL_MS = 5 * 60_000;

function json(body, status, origin, { credentials = false, headers: extraHeaders = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY,
      ...corsHeaders(origin, { credentials }),
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function id() {
  return crypto.randomUUID().slice(0, 12);
}

async function requestJson(request) {
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return {};
  const text = await request.text().catch(() => '');
  if (new TextEncoder().encode(text).length > 4096) return {};
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

function modAllowed(request, env) {
  const secret = env.LOBBY_MOD_SECRET;
  return Boolean(secret && request.headers.get('Authorization') === `Bearer ${secret}`);
}

function simpRate(map, key, maxPerMin) {
  const state = map.get(key) || { lastMs: 0, times: [] };
  map.set(key, state);
  return checkRate(state, Date.now(), { rateMs: 0, maxPerMin });
}

function countMetric(object, key) {
  object[key] = (object[key] || 0) + 1;
}

function countQuizResult(metrics, attempt, quiz) {
  countMetric(metrics.lanes, quiz.lane);
  countMetric(metrics.tiers, quiz.title);
  const seconds = Math.max(0, (Number(attempt.updatedAt) - Number(attempt.startedAt)) / 1000);
  countMetric(metrics.elapsed, seconds < 60 ? 'under-1m' : seconds < 120 ? '1-2m' : seconds < 240 ? '2-4m' : 'over-4m');
}

const emptyQuizMetrics = since => ({ since, starts: 0, completions: 0, replays: 0, shares: 0, reached: {}, answers: {}, lanes: {}, tiers: {}, elapsed: {} });
const emptyStudioMetrics = since => ({ since, completionSince: since, opens: 0, firstEdits: 0, completions: 0, exports: 0, shareIntents: 0, shareSuccesses: 0, copyEditableLinks: 0, handoffMints: 0, handoffOpens: 0, sources: { home: 0, quiz: 0, direct: 0, 'transmission-001': 0, other: 0 } });
const HANDOFF_TTL_MS = 90 * 24 * 60 * 60_000;
const HANDOFF_MAX = 4000;
const HANDOFF_LOOKS = new Set(['photo', 'poster', 'ticket', 'print', 'marquee', 'signal', 'face']);
const HANDOFF_FORMATS = new Set(['square', 'story', 'banner']);
const HANDOFF_EFFECTS = new Set(['clean', 'fry', 'xerox', 'angel', 'cursed', 'surveillance']);
const HANDOFF_SRC = new Set(['home', 'quiz', 'transmission-001']);
const HANDOFF_STICKERS = new Set(['', '🍒', '✦', '♱', '♢', '☻']);

function handoffId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function sanitizeHandoffBody(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const look = String(input.look || '');
  const format = String(input.format || '');
  const effect = String(input.effect || 'clean');
  if (!HANDOFF_LOOKS.has(look) || !HANDOFF_FORMATS.has(format) || !HANDOFF_EFFECTS.has(effect)) return null;
  const line = String(input.line || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!line) return null;
  const sticker = input.sticker == null ? '' : String(input.sticker);
  if (!HANDOFF_STICKERS.has(sticker)) return null;
  let photo = '';
  if (input.photo != null && input.photo !== '') {
    photo = String(input.photo).slice(0, 40);
    if (!/^[a-z0-9_-]+$/i.test(photo)) return null;
  }
  let src = '';
  if (input.src != null && input.src !== '') {
    src = String(input.src);
    if (!HANDOFF_SRC.has(src)) src = '';
  }
  const parent = input.parent && typeof input.parent === 'object' && !Array.isArray(input.parent)
    ? sanitizeHandoffBody({ ...input.parent, parent: undefined })
    : null;
  const out = { look, format, line, effect };
  if (photo) out.photo = photo;
  if (sticker) out.sticker = sticker;
  if (src) out.src = src;
  if (parent) out.parent = parent;
  return out;
}

export function handoffToStudioHash(state) {
  const p = new URLSearchParams();
  p.set('look', state.look);
  p.set('format', state.format);
  p.set('line', state.line);
  if (state.photo) p.set('photo', state.photo);
  if (state.effect && state.effect !== 'clean') p.set('effect', state.effect);
  if (state.sticker) p.set('sticker', state.sticker);
  if (state.src) p.set('src', state.src);
  if (state.parent) {
    p.set('pLook', state.parent.look);
    p.set('pFormat', state.parent.format);
    p.set('pLine', state.parent.line);
    if (state.parent.photo) p.set('pPhoto', state.parent.photo);
    if (state.parent.effect && state.parent.effect !== 'clean') p.set('pEffect', state.parent.effect);
    if (state.parent.sticker) p.set('pSticker', state.parent.sticker);
  }
  return p.toString();
}

export function handoffCardHtml(id, state, { autoRedirect = true } = {}) {
  const pageUrl = `https://lobby.getdasha.com/h/${id}`;
  const homeUrl = 'https://www.getdasha.com/';
  const title = escapeHtml(state.line.slice(0, 80) || '$dasha');
  const lookBit = escapeHtml(String(state.look || 'poster'));
  const formatBit = escapeHtml(String(state.format || 'square'));
  const description = escapeHtml(`${state.look || 'poster'} · ${state.format || 'square'} · Your turn — change one thing, pass it on.`);
  const imageUrl = `https://lobby.getdasha.com/h/${id}/og.png`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="canonical" href="${escapeHtml(pageUrl)}"><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="getdasha"><meta property="og:url" content="${escapeHtml(pageUrl)}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${escapeHtml(imageUrl)}"><meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="600"><meta property="og:image:height" content="314"><meta property="og:image:alt" content="${title}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${escapeHtml(imageUrl)}"><style>body{margin:0;background:#070608;color:#f4eddb;font:18px/1.45 Arial,Helvetica,sans-serif;min-height:100vh;display:grid;place-items:center}.c{max-width:28rem;padding:32px 20px;text-align:left}b{color:#dfff00;font-size:12px;letter-spacing:.12em;text-transform:uppercase}.meta{margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#e6dcc4}h1{margin:8px 0 16px;font-size:clamp(28px,7vw,44px);line-height:.95;letter-spacing:-.04em;text-transform:uppercase}p{margin:0 0 20px;color:#e6dcc4}a.cta{display:inline-flex;min-height:52px;align-items:center;padding:0 20px;background:#dfff00;color:#070608;font-weight:900;text-decoration:none;text-transform:uppercase;letter-spacing:.04em}a.ghost{display:inline-flex;min-height:44px;align-items:center;margin-left:12px;color:#f4eddb;font-weight:800}</style></head><body><main class="c"><b>Your turn · $dasha</b><p class="meta">${lookBit} · ${formatBit}</p><h1>${title}</h1><p>${description}</p><p><a class="cta" href="${escapeHtml(homeUrl)}">Open $dasha</a></p></main></body></html>`;
}
const emptyChessMetrics = since => ({ since, pageOpens: 0, localPlayIntents: 0, localCompletions: 0, localRematchIntents: 0, localShareIntents: 0, linkIntents: 0, enrollmentIntents: 0, holderProofIntents: 0, queueIntents: 0, buyIntents: 0, gamesStarted: 0, gamesCompleted: 0, rematchesOffered: 0, rematchesAccepted: 0, replayOpens: 0, replayPlayIntents: 0, replayShareIntents: 0, replayShareHandoffs: 0, challengesCreated: 0, challengesAccepted: 0, challengeShareIntents: 0, tournamentsCreated: 0, tournamentJoins: 0, tournamentsStarted: 0, tournamentsCompleted: 0, tournamentShareIntents: 0 });
const CHESS_TOURNAMENT_REGISTRATION_MS = 24 * 60 * 60_000;
const CHESS_CHALLENGE_MS = 30 * 60_000;
const CHESS_CHALLENGE_RETAIN_MS = 24 * 60 * 60_000;

/** Public observation without identities, content, source slices, or tiny cohorts. */
export function publicFunnelSummary(studio = {}, quiz = {}, chess = {}, threshold = 5) {
  const cell = value => Number(value) >= threshold ? Number(value) : null;
  const ratio = (part, whole) => Number(part) >= threshold && Number(whole) >= threshold && Number(part) <= Number(whole)
    ? Number((Number(part) / Number(whole)).toFixed(3))
    : null;
  return {
    ok: true,
    since: Number.isFinite(studio.since) ? new Date(studio.since).toISOString() : null,
    completionSince: Number.isFinite(studio.completionSince ?? studio.since) ? new Date(studio.completionSince ?? studio.since).toISOString() : null,
    threshold,
    studio: {
      opens: cell(studio.opens),
      firstEdits: cell(studio.firstEdits),
      openToEdit: ratio(studio.firstEdits, studio.opens),
      completions: cell(studio.completions),
      editToCompletion: ratio(studio.completions, studio.firstEdits),
      exports: cell(studio.exports),
      editToExport: ratio(studio.exports, studio.firstEdits),
      shareIntents: cell(studio.shareIntents),
      shareApiResolutions: cell(studio.shareSuccesses),
      editToShareIntent: ratio(studio.shareIntents, studio.firstEdits),
      intentToShareSuccess: ratio(studio.shareSuccesses, studio.shareIntents),
      copyEditableLinks: cell(studio.copyEditableLinks),
      handoffMints: cell(studio.handoffMints),
      handoffOpens: cell(studio.handoffOpens),
      mintToOpen: Number(studio.handoffOpens) >= threshold && Number(studio.handoffMints) >= threshold
        ? Math.min(1, Number((Number(studio.handoffOpens) / Number(studio.handoffMints)).toFixed(3)))
        : null,
    },
    quiz: {
      starts: cell(quiz.starts),
      completions: cell(quiz.completions),
      startToComplete: ratio(quiz.completions, quiz.starts),
      replays: cell(quiz.replays),
      shareIntents: cell(quiz.shares),
      completeToShareIntent: ratio(quiz.shares, quiz.completions),
    },
    chess: {
      pageOpens: cell(chess.pageOpens),
      localPlayIntents: cell(chess.localPlayIntents),
      localCompletions: cell(chess.localCompletions),
      localRematchIntents: cell(chess.localRematchIntents),
      localShareIntents: cell(chess.localShareIntents),
      pageOpenToLocalPlayIntent: ratio(chess.localPlayIntents, chess.pageOpens),
      localPlayToCompletion: ratio(chess.localCompletions, chess.localPlayIntents),
      localCompletionToRematchIntent: ratio(chess.localRematchIntents, chess.localCompletions),
      localCompletionToShareIntent: ratio(chess.localShareIntents, chess.localCompletions),
      linkIntents: cell(chess.linkIntents),
      enrollmentIntents: cell(chess.enrollmentIntents),
      holderProofIntents: cell(chess.holderProofIntents),
      queueIntents: cell(chess.queueIntents),
      pageOpenToLinkIntent: ratio(chess.linkIntents, chess.pageOpens),
      linkToEnrollmentIntent: ratio(chess.enrollmentIntents, chess.linkIntents),
      enrollmentToHolderProofIntent: ratio(chess.holderProofIntents, chess.enrollmentIntents),
      holderProofToQueueIntent: ratio(chess.queueIntents, chess.holderProofIntents),
      buyIntents: cell(chess.buyIntents),
      pageOpenToBuyIntent: ratio(chess.buyIntents, chess.pageOpens),
      gamesStarted: cell(chess.gamesStarted),
      gamesCompleted: cell(chess.gamesCompleted),
      gameStartToComplete: ratio(chess.gamesCompleted, chess.gamesStarted),
      rematchesOffered: cell(chess.rematchesOffered),
      rematchesAccepted: cell(chess.rematchesAccepted),
      rematchOfferToAccept: ratio(chess.rematchesAccepted, chess.rematchesOffered),
      replayOpens: cell(chess.replayOpens),
      replayPlayIntents: cell(chess.replayPlayIntents),
      replayOpenToPlay: ratio(chess.replayPlayIntents, chess.replayOpens),
      replayShareIntents: cell(chess.replayShareIntents),
      replayShareHandoffs: cell(chess.replayShareHandoffs),
      replayShareIntentToHandoff: ratio(chess.replayShareHandoffs, chess.replayShareIntents),
      completionToReplayShare: ratio(chess.replayShareIntents, chess.gamesCompleted),
      challengesCreated: cell(chess.challengesCreated),
      challengesAccepted: cell(chess.challengesAccepted),
      challengeCreateToAccept: ratio(chess.challengesAccepted, chess.challengesCreated),
      challengeShareIntents: cell(chess.challengeShareIntents),
      tournamentsCreated: cell(chess.tournamentsCreated),
      tournamentJoins: cell(chess.tournamentJoins),
      tournamentsStarted: cell(chess.tournamentsStarted),
      tournamentsCompleted: cell(chess.tournamentsCompleted),
      tournamentShareIntents: cell(chess.tournamentShareIntents),
    },
    limits: `Aggregate events only; cells below ${threshold} and non-comparable ratios are suppressed and are not unique-user conversion or retention.`,
  };
}

export function solanaRpcEndpoints(env = {}) {
  // Dedicated first, then the same public pool rpc() uses for getTransaction history.
  return solanaRpcList(env);
}

async function walletHoldsDasha(env, owner) {
  let lastError;
  for (const endpoint of solanaRpcEndpoints(env)) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(4000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
          params: [owner, { mint: MINT }, { encoding: 'jsonParsed', commitment: 'finalized' }],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error || !Array.isArray(data.result?.value)) throw new Error('Solana balance check failed');
      return hasPositiveTokenBalance(data, { owner, mint: MINT });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Solana balance check failed');
}

/** Sum raw $dasha balance for a wallet (treasury inventory). */
async function tokenBalanceRaw(env, owner, mint = FAUCET_MINT) {
  let lastError;
  for (const endpoint of solanaRpcEndpoints(env)) {
    try {
      const controller = new AbortController();
      // Keep this short: a hanging dedicated RPC must leave time for public fallbacks
      // inside the Worker/DO request budget. 10s * N endpoints impersonated an empty jar.
      const timer = setTimeout(() => controller.abort(), 3_500);
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [owner, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }],
          }),
        });
      } finally {
        clearTimeout(timer);
      }
      const data = await response.json().catch(() => ({}));
      const host = (() => { try { return new URL(endpoint).host; } catch { return 'rpc'; } })();
      if (!response.ok) throw new Error(`rpc http ${response.status} ${host}`);
      if (data.error) throw new Error(`${data.error.message || data.error.code || 'rpc error'} ${host}`);
      // Missing/empty value ⇒ zero balance (treasury empty is fine).
      const rows = Array.isArray(data.result?.value)
        ? data.result.value
        : Array.isArray(data.result)
          ? data.result
          : [];
      let total = 0n;
      for (const row of rows) {
        const info = row?.account?.data?.parsed?.info;
        if (info?.mint && info.mint !== mint) continue;
        try {
          total += BigInt(info?.tokenAmount?.amount || 0);
        } catch {
          /* skip */
        }
      }
      return total;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Solana balance check failed');
}

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    /* closed */
  }
}

function htmlPage(title, body, { path = '', description = '', robots = '' } = {}) {
  const url = path ? `https://www.getdasha.com${path}` : '';
  const social = url ? `<meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">` : '';
  const robot = robots ? `<meta name="robots" content="${robots}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${robot}${social}
<style>body{font:16px/1.45 Arial,Helvetica,sans-serif;background:#070608;color:#f4eddb;max-width:28rem;margin:3rem auto;padding:0 1rem}a,code{color:#dfff00}.cta{display:inline-flex;align-items:center;min-height:48px;padding:0 16px;background:#dfff00;color:#070608;font-weight:900;text-decoration:none;box-shadow:4px 4px 0 #ff3b81}.skip-link{position:absolute;left:-9999px;top:0;z-index:100;padding:12px 16px;background:#dfff00;color:#070608!important;font-weight:900;text-decoration:none}.skip-link:focus{left:12px;top:12px;outline:3px solid #f4eddb;outline-offset:2px}</style></head>
<body><a class="skip-link" href="#dasha-page">Skip to content</a><main id="dasha-page">${body}</main></body></html>`;
}

/** Leftover /privacy dropped-selector CSS after .cta was already DOM-stripped. Humans see it in view-source. Product skip-link stays. Contribute .cta stays. */
export function stripPrivacyDroppedCtaCss(html) {
  let out = String(html || '');
  const privacy =
    /<h1>Privacy<\/h1>/.test(out) ||
    /rel=["']canonical["'][^>]*href=["']https:\/\/www\.getdasha\.com\/privacy["']/.test(out);
  if (!privacy) return out;
  const visible = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/class=["'][^"']*\bcta\b/.test(visible)) return out;
  return out.replace(/\.cta\s*\{[^}]*\}/gi, '');
}

/** Leftover /privacy dropped-selector CSS after <code> was never in the privacy DOM (htmlPage still emits a,code). Humans see leftover code in view-source. Distinct leftover vs leftover .cta CSS. a color stays. Product skip-link stays. 404 mint <code> a,code stays. Contribute leftover a,code is a separate leftover (stripContributeLeftoverCodeCss). Bounties leftover a,code is a separate leftover (stripBountiesLeftoverCodeCss). Privacy only. Do not eat a{color}. */
export function stripPrivacyLeftoverCodeCss(html) {
  let out = String(html || '');
  const privacy =
    /<h1>Privacy<\/h1>/.test(out) ||
    /rel=["']canonical["'][^>]*href=["']https:\/\/www\.getdasha\.com\/privacy["']/.test(out);
  if (!privacy) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/<code\b/i.test(visible)) return out;
  return out.replace(/a,\s*code\s*\{/g, 'a{');
}

/** Leftover /bounties dropped-selector CSS after .cta was already DOM-stripped on the empty inventory. Humans see it in view-source. Funded listings keep .cta. Product skip-link stays. Contribute .cta stays. */
export function stripBountiesDroppedCtaCss(html) {
  let out = String(html || '');
  const bounties =
    /<h1>Bounties<\/h1>/.test(out) ||
    /rel=["']canonical["'][^>]*href=["']https:\/\/www\.getdasha\.com\/bounties["']/.test(out) ||
    /id=["']bb-app["']/.test(out);
  if (!bounties) return out;
  const visible = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/class=["'][^"']*\bcta\b/.test(visible)) return out;
  return out.replace(/\.cta\s*\{[^}]*\}/gi, '');
}

/** Leftover /bounties dropped-selector CSS after <code> was never in the bounties DOM (htmlPage still emits a,code). Humans see leftover code in view-source. Distinct leftover vs leftover .cta CSS / leftover privacy a,code. a color stays. Product skip-link stays. #bb-x + #bb-app stay. Contribute leftover a,code is a separate leftover (stripContributeLeftoverCodeCss). 404 mint <code> a,code stays. Bounties only. Do not eat a{color}. Do not mount board.js. */
export function stripBountiesLeftoverCodeCss(html) {
  let out = String(html || '');
  const bounties =
    /<h1>Bounties<\/h1>/.test(out) ||
    /rel=["']canonical["'][^>]*href=["']https:\/\/www\.getdasha\.com\/bounties["']/.test(out) ||
    /id=["']bb-app["']/.test(out);
  if (!bounties) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/<code\b/i.test(visible)) return out;
  return out.replace(/a,\s*code\s*\{/g, 'a{');
}

/** Leftover /contribute dropped-selector CSS after <code> was never in the contribute DOM (htmlPage still emits a,code). Humans see leftover code in view-source. Distinct leftover vs leftover privacy a,code / leftover bounties a,code. a color stays. .cta stays. Product skip-link stays. 404 mint <code> a,code stays. Contribute only. Do not eat a{color}. Do not eat .cta.
 */
export function stripContributeLeftoverCodeCss(html) {
  let out = String(html || '');
  const contribute =
    /<h1>Build Dasha\.<\/h1>/.test(out) ||
    /rel=["']canonical["'][^>]*href=["']https:\/\/www\.getdasha\.com\/contribute["']/.test(out);
  if (!contribute) return out;
  const visible = out
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/<code\b/i.test(visible)) return out;
  return out.replace(/a,\s*code\s*\{/g, 'a{');
}

/** Leftover html-404 dropped-selector CSS after .cta was never in the 404 DOM. Humans see it in view-source. Product skip-link stays. Contribute .cta stays. */
export function stripNotFoundDroppedCtaCss(html) {
  let out = String(html || '');
  const notFound =
    /<h1>Not this page\.<\/h1>/.test(out) ||
    /<title>Not found — \$dasha<\/title>/.test(out);
  if (!notFound) return out;
  const visible = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (/class=["'][^"']*\bcta\b/.test(visible)) return out;
  return out.replace(/\.cta\s*\{[^}]*\}/gi, '');
}

const NOT_FOUND_HTML = htmlPage('Not found — $dasha', `<h1>Not this page.</h1>
<p>Simp Board, Lobby, faucet, and how to buy live on getdasha.com. This URL is not one of them.</p>
<p><code>53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump</code></p>
<p><a href="https://www.getdasha.com/">Home</a> · <a href="https://www.getdasha.com/simp">Simp</a> · <a href="https://www.getdasha.com/lobby">Lobby</a> · <a href="https://www.getdasha.com/faucet">Faucet</a> · <a href="https://www.getdasha.com/how-to-buy">How to buy</a> · <a href="https://www.getdasha.com/privacy">Privacy</a></p>`, { robots: 'noindex,follow' });

function isComputePagePath(pathname) {
  return pathname === '/compute' || pathname === '/compute/' || pathname === '/compute/index.html';
}


function isComputeSkillPath(pathname) {
  return pathname === '/compute/skill/provide.md' || pathname === '/compute/skill/use.md' || pathname === '/compute/skill/ocm-host.md';
}

function computeSkillResponse(request, pathname) {
  let body = USE_SKILL_MD;
  let edge = 'compute-skill-use';
  if (pathname.endsWith('/provide.md')) {
    body = PROVIDE_SKILL_MD;
    edge = 'compute-skill-provide';
  } else if (pathname.endsWith('/ocm-host.md')) {
    body = OCM_HOST_SKILL_MD;
    edge = 'compute-skill-ocm-host';
  }
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'X-Dasha-Edge': edge,
    },
  });
}


/** Bare /compute/api and /compute/api/ must hit computeApi (status), not html-404. */
function isComputeApiPath(pathname) {
  return pathname === '/compute/api' || pathname.startsWith('/compute/api/');
}


function factoryCatalogPayload() {
  const generated_at = new Date().toISOString();
  return {
    schema: 'factory.catalog.v0',
    generated_at,
    note: 'Demigod Labs data factories — counters/samples only; no people-data; prompts not included',
    factories: [
      {
        id: 'compute',
        schema: 'factory.compute.v0',
        url: 'https://lobby.getdasha.com/compute/api/factory',
        www_url: 'https://www.getdasha.com/compute/api/factory',
        status: 'live',
        exhaust: 'hosted|community|mixture job counters + providers_online_latest',
      },
      {
        id: 'demigod',
        schema: 'factory.demigod.v0',
        url: 'https://www.trydemigod.com/factory/demigod.v0.json',
        status: 'sample',
        exhaust: 'company packet + role journal fields only',
      },
    ],
  };
}

function factoryCatalogResponse(request) {
  const body = JSON.stringify(factoryCatalogPayload());
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    'X-Dasha-Edge': 'factory-catalog',
    'Access-Control-Allow-Origin': '*',
  };
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}


/** Leftover /compute id="code-python" / id="code-javascript" after CSS/JS strip.
 * JS never reads getElementById('code-python') or getElementById('code-javascript');
 * CSS never targets #code-python / #code-javascript (tabs paint via .code-tabs button + [data-code]).
 * Humans see them in view-source. Distinct leftover vs leftover meta lecture.
 * Keep #code-curl (aria-labelledby on #code). Keep data-code + role=tab + #code.
 * Compute only. Do not eat #code-curl. Do not fake sponsors.
 */
function isComputeLeftoverCodeTabPage(html) {
  const out = String(html || '');
  return /\bid=["']code-curl["']/.test(out) && /\bid=["']code["']/.test(out) && /\bdata-code=/.test(out);
}

export function stripComputeLeftoverCodePythonJavascriptId(html) {
  let out = String(html || '');
  if (!isComputeLeftoverCodeTabPage(out)) return out;
  return out.replace(/<([a-zA-Z][\w-]*)(\s[^>]*?)>/g, (full, tag, attrs) => {
    if (!/\bid\s*=\s*(['"])(code-python|code-javascript)\1/i.test(attrs)) return full;
    const nextAttrs = attrs.replace(/\s\bid=(['"])(code-python|code-javascript)\1/i, '');
    return '<' + tag + nextAttrs + '>';
  });
}

/** Leftover /compute duplicate CSS after the later .nav button strong rule already
 * serializes display:block + the same clamp + text-transform:uppercase.
 * Live still serializes leftover .nav button strong{font-size:clamp(15px,1.6vw,22px)}
 * (no display, no uppercase). Humans see the duplicate in view-source.
 * Distinct leftover vs leftover id=code-python / leftover meta lecture.
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep the later .nav button strong{display:block;...uppercase} + @media 19px.
 * Keep .nav button + .nav + Use/Provide/Night/Build tabs. Compute only.
 * Do not eat the keeper rule. Do not fake sponsors.
 */
function isComputeLeftoverDupNavButtonStrongPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out) || isComputeLeftoverCodeTabPage(out);
}

export function stripComputeLeftoverDupNavButtonStrongCss(html) {
  let out = String(html || '');
  if (!isComputeLeftoverDupNavButtonStrongPage(out)) return out;
  const leftover = /\.nav button strong\{font-size:clamp\(15px,1\.6vw,22px\)\}/;
  const keep = /\.nav button strong\{display:block;font-size:clamp\(15px,1\.6vw,22px\);text-transform:uppercase\}/;
  if (!leftover.test(out) || !keep.test(out)) return out;
  return out.replace(leftover, '');
}

/** Leftover /compute placeholder text "checking" on #destination / #retention / #visibility.
 * updateRun() overwrites immediately from engine (no network probe). Never paints.
 * Distinct leftover vs leftover duplicate .nav button strong CSS / leftover id=code-python.
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep #gateway-state / #provider-count / #top-state checking placeholders (those wait on auth()).
 * Keep ids + updateRun overwrite + Use/Provide/Night/Build. Compute only.
 * Do not fake sponsors. Do not strip honest hosted Checking….
 */
function isComputeLeftoverFactsCheckingPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /\bid=["']destination["']/.test(out)
    && /\bid=["']retention["']/.test(out)
    && /\bid=["']visibility["']/.test(out)
    && /function updateRun\(/.test(out);
}

export function stripComputeLeftoverFactsCheckingPlaceholder(html) {
  let out = String(html || '');
  if (!isComputeLeftoverFactsCheckingPage(out)) return out;
  const hosted = {
    destination: 'Cloudflare Workers AI',
    retention: 'none by Dasha',
    visibility: 'Cloudflare',
  };
  return out.replace(
    /<dd(\s[^>]*\bid=["'](destination|retention|visibility)["'][^>]*)>checking<\/dd>/g,
    (_, attrs, id) => '<dd' + attrs + '>' + hosted[id] + '</dd>',
  );
}


/** Leftover /compute empty Provide-tab mounts #model-count / #tokens / #gross / #cost / #net / #compatible.
 * paintProvider() overwrites immediately from form defaults (no network probe). Never paints.
 * Distinct leftover vs leftover facts "checking" / leftover duplicate .nav button strong CSS / leftover id=code-python.
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + paintProvider overwrite + Use/Provide/Night/Build. Compute only.
 * Numbers are the inspectable scenario at disk form defaults (M3 Max / M4 Max · 64 GB · 12h · 25% · $1/1M · $0.28/kWh), not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. Do not put Arena/OpenRouter tok/s on /compute as ours.
 */
function isComputeLeftoverEmptyProvideMountsPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /\bid=["']model-count["']/.test(out)
    && /\bid=["']tokens["']/.test(out)
    && /\bid=["']gross["']/.test(out)
    && /\bid=["']cost["']/.test(out)
    && /\bid=["']net["']/.test(out)
    && /\bid=["']compatible["']/.test(out)
    && /function paintProvider\(/.test(out);
}

const COMPUTE_PROVIDE_DEFAULT_COMPATIBLE = [
  '<a class="model" href="https://ollama.com/library/qwen3" target="_blank" rel="noopener noreferrer"><span>Qwen 3 8B<small>fast chat</small></span><strong>5.2 GB</strong></a>',
  '<a class="model" href="https://ollama.com/library/gemma3" target="_blank" rel="noopener noreferrer"><span>Gemma 3 12B<small>vision + chat</small></span><strong>8.1 GB</strong></a>',
  '<a class="model" href="https://ollama.com/library/gpt-oss" target="_blank" rel="noopener noreferrer"><span>GPT-OSS 20B<small>reasoning + tools</small></span><strong>14 GB</strong></a>',
  '<a class="model" href="https://ollama.com/library/qwen3" target="_blank" rel="noopener noreferrer"><span>Qwen 3 30B A3B<small>efficient reasoning</small></span><strong>19 GB</strong></a>',
  '<a class="model" href="https://ollama.com/library/gemma3" target="_blank" rel="noopener noreferrer"><span>Gemma 3 27B<small>large multimodal</small></span><strong>17 GB</strong></a>',
].join('');

export function stripComputeLeftoverEmptyProvideMounts(html) {
  let out = String(html || '');
  if (!isComputeLeftoverEmptyProvideMountsPage(out)) return out;
  out = out.replace(/<h3(\s[^>]*\bid=["']model-count["'][^>]*)><\/h3>/, (_, attrs) => '<h3' + attrs + '>5 compatible models</h3>');
  out = out.replace(/<div(\s[^>]*\bid=["']tokens["'][^>]*)><\/div>/, (_, attrs) => '<div' + attrs + '>12.3M <small>tokens/mo</small></div>');
  out = out.replace(/<dd(\s[^>]*\bid=["']gross["'][^>]*)><\/dd>/, (_, attrs) => '<dd' + attrs + '>$12.31</dd>');
  out = out.replace(/<dd(\s[^>]*\bid=["']cost["'][^>]*)><\/dd>/, (_, attrs) => '<dd' + attrs + '>\u2212$6.85</dd>');
  out = out.replace(/<dd(\s[^>]*\bid=["']net["'][^>]*)><\/dd>/, (_, attrs) => {
    let next = attrs;
    if (!/\bclass\s*=/.test(next)) next += ' class="positive"';
    return '<dd' + next + '>$5.46</dd>';
  });
  out = out.replace(/<div(\s[^>]*\bid=["']compatible["'][^>]*)><\/div>/, (_, attrs) => '<div' + attrs + '>' + COMPUTE_PROVIDE_DEFAULT_COMPATIBLE + '</div>');
  return out;
}


/** Leftover /compute empty #recommend / #setup after paintProvider overwrite.
 * paintProvider() overwrites immediately from form defaults (no network probe). Never paints.
 * Distinct leftover vs leftover empty Provide mounts #model-count / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + paintProvider overwrite + Use/Provide/Night/Build. Compute only.
 * Copy is paintProvider form-default (M3 Max / M4 Max · 64 GB → Recommended: Gemma 3 27B + doctor curl), not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking….
 */
function isComputeLeftoverEmptyRecommendSetupPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /\bid=["']recommend["']/.test(out)
    && /\bid=["']setup["']/.test(out)
    && /function paintProvider\(/.test(out);
}

const COMPUTE_PROVIDE_DEFAULT_SETUP = [
  'curl -fLO https://www.getdasha.com/dasha-compute-open-alpha.tar.gz',
  'tar -xzf dasha-compute-open-alpha.tar.gz',
  'cd dasha-compute-open-alpha',
  'ollama pull gemma3:27b',
  'DASHA_MODEL_MAP=gemma3-27b=gemma3:27b python3 provider/agent.py --doctor',
].join('\n');

export function stripComputeLeftoverEmptyRecommendSetup(html) {
  let out = String(html || '');
  if (!isComputeLeftoverEmptyRecommendSetupPage(out)) return out;
  out = out.replace(/<h3(\s[^>]*\bid=["']recommend["'][^>]*)><\/h3>/, (_, attrs) => '<h3' + attrs + '>Recommended: Gemma 3 27B</h3>');
  out = out.replace(/<pre(\s[^>]*\bid=["']setup["'][^>]*)><\/pre>/, (_, attrs) => '<pre' + attrs + '>' + COMPUTE_PROVIDE_DEFAULT_SETUP + '</pre>');
  return out;
}


/** Leftover /compute empty #request-json / #code after paintRequest / paintCode overwrite.
 * paintRequest() / paintCode() overwrite immediately from form defaults (no network probe). Never paints.
 * Distinct leftover vs leftover empty #recommend / #setup / leftover empty Provide mounts / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + paintRequest / paintCode overwrite + #code-curl. Compute only.
 * Copy is hosted-engine default JSON + curl example at disk gateway URL, not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. id=code-python stays dropped.
 */
function isComputeLeftoverEmptyRequestJsonCodePage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /\bid=["']request-json["']/.test(out)
    && /\bid=["']code["']/.test(out)
    && /function paintRequest\(/.test(out)
    && /function paintCode\(/.test(out);
}

const COMPUTE_REQUEST_DEFAULT_JSON = [
  '{',
  '  "messages": [',
  '    {',
  '      "role": "user",',
  '      "content": "Explain why idle Macs are useful for local AI in two sentences."',
  '    }',
  '  ]',
  '}',
].join('\n');

const COMPUTE_CODE_DEFAULT_CURL = [
  'curl https://lobby.getdasha.com/compute/api/v1/chat/completions \\',
  '  -H "Authorization: Bearer $DASHA_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  '  -d \'{"model":"qwen3-8b","messages":[{"role":"user","content":"hello"}],"stream":true}\'',
].join('\n');

export function stripComputeLeftoverEmptyRequestJsonCode(html) {
  let out = String(html || '');
  if (!isComputeLeftoverEmptyRequestJsonCodePage(out)) return out;
  out = out.replace(/<pre(\s[^>]*\bid=["']request-json["'][^>]*)><\/pre>/, (_, attrs) => '<pre' + attrs + '>' + COMPUTE_REQUEST_DEFAULT_JSON + '</pre>');
  out = out.replace(/<pre(\s[^>]*\bid=["']code["'][^>]*)><\/pre>/, (_, attrs) => '<pre' + attrs + '>' + COMPUTE_CODE_DEFAULT_CURL + '</pre>');
  return out;
}

/** Leftover /compute stale #count after paintRequest overwrite.
 * paintRequest() overwrites immediately from form defaults (no network probe). Never paints.
 * Distinct leftover vs leftover empty #request-json / #code / leftover empty #recommend / leftover empty Provide mounts / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + paintRequest overwrite + #request-json / #code fills + #code-curl. Compute only.
 * Copy is hosted-engine default prompt length, not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. id=code-python stays dropped.
 */
function isComputeLeftoverStaleCountPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /\bid=["']count["']/.test(out)
    && /function paintRequest\(/.test(out);
}

const COMPUTE_COUNT_DEFAULT = '63 / 2,000 characters · 0 turns kept · Enter to run · Shift+Enter for a new line';

export function stripComputeLeftoverStaleCount(html) {
  let out = String(html || '');
  if (!isComputeLeftoverStaleCountPage(out)) return out;
  out = out.replace(/<span(\s[^>]*\bid=["']count["'][^>]*)>0 characters · nothing sent<\/span>/, (_, attrs) => '<span' + attrs + '>' + COMPUTE_COUNT_DEFAULT + '</span>');
  return out;
}

/** Leftover /compute stale #route-note after updateRun overwrite.
 * updateRun() overwrites immediately from hosted engine default (no network probe). Never paints.
 * Distinct leftover vs leftover stale #count / leftover empty #request-json / leftover empty #recommend / leftover empty Provide mounts / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + updateRun overwrite + community-operator product copy in JS + #count fill + #request-json / #code fills + #code-curl. Compute only.
 * Copy is hosted-engine default route note, not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. id=code-python stays dropped.
 */
function isComputeLeftoverStaleRouteNotePage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /\bid=["']route-note["']/.test(out)
    && /function updateRun\(/.test(out);
}

const COMPUTE_ROUTE_NOTE_DEFAULT = 'Hosted GPT-OSS 20B · 3 requests per 10 minutes · Cloudflare Workers AI.';

export function stripComputeLeftoverStaleRouteNote(html) {
  let out = String(html || '');
  if (!isComputeLeftoverStaleRouteNotePage(out)) return out;
  out = out.replace(/<p(\s[^>]*\bid=["']route-note["'][^>]*)>Hosted: GPT-OSS 20B · Community: prompts are visible to the Mac operator\.<\/p>/, (_, attrs) => '<p' + attrs + '>' + COMPUTE_ROUTE_NOTE_DEFAULT + '</p>');
  return out;
}

/** Leftover /compute empty #model after MODELS.forEach overwrite.
 * MODELS.forEach overwrites immediately from disk models (no network probe). Never paints.
 * Distinct leftover vs leftover stale #route-note / leftover stale #count / leftover empty #request-json / leftover empty #recommend / leftover empty Provide mounts / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + MODELS.forEach overwrite + #chip / #ram / #night-model empty leftovers + #count fill + #request-json / #code fills + #code-curl + route-note fill. Compute only.
 * Options are disk MODELS labels + selected qwen3-30b-a3b after MODELS.forEach, not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. id=code-python stays dropped.
 */
function isComputeLeftoverEmptyModelSelectPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /<select\b[^>]*\bid=["']model["'][^>]*><\/select>/.test(out)
    && /MODELS\.forEach\(/.test(out);
}

const COMPUTE_MODEL_DEFAULT_OPTIONS = [
  '<option value="qwen3-8b">Qwen 3 8B · 5.2 GB · fast chat</option>',
  '<option value="gemma3-12b">Gemma 3 12B · 8.1 GB · vision + chat</option>',
  '<option value="gpt-oss-20b">GPT-OSS 20B · 14 GB · reasoning + tools</option>',
  '<option value="qwen3-30b-a3b" selected>Qwen 3 30B A3B · 19 GB · efficient reasoning</option>',
  '<option value="gemma3-27b">Gemma 3 27B · 17 GB · large multimodal</option>',
  '<option value="gpt-oss-120b">GPT-OSS 120B · 65 GB · large reasoning</option>',
].join('');

export function stripComputeLeftoverEmptyModelSelect(html) {
  let out = String(html || '');
  if (!isComputeLeftoverEmptyModelSelectPage(out)) return out;
  out = out.replace(/<select(\s[^>]*\bid=["']model["'][^>]*)><\/select>/, (_, attrs) => '<select' + attrs + '>' + COMPUTE_MODEL_DEFAULT_OPTIONS + '</select>');
  return out;
}

/** Leftover /compute empty #chip after Object.keys(CHIPS).forEach overwrite.
 * Object.keys(CHIPS).forEach overwrites immediately from disk chips (no network probe). Never paints.
 * Distinct leftover vs leftover empty #model / leftover stale #route-note / leftover stale #count / leftover empty #request-json / leftover empty #recommend / leftover empty Provide mounts / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + Object.keys(CHIPS).forEach overwrite + #ram / #night-model empty leftovers + filled #model + #count fill + #request-json / #code fills + #code-curl + route-note fill. Compute only.
 * Options are disk CHIPS keys + selected M3 Max / M4 Max after Object.keys(CHIPS).forEach, not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. Do not fill #ram or #night-model this ship. id=code-python stays dropped.
 */
function isComputeLeftoverEmptyChipSelectPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /<select\b[^>]*\bid=["']chip["'][^>]*><\/select>/.test(out)
    && /Object\.keys\(CHIPS\)\.forEach/.test(out);
}

const COMPUTE_CHIP_DEFAULT_OPTIONS = [
  '<option value="M1 / M2">M1 / M2</option>',
  '<option value="M1 Pro / M2 Pro">M1 Pro / M2 Pro</option>',
  '<option value="M1 Max / M2 Max">M1 Max / M2 Max</option>',
  '<option value="M3 Pro / M4 Pro">M3 Pro / M4 Pro</option>',
  '<option value="M3 Max / M4 Max" selected>M3 Max / M4 Max</option>',
  '<option value="M2 Ultra / M3 Ultra">M2 Ultra / M3 Ultra</option>',
].join('');

export function stripComputeLeftoverEmptyChipSelect(html) {
  let out = String(html || '');
  if (!isComputeLeftoverEmptyChipSelectPage(out)) return out;
  out = out.replace(/<select(\s[^>]*\bid=["']chip["'][^>]*)><\/select>/, (_, attrs) => '<select' + attrs + '>' + COMPUTE_CHIP_DEFAULT_OPTIONS + '</select>');
  return out;
}

/** Leftover /compute empty #ram after RAM.forEach overwrite.
 * RAM.forEach overwrites immediately from disk RAM (no network probe). Never paints.
 * Distinct leftover vs leftover empty #chip / leftover empty #model / leftover stale #route-note / leftover stale #count / leftover empty #request-json / leftover empty #recommend / leftover empty Provide mounts / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + RAM.forEach overwrite + #night-model empty leftover + filled #chip / #model + #count fill + #request-json / #code fills + #code-curl + route-note fill. Compute only.
 * Options are disk RAM values + selected 64 after RAM.forEach, not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. Do not fill #night-model this ship. id=code-python stays dropped.
 */
function isComputeLeftoverEmptyRamSelectPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /<select\b[^>]*\bid=["']ram["'][^>]*><\/select>/.test(out)
    && /RAM\.forEach\(/.test(out);
}

const COMPUTE_RAM_DEFAULT_OPTIONS = [
  '<option value="8">8 GB</option>',
  '<option value="16">16 GB</option>',
  '<option value="24">24 GB</option>',
  '<option value="32">32 GB</option>',
  '<option value="48">48 GB</option>',
  '<option value="64" selected>64 GB</option>',
  '<option value="96">96 GB</option>',
  '<option value="128">128 GB</option>',
  '<option value="192">192 GB+</option>',
].join('');

export function stripComputeLeftoverEmptyRamSelect(html) {
  let out = String(html || '');
  if (!isComputeLeftoverEmptyRamSelectPage(out)) return out;
  out = out.replace(/<select(\s[^>]*\bid=["']ram["'][^>]*)><\/select>/, (_, attrs) => '<select' + attrs + '>' + COMPUTE_RAM_DEFAULT_OPTIONS + '</select>');
  return out;
}

/** Leftover /compute empty #night-model after MODELS.forEach overwrite.
 * MODELS.forEach overwrites immediately from disk MODELS (no network probe). Never paints.
 * Distinct leftover vs leftover empty #ram / leftover empty #chip / leftover empty #model / leftover stale #route-note / leftover stale #count / leftover empty #request-json / leftover empty #recommend / leftover empty Provide mounts / leftover facts "checking".
 * Checking… hosted/login chrome stays (honest in-flight probe until auth()).
 * Keep ids + MODELS.forEach overwrite + filled #ram / #chip / #model + #count fill + #request-json / #code fills + #code-curl + route-note fill. Compute only.
 * Options are disk MODELS m[2] · m[3] + selected qwen3-8b after MODELS.forEach, not sponsor P&L.
 * Do not fake sponsors. Do not strip honest hosted Checking…. Last empty compute select leftover. id=code-python stays dropped.
 */
function isComputeLeftoverEmptyNightModelSelectPage(html) {
  const out = String(html || '');
  return /<h1>Make the Macs do something\.<\/h1>/.test(out)
    && /<select\b[^>]*\bid=["']night-model["'][^>]*><\/select>/.test(out)
    && /MODELS\.forEach\(/.test(out);
}

const COMPUTE_NIGHT_MODEL_DEFAULT_OPTIONS = [
  '<option value="qwen3-8b" selected>Qwen 3 8B · 5.2 GB</option>',
  '<option value="gemma3-12b">Gemma 3 12B · 8.1 GB</option>',
  '<option value="gpt-oss-20b">GPT-OSS 20B · 14 GB</option>',
  '<option value="qwen3-30b-a3b">Qwen 3 30B A3B · 19 GB</option>',
  '<option value="gemma3-27b">Gemma 3 27B · 17 GB</option>',
  '<option value="gpt-oss-120b">GPT-OSS 120B · 65 GB</option>',
].join('');

export function stripComputeLeftoverEmptyNightModelSelect(html) {
  let out = String(html || '');
  if (!isComputeLeftoverEmptyNightModelSelectPage(out)) return out;
  out = out.replace(/<select(\s[^>]*\bid=["']night-model["'][^>]*)><\/select>/, (_, attrs) => '<select' + attrs + '>' + COMPUTE_NIGHT_MODEL_DEFAULT_OPTIONS + '</select>');
  return out;
}


function computePageResponse(request) {
  /* Leftover /compute empty #night-model after MODELS.forEach overwrite. */
  const page = stripComputeLeftoverEmptyNightModelSelect(stripComputeLeftoverEmptyRamSelect(stripComputeLeftoverEmptyChipSelect(stripComputeLeftoverEmptyModelSelect(stripComputeLeftoverStaleRouteNote(stripComputeLeftoverStaleCount(stripComputeLeftoverEmptyRequestJsonCode(stripComputeLeftoverEmptyRecommendSetup(stripComputeLeftoverEmptyProvideMounts(stripComputeLeftoverFactsCheckingPlaceholder(stripComputeLeftoverDupNavButtonStrongCss(stripComputeLeftoverCodePythonJavascriptId(COMPUTE_PAGE_HTML))))))))))));
  return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(page), {
    status: 200,
    headers: htmlLlmsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Dasha-Edge': 'compute',
    }),
  });
}

function computeKitResponse(request, env) {
  if (!env?.ASSETS?.fetch) return new Response(null, { status: 404, headers: { 'X-Dasha-Edge': 'compute-kit' } });
  return env.ASSETS.fetch(request);
}

function crewPageResponse(request) {
  const html = stripSimpFromMenuAndFooter(attachLlmsHtmlLinks(applyCrewShareOg(CREW_PAGE_HTML, request.url)));
  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: htmlLlmsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Dasha-Edge': 'crew',
    }),
  });
}

function crewKitResponse(request, env) {
  if (!env?.ASSETS?.fetch) return new Response(null, { status: 404, headers: { 'X-Dasha-Edge': 'crew-kit' } });
  return env.ASSETS.fetch(request);
}


function privacyPageResponse(request) {
  return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(stripPrivacyLeftoverCodeCss(stripPrivacyDroppedCtaCss(PRIVACY_HTML))), {
    status: 200,
    headers: htmlLlmsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Dasha-Edge': 'privacy',
    }),
  });
}

function loginPageResponse(request) {
  return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(LOGIN_PAGE_HTML), {
    status: 200,
    headers: htmlLlmsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Dasha-Edge': 'login',
    }),
  });
}

function proxyChessApi(request, env) {
  const origin = request.headers.get('Origin');
  const allowed =
    origin && originAllowed(origin, env?.ALLOWED_ORIGINS || '')
      ? origin
      : env?.ALLOW_ANY_ORIGIN
        ? origin || '*'
        : null;
  const corsOrigin = allowed || (origin === 'https://www.getdasha.com' || origin === 'https://getdasha.com' ? origin : 'https://www.getdasha.com');
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
      },
    });
  }
  if (!env?.LOBBY) {
    return json({ error: CHESS_DOWN_MSG }, 503, corsOrigin, { credentials: true });
  }
  const room = env.LOBBY.idFromName('public');
  return env.LOBBY.get(room).fetch(request);
}

const CONTRIBUTE_HTML = htmlPage('Contribute to Dasha', `<h1>Build Dasha.</h1>
<p>Open a pull request.</p>
<p><a class="cta" href="https://github.com/Uuriko/dasha-desk/contribute" target="_blank" rel="noopener noreferrer">Pick a first issue ↗</a></p>
<p><a href="https://github.com/Uuriko/dasha-desk/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Read the guide ↗</a> · <a href="https://github.com/Uuriko/dasha-desk/discussions/categories/ideas" target="_blank" rel="noopener noreferrer">Propose an idea ↗</a></p>
<p><a href="https://www.getdasha.com/">Home</a> · <a href="https://www.getdasha.com/lobby">Lobby</a></p>`, { path: '/contribute', description: 'Build Dasha. Open a pull request.' });

function contributePageResponse(request) {
  /* Leftover /contribute dropped-selector CSS after <code> was never in the contribute DOM. Keep a color + .cta. */
  return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(stripContributeLeftoverCodeCss(CONTRIBUTE_HTML)), {
    status: 200,
    headers: htmlLlmsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Dasha-Edge': 'contribute',
    }),
  });
}

const PRIVACY_HTML = htmlPage('Dasha privacy', `<h1>Privacy</h1>
<p>Updated 4 September 2026.</p>
<h2>What Dasha uses</h2>
<p>Logging in with X uses X OAuth. It reads your X account ID, handle, display name, avatar, and verification type. Wallet login stores the signed-in public address only in the signed browser session after a wallet signature on a one-time login message; it checks no balance and sends no transaction. That signature is checked and not kept. Grok Bot login stores a browser session after you confirm a one-time code in Grok Bot. Those sessions are HttpOnly Secure cookies and last up to 30 days. Dasha does not store the X access token.</p>
<p>Faucet claims need a linked X account, one per day. Abuse sits you out. Dasha never asks for wallet keys. Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards.</p>
<p>If you join the Simp Board or finish its scored quiz, Dasha stores your linked identity, score, badges, contribution links, optional Spotlight profile link, referral milestones, and dated holder-badge status. Referral links record the inviter and invited X-linked Board identities until either person leaves; uncompleted claims are removed after expiry on the next Board or referral request. The wallet address and balance used for that optional badge are checked once and are not retained. Lobby history is limited to roughly 30 minutes and 40 messages. Lobby threads can retain a score-neutral mark that holder proof was current when posted; private X IDs deduplicate score-neutral post reactions until the thread expires or is removed, while only counts are public. Completed chess games are public replays showing both X handles, ratings, moves, result, and completion time. Quiz, referral, and chess funnel counts are aggregate only.</p>
<h2>Compute</h2>
<p>Hosted Ask runs on Cloudflare Workers AI. Dasha answers with stored:false — Hosted prompts and completions are not kept in Compute storage. Community and Mixture hand the assigned prompt to a peer Mac; operators can read jobs on their machine (same honesty as the Use skill). After a Community job finishes, messages clear from storage; the answer can linger about ten minutes, then expires. Queued Community jobs expire in about five minutes if no Mac picks them up. Night tasks keep their prompt until you delete them.</p>
<p>Compute also stores API key hashes (SHA-256) plus a short prefix — the full key is shown once at mint and not kept. Credit balances, top-up orders (~30 minutes), spend and ledger rows stay with the account. Provider earnings rows keep USDC-cent totals, job counts, and completion-token totals, plus a per-job accrual replay key. Job metadata keeps model, route, status, and usage counts. Factory counters are counts only — prompts not included. No Compute training job runs on your prompts in this Worker.</p>
<h2>How it is used</h2>
<p>The data provides linked chat identity, Board ranking, quiz results, contribution review, moderation, and optional holder recognition. Public Board rows and season snapshots can show your handle, avatar, score, badges, accepted evidence links, and optional Spotlight profile link. Compute uses stored rows to route jobs, debit credits, show provider earnings, and authenticate API keys. Dasha does not post to X or sell identity data.</p>
<p>Webflow serves the site and Cloudflare hosts the service. Hosted Ask uses Cloudflare Workers AI. X processes OAuth and serves some public images; other public images may load from Wikimedia. Those image hosts receive ordinary request metadata without a page referrer. A Solana RPC receives a wallet address only during an optional holder check or Compute credit / sponsor verify; wallet login itself does not query the chain.</p>
<h2>Control and deletion</h2>
<p>Unlink clears the signed browser session. Leave Board removes your profile, referral identity, claims, active quiz state, current linked result, holder challenge, chess rating, games and tournaments involving you, and your rows from retained season snapshots. Anonymous aggregate counts remain. On Compute, delete a job or Night task to clear its prompt; revoke an API key to drop its hash row.</p>
<p>For access or deletion requests, use the repository's <a href="https://github.com/Uuriko/dasha-desk/security/advisories/new">private report</a>. Do not include wallet keys or seed phrases.</p>
<p><a href="https://www.getdasha.com/">Back to Dasha</a> · <a href="https://www.getdasha.com/compute">Compute</a> · <a href="https://www.getdasha.com/how-to-buy">How to buy</a> · <a href="https://www.getdasha.com/faucet">Faucet</a></p>`, { path: '/privacy', description: 'What Dasha stores, and how to leave.' });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function isoDate(value) {
  const timestamp = Number(value);
  const date = new Date(timestamp);
  return Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function xProfileUrl(handle) {
  const value = String(handle || '');
  return /^[A-Za-z0-9_]{1,15}$/.test(value) ? `https://x.com/${value}` : '';
}

function simpProfileUrl(handle, value) {
  const clean = String(handle || '').toLowerCase();
  const canonical = /^[a-z0-9_]{1,15}$/.test(clean) ? `https://www.getdasha.com/simp/u/${clean}` : '';
  return canonical && String(value || '') === canonical ? canonical : '';
}

function xAuthorHtml(handle, profileUrl) {
  const simp = simpProfileUrl(handle, profileUrl);
  const url = simp || xProfileUrl(handle);
  const label = `@${escapeHtml(handle || '')}`;
  return url ? `<a class="df-author" href="${url}"${simp ? '' : ' target="_blank" rel="noopener noreferrer nofollow ugc"'}>${label}</a>` : label;
}

/** First paint for an existing /lobby?t= permalink; the forum client replaces it with the same data. */
export function forumThreadPageHtml(html, thread, posts) {
  const id = String(thread?.id || '');
  const list = Array.isArray(posts) ? posts : [];
  const opener = list[0];
  const published = isoDate(opener?.ts);
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !thread?.title || !opener?.text || !Number.isFinite(Date.parse(published))) return html;
  const pageUrl = `https://www.getdasha.com/lobby?t=${encodeURIComponent(id)}`;
  const liveReplies = list.slice(1).filter(post => post && !post.deleted && post.text && isoDate(post.ts));
  const author = post => {
    const handle = String(post.handle || '');
    const x = xProfileUrl(handle);
    const profile = simpProfileUrl(handle, post.simpUrl);
    return { '@type': 'Person', name: `@${handle.slice(0, 15)}`, ...(profile ? { url: profile, sameAs: [x] } : x ? { url: x } : {}) };
  };
  const reactionCount = post => {
    const count = Number(post?.reactionCount);
    return Number.isInteger(count) && count > 0 && count <= MAX_REACTORS ? count : 0;
  };
  const interactionStatistic = post => {
    const count = reactionCount(post);
    return count ? {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/LikeAction',
      userInteractionCount: count,
    } : null;
  };
  const comment = liveReplies.map(post => ({
    '@type': 'Comment',
    text: String(post.text),
    author: author(post),
    datePublished: isoDate(post.ts),
    url: `${pageUrl}#post-${encodeURIComponent(String(post.id || ''))}`,
    ...(isoDate(post.editedAt) ? { dateModified: isoDate(post.editedAt) } : {}),
    ...(interactionStatistic(post) ? { interactionStatistic: interactionStatistic(post) } : {}),
  }));
  const data = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    mainEntityOfPage: pageUrl,
    headline: String(thread.title),
    text: String(opener.text),
    url: pageUrl,
    author: author(opener),
    datePublished: published,
    ...(interactionStatistic(opener) ? { interactionStatistic: interactionStatistic(opener) } : {}),
    commentCount: liveReplies.length,
    ...(isoDate(opener.editedAt) ? { dateModified: isoDate(opener.editedAt) } : {}),
    ...(comment.length ? { comment } : {}),
  };
  const renderPost = post => {
    const anchor = `post-${String(post.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)}`;
    const date = isoDate(post.ts);
    const holder = post.holder ? '<span class="lobby-holder-badge" title="Holder proof was current when posted">$dasha holder</span>' : '';
    const count = reactionCount(post);
    const reactions = count ? ` · <span class="df-reaction">♥ ${count}</span>` : '';
    const quoteId = String(post.quote?.id || '');
    const quoteHandle = /^[A-Za-z0-9_-]{1,48}$/.test(quoteId)
      ? `<a class="df-quote-handle" href="${pageUrl}#post-${quoteId}" aria-label="View quoted post by @${escapeHtml(post.quote.handle || '')}">@${escapeHtml(post.quote.handle || '')}</a>`
      : `<span class="df-quote-handle">@${escapeHtml(post.quote?.handle || '')}</span>`;
    const quote = !post.deleted && post.quote?.id
      ? `<blockquote class="df-quote">${quoteHandle} ${escapeHtml(post.quote.text || '')}</blockquote>`
      : '';
    return `<article class="df-post" id="${anchor}"><p class="df-meta">${xAuthorHtml(post.handle, post.simpUrl)} · <a class="df-post-link" href="${pageUrl}#${anchor}" aria-label="Post permalink"><time datetime="${date}">${date.slice(0, 10)}</time></a>${post.editedAt ? ' · edited' : ''}${holder}${reactions}</p><p class="df-body">${post.deleted ? 'deleted' : escapeHtml(post.text || '').replace(/\n/g, '<br>')}</p>${quote}</article>`;
  };
  const title = escapeHtml(`${thread.title} — $dasha Lobby`);
  const description = escapeHtml(String(opener.text).replace(/\s+/g, ' ').trim().slice(0, 160));
  const imageUrl = `https://www.getdasha.com/lobby/card/${encodeURIComponent(id)}.png`;
  const firstPaint = `<div class="df-tools"><a class="df-back" href="/lobby?pane=threads#threads">← All threads</a></div><h2 class="df-title">${escapeHtml(thread.title)}</h2><div class="df-posts">${list.map(renderPost).join('')}</div>`;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return String(html)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${pageUrl}">`)
    .replace(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="article">')
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${pageUrl}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${imageUrl}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="600"><meta property="og:image:height" content="314"><meta property="og:image:alt" content="${title}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${description}">`)
    .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${imageUrl}"><meta name="twitter:image:alt" content="${title}">`)
    .replace('</head>', `<script type="application/ld+json">${json}</script></head>`)
    .replace('class="lp-hold" data-pane="now"', 'class="lp-hold" data-pane="threads"')
    .replace('id="tab-now" role="tab" aria-controls="dasha-lobby" aria-selected="true"', 'id="tab-now" role="tab" aria-controls="dasha-lobby" aria-selected="false"')
    .replace('id="tab-threads" role="tab" aria-controls="dasha-forum" aria-selected="false"', 'id="tab-threads" role="tab" aria-controls="dasha-forum" aria-selected="true"')
    .replace(/<div id="dasha-forum"([^>]*)><\/div>/, `<div id="dasha-forum"$1>${firstPaint}</div>`);
}

/** Crawlable first page for the existing Lobby forum pane; the client takes over after load. */
export function forumIndexPageHtml(html, threads) {
  const list = (Array.isArray(threads) ? threads : [])
    .filter(thread => /^[A-Za-z0-9_-]{1,40}$/.test(String(thread?.id || '')) && thread?.title)
    .slice(0, 50);
  const rows = list.map(thread => {
    const pageUrl = `https://www.getdasha.com/lobby?t=${encodeURIComponent(thread.id)}`;
    const replies = Math.max(0, Number(thread.replies) || 0);
    const reactionCount = Number(thread.reactions);
    const reactions = Number.isInteger(reactionCount) && reactionCount > 0 && reactionCount <= MAX_POSTS * MAX_REACTORS ? ` · ♥ ${reactionCount}` : '';
    const date = isoDate(thread.lastTs ?? thread.ts);
    const holder = thread.holder ? '<span class="lobby-holder-badge" title="Holder proof was current when posted">$dasha holder</span>' : '';
    const snippet = thread.snippet ? `<p class="df-snippet">${escapeHtml(String(thread.snippet).slice(0, 180))}</p>` : '';
    return `<article class="df-row"><div class="df-row-main"><a class="df-open" href="${pageUrl}">${escapeHtml(thread.title)}</a><p class="df-meta">${xAuthorHtml(thread.handle, thread.simpUrl)} · ${replies} ${replies === 1 ? 'reply' : 'replies'}${reactions}${date ? ` · <time datetime="${date}">${date.slice(0, 10)}</time>` : ''}${holder}</p>${snippet}</div></article>`;
  }).join('');
  const firstPaint = `<div class="df-head"><h2 class="df-title">Lobby</h2><p class="df-note">Official room. Read freely. Link X in the lobby to post. · <a class="df-feed" href="https://www.getdasha.com/lobby/feed.xml" type="application/rss+xml" aria-label="Subscribe to public forum threads with RSS">RSS</a></p></div>${rows ? `<div class="df-list">${rows}</div>` : '<p class="df-empty">Start the first thread: meme, question, or build idea.</p>'}`;
  return String(html).replace(/<div id="dasha-forum"([^>]*)><\/div>/, `<div id="dasha-forum"$1>${firstPaint}</div>`);
}

/** RSS 2.0 over the same bounded public index used by first paint and the sitemap. */
export function forumRssXml(threads) {
  const list = [...new Map((Array.isArray(threads) ? threads : [])
    .filter(thread => /^[A-Za-z0-9_-]{1,40}$/.test(String(thread?.id || '')) && thread?.title)
    .map(thread => [String(thread.id), thread])).values()].slice(0, 50);
  const latest = list.map(thread => isoDate(thread.lastTs ?? thread.ts)).filter(Boolean).sort().pop();
  const items = list.map(thread => {
    const url = `https://www.getdasha.com/lobby?t=${encodeURIComponent(thread.id)}`;
    const modified = isoDate(thread.lastTs ?? thread.ts);
    const date = modified ? `<pubDate>${new Date(modified).toUTCString()}</pubDate>` : '';
    const description = thread.snippet ? `<description>${escapeHtml(String(thread.snippet).slice(0, 280))}</description>` : '';
    return `<item><title>${escapeHtml(thread.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid>${description}${date}</item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>$dasha Lobby</title><link>https://www.getdasha.com/lobby</link><description>Lasting public threads from the $dasha community.</description><atom:link href="https://www.getdasha.com/lobby/feed.xml" rel="self" type="application/rss+xml" />${latest ? `<lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>` : ''}${items}</channel></rss>\n`;
}

/** Add the bounded public forum index to the canonical www sitemap. */
export function forumSitemapXml(xml, threads) {
  void threads;
  return String(xml);
}

/** Add only the already-enumerated public top-50 Simp profiles. */
export function simpSitemapXml(xml, members) {
  const handles = [...new Set((Array.isArray(members) ? members : [])
    .map(member => String(member?.handle || '').replace(/^@/, '').toLowerCase())
    .filter(handle => /^[a-z0-9_]{1,15}$/.test(handle)))].slice(0, 50);
  if (!handles.length) return String(xml);
  const rows = handles.map(handle => `  <url>\n    <loc>https://www.getdasha.com/simp/u/${handle}</loc>\n  </url>`).join('\n');
  return String(xml).replace(/\s*<\/urlset>\s*$/, `\n${rows}\n</urlset>\n`);
}

export function personalizeChessPage(html, { title, description, url, robots = 'index,follow' }) {
  const safeTitle = escapeHtml(String(title || 'Dasha Chess').slice(0, 100));
  const safeDescription = escapeHtml(String(description || 'Dasha versus Anna. Holder-only rated chess.').slice(0, 180));
  const safeUrl = escapeHtml(String(url || 'https://www.getdasha.com/chess'));
  const safeRobots = robots === 'noindex,follow' ? robots : 'index,follow';
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${safeUrl}">`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${safeDescription}">`)
    .replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${safeRobots}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${safeUrl}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${safeTitle}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${safeDescription}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${safeTitle}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${safeDescription}">`);
}

async function chessPageForRequest(request, env) {
  if (request.method === 'HEAD' || !env?.LOBBY) return finishChessPage(CHESS_PAGE_HTML, new URL(request.url));
  const url = new URL(request.url);
  const gameId = url.searchParams.get('game');
  const tournamentId = url.searchParams.get('tournament');
  const challengeId = url.searchParams.get('challenge');
  const valid = value => /^[A-Za-z0-9_-]{6,24}$/.test(value || '');
  const apiPath = valid(gameId) ? `/chess/replay/${gameId}` : valid(challengeId) ? `/chess/challenge/${challengeId}` : valid(tournamentId) ? `/chess/tournament/${tournamentId}` : '';
  const generic = isProductHost(url.hostname)
    ? personalizeChessPage(CHESS_PAGE_HTML, {
        title: 'Dasha Chess',
        description: 'Dasha versus Anna. Holder-only rated chess.',
        url: 'https://www.getdasha.com/chess',
      })
    : CHESS_PAGE_HTML;
  if (!apiPath) return finishChessPage(generic, url);
  try {
    const room = env.LOBBY.idFromName('public');
    const response = await env.LOBBY.get(room).fetch(new Request(`https://lobby.getdasha.com${apiPath}`));
    if (!response.ok) return finishChessPage(generic, url);
    const data = await response.json();
    if (data.replay) {
      const replay = data.replay;
      return finishChessPage(personalizeChessPage(CHESS_PAGE_HTML, {
        title: `@${replay.white.handle} ${replay.result} @${replay.black.handle} — Dasha Chess`,
        description: `${replay.moves.length} moves · ${replay.reason} · Replay every move.`,
        url: `https://www.getdasha.com/chess?game=${encodeURIComponent(replay.id)}`,
      }));;
    }
    if (data.tournament) {
      const tournament = data.tournament;
      const state = tournament.status === 'registration' ? 'Open tournament' : tournament.status === 'active' ? 'Tournament in progress' : `${tournament.champion || 'Champion'} wins`;
      return finishChessPage(personalizeChessPage(CHESS_PAGE_HTML, {
        title: `${tournament.name} — Dasha Chess`,
        description: `${state} · ${tournament.entrants.length}/${tournament.maxPlayers} players.`,
        url: `https://www.getdasha.com/chess?tournament=${encodeURIComponent(tournament.id)}`,
      }));;
    }
    if (data.challenge) {
      const challenge = data.challenge;
      const state = challenge.status === 'open' ? 'Take Anna. Dasha has white.' : challenge.status === 'accepted' ? 'The table is claimed.' : 'This table is closed.';
      const title = challenge.status === 'open'
        ? `${challenge.creator} challenges you — Dasha Chess`
        : challenge.status === 'accepted'
          ? `${challenge.creator}'s table is claimed — Dasha Chess`
          : `${challenge.creator}'s table is closed — Dasha Chess`;
      return finishChessPage(personalizeChessPage(CHESS_PAGE_HTML, {
        title,
        description: state,
        url: `https://www.getdasha.com/chess?challenge=${encodeURIComponent(challenge.id)}`,
        robots: 'noindex,follow',
      }));;
    }
  } catch {
    /* generic card remains available */
  }
  return finishChessPage(generic, url);
}

function finishChessPage(html, url) {
  let out = polishServedSlim(html);
  out = stripChessJupPluginMount(out);
  out = stripChessJupPluginBoot(out);
  out = stripChessJupPluginBootCall(out);
  out = rewriteChessApi(out);
  if (url && url.searchParams && url.searchParams.get('embed') === '1') out = chessEmbedChrome(out);
  return attachLlmsHtmlLinks(out);
}

function chessPageHeaders(extra = {}, embed = false) {
  const headers = new Headers(htmlHeaders({
    ...extra,
    'Content-Security-Policy': "frame-ancestors 'self' https://www.getdasha.com https://getdasha.com; base-uri 'none'; object-src 'none'",
  }));
  if (embed) headers.set('X-Frame-Options', 'SAMEORIGIN');
  attachLlmsDescribedBy(headers);
  return headers;
}

const oauthStateCookie = (token = '') => `${OAUTH_COOKIE}=${token}; Path=/; Max-Age=${token ? 900 : 0}; HttpOnly; Secure; SameSite=Lax`;

function oauthHtmlResponse(body, status, { head = false } = {}) {
  return new Response(head ? null : body, {
    status,
    headers: privateHtmlHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': oauthStateCookie() }),
  });
}

function githubOauthHtmlResponse(body, status, { head = false, nonce = '' } = {}) {
  const headers = new Headers(privateHtmlHeaders({ 'Content-Type': 'text/html; charset=utf-8' }, nonce));
  headers.append('Set-Cookie', githubOauthStateCookie());
  return new Response(head ? null : body, { status, headers });
}

/** Leftover string. /forum always 308s via forumToLobbyRedirect. Never serve as a 200. */
const FORUM_PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Forum — $dasha</title>
<meta name="description" content="Long-form threads for $dasha. Link X to post.">
<link rel="canonical" href="https://lobby.getdasha.com/forum">
<meta property="og:type" content="website">
<meta property="og:url" content="https://lobby.getdasha.com/forum">
<meta property="og:title" content="Forum — $dasha">
<meta property="og:description" content="Longer than chat. Same rules as chat.">
<meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Forum — $dasha">
<meta name="twitter:description" content="Longer than chat. Same rules as chat.">
<meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="getdasha">
<meta property="og:url" content="https://lobby.getdasha.com/forum">
<meta property="og:title" content="Forum — $dasha">
<meta property="og:description" content="Long-form threads for $dasha. Link X to post.">
<meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Forum — $dasha">
<meta name="twitter:description" content="Long-form threads for $dasha. Link X to post.">
<meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<link rel="icon" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/6a767a48e1dd29d210f01235_dasha-icon-32.png">
<style>
:root{--ink:#070608;--paper:#f4eddb;--acid:#dfff00;--muted:#e6dcc4;--line:rgba(244,237,219,.32)}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--paper);font-family:Arial,Helvetica,sans-serif;line-height:1.5}
.wrap{width:min(760px,calc(100% - 32px));margin:0 auto;padding:20px 0 64px}
a{color:var(--paper)}
.top{display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--line);padding:8px 0;flex-wrap:wrap}
.brand{margin-right:auto;min-height:44px;display:inline-flex;align-items:center;font-weight:900;font-size:17px;letter-spacing:-.03em;text-transform:uppercase;text-decoration:none}
.brand span{color:var(--acid)}
.top a:not(.brand){min-height:44px;display:inline-flex;align-items:center;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;text-decoration:none}
h1{font-size:clamp(28px,6vw,44px);line-height:.9;letter-spacing:-.04em;text-transform:uppercase;margin:18px 0 4px}
.lede{color:var(--muted);margin:0 0 20px}
button{font:inherit;font-weight:900;min-height:44px;padding:0 16px;border:1px solid var(--paper);background:transparent;color:var(--paper);cursor:pointer;text-transform:uppercase;letter-spacing:.06em;font-size:12px}
button.primary{background:var(--acid);color:var(--ink);border-color:var(--acid)}
button[disabled]{opacity:.55;cursor:not-allowed}
input,textarea{font:inherit;width:100%;background:#0d0b0f;color:var(--paper);border:1px solid var(--line);padding:10px;min-height:44px}
textarea{min-height:120px;resize:vertical}
label{display:block;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}
.thread{display:block;width:100%;text-align:left;border:1px solid var(--line);padding:12px;margin:0 0 8px;background:transparent;min-height:44px;text-transform:none;letter-spacing:0;font-size:16px}
.thread .meta{display:block;color:var(--muted);font-size:12px;font-weight:400;margin-top:4px;text-transform:none;letter-spacing:0}
.post{border-left:3px solid var(--line);padding:8px 0 8px 12px;margin:0 0 14px}
.post .who{font-weight:900;font-size:13px}
.post .when{color:var(--muted);font-size:12px}
.post p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.note{border-left:4px solid var(--acid);background:rgba(223,255,0,.1);padding:10px 12px;margin:14px 0;font-weight:800}
[hidden]{display:none!important}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
</style></head><body>
<div class="wrap">
<div class="top"><a class="brand" href="https://www.getdasha.com/">$<span>dasha</span></a>
<a href="https://www.getdasha.com/lobby">Lobby</a><a href="https://www.getdasha.com/chess">Chess</a>
<a href="https://www.getdasha.com/">Home</a></div>
<h1>Forum</h1>
<p class="lede">Official $dasha room. No Telegram. No Discord. Longer than chat. Same rules as chat.</p>
<div id="say" class="note" role="status" aria-live="polite" hidden></div>

<main id="list-view">
  <button class="primary" id="new-toggle" aria-expanded="false" aria-controls="new-form">Start a thread</button>
  <form id="new-form" hidden>
    <label for="new-title">Title</label><input id="new-title" maxlength="80" required>
    <label for="new-text">Opening post</label><textarea id="new-text" maxlength="2000" required></textarea>
    <p><button class="primary" type="submit" id="new-submit">Post thread</button>
    <button type="button" id="new-cancel">Cancel</button></p>
  </form>
  <h2 class="sr">Threads</h2>
  <div id="threads" aria-busy="true">Loading threads…</div>
</main>

<main id="thread-view" hidden>
  <button id="back">← All threads</button>
  <button type="button" id="copy-link">Copy link</button>
  <h2 id="thread-title"></h2>
  <div id="posts"></div>
  <form id="reply-form">
    <label for="reply-text">Reply</label><textarea id="reply-text" maxlength="2000" required></textarea>
    <p><button class="primary" type="submit" id="reply-submit">Post reply</button></p>
  </form>
</main>
</div>
<script>
(function(){
var API='https://lobby.getdasha.com';
var $=function(id){return document.getElementById(id)};
var openId=null;
function say(msg,ok){var s=$('say');if(!msg){s.hidden=true;return}s.hidden=false;s.textContent=msg;s.style.borderLeftColor=ok?'#dfff00':'#ff3b81'}
function api(path,opts){return fetch(API+path,Object.assign({credentials:'include',headers:{'Content-Type':'application/json'}},opts||{}))
  .then(function(r){return r.json().then(function(d){return{ok:r.ok,status:r.status,data:d}})})}
function when(ts){var d=new Date(Number(ts));return isNaN(d)?'':d.toISOString().slice(0,16).replace('T',' ')+' UTC'}
function esc(s){var n=document.createElement('div');n.textContent=String(s==null?'':s);return n.innerHTML}
function fail(res){ if(res.status===401){say('Link X in the lobby before posting.');return} say((res.data&&res.data.error)||'That did not go through.') }
function threadQuery(){try{return String(new URLSearchParams(location.search).get('t')||'').trim()}catch(e){return ''}}
function setThreadQuery(id){try{var u=new URL(location.href);if(id)u.searchParams.set('t',id);else u.searchParams.delete('t');history.replaceState(null,'',u.pathname+u.search+u.hash)}catch(e){}}
function threadUrl(id){return 'https://lobby.getdasha.com/forum?t='+encodeURIComponent(id)}
function linkCopiedOk(got,want){return String(got||'').replace(/\s+/g,'')===String(want||'')}
function withTimeout(p,ms){return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error('copy-timeout'))},ms)})])}

function renderThreads(list){
  var box=$('threads');box.setAttribute('aria-busy','false');
  if(!list.length){box.textContent='No threads yet. Start the first one.';return}
  box.innerHTML=list.map(function(t){
    return '<button class="thread" data-id="'+esc(t.id)+'">'+esc(t.title)+
      '<span class="meta">@'+esc(t.handle)+' · '+t.replies+' repl'+(t.replies===1?'y':'ies')+' · '+when(t.lastTs)+'</span></button>'}).join('');
  Array.prototype.forEach.call(box.querySelectorAll('.thread'),function(b){
    b.addEventListener('click',function(){openThread(b.dataset.id)})});
}
function loadThreads(){say('');return api('/forum/threads').then(function(res){
  if(!res.ok)return fail(res); renderThreads(res.data.threads||[])}).catch(function(){$('threads').textContent='Could not reach the forum.'})}

function openThread(id){
  return api('/forum/thread/'+encodeURIComponent(id)).then(function(res){
    if(!res.ok)return fail(res);
    openId=id;
    setThreadQuery(id);
    $('list-view').hidden=true;$('thread-view').hidden=false;
    $('thread-title').textContent=res.data.thread.title;
    $('posts').innerHTML=(res.data.posts||[]).map(function(p){
      return '<div class="post"><div class="who">@'+esc(p.handle)+' <span class="when">'+when(p.ts)+'</span></div><p>'+esc(p.text)+'</p></div>'}).join('');
    $('thread-title').focus();
  })
}
$('back').addEventListener('click',function(){openId=null;setThreadQuery('');$('thread-view').hidden=true;$('list-view').hidden=false;loadThreads()});
$('copy-link').addEventListener('click',function(){
  if(!openId)return;
  var b=$('copy-link'),want=threadUrl(openId),label=b.textContent;
  var done=function(t){b.textContent=t;setTimeout(function(){b.textContent=label},1800)};
  if(!navigator.clipboard||!navigator.clipboard.writeText){done('Select');return}
  withTimeout(navigator.clipboard.writeText(want),800).then(function(){
    if(!navigator.clipboard.readText){done('Copied');return}
    return withTimeout(navigator.clipboard.readText(),800).then(function(got){done(linkCopiedOk(got,want)?'Copied':'Select')});
  }).catch(function(){done('Select')});
});
$('new-toggle').addEventListener('click',function(){
  var open=$('new-form').hidden; $('new-form').hidden=!open; this.setAttribute('aria-expanded',String(open));
  if(open)$('new-title').focus()});
$('new-cancel').addEventListener('click',function(){$('new-form').hidden=true;$('new-toggle').setAttribute('aria-expanded','false');$('new-toggle').focus()});
$('new-form').addEventListener('submit',function(e){e.preventDefault();
  var b=$('new-submit');b.disabled=true;
  api('/forum/threads',{method:'POST',body:JSON.stringify({title:$('new-title').value,text:$('new-text').value})})
    .then(function(res){ if(!res.ok)return fail(res);
      $('new-title').value='';$('new-text').value='';$('new-form').hidden=true;
      $('new-toggle').setAttribute('aria-expanded','false'); say('Thread posted.',true); return loadThreads()})
    .catch(function(){say('That did not go through.')})
    .then(function(){b.disabled=false})});
$('reply-form').addEventListener('submit',function(e){e.preventDefault();
  if(!openId)return; var b=$('reply-submit');b.disabled=true;
  api('/forum/thread/'+encodeURIComponent(openId),{method:'POST',body:JSON.stringify({text:$('reply-text').value})})
    .then(function(res){ if(!res.ok)return fail(res); $('reply-text').value='';say('Reply posted.',true); return openThread(openId)})
    .catch(function(){say('That did not go through.')})
    .then(function(){b.disabled=false})});
loadThreads().then(function(){var t=threadQuery();if(t)openThread(t)});
})();
</script></body></html>`;
void FORUM_PAGE_HTML;


const GROK_PAIR_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function mintGrokPairCode(bytes = crypto.getRandomValues(new Uint8Array(8))) {
  let out = '';
  for (const byte of bytes) out += GROK_PAIR_ALPHABET[byte & 31];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export function normalizeGrokPairCode(raw) {
  const compact = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/[ILOU]/g, '');
  if (compact.length !== 8) return '';
  for (const ch of compact) if (!GROK_PAIR_ALPHABET.includes(ch)) return '';
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export const GROK_BOT_JSON = {
  compatible: true,
  name: 'getdasha.com',
  login: 'https://www.getdasha.com/login',
  sign_in: {
    start: 'https://lobby.getdasha.com/auth/grok/start',
    status: 'https://lobby.getdasha.com/auth/grok/status',
    verify: 'https://lobby.getdasha.com/auth/grok/verify',
  },
  verify_prompt: 'sign me into getdasha.com with {code}',
};

export function grokBotWellKnownResponse(request) {
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(GROK_BOT_JSON), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'X-Dasha-Edge': 'grok-bot',
    },
  });
}

export class DashaLobby {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.compute = new ComputeNetwork(state, env);
    this.history = [];
    this.rates = new Map();
    this.simpRates = new Map();
    this.nicks = new Map();
    this.ipJoins = new Map(); // ip -> { times: number[] }
    this.mutes = new Map(); // nickKey -> untilMs
    this.shield = false; // linked-only chat when true
    this.forceSlow = false;
    this.autoShieldUntil = 0;
    this.customPin = null; // { text, ts } or null
    this.presenceTimer = null;
    this.spamHits = { times: [] };
    /** @type {Record<string, object>} xId -> simp profile (internal; never public as-is) */
    this.simpProfiles = {};
    this.simpQuizAttempts = {};
    this.simpQuizMetrics = emptyQuizMetrics(Date.now());
    this.studioMetrics = emptyStudioMetrics(Date.now());
    this.studioHandoffs = {};
    this.simpQuizResults = {};
    this.simpClaims = {};
    this.simpReferrals = {};
    this.simpReferralMetrics = { since: Date.now(), claims: 0, claimRejects: 0, expirations: 0, activations: 0, cappedActivations: 0, contributions: 0, invalidations: 0, organicEnrollments: 0, referredEnrollments: 0, organicReturns: 0, referredReturns: 0 };
    this.simpSeasons = {};
    this.chessGames = {};
    this.forumIndex = [];
    this.forumReports = [];
    this.forumAudit = [];
    this.chessRatings = {};
    this.chessCurrent = {};
    this.chessQueue = [];
    this.chessChallenges = {};
    this.chessTournaments = {};
    this.chessHidden = {};
    this.chessMetrics = emptyChessMetrics(Date.now());
    this.stats = {
      joins: 0,
      chats: 0,
      rejectsFull: 0,
      rejectsIp: 0,
      mutes: 0,
      autoShields: 0,
      startedAt: Date.now(),
    };
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('history');
      if (Array.isArray(stored)) this.history = pruneHistory(stored);
      const muteRows = await this.state.storage.get('mutes');
      if (Array.isArray(muteRows)) {
        const now = Date.now();
        for (const row of muteRows) {
          if (row?.key && row.until > now) this.mutes.set(row.key, row.until);
        }
      }
      const forumIndex = await this.state.storage.get('forum:index');
      if (Array.isArray(forumIndex)) {
        this.forumIndex = pruneIndex(forumIndex, Date.now());
        const live = new Set(this.forumIndex.map((t) => t.id));
        for (const key of (await this.state.storage.list({ prefix: 'forum:t:' })).keys()) {
          if (!live.has(key.slice('forum:t:'.length))) await this.state.storage.delete(key);
        }
      }
      const forumReports = await this.state.storage.get('forum:reports');
      if (Array.isArray(forumReports)) this.forumReports = forumReports.slice(0, 100);
      const forumAudit = await this.state.storage.get('forum:audit');
      if (Array.isArray(forumAudit)) this.forumAudit = forumAudit.slice(0, 100);
      const flags = await this.state.storage.get('flags');
      if (flags && typeof flags === 'object') {
        this.shield = Boolean(flags.shield);
        this.forceSlow = Boolean(flags.forceSlow);
        this.autoShieldUntil = Number(flags.autoShieldUntil) || 0;
        if (flags.customPin && typeof flags.customPin.text === 'string') {
          this.customPin = flags.customPin;
        }
      }
      const simp = await this.state.storage.get('simpProfiles');
      if (simp && typeof simp === 'object' && !Array.isArray(simp)) this.simpProfiles = simp;
      const attempts = await this.state.storage.get('simpQuizAttempts');
      if (attempts && typeof attempts === 'object' && !Array.isArray(attempts)) this.simpQuizAttempts = attempts;
      const metrics = await this.state.storage.get('simpQuizMetrics');
      if (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) this.simpQuizMetrics = { ...this.simpQuizMetrics, ...metrics, since: Number(metrics.since) || null };
      const studioMetrics = await this.state.storage.get('studioMetrics');
      if (studioMetrics && typeof studioMetrics === 'object' && !Array.isArray(studioMetrics)) {
        const completionSince = Number(studioMetrics.completionSince) || Date.now();
        this.studioMetrics = { ...this.studioMetrics, ...studioMetrics, since: Number(studioMetrics.since) || null, completionSince, sources: { ...this.studioMetrics.sources, ...studioMetrics.sources } };
        if (!Number(studioMetrics.completionSince)) await this.state.storage.put('studioMetrics', this.studioMetrics);
      }
      const handoffs = await this.state.storage.get('studioHandoffs');
      if (handoffs && typeof handoffs === 'object' && !Array.isArray(handoffs)) this.studioHandoffs = handoffs;
      const results = await this.state.storage.get('simpQuizResults');
      if (results && typeof results === 'object' && !Array.isArray(results)) this.simpQuizResults = results;
      const claims = await this.state.storage.get('simpClaims');
      if (claims && typeof claims === 'object' && !Array.isArray(claims)) this.simpClaims = claims;
      const referrals = await this.state.storage.get('simpReferrals');
      if (referrals && typeof referrals === 'object' && !Array.isArray(referrals)) this.simpReferrals = referrals;
      const referralMetrics = await this.state.storage.get('simpReferralMetrics');
      if (referralMetrics && typeof referralMetrics === 'object' && !Array.isArray(referralMetrics)) this.simpReferralMetrics = { ...this.simpReferralMetrics, ...referralMetrics };
      const seasons = await this.state.storage.get('simpSeasons');
      if (seasons && typeof seasons === 'object' && !Array.isArray(seasons)) this.simpSeasons = seasons;
      const chess = await this.state.storage.get('chessState');
      if (chess && typeof chess === 'object' && !Array.isArray(chess)) {
        if (chess.games && typeof chess.games === 'object') this.chessGames = chess.games;
        if (chess.ratings && typeof chess.ratings === 'object') this.chessRatings = chess.ratings;
        if (chess.current && typeof chess.current === 'object') this.chessCurrent = chess.current;
        if (Array.isArray(chess.queue)) this.chessQueue = chess.queue;
        if (chess.challenges && typeof chess.challenges === 'object') this.chessChallenges = chess.challenges;
        if (chess.tournaments && typeof chess.tournaments === 'object') this.chessTournaments = chess.tournaments;
        if (chess.hidden && typeof chess.hidden === 'object') this.chessHidden = chess.hidden;
        if (chess.metrics && typeof chess.metrics === 'object') this.chessMetrics = { ...this.chessMetrics, ...chess.metrics, since: Number(chess.metrics.since) || null };
        let migrated = false;
        for (const game of Object.values(this.chessGames)) if (game?.state?.status === 'active' && !game.clock) {
          game.clock = { w: CHESS_CLOCK_MS, b: CHESS_CLOCK_MS, activeSince: Date.now() };
          migrated = true;
        }
        if (migrated) await this.persistChess();
      }
      const chessMetrics = await this.state.storage.get('chessMetrics');
      if (chessMetrics && typeof chessMetrics === 'object' && !Array.isArray(chessMetrics)) {
        this.chessMetrics = { ...this.chessMetrics, ...chessMetrics, since: Number(chessMetrics.since) || null };
      }
      const next = await this.state.storage.getAlarm();
      if (next == null) await this.state.storage.setAlarm(Date.now() + 5 * 60_000);
    });
  }

  async persistSimp() {
    await this.state.storage.put('simpProfiles', this.simpProfiles);
  }

  async persistSimpState() {
    await this.state.storage.put({ simpProfiles: this.simpProfiles, simpQuizAttempts: this.simpQuizAttempts, simpQuizMetrics: this.simpQuizMetrics, simpQuizResults: this.simpQuizResults, simpClaims: this.simpClaims, simpSeasons: this.simpSeasons, simpReferrals: this.simpReferrals, simpReferralMetrics: this.simpReferralMetrics });
  }

  refreshReferralScores() {
    this.simpProfiles = applyReferralScores(this.simpProfiles, this.simpReferrals);
  }

  pruneReferralState() {
    const result = pruneExpiredReferrals(this.simpReferrals);
    this.simpReferrals = result.referrals;
    this.simpReferralMetrics.expirations += result.expired;
    return result.expired;
  }

  noteReferralEnrollment(xId, created) {
    if (!created) return;
    this.simpReferralMetrics[this.simpReferrals[String(xId)] ? 'referredEnrollments' : 'organicEnrollments']++;
  }

  chessSnapshot() {
    return {
      games: this.chessGames,
      ratings: this.chessRatings,
      current: this.chessCurrent,
      queue: this.chessQueue,
      challenges: this.chessChallenges,
      tournaments: this.chessTournaments,
      hidden: this.chessHidden,
      metrics: this.chessMetrics,
    };
  }

  chessStorageBytes() {
    return new TextEncoder().encode(JSON.stringify(this.chessSnapshot())).byteLength;
  }

  async persistChess() {
    await this.state.storage.put('chessState', this.chessSnapshot());
  }

  async persistChessMetrics() {
    await this.state.storage.put('chessMetrics', this.chessMetrics);
  }

  chessRating(xId, handle = '') {
    const key = String(xId);
    return this.chessRatings[key] || { rating: CHESS_START_RATING, games: 0, wins: 0, losses: 0, draws: 0, handle: String(handle).toLowerCase() };
  }

  makeChessGame(first, second, { tournamentId = null, matchId = null, swap = false } = {}) {
    const flip = swap ? false : Boolean(crypto.getRandomValues(new Uint8Array(1))[0] & 1);
    const entrants = flip ? [second, first] : [first, second];
    const gameId = randomUrlToken(9), createdAt = Date.now();
    const game = {
      id: gameId,
      players: {
        w: { ...entrants[0], rating: this.chessRating(entrants[0].xId, entrants[0].handle).rating },
        b: { ...entrants[1], rating: this.chessRating(entrants[1].xId, entrants[1].handle).rating },
      },
      state: newChessState(), clock: { w: CHESS_CLOCK_MS, b: CHESS_CLOCK_MS, activeSince: createdAt }, createdAt, updatedAt: createdAt, rated: false,
      ...(tournamentId ? { tournamentId, matchId } : {}),
    };
    this.chessGames[gameId] = game;
    this.chessMetrics.gamesStarted++;
    this.chessCurrent[entrants[0].xId] = gameId;
    this.chessCurrent[entrants[1].xId] = gameId;
    return game;
  }

  activeTournamentFor(xId) {
    return Object.values(this.chessTournaments).find(row => (row.status === 'registration' || row.status === 'active') && row.entrants.some(player => player.xId === String(xId))) || null;
  }

  openChessChallengeFor(xId) {
    return Object.values(this.chessChallenges).find(row => row.creatorXId === String(xId) && row.status === 'open') || null;
  }

  pruneChessQueue(now = Date.now()) {
    const before = this.chessQueue.length;
    this.chessQueue = this.chessQueue.filter(row => now - Number(row.at) < 15 * 60_000 && this.simpProfiles[row.xId] && Number(this.simpProfiles[row.xId].holderUntil) > now && !this.activeTournamentFor(row.xId) && !this.openChessChallengeFor(row.xId));
    return this.chessQueue.length !== before;
  }

  expireChessRegistrations(now = Date.now()) {
    let changed = false;
    for (const tournament of Object.values(this.chessTournaments)) if (tournament.status === 'registration' && now - Number(tournament.createdAt) >= CHESS_TOURNAMENT_REGISTRATION_MS) {
      tournament.status = 'cancelled';
      changed = true;
    }
    return changed;
  }

  expireChessChallenges(now = Date.now()) {
    let changed = false;
    for (const [id, challenge] of Object.entries(this.chessChallenges)) {
      if (challenge.status === 'open' && Number(challenge.expiresAt) <= now) {
        challenge.status = 'expired'; challenge.updatedAt = now; changed = true;
      } else if (challenge.status !== 'open' && now - Number(challenge.updatedAt || challenge.createdAt) >= CHESS_CHALLENGE_RETAIN_MS) {
        delete this.chessChallenges[id]; changed = true;
      }
    }
    return changed;
  }

  publicChessChallenge(challenge, viewerXId = '', viewerHolder = false) {
    if (!challenge) return null;
    const viewer = String(viewerXId);
    return {
      id: challenge.id,
      status: challenge.status,
      creator: `@${challenge.creatorHandle}`,
      creatorRating: this.chessRating(challenge.creatorXId, challenge.creatorHandle).rating,
      creatorIsMe: challenge.creatorXId === viewer,
      canAccept: challenge.status === 'open' && Boolean(viewer && viewer !== challenge.creatorXId && viewerHolder),
      createdAt: challenge.createdAt,
      expiresAt: challenge.expiresAt,
    };
  }

  publicChessTournament(tournament, viewerXId = '') {
    if (!tournament) return null;
    const entrants = tournament.entrants.map(player => ({ handle: player.handle, display: `@${player.handle}`, href: `https://x.com/${player.handle}`, rating: this.chessRating(player.xId, player.handle).rating }));
    return {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      organizer: `@${tournament.organizerHandle}`,
      organizerIsMe: tournament.organizerXId === String(viewerXId),
      joined: tournament.entrants.some(player => player.xId === String(viewerXId)),
      entrants,
      maxPlayers: 16,
      champion: tournament.champion ? `@${tournament.champion.handle}` : null,
      rounds: (tournament.rounds || []).map(round => ({
        number: round.number,
        byes: round.byes.map(player => `@${player.handle}`),
        matches: round.matches.map(match => ({
          id: match.id,
          white: match.whiteHandle ? `@${match.whiteHandle}` : null,
          black: match.blackHandle ? `@${match.blackHandle}` : null,
          winner: match.winnerHandle ? `@${match.winnerHandle}` : null,
          status: match.status,
          replays: (match.gameIds || [match.currentGameId]).filter(id => this.chessGames[id]?.state?.status === 'finished'),
        })),
      })),
      createdAt: tournament.createdAt,
      startedAt: tournament.startedAt || null,
      finishedAt: tournament.finishedAt || null,
    };
  }

  startTournamentRound(tournament, players) {
    if (players.length === 1) {
      if (tournament.status !== 'finished') this.chessMetrics.tournamentsCompleted++;
      tournament.status = 'finished';
      tournament.champion = players[0];
      tournament.finishedAt = Date.now();
      return tournament;
    }
    const pool = [...players], byes = [];
    if (pool.length % 2) byes.push(pool.pop());
    const round = { number: tournament.rounds.length + 1, byes, matches: [], startedAt: Date.now() };
    while (pool.length) {
      const first = pool.shift(), second = pool.shift(), matchId = randomUrlToken(6);
      const game = this.makeChessGame(first, second, { tournamentId: tournament.id, matchId });
      round.matches.push({ id: matchId, currentGameId: game.id, gameIds: [game.id], whiteXId: game.players.w.xId, whiteHandle: game.players.w.handle, blackXId: game.players.b.xId, blackHandle: game.players.b.handle, winnerXId: null, winnerHandle: null, status: 'playing' });
    }
    tournament.rounds.push(round);
    return tournament;
  }

  advanceChessTournament(game) {
    if (!game.tournamentId || game.state.status !== 'finished') return;
    const tournament = this.chessTournaments[game.tournamentId];
    const round = tournament?.rounds?.at(-1);
    const match = round?.matches?.find(row => row.id === game.matchId && row.currentGameId === game.id);
    if (!tournament || tournament.status !== 'active' || !match) return;
    if (game.state.result === '1/2-1/2') {
      const rematch = this.makeChessGame(game.players.b, game.players.w, { tournamentId: tournament.id, matchId: match.id, swap: true });
      match.currentGameId = rematch.id;
      match.gameIds.push(rematch.id);
      match.whiteXId = rematch.players.w.xId; match.whiteHandle = rematch.players.w.handle;
      match.blackXId = rematch.players.b.xId; match.blackHandle = rematch.players.b.handle;
      match.status = 'replay';
      return;
    }
    const winner = game.state.result === '1-0' ? game.players.w : game.players.b;
    match.winnerXId = winner.xId;
    match.winnerHandle = winner.handle;
    match.status = 'done';
    if (round.matches.some(row => !row.winnerXId)) return;
    const winnerIds = [...round.byes.map(player => player.xId), ...round.matches.map(row => row.winnerXId)];
    const next = winnerIds.map(xId => tournament.entrants.find(player => player.xId === xId)).filter(Boolean);
    this.startTournamentRound(tournament, next);
  }

  chessFinish(game, state) {
    const now = Date.now();
    const next = { ...game, state, updatedAt: now, ...(state.status === 'finished' ? { finishedAt: game.finishedAt || now } : {}) };
    if (state.status === 'finished' && !game.rated && !game.settled) {
      this.chessMetrics.gamesCompleted++;
      next.settled = true;
      if ((state.moves || []).length >= 2) {
        const white = this.chessRating(game.players.w.xId, game.players.w.handle);
        const black = this.chessRating(game.players.b.xId, game.players.b.handle);
        const settled = settleChessRatings(white, black, state.result);
        this.chessRatings[game.players.w.xId] = { ...settled.white, handle: game.players.w.handle };
        this.chessRatings[game.players.b.xId] = { ...settled.black, handle: game.players.b.handle };
        next.rated = true;
        next.players = {
          w: { ...game.players.w, rating: settled.white.rating },
          b: { ...game.players.b, rating: settled.black.rating },
        };
      }
    }
    this.chessGames[game.id] = next;
    this.advanceChessTournament(next);
    return next;
  }

  expireChessClock(game, now = Date.now()) {
    if (!game?.clock || game.state?.status !== 'active') return { game, expired: false };
    const side = game.state.turn;
    const remaining = Number(game.clock[side]) - Math.max(0, now - Number(game.clock.activeSince));
    if (remaining > 0) return { game, expired: false };
    const clock = { ...game.clock, [side]: 0, activeSince: now };
    const drawn = !canMate(game.state, side === 'w' ? 'b' : 'w');
    const state = { ...game.state, status: 'finished', result: drawn ? '1/2-1/2' : side === 'w' ? '0-1' : '1-0', reason: drawn ? 'timeout · no mating material' : 'timeout', version: (Number(game.state.version) || 0) + 1 };
    return { game: this.chessFinish({ ...game, clock }, state), expired: true };
  }

  clockAfterMove(game, side, now) {
    const remaining = Number(game.clock[side]) - Math.max(0, now - Number(game.clock.activeSince));
    return { ...game.clock, [side]: Math.max(0, remaining) + CHESS_INCREMENT_MS, activeSince: now };
  }

  deleteChessIdentity(xId) {
    const key = String(xId || '');
    this.chessQueue = this.chessQueue.filter(row => row.xId !== key);
    for (const [id, challenge] of Object.entries(this.chessChallenges)) if (challenge.creatorXId === key || challenge.acceptedByXId === key) delete this.chessChallenges[id];
    delete this.chessRatings[key];
    delete this.chessHidden[key];
    delete this.chessCurrent[key];
    for (const [tournamentId, tournament] of Object.entries(this.chessTournaments)) {
      if (tournament.organizerXId !== key && !tournament.entrants.some(player => player.xId === key)) continue;
      if (tournament.status === 'registration' && tournament.organizerXId !== key) {
        tournament.entrants = tournament.entrants.filter(player => player.xId !== key);
        continue;
      }
      for (const round of tournament.rounds || []) for (const match of round.matches || []) {
        for (const gameId of match.gameIds || []) {
          const game = this.chessGames[gameId];
          if (!game) continue;
          const involved = game.players?.w?.xId === key || game.players?.b?.xId === key;
          if (involved) {
            for (const player of Object.values(game.players || {})) if (this.chessCurrent[player.xId] === gameId) delete this.chessCurrent[player.xId];
            delete this.chessGames[gameId];
          } else {
            const standalone = { ...game };
            delete standalone.tournamentId;
            delete standalone.matchId;
            this.chessGames[gameId] = standalone;
          }
        }
      }
      delete this.chessTournaments[tournamentId];
    }
    for (const [gameId, game] of Object.entries(this.chessGames)) {
      if (game.players?.w?.xId !== key && game.players?.b?.xId !== key) continue;
      const other = game.players.w.xId === key ? game.players.b.xId : game.players.w.xId;
      if (this.chessCurrent[other] === gameId) delete this.chessCurrent[other];
      delete this.chessGames[gameId];
    }
  }

  /**
   * Opt-in Simp Board HTTP API (same DO + session cookie as Lobby).
   * Never enrolls on OAuth callback or chat.
   */
  async handleSimp(request, allowedOrigin) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';
    const cred = { credentials: true };

    if (path === '/auth/wallet/challenge') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      if (!this.env.LOBBY_SESSION_SECRET) return json({ error: 'wallet login unavailable' }, 503, allowedOrigin, cred);
      const publicKey = String((await requestJson(request)).publicKey || '');
      if (!isValidSolanaAddress(publicKey)) return json({ error: 'valid Solana address required' }, 400, allowedOrigin, cred);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipAllowed = simpRate(this.simpRates, `wallet-login-ip:${ip}`, 12);
      if (!ipAllowed.ok) return json({ error: 'wallet login rate limited', waitMs: ipAllowed.waitMs }, 429, allowedOrigin, cred);
      const allowed = simpRate(this.simpRates, `wallet-login-challenge:${publicKey}`, 6);
      if (!allowed.ok) return json({ error: 'wallet login rate limited', waitMs: allowed.waitMs }, 429, allowedOrigin, cred);
      const issuedAt = Date.now(), expiresAt = issuedAt + 5 * 60_000;
      const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const proofOrigin = new URL(allowedOrigin);
      const message = walletLoginMessage({ publicKey, nonce, issuedAt, expiresAt, domain: proofOrigin.host, uri: `${proofOrigin.origin}/login` });
      const challenge = await signPayload(this.env.LOBBY_SESSION_SECRET, { kind: 'wallet_login', publicKey, nonce, message, origin: proofOrigin.origin, exp: expiresAt });
      const saved = await this.state.storage.get('walletLogins');
      const live = Object.fromEntries(Object.entries(saved && typeof saved === 'object' ? saved : {})
        .filter(([, row]) => Number(row?.exp) > issuedAt));
      live[publicKey] = { nonce, exp: expiresAt };
      const bounded = Object.fromEntries(Object.entries(live).sort((a, b) => b[1].exp - a[1].exp).slice(0, 100));
      await this.state.storage.put('walletLogins', bounded);
      return json({ ok: true, message, challenge, expiresAt }, 200, allowedOrigin, cred);
    }

    if (path === '/auth/wallet/verify') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      const body = await requestJson(request);
      const challenge = await verifyPayload(this.env.LOBBY_SESSION_SECRET, body.challenge);
      if (!challenge || challenge.kind !== 'wallet_login' || challenge.publicKey !== body.publicKey || challenge.origin !== allowedOrigin) {
        return json({ error: 'invalid wallet login challenge' }, 401, allowedOrigin, cred);
      }
      const allowed = simpRate(this.simpRates, `wallet-login-verify:${body.publicKey}`, 4);
      if (!allowed.ok) return json({ error: 'wallet login rate limited', waitMs: allowed.waitMs }, 429, allowedOrigin, cred);
      const signatureOk = await verifyEd25519(challenge.message, body.publicKey, body.signature).catch(() => false);
      if (!signatureOk) return json({ error: 'invalid wallet signature' }, 400, allowedOrigin, cred);
      const logins = await this.state.storage.get('walletLogins');
      const pending = logins && typeof logins === 'object' ? logins[body.publicKey] : null;
      if (!pending || pending.nonce !== challenge.nonce || pending.exp < Date.now()) return json({ error: 'wallet login challenge already used' }, 409, allowedOrigin, cred);
      delete logins[body.publicKey];
      if (Object.keys(logins).length) await this.state.storage.put('walletLogins', logins);
      else await this.state.storage.delete('walletLogins');
      const token = await createWalletSessionToken(this.env, body.publicKey);
      return json({ ok: true, provider: 'wallet' }, 200, allowedOrigin, {
        credentials: true,
        headers: { 'Set-Cookie': cookieHeader(token) },
      });
    }

    if (path === '/auth/grok/start') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      if (!this.env.LOBBY_SESSION_SECRET) return json({ error: 'grok login unavailable' }, 503, allowedOrigin, cred);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipAllowed = simpRate(this.simpRates, `grok-login-ip:${ip}`, 12);
      if (!ipAllowed.ok) return json({ error: 'grok login rate limited', waitMs: ipAllowed.waitMs }, 429, allowedOrigin, cred);
      const now = Date.now();
      const code = mintGrokPairCode();
      const startNonce = randomUrlToken(16);
      const expiresAt = now + 5 * 60_000;
      const saved = await this.state.storage.get('grokLogins');
      const live = Object.fromEntries(Object.entries(saved && typeof saved === 'object' ? saved : {})
        .filter(([, row]) => Number(row?.exp) > now));
      live[code] = { nonce: startNonce, exp: expiresAt, claimed: false };
      const bounded = Object.fromEntries(Object.entries(live).sort((a, b) => b[1].exp - a[1].exp).slice(0, 100));
      await this.state.storage.put('grokLogins', bounded);
      const startHandle = await signPayload(this.env.LOBBY_SESSION_SECRET, {
        kind: 'grok_start',
        code,
        nonce: startNonce,
        exp: expiresAt,
      });
      return json({ code, expiresIn: 300, poll: '/auth/grok/status' }, 200, allowedOrigin, {
        credentials: true,
        headers: { 'Set-Cookie': grokStartCookieHeader(startHandle) },
      });
    }

    if (path === '/auth/grok/status') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const code = normalizeGrokPairCode(url.searchParams.get('code'));
      if (!code) return json({ error: 'code required' }, 400, allowedOrigin, cred);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipAllowed = simpRate(this.simpRates, `grok-status-ip:${ip}`, 60);
      if (!ipAllowed.ok) return json({ error: 'grok login rate limited', waitMs: ipAllowed.waitMs }, 429, allowedOrigin, cred);
      const logins = await this.state.storage.get('grokLogins');
      const pending = logins && typeof logins === 'object' ? logins[code] : null;
      const now = Date.now();
      if (!pending || Number(pending.exp) <= now) {
        if (pending && logins) {
          delete logins[code];
          if (Object.keys(logins).length) await this.state.storage.put('grokLogins', logins);
          else await this.state.storage.delete('grokLogins');
        }
        return json({ state: 'expired' }, 200, allowedOrigin, cred);
      }
      if (!pending.claimed) return json({ state: 'pending' }, 200, allowedOrigin, cred);
      const startRaw = readCookie(request.headers.get('Cookie') || '', GROK_START_COOKIE);
      const start = startRaw ? await verifyPayload(this.env.LOBBY_SESSION_SECRET, startRaw) : null;
      const starter = Boolean(start && start.kind === 'grok_start' && start.code === code && start.nonce === pending.nonce);
      if (!starter) return json({ state: 'ok' }, 200, allowedOrigin, cred);
      delete logins[code];
      if (Object.keys(logins).length) await this.state.storage.put('grokLogins', logins);
      else await this.state.storage.delete('grokLogins');
      const token = await createGrokSessionToken(this.env, pending.displayName);
      return json({ state: 'ok', provider: 'grok' }, 200, allowedOrigin, {
        credentials: true,
        headers: { 'Set-Cookie': cookieHeader(token) },
      });
    }

    if (path === '/auth/grok/verify') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, '*');
      const body = await requestJson(request);
      const code = normalizeGrokPairCode(body.code);
      if (!code) return json({ error: 'code required' }, 400, '*');
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ipAllowed = simpRate(this.simpRates, `grok-verify-ip:${ip}`, 12);
      if (!ipAllowed.ok) return json({ error: 'grok login rate limited', waitMs: ipAllowed.waitMs }, 429, '*');
      const codeAllowed = simpRate(this.simpRates, `grok-verify-code:${code}`, 6);
      if (!codeAllowed.ok) return json({ error: 'grok login rate limited', waitMs: codeAllowed.waitMs }, 429, '*');
      const logins = await this.state.storage.get('grokLogins');
      const pending = logins && typeof logins === 'object' ? logins[code] : null;
      if (!pending || Number(pending.exp) <= Date.now()) return json({ error: 'code expired' }, 410, '*');
      if (pending.claimed) return json({ error: 'code already used' }, 409, '*');
      pending.claimed = true;
      pending.displayName = String(body.displayName || '').trim().slice(0, 48);
      logins[code] = pending;
      await this.state.storage.put('grokLogins', logins);
      return json({ ok: true }, 200, '*');
    }

    if (path === '/studio/event' && request.method === 'POST') {
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      const input = await requestJson(request);
      if (input?.event === 'handoff_mint' || input?.event === 'handoff_open') {
        return json({ ok: true, counted: false, reason: 'server-authoritative' }, 200, allowedOrigin);
      }
      const key = {
        open: 'opens',
        first_edit: 'firstEdits',
        completion: 'completions',
        export: 'exports',
        share_intent: 'shareIntents',
        share_success: 'shareSuccesses',
        copy_editable_link: 'copyEditableLinks',
        handoff_mint: 'handoffMints',
        handoff_open: 'handoffOpens',
      }[input?.event];
      if (!key) return json({ error: 'invalid event' }, 400, allowedOrigin);
      if (this.studioMetrics[key] == null) this.studioMetrics[key] = 0;
      this.studioMetrics[key]++;
      if (input.event === 'open') {
        if (!this.studioMetrics.sources || typeof this.studioMetrics.sources !== 'object') {
          this.studioMetrics.sources = { home: 0, quiz: 0, direct: 0, 'transmission-001': 0, other: 0 };
        }
        const source = ['home', 'quiz', 'direct', 'transmission-001', 'other'].includes(input.source)
          ? input.source
          : 'other';
        this.studioMetrics.sources[source] = (this.studioMetrics.sources[source] || 0) + 1;
      }
      await this.state.storage.put('studioMetrics', this.studioMetrics);
      return json({ ok: true }, 200, allowedOrigin);
    }

    if (path === '/studio/handoff' && request.method === 'POST') {
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      const input = await requestJson(request);
      const state = sanitizeHandoffBody(input);
      if (!state) return json({ error: 'invalid handoff state' }, 400, allowedOrigin);
      const now = Date.now();
      /* Light per-IP mint cap (best-effort; DO is single-threaded). */
      const ip = (request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 64);
      if (!this.handoffMintHits) this.handoffMintHits = {};
      const windowMs = 60_000;
      const hit = this.handoffMintHits[ip] || { n: 0, t: now };
      if (now - hit.t > windowMs) { hit.n = 0; hit.t = now; }
      hit.n += 1;
      this.handoffMintHits[ip] = hit;
      if (hit.n > 40) return json({ error: 'rate limited' }, 429, allowedOrigin);
      for (const [hid, row] of Object.entries(this.studioHandoffs)) {
        if (!row || row.exp < now) delete this.studioHandoffs[hid];
      }
      const ids = Object.keys(this.studioHandoffs);
      if (ids.length >= HANDOFF_MAX) {
        const oldest = ids.sort((a, b) => (this.studioHandoffs[a]?.at || 0) - (this.studioHandoffs[b]?.at || 0)).slice(0, 200);
        for (const hid of oldest) delete this.studioHandoffs[hid];
      }
      let id = handoffId();
      while (this.studioHandoffs[id]) id = handoffId();
      this.studioHandoffs[id] = { state, at: now, exp: now + HANDOFF_TTL_MS };
      this.studioMetrics.handoffMints = (this.studioMetrics.handoffMints || 0) + 1;
      await this.state.storage.put({ studioHandoffs: this.studioHandoffs, studioMetrics: this.studioMetrics });
      const url = `https://lobby.getdasha.com/h/${id}`;
      return json({ ok: true, id, url }, 200, allowedOrigin);
    }

    if (path.startsWith('/h/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const rest = path.slice('/h/'.length).replace(/\/$/, '');
      const headOnly = request.method === 'HEAD';
      const ogMatch = rest.match(/^([A-Za-z0-9_-]{8,24})\/og\.png$/);
      const id = ogMatch ? ogMatch[1] : rest;
      if (!/^[A-Za-z0-9_-]{8,24}$/.test(id)) {
        return new Response(headOnly ? null : 'Not found', { status: 404, headers: SECURITY });
      }
      const row = this.studioHandoffs[id];
      if (!row || !row.state || row.exp < Date.now()) {
        return new Response(headOnly ? null : 'Handoff expired or missing', { status: 404, headers: SECURITY });
      }
      if (ogMatch) {
        const png = await handoffOgPng(row.state);
        return new Response(headOnly ? null : png, {
          headers: {
            ...SECURITY,
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=600',
          },
        });
      }
      const bot = /bot|crawl|spider|slurp|facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|Slackbot|WhatsApp|TelegramBot|Preview/i.test(request.headers.get('user-agent') || '');
      if (!headOnly && !bot && !row.opened) {
        row.opened = Date.now();
        this.studioMetrics.handoffOpens = (this.studioMetrics.handoffOpens || 0) + 1;
        await this.state.storage.put({ studioHandoffs: this.studioHandoffs, studioMetrics: this.studioMetrics });
      }
      const html = handoffCardHtml(id, row.state, { autoRedirect: !bot });
      return new Response(headOnly ? null : html, {
        headers: htmlHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120' }),
      });
    }

    if (path === '/studio/metrics') {
      if (!modAllowed(request, this.env)) return json({ error: 'unauthorized' }, 401, allowedOrigin);
      if (request.method === 'GET') return json({ ok: true, metrics: this.studioMetrics, quizMetrics: this.simpQuizMetrics, referralMetrics: this.simpReferralMetrics, chessMetrics: this.chessMetrics, chessStorage: { bytes: this.chessStorageBytes(), migrateAtBytes: 1_000_000 } }, 200, allowedOrigin);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin);
      const input = await requestJson(request);
      if (input?.action !== 'reset') return json({ error: 'invalid action' }, 400, allowedOrigin);
      const since = Date.now();
      this.studioMetrics = emptyStudioMetrics(since);
      this.simpQuizMetrics = emptyQuizMetrics(since);
      this.simpReferralMetrics = { since, claims: 0, claimRejects: 0, expirations: 0, activations: 0, cappedActivations: 0, contributions: 0, invalidations: 0, organicEnrollments: 0, referredEnrollments: 0, organicReturns: 0, referredReturns: 0 };
      this.chessMetrics = emptyChessMetrics(since);
      await this.state.storage.put({ studioMetrics: this.studioMetrics, simpQuizMetrics: this.simpQuizMetrics, simpReferralMetrics: this.simpReferralMetrics, chessMetrics: this.chessMetrics });
      await this.persistChess();
      return json({ ok: true, reset: true, since }, 200, allowedOrigin);
    }

    if (path === '/studio/metrics/public' && request.method === 'GET') {
      return json(publicFunnelSummary(this.studioMetrics, this.simpQuizMetrics, this.chessMetrics), 200, allowedOrigin);
    }

    if (path.startsWith('/simp/result/') && request.method === 'GET') {
      const result = this.simpQuizResults[path.slice('/simp/result/'.length)];
      if (!result) return json({ error: 'result not found' }, 404, allowedOrigin);
      const title = storedQuizTitle(result.title, result.correct, result.total);
      return json({ ok: true, result: { correct: result.correct, total: result.total, title, lane: result.lane } }, 200, allowedOrigin);
    }

    if (path.startsWith('/simp/r/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const id = path.slice('/simp/r/'.length).replace(/\/$/, '');
      const result = this.simpQuizResults[id];
      const headOnly = request.method === 'HEAD';
      if (!result) return new Response(headOnly ? null : 'Result not found', { status: 404, headers: SECURITY });
      const title = storedQuizTitle(result.title, result.correct, result.total);
      let html;
      try {
        html = simpResultHtml({ id, title, correct: result.correct, total: result.total });
      } catch {
        return new Response(headOnly ? null : 'Result not found', { status: 404, headers: SECURITY });
      }
      return new Response(headOnly ? null : html, {
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Dasha-Edge': 'simp-share',
        }),
      });
    }

    const simpMemberMatch = path.match(/^\/simp\/member\/([A-Za-z0-9_]{1,15})\/?$/);
    if (simpMemberMatch && request.method === 'GET') {
      if (this.pruneReferralState()) await this.persistSimpState();
      this.refreshReferralScores();
      const handle = simpMemberMatch[1].toLowerCase();
      const member = buildPublicBoard(Object.values(this.simpProfiles), { limit: Number.MAX_SAFE_INTEGER }).measured
        .find((row) => String(row.handle).toLowerCase() === handle);
      return member ? json({ ok: true, member }, 200, allowedOrigin) : json({ error: 'member not found' }, 404, allowedOrigin);
    }

    if (path === '/simp/board' && request.method === 'GET') {
      if (this.pruneReferralState()) await this.persistSimpState();
      this.refreshReferralScores();
      const board = buildPublicBoard(Object.values(this.simpProfiles), {
        limit: PUBLIC_BOARD_LIMIT,
      });
      return json(board, 200, allowedOrigin);
    }

    if (path === '/simp/me' && request.method === 'GET') {
      const session = await sessionFromRequest(this.env, request);
      let referralChanged = Boolean(this.pruneReferralState());
      if (session?.xId) {
        const key = String(session.xId), pending = this.simpReferrals[key];
        const capped = pending && !pending.activatedAt && referralCapReached(this.simpReferrals, pending.inviterXId);
        const before = this.simpReferrals;
        this.simpReferrals = activateReferral(this.simpReferrals, session.xId);
        if (before !== this.simpReferrals) {
          referralChanged = true;
          this.simpReferralMetrics.activations++;
          if (capped) this.simpReferralMetrics.cappedActivations++;
        }
        const profile = this.simpProfiles[key];
        if (profile && !profile.returnedAt && profile.enrolledAt >= this.simpReferralMetrics.since && Date.now() - profile.enrolledAt >= 24 * 60 * 60 * 1000) {
          this.simpProfiles[key] = { ...profile, returnedAt: Date.now() };
          this.simpReferralMetrics[pending ? 'referredReturns' : 'organicReturns']++;
          referralChanged = true;
        }
      }
      this.refreshReferralScores();
      if (referralChanged) await this.persistSimpState();
      const referral = session?.xId ? this.simpReferrals[String(session.xId)] : null;
      const profile = session?.xId ? this.simpProfiles[String(session.xId)] : null;
      return json({
        ...meStatus(this.simpProfiles, session),
        claims: claimsForSession(this.simpClaims, session),
        referral: profile ? {
          ...(profile.referralCode ? { inviteUrl: `https://www.getdasha.com/?ref=${profile.referralCode}#simp` } : {}),
          invited: Object.values(this.simpReferrals).filter((row) => row.inviterXId === String(session.xId)).length,
          activated: Object.values(this.simpReferrals).filter((row) => row.inviterXId === String(session.xId) && row.activatedAt).length,
          contributed: Object.values(this.simpReferrals).filter((row) => row.inviterXId === String(session.xId) && row.contributedAt).length,
          ...(referral ? { state: referral.contributedAt ? 'contributed' : referral.activatedAt ? 'activated' : referral.quizAt ? 'return_pending' : 'quiz_pending' } : {}),
        } : null,
      }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/referral/admin') {
      if (!modAllowed(request, this.env)) return json({ error: 'mod denied' }, 403, allowedOrigin, cred);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const input = await requestJson(request);
      if (input?.action !== 'invalidate' || !this.simpReferrals[String(input.inviteeXId || '')]) return json({ error: 'referral not found' }, 404, allowedOrigin, cred);
      delete this.simpReferrals[String(input.inviteeXId)];
      this.simpReferralMetrics.invalidations++;
      this.refreshReferralScores();
      await this.persistSimpState();
      return json({ ok: true }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/referral') {
      const session = await sessionFromRequest(this.env, request);
      const xId = String(session?.xId || '');
      if (!xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const allowed = simpRate(this.simpRates, `referral:${xId}`, 8);
      if (!allowed.ok) return json({ error: 'referral rate limited', waitMs: allowed.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      if (input?.action === 'create') {
        if (!this.simpProfiles[xId]) return json({ error: 'join board first' }, 401, allowedOrigin, cred);
        if (!this.simpProfiles[xId].referralCode) this.simpProfiles[xId] = { ...this.simpProfiles[xId], referralCode: randomUrlToken(18) };
        await this.persistSimpState();
        return json({ ok: true, inviteUrl: `https://www.getdasha.com/?ref=${this.simpProfiles[xId].referralCode}#simp` }, 200, allowedOrigin, cred);
      }
      if (input?.action === 'claim') {
        this.pruneReferralState();
        const result = claimReferral(this.simpReferrals, this.simpProfiles, session, input.code);
        if (!result.ok) {
          this.simpReferralMetrics.claimRejects++;
          await this.persistSimpState();
          return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
        }
        this.simpReferrals = result.referrals;
        this.simpReferralMetrics.claims++;
        await this.persistSimpState();
        return json({ ok: true, state: 'quiz_pending' }, 201, allowedOrigin, cred);
      }
      return json({ error: 'invalid action' }, 400, allowedOrigin, cred);
    }

    if (path === '/simp/quiz/event' && request.method === 'POST') {
      const input = await requestJson(request);
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      if (input?.event !== 'share') return json({ error: 'invalid event' }, 400, allowedOrigin, cred);
      this.simpQuizMetrics.shares++;
      await this.state.storage.put('simpQuizMetrics', this.simpQuizMetrics);
      return json({ ok: true }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/quiz') {
      const session = await sessionFromRequest(this.env, request);
      const xId = session?.xId ? String(session.xId) : null;
      const completed = xId ? this.simpProfiles[xId]?.quiz : null;
      if (request.method === 'GET') return json({ ok: true, ...quizPublic(), ...(completed ? { completed: true, quiz: completed } : { ready: true }) }, 200, allowedOrigin, cred);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const input = await requestJson(request);
      if (!xId && !allowedOrigin) return json({ error: 'origin required' }, 403, null);
      if (input?.action === 'start') {
        const cutoff = Date.now() - 60 * 60_000;
        for (const [key, attempt] of Object.entries(this.simpQuizAttempts)) if (key.startsWith('anon:') && Number(attempt?.updatedAt) < cutoff) delete this.simpQuizAttempts[key];
        // Scored retakes always allowed — wipe in-progress attempt and start a fresh scored run.
        const mode = input?.mode === 'quick' ? 'quick' : 'deep';
        const attemptId = xId || `anon:${randomUrlToken(18)}`;
        const attempt = startQuizAttempt({ practice: false, mode });
        this.simpQuizAttempts[attemptId] = attempt;
        this.simpQuizMetrics[completed ? 'replays' : 'starts']++;
        countMetric(this.simpQuizMetrics.reached, attempt.current);
        await this.persistSimpState();
        return json({
          ok: true,
          ...quizPublic(),
          mode,
          retake: Boolean(completed),
          ...(xId ? {} : { attemptId: attemptId.slice(5) }),
          ...questionForAttempt(attempt),
        }, 200, allowedOrigin, cred);
      }
      if (input?.action === 'finalize') {
        if (!xId) return json({ error: 'link X to reveal your result' }, 401, allowedOrigin, cred);
        const anonKey = `anon:${String(input.attemptId || '')}`;
        const attempt = this.simpQuizAttempts[anonKey];
        const result = submitQuiz(this.simpProfiles, session, attempt);
        if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
        const resultId = randomUrlToken(9); result.quiz.resultUrl = `https://lobby.getdasha.com/simp/r/${resultId}`; this.simpQuizResults[resultId] = result.quiz;
        this.simpProfiles = result.store;
        this.simpProfiles[xId] = { ...this.simpProfiles[xId], quiz: { ...result.quiz, resultUrl: result.quiz.resultUrl } };
        this.simpReferrals = noteReferralQuiz(this.simpReferrals, xId);
        this.noteReferralEnrollment(xId, result.created);
        countQuizResult(this.simpQuizMetrics, attempt, result.quiz);
        delete this.simpQuizAttempts[anonKey]; await this.persistSimpState();
        return json({
          ok: true,
          done: true,
          retake: Boolean(result.retake),
          quiz: this.simpProfiles[xId].quiz,
          resultUrl: result.quiz.resultUrl,
          ...meStatus(this.simpProfiles, session),
        }, 200, allowedOrigin, cred);
      }
      const attemptKey = xId || `anon:${String(input?.attemptId || '')}`;
      if (input?.action !== 'answer' || !this.simpQuizAttempts[attemptKey]) return json({ error: 'start quiz first' }, 400, allowedOrigin, cred);
      const prior = this.simpQuizAttempts[attemptKey];
      const advanced = answerQuizAttempt(prior, input.answer);
      if (!advanced.ok) return json({ error: advanced.error }, advanced.status || 400, allowedOrigin, cred);
      countMetric(this.simpQuizMetrics.answers, `${prior.current}:${input.answer}`);
      if (!advanced.done) {
        this.simpQuizAttempts[attemptKey] = advanced.attempt;
        countMetric(this.simpQuizMetrics.reached, advanced.attempt.current);
        await this.persistSimpState();
        return json({ ok: true, ...advanced }, 200, allowedOrigin, cred);
      }
      if (!xId) {
        this.simpQuizAttempts[attemptKey] = advanced.attempt;
        this.simpQuizMetrics.completions++;
        await this.persistSimpState();
        return json({ ok: true, done: true, linkRequired: true, attemptId: attemptKey.slice(5), feedback: advanced.feedback }, 200, allowedOrigin, cred);
      }
      const result = submitQuiz(this.simpProfiles, session, advanced.attempt);
      if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
      this.simpProfiles = result.store;
      this.simpQuizMetrics.completions++;
      countQuizResult(this.simpQuizMetrics, advanced.attempt, result.quiz);
      const resultId = randomUrlToken(9); result.quiz.resultUrl = `https://lobby.getdasha.com/simp/r/${resultId}`; this.simpQuizResults[resultId] = result.quiz;
      // Keep resultUrl on stored profile so Share always has a permanent link (incl. retakes / Perry).
      this.simpProfiles[xId] = { ...this.simpProfiles[xId], quiz: { ...result.quiz, resultUrl: result.quiz.resultUrl } };
      this.simpReferrals = noteReferralQuiz(this.simpReferrals, xId);
      this.noteReferralEnrollment(xId, result.created);
      delete this.simpQuizAttempts[attemptKey];
      await this.persistSimpState();
      return json({
        ok: true,
        done: true,
        retake: Boolean(result.retake),
        feedback: advanced.feedback,
        quiz: this.simpProfiles[xId].quiz,
        resultUrl: result.quiz.resultUrl,
        ...meStatus(this.simpProfiles, session),
      }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/internal/donate' && request.method === 'POST') {
      const secret = request.headers.get('x-dasha-internal') || '';
      if (!this.env.LOBBY_SESSION_SECRET || secret !== String(this.env.LOBBY_SESSION_SECRET)) {
        return json({ error: 'forbidden' }, 403, allowedOrigin, cred);
      }
      const input = await requestJson(request);
      const session = {
        xId: input?.xId,
        handle: input?.handle,
        avatar: input?.avatar,
        verifiedType: input?.verifiedType,
      };
      const result = creditDonate(this.simpProfiles, session, {
        signature: input?.signature,
        amountRaw: input?.amountRaw,
        at: input?.at,
        proven: input?.proven === true,
      });
      if (!result.ok) return json({ ok: false, awarded: false, error: result.error }, 200, allowedOrigin, cred);
      this.simpProfiles = result.store;
      await this.persistSimpState();
      return json({
        ok: true,
        awarded: true,
        points: result.points,
        donate: result.donate,
      }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/spotlight') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      const session = await sessionFromRequest(this.env, request);
      const xId = String(session?.xId || '');
      const rate = simpRate(this.simpRates, `simp-spotlight:${xId || 'anon'}`, 6);
      if (!rate.ok) return json({ error: 'spotlight updates rate limited', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      const result = setSimpSpotlight(this.simpProfiles, session, input?.url);
      if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
      this.simpProfiles = result.store;
      await this.persistSimpState();
      return json({ ok: true, spotlight: result.spotlight, ...meStatus(this.simpProfiles, session) }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/join') {
      if (request.method !== 'POST') {
        return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      }
      const session = await sessionFromRequest(this.env, request);
      const result = joinBoard(this.simpProfiles, session);
      if (!result.ok) return json({ error: result.error }, result.status || 401, allowedOrigin, cred);
      this.simpProfiles = result.store;
      this.noteReferralEnrollment(session.xId, result.created);
      await this.persistSimpState();
      return json(
        {
          ok: true,
          created: result.created,
          ...meStatus(this.simpProfiles, session),
        },
        200,
        allowedOrigin,
        cred,
      );
    }

    if (path === '/simp/leave') {
      if (request.method !== 'POST') {
        return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      }
      const session = await sessionFromRequest(this.env, request);
      const profile = session?.xId ? this.simpProfiles[String(session.xId)] : null;
      const result = leaveBoard(this.simpProfiles, session);
      if (!result.ok) return json({ error: result.error }, result.status || 401, allowedOrigin, cred);
      this.simpProfiles = result.store;
      this.simpReferrals = removeReferralIdentity(this.simpReferrals, session.xId);
      this.refreshReferralScores();
      for (const [claimId, claim] of Object.entries(this.simpClaims)) if (claim.xId === String(session.xId)) delete this.simpClaims[claimId];
      delete this.simpQuizAttempts[String(session.xId)];
      const resultId = String(profile?.quiz?.resultUrl || '').match(/\/simp\/r\/([^/?#]+)/)?.[1];
      if (resultId) delete this.simpQuizResults[resultId];
      this.simpSeasons = scrubSeasonSnapshots(this.simpSeasons, session.xId, profile?.handle || session.handle);
      this.deleteChessIdentity(session.xId);
      await this.state.storage.delete(`simpHolder:${session.xId}`);
      await this.persistSimpState();
      await this.persistChess();
      return json(
        {
          ok: true,
          removed: result.removed,
          ...meStatus(this.simpProfiles, session),
        },
        200,
        allowedOrigin,
        cred,
      );
    }

    if (path === '/simp/claims') {
      const session = await sessionFromRequest(this.env, request);
      if (request.method === 'GET') return json({ ok: true, claims: claimsForSession(this.simpClaims, session) }, 200, allowedOrigin, cred);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const result = submitClaim(this.simpClaims, this.simpProfiles, session, await requestJson(request), { id: id() });
      if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
      this.simpClaims = result.claims;
      await this.persistSimpState();
      return json({ ok: true, claim: result.claim }, 201, allowedOrigin, cred);
    }

    if (path === '/simp/review') {
      if (!modAllowed(request, this.env)) return json({ error: 'mod denied' }, 403, allowedOrigin, cred);
      if (request.method === 'GET') return json({ ok: true, claims: pendingClaims(this.simpClaims) }, 200, allowedOrigin, cred);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const result = reviewClaim(this.simpClaims, this.simpProfiles, await requestJson(request));
      if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
      this.simpClaims = result.claims;
      this.simpProfiles = result.profiles;
      if (result.claim?.status === 'approved') {
        const reviewed = Object.values(this.simpClaims).find((claim) => claim.id === result.claim.id);
        const before = this.simpReferrals;
        this.simpReferrals = qualifyReferral(this.simpReferrals, reviewed?.xId);
        if (before !== this.simpReferrals) this.simpReferralMetrics.contributions++;
        this.refreshReferralScores();
      }
      await this.persistSimpState();
      return json({ ok: true, claim: result.claim }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/seasons' && request.method === 'GET') {
      return json({ ok: true, seasons: publicSeasons(this.simpSeasons) }, 200, allowedOrigin);
    }

    if (path === '/simp/seasons/snapshot') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (!modAllowed(request, this.env)) return json({ error: 'mod denied' }, 403, allowedOrigin, cred);
      const result = snapshotSeason(this.simpSeasons, this.simpProfiles, await requestJson(request));
      if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
      this.simpSeasons = result.snapshots;
      await this.persistSimpState();
      return json({ ok: true, snapshot: result.snapshot }, 201, allowedOrigin, cred);
    }

    if (path === '/simp/wallet/challenge') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      const session = await sessionFromRequest(this.env, request);
      if (!session?.xId || !this.simpProfiles[String(session.xId)]) return json({ error: 'join board first' }, 401, allowedOrigin, cred);
      const publicKey = String((await requestJson(request)).publicKey || '');
      if (!isValidSolanaAddress(publicKey)) return json({ error: 'valid Solana address required' }, 400, allowedOrigin, cred);
      const allowed = simpRate(this.simpRates, `holder-challenge:${session.xId}`, 6);
      if (!allowed.ok) return json({ error: 'holder check rate limited', waitMs: allowed.waitMs }, 429, allowedOrigin, cred);
      const issuedAt = Date.now(), expiresAt = issuedAt + 5 * 60_000;
      const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const proofOrigin = new URL(allowedOrigin);
      const message = walletMessage({ handle: session.handle, publicKey, nonce, issuedAt, expiresAt, domain: proofOrigin.host, uri: `${proofOrigin.origin}/` });
      const challenge = await signPayload(this.env.LOBBY_SESSION_SECRET, { kind: 'simp_holder', xId: String(session.xId), publicKey, nonce, message, origin: proofOrigin.origin, exp: expiresAt });
      await this.state.storage.put(`simpHolder:${session.xId}`, { nonce, exp: expiresAt });
      return json({ ok: true, message, challenge, expiresAt }, 200, allowedOrigin, cred);
    }

    if (path === '/simp/wallet/verify') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      const session = await sessionFromRequest(this.env, request);
      if (session?.xId) {
        const allowed = simpRate(this.simpRates, `holder-verify:${session.xId}`, 4);
        if (!allowed.ok) return json({ error: 'holder check rate limited', waitMs: allowed.waitMs }, 429, allowedOrigin, cred);
      }
      const body = await requestJson(request);
      const challenge = await verifyPayload(this.env.LOBBY_SESSION_SECRET, body.challenge);
      if (!session?.xId || !challenge || challenge.kind !== 'simp_holder' || challenge.xId !== String(session.xId) || challenge.publicKey !== body.publicKey || challenge.origin !== allowedOrigin) return json({ error: 'invalid holder challenge' }, 401, allowedOrigin, cred);
      const signatureOk = await verifyEd25519(challenge.message, body.publicKey, body.signature).catch(() => false);
      if (!signatureOk) return json({ error: 'invalid wallet signature' }, 400, allowedOrigin, cred);
      const key = `simpHolder:${session.xId}`;
      const pending = await this.state.storage.get(key);
      if (!pending || pending.nonce !== challenge.nonce || pending.exp < Date.now()) return json({ error: 'holder challenge already used' }, 409, allowedOrigin, cred);
      let holds;
      try { holds = await walletHoldsDasha(this.env, body.publicKey); }
      catch { return json({ error: 'Solana holder check unavailable — try again' }, 503, allowedOrigin, cred); }
      await this.state.storage.delete(key);
      if (!holds) return json({ error: 'wallet does not currently hold $dasha' }, 400, allowedOrigin, cred);
      const result = applyHolderProof(this.simpProfiles, session);
      if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
      this.simpProfiles = result.profiles;
      await this.persistSimpState();
      return json({ ok: true, holder: true, checkedAt: result.profile.holderCheckedAt, expiresAt: result.profile.holderUntil }, 200, allowedOrigin, cred);
    }

    return json({ error: 'not found' }, 404, allowedOrigin, cred);
  }

  async handleChess(request, allowedOrigin) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const cred = { credentials: true };
    const session = await sessionFromRequest(this.env, request);
    const xId = session?.xId ? String(session.xId) : '';
    const profile = xId ? this.simpProfiles[xId] : null;
    const holder = Boolean(profile && Number(profile.holderUntil) > Date.now());
    const requireLinked = () => !xId ? json({ error: 'link X first' }, 401, allowedOrigin, cred) : null;
    const requireOrigin = () => request.method !== 'GET' && !allowedOrigin ? json({ error: 'origin required' }, 403, null) : null;
    const registrationExpired = this.expireChessRegistrations();
    if (this.expireChessChallenges() || registrationExpired) await this.persistChess();

    if (path === '/chess/event' && request.method === 'POST') {
      const input = await requestJson(request);
      const publicKey = { page_open: 'pageOpens', local_play_intent: 'localPlayIntents', local_completion: 'localCompletions', local_rematch_intent: 'localRematchIntents', local_share_intent: 'localShareIntents', link_intent: 'linkIntents', enrollment_intent: 'enrollmentIntents', holder_proof_intent: 'holderProofIntents', queue_intent: 'queueIntents', buy_intent: 'buyIntents', replay_open: 'replayOpens', replay_play: 'replayPlayIntents', replay_share: 'replayShareIntents', replay_share_handoff: 'replayShareHandoffs', challenge_share: 'challengeShareIntents', tournament_share: 'tournamentShareIntents' }[input?.event];
      if (publicKey) {
        const blocked = requireOrigin();
        if (blocked) return blocked;
        const subject = xId ? `x:${xId}` : request.headers.get('CF-Connecting-IP');
        if (!subject) return json({ error: 'event subject required' }, 400, allowedOrigin);
        const rate = simpRate(this.simpRates, `chess-event:${subject}`, 60);
        if (!rate.ok) return json({ error: 'event rate limited', waitMs: rate.waitMs }, 429, allowedOrigin);
        countMetric(this.chessMetrics, publicKey);
        await this.persistChessMetrics();
        return json({ ok: true }, 200, allowedOrigin);
      }
      return json({ error: 'invalid event' }, 400, allowedOrigin, cred);
    }

    if (path === '/chess/me' && request.method === 'GET') {
      const gameId = xId ? this.chessCurrent[xId] : null;
      const expired = gameId ? this.expireChessClock(this.chessGames[gameId]) : { game: null, expired: false };
      if (expired.expired) await this.persistChess();
      const game = publicChessGame(expired.game, xId);
      const rating = xId ? this.chessRating(xId, session.handle) : null;
      return json({
        ok: true,
        linked: Boolean(xId),
        enrolled: Boolean(profile),
        holder,
        holderExpiresAt: holder ? Number(profile.holderUntil) : null,
        x: xId ? { display: `@${session.handle}`, href: `https://x.com/${session.handle}` } : null,
        rating: rating ? { rating: rating.rating, games: rating.games, wins: rating.wins, losses: rating.losses, draws: rating.draws } : null,
        queued: Boolean(xId && this.chessQueue.some(row => row.xId === xId)),
        game,
      }, 200, allowedOrigin, cred);
    }

    if (path === '/chess/mod/ratings') {
      if (!modAllowed(request, this.env)) return json({ error: 'mod denied' }, 403, allowedOrigin);
      if (request.method === 'GET') return json({ ok: true, hidden: Object.values(this.chessHidden).map(row => row.handle).sort() }, 200, allowedOrigin);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin);
      const input = await requestJson(request), handle = String(input?.handle || '').replace(/^@/, '').toLowerCase();
      const matches = Object.entries(this.chessRatings).filter(([, row]) => row?.handle === handle);
      if (!matches.length) return json({ error: 'rating not found' }, 404, allowedOrigin);
      if (matches.length > 1) return json({ error: 'ambiguous historic handle' }, 409, allowedOrigin);
      const found = matches[0];
      if (input?.action === 'hide') this.chessHidden[found[0]] = { handle, at: Date.now() };
      else if (input?.action === 'unhide') delete this.chessHidden[found[0]];
      else return json({ error: 'invalid action' }, 400, allowedOrigin);
      await this.persistChess();
      return json({ ok: true, handle, hidden: input.action === 'hide' }, 200, allowedOrigin);
    }

    if (path === '/chess/ratings' && request.method === 'GET') {
      const ratings = Object.entries(this.chessRatings)
        .filter(([xId, row]) => !this.chessHidden[xId] && row?.handle && Number(row.games) > 0)
        .map(([, row]) => row)
        .sort((a, b) => Number(b.rating) - Number(a.rating) || Number(b.games) - Number(a.games) || String(a.handle).localeCompare(String(b.handle)))
        .slice(0, 20)
        .map((row, index) => ({ rank: index + 1, handle: row.handle, display: `@${row.handle}`, href: `https://x.com/${row.handle}`, rating: row.rating, games: row.games, wins: row.wins, losses: row.losses, draws: row.draws }));
      const recent = Object.values(this.chessGames)
        .filter(game => game?.rated && game.state?.status === 'finished' && !this.chessHidden[game.players?.w?.xId] && !this.chessHidden[game.players?.b?.xId])
        .sort((a, b) => Number(b.finishedAt || b.updatedAt) - Number(a.finishedAt || a.updatedAt))
        .slice(0, 5)
        .map(game => ({ id: game.id, white: `@${game.players.w.handle}`, black: `@${game.players.b.handle}`, result: game.state.result }));
      return json({ ok: true, ratings, recent }, 200, allowedOrigin);
    }

    const replayMatch = path.match(/^\/chess\/replay\/([A-Za-z0-9_-]{6,24})$/);
    if (replayMatch && request.method === 'GET') {
      const replay = publicChessReplay(this.chessGames[replayMatch[1]]);
      return replay ? json({ ok: true, replay }, 200, allowedOrigin) : json({ error: 'replay not found' }, 404, allowedOrigin);
    }

    if (path === '/chess/challenges') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const blocked = requireOrigin() || requireLinked();
      if (blocked) return blocked;
      const rate = simpRate(this.simpRates, `chess-challenge:${xId}`, 12);
      if (!rate.ok) return json({ error: 'challenge actions rate limited', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      if (!profile || !holder) return json({ error: 'current holder proof required' }, 403, allowedOrigin, cred);
      const current = this.chessGames[this.chessCurrent[xId]];
      if (current?.state?.status === 'active') return json({ error: 'finish your current game first' }, 409, allowedOrigin, cred);
      if (this.activeTournamentFor(xId)) return json({ error: 'leave or finish the tournament first' }, 409, allowedOrigin, cred);
      const existing = this.openChessChallengeFor(xId);
      if (existing) return json({ ok: true, challenge: this.publicChessChallenge(existing, xId, holder) }, 200, allowedOrigin, cred);
      const id = randomUrlToken(9), createdAt = Date.now();
      const challenge = { id, creatorXId: xId, creatorHandle: String(session.handle).toLowerCase(), status: 'open', createdAt, expiresAt: createdAt + CHESS_CHALLENGE_MS, updatedAt: createdAt };
      this.chessChallenges[id] = challenge;
      this.chessQueue = this.chessQueue.filter(row => row.xId !== xId);
      this.chessMetrics.challengesCreated++;
      await this.persistChess();
      return json({ ok: true, challenge: this.publicChessChallenge(challenge, xId, holder) }, 201, allowedOrigin, cred);
    }

    const challengeMatch = path.match(/^\/chess\/challenge\/([A-Za-z0-9_-]{6,24})$/);
    if (challengeMatch) {
      const challenge = this.chessChallenges[challengeMatch[1]];
      if (!challenge) return json({ error: 'challenge not found' }, 404, allowedOrigin, cred);
      if (request.method === 'GET') return json({ ok: true, challenge: this.publicChessChallenge(challenge, xId, holder) }, 200, allowedOrigin, cred);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const blocked = requireOrigin() || requireLinked();
      if (blocked) return blocked;
      const rate = simpRate(this.simpRates, `chess-challenge:${xId}`, 12);
      if (!rate.ok) return json({ error: 'challenge actions rate limited', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      if (input?.action === 'cancel') {
        if (challenge.creatorXId !== xId) return json({ error: 'only the creator can cancel' }, 403, allowedOrigin, cred);
        if (challenge.status !== 'open') return json({ error: 'challenge is not open' }, 409, allowedOrigin, cred);
        challenge.status = 'cancelled'; challenge.updatedAt = Date.now();
        await this.persistChess();
        return json({ ok: true, challenge: this.publicChessChallenge(challenge, xId, holder) }, 200, allowedOrigin, cred);
      }
      if (input?.action !== 'accept') return json({ error: 'invalid challenge action' }, 400, allowedOrigin, cred);
      if (challenge.status === 'accepted' && challenge.acceptedByXId === xId) {
        const existing = this.chessGames[challenge.gameId];
        if (existing) return json({ ok: true, challenge: this.publicChessChallenge(challenge, xId, holder), game: publicChessGame(existing, xId) }, 200, allowedOrigin, cred);
      }
      if (!profile || !holder) return json({ error: 'current holder proof required' }, 403, allowedOrigin, cred);
      if (challenge.status !== 'open') return json({ error: 'challenge is not open' }, 409, allowedOrigin, cred);
      if (challenge.creatorXId === xId) return json({ error: 'you cannot accept your own challenge' }, 409, allowedOrigin, cred);
      const creatorProfile = this.simpProfiles[challenge.creatorXId];
      if (!creatorProfile || Number(creatorProfile.holderUntil) <= Date.now()) return json({ error: 'challenger must refresh holder proof' }, 409, allowedOrigin, cred);
      for (const playerId of [challenge.creatorXId, xId]) {
        const current = this.chessGames[this.chessCurrent[playerId]];
        if (current?.state?.status === 'active') return json({ error: 'a player is already in a game' }, 409, allowedOrigin, cred);
        if (this.activeTournamentFor(playerId)) return json({ error: 'a player is in a tournament' }, 409, allowedOrigin, cred);
      }
      const game = this.makeChessGame({ xId: challenge.creatorXId, handle: challenge.creatorHandle }, { xId, handle: String(session.handle).toLowerCase() }, { swap: true });
      challenge.status = 'accepted'; challenge.acceptedByXId = xId; challenge.gameId = game.id; challenge.updatedAt = Date.now();
      this.chessQueue = this.chessQueue.filter(row => row.xId !== challenge.creatorXId && row.xId !== xId);
      this.chessMetrics.challengesAccepted++;
      await this.persistChess();
      return json({ ok: true, challenge: this.publicChessChallenge(challenge, xId, holder), game: publicChessGame(game, xId) }, 201, allowedOrigin, cred);
    }

    if (path === '/chess/tournaments') {
      if (request.method === 'GET') {
        const tournaments = Object.values(this.chessTournaments)
          .filter(row => row.status !== 'cancelled')
          .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
          .slice(0, 12)
          .map(row => this.publicChessTournament(row, xId));
        return json({ ok: true, tournaments }, 200, allowedOrigin, cred);
      }
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const blocked = requireOrigin() || requireLinked();
      if (blocked) return blocked;
      const existing = Object.values(this.chessTournaments).find(row => row.organizerXId === xId && (row.status === 'registration' || row.status === 'active'));
      if (existing) return json({ ok: true, tournament: this.publicChessTournament(existing, xId) }, 200, allowedOrigin, cred);
      const rate = simpRate(this.simpRates, `chess-tournament:${xId}`, 12);
      if (!rate.ok) return json({ error: 'tournament actions rate limited', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      if (!profile || !holder) return json({ error: 'current holder proof required' }, 403, allowedOrigin, cred);
      if (this.openChessChallengeFor(xId)) return json({ error: 'cancel your open challenge first' }, 409, allowedOrigin, cred);
      if (Object.values(this.chessTournaments).some(row => row.status === 'registration' || row.status === 'active')) return json({ error: 'a tournament is already open' }, 409, allowedOrigin, cred);
      const current = this.chessGames[this.chessCurrent[xId]];
      if (current?.state?.status === 'active') return json({ error: 'finish your current game first' }, 409, allowedOrigin, cred);
      const input = await requestJson(request);
      const name = String(input?.name || '').trim().replace(/\s+/g, ' ').slice(0, 48);
      if (name.length < 3) return json({ error: 'tournament name is too short' }, 400, allowedOrigin, cred);
      const id = randomUrlToken(8), createdAt = Date.now();
      const tournament = { id, name, organizerXId: xId, organizerHandle: session.handle, status: 'registration', entrants: [{ xId, handle: session.handle }], rounds: [], champion: null, createdAt, startedAt: null, finishedAt: null };
      this.chessTournaments[id] = tournament;
      this.chessQueue = this.chessQueue.filter(row => row.xId !== xId);
      this.chessMetrics.tournamentsCreated++;
      await this.persistChess();
      return json({ ok: true, tournament: this.publicChessTournament(tournament, xId) }, 201, allowedOrigin, cred);
    }

    const tournamentMatch = path.match(/^\/chess\/tournament\/([A-Za-z0-9_-]{6,24})$/);
    if (tournamentMatch) {
      const tournament = this.chessTournaments[tournamentMatch[1]];
      if (!tournament || tournament.status === 'cancelled') return json({ error: 'tournament not found' }, 404, allowedOrigin, cred);
      if (request.method === 'GET') return json({ ok: true, tournament: this.publicChessTournament(tournament, xId) }, 200, allowedOrigin, cred);
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const blocked = requireOrigin() || requireLinked();
      if (blocked) return blocked;
      const rate = simpRate(this.simpRates, `chess-tournament:${xId}`, 12);
      if (!rate.ok) return json({ error: 'tournament actions rate limited', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      if (input?.action === 'start' && tournament.organizerXId === xId && (tournament.status === 'active' || tournament.status === 'finished')) {
        return json({ ok: true, tournament: this.publicChessTournament(tournament, xId) }, 200, allowedOrigin, cred);
      }
      if (input?.action === 'join') {
        if (tournament.status !== 'registration') return json({ error: 'registration is closed' }, 409, allowedOrigin, cred);
        if (!profile || !holder) return json({ error: 'current holder proof required' }, 403, allowedOrigin, cred);
        const joined = tournament.entrants.some(row => row.xId === xId);
        if (!joined && tournament.entrants.length >= 16) return json({ error: 'tournament is full' }, 409, allowedOrigin, cred);
        const current = this.chessGames[this.chessCurrent[xId]];
        if (current?.state?.status === 'active') return json({ error: 'finish your current game first' }, 409, allowedOrigin, cred);
        if (this.openChessChallengeFor(xId)) return json({ error: 'cancel your open challenge first' }, 409, allowedOrigin, cred);
        if (!joined) {
          tournament.entrants.push({ xId, handle: session.handle });
          this.chessMetrics.tournamentJoins++;
        }
        this.chessQueue = this.chessQueue.filter(row => row.xId !== xId);
      } else if (input?.action === 'leave') {
        if (tournament.status !== 'registration') return json({ error: 'registration is closed' }, 409, allowedOrigin, cred);
        if (tournament.organizerXId === xId) return json({ error: 'organizer can cancel the tournament' }, 409, allowedOrigin, cred);
        tournament.entrants = tournament.entrants.filter(row => row.xId !== xId);
      } else if (input?.action === 'cancel') {
        if (tournament.organizerXId !== xId || tournament.status !== 'registration') return json({ error: 'organizer cannot cancel now' }, 403, allowedOrigin, cred);
        tournament.status = 'cancelled';
      } else if (input?.action === 'start') {
        if (tournament.organizerXId !== xId || tournament.status !== 'registration') return json({ error: 'organizer cannot start now' }, 403, allowedOrigin, cred);
        if (tournament.entrants.length < 2) return json({ error: 'two holders are required' }, 409, allowedOrigin, cred);
        for (const entrant of tournament.entrants) {
          if (!this.simpProfiles[entrant.xId] || Number(this.simpProfiles[entrant.xId].holderUntil) <= Date.now()) return json({ error: `@${entrant.handle} must refresh holder proof` }, 409, allowedOrigin, cred);
          const active = this.chessGames[this.chessCurrent[entrant.xId]];
          if (active?.state?.status === 'active') return json({ error: `@${entrant.handle} is already playing` }, 409, allowedOrigin, cred);
        }
        for (let i = tournament.entrants.length - 1; i > 0; i--) {
          const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
          [tournament.entrants[i], tournament.entrants[j]] = [tournament.entrants[j], tournament.entrants[i]];
        }
        tournament.status = 'active'; tournament.startedAt = Date.now();
        const entrantIds = new Set(tournament.entrants.map(row => row.xId));
        this.chessQueue = this.chessQueue.filter(row => !entrantIds.has(row.xId));
        this.chessMetrics.tournamentsStarted++;
        this.startTournamentRound(tournament, tournament.entrants);
      } else return json({ error: 'invalid tournament action' }, 400, allowedOrigin, cred);
      await this.persistChess();
      return json({ ok: true, tournament: this.publicChessTournament(tournament, xId) }, 200, allowedOrigin, cred);
    }

    if (path === '/chess/queue') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      const blocked = requireOrigin() || requireLinked();
      if (blocked) return blocked;
      if (!profile) return json({ error: 'join the Simp Board first' }, 403, allowedOrigin, cred);
      if (!holder) return json({ error: 'prove current $dasha ownership first' }, 403, allowedOrigin, cred);
      const rate = simpRate(this.simpRates, `chess-queue:${xId}`, 10);
      if (!rate.ok) return json({ error: 'matchmaking rate limited', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      this.pruneChessQueue();
      if (input?.action === 'cancel') {
        this.chessQueue = this.chessQueue.filter(row => row.xId !== xId);
        await this.persistChess();
        return json({ ok: true, queued: false }, 200, allowedOrigin, cred);
      }
      const currentId = this.chessCurrent[xId];
      const current = currentId && this.chessGames[currentId];
      if (current?.state?.status === 'active') return json({ ok: true, matched: true, game: publicChessGame(current, xId) }, 200, allowedOrigin, cred);
      if (currentId) delete this.chessCurrent[xId];
      if (this.activeTournamentFor(xId)) return json({ error: 'leave or finish the tournament before casual matchmaking' }, 409, allowedOrigin, cred);
      if (this.openChessChallengeFor(xId)) return json({ error: 'cancel your open challenge before matchmaking' }, 409, allowedOrigin, cred);
      this.chessQueue = this.chessQueue.filter(row => row.xId !== xId);
      const opponent = this.chessQueue.shift();
      if (!opponent) {
        this.chessQueue.push({ xId, handle: String(session.handle).toLowerCase(), at: Date.now() });
        await this.persistChess();
        return json({ ok: true, queued: true }, 200, allowedOrigin, cred);
      }
      const game = this.makeChessGame(opponent, { xId, handle: session.handle });
      await this.persistChess();
      return json({ ok: true, matched: true, game: publicChessGame(game, xId) }, 201, allowedOrigin, cred);
    }

    const gameMatch = path.match(/^\/chess\/game\/([A-Za-z0-9_-]{6,24})$/);
    if (gameMatch) {
      const blocked = requireLinked();
      if (blocked) return blocked;
      let game = this.chessGames[gameMatch[1]];
      const expired = this.expireChessClock(game);
      game = expired.game;
      if (expired.expired) await this.persistChess();
      const publicGame = publicChessGame(game, xId);
      if (!game || !publicGame) return json({ error: 'game not found' }, 404, allowedOrigin, cred);
      if (request.method === 'GET') return json({ ok: true, game: publicGame }, 200, allowedOrigin, cred);
      const originBlocked = requireOrigin();
      if (originBlocked) return originBlocked;
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, cred);
      if (expired.expired) return json({ error: 'time expired', game: publicGame }, 409, allowedOrigin, cred);
      const rate = simpRate(this.simpRates, `chess-move:${xId}`, 40);
      if (!rate.ok) return json({ error: 'move rate limited', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      const crossed = this.expireChessClock(game);
      if (crossed.expired) {
        game = crossed.game;
        await this.persistChess();
        return json({ error: 'time expired', game: publicChessGame(game, xId) }, 409, allowedOrigin, cred);
      }
      if (Number(input?.version) !== Number(game.state.version)) return json({ error: 'position changed', game: publicChessGame(game, xId) }, 409, allowedOrigin, cred);
      const side = game.players.w.xId === xId ? 'w' : 'b';
      if (input?.action === 'rematch') {
        if (game.state.status !== 'finished') return json({ error: 'finish this game first' }, 409, allowedOrigin, cred);
        if (game.tournamentId) return json({ error: 'tournament rematches are automatic' }, 409, allowedOrigin, cred);
        if (!holder) return json({ error: 'refresh holder proof first' }, 403, allowedOrigin, cred);
        if (game.rematchGameId) {
          const existing = this.chessGames[game.rematchGameId];
          return json({ ok: true, game: publicChessGame(existing, xId) || publicChessGame(game, xId) }, 200, allowedOrigin, cred);
        }
        const opponentId = side === 'w' ? game.players.b.xId : game.players.w.xId;
        for (const playerId of [xId, opponentId]) {
          const current = this.chessGames[this.chessCurrent[playerId]];
          if (current?.id !== game.id && current?.state?.status === 'active') return json({ error: 'finish the active game before rematching' }, 409, allowedOrigin, cred);
          if (this.activeTournamentFor(playerId)) return json({ error: 'leave or finish the tournament before rematching' }, 409, allowedOrigin, cred);
          if (this.openChessChallengeFor(playerId)) return json({ error: 'cancel the open challenge before rematching' }, 409, allowedOrigin, cred);
        }
        if (!game.rematchOfferBy) {
          game.rematchOfferBy = xId;
          game.updatedAt = Date.now();
          this.chessGames[game.id] = game;
          this.chessMetrics.rematchesOffered++;
          await this.persistChess();
          this.broadcastChess(game);
          return json({ ok: true, game: publicChessGame(game, xId) }, 200, allowedOrigin, cred);
        }
        if (game.rematchOfferBy === xId) return json({ ok: true, game: publicChessGame(game, xId) }, 200, allowedOrigin, cred);
        const opponentProfile = this.simpProfiles[opponentId];
        if (!opponentProfile || Number(opponentProfile.holderUntil) <= Date.now()) return json({ error: 'opponent must refresh holder proof' }, 409, allowedOrigin, cred);
        this.chessQueue = this.chessQueue.filter(row => row.xId !== xId && row.xId !== opponentId);
        const rematch = this.makeChessGame(game.players.b, game.players.w, { swap: true });
        this.chessMetrics.rematchesAccepted++;
        game.rematchGameId = rematch.id;
        game.updatedAt = Date.now();
        this.chessGames[game.id] = game;
        await this.persistChess();
        this.broadcastChess(game);
        return json({ ok: true, game: publicChessGame(rematch, xId) }, 201, allowedOrigin, cred);
      }
      let result;
      if (input?.action === 'resign') result = resignChess(game.state, side);
      else if (input?.action === 'offer_draw') {
        if (game.state.moves.length < 2) return json({ error: 'play one move each before offering a draw' }, 409, allowedOrigin, cred);
        if (game.drawOfferBy && game.drawOfferBy !== xId) {
          result = { ok: true, state: { ...game.state, status: 'finished', result: '1/2-1/2', reason: 'draw agreed', version: Number(game.state.version) + 1 } };
        } else {
          if (game.state.turn === side) return json({ error: 'offer a draw after your move' }, 409, allowedOrigin, cred);
          game.drawOfferBy = xId;
          game.updatedAt = Date.now();
          this.chessGames[game.id] = game;
          await this.persistChess();
          this.broadcastChess(game);
          return json({ ok: true, game: publicChessGame(game, xId) }, 200, allowedOrigin, cred);
        }
      }
      else {
        if (game.state.turn !== side) return json({ error: 'wait for your turn' }, 409, allowedOrigin, cred);
        result = playMove(game.state, input);
      }
      if (!result.ok) return json({ error: result.error }, result.status || 400, allowedOrigin, cred);
      const now = Date.now();
      const timed = input?.action === 'resign' || input?.action === 'offer_draw' ? game : { ...game, drawOfferBy: null, clock: this.clockAfterMove(game, side, now) };
      const next = this.chessFinish(timed, result.state);
      await this.persistChess();
      this.broadcastChess(next);
      return json({ ok: true, game: publicChessGame(next, xId) }, 200, allowedOrigin, cred);
    }

    return json({ error: 'not found' }, 404, allowedOrigin, cred);
  }

  async alarm() {
    this.history = pruneHistory(this.history);
    await this.state.storage.put('history', this.history.slice(-MAX_HISTORY));
    // Drop expired mutes + idle sockets
    const now = Date.now();
    await this.compute.prune(now);
    let chessChanged = this.pruneChessQueue(now);
    if (this.expireChessRegistrations(now)) chessChanged = true;
    if (this.expireChessChallenges(now)) chessChanged = true;
    for (const game of Object.values(this.chessGames)) {
      const result = this.expireChessClock(game, now);
      if (result.expired) { chessChanged = true; this.broadcastChess(result.game); }
    }
    if (chessChanged) await this.persistChess();
    for (const [k, until] of [...this.mutes.entries()]) {
      if (until <= now) this.mutes.delete(k);
    }
    for (const [key, rate] of this.simpRates) if (now - rate.lastMs > 60 * 60_000) this.simpRates.delete(key);
    await this.persistMutes();
    for (const ws of this.state.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() || {};
        const last = Number(att.lastActive) || Number(att.joined) || 0;
        if (last && now - last > IDLE_MS) {
          try {
            ws.close(4003, 'idle timeout');
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }
    await this.state.storage.setAlarm(Date.now() + 5 * 60_000);
  }

  async persist() {
    this.history = pruneHistory(this.history);
    await this.state.storage.put('history', this.history.slice(-MAX_HISTORY));
  }

  async persistMutes() {
    const rows = [];
    const now = Date.now();
    for (const [key, until] of this.mutes.entries()) {
      if (until > now) rows.push({ key, until });
    }
    await this.state.storage.put('mutes', rows);
  }

  async persistFlags() {
    await this.state.storage.put('flags', {
      shield: this.shield,
      forceSlow: this.forceSlow,
      autoShieldUntil: this.autoShieldUntil,
      customPin: this.customPin,
    });
  }

  effectiveShield() {
    if (this.autoShieldUntil && Date.now() < this.autoShieldUntil) return true;
    return this.shield;
  }

  activePin() {
    if (this.customPin?.text) {
      return { type: 'pin', text: this.customPin.text, mint: MINT, custom: true };
    }
    return PIN;
  }

  maybeAutoShield() {
    const { spike } = noteSpamHit(this.spamHits);
    if (!spike) return false;
    if (this.effectiveShield()) return false;
    this.autoShieldUntil = Date.now() + AUTO_SHIELD_MS;
    this.stats.autoShields++;
    this.persistFlags();
    this.broadcast({
      type: 'system',
      text: 'auto-shield on · spam spike · X-linked chat only for ~10m',
      ts: Date.now(),
    });
    this.schedulePresence();
    return true;
  }

  liveCount() {
    return this.state.getWebSockets().length;
  }

  linkedCount() {
    let n = 0;
    for (const ws of this.state.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() || {};
        if (att.linked && att.handle) n++;
      } catch {
        /* ignore */
      }
    }
    return n;
  }

  touch(ws, att) {
    att.lastActive = Date.now();
    try {
      ws.serializeAttachment(att);
    } catch {
      /* ignore */
    }
  }

  roomStats() {
    const count = this.liveCount();
    const mins = Math.max(1 / 60, (Date.now() - this.stats.startedAt) / 60000);
    return {
      ok: true,
      service: 'dasha-lobby',
      count,
      linked: this.linkedCount(),
      max: MAX_SOCKETS,
      softCapAnon: ANON_SOFT_CAP,
      slow: this.forceSlow || count >= SLOW_MODE_AT,
      shield: this.effectiveShield(),
      forceShield: this.shield,
      autoShieldUntil: this.autoShieldUntil || null,
      mutes: this.mutes.size,
      joins: this.stats.joins,
      chats: this.stats.chats,
      rejectsFull: this.stats.rejectsFull,
      rejectsIp: this.stats.rejectsIp,
      autoShields: this.stats.autoShields,
      chatsPerMin: Math.round((this.stats.chats / mins) * 10) / 10,
      uptimeMs: Date.now() - this.stats.startedAt,
      xLink: xConfigured(this.env),
      customPin: Boolean(this.customPin?.text),
    };
  }

  syncNicksFromSockets() {
    this.nicks.clear();
    for (const ws of this.state.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() || {};
        if (att.id && att.nick) this.nicks.set(att.id, att.nick);
      } catch {
        /* ignore */
      }
    }
  }

  nickList() {
    this.syncNicksFromSockets();
    const names = [];
    for (const n of this.nicks.values()) {
      if (n && names.length < 12) names.push(n);
    }
    return names;
  }

  presence() {
    const count = this.liveCount();
    return {
      type: 'presence',
      count,
      linked: this.linkedCount(),
      nicks: this.nickList(),
      slow: this.forceSlow || count >= SLOW_MODE_AT,
      shield: this.effectiveShield(),
      remaining: Math.max(0, MAX_SOCKETS - count),
      max: MAX_SOCKETS,
    };
  }

  capacity() {
    const count = this.liveCount();
    return {
      ok: true,
      count,
      linked: this.linkedCount(),
      max: MAX_SOCKETS,
      softCapAnon: ANON_SOFT_CAP,
      maxPerIp: MAX_PER_IP,
      slowAt: SLOW_MODE_AT,
      full: count >= MAX_SOCKETS,
      remaining: Math.max(0, MAX_SOCKETS - count),
      shield: this.effectiveShield(),
    };
  }

  broadcast(obj, except) {
    const raw = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      if (except && ws === except) continue;
      try {
        ws.send(raw);
      } catch {
        /* ignore */
      }
    }
  }

  broadcastChess(game) {
    if (!game?.id) return;
    const ts = Date.now();
    const frame = JSON.stringify({ type: 'chess', id: game.id, version: game.state?.version, ts });
    for (const ws of this.state.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() || {};
        if (!att.xId || !publicChessGame(game, att.xId, ts)) continue;
        ws.send(frame);
      } catch {
        /* one dead socket must not stop the other player being told */
      }
    }
  }

  schedulePresence() {
    if (this.presenceTimer) return;
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = null;
      try {
        this.broadcast(this.presence());
      } catch {
        /* ignore */
      }
    }, 350);
  }

  countIp(ip) {
    let n = 0;
    for (const ws of this.state.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() || {};
        if (att.ip && att.ip === ip) n++;
      } catch {
        /* ignore */
      }
    }
    return n;
  }

  isMuted(nick) {
    const key = nickKey(nick);
    const until = this.mutes.get(key);
    if (!until) return false;
    if (Date.now() >= until) {
      this.mutes.delete(key);
      return false;
    }
    return true;
  }

  tryModCommand(att, text) {
    const secret = this.env.LOBBY_MOD_SECRET;
    if (!secret || typeof text !== 'string') return null;
    // !mod <secret> <cmd> [args...]
    const m = text.trim().match(/^!mod\s+(\S+)\s+(mute|unmute|slow|shield|clear|nuke|pin)\s*(.*)$/i);
    if (!m) return null;
    if (m[1] !== secret) return { ok: false, error: 'mod denied' };
    const cmd = m[2].toLowerCase();
    const rest = (m[3] || '').trim();
    const arg = rest.split(/\s+/)[0] || '';
    if (cmd === 'mute') {
      if (!arg) return { ok: false, error: 'mute needs a nick' };
      this.mutes.set(nickKey(arg), Date.now() + 24 * 60 * 60 * 1000);
      this.stats.mutes++;
      this.persistMutes();
      return { ok: true, system: `muted ${arg} for 24h` };
    }
    if (cmd === 'unmute') {
      if (!arg) return { ok: false, error: 'unmute needs a nick' };
      this.mutes.delete(nickKey(arg));
      this.persistMutes();
      return { ok: true, system: `unmuted ${arg}` };
    }
    if (cmd === 'slow') {
      this.forceSlow = /^(on|1|true)$/i.test(arg);
      this.persistFlags();
      return { ok: true, system: this.forceSlow ? 'slow mode on' : 'slow mode off' };
    }
    if (cmd === 'shield') {
      this.shield = /^(on|1|true)$/i.test(arg);
      if (!this.shield) this.autoShieldUntil = 0;
      this.persistFlags();
      return { ok: true, system: this.shield ? 'shield on · X-linked chat only' : 'shield off' };
    }
    if (cmd === 'clear' || cmd === 'nuke') {
      this.history = [];
      this.persist();
      return { ok: true, system: 'history cleared', clearClients: true };
    }
    if (cmd === 'pin') {
      if (!rest || /^clear$/i.test(rest)) {
        this.customPin = null;
        this.persistFlags();
        return { ok: true, system: 'pin reset to default', pin: PIN };
      }
      const textPin = rest.slice(0, 280);
      this.customPin = { text: textPin, ts: Date.now() };
      this.persistFlags();
      return { ok: true, system: 'pin updated', pin: this.activePin() };
    }
    return null;
  }

  async handleDigest(request) {
    const url = new URL(request.url);
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/digest/pack' || url.pathname === '/digest.json')) {
      const stored = await this.state.storage.get('digest');
      const pack = stored && Array.isArray(stored.items) && stored.items.length
        ? { at: stored.at || new Date().toISOString(), items: normalizeItems(stored.items) }
        : { at: null, items: [] };
      return new Response(request.method === 'HEAD' ? null : JSON.stringify(pack), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120' },
      });
    }
    if (url.pathname === '/digest/ingest' && request.method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch { body = {}; }
      const items = normalizeItems(body?.items);
      if (!items.length) return json({ error: 'empty' }, 400);
      const pack = { at: body.at || new Date().toISOString(), items };
      await this.state.storage.put('digest', pack);
      return json({ ok: true, at: pack.at, n: items.length }, 200);
    }
    return json({ error: 'not found' }, 404);
  }

  /**
   * One Gecko/Dexscreener fetch per TTL for the whole site. Lives on the lobby DO so
   * isolates cannot stampede the free API. Failure never invents a number.
   */
  async handlePrice(request, allowedOrigin) {
    const now = Date.now();
    if (!this.priceCache) this.priceCache = await this.state.storage.get('priceCache') || { at: 0, body: null };
    const dueForRefresh = !this.priceCache.body || now - this.priceCache.at > PRICE_TTL_MS;
    const mayAttempt = now - (this.priceAttemptAt || 0) > PRICE_TTL_MS;
    if (dueForRefresh && mayAttempt) {
      this.priceAttemptAt = now;
      try {
        const base = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${PAIR}`;
        const opts = { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json', 'user-agent': 'dasha-lobby' } };
        const previous = this.priceCache.body;
        let a = null;
        let snapSource = null;
        let snapError = '';
        try {
          const snapRes = await fetch(base, opts);
          if (snapRes.ok) {
            const attrs = (await snapRes.json())?.data?.attributes;
            if (attrs?.base_token_price_usd) {
              a = {
                priceUsd: Number(attrs.base_token_price_usd),
                fdvUsd: Number(attrs.fdv_usd) || null,
                volume24hUsd: Number(attrs.volume_usd?.h24) || null,
                liquidityUsd: Number(attrs.reserve_in_usd) || null,
                change: { h1: Number(attrs.price_change_percentage?.h1), h24: Number(attrs.price_change_percentage?.h24) },
              };
              snapSource = 'geckoterminal';
            }
          } else snapError = `pool ${snapRes.status}`;
        } catch (e) { snapError = `pool ${String(e?.message || e).slice(0, 40)}`; }

        if (!a) {
          const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MINT}`, opts);
          if (!dexRes.ok) throw new Error(`${snapError || 'pool unavailable'}; dex ${dexRes.status}`);
          const pair = ((await dexRes.json())?.pairs || []).find((row) => row?.pairAddress === PAIR);
          if (!pair?.priceUsd) throw new Error(`${snapError || 'pool unavailable'}; dex has no ${PAIR}`);
          a = {
            priceUsd: Number(pair.priceUsd),
            fdvUsd: Number(pair.fdv) || null,
            volume24hUsd: Number(pair.volume?.h24) || null,
            liquidityUsd: Number(pair.liquidity?.usd) || null,
            change: { h1: Number(pair.priceChange?.h1), h24: Number(pair.priceChange?.h24) },
          };
          snapSource = 'dexscreener';
        }
        if (!Number.isFinite(a.priceUsd) || a.priceUsd <= 0) throw new Error('no usable price');

        let series = previous?.series || [];
        if (!series.length || now - (this.seriesAt || 0) > PRICE_SERIES_TTL_MS) {
          try {
            const ohlcvRes = await fetch(`${base}/ohlcv/minute?aggregate=5&limit=288`, opts);
            if (ohlcvRes.ok) {
              const rows = (await ohlcvRes.json())?.data?.attributes?.ohlcv_list;
              if (Array.isArray(rows) && rows.length) {
                series = rows
                  .map((row) => [Number(row[0]), Number(Number(row[4]).toPrecision(6))])
                  .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]) && point[1] > 0)
                  .sort((x, y) => x[0] - y[0]);
                this.seriesAt = now;
              }
            }
          } catch { /* keep previous series */ }
        }
        if (!series.length) throw new Error('no series yet');

        this.priceCache = {
          at: now,
          body: {
            ok: true,
            mint: MINT,
            pair: PAIR,
            priceUsd: a.priceUsd,
            fdvUsd: a.fdvUsd,
            volume24hUsd: a.volume24hUsd,
            liquidityUsd: a.liquidityUsd,
            change: a.change,
            series,
            seriesAsOf: new Date(this.seriesAt || now).toISOString(),
            source: snapSource,
            asOf: new Date(now).toISOString(),
          },
        };
        this.priceError = null;
        await this.state.storage.put('priceCache', this.priceCache);
      } catch (err) {
        this.priceError = String(err?.message || err).slice(0, 120);
        if (!this.priceCache.body || now - this.priceCache.at > PRICE_STALE_MS) {
          return json({ ok: false, error: 'price unavailable', reason: this.priceError }, 503, allowedOrigin || '*');
        }
      }
    }
    if (this.priceCache.body) {
      const age = now - this.priceCache.at;
      this.priceCache.body = age > PRICE_TTL_MS
        ? { ...this.priceCache.body, stale: true, staleForMs: age, reason: this.priceError || null }
        : { ...this.priceCache.body, stale: false, staleForMs: undefined, reason: undefined };
    }
    return json(this.priceCache.body, 200, allowedOrigin || '*', {
      headers: { 'Cache-Control': `public, max-age=${Math.floor(PRICE_TTL_MS / 1000)}` },
    });
  }

  forumKey(id) {
    return `forum:t:${id}`;
  }

  async forumThreadPosts(id) {
    const posts = await this.state.storage.get(this.forumKey(id));
    return Array.isArray(posts) ? posts : null;
  }

  /** Write the index, and delete the post keys the prune orphaned in the same breath. */
  async persistForumIndex(evicted = []) {
    await this.state.storage.put('forum:index', this.forumIndex);
    for (const id of evicted) await this.state.storage.delete(this.forumKey(id));
  }

  async logForumAudit(action, id, by, ts = Date.now()) {
    this.forumAudit.unshift({ action, id, by, ts });
    this.forumAudit = this.forumAudit.slice(0, 100);
    await this.state.storage.put('forum:audit', this.forumAudit);
  }

  /** Ids dropped from the index by a prune, so their posts can go too. */
  forumPrune(next, now) {
    const before = new Set(this.forumIndex.map((t) => t.id));
    this.forumIndex = pruneIndex(next, now);
    const after = new Set(this.forumIndex.map((t) => t.id));
    return [...before].filter((id) => !after.has(id));
  }

  /**
   * Threads and replies. Every rule the chat enforces applies here — validateTitle/validateBody in
   * dasha-forum.mjs delegate to the same validateMessage the socket path uses, so the forum cannot
   * become the door around the automod. Identity comes from the session cookie, never the body.
   */
  async handleForum(request, allowedOrigin) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const cred = { credentials: true };
    const session = await sessionFromRequest(this.env, request);
    const xId = session?.xId ? String(session.xId) : '';
    const handle = session?.handle || '';
    const avatar = session?.avatar || null;
    const now = Date.now();
    const holder = Boolean(xId && Number(this.simpProfiles[xId]?.holderUntil) > now);
    const simpLinks = new Map();
    for (const profile of Object.values(this.simpProfiles)) {
      const current = String(profile?.handle || '').toLowerCase();
      if (!/^[a-z0-9_]{1,15}$/.test(current)) continue;
      simpLinks.set(current, simpLinks.has(current) ? null : `https://www.getdasha.com/simp/u/${current}`);
    }
    const addSimpUrl = row => {
      const simpUrl = simpLinks.get(String(row?.handle || '').toLowerCase());
      return simpUrl ? { ...row, simpUrl } : row;
    };

    if (request.method !== 'GET' && !allowedOrigin) return json({ error: 'origin required' }, 403, null);

    if (path === '/forum/threads' && request.method === 'GET') {
      const evicted = this.forumPrune(this.forumIndex, now);
      if (evicted.length) await this.persistForumIndex(evicted);
      const q = url.searchParams.get('q') || '';
      const list = q ? searchThreads(this.forumIndex, q) : this.forumIndex;
      const page = paginateIndex(list, {
        cursor: url.searchParams.get('cursor') || '',
        limit: url.searchParams.get('limit') || 50,
      });
      return json({ ok: true, threads: page.threads.map(row => addSimpUrl(publicThread(row))), next: page.next }, 200, allowedOrigin, cred);
    }

    if (path === '/forum/reports' && request.method === 'GET') {
      if (!modAllowed(request, this.env)) return json({ error: 'mod denied' }, 403, allowedOrigin, cred);
      return json({ ok: true, reports: this.forumReports, audit: this.forumAudit }, 200, allowedOrigin, cred);
    }

    if (path === '/forum/threads' && request.method === 'POST') {
      if (!xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      const rate = simpRate(this.simpRates, `forum-post:x:${xId}`, 20);
      if (!rate.ok) return json({ error: 'posting too fast', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      const id = `t${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const created = newThread({ title: input?.title, text: input?.text, handle, avatar, holder, now, id });
      if (!created.ok) return json({ error: created.error }, 400, allowedOrigin, cred);
      const evicted = this.forumPrune([created.summary, ...this.forumIndex], now);
      await this.state.storage.put(this.forumKey(id), created.posts);
      await this.persistForumIndex(evicted);
      return json({ ok: true, thread: addSimpUrl(publicThread(created.summary)) }, 200, allowedOrigin, cred);
    }

    const threadMatch = path.match(/^\/forum\/thread\/([A-Za-z0-9_-]{1,40})$/);
    if (threadMatch) {
      const id = threadMatch[1];
      const summary = this.forumIndex.find((t) => t.id === id);
      const posts = summary ? await this.forumThreadPosts(id) : null;
      if (!summary || !posts) return json({ error: 'thread not found' }, 404, allowedOrigin, cred);

      if (request.method === 'GET') {
        return json({ ok: true, thread: addSimpUrl(publicThread(summary)), posts: posts.map(row => addSimpUrl(publicPost(row, xId))) }, 200, allowedOrigin, cred);
      }
      if (request.method === 'POST') {
        if (!xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
        const writable = assertWritable(summary);
        if (!writable.ok) return json({ error: writable.error }, 403, allowedOrigin, cred);
        const rate = simpRate(this.simpRates, `forum-post:x:${xId}`, 20);
        if (!rate.ok) return json({ error: 'posting too fast', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
        const input = await requestJson(request);
        const replied = addReply(posts, { text: input?.text, handle, avatar, holder, now, id: `${id}-${posts.length}` });
        if (!replied.ok) return json({ error: replied.error }, 400, allowedOrigin, cred);
        posts.push(replied.post);
        summary.replies = visibleReplies(posts);
        summary.lastTs = now;
        /* Posts first: if the index write fails the thread still has the reply, which is recoverable.
           The other order can acknowledge a post that was never stored. */
        await this.state.storage.put(this.forumKey(id), posts);
        const evicted = this.forumPrune(this.forumIndex, now);
        await this.persistForumIndex(evicted);
        return json({ ok: true, post: addSimpUrl(publicPost(replied.post)) }, 200, allowedOrigin, cred);
      }
    }

    const reactionMatch = path.match(/^\/forum\/thread\/([A-Za-z0-9_-]{1,40})\/post\/([A-Za-z0-9_-]{1,48})\/react$/);
    if (reactionMatch && request.method === 'POST') {
      if (!xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      const id = reactionMatch[1];
      const summary = this.forumIndex.find((t) => t.id === id);
      const posts = summary ? await this.forumThreadPosts(id) : null;
      if (!summary || !posts) return json({ error: 'thread not found' }, 404, allowedOrigin, cred);
      const rate = simpRate(this.simpRates, `forum-react:x:${xId}`, 30);
      if (!rate.ok) return json({ error: 'reacting too fast', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
      const input = await requestJson(request);
      const reacted = toggleReaction(posts, { id: reactionMatch[2], xId, active: input?.active !== false });
      if (!reacted.ok) return json({ error: reacted.error }, 400, allowedOrigin, cred);
      await this.state.storage.put(this.forumKey(id), reacted.posts);
      summary.reactions = threadReactionCount(reacted.posts);
      await this.persistForumIndex([]);
      return json({ ok: true, reactionCount: reacted.reactionCount, reacted: reacted.reacted, points: 0 }, 200, allowedOrigin, cred);
    }

    const postMatch = path.match(/^\/forum\/thread\/([A-Za-z0-9_-]{1,40})\/post\/([A-Za-z0-9_-]{1,48})$/);
    if (postMatch) {
      const id = postMatch[1];
      const postId = postMatch[2];
      const summary = this.forumIndex.find((t) => t.id === id);
      const posts = summary ? await this.forumThreadPosts(id) : null;
      if (!summary || !posts) return json({ error: 'thread not found' }, 404, allowedOrigin, cred);
      if (!xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      if (request.method === 'PATCH') {
        const writable = assertWritable(summary);
        if (!writable.ok) return json({ error: writable.error }, 403, allowedOrigin, cred);
        const rate = simpRate(this.simpRates, `forum-post:x:${xId}`, 20);
        if (!rate.ok) return json({ error: 'posting too fast', waitMs: rate.waitMs }, 429, allowedOrigin, cred);
        const input = await requestJson(request);
        const edited = editPost(posts, { id: postId, text: input?.text, handle, now });
        if (!edited.ok) return json({ error: edited.error }, 400, allowedOrigin, cred);
        await this.state.storage.put(this.forumKey(id), edited.posts);
        return json({ ok: true, post: addSimpUrl(publicPost(edited.post)) }, 200, allowedOrigin, cred);
      }
      if (request.method === 'DELETE') {
        const removed = deletePost(posts, { id: postId, handle });
        if (!removed.ok) return json({ error: removed.error }, 400, allowedOrigin, cred);
        await this.state.storage.put(this.forumKey(id), removed.posts);
        summary.replies = visibleReplies(removed.posts);
        summary.reactions = threadReactionCount(removed.posts);
        await this.persistForumIndex([]);
        return json({ ok: true, post: addSimpUrl(publicPost(removed.post)) }, 200, allowedOrigin, cred);
      }
    }

    const lockMatch = path.match(/^\/forum\/thread\/([A-Za-z0-9_-]{1,40})\/lock$/);
    if (lockMatch && request.method === 'POST') {
      if (!modAllowed(request, this.env)) return json({ error: 'mod denied' }, 403, allowedOrigin, cred);
      const id = lockMatch[1];
      const summary = this.forumIndex.find((t) => t.id === id);
      const input = await requestJson(request);
      const locked = lockThread(summary, { locked: input?.locked !== false });
      if (!locked.ok) return json({ error: locked.error }, 404, allowedOrigin, cred);
      Object.assign(summary, locked.summary);
      await this.persistForumIndex([]);
      await this.logForumAudit(locked.summary.locked ? 'lock' : 'unlock', id, session?.handle || 'operator', now);
      return json({ ok: true, thread: addSimpUrl(publicThread(summary)) }, 200, allowedOrigin, cred);
    }

    const reportMatch = path.match(/^\/forum\/thread\/([A-Za-z0-9_-]{1,40})\/report$/);
    if (reportMatch && request.method === 'POST') {
      if (!xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      const id = reportMatch[1];
      const summary = this.forumIndex.find((t) => t.id === id);
      if (!summary) return json({ error: 'thread not found' }, 404, allowedOrigin, cred);
      const input = await requestJson(request);
      const reason = validateReport(input?.reason);
      if (!reason.ok) return json({ error: reason.error }, 400, allowedOrigin, cred);
      const postId = String(input?.postId || '').slice(0, 48);
      const reports = Array.isArray(this.forumReports) ? this.forumReports : [];
      reports.unshift({ id, postId, reason: reason.reason, by: handle, ts: now });
      this.forumReports = reports.slice(0, 100);
      await this.state.storage.put('forum:reports', this.forumReports);
      return json({ ok: true }, 200, allowedOrigin, cred);
    }

    return json({ error: 'not found' }, 404, allowedOrigin, cred);
  }

  rejectWs(code, reason) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    server.close(code, reason.slice(0, 120));
    return new Response(null, { status: 101, webSocket: client });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (isComputeApiPath(url.pathname)) {
      const origin = request.headers.get('Origin');
      const allowedOrigin = origin && originAllowed(origin, this.env.ALLOWED_ORIGINS || '') ? origin : null;
      return this.compute.fetch(request, allowedOrigin);
    }
    if (url.pathname.startsWith('/crew/api/')) {
      const response = await crewApi(request, this.env);
      if (response) return response;
    }
    if (request.method === 'GET' && (url.pathname === '/capacity' || url.searchParams.get('capacity') === '1')) {
      return json(this.capacity(), 200, null);
    }
    if (request.method === 'GET' && url.pathname === '/stats') {
      return json(this.roomStats(), 200, null);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/price') {
      const origin = request.headers.get('Origin');
      return this.handlePrice(request, origin && originAllowed(origin, this.env.ALLOWED_ORIGINS || '') ? origin : null);
    }

    if (url.pathname === '/digest/pack' || url.pathname === '/digest/ingest' || url.pathname === '/digest.json') {
      return this.handleDigest(request);
    }


    if (
      url.pathname.startsWith('/simp/') ||
      url.pathname.startsWith('/auth/wallet/') ||
      url.pathname.startsWith('/auth/grok/') ||
      url.pathname.startsWith('/studio/') ||
      url.pathname.startsWith('/chess/') ||
      url.pathname.startsWith('/forum/') ||
      url.pathname.startsWith('/h/')
    ) {
      // Origin already checked by worker entry; pass through for CORS on stub responses.
      const origin = request.headers.get('Origin');
      const allowedOrigin =
        origin && originAllowed(origin, this.env.ALLOWED_ORIGINS || '')
          ? origin
          : this.env.ALLOW_ANY_ORIGIN
            ? origin || '*'
            : null;
      if (url.pathname.startsWith('/chess/')) return this.handleChess(request, allowedOrigin);
      if (url.pathname.startsWith('/forum/')) return this.handleForum(request, allowedOrigin);
      return this.handleSimp(request, allowedOrigin);
    }

    const upgrade = request.headers.get('Upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426, headers: SECURITY });
    }

    const origin = request.headers.get('Origin');
    const allowed = this.env.ALLOWED_ORIGINS || '';
    if (origin && !originAllowed(origin, allowed) && !this.env.ALLOW_ANY_ORIGIN) {
      return new Response('origin not allowed', { status: 403, headers: SECURITY });
    }

    const link = await sessionFromRequest(this.env, request);
    const holder = Boolean(link?.xId && Number(this.simpProfiles[String(link.xId)]?.holderUntil) > Date.now());
    const limits = linkedLimits(Boolean(link), holder);
    const count = this.liveCount();
    const seat = mayJoinRoom({ count, maxSockets: MAX_SOCKETS, linked: Boolean(link) });
    if (!seat.ok) {
      this.stats.rejectsFull++;
      const reason =
        seat.reason === 'lobby full'
          ? `lobby full ${count}/${MAX_SOCKETS}`
          : `lobby busy ${count}/${MAX_SOCKETS} · link X for reserved seats`;
      return this.rejectWs(4001, reason);
    }

    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
    if (this.countIp(ip) >= MAX_PER_IP) {
      this.stats.rejectsIp++;
      return this.rejectWs(4002, 'too many connections from this network');
    }
    let ipState = this.ipJoins.get(ip);
    if (!ipState) {
      ipState = { times: [] };
      this.ipJoins.set(ip, ipState);
    }
    const ipOk = checkIpJoin(ipState);
    if (!ipOk.ok) {
      this.stats.rejectsIp++;
      return this.rejectWs(4002, ipOk.error || 'join rate limited');
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    this.stats.joins++;
    const now = Date.now();
    server.serializeAttachment({
      id: id(),
      nick: null,
      joined: now,
      lastActive: now,
      linked: Boolean(link),
      handle: link?.handle || null,
      xId: link?.xId || null,
      avatar: link?.avatar || null,
      ip,
    });

    send(server, {
      type: 'ready',
      pin: this.activePin(),
      mint: MINT,
      you: null,
      max: MAX_SOCKETS,
      softCapAnon: ANON_SOFT_CAP,
      slowAt: SLOW_MODE_AT,
      joinCooldownMs: JOIN_COOLDOWN_MS,
      remaining: Math.max(0, MAX_SOCKETS - this.liveCount()),
      x: publicLink(link),
      perks: link
        ? {
            linked: true,
            longerMessages: true,
            fasterRate: true,
            reservedSeats: true,
            badge: true,
            holder,
            maxText: limits.maxText,
          }
        : { linked: false, holder: false, maxText: limits.maxText },
    });
    send(server, this.presence());
    // Quiet joins — no system spam; debounced presence only.
    this.schedulePresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (raw.length > 1024) {
      send(ws, { type: 'error', error: 'frame too large' });
      return;
    }

    const att = ws.deserializeAttachment() || { id: id(), nick: null };
    const linked = Boolean(att.linked && att.handle);
    const holder = Boolean(linked && Number(this.simpProfiles[String(att.xId)]?.holderUntil) > Date.now());
    const limits = linkedLimits(linked, holder);
    this.touch(ws, att);

    const parsed = parseClientFrame(raw, {
      maxText: limits.maxText,
      linked,
      forceNick: linked ? `@${att.handle}` : null,
    });
    if (!parsed.ok) {
      if (/automod|blocked|duplicate/i.test(parsed.error || '')) this.maybeAutoShield();
      send(ws, { type: 'error', error: parsed.error });
      return;
    }

    if (parsed.type === 'ping') {
      send(ws, { type: 'pong', t: Date.now() });
      return;
    }

    if (parsed.type === 'hello') {
      this.syncNicksFromSockets();
      if (nickTaken(this.nicks, parsed.nick, att.id)) {
        send(ws, { type: 'error', error: 'nick taken' });
        return;
      }
      att.nick = parsed.nick;
      this.touch(ws, att);
      this.nicks.set(att.id, parsed.nick);
      this.history = pruneHistory(this.history);
      const joinedAt = Number(att.joined) || Date.now();
      const coolLeft = Math.max(0, JOIN_COOLDOWN_MS - (Date.now() - joinedAt));
      send(ws, {
        type: 'hello_ok',
        pin: this.activePin(),
        history: this.history,
        you: parsed.nick,
        mint: MINT,
        presence: this.presence(),
        joinCooldownMs: JOIN_COOLDOWN_MS,
        joinCooldownRemainingMs: coolLeft,
        x: linked
          ? publicLink({ handle: att.handle, avatar: att.avatar, verifiedType: null })
          : null,
        perks: linked
          ? { linked: true, longerMessages: true, fasterRate: true, reservedSeats: true, badge: true, holder, maxText: limits.maxText }
          : { linked: false, holder: false, maxText: limits.maxText },
      });
      // Quiet: no "joined" spam (Twitch-style less noise).
      this.schedulePresence();
      return;
    }

    if (parsed.type === 'chat') {
      if (!att.nick) {
        send(ws, { type: 'error', error: 'send hello with nick first' });
        return;
      }

      const mod = this.tryModCommand(att, parsed.text);
      if (mod) {
        if (!mod.ok) {
          send(ws, { type: 'error', error: mod.error });
          return;
        }
        if (mod.clearClients) {
          this.broadcast({ type: 'history_clear', ts: Date.now() });
        }
        if (mod.pin) {
          this.broadcast({ type: 'pin', pin: mod.pin, ts: Date.now() });
        }
        this.broadcast({ type: 'system', text: mod.system, ts: Date.now() });
        this.schedulePresence();
        return;
      }

      if (this.effectiveShield() && !linked) {
        send(ws, { type: 'error', error: 'shield on · link X to chat' });
        return;
      }
      if (this.isMuted(att.nick) || (att.handle && this.isMuted('@' + att.handle))) {
        send(ws, { type: 'error', error: 'you are muted' });
        return;
      }

      const joinedAt = Number(att.joined) || 0;
      if (joinedAt && Date.now() - joinedAt < JOIN_COOLDOWN_MS) {
        const waitMs = JOIN_COOLDOWN_MS - (Date.now() - joinedAt);
        send(ws, {
          type: 'error',
          error: 'join cooldown · wait a few seconds (anti-raid)',
          waitMs,
        });
        return;
      }

      let rate = this.rates.get(att.id);
      if (!rate) {
        rate = { lastMs: 0, times: [], lastText: '', lastTextMs: 0 };
        this.rates.set(att.id, rate);
      }
      const effective = roomSlowLimits(this.liveCount(), {
        rateMs: this.forceSlow ? Math.max(limits.rateMs, 5000) : limits.rateMs,
        maxPerMin: limits.maxPerMin,
      });
      const allowed = checkRate(rate, Date.now(), {
        rateMs: effective.rateMs,
        maxPerMin: effective.maxPerMin,
      });
      if (!allowed.ok) {
        this.maybeAutoShield();
        send(ws, {
          type: 'error',
          error: effective.slow || this.forceSlow ? 'slow mode · ' + allowed.error : allowed.error,
          waitMs: allowed.waitMs,
        });
        return;
      }
      const rep = checkRepeat(rate, parsed.text);
      if (!rep.ok) {
        this.maybeAutoShield();
        send(ws, { type: 'error', error: rep.error, waitMs: rep.waitMs });
        return;
      }
      const msg = publicMessage({
        id: id(),
        nick: att.nick,
        text: parsed.text,
        ts: Date.now(),
        linked,
        holder,
        handle: att.handle || undefined,
        avatar: att.avatar || undefined,
      });
      this.stats.chats++;
      this.history = pruneHistory([...this.history, msg]);
      await this.persist();
      this.broadcast(msg);
    }
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {};
    if (att.id) {
      this.rates.delete(att.id);
      this.nicks.delete(att.id);
    }
    this.schedulePresence();
  }

  async webSocketError(ws) {
    try {
      ws.close(1011, 'error');
    } catch {
      /* ignore */
    }
  }
}

async function handleOAuth(request, env, allowedOrigin) {
  const url = new URL(request.url);

  if (url.pathname === '/oauth/x/status') {
    const link = await sessionFromRequest(env, request);
    return json(
      {
        configured: xConfigured(env),
        linked: Boolean(link),
        x: publicLink(link),
        perks: {
          longerMessages: '280 chars (vs 200)',
          fasterRate: 'faster send rate',
          reservedSeats: `priority seats when room > ${ANON_SOFT_CAP}`,
          badge: '@handle badge in chat',
        },
      },
      200,
      allowedOrigin,
      { credentials: true },
    );
  }

  if (url.pathname === '/oauth/x/logout') {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, { credentials: true });
    if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
    const headers = new Headers({
        ...SECURITY,
        ...corsHeaders(allowedOrigin, { credentials: true }),
        'Content-Type': 'application/json; charset=utf-8',
    });
    headers.append('Set-Cookie', cookieHeader('', { clear: true }));
    headers.append('Set-Cookie', clearLegacyCookieHeader());
    return new Response(JSON.stringify({ ok: true, linked: false }), { status: 200, headers });
  }

  if (url.pathname === '/oauth/x/start' && (request.method === 'GET' || request.method === 'HEAD')) {
    if (!xConfigured(env)) {
      return oauthHtmlResponse(
        htmlPage(
          'X link unavailable',
          '<h1>X link not configured</h1><p>Dasha still works where identity is optional. An operator needs to set <code>X_CLIENT_ID</code>, <code>X_CLIENT_SECRET</code>, and <code>LOBBY_SESSION_SECRET</code> on the worker.</p><p><a href="https://www.getdasha.com/">Back to Dasha</a></p>',
        ),
        503,
      );
    }
    if (request.method === 'HEAD') return oauthHtmlResponse('', 200, { head: true });
    if (url.searchParams.get('continue') !== '1') {
      return oauthHtmlResponse(
        htmlPage('Connect X', '<h1>Connect X</h1><p>Dasha reads your public X identity across the site. It does not post for you.</p><p><a href="/privacy">Privacy</a></p><p><a href="/oauth/x/start?continue=1">Continue with X</a></p>'),
        200,
      );
    }
    const verifier = randomUrlToken(32);
    const challenge = await pkceChallengeS256(verifier);
    const state = randomUrlToken(16);
    const stateToken = await signPayload(env.LOBBY_SESSION_SECRET, {
      v: 1,
      kind: 'oauth_state',
      state,
      verifier,
      exp: Date.now() + 15 * 60_000,
    });
    const dest = authorizeUrl({
      clientId: env.X_CLIENT_ID,
      redirectUri: redirectUri(env),
      state,
      challenge,
    });
    return new Response(null, {
      status: 302,
      headers: {
        ...SECURITY,
        Location: dest,
        'Set-Cookie': oauthStateCookie(stateToken),
      },
    });
  }

  if (url.pathname === '/oauth/x/callback' && request.method === 'GET') {
    if (!xConfigured(env)) {
      return oauthHtmlResponse(htmlPage('Error', '<p>OAuth not configured.</p>'), 503);
    }
    const err = url.searchParams.get('error');
    if (err) {
      return oauthHtmlResponse(
        htmlPage('Cancelled', `<h1>Link cancelled</h1><p>${escapeHtml(err)}</p><p><a href="https://www.getdasha.com/">Back to Dasha</a></p>`),
        400,
      );
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthCookie = (() => {
      const raw = request.headers.get('Cookie') || '';
      return readCookie(raw, OAUTH_COOKIE);
    })();
    const st = oauthCookie ? await verifyPayload(env.LOBBY_SESSION_SECRET, oauthCookie) : null;
    if (!code || !state || !st || st.kind !== 'oauth_state' || st.state !== state || !st.verifier) {
      return oauthHtmlResponse(htmlPage('Error', '<h1>Invalid OAuth state</h1><p><a href="/oauth/x/start">Try again</a></p>'), 400);
    }
    try {
      const tokens = await exchangeCode(env, { code, verifier: st.verifier });
      const user = await fetchXUser(tokens.access_token);
      if (!user.handle) throw new Error('missing handle');
      const session = await createSessionToken(env, user);
      const safeHandle = escapeHtml(user.handle);
      const scriptHandle = JSON.stringify(user.handle).replace(/</g, '\\u003c');
      const scriptNonce = randomUrlToken(18);
      const body = htmlPage(
        'Linked',
        `<h1>Linked @${safeHandle}</h1>
        <p>You can close this tab and return to Dasha.</p>
        <p><a href="https://www.getdasha.com/">Open Dasha</a></p>
        <script nonce="${scriptNonce}">try{if(window.opener){var h=${scriptHandle};['https://www.getdasha.com','https://getdasha.com','https://lobby.getdasha.com'].forEach(function(o){try{window.opener.postMessage({type:'dasha-x-linked',handle:h},o);}catch(e){}});}}catch(e){} setTimeout(function(){window.close()},800);</script>`,
      );
      const headers = new Headers(privateHtmlHeaders({
        'Content-Type': 'text/html; charset=utf-8',
      }, scriptNonce));
      headers.append('Set-Cookie', cookieHeader(session));
      headers.append('Set-Cookie', clearLegacyCookieHeader());
      headers.append('Set-Cookie', oauthStateCookie());
      return new Response(body, { status: 200, headers });
    } catch (e) {
      return oauthHtmlResponse(
        htmlPage('Error', `<h1>Could not link X</h1><p>${escapeHtml(String(e.message || e).slice(0, 200))}</p><p><a href="/oauth/x/start">Try again</a></p>`),
        502,
      );
    }
  }

  return null;
}

async function handleGithubOAuth(request, env, allowedOrigin) {
  const url = new URL(request.url);
  const configured = githubConfigured(env);

  if (url.pathname === '/oauth/github/status') {
    const link = configured ? await githubSessionFromRequest(env, request) : null;
    return json({
      configured,
      linked: Boolean(link),
      github: publicGithubLink(link),
      ...(configured ? {} : { error: 'not_configured' }),
    }, 200, allowedOrigin, { credentials: true });
  }

  if (url.pathname === '/oauth/github/logout') {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, { credentials: true });
    if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
    const headers = new Headers({
      ...SECURITY,
      ...corsHeaders(allowedOrigin, { credentials: true }),
      'Content-Type': 'application/json; charset=utf-8',
    });
    headers.append('Set-Cookie', githubCookieHeader('', { clear: true }));
    headers.append('Set-Cookie', githubOauthStateCookie());
    return new Response(JSON.stringify({ ok: true, linked: false }), { status: 200, headers });
  }

  if (url.pathname === '/oauth/github/start' && (request.method === 'GET' || request.method === 'HEAD')) {
    if (!configured) {
      const body = htmlPage('GitHub linking is not on yet', '<h1>GitHub linking is not on yet</h1><p>You can still read the board and contribute without linking an account.</p><p><a class="cta" href="https://www.getdasha.com/contribute">Pick a first issue</a></p><p><a href="https://www.getdasha.com/bounties">Back to bounties</a></p>');
      return githubOauthHtmlResponse(body, 200, { head: request.method === 'HEAD' });
    }
    if (request.method === 'HEAD') return githubOauthHtmlResponse('', 200, { head: true });
    const verifier = randomUrlToken(32);
    const challenge = await pkceChallengeS256(verifier);
    const state = randomUrlToken(16);
    const stateToken = await signPayload(env.LOBBY_SESSION_SECRET, {
      v: 1,
      kind: 'github_oauth_state',
      state,
      verifier,
      exp: Date.now() + 15 * 60_000,
    });
    return new Response(null, {
      status: 302,
      headers: {
        ...SECURITY,
        Location: githubAuthorizeUrl({
          clientId: env.GITHUB_CLIENT_ID,
          redirectUri: githubRedirectUri(env),
          state,
          challenge,
        }),
        'Set-Cookie': githubOauthStateCookie(stateToken),
      },
    });
  }

  if (url.pathname === '/oauth/github/callback' && request.method === 'GET') {
    if (!configured) return githubOauthHtmlResponse(htmlPage('Error', '<h1>GitHub linking is not configured</h1>'), 503);
    const providerError = url.searchParams.get('error');
    if (providerError) {
      return githubOauthHtmlResponse(
        htmlPage('Cancelled', `<h1>Link cancelled</h1><p>${escapeHtml(providerError)}</p><p><a href="https://www.getdasha.com/bounties">Back to bounties</a></p>`),
        400,
      );
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthCookie = readCookie(request.headers.get('Cookie') || '', GH_OAUTH_COOKIE);
    const st = oauthCookie ? await verifyPayload(env.LOBBY_SESSION_SECRET, oauthCookie) : null;
    if (!code || !state || st?.v !== 1 || st?.kind !== 'github_oauth_state' || st.state !== state || !st.verifier) {
      return githubOauthHtmlResponse(htmlPage('Error', '<h1>Invalid GitHub OAuth state</h1><p><a href="/oauth/github/start">Try again</a></p>'), 400);
    }
    try {
      const tokens = await exchangeGithubCode(env, { code, verifier: st.verifier });
      const user = await fetchGithubUser(tokens.access_token);
      const session = await createGithubSessionToken(env, user);
      const profile = publicGithubLink(user);
      const safeLogin = escapeHtml(user.login);
      const scriptProfile = JSON.stringify(profile).replace(/</g, '\\u003c');
      const scriptNonce = randomUrlToken(18);
      const body = htmlPage('GitHub linked', `<h1>Linked ${safeLogin}</h1>
        <p>You can close this tab and return to Dasha.</p>
        <p><a href="https://www.getdasha.com/bounties">Open bounties</a></p>
        <script nonce="${scriptNonce}">try{if(window.opener){var p=${scriptProfile};['https://www.getdasha.com','https://getdasha.com','https://lobby.getdasha.com'].forEach(function(o){try{window.opener.postMessage({type:'dasha-github-linked',github:p},o);}catch(e){}});}}catch(e){} setTimeout(function(){window.close()},800);</script>`);
      const headers = new Headers(privateHtmlHeaders({ 'Content-Type': 'text/html; charset=utf-8' }, scriptNonce));
      headers.append('Set-Cookie', githubCookieHeader(session));
      headers.append('Set-Cookie', githubOauthStateCookie());
      return new Response(body, { status: 200, headers });
    } catch (error) {
      return githubOauthHtmlResponse(
        htmlPage('Error', `<h1>Could not link GitHub</h1><p>${escapeHtml(String(error?.message || error).slice(0, 200))}</p><p><a href="/oauth/github/start">Try again</a></p>`),
        502,
      );
    }
  }

  return json({ configured, error: configured ? 'not_found' : 'not_configured' }, configured ? 404 : 501, allowedOrigin, { credentials: true });
}

const BOUNTIES_FEED_SCHEMA = 'dasha-bounties-feed/v1';
const BOUNTIES_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BOUNTIES_FEED_SOURCES = [
  'https://uuriko.github.io/dasha-desk/bounties.json',
  'https://raw.githubusercontent.com/Uuriko/dasha-desk/main/bounties.json',
];

export function normalizeBountiesFeed(raw) {
  const listings = Array.isArray(raw?.listings)
    ? raw.listings
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        ...row,
        name: typeof row.name === 'string' ? row.name.trim() : '',
        repo: typeof row.repo === 'string' ? row.repo.trim() : '',
        itemUrl: typeof row.itemUrl === 'string' ? row.itemUrl.trim() : row.itemUrl,
        payTo: typeof row.payTo === 'string' ? row.payTo.trim() : '',
      }))
      .filter((row) => row.name
        && row.repo === 'Uuriko/dasha-desk'
        && Number.isFinite(row.amount) && row.amount > 0
        && row.currency === 'USDC'
        && row.chain === 'solana'
        && row.tokenMint === BOUNTIES_USDC_MINT
        && row.payoutStatus !== 'not_implemented'
        && isValidSolanaAddress(row.payTo)
        && row.payTo !== '11111111111111111111111111111111'
        && (row.kind === 'project'
          ? row.itemUrl == null || row.itemUrl === ''
          : row.kind === 'item' && /^https:\/\/github\.com\/Uuriko\/dasha-desk\/(?:issues|pull)\/[1-9]\d*$/.test(row.itemUrl)))
    : [];
  return {
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : 'dasha bounties',
    schema: BOUNTIES_FEED_SCHEMA,
    note: "USDC on Solana. We don't hold it.",
    url: typeof raw?.url === 'string' && raw.url.trim() ? raw.url.trim() : 'https://www.getdasha.com/bounties',
    listings,
  };
}

/** Leftover /bounties X-connect: live page injected x-connect.js only. Site-hunt needs oauth/x or id=bb-x / #bb-x. GitHub required + X optional. */
export function bountiesHtml(feed) {
  const listings = normalizeBountiesFeed(feed).listings;
  const rows = listings.map((row) => {
    const title = escapeHtml(row.name);
    const name = row.itemUrl
      ? `<a href="${escapeHtml(row.itemUrl)}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`
      : title;
    const pay = `solana:${row.payTo}?amount=${encodeURIComponent(String(row.amount))}&amp;spl-token=${BOUNTIES_USDC_MINT}&amp;label=${encodeURIComponent(row.name)}`;
    return `<article><h2>${name}</h2><p><strong>${escapeHtml(row.amount)} USDC</strong> · ${escapeHtml(row.repo)}</p><p><a class="cta" href="${pay}">Pay ${escapeHtml(row.amount)} USDC</a></p></article>`;
  }).join('');
  const inventory = rows || '<p>No funded bounties right now.</p>';
  return htmlPage('Bounties — $dasha', `<h1>Bounties</h1>
<p>USDC on Solana. We don’t hold it.</p>
<p><a href="https://github.com/Uuriko/dasha-desk/contribute" target="_blank" rel="noopener noreferrer">Pick a good first issue ↗</a> · <a id="bb-x" href="/oauth/x/start?continue=1">Connect X</a></p>
<section id="bb-app" aria-label="Funded bounties">${inventory}</section>
<p><a href="https://www.getdasha.com/">Home</a> · <a href="https://www.getdasha.com/how-to-buy">How to buy</a> · <a href="https://www.getdasha.com/privacy">Privacy</a></p>`, { path: '/bounties', description: 'USDC on Solana. We don’t hold it.' });
}

async function loadBountiesFeed() {
  for (const url of BOUNTIES_FEED_SOURCES) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
      const raw = response.ok ? await response.json() : null;
      if (raw && (raw.schema === BOUNTIES_FEED_SCHEMA || Array.isArray(raw.listings))) return normalizeBountiesFeed(raw);
    } catch { /* try the next trusted mirror */ }
  }
  return normalizeBountiesFeed(null);
}

async function bountiesFeedResponse(request) {
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(await loadBountiesFeed()), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Dasha-Edge': 'bounties-feed',
    },
  });
}

async function bountiesPageResponse(request) {
  return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(stripBountiesLeftoverCodeCss(stripBountiesDroppedCtaCss(injectXConnectPrompt(bountiesHtml(await loadBountiesFeed()))))), {
    status: 200,
    headers: htmlLlmsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Dasha-Edge': 'bounties',
    }),
  });
}

function isProductHost(host) {
  const h = String(host || '').toLowerCase();
  return h === 'www.getdasha.com' || h === 'getdasha.com';
}

const RETIRED_COMMERCE_PATHS = new Set(['/checkout', '/paypal-checkout', '/order-confirmation']);
/** SEO traps + retired funnels — /faucet is a real product tip page (not in this set). */
const RETIRED_SEO_PATHS = new Set([
  '/rally',
  '/rally/',
  '/airdrop',
  '/airdrop/',
  '/earn',
  '/earn/',
  '/claim',
  '/claim/',
]);

const isRetiredStudioPath = (path) =>
  path === '/studio' || path === '/studio/' || path.startsWith('/studio/') ||
  path === '/studio.webmanifest' || path === '/client/studio.js' ||
  /^\/client\/dasha-icon-(?:192|512)\.png$/.test(path);

function retiredStudioResponse(request) {
  return new Response(request.method === 'GET' ? stripNotFoundDroppedCtaCss(NOT_FOUND_HTML) : null, {
    status: 404,
    headers: htmlHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Dasha-Edge': 'retired-studio',
    }),
  });
}

/** Product hosts (www/apex) only serve SEO/howto; everything else goes to Webflow origin. */
async function publicSimpMember(env, handle) {
  const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
  if (!stub) throw new Error('missing lobby');
  const response = await stub.fetch(new Request(`https://lobby.getdasha.com/simp/member/${encodeURIComponent(handle)}`));
  if (!response.ok) throw new Error('member not found');
  const member = (await response.json())?.member;
  if (!member) throw new Error('member not found');
  return member;
}

async function publicSimpMembers(env) {
  const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
  if (!stub) throw new Error('missing lobby');
  const response = await stub.fetch(new Request('https://lobby.getdasha.com/simp/board'));
  if (!response.ok) throw new Error('board unavailable');
  const measured = (await response.json())?.measured;
  if (!Array.isArray(measured)) throw new Error('board unavailable');
  return measured;
}

async function publicForumThread(env, id) {
  const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
  if (!stub) throw new Error('missing lobby');
  const response = await stub.fetch(new Request(`https://lobby.getdasha.com/forum/thread/${encodeURIComponent(id)}`));
  if (!response.ok) throw new Error('thread not found');
  const data = await response.json();
  if (!data?.thread || !Array.isArray(data.posts) || !data.posts.length) throw new Error('thread not found');
  return data;
}

async function publicForumThreads(env) {
  const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
  if (!stub) throw new Error('missing lobby');
  const response = await stub.fetch(new Request('https://lobby.getdasha.com/forum/threads?limit=50'));
  if (!response.ok) throw new Error('forum unavailable');
  const data = await response.json();
  if (!Array.isArray(data?.threads)) throw new Error('forum unavailable');
  return data.threads;
}

export function applyDigestTape(html, items) {
  const rows = normalizeItems(items);
  if (!rows.length) return String(html || '');
  const src = String(html || '');
  const section = digestSectionHtml(rows, { pageHref: '/digest' });
  if (!section) return src;
  let out = src;
  if (/id=["']dasha-digest["']/.test(src)) {
    out = src.replace(/<section id="dasha-digest">[\s\S]*?<\/section>/, () => section);
  } else {
    out = injectDigestSection(src, rows, { pageHref: '/digest' });
  }
  /* Leftover remount on /lobby after boot is home-only. Home remount + /digest.json stay. #dasha-forum / #forum-play-go stay. */
  return injectDigestRemount(out);
}

async function publicDigest(env, fetcher = fetch) {
  let pack = DEFAULT_DIGEST;
  try {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (stub) {
      const response = await stub.fetch(new Request('https://lobby.getdasha.com/digest/pack'));
      if (response.ok) {
        const data = await response.json();
        const items = normalizeItems(data?.items);
        if (items.length) {
          const storedAt = Date.parse(data.at || '') || 0;
          const seedAt = Date.parse(DEFAULT_DIGEST.at || '') || 0;
          if (seedAt <= storedAt) pack = { at: data.at || new Date().toISOString(), items };
        }
      }
    }
  } catch {
    pack = DEFAULT_DIGEST;
  }
  try {
    const tick = await fetchLiveTick(fetcher);
    return applyLiveTick(pack, tick);
  } catch {
    return applyLiveTick(pack, null);
  }
}

function digestJsonResponse(request, pack, edge = 'digest-json') {
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({ at: pack.at, items: pack.items, tick: pack.tick || null }), {
    status: 200,
    headers: {
      ...SECURITY,
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Cache-Control': 'public, max-age=120',
      'X-Dasha-Edge': edge,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** Quiet tape JSON at /forum/tape and /lobby/tape. Same pack as /digest.json. Keeps /forum 308 intact. Empty #dasha-mint-tape mount is leftover and stripped. */
export function isQuietTapePath(path) {
  const p = String(path || '').replace(/\/$/, '') || '/';
  return p === '/forum/tape' || p === '/lobby/tape';
}

/** Worker-owned site manifest — no Desk / Studio / chess chrome destinations. */
export const SITE_MANIFEST = {
  name: '$dasha',
  short_name: '$dasha',
  description: HOME_OG_DESC,
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#070608',
  theme_color: '#070608',
  lang: 'en',
  categories: ['entertainment', 'social'],
  icons: [
    {
      src: 'https://lobby.getdasha.com/og/dasha-social-card.png',
      sizes: '1200x630',
      type: 'image/png',
      purpose: 'any',
    },
  ],
};

export function siteManifestJson() {
  return JSON.stringify(SITE_MANIFEST);
}

export function manifestJsonResponse(request) {
  return new Response(request.method === 'HEAD' ? null : siteManifestJson(), {
    status: 200,
    headers: {
      ...SECURITY,
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Dasha-Edge': 'site-manifest',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function digestPageResponse(request, pack) {
  /* Leftover /digest duplicate #dasha-digest section <style> after PAGE_CSS already serializes SECTION_CSS + flush reset. Home/lobby inner <style> stay. Home remount + /digest.json stay. */
  const page = stripDigestLeftoverDupSectionCss(digestPageHtml(pack.items, { tick: pack.tick }));
  return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(page), {
    status: 200,
    headers: htmlLlmsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
      'X-Dasha-Edge': 'digest',
    }),
  });
}

async function digestEdge(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const quietCors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
  if (path === '/digest.json' || isQuietTapePath(path)) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: quietCors });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method not allowed' }, 405, '*');
    const edge = isQuietTapePath(path) ? 'forum-tape' : 'digest-json';
    return digestJsonResponse(request, await publicDigest(env), edge);
  }
  if (path === '/digest') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method not allowed' }, 405);
    return digestPageResponse(request, await publicDigest(env));
  }
  if (path === '/digest/ingest' && request.method === 'POST') {
    const secret = env?.DIGEST_INGEST;
    if (!secret) return json({ error: 'unset' }, 404);
    if (request.headers.get('x-dasha-digest') !== secret) return json({ error: 'forbidden' }, 403);
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (!stub) return json({ error: 'lobby unavailable' }, 503);
    return stub.fetch(request);
  }
  return null;
}


async function productEdge(request, url, env) {
  const potter308 = potterHome308Response(request, url);
    if (potter308) return potter308;
    const simpOg = await simpOgResponse(request, url, env);
    if (simpOg) return simpOg;
    const productAsset = await workerStaticAssetResponse(request, url, env);
    if (productAsset) return productAsset;
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/privacy' || url.pathname === '/privacy/')) {
      return privacyPageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isComputeSkillPath(url.pathname)) {
      return computeSkillResponse(request, url.pathname);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isComputePagePath(url.pathname)) {
      return computePageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/dasha-compute-open-alpha.tar.gz') {
      return computeKitResponse(request, env);
    }
    if (isBagRecordPath(url.pathname)) {
      return bagRecordApi(request, env);
    }
    if (isFaucetTapePath(url.pathname)) {
      if (env?.FAUCET) {
        try {
          const stub = env.FAUCET.get(env.FAUCET.idFromName('main'));
          if (stub) return stub.fetch(request);
        } catch {}
      }
      return tapeApi(request, []);
    }
    if (isBareFaucetFillPath(url.pathname) || isFaucetFillPath(url.pathname)) {
      if (env?.FAUCET) {
        try {
          const stub = env.FAUCET.get(env.FAUCET.idFromName('main'));
          if (stub) return stub.fetch(request);
        } catch {}
      }
      return fillShareApi(request, []);
    }
    if (isFaucetPublicReadPath(url.pathname)) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return json({ error: 'method not allowed' }, 405, '*');
      }
      const dest = new URL(request.url);
      dest.pathname = dest.pathname.replace(/\/+$/, '') || '/';
      const forwarded = dest.href === request.url ? request : new Request(dest, request);
      if (env?.FAUCET) {
        try {
          const stub = env.FAUCET.get(env.FAUCET.idFromName('main'));
          if (stub) return stub.fetch(forwarded);
        } catch {}
      }
      const path = dest.pathname;
      const cfg = faucetConfig(env || {});
      if (path === '/faucet/me') {
        const me = meFromSession(null, {}, null);
        me.configured = cfg.configured;
        return json(me, 200, '*', { credentials: true });
      }
      return json({
        ...buildStatus(cfg, {}),
        ...rateLimitStatusFields({}, cfg),
        signer: Boolean(cfg.hasSigner),
      }, 200, '*', { credentials: true });
    }
    if (isComputeApiPath(url.pathname)) {
      const origin = request.headers.get('Origin');
      const allowedOrigin =
        origin && originAllowed(origin, env.ALLOWED_ORIGINS || '')
          ? origin
          : env.ALLOW_ANY_ORIGIN
            ? origin || '*'
            : null;
      if (request.method === 'OPTIONS') {
        if (!allowedOrigin && !env.ALLOW_ANY_ORIGIN) {
          return new Response(null, { status: 403, headers: SECURITY });
        }
        return new Response(null, {
          status: 204,
          headers: { ...SECURITY, ...corsHeaders(allowedOrigin || '*', { credentials: true }) },
        });
      }
      const response = await computeApi(request, env, allowedOrigin);
      if (response) return response;
    }
    if (isComputeOcmPath(url.pathname)) {
      const ocmRes = await proxyComputeOcm(request);
      if (ocmRes) return ocmRes;
    }
    if (url.pathname.startsWith('/crew/api/')) {
      if (env?.LOBBY) {
        const stub = env.LOBBY.get(env.LOBBY.idFromName('public'));
        if (stub) return stub.fetch(request);
      }
      const response = await crewApi(request, env);
      if (response) return response;
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isCrewPagePath(url.pathname)) {
      return crewPageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/dasha-crew.tar.gz') {
      return crewKitResponse(request, env);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/price') {
      if (env?.LOBBY) {
        try {
          const stub = env.LOBBY.get(env.LOBBY.idFromName('public'));
          if (stub) return stub.fetch(request);
        } catch {}
      }
      return json({ ok: false, error: 'unavailable' }, 503, '*');
    }
    if (isChessApiPath(url.pathname)) {
      return proxyChessApi(request, env);
    }
    if (url.pathname.startsWith('/oauth/x') || url.pathname.startsWith('/oauth/github')) {
      const dest = new URL(request.url);
      dest.protocol = 'https:';
      dest.hostname = 'lobby.getdasha.com';
      return Response.redirect(dest.href, 308);
    }
    const digestRes = await digestEdge(request, env);
    if (digestRes) return digestRes;
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/manifest.json' || url.pathname === '/manifest.webmanifest')) {
      return manifestJsonResponse(request);
    }
    if (isRetiredStudioPath(url.pathname)) return retiredStudioResponse(request);
  if ((request.method === 'GET' || request.method === 'HEAD') && RETIRED_COMMERCE_PATHS.has(url.pathname)) {
    return new Response(request.method === 'HEAD' ? null : stripNotFoundDroppedCtaCss(NOT_FOUND_HTML), {
      status: 404,
      headers: htmlHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Dasha-Edge': 'retired-commerce',
      }),
    });
  }
  if ((request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') && url.pathname === '/.well-known/grok-bot.json') {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    return grokBotWellKnownResponse(request);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/.well-known/security.txt') {
    return securityTxtResponse(request, url.hostname);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/robots.txt') {
    return new Response(request.method === 'HEAD' ? null : stripRobotsLecture(ROBOTS_TXT), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'all',
        'X-Dasha-Edge': 'robots',
      },
    });
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/lobby/feed.xml') {
    const feed = forumRssXml(request.method === 'GET' ? await publicForumThreads(env).catch(() => []) : []);
    return new Response(request.method === 'HEAD' ? null : feed, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Dasha-Edge': 'forum-feed',
      },
    });
  }
  const forumCardMatch = url.pathname.match(/^\/lobby\/card\/([A-Za-z0-9_-]{1,40})\.png$/);
  if ((request.method === 'GET' || request.method === 'HEAD') && forumCardMatch) {
    const data = await publicForumThread(env, forumCardMatch[1]).catch(() => null);
    if (!data) return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
    const replies = data.posts.slice(1).filter(post => post && !post.deleted && post.text).length;
    const reactions = data.posts.reduce((total, post) => total + (Number.isInteger(post?.reactionCount) && post.reactionCount > 0 && post.reactionCount <= MAX_REACTORS ? post.reactionCount : 0), 0);
    const png = request.method === 'HEAD' ? null : await forumThreadOgPng({ title: data.thread.title, handle: data.posts[0]?.handle, replies, reactions });
    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=120',
        'X-Dasha-Edge': 'forum-card',
      },
    });
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/sitemap.xml') {
    let sitemap = SITEMAP_XML;
    if (request.method === 'GET') {
      const [threads, members] = await Promise.all([
        publicForumThreads(env).catch(() => []),
        publicSimpMembers(env).catch(() => []),
      ]);
      sitemap = simpSitemapXml(forumSitemapXml(sitemap, threads), members);
    }
    return new Response(request.method === 'HEAD' ? null : sitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Dasha-Edge': 'sitemap',
      },
    });
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && /^\/bounties\.json\/?$/.test(url.pathname)) {
    return bountiesFeedResponse(request);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/login' || url.pathname === '/login/')) {
    return loginPageResponse(request);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/' || url.pathname === '')) {
    const dest = challengeRedirectPath(url.searchParams);
    if (dest) return Response.redirect(`https://www.getdasha.com${dest}`, 308);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/quiz' || url.pathname === '/quiz/')) {
    return Response.redirect(`https://www.getdasha.com${quizRedirectPath()}`, 308);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/simp' || url.pathname === '/simp/')) {
    const dest = challengeRedirectPath(url.searchParams);
    if (dest) return Response.redirect(`https://www.getdasha.com${dest}`, 308);
    const board = request.method === 'GET' ? await publicSimpMembers(env).catch(() => null) : null;
    return new Response(request.method === 'HEAD' ? null : servedSimpPageHtml({ board: board ? { editorial: [publicPerryRow()], measured: board } : undefined }), {
      status: 200,
      headers: htmlHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Dasha-Edge': 'simp',
      }),
    });
  }
  const memberCardMatch = url.pathname.match(/^\/simp\/u\/([A-Za-z0-9_]{1,15})\/card\.png$/);
  if ((request.method === 'GET' || request.method === 'HEAD') && memberCardMatch) {
    try {
      const member = await publicSimpMember(env, memberCardMatch[1].toLowerCase());
      const png = request.method === 'HEAD' ? null : await simpMemberOgPng(member);
      return new Response(png, {
        status: 200,
        headers: htmlHeaders({
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=120',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Dasha-Edge': 'simp-member-card',
        }),
      });
    } catch {
      return new Response(null, { status: 404, headers: { ...SECURITY, 'X-Dasha-Edge': 'simp-member-card-missing' } });
    }
  }
  const memberBadgeMatch = url.pathname.match(/^\/simp\/u\/([A-Za-z0-9_]{1,15})\/badge\.svg$/);
  if ((request.method === 'GET' || request.method === 'HEAD') && memberBadgeMatch) {
    try {
      const member = await publicSimpMember(env, memberBadgeMatch[1].toLowerCase());
      return new Response(request.method === 'HEAD' ? null : simpMemberBadgeSvg(member), {
        status: 200,
        headers: htmlHeaders({
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Robots-Tag': 'noindex',
          'X-Dasha-Edge': 'simp-member-badge',
        }),
      });
    } catch {
      return new Response(null, { status: 404, headers: { ...SECURITY, 'X-Dasha-Edge': 'simp-member-badge-missing' } });
    }
  }
  const memberShareMatch = url.pathname.match(/^\/simp\/u\/([A-Za-z0-9_]{1,15})\/?$/);
  if ((request.method === 'GET' || request.method === 'HEAD') && memberShareMatch) {
    const handle = memberShareMatch[1].toLowerCase();
    try {
      const html = simpMemberHtml(await publicSimpMember(env, handle));
      return new Response(request.method === 'HEAD' ? null : html, {
        status: 200,
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
          'X-Dasha-Edge': 'simp-member-share',
        }),
      });
    } catch {
      return new Response(request.method === 'HEAD' ? null : stripNotFoundDroppedCtaCss(NOT_FOUND_HTML), {
        status: 404,
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Dasha-Edge': 'simp-member-missing',
        }),
      });
    }
  }

  const shareMatch = url.pathname.match(/^\/simp\/r\/([^/]+)\/?$/);
  if ((request.method === 'GET' || request.method === 'HEAD') && shareMatch) {
    const id = shareMatch[1];
    try {
      const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
      if (!stub) return new Response(request.method === 'HEAD' ? null : 'Result not found', { status: 404, headers: SECURITY });
      const look = await stub.fetch(new Request(`https://lobby.getdasha.com/simp/result/${encodeURIComponent(id)}`));
      if (!look.ok) return new Response(request.method === 'HEAD' ? null : 'Result not found', { status: 404, headers: SECURITY });
      const data = await look.json();
      const result = data?.result;
      if (!result) return new Response(request.method === 'HEAD' ? null : 'Result not found', { status: 404, headers: SECURITY });
      const html = simpResultHtml({
        id,
        title: result.title,
        correct: result.correct,
        total: result.total,
      });
      return new Response(request.method === 'HEAD' ? null : html, {
        status: 200,
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Dasha-Edge': 'simp-share',
        }),
      });
    } catch {
      return new Response(request.method === 'HEAD' ? null : 'Result not found', { status: 404, headers: SECURITY });
    }
  }
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    (url.pathname === '/how-to-buy' || url.pathname === '/how-to-buy/')
  ) {
    return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(polishHowtoHtml(HOWTO_HTML)), {
      status: 200,
      headers: htmlLlmsHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Dasha-Edge': 'howto',
      }),
    });
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/lobby' || url.pathname === '/lobby/')) {
    let html = asStandaloneLobbyPage(LOBBY_PAGE_HTML);
    const threadId = url.searchParams.get('t') || '';
    if (/^[A-Za-z0-9_-]{1,40}$/.test(threadId)) {
      try {
        const data = await publicForumThread(env, threadId);
        html = forumThreadPageHtml(html, data.thread, data.posts);
      } catch {}
    } else if (request.method === 'GET') {
      try { html = forumIndexPageHtml(html, await publicForumThreads(env)); } catch {}
    }
    try { html = applyDigestTape(html, (await publicDigest(env)).items); } catch {}
    return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(injectXConnectPrompt(polishServedSlim(html))), {
      status: 200,
      headers: htmlLlmsHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Dasha-Edge': 'lobby-page',
      }),
    });
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/faucet' || url.pathname === '/faucet/')) {
    return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(injectXConnectPrompt(FAUCET_PAGE_HTML)), {
      status: 200,
      headers: htmlLlmsHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Dasha-Edge': 'faucet',
      }),
    });
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/chess' || url.pathname === '/chess/')) {
    const html = await chessPageForRequest(request, env);
    return new Response(request.method === 'HEAD' ? null : html, {
      status: 200,
      headers: chessPageHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Dasha-Edge': 'chess',
      }, url.searchParams.get('embed') === '1'),
    });
  }
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    url.pathname === '/client/x-connect.js'
  ) {
    return jsAsset(String(X_CONNECT_JS).replaceAll('#simp', '#chess-stage'), '*', { headOnly: request.method === 'HEAD' });
  }
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    url.pathname === '/client/chess-local.js'
  ) {
    return jsAsset(CHESS_LOCAL_JS, '*', { headOnly: request.method === 'HEAD' });
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/desk' || url.pathname === '/desk/')) {
    return Response.redirect('https://www.getdasha.com/how-to-buy', 308);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && ['/how','/how/','/howto','/howto/','/how-to','/how-to/','/howtobuy','/howtobuy/','/buy','/buy/'].includes(String(url.pathname || '').toLowerCase())) {
    return Response.redirect('https://www.getdasha.com/how-to-buy', 308);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && isForumChatAliasPath(url.pathname)) {
    return forumToLobbyRedirect(url);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/bounties' || url.pathname === '/bounties/')) {
    return bountiesPageResponse(request);
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/contribute' || url.pathname === '/contribute/')) {
    return contributePageResponse(request);
  }
  // Retire SEO-trap paths that must never reappear as product pages.
  if ((request.method === 'GET' || request.method === 'HEAD') && RETIRED_SEO_PATHS.has(url.pathname)) {
    return Response.redirect('https://www.getdasha.com/', 308);
  }
  // Pass through to Webflow (subrequest does not re-invoke this Worker for same zone).
  // Strip personal publisher branding (potterlab / John Potter) from head JSON-LD so the
  // public product site is getdasha-only. Source of truth for clean schema is also in embeds.
  const upstream = await fetch(request);
  const ct = String(upstream.headers.get('content-type') || '');
  const isHome = url.pathname === '/' || url.pathname === '';
  if (
    upstream.status === 404 &&
    ct.includes('text/html') &&
    (request.method === 'GET' || request.method === 'HEAD')
  ) {
    return new Response(request.method === 'HEAD' ? null : stripNotFoundDroppedCtaCss(NOT_FOUND_HTML), {
      status: 404,
      headers: htmlHeaders({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Dasha-Edge': 'html-404',
      }),
    });
  }
  if (request.method !== 'GET' || !ct.includes('text/html')) {
    if (isHome && (request.method === 'GET' || request.method === 'HEAD') && ct.includes('text/html')) {
      const headers = new Headers(upstream.headers);
      attachLlmsDescribedBy(headers);
      return new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }
    return upstream;
  }
  let html = await upstream.text();
  const originalHtml = html;
  html = sanitizePublicJsonLd(html);
  const stripped = html !== originalHtml;
  html = ensureHtmlLang(html);
  html = hardenBlankTargets(html);
  const pageUrl = isHome
    ? 'https://www.getdasha.com/'
    : `https://www.getdasha.com${url.pathname.replace(/\/$/, '')}`;
  html = ensureCanonical(html, pageUrl);
  html = stripDeadNav(html);
  html = stripLegacyFonts(html);
  html = injectXConnectPrompt(html);
  if (isHome) html = mintHomeTitle(html);
  if (isHome) html = dashaHomeBodySafeStrip(originalHtml, html);
  if (isHome) html = mintHomeDescription(html);
  if (isHome) html = mintHomeSameAs(html);
  if (isHome) html = mintHomeOg(html);
  if (isHome) html = stripHomeOtherCoinWarning(html);
  if (isHome) html = linkHomeWhich(html);
  if (isHome) html = stripHomeTokenClutter(html);
  if (isHome) {
    try { html = applyDigestTape(html, homeTapeItems((await publicDigest(env)).items)); } catch {}
    html = injectDigestRemount(html);
    html = stripHomeWebflowPush(html);
  }
  html = stripDeadTrackingPixel(html);
  if (isHome) html = attachLlmsHtmlLinks(html);
  if (stripped) {
    // Also drop any leftover plain mentions in head comments (defensive).
    html = html.replace(/https?:\/\/x\.com\/potterlab/gi, 'https://www.getdasha.com/');
  }
  const headers = applyHtmlSecurity(new Headers(upstream.headers));
  headers.delete('content-length');
  headers.set('X-Dasha-Edge', stripped ? 'html-strip-personal-brand' : 'html-security');
  if (isHome) attachLlmsDescribedBy(headers);
  return new Response(html, { status: upstream.status, statusText: upstream.statusText, headers });
}

/**
 * Tip faucet Durable Object — live production already binds class name DashaFaucet.
 * Keeps claim ledger separate from lobby chat room storage.
 */
export class DashaFaucet {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {{ byX?: Record<string, object>, byWallet?: Record<string, object> }} */
    this.faucetClaims = { byX: {}, byWallet: {} };
    /** @type {Record<string, { dest: string, at: number }>} */
    this.faucetBinds = {};
    /** @type {{ dayKey?: string, dayCount?: number, hourKey?: string, hourCount?: number, autoPausedUntil?: number, lastClaimAt?: number, recentAts?: number[] }} */
    this.faucetMetrics = {};
    /** @type {Record<string, { xId: string, dest: string, amountRaw: string, at: number }>} */
    this.faucetDonates = {};
    /** @type {Array<{ sig: string, amountUi: number, at: number, from: string }>} verified fills only */
    this.faucetTape = [];
    /** @type {Record<string, object>} preview-only, five-minute burn intents */
    this.burnIntents = {};
    /** @type {Record<string, object>} private receipts keyed by public transaction signature */
    this.burnReceipts = {};
    this.burnConfirming = new Set();
    this.faucetInventory = null;
    this.state.blockConcurrencyWhile(async () => {
      const faucetClaims = await this.state.storage.get('faucetClaims');
      if (faucetClaims && typeof faucetClaims === 'object' && !Array.isArray(faucetClaims)) {
        this.faucetClaims = {
          byX: faucetClaims.byX && typeof faucetClaims.byX === 'object' ? faucetClaims.byX : {},
          byWallet: faucetClaims.byWallet && typeof faucetClaims.byWallet === 'object' ? faucetClaims.byWallet : {},
        };
      }
      const faucetBinds = await this.state.storage.get('faucetBinds');
      if (faucetBinds && typeof faucetBinds === 'object' && !Array.isArray(faucetBinds)) this.faucetBinds = faucetBinds;
      const faucetMetrics = await this.state.storage.get('faucetMetrics');
      if (faucetMetrics && typeof faucetMetrics === 'object' && !Array.isArray(faucetMetrics)) this.faucetMetrics = faucetMetrics;
      const faucetDonates = await this.state.storage.get('faucetDonates');
      if (faucetDonates && typeof faucetDonates === 'object' && !Array.isArray(faucetDonates)) this.faucetDonates = faucetDonates;
      const faucetTape = await this.state.storage.get('faucetTape');
      if (Array.isArray(faucetTape)) this.faucetTape = faucetTape;
      const burnIntents = await this.state.storage.get('burnIntents');
      if (burnIntents && typeof burnIntents === 'object' && !Array.isArray(burnIntents)) this.burnIntents = burnIntents;
      const burnReceipts = await this.state.storage.get('burnReceipts');
      if (burnReceipts && typeof burnReceipts === 'object' && !Array.isArray(burnReceipts)) this.burnReceipts = burnReceipts;
      const faucetInventory = await this.state.storage.get('faucetInventory');
      if (faucetInventory && typeof faucetInventory === 'object') this.faucetInventory = faucetInventory;
    });
  }

  async maybeScanTape() {
    const now = Date.now();
    if (!shouldScanTape(this.tapeScanAt, now)) return;
    this.tapeScanAt = now;
    try {
      const treasury = String(this.env.FAUCET_TREASURY || FAUCET_TREASURY_DEFAULT).trim();
      const mint = String(this.env.MINT || FAUCET_MINT).trim();
      let signer = '';
      try { signer = await publicKeyFromSecret(faucetSignerSecret(this.env)); } catch { signer = ''; }
      const ata = await associatedTokenAddress(treasury, mint);
      const sigs = await rpc(this.env, 'getSignaturesForAddress', [ata, { limit: FAUCET_TAPE_SCAN_CAP }]);
      const rows = Array.isArray(sigs) ? sigs : [];
      const entries = [];
      for (const row of rows) {
        const sig = String(row?.signature || '').trim();
        if (!sig) continue;
        if ((this.faucetTape || []).some((item) => item && item.sig === sig)) continue;
        try {
          const tx = await rpc(this.env, 'getTransaction', [
            sig,
            { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'finalized' },
          ]);
          entries.push({ sig, tx });
        } catch {
          /* next sig */
        }
      }
      const found = collectInboundFills(entries, {
        treasury,
        mint,
        existing: this.faucetTape,
        now,
        faucetSigner: signer,
      });
      if (!found.length) return;
      let next = this.faucetTape;
      let changed = false;
      for (const row of found) {
        const taped = appendFill(next, row);
        if (taped.ok) {
          next = taped.list;
          if (!taped.replay) changed = true;
        }
      }
      if (changed) {
        this.faucetTape = next;
        await this.persistFaucet();
      }
    } catch {
      // fail closed — empty tape stays honest
    }
  }

  async persistFaucet() {
    await this.state.storage.put({
      faucetClaims: this.faucetClaims,
      faucetBinds: this.faucetBinds,
      faucetMetrics: this.faucetMetrics,
      faucetDonates: this.faucetDonates,
      faucetTape: this.faucetTape,
      burnIntents: this.burnIntents,
      burnReceipts: this.burnReceipts,
    });
  }

  async persistBurnState(intents, receipts) {
    await this.state.storage.put({ burnIntents: intents, burnReceipts: receipts });
    this.burnIntents = intents;
    this.burnReceipts = receipts;
  }

  /** Ask the lobby DO to enroll + award donate points. Fail closed to awarded:false. */
  async creditDonateToBoard(session, sig, row = {}) {
    const empty = { awarded: false, points: 0, donate: 0, error: 'award failed' };
    if (!this.env.LOBBY || !session?.xId) return empty;
    try {
      const stub = this.env.LOBBY.get(this.env.LOBBY.idFromName('public'));
      const creditRes = await stub.fetch(new Request('https://lobby.getdasha.com/simp/internal/donate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-dasha-internal': String(this.env.LOBBY_SESSION_SECRET || ''),
        },
        body: JSON.stringify({
          xId: String(session.xId),
          handle: session.handle,
          avatar: session.avatar,
          verifiedType: session.verifiedType,
          signature: sig,
          amountRaw: String(row.amountRaw || ''),
          at: row.at,
          proven: true,
        }),
      }));
      const credit = await creditRes.json().catch(() => ({}));
      if (credit.ok && credit.awarded) {
        return {
          awarded: true,
          points: Number(credit.points) || 0,
          donate: Number(credit.donate) || 0,
        };
      }
      return { ...empty, error: String(credit.error || 'award failed') };
    } catch {
      return empty;
    }
  }

  async faucetStatusPayload() {
    const cfg = faucetConfig(this.env);
    const limits = rateLimitStatusFields(this.faucetMetrics, cfg);
    // Without a tip signer, claims cannot pay — skip RPC and report empty (faster + honest).
    if (!cfg.configured) return { ...buildStatus(cfg, {}), ...limits, signer: false };
    if (!cfg.hasSigner) {
      const empty = buildStatus(cfg, { balanceRaw: 0n, rpcOk: true, solLamports: 0n });
      return { ...empty, ...limits, signer: false };
    }
    let tipWallet = cfg.treasury;
    try {
      tipWallet = await publicKeyFromSecret(faucetSignerSecret(this.env));
    } catch (e) {
      const bad = buildStatus({ ...cfg, hasSigner: false }, { balanceRaw: 0n, rpcOk: true, solLamports: 0n });
      return { ...bad, ...limits, signer: false, signerError: String(e?.message || e).slice(0, 80) };
    }
    // Pitch-in + inventory use the signer wallet (only address that can pay tips).
    const cfgTip = { ...cfg, treasury: tipWallet, paused: Boolean(cfg.paused || limits.autoPaused) };
    let inventory = { balanceRaw: 0n, rpcOk: true, solLamports: null };
    try {
      inventory.balanceRaw = await tokenBalanceRaw(this.env, tipWallet, cfg.mint);
      this.faucetInventory = { balanceRaw: String(inventory.balanceRaw), at: Date.now() };
      this.state.storage.put('faucetInventory', this.faucetInventory).catch(() => {});
    } catch (e) {
      const cached = this.faucetInventory;
      const fresh = cached && Date.now() - Number(cached.at || 0) < 15 * 60_000;
      if (fresh && cached.balanceRaw != null) {
        inventory.balanceRaw = BigInt(cached.balanceRaw);
        inventory.rpcOk = true;
      } else {
        inventory = {
          balanceRaw: 0n,
          rpcOk: false,
          solLamports: null,
          rpcDetail: String(e?.message || e),
          rpcTried: solanaRpcEndpoints(this.env).map((u) => {
            try { return new URL(u).host; } catch { return 'bad'; }
          }),
        };
      }
    }
    try {
      const bal = await rpc(this.env, 'getBalance', [tipWallet]);
      inventory.solLamports = BigInt(typeof bal === 'object' && bal != null ? (bal.value ?? bal) : bal || 0);
    } catch {
      inventory.solLamports = inventory.solLamports == null ? null : inventory.solLamports;
    }
    const status = buildStatus(cfgTip, inventory);
    return {
      ...status,
      ...limits,
      signer: true,
      ...(inventory.rpcTried ? { rpcTried: inventory.rpcTried } : {}),
    };
  }

  async handleFaucet(request, allowedOrigin) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cred = { credentials: true };
    if (isFaucetTapePath(path)) {
      if (request.method === 'GET' || request.method === 'HEAD') await this.maybeScanTape();
      const taped = tapeApi(request, this.faucetTape);
      if (taped) return taped;
    }
    if (isBareFaucetFillPath(path) || isFaucetFillPath(path)) {
      if (request.method === 'GET' || request.method === 'HEAD') await this.maybeScanTape();
      const shared = fillShareApi(request, this.faucetTape);
      if (shared) return shared;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD' && !allowedOrigin) {
      return json({ error: 'origin required' }, 403, null);
    }
    const body = async () => {
      try {
        return await request.json();
      } catch {
        return {};
      }
    };

    if (path === '/faucet/status' && (request.method === 'GET' || request.method === 'HEAD')) {
      const status = await this.faucetStatusPayload();
      return json(status, 200, allowedOrigin || '*', cred);
    }

    if (path === '/faucet/me' && (request.method === 'GET' || request.method === 'HEAD')) {
      const session = await sessionFromRequest(this.env, request);
      const xId = session?.xId ? String(session.xId) : '';
      const bind = xId ? this.faucetBinds[xId] : null;
      const cfgMe = faucetConfig(this.env);
      const cooldownMs = (Number(cfgMe.cooldownDays) || 1) * 24 * 60 * 60 * 1000;
      const me = meFromSession(session, this.faucetClaims, bind, { cooldownMs });
      me.configured = cfgMe.configured;
      if (session?.xId) {
        const gate = checkXEligibility(session, {
          minXAgeDays: cfgMe.minXAgeDays,
          minXFollowers: cfgMe.minXFollowers,
        });
        if (!gate.ok) me.error = gate.error;
      }
      return json(me, 200, allowedOrigin || '*', cred);
    }

    if (path === '/faucet/dest-check' && request.method === 'POST') {
      const input = await body();
      const err = destShapeError(input.dest, input.last4);
      if (err) return json({ ok: false, error: err }, 200, allowedOrigin, cred);
      const session = await sessionFromRequest(this.env, request);
      if (!session?.xId) return json({ ok: false, error: 'link X first' }, 200, allowedOrigin, cred);
      // Shape probe only. Never persist a bind. Never label IS_WALLET.
      return json({ ok: true, dest: String(input.dest).trim() }, 200, allowedOrigin, cred);
    }

    if (path === '/faucet/wallet/challenge' && request.method === 'POST') {
      if (!this.env.LOBBY_SESSION_SECRET) return json({ error: 'not_configured' }, 501, allowedOrigin, cred);
      const input = await body();
      const publicKey = String(input.publicKey || '').trim();
      const shape = destShapeError(publicKey);
      if (shape) return json({ ok: false, error: shape }, 400, allowedOrigin, cred);
      const now = Date.now();
      const nonce = randomUrlToken(12);
      const issuedAt = now;
      const expirationTime = now + 10 * 60_000;
      const domain = FAUCET_SIWS_DOMAIN;
      const siws = faucetSiwsInput({ domain, publicKey, nonce, issuedAt, expirationTime });
      const message = `${siws.domain} wants you to sign in with your Solana account:\n${siws.address}\n\n${siws.statement}\n\nURI: ${siws.uri}\nVersion: ${siws.version}\nChain ID: ${siws.chainId}\nNonce: ${siws.nonce}\nIssued At: ${siws.issuedAt}\nExpiration Time: ${siws.expirationTime}`;
      const challenge = await signPayload(this.env.LOBBY_SESSION_SECRET, {
        kind: 'faucet_siws',
        publicKey,
        nonce,
        domain,
        exp: expirationTime,
      });
      return json({ ok: true, challenge, message, siws }, 200, allowedOrigin, cred);
    }

    if (path === '/faucet/wallet/verify' && request.method === 'POST') {
      if (!this.env.LOBBY_SESSION_SECRET) return json({ error: 'not_configured' }, 501, allowedOrigin, cred);
      const input = await body();
      const session = await sessionFromRequest(this.env, request);
      if (!session?.xId) return json({ ok: false, error: 'link X first' }, 401, allowedOrigin, cred);
      const xId = String(session.xId);

      if (input.paste) {
        const dest = String(input.dest || '').trim();
        const err = destShapeError(dest, input.last4);
        if (err) return json({ ok: false, error: err }, 400, allowedOrigin, cred);
        /* PASTED, not IS_WALLET: nothing here proves the typer controls this address. It used to
           write IS_WALLET, the same label the signature-verified path writes, so afterwards the
           ledger could not tell them apart — and an unproven bind could take a stranger's
           per-wallet slot, since Solana addresses are public. See DASHA-FAUCET-REVIEW-2026-08-16.md. */
        this.faucetBinds[xId] = { dest, at: Date.now(), kind: 'PASTED' };
        await this.persistFaucet();
        return json({ ok: true, dest, kind: 'PASTED' }, 200, allowedOrigin, cred);
      }

      const publicKey = String(input.publicKey || '').trim();
      const shape = destShapeError(publicKey);
      if (shape) return json({ ok: false, error: shape }, 400, allowedOrigin, cred);
      const challenge = await verifyPayload(this.env.LOBBY_SESSION_SECRET, input.challenge);
      if (!challenge || challenge.kind !== 'faucet_siws' || challenge.publicKey !== publicKey) {
        return json({ ok: false, error: 'invalid faucet challenge' }, 400, allowedOrigin, cred);
      }
      if (Number(challenge.exp) < Date.now()) return json({ ok: false, error: 'invalid faucet challenge' }, 400, allowedOrigin, cred);
      if (challenge.domain && challenge.domain !== FAUCET_SIWS_DOMAIN) {
        return json({ ok: false, error: 'siws_domain' }, 400, allowedOrigin, cred);
      }
      const message = String(input.signedMessage || '');
      const msgErr = siwsMessageError(message, {
        publicKey,
        domain: challenge.domain || FAUCET_SIWS_DOMAIN,
        nonce: challenge.nonce,
      });
      if (msgErr) return json({ ok: false, error: msgErr }, 400, allowedOrigin, cred);
      const ok = await verifyEd25519(message, publicKey, String(input.signature || ''));
      if (!ok) return json({ ok: false, error: 'invalid faucet challenge' }, 400, allowedOrigin, cred);
      this.faucetBinds[xId] = { dest: publicKey, at: Date.now(), kind: 'IS_WALLET' };
      await this.persistFaucet();
      return json({ ok: true, dest: publicKey, kind: 'IS_WALLET' }, 200, allowedOrigin, cred);
    }

    if (path === '/faucet/claim' && request.method === 'POST') {
      const session = await sessionFromRequest(this.env, request);
      if (!session?.xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      const xId = String(session.xId);
      const bind = this.faucetBinds[xId];
      if (!bind?.dest) return json({ error: 'dest_not_wallet' }, 400, allowedOrigin, cred);
      const cfg = faucetConfig(this.env);
      const xGate = checkXEligibility(session, {
        minXAgeDays: cfg.minXAgeDays,
        minXFollowers: cfg.minXFollowers,
      });
      if (!xGate.ok) return json({ error: xGate.error }, 403, allowedOrigin, cred);
      const rate = checkRateLimits(this.faucetMetrics, cfg);
      if (!rate.ok) {
        if (rate.autoPausedUntil) {
          this.faucetMetrics = { ...this.faucetMetrics, autoPausedUntil: rate.autoPausedUntil };
          await this.persistFaucet();
        }
        return json({ error: rate.error }, 503, allowedOrigin, cred);
      }
      const status = await this.faucetStatusPayload();
      if (!status.configured) return json({ error: 'not_configured' }, 501, allowedOrigin, cred);
      if (status.error === 'faucet_paused') return json({ error: 'faucet_paused' }, 503, allowedOrigin, cred);
      if (!status.funded) return json({ error: status.error || 'treasury_empty' }, 503, allowedOrigin, cred);
      /* Only a signature-verified destination may hold the per-wallet slot. A pasted one still
         deduplicates by X id, so a claimer cannot double-dip; it just cannot lock out the owner
         of an address they merely typed. */
      const proven = bind.kind === 'IS_WALLET';
      if (!proven) return json({ error: 'prove wallet' }, 403, allowedOrigin, cred);
      const cooldownMs = (Number(cfg.cooldownDays) || 1) * 24 * 60 * 60 * 1000;
      const allowed = claimAllowed(this.faucetClaims, { xId, wallet: bind.dest, proven, cooldownMs });
      if (!allowed.ok) {
        if (allowed.error === 'already claimed') {
          const replay = alreadyClaimedResponse(allowed.prev);
          if (replay) return json(replay, 200, allowedOrigin, cred);
        }
        if (allowed.error === 'confirming') {
          const out = { error: 'confirming' };
          if (allowed.prev?.signature) {
            out.signature = allowed.prev.signature;
            out.solscan = `https://solscan.io/tx/${allowed.prev.signature}`;
          }
          return json(out, 200, allowedOrigin, cred);
        }
        return json({ error: allowed.error }, 409, allowedOrigin, cred);
      }
      this.faucetClaims = reserveClaim(this.faucetClaims, { xId, wallet: bind.dest, proven });
      await this.persistFaucet();
      const sent = await sendTipTransfer(this.env, {
        destOwner: bind.dest,
        amountRaw: BigInt(status.amountRaw || 100_000_000),
        mint: status.mint || FAUCET_MINT,
      });
      if (!sent.ok) {
        this.faucetClaims = clearPendingClaim(this.faucetClaims, { xId, wallet: bind.dest, proven });
        await this.persistFaucet();
        const code =
          sent.error === 'treasury_empty' || sent.error === 'treasury_rent' || sent.error === 'rpc_unavailable'
            ? 503
            : 400;
        return json({ error: sent.error || 'claim failed.', detail: sent.detail || undefined }, code, allowedOrigin, cred);
      }
      this.faucetClaims = recordClaim(this.faucetClaims, {
        xId,
        wallet: bind.dest,
        signature: sent.signature,
        proven,
      });
      this.faucetMetrics = noteSuccessfulClaim(this.faucetMetrics, cfg);
      await this.persistFaucet();
      return json(
        {
          ok: true,
          signature: sent.signature,
          solscan: sent.solscan,
          dest: bind.dest,
          createdAta: Boolean(sent.createdAta),
        },
        200,
        allowedOrigin,
        cred,
      );
    }

    if (path === '/faucet/burn/preview' && request.method === 'POST') {
      if (!BURN_RECEIPTS_ENABLED) return json({ error: 'burn receipts unavailable' }, 503, allowedOrigin, cred);
      const session = await sessionFromRequest(this.env, request);
      if (!session?.xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      const xId = String(session.xId);
      const bind = this.faucetBinds[xId];
      if (!bind?.dest || bind.kind !== 'IS_WALLET') return json({ error: 'prove wallet' }, 403, allowedOrigin, cred);
      const input = await body();
      const created = createBurnIntent({
        id: randomUrlToken(18),
        xId,
        owner: bind.dest,
        source: input.source,
        amountRaw: input.amountRaw,
      });
      if (!created.ok) return json({ error: created.error }, 400, allowedOrigin, cred);
      const queued = upsertBurnIntent(this.burnIntents, created.intent);
      if (!queued.ok) return json({ error: queued.error || 'burn preview full' }, 503, allowedOrigin, cred);
      this.burnIntents = queued.intents;
      await this.persistFaucet();
      return json({
        ok: true,
        preview: {
          id: created.intent.id,
          owner: created.intent.owner,
          source: created.intent.source,
          mint: created.intent.mint,
          amountRaw: created.intent.amountRaw,
          decimals: created.intent.decimals,
          memo: created.intent.memo,
          expiresAt: created.intent.expiresAt,
          irreversible: true,
          transactionBuilt: false,
          points: 0,
        },
      }, 200, allowedOrigin, cred);
    }

    if (path === '/faucet/burn/status' && (request.method === 'GET' || request.method === 'HEAD')) {
      return json({ ok: true, enabled: BURN_RECEIPTS_ENABLED, mint: FAUCET_MINT, ...burnAggregate(this.burnReceipts), decimals: 6, points: 0, scoreNeutral: true }, 200, allowedOrigin || '*');
    }

    if (path === '/faucet/burn/confirm' && request.method === 'POST') {
      if (!BURN_RECEIPTS_ENABLED) return json({ error: 'burn receipts unavailable' }, 503, allowedOrigin, cred);
      const session = await sessionFromRequest(this.env, request);
      if (!session?.xId) return json({ error: 'link X first' }, 401, allowedOrigin, cred);
      const xId = String(session.xId);
      const bind = this.faucetBinds[xId];
      if (!bind?.dest || bind.kind !== 'IS_WALLET') return json({ error: 'prove wallet' }, 403, allowedOrigin, cred);
      const input = await body();
      const signature = String(input.signature || '').trim();
      const intentId = String(input.intentId || '').trim();
      if (donateSigError(signature) || !/^[A-Za-z0-9_-]{16,64}$/.test(intentId)) return json({ error: 'burn miss' }, 400, allowedOrigin, cred);
      const prior = this.burnReceipts[signature];
      if (prior) {
        if (prior.xId !== xId) return json({ error: 'burn already recorded' }, 409, allowedOrigin, cred);
        return json({ ok: true, replay: true, receipt: {
          signature, mint: FAUCET_MINT, amountRaw: prior.amountRaw, decimals: 6, at: prior.at,
          solscan: `https://solscan.io/tx/${signature}`, points: 0,
        } }, 200, allowedOrigin, cred);
      }
      if (burnReceiptsFull(this.burnReceipts)) return json({ error: 'burn receipt pilot full' }, 503, allowedOrigin, cred);
      const intent = this.burnIntents[intentId];
      const shaped = consumeBurnIntent(intent, { xId, owner: bind.dest }, { now: Number(intent?.issuedAt) });
      if (!shaped.ok) return json({ error: shaped.error || 'invalid burn intent' }, 400, allowedOrigin, cred);
      const intentLock = `intent:${intentId}`;
      const signatureLock = `signature:${signature}`;
      if (this.burnConfirming.has(intentLock) || this.burnConfirming.has(signatureLock)) {
        return json({ error: 'burn confirming' }, 409, allowedOrigin, cred);
      }
      this.burnConfirming.add(intentLock);
      this.burnConfirming.add(signatureLock);
      try {
        let tx;
        try {
          tx = await rpc(this.env, 'getTransaction', [
            signature,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' },
          ]);
        } catch {
          return json({ error: 'burn miss' }, 400, allowedOrigin, cred);
        }
        const inspected = inspectBurnTx(tx, { owner: bind.dest, signature, intentId });
        if (!inspected.ok) return json({ error: inspected.error || 'burn miss' }, 400, allowedOrigin, cred);
        const consumed = consumeBurnIntent(intent, {
          xId,
          owner: bind.dest,
          source: inspected.source,
          mint: FAUCET_MINT,
          amountRaw: String(inspected.amountRaw),
        }, { now: inspected.at });
        if (!consumed.ok) return json({ error: consumed.error }, 400, allowedOrigin, cred);
        const nextIntents = { ...this.burnIntents };
        delete nextIntents[intentId];
        const nextReceipts = { ...this.burnReceipts, [signature]: {
          xId, intentId, amountRaw: String(inspected.amountRaw), at: inspected.at, recordedAt: Date.now(),
        } };
        await this.persistBurnState(nextIntents, nextReceipts);
        return json({ ok: true, replay: false, receipt: {
          signature, mint: FAUCET_MINT, amountRaw: String(inspected.amountRaw), decimals: 6, at: inspected.at,
          solscan: `https://solscan.io/tx/${signature}`, points: 0,
        } }, 200, allowedOrigin, cred);
      } finally {
        this.burnConfirming.delete(intentLock);
        this.burnConfirming.delete(signatureLock);
      }
    }

    if (path.startsWith('/faucet/tx/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const sig = decodeURIComponent(path.slice('/faucet/tx/'.length)).trim();
      const row = this.faucetDonates[sig];
      if (!row) return json({ error: 'not found' }, 404, allowedOrigin, cred);
      return json({ ok: true, signature: sig, at: row.at, dest: row.dest }, 200, allowedOrigin, cred);
    }

    if (path === '/faucet/donate' && request.method === 'POST') {
      const input = await body();
      const sig = String(input.signature || input.sig || '').trim();
      if (donateSigError(sig)) return json(donateFailClosed(input), 200, allowedOrigin, cred);
      const treasury = String(this.env.FAUCET_TREASURY || '').trim() || FAUCET_TREASURY_DEFAULT;
      const mint = String(this.env.MINT || FAUCET_MINT).trim();
      let signer = '';
      try {
        signer = await publicKeyFromSecret(faucetSignerSecret(this.env));
      } catch {
        signer = '';
      }
      let tx;
      try {
        tx = await rpc(this.env, 'getTransaction', [
          sig,
          { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'finalized' },
        ]);
      } catch {
        return json({ error: 'sig miss' }, 200, allowedOrigin, cred);
      }
      const inspected = inspectDonateTx(tx, {
        treasury,
        mint,
        faucetSigner: signer,
        minRaw: 1n,
      });
      if (!inspected.ok) return json({ error: inspected.error || 'sig miss' }, 200, allowedOrigin, cred);
      const amountUi = donateAmountUi(inspected.amountRaw);
      const taped = appendFill(this.faucetTape, {
        sig,
        amountUi,
        at: inspected.at,
        from: inspected.payer,
      });
      if (taped.ok && !taped.replay) {
        this.faucetTape = taped.list;
        await this.persistFaucet();
      }
      const landed = {
        ok: true,
        landed: true,
        awarded: false,
        signature: sig,
        amountRaw: String(inspected.amountRaw),
        amountUi,
        treasury,
        dest: treasury,
        solscan: `https://solscan.io/tx/${sig}`,
        share: `https://www.getdasha.com/faucet/fill/${sig}`,
      };
      const session = await sessionFromRequest(this.env, request);
      if (!session?.xId) return json(landed, 200, allowedOrigin, cred);
      const bind = this.faucetBinds[String(session.xId)];
      if (!bind?.dest || bind.kind !== 'IS_WALLET') {
        return json({ ...landed, error: 'dest not proven' }, 200, allowedOrigin, cred);
      }
      if (inspected.payer !== bind.dest) {
        return json({ ...landed, error: 'dest not proven' }, 200, allowedOrigin, cred);
      }
      if (this.faucetDonates[sig]) {
        const retry = await this.creditDonateToBoard(session, sig, this.faucetDonates[sig]);
        return json({
          ...landed,
          awarded: retry.awarded,
          replay: true,
          points: retry.points,
          donate: retry.donate,
          ...(retry.error ? { error: retry.error } : {}),
        }, 200, allowedOrigin, cred);
      }
      this.faucetDonates[sig] = {
        xId: String(session.xId),
        dest: bind.dest,
        amountRaw: String(inspected.amountRaw),
        at: inspected.at,
      };
      await this.persistFaucet();
      const credit = await this.creditDonateToBoard(session, sig, {
        amountRaw: inspected.amountRaw,
        at: inspected.at,
      });
      return json({
        ...landed,
        awarded: credit.awarded,
        points: credit.points,
        donate: credit.donate,
        ...(credit.error && !credit.awarded ? { error: credit.error } : {}),
      }, 200, allowedOrigin, cred);
    }

    if ((path === '/faucet/withdraw' || path === '/faucet/withdraw/') && (request.method === 'POST' || request.method === 'GET')) {
      const admin = request.headers.get('x-dasha-admin') || request.headers.get('x-dasha-internal') || '';
      if (!faucetAdminOk(this.env, admin)) {
        return json({ error: 'not_configured' }, 401, allowedOrigin, cred);
      }
      const input = request.method === 'POST' ? await body() : {};
      const broadcast = request.method === 'POST' && (input.broadcast === true || input.dry === false);
      let tipWallet = String(this.env.FAUCET_TREASURY || '').trim();
      try {
        tipWallet = await publicKeyFromSecret(faucetSignerSecret(this.env));
      } catch {
        return json({ error: 'not_configured', dest: FAUCET_WITHDRAW_DEST }, 501, allowedOrigin, cred);
      }
      const mint = String(this.env.MINT || FAUCET_MINT).trim();
      let solLamports = 0n;
      let tokenRaw = 0n;
      try {
        const bal = await rpc(this.env, 'getBalance', [tipWallet]);
        solLamports = BigInt(typeof bal === 'object' && bal != null ? (bal.value ?? bal) : bal || 0);
        tokenRaw = await tokenBalanceRaw(this.env, tipWallet, mint);
      } catch {
        return json({ error: 'rpc_unavailable', dest: FAUCET_WITHDRAW_DEST }, 503, allowedOrigin, cred);
      }
      const plan = planTreasuryWithdraw({
        solLamports,
        tokenRaw,
        dest: FAUCET_WITHDRAW_DEST,
      });
      if (!broadcast) {
        return json({
          ...plan,
          dryRun: true,
          broadcast: false,
          treasury: tipWallet,
          mint,
        }, plan.ok || plan.error === 'treasury_rent' || plan.error === 'treasury_empty' ? 200 : 400, allowedOrigin, cred);
      }
      const sent = await sendTreasuryWithdraw(this.env, {
        dest: FAUCET_WITHDRAW_DEST,
        broadcast: true,
        dryRun: false,
      });
      return json(sent, sent.ok ? 200 : 503, allowedOrigin, cred);
    }

    return json({ error: 'not found' }, 404, allowedOrigin, cred);
  }

  async fetch(request) {
    const origin = request.headers.get('Origin');
    const allowedOrigin =
      origin && originAllowed(origin, this.env.ALLOWED_ORIGINS || '')
        ? origin
        : this.env.ALLOW_ANY_ORIGIN
          ? origin || '*'
          : null;
    return this.handleFaucet(request, allowedOrigin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return new Response(null, {
        status: 308,
        headers: { Location: url.href, 'Cache-Control': 'public, max-age=3600' },
      });
    }
    const potter308 = potterHome308Response(request, url);
    if (potter308) return potter308;
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/privacy' || url.pathname === '/privacy/')) {
      return privacyPageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/contribute' || url.pathname === '/contribute/')) {
      return contributePageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isComputeSkillPath(url.pathname)) {
      return computeSkillResponse(request, url.pathname);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isComputePagePath(url.pathname)) {
      return computePageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/dasha-compute-open-alpha.tar.gz') {
      return computeKitResponse(request, env);
    }
    if (url.pathname.startsWith('/crew/api/')) {
      if (env?.LOBBY) {
        const stub = env.LOBBY.get(env.LOBBY.idFromName('public'));
        if (stub) return stub.fetch(request);
      }
      const response = await crewApi(request, env);
      if (response) return response;
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && isCrewPagePath(url.pathname)) {
      return crewPageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/dasha-crew.tar.gz') {
      return crewKitResponse(request, env);
    }
    const digestRes = await digestEdge(request, env);
    if (digestRes) return digestRes;
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/manifest.json' || url.pathname === '/manifest.webmanifest')) {
      return manifestJsonResponse(request);
    }
    if (isRetiredStudioPath(url.pathname)) return retiredStudioResponse(request);
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/ai.txt') {
      return new Response(request.method === 'HEAD' ? null : AI_TXT, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'Strict-Transport-Security': 'max-age=31536000',
          'X-Content-Type-Options': 'nosniff',
          'X-Dasha-Edge': 'ai',
        },
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') && url.pathname === '/.well-known/grok-bot.json') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
      return grokBotWellKnownResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/factory.json' || url.pathname === '/factory.json/')) {
      return factoryCatalogResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/llms.txt') {
      return new Response(request.method === 'HEAD' ? null : LLMS_TXT, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'Strict-Transport-Security': 'max-age=31536000',
          'X-Content-Type-Options': 'nosniff',
          'X-Dasha-Edge': 'llms',
        },
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/llms-full.txt') {
      return new Response(request.method === 'HEAD' ? null : LLMS_FULL_TXT, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'Strict-Transport-Security': 'max-age=31536000',
          'X-Content-Type-Options': 'nosniff',
          'X-Dasha-Edge': 'llms-full',
        },
      });
    }
    if (isBagRecordPath(url.pathname)) {
      return bagRecordApi(request, env);
    }
    if (isFaucetTapePath(url.pathname)) {
      if (env?.FAUCET) {
        try {
          const stub = env.FAUCET.get(env.FAUCET.idFromName('main'));
          if (stub) return stub.fetch(request);
        } catch {}
      }
      return tapeApi(request, []);
    }
    if (isBareFaucetFillPath(url.pathname) || isFaucetFillPath(url.pathname)) {
      if (env?.FAUCET) {
        try {
          const stub = env.FAUCET.get(env.FAUCET.idFromName('main'));
          if (stub) return stub.fetch(request);
        } catch {}
      }
      return fillShareApi(request, []);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/which') {
      return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(WHICH_HTML), {
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Dasha-Edge': 'which',
          Link: LLMS_DESCRIBEDBY,
        }),
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/bag' || url.pathname === '/bag/')) {
      const rawMint = url.searchParams.get('mint');
      let html = BAG_HTML;
      if (rawMint != null && String(rawMint).trim()) {
        const mint = normalizeMint(rawMint);
        if (mint) {
          const found = await lookupRecord(mint, env?.fetch || globalThis.fetch);
          html = renderBagShareHtml(BAG_HTML, mint, found);
        } else {
          html = renderBagShareHtml(BAG_HTML, String(rawMint).trim(), { status: 400, body: { error: 'bad mint' } });
        }
      }
      return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(html), {
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': rawMint != null && String(rawMint).trim() ? 'no-store' : 'public, max-age=300',
          'X-Dasha-Edge': 'bag',
          Link: LLMS_DESCRIBEDBY,
        }),
      });
    }
    if (isProductHost(url.hostname)) {
      return productEdge(request, url, env);
    }

    const origin = request.headers.get('Origin');
    const allowedOrigin =
      origin && originAllowed(origin, env.ALLOWED_ORIGINS || '')
        ? origin
        : env.ALLOW_ANY_ORIGIN
          ? origin || '*'
          : null;

    if (request.method === 'OPTIONS' && url.pathname === '/auth/grok/verify') {
      return new Response(null, {
        status: 204,
        headers: {
          ...SECURITY,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'OPTIONS') {
      if (!allowedOrigin && !env.ALLOW_ANY_ORIGIN) {
        return new Response(null, { status: 403, headers: SECURITY });
      }
      return new Response(null, {
        status: 204,
        headers: { ...SECURITY, ...corsHeaders(allowedOrigin || '*', { credentials: true }) },
      });
    }

    if (isComputeApiPath(url.pathname)) {
      const response = await computeApi(request, env, allowedOrigin);
      if (response) return response;
    }

    if (isComputeOcmPath(url.pathname)) {
      const ocmRes = await proxyComputeOcm(request);
      if (ocmRes) return ocmRes;
    }

    if (url.pathname.startsWith('/crew/api/')) {
      if (env?.LOBBY) {
        const stub = env.LOBBY.get(env.LOBBY.idFromName('public'));
        if (stub) return stub.fetch(request);
      }
      const response = await crewApi(request, env);
      if (response) return response;
    }

    if (url.pathname === '/auth/status' && request.method === 'GET') {
      const session = await authSessionFromRequest(env, request);
      const wallet = session?.provider === 'wallet' ? session.wallet : '';
      return json({
        loggedIn: Boolean(session),
        provider: session?.provider || null,
        x: session?.provider === 'x' ? publicLink(session) : null,
        wallet: wallet ? { address: wallet, display: `${wallet.slice(0, 4)}…${wallet.slice(-4)}` } : null,
        grok: session?.provider === 'grok' ? { display: session.displayName || 'Grok Bot' } : null,
      }, 200, allowedOrigin, { credentials: true });
    }

    if (url.pathname === '/auth/logout') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, allowedOrigin, { credentials: true });
      if (!allowedOrigin) return json({ error: 'origin required' }, 403, null);
      return json({ ok: true, loggedIn: false }, 200, allowedOrigin, {
        credentials: true,
        headers: { 'Set-Cookie': cookieHeader('', { clear: true }) },
      });
    }

    if (url.pathname.startsWith('/oauth/github')) {
      return handleGithubOAuth(request, env, allowedOrigin);
    }

    if (url.pathname.startsWith('/oauth/x')) {
      const oauthRes = await handleOAuth(request, env, allowedOrigin);
      if (oauthRes) return oauthRes;
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/login' || url.pathname === '/login/')) {
      return loginPageResponse(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/.well-known/security.txt') {
      return securityTxtResponse(request, url.hostname);
    }

    const lobbySimpOg = await simpOgResponse(request, url, env);
    if (lobbySimpOg) return lobbySimpOg;
    const lobbyAsset = await workerStaticAssetResponse(request, url, env);
    if (lobbyAsset) return lobbyAsset;

    if (url.pathname.startsWith('/faucet/') && url.pathname !== '/faucet/') {
      if (request.method !== 'GET' && request.method !== 'HEAD' && !allowedOrigin && !env.ALLOW_ANY_ORIGIN) {
        return json({ error: 'origin required' }, 403, null);
      }
      const dest = new URL(request.url);
      dest.pathname = dest.pathname.replace(/\/+$/, '') || '/';
      const forwarded = dest.href === request.url ? request : new Request(dest, request);
      const id = env.FAUCET.idFromName('main');
      return env.FAUCET.get(id).fetch(forwarded);
    }

    // Bare /simp is the board page. /simp/* APIs still go to the lobby DO below.
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/simp' || url.pathname === '/simp/')) {
      const dest = challengeRedirectPath(url.searchParams);
      if (dest) return Response.redirect(`https://www.getdasha.com${dest}`, 308);
      const board = request.method === 'GET' ? await publicSimpMembers(env).catch(() => null) : null;
      return new Response(request.method === 'HEAD' ? null : servedSimpPageHtml({ board: board ? { editorial: [publicPerryRow()], measured: board } : undefined }), {
        status: 200,
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
          'X-Dasha-Edge': 'simp',
        }),
      });
    }

    if (
      url.pathname.startsWith('/simp/') ||
      url.pathname.startsWith('/auth/wallet/') ||
      url.pathname.startsWith('/auth/grok/') ||
      url.pathname.startsWith('/studio/') ||
      url.pathname.startsWith('/h/') ||
      (url.pathname.startsWith('/forum/') && url.pathname !== '/forum/') ||
      (url.pathname.startsWith('/chess/') && url.pathname !== '/chess/')
    ) {
      if (url.pathname !== '/auth/grok/verify' && request.method !== 'GET' && request.method !== 'HEAD' && origin && !allowedOrigin && !env.ALLOW_ANY_ORIGIN) {
        return json({ error: 'origin not allowed' }, 403, null);
      }
      const room = env.LOBBY.idFromName('public');
      const stub = env.LOBBY.get(room);
      return stub.fetch(request);
    }

    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      (url.pathname === '/client/lobby.js' || url.pathname === '/client/lobby-client.js')
    ) {
      return jsAsset(LOBBY_CLIENT_JS, allowedOrigin || '*', { headOnly: request.method === 'HEAD' });
    }
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      (url.pathname === '/client/simp-board.js' || url.pathname === '/client/simp-board-client.js')
    ) {
      return jsAsset(SIMP_BOARD_JS, allowedOrigin || '*', { headOnly: request.method === 'HEAD' });
    }
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname === '/client/faucet.js'
    ) {
      return jsAsset(FAUCET_CLIENT_JS, allowedOrigin || '*', { headOnly: request.method === 'HEAD' });
    }
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname === '/client/x-connect.js'
    ) {
      return jsAsset(String(X_CONNECT_JS).replaceAll('#simp', '#chess-stage'), allowedOrigin || '*', { headOnly: request.method === 'HEAD' });
    }
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname === '/client/chess-local.js'
    ) {
      return jsAsset(CHESS_LOCAL_JS, allowedOrigin || '*', { headOnly: request.method === 'HEAD' });
    }

    // SEO + howto: also routed on www/apex getdasha.com (see dasha-lobby-wrangler.jsonc).
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/robots.txt') {
      return new Response(request.method === 'HEAD' ? null : stripRobotsLecture(ROBOTS_TXT), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Robots-Tag': 'all',
        },
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/sitemap.xml') {
      return new Response(request.method === 'HEAD' ? null : SITEMAP_XML, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && /^\/bounties\.json\/?$/.test(url.pathname)) {
      return bountiesFeedResponse(request);
    }
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      (url.pathname === '/how-to-buy' || url.pathname === '/how-to-buy/')
    ) {
      return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(polishHowtoHtml(HOWTO_HTML)), {
        status: 200,
        headers: htmlLlmsHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
        }),
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/chess' || url.pathname === '/chess/')) {
      const html = await chessPageForRequest(request, env);
      return new Response(request.method === 'HEAD' ? null : html, {
        status: 200,
        headers: chessPageHeaders({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120', 'X-Dasha-Edge': 'chess' }, url.searchParams.get('embed') === '1'),
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && RETIRED_SEO_PATHS.has(url.pathname)) {
      return Response.redirect('https://www.getdasha.com/', 308);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/desk' || url.pathname === '/desk/')) {
      return Response.redirect('https://www.getdasha.com/how-to-buy', 308);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && ['/how','/how/','/howto','/howto/','/how-to','/how-to/','/howtobuy','/howtobuy/','/buy','/buy/'].includes(String(url.pathname || '').toLowerCase())) {
      return Response.redirect('https://www.getdasha.com/how-to-buy', 308);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/quiz' || url.pathname === '/quiz/')) {
      return Response.redirect('https://www.getdasha.com/simp', 308);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/faucet' || url.pathname === '/faucet/')) {
      return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(FAUCET_PAGE_HTML), {
        status: 200,
        headers: htmlLlmsHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
          'X-Dasha-Edge': 'faucet',
        }),
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/lobby' || url.pathname === '/lobby/')) {
      let html = asStandaloneLobbyPage(LOBBY_PAGE_HTML);
      try { html = applyDigestTape(html, (await publicDigest(env)).items); } catch {}
      return new Response(request.method === 'HEAD' ? null : attachLlmsHtmlLinks(injectXConnectPrompt(polishServedSlim(html))), {
        status: 200,
        headers: htmlLlmsHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
          'X-Dasha-Edge': 'lobby-page',
        }),
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/simp' || url.pathname === '/simp/')) {
      const dest = challengeRedirectPath(url.searchParams);
      if (dest) return Response.redirect(`https://www.getdasha.com${dest}`, 308);
      const board = request.method === 'GET' ? await publicSimpMembers(env).catch(() => null) : null;
      return new Response(request.method === 'HEAD' ? null : servedSimpPageHtml({ board: board ? { editorial: [publicPerryRow()], measured: board } : undefined }), {
        status: 200,
        headers: htmlHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=120',
          'X-Dasha-Edge': 'simp',
        }),
      });
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/bounties' || url.pathname === '/bounties/')) {
      return bountiesPageResponse(request);
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json(
        {
          ok: true,
          service: 'dasha-lobby',
          mint: MINT,
          pin: PIN.text,
          room: 'public',
          maxSockets: MAX_SOCKETS,
          softCapAnon: ANON_SOFT_CAP,
          xLink: xConfigured(env),
          holderRpc: env.SOLANA_RPC_URLS || env.SOLANA_RPC_URL ? 'dedicated' : 'public-fallback',
          assets: ASSET_HASH,
        },
        200,
        allowedOrigin,
      );
    }

    if (request.method === 'GET' && url.pathname === '/capacity') {
      const room = env.LOBBY.idFromName('public');
      const stub = env.LOBBY.get(room);
      const res = await stub.fetch(new Request(new URL('/capacity', request.url), { method: 'GET' }));
      const data = await res.json();
      return json(data, data.full ? 503 : 200, allowedOrigin);
    }

    if (request.method === 'GET' && url.pathname === '/stats') {
      const room = env.LOBBY.idFromName('public');
      const stub = env.LOBBY.get(room);
      const res = await stub.fetch(new Request(new URL('/stats', request.url), { method: 'GET' }));
      const data = await res.json();
      return json(data, 200, allowedOrigin);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/price') {
      const room = env.LOBBY.idFromName('public');
      return env.LOBBY.get(room).fetch(request);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && isForumChatAliasPath(url.pathname)) {
      return forumToLobbyRedirect(url);
    }

    if (url.pathname === '/ws' || url.pathname === '/lobby/ws') {
      const room = env.LOBBY.idFromName('public');
      const stub = env.LOBBY.get(room);
      return stub.fetch(request);
    }

    return json({ error: 'not found' }, 404, allowedOrigin);
  },
};
