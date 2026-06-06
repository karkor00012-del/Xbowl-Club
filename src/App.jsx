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
  async getCustomerByPhone(p){ const d=p.replace(/\D/g,""); return (await sb.query("customers","GET",null,`?phone=eq.${d}&select=*`||[]))[0]||null; },
  async getCustomerById(id)  { return (await sb.query("customers","GET",null,`?id=eq.${id}&select=*`||[]))[0]||null; },
  async createCustomer(c)    { return (await sb.query("customers","POST",c)||[])[0]||null; },
  async updateCustomer(id,d) { return await sb.query("customers","PATCH",d,`?id=eq.${id}`); },
  async deleteCustomer(id)   { await sb.query("rewards","DELETE",null,`?customer_id=eq.${id}`); return await sb.query("customers","DELETE",null,`?id=eq.${id}`); },
  async getRewards()         { return await sb.query("rewards","GET",null,"?select=*&order=redeemed_at.desc")||[]; },
  async addReward(r)         { return await sb.query("rewards","POST",r); },
  async loginStaff(email,pw) { return (await sb.query("staff","GET",null,`?email=eq.${encodeURIComponent(email)}&password_hash=eq.${encodeURIComponent(pw)}&select=*`||[]))[0]||null; },
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

// ── COMPONENTS ─────────────────────────────────────────────────
function Spinner(){ return <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid #1e1e1e",borderTop:"3px solid #fb4f07",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>; }

function TierBadge({tier,small,lang="ar"}){ const t=TIERS[tier||"bronze"]; return <span style={{display:"inline-flex",alignItems:"center",gap:small?3:6,background:t.color+"18",border:"1px solid "+t.color+"44",color:t.color,borderRadius:20,padding:small?"3px 10px":"5px 14px",fontSize:small?10:12,fontWeight:700}}>{t.icon} {lang==="ar"?t.ar:t.en}</span>; }

function QRCode({value,size=120}){ return <div style={{background:"#fff",padding:8,borderRadius:10,display:"inline-flex",flexDirection:"column",alignItems:"center",gap:4}}><QRCodeSVG value={value} size={size} bgColor="#ffffff" fgColor="#000000" level="M"/><div style={{color:"#000",fontSize:9,letterSpacing:2,fontFamily:"monospace",fontWeight:700}}>{value}</div></div>; }

function ProgressRing({stamps,goal,size=90}){ const r=(size-10)/2,circ=2*Math.PI*r; const [a,setA]=useState(0); useEffect(()=>{setTimeout(()=>setA(Math.min(stamps/goal,1)),100);},[stamps]); return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#og)" strokeWidth={5} strokeDasharray={circ} strokeDashoffset={circ*(1-a)} strokeLinecap="round" style={{transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)"}}/><defs><linearGradient id="og" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#fb4f07"/><stop offset="100%" stopColor="#ff8c00"/></linearGradient></defs></svg>; }

// ── STAFF LOGIN ─────────────────────────────────────────────────
function LoginGate({onUnlock,onBack,lang="ar",isManager=false}){
  const [email,setEmail]=useState(""), [pw,setPw]=useState(""), [err,setErr]=useState(""), [loading,setLoading]=useState(false);
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
        <div style={{background:isManager?"linear-gradient(135deg,#b8860b,#8b6914)":"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"32px 24px 26px",textAlign:"center",position:"relative"}}>
          <div style={{fontSize:50,marginBottom:10}}>{isManager?"👑":"🔧"}</div>
          <div style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:2,marginBottom:4}}>{isManager?(ar?"بوابة المدير":"Manager Portal"):(ar?"بوابة الموظف":"Staff Portal")}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>XBOWL LOYALTY SYSTEM</div>
        </div>
        <div style={{padding:"26px 24px 28px"}}>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"الإيميل":"EMAIL"}</label>
            <input value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} placeholder={isManager?"manager@xbowl.com":"staff@xbowl.com"} type="email" onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={{width:"100%",background:"#111",border:"1px solid "+(err?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:15,outline:"none",boxSizing:"border-box",direction:"ltr"}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:10,color:"#555",letterSpacing:2,marginBottom:8}}>{ar?"كلمة المرور":"PASSWORD"}</label>
            <input value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} placeholder="••••••••" type="password" onKeyDown={e=>e.key==="Enter"&&doLogin()}
              style={{width:"100%",background:"#111",border:"1px solid "+(err?"#ff4444":"#1e1e1e"),borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:15,outline:"none",boxSizing:"border-box",direction:"ltr"}}/>
          </div>
          {err&&<div style={{color:"#ff5555",fontSize:13,marginBottom:14,textAlign:"center",padding:"8px 12px",background:"rgba(255,85,85,0.08)",borderRadius:8,border:"1px solid rgba(255,85,85,0.2)"}}>⚠ {err}</div>}
          <button onClick={doLogin} disabled={loading} style={{width:"100%",padding:"15px",background:loading?"#1a1a1a":isManager?"linear-gradient(135deg,#ffd700,#b8860b)":"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:14,color:isManager&&!loading?"#000":"#fff",fontWeight:900,fontSize:15,cursor:loading?"not-allowed":"pointer",boxShadow:loading?"none":isManager?"0 8px 24px rgba(255,215,0,0.3)":"0 8px 24px rgba(251,79,7,0.4)",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading ? <div style={{width:18,height:18,border:"2px solid #333",borderTop:"2px solid #fb4f07",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> : (isManager?"👑 ":"🔧 ")+(ar?"تسجيل الدخول":"Sign In")}
          </button>
          <button onClick={onBack} style={{width:"100%",padding:"13px",background:"#111",border:"2px solid #222",borderRadius:14,color:"#888",fontWeight:700,fontSize:14,cursor:"pointer"}}>← {ar?"العودة للموقع الرئيسي":"Back to Main Site"}</button>
        </div>
      </div>
    </div>
  );
}

// ── QR SCANNER (REPAIRED & SAFE) ────────────────────────────────
function QRScanner({onResult,onClose,lang="ar"}){
  const [manual,setManual]=useState(""), [status,setStatus]=useState("loading"), [errMsg,setErrMsg]=useState("");
  const html5Ref=useRef(null);
  const ar=lang==="ar";

  function loadLib(url,cb){ if(window.Html5Qrcode){cb();return;} const s=document.createElement("script"); s.src=url; s.onload=cb; s.onerror=()=>setStatus("error"); document.head.appendChild(s); }
  
  function stopScanner(){ if(html5Ref.current){try{html5Ref.current.stop().catch(()=>{});}catch(e){} html5Ref.current=null;} }

  useEffect(()=>{
    // تأخير تشغيل الكاميرا للتأكد من بناء الـ DOM أولاً ومنع الكراش
    const timer = setTimeout(() => {
      loadLib("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",()=>{
        const container = document.getElementById("xbowl-qr");
        if (!container) return; // الحماية الأساسية لمنع كراش الصفحة البيضاء
        try{
          const sc=new window.Html5Qrcode("xbowl-qr");
          html5Ref.current=sc;
          sc.start({facingMode:"environment"},{fps:10,qrbox:{width:200,height:200}},
            (text)=>{stopScanner();onResult(text);},
            ()=>{}
          ).then(()=>setStatus("scanning")).catch(()=>{setStatus("error");setErrMsg(ar?"لا يمكن الوصول للكاميرا":"Camera unavailable");});
        }catch(e){setStatus("error");}
      });
    }, 300);

    return ()=>{ clearTimeout(timer); stopScanner(); };
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
              style={{flex:1,background:"#111",border:"1px solid #1a1a1a",borderRadius:12,color:"#fff",padding:"12px 14px",fontSize:16,outline:"none",fontFamily:"monospace",letterSpacing:3}}/>
            <button onClick={()=>manual.trim()&&onResult(manual.trim().toUpperCase())} style={{background:"#fb4f07",border:"none",color:"#fff",padding:"12px 18px",borderRadius:12,fontWeight:800,fontSize:13,cursor:"pointer"}}>{ar?"بحث":"Search"}</button>
          </div>
        </div>
      </div>
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
      const s=localStorage.getItem("xb_cust_data"); if(!s) return;
      const saved=JSON.parse(s); if(!saved?.id) return;
      sb.getCustomerById(saved.id).then(fresh=>{
        if(fresh){ setCustomer(fresh); setScreen("card"); localStorage.setItem("xb_cust_data",JSON.stringify(fresh)); }
        else{ localStorage.removeItem("xb_cust_data"); }
      }).catch(()=>{ setCustomer(saved); setScreen("card"); });
    }catch(e){}
  },[]);

  async function lookup(){
    if(!phone.trim()){setError(ar?"أدخل رقم الجوال":"Enter your phone");return;}
    setLoading(true); setError("");
    try{
      const c=await sb.getCustomerByPhone(phone);
      if(c){ setCustomer(c); setScreen("card"); localStorage.setItem("xb_cust_data",JSON.stringify(c)); }
      else setError(ar?"الرقم غير مسجل — سجّل بطاقتك مجاناً":"Not found — register for free");
    }catch(e){setError(ar?"حدث خطأ":"Error");}
    setLoading(false);
  }

  async function register(){
    const e={}; if(!regForm.name.trim()) e.name=ar?"مطلوب":"Required";
    if(regForm.phone.replace(/\D/g,"").length<9) e.phone=ar?"رقم غير صحيح":"Invalid";
    if(Object.keys(e).length){setRegErr(e);return;}
    setLoading(true);
    try{
      const all=await sb.getCustomers();
      const nc={id:genId(all),name:regForm.name.trim(),phone:regForm.phone.replace(/\D/g,""),stamps:0,visits:0,tier:"bronze",joined:Date.now(),last_visit:Date.now()};
      const created=await sb.createCustomer(nc); const c=created||nc;
      setCustomer(c); setJustReg(true); setScreen("card"); localStorage.setItem("xb_cust_data",JSON.stringify(c));
    }catch(e){setRegErr({phone:ar?"الرقم مسجل مسبقاً":"Already registered"});}
    setLoading(false);
  }

  function signout(){ setScreen("home"); setCustomer(null); setPhone(""); setJustReg(false); localStorage.removeItem("xb_cust_data"); }

  const tier=customer?TIERS[getTier(customer.visits)]:TIERS.bronze;
  const nextTier=!customer?null:customer.visits>=15?null:customer.visits>=5?TIERS.gold:TIERS.silver;
  const visitsToNext=!customer?0:customer.visits>=15?0:customer.visits>=5?15-customer.visits:5-customer.visits;

  return (
    <div dir={ar?"rtl":"ltr"} style={{minHeight:"100vh",background:"#060606",fontFamily:"sans-serif",paddingBottom:20,backgroundImage:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(251,79,7,0.12) 0%,transparent 70%)"}}>
      {showQR&&customer&&(
        <div onClick={()=>setShowQR(false)} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20}}>
          <div style={{fontSize:12,color:"#555",letterSpacing:2}}>{ar?"أرِ هذا للموظف":"Show to staff"}</div>
          <div style={{background:"#0d0d0d",border:"1px solid rgba(251,79,7,0.3)",borderRadius:20,padding:24}}><QRCode value={customer.id} size={200}/></div>
          <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:4,fontFamily:"monospace"}}>{customer.id}</div>
        </div>
      )}
      <div style={{padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(251,79,7,0.15)",background:"rgba(6,6,6,0.95)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#fb4f07,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎳</div>
          <div><div style={{fontSize:17,fontWeight:900,color:"#fb4f07"}}>XBOWL</div></div>
        </div>
        <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"rgba(251,79,7,0.08)",border:"1px solid rgba(251,79,7,0.2)",color:"#fb4f07",padding:"5px 14px",borderRadius:20,cursor:"pointer"}}>{ar?"EN":"عربي"}</button>
      </div>

      <div style={{maxWidth:460,margin:"0 auto",padding:"24px 16px"}}>
        {screen==="home"&&(
          <div>
            <div style={{textAlign:"center",padding:"32px 0 24px"}}>
              <div style={{fontSize:58,marginBottom:10}}>🎳</div>
              <h1 style={{margin:0,fontSize:30,color:"#fff"}}>{ar?"برنامج الولاء":"Loyalty Program"}</h1>
            </div>
            <div style={{background:"#0d0d0d",border:"1px solid #141414",borderRadius:20,padding:"22px"}}>
              <input value={phone} onChange={e=>setPhone(fmtPhone(e.target.value))} placeholder="05X XXX XXXX" inputMode="tel"
                style={{width:"100%",background:"#111",border:"1px solid #1e1e1e",borderRadius:12,color:"#fff",padding:"14px 16px",fontSize:16,outline:"none",marginBottom:14}}/>
              {error&&<div style={{color:"#ff5555",fontSize:12,marginBottom:14}}>⚠ {error}</div>}
              <button onClick={lookup} disabled={loading} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:14,color:"#fff",fontWeight:800,cursor:"pointer"}}>
                {loading?"...":(ar?"عرض بطاقتي":"View My Card")}
              </button>
              <button onClick={()=>setScreen("register")} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:14,color:"#555",marginTop:10,cursor:"pointer"}}>{ar?"تسجيل بطاقة جديدة مجاناً ←":"Register free card →"}</button>
            </div>
          </div>
        )}

        {screen==="register"&&(
          <div style={{background:"#121212",borderRadius:18,border:"1px solid rgba(251,79,7,0.2)",overflow:"hidden"}}>
            <div style={{background:"linear-gradient(135deg,#fb4f07,#c93d00)",padding:"20px"}}>
              <button onClick={()=>setScreen("home")} style={{background:"rgba(0,0,0,0.22)",border:"none",color:"#fff",padding:"5px 12px",borderRadius:8,cursor:"pointer",fontSize:12,marginBottom:10}}>{ar?"→ رجوع":"← Back"}</button>
              <div style={{fontWeight:900,fontSize:20,color:"#fff"}}>{ar?"بطاقة جديدة 🎳":"New Card 🎳"}</div>
            </div>
            <div style={{padding:"22px 18px 26px"}}>
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:10,color:"#555",marginBottom:8}}>{ar?"الاسم":"NAME"}</label>
                <input value={regForm.name} onChange={e=>setRegForm(f=>({...f,name:e.target.value}))} placeholder={ar?"الاسم الكامل":"Full name"} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#fff",padding:"13px 15px"}}/>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:10,color:"#555",marginBottom:8}}>{ar?"رقم الجوال":"PHONE"}</label>
                <input value={regForm.phone} onChange={e=>setRegForm(f=>({...f,phone:fmtPhone(e.target.value)}))} placeholder="05XXXXXXXX" inputMode="tel" style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#fff",padding:"13px 15px"}}/>
              </div>
              <button onClick={register} disabled={loading} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:12,color:"#fff",fontWeight:800,cursor:"pointer"}}>
                {loading?"...":(ar?"إنشاء بطاقتي 🎳":"Create My Card 🎳")}
              </button>
            </div>
          </div>
        )}

        {screen==="card"&&customer&&(
          <div>
            <div style={{background:tier.bg,border:"1px solid "+tier.color+"22",borderRadius:20,padding:"22px",marginBottom:14,position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
                <div>
                  <div style={{fontSize:10,color:tier.color,fontWeight:700}}>XBOWL LOYALTY</div>
                  <div style={{fontSize:18,color:"#fff",fontWeight:900,marginTop:4}}>{customer.name}</div>
                  <div style={{marginTop:8}}><TierBadge tier={getTier(customer.visits)} lang={lang}/></div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                  <QRCode value={customer.id} size={70}/>
                  <button onClick={()=>setShowQR(true)} style={{background:tier.color+"18",border:"1px solid "+tier.color+"33",color:tier.color,padding:"4px 10px",borderRadius:8,fontSize:10,cursor:"pointer"}}>{ar?"عرض كامل":"Full QR"}</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{position:"relative",flexShrink:0}}>
                  <ProgressRing stamps={customer.stamps} goal={STAMP_GOAL} size={88}/>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#fff"}}>{customer.stamps}</div>
                    <div style={{fontSize:9,color:"#666"}}>/{STAMP_GOAL}</div>
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6}}>
                    {Array.from({length:STAMP_GOAL}).map((_,i)=>(<div key={i} style={{width:40,height:40,borderRadius:"50%",background:i<customer.stamps?"linear-gradient(135deg,#fb4f07,#c93d00)":"rgba(255,255,255,0.04)",border:i<customer.stamps?"none":"1.5px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<customer.stamps?16:12,color:i<customer.stamps?"#fff":"#333"}}>{i<customer.stamps?"🎳":i+1}</div>))}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={signout} style={{width:"100%",padding:"11px",background:"transparent",border:"1px solid #1e1e1e",borderRadius:12,color:"#444",cursor:"pointer"}}>{ar?"تسجيل الخروج":"Sign Out"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── STAFF & MANAGER APP ─────────────────────────────────────────
function StaffApp({lang,setLang,staffInfo,onLogout}){
  const [tab,setTab]=useState("scan");
  const [scanner,setScanner]=useState(false);
  const [cust,setCust]=useState(null), [search,setSearch]=useState(""), [loading,setLoading]=useState(false);
  const [allCusts,setAllCusts]=useState([]), [allRewards,setAllRewards]=useState([]);
  const [newPw,setNewPw]=useState(""), [pwErr,setPwErr]=useState(""), [pwSuccess,setPwSuccess]=useState("");
  const ar=lang==="ar";

  useEffect(()=>{
    if(tab==="customers"||tab==="scan") sb.getCustomers().then(setAllCusts).catch(()=>{});
    if(tab==="rewards") sb.getRewards().then(setAllRewards).catch(()=>{});
  },[tab]);

  async function handleScanResult(text){
    setScanner(false); setLoading(true); setCust(null);
    try{
      let cleaned=text.trim().toUpperCase();
      let c=await sb.getCustomerById(cleaned) || await sb.getCustomerByPhone(cleaned);
      if(c){ setCust(c); setTab("scan"); }
      else alert(ar?"لم يتم العثور على الزبون":"Customer not found");
    }catch(e){ alert(ar?"حدث خطأ في البحث":"Search error"); }
    setLoading(false);
  }

  async function addStamp(){
    if(!cust)return; setLoading(true);
    try{
      const ns=cust.stamps+1; const nv=cust.visits+1; const nt=getTier(nv);
      await sb.updateCustomer(cust.id,{stamps:ns,visits:nv,tier:nt,last_visit:Date.now()});
      const fresh=await sb.getCustomerById(cust.id); setCust(fresh);
      alert(ar?"تم إضافة الختم بنجاح! 🎳":"Stamp added successfully!");
    }catch(e){alert(ar?"فشل إضافة الختم":"Failed to add stamp");}
    setLoading(false);
  }

  async function redeemFreeGame(){
    if(!cust||cust.stamps<STAMP_GOAL)return; setLoading(true);
    try{
      await sb.updateCustomer(cust.id,{stamps:cust.stamps-STAMP_GOAL});
      await sb.addReward({customer_id:cust.id,customer_name:cust.name,reward_name:"لعبة مجانية",redeemed_at:Date.now(),processed_by:staffInfo?.name||"Staff"});
      const fresh=await sb.getCustomerById(cust.id); setCust(fresh);
      alert(ar?"تم تفعيل اللعبة المجانية بنجاح! 🎁":"Free game redeemed!");
    }catch(e){alert(ar?"فشل تفعيل المكافأة":"Failed redemption");}
    setLoading(false);
  }

  async function handleUpdatePassword(){
    if(staffInfo?.role !== "manager"){ alert(ar ? "عذراً، للمدير فقط!" : "Managers only."); return; }
    if(!newPw.trim()||newPw.length<4){ setPwErr(ar?"كلمة المرور قصيرة":"Too short"); return; }
    setLoading(true); setPwErr(""); setPwSuccess("");
    try{
      await sb.updatePassword(staffInfo.id,newPw.trim());
      setPwSuccess(ar?"تم التحديث بنجاح!":"Password updated!"); setNewPw("");
    }catch(e){ setPwErr(ar?"فشل التحديث":"Update failed"); }
    setLoading(false);
  }

  return (
    <div dir={ar?"rtl":"ltr"} style={{minHeight:"100vh",background:"#080808",color:"#fff",fontFamily:"sans-serif",paddingBottom:80}}>
      {scanner&&<QRScanner lang={lang} onClose={()=>setScanner(false)} onResult={handleScanResult}/>}
      <div style={{background:"#111",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1a1a1a"}}>
        <div>
          <div style={{fontWeight:800,fontSize:15}}>{staffInfo?.name}</div>
          <div style={{fontSize:10,color:"#666"}}>{staffInfo?.role==="manager"?(ar?"المدير":"Manager"):(ar?"موظف":"Staff")}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setLang(ar?"en":"ar")} style={{background:"#1a1a1a",border:"none",color:"#aaa",padding:"6px 12px",borderRadius:8}}>{ar?"EN":"عربي"}</button>
          <button onClick={onLogout} style={{background:"rgba(255,0,0,0.1)",color:"#ff4444",border:"none",padding:"6px 12px",borderRadius:8}}>{ar?"خروج":"Logout"}</button>
        </div>
      </div>

      <div style={{maxWidth:500,margin:"0 auto",padding:16}}>
        {tab==="scan"&&(
          <div>
            <button onClick={()=>setScanner(true)} style={{width:"100%",padding:32,background:"linear-gradient(135deg,#fb4f07,#c93d00)",border:"none",borderRadius:20,color:"#fff",fontSize:18,fontWeight:900,cursor:"pointer",marginBottom:20}}>
              🔲 {ar?"افتح الكاميرا لمسح الـ QR":"Open Camera to Scan QR"}
            </button>
            <div style={{display:"flex",gap:8,marginBottom:24}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="05X... / XB001" style={{flex:1,background:"#111",border:"1px solid #1e1e1e",borderRadius:12,color:"#fff",padding:12}}/>
              <button onClick={()=>search.trim()&&handleScanResult(search)} style={{background:"#1a1a1a",color:"#fff",border:"none",padding:"0 20px",borderRadius:12}}>{ar?"بحث":"Search"}</button>
            </div>
            {loading&&<Spinner/>}
            {cust&&(
              <div style={{background:"#111",borderRadius:20,padding:20,border:"1px solid #1a1a1a"}}>
                <h3>{cust.name} ({cust.id})</h3>
                <p>📱 {fmtPhone(cust.phone)}</p>
                <p>🎳 الأختام الحالية: {cust.stamps} / {STAMP_GOAL}</p>
                <button onClick={addStamp} style={{width:"100%",padding:12,background:"#fff",color:"#000",border:"none",borderRadius:10,fontWeight:800,marginBottom:10}}>🎳 إضافة ختم زيارة</button>
                {cust.stamps>=STAMP_GOAL&&<button onClick={redeemFreeGame} style={{width:"100%",padding:12,background:"#00c853",color:"#fff",border:"none",borderRadius:10,fontWeight:800}}>🎁 تفعيل اللعبة المجانية</button>}
              </div>
            )}
          </div>
        )}

        {tab==="customers"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {allCusts.filter(c=>c.name.includes(search)||c.id.includes(search.toUpperCase())).map(c=>(
              <div key={c.id} onClick={()=>handleScanResult(c.id)} style={{background:"#111",padding:14,borderRadius:12,cursor:"pointer",display:"flex",justifyContent:"space-between"}}>
                <div><div>{c.name}</div><div style={{fontSize:11,color:"#555"}}>{c.id}</div></div>
                <span style={{color:"#fb4f07"}}>🎳 {c.stamps}</span>
              </div>
            ))}
          </div>
        )}

        {tab==="rewards"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {allRewards.map(r=>(
              <div key={r.id} style={{background:"#111",padding:14,borderRadius:12,display:"flex",justifyContent:"space-between"}}>
                <div><div>🎁 {r.reward_name}</div><div style={{fontSize:12,color:"#666"}}>{r.customer_name}</div></div>
              </div>
            ))}
          </div>
        )}

        {tab==="settings"&&(
          <div style={{background:"#111",borderRadius:16,padding:20}}>
            <h3>{ar?"إعدادات الحساب":"Settings"}</h3>
            {staffInfo?.role === 'manager' ? (
              <div>
                <input value={newPw} onChange={e=>{setNewPw(e.target.value); setPwErr(""); setPwSuccess("");}} placeholder="كلمة المرور الجديدة" type="password" style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#fff",padding:12,marginBottom:12}}/>
                {pwErr&&<div style={{color:"#ff4444"}}>{pwErr}</div>} {pwSuccess&&<div style={{color:"#00c853"}}>{pwSuccess}</div>}
                <button onClick={handleUpdatePassword} style={{width:"100%",padding:12,background:"#fb4f07",color:"#fff",border:"none",borderRadius:10}}>{ar?"تحديث":"Update"}</button>
              </div>
            ) : <p style={{color:"#444"}}>{ar?"تغيير كلمة المرور متاح للمدير فقط":"Managers only."}</p>}
          </div>
        )}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#111",display:"grid",gridTemplateColumns:"repeat(4,1fr)",height:64}}>
        {[["scan","🔲",ar?"الرئيسية":"Main"],["customers","👥",ar?"الزبائن":"Customers"],["rewards","🎁",ar?"المكافآت":"Rewards"],["settings","⚙",ar?"الإعدادات":"Settings"]].map(([t,ic,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:"transparent",border:"none",color:tab===t?"#fb4f07":"#555",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{fontSize:18}}>{ic}</span><span style={{fontSize:10}}>{l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ROUTER ────────────────────────────────────────────────
function Portal({route,lang,setLang}){
  const [unlocked,setUnlocked]=useState(()=>{ try{return !!localStorage.getItem("xbowl_staff_session");}catch(e){return false;} });
  const [staffInfo,setStaffInfo]=useState(()=>{ try{const s=localStorage.getItem("xbowl_staff_session");return s?JSON.parse(s):null;}catch(e){return null;} });

  function handleUnlock(staff){
    if(route==="/manager"&&staff.role!=="manager"){ alert("صلاحية مدير فقط"); return; }
    try{localStorage.setItem("xbowl_staff_session",JSON.stringify(staff));}catch(e){}
    setStaffInfo(staff); setUnlocked(true);
  }
  function handleLogout(){ try{localStorage.removeItem("xbowl_staff_session");}catch(e){} setStaffInfo(null); setUnlocked(false); }

  if(!unlocked) return <LoginGate lang={lang} onUnlock={handleUnlock} onBack={()=>window.location.href="/"} isManager={route==="/manager"}/>;
  return <StaffApp lang={lang} setLang={setLang} staffInfo={staffInfo} onLogout={handleLogout}/>;
}

export default function App(){
  const [lang,setLang]=useState("ar");
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{ function onPop(){setPath(window.location.pathname);} window.addEventListener("popstate",onPop); return()=>window.removeEventListener("popstate",onPop); },[]);
  if(path==="/staff"||path==="/staff/") return <Portal route="/staff" lang={lang} setLang={setLang}/>;
  if(path==="/manager"||path==="/manager/") return <Portal route="/manager" lang={lang} setLang={setLang}/>;
  return <CustomerApp lang={lang} setLang={setLang}/>;
}
