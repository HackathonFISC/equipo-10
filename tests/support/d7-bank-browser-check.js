async (page) => {
  if(await page.getByRole('button',{name:'Proponer preguntas con A02',exact:true}).count()) {
    await page.getByRole('checkbox',{name:'Autorizar el análisis del contenido confirmado mediante Vertex AI para proponer preguntas.'}).check();
    await page.getByRole('button',{name:'Proponer preguntas con A02',exact:true}).click();
  }
  await page.getByRole('textbox',{name:'Enunciado',exact:true}).fill('¿Qué ocurre con las existencias al registrar una entrada?');
  await page.getByRole('checkbox',{name:'He revisado las preguntas, sus respuestas, explicaciones y citas.',exact:false}).check();
  await page.getByRole('button',{name:'Confirmar banco de preguntas',exact:true}).click();
  await page.getByText('Banco revisado guardado.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Participantes',exact:true}).click();
  await page.getByRole('button',{name:'Registrar resultado',exact:true}).click();
  await page.getByLabel('Fecha del resultado',{exact:false}).fill('2026-10-14');
  await page.getByLabel('Motivo o evidencia revisada').fill('Participación y ejercicios revisados en esta prueba sintética.');
  await page.getByRole('checkbox',{name:'He verificado este resultado y confirmo su registro para esta persona.',exact:false}).check();
  await page.getByRole('button',{name:'Confirmar resultado',exact:true}).click();
  await page.getByRole('heading',{name:'Curso finalizado',exact:true}).waitFor();
  await page.getByLabel('Certificado emitido por el centro', {exact:false}).setInputFiles({name:'fixture-tecnico.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nTechnical upload fixture - NOT A REAL CERTIFICATE\n%%EOF')});
  await page.getByRole('button',{name:'Adjuntar certificado existente',exact:true}).click();
  await page.getByRole('button',{name:'Descargar certificado',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.getByLabel('Correo electrónico',{exact:false}).fill('ana.demo@example.test');
  await page.getByLabel('Contraseña',{exact:false}).fill('Demo-test-1234');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByRole('link',{name:'Cursos',exact:true}).click();
  await page.getByRole('button',{name:'Descargar certificado',exact:true}).waitFor();
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Descargar certificado',exact:true}).click();
  const file=await downloaded;
  if(file.suggestedFilename()!=='fixture-tecnico.pdf')throw new Error('Certificate download mismatch');
  await page.getByRole('link').filter({has:page.getByRole('heading',{name:'Inventario: curso realizado DEMO',exact:true})}).click();
  console.log('D7 bank approval/completion/private certificate candidate download PASS; synthetic fixtures');
}
