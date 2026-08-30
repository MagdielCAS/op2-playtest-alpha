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
 * Change one access route of a point of interest. Same GM-authoritative path as
 * the reveals, because the point of interest is a world Item.
 * @param {string} itemUuid  UUID of the point of interest.
 * @param {number} index     Position of the route.
 * @param {object} changes   Fields to write, for example `{progress: 7}`.
 * @returns {Promise<void>}
 */
export async function requestAccessUpdate(itemUuid, index, changes) {
	if (game.user.isGM) return applyAccessUpdate(itemUuid, index, changes);
	game.socket.emit(SOCKET, { type: "updateAccess", itemUuid, index, changes, userId: game.user.id });
}

/* -------------------------------------------- */

/**
 * Write the access change. Runs on a GM client only.
 * @param {string} itemUuid  UUID of the point of interest.
 * @param {number} index     Position of the route.
 * @param {object} changes   Fields to write.
 * @returns {Promise<void>}
 */
export async function applyAccessUpdate(itemUuid, index, changes) {
	const item = await fromUuid(itemUuid);
	if (!item?.isOwner) return;

	const routes = item.system.toObject().access;
	if (!routes[index]) return;
	routes[index] = { ...routes[index], ...changes };
	await item.update({ "system.access": routes });
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
		if (data?.type === "revealInfos") await applyReveal(data.itemUuid, data.infoIds);
		else if (data?.type === "updateAccess") await applyAccessUpdate(data.itemUuid, data.index, data.changes);
	});
}
