import { useState } from 'react';
import { auth } from './lib/api';

export default function ResetPassword() {
 const token=new URLSearchParams(window.location.search).get('token')||'';
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [done,setDone]=useState(false);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');setMessage('');
  if(password.length<12){setError('A senha deve ter pelo menos 12 caracteres.');return;}
  if(password!==confirm){setError('As senhas não conferem.');return;}
  try{const response=await fetch(((import.meta as any).env.VITE_API_URL||'')+'/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível redefinir a senha.');setMessage(data.message);setDone(true);}
  catch(e:any){setError(e.message||'Não foi possível redefinir a senha.');}
 };
 return <main className="login-screen"><div className="login-card"><div className="brand-mark">HSI</div><p className="eyebrow">ENAT · SEGURANÇA DA CONTA</p><h1>Redefinir senha</h1>{done?<div className="notice success">{message}<p><a href="./app.html">Voltar ao acesso da plataforma</a></p></div>:<form className="login-form" onSubmit={submit}><label>Nova senha</label><input type="password" minLength={12} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 12 caracteres"/><label>Confirmar nova senha</label><input type="password" minLength={12} required autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repita a nova senha"/>{error&&<div className="notice error">{error}</div>}<button className="primary full" type="submit" disabled={!token}>Salvar nova senha</button>{!token&&<div className="notice error">Link de redefinição inválido. Solicite outro link.</div>}</form>}</div></main>;
}