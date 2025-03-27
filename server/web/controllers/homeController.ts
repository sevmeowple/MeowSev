class HomeController {
  async index(req: Request) {
    return new Response("Hello, World!");
  }
}

export { HomeController };