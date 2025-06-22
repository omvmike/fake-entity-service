'use strict';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sequelize = require('sequelize');

const migrationCommands = [
  {
    fn: 'createTable',
    params: [
      'roles',
      {
        id: {
          autoIncrement: true,
          primaryKey: true,
          unique: true,
          type: Sequelize.INTEGER,
        },
        name: {
          allowNull: false,
          type: Sequelize.TEXT,
          unique: true,
        },
      },
      {},
    ],
  },
  {
    fn: 'createTable',
    params: [
      'users',
      {
        id: {
          autoIncrement: true,
          primaryKey: true,
          unique: true,
          allowNull: false,
          type: Sequelize.INTEGER,
        },
        email: {
          validate: {
            isEmail: {
              msg: 'Field must be email type',
            },
          },
          unique: true,
          allowNull: false,
          type: Sequelize.TEXT,
        },
        first_name: {
          allowNull: false,
          type: Sequelize.TEXT,
        },
        last_name: {
          allowNull: false,
          type: Sequelize.TEXT,
        },
        password: {
          allowNull: false,
          type: Sequelize.TEXT,
        },
        role_id: {
          references: {
            model: 'roles',
            key: 'id',
          },
          allowNull: false,
          type: Sequelize.INTEGER,
        },
        created_at: {
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          type: Sequelize.DATE,
        },
        updated_at: {
          allowNull: true,
          type: Sequelize.DATE,
        },
      },
      {},
    ],
  },
  {
    fn: 'createTable',
    params: [
      'posts',
      {
        id: {
          autoIncrement: true,
          primaryKey: true,
          unique: true,
          type: Sequelize.INTEGER,
        },
        user_id: {
          references: {
            model: 'users',
            key: 'id',
          },
          allowNull: false,
          type: Sequelize.INTEGER,
        },
        message: {
          allowNull: false,
          type: Sequelize.TEXT,
        },
        created_at: {
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          type: Sequelize.DATE,
        },
        updated_at: {
          allowNull: true,
          type: Sequelize.DATE,
        },
      },
      {},
    ],
  },
  {
    fn: 'createTable',
    params: [
      'comments',
      {
        id: {
          autoIncrement: true,
          primaryKey: true,
          unique: true,
          type: Sequelize.INTEGER,
        },
        post_id: {
          references: {
            model: 'posts',
            key: 'id',
          },
          allowNull: false,
          type: Sequelize.INTEGER,
        },
        user_id: {
          references: {
            model: 'users',
            key: 'id',
          },
          allowNull: false,
          type: Sequelize.INTEGER,
        },
        message: {
          allowNull: false,
          type: Sequelize.TEXT,
        },
        created_at: {
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          type: Sequelize.DATE,
        },
      },
      {},
    ],
  },
  {
    fn: 'createTable',
    params: [
      'leader_followers',
      {
        leader_id: {
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          allowNull: false,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        follower_id: {
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
          allowNull: false,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        created_at: {
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          type: Sequelize.DATE,
        },
      },
      {},
    ],
  },
]

const rollbackCommands = [
  {
    fn: 'dropTable',
    params: ['comments'],
  },
  {
    fn: 'dropTable',
    params: ['posts'],
  },
  {
    fn: 'dropTable',
    params: ['leader_followers'],
  },
  {
    fn: 'dropTable',
    params: ['users'],
  },
  {
    fn: 'dropTable',
    params: ['roles'],
  },
]

module.exports = {
  up: async (queryInterface) => {
    let index = 0;
    for (const command of migrationCommands) {
      console.log('[#' + (index + 1) + '] execute: ' + command.fn + ' ' + command.params[0]);
      await queryInterface[command.fn].apply(queryInterface, command.params);
      index += 1;
    }
  },
  down: async (queryInterface) => {
    let index = 0;
    for (const command of rollbackCommands) {
      console.log('[#' + (index + 1) + '] execute: ' + command.fn + ' ' + command.params[0]);
      await queryInterface[command.fn].apply(queryInterface, command.params);
      index += 1;
    }
  },
};
