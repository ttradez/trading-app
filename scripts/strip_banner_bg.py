"""Strip the baked-in black background from each rank banner PNG.

For every assets/ranks/*-banner.png:
  - Read RGBA.
  - Build a near-black mask (per-pixel max(R,G,B) <= THRESHOLD).
  - Use 4-connectivity label() to find connected components of near-black.
  - Any component that touches the top/bottom/left/right border gets
    its alpha zeroed (= background). Interior dark detail in the
    emblem / frame keeps its alpha (= NOT a hole).
  - Light Gaussian feather (radius 1) on the alpha channel so the cut
    isn't a hard step.
  - Write to assets/ranks/transparent/{same-filename}.png. Originals
    in assets/ranks/ are left untouched as a fallback.
  - Print per-file %-of-pixels-made-transparent for a sanity check.

Run from anywhere; the script resolves paths relative to itself.
Requires pillow, numpy, scipy. The script will pip-install them on
first run if any is missing.
"""

import os
import subprocess
import sys
from pathlib import Path


THRESHOLD = 45                       # near-black brightness cutoff, 0-255
FEATHER_RADIUS = 1                   # Gaussian blur radius on alpha (px)


def ensure_deps():
    """Install pillow, numpy, scipy if any are missing."""
    missing = []
    for mod, pip_name in (("PIL", "pillow"), ("numpy", "numpy"), ("scipy", "scipy")):
        try:
            __import__(mod)
        except ImportError:
            missing.append(pip_name)
    if missing:
        print(f"Installing missing packages: {' '.join(missing)}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])


def main():
    ensure_deps()

    # Imports after the install so the freshly-installed modules are visible.
    import numpy as np
    from PIL import Image, ImageFilter
    from scipy.ndimage import label

    script_dir = Path(__file__).resolve().parent
    assets_dir = script_dir.parent / "assets" / "ranks"
    out_dir = assets_dir / "transparent"
    out_dir.mkdir(parents=True, exist_ok=True)

    banner_paths = sorted(assets_dir.glob("*-banner.png"))
    if not banner_paths:
        print(f"No *-banner.png files in {assets_dir}")
        return

    for src in banner_paths:
        img = Image.open(src).convert("RGBA")
        arr = np.array(img)               # shape (H, W, 4)
        rgb = arr[..., :3]
        alpha = arr[..., 3]

        # Per-pixel brightness, near-black mask.
        brightness = rgb.max(axis=-1)
        near_black = brightness <= THRESHOLD

        # 4-connectivity (default structure) → find connected components
        # of near-black pixels.
        labels, n_labels = label(near_black)

        # Collect every label id that appears anywhere on the border.
        border = np.concatenate([
            labels[0, :].ravel(),
            labels[-1, :].ravel(),
            labels[:, 0].ravel(),
            labels[:, -1].ravel(),
        ])
        border_labels = set(int(v) for v in border if v != 0)

        # Build a mask of "edge-connected near-black" pixels. Use a
        # vectorized in1d-on-flat-labels approach for speed.
        flat = labels.ravel()
        edge_mask_flat = np.isin(flat, list(border_labels))
        edge_mask = edge_mask_flat.reshape(labels.shape)

        # Zero alpha on the edge-connected near-black pixels.
        new_alpha = np.where(edge_mask, 0, alpha).astype(np.uint8)

        # Feather the cut: Gaussian-blur just the alpha channel by
        # radius 1 so edges aren't hard. Done via PIL on a single-band
        # image for correctness with the GaussianBlur filter.
        alpha_img = Image.fromarray(new_alpha, mode="L")
        alpha_blurred = alpha_img.filter(ImageFilter.GaussianBlur(radius=FEATHER_RADIUS))
        new_alpha = np.array(alpha_blurred, dtype=np.uint8)

        # Recombine.
        out_arr = arr.copy()
        out_arr[..., 3] = new_alpha
        out_img = Image.fromarray(out_arr, mode="RGBA")

        dst = out_dir / src.name
        out_img.save(dst)

        total_px = arr.shape[0] * arr.shape[1]
        transparent_px = int((new_alpha == 0).sum())
        pct = (transparent_px / total_px) * 100.0
        print(f"  {src.name:24s} -> {dst}  ({pct:5.1f}% transparent)")


if __name__ == "__main__":
    main()
