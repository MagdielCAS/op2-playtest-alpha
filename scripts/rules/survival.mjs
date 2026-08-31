import { MODULE_ID, OP2 } from "../config.mjs";

/**
 * Damage, `Ferimentos` and `Traumas`.
 *
 * A character at 0 PV tests Vigor, and one at 0 PD tests Disciplina, against
 * DT 7 raised by 3 for every such test already made. Passing lets them keep
 * acting; failing ends the character.
 */

/**
 * Which rule watches a resource.
 * @param {string} resource  `pv` or `pd`.
 * @returns {object|null}    The entry of `OP2.survival`, or null.
 */
export function survivalRuleFor(resource) {
	return Object.values(OP2.survival).find((rule) => rule.resource === resource) ?? null;
}

/**
 * DT of the next survival test.
 * @param {number} testsMade  Tests already made against this rule.
 * @param {object} rule       Entry of `OP2.survival`.
 * @returns {number}
 */
export function survivalDT(testsMade, rule) {
	return rule.dt + rule.step * testsMade;
}

/* -------------------------------------------- */

/**
 * Subtract a resource and, when that leaves the character at zero or hits them
 * while already at zero, offer the survival test.
 *
 * Every place in the module that costs PV or PD goes through here, so the
 * threshold is never missed.
 *
 * @param {Actor} actor      Character taking the loss.
 * @param {string} resource  `pv` or `pd`.
 * @param {number} amount    How much to subtract.
 * @param {object} [options]
 * @param {boolean} [options.prompt=true]  Offer the survival test.
 * @returns {Promise<void>}
 */
export async function applyDamage(actor, resource, amount, { prompt = true } = {}) {
	if (!amount) return;

	const before = actor.system[resource].value;
	const after = Math.max(0, before - amount);
	if (after !== before) await actor.update({ [`system.${resource}.value`]: after });

	if (!prompt) return;
	const rule = survivalRuleFor(resource);
	// The rule fires on reaching zero, and again on any further damage at zero.
	if (!rule || after > 0) return;

	await postSurvivalPrompt(actor, rule);
}

/* -------------------------------------------- */

/**
 * Post the card that offers the survival test.
 * @param {Actor} actor  Character at zero.
 * @param {object} rule  Entry of `OP2.survival`.
 * @returns {Promise<ChatMessage>}
 */
export async function postSurvivalPrompt(actor, rule) {
	const key = rule === OP2.survival.injury ? "injury" : "trauma";
	const testsMade = actor.system.survival[`${key}Tests`];

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/survival-prompt.hbs`,
		{
			actorUuid: actor.uuid,
			kind: key,
			title: game.i18n.localize(`OP2.Survival.${key}.title`),
			text: game.i18n.localize(`OP2.Survival.${key}.text`),
			skillLabel: game.i18n.localize(OP2.skills[rule.skill].label),
			dt: survivalDT(testsMade, rule),
		}
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

/* -------------------------------------------- */

/**
 * Roll a survival test and record it. A failure ends the character; the module
 * says so and leaves the scene to the table.
 * @param {Actor} actor  Character testing.
 * @param {string} kind  `injury` or `trauma`.
 * @param {object} [options]
 * @param {boolean} [options.configure=true]  False rolls without the dialog.
 * @returns {Promise<ChatMessage|null>}  Null when the player cancels the roll.
 */
export async function rollSurvival(actor, kind, { configure = true } = {}) {
	const rule = OP2.survival[kind];
	if (!rule) return null;

	const testsMade = actor.system.survival[`${kind}Tests`];
	const dt = survivalDT(testsMade, rule);

	const roll = await actor.system.rollTest({ skillKey: rule.skill, dt, configure });
	if (!roll) return null;

	await actor.update({ [`system.survival.${kind}Tests`]: testsMade + 1 });

	const survived = roll.evaluation.success;
	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/survival-result.hbs`,
		{
			title: game.i18n.localize(`OP2.Survival.${kind}.title`),
			dt,
			survived,
			outcome: game.i18n.localize(`OP2.Survival.${kind}.${survived ? "survived" : "lost"}`),
			nextDT: survivalDT(testsMade + 1, rule),
		}
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}
