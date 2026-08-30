import { MODULE_ID, OP2 } from "../config.mjs";
import { postPointOfInterest } from "../investigation/actions.mjs";
import { parseCombinationFormula } from "../investigation/unlock.mjs";

const { api, sheets, ux } = foundry.applications;

/** Every array the form writes back, so the object Foundry builds becomes a list again. */
const ARRAY_PATHS = ["system.infos", "system.access", "system.tools"];

/**
 * Authoring sheet of a point of interest. The GM fills the table here and sends
 * the point to chat; the players act from the chat card.
 */
export class OP2PointOfInterestSheet extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {
	/** @override */
	static DEFAULT_OPTIONS = {
		classes: ["op2", "sheet", "item", "op2-poi", "themed", "theme-light"],
		tag: "form",
		position: { width: 680, height: 720 },
		window: { resizable: true, icon: "fa-solid fa-magnifying-glass" },
		form: { submitOnChange: true },
		actions: {
			postToChat: OP2PointOfInterestSheet.#onPostToChat,
			addRow: OP2PointOfInterestSheet.#onAddRow,
			deleteRow: OP2PointOfInterestSheet.#onDeleteRow,
			resetReveals: OP2PointOfInterestSheet.#onResetReveals,
			rollCombination: OP2PointOfInterestSheet.#onRollCombination,
		},
	};

	/** @override */
	static PARTS = {
		header: { id: "header", template: `modules/${MODULE_ID}/templates/investigation/poi-header.hbs` },
		tabs: { id: "tabs", template: "templates/generic/tab-navigation.hbs" },
		infos: { id: "infos", template: `modules/${MODULE_ID}/templates/investigation/poi-infos.hbs`, scrollable: [""] },
		access: { id: "access", template: `modules/${MODULE_ID}/templates/investigation/poi-access.hbs`, scrollable: [""] },
		notes: { id: "notes", template: `modules/${MODULE_ID}/templates/investigation/poi-notes.hbs`, scrollable: [""] },
	};

	/** @override */
	static TABS = {
		primary: {
			tabs: [
				{ id: "infos", label: "OP2.Tab.infos" },
				{ id: "access", label: "OP2.Tab.access" },
				{ id: "notes", label: "OP2.Tab.notes" },
			],
			initial: "infos",
		},
	};

	/* -------------------------------------------- */

	/** @override */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const system = this.item.system;

		context.tabs = this._prepareTabs("primary");
		context.system = system;
		context.systemFields = system.schema.fields;
		context.disabled = !this.isEditable;
		context.isEditable = this.isEditable;

		context.skillChoices = {
			"": "OP2.Investigation.sameSkill",
			...Object.fromEntries(Object.entries(OP2.skills).map(([key, cfg]) => [key, cfg.label])),
		};
		context.accessChoices = OP2.accessTypes;
		context.resourceChoices = { pv: "OP2.Field.pv", pd: "OP2.Field.pd" };

		context.infos = system.resolvedInfos.map((info, index) => ({ ...info, index }));
		context.accessRows = system.access.map((route, index) => ({
			...route,
			index,
			isUnlock: route.type === "destrancar",
			combinationText: route.combination.join(" - "),
			attemptsUsed: route.attempts.length,
		}));
		context.toolRows = system.tools.map((tool, index) => ({ ...tool, index }));

		return context;
	}

	/* -------------------------------------------- */

	/** @override */
	async _preparePartContext(partId, context) {
		const part = await super._preparePartContext(partId, context);
		if (part.tabs?.[partId]) part.tab = part.tabs[partId];

		if (partId === "notes") {
			const enrich = (value) =>
				ux.TextEditor.implementation.enrichHTML(value, { secrets: this.document.isOwner, relativeTo: this.item });
			part.enrichedBasic = await enrich(this.item.system.basicDescription);
			part.enrichedContextual = await enrich(this.item.system.contextual);
		}

		return part;
	}

	/* -------------------------------------------- */

	/** @override */
	_prepareSubmitData(event, form, formData, updateData) {
		const data = super._prepareSubmitData(event, form, formData, updateData);
		for (const path of ARRAY_PATHS) {
			const value = foundry.utils.getProperty(data, path);
			if (!value || Array.isArray(value)) continue;
			const list = Object.entries(value)
				.sort(([a], [b]) => Number(a) - Number(b))
				.map(([, entry]) => entry);
			foundry.utils.setProperty(data, path, list);
		}
		return data;
	}

	/* -------------------------------------------- */
	/*  Actions                                     */
	/* -------------------------------------------- */

	/** Send the point of interest to chat, so the players can act on it. */
	static async #onPostToChat() {
		await postPointOfInterest(this.item);
	}

	/** Append a row to one of the lists. */
	static async #onAddRow(_event, target) {
		if (!this.isEditable) return;
		const list = target.dataset.list;
		const rows = this.item.system.toObject()[list] ?? [];

		if (list === "infos") rows.push({ id: foundry.utils.randomID(), skill: "", dt: 6, text: "" });
		else if (list === "access") rows.push({ type: "destrancar", dt: 7 });
		else rows.push({ name: "", text: "" });

		return this.item.update({ [`system.${list}`]: rows });
	}

	/** Remove one row by index. */
	static async #onDeleteRow(_event, target) {
		if (!this.isEditable) return;
		const list = target.dataset.list;
		const rows = this.item.system.toObject()[list] ?? [];
		rows.splice(Number(target.dataset.index), 1);
		return this.item.update({ [`system.${list}`]: rows });
	}

	/**
	 * Roll the hidden combination of a `Destrancar` route from its formula, and
	 * clear the guesses already made. Only the GM ever sees the numbers.
	 */
	static async #onRollCombination(_event, target) {
		if (!this.isEditable) return;
		const index = Number(target.dataset.index);
		const routes = this.item.system.toObject().access;
		const route = routes[index];
		if (!route) return;

		const parsed = parseCombinationFormula(route.password);
		if (!parsed) return ui.notifications.warn(game.i18n.localize("OP2.Unlock.badFormula"));

		const roll = await new Roll(`${parsed.count}d${parsed.faces}`).evaluate();
		routes[index] = {
			...route,
			combination: roll.dice[0].results.map((result) => result.result),
			combinationFaces: parsed.faces,
			attempts: [],
			broken: false,
			solved: false,
		};
		await this.item.update({ "system.access": routes });
		ui.notifications.info(game.i18n.localize("OP2.Unlock.generated"));
	}

	/** Hide every line again, to run the scene with another group. */
	static async #onResetReveals() {
		if (!this.isEditable) return;
		const infos = this.item.system.toObject().infos.map((info) => ({ ...info, revealed: false }));
		return this.item.update({ "system.infos": infos });
	}
}

export default OP2PointOfInterestSheet;
