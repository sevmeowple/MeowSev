export class RouteRegistry {
  private static routes = new Set<string>();

  // 注册路由
  static register(route: string) {
    this.routes.add(route);
  }

  // 检查路由是否存在
  static exists(route: string): boolean {
    return this.routes.has(route);
  }

  // 获取所有注册的路由
  static getAll(): string[] {
    return Array.from(this.routes);
  }

  // 批量注册路由
  static registerBatch(routes: string[]) {
    routes.forEach(route => this.register(route));
  }
}
// export const routeRegistry = new RouteRegistry();