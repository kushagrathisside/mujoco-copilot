import React from "react";

function ChatPanel({
  messages,
  loading,
  elapsed,
  queryMode,
  input,
  setInput,
  sendMessage,
  handleKey,
  selectedBody,
  setSelectedBody
}) {

  return (
    <div style={{
      width:305,
      display:"flex",
      flexDirection:"column",
      borderRight:"1px solid #1e293b",
      background:"#0d1525",
      flexShrink:0
    }}>

      {/* messages */}
      <div style={{
        flex:1,
        overflowY:"auto",
        padding:"9px 11px",
        display:"flex",
        flexDirection:"column",
        gap:7
      }}>

        {messages.map((msg,i)=>(
          <div key={i}>
            <div style={{
              maxWidth:"93%",
              padding:"7px 10px",
              borderRadius:10,
              fontSize:12,
              lineHeight:1.6,
              background: msg.role==="user"
                ? "#3b82f6"
                : "#1e293b"
            }}>
              {msg.content}
            </div>
          </div>
        ))}

      </div>

      {/* input */}
      <div style={{padding:"7px 9px",borderTop:"1px solid #1e293b"}}>

        <textarea
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          style={{
            width:"100%",
            background:"#1e293b",
            border:"1px solid #334155",
            borderRadius:8,
            color:"#e2e8f0",
            padding:"6px 8px",
            fontSize:12
          }}
        />

        <button
          onClick={()=>sendMessage()}
          style={{
            marginTop:6,
            width:"100%",
            padding:6,
            background:"#3b82f6",
            color:"#fff",
            border:"none",
            borderRadius:6
          }}
        >
          Send
        </button>

      </div>

    </div>
  );
}

export default ChatPanel;