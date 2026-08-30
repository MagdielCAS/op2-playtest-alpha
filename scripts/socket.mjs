import { MODULE_ID } from "./config.mjs";

export const SOCKET = `module.${MODULE_ID}`;

/** Handlers that run on a GM client only, keyed by request type. */
const handlers = new Map();

/**
 * Register a GM-side handler.
 * @param {string} type                      Request type.
 * @param {(payload: object) => Promise<*>} handler  What the GM runs.
 */
export function registerHandler(type, handler) {
	handlers.set(type, handler);
}

/* -------------------------------------------- */

/**
 * True on the first active GM client. Only that client answers a request, so a
 * table with two GMs does not resolve everything twice.
 * @returns {boolean}
 */
export function isPrimaryGM() {
	const first = game.users.find((user) => user.isGM && user.active);
	return Boolean(first) && first.id === game.user.id;
}

/* -------------------------------------------- */

/**
 * Ask a GM to resolve something.
 *
 * A point of interest is a world Item, which Foundry does not send to players
 * at all. Every read of its data, and every write, therefore happens on a GM
 * client: the player only sends what their own client knows — their actor, and
 * the result they rolled.
 *
 * @param {string} type     Request type.
 * @param {object} payload  Data the handler needs.
 * @returns {Promise<*>}    The handler result when the caller is a GM, else null.
 */
export async function request(type, payload) {
	const message = { ...payload, userId: game.user.id };

	if (game.user.isGM) {
		const handler = handlers.get(type);
		return handler ? handler(message) : null;
	}

	if (!game.users.some((user) => user.isGM && user.active)) {
		ui.notifications.warn(game.i18n.localize("OP2.Notification.noGM"));
		return null;
	}

	game.socket.emit(SOCKET, { type, payload: message });
	return null;
}

/* -------------------------------------------- */

/** Listen for requests. Call once, in the `ready` hook. */
export function registerSocket() {
	game.socket.on(SOCKET, async ({ type, payload }) => {
		if (!isPrimaryGM()) return;
		const handler = handlers.get(type);
		if (!handler) return;
		await handler(payload);
	});
}
