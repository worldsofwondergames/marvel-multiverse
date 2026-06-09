/* global jest */
/* eslint-env jest */
import { MARVEL_MULTIVERSE } from '../config.mjs';
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
            // Ensure system property is set
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

    // Foundry uses 'id' as a getter for '_id'
    get id() {
        return this._id;
    }

    prepareData() {
        this.prepareDerivedData();
    }

    prepareDerivedData() {
        // Override in subclass
    }

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
        // If test-specific data is passed in use it, otherwise use default data
        if (data) {
            Object.assign(this, data);
        } else {
            this._id = 1;
            this.name = 'Anonymous Hero';
            Object.assign(this, {
                system: {},
            });
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

    prepareBaseData() {
        // Override in subclass
    }

    prepareDerivedData() {
        // Override in subclass
    }

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
            this.name = 'Anonymous Hero';
            Object.assign(this, {
                system: {},
            });
            this.getData = function () {
                const response = {};
                return response;
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
 * ChatMessage
 */
class ChatMessage {
    constructor(data, options) {
        // If test-specific data is passed in use it, otherwise use default data
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
global.CONFIG = { MARVEL_MULTIVERSE };

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
 * Localization
 */
class Localization {
    localize(stringId) {
        // Just strip the namespace off the string ID to simulate the lookup
        return stringId.replace('MARVEL_MULTIVERSE.', '');
    }

    format(stringId, data = {}) {
        let returnString = stringId.replace('MARVEL_MULTIVERSE.', '');
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
 * ChatMessage
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

// Foundry's implementation of getType
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

// Foundry's implementation of setProperty
global.setProperty = function (object, key, value) {
    let target = object;
    let changed = false;

    // Convert the key to an object reference if it contains dot notation
    if (key.indexOf('.') !== -1) {
        const parts = key.split('.');
        key = parts.pop();
        target = parts.reduce((o, i) => {
            if (!Object.prototype.hasOwnProperty.call(o, i)) o[i] = {};
            return o[i];
        }, object);
    }

    // Update the target
    if (target[key] !== value) {
        changed = true;
        target[key] = value;
    }

    // Return changed status
    return changed;
};

// Foundry's implementation of expandObject
global.expandObject = function (obj, _d = 0) {
    const expanded = {};
    if (_d > 10) throw new Error('Maximum depth exceeded');
    for (let [k, v] of Object.entries(obj)) {
        if (v instanceof Object && !Array.isArray(v)) v = global.expandObject(v, _d + 1);
        global.setProperty(expanded, k, v);
    }
    return expanded;
};

// Foundry's implementation of duplicate
global.duplicate = function (original) {
    return JSON.parse(JSON.stringify(original));
};

// Foundry's implementation of mergeObject
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

    // Maybe copy the original data at depth 0
    if (!inplace && _d === 0) original = global.duplicate(original);

    // Enforce object expansion at depth 0
    if (_d === 0 && Object.keys(original).some((k) => /\./.test(k)))
        original = global.expandObject(original);
    if (_d === 0 && Object.keys(other).some((k) => /\./.test(k)))
        other = global.expandObject(other);

    // Iterate over the other object
    for (let [k, v] of Object.entries(other)) {
        const tv = global.getType(v);

        // Prepare to delete
        let toDelete = false;
        if (k.startsWith('-=')) {
            k = k.slice(2);
            toDelete = v === null;
        }

        // Get the existing object
        let x = original[k];
        let has = Object.prototype.hasOwnProperty.call(original, k);
        let tx = global.getType(x);

        // Ensure that inner objects exist
        if (!has && tv === 'Object') {
            x = original[k] = {};
            has = true;
            tx = 'Object';
        }

        // Case 1 - Key exists
        if (has) {
            // 1.1 - Recursively merge an inner object
            if (tv === 'Object' && tx === 'Object' && recursive) {
                global.mergeObject(
                    x,
                    v,
                    {
                        insertKeys,
                        insertValues,
                        overwrite,
                        inplace: true,
                        enforceTypes,
                    },
                    depth
                );

                // 1.2 - Remove an existing key
            } else if (toDelete) {
                delete original[k];

                // 1.3 - Overwrite existing value
            } else if (overwrite) {
                if (tx && tv !== tx && enforceTypes) {
                    throw new Error('Mismatched data types encountered during object merge.');
                }
                original[k] = v;

                // 1.4 - Insert new value
            } else if (x === undefined && insertValues) {
                original[k] = v;
            }

            // Case 2 - Key does not exist
        } else if (!toDelete) {
            const canInsert = (depth === 1 && insertKeys) || (depth > 1 && insertValues);
            if (canInsert) original[k] = v;
        }
    }

    // Return the object for use
    return original;
};

global.renderTemplate = async function (template, data) {};

/**
 * Foundry namespaced APIs (V13+)
 */
global.foundry = {
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
