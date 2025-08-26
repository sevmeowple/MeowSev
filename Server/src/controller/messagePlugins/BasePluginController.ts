import { Context } from 'koa'

export interface PluginResult {
  shouldReply: boolean
  data: any
}

export abstract class BasePluginController {
  abstract headers: string[]

  abstract handle(ctx: Context): Promise<PluginResult>
}