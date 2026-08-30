#!/usr/bin/env node
/**
 * Rule tests for op2-playtest-alpha.
 *
 * The rule modules are written so their arithmetic is pure and free of Foundry.
 * A few of them still destructure `foundry.*` at import time, so a minimal stub
 * stands in for the globals a browser would provide.
 *
 * Usage: node .github/scripts/test-rules.mjs
 */

globalThis.foundry ??= {
	applications: { api: { DialogV2: class {} }, ux: {}, handlebars: {} },
	dice: { terms: { PoolTerm: class {} } },
	utils: { randomID: () => "0000000000000000" },
	data: { fields: {} },
	abstract: { TypeDataModel: class {} },
};
globalThis.Roll ??= class {};
globalThis.game ??= { i18n: { localize: (key) => key, format: (key) => key } };

const { OP2 } = await import("../../scripts/config.mjs");
const { stepDie, dieLabel, helpSteps } = await import("../../scripts/dice/die-step.mjs");
const { evaluateTest } = await import("../../scripts/dice/evaluate-test.mjs");
const { resolveSkills, selectPending } = await import("../../scripts/investigation/reveal.mjs");
const { resolveForceOpen, resolveReach, resolveSustain, sustainSteps } = await import(
	"../../scripts/investigation/access-rules.mjs"
);
const { parseCombinationFormula, compareGuess, resolveGuess, attemptsPerRound } = await import(
	"../../scripts/investigation/unlock.mjs"
);
const { survivalDT, survivalRuleFor } = await import("../../scripts/rules/survival.mjs");
const { resolveOpposed } = await import("../../scripts/rules/combat.mjs");
const { overloadFormula } = await import("../../scripts/rules/overload.mjs");
const { labSequence, labRerolls, labOutcome } = await import("../../scripts/tools/lab.mjs");
const { falseSetsRemoved } = await import("../../scripts/tools/radio.mjs");

/* -------------------------------------------- */

let passed = 0;
const failures = [];

/** Assert one expectation. */
function check(condition, label) {
	if (condition) passed += 1;
	else failures.push(label);
}

/** Assert that two values match. */
function equal(actual, expected, label) {
	const same = JSON.stringify(actual) === JSON.stringify(expected);
	check(same, same ? label : `${label} — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`);
}

/** One die result, for the roll evaluator. */
const die = (faces, result) => ({ faces, result, active: true });
/** One test outcome, for the access rules. */
const outcome = (success, highest, lowest) => ({ success, highest, lowest });

/* -------------------------------------------- */
/*  Die steps (page 20)                          */
/* -------------------------------------------- */

equal(stepDie(6, 1), 8, "one step up from d6 is d8");
equal(stepDie(10, 1), 12, "one step up from d10 is d12");
equal(stepDie(12, 1), 12, "d12 does not normally pass d12");
equal(stepDie(12, 1, { allowParanormal: true }), 20, "the paranormal step reaches d20");
equal(stepDie(4, -1), 4, "a die never drops below d4");
equal(stepDie(8, -2), 4, "two steps down from d8 is d4");
equal(stepDie(20, -1), 12, "a d20 steps back to d12");
equal(dieLabel(10), "d10", "die label");

/* -------------------------------------------- */
/*  Ajuda (page 19)                              */
/* -------------------------------------------- */

equal(helpSteps(4), 0, "a d4 cannot help");
equal([helpSteps(6), helpSteps(8)], [1, 1], "d6 and d8 give one step");
equal([helpSteps(10), helpSteps(12)], [2, 2], "d10 and d12 give two steps");

/* -------------------------------------------- */
/*  Reading a test (page 19)                     */
/* -------------------------------------------- */

{
	// The book's own example: the d6 rolls 6 and the d8 rolls 3.
	const result = evaluateTest([die(8, 3), die(6, 6)], { total: 9, dt: 7 });
	equal([result.highest, result.lowest], [6, 3], "RA and RB read the faces, not the die sizes");
	check(result.success === true, "9 beats DT 7");
}
check(evaluateTest([die(8, 6), die(6, 6)], { total: 12, dt: 99 }).success === true, "a critical success ignores the DT");
check(!evaluateTest([die(8, 5), die(6, 5)], { total: 10, dt: 7 }).criticalSuccess, "a pair below 6 is not a critical");
check(evaluateTest([die(8, 1), die(6, 1)], { total: 2, dt: 2 }).success === false, "a critical failure ignores the DT");
check(!evaluateTest([die(8, 1), die(6, 1), die(4, 2)], { total: 4, dt: 2 }).criticalFailure, "not every die is a 1");
check(evaluateTest([die(8, 4), die(6, 2)], { total: 6, dt: null }).success === null, "no DT gives no verdict");

/* -------------------------------------------- */
/*  Investigation table (page 44)                */
/* -------------------------------------------- */

{
	// Celular de Gustavo: Tecnologia at DT 4, 6, 8 and 8.
	const raw = [
		{ id: "a", skill: "intuition", dt: 6 },
		{ id: "b", skill: "research", dt: 6 },
		{ id: "c", skill: "technology", dt: 4 },
		{ id: "d", skill: "technology", dt: 6 },
		{ id: "e", skill: "", dt: 8 },
		{ id: "f", skill: "", dt: 8 },
	];
	let infos = resolveSkills(raw);
	equal([infos[4].skill, infos[5].skill], ["technology", "technology"], "a blank skill continues the line above");

	let found = selectPending(infos, "technology", 6);
	equal(found.map((info) => info.id), ["c", "d"], "Investigar with a d6 reveals DT 4 and DT 6");
	infos = infos.map((info) => (found.includes(info) ? { ...info, revealed: true } : info));

	found = selectPending(infos, "technology", 9);
	equal(found.map((info) => info.id), ["e", "f"], "Examinar with 9 reveals both DT 8 lines");
	infos = infos.map((info) => (found.includes(info) ? { ...info, revealed: true } : info));

	equal(selectPending(infos, "technology", 12).length, 0, "nothing new is left, so the PD cost applies");
	equal(selectPending(infos, "intuition", 6).map((info) => info.id), ["a"], "another skill is untouched");
	equal(selectPending(resolveSkills([{ id: "g", skill: "perception", dt: 6, locked: true }]), "perception", 99).length, 0,
		"a locked line never reveals on its own");
}

/* -------------------------------------------- */
/*  Access challenges (pages 24, 45, 58)         */
/* -------------------------------------------- */

{
	// Cadeado do freezer: DT acumulada 12.
	let route = { progress: 0, target: 12 };
	let result = resolveForceOpen(route, outcome(true, 6, 3));
	equal([result.gained, result.progress, result.solved], [6, 6, false], "Arrombar adds the RA to the score");
	equal(resolveForceOpen({ progress: 6, target: 12 }, outcome(false, 5, 1)).progress, 6, "a failure adds nothing");
	check(resolveForceOpen({ progress: 6, target: 12 }, outcome(true, 6, 4)).solved, "reaching the target opens it");
	check(!resolveForceOpen({ progress: 0, target: 0 }, outcome(true, 8, 2)).solved, "a target of zero is left to the GM");

	// Grade alta do duto: DT 7.
	equal(resolveReach({ stage: 0 }, outcome(true, 5, 4), { risky: false }).stage, 1, "the safe way needs two actions");
	check(resolveReach({ stage: 1 }, outcome(true, 6, 2), { risky: false }).solved, "the second safe action opens it");
	result = resolveReach({ stage: 1 }, outcome(false, 6, 2), { risky: false });
	equal([result.damage, result.stage], [2, 0], "a safe failure deals RB damage and resets");
	check(resolveReach({ stage: 0 }, outcome(true, 7, 1), { risky: true }).solved, "the risky way opens it in one action");
	equal(resolveReach({ stage: 0 }, outcome(false, 7, 1), { risky: true }).damage, 7, "a risky failure deals RA damage");

	// Sustentar: one step of fatigue per round.
	equal(sustainSteps({ stage: 0 }), 0, "the first round has no fatigue");
	equal([sustainSteps({ stage: 1 }), sustainSteps({ stage: 3 })], [-1, -3], "one step less per round held");
	equal(resolveSustain({ stage: 0 }, outcome(true, 6, 3)).stage, 1, "holding adds a round");
	equal(resolveSustain({ stage: 3 }, outcome(false, 4, 1)).stage, 0, "a failure drops the object");
}

/* -------------------------------------------- */
/*  Destrancar (page 24)                         */
/* -------------------------------------------- */

equal(parseCombinationFormula("4d6"), { count: 4, faces: 6 }, "read 4d6");
equal(parseCombinationFormula(" 3 D 8 "), { count: 3, faces: 8 }, "spaces and upper case");
check([parseCombinationFormula(""), parseCombinationFormula("d6"), parseCombinationFormula("0d6"),
	parseCombinationFormula("2d1")].every((value) => value === null), "malformed formulas are refused");

// The book's example: the secret is 3-5-2 and the guess is 4-5-1.
equal(compareGuess([3, 5, 2], [4, 5, 1]), ["low", "exact", "high"], "the answer points at the secret, not the guess");
equal(compareGuess([3, 5, 2], [3, 5, 2]), ["exact", "exact", "exact"], "the right combination");

{
	let state = resolveGuess({ attempts: [], maxAttempts: 0 }, compareGuess([3, 5, 2], [3, 5, 2]));
	check(state.solved && !state.broken && state.remaining === null, "no attempt limit means no damage");
	state = resolveGuess({ attempts: [{}, {}], maxAttempts: 3 }, compareGuess([3, 5, 2], [1, 1, 1]));
	check(state.broken && state.used === 3 && state.remaining === 0, "the last wrong attempt breaks the lock");
	state = resolveGuess({ attempts: [{}, {}], maxAttempts: 3 }, compareGuess([3, 5, 2], [3, 5, 2]));
	check(state.solved && !state.broken, "solving on the last attempt does not break it");
	equal(resolveGuess({ attempts: [{}], maxAttempts: 3 }, compareGuess([3, 5, 2], [1, 1, 1])).remaining, 1,
		"one attempt is still left");
}
equal([attemptsPerRound(4, OP2.unlockAttemptsByCrime), attemptsPerRound(8, OP2.unlockAttemptsByCrime),
	attemptsPerRound(12, OP2.unlockAttemptsByCrime)], [1, 3, 5], "attempts per round come from Crime");

/* -------------------------------------------- */
/*  Ferimentos and traumas (page 26)             */
/* -------------------------------------------- */

equal(survivalDT(0, OP2.survival.injury), 7, "the first injury test is DT 7");
equal([survivalDT(1, OP2.survival.injury), survivalDT(2, OP2.survival.injury), survivalDT(3, OP2.survival.injury)],
	[10, 13, 16], "each test already made raises the DT by 3");
equal(survivalRuleFor("pd").skill, "discipline", "PD is watched by Disciplina");
equal(survivalRuleFor("pv").skill, "vigor", "PV is watched by Vigor");
check(survivalRuleFor("impeto") === null, "no rule watches the Ímpeto track");

/* -------------------------------------------- */
/*  Simplified combat (page 26)                  */
/* -------------------------------------------- */

equal(resolveOpposed({ total: 10, damage: 6 }, { total: 8, damage: 4, dodging: false }),
	{ winner: "attacker", damage: 6, target: "defender" }, "the attacker wins and deals their damage");
equal(resolveOpposed({ total: 7, damage: 6 }, { total: 9, damage: 4, dodging: false }),
	{ winner: "defender", damage: 4, target: "attacker" }, "a counter-attack that wins hurts the attacker");
equal(resolveOpposed({ total: 7, damage: 6 }, { total: 9, damage: 4, dodging: true }),
	{ winner: "defender", damage: 0, target: "none" }, "a dodge that wins deals no damage");
equal(resolveOpposed({ total: 9, damage: 6 }, { total: 9, damage: 4, dodging: true }),
	{ winner: "tie", damage: 0, target: "none" }, "a tie hurts nobody");

/* -------------------------------------------- */
/*  Mental overload (page 77)                    */
/* -------------------------------------------- */

equal([1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map((round) => overloadFormula(round)),
	["0", "0", "1", "1", "1d4", "1d4", "1d6", "1d6", "2d4", "2d4"],
	"the progression of the basement, repeating the last entry");
equal(overloadFormula(0), "0", "a round below one costs nothing");

/* -------------------------------------------- */
/*  Ordo Realitas tools (pages 74 and 76)        */
/* -------------------------------------------- */

// The book's example: Mente d6, Aptidão (Exatas) d10, six dice.
equal(labSequence(6, 10), [4, 6, 8, 10, 10, 10], "the ladder stops at the Exatas die");
equal(labRerolls(6), 3, "rerolls are half of Mente");
equal(labSequence(4, 4), [4, 4, 4, 4], "a d4 in Exatas never leaves d4");
check(labOutcome([2, 2, 5, 7]).success, "a run that never drops succeeds");
equal(labOutcome([3, 6, 4, 8]).brokeAt, 3, "the run breaks where the roll drops");

equal([falseSetsRemoved(6), falseSetsRemoved(7), falseSetsRemoved(9), falseSetsRemoved(10),
	falseSetsRemoved(12), falseSetsRemoved(13)], [0, 2, 2, 3, 3, null],
	"the radio bands: 6 or less none, 7-9 two, 10-12 three, 13 or more all");

/* -------------------------------------------- */

if (failures.length) {
	console.error(`\n${failures.length} rule test(s) FAILED:\n`);
	for (const failure of failures) console.error(`  - ${failure}`);
	console.error("");
	process.exit(1);
}
console.log(`All ${passed} rule tests passed.`);
