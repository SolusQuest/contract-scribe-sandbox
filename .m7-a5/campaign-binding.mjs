// Caller-only exact separate diagnostic identity and one-use collision gate.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
export const targetSha='0ea0b71381ad78b8fe1f371441fe546171671ce1';
export const originalCoord='refs/heads/contract-scribe/coordination/fddfab7d34241bee29f478f81dc8fcc71d3a93195e8eab23d6f8289e23ab634f';
export const originalHead='d7cdfef50f9a8987e88f35d43fee15699ce9a95a';
export const priorDiagnosticCoord='refs/heads/contract-scribe/coordination/a9edaa6b9020d5d9674f90c4c7cb704de987cd605e97648cea302dc4d3e34831';
export const priorDiagnosticHead='40f8d521e38ad5ae9253287207f28399fbc31db0';
export const priorDiagnosticCCoord='refs/heads/contract-scribe/coordination/db01792b98a22a24b4b8f3d0d06476982ccbaf50d257e1dc5471870e17832d80';
export const priorDiagnosticCHead='6520b7a30b3fc8ea5d94358ff575569816cb8d99';
export const priorDiagnosticDCoord='refs/heads/contract-scribe/coordination/fd3d4c10b222c39080f7432dbf7ed50166f45dee57319d7f530d4a71dafed7e1';
export const priorDiagnosticDHead='07c9d1f5e7781788f031b206c458e6069d67ce50';
export const expected={githubCampaignVersion:1,campaignLineage:'campaign.m7.a5.20261022.flash.05',github:{repositoryOwner:'SolusQuest',repositoryName:'contract-scribe-sandbox',targetRef:'refs/heads/m7-a5-observation-20261022-e'}};
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
 if(!actual.equals(reviewed)||JSON.stringify(JSON.parse(actual))!==JSON.stringify(expected)||diagnosticCoord===originalCoord||diagnosticCoord===priorDiagnosticCoord||diagnosticCoord===priorDiagnosticCCoord||diagnosticCoord===priorDiagnosticDCoord||process.env.A5_TARGET_SHA!==targetSha)fail();
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
 if(read(base+'heads/m7-a5-observation-20261022-e').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-d').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-c').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-b').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022').object.sha!==targetSha
  ||read(base+originalCoord.slice(5)).object.sha!==originalHead
  ||read(base+priorDiagnosticCoord.slice(5)).object.sha!==priorDiagnosticHead
  ||read(base+priorDiagnosticCCoord.slice(5)).object.sha!==priorDiagnosticCHead
  ||read(base+priorDiagnosticDCoord.slice(5)).object.sha!==priorDiagnosticDHead
  ||!absent(base+diagnosticCoord.slice(5))
  ||!absent(base+'tags/m7-a5-budget-20261022-slot-05'))fail();
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{verifyFresh(process.argv[2]);}catch{console.error('Separate diagnostic binding/collision gate failed before slot claim.');process.exitCode=1;}
}
