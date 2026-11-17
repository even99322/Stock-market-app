import { useEffect, useState } from 'react';
import { cls, fmtPct } from '../lib/format';
import { fetchChart } from '../lib/market';
import type { Bar } from '../lib/types';
import { Spinner, Stat } from './ui';

export interface EtfStats {
  days: number; since: number;
  r1m?: number; r3m?: number; r6m?: number; r1y?: number;
  vol?: number; mdd?: number; avgVol20?: number;
}

/** 從日 K 算出 ETF 的報酬、年化波動與最大回落（資料不足的區間留空） */
export function etfStats(bars: Bar[]): EtfStats {
  const c = bars.map((b) => b.close).filter((x) => x > 0);
  const n = c.length;
  const last = c[n - 1];
  const ret = (d: number) => (n > d ? last / c[n - 1 - d] - 1 : undefined);
  const lr = c.slice(1).map((x, i) => Math.log(x / c[i]));
  const mean = lr.reduce((a, b) => a + b, 0) / (lr.length || 1);
  const sd = Math.sqrt(lr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lr.length - 1));
  let peak = -Infinity, mdd = 0;
  for (const x of c) { peak = Math.max(peak, x); mdd = Math.min(mdd, x / peak - 1); }
  const v = bars.slice(-20).map((b) => b.volume);
  return {
    days: n, since: n ? last / c[0] - 1 : 0,
    r1m: ret(21), r3m: ret(63), r6m: ret(126), r1y: ret(250),
    vol: lr.length >= 20 ? sd * Math.sqrt(252) : undefined,
    mdd: n >= 20 ? mdd : undefined,
    avgVol20: v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined,
  };
}

/** ETF 沒有財報：改說明怎麼看 ETF，並用價格算出報酬與風險 */
export function EtfCard({ symbol, name, tw }: { symbol: string; name: string; tw: boolean }) {
  const [info, setInfo] = useState<{ issuer?: string; listedAt?: number; ex?: string } | null>(null);
  const [st, setSt] = useState<EtfStats | null | undefined>(undefined);
  useEffect(() => {
    fetchChart(symbol, '1y').then((c) => { setSt(c.demo ? null : etfStats(c.bars)); if (!c.demo) setInfo({ issuer: c.issuer, listedAt: c.listedAt, ex: c.exchangeName }); }).catch(() => setSt(null));
  }, [symbol]);
  const young = st && st.days < 240;
  return (
    <>
      <div className="card">
        <div className="card-title">這是 ETF，沒有財報</div>
        {info && (info.issuer || info.listedAt) && (
          <div className="kv biz-kv">
            {info.issuer && <><span>發行商</span><div>{info.issuer}</div></>}
            {info.listedAt && <><span>上市日期</span><div>{new Date(info.listedAt * 1000).toLocaleDateString('zh-TW')}</div></>}
            {info.ex && <><span>交易所</span><div>{info.ex}</div></>}
          </div>
        )}
        <p className="biz">
          ETF（指數股票型基金）是一籃子股票或資產，本身沒有營收、獲利，所以不會有財報。
          要了解它，看的是它<b>買了什麼</b>、<b>花多少成本</b>和<b>過去的表現與風險</b>。
        </p>
        <ul className="drivers">
          <li><b>成分股與權重</b>：前十大持股佔多少？集中在哪些產業？發行商官網每天公布。</li>
          <li><b>費用率</b>：每年從基金資產扣的管理費，主題型 ETF 通常比大盤型高。</li>
          <li><b>規模與成交量</b>：規模太小或成交量太少，買賣價差大，也可能被下市清算。</li>
          <li><b>折溢價</b>：市價和淨值（實際持有資產的價值）的差距；熱門時市價可能明顯高於淨值。</li>
          <li><b>配息</b>：有沒有配、多久配一次（{tw ? '見下方「股利・除權息」' : '美國 ETF 配息會被預扣 30% 稅'}）。</li>
        </ul>
        {/(Lab|Ecosystem|生態|Pre-?IPO|Private)/i.test(name) && (
          <div className="note">
            名稱以某家公司為主題的 ETF，不一定直接持有那家公司；常見做法是持有和它合作或供應它的上市公司。
            如果名稱裡的公司還沒上市，它不需要公開財報，市面上也查不到完整的財務數字。實際持股請以發行商公布的成分股為準。
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-title">報酬與風險 <span className="muted small">{young ? `上市以來 ${st!.days} 個交易日` : '近一年日 K'}，不含配息</span></div>
        {st === undefined ? <Spinner /> : st === null ? <div className="muted">離線或沒有價格資料</div> : (
          <div className="stats">
            {young && <Stat label="上市以來" value={fmtPct(st.since)} className={cls(st.since)} />}
            <Stat label="近 1 月" value={fmtPct(st.r1m)} className={cls(st.r1m)} />
            <Stat label="近 3 月" value={fmtPct(st.r3m)} className={cls(st.r3m)} />
            <Stat label="近 6 月" value={fmtPct(st.r6m)} className={cls(st.r6m)} />
            <Stat label="近 1 年" value={fmtPct(st.r1y)} className={cls(st.r1y)} />
            <Stat label="年化波動" value={st.vol != null ? fmtPct(st.vol, false, 1) : '—'} help="vol" />
            <Stat label="最大回落" value={st.mdd != null ? fmtPct(st.mdd, false, 1) : '—'} help="mdd" />
          </div>
        )}
        {young && <div className="muted small">上市不到一年，資料期間短，波動與回落數字參考價值有限。</div>}
      </div>
    </>
  );
}
