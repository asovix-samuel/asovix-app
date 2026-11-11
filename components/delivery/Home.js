import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

// The founder's home screen. Four numbers, then only the orders that need a person.
// Evidence, issues, logs and analysis live behind "Open" -> the tabs on each order (hidden by default).

async function get(path) {
  const res = await fetch(`/api/delivery/${path}`, { credentials: 'same-origin' });
  if (res.status === 401) { window.location.href = '/delivery/login'; throw new Error('Signed out.'); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Something went wrong (${res.status}).`);
  return body;
}

const money = (cents, currency = 'eur') => {
  const sym = { eur: '€', gbp: '£', usd: '$' }[String(currency).toLowerCase()] || '';
  const v = (cents || 0) / 100;
  return `${sym}${v.toLocaleString('en-IE', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
};
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
const initials = (n) => String(n || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((s) => s[0] || '').join('').toUpperCase() || '?';

function Progress({ stages, at, tone }) {
  return (
    <div className="hm-prog" aria-label={`Progress: ${stages[at]}`}>
      {stages.map((s, i) => (
        <div key={s} className={`hm-step${i < at ? ' past' : ''}${i === at ? ` now ${tone}` : ''}`}><i /><span>{s}</span></div>
      ))}
    </div>
  );
}

function Card({ it, stages, onOpen }) {
  const open = it.kind === 'order';
  const action = it.bucket === 'approve' ? 'Review and approve' : it.bucket === 'attention' ? 'Open' : 'View';
  return (
    <div className={`hm-card ${it.bucket}${open ? ' click' : ''}`} onClick={open ? () => onOpen(it) : undefined} role={open ? 'link' : undefined}>
      <div className="hm-top">
        <div className={`hm-ava ${it.bucket}`}>{initials(it.name)}</div>
        <div className="hm-who">
          <div className="hm-name">{it.name}{it.isTest && <span className="hm-test">TEST</span>}</div>
          <div className="hm-sub">{it.package}{it.amountCents ? ` · ${money(it.amountCents, it.currency)}` : ''} · {ago(it.updatedAt)}</div>
        </div>
      </div>
      <Progress stages={stages} at={it.stage} tone={it.bucket} />
      <div className={`hm-note ${it.bucket}`}>{it.text}</div>
      {open && <button className={`hm-btn ${it.bucket}`} onClick={(e) => { e.stopPropagation(); onOpen(it); }}>{action} →</button>}
    </div>
  );
}

function Group({ title, tone, items, stages, onOpen, empty }) {
  if (!items.length && !empty) return null;
  return (
    <section className="hm-group">
      <h2 className={tone}>{title} <span>{items.length}</span></h2>
      {!items.length && <div className="hm-none">{empty}</div>}
      <div className="hm-list">{items.map((it) => <Card key={`${it.kind}-${it.id}`} it={it} stages={stages} onOpen={onOpen} />)}</div>
    </section>
  );
}

export function Home() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tests, setTests] = useState(false);
  const load = useCallback(async () => { try { setData(await get('overview')); setErr(''); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);
  const open = (it) => router.push(`/delivery/${it.id}`);

  if (err && !data) return <div className="hm-banner">{err} <button className="hm-link" onClick={load}>Try again</button></div>;
  if (!data) return <><div className="hm-skel" /><div className="hm-skel" /></>;

  const real = data.items.filter((i) => !i.isTest);
  const by = (b) => real.filter((i) => i.bucket === b);
  const t = data.tiles;
  const testItems = data.items.filter((i) => i.isTest);

  return (
    <>
      <h1 className="hm-h1">Today</h1>
      <div className="hm-tiles">
        <div className="hm-tile blue"><span>Revenue received</span><b>{money(t.revenue.cents, t.revenue.currency)}</b><small>{t.revenue.orders} paid order{t.revenue.orders === 1 ? '' : 's'} · {money(t.revenue.cents30, t.revenue.currency)} in 30 days</small></div>
        <div className="hm-tile violet"><span>Orders in progress</span><b>{t.inProgress}</b><small>being handled automatically</small></div>
        <div className="hm-tile amber"><span>Awaiting your approval</span><b>{t.awaitingApproval}</b><small>review, then approve</small></div>
        <div className={`hm-tile ${t.needAttention ? 'red' : 'green'}`}><span>Need attention</span><b>{t.needAttention}</b><small>{t.needAttention ? 'something is blocked' : 'nothing is stuck'}</small></div>
      </div>
      {err && <div className="hm-banner">{err}</div>}
      <Group title="Needs attention" tone="attention" items={by('attention')} stages={data.stages} onOpen={open} />
      <Group title="Awaiting your approval" tone="approve" items={by('approve')} stages={data.stages} onOpen={open}
        empty={real.length === 0 ? 'When someone pays and sends their CV, their finished documents appear here for you to approve.' : 'Nothing is waiting for you.'} />
      <Group title="In progress" tone="progress" items={by('progress')} stages={data.stages} onOpen={open} />
      <Group title="Sent" tone="done" items={by('done').slice(0, 5)} stages={data.stages} onOpen={open} />
      {testItems.length > 0 && (
        <>
          <button className="hm-link hm-toggle" onClick={() => setTests((s) => !s)}>{tests ? 'Hide' : 'Show'} {testItems.length} test record{testItems.length === 1 ? '' : 's'}</button>
          {tests && <div className="hm-list">{testItems.map((it) => <Card key={`${it.kind}-${it.id}`} it={it} stages={data.stages} onOpen={open} />)}</div>}
        </>
      )}
    </>
  );
}

export const homeCss = `
  .hm-h1 { font-size: 34px; color: #fff; margin: 4px 0 16px; font-weight: 700; letter-spacing: -.02em; }
  .hm-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 26px; }
  .hm-tile { border-radius: 18px; padding: 18px 20px; border: 1px solid; }
  .hm-tile span { display: block; font-size: 14px; font-weight: 700; margin-bottom: 6px; }
  .hm-tile b { display: block; font-size: 38px; color: #fff; line-height: 1.05; letter-spacing: -.02em; }
  .hm-tile small { display: block; margin-top: 8px; font-size: 13px; color: #9fb0c8; line-height: 1.4; }
  .hm-tile.blue { background: linear-gradient(135deg, rgba(59,125,240,.22), rgba(37,87,199,.08)); border-color: rgba(77,141,255,.4); } .hm-tile.blue span { color: #8db4fa; }
  .hm-tile.violet { background: linear-gradient(135deg, rgba(160,130,240,.2), rgba(160,130,240,.05)); border-color: rgba(160,130,240,.35); } .hm-tile.violet span { color: #b9a4f5; }
  .hm-tile.amber { background: linear-gradient(135deg, rgba(240,179,94,.2), rgba(240,179,94,.05)); border-color: rgba(240,179,94,.4); } .hm-tile.amber span { color: #f0b35e; }
  .hm-tile.red { background: linear-gradient(135deg, rgba(240,138,138,.22), rgba(240,138,138,.06)); border-color: rgba(240,138,138,.45); } .hm-tile.red span { color: #f08a8a; }
  .hm-tile.green { background: linear-gradient(135deg, rgba(111,214,156,.18), rgba(111,214,156,.05)); border-color: rgba(111,214,156,.35); } .hm-tile.green span { color: #6fd69c; }
  .hm-group { margin-bottom: 26px; }
  .hm-group h2 { font-size: 18px; margin: 0 0 12px; font-weight: 700; color: #fff; }
  .hm-group h2 span { font-size: 13px; background: rgba(255,255,255,.08); border-radius: 99px; padding: 2px 9px; margin-left: 6px; color: #9fb0c8; }
  .hm-group h2.attention { color: #f08a8a; } .hm-group h2.approve { color: #f0b35e; } .hm-group h2.progress { color: #b9a4f5; } .hm-group h2.done { color: #6fd69c; }
  .hm-none { color: #9fb0c8; padding: 18px; border: 1px dashed rgba(255,255,255,.14); border-radius: 14px; font-size: 15px; }
  .hm-list { display: grid; gap: 12px; }
  .hm-card { background: linear-gradient(180deg, rgba(18,27,48,.96), rgba(10,16,30,.96)); border: 1px solid rgba(255,255,255,.09); border-left-width: 5px; border-radius: 16px; padding: 18px; }
  .hm-card.click { cursor: pointer; transition: transform .12s, border-color .12s; } .hm-card.click:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.22); }
  .hm-card.attention { border-left-color: #f08a8a; } .hm-card.approve { border-left-color: #f0b35e; } .hm-card.progress { border-left-color: #a082f0; } .hm-card.done { border-left-color: #6fd69c; }
  .hm-top { display: flex; align-items: center; gap: 14px; }
  .hm-ava { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 15px; color: #060b16; flex: none; }
  .hm-ava.attention { background: #f08a8a; } .hm-ava.approve { background: #f0b35e; } .hm-ava.progress { background: #b9a4f5; } .hm-ava.done { background: #6fd69c; }
  .hm-who { flex: 1; min-width: 0; }
  .hm-name { font-size: 19px; font-weight: 700; color: #fff; }
  .hm-test { margin-left: 10px; font-size: 11px; letter-spacing: .1em; background: rgba(77,141,255,.18); color: #7fa8f5; padding: 2px 8px; border-radius: 99px; vertical-align: middle; }
  .hm-sub { color: #7e8fab; font-size: 14px; margin-top: 2px; }
  .hm-prog { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 16px 0 12px; }
  .hm-step { position: relative; padding-top: 14px; font-size: 12px; color: #4a5670; font-weight: 600; }
  .hm-step i { position: absolute; top: 0; left: 0; right: 0; height: 6px; border-radius: 99px; background: rgba(255,255,255,.09); }
  .hm-step.past { color: #7e8fab; } .hm-step.past i { background: #3b7df0; }
  .hm-step.now { color: #fff; } .hm-step.now.attention i { background: #f08a8a; } .hm-step.now.approve i { background: #f0b35e; } .hm-step.now.progress i { background: #a082f0; } .hm-step.now.done i { background: #6fd69c; }
  .hm-note { font-size: 16px; line-height: 1.5; padding: 11px 14px; border-radius: 12px; }
  .hm-note.attention { background: rgba(240,138,138,.1); color: #f5a5a5; } .hm-note.approve { background: rgba(240,179,94,.1); color: #f6cf94; }
  .hm-note.progress { background: rgba(160,130,240,.08); color: #cdbff7; } .hm-note.done { background: rgba(111,214,156,.08); color: #a6e6c4; }
  .hm-btn { margin-top: 12px; border: 0; border-radius: 12px; padding: 13px 18px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; background: rgba(255,255,255,.08); color: #fff; width: 100%; }
  .hm-btn.approve { background: #f0b35e; color: #1a1206; } .hm-btn.attention { background: #f08a8a; color: #1a0808; }
  .hm-banner { border-radius: 14px; padding: 14px 16px; font-size: 15px; margin: 0 0 16px; border: 1px solid rgba(240,138,138,.35); background: rgba(240,138,138,.1); color: #f5a5a5; }
  .hm-link { background: none; border: 0; color: #7fa8f5; font: inherit; cursor: pointer; padding: 6px 8px; font-size: 14px; }
  .hm-toggle { margin: 6px 0 10px; }
  .hm-skel { height: 130px; border-radius: 16px; margin-bottom: 14px; background: linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.08), rgba(255,255,255,.04)); background-size: 200% 100%; animation: dlshim 1.4s linear infinite; }
  @media (max-width: 760px) {
    .hm-h1 { font-size: 28px; } .hm-tiles { grid-template-columns: repeat(2, 1fr); } .hm-tile b { font-size: 32px; }
    .hm-step span { display: none; } .hm-step.now span { display: block; position: absolute; top: 14px; left: 0; white-space: nowrap; } .hm-prog { margin-bottom: 26px; }
  }
`;
