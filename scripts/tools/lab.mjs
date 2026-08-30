import { MODULE_ID, OP2, DIE_LADDER } from "../config.mjs";
import { dieIndex } from "../dice/die-step.mjs";

/**
 * `Laboratório Portátil`.
 *
 * The dice are rolled one at a time, starting at d4 and stepping up on each
 * roll, capped at the die of Aptidão (Exatas). Every roll must be equal to or
 * higher than the one before it. The character may reroll a number of dice
 * equal to half of Mente.
 */

/**
 * The ladder of dice for a run.
 * @param {number} count      How many dice the point of interest asks for.
 * @param {number} capFaces   Die of Aptidão (Exatas), which caps the ladder.
 * @returns {number[]}        Die sizes, in rolling order.
 */
export function labSequence(count, capFaces) {
	const capIndex = dieIndex(capFaces);
	return Array.from({ length: count }, (_unused, position) => DIE_LADDER[Math.min(position, capIndex)]);
}

/**
 * Rerolls the character gets: half of the Mente die.
 * @param {number} mindFaces  Die of Mente.
 * @returns {number}
 */
export function labRerolls(mindFaces) {
	return Math.floor(Number(mindFaces) / 2);
}

/**
 * Read a finished run. A run succeeds while every roll is at least as high as
 * the one before it.
 * @param {number[]} results  Faces rolled, in order.
 * @returns {{success: boolean, brokeAt: number|null}}
 *   `brokeAt` is the 1-based position of the first roll that dropped.
 */
export function labOutcome(results) {
	for (let index = 1; index < results.length; index++) {
		if (results[index] < results[index - 1]) return { success: false, brokeAt: index + 1 };
	}
	return { success: true, brokeAt: null };
}

/* -------------------------------------------- */

/**
 * Run the portable laboratory for a character.
 * @param {Actor} actor          Character analysing.
 * @param {number} [count=4]     Dice the point of interest asks for.
 * @returns {Promise<ChatMessage>}
 */
export async function runLab(actor, count = OP2.tools.lab.minDice) {
	const config = OP2.tools.lab;
	const dice = Math.clamp(Number(count) || config.minDice, config.minDice, config.maxDice);

	const capFaces = actor.system.skills[config.skill].faces;
	const sequence = labSequence(dice, capFaces);
	const roll = await new Roll(sequence.map((faces) => `1d${faces}`).join(" + ")).evaluate();

	const results = roll.dice.map((die) => die.results[0].result);
	const outcome = labOutcome(results);

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/tools/lab-card.hbs`,
		{
			sequence: sequence.map((faces, index) => ({
				faces,
				result: results[index],
				position: index + 1,
				broken: outcome.brokeAt === index + 1,
			})),
			rerolls: labRerolls(actor.system.attributes[config.attribute].faces),
			capLabel: `d${capFaces}`,
			...outcome,
		}
	);

	return ChatMessage.create({
		content,
		rolls: [roll],
		speaker: ChatMessage.getSpeaker({ actor }),
		sound: CONFIG.sounds.dice,
	});
}
