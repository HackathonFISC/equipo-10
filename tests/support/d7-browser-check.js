async (page) => {
  await page.getByRole('button', {name:'+ Crear curso',exact:true}).click();
  await page.getByLabel('Código interno').fill('D7-UI');
  await page.getByLabel('Nombre del curso').fill('Inventario práctico D7');
  await page.getByLabel('Descripción', {exact:true}).fill('Curso sintético de inventario');
  await page.getByRole('button', {name:'Crear borrador',exact:true}).click();
  await page.getByLabel('Temario', {exact:true}).fill('Curso de registro de inventario con hojas de cálculo.');
  await page.getByRole('checkbox', {name:'Autorizar el análisis de este temario mediante Vertex AI.'}).check();
  await page.getByRole('button', {name:'Analizar temario',exact:true}).click();
  await page.getByRole('heading',{name:'Revisar habilidades propuestas'}).waitFor();
  await page.getByRole('button', {name:'Guardar avance del temario',exact:true}).click();
  await page.getByText('Avance del temario guardado.',{exact:false}).waitFor();
  await page.getByRole('button', {name:'← Volver a mis cursos'}).click();
  await page.getByRole('button', {name:'Ver curso y ediciones'}).click();
  await page.getByRole('heading',{name:'Revisar habilidades propuestas'}).waitFor();
  await page.getByLabel('Lugar o plataforma').fill('Aula virtual DEMO');
  await page.getByLabel('Fecha de inicio').fill('2027-01-04');
  await page.getByLabel('Fecha final').fill('2027-01-25');
  await page.getByRole('checkbox',{name:'He revisado las habilidades, prerrequisitos, precio, fechas y cupos.',exact:false}).check();
  await page.getByRole('button',{name:'Confirmar y publicar edición',exact:true}).click();
  await page.getByText('La edición ya está disponible para consulta.',{exact:false}).waitFor();
  await page.getByRole('link',{name:'Cursos',exact:true}).click();
  await page.getByRole('heading',{name:'Inventario práctico D7',exact:true}).waitFor();
  console.log('D7 browser create/analyze/save/reopen/publish/catalog PASS; synthetic runner');
}
