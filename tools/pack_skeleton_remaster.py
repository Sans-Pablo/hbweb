"""Pack the reviewed four-frame walking sheets into HD atlases.

Usage: python tools/pack_skeleton_remaster.py ../output/skeleton-walk-inputs.json
Requires ffmpeg, Pillow, numpy and scipy. Artwork stays unchanged; this only
crops, scales and packs its four sprites and records their game pivots.
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

root=Path(__file__).resolve().parents[1]
paths=json.loads(Path(sys.argv[1]).read_text())
base=json.loads((root/'web/data/sprites.json').read_text())
target=root/'web/data/sprites_hd';target.mkdir(exist_ok=True)
hd=json.loads((root/'web/data/sprites_hd.json').read_text())
head_y=[120,175,100,155,220,150,115,205]
body_height=[61,60.5,58,57.5,58,58,58,60]
for d,p in enumerate(paths):
    im=Image.open(p);a=np.array(im)[:,:,3];ls,n=label(a>100);cnt=np.bincount(ls.ravel());objs=find_objects(ls)
    boxes=sorted([(o[1].start,o[0].start,o[1].stop,o[0].stop) for k,o in enumerate(objs) if cnt[k+1]>10000])
    if len(boxes)!=4: raise ValueError(f'Direction {d}: expected four sprites, got {len(boxes)}')
    factor=body_height[d]*4/(max(b[3] for b in boxes)-head_y[d])
    frames=[];filters=['[0:v]format=rgba,split=4[a0][a1][a2][a3]']
    for f,(l,t,r,b) in enumerate(boxes):
        l=max(0,l-3);t=max(0,t-3);r=min(im.width,r+3);b=min(im.height,b+3)
        cw,ch=r-l,b-t;sw,sh=round(cw*factor),round(ch*factor)
        if max(sw,sh)>400: raise ValueError('Atlas cell too small')
        ys,xs=np.where(a[t+ch*3//4:b,l:r]>100)
        anchor=float(xs.mean()) if len(xs) else cw/2
        old=base['ske'+str(8+d)]['frames'][f]
        frames.append([f*100,0,sw/4,sh/4,-anchor*sw/cw/4,old[5]+old[3]-sh/4])
        filters.append(f'[a{f}]crop={cw}:{ch}:{l}:{t},scale={sw}:{sh}:flags=lanczos,pad=400:400:0:0:color=black@0[p{f}]')
    filters.append('[p0][p1][p2][p3]hstack=inputs=4,format=rgba[out]')
    filename=f'ske-walk-v2-{d}.png'
    subprocess.run(['ffmpeg','-v','error','-y','-filter_complex_threads','1','-i',p,'-filter_complex',';'.join(filters),'-map','[out]','-frames:v','1',str(target/filename)],check=True)
    hd['ske'+str(8+d)]={'png':filename,'k':4,'frames':frames}
    print(filename,flush=True)
(root/'web/data/sprites_hd.json').write_text(json.dumps(hd,separators=(',',':'))+'\n')
