/* eslint-env jest */
import MarvelMultiverseActorBase from '../data/actor-base.mjs';
import {
  validateFormLink,
  getLinkedForms,
} from '../helpers/alternate-forms.mjs';

describe('MarvelMultiverseActorBase — alternate form schema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseActorBase.defineSchema();
  });

  test('schema includes alternateForms array field', () => {
    expect(schema.alternateForms).toBeDefined();
  });

  test('schema includes primaryFormIds array field', () => {
    expect(schema.primaryFormIds).toBeDefined();
  });
});

describe('validateFormLink', () => {
  test('rejects self-linking', () => {
    const actor = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const result = validateFormLink(actor, actor);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/cannot link.*itself/i);
  });

  test('rejects linking an actor that has its own alternates (circular chain)', () => {
    const primary = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [{ actorId: 'actor3' }], primaryFormIds: [] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already has.*alternate/i);
  });

  test('accepts valid link', () => {
    const primary = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [], primaryFormIds: [] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(true);
  });

  test('accepts linking when alternate is already an alternate for another primary', () => {
    const primary = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [], primaryFormIds: ['actor3'] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(true);
  });

  test('rejects linking when primary already has this alternate', () => {
    const primary = { id: 'actor1', system: { alternateForms: [{ actorId: 'actor2' }], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [], primaryFormIds: ['actor1'] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already linked/i);
  });
});

describe('getLinkedForms', () => {
  test('returns alternate forms for a primary actor', () => {
    const actor = {
      id: 'actor1',
      system: {
        alternateForms: [
          { actorId: 'actor2', formType: 'powerDown', triggers: [] },
        ],
        primaryFormIds: [],
      },
    };
    const result = getLinkedForms(actor);
    expect(result.isPrimary).toBe(true);
    expect(result.isAlternate).toBe(false);
    expect(result.forms).toHaveLength(1);
    expect(result.forms[0].actorId).toBe('actor2');
  });

  test('returns primary form IDs for an alternate actor', () => {
    const actor = {
      id: 'actor2',
      system: {
        alternateForms: [],
        primaryFormIds: ['actor1'],
      },
    };
    const result = getLinkedForms(actor);
    expect(result.isPrimary).toBe(false);
    expect(result.isAlternate).toBe(true);
    expect(result.primaryIds).toEqual(['actor1']);
  });

  test('returns unlinked state for actor with no forms', () => {
    const actor = {
      id: 'actor3',
      system: {
        alternateForms: [],
        primaryFormIds: [],
      },
    };
    const result = getLinkedForms(actor);
    expect(result.isPrimary).toBe(false);
    expect(result.isAlternate).toBe(false);
  });
});

describe('alternateFormTypes config enum', () => {
  test('config includes cosmetic, powerDown, powerSwap', () => {
    const types = CONFIG.MARVEL_MULTIVERSE.alternateFormTypes;
    expect(types).toBeDefined();
    expect(types.cosmetic).toBeDefined();
    expect(types.powerDown).toBeDefined();
    expect(types.powerSwap).toBeDefined();
  });

  test('config has exactly three form types', () => {
    const types = CONFIG.MARVEL_MULTIVERSE.alternateFormTypes;
    expect(Object.keys(types)).toHaveLength(3);
  });
});
