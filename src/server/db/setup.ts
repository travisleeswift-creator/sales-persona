import { getDb } from "@/server/db/index";
import { prepareDatabase } from "@/server/db/prepare";

const db = await getDb();
await prepareDatabase(db);
console.log("Database schema is ready and persona seed data is loaded.");
