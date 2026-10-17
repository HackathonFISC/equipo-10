export const migrationNames:string[];
export function migrationBody(sql:string):string;
export function assertCleanMigration(record:{finished_at:string|null;rolled_back_at?:string|null;checksum:string}|undefined,checksum:string,name:string):void;
export function deploy(mode?:string):Promise<{status:string;pending:string[];applied_now:string[];existing_business_rows_unchanged:boolean;runtime_verified:boolean}>;
