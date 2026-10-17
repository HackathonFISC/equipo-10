async (page) => {
  await page.getByRole('checkbox',{name:'Acepto iniciar el ejercicio y guardar mis respuestas y resultado de forma privada.'}).check();
  const started=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/assessment-attempts'));
  await page.getByRole('button',{name:'Iniciar ejercicio',exact:true}).click();
  const publicAttempt=await (await started).json();
  if(JSON.stringify(publicAttempt).includes('correct_option_id')||JSON.stringify(publicAttempt).includes('rationale'))throw new Error('Private answer leaked before submission');
  await page.getByRole('radio',{name:'Aumentan',exact:true}).check();
  await page.getByRole('checkbox',{name:'Revisé mis respuestas y confirmo su entrega.'}).check();
  await page.getByRole('button',{name:'Entregar respuestas',exact:true}).click();
  await page.getByRole('heading',{name:'Resultado: 1 de 1 respuestas correctas',exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'Quiero asociar este resultado a mi perfil como evidencia de este ejercicio.'}).check();
  await page.getByRole('button',{name:'Confirmar asociación al perfil',exact:true}).click();
  await page.getByText('Resultado asociado a tu perfil',{exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.clear());
  await page.reload();
  await page.getByText('Resultado asociado a tu perfil',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Mis intentos guardados'}).waitFor();
  console.log('D7 consent/private questions/C01/result/association/server recovery PASS; synthetic runner');
}
