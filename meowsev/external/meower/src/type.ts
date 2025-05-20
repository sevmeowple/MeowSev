interface BotResponse {
  type: "string" | "md" | "image" | "quote";
  content: string;
}

export type { BotResponse };
