// Global styles for the private delivery workspace, matching the site's dark theme
// (background #060B16, soft blue accents). Everything is prefixed dl- so nothing leaks to public pages.
export const css = `
  body { margin: 0; background: #060B16; color: #C7D4E8; font-family: -apple-system, 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .dl-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px 80px; }
  .dl-top { display: flex; align-items: center; justify-content: space-between; padding: 18px 0; border-bottom: 1px solid rgba(255,255,255,.07); margin-bottom: 28px; gap: 12px; }
  .dl-brand { font-size: 20px; color: #fff; text-decoration: none; font-weight: 600; letter-spacing: -.01em; }
  .dl-brand em { color: #4d8dff; font-style: normal; }
  .dl-brand small { color: #64748f; font-size: 12px; font-weight: 500; margin-left: 10px; letter-spacing: .12em; text-transform: uppercase; }
  .dl-nav { display: flex; gap: 18px; align-items: center; font-size: 14px; }
  .dl-nav a, .dl-link { color: #9fb0c8; text-decoration: none; background: none; border: 0; cursor: pointer; font: inherit; padding: 0; }
  .dl-nav a:hover, .dl-link:hover { color: #fff; }
  h1.dl-h1 { font-size: 28px; color: #fff; margin: 0 0 6px; font-weight: 600; letter-spacing: -.02em; }
  .dl-sub { color: #9fb0c8; font-size: 14.5px; margin: 0 0 22px; line-height: 1.55; }
  .dl-eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #64748f; font-weight: 600; margin: 0 0 10px; }
  .dl-card { background: linear-gradient(180deg, rgba(16,24,42,.94), rgba(10,16,30,.94)); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
  .dl-row { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
  .dl-between { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
  .dl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 11px; font-weight: 600; font-size: 14px; padding: 10px 16px; cursor: pointer; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.04); color: #dbe5f5; text-decoration: none; font-family: inherit; }
  .dl-btn:hover:not(:disabled) { border-color: rgba(255,255,255,.28); color: #fff; }
  .dl-btn:disabled { opacity: .45; cursor: not-allowed; }
  .dl-btn.primary { background: linear-gradient(180deg, #3b7df0, #2557c7); border-color: transparent; color: #fff; box-shadow: 0 6px 22px rgba(59,125,240,.28); }
  .dl-btn.small { padding: 6px 11px; font-size: 13px; }
  .dl-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 99px; border: 1px solid; white-space: nowrap; }
  .dl-pill::before { content: ''; width: 7px; height: 7px; border-radius: 99px; background: currentColor; }
  .tone-good { color: #6fd69c; background: rgba(111,214,156,.09); border-color: rgba(111,214,156,.3); }
  .tone-warn { color: #f0b35e; background: rgba(240,179,94,.09); border-color: rgba(240,179,94,.3); }
  .tone-bad { color: #f08a8a; background: rgba(240,138,138,.09); border-color: rgba(240,138,138,.3); }
  .tone-blue { color: #7fa8f5; background: rgba(77,141,255,.1); border-color: rgba(77,141,255,.32); }
  .tone-neutral { color: #9fb0c8; background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.12); }
  .tone-busy { color: #7fa8f5; background: rgba(77,141,255,.1); border-color: rgba(77,141,255,.32); }
  .tone-busy::before { animation: dlpulse 1.1s ease-in-out infinite; }
  @keyframes dlpulse { 50% { opacity: .25; } }
  .dl-field { display: block; margin-bottom: 16px; }
  .dl-field > span { display: block; font-size: 13px; color: #9fb0c8; margin-bottom: 6px; font-weight: 600; }
  .dl-field small { display: block; color: #64748f; font-size: 12.5px; margin-top: 5px; line-height: 1.45; }
  .dl-in, .dl-ta, .dl-sel { width: 100%; box-sizing: border-box; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12); border-radius: 10px; padding: 10px 12px; color: #fff; font: inherit; font-size: 14.5px; }
  .dl-ta { min-height: 84px; resize: vertical; line-height: 1.5; }
  .dl-in:focus, .dl-ta:focus, .dl-sel:focus { outline: 2px solid rgba(77,141,255,.5); outline-offset: 1px; }
  .dl-sel option { color: #000; }
  .dl-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
  .dl-list { width: 100%; border-collapse: collapse; }
  .dl-list th { text-align: left; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #64748f; padding: 0 12px 10px; font-weight: 600; }
  .dl-list td { padding: 14px 12px; border-top: 1px solid rgba(255,255,255,.07); font-size: 14px; vertical-align: top; }
  .dl-list tr.click { cursor: pointer; }
  .dl-list tr.click:hover td { background: rgba(255,255,255,.025); }
  .dl-name { color: #fff; font-weight: 600; text-decoration: none; }
  .dl-muted { color: #64748f; font-size: 13px; }
  .dl-banner { border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.5; margin-bottom: 14px; border: 1px solid; }
  .dl-tabs { display: flex; gap: 4px; border-bottom: 1px solid rgba(255,255,255,.08); margin: 22px 0 18px; flex-wrap: wrap; }
  .dl-tab { background: none; border: 0; color: #9fb0c8; font: inherit; font-size: 14px; font-weight: 600; padding: 10px 14px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .dl-tab[aria-selected=true] { color: #fff; border-color: #4d8dff; }
  .dl-tab span { color: #64748f; font-weight: 500; margin-left: 4px; }
  .dl-claim { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 16px 0; border-top: 1px solid rgba(255,255,255,.07); }
  .dl-claim:first-of-type { border-top: 0; }
  .dl-claim h4 { margin: 0 0 8px; color: #fff; font-size: 15px; font-weight: 600; line-height: 1.45; }
  .dl-src { border-left: 2px solid rgba(255,255,255,.16); padding-left: 14px; }
  .dl-src q { color: #dbe5f5; font-size: 14px; line-height: 1.55; display: block; quotes: none; }
  .dl-src .where { color: #64748f; font-size: 12.5px; margin-top: 8px; }
  .dl-cat { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: #7fa8f5; font-weight: 700; margin: 26px 0 4px; }
  .dl-finding { padding: 14px 0; border-top: 1px solid rgba(255,255,255,.07); }
  .dl-finding:first-child { border-top: 0; }
  .dl-finding.done { opacity: .5; }
  .dl-spin { width: 16px; height: 16px; border-radius: 99px; border: 2px solid rgba(255,255,255,.2); border-top-color: #7fa8f5; display: inline-block; animation: dlspin .8s linear infinite; }
  @keyframes dlspin { to { transform: rotate(360deg); } }
  .dl-skel { height: 64px; border-radius: 12px; background: linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.08), rgba(255,255,255,.04)); background-size: 200% 100%; animation: dlshim 1.6s ease-in-out infinite; margin-bottom: 10px; }
  @keyframes dlshim { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  .dl-kv { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; font-size: 14px; }
  .dl-kv dt { color: #64748f; } .dl-kv dd { margin: 0; color: #dbe5f5; }
  h3.dl-h3 { font-size: 19px; color: #fff; margin: 0 0 8px; font-weight: 600; }
  .dl-cited { display: flex; gap: 10px; align-items: flex-start; }
  .dl-cited > :first-child { flex: 1; }
  .dl-cites { display: flex; flex-wrap: wrap; gap: 4px; max-width: 120px; padding-top: 8px; }
  .dl-cite { font-size: 11.5px; font-weight: 700; color: #7fa8f5; background: rgba(77,141,255,.1); border: 1px solid rgba(77,141,255,.3); border-radius: 6px; padding: 1px 6px; cursor: help; }
  .dl-cite.bad { color: #f08a8a; background: rgba(240,138,138,.09); border-color: rgba(240,138,138,.3); }
  .dl-arr { display: grid; gap: 8px; }
  .dl-sub-block { border-left: 2px solid rgba(255,255,255,.1); padding: 4px 0 4px 14px; margin-bottom: 8px; }
  .dl-role { color: #fff; font-weight: 600; font-size: 14.5px; margin: 4px 0 10px; }
  .dl-checks { display: grid; gap: 6px; margin-top: 14px; }
  .dl-check { border: 1px solid; border-radius: 10px; padding: 8px 12px; font-size: 13.5px; line-height: 1.45; }
  .dl-ul { margin: 6px 0 10px; padding-left: 20px; line-height: 1.5; }
  @media (max-width: 760px) { .dl-grid2, .dl-claim { grid-template-columns: 1fr; } .dl-list .hide-sm { display: none; } }
  @media (prefers-reduced-motion: reduce) { .dl-spin, .dl-skel, .tone-busy::before { animation: none; } }
`;
