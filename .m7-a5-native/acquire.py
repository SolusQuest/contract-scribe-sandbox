"""Consume one immutable, already-qualified CI artifact; no provider credential."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,zipfile,stat
SOURCE='3aa7f52c63856001e768b3118e469dac189dabee'
ARTIFACT=12932589856
DIGEST='8b4e41fa4a2694060a1a863597eb2e7b09875a40dc5071cc11a7581ba72f5f34'
SIZE=12333897

def require(x):
    if not x:raise ValueError('qualified payload rejected')

try:
    require(not os.environ.get('CONTRACTSCRIBE_PROVIDER_API_KEY') and not os.environ.get('CONTRACTSCRIBE_GITHUB_TOKEN'))
    product=Path('product').resolve();require(subprocess.check_output(['git','-C',str(product),'rev-parse','HEAD'],text=True).strip()==SOURCE)
    root=Path(os.environ['RUNNER_TEMP'])/'m7-native-payload';root.mkdir(mode=0o700);archive=root/'original.zip'
    with archive.open('xb')as f:r=subprocess.run(['gh','api',f'repos/SolusQuest/contract-scribe/actions/artifacts/{ARTIFACT}/zip'],stdout=f,stderr=subprocess.PIPE,timeout=120)
    require(r.returncode==0 and archive.stat().st_size==SIZE and hashlib.sha256(archive.read_bytes()).hexdigest()==DIGEST)
    unpack=root/'download';unpack.mkdir(mode=0o700)
    with zipfile.ZipFile(archive)as z:
        require(1<=len(z.infolist())<=4)
        for i in z.infolist():
            require(i.filename==Path(i.filename).name and not i.is_dir() and not stat.S_ISLNK(i.external_attr>>16) and i.file_size<256*1024*1024)
            (unpack/i.filename).write_bytes(z.read(i))
    tars=list(unpack.glob('*.tar.gz'));require(len(tars)==1);tar=tars[0]
    sys.dont_write_bytecode=True;sys.path.insert(0,str(product/'scripts/action'));import payload_extract,install
    report=payload_extract._extract(str(tar),str(root/'installed'),None);require(report['ok']);top=root/'installed'/report['top'];m=install.verify_inventory(str(top))
    require(m['sourceRevision']==SOURCE and m['cleanCheckout'] is True and m['runtimeIdentifier']=='linux-x64' and m['targetFramework']=='net10.0' and m['entrypoint']=='ContractScribe.Cli.dll')
    cli=top/'ContractScribe.Cli.dll';record={'source':SOURCE,'CI':40956295504,'attempt':1,'artifact':ARTIFACT,'zipSha256':DIGEST,'archiveSha256':hashlib.sha256(tar.read_bytes()).hexdigest(),'cliSha256':hashlib.sha256(cli.read_bytes()).hexdigest(),'toolVersion':m['toolVersion'],'directArtifactGETAttempts':1}
    Path('payload-verified.json').write_text(json.dumps(record,indent=2)+'\n')
    with open(os.environ['GITHUB_ENV'],'a')as f:f.write('LIFE_CLI='+str(cli)+'\nLIFE_CLI_SHA256='+record['cliSha256']+'\n')
    print('Original current-source CI payload downloaded once and inventory verified; no executable/model invocation yet.')
except BaseException:
    print('Current qualified payload acquisition failed closed; no retry or provider injection.',file=sys.stderr);sys.exit(1)
