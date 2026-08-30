import { OP2 } from "../config.mjs";
import { paranormalAllowed, defaultDT, autoImpeto } from "../settings.mjs";
import { stepDie, dieLabel } from "./die-step.mjs";
import OP2Roll from "./op2-roll.mjs";
import { promptTest } from "./test-dialog.mjs";

/**
 * Build the chat flavor of a test: what was rolled, and how it ended.
 * @param {OP2Roll} roll     The evaluated roll.
 * @param {object} context
 * @param {string} context.title       Name of the test, for example `Percepção (Mente)`.
 * @param {string} [context.actorUuid] Actor, so a critical failure can offer the table.
 * @returns {string}         HTML used as the message flavor.
 */
export function buildFlavor(roll, { title, actorUuid }) {
	const evaluation = roll.evaluation;
	if (!evaluation) return title;

	const parts = [`<div class="op2-flavor"><span class="op2-flavor__title">${title}</span>`];
	parts.push(`<span class="op2-flavor__dice">${roll.diceLabel}</span>`);
	if (evaluation.dt !== null) {
		parts.push(`<span class="op2-flavor__dt">${game.i18n.format("OP2.Chat.dt", { dt: evaluation.dt })}</span>`);
	}

	let state = "neutral";
	let label = game.i18n.localize("OP2.Chat.noTarget");
	if (evaluation.criticalSuccess) {
		state = "critical-success";
		label = game.i18n.localize("OP2.Chat.criticalSuccess");
	} else if (evaluation.criticalFailure) {
		state = "critical-failure";
		label = game.i18n.localize("OP2.Chat.criticalFailure");
	} else if (evaluation.success === true) {
		state = "success";
		label = game.i18n.localize("OP2.Chat.success");
	} else if (evaluation.success === false) {
		state = "failure";
		label = game.i18n.localize("OP2.Chat.failure");
	}

	parts.push(`<span class="op2-flavor__verdict op2-flavor__verdict--${state}">${label}</span>`);
	parts.push(
		`<span class="op2-flavor__rolls">${game.i18n.format("OP2.Chat.highLow", {
			high: evaluation.highest,
			low: evaluation.lowest,
		})}</span>`
	);
	if (evaluation.criticalFailure && actorUuid) {
		parts.push(
			`<button type="button" class="op2-flavor__critfail" data-action="op2CriticalFailure"` +
				` data-actor-uuid="${actorUuid}">${game.i18n.localize("OP2.CriticalFailure.button")}</button>`
		);
	}

	parts.push("</div>");
	return parts.join("");
}

/**
 * Roll a test of one attribute die plus one skill die.
 * @param {Actor} actor                     Actor making the test.
 * @param {object} config
 * @param {string} config.skillKey          Key in `CONFIG.OP2.skills`.
 * @param {string} [config.attributeKey]    Overrides the base attribute of the skill.
 * @param {number} [config.dt]              Difficulty. Defaults to the world setting.
 * @param {number} [config.attributeSteps]  Step modifiers on the attribute die.
 * @param {number} [config.skillSteps]      Step modifiers on the skill die.
 * @param {number[]} [config.extraDice]     Extra die sizes added to the pool.
 * @param {number} [config.bonus]           Flat bonus added to the sum.
 * @param {boolean} [config.spendImpeto]    Spend one box of Ímpeto for one step.
 * @param {boolean} [config.configure]      Show the configuration dialog.
 * @param {boolean} [config.createMessage]  Post the result to chat.
 * @returns {Promise<OP2Roll|null>}         Null when the player cancels the dialog.
 */
export async function rollTest(actor, config = {}) {
	const system = actor.system;
	const skillKey = config.skillKey;
	const skillConfig = OP2.skills[skillKey];
	if (!skillConfig) throw new Error(`Unknown OP2 skill: ${skillKey}`);

	let attributeKey = config.attributeKey ?? skillConfig.attribute;
	let attributeSteps = config.attributeSteps ?? 0;
	let skillSteps = config.skillSteps ?? 0;
	let extraDice = [...(config.extraDice ?? [])];
	let bonus = config.bonus ?? 0;
	let dt = config.dt ?? defaultDT();
	let spendImpeto = config.spendImpeto === true;

	if (config.configure !== false) {
		const attributeFaces = Object.fromEntries(
			Object.keys(OP2.attributes).map((key) => [key, system.attributes[key].faces])
		);
		const answer = await promptTest({
			title: game.i18n.format("OP2.Dialog.title", { skill: game.i18n.localize(skillConfig.label) }),
			attributeKey,
			attributeFaces,
			skillFaces: system.skills[skillKey].faces,
			dt,
			impeto: system.hasImpeto ? system.impeto.value : 0,
		});
		if (!answer) return null;

		attributeKey = answer.attributeKey;
		attributeSteps += answer.attributeSteps;
		skillSteps += answer.skillSteps;
		bonus += answer.bonus;
		dt = answer.dt;
		if (answer.extraDie) extraDice.push(answer.extraDie);
		if (answer.spendImpeto) spendImpeto = true;
	}

	// One box of Ímpeto buys one step on the test.
	spendImpeto = spendImpeto && system.hasImpeto && system.impeto.value >= OP2.impeto.stepCost;
	if (spendImpeto) skillSteps += 1;

	const allowParanormal = paranormalAllowed();
	const attributeFaces = stepDie(system.attributes[attributeKey].faces, attributeSteps, { allowParanormal });
	const skillFaces = stepDie(system.skills[skillKey].faces, skillSteps, { allowParanormal });

	// A test rolls at most four dice.
	const pool = [attributeFaces, skillFaces, ...extraDice].slice(0, OP2.maxDice);

	const roll = OP2Roll.fromDice(pool, {
		bonus,
		dt,
		data: actor.getRollData(),
		flags: { skillKey, attributeKey },
	});
	await roll.evaluate();

	await applyImpeto(actor, roll, { spent: spendImpeto ? OP2.impeto.stepCost : 0 });

	if (config.createMessage !== false) {
		const title = game.i18n.format("OP2.Chat.testTitle", {
			skill: game.i18n.localize(skillConfig.label),
			attribute: game.i18n.localize(OP2.attributes[attributeKey].label),
		});
		await roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor }),
			flavor: buildFlavor(roll, { title, actorUuid: actor.uuid }),
		});
	}

	return roll;
}

/* -------------------------------------------- */

/**
 * Move the Ímpeto track after a test: a spent box goes out, and a failed test
 * fills one box. Only the Executor profile has the track.
 * @param {Actor} actor      Actor that made the test.
 * @param {OP2Roll} roll     The evaluated roll.
 * @param {object} [options]
 * @param {number} [options.spent=0]  Boxes already spent on this test.
 * @returns {Promise<void>}
 */
export async function applyImpeto(actor, roll, { spent = 0 } = {}) {
	const system = actor.system;
	if (!system.hasImpeto) return;

	const failed = autoImpeto() && roll.evaluation?.success === false;
	const delta = (failed ? 1 : 0) - spent;
	if (!delta) return;

	const value = Math.clamp(system.impeto.value + delta, 0, system.impeto.max);
	if (value === system.impeto.value) return;
	await actor.update({ "system.impeto.value": value });
}
