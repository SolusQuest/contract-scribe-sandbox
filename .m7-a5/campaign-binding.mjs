// Caller-only exact separate diagnostic identity and one-use collision gate.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
export const targetSha='0ea0b71381ad78b8fe1f371441fe546171671ce1';
export const originalCoord='refs/heads/contract-scribe/coordination/fddfab7d34241bee29f478f81dc8fcc71d3a93195e8eab23d6f8289e23ab634f';
export const originalHead='d7cdfef50f9a8987e88f35d43fee15699ce9a95a';
export const expected={githubCampaignVersion:1,campaignLineage:'campaign.m7.a5.20261022.flash.02',github:{repositoryOwner:'SolusQuest',repositoryName:'contract-scribe-sandbox',targetRef:'refs/heads/m7-a5-observation-20261022-b'}};
const fail=()=>{throw Error('Separate diagnostic identity or one-use collision gate failed.');};
export function coordination(target,lineage){
 const h=createHash('sha256');
 const add=v=>{const b=Buffer.from(v,'utf8'),n=Buffer.alloc(4);n.writeUInt32BE(b.length);h.update(n);h.update(b);};
 add('domain');add('contract-scribe/github-coordination-ref/v1');
 for(const v of ['solusquest','contract-scribe-sandbox',target,lineage]){add('value');add(v);}
 return 'refs/heads/contract-scribe/coordination/'+h.digest('hex');
}
export const diagnosticCoord=coordination(expected.github.targetRef,expected.campaignLineage);
export function verifyBinding(file=new URL('./campaign.json',import.meta.url)){
 const actual=fs.readFileSync(file),reviewed=fs.readFileSync(new URL('./campaign.json',import.meta.url));
 if(!actual.equals(reviewed)||JSON.stringify(JSON.parse(actual))!==JSON.stringify(expected)||diagnosticCoord===originalCoord||process.env.A5_TARGET_SHA!==targetSha)fail();
 return expected;
}
const readApi=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:4*1024*1024}));
const absentApi=path=>{
 const r=spawnSync('gh',['api','--include',path],{encoding:'utf8',maxBuffer:65536});
 return r.status===1&&/(^|\n)HTTP\/[\d.]+ 404(?: |\r?$)/m.test(r.stdout||'');
};
export function verifyFresh(file,read=readApi,absent=absentApi){
 verifyBinding(file);
 const base='repos/SolusQuest/contract-scribe-sandbox/git/ref/';
 if(read(base+'heads/m7-a5-observation-20261022-b').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022').object.sha!==targetSha
  ||read(base+originalCoord.slice(5)).object.sha!==originalHead
  ||!absent(base+diagnosticCoord.slice(5))
  ||!absent(base+'tags/m7-a5-budget-20261022-slot-02'))fail();
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{verifyFresh(process.argv[2]);}catch{console.error('Separate diagnostic binding/collision gate failed before slot claim.');process.exitCode=1;}
}
