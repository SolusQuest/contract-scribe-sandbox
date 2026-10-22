#!/usr/bin/env python3
# Run-local caller acquisition; no provider credential or executable invocation.
import hashlib,json,os,subprocess,sys,zipfile,stat
from pathlib import Path
MAX_ZIP=256*1024*1024

def require(ok):
    if not ok:raise ValueError('Reviewed current-CI payload identity rejected')

def validate_metadata(artifact,run,jobs,pin,sha):
    require(artifact['id']==pin['artifactId'] and artifact['name']==pin['artifactName'] and not artifact['expired'])
    require(0<artifact['size_in_bytes']<=MAX_ZIP and artifact['digest']=='sha256:'+pin['zipSha256'])
    require(artifact['workflow_run']['id']==pin['producerRunId'] and artifact['workflow_run']['head_sha']==sha and artifact['workflow_run']['repository_id']==1297409952)
    require(run['id']==pin['producerRunId'] and run['head_sha']==sha and run['workflow_id']==311270030 and run['repository']['full_name']=='SolusQuest/contract-scribe' and run['status']=='completed' and run['conclusion']=='success' and run['run_attempt']>=pin['producerAttempt'])
    for name in ['payload_producer','packed_payload']:
        matches=[j for j in jobs['jobs'] if j['name']==name]
        require(len(matches)==1 and matches[0]['status']=='completed' and matches[0]['conclusion']=='success')

def unpack(zip_path,dest,pin):
    require(zip_path.stat().st_size<=MAX_ZIP and hashlib.sha256(zip_path.read_bytes()).hexdigest()==pin['zipSha256'])
    dest.mkdir(mode=0o700)
    with zipfile.ZipFile(zip_path) as z:
        require(1<=len(z.infolist())<=4)
        for member in z.infolist():
            require(member.filename==Path(member.filename).name and not member.is_dir() and member.file_size<=MAX_ZIP and not stat.S_ISLNK(member.external_attr>>16))
            target=dest/member.filename
            with target.open('xb') as f:f.write(z.read(member))
            target.chmod(0o600)
    archives=list(dest.glob('*.tar.gz'))
    require(len(archives)==1 and archives[0].name==pin['archiveName'])
    require(hashlib.sha256(archives[0].read_bytes()).hexdigest()==pin['archiveSha256'])
    return archives[0]

def validate_manifest(m,sha):
    require(m['sourceRevision']==sha and m.get('cleanCheckout') is True and m['runtimeIdentifier']=='linux-x64' and m['targetFramework']=='net10.0' and m['entrypoint']=='ContractScribe.Cli.dll')

def main():
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY'))
    sha=os.environ['A5_PRODUCT_SHA'];product=Path(os.environ['A5_PRODUCT_ROOT']).resolve()
    require(subprocess.check_output(['git','-C',str(product),'rev-parse','HEAD'],text=True).strip()==sha)
    approved=json.loads((Path(__file__).parent/'approved-products.json').read_text())
    entry=next(x for x in approved['sources'] if x['sha']==sha);pin=entry['payload']
    require(approved['repository']=='SolusQuest/contract-scribe')
    api=lambda path:json.loads(subprocess.check_output(['gh','api','repos/SolusQuest/contract-scribe/'+path],timeout=60))
    a=api('actions/artifacts/'+str(pin['artifactId']));r=api('actions/runs/'+str(pin['producerRunId']))
    jobs=api('actions/runs/'+str(pin['producerRunId'])+'/attempts/'+str(pin['producerAttempt'])+'/jobs?per_page=100')
    validate_metadata(a,r,jobs,pin,sha)
    root=Path(os.environ['RUNNER_TEMP'])/'a5-payload';root.mkdir(mode=0o700)
    z=root/'artifact.zip'
    with z.open('xb') as f:subprocess.run(['gh','api','repos/SolusQuest/contract-scribe/actions/artifacts/'+str(pin['artifactId'])+'/zip'],stdout=f,check=True,timeout=120)
    archive=unpack(z,root/'download',pin)
    # Reuse the exact checked-out production helpers; no custom archive/inventory model.
    sys.dont_write_bytecode=True;sys.path.insert(0,str(product/'scripts/action'))
    import payload_extract,install
    report=payload_extract._extract(str(archive),str(root/'installed'),None)
    require(report['ok']);top=root/'installed'/report['top']
    manifest=install.verify_inventory(str(top));validate_manifest(manifest,sha)
    with open(os.environ['GITHUB_ENV'],'a') as f:f.write('A5_ACQUIRED_CLI='+str(top/'ContractScribe.Cli.dll')+'\n')
    print('Reviewed exact current-CI payload acquired and inventory verified; executable not yet invoked.')

if __name__=='__main__':
    try:main()
    except BaseException:
        print('Current-CI payload acquisition failed closed before provider injection.',file=sys.stderr);sys.exit(1)
