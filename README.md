# BEAM — かざして、渡す。

渡したいURLを、その場で目の前の人のスマホに届けるためのアプリ。
ライブハウスや大学で、バンドのホームページを直接手渡しするために作った。

- **作った人**：安達鉄人（ROCKETs / Dr）
- **公開URL**：（Vercel のデプロイ後にここへ記入）

---

## 使い方（3ステップ）

1. アプリを開いて、渡したいセットをタップ
2. 全画面にQRコードが出る → **相手のカメラに向ける**
3. 相手のブラウザでホームページが開く

iPhone相手なら、下の「共有」ボタンから **AirDrop** でも渡せる。
Androidの人にも、アプリを入れていない人にも、QRなら確実に渡せる。

### 最初にやっておくこと

スマホのSafariでこのURLを開き、**共有ボタン →「ホーム画面に追加」**。
アプリのアイコンになって、一瞬で開けるようになる。

---

## セットの中身を変えたい

セット（渡すURLのリスト）は2種類ある。

### ① 基本セット — 全端末に共通で出る

`sets.js` に書いてある。ここを書き換えて GitHub に push すると、
Vercel が自動でデプロイし、**メンバー全員のスマホもパソコンも一斉に更新される。**

```js
window.BEAM_SETS = [
  {
    name: "ROCKETs 公式サイト",
    url: "https://rockets-band.vercel.app",
    note: "ライブ情報・音源・写真・物販 ぜんぶここ"
  },
  ...
];
```

- `name` … カードに出る名前（必須）
- `url` … 渡すURL（必須・`https://` から書く）
- `note` … 小さく出る補足（任意）
- **並び順がそのまま画面の並び順**。よく渡すものを上に。

### ② 自分で追加したセット — その端末の中だけ

アプリの「＋ セットを追加」から作る。保存先はそのスマホの中（localStorage）。
会場でその場で追加したいとき用。**他の端末やメンバーには共有されない。**

---

## 技術的なこと

| | |
|---|---|
| 種類 | 静的サイト（PWA）。ビルド不要、フレームワークなし |
| ホスティング | Vercel（GitHub に push すると自動デプロイ） |
| QR生成 | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)（MIT）を `vendor/` に同梱 |
| オフライン | Service Worker で全ファイルをキャッシュ。**圏外の会場でも起動する** |
| 画面の消灯防止 | Screen Wake Lock API（QR表示中は画面が暗くならない） |
| 共有 | Web Share API（iOSでは共有シートが開き、AirDropも選べる） |
| ログイン | なし |

### ファイル構成

```
index.html              画面の骨組み
app.css                 見た目（白黒・ダークモード対応）
app.js                  動作
sets.js                 ★ 基本セットの定義。ここを編集する
vendor/qrcode.js        QR生成ライブラリ（同梱）
sw.js                   オフライン用 Service Worker
manifest.webmanifest    ホーム画面に追加したときの設定
vercel.json             キャッシュ設定
icons/                  アイコン
tools/make_icons.py     アイコン生成スクリプト（開発用）
tools/verify.mjs        自動検証スクリプト（開発用）
```

### 開発用コマンド

```bash
# アイコンを作り直す
python3 tools/make_icons.py

# ブラウザで実際に描画して検証（スクショが tools/shots に出る）
node tools/verify.mjs

# 生成されたQRが本当に正しいURLになっているか確認
zbarimg --raw tools/shots/iphone-qr.png
```

### 更新を反映するときの注意

Service Worker がファイルをキャッシュしている。更新が届かないときは、
`sw.js` の `var CACHE = 'beam-v1';` の数字を上げてから push すると確実。

---

## できないこと（確認済み）

- **アプリからAirDropを自動で発火させること。**
  iPhoneを重ねてURLが飛ぶ動作（NameDrop / 近接AirDrop）はiOSのOS機能で、
  アプリから呼び出すAPIが公開されていない。
  iOS 26の「Wi-Fi Aware」で近接通信自体は解禁されたが、
  **App Store配布のネイティブアプリ限定**で、Webアプリからは触れない。
- **Web NFC**（かざしてNFCで飛ばす）は Safari が非対応。Android Chrome のみ。

→ そのため、確実で相手を選ばない **QRコード** を主軸にしている。

---

## ライセンス

`vendor/qrcode.js` は Kazuhiko Arase 氏による MIT ライセンスのライブラリ。
