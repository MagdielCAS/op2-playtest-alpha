import { MODULE_ID, OP2 } from "./config.mjs";

export const SETTINGS = {
	allowParanormalDie: "allowParanormalDie",
	defaultDT: "defaultDT",
	autoImpeto: "autoImpeto",
};

/** Register the module settings. Call it once, inside the `init` hook. */
export function registerSettings() {
	game.settings.register(MODULE_ID, SETTINGS.allowParanormalDie, {
		name: "OP2.Settings.allowParanormalDie.name",
		hint: "OP2.Settings.allowParanormalDie.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: false,
	});

	game.settings.register(MODULE_ID, SETTINGS.autoImpeto, {
		name: "OP2.Settings.autoImpeto.name",
		hint: "OP2.Settings.autoImpeto.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: true,
	});

	game.settings.register(MODULE_ID, SETTINGS.defaultDT, {
		name: "OP2.Settings.defaultDT.name",
		hint: "OP2.Settings.defaultDT.hint",
		scope: "world",
		config: true,
		type: Number,
		default: OP2.defaultDT,
	});
}

/** @returns {boolean} True when a die can step above d12. */
export function paranormalAllowed() {
	return game.settings?.get(MODULE_ID, SETTINGS.allowParanormalDie) ?? false;
}

/** @returns {number} The default difficulty of a test. */
export function defaultDT() {
	return game.settings?.get(MODULE_ID, SETTINGS.defaultDT) ?? OP2.defaultDT;
}

/** @returns {boolean} True when a failed test fills a box of the Ímpeto track. */
export function autoImpeto() {
	return game.settings?.get(MODULE_ID, SETTINGS.autoImpeto) ?? true;
}
