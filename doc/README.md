# LEVERIE — 設計・仕様ドキュメント

このディレクトリは **コントリビュータ／保守者向け** の設計・仕様を格納します。実装やテストが拠り所とする「正の仕様」と、公開ドキュメントには載せない内部設計が対象です。

- **ツールの使い方（how to use）** は公開ドキュメント **[leverie.dev/docs](https://leverie.dev/docs)** を参照してください。
- **コンセプトと開発者向けの概要** はリポジトリルートの [README.md](../README.md) を参照してください。

## 振る舞いの仕様（`@leverie/*` パッケージの契約）

評価エンジン・品質チェック・スキーマが実装すべき正の定義。挙動を変える際はこのドキュメントとテストを合わせて更新してください。

| ファイル | 内容 |
| --- | --- |
| [spec_data_model.md](spec_data_model.md) | データモデル（永続化するJSON形式・各オブジェクトのフィールド仕様） |
| [spec_field_types.md](spec_field_types.md) | フィールド型と条件演算子の一覧・保存形式 |
| [spec_evaluation.md](spec_evaluation.md) | 評価モデル（実行アルゴリズム・型強制・トレース・返却値） |
| [spec_quality_checks.md](spec_quality_checks.md) | 品質チェック（重複検出・到達不能行・カバレッジ等）の定義 |

## クラウド基盤の設計

| ファイル | 内容 |
| --- | --- |
| [design_schema.md](design_schema.md) | Cloud Foundation のデータモデル／DBスキーマ設計（テナント分離・マイグレーション方針等） |
| [design_infrastructure.md](design_infrastructure.md) | Cloud Foundation のインフラ設計（ホスティング・認証・ジョブ・シークレット・監視・CI/CD等） |

## ロードマップ

| ファイル | 内容 |
| --- | --- |
| [roadmap.md](roadmap.md) | 将来拡張（優先度低）の検討メモ |
