import { MODULE_ID, OP2 } from "../config.mjs";
import { applyDamage } from "./survival.mjs";

/** Scene flag that holds the round counter of an investigation scene. */
export const ROUND_FLAG = "investigationRound";

/**
 * `Sobrecarga mental`: the emotional damage every character takes at the end of
 * a round of an investigation scene. The last entry of the progression repeats
 * from then on.
 * @param {number} round             Round that just ended, counted from 1.
 * @param {string[]} [progression]   Damage formula per round.
 * @returns {string}                 A formula such as `0`, `1` or `1d4`.
 */
export function overloadFormula(round, progression = OP2.overload) {
	if (round < 1 || !progression.length) return "0";
	return progression[Math.min(round, progression.length) - 1];
}

/* -------------------------------------------- */

/**
 * Every OP2 agent a player controls. Threats and unassigned sheets are left out.
 * @returns {Actor[]}
 */
export function investigationActors() {
	return game.actors.filter(
		(actor) => actor.type === OP2.agentType && game.users.some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
	);
}

/* -------------------------------------------- */

/**
 * End one round of an investigation scene: raise the counter and apply the
 * mental overload to every agent. Each character rolls their own damage, as the
 * book asks.
 * @param {Scene} scene  Scene that holds the counter.
 * @returns {Promise<ChatMessage|null>}
 */
export async function endRound(scene) {
	if (!scene) {
		ui.notifications.warn(game.i18n.localize("OP2.Overload.noScene"));
		return null;
	}

	const round = (scene.getFlag(MODULE_ID, ROUND_FLAG) ?? 0) + 1;
	await scene.setFlag(MODULE_ID, ROUND_FLAG, round);

	const formula = overloadFormula(round);
	const actors = investigationActors();
	const rolls = [];
	const lines = [];

	for (const actor of actors) {
		let amount = Number(formula);
		if (Number.isNaN(amount)) {
			const roll = await new Roll(formula).evaluate();
			rolls.push(roll);
			amount = roll.total;
		}
		if (amount > 0) await applyDamage(actor, "pd", amount);
		lines.push({ name: actor.name, amount });
	}

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/overload-card.hbs`,
		{ round, formula, lines, anyDamage: lines.some((line) => line.amount > 0) }
	);

	return ChatMessage.create({ content, rolls, speaker: ChatMessage.getSpeaker() });
}
