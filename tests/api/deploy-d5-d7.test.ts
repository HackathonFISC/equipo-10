import {test,expect} from 'bun:test';
import {migrationBody,assertCleanMigration,migrationNames} from '../../scripts/deploy-d5-d7.mjs';
test('deployment joins migrations in one transaction without discarding function bodies',()=>{
  const body="BEGIN;\nCREATE FUNCTION f() RETURNS void AS $$ BEGIN RETURN; END $$ LANGUAGE plpgsql;\nCOMMIT;\n";
  expect(migrationBody(body)).toBe('CREATE FUNCTION f() RETURNS void AS $$ BEGIN RETURN; END $$ LANGUAGE plpgsql;\n');
  expect(migrationBody('CREATE TABLE x(id int);')).toBe('CREATE TABLE x(id int);');
  expect(migrationNames.at(-1)).toBe('202610170009_company_scope');
});
test('deployment rejects incomplete or modified recorded migration',()=>{
  expect(()=>assertCleanMigration({finished_at:null,checksum:'a'},'a','demo')).toThrow();
  expect(()=>assertCleanMigration({finished_at:'done',checksum:'b'},'a','demo')).toThrow();
  expect(()=>assertCleanMigration({finished_at:'done',checksum:'a',rolled_back_at:'bad'},'a','demo')).toThrow();
  expect(()=>assertCleanMigration({finished_at:'done',checksum:'a'},'a','demo')).not.toThrow();
});
