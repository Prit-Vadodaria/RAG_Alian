const chalk = require("chalk");
const loggerMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;
    let statusColor = chalk.green;
    if (statusCode >= 400) {
      statusColor = chalk.red;
    } else if (statusCode >= 300) {
      statusColor = chalk.yellow;
    }
    console.log(
      `${chalk.cyan(method)} ${originalUrl} → ${statusColor(statusCode)} ${chalk.gray(`(${duration}ms)`)}`,
    );
  });
  next();
};

module.exports = {
  loggerMiddleware,
};
