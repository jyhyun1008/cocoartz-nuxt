    import { db } from '../utils/db';
    import { servers } from '../db/schema';
    import { eq } from 'drizzle-orm';

    export default eventHandler(async (event) => {
      const { slug } = await readBody(event)
      const result = await db.select().from(servers).where(eq(slug, servers.slug))
      return result;
    });