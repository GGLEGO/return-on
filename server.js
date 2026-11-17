#!/usr/bin/env node
'use strict';

// 답례 : ON 정적 파일 서버
// 외부 패키지 없이 Node.js 기본 모듈만 사용합니다.
// 실행: node server.js   (포트 변경: PORT=8080 node server.js)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// index.html 이 있는 폴더를 찾는다: server.js 아래 main 폴더, 없으면 server.js 와 같은 폴더.
// 직접 지정하려면 ROOT=/경로 node server.js
const ROOT = [process.env.ROOT, path.join(__dirname, 'main'), __dirname]
  .filter(Boolean)
  .map((dir) => path.resolve(dir))
  .find((dir) => fs.existsSync(path.join(dir, 'index.html')));

if (!ROOT) {
  console.error('index.html 을 찾을 수 없습니다.');
  console.error(`확인한 위치: ${path.join(__dirname, 'main')}, ${__dirname}`);
  console.error('main 폴더(index.html, style.css)를 server.js 옆에 두거나 ROOT=/경로 node server.js 로 실행하세요.');
  process.exit(1);
}

// 페이지 폴더들. /customer/name/ 처럼 폴더 경로 그대로 접속한다.
const PROJECT = path.basename(ROOT) === 'main' ? path.dirname(ROOT) : ROOT;
const PAGE_DIRS = ['main', 'customer', 'seller'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, '허용되지 않는 요청 방식입니다.');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (err) {
    return send(res, 400, '잘못된 요청입니다.');
  }

  // 폴더 주소에 / 가 빠지면 붙여서 다시 보낸다 (상대 경로 style.css 가 깨지지 않도록).
  const first = pathname.split('/')[1];
  if (!pathname.endsWith('/') && !path.extname(pathname)) {
    res.writeHead(301, { Location: encodeURI(pathname + '/') });
    return res.end();
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  // /main/, /customer/, /seller/ 로 시작하면 프로젝트 폴더 기준, 그 외에는 main 폴더 기준.
  const base = PAGE_DIRS.includes(first) ? PROJECT : ROOT;

  // 폴더 밖의 파일(../ 등), 숨김 파일, 서버 소스는 내려주지 않는다.
  const filePath = path.join(base, path.normalize(pathname));
  const relative = path.relative(base, filePath);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).some((part) => part.startsWith('.')) ||
    path.basename(filePath) === 'server.js'
  ) {
    return send(res, 403, '접근할 수 없습니다.');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      console.error(`  404: 파일 없음 -> ${filePath}`);
      return send(res, 404, '페이지를 찾을 수 없습니다.');
    }

    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });

    if (req.method === 'HEAD') return res.end();

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });

  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`포트 ${PORT}가 이미 사용 중입니다. PORT=다른번호 node server.js 로 실행하세요.`);
  } else if (err.code === 'EACCES') {
    console.error(`포트 ${PORT}를 열 권한이 없습니다. 1024 이상의 포트를 사용하세요.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`답례 : ON 서버 실행 중: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`서비스 폴더: ${ROOT}`);
});

// systemd, pm2, Ctrl+C 종료 신호를 받으면 정상 종료한다.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
