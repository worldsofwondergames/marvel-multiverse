/* eslint-env jest */
import { canAddItem, needsDetail } from '../helpers/item-drop.mjs';

const actorWith = (...items) => ({ items });
const trait = (name, extra = {}) => ({ name, type: 'trait', system: { multiple: false, detail: '', ...extra } });

describe('canAddItem', () => {
    test('a second weapon with the same name is allowed', () => {
        const sidearm = { name: 'Sidearm', type: 'weapon', system: {} };
        expect(canAddItem(actorWith(sidearm), sidearm).ok).toBe(true);
    });

    test('a second copy of a trait that is not repeatable is refused', () => {
        const actor = actorWith(trait('Stubborn'));
        expect(canAddItem(actor, trait('Stubborn'))).toEqual({ ok: false, reason: 'owned' });
    });

    test('a first copy of a repeatable trait is allowed', () => {
        expect(canAddItem(actorWith(), trait('Contacts', { multiple: true })).ok).toBe(true);
    });

    test('a repeatable trait with a new detail is allowed', () => {
        const actor = actorWith(trait('Contacts', { multiple: true, detail: 'Police' }));
        expect(canAddItem(actor, trait('Contacts', { multiple: true, detail: 'Press' })).ok).toBe(true);
    });

    test('a repeatable trait with a detail the actor has is refused, ignoring case and spaces', () => {
        const actor = actorWith(trait('Contacts', { multiple: true, detail: 'Police' }));
        expect(canAddItem(actor, trait('Contacts', { multiple: true, detail: ' police ' }))).toEqual({ ok: false, reason: 'detail' });
    });

    test('a repeatable tag follows the same rule as a trait', () => {
        const tag = (detail) => ({ name: 'Rival', type: 'tag', system: { multiple: true, detail } });
        const actor = actorWith(tag('A'));
        expect(canAddItem(actor, tag('B')).ok).toBe(true);
        expect(canAddItem(actor, tag('A')).ok).toBe(false);
    });

    test('a power with the multiple flag set is still limited to one', () => {
        const power = { name: 'Blast', type: 'power', system: { multiple: true, detail: 'x' } };
        const actor = actorWith({ name: 'Blast', type: 'power', system: { detail: 'y' } });
        expect(canAddItem(actor, power)).toEqual({ ok: false, reason: 'owned' });
    });

    test('a power and a trait that share a name do not block each other', () => {
        const actor = actorWith({ name: 'Shared', type: 'power', system: {} });
        expect(canAddItem(actor, trait('Shared')).ok).toBe(true);
    });
});

describe('needsDetail', () => {
    test('true for a repeatable trait the actor already has', () => {
        const actor = actorWith(trait('Contacts', { multiple: true }));
        expect(needsDetail(actor, trait('Contacts', { multiple: true }))).toBe(true);
    });

    test('false for the first copy of a repeatable trait', () => {
        expect(needsDetail(actorWith(), trait('Contacts', { multiple: true }))).toBe(false);
    });

    test('false for an owned trait that is not repeatable', () => {
        expect(needsDetail(actorWith(trait('Stubborn')), trait('Stubborn'))).toBe(false);
    });
});
