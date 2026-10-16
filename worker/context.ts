import type { Params } from "./router";
import type { User } from "./session";

export type Context = { request: Request; env: Env; url: URL; params: Params; now: number };

export type Handler = (ctx: Context) => Promise<Response>;

export type AuthedHandler = (ctx: Context, user: User) => Promise<Response>;
