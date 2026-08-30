import { OP2 } from "../config.mjs";
import { dieLabel } from "./die-step.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * @typedef {object} OP2TestOptions
 * @property {string} attributeKey   Attribute used in the test.
 * @property {number} attributeSteps Step modifiers on the attribute die.
 * @property {number} skillSteps     Step modifiers on the skill die.
 * @property {number} extraDie       Size of an extra die, or 0 for none.
 * @property {number} bonus          Flat bonus added to the sum.
 * @property {number|null} dt        Difficulty of the test.
 */

/**
 * Ask the player how to roll a test.
 * @param {object} config
 * @param {string} config.title                 Window title.
 * @param {string} config.attributeKey          Attribute proposed by the skill.
 * @param {Record<string, number>} config.attributeFaces  Current die of each attribute.
 * @param {number} config.skillFaces            Current die of the skill.
 * @param {number} config.dt                    Difficulty proposed.
 * @returns {Promise<OP2TestOptions|null>}      Null when the player cancels.
 */
export async function promptTest({ title, attributeKey, attributeFaces, skillFaces, dt }) {
	const attributeOptions = Object.entries(OP2.attributes)
		.map(([key, cfg]) => {
			const selected = key === attributeKey ? " selected" : "";
			const label = game.i18n.localize(cfg.label);
			return `<option value="${key}"${selected}>${label} (${dieLabel(attributeFaces[key])})</option>`;
		})
		.join("");

	const extraOptions = [0, 4, 6, 8, 10, 12]
		.map((faces) => {
			const label = faces ? dieLabel(faces) : game.i18n.localize("OP2.Dialog.none");
			return `<option value="${faces}">${label}</option>`;
		})
		.join("");

	const content = `
	<div class="op2-test-dialog">
		<p class="op2-test-dialog__summary">${game.i18n.format("OP2.Dialog.skillDie", { die: dieLabel(skillFaces) })}</p>
		<div class="form-group">
			<label>${game.i18n.localize("OP2.Dialog.attribute")}</label>
			<div class="form-fields"><select name="attributeKey">${attributeOptions}</select></div>
		</div>
		<div class="form-group">
			<label>${game.i18n.localize("OP2.Dialog.attributeSteps")}</label>
			<div class="form-fields"><input type="number" name="attributeSteps" value="0" step="1"></div>
		</div>
		<div class="form-group">
			<label>${game.i18n.localize("OP2.Dialog.skillSteps")}</label>
			<div class="form-fields"><input type="number" name="skillSteps" value="0" step="1"></div>
		</div>
		<div class="form-group">
			<label>${game.i18n.localize("OP2.Dialog.extraDie")}</label>
			<div class="form-fields"><select name="extraDie">${extraOptions}</select></div>
		</div>
		<div class="form-group">
			<label>${game.i18n.localize("OP2.Dialog.bonus")}</label>
			<div class="form-fields"><input type="number" name="bonus" value="0" step="1"></div>
		</div>
		<div class="form-group">
			<label>${game.i18n.localize("OP2.Dialog.dt")}</label>
			<div class="form-fields"><input type="number" name="dt" value="${dt}" step="1"></div>
		</div>
	</div>`;

	const result = await DialogV2.wait({
		window: { title, icon: "fa-solid fa-dice-d6" },
		classes: ["op2", "op2-dialog"],
		content,
		buttons: [
			{
				action: "roll",
				label: "OP2.Dialog.roll",
				icon: "fa-solid fa-dice-d20",
				default: true,
				callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
			},
		],
		rejectClose: false,
	});

	if (!result) return null;

	return {
		attributeKey: result.attributeKey,
		attributeSteps: Number(result.attributeSteps) || 0,
		skillSteps: Number(result.skillSteps) || 0,
		extraDie: Number(result.extraDie) || 0,
		bonus: Number(result.bonus) || 0,
		dt: Number.isFinite(Number(result.dt)) ? Number(result.dt) : null,
	};
}
