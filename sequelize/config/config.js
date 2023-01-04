
module.exports = {
  local: {
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'tester',
    password: 'test-pwd',
    database: 'test-db',
    migrationStorageTableName: 'sequelize_migrations',
  },
  docker: {
    dialect: 'postgres',
    host: 'pg-db',
    port: 5432,
    username: 'tester',
    password: 'test-pwd',
    database: 'test-db',
    migrationStorageTableName: 'sequelize_migrations',
  },
};
