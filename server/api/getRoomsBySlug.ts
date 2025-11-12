    import { db } from '../utils/db';
    import { rooms } from '../db/schema';
    import { like } from 'drizzle-orm';

    export default eventHandler(async (event) => {
      const { slug } = await readBody(event)
      const path = `/${slug}/%`
      const result = await db.select().from(rooms).where(like(rooms.path, path))
      return result;
    });