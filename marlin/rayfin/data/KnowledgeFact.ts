import { authenticated, date, entity, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@authenticated('read')
export class KnowledgeFact {
  @uuid() id!: string;

  @set('stakeholder', 'commitment', 'meeting-fact', 'decision', 'email-fact', 'history', 'open-concept', 'other')
  factType!: 'stakeholder' | 'commitment' | 'meeting-fact' | 'decision' | 'email-fact' | 'history' | 'open-concept' | 'other';

  @text({ max: 200 }) subject!: string;
  @text({ max: 4000 }) content!: string;
  @date({ optional: true }) occurredAt?: Date;
  @text({ max: 2048 }) sourceUrl!: string;
  @text({ max: 200, optional: true }) sourceLabel?: string;
  @text({ max: 320, optional: true }) capturedBy?: string;
  @date() capturedAt!: Date;
}
