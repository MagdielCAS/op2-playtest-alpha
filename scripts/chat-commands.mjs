import { OP2 } from "./config.mjs";
import { resolveActor } from "./investigation/actions.mjs";
import { attack } from "./rules/combat.mjs";
import { offerHelp } from "./rules/help.mjs";
import { rollSurvival } from "./rules/survival.mjs";
import { endRound } from "./rules/overload.mjs";
import { endScene, sceneAction } from "./rules/scene.mjs";
import { runLab } from "./tools/lab.mjs";
import { runRadio } from "./tools/radio.mjs";

/**
 * Slash commands, so every rule of the playtest has a way in without a new
 * window. A command that needs a character uses the controlled token first,
 * then the character assigned to the user.
 */

/** Commands only a GM may run. */
const GM_COMMANDS = new Set(["rodada", "cena"]);

/**
 * Run a command.
 * @param {string} name       Command without the `/op2` prefix.
 * @param {string} argument   Everything typed after the command.
 * @returns {Promise<boolean>}  True when the command was handled.
 */
async function run(name, argument) {
	if (GM_COMMANDS.has(name)) {
		if (!game.user.isGM) {
			ui.notifications.warn(game.i18n.localize("OP2.Command.gmOnly"));
			return true;
		}
		if (name === "rodada") await endRound(game.scenes?.current);
		else await endScene(game.scenes?.current);
		return true;
	}

	const actor = resolveActor();
	if (!actor) {
		ui.notifications.warn(game.i18n.localize("OP2.Notification.noActor"));
		return true;
	}

	switch (name) {
		case "luta":
			await attack(actor);
			return true;
		case "ajuda":
			await offerHelp(actor);
			return true;
		case "ferimento":
			await rollSurvival(actor, "injury");
			return true;
		case "trauma":
			await rollSurvival(actor, "trauma");
			return true;
		case "recapitular":
			await sceneAction(actor, "recap");
			return true;
		case "compartilhar":
			await sceneAction(actor, "share");
			return true;
		case "lab":
			await runLab(actor, Number(argument) || OP2.tools.lab.minDice);
			return true;
		case "radio":
			await runRadio(actor);
			return true;
		default:
			return false;
	}
}

/* -------------------------------------------- */

/** Listen for `/op2…` in the chat box. Call once, in the `init` hook. */
export function registerChatCommands() {
	// Foundry cancels the message when a `chatMessage` listener returns false.
	Hooks.on("chatMessage", (_log, message) => {
		const match = /^\/op2(\w+)\s*(.*)$/i.exec(message.trim());
		if (!match) return;

		const [, name, argument] = match;
		run(name.toLowerCase(), argument).then((handled) => {
			if (!handled) ui.notifications.warn(game.i18n.format("OP2.Command.unknown", { name }));
		});

		return false;
	});
}

/** Every command, for the help card and the documentation. */
export const COMMANDS = [
	"luta",
	"ajuda",
	"ferimento",
	"trauma",
	"recapitular",
	"compartilhar",
	"lab",
	"radio",
	"rodada",
	"cena",
];
