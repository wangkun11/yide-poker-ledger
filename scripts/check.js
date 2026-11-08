const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let count=0;
function walk(dir){for(const name of fs.readdirSync(dir)){if(name==='.git'||name==='node_modules')continue;const file=path.join(dir,name);if(fs.statSync(file).isDirectory())walk(file);else if(file.endsWith('.json')){JSON.parse(fs.readFileSync(file,'utf8'));count++;}else if(file.endsWith('.js')){new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});count++;}}}
walk(root);
const pageSource=fs.readFileSync(path.join(root,'miniprogram/pages/index/index.js'),'utf8');let page;
vm.runInNewContext(pageSource,{require:()=>({}),Page:p=>page=p});
const wxml=fs.readFileSync(path.join(root,'miniprogram/pages/index/index.wxml'),'utf8');
for(const match of wxml.matchAll(/(?:bind|catch)(?:tap|blur|input|change)="([^"]+)"/g))assert.equal(typeof page[match[1]],'function','缺少事件处理器 '+match[1]);
const runtime=path.join(root,'miniprogram');function offline(dir){for(const name of fs.readdirSync(dir)){const f=path.join(dir,name);if(fs.statSync(f).isDirectory())offline(f);else if(/\.(js|json|wxml)$/.test(f))assert.ok(!/wx\.cloud|wx\.request\s*\(|wx\.login\s*\(|envId|cloud1-/.test(fs.readFileSync(f,'utf8')),'正式包含远程依赖 '+f);}}offline(runtime);assert.ok(!JSON.parse(fs.readFileSync(path.join(root,'project.config.json'))).cloudfunctionRoot);
console.log(`通过 ${count} 个 JS/JSON 文件检查、WXML 事件绑定检查、正式包无网络依赖检查。`);
