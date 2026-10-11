# Browser verification — 2026-10-11

Installed Microsoft Edge 154.0.4258.62 was tested through its standard headless/CDP interface. Each viewport used an isolated browser context inside a new temporary profile. No user browser windows, profiles, authentication, extensions or persistent settings were accessed. No browser or package was installed.

## Findings and fixes

- Time controls previously fell below the viewport. Controls now precede the board; desktop board dimensions fit the available height. Placement help is collapsed and selected-unit information appears first in its Pane.
- Repeated mobile Pane switches could resize Phaser's hidden parent to zero, producing `Framebuffer status: Incomplete Attachment` and stopping progression. Automatic RESIZE was replaced by manual positive integer sizing; hidden dimensions are ignored.
- After viewport resizing, automatic scroll anchoring could move the board between pointer down/up and safely cancel a valid touch. Scroll anchoring is disabled for this page; gesture rejection rules remain intact.
- Existing-unit selection no longer displays an invalid placement preview. Routine labels are shorter and the empty forecast panel is hidden.

## Actual browser checks

1366×768 and 1920×1080 mouse viewports, plus 390×844 and 320×740 emulated touch viewports, all passed. Play controls and the entire board were visible initially and at zero placement charges, with no horizontal overflow. Screenshots were visually inspected.

Checks cover fractional placement, selection without extra placement, drag cancellation, right-click or multitouch cancellation, actual viewport resize followed by placement, repeated mobile Pane switching and visible selected stats, 4× advancement and pause, exact paused reload restoration of tick/speed/placements, and a real second-tab foreground transition. `document.visibilityState` became `hidden`; saved tick did not advance while hidden or catch up on return. Saved coordinates matched actual PointerEvent coordinates (CDP command coordinates have floating-point rounding).

All four viewports passed; browser exceptions/console errors: **0**. Unit tests: **52 passed**. TypeScript and production build passed; the existing Phaser bundle size warning remains.

The speed select's value/change handler was exercised programmatically; OS-native dropdown interaction was not tested. Mobile tests emulate Chromium touch, not a physical phone or Safari. These remain practical follow-up checks, as does subjective gameplay quality.

## Reproduction and evidence

Run the local dev server on `http://127.0.0.1:8781`, then on Windows with installed Edge and Node 24:

```powershell
node scripts/browser-check.mjs "$env:TEMP\morishi-browser-evidence"
```

The script uses only a new headless process, temporary profile and loopback CDP connection. It closes its own browser and removes its own verified temporary profile. Reports and screenshots are in `docs/evidence/browser/`; `before.json` records the original failures and `after.json` records the final full run. CUA initialization separately failed with `MXC launcher: cannot locate required Windows platform directory: HRESULT 0x80070003`; that failure was not repeatedly retried or repaired.

No save schema, storage keys, combat/placement rules, old Unity files or original restart documents changed in this fix.
