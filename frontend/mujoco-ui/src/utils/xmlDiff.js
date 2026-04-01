export function computeDiff(a,b){
  const al=a.split("\n"),bl=b.split("\n"),r=[],mx=Math.max(al.length,bl.length);
  for(let i=0;i<mx;i++){
    const o=al[i],n=bl[i];
    if(o===undefined)r.push({type:"add",line:n,num:i+1});
    else if(n===undefined)r.push({type:"remove",line:o,num:i+1});
    else if(o!==n){r.push({type:"remove",line:o,num:i+1});r.push({type:"add",line:n,num:i+1});}
    else r.push({type:"same",line:o,num:i+1});
  }
  return r;
}