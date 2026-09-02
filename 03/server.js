import Fastify from 'fastify';

const port = Number(process.env.PORT) || 3000;
const app = Fastify({ logger: true });

async function handleRequest(request, reply) {
  if (request.method !== 'GET') {
    return reply.code(405).send({ error: 'Method Not Allowed' });
  }

  const requestUrl = new URL(request.url, 'http://localhost');

  switch (requestUrl.pathname) {
    case '/':
      return reply.code(200).send({
        message: 'Welcome to Fastify backend!',
      });

    case '/hello':
      return reply.code(200).send({
        message: 'Hello from Fastify backend!',
      });

    case '/time':
      return reply.code(200).send({
        currentTime: new Date().toISOString(),
      });

    case '/status':
      return reply.code(200).send({
        status: 'ok',
        message: 'Server is running',
      });

    default:
      return reply.code(404).send({
        error: 'Route Not Found',
      });
  }
}

app.all('/', handleRequest);
app.all('/*', handleRequest);

try {
  await app.listen({ port });
  console.log(`Server is running at http://localhost:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
