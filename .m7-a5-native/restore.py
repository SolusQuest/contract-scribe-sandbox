"""Restore controller evidence only; the CLI reads its own same-product remote checkpoint."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,zipfile,stat,importlib.util
HERE=Path(__file__).resolve().parent
SOURCE='0d2fafd5af9261c3fa04199663d4590a507c3224'
OLD_CONTROL='b6d7692a7ca4dc2fc0ba95572146ed708ff9108e'
ORIGINAL_RUN=41007280676
ARTIFACT=12955798765
SIZE=12605
DIGEST='245271742de50d775b1997ddb31d25a3f5f86766a01c2b73d82a243cde34a863'
MERGED='eb3852df9f75e0791e3a4d39c8992089cd8b811e'
PREVIOUS='6a9ad5f7e424fa30a7680218c044c9aa75ef3276'
HEAD='7165a1c6302258f053e32a9482e03444bd6ee6d2'
WORK=Path(os.environ['RUNNER_TEMP'])/'m7-native-lifecycle'
def require(x):
    if not x:raise ValueError('original successful prefix rejected')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
try:
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY') and not os.environ.get('CONTRACTSCRIBE_GITHUB_TOKEN'))
    require(os.environ.get('GITHUB_REPOSITORY')=='SolusQuest/contract-scribe-sandbox' and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch' and os.environ.get('GITHUB_RUN_ATTEMPT')=='1')
    require(os.environ['GITHUB_SHA']==os.environ['GITHUB_WORKFLOW_SHA']==os.environ['LIFE_APPROVED_CONTROL'])
    require(subprocess.check_output(['git','-C','product','rev-parse','HEAD'],text=True).strip()==SOURCE)
    require(subprocess.check_output(['git','-C','target','rev-parse','HEAD'],text=True).strip()==MERGED)
    require(sha(os.environ['LIFE_CLI'])==os.environ['LIFE_CLI_SHA256'])
    WORK.mkdir(mode=0o700);archive=WORK/'prior-original-41007280676.zip'
    with archive.open('xb')as f:p=subprocess.run(['gh','api',f'repos/SolusQuest/contract-scribe-sandbox/actions/artifacts/{ARTIFACT}/zip'],stdout=f,stderr=subprocess.PIPE,timeout=120)
    require(p.returncode==0 and archive.stat().st_size==SIZE and sha(archive)==DIGEST)
    with zipfile.ZipFile(archive)as z:
        require(1<=len(z.infolist())<=30 and sum(x.file_size for x in z.infolist())<8*1024*1024)
        for i in z.infolist():
            q=Path(i.filename);require(not q.is_absolute() and '..'not in q.parts and not stat.S_ISLNK(i.external_attr>>16))
        def raw(name):
            names=[n for n in z.namelist()if n.endswith('/'+name)];require(len(names)==1);return z.read(names[0])
        original_state=raw('state.json');state=json.loads(original_state)
        require(state['source']==SOURCE and state['control']==OLD_CONTROL and str(state['run'])==str(ORIGINAL_RUN))
        require(state['completed']==['audit-q1','claim-q1','paid-q1','readme2','changed-base'] and state['failedPhase']=='merge-q1' and state['failureClass']=='KeyError')
        require(state['targetSha']==PREVIOUS and state['prs']['q1']['number']==24 and state['prs']['q1']['head']==HEAD and state['prs']['q1']['actualAddedDocumentationMethods']==['Method05','Method08'])
        q1=json.loads(raw('q1-result.json'));u=q1['invocationUsage'];require(q1['outcome']=='github-proposal.published' and q1['cliContractBaseline']==SOURCE and u['calls']['physicalProviderDispatches']==4 and u['work']['acceptedTargets']==2 and u['work']['skippedTargets']==u['work']['failedTargets']==0)
        zero=json.loads(raw('changed-base-result.json'));require(zero['outcome']=='github-proposal.stale' and zero['invocationUsage']['calls']['physicalProviderDispatches']==0)
        require(json.loads(raw('claim-q1.json'))==json.loads(raw('launch-q1.json')) and state['claims']['q1']['slot']=='69')
        for name in ['q1-result.json','changed-base-result.json','claim-q1.json','launch-q1.json','audit-q1-audit.json','audit-q1-audit-envelope.json']:(WORK/name).write_bytes(raw(name))
        previous_events=raw('events.jsonl')
    require(state['consumerSha256']==sha(HERE/'consumer.json') and state['campaignSha256']==sha(HERE/'campaign.json'))
    campaign=json.loads((HERE/'campaign.json').read_text());require(state['campaign']==campaign['campaignLineage'] and state['targetRef']==campaign['github']['targetRef'])
    state['source']=SOURCE;state['control']=os.environ['GITHUB_SHA'];state['run']=os.environ['GITHUB_RUN_ID']
    state['priorContinuations']=[{'run':ORIGINAL_RUN,'control':OLD_CONTROL,'source':SOURCE,'artifact':ARTIFACT,'archiveSHA256':DIGEST,'stateSHA256':hashlib.sha256(original_state).hexdigest(),'originalConclusion':'failure','originalKeyErrorRetained':True,'controllerEvidenceOnlyNoProductCheckpointCopied':True}]
    state['activePhase']='reconcile-already-merged-q1';state['targetSha']=MERGED;state['preparedTargetSha']=MERGED
    state.pop('failedPhase');state.pop('failureClass');(WORK/'events.jsonl').write_bytes(previous_events)
    spec=importlib.util.spec_from_file_location('bounded_lifecycle',HERE/'lifecycle.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.state=state
    require(m.head()==MERGED);m.save()
    m.git(['fetch','--no-tags','--no-write-fetch-head','https://github.com/'+m.REPO+'.git',state['targetRef']+':refs/lifecycle/target',PREVIOUS+':refs/lifecycle/q1-previous',state['prs']['q1']['headRef']+':refs/lifecycle/q1-head'],network=True)
    m.verify_proposal(state['prs']['q1'])
    state['prs']['q1']['phase']='q1';m.confirm_merge(state['prs']['q1'],MERGED,PREVIOUS,fetch=False)
    state['completed'].append('merge-q1');state['activePhase']=None;m.save()
    m.event({'type':'verified-original-q1-prefix','originalRun':ORIGINAL_RUN,'originalFailureRetained':True,'repeatedQ1OrMerge':False,'sameCampaignProductCheckpointReauthenticatedByCLI':True})
    print('Original Q1 and actual normal merge reconciled; only Q2/Q3 may run after fresh Audit4.')
except BaseException:
    print('Original Q1 reconciliation failed closed; no paid work or mutation replayed.',file=sys.stderr);sys.exit(1)
