'use client';

import type { CalcItem, MasterData } from '@/types';
import { getDeliveryDate, shortDate, dayName } from '@/lib/dates';

interface Props {
  master: MasterData;
  orderDate: string;
  weather: string;
  results: CalcItem[] | null;
  onCompute: () => CalcItem[] | null;
}

export default function DeliverySummaryPanel({ master, orderDate, weather, results, onCompute }: Props) {
  const items = results || onCompute() || [];
  const withQty = items.filter((it) => it.totalUnits > 0);
  const deliveryDate = getDeliveryDate(orderDate);

  const storeTotals = master.storeOrder.map((_, si) =>
    withQty.reduce((a, it) => a + (it.allocations[si] || 0), 0)
  );

  return (
    <div className="mobile-panel">
      <header className="mobile-panel-head">
        <h2 className="mobile-panel-title">各店舗 納品数</h2>
        <p className="mobile-panel-sub">
          納品 {shortDate(deliveryDate)}（{dayName(deliveryDate)}）· {weather}
        </p>
      </header>

      <div className="delivery-store-cards">
        {master.storeOrder.map((store, si) => (
          <div key={store} className="delivery-store-card">
            <p className="delivery-store-name">{master.storeShortNames[store] || store}</p>
            <p className="delivery-store-total">{storeTotals[si]}<span>個</span></p>
          </div>
        ))}
      </div>

      <div className="delivery-detail-scroll">
        <table className="delivery-detail-table">
          <thead>
            <tr>
              <th>商品</th>
              {master.storeOrder.map((s) => (
                <th key={s}>{master.storeShortNames[s]}</th>
              ))}
              <th>計</th>
            </tr>
          </thead>
          <tbody>
            {withQty.map((it) => (
              <tr key={it.productName}>
                <td className="delivery-prod">{it.productName}</td>
                {it.allocations.map((v, i) => (
                  <td key={i} className={v > 0 ? 'delivery-qty' : 'delivery-qty delivery-qty--zero'}>{v || '—'}</td>
                ))}
                <td className="delivery-qty delivery-qty--sum">{it.totalUnits}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!withQty.length && (
          <p className="mobile-empty">発注データがありません。PC版で計算するか、入力後に自動計算されます。</p>
        )}
      </div>
    </div>
  );
}
