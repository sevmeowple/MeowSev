const errorHandler = async (err: Error, req: Request) => {
  console.error(`Error: ${err.message}`);
  return new Response("Internal Server Error", { status: 500 });
};

export { errorHandler };
