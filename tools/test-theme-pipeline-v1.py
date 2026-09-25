import json,os,tempfile,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'theme-kit'))
import make_slots
spec=make_slots.spec()
assert spec['formatVersion']==2
ids=[s['id'] for s in spec['slots']]
assert len(ids)==len(set(ids)) and len(ids)>=30
for required in ['ball','wall','freeze-mark','rigid-tiles-ring','rigid-tiles-block','frame','zone-h','zone-v','header','hud','victory']:
 assert required in ids
for s in spec['slots']:
 assert len(s['box'])==4 and len(s['output'])==2
 assert s['sheet'] in spec['sheets']
print(json.dumps({'themePipelineV1':'passed','slots':len(ids),'required':sum(1 for s in spec['slots'] if s.get('required',True)),'optional':sum(1 for s in spec['slots'] if not s.get('required',True))}))
