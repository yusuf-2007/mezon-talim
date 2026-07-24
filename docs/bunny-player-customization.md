# Bunny player customization (question markers as gold bars)

In-video question timestamps are synced to Bunny as **moments** (see
`lib/content/video-question-actions.ts` → `syncMomentsForLesson`), and the
embed player renders them on its own seek bar. By default they are small
white dots. The player's markup is plain DOM (class `sp__moment`, no shadow
DOM — verified 2026-07-24), so library-level custom CSS can restyle them.

## Turn the dots into gold vertical bars

Bunny dashboard → **Stream** → your library → **Player** settings:

1. *(optional)* Set **Player key color** to `#C9A227` — makes the progress
   bar and control accents brand-gold too.
2. In **Custom HTML head** (a.k.a. custom code), paste:

```html
<style>
  /* Mezon Ta'lim: in-video question markers as gold vertical bars */
  .sp__moment {
    width: 4px !important;
    height: 14px !important;
    border-radius: 2px !important;
    background: #C9A227 !important;
    top: 50% !important;
    transform: translate(-50%, -50%) !important;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35) !important;
  }
</style>
```

3. Save. Applies to every video in the library immediately (hard-refresh the
   lesson page to bypass the cached embed).

Verified against the live embed: default marker was a 12px white 50%-opacity
circle; with this CSS it renders as a 4×14 gold bar (screenshot in session
notes, 2026-07-24).

## 10-second skip controls

**Native (recommended):** the player has built-in ±10s jump buttons — the
classic (Plyr-based) player ships `plyr__control--forward` / `--back`
buttons; enable them in the dashboard → Stream → library → **Player** →
Controls (rewind / fast-forward toggles). Works on mobile and desktop,
zero custom code.

**Double-tap gesture (experimental):** the player has NO built-in
double-tap-to-seek (verified against the live embed 2026-07-25 — the
gesture does nothing by default). It can be added through the same
**Custom HTML head** used for the gold markers; the snippet below drives
the player's own seek input (same code path as dragging the bar) and shows
a "+10s »"/"« -10s" toast. Tested on the live embed: reliable except that
the very first jump after page load can occasionally be swallowed by the
player's init (an internal race). Try it on a real phone; remove it if it
feels off.

```html
<script>
(function () {
  var lastTap = 0, lastX = 0;
  function jump(delta, side) {
    var v = document.querySelector('video');
    if (!v || !v.duration) return;
    var target = Math.max(0, Math.min(v.duration, v.currentTime + delta));
    var input = document.querySelector('input[data-plyr=seek], .plyr__progress input[type=range]');
    if (input) {
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, (target / v.duration) * 100);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      v.currentTime = target;
    }
    var el = document.createElement('div');
    el.textContent = delta > 0 ? '+10s »' : '« -10s';
    el.style.cssText = 'position:fixed;top:50%;' + (side === 'r' ? 'right:8%' : 'left:8%') +
      ';transform:translateY(-50%);background:rgba(0,0,0,.6);color:#fff;padding:10px 14px;' +
      'border-radius:999px;font:600 14px system-ui;z-index:2147483647;pointer-events:none';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 600);
  }
  document.addEventListener('touchend', function (e) {
    if (e.touches.length) return;
    var now = Date.now();
    var touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    var x = touch.clientX, w = window.innerWidth;
    if (now - lastTap < 350 && Math.abs(x - lastX) < 60) {
      if (x > w * 0.65) jump(10, 'r');
      else if (x < w * 0.35) jump(-10, 'l');
      lastTap = 0;
    } else { lastTap = now; lastX = x; }
  }, true);
})();
</script>
```

## Caveats

- This targets Bunny's **classic** player markup. If the library is ever
  switched to Bunny's new Media Chrome-based player, the `sp__*` selectors
  stop matching and this CSS needs re-verification (their new player uses
  web components / different structure).
- Library **settings** (key color, custom head) require the account-level
  API key, which we deliberately do not store — dashboard-only by design.
- Bunny moments are per-video and identical for every viewer; per-student
  answered state (gold → green) lives on the in-app strip under the video.
