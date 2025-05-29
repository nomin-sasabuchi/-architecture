# 上流工程から設計、実装までの一連の流れを「リバーシAPP」を通じて学ぶ

このプロジェクトは、TypeScript、Express.js、MySQL を使用した MVC アーキテクチャの Web アプリケーションです。

## 技術スタック

- **バックエンド**: Node.js + Express.js
- **言語**: TypeScript
- **データベース**: MySQL
- **パッケージマネージャー**: pnpm
- **開発ツール**:
  - nodemon (ホットリロード)
  - ts-node (TypeScript 実行環境)

## 必要条件

- Node.js
- pnpm
- MySQL
- Docker (オプション)

## セットアップ

1. リポジトリのクローン

```bash
git clone [リポジトリURL]
cd mvc
```

2. 依存関係のインストール

```bash
pnpm install
```

3. 環境変数の設定
   必要な環境変数を設定してください。

4. データベースのセットアップ

```bash
# Dockerを使用する場合
docker-compose up -d
```

## 開発サーバーの起動

```bash
pnpm start
```

開発サーバーは `http://localhost:3000` で起動します。

## プロジェクト構造

```
├── src/          # ソースコード
├── static/       # 静的ファイル
├── mysql/        # データベース関連ファイル
├── docs/         # ドキュメント
└── training/     # トレーニング関連ファイル
```

## ライセンス

ISC
