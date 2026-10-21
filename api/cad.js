const {response,authorize,allPages,notion,propText,rt,cadSpec}=require('../lib/common');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
 if(!authorize(req,res))return;
 try{
  const body=req.body||{};
  const fixtures=await allPages('fixtures');
  const projects=await allPages('projects');
  const filtered=body.projectId?fixtures.filter(p=>p.properties?.['所屬專案']?.relation?.some(r=>r.id===body.projectId)):fixtures;
  const report=filtered.map(p=>{
   const input={code:propText(p,'燈具編號'),name:propText(p,'燈具名稱'),model:propText(p,'完整型號'),raw:propText(p,'原始預算規格')};
   const generated=cadSpec(input),before=propText(p,'CAD文字');
   return {id:p.id,code:input.code,name:input.name,model:input.model,project:p.properties?.['所屬專案']?.relation?.map(x=>x.id)||[],product:p.properties?.['產品參照']?.relation?.map(x=>x.id)||[],quantity:p.properties?.['數量']?.number??null,hasRaw:!!input.raw,hasCAD:!!before,changed:before!==generated,preview:generated};
  });
  if(body.action!=='backfill')return response(res,200,{ok:true,projects:projects.map(p=>({id:p.id,name:propText(p,'專案名稱'),code:propText(p,'專案編號')})),total:report.length,missingRelation:report.filter(x=>!x.project.length||!x.product.length).length,missingRaw:report.filter(x=>!x.hasRaw).length,missingCAD:report.filter(x=>!x.hasCAD).length,items:report});
  if(body.confirm!=='FILL_EMPTY_CAD_ONLY')return response(res,400,{error:'僅允許明確確認後填補空白 CAD 文字'});
  if(!body.projectId)return response(res,400,{error:'安全限制：請先指定要更新的工程專案'});
  if(report.length>80)return response(res,400,{error:'單次最多更新80筆'});
  const updated=[],skipped=[],errors=[];
  for(const r of report){
   if(r.hasCAD||!r.hasRaw||!r.code||!r.model){skipped.push({code:r.code,reason:'原欄位非空或來源資料不足'});continue}
   try{await notion('PATCH','pages/'+r.id,{properties:{'CAD文字':rt(r.preview),'CAD版次':rt('V3.4-AUTO')}});updated.push(r.code)}catch(e){errors.push({code:r.code,error:e.message})}
  }
  return response(res,errors.length?207:200,{ok:!errors.length,updated,skipped,errors});
 }catch(e){return response(res,502,{error:e.message})}
};
