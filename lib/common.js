'use strict';
const IDS={products:'NOTION_PRODUCTS_DATA_SOURCE_ID',projects:'NOTION_PROJECTS_DATA_SOURCE_ID',fixtures:'NOTION_FIXTURES_DATA_SOURCE_ID'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function response(res,status,obj){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(obj));}
function authorize(req,res){const key=process.env.ELC_ACCESS_KEY;if(!key || req.headers['x-elc-access-key']!==key){response(res,401,{error:'請輸入正確的系統存取密碼（ELC_ACCESS_KEY）'});return false;}return true;}
function normalize(v){return String(v??'').normalize('NFKC').toUpperCase().replace(/\s+/g,' ').trim();}
function id(type){const v=process.env[IDS[type]];if(!v)throw Error('尚未設定 '+IDS[type]);return v;}
function rich(s){return [{type:'text',text:{content:String(s??'').slice(0,1900)}}];}
function title(s){return {title:rich(s)};}
function rt(s){return {rich_text:rich(s)};}
function select(s){return {select:{name:s}};}
function propText(page,k){const p=page.properties?.[k];return (p?.title||p?.rich_text||[]).map(a=>a.plain_text??a.text?.content??'').join('');}
function propNum(page,k){return page.properties?.[k]?.number??null;}
async function notion(method,path,body){const token=process.env.NOTION_TOKEN;if(!token)throw Error('缺少 NOTION_TOKEN');for(let i=0;i<4;i++){const r=await fetch('https://api.notion.com/v1/'+path,{method,headers:{Authorization:'Bearer '+token,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});let data=await r.json().catch(()=>({}));if((r.status===429||r.status>=500)&&i<3){await sleep(500*(2**i));continue;}if(!r.ok)throw Error('Notion '+r.status+'：'+(data.message||JSON.stringify(data).slice(0,200)));return data;}throw Error('Notion 重試次數用盡');}
async function allPages(type){let list=[],cursor;do{const data=await notion('POST',`data_sources/${id(type)}/query`,{page_size:100,...(cursor?{start_cursor:cursor}:{})});list.push(...data.results);cursor=data.has_more?data.next_cursor:null;if(list.length>1500)throw Error('資料庫超過本版單次檢核上限（1500）');}while(cursor);return list;}
function makeSpec(raw){const get=re=>raw.match(re)?.[1]||null;return {power: toNum(get(/(\d+(?:\.\d+)?)\s*W\b/i)),lumen:toNum(get(/(\d[\d,]*)\s*lm\b/i)),cri:toNum(get(/CRI\s*[≥≧>]?\s*(\d+)/i)),sdcm:toNum(get(/SDCM\s*[≤≦<]?\s*(\d+)/i)),ip:get(/\bIP\s*(\d{2})\b/i)};}
function toNum(x){return x==null?null:Number(String(x).replace(/,/g,''));}
function mismatch(existing,row){const current=makeSpec(row.raw||'');const fields=[['power','功率W'],['lumen','光通量lm'],['cri','CRI'],['sdcm','SDCM']];const errors=[];for(const [k,prop] of fields){let v=propNum(existing,prop);if(v!==null&&current[k]!==null&&v!==current[k])errors.push(`${prop}：Notion ${v}／Excel ${current[k]}`);}const ip=propText(existing,'IP等級').replace(/\D/g,'');if(ip&&current.ip&&ip!==current.ip)errors.push('IP等級不同');return errors;}
function serialize(row){return {code:String(row.code||'').trim().slice(0,80),name:String(row.name||'').trim().slice(0,140),model:String(row.model||'').trim().slice(0,240),quantity:row.quantity===''?null:Number(row.quantity),unit:String(row.unit||'SET').trim().slice(0,30),raw:String(row.raw||'').trim().slice(0,1500),approved:row.approved===true};}
function fixtureProps(f,projectId,productId){return {'燈具名稱':title(f.name),'燈具編號':rt(f.code),'完整型號':rt(f.model),'數量':{number:f.quantity},'單位':rt(f.unit),'原始預算規格':rt(f.raw),'資料狀態':select('待確認'),'所屬專案':{relation:[{id:projectId}]},'產品參照':{relation:[{id:productId}]}};}
function productProps(f){const s=makeSpec(f.raw);return {'產品名稱':title(`${f.name}｜${f.model}`),'品牌':rt(f.model.split(' ')[0]),'完整型號':rt(f.model),'燈具類型':rt(f.name),'原始規格':rt(f.raw),'資料來源':rt('ELC SPEC V3.3 匯入預算；尚未與原廠型錄核對'),'確認狀態':select('待確認'),...Object.fromEntries([['功率W',s.power],['光通量lm',s.lumen],['CRI',s.cri],['SDCM',s.sdcm]].filter(([,v])=>v!==null).map(([k,v])=>[k,{number:v}])),...(s.ip?{'IP等級':rt('IP'+s.ip)}:{})};}
module.exports={response,authorize,normalize,id,notion,allPages,propText,mismatch,serialize,title,rt,select,fixtureProps,productProps};
