import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";

function lanIp() {
  const nets = networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const net of addrs ?? []) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (v4 && !net.internal) return net.address;
    }
  }
  return null;
}

const port = process.env.PORT || "3000";
const ip = lanIp();

console.log("");
console.log("  ▲ Órale AI web");
console.log(`  - Local:    http://localhost:${port}`);
if (ip) {
  console.log(`  - Celular:  http://${ip}:${port}`);
} else {
  console.log("  - Celular:  (no hay IP de red)");
}
console.log("");

const child = spawn(
  "npx",
  ["next", "dev", "-H", "0.0.0.0", "-p", String(port)],
  { stdio: "inherit", shell: true },
);

child.on("exit", (code) => process.exit(code ?? 0));
