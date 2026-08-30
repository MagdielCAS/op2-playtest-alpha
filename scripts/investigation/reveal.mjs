/**
 * Pure selection rules of the information table of a point of interest.
 * Kept free of Foundry so it can be tested with plain node.
 */

/**
 * Fill in the skill of every line. A blank `skill` continues the skill of the
 * line above, the way the book prints the table.
 * @param {object[]} infos  Raw lines of the table.
 * @returns {object[]}      The same lines, each with a resolved `skill`.
 */
export function resolveSkills(infos) {
	let current = "";
	return (infos ?? []).map((info) => {
		if (info.skill) current = info.skill;
		return { ...info, skill: info.skill || current };
	});
}

/**
 * Lines a value or a test result reveals. A locked line never reveals on its
 * own, and a line already revealed is never returned again — that is what makes
 * an `Examinar` cost 1 PD when it finds nothing new.
 * @param {object[]} infos   Lines with a resolved skill.
 * @param {string} skillKey  Skill chosen by the character.
 * @param {number} value     Skill die for `Investigar`, test total for `Examinar`.
 * @returns {object[]}       Lines to reveal now.
 */
export function selectPending(infos, skillKey, value) {
	return (infos ?? []).filter(
		(info) => info.skill === skillKey && !info.revealed && !info.locked && Number(info.dt) <= Number(value)
	);
}
