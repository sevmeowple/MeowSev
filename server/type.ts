interface AppConfig {
  port: number | string;
  //   db: {
  //     host: string;
  //     port: number;
  //     user: string;
  //     password: string;
  //     database: string;
  //   };
}

interface BotResponse {
  type: "string" | "md" | "image" | "none" | "quote" | "at";
  content: string;
}

interface RouteHandler {
  (req: Request): Promise<Response>;
}

interface Middleware {
  (req: Request, next: () => Promise<Response>): Promise<Response>;
}

export type { AppConfig, BotResponse, RouteHandler, Middleware };
