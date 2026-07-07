# キリン堂 青果 発注・振分

## 新アプリ（Next.js + Supabase + Vercel）

**→ [`web/`](web/)** ディレクトリが本番アプリです。

```bash
cd web
npm install
cp .env.example .env.local   # Supabase キーを設定
npm run dev
```

詳細: [web/README.md](web/README.md)

## レガシー（GAS）

旧 Google Apps Script 版はルートの `Code.gs`, `Index.html` に残っています。
移行完了後は使用しません。
