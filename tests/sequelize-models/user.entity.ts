import { InferAttributes } from 'sequelize';
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey, HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { Role } from './role.entity';
import {Post} from "./post.entity";

export class IUserCreateAttributes {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleId: number;
}

@Table({
  timestamps: false,
  tableName: 'users',
  freezeTableName: true,
  underscored: true,
})
export class User extends Model<
  InferAttributes<User>,
  IUserCreateAttributes
> {
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
  })
  firstName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  lastName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  password: string;

  @ForeignKey(() => Role)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  roleId: number;

  @BelongsTo(() => Role)
  readonly role: Role;

  @HasMany(() => Post)
  readonly posts: Post[];
}

User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.roleId;
  return values;
};
