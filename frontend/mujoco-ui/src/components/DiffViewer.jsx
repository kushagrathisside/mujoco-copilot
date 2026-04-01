import React from "react";

function DiffViewer({ diffLines }) {

  return (
    <div style={{flex:1,overflow:"auto"}}>
      {diffLines.length===0
        ? <div style={{padding:32,color:"#334155",fontSize:12,textAlign:"center"}}>
            No diff yet — send a prompt to see changes
          </div>

        : <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <tbody>
              {diffLines.map((line,i)=>(
                <tr
                  key={i}
                  style={{
                    background:
                      line.type==="add"
                        ? "rgba(34,197,94,0.07)"
                        : line.type==="remove"
                        ? "rgba(239,68,68,0.07)"
                        : "transparent"
                  }}
                >

                  <td
                    style={{
                      width:36,
                      padding:"0 5px",
                      color:"#334155",
                      textAlign:"right",
                      userSelect:"none",
                      borderRight:"1px solid #1e293b"
                    }}
                  >
                    {line.num}
                  </td>

                  <td
                    style={{
                      width:14,
                      padding:"0 5px",
                      color:
                        line.type==="add"
                          ? "#86efac"
                          : line.type==="remove"
                          ? "#fca5a5"
                          : "#475569",
                      userSelect:"none"
                    }}
                  >
                    {line.type==="add" ? "+" : line.type==="remove" ? "−" : " "}
                  </td>

                  <td
                    style={{
                      padding:"0 10px",
                      color: line.type==="same" ? "#475569" : "#e2e8f0",
                      whiteSpace:"pre",
                      fontFamily:"inherit",
                      lineHeight:"20px"
                    }}
                  >
                    {line.line}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
      }
    </div>
  );
}

export default DiffViewer;