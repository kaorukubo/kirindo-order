'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import {
  LABEL_FIELD_LABELS,
  formatPriceYen,
  type LabelFieldKey,
  type LabelTemplate,
  type ProductLabelInfo,
} from '@/lib/label-types';

interface Props {
  info: ProductLabelInfo;
  storeName?: string;
  template?: LabelTemplate;
  className?: string;
}

function BarcodeSvg({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: value.length === 13 || value.length === 8 ? 'EAN13' : 'CODE128',
        displayValue: true,
        fontSize: 11,
        height: 36,
        margin: 0,
      });
    } catch {
      JsBarcode(svgRef.current, value, { format: 'CODE128', displayValue: true, fontSize: 11, height: 36, margin: 0 });
    }
  }, [value]);
  if (!value) return <div className="label-barcode-placeholder">バーコード未設定</div>;
  return <svg ref={svgRef} className="label-barcode-svg" />;
}

function FieldRow({ label, value, visible }: { label: string; value: string; visible: boolean }) {
  if (!visible || !value) return null;
  return (
    <div className="label-field-row">
      <span className="label-field-key">{label}</span>
      <span className="label-field-val">{value}</span>
    </div>
  );
}

export default function LabelPreview({ info, storeName, template = 'standard', className = '' }: Props) {
  const v = info.visibility;
  const rows: { key: LabelFieldKey; text: string }[] = [
    { key: 'seller', text: info.seller },
    { key: 'processor', text: info.processor },
    { key: 'origin', text: info.origin },
    { key: 'netWeight', text: info.netWeight },
    { key: 'storageMethod', text: info.storageMethod },
    { key: 'ingredients', text: info.ingredients },
  ];

  return (
    <div className={`label-preview label-preview--${template} ${className}`}>
      <div className="label-preview-head">
        {v.productName && <p className="label-product-name">{info.productName}</p>}
        {v.unitPrice && <p className="label-price">{formatPriceYen(info.unitPrice)}</p>}
      </div>
      {v.barcode && (
        <div className="label-barcode-wrap">
          <BarcodeSvg value={info.barcode} />
        </div>
      )}
      <div className="label-meta">
        {rows.map((r) => (
          <FieldRow key={r.key} label={LABEL_FIELD_LABELS[r.key]} value={r.text} visible={v[r.key]} />
        ))}
      </div>
      {storeName && <p className="label-store-tag">{storeName}</p>}
      <p className="label-brand">Kirindo</p>
    </div>
  );
}
