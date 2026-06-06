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
