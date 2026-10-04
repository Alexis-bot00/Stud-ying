const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../STUDYante-App/dist/render-phase5');
const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.css':'text/css','.ttf':'font/ttf','.woff':'font/woff','.json':'application/json','.mp3':'audio/mpeg'};
http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(pathname!=='/'&&!/^\/(assets|_expo)\//.test(pathname)){res.writeHead(404).end();return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
}).listen(4174,'127.0.0.1');
