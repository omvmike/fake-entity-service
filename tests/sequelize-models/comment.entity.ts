import {Model, Table, Column, DataType, ForeignKey, Sequelize} from 'sequelize-typescript';
import { Post } from './post.entity'; // Assuming Post entity exists
import { User } from './user.entity';
import {InferAttributes} from "sequelize"; // Assuming User entity exists

export class ICommentCreateAttributes {
  postId: number;
  userId: number;
  message: string;
}

@Table({
  tableName: 'comments',
  freezeTableName: true,
  underscored: true,
  timestamps: false
})
export class Comment extends Model<InferAttributes<Comment>, ICommentCreateAttributes> {
  @Column({
    autoIncrement: true,
    primaryKey: true,
    unique: true,
    type: DataType.INTEGER
  })
  id: number;

  @ForeignKey(() => Post)
  @Column({
    allowNull: false,
    type: DataType.INTEGER
  })
  postId: number;

  @ForeignKey(() => User)
  @Column({
    allowNull: false,
    type: DataType.INTEGER
  })
  userId: number;

  @Column({
    allowNull: false,
    type: DataType.TEXT
  })
  message: string;

  @Column({
    allowNull: false,
    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    type: DataType.DATE
  })
  createdAt: Date;
}