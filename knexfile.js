const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DB_PATH || './data/jobmatcher.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/main/database/migrations',
      extension: 'js'
    }
  },

  production: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DB_PATH || './data/jobmatcher.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/main/database/migrations',
      extension: 'js'
    }
  },

  test: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DB_PATH || './tests/data/test.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/main/database/migrations',
      extension: 'js'
    }
  }
};
