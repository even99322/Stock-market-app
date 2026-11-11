import { useState } from 'react';
import { TopicView, go } from '../components/ui';
import { TOPICS } from '../lib/learn';

const CATS = [...new Set(TOPICS.map((t) => t.cat))];

export function LearnPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const match = (t: (typeof TOPICS)[number]) => !q || (t.title + t.short + t.body.join('')).toLowerCase().includes(q.toLowerCase());

  return (
    <div className="page">
      <div className="page-head"><h2>學習中心</h2></div>
      <div className="card guide">
        <div className="card-title">建議學習路線</div>
        <ol>
          <li><b>看懂行情：</b>先讀「K 線」「成交量」，到 <a onClick={() => go('stock', '2330.TW')}>台積電</a> 的個股頁切換 1日 / 6月 / 5年 看看差別。</li>
          <li><b>認識指標：</b>打開均線、KD、RSI、MACD，對照下方「目前指標讀數」的白話解釋。圖表旁的「?」隨時可以點。</li>
          <li><b>小額模擬：</b>用模擬帳戶買一張 0050 或幾股零股，感受手續費與漲跌。</li>
          <li><b>回放練習：</b>到 <a onClick={() => go('replay')}>歷史回放</a> 選一段行情，訂好買賣規則後照著做，最後和「買進持有」比較。</li>
          <li><b>盲測挑戰：</b>隱藏名稱與日期，檢驗自己是否真的看得懂圖，而不是靠記憶。</li>
        </ol>
      </div>
      <input className="filter" placeholder="搜尋主題…" value={q} onChange={(e) => setQ(e.target.value)} />
      {CATS.map((c) => {
        const list = TOPICS.filter((t) => t.cat === c && match(t));
        if (!list.length) return null;
        return (
          <div key={c} className="card">
            <div className="card-title">{c}</div>
            {list.map((t) => (
              <div key={t.id} className={`acc ${open === t.id ? 'open' : ''}`}>
                <button className="acc-head" onClick={() => setOpen(open === t.id ? null : t.id)}>
                  <b>{t.title}</b><span className="muted small">{t.short}</span><span className="chev">{open === t.id ? '−' : '+'}</span>
                </button>
                {open === t.id && <div className="acc-body"><TopicView id={t.id} onGo={setOpen} /></div>}
              </div>
            ))}
          </div>
        );
      })}
      <p className="muted small pad">
        本程式僅供學習，所有交易皆為模擬。行情資料來自 Yahoo Finance（延遲報價）與證交所、櫃買中心 OpenAPI，不保證正確或即時，不構成投資建議。
      </p>
    </div>
  );
}
