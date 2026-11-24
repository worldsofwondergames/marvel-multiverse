/* eslint-env jest */
import { buildMovementRows, movementUpdateFromRows } from '../helpers/movement.mjs';

const stored = (extra = {}) => ({ value: 5, active: false, calc: '', override: null, ...extra });
const derived = (extra = {}) => ({ value: 5, active: false, calc: '', label: '', ...extra });

function rowsFor(source, prepared) {
    const keys = ['run', 'climb', 'swim', 'jump', 'flight'];
    const src = Object.fromEntries(keys.map((k) => [k, stored(source[k])]));
    const der = Object.fromEntries(keys.map((k) => [k, derived(prepared[k])]));
    return Object.fromEntries(buildMovementRows(src, der).map((r) => [r.key, r]));
}

describe('Movement Speeds dialog rows', () => {
    test('Climb with no entered speed is a Half Run row showing the derived speed', () => {
        const rows = rowsFor({}, { climb: { value: 3 } });
        expect(rows.climb.half).toBe(true);
        expect(rows.climb.spaces).toBe(3);
    });

    test('Climb with an entered speed is a Custom row showing that speed', () => {
        const rows = rowsFor({ climb: { override: 7 } }, { climb: { value: 7 } });
        expect(rows.climb.half).toBe(false);
        expect(rows.climb.spaces).toBe(7);
    });

    test('Run shows its stored speed, not the speed after effects', () => {
        const rows = rowsFor({ run: { value: 5 } }, { run: { value: 4 } });
        expect(rows.run.spaces).toBe(5);
        expect(rows.run.canHalf).toBe(false);
    });

    test('a speed with a calc from a power is locked and shows the derived speed', () => {
        const rows = rowsFor({ flight: { override: 2 } }, { flight: { value: 20, calc: 'runspeed-rank', active: true } });
        expect(rows.flight.locked).toBe(true);
        expect(rows.flight.spaces).toBe(20);
        expect(rows.flight.activeLocked).toBe(true);
    });

    test('a speed switched on by hand keeps an editable checkbox', () => {
        const rows = rowsFor({ flight: { active: true } }, { flight: { active: true } });
        expect(rows.flight.active).toBe(true);
        expect(rows.flight.activeLocked).toBe(false);
    });
});

describe('Movement Speeds dialog update', () => {
    test('Run writes its value and the other speeds write an override', () => {
        const update = movementUpdateFromRows([
            { key: 'run', active: true, half: false, spaces: 6 },
            { key: 'flight', active: true, half: false, spaces: 10 },
        ]);
        expect(update).toEqual({
            'system.movement.run.active': true,
            'system.movement.run.value': 6,
            'system.movement.flight.active': true,
            'system.movement.flight.override': 10,
        });
    });

    test('a Half Run row clears the override', () => {
        const update = movementUpdateFromRows([{ key: 'climb', active: true, half: true, spaces: 3 }]);
        expect(update['system.movement.climb.override']).toBeNull();
    });

    test('a locked row writes no speed, and a locked checkbox writes no active', () => {
        const update = movementUpdateFromRows([{ key: 'flight', active: undefined, locked: true, half: false, spaces: 20 }]);
        expect(Object.keys(update)).toEqual([]);
    });
});
