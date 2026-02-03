import { AuthUser } from "../modules/auth/auth.types";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    correlationId?: string;
  }
}
