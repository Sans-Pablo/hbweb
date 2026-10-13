"""Terreno IA: iguala la nitidez entre casillas (las que salen borrosas se realzan hasta el nivel de las buenas).
Uso: python tools/equalize_detail.py --bak DIR [--target N] clave ...   (lee de DIR, escribe web/data/sprites_ia/; idempotente)
El realce se calcula con relleno 'wrap' por casilla, asi no crea costuras. Subir IA_VERSION en assets.js despues."""
import sys,argparse,cv2,numpy as np
from PIL import Image
OUT='web/data/sprites_ia/'; K=4; T=32*K
def proc(k,bak,target,sig=2.0,gmax=3.2):
    im=np.array(Image.open(bak+k+'.webp').convert('RGBA')); rgb=im[...,:3].astype(np.float32); H,W=rgb.shape[:2]
    out=rgb.copy(); P=16
    stats=[]
    for ty in range(0,H,T):
        for tx in range(0,W,T):
            t=rgb[ty:ty+T,tx:tx+T]
            if im[ty:ty+T,tx:tx+T,3].min()<250 or t.mean()<3: continue
            p=np.pad(t,((P,P),(P,P),(0,0)),mode='wrap')
            hp=(p-cv2.GaussianBlur(p,(0,0),sig))[P:-P,P:-P]
            e=hp.mean(2).std()
            if e<0.8: continue
            g=min(gmax,max(0.0,target/e-1)) if e<target else 0.0
            if g>0: out[ty:ty+T,tx:tx+T]=t+g*hp
    res=im.copy(); res[...,:3]=np.clip(out,0,255).astype(np.uint8)
    Image.fromarray(res).save(OUT+k+'.webp',quality=92,method=4,exact=True)
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--bak',required=True); ap.add_argument('--target',type=float,default=6.0); ap.add_argument('keys',nargs='+')
    A=ap.parse_args(); b=A.bak.replace(chr(92),'/').rstrip('/')+'/'
    for k in A.keys: proc(k,b,A.target); print(k,flush=True)
