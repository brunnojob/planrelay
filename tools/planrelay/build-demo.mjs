import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const out = new URL('../../docs/planrelay-demo/', import.meta.url);
mkdirSync(out, {recursive:true});
for(const name of ['app.mjs','style.css'])copyFileSync(new URL(`./public/${name}`,import.meta.url),new URL(name,out));
copyFileSync(new URL('./core.mjs',import.meta.url),new URL('core.mjs',out));
writeFileSync(new URL('index.html',out),readFileSync(new URL('./public/index.html',import.meta.url),'utf8').replace('<html lang="en" data-theme="dark">','<html lang="en" data-theme="dark" data-demo="true">'));
console.log('Browser demo built in docs/planrelay-demo/');
