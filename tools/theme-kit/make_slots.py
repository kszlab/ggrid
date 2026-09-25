#!/usr/bin/env python3
import json,os
HERE=os.path.dirname(os.path.abspath(__file__))

# Legacy dense sheets stay supported for old projects, but Asset Pack v2 is the
# preferred authoring format. Pack panels have deliberately large gutters and
# an inner safe area; extraction always crops the full outer panel.
SHEETS={
 'board':('sheet-board.png',[1024,1536],'Legacy board sheet'),
 'rigid':('sheet-rigid.png',[1024,1536],'Legacy rigid sheet'),
 'chrome':('sheet-chrome.png',[1024,1536],'Legacy chrome sheet'),
 'tiles':('sheet-tiles.png',[1024,1536],'Legacy material sheet')
}
PACKS={
 'board':{'file':'pack-board.png','size':[1024,1536],'title':'Asset Pack A – board core (9 elem)','safeInset':28},
 'directions':{'file':'pack-directions.png','size':[1024,1536],'title':'Asset Pack B – kijáratok és irányjelek (8 elem)','safeInset':28},
 'rigid':{'file':'pack-rigid.png','size':[1024,1536],'title':'Asset Pack C – általános rigid anyag (2 elem)','safeInset':42},
 'chrome':{'file':'pack-chrome.png','size':[1024,1536],'title':'Asset Pack D – keret, vezérlősávok és UI (7 elem)','safeInset':24}
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

# Sparse Asset Pack v2 placement. The panel itself is larger than the intended
# artwork. The safe guide is informational; extraction keeps the whole panel.
PACK_BOXES={
 'cell-1':('board',[70,90,260,260]),'cell-2':('board',[382,90,260,260]),'cell-3':('board',[694,90,260,260]),
 'cell-4':('board',[70,540,260,260]),'wall':('board',[382,540,260,260]),'ball':('board',[694,540,260,260]),
 'brick-1':('board',[70,990,260,260]),'brick-2':('board',[382,990,260,260]),'brick-3':('board',[694,990,260,260]),
 'exit-up':('directions',[90,80,360,260]),'exit-right':('directions',[574,80,360,260]),
 'exit-down':('directions',[90,430,360,260]),'exit-left':('directions',[574,430,360,260]),
 'cue-up':('directions',[90,780,360,260]),'cue-right':('directions',[574,780,360,260]),
 'cue-down':('directions',[90,1130,360,260]),'cue-left':('directions',[574,1130,360,260]),
 'rigid-tiles-ring':('rigid',[140,100,744,560]),'rigid-tiles-block':('rigid',[140,860,744,560]),
 'frame':('chrome',[50,50,560,560]),'zone-v':('chrome',[790,50,150,560]),'zone-h':('chrome',[50,690,700,150]),
 'header':('chrome',[50,930,890,120]),'hud':('chrome',[50,1120,890,150]),
 'freeze-mark':('chrome',[50,1320,190,190]),'victory':('chrome',[500,1320,440,180])
}

OPTIONAL={'rigid-3H','rigid-2H','rigid-3V','rigid-2V','rigid-L3-TL','rigid-L3-TR','rigid-L3-BL','rigid-L3-BR'}
SHAPES={'rigid-3H':'3H','rigid-2H':'2H','rigid-3V':'3V','rigid-2V':'2V','rigid-L3-TL':'L3-TL','rigid-L3-TR':'L3-TR','rigid-L3-BL':'L3-BL','rigid-L3-BR':'L3-BR'}
MISSING={'rigid-L3-TL':'br','rigid-L3-TR':'bl','rigid-L3-BL':'tr','rigid-L3-BR':'tl'}

def spec():
 slots=[]
 for sid,sheet,box,role,fit,out in ROWS:
  x={'id':sid,'sheet':sheet,'box':box,'role':role,'fit':fit,'output':out,'label':sid,'required':sid not in OPTIONAL}
  if sid in PACK_BOXES:
   x['pack'],x['packBox']=PACK_BOXES[sid]
  if sid in SHAPES:x['shape']=SHAPES[sid]
  if sid in MISSING:x['missingQuadrant']=MISSING[sid]
  if sid=='rigid-tiles-ring':x['hole']=True
  if sid=='frame':x['nineSlice']={'border':90,'outputSlice':115,'designWidth':22,'expand':16}
  if role=='cell':x['opaque']=True
  slots.append(x)
 return {'format':'ggrid-theme-kit-slots','formatVersion':3,'keyColor':[255,0,255],
  'sheets':{k:{'file':v[0],'size':v[1],'title':v[2]} for k,v in SHEETS.items()},
  'packs':PACKS,
  'extras':{
   'bg-portrait':{'file':'bg-portrait.png','output':[1080,1620]},
   'bg-landscape':{'file':'bg-landscape.png','output':[1620,1080]},
   'target':{'file':'target.png','output':[1024,1536]},
   'showcase':{'file':'showcase.png','output':[1024,1536]}},
  'slots':slots}

def main():
 p=os.path.join(HERE,'slots.json')
 with open(p,'w',encoding='utf-8',newline='\n') as f:
  json.dump(spec(),f,ensure_ascii=False,indent=1);f.write('\n')
 print(p)

if __name__=='__main__':main()
