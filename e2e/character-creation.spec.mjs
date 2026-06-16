import { test, expect } from './fixtures.mjs';
import {
  createActor,
  setNumericField,
  setSelectField,
  dragCompendiumItem,
  goToBiographyTab,
  goToAbilitiesTab,
  getActorItems,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'Spider-Man (Peter Parker)';

// Spider-Man's ability scores from the character profile
const ABILITIES = {
  'system.abilities.mle.value': 5,  // Melee
  'system.abilities.agl.value': 7,  // Agility
  'system.abilities.res.value': 3,  // Resilience
  'system.abilities.vig.value': 3,  // Vigilance
  'system.abilities.ego.value': 0,  // Ego
  'system.abilities.log.value': 4,  // Logic
};

// Expected base defense scores (ability + 10)
const BASE_DEFENSES = {
  mle: 15,
  agl: 17,
  res: 13,
  vig: 13,
  ego: 10,
  log: 14,
};

const TRAITS = [
  'Audience',
  'Combat Reflexes',
  'Free Running',
  'Inventor',
  'Pundit',
  'Scientific Expertise',
  'Weird',
];

const TAGS = [
  'Heroic',
  'Obligation',
  'Poor',
  'Secret Identity',
];

const BASIC_POWERS = [
  'Brilliance 1',
  'Combat Trickery',
  'Evasion',
  'Inspiration',
  'Integrity',
  'Mighty 1',
  'Wisecracker',
];

const SPIDER_POWERS = [
  'Jump 1',
  'Spider-Dodge',
  'Spider-Sense',
  'Spider-Strike',
  'Wallcrawling',
  'Webcasting',
  'Webgliding',
  'Webgrabbing',
  'Webslinging',
  'Webtrapping',
];

test.describe('Character Creation - Spider-Man', () => {

  test('create Spider-Man and verify character sheet', async ({ foundryPage }) => {
    const page = foundryPage;

    // Clean up any leftover actor from a previous run
    await deleteActor(page, ACTOR_NAME);

    // ── Step 1: Create the actor ──
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      // ── Step 2: Set Rank ──
      await setNumericField(sheet, 'system.attributes.rank.value', 4);

      // ── Step 3: Set Ability Scores ──
      for (const [field, value] of Object.entries(ABILITIES)) {
        await setNumericField(sheet, field, value);
      }

      // ── Step 4: Set Karma ──
      await setNumericField(sheet, 'system.karma.value', 4);

      // ── Step 5: Biography — Size, Occupation, Origin ──
      await goToBiographyTab(sheet);
      await setSelectField(sheet, 'system.size', 'average');

      // Drop Occupation from compendium (auto-adds associated tags/traits)
      await dragCompendiumItem(page, 'occupations', 'Journalist', sheet);

      // Drop Origin from compendium (auto-adds associated tags/traits/powers)
      await dragCompendiumItem(page, 'origins', 'Weird Science', sheet);

      // ── Step 6: Add Traits from compendium ──
      await goToAbilitiesTab(sheet);
      for (const trait of TRAITS) {
        await dragCompendiumItem(page, 'traits', trait, sheet);
      }

      // ── Step 7: Add Tags from compendium ──
      for (const tag of TAGS) {
        await dragCompendiumItem(page, 'tags', tag, sheet);
      }

      // ── Step 8: Add Powers from compendium ──
      for (const power of [...BASIC_POWERS, ...SPIDER_POWERS]) {
        await dragCompendiumItem(page, 'powers', power, sheet);
      }

      await page.waitForTimeout(2000);

      // ══════════════════════════════════════════
      //  VERIFICATION
      // ══════════════════════════════════════════

      // ── Ability Scores ──
      for (const [field, expected] of Object.entries(ABILITIES)) {
        const actual = await sheet.locator(`input[name="${field}"]`).inputValue();
        expect(Number(actual), `${field} should be ${expected}`).toBe(expected);
      }

      // ── Rank ──
      const rank = await sheet.locator('input[name="system.attributes.rank.value"]').inputValue();
      expect(Number(rank)).toBe(4);

      // ── Karma ──
      const karma = await sheet.locator('input[name="system.karma.value"]').inputValue();
      expect(Number(karma)).toBe(4);

      // ── Health (Resilience 3 × 30 = 90) ──
      const healthMax = await sheet.locator('.mm-stat-block .mm-derived-value').first().textContent();
      expect(Number(healthMax.trim())).toBe(90);

      // ── Focus (Vigilance 3 × 30 = 90) ──
      const focusMax = await sheet.locator('.mm-stat-block.-focus .mm-derived-value').textContent();
      expect(Number(focusMax.trim())).toBe(90);

      // ── Defense Scores (via API — powers may add bonuses) ──
      const defenses = await page.evaluate((actorName) => {
        const actor = game.actors.find(a => a.name === actorName);
        return {
          mle: actor.system.abilities.mle.defense,
          agl: actor.system.abilities.agl.defense,
          res: actor.system.abilities.res.defense,
          vig: actor.system.abilities.vig.defense,
          ego: actor.system.abilities.ego.defense,
          log: actor.system.abilities.log.defense,
        };
      }, ACTOR_NAME);

      for (const [key, base] of Object.entries(BASE_DEFENSES)) {
        expect(defenses[key], `${key} defense >= ${base}`).toBeGreaterThanOrEqual(base);
      }

      // ── Damage Multipliers (at minimum rank value; AE bonuses may apply) ──
      const dmgMult = await page.evaluate((actorName) => {
        const actor = game.actors.find(a => a.name === actorName);
        return {
          mle: actor.system.abilities.mle.damageMultiplier,
          agl: actor.system.abilities.agl.damageMultiplier,
          ego: actor.system.abilities.ego.damageMultiplier,
          log: actor.system.abilities.log.damageMultiplier,
        };
      }, ACTOR_NAME);

      // Base damage multiplier equals rank (4); powers with AEs may add more
      expect(dmgMult.mle, 'Melee damage multiplier >= rank').toBeGreaterThanOrEqual(4);
      expect(dmgMult.agl, 'Agility damage multiplier >= rank').toBeGreaterThanOrEqual(4);
      expect(dmgMult.ego, 'Ego damage multiplier >= rank').toBeGreaterThanOrEqual(4);
      expect(dmgMult.log, 'Logic damage multiplier >= rank').toBeGreaterThanOrEqual(4);

      // ── Powers ──
      const powers = await getActorItems(page, ACTOR_NAME, 'power');
      for (const power of [...BASIC_POWERS, ...SPIDER_POWERS]) {
        expect(powers, `Should have power: ${power}`).toContain(power);
      }

      // ── Traits ──
      const traits = await getActorItems(page, ACTOR_NAME, 'trait');
      for (const trait of TRAITS) {
        expect(traits, `Should have trait: ${trait}`).toContain(trait);
      }

      // ── Tags ──
      const tags = await getActorItems(page, ACTOR_NAME, 'tag');
      for (const tag of TAGS) {
        expect(tags, `Should have tag: ${tag}`).toContain(tag);
      }

      // ── Occupation ──
      const occupations = await getActorItems(page, ACTOR_NAME, 'occupation');
      expect(occupations).toContain('Journalist');

      // ── Origin ──
      const origins = await getActorItems(page, ACTOR_NAME, 'origin');
      expect(origins).toContain('Weird Science');

      // ── Size ──
      const size = await page.evaluate((actorName) => {
        const actor = game.actors.find(a => a.name === actorName);
        return actor?.system.size;
      }, ACTOR_NAME);
      expect(size).toBe('average');

    } finally {
      // Clean up the test actor
      await deleteActor(page, ACTOR_NAME);
    }
  });
});
