// server.mjs
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';

const options = {
  key: readFileSync('projectApp/certs/server.key'),
  cert: readFileSync('projectApp/certs/server.crt')
};

// Function to log requests
function logRequest(req, statusCode, error = null) {
  const timestamp = new Date().toISOString();
  const log = `[${timestamp}] ${req.method} ${req.url} - ${statusCode}${error ? ' - Error: ' + error : ''}`;
  console.log(log);
}

// Function to proxy requests to the FastAPI backend
function proxyRequest(clientReq, clientRes) {
  const options = {
    hostname: '127.0.0.1',
    port: 8000,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers
  };

  const proxyReq = request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
    logRequest(clientReq, proxyRes.statusCode);
  });

  clientReq.pipe(proxyReq, { end: true });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    clientRes.writeHead(502);
    clientRes.end('Proxy error - Backend service may be unavailable');
    logRequest(clientReq, 502, err.message);
  });
}

const server = createServer(options, proxyRequest);

// Add error handling for the HTTPS server
server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error('Port 3000 is already in use. Please free up the port and try again.');
  }
});

// starts a secure https server locally on port 3000
server.listen(3000, '127.0.0.1', () => {
  console.log('🔒 HTTPS Proxy listening on https://127.0.0.1:3000');
  console.log('⮕ Proxying requests to http://127.0.0.1:8000');
  console.log('📝 API Documentation available at https://127.0.0.1:3000/docs');
});

// run with `node server.mjs`
