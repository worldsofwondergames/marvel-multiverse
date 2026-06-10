/* global jest */
/* eslint-env jest */
import { jest } from '@jest/globals';

// Make jest work
function fail(reason = 'fail was called in a test.') {
    throw new Error(reason);
}
global.fail = fail;

/**
 * Item
 */
class Item {
    constructor(data, context) {
        if (data) {
            Object.assign(this, data);
            if (data.system) {
                this.system = data.system;
            }
        }
        this._id = data?._id || 'test-item-id';
        this.type = data?.type || 'item';
        this.name = data?.name || 'Test Item';
        this.img = data?.img || '';
        this.parent = null;
    }

    get id() {
        return this._id;
    }

    prepareData() {
        this.prepareDerivedData();
    }

    prepareDerivedData() {}

    getRollData() {
        return { ...this.system };
    }
}
global.Item = Item;

/**
 * Collection
 */
global.collectionFindMock = jest.fn().mockName('Collection.find');
const Collection = jest
    .fn()
    .mockImplementation(() => {
        return {
            find: global.collectionFindMock,
        };
    })
    .mockName('Collection');
global.Collection = Collection;

/**
 * Actor
 */
global.itemTypesMock = jest.fn().mockName('Actor.itemTypes getter');
global.actorUpdateMock = jest.fn((data) => {}).mockName('Actor.update');

class Actor {
    constructor(data, options) {
        this.flags = {};
        if (data) {
            Object.assign(this, data);
        } else {
            this._id = 1;
            this.name = 'Anonymous';
            Object.assign(this, { system: {} });
        }
        this.items = [];
        this.prepareData();
        Object.defineProperty(this, 'itemTypes', {
            get: global.itemTypesMock,
        });
    }

    prepareData() {
        this.prepareBaseData();
        this.prepareDerivedData();
    }

    prepareBaseData() {}

    prepareDerivedData() {}

    getRollData() {
        return this.system;
    }

    update(data) {
        return global.actorUpdateMock(data);
    }
}

global.actor = new Actor();
global.Actor = Actor;

class ActorSheet {
    constructor(data, options) {
        if (data) {
            Object.assign(this, data);
        } else {
            this._id = 1;
            this.name = 'Anonymous';
            Object.assign(this, { system: {} });
            this.getData = function () {
                return {};
            };
            this._renderTemplate = async function (template, data) {};
        }
    }
}
global.actorSheet = new ActorSheet();
global.ActorSheet = ActorSheet;

class ItemSheet {
    constructor(data, options) {
        if (data) {
            Object.assign(this, data);
        } else {
            this._id = 1;
        }
    }
}
global.itemSheet = new ItemSheet();
global.ItemSheet = ItemSheet;

/**
 * Roll
 */
class Roll {
    constructor(formula, data, options = {}) {
        this.formula = formula;
        this.data = data;
        this.options = options;
        this.terms = [];
        this.dice = [];
        this._evaluated = false;
    }

    static fromTerms(terms) {
        const roll = new this('', {}, {});
        roll.terms = terms;
        return roll;
    }

    async evaluate() {
        this._evaluated = true;
        return this;
    }

    async toMessage(messageData = {}, options = {}) {
        return messageData;
    }

    clone() {
        const roll = new this.constructor(this.formula, this.data, { ...this.options });
        roll.terms = [...this.terms];
        roll.dice = [...this.dice];
        roll._evaluated = this._evaluated;
        return roll;
    }
}
global.Roll = Roll;

/**
 * ChatMessage
 */
class ChatMessage {
    constructor(data, options) {
        if (data) {
            this.data = data;
        }
    }

    static create(data) {
        this.data = data;
    }

    static getSpeaker({ scene, actor, token, alias } = {}) {
        return actor;
    }

    static applyRollMode(messageData, rollMode) {}
}
global.ChatMessage = ChatMessage;

/**
 * CONFIG
 */
global.CONFIG = {};

export class YesDialog {
    static confirm() {
        return true;
    }
}

export class NoDialog {
    static confirm() {
        return false;
    }
}

/**
 * Localization — strips any system namespace prefix (e.g. "SYSTEM.Key" → "Key")
 */
class Localization {
    localize(stringId) {
        return stringId.replace(/^[^.]+\./, '');
    }

    format(stringId, data = {}) {
        let returnString = stringId.replace(/^[^.]+\./, '');
        for (const datum in data) {
            returnString += `,${datum}:${data[datum]}`;
        }
        returnString += data.toString();
        return returnString;
    }
}

global.Localization = Localization;

/**
 * Game
 */
class Game {
    constructor(worldData, sessionId, socket) {
        this.i18n = new Localization();
    }
}

global.Game = Game;
global.game = new Game();
global.game.user = { _id: 1 };

/**
 * Settings
 */
global.gameSettingsGetMock = jest.fn((module, key) => {}).mockName('game.settings.get');

class ClientSettings {
    constructor(worldSettings) {
        this.get = global.gameSettingsGetMock;
    }
}

global.game.settings = new ClientSettings();

/**
 * ChatMessage on CONFIG
 */
global.CONFIG.ChatMessage = {
    documentClass: {
        create: jest.fn((messageData = {}) => {}),
    },
};

/**
 * Notifications
 */
global.uiNotificationsWarnMock = jest
    .fn((message, options) => {})
    .mockName('ui.notifications.warn');
global.uiNotificationsErrorMock = jest
    .fn((message, type, permenant) => {})
    .mockName('ui.notifications.error');
const Notifications = jest
    .fn()
    .mockImplementation(() => {
        return {
            warn: global.uiNotificationsWarnMock,
            error: global.uiNotificationsErrorMock,
        };
    })
    .mockName('Notifications');
global.ui = {
    notifications: new Notifications(),
};

/**
 * Global helper functions
 */

global.getType = function (token) {
    const tof = typeof token;
    if (tof === 'object') {
        if (token === null) return 'null';
        const cn = token.constructor.name;
        if (['String', 'Number', 'Boolean', 'Array', 'Set'].includes(cn)) return cn;
        else if (/^HTML/.test(cn)) return 'HTMLElement';
        else return 'Object';
    }
    return tof;
};

global.setProperty = function (object, key, value) {
    let target = object;
    let changed = false;

    if (key.indexOf('.') !== -1) {
        const parts = key.split('.');
        key = parts.pop();
        target = parts.reduce((o, i) => {
            if (!Object.prototype.hasOwnProperty.call(o, i)) o[i] = {};
            return o[i];
        }, object);
    }

    if (target[key] !== value) {
        changed = true;
        target[key] = value;
    }

    return changed;
};

global.expandObject = function (obj, _d = 0) {
    const expanded = {};
    if (_d > 10) throw new Error('Maximum depth exceeded');
    for (let [k, v] of Object.entries(obj)) {
        if (v instanceof Object && !Array.isArray(v)) v = global.expandObject(v, _d + 1);
        global.setProperty(expanded, k, v);
    }
    return expanded;
};

global.duplicate = function (original) {
    return JSON.parse(JSON.stringify(original));
};

global.mergeObject = function (
    original,
    other = {},
    {
        insertKeys = true,
        insertValues = true,
        overwrite = true,
        recursive = true,
        inplace = true,
        enforceTypes = false,
    } = {},
    _d = 0
) {
    other = other || {};
    if (!(original instanceof Object) || !(other instanceof Object)) {
        throw new Error('One of original or other are not Objects!');
    }
    const depth = _d + 1;

    if (!inplace && _d === 0) original = global.duplicate(original);

    if (_d === 0 && Object.keys(original).some((k) => /\./.test(k)))
        original = global.expandObject(original);
    if (_d === 0 && Object.keys(other).some((k) => /\./.test(k)))
        other = global.expandObject(other);

    for (let [k, v] of Object.entries(other)) {
        const tv = global.getType(v);

        let toDelete = false;
        if (k.startsWith('-=')) {
            k = k.slice(2);
            toDelete = v === null;
        }

        let x = original[k];
        let has = Object.prototype.hasOwnProperty.call(original, k);
        let tx = global.getType(x);

        if (!has && tv === 'Object') {
            x = original[k] = {};
            has = true;
            tx = 'Object';
        }

        if (has) {
            if (tv === 'Object' && tx === 'Object' && recursive) {
                global.mergeObject(
                    x,
                    v,
                    { insertKeys, insertValues, overwrite, inplace: true, enforceTypes },
                    depth
                );
            } else if (toDelete) {
                delete original[k];
            } else if (overwrite) {
                if (tx && tv !== tx && enforceTypes) {
                    throw new Error('Mismatched data types encountered during object merge.');
                }
                original[k] = v;
            } else if (x === undefined && insertValues) {
                original[k] = v;
            }
        } else if (!toDelete) {
            const canInsert = (depth === 1 && insertKeys) || (depth > 1 && insertValues);
            if (canInsert) original[k] = v;
        }
    }

    return original;
};

global.renderTemplate = async function (template, data) {};

/**
 * Foundry namespaced APIs (V13+)
 */

class TypeDataModel {
    constructor(data = {}, options = {}) {
        Object.assign(this, data);
    }
}

class SchemaField {
    constructor(fields, options = {}) {}
}
class NumberField {
    constructor(options = {}) {}
}
class BooleanField {
    constructor(options = {}) {}
}
class StringField {
    constructor(options = {}) {}
}
class ArrayField {
    constructor(field, options = {}) {}
}
class ObjectField {
    constructor(options = {}) {}
}

class PoolTerm {
    constructor(termData = {}) {}
}
class OperatorTerm {
    constructor(termData = {}) {}
}
class NumericTerm {
    constructor(termData = {}) {
        this.number = termData.number ?? 0;
    }
}

class Die {
    constructor(termData) {
        this.faces = termData?.faces || 6;
        this.number = termData?.number || 1;
        this.results = [];
    }

    roll({ minimize = false, maximize = false } = {}) {
        const result = maximize ? this.faces : minimize ? 1 : Math.ceil(Math.random() * this.faces);
        const entry = { result, active: true };
        this.results.push(entry);
        return entry;
    }

    get total() {
        return this.results
            .filter((r) => !r.discarded)
            .reduce((sum, r) => sum + (r.count !== undefined ? r.count : r.result), 0);
    }
}

global.foundry = {
    abstract: {
        TypeDataModel,
    },
    utils: {
        deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
        setProperty: global.setProperty,
    },
    data: {
        fields: {
            SchemaField,
            NumberField,
            BooleanField,
            StringField,
            ArrayField,
            ObjectField,
        },
    },
    dice: {
        terms: { Die, PoolTerm, OperatorTerm, NumericTerm },
    },
    applications: {
        handlebars: {
            renderTemplate: async function (template, data) {},
        },
    },
};

/**
 * Handlebars
 */
global.loadTemplates = jest.fn((templateList) => {}).mockName('loadTemplates');

/**
 * Hooks
 */
global.hooksCallAllMock = jest.fn().mockName('Hooks.callAll');
global.Hooks = {
    callAll: global.hooksCallAllMock,
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
};
