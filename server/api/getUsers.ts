    // Example: Fetching all users
    import { db } from '../utils/db';
    import { users } from '../db/schema';

    export default eventHandler(async () => {
      const result = await db.select().from(users).all();
      return result;
    });