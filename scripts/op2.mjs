/**
 * Ordem Paranormal 2 — Playtest Alpha
 * An overlay module for the `ordemparanormal` system on Foundry VTT v14.
 *
 * The module owns its own Actor sub-type, its own data model, its own sheet and
 * its own Roll class. It never replaces a class of the base system.
 */

import { MODULE_ID, AGENT_TYPE, POI_TYPE, OP2 } from "./config.mjs";
import { registerSettings } from "./settings.mjs";
import { OP2AgentData } from "./data/agent-data.mjs";
import OP2Roll from "./dice/op2-roll.mjs";
import { rollTest, buildFlavor } from "./dice/test-workflow.mjs";
import { stepDie, dieLabel, dieIndex, helpSteps } from "./dice/die-step.mjs";
import {
	rollCriticalFailure,
	registerCriticalFailureListener,
	hideResolvedCriticalFailureButton,
} from "./dice/critical-failure.mjs";
import { evaluateTest } from "./dice/evaluate-test.mjs";
import { OP2AgentSheet } from "./sheets/agent-sheet.mjs";
import { OP2PointOfInterestData } from "./data/point-of-interest-data.mjs";
import { OP2PointOfInterestSheet } from "./sheets/point-of-interest-sheet.mjs";
import {
	postPointOfInterest,
	investigate,
	examine,
	resolveActor,
	registerInvestigationListener,
} from "./investigation/actions.mjs";
import { attemptAccess } from "./investigation/access.mjs";
import { registerSocket } from "./socket.mjs";

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

	foundry.applications.handlebars.loadTemplates([
		`modules/${MODULE_ID}/templates/actor/header.hbs`,
		`modules/${MODULE_ID}/templates/actor/main.hbs`,
		`modules/${MODULE_ID}/templates/actor/abilities.hbs`,
		`modules/${MODULE_ID}/templates/actor/biography.hbs`,
		`modules/${MODULE_ID}/templates/investigation/poi-header.hbs`,
		`modules/${MODULE_ID}/templates/investigation/poi-infos.hbs`,
		`modules/${MODULE_ID}/templates/investigation/poi-access.hbs`,
		`modules/${MODULE_ID}/templates/investigation/poi-notes.hbs`,
		`modules/${MODULE_ID}/templates/investigation/point-card.hbs`,
		`modules/${MODULE_ID}/templates/investigation/result-card.hbs`,
		`modules/${MODULE_ID}/templates/investigation/access-card.hbs`,
	]);

	const module = game.modules.get(MODULE_ID);
	if (module) {
		module.api = {
			OP2,
			OP2Roll,
			OP2AgentData,
			OP2AgentSheet,
			OP2PointOfInterestData,
			OP2PointOfInterestSheet,
			rollTest,
			buildFlavor,
			evaluateTest,
			rollCriticalFailure,
			postPointOfInterest,
			investigate,
			examine,
			attemptAccess,
			resolveActor,
			stepDie,
			dieLabel,
			dieIndex,
			helpSteps,
		};
	}

	console.log(`${MODULE_ID} | init complete`);
});

Hooks.once("setup", () => {
	// The base system assigns `CONFIG.Dice.rolls` during its own init. Assert the
	// registration again so the order of the manifests cannot break it.
	registerRollClass();
});

Hooks.on("renderChatMessageHTML", (message, element) => hideResolvedCriticalFailureButton(message, element));

Hooks.once("ready", () => {
	registerCriticalFailureListener();
	registerInvestigationListener();
	registerSocket();

	if (game.system.id !== "ordemparanormal") {
		ui.notifications.error(game.i18n.localize("OP2.Notification.wrongSystem"));
	}
});
