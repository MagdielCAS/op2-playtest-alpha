import { OP2 } from "../config.mjs";
import { request } from "../socket.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Client side of the access challenges. The player rolls with their own dice
 * and sends the outcome; a GM applies it, because the point of interest is a
 * world Item that never reaches a player's client.
 */

/**
 * Everything the button of an access route carries.
 * @typedef {object} RouteButtonData
 * @property {string} itemUuid  Point of interest.
 * @property {number} index     Position of the route.
 * @property {string} type      Kind of challenge.
 * @property {string} [skill]   Skill to roll.
 * @property {number} [dt]      Difficulty.
 * @property {number} [riskyDt] Difficulty of the risky `Alcançar`.
 * @property {number} [steps]   Step modifier, used by the fatigue of `Sustentar`.
 * @property {number} [dice]    Dice of a `Destrancar` combination.
 * @property {number} [faces]   Faces of those dice.
 */

/**
 * Attempt one access route from a chat card.
 * @param {Actor} actor              Character acting.
 * @param {RouteButtonData} data     Dataset of the button clicked.
 * @returns {Promise<void>}
 */
export async function attemptAccess(actor, data) {
	if (data.type === "destrancar") return guessCombination(actor, data);

	let risky = false;
	let dt = Number(data.dt);

	if (data.type === "alcancar") {
		const choice = await DialogV2.wait({
			window: { title: game.i18n.localize("OP2.Access.reachTitle"), icon: "fa-solid fa-person-falling" },
			classes: ["op2", "op2-dialog"],
			content: `<p>${game.i18n.format("OP2.Access.reachPrompt", { dt: data.dt, risky: data.riskyDt })}</p>`,
			buttons: [
				{ action: "safe", label: "OP2.Access.reachSafe", icon: "fa-solid fa-shoe-prints", default: true },
				{ action: "risky", label: "OP2.Access.reachRisky", icon: "fa-solid fa-bolt" },
			],
			rejectClose: false,
		});
		if (!choice) return;
		risky = choice === "risky";
		if (risky) dt = Number(data.riskyDt);
	}

	const roll = await actor.system.rollTest({
		skillKey: data.skill,
		dt,
		skillSteps: Number(data.steps ?? 0),
		configure: true,
	});
	if (!roll) return;

	const { success, highest, lowest } = roll.evaluation;
	await request("access", {
		itemUuid: data.itemUuid,
		actorUuid: actor.uuid,
		index: Number(data.index),
		type: data.type,
		risky,
		outcome: { success, highest, lowest },
	});
}

/* -------------------------------------------- */

/**
 * `Destrancar`: set one number per die and send the guess. The combination lives
 * on the GM's client, so only the answer comes back.
 * @param {Actor} actor           Character picking the lock.
 * @param {RouteButtonData} data  Dataset of the button clicked.
 * @returns {Promise<void>}
 */
async function guessCombination(actor, data) {
	const count = Number(data.dice);
	const faces = Number(data.faces);
	if (!count || !faces) return;

	const perRound = OP2.unlockAttemptsByCrime[actor.system.skills.crime.faces] ?? 1;
	const inputs = Array.fromRange(count)
		.map(
			(index) =>
				`<input class="op2-unlock__input" type="number" name="die${index}" value="1" min="1" max="${faces}" step="1">`
		)
		.join("");

	const result = await DialogV2.wait({
		window: { title: game.i18n.localize("OP2.Unlock.title"), icon: "fa-solid fa-lock" },
		classes: ["op2", "op2-dialog"],
		content: `<div class="op2-unlock">
			<p>${game.i18n.format("OP2.Unlock.prompt", { count, faces })}</p>
			<div class="op2-unlock__row">${inputs}</div>
			<p class="hint">${game.i18n.format("OP2.Unlock.perRound", { attempts: perRound })}</p>
		</div>`,
		buttons: [
			{
				action: "submit",
				label: "OP2.Unlock.submit",
				icon: "fa-solid fa-key",
				default: true,
				callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
			},
		],
		rejectClose: false,
	});
	if (!result) return;

	const guess = Array.fromRange(count).map((index) =>
		Math.clamp(Number(result[`die${index}`]) || 1, 1, faces)
	);

	await request("unlockGuess", {
		itemUuid: data.itemUuid,
		actorUuid: actor.uuid,
		index: Number(data.index),
		guess,
	});
}
