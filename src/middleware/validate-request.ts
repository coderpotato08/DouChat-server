import { Context, Middleware } from "koa";
import z from "zod";
import { $ErrorCode } from "../constant/errorData";
import { createRes } from "../models/responseModel";

type RequestSchemas = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

type ValidationSource = keyof RequestSchemas;

type ValidationErrorPayload = {
  source: ValidationSource;
  error: z.ZodError;
  message: string;
};

type ValidateRequestOptions = {
  onValidationError?: (ctx: Context, payload: ValidationErrorPayload) => Promise<void> | void;
};

export type ValidatedRequestData<TBody = unknown, TQuery = unknown, TParams = unknown> = {
  body: TBody;
  query: TQuery;
  params: TParams;
};

const VALIDATED_REQUEST_DATA_KEY = "validatedRequestData";

const formatValidationMessage = (source: ValidationSource, error: z.ZodError): string => {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return `请求${source}参数校验失败`;
  }

  const issuePath = firstIssue.path.length ? `.${firstIssue.path.join(".")}` : "";
  return `请求${source}${issuePath}参数校验失败: ${firstIssue.message}`;
};

export const validateRequest = (
  schemas: RequestSchemas,
  options: ValidateRequestOptions = {},
): Middleware => {
  return async (ctx, next) => {
    const validatedData: ValidatedRequestData = {
      body: ctx.request.body,
      query: ctx.request.query,
      params: (ctx as Context & { params?: unknown }).params ?? {},
    };

    const sources: ValidationSource[] = ["body", "query", "params"];
    for (const source of sources) {
      const schema = schemas[source];
      if (!schema) {
        continue;
      }

      const rawValue = validatedData[source];
      const result = await schema.safeParseAsync(rawValue ?? {});
      if (!result.success) {
        const message = formatValidationMessage(source, result.error);
        const payload: ValidationErrorPayload = {
          source,
          error: result.error,
          message,
        };

        if (options.onValidationError) {
          await options.onValidationError(ctx, payload);
          return;
        }

        ctx.status = 400;
        ctx.body = createRes(
          $ErrorCode.Common.SERVER_ERROR,
          {
            issues: result.error.issues,
          },
          message,
        );
        return;
      }

      validatedData[source] = result.data;
    }

    ctx.state[VALIDATED_REQUEST_DATA_KEY] = validatedData;
    await next();
  };
};

export const getValidatedRequestData = <TBody = unknown, TQuery = unknown, TParams = unknown>(
  ctx: Context,
): ValidatedRequestData<TBody, TQuery, TParams> => {
  const stored = ctx.state[VALIDATED_REQUEST_DATA_KEY] as
    | ValidatedRequestData<TBody, TQuery, TParams>
    | undefined;
  if (stored) {
    return stored;
  }

  return {
    body: ctx.request.body as TBody,
    query: ctx.request.query as TQuery,
    params: ((ctx as Context & { params?: unknown }).params ?? {}) as TParams,
  };
};
