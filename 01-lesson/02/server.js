import { createServer } from 'node:http';

const port = Number(process.env.PORT) || 3000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method Not Allowed' });
    return;
  }

  switch (requestUrl.pathname) {
    case '/':
      sendJson(response, 200, {
        message: 'Welcome to vanilla Node.js backend!',
      });
      break;

    case '/hello':
      sendJson(response, 200, {
        message: 'Hello from vanilla Node.js backend!',
      });
      break;

    case '/time':
      sendJson(response, 200, {
        currentTime: new Date().toISOString(),
      });
      break;

    case '/status':
      sendJson(response, 200, {
        status: 'ok',
        message: 'Server is running',
      });
      break;

    default:
      sendJson(response, 404, {
        error: 'Route Not Found',
      });
  }
});

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
