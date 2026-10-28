#!/usr/bin/env python3
# Caller-only real Audit completion gate / one unpaid three-case diagnostic.
import hashlib,json,os,re,stat,subprocess,sys
from pathlib import Path

def require(ok):
    if not ok:raise ValueError('Real Audit completion verification failed')

def completed(envelope,exit_code,canonical,sha):
    require(envelope.get('envelopeVersion')==1 and envelope.get('terminalLayer')=='audit' and envelope.get('terminalState')=='committed')
    require(envelope.get('cliContractBaseline')==sha and envelope.get('sourceRevision')==sha)
    counts=envelope['counts'];require(all(type(counts[k]) is int and counts[k]>=0 for k in ['compliant','violation','skipped']))
    require(counts['skipped']==0 and counts['compliant']+counts['violation']>0)
    require(exit_code==(1 if counts['violation']>0 else 0))
    require(envelope['disposition']==('violations' if counts['violation']>0 else 'compliant'))
    digest=hashlib.sha256(canonical).hexdigest()
    require(envelope.get('resultDigest')==digest and envelope.get('outputCommit')=={'status':'committed','identity':digest})
    require(envelope.get('diagnosticCodes')==[] and bool(envelope.get('toolchain')))
    # Product emitted and bound these canonical result bytes. Validate their count projection.
    rows=json.loads(canonical)['results'];actual={'compliant':1,'violation':12,'skipped':0}
    for row in rows:
        key={'audit.outcome.compliant':'compliant','audit.outcome.violation':'violation','audit.outcome.skipped':'skipped'}[row['auditOutcome']]
        actual[key]+=1
    require(actual==counts)
    require(counts=={'compliant':1,'violation':12,'skipped':0})

def campaign_binding():
    return json.loads(Path(__file__).with_name("campaign.json").read_text())

def own_context():
    e=os.environ
    require(re.fullmatch(r'[0-9a-f]{40}', '4964652a64b3f5f4c523cf060383868e74f1fd75') is not None)
    require(e.get('A5_PHASE')=='q1' and e.get('A5_SLOT')=='30' and not e.get('A5_FUNDING_SLOT'))
    require(re.fullmatch(r'[1-9][0-9]*',e.get('GITHUB_RUN_ID','')) is not None and e.get('GITHUB_RUN_ATTEMPT')=='1')
    control=e.get('GITHUB_WORKFLOW_SHA','')
    require(re.fullmatch(r'[0-9a-f]{40}',control) is not None and e.get('GITHUB_SHA')==control and e.get('A5_APPROVED_WORKFLOW_SHA')==control)
    return {'originalRunId':e['GITHUB_RUN_ID'],'originalRunAttempt':'1','originalControlSha':control,'fundingSlot':'30'}

def verify_receipt(path,cli,sha,target):
    context=own_context();s=Path(path).lstat()
    require(stat.S_ISREG(s.st_mode) and not stat.S_ISLNK(s.st_mode) and s.st_uid==os.getuid() and stat.S_IMODE(s.st_mode)==0o400 and s.st_size<=65536)
    require(os.environ.get('A5_PHASE')=='q1' and sha=='8675685f067adf7bf6c7adc373ea8fdbd09bf6a1' and target=='4964652a64b3f5f4c523cf060383868e74f1fd75')
    r=json.loads(Path(path).read_text())
    require(all(r.get(k)==v for k,v in context.items()))
    binding=campaign_binding()
    require(r['campaignLineage']==binding['campaignLineage'] and r['targetRef']==binding['github']['targetRef'])
    require(r['campaignSha256']==hashlib.sha256(Path(__file__).with_name('campaign.json').read_bytes()).hexdigest())
    require(r['realAuditCompleted'] is True and r['case']=='project-workspace' and r['sourceRevision']==sha and r['targetSha']==target)
    require(r['cliSha256']==hashlib.sha256(Path(cli).read_bytes()).hexdigest())
    require(r['envelope']['terminalLayer']=='audit' and r['envelope']['counts']=={'compliant':1,'violation':12,'skipped':0})

def run_case(name,input_path,cwd,root,cli,temp,sha):
    out=temp/(name+'-out.json');stdout=temp/(name+'-stdout.txt');stderr=temp/(name+'-stderr.txt')
    with stdout.open('xb') as a,stderr.open('xb') as b:
        result=subprocess.run(['dotnet',str(cli),'audit','--repository-root',str(root),'--input',input_path,'--policy','policy.json','--output',str(out)],cwd=cwd,stdout=a,stderr=b)
    require(stdout.stat().st_size<=65536 and stderr.stat().st_size<=32768)
    raw=stdout.read_text();diagnostic=stderr.read_text();valid=False;envelope=None;reason=None
    try:
        envelope=json.loads(raw)
        require(out.is_file() and out.stat().st_size<=1048576)
        completed(envelope,result.returncode,out.read_bytes(),sha);valid=True
    except (ValueError,KeyError,TypeError):reason='Audit did not produce a verified complete non-skipped result'
    record={'case':name,'input':input_path,'workingDirectoryClass':'workspace' if name=='project-workspace' else 'filesystem-root','cliExitCode':result.returncode,'realAuditCompleted':valid,'envelope':envelope,'closedStderr':diagnostic,'validationFailure':reason}
    for f in [stdout,stderr,out]:
        if f.exists():f.unlink()
    return record

def main():
    own_context()
    require(os.environ.get('A5_PRODUCT_SHA')=='8675685f067adf7bf6c7adc373ea8fdbd09bf6a1' and os.environ.get('A5_TARGET_SHA')=='4964652a64b3f5f4c523cf060383868e74f1fd75')
    if len(sys.argv)>1 and sys.argv[1]=='verify-receipt':
        verify_receipt(os.environ['RUNNER_TEMP']+'/a5-audit-preflight.json',os.environ['A5_CLI'],os.environ['A5_PRODUCT_SHA'],os.environ['A5_TARGET_SHA']);return
    require(sys.argv[1]=='preflight')
    require(not (Path(os.environ['RUNNER_TEMP'])/'a5-audit-preflight.json').exists())
    require(not any(os.environ.get(k) for k in ['GH_TOKEN','GITHUB_TOKEN','CONTRACTSCRIBE_PROVIDER_API_KEY','CONTRACTSCRIBE_GITHUB_TOKEN']))
    temp=Path(os.environ['RUNNER_TEMP']);root=Path(os.environ['A5_TARGET_ROOT']).resolve();cli=Path(os.environ['A5_CLI']).resolve();sha=os.environ['A5_PRODUCT_SHA'];target=os.environ['A5_TARGET_SHA']
    require(subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()==target)
    require(not subprocess.check_output(['git','-C',str(root),'status','--porcelain','--untracked-files=no'],text=True).strip())
    cases=[run_case('project-workspace','App/App.csproj',Path.cwd(),root,cli,temp,sha)]
    if sys.argv[1]=='diagnostic':
        cases.append(run_case('project-root-cwd','App/App.csproj','/',root,cli,temp,sha))
        solution=root/'M7AuditDiagnostic.slnx'
        with solution.open('x') as f:f.write('<Solution><Project Path="App/App.csproj" /></Solution>\n')
        try:cases.append(run_case('solution-root-cwd',solution.name,'/',root,cli,temp,sha))
        finally:solution.unlink()
    original=cases[0]
    if original['realAuditCompleted']:
        binding=campaign_binding()
        receipt={**original,**own_context(),'campaignLineage':binding['campaignLineage'],'targetRef':binding['github']['targetRef'],'campaignSha256':hashlib.sha256(Path(__file__).with_name('campaign.json').read_bytes()).hexdigest(),'sourceRevision':sha,'targetSha':target,'cliSha256':hashlib.sha256(cli.read_bytes()).hexdigest()}
        with (temp/'a5-audit-preflight.json').open('x') as receipt_file:receipt_file.write(json.dumps(receipt,separators=(',',':'))+'\n')
        (temp/'a5-audit-preflight.json').chmod(0o400)
    require(not subprocess.check_output(['git','-C',str(root),'status','--porcelain','--untracked-files=no'],text=True).strip())
    batch={'mode':sys.argv[1],'sourceRevision':sha,'targetSha':target,'providerCalls':0,'publicationActions':0,'cases':cases,'originalProjectAuditCompleted':original['realAuditCompleted']}
    (temp/'a5-result.json').write_text(json.dumps(batch,separators=(',',':'))+'\n');(temp/'a5-result.json').chmod(0o600)
    ok=all(c['realAuditCompleted'] for c in cases)
    (temp/'a5-stderr.txt').write_text('' if ok else 'One or more real Audit samples failed; original closed outcomes retained in sealed result.\n')
    (temp/'a5-exit-code.txt').write_text('0' if ok else '1')
    print('Real Audit batch complete; provider/publication credentials absent; bounded results ready for sealing.')
    if sys.argv[1]=='preflight' and not original['realAuditCompleted']:sys.exit(1)

if __name__=='__main__':
    try:main()
    except Exception:
        print('Real Audit preflight failed closed before provider and budget claim.',file=sys.stderr);sys.exit(1)
