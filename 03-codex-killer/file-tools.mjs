import { constants } from "node:fs";
import { lstat, mkdir, open, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "workspace");
const maxFileBytes = 256 * 1024;
const noFollowFlag = constants.O_NOFOLLOW ?? 0;
const decoder = new TextDecoder("utf-8", { fatal: true });

class FileToolError extends Error {}

export const fileTools = [
  {
    type: "function",
    name: "create_file",
    description:
      "Create a new UTF-8 text file inside workspace/. Paths are relative to workspace/; do not include the workspace/ prefix. Existing files are never overwritten.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative file path such as notes/todo.txt.",
        },
        content: {
          type: "string",
          description: "Complete UTF-8 text content for the new file.",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "read_file",
    description:
      "Read a UTF-8 text file inside workspace/. Paths are relative to workspace/; do not include the workspace/ prefix. Files larger than 256 KiB and symbolic links cannot be read.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative file path such as notes/todo.txt.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function fail(message) {
  throw new FileToolError(message);
}

function resolveWorkspacePath(requestedPath) {
  if (typeof requestedPath !== "string" || !requestedPath.trim()) {
    fail("Укажи относительный путь к файлу внутри workspace/.");
  }

  const normalizedInput = requestedPath.trim();
  if (
    normalizedInput.includes("\0") ||
    normalizedInput.includes("\\") ||
    normalizedInput.includes(":") ||
    isAbsolute(normalizedInput) ||
    win32.isAbsolute(normalizedInput)
  ) {
    fail("Разрешены только относительные пути внутри workspace/.");
  }

  const segments = normalizedInput.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    fail("Путь не должен содержать пустые сегменты, . или .. .");
  }

  const absolutePath = resolve(workspaceRoot, ...segments);
  const pathFromWorkspace = relative(workspaceRoot, absolutePath);
  if (
    !pathFromWorkspace ||
    pathFromWorkspace === ".." ||
    pathFromWorkspace.startsWith(`..${sep}`) ||
    isAbsolute(pathFromWorkspace)
  ) {
    fail("Путь выходит за пределы workspace/.");
  }

  return {
    absolutePath,
    relativePath: segments.join("/"),
    segments,
  };
}

async function assertDirectory(directoryPath) {
  const stats = await lstat(directoryPath);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail("Операции разрешены только в обычных папках внутри workspace/.");
  }
}

async function prepareParentDirectories(segments) {
  try {
    await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
    await assertDirectory(workspaceRoot);

    let currentPath = workspaceRoot;
    for (const segment of segments.slice(0, -1)) {
      currentPath = join(currentPath, segment);
      try {
        await mkdir(currentPath, { mode: 0o700 });
      } catch (error) {
        if (error?.code !== "EEXIST") {
          throw error;
        }
      }
      await assertDirectory(currentPath);
    }
  } catch (error) {
    if (error instanceof FileToolError) {
      throw error;
    }
    fail("Не удалось подготовить папки внутри workspace/.");
  }
}

async function createFile(args) {
  if (!args || typeof args !== "object" || typeof args.content !== "string") {
    fail("Для создания файла нужны путь и текстовое содержимое.");
  }

  if (args.content.includes("\0")) {
    fail("Содержимое файла должно быть обычным текстом.");
  }

  const contentBytes = Buffer.byteLength(args.content, "utf8");
  if (contentBytes > maxFileBytes) {
    fail("Размер нового файла не должен превышать 256 KiB.");
  }

  const file = resolveWorkspacePath(args.path);
  await prepareParentDirectories(file.segments);

  let handle;
  try {
    handle = await open(
      file.absolutePath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowFlag,
      0o600,
    );
    await handle.writeFile(args.content, { encoding: "utf8" });
    await handle.close();
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
      await unlink(file.absolutePath).catch(() => {});
    }

    if (error?.code === "EEXIST") {
      fail(`Файл workspace/${file.relativePath} уже существует; перезапись запрещена.`);
    }
    if (error instanceof FileToolError) {
      throw error;
    }
    fail(`Не удалось создать файл workspace/${file.relativePath}.`);
  }

  return {
    path: `workspace/${file.relativePath}`,
    created: true,
    sizeBytes: contentBytes,
  };
}

async function readFile(args) {
  if (!args || typeof args !== "object") {
    fail("Для чтения файла нужен относительный путь.");
  }

  const file = resolveWorkspacePath(args.path);
  await prepareParentDirectories(file.segments);

  let handle;
  try {
    const beforeOpen = await lstat(file.absolutePath);
    if (beforeOpen.isSymbolicLink()) {
      fail("Символические ссылки читать нельзя.");
    }
    if (!beforeOpen.isFile()) {
      fail("Можно читать только обычные текстовые файлы.");
    }
    if (beforeOpen.size > maxFileBytes) {
      fail("Размер файла превышает лимит чтения 256 KiB.");
    }

    handle = await open(file.absolutePath, constants.O_RDONLY | noFollowFlag);
    const openedFile = await handle.stat();
    if (!openedFile.isFile()) {
      fail("Можно читать только обычные текстовые файлы.");
    }
    if (openedFile.size > maxFileBytes) {
      fail("Размер файла превышает лимит чтения 256 KiB.");
    }

    const contentBuffer = await handle.readFile();
    if (contentBuffer.byteLength > maxFileBytes) {
      fail("Размер файла превышает лимит чтения 256 KiB.");
    }
    if (contentBuffer.includes(0)) {
      fail("Файл не является обычным текстовым файлом.");
    }

    const content = decoder.decode(contentBuffer);
    await handle.close();
    return {
      path: `workspace/${file.relativePath}`,
      content,
      sizeBytes: contentBuffer.byteLength,
    };
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    if (error instanceof FileToolError) {
      throw error;
    }
    if (error?.code === "ENOENT") {
      fail(`Файл workspace/${file.relativePath} не найден.`);
    }
    if (error?.code === "ELOOP") {
      fail("Символические ссылки читать нельзя.");
    }
    fail(`Не удалось прочитать файл workspace/${file.relativePath}.`);
  }
}

export async function executeFileTool(name, args) {
  if (name === "create_file") {
    return createFile(args);
  }
  if (name === "read_file") {
    return readFile(args);
  }

  fail(`Инструмент ${name} не поддерживается.`);
}
