import { MODULE_ID, OP2 } from "../config.mjs";
import { requestReveal } from "../socket.mjs";
import { dieLabel } from "../dice/die-step.mjs";

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
	if (assigned?.type === OP2.agentType) return assigned;
	return null;
}

/* -------------------------------------------- */

/**
 * Post the card of a point of interest: the basic description, plus one button
 * per skill of its table. The DTs stay hidden from the players.
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
			access: item.system.access.map((route) => ({
				...route,
				typeLabel: game.i18n.localize(OP2.accessTypes[route.type] ?? route.type),
			})),
			hasAccess: item.system.access.length > 0,
		}
	);

	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker() });
}

/* -------------------------------------------- */

/**
 * `Investigar` with one skill. The book compares the DTs against the VALUE the
 * character has in that skill, not against a roll.
 * @param {Actor} actor      Character investigating.
 * @param {Item} item        Point of interest.
 * @param {string} skillKey  Skill chosen.
 * @returns {Promise<ChatMessage>}
 */
export async function investigate(actor, item, skillKey) {
	const faces = actor.system.skills[skillKey].faces;
	const found = item.system.pendingInfos(skillKey, faces);
	await requestReveal(item.uuid, found.map((info) => info.id));

	return postResult(actor, item, skillKey, {
		mode: "investigate",
		measure: game.i18n.format("OP2.Investigation.value", { die: dieLabel(faces) }),
		found,
	});
}

/* -------------------------------------------- */

/**
 * `Examinar`: roll the skill and reveal every new line the result reaches.
 * When nothing new comes out, the character loses 1 PD.
 * @param {Actor} actor      Character examining.
 * @param {Item} item        Point of interest.
 * @param {string} skillKey  Skill chosen.
 * @returns {Promise<ChatMessage|null>}  Null when the player cancels the roll.
 */
export async function examine(actor, item, skillKey) {
	const roll = await actor.system.rollTest({ skillKey, dt: null, configure: true });
	if (!roll) return null;

	const found = item.system.pendingInfos(skillKey, roll.total);
	await requestReveal(item.uuid, found.map((info) => info.id));

	let cost = null;
	if (!found.length) {
		const { resource, amount } = OP2.examineCost;
		const current = actor.system[resource].value;
		await actor.update({ [`system.${resource}.value`]: Math.max(0, current - amount) });
		cost = game.i18n.format("OP2.Investigation.cost", {
			amount,
			resource: game.i18n.localize(`OP2.Field.${resource}`),
		});
	}

	return postResult(actor, item, skillKey, {
		mode: "examine",
		measure: game.i18n.format("OP2.Investigation.result", { total: roll.total }),
		found,
		cost,
		critical: roll.evaluation?.criticalSuccess ?? false,
	});
}

/* -------------------------------------------- */

/**
 * Post what an investigation action produced.
 * @param {Actor} actor      Character acting.
 * @param {Item} item        Point of interest.
 * @param {string} skillKey  Skill used.
 * @param {object} data      Result of the action.
 * @returns {Promise<ChatMessage>}
 */
async function postResult(actor, item, skillKey, data) {
	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/investigation/result-card.hbs`,
		{
			...data,
			item,
			skillLabel: game.i18n.localize(OP2.skills[skillKey].label),
			canExamine: data.mode === "investigate",
			skillKey,
		}
	);

	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
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
		const button = event.target.closest("[data-action='op2Investigate'], [data-action='op2Examine']");
		if (!button) return;
		event.preventDefault();

		const actor = resolveActor();
		if (!actor) return ui.notifications.warn(game.i18n.localize("OP2.Notification.noActor"));

		const item = await fromUuid(button.dataset.itemUuid);
		if (!item) return ui.notifications.warn(game.i18n.localize("OP2.Notification.noPoint"));

		const skillKey = button.dataset.skill;
		button.disabled = true;
		try {
			if (button.dataset.action === "op2Investigate") await investigate(actor, item, skillKey);
			else await examine(actor, item, skillKey);
		} finally {
			button.disabled = false;
		}
	};

	document.body[marker] = handler;
	document.body.addEventListener("click", handler);
}
