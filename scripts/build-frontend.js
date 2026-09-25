import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const frontendRoot = path.join(projectRoot, "FrontEnd");
const outputRoot = path.join(frontendRoot, "dist");
const apiBaseUrl = (process.env.FRONTEND_API_BASE_URL || "http://localhost:3000/api").replace(/\/+$/, "");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const entry of await readdir(frontendRoot)) {
	if (entry === "dist") {
		continue;
	}

	await cp(path.join(frontendRoot, entry), path.join(outputRoot, entry), { recursive: true });
}

for (const pageName of ["Index.html", "admin.html"]) {
	const pagePath = path.join(outputRoot, pageName);
	const page = await readFile(pagePath, "utf8");
	const configuredPage = page.replaceAll("__FRONTEND_API_BASE_URL__", apiBaseUrl);
	await writeFile(pagePath, configuredPage);
}

console.log(`Frontend construido en ${path.relative(projectRoot, outputRoot)}`);
console.log(`API configurada: ${apiBaseUrl}`);