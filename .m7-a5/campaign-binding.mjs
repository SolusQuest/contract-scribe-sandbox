// Caller-only exact separate diagnostic identity and one-use collision gate.
import fs from 'node:fs';
import {verify as verifyProfile} from './select-profile.mjs';
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
export const priorDiagnosticECoord='refs/heads/contract-scribe/coordination/906217db462a0a86d097be342bfc31c5ab552d0c61b1c03c8bfff2382ba75ba6';
export const priorDiagnosticEHead='3c990524adaab65aabb623f6347e65946444fe2d';
export const priorDiagnosticFCoord='refs/heads/contract-scribe/coordination/20eba573a78b4186a4b4ae665f35cef94fed4d748ca317763b643c1660dd123b';
export const priorDiagnosticFHead='b02e2b27394d8f54dd709bd1198230fb04c1f388';
export const priorDiagnosticGCoord='refs/heads/contract-scribe/coordination/064f43048a9b4935dd49c0b7a427b8aef7788905f4f1976609850cea342a02d4';
export const priorDiagnosticGHead='3bfd92657b113d60a191ec47f3c6c77eb80b49a7';
export const priorDiagnosticHCoord='refs/heads/contract-scribe/coordination/25f03f01d05712a79e54de6921ebc2b0218a4fc554bd15d8fb75be4aca09135a';
export const priorDiagnosticHHead='d7c09d992cca537911653b860f7f2bfa2cd3eca7';
export const priorDiagnosticICoord='refs/heads/contract-scribe/coordination/315cf82b6dc4f2b3875fd127aa016d2ee3b6279cf5439ee0c8232242fbd6a607';
export const priorDiagnosticIHead='b33398cdbe1932f3db887e5ac94941b21beefaf5';
export const expected={githubCampaignVersion:1,campaignLineage:'campaign.m7.a5.20261022.flash.19',github:{repositoryOwner:'SolusQuest',repositoryName:'contract-scribe-sandbox',targetRef:'refs/heads/m7-a5-observation-20261022-v'}};
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
 verifyProfile('19',new URL('./consumer.json',import.meta.url));
 const actual=fs.readFileSync(file),reviewed=fs.readFileSync(new URL('./campaign.json',import.meta.url));
 if(!actual.equals(reviewed)||JSON.stringify(JSON.parse(actual))!==JSON.stringify(expected)||diagnosticCoord===originalCoord||diagnosticCoord===priorDiagnosticCoord||diagnosticCoord===priorDiagnosticCCoord||diagnosticCoord===priorDiagnosticDCoord||diagnosticCoord===priorDiagnosticECoord||diagnosticCoord===priorDiagnosticFCoord||diagnosticCoord===priorDiagnosticGCoord||diagnosticCoord===priorDiagnosticHCoord||diagnosticCoord===priorDiagnosticICoord||Object.values(extendedFrozen).some(v=>v.coordinationRef===diagnosticCoord)||process.env.A5_TARGET_SHA!==targetSha)fail();
 return expected;
}

// Exact existing immutable inventory, through successful zero05 U; no old state is reused.
export const extendedFrozen={
  "S": {
  "targetRef": "refs/heads/m7-a5-observation-20261022-s",
  "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
  "coordinationRef": "refs/heads/contract-scribe/coordination/19a0c1709200f776c7b7f381752048ee862cd5711165a6207462d5bfe8be2747",
  "coordinationHead": "ca4e85ae344db841dfe21e77e190233b7c51b752"
},
  "R": {
  "targetRef": "refs/heads/m7-a5-observation-20261022-r",
  "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
  "coordinationRef": "refs/heads/contract-scribe/coordination/0fcde6e82fab8092f9c27665e3dbb4529aa7177c2273288f97619f9ee05ce380",
  "coordinationHead": "b3dcdae08ae0d03820b9d5ded1c12af1fc7e7e0a"
},
  "Q": {
    "targetRef": "refs/heads/m7-a5-observation-20261022-q",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/86f36226075adcf243f2fab195054cad853fa3429e9f9ebbae24afabd16e7db8",
    "coordinationHead": "d6a88d7a2e564755316dae8b55031506dfa91917"
},
  "P": {
    "targetRef": "refs/heads/m7-a5-observation-20261022-p",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/c2ccefbb15c361aabded2464c3ec1ffcf4070dff07fb7973522bc1bb8425ca4f",
    "coordinationHead": "e4e84a115f0ff20fce8a29a0ed6bb9850b8be2d2"
},
  "J": {
    "targetRef": "refs/heads/m7-a5-observation-20261022-j",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/fa7e283a3ba0eb3ef11449bb48c6cb3f1e381d61c5baff48b474be33feb13e26",
    "coordinationHead": "87a6dc28138c4108093936378126d7df442456cf"
  },
  "K": {
    "targetRef": "refs/heads/m7-a5-scripted-20261024-k",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/6641dc0ba4145005af95f387a9a2de6cf09ab3a9f3087f042b1d831f24ed6f64",
    "coordinationHead": "89ddf4cebd881797817bb26f05d946910f93d99a"
  },
  "L": {
    "targetRef": "refs/heads/m7-a5-scripted-20261025-l",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/5a528410f50b7322be2b2224a457ac0b5b6c71e9aa6f2530183ca11f346a8c9d",
    "coordinationHead": null
  },
  "M": {
    "targetRef": "refs/heads/m7-a5-scripted-20261025-m",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/0e244828a63771b57e5d7f6813c3ca1e1f68948bf1d62ac5f21b64919fc8f1f0",
    "coordinationHead": "5b82107b4fa0e5795c625f98d4a74050bec31143"
  },
  "N": {
    "targetRef": "refs/heads/m7-a5-scripted-20261025-n",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/a27ac127b769390401de604602836bf7171a7fea0f06349462e60dbf6bf03048",
    "coordinationHead": "90f61c1997fcaac18319ad332a28da574f42d301"
  },
  "O": {
    "targetRef": "refs/heads/m7-a5-observation-20261022-o",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/ba69074b0bf77813d332d8a19c85ef1a37dc9da8b9ca240bc6aec77277cae7c9",
    "coordinationHead": "e92639d681e8b8e7d1666fceedf2e05fd7adee80"
  },
  "T": {
    "targetRef": "refs/heads/m7-a5-observation-20261022-t",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/46cd76159a71866755a6828d057331fd3b48bae09646daa5fd89773a95597617",
    "coordinationHead": "8593ebcbd79722abe276cdc94634595962c57883"
  },
  "U": {
    "targetRef": "refs/heads/m7-a5-scripted-20261026-u",
    "targetHead": "0ea0b71381ad78b8fe1f371441fe546171671ce1",
    "coordinationRef": "refs/heads/contract-scribe/coordination/ec80aef9c5ecaa245d07ec64dc2f69d593b70df0a36c748d163d801781c554e0",
    "coordinationHead": "79ff5e677a2e337b559e637cb1727b15aa62e872"
  }
};
export const oldZeroClaims={
  "refs/tags/m7-a5-scripted-20261024-01": "ea280dccf6ec60a7c541e2c12dcf1830058040fc",
  "refs/tags/m7-a5-scripted-20261025-02": null,
  "refs/tags/m7-a5-scripted-20261025-03": "d269eaacd4aeac63af438b8ef02fa61cfe5e3640",
  "refs/tags/m7-a5-scripted-20261025-04": "2e0de0938956a233c349bb62299de99b41893da3",
  "refs/tags/m7-a5-scripted-20261026-05": "856e1d9a2495fa04b132ac2bc8b45e234b300dcd"
};
export const oldBudgetTags={
  "refs/tags/m7-a5-budget-20261022-slot-17": "7967cfe96bf1271aae6ade724158f3280570df7f",
  "refs/tags/m7-a5-budget-20261022-slot-16": "ece60bb6fdf684386e62cba01c7f57fee0880a2a",
  "refs/tags/m7-a5-budget-20261022-slot-15": "a7c6565cc306d05f35dbb596172196c9abdf20a3",
  "refs/tags/m7-a5-budget-20261022-slot-14": "af9e8c3aab612188bb456c0569767e7e819f38e3",
  "refs/tags/m7-a5-budget-20261022-slot-02": "74c8fb1f93403495a72d62419b43d9b99d23281f",
  "refs/tags/m7-a5-budget-20261022-slot-03": "065f42d8c3d4ed0cef01ade2e48b51c0f3931819",
  "refs/tags/m7-a5-budget-20261022-slot-04": "69cbe35bbf18e552bcf6018ca83cd362e7f5bf59",
  "refs/tags/m7-a5-budget-20261022-slot-05": "1e4aafaa7e6c27010014b56f8f510fefe68c2ed6",
  "refs/tags/m7-a5-budget-20261022-slot-06": "7ed9667d2e93c5f74b011c39454dd335b2ffd4c4",
  "refs/tags/m7-a5-budget-20261022-slot-07": "7a64d099d94cfd920757c44b40cc82d6b9acda13",
  "refs/tags/m7-a5-budget-20261022-slot-08": "ee0fab5906e0b7dfc774306ebe2b783e14dfbd61",
  "refs/tags/m7-a5-budget-20261022-slot-09": "2abce847f421807a11e2b1144dae26da0774e2a2",
  "refs/tags/m7-a5-budget-20261022-slot-10": "b72c7449e46d14f0dbbcce84c9656467237fdfef",
  "refs/tags/m7-a5-budget-20261022-slot-11": "649b301a983b00fa81f9aaf20af4fd25fcfac8a9",
  "refs/tags/m7-a5-budget-20261022-slot-12": "653fb2c9f477b2d6bd3e92d82b8849ac6625752b",
  "refs/tags/m7-a5-budget-20261022-slot-13": "6a498abb71e5912bd0710971aa75388ef278de63",
  "refs/tags/m7-a5-budget-20261022-slot-18": "7977914579543e043e8d3f0fd9cae7f7301a8f73"
};
export const oldPrsSha256='8963b86da109d1b547b519d6ecc4b7d46cfe899ab3f7479fb920ec4288392203';
export const sourceFeedbackSha256='d18c47fcb79d29106336f7e3830220b58ce21a8ed743454f107f589f1bb54216';

export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const readApi=path=>JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',maxBuffer:4*1024*1024}));
const absentApi=path=>{
 const r=spawnSync('gh',['api','--include',path],{encoding:'utf8',maxBuffer:65536});
 if(r.error||r.status!==1)return false;
 const text=(r.stdout||'').replaceAll('\r\n','\n'),i=text.indexOf('\n\n');
 if(i<0||!/^HTTP\/[\d.]+ 404(?: |$)/.test(text.slice(0,i)))return false;
 try{const body=JSON.parse(text.slice(i+2));return body.status==='404'&&body.message==='Not Found';}catch{return false;}
};
export function verifyFresh(file,read=readApi,absent=absentApi,claimedControl=null){
 verifyBinding(file);
 const base='repos/SolusQuest/contract-scribe-sandbox/git/ref/';
 if(read(base+'heads/m7-a5-observation-20261022-v').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-i').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-h').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-g').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-f').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-e').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-d').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-c').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022-b').object.sha!==targetSha
  ||read(base+'heads/m7-a5-observation-20261022').object.sha!==targetSha
  ||read(base+originalCoord.slice(5)).object.sha!==originalHead
  ||read(base+priorDiagnosticCoord.slice(5)).object.sha!==priorDiagnosticHead
  ||read(base+priorDiagnosticCCoord.slice(5)).object.sha!==priorDiagnosticCHead
  ||read(base+priorDiagnosticDCoord.slice(5)).object.sha!==priorDiagnosticDHead
  ||read(base+priorDiagnosticECoord.slice(5)).object.sha!==priorDiagnosticEHead
  ||read(base+priorDiagnosticFCoord.slice(5)).object.sha!==priorDiagnosticFHead
  ||read(base+priorDiagnosticGCoord.slice(5)).object.sha!==priorDiagnosticGHead
  ||read(base+priorDiagnosticHCoord.slice(5)).object.sha!==priorDiagnosticHHead
  ||read(base+priorDiagnosticICoord.slice(5)).object.sha!==priorDiagnosticIHead
  ||!absent(base+diagnosticCoord.slice(5)))fail();

 for(const frozen of Object.values(extendedFrozen)){
  const target=read(base+frozen.targetRef.slice(5));
  if(target.ref!==frozen.targetRef||target.object?.type!=='commit'||target.object.sha!==frozen.targetHead)fail();
  if(frozen.coordinationHead===null){if(!absent(base+frozen.coordinationRef.slice(5)))fail();}
  else {const coord=read(base+frozen.coordinationRef.slice(5));if(coord.ref!==frozen.coordinationRef||coord.object?.type!=='commit'||coord.object.sha!==frozen.coordinationHead)fail();}
 }
 for(const [ref,head] of Object.entries(oldZeroClaims)){
  if(head===null){if(!absent(base+ref.slice(5)))fail();}
  else {const value=read(base+ref.slice(5));if(value.ref!==ref||value.object?.type!=='commit'||value.object.sha!==head)fail();}
 }
 const claimRef='refs/tags/m7-a5-budget-20261022-slot-19';
 const wantedTags={...oldBudgetTags};
 if(claimedControl===null){if(!absent(base+claimRef.slice(5)))fail();}
 else {
  if(!/^[a-f0-9]{40}$/.test(claimedControl)||claimedControl!==process.env.GITHUB_SHA||claimedControl!==process.env.GITHUB_WORKFLOW_SHA||claimedControl!==process.env.A5_APPROVED_WORKFLOW_SHA)fail();
  const claimed=read(base+claimRef.slice(5));if(claimed.ref!==claimRef||claimed.object?.type!=='commit'||claimed.object.sha!==claimedControl)fail();
  wantedTags[claimRef]=claimedControl;
 }
 const tags=read('repos/SolusQuest/contract-scribe-sandbox/git/matching-refs/tags/m7-a5-budget-20261022-slot-?per_page=100');
 if(!Array.isArray(tags)||tags.length!==Object.keys(wantedTags).length||tags.some(v=>v.object?.type!=='commit')||canonical(Object.fromEntries(tags.map(v=>[v.ref,v.object.sha])))!==canonical(wantedTags))fail();
 const prs=read('repos/SolusQuest/contract-scribe-sandbox/pulls?state=all&per_page=100');
 if(!Array.isArray(prs)||prs.length!==9)fail();
 const selected=prs.map(v=>({number:v.number,state:v.state,title:v.title,body:v.body,draft:v.draft,merged_at:v.merged_at,headSha:v.head.sha,baseSha:v.base.sha,baseRef:v.base.ref,userId:v.user.id})).sort((a,b)=>a.number-b.number);
 if(sha256(canonical(selected))!==oldPrsSha256)fail();
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{verifyFresh(process.argv[2],undefined,undefined,process.argv[3]??null);}catch{console.error('Separate diagnostic binding/collision gate failed before provider dispatch.');process.exitCode=1;}
}
