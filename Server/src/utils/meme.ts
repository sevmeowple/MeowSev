export interface Meme {
    id: string;
    name: string;
    filePath: string;
    description: string;
    keywords?: string[];
    category?: string;
    allowAI?: boolean;
}

export interface MemeCollection {
    memes: Meme[];
}