import {
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import {User} from "./user.entity";

@Table({
  timestamps: false,
  tableName: 'leader_followers',
  freezeTableName: true,
})
export class LeaderFollower extends Model {

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    allowNull: false,
    field: 'leader_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  leaderId: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    allowNull: false,
    field: 'follower_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  followerId: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'created_at',
  })
  createdAt: Date;
}

LeaderFollower.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.roleId;
  return values;
};
