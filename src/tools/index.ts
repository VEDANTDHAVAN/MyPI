import { Tool } from "../types.ts";
import { bashTool } from "./bash.ts";
import { deleteTool } from "./delete.ts";
import { editTool } from "./edit.ts";
import { findTool } from "./find.ts";
import { grepTool } from "./grep.ts";
import { listTool } from "./list.ts";
import { readTool } from "./read.ts";
import { searchTool } from "./search.ts";
import { statsTool } from "./stats.ts";
import { writeTool } from "./write.ts";

export const tools: Tool[] = [
  readTool,
  writeTool,
  editTool,
  deleteTool,
  listTool,
  statsTool,
  findTool,
  searchTool,
  grepTool,
  bashTool,
];
