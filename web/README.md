# キリン堂 青果 発注・振分

Next.js + Supabase + Vercel 版（GAS から移行）

## 機能

- 4店舗 × 85品の発注・振分計算
- 販売/ロス日付別入力、CSV数量比率按分
- 神戸市天候予報連携（Open-Meteo）
- 確認マトリクス・Excel書き出し（A4印刷用）
- 週次ラベル発行
- CSV販売実績取込（Shift_JIS）

## セットアップ

### 1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) で新規プロジェクト作成
2. **SQL Editor** で `supabase/migrations/001_schema.sql` を実行

### 2. 環境変数

```bash
cd web
cp .env.example .env.local
```

`.env.local` に設定:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Supabase → Settings → API から取得

### 3. ローカル開発

```bash
cd web
npm install
npm run dev
```

初回アクセス時にマスタ（4店×85品）が自動投入されます。

### 4. CSV取込

**ラベル**タブ → CSVファイルを選択（複数可）

または一括:

```bash
# ローカルから（任意）
curl -X POST http://localhost:3000/api/import-sales \
  -F "files=@売上CSV1.csv" -F "files=@売上CSV2.csv"
```

### 5. GitHub

```bash
cd web
git init
git add .
git commit -m "feat: migrate from GAS to Next.js + Supabase"
git remote add origin https://github.com/YOUR_USER/kirindo-order.git
git push -u origin main
```

### 6. Vercel デプロイ

1. [vercel.com](https://vercel.com) → Import Git Repository
2. Root Directory: `web`
3. Environment Variables に `.env.local` と同じ3つを設定
4. Deploy

## API

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/master` | マスタ一括取得 |
| POST | `/api/setup` | マスタ初期投入 |
| GET | `/api/store-input?salesDate=&lossDate=` | 販売/ロス実績 |
| GET | `/api/weather?orderDate=` | 神戸天候予報 |
| POST | `/api/orders` | 発注確定保存 |
| POST | `/api/labels` | 週次ラベル発行 |
| POST | `/api/import-sales` | CSV取込 (multipart) |

## ディレクトリ

```
web/
├── src/
│   ├── app/           # Next.js App Router
│   ├── components/    # React UI
│   ├── lib/           # 計算・CSV・Excel
│   ├── data/          # real-master.json
│   └── types/
├── supabase/migrations/
└── package.json
```

## GAS からの移行メモ

| GAS | Next.js |
|-----|---------|
| Spreadsheet | Supabase PostgreSQL |
| Drive CSV | ファイルアップロード |
| `google.script.run` | `/api/*` fetch |
| SheetJS CDN | `xlsx` npm package |
| clasp deploy | Vercel git push |
