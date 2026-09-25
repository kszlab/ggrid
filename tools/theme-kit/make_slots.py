#!/usr/bin/env python3
import json,os
HERE=os.path.dirname(os.path.abspath(__file__))
SHEETS={
 'board':('sheet-board.png',[1024,1536],'1. elemlap – mezők, fal, golyó, egycellás elemek, kijárat, irányjelek'),
 'rigid':('sheet-rigid.png',[1024,1536],'2. elemlap – opcionális gyakori többcellás testek'),
 'chrome':('sheet-chrome.png',[1024,1536],'3. elemlap – keret, vezérlősávok, HUD'),
 'tiles':('sheet-tiles.png',[1024,1536],'4. elemlap – általános rigid anyagminta')
}
ROWS=[
('cell-1','board',[40,80,200,200],'cell','fill',[256,256]),('cell-2','board',[288,80,200,200],'cell','fill',[256,256]),('cell-3','board',[536,80,200,200],'cell','fill',[256,256]),('cell-4','board',[784,80,200,200],'cell','fill',[256,256]),
('wall','board',[40,350,200,200],'wall','fill',[256,256]),('ball','board',[288,350,200,200],'ball','contain',[256,256]),('brick-1','board',[536,350,200,200],'brick','fill',[256,256]),('brick-2','board',[784,350,200,200],'brick','fill',[256,256]),('brick-3','board',[40,620,200,200],'brick','fill',[256,256]),
('exit-up','board',[288,620,200,200],'exit','contain',[320,320]),('exit-right','board',[536,620,200,200],'exit','contain',[320,320]),('exit-down','board',[784,620,200,200],'exit','contain',[320,320]),('exit-left','board',[40,890,200,200],'exit','contain',[320,320]),
('cue-up','board',[288,890,200,200],'cue','contain',[128,128]),('cue-right','board',[536,890,200,200],'cue','contain',[128,128]),('cue-down','board',[784,890,200,200],'cue','contain',[128,128]),('cue-left','board',[40,1160,200,200],'cue','contain',[128,128]),('freeze-mark','board',[288,1160,200,200],'freeze','contain',[256,256]),
('rigid-3H','rigid',[40,80,450,150],'rigid','fill',[768,256]),('rigid-2H','rigid',[560,80,300,150],'rigid','fill',[512,256]),('rigid-3V','rigid',[40,330,150,450],'rigid','fill',[256,768]),('rigid-2V','rigid',[250,330,150,300],'rigid','fill',[256,512]),
('rigid-L3-TL','rigid',[460,330,300,300],'rigid','fill',[512,512]),('rigid-L3-TR','rigid',[250,760,300,300],'rigid','fill',[512,512]),('rigid-L3-BL','rigid',[620,760,300,300],'rigid','fill',[512,512]),('rigid-L3-BR','rigid',[250,1180,300,300],'rigid','fill',[512,512]),
('rigid-tiles-ring','tiles',[212,90,600,600],'tileset','fill',[768,768]),('rigid-tiles-block','tiles',[212,800,600,600],'tileset','fill',[768,768]),
('frame','chrome',[40,80,600,600],'frame','fill',[768,768]),('zone-v','chrome',[720,80,110,600],'zone','fill',[180,1000]),('zone-h','chrome',[40,760,600,110],'zone','fill',[1000,180]),('victory','chrome',[680,760,304,152],'chrome','fill',[1000,500]),('header','chrome',[40,980,944,110],'chrome','fill',[1500,175]),('hud','chrome',[40,1160,944,150],'chrome','fill',[1500,240])
]
OPTIONAL={'rigid-3H','rigid-2H','rigid-3V','rigid-2V','rigid-L3-TL','rigid-L3-TR','rigid-L3-BL','rigid-L3-BR'}
SHAPES={'rigid-3H':'3H','rigid-2H':'2H','rigid-3V':'3V','rigid-2V':'2V','rigid-L3-TL':'L3-TL','rigid-L3-TR':'L3-TR','rigid-L3-BL':'L3-BL','rigid-L3-BR':'L3-BR'}
MISSING={'rigid-L3-TL':'br','rigid-L3-TR':'bl','rigid-L3-BL':'tr','rigid-L3-BR':'tl'}
def spec():
 slots=[]
 for sid,sheet,box,role,fit,out in ROWS:
  x={'id':sid,'sheet':sheet,'box':box,'role':role,'fit':fit,'output':out,'label':sid,'required':sid not in OPTIONAL}
  if sid in SHAPES:x['shape']=SHAPES[sid]
  if sid in MISSING:x['missingQuadrant']=MISSING[sid]
  if sid=='rigid-tiles-ring':x['hole']=True
  if sid=='frame':x['nineSlice']={'border':90,'outputSlice':115,'designWidth':22,'expand':16}
  if role=='cell':x['opaque']=True
  slots.append(x)
 return {'format':'ggrid-theme-kit-slots','formatVersion':2,'keyColor':[255,0,255],
  'sheets':{k:{'file':v[0],'size':v[1],'title':v[2]} for k,v in SHEETS.items()},
  'extras':{
   'bg-portrait':{'file':'bg-portrait.png','output':[1080,1620]},
   'bg-landscape':{'file':'bg-landscape.png','output':[1620,1080]},
   'target':{'file':'target.png','output':[1024,1536]},
   'showcase':{'file':'showcase.png','output':[1024,1536]}},
  'slots':slots}
def main():
 p=os.path.join(HERE,'slots.json')\n with open(p,'w',encoding='utf-8',newline='\\n') as f:\n  json.dump(spec(),f,ensure_ascii=False,indent=1);f.write('\\n')\n print(p)
if __name__=='__main__':main()
