import { OP2 } from "../config.mjs";
import { dieLabel } from "./die-step.mjs";
import { evaluateTest } from "./evaluate-test.mjs";

const { PoolTerm } = foundry.dice.terms;

/**
 * @typedef {object} OP2DieResult
 * @property {number} faces    Size of the die.
 * @property {number} result   Face rolled.
 * @property {boolean} active  False when the die was discarded from the sum.
 */

/**
 * @typedef {object} OP2Evaluation
 * @property {OP2DieResult[]} entries   Every die rolled, in the order of the pool.
 * @property {number} total             Sum of the summed dice plus the flat bonus.
 * @property {number} highest           Rolagem Alta (RA).
 * @property {number} lowest            Rolagem Baixa (RB).
 * @property {boolean} criticalSuccess  Two or more equal faces of 6 or more.
 * @property {boolean} criticalFailure  Every face is 1.
 * @property {number|null} dt           Difficulty of the test, when there is one.
 * @property {boolean|null} success     Result against the DT, or null when there is no DT.
 */

/**
 * A test of Ordem Paranormal 2: a pool of dice of different sizes.
 * The pool keeps the highest `maxSummed` dice, which gives the rule "roll at
 * most four dice and sum at most three of them".
 */
export default class OP2Roll extends Roll {
	/**
	 * Build a test roll from a list of die sizes.
	 * @param {number[]} faces                Die sizes to roll, for example `[8, 6]`.
	 * @param {object} [options]
	 * @param {number} [options.bonus=0]      Flat bonus added to the sum.
	 * @param {number|null} [options.dt=null] Difficulty of the test.
	 * @param {number} [options.maxSummed]    How many dice the sum keeps.
	 * @param {object} [options.data={}]      Roll data.
	 * @param {object} [options.flags={}]     Extra data kept on `roll.options`.
	 * @returns {OP2Roll}
	 */
	static fromDice(faces, { bonus = 0, dt = null, maxSummed = OP2.maxSummed, data = {}, flags = {} } = {}) {
		const sizes = (faces ?? []).map((f) => Number(f)).filter((f) => f > 0);
		if (!sizes.length) throw new Error("OP2Roll.fromDice requires at least one die.");

		const pool = `{${sizes.map((f) => `1d${f}`).join(",")}}`;
		const kept = sizes.length > maxSummed ? `${pool}kh${maxSummed}` : pool;
		const formula = Number(bonus) ? `${kept} + ${Number(bonus)}` : kept;

		return new this(formula, data, { ...flags, bonus: Number(bonus) || 0, dt, maxSummed, faces: sizes });
	}

	/* -------------------------------------------- */

	/**
	 * Every die of the test, with its size and its face.
	 * @returns {OP2DieResult[]}
	 */
	get entries() {
		const pool = this.terms.find((t) => t instanceof PoolTerm);
		if (pool) {
			return pool.rolls.map((roll, index) => ({
				faces: Number(roll.dice[0]?.faces ?? 0),
				result: Number(roll.total ?? 0),
				active: pool.results[index]?.active !== false,
			}));
		}

		return this.dice.flatMap((die) =>
			die.results.map((r) => ({ faces: Number(die.faces), result: Number(r.result), active: r.active !== false }))
		);
	}

	/* -------------------------------------------- */

	/**
	 * Read the test against the rules of the playtest.
	 * Rolagem alta, rolagem baixa and criticals look at every die rolled, not
	 * only at the dice kept in the sum.
	 * @returns {OP2Evaluation|null}  Null while the roll is not evaluated.
	 */
	get evaluation() {
		if (!this._evaluated) return null;
		return evaluateTest(this.entries, { total: this.total, dt: this.options.dt ?? null });
	}

	/* -------------------------------------------- */

	/**
	 * Short text of the dice used, for example `d8 + d6`.
	 * @returns {string}
	 */
	get diceLabel() {
		return (this.options.faces ?? []).map(dieLabel).join(" + ");
	}
}
