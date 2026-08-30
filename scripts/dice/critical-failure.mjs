import { MODULE_ID, OP2 } from "../config.mjs";

/**
 * Roll on the `Efeitos de falhas críticas` table and apply what the module can
 * apply on its own. The narrative entries are left to the table.
 * @param {Actor} actor                  Actor that rolled the critical failure.
 * @returns {Promise<ChatMessage|null>}  The message posted, or null when refused.
 */
export async function rollCriticalFailure(actor) {
	if (!actor?.isOwner) {
		ui.notifications.warn(game.i18n.localize("OP2.Notification.notOwner"));
		return null;
	}

	const roll = await new Roll("1d8").evaluate();
	const entry = OP2.criticalFailureTable.find((e) => e.face === roll.total) ?? OP2.criticalFailureTable.at(-1);
	const rolls = [roll];
	let outcome = "";

	if (entry.effect === "attributeStep") {
		await applyAttributeStep(actor, entry.attribute);
		outcome = game.i18n.format("OP2.CriticalFailure.appliedStep", {
			attribute: game.i18n.localize(OP2.attributes[entry.attribute].label),
		});
	} else if (entry.effect === "resource") {
		const damage = await new Roll(entry.formula).evaluate();
		rolls.push(damage);
		const current = actor.system[entry.resource].value;
		await actor.update({ [`system.${entry.resource}.value`]: Math.max(0, current - damage.total) });
		outcome = game.i18n.format("OP2.CriticalFailure.appliedResource", {
			amount: damage.total,
			resource: game.i18n.localize(`OP2.Field.${entry.resource}`),
		});
	}

	const content = `<div class="op2-critfail">
		<p class="op2-critfail__name">${game.i18n.localize(`OP2.CriticalFailure.${entry.key}.label`)}</p>
		<p class="op2-critfail__text">${game.i18n.localize(`OP2.CriticalFailure.${entry.key}.text`)}</p>
		${outcome ? `<p class="op2-critfail__outcome">${outcome}</p>` : ""}
	</div>`;

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `<span class="op2-flavor__title">${game.i18n.localize("OP2.CriticalFailure.title")}</span>`,
		content,
		rolls,
		sound: CONFIG.sounds.dice,
	});
}

/* -------------------------------------------- */

/**
 * Reduce one attribute by one step until the end of the scene.
 * Foundry has no scene duration, so the GM removes the effect. The flag marks
 * it for a later clean-up.
 * @param {Actor} actor          Actor to affect.
 * @param {string} attributeKey  Attribute to reduce.
 * @returns {Promise<ActiveEffect|undefined>}
 */
async function applyAttributeStep(actor, attributeKey) {
	const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
		{
			name: game.i18n.format("OP2.Effect.criticalFailureStep", {
				attribute: game.i18n.localize(OP2.attributes[attributeKey].label),
			}),
			img: "icons/skills/wounds/injury-body-pain-gray.webp",
			origin: actor.uuid,
			changes: [
				{
					key: `system.attributes.${attributeKey}.step`,
					mode: CONST.ACTIVE_EFFECT_MODES.ADD,
					value: "-1",
				},
			],
			flags: { [MODULE_ID]: { source: "criticalFailure" } },
		},
	]);
	return effect;
}

/* -------------------------------------------- */

/**
 * Bind the `roll the table` button of a critical failure card. The listener sits
 * on `document.body`, so it survives every chat layout and a hot reload.
 */
export function registerCriticalFailureListener() {
	const marker = "_op2CriticalFailureListener";
	if (document.body[marker]) return;

	const handler = async (event) => {
		const button = event.target.closest("[data-action='op2CriticalFailure']");
		if (!button) return;
		event.preventDefault();

		const actor = await fromUuid(button.dataset.actorUuid);
		if (!actor) return;

		button.disabled = true;
		const message = await rollCriticalFailure(actor);
		if (!message) {
			button.disabled = false;
			return;
		}

		const messageId = button.closest("[data-message-id]")?.dataset.messageId;
		const source = game.messages.get(messageId);
		if (source?.isOwner) await source.setFlag(MODULE_ID, "criticalFailureResolved", true);
		else button.remove();
	};

	document.body[marker] = handler;
	document.body.addEventListener("click", handler);
}

/* -------------------------------------------- */

/** Hide the button once the table has been rolled for that message. */
export function hideResolvedCriticalFailureButton(message, element) {
	if (!message.getFlag(MODULE_ID, "criticalFailureResolved")) return;
	element.querySelector("[data-action='op2CriticalFailure']")?.remove();
}
