import { MODULE_ID, OP2 } from "../config.mjs";
import { defaultDT } from "../settings.mjs";

const { api, sheets, ux } = foundry.applications;

/**
 * Character sheet of the Ordem Paranormal 2 playtest agent.
 * Registered only for the sub-type `op2-playtest-alpha.agent`.
 */
export class OP2AgentSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {
	/** @override */
	static DEFAULT_OPTIONS = {
		classes: ["op2", "sheet", "actor", "themed", "theme-light"],
		tag: "form",
		position: { width: 640, height: 780 },
		window: { resizable: true, icon: "fa-solid fa-user-secret" },
		form: { submitOnChange: true },
		actions: {
			editImage: OP2AgentSheet.#onEditImage,
			rollSkill: OP2AgentSheet.#onRollSkill,
			setImpeto: OP2AgentSheet.#onSetImpeto,
			addAbility: OP2AgentSheet.#onAddAbility,
			deleteAbility: OP2AgentSheet.#onDeleteAbility,
		},
	};

	/** @override */
	static PARTS = {
		header: { id: "header", template: `modules/${MODULE_ID}/templates/actor/header.hbs` },
		tabs: { id: "tabs", template: "templates/generic/tab-navigation.hbs" },
		main: { id: "main", template: `modules/${MODULE_ID}/templates/actor/main.hbs`, scrollable: [""] },
		abilities: { id: "abilities", template: `modules/${MODULE_ID}/templates/actor/abilities.hbs`, scrollable: [""] },
		biography: { id: "biography", template: `modules/${MODULE_ID}/templates/actor/biography.hbs`, scrollable: [""] },
	};

	/** @override */
	static TABS = {
		primary: {
			tabs: [
				{ id: "main", label: "OP2.Tab.main" },
				{ id: "abilities", label: "OP2.Tab.abilities" },
				{ id: "biography", label: "OP2.Tab.biography" },
			],
			initial: "main",
		},
	};

	/* -------------------------------------------- */

	/** @override */
	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const system = this.actor.system;

		context.tabs = this._prepareTabs("primary");

		context.system = system;
		context.config = OP2;
		context.dieChoices = OP2.dieChoices;
		context.profileChoices = OP2.profiles;
		context.isEditable = this.isEditable;
		context.disabled = !this.isEditable;
		context.systemFields = system.schema.fields;

		context.impetoBoxes = Array.fromRange(system.impeto.max).map((index) => ({
			index,
			label: String(index + 1),
			filled: index < system.impeto.value,
		}));

		context.attributes = Object.keys(OP2.attributes).map((key) => ({
			key,
			path: `system.attributes.${key}`,
			...system.attributes[key],
		}));

		const rows = Object.entries(OP2.skills).map(([key, config]) => ({
			key,
			path: `system.skills.${key}`,
			group: config.group ?? null,
			attributeLabel: game.i18n.localize(OP2.attributes[config.attribute].label),
			...system.skills[key],
		}));

		context.skills = rows.filter((row) => !row.group);
		context.aptitudes = rows.filter((row) => row.group === "aptitude");
		context.aptitudeLabel = game.i18n.localize(OP2.skillGroups.aptitude);

		return context;
	}

	/* -------------------------------------------- */

	/** @override */
	async _preparePartContext(partId, context) {
		const part = await super._preparePartContext(partId, context);
		if (part.tabs?.[partId]) part.tab = part.tabs[partId];

		if (partId === "biography") {
			const enrich = (value) =>
				ux.TextEditor.implementation.enrichHTML(value, {
					secrets: this.document.isOwner,
					rollData: this.actor.getRollData(),
					relativeTo: this.actor,
				});
			part.enrichedBiography = await enrich(this.actor.system.biography);
			part.enrichedNotes = await enrich(this.actor.system.notes);
		}

		return part;
	}

	/* -------------------------------------------- */

	/**
	 * Foundry expands `system.abilities.0.name` into an object. The schema needs
	 * an array, so rebuild it before the update reaches the document.
	 * @override
	 */
	_prepareSubmitData(event, form, formData, updateData) {
		const data = super._prepareSubmitData(event, form, formData, updateData);
		const abilities = foundry.utils.getProperty(data, "system.abilities");
		if (abilities && !Array.isArray(abilities)) {
			const list = Object.entries(abilities)
				.sort(([a], [b]) => Number(a) - Number(b))
				.map(([, value]) => value);
			foundry.utils.setProperty(data, "system.abilities", list);
		}
		return data;
	}

	/* -------------------------------------------- */
	/*  Actions                                     */
	/* -------------------------------------------- */

	/** Pick a new portrait. */
	static async #onEditImage(_event, target) {
		if (!this.isEditable) return;
		const current = this.document.img;
		const picker = new foundry.applications.apps.FilePicker.implementation({
			type: "image",
			current,
			callback: (path) => this.document.update({ img: path }),
			top: this.position.top + 40,
			left: this.position.left + 10,
		});
		return picker.browse();
	}

	/**
	 * Roll a skill test. Hold Ctrl or Meta to skip the configuration dialog.
	 */
	static async #onRollSkill(event, target) {
		const skillKey = target.dataset.skill;
		if (!skillKey) return;
		const fast = event.ctrlKey || event.metaKey;
		return this.actor.system.rollTest({ skillKey, dt: defaultDT(), configure: !fast });
	}

	/** Fill or clear the Ímpeto track up to the clicked box. */
	static async #onSetImpeto(_event, target) {
		if (!this.isEditable) return;
		const index = Number(target.dataset.index);
		const current = this.actor.system.impeto.value;
		const next = current === index + 1 ? index : index + 1;
		return this.actor.update({ "system.impeto.value": next });
	}

	/** Append an empty ability. */
	static async #onAddAbility() {
		if (!this.isEditable) return;
		const abilities = this.actor.system.toObject().abilities ?? [];
		abilities.push({ name: game.i18n.localize("OP2.Ability.new"), source: "", description: "" });
		return this.actor.update({ "system.abilities": abilities });
	}

	/** Remove one ability by index. */
	static async #onDeleteAbility(_event, target) {
		if (!this.isEditable) return;
		const index = Number(target.dataset.index);
		const abilities = this.actor.system.toObject().abilities ?? [];
		abilities.splice(index, 1);
		return this.actor.update({ "system.abilities": abilities });
	}
}

export default OP2AgentSheet;
