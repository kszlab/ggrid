#!/usr/bin/env python3
import argparse,hashlib,json,os,re,shutil,sys,threading,functools,http.server,socketserver
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from make_slots import spec as make_spec

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
SLOTS_FILE=HERE/'slots.json'
def load_slots():
 if not SLOTS_FILE.exists():
  import make_slots;make_slots.main()
 try:
  with open(SLOTS_FILE,encoding='utf-8') as f:return json.load(f)
 except UnicodeDecodeError:
  data=make_spec()
  with open(SLOTS_FILE,'w',encoding='utf-8',newline='\\n') as f:
   json.dump(data,f,ensure_ascii=False,indent=1);f.write('\\n')
  return data
KIT=load_slots()
SLOTS={s['id']:s for s in KIT['slots']}
KEY=tuple(KIT['keyColor'])
REQUIRED={s['id'] for s in KIT['slots'] if s.get('required',True)}

def font(size,bold=False):
 for f in (['DejaVuSans-Bold.ttf','Arial Bold.ttf'] if bold else ['DejaVuSans.ttf','Arial.ttf']):
  for d in ['/usr/share/fonts/truetype/dejavu','/Library/Fonts','C:/Windows/Fonts','']:
   try:return ImageFont.truetype(os.path.join(d,f) if d else f,size)
   except OSError:pass
 return ImageFont.load_default()

def sha(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(1<<20),b''):h.update(b)
 return h.hexdigest()

def load_json(path,default=None):
 return json.load(open(path,encoding='utf-8')) if os.path.exists(path) else default

def cmd_templates(args):
 out=HERE/'templates';out.mkdir(parents=True,exist_ok=True)
 for sid,sh in KIT['sheets'].items():
  W,H=sh['size'];im=Image.new('RGB',(W,H),KEY);d=ImageDraw.Draw(im)
  d.text((W//2,25),sh['title'],fill='white',font=font(23,True),anchor='mm')
  for s in [x for x in KIT['slots'] if x['sheet']==sid]:
   x,y,w,h=s['box'];d.rectangle((x,y,x+w,y+h),outline='white',width=3)
   d.text((x,y-6),s['id'],fill='white',font=font(15,True),anchor='ls')
   if s.get('missingQuadrant'):
    q=s['missingQuadrant'];hx=x+w//2;hy=y+h//2
    box={'tl':(x,y,hx,hy),'tr':(hx,y,x+w,hy),'bl':(x,hy,hx,y+h),'br':(hx,hy,x+w,y+h)}[q]
    d.rectangle(box,fill=(90,0,90));d.text(((box[0]+box[2])//2,(box[1]+box[3])//2),'ÜRES',fill='white',font=font(17,True),anchor='mm')
   if s.get('hole'):
    d.rectangle((x+w//3,y+h//3,x+2*w//3,y+2*h//3),fill=(90,0,90));d.text((x+w//2,y+h//2),'ÜRES',fill='white',font=font(20,True),anchor='mm')
  im.save(out/('template-'+sid+'.png'))
 print(out)

def key_image(img):
 im=img.convert('RGBA');pix=im.load()
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=pix[x,y]
   dist=((r-255)**2+g*g+(b-255)**2)**0.5
   if dist<85:pix[x,y]=(r,g,b,0)
   elif dist<140:pix[x,y]=(r,g,b,int(a*(dist-85)/55))
 return im

def bbox_alpha(im):
 a=im.getchannel('A');return a.getbbox()

def fit(im,slot):
 ow,oh=slot['output']
 if slot['fit']=='fill':out=im.resize((ow,oh),Image.Resampling.LANCZOS)
 else:
  sc=min(ow/im.width,oh/im.height);tmp=im.resize((max(1,round(im.width*sc)),max(1,round(im.height*sc))),Image.Resampling.LANCZOS)
  out=Image.new('RGBA',(ow,oh));out.alpha_composite(tmp,((ow-tmp.width)//2,(oh-tmp.height)//2))
 if slot.get('opaque'):
  a=out.getchannel('A');a.paste(255,(0,0,ow,oh));out.putalpha(a)
 q=slot.get('missingQuadrant')
 if q:
  a=out.getchannel('A');hx,hy=ow//2,oh//2
  box={'tl':(0,0,hx,hy),'tr':(hx,0,ow,hy),'bl':(0,hy,hx,oh),'br':(hx,hy,ow,oh)}[q];a.paste(0,box);out.putalpha(a)
 if slot.get('hole'):
  a=out.getchannel('A');a.paste(0,(ow//3,oh//3,2*ow//3,2*oh//3));out.putalpha(a)
 if slot['role']=='frame':
  b=slot['nineSlice']['outputSlice'];a=out.getchannel('A');a.paste(0,(b,b,ow-b,oh-b));out.putalpha(a)
 return out

def slice_assets(inp,out):
 inp=Path(inp);out=Path(out);ras=out/'raster';chk=out/'kit-check';ras.mkdir(parents=True,exist_ok=True);chk.mkdir(parents=True,exist_ok=True)
 report={'format':'ggrid-theme-kit-report','formatVersion':2,'slots':{},'extras':{}}
 sheets={}
 for sid,sh in KIT['sheets'].items():
  p=inp/sh['file']
  if p.exists():sheets[sid]=Image.open(p).convert('RGBA').resize(tuple(sh['size']),Image.Resampling.LANCZOS)
 for slot in KIT['slots']:
  sid=slot['id'];single=next((inp/(sid+e) for e in ['.png','.webp','.jpg'] if (inp/(sid+e)).exists()),None)
  src=None
  if single:im=key_image(Image.open(single));src='single'
  elif slot['sheet'] in sheets:
   x,y,w,h=slot['box'];im=key_image(sheets[slot['sheet']].crop((x,y,x+w,y+h)));src='sheet'
  else:
   report['slots'][sid]={'status':'missing','warnings':['nincs forráslap vagy külön asset'],'required':sid in REQUIRED};continue
  bb=bbox_alpha(im)
  if not bb:
   report['slots'][sid]={'status':'missing','warnings':['nem található rajz a slotban'],'required':sid in REQUIRED};continue
  crop=im.crop(bb);warnings=[]
  sw,sh=slot['box'][2],slot['box'][3]
  if src=='sheet' and crop.width*crop.height<.35*sw*sh:warnings.append('a rajz feltűnően kicsi a slothoz képest')
  if slot['fit']=='fill' and abs((crop.width/max(1,crop.height))/(slot['output'][0]/slot['output'][1])-1)>.22:warnings.append('szokatlan képarány; torzulhat')
  outim=fit(crop,slot);outim.save(ras/(sid+'.webp'),'WEBP',quality=96,method=6)
  report['slots'][sid]={'status':'warn' if warnings else 'ok','warnings':warnings,'required':sid in REQUIRED,'source':src,'file':'raster/'+sid+'.webp'}
 for eid,e in KIT['extras'].items():
  p=inp/e['file']
  if not p.exists():report['extras'][eid]={'status':'missing'};continue
  im=Image.open(p).convert('RGB').resize(tuple(e['output']),Image.Resampling.LANCZOS);name='preview.webp' if eid=='target' else eid+'.webp';im.save(ras/name,'WEBP',quality=94,method=6);report['extras'][eid]={'status':'ok','file':'raster/'+name}
 counts={k:sum(1 for v in report['slots'].values() if v['status']==k) for k in ['ok','warn','missing']}
 counts['requiredMissing']=sum(1 for k,v in report['slots'].items() if v['required'] and v['status']=='missing')
 counts['optionalMissing']=sum(1 for k,v in report['slots'].items() if not v['required'] and v['status']=='missing');report['summary']=counts
 json.dump(report,open(out/'kit-report.json','w'),ensure_ascii=False,indent=2);open(out/'kit-report.json','a').write('\n')
 # contact sheet
 W,H=1000,((len(KIT['slots'])+4)//5)*190;cs=Image.new('RGB',(W,H),(25,25,30));d=ImageDraw.Draw(cs)
 for i,s in enumerate(KIT['slots']):
  x=(i%5)*200;y=(i//5)*190;f=ras/(s['id']+'.webp');st=report['slots'][s['id']]['status'];col={'ok':'#42c878','warn':'#efa631','missing':'#e64b4b'}[st]
  if f.exists():
   t=Image.open(f).convert('RGBA');t.thumbnail((175,145));cs.paste(t,(x+(190-t.width)//2,y+5+(145-t.height)//2),t)
  d.rectangle((x+4,y+4,x+190,y+153),outline=col,width=3);d.text((x+95,y+170),s['id'],fill=col,font=font(13,True),anchor='mm')
 cs.save(chk/'check-elements.png')
 return report

def approval(inp):
 return load_json(Path(inp)/'approval.json',{'format':'ggrid-theme-approval','formatVersion':1,'stages':{}})

def cmd_approve(args):
 inp=Path(args.input);meta=load_json(inp/'theme-kit.json');a=approval(inp);a['themeId']=meta['id'];st=a.setdefault('stages',{})
 pre={'target':'mood','sheets':'target','release':'sheets'}.get(args.stage)
 if pre and st.get(pre,{}).get('status')!='approved':sys.exit(f'{args.stage} requires approved {pre}')
 names={'mood':['mood.png'],'target':['target.png'],'sheets':[v['file'] for v in KIT['sheets'].values()],'release':['target.png']+[v['file'] for v in KIT['sheets'].values()]}[args.stage]
 miss=[n for n in names if not (inp/n).exists()]
 if miss:sys.exit('missing: '+', '.join(miss))
 st[args.stage]={'status':'approved','actor':args.actor,'files':[{'file':n,'sha256':sha(inp/n)} for n in names]}
 json.dump(a,open(inp/'approval.json','w'),ensure_ascii=False,indent=2);open(inp/'approval.json','a').write('\n');print('approved',args.stage)

def verify_approval(inp):
 a=approval(inp);s=a.get('stages',{}).get('sheets',{});err=[]
 if s.get('status')!='approved':err.append('sheets stage not approved')
 for r in s.get('files',[]):
  p=Path(inp)/r['file']
  if not p.exists():err.append(r['file']+' missing')
  elif sha(p)!=r['sha256']:err.append(r['file']+' changed after approval')
 return a,err

def cmd_slice(args):
 r=slice_assets(args.input,args.out);print(json.dumps(r['summary'],ensure_ascii=False))

CSS='''body[data-theme="{{THEME}}"]{--freeze-edge:{{accent}};--freeze-glow:{{focus}}}
body[data-theme="{{THEME}}"][data-ui-context="game"]{background:{{surface}}}
body[data-theme="{{THEME}}"] .board-wrap.scene-artwork{border:0;background:{{surface}};box-shadow:0 18px 48px #000d}
body[data-theme="{{THEME}}"] .scene-artwork .board{border:0!important;background:transparent;overflow:visible}
body[data-theme="{{THEME}}"] .scene-artwork .cell{margin:1px;border:0;border-radius:4px;background:{{surfaceRaised}}}
body[data-theme="{{THEME}}"] .scene-artwork .cell.sr-asset-visual{background-size:100% 100%!important}
body[data-theme="{{THEME}}"] .scene-artwork .piece{border:0!important;background-color:transparent!important;box-shadow:none!important;filter:drop-shadow(0 5px 4px #0009)}
body[data-theme="{{THEME}}"] .scene-artwork .piece.sr-asset-visual,body[data-theme="{{THEME}}"] .scene-artwork .sr-composite.sr-asset-visual{background-size:100% 100%!important;background-repeat:no-repeat!important;background-position:center!important}
body[data-theme="{{THEME}}"] .scene-artwork .brick.sr-composite-source{opacity:0!important}
body[data-theme="{{THEME}}"] .scene-artwork .exit{z-index:11;border:0!important;background-color:transparent!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important}
body[data-theme="{{THEME}}"] .scene-artwork .edge-control{z-index:10!important;border:0;background:transparent;box-shadow:none;-webkit-tap-highlight-color:transparent!important}
body[data-theme="{{THEME}}"] .scene-artwork .edge-control.art-control-zone{background-size:100% 100%!important;background-repeat:no-repeat!important}
body[data-theme="{{THEME}}"] .scene-artwork .edge-control .emboss-arrow.sr-asset-visual{opacity:1!important;width:34px!important;height:34px!important;background-size:contain!important;background-repeat:no-repeat!important}
body[data-theme="{{THEME}}"] .game-head,body[data-theme="{{THEME}}"] .hud-row{color:{{text}};background-color:{{surface}}}
body[data-theme="{{THEME}}"] .play-action,body[data-theme="{{THEME}}"] .score-box{border:1px solid {{accent}};background:{{control}};color:{{text}}}
'''

def color(path,default):
 try:
  im=Image.open(path).convert('RGB').resize((1,1));return im.getpixel((0,0))
 except:return default
def hx(c):return '#%02x%02x%02x'%tuple(max(0,min(255,int(x))) for x in c)
def mix(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))

def cmd_build(args):
 inp=Path(args.input);meta=load_json(inp/'theme-kit.json');tid=meta['id']
 if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,40}',tid):sys.exit('invalid theme id')
 a,err=verify_approval(inp)
 if err:sys.exit('approval validation failed: '+'; '.join(err))
 tdir=ROOT/'content/themes'/tid
 if (tdir/'raster').exists():shutil.rmtree(tdir/'raster')
 report=slice_assets(inp,tdir)
 if meta.get('strict',True):
  miss=[k for k,v in report['slots'].items() if v['required'] and v['status']=='missing']
  if miss:sys.exit('strict theme-kit missing required assets: '+', '.join(miss))
 ras=tdir/'raster';have=lambda x:report['slots'].get(x,{}).get('status') in ('ok','warn');R=lambda x:'raster/'+x+'.webp'
 dark=mix(color(ras/'hud.webp',(15,25,40)),(0,0,0),.45);accent=color(ras/'frame.webp',(225,185,100));text=mix(accent,(255,255,255),.62)
 tok={'surface':hx(dark),'surfaceRaised':hx(mix(dark,accent,.12)),'control':hx(mix(dark,accent,.08)),'accent':hx(accent),'text':hx(text),'focus':hx(mix(accent,(255,255,255),.35))}
 tok.update(meta.get('tokens',{}))
 pieces={}
 if have('ball'):pieces['ball']={'asset':R('ball')}
 if have('wall'):pieces['wall']={'asset':R('wall')}
 singles=[{'asset':R('brick-'+str(i))} for i in (1,2,3) if have('brick-'+str(i))]
 if singles:pieces['brickSingle']={'variants':singles}
 shapes={s['shape']:{'asset':R(s['id'])} for s in KIT['slots'] if s.get('shape') and have(s['id'])}
 if shapes:pieces['rigidShapes']=shapes
 if have('rigid-tiles-ring') and have('rigid-tiles-block'):pieces['rigidTiles']={'ring':R('rigid-tiles-ring'),'block':R('rigid-tiles-block')}
 exits={d:R('exit-'+d) for d in ['up','right','down','left'] if have('exit-'+d)}
 if exits:pieces['exit']={'directions':exits}
 controls={}
 for d in ['up','right','down','left']:
  zone='zone-h' if d in ('up','down') else 'zone-v';sp={}
  if have(zone):sp={'asset':R(zone),'target':'zone'}
  if have('cue-'+d):sp['cue']={'asset':R('cue-'+d)}
  controls[d]=sp
 cells=[{'asset':R('cell-'+str(i))} for i in (1,2,3,4) if have('cell-'+str(i))]
 board={'cellVariants':cells,'fitMode':{'portrait':'expand-height','landscape':'contain'}}
 if have('frame'):board['frame']={'asset':R('frame'),'slice':[115]*4,'width':[22]*4,'expand':[16]*4}
 layers={}
 ex=report['extras']
 if ex.get('bg-portrait',{}).get('status')=='ok' or ex.get('bg-landscape',{}).get('status')=='ok':
  p=ex.get('bg-portrait',{}).get('file') or ex.get('bg-landscape',{}).get('file');l=ex.get('bg-landscape',{}).get('file') or p;layers['background']={'portrait':p,'landscape':l}
 ui={k:{'asset':R(k),'fit':'100% 100%'} for k in ['hud','header','victory'] if have(k)}
 digest=hashlib.sha1(b''.join(open(ras/f,'rb').read() for f in sorted(os.listdir(ras)))).hexdigest()[:8]
 preview=ex.get('showcase',{}).get('file') or ex.get('target',{}).get('file') or ex.get('bg-portrait',{}).get('file')
 sem={'ball':'Golyó','brick':'Mozgó elem','wall':'Fal','exit':'Kijárat','freeze':'Freeze'};sem.update(meta.get('semantic',{}))
 theme={'format':'ggrid-theme','formatVersion':2,'id':tid,'version':int(meta.get('version',1)),'name':meta['name'],'description':meta.get('description',''),'semantic':sem,'scene':{'type':tid,'tier':'showcase'},'pieces':{k:{'name':sem[k]} for k in ['ball','brick','wall','exit']},'abilities':{'freeze':{'name':sem['freeze']}},'preview':{'shortName':meta.get('shortName',meta['name']),'tag':meta.get('tag',''),'description':meta.get('description',''),'image':f'content/themes/{tid}/'+preview if preview else ''},'renderMode':'artwork','render':{'pieceInsetPx':.8,'rigidInsetPx':.4,'moveMs':190},'artwork':{'version':2,'landscapeMinAspect':1.18,'layouts':{'portrait':{'designSize':[540,610],'boxes':{'boardSafe':[46,68,448,448]},'controls':{'band':42,'gap':2,'extend':4}},'landscape':{'designSize':[900,520],'boxes':{'boardSafe':[165,70,570,360]},'controls':{'band':54,'gap':5,'extend':5}}},'layers':layers,'board':board,'pieces':pieces,'controls':controls,'ui':ui,'layoutMode':'portrait'},'ui':{'skin':'full','sceneChrome':True,'tokens':tok},'themeKit':{'version':2,'report':'kit-report.json','approval':{'file':'approval.json','stage':'sheets','strict':meta.get('strict',True)},'assetsDigest':digest}}
 json.dump(theme,open(tdir/'theme.json','w'),ensure_ascii=False,indent=2);open(tdir/'theme.json','a').write('\n')
 css=CSS.replace('{{THEME}}',tid)
 for k,v in tok.items():css=css.replace('{{'+k+'}}',v)
 if have('freeze-mark'):css+=f'\nbody[data-theme="{tid}"] .freeze-selection-marker{{background:url("raster/freeze-mark.webp") center/100% 100% no-repeat!important;border:0!important;box-shadow:none!important;outline:0!important}}\n'
 open(tdir/'artwork.css','w').write(css)
 shutil.copy(inp/'theme-kit.json',tdir/'theme-kit.json');shutil.copy(inp/'approval.json',tdir/'approval.json')
 idx=load_json(ROOT/'content/themes/index.json');entry={'id':tid,'version':theme['version'],'name':theme['name'],'description':theme['description'],'showcase':True,'preview':theme['preview'],'src':tid+'/theme.json','css':tid+'/artwork.css?v='+digest}
 idx['themes']=[x for x in idx['themes'] if x['id']!=tid]+[entry];json.dump(idx,open(ROOT/'content/themes/index.json','w'),ensure_ascii=False,indent=2);open(ROOT/'content/themes/index.json','a').write('\n')
 os.system(f'cd "{ROOT}" && node tools/audit-theme-shapes.mjs >/dev/null 2>&1')
 print('built',tid,report['summary'])

SHOW={'label':'THEME-KIT-TARGET','width':5,'height':8,'exit':{'dir':'down','x':4,'y':7},'objects':[{'id':'ball1','type':'ball','x':2,'y':4,'cells':[{'x':0,'y':0}]},{'id':'W1','type':'wall','x':0,'y':2,'cells':[{'x':0,'y':0}]},{'id':'K1','type':'brick','x':1,'y':1,'cells':[{'x':0,'y':0},{'x':1,'y':0},{'x':2,'y':0}]},{'id':'K2','type':'brick','x':0,'y':3,'cells':[{'x':0,'y':0},{'x':0,'y':1}]},{'id':'K3','type':'brick','x':3,'y':2,'cells':[{'x':0,'y':0},{'x':1,'y':0},{'x':0,'y':1}]},{'id':'K4','type':'brick','x':1,'y':6,'cells':[{'x':0,'y':0}]},{'id':'K5','type':'brick','x':3,'y':5,'cells':[{'x':0,'y':0},{'x':0,'y':1},{'x':1,'y':1},{'x':1,'y':2}]}]}
SHAPES={'label':'THEME-KIT-SHAPES','width':5,'height':8,'exit':{'dir':'down','x':4,'y':7},'objects':[{'id':'ball1','type':'ball','x':4,'y':2,'cells':[{'x':0,'y':0}]},{'id':'W1','type':'wall','x':0,'y':2,'cells':[{'x':0,'y':0}]},{'id':'K1','type':'brick','x':0,'y':0,'cells':[{'x':0,'y':0},{'x':1,'y':0},{'x':2,'y':0},{'x':1,'y':1}]},{'id':'K2','type':'brick','x':3,'y':0,'cells':[{'x':0,'y':0},{'x':1,'y':0},{'x':0,'y':1},{'x':1,'y':1}]},{'id':'K3','type':'brick','x':0,'y':3,'cells':[{'x':0,'y':0},{'x':2,'y':0},{'x':0,'y':1},{'x':1,'y':1},{'x':2,'y':1}]},{'id':'K4','type':'brick','x':3,'y':3,'cells':[{'x':0,'y':0},{'x':0,'y':1},{'x':1,'y':1},{'x':1,'y':2}]},{'id':'K5','type':'brick','x':1,'y':6,'cells':[{'x':0,'y':0},{'x':1,'y':0},{'x':2,'y':0},{'x':3,'y':0},{'x':0,'y':1},{'x':1,'y':1}]}]}
LOAD="""s=>{const objects=s.objects.map(o=>({...o,exited:false,glueEdges:[],glued:o.cells.length>1}));const st={width:s.width,height:s.height,exit:s.exit,moves:0,won:false,objects};applyLibraryLevel({state:st,solution:[],code:s.label,level:{analysis:{testDifficultyClass:5}}});document.querySelectorAll('#toast,#motionNote').forEach(e=>e.textContent='')}"""

def serve():
 class Q(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*a):pass
 h=functools.partial(Q,directory=ROOT);srv=socketserver.ThreadingTCPServer(('127.0.0.1',0),h);threading.Thread(target=srv.serve_forever,daemon=True).start();return srv,f'http://127.0.0.1:{srv.server_address[1]}/'
def open_game(pw,base,theme,w,h):
 b=pw.chromium.launch();p=b.new_page(viewport={'width':w,'height':h},device_scale_factor=2);errs=[];p.on('pageerror',lambda e:errs.append(str(e)));p.goto(base+'index.html',wait_until='networkidle');p.click('#homeFreePlay');p.wait_for_timeout(600);p.evaluate("t=>{document.querySelector('#freeTheme').value=t}",theme);p.click('#quickSize button[data-value="5x8"]');p.click('#freeSetupPlay');p.wait_for_timeout(900);return b,p,errs
def cmd_scaffold(args):
 from playwright.sync_api import sync_playwright
 out=HERE/'templates';out.mkdir(exist_ok=True);srv,base=serve()
 with sync_playwright() as pw:
  b,p,e=open_game(pw,base,args.theme,512,768);p.evaluate(LOAD,SHOW);p.wait_for_timeout(500);raw=out/'_raw.png';p.screenshot(path=str(raw),full_page=True);b.close()
 srv.shutdown();im=Image.open(raw).convert('RGB');raw.unlink();sc=min(1024/im.width,1536/im.height);sm=im.resize((round(im.width*sc),round(im.height*sc)),Image.Resampling.LANCZOS);cv=Image.new('RGB',(1024,1536),im.getpixel((2,2)));cv.paste(sm,((1024-sm.width)//2,(1536-sm.height)//2));cv.save(out/'target-base.png');cv.save(out/'target-base-labels.png');print(out)
def cmd_capture(args):
 from playwright.sync_api import sync_playwright
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True);srv,base=serve();errs=[]
 with sync_playwright() as pw:
  for name,(w,h) in {'phone':(390,844),'portrait':(512,768),'landscape':(1024,640)}.items():
   b,p,e=open_game(pw,base,args.theme,w,h);errs+=e
   for label,state in [('showcase',SHOW),('shapes-extra',SHAPES)]:
    p.evaluate(LOAD,state);p.wait_for_timeout(500);p.screenshot(path=str(out/(label+'-'+name+'.png')),full_page=True)
   b.close()
 srv.shutdown()
 if args.target and os.path.exists(args.target):
  a=Image.open(args.target).convert('RGB').resize((1024,1536),Image.Resampling.LANCZOS);b=Image.open(out/'showcase-phone.png').convert('RGB');sc=min(1024/b.width,1536/b.height);bb=b.resize((round(b.width*sc),round(b.height*sc)),Image.Resampling.LANCZOS);canvas=Image.new('RGB',(2068,1600),(15,18,22));canvas.paste(a,(10,55));canvas.paste(bb,(1034+(1024-bb.width)//2,55+(1536-bb.height)//2));d=ImageDraw.Draw(canvas);d.text((10,12),'Jóváhagyott render-célkép',fill='#efd898',font=font(28,True));d.text((1034,12),'Valódi játék',fill='#efd898',font=font(28,True));canvas.save(out/'compare.png')
 json.dump({'theme':args.theme,'pageErrors':errs},open(out/'capture.json','w'),indent=2)
 if errs:sys.exit(1)

def main():
 p=argparse.ArgumentParser();sp=p.add_subparsers(dest='cmd',required=True)
 sp.add_parser('templates')
 a=sp.add_parser('approve');a.add_argument('--input',required=True);a.add_argument('--stage',required=True,choices=['mood','target','sheets','release']);a.add_argument('--actor',default='owner')
 a=sp.add_parser('slice');a.add_argument('--input',required=True);a.add_argument('--out',required=True)
 a=sp.add_parser('build');a.add_argument('--input',required=True)
 a=sp.add_parser('scaffold');a.add_argument('--theme',default='classic')
 a=sp.add_parser('capture');a.add_argument('--theme',required=True);a.add_argument('--out',required=True);a.add_argument('--target')
 x=p.parse_args();{'templates':cmd_templates,'approve':cmd_approve,'slice':cmd_slice,'build':cmd_build,'scaffold':cmd_scaffold,'capture':cmd_capture}[x.cmd](x)
if __name__=='__main__':main()
