# Plant PNG replacement

No production plant images are included yet. The six catalog entries currently use `sprite: null` and the existing Plant drawing.

1. Add a 512×512 RGBA PNG here, e.g. `fire-archer.png`.
2. Set that entry's `sprite` in `public/plant-catalog.json` to `/assets/plants/fire-archer.png`.
3. Reload the game. Saved stats remain unchanged and playback starts stopped as before.

Use a top view, center anchor (0.5,0.5), transparent background, and a consistent 90% footprint diameter. The renderer compensates for transparent padding when mapping the visible footprint to the Plant's real diameter. Symmetry/art direction is still awaiting confirmation.

Names, conditions and priorities are editable JSON. Missing images fall back to existing circles and Skill colors, retaining faction and selection rings. Images do not grant Skill or stat bonuses. Do not label temporary test images as the completed 50-species set.
After compiling the test modules (`node node_modules/typescript/bin/tsc -p tsconfig.test.json`), run `node scripts/ecosystem-v2-catalog-check.mjs` to validate the catalog and check assigned files.
