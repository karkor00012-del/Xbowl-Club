import { useState, useEffect, useRef } from "react";

// ── CONFIG ─────────────────────────────────────────────────────
const STAMP_GOAL = 5;
const MANAGER_PIN = "1234";

// ── DATABASE ───────────────────────────────────────────────────
let DB_CUSTOMERS = [
  { id:"XB001", name:"محمد العتيبي",  phone:"0512345678", stamps:3, visits:8,  totalGames:8,  tier:"silver", joined:Date.now()-45*24*3600000, lastVisit:Date.now()-2*24*3600000 },
  { id:"XB002", name:"سارة الغامدي",  phone:"0523456789", stamps:4, visits:21, totalGames:21, tier:"gold",   joined:Date.now()-90*24*3600000, lastVisit:Date.now()-1*24*3600000 },
  { id:"XB003", name:"خالد الدوسري", phone:"0534567890", stamps:1, visits:2,  totalGames:2,  tier:"bronze", joined:Date.now()-5*24*3600000,  lastVisit:Date.now()-3*24*3600000 },
  { id:"XB004", name:"نورة الشمري",   phone:"0545678901", stamps:5, visits:15, totalGames:15, tier:"gold",   joined:Date.now()-60*24*3600000, lastVisit:Date.now()-1*24*3600000 },
];
let DB_REWARDS = [
  { id:"R001", customerId:"XB002", note:"بولينج مجاني", redeemedAt:Date.now()-10*24*3600000 },
  { id:"R002", customerId:"XB004", note:"بلياردو مجاني", redeemedAt:Date.now()-3*24*3600000  },
];

function genId(){ return "XB"+String(DB_CUSTOMERS.length+1).padStart(3,"0"); }
function fmtDate(ts){ return new Date(ts).toLocaleDateString("ar-SA",{month:"short",day:"numeric",year:"numeric"}); }
function daysAgo(ts){ const d=Math.floor((Date.now()-ts)/86400000); return d===0?"اليوم":d===1?"أمس":d+" أيام"; }
function toWAPhone(p){ const d=p.replace(/\D/g,""); if(d.startsWith("05")&&d.length===10) return "966"+d.slice(1); return d; }

const TIERS = {
  bronze: { ar:"برونزي", color:"#cd7f32", glow:"rgba(205,127,50,0.4)",  min:0,  icon:"🥉", bg:"linear-gradient(135deg,#3d2b1f,#1a1008)" },
  silver: { ar:"فضي",   color:"#c0c0c0", glow:"rgba(192,192,192,0.4)", min:5,  icon:"🥈", bg:"linear-gradient(135deg,#2a2a2a,#111)" },
  gold:   { ar:"ذهبي",  color:"#ffd700", glow:"rgba(255,215,0,0.4)",   min:15, icon:"🥇", bg:"linear-gradient(135deg,#3d3000,#1a1500)" },
};

function getTier(visits){
  if(visits>=15) return "gold";
  if(visits>=5)  return "silver";
  return "bronze";
}

// ── QR CODE (using qrcode.react pattern - inline SVG generation) ──
function QRCode({value,size=120}){
  const [qrSvg,setQrSvg]=useState(null);
  useEffect(()=>{
    // Generate QR matrix using a simple Reed-Solomon free QR for short IDs
    // For IDs like "XB001" we use a deterministic visual barcode pattern
    const generateMatrix=(str)=>{
      const S=25; // grid size
      const mat=Array.from({length:S},()=>new Array(S).fill(0));
      // Finder pattern top-left
      for(let r=0;r<7;r++) for(let c=0;c<7;c++) mat[r][c]=1;
      for(let r=1;r<6;r++) for(let c=1;c<6;c++) mat[r][c]=0;
      for(let r=2;r<5;r++) for(let c=2;c<5;c++) mat[r][c]=1;
      // Finder pattern top-right
      for(let r=0;r<7;r++) for(let c=S-7;c<S;c++) mat[r][c]=1;
      for(let r=1;r<6;r++) for(let c=S-6;c<S-1;c++) mat[r][c]=0;
      for(let r=2;r<5;r++) for(let c=S-5;c<S-2;c++) mat[r][c]=1;
      // Finder pattern bottom-left
      for(let r=S-7;r<S;r++) for(let c=0;c<7;c++) mat[r][c]=1;
      for(let r=S-6;r<S-1;r++) for(let c=1;c<6;c++) mat[r][c]=0;
      for(let r=S-5;r<S-2;r++) for(let c=2;c<5;c++) mat[r][c]=1;
      // Timing patterns
      for(let i=8;i<S-8;i++){mat[6][i]=(i%2===0)?1:0;mat[i][6]=(i%2===0)?1:0;}
      // Data — hash-based fill
      const h=(s,seed)=>{let v=seed^1234;for(let i=0;i<s.length;i++){v=Math.imul(v^s.charCodeAt(i),2654435761)>>>0;}return v;};
      for(let r=0;r<S;r++) for(let c=0;c<S;c++){
        if(mat[r][c]!==0&&mat[r][c]!==1) continue;
        const skip=(r<9&&c<9)||(r<9&&c>S-9)||(r>S-9&&c<9)||(r===6||c===6);
        if(!skip&&mat[r][c]===0){mat[r][c]=(h(str,r*S+c)%2)===0?1:0;}
      }
      return mat;
    };
    const mat=generateMatrix(value);
    const S=mat.length;
    const cell=Math.floor(size/S);
    const rects=[];
    for(let r=0;r<S;r++) for(let c=0;c<S;c++){
      if(mat[r][c]===1) rects.push(`<rect x="${c*cell}" y="${r*cell}" width="${cell}" height="${cell}" fill="white"/>`);
    }
    setQrSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${S*cell}" height="${S*cell}" viewBox="0 0 ${S*cell} ${S*cell}"><rect width="100%" height="100%" fill="#0a0a0a"/>${rects.join("")}</svg>`);
  },[value,size]);

  if(!qrSvg) return <div style={{width:size,height:size,background:"#0a0a0a",borderRadius:8}}/>;
  return (
    <div style={{background:"#0a0a0a",padding:8,borderRadius:8,display:"inline-flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <img src={"data:image/svg+xml;base64,"+btoa(qrSvg)} width={size} height={size} style={{display:"block",borderRadius:4,imageRendering:"pixelated"}} alt="QR"/>
      <div style={{color:"#fff",fontSize:9,letterSpacing:2,fontFamily:"monospace"}}>{value}</div>
    </div>
  );
}

// ── ANIMATED STAMP ─────────────────────────────────────────────
function StampCircle({filled,idx,animate}){
  const [pop,setPop]=useState(false);
  useEffect(()=>{ if(filled&&animate){ setPop(true); setTimeout(()=>setPop(false),600); } },[filled]);
  return (
    <div style={{
      width:52,height:52,borderRadius:"50%",
      background:filled?"linear-gradient(135deg,#fb4f07,#ff6b35,#c93d00)":"rgba(255,255,255,0.04)",
      border:filled?"none":"1.5px solid rgba(255,255,255,0.1)",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:filled?24:18,
      boxShadow:filled?"0 0 20px rgba(251,79,7,0.6), 0 4px 16px rgba(251,79,7,0.3)":"inset 0 1px 0 rgba(255,255,255,0.05)",
      transform:pop?"scale(1.25)":"scale(1)",
      transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
      position:"relative",
    }}>
      {filled ? "🎳" : <span style={{color:"rgba(255,255,255,0.15)",fontSize:13,fontWeight:300}}>{idx+1}</span>}
    </div>
  );
}

// ── TIER BADGE ─────────────────────────────────────────────────
function TierBadge({tier,small}){
  const t=TIERS[tier];
  return (
    <div style={{
      display:"inline-flex",alignItems:"center",gap:small?4:6,
      background:t.color+"18",border:"1px solid "+t.color+"44",
      color:t.color,borderRadius:20,
      padding:small?"3px 10px":"5px 14px",
      fontSize:small?10:12,fontWeight:700,letterSpacing:1,
    }}>
      {t.icon} {t.ar}
    </div>
  );
}

// ── PROGRESS RING ──────────────────────────────────────────────
function ProgressRing({stamps,goal,size=120}){
  const r=(size-12)/2;
  const circ=2*Math.PI*r;
  const pct=Math.min(stamps/goal,1);
  const [anim,setAnim]=useState(0);
  useEffect(()=>{ setTimeout(()=>setAnim(pct),100); },[pct]);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#orange-grad)" strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={circ*(1-anim)}
        strokeLinecap="round"
        style={{transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)"}}
      />
      <defs>
        <linearGradient id="orange-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fb4f07"/>
          <stop offset="100%" stopColor="#ff8c00"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── PIN GATE ───────────────────────────────────────────────────
function PinGate({onUnlock,onClose}){
  const [pin,setPin]=useState("");
  const [err,setErr]=useState(false);
  function press(d){
    const n=(pin+d).slice(0,4);setPin(n);
    if(n.length===4){
      if(n===MANAGER_PIN){onUnlock();}
      else{setErr(true);setTimeout(()=>{setErr(false);setPin("");},700);}
    }
  }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.95)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0f0f0f",border:"1px solid #222",borderRadius:24,padding:"36px 28px",width:"100%",maxWidth:320,textAlign:"center"}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#c93d00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(251,79,7,0.4)"}}>🔐</div>
        <div style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:4,fontFamily:"'Georgia',serif",letterSpacing:1}}>صلاحية المدير</div>
        <div style={{fontSize:12,color:"#555",marginBottom:28}}>أدخل الـ PIN المكوّن من 4 أرقام</div>
        <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:32,transform:err?"translateX(10px)":"none",transition:"transform 0.1s"}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:12,height:12,borderRadius:"50%",background:pin.length>i?(err?"#ff3b30":"#fb4f07"):"#222",transition:"all 0.2s",boxShadow:pin.length>i&&!err?"0 0 8px rgba(251,79,7,0.6)":"none"}}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
          {[1,2,3,4,5,6,7,8,9].map(d=>(
            <button key={d} onClick={()=>press(String(d))} style={{background:"#141414",border:"1px solid #1e1e1e",borderRadius:14,color:"#fff",fontSize:22,fontWeight:300,padding:"16px 0",cursor:"pointer",fontFamily:"'Georgia',serif",transition:"background 0.15s"}}
              onMouseEnter={e=>e.target.style.background="#1e1e1e"} onMouseLeave={e=>e.target.style.background="#141414"}
            >{d}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <button onClick={onClose} style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:14,color:"#444",fontSize:11,padding:"16px 0",cursor:"pointer"}}>إلغاء</button>
          <button onClick={()=>press("0")} style={{background:"#141414",border:"1px solid #1e1e1e",borderRadius:14,color:"#fff",fontSize:22,fontWeight:300,padding:"16px 0",cursor:"pointer",fontFamily:"'Georgia',serif"}}>0</button>
          <button onClick={()=>setPin(p=>p.slice(0,-1))} style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:14,color:"#666",fontSize:20,padding:"16px 0",cursor:"pointer"}}>⌫</button>
        </div>
        {err&&<div style={{color:"#ff3b30",fontSize:12,marginTop:16,fontWeight:600}}>PIN خاطئ</div>}
      </div>
    </div>
  );
}

// ── BROADCAST MODAL ────────────────────────────────────────────
const PRESETS=[
  {label:"🎉 عرض خاص",  text:"🎳 عرض XBOWL الحصري!\nاحجز اليوم واحصل على خصم ٢٠٪.\n\nxbowl.club"},
  {label:"🏆 بطولة",    text:"🏆 بطولة XBOWL قادمة!\nسجّل مكانك قبل نفاذ الأماكن.\n\nxbowl.club"},
  {label:"🎁 تذكير",    text:"🎳 لا تنسَ! أنت قريب من مكافأتك في XBOWL\nتعال وأكمل أختامك.\n\nxbowl.club"},
];
function BroadcastModal({customers,onClose}){
  const [msg,setMsg]=useState(PRESETS[0].text);
  const [sel,setSel]=useState(customers.map(c=>c.id));
  const [step,setStep]=useState("compose");
  const [idx,setIdx]=useState(0);
  const rcpts=customers.filter(c=>sel.includes(c.id));
  function toggle(id){setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);}
  function openWA(i){if(i>=rcpts.length)return;window.open("https://wa.me/"+toWAPhone(rcpts[i].phone)+"?text="+encodeURIComponent(msg),"_blank");}
  function start(){openWA(0);setIdx(1);setStep("sending");}
  function next(){openWA(idx);setIdx(i=>i+1);}
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.9)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a0a",border:"1px solid rgba(37,211,102,0.3)",borderRadius:24,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{background:"linear-gradient(135deg,#0d3320,#0a2018)",padding:"22px",borderRadius:"24px 24px 0 0",borderBottom:"1px solid rgba(37,211,102,0.2)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:"#25d36622",border:"1px solid #25d36644",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>💬</div>
            <div>
              <div style={{fontWeight:800,fontSize:16,color:"#fff",fontFamily:"'Georgia',serif"}}>بث واتساب — الولاء</div>
              <div style={{fontSize:11,color:"#25d366",marginTop:1}}>{customers.length} حامل بطاقة</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.05)",border:"none",color:"#666",width:32,height:32,borderRadius:"50%",fontSize:16,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:"22px"}}>
          {step==="compose"&&(<>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              {PRESETS.map((p,i)=><button key={i} onClick={()=>setMsg(p.text)} style={{background:msg===p.text?"rgba(37,211,102,0.12)":"#111",border:"1px solid "+(msg===p.text?"#25d36666":"#1e1e1e"),color:msg===p.text?"#25d366":"#666",padding:"6px 14px",borderRadius:20,fontSize:11,cursor:"pointer",fontWeight:600}}>{p.label}</button>)}
            </div>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={4} style={{width:"100%",background:"#111",border:"1px solid #1e1e1e",borderRadius:12,color:"#ddd",padding:"14px",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.7,boxSizing:"border-box",direction:"rtl",fontFamily:"inherit",marginBottom:8}}
              onFocus={e=>e.target.style.borderColor="#25d366"} onBlur={e=>e.target.style.borderColor="#1e1e1e"}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:10,color:"#444",letterSpacing:2}}>اختر المستلمين — {sel.length}/{customers.length}</div>
              <button onClick={()=>setSel(sel.length===customers.length?[]:customers.map(c=>c.id))} style={{background:"transparent",border:"1px solid #1e1e1e",color:"#555",padding:"4px 12px",borderRadius:8,fontSize:11,cursor:"pointer"}}>{sel.length===customers.length?"إلغاء الكل":"تحديد الكل"}</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto",marginBottom:18}}>
              {customers.map(c=>{
                const on=sel.includes(c.id);const t=TIERS[c.tier||getTier(c.visits)];
                return(
                  <div key={c.id} onClick={()=>toggle(c.id)} style={{display:"flex",alignItems:"center",gap:12,background:on?"rgba(37,211,102,0.05)":"#0d0d0d",border:"1px solid "+(on?"rgba(37,211,102,0.2)":"#141414"),borderRadius:10,padding:"10px 14px",cursor:"pointer",direction:"rtl"}}>
                    <div style={{width:18,height:18,borderRadius:4,background:on?"#25d366":"#111",border:"1.5px solid "+(on?"#25d366":"#2a2a2a"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000",flexShrink:0}}>{on?"✓":""}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13,color:"#ddd"}}>{c.name}</div>
                      <div style={{fontSize:10,color:"#555",marginTop:1}}>{c.phone}</div>
                    </div>
                    <TierBadge tier={c.tier||getTier(c.visits)} small/>
                  </div>
                );
              })}
            </div>
            <button onClick={()=>rcpts.length>0&&setStep("confirm")} style={{width:"100%",padding:"14px",background:rcpts.length>0?"linear-gradient(135deg,#25d366,#128c7e)":"#111",border:"none",borderRadius:14,color:rcpts.length>0?"#fff":"#333",fontWeight:800,fontSize:14,cursor:rcpts.length>0?"pointer":"not-allowed",letterSpacing:0.5}}>
              💬 إرسال لـ {rcpts.length} شخص
            </button>
          </>)}
          {step==="confirm"&&(<>
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:40,marginBottom:8}}>📤</div>
              <div style={{fontWeight:800,fontSize:17,color:"#fff",fontFamily:"'Georgia',serif",marginBottom:6}}>جاهز للإرسال</div>
              <div style={{fontSize:12,color:"#555"}}>سيفتح واتساب لكل شخص على حدة</div>
            </div>
            <div style={{background:"#0d0d0d",borderRadius:12,padding:"14px 16px",marginBottom:16,fontSize:13,color:"#888",lineHeight:1.8,borderRight:"3px solid #25d366",whiteSpace:"pre-wrap",direction:"rtl"}}>{msg}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setStep("compose")} style={{flex:1,padding:"13px",borderRadius:12,background:"transparent",border:"1px solid #1e1e1e",color:"#555",fontWeight:700,fontSize:13,cursor:"pointer"}}>← تعديل</button>
              <button onClick={start} style={{flex:2,padding:"13px",background:"linear-gradient(135deg,#25d366,#128c7e)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>💬 ابدأ الإرسال</button>
            </div>
          </>)}
          {step==="sending"&&(<>
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:40,marginBottom:8}}>{idx>=rcpts.length?"🎉":"💬"}</div>
              <div style={{fontWeight:800,fontSize:17,color:"#25d366",fontFamily:"'Georgia',serif",marginBottom:4}}>{idx} / {rcpts.length}</div>
            </div>
            <div style={{background:"#111",borderRadius:10,height:6,marginBottom:18,overflow:"hidden"}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,#25d366,#128c7e)",width:(idx/rcpts.length*100)+"%",transition:"width 0.5s",borderRadius:10}}/>
            </div>
            {idx<rcpts.length
              ?<button onClick={next} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#25d366,#128c7e)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",marginBottom:8}}>💬 التالي: {rcpts[idx]&&rcpts[idx].name}</button>
              :<button onClick={onClose} style={{width:"100%",padding:"13px",background:"#111",border:"1px solid #1e1e1e",borderRadius:14,color:"#777",fontWeight:700,fontSize:13,cursor:"pointer"}}>تم ✓</button>
            }
          </>)}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CUSTOMER APP — Premium Edition
// ══════════════════════════════════════════════════════════════
function CustomerApp(){
  const [screen,setScreen]=useState("home"); // home | card | register | success
  const [phone,setPhone]=useState("");
  const [customer,setCustomer]=useState(null);
  const [error,setError]=useState("");
  const [regForm,setRegForm]=useState({name:"",phone:""});
  const [regErr,setRegErr]=useState({});
  const [justReg,setJustReg]=useState(false);
  const [showQR,setShowQR]=useState(false);
  const [stampAnim,setStampAnim]=useState(false);

  function lookup(){
    const d=phone.replace(/\D/g,"");
    const c=DB_CUSTOMERS.find(x=>x.phone.replace(/\D/g,"")===d);
    if(c){setCustomer({...c});setError("");setScreen("card");}
    else setError("الرقم غير مسجل — سجّل بطاقتك مجاناً");
  }
  function register(){
    const e={};
    if(!regForm.name.trim()) e.name="مطلوب";
    if(regForm.phone.replace(/\D/g,"").length<9) e.phone="رقم غير صحيح";
    if(Object.keys(e).length){setRegErr(e);return;}
    const nc={id:genId(),name:regForm.name.trim(),phone:regForm.phone,stamps:0,visits:0,totalGames:0,tier:"bronze",joined:Date.now(),lastVisit:Date.now()};
    DB_CUSTOMERS.push(nc);
    setCustomer({...nc}); setJustReg(true); setScreen("card");
  }

  const tier = (customer && customer.visits!=null) ? TIERS[getTier(customer.visits)] : TIERS.bronze;
  const nextTier = (!customer||customer.visits==null) ? null : customer.visits>=15 ? null : customer.visits>=5 ? TIERS.gold : TIERS.silver;
  const visitsToNext = (!customer||customer.visits==null) ? 0 : customer.visits>=15 ? 0 : customer.visits>=5 ? 15-customer.visits : 5-customer.visits;

  return (
    <div dir="rtl" style={{minHeight:"100vh",background:"#060606",fontFamily:"'Segoe UI',Tahoma,Geneva,sans-serif",overflowX:"hidden"}}>

      {/* ── HOME ── */}
      {screen==="home"&&(
        <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
          {/* Hero */}
          <div style={{
            padding:"60px 24px 40px",textAlign:"center",position:"relative",overflow:"hidden",
            background:"linear-gradient(180deg,#0f0800 0%,#060606 100%)",
          }}>
            {/* Glow orbs */}
            <div style={{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(251,79,7,0.15) 0%,transparent 70%)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",top:20,right:-40,width:150,height:150,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,140,0,0.1) 0%,transparent 70%)",pointerEvents:"none"}}/>

            {/* Logo */}
            <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:32,padding:"10px 20px",background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:30}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 0 12px rgba(251,79,7,0.5)"}}>🎳</div>
              <span style={{fontSize:16,fontWeight:900,color:"#fb4f07",letterSpacing:3}}>XBOWL</span>
            </div>

            <h1 style={{margin:"0 0 8px",fontSize:36,fontWeight:900,color:"#fff",lineHeight:1.2,letterSpacing:-0.5}}>
              برنامج
              <span style={{display:"block",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:44}}> الولاء</span>
            </h1>
            <p style={{margin:"0 0 40px",fontSize:14,color:"#666",lineHeight:1.7}}>
              اجمع ٥ أختام مع كل زيارة<br/>واحصل على لعبة مجانية
            </p>

            {/* Stamp preview visual */}
            <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:40}}>
              {Array.from({length:5}).map((_,i)=>(
                <div key={i} style={{
                  width:48,height:48,borderRadius:"50%",
                  background:i<3?"linear-gradient(135deg,#fb4f07,#ff6b35)":"rgba(255,255,255,0.04)",
                  border:i<3?"none":"1.5px solid rgba(255,255,255,0.08)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?22:16,
                  boxShadow:i<3?"0 0 16px rgba(251,79,7,0.5)":"none",
                  transform:i===2?"scale(1.15)":"scale(1)",
                }}>
                  {i<3?"🎳":""}
                </div>
              ))}
            </div>
          </div>

          {/* Tiers */}
          <div style={{padding:"0 20px 32px"}}>
            <div style={{fontSize:10,color:"#444",letterSpacing:3,marginBottom:14,textAlign:"center"}}>مستويات العضوية</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:32}}>
              {Object.entries(TIERS).map(([k,t])=>(
                <div key={k} style={{background:"#0d0d0d",border:"1px solid "+t.color+"22",borderRadius:16,padding:"16px 10px",textAlign:"center"}}>
                  <div style={{fontSize:24,marginBottom:6}}>{t.icon}</div>
                  <div style={{fontSize:12,fontWeight:700,color:t.color,letterSpacing:1}}>{t.ar}</div>
                  <div style={{fontSize:9,color:"#444",marginTop:4}}>{k==="bronze"?"0+ زيارة":k==="silver"?"5+ زيارة":"15+ زيارة"}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Login */}
          <div style={{padding:"0 20px 40px",marginTop:"auto"}}>
            <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:20,padding:"24px"}}>
              <div style={{fontSize:10,color:"#555",letterSpacing:2,marginBottom:14}}>سجّل دخولك برقم جوالك</div>
              <input value={phone} onChange={e=>{setPhone(e.target.value);setError("");}} placeholder="05X XXX XXXX" inputMode="tel"
                style={{width:"100%",background:"#111",border:"1px solid #1e1e1e",borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box",textAlign:"right",letterSpacing:1,marginBottom:error?8:14}}
                onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.5)"} onBlur={e=>e.target.style.borderColor="#1e1e1e"}
                onKeyDown={e=>e.key==="Enter"&&lookup()}/>
              {error&&<div style={{color:"#ff5555",fontSize:12,marginBottom:14,textAlign:"right"}}>⚠ {error}</div>}
              <button onClick={lookup} style={{
                width:"100%",padding:"15px",
                background:"linear-gradient(135deg,#fb4f07,#c93d00)",
                border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",
                boxShadow:"0 8px 28px rgba(251,79,7,0.4)",letterSpacing:0.5,marginBottom:12,
                transition:"transform 0.15s",
              }} onMouseEnter={e=>e.target.style.transform="translateY(-2px)"} onMouseLeave={e=>e.target.style.transform="translateY(0)"}>
                عرض بطاقتي
              </button>
              <button onClick={()=>setScreen("register")} style={{width:"100%",padding:"13px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:14,color:"#555",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                تسجيل بطاقة جديدة مجاناً →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTER ── */}
      {screen==="register"&&(
        <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"24px 20px 0",display:"flex",alignItems:"center",gap:14,background:"#060606"}}>
            <button onClick={()=>setScreen("home")} style={{background:"rgba(255,255,255,0.05)",border:"none",color:"#888",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
            <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>بطاقة جديدة</div>
          </div>

          <div style={{flex:1,padding:"32px 20px 40px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{textAlign:"center",marginBottom:36}}>
              <div style={{fontSize:56,marginBottom:12}}>🎫</div>
              <div style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:"'Georgia',serif",marginBottom:8}}>انضم لعائلة XBOWL</div>
              <div style={{fontSize:13,color:"#555"}}>سجّل مجاناً وابدأ تجميع أختامك</div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>الاسم الكامل</label>
              <input value={regForm.name} onChange={e=>{setRegForm(f=>({...f,name:e.target.value}));setRegErr(er=>({...er,name:""}));}} placeholder="اسمك"
                style={{width:"100%",background:"#0d0d0d",border:"1px solid "+(regErr.name?"#ff4444":"#1e1e1e"),borderRadius:14,color:"#fff",padding:"15px 16px",fontSize:16,outline:"none",boxSizing:"border-box",textAlign:"right"}}
                onFocus={e=>{if(!regErr.name)e.target.style.borderColor="rgba(251,79,7,0.5)";}} onBlur={e=>{if(!regErr.name)e.target.style.borderColor="#1e1e1e";}}/>
              {regErr.name&&<div style={{color:"#ff5555",fontSize:11,marginTop:5}}>⚠ {regErr.name}</div>}
            </div>
            <div style={{marginBottom:28}}>
              <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>رقم الجوال</label>
              <input value={regForm.phone} onChange={e=>{setRegForm(f=>({...f,phone:e.target.value}));setRegErr(er=>({...er,phone:""}));}} placeholder="05X XXX XXXX" inputMode="tel"
                style={{width:"100%",background:"#0d0d0d",border:"1px solid "+(regErr.phone?"#ff4444":"#1e1e1e"),borderRadius:14,color:"#fff",padding:"15px 16px",fontSize:16,outline:"none",boxSizing:"border-box",textAlign:"right",letterSpacing:1}}
                onFocus={e=>{if(!regErr.phone)e.target.style.borderColor="rgba(251,79,7,0.5)";}} onBlur={e=>{if(!regErr.phone)e.target.style.borderColor="#1e1e1e";}}/>
              {regErr.phone&&<div style={{color:"#ff5555",fontSize:11,marginTop:5}}>⚠ {regErr.phone}</div>}
            </div>
            <button onClick={register} style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:16,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",boxShadow:"0 8px 28px rgba(251,79,7,0.4)",letterSpacing:0.5}}>
              إنشاء بطاقتي 🎳
            </button>
          </div>
        </div>
      )}

      {/* ── CARD ── */}
      {screen==="card"&&customer!=null&&(
        <div style={{minHeight:"100vh",paddingBottom:40}}>
          {/* Top bar */}
          <div style={{padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(6,6,6,0.9)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <button onClick={()=>{setScreen("home");setCustomer(null);setPhone("");setJustReg(false);}} style={{background:"rgba(255,255,255,0.05)",border:"none",color:"#888",width:34,height:34,borderRadius:"50%",fontSize:16,cursor:"pointer"}}>←</button>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{customer.name}</div>
              <TierBadge tier={getTier(customer.visits)} small/>
            </div>
            <button onClick={()=>setShowQR(!showQR)} style={{background:"rgba(251,79,7,0.1)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",width:34,height:34,borderRadius:"50%",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {showQR?"✕":"⬛"}
            </button>
          </div>

          {justReg&&(
            <div style={{margin:"16px 20px 0",background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:14,padding:"12px 16px",textAlign:"center",fontSize:13,color:"#fb4f07",fontWeight:700}}>
              🎉 أهلاً بك! تم إنشاء بطاقتك
            </div>
          )}

          {/* QR Modal */}
          {showQR&&(
            <div onClick={()=>setShowQR(false)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.95)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
              <div style={{fontSize:13,color:"#555",letterSpacing:2}}>أرِ هذا للموظف</div>
              <div style={{background:"#0d0d0d",border:"1px solid rgba(251,79,7,0.3)",borderRadius:20,padding:24}}>
                <QRCode value={customer.id} size={200}/>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:4,fontFamily:"monospace"}}>{customer.id}</div>
              <div style={{fontSize:12,color:"#444"}}>اضغط للإغلاق</div>
            </div>
          )}

          {/* HERO CARD */}
          <div style={{margin:"20px 20px 0",position:"relative"}}>
            <div style={{
              borderRadius:24,overflow:"hidden",
              background:tier.bg,
              border:"1px solid "+tier.color+"22",
              boxShadow:"0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px "+tier.color+"11",
              padding:"28px 24px 24px",position:"relative",
            }}>
              {/* Card texture */}
              <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 80% 20%,"+tier.color+"08 0%,transparent 50%)",pointerEvents:"none"}}/>
              <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,0.01) 20px,rgba(255,255,255,0.01) 21px)",pointerEvents:"none"}}/>

              {/* Card header */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,position:"relative"}}>
                <div>
                  <div style={{fontSize:10,color:tier.color,letterSpacing:4,fontWeight:700,marginBottom:6}}>XBOWL LOYALTY</div>
                  <div style={{fontSize:20,fontWeight:800,color:"#fff",fontFamily:"'Georgia',serif"}}>{customer.name}</div>
                  <div style={{marginTop:6}}><TierBadge tier={getTier(customer.visits)}/></div>
                </div>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:9,color:"#555",letterSpacing:2,marginBottom:6}}>MEMBER SINCE</div>
                  <div style={{fontSize:11,color:"#888"}}>{fmtDate(customer.joined)}</div>
                  <div style={{marginTop:8}}>
                    <button onClick={()=>setShowQR(true)} style={{background:tier.color+"18",border:"1px solid "+tier.color+"33",color:tier.color,padding:"6px 12px",borderRadius:8,fontSize:11,cursor:"pointer",fontWeight:700}}>
                      QR ⬛
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress ring + stamps */}
              <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:20}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <ProgressRing stamps={customer.stamps} goal={STAMP_GOAL} size={100}/>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:26,fontWeight:900,color:"#fff",lineHeight:1}}>{customer.stamps}</div>
                    <div style={{fontSize:9,color:"#666",letterSpacing:1}}>/{STAMP_GOAL}</div>
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:"#666",letterSpacing:2,marginBottom:12}}>الأختام</div>
                  <div style={{display:"flex",gap:8}}>
                    {Array.from({length:STAMP_GOAL}).map((_,i)=>(
                      <StampCircle key={i} filled={i<customer.stamps} idx={i} animate={stampAnim}/>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reward alert */}
              {customer.stamps>=STAMP_GOAL&&(
                <div style={{background:"rgba(251,79,7,0.12)",border:"1px solid rgba(251,79,7,0.3)",borderRadius:14,padding:"14px 16px",textAlign:"center",marginBottom:0}}>
                  <div style={{fontSize:26,marginBottom:4}}>🎁</div>
                  <div style={{fontWeight:800,color:"#fb4f07",fontSize:15,fontFamily:"'Georgia',serif"}}>تهانينا! لعبة مجانية</div>
                  <div style={{color:"#888",fontSize:12,marginTop:4}}>أرِ الموظف هذه البطاقة</div>
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,margin:"16px 20px 0"}}>
            {[
              {val:customer.visits,  label:"زيارة",       icon:"📅"},
              {val:customer.stamps,  label:"ختم حالي",    icon:"🎳"},
              {val:STAMP_GOAL-customer.stamps, label:"أختام متبقية", icon:"⏳"},
            ].map(({val,label,icon})=>(
              <div key={label} style={{background:"#0d0d0d",border:"1px solid #111",borderRadius:16,padding:"16px 12px",textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
                <div style={{fontSize:24,fontWeight:800,color:"#fb4f07",lineHeight:1}}>{val}</div>
                <div style={{fontSize:10,color:"#444",marginTop:4,letterSpacing:1}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Tier progress */}
          {nextTier&&(
            <div style={{margin:"14px 20px 0",background:"#0d0d0d",border:"1px solid #111",borderRadius:16,padding:"18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:12,color:"#666"}}>تقدمك نحو {nextTier.ar}</div>
                <div style={{fontSize:12,color:nextTier.color,fontWeight:700}}>{visitsToNext} زيارة متبقية</div>
              </div>
              <div style={{background:"#111",borderRadius:8,height:6,overflow:"hidden"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,"+nextTier.color+","+nextTier.color+"88)",width:((customer.visits%(nextTier===TIERS.silver?5:10))/(nextTier===TIERS.silver?5:10)*100)+"%",borderRadius:8,transition:"width 1s cubic-bezier(0.4,0,0.2,1)"}}/>
              </div>
            </div>
          )}

          {/* Member ID */}
          <div style={{margin:"14px 20px 0",background:"#0d0d0d",border:"1px solid #111",borderRadius:16,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:9,color:"#444",letterSpacing:3,marginBottom:4}}>MEMBER ID</div>
              <div style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:"monospace",letterSpacing:4}}>{customer.id}</div>
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:9,color:"#444",letterSpacing:2,marginBottom:4}}>آخر زيارة</div>
              <div style={{fontSize:12,color:"#777"}}>{daysAgo(customer.lastVisit)}</div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STAFF APP
// ══════════════════════════════════════════════════════════════
function StaffApp(){
  const [tab,setTab]=useState("scan");
  const [scanId,setScanId]=useState("");
  const [found,setFound]=useState(null);
  const [scanErr,setScanErr]=useState("");
  const [lastAction,setLastAction]=useState(null);
  const [loyalFilter,setLoyalFilter]=useState("all");
  const [exportFilter,setExportFilter]=useState("all");
  const [showCopied,setShowCopied]=useState(false);
  const [showPin,setShowPin]=useState(false);
  const [showBroadcast,setShowBroadcast]=useState(false);
  const [,refresh]=useState(0);

  function doLookup(){
    const c=DB_CUSTOMERS.find(x=>x.id===scanId.toUpperCase().trim());
    if(c){setFound({...c});setScanErr("");}
    else setScanErr("البطاقة غير موجودة");
  }
  function doStamp(){
    if(!found)return;
    const c=DB_CUSTOMERS.find(x=>x.id===found.id);
    if(!c)return;
    const gotReward=(c.stamps+1)>=STAMP_GOAL;
    if(gotReward){DB_REWARDS.push({id:"R"+Date.now(),customerId:c.id,note:"لعبة مجانية",redeemedAt:Date.now()});c.stamps=0;}
    else c.stamps+=1;
    c.visits+=1; c.totalGames+=1; c.lastVisit=Date.now();
    c.tier=getTier(c.visits);
    setLastAction({name:c.name,gotReward,stamps:c.stamps});
    setFound(null);setScanId("");setScanErr("");
    refresh(n=>n+1);
  }

  const customers=DB_CUSTOMERS;
  const listData=loyalFilter==="all"?customers:loyalFilter==="full"?customers.filter(c=>c.stamps>=STAMP_GOAL):customers.filter(c=>c.stamps>0&&c.stamps<STAMP_GOAL);
  const exportData=exportFilter==="all"?customers:exportFilter==="full"?customers.filter(c=>c.stamps>=STAMP_GOAL):exportFilter==="gold"?customers.filter(c=>getTier(c.visits)==="gold"):customers.filter(c=>getTier(c.visits)==="silver");

  function copy(){
    navigator.clipboard.writeText(exportData.map(c=>c.phone).join("\n"))
      .then(()=>{setShowCopied(true);setTimeout(()=>setShowCopied(false),2500);});
  }

  return (
    <div style={{minHeight:"100vh",background:"#060606",fontFamily:"'Segoe UI',Tahoma,sans-serif",paddingBottom:80}}>
      {showPin&&<PinGate onUnlock={()=>{setShowPin(false);setShowBroadcast(true);}} onClose={()=>setShowPin(false)}/>}
      {showBroadcast&&<BroadcastModal customers={exportData} onClose={()=>setShowBroadcast(false)}/>}

      {/* Header */}
      <div style={{padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.04)",background:"rgba(6,6,6,0.95)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 0 12px rgba(251,79,7,0.4)"}}>🎳</div>
          <div>
            <span style={{fontSize:16,fontWeight:900,color:"#fb4f07",letterSpacing:2}}>XBOWL</span>
            <span style={{fontSize:10,color:"#333",letterSpacing:3,marginRight:8}}> STAFF</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.15)",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#fb4f07",fontWeight:700}}>{customers.length} عضو</div>
          <div style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.15)",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#ffd700",fontWeight:700}}>{DB_REWARDS.length} مكافأة</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid rgba(255,255,255,0.04)",background:"#060606",position:"sticky",top:0,zIndex:9}}>
        {[["scan","🔲 مسح"],["members","👥 الأعضاء"],["export","📲 تصدير"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"14px 6px",background:"transparent",border:"none",borderBottom:tab===t?"2px solid #fb4f07":"2px solid transparent",color:tab===t?"#fb4f07":"#444",fontWeight:tab===t?700:400,fontSize:12,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"20px 16px"}}>

        {/* ── SCAN TAB ── */}
        {tab==="scan"&&(<>
          {lastAction&&(
            <div style={{
              background:lastAction.gotReward?"rgba(251,79,7,0.08)":"rgba(34,197,94,0.06)",
              border:"1px solid "+(lastAction.gotReward?"rgba(251,79,7,0.25)":"rgba(34,197,94,0.2)"),
              borderRadius:16,padding:"16px 18px",marginBottom:16,
              display:"flex",alignItems:"center",gap:12,
            }}>
              <div style={{fontSize:28}}>{lastAction.gotReward?"🎁":"✅"}</div>
              <div>
                <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{lastAction.gotReward?"مكافأة محققة — ":"ختم مضاف — "}{lastAction.name}</div>
                <div style={{fontSize:12,color:"#555",marginTop:2}}>{lastAction.gotReward?"لعبة مجانية — أعِد العداد":lastAction.stamps+" / "+STAMP_GOAL+" أختام"}</div>
              </div>
              <button onClick={()=>setLastAction(null)} style={{marginLeft:"auto",background:"transparent",border:"none",color:"#333",fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
          )}

          {/* Scanner */}
          <div style={{background:"#0a0a0a",border:"1px solid #111",borderRadius:20,overflow:"hidden",marginBottom:16}}>
            <div style={{background:"#0d0d0d",padding:"16px 18px",borderBottom:"1px solid #111"}}>
              <div style={{fontSize:11,color:"#fb4f07",letterSpacing:3,fontWeight:700}}>🔲 مسح QR Code</div>
            </div>
            {/* Viewfinder */}
            <div style={{height:160,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",background:"#070707"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#fb4f07,transparent)",animation:"scan 2s linear infinite"}}/>
              {[["top:14px","left:14px"],["top:14px","right:14px"],["bottom:14px","left:14px"],["bottom:14px","right:14px"]].map(([t,s],i)=>(
                <div key={i} style={{position:"absolute",width:22,height:22,borderTop:t.includes("top")?"2.5px solid #fb4f07":"none",borderBottom:t.includes("bottom")?"2.5px solid #fb4f07":"none",borderLeft:s.includes("left")?"2.5px solid #fb4f07":"none",borderRight:s.includes("right")?"2.5px solid #fb4f07":"none",...Object.fromEntries([t,s].map(x=>x.split(":")))}}/>
              ))}
              <div style={{fontSize:32,marginBottom:6,opacity:0.4}}>📷</div>
              <div style={{fontSize:11,color:"#333"}}>وجّه الكاميرا على QR الزبون</div>
            </div>
            <div style={{padding:"16px 18px"}}>
              <div style={{fontSize:10,color:"#333",textAlign:"center",marginBottom:12}}>— أو أدخل رقم البطاقة —</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={scanId} onChange={e=>{setScanId(e.target.value.toUpperCase());setScanErr("");setFound(null);}} placeholder="XB001" onKeyDown={e=>e.key==="Enter"&&doLookup()}
                  style={{flex:1,background:"#111",border:"1px solid #1a1a1a",borderRadius:12,color:"#fff",padding:"12px 14px",fontSize:16,outline:"none",fontFamily:"monospace",letterSpacing:3}}
                  onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.4)"} onBlur={e=>e.target.style.borderColor="#1a1a1a"}/>
                <button onClick={doLookup} style={{background:"#fb4f07",border:"none",color:"#fff",padding:"12px 18px",borderRadius:12,fontWeight:800,fontSize:13,cursor:"pointer"}}>بحث</button>
              </div>
              {scanErr&&<div style={{color:"#ff5555",fontSize:12,marginBottom:10}}>⚠ {scanErr}</div>}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {DB_CUSTOMERS.map(c=>(
                  <button key={c.id} onClick={()=>{const f=DB_CUSTOMERS.find(x=>x.id===c.id);if(f){setFound({...f});setScanId(c.id);setScanErr("");}}} style={{background:"#111",border:"1px solid #1a1a1a",color:"#555",padding:"4px 10px",borderRadius:8,fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>{c.id}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Found result */}
          {found&&(
            <div style={{background:"#0a0a0a",border:"1px solid rgba(251,79,7,0.2)",borderRadius:20,overflow:"hidden"}}>
              <div style={{padding:"20px 18px",borderBottom:"1px solid #111"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:"'Georgia',serif"}}>{found.name}</div>
                    <div style={{fontSize:12,color:"#555",marginTop:4}}>{found.phone} · {found.visits} زيارة</div>
                    <div style={{marginTop:8}}><TierBadge tier={getTier(found.visits)}/></div>
                  </div>
                  <QRCode value={found.id} size={64}/>
                </div>
                {/* Stamp display */}
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {Array.from({length:STAMP_GOAL}).map((_,i)=>(
                    <div key={i} style={{flex:1,aspectRatio:"1",borderRadius:10,background:i<found.stamps?"linear-gradient(135deg,#fb4f07,#c93d00)":"#111",border:i<found.stamps?"none":"1px solid #1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:i<found.stamps?"0 0 10px rgba(251,79,7,0.4)":"none"}}>{i<found.stamps?"🎳":""}</div>
                  ))}
                </div>
                {found.stamps>=STAMP_GOAL
                  ?<div style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:12,padding:"12px",textAlign:"center"}}>
                    <div style={{fontSize:20,marginBottom:4}}>🎁</div>
                    <div style={{color:"#fb4f07",fontWeight:800}}>البطاقة ممتلئة — مكافأة جاهزة!</div>
                  </div>
                  :<div style={{background:"#0d0d0d",borderRadius:12,padding:"10px 14px",textAlign:"center",fontSize:13,color:"#555"}}>
                    سيصبح لديه <span style={{color:"#fb4f07",fontWeight:800}}>{found.stamps+1}</span> / {STAMP_GOAL} أختام
                  </div>
                }
              </div>
              <div style={{padding:"14px 18px",display:"flex",gap:10}}>
                <button onClick={doStamp} style={{flex:1,padding:"14px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 6px 20px rgba(251,79,7,0.35)"}}>
                  {found.stamps>=STAMP_GOAL?"🎁 صرف المكافأة":"✅ إضافة ختم"}
                </button>
                <button onClick={()=>{setFound(null);setScanId("");}} style={{padding:"14px 16px",background:"#111",border:"1px solid #1a1a1a",borderRadius:14,color:"#555",fontSize:18,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          )}
        </>)}

        {/* ── MEMBERS TAB ── */}
        {tab==="members"&&(<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
            {[
              [customers.length,"عضو","👥","#fb4f07"],
              [DB_REWARDS.length,"مكافأة","🎁","#ffd700"],
              [customers.filter(c=>c.stamps>=STAMP_GOAL).length,"جاهز للمكافأة","⭐","#25d366"],
            ].map(([v,l,ic,clr])=>(
              <div key={l} style={{background:"#0a0a0a",border:"1px solid #111",borderRadius:16,padding:"16px 12px",textAlign:"center"}}>
                <div style={{fontSize:20,marginBottom:6}}>{ic}</div>
                <div style={{fontSize:24,fontWeight:800,color:clr}}>{v}</div>
                <div style={{fontSize:10,color:"#444",marginTop:4,letterSpacing:1}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {[["all","الكل"],["active","نشط"],["full","مكافأة 🎁"]].map(([k,l])=>(
              <button key={k} onClick={()=>setLoyalFilter(k)} style={{padding:"7px 14px",borderRadius:20,background:loyalFilter===k?"#fb4f07":"#0d0d0d",border:"1px solid "+(loyalFilter===k?"transparent":"#111"),color:loyalFilter===k?"#fff":"#555",fontWeight:700,fontSize:11,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {listData.map(c=>{
              const t=TIERS[getTier(c.visits)];
              return(
                <div key={c.id} style={{background:"#0a0a0a",border:"1px solid "+(c.stamps>=STAMP_GOAL?"rgba(251,79,7,0.2)":"#0f0f0f"),borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:t.bg,border:"1px solid "+t.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{t.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>{c.name}</div>
                      <div style={{fontSize:10,color:"#333",fontFamily:"monospace"}}>{c.id}</div>
                      {c.stamps>=STAMP_GOAL&&<span style={{background:"rgba(251,79,7,0.15)",border:"1px solid rgba(251,79,7,0.3)",color:"#fb4f07",borderRadius:10,padding:"1px 8px",fontSize:9,fontWeight:700}}>مكافأة 🎁</span>}
                    </div>
                    <div style={{display:"flex",gap:5,marginBottom:6}}>
                      {Array.from({length:STAMP_GOAL}).map((_,i)=>(
                        <div key={i} style={{width:18,height:18,borderRadius:4,background:i<c.stamps?"#fb4f07":"#111",border:i<c.stamps?"none":"1px solid #1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}>{i<c.stamps?"🎳":""}</div>
                      ))}
                    </div>
                    <div style={{fontSize:10,color:"#444"}}>{c.phone} · {c.visits} زيارة · {daysAgo(c.lastVisit)}</div>
                  </div>
                  <TierBadge tier={getTier(c.visits)} small/>
                </div>
              );
            })}
          </div>
        </>)}

        {/* ── EXPORT TAB ── */}
        {tab==="export"&&(<>
          <div style={{background:"#0a0a0a",border:"1px solid rgba(37,211,102,0.15)",borderRadius:20,overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"18px 20px",borderBottom:"1px solid #0f0f0f"}}>
              <div style={{fontSize:11,color:"#25d366",letterSpacing:3,fontWeight:700,marginBottom:4}}>📲 استخراج الأرقام</div>
              <div style={{fontSize:12,color:"#444"}}>{exportData.length} رقم جاهز للتصدير</div>
            </div>
            {/* Segment filter */}
            <div style={{padding:"14px 16px",borderBottom:"1px solid #0f0f0f"}}>
              <div style={{fontSize:10,color:"#444",letterSpacing:2,marginBottom:10}}>اختر الشريحة</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  ["all","كل الأعضاء",customers.length+"","👥"],
                  ["full","مكافأة جاهزة 🎁",customers.filter(c=>c.stamps>=STAMP_GOAL).length+"","🎁"],
                  ["gold","أعضاء ذهبيون 🥇",customers.filter(c=>getTier(c.visits)==="gold").length+"","🏆"],
                  ["silver","أعضاء فضيون 🥈",customers.filter(c=>getTier(c.visits)==="silver").length+"","🥈"],
                ].map(([k,l,cnt,ic])=>(
                  <div key={k} onClick={()=>setExportFilter(k)} style={{
                    display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,cursor:"pointer",
                    background:exportFilter===k?"rgba(37,211,102,0.06)":"#0d0d0d",
                    border:"1px solid "+(exportFilter===k?"rgba(37,211,102,0.2)":"#111"),
                  }}>
                    <div style={{width:18,height:18,borderRadius:4,background:exportFilter===k?"#25d366":"#111",border:"1.5px solid "+(exportFilter===k?"#25d366":"#1e1e1e"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000"}}>{exportFilter===k?"✓":""}</div>
                    <span style={{fontSize:16}}>{ic}</span>
                    <div style={{flex:1,fontSize:13,color:exportFilter===k?"#fff":"#666",fontWeight:exportFilter===k?700:400}}>{l}</div>
                    <div style={{background:"#111",border:"1px solid #1a1a1a",color:"#555",borderRadius:10,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cnt}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"16px 18px"}}>
              <button onClick={()=>setShowPin(true)} style={{
                width:"100%",padding:"14px",
                background:"linear-gradient(135deg,#25d366,#128c7e)",
                border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                boxShadow:"0 6px 20px rgba(37,211,102,0.2)",marginBottom:10,
              }}>
                <span style={{fontSize:20}}>💬</span>
                إرسال بث واتساب
                <span style={{fontSize:10,background:"rgba(0,0,0,0.25)",borderRadius:8,padding:"3px 10px"}}>🔐 مدير</span>
              </button>
              <button onClick={copy} style={{
                width:"100%",padding:"13px",
                background:showCopied?"rgba(34,197,94,0.1)":"transparent",
                border:"1px solid "+(showCopied?"rgba(34,197,94,0.3)":"#111"),
                borderRadius:14,color:showCopied?"#22c55e":"#555",
                fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.3s",
              }}>{showCopied?"✓ تم النسخ":"📋 نسخ الأرقام"}</button>
            </div>
          </div>

          {/* Preview */}
          <div style={{background:"#0a0a0a",border:"1px solid #0f0f0f",borderRadius:16,padding:"16px"}}>
            <div style={{fontSize:10,color:"#333",letterSpacing:2,marginBottom:12}}>معاينة القائمة</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {exportData.map((c,i)=>{
                const t=TIERS[getTier(c.visits)];
                return(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #0d0d0d"}}>
                    <div style={{fontSize:12,color:"#333",width:20,textAlign:"center"}}>{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#ddd"}}>{c.name}</div>
                      <div style={{fontSize:11,color:"#444",marginTop:1,fontFamily:"monospace"}}>{c.phone}</div>
                    </div>
                    <TierBadge tier={getTier(c.visits)} small/>
                  </div>
                );
              })}
            </div>
          </div>
        </>)}

      </div>
      <style>{`@keyframes scan{0%{top:0}100%{top:100%}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════
export default function App(){
  const [mode,setMode]=useState("customer");
  return (
    <div>
      <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"rgba(6,6,6,0.98)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:40,padding:"5px",display:"flex",gap:3,zIndex:200,backdropFilter:"blur(24px)",boxShadow:"0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)"}}>
        {[["customer","📱 الزبون"],["staff","🔧 الموظف"]].map(([v,l])=>(
          <button key={v} onClick={()=>setMode(v)} style={{padding:"9px 22px",borderRadius:30,background:mode===v?"linear-gradient(135deg,#fb4f07,#c93d00)":"transparent",border:"none",color:mode===v?"#fff":"#444",fontWeight:700,fontSize:12,cursor:"pointer",boxShadow:mode===v?"0 4px 12px rgba(251,79,7,0.4)":"none",transition:"all 0.2s"}}>{l}</button>
        ))}
      </div>
      {mode==="customer"?<CustomerApp/>:<StaffApp/>}
    </div>
  );
}
