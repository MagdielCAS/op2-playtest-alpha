/**
 * Pure rules of `Destrancar`, the combination challenge.
 * Kept free of Foundry so it can be tested with plain node.
 */

/** Answer given for one die of a guess. */
export const FEEDBACK = { low: "low", exact: "exact", high: "high" };

/**
 * Read a formula such as `4d6` into its two numbers.
 * @param {string} formula  Dice of the combination.
 * @returns {{count: number, faces: number}|null}  Null when the formula is malformed.
 */
export function parseCombinationFormula(formula) {
	const match = /^\s*(\d+)\s*d\s*(\d+)\s*$/i.exec(String(formula ?? ""));
	if (!match) return null;
	const count = Number(match[1]);
	const faces = Number(match[2]);
	if (count < 1 || faces < 2) return null;
	return { count, faces };
}

/* -------------------------------------------- */

/**
 * Answer a guess, die by die, in the order the dice were rolled.
 * The answer points at where the secret is, not at the guess: a secret lower
 * than the guessed number answers `low`.
 * @param {number[]} combination  The secret numbers.
 * @param {number[]} guess        The numbers the player set.
 * @returns {string[]}            One `low`, `exact` or `high` per die.
 */
export function compareGuess(combination, guess) {
	return combination.map((secret, index) => {
		const attempt = Number(guess[index]);
		if (secret === attempt) return FEEDBACK.exact;
		return secret < attempt ? FEEDBACK.low : FEEDBACK.high;
	});
}

/* -------------------------------------------- */

/**
 * State of the lock after one guess.
 * A lock that runs out of attempts breaks: from then on only brute force or the
 * right key opens it.
 * @param {object} route     Route state, with `attempts` and `maxAttempts`.
 * @param {string[]} answer  Feedback of this guess.
 * @returns {{solved: boolean, broken: boolean, used: number, remaining: number|null}}
 */
export function resolveGuess(route, answer) {
	const solved = answer.length > 0 && answer.every((entry) => entry === FEEDBACK.exact);
	const used = (route.attempts?.length ?? 0) + 1;
	const max = route.maxAttempts ?? 0;
	const remaining = max > 0 ? Math.max(0, max - used) : null;
	return { solved, broken: !solved && max > 0 && used >= max, used, remaining };
}

/* -------------------------------------------- */

/**
 * Guesses a character makes per round, from the value of Crime.
 * @param {number} crimeFaces          Die of the Crime skill.
 * @param {Record<number, number>} table  `OP2.unlockAttemptsByCrime`.
 * @returns {number}
 */
export function attemptsPerRound(crimeFaces, table) {
	return table[crimeFaces] ?? 1;
}
