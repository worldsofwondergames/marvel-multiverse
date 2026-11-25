/* eslint-env jest */
import { allowsBadKarma, limitKarmaUpdate } from '../helpers/bad-karma.mjs';

const WEIRD = { type: 'trait', name: 'Weird' };

const actorWith = (...items) => ({ items });

/** Turn the Bad Karma setting on or off, and leave every other setting unset. */
function setBadKarma(enabled) {
    global.gameSettingsGetMock.mockImplementation((scope, key) =>
        (scope === 'marvel-multiverse' && key === 'badKarmaEnabled' ? enabled : undefined));
}

/** Apply a Karma update to the actor and return the value that would be stored. */
function storedKarma(actor, value) {
    const changed = { system: { karma: { value } } };
    limitKarmaUpdate(actor, changed);
    return changed.system.karma.value;
}

afterEach(() => global.gameSettingsGetMock.mockReset());

describe('limitKarmaUpdate', () => {
    test('an actor without the Weird trait is held at 0', () => {
        setBadKarma(true);
        expect(storedKarma(actorWith(), -2)).toBe(0);
    });

    test('an actor with the Weird trait can go below 0 when the setting is on', () => {
        setBadKarma(true);
        expect(storedKarma(actorWith(WEIRD), -2)).toBe(-2);
    });

    test('the same actor is held at 0 when the setting is off', () => {
        setBadKarma(false);
        expect(storedKarma(actorWith(WEIRD), -2)).toBe(0);
    });

    test('a Karma total of 0 or more is stored as given', () => {
        setBadKarma(false);
        expect(storedKarma(actorWith(), 3)).toBe(3);
        expect(storedKarma(actorWith(), 0)).toBe(0);
    });

    test('an update that does not touch Karma is left as it is', () => {
        setBadKarma(false);
        const changed = { system: { health: { value: -5 } } };
        limitKarmaUpdate(actorWith(), changed);
        expect(changed).toEqual({ system: { health: { value: -5 } } });
    });
});

describe('allowsBadKarma', () => {
    test('a tag or power named Weird does not count as the trait', () => {
        setBadKarma(true);
        expect(allowsBadKarma(actorWith(WEIRD))).toBe(true);
        expect(allowsBadKarma(actorWith({ type: 'tag', name: 'Weird' }, { type: 'power', name: 'Weird' }))).toBe(false);
    });

    test('another trait does not count', () => {
        setBadKarma(true);
        expect(allowsBadKarma(actorWith(WEIRD))).toBe(true);
        expect(allowsBadKarma(actorWith({ type: 'trait', name: 'Weirdly Lucky' }))).toBe(false);
    });
});
