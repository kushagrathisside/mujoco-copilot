import React from "react";

function InfoPanel({ setInput, setQueryMode }) {

  const examples = [
    "Add an arm with 3 joints",
    "Add a camera sensor",
    "Make all geoms red"
  ];

  return (
    <div style={{flex:1,overflowY:"auto",padding:"9px"}}>

      <div style={{
        fontSize:10,
        color:"#475569",
        marginBottom:7,
        textTransform:"uppercase"
      }}>
        Quick Prompts
      </div>

      {examples.map((ex,i)=>(
        <div
          key={i}
          onClick={()=>setInput(ex)}
          style={{
            padding:"5px 7px",
            background:"#1e293b",
            borderRadius:5,
            fontSize:11,
            marginBottom:4,
            cursor:"pointer"
          }}
        >
          {ex}
        </div>
      ))}

    </div>
  );
}

export default InfoPanel;