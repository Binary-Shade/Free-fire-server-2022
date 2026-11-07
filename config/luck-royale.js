'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'data', 'luck-royale.json');
const defaults = { enabled:true, chestId:88, chestSubId:4614, name:'Luck Royale', coinType:2, singlePrice:60, multiPrice:540, freeIntervalSeconds:86400, pityDraws:50, startTime:1577836800, endTime:2082758399,
  pool:[
    {itemId:203000181,quantity:1,weight:1,rarity:3,jackpot:true,duplicateItemId:800000100,duplicateQuantity:10},
    {itemId:101000001,quantity:1,weight:6,rarity:2},{itemId:101000002,quantity:1,weight:8,rarity:1},
    {itemId:101000003,quantity:1,weight:10,rarity:1},{itemId:101000004,quantity:1,weight:12,rarity:1},
    {itemId:102000001,quantity:1,weight:14,rarity:1},{itemId:102000002,quantity:1,weight:18,rarity:0},
    {itemId:102000003,quantity:1,weight:20,rarity:0}],
  milestones:[{id:1,draws:10,itemId:203000092,quantity:1},{id:2,draws:50,itemId:907000010,quantity:1}] };
function integer(v,n,min,max){const x=Number(v);if(!Number.isInteger(x)||x<min||x>max)throw new Error(`${n} must be an integer from ${min} to ${max}`);return x;}
function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Luck Royale settings must be an object');
  const out={enabled:raw.enabled===true,chestId:integer(raw.chestId,'chestId',1,0xffffffff),chestSubId:integer(raw.chestSubId,'chestSubId',0,0xffffffff),name:String(raw.name||'Luck Royale').trim().slice(0,80),coinType:integer(raw.coinType,'coinType',1,3),singlePrice:integer(raw.singlePrice,'singlePrice',0,1000000),multiPrice:integer(raw.multiPrice,'multiPrice',0,10000000),freeIntervalSeconds:integer(raw.freeIntervalSeconds,'freeIntervalSeconds',0,2592000),pityDraws:integer(raw.pityDraws,'pityDraws',0,10000),startTime:integer(raw.startTime,'startTime',0,0x7fffffff),endTime:integer(raw.endTime,'endTime',0,0x7fffffff)};
  out.pool=(raw.pool||[]).map((x,i)=>({itemId:integer(x.itemId,`pool[${i}].itemId`,1,0xffffffff),quantity:integer(x.quantity==null?1:x.quantity,`pool[${i}].quantity`,1,100000),weight:integer(x.weight,`pool[${i}].weight`,1,1000000),rarity:integer(x.rarity||0,`pool[${i}].rarity`,0,5),jackpot:x.jackpot===true,duplicateItemId:integer(x.duplicateItemId||0,`pool[${i}].duplicateItemId`,0,0xffffffff),duplicateQuantity:integer(x.duplicateQuantity||0,`pool[${i}].duplicateQuantity`,0,100000)}));
  out.milestones=(raw.milestones||[]).map((x,i)=>({id:integer(x.id,`milestones[${i}].id`,1,0xffffffff),draws:integer(x.draws,`milestones[${i}].draws`,1,1000000),itemId:integer(x.itemId,`milestones[${i}].itemId`,1,0xffffffff),quantity:integer(x.quantity==null?1:x.quantity,`milestones[${i}].quantity`,1,100000)}));
  if(!out.name||!out.pool.length)throw new Error('Luck Royale requires a name and at least one pool item');
  if(out.endTime<=out.startTime)throw new Error('endTime must be after startTime');
  if(!out.pool.some(x=>x.jackpot))throw new Error('At least one pool item must be marked jackpot');return out;
}
function read(){try{return normalize(JSON.parse(fs.readFileSync(file,'utf8')));}catch(e){if(e.code==='ENOENT')return normalize(defaults);throw e;}}
function save(v){const clean=normalize(v);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(`${file}.tmp`,`${JSON.stringify(clean,null,2)}\n`);fs.renameSync(`${file}.tmp`,file);return clean;}
function dateText(unix){return new Date(unix*1000).toISOString().replace('T',' ').slice(0,19);}
function protocolValue(){const c=read();if(!c.enabled)return {gacha_desc_list:[]};return {gacha_desc_list:[{chest_id:c.chestId,chest_type:{
  // Keep this descriptor limited to fields used by the 1.70 client. In
  // particular, open_priority_switch and the OB42 forge/presentation fields
  // make 1.70 discard every chest, causing GetDefGachaID() to throw.
  chest_id:c.chestId,priority:1,coin_type:c.coinType,chest_name:c.name,
  chest_sub_id:c.chestSubId,
  start_time:dateText(c.startTime),end_time:dateText(c.endTime),start_time_stamp:c.startTime,end_time_stamp:c.endTime,
  once_price:c.singlePrice,ten_price:c.multiPrice,once_num:1,ten_num:10,
  chest_model_id:1,
  // PreviewSceneCtx requires a model pair that exists in this OB build.
  // The later 019/018 pair is not present in 1.70 and produces a null scene.
  show_model_male:102000015,show_model_female:101000015,
  free_type:c.freeIntervalSeconds>0?1:0,drop_probability_switch:true
},item_list_with_jackpot:[{jackpot:0,items:c.pool.map((x,i)=>({
  item_id:x.itemId,item_type:1,is_show:true,item_num:x.quantity,reward_level:x.rarity,
  repeated_item_id:x.duplicateItemId,repeated_item_num:x.duplicateQuantity,id:i+1
}))}]}]};}
module.exports={file,defaults,read,save,protocolValue};
