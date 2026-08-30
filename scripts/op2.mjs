/**
 * Ordem Paranormal 2: Playtest Alpha
 * An overlay module for the `ordemparanormal` system on Foundry VTT v14.
 *
 * The module owns its own Actor sub-type, its own Item sub-type, its own data
 * models, its own sheets and its own Roll class. It never replaces a class of
 * the base system.
 */

import { MODULE_ID, AGENT_TYPE, POI_TYPE, OP2 } from "./config.mjs";
import { registerSettings } from "./settings.mjs";

import OP2Roll from "./dice/op2-roll.mjs";
import { rollTest, buildFlavor } from "./dice/test-workflow.mjs";
import { evaluateTest } from "./dice/evaluate-test.mjs";
import { stepDie, dieLabel, dieIndex, helpSteps } from "./dice/die-step.mjs";
import { rollCriticalFailure } from "./dice/critical-failure.mjs";

import { OP2AgentData } from "./data/agent-data.mjs";
import { OP2AgentSheet } from "./sheets/agent-sheet.mjs";
import { OP2PointOfInterestData } from "./data/point-of-interest-data.mjs";
import { OP2PointOfInterestSheet } from "./sheets/point-of-interest-sheet.mjs";

import { postPointOfInterest, investigate, examine, resolveActor } from "./investigation/actions.mjs";
import { attemptAccess } from "./investigation/access.mjs";
import { registerInvestigationHandlers } from "./investigation/handlers.mjs";

import { applyDamage, rollSurvival } from "./rules/survival.mjs";
import { attack, handleCombatResolve, resolveOpposed } from "./rules/combat.mjs";
import { offerHelp } from "./rules/help.mjs";
import { endRound, overloadFormula } from "./rules/overload.mjs";
import { endScene, sceneAction } from "./rules/scene.mjs";
import { runLab } from "./tools/lab.mjs";
import { runRadio } from "./tools/radio.mjs";

import { registerCardActions, hideSpentButtons } from "./card-actions.mjs";
import { registerChatCommands, COMMANDS } from "./chat-commands.mjs";
import { registerHandler, registerSocket } from "./socket.mjs";

/** Every Handlebars template the module renders or uses as a partial. */
const TEMPLATES = [
	"actor/header",
	"actor/main",
	"actor/abilities",
	"actor/biography",
	"investigation/poi-header",
	"investigation/poi-infos",
	"investigation/poi-access",
	"investigation/poi-notes",
	"investigation/point-card",
	"investigation/result-card",
	"investigation/access-card",
	"investigation/unlock-card",
	"investigation/route-button",
	"rules/survival-prompt",
	"rules/survival-result",
	"rules/attack-card",
	"rules/combat-result",
	"rules/help-card",
	"rules/overload-card",
	"rules/scene-card",
	"rules/scene-action-card",
	"tools/lab-card",
	"tools/radio-card",
];

/** Add the OP2 Roll class without dropping the classes of the base system. */
function registerRollClass() {
	if (!CONFIG.Dice.rolls.includes(OP2Roll)) CONFIG.Dice.rolls.push(OP2Roll);
}

Hooks.once("init", () => {
	CONFIG.OP2 = OP2;

	Object.assign(CONFIG.Actor.dataModels, { [AGENT_TYPE]: OP2AgentData });
	Object.assign(CONFIG.Item.dataModels, { [POI_TYPE]: OP2PointOfInterestData });
	registerRollClass();

	foundry.documents.collections.Actors.registerSheet(MODULE_ID, OP2AgentSheet, {
		types: [AGENT_TYPE],
		makeDefault: true,
		label: "OP2.Sheet.agent",
	});

	foundry.documents.collections.Items.registerSheet(MODULE_ID, OP2PointOfInterestSheet, {
		types: [POI_TYPE],
		makeDefault: true,
		label: "OP2.Sheet.pointOfInterest",
	});

	registerSettings();
	registerInvestigationHandlers();
	registerHandler("combatResolve", handleCombatResolve);
	registerChatCommands();

	foundry.applications.handlebars.loadTemplates(
		TEMPLATES.map((name) => `modules/${MODULE_ID}/templates/${name}.hbs`)
	);

	const module = game.modules.get(MODULE_ID);
	if (module) {
		module.api = {
			OP2,
			OP2Roll,
			OP2AgentData,
			OP2AgentSheet,
			OP2PointOfInterestData,
			OP2PointOfInterestSheet,
			COMMANDS,
			// Dice
			rollTest,
			buildFlavor,
			evaluateTest,
			rollCriticalFailure,
			stepDie,
			dieLabel,
			dieIndex,
			helpSteps,
			// Investigation
			postPointOfInterest,
			investigate,
			examine,
			attemptAccess,
			resolveActor,
			// Rules
			applyDamage,
			rollSurvival,
			attack,
			resolveOpposed,
			offerHelp,
			endRound,
			overloadFormula,
			endScene,
			sceneAction,
			// Tools
			runLab,
			runRadio,
		};
	}

	console.log(`${MODULE_ID} | init complete`);
});

Hooks.once("setup", () => {
	// The base system assigns `CONFIG.Dice.rolls` during its own init. Assert the
	// registration again so the order of the manifests cannot break it.
	registerRollClass();
});

Hooks.on("renderChatMessageHTML", (message, element) => hideSpentButtons(message, element));

Hooks.once("ready", () => {
	registerCardActions();
	registerSocket();

	if (game.system.id !== "ordemparanormal") {
		ui.notifications.error(game.i18n.localize("OP2.Notification.wrongSystem"));
	}
});
