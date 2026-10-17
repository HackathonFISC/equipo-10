async (page) => {
  async function login(email){
    await page.getByLabel('Correo electrónico',{exact:false}).fill(email);
    await page.getByLabel('Contraseña',{exact:false}).fill('Demo-test-1234');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByRole('link',{name:'Mi cuenta',exact:true}).waitFor();
  }
  async function company(){
    await page.getByRole('link',{name:'Mi cuenta',exact:true}).click();
    await page.getByRole('button',{name:'Gestionar Vacantes A01',exact:true}).click();
  }
  async function vacancy(){
    await page.getByRole('link',{name:'Explorar',exact:true}).click();
    await page.getByRole('link').filter({has:page.getByRole('heading',{name:'Auxiliar de inventario DEMO',exact:true})}).click();
  }
  await login('carla.demo@example.test');await company();
  await page.getByTestId('new-vacancy-button').click();
  await page.getByTestId('job-raw-text').fill('Registrar entradas y salidas de inventario en bodega. Jornada diurna y salario mensual.');
  await page.getByTestId('analyze-draft-button').click();
  await page.getByTestId('a01-proposal-card').waitFor();
  await page.getByRole('checkbox',{name:'He revisado el puesto, habilidades y condiciones.',exact:false}).check();
  await page.getByTestId('publish-job-button').click();
  await page.getByRole('heading',{name:'Gestión de Vacantes y Candidaturas',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await login('ana.demo@example.test');await vacancy();
  await page.getByRole('button',{name:'Autorizar candidatura con mi perfil',exact:true}).click();
  await page.getByText('Autorización Concedida',{exact:true}).waitFor();
  await page.reload();await page.getByText('Autorización Concedida',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await login('carla.demo@example.test');await company();
  const listed=page.waitForResponse(r=>r.url().endsWith('/applications')&&r.request().method()==='GET');
  await page.getByRole('button',{name:'Ver candidaturas',exact:true}).click();
  const body=await (await listed).json();
  if(body.data.items.length!==1)throw new Error('Consented application missing');
  if(JSON.stringify(body).includes('ana.demo@')||JSON.stringify(body).includes('Joven DEMO D7'))throw new Error('Candidate identity exposed');
  await page.getByTestId('candidate-application-item').waitFor();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await login('ana.demo@example.test');await vacancy();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Retirar autorización de candidatura',exact:true}).click();
  await page.getByRole('button',{name:'Volver a autorizar candidatura',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await login('carla.demo@example.test');await company();
  await page.getByRole('button',{name:'Ver candidaturas',exact:true}).click();
  await page.getByText('Aún no hay candidatos que hayan autorizado su postulación a esta vacante.',{exact:true}).waitFor();
  console.log('Integrated company publishes/candidate consents/reload/company minimized/candidate withdraws/access cut PASS; synthetic A01');
}
