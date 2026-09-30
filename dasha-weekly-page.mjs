/**
 * /weekly - the Dasha week, revived Sep 29 2026.
 * One dated entry per week, newest first, each with a permalink anchor.
 * Dated-fact only: chain state, supply state, shipped fixes, short try-it.
 * Entries are append-only - a missed week never requires a rebuild.
 * Static page: every number is as-of the entry date, never live-pulled.
 */
export const WEEKLY_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Dasha week</title>
<meta name="description" content="One dated entry per week from Dasha: chain state, supply state, what shipped, and a two-minute way to try it. Facts as measured, pretty or not.">
<link rel="canonical" href="https://www.getdasha.com/weekly">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.getdasha.com/weekly">
<meta property="og:title" content="The Dasha week">
<meta property="og:description" content="One dated entry per week: chain state, supply state, what shipped. Facts as measured, pretty or not.">
<meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="The Dasha week">
<meta name="twitter:description" content="One dated entry per week: chain state, supply state, what shipped. Facts as measured, pretty or not.">
<meta name="twitter:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<style>
:root{color-scheme:dark}
body{margin:0;background:#0b0b10;color:#e8e8ef;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:28px;margin:24px 0 4px}
h2{font-size:19px;margin:0 0 8px}
.lede{color:#9a9aa8;margin:0 0 8px}
.fine{color:#8a8a96;font-size:13px;margin:6px 0}
a{color:#9ec1ff}
.entry{background:#121218;border:1px solid #26262f;border-radius:10px;padding:14px 16px;margin:18px 0}
.entry h2 a{color:#e8e8ef;text-decoration:none}
.entry h2 a:hover{color:#9ec1ff}
.entry ul{margin:8px 0 4px;padding-left:20px}
.entry li{margin:8px 0}
.entry .when{color:#8a8a96;font-size:13px}
</style>
</head>
<body>
<main>
<p class="fine"><a href="/">&larr; getdasha.com</a></p>
<h1>The Dasha week.</h1>
<p class="lede">One dated entry per week: chain state, supply state, what shipped, and a short way to try it. Facts as measured, pretty or not.</p>

<section class="entry" id="w-2026-09-29">
<h2><a href="#w-2026-09-29">Week of September 29, 2026</a></h2>
<ul>
<li><strong>Chain:</strong> 300 settled jobs, $15.00 paid to providers, 62,551 tokens. No settled jobs since Sep 25 - the cause is under diagnosis; the full history still verifies, receipt by receipt.</li>
<li><strong>Supply:</strong> one founding provider online (kit 0.3.1). An overnight nap Sep 28-29 recovered by 11:27 AM PT Sep 29. Trailing 7-day measured uptime was 66% as of Sep 28 noon; the nap lowered it further. Uptime this week is a single laptop - we publish it because it is measured, not because it is pretty.</li>
<li><strong>Shipped this week:</strong> a buyer-onboarding audit with six concrete friction fixes; two code fixes written and queued for review - a provider anomaly-hold expiry (holds now time out after 24h instead of lasting forever) and a fail-loud bound on the network hop (a wedged backend now answers 504 with retry guidance instead of starving clients silently).</li>
<li><strong>Try it:</strong> mint a guest key and make your first call in about two minutes - no account, no card. <a href="https://www.getdasha.com/compute">getdasha.com/compute</a>. Then check your own usage on the public chain: <a href="https://lobby.getdasha.com/compute/api/chain">lobby.getdasha.com/compute/api/chain</a>.</li>
</ul>
<p class="when">Entry dated September 29, 2026. Numbers are as-of that date.</p>
</section>

</main>
</body>
</html>
`;
