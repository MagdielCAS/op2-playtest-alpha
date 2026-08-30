import { MODULE_ID, OP2 } from "../config.mjs";
import { helpSteps } from "../dice/die-step.mjs";

const { DialogV2 } = foundry.applications.api;

/** Flag that carries an offered help until the next test consumes it. */
export const HELP_FLAG = "pendingHelp";

/**
 * `Ajuda`: spend an action and a skill of at least d6 to raise another
 * character's test. A d6 or d8 gives one step, a d10 or d12 gives two.
 * @param {Actor} actor  Character helping.
 * @returns {Promise<ChatMessage|null>}
 */
export async function offerHelp(actor) {
	const options = Object.entries(OP2.skills)
		.map(([key, config]) => {
			const faces = actor.system.skills[key].faces;
			const steps = helpSteps(faces);
			if (!steps) return null;
			const label = game.i18n.localize(config.label);
			return `<option value="${key}">${label} (d${faces} → +${steps})</option>`;
		})
		.filter(Boolean)
		.join("");

	if (!options) {
		ui.notifications.warn(game.i18n.localize("OP2.Help.noSkill"));
		return null;
	}

	const result = await DialogV2.wait({
		window: { title: game.i18n.localize("OP2.Help.title"), icon: "fa-solid fa-handshake-angle" },
		classes: ["op2", "op2-dialog"],
		content: `<div class="form-group">
			<label>${game.i18n.localize("OP2.Help.skill")}</label>
			<div class="form-fields"><select name="skillKey">${options}</select></div>
		</div>
		<p class="hint">${game.i18n.localize("OP2.Help.hint")}</p>`,
		buttons: [
			{
				action: "offer",
				label: "OP2.Help.offer",
				icon: "fa-solid fa-handshake-angle",
				default: true,
				callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
			},
		],
		rejectClose: false,
	});
	if (!result) return null;

	const skillKey = result.skillKey;
	const steps = helpSteps(actor.system.skills[skillKey].faces);

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/help-card.hbs`,
		{
			helperName: actor.name,
			skillLabel: game.i18n.localize(OP2.skills[skillKey].label),
			steps,
		}
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

/* -------------------------------------------- */

/**
 * Accept an offered help. The recipient owns their own actor, so they store the
 * bonus themselves; the next test consumes it.
 * @param {Actor} actor  Character being helped.
 * @param {object} data  Dataset of the button on the help card.
 * @returns {Promise<void>}
 */
export async function acceptHelp(actor, data) {
	const steps = Number(data.steps) || 0;
	if (!steps) return;
	await actor.setFlag(MODULE_ID, HELP_FLAG, { steps, from: data.helperName ?? "" });
	ui.notifications.info(game.i18n.format("OP2.Help.accepted", { steps }));
}

/* -------------------------------------------- */

/**
 * Take the help stored on a character, if any. Reading it clears it, so one
 * offer raises exactly one test.
 * @param {Actor} actor  Character about to roll.
 * @returns {Promise<number>}  Steps to add, or zero.
 */
export async function consumeHelp(actor) {
	const pending = actor.getFlag(MODULE_ID, HELP_FLAG);
	const steps = Number(pending?.steps) || 0;
	if (!steps) return 0;
	await actor.unsetFlag(MODULE_ID, HELP_FLAG);
	return steps;
}
