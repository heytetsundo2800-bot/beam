"""BEAM アイコン生成スクリプト（開発用）
   実行: python3 tools/make_icons.py
   出力: icons/ 以下の PNG 一式
"""
from PIL import Image, ImageDraw
import os

BG = (11, 11, 11)
FG = (255, 255, 255)
SS = 4  # スーパーサンプリング倍率（アンチエイリアス用）

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
os.makedirs(OUT, exist_ok=True)


def render(size, mark_ratio=0.72, radius_ratio=0.0):
    """size: 出力ピクセル / mark_ratio: マークの占有率 / radius_ratio: 角丸（0=四角）"""
    S = size * SS
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img)

    cx = cy = S / 2
    u = S * mark_ratio / 2.0          # マーク半径の基準

    dot_r = u * 0.21
    w = max(2, int(u * 0.165))        # 線の太さ

    d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=FG)

    for r_ratio in (0.58, 1.0):
        r = u * r_ratio
        box = [cx - r, cy - r, cx + r, cy + r]
        d.arc(box, start=-52, end=52, fill=FG, width=w)     # 右向きの波
        d.arc(box, start=128, end=232, fill=FG, width=w)    # 左向きの波

    img = img.resize((size, size), Image.LANCZOS)

    if radius_ratio > 0:
        mask = Image.new("L", (size * SS, size * SS), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size * SS - 1, size * SS - 1],
            radius=int(size * SS * radius_ratio), fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img


render(192).save(os.path.join(OUT, "icon-192.png"))
render(512).save(os.path.join(OUT, "icon-512.png"))
render(180).save(os.path.join(OUT, "apple-touch-icon.png"))
# maskable は端末が角を大きく削るので、マークを小さめにして安全域を確保する
render(512, mark_ratio=0.50).save(os.path.join(OUT, "maskable-512.png"))

print("done:", sorted(os.listdir(OUT)))
