const http = require("http"), fs = require("fs"), path = require("path");
const root = __dirname;
http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  const f = path.join(root, u === "/" ? "archery-single.html" : decodeURIComponent(u));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    res.end(d);
  });
}).listen(8860, "127.0.0.1", () => console.log("QA5 on 8860"));
