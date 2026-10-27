// Run-local pre-build gate. No provider secret; no execution of product checkout.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyFresh,canonical,sha256,sourceFeedbackSha256} from './campaign-binding.mjs';
const env=process.env;
const fail=()=>{throw Error('Exact reviewed source / terminal quality gate failed.');};
if(env.GITHUB_REPOSITORY!=='SolusQuest/contract-scribe-sandbox'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_WORKFLOW_SHA!==env.A5_APPROVED_WORKFLOW_SHA)fail();
const approved=JSON.parse(fs.readFileSync(new URL('./approved-products.json',import.meta.url)));
const entry=approved.sources.find(x=>x.sha===env.A5_PRODUCT_SHA);
if(!entry||entry.sha!=='3c1e59d78e5aef9191895047984af03940d7361e'||approved.sources.length!==1||approved.repository!=='SolusQuest/contract-scribe'||sha256(fs.readFileSync(new URL('./approved-products.json',import.meta.url)))!=='a6ee7accab0fc68a18a0f904cf241a34ec4f3c955cb47adfd4c9068ac2950c1d')fail();
const read=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:4*1024*1024}));
if(read('repos/SolusQuest/contract-scribe-sandbox').id!==1361354906)fail();
verifyFresh(undefined,read);
// Reviewed PR fixes require a newly reviewed control commit allowlist entry
// naming that PR and exact head; arbitrary dispatch product_sha is rejected.
if(entry.kind!=='reviewed-pr-fix'||entry.pullRequest!==269)fail();
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
// Exact original candidate check identities. Candidate is not main; no scheduled
// main group can satisfy or silently extend this fixed current-PR qualification.
const originalChecks=new Map([[122300885036, "validate"], [122288522699, "action_examples_consumer"], [122287315980, "action_examples_producer"], [122284452844, "packed_payload"], [122284452706, "action_packaged"], [122282693346, "integration_unfiltered_evidence"], [122282692275, "integration_http_loss (0, After)"], [122282691991, "integration_http_loss (1, After)"], [122282691964, "integration_http_loss (2, Before)"], [122282691863, "integration_http_loss (0, Before)"], [122282691720, "payload_producer"], [122282691632, "integration_http_loss (2, After)"], [122282691625, "integration_github_proposal (automatic)"], [122282691591, "integration_other (campaign)"], [122282691409, "integration_http_loss (1, Before)"], [122282691371, "integration_other (remaining)"], [122282691360, "integration_github_proposal (compiler-inputs)"], [122282691344, "fast_and_static"], [122282691299, "integration_github_proposal (remaining)"], [122282691135, "integration_campaign_crash"], [122282678324, "Analyze (python)"], [122282677970, "Analyze (csharp)"]]);
if(extra.length||checks.total_count!==22||new Set(checks.check_runs.map(v=>v.id)).size!==22
 ||[...originalChecks].some(([id,name])=>!checks.check_runs.some(v=>v.id===id&&v.name===name)))fail();
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

