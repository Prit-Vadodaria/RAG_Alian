const app = require("./app");
const { PORT } = require("./config/env");

app.listen(PORT, () => {
  console.log(`Express server listening on http://localhost:${PORT}`);
});
