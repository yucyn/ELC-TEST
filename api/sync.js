const {response,authorize,allPages,notion,id,normalize,propText,mismatch,serialize,fixtureProps,productProps,title,rt,select}=require('../lib/common');
module.exports=async(req,res)=>{if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});if(!authorize(req,res))return;try{
const b=req.body||{};if(b.confirm!=='SYNC_TO_NOTION')return response(res,400,{error:'需確認整批寫入'});
const project=b.project||{};const projectCode=String(project.code||'').trim(),projectName=String(project.name||'').trim();
if(!projectCode||!projectName)return response(res,400,{error:'請填入專案名稱與編號'});
const rows=(b.fixtures||[]).map(serialize);if(!rows.length||rows.length>80)return response(res,400,{error:'每次需 1–80 筆燈具'});
if(rows.some(r=>!r.approved||!r.code||!r.model||!r.name||!Number.isFinite(r.quantity)||r.quantity<0))return response(res,400,{error:'尚有未核准、缺少型號或數量不正確的燈具'});
if(new Set(rows.map(r=>normalize(r.code))).size!==rows.length)return response(res,400,{error:'檔案內出現重複燈具編號'});
// 僅允許使用者審核過且全量雲端比對後仍無規格衝突的產品；本版不更新已存在的產品或燈具。
const [products,projects,fixtures]=await Promise.all(['products','projects','fixtures'].map(allPages));
const sameProject=projects.filter(p=>normalize(propText(p,'專案編號'))===normalize(projectCode));if(sameProject.length>1)return response(res,409,{error:'Notion 有相同專案編號，請先手工去重'});
const report=[];for(const row of rows){const matches=products.filter(p=>normalize(propText(p,'完整型號'))===normalize(row.model));if(matches.length>1)return response(res,409,{error:'Notion 中已有多個相同完整型號：'+row.model});if(matches.length===1){const conflicts=mismatch(matches[0],row);if(conflicts.length)report.push({code:row.code,conflicts});}}
if(report.length)return response(res,409,{error:'即時 Notion 規格與匯入內容不符；未寫入任何資料',conflicts:report});
// Write operations: not transactional; report partial successes for safe retry.
const done={project:null,createdProducts:[],createdFixtures:[],skippedFixtures:[]};
try{let projectPage=sameProject[0];if(!projectPage){projectPage=await notion('POST','pages',{parent:{type:'data_source_id',data_source_id:id('projects')},properties:{'專案名稱':title(projectName),'專案編號':rt(projectCode),'專案狀態':select('整理中'),'資料來源':rt(String(b.source||'ELC SPEC V3.3').slice(0,1900))}});}done.project=projectPage.url;
for(const row of rows){let product=products.find(p=>normalize(propText(p,'完整型號'))===normalize(row.model));if(!product){product=await notion('POST','pages',{parent:{type:'data_source_id',data_source_id:id('products')},properties:productProps(row)});products.push(product);done.createdProducts.push({model:row.model,url:product.url});}
const existing=fixtures.filter(p=>p.properties?.['所屬專案']?.relation?.some(r=>r.id===projectPage.id)&&normalize(propText(p,'燈具編號'))===normalize(row.code));
if(existing.length){if(existing.length>1||normalize(propText(existing[0],'完整型號'))!==normalize(row.model))throw Error('燈具編號 '+row.code+' 在專案已存在但型號不同或重複，請人工核對');done.skippedFixtures.push({code:row.code,reason:'相同專案編號與型號已存在；安全跳過，未覆寫'});continue;}
const page=await notion('POST','pages',{parent:{type:'data_source_id',data_source_id:id('fixtures')},properties:fixtureProps(row,projectPage.id,product.id)});done.createdFixtures.push({code:row.code,url:page.url});
}
return response(res,200,{ok:true,...done});}catch(e){return response(res,207,{ok:false,error:'部分寫入成功：'+e.message,...done,hint:'請查看已建立的資料並修正問題後重試；重試會跳過已存在的專案燈具編號。'});}
}catch(e){return response(res,502,{error:e.message});}};
