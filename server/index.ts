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
    tools.arkToolSchema
)

server.start(
    {
        transportType: "stdio"
    }
)