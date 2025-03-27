export const methodGuard = (method: string) => {
  return async (req: Request, next: () => Promise<Response>) => {
    if (req.method !== method.toUpperCase()) {
      return new Response("Method not allowed", { status: 405 });
    }
    return next();
  };
};
