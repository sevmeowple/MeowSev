import type { Tool, ToolParameters } from "fastmcp";
import { type } from "arktype";
class TimeTool {
    getTime(): string {
        return new Date().toLocaleString();
    }
}
const timeTool = new TimeTool();
const timeToolSchema: Tool<undefined, ToolParameters> = {
    name: "time",
    description: "Get the current time",
    parameters: type({}),
    execute: async () => {
        return timeTool.getTime();
    }
};

export { timeToolSchema }