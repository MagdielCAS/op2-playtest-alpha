import { MODULE_ID, OP2 } from "../config.mjs";
import { ROUND_FLAG, investigationActors } from "./overload.mjs";

/** Flag that records which once-per-scene actions a character already used. */
export const SCENE_ACTIONS_FLAG = "sceneActions";

/** Effect sources the module creates with a "until the end of the scene" duration. */
const TEMPORARY_SOURCES = ["criticalFailure", "impeto"];

/**
 * End the scene: drop every effect that lasts "until the end of the scene",
 * clear the survival counters, the once-per-scene actions and the round counter.
 *
 * Foundry has no scene duration, so this is what closes that loop.
 *
 * @param {Scene} [scene]  Scene that holds the round counter.
 * @returns {Promise<ChatMessage>}
 */
export async function endScene(scene = game.scenes?.current) {
	const actors = investigationActors();
	let removed = 0;

	for (const actor of actors) {
		const ids = actor.effects
			.filter((effect) => TEMPORARY_SOURCES.includes(effect.getFlag(MODULE_ID, "source")))
			.map((effect) => effect.id);
		if (ids.length) {
			await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
			removed += ids.length;
		}

		await actor.update({
			"system.survival.injuryTests": 0,
			"system.survival.traumaTests": 0,
		});
		await actor.unsetFlag(MODULE_ID, SCENE_ACTIONS_FLAG);
	}

	if (scene) await scene.unsetFlag(MODULE_ID, ROUND_FLAG);

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/scene-card.hbs`,
		{ actors: actors.length, removed }
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker() });
}

/* -------------------------------------------- */

/**
 * `Recapitular` and `Compartilhar`. Both are one test against DT 10, and both
 * are spent for the rest of the scene once they succeed.
 * @param {Actor} actor  Character acting.
 * @param {string} kind  `recap` or `share`.
 * @returns {Promise<ChatMessage|null>}  Null when the player cancels the roll.
 */
export async function sceneAction(actor, kind) {
	const config = OP2.sceneActions[kind];
	if (!config) return null;

	const used = actor.getFlag(MODULE_ID, SCENE_ACTIONS_FLAG) ?? {};
	if (used[kind]) {
		ui.notifications.warn(game.i18n.localize(`OP2.SceneAction.${kind}.spent`));
		return null;
	}

	const roll = await actor.system.rollTest({ skillKey: config.skill, dt: config.dt, configure: true });
	if (!roll) return null;

	const passed = roll.evaluation.success;
	// Only a success spends the action.
	if (passed) await actor.setFlag(MODULE_ID, SCENE_ACTIONS_FLAG, { ...used, [kind]: true });

	const content = await foundry.applications.handlebars.renderTemplate(
		`modules/${MODULE_ID}/templates/rules/scene-action-card.hbs`,
		{
			title: game.i18n.localize(`OP2.SceneAction.${kind}.title`),
			text: game.i18n.localize(`OP2.SceneAction.${kind}.${passed ? "passed" : "failed"}`),
			skillLabel: game.i18n.localize(OP2.skills[config.skill].label),
			dt: config.dt,
			passed,
		}
	);
	return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}
