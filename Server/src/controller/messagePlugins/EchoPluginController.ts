import { BasePluginController, PluginResult } from './BasePluginController'

export class EchoPluginController extends BasePluginController {
  headers = ['echo', 'repeat']

  async handle(sessionData: any): Promise<PluginResult> {
    const content = sessionData?.content ?? ''
    return {
      shouldReply: true,
      data: { type: 'text', content: `Echo: ${content}` }
    }
  }
}