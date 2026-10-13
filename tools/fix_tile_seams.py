"""Quita la cuadricula de las hojas IA de terreno ya generadas (casillas 32x32).
Interior = IA completa (con algo de nitidez); borde =  ampliado x4 por casilla (continuo con la vecina, sin emborronar); detalle = alta frecuencia de la IA,
atenuado cerca del borde de la casilla (ahi la IA no conoce a la vecina y marca la linea). El alfa se conserva.
Uso: python tools/fix_tile_seams.py t300 t302 ...   (guarda copia en $TEMP/seam_bak la primera vez)"""
import sys,os,json,cv2,numpy as np
from PIL import Image
R='web/data/'; K=4; E=8   # E: px (x4) del borde donde el detalle IA se desvanece
man=json.load(open(R+'sprites.json')); bak=os.path.join(os.environ.get('TEMP','.'),'seam_bak'); os.makedirs(bak,exist_ok=True)
ramp=np.ones((32*K,32*K),np.float32)
d=np.minimum.reduce([np.arange(32*K)[None,:]+0*np.arange(32*K)[:,None],(32*K-1-np.arange(32*K))[None,:]+0*np.arange(32*K)[:,None],
    np.arange(32*K)[:,None]+0*np.arange(32*K)[None,:],(32*K-1-np.arange(32*K))[:,None]+0*np.arange(32*K)[None,:]]).astype(np.float32)
ramp=np.clip((d-1)/E,0,1)**1.2
for k in sys.argv[1:]:
    f=R+'sprites_ia/'+k+'.webp'; b=os.path.join(bak,k+'.webp')
    if not os.path.exists(b): open(b,'wb').write(open(f,'rb').read())
    ai=np.array(Image.open(b).convert('RGBA')); oa=np.array(Image.open(R+'sprites/'+man[k]['png']).convert('RGBA')); o=oa[...,:3]; oal=oa[...,3]
    out=ai.copy(); g=lambda x,s: cv2.GaussianBlur(x,(0,0),s)
    for fr in man[k]['frames']:
        x,y=fr[0],fr[1]
        if fr[2]!=32 or fr[3]!=32 or y+32>o.shape[0] or x+32>o.shape[1]: continue
        t=np.pad(o[y:y+32,x:x+32],((4,4),(4,4),(0,0)),mode='edge')
        base=cv2.resize(t,(40*K,40*K),interpolation=cv2.INTER_CUBIC)[4*K:36*K,4*K:36*K].astype(np.float32)
        base=base+0.8*(base-g(base,1.6))
        a=ai[y*K:(y+32)*K,x*K:(x+32)*K,:3].astype(np.float32)
        hp=a-g(a,2.0)
        out[y*K:(y+32)*K,x*K:(x+32)*K,:3]=np.clip(base+1.5*hp*ramp[...,None],0,255).astype(np.uint8)
    Image.fromarray(out).save(f,quality=92,method=4,exact=True); print(k,flush=True)
