import { MODULE_ID } from "./config.mjs";

export const SOCKET = `module.${MODULE_ID}`;

/**
 * Mark lines of a point of interest as revealed. World Items are owned by the
 * GM, so a player asks the first active GM to write the change.
 * @param {string} itemUuid   UUID of the point of interest.
 * @param {string[]} infoIds  Ids of the lines to reveal.
 * @returns {Promise<void>}
 */
export async function requestReveal(itemUuid, infoIds) {
	if (!infoIds?.length) return;
	if (game.user.isGM) return applyReveal(itemUuid, infoIds);
	game.socket.emit(SOCKET, { type: "revealInfos", itemUuid, infoIds, userId: game.user.id });
}

/* -------------------------------------------- */

/**
 * Write the reveal on the point of interest. Runs on a GM client only.
 * @param {string} itemUuid   UUID of the point of interest.
 * @param {string[]} infoIds  Ids of the lines to reveal.
 * @returns {Promise<void>}
 */
export async function applyReveal(itemUuid, infoIds) {
	const item = await fromUuid(itemUuid);
	if (!item?.isOwner) return;

	const ids = new Set(infoIds);
	const infos = item.system.toObject().infos.map((info) => (ids.has(info.id) ? { ...info, revealed: true } : info));
	await item.update({ "system.infos": infos });
}

/* -------------------------------------------- */

/**
 * Listen for reveal requests. Only the first active GM answers, so the write
 * happens exactly once.
 */
export function registerSocket() {
	game.socket.on(SOCKET, async (data) => {
		const firstGM = game.users.find((u) => u.isGM && u.active);
		if (!firstGM || firstGM.id !== game.user.id) return;
		if (data?.type !== "revealInfos") return;
		await applyReveal(data.itemUuid, data.infoIds);
	});
}
