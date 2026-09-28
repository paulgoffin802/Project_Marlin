import { authenticated, date, entity, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@authenticated('read')
export class ProgrammeRecord {
  @uuid() id!: string;

  @set('objective', 'principle', 'milestone', 'person', 'roadmap-item')
  kind!: 'objective' | 'principle' | 'milestone' | 'person' | 'roadmap-item';

  @text({ max: 200 }) title!: string;
  @text({ max: 3000 }) summary!: string;
  @text({ max: 80, optional: true }) status?: string;
  @text({ max: 200, optional: true }) owner?: string;
  @date({ optional: true }) startDate?: Date;
  @date({ optional: true }) targetDate?: Date;
  @text({ max: 2048 }) sourceUrl!: string;
  @date() updatedAt!: Date;
}
