import { OP2 } from "../config.mjs";
import { resolveSkills, selectPending } from "../investigation/reveal.mjs";

const fields = foundry.data.fields;

/**
 * One line of the `Perícia | DT | Informação` table of a point of interest.
 * A blank `skill` continues the skill of the line above, the way the book
 * prints it.
 */
function infoField() {
	return new fields.SchemaField({
		id: new fields.StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
		skill: new fields.StringField({ required: true, blank: true, initial: "" }),
		qualifier: new fields.StringField({ required: true, blank: true, initial: "" }),
		dt: new fields.NumberField({ required: true, integer: true, min: 0, initial: 6 }),
		text: new fields.StringField({ required: true, blank: true, initial: "" }),
		locked: new fields.BooleanField({ initial: false }),
		condition: new fields.StringField({ required: true, blank: true, initial: "" }),
		revealed: new fields.BooleanField({ initial: false }),
	});
}

/** One route of an access challenge. Unused fields stay blank. */
function accessField() {
	return new fields.SchemaField({
		type: new fields.StringField({
			required: true,
			initial: "destrancar",
			choices: Object.keys(OP2.accessTypes),
		}),
		label: new fields.StringField({ required: true, blank: true, initial: "" }),
		dt: new fields.NumberField({ required: true, integer: true, min: 0, initial: 7 }),
		/** `PA` for Arrombar, or the number of correct answers for a hack. */
		target: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
		/** Dice of the Destrancar combination, for example `4d6`. */
		password: new fields.StringField({ required: true, blank: true, initial: "" }),
		/** Maximum attempts before the lock breaks. Zero means no limit. */
		maxAttempts: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
		notes: new fields.StringField({ required: true, blank: true, initial: "" }),
		/** Hidden combination of `Destrancar`, in the order the dice were rolled. */
		combination: new fields.ArrayField(new fields.NumberField({ integer: true, min: 1 }), { initial: [] }),
		/** Faces of the dice of that combination, so the guess form can bound its inputs. */
		combinationFaces: new fields.NumberField({ required: true, integer: true, min: 2, initial: 6 }),
		/** Every guess made, with the answer given. */
		attempts: new fields.ArrayField(
			new fields.SchemaField({
				guess: new fields.ArrayField(new fields.NumberField({ integer: true, min: 1 }), { initial: [] }),
				feedback: new fields.ArrayField(new fields.StringField(), { initial: [] }),
				actorName: new fields.StringField({ required: true, blank: true, initial: "" }),
			}),
			{ initial: [] }
		),
		/** A lock that ran out of attempts can no longer be picked. */
		broken: new fields.BooleanField({ initial: false }),

		/** Score accumulated by `Arrombar`. */
		progress: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
		/** Actions already completed: the safe `Alcançar`, or rounds of `Sustentar`. */
		stage: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
		solved: new fields.BooleanField({ initial: false }),
	});
}

/**
 * A point of interest of an investigation scene.
 * Registered as the Item sub-type `op2-playtest-alpha.pointOfInterest`. An Item
 * is used instead of a journal page because the sheet API of `ItemSheetV2` is
 * the same one the agent sheet already uses.
 */
export class OP2PointOfInterestData extends foundry.abstract.TypeDataModel {
	/** @override */
	static defineSchema() {
		return {
			mapNumber: new fields.StringField({ required: true, blank: true, initial: "" }),
			keyEvidence: new fields.BooleanField({ initial: false }),

			/** Read aloud when a character uses `Investigar` on this point. */
			basicDescription: new fields.HTMLField({ required: true, blank: true, initial: "" }),
			/** Read by the GM only. */
			contextual: new fields.HTMLField({ required: true, blank: true, initial: "" }),

			infos: new fields.ArrayField(infoField(), { initial: [] }),
			access: new fields.ArrayField(accessField(), { initial: [] }),

			/** One reading per Ordo Realitas tool. */
			tools: new fields.ArrayField(
				new fields.SchemaField({
					name: new fields.StringField({ required: true, blank: true, initial: "" }),
					text: new fields.StringField({ required: true, blank: true, initial: "" }),
				}),
				{ initial: [] }
			),

			/** A test the point forces, such as the Disciplina DT 10 of the body. */
			trigger: new fields.SchemaField({
				skill: new fields.StringField({ required: true, blank: true, initial: "" }),
				dt: new fields.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
				resource: new fields.StringField({ required: true, blank: true, initial: "pd" }),
				amount: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
				text: new fields.StringField({ required: true, blank: true, initial: "" }),
			}),
		};
	}

	/* -------------------------------------------- */

	/**
	 * Resolve the skill of every line, so a line that continues the line above
	 * carries the same skill.
	 * @override
	 */
	prepareDerivedData() {
		this.resolvedInfos = resolveSkills(this.infos).map((info) => {
			const config = OP2.skills[info.skill];
			const label = config ? game.i18n.localize(config.label) : info.skill;
			return {
				...info,
				label,
				qualified: info.qualifier ? `${label} (${info.qualifier})` : label,
			};
		});
	}

	/* -------------------------------------------- */

	/**
	 * The skills this point offers, in the order the book prints them.
	 * @returns {{key: string, label: string}[]}
	 */
	get skillKeys() {
		const seen = new Map();
		for (const info of this.resolvedInfos ?? []) {
			if (!info.skill || seen.has(info.skill)) continue;
			seen.set(info.skill, { key: info.skill, label: info.label });
		}
		return [...seen.values()];
	}

	/* -------------------------------------------- */

	/**
	 * Lines of one skill that a value or a test result would reveal.
	 * A locked line never reveals on its own. The GM opens it by hand.
	 * @param {string} skillKey  Skill chosen by the character.
	 * @param {number} value     Skill die for `Investigar`, or the test total for `Examinar`.
	 * @returns {object[]}       Lines not yet revealed whose DT the value reaches.
	 */
	pendingInfos(skillKey, value) {
		return selectPending(this.resolvedInfos, skillKey, value);
	}
}

export default OP2PointOfInterestData;
