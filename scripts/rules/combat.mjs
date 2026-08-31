import { MODULE_ID, OP2 } from "../config.mjs";
import { request } from "../socket.mjs";
import { applyDamage } from "./survival.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Simplified combat of the playtest.
 *
 * Two characters make an opposed `Luta` test. The winner deals damage equal to
 * their RA when armed, or to their RB when unarmed. A character who only
 * defends tests `Acrobacia` instead, with an extra d6; winning that means no
 * damage is dealt in either direction.
 */

/**
 * Ask whether the character is armed.
 * @param {string} title  Window title.
 * @returns {Promise<boolean|null>}  Null when the player cancels.
 */
async function askArmed(title) {
	const choice = await DialogV2.wait({
		window: { title, icon: "fa-solid fa-hand-fist" },
		classes: ["op2", "op2-dialog"],
		content: `<p>${game.i18n.localize("OP2.Combat.armedPrompt")}</p>`,
		buttons: [
			{ action: "armed", label: "OP2.Combat.armed", icon: "fa-solid fa-khanda", default: true },
			{ action: "unarmed", label: "OP2.Combat.unarmed", icon: "fa-solid fa-hand-fist" },
		],
		rejectClose: false,
	});
	if (!choice) return null;
	return choice === "armed";
}

/* -------------------------------------------- */

/**
 * Start an attack: roll `Luta` and post the card the defender answers.
 * @param {Actor} actor  Attacking character.
 * @param {object} [options]
 * @param {boolean} [options.configure=true]  False rolls without the dialog.
 * @returns {Promise<ChatMessage|null>}
 */
export async function attack(actor, { configure = true } = {}) {
	const armed = await askArmed(game.i18n.localize("OP2.Combat.attackTitle"));
	if (armed === null) return null;

	// An opposed test has no DT: the two totals are compared instead.
	const roll = await actor.system.rollTest({ skillKey: OP2.combat.attackSkill, dt: null, configure });
	if (!roll) return null;

	const { total } = roll;
	const { highest, lowest } = roll.evaluation;

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/attack-card.hbs`,
		{
			attackerName: actor.name,
			attackerUuid: actor.uuid,
			armed,
			total,
			highest,
			lowest,
			damage: armed ? highest : lowest,
		}
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

/* -------------------------------------------- */

/**
 * Answer an attack, either by fighting back or by only defending.
 * @param {Actor} actor           Defending character.
 * @param {object} data           Dataset of the button on the attack card.
 * @returns {Promise<void>}
 */
export async function defend(actor, data) {
	const choice = await DialogV2.wait({
		window: { title: game.i18n.localize("OP2.Combat.defendTitle"), icon: "fa-solid fa-shield" },
		classes: ["op2", "op2-dialog"],
		content: `<p>${game.i18n.format("OP2.Combat.defendPrompt", {
			die: `d${OP2.combat.dodgeBonusDie}`,
		})}</p>`,
		buttons: [
			{ action: "counter", label: "OP2.Combat.counter", icon: "fa-solid fa-hand-fist", default: true },
			{ action: "dodge", label: "OP2.Combat.dodge", icon: "fa-solid fa-person-running" },
		],
		rejectClose: false,
	});
	if (!choice) return;

	const dodging = choice === "dodge";
	let armed = false;
	if (!dodging) {
		armed = await askArmed(game.i18n.localize("OP2.Combat.defendTitle"));
		if (armed === null) return;
	}

	const roll = await actor.system.rollTest({
		skillKey: dodging ? OP2.combat.dodgeSkill : OP2.combat.attackSkill,
		dt: null,
		// "O personagem que está apenas se defendendo recebe +d6 em seu teste."
		extraDice: dodging ? [OP2.combat.dodgeBonusDie] : [],
		configure: true,
	});
	if (!roll) return;

	await request("combatResolve", {
		attackerUuid: data.attackerUuid,
		defenderUuid: actor.uuid,
		attacker: {
			total: Number(data.total),
			damage: Number(data.damage),
		},
		defender: {
			total: roll.total,
			damage: armed ? roll.evaluation.highest : roll.evaluation.lowest,
			dodging,
		},
	});
}

/* -------------------------------------------- */

/**
 * Decide an opposed combat test. Pure, so it can be tested with plain node.
 * @param {{total: number, damage: number}} attacker  Attacker side.
 * @param {{total: number, damage: number, dodging: boolean}} defender  Defender side.
 * @returns {{winner: string, damage: number, target: string}}
 *   `winner` is `attacker`, `defender` or `tie`; `target` names who is hurt.
 */
export function resolveOpposed(attacker, defender) {
	if (attacker.total === defender.total) return { winner: "tie", damage: 0, target: "none" };

	if (attacker.total > defender.total) {
		return { winner: "attacker", damage: attacker.damage, target: "defender" };
	}

	// A character who only defends deals no damage when they win.
	if (defender.dodging) return { winner: "defender", damage: 0, target: "none" };
	return { winner: "defender", damage: defender.damage, target: "attacker" };
}

/* -------------------------------------------- */

/**
 * GM side: compare the two tests, apply the damage and post the outcome.
 * @param {object} payload  Both sides of the opposed test.
 * @returns {Promise<ChatMessage|null>}
 */
export async function handleCombatResolve(payload) {
	const [attacker, defender] = await Promise.all([
		fromUuid(payload.attackerUuid),
		fromUuid(payload.defenderUuid),
	]);
	if (!attacker || !defender) return null;

	const result = resolveOpposed(payload.attacker, payload.defender);
	const hurt = result.target === "defender" ? defender : result.target === "attacker" ? attacker : null;
	if (hurt && result.damage) await applyDamage(hurt, "pv", result.damage);

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/combat-result.hbs`,
		{
			attackerName: attacker.name,
			defenderName: defender.name,
			attackerTotal: payload.attacker.total,
			defenderTotal: payload.defender.total,
			dodging: payload.defender.dodging,
			...result,
			hurtName: hurt?.name ?? "",
			outcome: game.i18n.localize(`OP2.Combat.outcome.${result.winner}`),
		}
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: attacker }) });
}
