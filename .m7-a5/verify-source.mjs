// Run-local pre-build gate. No provider secret; no execution of product checkout.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyFresh,canonical,sha256,sourceFeedbackSha256} from './campaign-binding.mjs';
const env=process.env;
const fail=()=>{throw Error('Exact reviewed source / terminal quality gate failed.');};
if(env.GITHUB_REPOSITORY!=='SolusQuest/contract-scribe-sandbox'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_WORKFLOW_SHA!==env.A5_APPROVED_WORKFLOW_SHA)fail();
const approved=JSON.parse(fs.readFileSync(new URL('./approved-products.json',import.meta.url)));
const entry=approved.sources.find(x=>x.sha===env.A5_PRODUCT_SHA);
if(!entry||entry.sha!=='8c1b0affecee1dd9b357b376bab8b2bd675a891b'||approved.sources.length!==1||approved.repository!=='SolusQuest/contract-scribe'||sha256(fs.readFileSync(new URL('./approved-products.json',import.meta.url)))!=='390210e52cb9841be61e5e354a83197fed0d41adde660878c5bfd1e01bcca1f4')fail();
const read=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:4*1024*1024}));
if(read('repos/SolusQuest/contract-scribe-sandbox').id!==1361354906)fail();
verifyFresh(undefined,read);
// Reviewed PR fixes require a newly reviewed control commit allowlist entry
// naming that PR and exact head; arbitrary dispatch product_sha is rejected.
if(entry.kind!=='owner-approved-pr-fix'||entry.pullRequest!==269)fail();
const candidate=read(`repos/${approved.repository}/pulls/${entry.pullRequest}`);
if(candidate.state!=='open'||!candidate.draft||candidate.merged_at||candidate.head.sha!==entry.sha||candidate.head.repo.full_name!==approved.repository||candidate.base.ref!=='main'||candidate.base.sha!==entry.baseSha||entry.baseSha!=='4ca77d69cbaf2d3cb18c49352a43f4449c9da991')fail();
const runs=read(`repos/${approved.repository}/actions/runs?head_sha=${entry.sha}&per_page=100`).workflow_runs;
for(const id of [entry.ciWorkflowId,entry.codeqlWorkflowId]){
 const matching=runs.filter(x=>x.workflow_id===id&&x.head_sha===entry.sha&&['push','pull_request','dynamic'].includes(x.event)).sort((a,b)=>b.id-a.id);
 const latest=matching[0];
 if(!latest||latest.id!==(id===entry.ciWorkflowId?entry.ciRunId:entry.codeqlRunId)||latest.run_attempt!==1||latest.status!=='completed'||latest.conclusion!=='success'||latest.repository.full_name!==approved.repository)fail();
}

const checks=read(`repos/${approved.repository}/commits/${entry.sha}/check-runs?per_page=100`);
const requiredNames=['Analyze (csharp)','Analyze (python)','action_examples_consumer','action_examples_producer','action_packaged','fast_and_static','integration_campaign_crash','integration_github_proposal (automatic)','integration_github_proposal (compiler-inputs)','integration_github_proposal (remaining)','integration_http_loss (0, After)','integration_http_loss (0, Before)','integration_http_loss (1, After)','integration_http_loss (1, Before)','integration_http_loss (2, After)','integration_http_loss (2, Before)','integration_other (campaign)','integration_other (remaining)','integration_unfiltered_evidence','packed_payload','payload_producer','validate'];
const sameNames=(rows,names)=>canonical(rows.map(v=>v.name).sort())===canonical([...names].sort());
const required=checks.check_runs.filter(v=>requiredNames.includes(v.name));
const extra=checks.check_runs.filter(v=>!requiredNames.includes(v.name));
if(checks.total_count!==checks.check_runs.length||!sameNames(required,requiredNames)
 ||checks.check_runs.some(v=>v.head_sha!==entry.sha||v.status!=='completed'||v.app?.id!==15368)
 ||required.some(v=>v.conclusion!==(v.name==='integration_unfiltered_evidence'?'skipped':'success')))fail();
// Every required check must belong to this exact head and current allowlisted runs.
if(extra.length||checks.total_count!==requiredNames.length||new Set(checks.check_runs.map(v=>v.id)).size!==requiredNames.length)fail();
const query=`query { repository(owner:"SolusQuest",name:"contract-scribe") { pullRequest(number:269) {
 number headRefOid baseRefOid isDraft state reviewDecision
 comments(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} body createdAt updatedAt url } }
 reviews(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} state body submittedAt commit {oid} url } }
 reviewThreads(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id isResolved isOutdated path line startLine comments(first:100) {totalCount pageInfo {hasNextPage endCursor} nodes {id databaseId author {login} body createdAt updatedAt url originalCommit {oid} commit {oid}}} } }
 } } }`;
const feedback=JSON.parse(execFileSync('gh',['api','graphql','-f','query='+query],{encoding:'utf8',maxBuffer:8*1024*1024}));if(feedback.errors)fail();const pr=feedback.data.repository.pullRequest;
for(const c of [pr.comments,pr.reviews,pr.reviewThreads,...pr.reviewThreads.nodes.map(t=>t.comments)])if(c.pageInfo.hasNextPage!==false||c.totalCount!==c.nodes.length)fail();
if(sha256(canonical(pr))!==sourceFeedbackSha256)fail();
console.log('Reviewed exact product source has current terminal CI, CodeQL, checks and complete accepted feedback.');

