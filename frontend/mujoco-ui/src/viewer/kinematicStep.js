// We simulate kinematically using sine-wave joint motion (no WASM required)
export function kinematicStep(xmlDoc, t, jointStates) {
  // Returns map of joint name → angle (radians) for hinge joints
  const result = {};
  [...(xmlDoc?.querySelectorAll("joint[type='hinge']")||[])].forEach((j,i) => {
    const name = j.getAttribute("name")||`j${i}`;
    const rangeStr = j.getAttribute("range");
    let mn=-Math.PI/4, mx=Math.PI/4;
    if(rangeStr){const[a,b]=rangeStr.trim().split(/\s+/).map(v=>dtr(parseFloat(v)));mn=a;mx=b;}
    const mid=(mn+mx)/2, amp=(mx-mn)/2*0.5;
    result[name] = mid + amp*Math.sin(t*0.8 + i*0.7);
  });
  return result;
}