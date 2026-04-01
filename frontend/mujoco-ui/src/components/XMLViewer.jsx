import React from "react";
import { highlightXML } from "../utils/highlightXML";

function XMLViewer({ xml, setXml, setDiffLines, validation }) {

  const xmlLines = xml.split("\n");

  return (
    <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>

      <div style={{flex:1,overflow:"hidden",position:"relative"}}>

        <div style={{position:"absolute",inset:0,display:"flex",overflow:"auto"}}>

          <div
            style={{
              flexShrink:0,
              padding:"12px 0",
              background:"#0a0f1a",
              borderRight:"1px solid #1e293b",
              userSelect:"none",
              minWidth:40,
              textAlign:"right"
            }}
          >
            {xmlLines.map((_,i)=>(
              <div
                key={i}
                style={{
                  padding:"0 6px 0 4px",
                  lineHeight:"20px",
                  fontSize:10,
                  color:"#334155"
                }}
              >
                {i+1}
              </div>
            ))}
          </div>

          <div style={{flex:1,position:"relative"}}>

            <div
              style={{
                position:"absolute",
                inset:0,
                padding:"12px 12px",
                fontSize:12,
                lineHeight:"20px",
                pointerEvents:"none",
                whiteSpace:"pre",
                fontFamily:"inherit",
                color:"transparent",
                overflow:"hidden"
              }}
            >
              <div
                dangerouslySetInnerHTML={{__html:highlightXML(xml)}}
                style={{color:"inherit"}}
              />
            </div>

            <textarea
              value={xml}
              onChange={e=>{
                setXml(e.target.value);
                setDiffLines([]);
              }}
              spellCheck={false}
              style={{
                position:"absolute",
                inset:0,
                width:"100%",
                height:"100%",
                background:"transparent",
                border:"none",
                color:"#e2e8f0",
                caretColor:"#7dd3fc",
                padding:"12px 12px",
                fontSize:12,
                lineHeight:"20px",
                fontFamily:"inherit",
                whiteSpace:"pre",
                overflowWrap:"normal",
                overflowX:"auto"
              }}
            />

          </div>
        </div>
      </div>

    </div>
  );
}

export default XMLViewer;