import { OP2 } from "../config.mjs";

/**
 * Read a test against the rules of the playtest alpha.
 * Rolagem alta, rolagem baixa and criticals look at every die rolled, not only
 * at the dice kept in the sum.
 * @param {{faces: number, result: number, active: boolean}[]} entries  Dice rolled.
 * @param {object} options
 * @param {number} options.total          Sum of the kept dice plus the flat bonus.
 * @param {number|null} [options.dt=null] Difficulty of the test.
 * @returns {object}                      The evaluation of the test.
 */
export function evaluateTest(entries, { total, dt = null } = {}) {
	const values = entries.map((entry) => Number(entry.result));
	if (!values.length) throw new Error("evaluateTest requires at least one die result.");

	const counts = values.reduce((acc, value) => {
		acc[value] = (acc[value] ?? 0) + 1;
		return acc;
	}, {});

	const criticalSuccess = Object.entries(counts).some(
		([face, count]) => count >= 2 && Number(face) >= OP2.criticalMinFace
	);
	const criticalFailure = values.every((value) => value === 1);

	let success = null;
	if (criticalSuccess) success = true;
	else if (criticalFailure) success = false;
	else if (dt !== null && dt !== undefined) success = total >= dt;

	return {
		entries,
		total,
		highest: Math.max(...values),
		lowest: Math.min(...values),
		criticalSuccess,
		criticalFailure,
		dt: dt ?? null,
		success,
	};
}

export default evaluateTest;
