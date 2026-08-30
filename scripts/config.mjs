/**
 * Static configuration of the Ordem Paranormal 2 Playtest Alpha rules.
 * Exposed at runtime as `CONFIG.OP2`.
 */

export const MODULE_ID = "op2-playtest-alpha";
export const AGENT_TYPE = `${MODULE_ID}.agent`;

/** Die sizes, from the smallest to the largest. The last entry is paranormal only. */
export const DIE_LADDER = [4, 6, 8, 10, 12, 20];

/** Index of the largest die a character can normally reach. */
export const STANDARD_MAX_INDEX = 4;

export const OP2 = {
	moduleId: MODULE_ID,
	agentType: AGENT_TYPE,

	dieLadder: DIE_LADDER,
	standardMaxIndex: STANDARD_MAX_INDEX,

	/** Valid die sizes for an attribute or a skill. */
	dieChoices: {
		4: "OP2.Die.d4",
		6: "OP2.Die.d6",
		8: "OP2.Die.d8",
		10: "OP2.Die.d10",
		12: "OP2.Die.d12",
		20: "OP2.Die.d20",
	},

	/** Default difficulty of a test in the playtest alpha. */
	defaultDT: 7,

	/** The lowest face that can make a critical success. */
	criticalMinFace: 6,

	/** A test rolls at most four dice and sums at most three of them. */
	maxDice: 4,
	maxSummed: 3,

	attributes: {
		physical: { label: "OP2.Attribute.physical", abbr: "OP2.Attribute.physicalAbbr" },
		mind: { label: "OP2.Attribute.mind", abbr: "OP2.Attribute.mindAbbr" },
		emotion: { label: "OP2.Attribute.emotion", abbr: "OP2.Attribute.emotionAbbr" },
	},

	/**
	 * The 20 skills. `Aptidão` is one skill with six fields, so its fields are
	 * flat keys grouped under `aptitude` for the sheet.
	 */
	skills: {
		acrobatics: { label: "OP2.Skill.acrobatics", attribute: "physical" },
		aptArts: { label: "OP2.Skill.aptArts", attribute: "mind", group: "aptitude" },
		aptCurrentAffairs: { label: "OP2.Skill.aptCurrentAffairs", attribute: "mind", group: "aptitude" },
		aptBureaucracy: { label: "OP2.Skill.aptBureaucracy", attribute: "mind", group: "aptitude" },
		aptExactSciences: { label: "OP2.Skill.aptExactSciences", attribute: "mind", group: "aptitude" },
		aptHumanities: { label: "OP2.Skill.aptHumanities", attribute: "mind", group: "aptitude" },
		aptTactics: { label: "OP2.Skill.aptTactics", attribute: "mind", group: "aptitude" },
		athletics: { label: "OP2.Skill.athletics", attribute: "physical" },
		crime: { label: "OP2.Skill.crime", attribute: "physical" },
		discipline: { label: "OP2.Skill.discipline", attribute: "emotion" },
		deception: { label: "OP2.Skill.deception", attribute: "emotion" },
		stealth: { label: "OP2.Skill.stealth", attribute: "physical" },
		intimidation: { label: "OP2.Skill.intimidation", attribute: "emotion" },
		intuition: { label: "OP2.Skill.intuition", attribute: "emotion" },
		fighting: { label: "OP2.Skill.fighting", attribute: "physical" },
		machines: { label: "OP2.Skill.machines", attribute: "mind" },
		medicine: { label: "OP2.Skill.medicine", attribute: "mind" },
		occultism: { label: "OP2.Skill.occultism", attribute: "mind" },
		perception: { label: "OP2.Skill.perception", attribute: "mind" },
		persuasion: { label: "OP2.Skill.persuasion", attribute: "emotion" },
		research: { label: "OP2.Skill.research", attribute: "mind" },
		aim: { label: "OP2.Skill.aim", attribute: "physical" },
		survival: { label: "OP2.Skill.survival", attribute: "mind" },
		technology: { label: "OP2.Skill.technology", attribute: "mind" },
		vigor: { label: "OP2.Skill.vigor", attribute: "physical" },
	},

	skillGroups: {
		aptitude: "OP2.SkillGroup.aptitude",
	},

	profiles: {
		executor: "OP2.Profile.executor",
		analyst: "OP2.Profile.analyst",
		vigilante: "OP2.Profile.vigilante",
	},

	/** The Ímpeto track of the Executor profile. */
	impeto: {
		/** Profile that owns the track. */
		profile: "executor",
		/** Boxes on the track. */
		size: 3,
		/** Boxes spent for one step on a test. */
		stepCost: 1,
		/** Boxes spent for one step on an attribute until the end of the scene. */
		attributeCost: 3,
	},

	/**
	 * `Ajuda`: step increases given to the test of another character, by the die
	 * of the skill used to help. A d4 cannot help.
	 */
	help: { 4: 0, 6: 1, 8: 1, 10: 2, 12: 2, 20: 2 },

	/**
	 * `Efeitos de falhas críticas`, rolled on 1d8.
	 * `effect` says what the module applies on its own:
	 * `attributeStep` reduces one attribute by one step until the end of the
	 * scene, `resource` subtracts a roll from PV or PD, `narrative` and `none`
	 * apply nothing.
	 */
	criticalFailureTable: [
		{ face: 1, key: "vexame", effect: "narrative" },
		{ face: 2, key: "machucado", effect: "attributeStep", attribute: "physical" },
		{ face: 3, key: "desatencao", effect: "attributeStep", attribute: "mind" },
		{ face: 4, key: "irritacao", effect: "attributeStep", attribute: "emotion" },
		{ face: 5, key: "acidente", effect: "resource", resource: "pv", formula: "1d4" },
		{ face: 6, key: "frustracao", effect: "resource", resource: "pd", formula: "1d4" },
		{ face: 7, key: "perda", effect: "narrative" },
		{ face: 8, key: "semEfeito", effect: "none" },
	],

	/** Number of `Destrancar` attempts per round, by the value of Crime. */
	unlockAttemptsByCrime: { 4: 1, 6: 2, 8: 3, 10: 4, 12: 5, 20: 6 },

	/** Fixed DTs named by the rules. */
	fixedDT: {
		recap: 10,
		share: 10,
		injury: 7,
		injuryStep: 3,
	},
};

export default OP2;
