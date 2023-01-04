'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('roles', [
      {
        id: 1,
        name: 'admin'
      },
      {
        id: 2,
        name: 'consultant'
      },
      {
        id: 3,
        name: 'manager'
      }
    ], { ignoreDuplicates: true });
    await queryInterface.sequelize.query("SELECT setval('roles_id_seq', max(id)) FROM roles;")
  },

  down: async (queryInterface) => {
    return queryInterface.bulkDelete('roles', null, {});
  }
}
