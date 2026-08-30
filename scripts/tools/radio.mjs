import { MODULE_ID, OP2 } from "../config.mjs";

/**
 * `Rádio Modificado`: a Tecnologia test removes false word sets from the puzzle
 * the GM hands the player.
 */

/**
 * How many false sets the result removes. `null` means every one of them.
 * @param {number} total                Result of the Tecnologia test.
 * @param {object[]} [table]            `OP2.tools.radio.table`, highest band first.
 * @returns {number|null}
 */
export function falseSetsRemoved(total, table = OP2.tools.radio.table) {
	const band = table.find((entry) => total >= entry.min);
	return band ? band.removed : 0;
}

/* -------------------------------------------- */

/**
 * Use the modified radio.
 * @param {Actor} actor  Character listening.
 * @returns {Promise<ChatMessage|null>}  Null when the player cancels the roll.
 */
export async function runRadio(actor) {
	const config = OP2.tools.radio;
	// The radio has no DT: the result is read on its own band table.
	const roll = await actor.system.rollTest({ skillKey: config.skill, dt: null, configure: true });
	if (!roll) return null;

	const removed = falseSetsRemoved(roll.total);
	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/tools/radio-card.hbs`,
		{
			total: roll.total,
			removed,
			all: removed === null,
			none: removed === 0,
		}
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}
