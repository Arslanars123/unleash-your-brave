import { NotFoundError } from '../../core/errors/app-error.js';
import { toPublicAnnouncement } from './announcement.mapper.js';
import type { AnnouncementRepository, PaginatedResult } from './announcement.repository.js';
import type {
  Announcement,
  CreateAnnouncementInput,
  ListAnnouncementsQuery,
  PublicAnnouncement,
  UpdateAnnouncementInput,
} from './announcement.types.js';

export class AnnouncementService {
  constructor(private readonly announcements: AnnouncementRepository) {}

  async list(query: ListAnnouncementsQuery): Promise<PaginatedResult<PublicAnnouncement>> {
    const { items, total } = await this.announcements.list(query);
    return { items: items.map(toPublicAnnouncement), total };
  }

  async getById(id: string): Promise<PublicAnnouncement> {
    return toPublicAnnouncement(await this.requireAnnouncement(id));
  }

  async create(input: CreateAnnouncementInput): Promise<PublicAnnouncement> {
    const created = await this.announcements.create({
      title: input.title,
      description: input.description ?? '',
    });
    return toPublicAnnouncement(created);
  }

  async update(id: string, input: UpdateAnnouncementInput): Promise<PublicAnnouncement> {
    await this.requireAnnouncement(id);
    const updated = await this.announcements.update(id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    if (!updated) throw new NotFoundError('Announcement');
    return toPublicAnnouncement(updated);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.announcements.delete(id))) {
      throw new NotFoundError('Announcement');
    }
  }

  private async requireAnnouncement(id: string): Promise<Announcement> {
    const announcement = await this.announcements.findById(id);
    if (!announcement) throw new NotFoundError('Announcement');
    return announcement;
  }
}
