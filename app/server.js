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
  LOG_LEVEL,
  NODE_ENV
} = process.env;

const defaultPort = 3000;

const app = express();
// Proxy Client IP Address
app.set('trust proxy', true);
// Disable powered by Express
app.disable('x-powered-by');
// Artifical HealthCheck path for GKE ingress deployment [WIP]
app.get('/health', (req, res) => res.end('OK'));

// Accept GET requests hack - https://github.com/graphile/postgraphile/issues/442
const hackReq = (fn) => (req, res, next) => {
  if (req.method === 'GET') {
    req.method = 'POST';
    const payload = {
      query: req.query.query,
      operationName: req.query.operationName,
      variables: req.query.variables,
    };
    const originalBody = req.body;
    req.body = payload;
    fn(req, res, (err) => {
      req.body = originalBody;
      req.method = 'GET';
      next(err);
    });
  } else {
    fn(req, res, next);
  }
}

app.use('/graphql', (req, res, next) => {
  console.log(`${chalk.blue('client-ip:')} ${req.ip}, ${chalk.blue('user-agent:')} ${req.headers['user-agent']}`);
  next();
});

app.use(hackReq( // Accept GET requests hack (may not work if other proxies are configured to refuse malformed GET requests)
    postgraphile(
      DATABASE_URL,
      DATABASE_SCHEMA,
      {
        graphqlRoute: GRAPHQL_ENDPOINT,
        graphiqlRoute: GRAPHIQL_ENDPOINT,
        ignoreRBAC: false,
        ignoreIndexes: false,
        //graphiql: true,
        //enhanceGraphiql: true,
        retryOnInitFail: true,
        pgSettings: async req => ({
          'client.ip': `${req.ip}`
        }),
      }
    )
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