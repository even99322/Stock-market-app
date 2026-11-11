// 「目前指標讀數」：把指標數字翻成白話，幫助初學者對照
import { useMemo } from 'react';
import { bollinger, kd, macd, rsi, sma } from '../lib/indicators';
import { fmtPrice } from '../lib/format';
import type { Bar, Market } from '../lib/types';
import { Help } from './ui';

interface Reading { id: string; name: string; value: string; text: string; tone: 'bull' | 'bear' | 'neutral' }

export function readIndicators(bars: Bar[], market: Market): Reading[] {
  const n = bars.length;
  if (n < 30) return [];
  const c = bars.map((b) => b.close);
  const last = c[n - 1];
  const out: Reading[] = [];

  const m5 = sma(c, 5), m20 = sma(c, 20), m60 = sma(c, 60);
  if (m20[n - 1] != null) {
    const a5 = m5[n - 1]!, a20 = m20[n - 1]!, a60 = m60[n - 1];
    let text = last > a20 ? '股價在月線（MA20）之上' : '股價在月線（MA20）之下';
    let tone: Reading['tone'] = last > a20 ? 'bull' : 'bear';
    if (a60 != null) {
      if (a5 > a20 && a20 > a60) { text += '，均線多頭排列'; tone = 'bull'; }
      else if (a5 < a20 && a20 < a60) { text += '，均線空頭排列'; tone = 'bear'; }
      else { text += '，均線糾結（方向不明）'; tone = 'neutral'; }
    }
    const crossUp = m5[n - 2] != null && m5[n - 2]! <= m20[n - 2]! && a5 > a20;
    const crossDn = m5[n - 2] != null && m5[n - 2]! >= m20[n - 2]! && a5 < a20;
    if (crossUp) text += '；今天 MA5 向上穿越 MA20（黃金交叉）';
    if (crossDn) text += '；今天 MA5 向下跌破 MA20（死亡交叉）';
    out.push({ id: 'ma', name: '均線', value: `MA20 ${fmtPrice(a20, market)}`, text, tone });
  }

  const r = rsi(c)[n - 1];
  if (r != null) {
    out.push({
      id: 'rsi', name: 'RSI(14)', value: r.toFixed(1),
      text: r >= 70 ? '超買區：短線漲多，留意拉回（強勢股可能持續鈍化）' : r <= 30 ? '超賣區：短線跌深，可能出現反彈' : r >= 50 ? '偏強：上漲力道大於下跌' : '偏弱：下跌力道大於上漲',
      tone: r >= 70 ? 'bear' : r <= 30 ? 'bull' : r >= 50 ? 'bull' : 'bear',
    });
  }

  const k = kd(bars);
  const K = k.K[n - 1], D = k.D[n - 1], pK = k.K[n - 2], pD = k.D[n - 2];
  if (K != null && D != null && pK != null && pD != null) {
    let text = K >= 80 ? '高檔區' : K <= 20 ? '低檔區' : '中間區域';
    if (pK <= pD && K > D) text += '，K 向上穿越 D（黃金交叉）';
    else if (pK >= pD && K < D) text += '，K 向下跌破 D（死亡交叉）';
    else text += K > D ? '，K 在 D 之上' : '，K 在 D 之下';
    out.push({ id: 'kd', name: 'KD(9)', value: `K ${K.toFixed(1)} / D ${D.toFixed(1)}`, text, tone: K > D ? 'bull' : 'bear' });
  }

  const m = macd(c);
  const h = m.hist[n - 1], ph = m.hist[n - 2], dif = m.dif[n - 1];
  if (h != null && ph != null && dif != null) {
    let text = dif > 0 ? 'DIF 在 0 軸上（多頭格局）' : 'DIF 在 0 軸下（空頭格局）';
    if (ph <= 0 && h > 0) text += '，柱狀體翻正（黃金交叉）';
    else if (ph >= 0 && h < 0) text += '，柱狀體翻負（死亡交叉）';
    else text += Math.abs(h) < Math.abs(ph) ? '，柱狀體縮短（動能減弱）' : '，柱狀體放大（動能增強）';
    out.push({ id: 'macd', name: 'MACD', value: `柱 ${h.toFixed(2)}`, text, tone: h > 0 ? 'bull' : 'bear' });
  }

  const b = bollinger(c);
  const up = b.upper[n - 1], lo = b.lower[n - 1];
  if (up != null && lo != null) {
    const pos = (last - lo) / (up - lo);
    const width = (up - lo) / b.mid[n - 1]!;
    out.push({
      id: 'boll', name: '布林通道', value: `位置 ${(pos * 100).toFixed(0)}%`,
      text: (pos > 1 ? '突破上軌' : pos < 0 ? '跌破下軌' : pos > 0.8 ? '靠近上軌' : pos < 0.2 ? '靠近下軌' : '在通道中段') + `，通道寬度 ${(width * 100).toFixed(1)}%`,
      tone: 'neutral',
    });
  }
  return out;
}

export function Readings({ bars, market }: { bars: Bar[]; market: Market }) {
  const rs = useMemo(() => readIndicators(bars, market), [bars, market]);
  if (!rs.length) return null;
  return (
    <div className="card">
      <div className="card-title">目前指標讀數 <span className="muted small">（日線，僅供學習參考）</span></div>
      <div className="readings">
        {rs.map((r) => (
          <div key={r.id} className={`reading ${r.tone}`}>
            <div className="r-head"><b>{r.name}</b><Help id={r.id} /><span className="r-val">{r.value}</span></div>
            <div className="r-text">{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
