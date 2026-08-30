import { MODULE_ID, OP2 } from "../config.mjs";
import { applyDamage } from "../rules/survival.mjs";

/**
 * Roll on the `Efeitos de falhas críticas` table and apply what the module can
 * apply on its own. The narrative entries are left to the table.
 * @param {Actor} actor                  Actor that rolled the critical failure.
 * @returns {Promise<ChatMessage|null>}  The message posted, or null when refused.
 */
export async function rollCriticalFailure(actor) {
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
		await applyDamage(actor, entry.resource, damage.total);
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
