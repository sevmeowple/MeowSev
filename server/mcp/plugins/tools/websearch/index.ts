import type { Tool, ToolParameters } from "fastmcp";
import { type } from "arktype";
import axios from 'axios';
import * as cheerio from 'cheerio';
import { M3LogWrapper } from "@utils/m3log";

interface SearchResult {
    title: string;
    url: string;
    description: string;
}

class WebSearchTool {
    logger:M3LogWrapper = new M3LogWrapper(["WebSearchTool"],false,true);
    private async searchResultsToMarkdown(results: SearchResult[]): Promise<string> { 
        return results.map((result) => {
            return `### [${result.title}](${result.url})\n\n${result.description}\n`;
        }).join('\n');
    }

    async performSearch(query: string): Promise<string> {
        const limit = 5;
        const response = await axios.get('https://www.google.com/search', {
            params: { q: query },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const results: SearchResult[] = [];

        $('div.g').each((i, element) => {
            if (i >= limit) return false;

            const titleElement = $(element).find('h3');
            const linkElement = $(element).find('a');
            const snippetElement = $(element).find('.VwiC3b');

            if (titleElement.length && linkElement.length) {
                const url = linkElement.attr('href');
                if (url && url.startsWith('http')) {
                    results.push({
                        title: titleElement.text(),
                        url: url,
                        description: snippetElement.text() || '',
                    });
                }
            }
        });

        return this.searchResultsToMarkdown(results);
    }
}

const webSearchTool = new WebSearchTool();

const webSearchToolSchema: Tool<undefined, ToolParameters> = {
    name: "search",
    description: "Search the web using Google",
    parameters: type({
        query: "string",
    }),
    execute: async (args: any) => {
        try {
            const results = await webSearchTool.performSearch(args.query);
            return results;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                webSearchTool.logger.error(error.message);
            }
            throw error;
        }
    }
};

export { webSearchToolSchema };