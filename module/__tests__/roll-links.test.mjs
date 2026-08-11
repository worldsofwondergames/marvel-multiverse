/* eslint-env jest */
import { findRollLinks } from "../helpers/roll-links.mjs";

/** Convenience: the descriptors found in a string, without the match index. */
function links(text) {
  return findRollLinks(text).map(({ index, ...rest }) => rest);
}

/**
 * Written out rather than derived from ABILITY_BY_NAME. Deriving the expected
 * key from the map under test makes the assertion compare the map to itself,
 * so a wrong mapping changes both sides and nothing fails.
 */
const EXPECTED_KEYS = [
  ["Melee", "mle"],
  ["Agility", "agl"],
  ["Resilience", "res"],
  ["Vigilance", "vig"],
  ["Ego", "ego"],
  ["Logic", "log"],
];

describe("phrases that must not become rolls", () => {
  // A defense is the number the roll is compared against, so linking it would
  // offer to roll the target's stat as if it were the character's own.
  test.each(EXPECTED_KEYS.map(([name]) => name))(
    "%s defense is left alone",
    (name) => {
      expect(links(`compares that against the ${name} defense of the target`)).toEqual([]);
    }
  );

  test("a bare reference back to an earlier attack is left alone", () => {
    expect(links("If the attack is a success, the enemy takes regular damage.")).toEqual([]);
  });

  test("an action check that names no ability is left alone", () => {
    expect(links("They gain an edge on all action checks made while this is in effect.")).toEqual([]);
  });

  test("a word merely starting with check is left alone", () => {
    expect(links("The character reaches the Ego checkpoint")).toEqual([]);
  });
});

describe("ability checks and attacks", () => {
  test("an ability check names that ability", () => {
    expect(links("The hero makes an Ego check against the rival's Logic defense.")).toEqual([
      { abilityKey: "ego", kind: "check", tn: null, label: "Ego check" },
    ]);
  });

  test("an ability attack is an attack, not a check", () => {
    expect(links("The hero makes a Melee attack against the held foe.")).toEqual([
      { abilityKey: "mle", kind: "attack", tn: null, label: "Melee attack" },
    ]);
  });

  test.each([
    ["close", "mle"],
    ["ranged", "agl"],
  ])("a %s attack rolls %s", (word, key) => {
    expect(links(`The character makes a ${word} attack on an enemy.`)).toEqual([
      { abilityKey: key, kind: "attack", tn: null, label: `${word} attack` },
    ]);
  });

  test("plurals are matched", () => {
    expect(links("gain a +2 bonus to Agility checks of any other kind")).toEqual([
      { abilityKey: "agl", kind: "check", tn: null, label: "Agility checks" },
    ]);
  });

  test.each(EXPECTED_KEYS)("a %s check rolls %s", (name, key) => {
    expect(links(`makes a ${name} check`)).toEqual([
      { abilityKey: key, kind: "check", tn: null, label: `${name} check` },
    ]);
  });
});

describe("target numbers", () => {
  test("a vs. TN action check captures its number as one link", () => {
    expect(links("they can make a Logic vs. TN 13 action check to work it out")).toEqual([
      { abilityKey: "log", kind: "check", tn: 13, label: "Logic vs. TN 13 action check" },
    ]);
  });

  test("a parenthesised target number captures its number as one link", () => {
    expect(links("Pulling loose requires a Melee check (target number 20).")).toEqual([
      { abilityKey: "mle", kind: "check", tn: 20, label: "Melee check (target number 20)" },
    ]);
  });

  test("TN without the period still matches", () => {
    expect(links("must make an Ego vs TN 18 action check or comply")).toEqual([
      { abilityKey: "ego", kind: "check", tn: 18, label: "Ego vs TN 18 action check" },
    ]);
  });
});

describe("several phrases in one passage", () => {
  test("each is found and the defense between them is skipped", () => {
    const text =
      "The character makes an Ego check against the target's Logic defense. " +
      "On a success they may make a close attack.";
    expect(links(text)).toEqual([
      { abilityKey: "ego", kind: "check", tn: null, label: "Ego check" },
      { abilityKey: "mle", kind: "attack", tn: null, label: "close attack" },
    ]);
  });
});

describe("pattern mechanics", () => {
  test("the pattern is global so repeated scans do not stall on lastIndex", () => {
    const text = "makes an Ego check and then a Logic check";
    expect(links(text)).toHaveLength(2);
    expect(links(text)).toHaveLength(2);
  });
});
