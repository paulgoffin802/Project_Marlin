import { KnowledgeFact } from './KnowledgeFact.js';
import { ProgrammeRecord } from './ProgrammeRecord.js';

export type MarlinSchema = {
  ProgrammeRecord: ProgrammeRecord;
  KnowledgeFact: KnowledgeFact;
};

export type BlankAppSchema = MarlinSchema;

export const schema = [ProgrammeRecord, KnowledgeFact];
