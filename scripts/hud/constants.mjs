/** Prefix of every action this module puts on the HUD, so it never collides. */
export const ACTION = {
	skill: "op2Skill",
	scene: "op2Scene",
	survival: "op2Survival",
	tool: "op2Tool",
	gm: "op2Gm",
};

/** Groups the module adds to the Token Action HUD layout. */
export const GROUP = {
	skills: { id: "op2Skills", name: "OP2.Hud.group.skills", type: "system" },
	aptitude: { id: "op2Aptitude", name: "OP2.SkillGroup.aptitude", type: "system" },
	scene: { id: "op2Scene", name: "OP2.Hud.group.scene", type: "system" },
	survival: { id: "op2Survival", name: "OP2.Hud.group.survival", type: "system" },
	tools: { id: "op2Tools", name: "OP2.Hud.group.tools", type: "system" },
	gm: { id: "op2Gm", name: "OP2.Hud.group.gm", type: "system" },
};

/** Top-level tab of the HUD. */
export const LAYOUT_ID = "op2";

/** Module that owns the HUD. */
export const CORE_MODULE_ID = "token-action-hud-core";
