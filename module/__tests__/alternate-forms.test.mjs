/* eslint-env jest */
import { jest } from '@jest/globals';
import MarvelMultiverseActorBase from '../data/actor-base.mjs';
import {
  validateFormLink,
  getLinkedForms,
  switchForm,
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

describe('switchForm', () => {
  let currentActor;
  let targetActor;
  let chatCreateSpy;

  beforeEach(() => {
    currentActor = {
      id: 'actor1',
      name: 'Bruce Banner',
      system: { alternateForms: [{ actorId: 'actor2', formType: 'powerDown', triggers: [] }] },
    };
    targetActor = {
      id: 'actor2',
      name: 'Hulk',
      img: 'hulk.png',
      system: { primaryFormIds: ['actor1'] },
      sheet: { render: jest.fn() },
      prototypeToken: { texture: { src: 'hulk-token.png' }, width: 1, height: 1 },
    };

    global.game.actors = { get: jest.fn((id) => (id === 'actor2' ? targetActor : undefined)) };
    global.game.scenes = { active: null };
    global.game.combat = null;
    global.ui.windows = {};

    chatCreateSpy = jest.spyOn(ChatMessage, 'create');
  });

  afterEach(() => {
    chatCreateSpy.mockRestore();
  });

  test('warns and returns early when target actor not found', async () => {
    global.game.actors.get = jest.fn(() => undefined);
    await switchForm(currentActor, 'nonexistent');
    expect(global.uiNotificationsWarnMock).toHaveBeenCalledWith('Target form actor not found.');
    expect(chatCreateSpy).not.toHaveBeenCalled();
  });

  test('creates chat message when no active scene', async () => {
    global.game.scenes = { active: null };
    await switchForm(currentActor, 'actor2');
    expect(chatCreateSpy).toHaveBeenCalledTimes(1);
    expect(chatCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.any(String) })
    );
  });

  test('creates chat message when scene exists but actor has no token', async () => {
    global.game.scenes = { active: { tokens: { find: jest.fn(() => undefined) } } };
    await switchForm(currentActor, 'actor2');
    expect(chatCreateSpy).toHaveBeenCalledTimes(1);
  });

  test('replaces token when scene has a matching token', async () => {
    const mockToken = { id: 'token1', actorId: 'actor1', x: 100, y: 200, elevation: 0, rotation: 0 };
    const newToken = { id: 'token2' };
    const deleteEmbedded = jest.fn();
    const createEmbedded = jest.fn(() => [newToken]);

    global.game.scenes = {
      active: {
        tokens: { find: jest.fn(() => mockToken) },
        deleteEmbeddedDocuments: deleteEmbedded,
        createEmbeddedDocuments: createEmbedded,
      },
    };

    await switchForm(currentActor, 'actor2');
    expect(deleteEmbedded).toHaveBeenCalledWith('Token', ['token1']);
    expect(createEmbedded).toHaveBeenCalledWith('Token', [
      expect.objectContaining({ actorId: 'actor2', x: 100, y: 200 }),
    ]);
    expect(chatCreateSpy).toHaveBeenCalledTimes(1);
  });

  test('preserves initiative when switching token during combat', async () => {
    const mockToken = { id: 'token1', actorId: 'actor1', x: 0, y: 0, elevation: 0, rotation: 0 };
    const newToken = { id: 'token2' };
    const combatantUpdate = jest.fn();
    const combatant = { tokenId: 'token1', initiative: 15, update: combatantUpdate };

    global.game.scenes = {
      active: {
        tokens: { find: jest.fn(() => mockToken) },
        deleteEmbeddedDocuments: jest.fn(),
        createEmbeddedDocuments: jest.fn(() => [newToken]),
      },
    };
    global.game.combat = { combatants: { find: jest.fn(() => combatant) } };

    await switchForm(currentActor, 'actor2');
    expect(combatantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ initiative: 15, tokenId: 'token2' })
    );
  });

  test('closes current sheet and opens target sheet when switching', async () => {
    const closeSheet = jest.fn();
    const mockSheet = { actor: { id: 'actor1' }, close: closeSheet };
    Object.setPrototypeOf(mockSheet, ActorSheet.prototype);
    global.ui.windows = { sheet1: mockSheet };

    await switchForm(currentActor, 'actor2');
    expect(closeSheet).toHaveBeenCalled();
    expect(targetActor.sheet.render).toHaveBeenCalledWith(true);
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
