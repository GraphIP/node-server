require("dotenv").config();
const express = require("express");
const { postgraphile } = require("postgraphile");
const manifest = require("../app/package.json");
const chalk = require("chalk");

const {
  PORT,
  DATABASE_URL,
  DATABASE_SCHEMA,
  GRAPHQL_ENDPOINT,
  GRAPHIQL_ENDPOINT,
  JWT_SECRET,
  LOG_LEVEL,
  NODE_ENV
} = process.env;

const defaultPort = 3000;

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

app.use('/graphql', (req, res, next) => {
  console.log(`${chalk.blue('client-ip:')} ${req.ip}, ${chalk.blue('user-agent:')} ${req.headers['user-agent']}`);
  next();
});

app.use(
  postgraphile(
    DATABASE_URL,
    DATABASE_SCHEMA,
    {
      graphqlRoute: GRAPHQL_ENDPOINT,
      graphiqlRoute: GRAPHIQL_ENDPOINT,
      jwtSecret: JWT_SECRET,
      ignoreRBAC: false,
      ignoreIndexes: false,
      //graphiql: true,
      //enhanceGraphiql: true,
      pgSettings: async req => ({
        'client.ip': `${req.ip}`
      }),
    }
  )
);

app.listen(PORT || defaultPort, () => {
  const versionString = `v${manifest.version}`;
  console.log('');
  console.log(`GraphIP ${chalk.blue(versionString)} listening on port ${chalk.blue(PORT || defaultPort)} 🚀`);
  console.log('');
  console.log(` ‣ LOG_LEVEL: ${LOG_LEVEL || 'info'}`);
  console.log(` ‣ NODE_ENV: ${NODE_ENV || 'development'}`);
  console.log('');
  console.log(chalk.default.gray('* * *'));
  console.log('');
});