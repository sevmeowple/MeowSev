import type { ToolDefinition } from "..";
import { picTool } from "./pic";
import { picAltTool } from "./picAlt";
import { weatherTool } from "./weather";
import { weatherAltTool } from "./weatherAlt";
import { rogueItemSearchTool } from "./rogueItems";
import { memeTool } from "./meme";
import { chronicleSearchTool, chronicleUserHistoryTool, chronicleUserSearchTool } from "./chronicle";
import { createReservationTool, listReservationsTool, getReservationDetailTool } from "./reservation";
import { getUserProfileTool, searchUserMemoryTool } from "./profile";
import { searchRecentMessagesTool } from "./contextSearch";
import { kimiSearchTool, kimiFetchTool } from "./kimiSearch";

/**
 * 中央工具注册表
 * 使用稳定别名 key 索引所有工具，解决同名冲突问题
 */
const toolRegistry: Record<string, ToolDefinition> = {
    searchImage: picAltTool,
    getWeather: weatherAltTool,
    searchImageOG: picTool,
    getWeatherOG: weatherTool,
    searchRogueItem: rogueItemSearchTool,
    sendMeme: memeTool,
    chronicleSearch: chronicleSearchTool,
    chronicleUserHistory: chronicleUserHistoryTool,
    chronicleUserSearch: chronicleUserSearchTool,
    createReservation: createReservationTool,
    listReservations: listReservationsTool,
    getReservationDetail: getReservationDetailTool,
    getUserProfile: getUserProfileTool,
    searchUserMemory: searchUserMemoryTool,
    searchRecentMessages: searchRecentMessagesTool,
    kimiSearch: kimiSearchTool,
    kimiFetch: kimiFetchTool,
};

export function getToolsByNames(names: string[]): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const name of names) {
        const t = toolRegistry[name];
        if (t) {
            tools.push(t);
        } else {
            console.warn(`⚠️ ToolRegistry: 未找到工具 "${name}"`);
        }
    }
    return tools;
}

export function getAvailableToolNames(): string[] {
    return Object.keys(toolRegistry);
}
