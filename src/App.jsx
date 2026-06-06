import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ── CONFIG ─────────────────────────────────────────────────────
const SUPABASE_URL = "https://ooaqtwjqyiasqxuofaia.supabase.co";
const SUPABASE_KEY = "sb_publishable_jCB5RCh6cXRMWqkXmjC2PQ_Ew6A4kwI";
const STAMP_GOAL  = 5;
const MANAGER_PIN = "2030";

// ── SUPABASE CLIENT ────────────────────────────────────────────
const sb = {
  async query(table, method="GET", body=null, params="") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": method==="POST" ? "return=representation" : "return=minimal",
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) { const e = await res.text(); throw new Error(e); }
    if (method==="DELETE" || (method==="PATCH" && res.status===204)) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  async getCustomers() {
    return await sb.query("customers","GET",null,"?select=*&order=joined.desc") || [];
  },
  async getCustomerByPhone(phone) {
    const d = phone.replace(/\D/g,"");
    const rows = await sb.query("customers","GET",null,`?phone=eq.${d}&select=*`);
    return rows && rows[0] ? rows[0] : null;
  },
  async getCustomerById(id) {
    const rows = await sb.query("customers","GET",null,`?id=eq.${id}&select=*`);
    return rows && rows[0] ? rows[0] : null;
  },
  async createCustomer(c) {
    const rows = await sb.query("customers","POST",c);
    return rows && rows[0] ? rows[0] : null;
  },
  async updateCustomer(id, data) {
    return await sb.query("customers","PATCH",data,`?id=eq.${id}`);
  },
  async getRewards() {
    return await sb.query("rewards","GET",null,"?select=*,customers(name)&order=redeemed_at.desc") || [];
  },
  async addReward(r) {
    return await sb.query("rewards","POST",r);
  },
  async deleteCustomer(id) {
    await sb.query("rewards","DELETE",null,`?customer_id=eq.${id}`);
    return await sb.query("customers","DELETE",null,`?id=eq.${id}`);
  },
};

// ── HELPERS ────────────────────────────────────────────────────
function getTier(visits) {
  if (visits >= 15) return "gold";
  if (visits >= 5)  return "silver";
  return "bronze";
}
function genId(list) {
  return "XB" + String((list.length || 0) + 1).padStart(3,"0");
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("ar-SA",{month:"short",day:"numeric",year:"numeric"});
}
function daysAgo(ts) {
  const d = Math.floor((Date.now()-ts)/86400000);
  return d===0?"اليوم":d===1?"أمس":`${d} أيام`;
}
function toWAPhone(p) {
  const d=p.replace(/\D/g,"");
  if(d.startsWith("05")&&d.length===10) return "966"+d.slice(1);
  if(d.startsWith("966")) return d;
  return d;
}
function fmtPhone(raw) {
  const d=raw.replace(/\D/g,"").slice(0,10);
  if(d.length<=4) return d;
  if(d.length<=7) return d.slice(0,4)+" "+d.slice(4);
  return d.slice(0,4)+" "+d.slice(4,7)+" "+d.slice(7);
}

const TIERS = {
  bronze:{ ar:"برونزي", en:"Bronze", color:"#cd7f32", glow:"rgba(205,127,50,0.4)",  icon:"🥉", bg:"linear-gradient(135deg,#3d2b1f,#1a1008)" },
  silver:{ ar:"فضي",   en:"Silver", color:"#c0c0c0", glow:"rgba(192,192,192,0.4)", icon:"🥈", bg:"linear-gradient(135deg,#2a2a2a,#111)" },
  gold:  { ar:"ذهبي",  en:"Gold",   color:"#ffd700", glow:"rgba(255,215,0,0.4)",   icon:"🥇", bg:"linear-gradient(135deg,#3d3000,#1a1500)" },
};

// ── QR CODE (real — using qrcode.react) ────────────────────────
function QRCode({value,size=120}) {
  return (
    <div style={{background:"#fff",padding:8,borderRadius:10,display:"inline-flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <QRCodeSVG value={value} size={size} bgColor="#ffffff" fgColor="#000000" level="M"/>
      <div style={{color:"#000",fontSize:9,letterSpacing:2,fontFamily:"monospace",fontWeight:700}}>{value}</div>
    </div>
  );
}

// ── PROGRESS RING ───────────────────────────────────────────────
function ProgressRing({stamps,goal,size=100}) {
  const r=(size-12)/2, circ=2*Math.PI*r;
  const [anim,setAnim]=useState(0);
  useEffect(()=>{ setTimeout(()=>setAnim(Math.min(stamps/goal,1)),100); },[stamps,goal]);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#og)" strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ*(1-anim)} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)"}}/>
      <defs><linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fb4f07"/><stop offset="100%" stopColor="#ff8c00"/>
      </linearGradient></defs>
    </svg>
  );
}

// ── TIER BADGE ──────────────────────────────────────────────────
function TierBadge({tier,small,lang="ar"}) {
  const t=TIERS[tier||"bronze"];
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:small?3:6,background:t.color+"18",border:"1px solid "+t.color+"44",color:t.color,borderRadius:20,padding:small?"3px 10px":"5px 14px",fontSize:small?10:12,fontWeight:700,letterSpacing:1}}>
      {t.icon} {lang==="ar"?t.ar:t.en}
    </span>
  );
}

// ── PIN GATE ────────────────────────────────────────────────────
function PinGate({onUnlock,onClose,lang="ar"}) {
  const [pin,setPin]=useState(""), [err,setErr]=useState(false);
  function press(d){
    const n=(pin+d).slice(0,4); setPin(n);
    if(n.length===4){
      if(n===MANAGER_PIN){onUnlock();}
      else{setErr(true);setTimeout(()=>{setErr(false);setPin("");},700);}
    }
  }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.95)",backdropFilter:"blur(20px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0f0f0f",border:"1px solid #222",borderRadius:24,padding:"36px 28px 28px",width:"100%",maxWidth:320,textAlign:"center",position:"relative"}}>
        {/* Close X button — always visible */}
        <button onClick={onClose} style={{position:"absolute",top:16,insetInlineStart:"auto",insetInlineEnd:"auto",right:"auto",left:16,background:"rgba(255,255,255,0.1)",border:"1px solid #333",color:"#ccc",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}>✕</button>
        <div style={{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#c93d00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(251,79,7,0.4)"}}>🔐</div>
        <div style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:4}}>{lang==="ar"?"صلاحية المدير":"Manager Access"}</div>
        <div style={{fontSize:12,color:"#555",marginBottom:28}}>{lang==="ar"?"أدخل الـ PIN":"Enter PIN"}</div>
        <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:32,transform:err?"translateX(10px)":"none",transition:"transform 0.1s"}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:12,height:12,borderRadius:"50%",background:pin.length>i?(err?"#ff3b30":"#fb4f07"):"#222",transition:"all 0.2s",boxShadow:pin.length>i&&!err?"0 0 8px rgba(251,79,7,0.6)":"none"}}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
          {[1,2,3,4,5,6,7,8,9].map(d=>(
            <button key={d} onClick={()=>press(String(d))} style={{background:"#141414",border:"1px solid #1e1e1e",borderRadius:14,color:"#fff",fontSize:22,fontWeight:300,padding:"16px 0",cursor:"pointer"}}>{d}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <button onClick={onClose} style={{background:"#222",border:"1px solid #444",borderRadius:14,color:"#ddd",fontSize:14,fontWeight:700,padding:"16px 0",cursor:"pointer"}}>{lang==="ar"?"إلغاء":"Cancel"}</button>
          <button onClick={()=>press("0")} style={{background:"#141414",border:"1px solid #1e1e1e",borderRadius:14,color:"#fff",fontSize:22,fontWeight:300,padding:"16px 0",cursor:"pointer"}}>0</button>
          <button onClick={()=>setPin(p=>p.slice(0,-1))} style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:14,color:"#666",fontSize:20,padding:"16px 0",cursor:"pointer"}}>⌫</button>
        </div>
        {err&&<div style={{color:"#ff3b30",fontSize:12,marginTop:16,fontWeight:600}}>{lang==="ar"?"PIN خاطئ":"Wrong PIN"}</div>}
      </div>
    </div>
  );
}

// ── QR SCANNER (universal — works on ALL devices) ──────────────
function QRScanner({onResult,onClose,lang="ar"}) {
  const [manual,setManual]=useState("");
  const [status,setStatus]=useState("idle"); // idle|loading|scanning|done|error
  const [errMsg,setErrMsg]=useState("");
  const ar=lang==="ar";

  const html5QrRef=useRef(null);

  function stopScanner(){
    if(html5QrRef.current){
      try{ html5QrRef.current.stop().catch(()=>{}); } catch(e){}
      html5QrRef.current=null;
    }
  }

  function loadHtml5QR(cb){
    if(window.Html5Qrcode){cb();return;}
    const s=document.createElement("script");
    s.src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    s.onload=cb;
    s.onerror=()=>{ setStatus("error"); setErrMsg(ar?"فشل تحميل المكتبة":"Library load failed"); };
    document.head.appendChild(s);
  }

  function startCamera(){
    setStatus("loading"); setErrMsg("");
    loadHtml5QR(()=>{
      try {
        const scanner=new window.Html5Qrcode("xbowl-qr-reader");
        html5QrRef.current=scanner;
        scanner.start(
          {facingMode:"environment"},
          {fps:10, qrbox:{width:220,height:220}, aspectRatio:1.0},
          (decodedText)=>{ stopScanner(); onResult(decodedText); },
          ()=>{}
        ).then(()=>setStatus("scanning"))
         .catch(e=>{ setStatus("error"); setErrMsg(ar?"لا يمكن الوصول للكاميرا\nاستخدم التقاط صورة أو الإدخال اليدوي":"Camera denied\nUse photo capture or manual entry"); });
      } catch(e){ setStatus("error"); }
    });
  }

  function handleFile(e){
    const file=e.target.files[0]; if(!file) return;
    setStatus("loading");
    loadHtml5QR(()=>{
      const scanner=new window.Html5Qrcode("xbowl-qr-reader-file");
      scanner.scanFile(file,true)
        .then(text=>{ onResult(text); })
        .catch(()=>{ setStatus("error"); setErrMsg(ar?"لم يتم العثور على QR في الصورة — حاول مرة أخرى":"No QR found — try again"); });
    });
  }

  useEffect(()=>{ startCamera(); return ()=>stopScanner(); },[]);

  function submitManual(){ if(manual.trim()) onResult(manual.trim().toUpperCase()); }

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.95)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a0a",border:"1px solid rgba(251,79,7,0.3)",borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontWeight:800,fontSize:16,color:"#fff"}}>{ar?"🔲 مسح بطاقة الزبون":"🔲 Scan Customer Card"}</div>
          <button onClick={()=>{stopStream();onClose();}} style={{background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",fontSize:14,cursor:"pointer"}}>✕</button>
        </div>

        <div style={{padding:"20px"}}>
          {/* Camera — html5-qrcode renders inside this div */}
          <div style={{position:"relative",borderRadius:14,overflow:"hidden",background:"#050505",marginBottom:14,border:"1px solid #111"}}>
            <div id="xbowl-qr-reader" style={{width:"100%"}}/>
            <div id="xbowl-qr-reader-file" style={{display:"none"}}/>
            {status==="loading"&&(
              <div style={{position:"absolute",inset:0,minHeight:200,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
                <div style={{width:32,height:32,border:"3px solid #1e1e1e",borderTop:"3px solid #fb4f07",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                <div style={{color:"#555",fontSize:12}}>{ar?"جاري تفعيل الكاميرا...":"Starting camera..."}</div>
              </div>
            )}
            {status==="error"&&(
              <div style={{minHeight:180,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,padding:20}}>
                <span style={{fontSize:32}}>📷</span>
                <div style={{color:"#fb4f07",fontSize:12,textAlign:"center",whiteSpace:"pre-line"}}>{errMsg}</div>
                <button onClick={startCamera} style={{background:"rgba(251,79,7,0.15)",border:"1px solid rgba(251,79,7,0.3)",color:"#fb4f07",padding:"6px 16px",borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:700}}>
                  {ar?"إعادة المحاولة":"Retry"}
                </button>
              </div>
            )}
          </div>

          {/* Upload from gallery — works on ALL iOS devices */}
          <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"11px",background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:12,color:"#fb4f07",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:14,boxSizing:"border-box"}}>
            <span style={{fontSize:18}}>🖼️</span>
            {ar?"التقط صورة QR أو اختر من المعرض":"Take QR photo or choose from gallery"}
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>
          </label>

          {/* Divider */}
          <div style={{fontSize:10,color:"#333",textAlign:"center",marginBottom:12,letterSpacing:1}}>
            {ar?"— أو أدخل رقم البطاقة يدوياً —":"— or enter card ID manually —"}
          </div>

          {/* Manual */}
          <div style={{display:"flex",gap:8}}>
            <input value={manual} onChange={e=>setManual(e.target.value.toUpperCase())} placeholder="XB001"
              onKeyDown={e=>e.key==="Enter"&&submitManual()}
              style={{flex:1,background:"#111",border:"1px solid #1a1a1a",borderRadius:12,color:"#fff",padding:"12px 14px",fontSize:16,outline:"none",fontFamily:"monospace",letterSpacing:3}}
              onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.5)"} onBlur={e=>e.target.style.borderColor="#1a1a1a"}/>
            <button onClick={submitManual} style={{background:"#fb4f07",border:"none",color:"#fff",padding:"12px 18px",borderRadius:12,fontWeight:800,fontSize:13,cursor:"pointer"}}>
              {ar?"بحث":"Search"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes scan{0%{top:0}100%{top:100%}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── LOADING SPINNER ─────────────────────────────────────────────
function Spinner() {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{width:36,height:36,border:"3px solid #1e1e1e",borderTop:"3px solid #fb4f07",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

// ══════════════════════════════════════════════════════════════
// CUSTOMER APP
// ══════════════════════════════════════════════════════════════
function CustomerApp({lang,setLang,desktopMode=false}) {
  const [screen,setScreen]=useState("home"); // always start at home, useEffect will redirect
  const [phone,setPhone]=useState("");
  const [customer,setCustomer]=useState(null);

  // On mount: restore session from localStorage and refresh from DB
  useEffect(()=>{
    try{
      const s=localStorage.getItem("xb_cust_data");
      if(!s) return;
      const saved=JSON.parse(s);
      if(!saved||!saved.id) return;
      // Fetch fresh data from Supabase
      sb.getCustomerById(saved.id).then(fresh=>{
        if(fresh){
          setCustomer(fresh);
          setScreen("card");
          try{ localStorage.setItem("xb_cust_data",JSON.stringify(fresh)); } catch(e){}
        } else {
          // Customer deleted — clear storage
          try{ localStorage.removeItem("xb_cust_data"); localStorage.removeItem("xb_cust_screen"); } catch(e){}
        }
      }).catch(()=>{
        // Offline — use cached data
        setCustomer(saved);
        setScreen("card");
      });
    } catch(e){}
  },[]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [regForm,setRegForm]=useState({name:"",phone:""});
  const [regErr,setRegErr]=useState({});
  const [justReg,setJustReg]=useState(false);
  const [showQR,setShowQR]=useState(false);
  const ar=lang==="ar";

  async function lookup(){
    if(!phone.trim()){setError(ar?"أدخل رقم الجوال":"Enter your phone");return;}
    setLoading(true); setError("");
    try {
      const c=await sb.getCustomerByPhone(phone);
      if(c){
        setCustomer(c); setError(""); setScreen("card");
        try{ localStorage.setItem("xb_cust_data",JSON.stringify(c)); localStorage.setItem("xb_cust_screen","card"); } catch(e){}
      }
      else setError(ar?"الرقم غير مسجل — سجّل بطاقتك مجاناً":"Number not found — register for free");
    } catch(e){ setError(ar?"حدث خطأ":"Error occurred"); }
    setLoading(false);
  }

  async function register(){
    const e={};
    if(!regForm.name.trim()) e.name=ar?"مطلوب":"Required";
    if(regForm.phone.replace(/\D/g,"").length<9) e.phone=ar?"رقم غير صحيح":"Invalid";
    if(Object.keys(e).length){setRegErr(e);return;}
    setLoading(true);
    try {
      const allC=await sb.getCustomers();
      const nc={
        id:genId(allC), name:regForm.name.trim(),
        phone:regForm.phone.replace(/\D/g,""),
        stamps:0, visits:0, tier:"bronze",
        joined:Date.now(), last_visit:Date.now(),
      };
      const created=await sb.createCustomer(nc);
      const finalC=created||nc;
      setCustomer(finalC); setJustReg(true); setScreen("card");
      try{ localStorage.setItem("xb_cust_data",JSON.stringify(finalC)); localStorage.setItem("xb_cust_screen","card"); } catch(e){}
    } catch(e){ setRegErr({phone:ar?"الرقم مسجل مسبقاً":"Phone already registered"}); }
    setLoading(false);
  }

  const tier=customer?TIERS[getTier(customer.visits)]:TIERS.bronze;
  const nextTier=!customer?null:customer.visits>=15?null:customer.visits>=5?TIERS.gold:TIERS.silver;
  const visitsToNext=!customer?0:customer.visits>=15?0:customer.visits>=5?15-customer.visits:5-customer.visits;

  return (
    <div dir={ar?"rtl":"ltr"} style={{minHeight:"100vh",background:"#060606",fontFamily:ar?"'Segoe UI',Tahoma,sans-serif":"'Segoe UI',sans-serif",paddingBottom:80}}>

      {showQR&&customer&&(
        <div onClick={()=>setShowQR(false)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
          <div style={{fontSize:13,color:"#555",letterSpacing:2}}>{ar?"أرِ هذا للموظف":"Show this to staff"}</div>
          <div style={{background:"#0d0d0d",border:"1px solid rgba(251,79,7,0.3)",borderRadius:20,padding:24}}>
            <QRCode value={customer.id} size={200}/>
          </div>
          <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:4,fontFamily:"monospace"}}>{customer.id}</div>
          <div style={{fontSize:12,color:"#444"}}>{ar?"اضغط للإغلاق":"Tap to close"}</div>
        </div>
      )}

      {/* Header */}
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(251,79,7,0.15)",background:"rgba(6,6,6,0.95)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 0 14px rgba(251,79,7,0.5)"}}>🎳</div>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:"#fb4f07",letterSpacing:2,lineHeight:1}}>XBOWL</div>
            <div style={{fontSize:9,color:"#444",letterSpacing:3}}>{ar?"بطاقة الولاء":"LOYALTY CARD"}</div>
          </div>
        </div>
        <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700}}>
          {ar?"EN":"عربي"}
        </button>
      </div>

      <div style={{maxWidth:460,margin:"0 auto",padding:"24px 16px"}}>

        {/* HOME */}
        {screen==="home"&&(
          <div>
            <div style={{textAlign:"center",padding:"32px 0 28px",position:"relative"}}>
              <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle,rgba(251,79,7,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
              <div style={{fontSize:60,marginBottom:12}}>🎳</div>
              <h1 style={{margin:0,fontSize:32,fontWeight:900,color:"#fff",lineHeight:1.1}}>
                {ar?"برنامج":"Loyalty"}
                <span style={{display:"block",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:40}}>
                  {ar?"الولاء":"Program"}
                </span>
              </h1>
              <p style={{margin:"12px 0 0",fontSize:14,color:"#555",lineHeight:1.7}}>
                {ar?"اجمع ٥ أختام مع كل زيارة\nواحصل على لعبة مجانية":"Collect 5 stamps per visit\nand get a free game"}
              </p>
            </div>
            {/* Stamp preview */}
            <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:32}}>
              {Array.from({length:5}).map((_,i)=>(
                <div key={i} style={{width:48,height:48,borderRadius:"50%",background:i<3?"linear-gradient(135deg,#fb4f07,#ff6b35)":"rgba(255,255,255,0.04)",border:i<3?"none":"1.5px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?22:0,boxShadow:i<3?"0 0 16px rgba(251,79,7,0.5)":"none",transform:i===2?"scale(1.15)":"scale(1)"}}>
                  {i<3?"🎳":""}
                </div>
              ))}
            </div>
            {/* Tiers */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:28}}>
              {Object.entries(TIERS).map(([k,t])=>(
                <div key={k} style={{background:"#0d0d0d",border:"1px solid "+t.color+"22",borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:5}}>{t.icon}</div>
                  <div style={{fontSize:11,fontWeight:700,color:t.color}}>{ar?t.ar:t.en}</div>
                  <div style={{fontSize:9,color:"#333",marginTop:3}}>{k==="bronze"?ar?"0+ زيارة":"0+ visits":k==="silver"?ar?"5+ زيارة":"5+ visits":ar?"15+ زيارة":"15+ visits"}</div>
                </div>
              ))}
            </div>
            {/* Login */}
            <div style={{background:"#0d0d0d",border:"1px solid #141414",borderRadius:20,padding:"24px"}}>
              <div style={{fontSize:10,color:"#444",letterSpacing:2,marginBottom:12}}>{ar?"سجّل دخولك برقم جوالك":"SIGN IN WITH YOUR PHONE"}</div>
              <input value={phone} onChange={e=>{setPhone(fmtPhone(e.target.value));setError("");}} placeholder="05X XXX XXXX" inputMode="tel"
                style={{width:"100%",background:"#111",border:"1px solid "+(error?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box",marginBottom:error?8:14,letterSpacing:1,textAlign:ar?"right":"left"}}
                onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.5)"} onBlur={e=>e.target.style.borderColor=error?"#ff4444":"#1e1e1e"}
                onKeyDown={e=>e.key==="Enter"&&lookup()}/>
              {error&&<div style={{color:"#ff5555",fontSize:12,marginBottom:14}}>⚠ {error}</div>}
              <button onClick={lookup} disabled={loading} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 8px 28px rgba(251,79,7,0.4)",marginBottom:10,opacity:loading?0.7:1}}>
                {loading?"...":(ar?"عرض بطاقتي":"View My Card")}
              </button>
              <button onClick={()=>setScreen("register")} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:14,color:"#555",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                {ar?"تسجيل بطاقة جديدة مجاناً ←":"Register new card for free →"}
              </button>
            </div>
          </div>
        )}

        {/* REGISTER */}
        {screen==="register"&&(
          <div style={{background:"rgba(18,18,18,0.97)",borderRadius:18,border:"1px solid rgba(251,79,7,0.2)",overflow:"hidden"}}>
            <div style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"20px 20px 16px"}}>
              <button onClick={()=>setScreen("home")} style={{background:"rgba(0,0,0,0.22)",border:"none",color:"rgba(255,255,255,0.85)",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:12,marginBottom:10}}>
                {ar?"→ رجوع":"← Back"}
              </button>
              <div style={{fontWeight:900,fontSize:20,color:"#fff"}}>{ar?"بطاقة جديدة 🎳":"New Card 🎳"}</div>
            </div>
            <div style={{padding:"22px 18px 26px"}}>
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"الاسم":"NAME"}</label>
                <input value={regForm.name} onChange={e=>{setRegForm(f=>({...f,name:e.target.value}));setRegErr(er=>({...er,name:""}));}} placeholder={ar?"اسمك الكامل":"Full name"}
                  style={{width:"100%",background:"#111",border:"1px solid "+(regErr.name?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"13px 15px",fontSize:15,outline:"none",boxSizing:"border-box",textAlign:ar?"right":"left"}}
                  onFocus={e=>{if(!regErr.name)e.target.style.borderColor="rgba(251,79,7,0.5)";}} onBlur={e=>{if(!regErr.name)e.target.style.borderColor="#1e1e1e";}}/>
                {regErr.name&&<div style={{color:"#ff5555",fontSize:11,marginTop:4}}>⚠ {regErr.name}</div>}
              </div>
              <div style={{marginBottom:24}}>
                <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"رقم الجوال":"PHONE"}</label>
                <input value={regForm.phone} onChange={e=>{setRegForm(f=>({...f,phone:fmtPhone(e.target.value)}));setRegErr(er=>({...er,phone:""}));}} placeholder="05X XXX XXXX" inputMode="tel"
                  style={{width:"100%",background:"#111",border:"1px solid "+(regErr.phone?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"13px 15px",fontSize:15,outline:"none",boxSizing:"border-box",letterSpacing:1,textAlign:ar?"right":"left"}}
                  onFocus={e=>{if(!regErr.phone)e.target.style.borderColor="rgba(251,79,7,0.5)";}} onBlur={e=>{if(!regErr.phone)e.target.style.borderColor="#1e1e1e";}}/>
                {regErr.phone&&<div style={{color:"#ff5555",fontSize:11,marginTop:4}}>⚠ {regErr.phone}</div>}
              </div>
              <button onClick={register} disabled={loading} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 8px 28px rgba(251,79,7,0.4)",opacity:loading?0.7:1}}>
                {loading?"...":(ar?"إنشاء بطاقتي 🎳":"Create My Card 🎳")}
              </button>
            </div>
          </div>
        )}

        {/* CARD */}
        {screen==="card"&&customer&&(
          <div>
            {justReg&&<div style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:14,textAlign:"center",fontSize:13,color:"#fb4f07",fontWeight:700}}>
              🎉 {ar?"أهلاً بك! تم إنشاء بطاقتك":"Welcome! Your card has been created"}
            </div>}
            {/* Card */}
            <div style={{background:tier.bg,border:"1px solid "+tier.color+"22",borderRadius:20,padding:"22px",marginBottom:14,position:"relative",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px "+tier.color+"11"}}>
              <div style={{position:"absolute",top:-40,right:-40,width:150,height:150,borderRadius:"50%",background:tier.color+"08",pointerEvents:"none"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
                <div>
                  <div style={{fontSize:10,color:tier.color,letterSpacing:4,fontWeight:700,marginBottom:6}}>XBOWL LOYALTY</div>
                  <div style={{fontSize:18,color:"#fff",fontWeight:900}}>{customer.name}</div>
                  <div style={{marginTop:8}}><TierBadge tier={getTier(customer.visits)} lang={lang}/></div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                  <QRCode value={customer.id} size={72}/>
                  <button onClick={()=>setShowQR(true)} style={{background:tier.color+"18",border:"1px solid "+tier.color+"33",color:tier.color,padding:"5px 10px",borderRadius:8,fontSize:10,cursor:"pointer",fontWeight:700}}>
                    {ar?"عرض كامل":"Full QR"}
                  </button>
                </div>
              </div>
              {/* Progress ring + stamps */}
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <ProgressRing stamps={customer.stamps} goal={STAMP_GOAL} size={90}/>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:24,fontWeight:900,color:"#fff",lineHeight:1}}>{customer.stamps}</div>
                    <div style={{fontSize:9,color:"#666"}}>/{STAMP_GOAL}</div>
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:"#555",letterSpacing:2,marginBottom:10}}>{ar?"الأختام":"STAMPS"}</div>
                  <div style={{display:"flex",gap:8}}>
                    {Array.from({length:STAMP_GOAL}).map((_,i)=>(
                      <div key={i} style={{width:46,height:46,borderRadius:"50%",background:i<customer.stamps?"linear-gradient(135deg,#fb4f07,#ff6b35,#c93d00)":"rgba(255,255,255,0.04)",border:i<customer.stamps?"none":"1.5px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<customer.stamps?20:13,boxShadow:i<customer.stamps?"0 0 18px rgba(251,79,7,0.6)":"none",color:i<customer.stamps?"#fff":"rgba(255,255,255,0.15)"}}>
                        {i<customer.stamps?"🎳":i+1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {customer.stamps>=STAMP_GOAL&&(
                <div style={{background:"rgba(251,79,7,0.12)",border:"1px solid rgba(251,79,7,0.4)",borderRadius:12,padding:"12px 16px",textAlign:"center"}}>
                  <div style={{fontSize:24,marginBottom:4}}>🎁</div>
                  <div style={{color:"#fb4f07",fontWeight:800,fontSize:14}}>{ar?"تهانينا! لعبة مجانية تنتظرك":"Congrats! A free game awaits you"}</div>
                  <div style={{color:"#888",fontSize:11,marginTop:3}}>{ar?"أرِ الموظف هذه البطاقة":"Show this card to staff"}</div>
                </div>
              )}
            </div>
            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
              {[[customer.visits,ar?"زيارة":"Visits","📅"],[customer.stamps,ar?"ختم":"Stamps","🎳"],[STAMP_GOAL-customer.stamps,ar?"متبقي":"Left","⏳"]].map(([v,l,ic])=>(
                <div key={l} style={{background:"#0d0d0d",border:"1px solid #111",borderRadius:14,padding:"14px 10px",textAlign:"center"}}>
                  <div style={{fontSize:18,marginBottom:4}}>{ic}</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#fb4f07",lineHeight:1}}>{v}</div>
                  <div style={{fontSize:10,color:"#444",marginTop:3,letterSpacing:1}}>{l}</div>
                </div>
              ))}
            </div>
            {/* Tier progress */}
            {nextTier&&(
              <div style={{background:"#0d0d0d",border:"1px solid #111",borderRadius:14,padding:"16px 18px",marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:12,color:"#555"}}>{ar?`نحو المستوى ${nextTier.ar}`:`Progress to ${nextTier.en}`}</div>
                  <div style={{fontSize:12,color:nextTier.color,fontWeight:700}}>{visitsToNext} {ar?"زيارة":"visits"}</div>
                </div>
                <div style={{background:"#111",borderRadius:8,height:5,overflow:"hidden"}}>
                  <div style={{height:"100%",background:`linear-gradient(90deg,${nextTier.color},${nextTier.color}88)`,width:((customer.visits%(nextTier===TIERS.silver?5:15))/(nextTier===TIERS.silver?5:15)*100)+"%",borderRadius:8,transition:"width 1s cubic-bezier(0.4,0,0.2,1)"}}/>
                </div>
              </div>
            )}
            {/* ID */}
            <div style={{background:"#0d0d0d",border:"1px solid #111",borderRadius:14,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontSize:9,color:"#333",letterSpacing:3,marginBottom:4}}>MEMBER ID</div>
                <div style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:"monospace",letterSpacing:4}}>{customer.id}</div>
              </div>
              <div style={{textAlign:ar?"left":"right"}}>
                <div style={{fontSize:9,color:"#333",letterSpacing:2,marginBottom:4}}>{ar?"آخر زيارة":"LAST VISIT"}</div>
                <div style={{fontSize:12,color:"#666"}}>{daysAgo(customer.last_visit)}</div>
              </div>
            </div>
            <button onClick={()=>{setScreen("home");setCustomer(null);setPhone("");setJustReg(false);}} style={{width:"100%",padding:"11px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:12,color:"#444",fontSize:13,cursor:"pointer"}}>
              {ar?"تسجيل الخروج":"Sign Out"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STAFF APP — PIN PROTECTED
// ══════════════════════════════════════════════════════════════
function StaffApp({lang,setLang,desktopMode=false,alreadyUnlocked=false,onCancelPin=null}) {
  const [unlocked,setUnlocked]=useState(()=>{
    if(alreadyUnlocked) return true;
    try{ return localStorage.getItem("xbowl_staff_unlocked")==="1"; } catch(e){ return false; }
  });
  const [tab,setTab]=useState("scan");
  const [showScanner,setShowScanner]=useState(false);
  const [scanResult,setScanResult]=useState(null);
  const [scanErr,setScanErr]=useState("");
  const [scanInput,setScanInput]=useState("");
  const [lastAction,setLastAction]=useState(null);
  const [customers,setCustomers]=useState([]);  // always array
  const [rewards,setRewards]=useState([]);
  const [loading,setLoading]=useState(false);
  const [loyalFilter,setLoyalFilter]=useState("all");
  const [exportFilter,setExportFilter]=useState("all");
  const [copied,setCopied]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [editCustomer,setEditCustomer]=useState(null);
  const ar=lang==="ar";

  useEffect(()=>{ if(unlocked) loadData(); },[unlocked]);

  async function loadData(){
    setLoading(true);
    try {
      const [c,r]=await Promise.all([sb.getCustomers(),sb.getRewards()]);
      setCustomers(Array.isArray(c)?c:[]);
      setRewards(Array.isArray(r)?r:[]);
    } catch(e){
      console.error("loadData error:",e);
      setCustomers([]);
      setRewards([]);
    }
    setLoading(false);
  }

  async function doDeleteCustomer(c){
    setLoading(true);
    try { await sb.deleteCustomer(c.id); await loadData(); }
    catch(e){ alert(ar?"خطأ في الحذف":"Delete error"); }
    setLoading(false); setConfirmDelete(null);
  }

  async function doRemoveStamp(c){
    if(c.stamps<=0) return;
    setLoading(true);
    try {
      await sb.updateCustomer(c.id,{stamps:c.stamps-1});
      await loadData();
    } catch(e){}
    setLoading(false); setEditCustomer(null);
  }

  async function doResetStamps(c){
    setLoading(true);
    try {
      await sb.updateCustomer(c.id,{stamps:0});
      await loadData();
    } catch(e){}
    setLoading(false); setEditCustomer(null);
  }

  async function handleScanResult(val){
    setShowScanner(false);
    setLoading(true); setScanErr("");
    try {
      const c=await sb.getCustomerById(val.toUpperCase().trim());
      if(c){setScanResult(c);}
      else setScanErr(ar?`البطاقة "${val}" غير موجودة`:`Card "${val}" not found`);
    } catch(e){ setScanErr(ar?"حدث خطأ":"Error"); }
    setLoading(false);
  }

  async function addStamp(){
    if(!scanResult)return;
    setLoading(true);
    try {
      const gotReward=(scanResult.stamps+1)>=STAMP_GOAL;
      const newStamps=gotReward?0:scanResult.stamps+1;
      const newVisits=scanResult.visits+1;
      const newTier=getTier(newVisits);
      await sb.updateCustomer(scanResult.id,{stamps:newStamps,visits:newVisits,tier:newTier,last_visit:Date.now()});
      if(gotReward){
        await sb.addReward({id:"R"+Date.now(),customer_id:scanResult.id,note:ar?"لعبة مجانية":"Free game",redeemed_at:Date.now()});
      }
      setLastAction({name:scanResult.name,gotReward,stamps:newStamps});
      setScanResult(null); setScanInput(""); setScanErr("");
      await loadData();
    } catch(e){ setScanErr(ar?"خطأ في الحفظ":"Save error"); }
    setLoading(false);
  }

  function copy(){
    const list=exportData;
    navigator.clipboard.writeText(list.map(c=>c.phone).join("\n"))
      .then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});
  }

  const safeCustomers=Array.isArray(customers)?customers:[];
  const listData=loyalFilter==="all"?safeCustomers:loyalFilter==="full"?safeCustomers.filter(c=>c.stamps>=STAMP_GOAL):safeCustomers.filter(c=>c.stamps>0&&c.stamps<STAMP_GOAL);
  const exportData=exportFilter==="all"?safeCustomers:exportFilter==="full"?safeCustomers.filter(c=>c.stamps>=STAMP_GOAL):exportFilter==="gold"?safeCustomers.filter(c=>getTier(c.visits)==="gold"):safeCustomers.filter(c=>getTier(c.visits)==="silver");

  if(!unlocked) return <PinGate lang={lang} onUnlock={()=>setUnlocked(true)} onClose={()=>setUnlocked(false)}/>;

  return (
    <div style={{minHeight:"100vh",background:"#060606",fontFamily:"'Segoe UI',sans-serif",paddingBottom:80}}>
      {showScanner&&<QRScanner lang={lang} onResult={handleScanResult} onClose={()=>setShowScanner(false)}/>}

      {/* Header */}
      <div style={{background:"#060606",borderBottom:"2px solid #fb4f07",padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>🎳</span>
          <div>
            <span style={{fontSize:17,fontWeight:900,color:"#fb4f07",letterSpacing:3}}>XBOWL</span>
            <span style={{fontSize:10,color:"#333",letterSpacing:4,marginLeft:8}}>STAFF</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:20,padding:"3px 12px",fontSize:11,color:"#fb4f07",fontWeight:700}}>{customers.length} {ar?"عضو":"members"}</div>
          <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"4px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700}}>
            {ar?"EN":"عربي"}
          </button>
          <button onClick={()=>setUnlocked(false)} style={{background:"#111",border:"1px solid #1e1e1e",color:"#555",padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:11}}>
            {ar?"خروج":"Lock"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:"#060606",borderBottom:"1px solid rgba(255,255,255,0.04)",position:"sticky",top:0,zIndex:9}}>
        {[["scan",ar?"🔲 مسح":"🔲 Scan"],["members",ar?"👥 الأعضاء":"👥 Members"],["export",ar?"📲 تصدير":"📲 Export"]].map(([t,l])=>(
          <button key={t} onClick={()=>{setTab(t);if(t==="members"||t==="export")loadData();}} style={{flex:1,padding:"13px 6px",background:"transparent",border:"none",borderBottom:tab===t?"2px solid #fb4f07":"2px solid transparent",color:tab===t?"#fb4f07":"#444",fontWeight:tab===t?700:400,fontSize:12,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{maxWidth:700,margin:"0 auto",padding:"20px 16px"}}>

        {/* SCAN TAB */}
        {tab==="scan"&&(<>
          {lastAction&&(
            <div style={{background:lastAction.gotReward?"rgba(251,79,7,0.08)":"rgba(34,197,94,0.06)",border:"1px solid "+(lastAction.gotReward?"rgba(251,79,7,0.25)":"rgba(34,197,94,0.2)"),borderRadius:14,padding:"14px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:26}}>{lastAction.gotReward?"🎁":"✅"}</span>
              <div>
                <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{lastAction.gotReward?(ar?"مكافأة! — ":"Reward! — "):(ar?"ختم مضاف — ":"Stamp added — ")}{lastAction.name}</div>
                <div style={{fontSize:12,color:"#555",marginTop:2}}>{lastAction.gotReward?(ar?"لعبة مجانية":"Free game"):`${lastAction.stamps} / ${STAMP_GOAL}`}</div>
              </div>
              <button onClick={()=>setLastAction(null)} style={{marginRight:"auto",background:"transparent",border:"none",color:"#333",fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
          )}

          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
            {[[safeCustomers.length,ar?"عضو":"Members","👥"],[Array.isArray(rewards)?rewards.length:0,ar?"مكافأة":"Rewards","🎁"],[safeCustomers.filter(c=>c&&c.stamps>=STAMP_GOAL).length,ar?"جاهز":"Ready","⭐"]].map(([v,l,ic])=>(
              <div key={l} style={{background:"#0a0a0a",border:"1px solid #0f0f0f",borderRadius:14,padding:"14px 12px",textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:4}}>{ic}</div>
                <div style={{fontSize:22,fontWeight:800,color:"#fb4f07"}}>{v}</div>
                <div style={{fontSize:10,color:"#333",marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Scan button */}
          <button onClick={()=>setShowScanner(true)} style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:16,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",boxShadow:"0 8px 28px rgba(251,79,7,0.4)",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:14}}>
            <span style={{fontSize:22}}>📷</span>
            {ar?"مسح QR بطاقة الزبون":"Scan Customer QR Card"}
          </button>

          {/* Manual input */}
          <div style={{background:"#0a0a0a",border:"1px solid #0f0f0f",borderRadius:14,padding:"16px",marginBottom:14}}>
            <div style={{fontSize:10,color:"#444",letterSpacing:2,marginBottom:10}}>{ar?"إدخال يدوي":"MANUAL ENTRY"}</div>
            <div style={{display:"flex",gap:8}}>
              <input value={scanInput} onChange={e=>{setScanInput(e.target.value.toUpperCase());setScanErr("");setScanResult(null);}} placeholder="XB001" onKeyDown={e=>e.key==="Enter"&&handleScanResult(scanInput)}
                style={{flex:1,background:"#111",border:"1px solid #1a1a1a",borderRadius:10,color:"#fff",padding:"11px 14px",fontSize:16,outline:"none",fontFamily:"monospace",letterSpacing:3}}
                onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.4)"} onBlur={e=>e.target.style.borderColor="#1a1a1a"}/>
              <button onClick={()=>handleScanResult(scanInput)} disabled={loading} style={{background:"#fb4f07",border:"none",color:"#fff",padding:"11px 18px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>
                {ar?"بحث":"Search"}
              </button>
            </div>
            {scanErr&&<div style={{color:"#ff5555",fontSize:12,marginTop:8}}>⚠ {scanErr}</div>}
          </div>

          {/* Scan result */}
          {loading&&<Spinner/>}
          {scanResult&&!loading&&(
            <div style={{background:"#0a0a0a",border:"1px solid rgba(251,79,7,0.2)",borderRadius:18,overflow:"hidden"}}>
              <div style={{padding:"18px 18px 14px",borderBottom:"1px solid #0f0f0f"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{scanResult.name}</div>
                    <div style={{fontSize:12,color:"#555",marginTop:3}}>{scanResult.phone} · {scanResult.visits} {ar?"زيارة":"visits"}</div>
                    <div style={{marginTop:8}}><TierBadge tier={getTier(scanResult.visits)} lang={lang}/></div>
                  </div>
                  <QRCode value={scanResult.id} size={64}/>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  {Array.from({length:STAMP_GOAL}).map((_,i)=>(
                    <div key={i} style={{flex:1,aspectRatio:"1",borderRadius:10,background:i<scanResult.stamps?"linear-gradient(135deg,#fb4f07,#c93d00)":"#111",border:i<scanResult.stamps?"none":"1px solid #1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{i<scanResult.stamps?"🎳":""}</div>
                  ))}
                </div>
                {scanResult.stamps>=STAMP_GOAL
                  ?<div style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{color:"#fb4f07",fontWeight:800}}>🎁 {ar?"البطاقة ممتلئة — مكافأة!":"Card full — Reward!"}</div></div>
                  :<div style={{background:"#0d0d0d",borderRadius:10,padding:"9px 12px",textAlign:"center",fontSize:13,color:"#555"}}>
                    {ar?"سيصبح لديه":"Will have"} <span style={{color:"#fb4f07",fontWeight:800}}>{scanResult.stamps+1}</span> / {STAMP_GOAL} {ar?"أختام":"stamps"}
                  </div>
                }
              </div>
              <div style={{padding:"14px 18px",display:"flex",gap:10}}>
                <button onClick={addStamp} disabled={loading} style={{flex:1,padding:"13px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 6px 20px rgba(251,79,7,0.35)",opacity:loading?0.7:1}}>
                  {scanResult.stamps>=STAMP_GOAL?(ar?"🎁 صرف المكافأة":"🎁 Redeem Reward"):(ar?"✅ إضافة ختم":"✅ Add Stamp")}
                </button>
                <button onClick={()=>{setScanResult(null);setScanInput("");}} style={{padding:"13px 16px",background:"#111",border:"1px solid #1a1a1a",borderRadius:12,color:"#555",fontSize:18,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          )}
        </>)}

        {/* MEMBERS TAB */}
        {tab==="members"&&(<>
          {loading&&<Spinner/>}
          {!loading&&safeCustomers.length===0&&(
            <div style={{textAlign:"center",padding:"50px 20px",color:"#444"}}>
              <div style={{fontSize:40,marginBottom:12}}>👥</div>
              <div style={{fontSize:14,marginBottom:8,color:"#666"}}>{ar?"لا يوجد أعضاء بعد":"No members yet"}</div>
              <button onClick={loadData} style={{background:"rgba(251,79,7,0.1)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"8px 20px",borderRadius:10,fontSize:12,cursor:"pointer",fontWeight:700}}>
                🔄 {ar?"تحديث البيانات":"Refresh"}
              </button>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {[["all",ar?"الكل":"All"],["active",ar?"نشط":"Active"],["full",ar?"مكافأة 🎁":"Reward 🎁"]].map(([k,l])=>(
              <button key={k} onClick={()=>setLoyalFilter(k)} style={{padding:"7px 14px",borderRadius:20,background:loyalFilter===k?"#fb4f07":"#0d0d0d",border:"1px solid "+(loyalFilter===k?"transparent":"#111"),color:loyalFilter===k?"#fff":"#555",fontWeight:700,fontSize:11,cursor:"pointer"}}>{l}</button>
            ))}
            <button onClick={loadData} style={{padding:"7px 14px",borderRadius:20,background:"#0d0d0d",border:"1px solid #111",color:"#555",fontWeight:700,fontSize:11,cursor:"pointer"}}>🔄 {ar?"تحديث":"Refresh"}</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(listData||[]).map(c=>{
              if(!c) return null;
              const t=TIERS[getTier(c.visits||0)];
              return(
                <div key={c.id} style={{background:"#0a0a0a",border:"1px solid "+(c.stamps>=STAMP_GOAL?"rgba(251,79,7,0.2)":"#0f0f0f"),borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:t.bg,border:"1px solid "+t.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{t.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                      <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>{c.name}</div>
                      <div style={{fontSize:10,color:"#333",fontFamily:"monospace"}}>{c.id}</div>
                      {c.stamps>=STAMP_GOAL&&<span style={{background:"rgba(251,79,7,0.15)",border:"1px solid rgba(251,79,7,0.3)",color:"#fb4f07",borderRadius:10,padding:"1px 7px",fontSize:9,fontWeight:700}}>{ar?"مكافأة":"Reward"} 🎁</span>}
                    </div>
                    <div style={{display:"flex",gap:5,marginBottom:5}}>
                      {Array.from({length:STAMP_GOAL}).map((_,i)=>(
                        <div key={i} style={{width:18,height:18,borderRadius:4,background:i<c.stamps?"#fb4f07":"#111",border:i<c.stamps?"none":"1px solid #1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8}}>{i<c.stamps?"🎳":""}</div>
                      ))}
                      <span style={{fontSize:10,color:"#444",alignSelf:"center",marginRight:4}}>{c.visits} {ar?"زيارة":"visits"}</span>
                    </div>
                    <div style={{fontSize:11,color:"#444"}}>{c.phone}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <TierBadge tier={getTier(c.visits)} small lang={lang}/>
                    <div style={{display:"flex",gap:5}}>
                      <button onClick={()=>setEditCustomer(c)} style={{background:"rgba(251,79,7,0.1)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer"}}>
                        ✏️ {ar?"أختام":"Stamps"}
                      </button>
                      <button onClick={()=>setConfirmDelete(c)} style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",color:"#ff3b30",padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer"}}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit Stamps Modal */}
          {editCustomer&&(
            <div onClick={e=>e.target===e.currentTarget&&setEditCustomer(null)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <div style={{background:"#0f0f0f",border:"1px solid #2a2a2a",borderRadius:20,width:"100%",maxWidth:360,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>✏️ {ar?"تعديل الأختام":"Edit Stamps"}</div>
                  <button onClick={()=>setEditCustomer(null)} style={{background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",fontSize:14,cursor:"pointer"}}>✕</button>
                </div>
                <div style={{padding:"20px"}}>
                  <div style={{fontWeight:700,color:"#fff",fontSize:15,marginBottom:4}}>{editCustomer.name}</div>
                  <div style={{fontSize:12,color:"#555",marginBottom:16}}>{editCustomer.phone} · {editCustomer.visits} {ar?"زيارة":"visits"}</div>
                  {/* Stamps display */}
                  <div style={{display:"flex",gap:8,marginBottom:20,justifyContent:"center"}}>
                    {Array.from({length:STAMP_GOAL}).map((_,i)=>(
                      <div key={i} style={{width:44,height:44,borderRadius:"50%",background:i<editCustomer.stamps?"linear-gradient(135deg,#fb4f07,#c93d00)":"#1a1a1a",border:i<editCustomer.stamps?"none":"1px solid #2a2a2a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:i<editCustomer.stamps?"0 0 12px rgba(251,79,7,0.4)":"none"}}>{i<editCustomer.stamps?"🎳":""}</div>
                    ))}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <button onClick={()=>doRemoveStamp(editCustomer)} disabled={editCustomer.stamps<=0||loading} style={{padding:"12px",background:editCustomer.stamps>0?"rgba(251,79,7,0.1)":"#0d0d0d",border:"1px solid "+(editCustomer.stamps>0?"rgba(251,79,7,0.3)":"#1a1a1a"),borderRadius:12,color:editCustomer.stamps>0?"#fb4f07":"#333",fontWeight:700,fontSize:14,cursor:editCustomer.stamps>0?"pointer":"not-allowed"}}>
                      ➖ {ar?"حذف ختم واحد":"Remove 1 Stamp"} ({editCustomer.stamps} → {Math.max(0,editCustomer.stamps-1)})
                    </button>
                    <button onClick={()=>doResetStamps(editCustomer)} disabled={editCustomer.stamps===0||loading} style={{padding:"12px",background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,color:editCustomer.stamps>0?"#ff3b30":"#333",fontWeight:700,fontSize:14,cursor:editCustomer.stamps>0?"pointer":"not-allowed"}}>
                      🔄 {ar?"إعادة تعيين كل الأختام":"Reset All Stamps"} (→ 0)
                    </button>
                    <button onClick={()=>setEditCustomer(null)} style={{padding:"11px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:12,color:"#555",fontSize:13,cursor:"pointer"}}>
                      {ar?"إلغاء":"Cancel"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Delete Modal */}
          {confirmDelete&&(
            <div onClick={e=>e.target===e.currentTarget&&setConfirmDelete(null)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.9)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <div style={{background:"#0f0f0f",border:"1px solid rgba(255,59,48,0.3)",borderRadius:20,width:"100%",maxWidth:340,padding:"28px 24px",textAlign:"center"}}>
                <div style={{fontSize:44,marginBottom:12}}>🗑️</div>
                <div style={{fontWeight:800,color:"#fff",fontSize:17,marginBottom:6}}>{ar?"حذف الزبون؟":"Delete Customer?"}</div>
                <div style={{fontSize:13,color:"#fb4f07",fontWeight:700,marginBottom:4}}>{confirmDelete.name}</div>
                <div style={{fontSize:12,color:"#555",marginBottom:24}}>{ar?"سيتم حذف البطاقة والأختام بشكل نهائي":"Card and stamps will be permanently deleted"}</div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"12px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:12,color:"#777",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                    {ar?"إلغاء":"Cancel"}
                  </button>
                  <button onClick={()=>doDeleteCustomer(confirmDelete)} disabled={loading} style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#ff3b30,#c0392b)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 6px 18px rgba(255,59,48,0.3)"}}>
                    {loading?"...":(ar?"حذف نهائي":"Delete")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>)}

        {/* EXPORT TAB */}
        {tab==="export"&&(<>
          <div style={{background:"#0a0a0a",border:"1px solid rgba(37,211,102,0.15)",borderRadius:18,overflow:"hidden",marginBottom:14}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid #0f0f0f"}}>
              <div style={{fontSize:11,color:"#25d366",letterSpacing:3,fontWeight:700,marginBottom:4}}>📲 {ar?"استخراج الأرقام":"EXPORT NUMBERS"}</div>
              <div style={{fontSize:12,color:"#444"}}>{exportData.length} {ar?"رقم جاهز":"numbers ready"}</div>
            </div>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #0f0f0f"}}>
              <div style={{fontSize:10,color:"#444",letterSpacing:2,marginBottom:10}}>{ar?"اختر الشريحة":"SELECT SEGMENT"}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  ["all",ar?"كل الأعضاء":"All Members",customers.length,"👥"],
                  ["full",ar?"مكافأة جاهزة":"Reward Ready",customers.filter(c=>c.stamps>=STAMP_GOAL).length,"🎁"],
                  ["gold",ar?"أعضاء ذهبيون":"Gold Members",customers.filter(c=>getTier(c.visits)==="gold").length,"🥇"],
                  ["silver",ar?"أعضاء فضيون":"Silver Members",customers.filter(c=>getTier(c.visits)==="silver").length,"🥈"],
                ].map(([k,l,cnt,ic])=>(
                  <div key={k} onClick={()=>setExportFilter(k)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:12,cursor:"pointer",background:exportFilter===k?"rgba(37,211,102,0.05)":"#0d0d0d",border:"1px solid "+(exportFilter===k?"rgba(37,211,102,0.2)":"#111")}}>
                    <div style={{width:18,height:18,borderRadius:4,background:exportFilter===k?"#25d366":"#111",border:"1.5px solid "+(exportFilter===k?"#25d366":"#1e1e1e"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#000"}}>{exportFilter===k?"✓":""}</div>
                    <span style={{fontSize:16}}>{ic}</span>
                    <div style={{flex:1,fontSize:13,color:exportFilter===k?"#fff":"#555",fontWeight:exportFilter===k?700:400}}>{l}</div>
                    <div style={{background:"#111",border:"1px solid #1a1a1a",color:"#444",borderRadius:10,padding:"2px 10px",fontSize:11}}>{cnt}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:"16px 18px"}}>
              <button onClick={copy} style={{width:"100%",padding:"13px",background:copied?"rgba(34,197,94,0.1)":"transparent",border:"1px solid "+(copied?"rgba(34,197,94,0.3)":"#1a1a1a"),borderRadius:12,color:copied?"#22c55e":"#555",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.3s"}}>
                {copied?"✓ "+(ar?"تم النسخ":"Copied!"):"📋 "+(ar?"نسخ الأرقام":"Copy Numbers")}
              </button>
            </div>
          </div>
          {/* Preview */}
          <div style={{background:"#0a0a0a",border:"1px solid #0f0f0f",borderRadius:14,padding:"16px"}}>
            <div style={{fontSize:10,color:"#333",letterSpacing:2,marginBottom:12}}>{ar?"معاينة":"PREVIEW"}</div>
            {exportData.length===0
              ?<div style={{color:"#333",fontSize:12,textAlign:"center",padding:"20px 0"}}>{ar?"لا يوجد بيانات":"No data"}</div>
              :exportData.map((c,i)=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #0d0d0d"}}>
                  <div style={{fontSize:11,color:"#333",width:20,textAlign:"center"}}>{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#ddd"}}>{c.name}</div>
                    <div style={{fontSize:11,color:"#444",fontFamily:"monospace"}}>{c.phone}</div>
                  </div>
                  <TierBadge tier={getTier(c.visits)} small lang={lang}/>
                </div>
              ))
            }
          </div>
        </>)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DESKTOP LAYOUT
// ══════════════════════════════════════════════════════════════
const STAFF_SESSION_KEY = "xbowl_staff_unlocked";

function DesktopLayout({lang,setLang}) {
  // Persist staff login in sessionStorage (stays until tab is closed)
  const [staffUnlocked,setStaffUnlocked]=useState(()=>localStorage.getItem(STAFF_SESSION_KEY)==="1");
  const [showPin,setShowPin]=useState(false);
  const ar=lang==="ar";

  function unlock(){
    localStorage.setItem(STAFF_SESSION_KEY,"1");
    setStaffUnlocked(true); setShowPin(false);
  }
  function logout(){
    localStorage.removeItem(STAFF_SESSION_KEY);
    setStaffUnlocked(false);
  }

  return (
    <div style={{minHeight:"100vh",background:"#060606",display:"flex",flexDirection:"column"}}>
      {/* Top nav */}
      <div style={{background:"#080808",borderBottom:"2px solid #fb4f07",padding:"14px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 16px rgba(251,79,7,0.5)"}}>🎳</div>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:"#fb4f07",letterSpacing:3,lineHeight:1}}>XBOWL</div>
            <div style={{fontSize:9,color:"#444",letterSpacing:4}}>LOYALTY MANAGEMENT</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"6px 16px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700}}>
            {ar?"EN":"عربي"}
          </button>
          {!staffUnlocked
            ? <button onClick={()=>setShowPin(true)} style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",color:"#fff",padding:"8px 20px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,boxShadow:"0 4px 12px rgba(251,79,7,0.4)"}}>
                🔐 {ar?"دخول الموظف":"Staff Login"}
              </button>
            : <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:20,padding:"6px 14px",fontSize:11,color:"#22c55e",fontWeight:700}}>
                  ✓ {ar?"الموظف مسجل دخول":"Staff Logged In"}
                </div>
                <button onClick={logout} style={{background:"#111",border:"1px solid #222",color:"#555",padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:11}}>
                  {ar?"خروج":"Logout"}
                </button>
              </div>
          }
        </div>
      </div>

      {showPin&&<PinGate lang={lang} onUnlock={unlock} onClose={()=>setShowPin(false)}/>}

      {/* Main content — full screen staff panel when unlocked, customer app when not */}
      <div style={{flex:1,overflow:"hidden"}}>
        {staffUnlocked
          ? <div style={{height:"100%",overflow:"auto"}}>
              <StaffApp lang={lang} setLang={setLang} desktopMode alreadyUnlocked/>
            </div>
          : <div style={{height:"100%",overflow:"auto",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"40px 16px",background:"#0a0a0a"}}>
              <div style={{width:"100%",maxWidth:460}}>
                <CustomerApp lang={lang} setLang={setLang} desktopMode/>
              </div>
            </div>
        }
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ROOT — responsive: desktop vs mobile
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [mode,setMode]=useState("customer");
  const [lang,setLang]=useState("ar");
  const [isDesktop,setIsDesktop]=useState(window.innerWidth>=1024);
  const ar=lang==="ar";

  useEffect(()=>{
    function handleResize(){ setIsDesktop(window.innerWidth>=1024); }
    window.addEventListener("resize",handleResize);
    return ()=>window.removeEventListener("resize",handleResize);
  },[]);

  // Desktop: show side-by-side layout
  if(isDesktop) return <DesktopLayout lang={lang} setLang={setLang}/>;

  // Mobile: show bottom tab navigation
  return (
    <div>
      {mode==="customer"
        ?<CustomerApp lang={lang} setLang={setLang}/>
        :<StaffApp lang={lang} setLang={setLang} onCancelPin={()=>setMode("customer")}/>
      }
      {/* Mobile bottom tabs */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(6,6,6,0.98)",borderTop:"1px solid rgba(255,255,255,0.06)",padding:"8px 16px 20px",display:"flex",gap:8,zIndex:200,backdropFilter:"blur(24px)"}}>
        {[
          ["customer", ar?"الزبون":"Customer", "📱"],
          ["staff",    ar?"الموظف":"Staff",    "🔧"],
        ].map(([v,label,icon])=>(
          <button key={v} onClick={()=>setMode(v)} style={{
            flex:1, padding:"12px 8px",
            background:mode===v?"linear-gradient(135deg,#fb4f07,#c93d00)":"#111",
            border:"1px solid "+(mode===v?"transparent":"#1e1e1e"),
            borderRadius:14, color:mode===v?"#fff":"#555",
            fontWeight:700, fontSize:13, cursor:"pointer",
            boxShadow:mode===v?"0 4px 12px rgba(251,79,7,0.4)":"none",
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
          }}>
            <span style={{fontSize:20}}>{icon}</span>
            {label}
          </button>
        ))}
      </div>
      <div style={{height:90}}/>
    </div>
  );
}
