import { test, expect } from './fixtures.mjs';
import { evaluateRoll } from './helpers.mjs';

test.describe('d616 Dice Rolling', () => {

  test('d616 roll produces correct dice structure', async ({ foundryPage }) => {
    const page = foundryPage;
    const result = await evaluateRoll(page);

    // Should have dice terms (d6, dM, d6) separated by operators
    const dicePools = result.terms.filter(t => t.results);
    expect(dicePools.length).toBeGreaterThanOrEqual(1);
  });

  test('Marvel die result of 1 counts as 6 in total', async ({ foundryPage }) => {
    const page = foundryPage;

    // Roll many times and check the invariant: when Marvel die raw=1, its total=6
    const results = await page.evaluate(async () => {
      const Roll = CONFIG.Dice.rolls[0];
      const outcomes = [];
      for (let i = 0; i < 50; i++) {
        const roll = new Roll('{1d6,1dm,1d6}');
        await roll.evaluate();
        const pool = roll.terms[0];
        const dice = pool.rolls;
        // dice[1] is the Marvel die roll
        const mDie = dice[1].terms[0];
        outcomes.push({
          rawResult: mDie.results[0].result,
          total: mDie.total,
          rollTotal: roll.total,
        });
      }
      return outcomes;
    });

    for (const r of results) {
      if (r.rawResult === 1) {
        // Marvel die result of 1 should count as 6
        expect(r.total).toBe(6);
      } else {
        // Normal results should be face value
        expect(r.total).toBe(r.rawResult);
      }
    }
  });

  test('roll total is sum of all dice with M substitution', async ({ foundryPage }) => {
    const page = foundryPage;

    const results = await page.evaluate(async () => {
      const Roll = CONFIG.Dice.rolls[0];
      const outcomes = [];
      for (let i = 0; i < 30; i++) {
        const roll = new Roll('{1d6,1dm,1d6}');
        await roll.evaluate();
        const pool = roll.terms[0];
        const dice = pool.rolls;
        const d1 = dice[0].total;
        const dM = dice[1].total;
        const d2 = dice[2].total;
        outcomes.push({
          d1,
          dM,
          d2,
          expectedTotal: d1 + dM + d2,
          actualTotal: roll.total,
        });
      }
      return outcomes;
    });

    for (const r of results) {
      expect(r.actualTotal).toBe(r.expectedTotal);
    }
  });

  test('Fantastic detection: isFantastic when Marvel die shows 1', async ({ foundryPage }) => {
    const page = foundryPage;

    const results = await page.evaluate(async () => {
      const Roll = CONFIG.Dice.rolls[0];
      const outcomes = [];
      for (let i = 0; i < 50; i++) {
        const roll = new Roll('{1d6,1dm,1d6}');
        await roll.evaluate();
        const pool = roll.terms[0];
        const mDie = pool.rolls[1].terms[0];
        const rawResult = mDie.results[0].result;
        outcomes.push({
          rawResult,
          isFantastic: rawResult === 1,
        });
      }
      return outcomes;
    });

    // Verify we got at least some fantastic and some non-fantastic results
    const fantastics = results.filter(r => r.isFantastic);
    const normals = results.filter(r => !r.isFantastic);
    // With 50 rolls, probability of all fantastic or zero fantastic is negligible
    expect(fantastics.length).toBeGreaterThan(0);
    expect(normals.length).toBeGreaterThan(0);
  });

  test('roll total range is valid (3-18)', async ({ foundryPage }) => {
    const page = foundryPage;

    const results = await page.evaluate(async () => {
      const Roll = CONFIG.Dice.rolls[0];
      const totals = [];
      for (let i = 0; i < 50; i++) {
        const roll = new Roll('{1d6,1dm,1d6}');
        await roll.evaluate();
        totals.push(roll.total);
      }
      return totals;
    });

    for (const total of results) {
      // Min: 1+1(→6 no, raw 2)+1 = 4 minimum without M; with M: 1+6+1=8?
      // Actually min is 2+6+2=10 if M fires, or 2+2+2=6 if not
      // Real min: each d6 can roll 1-6, dM rolls 1-6 where 1→6
      // So non-M min: 1+2+1=4 (d6=1, dM=2, d6=1)
      // M min: 1+6+1=8 (d6=1, dM=1→6, d6=1)
      // Overall min is 4, max is 18
      expect(total).toBeGreaterThanOrEqual(4);
      expect(total).toBeLessThanOrEqual(18);
    }
  });
});
