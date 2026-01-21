# Competitor Screenshot Tool

競合サイトのスクリーンショットを自動で収集するツールです。

---

## 🚀 起動方法（重要！）

### 🎯 一番簡単な方法（推奨）

**起動アイコンをダブルクリックするだけ！**

1. デスクトップにある「**プロトタイプ**」フォルダを開く
2. 「**競合スクショツール.command**」をダブルクリック
3. ターミナルが自動で開いて、WebサーバーとWorkerが起動します
4. 3秒後に自動でブラウザが開きます（http://localhost:3000）

✅ これだけで完了！

**場所**: `デスクトップ > プロトタイプ > 競合スクショツール.command`

### 停止方法

ターミナルで `Ctrl + C` を押す

---

### 別の起動方法（ターミナルから）

#### 方法1: 1つのコマンドで起動

```bash
cd /Users/haruka.tashiro/Documents/プロトタイプ/competitor-screenshot-tool
npm run app
```

自動的にWebサーバーとWorkerが起動します。

#### 方法2: 個別に起動（ターミナル2つ使用）

**ターミナル1: Webサーバー**
```bash
cd /Users/haruka.tashiro/Documents/プロトタイプ/competitor-screenshot-tool
npm run dev
```

**ターミナル2: Worker**
```bash
cd /Users/haruka.tashiro/Documents/プロトタイプ/competitor-screenshot-tool
npm run worker
```

---

## 📝 使い方

1. ブラウザで http://localhost:3000 を開く
2. **コレクション名**を入力（半角英数字のみ）
3. **URLを追加**にスクリーンショットを撮りたいURLを1行ずつ入力
4. **コレクション作成**ボタンをクリック
5. 自動的にスクリーンショットが撮影されます（バックグラウンドで実行）
6. 完了したら**ダウンロード**ボタンでZIPファイルをダウンロード

---

## 機能

- **URL手動追加**: 任意のURLを一括で追加可能
- **自動スクリーンショット収集**: Playwrightでフルページスクリーンショットを自動撮影
- **Miro対応**: 画像を自動最適化（30MB以下、8192×4096px以下、32MP以下）
- **進捗表示**: リアルタイムで収集状況を確認
- **ZIPエクスポート**: スクリーンショット一式をまとめてダウンロード
- **失敗URL再試行**: 失敗したURLのみ再試行可能

---

## 🛠️ 初回セットアップ（初めて起動する時だけ）

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. データベースのセットアップ

```bash
npm run db:push
```

これでSQLiteデータベースが作成され、Prisma Clientが生成されます。

### 3. Playwrightブラウザのインストール

```bash
npx playwright install chromium
```

※ 通常は `npm install` 時に自動実行されます

---

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: SQLite + Prisma
- **スクリーンショット**: Playwright (Chromium)
- **画像最適化**: Sharp
- **ジョブ処理**: DBポーリング型Workerプロセス

---

## 詳細な使い方

### URLの追加例

コレクション作成時またはコレクション詳細ページで、URLを改行区切りで入力：

```
https://www.google.com
https://github.com
https://www.netlify.com
https://vercel.com
```

### スクリーンショット収集の流れ

1. URLを追加すると、自動的に「待機中」ステータスになります
2. Workerプロセスが順次スクリーンショットを撮影します
3. 進捗状況がリアルタイムで更新されます（総数/完了/失敗/待機中）
4. 失敗したURLは「失敗したURLを再試行」ボタンで再試行できます

### ZIPダウンロード

**ZIPファイル名の形式:**
`{コレクション名}_{YYYYMMDD_HHmmss}.zip`

例: `競合調査_20250104_143025.zip`

**ZIPの内容（フラット構造）:**
```
競合調査_20250104_143025.zip/
├── index.json                           # メタデータ一覧
├── google.com_1735951234567.png
├── github.com_1735951234568.png
├── netlify.com_1735951234569.png
└── ...
```

※ PNGファイル名はURL + タイムスタンプ形式で自動生成されます

## プロジェクト構成

```
competitor-screenshot-tool/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   └── collections/          # Collection関連API
│   ├── collections/[id]/         # Collection詳細ページ
│   ├── page.tsx                  # トップページ
│   └── layout.tsx                # レイアウト
├── worker/                       # Workerプロセス
│   ├── index.ts                  # メインWorker
│   └── screenshot.ts             # スクリーンショット処理
├── lib/                          # 共通ライブラリ
│   └── prisma.ts                 # Prisma Client
├── prisma/
│   └── schema.prisma             # データベーススキーマ
├── data/                         # スクリーンショット保存先
└── .env                          # 環境変数
```

## npm スクリプト

- `npm run app` - **Webサーバー + Worker を同時起動（推奨）**
- `npm run dev` - Next.js開発サーバー起動のみ
- `npm run worker` - Workerプロセス起動のみ
- `npm run build` - プロダクションビルド
- `npm run start` - プロダクションサーバー起動
- `npm run db:push` - Prismaスキーマをデータベースに反映
- `npm run db:studio` - Prisma Studio起動（DB閲覧ツール）

## 設定

### Worker設定（worker/index.ts）

```typescript
const POLL_INTERVAL = 3000;      // ポーリング間隔（3秒）
const MAX_CONCURRENT = 2;        // 同時実行数
const RETRY_LIMIT = 2;           // 最大リトライ回数
```

### スクリーンショット設定（worker/screenshot.ts）

```typescript
const SCREENSHOT_VIEWPORT = {
  width: 1440,
  height: 900,
};
const PAGE_TIMEOUT = 60000;      // ページタイムアウト（60秒）
```

### Miro対応の画像制限（worker/screenshot.ts）

```typescript
const MAX_FILE_SIZE_MB = 30;     // 最大ファイルサイズ: 30MB
const MAX_WIDTH = 8192;          // 最大幅: 8192px
const MAX_HEIGHT = 4096;         // 最大高さ: 4096px
const MAX_RESOLUTION = 32_000_000; // 最大解像度: 32MP
```

※ これらの制限を超える画像は自動的にリサイズ・圧縮されます

## ❓ トラブルシューティング

### エラー: `npm: command not found`

Node.jsがインストールされていません。以下からインストールしてください：
https://nodejs.org/

### エラー: `Cannot find module`

依存関係をインストールする必要があります：

```bash
npm install
```

### スクリーンショットが撮れない

**原因1: Workerが起動していない**
- ターミナル2で `npm run worker` が実行されているか確認してください

**原因2: Playwrightブラウザが未インストール**
```bash
npx playwright install chromium
```

**原因3: URLがアクセスできない**
- 対象URLがブラウザで正常に開けるか確認してください

### ずっと「待機中」のまま進まない

**対処法1: ブラウザをリロード**
- F5 または Cmd+R でページをリロードしてください
- ブラウザのキャッシュが原因の場合があります

**対処法2: Workerのログを確認**
- ターミナル2（Workerプロセス）でエラーが出ていないか確認

**対処法3: データベースの状態を確認**
```bash
npx tsx check-status.ts
```

### スクリーンショット取得に頻繁に失敗する

一部のサイトはタイムアウトしやすい場合があります。以下の設定で調整できます：

`worker/screenshot.ts` の19行目:
```typescript
const PAGE_TIMEOUT = 60000; // 60秒（必要に応じて延長）
```

### データベースエラーが発生する

データベースを削除して再作成：
```bash
rm prisma/dev.db
npm run db:push
```

### データベースの中身を確認したい

Prisma Studioを起動：
```bash
npm run db:studio
```

ブラウザで http://localhost:5555 が開き、データベースの内容を確認・編集できます

## 📦 データの保存場所

### スクリーンショット
`/Users/haruka.tashiro/Documents/プロトタイプ/competitor-screenshot-tool/public/screenshots/`

### データベース
`/Users/haruka.tashiro/Documents/プロトタイプ/competitor-screenshot-tool/prisma/dev.db`

※ これらのファイルは削除しない限り保存されます

---

## ⚠️ 注意事項

- robots.txtや利用規約を尊重し、短時間に大量アクセスしないでください
- 同時実行数を適切に制限してください（デフォルト: 2）
- スクリーンショットファイルは自動削除されないため、定期的にクリーンアップしてください

---

## 📚 参考情報

### 主要な npm スクリプト

- `npm run dev` - Next.js開発サーバー起動（ポート3000）
- `npm run worker` - Workerプロセス起動（スクリーンショット撮影）
- `npm run db:studio` - データベース管理画面起動（ポート5555）
- `npm run db:push` - Prismaスキーマをデータベースに反映

### 技術スタック詳細

- **Next.js 15**: App Routerを使用したフルスタックフレームワーク
- **Prisma**: TypeScript用のORMツール
- **Playwright**: ブラウザ自動化ツール（Chromiumを使用）
- **Sharp**: 高速な画像処理ライブラリ
- **Archiver**: ZIP圧縮ライブラリ
- **Tailwind CSS**: ユーティリティファーストのCSSフレームワーク
