/**
 * Dasha Simp Board v1 — pure scoring + public sanitization.
 * X OAuth proves account control only; participation is opt-in.
 * No tokens, wallets, balances, or X numeric IDs in public output.
 */

export const SCHEMA = 'dasha-simp-board/v1';
export const LINKED_X_POINTS = 10;
export const CREATIVE_POINTS = 25;
export const CREATIVE_CAP_28D = 100;
export const COMMUNITY_POINTS = 10;
export const COMMUNITY_CAP_28D = 40;
export const CONNECTOR_ACTIVATION_POINTS = 0;
export const CONNECTOR_CONTRIBUTION_POINTS = 0;
export const CONNECTOR_CAP_28D = 0;
export const OSS_CAP_SEASON = 300;
/* Donate lane (Potter 2026-08-16, last revision on the bus 18:01Z): 1 point per 1,000 $dasha sent to the
   faucet treasury by a SIWS-proven wallet, floor 1,000, 50 points per rolling 7 days. Points are
   computed once at verify time from the on-chain amount; the stored award carries points + tx
   evidence only — never amount, wallet, or balance. */
export const DONATE_UNIT_DASHA = 1000;
export const DONATE_POINTS_PER_UNIT = 1;
export const DONATE_CAP_7D = 50;
export const DONATE_ROLLING_MS = 7 * 24 * 60 * 60 * 1000;
/* Burn lane: same whole-token math as donations, but a lower weekly cap so irreversible supply
   reduction can unlock Spotlight without turning the Board into an uncapped purchase ladder. */
export const BURN_UNIT_DASHA = 1000;
export const BURN_POINTS_PER_UNIT = 1;
export const BURN_CAP_7D = 25;
export const BURN_ROLLING_MS = 7 * 24 * 60 * 60 * 1000;
export const DONATE_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const DONATE_TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
export const ROLLING_MS = 28 * 24 * 60 * 60 * 1000;
export const PUBLIC_BOARD_LIMIT = 50;
export const OSS_SCHEMA = 'dasha-simp-oss/v0';
export const QUIZ_VERSION = 'dasha-simp-quiz/v7';
/** Deep scored path: route + 9 lane + 10 shared = 20. */
export const QUIZ_PATH_LENGTH = 20;
/** Quick scored path for invite/viral traffic: route + 4 lane + 5 shared = 10. */
export const QUIZ_QUICK_LENGTH = 10;
/** Full bank practice length (unused in product; kept for branch tests). */
export const QUIZ_PRACTICE_LENGTH = 24;
export const QUIZ_MAX_POINTS = 60;
/** Soft ±vibe on quiz points so the formula is not a pure spreadsheet. */
export const QUIZ_VIBE_RANGE = 8;
export const QUIZ_LANES = ['Cinema obsessive', 'Podcast casualty', 'Dasha archaeologist'];
const q = (id, prompt, choices, answer, next, note, source, extra = {}) => ({
  id,
  prompt,
  choices,
  answer,
  next,
  note,
  source,
  ...extra,
});
const SOURCE = {
  kim: 'https://letterboxd.com/kimsvideo/story/dasha-nekrasova-visits-kims-video-collection/',
  criterion: 'https://www.criterion.com/current/posts/7281-berlinale-2021-lineup',
  lat: 'https://www.latimes.com/entertainment-arts/movies/story/2021-03-02/scary-of-sixty-first-jeffrey-epstein-conspiracy-dasha-nekrasova',
  screen: 'https://www.screendaily.com/features/word-of-mouth-succession-actress-dasha-nekrasova-im-not-allowed-to-shitpost-anymore/5168430.article',
  interview: 'https://www.interviewmagazine.com/film/dasha-nekrasova-softness-of-bodies-amazon',
  pod: 'https://redscarepodcast.libsyn.com/summer-dress-sadness',
  coming: 'https://www.comingsoon.net/movies/features/1205998-dasha-nekrasova-scary-of-sixty-first-interview',
  raskin: 'https://www.maxraskin.com/interviews/dasha-nekrasova',
  x: 'https://x.com/dash_eats',
  materialists: 'https://www.dazeddigital.com/life-culture/article/68407/1/materialists-zeitgeisty-drama-love-capitalism-celine-song-interview-film',
  wobble: 'https://www.nytimes.com/2018/10/04/movies/wobble-palace-review.html',
  podDunkin: 'https://podscripts.co/podcasts/red-scare/pick-me-princess',
  podYale: 'https://podscripts.co/podcasts/red-scare/that-whole-yale-thing',
  podChess: 'https://podscripts.co/podcasts/red-scare/nepo-baby-its-cold-outside',
  podThings: 'https://podscripts.co/podcasts/red-scare/pod-things',
  pod400: 'https://podscripts.co/podcasts/red-scare/mentally-challengeders',
  podRecent: 'https://podscripts.co/podcasts/red-scare/slopsara',
  saturday: 'https://www.thesaturdaypaper.com.au/culture/film/2021/08/07/gonzo-director-and-actor-dasha-nekrasova/162825840012205',
  bio: 'https://en.wikipedia.org/wiki/Dasha_Nekrasova',
  site: 'https://www.getdasha.com/',
};
const routes = {
  cinema: [
    ['debut','Her feature directorial debut?',['The Scary of Sixty-First','Materialists','The Sweet East'],0,'Criterion calls it her first feature.',SOURCE.criterion],
    ['materialistsdays','How many days did Dasha spend on the Materialists set?',['two','twelve','twenty'],0,'Celine Song said the role took two shooting days.',SOURCE.materialists],
    ['wobbleweekend','Wobble Palace splits one unhappy couple across which weekend?',['New Year’s 2017','Halloween 2016','Valentine’s 2018'],1,'Jane and Eugene divide Halloween weekend 2016.',SOURCE.wobble],
    ['videostore','A cinema simp recognizes her pilgrimage to…',["Kim’s Video",'Blockbuster Bend','The Criterion Closet'],0,"She visited Kim’s legendary collection in Sicily.",SOURCE.kim],
    ['horrorpair','Pick the exact favorite-horror double answer.',['Scream + Saw',"The Exorcist + Rosemary’s Baby",'Alien + Jaws'],1,'Asked for one, she named two. Naturally.',SOURCE.raskin],
    ['comfry','Her Succession character?',['Comfry','Shiv','Tabitha'],0,'Dasha played Comfry in Succession.',SOURCE.screen],
    ['apartment','Its central discovery hides in…',['a video store','an Upper East Side apartment','a podcast studio'],1,'Two roommates find their apartment has a dark secret.',SOURCE.criterion],
    ['horror','Her earliest movie fixation?',['horror','westerns','sports films'],0,'She told Kim’s Video she loved horror very young.',SOURCE.kim],
    ['mst3k','She tried to impress a crush by liking…',['Twin Peaks','Mystery Science Theater 3000','The Simpsons'],1,'Extremely specific lore, directly from her Kim’s Video visit.',SOURCE.kim],
    ['kubrick','She described the film as a kind of love letter to…',['Kubrick','Spielberg','Tarantino'],0,'The film’s visual worldview drew on Stanley Kubrick.',SOURCE.lat],
    ['cowriter','Who co-wrote the film?',['Celine Song','Madeline Quinn','Anna Khachiyan'],1,'Madeline Quinn co-wrote and co-starred.',SOURCE.screen],
    ['dreams','She said filmmaking draws on instinct and…',['spreadsheets','dreams and the subconscious','focus groups'],1,'The opposite of committee-made cinema.',SOURCE.screen],
    ['softness','She also directed…',['The Softness of Bodies','Barbie','Everything Everywhere'],0,'Another film credit in the public record.',SOURCE.interview],
    ['festival','Scary of Sixty-First premiered in the orbit of…',['Berlinale','Cannes Un Certain Regard','Sundance midnight'],0,'It hit the Berlinale conversation in 2021.',SOURCE.criterion],
  ],
  podcast: [
    ['cohost','Her Red Scare co-host?',['Anna Khachiyan','Chloë Sevigny','Hari Nef'],0,'Anna and Dasha host together.',SOURCE.pod],
    ['dunkinprice','Dasha’s on-air Dunkin avocado toast cost…',['$2.10','$3.40','$6.75'],1,'The Pick Me Princess receipt was $3.40.',SOURCE.podDunkin],
    ['yaleclaim','After her Yale debate, Dasha’s immediate verdict?',['I won','Never again','It was a draw'],0,'She opened the recap with “I won.”',SOURCE.podYale],
    ['chesstreak','On the Christmas episode, the chess fixation count was…',['70','over 700','about 7,000'],1,'More than 700 games in six-to-eight weeks.',SOURCE.podChess],
    ['eyebrows','What had recently been bleached on Pod Things?',['eyebrows','a denim jacket','hair ends'],0,'The eyebrows were already returning to normal.',SOURCE.podThings],
    ['episode400','Around episode 400, the hosts estimated they had recorded…',['60 hours','600 hours','6,000 hours'],1,'Their back-of-envelope total was about 600 hours.',SOURCE.pod400],
    ['mjvibe','In a recent episode, Dasha said she vibed with Michael Jackson’s…',['persona more than the music','chess openings','film criticism'],0,'Recent lore: persona first, music “whatever.”',SOURCE.podRecent],
    ['onlineyoung','Before podcasting, teenage Dasha was already…',['on message boards','running a film festival','hosting sports radio'],0,'She described herself as very online even then.',SOURCE.interview],
    ['firstrole','Her first acting role was in…',['a Broadway musical','a music video','a USC student film'],2,'A student film at USC.',SOURCE.interview],
    ['headline','A Screen Daily headline says she is no longer allowed to…',['direct','shitpost','watch horror'],1,'The headline is part of the lore.',SOURCE.screen],
    ['feed','Where does the show actually live as audio?',['Libsyn feed','Spotify exclusive only','Clubhouse rooms'],0,'Public Libsyn listing is a clean source.',SOURCE.pod],
    ['tone','The show’s default register is…',['earnest TED talk','deadpan cultural roast','sports radio'],1,'Irony is the house style.',SOURCE.pod],
  ],
  lore: [
    ['sailoryear','“Sailor Socialism” went viral in…',['2016','2018','2020'],1,'The InfoWars encounter broke through in 2018.',SOURCE.interview],
    ['sailorlook','The viral interview outfit was a…',['sailor fuku','power suit','cowboy costume'],0,'The sailor look supplied the nickname.',SOURCE.bio],
    ['sailorline','Finish the line: “All I want is…”',['a film deal, honey','another podcast, honey','free healthcare, honey'],2,'The line became part of the original viral clip.',SOURCE.interview],
    ['birthcity','Dasha was born in…',['Riga','Minsk','Kyiv'],1,'Minsk, in what was then the Byelorussian SSR.',SOURCE.bio],
    ['parents','Her parents’ performance backgrounds?',['opera singer + pianist','actors + dancers','rhythmic gymnast + acrobat'],2,'Her mother trained in rhythmic gymnastics; her father was an acrobat.',SOURCE.saturday],
    ['artschool','Her Las Vegas high school specialized in…',['computer science','performing arts','competitive swimming'],1,'She attended a performing-arts academy downtown.',SOURCE.saturday],
    ['college','She graduated from…',['Mills College','NYU Tisch','Yale'],0,'Mills College.',SOURCE.bio],
    ['studies','At Mills, she studied…',['film production','economics and statistics','sociology and philosophy'],2,'Her degree work centered sociology and philosophy.',SOURCE.bio],
    ['klaasje','Her original Disco Elysium voice role?',['Kim Kitsuragi','Klaasje','Cuno'],1,'She voiced Klaasje in the original release.',SOURCE.bio],
    ['comfrylore','On Succession she played…',['Shiv','Naomi','Comfry'],2,'Kendall’s PR adviser Comfry.',SOURCE.screen],
    ['vegaslore','She grew up outside…',['Las Vegas','Boston','Miami'],0,'Her family settled around Las Vegas.',SOURCE.interview],
    ['messageboards','Teenage Dasha spent serious time on…',['sports radio','message boards','cooking forums'],1,'She described herself as very online early.',SOURCE.interview],
  ],
};
const shared = [
  ['latehost','As a kid, she wanted to appear on…',['Oprah','SNL','Letterman'],2,'She specifically named David Letterman.',SOURCE.interview],
  ['softnessrole','In The Softness of Bodies she plays…',['Charlotte','Jane','Daisy'],0,'Charlotte is the film’s drifting poet.',SOURCE.interview],
  ['wobblecharacter','Dasha’s Wobble Palace character is named…',['Daisy','Jane','Comfry'],1,'Jane gets her half of the Halloween weekend.',SOURCE.wobble],
  ['materialistsrole','In Materialists, Dasha plays…',['Daisy','Lucy','Sophie'],0,'Daisy works with Lucy at the matchmaking agency.',SOURCE.materialists],
  ['yaleargument','At Yale, she argued in favor of…',['mandatory consensus','abolishing debate','polarization'],2,'Her stated case: depolarization was boring.',SOURCE.podYale],
  ['tenant','The clearest storytelling reference for her first feature?',['The Shining','Suspiria','The Tenant'],2,'She called The Tenant the most overt reference.',SOURCE.coming],
  ['sequels','Which sequel did she single out for playful irony?',['Jaws 2','Texas Chainsaw Massacre 2','Halloween II'],1,'She liked its humor and sense of play.',SOURCE.coming],
  ['franchise','Which horror franchise did she call herself a big fan of?',['Final Destination','The Purge','Nightmare on Elm Street'],2,'Nightmare on Elm Street was one of several favorites she named.',SOURCE.coming],
  ['vegas','She grew up in suburbs outside…',['Las Vegas','Boston','Miami'],0,'A small biographical detail from her own interview.',SOURCE.interview],
  ['teen','As a teenager she spent a lot of time…',['playing varsity tennis','posting on message boards','making cooking videos'],1,'She described herself as very online even then.',SOURCE.interview],
  ['western','Her first acting role was a student film described as a…',['courtroom drama','silent musical','post-apocalyptic Western'],2,'A USC student film with an unusually memorable premise.',SOURCE.interview],
  ['account','The canonical source account?',['@dash_eats','@getdasha','@dashaofficial'],0,'Use the actual public account.',SOURCE.x],
];
const bank = new Map();
bank.set(
  'route',
  q(
    'route',
    'Pick your strongest lane.',
    ['Cinema', 'Podcast', 'Personal + internet lore'],
    null,
    ['cinema-0', 'podcast-0', 'lore-0'],
    'Route set. Surprises await.',
    SOURCE.site,
    { surprise: 'lane-pick', stinger: 'Pick a personality. The algorithm is watching respectfully.' },
  ),
);
for (const [route, rows] of Object.entries(routes)) {
  rows.forEach(([id, prompt, choices, answer, note, source], i) => {
    bank.set(
      `${route}-${i}`,
      q(id, prompt, choices, answer, i === rows.length - 1 ? 'shared-0' : `${route}-${i + 1}`, note, source),
    );
  });
}
shared.forEach(([id, prompt, choices, answer, note, source], i) => {
  bank.set(
    `shared-${i}`,
    q(id, prompt, choices, answer, i === shared.length - 1 ? null : `shared-${i + 1}`, note, source),
  );
});
export const QUIZ_QUESTIONS = [...bank.values()];
/** Local photos under /simp/photo/* (worker assets). */
const VISUALS = {
  // Early-lane stills so Quick 10Q always shows photos before the shared block.
  debut: '/simp/photo/bull.jpg',
  videostore: '/simp/photo/archive.jpg',
  materialistsdays: '/simp/photo/sweet.jpg',
  dunkinprice: '/simp/photo/media.jpg',
  sailoryear: '/simp/photo/chart.jpg',
  mst3k: '/simp/photo/weekend.jpg',
  cohost: '/simp/photo/profile.jpg',
  softness: '/simp/photo/hero.jpg',
  sailorlook: '/simp/photo/profile.jpg',
  klaasje: '/simp/photo/archive.jpg',
  latehost: '/simp/photo/press.jpg',
  softnessrole: '/simp/photo/hero.jpg',
  wobblecharacter: '/simp/photo/public.jpg',
  materialistsrole: '/simp/photo/sweet.jpg',
  account: '/simp/photo/archive.jpg',
};
for (const question of QUIZ_QUESTIONS) {
  if (VISUALS[question.id]) question.image = VISUALS[question.id];
}
/** Fun mid-quiz stickers keyed by question id (client may show as overlay). */
export const QUIZ_SURPRISES = {
  dunkinprice: { kind: 'receipt', title: '$3.40 RECEIPT', body: 'Adequate. Functional. Canonical.' },
  yaleclaim: { kind: 'sticker', title: 'IVY LEAGUE ERA', body: 'Meeting adjourned.' },
  chesstreak: { kind: 'streak', title: '700+ GAMES', body: 'Impulse control through total fixation.' },
  materialistsdays: { kind: 'receipt', title: 'TWO-DAY ROLE', body: 'A real simp reads the production footnotes.' },
  mst3k: { kind: 'photo-drop', title: 'Deep cut unlocked', body: 'Kim’s Video energy. Respect.' },
  sailorline: { kind: 'sticker', title: 'SAILOR SOCIALISM', body: 'The original viral line.' },
  klaasje: { kind: 'sticker', title: 'MARTINAISE LORE', body: 'Original-release voice credit.' },
  comfry: { kind: 'photo-drop', title: 'Succession cameo', body: 'Comfry era activated.' },
};
export const BADGES = new Set(['linked', 'maker', 'remixer', 'helper', 'lobby_regular', 'maintainer', 'holder']);

const EVIDENCE_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'getdasha.com', 'www.getdasha.com']);

/** Sources that award zero points in v1 (public rules). */
export const ZERO_POINT_SOURCES = [
  'follower count',
  'verification tier',
  'likes',
  'reposts',
  'replies',
  'chat messages',
  'referrals',
  'purchases',
  'token balances',
  'bag size',
  'payments for goods or access',
];

export const SIMP_SPOTLIGHT_UNLOCK = 25;

/** One earned outbound link, restricted to recognizable profile hosts. Never fetched server-side. */
export function normalizeSimpSpotlight(raw) {
  const value = String(raw || '').trim();
  if (!value) return { ok: true, spotlight: null };
  if (value.length > 300) return { ok: false, error: 'link is too long' };
  let url;
  try { url = new URL(value); } catch { return { ok: false, error: 'invalid link' }; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    return { ok: false, error: 'use a clean https profile link' };
  }
  const host = url.hostname.toLowerCase();
  if (host === 'github.com' || host === 'www.github.com') {
    const match = url.pathname.match(/^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/?$/);
    const reserved = ['settings', 'login', 'features', 'marketplace', 'explore', 'topics'];
    if (!match || match[1].includes('--') || reserved.includes(match[1].toLowerCase())) return { ok: false, error: 'use a GitHub profile link' };
    return { ok: true, spotlight: { platform: 'GitHub', url: `https://github.com/${match[1]}` } };
  }
  if (host === 'youtube.com' || host === 'www.youtube.com') {
    const match = url.pathname.match(/^\/@([A-Za-z0-9._-]{3,30})\/?$/);
    if (!match) return { ok: false, error: 'use a YouTube handle link' };
    return { ok: true, spotlight: { platform: 'YouTube', url: `https://www.youtube.com/@${match[1]}` } };
  }
  if (host === 'twitch.tv' || host === 'www.twitch.tv') {
    const match = url.pathname.match(/^\/([A-Za-z0-9_]{4,25})\/?$/);
    const reserved = ['directory', 'downloads', 'jobs', 'settings', 'subscriptions', 'videos'];
    if (!match || reserved.includes(match[1].toLowerCase())) return { ok: false, error: 'use a Twitch channel link' };
    return { ok: true, spotlight: { platform: 'Twitch', url: `https://www.twitch.tv/${match[1].toLowerCase()}` } };
  }
  if (host === 'bsky.app') {
    const match = url.pathname.match(/^\/profile\/([^/]+)\/?$/);
    const handle = String(match?.[1] || '').toLowerCase();
    const valid = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/.test(handle);
    if (!valid || handle.length > 253) return { ok: false, error: 'use a Bluesky profile link' };
    return { ok: true, spotlight: { platform: 'Bluesky', url: `https://bsky.app/profile/${handle}` } };
  }
  if (host === 'linkedin.com' || host === 'www.linkedin.com') {
    const match = url.pathname.match(/^\/in\/([A-Za-z0-9](?:[A-Za-z0-9-]{1,98}[A-Za-z0-9]))\/?$/);
    if (!match) return { ok: false, error: 'use a LinkedIn public profile link' };
    return { ok: true, spotlight: { platform: 'LinkedIn', url: `https://www.linkedin.com/in/${match[1].toLowerCase()}` } };
  }
  if (host === 'instagram.com' || host === 'www.instagram.com') {
    const match = url.pathname.match(/^\/([A-Za-z0-9_](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9_])?)\/?$/);
    const reserved = ['about', 'accounts', 'api', 'challenge', 'developer', 'developers', 'direct', 'explore', 'legal', 'oauth', 'p', 'privacy', 'reel', 'reels', 'stories', 'tags', 'tv', 'web'];
    if (!match || match[1].includes('..') || reserved.includes(match[1].toLowerCase())) return { ok: false, error: 'use an Instagram profile link' };
    return { ok: true, spotlight: { platform: 'Instagram', url: `https://www.instagram.com/${match[1].toLowerCase()}` } };
  }
  if (host === 'farcaster.xyz' || host === 'www.farcaster.xyz') {
    const match = url.pathname.match(/^\/([a-z0-9][a-z0-9-]{0,15}(?:\.eth)?)\/?$/i);
    const reserved = ['settings', 'miniapps', 'login-desktop', 'login-mobile', 'login-wallet', 'login-web'];
    if (!match || reserved.includes(match[1].toLowerCase())) return { ok: false, error: 'use a Farcaster profile link' };
    return { ok: true, spotlight: { platform: 'Farcaster', url: `https://farcaster.xyz/${match[1].toLowerCase()}` } };
  }
  if (host === 'tiktok.com' || host === 'www.tiktok.com') {
    const match = url.pathname.match(/^\/@([A-Za-z0-9_](?:[A-Za-z0-9._]{0,22}[A-Za-z0-9_])?)\/?$/);
    if (!match || match[1].includes('..')) return { ok: false, error: 'use a TikTok creator profile link' };
    return { ok: true, spotlight: { platform: 'TikTok', url: `https://www.tiktok.com/@${match[1].toLowerCase()}` } };
  }
  return { ok: false, error: 'use a GitHub, YouTube, Twitch, Bluesky, LinkedIn, Instagram, Farcaster, or TikTok profile link' };
}

export const PERRY_EDITORIAL = {
  handle: 'perryalpha',
  display: '@PerryALPHA',
  href: 'https://x.com/PerryALPHA',
  badge: 'founding_simp',
  kind: 'editorial',
  measured: false,
  linked: false,
  total: null,
  holder: false,
  basis: 'Editorial founding spot — not a measured interaction rank.',
  evidence_urls: [
    'https://x.com/PerryALPHA/status/2085370284400328784',
    'https://x.com/PerryALPHA/status/2085406351937703996',
  ],
};

export function isValidEvidenceUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 500) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return EVIDENCE_HOSTS.has(host);
  } catch {
    return false;
  }
}

function emptyComponents() {
  return { linked_x: 0, quiz: 0, creative: 0, community: 0, connector: 0, oss: 0, donate: 0, burn: 0, holder: 0 };
}

export const quizPublic = () => ({
  version: QUIZ_VERSION,
  total: QUIZ_PATH_LENGTH,
  quickTotal: QUIZ_QUICK_LENGTH,
  maxPoints: QUIZ_MAX_POINTS,
  modes: ['quick', 'deep'],
});
const publicQuestion = ({ id, prompt, choices, image }) => ({ id, prompt, choices, ...(image ? { image } : {}) });
export function startQuizAttempt({ now = Date.now(), practice = false, mode = 'deep' } = {}) {
  const m = practice ? 'practice' : mode === 'quick' ? 'quick' : 'deep';
  const total = practice ? QUIZ_PRACTICE_LENGTH : m === 'quick' ? QUIZ_QUICK_LENGTH : QUIZ_PATH_LENGTH;
  return {
    version: QUIZ_VERSION,
    current: 'route',
    position: 0,
    correct: 0,
    scorable: 0,
    practice: Boolean(practice),
    mode: m,
    total,
    startedAt: now,
    updatedAt: now,
  };
}
export function questionForAttempt(attempt) {
  const question = attempt?.version === QUIZ_VERSION ? bank.get(attempt.current) : null;
  const total = attempt?.total || QUIZ_PATH_LENGTH;
  return question ? { question: publicQuestion(question), progress: { current: attempt.position + 1, total } } : null;
}
export function answerQuizAttempt(attempt, answer, { now = Date.now() } = {}) {
  const question = attempt?.version === QUIZ_VERSION ? bank.get(attempt.current) : null;
  if (!question || !Number.isInteger(answer) || answer < 0 || answer >= question.choices.length) return { ok: false, status: 400, error: 'invalid quiz answer' };
  const scored = question.answer != null;
  const correct = scored && answer === question.answer;
  let next = Array.isArray(question.next) ? question.next[answer] : question.next;
  // Deep: route + lane 0–8 + shared… = 20. Quick: route + lane 0–3 + shared… = 10.
  if (!attempt.practice) {
    if (attempt.mode === 'quick' && /^(cinema|podcast|lore)-3$/.test(attempt.current)) next = 'shared-0';
    else if (attempt.mode !== 'quick' && /^(cinema|podcast|lore)-8$/.test(attempt.current)) next = 'shared-0';
  }
  // End at advertised length (bank may be longer).
  if (attempt.position + 1 >= (attempt.total || QUIZ_PATH_LENGTH)) next = null;
  const streak = correct ? (Number(attempt.streak) || 0) + 1 : 0;
  const updated = {
    ...attempt,
    ...(question.id === 'route' ? { lane: QUIZ_LANES[answer] } : {}),
    current: next,
    position: attempt.position + 1,
    correct: attempt.correct + (correct ? 1 : 0),
    scorable: attempt.scorable + (scored ? 1 : 0),
    streak,
    bestStreak: Math.max(Number(attempt.bestStreak) || 0, streak),
    updatedAt: now,
  };
  const lead = !scored
    ? 'Lane chosen.'
    : correct
      ? ['Correct. Unfortunate level of recall.', 'Yes, obviously.', 'Correct. You were online.', 'Unhealthy recall. Respect.'][attempt.position % 4]
      : ['Fake lore.', 'No. Too organized.', 'You were not online enough.', 'Timeline amnesia.'][attempt.position % 4];
  const pack = QUIZ_SURPRISES[question.id] || null;
  const surprise =
    pack ||
    (streak >= 3 && correct
      ? { kind: 'streak', title: `${streak} in a row`, body: 'Vibes compounding. Dangerous.' }
      : null) ||
    (question.stinger ? { kind: 'stinger', title: 'Note', body: question.stinger } : null);
  return {
    ok: true,
    attempt: updated,
    done: !next,
    feedback: {
      correct: scored ? correct : null,
      note: `${lead} ${question.note}`,
      source: question.source,
      ...(surprise ? { surprise } : {}),
    },
    ...(next ? questionForAttempt(updated) : {}),
  };
}
export function quizTitle(correct, total = 19) {
  const ratio = total ? correct / total : 0;
  if (ratio === 1) return 'Dasha scholar';
  if (ratio >= .8) return 'Confirmed simp';
  if (ratio >= .6) return 'Deep in the lore';
  if (ratio >= .4) return 'Watching respectfully';
  return 'Dasha curious';
}
export const QUIZ_TITLE_FALLBACK = 'Dasha simp';
const QUIZ_TITLE_PLACEHOLDERS = new Set(['still loading', 'loading', 'untitled', 'null', 'undefined', 'n/a', '—', '-', '...', '…']);
/**
 * Writer-side title guard: a stored result title is either a real quiz title or 'Dasha simp'.
 * Never a placeholder, never empty, never a lane. Callers pass what they have; this decides.
 */
export function storedQuizTitle(title, correct, total) {
  const t = String(title ?? '').trim();
  const norm = t.replace(/[.…\s]+$/, '').toLowerCase();
  if (norm && !QUIZ_TITLE_PLACEHOLDERS.has(norm) && !QUIZ_LANES.includes(t)) return t;
  if (Number.isFinite(Number(total)) && Number(total) > 0 && Number.isFinite(Number(correct))) return quizTitle(Number(correct), Number(total));
  return QUIZ_TITLE_FALLBACK;
}

/**
 * Soft random “vibe” delta so leaderboard quiz points are not a pure correct/total spreadsheet.
 * Bounded ±QUIZ_VIBE_RANGE. Inject `rng` in tests for determinism (e.g. () => 0.5 → near-zero noise).
 */
export function vibeDeltaForAttempt(attempt, { rng = Math.random } = {}) {
  const r = () => {
    const x = Number(rng());
    return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5;
  };
  // Core noise: -4 … +4
  let delta = Math.floor(r() * 9) - 4;
  const scorable = Number(attempt?.scorable) || 0;
  const correct = Number(attempt?.correct) || 0;
  const ratio = scorable ? correct / scorable : 0;
  // Accuracy vibes
  if (ratio >= 0.95) delta += Math.floor(r() * 3) - 1; // -1..+1
  else if (ratio >= 0.8) delta += Math.floor(r() * 2); // 0..1
  else if (ratio <= 0.35) delta += Math.floor(r() * 3) - 2; // -2..0
  // Pace vibes
  const sec = Math.max(0, (Number(attempt?.updatedAt) - Number(attempt?.startedAt)) / 1000);
  if (sec > 0 && sec < 50) delta += Math.floor(r() * 2); // snappy: 0..1
  if (sec > 300) delta -= Math.floor(r() * 2); // slow roast: 0..-1
  // Streak vibes
  const best = Number(attempt?.bestStreak) || 0;
  if (best >= 4) delta += Math.floor(r() * 2); // 0..1
  // Lane spice (tiny, non-obvious)
  const li = QUIZ_LANES.indexOf(attempt?.lane);
  if (li >= 0 && r() > 0.55) delta += li % 2 === 0 ? 1 : -1;
  return Math.max(-QUIZ_VIBE_RANGE, Math.min(QUIZ_VIBE_RANGE, delta));
}

export function vibeNote(delta) {
  if (!delta) return 'Even vibes. Suspicious.';
  if (delta >= 5) return 'Chaotic good vibes (+' + delta + ').';
  if (delta >= 2) return 'Main-character energy (+' + delta + ').';
  if (delta <= -5) return 'Timeline wet blanket (' + delta + ').';
  if (delta <= -2) return 'Slightly offline tax (' + delta + ').';
  return delta > 0 ? 'Soft aura (+' + delta + ').' : 'Soft debuff (' + delta + ').';
}

export function quizResultForAttempt(attempt, { now = Date.now(), rng = Math.random } = {}) {
  const total = Number(attempt?.total) || (attempt?.practice ? QUIZ_PRACTICE_LENGTH : QUIZ_PATH_LENGTH);
  if (
    attempt?.version !== QUIZ_VERSION ||
    attempt.current ||
    attempt.position !== total ||
    attempt.scorable !== total - 1 ||
    attempt.correct < 0 ||
    attempt.correct > attempt.scorable
  ) {
    return null;
  }
  const basePoints = Math.round((attempt.correct / attempt.scorable) * QUIZ_MAX_POINTS);
  const vibe = vibeDeltaForAttempt(attempt, { rng });
  const points = basePoints;
  return {
    version: QUIZ_VERSION,
    correct: attempt.correct,
    total: attempt.scorable,
    points,
    basePoints,
    vibe,
    vibeNote: vibeNote(vibe),
    title: storedQuizTitle(quizTitle(attempt.correct, attempt.scorable), attempt.correct, attempt.scorable),
    lane: attempt.lane,
    mode: attempt.mode === 'quick' ? 'quick' : attempt.practice ? 'practice' : 'deep',
    completedAt: now,
  };
}

/**
 * Sum awards of one kind inside a rolling window, applying per-award and cap rules.
 * Awards are { kind, points, evidenceUrl, at }.
 */
function rollingKindPoints(awards, kind, unitPoints, cap, now) {
  let sum = 0;
  const windowStart = now - ROLLING_MS;
  for (const a of awards) {
    if (a.kind !== kind) continue;
    const at = Number(a.at) || 0;
    if (at < windowStart || at > now) continue;
    if (!isValidEvidenceUrl(a.evidenceUrl)) continue;
    const pts = unitPoints;
    if (sum + pts > cap) {
      sum = cap;
      break;
    }
    sum += pts;
  }
  return sum;
}

/**
 * OSS points: externally computed (dasha-simp-oss/v0), season cap only.
 * Accept awards with kind 'oss' and positive points + evidence URL (github ok via host list? — OSS uses github).
 * Spec: evidence for creative/community is x/twitter/getdasha. OSS is separate contract.
 * For oss awards, require https evidence URL (github.com allowed only for oss).
 */
export function isValidOssEvidenceUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 500) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return (host === 'github.com' || host === 'www.github.com') &&
      !u.search && !u.hash && /^\/Uuriko\/dasha-desk\/pull\/[1-9]\d*\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Donate evidence is our own tx page, one per signature: https://www.getdasha.com/faucet/tx/{sig}. */
export function isValidDonateEvidenceUrl(raw) {
  return typeof raw === 'string' && /^https:\/\/www\.getdasha\.com\/faucet\/tx\/[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(raw);
}
export const donateSigFromEvidenceUrl = (url) => (isValidDonateEvidenceUrl(url) ? url.slice(url.lastIndexOf('/') + 1) : null);
export const isValidBurnEvidenceUrl = isValidDonateEvidenceUrl;
export const burnSigFromEvidenceUrl = donateSigFromEvidenceUrl;

/** Whole units only: 999 → 0, 1000 → 1, 2999 → 2. Raw token units + mint decimals, never a UI float. */
export function donatePointsForAmount(amountRaw, decimals = 6) {
  const raw = BigInt(amountRaw ?? 0);
  if (raw <= 0n) return 0;
  return Number(raw / (BigInt(DONATE_UNIT_DASHA) * 10n ** BigInt(decimals))) * DONATE_POINTS_PER_UNIT;
}

export function burnPointsForAmount(amountRaw, decimals = 6) {
  const raw = BigInt(amountRaw ?? 0);
  if (raw <= 0n) return 0;
  return Number(raw / (BigInt(BURN_UNIT_DASHA) * 10n ** BigInt(decimals))) * BURN_POINTS_PER_UNIT;
}

/** Rolling 7d, per-award points, one credit per signature, hard cap. */
function donatePoints(awards, now) {
  let sum = 0;
  const seen = new Set();
  const windowStart = now - DONATE_ROLLING_MS;
  for (const a of awards) {
    if (a.kind !== 'donate') continue;
    const at = Number(a.at) || 0;
    if (at < windowStart || at > now) continue;
    const sig = donateSigFromEvidenceUrl(a.evidenceUrl);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    sum += Math.max(0, Math.floor(Number(a.points) || 0));
    if (sum >= DONATE_CAP_7D) return DONATE_CAP_7D;
  }
  return sum;
}

function burnPoints(awards, now) {
  let sum = 0;
  const seen = new Set();
  const windowStart = now - BURN_ROLLING_MS;
  for (const a of awards) {
    if (a.kind !== 'burn') continue;
    const at = Number(a.at) || 0;
    if (at < windowStart || at > now) continue;
    const sig = burnSigFromEvidenceUrl(a.evidenceUrl);
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    sum += Math.max(0, Math.floor(Number(a.points) || 0));
    if (sum >= BURN_CAP_7D) return BURN_CAP_7D;
  }
  return sum;
}

/** A signature credits one profile, ever. Store is { [xId]: profile }. */
export function donateSigTaken(store, sig) {
  for (const p of Object.values(store || {})) {
    for (const a of p?.awards || []) if (a.kind === 'donate' && donateSigFromEvidenceUrl(a.evidenceUrl) === sig) return true;
  }
  return false;
}

export function burnSigTaken(store, sig) {
  for (const p of Object.values(store || {})) {
    for (const a of p?.awards || []) if (a.kind === 'burn' && burnSigFromEvidenceUrl(a.evidenceUrl) === sig) return true;
  }
  return false;
}

function ossPoints(awards) {
  let sum = 0;
  for (const a of awards) {
    if (a.kind !== 'oss') continue;
    if (a.schema !== OSS_SCHEMA) continue;
    if (!isValidOssEvidenceUrl(a.evidenceUrl)) continue;
    const pts = Math.max(0, Number(a.points) || 0);
    if (pts <= 0) continue;
    sum += pts;
    if (sum >= OSS_CAP_SEASON) return OSS_CAP_SEASON;
  }
  return Math.min(sum, OSS_CAP_SEASON);
}

/**
 * Score a stored profile. Profile: { handle, enrolledAt, awards[], holder?: boolean }
 * linked_x is 10 once if enrolled (opt-in), not from OAuth alone.
 */
export function scoreProfile(profile, { now = Date.now() } = {}) {
  const components = emptyComponents();
  if (!profile || !profile.handle) {
    return { total: 0, components, lastEvidenceAt: null };
  }
  const awards = Array.isArray(profile.awards) ? profile.awards : [];
  components.linked_x = LINKED_X_POINTS;
  components.quiz = profile.quiz?.version === QUIZ_VERSION
    ? Math.min(QUIZ_MAX_POINTS, Math.max(0, Number(profile.quiz.basePoints ?? profile.quiz.points) || 0))
    : 0;
  components.creative = rollingKindPoints(awards, 'creative', CREATIVE_POINTS, CREATIVE_CAP_28D, now);
  components.community = rollingKindPoints(awards, 'community', COMMUNITY_POINTS, COMMUNITY_CAP_28D, now);
  components.connector = Math.min(CONNECTOR_CAP_28D, Math.max(0, Number(profile.connectorPoints) || 0));
  components.oss = ossPoints(awards);
  components.donate = donatePoints(awards, now);
  components.burn = burnPoints(awards, now);
  components.holder = 0; // badge only in v1
  let lastEvidenceAt = null;
  for (const a of awards) {
    const at = Number(a.at) || 0;
    if (!at || at > now) continue;
    const evOk = a.kind === 'oss' ? isValidOssEvidenceUrl(a.evidenceUrl) : a.kind === 'donate' || a.kind === 'burn' ? isValidDonateEvidenceUrl(a.evidenceUrl) : isValidEvidenceUrl(a.evidenceUrl);
    if (evOk) {
      if (lastEvidenceAt == null || at > lastEvidenceAt) lastEvidenceAt = at;
    }
  }
  const total =
    components.linked_x + components.quiz + components.creative + components.community + components.connector + components.oss + components.donate + components.burn + components.holder;
  return { total, components, lastEvidenceAt };
}

export function badgesForProfile(profile, { now = Date.now() } = {}) {
  if (!profile?.handle) return [];
  const badges = new Set(['linked']);
  for (const award of profile.awards || []) if (BADGES.has(award.badge)) badges.add(award.badge);
  if (Number(profile.holderUntil) > now) badges.add('holder');
  return [...badges];
}

/** Ranking: total desc, last evidence desc, enrolledAt asc, handle asc. */
export function compareMeasured(a, b) {
  if (b.total !== a.total) return b.total - a.total;
  const ae = a.lastEvidenceAt ?? 0;
  const be = b.lastEvidenceAt ?? 0;
  if (be !== ae) return be - ae;
  const aEn = Number(a.enrolledAt) || 0;
  const bEn = Number(b.enrolledAt) || 0;
  if (aEn !== bEn) return aEn - bEn;
  return String(a.handle || '').localeCompare(String(b.handle || ''));
}

export function rankProfiles(profiles, { now = Date.now() } = {}) {
  const rows = [];
  for (const p of profiles || []) {
    if (!p?.handle) continue;
    const scored = scoreProfile(p, { now });
    rows.push({
      handle: p.handle,
      avatar: typeof p.avatar === 'string' ? p.avatar.slice(0, 300) : null,
      verifiedType: p.verifiedType || null,
      enrolledAt: Number(p.enrolledAt) || 0,
      holder: Number(p.holderUntil) > now,
      holderCheckedAt: Number(p.holderCheckedAt) || null,
      badges: badgesForProfile(p, { now }),
      spotlight: normalizeSimpSpotlight(p.spotlight?.url).spotlight,
      quiz: p.quiz?.version === QUIZ_VERSION ? { correct: p.quiz.correct, total: p.quiz.total, title: p.quiz.title, lane: p.quiz.lane, resultUrl: p.quiz.resultUrl } : null,
      ...scored,
    });
  }
  rows.sort(compareMeasured);
  return rows;
}

/** Strip private fields for public board response. Never expose xId, tokens, wallets, balances. */
export function publicMeasuredEntry(row, rank) {
  return {
    rank,
    handle: row.handle,
    display: `@${row.handle}`,
    href: `https://x.com/${row.handle}`,
    avatar: row.avatar || null,
    kind: 'measured',
    measured: true,
    linked: true,
    total: row.total,
    components: { ...row.components },
    holder: row.badges.includes('holder'),
    holderCheckedAt: row.holderCheckedAt,
    badges: [...row.badges],
    spotlight: row.total >= SIMP_SPOTLIGHT_UNLOCK ? row.spotlight : null,
    quiz: row.quiz,
  };
}

export function publicPerryRow() {
  return {
    rank: 1,
    ...PERRY_EDITORIAL,
    components: null,
  };
}

export function rulesPublic() {
  return {
    schema: SCHEMA,
    mode: 'measured-opt-in',
    linked_x: {
      points: LINKED_X_POINTS,
      once: true,
      note: 'Eligibility credit for opt-in enrollment after X link.',
    },
    quiz: {
      version: QUIZ_VERSION,
      path_length: QUIZ_PATH_LENGTH,
      quick_length: QUIZ_QUICK_LENGTH,
      max_points: QUIZ_MAX_POINTS,
      vibe_range: QUIZ_VIBE_RANGE,
      note:
        'Modes: quick (' +
        QUIZ_QUICK_LENGTH +
        'Q, invite default) and deep (' +
        QUIZ_PATH_LENGTH +
        'Q, board default). Scored retakes allowed — latest finish updates Board quiz points. Points = accuracy; soft vibe is share copy only (±' +
        QUIZ_VIBE_RANGE +
        '). Finishing enrolls that X account. Share via X intent anytime.',
    },
    creative: {
      points_per: CREATIVE_POINTS,
      cap_rolling_28d: CREATIVE_CAP_28D,
      evidence: 'https public URL on x.com, twitter.com, or getdasha.com',
    },
    community: {
      points_per: COMMUNITY_POINTS,
      cap_rolling_28d: COMMUNITY_CAP_28D,
      evidence: 'https public URL on x.com, twitter.com, or getdasha.com',
    },
    connector: {
      activation_points_each: CONNECTOR_ACTIVATION_POINTS,
      first_contribution_points_each: CONNECTOR_CONTRIBUTION_POINTS,
      cap_rolling_28d: CONNECTOR_CAP_28D,
      note: 'Score-neutral attribution only. Invites, joins, returns, and later contributions earn no points.',
    },
    oss: {
      schema: OSS_SCHEMA,
      cap_per_season: OSS_CAP_SEASON,
      note: 'Externally computed merged-PR points only; Worker does not re-score GitHub.',
    },
    donate: {
      points_per_1000_dasha: DONATE_POINTS_PER_UNIT,
      floor_dasha: DONATE_UNIT_DASHA,
      cap_rolling_7d: DONATE_CAP_7D,
      note:
        'Optional refill of the public faucet, which re-tips the tokens to strangers. Only from a wallet you signed for; pasted addresses do not earn. Evidence is the public tx page. Buying, holding, or paying for goods or access earns nothing.',
    },
    burn: {
      enabled: false,
      points_per_1000_dasha: BURN_POINTS_PER_UNIT,
      floor_dasha: BURN_UNIT_DASHA,
      cap_rolling_7d: BURN_CAP_7D,
      note:
        'Prepared, not available. If enabled after the product gates clear, one finalized BurnChecked transaction and its intent memo can score once. Burning permanently reduces supply.',
    },
    holder: {
      points: 0,
      note: 'Badge only when a later signed-wallet proof exists. Zero points in v1.',
    },
    spotlight: {
      unlock_points: SIMP_SPOTLIGHT_UNLOCK,
      platforms: ['GitHub', 'YouTube', 'Twitch', 'Bluesky', 'LinkedIn', 'Instagram', 'Farcaster', 'TikTok'],
      points: 0,
      note: 'At 25 points, add one user-selected profile link. It does not prove ownership or affect score.',
    },
    zero_points: ZERO_POINT_SOURCES,
    ranking: 'total desc, then most recent evidenced contribution, then enrollment time, then handle',
    editorial: 'PerryALPHA founding #1 is editorial and non-measured',
    privacy:
      'Public board never exposes X numeric IDs, cookies, tokens, IPs, wallets, balances, or private notes.',
    identity:
      'X OAuth proves control of one X account, not one unique human. Board points carry no prize, payment, governance, allocation, or airdrop entitlement.',
    opt_in: 'Enrollment requires an explicit join or quiz submission after X OAuth. OAuth alone does not enroll.',
    leave: 'Leave removes that X account’s board profile and awards. Unlinking Lobby OAuth alone does not.',
  };
}

export function buildPublicBoard(profiles, { now = Date.now(), limit = PUBLIC_BOARD_LIMIT } = {}) {
  const editorialHandle = PERRY_EDITORIAL.handle.toLowerCase();
  const ranked = rankProfiles(profiles, { now })
    .filter(row => String(row.handle).toLowerCase() !== editorialHandle)
    .slice(0, Math.max(0, limit));
  const measured = ranked.map((row, i) => publicMeasuredEntry(row, i + 2)); // ranks after Perry
  return {
    schema: SCHEMA,
    mode: 'measured-opt-in',
    editorial: [publicPerryRow()],
    measured,
    rules: rulesPublic(),
    limit,
  };
}

/**
 * Future award contract (pure). Validates evidence + kind; does not persist.
 * Admin API intentionally omitted in this pass.
 */
export function proposeAward(profile, award, { now = Date.now() } = {}) {
  if (!profile?.handle) return { ok: false, error: 'not enrolled' };
  const kind = award?.kind;
  if (kind !== 'creative' && kind !== 'community' && kind !== 'oss' && kind !== 'donate' && kind !== 'burn') {
    return { ok: false, error: 'invalid kind' };
  }
  if (kind === 'donate' || kind === 'burn') {
    /* The Worker has already verified the tx on-chain (mint, treasury owner, signer == the SIWS
       bind, finality); this is the last gate that keeps a pasted or unproven wallet from earning. */
    if (award.proven !== true) return { ok: false, error: 'dest not proven' };
    if (!isValidDonateEvidenceUrl(award.evidenceUrl)) return { ok: false, error: 'invalid evidence host' };
    const sig = donateSigFromEvidenceUrl(award.evidenceUrl);
    if (typeof award.signature === 'string' && award.signature !== sig) return { ok: false, error: 'evidence signature mismatch' };
    if ((profile.awards || []).some((a) => a.kind === kind && donateSigFromEvidenceUrl(a.evidenceUrl) === sig)) {
      return { ok: false, error: 'duplicate signature' };
    }
  } else if (kind === 'oss') {
    if (award.schema !== OSS_SCHEMA) return { ok: false, error: 'invalid oss schema' };
    if (!isValidOssEvidenceUrl(award.evidenceUrl)) return { ok: false, error: 'invalid evidence host' };
  } else if (!isValidEvidenceUrl(award.evidenceUrl)) {
    return { ok: false, error: 'invalid evidence host' };
  }
  // Reject scoring from forbidden signals if someone passes them as metadata
  if (award.followers != null || award.verification != null || award.chatVolume != null) {
    return { ok: false, error: 'forbidden signal' };
  }
  if (award.referrals != null || award.purchases != null || award.balance != null || award.bagSize != null) {
    return { ok: false, error: 'forbidden signal' };
  }
  const unit =
    kind === 'creative' ? CREATIVE_POINTS
      : kind === 'community' ? COMMUNITY_POINTS
        : kind === 'donate' ? donatePointsForAmount(award.amountRaw, award.decimals ?? 6)
          : kind === 'burn' ? burnPointsForAmount(award.amountRaw, award.decimals ?? 6)
          : Math.max(0, Number(award.points) || 0);
  if (unit <= 0) return { ok: false, error: 'no points' };
  const row = {
    id: typeof award.id === 'string' ? award.id.slice(0, 40) : `a${now}`,
    kind,
    ...(kind === 'oss' ? { schema: OSS_SCHEMA } : {}),
    points: kind === 'oss' ? unit : unit,
    ...(BADGES.has(award.badge) ? { badge: award.badge } : {}),
    evidenceUrl: String(award.evidenceUrl).slice(0, 500),
    at: Number(award.at) || now,
  };
  const next = {
    ...profile,
    awards: [...(profile.awards || []), row],
    updatedAt: now,
  };
  const before = scoreProfile(profile, { now });
  const after = scoreProfile(next, { now });
  return { ok: true, award: row, profile: next, before, after };
}

/**
 * Credit a faucet donate onto the Simp board. Enrolls if needed. Worker must have
 * already verified the on-chain transfer (mint, treasury, payer == SIWS dest).
 */
export function creditDonate(store, session, {
  signature,
  amountRaw,
  at,
  proven,
  decimals = 6,
} = {}) {
  const now = Number(at) || Date.now();
  const joined = joinBoard(store, session, { now });
  if (!joined.ok) return { ok: false, error: joined.error };
  const sig = String(signature || '').trim();
  const evidenceUrl = `https://www.getdasha.com/faucet/tx/${sig}`;
  const awarded = proposeAward(joined.profile, {
    id: `donate:${sig}`.slice(0, 40),
    kind: 'donate',
    proven: proven === true,
    amountRaw,
    decimals,
    evidenceUrl,
    signature: sig,
    at: now,
  }, { now });
  if (!awarded.ok) return { ok: false, error: awarded.error, store: joined.store };
  return {
    ok: true,
    awarded: true,
    points: awarded.award.points,
    donate: awarded.after.components.donate,
    store: { ...joined.store, [String(session.xId)]: awarded.profile },
  };
}

/** Credit one already-verified BurnChecked receipt. Does not submit or sign a transaction. */
export function creditBurn(store, session, {
  signature,
  amountRaw,
  at,
  proven,
  decimals = 6,
} = {}) {
  const now = Number(at) || Date.now();
  const sig = String(signature || '').trim();
  if (burnSigTaken(store, sig)) return { ok: false, error: 'duplicate signature', store };
  const joined = joinBoard(store, session, { now });
  if (!joined.ok) return { ok: false, error: joined.error };
  const awarded = proposeAward(joined.profile, {
    id: `burn:${sig}`.slice(0, 40),
    kind: 'burn',
    proven: proven === true,
    amountRaw,
    decimals,
    evidenceUrl: `https://www.getdasha.com/faucet/tx/${sig}`,
    signature: sig,
    at: now,
  }, { now });
  if (!awarded.ok) return { ok: false, error: awarded.error, store: joined.store };
  return {
    ok: true,
    awarded: true,
    points: awarded.award.points,
    burn: awarded.after.components.burn,
    store: { ...joined.store, [String(session.xId)]: awarded.profile },
  };
}

/** Create enrollment record from a signed session (public fields only + internal xId for storage). */
export function enrollmentFromSession(session, { now = Date.now() } = {}) {
  if (!session?.xId || !session?.handle) return null;
  return {
    xId: String(session.xId),
    handle: String(session.handle).toLowerCase(),
    avatar: typeof session.avatar === 'string' ? session.avatar.slice(0, 300) : null,
    verifiedType: session.verifiedType || null,
    enrolledAt: now,
    updatedAt: now,
    awards: [],
    holder: false,
  };
}

/** Join: idempotent. Returns { profile, created }. */
export function joinBoard(store, session, { now = Date.now() } = {}) {
  if (!session?.xId || !session?.handle) return { ok: false, error: 'not linked', status: 401 };
  const xId = String(session.xId);
  const existing = store[xId];
  if (existing) {
    // Refresh public profile fields; keep awards and enrolledAt
    const refreshed = {
      ...existing,
      handle: String(session.handle).toLowerCase(),
      avatar: typeof session.avatar === 'string' ? session.avatar.slice(0, 300) : existing.avatar,
      verifiedType: session.verifiedType || existing.verifiedType || null,
      updatedAt: now,
    };
    return { ok: true, created: false, profile: refreshed, store: { ...store, [xId]: refreshed } };
  }
  const profile = enrollmentFromSession(session, { now });
  return { ok: true, created: true, profile, store: { ...store, [xId]: profile } };
}

/** Set or remove the signed-in member's earned, score-neutral public profile link. */
export function setSimpSpotlight(store, session, raw, { now = Date.now() } = {}) {
  const xId = String(session?.xId || '');
  const profile = store?.[xId];
  if (!xId || !profile) return { ok: false, status: 401, error: 'join board first' };
  const parsed = normalizeSimpSpotlight(raw);
  if (!parsed.ok) return { ...parsed, status: 400 };
  const scored = scoreProfile(profile, { now });
  if (parsed.spotlight && scored.total < SIMP_SPOTLIGHT_UNLOCK) {
    return { ok: false, status: 403, error: `${SIMP_SPOTLIGHT_UNLOCK} points required` };
  }
  const updated = { ...profile, updatedAt: now };
  if (parsed.spotlight) updated.spotlight = { ...parsed.spotlight, updatedAt: now };
  else delete updated.spotlight;
  return { ok: true, spotlight: parsed.spotlight, profile: updated, store: { ...store, [xId]: updated } };
}

/**
 * Scored quiz finish: enrolls on Board if needed, then stores latest quiz result.
 * Retakes replace the previous score (no one-shot lock). Practice path is unused.
 */
export function submitQuiz(store, session, attempt, { now = Date.now(), rng = Math.random } = {}) {
  const joined = joinBoard(store, session, { now });
  if (!joined.ok) return joined;
  const xId = String(session.xId);
  // Never treat practice attempts as leaderboard score.
  if (attempt?.practice) {
    return { ok: false, status: 400, error: 'practice attempts are disabled; retake for score' };
  }
  const quiz = quizResultForAttempt(attempt, { now, rng });
  if (!quiz) return { ok: false, status: 400, error: 'quiz is incomplete' };
  const profile = { ...joined.profile, quiz, updatedAt: now };
  return {
    ok: true,
    created: joined.created,
    retake: Boolean(joined.profile.quiz),
    quiz,
    profile,
    store: { ...joined.store, [xId]: profile },
  };
}

/** Leave: only the signed session's xId. */
export function leaveBoard(store, session) {
  if (!session?.xId) return { ok: false, error: 'not linked', status: 401 };
  const xId = String(session.xId);
  if (!store[xId]) return { ok: true, removed: false, store };
  const next = { ...store };
  delete next[xId];
  return { ok: true, removed: true, store: next };
}

/** Status for /simp/me — never leak xId publicly. */
export function meStatus(store, session) {
  if (!session?.xId || !session?.handle) {
    return { linked: false, enrolled: false, x: null, board: null };
  }
  const profile = store[String(session.xId)] || null;
  const now = Date.now();
  const scored = profile ? scoreProfile(profile, { now }) : null;
  const rank = profile
    ? (buildPublicBoard(Object.values(store), { now, limit: Number.MAX_SAFE_INTEGER }).measured
        .find((row) => row.handle.toLowerCase() === String(profile.handle).toLowerCase())?.rank ?? null)
    : null;
  return {
    linked: true,
    enrolled: Boolean(profile),
    x: {
      handle: session.handle,
      display: `@${session.handle}`,
      href: `https://x.com/${session.handle}`,
      avatar: session.avatar || null,
    },
    board: profile
      ? {
          handle: profile.handle,
          rank,
          total: scored.total,
          components: scored.components,
          quiz: profile.quiz?.version === QUIZ_VERSION
            ? {
                correct: profile.quiz.correct,
                total: profile.quiz.total,
                title: profile.quiz.title,
                lane: profile.quiz.lane,
                resultUrl: profile.quiz.resultUrl,
                points: profile.quiz.points,
                vibe: profile.quiz.vibe,
                vibeNote: profile.quiz.vibeNote,
              }
            : null,
          holder: Number(profile.holderUntil) > now,
          holderCheckedAt: Number(profile.holderCheckedAt) || null,
          holderExpiresAt: Number(profile.holderUntil) > now ? Number(profile.holderUntil) : null,
          badges: badgesForProfile(profile, { now }),
          spotlight: scored.total >= SIMP_SPOTLIGHT_UNLOCK ? normalizeSimpSpotlight(profile.spotlight?.url).spotlight : null,
          spotlightUnlock: {
            points: SIMP_SPOTLIGHT_UNLOCK,
            unlocked: scored.total >= SIMP_SPOTLIGHT_UNLOCK,
            remaining: Math.max(0, SIMP_SPOTLIGHT_UNLOCK - scored.total),
          },
        }
      : null,
  };
}

/** Assert a public payload has no sensitive leakage. */
export function assertPublicSafe(obj) {
  const s = JSON.stringify(obj);
  const banned = [
    /"xId"\s*:/,
    /"access_token"\s*:/i,
    /"refresh_token"\s*:/i,
    /"LOBBY_SESSION/i,
    /"cookie"\s*:/i,
    /"ip"\s*:/i,
    /"wallet"\s*:/i,
    /"balance"\s*:/i,
    /"bagSize"\s*:/i,
    /"amount"\s*:/i,
    /"usd_value"\s*:/i,
    /"enrolledAt"\s*:/,
    /"lastEvidenceAt"\s*:/,
    /"completedAt"\s*:/,
  ];
  for (const re of banned) {
    if (re.test(s)) return { ok: false, reason: re.toString() };
  }
  return { ok: true };
}
