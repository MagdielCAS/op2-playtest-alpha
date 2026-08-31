import { MODULE_ID, OP2, AGENT_TYPE, POI_TYPE } from "../config.mjs";
import { ACTION, GROUP, LAYOUT_ID, CORE_MODULE_ID } from "./constants.mjs";
import { runHudAction } from "./actions.mjs";
import { dieLabel } from "../dice/die-step.mjs";

/**
 * Token Action HUD integration.
 *
 * The module is NOT a Token Action HUD system module: only one of those may
 * exist per system, and that slot belongs to Token Action HUD Ordem Paranormal.
 * Instead this registers extenders, which Token Action HUD Core invites from
 * any module through three public hooks. The result sits beside the OP1 groups
 * without touching them.
 */

/** Localize, falling back to the key when there is no translation. */
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/* -------------------------------------------- */

/**
 * The groups this module contributes, resolved at registration time so their
 * names are localized.
 * @returns {object[]}
 */
function buildGroups() {
	return Object.values(GROUP).map((group) => ({
		...group,
		name: t(group.name),
		listName: `Group: ${t(group.name)}`,
	}));
}

/* -------------------------------------------- */

/**
 * Add the module's tab to the default HUD layout.
 * @param {object[]} defaults  The layout Token Action HUD Core is assembling.
 */
function registerDefaults(defaults) {
	if (!defaults) return;
	const groups = buildGroups();
	const byId = Object.fromEntries(groups.map((g) => [g.id, g]));

	defaults.groups ??= [];
	defaults.layout ??= [];
	defaults.groups.push(...groups);
	defaults.layout.push({
		nestId: LAYOUT_ID,
		id: LAYOUT_ID,
		name: t("OP2.Hud.tab"),
		groups: Object.values(byId).map((g) => ({ ...g, nestId: `${LAYOUT_ID}_${g.id}` })),
	});
}

/* -------------------------------------------- */

/**
 * Build the extender classes. They can only be defined once Token Action HUD
 * Core has published its API, because they extend its base classes.
 * @param {object} coreModule  The Token Action HUD Core module.
 * @returns {{ActionExtender: Function, RollExtender: Function}}
 */
function buildExtenders(coreModule) {
	const ActionExtender = class OP2ActionHandlerExtender extends coreModule.api.ActionHandlerExtender {
		/**
		 * Add the OP2 groups for an OP2 agent, and the GM group for a GM.
		 * @override
		 */
		async extendActionHandler() {
			const actor = this.actionHandler?.actor;
			const isAgent = actor?.type === AGENT_TYPE;

			if (isAgent) {
				await this.#addSkills(actor);
				await this.#addScene();
				await this.#addSurvival();
				await this.#addTools();
				this.#addResourceInfo(actor);
			}

			if (game.user.isGM) await this.#addGmActions();
		}

		/* -------------------------------------------- */

		/** One action per skill. Aptitude fields go to their own group. */
		async #addSkills(actor) {
			const plain = [];
			const aptitude = [];

			for (const [key, config] of Object.entries(OP2.skills)) {
				const skill = actor.system.skills[key];
				const attribute = actor.system.attributes[config.attribute];
				const action = {
					id: `${ACTION.skill}-${key}`,
					name: t(config.label),
					encodedValue: [ACTION.skill, key].join(this.actionHandler.delimiter),
					info1: { text: dieLabel(skill.faces) },
					info2: { text: dieLabel(attribute.faces) },
					tooltip: {
						content: `${t(config.label)} ${dieLabel(skill.faces)} + ${t(OP2.attributes[config.attribute].label)} ${dieLabel(attribute.faces)}`,
						direction: "LEFT",
					},
				};
				(config.group === "aptitude" ? aptitude : plain).push(action);
			}

			await this.actionHandler.addActions(plain, { id: GROUP.skills.id, type: "system" });
			await this.actionHandler.addActions(aptitude, { id: GROUP.aptitude.id, type: "system" });
		}

		/* -------------------------------------------- */

		/** Actions a player takes during a scene. */
		async #addScene() {
			const actions = [
				["recap", "OP2.SceneAction.recap.title"],
				["share", "OP2.SceneAction.share.title"],
				["help", "OP2.Help.title"],
				["attack", "OP2.Combat.attackTitle"],
			].map(([id, label]) => ({
				id: `${ACTION.scene}-${id}`,
				name: t(label),
				encodedValue: [ACTION.scene, id].join(this.actionHandler.delimiter),
			}));

			await this.actionHandler.addActions(actions, { id: GROUP.scene.id, type: "system" });
		}

		/* -------------------------------------------- */

		/** The two survival tests, for when the card was dismissed. */
		async #addSurvival() {
			const actions = ["injury", "trauma"].map((id) => ({
				id: `${ACTION.survival}-${id}`,
				name: t(`OP2.Survival.${id}.title`),
				encodedValue: [ACTION.survival, id].join(this.actionHandler.delimiter),
			}));

			await this.actionHandler.addActions(actions, { id: GROUP.survival.id, type: "system" });
		}

		/* -------------------------------------------- */

		/** Ordo Realitas tools with their own mechanics. */
		async #addTools() {
			const { minDice, maxDice } = OP2.tools.lab;
			const actions = [];
			for (let dice = minDice; dice <= maxDice; dice++) {
				actions.push({
					id: `${ACTION.tool}-lab${dice}`,
					name: `${t("OP2.Tool.lab")} (${dice})`,
					encodedValue: [ACTION.tool, `lab${dice}`].join(this.actionHandler.delimiter),
				});
			}
			actions.push({
				id: `${ACTION.tool}-radio`,
				name: t("OP2.Tool.radio"),
				encodedValue: [ACTION.tool, "radio"].join(this.actionHandler.delimiter),
			});

			await this.actionHandler.addActions(actions, { id: GROUP.tools.id, type: "system" });
		}

		/* -------------------------------------------- */

		/** PV, PD and the Ímpeto track, as read-only info on the skills group. */
		#addResourceInfo(actor) {
			const { pv, pd, impeto } = actor.system;
			const info = {
				id: GROUP.skills.id,
				type: "system",
				info1: { text: `PV ${pv.value}/${pv.max}` },
				info2: { text: `PD ${pd.value}/${pd.max}` },
			};
			if (actor.system.hasImpeto) info.info3 = { text: `${t("OP2.Field.impeto")} ${impeto.value}/${impeto.max}` };

			try {
				this.actionHandler.addGroupInfo(info);
			} catch (error) {
				// The info row is a nicety; never let it break the HUD build.
				console.debug(`${MODULE_ID} | could not add group info`, error);
			}
		}

		/* -------------------------------------------- */

		/** GM-only: close a round, close the scene, send a point of interest. */
		async #addGmActions() {
			const actions = [
				{
					id: `${ACTION.gm}-round`,
					name: t("OP2.Hud.action.endRound"),
					encodedValue: [ACTION.gm, "round"].join(this.actionHandler.delimiter),
				},
				{
					id: `${ACTION.gm}-scene`,
					name: t("OP2.Hud.action.endScene"),
					encodedValue: [ACTION.gm, "scene"].join(this.actionHandler.delimiter),
				},
			];

			const points = game.items
				.filter((item) => item.type === POI_TYPE)
				.sort((a, b) => (a.system.mapNumber || "zz").localeCompare(b.system.mapNumber || "zz"));

			for (const point of points) {
				const number = point.system.mapNumber ? `${point.system.mapNumber} ` : "";
				actions.push({
					id: `${ACTION.gm}-poi-${point.id}`,
					name: `${number}${point.name}`,
					img: point.img,
					encodedValue: [ACTION.gm, `poi:${point.id}`].join(this.actionHandler.delimiter),
					tooltip: { content: t("OP2.Poi.postToChat"), direction: "LEFT" },
				});
			}

			await this.actionHandler.addActions(actions, { id: GROUP.gm.id, type: "system" });
		}
	};

	/* -------------------------------------------- */

	const RollExtender = class OP2RollHandlerExtender extends coreModule.api.RollHandlerExtender {
		/**
		 * Handle a click on one of this module's actions.
		 * @override
		 * @param {Event} event         The click.
		 * @param {string} buttonValue  The encoded value of the action.
		 * @returns {boolean}           True when this module consumed the click.
		 */
		handleActionClick(event, buttonValue) {
			const encoded = this.action?.encodedValue ?? buttonValue ?? "";
			const [type, ...rest] = String(encoded).split("|");
			if (!Object.values(ACTION).includes(type)) return false;

			const id = rest.join("|");
			const actor = this.actor ?? canvas.tokens?.controlled?.[0]?.actor ?? game.user.character;

			if (type !== ACTION.gm && actor?.type !== AGENT_TYPE) {
				ui.notifications.warn(game.i18n.localize("OP2.Notification.noActor"));
				return true;
			}

			// The HUD does not await this, so failures are reported here.
			runHudAction(actor, type, id, event).catch((error) => {
				console.error(`${MODULE_ID} | HUD action failed`, { encoded, error });
				ui.notifications.error(game.i18n.localize("OP2.Hud.actionFailed"));
			});

			return true;
		}
	};

	return { ActionExtender, RollExtender };
}

/* -------------------------------------------- */

/**
 * Wire the module into Token Action HUD Core. Safe to call when the HUD is not
 * installed: the hooks simply never fire.
 */
export function registerTokenActionHud() {
	Hooks.on("tokenActionHudCoreApiReady", (coreModule) => {
		if (coreModule?.id !== CORE_MODULE_ID) return;

		const { ActionExtender, RollExtender } = buildExtenders(coreModule);

		Hooks.on("tokenActionHudCoreRegisterDefaults", registerDefaults);
		Hooks.on("tokenActionHudCoreAddActionHandlerExtenders", (actionHandler) => {
			actionHandler.addActionHandlerExtender(new ActionExtender());
		});
		Hooks.on("tokenActionHudCoreAddRollHandlerExtenders", (rollHandler) => {
			rollHandler.addRollHandlerExtender(new RollExtender());
		});

		console.log(`${MODULE_ID} | Token Action HUD extenders registered`);
	});
}
