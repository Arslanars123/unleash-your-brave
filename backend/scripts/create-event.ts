import 'dotenv/config';
import { connectMongo } from '../src/db/mongo.js';
import { MongoEventRepository } from '../src/db/repositories/mongo-event.repository.js';
import { EventService } from '../src/modules/events/event.service.js';

const DAYS = [
  { date: '2026-09-10', label: 'Day 1' },
  { date: '2026-09-11', label: 'Day 2' },
  { date: '2026-09-12', label: 'Day 3' },
  { date: '2026-09-13', label: 'Day 4' },
];

async function main() {
  await connectMongo();

  const eventService = new EventService(new MongoEventRepository());
  const existing = await eventService.list({ page: 1, perPage: 1 });

  const event =
    existing.total === 0
      ? await eventService.create({ days: DAYS })
      : await eventService.scheduleNew({ days: DAYS, copyDetailsFromPrevious: false });

  console.log('Event created:');
  console.log(`  ID:    ${event.id}`);
  console.log(`  Name:  ${event.name}`);
  console.log(`  Dates: ${event.startDate.slice(0, 10)} → ${event.endDate.slice(0, 10)}`);
  console.log(
    `  Days:  ${event.days.map((day) => day.date.slice(0, 10)).join(', ')}`,
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
