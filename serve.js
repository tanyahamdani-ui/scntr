// Server statis kecil untuk pratinjau lokal: node serve.js [port]
const http = require("http"), fs = require("fs"), path = require("path");
const root = __dirname, port = Number(process.argv[2] || 4173);
const types = {".html":"text/html; charset=utf-8",".jpg":"image/jpeg",".png":"image/png",".css":"text/css",".js":"text/javascript"};
http.createServer((req,res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(root, rel === "/" ? "index.html" : rel);
  if(!file.startsWith(root)){ res.writeHead(403).end("forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if(err){ res.writeHead(404, {"content-type":"text/plain"}).end("404"); return; }
    res.writeHead(200, {"content-type": types[path.extname(file)] || "application/octet-stream"});
    res.end(buf);
  });
}).listen(port, () => console.log("http://localhost:" + port));
