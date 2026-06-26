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
  const videoRef=useRef(null), canvasRef=useRef(null), streamRef=useRef(null), rafRef=useRef(null), html5Ref=useRef(null);
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

// ── PWA INSTALL ────────────────────────────────────────────────
function AddToWalletBtn({lang}){
  const [deferredPrompt,setDeferredPrompt]=useState(null);
  const [isIOS,setIsIOS]=useState(false);
  const [isInstalled,setIsInstalled]=useState(false);
  const [showIOSGuide,setShowIOSGuide]=useState(false);
  const ar=lang==="ar";

  useEffect(()=>{
    // تحقق هل مثبت مسبقاً
    if(window.matchMedia("(display-mode: standalone)").matches){ setIsInstalled(true); return; }
    // iOS detection
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
    setIsIOS(ios);
    // Android/Chrome beforeinstallprompt
    const handler=e=>{ e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  if(isInstalled) return(
    <div style={{textAlign:"center",padding:"10px",fontSize:12,color:"#22c55e",marginBottom:8}}>✓ {ar?"البطاقة مضافة للشاشة الرئيسية":"Card added to home screen"}</div>
  );

  // iOS — نعرض دليل يدوي
  if(isIOS) return(<>
    <button onClick={()=>setShowIOSGuide(v=>!v)} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1c1c1e,#2c2c2e)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:14,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
      <span style={{fontSize:18}}>⬆️</span>
      {ar?"أضف البطاقة لشاشة iPhone":"Add Card to iPhone Home Screen"}
    </button>
    {showIOSGuide&&(
      <div style={{background:"#111",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:"16px",marginBottom:10,fontSize:13,color:"#ccc",lineHeight:2}}>
        <div style={{fontWeight:700,color:"#fff",marginBottom:8}}>{ar?"الخطوات:":"Steps:"}</div>
        <div>١. اضغط <span style={{color:"#fb4f07"}}>⬆️ Share</span> {ar?"في متصفح Safari":"in Safari browser"}</div>
        <div>٢. {ar?"اختر":"Choose"} <span style={{color:"#fb4f07"}}>{ar?'"إضافة إلى الشاشة الرئيسية"':'"Add to Home Screen"'}</span></div>
        <div>٣. {ar?"اضغط":"Tap"} <span style={{color:"#fb4f07"}}>{ar?'"إضافة"':'"Add"'}</span></div>
        <div style={{marginTop:8,fontSize:11,color:"#555"}}>{ar?"⚠️ يشتغل فقط من Safari":"⚠️ Works only from Safari"}</div>
      </div>
    )}
  </>);

  // Android/Chrome
  if(deferredPrompt) return(
    <button onClick={async()=>{ deferredPrompt.prompt(); const{outcome}=await deferredPrompt.userChoice; if(outcome==="accepted"){setIsInstalled(true);setDeferredPrompt(null);} }} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1c1c1e,#2c2c2e)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:14,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
      <span style={{fontSize:18}}>📲</span>
      {ar?"أضف البطاقة للشاشة الرئيسية":"Add Card to Home Screen"}
    </button>
  );

  return null;
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
      const all=await sb.getCustomers();
      const nc={id:genId(all),name:regForm.name.trim(),phone:regForm.phone.replace(/\D/g,""),stamps:0,visits:0,tier:"bronze",joined:Date.now(),last_visit:Date.now()};
      const created=await sb.createCustomer(nc);
      const c=created||nc;
      setCustomer(c); setJustReg(true); setScreen("card");
      try{localStorage.setItem("xb_cust_data",JSON.stringify(c));}catch(e){}
    }catch(e){setRegErr({phone:ar?"الرقم مسجل مسبقاً":"Already registered"});}
    setLoading(false);
  }

  function signout(){ setScreen("home"); setCustomer(null); setPhone(""); setJustReg(false); try{localStorage.removeItem("xb_cust_data");}catch(e){} }

  const tier=customer?TIERS[getTier(customer.visits)]:TIERS.bronze;
  const nextTier=!customer?null:customer.visits>=15?null:customer.visits>=5?TIERS.gold:TIERS.silver;
  const visitsToNext=!customer?0:customer.visits>=15?0:customer.visits>=5?15-customer.visits:5-customer.visits;

  return (
    <div dir={ar?"rtl":"ltr"} style={{minHeight:"100vh",background:"#060606",fontFamily:"'Segoe UI',Tahoma,sans-serif",paddingBottom:20,backgroundImage:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(251,79,7,0.12) 0%,transparent 70%)"}}>
      {showQR&&customer&&(
        <div onClick={()=>setShowQR(false)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
          <div style={{fontSize:12,color:"#555",letterSpacing:2}}>{ar?"أرِ هذا للموظف":"Show to staff"}</div>
          <div style={{background:"#0d0d0d",border:"1px solid rgba(251,79,7,0.3)",borderRadius:20,padding:24}}><QRCode value={customer.id} size={200}/></div>
          <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:4,fontFamily:"monospace"}}>{customer.id}</div>
          <div style={{fontSize:12,color:"#444"}}>{ar?"اضغط للإغلاق":"Tap to close"}</div>
        </div>
      )}
      {/* Header */}
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(251,79,7,0.15)",background:"rgba(6,6,6,0.95)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:"0 0 14px rgba(251,79,7,0.5)"}}>🎳</div>
          <div><div style={{fontSize:17,fontWeight:900,color:"#fb4f07",letterSpacing:2,lineHeight:1}}>XBOWL</div><div style={{fontSize:9,color:"#444",letterSpacing:3}}>{ar?"بطاقة الولاء":"LOYALTY CARD"}</div></div>
        </div>
        <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700}}>{ar?"EN":"عربي"}</button>
      </div>

      <div style={{maxWidth:460,margin:"0 auto",padding:"24px 16px"}}>
        {/* HOME */}
        {screen==="home"&&(
          <div>
            <div style={{textAlign:"center",padding:"32px 0 24px"}}>
              <div style={{fontSize:58,marginBottom:10}}>🎳</div>
              <h1 style={{margin:0,fontSize:30,fontWeight:900,color:"#fff",lineHeight:1.1}}>{ar?"برنامج":"Loyalty"}<span style={{display:"block",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:38}}>{ar?"الولاء":"Program"}</span></h1>
              <p style={{margin:"10px 0 0",fontSize:13,color:"#555"}}>{ar?"اجمع ٥ أختام واحصل على لعبة مجانية":"Collect 5 stamps, get a free game"}</p>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:28}}>
              {Array.from({length:5}).map((_,i)=>(<div key={i} style={{width:46,height:46,borderRadius:"50%",background:i<3?"linear-gradient(135deg,#fb4f07,#ff6b35)":"rgba(255,255,255,0.04)",border:i<3?"none":"1.5px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?20:0,boxShadow:i<3?"0 0 14px rgba(251,79,7,0.5)":"none",transform:i===2?"scale(1.12)":"scale(1)"}}>{i<3?"🎳":""}</div>))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:24}}>
              {Object.entries(TIERS).map(([k,t])=>(<div key={k} style={{background:"#0d0d0d",border:"1px solid "+t.color+"22",borderRadius:14,padding:"14px 10px",textAlign:"center"}}><div style={{fontSize:22,marginBottom:5}}>{t.icon}</div><div style={{fontSize:11,fontWeight:700,color:t.color}}>{ar?t.ar:t.en}</div><div style={{fontSize:9,color:"#333",marginTop:3}}>{k==="bronze"?ar?"0+ زيارة":"0+ visits":k==="silver"?ar?"5+ زيارة":"5+ visits":ar?"15+ زيارة":"15+ visits"}</div></div>))}
            </div>
            <div style={{background:"#0d0d0d",border:"1px solid #141414",borderRadius:20,padding:"22px"}}>
              <div style={{fontSize:10,color:"#444",letterSpacing:2,marginBottom:12}}>{ar?"سجّل دخولك برقم جوالك":"SIGN IN WITH YOUR PHONE"}</div>
              <input value={phone} onChange={e=>{setPhone(fmtPhone(e.target.value));setError("");}} placeholder="05X XXX XXXX" inputMode="tel"
                style={{width:"100%",background:"#111",border:"1px solid "+(error?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:16,outline:"none",boxSizing:"border-box",marginBottom:error?8:14,letterSpacing:1}}
                onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.5)"} onBlur={e=>e.target.style.borderColor=error?"#ff4444":"#1e1e1e"} onKeyDown={e=>e.key==="Enter"&&lookup()}/>
              {error&&<div style={{color:"#ff5555",fontSize:12,marginBottom:14}}>⚠ {error}</div>}
              <button onClick={lookup} disabled={loading} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:"0 8px 28px rgba(251,79,7,0.4)",marginBottom:10,opacity:loading?0.7:1}}>
                {loading?"...":(ar?"عرض بطاقتي":"View My Card")}
              </button>
              <button onClick={()=>setScreen("register")} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:14,color:"#555",fontWeight:600,fontSize:13,cursor:"pointer"}}>{ar?"تسجيل بطاقة جديدة مجاناً ←":"Register new card for free →"}</button>
            </div>
          </div>
        )}

        {/* REGISTER */}
        {screen==="register"&&(
          <div style={{background:"rgba(18,18,18,0.97)",borderRadius:18,border:"1px solid rgba(251,79,7,0.2)",overflow:"hidden"}}>
            <div style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"20px"}}>
              <button onClick={()=>setScreen("home")} style={{background:"rgba(0,0,0,0.22)",border:"none",color:"rgba(255,255,255,0.85)",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:12,marginBottom:10}}>{ar?"→ رجوع":"← Back"}</button>
              <div style={{fontWeight:900,fontSize:20,color:"#fff"}}>{ar?"بطاقة جديدة 🎳":"New Card 🎳"}</div>
            </div>
            <div style={{padding:"22px 18px 26px"}}>
              {[["name",ar?"الاسم":"NAME",ar?"اسمك الكامل":"Full name","text"],["phone",ar?"رقم الجوال":"PHONE","05X XXX XXXX","tel"]].map(([k,l,ph,t])=>(
                <div key={k} style={{marginBottom:14}}>
                  <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{l}</label>
                  <input value={regForm[k]} onChange={e=>{setRegForm(f=>({...f,[k]:k==="phone"?fmtPhone(e.target.value):e.target.value}));setRegErr(er=>({...er,[k]:""}));}} placeholder={ph} type={t} inputMode={t==="tel"?"tel":"text"}
                    style={{width:"100%",background:"#1a1a1a",border:"1px solid "+(regErr[k]?"#ff4444":"#2a2a2a"),borderRadius:10,color:"#fff",padding:"13px 15px",fontSize:15,outline:"none",boxSizing:"border-box"}}
                    onFocus={e=>{if(!regErr[k])e.target.style.borderColor="rgba(251,79,7,0.5)";}} onBlur={e=>{if(!regErr[k])e.target.style.borderColor="#2a2a2a";}}/>
                  {regErr[k]&&<div style={{color:"#ff5555",fontSize:11,marginTop:4}}>⚠ {regErr[k]}</div>}
                </div>
              ))}
              <button onClick={register} disabled={loading} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:8,opacity:loading?0.7:1}}>
                {loading?"...":(ar?"إنشاء بطاقتي 🎳":"Create My Card 🎳")}
              </button>
            </div>
          </div>
        )}

        {/* CARD */}
        {screen==="card"&&customer&&(
          <div>
            {justReg&&<div style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:14,textAlign:"center",fontSize:13,color:"#fb4f07",fontWeight:700}}>🎉 {ar?"أهلاً بك! تم إنشاء بطاقتك":"Welcome! Card created"}</div>}
            {/* Loyalty card */}
            <div style={{background:tier.bg,border:"1px solid "+tier.color+"22",borderRadius:20,padding:"22px",marginBottom:14,position:"relative",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
              <div style={{position:"absolute",top:-40,right:-40,width:150,height:150,borderRadius:"50%",background:tier.color+"08",pointerEvents:"none"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
                <div>
                  <div style={{fontSize:10,color:tier.color,letterSpacing:4,fontWeight:700,marginBottom:6}}>XBOWL LOYALTY</div>
                  <div style={{fontSize:18,color:"#fff",fontWeight:900}}>{customer.name}</div>
                  <div style={{marginTop:8}}><TierBadge tier={getTier(customer.visits)} lang={lang}/></div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                  <QRCode value={customer.id} size={70}/>
                  <button onClick={()=>setShowQR(true)} style={{background:tier.color+"18",border:"1px solid "+tier.color+"33",color:tier.color,padding:"4px 10px",borderRadius:8,fontSize:10,cursor:"pointer",fontWeight:700}}>{ar?"عرض كامل":"Full QR"}</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:customer.stamps>=STAMP_GOAL?14:0}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <ProgressRing stamps={customer.stamps} goal={STAMP_GOAL} size={88}/>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1}}>{customer.stamps}</div>
                    <div style={{fontSize:9,color:"#666"}}>/{STAMP_GOAL}</div>
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8}}>
                    {Array.from({length:STAMP_GOAL}).map((_,i)=>(<div key={i} style={{width:44,height:44,borderRadius:"50%",background:i<customer.stamps?"linear-gradient(135deg,#fb4f07,#c93d00)":"rgba(255,255,255,0.04)",border:i<customer.stamps?"none":"1.5px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<customer.stamps?18:12,boxShadow:i<customer.stamps?"0 0 14px rgba(251,79,7,0.5)":"none",color:i<customer.stamps?"#fff":"rgba(255,255,255,0.15)"}}>{i<customer.stamps?"🎳":i+1}</div>))}
                  </div>
                </div>
              </div>
              {customer.stamps>=STAMP_GOAL&&<div style={{background:"rgba(251,79,7,0.12)",border:"1px solid rgba(251,79,7,0.4)",borderRadius:12,padding:"12px",textAlign:"center"}}><div style={{fontSize:22,marginBottom:4}}>🎁</div><div style={{color:"#fb4f07",fontWeight:800,fontSize:14}}>{ar?"تهانينا! لعبة مجانية تنتظرك":"Congrats! Free game awaits"}</div><div style={{color:"#888",fontSize:11,marginTop:2}}>{ar?"أرِ الموظف هذه البطاقة":"Show to staff"}</div></div>}
            </div>
            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
              {[[customer.visits,ar?"زيارة":"Visits","📅"],[customer.stamps,ar?"ختم":"Stamps","🎳"],[STAMP_GOAL-customer.stamps,ar?"متبقي":"Left","⏳"]].map(([v,l,ic])=>(<div key={l} style={{background:"#0d0d0d",border:"1px solid #111",borderRadius:14,padding:"14px 10px",textAlign:"center"}}><div style={{fontSize:18,marginBottom:4}}>{ic}</div><div style={{fontSize:22,fontWeight:800,color:"#fb4f07",lineHeight:1}}>{v}</div><div style={{fontSize:10,color:"#444",marginTop:3}}>{l}</div></div>))}
            </div>
            {/* Tier progress */}
            {nextTier&&<div style={{background:"#0d0d0d",border:"1px solid #111",borderRadius:14,padding:"14px 18px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:12,color:"#555"}}>{ar?`نحو ${nextTier.ar}`:`Toward ${nextTier.en}`}</div><div style={{fontSize:12,color:nextTier.color,fontWeight:700}}>{visitsToNext} {ar?"زيارة":"visits"}</div></div><div style={{background:"#111",borderRadius:8,height:5,overflow:"hidden"}}><div style={{height:"100%",background:`linear-gradient(90deg,${nextTier.color},${nextTier.color}88)`,width:((customer.visits%(nextTier===TIERS.silver?5:15))/(nextTier===TIERS.silver?5:15)*100)+"%",borderRadius:8,transition:"width 1s"}}/></div></div>}
            <AddToWalletBtn lang={lang}/>
            <button onClick={signout} style={{width:"100%",padding:"11px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:12,color:"#444",fontSize:13,cursor:"pointer",marginTop:6}}>{ar?"تسجيل الخروج":"Sign Out"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// STAFF APP — scan + stamps + members
// ══════════════════════════════════════════════════════════════
function StaffApp({lang,setLang,staffInfo,onLogout}){
  const [tab,setTab]=useState("scan");
  const [showScanner,setShowScanner]=useState(false);
  const [scanResult,setScanResult]=useState(null), [scanErr,setScanErr]=useState(""), [scanInput,setScanInput]=useState("");
  const [lastAction,setLastAction]=useState(null);
  const [customers,setCustomers]=useState([]), [rewards,setRewards]=useState([]), [loading,setLoading]=useState(false);
  const [loyalFilter,setLoyalFilter]=useState("all");
  const [confirmDelete,setConfirmDelete]=useState(null), [editCustomer,setEditCustomer]=useState(null);
  const ar=lang==="ar";
  const safeC=Array.isArray(customers)?customers:[];

  useEffect(()=>{loadData();},[]);

  async function loadData(){
    setLoading(true);
    try{ const [c,r]=await Promise.all([sb.getCustomers(),sb.getRewards()]); setCustomers(Array.isArray(c)?c:[]); setRewards(Array.isArray(r)?r:[]); }catch(e){ setCustomers([]); setRewards([]); }
    setLoading(false);
  }
  async function handleScan(val){
    setShowScanner(false); setScanErr(""); setLoading(true);
    try{ const c=await sb.getCustomerById(val.toUpperCase().trim()); if(c)setScanResult({...c}); else setScanErr(ar?`البطاقة "${val}" غير موجودة`:`Card "${val}" not found`); }catch(e){setScanErr(ar?"خطأ":"Error");}
    setLoading(false);
  }
  async function addStamp(){
    if(!scanResult)return; setLoading(true);
    try{
      const got=(scanResult.stamps+1)>=STAMP_GOAL;
      const ns=got?0:scanResult.stamps+1, nv=scanResult.visits+1;
      await sb.updateCustomer(scanResult.id,{stamps:ns,visits:nv,tier:getTier(nv),last_visit:Date.now()});
      if(got) await sb.addReward({id:"R"+Date.now(),customer_id:scanResult.id,note:ar?"لعبة مجانية":"Free game",redeemed_at:Date.now()});
      setLastAction({name:scanResult.name,gotReward:got,stamps:ns});
      setScanResult(null); setScanInput(""); await loadData();
    }catch(e){setScanErr(ar?"خطأ في الحفظ":"Save error");}
    setLoading(false);
  }
  async function doDelete(c){ setLoading(true); try{await sb.deleteCustomer(c.id);await loadData();}catch(e){} setLoading(false); setConfirmDelete(null); }
  async function doRemoveStamp(c){ setLoading(true); try{await sb.updateCustomer(c.id,{stamps:Math.max(0,c.stamps-1)});await loadData();}catch(e){} setLoading(false); setEditCustomer(null); }
  async function doResetStamps(c){ setLoading(true); try{await sb.updateCustomer(c.id,{stamps:0});await loadData();}catch(e){} setLoading(false); setEditCustomer(null); }

  const listData=loyalFilter==="all"?safeC:loyalFilter==="full"?safeC.filter(c=>c.stamps>=STAMP_GOAL):safeC.filter(c=>c.stamps>0&&c.stamps<STAMP_GOAL);

  return (
    <div style={{minHeight:"100vh",background:"#060606",fontFamily:"'Segoe UI',sans-serif",paddingBottom:20}}>
      {showScanner&&<QRScanner lang={lang} onResult={handleScan} onClose={()=>setShowScanner(false)}/>}

      {/* Modals */}
      {editCustomer&&(
        <div onClick={e=>e.target===e.currentTarget&&setEditCustomer(null)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#0f0f0f",border:"1px solid #2a2a2a",borderRadius:20,width:"100%",maxWidth:360,overflow:"hidden"}}>
            <div style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>✏️ {ar?"تعديل الأختام":"Edit Stamps"}</div>
              <button onClick={()=>setEditCustomer(null)} style={{background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",width:28,height:28,borderRadius:"50%",fontSize:14,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{padding:"20px"}}>
              <div style={{fontWeight:700,color:"#fff",fontSize:15,marginBottom:4}}>{editCustomer.name}</div>
              <div style={{fontSize:12,color:"#555",marginBottom:16}}>{editCustomer.phone}</div>
              <div style={{display:"flex",gap:8,marginBottom:18,justifyContent:"center"}}>
                {Array.from({length:STAMP_GOAL}).map((_,i)=>(<div key={i} style={{width:42,height:42,borderRadius:"50%",background:i<editCustomer.stamps?"linear-gradient(135deg,#fb4f07,#c93d00)":"#1a1a1a",border:i<editCustomer.stamps?"none":"1px solid #2a2a2a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,boxShadow:i<editCustomer.stamps?"0 0 10px rgba(251,79,7,0.4)":"none"}}>{i<editCustomer.stamps?"🎳":""}</div>))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <button onClick={()=>doRemoveStamp(editCustomer)} disabled={editCustomer.stamps<=0||loading} style={{padding:"12px",background:editCustomer.stamps>0?"rgba(251,79,7,0.1)":"#0d0d0d",border:"1px solid "+(editCustomer.stamps>0?"rgba(251,79,7,0.3)":"#1a1a1a"),borderRadius:12,color:editCustomer.stamps>0?"#fb4f07":"#333",fontWeight:700,fontSize:14,cursor:editCustomer.stamps>0?"pointer":"not-allowed"}}>➖ {ar?"حذف ختم واحد":"Remove 1 Stamp"}</button>
                <button onClick={()=>doResetStamps(editCustomer)} disabled={editCustomer.stamps===0||loading} style={{padding:"12px",background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,color:editCustomer.stamps>0?"#ff3b30":"#333",fontWeight:700,fontSize:14,cursor:editCustomer.stamps>0?"pointer":"not-allowed"}}>🔄 {ar?"إعادة تعيين":"Reset All"}</button>
                <button onClick={()=>setEditCustomer(null)} style={{padding:"11px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:12,color:"#555",fontSize:13,cursor:"pointer"}}>{ar?"إلغاء":"Cancel"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDelete&&(
        <div onClick={e=>e.target===e.currentTarget&&setConfirmDelete(null)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.9)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#0f0f0f",border:"1px solid rgba(255,59,48,0.3)",borderRadius:20,width:"100%",maxWidth:340,padding:"28px 24px",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>🗑️</div>
            <div style={{fontWeight:800,color:"#fff",fontSize:17,marginBottom:6}}>{ar?"حذف الزبون؟":"Delete Customer?"}</div>
            <div style={{fontSize:13,color:"#fb4f07",fontWeight:700,marginBottom:4}}>{confirmDelete.name}</div>
            <div style={{fontSize:12,color:"#555",marginBottom:24}}>{ar?"سيتم الحذف بشكل نهائي":"Will be permanently deleted"}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"12px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:12,color:"#777",fontWeight:700,fontSize:14,cursor:"pointer"}}>{ar?"إلغاء":"Cancel"}</button>
              <button onClick={()=>doDelete(confirmDelete)} disabled={loading} style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#ff3b30,#c0392b)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>{loading?"...":(ar?"حذف":"Delete")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#080808",borderBottom:"2px solid #fb4f07",padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🎳</div>
          <div><div style={{fontSize:15,fontWeight:900,color:"#fb4f07",letterSpacing:2,lineHeight:1}}>XBOWL</div><div style={{fontSize:9,color:"#444",letterSpacing:3}}>STAFF</div></div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:16,padding:"3px 10px",fontSize:10,color:"#22c55e",fontWeight:700}}>✓ {staffInfo?.name||"Staff"}</div>
          <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"4px 10px",borderRadius:14,cursor:"pointer",fontSize:11,fontWeight:700}}>{ar?"EN":"عربي"}</button>
          <button onClick={onLogout} style={{background:"#111",border:"1px solid #1e1e1e",color:"#555",padding:"4px 10px",borderRadius:8,cursor:"pointer",fontSize:11}}>{ar?"خروج":"Logout"}</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:"#060606",borderBottom:"1px solid rgba(255,255,255,0.04)",position:"sticky",top:0,zIndex:9}}>
        {[["scan",ar?"🔲 مسح":"🔲 Scan"],["members",ar?"👥 الأعضاء":"👥 Members"]].map(([t,l])=>(
          <button key={t} onClick={()=>{setTab(t);if(t==="members")loadData();}} style={{flex:1,padding:"13px 6px",background:"transparent",border:"none",borderBottom:tab===t?"2px solid #fb4f07":"2px solid transparent",color:tab===t?"#fb4f07":"#444",fontWeight:tab===t?700:400,fontSize:12,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      <div style={{maxWidth:700,margin:"0 auto",padding:"18px 16px"}}>

        {/* SCAN TAB */}
        {tab==="scan"&&(<>
          {lastAction&&(
            <div style={{background:lastAction.gotReward?"rgba(251,79,7,0.08)":"rgba(34,197,94,0.06)",border:"1px solid "+(lastAction.gotReward?"rgba(251,79,7,0.25)":"rgba(34,197,94,0.2)"),borderRadius:14,padding:"14px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>{lastAction.gotReward?"🎁":"✅"}</span>
              <div><div style={{fontWeight:700,color:"#fff",fontSize:14}}>{lastAction.gotReward?(ar?"مكافأة! — ":"Reward! — "):(ar?"ختم — ":"Stamp — ")}{lastAction.name}</div><div style={{fontSize:12,color:"#555",marginTop:2}}>{lastAction.gotReward?(ar?"لعبة مجانية":"Free game"):`${lastAction.stamps}/${STAMP_GOAL}`}</div></div>
              <button onClick={()=>setLastAction(null)} style={{marginRight:"auto",background:"transparent",border:"none",color:"#333",fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
            {[[safeC.length,ar?"عضو":"Members","👥"],[Array.isArray(rewards)?rewards.length:0,ar?"مكافأة":"Rewards","🎁"],[safeC.filter(c=>c&&c.stamps>=STAMP_GOAL).length,ar?"جاهز":"Ready","⭐"]].map(([v,l,ic])=>(<div key={l} style={{background:"#0a0a0a",border:"1px solid #0f0f0f",borderRadius:14,padding:"14px 12px",textAlign:"center"}}><div style={{fontSize:18,marginBottom:4}}>{ic}</div><div style={{fontSize:22,fontWeight:800,color:"#fb4f07"}}>{v}</div><div style={{fontSize:10,color:"#333",marginTop:3}}>{l}</div></div>))}
          </div>
          <button onClick={()=>setShowScanner(true)} style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:16,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",boxShadow:"0 8px 28px rgba(251,79,7,0.4)",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:14}}>
            <span style={{fontSize:22}}>📷</span>{ar?"مسح QR بطاقة الزبون":"Scan Customer QR Card"}
          </button>
          <div style={{background:"#0a0a0a",border:"1px solid #0f0f0f",borderRadius:14,padding:"16px",marginBottom:14}}>
            <div style={{fontSize:10,color:"#444",letterSpacing:2,marginBottom:10}}>{ar?"إدخال يدوي":"MANUAL"}</div>
            <div style={{display:"flex",gap:8}}>
              <input value={scanInput} onChange={e=>{setScanInput(e.target.value.toUpperCase());setScanErr("");setScanResult(null);}} placeholder="XB001" onKeyDown={e=>e.key==="Enter"&&handleScan(scanInput)}
                style={{flex:1,background:"#111",border:"1px solid #1a1a1a",borderRadius:10,color:"#fff",padding:"11px 14px",fontSize:16,outline:"none",fontFamily:"monospace",letterSpacing:3}}
                onFocus={e=>e.target.style.borderColor="rgba(251,79,7,0.4)"} onBlur={e=>e.target.style.borderColor="#1a1a1a"}/>
              <button onClick={()=>handleScan(scanInput)} disabled={loading} style={{background:"#fb4f07",border:"none",color:"#fff",padding:"11px 16px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>{ar?"بحث":"Search"}</button>
            </div>
            {scanErr&&<div style={{color:"#ff5555",fontSize:12,marginTop:8}}>⚠ {scanErr}</div>}
          </div>
          {loading&&<Spinner/>}
          {scanResult&&!loading&&(
            <div style={{background:"#0a0a0a",border:"1px solid rgba(251,79,7,0.2)",borderRadius:18,overflow:"hidden"}}>
              <div style={{padding:"18px 18px 14px",borderBottom:"1px solid #0f0f0f"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div><div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{scanResult.name}</div><div style={{fontSize:12,color:"#555",marginTop:3}}>{scanResult.phone} · {scanResult.visits} {ar?"زيارة":"visits"}</div><div style={{marginTop:8}}><TierBadge tier={getTier(scanResult.visits)} lang={lang}/></div></div>
                  <QRCode value={scanResult.id} size={60}/>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:12}}>{Array.from({length:STAMP_GOAL}).map((_,i)=>(<div key={i} style={{flex:1,aspectRatio:"1",borderRadius:10,background:i<scanResult.stamps?"linear-gradient(135deg,#fb4f07,#c93d00)":"#111",border:i<scanResult.stamps?"none":"1px solid #1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{i<scanResult.stamps?"🎳":""}</div>))}</div>
                {scanResult.stamps>=STAMP_GOAL?<div style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{color:"#fb4f07",fontWeight:800}}>🎁 {ar?"البطاقة ممتلئة — مكافأة!":"Card full — Reward!"}</div></div>
                :<div style={{background:"#0d0d0d",borderRadius:10,padding:"9px",textAlign:"center",fontSize:13,color:"#555"}}>{ar?"سيصبح لديه":"Will have"} <span style={{color:"#fb4f07",fontWeight:800}}>{scanResult.stamps+1}</span>/{STAMP_GOAL}</div>}
              </div>
              <div style={{padding:"14px 18px",display:"flex",gap:10}}>
                <button onClick={addStamp} disabled={loading} style={{flex:1,padding:"13px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",opacity:loading?0.7:1}}>
                  {scanResult.stamps>=STAMP_GOAL?(ar?"🎁 صرف المكافأة":"🎁 Redeem"):(ar?"✅ إضافة ختم":"✅ Add Stamp")}
                </button>
                <button onClick={()=>{setScanResult(null);setScanInput("");}} style={{padding:"13px 16px",background:"#111",border:"1px solid #1a1a1a",borderRadius:12,color:"#555",fontSize:18,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          )}
        </>)}

        {/* MEMBERS TAB */}
        {tab==="members"&&(<>
          {loading&&<Spinner/>}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {[["all",ar?"الكل":"All"],["active",ar?"نشط":"Active"],["full",ar?"مكافأة 🎁":"Reward 🎁"]].map(([k,l])=>(
              <button key={k} onClick={()=>setLoyalFilter(k)} style={{padding:"7px 14px",borderRadius:20,background:loyalFilter===k?"#fb4f07":"#0d0d0d",border:"1px solid "+(loyalFilter===k?"transparent":"#111"),color:loyalFilter===k?"#fff":"#555",fontWeight:700,fontSize:11,cursor:"pointer"}}>{l}</button>
            ))}
            <button onClick={loadData} style={{padding:"7px 14px",borderRadius:20,background:"#0d0d0d",border:"1px solid #111",color:"#555",fontWeight:700,fontSize:11,cursor:"pointer"}}>🔄</button>
          </div>
          {!loading&&safeC.length===0&&<div style={{textAlign:"center",padding:"40px",color:"#444"}}><div style={{fontSize:32,marginBottom:8}}>👥</div><div>{ar?"لا يوجد أعضاء":"No members yet"}</div></div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(listData||[]).map(c=>{ if(!c)return null; const t=TIERS[getTier(c.visits||0)]; return(
              <div key={c.id} style={{background:"#0a0a0a",border:"1px solid "+(c.stamps>=STAMP_GOAL?"rgba(251,79,7,0.2)":"#0f0f0f"),borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:t.bg,border:"1px solid "+t.color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{t.icon}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>{c.name}</div>
                    <div style={{fontSize:10,color:"#333",fontFamily:"monospace"}}>{c.id}</div>
                    {c.stamps>=STAMP_GOAL&&<span style={{background:"rgba(251,79,7,0.15)",border:"1px solid rgba(251,79,7,0.3)",color:"#fb4f07",borderRadius:10,padding:"1px 7px",fontSize:9,fontWeight:700}}>🎁</span>}
                  </div>
                  <div style={{display:"flex",gap:5,marginBottom:4}}>{Array.from({length:STAMP_GOAL}).map((_,i)=>(<div key={i} style={{width:16,height:16,borderRadius:3,background:i<c.stamps?"#fb4f07":"#111",border:i<c.stamps?"none":"1px solid #1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7}}>{i<c.stamps?"🎳":""}</div>))}<span style={{fontSize:10,color:"#444",alignSelf:"center",marginRight:4}}>{c.visits} {ar?"زيارة":"v"}</span></div>
                  <div style={{fontSize:10,color:"#333"}}>{c.phone}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <button onClick={()=>setEditCustomer(c)} style={{background:"rgba(251,79,7,0.1)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer"}}>✏️</button>
                  <button onClick={()=>setConfirmDelete(c)} style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",color:"#ff3b30",padding:"4px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer"}}>🗑️</button>
                </div>
              </div>
            );})}
          </div>
        </>)}
      </div>
    </div>
  );
}


// ── PASSWORD MANAGER (manager only) ────────────────────────────
function PasswordManager({staffInfo,lang,onClose}){
  const [accounts,setAccounts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null); // {id,name,email}
  const [newPw,setNewPw]=useState("");
  const [confirm,setConfirm]=useState("");
  const [err,setErr]=useState("");
  const [success,setSuccess]=useState("");
  const ar=lang==="ar";

  useEffect(()=>{
    sb.getAllStaff().then(s=>{ setAccounts(s||[]); setLoading(false); });
  },[]);

  async function savePassword(){
    if(newPw.length<6){setErr(ar?"كلمة المرور يجب أن تكون ٦ أحرف على الأقل":"Minimum 6 characters");return;}
    if(newPw!==confirm){setErr(ar?"كلمتا المرور غير متطابقتين":"Passwords don't match");return;}
    setErr(""); setLoading(true);
    try{
      await sb.updatePassword(editing.id,newPw);
      setSuccess(ar?`تم تغيير كلمة مرور ${editing.name} بنجاح ✓`:`Password changed for ${editing.name} ✓`);
      setTimeout(()=>{ setSuccess(""); setEditing(null); setNewPw(""); setConfirm(""); },2000);
    }catch(e){setErr(ar?"حدث خطأ":"Error occurred");}
    setLoading(false);
  }

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0f0f0f",border:"1px solid rgba(255,215,0,0.2)",borderRadius:22,width:"100%",maxWidth:440,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.7)"}}>
        <div style={{background:"linear-gradient(135deg,#b8860b,#8b6914)",padding:"20px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontWeight:900,fontSize:16,color:"#fff"}}>🔑 {ar?"إدارة كلمات المرور":"Password Management"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",marginTop:2}}>{ar?"للمدير فقط":"Manager only"}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",fontSize:15,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{padding:"20px"}}>
          {loading&&!editing&&<div style={{textAlign:"center",padding:20,color:"#555"}}>{ar?"جاري التحميل...":"Loading..."}</div>}

          {!editing&&!loading&&(
            <div>
              <div style={{fontSize:10,color:"#555",letterSpacing:2,marginBottom:14}}>{ar?"الحسابات المتاحة":"ACCOUNTS"}</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {accounts.map(a=>(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,background:"#111",borderRadius:14,padding:"14px 16px",border:"1px solid #1a1a1a"}}>
                    <div style={{fontSize:22}}>{a.role==="manager"?"👑":"🔧"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{a.name}</div>
                      <div style={{fontSize:11,color:"#555",direction:"ltr",textAlign:"left"}}>{a.email}</div>
                    </div>
                    <button
                      onClick={()=>{setEditing(a);setNewPw("");setConfirm("");setErr("");setSuccess("");}}
                      style={{background:a.role==="manager"?"rgba(255,215,0,0.1)":"rgba(251,79,7,0.1)",border:"1px solid "+(a.role==="manager"?"rgba(255,215,0,0.2)":"rgba(251,79,7,0.2)"),color:a.role==="manager"?"#ffd700":"#fb4f07",padding:"6px 14px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      {ar?"تغيير":"Change"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editing&&(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
                <button onClick={()=>{setEditing(null);setNewPw("");setConfirm("");setErr("");}} style={{background:"#111",border:"1px solid #1e1e1e",color:"#666",padding:"5px 12px",borderRadius:8,fontSize:12,cursor:"pointer"}}>← {ar?"رجوع":"Back"}</button>
                <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{editing.name}</div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"كلمة المرور الجديدة":"NEW PASSWORD"}</label>
                <input value={newPw} onChange={e=>{setNewPw(e.target.value);setErr("");}} type="password" placeholder="••••••••"
                  style={{width:"100%",background:"#111",border:"1px solid "+(err?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"13px 15px",fontSize:15,outline:"none",boxSizing:"border-box",direction:"ltr"}}
                  onFocus={e=>e.target.style.borderColor="rgba(255,215,0,0.5)"} onBlur={e=>e.target.style.borderColor=err?"#ff4444":"#1e1e1e"}/>
              </div>
              <div style={{marginBottom:18}}>
                <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"تأكيد كلمة المرور":"CONFIRM PASSWORD"}</label>
                <input value={confirm} onChange={e=>{setConfirm(e.target.value);setErr("");}} type="password" placeholder="••••••••"
                  style={{width:"100%",background:"#111",border:"1px solid "+(err?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"13px 15px",fontSize:15,outline:"none",boxSizing:"border-box",direction:"ltr"}}
                  onFocus={e=>e.target.style.borderColor="rgba(255,215,0,0.5)"} onBlur={e=>e.target.style.borderColor=err?"#ff4444":"#1e1e1e"}/>
              </div>
              {err&&<div style={{color:"#ff5555",fontSize:12,marginBottom:12,padding:"8px 12px",background:"rgba(255,85,85,0.08)",borderRadius:8}}>⚠ {err}</div>}
              {success&&<div style={{color:"#22c55e",fontSize:12,marginBottom:12,padding:"8px 12px",background:"rgba(34,197,94,0.08)",borderRadius:8}}>✓ {success}</div>}
              <button onClick={savePassword} disabled={loading||!newPw||!confirm} style={{width:"100%",padding:"13px",background:loading||!newPw||!confirm?"#111":"linear-gradient(135deg,#ffd700,#b8860b)",border:"none",borderRadius:12,color:loading||!newPw||!confirm?"#333":"#000",fontWeight:800,fontSize:14,cursor:loading||!newPw||!confirm?"not-allowed":"pointer"}}>
                {loading?ar?"جاري الحفظ...":"Saving...":(ar?"حفظ كلمة المرور":"Save Password")} 🔑
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MANAGER APP — analytics + export
// ══════════════════════════════════════════════════════════════
function ManagerApp({lang,setLang,staffInfo,onLogout}){
  const [customers,setCustomers]=useState([]), [rewards,setRewards]=useState([]), [loading,setLoading]=useState(true);
  const [exportFilter,setExportFilter]=useState("all"), [copied,setCopied]=useState(false), [showExport,setShowExport]=useState(false);
  const [showPwManager,setShowPwManager]=useState(false);
  const ar=lang==="ar";

  useEffect(()=>{ loadData(); },[]);
  async function loadData(){ setLoading(true); try{ const [c,r]=await Promise.all([sb.getCustomers(),sb.getRewards()]); setCustomers(Array.isArray(c)?c:[]); setRewards(Array.isArray(r)?r:[]); }catch(e){} setLoading(false); }

  const safeC=Array.isArray(customers)?customers:[];
  const safeR=Array.isArray(rewards)?rewards:[];

  // ── ANALYTICS ─────────────────────────────────────────────
  const now=Date.now();
  const thisMonthStart=startOfMonth(0);
  const lastMonthStart=startOfMonth(-1);
  const twoMonthsStart=startOfMonth(-2);

  const newThisMonth=safeC.filter(c=>c.joined>=thisMonthStart).length;
  const newLastMonth=safeC.filter(c=>c.joined>=lastMonthStart&&c.joined<thisMonthStart).length;
  const growthRate=newLastMonth>0?Math.round(((newThisMonth-newLastMonth)/newLastMonth)*100):newThisMonth>0?100:0;

  const rewardsThisMonth=safeR.filter(r=>r.redeemed_at>=thisMonthStart).length;
  const rewardsLastMonth=safeR.filter(r=>r.redeemed_at>=lastMonthStart&&r.redeemed_at<thisMonthStart).length;

  const goldCount=safeC.filter(c=>getTier(c.visits)==="gold").length;
  const silverCount=safeC.filter(c=>getTier(c.visits)==="silver").length;
  const bronzeCount=safeC.filter(c=>getTier(c.visits)==="bronze").length;

  const avgVisits=safeC.length>0?(safeC.reduce((s,c)=>s+(c.visits||0),0)/safeC.length).toFixed(1):0;
  const readyReward=safeC.filter(c=>c.stamps>=STAMP_GOAL).length;

  // Last 6 months growth
  const monthlyData=Array.from({length:6}).map((_,i)=>{
    const s=startOfMonth(-5+i), e=i===5?now:startOfMonth(-4+i);
    const count=safeC.filter(c=>c.joined>=s&&c.joined<e).length;
    const d=new Date(s); const label=d.toLocaleDateString(ar?"ar-SA":"en-US",{month:"short"});
    return {label,count};
  });
  const maxBar=Math.max(...monthlyData.map(m=>m.count),1);

  // Top 10 members by visits
  const top10=[...safeC].sort((a,b)=>(b.visits||0)-(a.visits||0)).slice(0,10);

  // Export
  const exportData=exportFilter==="all"?safeC:exportFilter==="full"?safeC.filter(c=>c.stamps>=STAMP_GOAL):exportFilter==="gold"?safeC.filter(c=>getTier(c.visits)==="gold"):safeC.filter(c=>getTier(c.visits)==="silver");
  function copy(){ navigator.clipboard.writeText(exportData.map(c=>c.phone).join("\n")).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}); }

  const PRESETS=[
    {label:"🎉 "+(ar?"عرض خاص":"Special Offer"),text:ar?"🎳 عرض XBOWL الحصري!\nاحجز اليوم واحصل على خصم ٢٠٪.\n\nxbowl.club":"🎳 XBOWL Exclusive Offer!\nBook today and get 20% off.\n\nxbowl.club"},
    {label:"🏆 "+(ar?"بطولة":"Tournament"),text:ar?"🏆 بطولة XBOWL قادمة!\nسجّل مكانك قبل نفاذ الأماكن.\n\nxbowl.club":"🏆 XBOWL Tournament!\nRegister your spot now.\n\nxbowl.club"},
    {label:"🎁 "+(ar?"تذكير مكافأة":"Reward Reminder"),text:ar?"🎳 أنت قريب من مكافأتك في XBOWL!\nتعال وأكمل أختامك.\n\nxbowl.club":"🎳 You're close to your XBOWL reward!\nCome complete your stamps.\n\nxbowl.club"},
  ];
  const [wMsg,setWMsg]=useState(PRESETS[0].text), [wStep,setWStep]=useState("compose"), [wIdx,setWIdx]=useState(0), [wSel,setWsSel]=useState([]);
  useEffect(()=>{ setWsSel(exportData.map(c=>c.id)); },[exportFilter,customers]);
  const wRcpts=exportData.filter(c=>wSel.includes(c.id));
  function wOpenWA(i){ if(i>=wRcpts.length)return; window.open("https://wa.me/"+toWAPhone(wRcpts[i].phone)+"?text="+encodeURIComponent(wMsg),"_blank"); }
  function wStart(){ wOpenWA(0); setWIdx(1); setWStep("sending"); }
  function wNext(){ wOpenWA(wIdx); setWIdx(i=>i+1); }

  return (
    <div style={{minHeight:"100vh",background:"#060606",fontFamily:"'Segoe UI',sans-serif",paddingBottom:40}}>
      {/* Header */}
      <div style={{background:"#080808",borderBottom:"2px solid #ffd700",padding:"13px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#ffd700,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👑</div>
          <div><div style={{fontSize:15,fontWeight:900,color:"#ffd700",letterSpacing:2,lineHeight:1}}>XBOWL</div><div style={{fontSize:9,color:"#444",letterSpacing:3}}>MANAGER</div></div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:16,padding:"3px 10px",fontSize:10,color:"#ffd700",fontWeight:700}}>👑 {staffInfo?.name||"Manager"}</div>
          <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.2)",color:"#ffd700",padding:"4px 10px",borderRadius:14,cursor:"pointer",fontSize:11,fontWeight:700}}>{ar?"EN":"عربي"}</button>
          <button onClick={()=>setShowPwManager(true)} style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.2)",color:"#ffd700",padding:"4px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700}}>🔑 {ar?"كلمات المرور":"Passwords"}</button>
          <button onClick={onLogout} style={{background:"#111",border:"1px solid #1e1e1e",color:"#555",padding:"4px 10px",borderRadius:8,cursor:"pointer",fontSize:11}}>{ar?"خروج":"Logout"}</button>
        </div>
      </div>
      {showPwManager&&<PasswordManager staffInfo={staffInfo} lang={lang} onClose={()=>setShowPwManager(false)}/>}

      <div style={{maxWidth:900,margin:"0 auto",padding:"22px 16px"}}>
        {loading?<Spinner/>:(<>

          {/* ── KPI CARDS ── */}
          <div style={{fontSize:11,color:"#ffd700",letterSpacing:3,marginBottom:14,fontWeight:700}}>📊 {ar?"الإحصائيات الرئيسية":"KEY METRICS"}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:10}}>
            {[
              {icon:"👥",val:safeC.length,label:ar?"إجمالي الأعضاء":"Total Members",color:"#fb4f07"},
              {icon:"🆕",val:newThisMonth,label:ar?"أعضاء جدد هذا الشهر":"New This Month",color:"#22c55e",sub:newLastMonth>0?`${growthRate>0?"+":""}${growthRate}% ${ar?"عن الشهر الماضي":"vs last month"}`:null,subColor:growthRate>=0?"#22c55e":"#ff3b30"},
              {icon:"🎁",val:safeR.length,label:ar?"إجمالي المكافآت":"Total Rewards",color:"#ffd700",sub:rewardsThisMonth>0?`${rewardsThisMonth} ${ar?"هذا الشهر":"this month"}`:null},
              {icon:"⭐",val:readyReward,label:ar?"جاهز للمكافأة":"Ready for Reward",color:"#fb4f07"},
              {icon:"📈",val:`${growthRate>0?"+":""}${growthRate}%`,label:ar?"معدل النمو الشهري":"Monthly Growth",color:growthRate>=0?"#22c55e":"#ff3b30"},
              {icon:"🔄",val:avgVisits,label:ar?"متوسط الزيارات":"Avg Visits/Member",color:"#3a8fff"},
            ].map(({icon,val,label,color,sub,subColor})=>(
              <div key={label} style={{background:"#0a0a0a",border:"1px solid #111",borderRadius:16,padding:"16px 14px"}}>
                <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:28,fontWeight:900,color,lineHeight:1}}>{val}</div>
                <div style={{fontSize:10,color:"#444",marginTop:4,letterSpacing:1}}>{label}</div>
                {sub&&<div style={{fontSize:10,color:subColor||"#666",marginTop:4,fontWeight:700}}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* ── TIER BREAKDOWN ── */}
          <div style={{background:"#0a0a0a",border:"1px solid #111",borderRadius:16,padding:"18px",marginBottom:16}}>
            <div style={{fontSize:11,color:"#555",letterSpacing:3,marginBottom:14}}>{ar?"توزيع المستويات":"TIER BREAKDOWN"}</div>
            {[["gold","#ffd700",goldCount],["silver","#c0c0c0",silverCount],["bronze","#cd7f32",bronzeCount]].map(([k,color,count])=>{
              const pct=safeC.length>0?Math.round(count/safeC.length*100):0;
              return(
                <div key={k} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:"#ddd"}}>{TIERS[k].icon} {ar?TIERS[k].ar:TIERS[k].en}</span>
                    <span style={{fontSize:12,color,fontWeight:700}}>{count} ({pct}%)</span>
                  </div>
                  <div style={{background:"#1a1a1a",borderRadius:8,height:7,overflow:"hidden"}}>
                    <div style={{height:"100%",background:color,width:pct+"%",borderRadius:8,transition:"width 1s"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── MONTHLY GROWTH CHART ── */}
          <div style={{background:"#0a0a0a",border:"1px solid #111",borderRadius:16,padding:"18px",marginBottom:16}}>
            <div style={{fontSize:11,color:"#555",letterSpacing:3,marginBottom:18}}>{ar?"النمو الشهري (آخر ٦ أشهر)":"MONTHLY GROWTH (LAST 6 MONTHS)"}</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
              {monthlyData.map((m,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                  <div style={{fontSize:10,color:"#fb4f07",fontWeight:700}}>{m.count||""}</div>
                  <div style={{width:"100%",background:"linear-gradient(180deg,#fb4f07,#c93d00)",borderRadius:"4px 4px 0 0",height:m.count>0?Math.max((m.count/maxBar)*72,8):4,transition:"height 0.8s cubic-bezier(0.4,0,0.2,1)",opacity:i===5?1:0.6}}/>
                  <div style={{fontSize:9,color:"#555",textAlign:"center"}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── TOP 10 MEMBERS ── */}
          <div style={{background:"#0a0a0a",border:"1px solid #111",borderRadius:16,padding:"18px",marginBottom:16}}>
            <div style={{fontSize:11,color:"#555",letterSpacing:3,marginBottom:14}}>{ar?"🏆 أفضل ١٠ أعضاء":"🏆 TOP 10 MEMBERS"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {top10.map((c,i)=>{
                const t=TIERS[getTier(c.visits)];
                return(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:i<3?"rgba(255,215,0,0.04)":"#0d0d0d",borderRadius:12,border:"1px solid "+(i<3?"rgba(255,215,0,0.12)":"#111")}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:i===0?"linear-gradient(135deg,#ffd700,#ff8c00)":i===1?"linear-gradient(135deg,#c0c0c0,#888)":i===2?"linear-gradient(135deg,#cd7f32,#8b4513)":"#1a1a1a",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:i<3?14:11,color:i<3?"#000":"#555",flexShrink:0}}>
                      {i<3?["🥇","🥈","🥉"][i]:i+1}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#fff"}}>{c.name}</div>
                      <div style={{fontSize:10,color:"#444",marginTop:1}}>{c.stamps}/{STAMP_GOAL} {ar?"أختام":"stamps"}</div>
                    </div>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontSize:14,fontWeight:900,color:"#fb4f07"}}>{c.visits}</div>
                      <div style={{fontSize:9,color:"#444"}}>{ar?"زيارة":"visits"}</div>
                    </div>
                    <TierBadge tier={getTier(c.visits)} small lang={lang}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── EXPORT + WA ── */}
          <div style={{background:"#0a0a0a",border:"1px solid rgba(37,211,102,0.15)",borderRadius:16,padding:"18px"}}>
            <div style={{fontSize:11,color:"#25d366",letterSpacing:3,marginBottom:6,fontWeight:700}}>📲 {ar?"تصدير الأرقام":"EXPORT NUMBERS"}</div>
            <div style={{fontSize:12,color:"#444",marginBottom:16}}>{exportData.length} {ar?"رقم جاهز":"numbers ready"}</div>

            {/* Segment */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[["all",ar?"الكل":"All",safeC.length],["full",ar?"مكافأة 🎁":"Reward 🎁",safeC.filter(c=>c.stamps>=STAMP_GOAL).length],["gold",ar?"ذهبيون 🥇":"Gold 🥇",safeC.filter(c=>getTier(c.visits)==="gold").length],["silver",ar?"فضيون 🥈":"Silver 🥈",safeC.filter(c=>getTier(c.visits)==="silver").length]].map(([k,l,cnt])=>(
                <div key={k} onClick={()=>setExportFilter(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,cursor:"pointer",background:exportFilter===k?"rgba(37,211,102,0.06)":"#0d0d0d",border:"1px solid "+(exportFilter===k?"rgba(37,211,102,0.2)":"#111")}}>
                  <div style={{width:16,height:16,borderRadius:3,background:exportFilter===k?"#25d366":"#111",border:"1.5px solid "+(exportFilter===k?"#25d366":"#222"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#000"}}>{exportFilter===k?"✓":""}</div>
                  <div style={{flex:1,fontSize:12,color:exportFilter===k?"#fff":"#555",fontWeight:exportFilter===k?700:400}}>{l}</div>
                  <div style={{fontSize:11,color:"#444",fontWeight:700}}>{cnt}</div>
                </div>
              ))}
            </div>

            {/* WA Broadcast */}
            {wStep==="compose"&&(<>
              <div style={{fontSize:10,color:"#444",letterSpacing:2,marginBottom:8}}>{ar?"قوالب سريعة":"TEMPLATES"}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                {PRESETS.map((p,i)=><button key={i} onClick={()=>setWMsg(p.text)} style={{background:wMsg===p.text?"rgba(37,211,102,0.12)":"#111",border:"1px solid "+(wMsg===p.text?"#25d36666":"#1e1e1e"),color:wMsg===p.text?"#25d366":"#666",padding:"5px 12px",borderRadius:20,fontSize:11,cursor:"pointer",fontWeight:600}}>{p.label}</button>)}
              </div>
              <textarea value={wMsg} onChange={e=>setWMsg(e.target.value)} rows={4} style={{width:"100%",background:"#111",border:"1px solid #1e1e1e",borderRadius:10,color:"#ddd",padding:"12px 14px",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box",direction:"rtl",fontFamily:"inherit",marginBottom:12}}
                onFocus={e=>e.target.style.borderColor="#25d366"} onBlur={e=>e.target.style.borderColor="#1e1e1e"}/>
              <button onClick={()=>wRcpts.length>0&&setWStep("confirm")} style={{width:"100%",padding:"13px",background:wRcpts.length>0?"linear-gradient(135deg,#25d366,#128c7e)":"#111",border:"none",borderRadius:12,color:wRcpts.length>0?"#fff":"#333",fontWeight:800,fontSize:14,cursor:wRcpts.length>0?"pointer":"not-allowed",marginBottom:10}}>
                💬 {ar?"إرسال بث واتساب لـ":"Send WhatsApp to"} {wRcpts.length}
              </button>
              <div style={{display:"flex",gap:8}}>
                <button onClick={copy} style={{flex:1,background:copied?"rgba(34,197,94,0.1)":"transparent",border:"1px solid "+(copied?"rgba(34,197,94,0.3)":"#1e1e1e"),color:copied?"#22c55e":"#555",padding:"9px",borderRadius:10,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  {copied?"✓ "+(ar?"تم النسخ":"Copied!"):"📋 "+(ar?"نسخ الأرقام":"Copy Numbers")}
                </button>
                <button onClick={()=>setShowExport(v=>!v)} style={{flex:1,background:"transparent",border:"1px solid #1e1e1e",color:"#555",padding:"9px",borderRadius:10,fontSize:12,cursor:"pointer"}}>{showExport?(ar?"إخفاء":"Hide"):"👁 "+(ar?"معاينة":"Preview")}</button>
              </div>
            </>)}
            {wStep==="confirm"&&(<>
              <div style={{background:"#0d0d0d",borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:13,color:"#999",lineHeight:1.7,borderRight:"3px solid #25d366",whiteSpace:"pre-wrap",direction:"rtl"}}>{wMsg}</div>
              <div style={{display:"flex",gap:10,marginBottom:10}}>
                <button onClick={()=>setWStep("compose")} style={{flex:1,padding:"12px",borderRadius:12,background:"transparent",border:"1px solid #2a2a2a",color:"#666",fontWeight:700,fontSize:13,cursor:"pointer"}}>← {ar?"تعديل":"Edit"}</button>
                <button onClick={wStart} style={{flex:2,padding:"12px",background:"linear-gradient(135deg,#25d366,#128c7e)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>💬 {ar?"ابدأ الإرسال":"Start Sending"}</button>
              </div>
            </>)}
            {wStep==="sending"&&(<>
              <div style={{textAlign:"center",marginBottom:14}}>
                <div style={{fontSize:32,marginBottom:6}}>{wIdx>=wRcpts.length?"🎉":"💬"}</div>
                <div style={{fontWeight:800,fontSize:16,color:"#25d366"}}>{wIdx} / {wRcpts.length}</div>
              </div>
              <div style={{background:"#1a1a1a",borderRadius:10,height:6,marginBottom:14,overflow:"hidden"}}><div style={{height:"100%",background:"linear-gradient(90deg,#25d366,#128c7e)",width:(wIdx/wRcpts.length*100)+"%",transition:"width 0.4s",borderRadius:10}}/></div>
              {wIdx<wRcpts.length?<button onClick={wNext} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#25d366,#128c7e)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",marginBottom:8}}>💬 {ar?"التالي:":"Next:"} {wRcpts[wIdx]?.name}</button>
              :<button onClick={()=>setWStep("compose")} style={{width:"100%",padding:"12px",background:"#111",border:"1px solid #1e1e1e",borderRadius:12,color:"#888",fontWeight:700,fontSize:13,cursor:"pointer"}}>✓ {ar?"تم":"Done"}</button>}
            </>)}
            {showExport&&wStep==="compose"&&(
              <div style={{marginTop:12,background:"#060606",borderRadius:8,border:"1px solid #111",padding:"12px 14px",fontSize:11,color:"#888",lineHeight:2,fontFamily:"monospace",whiteSpace:"pre",overflowX:"auto"}}>
                {exportData.map((c,i)=>(i+1)+". "+c.name.padEnd(18)+" "+c.phone+" ("+getTier(c.visits)+")").join("\n")}
              </div>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PORTALS + ROOT
// ══════════════════════════════════════════════════════════════
function Portal({route,lang,setLang}){
  const [unlocked,setUnlocked]=useState(()=>{ try{return !!localStorage.getItem("xbowl_staff_session");}catch(e){return false;} });
  const [staffInfo,setStaffInfo]=useState(()=>{ try{const s=localStorage.getItem("xbowl_staff_session");return s?JSON.parse(s):null;}catch(e){return null;} });

  function handleUnlock(staff){
    // Role check
    if(route==="/manager"&&staff.role!=="manager"){
      alert("هذا الحساب ليس لديه صلاحية المدير");
      return;
    }
    try{localStorage.setItem("xbowl_staff_session",JSON.stringify(staff));}catch(e){}
    setStaffInfo(staff); setUnlocked(true);
  }
  function handleLogout(){ try{localStorage.removeItem("xbowl_staff_session");}catch(e){} setStaffInfo(null); setUnlocked(false); }

  if(!unlocked) return <LoginGate lang={lang} onUnlock={handleUnlock} onBack={()=>window.location.href="/"} isManager={route==="/manager"}/>;

  if(route==="/manager") return <ManagerApp lang={lang} setLang={setLang} staffInfo={staffInfo} onLogout={handleLogout}/>;
  return <StaffApp lang={lang} setLang={setLang} staffInfo={staffInfo} onLogout={handleLogout}/>;
}

export default function App(){
  const [lang,setLang]=useState("ar");
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{
    function onPop(){setPath(window.location.pathname);}
    window.addEventListener("popstate",onPop);
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    }
    return()=>window.removeEventListener("popstate",onPop);
  },[]);
  if(path==="/staff"||path==="/staff/") return <Portal route="/staff" lang={lang} setLang={setLang}/>;
  if(path==="/manager"||path==="/manager/") return <Portal route="/manager" lang={lang} setLang={setLang}/>;
  return <CustomerApp lang={lang} setLang={setLang}/>;
}
