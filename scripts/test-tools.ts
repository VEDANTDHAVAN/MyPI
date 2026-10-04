import { readTool } from "../src/tools/read.ts";
import { writeTool } from "../src/tools/write.ts";
import { editTool } from "../src/tools/edit.ts";
import { deleteTool } from "../src/tools/delete.ts";
import { listTool } from "../src/tools/list.ts";
import { statsTool } from "../src/tools/stats.ts";
import { bashTool } from "../src/tools/bash.ts";
import { findTool } from "../src/tools/find.ts";
import { searchTool } from "../src/tools/search.ts";
import { grepTool } from "../src/tools/grep.ts";

function section(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

const TMP = "scripts/.tmp-test";

async function main() {
  await section("cleanup tmp dir");
  console.log(await deleteTool.execute({ path: TMP, recursive: true }));

  await section("write tests");
  console.log("--- write a simple file ---");
  console.log(
    await writeTool.execute({
      path: `${TMP}/hello.txt`,
      content: "hello world\nsecond line\n",
    })
  );

  console.log("--- write nested file (auto mkdir) ---");
  console.log(
    await writeTool.execute({
      path: `${TMP}/nested/deep/file.txt`,
      content: "deep content",
    })
  );

  await section("read tests");
  console.log("--- read hello.txt ---");
  console.log(await readTool.execute({ path: `${TMP}/hello.txt` }));

  console.log("--- read missing file (should throw) ---");
  try {
    await readTool.execute({ path: `${TMP}/missing.txt` });
  } catch (e) {
    console.log("error:", e instanceof Error ? e.message : String(e));
  }

  await section("edit tests");
  console.log("--- replace first occurrence ---");
  console.log(
    await editTool.execute({
      path: `${TMP}/hello.txt`,
      oldString: "hello",
      newString: "hi",
    })
  );
  console.log("after edit:", await readTool.execute({ path: `${TMP}/hello.txt` }));

  console.log("--- replace all occurrences ---");
  await writeTool.execute({
    path: `${TMP}/repeat.txt`,
    content: "foo foo foo",
  });
  console.log(
    await editTool.execute({
      path: `${TMP}/repeat.txt`,
      oldString: "foo",
      newString: "bar",
      all: true,
    })
  );
  console.log("after edit:", await readTool.execute({ path: `${TMP}/repeat.txt` }));

  console.log("--- edit missing oldString (should return error) ---");
  console.log(
    await editTool.execute({
      path: `${TMP}/hello.txt`,
      oldString: "nonexistent",
      newString: "x",
    })
  );

  console.log("--- replace oldString containing regex special chars ---");
  await writeTool.execute({
    path: `${TMP}/special.txt`,
    content: "a.b*c?d[e]f",
  });
  console.log(
    await editTool.execute({
      path: `${TMP}/special.txt`,
      oldString: "a.b*c?d[e]f",
      newString: "replaced",
      all: true,
    })
  );
  console.log("after edit:", await readTool.execute({ path: `${TMP}/special.txt` }));

  await section("list tests");
  console.log("--- list tmp dir non-recursive ---");
  console.log(await listTool.execute({ path: TMP }));

  console.log("--- list tmp dir recursive ---");
  console.log(await listTool.execute({ path: TMP, recursive: true }));

  await section("stats tests");
  console.log("--- stats on hello.txt ---");
  console.log(await statsTool.execute({ path: `${TMP}/hello.txt` }));

  console.log("--- stats on missing file ---");
  console.log(await statsTool.execute({ path: `${TMP}/missing.txt` }));

  await section("find tests");
  console.log("--- contains 'utils' in src ---");
  console.log(await findTool.execute({ path: "src", name: "utils", mode: "contains" }));

  console.log("--- exact 'utils.ts' in src ---");
  console.log(await findTool.execute({ path: "src", name: "utils.ts", mode: "exact" }));

  console.log("--- glob '*.ts' in src ---");
  console.log(await findTool.execute({ path: "src", name: "*.ts", mode: "glob" }));

  console.log("--- glob 'tools/*.ts' in src ---");
  console.log(await findTool.execute({ path: "src", name: "tools/*.ts", mode: "glob" }));

  await section("search tests");
  console.log("--- literal 'escapeRegExp' in src ---");
  console.log(await searchTool.execute({ path: "src", query: "escapeRegExp" }));

  console.log("--- regex 'async execute' in src ---");
  console.log(await searchTool.execute({ path: "src", query: "async execute", regex: true }));

  console.log("--- literal '.' in src (should match dots, not everything) ---");
  console.log(await searchTool.execute({ path: "src", query: "." }));

  console.log("--- 'Tool' with glob '*.ts' in src ---");
  console.log(await searchTool.execute({ path: "src", query: "Tool", glob: "*.ts" }));

  await section("grep tests");
  console.log("--- grep 'export const' in src/tools/*.ts ---");
  console.log(await grepTool.execute({ path: "src", query: "export const", glob: "tools/*.ts" }));

  console.log("--- grep 'readFile' in src ---");
  console.log(await grepTool.execute({ path: "src", query: "readFile" }));

  await section("bash tests");
  console.log("--- echo hello ---");
  console.log(await bashTool.execute({ command: "echo hello" }));

  console.log("--- exit code 1 ---");
  console.log(await bashTool.execute({ command: "exit 1" }));

  console.log("--- stderr ---");
  console.log(await bashTool.execute({ command: "echo error >&2" }));

  console.log("--- timeout ---");
  console.log(await bashTool.execute({ command: "sleep 5", timeout: 1 }));

  await section("delete tests");
  console.log("--- delete nested dir recursively ---");
  console.log(await deleteTool.execute({ path: `${TMP}/nested`, recursive: true }));

  console.log("--- delete tmp dir recursively ---");
  console.log(await deleteTool.execute({ path: TMP, recursive: true }));

  console.log("--- list tmp dir after deletion ---");
  console.log(await listTool.execute({ path: TMP }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
