import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const memoryDirectory = join(dirname(fileURLToPath(import.meta.url)), "memory");

async function writeSessionFile(filePath, session) {
  const temporaryPath = `${filePath}.tmp`;

  try {
    await writeFile(temporaryPath, `${JSON.stringify(session, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
  } catch {
    await unlink(temporaryPath).catch(() => {});
    throw new Error("Не удалось сохранить переписку в папку memory.");
  }
}

export async function createMemorySession() {
  await mkdir(memoryDirectory, { recursive: true, mode: 0o700 });

  const createdAt = new Date().toISOString();
  const id = `session-${createdAt.replace(/[:.]/g, "-")}-${randomUUID()}`;
  const fileName = `${id}.json`;
  const filePath = join(memoryDirectory, fileName);
  const session = {
    id,
    createdAt,
    updatedAt: createdAt,
    messages: [],
  };

  const save = async () => {
    session.updatedAt = new Date().toISOString();
    await writeSessionFile(filePath, session);
  };

  await save();

  return {
    id,
    fileName,
    messages: session.messages,
    save,
  };
}
