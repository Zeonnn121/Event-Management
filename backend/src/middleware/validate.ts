import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { badRequest } from "../utils/HttpError";

export function validate(
  schema: ZodSchema,
  target: "body" | "query" | "params" = "body"
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return next(badRequest("Validation failed", details));
    }
    // Replace with parsed (and coerced/defaulted) values.
    // Express 5 exposes req.query as a getter, so a plain assignment throws;
    // shadow it with an own property instead.
    if (target === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      (req as any)[target] = result.data;
    }
    next();
  };
}
