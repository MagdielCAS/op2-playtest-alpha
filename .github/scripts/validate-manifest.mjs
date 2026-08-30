#!/usr/bin/env node
/**
 * Validate a Foundry module tree the way Foundry does at install time.
 * Every path named by the manifest must exist, or the install fails with
 * `PACKAGE.InstallFailed`.
 *
 * Usage: node .github/scripts/validate-manifest.mjs [rootDir]
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const errors = [];
const checked = [];

/** Record one required path and whether it is present. */
function require_(relativePath, source, { directory = false } = {}) {
	if (!relativePath) return;
	const full = join(root, relativePath);
	checked.push(relativePath);

	if (!existsSync(full)) {
		errors.push(`${source}: "${relativePath}" does not exist`);
		return;
	}
	const isDirectory = statSync(full).isDirectory();
	if (directory && !isDirectory) errors.push(`${source}: "${relativePath}" must be a directory`);
	if (!directory && isDirectory) errors.push(`${source}: "${relativePath}" must be a file`);
}

/* -------------------------------------------- */

const manifestPath = join(root, "module.json");
if (!existsSync(manifestPath)) {
	console.error(`module.json not found in ${root}`);
	process.exit(1);
}

let manifest;
try {
	manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
	console.error(`module.json is not valid JSON: ${error.message}`);
	process.exit(1);
}

for (const key of ["id", "title", "version", "compatibility"]) {
	if (!manifest[key]) errors.push(`module.json: the required key "${key}" is missing`);
}

if (/#\{[A-Z_]+\}#/.test(JSON.stringify(manifest))) {
	errors.push("module.json: an unreplaced #{TOKEN}# placeholder remains");
}

for (const file of manifest.esmodules ?? []) require_(file, "esmodules");
for (const file of manifest.scripts ?? []) require_(file, "scripts");
for (const file of manifest.styles ?? []) require_(file, "styles");
for (const entry of manifest.languages ?? []) require_(entry.path, `languages[${entry.lang}]`);
for (const pack of manifest.packs ?? []) require_(pack.path, `packs[${pack.name}]`, { directory: true });
require_(manifest.license, "license");
require_(manifest.readme, "readme");

/* -------------------------------------------- */
/*  Every language file must carry the same keys */
/* -------------------------------------------- */

const languages = (manifest.languages ?? [])
	.filter((entry) => existsSync(join(root, entry.path)))
	.map((entry) => ({ lang: entry.lang, keys: Object.keys(JSON.parse(readFileSync(join(root, entry.path), "utf8"))) }));

if (languages.length > 1) {
	const [reference, ...rest] = languages;
	const referenceKeys = new Set(reference.keys);
	for (const other of rest) {
		const otherKeys = new Set(other.keys);
		const missing = [...referenceKeys].filter((key) => !otherKeys.has(key));
		const extra = [...otherKeys].filter((key) => !referenceKeys.has(key));
		if (missing.length) errors.push(`languages: ${other.lang} is missing ${missing.length} key(s): ${missing.slice(0, 5).join(", ")}`);
		if (extra.length) errors.push(`languages: ${other.lang} has ${extra.length} key(s) ${reference.lang} lacks: ${extra.slice(0, 5).join(", ")}`);
	}
}

/* -------------------------------------------- */
/*  Every key the code asks for must exist       */
/* -------------------------------------------- */

const firstLanguage = manifest.languages?.[0];
if (firstLanguage && existsSync(join(root, firstLanguage.path))) {
	const known = new Set(Object.keys(JSON.parse(readFileSync(join(root, firstLanguage.path), "utf8"))));
	const used = new Set();
	const pattern = /["'](OP2\.[A-Za-z0-9_.-]+)["']|localize\s+["']?(OP2\.[A-Za-z0-9_.-]+)["']?/g;

	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (/\.(mjs|hbs)$/.test(entry.name)) {
				const text = readFileSync(full, "utf8");
				for (const match of text.matchAll(pattern)) used.add(match[1] ?? match[2]);
			}
		}
	};
	for (const dir of ["scripts", "templates"]) {
		const full = join(root, dir);
		if (existsSync(full)) walk(full);
	}

	const missing = [...used].filter((key) => !known.has(key)).sort();
	if (missing.length) errors.push(`i18n: ${missing.length} key(s) used in code are not defined: ${missing.slice(0, 8).join(", ")}`);
}

/* -------------------------------------------- */

if (errors.length) {
	console.error(`\nManifest validation FAILED for ${manifest.id ?? "?"} in ${root}\n`);
	for (const error of errors) console.error(`  - ${error}`);
	console.error("");
	process.exit(1);
}

console.log(`Manifest OK: ${manifest.id} v${manifest.version} — ${checked.length} declared path(s) present.`);
