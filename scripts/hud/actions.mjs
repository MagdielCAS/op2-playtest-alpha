import { OP2 } from "../config.mjs";
import { ACTION } from "./constants.mjs";
import { rollSurvival } from "../rules/survival.mjs";
import { attack } from "../rules/combat.mjs";
import { offerHelp } from "../rules/help.mjs";
import { endRound } from "../rules/overload.mjs";
import { endScene, sceneAction } from "../rules/scene.mjs";
import { runLab } from "../tools/lab.mjs";
import { runRadio } from "../tools/radio.mjs";
import { postPointOfInterest } from "../investigation/actions.mjs";

/**
 * Run one HUD action.
 *
 * The HUD encodes an action as `type|id`. Everything here is the same code the
 * chat commands and the sheet already call, so the HUD adds no rules of its own.
 *
 * @param {Actor} actor    Character the action applies to.
 * @param {string} type    Action type, one of `ACTION`.
 * @param {string} id      Action id inside that type.
 * @param {Event} [event]  The click, so Ctrl or Meta can skip the dialog.
 * @returns {Promise<boolean>}  True when the action was recognised.
 */
export async function runHudAction(actor, type, id, event) {
	const fast = Boolean(event?.ctrlKey || event?.metaKey);

	switch (type) {
		case ACTION.skill:
			await actor.system.rollTest({ skillKey: id, configure: !fast });
			return true;

		case ACTION.scene:
			if (id === "recap" || id === "share") await sceneAction(actor, id, { configure: !fast });
			else if (id === "help") await offerHelp(actor);
			else if (id === "attack") await attack(actor, { configure: !fast });
			else return false;
			return true;

		case ACTION.survival:
			await rollSurvival(actor, id, { configure: !fast });
			return true;

		case ACTION.tool:
			if (id === "radio") await runRadio(actor, { configure: !fast });
			else if (id.startsWith("lab")) await runLab(actor, Number(id.replace("lab", "")) || OP2.tools.lab.minDice);
			else return false;
			return true;

		case ACTION.gm: {
			if (!game.user.isGM) {
				ui.notifications.warn(game.i18n.localize("OP2.Command.gmOnly"));
				return true;
			}
			if (id === "round") await endRound(game.scenes?.current);
			else if (id === "scene") await endScene(game.scenes?.current);
			else if (id.startsWith("poi:")) {
				const item = game.items.get(id.slice(4));
				if (item) await postPointOfInterest(item);
			} else return false;
			return true;
		}

		default:
			return false;
	}
}
