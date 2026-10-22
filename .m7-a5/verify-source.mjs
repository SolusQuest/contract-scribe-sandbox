// Run-local pre-build gate. No provider secret; no execution of product checkout.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const env=process.env;
const fail=()=>{throw Error('Exact reviewed source / terminal quality gate failed.');};
if(env.GITHUB_REPOSITORY!=='SolusQuest/contract-scribe-sandbox'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_WORKFLOW_SHA!==env.A5_APPROVED_WORKFLOW_SHA)fail();
const approved=JSON.parse(fs.readFileSync(new URL('./approved-products.json',import.meta.url)));
const entry=approved.sources.find(x=>x.sha===env.A5_PRODUCT_SHA);
if(!entry||!/^[a-f0-9]{40}$/.test(entry.sha)||approved.repository!=='SolusQuest/contract-scribe')fail();
const read=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:4*1024*1024}));
if(read('repos/SolusQuest/contract-scribe-sandbox').id!==1361354906)fail();
if(!/^[a-f0-9]{40}$/.test(env.A5_TARGET_SHA||'')||read('repos/SolusQuest/contract-scribe-sandbox/git/ref/heads/m7-a5-observation-20261022').object.sha!==env.A5_TARGET_SHA)fail();
// Reviewed PR fixes require a newly reviewed control commit allowlist entry
// naming that PR and exact head; arbitrary dispatch product_sha is rejected.
if(entry.kind==='reviewed-pr-fix'){
 if(!Number.isInteger(entry.pullRequest)||entry.pullRequest<1)fail();
 const pr=read(`repos/${approved.repository}/pulls/${entry.pullRequest}`);
 if(pr.state!=='open'||pr.head.sha!==entry.sha||pr.head.repo.full_name!==approved.repository||pr.base.ref!=='main')fail();
}else if(entry.kind!=='merged-baseline')fail();
const runs=read(`repos/${approved.repository}/actions/runs?head_sha=${entry.sha}&per_page=100`).workflow_runs;
for(const id of [entry.ciWorkflowId,entry.codeqlWorkflowId]){
 const matching=runs.filter(x=>x.workflow_id===id&&x.head_sha===entry.sha&&['push','pull_request','dynamic'].includes(x.event)).sort((a,b)=>b.id-a.id);
 const latest=matching[0];
 if(!latest||latest.status!=='completed'||latest.conclusion!=='success'||latest.repository.full_name!==approved.repository)fail();
}
console.log('Reviewed exact product source has terminal CI and CodeQL success.');
