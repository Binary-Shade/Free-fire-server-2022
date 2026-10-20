'use strict';
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','data','bot-settings.json');
const defaults={opponents:4,difficulty:'normal',purchasing:true,cover:true,reviving:true,gloo:true};
function read(){try{return {...defaults,...JSON.parse(fs.readFileSync(file,'utf8'))};}catch(e){if(e.code==='ENOENT')return {...defaults};throw e;}}
function save(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Settings must be an object');
 if(!Number.isInteger(value.opponents)||value.opponents<1||value.opponents>4)throw new Error('Opponent count must be 1–4');
 if(!['easy','normal','hard'].includes(value.difficulty))throw new Error('Choose easy, normal, or hard');
 const result={opponents:value.opponents,difficulty:value.difficulty};
 for(const key of ['purchasing','cover','reviving','gloo']){if(typeof value[key]!=='boolean')throw new Error(`${key} must be true or false`);result[key]=value[key];}
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(result,null,2));fs.renameSync(file+'.tmp',file);return result;
}
function geometry(){try{const g=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'bot-geometry.json'),'utf8'));return {available:true,map:g.map,colliders:g.obstacles.length,stats:g.stats};}catch{return {available:false};}}
module.exports={read,save,geometry};
