"""Pulido de las hojas IA de equipo (armas w, armaduras a/b/l/o/m, escudos s, cascos h).
Uso: python tools/remaster_equip.py [--bak DIR] [--skip k1,k2] [clave ...]  (sin claves = todas las [ablohsmw][01]_*)
Lee siempre de la copia de seguridad (--bak) y escribe en web/data/sprites_ia/. Subir IA_VERSION en assets.js despues."""
import sys,os,re,glob,argparse,cv2,numpy as np
from multiprocessing.pool import ThreadPool as Pool
from PIL import Image
OUT='web/data/sprites_ia/'
BAK=None
TYPE=None   # 'n' = criaturas/NPC (--type n)
def proc(k):
    i=np.array(Image.open(BAK+k+'.webp').convert('RGBA'))
    t=TYPE or k[0]
    rgb=cv2.bilateralFilter(cv2.medianBlur(i[...,:3],5 if t=='n' else 3),9 if t=='n' else 7,55 if t=='n' else 40 if t=='w' else 35,3)
    a=cv2.GaussianBlur(i[...,3].astype(np.float32)/255,(0,0),1.0)
    a=np.clip((a-0.5)*2.2+0.5,0,1)
    m=(a>0.5).astype(np.uint8); n,lab,st,_=cv2.connectedComponentsWithStats(m,connectivity=8)
    for c in range(1,n):
        if st[c,4]<(220 if t=='w' else 150): a[lab==c]=0
    lab_=cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB)
    L=lab_[...,0].astype(np.float32)
    if t=='w':   # arma: CLAHE suave + saturacion + nitidez fuerte
        L2=cv2.createCLAHE(clipLimit=3.0,tileGridSize=(4,4)).apply(lab_[...,0]).astype(np.float32)
        lab_[...,0]=(0.5*L+0.5*L2).astype(np.uint8)
    elif t!='h': # armadura/escudo/capa/botas (y criaturas 'n'): contraste local que conserva la media
        Ls=cv2.GaussianBlur(L,(0,0),1.2) if t=='n' else L   # criaturas: piel/pelo, no amplificar el ruido de la IA
        det=(Ls-cv2.GaussianBlur(L,(0,0),3.0))*(0.9 if t=='n' else 1.5)
        L2=(0.95*L+2 if t=='n' else 0.88*L+4)+det+(L-cv2.GaussianBlur(L,(0,0),10))*(0.5 if t=='n' else 0.9)
        if t!='n': L2=np.where(det>14,L2+(det-14)*1.2,L2)
        lab_[...,0]=np.clip(L2,0,255).astype(np.uint8)
        # croma: lo casi neutro (acero) se enfria, lo coloreado (cuero, tela) se conserva
        da=lab_[...,1].astype(np.float32)-128; db=lab_[...,2].astype(np.float32)-128
        c=np.sqrt(da*da+db*db); f=1.0 if t=='n' else 0.4+0.6*np.clip((c-12)/18,0,1)
        lab_[...,1]=(128+da*f).astype(np.uint8); lab_[...,2]=(128+db*f-(0 if t=='n' else 3)*(1-np.clip((c-12)/18,0,1))).astype(np.uint8)
    rgb=cv2.cvtColor(lab_,cv2.COLOR_LAB2RGB).astype(np.float32)
    if t=='w':
        hsv=cv2.cvtColor(np.clip(rgb,0,255).astype(np.uint8),cv2.COLOR_RGB2HSV).astype(np.float32); hsv[...,1]=np.clip(hsv[...,1]*1.25,0,255)
        rgb=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB).astype(np.float32)
        us,rim_k=((1.2,1.3),(3.0,0.6)),0.55
    elif t=='n': us,rim_k=((1.5,0.5),(3.5,0.2)),0.35
    elif t=='h': us,rim_k=((1.2,0.6),(3.0,0.2)),0.35
    else: us,rim_k=((1.2,0.5),(3.0,0.25)),0.6
    for s,g in us: rgb=rgb+g*(rgb-cv2.GaussianBlur(rgb,(0,0),s))
    er=cv2.erode((a>0.5).astype(np.uint8),np.ones((3,3),np.uint8),iterations=2).astype(np.float32)
    rim=cv2.GaussianBlur(((a>0.5)-er).clip(0,1).astype(np.float32),(0,0),0.8)
    rgb=rgb*(1-rim_k*rim[...,None])
    out=np.dstack([np.clip(rgb,0,255),a*255]).astype(np.uint8); out[...,:3][a==0]=0
    Image.fromarray(out).save(OUT+k+'.webp',quality=92,method=4,exact=True)
    return k
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--bak',required=True); ap.add_argument('--skip',default=''); ap.add_argument('--type',default=None); ap.add_argument('keys',nargs='*')
    A=ap.parse_args(); BAK=A.bak.rstrip('/'+chr(92))+'/'
    TYPE=A.type
    skip=tuple(s for s in A.skip.split(',') if s)
    keys=A.keys or sorted(os.path.basename(p)[:-5] for p in glob.glob(BAK+'*.webp') if re.match(r'[ablohsmw][01]_\d+_\d+\.webp$',os.path.basename(p)))
    keys=[k for k in keys if not any(k.startswith(s+'_') for s in skip)]
    with Pool(max(1,os.cpu_count()-1)) as p:
        for n,_ in enumerate(p.imap_unordered(proc,keys,chunksize=8)):
            if n%500==0: print(n,len(keys),flush=True)
