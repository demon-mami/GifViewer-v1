# GifViewer-v1

55体のCodex Petを、電子カタログのように1ページずつ確認・選別する個人用ビューアです。

## 操作

- 右から左へスワイプ: 次のPet
- 左から右へスワイプ: 前のPet
- `♥`: キャラクター構造を採用
- `★`: そのActionの動きを採用
- `かくにん > ♥ キャラ`: Petを選択すると9種の動作を通常速度で表示
- `かくにん > ★ 動き`: 採用したActionを共通の正規化フレーム軸で同期表示
- 判定・進捗・メモ: ブラウザのlocalStorageへ自動保存
- `結果を書き出す`: `codex_pet_selection.json` を出力

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
