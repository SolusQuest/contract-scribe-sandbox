// Run-local pre-build gate. No provider secret; no execution of product checkout.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyFresh,canonical,sha256,sourceFeedbackSha256} from './campaign-binding.mjs';
const env=process.env;
const fail=()=>{throw Error('Exact reviewed source / terminal quality gate failed.');};
if(env.GITHUB_REPOSITORY!=='SolusQuest/contract-scribe-sandbox'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_WORKFLOW_SHA!==env.A5_APPROVED_WORKFLOW_SHA)fail();
const approved=JSON.parse(fs.readFileSync(new URL('./approved-products.json',import.meta.url)));
const entry=approved.sources.find(x=>x.sha===env.A5_PRODUCT_SHA);
if(!entry||entry.sha!=='4ca77d69cbaf2d3cb18c49352a43f4449c9da991'||approved.sources.length!==1||approved.repository!=='SolusQuest/contract-scribe'||sha256(fs.readFileSync(new URL('./approved-products.json',import.meta.url)))!=='094d68835472a3841e1266b3c3d2f4e38502c530f012af22430c44be4340a274')fail();
const read=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:4*1024*1024}));
if(read('repos/SolusQuest/contract-scribe-sandbox').id!==1361354906)fail();
verifyFresh(undefined,read);
// Reviewed PR fixes require a newly reviewed control commit allowlist entry
// naming that PR and exact head; arbitrary dispatch product_sha is rejected.
if(entry.kind==='reviewed-pr-fix'){
 if(!Number.isInteger(entry.pullRequest)||entry.pullRequest<1)fail();
 const pr=read(`repos/${approved.repository}/pulls/${entry.pullRequest}`);
 if(pr.state!=='open'||!pr.draft||pr.merged_at||pr.head.sha!==entry.sha||pr.head.repo.full_name!==approved.repository||pr.base.ref!=='main'||pr.base.sha!=='12d4e54a537a468fe62c773a319498737fef886c'||entry.pullRequest!==266)fail();
}else if(entry.kind==='merged-baseline'){
 const current=read(`repos/${approved.repository}/git/ref/heads/main`);
 const merged=read(`repos/${approved.repository}/pulls/267`);
 if(current.ref!=='refs/heads/main'||current.object?.type!=='commit'||current.object.sha!==entry.sha
  ||entry.pullRequest!==267||merged.state!=='closed'||merged.merged!==true||!merged.merged_at
  ||merged.merge_commit_sha!==entry.sha||merged.head.sha!=='27ac9a1a9a5c7a19376b0e079f372094a5e9b82f'
  ||merged.head.repo.full_name!==approved.repository||merged.base.ref!=='main'||merged.base.sha!=='eed83bac974c150b2dabcbed496e31a6433fd8f1')fail();
}else fail();
const runs=read(`repos/${approved.repository}/actions/runs?head_sha=${entry.sha}&per_page=100`).workflow_runs;
for(const id of [entry.ciWorkflowId,entry.codeqlWorkflowId]){
 const matching=runs.filter(x=>x.workflow_id===id&&x.head_sha===entry.sha&&['push','pull_request','dynamic'].includes(x.event)).sort((a,b)=>b.id-a.id);
 const latest=matching[0];
 if(!latest||latest.status!=='completed'||latest.conclusion!=='success'||latest.repository.full_name!==approved.repository)fail();
}

const checks=read(`repos/${approved.repository}/commits/${entry.sha}/check-runs?per_page=100`);
const requiredNames=['Analyze (csharp)','Analyze (python)','action_examples_consumer','action_examples_producer','action_packaged','fast_and_static','integration_campaign_crash','integration_github_proposal (automatic)','integration_github_proposal (compiler-inputs)','integration_github_proposal (remaining)','integration_http_loss (0, After)','integration_http_loss (0, Before)','integration_http_loss (1, After)','integration_http_loss (1, Before)','integration_http_loss (2, After)','integration_http_loss (2, Before)','integration_other (campaign)','integration_other (remaining)','integration_unfiltered_evidence','packed_payload','payload_producer','validate'];
const sameNames=(rows,names)=>canonical(rows.map(v=>v.name).sort())===canonical([...names].sort());
const required=checks.check_runs.filter(v=>requiredNames.includes(v.name));
const extra=checks.check_runs.filter(v=>!requiredNames.includes(v.name));
if(checks.total_count!==checks.check_runs.length||!sameNames(required,requiredNames)
 ||checks.check_runs.some(v=>v.head_sha!==entry.sha||v.status!=='completed'||v.app?.id!==15368)
 ||required.some(v=>v.conclusion!==(v.name==='integration_unfiltered_evidence'?'skipped':'success')))fail();
// Preserve the original accepted source check identities; scheduled M5 groups
// accumulate independently and never satisfy required CI.
const originalChecks=new Map([[122021625304,"validate"],[122021424908,"H3 offline gates"],[122021404978,"Product proof"],[122021378022,"Read-only platform evidence"],[122021377620,"Read-only preflight and transfer"],[122017616249,"action_examples_consumer"],[122017067599,"action_examples_producer"],[122015413633,"action_packaged"],[122015413609,"packed_payload"],[122014473458,"Analyze (csharp)"],[122014472935,"Analyze (python)"],[122014466239,"integration_unfiltered_evidence"],[122014465446,"integration_http_loss (1, After)"],[122014465428,"integration_campaign_crash"],[122014465409,"integration_github_proposal (compiler-inputs)"],[122014465388,"integration_http_loss (2, After)"],[122014465353,"integration_http_loss (0, After)"],[122014465349,"integration_http_loss (2, Before)"],[122014465324,"integration_http_loss (0, Before)"],[122014465317,"payload_producer"],[122014465290,"integration_github_proposal (automatic)"],[122014465284,"integration_github_proposal (remaining)"],[122014465279,"integration_other (remaining)"],[122014465237,"integration_other (campaign)"],[122014465229,"integration_http_loss (1, Before)"],[122014465089,"fast_and_static"]]);
if(checks.total_count>100||new Set(checks.check_runs.map(v=>v.id)).size!==checks.check_runs.length
 ||checks.check_runs.some(v=>!Number.isSafeInteger(v.id)||v.id<1)
 ||[...originalChecks].some(([id,name])=>!checks.check_runs.some(v=>v.id===id&&v.name===name)))fail();
if(extra.length){
 const names=['Read-only platform evidence','Product proof','H3 offline gates','Read-only preflight and transfer'];
 if(entry.kind!=='merged-baseline'||extra.some(v=>v.conclusion!=='skipped'))fail();
 const groups=new Map();
 for(const check of extra){
  const match=/^https:\/\/github\.com\/SolusQuest\/contract-scribe\/actions\/runs\/([1-9][0-9]*)\/job\/([1-9][0-9]*)$/.exec(check.details_url);
  if(!match||!Number.isSafeInteger(Number(match[1]))||Number(match[2])!==check.id)fail();
  const group=groups.get(match[1])??[];group.push(check);groups.set(match[1],group);
 }
 for(const [id,group] of groups){
  if(!sameNames(group,names))fail();
  const automatic=read(`repos/${approved.repository}/actions/runs/${id}`);
  if(automatic.id!==Number(id)||automatic.workflow_id!==353322607||automatic.path!=='.github/workflows/m5-github-proposal-proof.yml'
   ||automatic.event!=='schedule'||automatic.repository.full_name!==approved.repository||automatic.repository.id!==1297409952||automatic.head_sha!==entry.sha
   ||automatic.head_branch!=='main'||automatic.run_attempt!==1||automatic.status!=='completed'||automatic.conclusion!=='skipped')fail();
  const jobs=read(`repos/${approved.repository}/actions/runs/${id}/attempts/1/jobs?per_page=100`);
  if(jobs.total_count!==4||jobs.jobs.length!==4||!sameNames(jobs.jobs,names)
   ||new Set(jobs.jobs.map(v=>v.id)).size!==4)fail();
  for(const check of group){
   const job=jobs.jobs.find(v=>v.name===check.name);
   if(job.id!==check.id||job.run_id!==automatic.id||job.head_sha!==entry.sha||job.status!=='completed'||job.conclusion!=='skipped'
    ||check.details_url!==job.html_url||job.html_url!==`https://github.com/${approved.repository}/actions/runs/${id}/job/${job.id}`)fail();
  }
 }
}
const query=`query { repository(owner:"SolusQuest",name:"contract-scribe") { pullRequest(number:267) {
 number headRefOid baseRefOid isDraft state reviewDecision
 comments(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} body createdAt updatedAt url } }
 reviews(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} state body submittedAt commit {oid} url } }
 reviewThreads(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id isResolved isOutdated path line startLine comments(first:100) {totalCount pageInfo {hasNextPage endCursor} nodes {id databaseId author {login} body createdAt updatedAt url originalCommit {oid} commit {oid}}} } }
 } } }`;
const feedback=JSON.parse(execFileSync('gh',['api','graphql','-f','query='+query],{encoding:'utf8',maxBuffer:8*1024*1024}));if(feedback.errors)fail();const pr=feedback.data.repository.pullRequest;
for(const c of [pr.comments,pr.reviews,pr.reviewThreads,...pr.reviewThreads.nodes.map(t=>t.comments)])if(c.pageInfo.hasNextPage!==false||c.totalCount!==c.nodes.length)fail();
if(sha256(canonical(pr))!==sourceFeedbackSha256)fail();
console.log('Reviewed exact product source has current terminal CI, CodeQL, checks and complete accepted feedback.');

