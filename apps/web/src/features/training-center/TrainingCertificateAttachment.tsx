import React,{useRef,useState} from 'react';
import type { TrainingCompletionView,TrainingCertificateView } from '@equipo10/contracts';
import { Button,Notice } from '../../components/Controls';
import { fetchWithHeaders } from '../../lib/api';
import styles from './training-center.module.css';

export function TrainingCertificateAttachment({completion,token,org}:{completion:TrainingCompletionView;token:string;org?:string}){
  const [certificate,setCertificate]=useState(completion.certificate);
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const operation=useRef<{file:File;key:string}|null>(null);
  async function upload(){
    if(!file||!org||busy)return;
    if(file.type!=='application/pdf'||file.size>5*1024*1024){setError('Selecciona un PDF de hasta 5 MB.');return;}
    if(operation.current?.file!==file)operation.current={file,key:crypto.randomUUID()};
    setBusy(true);setError('');
    try{const body=new FormData();body.append('file',file);
      const result=await fetchWithHeaders<{certificate:TrainingCertificateView}>(`/organizations/${org}/training-completions/${completion.id}/certificate`,token,{method:'POST',body,headers:{'Idempotency-Key':operation.current.key}});
      setCertificate(result.data.certificate);setFile(null);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo adjuntar el certificado.');}finally{setBusy(false);}
  }
  async function download(){
    if(!certificate||busy)return;setBusy(true);setError('');
    try{
      const base=new URL(import.meta.env.VITE_API_URL||'http://127.0.0.1:3001');
      const response=await fetch(`${base.origin}/api/v1/training-certificates/${certificate.id}/download`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo descargar el certificado. Comprueba tu sesión e inténtalo de nuevo.');
      const url=URL.createObjectURL(await response.blob()),anchor=document.createElement('a');anchor.href=url;anchor.download=certificate.original_filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo descargar.');}finally{setBusy(false);}
  }
  if(completion.decision!=='COMPLETED')return <p className={styles.muted}>No corresponde adjuntar un certificado de finalización.</p>;
  return <section className={styles.stack} aria-label="Certificado privado" aria-busy={busy}>
    {error&&<Notice error>{error}</Notice>}
    {certificate?<><p>Certificado adjuntado por el centro: {certificate.original_filename}</p><div><Button variant="secondary" disabled={busy} onClick={download}>{busy?'Preparando archivo…':'Descargar certificado'}</Button></div></>:org?<>
      <label className={styles.field}>Certificado emitido por el centro (PDF, máximo 5 MB)<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setError('');}} /></label>
      <p className={styles.muted}>Se guardará como archivo privado. No se genera ni acredita una habilidad automáticamente. No se puede reemplazar.</p>
      <div><Button variant="secondary" disabled={busy||!file} onClick={upload}>{busy?'Adjuntando certificado…':'Adjuntar certificado existente'}</Button></div>
    </>:<p className={styles.muted}>El centro todavía no ha adjuntado un certificado.</p>}
  </section>;
}
