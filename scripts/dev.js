import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const frontendRoot = path.join(projectRoot, "FrontEnd");
const backendRoot = path.join(projectRoot, "BackEnd");
const frontendPort = 5500;

const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
};

function serveFrontend(request, response) {
	const requestPath = decodeURIComponent(request.url.split("?")[0]);
	const relativePath = requestPath === "/" ? "/Index.html" : requestPath;
	const filePath = path.resolve(frontendRoot, `.${relativePath}`);

	if (!filePath.startsWith(frontendRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
		response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Archivo no encontrado");
		return;
	}

	response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
	createReadStream(filePath).pipe(response);
}

const frontendServer = createServer(serveFrontend).listen(frontendPort, () => {
	console.log(`Frontend: http://localhost:${frontendPort}`);
	console.log(`Admin:    http://localhost:${frontendPort}/admin.html`);
});

const seedProcess = spawn(process.execPath, ["seed-barbers.js"], {
	cwd: backendRoot,
	stdio: "inherit",
});

seedProcess.on("close", (exitCode) => {
	if (exitCode !== 0) {
		console.error("No se pudieron cargar los barberos de prueba.");
		process.exitCode = exitCode;
		return;
	}

	const backendProcess = spawn(process.execPath, ["--watch", "server.js"], {
		cwd: backendRoot,
		stdio: "inherit",
		 shell: false,
	});

	const stop = () => {
		backendProcess.kill();
		frontendServer.close();
	};

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	backendProcess.on("close", (backendExitCode) => {
		frontendServer.close();
		process.exitCode = backendExitCode ?? 0;
	});
});