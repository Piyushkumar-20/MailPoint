import { calendarRouter } from "@/server/api/routers/calendar";
import { billingRouter } from "@/server/api/routers/billing";
import { adminRouter } from "@/server/api/routers/admin";
import { gmailRouter } from "@/server/api/routers/gmail";
import { intelligenceRouter } from "@/server/api/routers/intelligence";
import { integrationsRouter } from "@/server/api/routers/integrations";
import { postRouter } from "@/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  gmail: gmailRouter,
  calendar: calendarRouter,
  billing: billingRouter,
  admin: adminRouter,
  intelligence: intelligenceRouter,
  integrations: integrationsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
