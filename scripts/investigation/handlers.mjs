import { MODULE_ID, OP2 } from "../config.mjs";
import { registerHandler } from "../socket.mjs";
import { resolveSkills, selectPending } from "./reveal.mjs";
import { resolveForceOpen, resolveReach, resolveSustain, sustainSteps } from "./access-rules.mjs";
import { compareGuess, resolveGuess, attemptsPerRound } from "./unlock.mjs";
import { applyDamage } from "../rules/survival.mjs";

/**
 * Everything that reads or writes a point of interest. These run on a GM client
 * only: a world Item never reaches a player's client, so the player sends what
 * their own client knows and the GM resolves and posts the card.
 */

/** Render one of the module templates. */
function render(name, data) {
	return foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/investigation/${name}`, data);
}

/** Post a card spoken by the acting character. */
async function post(actor, content) {
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

/** Subtract a resource. `applyDamage` also fires the survival test at zero. */
async function spend(actor, resource, amount) {
	return applyDamage(actor, resource, amount);
}

/** Fetch the actor and the point of interest of a request. */
async function resolveDocuments({ actorUuid, itemUuid }) {
	const [actor, item] = await Promise.all([fromUuid(actorUuid), fromUuid(itemUuid)]);
	if (!actor || !item) return null;
	return { actor, item };
}

/** Write revealed lines back to the point of interest. */
async function markRevealed(item, found) {
	if (!found.length) return;
	const ids = new Set(found.map((info) => info.id));
	const infos = item.system.toObject().infos.map((info) => (ids.has(info.id) ? { ...info, revealed: true } : info));
	await item.update({ "system.infos": infos });
}

/** Write one access route back to the point of interest. */
async function updateRoute(item, index, changes) {
	const routes = item.system.toObject().access;
	if (!routes[index]) return null;
	routes[index] = { ...routes[index], ...changes };
	await item.update({ "system.access": routes });
	return routes[index];
}

/* -------------------------------------------- */

/**
 * Data a player's client needs to act on one access route. The card carries it,
 * so the client never has to read the Item.
 * @param {Item} item     Point of interest.
 * @param {object} route  Route state.
 * @param {number} index  Position of the route.
 * @returns {object}      Dataset for the button.
 */
export function buildRouteButton(item, route, index) {
	const data = {
		index,
		type: route.type,
		itemUuid: item.uuid,
		dt: route.dt,
		solved: route.solved,
		broken: route.broken,
		interactive: OP2.interactiveAccess.includes(route.type),
		typeLabel: game.i18n.localize(OP2.accessTypes[route.type] ?? route.type),
		label: route.label,
	};

	if (route.type === "arrombar") data.skill = OP2.access.arrombar.skill;
	else if (route.type === "alcancar") {
		data.skill = OP2.access.alcancar.skill;
		data.riskyDt = route.dt + OP2.access.alcancar.riskyPenalty;
	} else if (route.type === "sustentar") {
		data.skill = OP2.access.sustentar.skill;
		// Fatigue grows every round, so each new card carries the current value.
		data.steps = sustainSteps(route);
	} else if (route.type === "destrancar") {
		data.dice = route.combination.length;
		data.faces = route.combinationFaces;
		// A lock with no combination generated yet cannot be picked.
		data.interactive = data.interactive && data.dice > 0 && !route.broken;
	}

	return data;
}

/* -------------------------------------------- */

/** `Investigar`: reveal by the value the character has in the skill. */
async function handleInvestigate(payload) {
	const documents = await resolveDocuments(payload);
	if (!documents) return;
	const { actor, item } = documents;

	const infos = resolveSkills(item.system.toObject().infos);
	const found = selectPending(infos, payload.skillKey, payload.value);
	await markRevealed(item, found);

	const content = await render("result-card.hbs", {
		mode: "investigate",
		canExamine: true,
		item,
		skillKey: payload.skillKey,
		skillLabel: game.i18n.localize(OP2.skills[payload.skillKey].label),
		measure: game.i18n.format("OP2.Investigation.value", { die: `d${payload.value}` }),
		found,
	});
	return post(actor, content);
}

/* -------------------------------------------- */

/** `Examinar`: reveal by the test result, and charge 1 PD when nothing is new. */
async function handleExamine(payload) {
	const documents = await resolveDocuments(payload);
	if (!documents) return;
	const { actor, item } = documents;

	const infos = resolveSkills(item.system.toObject().infos);
	const found = selectPending(infos, payload.skillKey, payload.total);
	await markRevealed(item, found);

	let cost = null;
	if (!found.length) {
		const { resource, amount } = OP2.examineCost;
		await spend(actor, resource, amount);
		cost = game.i18n.format("OP2.Investigation.cost", {
			amount,
			resource: game.i18n.localize(`OP2.Field.${resource}`),
		});
	}

	const content = await render("result-card.hbs", {
		mode: "examine",
		canExamine: false,
		item,
		skillKey: payload.skillKey,
		skillLabel: game.i18n.localize(OP2.skills[payload.skillKey].label),
		measure: game.i18n.format("OP2.Investigation.result", { total: payload.total }),
		found,
		cost,
		critical: payload.critical,
	});
	return post(actor, content);
}

/* -------------------------------------------- */

/** `Arrombar`, `Alcançar` and `Sustentar`: apply the outcome the player rolled. */
async function handleAccess(payload) {
	const documents = await resolveDocuments(payload);
	if (!documents) return;
	const { actor, item } = documents;

	const route = item.system.access[payload.index];
	if (!route || route.solved) return;

	const outcome = payload.outcome;
	const data = { item, route, actionKey: payload.type };
	let changes = {};

	if (payload.type === "arrombar") {
		const config = OP2.access.arrombar;
		await spend(actor, config.cost.resource, config.cost.amount);
		const result = resolveForceOpen(route, outcome);
		changes = { progress: result.progress, solved: result.solved };
		Object.assign(data, result, {
			success: outcome.success,
			target: route.target,
			cost: game.i18n.format("OP2.Access.paid", {
				amount: config.cost.amount,
				resource: game.i18n.localize(`OP2.Field.${config.cost.resource}`),
			}),
		});
		data.actionKey = "arrombar";
	} else if (payload.type === "alcancar") {
		const config = OP2.access.alcancar;
		const result = resolveReach(route, outcome, { risky: payload.risky, safeActions: config.safeActions });
		if (result.damage) await spend(actor, "pv", result.damage);
		changes = { stage: result.stage, solved: result.solved };
		Object.assign(data, result, {
			success: !result.damage,
			target: config.safeActions,
			showStage: !payload.risky,
		});
		data.actionKey = payload.risky ? "reachRisky" : "reachSafe";
	} else if (payload.type === "sustentar") {
		const config = OP2.access.sustentar;
		if (route.stage === 0) await spend(actor, config.cost.resource, config.cost.amount);
		const result = resolveSustain(route, outcome);
		changes = { stage: result.stage };
		Object.assign(data, result, {
			success: result.held,
			cost:
				route.stage === 0
					? game.i18n.format("OP2.Access.paid", {
							amount: config.cost.amount,
							resource: game.i18n.localize(`OP2.Field.${config.cost.resource}`),
						})
					: null,
		});
		data.actionKey = "sustentar";
	}

	const updated = await updateRoute(item, payload.index, changes);
	data.button = buildRouteButton(item, updated ?? route, payload.index);
	data.routeLabel = route.label || game.i18n.localize(OP2.accessTypes[route.type]);
	data.actionLabel = game.i18n.localize(`OP2.Access.action.${data.actionKey}`);

	return post(actor, await render("access-card.hbs", data));
}

/* -------------------------------------------- */

/** `Destrancar`: answer one guess against the hidden combination. */
async function handleUnlockGuess(payload) {
	const documents = await resolveDocuments(payload);
	if (!documents) return;
	const { actor, item } = documents;

	const route = item.system.access[payload.index];
	if (!route || route.solved || route.broken) return;
	if (!route.combination.length) {
		ui.notifications.warn(game.i18n.localize("OP2.Unlock.noCombination"));
		return;
	}

	const answer = compareGuess(route.combination, payload.guess);
	const state = resolveGuess(route, answer);

	const attempts = item.system.toObject().access[payload.index].attempts ?? [];
	attempts.push({ guess: payload.guess, feedback: answer, actorName: actor.name });

	const updated = await updateRoute(item, payload.index, {
		attempts,
		solved: state.solved,
		broken: state.broken,
	});

	const content = await render("unlock-card.hbs", {
		item,
		route: updated ?? route,
		routeLabel: route.label || game.i18n.localize(OP2.accessTypes.destrancar),
		dice: payload.guess.map((value, index) => ({
			value,
			feedback: answer[index],
			label: game.i18n.localize(`OP2.Unlock.feedback.${answer[index]}`),
		})),
		...state,
		perRound: attemptsPerRound(actor.system.skills.crime.faces, OP2.unlockAttemptsByCrime),
		button: buildRouteButton(item, updated ?? route, payload.index),
	});
	return post(actor, content);
}

/* -------------------------------------------- */

/** Register every GM-side handler. Call once, in the `init` hook. */
export function registerInvestigationHandlers() {
	registerHandler("investigate", handleInvestigate);
	registerHandler("examine", handleExamine);
	registerHandler("access", handleAccess);
	registerHandler("unlockGuess", handleUnlockGuess);
}
