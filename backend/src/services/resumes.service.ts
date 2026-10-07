import { randomUUID } from "crypto";
import * as resumes from "../repositories/resumes.repository";
import { deleteResumeVectors, ingestResume } from "./ai.service";

export type { ResumeRow } from "../repositories/resumes.repository";

export function getResume(userId: string) {
  return resumes.findResume(userId);
}

/**
 * Index a resume, then record it. An AIServiceError from ingestion propagates for the
 * route to map (a rejected PDF is the user's problem; an outage is ours).
 */
export async function uploadResume(userId: string, upload: { contentBase64: string; filename: string; byteSize: number }) {
  // Nothing is mutated until the new resume is successfully ingested.
  //
  // The obvious ordering -- upsert the row, ingest, roll back on failure -- was
  // implemented first and is wrong: uploading a scanned or corrupt PDF then
  // *destroys the good resume the user already had*, because the rollback
  // deletes the row and purges the namespace. A rejected upload must be a no-op.
  //
  // The id is reused when a resume already exists so the row id stays stable
  // across re-uploads, and minted here otherwise so the chunks can be labelled
  // before the row is written.
  const resumeId = (await resumes.findResumeId(userId)) ?? randomUUID();

  // Deliberately no rollback if this throws: the database was never touched, and the
  // store only replaces a namespace after embedding has already succeeded.
  const ingest = await ingestResume({
    user_id: userId,
    resume_id: resumeId,
    content_base64: upload.contentBase64,
    filename: upload.filename,
  });

  return resumes.upsertResume({
    id: resumeId,
    userId,
    filename: upload.filename,
    byteSize: upload.byteSize,
    pageCount: ingest.pageCount,
    charCount: ingest.charCount,
    chunkCount: ingest.chunkCount,
    sections: ingest.sections ?? [],
  });
}

export async function deleteResume(userId: string) {
  // Vectors first. If the row went first and the purge then failed, the user
  // would see no resume while their chunks were still retrievable -- exactly
  // the failure a deletion feature exists to prevent.
  const purge = await deleteResumeVectors(userId);
  await resumes.deleteResume(userId);
  return { deletedChunks: purge.deletedChunks, remainingChunks: purge.remainingChunks };
}

/**
 * Whether to ground an interview in the user's resume. Personalisation is additive, so
 * a failed lookup means "no", never a failed interview.
 */
export async function userHasResume(userId: string): Promise<boolean> {
  try {
    return await resumes.hasIndexedResume(userId);
  } catch (err) {
    console.error("Resume lookup failed, continuing without grounding", err);
    return false;
  }
}
