# Bounded Reference model balance observation

この観察は旧 `reference-stats-1` の有限土壌モデルの記録です。新規ランの恒久土壌・共通ElementStats・HPReg廃止は [continuous soil](ecosystem-v2-continuous-soil.md) を参照してください。旧モデル測定値を新モデルの性能結果として使いません。

Model baseline: cff7ea7. Coefficients, rules and images unchanged. New generated states only; no user saves. Node step wall time is separate from total observation wall time (which includes ledger checks, species queries and save/replay). This is neither physical SP verification nor a guarantee of optimal play. Auto placement simply tries bounded legal candidates every24 seconds.

| Case | Seed | Ticks | Game sec | Step wall sec | Recorded observation wall sec |
|---|---:|---:|---:|---:|---:|
|100 enemies, radius2400|424|600|60|21.15|26.32|
|4 enemies, radius1200|424|2400|240|102.26|113.46|
|Enemy-only control,4 enemies|424|200|20|5.13|6.68|
|4 enemies, radius1200|7|600|60|17.34|20.88|

## Contracts

All cases maintained finite nonnegative inventory and water/soil/corpse ledgers. Primary water residual max1.79e-7; soil residual max1.82e-12; corpse residual max1.60e-9. Nineteen paused save/replay comparisons also preserved the next tick. Existing16 Reference regressions passed, including Power100+100=200,0+0=0, receipt delta without immediate extra Size gain, later Size scaling, HP/water sum, enemy-contact growth stop and original-key protection.

Night ticks300..600 leave cumulative growth water exactly unchanged in the primary cases while Skill spending continues. Water remains conserved: uptake transfers existing soil water rather than generating it. Initial legal candidates were found for all auto-placement cases. No claim is made that a legal candidate is combat-safe.

## Observations

- At10 game seconds, the100-enemy case already had30 merges; the4-enemy case had3 merges. At60 seconds the100 case had53 merges and9 deaths.
- All measured cases exhausted soil to subnormal floating-point residuals (<1e-300) by their first100-tick sample. These residuals are not negative inventory and are not claimed to be exact mathematical zero.
- The enemy-only control had no deaths/corpses/attacks yet spent the full20000 soil nutrient units, merged into one enemy and reached diameter4876.37u / Root center-radius21768.72u by20 seconds. Thus early growth/merge escalation does not require corpse feeding.
- Seed7 also ended with one enemy, no living allies, diameter6222.75u and Root28113.06u by60 seconds. Its9 placements and11 deaths include2 enemy deaths, so the naive policy is not proof that killing enemies is impossible.
- In seed424's4-enemy240-second run, growth spending reached364071.08 water/nutrient units. Only20000 came from soil; the remainder was corpse acquisition. Repeated reinforcement can feed the surviving aggregate under this policy.
-100-enemy attacks:1014/1442 caused0 damage (70.3%). Their estimated paid water4453.15 was93.2% of all4775.95 Skill water spent. This is expected under the approved any-distance targeting/payment contract, not unpaid damage or a refund bug.
- Species classification changed17 times in the100 case,7 in the4-enemy seed424 case and5 for seed7; classification stayed finite and deterministic through replay. No new Tier/MN feature was added.
- Day mean tick47..65ms versus night about15ms in primary observations. First100-enemy window p95=101.9ms, max139.1ms. These are Node simulation costs, excluding rendering. Day contact work remains measurable even after practical soil exhaustion; no performance optimization was made here.

## Proposed coefficient comparisons, not implemented

1. Calibrate growth tempo first. Current Root0 is center-radius300u, but uptake/nutrition referenceRadius remains100u, giving9x baseline area budgets (36 water/sec and18 soil nutrient/sec before constraints). Compare referenceRadius300 and/or lower diameter-per-growth-water0.25. Changing radius alone also changes Skill water pressure: at referenceRadius300, baseline uptake4/sec is below baseline Skill demand10/sec, so uptake/Cost must be compared jointly rather than silently changed.
2. Revisit corpse statFraction0.25 after tempo calibration. New Range400 and nonlearned attribute potential are converted through inherited nutrient gains; corpse nutrition can dominate the fixed20000 soil budget. A lower fraction is a coefficient-only comparison. Raising stat gains solely to reduce corpse mass would also alter soil gains and is not an isolated correction.
3. Keep the zero-damage payment rule, but compare Range/Aura coverage and water demand together. BaseRange400 exceeds baseline Aura reach200, so legal placement is not safety. Do not increase Cost alone before fixing income/growth normalization: large aggregates currently have plentiful water and lower per-shot Cost through scaled Tech.

Further manual/clustered placement comparisons are needed before generalizing difficulty. Existing any-distance firing and 1:1 Size scaling were not revoked. Physical SP and new longer soak remain unverified. No additional cases are running.

## Evidence and reproduction

Raw evidence: C:/Users/user/Documents/Codex/2026-10-14/task-5/reference-observation.json, reference-observation-extra.json, reference-observation-contract-tests.txt. Compile tsconfig.test.json, then run `node scripts/ecosystem-v2-reference-observe.mjs <output.json> primary` or `extra`. All cases are bounded; original saves are never read.

Timing note: primary observation wall totals were sampled at the final checkpoint before its save/replay and final write; extra-case wall totals were sampled after the loop. Step wall totals cover every measured step and are the comparable execution-time figures. Neither includes the agent's analysis or documentation time.
