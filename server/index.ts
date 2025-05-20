import { FastMCP } from "fastmcp"
import * as tools from "@mcp/plugins/tools"
const server = new FastMCP({
    name: "MeowJiang",
    version: "1.0.0",
})

server.addTool(
    tools.timeToolSchema
)
server.addTool(
    tools.arkMemoSchema
)
server.addTool(
    tools.webSearchToolSchema
)
server.addTool(
    tools.githubToolSchema
)
// server.addTool(
//     tools.arkMemoMainStorySchema
// )
server.start(
    {
        transportType: "stdio"
    }
)