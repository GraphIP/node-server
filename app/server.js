require("dotenv").config();
const compression = require('compression');
const express = require("express");
const admin = require("./firebase-admin/admin");
const cors = require('cors');
const { postgraphile } = require("postgraphile");
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

const getAuthToken = (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.split(' ')[0] === 'Bearer'
  ) {
    req.authToken = req.headers.authorization.split(' ')[1];
  } else {
    req.authToken = null;
  }
  next();
};


const checkIfAuthenticated = (req, res, next) => {
 getAuthToken(req, res, async () => {
    try {
      const { authToken } = req;
      const userInfo = await admin
        .auth()
        .verifyIdToken(authToken);
      req.authId = userInfo.uid;
      return next();
    } catch (e) {
      return res
        .status(401)
        .send({ error: 'You are not authorised to use the GraphIP API' });
    }
  });
};

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

app.use('/graphql', checkIfAuthenticated, (req, res, next) => {
  console.log(`${chalk.blue('client-ip:')} ${req.ip}, ${chalk.blue('user-agent:')} ${req.headers['user-agent']}`);
  console.log(`${req}`);
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