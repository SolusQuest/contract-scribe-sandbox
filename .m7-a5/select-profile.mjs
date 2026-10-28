// Prospective Q1 funded5 purpose: prospective Q1 funding29, candidate-only campaign Y.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const paidProfileSHA256='ad2fe4d8fb501cc66131a7ed667887e3039b839dabe229abd8a4e713d345a03d';
export function profileName(slot){if(slot!=='33')throw Error('Inactive or retired funding slot.');return 'consumer.json';}
export function verify(slot,file){
 const wanted=fs.readFileSync(new URL('./'+profileName(slot),import.meta.url)),actual=fs.readFileSync(file);
 if(!actual.equals(wanted)||createHash('sha256').update(actual).digest('hex')!==paidProfileSHA256)throw Error('Exact candidate Q1 funding29 full profile rejected.');
 const v=JSON.parse(actual);if(v.timeouts?.checkpointAcceptanceMilliseconds!==90000||v.timeouts.repositoryToolMilliseconds!==90000||Object.keys(v.timeouts).length!==2)throw Error('Checkpoint configuration changed.');const i=v.budgets.invocation,c=v.budgets.campaign;
 if(i.maximumTargets!==5||i.maximumProviderRequests!==6||i.maximumCachedInputTokens!==130966||i.maximumUncachedInputTokens!==130966||i.maximumOutputTokens!==24576||i.maximumRequestOutputTokens!==4096||i.maximumElapsedMilliseconds!==1200000||i.maximumRequestElapsedMilliseconds!==90000||i.maximumConnectMilliseconds!==10000||i.maximumToolCalls!==64||i.maximumToolCallsPerResponse!==8
 ||c.maximumProviderRequests!==24||c.maximumInputTokens!==1047732||c.maximumUncachedInputTokens!==523866||c.maximumOutputTokens!==98304||c.maximumCostMicrounits!==2881920||c.maximumAttemptsPerTarget!==2||c.maximumCandidatesPerBlock!==30||c.maximumElapsedMilliseconds!==6587252)throw Error('Original per-invocation or accepted cumulative limits changed.');
 const worst=BigInt(i.maximumCachedInputTokens+i.maximumUncachedInputTokens)*2n+BigInt(i.maximumOutputTokens)*8n+7n;
 if(worst>720480n)throw Error('Full permanent hold insufficient for configured exposure.');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{const [mode,slot,file]=process.argv.slice(2);if(mode==='copy')fs.copyFileSync(new URL('./'+profileName(slot),import.meta.url),file);else if(mode!=='verify')throw Error('mode');verify(slot,file);}
 catch{console.error('Exact Q1 funded5 slot/profile rejected.');process.exitCode=1;}
}
