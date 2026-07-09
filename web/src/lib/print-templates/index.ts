/**
 * 印刷テンプレート設定（フォーマット受領後に差し替え）
 *
 * 畑光発注書 Excel:
 *   - 現状: lib/excel-export.ts の buildPrintRows（セル配列）
 *   - 将来: public/templates/hatako-order.xlsx をベースにセル埋め込み
 *
 * ラベル:
 *   - 現状: components/LabelPreview.tsx（HTML/CSS + jsbarcode）
 *   - 将来: public/templates/label.xlsx または専用レイアウトJSON
 */

export type TemplateKind = 'hatakoOrder' | 'label';

export interface PrintTemplateConfig {
  kind: TemplateKind;
  engine: 'builtin' | 'xlsx-template';
  /** カスタムテンプレートファイル（public/ からの相対パス）。null=組み込み */
  templatePath: string | null;
  version: string;
}

export const PRINT_TEMPLATES: Record<TemplateKind, PrintTemplateConfig> = {
  hatakoOrder: {
    kind: 'hatakoOrder',
    engine: 'builtin',
    templatePath: null, // 例: '/templates/hatako-order.xlsx'
    version: 'legacy-aoa-v1',
  },
  label: {
    kind: 'label',
    engine: 'builtin',
    templatePath: null, // 例: '/templates/kirindo-label.json'
    version: 'html-preview-v1',
  },
};

export function isCustomTemplateReady(kind: TemplateKind): boolean {
  return PRINT_TEMPLATES[kind].templatePath != null;
}
