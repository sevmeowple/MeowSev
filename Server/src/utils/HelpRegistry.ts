import { tsxToPic } from "./plugin/browser/tsxToPic";
import { HelpCard } from "../view/HelpCard";

export interface HelpEntry {
    command: string;       // Command name (e.g., "meme")
    description: string;   // Short description for the main menu
    usage?: string;        // Usage syntax (e.g., "meme [category]")
    examples?: string[];   // Usage examples
    details?: string;      // Detailed description
}

export class HelpRegistry {
    private static entries: Map<string, HelpEntry> = new Map();

    /**
     * Register a help entry
     */
    static register(entry: HelpEntry) {
        this.entries.set(entry.command, entry);
    }

    /**
     * Get a specific help entry
     */
    static get(command: string): HelpEntry | undefined {
        return this.entries.get(command);
    }

    /**
     * Get all registered entries
     */
    static getAll(): HelpEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Generate help image
     */
    static async getHelpImage(command?: string): Promise<string> {
        if (command) {
            const entry = this.get(command);
            if (!entry) {
                // If command not found, return menu
                return this.getHelpImage(); 
            }
            return await tsxToPic(HelpCard, {
                type: 'detail',
                data: entry
            }, {
                outputFileName: `help_${command}`,
                width: 1000,
                height: 800
            });
        } else {
            const sortedEntries = Array.from(this.entries.values()).sort((a, b) => a.command.localeCompare(b.command));
            return await tsxToPic(HelpCard, {
                type: 'menu',
                data: sortedEntries
            }, {
                outputFileName: `help_menu`,
                width: 1200,
                // Dynamic height calculation: Header(300) + Rows * RowHeight + Footer(200)
                height: Math.max(800, Math.ceil(sortedEntries.length / 2) * 250 + 500)
            });
        }
    }

    /**
     * Generate the main help menu
     */
    static generateMenu(): string {
        let menu = "📋 喵喵功能菜单\n================\n";
        
        // Sort by command name
        const sortedEntries = Array.from(this.entries.values()).sort((a, b) => a.command.localeCompare(b.command));
        
        sortedEntries.forEach(entry => {
            menu += `• ${entry.command.padEnd(10, ' ')} - ${entry.description}\n`;
        });
        
        menu += "\n💡 发送 'help [命令]' 查看详细说明\n";
        menu += "例如: help meme";
        return menu;
    }

    /**
     * Generate detailed help for a specific command
     */
    static generateDetail(command: string): string {
        const entry = this.get(command);
        if (!entry) return `❌ 未找到命令 '${command}' 的帮助信息`;

        let detail = `📖 ${entry.command} 使用说明\n`;
        detail += `----------------\n`;
        detail += `${entry.description}\n\n`;
        
        if (entry.usage) {
            detail += `📝 用法:\n${entry.usage}\n`;
        }
        
        if (entry.examples && entry.examples.length > 0) {
            detail += `\n🌰 示例:\n`;
            entry.examples.forEach(ex => {
                detail += `> ${ex}\n`;
            });
        }

        if (entry.details) {
            detail += `\n📄 详细说明:\n${entry.details}`;
        }

        return detail;
    }
}