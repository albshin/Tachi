import CreateLogCtx from "lib/logger/logger";
import { RequestHandler, Response } from "express-serve-static-core";

const logger = CreateLogCtx(__filename);

// https://stackoverflow.com/a/64546368/11885828
// Taken from Jonathan Turnock - This is an *incredibly* nice
// solution for post-request express logging!

const ResJsonInteceptor = (res: Response, json: Response["json"]) => (content: unknown) => {
	// @ts-expect-error general monkeypatching error
	res.contentBody = content;
	res.json = json;
	res.json(content);
};

export const RequestLoggerMiddleware: RequestHandler = (req, res, next) => {
	// I'm not really a fan of this style of omission - but it works.

	// we **KNOW** for certain that there are only two endpoints where a password is
	// sent to us - /register and /auth.
	// and both of those use `password` as a key.
	// still, i don't like it.

	const safeBody = Object.prototype.hasOwnProperty.call(req.body, "password")
		? Object.assign({ password: "[OMITTED]" }, req.body)
		: req.body;

	logger.debug(`Received request ${req.method} ${req.url}.`, {
		query: req.query,
		body: safeBody,
	});

	// @ts-expect-error we're doing some wacky monkey patching
	res.json = ResJsonInteceptor(res, res.json);

	res.on("finish", () => {
		const contents = {
			// @ts-expect-error we're doing some monkey patching - contentBody is what we're returning.
			body: res.contentBody,
			statusCode: res.statusCode,
			requestQuery: req.query,
			requestBody: safeBody,
		};

		if (res.statusCode < 400) {
			logger.verbose(`(${req.method} ${req.url}) Returned`, contents);
		} else if (res.statusCode < 500) {
			logger.info(`(${req.method} ${req.url}) Returned`, contents);
		} else {
			logger.error(`(${req.method} ${req.url}) Returned`, contents);
		}
	});

	return next();
};
