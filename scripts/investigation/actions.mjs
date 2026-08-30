import { MODULE_ID, OP2 } from "../config.mjs";
import { request } from "../socket.mjs";
import { attemptAccess } from "./access.mjs";
import { buildRouteButton } from "./handlers.mjs";

/**
 * Client side of an investigation scene. The player's client knows their own
 * actor and their own rolls; everything about the point of interest is resolved
 * by a GM, because a world Item never reaches a player's client.
 */

/**
 * The actor a player is acting with: the controlled token first, then the
 * character assigned to the user.
 * @returns {Actor|null}
 */
export function resolveActor() {
	const controlled = canvas?.tokens?.controlled ?? [];
	const fromToken = controlled.find((token) => token.actor?.type === OP2.agentType)?.actor;
	if (fromToken) return fromToken;
	const assigned = game.user.character;
	return assigned?.type === OP2.agentType ? assigned : null;
}

/* -------------------------------------------- */

/**
 * Post the card of a point of interest. The GM runs this, so the card can carry
 * every value a player's client will need.
 * @param {Item} item  The point of interest.
 * @returns {Promise<ChatMessage>}
 */
export async function postPointOfInterest(item) {
	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/investigation/point-card.hbs`,
		{
			item,
			system: item.system,
			skills: item.system.skillKeys,
			access: item.system.access.map((route, index) => buildRouteButton(item, route, index)),
			hasAccess: item.system.access.length > 0,
		}
	);

	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker() });
}

/* -------------------------------------------- */

/**
 * `Investigar`: the book compares the row DTs against the VALUE the character
 * has in the skill, not against a roll.
 * @param {Actor} actor      Character investigating.
 * @param {string} itemUuid  Point of interest.
 * @param {string} skillKey  Skill chosen.
 * @returns {Promise<void>}
 */
export async function investigate(actor, itemUuid, skillKey) {
	await request("investigate", {
		itemUuid,
		actorUuid: actor.uuid,
		skillKey,
		value: actor.system.skills[skillKey].faces,
	});
}

/* -------------------------------------------- */

/**
 * `Examinar`: roll the skill, then let the GM reveal what the result reaches.
 * A test that finds nothing new costs 1 PD.
 * @param {Actor} actor      Character examining.
 * @param {string} itemUuid  Point of interest.
 * @param {string} skillKey  Skill chosen.
 * @returns {Promise<void>}
 */
export async function examine(actor, itemUuid, skillKey) {
	// `Examinar` has no DT of its own: the result is read against the row DTs.
	const roll = await actor.system.rollTest({ skillKey, dt: null, configure: true });
	if (!roll) return;

	await request("examine", {
		itemUuid,
		actorUuid: actor.uuid,
		skillKey,
		total: roll.total,
		critical: roll.evaluation?.criticalSuccess ?? false,
	});
}

/* -------------------------------------------- */

/**
 * Bind the buttons of the investigation cards. One delegated listener on
 * `document.body` covers every chat layout and survives a hot reload.
 */
export function registerInvestigationListener() {
	const marker = "_op2InvestigationListener";
	if (document.body[marker]) return;

	const handler = async (event) => {
		const button = event.target.closest(
			"[data-action='op2Investigate'], [data-action='op2Examine'], [data-action='op2Access']"
		);
		if (!button) return;
		event.preventDefault();

		const actor = resolveActor();
		if (!actor) return ui.notifications.warn(game.i18n.localize("OP2.Notification.noActor"));

		const { action, skill, itemUuid } = button.dataset;
		button.disabled = true;
		try {
			if (action === "op2Investigate") await investigate(actor, itemUuid, skill);
			else if (action === "op2Examine") await examine(actor, itemUuid, skill);
			else await attemptAccess(actor, { ...button.dataset });
		} finally {
			button.disabled = false;
		}
	};

	document.body[marker] = handler;
	document.body.addEventListener("click", handler);
}
