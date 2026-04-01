export function highlightXML(xml){
  return xml.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/(&lt;\/?)([\w:]+)/g,'<span style="color:#7dd3fc">$1$2</span>')
    .replace(/([\w:-]+)(=)/g,'<span style="color:#a5b4fc">$1</span>$2')
    .replace(/="([^"]*)"/g,'=<span style="color:#86efac">"$1"</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<span style="color:#64748b;font-style:italic">$1</span>');
}