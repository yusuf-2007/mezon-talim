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

## Caveats

- This targets Bunny's **classic** player markup. If the library is ever
  switched to Bunny's new Media Chrome-based player, the `sp__*` selectors
  stop matching and this CSS needs re-verification (their new player uses
  web components / different structure).
- Library **settings** (key color, custom head) require the account-level
  API key, which we deliberately do not store — dashboard-only by design.
- Bunny moments are per-video and identical for every viewer; per-student
  answered state (gold → green) lives on the in-app strip under the video.
