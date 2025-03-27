import type { Middleware, RouteHandler } from "@/type";
import { methodGuard } from "@web/middleware/methodGuard";

export class Router {
  private routes = new Map<
    string,
    { handler: RouteHandler; middlewares: Middleware[] }
  >();

  getHandler(method: string, path: string) {
    return this.routes.get(`${method}:${path}`);
  }

  get(path: string, handler: RouteHandler, ...middlewares: Middleware[]) {
    this.routes.set(`GET:${path}`, {
      handler,
      middlewares: [methodGuard("GET"), ...middlewares],
    });
  }

  post(path: string, handler: RouteHandler, ...middlewares: Middleware[]) {
    this.routes.set(`POST:${path}`, {
      handler,
      middlewares: [methodGuard("POST"), ...middlewares],
    });
  }
}

const router = new Router();

export { router };
