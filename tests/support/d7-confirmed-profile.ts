import { randomUUID } from 'node:crypto';
import type { IdentityDatabase } from '../../apps/api/src/infrastructure/database';
import type { VerifiedIdentity } from '../../apps/api/src/security/auth';
import { IdentityService } from '../../apps/api/src/modules/identity/identity.service';
import { ProfileService } from '../../apps/api/src/modules/profile/profile.service';
import { ProfileSectionSchema } from '@equipo10/contracts';

// Synthetic test actor confirms through the actual service and all SQL guards.
export async function seedConfirmedD7Profile(db:IdentityDatabase,identity:VerifiedIdentity) {
  const account=new IdentityService(db), profiles=new ProfileService(db);
  await account.bootstrap(identity); await account.ensureProfile(identity);
  const existing=await account.getProfile(identity);
  if(existing.current_version_id)return existing;
  const {draft}=await profiles.createDraft(identity,undefined,randomUUID());
  const {draft:updated}=await profiles.patchIdentity(identity,draft.revision,{display_name:'Joven DEMO D7',headline:'Aprendizaje de inventario'});
  for(const section of ProfileSectionSchema.options) await profiles.reviewSection(identity,updated.revision,section,'REVIEWED',randomUUID());
  const {preview}=await profiles.generateReviewPreview(identity,updated.revision,randomUUID());
  await profiles.confirmProfile(identity,{draft_id:updated.id,preview_id:preview.preview_id,acknowledge_partial:true},updated.revision,randomUUID());
  return account.getProfile(identity);
}
