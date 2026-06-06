import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ── CONFIG ─────────────────────────────────────────────────────
const SUPABASE_URL = "https://ooaqtwjqyiasqxuofaia.supabase.co";
const SUPABASE_KEY = "sb_publishable_jCB5RCh6cXRMWqkXmjC2PQ_Ew6A4kwI";
const STAMP_GOAL  = 5;

// ── SUPABASE ───────────────────────────────────────────────────
const sb = {
  async query(table, method="GET", body=null, params="") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": method==="POST"?"return=representation":"return=minimal",
      },
      body: body ? JSON.stringify(body) : null,
    });
    if(!res.ok){ const e=await res.text(); throw new Error(e); }
    if(method==="DELETE"||(method==="PATCH"&&res.status===204)) return null;
    const t=await res.text(); return t?JSON.parse(t):null;
  },
  async getCustomers()       { return await sb.query("customers","GET",null,"?select=*&order=joined.desc")||[]; },
  async getCustomerByPhone(p){ const d=p.replace(/\D/g,""); return (await sb.query("customers","GET",null,`?phone=eq.${d}&select=*`)||[])[0]||null; },
  async getCustomerById(id)  { return (await sb.query("customers","GET",null,`?id=eq.${id}&select=*`)||[])[0]||null; },
  async createCustomer(c)    { return (await sb.query("customers","POST",c)||[])[0]||null; },
  async updateCustomer(id,d) { return await sb.query("customers","PATCH",d,`?id=eq.${id}`); },
  async deleteCustomer(id)   { await sb.query("rewards","DELETE",null,`?customer_id=eq.${id}`); return await sb.query("customers","DELETE",null,`?id=eq.${id}`); },
  async getRewards()         { return await sb.query("rewards","GET",null,"?select=*&order=redeemed_at.desc")||[]; },
  async addReward(r)         { return await sb.query("rewards","POST",r); },
  async loginStaff(email,pw) { return (await sb.query("staff","GET",null,`?email=eq.${encodeURIComponent(email)}&password_hash=eq.${encodeURIComponent(pw)}&select=*`)||[])[0]||null; },
  async getAllStaff() { return await sb.query("staff","GET",null,"?select=id,email,name,role&order=role.asc")||[]; },
  async updatePassword(id,newPw) { return await sb.query("staff","PATCH",{password_hash:newPw},`?id=eq.${id}`); },
};

// ── HELPERS ────────────────────────────────────────────────────
const TIERS = {
  bronze:{ ar:"برونزي", en:"Bronze", color:"#cd7f32", icon:"🥉", bg:"linear-gradient(135deg,#3d2b1f,#1a1008)" },
  silver:{ ar:"فضي",   en:"Silver", color:"#c0c0c0", icon:"🥈", bg:"linear-gradient(135deg,#2a2a2a,#111)" },
  gold:  { ar:"ذهبي",  en:"Gold",   color:"#ffd700", icon:"🥇", bg:"linear-gradient(135deg,#3d3000,#1a1500)" },
};
function getTier(v){ return v>=15?"gold":v>=5?"silver":"bronze"; }
function genId(list){ return "XB"+String((list.length||0)+1).padStart(3,"0"); }
function fmtDate(ts){ return new Date(ts).toLocaleDateString("ar-SA",{month:"short",day:"numeric",year:"numeric"}); }
function fmtPhone(raw){ const d=raw.replace(/\D/g,"").slice(0,10); if(d.length<=4)return d; if(d.length<=7)return d.slice(0,4)+" "+d.slice(4); return d.slice(0,4)+" "+d.slice(4,7)+" "+d.slice(7); }
function toWAPhone(p){ const d=p.replace(/\D/g,""); if(d.startsWith("05")&&d.length===10)return "966"+d.slice(1); return d; }
function daysAgo(ts){ const d=Math.floor((Date.now()-ts)/86400000); return d===0?"اليوم":d===1?"أمس":`${d}د`; }
function startOfMonth(offset=0){ const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); d.setMonth(d.getMonth()+offset); return d.getTime(); }

// ── COMPONENTS ─────────────────────────────────────────────────
function Spinner(){ return <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid #1e1e1e",borderTop:"3px solid #fb4f07",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>; }

function TierBadge({tier,small,lang="ar"}){ const t=TIERS[tier||"bronze"]; return <span style={{display:"inline-flex",alignItems:"center",gap:small?3:6,background:t.color+"18",border:"1px solid "+t.color+"44",color:t.color,borderRadius:20,padding:small?"3px 10px":"5px 14px",fontSize:small?10:12,fontWeight:700}}>{t.icon} {lang==="ar"?t.ar:t.en}</span>; }

function QRCode({value,size=120}){ return <div style={{background:"#fff",padding:8,borderRadius:10,display:"inline-flex",flexDirection:"column",alignItems:"center",gap:4}}><QRCodeSVG value={value} size={size} bgColor="#ffffff" fgColor="#000000" level="M"/><div style={{color:"#000",fontSize:9,letterSpacing:2,fontFamily:"monospace",fontWeight:700}}>{value}</div></div>; }

function ProgressRing({stamps,goal,size=90}){ const r=(size-10)/2,circ=2*Math.PI*r; const [a,setA]=useState(0); useEffect(()=>{setTimeout(()=>setA(Math.min(stamps/goal,1)),100);},[stamps]); return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#og)" strokeWidth={5} strokeDasharray={circ} strokeDashoffset={circ*(1-a)} strokeLinecap="round" style={{transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)"}}/><defs><linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#fb4f07"/><stop offset="100%" stopColor="#ff8c00"/></linearGradient></defs></svg>; }

// ── STAFF LOGIN ─────────────────────────────────────────────────
function LoginGate({onUnlock,onBack,lang="ar",isManager=false}){
  const [email,setEmail]=useState(""),
        [pw,setPw]=useState(""), [err,setErr]=useState(""), [loading,setLoading]=useState(false);
  const ar=lang==="ar";
  async function doLogin(){
    if(!email.trim()||!pw.trim()){setErr(ar?"أدخل البيانات":"Enter credentials");return;}
    setLoading(true); setErr("");
    try{
      const s=await sb.loginStaff(email.trim().toLowerCase(),pw.trim());
      if(s){
        if(isManager&&s.role!=="manager"){setErr(ar?"هذا الحساب ليس لديه صلاحية المدير":"No manager access");setLoading(false);return;}
        onUnlock(s);
      } else setErr(ar?"إيميل أو كلمة مرور خاطئة":"Wrong email or password");
    }catch(e){setErr(ar?"خطأ في الاتصال":"Connection error");}
    setLoading(false);
  }
  return (
    <div style={{minHeight:"100vh",background:"#060606",display:"flex",alignItems:"center",justifyContent:"center",padding:20,backgroundImage:isManager?"radial-gradient(ellipse 60% 40% at 50% 0%,rgba(255,215,0,0.08) 0%,transparent 70%)":"radial-gradient(ellipse 60% 40% at 50% 0%,rgba(251,79,7,0.1) 0%,transparent 70%)"}}>
      <div style={{background:"#0f0f0f",border:"1px solid "+(isManager?"rgba(255,215,0,0.2)":"rgba(251,79,7,0.2)"),borderRadius:24,width:"100%",maxWidth:400,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.6)"}}>
        {/* Header */}
        <div style={{background:isManager?"linear-gradient(135deg,#b8860b,#8b6914)":"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"32px 24px 26px",textAlign:"center",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.05)",pointerEvents:"none"}}/>
          <div style={{fontSize:50,marginBottom:10}}>{isManager?"👑":"🔧"}</div>
          <div style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:2,marginBottom:4}}>
            {isManager?(ar?"بوابة المدير":"Manager Portal"):(ar?"بوابة الموظف":"Staff Portal")}
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>XBOWL LOYALTY SYSTEM</div>
        </div>

        <div style={{padding:"26px 24px 28px"}}>
          {/* Email */}
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"الإيميل":"EMAIL"}</label>
            <input value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} placeholder={isManager?"manager@xbowl.com":"staff@xbowl.com"} type="email" onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={{width:"100%",background:"#111",border:"1px solid "+(err?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:15,outline:"none",boxSizing:"border-box",direction:"ltr"}}
              onFocus={e=>e.target.style.borderColor=isManager?"rgba(255,215,0,0.5)":"rgba(251,79,7,0.5)"} onBlur={e=>e.target.style.borderColor=err?"#ff4444":"#1e1e1e"}/>
          </div>

          {/* Password */}
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"كلمة المرور":"PASSWORD"}</label>
            <input value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} placeholder="••••••••" type="password" onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={{width:"100%",background:"#111",border:"1px solid "+(err?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:15,outline:"none",boxSizing:"border-box",direction:"ltr"}}
              onFocus={e=>e.target.style.borderColor=isManager?"rgba(255,215,0,0.5)":"rgba(251,79,7,0.5)"} onBlur={e=>e.target.style.borderColor=err?"#ff4444":"#1e1e1e"}/>
          </div>

          {err&&<div style={{color:"#ff5555",fontSize:13,marginBottom:14,textAlign:"center",padding:"8px 12px",background:"rgba(255,85,85,0.08)",borderRadius:8,border:"1px solid rgba(255,85,85,0.2)"}}>⚠ {err}</div>}

          {/* Login button */}
          <button onClick={doLogin} disabled={loading} style={{
            width:"100%",padding:"15px",
            background:loading?"#1a1a1a":isManager?"linear-gradient(135deg,#ffd700,#b8860b)":"linear-gradient(135deg,#fb4f07,#c93d00)",
            border:"none",borderRadius:14,
            color:isManager&&!loading?"#000":"#fff",
            fontWeight:900,fontSize:15,cursor:loading?"not-allowed":"pointer",
            boxShadow:loading?"none":isManager?"0 8px 24px rgba(255,215,0,0.3)":"0 8px 24px rgba(251,79,7,0.4)",
            marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          }}>
            {loading
              ?<><div style={{width:18,height:18,border:"2px solid #333",borderTop:"2px solid #fb4f07",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>{ar?"جاري التحقق...":"Verifying..."}</>
              :<>{isManager?"👑":"🔧"} {ar?"تسجيل الدخول":"Sign In"}</>
            }
          </button>

          {/* Back button */}
          <button onClick={onBack} style={{
            width:"100%",padding:"13px",
            background:"#111",border:"2px solid #222",
            borderRadius:14,color:"#888",
            fontWeight:700,fontSize:14,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          }}>
            ← {ar?"العودة للموقع الرئيسي":"Back to Main Site"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── QR SCANNER ──────────────────────────────────────────────────
function QRScanner({onResult,onClose,lang="ar"}){
  const [manual,setManual]=useState(""), [status,setStatus]=useState("loading"), [errMsg,setErrMsg]=useState("");
  const videoRef=useRef(null), canvasRef=null, streamRef=null, rafRef=null, html5Ref=useRef(null);
  const ar=lang==="ar";
  function loadLib(url,cb){ if(window.Html5Qrcode){cb();return;} const s=document.createElement("script"); s.src=url; s.onload=cb; s.onerror=()=>setStatus("error"); document.head.appendChild(s); }
  function stopScanner(){ if(html5Ref.current){try{html5Ref.current.stop().catch(()=>{});}catch(e){} html5Ref.current=null;} }
  useEffect(()=>{
    loadLib("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",()=>{
      try{
        const sc=new window.Html5Qrcode("xbowl-qr");
        html5Ref.current=sc;
        sc.start({facingMode:"environment"},{fps:10,qrbox:{width:200,height:200}},
          (text)=>{stopScanner();onResult(text);},
          ()=>{}
        ).then(()=>setStatus("scanning")).catch(()=>{setStatus("error");setErrMsg(ar?"لا يمكن الوصول للكاميرا":"Camera unavailable");});
      }catch(e){setStatus("error");}
    });
    return ()=>stopScanner();
  },[]);
  function handleFile(e){ const f=e.target.files[0]; if(!f)return; loadLib("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",()=>{ const sc=new window.Html5Qrcode("xbowl-qr-file"); sc.scanFile(f,true).then(t=>onResult(t)).catch(()=>{setStatus("error");setErrMsg(ar?"لم يتم العثور على QR":"No QR found");}); }); }
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a0a",border:"1px solid rgba(251,79,7,0.3)",borderRadius:20,width:"100%",maxWidth:380,overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontWeight:800,fontSize:16,color:"#fff"}}>🔲 {ar?"مسح بطاقة الزبون":"Scan Customer Card"}</div>
          <button onClick={()=>{stopScanner();onClose();}} style={{background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",fontSize:14,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:"20px"}}>
          <div style={{position:"relative",borderRadius:14,overflow:"hidden",background:"#050505",marginBottom:14,minHeight:200,border:"1px solid #111"}}>
            <div id="xbowl-qr" style={{width:"100%"}}/>
            <div id="xbowl-qr-file" style={{display:"none"}}/>
            {status==="loading"&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}><div style={{width:28,height:28,border:"3px solid #1e1e1e",borderTop:"3px solid #fb4f07",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><div style={{color:"#555",fontSize:12}}>{ar?"جاري تفعيل الكاميرا...":"Starting camera..."}</div></div>}
            {status==="error"&&<div style={{padding:24,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}><span style={{fontSize:32}}>📷</span><div style={{color:"#fb4f07",fontSize:12,textAlign:"center"}}>{errMsg}</div></div>}
          </div>
          <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"11px",background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:12,color:"#fb4f07",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:14,boxSizing:"border-box"}}>
            🖼️ {ar?"التقط صورة QR من المعرض":"Capture QR from gallery"}
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>
          </label>
          <div style={{fontSize:10,color:"#444",textAlign:"center",marginBottom:12}}>— {ar?"أو أدخل رقم البطاقة":"or enter card ID"} —</div>
          <div style={{display:"flex",gap:8}}>
            <input value={manual} onChange={e=>setManual(e.target.value.toUpperCase())} placeholder="XB001" onKeyDown={e=>e.key==="Enter"&&onResult(manual.trim().toUpperCase())}
              style={{flex:1,background:"#111",border:"1px solid #1a1a1a",borderRadius:12,color:"#fff",padding:"12px 14px",fontSize:16,outline:"none",fontFamily:"monospace",letterSpacing:3}}
              onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.5)"} onBlur={e=>e.target.style.borderColor="#1a1a1a"}/>
            <button onClick={()=>manual.trim()&&onResult(manual.trim().toUpperCase())} style={{background:"#fb4f07",border:"none",color:"#fff",padding:"12px 18px",borderRadius:12,fontWeight:800,fontSize:13,cursor:"pointer"}}>{ar?"بحث":"Search"}</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CUSTOMER APP
// ══════════════════════════════════════════════════════════════
function CustomerApp({lang,setLang}){
  const [screen,setScreen]=useState("home");
  const [phone,setPhone]=useState(""), [error,setError]=useState(""), [loading,setLoading]=useState(false);
  const [customer,setCustomer]=useState(null);
  const [regForm,setRegForm]=useState({name:"",phone:""}), [regErr,setRegErr]=useState({}), [justReg,setJustReg]=useState(false);
  const [showQR,setShowQR]=useState(false);
  const ar=lang==="ar";

  useEffect(()=>{
    try{
      const s=localStorage.getItem("xb_cust_data");
      if(!s) return;
      const saved=JSON.parse(s);
      if(!saved?.id) return;
      sb.getCustomerById(saved.id).then(fresh=>{
        if(fresh){ setCustomer(fresh); setScreen("card"); try{localStorage.setItem("xb_cust_data",JSON.stringify(fresh));}catch(e){} }
        else{ try{localStorage.removeItem("xb_cust_data");}catch(e){} }
      }).catch(()=>{ setCustomer(saved); setScreen("card"); });
    }catch(e){}
  },[]);

  async function lookup(){
    if(!phone.trim()){setError(ar?"أدخل رقم الجوال":"Enter your phone");return;}
    setLoading(true); setError("");
    try{
      const c=await sb.getCustomerByPhone(phone);
      if(c){ setCustomer(c); setScreen("card"); try{localStorage.setItem("xb_cust_data",JSON.stringify(c));}catch(e){} }
      else setError(ar?"الرقم غير مسجل — سجّل بطاقتك مجاناً":"Not found — register for free");
    }catch(e){setError(ar?"حدث خطأ":"Error");}
    setLoading(false);
  }

  async function register(){
    const e={};
    if(!regForm.name.trim()) e.name=ar?"مطلوب":"Required";
    if(regForm.phone.replace(/\D/g,"").length<9) e.phone=ar?"رقم غير صحيح":"Invalid";
    if(Object.keys(e).length){setRegErr(e);return;}
    setLoading(true);
    try{
      const all=await
