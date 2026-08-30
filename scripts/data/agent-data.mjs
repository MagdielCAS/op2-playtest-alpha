import { OP2 } from "../config.mjs";
import { stepDie, dieLabel } from "../dice/die-step.mjs";
import { paranormalAllowed } from "../settings.mjs";
import { rollTest } from "../dice/test-workflow.mjs";

const fields = foundry.data.fields;

/** A die on the d4–d20 scale, with the step modifiers applied on top of it. */
function dieField(initial = 4) {
	return new fields.SchemaField({
		value: new fields.NumberField({ required: true, integer: true, initial, choices: OP2.dieLadder }),
		step: new fields.NumberField({ required: true, integer: true, initial: 0 }),
	});
}

/** A pool such as PV or PD. */
function resourceField(initial) {
	return new fields.SchemaField({
		value: new fields.NumberField({ required: true, integer: true, min: 0, initial }),
		max: new fields.NumberField({ required: true, integer: true, min: 0, initial }),
	});
}

/**
 * Character of Ordem Paranormal 2 Playtest Alpha.
 * Registered as the sub-type `op2-playtest-alpha.agent`, so it never touches
 * the data of the `agent` type of the base system.
 */
export class OP2AgentData extends foundry.abstract.TypeDataModel {
	/** @override */
	static defineSchema() {
		const skills = Object.fromEntries(Object.keys(OP2.skills).map((key) => [key, dieField(4)]));

		return {
			profile: new fields.StringField({
				required: true,
				initial: "executor",
				choices: Object.keys(OP2.profiles),
			}),
			occupation: new fields.StringField({ required: true, blank: true, initial: "" }),
			level: new fields.NumberField({ required: true, integer: true, min: 1, max: 10, initial: 1 }),

			pv: resourceField(10),
			pd: resourceField(10),
			impeto: new fields.SchemaField({
				value: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
				max: new fields.NumberField({ required: true, integer: true, min: 0, initial: 3 }),
			}),

			attributes: new fields.SchemaField({
				physical: dieField(6),
				mind: dieField(6),
				emotion: dieField(6),
			}),

			skills: new fields.SchemaField(skills),

			abilities: new fields.ArrayField(
				new fields.SchemaField({
					name: new fields.StringField({ required: true, blank: true, initial: "" }),
					source: new fields.StringField({ required: true, blank: true, initial: "" }),
					description: new fields.StringField({ required: true, blank: true, initial: "" }),
				}),
				{ initial: [] }
			),

			biography: new fields.HTMLField({ required: true, blank: true, initial: "" }),
			notes: new fields.HTMLField({ required: true, blank: true, initial: "" }),
		};
	}

	/* -------------------------------------------- */

	/**
	 * Add the effective die of every attribute and skill.
	 * `value` is the die on the sheet, `step` comes from Active Effects, and
	 * `faces` is what the test actually rolls.
	 * @override
	 */
	prepareDerivedData() {
		const allowParanormal = paranormalAllowed();

		for (const [key, config] of Object.entries(OP2.attributes)) {
			const attribute = this.attributes[key];
			attribute.faces = stepDie(attribute.value, attribute.step, { allowParanormal });
			attribute.label = game.i18n.localize(config.label);
			attribute.dieLabel = dieLabel(attribute.faces);
		}

		for (const [key, config] of Object.entries(OP2.skills)) {
			const skill = this.skills[key];
			skill.faces = stepDie(skill.value, skill.step, { allowParanormal });
			skill.label = game.i18n.localize(config.label);
			skill.dieLabel = dieLabel(skill.faces);
			skill.attribute = config.attribute;
			skill.group = config.group ?? null;
		}

		this.pv.value = Math.min(this.pv.value, this.pv.max);
		this.pd.value = Math.min(this.pd.value, this.pd.max);
		this.impeto.value = Math.min(this.impeto.value, this.impeto.max);
	}

	/* -------------------------------------------- */

	/** @override */
	getRollData() {
		const data = { level: this.level, pv: this.pv, pd: this.pd, impeto: this.impeto };
		for (const key of Object.keys(OP2.attributes)) data[key] = this.attributes[key].faces;
		for (const key of Object.keys(OP2.skills)) data[key] = this.skills[key].faces;
		return data;
	}

	/* -------------------------------------------- */

	/**
	 * Roll a test of this character.
	 * @param {object} config  See `rollTest`.
	 * @returns {Promise<OP2Roll|null>}
	 */
	async rollTest(config = {}) {
		return rollTest(this.parent, config);
	}

	/* -------------------------------------------- */

	/**
	 * True when this character has the Ímpeto track of the Executor profile.
	 * @returns {boolean}
	 */
	get hasImpeto() {
		return this.profile === OP2.impeto.profile;
	}

	/* -------------------------------------------- */

	/**
	 * Spend boxes of the Ímpeto track to raise one attribute by one step.
	 * The effect has no duration in Foundry, so the GM removes it at the end of
	 * the scene.
	 * @param {string} attributeKey  Attribute to raise.
	 * @returns {Promise<ActiveEffect|null>}  Null when there are not enough boxes.
	 */
	async spendImpetoOnAttribute(attributeKey) {
		if (!this.hasImpeto) return null;
		if (!OP2.attributes[attributeKey]) throw new Error(`Unknown OP2 attribute: ${attributeKey}`);
		if (this.impeto.value < OP2.impeto.attributeCost) return null;

		const actor = this.parent;
		await actor.update({ "system.impeto.value": this.impeto.value - OP2.impeto.attributeCost });

		const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
			{
				name: game.i18n.format("OP2.Effect.impetoAttribute", {
					attribute: game.i18n.localize(OP2.attributes[attributeKey].label),
				}),
				img: "icons/magic/control/buff-strength-muscle-damage-red.webp",
				origin: actor.uuid,
				changes: [
					{
						key: `system.attributes.${attributeKey}.step`,
						mode: CONST.ACTIVE_EFFECT_MODES.ADD,
						value: "1",
					},
				],
				flags: { [OP2.moduleId]: { source: "impeto" } },
			},
		]);
		return effect ?? null;
	}

	/* -------------------------------------------- */

	/**
	 * How many `Destrancar` attempts this character makes per round.
	 * @returns {number}
	 */
	get unlockAttempts() {
		return OP2.unlockAttemptsByCrime[this.skills.crime.faces] ?? 1;
	}
}

export default OP2AgentData;
