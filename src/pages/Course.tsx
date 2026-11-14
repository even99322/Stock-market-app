import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { BarChart, LinesChart } from '../components/MiniCharts';
import { PriceChart } from '../components/PriceChart';
import { go } from '../components/ui';
import { chipsData, intraData, newsGroup, slice } from '../course/cases';
import { COURSE, LESSONS, lessonIndex } from '../course';
import type { Block, HLine, Note } from '../course/types';
import { fmtNum } from '../lib/format';
import { store, useApp } from '../lib/store';

export function CoursePage({ id }: { id?: string }) {
  return id && lessonIndex(id) >= 0 ? <LessonView key={id} id={id} /> : <CourseHome />;
}

function useDone() {
  const app = useApp();
  return app.course?.done || {};
}
const setDone = (id: string, v: boolean) =>
  store.update((s) => {
    const done = { ...(s.course?.done || {}) };
    if (v) done[id] = Date.now(); else delete done[id];
    return { ...s, course: { done } };
  });

/** 學習中心用的入口卡片 */
export function CourseEntry() {
  const done = useDone();
  const n = LESSONS.filter((l) => done[l.id]).length;
  const next = LESSONS.find((l) => !done[l.id]) || LESSONS[0];
  return (
    <div className="card course-entry">
      <div className="card-title">🎯 短線交易入門課程 <span className="muted small">{COURSE.length} 章 {LESSONS.length} 課・用 2025/11～2026/5 的真實行情教學</span></div>
      <p className="muted small">從交易規則、K 線、量價、指標、消息、籌碼到停損與當沖，每一課都用當時真實的股價、新聞與財報當例子，並有「看圖判斷」練習：先遮住後面的走勢讓你決定，再揭曉結果。</p>
      <div className="progress"><i style={{ width: `${(n / LESSONS.length) * 100}%` }} /></div>
      <div className="row gap wrap">
        <button className="btn" onClick={() => go('course', next.id)}>{n === 0 ? '開始第一課' : n === LESSONS.length ? '重新複習' : `繼續：${next.title}`}</button>
        <button className="btn ghost" onClick={() => go('course')}>課程目錄（{n}/{LESSONS.length}）</button>
      </div>
    </div>
  );
}

function CourseHome() {
  const done = useDone();
  const n = LESSONS.filter((l) => done[l.id]).length;
  const next = LESSONS.find((l) => !done[l.id]);
  let no = 0;
  return (
    <div className="page">
      <div className="stock-head">
        <button className="icon-btn" onClick={() => go('learn')}>←</button>
        <div className="grow"><h2>短線交易入門課程</h2><div className="muted small">已完成 {n} / {LESSONS.length} 課</div></div>
        {next && <button className="btn sm" onClick={() => go('course', next.id)}>繼續學習</button>}
      </div>
      <div className="progress"><i style={{ width: `${(n / LESSONS.length) * 100}%` }} /></div>
      <div className="note">
        課程中的 K 線、成交量、法人與融資資料都是 2025 年 11 月～2026 年 5 月的真實紀錄（當沖章節用 2026 年 8～10 月的 5 分 K），新聞標題是當時媒體的報導。
        目的是學習判讀方法，不是推薦任何股票；過去的走勢不代表未來會重演。
      </div>
      {COURSE.map((ch, ci) => (
        <div key={ch.id} className="card">
          <div className="card-title">第 {ci} 章　{ch.title}</div>
          <div className="muted small">{ch.intro}</div>
          <div className="table">
            {ch.lessons.map((l) => {
              no++;
              return (
                <div key={l.id} className="tr lesson-row" onClick={() => go('course', l.id)}>
                  <div className="name"><b>{done[l.id] ? '✅' : '▫️'} {no}. {l.title}</b></div>
                  <div className="num muted small">約 {l.mins} 分鐘</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LessonView({ id }: { id: string }) {
  const done = useDone();
  const i = lessonIndex(id);
  const lesson = LESSONS[i];
  const chapter = COURSE.find((c) => c.lessons.some((l) => l.id === id))!;
  const prev = LESSONS[i - 1], next = LESSONS[i + 1];
  const finish = () => { setDone(id, true); if (next) go('course', next.id); else go('course'); };
  return (
    <div className="page lesson">
      <div className="stock-head">
        <button className="icon-btn" onClick={() => go('course')}>←</button>
        <div className="grow">
          <div className="muted small">第 {COURSE.indexOf(chapter)} 章　{chapter.title}　·　第 {i + 1} / {LESSONS.length} 課</div>
          <h2 className="lesson-title">{lesson.title}</h2>
        </div>
        {done[id] && <span className="badge">已完成</span>}
      </div>
      <div className="card lesson-body">
        {lesson.blocks.map((b, k) => <BlockView key={k} b={b} />)}
      </div>
      <div className="row gap wrap lesson-nav">
        {prev && <button className="btn ghost" onClick={() => go('course', prev.id)}>← 上一課</button>}
        <button className="btn grow" onClick={finish}>{next ? '完成，前往下一課 →' : '完成課程 🎉'}</button>
      </div>
      {done[id] && <button className="link small" onClick={() => setDone(id, false)}>標記為未完成</button>}
    </div>
  );
}

/** **粗體** 標記 */
function rich(x: string): ReactNode {
  return x.split(/(\*\*[^*]+\*\*)/g).map((s, i) => (s.startsWith('**') ? <b key={i}>{s.slice(2, -2)}</b> : <Fragment key={i}>{s}</Fragment>));
}

function DailyChart({ c, from, to, notes, lines, ma = true, boll, sub = 'none', cap }: {
  c: string; from: string; to: string; notes?: Note[]; lines?: HLine[]; ma?: boolean; boll?: boolean; sub?: any; cap?: string;
}) {
  const app = useApp();
  const d = useMemo(() => slice(c, from, to), [c, from, to]);
  const nts = useMemo(() => (notes || []).flatMap((n) => { const t = d.timeOf(n.d); return t ? [{ time: t, text: n.x, pos: n.pos, color: n.color }] : []; }), [notes, d]);
  const overlays = useMemo(() => ({ ma, boll: !!boll }), [ma, boll]);
  const code = d.symbol.replace(/\.(TW|TWO)$/, '').replace('^TWII', '');
  return (
    <figure className="fig">
      <div className="fig-title">{d.name}{code ? `（${code}）` : ''}日 K　<span className="muted">{from.slice(0, 7).replace('-', '/')}～{to.slice(0, 7).replace('-', '/')}</span></div>
      <PriceChart bars={d.bars} intraday={false} gmtoffset={d.gmtoffset} market="TW" overlays={overlays} sub={sub}
        redUp={app.settings.redUp} notes={nts} lines={lines} visibleBars={d.visible + 2} height={300} />
      {cap && <figcaption>{rich(cap)}</figcaption>}
    </figure>
  );
}

function IntraChart({ c, notes, lines, cap }: { c: string; notes?: Note[]; lines?: HLine[]; cap?: string }) {
  const app = useApp();
  const d = useMemo(() => intraData(c), [c]);
  const nts = useMemo(() => (notes || []).flatMap((n) => { const t = d.timeOf(n.d); return t ? [{ time: t, text: n.x, pos: n.pos, color: n.color }] : []; }), [notes, d]);
  const extra = useMemo(() => [{ color: '#f5c542', values: d.vwap }], [d]);
  const overlays = useMemo(() => ({ ma: false, boll: false }), []);
  return (
    <figure className="fig">
      <div className="fig-title">{d.name}（{d.symbol.replace(/\.(TW|TWO)$/, '')}）5 分 K　<span className="muted">{d.date}　黃線＝均價線</span></div>
      <PriceChart bars={d.bars} intraday gmtoffset={d.gmtoffset} market="TW" overlays={overlays} sub="none"
        redUp={app.settings.redUp} notes={nts} lines={lines} extra={extra} baseline={d.prevClose} height={300} />
      {cap && <figcaption>{rich(cap)}</figcaption>}
    </figure>
  );
}

function Quiz({ b }: { b: Extract<Block, { t: 'quiz' }> }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="quiz">
      <div className="quiz-q">✍️ {rich(b.q)}</div>
      <div className="quiz-opts">
        {b.opts.map((o, i) => (
          <button key={i} disabled={pick != null}
            className={`quiz-opt ${pick != null && i === b.a ? 'right' : ''} ${pick === i && i !== b.a ? 'wrong' : ''}`}
            onClick={() => setPick(i)}>{String.fromCharCode(65 + i)}. {o}</button>
        ))}
      </div>
      {pick != null && <div className={`quiz-why ${pick === b.a ? 'ok' : ''}`}><b>{pick === b.a ? '答對了。' : `正確答案是 ${String.fromCharCode(65 + b.a)}。`}</b>{rich(b.why)}</div>}
    </div>
  );
}

function Decide({ b }: { b: Extract<Block, { t: 'decide' }> }) {
  const [pick, setPick] = useState<number | null>(null);
  const revealed = pick != null;
  const notes = useMemo<Note[]>(() => (revealed ? [{ d: b.upto, x: '決策點', pos: 'above', color: '#4ea1ff' }, ...(b.notes || [])] : []), [revealed, b]);
  return (
    <div className="decide">
      <div className="decide-head">🧭 看圖判斷　<span className="muted small">先想好再選，選完才會顯示後面的走勢</span></div>
      <DailyChart c={b.c} from={b.from} to={revealed ? b.to : b.upto} sub={b.sub} notes={notes} lines={revealed ? b.lines : undefined}
        cap={revealed ? undefined : `圖表只顯示到 ${b.upto}。`} />
      <div className="quiz-q">{rich(b.q)}</div>
      <div className="quiz-opts">
        {b.opts.map((o, i) => (
          <button key={i} disabled={revealed}
            className={`quiz-opt ${revealed && i === b.best ? 'right' : ''} ${pick === i && i !== b.best ? 'wrong' : ''}`}
            onClick={() => setPick(i)}>{String.fromCharCode(65 + i)}. {o}</button>
        ))}
      </div>
      {revealed && (
        <div className={`quiz-why ${pick === b.best ? 'ok' : ''}`}>
          <b>{pick === b.best ? '和較穩健的做法一致。' : `較穩健的做法是 ${String.fromCharCode(65 + b.best)}。`}</b>{rich(b.why)}
        </div>
      )}
    </div>
  );
}

function Chips({ b }: { b: Extract<Block, { t: 'chips' }> }) {
  const d = chipsData();
  const lab = (x: string) => x.slice(5).replace('-', '/');
  if (b.kind === 'inst') {
    const rows = d.inst.filter((r) => r[0] >= b.from && r[0] <= b.to);
    return (
      <figure className="fig">
        <div className="fig-title">聯電（2303）外資每日買賣超　<span className="muted">單位：張</span></div>
        <BarChart height={170} labels={rows.map((r) => lab(r[0]))} format={(v) => `${v > 0 ? '+' : ''}${fmtNum(v)} 張`}
          series={[{ name: '外資買賣超', color: 'var(--up)', sign: true, values: rows.map((r) => r[1]) }]} />
        {b.cap && <figcaption>{rich(b.cap)}</figcaption>}
      </figure>
    );
  }
  const rows = d.margin.filter((r) => r[0] >= b.from && r[0] <= b.to);
  return (
    <figure className="fig">
      <div className="fig-title">聯電（2303）融資餘額　<span className="muted">單位：張</span></div>
      <LinesChart height={150} labels={rows.map((r) => lab(r[0]))} format={(v) => `${fmtNum(v)} 張`}
        series={[{ name: '融資餘額', color: '#f5c542', values: rows.map((r) => r[1]) }]} />
      {b.cap && <figcaption>{rich(b.cap)}</figcaption>}
    </figure>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'p': return <p>{rich(b.x)}</p>;
    case 'h': return <h3 className="lesson-h">{b.x}</h3>;
    case 'ul': return <ul className="lesson-ul">{b.items.map((x, i) => <li key={i}>{rich(x)}</li>)}</ul>;
    case 'formula': return <pre className="formula">{b.x}</pre>;
    case 'tip': return <div className="callout tip">💡 {rich(b.x)}</div>;
    case 'warn': return <div className="callout warn">⚠️ {rich(b.x)}</div>;
    case 'table': return (
      <div className="fin-table-wrap">
        <table className="fin-table lesson-table">
          <thead><tr>{b.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{rich(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
    case 'chart': return <DailyChart {...b} />;
    case 'intra': return <IntraChart {...b} />;
    case 'news': {
      const all = newsGroup(b.g);
      const items = b.only ? b.only.map((i) => all[i]).filter(Boolean) : all;
      return (
        <div className="lesson-news">
          <div className="muted small">📰 {b.cap || '當時的新聞標題'}（點擊可看原文）</div>
          {items.map((n) => (
            <a key={n.l} className="news-item" href={n.l} target="_blank" rel="noreferrer">
              <div className="news-title">{n.t}</div><div className="muted small">{n.s}</div>
            </a>
          ))}
        </div>
      );
    }
    case 'chips': return <Chips b={b} />;
    case 'quiz': return <Quiz b={b} />;
    case 'decide': return <Decide b={b} />;
    case 'go': { const [page, ...rest] = b.to.split('/'); return <button className="btn ghost go-btn" onClick={() => go(page, rest.join('/') || undefined)}>▶ {b.label}</button>; }
  }
}
