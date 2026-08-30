import { MODULE_ID } from "./config.mjs";
import { resolveActor, investigate, examine } from "./investigation/actions.mjs";
import { attemptAccess } from "./investigation/access.mjs";
import { rollCriticalFailure } from "./dice/critical-failure.mjs";
import { rollSurvival } from "./rules/survival.mjs";
import { defend } from "./rules/combat.mjs";
import { acceptHelp } from "./rules/help.mjs";

/**
 * Every button the module puts on a chat card.
 *
 * One delegated listener on `document.body` covers the sidebar, the popout and
 * the notification toasts, and a hot reload finds the marker already set
 * instead of adding a second listener.
 */

/** Actions that act on the actor named by the button, not on the acting player. */
const NAMED_ACTOR_ACTIONS = new Set(["op2CriticalFailure", "op2Survival"]);

const SELECTOR = [
	"op2Investigate",
	"op2Examine",
	"op2Access",
	"op2CriticalFailure",
	"op2Survival",
	"op2Defend",
	"op2AcceptHelp",
]
	.map((action) => `[data-action='${action}']`)
	.join(", ");

/**
 * Run one card action.
 * @param {string} action   Name of the action.
 * @param {Actor} actor     Character the action applies to.
 * @param {DOMStringMap} data  Dataset of the button.
 * @returns {Promise<void>}
 */
async function run(action, actor, data) {
	switch (action) {
		case "op2Investigate":
			return investigate(actor, data.itemUuid, data.skill);
		case "op2Examine":
			return examine(actor, data.itemUuid, data.skill);
		case "op2Access":
			return attemptAccess(actor, { ...data });
		case "op2CriticalFailure":
			await rollCriticalFailure(actor);
			return;
		case "op2Survival":
			await rollSurvival(actor, data.kind);
			return;
		case "op2Defend":
			return defend(actor, { ...data });
		case "op2AcceptHelp":
			return acceptHelp(actor, { ...data });
		default:
	}
}

/* -------------------------------------------- */

/** Bind the listener. Call once, in the `ready` hook. */
export function registerCardActions() {
	const marker = "_op2CardActions";
	if (document.body[marker]) return;

	const handler = async (event) => {
		const button = event.target.closest(SELECTOR);
		if (!button) return;
		event.preventDefault();

		const action = button.dataset.action;
		const actor = NAMED_ACTOR_ACTIONS.has(action) ? await fromUuid(button.dataset.actorUuid) : resolveActor();

		if (!actor) return ui.notifications.warn(game.i18n.localize("OP2.Notification.noActor"));
		if (!actor.isOwner) return ui.notifications.warn(game.i18n.localize("OP2.Notification.notOwner"));

		button.disabled = true;
		try {
			await run(action, actor, button.dataset);
		} finally {
			button.disabled = false;
		}
	};

	document.body[marker] = handler;
	document.body.addEventListener("click", handler);
}

/* -------------------------------------------- */

/** Hide a one-shot button once its message records that it was used. */
export function hideSpentButtons(message, element) {
	if (message.getFlag(MODULE_ID, "criticalFailureResolved")) {
		element.querySelector("[data-action='op2CriticalFailure']")?.remove();
	}
}
