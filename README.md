# GifViewer-v1

55体のCodex Petを、縦スクロール型の電子カタログとして確認・選別する個人用ビューアです。

## 操作

- 下方向へスクロール: 次のPet
- 上方向へスクロール: 前のPet
- `♥`: キャラクター構造を採用
- `★`: そのActionの動きを採用
- `かくにん > ♥ キャラ`: Petを選択すると9種の動作を通常速度で表示
- `かくにん > ★ 動き`: 採用したActionを共通の正規化フレーム軸で同期表示
- 判定・進捗・メモ: ブラウザのlocalStorageへ自動保存
- `結果を書き出す`: `codex_pet_selection.json` を出力

## カタログ番号

Petには `01` から `55` まで固定番号を付与しています。結果JSONにも `catalogNo` を保存します。

## パフォーマンス方針

- 55ページはネイティブ縦スクロールで表示
- スクロール中はPetアニメーション描画を停止
- スクロール停止後、主表示1ページの9 Actionのみ再生
- 前後1 Petのspritesheetだけ先読み
- 確認一覧のサムネイルは遅延読み込み

## 構成

静的HTML/CSS/JavaScriptのみです。Petのspritesheetは `codex-pets.net` の公開アセットURLから読み込みます。

```text
index.html
app.js
style.css
data/
  pets.js
  build_summary.json
```

GitHub Pages等の静的ホスティングでそのまま利用できます。
