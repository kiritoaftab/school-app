import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

async function main() {
  await prisma.$connect();
  console.log("✅ Database connected");

  const server = createApp().listen(config.port, () => {
    console.log(
      `🌳 Greenwood API listening on http://localhost:${config.port}`,
    );
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
