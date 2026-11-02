export function estimateSimilarityTransform(src, dst) {
  const ATA = Array.from({length:4}, () => [0,0,0,0]);
  const ATb = [0,0,0,0];
  for (let i=0;i<src.length;i++) {
    const sx=src[i][0], sy=src[i][1], dx=dst[i][0], dy=dst[i][1];
    const r1=[sx,-sy,1,0], r2=[sy,sx,0,1];
    for(let j=0;j<4;j++){
      for(let k=0;k<4;k++) ATA[j][k]+=r1[j]*r1[k]+r2[j]*r2[k];
      ATb[j]+=r1[j]*dx+r2[j]*dy;
    }
  }
  const x=solve4x4(ATA,ATb), [a,b,tx,ty]=x;
  return [[a,-b,tx],[b,a,ty]];
}
function solve4x4(A,b){
  const M=A.map(r=>r.slice()), rhs=b.slice();
  for(let c=0;c<4;c++){
    let p=c;
    for(let r=c+1;r<4;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    if(p!==c){[M[c],M[p]]=[M[p],M[c]];[rhs[c],rhs[p]]=[rhs[p],rhs[c]];}
    const q=M[c][c]; if(Math.abs(q)<1e-12) continue;
    for(let r=c+1;r<4;r++){const f=M[r][c]/q;for(let k=c;k<4;k++)M[r][k]-=f*M[c][k];rhs[r]-=f*rhs[c];}
  }
  const x=[0,0,0,0];
  for(let i=3;i>=0;i--){let s=rhs[i];for(let j=i+1;j<4;j++)s-=M[i][j]*x[j];x[i]=Math.abs(M[i][i])<1e-12?0:s/M[i][i];}
  return x;
}
export function invertAffine(M){
  const [a,b,tx]=M[0], [c,d,ty]=M[1], det=a*d-b*c;
  if(Math.abs(det)<1e-12) throw Error("Singular affine matrix");
  return [[d/det,-b/det,(b*ty-d*tx)/det],[-c/det,a/det,(c*tx-a*ty)/det]];
}
export function affinePoint(M,x,y){return [M[0][0]*x+M[0][1]*y+M[0][2],M[1][0]*x+M[1][1]*y+M[1][2]];}
export function warpAffine(src,sw,sh,M,dw,dh){
  const I=invertAffine(M), out=new Uint8ClampedArray(dw*dh*4);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
    const sx=I[0][0]*x+I[0][1]*y+I[0][2], sy=I[1][0]*x+I[1][1]*y+I[1][2];
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=x0+1,y1=y0+1,fx=sx-x0,fy=sy-y0;
    if(x0<0||y0<0||x1>=sw||y1>=sh)continue;
    const o=(y*dw+x)*4,a=(y0*sw+x0)*4,b=(y0*sw+x1)*4,c=(y1*sw+x0)*4,d=(y1*sw+x1)*4;
    for(let k=0;k<4;k++)out[o+k]=src[a+k]*(1-fx)*(1-fy)+src[b+k]*fx*(1-fy)+src[c+k]*(1-fx)*fy+src[d+k]*fx*fy;
  }
  return out;
}
export function warpAffineMask(src,sw,sh,M,dw,dh){
  const I=invertAffine(M),out=new Float32Array(dw*dh);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
    const sx=I[0][0]*x+I[0][1]*y+I[0][2],sy=I[1][0]*x+I[1][1]*y+I[1][2];
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=x0+1,y1=y0+1,fx=sx-x0,fy=sy-y0;
    if(x0<0||y0<0||x1>=sw||y1>=sh)continue;
    out[y*dw+x]=src[y0*sw+x0]*(1-fx)*(1-fy)+src[y0*sw+x1]*fx*(1-fy)+src[y1*sw+x0]*(1-fx)*fy+src[y1*sw+x1]*fx*fy;
  }
  return out;
}
export function nms(boxes,scores,t=.4){
  const order=Array.from({length:boxes.length},(_,i)=>i).sort((a,b)=>scores[b]-scores[a]),keep=[];
  const dead=new Uint8Array(boxes.length);
  for(const i of order){if(dead[i])continue;keep.push(i);const [ax1,ay1,ax2,ay2]=boxes[i],aa=Math.max(0,ax2-ax1)*Math.max(0,ay2-ay1);
    for(const j of order){if(dead[j]||j===i)continue;const [bx1,by1,bx2,by2]=boxes[j],ix=Math.max(0,Math.min(ax2,bx2)-Math.max(ax1,bx1)),iy=Math.max(0,Math.min(ay2,by2)-Math.max(ay1,by1)),inter=ix*iy,ab=Math.max(0,bx2-bx1)*Math.max(0,by2-by1);
      if(inter/(aa+ab-inter+1e-9)>t)dead[j]=1;
    }
  } return keep;
}
export function vecNorm(v){let s=0;for(const x of v)s+=x*x;return Math.sqrt(s);}
export function vecNormalize(v){const n=vecNorm(v);if(n>1e-12)for(let i=0;i<v.length;i++)v[i]/=n;return v;}
export function vecMatMul(v,m,rows,cols){const o=new Float32Array(cols);for(let j=0;j<cols;j++){let s=0;for(let i=0;i<rows;i++)s+=v[i]*m[i*cols+j];o[j]=s;}return o;}
