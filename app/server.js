require("dotenv").config();
const compression = require('compression');
const express = require("express");
const cors = require('cors');
const { postgraphile } = require("postgraphile");
const PgSimplifyInflectorPlugin = require("@graphile-contrib/pg-simplify-inflector");
const { NodePlugin, MutationPlugin, MutationPayloadQueryPlugin } = require("graphile-build");
const manifest = require("../app/package.json");
const chalk = require("chalk");
const os = require("os");

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

app.use(cors());

const shouldCompress = (req, res) => {
  if (req.headers['x-no-compression']) {
    // don't compress responses if this request header is present
    return false;
  }

  // fallback to standard compression
  return compression.filter(req, res);
};

app.use(compression({
  // filter decides if the response should be compressed or not,
  // based on the `shouldCompress` function above
  filter: shouldCompress,
  // threshold is the byte threshold for the response body size
  // before compression is considered, the default is 1kb
  threshold: 0
}));

// Proxy Client IP Address
app.set('trust proxy', true);
// Disable powered by Express
app.disable('x-powered-by');

// HealthCheck path for GKE ingress deployment
const hostname = os.hostname();
app.use('/health', require('express-healthcheck')({
  healthy: function () {
      return { status: "OK", uptime: process.uptime(), host: hostname };
  }
}));

app.use(express.json());

app.use('/graphql', (req, res, next) => {
  console.log(`${chalk.blue('client-ip:')} ${req.ip}, ${chalk.blue('user-agent:')} ${req.headers['user-agent']}`);
  //console.log(req.body.query);
  console.log(JSON.stringify(req.body.query));
  next();
});

app.use(
    postgraphile(
      DATABASE_URL,
      DATABASE_SCHEMA,
      {
        graphileBuildOptions: {
          pgOmitListSuffix: true, // lose the 'List' suffix
        },
        graphqlRoute: GRAPHQL_ENDPOINT,
        graphiqlRoute: GRAPHIQL_ENDPOINT,
        ignoreRBAC: false,
        ignoreIndexes: false,
        simpleCollections: "only",
        disableQueryLog: true,
        //graphiql: true,
        //enhanceGraphiql: true,
        retryOnInitFail: true,
        appendPlugins: [PgSimplifyInflectorPlugin],
        skipPlugins: [NodePlugin, MutationPlugin, MutationPayloadQueryPlugin],
        pgSettings: async req => ({
          'client.ip': `${req.ip}`
        }),
      }
    )
  );

const server = app.listen(PORT || defaultPort, () => {
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

server.keepAliveTimeout = 61 * 1000;
server.headersTimeout = 65 * 1000;