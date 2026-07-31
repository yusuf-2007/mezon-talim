# Bunny player customization (question markers)

In-video question timestamps are synced to Bunny as **moments** (see
`lib/content/video-question-actions.ts` → `syncMomentsForLesson`), and the
embed player renders them on its own seek bar. By default they are small
white dots, identical for every viewer, and unclickable (the seek
`<input type=range>` sits on top of them).

The snippet below fixes all three: gold/green/red bars, per student, that
seek to the exact question when clicked. It is a **dumb renderer** — the app
pushes state into the iframe over `postMessage`, so future changes to
colours or behaviour ship in the app and this never needs re-pasting.

## Install (one time)

Bunny dashboard → **Stream** → your library → **Player** → **Custom HTML
head**, paste the whole block, Save. It applies to every video in the
library immediately (hard-refresh a lesson page to bypass the cached embed).

```html
<style>
/* Mezon Ta'lim — question markers on Bunny's seek bar.
   The element keeps Bunny's 12px slot (correct centering + a real click
   target); the visible bar is drawn by ::before and colored via --vq. */
.sp__moment {
  box-sizing: border-box !important;
  width: 12px !important;
  height: 18px !important;
  /* Bunny's default marker is a bordered, shadowed box — clear all three or
     the (now empty) 12px slot still draws a grey rectangle. */
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  opacity: 1 !important;
  cursor: pointer !important;
}
.sp__moment::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 14px;
  border-radius: 2px;
  background: var(--vq, #f8b801);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}
</style>

<script>
/* Mezon Ta'lim — in-video question markers on Bunny's own seek bar.
   Driven by postMessage from components/player/video-embed.tsx. */
(function () {
  var GOLD = '#f8b801';
  var SNAP_PX = 9;
  var markers = [];
  var timers = [];

  function bar() {
    return document.querySelector('.sp__progressbar li') || document.querySelector('.sp__base');
  }
  function video() {
    return document.querySelector('video');
  }
  function dur() {
    var v = video();
    return v && isFinite(v.duration) ? v.duration : 0;
  }
  function seekInput() {
    return document.querySelector('input[data-plyr=seek], .plyr__progress input[type=range]');
  }

  function paint() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.sp__moment'));
    if (!els.length) return;
    var b = bar();
    var w = b ? b.getBoundingClientRect().width : 0;
    var d = dur();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var m = null;
      if (w && d && markers.length) {
        // Bunny positions each moment at (t/duration)*barWidth - 6 (half its
        // default 12px width), so add the 6 back to recover the timestamp.
        // Match by position, not index: Bunny's moment list can lag ours.
        var t = ((parseFloat(el.style.left) || 0) + 6) / w * d;
        for (var j = 0; j < markers.length; j++) {
          if (!m || Math.abs(markers[j].t - t) < Math.abs(m.t - t)) m = markers[j];
        }
      } else if (markers.length === els.length) {
        m = markers[i];
      }
      el.style.setProperty('--vq', (m && m.color) || GOLD);
    }
  }

  function cancelRetries() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function push(t) {
    var v = video();
    var input = seekInput();
    if (!v || !v.duration) return;
    if (input) {
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, (t / v.duration) * 100);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      v.currentTime = t;
    }
  }

  /* Seeking far into an unbuffered region sometimes completes and is then
     reverted by the player's own state sync (observed when the seek is still
     in flight ~150ms later). Re-issue until it sticks. */
  function seekTo(t) {
    cancelRetries();
    push(t);
    [300, 800, 1500].forEach(function (ms) {
      timers.push(setTimeout(function () {
        var v = video();
        if (v && Math.abs(v.currentTime - t) > 2) push(t);
      }, ms));
    });
  }

  // The seek <input type=range> sits on top of the markers, so marker clicks
  // never reach the marker element. Snap on the input instead: a click landing
  // within SNAP_PX of a marker jumps to that question's exact timestamp.
  function hitTest(e) {
    // Scope to the seek bar only — the volume slider is a range input too.
    var input = e.target && e.target.closest && e.target.closest('input[data-plyr=seek]');
    if (!input || !markers.length) return null;
    var d = dur();
    if (!d) return null;
    var r = input.getBoundingClientRect();
    if (!r.width) return null;
    var t = ((e.clientX - r.left) / r.width) * d;
    var tol = (SNAP_PX / r.width) * d;
    var hit = null;
    for (var i = 0; i < markers.length; i++) {
      var diff = Math.abs(markers[i].t - t);
      if (diff <= tol && (!hit || diff < Math.abs(hit.t - t))) hit = markers[i];
    }
    return hit;
  }

  function swallow(e) {
    var hit = hitTest(e);
    if (!hit) {
      // A genuine seek elsewhere on the bar wins over any pending retry.
      if (e.type === 'pointerdown') cancelRetries();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    // Seek once per interaction: a second seek fired while the first is still
    // in flight is what triggers the player's revert.
    if (e.type !== 'pointerdown') return;
    // The parent decides where a marker click lands (it aims just before the
    // question so the popup still triggers); fall back to the marker itself.
    seekTo(typeof hit.seek === 'number' ? hit.seek : hit.t);
  }
  ['pointerdown', 'mousedown', 'click'].forEach(function (type) {
    document.addEventListener(type, swallow, true);
  });

  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (err) { return; }
    }
    if (!d || d.__mezon !== 'vq' || !Array.isArray(d.markers)) return;
    markers = d.markers
      .filter(function (m) { return m && typeof m.t === 'number'; })
      .sort(function (a, b) { return a.t - b.t; });
    paint();
  });

  // Moments render after metadata and can be rebuilt (fullscreen, resize),
  // so keep re-applying cheaply rather than betting on a single pass.
  setInterval(paint, 500);
  window.addEventListener('resize', paint);

  /* The player defaults to counting down ("-1:40:15"). Show elapsed time
     instead. Set once, so clicking the clock still toggles as usual. */
  var waits = 0;
  var wait = setInterval(function () {
    if (window.plyr && window.plyr.config) {
      window.plyr.config.invertTime = false;
      clearInterval(wait);
    } else if (++waits > 200) {
      clearInterval(wait);
    }
  }, 50);
})();
</script>
```

## What it does

| State | Colour |
|---|---|
| Not answered yet | gold `#f8b801` |
| Answered correctly | green `#1e9e6a` |
| Answered incorrectly | red `#d14343` |

Skipped questions stay gold — no answer was recorded, so there is nothing
to grade.

**Clicking a marker** seeks to exactly one second before the question, so
the popup still triggers. Clicks elsewhere on the bar seek normally; the
snap only applies within ~9px of a marker.

**Elapsed vs remaining time.** The player ships with Plyr's `invertTime`
on, so the clock counts down (`-1:40:15`). There is no dashboard toggle for
this; the snippet sets `plyr.config.invertTime = false` once at startup so
it shows elapsed time instead. It is set once rather than enforced, so
clicking the clock still switches to remaining time as Plyr intends
(verified both directions, 2026-07-31).

### How the app drives it

`components/player/video-embed.tsx` posts
`{ __mezon: 'vq', markers: [{ t, seek, color }] }` to the iframe on player
ready, on load, and again whenever a student answers. The script keeps the
last message it received and repaints on a 500ms tick (moments are rebuilt
on resize and fullscreen). With no message — or without this snippet
installed at all — markers simply stay gold and clicks behave normally, so
nothing breaks.

### Verified behaviour (2026-07-31, live embed)

- Markers render at the true timestamp. *Bunny offsets each moment by -6px
  (half its default 12px width); the previous CSS added a `translate(-50%)`
  on top of that, which pushed every marker 6px early — about 48 seconds
  out on a 2h45m video. Keeping the 12px slot and drawing the bar with
  `::before` fixes the centering and gives the marker a real click target.*
- Marker clicks landed within 0.35s of target, 8/8 on fresh page loads.
  *Far seeks into unbuffered regions are sometimes reverted by the player's
  own state sync, so the script re-issues the seek until it sticks.*
- Clicking empty bar does not snap; the volume slider is unaffected.

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
