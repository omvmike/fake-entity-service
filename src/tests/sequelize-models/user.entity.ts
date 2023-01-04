import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Role } from './role.entity';

@Table({
  timestamps: false,
  tableName: 'users',
  freezeTableName: true,
})
export class User extends Model {
  @Column({
    autoIncrement: true,
    unique: true,
    primaryKey: true,
    allowNull: false,
  })
  readonly id: number;


  @Column({
    type: DataType.TEXT,
    unique: true,
    validate: {
      isEmail: {
        msg: 'Field must be email type',
      },
    },
    allowNull: false,
  })
  email: string;


  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'first_name',
  })
  firstName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'last_name',
  })
  lastName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'password',
  })
  password: string;

  @ForeignKey(() => Role)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'role_id',
  })
  roleId: number;

  @BelongsTo(() => Role)
  readonly role: Role;
}

User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.roleId;
  return values;
};
