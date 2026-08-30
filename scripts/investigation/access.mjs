import { MODULE_ID, OP2 } from "../config.mjs";
import { requestAccessUpdate } from "../socket.mjs";
import { resolveForceOpen, resolveReach, resolveSustain, sustainSteps } from "./access-rules.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Subtract a resource from a character. The player owns their own actor, so no
 * socket is needed here.
 * @param {Actor} actor      Character paying.
 * @param {string} resource  `pv` or `pd`.
 * @param {number} amount    How much to subtract.
 * @returns {Promise<void>}
 */
async function spend(actor, resource, amount) {
	if (!amount) return;
	const current = actor.system[resource].value;
	await actor.update({ [`system.${resource}.value`]: Math.max(0, current - amount) });
}

/* -------------------------------------------- */

/**
 * Resolve one attempt at an access challenge.
 * @param {Actor} actor   Character acting.
 * @param {Item} item     Point of interest that owns the route.
 * @param {number} index  Position of the route.
 * @returns {Promise<ChatMessage|null>}  Null when the player cancels.
 */
export async function attemptAccess(actor, item, index) {
	const route = item.system.access[index];
	if (!route) return null;

	if (route.solved) {
		ui.notifications.info(game.i18n.localize("OP2.Access.alreadySolved"));
		return null;
	}

	switch (route.type) {
		case "arrombar":
			return forceOpen(actor, item, index, route);
		case "alcancar":
			return reach(actor, item, index, route);
		case "sustentar":
			return sustain(actor, item, index, route);
		default:
			ui.notifications.info(game.i18n.localize("OP2.Access.manualOnly"));
			return null;
	}
}

/* -------------------------------------------- */

/**
 * `Arrombar`: spend 1 PV, test Atletismo against the DT of the object, and add
 * the RA to the score. The route opens when the score reaches the target.
 * @param {Actor} actor   Character acting.
 * @param {Item} item     Point of interest.
 * @param {number} index  Position of the route.
 * @param {object} route  The route itself.
 * @returns {Promise<ChatMessage|null>}
 */
async function forceOpen(actor, item, index, route) {
	const config = OP2.access.arrombar;
	const roll = await actor.system.rollTest({ skillKey: config.skill, dt: route.dt, configure: true });
	if (!roll) return null;

	await spend(actor, config.cost.resource, config.cost.amount);

	const evaluation = roll.evaluation;
	const { gained, progress, solved } = resolveForceOpen(route, evaluation);

	await requestAccessUpdate(item.uuid, index, { progress, solved });

	return postAccessCard(actor, item, route, {
		action: "arrombar",
		success: evaluation.success,
		gained,
		progress,
		target: route.target,
		solved,
		cost: game.i18n.format("OP2.Access.paid", {
			amount: config.cost.amount,
			resource: game.i18n.localize(`OP2.Field.${config.cost.resource}`),
		}),
	});
}

/* -------------------------------------------- */

/**
 * `Alcançar`, safe or risky.
 * Safe: two Acrobacia tests in a row; a failure deals RB damage and resets.
 * Risky: one test against DT +3; a failure deals RA damage.
 * @param {Actor} actor   Character acting.
 * @param {Item} item     Point of interest.
 * @param {number} index  Position of the route.
 * @param {object} route  The route itself.
 * @returns {Promise<ChatMessage|null>}
 */
async function reach(actor, item, index, route) {
	const config = OP2.access.alcancar;

	const risky = await DialogV2.wait({
		window: { title: game.i18n.localize("OP2.Access.reachTitle"), icon: "fa-solid fa-person-falling" },
		classes: ["op2", "op2-dialog"],
		content: `<p>${game.i18n.format("OP2.Access.reachPrompt", {
			dt: route.dt,
			risky: route.dt + config.riskyPenalty,
		})}</p>`,
		buttons: [
			{ action: "safe", label: "OP2.Access.reachSafe", icon: "fa-solid fa-shoe-prints", default: true },
			{ action: "risky", label: "OP2.Access.reachRisky", icon: "fa-solid fa-bolt" },
		],
		rejectClose: false,
	});
	if (!risky) return null;

	const isRisky = risky === "risky";
	const dt = isRisky ? route.dt + config.riskyPenalty : route.dt;
	const roll = await actor.system.rollTest({ skillKey: config.skill, dt, configure: true });
	if (!roll) return null;

	const { stage, solved, damage } = resolveReach(route, roll.evaluation, {
		risky: isRisky,
		safeActions: config.safeActions,
	});
	if (damage) await spend(actor, "pv", damage);

	await requestAccessUpdate(item.uuid, index, { stage, solved });

	return postAccessCard(actor, item, route, {
		action: isRisky ? "reachRisky" : "reachSafe",
		success: !damage,
		stage,
		target: config.safeActions,
		showStage: !isRisky,
		solved,
		damage,
	});
}

/* -------------------------------------------- */

/**
 * `Sustentar`: spend 1 PV to lift the object, then one Atletismo test at the end
 * of every round. Each round of fatigue costs one die step.
 * @param {Actor} actor   Character acting.
 * @param {Item} item     Point of interest.
 * @param {number} index  Position of the route.
 * @param {object} route  The route itself.
 * @returns {Promise<ChatMessage|null>}
 */
async function sustain(actor, item, index, route) {
	const config = OP2.access.sustentar;
	const rounds = route.stage;

	const roll = await actor.system.rollTest({
		skillKey: config.skill,
		dt: route.dt,
		skillSteps: sustainSteps(route),
		configure: true,
	});
	if (!roll) return null;

	if (rounds === 0) await spend(actor, config.cost.resource, config.cost.amount);

	const { stage, held, fatigue } = resolveSustain(route, roll.evaluation);
	await requestAccessUpdate(item.uuid, index, { stage });

	return postAccessCard(actor, item, route, {
		action: "sustentar",
		success: held,
		stage,
		rounds,
		fatigue,
		cost:
			rounds === 0
				? game.i18n.format("OP2.Access.paid", {
						amount: config.cost.amount,
						resource: game.i18n.localize(`OP2.Field.${config.cost.resource}`),
					})
				: null,
	});
}

/* -------------------------------------------- */

/**
 * Post the outcome of an access attempt.
 * @param {Actor} actor   Character acting.
 * @param {Item} item     Point of interest.
 * @param {object} route  The route attempted.
 * @param {object} data   Outcome of the attempt.
 * @returns {Promise<ChatMessage>}
 */
async function postAccessCard(actor, item, route, data) {
	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/investigation/access-card.hbs`,
		{
			...data,
			item,
			route,
			routeLabel: route.label || game.i18n.localize(OP2.accessTypes[route.type]),
			actionLabel: game.i18n.localize(`OP2.Access.action.${data.action}`),
		}
	);

	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}
