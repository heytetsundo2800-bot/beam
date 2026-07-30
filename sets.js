/* ============================================================
   BEAM ／ 基本セット定義ファイル
   ============================================================

   ここが「全端末に共通で出るセット」の定義です。
   このファイルを書き換えて GitHub に push すると、
   Vercel が自動でデプロイし、鉄人さんのスマホ・メンバーのスマホ・
   パソコン、すべてに反映されます。

   ▼ 書き方
     {
       name: "カードに出す名前",        ← 必須
       url:  "https://...",             ← 必須（渡すURL）
       note: "小さく出る補足"            ← 任意。空でもOK
     }

   ▼ 並び順 = そのまま画面の並び順です。
     よく渡すものを上に置いてください。

   ▼ 注意
     ・url は必ず https:// から始めること
     ・行末の カンマ , を消さないこと
     ・文字は " " で囲むこと
   ============================================================ */

window.BEAM_SETS = [
  {
    name: "ROCKETs 公式サイト",
    url: "https://rockets-band.vercel.app",
    note: "ライブ情報・音源・写真・物販 ぜんぶここ"
  },
  {
    name: "X（旧Twitter）",
    url: "https://x.com/rocket_band04",
    note: "@rocket_band04"
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/rockets_official/",
    note: "@rockets_official"
  },
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@rockets_band",
    note: "@rockets_band"
  }
];
