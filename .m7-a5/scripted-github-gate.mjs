// One-purpose caller gates. Imports are pure: no network or mutation on import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
export const binding=JSON.parse(fs.readFileSync(path.join(here,'scripted-github-binding.json')));
export function requireThat(ok){if(!ok)throw Error('Scripted GitHub gate rejected');}
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function coordination(b=binding){
 const h=crypto.createHash('sha256');
 const [owner,name]=b.repository.toLowerCase().split('/');
 for(const value of ['domain','contract-scribe/github-coordination-ref/v1','value',owner,'value',name,'value',b.targetRef,'value',b.campaignLineage]){
  const bytes=Buffer.from(value);const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length);h.update(length);h.update(bytes);
 }
 return 'refs/heads/contract-scribe/coordination/'+h.digest('hex');
}
export function validateEndpoint(endpoint){
 const u=new URL(endpoint);
 requireThat(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port!==''&&u.port!=='80'
  &&u.pathname==='/chat/completions'&&!u.search&&!u.hash&&!u.username&&!u.password
  &&endpoint===`http://127.0.0.1:${u.port}/chat/completions`);
 return endpoint;
}
function command(exe,args,cwd){
 const r=spawnSync(exe,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:8*1024*1024});
 requireThat(!r.error&&r.status===0);return r.stdout.trim();
}
function git(args,root=path.dirname(here)){return command('git',['-C',root,...args]);}
function privateJSON(file){
 const s=fs.lstatSync(file);requireThat(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o777)===0o400&&s.size<131072);
 return JSON.parse(fs.readFileSync(file));
}
function writePrivate(file,value){fs.writeFileSync(file,JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});fs.chmodSync(file,0o400);}
export function validateBinding(b=binding){
 requireThat(b.repository==='SolusQuest/contract-scribe-sandbox'&&b.repositoryId===1361354906
  &&b.sourceRepository==='SolusQuest/contract-scribe'&&b.sourceRepositoryId===1297409952
  &&b.source==='ed083fab0748a2ae7c6c662c7fa2c806119144d6'&&b.sourcePr===261
  &&b.purpose==='m7-a5-scripted-github-20261025-02'
  &&b.targetRef==='refs/heads/m7-a5-scripted-20261025-l'
  &&b.campaignLineage==='campaign.m7.a5.scripted.20261025.02'
  &&b.claimRef==='refs/tags/m7-a5-scripted-20261025-02'
  &&coordination(b)===b.coordinationRef&&b.maximumWorkflowAttempts===1&&b.maximumOuterInvocations===1
  &&b.maximumExternalModelRequests===0&&b.maximumSyntheticRequests===8&&b.firstResponseHoldMilliseconds===61000
  &&b.targetSha==='0ea0b71381ad78b8fe1f371441fe546171671ce1'
  &&b.frozen.K?.targetRef==='refs/heads/m7-a5-scripted-20261024-k'
  &&b.frozen.K?.coordinationRef==='refs/heads/contract-scribe/coordination/6641dc0ba4145005af95f387a9a2de6cf09ab3a9f3087f042b1d831f24ed6f64'
  &&b.frozen.K?.coordinationHead==='89ddf4cebd881797817bb26f05d946910f93d99a'
  &&Object.keys(b.oldZeroPurposeClaims??{}).length===1
  &&b.oldZeroPurposeClaims['refs/tags/m7-a5-scripted-20261024-01']==='ea280dccf6ec60a7c541e2c12dcf1830058040fc'
  &&b.requiredBotActor===41898282&&b.HostMilliseconds===300000&&b.ModelMilliseconds===600000
  &&b.consumer.provider.endpoint===null&&b.consumer.provider.model==='fixed-synthetic-noop'
  &&b.consumer.budgets.invocation.maximumTargets===5&&b.consumer.budgets.invocation.maximumProviderRequests===8
  &&b.consumer.budgets.invocation.maximumElapsedMilliseconds===600000
  &&b.consumer.budgets.invocation.maximumRequestElapsedMilliseconds===90000
  &&b.consumer.budgets.invocation.maximumConnectMilliseconds===10000);
}
export function verifyControl(env=process.env){
 validateBinding();
 requireThat(env.GITHUB_REPOSITORY===binding.repository&&env.GITHUB_EVENT_NAME==='workflow_dispatch'
  &&env.GITHUB_RUN_ATTEMPT==='1'&&/^[a-f0-9]{40}$/.test(env.A5_APPROVED_WORKFLOW_SHA??'')
  &&env.GITHUB_WORKFLOW_SHA===env.A5_APPROVED_WORKFLOW_SHA&&env.GITHUB_SHA===env.GITHUB_WORKFLOW_SHA
  &&git(['rev-parse','HEAD'])===env.GITHUB_WORKFLOW_SHA&&git(['status','--porcelain'])==='');
 for(const name of ['CONTRACTSCRIBE_PROVIDER_API_KEY','DOTNET_STARTUP_HOOKS','CONTRACTSCRIBE_TEST_GITHUB_ENDPOINT','CONTRACTSCRIBE_TEST_GITHUB_FAULT'])requireThat(!env[name]);
 const actual=git(['ls-files','--stage']).split('\n').map(s=>{const [meta,p]=s.split('\t');return {path:p,mode:meta.split(' ')[0]};});
 const additions=['.github/workflows/m7-a5-scripted-github.yml','.m7-a5/scripted-provider.py','.m7-a5/scripted-github-gate.mjs','.m7-a5/scripted-github-launch.sh','.m7-a5/scripted-github-binding.json'];
 requireThat(actual.length===36&&new Set(actual.map(x=>x.path)).size===36);
 for(const old of binding.oldControlFiles){
  requireThat(actual.some(x=>x.path===old.path&&x.mode===old.mode));
  const f=path.join(here,'..',old.path);requireThat(sha256(fs.readFileSync(f))===old.sha256);
 }
 for(const p of additions)requireThat(actual.some(x=>x.path===p&&x.mode==='100644'));
 requireThat(sha256(fs.readFileSync(path.join(here,'approved-products.json')))===binding.sourceAllowlistSha256);
}
function api(route){
 const r=spawnSync('gh',['api',route],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:16*1024*1024});
 requireThat(!r.error&&r.status===0);return JSON.parse(r.stdout);
}
function absent(ref){
 const r=spawnSync('gh',['api',`repos/${binding.repository}/git/ref/${ref.slice(5)}`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:65536});
 // An actual HTTP404 is required; permission/network/other failure is not absence.
 requireThat(!r.error&&r.status===1&&/\(HTTP 404\)/.test(r.stderr));
 let value;try{value=JSON.parse(r.stdout);}catch{requireThat(false);}
 requireThat(value?.status==='404'&&value?.message==='Not Found');
}
function pages(route,key){
 const all=[];for(let page=1;page<=50;page++){
  const value=api(route+(route.includes('?')?'&':'?')+`per_page=100&page=${page}`);
  const rows=key?value[key]:value;requireThat(Array.isArray(rows));all.push(...rows);
  if(rows.length<100){if(key&&Number.isInteger(value.total_count))requireThat(all.length===value.total_count);return all;}
 }requireThat(false);
}
function refHead(ref,expected){const value=api(`repos/${binding.repository}/git/ref/${ref.slice(5)}`);requireThat(value.ref===ref&&value.object?.type==='commit'&&value.object.sha===expected);}
function freeze(){
 for(const value of Object.values(binding.frozen)){refHead(value.targetRef,value.targetHead);refHead(value.coordinationRef,value.coordinationHead);}
 for(const [ref,head] of Object.entries(binding.oldZeroPurposeClaims))refHead(ref,head);
 const tags=pages(`repos/${binding.repository}/git/matching-refs/tags/m7-a5-budget-`);
 requireThat(sha256(canonical(Object.fromEntries(tags.map(t=>[t.ref,t.object.sha]))))===sha256(canonical(binding.oldBudgetTags)));
 const prs=pages(`repos/${binding.repository}/pulls?state=all`).map(p=>({number:p.number,state:p.state,title:p.title,body:p.body,draft:p.draft,merged_at:p.merged_at,headSha:p.head.sha,baseSha:p.base.sha,baseRef:p.base.ref,userId:p.user.id})).sort((a,b)=>a.number-b.number);
 requireThat(sha256(canonical(prs))===binding.oldPrsSha256);
}
function inventory(own){
 const rows=pages(`repos/${binding.repository}/actions/runs`,'workflow_runs');
 requireThat(rows.filter(r=>r.id===own).length===1&&rows.every(r=>r.id===own||(r.status==='completed'&&r.conclusion!==null)));
 const active=rows.find(r=>r.id===own);requireThat(active.head_sha===process.env.GITHUB_SHA&&active.run_attempt===1&&active.event==='workflow_dispatch'&&['queued','in_progress'].includes(active.status));
 return rows.filter(r=>r.id!==own).map(r=>[r.id,r.run_attempt,r.head_sha,r.status,r.conclusion]).sort((a,b)=>a[0]-b[0]);
}
function feedback(){
 const query=`query { repository(owner:"SolusQuest",name:"contract-scribe") { pullRequest(number:261) {
 number headRefOid baseRefOid isDraft state reviewDecision
 comments(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} body createdAt updatedAt url } }
 reviews(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id databaseId author {login} state body submittedAt commit {oid} url } }
 reviewThreads(first:100) { totalCount pageInfo {hasNextPage endCursor} nodes { id isResolved isOutdated path line startLine comments(first:100) {totalCount pageInfo {hasNextPage endCursor} nodes {id databaseId author {login} body createdAt updatedAt url originalCommit {oid} commit {oid}}} } }
 } } }`;
 const r=spawnSync('gh',['api','graphql','-f','query='+query],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:8*1024*1024});
 requireThat(!r.error&&r.status===0);const value=JSON.parse(r.stdout);requireThat(!value.errors);
 const p=value.data.repository.pullRequest;
 for(const c of [p.comments,p.reviews,p.reviewThreads,...p.reviewThreads.nodes.map(t=>t.comments)]){
  requireThat(c.pageInfo.hasNextPage===false&&(!('totalCount' in c)||c.totalCount===c.nodes.length));
 }
 requireThat(sha256(canonical(p))===binding.sourceFeedbackSha256);
}
export function preflight(){
 verifyControl();const b=binding;const own=Number(process.env.GITHUB_RUN_ID);requireThat(Number.isSafeInteger(own)&&own>0);
 requireThat(api(`repos/${b.repository}`).id===b.repositoryId&&api(`repos/${b.sourceRepository}`).id===b.sourceRepositoryId);
 const pr=api(`repos/${b.sourceRepository}/pulls/${b.sourcePr}`);
 requireThat(pr.state==='open'&&pr.draft&&!pr.merged_at&&pr.head.sha===b.source&&pr.head.repo.full_name===b.sourceRepository&&pr.base.sha===b.sourceBase&&pr.base.ref==='main');
 const runs=pages(`repos/${b.sourceRepository}/actions/runs?head_sha=${b.source}`,'workflow_runs');
 for(const id of [311270030,343249902]){
  const r=runs.filter(r=>r.workflow_id===id&&r.head_sha===b.source&&['push','pull_request','dynamic'].includes(r.event)).sort((a,z)=>z.id-a.id)[0];
  requireThat(r?.status==='completed'&&r.conclusion==='success'&&r.repository.full_name===b.sourceRepository);
 }
 const checks=pages(`repos/${b.sourceRepository}/commits/${b.source}/check-runs`,'check_runs');
 requireThat(checks.length===22&&checks.every(c=>c.head_sha===b.source&&c.status==='completed'&&(c.conclusion==='success'||(c.name==='integration_unfiltered_evidence'&&c.conclusion==='skipped')))&&checks.filter(c=>c.conclusion==='success').length===21);
 const artifact=api(`repos/${b.sourceRepository}/actions/artifacts/${b.payload.artifactId}`);
 requireThat(!artifact.expired&&artifact.name===b.payload.artifactName&&artifact.digest==='sha256:'+b.payload.zipSha256&&artifact.workflow_run.id===b.payload.producerRunId&&artifact.workflow_run.head_sha===b.source);
 feedback();const before=inventory(own);freeze();refHead(b.targetRef,b.targetSha);absent(b.coordinationRef);absent(b.claimRef);
 requireThat(sha256(canonical(before))===sha256(canonical(inventory(own))));
 console.log('Exact source, terminal quality, frozen old state and fresh single-use identity verified.');
}
function prepareCampaign(){
 verifyControl();for(const n of ['GH_TOKEN','GITHUB_TOKEN','CONTRACTSCRIBE_GITHUB_TOKEN'])requireThat(!process.env[n]);
 const dir=path.join(process.env.RUNNER_TEMP,'a5-scripted-audit');fs.mkdirSync(dir,{mode:0o700});
 writePrivate(path.join(dir,'campaign.json'),{githubCampaignVersion:1,campaignLineage:binding.campaignLineage,github:{repositoryOwner:'SolusQuest',repositoryName:'contract-scribe-sandbox',targetRef:binding.targetRef}});
 // Reuse original Audit producer/receipt consumer bytes without changing its old J binding.
 fs.copyFileSync(path.join(here,'audit-preflight.py'),path.join(dir,'audit-preflight.py'),fs.constants.COPYFILE_EXCL);
 fs.chmodSync(path.join(dir,'audit-preflight.py'),0o400);
}
function prepareConsumer(){
 verifyControl();const ready=privateJSON(path.join(process.env.RUNNER_TEMP,'a5-scripted-ready.json'));
 requireThat(ready.pid===Number(process.env.A5_SCRIPTED_OWNED_PID)&&ready.pid>1);process.kill(ready.pid,0);
 const value=structuredClone(binding.consumer);value.provider.endpoint=validateEndpoint(ready.endpoint);
 writePrivate(path.join(process.env.RUNNER_TEMP,'a5-scripted-consumer.json'),value);
}
function verifyPrepared(){
 const temp=process.env.RUNNER_TEMP;const ready=privateJSON(path.join(temp,'a5-scripted-ready.json'));
 const consumer=privateJSON(path.join(temp,'a5-scripted-consumer.json'));
 const expected=structuredClone(binding.consumer);expected.provider.endpoint=validateEndpoint(ready.endpoint);
 requireThat(sha256(canonical(consumer))===sha256(canonical(expected))&&ready.pid===Number(process.env.A5_SCRIPTED_OWNED_PID));
 const campaign=privateJSON(path.join(temp,'a5-scripted-audit/campaign.json'));
 requireThat(canonical(campaign)===canonical({githubCampaignVersion:1,campaignLineage:binding.campaignLineage,github:{repositoryOwner:'SolusQuest',repositoryName:'contract-scribe-sandbox',targetRef:binding.targetRef}}));
 requireThat(git(['rev-parse','HEAD'],process.env.A5_TARGET_ROOT)===binding.targetSha&&git(['status','--porcelain','--untracked-files=no'],process.env.A5_TARGET_ROOT)==='');
}
function claim(){
 verifyControl();verifyPrepared();
 const r=spawnSync('gh',['api','--method','POST',`repos/${binding.repository}/git/refs`,'-f','ref='+binding.claimRef,'-f','sha='+process.env.GITHUB_SHA],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:65536});
 // A timeout or ambiguous acknowledgement is terminal; never repeat this POST.
 requireThat(!r.error&&r.status===0);const result=JSON.parse(r.stdout);
 requireThat(result.ref===binding.claimRef&&result.object?.type==='commit'&&result.object.sha===process.env.GITHUB_SHA);
 refHead(binding.claimRef,process.env.GITHUB_SHA);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const mode=process.argv[2];
  if(mode==='preflight')preflight();else if(mode==='prepare-campaign')prepareCampaign();
  else if(mode==='prepare-consumer')prepareConsumer();else if(mode==='verify-prepared')verifyPrepared();else if(mode==='claim')claim();else requireThat(false);
 }catch{console.error('Scripted GitHub gate failed closed; no raw service response logged.');process.exitCode=1;}
}
