// Run-local pre-build gate. No provider secret; no execution of product checkout.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyFresh,canonical,sha256,sourceFeedbackSha256} from './campaign-binding.mjs';
const env=process.env;
const fail=()=>{throw Error('Exact reviewed source / terminal quality gate failed.');};
if(env.GITHUB_REPOSITORY!=='SolusQuest/contract-scribe-sandbox'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_WORKFLOW_SHA!==env.A5_APPROVED_WORKFLOW_SHA)fail();
const approved=JSON.parse(fs.readFileSync(new URL('./approved-products.json',import.meta.url)));
const entry=approved.sources.find(x=>x.sha===env.A5_PRODUCT_SHA);
if(!entry||entry.sha!=='ca391cba63c7a19801876751a5b4621bdbdc5ff8'||approved.sources.length!==1||approved.repository!=='SolusQuest/contract-scribe'||sha256(fs.readFileSync(new URL('./approved-products.json',import.meta.url)))!=='758d3451a6aefcec96a4720a76a9a69889dfe09403d11f9f1bba67ce37200522')fail();
const read=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:4*1024*1024}));
if(read('repos/SolusQuest/contract-scribe-sandbox').id!==1361354906)fail();
verifyFresh(undefined,read);
// Reviewed PR fixes require a newly reviewed control commit allowlist entry
// naming that PR and exact head; arbitrary dispatch product_sha is rejected.
if(entry.kind==='reviewed-pr-fix'){
 if(!Number.isInteger(entry.pullRequest)||entry.pullRequest<1)fail();
 const pr=read(`repos/${approved.repository}/pulls/${entry.pullRequest}`);
 if(pr.state!=='open'||!pr.draft||pr.merged_at||pr.head.sha!==entry.sha||pr.head.repo.full_name!==approved.repository||pr.base.ref!=='main'||pr.base.sha!=='dbc1a46563bd493b357c0c28af542f02546b344b'||entry.pullRequest!==263)fail();
}else if(entry.kind==='merged-baseline'){
 const current=read(`repos/${approved.repository}/git/ref/heads/main`);
 const merged=read(`repos/${approved.repository}/pulls/263`);
 if(current.ref!=='refs/heads/main'||current.object?.type!=='commit'||current.object.sha!==entry.sha
  ||entry.pullRequest!==263||merged.state!=='closed'||merged.merged!==true||!merged.merged_at
  ||merged.merge_commit_sha!==entry.sha||merged.head.sha!=='1f398b9ba36a20ae7771ae740c3763cac6da2d76'
  ||merged.head.repo.full_name!==approved.repository||merged.base.ref!=='main'||merged.base.sha!=='dbc1a46563bd493b357c0c28af542f02546b344b')fail();
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
// The product repository's scheduled M5 workflow intentionally runs no jobs.
// Attribute its entire four-check set; these skips never satisfy required CI.
if(extra.length){
 const names=['Read-only platform evidence','Product proof','H3 offline gates','Read-only preflight and transfer'];
 if(entry.kind!=='merged-baseline'||!sameNames(extra,names)||extra.some(v=>v.conclusion!=='skipped'))fail();
 const matches=extra.map(v=>/^https:\/\/github\.com\/SolusQuest\/contract-scribe\/actions\/runs\/(\d+)\/job\/(\d+)$/.exec(v.details_url));
 if(matches.some(v=>!v)||new Set(matches.map(v=>v[1])).size!==1)fail();
 const id=matches[0][1];const automatic=read(`repos/${approved.repository}/actions/runs/${id}`);
 if(automatic.id!==Number(id)||automatic.workflow_id!==353322607||automatic.path!=='.github/workflows/m5-github-proposal-proof.yml'
  ||automatic.event!=='schedule'||automatic.repository.full_name!==approved.repository||automatic.head_sha!==entry.sha
  ||automatic.head_branch!=='main'||automatic.run_attempt!==1||automatic.status!=='completed'||automatic.conclusion!=='skipped')fail();
 const jobs=read(`repos/${approved.repository}/actions/runs/${id}/attempts/1/jobs?per_page=100`);
 if(jobs.total_count!==4||jobs.jobs.length!==4||!sameNames(jobs.jobs,names))fail();
 for(const check of extra){
  const job=jobs.jobs.find(v=>v.name===check.name);
  if(job.run_id!==automatic.id||job.head_sha!==entry.sha||job.status!=='completed'||job.conclusion!=='skipped'
   ||check.details_url!==job.html_url||job.html_url!==`https://github.com/${approved.repository}/actions/runs/${id}/job/${job.id}`)fail();
 }
}
const query=`query { repository(owner:"SolusQuest",name:"contract-scribe") { pullRequest(number:263) {
 number headRefOid baseRefOid isDraft state reviewDecision
 comments(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} body createdAt updatedAt url } }
 reviews(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} state body submittedAt commit {oid} url } }
 reviewThreads(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id isResolved isOutdated path line startLine comments(first:100) {totalCount pageInfo {hasNextPage endCursor} nodes {id databaseId author {login} body createdAt updatedAt url originalCommit {oid} commit {oid}}} } }
 } } }`;
const feedback=JSON.parse(execFileSync('gh',['api','graphql','-f','query='+query],{encoding:'utf8',maxBuffer:8*1024*1024}));if(feedback.errors)fail();const pr=feedback.data.repository.pullRequest;
for(const c of [pr.comments,pr.reviews,pr.reviewThreads,...pr.reviewThreads.nodes.map(t=>t.comments)])if(c.pageInfo.hasNextPage!==false||c.totalCount!==c.nodes.length)fail();
if(sha256(canonical(pr))!==sourceFeedbackSha256)fail();
console.log('Reviewed exact product source has current terminal CI, CodeQL, checks and complete accepted feedback.');

