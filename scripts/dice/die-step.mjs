import { DIE_LADDER, STANDARD_MAX_INDEX, OP2 } from "../config.mjs";

const HELP_STEPS = OP2.help;

/**
 * Position of a die size on the ladder. An unknown size falls back to the
 * largest ladder entry that is not above it, and never below d4.
 * @param {number} faces  Number of faces of the die.
 * @returns {number}      Index on `DIE_LADDER`.
 */
export function dieIndex(faces) {
	const value = Number(faces);
	const exact = DIE_LADDER.indexOf(value);
	if (exact >= 0) return exact;

	let index = 0;
	for (let i = 0; i < DIE_LADDER.length; i++) {
		if (DIE_LADDER[i] <= value) index = i;
	}
	return index;
}

/**
 * Apply step modifiers to a die size (`Passo de Dados`).
 * The ladder is d4 < d6 < d8 < d10 < d12, and d20 only when the paranormal
 * step is allowed. A die never drops below d4. A die that already sits on d20
 * keeps d20 even when the paranormal step is off.
 * @param {number} faces                       Current number of faces.
 * @param {number} [steps=0]                   Steps to add. A negative value reduces the die.
 * @param {object} [options]
 * @param {boolean} [options.allowParanormal]  Permit the step from d12 to d20.
 * @returns {number}                           The new number of faces.
 */
export function stepDie(faces, steps = 0, { allowParanormal = false } = {}) {
	const index = dieIndex(faces);
	const paranormalIndex = DIE_LADDER.length - 1;
	const maxIndex = allowParanormal || index === paranormalIndex ? paranormalIndex : STANDARD_MAX_INDEX;
	const target = Math.min(Math.max(index + Number(steps || 0), 0), maxIndex);
	return DIE_LADDER[target];
}

/**
 * Label of a die size.
 * @param {number} faces  Number of faces.
 * @returns {string}      For example `d8`.
 */
export function dieLabel(faces) {
	return `d${Number(faces) || 4}`;
}

/**
 * Step increases the `Ajuda` action gives, by the die of the helping skill.
 * A d4 gives no help, a d6 or a d8 gives one step, a d10 or a d12 gives two.
 * @param {number} faces  Die of the skill used to help.
 * @returns {number}      Steps added to the test of the other character.
 */
export function helpSteps(faces) {
	const normalized = DIE_LADDER[dieIndex(faces)];
	return HELP_STEPS[normalized] ?? 0;
}
