/**
 * Pure arithmetic of the access challenges. Kept free of Foundry so it can be
 * tested with plain node.
 *
 * @typedef {object} TestOutcome
 * @property {boolean} success  Whether the test passed.
 * @property {number} highest   Rolagem alta (RA).
 * @property {number} lowest    Rolagem baixa (RB).
 */

/**
 * `Arrombar`: a passed test adds the RA to the score. The route opens when the
 * score reaches the target. A target of zero means the GM calls it.
 * @param {object} route            Current route state, with `progress` and `target`.
 * @param {TestOutcome} outcome     Result of the Atletismo test.
 * @returns {{gained: number, progress: number, solved: boolean}}
 */
export function resolveForceOpen(route, outcome) {
	const gained = outcome.success ? outcome.highest : 0;
	const progress = (route.progress ?? 0) + gained;
	return { gained, progress, solved: route.target > 0 && progress >= route.target };
}

/**
 * `Alcançar`.
 * Safe: two tests in a row against the DT; a failure deals RB damage and sends
 * the character back to the start.
 * Risky: one test against DT + 3; a failure deals RA damage.
 * @param {object} route          Current route state, with `stage`.
 * @param {TestOutcome} outcome   Result of the Acrobacia test.
 * @param {object} options
 * @param {boolean} options.risky        Which way the character tried.
 * @param {number} [options.safeActions] Actions the safe way needs.
 * @returns {{stage: number, solved: boolean, damage: number}}
 */
export function resolveReach(route, outcome, { risky, safeActions = 2 }) {
	if (outcome.success) {
		const stage = risky ? safeActions : (route.stage ?? 0) + 1;
		return { stage, solved: risky || stage >= safeActions, damage: 0 };
	}
	return { stage: 0, solved: false, damage: risky ? outcome.highest : outcome.lowest };
}

/**
 * `Sustentar`: every round already held costs one die step on the next test.
 * A passed test adds a round; a failed one drops the object.
 * @param {object} route         Current route state, with `stage` as rounds held.
 * @param {TestOutcome} outcome  Result of the Atletismo test.
 * @returns {{stage: number, held: boolean, fatigue: number}}
 */
export function resolveSustain(route, outcome) {
	const rounds = route.stage ?? 0;
	return { stage: outcome.success ? rounds + 1 : 0, held: outcome.success, fatigue: rounds };
}

/**
 * Step modifier of the next `Sustentar` test.
 * @param {object} route  Current route state.
 * @returns {number}      Negative steps of accumulated fatigue.
 */
export function sustainSteps(route) {
	return -(route.stage ?? 0);
}
