# Reference Stats / Size model

New gardens use `reference-stats-1`; historical runs retain their own generator, growth, merge and Skill behavior. No historical save is automatically converted. Images remain on hold until the user reviews sample directions; no new Tier/MN subsystem is included.

## Settings and units

`src/eco-v2-config.ts` collects `GameConfig`, `StatConfig`, `SkillConfig`, and `PlantSpawnConfig`. Distances are u; simulation time is sec. Tick length is 0.1 sec. The four attributes currently share the provisional Skill settings Damage100, Range400, Speed1/sec, WaterCost10 and heal factor0.5. Defaults are explicitly provisional; changes that affect frozen seed regeneration must receive a new model version.

Correction multiplier: M(x)=1+x/100 for x>=0; otherwise M(x)=1/(1-x/100). A correction of 0 means baseline, not absence. Size0 means body radius100u; Size100 means200u; Size900 means1000u. Aura0 and Root0 mean an additional200u from the body surface. Skill range measures the gap between bodies.

## Generation

Provisional player limits: CreateSize100; MaxHP200; Reg/Aura/Root/Resist/Power/Tech/Range/Speed200. MaxHP is an absolute HP amount with a lower valid bound1. Other values are corrections drawn independently for each plant/attribute. All four attributes retain potential Power/Tech/Range/Speed/Resist even when their Skill is not learned. Skill choice remains independent of the numeric potential; existing species classification reads finalized effective Stats.

Player Power/Tech/Range/Speed limits are common to all attributes. Existing kill rewards are recorded using the historical provenance structure; new-model generation combines their increments into one shared spawn boost. Held cards freeze their seed, reference amounts, initial Size and reward basis at acquisition.

Enemy Size0 reference Stats draw corrections uniformly0..200 (expected mean100); MaxHP uniformly1..199 (expected100). Initial enemy growth randomly distributes an exact total of enemyCount*10 display Size points. It is part of generation and consumes no soil, nutrients or water. It is not an in-play free-growth event.

## Growth and material

ReferenceSize starts0 and is reset to the new Size at merge. ReferenceStats are positive effective amounts at that Size, not display correction points. r=M(Size)/M(ReferenceSize). Shared material projection is B*r in both reference normal-mode integration and new finite-root integration; new gardens always use finite roots. Root material additionally includes body radius because its stored reference amount is surface reach.

The nutrient allocator still works from one snapshot and spends finite stock under local1/n ownership, sunlight, enemy contact, and one water budget. Water uptake precedes fixed-order Skill payment; final residual water limits direct nutrition. Final actual nutrient receipt*configured gain is delta. Final physical Size growth is determined first; then B+=delta/r_new. This gives precisely delta immediately and lets it scale with later Size growth. Tech and capacity have no separate nutrient source in the current20-kind inventory, but scale with Size.

Power/Range/Speed/Resist/Tech display corrections are inverse projections of effective amounts. Speed material is actual frequency: BaseSpeed*SpeedMultiplier, measured in activations/sec. Internal clocks accumulate frequency*tick. WaterCost=BaseWaterCost/TechMultiplier. Cost, current HP and current water are not multiplied by Size.

## Merge and reservoirs

Size keeps physical circle-area composition: new diameter=hypot(a,b). Power and other correction Stats merge by adding their displayed correction points, then converting through M. Power100+100=200 and0+0=0. The result becomes a new reference amount at ReferenceSize=newSize. Resist and Tech use the same correction-point rule.

Root is the geometry exception: combine total center-radius disk areas, subtract the new body radius, and store the resulting reach at the new reference Size. Aura combines its surface-reach correction points.

MaxHP and water capacity remain absolute reservoir quantities and sum their effective amounts. This is necessary to retain remaining HP/water: two full100-capacity bodies hold200 water after merge even when their other correction Stats are0. Remaining HP and water sum; HP is bounded by the summed MaxHP. Living growth adds the MaxHP increase to current HP. Increasing capacity creates no water. Reg is a correction Stat; its effective HP/sec is shown separately. Dead bodies cannot be revived by a material update.

## Persistence and compatibility

New root saves are `element-root-save-4` at `morishi.reference-root.v1`; normal reference snapshots use `element-skills-save-2` at `morishi.reference-normal.v1`. Root state retains reference fields plus checked material, inventories, acquisition ledgers, water/Skill spending and provenance. Replay validates reference/material consistency and then preserves the next tick exactly.

The application reads historical normal/root keys as a fallback. Continuing one writes to a separate `.legacy` working key; original historical raw keys stay untouched. Default legacy store APIs retain their old behavior for historical tests. New-key replacement backups are isolated from historical backups. There is no silent migration.

## Verification

Reference regressions cover body/ability Size100 and900, receipt scaling, negative corrections, correction-point merge, Root area, HP/water, independent generation and mean100, exact enemy Size budget, Skill frequency/reciprocal cost/Resist, contact stop, processing order, exact v4 next-tick replay and historical raw-key preservation. Existing finite stock, local competition, payment order, dead/merged provenance and old v1/v2/v3 tests remain required. Browser harness: `scripts/ecosystem-v2-reference-browser-check.mjs` with isolated installed Edge contexts at1366x900,390x844 and320x568. Phone sizes are emulation, not physical SP verification.

New reference Aura uses a bounded96-candidate starting-refuge expansion, without changing RNG, enemy count, spacing, coefficients or historical generation. Its camera includes surface Aura and the provisional maximum card body, so outer refuge points can appear on PC/SP. Fractional rebasing returns ratio1 exactly, preventing floating-point MaxHP/capacity shrink at merge.

Local verification: all388 tests, typecheck, standard and root-trial builds passed. Isolated Edge PC1366x900 and emulated touch390x844/320x568 passed empty-storage first startup, new creation, correct correction displays, placement, play/pause, v4 save/reload, exact paused state and original raw-key protection. No physical phone or new prolonged balance QA is claimed.
